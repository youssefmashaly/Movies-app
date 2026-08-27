// src/components/WhereToWatch.test.tsx
//
// Phase 43 — initial WhereToWatch tests.
// Phase 44 — extended to cover region-selection and persistence behaviour.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WhereToWatch from "./WhereToWatch";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetchOnce(body: unknown, ok = true) {
  const makeResponse = () => ({
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
    clone() {
      return makeResponse();
    },
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeResponse()));
}

function makeFetchSpy(bodies: Record<string, unknown>) {
  // Returns different bodies keyed by the region query-param so tests can
  // verify the correct URL was requested after a region change.
  const spy = vi.fn().mockImplementation((url: string) => {
    const urlObj = new URL(url, "http://localhost");
    const region = urlObj.searchParams.get("region") ?? "US";
    const body = bodies[region] ?? { region, link: null, streaming: [], rent: [], buy: [] };
    const makeResponse = () => ({
      ok: true,
      status: 200,
      json: async () => body,
      clone() { return makeResponse(); },
    });
    return Promise.resolve(makeResponse());
  });
  vi.stubGlobal("fetch", spy);
  return spy;
}

const STORAGE_KEY = "movieapp:wtw-region";

// ---------------------------------------------------------------------------
// Phase 43 — existing behaviour (must not regress)
// ---------------------------------------------------------------------------

describe("WhereToWatch — core behaviour (Phase 43)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("shows a loading state before the request resolves", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {}))); // never resolves
    render(<WhereToWatch movieId="test-loading" />);
    expect(screen.getByRole("status", { name: /loading availability/i })).toBeInTheDocument();
  });

  it("groups providers into Streaming, Rent, and Buy sections", async () => {
    mockFetchOnce({
      region: "US",
      link: "https://www.themoviedb.org/movie/1-title/watch",
      streaming: [{ id: 8, name: "Netflix", logoUrl: null }],
      rent: [{ id: 2, name: "Apple TV", logoUrl: null }],
      buy: [{ id: 2, name: "Apple TV", logoUrl: null }],
    });

    render(<WhereToWatch movieId="test-grouping" />);

    await waitFor(() => expect(screen.getByText("Netflix")).toBeInTheDocument());
    expect(screen.getByText("Streaming")).toBeInTheDocument();
    expect(screen.getByText("Rent")).toBeInTheDocument();
    expect(screen.getByText("Buy")).toBeInTheDocument();
  });

  it("does not render empty categories", async () => {
    mockFetchOnce({
      region: "US",
      link: null,
      streaming: [{ id: 8, name: "Netflix", logoUrl: null }],
      rent: [],
      buy: [],
    });

    render(<WhereToWatch movieId="test-empty-categories" />);

    await waitFor(() => expect(screen.getByText("Netflix")).toBeInTheDocument());
    expect(screen.getByText("Streaming")).toBeInTheDocument();
    expect(screen.queryByText("Rent")).not.toBeInTheDocument();
    expect(screen.queryByText("Buy")).not.toBeInTheDocument();
  });

  it("shows an honest empty state when no provider data exists for the region", async () => {
    mockFetchOnce({ region: "US", link: null, streaming: [], rent: [], buy: [] });

    render(<WhereToWatch movieId="test-no-data" />);

    await waitFor(() =>
      expect(
        screen.getByText(/no streaming, rental, or purchase information is currently available/i)
      ).toBeInTheDocument()
    );
  });

  it("shows a graceful error state on request failure, without crashing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    render(<WhereToWatch movieId="test-error" />);

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent(/unable to load availability/i);
  });

  it("only shows the TMDB attribution link when the API actually supplies one", async () => {
    mockFetchOnce({
      region: "US",
      link: null,
      streaming: [{ id: 8, name: "Netflix", logoUrl: null }],
      rent: [],
      buy: [],
    });

    render(<WhereToWatch movieId="test-no-link" />);

    await waitFor(() => expect(screen.getByText("Netflix")).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: /view more options on tmdb/i })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Phase 44 — region selection
// ---------------------------------------------------------------------------

describe("WhereToWatch — region selector (Phase 44)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("renders an accessible region selector with a visible label", async () => {
    mockFetchOnce({ region: "US", link: null, streaming: [], rent: [], buy: [] });
    render(<WhereToWatch movieId="test-selector-label" />);
    // The <select> must have an accessible label (either via aria-label or
    // an associated <label> with .sr-only).
    const select = screen.getByRole("combobox", { name: /availability region/i });
    expect(select).toBeInTheDocument();
  });

  it("defaults to auto-detected region (browser locale or US) when no preference is saved", async () => {
    // No localStorage entry set — should fall back cleanly without throwing.
    const spy = makeFetchSpy({ US: { region: "US", link: null, streaming: [], rent: [], buy: [] } });
    render(<WhereToWatch movieId="test-default-region" />);

    await waitFor(() => {
      // The fetch should have been called — with some region (US or detected)
      expect(spy).toHaveBeenCalled();
      const calledUrl: string = spy.mock.calls[0][0];
      expect(calledUrl).toMatch(/region=[A-Z]{2}/);
    });
  });

  it("uses the saved region preference from localStorage on mount", async () => {
    localStorage.setItem(STORAGE_KEY, "GB");
    const spy = makeFetchSpy({
      GB: { region: "GB", link: null, streaming: [{ id: 8, name: "BBC iPlayer", logoUrl: null }], rent: [], buy: [] },
    });

    render(<WhereToWatch movieId="test-saved-region" />);

    await waitFor(() => {
      // Must request GB, not US — dedupedFetch passes url only, no second arg
      const calledUrls: string[] = spy.mock.calls.map((c: unknown[]) => c[0] as string);
      expect(calledUrls.some((url) => url.includes("region=GB"))).toBe(true);
    });
    await waitFor(() => expect(screen.getByText("BBC iPlayer")).toBeInTheDocument());
  });

  it("fetches new provider data when the user changes region", async () => {
    const spy = makeFetchSpy({
      US: { region: "US", link: null, streaming: [{ id: 8, name: "Netflix US", logoUrl: null }], rent: [], buy: [] },
      DE: { region: "DE", link: null, streaming: [{ id: 1796, name: "Netflix DE", logoUrl: null }], rent: [], buy: [] },
    });

    render(<WhereToWatch movieId="test-region-change" />);

    // Wait for initial load
    await waitFor(() => expect(screen.getByText("Netflix US")).toBeInTheDocument());

    // Change region to Germany
    const select = screen.getByRole("combobox", { name: /availability region/i });
    await userEvent.selectOptions(select, "DE");

    // A new request for DE must be made
    await waitFor(() => {
      const calls: string[] = spy.mock.calls.map((c) => c[0] as string);
      expect(calls.some((url) => url.includes("region=DE"))).toBe(true);
    });

    // German provider must appear
    await waitFor(() => expect(screen.getByText("Netflix DE")).toBeInTheDocument());
    expect(screen.queryByText("Netflix US")).not.toBeInTheDocument();
  });

  it("persists the selected region to localStorage after a change", async () => {
    makeFetchSpy({
      US: { region: "US", link: null, streaming: [], rent: [], buy: [] },
      FR: { region: "FR", link: null, streaming: [], rent: [], buy: [] },
    });

    render(<WhereToWatch movieId="test-persist" />);
    await waitFor(() => screen.getByRole("combobox", { name: /availability region/i }));

    const select = screen.getByRole("combobox", { name: /availability region/i });
    await userEvent.selectOptions(select, "FR");

    expect(localStorage.getItem(STORAGE_KEY)).toBe("FR");
  });

  it("shows the auto-detected region notice when no preference is saved", async () => {
    // No localStorage entry
    mockFetchOnce({ region: "US", link: null, streaming: [], rent: [], buy: [] });
    render(<WhereToWatch movieId="test-auto-notice" />);

    // The notice text should be visible
    await waitFor(() =>
      expect(
        screen.getByText(/region auto-detected from your browser/i)
      ).toBeInTheDocument()
    );
  });

  it("does not show the auto-detected notice when a region is saved", async () => {
    localStorage.setItem(STORAGE_KEY, "JP");
    mockFetchOnce({ region: "JP", link: null, streaming: [], rent: [], buy: [] });
    render(<WhereToWatch movieId="test-no-auto-notice" />);

    await waitFor(() =>
      // Loading skeleton disappears
      expect(screen.queryByRole("status", { name: /loading/i })).not.toBeInTheDocument()
    );
    expect(
      screen.queryByText(/region auto-detected from your browser/i)
    ).not.toBeInTheDocument();
  });

  it("does not display fake/fabricated provider names (only TMDB-supplied data)", async () => {
    // The component should only render what the API returns — test verifies
    // no hardcoded fallback provider names appear when the API returns empty.
    mockFetchOnce({ region: "ZZ", link: null, streaming: [], rent: [], buy: [] });
    render(<WhereToWatch movieId="test-no-fabrication" />);

    await waitFor(() =>
      expect(
        screen.getByText(/no streaming, rental, or purchase information/i)
      ).toBeInTheDocument()
    );
    // No provider badges should appear
    expect(screen.queryByText("Netflix")).not.toBeInTheDocument();
    expect(screen.queryByText("Amazon")).not.toBeInTheDocument();
  });

  it("shows a loading state immediately after a region change (no stale data)", async () => {
    let resolveSecond!: (v: unknown) => void;
    const secondPending = new Promise((res) => { resolveSecond = res; });

    let callCount = 0;
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => {
      callCount++;
      const body = callCount === 1
        ? { region: "US", link: null, streaming: [{ id: 8, name: "Netflix", logoUrl: null }], rent: [], buy: [] }
        : secondPending; // second call never resolves → stays in loading
      const makeResponse = () => ({
        ok: true,
        status: 200,
        json: async () => body,
        clone() { return makeResponse(); },
      });
      if (callCount === 1) return Promise.resolve(makeResponse());
      // For the second call return a promise that stays pending so we can
      // assert the loading state is shown again
      return secondPending.then(() => makeResponse());
    }));

    render(<WhereToWatch movieId="test-stale-clear" />);

    // Wait for first load
    await waitFor(() => expect(screen.getByText("Netflix")).toBeInTheDocument());

    // Change region — second fetch never resolves → loading state appears
    const select = screen.getByRole("combobox", { name: /availability region/i });
    await userEvent.selectOptions(select, "DE");

    // Netflix badge (from the US response) should be gone immediately
    expect(screen.queryByText("Netflix")).not.toBeInTheDocument();
    // Loading skeleton should appear
    expect(screen.getByRole("status", { name: /loading availability/i })).toBeInTheDocument();
  });
});