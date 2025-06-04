import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAKUPGvuXs-ewcUyCKVaVbU3sMXTzGK9xY",
  authDomain: "scrum-poker-e6a75.firebaseapp.com",
  databaseURL: "https://scrum-poker-e6a75-default-rtdb.europe-west1.firebasedatabase.app/",
  projectId: "scrum-poker-e6a75",
  storageBucket: "scrum-poker-e6a75.firebasestorage.app",
  messagingSenderId: "651145301518",
  appId: "1:651145301518:web:3ee004510ec206c4c4365f"
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
