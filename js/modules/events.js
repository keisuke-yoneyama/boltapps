import {
  closeModal,
  changeEditComplexSplCount,
  changeComplexSplCount,
  updateJointFormUI,
  selectColor,
  updateEditComplexSplCacheItem,
  selectStaticColor,
  // toggleFab,
  // closeFabIfOutside,
  updateProjectSelectionBar,
  openNewJointModal,
  openConfirmDeleteModal,
  openNewMemberModal,
  openTempBoltSettingsModal,
  populateGlobalBoltSelectorModal,
  openModal,
  openEditModal,
  openEditMemberModal,
  openBoltSelectorModal,
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
  populateJointDropdownForEdit,
  renderBulkMemberInputs,
  // toggleQuickNav,
  toggleTheme,
  makeDraggable,
  updateColumnLockUI,
  updateTallySheetCalculations,
  // closeQuickNavIfOutside,
  populateJointSelectorModal,
  openEditProjectModal,
  // openCopyProjectModal,
} from "./ui.js"; // ui.jsで作った関数を使う

import {
  resetTempJointData,
  state,
  resetProjectEditCache,
  resetProjectEditNewCache,
} from "./state.js";

import { updateProjectData, addProject, deleteProject } from "./db.js";

import { BOLT_TYPES } from "./config.js";

import {
  saveGlobalBoltSizes,
  updateProjectPropertyNameBatch,
} from "./firebase.js";

import {
  sortGlobalBoltSizes,
  cleanupAndSaveBoltSettings,
  getTallyList,
  calculateResults,
  calculateTempBoltResults,
  getProjectLevels,
} from "./calculator.js";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

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

  setupTallySheetInteractions(); // ★箇所数入力関連イベント

  setupBulkMemberActionEvents(); //部材の一括追加イベント

  // setupQuickNavEvents(); //クイックナビゲーション（FABメニュー等）のイベント設定

  setupDraggableModals(); //ドラッグ可能にするイベント

  setupTabNavigationEvents(); // タブ切り替えイベント

  setupThemeEvents(); // テーマイベント

  setupGroupActionEvents(); //工事グループ一括登録

  setupAggregatedResultsEvents(); //物件ごとの集計結果モーダル内のイベント設定

  setupBoltSelectorEvents(); //ボルトサイズ選択モーダル（汎用セレクター）のイベント設定

  setupJointSelectorEvents(); // 部材登録用：継手選択モーダルのイベント設定

  setupGlobalActionEvents(); //汎用アクション確認モーダル（実行・キャンセル）のイベント設定

  setupSearchFunctionality(); //検索機能イベント

  setupBulkDeleteEvents(); //一括削除イベント

  setupMasterFabEvents(); //大ボスボタンイベント

  setupProjectListNewEvents();

  setupExclusiveJointCategoryEvents(); // 同梱・地組み系チェックの排他制御

  setupTallyClipboardEvents();
}

function setupMasterFabEvents() {
  // =========================================================
  // マスターFAB (多段展開メニュー) の制御
  // =========================================================
  const masterFabToggle = document.getElementById("master-fab-toggle");
  const masterFabIcon = document.getElementById("master-fab-icon");
  const masterFabMenu = document.getElementById("master-fab-menu");

  const triggerNav = document.getElementById("trigger-nav");
  const subMenuNav = document.getElementById("sub-menu-nav");

  const triggerAdd = document.getElementById("trigger-add");
  const subMenuAdd = document.getElementById("sub-menu-add");

  const triggerQuickNav = document.getElementById("quick-nav-toggle");
  const subMenuQuickNav = document.getElementById("quick-nav-menu");

  // 開いている孫メニューをすべて閉じる
  const closeAllSubMenus = () => {
    [subMenuNav, subMenuAdd, subMenuQuickNav].forEach((menu) => {
      if (menu) {
        menu.classList.remove(
          "opacity-100",
          "translate-x-0",
          "pointer-events-auto",
        );
        menu.classList.add("opacity-0", "translate-x-4", "pointer-events-none");
      }
    });
  };

  // 大ボスボタンのクリック
  if (masterFabToggle) {
    masterFabToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = !masterFabMenu.classList.contains("opacity-0");
      if (isOpen) {
        // 閉じる
        masterFabMenu.classList.add(
          "opacity-0",
          "translate-y-10",
          "pointer-events-none",
        );
        masterFabMenu.classList.remove(
          "opacity-100",
          "translate-y-0",
          "pointer-events-auto",
        );
        masterFabIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7" />`;
        masterFabToggle.classList.remove("rotate-90");
        closeAllSubMenus();
      } else {
        // 開く
        masterFabMenu.classList.remove(
          "opacity-0",
          "translate-y-10",
          "pointer-events-none",
        );
        masterFabMenu.classList.add(
          "opacity-100",
          "translate-y-0",
          "pointer-events-auto",
        );
        masterFabIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />`;
        masterFabToggle.classList.add("rotate-90");
      }
    });
  }

  // カテゴリボタンのクリック (アコーディオン制御)
  const toggleSubMenu = (menu, e) => {
    e.stopPropagation();
    if (!menu) return;
    const isMenuOpen = menu.classList.contains("opacity-100");
    closeAllSubMenus(); // 他のカテゴリを閉じる
    if (!isMenuOpen) {
      menu.classList.remove(
        "opacity-0",
        "translate-x-4",
        "pointer-events-none",
      );
      menu.classList.add("opacity-100", "translate-x-0", "pointer-events-auto");
    }
  };

  if (triggerNav)
    triggerNav.addEventListener("click", (e) => toggleSubMenu(subMenuNav, e));
  if (triggerAdd)
    triggerAdd.addEventListener("click", (e) => toggleSubMenu(subMenuAdd, e));
  if (triggerQuickNav)
    triggerQuickNav.addEventListener("click", (e) => {
      toggleSubMenu(subMenuQuickNav, e);
      // メニューが開かれた直後にセクション一覧を更新する
      if (subMenuQuickNav && subMenuQuickNav.classList.contains("opacity-100")) {
        document.dispatchEvent(new CustomEvent("quickNavLinksUpdate"));
      }
    });

  // =========================================================
  // 画面移動の実行 (検索窓の自動クローズ付き)
  // =========================================================
  const fabNavListBtn = document.getElementById("fab-nav-list-btn");
  const fabNavTallyBtn = document.getElementById("fab-nav-tally-btn");
  const fabNavJointsBtn = document.getElementById("fab-nav-joints-btn");

  /**
   * 検索窓を閉じる共通の内部処理
   */
  const closeSearchWidget = () => {
    const searchWidget = document.getElementById("search-widget");
    if (searchWidget && searchWidget.classList.contains("open")) {
      searchWidget.classList.remove("open");
      // 必要に応じて入力をクリアしたい場合は、以下のコメントを外してください
      // const searchInput = document.getElementById("search-input");
      // if (searchInput) searchInput.value = "";
    }
  };

  // 物件一覧に戻る
  if (fabNavListBtn) {
    fabNavListBtn.addEventListener("click", () => {
      closeSearchWidget(); // 検索窓を閉じる
      if (masterFabToggle && !masterFabMenu.classList.contains("opacity-0")) {
        masterFabToggle.click(); // メニューを閉じる
      }
      switchView("project-list");
    });
  }

  // 入力と集計へ移動
  if (fabNavTallyBtn) {
    fabNavTallyBtn.addEventListener("click", () => {
      closeSearchWidget(); // 検索窓を閉じる
      if (masterFabToggle && !masterFabMenu.classList.contains("opacity-0")) {
        masterFabToggle.click(); // メニューを閉じる
      }
      switchTab("tally");
    });
  }

  // 継手と部材へ移動
  if (fabNavJointsBtn) {
    fabNavJointsBtn.addEventListener("click", () => {
      closeSearchWidget(); // 検索窓を閉じる
      if (masterFabToggle && !masterFabMenu.classList.contains("opacity-0")) {
        masterFabToggle.click(); // メニューを閉じる
      }
      switchTab("joints");
    });
  }

  // 追加系などのアクションボタンを押した時もメニューを閉じる
  document.querySelectorAll(".fab-action-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (masterFabToggle && !masterFabMenu.classList.contains("opacity-0")) {
        masterFabToggle.click();
      }
    });
  });
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

  // // 2. 画面の他の場所をクリックしたら閉じる
  // document.addEventListener("click", (e) => {
  //   closeFabIfOutside(e.target);
  // });

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
  if (closeBoltModalBtn) {
    closeBoltModalBtn.addEventListener("click", () =>
      closeModal(document.getElementById("bolt-selector-modal")),
    );
  }
}
//カスタムアラートモーダル終了ボタンイベント
function setupCloseCustomAlertModalBtnEvents() {
  const closeAlertBtn = document.getElementById("close-alert-btn");
  if (closeAlertBtn) {
    closeAlertBtn.addEventListener("click", () =>
      closeModal(document.getElementById("custom-alert-modal")),
    );
  }
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

/**
 * 「本柱と同梱」「工場地組み用」「地組み用」を排他制御する
 * どれか1つが ON になったら残り2つを disabled にする
 */
function setupExclusiveJointCategoryEvents() {
  // [新規フォーム用ID群, 編集モーダル用ID群] のペア
  const groups = [
    ["is-bundled-with-column", "is-shop-ground-assembly", "is-ground-assembly"],
    ["edit-is-bundled-with-column", "edit-is-shop-ground-assembly", "edit-is-ground-assembly"],
  ];

  groups.forEach((ids) => {
    const inputs = ids.map((id) => document.getElementById(id)).filter(Boolean);
    if (inputs.length === 0) return;

    const syncDisabled = () => {
      const anyChecked = inputs.some((el) => el.checked);
      inputs.forEach((el) => {
        el.disabled = anyChecked && !el.checked;
      });
    };

    inputs.forEach((el) => el.addEventListener("change", syncDisabled));
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

// プロジェクト編集モーダルの途中終了時の動作登録
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
          if (typeof resetProjectEditCache === "function") {
            resetProjectEditCache();
          }

          // ▼▼▼ 追加: 次回開く時のために、DOM（入力欄）も強制的にクリアして残骸を消す ▼▼▼
          const levelsContainer = document.getElementById(
            "edit-custom-levels-container",
          );
          const areasContainer = document.getElementById(
            "edit-custom-areas-container",
          );
          if (levelsContainer) levelsContainer.innerHTML = "";
          if (areasContainer) areasContainer.innerHTML = "";
          // ▲▲▲ 追加ここまで ▲▲▲
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

        // 2. モーダルの中身（ボタン一覧）を生成（現在値をハイライト）
        populateGlobalBoltSelectorModal(e.target.value || "");

        // 3. モーダルを表示
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

  // パレット折りたたみトグル (編集モーダル用)
  const colorPaletteToggle = document.getElementById("color-palette-toggle");
  const colorPaletteArea = document.getElementById("color-palette-area");
  const colorPaletteChevron = document.getElementById("color-palette-chevron");
  if (colorPaletteToggle && colorPaletteArea) {
    colorPaletteToggle.addEventListener("click", () => {
      const isHidden = colorPaletteArea.classList.toggle("hidden");
      if (colorPaletteChevron) colorPaletteChevron.classList.toggle("rotate-180", !isHidden);
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
  const newBoltTypeSelect = document.getElementById("new-bolt-type-select");
  const addBoltSizeBtn = document.getElementById("add-bolt-size-btn");
  const newBoltLengthInput = document.getElementById("new-bolt-length-input");
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
    console.log("✅ 追加ボタンクリック。");
    addBoltSizeBtn.addEventListener("click", async () => {
      // DOM要素がない場合は何もしない
      if (!newBoltTypeSelect || !newBoltLengthInput) return;

      const type = newBoltTypeSelect.value;
      const inputValue = newBoltLengthInput.value.trim(); // 前後の空白を除去

      // ▼▼▼ 修正: 入力チェックを強化 ▼▼▼

      // 1. 空欄チェック
      if (inputValue === "") {
        showToast("長さを入力してください。");
        newBoltLengthInput.focus(); // 入力欄にカーソルを戻す
        return; // ここで処理を止める
      }

      const length = parseInt(inputValue, 10);

      // 2. 数値チェック (数字でない、または0以下の場合)
      if (isNaN(length) || length <= 0) {
        showToast("長さは「正の整数」で入力してください。");
        newBoltLengthInput.focus();
        return; // ここで処理を止める
      }

      // ▲▲▲ 修正ここまで ▲▲▲

      const newId = `${type}×${length}`;

      // 重複チェック
      if (state.globalBoltSizes.some((b) => b.id === newId)) {
        showToast("このサイズは既に登録されています");
        newBoltLengthInput.focus();
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
      // DB保存
      try {
        await saveGlobalBoltSizes(state.globalBoltSizes);
        showToast(`サイズ「${newId}」を追加しました。`); // 成功メッセージも出すと親切
      } catch (e) {
        showToast("保存に失敗しました。");
        console.error(e);
      }

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
          // 追加された項目を一瞬光らせるなどの演出を入れても良い
          newItem.classList.add("bg-yellow-100", "dark:bg-yellow-900");
          setTimeout(
            () =>
              newItem.classList.remove("bg-yellow-100", "dark:bg-yellow-900"),
            1000,
          );
        }
      }, 100);
    });
  } else {
    console.error("✅ 追加ボタンidが無効。");
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

      // stateキャッシュのリセット
      resetProjectEditNewCache();

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
        // ▼▼▼ 追加：一括操作バーのリセット ▼▼▼
        document
          .querySelectorAll(".project-checkbox")
          .forEach((cb) => (cb.checked = false));
        if (typeof updateProjectSelectionBar === "function") {
          updateProjectSelectionBar(); // ui.js の共通関数
        }
        // ▲▲▲ 追加ここまで ▲▲▲
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
        resetProjectEditCache();

        showToast(`工事情報を更新しました。`);

        // ▼▼▼ 追加：一括操作バーのリセット ▼▼▼
        document
          .querySelectorAll(".project-checkbox")
          .forEach((cb) => (cb.checked = false));
        if (typeof updateProjectSelectionBar === "function") {
          updateProjectSelectionBar(); // ui.js の共通関数
        }
        // ▲▲▲ 追加ここまで ▲▲▲
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

        // --- 階層名変更の検出（インデックスベース、tallyと同方式）---
        const levelRenameMap = new Map(); // 旧名 → 新名
        const minLevelLen = Math.min(oldLevels.length, newLevels.length);
        for (let i = 0; i < minLevelLen; i++) {
          if (oldLevels[i] !== newLevels[i]) {
            levelRenameMap.set(oldLevels[i], newLevels[i]);
          }
        }
        // 削除された階層（旧側にあって新側のインデックスが存在しないもの）
        const deletedLevels = oldLevels.slice(newLevels.length);

        // 削除階層を使用している部材の確認（使用中のみ警告）
        const projectMembers = project.members || [];
        const membersUsingDeletedLevels =
          deletedLevels.length > 0
            ? projectMembers.filter(
                (m) =>
                  m.targetLevels &&
                  m.targetLevels.length > 0 &&
                  m.targetLevels.some((l) => deletedLevels.includes(l)),
              )
            : [];

        if (membersUsingDeletedLevels.length > 0) {
          const ok = confirm(
            `削除される階層（${deletedLevels.map(esc).join("、")}）を使用している部材が ${membersUsingDeletedLevels.length} 件あります。\n削除すると、それらの部材の階層バッジが消えます。\nよろしいですか？`,
          );
          if (!ok) return;
        }

        // 既存部材の targetLevels を更新（完全一致で名前変更 / 削除を反映）
        if (levelRenameMap.size > 0 || deletedLevels.length > 0) {
          let updatedMemberCount = 0;
          const updatedMembers = projectMembers.map((member) => {
            if (!member.targetLevels || member.targetLevels.length === 0) {
              return member; // 全階層対象のメンバーは変更不要
            }
            const newTargetLevels = member.targetLevels
              .map((l) => (levelRenameMap.has(l) ? levelRenameMap.get(l) : l))
              .filter((l) => !deletedLevels.includes(l));
            const changed =
              newTargetLevels.length !== member.targetLevels.length ||
              newTargetLevels.some((l, i) => l !== member.targetLevels[i]);
            if (!changed) return member;
            updatedMemberCount++;
            return { ...member, targetLevels: newTargetLevels };
          });
          updatedProjectData.members = updatedMembers;
          console.log(
            `[階層名更新] リネーム: ${levelRenameMap.size}件, 削除: ${deletedLevels.length}件, 部材更新: ${updatedMemberCount}件`,
          );
        }

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
          confirmActionMessage.innerHTML = `階層またはエリアの数を減らしたため、以下の項目に関連する箇所数データが削除されます。よろしいですか？<br><br><strong class="text-red-600">${removedItems.map(esc).join("、")}</strong>`;

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
      if (!deleteIdInput || !deleteTypeInput || !confirmDeleteModal) return;

      const id = deleteIdInput.value;
      const type = deleteTypeInput.value;
      const projectId = state.currentProjectId;
      const projectIndex = state.projects.findIndex((p) => p.id === projectId);

      // ▼ パターン1：プロジェクト自体の削除
      if (type === "project") {
        deleteProject(id)
          .then(() => {
            // 削除成功後、一覧に戻る際に確実にバーを隠すための処理
            document
              .querySelectorAll(".project-checkbox")
              .forEach((cb) => (cb.checked = false));
            // ui.js から import した関数を呼ぶ
            updateProjectSelectionBar();
            showToast("工事を削除しました");
          })
          .catch((err) => {
            console.error(err);
            showCustomAlert("工事の削除に失敗しました。");
          });
        closeModal(confirmDeleteModal);
        return;
      }

      if (projectIndex === -1) return;

      // ▼▼▼ パターン3：一括削除 (新規追加) ▼▼▼
      if (type === "bulk") {
        let joints = [...state.projects[projectIndex].joints];
        let members = [...(state.projects[projectIndex].members || [])];
        let deleteCount = 0;

        state.bulkDeleteTargets.forEach((target) => {
          if (target.type === "joint") {
            joints = joints.filter((j) => j.id !== target.id);
            deleteCount++;
          } else if (target.type === "member") {
            members = members.filter((m) => m.id !== target.id);
            deleteCount++;
          }
        });

        state.projects[projectIndex].joints = joints;
        state.projects[projectIndex].members = members;

        showToast(`${deleteCount} 件のデータを一括削除しました。`);
        renderDetailView();

        // 削除完了後にフローティングバー全体を隠す
        const bulkDeleteBar = document.getElementById("bulk-delete-bar");
        if (bulkDeleteBar) {
          bulkDeleteBar.classList.add(
            "translate-y-24",
            "opacity-0",
            "pointer-events-none",
          );
        }

        closeModal(confirmDeleteModal);

        updateProjectData(projectId, { joints, members }).catch((err) => {
          showCustomAlert(
            "削除に失敗しました。ページをリロードして確認してください。",
          );
          console.error("一括削除に失敗:", err);
        });

        state.bulkDeleteTargets = null;
        return;
      }
      // ▲▲▲ パターン3 ここまで ▲▲▲

      // ▼ パターン2：継手・部材の単独削除 (元の処理)
      let updateData = {};
      let deletedItemName = "";

      if (type === "joint") {
        const joint = state.projects[projectIndex].joints.find(
          (j) => j.id === id,
        );
        if (joint) deletedItemName = joint.name;
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
        const updatedMembers = (
          state.projects[projectIndex].members || []
        ).filter((m) => m.id !== id);
        state.projects[projectIndex].members = updatedMembers;
        updateData = { members: updatedMembers };
        showToast(`部材「${deletedItemName}」を削除しました。`);
      }

      renderDetailView();
      closeModal(confirmDeleteModal);

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
  const editIsShopGroundAssemblyInput = document.getElementById("edit-is-shop-ground-assembly");
  const editIsGroundAssemblyInput = document.getElementById("edit-is-ground-assembly");

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
        isShopGroundAssembly:
          ["girder", "beam", "stud", "other"].includes(type) &&
          editIsShopGroundAssemblyInput?.checked || false,
        isGroundAssembly:
          ["girder", "beam", "stud", "other"].includes(type) &&
          editIsGroundAssemblyInput?.checked || false,
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
            .map((m) => `・${esc(m.name)}`)
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
  const isShopGroundAssemblyInput = document.getElementById("is-shop-ground-assembly");
  const isGroundAssemblyInput = document.getElementById("is-ground-assembly");

  const flangeSizeInput = document.getElementById("flange-size");
  const flangeCountInput = document.getElementById("flange-count");
  const webSizeInput = document.getElementById("web-size");
  const webCountInput = document.getElementById("web-count");
  const complexSplCountInput = document.getElementById("complex-spl-count");

  const jointColorToggle = document.getElementById("joint-color-toggle");
  const jointColorInput = document.getElementById("joint-color-input");

  const confirmAddModal = document.getElementById("confirm-add-modal");
  const confirmAddMessage = document.getElementById("confirm-add-message");
  const confirmAddBtn = document.getElementById("confirm-add-btn"); // 追加：確認モーダルの「はい」ボタン

  // --- 部材追加フォームの要素 ---
  const addMemberBtn = document.getElementById("add-member-btn");
  const memberNameInput = document.getElementById("member-name");
  const memberJointSelectId = document.getElementById("member-joint-select-id"); // ID要確認
  const memberJointSelectInput = document.getElementById(
    "member-joint-select-input",
  ); // 表示用inputがある場合

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
        isShopGroundAssembly:
          ["girder", "beam", "stud", "other"].includes(type) &&
          isShopGroundAssemblyInput?.checked || false,
        isGroundAssembly:
          ["girder", "beam", "stud", "other"].includes(type) &&
          isGroundAssemblyInput?.checked || false,
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

  // 内部関数: 継手追加とトースト表示 (再利用する共通ロジック)
  const addJointAndShowToast = (jointData) => {
    // 1. State更新
    const projectIndex = state.projects.findIndex(
      (p) => p.id === state.currentProjectId,
    );
    if (projectIndex === -1) return;
    const updatedJoints = [...state.projects[projectIndex].joints, jointData];
    state.projects[projectIndex].joints = updatedJoints;

    // 2. UI再描画
    renderDetailView();

    // 3. 通知 & リセット
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

    // ui.jsのresetJointFormを呼ぶ
    if (typeof resetJointForm === "function") resetJointForm();
    if (jointNameInput) jointNameInput.focus();

    // 4. DB保存
    updateProjectData(state.currentProjectId, {
      joints: updatedJoints,
    }).catch((err) => {
      showCustomAlert(
        "継手の追加に失敗しました。ページをリロードしてデータを確認してください。",
      );
      console.error("継手の追加に失敗: ", err);
    });
  };

  // ▼▼▼ 【ここに追加・統合】確認モーダルの登録ボタン ▼▼▼
  if (confirmAddBtn) {
    confirmAddBtn.addEventListener("click", () => {
      // 一時保存されたデータがあれば、共通処理を呼び出す
      if (state.tempJointData) {
        addJointAndShowToast(state.tempJointData);

        // 後処理
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
          invalidElements: [memberJointSelectInput], // ID確認
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
      // const jointSelect = memberJointSelectId;
      // const jointName = jointSelect.options[jointSelect.selectedIndex].text;
      const jointName = memberJointSelectInput.value;
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
        renderOrderDetails(container, project, resultsByLocation);
      } else {
        console.error("【エラー】 order-details-container が見つかりません！");
      }

      // 仮ボルト注文明細の再描画
      const tempContainer = document.getElementById(
        "temp-order-details-container",
      );
      if (tempContainer) {
        const { resultsByLocation: tempResultsByLocation } = calculateTempBoltResults(project);
        renderTempOrderDetails(tempContainer, project, tempResultsByLocation);
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
        const { resultsByLocation: tempResultsByLocation } = calculateTempBoltResults(project);
        renderTempOrderDetails(tempContainer, project, tempResultsByLocation);
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
        const { resultsByLocation: tempResultsByLocation } = calculateTempBoltResults(project);
        renderTempOrderDetails(tempContainer, project, tempResultsByLocation);
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
        const { resultsByLocation: tempResultsByLocation } = calculateTempBoltResults(project);
        renderTempOrderDetails(tempContainer, project, tempResultsByLocation);
      }
      return;
    }

    // --- 7. 詳細表示モーダル (td.has-details) ---
    // ここが2つ目のリスナーだった部分を合体させます
    const targetCell = e.target.closest("td.has-details");
    if (targetCell) {
      try {
        const detailsData = JSON.parse(targetCell.dataset.details);
        const qtyData = targetCell.dataset.qty ? JSON.parse(targetCell.dataset.qty) : null;
        const row = targetCell.closest("tr");
        const boltSize = targetCell.dataset.boltSize || row.querySelector("td:first-child").textContent;
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

          const sortedJoints = Object.entries(detailsData).sort((a, b) =>
            a[0].localeCompare(b[0]),
          );
          const totalCount = sortedJoints.reduce((s, [, v]) => s + v, 0);
          const memberCount = sortedJoints.length;

          let contentHtml = `<p class="text-sm text-slate-500 dark:text-slate-400 mb-3">${memberCount}部材 / 合計 <span class="font-bold text-slate-900 dark:text-slate-100">${totalCount.toLocaleString()}本</span></p>`;
          contentHtml += '<ul class="space-y-2 text-base">';

          for (const [name, count] of sortedJoints) {
            const qty = qtyData?.[name];
            const qtyHtml = qty != null
              ? `<span class="text-sm text-slate-500 dark:text-slate-400 ml-1">(${qty}箇所)</span>`
              : "";
            contentHtml += `
                    <li class="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-2">
                        <span class="text-slate-700 dark:text-slate-300">${name}${qtyHtml}:</span>
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

/**
 * 箇所数入力シートのExcel風操作（ハイライト、キー移動、D&D）設定
 */
function setupTallySheetInteractions() {
  const tallySheetContainer = document.getElementById("tally-sheet-container");

  if (tallySheetContainer) {
    let isEditing = false;
    let dragSourceElement = null; // ドラッグ元の要素を保持

    // ヘルパー関数: ハイライトの解除
    const clearHighlights = () => {
      tallySheetContainer
        .querySelectorAll(".cell-highlight, .cell-selected")
        .forEach((el) => {
          el.classList.remove("cell-highlight", "cell-selected");
        });
    };

    // ヘルパー関数: ハイライトの適用
    const applyHighlightAndSelect = (targetInputElement) => {
      clearHighlights();
      if (!targetInputElement) return;
      const cell = targetInputElement.closest("td");
      if (!cell) return;
      const colIndex = cell.cellIndex;
      const row = cell.parentElement;
      const table = targetInputElement.closest("table");

      // 1. 行全体と、特に1列目のセルをハイライト
      if (row) {
        row.classList.add("cell-highlight");
        if (row.cells[0]) {
          row.cells[0].classList.add("cell-highlight");
        }
        // 一番右側のセル（行合計）もハイライト
        const lastCellIndex = row.cells.length - 1;
        if (row.cells[lastCellIndex]) {
          row.cells[lastCellIndex].classList.add("cell-highlight");
        }
      }

      // 2. 列全体（ヘッダー3行を含む）をハイライト
      if (table && colIndex > 0) {
        const thead = table.querySelector("thead");
        if (thead) {
          if (thead.rows[0] && thead.rows[0].cells[colIndex]) {
            thead.rows[0].cells[colIndex].classList.add("cell-highlight");
          }
          if (thead.rows[1] && thead.rows[1].cells[colIndex - 1]) {
            thead.rows[1].cells[colIndex - 1].classList.add("cell-highlight");
          }
          if (thead.rows[2] && thead.rows[2].cells[colIndex - 1]) {
            thead.rows[2].cells[colIndex - 1].classList.add("cell-highlight");
          }
        }

        table.querySelectorAll("tbody tr, tfoot tr").forEach((tableRow) => {
          if (tableRow.cells[colIndex]) {
            tableRow.cells[colIndex].classList.add("cell-highlight");
          }
        });
      }

      cell.classList.add("cell-selected");
    };

    // --- イベントリスナー ---

    // ダブルクリックで全選択
    tallySheetContainer.addEventListener("dblclick", (e) => {
      if (e.target.classList.contains("tally-input")) {
        isEditing = true;
        e.target.setSelectionRange(
          e.target.value.length,
          e.target.value.length,
        );
      }
    });

    // フォーカス時ハイライト
    tallySheetContainer.addEventListener("focusin", (e) => {
      if (e.target.classList.contains("tally-input")) {
        applyHighlightAndSelect(e.target);
        e.target.select();
        isEditing = false;
      }
    });

    // フォーカスアウト時ハイライト解除
    tallySheetContainer.addEventListener("focusout", (e) => {
      setTimeout(() => {
        if (!tallySheetContainer.contains(document.activeElement)) {
          clearHighlights();
        }
      }, 0);
    });

    // 入力制御（全角数字変換、記号削除）
    tallySheetContainer.addEventListener("input", (e) => {
      if (e.target.classList.contains("tally-input")) {
        const target = e.target;
        let val = target.value;

        val = val.replace(/[０-９]/g, (s) =>
          String.fromCharCode(s.charCodeAt(0) - 0xfee0),
        );

        const newVal = val.replace(/[^0-9]/g, "");

        if (val !== newVal) {
          target.value = newVal;
        }
      }
    });

    // --- ドラッグ＆ドロップ ---
    tallySheetContainer.addEventListener("dragstart", (e) => {
      if (e.target.classList.contains("tally-input") && !e.target.disabled) {
        dragSourceElement = e.target;
        e.dataTransfer.effectAllowed = "move";
        // ドラッグ中の見た目を少し変える
        e.target.classList.add("opacity-50");
      }
    });

    tallySheetContainer.addEventListener("dragover", (e) => {
      if (e.target.classList.contains("tally-input") && !e.target.disabled) {
        e.preventDefault(); // ドロップを許可
        e.target.classList.add("bg-yellow-100", "dark:bg-yellow-900/30");
      }
    });

    tallySheetContainer.addEventListener("dragleave", (e) => {
      if (e.target.classList.contains("tally-input")) {
        e.target.classList.remove("bg-yellow-100", "dark:bg-yellow-900/30");
      }
    });

    tallySheetContainer.addEventListener("dragend", (e) => {
      if (e.target.classList.contains("tally-input")) {
        e.target.classList.remove("opacity-50");
      }
      // ここで null にしても、drop 内のローカル変数が値を保持するので安全になります
      dragSourceElement = null;
    });

    tallySheetContainer.addEventListener("drop", (e) => {
      e.preventDefault();
      const dropTarget = e.target;

      // ★修正のポイント: 現在のドラッグ元をローカル変数に固定（キャプチャ）する
      const dragSource = dragSourceElement;

      if (dropTarget.classList.contains("tally-input")) {
        dropTarget.classList.remove("bg-yellow-100", "dark:bg-yellow-900/30");
      }

      if (
        !dragSource ||
        !dropTarget ||
        !dropTarget.classList.contains("tally-input") ||
        dropTarget === dragSource ||
        dropTarget.disabled
      ) {
        return;
      }

      const sourceValue = dragSource.value || "(空)";
      const targetValue = dropTarget.value || "(空)";

      // モーダルの準備
      const confirmActionTitle = document.getElementById(
        "confirm-action-title",
      );
      const confirmActionMessage = document.getElementById(
        "confirm-action-message",
      );
      const confirmActionModal = document.getElementById(
        "confirm-action-modal",
      );

      if (confirmActionTitle) confirmActionTitle.textContent = "数値の移動確認";
      if (confirmActionMessage) {
        confirmActionMessage.innerHTML = `セルからセルへ数値を移動しますか？<br><br>
             移動元: <strong class="text-blue-600">${esc(sourceValue)}</strong><br>
             移動先: <strong class="text-red-600">${esc(targetValue)}</strong> (上書きされます)`;
      }

      // ★修正のポイント: dragSource と dropTarget という「変数名」をクロージャで使用
      state.pendingAction = () => {
        if (dragSource && dropTarget) {
          dropTarget.value = dragSource.value;
          dragSource.value = "";

          // 値の変更をシステムに通知
          dragSource.dispatchEvent(new Event("change", { bubbles: true }));
          dropTarget.dispatchEvent(new Event("change", { bubbles: true }));

          showToast("数値を移動しました");
        }
      };

      if (confirmActionModal) openModal(confirmActionModal);
    });

    // --- キーボード操作（十字キー移動、IME制御） ---
    tallySheetContainer.addEventListener("keydown", (e) => {
      if (!e.target.classList.contains("tally-input")) return;

      const key = e.key;
      const code = e.code;
      const target = e.target;
      const isComposing = e.isComposing;

      // 1. スペースキーで値をクリア
      if (code === "Space" || key === " " || key === "Spacebar") {
        e.preventDefault();
        e.stopPropagation();
        target.blur(); // IME強制終了
        target.value = "";
        isEditing = true;
        target.dispatchEvent(new Event("input", { bubbles: true }));
        target.dispatchEvent(new Event("change", { bubbles: true }));

        setTimeout(() => {
          target.focus();
        }, 0);
        return;
      }

      // 2. 十字キーとEnterキーの移動ロジック
      const moveKeys = [
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Enter",
      ];
      if (moveKeys.includes(key)) {
        if (isComposing && (key === "ArrowLeft" || key === "ArrowRight")) {
          return;
        }
        if (isComposing && key === "Enter") {
          return;
        }

        e.preventDefault();
        target.blur(); // 確定

        const table = target.closest("table");
        const tbody = table.querySelector("tbody");
        if (!tbody) return;

        const rows = Array.from(tbody.querySelectorAll("tr"));
        const currentRow = target.closest("tr");
        const currentIndex = rows.indexOf(currentRow);
        const currentCell = target.closest("td");
        const currentCellIndex = currentCell.cellIndex;

        let nextInput = null;

        if (key === "ArrowUp") {
          for (let i = currentIndex - 1; i >= 0; i--) {
            const input = rows[i].cells[currentCellIndex]?.querySelector(
              ".tally-input:not([disabled])",
            );
            if (input) {
              nextInput = input;
              break;
            }
          }
        } else if (key === "ArrowDown" || key === "Enter") {
          for (let i = currentIndex + 1; i < rows.length; i++) {
            const input = rows[i].cells[currentCellIndex]?.querySelector(
              ".tally-input:not([disabled])",
            );
            if (input) {
              nextInput = input;
              break;
            }
          }
        } else if (key === "ArrowLeft") {
          for (let i = currentCellIndex - 1; i >= 0; i--) {
            const input = currentRow.cells[i]?.querySelector(
              ".tally-input:not([disabled])",
            );
            if (input) {
              nextInput = input;
              break;
            }
          }
        } else if (key === "ArrowRight") {
          for (let i = currentCellIndex + 1; i < currentRow.cells.length; i++) {
            const input = currentRow.cells[i]?.querySelector(
              ".tally-input:not([disabled])",
            );
            if (input) {
              nextInput = input;
              break;
            }
          }
        }

        setTimeout(() => {
          if (nextInput) {
            nextInput.focus();
            nextInput.select();
          } else {
            // 行き止まりの場合
            target.focus();
            target.select();
            target.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }, 0);

        return;
      }

      // 3. Escapeキー
      if (key === "Escape") {
        e.preventDefault();
        isEditing = false;
        target.blur();
        return;
      }

      // 4. 入力開始
      const isCharacterKey =
        !e.ctrlKey && !e.altKey && !e.metaKey && key.length === 1;
      if (isCharacterKey) {
        isEditing = true;
      }
    });

    // ▼▼▼ 【ここに追加】変更検知 (ロック切り替え & 値入力確定) ▼▼▼
    tallySheetContainer.addEventListener("change", (e) => {
      // 1. ロック用チェックボックスが変更された時の処理
      if (e.target.classList.contains("tally-lock-checkbox")) {
        const project = state.projects.find(
          (p) => p.id === state.currentProjectId,
        );
        if (!project) return;

        const itemId = e.target.dataset.id;
        const isLocked = e.target.checked;

        // ブラウザ内のデータを即座に更新
        if (!project.tallyLocks) project.tallyLocks = {};
        project.tallyLocks[itemId] = isLocked;

        // UI反映 (ui.jsの関数)
        if (typeof updateColumnLockUI === "function") {
          updateColumnLockUI(itemId, isLocked);
        }

        const fieldPath = `tallyLocks.${itemId}`;

        updateProjectData(state.currentProjectId, {
          [fieldPath]: isLocked,
        }).catch((err) => {
          console.error("ロック状態の保存に失敗しました: ", err);
          showCustomAlert("ロック状態の保存に失敗しました。");
          // 失敗時は戻す
          e.target.checked = !isLocked;
          project.tallyLocks[itemId] = !isLocked;
          if (typeof updateColumnLockUI === "function") {
            updateColumnLockUI(itemId, !isLocked);
          }
        });
      }

      // 2. 箇所数入力のセルが変更された時の処理
      if (e.target.classList.contains("tally-input")) {
        const project = state.projects.find(
          (p) => p.id === state.currentProjectId,
        );
        if (!project) return;

        const { location, id } = e.target.dataset;
        // Firestoreのネストされたフィールド更新用のパス
        const fieldPath = `tally.${location}.${id}`;

        // 値をより厳密に取得・整形
        let valueStr = e.target.value.trim();
        // 全角数字を半角に
        valueStr = valueStr.replace(/[０-９]/g, (s) =>
          String.fromCharCode(s.charCodeAt(0) - 0xfee0),
        );

        const quantity = parseInt(valueStr, 10);

        // A. ブラウザ内のデータ(state)を即座に更新
        if (!project.tally) project.tally = {};
        if (!project.tally[location]) project.tally[location] = {};

        if (valueStr === "" || isNaN(quantity)) {
          delete project.tally[location][id];
          e.target.value = ""; // 見た目もクリア
        } else {
          project.tally[location][id] = quantity;
          e.target.value = quantity; // 整形した数値を戻す
        }

        // B. 箇所数入力の表の合計値を更新 (ui.js)
        if (typeof updateTallySheetCalculations === "function") {
          updateTallySheetCalculations(project);
        }

        // C. 全ての集計結果の表を再計算・再描画 (ui.js)
        if (typeof renderResults === "function") {
          renderResults(project);
        }

        // D. 裏側でデータベースに保存
        // 空白または非数の場合は削除(null)として保存する場合と、DeleteFieldを使う場合がありますが、
        // ここではnull保存またはmap更新のロジックに従います
        const valueToSave =
          valueStr === "" || isNaN(quantity) ? null : quantity;

        // updateProjectData は updateDoc を呼んでいるので、
        // `tally.locationId.itemId`: value という形式で部分更新が可能
        updateProjectData(state.currentProjectId, {
          [fieldPath]: valueToSave,
        }).catch((err) => {
          showCustomAlert(`集計結果の保存に失敗`);
          console.error("Error updating tally: ", err);
        });
      }
    });
  }
}

/**
 * 部材一括追加機能のイベント設定
 */
function setupBulkMemberActionEvents() {
  // FABボタン (一括追加起動)
  const fabBulkAddMember = document.getElementById("fab-bulk-add-member"); // ID確認
  const bulkAddMemberModal = document.getElementById("bulk-add-member-modal");
  const bulkMemberJointSelect = document.getElementById(
    "bulk-member-joint-select",
  );

  // モーダル内要素
  const bulkMemberInputsContainer = document.getElementById(
    "bulk-member-inputs-container",
  );
  const addBulkInputBtn = document.getElementById("add-bulk-input-btn");
  const saveBulkMemberBtn = document.getElementById("save-bulk-member-btn");
  const closeBulkAddMemberModalBtn = document.getElementById(
    "close-bulk-add-member-modal-btn",
  );
  const cancelBulkAddMemberBtn = document.getElementById(
    "cancel-bulk-add-member-btn",
  );

  // 階層選択モーダル関連
  const bulkLevelSelectorModal = document.getElementById(
    "bulk-level-selector-modal",
  );
  const bulkLevelOptionsContainer = document.getElementById(
    "bulk-level-options-container",
  );
  const saveBulkLevelBtn = document.getElementById("save-bulk-level-btn");
  const closeBulkLevelModalBtn = document.getElementById(
    "close-bulk-level-modal-btn",
  );

  // 1. FABボタンクリック：モーダルを開く
  if (fabBulkAddMember) {
    fabBulkAddMember.addEventListener("click", () => {
      // toggleFab(false); // UI操作なのでevents.js内で直接やるか、ui.jsの関数を呼ぶ
      const fabMenu = document.getElementById("fab-menu");
      const fabToggleIcon = document.getElementById("fab-toggle-icon");
      if (fabMenu) fabMenu.classList.add("hidden", "opacity-0", "scale-95");
      if (fabToggleIcon) fabToggleIcon.classList.remove("rotate-45");

      const project = state.projects.find(
        (p) => p.id === state.currentProjectId,
      );

      // 継手が一つも登録されていない場合は警告
      if (!project || project.joints.length === 0) {
        return showCustomAlert("先に継手情報を登録してください。");
      }

      // 継手セレクトボックスの準備
      if (typeof populateJointDropdownForEdit === "function") {
        populateJointDropdownForEdit(bulkMemberJointSelect, "");
      }

      // 継手選択をリセット
      if (project.joints.length > 0) {
        bulkMemberJointSelect.value = project.joints[0].id;
      } else {
        bulkMemberJointSelect.value = "";
      }

      // 階層設定リセット
      state.bulkMemberLevels = [];

      // 入力欄初期化
      if (typeof renderBulkMemberInputs === "function") {
        renderBulkMemberInputs(5);
      }

      openModal(bulkAddMemberModal);
    });
  }

  // 2. 入力欄追加ボタン
  if (addBulkInputBtn) {
    addBulkInputBtn.addEventListener("click", () => {
      const currentCount = bulkMemberInputsContainer.children.length;
      if (currentCount >= 15) {
        showToast("一度に登録できるのは最大15件までです。");
        return;
      }

      const currentValues = Array.from(
        document.querySelectorAll(".bulk-member-name-input"),
      ).map((input) => input.value);

      renderBulkMemberInputs(currentCount + 1);

      const newInputs = document.querySelectorAll(".bulk-member-name-input");
      currentValues.forEach((val, index) => {
        if (newInputs[index]) newInputs[index].value = val;
      });
    });
  }

  // 3. 階層選択モーダル制御 (Event Delegation)
  if (bulkMemberInputsContainer) {
    bulkMemberInputsContainer.addEventListener("click", (e) => {
      const button = e.target.closest(".open-bulk-level-selector");
      if (button) {
        const project = state.projects.find(
          (p) => p.id === state.currentProjectId,
        );
        if (!project) return;

        state.activeBulkMemberIndex = parseInt(button.dataset.index, 10);
        const currentSelection =
          state.bulkMemberLevels[state.activeBulkMemberIndex] || [];

        // getProjectLevels が使える前提
        const levels =
          typeof getProjectLevels === "function"
            ? getProjectLevels(project)
            : [];

        bulkLevelOptionsContainer.innerHTML = "";

        // 全階層チェックボックス
        const allLevelLabel = document.createElement("label");
        allLevelLabel.className =
          "flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200 cursor-pointer border-b pb-2";
        // 初回起動時はチェックなし。再開時は保存済み選択を復元
        const isAllChecked = false;
        allLevelLabel.innerHTML = `<input type="checkbox" id="bulk-level-select-all" class="h-4 w-4 rounded border-gray-300 text-blue-800 focus:ring-yellow-500"> 全階層を対象にする`;
        bulkLevelOptionsContainer.appendChild(allLevelLabel);

        // 個別階層チェックボックス
        levels.forEach((lvl) => {
          const isChecked = currentSelection.includes(lvl.id);
          const label = document.createElement("label");
          label.className =
            "flex items-center gap-2 text-sm cursor-pointer ml-3";
          label.innerHTML = `<input type="checkbox" value="${lvl.id}" class="bulk-level-checkbox-option h-4 w-4 rounded border-gray-300 text-blue-800 focus:ring-yellow-500" ${isChecked ? "checked" : ""}>`;
          label.append(` ${lvl.label}`);
          bulkLevelOptionsContainer.appendChild(label);
        });

        // 全階層チェックボックスの連動
        const allCheckboxEl = document.getElementById("bulk-level-select-all");
        allCheckboxEl.addEventListener("change", (e) => {
            const isChecked = e.target.checked;
            bulkLevelOptionsContainer
              .querySelectorAll(".bulk-level-checkbox-option")
              .forEach((cb) => {
                cb.checked = isChecked;
              });
          });

        // 個別階層選択時は「全階層」を解除
        bulkLevelOptionsContainer
          .querySelectorAll(".bulk-level-checkbox-option")
          .forEach((cb) => {
            cb.addEventListener("change", () => {
              allCheckboxEl.checked = false;
            });
          });

        openModal(bulkLevelSelectorModal);
      }
    });
  }

  // 4. 階層選択決定ボタン
  if (saveBulkLevelBtn) {
    saveBulkLevelBtn.addEventListener("click", () => {
      // 現在の入力値を保持
      const currentMemberNames = Array.from(
        document.querySelectorAll(".bulk-member-name-input"),
      ).map((input) => input.value);

      const selectAll = document.getElementById(
        "bulk-level-select-all",
      ).checked;
      let newSelection = [];

      if (!selectAll) {
        newSelection = Array.from(
          bulkLevelOptionsContainer.querySelectorAll(
            ".bulk-level-checkbox-option:checked",
          ),
        ).map((cb) => cb.value);
      }

      if (!selectAll && newSelection.length === 0) {
        showCustomAlert("階層を1つ以上選択するか、「全階層を対象にする」をONにしてください。");
        return;
      }

      if (state.activeBulkMemberIndex !== -1) {
        state.bulkMemberLevels[state.activeBulkMemberIndex] = newSelection;
      }

      // UI再描画 (名前を維持)
      renderBulkMemberInputs(
        bulkMemberInputsContainer.children.length,
        currentMemberNames,
      );

      closeModal(bulkLevelSelectorModal);
      state.activeBulkMemberIndex = -1;
    });
  }

  // 階層選択閉じるボタン
  if (closeBulkLevelModalBtn) {
    closeBulkLevelModalBtn.addEventListener("click", () => {
      closeModal(bulkLevelSelectorModal);
      state.activeBulkMemberIndex = -1;
    });
  }

  // 5. 保存ボタン
  if (saveBulkMemberBtn) {
    saveBulkMemberBtn.addEventListener("click", () => {
      const project = state.projects.find(
        (p) => p.id === state.currentProjectId,
      );
      if (!project) return;

      const jointId = bulkMemberJointSelect.value;
      if (!jointId)
        return showCustomAlert("使用する継手を選択してください。", {
          invalidElements: [bulkMemberJointSelect],
        });

      const nameInputs = document.querySelectorAll(".bulk-member-name-input");
      const newMembers = [];
      const timestamp = Date.now();

      nameInputs.forEach((input, index) => {
        const name = input.value.trim();
        const targetLevels = state.bulkMemberLevels[index] || [];

        if (name) {
          newMembers.push({
            id: `member_${timestamp}_${index}`,
            name: name,
            jointId: jointId,
            targetLevels: targetLevels,
          });
        }
      });

      if (newMembers.length === 0) {
        return showCustomAlert("少なくとも1つの部材名を入力してください。", {
          invalidElements: [nameInputs[0]],
        });
      }

      // 楽観的UI
      const updatedMembersList = [...(project.members || []), ...newMembers];
      const projectIndex = state.projects.findIndex(
        (p) => p.id === state.currentProjectId,
      );
      if (projectIndex !== -1)
        state.projects[projectIndex].members = updatedMembersList;

      renderDetailView();

      const jointName =
        bulkMemberJointSelect.options[bulkMemberJointSelect.selectedIndex].text;
      showToast(
        `${newMembers.length}件の部材を一括登録しました (継手: ${jointName})`,
      );

      // DB保存
      // ※ updateProjectData は差分更新ではなく members 全体を更新する関数と想定
      updateProjectData(state.currentProjectId, {
        members: updatedMembersList,
      }).catch((err) => {
        console.error(err);
        showCustomAlert("保存に失敗しました。リロードしてください。");
      });
    });
  }

  // 閉じるボタン
  [closeBulkAddMemberModalBtn, cancelBulkAddMemberBtn].forEach((btn) => {
    if (btn)
      btn.addEventListener("click", () => closeModal(bulkAddMemberModal));
  });
}

// /**
//  * クイックナビゲーション（FABメニュー等）のイベント設定
//  */
// function setupQuickNavEvents() {
//   const quickNavToggle = document.getElementById("quick-nav-toggle");

//   // 1. トグルボタンクリック
//   if (quickNavToggle) {
//     quickNavToggle.addEventListener("click", (e) => {
//       e.stopPropagation(); // 親への伝播を止める（documentのclickイベントが発火して即閉じないように）
//       toggleQuickNav();
//     });
//   }

//   // 2. メニューの外側をクリックしたら閉じる
//   document.addEventListener("click", (e) => {
//     // 判定と処理は ui.js に委譲する
//     closeQuickNavIfOutside(e.target);
//   });
// }

/**
 * モーダルのドラッグ機能を有効化する設定
 */
function setupDraggableModals() {
  // ドラッグ可能にしたいモーダルのIDリスト
  const modalIds = [
    "edit-joint-modal",
    "edit-member-modal",
    "bulk-add-member-modal",
    "temp-bolt-mapping-modal",
    // 必要に応じて追加（例: "bolt-size-settings-modal" など）
  ];

  modalIds.forEach((id) => {
    const modal = document.getElementById(id);
    if (modal) {
      makeDraggable(modal);
    }
  });
}

/**
 * タブ切り替えナビゲーション（デスクトップ・モバイル）のイベント設定
 */
function setupTabNavigationEvents() {
  // デスクトップ用タブ
  const tabJoints = document.getElementById("nav-tab-joints");
  const tabTally = document.getElementById("nav-tab-tally");

  // モバイル用タブ
  const mobileTabJoints = document.getElementById("mobile-nav-tab-joints");
  const mobileTabTally = document.getElementById("mobile-nav-tab-tally");

  // イベントリスナー登録
  if (tabJoints) {
    tabJoints.addEventListener("click", () => switchTab("joints"));
  }

  if (tabTally) {
    tabTally.addEventListener("click", () => switchTab("tally"));
  }

  if (mobileTabJoints) {
    mobileTabJoints.addEventListener("click", () => switchTab("joints"));
  }

  if (mobileTabTally) {
    mobileTabTally.addEventListener("click", () => switchTab("tally"));
  }
}

/**
 * ダークモード切り替えのイベント設定
 */
function setupThemeEvents() {
  const darkModeToggle = document.getElementById("dark-mode-toggle");
  const mobileDarkModeToggle = document.getElementById(
    "mobile-dark-mode-toggle",
  );

  if (darkModeToggle) {
    darkModeToggle.addEventListener("change", toggleTheme);
  }

  if (mobileDarkModeToggle) {
    mobileDarkModeToggle.addEventListener("change", toggleTheme);
  }
}

/**
 * グループ（物件名）操作関連のイベント設定
 */
function setupGroupActionEvents() {
  const saveGroupBtn = document.getElementById("save-group-btn");
  const editGroupModal = document.getElementById("edit-group-modal");
  const oldNameInput = document.getElementById("edit-group-old-name");
  const newNameInput = document.getElementById("edit-group-new-name");

  if (saveGroupBtn) {
    saveGroupBtn.addEventListener("click", async () => {
      if (!oldNameInput || !newNameInput) return;

      const oldName = oldNameInput.value;
      const newName = newNameInput.value.trim();

      // 変更がない場合は何もしない
      if (!newName || oldName === newName) {
        if (editGroupModal) closeModal(editGroupModal);
        return;
      }

      const projectsToUpdate = state.projects.filter(
        (p) => p.propertyName === oldName,
      );

      if (projectsToUpdate.length === 0) {
        if (editGroupModal) closeModal(editGroupModal);
        return;
      }

      // --- 1. 楽観的UI更新 ---
      projectsToUpdate.forEach((project) => {
        project.propertyName = newName;
      });
      updateProjectListUI();
      if (editGroupModal) closeModal(editGroupModal);
      showToast(`物件名を「${newName}」に一括更新しました。`);

      // --- 2. DB更新 (firebase.js のヘルパー関数を活用) ---
      try {
        const targetIds = projectsToUpdate.map((p) => p.id);
        // インポートしたヘルパー関数を呼び出すだけ！
        await updateProjectPropertyNameBatch(targetIds, newName);
      } catch (err) {
        console.error("物件名の一括更新に失敗しました: ", err);
        showCustomAlert(
          "データベースの更新に失敗しました。権限設定を確認してください。",
        );
      }
    });
  }
}

/**
 * 物件ごとの集計結果モーダル内のイベント設定（詳細表示クリックなど）
 */
function setupAggregatedResultsEvents() {
  const aggregatedResultsContent = document.getElementById(
    "aggregated-results-content",
  );

  if (aggregatedResultsContent) {
    aggregatedResultsContent.addEventListener("click", (e) => {
      // 詳細データを持っているセル(td.has-details)がクリックされたか判定
      const targetCell = e.target.closest("td.has-details");
      if (!targetCell) return;

      try {
        // データ属性から詳細情報を取得
        const detailsData = JSON.parse(targetCell.dataset.details);
        const row = targetCell.closest("tr");
        const boltSize = targetCell.dataset.boltSize || row.querySelector("td:first-child").textContent;

        // 詳細モーダルの要素取得
        const modalTitle = document.getElementById("details-modal-title");
        const modalContent = document.getElementById("details-modal-content");
        const detailsModal = document.getElementById("details-modal");

        if (modalTitle && modalContent && detailsModal) {
          modalTitle.textContent = `${boltSize} の合計内訳`;

          const sortedJoints = Object.entries(detailsData).sort((a, b) =>
            a[0].localeCompare(b[0]),
          );
          const totalCount = sortedJoints.reduce((s, [, v]) => s + v, 0);
          const memberCount = sortedJoints.length;

          let contentHtml = `<p class="text-sm text-slate-500 dark:text-slate-400 mb-3">${memberCount}部材 / 合計 <span class="font-bold text-slate-900 dark:text-slate-100">${totalCount.toLocaleString()}本</span></p>`;
          contentHtml += '<ul class="space-y-2 text-base">';

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
        console.error("Failed to parse aggregated details data:", err);
      }
    });
  }
}

/**
 * ボルトサイズ選択モーダル（汎用セレクター）のイベント設定
 */
function setupBoltSelectorEvents() {
  const boltOptionsContainer = document.getElementById(
    "bolt-options-container",
  );
  const boltSelectorModal = document.getElementById("bolt-selector-modal");

  // 1. モーダルを開く処理 (Document Delegation)
  // 動的に生成される要素や、複数の場所にあるトリガーに対応するため document に設定
  document.addEventListener("click", (e) => {
    // A. 「▼」ボタンがクリックされた時
    if (e.target.classList.contains("bolt-select-trigger")) {
      // ui.js の関数を呼び出す (dataset.targetには対象のinput IDが入っている想定)
      if (typeof openBoltSelectorModal === "function") {
        openBoltSelectorModal(e.target.dataset.target);
      }
    }
    // B. 読み取り専用の入力欄がクリックされた時（隣の▼ボタンを押したことにする）
    else if (e.target.classList.contains("modal-trigger-input")) {
      const triggerButton = e.target.nextElementSibling;
      if (triggerButton) {
        triggerButton.click();
      }
    }
  });

  // 2. モーダル内でボルトを選択した時の処理
  if (boltOptionsContainer) {
    boltOptionsContainer.addEventListener("click", (e) => {
      // ボタンがクリックされ、かつ書き込み対象(activeBoltTarget)が特定されている場合
      if (
        e.target.classList.contains("bolt-option-btn") &&
        state.activeBoltTarget
      ) {
        // 対象の入力欄に値をセット
        state.activeBoltTarget.value = e.target.dataset.size;

        // inputイベントを発火させて、変更検知（保存処理など）をトリガーする
        state.activeBoltTarget.dispatchEvent(
          new Event("input", { bubbles: true }),
        );
        state.activeBoltTarget.dispatchEvent(
          new Event("change", { bubbles: true }),
        );

        // モーダルを閉じる
        if (boltSelectorModal) closeModal(boltSelectorModal);
      }
    });
  }
}

/**
 * 部材登録用：継手選択モーダルのイベント設定
 */
function setupJointSelectorEvents() {
  // DOM要素の取得
  const openJointSelectorBtn = document.getElementById(
    "open-joint-selector-btn",
  );
  const jointSelectorModal = document.getElementById("joint-selector-modal");
  const closeJointModalBtn = document.getElementById("close-joint-modal-btn"); // ※HTMLのIDを確認してください
  const jointOptionsContainer = document.getElementById(
    "joint-options-container",
  );

  const memberJointSelectInput = document.getElementById(
    "member-joint-select-input",
  ); // 表示用(readonly)
  const memberJointSelectId = document.getElementById("member-joint-select-id"); // 送信用(hidden)

  // 1. 「▼」ボタンクリックでモーダルを開く
  if (openJointSelectorBtn) {
    openJointSelectorBtn.addEventListener("click", () => {
      const project = state.projects.find(
        (p) => p.id === state.currentProjectId,
      );

      // 現在選択されているIDを取得
      const currentJointId = memberJointSelectId
        ? memberJointSelectId.value
        : "";

      // ui.js の関数を使ってリストを生成
      if (typeof populateJointSelectorModal === "function") {
        populateJointSelectorModal(project, currentJointId);
      }

      openModal(jointSelectorModal);
    });
  }

  // 2. テキスト入力欄クリックで「▼」ボタンのクリックを代行
  if (memberJointSelectInput && openJointSelectorBtn) {
    memberJointSelectInput.addEventListener("click", () => {
      openJointSelectorBtn.click();
    });
  }

  // 3. 閉じるボタン
  if (closeJointModalBtn) {
    closeJointModalBtn.addEventListener("click", () => {
      if (jointSelectorModal) closeModal(jointSelectorModal);
    });
  }

  // 4. 選択肢をクリックした時の処理 (Event Delegation)
  if (jointOptionsContainer) {
    jointOptionsContainer.addEventListener("click", (e) => {
      // アイコンなどがクリックされた場合も考慮して closest を使用
      const target = e.target.closest(".joint-option-btn");

      if (target) {
        const { id, name } = target.dataset;

        // 入力欄に値をセット
        if (memberJointSelectInput) memberJointSelectInput.value = name;
        if (memberJointSelectId) memberJointSelectId.value = id;

        // モーダルを閉じる
        if (jointSelectorModal) closeModal(jointSelectorModal);
      }
    });
  }
}
/**
 * 汎用アクション確認モーダル（実行・キャンセル）のイベント設定
 */
function setupGlobalActionEvents() {
  const confirmActionBtn = document.getElementById("confirm-action-btn");
  const cancelActionBtn = document.getElementById("cancel-action-btn");
  const confirmActionModal = document.getElementById("confirm-action-modal");

  // 1. 実行ボタン ("はい")
  if (confirmActionBtn) {
    confirmActionBtn.addEventListener("click", () => {
      // state.pendingAction に保存された関数を実行
      if (typeof state.pendingAction === "function") {
        state.pendingAction();
      }

      // 後始末
      state.pendingAction = null;
      if (confirmActionModal) closeModal(confirmActionModal);
    });
  }

  // 2. キャンセルボタン ("いいえ")
  if (cancelActionBtn) {
    cancelActionBtn.addEventListener("click", () => {
      // 実行せずにクリア
      state.pendingAction = null;
      if (confirmActionModal) closeModal(confirmActionModal);
    });
  }
}
/**
 * 箇所数入力表のクリップボードコピー機能
 */
/**
 * 箇所数入力表のクリップボードコピー機能 (3段ヘッダー対応版)
 */
function setupTallyClipboardEvents() {
  document.addEventListener("click", (e) => {
    // .closest を使うことで、中のアイコンなどをクリックしても確実にボタンを捉えます
    const copyBtn = e.target.closest("#copy-tally-btn");
    if (!copyBtn) return;

    const table = document.querySelector("#tally-sheet-container table");
    if (!table) {
      showToast("コピー対象の表が見つかりません。");
      return;
    }

    const data = [];
    const tHead = table.querySelector("thead");
    const tBody = table.querySelector("tbody");
    const tFoot = table.querySelector("tfoot");

    // --- 1. ヘッダー処理 (3行すべて取得) ---
    if (tHead) {
      tHead.querySelectorAll("tr").forEach((tr, rowIndex) => {
        const rowData = Array.from(tr.cells).map((cell) => {
          // チェックボックス行などはスキップせず、テキストまたは属性を抽出
          let text = cell.innerText.trim();
          // もし中身が空でチェックボックスがある場合
          if (!text && cell.querySelector('input[type="checkbox"]'))
            text = "LOCK";
          return `"${text}"`;
        });

        // 階層列のセルが rowspan で結合されている場合の横ずれ補正
        if (rowIndex > 0) rowData.unshift('""');

        data.push(rowData.join("\t"));
      });
    }

    // --- 2. 本体行 (入力値を取得) ---
    if (tBody) {
      tBody.querySelectorAll("tr").forEach((tr) => {
        const rowData = Array.from(tr.cells).map((cell) => {
          const input = cell.querySelector("input");
          // inputがあればその値、なければセルのテキスト
          const val = input ? input.value : cell.innerText.trim();
          return `"${val}"`;
        });
        data.push(rowData.join("\t"));
      });
    }

    // --- 3. フッター行 (列合計) ---
    if (tFoot) {
      tFoot.querySelectorAll("tr").forEach((tr) => {
        const rowData = Array.from(tr.cells).map(
          (cell) => `"${cell.innerText.trim()}"`,
        );
        data.push(rowData.join("\t"));
      });
    }

    const tsvString = data.join("\n");

    // クリップボードへ書き込み
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(tsvString)
        .then(() =>
          showToast("表のデータをコピーしました。Excel等に貼り付け可能です。"),
        )
        .catch((err) => {
          console.error("Copy failed:", err);
          showCustomAlert(
            "コピーに失敗しました。ブラウザの権限を確認してください。",
          );
        });
    } else {
      showCustomAlert("このブラウザはクリップボード操作に対応していません。");
    }
  });
}
/**
 * 検索機能のセットアップ (VSCode風・全角半角変換・履歴機能追加版)
 */
export function setupSearchFunctionality() {
  const widget = document.getElementById("search-widget");
  const input = document.getElementById("search-input");
  const countDisplay = document.getElementById("search-count");
  const currentSpan = document.getElementById("search-current");
  const totalSpan = document.getElementById("search-total");
  const prevBtn = document.getElementById("search-prev-btn");
  const nextBtn = document.getElementById("search-next-btn");
  const closeBtn = document.getElementById("search-close-btn");
  const fabTrigger = document.getElementById("fab-search-trigger");

  const backBtn = document.getElementById("nav-back-to-list-btn");
  const mobileBackBtn = document.getElementById("mobile-nav-back-to-list-btn");

  if (!widget || !input) {
    console.error("⚠️ 検索ウィジェットのHTML要素が見つかりません。");
    return;
  }

  // --- 状態管理 ---
  let matches = [];
  let currentIndex = -1;
  let isOpen = false;

  // ▼▼▼ 追加: 検索履歴の管理用変数 ▼▼▼
  const MAX_HISTORY = 10;
  let searchHistory = [];
  let historyIndex = -1; // -1 は履歴を辿っていない状態（現在の入力中）
  let currentDraft = ""; // 履歴を辿る前の書きかけの文字を保存
  // ▲▲▲ 追加ここまで ▲▲▲

  // 1. 検索が有効な画面かどうか判定
  const isSearchAllowed = () => {
    const detailView = document.getElementById("project-detail-view");
    const jointsSection = document.getElementById("joints-section");
    if (!detailView || !jointsSection) return false;

    const isDetailActive =
      detailView.classList.contains("active") || detailView.offsetWidth > 0;
    const isJointsVisible =
      !jointsSection.classList.contains("hidden") &&
      jointsSection.offsetWidth > 0;
    return isDetailActive && isJointsVisible;
  };

  // 2. ウィジェットの開閉
  const openSearch = () => {
    if (!isSearchAllowed()) return;
    isOpen = true;
    widget.classList.add("open");
    input.focus();
    input.select();
    performSearch(input.value);
  };

  const closeSearch = () => {
    isOpen = false;
    widget.classList.remove("open");
    clearHighlights();
    input.blur();
  };

  const toggleSearch = () => {
    if (isOpen) closeSearch();
    else openSearch();
  };

  // FABクリック
  if (fabTrigger) {
    fabTrigger.addEventListener("click", () => {
      if (!isSearchAllowed()) return;
      toggleSearch();
    });
  }

  // キーボードショートカット (Ctrl+F, Esc)
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "f") {
      if (isSearchAllowed()) {
        e.preventDefault();
        openSearch();
      }
    }
    if (e.key === "Escape" && isOpen) {
      e.preventDefault();
      closeSearch();
    }
  });

  // 3. 画面遷移やタブ切り替え時の処理
  const forceCloseBtns = [
    document.getElementById("nav-back-to-list-btn"),
    document.getElementById("mobile-nav-back-to-list-btn"),
    document.getElementById("nav-tab-tally"),
    document.getElementById("mobile-nav-tab-tally"),
  ];
  forceCloseBtns.forEach((btn) => {
    if (btn) btn.addEventListener("click", closeSearch);
  });

  const toggleViews = [
    document.getElementById("switch-view-joints"),
    document.getElementById("switch-view-members"),
  ];
  toggleViews.forEach((btn) => {
    if (btn) {
      btn.addEventListener("click", () => {
        if (isOpen) {
          setTimeout(() => {
            performSearch(input.value);
          }, 50);
        }
      });
    }
  });

  // 4. 検索ロジック
  const clearHighlights = () => {
    document.querySelectorAll(".search-highlight").forEach((el) => {
      const parent = el.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(el.textContent), el);
        parent.normalize();
      }
    });
    matches = [];
    currentIndex = -1;
    updateCountUI();
  };

  const performSearch = (query) => {
    clearHighlights();

    if (!query || query.trim() === "") {
      updateCountUI();
      return;
    }

    const lowerQuery = query.toLowerCase();

    const jointsArea = document.getElementById("view-joints-area");
    const membersArea = document.getElementById("view-members-area");

    let targetContainer = null;
    if (jointsArea && jointsArea.offsetWidth > 0) {
      targetContainer = document.getElementById("joint-lists-container");
    } else if (membersArea && membersArea.offsetWidth > 0) {
      targetContainer = document.getElementById("member-lists-container");
    }

    if (!targetContainer) return;

    const nameElements = targetContainer.querySelectorAll(
      ".js-searchable-name",
    );

    nameElements.forEach((element) => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
          if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });

      const textNodes = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);

      textNodes.forEach((node) => {
        const text = node.nodeValue;
        const index = text.toLowerCase().indexOf(lowerQuery);

        if (index !== -1) {
          const span = document.createElement("span");
          span.className = "search-highlight";
          span.textContent = text.substr(index, query.length);

          const before = document.createTextNode(text.substr(0, index));
          const after = document.createTextNode(
            text.substr(index + query.length),
          );

          const parent = node.parentNode;
          parent.insertBefore(before, node);
          parent.insertBefore(span, before.nextSibling);
          parent.insertBefore(after, span.nextSibling);
          parent.removeChild(node);

          matches.push(span);
        }
      });
    });

    if (matches.length > 0) {
      currentIndex = 0;
      highlightCurrent();
    }

    updateCountUI();
  };

  // 5. ナビゲーション (次へ/前へ)
  const highlightCurrent = () => {
    matches.forEach((m) => m.classList.remove("active"));
    if (currentIndex >= 0 && currentIndex < matches.length) {
      const current = matches[currentIndex];
      current.classList.add("active");
      current.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center",
      });
    }
    updateCountUI();
  };

  const nextMatch = () => {
    if (matches.length === 0) return;
    currentIndex = (currentIndex + 1) % matches.length;
    highlightCurrent();
  };

  const prevMatch = () => {
    if (matches.length === 0) return;
    currentIndex = (currentIndex - 1 + matches.length) % matches.length;
    highlightCurrent();
  };

  const updateCountUI = () => {
    if (matches.length > 0) {
      countDisplay.classList.remove("hidden");
      currentSpan.textContent = currentIndex + 1;
      totalSpan.textContent = matches.length;
      prevBtn.disabled = false;
      nextBtn.disabled = false;
    } else {
      countDisplay.classList.add("hidden");
      prevBtn.disabled = true;
      nextBtn.disabled = true;
    }
  };

  // ▼▼▼ 追加: 全角を半角に変換するヘルパー関数 ▼▼▼
  const toHalfWidth = (str) => {
    return str
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, function (s) {
        return String.fromCharCode(s.charCodeAt(0) - 0xfee0);
      })
      .replace(/[－]/g, "-")
      .replace(/　/g, " "); // ハイフンと全角スペースも変換
  };
  // ▲▲▲ 追加ここまで ▲▲▲

  // ▼▼▼ 修正: 入力イベント（半角変換と履歴のリセット） ▼▼▼
  input.addEventListener("input", (e) => {
    // IME（日本語入力）の変換中は邪魔しない
    if (e.isComposing) return;

    // 全角英数字を半角に変換してカーソル位置を保持
    const originalValue = e.target.value;
    const halfWidthValue = toHalfWidth(originalValue);

    if (originalValue !== halfWidthValue) {
      const cursorStart = e.target.selectionStart;
      e.target.value = halfWidthValue;
      e.target.setSelectionRange(cursorStart, cursorStart);
    }

    historyIndex = -1; // 文字を入力したら履歴トラッキングをリセット
    currentDraft = e.target.value;
    performSearch(e.target.value);
  });

  // IMEでの日本語入力が確定した瞬間に半角変換する
  input.addEventListener("compositionend", (e) => {
    const halfWidthValue = toHalfWidth(e.target.value);
    e.target.value = halfWidthValue;
    historyIndex = -1;
    currentDraft = halfWidthValue;
    performSearch(halfWidthValue);
  });
  // ▲▲▲ 修正ここまで ▲▲▲

  // ▼▼▼ 修正: キーボードイベント（Enterでの履歴保存、上下キーでの履歴呼び出し） ▼▼▼
  input.addEventListener("keydown", (e) => {
    // 日本語変換中のEnterキーや上下キーは無視する
    if (e.isComposing) return;

    if (e.key === "Enter") {
      e.preventDefault();

      // 検索履歴に追加（空文字は除外、重複は最新に移動）
      const val = input.value.trim();
      if (val) {
        searchHistory = searchHistory.filter((item) => item !== val); // 重複削除
        searchHistory.unshift(val); // 先頭に追加
        if (searchHistory.length > MAX_HISTORY) searchHistory.pop(); // 10件を超えたら古いものを削除
      }
      historyIndex = -1; // 履歴トラッキングをリセット

      // 次へ・前へ実行
      if (e.shiftKey) prevMatch();
      else nextMatch();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (searchHistory.length > 0 && historyIndex < searchHistory.length - 1) {
        if (historyIndex === -1) currentDraft = input.value; // 現在の入力を退避
        historyIndex++;
        input.value = searchHistory[historyIndex];
        performSearch(input.value);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        historyIndex--;
        input.value = searchHistory[historyIndex];
        performSearch(input.value);
      } else if (historyIndex === 0) {
        historyIndex = -1; // 元の入力に戻る
        input.value = currentDraft;
        performSearch(input.value);
      }
    }
  });
  // ▲▲▲ 修正ここまで ▲▲▲

  prevBtn.addEventListener("click", prevMatch);
  nextBtn.addEventListener("click", nextMatch);
  closeBtn.addEventListener("click", closeSearch);

  // 6. ドラッグ機能 (スマホ対応)
  const handle = widget.querySelector(".drag-handle");
  let isDragging = false;
  let startX, startY, initialLeft, initialTop;

  const getCoords = (e) => {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  };

  const onDragStart = (e) => {
    isDragging = true;
    const coords = getCoords(e);
    startX = coords.x;
    startY = coords.y;

    const rect = widget.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    widget.style.right = "auto";
    widget.style.left = `${initialLeft}px`;
    widget.style.top = `${initialTop}px`;

    document.body.style.cursor = "move";
    if (e.type === "touchstart") e.preventDefault();
  };

  const onDragMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const coords = getCoords(e);
    const dx = coords.x - startX;
    const dy = coords.y - startY;
    widget.style.left = `${initialLeft + dx}px`;
    widget.style.top = `${initialTop + dy}px`;
  };

  const onDragEnd = () => {
    isDragging = false;
    document.body.style.cursor = "default";
  };

  handle.addEventListener("mousedown", onDragStart);
  document.addEventListener("mousemove", onDragMove);
  document.addEventListener("mouseup", onDragEnd);

  handle.addEventListener("touchstart", onDragStart, { passive: false });
  document.addEventListener("touchmove", onDragMove, { passive: false });
  document.addEventListener("touchend", onDragEnd);
}

/**
 * 一括削除（複数選択）機能のイベント設定 (フローティング対応版)
 */
function setupBulkDeleteEvents() {
  const bulkDeleteBar = document.getElementById("bulk-delete-bar");
  const bulkDeleteBtn = document.getElementById("bulk-delete-btn");
  const bulkDeleteCount = document.getElementById("bulk-delete-count");

  // UIを更新する関数
  const updateBulkDeleteUI = () => {
    const checkedBoxes = document.querySelectorAll(".item-checkbox:checked");
    const count = checkedBoxes.length;

    // フローティングバーの表示切替
    if (bulkDeleteBar && bulkDeleteCount) {
      if (count > 0) {
        bulkDeleteCount.textContent = count;
        // 下からスッと表示する
        bulkDeleteBar.classList.remove(
          "translate-y-24",
          "opacity-0",
          "pointer-events-none",
        );
      } else {
        // 隠す
        bulkDeleteBar.classList.add(
          "translate-y-24",
          "opacity-0",
          "pointer-events-none",
        );
      }
    }

    // 行のハイライトを更新
    document.querySelectorAll(".item-row").forEach((row) => {
      const checkbox = row.querySelector(".item-checkbox");
      if (checkbox && checkbox.checked) {
        row.classList.add("!bg-yellow-100", "dark:!bg-yellow-900/40");
      } else {
        row.classList.remove("!bg-yellow-100", "dark:!bg-yellow-900/40");
      }
    });
  };

  // リストコンテナ内のクリックイベント（イベント委譲）
  const handleCheckboxChange = (e) => {
    if (e.target.classList.contains("select-all-checkbox")) {
      const table = e.target.closest("table");
      if (table) {
        const isChecked = e.target.checked;
        table.querySelectorAll(".item-checkbox").forEach((cb) => {
          cb.checked = isChecked;
        });
      }
      updateBulkDeleteUI();
    } else if (e.target.classList.contains("item-checkbox")) {
      const table = e.target.closest("table");
      if (table) {
        const allCheckboxes = table.querySelectorAll(".item-checkbox");
        const allChecked = Array.from(allCheckboxes).every((cb) => cb.checked);
        const selectAllCb = table.querySelector(".select-all-checkbox");
        if (selectAllCb) selectAllCb.checked = allChecked;
      }
      updateBulkDeleteUI();
    }
  };

  const jointsContainer = document.getElementById("joint-lists-container");
  const membersContainer = document.getElementById("member-lists-container");

  if (jointsContainer)
    jointsContainer.addEventListener("change", handleCheckboxChange);
  if (membersContainer)
    membersContainer.addEventListener("change", handleCheckboxChange);

  // 一括削除ボタンがクリックされた時（確認モーダルを表示）
  if (bulkDeleteBtn) {
    bulkDeleteBtn.addEventListener("click", () => {
      const checkedBoxes = document.querySelectorAll(".item-checkbox:checked");
      if (checkedBoxes.length === 0) return;

      const targets = Array.from(checkedBoxes).map((cb) => ({
        id: cb.dataset.id,
        type: cb.dataset.type,
      }));

      const confirmDeleteModal = document.getElementById(
        "confirm-delete-modal",
      );
      const deleteTypeInput = document.getElementById("delete-type");
      const confirmDeleteMessage = document.getElementById(
        "confirm-delete-message",
      );

      if (confirmDeleteModal && deleteTypeInput && confirmDeleteMessage) {
        deleteTypeInput.value = "bulk"; // 種類を bulk(一括) に設定
        state.bulkDeleteTargets = targets; // 実行用に一時保存

        const jointCount = targets.filter((t) => t.type === "joint").length;
        const memberCount = targets.filter((t) => t.type === "member").length;

        let msg = `選択された ${targets.length} 件のデータを削除しますか？<br><br>`;
        if (jointCount > 0)
          msg += `<span class="text-blue-600 font-bold">・継手: ${jointCount} 件</span><br>`;
        if (memberCount > 0)
          msg += `<span class="text-green-600 font-bold">・部材: ${memberCount} 件</span><br>`;
        msg += `<br><span class="text-red-600 text-sm">※この操作は元に戻せません。</span>`;

        confirmDeleteMessage.innerHTML = msg; // HTMLとしてパースする

        // ui.js の関数を呼び出してモーダルを開く
        const modal = document.getElementById("confirm-delete-modal");
        if (modal) {
          modal.classList.remove("hidden");
          setTimeout(() => modal.classList.remove("opacity-0"), 10);
        }
      }
    });
  }
}
/**
 * 新しい物件一覧のイベント設定
 */
export function setupProjectListNewEvents() {
  const container = document.getElementById("projects-container");
  if (!container) return;

  // 1. アコーディオンの開閉とカードクリックの委譲
  container.addEventListener("click", (e) => {
    const header = e.target.closest(".project-group-header");
    const row = e.target.closest(".project-item-row");
    const checkbox = e.target.closest(".project-checkbox");

    // チェックボックスクリック時は何もしない（changeイベントで処理）
    if (checkbox) return;

    // グループヘッダーの開閉
    if (header) {
      const content = header.nextElementSibling;
      const arrow = header.querySelector(".group-arrow");
      const isHidden = content.classList.contains("hidden");

      content.classList.toggle("hidden");
      if (arrow) arrow.classList.toggle("rotate-90", isHidden);
      return;
    }

    // 工事行のクリック（詳細へ移動）
    if (row) {
      const projectId = row.dataset.id;
      state.currentProjectId = projectId;
      switchView("detail"); // ui.js の関数
      renderDetailView(); // ui.js の関数
    }
  });

  // 2. チェックボックスの監視とバーの表示
  container.addEventListener("change", (e) => {
    if (e.target.classList.contains("project-checkbox")) {
      updateProjectSelectionBar(); // ui.js の関数
    }
  });

  // // 3. バーのUI更新処理
  // function updateProjectOpBarUI() {
  //     const bar = document.getElementById("project-op-bar");
  //     const countLabel = document.getElementById("project-selection-count");
  //     const checkedBoxes = document.querySelectorAll(".project-checkbox:checked");
  //     const count = checkedBoxes.length;

  //     if (!bar) return;

  //     if (count > 0) {
  //         countLabel.textContent = count;
  //         bar.classList.remove("translate-y-24", "opacity-0", "pointer-events-none");

  //         // 編集・複製は1件の時のみ表示
  //         const editBtn = document.getElementById("project-edit-btn-bulk");
  //         const copyBtn = document.getElementById("project-copy-btn-bulk");
  //         if (editBtn) editBtn.classList.toggle("hidden", count !== 1);
  //         if (copyBtn) copyBtn.classList.toggle("hidden", count !== 1);
  //     } else {
  //         bar.classList.add("translate-y-24", "opacity-0", "pointer-events-none");
  //     }
  // }

  // 4. バー内のボタン処理
  const barEdit = document.getElementById("project-edit-btn-bulk");
  const barCopy = document.getElementById("project-copy-btn-bulk");
  const barDelete = document.getElementById("project-delete-btn-bulk");

  if (barEdit) {
    barEdit.addEventListener("click", () => {
      const id = document.querySelector(".project-checkbox:checked")?.dataset
        .id;
      const project = state.projects.find((p) => p.id === id);
      if (project) openEditProjectModal(project); // 既存の編集関数
    });
  }

  if (barCopy) {
    barCopy.addEventListener("click", () => {
      const id = document.querySelector(".project-checkbox:checked")?.dataset
        .id;
      if (id) {
        const copySourceIdInput = document.getElementById("copy-source-project-id");
        const copyNewNameInput = document.getElementById("copy-new-project-name");
        const copyProjectModal = document.getElementById("copy-project-modal");
        if (copySourceIdInput) copySourceIdInput.value = id;
        if (copyNewNameInput) copyNewNameInput.value = "";
        if (copyProjectModal) openModal(copyProjectModal);
      }
    });
  }

  if (barDelete) {
    barDelete.addEventListener("click", () => {
      const checkedBoxes = document.querySelectorAll(
        ".project-checkbox:checked",
      );
      const ids = Array.from(checkedBoxes).map((cb) => cb.dataset.id);

      if (ids.length === 1) {
        // 1件なら既存の削除確認を利用
        openConfirmDeleteModal(ids[0], "project");
      } else {
        // 複数削除（必要であれば実装。まずは警告を出すか1件ずつ処理）
        showCustomAlert("複数削除は現在1件ずつの対応となります。");
      }
    });
  }
}
