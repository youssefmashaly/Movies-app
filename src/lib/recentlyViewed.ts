// src/lib/recentlyViewed.ts
//
// Phase 18D — Continue Browsing cache repair.
//
// PROBLEM: `movieapp:recentlyViewed` in localStorage used to store full
// Movie objects (posterPath/backdropPath included). That meant Continue
// Browsing kept showing whatever artwork existed at the moment a movie was
// first viewed, even after movies-data.ts was corrected with new,
// TMDB-verified artwork — the rail was rendering a stale snapshot instead
// of live data.
//
// FIX: store only `{ id, viewedAt }` — never movie content — and always
// resolve the current Movie object from live data (e.g. combinedMoviePool,
// which is already fetched fresh from the API on every load) at render
// time. This guarantees Continue Browsing automatically reflects future
// catalog updates with zero user action (no localStorage clear needed).
//
// `migrateRecentlyViewedEntries` transparently upgrades any legacy
// full-Movie-object cache to the new minimal shape the first time it's
// read, preserving ordering (= recency) and never dropping history.

import { Movie } from "../types";

export interface RecentlyViewedEntry {
  id: string;
  viewedAt: number;
}

export const MAX_RECENTLY_VIEWED = 10;

/** True if `entry` looks like the legacy shape (a full Movie object) rather
 *  than the new minimal `{ id, viewedAt }` shape. */
function isLegacyMovieEntry(entry: unknown): entry is Movie {
  return (
    !!entry &&
    typeof entry === "object" &&
    "id" in (entry as Record<string, unknown>) &&
    ("title" in (entry as Record<string, unknown>) ||
      "posterPath" in (entry as Record<string, unknown>) ||
      "backdropPath" in (entry as Record<string, unknown>))
  );
}

function isCurrentShapeEntry(entry: unknown): entry is RecentlyViewedEntry {
  if (!entry || typeof entry !== "object") return false;
  const e = entry as Record<string, unknown>;
  return typeof e.id === "string" && typeof e.viewedAt === "number" && !("title" in e);
}

/**
 * Normalizes whatever is currently stored under the recently-viewed
 * localStorage key into the current `{ id, viewedAt }[]` shape.
 *
 * - Already-migrated data passes through unchanged (deduped/capped again
 *   defensively, in case of manual localStorage edits or old bugs).
 * - Legacy full-Movie-object data is converted to id-only entries. Original
 *   array order (most-recent-first) is preserved via synthetic,
 *   strictly-descending `viewedAt` timestamps, since the legacy shape never
 *   recorded a real view timestamp.
 * - Anything unrecognizable is safely dropped rather than throwing.
 */
export function migrateRecentlyViewedEntries(raw: unknown): RecentlyViewedEntry[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const migrated: RecentlyViewedEntry[] = [];
  const now = Date.now();

  raw.forEach((entry, index) => {
    if (isCurrentShapeEntry(entry)) {
      if (seen.has(entry.id)) return;
      seen.add(entry.id);
      migrated.push({ id: entry.id, viewedAt: entry.viewedAt });
      return;
    }

    if (isLegacyMovieEntry(entry)) {
      const id = (entry as Movie).id;
      if (typeof id !== "string" || seen.has(id)) return;
      seen.add(id);
      // Preserve original recency order without inventing a fake "real"
      // timestamp — each legacy entry just gets a slightly earlier synthetic
      // value than the one before it.
      migrated.push({ id, viewedAt: now - index });
      return;
    }

    // Unrecognized shape — skip rather than fail the whole migration.
  });

  return migrated.slice(0, MAX_RECENTLY_VIEWED);
}

/**
 * Adds (or bumps, if already present) a movie id to the front of the
 * recently-viewed list. Deduped and capped, same behavior as before the
 * migration — only the stored shape changed.
 */
export function addRecentlyViewedEntry(
  prev: RecentlyViewedEntry[],
  movieId: string
): RecentlyViewedEntry[] {
  const withoutCurrent = prev.filter((e) => e.id !== movieId);
  return [{ id: movieId, viewedAt: Date.now() }, ...withoutCurrent].slice(0, MAX_RECENTLY_VIEWED);
}

/**
 * Resolves stored recently-viewed entries against a live movie lookup map
 * (current catalog data — current posterPath/backdropPath included) so
 * Continue Browsing always shows up-to-date artwork.
 *
 * Entries whose movie can't currently be resolved (e.g. it's no longer in
 * trending/latest) are simply omitted from the rendered rail — they are
 * NOT removed from persisted history, so they can still resolve later if
 * that movie reappears in the live pool.
 */
export function resolveRecentlyViewedMovies(
  entries: RecentlyViewedEntry[],
  moviesById: Map<string, Movie>
): Movie[] {
  const resolved: Movie[] = [];
  for (const entry of entries) {
    const movie = moviesById.get(entry.id);
    if (movie) resolved.push(movie);
  }
  return resolved;
}