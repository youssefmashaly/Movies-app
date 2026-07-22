import React, { useRef, useState, useEffect } from "react";
import { motion } from "motion/react";
import { Movie } from "../types";
import { ChevronLeft, ChevronRight, LucideIcon } from "lucide-react";
import MovieCard from "./MovieCard";

// Session-scoped scroll memory, keyed by rail id. Explore-tab rails fully
// unmount whenever a movie is selected (the ternary in App.tsx swaps the
// whole tree for MovieDetail) and remount on "Back" — sessionStorage is what
// survives that unmount/remount cycle; component state alone would not.
const SCROLL_MEMORY_PREFIX = "movieapp:railScroll:";

function readRailScroll(railId: string): number {
  try {
    const raw = sessionStorage.getItem(SCROLL_MEMORY_PREFIX + railId);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

function saveRailScroll(railId: string, value: number) {
  try {
    sessionStorage.setItem(SCROLL_MEMORY_PREFIX + railId, String(value));
  } catch {
    // Private browsing / quota — losing scroll memory is never worth breaking the app over.
  }
}

interface MovieRailProps {
  id: string;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  accent?: "red" | "amber" | "teal" | "indigo" | "emerald";
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
  emerald: { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
};

function MovieRailComponent({
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

  // Restore scroll position once the rail actually has content to scroll to
  // (restoring against an empty/skeleton track would just no-op at 0).
  useEffect(() => {
    if (isLoading || movies.length === 0) return;
    const el = trackRef.current;
    if (!el) return;
    const saved = readRailScroll(id);
    if (saved > 0) {
      // No smooth-scroll here — this is a restore, not a user-initiated
      // scroll, so it should never animate or visually "jump" into place.
      el.scrollLeft = saved;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, movies.length, id]);

  useEffect(() => {
    updateScrollState();
    const el = trackRef.current;
    if (!el) return;
    let saveTimeout: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      updateScrollState();
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => saveRailScroll(id, el.scrollLeft), 200);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      clearTimeout(saveTimeout);
    };
  }, [movies, isLoading, id]);

  const scrollBy = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.85, 700), behavior: "smooth" });
  };

  // Left/Right arrow keys scroll the rail by one "page" when focus is
  // anywhere inside it (the track itself or one of its cards) — Enter/Space
  // on an individual card is already handled by MovieCard itself.
  const handleTrackKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      scrollBy(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      scrollBy(-1);
    }
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
      className="max-w-[1600px] mx-auto px-6"
    >
      <div className="flex items-end justify-between mb-4 gap-4">
        <div className="flex items-start gap-3">
          <span className="hidden sm:block h-8 w-1 rounded-full bg-gradient-to-b from-red-500 to-red-700 mt-0.5" aria-hidden="true" />
          <div>
            <h2
              id={`${id}-heading`}
              className="flex items-center gap-2 text-xl sm:text-2xl font-extrabold tracking-tight text-white"
            >
              <span className={`flex h-7 w-7 items-center justify-center rounded-lg border ${palette.bg} ${palette.border}`}>
                <Icon className={`h-3.5 w-3.5 ${palette.text}`} />
              </span>
              {title}
            </h2>
            {subtitle && <p className="text-xs text-neutral-500 mt-1 ml-9">{subtitle}</p>}
          </div>
        </div>

        {/* Desktop scroll controls */}
        <div className="hidden sm:flex items-center gap-2">
          <button
            type="button"
            aria-label={`Scroll ${title} left`}
            disabled={!canScrollLeft}
            onClick={() => scrollBy(-1)}
            className="rounded-full border border-white/[0.08] bg-white/[0.04] backdrop-blur-md p-2 text-neutral-400 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={`Scroll ${title} right`}
            disabled={!canScrollRight}
            onClick={() => scrollBy(1)}
            className="rounded-full border border-white/[0.08] bg-white/[0.04] backdrop-blur-md p-2 text-neutral-400 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={trackRef}
        role="list"
        onKeyDown={handleTrackKeyDown}
        className="rail-track no-scrollbar flex gap-4 overflow-x-auto pb-2 -mx-6 px-6 scroll-smooth"
      >
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={`${id}-skel-${i}`} className="rail-card shrink-0 w-[150px] sm:w-[180px] md:w-[200px] xl:w-[220px]">
                <MovieCard isLoading />
              </div>
            ))
          : movies.map((movie, idx) => (
              <div
                key={`${id}-${movie.id}`}
                role="listitem"
                className="rail-card shrink-0 w-[150px] sm:w-[180px] md:w-[200px] xl:w-[220px]"
              >
                <MovieCard
                  movie={movie}
                  index={idx}
                  onClick={onMovieClick}
                  isSaved={isSaved?.(movie.id)}
                  onToggleSave={onToggleSave}
                />
              </div>
            ))}
      </div>
    </motion.section>
  );
}

const MovieRail = React.memo(MovieRailComponent);
export default MovieRail;