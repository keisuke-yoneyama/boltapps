import {
  closeModal,
  resetProjectEditCache,
  changeEditComplexSplCount,
  changeComplexSplCount,
  updateJointFormUI,
  selectColor,
  updateEditComplexSplCacheItem,
  selectStaticColor,
  toggleFab,
  closeFabIfOutside,
  openNewJointModal,
  openNewMemberModal,
  openTempBoltSettingsModal,
  populateGlobalBoltSelectorModal,
  openModal,
  updateDynamicInputs,
  showCustomAlert,
  performHistoryAction,
  switchTab,
  switchView,
  resetMemberForm,
  renderBoltSizeSettings,
  showToast,
  generateCustomInputFields,
  updateProjectListUI,
} from "./ui.js"; // ui.jsで作った関数を使う

import { resetTempJointData, state } from "./state.js";

import { updateProjectData, addProject } from "./db.js";

import { BOLT_TYPES } from "./config.js";

import { saveGlobalBoltSizes } from "./firebase.js";

import {
  sortGlobalBoltSizes,
  cleanupAndSaveBoltSettings,
} from "./calculator.js";
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
  setupModalConplexSplPlusMinusBtnEvents(); //継手
  setupJointTypeChangedEvents(); //継手登録常設フォーム
  setupEditJointTypeChangedEvents();

  setupCloseBoltSizeSelectModalBtnEvents();
  setupCloseCustomAlertModalBtnEvents();

  setupColorPalleteEvents(); //カラーパレット関係

  setupFloatingFABBottunEvents(); //登録用フローティングボタン

  setupBoltSizeInputClicked(); //ボルトサイズ選択モーダルの起動イベント

  setupProjectFormEvents(); // 工事登録フォーム関係のイベント

  setupConfirmMemberDeletionEvents(); //部材削除確認モーダルのイベント

  setupNavigationEvents(); // ナビゲーションボタン設定

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

  setupUndoRedoEvents(); //undo,redo

  setupColorControlEvents(); //カラーピッカー、トグル、クリアボタン

  setupBoltSettingsEvents(); // ★ボルトサイズ設定画面イベント
}

//登録用フローティングボタンイベント
function setupFloatingFABBottunEvents() {
  // // メインのFABボタン
  // const fabMainBtn = document.getElementById("fab-toggle"); // IDは確認してください
  // if (fabMainBtn) {
  //   fabMainBtn.addEventListener("click", () => {
  //     toggleFab(); // 引数なし＝トグル
  //   });
  // }

  // (オプション) メニュー内のボタンを押したら閉じるようにしたい場合
  const subButtons = document.querySelectorAll(".fab-sub-button"); // htmlのクラス名で取得する
  subButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      toggleFab(false); // 強制的に閉じる
    });
  });

  // 1. FAB開閉ボタン
  const fabToggle = document.getElementById("fab-toggle"); // ID確認
  if (fabToggle) {
    fabToggle.addEventListener("click", (e) => {
      e.stopPropagation(); // 親への伝播を止める
      toggleFab();
    });
  }

  // 2. 画面の他の場所をクリックしたら閉じる
  document.addEventListener("click", (e) => {
    closeFabIfOutside(e.target);
  });

  // 3. 継手登録ボタン (fab-add-joint)
  const fabAddJoint = document.getElementById("fab-add-joint");
  if (fabAddJoint) {
    fabAddJoint.addEventListener("click", openNewJointModal);
  }

  // 4. 部材登録ボタン (fab-add-member)
  const fabAddMember = document.getElementById("fab-add-member");
  if (fabAddMember) {
    fabAddMember.addEventListener("click", openNewMemberModal);
  }

  // 5. 仮ボルト設定ボタン (fab-temp-bolt)
  const fabTempBolt = document.getElementById("fab-temp-bolt");
  if (fabTempBolt) {
    fabTempBolt.addEventListener("click", openTempBoltSettingsModal);
  }
}

//カラーバレット関係のイベントセットアップ
function setupColorPalleteEvents() {
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

  // ▼▼▼ 追加: 常設フォーム用カラーパレットのクリック ▼▼▼
  const staticContainer = document.getElementById(
    "static-color-palette-container",
  );

  if (staticContainer) {
    staticContainer.addEventListener("click", (e) => {
      const swatch = e.target.closest(".color-swatch");
      if (swatch) {
        const color = swatch.dataset.color;
        selectStaticColor(color); // UI更新関数を呼ぶ
      }
    });
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

function setupBoltSizeInputClicked() {
  // ▼▼▼ 修正：ボルト選択モーダルを開く対象のIDリスト ▼▼▼
  const boltInputIds = [
    // 編集モーダルの入力欄
    "edit-flange-size",
    "edit-web-size",

    // 仮ボルト詳細の入力欄
    "edit-shop-temp-bolt-size",
    "edit-shop-temp-bolt-size-f",
    "edit-shop-temp-bolt-size-w",

    // 複合スプライスの入力欄（初期表示されているもの）
    "edit-web-size", // 重複していますが念のため
    "edit-web-size-2",
    "edit-web-size-3",
    "edit-web-size-4",
  ];

  boltInputIds.forEach((id) => {
    const inputElement = document.getElementById(id);

    // 要素が存在する場合のみイベントを設定
    if (inputElement) {
      // クリックされたらボルト選択モーダルを開く
      inputElement.addEventListener("click", (e) => {
        // 1. 現在操作中の入力欄を state に保存
        state.activeBoltTarget = e.target;

        // 2. モーダルの中身（ボタン一覧）を生成
        populateGlobalBoltSelectorModal();

        // 3. モーダルを表示
        // ※IDはHTMLに合わせて修正してください
        const modal = document.getElementById("bolt-selector-modal");
        openModal(modal);
      });
    }
  });
}

/**
 * 工事登録・編集フォーム関連のイベント
 */
const setupProjectFormEvents = () => {
  // --- 1. 新規工事登録フォームの要素 ---
  const advancedSettingsToggle = document.getElementById(
    "advanced-settings-toggle",
  );
  const simpleProjectSettings = document.getElementById(
    "simple-project-settings",
  );
  const advancedProjectSettings = document.getElementById(
    "advanced-project-settings",
  );

  const addCustomLevelsCountInput = document.getElementById(
    "add-custom-levels-count",
  );
  const customLevelsContainer = document.getElementById(
    "custom-levels-container",
  );
  const addDecrementLevelsBtn = document.getElementById(
    "add-decrement-levels-btn",
  );
  const addIncrementLevelsBtn = document.getElementById(
    "add-increment-levels-btn",
  );

  const addCustomAreasCountInput = document.getElementById(
    "add-custom-areas-count",
  );
  const customAreasContainer = document.getElementById(
    "custom-areas-container",
  );
  const addDecrementAreasBtn = document.getElementById(
    "add-decrement-areas-btn",
  );
  const addIncrementAreasBtn = document.getElementById(
    "add-increment-areas-btn",
  );

  // --- 2. 工事編集モーダルの要素 ---
  const editCustomLevelsCountInput = document.getElementById(
    "edit-custom-levels-count",
  );
  const editCustomLevelsContainer = document.getElementById(
    "edit-custom-levels-container",
  );
  const decrementLevelsBtn = document.getElementById("decrement-levels-btn");
  const incrementLevelsBtn = document.getElementById("increment-levels-btn");

  const editCustomAreasCountInput = document.getElementById(
    "edit-custom-areas-count",
  );
  const editCustomAreasContainer = document.getElementById(
    "edit-custom-areas-container",
  );
  const decrementAreasBtn = document.getElementById("decrement-areas-btn");
  const incrementAreasBtn = document.getElementById("increment-areas-btn");

  // ▼▼▼ 新規登録フォームのイベント ▼▼▼

  // 詳細設定トグル
  if (
    advancedSettingsToggle &&
    simpleProjectSettings &&
    advancedProjectSettings
  ) {
    advancedSettingsToggle.addEventListener("change", (e) => {
      simpleProjectSettings.classList.toggle("hidden", e.target.checked);
      advancedProjectSettings.classList.toggle("hidden", !e.target.checked);
    });
  }

  // 階層数 (新規)
  if (addDecrementLevelsBtn) {
    addDecrementLevelsBtn.addEventListener("click", () =>
      updateDynamicInputs(
        addCustomLevelsCountInput,
        customLevelsContainer,
        state.newLevelNameCache, // stateから参照
        "custom-level",
        -1,
      ),
    );
  }
  if (addIncrementLevelsBtn) {
    addIncrementLevelsBtn.addEventListener("click", () =>
      updateDynamicInputs(
        addCustomLevelsCountInput,
        customLevelsContainer,
        state.newLevelNameCache, // stateから参照
        "custom-level",
        1,
      ),
    );
  }

  // エリア数 (新規)
  if (addDecrementAreasBtn) {
    addDecrementAreasBtn.addEventListener("click", () =>
      updateDynamicInputs(
        addCustomAreasCountInput,
        customAreasContainer,
        state.newAreaNameCache, // stateから参照
        "custom-area",
        -1,
      ),
    );
  }
  if (addIncrementAreasBtn) {
    addIncrementAreasBtn.addEventListener("click", () =>
      updateDynamicInputs(
        addCustomAreasCountInput,
        customAreasContainer,
        state.newAreaNameCache, // stateから参照
        "custom-area",
        1,
      ),
    );
  }

  // ▼▼▼ 工事編集モーダルのイベント ▼▼▼

  // 手入力防止 (Backspace/Delete無効化)
  [editCustomLevelsCountInput, editCustomAreasCountInput].forEach((input) => {
    if (input) {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" || e.key === "Delete") {
          e.preventDefault();
        }
      });
    }
  });

  // 階層数 (編集)
  if (decrementLevelsBtn) {
    decrementLevelsBtn.addEventListener("click", () =>
      updateDynamicInputs(
        editCustomLevelsCountInput,
        editCustomLevelsContainer,
        state.levelNameCache, // stateから参照
        "edit-level",
        -1,
      ),
    );
  }
  if (incrementLevelsBtn) {
    incrementLevelsBtn.addEventListener("click", () =>
      updateDynamicInputs(
        editCustomLevelsCountInput,
        editCustomLevelsContainer,
        state.levelNameCache, // stateから参照
        "edit-level",
        1,
      ),
    );
  }

  // エリア数 (編集)
  if (decrementAreasBtn) {
    decrementAreasBtn.addEventListener("click", () =>
      updateDynamicInputs(
        editCustomAreasCountInput,
        editCustomAreasContainer,
        state.areaNameCache, // stateから参照
        "edit-area",
        -1,
      ),
    );
  }
  if (incrementAreasBtn) {
    incrementAreasBtn.addEventListener("click", () =>
      updateDynamicInputs(
        editCustomAreasCountInput,
        editCustomAreasContainer,
        state.areaNameCache, // stateから参照
        "edit-area",
        1,
      ),
    );
  }
};

/**
 * 部材削除確認モーダルのイベント設定
 */
function setupConfirmMemberDeletionEvents() {
  // HTMLのIDを取得（index.htmlのIDと一致しているか確認してください）
  const confirmMemberDeletionBtn = document.getElementById(
    "confirm-member-deletion-btn",
  );
  const cancelMemberDeletionBtn = document.getElementById(
    "cancel-member-deletion-btn",
  );
  const confirmMemberDeletionModal = document.getElementById(
    "confirm-member-deletion-modal",
  );

  // 確定ボタン (削除実行)
  if (confirmMemberDeletionBtn) {
    confirmMemberDeletionBtn.addEventListener("click", () => {
      if (state.pendingUpdateData) {
        updateProjectData(state.currentProjectId, state.pendingUpdateData)
          .then(() => {
            // ★保存成功したらモーダルを閉じてデータをクリア
            // (元のコードには明記されていませんでしたが、ここで閉じるのが自然です)
            if (confirmMemberDeletionModal)
              closeModal(confirmMemberDeletionModal);
            state.pendingUpdateData = null;
          })
          .catch((err) => {
            console.error(err);
            showCustomAlert("保存に失敗しました。リロードしてください。");
          });
      }
    });
  }

  // キャンセルボタン
  if (cancelMemberDeletionBtn) {
    cancelMemberDeletionBtn.addEventListener("click", () => {
      if (confirmMemberDeletionModal) closeModal(confirmMemberDeletionModal);
      state.pendingUpdateData = null;
    });
  }
}

/**
 * Undo/Redoボタンのイベント設定
 */
function setupUndoRedoEvents() {
  const undoBtn = document.getElementById("undo-btn");
  const redoBtn = document.getElementById("redo-btn");
  const mobileUndoBtn = document.getElementById("mobile-undo-btn");
  const mobileRedoBtn = document.getElementById("mobile-redo-btn");

  // Undoボタン (PC / Mobile)
  [undoBtn, mobileUndoBtn].forEach((btn) => {
    if (btn) {
      btn.addEventListener("click", () => performHistoryAction("undo"));
    }
  });

  // Redoボタン (PC / Mobile)
  [redoBtn, mobileRedoBtn].forEach((btn) => {
    if (btn) {
      btn.addEventListener("click", () => performHistoryAction("redo"));
    }
  });
}

/**
 * ナビゲーションバー関連のイベント設定
 * (タブ切り替え、ハンバーガーメニュー、戻るボタン)
 */
function setupNavigationEvents() {
  // DOM要素の取得
  const navTabJoints = document.getElementById("nav-tab-joints");
  const navTabTally = document.getElementById("nav-tab-tally");
  const mobileNavTabJoints = document.getElementById("mobile-nav-tab-joints");
  const mobileNavTabTally = document.getElementById("mobile-nav-tab-tally");
  const hamburgerBtn = document.getElementById("hamburger-btn");
  const mobileMenu = document.getElementById("mobile-menu");

  const backBtnDesktop = document.getElementById("nav-back-to-list-btn");
  const backBtnMobile = document.getElementById("mobile-nav-back-to-list-btn");

  // 1. タブ切り替えボタン (PC & Mobile)
  const tabs = [
    navTabJoints,
    navTabTally,
    mobileNavTabJoints,
    mobileNavTabTally,
  ];

  tabs.forEach((tab) => {
    // 要素が存在する場合のみイベント登録
    if (tab) {
      tab.addEventListener("click", (e) => {
        // data-tab属性を取得
        const tabName = e.target.dataset.tab;
        if (tabName) {
          switchTab(tabName);
        }

        // モバイル表示時、メニューを閉じる
        if (window.innerWidth < 768 && mobileMenu) {
          mobileMenu.classList.add("hidden");
        }
      });
    }
  });

  // 2. ハンバーガーメニューの開閉
  if (hamburgerBtn && mobileMenu) {
    hamburgerBtn.addEventListener("click", () => {
      mobileMenu.classList.toggle("hidden");
    });
  }

  // 3. 「物件一覧に戻る」ボタン (PC & Mobile 共通処理)
  const handleBackToList = () => {
    state.currentProjectId = null;
    resetMemberForm(); // フォームをリセット
    switchView("list");
  };

  if (backBtnDesktop) {
    backBtnDesktop.addEventListener("click", handleBackToList);
  }
  if (backBtnMobile) {
    backBtnMobile.addEventListener("click", handleBackToList);
  }
}

/**
 * カラー設定（ピッカー、クリアボタン、トグル）関連のイベント
 */
function setupColorControlEvents() {
  // --- 1. 編集モーダル用の要素 ---
  const editJointColorInput = document.getElementById("edit-joint-color");
  const clearJointColorBtn = document.getElementById("clear-joint-color-btn"); // ID要確認

  // イベントリスナー：標準ピッカーで色が選ばれた時 (編集)
  if (editJointColorInput) {
    editJointColorInput.addEventListener("input", (e) => {
      editJointColorInput.dataset.isNull = "false";
      // 全てのパレットの選択解除（編集モーダル内のものを対象にするのが理想ですが、現状は全体でも動作します）
      document
        .querySelectorAll(".color-swatch")
        .forEach((el) => el.classList.remove("selected"));
    });
  }

  // イベントリスナー：設定なしボタン (編集)
  if (clearJointColorBtn) {
    clearJointColorBtn.addEventListener("click", () => {
      if (editJointColorInput) {
        editJointColorInput.value = "#ffffff";
        editJointColorInput.dataset.isNull = "true";
      }
      document
        .querySelectorAll(".color-swatch")
        .forEach((el) => el.classList.remove("selected"));
    });
  }

  // --- 2. 新規登録(常設)フォーム用の要素 ---
  const jointColorToggle = document.getElementById("joint-color-toggle");
  const jointColorSection = document.getElementById("joint-color-section");
  const jointColorInput = document.getElementById("joint-color");
  const staticClearJointColorBtn = document.getElementById(
    "static-clear-joint-color-btn",
  ); // ID要確認
  const staticColorPaletteContainer = document.getElementById(
    "static-color-palette-container",
  );

  // トグルスイッチの制御
  if (jointColorToggle && jointColorSection) {
    jointColorToggle.addEventListener("change", (e) => {
      jointColorSection.classList.toggle("hidden", !e.target.checked);
    });
  }

  // 標準ピッカー (常設)
  if (jointColorInput) {
    jointColorInput.addEventListener("input", () => {
      if (staticColorPaletteContainer) {
        staticColorPaletteContainer
          .querySelectorAll(".color-swatch")
          .forEach((el) => el.classList.remove("selected"));
      }
    });
  }

  // 解除ボタン (常設)
  if (staticClearJointColorBtn) {
    staticClearJointColorBtn.addEventListener("click", () => {
      if (jointColorInput) jointColorInput.value = "#ffffff";

      if (staticColorPaletteContainer) {
        staticColorPaletteContainer
          .querySelectorAll(".color-swatch")
          .forEach((el) => el.classList.remove("selected"));
      }
    });
  }
}

/**
 * ボルトサイズ設定画面（グローバル設定）のイベント設定
 */
function setupBoltSettingsEvents() {
  const navBtnBoltSettings = document.getElementById("nav-btn-bolt-settings");
  const boltSizeSettingsModal = document.getElementById(
    "bolt-size-settings-modal",
  );
  const newBoltTypeSelect = document.getElementById("new-bolt-type");
  const addBoltSizeBtn = document.getElementById("add-bolt-size-btn");
  const newBoltLengthInput = document.getElementById("new-bolt-length");
  const boltSizeList = document.getElementById("bolt-size-list");

  const closeBoltSizeModalBtn = document.getElementById(
    "close-bolt-size-modal-btn",
  );
  const saveBoltSizeSettingsBtn = document.getElementById(
    "save-bolt-size-settings-btn",
  );

  // 1. タブ切り替え
  document.querySelectorAll(".bolt-tab-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      // ui.js の render 関数にタブ名を渡して描画更新
      // (ui.js側で activeBoltTab を更新して描画する実装になっている前提)
      renderBoltSizeSettings(e.target.dataset.tab);
    });
  });

  // 2. 設定モーダルを開く (NAVボタン)
  if (navBtnBoltSettings) {
    navBtnBoltSettings.classList.remove("hidden");
    navBtnBoltSettings.addEventListener("click", () => {
      // 種類セレクトボックスの生成
      if (newBoltTypeSelect) {
        newBoltTypeSelect.innerHTML = "";
        BOLT_TYPES.forEach((type) => {
          const opt = document.createElement("option");
          opt.value = type;
          opt.textContent = type;
          newBoltTypeSelect.appendChild(opt);
        });
        newBoltTypeSelect.value = "M16";
      }

      renderBoltSizeSettings(); // 初期描画
      if (boltSizeSettingsModal) openModal(boltSizeSettingsModal);
    });
  }

  // 3. 新規追加ボタン
  if (addBoltSizeBtn) {
    addBoltSizeBtn.addEventListener("click", async () => {
      const type = newBoltTypeSelect.value;
      const length = parseInt(newBoltLengthInput.value);

      if (!length || length <= 0) {
        showToast("長さを正しく入力してください");
        return;
      }

      const newId = `${type}×${length}`;

      // 重複チェック
      if (state.globalBoltSizes.some((b) => b.id === newId)) {
        showToast("このサイズは既に登録されています");
        return;
      }

      // 追加
      state.globalBoltSizes.push({
        id: newId,
        label: newId,
        type: type,
        length: length,
      });

      // 保存・再描画プロセス
      sortGlobalBoltSizes();
      renderBoltSizeSettings(); // 現在のタブで再描画
      populateGlobalBoltSelectorModal(); // セレクタの更新
      await saveGlobalBoltSizes(state.globalBoltSizes);

      // 入力クリア
      newBoltLengthInput.value = "";
      newBoltLengthInput.focus();

      // スクロール処理
      setTimeout(() => {
        if (boltSizeList) {
          const newItem = Array.from(boltSizeList.children).find((li) =>
            li.innerHTML.includes(newId),
          );
          if (newItem)
            newItem.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
    });
  }

  // 4. 閉じるボタンの処理 (finalizeBoltSettings)
  const handleFinalize = () => {
    const project = state.projects.find((p) => p.id === state.currentProjectId);

    // プロジェクトが開かれている場合、復元フラグのクリーンアップと保存を行う
    if (project) {
      cleanupAndSaveBoltSettings(project);
    }

    if (boltSizeSettingsModal) closeModal(boltSizeSettingsModal);
  };

  if (closeBoltSizeModalBtn) {
    closeBoltSizeModalBtn.addEventListener("click", handleFinalize);
  }
  if (saveBoltSizeSettingsBtn) {
    saveBoltSizeSettingsBtn.addEventListener("click", handleFinalize);
  }
}
/**
 * 工事データの登録・複製・削除などのアクション関連イベント
 */
function setupProjectActionEvents() {
  // --- 新規登録用 ---
  const addProjectBtn = document.getElementById("add-project-btn");
  const projectNameInput = document.getElementById("project-name");
  const propertyNameInput = document.getElementById("property-name");
  const advancedSettingsToggle = document.getElementById(
    "advanced-settings-toggle",
  );
  const simpleProjectSettings = document.getElementById(
    "simple-project-settings",
  );
  const advancedProjectSettings = document.getElementById(
    "advanced-project-settings",
  );

  const addCustomLevelsCountInput = document.getElementById(
    "add-custom-levels-count",
  );
  const addCustomAreasCountInput = document.getElementById(
    "add-custom-areas-count",
  );
  const customLevelsContainer = document.getElementById(
    "custom-levels-container",
  );
  const customAreasContainer = document.getElementById(
    "custom-areas-container",
  );

  const projectFloorsInput = document.getElementById("project-floors");
  const projectSectionsInput = document.getElementById("project-sections");
  const projectHasPhInput = document.getElementById("project-has-ph");

  // --- 複製用 ---
  const executeCopyBtn = document.getElementById("execute-copy-btn");
  const copySourceIdInput = document.getElementById("copy-source-project-id");
  const copyNewNameInput = document.getElementById("copy-new-project-name");
  const copyProjectModal = document.getElementById("copy-project-modal");
  const closeCopyModalBtn = document.getElementById("close-copy-modal-btn");
  const cancelCopyBtn = document.getElementById("cancel-copy-btn");

  // 1. 新規工事登録
  if (addProjectBtn) {
    addProjectBtn.addEventListener("click", async () => {
      // (中略: 元のロジックをここにコピー)
      // 注意: showCustomAlert, updateProjectListUI などの関数呼び出しが
      // インポートされていることを確認してください。

      const name = projectNameInput.value.trim();
      const propertyName = propertyNameInput
        ? propertyNameInput.value.trim()
        : ""; // nullチェック推奨

      if (!name)
        return showCustomAlert("工事名を入力してください。", {
          invalidElements: [projectNameInput],
        });

      let newProjectData;
      if (advancedSettingsToggle.checked) {
        const levelsCount = parseInt(addCustomLevelsCountInput.value),
          areasCount = parseInt(addCustomAreasCountInput.value);
        if (isNaN(levelsCount) || levelsCount < 1)
          return showCustomAlert("階層数は1以上の数値を入力してください。", {
            invalidElements: [addCustomLevelsCountInput], // 変数名注意
          });
        if (isNaN(areasCount) || areasCount < 1)
          return showCustomAlert("エリア数は1以上の数値を入力してください。", {
            invalidElements: [addCustomAreasCountInput], // 変数名注意
          });

        const customLevels = Array.from(
          document.querySelectorAll("#custom-levels-container input"),
        ).map((input) => input.value.trim());
        const customAreas = Array.from(
          document.querySelectorAll("#custom-areas-container input"),
        ).map((input) => input.value.trim());

        if (
          customLevels.some((l) => l === "") ||
          customAreas.some((a) => a === "")
        )
          return showCustomAlert(
            "すべての階層名とエリア名を入力してください。",
          );
        newProjectData = {
          name,
          propertyName,
          mode: "advanced",
          customLevels,
          customAreas,
        };
      } else {
        const floors = parseInt(projectFloorsInput.value),
          sections = parseInt(projectSectionsInput.value);
        if (isNaN(sections) || sections < 1)
          return showCustomAlert("工区数を正しく入力してください。", {
            invalidElements: [projectSectionsInput],
          });
        if (isNaN(floors) || floors <= 1)
          return showCustomAlert("階数は2以上の数値を入力してください。", {
            invalidElements: [projectFloorsInput],
          });
        newProjectData = {
          name,
          propertyName,
          mode: "simple",
          floors,
          sections,
          hasPH: projectHasPhInput.checked,
        };
      }

      const newProject = {
        ...newProjectData,
        joints: [],
        members: [],
        tally: {},
        isTallySheetGenerated: false,
        tempBoltMap: {},
        tallyLocks: {},
      };

      try {
        const docRef = await addProject(newProject);

        const createdProject = { ...newProject, id: docRef.id };
        state.projects.push(createdProject);

        state.projects.sort((a, b) => a.name.localeCompare(b.name));

        updateProjectListUI();
        showToast("新しい工事を登録しました。");
      } catch (err) {
        console.error(err);
        showCustomAlert("工事の追加に失敗しました。");
        return;
      }

      // フォームのリセット (state.newLevelNameCache もリセット)
      projectNameInput.value = "";
      if (propertyNameInput) propertyNameInput.value = "";
      projectFloorsInput.value = "";
      projectSectionsInput.value = "";
      projectHasPhInput.checked = false;
      advancedSettingsToggle.checked = false;
      simpleProjectSettings.classList.remove("hidden");
      advancedProjectSettings.classList.add("hidden");
      addCustomLevelsCountInput.value = "1";
      addCustomAreasCountInput.value = "1";

      // stateキャッシュのリセット (importしたstateを直接操作)
      state.newLevelNameCache = [];
      state.newAreaNameCache = [];

      customLevelsContainer.innerHTML = "";
      customAreasContainer.innerHTML = "";
      generateCustomInputFields(
        1,
        customLevelsContainer,
        "custom-level",
        state.newLevelNameCache,
      );
      generateCustomInputFields(
        1,
        customAreasContainer,
        "custom-area",
        state.newAreaNameCache,
      );
    });
  }

  // 2. 複製実行
  if (executeCopyBtn) {
    executeCopyBtn.addEventListener("click", async () => {
      // 連打防止
      executeCopyBtn.disabled = true;
      executeCopyBtn.classList.add("opacity-50", "cursor-not-allowed");
      executeCopyBtn.textContent = "処理中...";

      try {
        const sourceId = copySourceIdInput.value;
        const newName = copyNewNameInput.value.trim();
        const modeElement = document.querySelector(
          'input[name="copy-mode"]:checked',
        );
        const mode = modeElement ? modeElement.value : "with_master";

        if (!newName) throw new Error("工事名を入力してください。");

        const sourceProject = state.projects.find((p) => p.id === sourceId);
        if (!sourceProject) throw new Error("コピー元の工事が見つかりません。");

        // 重複チェック
        const isDuplicate = state.projects.some(
          (p) =>
            p.propertyName === sourceProject.propertyName && p.name === newName,
        );

        if (isDuplicate) {
          throw new Error(
            `物件「${
              sourceProject.propertyName || "(未設定)"
            }」内に、工事名「${newName}」は既に存在します。\n別の名前を指定してください。`,
          );
        }

        const newProject = JSON.parse(JSON.stringify(sourceProject));

        newProject.name = newName;
        delete newProject.id;

        if (mode === "settings_only") {
          newProject.joints = [];
          newProject.members = [];
          newProject.tally = {};
          newProject.tempBoltMap = {};
          newProject.isTallySheetGenerated = false;
          newProject.tallyLocks = {};
        } else if (mode === "with_master") {
          newProject.tally = {};
          newProject.isTallySheetGenerated = false;
          newProject.tallyLocks = {};
        } else if (mode === "full") {
          if (!newProject.tallyLocks) newProject.tallyLocks = {};
        }

        const docRef = await addProject(newProject);

        const createdProject = { ...newProject, id: docRef.id };
        state.projects.push(createdProject);
        state.projects.sort((a, b) => a.name.localeCompare(b.name));

        updateProjectListUI();
        if (copyProjectModal) closeModal(copyProjectModal);
        showToast("工事を複製しました。");
      } catch (err) {
        console.error("複製エラー:", err);
        showCustomAlert(err.message || "工事の複製に失敗しました。");
      } finally {
        executeCopyBtn.disabled = false;
        executeCopyBtn.classList.remove("opacity-50", "cursor-not-allowed");
        executeCopyBtn.textContent = "複製する";
      }
    });
  }

  // 3. 複製モーダルを閉じる
  [closeCopyModalBtn, cancelCopyBtn].forEach((btn) => {
    if (btn) {
      btn.addEventListener("click", () => closeModal(copyProjectModal));
    }
  });
}
