// src/lib/movieResolver.ts
//
// Phase 20 — Universal Movie Resolution.
//
// PROBLEM: every existing "resolve these ids into movies" path (Continue
// Browsing's moviesById map, etc.) only works because it's built from the
// FULL /api/movies/trending + /api/movies/latest responses. Any feature
// that needs to resolve a specific id — a deep link, a shared profile's
// activity, an id that simply isn't part of either pool — has no reliable
// way to fetch just that movie without depending on those two rails
// happening to contain it.
//
// FIX: a small, reusable resolver on top of the new GET /api/movies/batch
// endpoint:
//  - de-duplicates ids before ever touching the network
//  - micro-batches concurrent resolve calls (same tick) into a single
//    request, the same spirit as the existing dedupedFetch utility, which
//    this module sits on top of rather than calling fetch() directly
//  - caches every resolved movie in memory for the page's lifetime, so an
//    id resolved once (via a batch fetch OR primeMovieCache) is never
//    re-fetched
//  - preserves the caller's requested id order in the returned array and
//    silently drops ids that don't resolve to a catalog movie
//  - supports AbortController so an unmounted component / a resolve call
//    superseded by a newer one never sets stale state
import { Movie } from "../types";
import { dedupedFetch } from "./requestDedup";

const cache = new Map<string, Movie>();

interface Waiter {
  resolve: (movie: Movie | null) => void;
  reject: (err: unknown) => void;
}

let pendingIds = new Set<string>();
let pendingWaiters = new Map<string, Waiter[]>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush(): void {
  if (flushTimer !== null) return;
  // Fires on the next tick — every resolveMovie()/resolveMovies() call made
  // synchronously (e.g. mapping over a list of ids) lands in one batched
  // request instead of firing a separate request per id.
  flushTimer = setTimeout(flush, 0);
}

async function flush(): Promise<void> {
  flushTimer = null;
  if (pendingIds.size === 0) return;

  const ids = Array.from(pendingIds);
  const waiters = pendingWaiters;
  pendingIds = new Set();
  pendingWaiters = new Map();

  try {
    const url = `/api/movies/batch?ids=${ids.map(encodeURIComponent).join(",")}`;
    const res = await dedupedFetch(url);
    if (!res.ok) throw new Error(`Batch movie resolve failed with status ${res.status}`);
    const movies: Movie[] = await res.json();
    for (const movie of movies) cache.set(movie.id, movie);
  } catch (err) {
    for (const id of ids) {
      waiters.get(id)?.forEach((w) => w.reject(err));
    }
    return;
  }

  for (const id of ids) {
    const movie = cache.get(id) ?? null;
    waiters.get(id)?.forEach((w) => w.resolve(movie));
  }
}

/**
 * Seeds the resolver cache from movies already fetched elsewhere (e.g. the
 * existing /api/movies/trending + /api/movies/latest calls in App.tsx).
 * Call this whenever a full movie list is fetched so the batch endpoint is
 * only ever hit for ids that are genuinely not already known client-side.
 */
export function primeMovieCache(movies: Movie[]): void {
  for (const movie of movies) {
    if (movie?.id) cache.set(movie.id, movie);
  }
}

/** Synchronous cache peek — no network call, no promise. Useful for
 *  optimistic render paths that want to show something immediately when
 *  the movie is already known. */
export function getCachedMovie(id: string): Movie | undefined {
  return cache.get(id);
}

/**
 * Resolves a single movie id against the cache, falling back to a batched
 * network request. Never throws for an unresolved id — returns `null`
 * instead (a rejection is only possible if the batch request itself
 * fails, e.g. a network error).
 */
export function resolveMovie(id: string, opts?: { signal?: AbortSignal }): Promise<Movie | null> {
  if (!id) return Promise.resolve(null);

  const cached = cache.get(id);
  if (cached) return Promise.resolve(cached);

  return new Promise<Movie | null>((resolve, reject) => {
    if (opts?.signal) {
      if (opts.signal.aborted) {
        resolve(null);
        return;
      }
      opts.signal.addEventListener("abort", () => resolve(null), { once: true });
    }

    const list = pendingWaiters.get(id) ?? [];
    list.push({ resolve, reject });
    pendingWaiters.set(id, list);
    pendingIds.add(id);
    scheduleFlush();
  });
}

/**
 * Resolves an array of ids, coalesced into as few batched network requests
 * as possible. Duplicate ids are only ever fetched once. The returned
 * array preserves the caller's original request order and silently omits
 * any id that doesn't resolve to a catalog movie — mirroring the backend
 * batch endpoint's own "ignore invalid ids, never duplicate" contract.
 */
export async function resolveMovies(ids: string[], opts?: { signal?: AbortSignal }): Promise<Movie[]> {
  const requestOrder = ids.filter((id): id is string => !!id);
  if (requestOrder.length === 0) return [];

  const uniqueIds = Array.from(new Set(requestOrder));
  const resolved = await Promise.all(uniqueIds.map((id) => resolveMovie(id, opts)));

  const byId = new Map<string, Movie>();
  uniqueIds.forEach((id, i) => {
    const movie = resolved[i];
    if (movie) byId.set(id, movie);
  });

  const seen = new Set<string>();
  const ordered: Movie[] = [];
  for (const id of requestOrder) {
    if (seen.has(id)) continue;
    seen.add(id);
    const movie = byId.get(id);
    if (movie) ordered.push(movie);
  }
  return ordered;
}

/** Dev/test-only escape hatch — clears the in-memory cache and any pending
 *  batch state. Not called anywhere in application code. */
export function __clearMovieResolverCache(): void {
  cache.clear();
  pendingIds = new Set();
  pendingWaiters = new Map();
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}