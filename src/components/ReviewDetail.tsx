// src/components/ReviewDetail.tsx
//
// Phase 50 — Review Detail & Discussion Experience.
//
// AUDIT FINDING (see final report): the Supabase schema has no
// replies/comments/thread table anywhere — `reviews.comment` is the review
// body itself, not a comment-on-a-review system. No new table was added to
// force a discussion feature into existence; this page focuses on making
// the review itself, and its already-supported engagement (likes AND
// helpful votes — both real, pre-existing backend features), the complete
// experience. A future phase can add threaded replies if a schema change is
// explicitly approved.
//
// Data flow: this page receives `combinedMoviePool` (already loaded by
// App.tsx) so the movie context needs zero extra fetch, and fetches only
// the ONE review via the new getReviewById() plus its like/helpful counts
// via the existing batch functions called with a single-id array — no
// re-fetch of the whole Community feed just to show one review.
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowLeft, Star, Heart, ThumbsUp, Film, AlertCircle, RefreshCw, SearchX, Loader2,
} from "lucide-react";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  getReviewById,
  getReviewLikeCounts,
  getUserLikes,
  likeReview,
  unlikeReview,
  getHelpfulVoteCounts,
  getUserHelpfulVotes,
  voteHelpful,
  unvoteHelpful,
  type CommunityReview,
} from "../services/supabase/social";
import { useToast } from "../context/ToastContext";
import type { Movie } from "../types";

interface ReviewDetailProps {
  reviewId: string;
  combinedMoviePool: Movie[];
  onBack: () => void;
  onSelectMovie: (movie: Movie) => void;
  onViewProfile: (userId: string) => void;
  onOpenAuth: () => void;
}

function initialsOf(name: string | null): string {
  if (!name?.trim()) return "?";
  return name.trim().split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function releaseYear(dateStr?: string): string | null {
  if (!dateStr) return null;
  const y = new Date(dateStr).getFullYear();
  return Number.isNaN(y) ? null : String(y);
}

export default function ReviewDetail({
  reviewId,
  combinedMoviePool,
  onBack,
  onSelectMovie,
  onViewProfile,
  onOpenAuth,
}: ReviewDetailProps) {
  const [user, setUser] = useState(auth.currentUser);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  const userId = user?.uid ?? null;

  const { showToast } = useToast();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const [review, setReview] = useState<CommunityReview | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "not-found" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const [likeCount, setLikeCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);

  const [helpfulCount, setHelpfulCount] = useState(0);
  const [isHelpful, setIsHelpful] = useState(false);
  const [helpfulBusy, setHelpfulBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    setErrorMsg("");

    const res = await getReviewById(reviewId);
    if (res.error) {
      setErrorMsg(res.error);
      setStatus("error");
      return;
    }
    if (!res.data) {
      setStatus("not-found");
      return;
    }
    setReview(res.data);
    setStatus("ready");

    const [likeCountsRes, helpfulCountsRes, userLikesRes, userHelpfulRes] = await Promise.all([
      getReviewLikeCounts([reviewId]),
      getHelpfulVoteCounts([reviewId]),
      userId ? getUserLikes(userId) : Promise.resolve({ data: [], error: null }),
      userId ? getUserHelpfulVotes(userId) : Promise.resolve({ data: [], error: null }),
    ]);
    setLikeCount(likeCountsRes.data?.[reviewId] ?? 0);
    setHelpfulCount(helpfulCountsRes.data?.[reviewId] ?? 0);
    setIsLiked((userLikesRes.data ?? []).includes(reviewId));
    setIsHelpful((userHelpfulRes.data ?? []).includes(reviewId));
  }, [reviewId, userId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [status]);

  async function handleToggleLike() {
    if (!userId) { onOpenAuth(); return; }
    if (likeBusy) return;
    setLikeBusy(true);
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikeCount((c) => Math.max(0, c + (wasLiked ? -1 : 1)));

    const res = wasLiked ? await unlikeReview(reviewId, userId) : await likeReview(reviewId, userId);
    if (res.error) {
      setIsLiked(wasLiked);
      setLikeCount((c) => Math.max(0, c + (wasLiked ? 1 : -1)));
      showToast("Couldn't update like — please try again.", "error");
    }
    setLikeBusy(false);
  }

  async function handleToggleHelpful() {
    if (!userId) { onOpenAuth(); return; }
    if (helpfulBusy) return;
    setHelpfulBusy(true);
    const wasHelpful = isHelpful;
    setIsHelpful(!wasHelpful);
    setHelpfulCount((c) => Math.max(0, c + (wasHelpful ? -1 : 1)));

    const res = wasHelpful ? await unvoteHelpful(reviewId, userId) : await voteHelpful(reviewId, userId);
    if (res.error) {
      setIsHelpful(wasHelpful);
      setHelpfulCount((c) => Math.max(0, c + (wasHelpful ? 1 : -1)));
      showToast("Couldn't update helpful vote — please try again.", "error");
    }
    setHelpfulBusy(false);
  }

  const movie = review ? combinedMoviePool.find((m) => m.id === review.movie_id) : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto px-4 py-8"
    >
      {/* ── BACK NAVIGATION ── */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-400 hover:text-white transition-colors mb-6 cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to Community
      </button>

      {status === "loading" ? (
        <div className="space-y-4" role="status" aria-label="Loading review">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-neutral-800 animate-pulse" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-32 rounded bg-neutral-800 animate-pulse" />
              <div className="h-2.5 w-20 rounded bg-neutral-800/60 animate-pulse" />
            </div>
          </div>
          <div className="h-24 rounded-2xl bg-neutral-800/40 animate-pulse" />
          <div className="space-y-2">
            <div className="h-2.5 w-full rounded bg-neutral-800/60 animate-pulse" />
            <div className="h-2.5 w-full rounded bg-neutral-800/60 animate-pulse" />
            <div className="h-2.5 w-3/4 rounded bg-neutral-800/40 animate-pulse" />
          </div>
        </div>
      ) : status === "not-found" ? (
        <div className="rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.02] px-6 py-14 text-center space-y-3">
          <SearchX className="h-8 w-8 text-neutral-700 mx-auto" aria-hidden="true" />
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-base font-semibold text-neutral-300 focus-visible:outline-none"
          >
            This review no longer exists
          </h1>
          <p className="text-xs text-neutral-500">It may have been deleted or edited since you followed the link.</p>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-lg bg-white/[0.05] px-4 py-2 text-xs font-semibold text-red-400 border border-white/[0.08] hover:bg-white/[0.08] transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500"
          >
            Back to Community
          </button>
        </div>
      ) : status === "error" ? (
        <div role="alert" className="rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.02] px-6 py-14 text-center space-y-3">
          <AlertCircle className="h-8 w-8 text-neutral-700 mx-auto" aria-hidden="true" />
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-base font-semibold text-neutral-300 focus-visible:outline-none"
          >
            Couldn't load this review
          </h1>
          <p className="text-xs text-neutral-500 max-w-xs mx-auto">{errorMsg}</p>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-lg bg-white/[0.05] px-4 py-2 text-xs font-semibold text-red-400 border border-white/[0.08] hover:bg-white/[0.08] transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Try again
          </button>
        </div>
      ) : review ? (
        <article aria-labelledby="review-detail-heading">
          {/* ── REVIEWER ── */}
          <div className="flex items-center justify-between gap-3 mb-6">
            <button
              onClick={() => onViewProfile(review.user_id)}
              className="flex items-center gap-3 min-w-0 text-left rounded-lg cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              {review.profiles?.avatar_url ? (
                <img
                  src={review.profiles.avatar_url}
                  alt=""
                  aria-hidden="true"
                  loading="eager"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="h-11 w-11 rounded-full object-cover shrink-0 border border-neutral-700"
                />
              ) : (
                <div className="h-11 w-11 rounded-full shrink-0 flex items-center justify-center text-sm font-bold bg-neutral-800 border border-neutral-700 text-neutral-300">
                  {initialsOf(review.profiles?.display_name ?? null)}
                </div>
              )}
              <div className="min-w-0">
                <h1
                  id="review-detail-heading"
                  ref={headingRef}
                  tabIndex={-1}
                  className="text-sm font-bold text-white truncate group-hover:underline focus-visible:outline-none"
                >
                  {review.profiles?.display_name ?? "Anonymous"}
                </h1>
                <p className="text-xs text-neutral-500">{relativeTime(review.created_at)}</p>
              </div>
            </button>

            <span className="shrink-0 flex items-center gap-1.5 text-sm font-bold text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/10">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
              {review.rating}/10
            </span>
          </div>

          {/* ── MOVIE CONTEXT ── */}
          <div className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 mb-6">
            <div className="h-20 w-14 shrink-0 rounded-lg overflow-hidden border border-white/[0.08] bg-neutral-900 flex items-center justify-center">
              {movie?.posterPath ? (
                <img
                  src={movie.posterPath}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Film className="h-5 w-5 text-neutral-700" aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white truncate">{review.movie_title}</p>
              {movie && (
                <p className="text-xs text-neutral-500 mt-0.5">
                  {[releaseYear(movie.releaseDate), movie.genres?.slice(0, 2).join(", ")].filter(Boolean).join(" · ")}
                </p>
              )}
              {movie ? (
                <button
                  onClick={() => onSelectMovie(movie)}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-red-400 hover:text-red-300 hover:underline cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  View Movie
                </button>
              ) : (
                <p className="mt-2 text-xs text-neutral-600">This title is no longer in the catalog.</p>
              )}
            </div>
          </div>

          {/* ── REVIEW TEXT ── */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
            <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap break-words">
              {review.comment}
            </p>
          </div>

          {/* ── ENGAGEMENT ── */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleLike}
              disabled={likeBusy}
              aria-pressed={isLiked}
              aria-label={isLiked ? `Unlike this review (${likeCount} likes)` : `Like this review (${likeCount} likes)`}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                isLiked ? "text-red-400 bg-red-500/10 border border-red-500/20" : "text-neutral-400 bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06]"
              }`}
            >
              {likeBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Heart className={`h-4 w-4 ${isLiked ? "fill-red-400" : ""}`} aria-hidden="true" />
              )}
              {likeCount > 0 ? `${likeCount} ${likeCount === 1 ? "Like" : "Likes"}` : "Like"}
            </button>

            <button
              onClick={handleToggleHelpful}
              disabled={helpfulBusy}
              aria-pressed={isHelpful}
              aria-label={isHelpful ? `Remove helpful vote (${helpfulCount} found this helpful)` : `Mark as helpful (${helpfulCount} found this helpful)`}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                isHelpful ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20" : "text-neutral-400 bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06]"
              }`}
            >
              {helpfulBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ThumbsUp className={`h-4 w-4 ${isHelpful ? "fill-emerald-400" : ""}`} aria-hidden="true" />
              )}
              {helpfulCount > 0 ? `${helpfulCount} found helpful` : "Mark helpful"}
            </button>
          </div>
        </article>
      ) : null}
    </motion.div>
  );
}