import { supabase, isSupabaseConfigured } from "../../supabase";
import { SupabaseRating, SupabaseResult } from "../../types/supabase";

const TABLE = "ratings";

export async function getUserRating(userId: string, movieId: string): Promise<SupabaseResult<SupabaseRating>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("user_id", userId)
      .eq("movie_id", movieId)
      .maybeSingle();
    if (error) return { data: null, error: error.message };
    return { data: data as SupabaseRating | null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to fetch rating." };
  }
}

// Upserts on (user_id, movie_id): one rating per user per movie.
export async function setUserRating(
  userId: string,
  movieId: string,
  movieTitle: string,
  rating: number
): Promise<SupabaseResult<SupabaseRating>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .upsert(
        { user_id: userId, movie_id: movieId, movie_title: movieTitle, rating, updated_at: new Date().toISOString() },
        { onConflict: "user_id,movie_id" }
      )
      .select()
      .single();
    if (error) return { data: null, error: error.message };
    return { data: data as SupabaseRating, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to save rating." };
  }
}

export async function deleteRating(userId: string, movieId: string): Promise<SupabaseResult<null>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { error } = await supabase.from(TABLE).delete().eq("user_id", userId).eq("movie_id", movieId);
    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to delete rating." };
  }
}

export async function listMovieRatings(movieId: string): Promise<SupabaseResult<SupabaseRating[]>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { data, error } = await supabase.from(TABLE).select("*").eq("movie_id", movieId);
    if (error) return { data: null, error: error.message };
    return { data: (data as SupabaseRating[]) ?? [], error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to fetch movie ratings." };
  }
}