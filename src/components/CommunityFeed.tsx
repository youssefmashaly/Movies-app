
// Phase 49 — Community experience.
//
// AUDIT FINDING: this file was previously byte-identical to UserProfile.tsx.
// App.tsx rendered <CommunityFeed /> with zero props, so — since the
// duplicated source's `targetUserId` falls back to the signed-in user's own
// id when no `viewedUserId` prop is supplied — it silently rendered the
// current user's own profile a second time under the "Community" tab. There
// was also no navigation entry point anywhere in the app that ever set
// activeTab to "community", so this tab was unreachable in the UI. This is
// a genuine placeholder artifact, not an intentional duplicate experience.
//
// This phase gives Community its own real identity: discovery of what the
// WIDER community (and people you follow) are doing, as opposed to
// UserProfile's focus on a single person's own identity/activity. Every
// section below is backed entirely by existing, already-built services in
// services/supabase/social.ts — listCommunityReviews, listTrendingReviews,
// listFollowingReviews, listActiveReviewers, getReviewLeaderboard, and
// getCommunityFavoriteMovies (the last of these already powers a rail on
// UserDashboard; reusing the same aggregation here is intentional data-layer
// reuse, not duplication — the two pages present it in different contexts:
// a personal recommendation signal there, a public community showcase here).
//
// No new Supabase tables or schema changes were needed — every one of these
// functions already existed and was already battle-tested elsewhere in the
// app (UserDashboard, UserProfile, MovieDetail's review flow).
//
// Phase 50 — added onOpenReview so the review text itself opens the new
// focused Review Detail experience. The review text became its own
// semantic <button> (rather than making the whole card clickable) so it
// never nests inside, or wraps around, the existing profile/movie/like
// buttons — avoiding invalid nested-interactive-element markup entirely.
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  Users, TrendingUp, MessageSquare, Star, Heart, UserPlus, UserCheck,
  Trophy, Globe, Loader2, AlertCircle, RefreshCw, Inbox, ChevronDown,
} from "lucide-react";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  listCommunityReviews,
  listTrendingReviews,
  listFollowingReviews,
  listActiveReviewers,
  getReviewLeaderboard,
  getCommunityFavoriteMovies,
  getFollowingIds,
  getUserLikes,
  likeReview,
  unlikeReview,
  getReviewLikeCounts,
  followUser,
  unfollowUser,
  type CommunityReview,
  type PublicProfile,
  type LeaderboardEntry,
  type CollaborativeMovieSignal,
} from "../services/supabase/social";
import { useToast } from "../context/ToastContext";
import MovieRail from "./MovieRail";
import type { Movie } from "../types";

interface CommunityFeedProps {
  /** Full movie catalog, already loaded by App.tsx — reused here to resolve
   *  review movie_ids into clickable Movie objects with zero extra fetches,
   *  the same pattern UserDashboard already uses for its collaborative
   *  discovery rails. */
  combinedMoviePool: Movie[];
  onSelectMovie: (movie: Movie) => void;
  onToggleSave: (movie: Movie) => void;
  watchlistIds: Set<string>;
  onViewProfile: (userId: string) => void;
  onOpenAuth: () => void;
  /** Phase 50 — opens the focused Review Detail experience for a review. */
  onOpenReview: (reviewId: string) => void;
}

const FEED_PAGE_SIZE = 10;

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function initialsOf(name: string | null): string {
  if (!name?.trim()) return "?";
  return name.trim().split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

// ---------------------------------------------------------------------------
// Review card — shared by the main feed, trending, and following sections.
// ---------------------------------------------------------------------------

interface ReviewCardProps {
  review: CommunityReview;
  likeCount: number;
  isLiked: boolean;
  /** Phase 51 — true while a like/unlike request for this specific review
   *  is in flight. Previously this was a hardcoded `canInteract: true` that
   *  never actually disabled the button during the async call, so rapid
   *  double-clicks could race the optimistic update. */
  isBusy: boolean;
  onToggleLike: (review: CommunityReview) => void;
  onViewProfile: (userId: string) => void;
  onSelectMovieById: (movieId: string, title: string) => void;
  onOpenReview: (reviewId: string) => void;
}

function ReviewCard({ review, likeCount, isLiked, isBusy, onToggleLike, onViewProfile, onSelectMovieById, onOpenReview }: ReviewCardProps) {
  const name = review.profiles?.display_name ?? "Anonymous";
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => onViewProfile(review.user_id)}
          className="flex items-center gap-2.5 min-w-0 text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 cursor-pointer group"
        >
          {review.profiles?.avatar_url ? (
            <img
              src={review.profiles.avatar_url}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="h-8 w-8 rounded-full object-cover shrink-0 border border-neutral-700"
            />
          ) : (
            <div className="h-8 w-8 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold bg-neutral-800 border border-neutral-700 text-neutral-300">
              {initialsOf(name)}
            </div>
          )}
          <div className="min-w-0">
            <span className="font-semibold text-xs text-neutral-200 truncate group-hover:text-white group-hover:underline block max-w-[160px]">
              {name}
            </span>
            <span className="text-[10px] text-neutral-500">{relativeTime(review.created_at)}</span>
          </div>
        </button>
        <span className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/10">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden="true" />
          {review.rating}/10
        </span>
      </div>

      <button
        onClick={() => onSelectMovieById(review.movie_id, review.movie_title)}
        className="text-xs font-semibold text-red-400 hover:text-red-300 hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded"
      >
        {review.movie_title}
      </button>

      {/* Phase 50 — the review text itself is the entry point into the
          focused Review Detail experience. Kept as its own button (rather
          than making the whole card clickable) so it never nests inside,
          or wraps around, the profile/movie/like buttons above and below —
          avoiding invalid nested-interactive-element markup entirely. */}
      <button
        onClick={() => onOpenReview(review.id)}
        className="block w-full text-left text-xs text-neutral-400 break-words leading-relaxed hover:text-neutral-300 cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        aria-label={`Read full review by ${name}`}
      >
        {review.comment}
      </button>

      <button
        onClick={() => onToggleLike(review)}
        disabled={isBusy}
        aria-pressed={isLiked}
        aria-label={isLiked ? `Unlike this review (${likeCount} likes)` : `Like this review (${likeCount} likes)`}
        className={`inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-lg px-2 py-1 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50 ${
          isLiked ? "text-red-400 bg-red-500/10" : "text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04]"
        }`}
      >
        {isBusy ? (
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        ) : (
          <Heart className={`h-3 w-3 ${isLiked ? "fill-red-400" : ""}`} aria-hidden="true" />
        )}
        {likeCount > 0 ? likeCount : "Like"}
      </button>
    </div>
  );
}

function ReviewCardSkeleton() {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-neutral-800 shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-2.5 w-24 rounded bg-neutral-800" />
          <div className="h-2 w-16 rounded bg-neutral-800/60" />
        </div>
        <div className="h-5 w-10 rounded bg-neutral-800" />
      </div>
      <div className="space-y-1">
        <div className="h-2 w-full rounded bg-neutral-800/60" />
        <div className="h-2 w-4/5 rounded bg-neutral-800/40" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function CommunityFeed({
  combinedMoviePool,
  onSelectMovie,
  onToggleSave,
  watchlistIds,
  onViewProfile,
  onOpenAuth,
  onOpenReview,
}: CommunityFeedProps) {
  const { showToast } = useToast();
  const [user, setUser] = useState(auth.currentUser);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  const userId = user?.uid ?? null;

  const MOVIES_BY_ID = useMemo(() => new Map(combinedMoviePool.map((m) => [m.id, m])), [combinedMoviePool]);
  const isMovieSaved = useCallback((id: string) => watchlistIds.has(id), [watchlistIds]);

  const onSelectMovieById = useCallback((movieId: string, title: string) => {
    const movie = MOVIES_BY_ID.get(movieId);
    if (movie) {
      onSelectMovie(movie);
    } else {
      showToast(`Couldn't open "${title}" — it's no longer in the catalog.`, "error");
    }
  }, [MOVIES_BY_ID, onSelectMovie, showToast]);

  // ── Main paginated feed ──────────────────────────────────────────────────
  const [feed, setFeed] = useState<CommunityReview[]>([]);
  const [feedStatus, setFeedStatus] = useState<"loading" | "ready" | "error">("loading");
  const [feedError, setFeedError] = useState("");
  const [feedLimit, setFeedLimit] = useState(FEED_PAGE_SIZE);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  // Phase 51 — tracks which review ids have an in-flight like/unlike
  // request, mirroring the existing followBusyIds pattern below.
  const [likeBusyIds, setLikeBusyIds] = useState<Set<string>>(new Set());

  // ── Secondary sections ───────────────────────────────────────────────────
  const [followingReviews, setFollowingReviews] = useState<CommunityReview[]>([]);
  const [trending, setTrending] = useState<CommunityReview[]>([]);
  const [reviewers, setReviewers] = useState<PublicProfile[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [communityFavorites, setCommunityFavorites] = useState<CollaborativeMovieSignal[]>([]);
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [followBusyIds, setFollowBusyIds] = useState<Set<string>>(new Set());
  const [secondaryLoading, setSecondaryLoading] = useState(true);

  const loadFeed = useCallback(async (limit: number) => {
    setFeedStatus("loading");
    setFeedError("");
    const res = await listCommunityReviews(limit);
    if (res.error || res.data === null) {
      setFeedError(res.error ?? "Unknown error");
      setFeedStatus("error");
      return;
    }
    setFeed(res.data);
    setFeedStatus("ready");

    if (res.data.length > 0) {
      const countsRes = await getReviewLikeCounts(res.data.map((r) => r.id));
      setLikeCounts(countsRes.data ?? {});
    }
    if (userId) {
      const likedRes = await getUserLikes(userId);
      setLikedIds(new Set(likedRes.data ?? []));
    }
  }, [userId]);

  useEffect(() => {
    loadFeed(feedLimit);
    // Intentionally only re-runs on mount and when the page size grows
    // (Load more) or the signed-in user changes — not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedLimit, userId]);

  useEffect(() => {
    let cancelled = false;
    setSecondaryLoading(true);

    (async () => {
      const followingIds = userId ? (await getFollowingIds(userId)).data ?? [] : [];
      if (cancelled) return;
      setFollowingSet(new Set(followingIds));

      const [trendingRes, reviewersRes, leaderboardRes, favoritesRes, followingReviewsRes] = await Promise.all([
        listTrendingReviews(6),
        userId ? listActiveReviewers(8) : Promise.resolve({ data: [], error: null }),
        getReviewLeaderboard(6),
        getCommunityFavoriteMovies(1000),
        followingIds.length > 0 ? listFollowingReviews(followingIds, 8) : Promise.resolve({ data: [], error: null }),
      ]);
      if (cancelled) return;

      setTrending(trendingRes.data ?? []);
      setReviewers((reviewersRes.data ?? []).filter((r) => r.id !== userId));
      setLeaderboard(leaderboardRes.data ?? []);
      setCommunityFavorites(favoritesRes.data ?? []);
      setFollowingReviews(followingReviewsRes.data ?? []);
      setSecondaryLoading(false);
    })();

    return () => { cancelled = true; };
  }, [userId]);

  async function handleToggleLike(review: CommunityReview) {
    if (!userId) { onOpenAuth(); return; }
    if (likeBusyIds.has(review.id)) return; // already in flight — ignore rapid re-clicks
    setLikeBusyIds((prev) => new Set(prev).add(review.id));

    const wasLiked = likedIds.has(review.id);
    // Optimistic update
    setLikedIds((prev) => {
      const next = new Set(prev);
      wasLiked ? next.delete(review.id) : next.add(review.id);
      return next;
    });
    setLikeCounts((prev) => ({ ...prev, [review.id]: Math.max(0, (prev[review.id] ?? 0) + (wasLiked ? -1 : 1)) }));

    const res = wasLiked ? await unlikeReview(review.id, userId) : await likeReview(review.id, userId);
    if (res.error) {
      // Revert on failure
      setLikedIds((prev) => {
        const next = new Set(prev);
        wasLiked ? next.add(review.id) : next.delete(review.id);
        return next;
      });
      setLikeCounts((prev) => ({ ...prev, [review.id]: Math.max(0, (prev[review.id] ?? 0) + (wasLiked ? 1 : -1)) }));
      showToast("Couldn't update like — please try again.", "error");
    }

    setLikeBusyIds((prev) => {
      const next = new Set(prev);
      next.delete(review.id);
      return next;
    });
  }

  async function handleToggleFollow(targetId: string) {
    if (!userId) { onOpenAuth(); return; }
    if (followBusyIds.has(targetId)) return;
    const wasFollowing = followingSet.has(targetId);
    setFollowBusyIds((prev) => new Set(prev).add(targetId));
    setFollowingSet((prev) => {
      const next = new Set(prev);
      wasFollowing ? next.delete(targetId) : next.add(targetId);
      return next;
    });

    const res = wasFollowing ? await unfollowUser(userId, targetId) : await followUser(userId, targetId);
    if (res.error) {
      setFollowingSet((prev) => {
        const next = new Set(prev);
        wasFollowing ? next.add(targetId) : next.delete(targetId);
        return next;
      });
      showToast("Couldn't update follow — please try again.", "error");
    } else {
      showToast(wasFollowing ? "Unfollowed." : "Now following!", "success");
    }
    setFollowBusyIds((prev) => {
      const next = new Set(prev);
      next.delete(targetId);
      return next;
    });
  }

  const communityFavoriteMovies = useMemo(() => {
    const scoreMap = new Map(communityFavorites.map((s) => [s.movie_id, s.avgRating]));
    return combinedMoviePool
      .filter((m) => scoreMap.has(m.id))
      .sort((a, b) => (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0))
      .slice(0, 12);
  }, [communityFavorites, combinedMoviePool]);

  const reviewCardProps = (review: CommunityReview) => ({
    review,
    likeCount: likeCounts[review.id] ?? review.like_count ?? 0,
    isLiked: likedIds.has(review.id),
    isBusy: likeBusyIds.has(review.id),
    onToggleLike: handleToggleLike,
    onViewProfile,
    onSelectMovieById,
    onOpenReview,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-10"
    >
      {/* ── HEADER ── */}
      <div className="flex items-center gap-4">
        <div
          className="hidden sm:flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-red-650 to-red-600 text-white shadow-md shadow-red-950/30"
          aria-hidden="true"
        >
          <Users className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-neutral-500 uppercase tracking-widest mb-1">Discover together</p>
          <h1 className="text-3xl font-bold text-white">Community</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── MAIN COLUMN ── */}
        <div className="lg:col-span-2 space-y-10">
          {/* Following reviews — only shown when it has real content */}
          {followingReviews.length > 0 && (
            <section aria-labelledby="following-reviews-heading">
              <h2 id="following-reviews-heading" className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-widest">
                <UserCheck className="h-4 w-4 text-neutral-500" aria-hidden="true" />
                From People You Follow
              </h2>
              <p className="text-xs text-neutral-500 mt-1 mb-4">Latest reviews from reviewers you follow.</p>
              <div className="space-y-3">
                {followingReviews.slice(0, 4).map((r) => (
                  <ReviewCard key={r.id} {...reviewCardProps(r)} />
                ))}
              </div>
            </section>
          )}

          {/* Trending this week */}
          {trending.length > 0 && (
            <section aria-labelledby="trending-reviews-heading">
              <h2 id="trending-reviews-heading" className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-widest">
                <TrendingUp className="h-4 w-4 text-neutral-500" aria-hidden="true" />
                Trending This Week
              </h2>
              <p className="text-xs text-neutral-500 mt-1 mb-4">The most-liked reviews from the last 7 days, across the whole community.</p>
              <div className="space-y-3">
                {trending.slice(0, 4).map((r) => (
                  <ReviewCard key={r.id} {...reviewCardProps(r)} />
                ))}
              </div>
            </section>
          )}

          {/* Recent community reviews — the main paginated feed */}
          <section aria-labelledby="recent-reviews-heading">
            <h2 id="recent-reviews-heading" className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-widest">
              <MessageSquare className="h-4 w-4 text-neutral-500" aria-hidden="true" />
              Recent Reviews
            </h2>
            <p className="text-xs text-neutral-500 mt-1 mb-4">Every new review, newest first — not filtered by who you follow.</p>

            {feedStatus === "loading" ? (
              <div className="space-y-3" role="status" aria-label="Loading community reviews">
                {[1, 2, 3].map((i) => <ReviewCardSkeleton key={i} />)}
              </div>
            ) : feedStatus === "error" ? (
              <div role="alert" className="rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.02] px-4 py-8 text-center space-y-3">
                <AlertCircle className="h-7 w-7 text-neutral-700 mx-auto" aria-hidden="true" />
                <p className="text-sm font-semibold text-neutral-400">Couldn't load community reviews</p>
                <p className="text-xs text-neutral-500 max-w-xs mx-auto">{feedError}</p>
                <button
                  onClick={() => loadFeed(feedLimit)}
                  className="inline-flex items-center gap-2 rounded-lg bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-red-400 border border-white/[0.08] hover:bg-white/[0.08] transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  <RefreshCw className="h-3 w-3" aria-hidden="true" />
                  Try again
                </button>
              </div>
            ) : feed.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.02] px-4 py-10 text-center space-y-2">
                <Inbox className="h-7 w-7 text-neutral-700 mx-auto" aria-hidden="true" />
                <p className="text-sm font-semibold text-neutral-400">No reviews yet</p>
                <p className="text-xs text-neutral-500">Be the first to review a movie and start the conversation.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {feed.map((r) => (
                  <ReviewCard key={r.id} {...reviewCardProps(r)} />
                ))}
                {feed.length >= feedLimit && (
                  <button
                    onClick={() => setFeedLimit((prev) => prev + FEED_PAGE_SIZE)}
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] py-2.5 text-xs font-semibold text-neutral-300 hover:text-white hover:border-white/[0.16] hover:bg-white/[0.04] transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500"
                  >
                    Load more reviews
                  </button>
                )}
              </div>
            )}
          </section>
        </div>

        {/* ── SIDEBAR ── */}
        <div className="space-y-8">
          {/* People to discover — signed-in only, real taste/activity data */}
          {userId && (
            <section aria-labelledby="discover-people-heading" className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <h2 id="discover-people-heading" className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-widest">
                <UserPlus className="h-3.5 w-3.5 text-neutral-500" aria-hidden="true" />
                People to Discover
              </h2>
              <p className="text-[11px] text-neutral-500 mt-1 mb-4">Recently active reviewers you don't yet follow.</p>
              {secondaryLoading ? (
                <div className="space-y-3" role="status" aria-label="Loading people to discover">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-2.5 animate-pulse">
                      <div className="h-8 w-8 rounded-full bg-neutral-800 shrink-0" />
                      <div className="flex-1 h-2.5 rounded bg-neutral-800" />
                    </div>
                  ))}
                </div>
              ) : reviewers.length === 0 ? (
                <p className="text-xs text-neutral-500">No active reviewers to show yet.</p>
              ) : (
                <ul className="space-y-3">
                  {reviewers.map((r) => {
                    const isFollowing = followingSet.has(r.id);
                    const busy = followBusyIds.has(r.id);
                    return (
                      <li key={r.id} className="flex items-center justify-between gap-2">
                        <button
                          onClick={() => onViewProfile(r.id)}
                          className="flex items-center gap-2.5 min-w-0 text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 cursor-pointer group"
                        >
                          {r.avatar_url ? (
                            <img
                              src={r.avatar_url}
                              alt=""
                              aria-hidden="true"
                              loading="lazy"
                              decoding="async"
                              referrerPolicy="no-referrer"
                              className="h-8 w-8 rounded-full object-cover shrink-0 border border-neutral-700"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold bg-neutral-800 border border-neutral-700 text-neutral-300">
                              {initialsOf(r.display_name)}
                            </div>
                          )}
                          <span className="text-xs font-semibold text-neutral-200 truncate max-w-[90px] group-hover:text-white group-hover:underline">
                            {r.display_name ?? "Anonymous"}
                          </span>
                        </button>
                        <button
                          onClick={() => handleToggleFollow(r.id)}
                          disabled={busy}
                          aria-pressed={isFollowing}
                          aria-label={isFollowing ? `Unfollow ${r.display_name ?? "this reviewer"}` : `Follow ${r.display_name ?? "this reviewer"}`}
                          className={`shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                            isFollowing
                              ? "bg-white/[0.05] text-neutral-400 border border-white/[0.08] hover:bg-white/[0.08]"
                              : "bg-red-650 text-white hover:bg-red-600"
                          }`}
                        >
                          {busy ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : isFollowing ? "Following" : "Follow"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {/* Top reviewers leaderboard — always shown, pure aggregate data */}
          <section aria-labelledby="leaderboard-heading" className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <h2 id="leaderboard-heading" className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-widest">
              <Trophy className="h-3.5 w-3.5 text-neutral-500" aria-hidden="true" />
              Top Reviewers
            </h2>
            <p className="text-[11px] text-neutral-500 mt-1 mb-4">Ranked by total reviews written.</p>
            {secondaryLoading ? (
              <div className="space-y-3" role="status" aria-label="Loading top reviewers">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-2.5 animate-pulse">
                    <div className="h-8 w-8 rounded-full bg-neutral-800 shrink-0" />
                    <div className="flex-1 h-2.5 rounded bg-neutral-800" />
                  </div>
                ))}
              </div>
            ) : leaderboard.length === 0 ? (
              <p className="text-xs text-neutral-500">No leaderboard data yet.</p>
            ) : (
              <ol className="space-y-3">
                {leaderboard.map((entry, i) => (
                  <li key={entry.user_id}>
                    <button
                      onClick={() => onViewProfile(entry.user_id)}
                      className="flex items-center gap-2.5 w-full text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 cursor-pointer group"
                    >
                      <span className="w-4 shrink-0 text-[11px] font-bold text-neutral-600" aria-hidden="true">{i + 1}</span>
                      {entry.avatar_url ? (
                        <img
                          src={entry.avatar_url}
                          alt=""
                          aria-hidden="true"
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          className="h-8 w-8 rounded-full object-cover shrink-0 border border-neutral-700"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold bg-neutral-800 border border-neutral-700 text-neutral-300">
                          {initialsOf(entry.display_name)}
                        </div>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold text-neutral-200 truncate group-hover:text-white group-hover:underline">
                          {entry.display_name ?? "Anonymous"}
                        </span>
                        <span className="block text-[10px] text-neutral-500">{entry.label}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>

      {/* Highly rated by the community — full-width movie rail, reuses
          MovieRail/MovieCard for direct, consistent movie navigation. */}
      {communityFavoriteMovies.length >= 4 && (
        <MovieRail
          id="community-highly-rated"
          title="Highly Rated by the Community"
          subtitle="Movies the community is loving right now"
          icon={Globe}
          accent="amber"
          movies={communityFavoriteMovies}
          isLoading={false}
          onMovieClick={onSelectMovie}
          isSaved={isMovieSaved}
          onToggleSave={onToggleSave}
        />
      )}
    </motion.div>
  );
}