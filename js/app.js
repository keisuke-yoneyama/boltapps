import {
  signInAnonymously,
  onAuthStateChanged,
  signInWithCustomToken,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

import { checkAndMigrateBoltSizes } from "./modules/calculator.js";

import { auth, isDevelopmentEnvironment } from "./modules/firebase.js";

import {
  showCustomAlert,
  renderColorPalette,
  updateJointFormUI,
  renderStaticColorPalette,
  populateGlobalBoltSelectorModal,
  switchView,
  renderDetailView,
  saveStateToHistory,
  updateUndoRedoButtons,
  populateHugBoltSelector,
  generateCustomInputFields,
  updateProjectListUI,
  initTheme,
} from "./modules/ui.js";

import { subscribeToProjects, getGlobalSettings } from "./modules/db.js";

import { setupEventListeners } from "./modules/events.js";

import { state } from "./modules/state.js";

// let db, auth, projectsCollectionRef,
let unsubscribeProjects;
let history = { stack: [], currentIndex: -1 };
let isUndoRedoOperation = false;

// let dragSourceElement = null;

const initApp = async () => {
  console.log("🚀 App initializing...");

  try {
    // --- Step 1: テーマの適用 (画面のチラつきを防ぐため最初に行う) ---
    initTheme();

    // --- Step 2: データの読み込み (完了するまで待機) ---
    // ※ もし firebase.js に初期データロード関数を作っていない場合は、
    //    ここで updateProjectListUI() を呼ぶだけで良い場合もあります。
    //    (例: await loadGlobalSettings(); )

    // --- Step 3: UIの初期描画 ---
    // プロジェクト一覧を表示し、操作可能な状態にする
    // updateProjectListUI();

    // --- Step 4: イベントリスナーの一括登録 ---
    // ボタンや入力欄の動作を有効化する
    setupEventListeners();

    console.log("✅ App initialized successfully.");
  } catch (err) {
    console.error("❌ Initialization failed:", err);
    // 必要であればユーザーにエラーを表示する処理
    // alert("アプリの起動に失敗しました。リロードしてください。");
  }
};

/**
 * グローバル設定の読み込みと移行ロジック
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
    showCustomAlert("設定の読み込みに失敗しました。");
  }
};

document.addEventListener("DOMContentLoaded", () => {
  initApp();

  const loader = document.getElementById("loader");
  const views = {
    list: document.getElementById("project-list-view"),
    detail: document.getElementById("project-detail-view"),
  };

  const customLevelsContainer = document.getElementById(
    "custom-levels-container",
  );
  // const customAreasCountInput = document.getElementById("custom-areas-count");
  const customAreasContainer = document.getElementById(
    "custom-areas-container",
  );

  const jointTypeInput = document.getElementById("joint-type");

  const hasBoltCorrectionInput = document.getElementById("has-bolt-correction");

  const shopSplGroup = document.getElementById("shop-spl-group");
  const hasShopSplInput = document.getElementById("has-shop-spl");

  const shopTempBoltSizeInput = document.getElementById("shop-temp-bolt-size");
  const editShopTempBoltSizeInput = document.getElementById(
    "edit-shop-temp-bolt-size",
  );

  // 初期化時にパレット生成（デフォルト選択なし）
  renderColorPalette(null);

  // 初期化
  renderStaticColorPalette(null);

  function initializeAppLogic() {
    // dbやauthの初期化コードは不要になりました！
    // すぐに認証の監視を始めます

    onAuthStateChanged(auth, async (user) => {
      if (user) {
        // ログイン済みならデータを読み込む
        return loadProjects();
      }

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
      } catch (err) {
        console.error(err);
        loader.style.display = "none";
        showCustomAlert("データベースへの接続に失敗しました。");
      }
    });
  }

  generateCustomInputFields(1, customLevelsContainer, "custom-level");
  generateCustomInputFields(1, customAreasContainer, "custom-area");
  function loadProjects() {
    // 既存の監視があれば解除
    if (unsubscribeProjects) unsubscribeProjects();

    // ★ db.js の関数を利用
    unsubscribeProjects = subscribeToProjects(
      // 成功時の処理 (データとソースが渡ってくる)
      (newProjectsData, source) => {
        // ▼▼▼ Local更新時のスキップ判定 ▼▼▼
        if (source === "Local") {
          return; // ローカル変更は即時反映済みなので再描画しない
        }
        // ▲▲▲

        // データのソート (UIの都合なのでここに残すのがベター)
        newProjectsData.sort((a, b) => a.name.localeCompare(b.name));

        // --- ここから下は以前のコードとほぼ同じ UI/Stateロジック ---

        // 履歴管理 (Undo/Redo)
        if (!isUndoRedoOperation) {
          const lastState = history.stack[history.currentIndex];
          // 中身が変わっていれば履歴に保存
          if (
            !lastState ||
            JSON.stringify(lastState) !== JSON.stringify(newProjectsData)
          ) {
            saveStateToHistory(newProjectsData);
          }
        }

        // ステート更新
        state.projects = newProjectsData;

        // 削除されたプロジェクトを表示中だった場合の処理
        if (
          state.currentProjectId &&
          !state.projects.find((p) => p.id === state.currentProjectId)
        ) {
          state.currentProjectId = null;
          switchView("list");
        }

        // 画面描画
        if (views.detail.classList.contains("active")) {
          renderDetailView();
        } else {
          updateProjectListUI();
        }

        updateUndoRedoButtons();

        // ローダー非表示
        loader.classList.add("opacity-0");
        setTimeout(() => (loader.style.display = "none"), 500);
      },
      // エラー時の処理
      (error) => {
        console.error(error); // デバッグ用にログ出ししておくと便利
        loader.style.display = "none";
        showCustomAlert("工事データの読み込みに失敗しました。");
      },
    );
  }

  // populateBoltSelectorModal(); // ← 廃止
  populateHugBoltSelector(shopTempBoltSizeInput);
  populateHugBoltSelector(editShopTempBoltSizeInput);
  populateHugBoltSelector(document.getElementById("shop-temp-bolt-size-f"));
  populateHugBoltSelector(document.getElementById("shop-temp-bolt-size-w"));
  populateHugBoltSelector(
    document.getElementById("edit-shop-temp-bolt-size-f"),
  );
  populateHugBoltSelector(
    document.getElementById("edit-shop-temp-bolt-size-w"),
  );
  initializeAppLogic();

  // Run after initialization logic
  loadGlobalSettings().then(() => {
    populateGlobalBoltSelectorModal();
  });

  updateJointFormUI(false); // 初期UI状態を設定

  const initialJointTypeForSpl = jointTypeInput.value;
  const applicableSplTypes = ["girder", "beam", "stud", "other"];
  if (applicableSplTypes.includes(initialJointTypeForSpl)) {
    shopSplGroup.classList.remove("hidden");
    hasShopSplInput.checked = true;
  }

  if (hasShopSplInput.checked) {
    hasBoltCorrectionInput.disabled = false;
  } else {
    hasBoltCorrectionInput.disabled = true;
    hasBoltCorrectionInput.checked = false;
  }
}); // document.addEventListener('DOMContentLoaded', ...) の終わり
