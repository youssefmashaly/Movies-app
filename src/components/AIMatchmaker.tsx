import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Movie } from "../types";
import { Sparkles, Send, Film, HelpCircle, Loader2, ArrowRight, TrendingUp, Star } from "lucide-react";
import { ALL_GENRES } from "../movies-data";
import MovieCard from "./MovieCard";
import { buildUserPreferenceProfile, profileToRequestPayload } from "../services/recommendations";
import type { UserPreferenceProfile } from "../services/recommendations";

interface AIMatchmakerProps {
  onSelectMovie: (movie: Movie) => void;
  userId?: string;
  watchlistId?: string | null;
  favoriteGenres?: string[];
  watchlistMovies?: Movie[];
  recentlyViewedMovies?: Movie[];
}

const CONFIDENCE_STYLES: Record<string, { label: string; classes: string }> = {
  high:   { label: "High match",   classes: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  medium: { label: "Good match",   classes: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  low:    { label: "General pick", classes: "text-neutral-400 bg-neutral-800 border-neutral-700" }
};

export default function AIMatchmaker({
  onSelectMovie,
  userId,
  watchlistId = null,
  favoriteGenres = [],
  watchlistMovies = [],
  recentlyViewedMovies = []
}: AIMatchmakerProps) {
  const [mood, setMood] = useState("");
  const [genre, setGenre] = useState("All");
  const [loading, setLoading] = useState(false);
  const [aiFeedback, setAiFeedback] = useState("");
  const [recommendations, setRecommendations] = useState<Movie[]>([]);
  const [error, setError] = useState("");
  const [recommendationReason, setRecommendationReason] = useState("");
  const [confidence, setConfidence] = useState<"high" | "medium" | "low">("low");
  const [_profile, setProfile] = useState<UserPreferenceProfile | null>(null);

  const handleMatchmake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mood.trim()) return;

    setLoading(true);
    setError("");
    setRecommendations([]);
    setAiFeedback("");
    setRecommendationReason("");

    try {
      const builtProfile = userId
        ? await buildUserPreferenceProfile(userId, watchlistId, favoriteGenres, watchlistMovies, recentlyViewedMovies)
        : null;
      setProfile(builtProfile);

      const personalizationPayload = builtProfile ? profileToRequestPayload(builtProfile) : {};

      const response = await fetch("/api/movies/ai-recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mood,
          genreFilter: genre,
          ...personalizationPayload
        }),
      });

      if (!response.ok) throw new Error("Matchmaking request failed.");

      const data = await response.json();
      setAiFeedback(data.aiFeedback || "");
      setRecommendations(data.recommendations || []);
      setRecommendationReason(data.recommendationReason || builtProfile?.primaryReason || "");
      setConfidence(data.confidence || builtProfile?.confidence || "low");
    } catch (err: any) {
      console.error(err);
      setError("The Oracle is currently busy gazing into the cosmos. Try again in a moment!");
    } finally {
      setLoading(false);
    }
  };

  const sampleMoods = [
    { label: "Mind-bending Sci-Fi", text: "Stunning futuristic visual spectacles and time-travel paradoxes." },
    { label: "Gothic Rainy Night", text: "Dark gothic castles, vampires, eerie shadows and intense horror." },
    { label: "High Stakes Adrenaline", text: "Adrenaline fueling combat choreography, car chases and explosions." },
    { label: "Cozy Family Cheer", text: "Wholesome animations, heartwarming comedy, and tear-jerkers." }
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 text-neutral-100 text-left">
      {/* Intro Hero banner */}
      <div className="mb-12 relative overflow-hidden rounded-3xl border border-neutral-800 bg-gradient-to-tr from-neutral-950 via-neutral-900 to-neutral-950 p-8 md:p-12 shadow-2xl">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <Film className="h-64 w-64" />
        </div>

        <div className="max-w-2xl relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-red-500/10 border border-red-500/20 px-3.5 py-1.5 text-xs font-semibold text-red-400 mb-4 tracking-wider uppercase">
            <Sparkles className="h-3.5 w-3.5" />
            AI Movie Oracle
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-4 leading-none">
            Find Your Next Cinema Companion
          </h1>
          <p className="text-neutral-400 text-sm md:text-base leading-relaxed">
            Whisper your current vibe, mood, or context to our artificial intelligence film oracle, and receive a customized set of real-world or factually resonant movie pairings in a flash!
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Left Side Form controls */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-6 shadow-xl backdrop-blur-md">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-red-500" />
              Describe your mood
            </h2>

            <form onSubmit={handleMatchmake} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-1.5">
                  How are you feeling right now?
                </label>
                <textarea
                  id="ai-mood-input"
                  required
                  rows={4}
                  value={mood}
                  onChange={(e) => setMood(e.target.value)}
                  placeholder="e.g. A rainy Saturday afternoon with hot coffee, searching for deep, heartwarming stories..."
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3.5 text-sm text-white placeholder-neutral-600 outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/30 transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-1.5">
                  Vibe filter (Genre)
                </label>
                <select
                  id="ai-genre-select"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3.5 text-sm text-white outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/30 transition-all"
                >
                  {ALL_GENRES.map((g) => (
                    <option key={`match-gen-${g}`} value={g} className="bg-neutral-950">
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <button
                id="matchmake-submit-btn"
                type="submit"
                disabled={loading || !mood.trim()}
                className="w-full rounded-xl bg-gradient-to-r from-red-650 to-red-600 bg-red-650 hover:bg-red-600 py-3 font-semibold text-[#ffffff] shadow-lg shadow-red-950/20 hover:text-red-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 focus-visible:ring-red-400"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Consulting film archives...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Reveal recommendations
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Personalization signal panel */}
          {(favoriteGenres.length > 0 || watchlistMovies.length > 0 || recentlyViewedMovies.length > 0) && (
            <div className="rounded-2xl border border-indigo-500/10 bg-indigo-500/5 p-4 space-y-2">
              <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" />
                Personalizing from your activity
              </h3>
              <ul className="space-y-1.5">
                {favoriteGenres.length > 0 && (
                  <li className="text-xs text-neutral-400 flex items-center gap-1.5">
                    <Star className="h-3 w-3 text-indigo-400 shrink-0" />
                    Favorite genres: <span className="text-white font-medium">{favoriteGenres.slice(0, 3).join(", ")}</span>
                  </li>
                )}
                {watchlistMovies.length > 0 && (
                  <li className="text-xs text-neutral-400 flex items-center gap-1.5">
                    <Star className="h-3 w-3 text-indigo-400 shrink-0" />
                    <span className="text-white font-medium">{watchlistMovies.length}</span> saved films
                  </li>
                )}
                {recentlyViewedMovies.length > 0 && (
                  <li className="text-xs text-neutral-400 flex items-center gap-1.5">
                    <Star className="h-3 w-3 text-indigo-400 shrink-0" />
                    <span className="text-white font-medium">{recentlyViewedMovies.length}</span> recently viewed
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Quick preset suggestions */}
          <div className="rounded-2xl border border-neutral-900 bg-neutral-950/40 p-6">
            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4 flex items-center gap-1.5">
              <HelpCircle className="h-3.5 w-3.5" />
              Stuck? Try a sample preset
            </h3>
            <div className="space-y-3">
              {sampleMoods.map((sample, sIdx) => (
                <button
                  key={`sample-mood-${sIdx}`}
                  onClick={() => {
                    setMood(sample.text);
                  }}
                  className="w-full text-left rounded-xl border border-neutral-800/60 bg-neutral-900/20 p-3 hover:border-red-500/30 hover:bg-neutral-900/50 transition-all text-xs cursor-pointer group focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  <div className="font-semibold text-neutral-300 flex items-center justify-between group-hover:text-red-400">
                    {sample.label}
                    <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="text-neutral-500 mt-1 line-clamp-1">{sample.text}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side Result display */}
        <div className="lg:col-span-2 space-y-8">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="oracle-loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-3xl border border-neutral-800 border-dashed p-12 text-center flex flex-col items-center justify-center h-full min-h-[400px] space-y-4"
              >
                <Loader2 className="h-10 w-10 text-red-500 animate-spin" />
                <h3 className="text-lg font-bold tracking-tight text-white">Consulting the CinemaOracle</h3>
                <p className="text-sm text-neutral-400 max-w-sm">
                  We are formulating your bespoke watchlist and synthesizing critical reviews based on your specific vibe profile. Please wait!
                </p>
              </motion.div>
            ) : error ? (
              <motion.div
                key="oracle-error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-3xl border border-red-500/20 bg-red-500/5 p-12 text-center max-w-md mx-auto space-y-4"
              >
                <div className="text-red-500 font-bold mb-2">Notice</div>
                <p className="text-sm text-red-300 leading-relaxed">{error}</p>
              </motion.div>
            ) : recommendations.length > 0 ? (
              <motion.div
                key="oracle-results"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-8"
              >
                {/* AI Review feedback text bubble style */}
                {aiFeedback && (
                  <div className="rounded-2xl border border-teal-500/10 bg-teal-500/5 p-5 text-xs sm:text-sm text-teal-300 leading-relaxed border-l-4 border-l-teal-500 italic flex gap-3">
                    <Sparkles className="h-5 w-5 text-teal-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold uppercase tracking-wider block text-[10px] text-teal-500 mb-1">
                        CinemaOracle Verdict
                      </span>
                      "{aiFeedback}"
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                    <h3 className="text-lg font-bold text-white uppercase tracking-widest text-neutral-400 flex items-center gap-2">
                      <Film className="h-5 w-5 text-neutral-500" />
                      Curated Cinema Set
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      {recommendationReason && (
                        <span className="text-xs font-semibold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full flex items-center gap-1.5">
                          <Sparkles className="h-3 w-3" />
                          {recommendationReason}
                        </span>
                      )}
                      {(() => {
                        const c = CONFIDENCE_STYLES[confidence] || CONFIDENCE_STYLES.low;
                        return (
                          <span className={`text-xs font-semibold border px-2.5 py-1 rounded-full ${c.classes}`}>
                            {c.label}
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-6">
                    {recommendations.map((rec) => (
                      <MovieCard
                        key={rec.id}
                        movie={rec}
                        onClick={onSelectMovie}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="oracle-empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-3xl border border-neutral-900 bg-neutral-950/20 p-12 text-center flex flex-col items-center justify-center h-full min-h-[400px]"
              >
                <Sparkles className="h-10 w-10 text-neutral-600 mb-4" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-400">The Oracle Awaits</h3>
                <p className="text-xs text-neutral-500 mt-2 max-w-sm leading-relaxed">
                  Provide your desired mood, click compile, and let the AI generate customized suggestions complete with review pages and analytics.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
