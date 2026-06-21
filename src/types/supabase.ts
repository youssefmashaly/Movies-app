// TypeScript shapes mirroring the Supabase Postgres schema for this app.
// Hand-written for now since no schema is deployed yet. Once the real
// tables exist, regenerate with `supabase gen types typescript` and
// reconcile against these — keep field names/types in sync manually
// until then.

export interface SupabaseProfile {
  id: string; // matches the Firebase Auth uid
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupabaseWatchlistItem {
  id: string;
  user_id: string;
  movie_id: string;
  title: string;
  poster_path: string | null;
  release_date: string | null;
  vote_average: number | null;
  genres: string[] | null;
  added_at: string;
}

export interface SupabaseRecentlyViewed {
  id: string;
  user_id: string;
  movie_id: string;
  title: string;
  poster_path: string | null;
  release_date: string | null;
  vote_average: number | null;
  genres: string[] | null;
  viewed_at: string;
}

export interface SupabaseRating {
  id: string;
  user_id: string;
  movie_id: string;
  rating: number; // 1-10 scale, matches the existing Firestore Review.rating convention
  created_at: string;
  updated_at: string;
}

export interface SupabaseReview {
  id: string;
  user_id: string;
  movie_id: string;
  rating: number;
  comment: string;
  created_at: string;
  updated_at: string;
}

// Every service function resolves to this shape and never throws, so
// callers can handle failures without try/catch at the call site.
export interface SupabaseResult<T> {
  data: T | null;
  error: string | null;
}