import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

export const firebaseConfig = {
  apiKey: "AIzaSyB7K8ZJxnZkOzj1-yWY-K_fjR8paCMz11Y",
  authDomain: "adonai-prestamos.firebaseapp.com",
  databaseURL: "https://adonai-prestamos-default-rtdb.firebaseio.com",
  projectId: "adonai-prestamos",
  storageBucket: "adonai-prestamos.firebasestorage.app",
  messagingSenderId: "181255865766",
  appId: "1:181255865766:web:f7ebb3753898a365263b67",
  measurementId: "G-SVSPQNQBVP",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
