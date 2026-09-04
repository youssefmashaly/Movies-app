// src/services/watchProviders.ts
//
// Phase 58 — "Browse by streaming service". Thin client for the two new
// server routes backing this: GET /api/watch-providers (the curated
// provider list for a region) and GET /api/movies/by-provider (which of our
// catalog movies are on a given provider). Same dedupedFetch pattern as
// every other network call in this codebase — concurrent callers asking for
// the same region/provider share one in-flight request instead of firing
// duplicates.
import { dedupedFetch } from "../lib/requestDedup";

export interface WatchProviderOption {
  id: number;
  name: string;
  logoUrl: string | null;
}

/**
 * The curated list of well-known streaming services available in a region
 * (Netflix, Prime Video, Disney+, etc. — narrowed server-side from TMDB's
 * full regional provider list). Used to populate the "Streaming Service"
 * filter dropdown.
 */
export async function listWatchProviders(region: string): Promise<WatchProviderOption[]> {
  const res = await dedupedFetch(`/api/watch-providers?region=${encodeURIComponent(region)}`);
  if (!res.ok) throw new Error(`Failed to load provider list (status ${res.status})`);
  const json = await res.json();
  return Array.isArray(json?.providers) ? json.providers : [];
}

/**
 * Local catalog movie ids available on the given TMDB provider id, in
 * TMDB's popularity order. See server.ts's /api/movies/by-provider route
 * for the honest limitation on how exhaustive this is.
 */
export async function getMoviesByProvider(providerId: number, region: string): Promise<string[]> {
  const res = await dedupedFetch(
    `/api/movies/by-provider?providerId=${providerId}&region=${encodeURIComponent(region)}`
  );
  if (!res.ok) throw new Error(`Failed to load provider catalog (status ${res.status})`);
  const json = await res.json();
  return Array.isArray(json?.movieIds) ? json.movieIds : [];
}