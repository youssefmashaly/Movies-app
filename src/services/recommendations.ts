// Aggregates every available personalization signal into a single
// UserPreferenceProfile that the AI prompt can consume. Each signal is
// independently optional — callers pass only what they have, and the
// builder degrades gracefully when data is missing or Supabase is not
// yet configured.

import { Movie } from "../types";
import { getUserRating } from "./supabase/ratings";
import { listRecentlyViewed } from "./supabase/recentlyViewed";
import { listWatchlistMovies } from "./supabase/watchlists";
import { isSupabaseConfigured } from "../supabase";

export interface UserPreferenceProfile {
  // Explicit preferences
  favoriteGenres: string[];

  // Derived from activity
  watchlistTitles: string[];        // movie titles the user saved
  recentlyViewedTitles: string[];   // movie titles the user opened
  highlyRatedTitles: string[];      // titles rated 8+ by the user
  topGenres: string[];              // inferred from weighted activity

  // Explanation helpers for prompt + UI
  primaryReason: string;            // "Because you like Action" / "Based on your watchlist"
  confidence: "high" | "medium" | "low";

  // Raw signal counts for the prompt
  signalCount: number;
}

// Merge genre signals with weights: explicit favorites > watchlist > recently viewed
function inferTopGenres(
  favoriteGenres: string[],
  watchlistMovies: Movie[],
  recentMovies: { genres?: string[] }[]
): string[] {
  const map = new Map<string, number>();
  favoriteGenres.forEach((g) => map.set(g, (map.get(g) || 0) + 3));
  watchlistMovies.forEach((m) =>
    m.genres?.forEach((g) => map.set(g, (map.get(g) || 0) + 2))
  );
  recentMovies.forEach((m) =>
    m.genres?.forEach((g) => map.set(g, (map.get(g) || 0) + 1))
  );
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([genre]) => genre);
}

function computeConfidence(signalCount: number): "high" | "medium" | "low" {
  if (signalCount >= 5) return "high";
  if (signalCount >= 2) return "medium";
  return "low";
}

function buildPrimaryReason(profile: Omit<UserPreferenceProfile, "primaryReason" | "confidence">): string {
  if (profile.highlyRatedTitles.length > 0)
    return `Because you rated "${profile.highlyRatedTitles[0]}" highly`;
  if (profile.favoriteGenres.length > 0)
    return `Because you like ${profile.favoriteGenres.slice(0, 2).join(" & ")}`;
  if (profile.watchlistTitles.length > 0)
    return `Similar to movies in your watchlist`;
  if (profile.recentlyViewedTitles.length > 0)
    return `Based on what you've been watching`;
  return "Curated for you";
}

export async function buildUserPreferenceProfile(
  userId: string,
  watchlistId: string | null,
  favoriteGenres: string[],
  watchlistMovies: Movie[],
  recentlyViewedMovies: Movie[]
): Promise<UserPreferenceProfile> {
  // Fetch highly rated movies from Supabase if available.
  // This is the only new network call — everything else is already in local state.
  let highlyRatedTitles: string[] = [];
  if (isSupabaseConfigured && userId) {
    try {
      // Fetch ratings individually for movies the user has interacted with;
      // a full "list all user ratings" query would need a new service function.
      // For now, check the top 5 watchlist items (most likely to have ratings).
      const ratingChecks = watchlistMovies.slice(0, 5).map((m) =>
        getUserRating(userId, m.id).then((r) =>
          r.data && r.data.rating >= 8 ? m.title : null
        )
      );
      const results = await Promise.all(ratingChecks);
      highlyRatedTitles = results.filter((t): t is string => t !== null);
    } catch {
      // Non-fatal — degrade to no high-rating signal
    }
  }

  const topGenres = inferTopGenres(favoriteGenres, watchlistMovies, recentlyViewedMovies);
  const watchlistTitles = watchlistMovies.slice(0, 10).map((m) => m.title);
  const recentlyViewedTitles = recentlyViewedMovies.slice(0, 5).map((m) => m.title);

  const signalCount =
    (favoriteGenres.length > 0 ? 1 : 0) +
    (watchlistTitles.length > 0 ? 1 : 0) +
    (recentlyViewedTitles.length > 0 ? 1 : 0) +
    (highlyRatedTitles.length > 0 ? 2 : 0); // ratings count double — strongest signal

  const partial = { favoriteGenres, watchlistTitles, recentlyViewedTitles, highlyRatedTitles, topGenres, signalCount };

  return {
    ...partial,
    primaryReason: buildPrimaryReason(partial),
    confidence: computeConfidence(signalCount)
  };
}

// Serialises the profile into the extra context fields the server prompt
// already accepts. Keeps the interface stable — nothing breaks if new fields
// are added here in future.
export function profileToRequestPayload(
  profile: UserPreferenceProfile
): Record<string, unknown> {
  return {
    userWatchlistTitles: profile.watchlistTitles,
    favoriteGenres: profile.topGenres,
    recentlyViewedTitles: profile.recentlyViewedTitles,
    highlyRatedTitles: profile.highlyRatedTitles,
    primaryReason: profile.primaryReason,
    confidence: profile.confidence
  };
}