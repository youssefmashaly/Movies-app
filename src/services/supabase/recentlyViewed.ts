import { supabase, isSupabaseConfigured } from "../../supabase";
import { SupabaseRecentlyViewed, SupabaseResult } from "../../types/supabase";

const TABLE = "recently_viewed";

export async function listRecentlyViewed(
  userId: string,
  limit: number = 10
): Promise<SupabaseResult<SupabaseRecentlyViewed[]>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("user_id", userId)
      .order("viewed_at", { ascending: false })
      .limit(limit);
    if (error) return { data: null, error: error.message };
    return { data: (data as SupabaseRecentlyViewed[]) ?? [], error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to fetch recently viewed." };
  }
}

// Upserts on (user_id, movie_id) so re-viewing a title just bumps viewed_at
// instead of creating duplicate rows. Assumes a unique constraint on that
// pair in the real schema.
export async function recordRecentlyViewed(
  item: Omit<SupabaseRecentlyViewed, "id" | "viewed_at">
): Promise<SupabaseResult<SupabaseRecentlyViewed>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .upsert({ ...item, viewed_at: new Date().toISOString() }, { onConflict: "user_id,movie_id" })
      .select()
      .single();
    if (error) return { data: null, error: error.message };
    return { data: data as SupabaseRecentlyViewed, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to record recently viewed." };
  }
}