// src/genres.ts
//
// Phase 53 — Bundle Optimisation.
//
// ALL_GENRES was previously exported from src/movies-data.ts, a 10,951-line
// file containing every movie object. Any client-side import of ALL_GENRES
// caused Rollup to bundle the entire file (~280 KB minified) into the browser
// bundle. This tiny module fixes that — movies-data.ts is now server-only.

export const ALL_GENRES = [
  "All",
  "Action",
  "Adventure",
  "Animation",
  "Biography",
  "Comedy",
  "Crime",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Thriller",
] as const;

export type Genre = (typeof ALL_GENRES)[number];