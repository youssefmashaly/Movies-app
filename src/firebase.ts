import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Firebase client config values are not secret by Firebase's own security
// model — access control is enforced by Firebase Auth rules, not by hiding
// these. They're read from env vars here for config hygiene (swap Firebase
// projects across environments without touching source), with the original
// values as fallbacks so existing local setups keep working unmodified.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBQAdwuTKICthk9t09HyrlNw3T5b0H4psI",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "gen-lang-client-0351664131.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "gen-lang-client-0351664131",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "gen-lang-client-0351664131.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "879652653971",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:879652653971:web:ec8f48244721a0b9223666"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
