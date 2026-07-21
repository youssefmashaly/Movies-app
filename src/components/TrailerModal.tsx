import React, { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import type { Movie } from "../types";
import { useFocusTrap } from "../lib/useFocusTrap";

// The single shared trailer player for card-triggered "quick play" — reuses
// the exact same iframe embed configuration already used inline on the
// Movie Detail page, so there is only one trailer-rendering pattern in the
// app, just presented two ways (inline on the detail page, modal from a card).
interface TrailerModalProps {
  movie: Movie | null;
  onClose: () => void;
}

export default function TrailerModal({ movie, onClose }: TrailerModalProps) {
  const dialogRef = useFocusTrap<HTMLDivElement>(Boolean(movie?.trailerUrl));

  useEffect(() => {
    if (!movie) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [movie, onClose]);

  return (
    <AnimatePresence>
      {movie?.trailerUrl && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 outline-none"
          onClick={onClose}
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={`${movie.title} trailer`}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="relative w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close trailer"
              className="absolute -top-11 right-0 flex items-center gap-1.5 rounded-full bg-neutral-900/80 border border-neutral-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <X className="h-3.5 w-3.5" />
              Close
            </button>
            <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-white/[0.08] shadow-2xl bg-black">
              <iframe
                src={movie.trailerUrl}
                title={`${movie.title} Trailer`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}