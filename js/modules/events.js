import {
  closeModal,
  resetProjectEditCache,
  changeEditComplexSplCount,
  changeComplexSplCount,
  updateJointFormUI,
  selectColor,
  updateEditComplexSplCacheItem,
} from "./ui.js"; // ui.jsで作った関数を使う

import { resetTempJointData } from "./state.js";
/**
 * アプリ全体のイベントリスナーを設定する関数
 */
export function setupEventListeners() {
  setupEditMemberModalEvents(); //部材編集モーダルの終了動作
  setupEditModalEvents(); //継手編集モーダルの終了動作
  setupComfirmDeleteModalEvents();
  setupEditProjectModalEvents();
  setupComfirmAddModalEvents();

  setupEditModalConplexSplPlusMinusBtnEvents();
  setupModalConplexSplPlusMinusBtnEvents();
  setupJointTypeChangedEvents();
  setupEditJointTypeChangedEvents();

  setupCloseBoltSizeSelectModalBtnEvents();
  setupCloseCustomAlertModalBtnEvents();

  // ▼▼▼ 追加: カラーパレットのクリックイベント ▼▼▼
  const paletteContainer = document.getElementById("color-palette-container");

  if (paletteContainer) {
    paletteContainer.addEventListener("click", (e) => {
      // クリックされた要素が .color-swatch かどうか確認
      const swatch = e.target.closest(".color-swatch");

      if (swatch) {
        // swatchが持っている色情報を取得
        const color = swatch.dataset.color;

        // UI更新関数を呼び出す
        selectColor(color);
      }
    });
  }

  // ▼▼▼ 追加: 編集モーダル複合スプライス入力の監視 (4セット分) ▼▼▼
  for (let i = 1; i <= 4; i++) {
    const suffix = i > 1 ? `-${i}` : "";
    const sizeInput = document.getElementById(`edit-web-size${suffix}`);
    const countInput = document.getElementById(`edit-web-count${suffix}`);

    // 要素がある場合のみ登録
    if (sizeInput) {
      sizeInput.addEventListener("change", (e) => {
        // i-1 番目の 'size' を更新
        updateEditComplexSplCacheItem(i - 1, "size", e.target.value);
      });
    }

    if (countInput) {
      countInput.addEventListener("input", (e) => {
        // i-1 番目の 'count' を更新
        updateEditComplexSplCacheItem(i - 1, "count", e.target.value);
      });
    }
  }
}

//ボルトサイズ選択モーダル終了ボタンイベント
function setupCloseBoltSizeSelectModalBtnEvents() {
  const closeBoltModalBtn = document.getElementById("close-bolt-modal-btn");
  closeBoltModalBtn.addEventListener("click", () =>
    closeModal(document.getElementById("bolt-selector-modal")),
  );
}
//カスタムアラートモーダル終了ボタンイベント
function setupCloseCustomAlertModalBtnEvents() {
  const closeAlertBtn = document.getElementById("close-alert-btn");
  closeAlertBtn.addEventListener("click", () =>
    closeModal(document.getElementById("custom-alert-modal")),
  );
}

// //カスタムアラートモーダル終了ボタンイベント
// function setupComplexSplInputsChangedEvents() {
//   // 1. 対象のIDを文字列でリストアップ
//   const complexSplInputIds = ["is-complex-spl", "edit-is-complex-spl"];

//   // 2. ループ処理
//   complexSplInputIds.forEach((id) => {
//     const el = document.getElementById(id);

//     // 要素が存在する場合のみイベント登録
//     if (el) {
//       el.addEventListener("change", () => {
//         // ID名に "edit" が含まれているかで true/false を判定するテクニック
//         // これで isModal 引数を自動判別できます
//         const isModal = id.includes("edit");
//         updateJointFormUI(isModal);
//       });
//     }
//   });
// }

//継手編集モーダルの入力変更時のイベント登録
function setupEditJointTypeChangedEvents() {
  // --- 2. 編集モーダル用のグループ ---
  const editInputs = [
    "edit-joint-type",
    "edit-temp-bolt-setting",
    "edit-is-pin-joint",
    "edit-is-double-shear", // ★ここに含まれているのでOK
    "edit-has-shop-spl",
    "edit-is-complex-spl",
    // "edit-has-bolt-correction"
  ];

  editInputs.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("change", () => updateJointFormUI(true));
    }
  });
}

//継手登録フォームの入力変更時のイベント登録
function setupJointTypeChangedEvents() {
  // --- 1. 新規登録フォーム用のグループ ---
  const newInputs = [
    "joint-type",
    "temp-bolt-setting",
    "is-pin-joint",
    "is-double-shear", // ★ここに含まれているのでOK
    "has-shop-spl",
    "is-complex-spl", // 必要ならこれらも追加
    // "has-bolt-correction"
  ];

  newInputs.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("change", () => updateJointFormUI(false));
    }
  });
}

//編集モーダルの複合スプライスの増減ボタンのイベント登録
function setupEditModalConplexSplPlusMinusBtnEvents() {
  const editIncrementBtn = document.getElementById(
    "edit-increment-complex-spl-btn",
  );
  const editDecrementBtn = document.getElementById(
    "edit-decrement-complex-spl-btn",
  ); // マイナスボタンもあると想定

  // プラスボタン(編集モーダル)
  if (editIncrementBtn) {
    editIncrementBtn.addEventListener("click", () => {
      changeEditComplexSplCount(1);
    });
  }

  // マイナスボタン(編集モーダル)
  if (editDecrementBtn) {
    editDecrementBtn.addEventListener("click", () => {
      changeEditComplexSplCount(-1);
    });
  }
}

//継手編集画面の複合スプライスの増減ボタンのイベント登録
function setupModalConplexSplPlusMinusBtnEvents() {
  const IncrementBtn = document.getElementById("increment-complex-spl-btn");
  const DecrementBtn = document.getElementById("decrement-complex-spl-btn"); // マイナスボタンもある

  // プラスボタン
  if (IncrementBtn) {
    IncrementBtn.addEventListener("click", () => {
      changeComplexSplCount(1);
    });
  }

  // マイナスボタン
  if (DecrementBtn) {
    DecrementBtn.addEventListener("click", () => {
      changeComplexSplCount(-1);
    });
  }
}
/**
 * モーダル関連のイベントを設定（内部関数）
 */
//部材編集モーダル画面の何もしないで終了時の動作登録
function setupEditMemberModalEvents() {
  // 1. ここでIDを使って要素を取得（変数はこの関数の中だけで生きる）
  const editMemberModal = document.getElementById("edit-member-modal");
  const closeBtn = document.getElementById("close-edit-member-modal-btn");
  const cancelBtn = document.getElementById("cancel-member-edit-btn");

  // 2. 要素が存在するかチェック（安全対策）
  if (!editMemberModal) return;

  // 3. まとめて登録処理
  // （配列の中に null が混ざっても大丈夫なように filter します）
  [editMemberModal, closeBtn, cancelBtn]
    .filter((el) => el !== null)
    .forEach((el) => {
      el.addEventListener("click", (e) => {
        // 判定ロジック
        // 変数比較ではなく、IDやクラスで判定するとより堅牢です
        if (
          e.target === editMemberModal ||
          e.target.closest("#close-edit-member-modal-btn") ||
          e.target.closest("#cancel-member-edit-btn")
        ) {
          closeModal(editMemberModal);
        }
      });
    });
}

//継手編集モーダル画面の何もしないで終了時の動作登録
function setupEditModalEvents() {
  // 1. ここでIDを使って要素を取得（変数はこの関数の中だけで生きる）
  const closeEditModalBtn = document.getElementById("close-edit-modal-btn");
  const cancelEditBtn = document.getElementById("cancel-edit-btn");
  const editModal = document.getElementById("edit-joint-modal"); //親要素

  // 2. 要素が存在するかチェック（安全対策）
  if (!editModal) return;

  // 2. 配列に editModal (背景用) も追加し、nullを除外してから登録
  [editModal, closeEditModalBtn, cancelEditBtn]
    .filter((el) => el !== null) // nullがあったら除外（エラー防止）
    .forEach((el) => {
      el.addEventListener("click", (e) => {
        if (
          e.target === editModal || // 背景クリック
          e.target.closest("button") === closeEditModalBtn || // ×ボタン
          e.target.closest("button") === cancelEditBtn // キャンセルボタン
        ) {
          closeModal(editModal);
        }
      });
    });
}

//削除確認モーダルのキャンセル終了の動作登録
function setupComfirmDeleteModalEvents() {
  const confirmDeleteModal = document.getElementById("confirm-delete-modal");
  const cancelDeleteBtn = document.getElementById("cancel-delete-btn");

  if (!confirmDeleteModal) return;

  [cancelDeleteBtn, confirmDeleteModal] //×ボタンはないこのモーダルは
    .filter((el) => el !== null)
    .forEach((el) => {
      el.addEventListener("click", (e) => {
        // 判定ロジック
        // 変数比較ではなく、IDやクラスで判定するとより堅牢です
        if (
          e.target === confirmDeleteModal ||
          e.target.closest("button") === cancelDeleteBtn
        )
          closeModal(confirmDeleteModal);
      });
    });
}

//プロジェクト編集モーダルの途中終了時の動作登録
function setupEditProjectModalEvents() {
  const editProjectModal = document.getElementById("edit-project-modal");
  const closeBtn = document.getElementById("close-edit-project-modal-btn");
  const cancelBtn = document.getElementById("cancel-project-edit-btn");

  if (!editProjectModal) return;

  [editProjectModal, closeBtn, cancelBtn]
    .filter((el) => el !== null)
    .forEach((el) => {
      el.addEventListener("click", (e) => {
        // 判定ロジック
        if (
          e.target === editProjectModal ||
          e.target.closest("button") === closeBtn ||
          e.target.closest("button") === cancelBtn
        ) {
          closeModal(editProjectModal);

          // ★ここでクリア関数を呼ぶ！
          resetProjectEditCache();
        }
      });
    });
}
//このまま継手を登録しますか？のモーダルのキャンセル動作登録
function setupComfirmAddModalEvents() {
  const cancelAddBtn = document.getElementById("cancel-add-btn");
  const confirmAddModal = document.getElementById("confirm-add-modal");
  if (!confirmAddModal) return;

  [cancelAddBtn, confirmAddModal] //×ボタンはないこのモーダルは
    .filter((el) => el !== null)
    .forEach((el) => {
      el.addEventListener("click", (e) => {
        // 判定ロジック
        // 変数比較ではなく、IDやクラスで判定するとより堅牢です
        if (
          e.target === confirmAddModal ||
          e.target.closest("button") === cancelAddBtn
        )
          closeModal(confirmAddModal);
        resetTempJointData();
      });
    });
}
