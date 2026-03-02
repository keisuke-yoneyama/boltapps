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
// const netlifyFirebaseConfig = {
//   apiKey: "AIzaSyD91klyordRm3DGALHb-pYyxJzVY4NmCn0",←古いキー
//   authDomain: "bolt-calculator-3b175.firebaseapp.com",
//   projectId: "bolt-calculator-3b175",
//   storageBucket: "bolt-calculator-3b175.firebasestorage.app",
//   messagingSenderId: "809544857551",
//   appId: "1:809544857551:web:9e191c0267e315e80b44ba",
//   measurementId: "G-ELKPMVBL71",
// };
//
// 自動生成されるファイルをインポート
// ※ ローカル開発時はこのファイルがないのでエラーにならないよう工夫が必要
let firebaseEnv = {};
try {
  const env = await import("./firebase-env.js");
  firebaseEnv = env.firebaseEnv;
  console.log("✅ firebase.js: Loaded configuration from firebase-env.js");
} catch (e) {
  console.log("firebase-env.js not found, using fallback or local config");
}

// Netlifyの設定 (環境変数から生成されたオブジェクトを使用)
const netlifyFirebaseConfig = {
  apiKey: firebaseEnv.apiKey,
  authDomain: firebaseEnv.authDomain,
  projectId: firebaseEnv.projectId,
  storageBucket: firebaseEnv.storageBucket,
  messagingSenderId: firebaseEnv.messagingSenderId,
  appId: firebaseEnv.appId,
  measurementId: firebaseEnv.measurementId,
};

// --- 3. 最終的な設定値の確認 ---
// ※ 重要: APIキーが空になっていないかコンソールで確認してください
console.log(
  "🔥 firebase.js: Final Config API Key:",
  netlifyFirebaseConfig.apiKey ? "OK (Exists)" : "MISSING (Empty!)",
);
console.log(
  "🔥 firebase.js: Final Config Project ID:",
  netlifyFirebaseConfig.projectId,
);

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

/**
 * 複数の工事の物件名を一括更新する関数
 * @param {string[]} ids - 更新対象のプロジェクトIDの配列
 * @param {string} newName - 新しい物件名
 */
export async function updateProjectPropertyNameBatch(ids, newName) {
  const batch = writeBatch(db);

  ids.forEach((id) => {
    // 【重要】パスを実際のプロジェクト保存場所（artifacts/...）に合わせる
    // projectsCollectionRef の構造を利用します
    const projectRef = doc(db, `artifacts/${appId}/public/data/projects`, id);
    batch.update(projectRef, { propertyName: newName });
  });

  await batch.commit();
  console.log(`[Firebase] ${ids.length}件のドキュメントを一括更新しました。`);
}
