import {
  signInAnonymously,
  onAuthStateChanged,
  signInWithCustomToken,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

import { checkAndMigrateBoltSizes } from "./modules/calculator.js";
import { auth, isDevelopmentEnvironment } from "./modules/firebase.js";
import { initDelivery } from "./modules/delivery.js";
import { subscribeToProjects, getGlobalSettings } from "./modules/db.js";
import { setupEventListeners } from "./modules/events.js";
import { state } from "./modules/state.js";

import {
  showCustomAlert,
  switchView,
  renderDetailView,
  saveStateToHistory,
  updateUndoRedoButtons,
  updateProjectListUI,
  initTheme,
  initializeUIComponents,
  initializeJointFormState,
  populateGlobalBoltSelectorModal,
} from "./modules/ui.js";

// データ購読の解除関数（これはこのファイル内で保持でOK）
let unsubscribeProjects;

/**
 * アプリケーションの初期化（エントリーポイント）
 */
const BOLT_PROJECTS_CACHE_KEY = 'boltProjectsCache';

const initApp = async () => {
  console.log("🚀 App initializing...");
  const loader = document.getElementById("loader");

  try {
    // 1. テーマ適用 (最優先)
    initTheme();

    // 2. UIコンポーネントの初期化 (パレット、セレクトボックス等)
    initializeUIComponents();
    initializeJointFormState();

    // 3. イベントリスナー登録
    setupEventListeners();

    // 4. キャッシュから即座に表示（2回目以降の高速起動）
    try {
      const cached = sessionStorage.getItem(BOLT_PROJECTS_CACHE_KEY);
      if (cached) {
        state.projects = JSON.parse(cached);
        updateProjectListUI();
        if (loader) {
          loader.classList.add("opacity-0");
          setTimeout(() => (loader.style.display = "none"), 0);
        }
      }
    } catch (_) {}

    // 5. 認証とデータ同期の開始 (ここがエンジンの始動)
    startAuthAndDataSync(loader);

    console.log("✅ App initialized successfully.");
  } catch (err) {
    console.error("❌ Initialization failed:", err);
    if (loader) loader.style.display = "none";
    showCustomAlert("アプリの起動に失敗しました。リロードしてください。");
  }
};

/**
 * グローバル設定の読み込み
 */
const loadGlobalSettings = async () => {
  try {
    const settingsData = await getGlobalSettings();
    if (settingsData && settingsData.boltSizes) {
      state.globalBoltSizes = settingsData.boltSizes;
      console.log(
        "Global settings loaded:",
        state.globalBoltSizes.length,
        "items",
      );
    } else {
      console.log("No global settings found. Checking for migration...");
      await checkAndMigrateBoltSizes();
    }
  } catch (error) {
    console.error("Error loading global settings:", error);
    // 致命的ではないのでアラートまでは出さなくても良いが、出すならここ
  }
};

/**
 * 認証とデータ同期の開始フロー
 */
const startAuthAndDataSync = (loader) => {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // ▼▼▼ 【ここに追加】 ログイン済みなので、安全に設定を読み込めます ▼▼▼
      await loadGlobalSettings();
      populateGlobalBoltSelectorModal();
      // ログイン済みならプロジェクトデータを読み込む
      loadProjects(loader);
      // 搬入リスト機能の初期化
      initDelivery();
    } else {
      // 未ログインならログインを試みる
      try {
        if (
          isDevelopmentEnvironment &&
          typeof __initial_auth_token !== "undefined" &&
          __initial_auth_token
        ) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
        // ログイン成功すれば再度 onAuthStateChanged が発火して loadProjects が呼ばれる
      } catch (err) {
        console.error("Auth Error:", err);
        if (loader) loader.style.display = "none";
        showCustomAlert("データベースへの接続に失敗しました。");
      }
    }
  });
};

/**
 * プロジェクトデータの読み込みと購読
 */
const loadProjects = (loader) => {
  if (unsubscribeProjects) unsubscribeProjects();

  unsubscribeProjects = subscribeToProjects(
    // 成功時コールバック
    (newProjectsData, source) => {
      if (source === "Local") return;

      newProjectsData.sort((a, b) => a.name.localeCompare(b.name));

      // 履歴管理 (state.history を使用)
      if (!state.isUndoRedoOperation) {
        const lastState = state.history.stack[state.history.currentIndex];
        if (
          !lastState ||
          JSON.stringify(lastState) !== JSON.stringify(newProjectsData)
        ) {
          saveStateToHistory(newProjectsData);
        }
      }

      state.projects = newProjectsData;

      // キャッシュ更新（次回起動の高速化）
      try { sessionStorage.setItem(BOLT_PROJECTS_CACHE_KEY, JSON.stringify(state.projects)); } catch (_) {}

      // 削除されたプロジェクトを表示中だった場合の処理
      if (
        state.currentProjectId &&
        !state.projects.find((p) => p.id === state.currentProjectId)
      ) {
        state.currentProjectId = null;
        switchView("list");
      }

      // 画面描画
      const detailView = document.getElementById("project-detail-view");
      if (detailView && detailView.classList.contains("active")) {
        renderDetailView();
      } else {
        updateProjectListUI();
      }

      updateUndoRedoButtons();

      // ローダー非表示
      if (loader) {
        loader.classList.add("opacity-0");
        setTimeout(() => (loader.style.display = "none"), 500);
      }
    },
    // エラー時コールバック
    (error) => {
      console.error(error);
      if (loader) loader.style.display = "none";
      showCustomAlert("工事データの読み込みに失敗しました。");
    },
  );
};

// DOM読み込み完了時にアプリを起動（二重実行を防ぐ）
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  // すでに "interactive" または "complete" の場合
  initApp();
}
