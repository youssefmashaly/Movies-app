import React, { useRef, useState, useEffect } from "react";
import { motion } from "motion/react";
import { Movie } from "../types";
import { ChevronLeft, ChevronRight, LucideIcon } from "lucide-react";
import MovieCard from "./MovieCard";

interface MovieRailProps {
  id: string;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  accent?: "red" | "amber" | "teal" | "indigo";
  movies: Movie[];
  isLoading?: boolean;
  onMovieClick: (movie: Movie) => void;
  isSaved?: (movieId: string) => boolean;
  onToggleSave?: (movie: Movie) => void;
}

const ACCENTS: Record<string, { text: string; bg: string; border: string }> = {
  red: { text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
  amber: { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  teal: { text: "text-teal-400", bg: "bg-teal-500/10", border: "border-teal-500/20" },
  indigo: { text: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
};

export default function MovieRail({
  id,
  title,
  subtitle,
  icon: Icon,
  accent = "red",
  movies,
  isLoading = false,
  onMovieClick,
  isSaved,
  onToggleSave,
}: MovieRailProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const palette = ACCENTS[accent];

  const updateScrollState = () => {
    const el = trackRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  };

  useEffect(() => {
    updateScrollState();
    const el = trackRef.current;
    if (!el) return;
    const onScroll = () => updateScrollState();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [movies, isLoading]);

  const scrollBy = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.85, 700), behavior: "smooth" });
  };

  // Don't render an empty, finished section at all (clean discovery surface)
  if (!isLoading && movies.length === 0) return null;

  return (
    <motion.section
      id={id}
      aria-labelledby={`${id}-heading`}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="max-w-7xl mx-auto px-6"
    >
      <div className="flex items-end justify-between mb-4 gap-4">
        <div>
          <h2
            id={`${id}-heading`}
            className="flex items-center gap-2 text-lg sm:text-xl font-extrabold tracking-tight text-white"
          >
            <span className={`flex h-7 w-7 items-center justify-center rounded-lg border ${palette.bg} ${palette.border}`}>
              <Icon className={`h-3.5 w-3.5 ${palette.text}`} />
            </span>
            {title}
          </h2>
          {subtitle && <p className="text-xs text-neutral-500 mt-1 ml-9">{subtitle}</p>}
        </div>

        {/* Desktop scroll controls */}
        <div className="hidden sm:flex items-center gap-2">
          <button
            type="button"
            aria-label={`Scroll ${title} left`}
            disabled={!canScrollLeft}
            onClick={() => scrollBy(-1)}
            className="rounded-full border border-neutral-800 bg-neutral-900/60 p-2 text-neutral-400 hover:text-white hover:border-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={`Scroll ${title} right`}
            disabled={!canScrollRight}
            onClick={() => scrollBy(1)}
            className="rounded-full border border-neutral-800 bg-neutral-900/60 p-2 text-neutral-400 hover:text-white hover:border-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={trackRef}
        role="list"
        className="rail-track no-scrollbar flex gap-4 overflow-x-auto pb-2 -mx-6 px-6 scroll-smooth"
      >
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={`${id}-skel-${i}`} className="rail-card shrink-0 w-[150px] sm:w-[180px] md:w-[200px]">
                <MovieCard isLoading />
              </div>
            ))
          : movies.map((movie, idx) => (
              <div
                key={`${id}-${movie.id}`}
                role="listitem"
                className="rail-card shrink-0 w-[150px] sm:w-[180px] md:w-[200px]"
              >
                <MovieCard
                  movie={movie}
                  index={idx}
                  onClick={() => onMovieClick(movie)}
                  isSaved={isSaved?.(movie.id)}
                  onToggleSave={onToggleSave ? () => onToggleSave(movie) : undefined}
                />
              </div>
            ))}
      </div>
    </motion.section>
  );
}