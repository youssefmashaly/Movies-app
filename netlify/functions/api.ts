// Netlify Functions use an (event, context) => response handler signature,
// not Express's (req, res) — unlike Vercel, this genuinely needs an adapter.
// serverless-http is the standard, minimal (no runtime deps of its own)
// solution for exactly this mismatch.
import serverless from "serverless-http";
import { createApp } from "../../server";

let handlerPromise: Promise<ReturnType<typeof serverless>> | null = null;

export const handler = async (event: any, context: any) => {
  if (!handlerPromise) {
    handlerPromise = createApp().then((app) => serverless(app));
  }
  const serverlessHandler = await handlerPromise;
  return serverlessHandler(event, context);
};