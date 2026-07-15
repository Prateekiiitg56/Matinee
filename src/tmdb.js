/* ═══════════════════════════════════════════
   MATINEE — TMDB API Integration
   Fetches real movies, genres, posters, cast
   ═══════════════════════════════════════════ */

const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';

// Users should replace with their own from https://www.themoviedb.org/settings/api
let API_KEY = 'e6f6520445860b6dbadfd7c6404797c0';

export function setApiKey(key) { API_KEY = key; }
export function getApiKey() { return API_KEY; }

/* ── Helpers ── */
function url(path, params = {}) {
  const u = new URL(`${BASE}${path}`);
  u.searchParams.set('api_key', API_KEY);
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
  return u.toString();
}

async function get(path, params) {
  const res = await fetch(url(path, params));
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${res.statusText}`);
  return res.json();
}

/* ── Genre Map ── */
let genreMap = null;

export async function fetchGenres() {
  if (genreMap) return genreMap;
  const data = await get('/genre/movie/list', { language: 'en-US' });
  genreMap = {};
  data.genres.forEach(g => { genreMap[g.id] = g.name; });
  return genreMap;
}

/* ── Poster URL ── */
export function posterUrl(path, size = 'w500') {
  if (!path) return null;
  return `${IMG}/${size}${path}`;
}

/* ── Fetch 100+ Movies from multiple endpoints/pages ── */
export async function fetchMovies(count = 120) {
  await fetchGenres();

  // Fetch from popular (5 pages), top_rated (3 pages), now_playing (2 pages)
  const fetches = [
    ...Array.from({ length: 5 }, (_, i) =>
      get('/movie/popular', { language: 'en-US', page: String(i + 1) })
    ),
    ...Array.from({ length: 3 }, (_, i) =>
      get('/movie/top_rated', { language: 'en-US', page: String(i + 1) })
    ),
    ...Array.from({ length: 2 }, (_, i) =>
      get('/movie/now_playing', { language: 'en-US', page: String(i + 1) })
    ),
  ];

  const pages = await Promise.all(fetches);

  // Merge, dedupe, filter
  const seen = new Set();
  const all = pages.flatMap(p => p.results).filter(m => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return m.poster_path && m.overview && m.genre_ids && m.genre_ids.length > 0;
  });

  // Normalize to our format
  const movies = all.slice(0, count).map(m => ({
    id: m.id,
    title: m.title,
    year: m.release_date ? parseInt(m.release_date.split('-')[0]) : 0,
    genres: m.genre_ids.map(id => genreMap[id]).filter(Boolean),
    blurb: m.overview.length > 180 ? m.overview.slice(0, 177) + '…' : m.overview,
    overview: m.overview, // full synopsis for detail view
    poster: posterUrl(m.poster_path),
    backdrop: posterUrl(m.backdrop_path, 'w780'),
    rating: m.vote_average,
    votes: m.vote_count,
  }));

  return movies;
}

/* ── Fetch Movie Details (runtime + director in one call) ── */
export async function fetchMovieDetails(movieId) {
  try {
    const data = await get(`/movie/${movieId}`, { append_to_response: 'credits' });
    const director = data.credits?.crew?.find(c => c.job === 'Director');
    return {
      runtime: data.runtime || null,
      director: director ? director.name : null,
      tagline: data.tagline || null,
    };
  } catch {
    return { runtime: null, director: null, tagline: null };
  }
}

/* ── Fetch Full Details for modal (cast, crew, full info) ── */
export async function fetchFullDetails(movieId) {
  try {
    const data = await get(`/movie/${movieId}`, {
      append_to_response: 'credits,videos,similar',
      language: 'en-US',
    });

    const director = data.credits?.crew?.find(c => c.job === 'Director');
    const cast = (data.credits?.cast || []).slice(0, 12).map(c => ({
      name: c.name,
      character: c.character,
      photo: c.profile_path ? posterUrl(c.profile_path, 'w185') : null,
    }));

    const trailer = (data.videos?.results || []).find(
      v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
    );

    return {
      id: data.id,
      title: data.title,
      tagline: data.tagline || null,
      overview: data.overview,
      year: data.release_date ? parseInt(data.release_date.split('-')[0]) : 0,
      runtime: data.runtime || 0,
      rating: data.vote_average,
      votes: data.vote_count,
      director: director ? director.name : 'Unknown',
      genres: (data.genres || []).map(g => g.name),
      poster: posterUrl(data.poster_path),
      backdrop: posterUrl(data.backdrop_path, 'w1280'),
      cast,
      trailerKey: trailer ? trailer.key : null,
      budget: data.budget || 0,
      revenue: data.revenue || 0,
      status: data.status,
      originalLanguage: data.original_language,
    };
  } catch (err) {
    console.warn('Failed to fetch full details:', err);
    return null;
  }
}

/* ── Batch fetch basic details (director/runtime) for deck cards ── */
export async function enrichMovies(movies) {
  const enriched = [...movies];
  // Batch in groups of 8 for speed
  for (let i = 0; i < enriched.length; i += 8) {
    const batch = enriched.slice(i, i + 8);
    const details = await Promise.all(
      batch.map(m => fetchMovieDetails(m.id))
    );
    batch.forEach((m, j) => {
      m.director = details[j].director || 'Unknown';
      m.runtime = details[j].runtime || 0;
      if (details[j].tagline) m.tagline = details[j].tagline;
    });
  }
  return enriched;
}

/* ── Fetch more movies on demand (pagination) ── */
export async function fetchMoreMovies(existingIds = [], pageOffset = 1, count = 40) {
  await fetchGenres();

  // Pick next pages based on offset
  const popPage1 = String(5 + pageOffset * 2 - 1);
  const popPage2 = String(5 + pageOffset * 2);
  const topPage1 = String(3 + pageOffset);

  const fetches = [
    get('/movie/popular', { language: 'en-US', page: popPage1 }),
    get('/movie/popular', { language: 'en-US', page: popPage2 }),
    get('/movie/top_rated', { language: 'en-US', page: topPage1 }),
  ].map(p => p.catch(() => ({ results: [] }))); // handle failures gracefully

  const pages = await Promise.all(fetches);
  const all = pages.flatMap(p => p.results || []).filter(m => {
    if (existingIds.includes(m.id)) return false;
    return m.poster_path && m.overview && m.genre_ids && m.genre_ids.length > 0;
  });

  // dedupe locally
  const seen = new Set();
  const deduped = all.filter(m => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });

  const normalized = deduped.slice(0, count).map(m => ({
    id: m.id,
    title: m.title,
    year: m.release_date ? parseInt(m.release_date.split('-')[0]) : 0,
    genres: m.genre_ids.map(id => genreMap[id]).filter(Boolean),
    blurb: m.overview.length > 180 ? m.overview.slice(0, 177) + '…' : m.overview,
    overview: m.overview,
    poster: posterUrl(m.poster_path),
    backdrop: posterUrl(m.backdrop_path, 'w780'),
    rating: m.vote_average,
    votes: m.vote_count,
  }));

  return normalized;
}
