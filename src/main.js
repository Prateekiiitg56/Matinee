/* ═══════════════════════════════════════════
   MATINEE — Main Application
   Deck interaction, results rendering, routing
   Now supports live TMDB data + loading state + movie detail modals
   ═══════════════════════════════════════════ */

import { initData, getMovies, getDeckOrder, getGradient, getIsLive, loadMoreMoviesData } from './data.js';
import { rankCandidates } from './engine.js';
import { fetchFullDetails } from './tmdb.js';

/* ═══════ STATE ═══════ */
const STORAGE_RATINGS_KEY = 'matinee_user_ratings';
const STORAGE_DECK_INDEX_KEY = 'matinee_deck_index';

const userRatings = JSON.parse(localStorage.getItem(STORAGE_RATINGS_KEY) || '{}');
let currentMode = 'hybrid';
let blend = 0.5;
const UNLOCK_THRESHOLD = 5;
let deckIndex = parseInt(localStorage.getItem(STORAGE_DECK_INDEX_KEY) || '0', 10);
let dragState = null;

/* ═══════ DOM REFS ═══════ */
const $ = id => document.getElementById(id);
const deckEl       = $('deck');
const progressBarFill = $('progress-bar-fill');
const badgeEl      = $('rating-badge');
const lockedEl     = $('results-locked');
const unlockedEl   = $('results-unlocked');
const feedEl       = $('edit-feed');
const blendControl = $('blend-control');
const blendSlider  = $('blend-slider');
const modalOverlay = $('modal-overlay');
const modalClose   = $('modal-close');
const modalBackdrop= $('modal-backdrop');
const modalBody    = $('modal-body');


/* ═══════════════════════════════════════
   TAB NAVIGATION
   ═══════════════════════════════════════ */
function setTopTab(tab) {
  $('tab-discover').classList.toggle('active', tab === 'discover');
  $('tab-edit').classList.toggle('active', tab === 'edit');
  $('view-discover').classList.toggle('active', tab === 'discover');
  $('view-edit').classList.toggle('active', tab === 'edit');
  if (tab === 'edit') { syncResultsLock(); renderResults(); }
}

$('tab-discover').addEventListener('click', () => setTopTab('discover'));
$('tab-edit').addEventListener('click', () => setTopTab('edit'));
$('go-discover-btn').addEventListener('click', () => setTopTab('discover'));


/* ═══════════════════════════════════════
   DECK — Card Rendering
   ═══════════════════════════════════════ */
function renderDeck() {
  const DECK_ORDER = getDeckOrder();
  deckEl.innerHTML = '';
  const slice = DECK_ORDER.slice(deckIndex, deckIndex + 3);

  if (slice.length === 0) {
    const isLive = getIsLive();
    let loadMoreBtnHtml = '';
    if (isLive) {
      loadMoreBtnHtml = `<button id="load-more-btn" style="background:var(--brass); margin-right: 12px;">Load More Movies</button>`;
    }

    deckEl.innerHTML = `
      <div class="deck-empty">
        <div class="big">That's the whole reel</div>
        <p>You've rated every title in this reel. You can load more movies from TMDB or view your recommendations.</p>
        <div style="margin-top:18px; display:flex; justify-content:center; gap:8px; flex-wrap:wrap;">
          ${loadMoreBtnHtml}
          <button id="deck-done-btn">Go to Your Edit</button>
        </div>
      </div>`;

    $('deck-done-btn').addEventListener('click', () => setTopTab('edit'));
    if (isLive) {
      $('load-more-btn').addEventListener('click', handleLoadMore);
    }
    return;
  }

  slice.forEach((movie, depth) => {
    const card = document.createElement('div');
    card.className = 'poster-card';
    card.style.zIndex = String(10 - depth);
    card.style.transform = `translateY(${depth * 14}px) scale(${1 - depth * 0.04})`;
    card.style.opacity = depth === 2 ? '0.55' : depth === 1 ? '0.85' : '1';

    // If we have a real poster, use it as background image; otherwise use genre gradient
    if (movie.poster) {
      card.style.backgroundImage = `url(${movie.poster})`;
      card.style.backgroundSize = 'cover';
      card.style.backgroundPosition = 'center';
    } else {
      card.style.background = getGradient(movie.genres[0]);
    }

    const directorLine = movie.director ? `${movie.director}, ` : '';
    const runtimeLine = movie.runtime ? `, ${movie.runtime} min` : '';

    card.innerHTML = `
      <span class="genre-pill">${movie.genres[0]}</span>
      <span class="stamp like">LIKE</span>
      <span class="stamp pass">PASS</span>
      <div class="poster-meta">${directorLine}${movie.year}${runtimeLine}</div>
      <h2 class="poster-title">${movie.title}</h2>
      <p class="poster-blurb">${movie.blurb}</p>
    `;

    // Only allow clicking to show details if not dragging
    card.addEventListener('click', (e) => {
      // Don't trigger details if drag happened
      if (dragState && Math.abs(dragState.dx) > 10) return;
      // Don't trigger if click was on stamps or action elements
      if (e.target.classList.contains('stamp')) return;
      openMovieDetail(movie.id);
    });

    deckEl.appendChild(card);
    if (depth === 0) attachDrag(card, movie);
  });
}


/* ═══════════════════════════════════════
   DECK — Drag / Swipe Physics
   ═══════════════════════════════════════ */
function attachDrag(card, movie) {
  card.addEventListener('pointerdown', e => {
    card.setPointerCapture(e.pointerId);
    dragState = { startX: e.clientX, dx: 0 };
    card.classList.add('dragging');
  });

  card.addEventListener('pointermove', e => {
    if (!dragState) return;
    dragState.dx = e.clientX - dragState.startX;
    const rot = dragState.dx / 18;
    card.style.transform = `translateX(${dragState.dx}px) rotate(${rot}deg)`;

    const likeStamp = card.querySelector('.stamp.like');
    const passStamp = card.querySelector('.stamp.pass');
    likeStamp.style.opacity = Math.max(0, Math.min(1, dragState.dx / 100));
    passStamp.style.opacity = Math.max(0, Math.min(1, -dragState.dx / 100));
  });

  const release = () => {
    if (!dragState) return;
    card.classList.remove('dragging');
    const dx = dragState.dx;
    // Keep dragState ref brief but don't null immediately so click listener can ignore minor drags
    setTimeout(() => { dragState = null; }, 50);

    if (dx > 100) {
      flyOut(card, 1, () => commitSwipe('like', movie));
    } else if (dx < -100) {
      flyOut(card, -1, () => commitSwipe('pass', movie));
    } else {
      card.style.transform = 'translateX(0) rotate(0)';
      card.querySelectorAll('.stamp').forEach(s => s.style.opacity = 0);
    }
  };

  card.addEventListener('pointerup', release);
  card.addEventListener('pointercancel', release);
}

function flyOut(card, dir, cb) {
  card.style.transition = 'transform .4s cubic-bezier(.2,.8,.2,1), opacity .4s ease';
  card.style.transform = `translateX(${dir * 600}px) rotate(${dir * 30}deg)`;
  card.style.opacity = '0';
  setTimeout(cb, 220);
}

async function handleLoadMore() {
  const btn = $('load-more-btn');
  if (btn && btn.disabled) return;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Loading…';
  }

  try {
    deckEl.innerHTML = `
      <div class="deck-empty">
        <div class="loader-wrap">
          <div class="loader"></div>
          <div class="big" id="load-more-progress">Loading next reel…</div>
          <p>Fetching fresh titles from TMDB.</p>
        </div>
      </div>`;

    await loadMoreMoviesData(msg => {
      const p = $('load-more-progress');
      if (p) p.textContent = msg;
    });

    renderDeck();
    updateProgress();
  } catch (err) {
    console.error(err);
    alert('Failed to load more movies: ' + err.message);
    renderDeck();
  }
}

function commitSwipe(direction, movie) {
  const DECK_ORDER = getDeckOrder();
  if (deckIndex >= DECK_ORDER.length || DECK_ORDER[deckIndex].id !== movie.id) return;
  userRatings[movie.id] = direction === 'like' ? 4 : 2;
  deckIndex++;

  // Save to localStorage
  localStorage.setItem(STORAGE_RATINGS_KEY, JSON.stringify(userRatings));
  localStorage.setItem(STORAGE_DECK_INDEX_KEY, String(deckIndex));

  updateProgress();
  renderDeck();
}

function programmaticSwipe(direction) {
  const DECK_ORDER = getDeckOrder();
  const topCard = deckEl.querySelector('.poster-card');
  const movie = DECK_ORDER[deckIndex];
  if (!topCard || !movie) return;

  const stamp = topCard.querySelector(`.stamp.${direction === 'like' ? 'like' : 'pass'}`);
  if (stamp) stamp.style.opacity = '1';

  flyOut(topCard, direction === 'like' ? 1 : -1, () => commitSwipe(direction, movie));
}

/* Button & keyboard controls */
$('btn-like').addEventListener('click', () => programmaticSwipe('like'));
$('btn-pass').addEventListener('click', () => programmaticSwipe('pass'));
document.addEventListener('keydown', e => {
  // If modal is active, ESC closes it
  if (modalOverlay.classList.contains('active')) {
    if (e.key === 'Escape') closeModal();
    return;
  }
  if (!$('view-discover').classList.contains('active')) return;
  if (e.key === 'ArrowRight') programmaticSwipe('like');
  if (e.key === 'ArrowLeft')  programmaticSwipe('pass');
});


/* ═══════════════════════════════════════
   PROGRESS & LOCK STATE
   ═══════════════════════════════════════ */
function updateProgress() {
  const MOVIES = getMovies();
  const count = Object.keys(userRatings).length;

  if (progressBarFill && MOVIES.length > 0) {
    progressBarFill.style.width = `${Math.min(100, (count / MOVIES.length) * 100)}%`;
  }

  if (count > 0) {
    badgeEl.classList.add('visible');
  } else {
    badgeEl.classList.remove('visible');
  }

  syncResultsLock();
}

function syncResultsLock() {
  const count = Object.keys(userRatings).length;
  const locked = count < UNLOCK_THRESHOLD;
  lockedEl.style.display  = locked ? 'block' : 'none';
  unlockedEl.style.display = locked ? 'none'  : 'block';
}


/* ═══════════════════════════════════════
   RESULTS — Rendering
   ═══════════════════════════════════════ */
function reasonLineHTML(r) {
  return `<div class="reason-line">
    <span class="reason-dot ${r.kind}"></span>
    <span class="reason-text ${r.kind}">${r.text}</span>
  </div>`;
}

function renderResults() {
  const count = Object.keys(userRatings).length;
  if (count < UNLOCK_THRESHOLD) return;

  const ranked = rankCandidates(userRatings, currentMode, blend);

  if (ranked.length === 0) {
    feedEl.innerHTML = `
      <div class="no-results">
        <div class="big">No kindred viewers yet</div>
        <p>Rate a few more titles. The panel needs overlap with your taste to generate recommendations.</p>
      </div>`;
    return;
  }

  const [hero, ...rest] = ranked;
  const m = hero.movie;

  const dirLine = m.director ? `${m.director} / ` : '';
  const heroStyle = m.backdrop
    ? `background-image:url(${m.backdrop});background-size:cover;background-position:center top`
    : `background:${getGradient(m.genres[0])}`;

  let html = `
    <div class="hero-pick" id="hero-pick-card" data-id="${m.id}" style="${heroStyle}">
      <div class="hero-match">${hero.pct}%<span>MATCH</span></div>
      <div class="content">
        <div class="hero-eyebrow">editor's pick</div>
        <h2>${m.title}</h2>
        <div class="hero-meta">${dirLine}${m.year} / ${m.genres.join(', ')}</div>
        <p class="hero-blurb">${m.blurb}</p>
        ${hero.reasons.map(reasonLineHTML).join('')}
      </div>
    </div>
  `;

  html += rest.map((c, i) => {
    const r = c.movie;
    const swatchStyle = r.poster
      ? `background-image:url(${r.poster});background-size:cover;background-position:center`
      : `background:${getGradient(r.genres[0])}`;

    return `
      <div class="list-row" data-id="${r.id}" style="animation-delay:${(i + 1) * 0.06}s">
        <div class="list-swatch" style="${swatchStyle}"></div>
        <div class="list-body">
          <div class="list-top">
            <h3 class="list-title">${r.title}</h3>
            <div class="list-match">${c.pct}%</div>
          </div>
          <div class="list-meta">${r.year} / ${r.genres.join(', ')}</div>
          ${c.reasons.map(reasonLineHTML).join('')}
        </div>
      </div>
    `;
  }).join('');

  feedEl.innerHTML = html;

  // Add click events to details
  const heroCard = $('hero-pick-card');
  if (heroCard) {
    heroCard.addEventListener('click', () => openMovieDetail(m.id));
  }
  feedEl.querySelectorAll('.list-row').forEach(row => {
    row.addEventListener('click', () => {
      const mid = Number(row.dataset.id);
      openMovieDetail(mid);
    });
  });
}


/* ═══════════════════════════════════════
   MODE TABS & BLEND SLIDER
   ═══════════════════════════════════════ */
document.querySelectorAll('#mode-tabs button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#mode-tabs button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMode = btn.dataset.mode;
    blendControl.style.visibility = currentMode === 'hybrid' ? 'visible' : 'hidden';
    renderResults();
  });
});

blendSlider.addEventListener('input', e => {
  blend = Number(e.target.value) / 100;
  renderResults();
});


/* ═══════════════════════════════════════
   MOVIE DETAIL MODAL
   ═══════════════════════════════════════ */
async function openMovieDetail(movieId) {
  modalOverlay.classList.add('active');
  document.body.style.overflow = 'hidden'; // stop body scrolling

  // Find movie from current catalog list to show basic info instantly
  const MOVIES = getMovies();
  const baseMovie = MOVIES.find(m => m.id === movieId);

  if (baseMovie) {
    modalBackdrop.style.backgroundImage = baseMovie.backdrop ? `url(${baseMovie.backdrop})` : 'none';
    modalBackdrop.style.background = baseMovie.backdrop ? '' : getGradient(baseMovie.genres[0]);
    modalBody.innerHTML = `
      <div class="modal-header">
        <div class="modal-poster" style="${baseMovie.poster ? `background-image:url(${baseMovie.poster})` : `background:${getGradient(baseMovie.genres[0])}`}"></div>
        <div class="modal-title-area">
          <h2 class="modal-title">${baseMovie.title}</h2>
          <div class="modal-meta-grid">
            <span><b>Year</b>: ${baseMovie.year}</span>
            <span><b>Runtime</b>: ${baseMovie.runtime || '?'} min</span>
            <span><b>Director</b>: ${baseMovie.director || 'Unknown'}</span>
          </div>
        </div>
      </div>
      <div class="modal-section-title">story</div>
      <p class="modal-story">${baseMovie.overview || baseMovie.blurb}</p>
      <div class="modal-section-title">cast & details</div>
      <div class="loader" style="margin: 20px auto;"></div>
    `;
  } else {
    modalBackdrop.style.backgroundImage = 'none';
    modalBody.innerHTML = `<div class="loader" style="margin: 60px auto;"></div>`;
  }

  // Fetch full details from TMDB
  const full = await fetchFullDetails(movieId);
  if (!full) return;

  modalBackdrop.style.backgroundImage = full.backdrop ? `url(${full.backdrop})` : 'none';
  modalBackdrop.style.background = full.backdrop ? '' : getGradient(full.genres[0] || 'Drama');

  const releaseYear = full.year ? full.year : 'Unknown';
  const ratingStars = '★'.repeat(Math.round(full.rating / 2)) + '☆'.repeat(5 - Math.round(full.rating / 2));
  const runtimeDisplay = full.runtime ? `${full.runtime} min` : 'Unknown';

  const budgetDisp = full.budget ? `$${(full.budget / 1e6).toFixed(1)}M` : 'Unknown';
  const revenueDisp = full.revenue ? `$${(full.revenue / 1e6).toFixed(1)}M` : 'Unknown';

  let castHtml = '';
  if (full.cast && full.cast.length > 0) {
    castHtml = `
      <div class="modal-section-title">cast</div>
      <div class="modal-cast-grid">
        ${full.cast.map(c => `
          <div class="cast-card">
            <div class="cast-photo" style="${c.photo ? `background-image:url(${c.photo})` : ''}"></div>
            <div class="cast-meta">
              <div class="cast-name">${c.name}</div>
              <div class="cast-character">${c.character}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  const trailerHtml = full.trailerKey
    ? `<button class="trailer-btn" onclick="window.open('https://youtube.com/watch?v=${full.trailerKey}', '_blank')">▶ Play Trailer</button>`
    : '';

  modalBody.innerHTML = `
    <div class="modal-header">
      <div class="modal-poster" style="${full.poster ? `background-image:url(${full.poster})` : `background:${getGradient(full.genres[0])}`}"></div>
      <div class="modal-title-area">
        ${full.tagline ? `<div class="modal-tagline">${full.tagline}</div>` : ''}
        <h2 class="modal-title">${full.title}</h2>
        <div class="modal-meta-grid">
          <span><b>Year</b>: ${releaseYear}</span>
          <span><b>Runtime</b>: ${runtimeDisplay}</span>
          <span><b>Director</b>: ${full.director}</span>
          <span><b>Rating</b>: <span style="color:var(--brass)">${ratingStars}</span> (${full.rating.toFixed(1)}/10, ${full.votes} votes)</span>
        </div>
        ${trailerHtml}
      </div>
    </div>

    <div class="modal-section-title">story</div>
    <p class="modal-story">${full.overview}</p>

    <div class="modal-section-title">movie info</div>
    <div class="modal-details-grid">
      <div><b>Status:</b> ${full.status}</div>
      <div><b>Original Language:</b> ${full.originalLanguage.toUpperCase()}</div>
      <div><b>Budget:</b> ${budgetDisp}</div>
      <div><b>Revenue:</b> ${revenueDisp}</div>
      <div><b>Genres:</b> ${full.genres.join(', ')}</div>
    </div>

    ${castHtml}
  `;
}

function closeModal() {
  modalOverlay.classList.remove('active');
  document.body.style.overflow = ''; // allow body scrolling
  // Clear modal body so video/audio stops if any
  setTimeout(() => {
    modalBody.innerHTML = '';
    modalBackdrop.style.backgroundImage = 'none';
  }, 400);
}

modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => {
  if (e.target === modalOverlay) closeModal();
});


/* ═══════════════════════════════════════
   LOADING STATE & INIT
   ═══════════════════════════════════════ */
function showLoading(msg = 'Loading the reel…') {
  deckEl.innerHTML = `
    <div class="deck-empty">
      <div class="loader-wrap">
        <div class="loader"></div>
        <div class="big">${msg}</div>
        <p>Fetching real movies from TMDB. This takes a few seconds.</p>
      </div>
    </div>`;
}

function showSourceBadge(isLive) {
  // Remove existing if any
  const old = document.querySelector('.source-badge');
  if (old) old.remove();

  const badge = document.createElement('div');
  badge.className = 'source-badge';
  badge.innerHTML = isLive
    ? '<span class="dot live"></span> Live from TMDB'
    : '<span class="dot local"></span> Local catalog';
  $('topbar').appendChild(badge);
}

async function init() {
  showLoading('Fetching movies…');

  const { isLive } = await initData(msg => {
    showLoading(msg);
  });
  showSourceBadge(isLive);

  // Restore pagination if they swiped past the first batch
  let DECK_ORDER = getDeckOrder();
  while (deckIndex > DECK_ORDER.length && isLive) {
    showLoading(`Restoring state (${DECK_ORDER.length} titles)…`);
    try {
      await loadMoreMoviesData();
      DECK_ORDER = getDeckOrder();
    } catch (err) {
      console.warn('Failed to restore deep paginated index:', err);
      break;
    }
  }

  // Double check in case of edge errors
  if (deckIndex > DECK_ORDER.length) {
    deckIndex = DECK_ORDER.length;
    localStorage.setItem(STORAGE_DECK_INDEX_KEY, String(deckIndex));
  }

  // Reset ratings handler
  const resetLink = $('reset-ratings-link');
  if (resetLink) {
    resetLink.addEventListener('click', e => {
      e.preventDefault();
      if (confirm('Are you sure you want to reset all your ratings? This will clear your taste profile.')) {
        localStorage.removeItem(STORAGE_RATINGS_KEY);
        localStorage.removeItem(STORAGE_DECK_INDEX_KEY);
        window.location.reload();
      }
    });
  }

  renderDeck();
  updateProgress();
}

init();
