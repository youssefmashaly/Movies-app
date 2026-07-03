// Vercel serverless entry point. An Express app is itself a valid
// (req, res) => void handler under Vercel's Node.js runtime, so no adapter
// package is needed here (unlike Netlify — see netlify/functions/api.ts).
// createApp() is cached across warm invocations to avoid rebuilding the
// Express app (and re-registering routes) on every request.
import type { IncomingMessage, ServerResponse } from "http";
import { createApp } from "../server";

let appPromise: ReturnType<typeof createApp> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!appPromise) appPromise = createApp();
  const app = await appPromise;
  return (app as any)(req, res);
}