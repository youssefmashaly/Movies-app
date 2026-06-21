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

// Ensures a Supabase profile row exists for this Firebase user, creating one
// if missing. Safe to call on every sign-in — never throws, and a failure
// here must never block or affect the Firebase auth flow itself.
export async function syncProfileFromFirebaseUser(firebaseUser: {
  uid: string;
  email: string | null;
  displayName: string | null;
}): Promise<SupabaseResult<SupabaseProfile>> {
  if (!isSupabaseConfigured) return { data: null, error: "Supabase is not configured." };

  const existing = await getProfile(firebaseUser.uid);
  if (existing.error) return existing;
  if (existing.data) return existing;

  return createProfile({
    id: firebaseUser.uid,
    email: firebaseUser.email,
    display_name: firebaseUser.displayName
  });
}