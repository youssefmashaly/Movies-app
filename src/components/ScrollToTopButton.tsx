// src/components/ScrollToTopButton.tsx
//
// Task 5 (Phase 42) — scroll-to-top usability. The app has genuinely long
// scrolling pages (Movie Library's infinite-scroll catalog, Explore's many
// curated rails, Dashboard's rails, Community's review feed), and there was
// no existing mechanism to get back to the top short of manually scrolling
// or switching tabs. This is a single, subtle, global button rather than a
// per-page implementation, since the need is identical everywhere.
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowUp } from "lucide-react";

const SHOW_AFTER_PX = 600;

export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > SHOW_AFTER_PX);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleClick = () => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          onClick={handleClick}
          aria-label="Scroll to top"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.1] bg-neutral-900/80 backdrop-blur-xl text-neutral-300 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.6)] hover:text-white hover:border-white/25 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          <ArrowUp className="h-5 w-5" aria-hidden="true" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}