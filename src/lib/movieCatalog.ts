// src/lib/movieCatalog.ts
//
// Phase 23 — Movie Catalog Decoupling.
//
// AUDIT FINDING (see the Phase 23 write-up): src/movies-data.ts's
// PRESET_MOVIES (~500 movies, the dominant contributor to the frontend
// bundle) was only ever statically imported by ONE frontend module —
// UserProfile.tsx, for its favorite-decade/director insight. But because
// that import was reachable from the app's eager module graph, Rollup had
// no choice but to bundle the entire array into the main chunk rather than
// an already-lazy one.
//
// ARCHITECTURE DECISION: rather than adding a duplicate static JSON asset
// that would need its own generation/sync step against PRESET_MOVIES (the
// backend's actual source of truth), this loader fetches the catalog from
// the EXISTING GET /api/movies/trending endpoint, which already returns
// every movie in PRESET_MOVIES unsliced (confirmed in the Phase 20/21/22
// audits — App.tsx has relied on this fact for three phases already). This
// means zero new backend code, zero new data files, and zero duplicated
// data: server.ts keeps reading PRESET_MOVIES directly (a Node-only file,
// never part of the browser bundle), and the frontend now only ever sees
// the catalog as fetched JSON, never as a bundled TS array.
//
// This is a singleton loader: the catalog fetches once per page load, no
// matter how many components ask for it (concurrently or at different
// times) — everyone shares the same promise while it's in flight and the
// same array once it resolves. It also primes the movieResolver's per-id
// cache (Phase 20) so individual resolveMovie()/resolveMovies() calls
// never trigger a redundant network round trip for a movie this payload
// already covers.
import { Movie } from "../types";
import { dedupedFetch } from "./requestDedup";
import { primeMovieCache } from "./movieResolver";

let cachedCatalog: Movie[] | null = null;
let inFlight: Promise<Movie[]> | null = null;

/**
 * Loads the full movie catalog. Safe to call from as many places as
 * needed — the first call performs the fetch, every concurrent or
 * subsequent call (from any component) shares the same result instead of
 * re-fetching or re-parsing.
 *
 * Extension point for future pagination: if the backend ever needs to
 * paginate this endpoint, this is the one place that would change (e.g.
 * accepting a `{ page }` option and merging pages into `cachedCatalog`) —
 * every current caller already goes through here rather than fetching
 * /api/movies/trending directly, so they wouldn't need to change.
 */
export async function loadMovieCatalog(): Promise<Movie[]> {
  if (cachedCatalog) return cachedCatalog;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const res = await dedupedFetch("/api/movies/trending");
    if (!res.ok) throw new Error(`Failed to load movie catalog (status ${res.status})`);
    const movies: Movie[] = await res.json();
    cachedCatalog = movies;
    // Phase 20 integration — every movie this payload contains is now
    // resolvable by id with zero additional network calls.
    primeMovieCache(movies);
    return movies;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

/**
 * Synchronous peek at whatever's already cached — returns an empty array
 * before the first successful load completes. Useful as an instant initial
 * value for components that want to render immediately with whatever's
 * already known (e.g. if another component already triggered the load a
 * moment earlier) while `loadMovieCatalog()` settles in the background.
 */
export function getCachedCatalog(): Movie[] {
  return cachedCatalog ?? [];
}

/** True once the catalog has successfully loaded at least once. */
export function isCatalogLoaded(): boolean {
  return cachedCatalog !== null;
}

/** Dev/test-only escape hatch — clears the cached catalog. Not used by
 *  application code. */
export function __clearMovieCatalogCache(): void {
  cachedCatalog = null;
  inFlight = null;
}