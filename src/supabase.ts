import { createClient } from "@supabase/supabase-js";

// Strip any accidental /rest/v1 suffix — the Supabase client appends this
// path itself; if the env var already contains it the result is a doubled
// /rest/v1/rest/v1/ path in every request (produces 404s for all API calls).
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/rest\/v1\/?$/, "");
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn(
    "[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. " +
    "Supabase features are disabled until they're configured in .env"
  );
}

// Falls back to harmless placeholder values so createClient never throws at
// import time even when not configured yet. Every service function checks
// isSupabaseConfigured first and fails gracefully instead of attempting a
// network call against the placeholder host.
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key"
);