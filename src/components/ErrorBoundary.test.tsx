import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ErrorBoundary from "./ErrorBoundary";

function Bomb() {
  throw new Error("Kaboom");
  // eslint-disable-next-line no-unreachable
  return null;
}

describe("ErrorBoundary", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // React logs caught render errors to console.error too (expected,
    // React's own dev-mode behavior) — silence it so the test output
    // isn't misleading, while still asserting our own handler ran below.
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("renders children normally when nothing throws", () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>
    );
    expect(screen.getByText("All good")).toBeInTheDocument();
  });

  it("renders the fallback UI instead of crashing when a child throws during render", () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /return to homepage/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /refresh page/i })).toBeInTheDocument();
  });

  it("logs the caught error via console.error", () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );

    const loggedOurMessage = consoleErrorSpy.mock.calls.some(
      (call) => call[0] === "Unhandled render error caught by ErrorBoundary:"
    );
    expect(loggedOurMessage).toBe(true);
  });

  it("'Refresh Page' calls window.location.reload", async () => {
    const reloadSpy = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload: reloadSpy });
    const user = userEvent.setup();

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );
    await user.click(screen.getByRole("button", { name: /refresh page/i }));

    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });
});