import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Heart, X } from "lucide-react";
import { ALL_GENRES } from "../genres";
import { useFocusTrap } from "../lib/useFocusTrap";

interface GenreOnboardingModalProps {
  isOpen: boolean;
  favoriteGenres: string[];
  onToggleGenre: (genre: string) => void;
  onSave: () => void;
  onSkip: () => void;
}

/**
 * The genre picker previously lived permanently at the top of the Explore
 * page. It's now a proper onboarding dialog: shown automatically right
 * after signup or on a returning user's first visit to their Dashboard
 * with no saved genres, and reopenable any time from Dashboard/Settings.
 * The actual selection logic (toggling a genre, persisting it to Supabase)
 * is unchanged and owned by App.tsx — this component is presentation only,
 * so there's exactly one implementation of "what happens when you pick a
 * genre" rather than a duplicate copy living in a modal.
 */
export default function GenreOnboardingModal({
  isOpen,
  favoriteGenres,
  onToggleGenre,
  onSave,
  onSkip,
}: GenreOnboardingModalProps) {
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onSkip]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onSkip}
            className="absolute inset-0 bg-neutral-950/80 backdrop-blur-md"
          />

          <motion.div
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="genre-onboarding-title"
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900/90 p-8 text-neutral-100 shadow-2xl backdrop-blur-xl outline-none"
          >
            <button
              type="button"
              onClick={onSkip}
              aria-label="Close"
              className="absolute right-5 top-5 rounded-full p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-red-600 text-[#ffffff] shadow-lg shadow-red-900/20 mb-4">
              <Heart className="h-5 w-5" />
            </div>

            <h2 id="genre-onboarding-title" className="text-xl font-extrabold text-white mb-2">
              Pick a few favorite genres
            </h2>
            <p className="text-sm text-neutral-400 leading-relaxed mb-5">
              This personalizes your Recommended rail and the genre rows on Explore. You can change it any time
              from Dashboard.
            </p>

            <div role="group" aria-label="Favorite genres" className="flex flex-wrap gap-2 mb-6">
              {ALL_GENRES.filter((g) => g !== "All").map((g) => {
                const isSelected = favoriteGenres.includes(g);
                return (
                  <button
                    key={`onboarding-genre-${g}`}
                    type="button"
                    onClick={() => onToggleGenre(g)}
                    aria-pressed={isSelected}
                    className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border focus-visible:ring-2 focus-visible:ring-red-500 ${
                      isSelected
                        ? "bg-red-650 border-red-650 text-[#ffffff] shadow-md"
                        : "bg-white/[0.03] border-white/[0.06] text-neutral-400 hover:text-white"
                    }`}
                  >
                    {g}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onSave}
                className="rounded-xl bg-gradient-to-r from-red-600 to-amber-600 px-5 py-2.5 text-sm font-semibold text-[#ffffff] shadow-lg hover:from-red-500 hover:to-amber-505 active:scale-[0.98] transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900 focus-visible:ring-red-400"
              >
                Save
              </button>
              <button
                type="button"
                onClick={onSkip}
                className="text-xs font-semibold text-neutral-500 hover:text-neutral-300 cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500 rounded"
              >
                Skip for now
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}