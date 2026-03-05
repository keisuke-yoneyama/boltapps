// ui-theme.js
// テーマ（ダーク/ライト）、Undo/Redo履歴

import { state, MAX_HISTORY_SIZE } from "./state.js";

/**
 * テーマ（ダーク/ライト）を適用する関数
 */
export const applyTheme = (theme) => {
  const darkModeToggle = document.getElementById("dark-mode-toggle");
  const mobileDarkModeToggle = document.getElementById(
    "mobile-dark-mode-toggle",
  );

  if (theme === "dark") {
    document.documentElement.classList.add("dark");
    if (darkModeToggle) darkModeToggle.checked = true;
    if (mobileDarkModeToggle) mobileDarkModeToggle.checked = true;
  } else {
    document.documentElement.classList.remove("dark");
    if (darkModeToggle) darkModeToggle.checked = false;
    if (mobileDarkModeToggle) mobileDarkModeToggle.checked = false;
  }
};

/**
 * テーマを切り替える関数（トグル用）
 */
export const toggleTheme = () => {
  const currentTheme = localStorage.getItem("theme");
  if (currentTheme === "dark") {
    localStorage.setItem("theme", "light");
    applyTheme("light");
  } else {
    localStorage.setItem("theme", "dark");
    applyTheme("dark");
  }
};

/**
 * アプリ起動時のテーマ初期化
 */
export const initTheme = () => {
  const savedTheme = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  if (savedTheme) {
    applyTheme(savedTheme);
  } else if (prefersDark) {
    applyTheme("dark");
  } else {
    applyTheme("light");
  }
};

/**
 * Undo/Redoボタンの活性状態を更新する
 */
export const updateUndoRedoButtons = () => {
  const undoBtn = document.getElementById("undo-btn");
  const redoBtn = document.getElementById("redo-btn");
  const mobileUndoBtn = document.getElementById("mobile-undo-btn");
  const mobileRedoBtn = document.getElementById("mobile-redo-btn");

  const canUndo = state.history.currentIndex > 0;
  const canRedo = state.history.currentIndex < state.history.stack.length - 1;

  [undoBtn, mobileUndoBtn].forEach((btn) => {
    if (btn) btn.disabled = !canUndo;
  });
  [redoBtn, mobileRedoBtn].forEach((btn) => {
    if (btn) btn.disabled = !canRedo;
  });
};

/**
 * 現在の状態をヒストリーに保存する
 */
export const saveStateToHistory = (projectsData) => {
  if (state.isUndoRedoOperation) return;

  // 新しい履歴を追加する場合、現在の位置より先の履歴（Redo用）は削除
  if (state.history.currentIndex < state.history.stack.length - 1) {
    state.history.stack = state.history.stack.slice(
      0,
      state.history.currentIndex + 1,
    );
  }

  // Deep Copyして保存
  state.history.stack.push(JSON.parse(JSON.stringify(projectsData)));
  state.history.currentIndex++;

  // 最大履歴数の制限
  if (state.history.stack.length > MAX_HISTORY_SIZE) {
    state.history.stack.shift();
    state.history.currentIndex--;
  }
  updateUndoRedoButtons();
};

/**
 * Undo/Redoを実行する
 * Note: renderDetailView と renderProjectList の呼び出しは循環依存を避けるため
 * コールバック経由で行う必要があるが、ここでは ui.js 内の savedListCallbacks に
 * アクセスするために ui.js から提供されるものをそのまま使う構造を保つ。
 * performHistoryAction は ui.js (バレルファイル) に残す。
 */
export const performHistoryActionRaw = (action, savedListCallbacks, renderDetailViewFn, renderProjectListFn) => {
  if (action === "undo" && state.history.currentIndex > 0) {
    state.isUndoRedoOperation = true;
    state.history.currentIndex--;
  } else if (
    action === "redo" &&
    state.history.currentIndex < state.history.stack.length - 1
  ) {
    state.isUndoRedoOperation = true;
    state.history.currentIndex++;
  } else {
    return;
  }

  // 履歴から復元
  state.projects = JSON.parse(
    JSON.stringify(state.history.stack[state.history.currentIndex]),
  );

  // 画面の再描画
  const viewDetail = document.getElementById("view-project-detail");
  const isDetailVisible =
    viewDetail && !viewDetail.classList.contains("hidden");

  if (isDetailVisible) {
    if (typeof renderDetailViewFn === "function") {
      renderDetailViewFn();
    }
  } else {
    renderProjectListFn(savedListCallbacks);
  }

  updateUndoRedoButtons();

  setTimeout(() => {
    state.isUndoRedoOperation = false;
  }, 100);
};
