import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Firebase client config values are not secret by Firebase's own security
// model — access control is enforced by Firebase Auth rules, not by hiding
// these. They're still read exclusively from env vars (see .env.example) and
// never hardcoded here: this project is a public repo, and baking in a real
// project's config as a "fallback default" would mean anyone who clones it
// without configuring their own .env silently starts using the original
// developer's live Firebase project. If these are missing, Firebase's own
// SDK will throw a clear initialization error — the correct, expected
// behavior for an unconfigured environment, not something to paper over.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
