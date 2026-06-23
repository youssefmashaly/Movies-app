import { supabase, isSupabaseConfigured } from "../../supabase";
import { SupabaseReview, SupabaseReviewWithProfile, SupabaseResult } from "../../types/supabase";

const TABLE = "reviews";

export async function listMovieReviews(movieId: string): Promise<SupabaseResult<SupabaseReviewWithProfile[]>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*, profiles(display_name, avatar_url)")
      .eq("movie_id", movieId)
      .order("created_at", { ascending: false });
    if (error) return { data: null, error: error.message };
    return { data: (data as SupabaseReviewWithProfile[]) ?? [], error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to fetch reviews." };
  }
}

export async function getUserReview(userId: string, movieId: string): Promise<SupabaseResult<SupabaseReview>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("user_id", userId)
      .eq("movie_id", movieId)
      .maybeSingle();
    if (error) return { data: null, error: error.message };
    return { data: data as SupabaseReview | null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to fetch review." };
  }
}

export async function createReview(
  review: Pick<SupabaseReview, "user_id" | "movie_id" | "rating" | "comment"> & { movie_title: string }
): Promise<SupabaseResult<SupabaseReview>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({ ...review, movie_title: review.movie_title })
      .select()
      .single();
    if (error) return { data: null, error: error.message };
    return { data: data as SupabaseReview, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to create review." };
  }
}

export async function updateReview(
  reviewId: string,
  userId: string,
  updates: Pick<SupabaseReview, "rating" | "comment">
): Promise<SupabaseResult<SupabaseReview>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", reviewId)
      .eq("user_id", userId)
      .select()
      .single();
    if (error) return { data: null, error: error.message };
    return { data: data as SupabaseReview, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to update review." };
  }
}

export async function listUserReviews(userId: string, limit: number = 20): Promise<SupabaseResult<SupabaseReview[]>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return { data: null, error: error.message };
    return { data: (data as SupabaseReview[]) ?? [], error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to fetch user reviews." };
  }
}


export async function deleteReview(reviewId: string, userId: string): Promise<SupabaseResult<null>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { error } = await supabase.from(TABLE).delete().eq("id", reviewId).eq("user_id", userId);
    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to delete review." };
  }
}