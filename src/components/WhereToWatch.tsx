// src/components/WhereToWatch.tsx
//
// Phase 43 — "Where to Watch" real external availability. Fetches real TMDB
// watch-provider data through our own server (never calls TMDB directly
// from the client — see server.ts's /api/movies/:id/providers route and
// getTmdbKey()). This section never implies playback happens inside Movies
// App.
//
// Phase 44 — added a user-selectable availability region. The region
// selector is rendered inline in the section header. The preference is
// persisted to localStorage via regionPreference.ts (same pattern as
// ThemeContext) and works identically for authenticated and logged-out users.
//
// Phase 61 — provider badges are now clickable, opening that provider's own
// website in a new tab. Honest limitation: TMDB does not supply a reliable
// per-provider, per-movie deep link (only a single aggregate attribution
// link to TMDB's own watch page, used below for "View more options on
// TMDB") — so a badge links to the provider's general homepage, not
// directly to this specific movie's page on that service. PROVIDER_HOMEPAGES
// below is a small static allow-list of well-known, stable brand domains;
// any provider not in it (regional/niche services TMDB returns) simply
// renders as a plain, non-clickable badge exactly as before, rather than
// guessing at a URL.
import { useEffect, useRef, useState } from "react";
import { Tv, ShoppingCart, Clapperboard, ExternalLink, Globe2, ChevronDown } from "lucide-react";
import { dedupedFetch } from "../lib/requestDedup";
import {
  getRegion,
  getSavedRegion,
  saveRegion,
  regionDisplayName,
  TMDB_REGIONS,
} from "../lib/regionPreference";

// Phase 61 — known-good homepages for well-known providers, keyed by the
// exact `provider_name` string TMDB returns. Deliberately a static allow-list
// rather than a guessed/derived URL — an unmapped provider just stays
// non-clickable instead of risking a wrong link.
const PROVIDER_HOMEPAGES: Record<string, string> = {
  "Netflix": "https://www.netflix.com",
  "Disney Plus": "https://www.disneyplus.com",
  "Amazon Prime Video": "https://www.primevideo.com",
  "Amazon Video": "https://www.primevideo.com",
  "Apple TV": "https://tv.apple.com",
  "Apple TV+": "https://tv.apple.com",
  "Apple TV Store": "https://tv.apple.com",
  "Max": "https://www.max.com",
  "HBO Max": "https://www.max.com",
  "Hulu": "https://www.hulu.com",
  "Paramount Plus": "https://www.paramountplus.com",
  "Peacock": "https://www.peacocktv.com",
  "Google Play Movies": "https://play.google.com/store/movies",
  "Rakuten TV": "https://www.rakuten.tv",
  "YouTube": "https://www.youtube.com/movies",
};

interface WatchProviderEntry {
  id: number;
  name: string;
  logoUrl: string | null;
}

interface WatchProvidersResponse {
  region: string;
  link: string | null;
  streaming: WatchProviderEntry[];
  rent: WatchProviderEntry[];
  buy: WatchProviderEntry[];
}

interface WhereToWatchProps {
  movieId: string;
}

function ProviderBadge({ provider }: { provider: WatchProviderEntry }) {
  const homepage = PROVIDER_HOMEPAGES[provider.name];

  const content = (
    <>
      {provider.logoUrl ? (
        <img
          src={provider.logoUrl}
          alt=""
          aria-hidden="true"
          className="h-7 w-7 rounded-md object-cover flex-shrink-0"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="h-7 w-7 rounded-md bg-neutral-800 flex items-center justify-center flex-shrink-0" aria-hidden="true">
          <Clapperboard className="h-3.5 w-3.5 text-neutral-500" />
        </div>
      )}
      {/* Provider name is always shown as real text, not just in the logo's
          alt attribute — logos alone shouldn't be the only way to identify
          a provider. */}
      <span className="text-xs font-semibold text-neutral-200 whitespace-nowrap">{provider.name}</span>
    </>
  );

  if (homepage) {
    return (
      
        href={homepage}
        target="_blank"
        rel="noopener noreferrer"
        title={`Open ${provider.name} (opens in a new tab)`}
        className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-2.5 py-2 pr-3 transition-colors hover:border-white/[0.16] hover:bg-white/[0.06] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
      >
        {content}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  }

  return (
    <div
      className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-2.5 py-2 pr-3"
      title={provider.name}
    >
      {content}
    </div>
  );
}

function ProviderCategory({ icon: Icon, label, providers }: { icon: React.ElementType; label: string; providers: WatchProviderEntry[] }) {
  if (providers.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="h-3.5 w-3.5 text-neutral-500" aria-hidden="true" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">{label}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {providers.map((p) => (
          <ProviderBadge key={p.id} provider={p} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Region selector — compact inline <select> styled to match glass-morphism.
// ---------------------------------------------------------------------------

interface RegionSelectorProps {
  value: string;
  onChange: (region: string) => void;
}

function RegionSelector({ value, onChange }: RegionSelectorProps) {
  const selectRef = useRef<HTMLSelectElement>(null);

  return (
    <div className="relative flex items-center">
      {/* Visible label for screen readers — visually expressed by the globe
          icon and the position within the "Where to Watch" section header. */}
      <label
        htmlFor="wtw-region-select"
        className="sr-only"
      >
        Availability region
      </label>

      <Globe2
        className="absolute left-2 h-3 w-3 text-neutral-500 pointer-events-none"
        aria-hidden="true"
      />

      <select
        id="wtw-region-select"
        ref={selectRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // Tailwind doesn't have great cross-browser <select> support; we
        // use appearance-none + inline style for the right padding so the
        // ChevronDown icon doesn't overlap the text.
        className={[
          "appearance-none",
          "pl-6 pr-5 py-1",
          "text-[11px] font-semibold text-neutral-300",
          "bg-white/[0.04] border border-white/[0.08]",
          "rounded-lg",
          "cursor-pointer",
          "transition-colors",
          "hover:border-white/[0.16] hover:bg-white/[0.07]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500",
          // Dark-mode-safe: <select> background on light theme
          "[color-scheme:dark]",
        ].join(" ")}
        aria-label="Availability region"
      >
        {TMDB_REGIONS.map((r) => (
          <option key={r.code} value={r.code} style={{ backgroundColor: "#171717", color: "#ffffff" }}>
            {r.name}
          </option>
        ))}
      </select>

      <ChevronDown
        className="absolute right-1.5 h-2.5 w-2.5 text-neutral-500 pointer-events-none"
        aria-hidden="true"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function WhereToWatch({ movieId }: WhereToWatchProps) {
  // Initialise from persisted preference (or browser locale fallback).
  const [region, setRegionState] = useState<string>(() => getRegion());
  const [data, setData] = useState<WatchProvidersResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  // Whether the current region was explicitly saved or is auto-detected.
  // Used only to know the initial value accurately on mount — updated when
  // the user makes a selection.
  const [isExplicit, setIsExplicit] = useState<boolean>(() => getSavedRegion() !== undefined);

  // Re-fetch whenever movieId or region changes.
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setData(null);

    dedupedFetch(`/api/movies/${movieId}/providers?region=${region}`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const json = await res.json();
        setData(json);
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to load watch providers:", err);
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [movieId, region]);

  function handleRegionChange(newRegion: string) {
    saveRegion(newRegion);
    setIsExplicit(true);
    setRegionState(newRegion);
  }

  const hasAnyProviders = !!data && (data.streaming.length > 0 || data.rent.length > 0 || data.buy.length > 0);

  return (
    <section
      aria-labelledby="where-to-watch-heading"
      className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 backdrop-blur-xl shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)]"
    >
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h3
          id="where-to-watch-heading"
          className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2"
        >
          <Tv className="h-4 w-4 text-neutral-500" aria-hidden="true" />
          Where to Watch
        </h3>

        {/* Region selector — always visible, not gated on data being loaded */}
        <RegionSelector value={region} onChange={handleRegionChange} />
      </div>

      {/* Auto-detected notice — shown only when no explicit preference has
          been saved, so users understand where the default comes from and
          that they can change it. */}
      {!isExplicit && (
        <p className="text-[10px] text-neutral-600 mb-3 -mt-1">
          Region auto-detected from your browser. Use the selector above to change it.
        </p>
      )}

      {/* ── PROVIDER LIST ── */}
      <div className="min-h-[72px]">
        {status === "loading" ? (
          <div className="space-y-3" role="status" aria-live="polite" aria-label="Loading availability">
            <div className="h-3 w-24 rounded bg-neutral-800 animate-pulse" />
            <div className="flex gap-2">
              <div className="h-9 w-24 rounded-xl bg-neutral-800 animate-pulse" />
              <div className="h-9 w-24 rounded-xl bg-neutral-800 animate-pulse" />
            </div>
          </div>
        ) : status === "error" ? (
          <p className="text-xs text-neutral-500" role="alert">
            Unable to load availability right now. Please try again later.
          </p>
        ) : !hasAnyProviders ? (
          <p className="text-xs text-neutral-500">
            No streaming, rental, or purchase information is currently available for this title in {regionDisplayName(region)}.
          </p>
        ) : (
          <div className="space-y-4">
            <ProviderCategory icon={Tv} label="Streaming" providers={data!.streaming} />
            <ProviderCategory icon={Clapperboard} label="Rent" providers={data!.rent} />
            <ProviderCategory icon={ShoppingCart} label="Buy" providers={data!.buy} />
          </div>
        )}
      </div>

      {/* ── FOOTER ── */}
      <p className="text-[10px] text-neutral-600 mt-5 pt-4 border-t border-white/[0.05] leading-relaxed">
        Availability provided by TMDB and shown for informational purposes only — these are external services, not part of Movies App. Streaming options may vary by region and change over time.
        {data?.link && (
          <>
            {" "}
            <a
              href={data.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded"
            >
              View more options on TMDB
              <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </>
        )}
      </p>
    </section>
  );
}