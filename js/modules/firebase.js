import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  signInWithCustomToken,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch,
  getDoc,
  setDoc,
  query,
  getDocs,
  where,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Firebase Configuration ---
const netlifyFirebaseConfig = {
  apiKey: "AIzaSyD91klyordRm3DGALHb-pYyxJzVY4NmCn0",
  authDomain: "bolt-calculator-3b175.firebaseapp.com",
  projectId: "bolt-calculator-3b175",
  storageBucket: "bolt-calculator-3b175.firebasestorage.app",
  messagingSenderId: "809544857551",
  appId: "1:809544857551:web:9e191c0267e315e80b44ba",
  measurementId: "G-ELKPMVBL71",
};
const firebaseConfig =
  typeof __firebase_config !== "undefined"
    ? JSON.parse(__firebase_config)
    : netlifyFirebaseConfig;
export const isDevelopmentEnvironment =
  typeof __firebase_config !== "undefined";

export const appId =
  typeof __app_id !== "undefined"
    ? __app_id
    : firebaseConfig
      ? firebaseConfig.projectId
      : "default-app-id";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const projectsCollectionRef = collection(
  db,
  `artifacts/${appId}/public/data/projects`,
);

/**
 * グローバルボルト設定を保存する
 */
export const saveGlobalBoltSizes = async (globalBoltSizes) => {
  try {
    // グローバル設定用のドキュメント参照（パスは環境に合わせて確認してください）
    const globalSettingsRef = doc(
      db,
      "artifacts",
      appId,
      "public",
      "data",
      "settings",
      "global",
    );

    await setDoc(
      globalSettingsRef,
      {
        boltSizes: globalBoltSizes,
      },
      { merge: true },
    );
    console.log("Global bolt sizes saved to DB.");
  } catch (error) {
    console.error("Error saving global settings:", error);
    throw error;
  }
};
