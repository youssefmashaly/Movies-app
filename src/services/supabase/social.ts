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
    return { data: (data as CommunityReview[]) ?? [], error: null };
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
      const profile = row.profiles as PublicProfile | null;
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