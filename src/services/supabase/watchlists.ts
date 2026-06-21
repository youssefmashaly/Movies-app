import { supabase, isSupabaseConfigured } from "../../supabase";
import { SupabaseWatchlistItem, SupabaseResult } from "../../types/supabase";

const TABLE = "watchlists";

export async function listWatchlist(userId: string): Promise<SupabaseResult<SupabaseWatchlistItem[]>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("user_id", userId)
      .order("added_at", { ascending: false });
    if (error) return { data: null, error: error.message };
    return { data: (data as SupabaseWatchlistItem[]) ?? [], error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to fetch watchlist." };
  }
}

export async function addToWatchlist(
  item: Omit<SupabaseWatchlistItem, "id" | "added_at">
): Promise<SupabaseResult<SupabaseWatchlistItem>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { data, error } = await supabase.from(TABLE).insert(item).select().single();
    if (error) return { data: null, error: error.message };
    return { data: data as SupabaseWatchlistItem, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to add to watchlist." };
  }
}

export async function removeFromWatchlist(userId: string, movieId: string): Promise<SupabaseResult<null>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { error } = await supabase.from(TABLE).delete().eq("user_id", userId).eq("movie_id", movieId);
    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to remove from watchlist." };
  }
}