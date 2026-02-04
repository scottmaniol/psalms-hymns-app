import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyCeLPUZNZgN9v8-8ekv_dOmNnpbORqZ7v0",
  authDomain: "psalms-and-hymns-85ee4.firebaseapp.com",
  projectId: "psalms-and-hymns-85ee4",
  storageBucket: "psalms-and-hymns-85ee4.firebasestorage.app",
  messagingSenderId: "812173112142",
  appId: "1:812173112142:web:478abd20a28d6333f6a41f"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Cloud Functions and get a reference to the service
export const functions = getFunctions(app);

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code == 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled in one tab at a a time.
      // ...
      console.warn("Firebase Persistence: Multiple tabs open, persistence disabled.");
  } else if (err.code == 'unimplemented') {
      // The current browser does not support all of the features required to enable persistence
      // ...
      console.warn("Firebase Persistence: Browser not supported.");
  }
});
