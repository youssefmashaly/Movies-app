import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Without vitest's `globals: true` (intentionally not enabled — test files
// import describe/it/expect explicitly instead), @testing-library/react's
// own auto-cleanup can't detect a global afterEach to hook into, so it
// silently never runs. Registering it explicitly here is the standard,
// documented fix and guarantees every test starts with a clean DOM.
afterEach(() => {
  cleanup();
});

// Root-cause fix for "localStorage.removeItem is not a function" in CI/local
// runs on newer Node versions: Node 22+ ships an experimental native
// `localStorage`/`sessionStorage` global of its own, separate from jsdom's.
// Depending on the Node version invoking the test runner, that native
// global can end up shadowing jsdom's — so code referencing the bare
// `localStorage` identifier (not `window.localStorage`) resolves to Node's
// own partial experimental object instead of jsdom's complete Storage
// implementation, which is missing (or only partially implements) methods
// like removeItem. This isn't a Navbar bug or a Vitest config regression —
// it's an environment mismatch between Node's own global and jsdom's.
//
// Fixed at the source, once, here — rather than patched around per test
// file or by requiring a NODE_OPTIONS flag be remembered on every invocation
// — by forcing the global to always point at a complete, correct Storage
// implementation. We first try jsdom's own window.localStorage (the real
// implementation this environment is supposed to provide); if that itself
// is ever missing a method for any reason, the fallback below installs a
// small, fully spec-compliant in-memory Storage implementation instead.
function createFullStorageMock(): Storage {
  let store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store = new Map<string, string>();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

function ensureFullStorage(candidate: Storage | undefined | null): Storage {
  const requiredMethods = ["getItem", "setItem", "removeItem", "clear", "key"] as const;
  const isComplete =
    !!candidate &&
    requiredMethods.every((m) => typeof (candidate as unknown as Record<string, unknown>)[m] === "function") &&
    typeof candidate.length === "number";
  return isComplete ? (candidate as Storage) : createFullStorageMock();
}

const realLocalStorage = ensureFullStorage(typeof window !== "undefined" ? window.localStorage : undefined);
const realSessionStorage = ensureFullStorage(typeof window !== "undefined" ? window.sessionStorage : undefined);

for (const target of [globalThis, window] as const) {
  Object.defineProperty(target, "localStorage", {
    value: realLocalStorage,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(target, "sessionStorage", {
    value: realSessionStorage,
    writable: true,
    configurable: true,
  });
}

if (typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;
}

if (typeof window.IntersectionObserver !== "function") {
  class MockIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  // @ts-expect-error — jsdom has no real IntersectionObserver
  window.IntersectionObserver = MockIntersectionObserver;
}

if (typeof window.ResizeObserver !== "function") {
  class MockResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = MockResizeObserver;
}

if (typeof window.HTMLElement.prototype.scrollIntoView !== "function") {
  window.HTMLElement.prototype.scrollIntoView = () => {};
}