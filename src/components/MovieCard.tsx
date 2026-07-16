import React, { useState } from "react";
import { motion } from "motion/react";
import { Movie } from "../types";
import { Calendar, Clock, PlayCircle, Info, Heart, Bookmark, BookmarkCheck } from "lucide-react";
import { prefetchMovieDetail, cancelPrefetch } from "../lib/prefetch";
import { useMovieCardPreferences } from "../context/MovieCardContext";

interface MovieCardProps {
  key?: string | number;
  movie?: Movie;
  isLoading?: boolean;
  onClick?: () => void;
  index?: number;
  isSaved?: boolean;
  onToggleSave?: () => void;
  // Optional — when provided, shows a favorite indicator if the movie
  // matches one of the user's favorite genres. Omitting this prop preserves
  // exactly the existing card appearance everywhere it's already used.
  favoriteGenres?: string[];
  onPlayTrailer?: (movie: Movie) => void;
}

function formatRuntimeShort(minutes?: number): string | null {
  if (!minutes || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Score -> color, mirrors the "rating ring" pattern from Letterboxd/TMDB
function ringColor(score: number) {
  if (score >= 7.5) return { stroke: "#34d399", text: "text-emerald-400" }; // emerald
  if (score >= 5.5) return { stroke: "#fbbf24", text: "text-amber-400" }; // amber
  return { stroke: "#f87171", text: "text-red-400" }; // red
}

function RatingRing({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(10, score)) / 10;
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);
  const { stroke, text } = ringColor(score);

  return (
    <div className="relative h-9 w-9 shrink-0" aria-hidden="true">
      <svg viewBox="0 0 36 36" className="h-9 w-9 -rotate-90">
        <circle cx="18" cy="18" r={radius} fill="rgba(10,10,10,0.75)" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-extrabold ${text}`}>
        {score.toFixed(1)}
      </span>
    </div>
  );
}

function MovieCardComponent({ movie, isLoading = false, onClick, index = 0, isSaved = false, onToggleSave, favoriteGenres, onPlayTrailer }: MovieCardProps) {
  const [posterError, setPosterError] = useState(false);
  const [posterLoaded, setPosterLoaded] = useState(false);

  if (isLoading || !movie) {
    return (
      <div className="skeleton-shimmer relative aspect-[2/3] w-full rounded-2xl border border-neutral-800/50">
        <div className="absolute inset-0 flex flex-col justify-end p-4 space-y-2">
          <div className="h-5 w-2/3 rounded bg-neutral-800/80" />
          <div className="h-4 w-1/3 rounded bg-neutral-800/80" />
          <div className="h-3 w-1/2 rounded bg-neutral-800/80" />
        </div>
      </div>
    );
  }

  // Extract release year
  const releaseYear = movie.releaseDate ? movie.releaseDate.split("-")[0] : "N/A";
  const runtimeLabel = formatRuntimeShort(movie.runtime);
  // Explicit props (if a caller ever passes them) win; otherwise fall back
  // to the shared context so no per-rail wiring is needed anywhere.
  const { favoriteGenres: contextFavoriteGenres, openTrailer } = useMovieCardPreferences();
  const effectiveFavoriteGenres = favoriteGenres ?? contextFavoriteGenres;
  const isFavoriteGenre = !!effectiveFavoriteGenres?.length && movie.genres?.some((g) => effectiveFavoriteGenres.includes(g));

  const handleToggleSave = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    onToggleSave?.();
  };

  const handlePlayTrailer = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    (onPlayTrailer ?? openTrailer)?.(movie);
  };

  return (
    <motion.div
      id={`movie-card-${movie.id}`}
      whileHover={{ y: -8, scale: 1.02 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 10) * 0.04 }}
      onMouseEnter={() => prefetchMovieDetail(movie.id)}
      onMouseLeave={() => cancelPrefetch(movie.id)}
      onFocus={() => prefetchMovieDetail(movie.id)}
      onBlur={() => cancelPrefetch(movie.id)}
      className="group relative aspect-[2/3] w-full overflow-hidden rounded-2xl border border-neutral-800/80 bg-neutral-900 shadow-xl transition-[box-shadow,transform] duration-300 ease-out hover:shadow-2xl hover:shadow-red-950/20 focus-within:shadow-2xl focus-within:shadow-red-950/30 focus-within:-translate-y-2 focus-within:scale-[1.02] motion-reduce:transition-none"
    >
      {/* Background Poster Image */}
      {!posterError && movie.posterPath ? (
        <img
          id={`movie-poster-${movie.id}`}
          src={movie.posterPath}
          alt={movie.title}
          referrerPolicy="no-referrer"
          onError={() => setPosterError(true)}
          onLoad={() => setPosterLoaded(true)}
          className={`h-full w-full object-cover transition-[opacity,transform] duration-500 ease-out group-hover:scale-110 group-focus-visible:scale-110 motion-reduce:transition-opacity ${
            posterLoaded ? "opacity-100" : "opacity-0"
          }`}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="h-full w-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-neutral-900 to-neutral-950 text-neutral-700 p-4">
          <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-wider text-center leading-tight line-clamp-2">{movie.title}</span>
        </div>
      )}

      {/* Grid overlay shading always subtly present */}
      <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent opacity-90 transition-opacity duration-300 group-hover:opacity-100" />

      {/* Primary clickable target — a single real, stretched <button> that
          covers the whole card. It's a sibling of (not a wrapper around) the
          bookmark/trailer/more-info buttons below, so the card stays fully
          clickable and keyboard-operable without nesting interactive
          elements inside one another (the previous role="button" div
          wrapping real <button> children was an ARIA/axe "nested-interactive"
          violation). */}
      <button
        type="button"
        onClick={onClick}
        aria-label={`View details for ${movie.title} (${releaseYear})`}
        className="absolute inset-0 z-0 cursor-pointer rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-inset"
      />

      {/* Top-right: rating ring + quick-action bookmark */}
      <div className="absolute top-3 right-3 flex flex-col items-end gap-2 z-10">
        <RatingRing score={movie.voteAverage} />
        {isFavoriteGenre && (
          <span
            aria-label="Matches one of your favorite genres"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-950/70 border border-neutral-700/60 backdrop-blur-md text-red-400"
          >
            <Heart className="h-3.5 w-3.5 fill-red-500 text-red-500" aria-hidden="true" />
          </span>
        )}
        {onToggleSave && (
          <button
            type="button"
            onClick={handleToggleSave}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleToggleSave(e);
              }
            }}
            aria-label={isSaved ? `Remove ${movie.title} from watchlist` : `Add ${movie.title} to watchlist`}
            aria-pressed={isSaved}
            className={`flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-md shadow-md transition-all cursor-pointer opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0 focus-visible:opacity-100 focus-visible:translate-y-0 active:scale-90 ${
              isSaved
                ? "bg-red-500/20 border-red-500/50 text-red-300"
                : "bg-neutral-950/70 border-neutral-700/60 text-neutral-200 hover:text-white hover:border-neutral-500"
            }`}
          >
            {isSaved ? <BookmarkCheck className="h-4 w-4 fill-red-400" /> : <Bookmark className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* Visual content overlay on hover/static. pointer-events-none lets
          clicks on the non-interactive text (title/genres/overview) pass
          through to the stretched button above; the actions row below
          re-enables pointer-events for its own real buttons. */}
      <div className="absolute inset-0 flex flex-col justify-end p-5 text-left pointer-events-none">
        {/* Genre Tags */}
        <div className="mb-2 flex flex-wrap gap-1">
          {movie.genres.slice(0, 2).map((g, idx) => (
            <span
              key={`${movie.id}-gen-${idx}`}
              className="rounded-md bg-neutral-900/80 px-2 py-0.5 text-[10px] font-medium tracking-wide text-red-400 backdrop-blur-sm border border-neutral-800/50"
            >
              {g}
            </span>
          ))}
        </div>

        {/* Title */}
        <h3 className="text-base font-bold text-white line-clamp-2 leading-tight group-hover:text-red-400 group-focus-visible:text-red-400 transition-colors">
          {movie.title}
        </h3>

        {/* Year + runtime — always visible, unchanged from before */}
        <div className="mt-2 flex items-center gap-3 text-xs text-neutral-400">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3 text-neutral-500" />
            {releaseYear}
          </span>
          {runtimeLabel && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-neutral-500" />
              {runtimeLabel}
            </span>
          )}
        </div>

        {/* Rich preview: overview + quick actions, reveal on hover/focus only.
            On touch devices this content simply never gets a persistent
            hover state, so it degrades to "not shown" rather than broken. */}
        <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] group-focus-within:grid-rows-[1fr] transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none">
          <div className="overflow-hidden">
            {movie.overview && (
              <p className="mt-3 text-[11px] leading-relaxed text-neutral-300 line-clamp-3">
                {movie.overview}
              </p>
            )}
            <div className="mt-3 flex items-center gap-2 pointer-events-auto">
              {movie.trailerUrl && onPlayTrailer && (
                <button
                  type="button"
                  onClick={handlePlayTrailer}
                  aria-label={`Play trailer for ${movie.title}`}
                  className="flex items-center gap-1.5 rounded-lg bg-red-650/90 hover:bg-red-600 active:scale-95 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white cursor-pointer transition-all"
                >
                  <PlayCircle className="h-3.5 w-3.5" />
                  Trailer
                </button>
              )}
              {onClick && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onClick(); }}
                  aria-label={`More info about ${movie.title}`}
                  className="flex items-center gap-1.5 rounded-lg bg-neutral-800/90 hover:bg-neutral-700 active:scale-95 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white cursor-pointer transition-all"
                >
                  <Info className="h-3.5 w-3.5" />
                  More Info
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

const MovieCard = React.memo(MovieCardComponent);
export default MovieCard;