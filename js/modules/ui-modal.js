// ui-modal.js
// モーダルの開閉、ドラッグ、削除確認、一括操作バー

import { state } from "./state.js";

export const openModal = (modalElement) => {
  if (!modalElement) return;

  modalElement.classList.remove("hidden");

  if (modalElement.classList.contains("modeless")) {
    // フローティングの場合：透明な幕を表示してクリックをブロック（スクロールは効く）
    const backdrop = document.getElementById("modeless-backdrop");
    if (backdrop) backdrop.classList.remove("hidden");
  } else {
    // 通常モーダルの場合：bodyのスクロールを止める
    document.body.classList.add("overflow-hidden");
  }

  setTimeout(() => modalElement.classList.remove("opacity-0"), 10);
};

export const closeModal = (modalElement) => {
  modalElement.classList.add("opacity-0");

  if (modalElement.classList.contains("modeless")) {
    const backdrop = document.getElementById("modeless-backdrop");
    if (backdrop) backdrop.classList.add("hidden");
  } else {
    document.body.classList.remove("overflow-hidden");
  }

  setTimeout(() => modalElement.classList.add("hidden"), 300);
};

/**
 * モーダル要素をドラッグ可能にするUIヘルパー関数
 * @param {HTMLElement} modalElement - ドラッグ対象のモーダル要素
 */
export const makeDraggable = (modalElement) => {
  if (!modalElement) return;

  const header = modalElement.querySelector(".border-b");
  if (!header) return;

  header.style.cursor = "move";
  header.style.touchAction = "none";

  let isDragging = false;
  let startX, startY, initialLeft, initialTop;

  const startDrag = (clientX, clientY) => {
    isDragging = true;
    startX = clientX;
    startY = clientY;

    const rect = modalElement.getBoundingClientRect();

    if (modalElement.style.transform !== "none") {
      modalElement.style.left = `${rect.left}px`;
      modalElement.style.top = `${rect.top}px`;
      modalElement.style.transform = "none";
      modalElement.style.bottom = "auto";
      modalElement.style.right = "auto";
    }

    initialLeft = parseInt(modalElement.style.left || rect.left);
    initialTop = parseInt(modalElement.style.top || rect.top);
  };

  const moveDrag = (clientX, clientY) => {
    if (!isDragging) return;
    const dx = clientX - startX;
    const dy = clientY - startY;
    modalElement.style.left = `${initialLeft + dx}px`;
    modalElement.style.top = `${initialTop + dy}px`;
  };

  const endDrag = () => {
    isDragging = false;
  };

  header.addEventListener("mousedown", (e) => startDrag(e.clientX, e.clientY));
  document.addEventListener("mousemove", (e) => {
    if (isDragging) {
      e.preventDefault();
      moveDrag(e.clientX, e.clientY);
    }
  });
  document.addEventListener("mouseup", endDrag);

  header.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        startDrag(touch.clientX, touch.clientY);
      }
    },
    { passive: false },
  );

  document.addEventListener(
    "touchmove",
    (e) => {
      if (isDragging && e.touches.length === 1) {
        e.preventDefault();
        const touch = e.touches[0];
        moveDrag(touch.clientX, touch.clientY);
      }
    },
    { passive: false },
  );

  document.addEventListener("touchend", endDrag);
};

/**
 * 削除確認モーダルを開く
 */
export const openConfirmDeleteModal = (id, type) => {
  const confirmDeleteModal = document.getElementById("confirm-delete-modal");
  if (!confirmDeleteModal) return;

  const deleteIdInput = document.getElementById("delete-id");
  const deleteTypeInput = document.getElementById("delete-type");
  const confirmDeleteMessage = document.getElementById(
    "confirm-delete-message",
  );

  if (deleteIdInput) deleteIdInput.value = id;
  if (deleteTypeInput) deleteTypeInput.value = type;

  if (confirmDeleteMessage) {
    const typeName =
      type === "joint" ? "継手" : type === "member" ? "部材" : "工事";
    confirmDeleteMessage.textContent = `この${typeName}を削除しますか？\nデータは復元できません。`;
  }

  openModal(confirmDeleteModal);
};

/**
 * 一括操作バーの表示・非表示を切り替える共通関数
 */
export const updateBulkBarVisibility = () => {
  const bulkBar = document.getElementById("bulk-action-bar");
  const selectedCount = document.querySelectorAll(
    ".project-checkbox:checked",
  ).length;
  const countDisplay = document.getElementById("selected-count-display");

  if (!bulkBar) return;

  if (selectedCount > 0) {
    if (countDisplay) countDisplay.textContent = `${selectedCount}件選択中`;
    bulkBar.classList.remove("translate-y-full");
    bulkBar.classList.add("translate-y-0");
  } else {
    bulkBar.classList.add("translate-y-full");
    bulkBar.classList.remove("translate-y-0");
  }
};

/**
 * 一括削除の選択状態とUIを初期状態にリセットする
 */
export const resetBulkDeleteState = () => {
  // 1. フローティングバーを隠す
  const bulkBar = document.getElementById("bulk-delete-bar");
  if (bulkBar) {
    bulkBar.classList.add("translate-y-24", "opacity-0", "pointer-events-none");
  }

  // 2. すべてのチェックボックスのチェックを外す
  document
    .querySelectorAll(".item-checkbox, .select-all-checkbox")
    .forEach((cb) => {
      cb.checked = false;
    });

  // 3. 行のハイライト（背景色）を元に戻す
  document.querySelectorAll(".item-row").forEach((row) => {
    row.classList.remove("!bg-yellow-100", "dark:!bg-yellow-900/40");
  });

  // 4. 裏側のメモリ（削除対象リスト）をクリア
  if (state.bulkDeleteTargets) {
    state.bulkDeleteTargets = null;
  }
};
