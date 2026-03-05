// ui-notifications.js
// トースト通知、カスタムアラート、フォーカス制御

import { openModal } from "./ui-modal.js";

// ▼▼▼ フォーカス制御用の変数 ▼▼▼
export let focusToRestore = null;
export let justFinishedIME = false;
export let isEditing = false;

// 外部（events.jsなど）からこれらを更新するためのセッター
export const setFocusState = (focusConfig) => {
  if (focusConfig.focusToRestore !== undefined)
    focusToRestore = focusConfig.focusToRestore;
  if (focusConfig.justFinishedIME !== undefined)
    justFinishedIME = focusConfig.justFinishedIME;
  if (focusConfig.isEditing !== undefined) isEditing = focusConfig.isEditing;
};

/**
 * トースト通知を表示する
 * @param {string} message
 * @param {number} duration
 */
export const showToast = (message, duration = 5000) => {
  // 1. トースト通知のコンテナを取得
  const container = document.getElementById("toast-container");
  if (!container) return;

  // 2. 新しいトースト要素を動的に作成
  const toastElement = document.createElement("div");
  toastElement.className = "toast-item"; // CSSで定義したスタイルを適用
  toastElement.textContent = message;

  // 3. コンテナの先頭に新しいトーストを追加
  container.prepend(toastElement);

  // 4. 少し遅延させてから 'show' クラスを追加し、表示アニメーションを開始
  setTimeout(() => {
    toastElement.classList.add("show");
  }, 10);

  // 5. 指定時間後にトーストを消す処理
  setTimeout(() => {
    toastElement.classList.remove("show");

    // 6. アニメーションが終わるのを待ってから、DOMから要素を完全に削除
    toastElement.addEventListener("transitionend", () => {
      toastElement.remove();
    });
  }, duration);
};

/**
 * カスタムアラートを表示する
 */
export const showCustomAlert = (message, options = {}) => {
  const { title = "エラー", type = "error", invalidElements = [] } = options;

  // 1. エラーハイライトのリセット
  document
    .querySelectorAll(".input-error")
    .forEach((el) => el.classList.remove("input-error"));

  // 2. 新しいエラー箇所のハイライト
  if (Array.isArray(invalidElements)) {
    invalidElements.forEach((el) => {
      if (el && el.classList) el.classList.add("input-error");
    });
  }

  // 3. IDを使って要素をその場で取得
  const customAlertModal = document.getElementById("custom-alert-modal");
  const customAlertTitle = document.getElementById("custom-alert-title");
  const customAlertMessage = document.getElementById("custom-alert-message");

  if (!customAlertModal || !customAlertTitle || !customAlertMessage) {
    console.error("Alert modal elements not found in DOM.");
    alert(message);
    return;
  }

  // 4. 内容のセット
  customAlertTitle.textContent = title;
  customAlertMessage.textContent = message;

  // 5. 色の切り替え
  customAlertTitle.classList.remove("text-red-600", "text-green-600");
  if (type === "success") {
    customAlertTitle.classList.add("text-green-600");
  } else {
    customAlertTitle.classList.add("text-red-600");
  }

  // 6. モーダルを開く
  openModal(customAlertModal);
};
