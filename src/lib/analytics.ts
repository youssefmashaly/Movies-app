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

export function reportError(error: Error, context?: Record<string, unknown>) {
  send({ type: "error", message: error.message, stack: error.stack, context });
}

export function initGlobalErrorCapture() {
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    console.error("Unhandled promise rejection:", reason);
    reportError(reason, { source: "unhandledrejection" });
  });
}

export function initPerformanceMetrics() {
  if (typeof PerformanceObserver === "undefined") return;

  try {
    let clsScore = 0;
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as any[]) {
        if (!entry.hadRecentInput) clsScore += entry.value;
      }
    });
    clsObserver.observe({ type: "layout-shift", buffered: true });

    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1] as any;
      if (!last) return;
      const metric = { lcpMs: Math.round(last.startTime), clsScore: Number(clsScore.toFixed(3)) };
      if (import.meta.env.DEV) {
        console.log(`%c⚡ Perf: LCP ${metric.lcpMs}ms · CLS ${metric.clsScore}`, "color: #6366f1;");
      }
      send({ type: "performance", ...metric });
    });
    lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
  } catch {
    // PerformanceObserver entry types vary by browser; never let this break the app.
  }
}

const REQUIRED_ENV_VARS = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_PROJECT_ID",
] as const;

export function validateEnv() {
  if (!import.meta.env.DEV) return;
  const missing = REQUIRED_ENV_VARS.filter((key) => !import.meta.env[key]);
  if (missing.length > 0) {
    console.warn(
      `%c⚠ Missing required environment variables: ${missing.join(", ")}\n` +
      `Watchlists, ratings, reviews, and follows will fail without these.\n` +
      `Copy .env.example to .env and fill them in.`,
      "color: #f59e0b; font-weight: bold;"
    );
  } else {
    console.log("%c✓ Environment configuration OK", "color: #10b981; font-weight: bold;");
  }
}

export function startTiming(label: string) {
  if (!import.meta.env.DEV || typeof performance === "undefined") return;
  performance.mark(`${label}-start`);
}

export function endTiming(label: string) {
  if (!import.meta.env.DEV || typeof performance === "undefined") return;
  try {
    performance.mark(`${label}-end`);
    performance.measure(label, `${label}-start`, `${label}-end`);
    const [entry] = performance.getEntriesByName(label);
    if (entry) {
      console.log(`%c⏱ ${label}: ${entry.duration.toFixed(1)}ms`, "color: #22d3ee;");
    }
    performance.clearMarks(`${label}-start`);
    performance.clearMarks(`${label}-end`);
    performance.clearMeasures(label);
  } catch {
    // Missing start mark (e.g. HMR reload mid-timing) — never break the app over a metric.
  }
}

export async function timeAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  startTiming(label);
  try {
    return await fn();
  } finally {
    endTiming(label);
  }
}

let appStartupMs: number | null = null;
export function recordStartupTiming() {
  if (typeof performance === "undefined") return;
  appStartupMs = performance.now();
}
export function getStartupTiming() {
  return appStartupMs;
}