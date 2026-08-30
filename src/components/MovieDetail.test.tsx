// src/components/MovieDetail.test.tsx
//
// Phase 47 — focused tests for the Movie Detail reviews section: the
// genuine gaps found in the audit (missing error state, unbounded review
// rendering). Trailer, cast, and related-movies behavior were already
// correct and are intentionally not re-tested here beyond a couple of
// smoke checks, per the phase's "don't duplicate existing coverage" rule.

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MovieDetail from "./MovieDetail";
import { interstellar } from "../test/fixtures/movies";

vi.mock("../firebase", () => ({ auth: { currentUser: null } }));
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: null) => void) => {
    callback(null);
    return () => {};
  },
}));

vi.mock("../services/supabase/reviews", () => ({
  listMovieReviews: vi.fn(),
  getUserReview: vi.fn().mockResolvedValue({ data: null, error: null }),
  createReview: vi.fn(),
  updateReview: vi.fn(),
  deleteReview: vi.fn(),
}));

vi.mock("../services/supabase/ratings", () => ({
  setUserRating: vi.fn().mockResolvedValue({ data: null, error: null }),
  deleteRating: vi.fn().mockResolvedValue({ data: null, error: null }),
}));

// WhereToWatch does its own network calls (Phase 43/44) — stub it out so
// these tests only exercise MovieDetail's own logic.
vi.mock("./WhereToWatch", () => ({
  default: () => <div data-testid="where-to-watch-stub" />,
}));

import { listMovieReviews } from "../services/supabase/reviews";
const mockListReviews = listMovieReviews as ReturnType<typeof vi.fn>;

function makeReview(id: string, overrides: Partial<any> = {}) {
  return {
    id,
    movie_id: interstellar.id,
    user_id: `user-${id}`,
    rating: 8,
    comment: `Review text ${id}`,
    created_at: new Date(2024, 0, Number(id.replace(/\D/g, "")) || 1).toISOString(),
    profiles: { display_name: `Reviewer ${id}`, avatar_url: null },
    ...overrides,
  };
}

const noop = () => {};

describe("MovieDetail — reviews section (Phase 47)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading state while reviews are being fetched", () => {
    mockListReviews.mockReturnValue(new Promise(() => {}));
    render(
      <MovieDetail movie={interstellar} onBack={noop} onOpenAuth={noop} />
    );
    expect(screen.getByRole("status", { name: /loading reviews/i })).toBeInTheDocument();
  });

  it("shows an honest empty state when there are no reviews", async () => {
    mockListReviews.mockResolvedValue({ data: [], error: null });
    render(
      <MovieDetail movie={interstellar} onBack={noop} onOpenAuth={noop} />
    );
    await waitFor(() =>
      expect(screen.getByText(/no reviews yet/i)).toBeInTheDocument()
    );
  });

  it("shows a distinct error state (not the empty state) when reviews fail to load", async () => {
    mockListReviews.mockResolvedValue({ data: null, error: "Network unreachable" });
    render(
      <MovieDetail movie={interstellar} onBack={noop} onOpenAuth={noop} />
    );
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByText(/couldn't load reviews/i)).toBeInTheDocument();
    expect(screen.queryByText(/no reviews yet/i)).not.toBeInTheDocument();
  });

  it("retries loading reviews when Try again is clicked after an error", async () => {
    mockListReviews
      .mockResolvedValueOnce({ data: null, error: "Network unreachable" })
      .mockResolvedValueOnce({ data: [makeReview("r1")], error: null });

    render(
      <MovieDetail movie={interstellar} onBack={noop} onOpenAuth={noop} />
    );
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() =>
      expect(screen.getByText(/review text r1/i)).toBeInTheDocument()
    );
  });

  it("renders fetched reviews with rating and reviewer name", async () => {
    mockListReviews.mockResolvedValue({
      data: [makeReview("r1", { profiles: { display_name: "Alice", avatar_url: null } })],
      error: null,
    });
    render(
      <MovieDetail movie={interstellar} onBack={noop} onOpenAuth={noop} />
    );
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    expect(screen.getByText("8/10")).toBeInTheDocument();
  });

  it("initially renders only the first page of reviews and shows a Load more button", async () => {
    const many = Array.from({ length: 9 }, (_, i) => makeReview(`r${i + 1}`));
    mockListReviews.mockResolvedValue({ data: many, error: null });

    render(
      <MovieDetail movie={interstellar} onBack={noop} onOpenAuth={noop} />
    );

    await waitFor(() => expect(screen.getByText(/review text r1$/i)).toBeInTheDocument());

    // Only the first 6 should be rendered
    expect(screen.getByText(/review text r6$/i)).toBeInTheDocument();
    expect(screen.queryByText(/review text r7$/i)).not.toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /load 3 more reviews/i })
    ).toBeInTheDocument();
  });

  it("reveals additional reviews when Load more is clicked, without a new fetch", async () => {
    const many = Array.from({ length: 9 }, (_, i) => makeReview(`r${i + 1}`));
    mockListReviews.mockResolvedValue({ data: many, error: null });

    render(
      <MovieDetail movie={interstellar} onBack={noop} onOpenAuth={noop} />
    );

    await waitFor(() => expect(screen.getByText(/review text r1$/i)).toBeInTheDocument());
    expect(mockListReviews).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: /load \d+ more reviews/i }));

    await waitFor(() =>
      expect(screen.getByText(/review text r9$/i)).toBeInTheDocument()
    );
    // No additional network call — all reviews were already fetched.
    expect(mockListReviews).toHaveBeenCalledTimes(1);
    // Fewer than REVIEWS_PAGE_SIZE remain, so the button disappears.
    expect(screen.queryByRole("button", { name: /load \d+ more reviews/i })).not.toBeInTheDocument();
  });

  it("does not show a Load more button when review count is within the first page", async () => {
    mockListReviews.mockResolvedValue({
      data: [makeReview("r1"), makeReview("r2")],
      error: null,
    });
    render(
      <MovieDetail movie={interstellar} onBack={noop} onOpenAuth={noop} />
    );
    await waitFor(() => expect(screen.getByText(/review text r1$/i)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /load \d+ more reviews/i })).not.toBeInTheDocument();
  });
});

describe("MovieDetail — review sort control (Phase 51)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defaults to Newest, matching the server's own created_at DESC order", async () => {
    const data = [
      makeReview("old", { rating: 9, created_at: new Date(2024, 0, 1).toISOString() }),
      makeReview("new", { rating: 3, created_at: new Date(2024, 5, 1).toISOString() }),
    ];
    // listMovieReviews already returns newest-first from the server.
    mockListReviews.mockResolvedValue({ data: [data[1], data[0]], error: null });

    render(<MovieDetail movie={interstellar} onBack={noop} onOpenAuth={noop} />);
    await waitFor(() => expect(screen.getByText(/review text new$/i)).toBeInTheDocument());

    const select = screen.getByLabelText(/sort reviews/i) as HTMLSelectElement;
    expect(select.value).toBe("newest");

    const cards = screen.getAllByText(/review text (new|old)$/i);
    expect(cards[0]).toHaveTextContent("Review text new");
    expect(cards[1]).toHaveTextContent("Review text old");
  });

  it("re-sorts to Highest Rated without triggering another fetch", async () => {
    const data = [
      makeReview("low", { rating: 3, created_at: new Date(2024, 5, 1).toISOString() }),
      makeReview("high", { rating: 9, created_at: new Date(2024, 0, 1).toISOString() }),
    ];
    // Server returns newest-first: "low" (June) before "high" (January).
    mockListReviews.mockResolvedValue({ data, error: null });

    render(<MovieDetail movie={interstellar} onBack={noop} onOpenAuth={noop} />);
    await waitFor(() => expect(screen.getByText(/review text low$/i)).toBeInTheDocument());
    expect(mockListReviews).toHaveBeenCalledTimes(1);

    const select = screen.getByLabelText(/sort reviews/i);
    await userEvent.selectOptions(select, "highest");

    const cards = screen.getAllByText(/review text (low|high)$/i);
    expect(cards[0]).toHaveTextContent("Review text high");
    expect(cards[1]).toHaveTextContent("Review text low");

    // Purely client-side — no second network call.
    expect(mockListReviews).toHaveBeenCalledTimes(1);
  });

  it("resets the visible page to the first REVIEWS_PAGE_SIZE when the sort order changes", async () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      makeReview(`r${i + 1}`, { rating: i + 1, created_at: new Date(2024, 0, i + 1).toISOString() })
    );
    mockListReviews.mockResolvedValue({ data: many, error: null });

    render(<MovieDetail movie={interstellar} onBack={noop} onOpenAuth={noop} />);
    await waitFor(() => expect(screen.getByText(/review text r1$/i)).toBeInTheDocument());

    // Load everything into view first.
    await userEvent.click(screen.getByRole("button", { name: /load \d+ more reviews/i }));
    await waitFor(() => expect(screen.getByText(/review text r9$/i)).toBeInTheDocument());

    // Switching sort should return to a fresh first page, not keep all 9 visible.
    const select = screen.getByLabelText(/sort reviews/i);
    await userEvent.selectOptions(select, "highest");

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /load \d+ more reviews/i })).toBeInTheDocument()
    );
  });

  it("keeps sorting and pagination consistent — only 6 of the highest-rated reviews show initially", async () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      makeReview(`r${i + 1}`, { rating: i + 1, created_at: new Date(2024, 0, i + 1).toISOString() })
    );
    mockListReviews.mockResolvedValue({ data: many, error: null });

    render(<MovieDetail movie={interstellar} onBack={noop} onOpenAuth={noop} />);
    await waitFor(() => expect(screen.getByText(/review text r1$/i)).toBeInTheDocument());

    const select = screen.getByLabelText(/sort reviews/i);
    await userEvent.selectOptions(select, "highest");

    // Highest rated is r9 (rating 9) down to r4 (rating 4) for the first page of 6.
    await waitFor(() => expect(screen.getByText(/review text r9$/i)).toBeInTheDocument());
    expect(screen.getByText(/review text r4$/i)).toBeInTheDocument();
    expect(screen.queryByText(/review text r3$/i)).not.toBeInTheDocument();
  });

  it("does not show the sort control when there are no reviews", async () => {
    mockListReviews.mockResolvedValue({ data: [], error: null });
    render(<MovieDetail movie={interstellar} onBack={noop} onOpenAuth={noop} />);
    await waitFor(() => expect(screen.getByText(/no reviews yet/i)).toBeInTheDocument());
    expect(screen.queryByLabelText(/sort reviews/i)).not.toBeInTheDocument();
  });

  it("preserves the error state independent of the sort control", async () => {
    mockListReviews.mockResolvedValue({ data: null, error: "Network unreachable" });
    render(<MovieDetail movie={interstellar} onBack={noop} onOpenAuth={noop} />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.queryByLabelText(/sort reviews/i)).not.toBeInTheDocument();
  });
});

describe("MovieDetail — trailer & related movies (smoke checks, Phase 47)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListReviews.mockResolvedValue({ data: [], error: null });
  });

  it("shows an honest empty state when the movie has no trailer (already correct, verified not broken)", () => {
    const movieNoTrailer = { ...interstellar, trailerUrl: undefined };
    render(
      <MovieDetail movie={movieNoTrailer} onBack={noop} onOpenAuth={noop} />
    );
    expect(screen.getByText(/no trailer available yet/i)).toBeInTheDocument();
  });

  it("does not render a related-movies rail when no relatedPool is supplied", () => {
    render(
      <MovieDetail movie={interstellar} onBack={noop} onOpenAuth={noop} />
    );
    expect(screen.queryByText(/you might also like/i)).not.toBeInTheDocument();
  });
});