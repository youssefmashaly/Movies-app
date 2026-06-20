import React from "react";
import { motion } from "motion/react";
import { Movie } from "../types";
import { Star, Calendar } from "lucide-react";

interface MovieCardProps {
  key?: string | number;
  movie?: Movie;
  isLoading?: boolean;
  onClick?: () => void;
}

export default function MovieCard({ movie, isLoading = false, onClick }: MovieCardProps) {
  if (isLoading || !movie) {
    return (
      <div className="relative aspect-[2/3] w-full animate-pulse rounded-2xl bg-neutral-800 border border-neutral-700/50">
        <div className="absolute inset-0 flex flex-col justify-end p-4 space-y-2">
          <div className="h-5 w-2/3 rounded bg-neutral-700" />
          <div className="h-4 w-1/3 rounded bg-neutral-700" />
          <div className="h-3 w-1/2 rounded bg-neutral-700" />
        </div>
      </div>
    );
  }

  // Extract release year
  const releaseYear = movie.releaseDate ? movie.releaseDate.split("-")[0] : "N/A";

  return (
    <motion.div
      id={`movie-card-${movie.id}`}
      whileHover={{ y: -8, scale: 1.02 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onClick={onClick}
      className="group relative aspect-[2/3] w-full cursor-pointer overflow-hidden rounded-2xl border border-neutral-800/80 bg-neutral-900 shadow-xl transition-shadow hover:shadow-2xl hover:shadow-red-950/20"
    >
      {/* Background Poster Image */}
      <img
        id={`movie-poster-${movie.id}`}
        src={movie.posterPath}
        alt={movie.title}
        referrerPolicy="no-referrer"
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        loading="lazy"
      />

      {/* Grid overlay shading always subtly present */}
      <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent opacity-90 transition-opacity duration-300 group-hover:opacity-100" />

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
        <h3 className="text-base font-bold text-white line-clamp-2 leading-tight group-hover:text-red-400 transition-colors">
          {movie.title}
        </h3>

        {/* Year, Rating info */}
        <div className="mt-2 flex items-center justify-between text-xs text-neutral-400">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3 text-neutral-500" />
            {releaseYear}
          </span>
          <span className="flex items-center gap-1 font-semibold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-md border border-amber-500/10">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            {movie.voteAverage.toFixed(1)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
