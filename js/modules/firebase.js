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
//
// 設定の優先順位:
//   1. __firebase_config グローバル変数 (Canvas開発環境 / Netlifyスニペット注入)
//      → Netlify: Site Settings > Build & Deploy > Snippet injection で注入
//   2. firebase-env.js (ローカル開発用オプション。.gitignore 対象)
//
// Netlify本番では スニペットで __firebase_config と __app_id を定義すること。

// ローカル開発用: firebase-env.js が存在すればそこから読む（任意）
let firebaseEnv = {};
try {
  const env = await import("./firebase-env.js");
  firebaseEnv = env.firebaseEnv;
  console.log("✅ firebase.js: firebase-env.js から設定を読み込みました");
} catch (e) {
  // firebase-env.js なし → __firebase_config を使用
}

const firebaseConfig =
  typeof __firebase_config !== "undefined"
    ? JSON.parse(__firebase_config)
    : {
        apiKey: firebaseEnv.apiKey,
        authDomain: firebaseEnv.authDomain,
        projectId: firebaseEnv.projectId,
        storageBucket: firebaseEnv.storageBucket,
        messagingSenderId: firebaseEnv.messagingSenderId,
        appId: firebaseEnv.appId,
        measurementId: firebaseEnv.measurementId,
      };

if (!firebaseConfig.apiKey) {
  console.error("❌ Firebase設定が取得できませんでした。Netlifyスニペットまたはfirebase-env.jsを確認してください。");
}

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

console.log(`🔑 appId (Firestoreパス用): "${appId}"`);

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
