# 🎬 Movies App

A full-stack, portfolio-quality movie discovery and social platform — personalized recommendations, watchlists, ratings, reviews, a follow system with taste-matching, and a cinematic dark UI.

<!-- 📸 Screenshots — add your own captures here before publishing -->
<!--
![Homepage](./docs/screenshots/homepage.png)
![Movie Detail](./docs/screenshots/movie-detail.png)
![Dashboard](./docs/screenshots/dashboard.png)
![Community](./docs/screenshots/community.png)
-->

## ✨ Features

- **Discovery** — trending, popular, hidden gems, critically acclaimed, award winners, genre/decade/director browsing, and an advanced multi-filter search panel with instant suggestions and search history
- **Personalization** — genre-affinity recommendations, "Because You Watched" rows, a personal dashboard with achievement badges, and session-diverse recommendation shuffling to reduce repetition
- **Social** — follow system, public profiles, taste-match compatibility scoring, community review feed with likes/helpful-votes, trending reviews, and leaderboards
- **Collaborative discovery** — "Highly Rated By People You Follow," "Popular Among Similar Users," and community-wide favorites, built on the existing follow graph and ratings data
- **Reliability** — global error boundary, graceful Supabase failure handling, empty states throughout, and image fallbacks on every artwork surface

## 🏗️ Architecture

- **Frontend:** React 19 + TypeScript, built with Vite, styled with Tailwind CSS and Framer Motion (`motion/react`)
- **Backend:** A single Node/Express server (`server.ts`) that serves both the REST API (`/api/movies/*`) and the built frontend — this is a Node application, not a static site
- **Auth:** Firebase Authentication
- **Database:** Supabase (Postgres + Row Level Security) for watchlists, ratings, reviews, follows, and profiles
- **AI:** Google Gemini, for the AI Matchmaker recommendation feature

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| UI | React 19, TypeScript, Tailwind CSS, Framer Motion, Lucide Icons |
| Build | Vite 6 |
| Backend | Express, tsx (dev), esbuild (prod bundle) |
| Auth | Firebase Authentication |
| Database | Supabase (Postgres, RLS) |
| AI | Google Gemini API |
| Artwork | TMDB API |

## 🚀 Run Locally

**Prerequisites:** Node.js 20+

1. Install dependencies:
npm install
2. Copy `.env.example` to `.env` and fill in your own values (see [Environment Variables](#-environment-variables) below).
3. Run the dev server:
npm run dev
4. Open `http://localhost:3000`.

## 🔑 Environment Variables

All required variables are documented with inline comments in [`.env.example`](.env.example). Summary:

| Variable | Required | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Yes | Database — watchlists, ratings, reviews, follows |
| `VITE_FIREBASE_*` (6 vars) | Yes | Authentication |
| `GEMINI_API_KEY` | Optional | Powers the AI Matchmaker; app degrades gracefully without it |
| `VITE_TMDB_API_KEY` | Optional | Only needed for the one-time artwork migration script |
| `VITE_ANALYTICS_ENABLED` / `VITE_ANALYTICS_ENDPOINT` | Optional | Off by default — see [Analytics](#-analytics--monitoring-optional) |

`.env` is git-ignored; never commit real credentials. Supabase's anon key and Firebase's client config are safe to expose in a public repo by design (access control is enforced server-side by RLS policies and Firebase Auth rules, not by secrecy) — but `GEMINI_API_KEY` should still be treated as a private credential.

## 📦 Production Build
npm run build
npm start

`npm run build` builds the Vite frontend **and** bundles `server.ts` into `dist/server.cjs` via esbuild. `npm start` runs the resulting Node server, which serves both the API and the static frontend from a single process on port 3000.

## ☁️ Deployment

**Important:** this app is a Node/Express server, not a static single-page app — `server.ts` hosts live API routes (`/api/movies/*`) and serves the built frontend itself. That means the deployment story differs from a typical Vite SPA.

**Render / Railway / Fly.io / Cloud Run (zero code changes):** any host that runs a persistent Node process works out of the box. Set the build command to `npm run build`, the start command to `npm start`, and configure the environment variables above.

**Vercel:** supported via [`api/index.ts`](api/index.ts) and [`vercel.json`](vercel.json), which route `/api/*` to a serverless handler built from the same `createApp()` factory `server.ts` exports — no Express-route rewrite needed, since an Express app is itself a valid request handler under Vercel's Node runtime.

**Netlify:** supported via [`netlify/functions/api.ts`](netlify/functions/api.ts) and [`netlify.toml`](netlify.toml), which wrap that same `createApp()` factory with [`serverless-http`](https://www.npmjs.com/package/serverless-http) (Netlify Functions use an `(event, context)` handler signature, not Express's `(req, res)`, so this adapter is genuinely required — unlike Vercel).

In all cases, the underlying Express app and its routes are defined once in `server.ts`; the platform-specific files just adapt how it's invoked.

## 🙏 Acknowledgements

- Movie data and artwork from [The Movie Database (TMDB)](https://www.themoviedb.org/). This product uses the TMDB API but is not endorsed or certified by TMDB.
- Icons by [Lucide](https://lucide.dev/).
- Built with [React](https://react.dev/), [Vite](https://vite.dev/), [Tailwind CSS](https://tailwindcss.com/), [Supabase](https://supabase.com/), [Firebase](https://firebase.google.com/), and [Google Gemini](https://ai.google.dev/).

## 📊 Analytics & Monitoring (optional)

A minimal, dependency-free analytics/error-reporting shim lives in `src/lib/analytics.ts`. It's **fully disabled by default** — zero network calls, zero runtime overhead — until you set `VITE_ANALYTICS_ENABLED=true` and `VITE_ANALYTICS_ENDPOINT` to your own collection endpoint. No third-party SDK, no paid service, no mandatory dependency. The global `ErrorBoundary` already calls `reportError()` on any unhandled render crash; wire `trackPageView()` / `trackEvent()` into other flows as needed.
