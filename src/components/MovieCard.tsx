import React, { useState } from "react";
import { motion } from "motion/react";
import { Movie } from "../types";
import { Calendar, Bookmark, BookmarkCheck } from "lucide-react";
import { prefetchMovieDetail, cancelPrefetch } from "../lib/prefetch";

interface MovieCardProps {
  key?: string | number;
  movie?: Movie;
  isLoading?: boolean;
  onClick?: () => void;
  index?: number;
  isSaved?: boolean;
  onToggleSave?: () => void;
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

function MovieCardComponent({ movie, isLoading = false, onClick, index = 0, isSaved = false, onToggleSave }: MovieCardProps) {
  const [posterError, setPosterError] = useState(false);

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.();
    }
  };

  const handleToggleSave = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    onToggleSave?.();
  };

  return (
    <motion.div
      id={`movie-card-${movie.id}`}
      role="button"
      tabIndex={0}
      aria-label={`View details for ${movie.title} (${releaseYear})`}
      whileHover={{ y: -8, scale: 1.02 }}
      whileFocus={{ y: -8, scale: 1.02 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 10) * 0.04 }}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => prefetchMovieDetail(movie.id)}
      onMouseLeave={() => cancelPrefetch(movie.id)}
      onFocus={() => prefetchMovieDetail(movie.id)}
      onBlur={() => cancelPrefetch(movie.id)}
      className="group relative aspect-[2/3] w-full cursor-pointer overflow-hidden rounded-2xl border border-neutral-800/80 bg-neutral-900 shadow-xl transition-shadow hover:shadow-2xl hover:shadow-red-950/20 focus-visible:shadow-2xl focus-visible:shadow-red-950/30"
    >
      {/* Background Poster Image */}
      {!posterError && movie.posterPath ? (
        <img
          id={`movie-poster-${movie.id}`}
          src={movie.posterPath}
          alt={movie.title}
          referrerPolicy="no-referrer"
          onError={() => setPosterError(true)}
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-110 group-focus-visible:scale-110"
          loading="lazy"
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

      {/* Top-right: rating ring + quick-action bookmark */}
      <div className="absolute top-3 right-3 flex flex-col items-end gap-2 z-10">
        <RatingRing score={movie.voteAverage} />
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
            className={`flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-md shadow-md transition-all cursor-pointer opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0 focus-visible:opacity-100 focus-visible:translate-y-0 ${
              isSaved
                ? "bg-red-500/20 border-red-500/50 text-red-300"
                : "bg-neutral-950/70 border-neutral-700/60 text-neutral-200 hover:text-white hover:border-neutral-500"
            }`}
          >
            {isSaved ? <BookmarkCheck className="h-4 w-4 fill-red-400" /> : <Bookmark className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* Visual content overlay on hover/static */}
      <div className="absolute inset-0 flex flex-col justify-end p-5 text-left">
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

        {/* Year */}
        <div className="mt-2 flex items-center text-xs text-neutral-400">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3 text-neutral-500" />
            {releaseYear}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

const MovieCard = React.memo(MovieCardComponent);
export default MovieCard;