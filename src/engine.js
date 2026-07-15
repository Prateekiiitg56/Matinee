/* ═══════════════════════════════════════════
   MATINEE — Recommendation Engine
   Content-based + Collaborative filtering
   Works with dynamic genre lists from API
   ═══════════════════════════════════════════ */

import { getMovies, getGenres, getSynthUsers } from './data.js';

/* ── Vector utilities ── */
export function genreVector(movie) {
  const genres = getGenres();
  return genres.map(g => movie.genres.includes(g) ? 1 : 0);
}

export function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/* ═══════ CONTENT-BASED ═══════ */

export function buildContentProfile(userRatings) {
  const genres = getGenres();
  const movies = getMovies();
  const profile = new Array(genres.length).fill(0);

  Object.entries(userRatings).forEach(([id, rating]) => {
    const movie = movies.find(m => m.id === Number(id));
    if (!movie) return;
    const weight = rating - 3; // like=+1, pass=-1
    genreVector(movie).forEach((v, i) => { profile[i] += v * weight; });
  });
  return profile;
}

export function contentScore(movie, profile) {
  const similarity = (cosine(profile, genreVector(movie)) + 1) / 2;
  // Blend with TMDB user rating to favor high-quality matching movies
  const quality = movie.rating ? (movie.rating / 10) : 0.6;
  return similarity * 0.7 + quality * 0.3;
}

export function bestContentReasonMovie(movie, userRatings) {
  const movies = getMovies();
  let best = null, bestScore = -1;

  Object.entries(userRatings).forEach(([id, rating]) => {
    if (rating < 4) return;
    const rated = movies.find(m => m.id === Number(id));
    if (!rated) return;
    const overlap = rated.genres.filter(g => movie.genres.includes(g)).length;
    const score = overlap * 10 + rating;
    if (overlap > 0 && score > bestScore) { bestScore = score; best = rated; }
  });
  return best;
}


/* ═══════ COLLABORATIVE FILTERING ═══════ */

export function findNeighbors(userRatings) {
  const synthUsers = getSynthUsers();
  const ratedIds = Object.keys(userRatings).map(Number);

  return synthUsers
    .map(su => {
      const shared = ratedIds.filter(id => su.ratings[id] != null);
      // Require at least 3 shared ratings to reduce coincidental similarities
      if (shared.length < 3) return { su, sim: 0, shared: shared.length };
      
      // Mean center ratings around 3 (neutral) to calculate accurate Pearson Correlation
      const a = shared.map(id => userRatings[id] - 3);
      const b = shared.map(id => su.ratings[id] - 3);
      return { su, sim: cosine(a, b), shared: shared.length };
    })
    .filter(n => n.sim > 0.15)
    .sort((x, y) => y.sim - x.sim)
    .slice(0, 10);
}

export function collabScore(movie, neighbors) {
  let num = 0, den = 0, support = 0;
  neighbors.forEach(n => {
    const r = n.su.ratings[movie.id];
    if (r != null) { num += n.sim * r; den += n.sim; support++; }
  });
  if (den === 0) return { score: 0, support: 0 };
  const prediction = (num / den) / 5;
  const quality = movie.rating ? (movie.rating / 10) : 0.6;
  return { score: prediction * 0.75 + quality * 0.25, support };
}


/* ═══════ HYBRID / RANKING ═══════ */

export function rankCandidates(userRatings, mode, blend) {
  const movies = getMovies();
  const profile = buildContentProfile(userRatings);
  const neighbors = findNeighbors(userRatings);
  const ratedIds = new Set(Object.keys(userRatings).map(Number));

  let candidates = movies
    .filter(m => !ratedIds.has(m.id))
    .map(m => {
      const cScore = contentScore(m, profile);
      const { score: colScore, support } = collabScore(m, neighbors);
      return { movie: m, cScore, colScore, support };
    });

  let sorted;
  if (mode === 'content') {
    sorted = candidates.slice().sort((a, b) => b.cScore - a.cScore);
  } else if (mode === 'collab') {
    sorted = candidates.filter(c => c.support > 0).sort((a, b) => b.colScore - a.colScore);
  } else {
    sorted = candidates.map(c => {
      const contentW = 1 - blend;
      const collabW  = blend;
      const effContentW = c.support > 0 ? contentW : 1;
      const effCollabW  = c.support > 0 ? collabW  : 0;
      return { ...c, hybrid: effContentW * c.cScore + effCollabW * c.colScore };
    }).sort((a, b) => b.hybrid - a.hybrid);
  }

  return sorted.slice(0, 8).map(c => {
    const { pct, reasons } = buildReasons(c, mode, neighbors, userRatings);
    return { ...c, pct, reasons };
  });
}


/* ── Reason builder ── */
function buildReasons(c, mode, neighbors, userRatings) {
  let pct;
  const reasons = [];

  if (mode === 'content') {
    pct = Math.round(c.cScore * 100);
    const src = bestContentReasonMovie(c.movie, userRatings);
    reasons.push({
      kind: 'content',
      text: src ? `Because you liked <b>${src.title}</b>` : 'Matches the genres you respond to'
    });
  } else if (mode === 'collab') {
    pct = Math.round(c.colScore * 100);
    const strong = neighbors.filter(n => n.sim > 0.3 && n.su.ratings[c.movie.id] >= 4).length;
    reasons.push({
      kind: 'collab',
      text: strong > 0
        ? `<b>${strong}</b> kindred viewer${strong > 1 ? 's' : ''} rated this 4★+`
        : 'Closest match among people like you'
    });
  } else {
    pct = Math.round(c.hybrid * 100);
    const src = bestContentReasonMovie(c.movie, userRatings);
    if (src) reasons.push({ kind: 'content', text: `Because you liked <b>${src.title}</b>` });
    const strong = neighbors.filter(n => n.sim > 0.3 && n.su.ratings[c.movie.id] >= 4).length;
    if (strong > 0) reasons.push({ kind: 'collab', text: `<b>${strong}</b> kindred viewer${strong > 1 ? 's' : ''} also liked this` });
    if (reasons.length === 0) reasons.push({ kind: 'content', text: 'Matches the genres you respond to' });
  }

  return { pct, reasons };
}
