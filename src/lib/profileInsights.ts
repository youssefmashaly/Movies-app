// src/lib/profileInsights.ts
//
// Phase 19 — Advanced Public Profiles.
//
// Pure, dependency-free helpers for profile statistics that aren't already
// stored anywhere: favorite decade, favorite director, and taste match %
// between two users. All of these are computed client-side from data the
// app already has in memory (PRESET_MOVIES catalog + a user's existing
// ratings/reviews/watchlist rows), so no new database columns, tables, or
// API calls are required.

export interface MovieMetaLookup {
  director?: string;
  releaseDate?: string;
}

/** "2014-03-28" → "2010s". Returns null for missing/unparsable dates. */
export function getDecadeLabel(releaseDate: string | null | undefined): string | null {
  if (!releaseDate) return null;
  const year = Number(releaseDate.slice(0, 4));
  if (!Number.isFinite(year) || year < 1888 || year > 2100) return null;
  const decadeStart = Math.floor(year / 10) * 10;
  return `${decadeStart}s`;
}

/**
 * Given a list of movie ids a user has interacted with (rated, reviewed,
 * watchlisted — any mix), and a lookup of that movie's metadata (director /
 * releaseDate — e.g. sourced from the existing PRESET_MOVIES catalog by id),
 * returns the single most common decade and director.
 *
 * Movies with unknown metadata are simply skipped rather than throwing —
 * this must never crash a profile page render.
 */
export function computeFavoriteDecadeAndDirector(
  movieIds: string[],
  moviesById: Map<string, MovieMetaLookup>
): { favoriteDecade: string | null; favoriteDirector: string | null } {
  const decadeFreq: Record<string, number> = {};
  const directorFreq: Record<string, number> = {};

  for (const id of movieIds) {
    const meta = moviesById.get(id);
    if (!meta) continue;

    const decade = getDecadeLabel(meta.releaseDate);
    if (decade) decadeFreq[decade] = (decadeFreq[decade] ?? 0) + 1;

    // "Joel Coen, Ethan Coen" style multi-director strings — count each
    // director individually so co-directed films don't get lumped under one
    // combined label that will never match a solo-directed film by the
    // same person.
    if (meta.director) {
      for (const name of meta.director.split(",").map((s) => s.trim()).filter(Boolean)) {
        directorFreq[name] = (directorFreq[name] ?? 0) + 1;
      }
    }
  }

  const topDecade = Object.entries(decadeFreq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const topDirector = Object.entries(directorFreq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return { favoriteDecade: topDecade, favoriteDirector: topDirector };
}

/**
 * Taste match percentage between two users based on favorite-genre overlap.
 * Same intersection-over-union formula already used by getSuggestedUsers in
 * services/supabase/social.ts, extracted here so profile-to-profile
 * comparisons and the suggested-users list stay numerically consistent
 * without the profile page needing to import from the services layer for a
 * pure calculation.
 */
export function computeTasteMatchPct(genresA: string[], genresB: string[]): number {
  const setA = new Set(genresA.map((g) => g.toLowerCase()));
  const setB = genresB.map((g) => g.toLowerCase());
  const shared = setB.filter((g) => setA.has(g));
  const union = new Set([...setA, ...setB]);
  return union.size > 0 ? Math.round((shared.length / union.size) * 100) : 0;
}