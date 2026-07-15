/* ═══════════════════════════════════════════
   MATINEE — Data Layer
   Supports both TMDB live API and local fallback
   ═══════════════════════════════════════════ */

import { fetchMovies, enrichMovies, fetchGenres, fetchMoreMovies } from './tmdb.js';

/* ── Genre Gradient Map (duotone poster backgrounds) ── */
export const GENRE_GRADIENT = {
  'Drama':        'linear-gradient(160deg,#2b2033,#0b0b0e 75%)',
  'Science Fiction': 'linear-gradient(160deg,#101f33,#0b0b0e 75%)',
  'Sci-Fi':       'linear-gradient(160deg,#101f33,#0b0b0e 75%)',
  'Comedy':       'linear-gradient(160deg,#33280f,#0b0b0e 75%)',
  'Thriller':     'linear-gradient(160deg,#330f14,#0b0b0e 75%)',
  'Romance':      'linear-gradient(160deg,#33101f,#0b0b0e 75%)',
  'Animation':    'linear-gradient(160deg,#0f3328,#0b0b0e 75%)',
  'Horror':       'linear-gradient(160deg,#1e0808,#0b0b0e 75%)',
  'Action':       'linear-gradient(160deg,#331c0f,#0b0b0e 75%)',
  'Documentary':  'linear-gradient(160deg,#182210,#0b0b0e 75%)',
  'Fantasy':      'linear-gradient(160deg,#1c1533,#0b0b0e 75%)',
  'Mystery':      'linear-gradient(160deg,#161233,#0b0b0e 75%)',
  'Crime':        'linear-gradient(160deg,#221010,#0b0b0e 75%)',
  'Adventure':    'linear-gradient(160deg,#1a2a10,#0b0b0e 75%)',
  'Family':       'linear-gradient(160deg,#102a2a,#0b0b0e 75%)',
  'War':          'linear-gradient(160deg,#2a1a10,#0b0b0e 75%)',
  'History':      'linear-gradient(160deg,#2a2010,#0b0b0e 75%)',
  'Music':        'linear-gradient(160deg,#2a1030,#0b0b0e 75%)',
  'Western':      'linear-gradient(160deg,#33200a,#0b0b0e 75%)',
  'TV Movie':     'linear-gradient(160deg,#1a1a2a,#0b0b0e 75%)',
};

const DEFAULT_GRADIENT = 'linear-gradient(160deg,#1a1a22,#0b0b0e 75%)';

export function getGradient(genre) {
  return GENRE_GRADIENT[genre] || DEFAULT_GRADIENT;
}

/* ── Fallback Catalog (if API fails) ── */
const FALLBACK_MOVIES = [
  { id:1, title:'Arrival', year:2016, director:'Denis Villeneuve', runtime:116, genres:['Science Fiction','Drama','Mystery'], blurb:'A linguist is recruited to decode the language of visitors who may be measuring time differently than we do.', poster:null, backdrop:null },
  { id:2, title:'Parasite', year:2019, director:'Bong Joon-ho', runtime:132, genres:['Thriller','Drama','Comedy'], blurb:'A struggling family infiltrates a wealthy household one job at a time, until the house reveals a secret of its own.', poster:null, backdrop:null },
  { id:3, title:'The Grand Budapest Hotel', year:2014, director:'Wes Anderson', runtime:99, genres:['Comedy','Crime','Drama'], blurb:'A concierge and his protégé chase a stolen painting across a fictional alpine republic between the wars.', poster:null, backdrop:null },
  { id:4, title:'Whiplash', year:2014, director:'Damien Chazelle', runtime:107, genres:['Drama','Thriller'], blurb:'A young drummer and a punishing instructor push each other toward greatness or ruin.', poster:null, backdrop:null },
  { id:5, title:'Get Out', year:2017, director:'Jordan Peele', runtime:104, genres:['Horror','Thriller','Mystery'], blurb:'A weekend meeting the in-laws turns into something far stranger than awkward small talk.', poster:null, backdrop:null },
  { id:6, title:'Spirited Away', year:2001, director:'Hayao Miyazaki', runtime:125, genres:['Animation','Fantasy','Drama'], blurb:'A girl wandering into a bathhouse for spirits has to work her way back to the world she came from.', poster:null, backdrop:null },
  { id:7, title:'Mad Max: Fury Road', year:2015, director:'George Miller', runtime:120, genres:['Action','Science Fiction'], blurb:'A convoy chase across a poisoned desert becomes an argument about who gets to be free.', poster:null, backdrop:null },
  { id:8, title:'Her', year:2013, director:'Spike Jonze', runtime:126, genres:['Romance','Science Fiction','Drama'], blurb:'A lonely writer falls for the voice that organizes his life.', poster:null, backdrop:null },
  { id:9, title:'No Country for Old Men', year:2007, director:'Coen Brothers', runtime:122, genres:['Thriller','Crime','Drama'], blurb:'A hunter finds drug money in the desert and a killer who never quite stops walking.', poster:null, backdrop:null },
  { id:10, title:'Amélie', year:2001, director:'Jean-Pierre Jeunet', runtime:122, genres:['Romance','Comedy'], blurb:"A shy waitress in Montmartre starts rearranging strangers' lives from the shadows.", poster:null, backdrop:null },
  { id:11, title:'The Thing', year:1982, director:'John Carpenter', runtime:109, genres:['Horror','Science Fiction','Mystery'], blurb:'A research station in Antarctica realizes one of them might not be human anymore.', poster:null, backdrop:null },
  { id:12, title:'Knives Out', year:2019, director:'Rian Johnson', runtime:130, genres:['Mystery','Comedy','Crime'], blurb:"A wealthy novelist's death gathers his entire family into one room, all of them lying.", poster:null, backdrop:null },
  { id:13, title:'Coco', year:2017, director:'Lee Unkrich', runtime:105, genres:['Animation','Fantasy','Drama'], blurb:'A boy chasing music crosses into the land of the dead to find the truth about his family.', poster:null, backdrop:null },
  { id:14, title:'Blade Runner 2049', year:2017, director:'Denis Villeneuve', runtime:164, genres:['Science Fiction','Drama','Mystery'], blurb:'A replicant investigator follows a buried secret that could unravel the line between made and born.', poster:null, backdrop:null },
  { id:15, title:'The Farewell', year:2019, director:'Lulu Wang', runtime:100, genres:['Drama','Comedy'], blurb:"A family stages a wedding to say goodbye to a grandmother who doesn't know she's dying.", poster:null, backdrop:null },
  { id:16, title:'Free Solo', year:2018, director:'Chin & Vasarhelyi', runtime:100, genres:['Documentary'], blurb:'A climber prepares to ascend a granite wall with no rope and no margin for error.', poster:null, backdrop:null },
  { id:17, title:'Eternal Sunshine of the Spotless Mind', year:2004, director:'Michel Gondry', runtime:108, genres:['Romance','Science Fiction','Drama'], blurb:'A couple erases each other from memory and then falls back into the same collision course.', poster:null, backdrop:null },
  { id:18, title:'Heat', year:1995, director:'Michael Mann', runtime:170, genres:['Crime','Thriller','Action'], blurb:'A detective and a thief circle each other across a city that can only hold one of them.', poster:null, backdrop:null },
  { id:19, title:'Portrait of a Lady on Fire', year:2019, director:'Céline Sciamma', runtime:122, genres:['Romance','Drama'], blurb:'A painter commissioned to secretly capture a bride-to-be finds herself seen back.', poster:null, backdrop:null },
  { id:20, title:'The Shining', year:1980, director:'Stanley Kubrick', runtime:146, genres:['Horror','Drama','Mystery'], blurb:'A family winters alone in a hotel that has opinions about who should stay.', poster:null, backdrop:null },
  { id:21, title:'Superbad', year:2007, director:'Greg Mottola', runtime:113, genres:['Comedy'], blurb:'Two friends spend one chaotic night trying to buy alcohol before everything between them changes.', poster:null, backdrop:null },
  { id:22, title:'Inception', year:2010, director:'Christopher Nolan', runtime:148, genres:['Science Fiction','Action','Thriller'], blurb:"A team plants an idea inside someone's dream, one layer of sleep at a time.", poster:null, backdrop:null },
  { id:23, title:'Moonlight', year:2016, director:'Barry Jenkins', runtime:111, genres:['Drama'], blurb:"Three chapters follow one boy becoming a man under the weight of what he can't say out loud.", poster:null, backdrop:null },
  { id:24, title:'The Princess Bride', year:1987, director:'Rob Reiner', runtime:98, genres:['Fantasy','Romance','Comedy'], blurb:'A farmhand turned pirate has to out-fence, out-wit, and out-last everyone standing between him and true love.', poster:null, backdrop:null },
  { id:25, title:'Zodiac', year:2007, director:'David Fincher', runtime:157, genres:['Crime','Mystery','Thriller'], blurb:"A cartoonist's fixation on an uncaught killer slowly consumes his career and his marriage.", poster:null, backdrop:null },
  { id:26, title:'Paddington 2', year:2017, director:'Paul King', runtime:103, genres:['Comedy','Fantasy'], blurb:'A bear in a duffel coat ends up in prison, and somehow makes the whole cellblock kinder.', poster:null, backdrop:null },
  { id:27, title:'Uncut Gems', year:2019, director:'Safdie Brothers', runtime:135, genres:['Thriller','Crime','Drama'], blurb:'A jeweler juggling debts and a once-in-a-lifetime bet cannot stop pushing his luck one hour further.', poster:null, backdrop:null },
  { id:28, title:'My Neighbor Totoro', year:1988, director:'Hayao Miyazaki', runtime:86, genres:['Animation','Fantasy'], blurb:'Two sisters move to the countryside and meet the enormous, quiet forest spirit next door.', poster:null, backdrop:null },
  { id:29, title:"Y Tu Mamá También", year:2001, director:'Alfonso Cuarón', runtime:106, genres:['Drama','Comedy','Romance'], blurb:"Two teenage boys and an older woman drive toward a beach that may not exist, and toward things they'd rather not say.", poster:null, backdrop:null },
  { id:30, title:'The Social Network', year:2010, director:'David Fincher', runtime:120, genres:['Drama','Crime'], blurb:'A dorm-room falling-out becomes the founding myth of a company that reshapes how people talk to each other.', poster:null, backdrop:null },
  { id:31, title:'Alien', year:1979, director:'Ridley Scott', runtime:117, genres:['Horror','Science Fiction','Thriller'], blurb:'A cargo crew picks up a signal in deep space that turns their ship into something to survive.', poster:null, backdrop:null },
  { id:32, title:'La La Land', year:2016, director:'Damien Chazelle', runtime:128, genres:['Romance','Comedy','Drama'], blurb:'A pianist and an actress try to hold onto each other while their ambitions pull in different directions.', poster:null, backdrop:null },
];

/* ── Deterministic PRNG (Mulberry32) ── */
function mulberry32(seed) {
  return function() {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ── State ── */
let MOVIES = [];
let GENRES = [];
let SYNTH_USERS = [];
let DECK_ORDER = [];
let isLive = false;

export function getMovies()    { return MOVIES; }
export function getGenres()    { return GENRES; }
export function getSynthUsers(){ return SYNTH_USERS; }
export function getDeckOrder() { return DECK_ORDER; }
export function getIsLive()    { return isLive; }

/* ── Generate Synthetic Users from whatever genres exist ── */
function generateSynthUsers(movies, genres) {
  const rng = mulberry32(1337);
  const users = [];

  // Build persona archetypes from existing genres
  const personas = genres.slice(0, 10).map(genre => {
    const weights = { [genre]: 0.95 };
    // Add 1-2 related genres with lower weights
    const others = genres.filter(g => g !== genre);
    if (others.length > 0) weights[others[Math.floor(rng() * others.length)]] = 0.5;
    if (others.length > 1) weights[others[Math.floor(rng() * others.length)]] = 0.3;
    return { name: `${genre} fan`, weights };
  });

  // 3 noisy copies per persona = 30 synthetic viewers
  personas.forEach(persona => {
    for (let i = 0; i < 3; i++) {
      const ratings = {};
      movies.forEach(movie => {
        if (rng() < 0.55) {
          let affinity = 0;
          movie.genres.forEach(g => { affinity += (persona.weights[g] || 0.15); });
          affinity = affinity / movie.genres.length;
          const base = 1 + affinity * 4;
          const noise = (rng() - 0.5) * 1.6;
          ratings[movie.id] = Math.round(Math.min(5, Math.max(1, base + noise)));
        }
      });
      users.push({ persona: persona.name, ratings });
    }
  });

  return users;
}

/* ── Initialize: Try TMDB API, fall back to local catalog ── */
export async function initData(onProgress) {
  try {
    if (onProgress) onProgress('Fetching movies…');
    const rawMovies = await fetchMovies(120);

    if (rawMovies.length >= 20) {
      if (onProgress) onProgress(`Enriching ${rawMovies.length} titles…`);
      MOVIES = await enrichMovies(rawMovies);
      isLive = true;
    } else {
      throw new Error('Not enough movies from API');
    }
  } catch (err) {
    console.warn('TMDB API unavailable, using local catalog:', err.message);
    MOVIES = FALLBACK_MOVIES;
    isLive = false;
  }

  // Extract unique genres
  const genreSet = new Set();
  MOVIES.forEach(m => m.genres.forEach(g => genreSet.add(g)));
  GENRES = [...genreSet];

  // Generate synthetic viewer panel
  SYNTH_USERS = generateSynthUsers(MOVIES, GENRES);

  // Shuffle deck order (deterministic)
  const shuffleRng = mulberry32(42);
  DECK_ORDER = MOVIES.slice().sort(() => shuffleRng() - 0.5);

  return { movies: MOVIES, genres: GENRES, isLive };
}

/* ── Load next page from TMDB and append to local cache ── */
let apiPageOffset = 1;

export async function loadMoreMoviesData(onProgress) {
  if (!isLive) {
    throw new Error('Offline fallback is active. Cannot query TMDB.');
  }

  if (onProgress) onProgress('Fetching next reel from TMDB…');
  const existingIds = MOVIES.map(m => m.id);
  const newMoviesRaw = await fetchMoreMovies(existingIds, apiPageOffset, 40);

  if (newMoviesRaw.length === 0) {
    throw new Error('No more movies found on TMDB.');
  }

  if (onProgress) onProgress(`Enriching ${newMoviesRaw.length} new titles…`);
  const newMoviesEnriched = await enrichMovies(newMoviesRaw);

  // Append to cache
  MOVIES = [...MOVIES, ...newMoviesEnriched];

  // Refresh genres list
  const genreSet = new Set(GENRES);
  newMoviesEnriched.forEach(m => m.genres.forEach(g => genreSet.add(g)));
  GENRES = [...genreSet];

  // Re-generate synthetic viewers with the larger catalog coverage
  SYNTH_USERS = generateSynthUsers(MOVIES, GENRES);

  // Shuffle only the new arrivals and append to deck
  const shuffleRng = mulberry32(42 + apiPageOffset);
  const shuffledNew = newMoviesEnriched.slice().sort(() => shuffleRng() - 0.5);
  DECK_ORDER = [...DECK_ORDER, ...shuffledNew];

  apiPageOffset++;
  return { newMovies: newMoviesEnriched, totalMovies: MOVIES.length };
}
