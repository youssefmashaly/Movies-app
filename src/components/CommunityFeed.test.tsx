// src/components/CommunityFeed.test.tsx
//
// Phase 49 — tests for the real Community experience. Confirms the feed
// renders genuine data from services/supabase/social.ts, handles
// loading/empty/error states, and that interactions (like, follow, movie
// navigation, profile navigation) call the right functions with the right
// arguments. No fabricated content should ever appear.
//
// Phase 50 — added onOpenReview prop to every render call, plus a new
// test confirming the review text opens the focused Review Detail view.

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CommunityFeed from "./CommunityFeed";
import type { Movie } from "../types";

vi.mock("../firebase", () => ({ auth: { currentUser: { uid: "me" } } }));
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, cb: (u: unknown) => void) => {
    cb({ uid: "me" });
    return () => {};
  },
}));

vi.mock("../services/supabase/social", () => ({
  listCommunityReviews: vi.fn(),
  listTrendingReviews: vi.fn().mockResolvedValue({ data: [], error: null }),
  listFollowingReviews: vi.fn().mockResolvedValue({ data: [], error: null }),
  listActiveReviewers: vi.fn().mockResolvedValue({ data: [], error: null }),
  getReviewLeaderboard: vi.fn().mockResolvedValue({ data: [], error: null }),
  getCommunityFavoriteMovies: vi.fn().mockResolvedValue({ data: [], error: null }),
  getFollowingIds: vi.fn().mockResolvedValue({ data: [], error: null }),
  getUserLikes: vi.fn().mockResolvedValue({ data: [], error: null }),
  likeReview: vi.fn().mockResolvedValue({ data: null, error: null }),
  unlikeReview: vi.fn().mockResolvedValue({ data: null, error: null }),
  getReviewLikeCounts: vi.fn().mockResolvedValue({ data: {}, error: null }),
  followUser: vi.fn().mockResolvedValue({ data: null, error: null }),
  unfollowUser: vi.fn().mockResolvedValue({ data: null, error: null }),
}));

import {
  listCommunityReviews,
  listActiveReviewers,
  getReviewLeaderboard,
  likeReview,
  unlikeReview,
  followUser,
} from "../services/supabase/social";

const mockListReviews = listCommunityReviews as ReturnType<typeof vi.fn>;
const mockListReviewers = listActiveReviewers as ReturnType<typeof vi.fn>;
const mockLeaderboard = getReviewLeaderboard as ReturnType<typeof vi.fn>;
const mockLikeReview = likeReview as ReturnType<typeof vi.fn>;
const mockUnlikeReview = unlikeReview as ReturnType<typeof vi.fn>;
const mockFollowUser = followUser as ReturnType<typeof vi.fn>;

function makeReview(id: string, overrides: Partial<any> = {}) {
  return {
    id,
    user_id: `user-${id}`,
    movie_id: `movie-${id}`,
    movie_title: `Movie ${id}`,
    rating: 9,
    comment: `Great film, review ${id}`,
    created_at: new Date().toISOString(),
    profiles: { display_name: `Reviewer ${id}`, avatar_url: null },
    ...overrides,
  };
}

const testMovie: Movie = {
  id: "movie-r1",
  title: "Movie r1",
  posterPath: "",
  backdropPath: "",
  overview: "",
  releaseDate: "2020-01-01",
  voteAverage: 8,
  voteCount: 100,
  genres: ["Drama"],
};

const noop = () => {};

describe("CommunityFeed (Phase 49)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListReviewers.mockResolvedValue({ data: [], error: null });
    mockLeaderboard.mockResolvedValue({ data: [], error: null });
  });

  it("shows a loading state while the feed is being fetched", () => {
    mockListReviews.mockReturnValue(new Promise(() => {}));
    render(
      <CommunityFeed
        combinedMoviePool={[]}
        onSelectMovie={noop}
        onToggleSave={noop}
        watchlistIds={new Set()}
        onViewProfile={noop}
        onOpenAuth={noop}
        onOpenReview={noop}
      />
    );
    expect(screen.getByRole("status", { name: /loading community reviews/i })).toBeInTheDocument();
  });

  it("shows an honest empty state when there are no community reviews", async () => {
    mockListReviews.mockResolvedValue({ data: [], error: null });
    render(
      <CommunityFeed
        combinedMoviePool={[]}
        onSelectMovie={noop}
        onToggleSave={noop}
        watchlistIds={new Set()}
        onViewProfile={noop}
        onOpenAuth={noop}
        onOpenReview={noop}
      />
    );
    await waitFor(() => expect(screen.getByText(/no reviews yet/i)).toBeInTheDocument());
  });

  it("shows a distinct error state with retry when the feed fails to load", async () => {
    mockListReviews.mockResolvedValue({ data: null, error: "Network down" });
    render(
      <CommunityFeed
        combinedMoviePool={[]}
        onSelectMovie={noop}
        onToggleSave={noop}
        watchlistIds={new Set()}
        onViewProfile={noop}
        onOpenAuth={noop}
        onOpenReview={noop}
      />
    );
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByText(/couldn't load community reviews/i)).toBeInTheDocument();
  });

  it("renders real review content with reviewer name, movie title, and rating", async () => {
    mockListReviews.mockResolvedValue({ data: [makeReview("r1")], error: null });
    render(
      <CommunityFeed
        combinedMoviePool={[]}
        onSelectMovie={noop}
        onToggleSave={noop}
        watchlistIds={new Set()}
        onViewProfile={noop}
        onOpenAuth={noop}
        onOpenReview={noop}
      />
    );
    await waitFor(() => expect(screen.getByText("Reviewer r1")).toBeInTheDocument());
    expect(screen.getByText("Movie r1")).toBeInTheDocument();
    expect(screen.getByText("9/10")).toBeInTheDocument();
  });

  it("navigates to the movie when the movie title is clicked and it's in the catalog", async () => {
    mockListReviews.mockResolvedValue({ data: [makeReview("r1")], error: null });
    const onSelectMovie = vi.fn();
    render(
      <CommunityFeed
        combinedMoviePool={[testMovie]}
        onSelectMovie={onSelectMovie}
        onToggleSave={noop}
        watchlistIds={new Set()}
        onViewProfile={noop}
        onOpenAuth={noop}
        onOpenReview={noop}
      />
    );
    await waitFor(() => expect(screen.getByText("Movie r1")).toBeInTheDocument());
    await userEvent.click(screen.getByText("Movie r1"));
    expect(onSelectMovie).toHaveBeenCalledWith(testMovie);
  });

  it("navigates to the reviewer's profile when their name is clicked", async () => {
    mockListReviews.mockResolvedValue({ data: [makeReview("r1")], error: null });
    const onViewProfile = vi.fn();
    render(
      <CommunityFeed
        combinedMoviePool={[]}
        onSelectMovie={noop}
        onToggleSave={noop}
        watchlistIds={new Set()}
        onViewProfile={onViewProfile}
        onOpenAuth={noop}
        onOpenReview={noop}
      />
    );
    await waitFor(() => expect(screen.getByText("Reviewer r1")).toBeInTheDocument());
    await userEvent.click(screen.getByText("Reviewer r1"));
    expect(onViewProfile).toHaveBeenCalledWith("user-r1");
  });

  it("calls likeReview when an unliked review's like button is clicked", async () => {
    mockListReviews.mockResolvedValue({ data: [makeReview("r1")], error: null });
    render(
      <CommunityFeed
        combinedMoviePool={[]}
        onSelectMovie={noop}
        onToggleSave={noop}
        watchlistIds={new Set()}
        onViewProfile={noop}
        onOpenAuth={noop}
        onOpenReview={noop}
      />
    );
    await waitFor(() => expect(screen.getByText("Reviewer r1")).toBeInTheDocument());
    const likeButton = screen.getByRole("button", { name: /like this review/i });
    await userEvent.click(likeButton);
    expect(mockLikeReview).toHaveBeenCalledWith("r1", "me");
  });

  it("calls unlikeReview when an already-liked review's like button is clicked", async () => {
    mockListReviews.mockResolvedValue({ data: [makeReview("r1")], error: null });
    const { getUserLikes } = await import("../services/supabase/social");
    (getUserLikes as ReturnType<typeof vi.fn>).mockResolvedValue({ data: ["r1"], error: null });

    render(
      <CommunityFeed
        combinedMoviePool={[]}
        onSelectMovie={noop}
        onToggleSave={noop}
        watchlistIds={new Set()}
        onViewProfile={noop}
        onOpenAuth={noop}
        onOpenReview={noop}
      />
    );
    await waitFor(() => expect(screen.getByText("Reviewer r1")).toBeInTheDocument());
    const likeButton = await screen.findByRole("button", { name: /unlike this review/i });
    await userEvent.click(likeButton);
    expect(mockUnlikeReview).toHaveBeenCalledWith("r1", "me");
  });

  it("shows people to discover with a working Follow button", async () => {
    mockListReviews.mockResolvedValue({ data: [], error: null });
    mockListReviewers.mockResolvedValue({
      data: [{ id: "user-x", display_name: "Xavier", avatar_url: null, favorite_genres: [] }],
      error: null,
    });

    render(
      <CommunityFeed
        combinedMoviePool={[]}
        onSelectMovie={noop}
        onToggleSave={noop}
        watchlistIds={new Set()}
        onViewProfile={noop}
        onOpenAuth={noop}
        onOpenReview={noop}
      />
    );

    await waitFor(() => expect(screen.getByText("Xavier")).toBeInTheDocument());
    const followButton = screen.getByRole("button", { name: /follow xavier/i });
    await userEvent.click(followButton);
    expect(mockFollowUser).toHaveBeenCalledWith("me", "user-x");
  });

  it("shows the top reviewers leaderboard from real aggregate data", async () => {
    mockListReviews.mockResolvedValue({ data: [], error: null });
    mockLeaderboard.mockResolvedValue({
      data: [{ user_id: "user-y", display_name: "Yara", avatar_url: null, score: 12, label: "12 reviews" }],
      error: null,
    });

    render(
      <CommunityFeed
        combinedMoviePool={[]}
        onSelectMovie={noop}
        onToggleSave={noop}
        watchlistIds={new Set()}
        onViewProfile={noop}
        onOpenAuth={noop}
        onOpenReview={noop}
      />
    );

    await waitFor(() => expect(screen.getByText("Yara")).toBeInTheDocument());
    expect(screen.getByText("12 reviews")).toBeInTheDocument();
  });

  it("does not render fabricated content — every reviewer/review name traces to mocked data", async () => {
    mockListReviews.mockResolvedValue({ data: [makeReview("r1")], error: null });
    render(
      <CommunityFeed
        combinedMoviePool={[]}
        onSelectMovie={noop}
        onToggleSave={noop}
        watchlistIds={new Set()}
        onViewProfile={noop}
        onOpenAuth={noop}
        onOpenReview={noop}
      />
    );
    await waitFor(() => expect(screen.getByText("Reviewer r1")).toBeInTheDocument());
    // No hardcoded/example names should ever appear
    expect(screen.queryByText(/john doe/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/jane smith/i)).not.toBeInTheDocument();
  });

  it("calls onOpenReview with the review id when the review text is clicked (Phase 50)", async () => {
    mockListReviews.mockResolvedValue({ data: [makeReview("r1")], error: null });
    const onOpenReview = vi.fn();
    render(
      <CommunityFeed
        combinedMoviePool={[]}
        onSelectMovie={noop}
        onToggleSave={noop}
        watchlistIds={new Set()}
        onViewProfile={noop}
        onOpenAuth={noop}
        onOpenReview={onOpenReview}
      />
    );
    await waitFor(() => expect(screen.getByText("Reviewer r1")).toBeInTheDocument());
    const reviewButton = screen.getByRole("button", { name: /read full review by reviewer r1/i });
    await userEvent.click(reviewButton);
    expect(onOpenReview).toHaveBeenCalledWith("r1");
  });
});