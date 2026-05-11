import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey:            "AIzaSyBXZwAh-Gb65IeJmt7Zx7UXx76VliksOqg",
  authDomain:        "falcons-tournament-d851f.firebaseapp.com",
  databaseURL:       "https://falcons-tournament-d851f-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "falcons-tournament-d851f",
  storageBucket:     "falcons-tournament-d851f.firebasestorage.app",
  messagingSenderId: "91107240577",
  appId:             "1:91107240577:web:ff346840b62dfd58ebfb80",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
