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

export async function getSharedGenres(userAGenres: string[], userBGenres: string[]): Promise<string[]> {
  const setB = new Set(userBGenres);
  return userAGenres.filter(g => setB.has(g));
}

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

// ── Trending Reviews ──────────────────────────────────────────────────────────

export async function listTrendingReviews(limit = 10): Promise<SupabaseResult<CommunityReview[]>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    // Pull recent reviews + their like counts, sort client-side (avoids a view/RPC)
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

// ── Leaderboard ───────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  score: number;
  label: string;
}

export async function getReviewLeaderboard(limit = 10): Promise<SupabaseResult<LeaderboardEntry[]>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { data, error } = await supabase
      .from("reviews")
      .select("user_id, profiles(id, display_name, avatar_url)")
      .limit(500);
    if (error) return { data: null, error: error.message };

    const counts: Record<string, { count: number; display_name: string | null; avatar_url: string | null }> = {};
    for (const row of data ?? []) {
      const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      if (!counts[row.user_id]) counts[row.user_id] = { count: 0, display_name: p?.display_name ?? null, avatar_url: p?.avatar_url ?? null };
      counts[row.user_id].count++;
    }

    const entries: LeaderboardEntry[] = Object.entries(counts)
      .map(([user_id, v]) => ({ user_id, display_name: v.display_name, avatar_url: v.avatar_url, score: v.count, label: `${v.count} review${v.count !== 1 ? "s" : ""}` }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return { data: entries, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to fetch leaderboard." };
  }
}

export async function getMostLikedLeaderboard(limit = 10): Promise<SupabaseResult<LeaderboardEntry[]>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { data: reviews, error: rErr } = await supabase
      .from("reviews")
      .select("id, user_id, profiles(display_name, avatar_url)")
      .limit(500);
    if (rErr) return { data: null, error: rErr.message };

    const { data: likes, error: lErr } = await supabase
      .from("review_likes")
      .select("review_id")
      .limit(2000);
    if (lErr) return { data: null, error: lErr.message };

    const likesPerReview: Record<string, number> = {};
    for (const l of likes ?? []) likesPerReview[l.review_id] = (likesPerReview[l.review_id] ?? 0) + 1;

    const userLikes: Record<string, { total: number; display_name: string | null; avatar_url: string | null }> = {};
    for (const r of reviews ?? []) {
      const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      if (!userLikes[r.user_id]) userLikes[r.user_id] = { total: 0, display_name: p?.display_name ?? null, avatar_url: p?.avatar_url ?? null };
      userLikes[r.user_id].total += likesPerReview[r.id] ?? 0;
    }

    const entries: LeaderboardEntry[] = Object.entries(userLikes)
      .map(([user_id, v]) => ({ user_id, display_name: v.display_name, avatar_url: v.avatar_url, score: v.total, label: `${v.total} like${v.total !== 1 ? "s" : ""}` }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return { data: entries, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to fetch most liked leaderboard." };
  }
}

// ── Suggested Users (Taste Matching) ─────────────────────────────────────────

export interface SuggestedUser extends PublicProfile {
  tasteMatchPct: number;
  sharedGenres: string[];
  sharedMovieHint: string | null;
  reviewCount: number;
}

export async function getSuggestedUsers(
  userId: string,
  myGenres: string[],
  alreadyFollowingIds: string[],
  limit = 6
): Promise<SupabaseResult<SuggestedUser[]>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    // Fetch all profiles with genres, excluding self and already-followed
    const excluded = [userId, ...alreadyFollowingIds];
    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, favorite_genres")
      .not("id", "in", `(${excluded.join(",")})`)
      .limit(80);
    if (pErr) return { data: null, error: pErr.message };

    // Fetch review counts per user
    const { data: reviewRows, error: rErr } = await supabase
      .from("reviews")
      .select("user_id")
      .limit(1000);
    if (rErr) return { data: null, error: rErr.message };

    const reviewCounts: Record<string, number> = {};
    for (const r of reviewRows ?? []) reviewCounts[r.user_id] = (reviewCounts[r.user_id] ?? 0) + 1;

    // Compute taste match per candidate
    const mySet = new Set(myGenres.map(g => g.toLowerCase()));
    const candidates: SuggestedUser[] = (profiles ?? [])
      .filter(p => p.id !== userId)
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
          sharedMovieHint: null,
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
  const badges: Badge[] = [];
  const { reviewCount, ratingCount, watchlistSize, likeCount, followerCount, favoriteGenres } = stats;

  if (reviewCount >= 1)  badges.push({ id: "reviewer",      label: "Reviewer",         icon: "✍️",  color: "blue",   description: "Wrote their first review" });
  if (reviewCount >= 10) badges.push({ id: "critic",        label: "Critic",           icon: "🎬",  color: "indigo", description: "Wrote 10 or more reviews" });
  if (reviewCount >= 25) badges.push({ id: "top-critic",    label: "Top Critic",       icon: "🏆",  color: "amber",  description: "Wrote 25 or more reviews" });
  if (ratingCount >= 10) badges.push({ id: "explorer",      label: "Movie Explorer",   icon: "🧭",  color: "teal",   description: "Rated 10 or more movies" });
  if (ratingCount >= 50) badges.push({ id: "cinephile",     label: "Cinephile",        icon: "🎥",  color: "purple", description: "Rated 50 or more movies" });
  if (watchlistSize >= 20) badges.push({ id: "collector",   label: "Collector",        icon: "📚",  color: "emerald", description: "Saved 20+ movies to watchlist" });
  if (likeCount >= 10)   badges.push({ id: "helpful",       label: "Helpful",          icon: "👍",  color: "green",  description: "Received 10 or more likes" });
  if (likeCount >= 50)   badges.push({ id: "community-fav", label: "Community Fav",   icon: "❤️",  color: "red",    description: "Received 50 or more likes" });
  if (followerCount >= 5)  badges.push({ id: "rising",      label: "Rising Star",      icon: "⭐",  color: "amber",  description: "Has 5 or more followers" });
  if (followerCount >= 20) badges.push({ id: "influencer",  label: "Top Contributor",  icon: "🌟",  color: "yellow", description: "Has 20 or more followers" });

  const lowerGenres = favoriteGenres.map(g => g.toLowerCase());
  if (lowerGenres.includes("horror"))  badges.push({ id: "horror-expert", label: "Horror Expert", icon: "👻", color: "red",    description: "Loves horror films" });
  if (lowerGenres.includes("sci-fi"))  badges.push({ id: "scifi-master",  label: "Sci-Fi Master", icon: "🚀", color: "blue",   description: "Loves sci-fi films" });
  if (lowerGenres.includes("drama"))   badges.push({ id: "drama-fan",     label: "Drama Fan",     icon: "🎭", color: "purple", description: "Loves drama films" });
  if (lowerGenres.includes("comedy"))  badges.push({ id: "comedy-lover",  label: "Comedy Lover",  icon: "😂", color: "yellow", description: "Loves comedy films" });

  return badges;
}