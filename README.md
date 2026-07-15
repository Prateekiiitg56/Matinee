# Matinee

A self-contained, hybrid movie recommendation system built with modern vanilla JavaScript, CSS, and Vite. Matinee dynamically fetches real-time cinema catalogs from TMDB, runs math-based recommender engines in your browser, and explains exactly why it thinks you'll like each film.

---

## Key Features

* **Tinder-Style Swipe Deck**: Express your movie taste using responsive drag-and-swipe physics, touch-friendly deck controls, or keyboard arrow keys.
* **Dual Recommender Algorithms**:
  * **Content-Based Filtering**: Builds a genre profile from your likes and passes, combined with a TMDB overall audience quality index.
  * **Collaborative Filtering**: Simulates a panel of 30 synthetic viewers, identifies kindred users using Pearson Correlation (mean-centered ratings), and recommends highly-rated titles.
* **Adjustable Hybrid Blending**: Adjust a slider to tune your list in real-time, blending personal genre affinity with kindred viewer trends.
* **Cinematic Detail Modals**: Tap any card to open a rich modal displaying taglines, runtime details, director, rating stats, YouTube trailers, budget/revenue metrics, and full actor cast grids.
* **Infinity Deck Pagination**: Swipe as much as you like. When you finish the current batch, pagination loads more titles from TMDB, rebuilds user similarity matrices, and expands your deck.
* **Persistent Cache**: Ratings and progress are saved to your browser's local storage. Reopening the app resumes exactly where you left off, automatically restoring loaded pages.

---

## Recommendation Math

Matinee does not hide its logic behind a black box:
* **Content Profiling**: Each movie is represented as a binary genre vector. Your profile vector accumulates weights when you swipe (`+1` for a liked movie, `-1` for a passed movie). Candidate similarity is evaluated using **Cosine Similarity** blended with a normalized TMDB quality factor.
* **Pearson Correlation Similarity**: To align your tastes with synthetic profiles, ratings are centered around the neutral score of 3. This means likes become positive (`+1`) and passes become negative (`-1`), allowing Cosine Similarity to accurately identify true kindred viewers.

---

## Tech Stack

* **Build Tool**: Vite
* **Core**: Modern ES6 JavaScript Modules
* **Styling**: Responsive Vanilla CSS (Moody Noir aesthetic)
* **API Integration**: TMDB v3 API (curated endpoints with parallel batch fetching)
* **Storage**: HTML5 Web Storage (`localStorage`)

---

## Setup & Running Locally

### 1. Install Dependencies
Run the installation command in the project directory:
```bash
npm install
```

### 2. Configure TMDB API Key (Optional)
The system has a built-in fallback catalog, but works best with live TMDB data. Your API Key is already configured in `src/tmdb.js`. If you need to update it:
```javascript
// src/tmdb.js
const API_KEY = 'e6f6520445860b6dbadfd7c6404797c0';
```

### 3. Run Development Server
Start the local server:
```bash
npm run dev
```
Open `http://localhost:3000` in your web browser.

### 4. Build for Production
To generate the static bundle:
```bash
npm run build
```
The optimized site assets will be generated in the `/dist` directory.
