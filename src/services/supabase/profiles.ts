import { supabase, isSupabaseConfigured } from "../../supabase";
import { SupabaseProfile, SupabaseResult } from "../../types/supabase";

const TABLE = "profiles";

export async function getProfile(userId: string): Promise<SupabaseResult<SupabaseProfile>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { data, error } = await supabase.from(TABLE).select("*").eq("id", userId).maybeSingle();
    if (error) return { data: null, error: error.message };
    return { data: data as SupabaseProfile | null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to fetch profile." };
  }
}

export async function createProfile(
  profile: Pick<SupabaseProfile, "id" | "email" | "display_name">
): Promise<SupabaseResult<SupabaseProfile>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        id: profile.id,
        email: profile.email,
        display_name: profile.display_name,
        avatar_url: null
      })
      .select()
      .single();
    if (error) return { data: null, error: error.message };
    return { data: data as SupabaseProfile, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to create profile." };
  }
}

export async function updateProfile(
  userId: string,
  updates: Partial<Pick<SupabaseProfile, "display_name" | "avatar_url">>
): Promise<SupabaseResult<SupabaseProfile>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .select()
      .single();
    if (error) return { data: null, error: error.message };
    return { data: data as SupabaseProfile, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to update profile." };
  }
}

// Atomic create-or-update on the Firebase uid (primary key). This replaces a
// check-then-insert pattern: two near-simultaneous sign-ins (e.g. two tabs,
// or a fast double auth-state event) could both see "no profile yet" and
// both attempt an insert, racing each other. A single upsert with
// ON CONFLICT closes that race in one round trip — Postgres serializes it,
// so a duplicate row is never possible.
export async function saveFavoriteGenres(userId: string, genres: string[]): Promise<SupabaseResult<null>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { error } = await supabase
      .from(TABLE)
      .update({ favorite_genres: genres, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (error) return { data: null, error: error.message };
    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to save favorite genres." };
  }
}

export async function upsertProfile(
  profile: Pick<SupabaseProfile, "id" | "email" | "display_name" | "avatar_url">
): Promise<SupabaseResult<SupabaseProfile>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .upsert(
        {
          id: profile.id,
          email: profile.email,
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
          updated_at: new Date().toISOString()
          // created_at is intentionally omitted: the column default (now())
          // only applies on a genuine insert. Leaving it out of the payload
          // means an existing row's created_at is left untouched when this
          // upsert instead takes the ON CONFLICT / update path.
        },
        { onConflict: "id" }
      )
      .select()
      .single();
    if (error) return { data: null, error: error.message };
    return { data: data as SupabaseProfile, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to save profile." };
  }
}

// Ensures a Supabase profile row exists and is up to date for this Firebase
// user — creates it on first sign-in, refreshes display name/email/avatar on
// every subsequent one (Firebase profile data can change between sessions).
// Safe to call on every sign-in: never throws, and a failure here must never
// block or affect the Firebase auth flow itself.
export async function syncProfileFromFirebaseUser(firebaseUser: {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}): Promise<SupabaseResult<SupabaseProfile>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };

  return upsertProfile({
    id: firebaseUser.uid,
    email: firebaseUser.email,
    display_name: firebaseUser.displayName,
    avatar_url: firebaseUser.photoURL
  });
}

// Reads the full profile back after upsert so callers can hydrate
// favourite_genres without a second round trip.
export async function getProfileWithGenres(userId: string): Promise<SupabaseResult<SupabaseProfile & { favorite_genres: string[] }>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("id, display_name, avatar_url, email, favorite_genres, created_at, updated_at")
      .eq("id", userId)
      .maybeSingle();
    if (error) return { data: null, error: error.message };
    return { data: data as (SupabaseProfile & { favorite_genres: string[] }) | null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Failed to fetch profile." };
  }
}