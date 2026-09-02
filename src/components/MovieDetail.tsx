import React, { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { Movie, Review } from "../types";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { 
  ArrowLeft, Star, Clock, Calendar, Film, Bookmark, BookmarkCheck,
  MessageSquare, Send, Film as PlayIcon, Sparkles, CheckCircle2, Info, Compass, Pencil, Trash2
} from "lucide-react";
import MovieRail from "./MovieRail";
import WhereToWatch from "./WhereToWatch";
import { listMovieReviews, getUserReview, createReview, updateReview, deleteReview } from "../services/supabase/reviews";
import { setUserRating, deleteRating } from "../services/supabase/ratings";
import { useToast } from "../context/ToastContext";

// Pure helpers — cheap, no allocation beyond a single Date parse per call.
// Phase 47 — reviews are already fetched in a single query (see reviews.ts);
// this constant only controls how many are rendered into the DOM at once.
// "Load more" reveals additional already-fetched reviews with no extra
// network round-trip.
const REVIEWS_PAGE_SIZE = 6;

function formatReleaseDate(dateStr?: string): string {
  if (!dateStr) return "Release date unknown";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function getReleaseStatus(dateStr?: string): { label: string; isFuture: boolean } {
  if (!dateStr) return { label: "Unknown", isFuture: false };
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { label: "Unknown", isFuture: false };
  return { label: d.getTime() > Date.now() ? "Upcoming" : "Released", isFuture: d.getTime() > Date.now() };
}

function formatRuntime(minutes?: number): string | null {
  if (!minutes || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatVoteCount(count?: number): string {
  if (!count || count <= 0) return "no ratings yet";
  return `${count.toLocaleString()} ratings`;
}

// Small count-up animation for the rating/stat numbers. Respects
// prefers-reduced-motion by rendering the final value immediately instead
// of animating — same pattern already used for the amber "ping" dot
// elsewhere in the app (motion-reduce:animate-none).
function AnimatedNumber({ value, decimals = 0, duration = 0.8 }: { value: number; decimals?: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const prefersReducedMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    []
  );

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplay(value);
      return;
    }
    let raf: number;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / (duration * 1000));
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplay(from + (value - from) * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, prefersReducedMotion]);

  return <>{display.toFixed(decimals)}</>;
}

interface MovieDetailProps {
  key?: string | number;
  movie: Movie;
  onBack: () => void;
  onOpenAuth: () => void;
  relatedPool?: Movie[];
  onSelectMovie?: (movie: Movie) => void;
  watchlistIds?: Set<string>;
  onToggleSave?: (movie: Movie) => void | Promise<void>;
}

export default function MovieDetail({ movie, onBack, onOpenAuth, relatedPool, onSelectMovie, watchlistIds, onToggleSave }: MovieDetailProps) {
  const { showToast } = useToast();
  const [user, setUser] = useState(auth.currentUser);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [backdropError, setBackdropError] = useState(false);
  const [posterError, setPosterError] = useState(false);
  const [failedCastIds, setFailedCastIds] = useState<Set<string>>(new Set());
  const [trailerLoaded, setTrailerLoaded] = useState(false);
  const [overviewExpanded, setOverviewExpanded] = useState(false);

  // Reviews state
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [visibleReviewCount, setVisibleReviewCount] = useState(REVIEWS_PAGE_SIZE);
  // Phase 51 — review sort control. Purely client-side: all reviews for a
  // movie are already fetched in a single query (see listMovieReviews), so
  // changing sort order never triggers a new network request. "Newest" is
  // the server's own default order (created_at DESC), so that branch is a
  // no-op passthrough rather than a redundant re-sort.
  const [reviewSort, setReviewSort] = useState<"newest" | "highest">("newest");
  const [newRating, setNewRating] = useState(10);
  const [newComment, setNewComment] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [userReviewId, setUserReviewId] = useState<string | null>(null);
  const [isEditingReview, setIsEditingReview] = useState(false);

  // Auth sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // Load all reviews for this movie from Supabase
  useEffect(() => {
    let cancelled = false;
    setReviewsLoading(true);
    setReviewsError(null);
    setVisibleReviewCount(REVIEWS_PAGE_SIZE);

    listMovieReviews(movie.id).then((result) => {
      if (cancelled) return;
      if (result.error) {
        console.error("Failed to load reviews:", result.error);
        setReviewsError(result.error);
        setReviewsLoading(false);
        return;
      }
      const mapped: Review[] = (result.data ?? []).map((r) => ({
        id: r.id,
        movieId: r.movie_id,
        userId: r.user_id,
        userEmail: r.profiles?.display_name || r.user_id,
        displayName: r.profiles?.display_name ?? null,
        avatarUrl: r.profiles?.avatar_url ?? null,
        rating: r.rating ?? 0,
        comment: r.comment,
        createdAt: new Date(r.created_at).getTime()
      }));
      setReviews(mapped);
      setReviewsLoading(false);
    });

    return () => { cancelled = true; };
  }, [movie.id]);

  // Phase 51 — derives the displayed order from the already-fetched
  // `reviews` array. "newest" is a passthrough (the server already returns
  // created_at DESC); "highest" does a stable client-side re-sort by
  // rating, ties falling back to the original (newest-first) order. No
  // network request is made when this changes.
  const sortedReviews = useMemo(() => {
    if (reviewSort === "highest") {
      return [...reviews].sort((a, b) => b.rating - a.rating);
    }
    return reviews;
  }, [reviews, reviewSort]);

  function handleReviewSortChange(next: "newest" | "highest") {
    setReviewSort(next);
    // A different order means the first page should show that order's
    // actual top results, not whatever had already been paged into view
    // under the previous order.
    setVisibleReviewCount(REVIEWS_PAGE_SIZE);
  }

  // Load current user's own review so form pre-fills for editing
  useEffect(() => {
    if (!user) { setUserReviewId(null); return; }
    let cancelled = false;

    getUserReview(user.uid, movie.id).then((result) => {
      if (cancelled || result.error) return;
      if (result.data) {
        setUserReviewId(result.data.id);
        setNewRating(result.data.rating ?? 10);
        setNewComment(result.data.comment);
        setIsEditingReview(true);
      } else {
        setUserReviewId(null);
        setNewRating(10);
        setNewComment("");
        setIsEditingReview(false);
      }
    });

    return () => { cancelled = true; };
  }, [user, movie.id]);

  // Toggle watchlist — delegates to the parent's handler (Supabase-backed),
  // so this page and the rest of the app always read/write the same source.
  const handleToggleWatchlist = async () => {
    if (!user) {
      onOpenAuth();
      return;
    }
    if (!onToggleSave) return;

    setWatchlistLoading(true);
    try {
      await onToggleSave(movie);
    } catch (err) {
      console.error("Error updating watchlist:", err);
    } finally {
      setWatchlistLoading(false);
    }
  };

  // Create or update the current user's review
  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { onOpenAuth(); return; }
    if (!newComment.trim()) return;

    setSubmitLoading(true);
    try {
      if (isEditingReview && userReviewId) {
        // Update existing
        const result = await updateReview(userReviewId, user.uid, { rating: newRating, comment: newComment });
        if (result.error) throw new Error(result.error);
        setReviews((prev) => prev.map((r) =>
          r.id === userReviewId ? { ...r, rating: newRating, comment: newComment } : r
        ));
      } else {
        // Create new
        const result = await createReview({
          user_id: user.uid,
          movie_id: movie.id,
          movie_title: movie.title,
          rating: newRating,
          comment: newComment
        });
        if (result.error) throw new Error(result.error);
        if (result.data) {
          setUserReviewId(result.data.id);
          setIsEditingReview(true);
          // Also persist the standalone rating row
          await setUserRating(user.uid, movie.id, movie.title, newRating);
          const newReview: Review = {
            id: result.data.id,
            movieId: movie.id,
            userId: user.uid,
            userEmail: user.displayName || user.email || user.uid,
            displayName: user.displayName ?? null,
            avatarUrl: user.photoURL ?? null,
            rating: newRating,
            comment: newComment,
            createdAt: Date.now()
          };
          setReviews((prev) => [newReview, ...prev]);
        }
      }
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving review:", err);
      showToast("Couldn't save your review — please try again.", "error");
    } finally {
      setSubmitLoading(false);
    }
  };

  // Delete the current user's own review
  const handleDeleteReview = async () => {
    if (!user || !userReviewId) return;
    setSubmitLoading(true);
    try {
      const result = await deleteReview(userReviewId, user.uid);
      if (result.error) throw new Error(result.error);
      await deleteRating(user.uid, movie.id);
      setReviews((prev) => prev.filter((r) => r.id !== userReviewId));
      setUserReviewId(null);
      setIsEditingReview(false);
      setNewRating(10);
      setNewComment("");
    } catch (err) {
      console.error("Error deleting review:", err);
      showToast("Couldn't delete your review — please try again.", "error");
    } finally {
      setSubmitLoading(false);
    }
  };

  // Related movies: genre-overlap against whatever pool the parent already fetched
  // (trending + latest combined) — no extra network call, capped for performance.
  // Diversity pass: widen the candidate pool past the display count, then apply
  // a shuffle seeded by THIS movie's id — deterministic and flicker-free for
  // repeat visits to the same title, but different movies (even with heavily
  // overlapping genres) no longer surface the exact same top-12 block.
  const relatedMovies = useMemo(() => {
    if (!relatedPool || relatedPool.length === 0 || !movie.genres?.length) return [];
    const ranked = relatedPool
      .filter((m) => m.id !== movie.id && m.genres?.some((g) => movie.genres.some((mg) => mg.toLowerCase() === g.toLowerCase())))
      .sort((a, b) => b.voteAverage - a.voteAverage);

    let seed = 0;
    for (let i = 0; i < movie.id.length; i++) seed = (seed * 31 + movie.id.charCodeAt(i)) | 0;

    const widened = ranked.slice(0, 24);
    const shuffled = [...widened];
    let s = seed;
    const rand = () => {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, 12);
  }, [relatedPool, movie.id, movie.genres]);

  // Community average from already-loaded reviews — cheap O(n) over a small list.
  const communityAverage = useMemo(() => {
    if (reviews.length === 0) return null;
    return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  }, [reviews]);

  const releaseStatus = useMemo(() => getReleaseStatus(movie.releaseDate), [movie.releaseDate]);
  const formattedRelease = useMemo(() => formatReleaseDate(movie.releaseDate), [movie.releaseDate]);
  const formattedRuntime = useMemo(() => formatRuntime(movie.runtime), [movie.runtime]);
  const hasOverview = !!movie.overview && movie.overview.trim().length > 0;
  const isLongOverview = hasOverview && movie.overview.length > 280;
  const isInWatchlist = watchlistIds?.has(movie.id) ?? false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.4 }}
      className="pb-24 text-neutral-100"
    >
      {/* Dynamic Header Backdrop Hero */}
      <div className="relative h-[450px] w-full overflow-hidden">
        <div className="absolute inset-x-0 top-0 z-10 p-6 flex justify-between absolute-nav">
          <button
            id="movie-detail-back-btn"
            onClick={onBack}
            className="flex items-center gap-2 rounded-full bg-neutral-900/70 px-4 py-2 text-sm font-semibold text-white backdrop-blur-xl border border-white/[0.1] shadow-lg hover:bg-neutral-800/80 hover:text-red-400 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to movies
          </button>

          <button
            id="movie-watchlist-toggle"
            onClick={handleToggleWatchlist}
            disabled={watchlistLoading}
            aria-pressed={isInWatchlist}
            className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-all backdrop-blur-xl border cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-red-500 ${
              isInWatchlist
                ? "bg-red-500/20 border-red-500/50 text-red-300 shadow-[0_8px_30px_-8px_rgba(220,38,38,0.5)]"
                : "bg-neutral-900/70 border-white/[0.1] text-white shadow-lg hover:bg-neutral-800/80"
            }`}
          >
            {isInWatchlist ? (
              <>
                <BookmarkCheck className="h-4 w-4 text-red-400 fill-red-400" />
                In Watchlist
              </>
            ) : (
              <>
                <Bookmark className="h-4 w-4 text-neutral-300" />
                Add to Watchlist
              </>
            )}
          </button>
        </div>

        {/* Backdrop Image — Phase 53: /w1280/ instead of /original/ saves
            2–5 MB on mobile for what is a ~300 px tall container. Full
            /original/ resolution was never perceptible at this display size. */}
        {!backdropError && movie.backdropPath ? (
          <img
            src={movie.backdropPath?.replace("/original/", "/w1280/")}
            alt={movie.title}
            referrerPolicy="no-referrer"
            fetchPriority="high"
            decoding="async"
            onError={() => setBackdropError(true)}
            className="h-full w-full object-cover brightness-[0.4]"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-neutral-900 to-neutral-950 flex items-center justify-center">
            <Film className="h-16 w-16 text-neutral-800" aria-hidden="true" />
          </div>
        )}

        {/* Ambient Overlay Shade */}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/20 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-950/50 via-transparent to-transparent" />

        {/* Short specs panel on bottom left */}
        <div className="absolute bottom-0 left-0 right-0 p-8 max-w-[1600px] mx-auto flex flex-col md:flex-row items-end gap-8 z-10 w-full">
          {/* Flat Poster Card */}
          <div className="hidden md:block w-48 shrink-0 rounded-2xl overflow-hidden border border-white/[0.08] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] bg-neutral-950 aspect-[2/3]">
            {!posterError && movie.posterPath ? (
              <img
                src={movie.posterPath}
                alt={movie.title}
                referrerPolicy="no-referrer"
                loading="lazy"
                decoding="async"
                onError={() => setPosterError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-neutral-900 text-neutral-700 p-3">
                <Film className="h-10 w-10" aria-hidden="true" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-center leading-tight">{movie.title}</span>
              </div>
            )}
          </div>

          <div className="flex-1 text-left">
            {/* Tagline */}
            {movie.tagline && (
              <p className="text-red-400 text-sm font-medium uppercase tracking-widest bg-red-500/10 inline-block px-3 py-1 rounded-full mb-3 border border-red-500/10">
                {movie.tagline}
              </p>
            )}

            {/* Title */}
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white mb-2 leading-none">
              {movie.title}
            </h1>

            {/* Specs bar (year, runtime, director, rating) */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-neutral-300">
              <span className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md ${releaseStatus.isFuture ? "bg-indigo-500/10 text-indigo-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                {releaseStatus.label}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4 text-neutral-500" />
                {formattedRelease}
              </span>
              {formattedRuntime && (
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4 text-neutral-500" />
                  {formattedRuntime}
                </span>
              )}
              {movie.director && (
                <span className="flex items-center gap-1">
                  <Film className="h-4 w-4 text-neutral-500" />
                  Directed by {movie.director}
                </span>
              )}
              <span className="flex items-center gap-1.5 font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/10 shadow-sm">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <AnimatedNumber value={movie.voteAverage} decimals={1} /> <span className="text-neutral-500 font-normal">({formatVoteCount(movie.voteCount)})</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Primary body information grids */}
      <div className="max-w-[1600px] mx-auto px-6 py-12 text-left">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main overview & crew left list */}
          <div className="lg:col-span-2 space-y-10">
            {/* Overview section */}
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white pb-3 border-b border-white/[0.06] mb-4 uppercase text-neutral-400">
                Plot Overview
              </h2>
              {hasOverview ? (
                <>
                  <p className={`text-neutral-300 leading-relaxed text-base italic-quotes ${isLongOverview && !overviewExpanded ? "line-clamp-4" : ""}`}>
                    "{movie.overview}"
                  </p>
                  {isLongOverview && (
                    <button
                      id="overview-toggle-btn"
                      onClick={() => setOverviewExpanded(!overviewExpanded)}
                      aria-expanded={overviewExpanded}
                      className="mt-2 text-xs font-bold text-red-400 hover:text-red-300 cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500 rounded"
                    >
                      {overviewExpanded ? "Show less" : "Read more"}
                    </button>
                  )}
                </>
              ) : (
                <p className="text-neutral-400 text-sm italic">No synopsis available for this title yet.</p>
              )}
            </div>

            {/* Genres */}
            {movie.genres && movie.genres.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold tracking-wider text-neutral-400 uppercase mb-3">
                  Genres
                </h3>
                <div className="flex flex-wrap gap-2">
                  {movie.genres.map((g, idx) => (
                    <span
                      key={`${movie.id}-genpage-${idx}`}
                      className="rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 py-1.5 text-sm font-medium text-neutral-200"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Principal Cast actors present */}
            {movie.cast && movie.cast.length > 0 && (
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white pb-3 border-b border-white/[0.06] mb-5 uppercase text-neutral-400">
                  Principal Cast
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {movie.cast.map((c, castIdx) => (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: Math.min(castIdx, 8) * 0.05 }}
                      whileHover={{ y: -4 }}
                      className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 text-center flex flex-col items-center transition-all hover:border-white/[0.14] hover:bg-white/[0.05] hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.6)]"
                    >
                      {!failedCastIds.has(c.id) && c.profilePath ? (
                        <img
                          src={c.profilePath}
                          alt={c.name}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          decoding="async"
                          onError={() => setFailedCastIds((prev) => new Set(prev).add(c.id))}
                          className="h-24 w-24 rounded-full object-cover mb-3 border border-white/[0.08] shadow-md grayscale hover:grayscale-0 transition-all duration-300"
                        />
                      ) : (
                        <div className="h-24 w-24 rounded-full mb-3 border border-white/[0.08] shadow-md bg-neutral-800 flex items-center justify-center text-sm font-bold text-neutral-400">
                          {c.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                        </div>
                      )}
                      <h4 className="text-sm font-semibold text-white leading-snug truncate w-full">
                        {c.name}
                      </h4>
                      <p className="text-xs text-neutral-400 mt-1 truncate w-full">
                        {c.character}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Embedded video Trailer section — Task 3: loading state + fallback
                when unavailable, instead of the whole section silently vanishing */}
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white pb-3 border-b border-white/[0.06] mb-5 uppercase text-neutral-400 flex items-center gap-2">
                <PlayIcon className="h-5 w-5 text-red-500" />
                Official Trailer
              </h2>
              {movie.trailerUrl ? (
                <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-white/[0.06] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.7)] bg-black">
                  {!trailerLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center bg-neutral-950" role="status" aria-label="Loading trailer">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-700 border-t-red-500" aria-hidden="true" />
                    </div>
                  )}
                  <iframe
                    src={movie.trailerUrl}
                    title={`${movie.title} Trailer`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    onLoad={() => setTrailerLoaded(true)}
                    className="absolute inset-0 h-full w-full"
                  />
                </div>
              ) : (
                <div className="aspect-video w-full rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] flex flex-col items-center justify-center gap-2 text-center px-6">
                  <PlayIcon className="h-8 w-8 text-neutral-700" aria-hidden="true" />
                  <p className="text-sm font-semibold text-neutral-400">No trailer available yet</p>
                  <p className="text-xs text-neutral-500 max-w-xs">We don't have a trailer on file for this title right now.</p>
                </div>
              )}
            </div>
          </div>

          {/* Right sidebar: User rating widget & Custom reviews list */}
          <div className="space-y-8">
            {/* Where to Watch — Task 43: real external availability, sourced from TMDB */}
            <WhereToWatch movieId={movie.id} />

            {/* Quick Facts panel — surfaces metadata already on the Movie object */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 backdrop-blur-xl shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)]">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                <Info className="h-4 w-4 text-neutral-500" aria-hidden="true" />
                Quick Facts
              </h3>
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-neutral-500">Status</dt>
                  <dd className={`font-bold px-2 py-0.5 rounded-md text-xs ${releaseStatus.isFuture ? "bg-indigo-500/10 text-indigo-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                    {releaseStatus.label}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-neutral-500">Release Date</dt>
                  <dd className="font-semibold text-white text-right">{formattedRelease}</dd>
                </div>
                {formattedRuntime && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-neutral-500">Runtime</dt>
                    <dd className="font-semibold text-white">{formattedRuntime}</dd>
                  </div>
                )}
                {movie.director && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-neutral-500">Director</dt>
                    <dd className="font-semibold text-white text-right truncate max-w-[60%]">{movie.director}</dd>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-neutral-500">Critic Score</dt>
                  <dd className="font-semibold text-amber-400 flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-amber-400" aria-hidden="true" />
                    <AnimatedNumber value={movie.voteAverage} decimals={1} />
                    <span className="text-neutral-400 font-normal">({formatVoteCount(movie.voteCount)})</span>
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-neutral-500">Community Score</dt>
                  <dd className="font-semibold">
                    {communityAverage !== null ? (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <Star className="h-3.5 w-3.5 fill-emerald-400" aria-hidden="true" />
                        {communityAverage.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-neutral-400 font-normal text-xs">No ratings yet</span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Write a review box */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 backdrop-blur-xl shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)] self-start">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-amber-400" />
                  {isEditingReview ? "Your Review" : "Community Review"}
                </h3>
                {isEditingReview && userReviewId && (
                  <button
                    onClick={handleDeleteReview}
                    disabled={submitLoading}
                    aria-label="Delete your review"
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                )}
              </div>
              <p className="text-xs text-neutral-400 mb-4">
                {isEditingReview ? "Update or remove your published review." : "Cast your vote and review this film!"}
              </p>

              {user ? (
                <form onSubmit={handleAddReview} className="space-y-4">
                  {submitSuccess && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-center text-xs font-semibold text-emerald-400 flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {isEditingReview ? "Review updated!" : "Review published!"}
                    </motion.div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-1.5">
                      Your Rating ({newRating}/10)
                    </label>
                    <div className="flex items-center gap-2">
                      <Star className="h-5 w-5 fill-amber-400 text-amber-400 shrink-0" />
                      <input
                        id="review-rating-slider"
                        type="range"
                        min="1"
                        max="10"
                        step="1"
                        value={newRating}
                        onChange={(e) => setNewRating(Number(e.target.value))}
                        className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-red-500"
                      />
                    </div>
                  </div>

                  <div>
                    <textarea
                      id="review-text-input"
                      required
                      placeholder="Write your critical review or thoughts here..."
                      rows={4}
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="w-full rounded-xl border border-white/[0.08] bg-neutral-950/60 p-3 text-sm text-white placeholder-neutral-600 outline-none focus:border-red-500/50 transition-all resize-none"
                    />
                  </div>

                  <button
                    id="submit-review-btn"
                    type="submit"
                    disabled={submitLoading}
                    className="w-full rounded-2xl bg-gradient-to-r from-red-600 to-amber-600 py-2.5 text-sm font-semibold text-[#ffffff] shadow-[0_10px_30px_-8px_rgba(220,38,38,0.5)] hover:shadow-[0_14px_36px_-8px_rgba(220,38,38,0.65)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 focus-visible:ring-red-400"
                  >
                    {submitLoading ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#ffffff] border-t-transparent" />
                    ) : isEditingReview ? (
                      <>
                        <Pencil className="h-4 w-4" />
                        Update Review
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Publish Review
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <div className="rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02] p-4 text-center">
                  <p className="text-xs text-neutral-400 mb-3">
                    Sign in to share your critical film analysis with the community.
                  </p>
                  <button
                    id="auth-trigger-detail-btn"
                    onClick={onOpenAuth}
                    className="rounded-lg bg-white/[0.05] px-4 py-2 text-xs font-semibold text-red-400 border border-white/[0.08] hover:bg-white/[0.08] transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500"
                  >
                    Sign in here
                  </button>
                </div>
              )}
            </div>

            {/* Community Reviews Feed */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white uppercase tracking-wider text-neutral-400 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-neutral-500" />
                  Community Reviews
                </h3>
                {reviews.length > 0 && (
                  <div className="flex items-center gap-2">
                    <label htmlFor="review-sort-select" className="sr-only">
                      Sort reviews
                    </label>
                    <select
                      id="review-sort-select"
                      value={reviewSort}
                      onChange={(e) => handleReviewSortChange(e.target.value as "newest" | "highest")}
                      className="text-[11px] font-semibold text-neutral-300 bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 hover:border-neutral-600 transition-colors"
                      aria-label="Sort reviews"
                    >
                      <option value="newest">Newest</option>
                      <option value="highest">Highest Rated</option>
                    </select>
                    <span className="text-xs font-bold text-neutral-400 bg-neutral-800 border border-neutral-700 px-2.5 py-1 rounded-full">
                      {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
                    </span>
                  </div>
                )}
              </div>

              {reviewsLoading ? (
                <div className="space-y-3" role="status" aria-label="Loading reviews">
                  {[1, 2].map((i) => (
                    <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3 animate-pulse">
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
                  ))}
                </div>
              ) : reviewsError ? (
                <div role="alert" className="rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.02] px-4 py-8 text-center space-y-3">
                  <MessageSquare className="h-7 w-7 text-neutral-700 mx-auto" />
                  <p className="text-sm font-semibold text-neutral-400">Couldn't load reviews</p>
                  <p className="text-xs text-neutral-500 max-w-xs mx-auto">{reviewsError}</p>
                  <button
                    onClick={() => {
                      setReviewsLoading(true);
                      setReviewsError(null);
                      listMovieReviews(movie.id).then((result) => {
                        if (result.error) {
                          setReviewsError(result.error);
                          setReviewsLoading(false);
                          return;
                        }
                        const mapped: Review[] = (result.data ?? []).map((r) => ({
                          id: r.id,
                          movieId: r.movie_id,
                          userId: r.user_id,
                          userEmail: r.profiles?.display_name || r.user_id,
                          displayName: r.profiles?.display_name ?? null,
                          avatarUrl: r.profiles?.avatar_url ?? null,
                          rating: r.rating ?? 0,
                          comment: r.comment,
                          createdAt: new Date(r.created_at).getTime()
                        }));
                        setReviews(mapped);
                        setReviewsLoading(false);
                      });
                    }}
                    className="rounded-lg bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-red-400 border border-white/[0.08] hover:bg-white/[0.08] transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500"
                  >
                    Try again
                  </button>
                </div>
              ) : reviews.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.02] px-4 py-8 text-center space-y-2">
                  <MessageSquare className="h-7 w-7 text-neutral-700 mx-auto" />
                  <p className="text-sm font-semibold text-neutral-400">No reviews yet</p>
                  <p className="text-xs text-neutral-400 mb-1">
                    {user ? "Be the first to review this film." : "Sign in to leave the first review."}
                  </p>
                  {!user && (
                    <button
                      onClick={onOpenAuth}
                      className="rounded-lg bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-red-400 border border-white/[0.08] hover:bg-white/[0.08] transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500"
                    >
                      Sign in
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3 pr-1">
                  {sortedReviews.slice(0, visibleReviewCount).map((rev) => {
                    const isOwn = rev.userId === user?.uid;
                    const initials = (rev.displayName || rev.userEmail || "?")
                      .split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
                    return (
                      <div
                        key={rev.id}
                        className={`rounded-xl border p-4 space-y-3 text-sm text-left transition-colors ${
                          isOwn
                            ? "border-red-500/20 bg-red-500/5"
                            : "border-white/[0.06] bg-white/[0.02]"
                        }`}
                      >
                        {/* Reviewer row */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Avatar */}
                            {rev.avatarUrl ? (
                              <img
                                src={rev.avatarUrl}
                                alt={rev.displayName || "Reviewer"}
                                referrerPolicy="no-referrer"
                                loading="lazy"
                                decoding="async"
                                className="h-8 w-8 rounded-full object-cover shrink-0 border border-neutral-700"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold bg-neutral-800 border border-neutral-700 text-neutral-300">
                                {initials}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-xs text-neutral-200 truncate max-w-[140px]">
                                  {rev.displayName || "Anonymous"}
                                </span>
                                {isOwn && (
                                  <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full">
                                    You
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-neutral-400 mt-0.5">
                                {new Date(rev.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                              </div>
                            </div>
                          </div>
                          {/* Rating badge */}
                          <span className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/10">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            {rev.rating}/10
                          </span>
                        </div>
                        {/* Review text */}
                        <p className="text-xs text-neutral-400 break-words leading-relaxed">
                          {rev.comment}
                        </p>
                      </div>
                    );
                  })}
                  {visibleReviewCount < sortedReviews.length && (
                    <button
                      onClick={() => setVisibleReviewCount((prev) => prev + REVIEWS_PAGE_SIZE)}
                      className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] py-2.5 text-xs font-semibold text-neutral-300 hover:text-white hover:border-white/[0.16] hover:bg-white/[0.04] transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500"
                      aria-label={`Load ${Math.min(REVIEWS_PAGE_SIZE, sortedReviews.length - visibleReviewCount)} more reviews`}
                    >
                      Load more reviews ({sortedReviews.length - visibleReviewCount} remaining)
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Related Movies: reuses the existing trending+latest pool, no extra fetch */}
      {relatedMovies.length > 0 && (
        <div className="mt-4">
          <MovieRail
            id="related-movies-rail"
            title="You Might Also Like"
            subtitle={movie.genres?.[0] ? `More ${movie.genres[0]} titles` : "Similar titles"}
            icon={Compass}
            accent="indigo"
            movies={relatedMovies}
            onMovieClick={(m) => onSelectMovie?.(m)}
            isSaved={(id) => watchlistIds?.has(id) ?? false}
            onToggleSave={onToggleSave}
          />
        </div>
      )}
    </motion.div>
  );
}