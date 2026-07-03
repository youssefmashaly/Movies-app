// Minimal, optional analytics + monitoring shim. Zero third-party
// dependencies, zero bundle weight beyond this file, zero network calls
// unless explicitly enabled via env vars. Uses navigator.sendBeacon — the
// browser's own fire-and-forget primitive, non-blocking by design.
//
// Disabled by default. To enable: set VITE_ANALYTICS_ENABLED=true and
// VITE_ANALYTICS_ENDPOINT to your own collection endpoint (self-hosted,
// Supabase Edge Function, or any HTTP endpoint that accepts POST/beacon).

const ENABLED = import.meta.env.VITE_ANALYTICS_ENABLED === "true";
const ENDPOINT = import.meta.env.VITE_ANALYTICS_ENDPOINT || "";
const READY = ENABLED && Boolean(ENDPOINT);

function send(payload: Record<string, unknown>) {
  if (!READY) return;
  try {
    const body = JSON.stringify({ ...payload, ts: Date.now() });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, body);
    } else {
      // Fallback for environments without sendBeacon support; still fire-and-forget.
      fetch(ENDPOINT, { method: "POST", body, keepalive: true }).catch(() => {});
    }
  } catch {
    // Analytics must never break the app.
  }
}

export function trackPageView(page: string) {
  send({ type: "pageview", page });
}

export function trackEvent(name: string, data?: Record<string, unknown>) {
  send({ type: "event", name, data });
}

// Error monitoring hook — called from ErrorBoundary. No-op unless configured;
// swap the body for a real provider (Sentry, etc.) later without touching callers.
export function reportError(error: Error, context?: Record<string, unknown>) {
  send({ type: "error", message: error.message, stack: error.stack, context });
}