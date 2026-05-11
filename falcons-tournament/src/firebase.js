import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// ─── Paste your Firebase config here ────────────────────────────
// You get this from the Firebase console when you create a web app.
// Step-by-step instructions are in the setup guide.
const firebaseConfig = {
  apiKey:            "REPLACE_ME",
  authDomain:        "REPLACE_ME",
  databaseURL:       "REPLACE_ME",
  projectId:         "REPLACE_ME",
  storageBucket:     "REPLACE_ME",
  messagingSenderId: "REPLACE_ME",
  appId:             "REPLACE_ME",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
