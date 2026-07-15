import { describe, it, expect, vi, afterEach } from "vitest";
import {
  timeAsync,
  initGlobalErrorCapture,
  trackEvent,
  trackPageView,
  reportError,
  recordStartupTiming,
  getStartupTiming,
} from "./analytics";

describe("timeAsync", () => {
  it("returns the wrapped function's resolved value", async () => {
    const result = await timeAsync("test-label", async () => 42);
    expect(result).toBe(42);
  });

  it("propagates a rejection from the wrapped function", async () => {
    await expect(
      timeAsync("test-label-error", async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");
  });

  it("still records timing (doesn't swallow the marks) even when the function throws", async () => {
    // Regression guard: startTiming/endTiming must run in a finally block,
    // not get skipped on the error path.
    const markSpy = vi.spyOn(performance, "mark");
    await expect(
      timeAsync("test-label-cleanup", async () => {
        throw new Error("fail");
      })
    ).rejects.toThrow();
    expect(markSpy).toHaveBeenCalled();
    markSpy.mockRestore();
  });
});

describe("recordStartupTiming / getStartupTiming", () => {
  it("records a numeric startup timestamp that getStartupTiming can read back", () => {
    recordStartupTiming();
    expect(getStartupTiming()).not.toBeNull();
    expect(typeof getStartupTiming()).toBe("number");
  });
});

describe("initGlobalErrorCapture", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers an unhandledrejection listener that logs and reports the error", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    initGlobalErrorCapture();

    const reason = new Error("unhandled boom");
    const event = new Event("unhandledrejection") as PromiseRejectionEvent;
    Object.defineProperty(event, "reason", { value: reason });
    window.dispatchEvent(event);

    expect(errorSpy).toHaveBeenCalledWith("Unhandled promise rejection:", reason);
  });
});

describe("send-gated functions (analytics disabled by default in tests)", () => {
  it("trackEvent/trackPageView/reportError never throw, even without analytics configured", () => {
    expect(() => trackEvent("test-event", { foo: "bar" })).not.toThrow();
    expect(() => trackPageView("/test")).not.toThrow();
    expect(() => reportError(new Error("test"))).not.toThrow();
  });
});