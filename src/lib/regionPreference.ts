// src/lib/regionPreference.ts
//
// Phase 44 — user-selectable "Where to Watch" region.
//
// Persists the user's chosen availability region to localStorage under a
// stable key.  Works identically for authenticated and logged-out users —
// the preference is bound to the browser/device, not the Firebase account,
// which is consistent with how the existing ThemeContext handles its
// preference (same storage strategy, same fallback story).
//
// The fallback chain mirrors Phase 43's guessRegion() so existing behaviour
// is entirely preserved for users who have never touched the selector:
//   1. Explicit saved choice  (localStorage)
//   2. Browser locale hint    (navigator.language → country subtag)
//   3. Hard fallback          ("US")

const STORAGE_KEY = "movieapp:wtw-region";

/** ISO 3166-1 alpha-2 validation regex used throughout this module. */
const VALID_REGION = /^[A-Z]{2}$/;

/**
 * Returns the two-letter region code to use when fetching provider
 * availability.  Priority:
 *   1. Stored preference
 *   2. Browser locale country subtag
 *   3. "US"
 */
export function getRegion(): string {
  // 1. Explicit stored preference
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && VALID_REGION.test(stored)) return stored;
  } catch {
    // localStorage blocked (private browsing, security policy, etc.)
  }

  // 2. Browser locale hint — e.g. "en-GB" → "GB"
  try {
    const locale = navigator.language ?? "";
    const parts = locale.split("-");
    const region = parts[1]?.toUpperCase() ?? "";
    if (VALID_REGION.test(region)) return region;
  } catch {
    // navigator not available (SSR/test environment)
  }

  // 3. Safe fallback
  return "US";
}

/**
 * Returns the stored explicit preference only — undefined if the user has
 * never made a manual selection.  Used to distinguish "saved choice" from
 * "auto-detected" in the UI.
 */
export function getSavedRegion(): string | undefined {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored && VALID_REGION.test(stored) ? stored : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Persists a two-letter region code.  Silently ignores invalid codes and
 * storage errors so a failed write never breaks the UI.
 */
export function saveRegion(region: string): void {
  if (!VALID_REGION.test(region)) return;
  try {
    localStorage.setItem(STORAGE_KEY, region);
  } catch {
    // ignore quota / security errors
  }
}

/**
 * Clears the stored preference so the component falls back to browser-locale
 * auto-detection.
 */
export function clearSavedRegion(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Returns a human-readable country name for a two-letter region code using
 * the browser's built-in Intl API.  Falls back to the raw code if the API is
 * unavailable.
 */
export function regionDisplayName(region: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(region) ?? region;
  } catch {
    return region;
  }
}

// ---------------------------------------------------------------------------
// TMDB-supported regions
// ---------------------------------------------------------------------------
// This list contains the regions that TMDB's /watch/providers API actually
// covers (as of the TMDB docs).  Including unsupported codes would produce
// empty results without explanation, which is worse than not offering them.
// The list is intentionally practical rather than exhaustive — every entry
// here has real TMDB coverage.
// ---------------------------------------------------------------------------

export interface RegionOption {
  code: string; // ISO 3166-1 alpha-2
  name: string; // English display name
}

export const TMDB_REGIONS: RegionOption[] = [
  { code: "AE", name: "United Arab Emirates" },
  { code: "AR", name: "Argentina" },
  { code: "AT", name: "Austria" },
  { code: "AU", name: "Australia" },
  { code: "BE", name: "Belgium" },
  { code: "BO", name: "Bolivia" },
  { code: "BR", name: "Brazil" },
  { code: "CA", name: "Canada" },
  { code: "CH", name: "Switzerland" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "CR", name: "Costa Rica" },
  { code: "CZ", name: "Czech Republic" },
  { code: "DE", name: "Germany" },
  { code: "DK", name: "Denmark" },
  { code: "EC", name: "Ecuador" },
  { code: "EG", name: "Egypt" },
  { code: "ES", name: "Spain" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "GB", name: "United Kingdom" },
  { code: "GH", name: "Ghana" },
  { code: "GT", name: "Guatemala" },
  { code: "HK", name: "Hong Kong" },
  { code: "HN", name: "Honduras" },
  { code: "HU", name: "Hungary" },
  { code: "ID", name: "Indonesia" },
  { code: "IE", name: "Ireland" },
  { code: "IN", name: "India" },
  { code: "IT", name: "Italy" },
  { code: "JP", name: "Japan" },
  { code: "KE", name: "Kenya" },
  { code: "KR", name: "South Korea" },
  { code: "MX", name: "Mexico" },
  { code: "MY", name: "Malaysia" },
  { code: "NG", name: "Nigeria" },
  { code: "NL", name: "Netherlands" },
  { code: "NO", name: "Norway" },
  { code: "NZ", name: "New Zealand" },
  { code: "PA", name: "Panama" },
  { code: "PE", name: "Peru" },
  { code: "PH", name: "Philippines" },
  { code: "PK", name: "Pakistan" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "PY", name: "Paraguay" },
  { code: "RO", name: "Romania" },
  { code: "RU", name: "Russia" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "SE", name: "Sweden" },
  { code: "SG", name: "Singapore" },
  { code: "SK", name: "Slovakia" },
  { code: "SV", name: "El Salvador" },
  { code: "TH", name: "Thailand" },
  { code: "TR", name: "Turkey" },
  { code: "TW", name: "Taiwan" },
  { code: "TZ", name: "Tanzania" },
  { code: "UA", name: "Ukraine" },
  { code: "UG", name: "Uganda" },
  { code: "US", name: "United States" },
  { code: "UY", name: "Uruguay" },
  { code: "VE", name: "Venezuela" },
  { code: "ZA", name: "South Africa" },
  { code: "ZM", name: "Zambia" },
  { code: "ZW", name: "Zimbabwe" },
];