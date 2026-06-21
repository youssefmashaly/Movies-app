import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Movie, Review } from "../types";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "firebase/firestore";
import { 
  ArrowLeft, Star, Clock, Calendar, Film, Bookmark, BookmarkCheck,
  User, MessageSquare, Send, Film as PlayIcon, Sparkles, CheckCircle2 
} from "lucide-react";

interface MovieDetailProps {
  key?: string | number;
  movie: Movie;
  onBack: () => void;
  onOpenAuth: () => void;
}

export default function MovieDetail({ movie, onBack, onOpenAuth }: MovieDetailProps) {
  const [user, setUser] = useState(auth.currentUser);
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);

  // Reviews state
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [newRating, setNewRating] = useState(10);
  const [newComment, setNewComment] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Auth sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // Sync Watchlist state
  useEffect(() => {
    if (!user) {
      setIsInWatchlist(false);
      return;
    }

    const checkWatchlist = async () => {
      try {
        const docRef = doc(db, "watchlist", `${user.uid}_${movie.id}`);
        const docSnap = await getDoc(docRef);
        setIsInWatchlist(docSnap.exists());
      } catch (err) {
        console.error("Error checking watchlist:", err);
      }
    };

    checkWatchlist();
  }, [user, movie.id]);

  // Sync / Listen to Reviews in Real-Time
  useEffect(() => {
    const q = query(
      collection(db, "reviews"),
      where("movieId", "==", movie.id),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loaded: Review[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        loaded.push({
          id: doc.id,
          movieId: data.movieId,
          userId: data.userId,
          userEmail: data.userEmail,
          rating: data.rating,
          comment: data.comment,
          createdAt: data.createdAt?.seconds * 1000 || data.createdAt || Date.now(),
        });
      });
      setReviews(loaded);
      setReviewsLoading(false);
    }, (error) => {
      console.error("Reviews real-time listen failed:", error);
      // Fallback: simple getDocs
      getDocs(query(collection(db, "reviews"), where("movieId", "==", movie.id)))
        .then((snapshot) => {
          const loaded: Review[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            loaded.push({
              id: doc.id,
              movieId: data.movieId,
              userId: data.userId,
              userEmail: data.userEmail,
              rating: data.rating,
              comment: data.comment,
              createdAt: data.createdAt?.seconds * 1000 || Date.now()
            });
          });
          setReviews(loaded);
          setReviewsLoading(false);
        });
    });

    return () => unsubscribe();
  }, [movie.id]);

  // Toggle watchlist
  const handleToggleWatchlist = async () => {
    if (!user) {
      onOpenAuth();
      return;
    }

    setWatchlistLoading(true);
    const docId = `${user.uid}_${movie.id}`;
    const docRef = doc(db, "watchlist", docId);

    try {
      if (isInWatchlist) {
        await deleteDoc(docRef);
        setIsInWatchlist(false);
      } else {
        await setDoc(docRef, {
          id: movie.id,
          title: movie.title,
          posterPath: movie.posterPath,
          releaseDate: movie.releaseDate,
          voteAverage: movie.voteAverage,
          genres: movie.genres || [],
          userId: user.uid,
          addedAt: serverTimestamp() || Date.now()
        });
        setIsInWatchlist(true);
      }
    } catch (err) {
      console.error("Error updating watchlist:", err);
    } finally {
      setWatchlistLoading(false);
    }
  };

  // Submit review
  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onOpenAuth();
      return;
    }

    if (!newComment.trim()) return;

    setSubmitLoading(true);
    try {
      await addDoc(collection(db, "reviews"), {
        movieId: movie.id,
        userId: user.uid,
        userEmail: user.displayName || user.email || "Movie Critic",
        rating: Number(newRating),
        comment: newComment,
        createdAt: serverTimestamp() || Date.now()
      });

      setNewComment("");
      setNewRating(10);
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (err) {
      console.error("Error creating review:", err);
    } finally {
      setSubmitLoading(false);
    }
  };

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
            className="flex items-center gap-2 rounded-full bg-neutral-900/80 px-4 py-2 text-sm font-semibold text-white backdrop-blur-md border border-neutral-800 shadow-lg hover:bg-neutral-800 hover:text-red-400 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to movies
          </button>

          <button
            id="movie-watchlist-toggle"
            onClick={handleToggleWatchlist}
            disabled={watchlistLoading}
            aria-pressed={isInWatchlist}
            className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-all shadow-lg backdrop-blur-md border cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500 ${
              isInWatchlist
                ? "bg-red-500/20 border-red-500/50 text-red-300"
                : "bg-neutral-900/80 border-neutral-800 text-white hover:bg-neutral-800"
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

        {/* Backdrop Image */}
        <img
          src={movie.backdropPath}
          alt={movie.title}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover brightness-[0.4]"
        />

        {/* Ambient Overlay Shade */}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/20 to-transparent" />

        {/* Short specs panel on bottom left */}
        <div className="absolute bottom-0 left-0 right-0 p-8 max-w-7xl mx-auto flex flex-col md:flex-row items-end gap-8 z-10 w-full">
          {/* Flat Poster Card */}
          <div className="hidden md:block w-48 shrink-0 rounded-2xl overflow-hidden border border-neutral-800 shadow-2xl bg-neutral-950 aspect-[2/3]">
            <img src={movie.posterPath} alt={movie.title} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
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
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4 text-neutral-500" />
                {movie.releaseDate}
              </span>
              {movie.runtime && (
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4 text-neutral-500" />
                  {movie.runtime}m
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
                {movie.voteAverage.toFixed(1)} <span className="text-neutral-500 font-normal">({movie.voteCount} reviews)</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Primary body information grids */}
      <div className="max-w-7xl mx-auto px-6 py-12 text-left">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main overview & crew left list */}
          <div className="lg:col-span-2 space-y-10">
            {/* Overview section */}
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white pb-3 border-b border-neutral-900 mb-4 uppercase text-neutral-400">
                Plot Overview
              </h2>
              <p className="text-neutral-300 leading-relaxed text-base italic-quotes">
                "{movie.overview}"
              </p>
            </div>

            {/* Genres */}
            <div>
              <h3 className="text-sm font-semibold tracking-wider text-neutral-400 uppercase mb-3">
                Genres
              </h3>
              <div className="flex flex-wrap gap-2">
                {movie.genres.map((g, idx) => (
                  <span
                    key={`${movie.id}-genpage-${idx}`}
                    className="rounded-xl bg-neutral-900 border border-neutral-800 px-4 py-1.5 text-sm font-medium text-neutral-200"
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>

            {/* Principal Cast actors present */}
            {movie.cast && movie.cast.length > 0 && (
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white pb-3 border-b border-neutral-900 mb-5 uppercase text-neutral-400">
                  Principal Cast
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {movie.cast.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-2xl border border-neutral-900 bg-neutral-900/30 p-3 text-center flex flex-col items-center"
                    >
                      <img
                        src={c.profilePath}
                        alt={c.name}
                        referrerPolicy="no-referrer"
                        className="h-24 w-24 rounded-full object-cover mb-3 border border-neutral-800 shadow-md grayscale hover:grayscale-0 transition-all duration-300"
                      />
                      <h4 className="text-sm font-semibold text-white leading-snug truncate w-full">
                        {c.name}
                      </h4>
                      <p className="text-xs text-neutral-400 mt-1 truncate w-full">
                        {c.character}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Embedded video Trailer section if present */}
            {movie.trailerUrl && (
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white pb-3 border-b border-neutral-900 mb-5 uppercase text-neutral-400 flex items-center gap-2">
                  <PlayIcon className="h-5 w-5 text-red-500" />
                  Official Trailer
                </h2>
                <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-neutral-950 shadow-2xl bg-black">
                  <iframe
                    src={movie.trailerUrl}
                    title={`${movie.title} Trailer`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 h-full w-full"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar: User rating widget & Custom reviews list */}
          <div className="space-y-8">
            {/* Write a review box */}
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 backdrop-blur-sm self-start">
              <h3 className="text-lg font-bold text-white mb-1 tracking-tight flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-400" />
                Community Review
              </h3>
              <p className="text-xs text-neutral-400 mb-4">
                Cast your vote and review this film!
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
                      Review published in real-time!
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
                      className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-white placeholder-neutral-600 outline-none focus:border-red-500/50 transition-all resize-none"
                    />
                  </div>

                  <button
                    id="submit-review-btn"
                    type="submit"
                    disabled={submitLoading}
                    className="w-full rounded-xl bg-gradient-to-r from-red-600 to-amber-600 py-2.5 text-sm font-semibold text-white shadow hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 focus-visible:ring-red-400"
                  >
                    {submitLoading ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Publish Review
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <div className="rounded-xl border border-dashed border-neutral-800 p-4 text-center">
                  <p className="text-xs text-neutral-400 mb-3">
                    Sign in to share your critical film analysis with the community.
                  </p>
                  <button
                    id="auth-trigger-detail-btn"
                    onClick={onOpenAuth}
                    className="rounded-lg bg-neutral-800 px-4 py-2 text-xs font-semibold text-red-400 border border-neutral-700/50 hover:bg-neutral-700 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500"
                  >
                    Sign in here
                  </button>
                </div>
              )}
            </div>

            {/* Displaying existing user reviews */}
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white uppercase tracking-wider text-neutral-400 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-neutral-500" />
                Latest critiques ({reviews.length})
              </h3>

              {reviewsLoading ? (
                <div className="space-y-3">
                  <div className="h-16 w-full rounded-xl bg-neutral-900/50 animate-pulse" />
                  <div className="h-16 w-full rounded-xl bg-neutral-900/50 animate-pulse" />
                </div>
              ) : reviews.length === 0 ? (
                <div className="rounded-xl bg-neutral-950 px-4 py-6 text-center border border-neutral-900">
                  <p className="text-xs text-neutral-400">
                    No critiques yet. Star this film first!
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {reviews.map((rev) => (
                    <div
                      key={rev.id}
                      className="rounded-xl border border-neutral-900 bg-neutral-950 p-4 space-y-2 text-sm text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="rounded-full bg-neutral-800 p-1 text-neutral-400">
                            <User className="h-3.5 w-3.5" />
                          </div>
                          <span className="font-semibold text-xs text-neutral-300 truncate max-w-[120px]">
                            {rev.userEmail}
                          </span>
                        </div>
                        <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/5">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          {rev.rating}/10
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 break-words leading-relaxed">
                        {rev.comment}
                      </p>
                      <div className="text-[10px] text-neutral-600 text-right">
                        {new Date(rev.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
