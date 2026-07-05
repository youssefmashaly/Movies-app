// Development-only diagnostics. Never imported or exposed in a production
// build path beyond this guarded module — every function here is a no-op
// (or returns nothing useful) when import.meta.env.DEV is false.
import { getDedupStats } from "./requestDedup";
import { getPreloadStats } from "./imagePreload";
import { getPrefetchStats } from "./prefetch";
import { getStartupTiming } from "./analytics";

export async function getDiagnostics() {
  if (!import.meta.env.DEV) return null;

  let aiCacheSize: number | "unavailable" = "unavailable";
  try {
    const res = await fetch("/api/_diagnostics/cache");
    if (res.ok) {
      const data = await res.json();
      aiCacheSize = data.size ?? "unavailable";
    }
  } catch {
    // Dev server not running the API, or route not reachable — non-fatal.
  }

  return {
    requestDedup: getDedupStats(),
    imagePreload: getPreloadStats(),
    moviePrefetch: getPrefetchStats(),
    aiRecommendationCache: { size: aiCacheSize },
    startupMs: getStartupTiming(),
  };
}

export async function logDiagnostics() {
  if (!import.meta.env.DEV) return;
  const stats = await getDiagnostics();
  if (stats) console.table(stats);
}

if (import.meta.env.DEV) {
  (window as any).__diagnostics = logDiagnostics;
}