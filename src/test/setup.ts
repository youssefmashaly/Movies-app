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