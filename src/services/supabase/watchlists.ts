import { supabase, isSupabaseConfigured } from "../../supabase";
import { SupabaseWatchlist, SupabaseWatchlistMovie, SupabaseResult } from "../../types/supabase";

const WATCHLISTS_TABLE = "watchlists";
const WATCHLIST_MOVIES_TABLE = "watchlist_movies";
const DEFAULT_WATCHLIST_NAME = "My Watchlist";

// ---- Watchlist containers -------------------------------------------------

export async function listWatchlists(userId: string): Promise<SupabaseResult<SupabaseWatchlist[]>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { data, error } = await supabase
      .from(WATCHLISTS_TABLE)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (error) return { data: null, error: error.message };
    return { data: (data as SupabaseWatchlist[]) ?? [], error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to fetch watchlists." };
  }
}

export async function createWatchlist(userId: string, name: string): Promise<SupabaseResult<SupabaseWatchlist>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { data, error } = await supabase
      .from(WATCHLISTS_TABLE)
      .insert({ user_id: userId, name })
      .select()
      .single();
    if (error) return { data: null, error: error.message };
    return { data: data as SupabaseWatchlist, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to create watchlist." };
  }
}

// Deletes a watchlist and its movies. Movie rows are deleted explicitly first
// so this is correct regardless of whether the schema also has an
// ON DELETE CASCADE foreign key configured.
export async function deleteWatchlist(watchlistId: string, userId: string): Promise<SupabaseResult<null>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { error: moviesError } = await supabase
      .from(WATCHLIST_MOVIES_TABLE)
      .delete()
      .eq("watchlist_id", watchlistId);
    if (moviesError) return { data: null, error: moviesError.message };

    const { error } = await supabase
      .from(WATCHLISTS_TABLE)
      .delete()
      .eq("id", watchlistId)
      .eq("user_id", userId);
    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to delete watchlist." };
  }
}

// Returns the user's first watchlist, creating a default one if they don't
// have any yet. This is what the current single-watchlist UI is built on —
// mirrors the "ensure a profile exists" pattern used for profile sync.
export async function getOrCreateDefaultWatchlist(userId: string): Promise<SupabaseResult<SupabaseWatchlist>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };

  const existing = await listWatchlists(userId);
  if (existing.error) return { data: null, error: existing.error };
  if (existing.data && existing.data.length > 0) return { data: existing.data[0], error: null };

  return createWatchlist(userId, DEFAULT_WATCHLIST_NAME);
}

// ---- Movies within a watchlist ---------------------------------------------

export async function listWatchlistMovies(watchlistId: string): Promise<SupabaseResult<SupabaseWatchlistMovie[]>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { data, error } = await supabase
      .from(WATCHLIST_MOVIES_TABLE)
      .select("*")
      .eq("watchlist_id", watchlistId)
      .order("added_at", { ascending: false });
    if (error) return { data: null, error: error.message };
    return { data: (data as SupabaseWatchlistMovie[]) ?? [], error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to fetch watchlist movies." };
  }
}

// Upserts on (watchlist_id, movie_id) so adding the same movie twice can
// never create a duplicate row — assumes a unique constraint on that pair
// in the real schema, same pattern used for profile sync.
export async function addMovieToWatchlist(
  watchlistId: string,
  movie: Omit<SupabaseWatchlistMovie, "id" | "watchlist_id" | "added_at">
): Promise<SupabaseResult<SupabaseWatchlistMovie>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { data, error } = await supabase
      .from(WATCHLIST_MOVIES_TABLE)
      .upsert(
        {
          watchlist_id: watchlistId,
          movie_id: movie.movie_id,
          title: movie.title,
          poster_path: movie.poster_path,
          release_date: movie.release_date,
          vote_average: movie.vote_average,
          genres: movie.genres
        },
        { onConflict: "watchlist_id,movie_id" }
      )
      .select()
      .single();
    if (error) return { data: null, error: error.message };
    return { data: data as SupabaseWatchlistMovie, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to add movie to watchlist." };
  }
}

export async function removeMovieFromWatchlist(watchlistId: string, movieId: string): Promise<SupabaseResult<null>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { error } = await supabase
      .from(WATCHLIST_MOVIES_TABLE)
      .delete()
      .eq("watchlist_id", watchlistId)
      .eq("movie_id", movieId);
    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to remove movie from watchlist." };
  }
}