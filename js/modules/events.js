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
  openConfirmDeleteModal,
  openNewMemberModal,
  openTempBoltSettingsModal,
  populateGlobalBoltSelectorModal,
  openModal,
  openEditModal,
  openEditMemberModal,
  updateDynamicInputs,
  showCustomAlert,
  performHistoryAction,
  switchTab,
  switchView,
  resetMemberForm,
  renderBoltSizeSettings,
  renderDetailView,
  showToast,
  generateCustomInputFields,
  updateProjectListUI,
  populateTempBoltMappingModal,
  resetJointForm,
  renderResults,
  renderOrderDetails,
  renderTempOrderDetails,
} from "./ui.js"; // ui.jsで作った関数を使う

import { resetTempJointData, state } from "./state.js";

import { updateProjectData, addProject, deleteProject } from "./db.js";

import { BOLT_TYPES } from "./config.js";

import { saveGlobalBoltSizes } from "./firebase.js";

import {
  sortGlobalBoltSizes,
  cleanupAndSaveBoltSettings,
  getTallyList,
  calculateResults,
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

  setupProjectActionEvents(); // 工事登録、複製アクション

  setupMemberActionEvents(); //部材の保存関係

  setupListActionEvents();

  setupDeleteExecutionEvents();

  setupTempBoltMappingEvents(); //仮ボルトマッピング(置き換え設定)

  setupJointActionEvents();

  setupAddActionEvents(); //常設フォームからの追加

  setupResultsCardEvents(); //集計結果関連のイベント

  setupOtherModalEvents(); //その他のモーダル関連のイベント
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
  const clearJointColorBtn = document.getElementById("clear-joint-color-btn");

  // イベントリスナー：標準ピッカーで色が選ばれた時 (編集)
  if (editJointColorInput) {
    editJointColorInput.addEventListener("input", (e) => {
      // ★ここに統合: 色を選んだら有効化フラグを立てる
      editJointColorInput.dataset.isNull = "false";

      // パレットの選択解除も同時に行う
      document
        .querySelectorAll(".color-swatch")
        .forEach((el) => el.classList.remove("selected"));
    });
  }

  // イベントリスナー：設定なしボタン (編集)
  if (clearJointColorBtn) {
    clearJointColorBtn.addEventListener("click", () => {
      if (editJointColorInput) {
        // ★ここに統合: 値を白に戻し、未設定フラグを立てる
        editJointColorInput.value = "#ffffff";
        editJointColorInput.dataset.isNull = "true";
      }
      // パレットの選択解除
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
  );
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

  // ▼▼▼ 追加: 工事編集保存用のDOM要素 ▼▼▼
  const saveProjectBtn = document.getElementById("save-project-btn");
  const editProjectModal = document.getElementById("edit-project-modal");

  const editProjectIdInput = document.getElementById("edit-project-id");
  const editProjectNameInput = document.getElementById("edit-project-name");
  // const editPropertyNameInput = document.getElementById("edit-property-name"); // 内部で取得しているので必須ではないが、出しても良い

  const editProjectFloorsInput = document.getElementById("edit-project-floors");
  const editProjectSectionsInput = document.getElementById(
    "edit-project-sections",
  );
  const editProjectHasPhInput = document.getElementById("edit-project-has-ph");

  const confirmActionModal = document.getElementById("confirm-action-modal");
  const confirmActionMessage = document.getElementById(
    "confirm-action-message",
  );

  // --- 4. 工事情報の保存 (編集) ---
  if (saveProjectBtn) {
    saveProjectBtn.addEventListener("click", () => {
      const projectId = editProjectIdInput.value;
      const project = state.projects.find((p) => p.id === projectId);
      if (!project) return;

      const newName = editProjectNameInput.value.trim();
      const newPropertyName = document
        .getElementById("edit-property-name")
        .value.trim();

      if (!newName)
        return showCustomAlert("工事名を入力してください。", {
          invalidElements: [editProjectNameInput],
        });

      // 更新実行関数
      const performUpdate = (projectData) => {
        const projectIndex = state.projects.findIndex(
          (p) => p.id === projectId,
        );
        if (projectIndex !== -1) {
          state.projects[projectIndex] = {
            ...state.projects[projectIndex],
            ...projectData,
          };
        }

        updateProjectListUI(); // 画面更新

        // ▼▼▼ 修正: state.currentProjectId ではなく projectId を使う ▼▼▼
        // updateProjectData(state.currentProjectId, projectData).catch((err) => {  <-- これがエラーの原因
        updateProjectData(projectId, projectData).catch((err) => {
          console.error("工事情報の保存に失敗:", err);
          showCustomAlert("工事情報の保存に失敗しました。");
        });

        if (editProjectModal) closeModal(editProjectModal);

        // ★修正: stateのキャッシュをリセット
        state.levelNameCache = [];
        state.areaNameCache = [];

        showToast(`工事情報を更新しました。`);
      };

      let updatedProjectData = { name: newName, propertyName: newPropertyName };

      // 詳細モードの場合
      if (project.mode === "advanced") {
        const newLevels = Array.from(
          document.querySelectorAll("#edit-custom-levels-container input"),
        ).map((i) => i.value.trim());
        const newAreas = Array.from(
          document.querySelectorAll("#edit-custom-areas-container input"),
        ).map((i) => i.value.trim());

        if (newLevels.includes("") || newAreas.includes("")) {
          const invalidInputs = [
            ...document.querySelectorAll(
              "#edit-custom-levels-container input, #edit-custom-areas-container input",
            ),
          ].filter((i) => i.value.trim() === "");
          showCustomAlert(
            "階層またはエリア名が空白です。すべての項目を入力してください。",
            { invalidElements: invalidInputs },
          );
          return;
        }

        const oldLevels = project.customLevels || [];
        const oldAreas = project.customAreas || [];

        updatedProjectData.customLevels = newLevels;
        updatedProjectData.customAreas = newAreas;

        // 箇所数データ(tally)のキー変換ロジック
        const newTally = {};
        const oldTally = project.tally || {};

        const oldLevelIndexMap = new Map(
          oldLevels.map((level, i) => [level, i]),
        );
        const oldAreaIndexMap = new Map(oldAreas.map((area, i) => [area, i]));

        // 長い名前順にソート（前方一致の誤判定防止）
        const sortedOldLevels = [...oldLevels].sort(
          (a, b) => b.length - a.length,
        );

        for (const oldKey in oldTally) {
          let oldLevelName = null;
          let oldAreaName = null;

          for (const level of sortedOldLevels) {
            if (oldKey.startsWith(level + "-")) {
              oldLevelName = level;
              oldAreaName = oldKey.substring(level.length + 1);
              break;
            }
          }

          if (!oldLevelName || !oldAreaName) continue;

          const levelIndex = oldLevelIndexMap.get(oldLevelName);
          const areaIndex = oldAreaIndexMap.get(oldAreaName);

          if (
            levelIndex !== undefined &&
            areaIndex !== undefined &&
            levelIndex < newLevels.length &&
            areaIndex < newAreas.length
          ) {
            const newLevelName = newLevels[levelIndex];
            const newAreaName = newAreas[areaIndex];
            const newKey = `${newLevelName}-${newAreaName}`;
            newTally[newKey] = oldTally[oldKey];
          }
        }

        updatedProjectData.tally = newTally;

        // 削除項目の検知
        const tallyDataToDeleteKeys = [];
        const oldTallyForDeletionCheck = project.tally || {};

        if (
          oldLevels.length > newLevels.length ||
          oldAreas.length > newAreas.length
        ) {
          for (const key in oldTallyForDeletionCheck) {
            let level = null;
            let area = null;
            for (const lvl of sortedOldLevels) {
              if (key.startsWith(lvl + "-")) {
                level = lvl;
                area = key.substring(lvl.length + 1);
                break;
              }
            }

            if (level && area) {
              if (!newLevels.includes(level) || !newAreas.includes(area)) {
                tallyDataToDeleteKeys.push(key);
              }
            }
          }
        }

        if (tallyDataToDeleteKeys.length > 0) {
          const removedItems = [
            ...oldLevels.filter((l) => !newLevels.includes(l)),
            ...oldAreas.filter((a) => !newAreas.includes(a)),
          ];
          document.getElementById("confirm-action-title").textContent =
            "箇所数データの削除確認";
          confirmActionMessage.innerHTML = `階層またはエリアの数を減らしたため、以下の項目に関連する箇所数データが削除されます。よろしいですか？<br><br><strong class="text-red-600">${removedItems.join(
            "、",
          )}</strong>`;

          state.pendingAction = () => performUpdate(updatedProjectData);
          if (confirmActionModal) openModal(confirmActionModal);
          return;
        }
      } else {
        // 簡易モードの場合
        updatedProjectData.floors = parseInt(editProjectFloorsInput.value);
        updatedProjectData.sections = parseInt(editProjectSectionsInput.value);
        updatedProjectData.hasPH = editProjectHasPhInput.checked;
      }

      performUpdate(updatedProjectData);
    });
  }
}

/**
 * 部材の保存（新規登録・更新）に関するイベント
 */
function setupMemberActionEvents() {
  const saveMemberBtn = document.getElementById("save-member-btn"); // ID確認
  const editMemberModal = document.getElementById("edit-member-modal");

  const editMemberIdInput = document.getElementById("edit-member-id");
  const editMemberNameInput = document.getElementById("edit-member-name");
  const editMemberJointSelect = document.getElementById(
    "edit-member-joint-select",
  ); // ID確認

  if (saveMemberBtn) {
    saveMemberBtn.addEventListener("click", () => {
      const project = state.projects.find(
        (p) => p.id === state.currentProjectId,
      );
      // 入力要素が取得できていない場合のガード
      if (!editMemberIdInput || !editMemberNameInput || !editMemberJointSelect)
        return;

      const memberId = editMemberIdInput.value; // 空なら新規
      if (!project) return;

      const newName = editMemberNameInput.value.trim();
      const newJointId = editMemberJointSelect.value;

      if (!newName)
        return showCustomAlert("部材名を入力してください。", {
          invalidElements: [editMemberNameInput],
        });
      if (!newJointId)
        return showCustomAlert("使用する継手を選択してください。", {
          invalidElements: [editMemberJointSelect],
        });

      // チェックされた階層を取得
      const checkedLevels = Array.from(
        document.querySelectorAll(".level-checkbox:checked"),
      ).map((cb) => cb.value);

      // 手順A: ローカルデータの更新
      let newMembersList;

      if (memberId) {
        // --- 更新 ---
        const member = project.members.find((m) => m.id === memberId);
        if (member) {
          member.name = newName;
          member.jointId = newJointId;
          member.targetLevels = checkedLevels; // 保存
        }
        newMembersList = project.members;
      } else {
        // --- 新規登録 ---
        const newMember = {
          id: `member_${Date.now()}`,
          name: newName,
          jointId: newJointId,
          targetLevels: checkedLevels, // 保存
        };
        newMembersList = [...(project.members || []), newMember];

        const projectIndex = state.projects.findIndex(
          (p) => p.id === state.currentProjectId,
        );
        if (projectIndex !== -1)
          state.projects[projectIndex].members = newMembersList;
      }

      // UI反映
      renderDetailView();

      const actionWord = memberId ? "更新" : "登録";
      showToast(`部材「${newName}」を${actionWord}しました`);

      // モーダル制御
      if (memberId) {
        // 編集モード：閉じる
        if (editMemberModal) closeModal(editMemberModal);
      } else {
        // 新規登録モード：リセットして継続
        editMemberNameInput.value = "";

        // 名前入力欄にフォーカスを戻す（連続入力用）
        editMemberNameInput.focus();
      }

      // DB保存
      updateProjectData(state.currentProjectId, {
        members: newMembersList,
      }).catch((err) => {
        showCustomAlert("部材の保存に失敗しました。");
        console.error("保存失敗: ", err);
      });
    });
  }
}

/**
 * リスト表示（継手・部材）内のボタンアクション（編集・削除）イベント
 */
function setupListActionEvents() {
  const jointListsContainer = document.getElementById("joint-lists-container");
  const memberListsContainer = document.getElementById(
    "member-lists-container",
  );

  // --- 1. 継手リストのクリック処理 ---
  if (jointListsContainer) {
    jointListsContainer.addEventListener("click", (e) => {
      // ボタン要素を取得（アイコンをクリックした場合も考慮）
      const target = e.target.closest("button");
      if (!target) return;

      const jointId = target.dataset.id;
      const project = state.projects.find(
        (p) => p.id === state.currentProjectId,
      );
      if (!project) return;

      // --- 削除ボタン ---
      if (target.classList.contains("delete-joint-btn")) {
        // ui.js からインポートした関数を使用
        openConfirmDeleteModal(jointId, "joint");
        return;
      }

      // --- 編集ボタン ---
      if (target.classList.contains("edit-joint-btn")) {
        const joint = project.joints.find((j) => j.id === jointId);
        if (joint) {
          // タイトルを「編集」に戻す
          const modalTitle = document.querySelector("#edit-joint-modal h3");
          if (modalTitle) modalTitle.textContent = "継手の編集";

          // 編集モーダルを開く (ui.js)
          openEditModal(joint);
        }
        return;
      }
    });
  }

  // --- 2. 部材リストのクリック処理 ---
  if (memberListsContainer) {
    memberListsContainer.addEventListener("click", (e) => {
      const target = e.target.closest("button");
      if (!target) return;

      // --- 削除ボタン ---
      if (target.classList.contains("delete-member-btn")) {
        openConfirmDeleteModal(target.dataset.id, "member");
      }
      // --- 部材編集ボタン ---
      else if (target.classList.contains("edit-member-btn")) {
        // タイトルを「編集」に戻す
        const modalTitle = document.querySelector("#edit-member-modal h3");
        if (modalTitle) modalTitle.textContent = "部材の編集";

        openEditMemberModal(target.dataset.id);
      }
      // --- 部材リスト内の継手ボタン（詳細確認用） ---
      else if (target.classList.contains("edit-joint-btn")) {
        const jointId = target.dataset.jointId;
        const project = state.projects.find(
          (p) => p.id === state.currentProjectId,
        );
        const joint = project?.joints.find((j) => j.id === jointId);

        if (joint) {
          // ここでもタイトルをリセットしておくと親切
          const modalTitle = document.querySelector("#edit-joint-modal h3");
          if (modalTitle) modalTitle.textContent = "継手の編集";

          openEditModal(joint);
        }
      }
    });
  }
}

/**
 * 削除実行（確定）ボタンのイベント設定
 */
function setupDeleteExecutionEvents() {
  const confirmDeleteBtn = document.getElementById("confirm-delete-btn");
  const deleteIdInput = document.getElementById("delete-id");
  const deleteTypeInput = document.getElementById("delete-type");
  const confirmDeleteModal = document.getElementById("confirm-delete-modal");

  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener("click", () => {
      // DOM要素の取得チェック
      if (!deleteIdInput || !deleteTypeInput || !confirmDeleteModal) return;

      const id = deleteIdInput.value;
      const type = deleteTypeInput.value;
      const projectId = state.currentProjectId;

      // ▼ パターン1：プロジェクト自体の削除
      if (type === "project") {
        deleteProject(id)
          .then(() => {
            // プロジェクト削除時はリスナー側で画面更新（リストから除外）が必要な場合がありますが
            // 通常はリアルタイムリスナーか、または手動でリスト更新を呼び出すと良いです。
            // ここではエラー時のアラートのみ実装されています。
          })
          .catch((err) => {
            console.error(err);
            showCustomAlert("工事の削除に失敗しました。");
          });

        closeModal(confirmDeleteModal);
        return;
      }

      // ▼ パターン2：継手・部材の削除 (楽観的UI)
      const projectIndex = state.projects.findIndex((p) => p.id === projectId);
      if (projectIndex === -1) {
        closeModal(confirmDeleteModal);
        return;
      }

      let updateData = {};
      let deletedItemName = "";

      if (type === "joint") {
        const joint = state.projects[projectIndex].joints.find(
          (j) => j.id === id,
        );
        if (joint) deletedItemName = joint.name;

        // 手順A: ローカルデータの書き換え
        const updatedJoints = state.projects[projectIndex].joints.filter(
          (j) => j.id !== id,
        );
        state.projects[projectIndex].joints = updatedJoints;
        updateData = { joints: updatedJoints };
        showToast(`継手「${deletedItemName}」を削除しました。`);
      } else if (type === "member") {
        const member = state.projects[projectIndex].members.find(
          (m) => m.id === id,
        );
        if (member) deletedItemName = member.name;

        // 手順A: ローカルデータの書き換え
        const updatedMembers = (
          state.projects[projectIndex].members || []
        ).filter((m) => m.id !== id);
        state.projects[projectIndex].members = updatedMembers;
        updateData = { members: updatedMembers };
        showToast(`部材「${deletedItemName}」を削除しました。`);
      }

      // 手順B: 画面再描画 (ui.jsからインポート)
      renderDetailView();

      // 手順C: モーダルを閉じる
      closeModal(confirmDeleteModal);

      // 手順D: DB保存処理
      if (Object.keys(updateData).length > 0) {
        updateProjectData(projectId, updateData).catch((err) => {
          showCustomAlert(
            "削除に失敗しました。ページをリロードして確認してください。",
          );
          console.error("削除に失敗:", err);
        });
      }
    });
  }
}
/**
 * 仮ボルトマッピング（置換設定）モーダルのイベント設定
 */
function setupTempBoltMappingEvents() {
  // DOM要素の取得
  const openTempBoltMappingBtn = document.getElementById(
    "open-temp-bolt-mapping-btn",
  );
  const tempBoltMappingModal = document.getElementById(
    "temp-bolt-mapping-modal",
  );
  const closeTempBoltMappingModalBtn = document.getElementById(
    "close-temp-bolt-mapping-modal-btn",
  );
  const cancelTempBoltMappingBtn = document.getElementById(
    "cancel-temp-bolt-mapping-btn",
  );
  const saveTempBoltMappingBtn = document.getElementById(
    "save-temp-bolt-mapping-btn",
  );
  const tempBoltMappingContainer = document.getElementById(
    "temp-bolt-mapping-container",
  );

  // 1. モーダルを開く
  if (openTempBoltMappingBtn) {
    openTempBoltMappingBtn.addEventListener("click", () => {
      const project = state.projects.find(
        (p) => p.id === state.currentProjectId,
      );
      if (project && tempBoltMappingModal) {
        // ui.js の関数を呼び出して中身を生成
        if (typeof populateTempBoltMappingModal === "function") {
          populateTempBoltMappingModal(project);
        }
        openModal(tempBoltMappingModal);
      }
    });
  }

  // 2. モーダルを閉じる（×ボタン・キャンセル）
  [closeTempBoltMappingModalBtn, cancelTempBoltMappingBtn].forEach((btn) => {
    if (btn) {
      btn.addEventListener("click", () => {
        if (tempBoltMappingModal) closeModal(tempBoltMappingModal);
      });
    }
  });

  // 3. 設定を保存する
  if (saveTempBoltMappingBtn) {
    saveTempBoltMappingBtn.addEventListener("click", () => {
      if (!tempBoltMappingContainer) return;

      const newMap = {};
      const selects = tempBoltMappingContainer.querySelectorAll(
        ".temp-bolt-map-select",
      );

      selects.forEach((select) => {
        const finalBolt = select.dataset.finalBolt;
        const tempBolt = select.value;
        if (finalBolt && tempBolt) {
          newMap[finalBolt] = tempBolt;
        }
      });

      // 1. ローカルのstateを更新
      const project = state.projects.find(
        (p) => p.id === state.currentProjectId,
      );
      if (project) {
        project.tempBoltMap = newMap;
      }

      // 2. UI再描画
      renderDetailView();

      // 3. モーダルを閉じて通知
      if (tempBoltMappingModal) closeModal(tempBoltMappingModal);
      showToast("仮ボルト設定を保存しました。");

      // 4. DB保存処理
      updateProjectData(state.currentProjectId, { tempBoltMap: newMap }).catch(
        (err) => {
          console.error("仮ボルト設定の保存に失敗しました: ", err);
          showCustomAlert(
            "設定の保存に失敗しました。エラーが発生したため、リロードが必要な場合があります。",
          );
        },
      );
    });
  }
}
/**
 * 継手の保存（新規登録・更新）に関するイベント
 */
function setupJointActionEvents() {
  const saveJointBtn = document.getElementById("save-joint-btn");
  const editJointIdInput = document.getElementById("edit-joint-id");
  const editJointNameInput = document.getElementById("edit-joint-name");
  const editJointTypeInput = document.getElementById("edit-joint-type");
  const editModal = document.getElementById("edit-joint-modal");

  // フラグ系チェックボックス
  const editIsPinJointInput = document.getElementById("edit-is-pin-joint");
  const editIsDoubleShearInput = document.getElementById(
    "edit-is-double-shear",
  );
  const editTempBoltSettingInput = document.getElementById(
    "edit-temp-bolt-setting",
  );
  const editHasShopSplInput = document.getElementById("edit-has-shop-spl");
  const editIsComplexSplInput = document.getElementById("edit-is-complex-spl");
  const editComplexSplCountInput = document.getElementById(
    "edit-complex-spl-count",
  );
  const editHasBoltCorrectionInput = document.getElementById(
    "edit-has-bolt-correction",
  );
  const editCountAsMemberInput = document.getElementById(
    "edit-count-as-member",
  );
  const editIsBundledWithColumnInput = document.getElementById(
    "edit-is-bundled-with-column",
  );

  // ボルト情報入力欄
  const editFlangeSizeInput = document.getElementById("edit-flange-size");
  const editFlangeCountInput = document.getElementById("edit-flange-count");
  const editWebSizeInput = document.getElementById("edit-web-size");
  const editWebCountInput = document.getElementById("edit-web-count");
  const editJointColorInput = document.getElementById("edit-joint-color");

  // 部材削除確認モーダル関連
  const confirmMemberDeletionModal = document.getElementById(
    "confirm-member-deletion-modal",
  );
  const confirmMemberDeletionMessage = document.getElementById(
    "confirm-member-deletion-message",
  );

  if (saveJointBtn) {
    saveJointBtn.addEventListener("click", () => {
      // DOM要素取得チェック (最低限必要なもの)
      if (!editJointIdInput || !editJointNameInput || !editJointTypeInput)
        return;

      const project = state.projects.find(
        (p) => p.id === state.currentProjectId,
      );
      const jointId = editJointIdInput.value; // 空なら新規
      if (!project) return;

      const oldJoint = jointId
        ? project.joints.find((j) => j.id === jointId)
        : {};

      // --- 入力値のチェック ---
      const type = editJointTypeInput.value;
      const name = editJointNameInput.value.trim();

      if (!name)
        return showCustomAlert("継手名を入力してください。", {
          invalidElements: [editJointNameInput],
        });

      // 新規登録時の名前重複チェック
      if (!jointId && project.joints.some((j) => j.name === name)) {
        return showCustomAlert(`継手名「${name}」は既に登録されています。`);
      }

      // ▼▼▼ 継手の種類に応じてフラグを強制補正 ▼▼▼
      let isPin = editIsPinJointInput.checked;
      let isDoubleShear = editIsDoubleShearInput.checked;
      const tempSetting = editTempBoltSettingInput.value;
      let hasShopSpl = editHasShopSplInput.checked;
      let isComplexSpl = editIsComplexSplInput.checked;

      // ピン接合を持てるタイプ（これ以外は強制OFF）
      const pinCapableTypes = ["girder", "beam", "stud", "other"];
      if (!pinCapableTypes.includes(type)) {
        isPin = false;
        isDoubleShear = false;
        isComplexSpl = false; // 複合SPLも無効化
      }

      // 2面せん断がOFFなら、それに依存するオプションも整理
      if (!isPin) {
        isDoubleShear = false;
      }

      // 工場SPLを持てるタイプ
      const splCapableTypes = ["girder", "beam", "stud", "other"];
      if (!splCapableTypes.includes(type)) {
        hasShopSpl = false;
      }
      // ▲▲▲ 補正ここまで ▲▲▲

      // 複合SPLのバリデーション
      if (isComplexSpl) {
        const splCount = parseInt(editComplexSplCountInput.value);
        const invalidElements = [];
        for (let i = 1; i <= splCount; i++) {
          const suffix = i > 1 ? `-${i}` : "";
          const sizeInput = document.getElementById(`edit-web-size${suffix}`);
          const countInput = document.getElementById(`edit-web-count${suffix}`);
          if (!sizeInput || !sizeInput.value) {
            if (sizeInput) invalidElements.push(sizeInput.parentElement);
          }
          if (!countInput || !countInput.value) {
            if (countInput) invalidElements.push(countInput);
          }
        }
        if (invalidElements.length > 0)
          return showCustomAlert(
            "複合型SPLのウェブサイズと本数をすべて入力してください。",
            { invalidElements },
          );
      }

      const webCountForValidation = isComplexSpl
        ? 0
        : parseInt(editWebCountInput.value) || 0;
      if (
        isPin &&
        isDoubleShear &&
        !isComplexSpl &&
        webCountForValidation < 2
      ) {
        return showCustomAlert(
          "2面せん断,シングルSPLの場合、ボルト本数は2本以上で入力してください。",
          { invalidElements: [editWebCountInput] },
        );
      }

      // --- データ作成 ---
      let updatedDataPayload = {
        ...oldJoint,
        id: jointId || `joint_${Date.now()}`,
        type,
        isPinJoint: isPin,
        isDoubleShear,
        hasShopSpl,
        hasBoltCorrection: hasShopSpl && editHasBoltCorrectionInput.checked,
        countAsMember: editCountAsMemberInput.checked,
        name: name,
        color:
          editJointColorInput.dataset.isNull === "true"
            ? null
            : editJointColorInput.value,
        isBundledWithColumn:
          type !== "column" &&
          editIsBundledWithColumnInput &&
          editIsBundledWithColumnInput.checked,
        flangeSize: editFlangeSizeInput.value,
        flangeCount: parseInt(editFlangeCountInput.value) || 0,
        webSize: editWebSizeInput.value,
        webCount: parseInt(editWebCountInput.value) || 0,
        isComplexSpl,
        complexSplCount: isComplexSpl
          ? parseInt(editComplexSplCountInput.value)
          : null,
        webInputs: null,
        tempBoltSetting: type === "column" ? "none" : tempSetting,

        // 仮ボルト詳細設定（DOM要素があれば値を取得）
        shopTempBoltCount:
          parseInt(
            document.getElementById("edit-shop-temp-bolt-count")?.value,
          ) || null,
        shopTempBoltSize:
          document.getElementById("edit-shop-temp-bolt-size")?.value || null,
        shopTempBoltCount_F:
          parseInt(
            document.getElementById("edit-shop-temp-bolt-count-f")?.value,
          ) || null,
        shopTempBoltSize_F:
          document.getElementById("edit-shop-temp-bolt-size-f")?.value || null,
        shopTempBoltCount_W:
          parseInt(
            document.getElementById("edit-shop-temp-bolt-count-w")?.value,
          ) || null,
        shopTempBoltSize_W:
          document.getElementById("edit-shop-temp-bolt-size-w")?.value || null,
      };

      // サイズ情報のクリーンアップ
      if (isPin) {
        updatedDataPayload.flangeSize = "";
        updatedDataPayload.flangeCount = 0;
      } else if (["column", "wall_girt", "roof_purlin"].includes(type)) {
        updatedDataPayload.webSize = "";
        updatedDataPayload.webCount = 0;
      }

      if (isComplexSpl) {
        updatedDataPayload.webSize = "";
        updatedDataPayload.webCount = 0;
        updatedDataPayload.webInputs = Array.from(
          { length: parseInt(editComplexSplCountInput.value) },
          (_, i) => {
            const suffix = i === 0 ? "" : `-${i + 1}`;
            return {
              size:
                document.getElementById(`edit-web-size${suffix}`)?.value || "",
              count:
                parseInt(
                  document.getElementById(`edit-web-count${suffix}`)?.value,
                ) || 0,
            };
          },
        );
      }

      // --- 保存実行関数 ---
      const performUpdate = (finalJointData, finalMembers) => {
        const projectIndex = state.projects.findIndex(
          (p) => p.id === state.currentProjectId,
        );
        if (projectIndex === -1) return;

        let newJointsList;
        if (jointId) {
          // 更新
          newJointsList = state.projects[projectIndex].joints.map((j) =>
            j.id === jointId ? finalJointData : j,
          );
        } else {
          // 新規追加
          newJointsList = [
            ...state.projects[projectIndex].joints,
            finalJointData,
          ];
        }

        state.projects[projectIndex].joints = newJointsList;
        if (finalMembers) {
          state.projects[projectIndex].members = finalMembers;
        }

        renderDetailView();

        if (jointId) {
          // 編集モードなら閉じる
          if (editModal) closeModal(editModal);
        } else {
          // 新規登録モードならリセットして継続
          resetJointForm();
          editJointIdInput.value = "";

          // 名前入力欄にフォーカス
          if (editJointNameInput) editJointNameInput.focus();
        }

        let boltInfo = "";
        if (finalJointData.isComplexSpl && finalJointData.webInputs)
          boltInfo = finalJointData.webInputs
            .map((w) => `${w.size}/${w.count}本`)
            .join(", ");
        else if (finalJointData.isPinJoint)
          boltInfo = `${finalJointData.webSize} / ${finalJointData.webCount}本`;
        else if (
          ["column", "wall_girt", "roof_purlin"].includes(finalJointData.type)
        )
          boltInfo = `${finalJointData.flangeSize} / ${finalJointData.flangeCount}本`;
        else
          boltInfo = `F:${finalJointData.flangeSize}/${finalJointData.flangeCount}本, W:${finalJointData.webSize}/${finalJointData.webCount}本`;

        const actionWord = jointId ? "更新" : "登録";
        showToast(
          `継手「${finalJointData.name}」を${actionWord}しました (${boltInfo})`,
        );

        const updatePayload = { joints: newJointsList };
        if (finalMembers) updatePayload.members = finalMembers;

        updateProjectData(state.currentProjectId, updatePayload).catch(
          (err) => {
            showCustomAlert(`継手の${actionWord}に失敗しました。`);
            console.error("保存失敗: ", err);
          },
        );
      };

      // 部材削除の警告が必要かどうか
      if (
        jointId &&
        updatedDataPayload.countAsMember &&
        !oldJoint.countAsMember
      ) {
        const membersToDelete = (project.members || []).filter(
          (member) => member.jointId === jointId,
        );
        if (membersToDelete.length > 0) {
          const memberNames = membersToDelete
            .map((m) => `・${m.name}`)
            .join("<br>");

          if (confirmMemberDeletionMessage) {
            confirmMemberDeletionMessage.innerHTML = `「部材としてカウント」をONにすると、紐付けられている以下の部材が削除されます。<br><strong class="text-red-600">${memberNames}</strong>`;
          }

          const updatedMembers = (project.members || []).filter(
            (member) => member.jointId !== jointId,
          );
          state.pendingAction = () => {
            performUpdate(updatedDataPayload, updatedMembers);
            if (confirmMemberDeletionModal)
              closeModal(confirmMemberDeletionModal);
          };
          if (confirmMemberDeletionModal) openModal(confirmMemberDeletionModal);
          return;
        }
      }

      performUpdate(updatedDataPayload);
    });
  }
}

/**
 * 常設フォームからの新規追加（継手・部材）イベント設定
 */
function setupAddActionEvents() {
  // --- 継手追加フォームの要素 ---
  const addJointBtn = document.getElementById("add-joint-btn");
  const jointNameInput = document.getElementById("joint-name");
  const jointTypeInput = document.getElementById("joint-type");
  const isPinJointInput = document.getElementById("is-pin-joint");
  const isDoubleShearInput = document.getElementById("is-double-shear");
  const tempBoltSettingInput = document.getElementById("temp-bolt-setting");
  const hasShopSplInput = document.getElementById("has-shop-spl");
  const isComplexSplInput = document.getElementById("is-complex-spl");
  const hasBoltCorrectionInput = document.getElementById("has-bolt-correction");
  const countAsMemberInput = document.getElementById("count-as-member");
  const isBundledWithColumnInput = document.getElementById(
    "is-bundled-with-column",
  ); // ID確認

  const flangeSizeInput = document.getElementById("flange-size");
  const flangeCountInput = document.getElementById("flange-count");
  const webSizeInput = document.getElementById("web-size");
  const webCountInput = document.getElementById("web-count");
  const complexSplCountInput = document.getElementById("complex-spl-count");

  const jointColorToggle = document.getElementById("joint-color-toggle");
  const jointColorInput = document.getElementById("joint-color");

  const confirmAddModal = document.getElementById("confirm-add-modal");
  const confirmAddMessage = document.getElementById("confirm-add-message");
  const confirmAddBtn = document.getElementById("confirm-add-btn"); // 追加：確認モーダルの「はい」ボタン

  // --- 部材追加フォームの要素 ---
  const addMemberBtn = document.getElementById("add-member-btn");
  const memberNameInput = document.getElementById("member-name");
  const memberJointSelectId = document.getElementById("member-joint-select"); // ID要確認
  // const memberJointSelectInput = document.getElementById("member-joint-select-input"); // 表示用inputがある場合

  // 1. 継手追加ボタン
  if (addJointBtn) {
    addJointBtn.addEventListener("click", () => {
      const project = state.projects.find(
        (p) => p.id === state.currentProjectId,
      );
      if (!project) return;

      const name = jointNameInput.value.trim();
      if (!name)
        return showCustomAlert("継手名を入力してください。", {
          invalidElements: [jointNameInput],
        });

      const type = jointTypeInput.value;
      const isPin = isPinJointInput.checked;
      const isDoubleShear = isDoubleShearInput.checked;
      const tempSetting = tempBoltSettingInput.value;
      const hasShopSpl = hasShopSplInput.checked;
      const isComplexSpl = isComplexSplInput.checked;

      // 仮ボルト詳細のバリデーション
      const showSingle =
        type === "column" ||
        (isPin && isDoubleShear && tempSetting === "none" && hasShopSpl);
      const showDual =
        !isPin && tempSetting === "none" && hasShopSpl && type !== "column";

      if (showSingle) {
        const size = document.getElementById("shop-temp-bolt-size").value;
        const countInput = document.getElementById("shop-temp-bolt-count");
        const count = parseInt(countInput.value, 10);
        if ((count > 0 && !size) || (size && !count)) {
          return showCustomAlert(
            "手動指定の仮ボルトは、サイズと本数を両方入力してください。",
            {
              invalidElements: [
                size
                  ? countInput
                  : document.getElementById("shop-temp-bolt-size"),
              ],
            },
          );
        }
      } else if (showDual) {
        const sizeF = document.getElementById("shop-temp-bolt-size-f").value;
        const countFInput = document.getElementById("shop-temp-bolt-count-f");
        const countF = parseInt(countFInput.value, 10);
        if ((countF > 0 && !sizeF) || (sizeF && !countF)) {
          return showCustomAlert(
            "工場用F仮ボルトは、サイズと本数を両方入力してください。",
            {
              invalidElements: [
                sizeF
                  ? countFInput
                  : document.getElementById("shop-temp-bolt-size-f"),
              ],
            },
          );
        }

        const sizeW = document.getElementById("shop-temp-bolt-size-w").value;
        const countWInput = document.getElementById("shop-temp-bolt-count-w");
        const countW = parseInt(countWInput.value, 10);
        if ((countW > 0 && !sizeW) || (sizeW && !countW)) {
          return showCustomAlert(
            "工場用W仮ボルトは、サイズと本数を両方入力してください。",
            {
              invalidElements: [
                sizeW
                  ? countWInput
                  : document.getElementById("shop-temp-bolt-size-w"),
              ],
            },
          );
        }
      }

      const isCounted = countAsMemberInput.checked;
      let flangeSize = flangeSizeInput.value;
      let flangeCountStr = flangeCountInput.value;
      let webSize = webSizeInput.value;
      let webCountStr = webCountInput.value;
      const invalidElements = [];
      const twoBoltTypes = ["girder", "beam", "other", "stud"];
      const oneBoltTypes = ["column", "wall_girt", "roof_purlin"];

      if (twoBoltTypes.includes(type)) {
        if (isPin) {
          if (!webSize) invalidElements.push(webSizeInput.parentElement);
          if (webCountStr === "") invalidElements.push(webCountInput);
        } else {
          if (!flangeSize) invalidElements.push(flangeSizeInput.parentElement);
          if (flangeCountStr === "") invalidElements.push(flangeCountInput);
          if (!webSize) invalidElements.push(webSizeInput.parentElement);
          if (webCountStr === "") invalidElements.push(webCountInput);
        }
      } else if (oneBoltTypes.includes(type)) {
        if (!flangeSize) invalidElements.push(flangeSizeInput.parentElement);
        if (flangeCountStr === "") invalidElements.push(flangeCountInput);
      }

      if (invalidElements.length > 0)
        return showCustomAlert("必須項目をすべて入力してください。", {
          invalidElements,
        });

      let flangeCount = parseInt(flangeCountStr) || 0;
      let webCount = parseInt(webCountStr) || 0;
      const complexSplCount = parseInt(complexSplCountInput.value);
      let webInputsData = null;

      if (isComplexSpl) {
        webInputsData = [];
        for (let i = 1; i <= complexSplCount; i++) {
          const suffix = i > 1 ? `-${i}` : "";
          const sizeVal = document.getElementById(`web-size${suffix}`).value;
          const countVal = document.getElementById(`web-count${suffix}`).value;
          webInputsData.push({ size: sizeVal, count: parseInt(countVal) || 0 });
        }
        webSize = "";
        webCount = 0;
      } else {
        if (isPin) {
          flangeSize = "";
          flangeCount = 0;
        }
        if (oneBoltTypes.includes(type)) {
          webSize = "";
          webCount = 0;
        }
      }

      const newJoint = {
        id: `joint_${Date.now()}`,
        type,
        name,
        color: jointColorToggle.checked ? jointColorInput.value : null,
        flangeSize,
        flangeCount,
        webSize: webSize,
        webCount: webCount,
        isComplexSpl: isComplexSpl,
        complexSplCount: isComplexSpl ? complexSplCount : null,
        webInputs: webInputsData,
        isPinJoint: isPin,
        isDoubleShear: isDoubleShearInput.checked,
        hasShopSpl:
          isPin && !isDoubleShearInput.checked
            ? false
            : hasShopSplInput.checked,
        hasBoltCorrection:
          isPin && !isDoubleShearInput.checked
            ? false
            : hasShopSplInput.checked && hasBoltCorrectionInput.checked,
        countAsMember: isCounted,
        tempBoltSetting:
          type === "column" ? "none" : tempBoltSettingInput.value,
        isBundledWithColumn:
          type !== "column" &&
          isBundledWithColumnInput &&
          isBundledWithColumnInput.checked,
        shopTempBoltCount:
          parseInt(document.getElementById("shop-temp-bolt-count").value) ||
          null,
        shopTempBoltSize:
          document.getElementById("shop-temp-bolt-size").value || null,
        shopTempBoltCount_F:
          parseInt(document.getElementById("shop-temp-bolt-count-f").value) ||
          null,
        shopTempBoltSize_F:
          document.getElementById("shop-temp-bolt-size-f").value || null,
        shopTempBoltCount_W:
          parseInt(document.getElementById("shop-temp-bolt-count-w").value) ||
          null,
        shopTempBoltSize_W:
          document.getElementById("shop-temp-bolt-size-w").value || null,
      };

      // 既存チェック
      const existingJoint = project.joints.find((j) => j.name === name);
      if (existingJoint) {
        state.tempJointData = newJoint;
        confirmAddMessage.textContent = `継手名「${name}」は既に登録されています。このまま登録しますか？`;
        if (confirmAddModal) openModal(confirmAddModal);
      } else {
        addJointAndShowToast(newJoint);
      }
    });
  }

  // 内部関数: 継手追加とトースト表示
  const addJointAndShowToast = (jointData) => {
    const projectIndex = state.projects.findIndex(
      (p) => p.id === state.currentProjectId,
    );
    if (projectIndex === -1) return;
    const updatedJoints = [...state.projects[projectIndex].joints, jointData];
    state.projects[projectIndex].joints = updatedJoints;

    renderDetailView();

    let boltInfo = "";
    if (jointData.isComplexSpl && jointData.webInputs)
      boltInfo = jointData.webInputs
        .map((w) => `${w.size}/${w.count}本`)
        .join(", ");
    else if (jointData.isPinJoint)
      boltInfo = `${jointData.webSize} / ${jointData.webCount}本`;
    else if (["column", "wall_girt", "roof_purlin"].includes(jointData.type))
      boltInfo = `${jointData.flangeSize} / ${jointData.flangeCount}本`;
    else
      boltInfo = `F:${jointData.flangeSize}/${jointData.flangeCount}本, W:${jointData.webSize}/${jointData.webCount}本`;
    showToast(`継手「${jointData.name}」を登録しました (${boltInfo})`);
    resetJointForm();
    if (jointNameInput) jointNameInput.focus();

    updateProjectData(state.currentProjectId, {
      joints: updatedJoints,
    }).catch((err) => {
      showCustomAlert(
        "継手の追加に失敗しました。ページをリロードしてデータを確認してください。",
      );
      console.error("継手の追加に失敗: ", err);
    });
  };

  // 確認モーダルの「はい」ボタン (confirm-add-btn) のイベントも必要
  if (confirmAddBtn) {
    confirmAddBtn.addEventListener("click", () => {
      if (state.tempJointData) {
        addJointAndShowToast(state.tempJointData);
        state.tempJointData = null;
        if (confirmAddModal) closeModal(confirmAddModal);
      }
    });
  }

  // 2. 部材追加ボタン
  if (addMemberBtn) {
    addMemberBtn.addEventListener("click", () => {
      const project = state.projects.find(
        (p) => p.id === state.currentProjectId,
      );
      if (!project) return;

      const name = memberNameInput.value.trim();
      const jointId = memberJointSelectId.value;

      if (!name)
        return showCustomAlert("部材名を入力してください。", {
          invalidElements: [memberNameInput],
        });
      if (!jointId)
        return showCustomAlert("使用する継手を選択してください。", {
          invalidElements: [memberJointSelectId], // ID確認
        });

      // チェックされた階層を取得
      const checkedLevels = Array.from(
        document.querySelectorAll(".static-level-checkbox:checked"),
      ).map((cb) => cb.value);

      const newMember = {
        id: `member_${Date.now()}`,
        name,
        jointId,
        targetLevels: checkedLevels,
      };

      // 楽観的UI処理
      if (!project.members) project.members = [];
      project.members.push(newMember);

      renderDetailView();

      memberNameInput.value = "";
      document
        .querySelectorAll(".static-level-checkbox")
        .forEach((cb) => (cb.checked = false));

      // 継手名を取得して表示 (リストから選択中のテキストを取得)
      const jointSelect = memberJointSelectId;
      const jointName = jointSelect.options[jointSelect.selectedIndex].text;

      showToast(`部材「${name}」を登録しました (使用継手: ${jointName})`);
      memberNameInput.focus();

      updateProjectData(state.currentProjectId, {
        members: project.members,
      }).catch((err) => {
        console.error("部材の追加に失敗: ", err);
        showCustomAlert(
          "部材の追加に失敗しました。ページをリロードして確認してください。",
        );
      });
    });
  }
}

/**
 * 集計結果カード内のイベント設定（再計算、Excel出力、表示切替、詳細モーダル）
 */
function setupResultsCardEvents() {
  const resultsCard = document.getElementById("results-card");

  // 要素がない場合はスキップ
  if (!resultsCard) return;

  resultsCard.addEventListener("click", (e) => {
    const project = state.projects.find((p) => p.id === state.currentProjectId);
    if (!project) return;

    // --- 1. 再計算ボタン (#recalculate-btn) ---
    if (e.target.closest("#recalculate-btn")) {
      const newTally = {};
      const inputs = document.querySelectorAll(".tally-input");
      inputs.forEach((input) => {
        const quantity = parseInt(input.value) || 0;
        if (quantity > 0) {
          const { location, id } = input.dataset;
          if (!newTally[location]) newTally[location] = {};
          newTally[location][id] = quantity;
        }
      });

      project.tally = newTally;
      renderResults(project); // UI更新

      updateProjectData(state.currentProjectId, { tally: newTally }).catch(
        (err) => {
          console.error("Error saving full tally:", err);
          showCustomAlert("保存に失敗しました。リロードしてください。");
        },
      );

      showCustomAlert("結果を更新しました。", {
        title: "成功",
        type: "success",
      });
      return; // 処理終了
    }

    // --- 2. Excel出力ボタン (#export-excel-btn) ---
    if (e.target.closest("#export-excel-btn")) {
      const { resultsByLocation, allBoltSizes } = calculateResults(project);
      if (allBoltSizes.size === 0) {
        return showCustomAlert(
          "集計表にデータがないため、Excelファイルを出力できません。",
        );
      }

      // XLSXライブラリがグローバルにある前提
      if (typeof XLSX === "undefined") {
        return showCustomAlert("Excel出力ライブラリが読み込まれていません。");
      }

      const wb = XLSX.utils.book_new();
      const tallyList = getTallyList(project);
      const typeNameMap = {
        girder: "大梁",
        beam: "小梁",
        column: "本柱",
        stud: "間柱",
        wall_girt: "胴縁",
        roof_purlin: "母屋",
        other: "その他",
      };

      const tallyHeaders = [
        "階層 / エリア",
        ...tallyList.map((item) => {
          let typeName = typeNameMap[item.joint.type] || "不明";
          if (item.joint.isPinJoint) typeName += "(ピン取り)";
          return `${item.name}(${typeName})`;
        }),
      ];

      const tallyData = [tallyHeaders];
      let locations = [];

      if (project.mode === "advanced") {
        project.customLevels.forEach((level) =>
          project.customAreas.forEach((area) =>
            locations.push({
              id: `${level}-${area}`,
              label: `${level} - ${area}`,
            }),
          ),
        );
      } else {
        for (let f = 2; f <= project.floors; f++) {
          for (let s = 1; s <= project.sections; s++)
            locations.push({ id: `${f}-${s}`, label: `${f}階 ${s}工区` });
        }
        for (let s = 1; s <= project.sections; s++)
          locations.push({ id: `R-${s}`, label: `R階 ${s}工区` });
        if (project.hasPH) {
          for (let s = 1; s <= project.sections; s++)
            locations.push({ id: `${s}-${s}`, label: `PH階 ${s}工区` });
        }
      }

      locations.forEach((loc) => {
        const row = [loc.label];
        tallyList.forEach((item) => {
          const count = project.tally?.[loc.id]?.[item.id] || null;
          row.push(count);
        });
        tallyData.push(row);
      });

      const tallySheet = XLSX.utils.aoa_to_sheet(tallyData);
      XLSX.utils.book_append_sheet(wb, tallySheet, "箇所数シート");

      const sortedSizes = Array.from(allBoltSizes).sort();
      const summaryHeaders = ["ボルトサイズ"];
      const summaryColumns = [];
      locations.forEach((loc) =>
        summaryColumns.push({ id: loc.id, label: loc.label }),
      );
      summaryHeaders.push(...summaryColumns.map((c) => c.label), "総合計");
      const summaryData = [summaryHeaders];

      sortedSizes.forEach((size) => {
        let grandTotal = 0;
        const row = [size];
        summaryColumns.forEach((col) => {
          const cellData = resultsByLocation[col.id]?.[size];
          const count = cellData ? cellData.total : 0;
          grandTotal += count;
          row.push(count > 0 ? count : null);
        });
        row.push(grandTotal);
        summaryData.push(row);
      });

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summarySheet, "ボルト集計シート");
      XLSX.writeFile(
        wb,
        `${project.name}_ボルト集計_${new Date()
          .toISOString()
          .slice(0, 10)}.xlsx`,
      );
      return; // 処理終了
    }

    // --- 3. 注文明細の表示切替 (#toggle-order-view-btn) ---
    if (e.target.closest("#toggle-order-view-btn")) {
      state.orderDetailsView =
        state.orderDetailsView === "location" ? "section" : "location";

      const { resultsByLocation } = calculateResults(project);
      const container = document.getElementById("order-details-container");
      if (container) {
        container.innerHTML = renderOrderDetails(project, resultsByLocation);
      } else {
        console.error("【エラー】 order-details-container が見つかりません！");
      }

      // 仮ボルト注文明細の再描画
      const tempContainer = document.getElementById(
        "temp-order-details-container",
      );
      if (tempContainer) {
        renderTempOrderDetails(tempContainer, project);
      }
      return;
    }

    // --- 4. 仮ボルト注文明細の表示切替 (#toggle-temp-order-view-btn) ---
    if (e.target.closest("#toggle-temp-order-view-btn")) {
      state.tempOrderDetailsView =
        state.tempOrderDetailsView === "location" ? "section" : "location";

      const tempContainer = document.getElementById(
        "temp-order-details-container",
      );
      if (tempContainer) {
        renderTempOrderDetails(tempContainer, project);
      }
      return;
    }

    // --- 5. 工区まとめ設定 (checkbox) ---
    if (e.target.matches("#temp-order-group-all-checkbox")) {
      state.tempOrderDetailsGroupAll = e.target.checked;
      const tempContainer = document.getElementById(
        "temp-order-details-container",
      );
      if (tempContainer) {
        renderTempOrderDetails(tempContainer, project);
      }
      return;
    }

    // --- 6. グループ化キー (radio) ---
    if (e.target.matches('input[name="temp-order-group-key"]')) {
      state.tempOrderDetailsGroupKey = e.target.value;
      const tempContainer = document.getElementById(
        "temp-order-details-container",
      );
      if (tempContainer) {
        renderTempOrderDetails(tempContainer, project);
      }
      return;
    }

    // --- 7. 詳細表示モーダル (td.has-details) ---
    // ここが2つ目のリスナーだった部分を合体させます
    const targetCell = e.target.closest("td.has-details");
    if (targetCell) {
      try {
        const detailsData = JSON.parse(targetCell.dataset.details);
        const row = targetCell.closest("tr");
        const boltSize = row.querySelector("td:first-child").textContent;
        // 最終列かどうかで合計かを判定
        const isTotal =
          targetCell.textContent ===
          row.querySelector("td:last-child").textContent;

        const modalTitle = document.getElementById("details-modal-title");
        const modalContent = document.getElementById("details-modal-content");
        const detailsModal = document.getElementById("details-modal");

        if (modalTitle && modalContent && detailsModal) {
          modalTitle.textContent = isTotal
            ? `${boltSize} の総合計内訳`
            : `${boltSize} の内訳`;

          let contentHtml = '<ul class="space-y-2 text-base">';
          const sortedJoints = Object.entries(detailsData).sort((a, b) =>
            a[0].localeCompare(b[0]),
          );

          for (const [name, count] of sortedJoints) {
            contentHtml += `
                    <li class="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-2">
                        <span class="text-slate-700 dark:text-slate-300">${name}:</span>
                        <span class="font-bold text-lg text-slate-900 dark:text-slate-100">${count.toLocaleString()}本</span>
                    </li>`;
          }
          contentHtml += "</ul>";

          modalContent.innerHTML = contentHtml;
          openModal(detailsModal);
        }
      } catch (err) {
        console.error("Failed to parse details data:", err);
      }
    }
  });
}

/**
 * その他のモーダル（詳細表示、グループ編集、集計結果）のイベント設定
 */
function setupOtherModalEvents() {
  // 1. 詳細表示モーダルを閉じるボタン
  const closeDetailsModalBtn = document.getElementById(
    "close-details-modal-btn",
  );
  const detailsModal = document.getElementById("details-modal");

  if (closeDetailsModalBtn) {
    closeDetailsModalBtn.addEventListener("click", () => {
      if (detailsModal) closeModal(detailsModal);
    });
  }

  // 2. グループ編集モーダルを閉じるボタン
  const closeEditGroupModalBtn = document.getElementById(
    "close-edit-group-modal-btn",
  );
  const cancelEditGroupBtn = document.getElementById("cancel-edit-group-btn");
  const editGroupModal = document.getElementById("edit-group-modal");

  if (closeEditGroupModalBtn) {
    closeEditGroupModalBtn.addEventListener("click", () => {
      if (editGroupModal) closeModal(editGroupModal);
    });
  }
  if (cancelEditGroupBtn) {
    cancelEditGroupBtn.addEventListener("click", () => {
      if (editGroupModal) closeModal(editGroupModal);
    });
  }

  // 3. 集計結果モーダルを閉じるボタン
  const closeAggregatedResultsBtn = document.getElementById(
    "close-aggregated-results-modal-btn",
  );
  const aggregatedResultsModal = document.getElementById(
    "aggregated-results-modal",
  );

  if (closeAggregatedResultsBtn) {
    closeAggregatedResultsBtn.addEventListener("click", () => {
      if (aggregatedResultsModal) closeModal(aggregatedResultsModal);
    });
  }
}
