import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import WhereToWatch from "./WhereToWatch";

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

describe("WhereToWatch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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