// src/components/WhereToWatch.tsx
//
// Task 43 — "Where to Watch" real external availability. Fetches real TMDB
// watch-provider data through our own server (never calls TMDB directly
// from the client — see server.ts's /api/movies/:id/providers route and
// getTmdbKey()). Purely informational: provider badges are not clickable
// buttons, since TMDB does not supply a reliable per-provider deep link —
// only a single aggregate attribution link to TMDB's own watch page, which
// is what "View more options on TMDB" below points to when present. This
// section never implies playback happens inside Movies App.
import { useEffect, useState } from "react";
import { Tv, ShoppingCart, Clapperboard, ExternalLink, Globe2 } from "lucide-react";
import { dedupedFetch } from "../lib/requestDedup";

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

// Best-effort region guess from the browser's own locale (e.g. "en-GB" →
// "GB"). This is a sensible, zero-config default — not a real region
// preference system — and is passed as an explicit ?region= query param so
// a future per-user setting could override it without changing the API.
function guessRegion(): string {
  try {
    const locale = navigator.language || "en-US";
    const parts = locale.split("-");
    const region = parts[1]?.toUpperCase();
    return region && /^[A-Z]{2}$/.test(region) ? region : "US";
  } catch {
    return "US";
  }
}

function regionDisplayName(region: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(region) ?? region;
  } catch {
    return region;
  }
}

function ProviderBadge({ provider }: { provider: WatchProviderEntry }) {
  return (
    <div
      className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-2.5 py-2 pr-3"
      title={provider.name}
    >
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
          a provider (Task 6). */}
      <span className="text-xs font-semibold text-neutral-200 whitespace-nowrap">{provider.name}</span>
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

export default function WhereToWatch({ movieId }: WhereToWatchProps) {
  const [data, setData] = useState<WatchProvidersResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setData(null);

    const region = guessRegion();
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
  }, [movieId]);

  const hasAnyProviders = !!data && (data.streaming.length > 0 || data.rent.length > 0 || data.buy.length > 0);

  return (
    <section
      aria-labelledby="where-to-watch-heading"
      className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 backdrop-blur-xl shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)]"
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 id="where-to-watch-heading" className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
          <Tv className="h-4 w-4 text-neutral-500" aria-hidden="true" />
          Where to Watch
        </h3>
        {data && (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-neutral-500" title={`Availability shown for ${regionDisplayName(data.region)}`}>
            <Globe2 className="h-3 w-3" aria-hidden="true" />
            {regionDisplayName(data.region)}
          </span>
        )}
      </div>

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
            No streaming, rental, or purchase information is currently available for this title in your region.
          </p>
        ) : (
          <div className="space-y-4">
            <ProviderCategory icon={Tv} label="Streaming" providers={data!.streaming} />
            <ProviderCategory icon={Clapperboard} label="Rent" providers={data!.rent} />
            <ProviderCategory icon={ShoppingCart} label="Buy" providers={data!.buy} />
          </div>
        )}
      </div>

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