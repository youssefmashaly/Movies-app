import { supabase, isSupabaseConfigured } from "../../supabase";
import { SupabaseReview, SupabaseResult } from "../../types/supabase";

const TABLE = "reviews";

export async function listMovieReviews(movieId: string): Promise<SupabaseResult<SupabaseReview[]>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("movie_id", movieId)
      .order("created_at", { ascending: false });
    if (error) return { data: null, error: error.message };
    return { data: (data as SupabaseReview[]) ?? [], error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to fetch reviews." };
  }
}

export async function createReview(
  review: Omit<SupabaseReview, "id" | "created_at" | "updated_at">
): Promise<SupabaseResult<SupabaseReview>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { data, error } = await supabase.from(TABLE).insert(review).select().single();
    if (error) return { data: null, error: error.message };
    return { data: data as SupabaseReview, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to create review." };
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