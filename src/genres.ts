// src/genres.ts
//
// Phase 53 — Bundle Optimisation.
//
// ALL_GENRES was previously exported from src/movies-data.ts, a 10,951-line
// file that contains every movie object in the catalog. Although PRESET_MOVIES
// was already guarded behind the server (never directly imported by the
// browser), ALL_GENRES living at the very bottom of that file meant that any
// client-side import of ALL_GENRES (App.tsx, UserProfile.tsx,
// GenreOnboardingModal.tsx, AIMatchmaker.tsx) caused Rollup to include the
// entire 10k-line module in the main JavaScript bundle, adding ~280 KB
// minified to every page load.
//
// Solution: move ALL_GENRES here. Every client-side importer now gets a
// tiny module (~300 bytes), and movies-data.ts becomes a server-only module
// that Rollup never sees from the browser entry point.
//
// server.ts still imports from movies-data.ts directly — no change needed
// there. The export name is intentionally identical so all existing import
// sites need only a path change.

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