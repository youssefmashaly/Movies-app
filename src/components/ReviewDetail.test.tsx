// src/components/ReviewDetail.test.tsx
//
// Phase 50 — tests for the focused Review Detail experience. Confirms
// real-data rendering, loading/not-found/error states, movie context,
// navigation, and both engagement types (like + helpful vote). No
// fabricated review or comment content should ever appear, and no
// discussion/thread UI should be rendered since the schema doesn't
// support it (see final report).

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReviewDetail from "./ReviewDetail";
import type { Movie } from "../types";

vi.mock("../firebase", () => ({ auth: { currentUser: { uid: "me" } } }));
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, cb: (u: unknown) => void) => {
    cb({ uid: "me" });
    return () => {};
  },
}));

vi.mock("../services/supabase/social", () => ({
  getReviewById: vi.fn(),
  getReviewLikeCounts: vi.fn().mockResolvedValue({ data: {}, error: null }),
  getUserLikes: vi.fn().mockResolvedValue({ data: [], error: null }),
  likeReview: vi.fn().mockResolvedValue({ data: null, error: null }),
  unlikeReview: vi.fn().mockResolvedValue({ data: null, error: null }),
  getHelpfulVoteCounts: vi.fn().mockResolvedValue({ data: {}, error: null }),
  getUserHelpfulVotes: vi.fn().mockResolvedValue({ data: [], error: null }),
  voteHelpful: vi.fn().mockResolvedValue({ data: null, error: null }),
  unvoteHelpful: vi.fn().mockResolvedValue({ data: null, error: null }),
}));

import {
  getReviewById,
  getReviewLikeCounts,
  getHelpfulVoteCounts,
  likeReview,
  unlikeReview,
  voteHelpful,
  unvoteHelpful,
} from "../services/supabase/social";

const mockGetReview = getReviewById as ReturnType<typeof vi.fn>;
const mockLikeCounts = getReviewLikeCounts as ReturnType<typeof vi.fn>;
const mockHelpfulCounts = getHelpfulVoteCounts as ReturnType<typeof vi.fn>;
const mockLikeReview = likeReview as ReturnType<typeof vi.fn>;
const mockUnlikeReview = unlikeReview as ReturnType<typeof vi.fn>;
const mockVoteHelpful = voteHelpful as ReturnType<typeof vi.fn>;
const mockUnvoteHelpful = unvoteHelpful as ReturnType<typeof vi.fn>;

function makeReview(overrides: Partial<any> = {}) {
  return {
    id: "r1",
    user_id: "user-alice",
    movie_id: "movie-1",
    movie_title: "Inception",
    rating: 9,
    comment: "A genuinely brilliant, layered film about dreams within dreams.",
    created_at: new Date().toISOString(),
    profiles: { display_name: "Alice", avatar_url: null },
    ...overrides,
  };
}

const testMovie: Movie = {
  id: "movie-1",
  title: "Inception",
  posterPath: "",
  backdropPath: "",
  overview: "",
  releaseDate: "2010-07-16",
  voteAverage: 8.8,
  voteCount: 1000,
  genres: ["Sci-Fi", "Thriller"],
};

const noop = () => {};

describe("ReviewDetail (Phase 50)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLikeCounts.mockResolvedValue({ data: {}, error: null });
    mockHelpfulCounts.mockResolvedValue({ data: {}, error: null });
  });

  it("shows a loading state while the review is being fetched", () => {
    mockGetReview.mockReturnValue(new Promise(() => {}));
    render(
      <ReviewDetail
        reviewId="r1"
        combinedMoviePool={[]}
        onBack={noop}
        onSelectMovie={noop}
        onViewProfile={noop}
        onOpenAuth={noop}
      />
    );
    expect(screen.getByRole("status", { name: /loading review/i })).toBeInTheDocument();
  });

  it("shows a not-found state when the review no longer exists", async () => {
    mockGetReview.mockResolvedValue({ data: null, error: null });
    render(
      <ReviewDetail
        reviewId="deleted-review"
        combinedMoviePool={[]}
        onBack={noop}
        onSelectMovie={noop}
        onViewProfile={noop}
        onOpenAuth={noop}
      />
    );
    await waitFor(() => expect(screen.getByText(/no longer exists/i)).toBeInTheDocument());
  });

  it("shows a distinct error state with retry when the fetch fails", async () => {
    mockGetReview.mockResolvedValue({ data: null, error: "Network down" });
    render(
      <ReviewDetail
        reviewId="r1"
        combinedMoviePool={[]}
        onBack={noop}
        onSelectMovie={noop}
        onViewProfile={noop}
        onOpenAuth={noop}
      />
    );
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByText(/couldn't load this review/i)).toBeInTheDocument();
  });

  it("retries loading when Try again is clicked after an error", async () => {
    mockGetReview
      .mockResolvedValueOnce({ data: null, error: "Network down" })
      .mockResolvedValueOnce({ data: makeReview(), error: null });

    render(
      <ReviewDetail
        reviewId="r1"
        combinedMoviePool={[]}
        onBack={noop}
        onSelectMovie={noop}
        onViewProfile={noop}
        onOpenAuth={noop}
      />
    );
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
  });

  it("renders the full review text, reviewer, rating, and movie context", async () => {
    mockGetReview.mockResolvedValue({ data: makeReview(), error: null });
    render(
      <ReviewDetail
        reviewId="r1"
        combinedMoviePool={[testMovie]}
        onBack={noop}
        onSelectMovie={noop}
        onViewProfile={noop}
        onOpenAuth={noop}
      />
    );
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    expect(screen.getByText(/genuinely brilliant, layered film/i)).toBeInTheDocument();
    expect(screen.getByText("9/10")).toBeInTheDocument();
    expect(screen.getByText("Inception")).toBeInTheDocument();
    expect(screen.getByText(/2010/)).toBeInTheDocument();
  });

  it("shows a graceful message when the movie is no longer in the catalog", async () => {
    mockGetReview.mockResolvedValue({ data: makeReview(), error: null });
    render(
      <ReviewDetail
        reviewId="r1"
        combinedMoviePool={[]}
        onBack={noop}
        onSelectMovie={noop}
        onViewProfile={noop}
        onOpenAuth={noop}
      />
    );
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    expect(screen.getByText(/no longer in the catalog/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /view movie/i })).not.toBeInTheDocument();
  });

  it("navigates to the movie when View Movie is clicked", async () => {
    mockGetReview.mockResolvedValue({ data: makeReview(), error: null });
    const onSelectMovie = vi.fn();
    render(
      <ReviewDetail
        reviewId="r1"
        combinedMoviePool={[testMovie]}
        onBack={noop}
        onSelectMovie={onSelectMovie}
        onViewProfile={noop}
        onOpenAuth={noop}
      />
    );
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /view movie/i }));
    expect(onSelectMovie).toHaveBeenCalledWith(testMovie);
  });

  it("navigates to the reviewer's profile when their name is clicked", async () => {
    mockGetReview.mockResolvedValue({ data: makeReview(), error: null });
    const onViewProfile = vi.fn();
    render(
      <ReviewDetail
        reviewId="r1"
        combinedMoviePool={[]}
        onBack={noop}
        onSelectMovie={noop}
        onViewProfile={onViewProfile}
        onOpenAuth={noop}
      />
    );
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    await userEvent.click(screen.getByText("Alice"));
    expect(onViewProfile).toHaveBeenCalledWith("user-alice");
  });

  it("calls onBack when Back to Community is clicked", async () => {
    mockGetReview.mockResolvedValue({ data: makeReview(), error: null });
    const onBack = vi.fn();
    render(
      <ReviewDetail
        reviewId="r1"
        combinedMoviePool={[]}
        onBack={onBack}
        onSelectMovie={noop}
        onViewProfile={noop}
        onOpenAuth={noop}
      />
    );
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /back to community/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it("calls likeReview when the like button is clicked while unliked", async () => {
    mockGetReview.mockResolvedValue({ data: makeReview(), error: null });
    render(
      <ReviewDetail
        reviewId="r1"
        combinedMoviePool={[]}
        onBack={noop}
        onSelectMovie={noop}
        onViewProfile={noop}
        onOpenAuth={noop}
      />
    );
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /like this review/i }));
    expect(mockLikeReview).toHaveBeenCalledWith("r1", "me");
  });

  it("disables the like button while the like request is in flight (Phase 51)", async () => {
    mockGetReview.mockResolvedValue({ data: makeReview(), error: null });
    let resolveLike!: (v: unknown) => void;
    mockLikeReview.mockReturnValue(new Promise((res) => { resolveLike = res; }));

    render(
      <ReviewDetail
        reviewId="r1"
        combinedMoviePool={[]}
        onBack={noop}
        onSelectMovie={noop}
        onViewProfile={noop}
        onOpenAuth={noop}
      />
    );
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());

    const likeButton = screen.getByRole("button", { name: /like this review/i });
    await userEvent.click(likeButton);

    expect(likeButton).toBeDisabled();

    resolveLike({ data: null, error: null });
    await waitFor(() => expect(likeButton).not.toBeDisabled());
  });

  it("disables the helpful button while the vote request is in flight (Phase 51)", async () => {
    mockGetReview.mockResolvedValue({ data: makeReview(), error: null });
    let resolveVote!: (v: unknown) => void;
    mockVoteHelpful.mockReturnValue(new Promise((res) => { resolveVote = res; }));

    render(
      <ReviewDetail
        reviewId="r1"
        combinedMoviePool={[]}
        onBack={noop}
        onSelectMovie={noop}
        onViewProfile={noop}
        onOpenAuth={noop}
      />
    );
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());

    const helpfulButton = screen.getByRole("button", { name: /mark as helpful/i });
    await userEvent.click(helpfulButton);

    expect(helpfulButton).toBeDisabled();

    resolveVote({ data: null, error: null });
    await waitFor(() => expect(helpfulButton).not.toBeDisabled());
  });

  it("calls unlikeReview when the like button is clicked while already liked", async () => {
    mockGetReview.mockResolvedValue({ data: makeReview(), error: null });
    const { getUserLikes } = await import("../services/supabase/social");
    (getUserLikes as ReturnType<typeof vi.fn>).mockResolvedValue({ data: ["r1"], error: null });

    render(
      <ReviewDetail
        reviewId="r1"
        combinedMoviePool={[]}
        onBack={noop}
        onSelectMovie={noop}
        onViewProfile={noop}
        onOpenAuth={noop}
      />
    );
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    const likeButton = await screen.findByRole("button", { name: /unlike this review/i });
    await userEvent.click(likeButton);
    expect(mockUnlikeReview).toHaveBeenCalledWith("r1", "me");
  });

  it("calls voteHelpful when the helpful button is clicked while not yet marked helpful", async () => {
    mockGetReview.mockResolvedValue({ data: makeReview(), error: null });
    render(
      <ReviewDetail
        reviewId="r1"
        combinedMoviePool={[]}
        onBack={noop}
        onSelectMovie={noop}
        onViewProfile={noop}
        onOpenAuth={noop}
      />
    );
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /mark as helpful/i }));
    expect(mockVoteHelpful).toHaveBeenCalledWith("r1", "me");
  });

  it("calls unvoteHelpful when already marked helpful", async () => {
    mockGetReview.mockResolvedValue({ data: makeReview(), error: null });
    const { getUserHelpfulVotes } = await import("../services/supabase/social");
    (getUserHelpfulVotes as ReturnType<typeof vi.fn>).mockResolvedValue({ data: ["r1"], error: null });

    render(
      <ReviewDetail
        reviewId="r1"
        combinedMoviePool={[]}
        onBack={noop}
        onSelectMovie={noop}
        onViewProfile={noop}
        onOpenAuth={noop}
      />
    );
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    const helpfulButton = await screen.findByRole("button", { name: /remove helpful vote/i });
    await userEvent.click(helpfulButton);
    expect(mockUnvoteHelpful).toHaveBeenCalledWith("r1", "me");
  });

  it("shows engagement counts from real batched data, not fabricated numbers", async () => {
    mockGetReview.mockResolvedValue({ data: makeReview(), error: null });
    mockLikeCounts.mockResolvedValue({ data: { r1: 7 }, error: null });
    mockHelpfulCounts.mockResolvedValue({ data: { r1: 3 }, error: null });

    render(
      <ReviewDetail
        reviewId="r1"
        combinedMoviePool={[]}
        onBack={noop}
        onSelectMovie={noop}
        onViewProfile={noop}
        onOpenAuth={noop}
      />
    );
    await waitFor(() => expect(screen.getByText(/7 likes/i)).toBeInTheDocument());
    expect(screen.getByText(/3 found helpful/i)).toBeInTheDocument();
  });

  it("does not render any comments/discussion thread UI (schema does not support it)", async () => {
    mockGetReview.mockResolvedValue({ data: makeReview(), error: null });
    render(
      <ReviewDetail
        reviewId="r1"
        combinedMoviePool={[]}
        onBack={noop}
        onSelectMovie={noop}
        onViewProfile={noop}
        onOpenAuth={noop}
      />
    );
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    expect(screen.queryByRole("textbox", { name: /comment|reply/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/add a comment/i)).not.toBeInTheDocument();
  });

  it("only fetches the single review — never the whole community feed — to render", async () => {
    mockGetReview.mockResolvedValue({ data: makeReview(), error: null });
    render(
      <ReviewDetail
        reviewId="r1"
        combinedMoviePool={[]}
        onBack={noop}
        onSelectMovie={noop}
        onViewProfile={noop}
        onOpenAuth={noop}
      />
    );
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    expect(mockGetReview).toHaveBeenCalledWith("r1");
    expect(mockGetReview).toHaveBeenCalledTimes(1);
  });
});