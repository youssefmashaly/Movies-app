import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBQAdwuTKICthk9t09HyrlNw3T5b0H4psI",
  authDomain: "gen-lang-client-0351664131.firebaseapp.com",
  projectId: "gen-lang-client-0351664131",
  storageBucket: "gen-lang-client-0351664131.firebasestorage.app",
  messagingSenderId: "879652653971",
  appId: "1:879652653971:web:ec8f48244721a0b9223666"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app, "ai-studio-7c2da4ae-6118-44ea-9722-454f06ef8f3a");
