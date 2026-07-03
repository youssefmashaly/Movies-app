import { supabase, isSupabaseConfigured } from "../../supabase";
import { SupabaseResult } from "../../types/supabase";

// ── Types ────────────────────────────────────────────────────────────────────

export interface CommunityReview {
  id: string;
  user_id: string;
  movie_id: string;
  movie_title: string;
  rating: number;
  comment: string;
  created_at: string;
  profiles: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  like_count?: number;
}

export interface ReviewLike {
  id: string;
  review_id: string;
  user_id: string;
  created_at: string;
}

export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface PublicProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  favorite_genres: string[] | null;
  review_count?: number;
  rating_count?: number;
}

// ── Community Feed ────────────────────────────────────────────────────────────

export async function listCommunityReviews(limit = 20): Promise<SupabaseResult<CommunityReview[]>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { data, error } = await supabase
      .from("reviews")
      .select("id, user_id, movie_id, movie_title, rating, comment, created_at, profiles(display_name, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return { data: null, error: error.message };
    const normalized = (data ?? []).map((row: any) => ({
      ...row,
      profiles: Array.isArray(row.profiles) ? (row.profiles[0] ?? null) : row.profiles,
    })) as CommunityReview[];
    return { data: normalized, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to fetch community reviews." };
  }
}

// ── Review Likes ──────────────────────────────────────────────────────────────

export async function likeReview(reviewId: string, userId: string): Promise<SupabaseResult<null>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { error } = await supabase
      .from("review_likes")
      .upsert({ review_id: reviewId, user_id: userId }, { onConflict: "review_id,user_id" });
    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to like review." };
  }
}

export async function unlikeReview(reviewId: string, userId: string): Promise<SupabaseResult<null>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { error } = await supabase
      .from("review_likes")
      .delete()
      .eq("review_id", reviewId)
      .eq("user_id", userId);
    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to unlike review." };
  }
}

export async function getUserLikes(userId: string): Promise<SupabaseResult<string[]>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { data, error } = await supabase
      .from("review_likes")
      .select("review_id")
      .eq("user_id", userId);
    if (error) return { data: null, error: error.message };
    return { data: (data ?? []).map((r: { review_id: string }) => r.review_id), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to fetch likes." };
  }
}

export async function getReviewLikeCounts(reviewIds: string[]): Promise<SupabaseResult<Record<string, number>>> {
  if (!isSupabaseConfigured || reviewIds.length === 0) return { data: {}, error: null };
  try {
    const { data, error } = await supabase
      .from("review_likes")
      .select("review_id")
      .in("review_id", reviewIds);
    if (error) return { data: null, error: error.message };
    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      counts[row.review_id] = (counts[row.review_id] ?? 0) + 1;
    }
    return { data: counts, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to fetch like counts." };
  }
}

// ── Follows ───────────────────────────────────────────────────────────────────

export async function followUser(followerId: string, followingId: string): Promise<SupabaseResult<null>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { error } = await supabase
      .from("follows")
      .upsert({ follower_id: followerId, following_id: followingId }, { onConflict: "follower_id,following_id" });
    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to follow user." };
  }
}

export async function unfollowUser(followerId: string, followingId: string): Promise<SupabaseResult<null>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", followerId)
      .eq("following_id", followingId);
    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to unfollow user." };
  }
}

export async function getFollowingIds(userId: string): Promise<SupabaseResult<string[]>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { data, error } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId);
    if (error) return { data: null, error: error.message };
    return { data: (data ?? []).map((r: { following_id: string }) => r.following_id), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to fetch following." };
  }
}

export async function getFollowerCount(userId: string): Promise<SupabaseResult<number>> {
  if (!isSupabaseConfigured) return { data: 0, error: null };
  try {
    const { count, error } = await supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", userId);
    if (error) return { data: null, error: error.message };
    return { data: count ?? 0, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to fetch follower count." };
  }
}

export async function getFollowingCount(userId: string): Promise<SupabaseResult<number>> {
  if (!isSupabaseConfigured) return { data: 0, error: null };
  try {
    const { count, error } = await supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", userId);
    if (error) return { data: null, error: error.message };
    return { data: count ?? 0, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to fetch following count." };
  }
}

// ── Followers / Following Lists ───────────────────────────────────────────────

export interface FollowWithProfile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  favorite_genres: string[] | null;
}

export async function listFollowers(userId: string): Promise<SupabaseResult<FollowWithProfile[]>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { data, error } = await supabase
      .from("follows")
      .select("follower_id, profiles!follows_follower_id_fkey(id, display_name, avatar_url, favorite_genres)")
      .eq("following_id", userId)
      .order("created_at", { ascending: false });
    if (error) return { data: null, error: error.message };
    const result = (data ?? []).map((row: any) => ({
      id: row.follower_id,
      user_id: row.follower_id,
      display_name: row.profiles?.display_name ?? null,
      avatar_url: row.profiles?.avatar_url ?? null,
      favorite_genres: row.profiles?.favorite_genres ?? null,
    }));
    return { data: result, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to fetch followers." };
  }
}

export async function listFollowing(userId: string): Promise<SupabaseResult<FollowWithProfile[]>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { data, error } = await supabase
      .from("follows")
      .select("following_id, profiles!follows_following_id_fkey(id, display_name, avatar_url, favorite_genres)")
      .eq("follower_id", userId)
      .order("created_at", { ascending: false });
    if (error) return { data: null, error: error.message };
    const result = (data ?? []).map((row: any) => ({
      id: row.following_id,
      user_id: row.following_id,
      display_name: row.profiles?.display_name ?? null,
      avatar_url: row.profiles?.avatar_url ?? null,
      favorite_genres: row.profiles?.favorite_genres ?? null,
    }));
    return { data: result, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to fetch following." };
  }
}

export async function checkIsFollowing(followerId: string, followingId: string): Promise<SupabaseResult<boolean>> {
  if (!isSupabaseConfigured) return { data: false, error: null };
  try {
    const { count, error } = await supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", followerId)
      .eq("following_id", followingId);
    if (error) return { data: null, error: error.message };
    return { data: (count ?? 0) > 0, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to check follow status." };
  }
}

export async function getFollowCounts(userId: string): Promise<SupabaseResult<{ followers: number; following: number }>> {
  if (!isSupabaseConfigured) return { data: { followers: 0, following: 0 }, error: null };
  try {
    const [follRes, folwRes] = await Promise.all([
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", userId),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", userId),
    ]);
    return {
      data: {
        followers: follRes.count ?? 0,
        following: folwRes.count ?? 0,
      },
      error: follRes.error?.message ?? folwRes.error?.message ?? null,
    };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to fetch follow counts." };
  }
}

// ── Active Reviewers ──────────────────────────────────────────────────────────

export async function listActiveReviewers(limit = 8): Promise<SupabaseResult<PublicProfile[]>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { data, error } = await supabase
      .from("reviews")
      .select("user_id, profiles(id, display_name, avatar_url, favorite_genres)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return { data: null, error: error.message };

    const seen = new Set<string>();
    const reviewers: PublicProfile[] = [];
    for (const row of data ?? []) {
      const rawProfile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      const profile = rawProfile as PublicProfile | null;
      if (profile && !seen.has(row.user_id)) {
        seen.add(row.user_id);
        reviewers.push(profile);
        if (reviewers.length >= limit) break;
      }
    }
    return { data: reviewers, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to fetch reviewers." };
  }
}

// ── Public profile ─────────────────────────────────────────────────────────────

export async function getPublicProfile(userId: string): Promise<SupabaseResult<PublicProfile>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, favorite_genres")
      .eq("id", userId)
      .maybeSingle();
    if (error) return { data: null, error: error.message };
    return { data: data as PublicProfile | null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to fetch public profile." };
  }
}

// ── Helpful Votes ─────────────────────────────────────────────────────────────

export async function voteHelpful(reviewId: string, userId: string): Promise<SupabaseResult<null>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { error } = await supabase
      .from("review_helpful_votes")
      .upsert({ review_id: reviewId, user_id: userId }, { onConflict: "review_id,user_id" });
    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to vote helpful." };
  }
}

export async function unvoteHelpful(reviewId: string, userId: string): Promise<SupabaseResult<null>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { error } = await supabase
      .from("review_helpful_votes")
      .delete()
      .eq("review_id", reviewId)
      .eq("user_id", userId);
    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to remove helpful vote." };
  }
}

export async function getUserHelpfulVotes(userId: string): Promise<SupabaseResult<string[]>> {
  if (!isSupabaseConfigured) return { data: [], error: null };
  try {
    const { data, error } = await supabase
      .from("review_helpful_votes")
      .select("review_id")
      .eq("user_id", userId);
    if (error) return { data: null, error: error.message };
    return { data: (data ?? []).map((r: { review_id: string }) => r.review_id), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to fetch helpful votes." };
  }
}

export async function getHelpfulVoteCounts(reviewIds: string[]): Promise<SupabaseResult<Record<string, number>>> {
  if (!isSupabaseConfigured || reviewIds.length === 0) return { data: {}, error: null };
  try {
    const { data, error } = await supabase
      .from("review_helpful_votes")
      .select("review_id")
      .in("review_id", reviewIds);
    if (error) return { data: null, error: error.message };
    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      counts[row.review_id] = (counts[row.review_id] ?? 0) + 1;
    }
    return { data: counts, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to fetch helpful counts." };
  }
}

// ── Trending Reviews (last 7 days, ranked by likes) ───────────────────────────

export async function listTrendingReviews(limit = 10): Promise<SupabaseResult<CommunityReview[]>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("reviews")
      .select("id, user_id, movie_id, movie_title, rating, comment, created_at, profiles(display_name, avatar_url)")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) return { data: null, error: error.message };

    const rows = (data ?? []).map((row: any) => ({
      ...row,
      profiles: Array.isArray(row.profiles) ? (row.profiles[0] ?? null) : row.profiles,
    })) as CommunityReview[];

    if (rows.length === 0) return { data: [], error: null };

    const ids = rows.map(r => r.id);
    const countsRes = await getReviewLikeCounts(ids);
    const counts = countsRes.data ?? {};

    const sorted = rows
      .map(r => ({ ...r, like_count: counts[r.id] ?? 0 }))
      .sort((a, b) => (b.like_count ?? 0) - (a.like_count ?? 0))
      .slice(0, limit);

    return { data: sorted, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to fetch trending reviews." };
  }
}

// ── Following-filtered review feed ────────────────────────────────────────────

export async function listFollowingReviews(followingIds: string[], limit = 30): Promise<SupabaseResult<CommunityReview[]>> {
  if (!isSupabaseConfigured || followingIds.length === 0) return { data: [], error: null };
  try {
    const { data, error } = await supabase
      .from("reviews")
      .select("id, user_id, movie_id, movie_title, rating, comment, created_at, profiles(display_name, avatar_url)")
      .in("user_id", followingIds)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return { data: null, error: error.message };
    const normalized = (data ?? []).map((row: any) => ({
      ...row,
      profiles: Array.isArray(row.profiles) ? (row.profiles[0] ?? null) : row.profiles,
    })) as CommunityReview[];
    return { data: normalized, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to fetch following reviews." };
  }
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  score: number;
  label: string;
}

export async function getReviewLeaderboard(limit = 8): Promise<SupabaseResult<LeaderboardEntry[]>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { data, error } = await supabase
      .from("reviews")
      .select("user_id, profiles(display_name, avatar_url)")
      .limit(500);
    if (error) return { data: null, error: error.message };

    const counts: Record<string, { count: number; display_name: string | null; avatar_url: string | null }> = {};
    for (const row of data ?? []) {
      const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      if (!counts[row.user_id]) counts[row.user_id] = { count: 0, display_name: p?.display_name ?? null, avatar_url: p?.avatar_url ?? null };
      counts[row.user_id].count++;
    }

    const entries: LeaderboardEntry[] = Object.entries(counts)
      .map(([user_id, v]) => ({
        user_id,
        display_name: v.display_name,
        avatar_url: v.avatar_url,
        score: v.count,
        label: `${v.count} review${v.count !== 1 ? "s" : ""}`,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return { data: entries, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to fetch leaderboard." };
  }
}

// ── Suggested Users with Taste Matching ──────────────────────────────────────

export interface SuggestedUser {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  favorite_genres: string[] | null;
  tasteMatchPct: number;
  sharedGenres: string[];
  reviewCount: number;
}

export async function getSuggestedUsers(
  userId: string,
  myGenres: string[],
  alreadyFollowingIds: string[],
  limit = 6
): Promise<SupabaseResult<SuggestedUser[]>> {
  if (!isSupabaseConfigured) return { data: [], error: null };
  try {
    const excluded = [userId, ...alreadyFollowingIds];
    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, favorite_genres")
      .limit(80);
    if (pErr) return { data: null, error: pErr.message };

    const { data: reviewRows, error: rErr } = await supabase
      .from("reviews")
      .select("user_id")
      .limit(1000);
    if (rErr) return { data: null, error: rErr.message };

    const reviewCounts: Record<string, number> = {};
    for (const r of reviewRows ?? []) reviewCounts[r.user_id] = (reviewCounts[r.user_id] ?? 0) + 1;

    const mySet = new Set(myGenres.map(g => g.toLowerCase()));

    const candidates: SuggestedUser[] = (profiles ?? [])
      .filter(p => !excluded.includes(p.id))
      .map(p => {
        const theirGenres: string[] = p.favorite_genres ?? [];
        const shared = theirGenres.filter(g => mySet.has(g.toLowerCase()));
        const union = new Set([...myGenres.map(g => g.toLowerCase()), ...theirGenres.map(g => g.toLowerCase())]);
        const tasteMatchPct = union.size > 0 ? Math.round((shared.length / union.size) * 100) : 0;
        return {
          id: p.id,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          favorite_genres: p.favorite_genres,
          tasteMatchPct,
          sharedGenres: shared,
          reviewCount: reviewCounts[p.id] ?? 0,
        };
      })
      .filter(c => c.reviewCount > 0 || c.tasteMatchPct > 0)
      .sort((a, b) => b.tasteMatchPct - a.tasteMatchPct || b.reviewCount - a.reviewCount)
      .slice(0, limit);

    return { data: candidates, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to fetch suggested users." };
  }
}

// ── Achievement Badges ────────────────────────────────────────────────────────

export interface Badge {
  id: string;
  label: string;
  icon: string;
  color: string;
  description: string;
}

export function computeBadges(stats: {
  reviewCount: number;
  ratingCount: number;
  watchlistSize: number;
  likeCount: number;
  followerCount: number;
  favoriteGenres: string[];
}): Badge[] {
  const { reviewCount, ratingCount, watchlistSize, likeCount, followerCount, favoriteGenres } = stats;
  const badges: Badge[] = [];

  if (reviewCount >= 1)  badges.push({ id: "reviewer",      label: "Reviewer",       icon: "✍️",  color: "blue",    description: "Wrote their first review" });
  if (reviewCount >= 10) badges.push({ id: "critic",        label: "Critic",         icon: "🎬",  color: "indigo",  description: "Wrote 10+ reviews" });
  if (reviewCount >= 25) badges.push({ id: "top-critic",    label: "Top Critic",     icon: "🏆",  color: "amber",   description: "Wrote 25+ reviews" });
  if (ratingCount >= 10) badges.push({ id: "explorer",      label: "Explorer",       icon: "🧭",  color: "teal",    description: "Rated 10+ movies" });
  if (ratingCount >= 50) badges.push({ id: "cinephile",     label: "Cinephile",      icon: "🎥",  color: "purple",  description: "Rated 50+ movies" });
  if (watchlistSize >= 20) badges.push({ id: "collector",   label: "Collector",      icon: "📚",  color: "emerald", description: "Saved 20+ movies" });
  if (likeCount >= 10)   badges.push({ id: "helpful",       label: "Helpful",        icon: "👍",  color: "green",   description: "Received 10+ likes" });
  if (likeCount >= 50)   badges.push({ id: "community-fav", label: "Community Fav", icon: "❤️",  color: "red",     description: "Received 50+ likes" });
  if (followerCount >= 5)  badges.push({ id: "rising",      label: "Rising Star",    icon: "⭐",  color: "amber",   description: "5+ followers" });
  if (followerCount >= 20) badges.push({ id: "influencer",  label: "Top Contributor",icon: "🌟",  color: "yellow",  description: "20+ followers" });

  const lowerGenres = favoriteGenres.map(g => g.toLowerCase());
  if (lowerGenres.includes("horror"))  badges.push({ id: "horror-expert", label: "Horror Expert", icon: "👻", color: "red",    description: "Loves horror" });
  if (lowerGenres.includes("sci-fi"))  badges.push({ id: "scifi-master",  label: "Sci-Fi Master", icon: "🚀", color: "blue",   description: "Loves sci-fi" });
  if (lowerGenres.includes("drama"))   badges.push({ id: "drama-fan",     label: "Drama Fan",     icon: "🎭", color: "purple", description: "Loves drama" });
  if (lowerGenres.includes("comedy"))  badges.push({ id: "comedy-lover",  label: "Comedy Lover",  icon: "😂", color: "yellow", description: "Loves comedy" });

  return badges;
}

// ── Collaborative Discovery Signals ───────────────────────────────────────────
// Lightweight aggregation over the existing `ratings` table — same pattern as
// getReviewLeaderboard above: one capped SELECT, aggregate client-side, no RPC,
// no per-user/per-movie loop (avoids N+1 entirely).

export interface CollaborativeMovieSignal {
  movie_id: string;
  avgRating: number;
  raterCount: number;
}

function aggregateRatings(rows: { movie_id: string; rating: number }[]): CollaborativeMovieSignal[] {
  const agg: Record<string, { total: number; count: number }> = {};
  for (const row of rows) {
    if (!agg[row.movie_id]) agg[row.movie_id] = { total: 0, count: 0 };
    agg[row.movie_id].total += row.rating;
    agg[row.movie_id].count += 1;
  }
  return Object.entries(agg).map(([movie_id, v]) => ({
    movie_id,
    avgRating: v.total / v.count,
    raterCount: v.count,
  }));
}

// Highly-rated movies among a specific set of users (following, or similar-taste).
export async function getRatingsFromUsers(
  userIds: string[],
  minRating = 8,
  limit = 200
): Promise<SupabaseResult<CollaborativeMovieSignal[]>> {
  if (!isSupabaseConfigured || userIds.length === 0) return { data: [], error: null };
  try {
    const { data, error } = await supabase
      .from("ratings")
      .select("movie_id, rating")
      .in("user_id", userIds)
      .gte("rating", minRating)
      .limit(limit);
    if (error) return { data: null, error: error.message };
    const signals = aggregateRatings(data ?? [])
      .sort((a, b) => b.avgRating - a.avgRating || b.raterCount - a.raterCount);
    return { data: signals, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to fetch ratings from users." };
  }
}

// Community-wide favorites: movies rated highly by 2+ different people, regardless
// of follow/taste relationship — the "everyone loves this" signal.
export async function getCommunityFavoriteMovies(limit = 1000): Promise<SupabaseResult<CollaborativeMovieSignal[]>> {
  if (!isSupabaseConfigured) return { data: [], error: null };
  try {
    const { data, error } = await supabase
      .from("ratings")
      .select("movie_id, rating")
      .limit(limit);
    if (error) return { data: null, error: error.message };
    const signals = aggregateRatings(data ?? [])
      .filter((s) => s.raterCount >= 2)
      .sort((a, b) => b.avgRating - a.avgRating || b.raterCount - a.raterCount);
    return { data: signals, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to fetch community favorites." };
  }
}