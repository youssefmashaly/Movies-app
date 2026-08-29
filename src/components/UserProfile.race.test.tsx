// src/components/UserProfile.race.test.tsx
//
// Phase 48 — regression test for the stale-response race condition found
// during the performance audit: navigating from profile A to profile B
// while A's slower request is still in flight must never let A's data
// overwrite B's once it arrives. This is a real, user-triggered scenario
// since Phase 46 (notifications) and the existing followers/following
// panel both navigate between profiles by changing `viewedUserId` quickly.

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import UserProfile from "./UserProfile";

vi.mock("../firebase", () => ({ auth: { currentUser: { uid: "me", displayName: "Me", email: "me@test.com" } } }));
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, cb: (u: unknown) => void) => {
    cb({ uid: "me", displayName: "Me", email: "me@test.com" });
    return () => {};
  },
}));

vi.mock("../services/supabase/profiles", () => ({
  getProfileWithGenres: vi.fn(),
  updateProfile: vi.fn(),
  saveFavoriteGenres: vi.fn(),
}));
vi.mock("../services/supabase/ratings", () => ({
  listUserRatings: vi.fn().mockResolvedValue({ data: [], error: null }),
}));
vi.mock("../services/supabase/reviews", () => ({
  listUserReviews: vi.fn().mockResolvedValue({ data: [], error: null }),
}));
vi.mock("../services/supabase/recentlyViewed", () => ({
  listRecentlyViewed: vi.fn().mockResolvedValue({ data: [], error: null }),
}));
vi.mock("../services/supabase/watchlists", () => ({
  getOrCreateDefaultWatchlist: vi.fn().mockResolvedValue({ data: { id: "wl1" }, error: null }),
  listWatchlists: vi.fn().mockResolvedValue({ data: [], error: null }),
  listWatchlistMovies: vi.fn().mockResolvedValue({ data: [], error: null }),
}));
vi.mock("../services/supabase/social", () => ({
  getFollowCounts: vi.fn().mockResolvedValue({ data: { followers: 0, following: 0 }, error: null }),
  listFollowers: vi.fn().mockResolvedValue({ data: [], error: null }),
  listFollowing: vi.fn().mockResolvedValue({ data: [], error: null }),
  followUser: vi.fn(),
  unfollowUser: vi.fn(),
  checkIsFollowing: vi.fn().mockResolvedValue({ data: false, error: null }),
  getPublicProfile: vi.fn().mockResolvedValue({ data: { favorite_genres: [] }, error: null }),
  getReviewLikeCounts: vi.fn().mockResolvedValue({ data: {}, error: null }),
  computeBadges: vi.fn().mockReturnValue([]),
}));
vi.mock("../lib/movieCatalog", () => ({
  loadMovieCatalog: vi.fn().mockResolvedValue([]),
  getCachedCatalog: vi.fn().mockReturnValue([]),
}));

import { getProfileWithGenres } from "../services/supabase/profiles";
const mockGetProfile = getProfileWithGenres as ReturnType<typeof vi.fn>;

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

describe("UserProfile — stale profile navigation race (Phase 48)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not let a slow profile A response overwrite a faster profile B once navigated away", async () => {
    const profileA = deferred<any>();
    const profileB = { data: { display_name: "Bob", avatar_url: null, email: "b@test.com", favorite_genres: [], created_at: null }, error: null };

    mockGetProfile.mockImplementation((userId: string) => {
      if (userId === "user-a") return profileA.promise; // never resolves until we say so
      if (userId === "user-b") return Promise.resolve(profileB);
      return Promise.resolve({ data: null, error: "unknown" });
    });

    const { rerender } = render(<UserProfile viewedUserId="user-a" />);

    // Navigate to profile B before A's slow request resolves
    rerender(<UserProfile viewedUserId="user-b" />);

    await waitFor(() => expect(screen.getByText("Bob")).toBeInTheDocument());

    // Now let the stale A response resolve — it must NOT overwrite Bob's name
    profileA.resolve({
      data: { display_name: "Alice (stale)", avatar_url: null, email: "a@test.com", favorite_genres: [], created_at: null },
      error: null,
    });

    // Give the stale promise a tick to (incorrectly, if the bug existed) apply
    await new Promise((r) => setTimeout(r, 0));

    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.queryByText(/alice \(stale\)/i)).not.toBeInTheDocument();
  });
});