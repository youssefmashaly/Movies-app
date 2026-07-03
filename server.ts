import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { PRESET_MOVIES } from "./src/movies-data.js";
import { Movie } from "./src/types.js";

// Lazy-loaded Gemini client to prevent crash on boot
let aiClient: GoogleGenAI | null = null;
function getAI() {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key && key !== "MY_GEMINI_API_KEY" && key.trim() !== "") {
      aiClient = new GoogleGenAI({ apiKey: key });
    }
  }
  return aiClient;
}

// Memory cache for generated AI movies so they persist during the session
const aiMoviesCache = new Map<string, Movie>();

// Builds and returns a fully configured Express app WITHOUT starting a
// listener — safe to import from serverless entry points (Vercel/Netlify)
// without triggering app.listen(). Every route below is unchanged from
// before this refactor; only the wrapping function signature changed.
export async function createApp() {
  const app = express();

  app.use(express.json());

  // --- API ROUTES ---

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", mode: process.env.NODE_ENV || "development" });
  });

  // Get trending movies
  app.get("/api/movies/trending", (req, res) => {
    try {
      res.json(PRESET_MOVIES);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get latest movies (by release date descending)
  app.get("/api/movies/latest", (req, res) => {
    try {
      const sorted = [...PRESET_MOVIES].sort((a, b) => {
        return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime();
      });
      res.json(sorted);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get specific movie details
  app.get("/api/movies/detail/:id", async (req, res) => {
    try {
      const id = req.params.id;
      // 1. Check presets
      const preset = PRESET_MOVIES.find((m) => m.id === id);
      if (preset) {
        return res.json(preset);
      }

      // 2. Check AI cache
      const cached = aiMoviesCache.get(id);
      if (cached) {
        return res.json(cached);
      }

      // 3. Generate via Gemini if starts with 'ai_' or looks generated or if not in preset, or fallback
      const ai = getAI();
      if (!ai) {
        return res.status(404).json({ error: "Movie not found and AI engine is not configured." });
      }

      // We don't have the full model in cache, let's ask Gemini to generate full details
      // using the movie name if we can infer it, or generate details for a movie ID.
      // Since the client searches first and gets results, if they request an AI movie ID, we should have cached it in the search phase.
      // But if we did not, we generate a cohesive movie based on standard ID or fallback.
      const prompt = `Generate a fully completed, rich movie details object corresponding strictly to the following Movie TypeScript interface. The movie should be based on real cinematic facts or reasonable matching representations.
ID requested is: "${id}". If you can't identify a real movie with this ID, generate a beautiful original cinematic masterpiece with this ID.

typescript interface:
export interface CastMember {
  id: string;
  name: string;
  character: string;
  profilePath: string;
}
export interface Movie {
  id: string;
  title: string;
  tagline: string;
  overview: string;
  backdropPath: string; // Unsplash dynamic URL, e.g., https://images.unsplash.com/photo-<id>?w=1600&q=80 representing the vibe/scene
  posterPath: string; // Unsplash dynamic URL, e.g., https://images.unsplash.com/photo-<id>?w=600&q=80 representing a clean cinematic poster vibe
  releaseDate: string; // YYYY-MM-DD
  voteAverage: number; // 0 to 10
  voteCount: number;
  runtime: number; // in minutes
  genres: string[];
  director: string;
  cast: CastMember[]; // 4 members
}

Respond ONLY with a single JSON object. No markdown wrappers, no backticks, no markdown code block formatting. Just pure raw JSON.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const text = response.text || "";
      // Strip any markdown code wraps if they returned
      const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const movie: Movie = JSON.parse(cleanJson);
      
      // Ensure the ID matches
      movie.id = id;

      // Keep in cache
      aiMoviesCache.set(id, movie);
      res.json(movie);
    } catch (err: any) {
      console.error("Gemini detail generation failed:", err);
      res.status(500).json({ error: "Could not retrieve movie details.", details: err.message });
    }
  });

  // Search movies (Hybrid Preset + AI search engine!)
  app.get("/api/movies/search", async (req, res) => {
    try {
      const query = (req.query.q as string || "").trim();
      if (!query) {
        return res.json(PRESET_MOVIES.slice(0, 4));
      }

      // Filter from presets
      const matchedPresets = PRESET_MOVIES.filter((m) =>
        m.title.toLowerCase().includes(query.toLowerCase()) ||
        m.genres.some((g) => g.toLowerCase().includes(query.toLowerCase()))
      );

      // If we have Gemini configured, we can fetch dynamic AI movie search results to make the App feel infinitely deep!
      const ai = getAI();
      if (ai) {
        try {
          const prompt = `Search for movies matching the search query: "${query}". 
Provide exactly ${matchedPresets.length > 0 ? "3" : "6"} real movies matching this search. If it matches a major franchise or famous movie, include it!
They must be represented in JSON matching this Movie array TypeScript interface:

export interface CastMember {
  id: string;
  name: string;
  character: string;
  profilePath: string;
}
export interface Movie {
  id: string; // Generate unique alphanumeric ID prefixed with "ai_" (e.g. ai_scifi_123)
  title: string;
  tagline: string;
  overview: string;
  backdropPath: string; // Dynamic high quality Unsplash cinematic image URL, e.g., https://images.unsplash.com/photo-...
  posterPath: string; // Dynamic high quality Unsplash cinematic poster image URL, e.g., https://images.unsplash.com/photo-...
  releaseDate: string; // YYYY-MM-DD
  voteAverage: number; // 0 to 10
  voteCount: number;
  runtime: number; // minutes
  genres: string[];
  director: string;
  cast: CastMember[]; // 4 major cast members
}

Respond ONLY with a single JSON array object [ ... ]. Do not wrap it in markdown. Do not include tick marks.`;

          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
          });

          const text = response.text || "";
          const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
          const aiMovies: Movie[] = JSON.parse(cleanJson);

          // Seed the details cache so when they click, it loads instantly
          for (const m of aiMovies) {
            aiMoviesCache.set(m.id, m);
          }

          // Combine results
          const combined = [...matchedPresets, ...aiMovies];
          return res.json(combined);
        } catch (genErr) {
          console.error("Gemini search failed, falling back to local presets:", genErr);
          return res.json(matchedPresets);
        }
      }

      res.json(matchedPresets);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // AI-Powered Movie Recommendation & Chat
  // Allows users with accounts to ask for a custom watchlist or curated recommendations based on mood!
  app.post("/api/movies/ai-recommend", async (req, res) => {
    try {
      const { mood, genreFilter, userWatchlistTitles, favoriteGenres, recentlyViewedTitles, highlyRatedTitles, primaryReason, confidence } = req.body;
      const ai = getAI();
      
      if (!ai) {
        // Fallback recommendations if no AI key
        const subset = PRESET_MOVIES.slice(0, 3);
        return res.json({
          recommendations: subset,
          aiFeedback: "Here are some awesome cinematic blockbusters tailored for you. (Configure a Gemini API Key to unlock bespoke mood-based AI recommendations!)",
          recommendationReason: "From our curated collection",
          confidence: "low"
        });
      }

      const hasPersonalization = (favoriteGenres?.length || recentlyViewedTitles?.length || highlyRatedTitles?.length || userWatchlistTitles?.length);

      const personalizationBlock = hasPersonalization ? `
User Preference Profile:
- Favorite genres: [${(favoriteGenres || []).join(", ") || "not specified"}]
- Watchlist (already saved, avoid duplicates): [${(userWatchlistTitles || []).join(", ") || "empty"}]
- Recently viewed: [${(recentlyViewedTitles || []).join(", ") || "none"}]
- Movies they rated 8+/10: [${(highlyRatedTitles || []).join(", ") || "none"}]
- Primary personalization signal: "${primaryReason || "general preferences"}"
- Profile confidence: ${confidence || "low"}` : `
User Preference Profile: No personalization data available — recommend broadly acclaimed films.`;

      const prompt = `You are the CinemaOracle, an elite film critic and movie curator.
The user wants recommendations based on:
- Current Mood/Context: "${mood || "surprise me"}"
- Preferred Genre limit: "${genreFilter || "Any"}"
${personalizationBlock}

Recommend 4 specific real movies they would love. When personalization data is available, lean heavily on it — prefer movies matching their top genres and similar in tone to their highly-rated titles. Avoid titles already in their watchlist.

Provide:
1. "aiFeedback": A beautiful, compelling, short (2-3 sentences) personalized critical write-up explaining why this curated selection matches their mood AND their taste profile. Start with a phrase like "Because you enjoyed..." or "Given your love of..." when personalization data is available.
2. "recommendationReason": A single short phrase (max 8 words) explaining the primary reason for these picks. Examples: "Because you like Sci-Fi & Action", "Similar to movies you rated highly", "Matches your preferred genres", "Based on your viewing history". Use the user's actual data where possible.
3. "confidence": One of "high", "medium", or "low" reflecting how well the picks match the profile.
4. "recommendations": An array of those 4 movies with full detail structures matching the Movie typescript interface:

export interface CastMember {
  id: string;
  name: string;
  character: string;
  profilePath: string;
}
export interface Movie {
  id: string; // Alphanumeric string starting with "ai_rec_"
  title: string;
  tagline: string;
  overview: string;
  backdropPath: string; // cinematic high quality Unsplash url
  posterPath: string; // cinematic high quality Unsplash url
  releaseDate: string; // YYYY-MM-DD
  voteAverage: number; // 0 to 10
  voteCount: number;
  runtime: number; // minutes
  genres: string[];
  director: string;
  cast: CastMember[]; // 4 items
}

Format output as a single JSON object with fields:
{
  "aiFeedback": "...",
  "recommendationReason": "...",
  "confidence": "...",
  "recommendations": [ ... ]
}

Provide ONLY the raw JSON structure, with no markdown tick marks or wrapping.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const text = response.text || "";
      const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleanJson);

      // Seed the cache
      if (parsed.recommendations && Array.isArray(parsed.recommendations)) {
        for (const m of parsed.recommendations) {
          aiMoviesCache.set(m.id, m);
        }
      }

      res.json(parsed);
    } catch (err: any) {
      console.error("AI recommendation failed:", err);
      // Fallback
      res.json({
        recommendations: PRESET_MOVIES.slice(0, 3),
        aiFeedback: "Here's a hand-picked, premium recommendation list from our master archives to match your mood!",
        recommendationReason: "From our curated collection",
        confidence: "low"
      });
    }
  });

  // --- VITE INTEGRATION ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  return app;
}

// Traditional persistent-server bootstrap — used for local dev, Render,
// Railway, and Google Cloud Run. Vercel/Netlify import createApp() directly
// from their own serverless entry points instead and never call this.
async function startServer() {
  const app = await createApp();
  // Render/Railway/Cloud Run inject PORT themselves (Cloud Run requires
  // binding to it); falls back to 3000 for local dev where it's unset.
  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Movie Database fullstack server running on http://localhost:${PORT}`);
  });
}

// Skip the auto-listen when this module is loaded by a Vercel or Netlify
// serverless function (both platforms set these env vars themselves) —
// prevents a duplicate/conflicting listener from starting inside a
// serverless context where createApp() is imported but listen() must not run.
if (!process.env.VERCEL && !process.env.NETLIFY) {
  startServer();
}
