import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  signInWithCustomToken,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

import {
  PRESET_COLORS,
  HUG_BOLT_SIZES,
  BOLT_TYPES,
  LEGACY_DEFAULT_BOLT_SIZES,
  S10T_WEIGHTS_G,
  F8T_WEIGHTS_G,
} from "./modules/config.js";

import {
  getProjectLevels,
  calculateResults,
  getTallyList,
  calculateAggregatedResults,
  checkAndMigrateBoltSizes,
  cleanupAndSaveBoltSettings,
} from "./modules/calculator.js";

import { auth, isDevelopmentEnvironment } from "./modules/firebase.js";

import {
  showToast,
  openModal,
  closeModal,
  showCustomAlert,
  // renderComplexSplInputs,
  // updateComplexSplCount,
  // editComplexSplCache,
  // newComplexSplCache,
  // resetEditComplexSplCache,
  // resetNewComplexSplCache,
  renderBoltSizeSettings,
  toggleQuickNav,
  renderBulkMemberInputs,
  updateColumnLockUI,
  resetMemberForm,
  updateDynamicInputs,
  switchTab,
  updateTallySheetCalculations,
  renderColorPalette,
  updateJointFormUI,
  openEditModal,
  openEditProjectModal,
  renderStaticColorPalette,
  toggleFab,
  populateJointDropdownForEdit,
  makeDraggable,
  populateGlobalBoltSelectorModal,
  renderOrderDetails,
  renderTempOrderDetails,
  renderProjectList,
  openBoltSelectorModal,
  openConfirmDeleteModal,
  openEditMemberModal,
  renderResults,
  switchView,
  renderDetailView,
  performHistoryAction,
  saveStateToHistory,
  updateUndoRedoButtons,
  populateHugBoltSelector,
  resetJointForm,
  generateCustomInputFields,
  populateJointSelectorModal,
  updateProjectListUI,
} from "./modules/ui.js";

import {
  subscribeToProjects,
  addProject,
  deleteProject,
  updateProjectData,
  updateProjectPropertyNameBatch,
  getGlobalSettings,
} from "./modules/db.js";

import { setupEventListeners } from "./modules/events.js";

import { state } from "./modules/state.js";

// let db, auth, projectsCollectionRef,
let unsubscribeProjects;
let history = { stack: [], currentIndex: -1 };
let isUndoRedoOperation = false;
// let levelNameCache = []; //★Ui.jsに移動中
// let areaNameCache = []; //★Ui.jsに移動中
// let newLevelNameCache = [];
// let newAreaNameCache = [];

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
  // // ▼▼▼ 追加：一括登録用モーダル関連の変数 ▼▼▼
  // const fabBulkAddMember = document.getElementById("fab-bulk-add-member");
  // const bulkAddMemberModal = document.getElementById("bulk-add-member-modal");
  // const closeBulkAddMemberModalBtn = document.getElementById(
  //   "close-bulk-add-member-modal-btn",
  // );
  // const cancelBulkAddMemberBtn = document.getElementById(
  //   "cancel-bulk-add-member-btn",
  // );
  // const saveBulkMemberBtn = document.getElementById("save-bulk-member-btn");
  // const bulkMemberJointSelect = document.getElementById(
  //   "bulk-member-joint-select",
  // );
  // //const bulkMemberLevelsContainer = document.getElementById('bulk-member-levels-container');
  // const bulkMemberInputsContainer = document.getElementById(
  //   "bulk-member-inputs-container",
  // );
  // const addBulkInputBtn = document.getElementById("add-bulk-input-btn");
  // // ▲▲▲ 追加ここまで ▲▲▲
  // // ▼▼▼ 新規追加: 部材一括登録用の階層選択モーダル関連 ▼▼▼
  // const bulkLevelSelectorModal = document.getElementById(
  //   "bulk-level-selector-modal",
  // );
  // const closeBulkLevelModalBtn = document.getElementById(
  //   "close-bulk-level-modal-btn",
  // );
  // const saveBulkLevelBtn = document.getElementById("save-bulk-level-btn");
  // const bulkLevelOptionsContainer = document.getElementById(
  //   "bulk-level-options-container",
  // );

  // const navTabJoints = document.getElementById("nav-tab-joints");
  // const navTabTally = document.getElementById("nav-tab-tally");

  // const hamburgerBtn = document.getElementById("hamburger-btn");
  // const mobileMenu = document.getElementById("mobile-menu");

  // const projectNameInput = document.getElementById("project-name");
  // const projectFloorsInput = document.getElementById("project-floors");
  // const projectSectionsInput = document.getElementById("project-sections");
  // const projectHasPhInput = document.getElementById("project-has-ph");
  // const addProjectBtn = document.getElementById("add-project-btn");
  // const advancedSettingsToggle = document.getElementById(
  //   "advanced-settings-toggle",
  // );
  // const simpleProjectSettings = document.getElementById(
  //   "simple-project-settings",
  // );
  // const advancedProjectSettings = document.getElementById(
  //   "advanced-project-settings",
  // );
  // const customLevelsCountInput = document.getElementById("custom-levels-count");
  const customLevelsContainer = document.getElementById(
    "custom-levels-container",
  );
  // const customAreasCountInput = document.getElementById("custom-areas-count");
  const customAreasContainer = document.getElementById(
    "custom-areas-container",
  );
  // const addCustomLevelsCountInput = document.getElementById(
  //   "add-custom-levels-count",
  // );
  // const addDecrementLevelsBtn = document.getElementById(
  //   "add-decrement-levels-btn",
  // );
  // const addIncrementLevelsBtn = document.getElementById(
  //   "add-increment-levels-btn",
  // );
  // const addCustomAreasCountInput = document.getElementById(
  //   "add-custom-areas-count",
  // );
  // const addDecrementAreasBtn = document.getElementById(
  //   "add-decrement-areas-btn",
  // );
  // const addIncrementAreasBtn = document.getElementById(
  //   "add-increment-areas-btn",
  // );
  const jointTypeInput = document.getElementById("joint-type");
  const jointNameInput = document.getElementById("joint-name");
  // const flangeSizeInput = document.getElementById("flange-size");
  // const flangeCountInput = document.getElementById("flange-count");
  // const webSizeInput = document.getElementById("web-size");
  // const webCountInput = document.getElementById("web-count");
  // const addJointBtn = document.getElementById("add-joint-btn");
  // const jointListsContainer = document.getElementById("joint-lists-container");

  const tallySheetContainer = document.getElementById("tally-sheet-container");
  // const resultsCard = document.getElementById("results-card");

  // const isPinJointInput = document.getElementById("is-pin-joint");
  // const countAsMemberInput = document.getElementById("count-as-member");
  // const memberNameInput = document.getElementById("member-name");
  // const addMemberBtn = document.getElementById("add-member-btn");
  // const memberListsContainer = document.getElementById(
  //   "member-lists-container",
  // );
  // const editModal = document.getElementById("edit-joint-modal");

  // const saveJointBtn = document.getElementById("save-joint-btn");
  // const editJointIdInput = document.getElementById("edit-joint-id");
  // const editJointTypeInput = document.getElementById("edit-joint-type");
  // const editJointNameInput = document.getElementById("edit-joint-name");
  // const editFlangeSizeInput = document.getElementById("edit-flange-size");
  // const editFlangeCountInput = document.getElementById("edit-flange-count");
  // const editWebSizeInput = document.getElementById("edit-web-size");
  // const editWebCountInput = document.getElementById("edit-web-count");

  // const editIsPinJointInput = document.getElementById("edit-is-pin-joint");
  // const editCountAsMemberInput = document.getElementById(
  //   "edit-count-as-member",
  // );
  // const editMemberModal = document.getElementById("edit-member-modal");

  // const saveMemberBtn = document.getElementById("save-member-btn");
  // const editMemberIdInput = document.getElementById("edit-member-id");
  // const editMemberNameInput = document.getElementById("edit-member-name");
  // const editMemberJointSelect = document.getElementById(
  //   "edit-member-joint-select",
  // );
  // const editProjectModal = document.getElementById("edit-project-modal");

  // const saveProjectBtn = document.getElementById("save-project-btn");
  // const editProjectIdInput = document.getElementById("edit-project-id");
  // const editProjectNameInput = document.getElementById("edit-project-name");
  // const editProjectFloorsInput = document.getElementById("edit-project-floors");
  // const editProjectSectionsInput = document.getElementById(
  //   "edit-project-sections",
  // );
  // const editProjectHasPhInput = document.getElementById("edit-project-has-ph");

  // const editCustomLevelsCountInput = document.getElementById(
  //   "edit-custom-levels-count",
  // );
  // const editCustomLevelsContainer = document.getElementById(
  //   "edit-custom-levels-container",
  // );
  // const editCustomAreasCountInput = document.getElementById(
  //   "edit-custom-areas-count",
  // );
  // const editCustomAreasContainer = document.getElementById(
  //   "edit-custom-areas-container",
  // );
  // const confirmDeleteModal = document.getElementById("confirm-delete-modal");
  // const confirmDeleteBtn = document.getElementById("confirm-delete-btn");
  // const cancelDeleteBtn = document.getElementById("cancel-delete-btn");
  // const deleteIdInput = document.getElementById("delete-id");
  // const deleteTypeInput = document.getElementById("delete-type");

  // const confirmAddModal = document.getElementById("confirm-add-modal");
  // // const confirmAddMessage = document.getElementById("confirm-add-message");
  // const confirmAddBtn = document.getElementById("confirm-add-btn");

  // const boltSelectorModal = document.getElementById("bolt-selector-modal");
  // const boltOptionsContainer = document.getElementById(
  //   "bolt-options-container",
  // );

  // const tempBoltSettingInput = document.getElementById("temp-bolt-setting");

  // const editTempBoltSettingInput = document.getElementById(
  //   "edit-temp-bolt-setting",
  // );
  const jointSelectorModal = document.getElementById("joint-selector-modal");
  const closeJointModalBtn = document.getElementById("close-joint-modal-btn");
  const openJointSelectorBtn = document.getElementById(
    "open-joint-selector-btn",
  );
  const jointOptionsContainer = document.getElementById(
    "joint-options-container",
  );
  const memberJointSelectInput = document.getElementById(
    "member-joint-select-input",
  );
  const memberJointSelectId = document.getElementById("member-joint-select-id");
  // const tempBoltMappingModal = document.getElementById(
  //   "temp-bolt-mapping-modal",
  // );
  // // const openTempBoltMappingBtn = document.getElementById(
  //   "open-temp-bolt-mapping-btn",
  // );
  // // const closeTempBoltMappingModalBtn = document.getElementById(
  //   "close-temp-bolt-mapping-modal-btn",
  // );
  // const cancelTempBoltMappingBtn = document.getElementById(
  //   "cancel-temp-bolt-mapping-btn",
  // );
  // const tempBoltMappingContainer = document.getElementById(
  //   "temp-bolt-mapping-container",
  // );

  // const isDoubleShearInput = document.getElementById("is-double-shear");
  // const editIsDoubleShearInput = document.getElementById(
  //   "edit-is-double-shear",
  // );

  const hasBoltCorrectionInput = document.getElementById("has-bolt-correction");
  // const editHasBoltCorrectionInput = document.getElementById(
  //   "edit-has-bolt-correction",
  // );
  const shopSplGroup = document.getElementById("shop-spl-group");
  const hasShopSplInput = document.getElementById("has-shop-spl");
  // const editHasShopSplInput = document.getElementById("edit-has-shop-spl");
  // const confirmMemberDeletionModal = document.getElementById(
  //   "confirm-member-deletion-modal",
  // );
  // const confirmMemberDeletionMessage = document.getElementById(
  //   "confirm-member-deletion-message",
  // );
  // const confirmMemberDeletionBtn = document.getElementById(
  //   "confirm-member-deletion-btn",
  // );
  // const cancelMemberDeletionBtn = document.getElementById(
  //   "cancel-member-deletion-btn",
  // );
  // const decrementLevelsBtn = document.getElementById("decrement-levels-btn");
  // const incrementLevelsBtn = document.getElementById("increment-levels-btn");
  // const decrementAreasBtn = document.getElementById("decrement-areas-btn");
  // const incrementAreasBtn = document.getElementById("increment-areas-btn");
  const confirmActionModal = document.getElementById("confirm-action-modal");
  // const confirmActionMessage = document.getElementById(
  //   "confirm-action-message",
  // );
  const confirmActionBtn = document.getElementById("confirm-action-btn");
  const cancelActionBtn = document.getElementById("cancel-action-btn");
  const shopTempBoltSizeInput = document.getElementById("shop-temp-bolt-size");
  const editShopTempBoltSizeInput = document.getElementById(
    "edit-shop-temp-bolt-size",
  );
  // const editComplexSplCountInput = document.getElementById(
  //   "edit-complex-spl-count",
  // );
  // const editDecrementComplexSplBtn = document.getElementById(
  //   "edit-decrement-complex-spl-btn"
  // );
  // const editIncrementComplexSplBtn = document.getElementById(
  //   "edit-increment-complex-spl-btn"
  // );
  // --- ここまで追加 ---
  // ▼▼▼ 追加：複製機能のロジック ▼▼▼
  // const copyProjectModal = document.getElementById("copy-project-modal");
  // const copySourceIdInput = document.getElementById("copy-source-project-id");
  // const copyNewNameInput = document.getElementById("copy-new-project-name");
  // const executeCopyBtn = document.getElementById("execute-copy-btn");
  // const closeCopyModalBtn = document.getElementById("close-copy-modal-btn");
  // const cancelCopyBtn = document.getElementById("cancel-copy-btn");
  // ▼▼▼ 追加：カラー関連の変数と関数 ▼▼▼
  // 変数定義
  const editJointColorInput = document.getElementById("edit-joint-color");
  const clearJointColorBtn = document.getElementById("clear-joint-color-btn");

  // ▼▼▼ 追加：常設フォーム用カラー関連変数 ▼▼▼
  const jointColorToggle = document.getElementById("joint-color-toggle");
  // const jointColorSection = document.getElementById("joint-color-section");
  const jointColorInput = document.getElementById("joint-color-input");
  // const staticClearJointColorBtn = document.getElementById(
  //   "static-clear-joint-color-btn",
  // );
  // const staticColorPaletteContainer = document.getElementById(
  //   "static-color-palette-container",
  // );
  // ▲▲▲ 追加ここまで ▲▲▲
  // ▼▼▼ 修正：Excel風プリセットカラー定義（蛍光色追加） ▼▼▼

  // 新規追加: ボルト設定関連のDOM要素
  // const btnBoltSizeSettings = document.getElementById("btn-bolt-size-settings");
  // const boltSizeSettingsModal = document.getElementById(
  //   "bolt-size-settings-modal",
  // );
  // const closeBoltSizeModalBtn = document.getElementById(
  //   "close-bolt-size-modal-btn",
  // );
  // const saveBoltSizeSettingsBtn = document.getElementById(
  //   "save-bolt-size-settings-btn",
  // );
  // const newBoltTypeSelect = document.getElementById("new-bolt-type-select");
  // const newBoltLengthInput = document.getElementById("new-bolt-length-input");
  // const addBoltSizeBtn = document.getElementById("add-bolt-size-btn");
  // const boltSizeList = document.getElementById("bolt-size-list");

  // --- DOM Elements --- セクションに追加

  const isBundledWithColumnInput = document.getElementById(
    "is-bundled-with-column",
  );
  // const bundleColumnGroup = document.getElementById("bundle-column-group");

  const editIsBundledWithColumnInput = document.getElementById(
    "edit-is-bundled-with-column",
  );
  // const editBundleColumnGroup = document.getElementById(
  //   "edit-bundle-column-group",
  // );

  // // イベントリスナー：標準ピッカーで色が選ばれた時
  // if (editJointColorInput) {
  //   editJointColorInput.addEventListener("input", (e) => {
  //     editJointColorInput.dataset.isNull = "false";
  //     // パレットの選択解除
  //     document
  //       .querySelectorAll(".color-swatch")
  //       .forEach((el) => el.classList.remove("selected"));
  //   });
  // }

  // // イベントリスナー：設定なしボタン
  // if (clearJointColorBtn) {
  //   clearJointColorBtn.addEventListener("click", () => {
  //     editJointColorInput.value = "#ffffff";
  //     editJointColorInput.dataset.isNull = "true";
  //     document
  //       .querySelectorAll(".color-swatch")
  //       .forEach((el) => el.classList.remove("selected"));
  //   });
  // }

  // 初期化時にパレット生成（デフォルト選択なし）
  renderColorPalette(null);

  // // トグルスイッチの制御
  // if (jointColorToggle) {
  //   jointColorToggle.addEventListener("change", (e) => {
  //     jointColorSection.classList.toggle("hidden", !e.target.checked);
  //   });
  // }

  // // 標準ピッカー
  // if (jointColorInput) {
  //   jointColorInput.addEventListener("input", () => {
  //     staticColorPaletteContainer
  //       .querySelectorAll(".color-swatch")
  //       .forEach((el) => el.classList.remove("selected"));
  //   });
  // }

  // // 解除ボタン
  // if (staticClearJointColorBtn) {
  //   staticClearJointColorBtn.addEventListener("click", () => {
  //     jointColorInput.value = "#ffffff";
  //     staticColorPaletteContainer
  //       .querySelectorAll(".color-swatch")
  //       .forEach((el) => el.classList.remove("selected"));
  //   });
  // }

  // 初期化
  renderStaticColorPalette(null);

  // --- UI & Modal Functions ---

  // プロジェクトリストの描画とアクション定義を行うラッパー関数
  //ui.jsのrenderProjectList()のコールバック関数の定義
  // const updateProjectListUI = () => {
  //   renderProjectList({
  //     // --- 選択 ---
  //     onSelect: (id) => {
  //       console.log(`[DEBUG] app.js: onSelect called with ID: ${id}`); // ★ログ

  //       // プロジェクト一覧の状態を確認
  //       console.log("[DEBUG] Current projects in state:", state.projects); // ★ログ

  //       // IDの型合わせと検索
  //       // id は文字列で来るので、数値と比較するために == (緩い比較) を使う
  //       const originalProject = state.projects.find((p) => p.id == id);

  //       if (originalProject) {
  //         console.log("[DEBUG] Project found!", originalProject); // ★ログ
  //         state.currentProjectId = originalProject.id;
  //       } else {
  //         console.warn(`[DEBUG] Project NOT found for ID: ${id}`); // ★ログ
  //         // 見つからない場合でも、一旦セットしてみる（デバッグ用）
  //         state.currentProjectId = id;
  //       }

  //       console.log(
  //         `[DEBUG] Set currentProjectId to: ${state.currentProjectId}`,
  //       ); // ★ログ

  //       resetMemberForm();
  //       state.sort = {};

  //       console.log("[DEBUG] Calling renderDetailView..."); // ★ログ
  //       renderDetailView();

  //       console.log("[DEBUG] Calling switchView('detail')..."); // ★ログ
  //       switchView("detail");
  //     },

  //     // --- 編集 ---
  //     onEdit: (id) => {
  //       const project = state.projects.find((p) => p.id === id);
  //       if (project && typeof openEditProjectModal === "function") {
  //         openEditProjectModal(project);
  //       } else {
  //         console.error("openEditProjectModal is not defined.");
  //       }
  //     },

  //     // --- 削除 ---
  //     onDelete: (id) => {
  //       openConfirmDeleteModal(id, "project");
  //     },

  //     // --- 複製 ---
  //     onDuplicate: (id) => {
  //       // 複製ロジック（既存のコードをここに移動）
  //       const project = state.projects.find((p) => p.id === id);
  //       if (project) {
  //         const copySourceIdInput = document.getElementById(
  //           "copy-source-project-id",
  //         );
  //         const copyNewNameInput = document.getElementById(
  //           "copy-new-project-name",
  //         );
  //         const copyProjectModal =
  //           document.getElementById("copy-project-modal");

  //         if (copySourceIdInput && copyNewNameInput && copyProjectModal) {
  //           copySourceIdInput.value = id;

  //           // 名前生成ロジック
  //           const sameGroupProjects = state.projects.filter(
  //             (p) => p.propertyName === project.propertyName,
  //           );
  //           let baseName = project.name.replace(/\(\d+\)$/, "").trim();
  //           let newName = baseName;
  //           let counter = 2;

  //           while (
  //             sameGroupProjects.some(
  //               (p) =>
  //                 p.name ===
  //                 (counter === 1 ? baseName : `${baseName}(${counter})`),
  //             )
  //           ) {
  //             counter++;
  //           }
  //           copyNewNameInput.value = `${baseName}(${counter})`;

  //           const defaultRadio = document.querySelector(
  //             'input[name="copy-mode"][value="with_master"]',
  //           );
  //           if (defaultRadio) defaultRadio.checked = true;

  //           openModal(copyProjectModal);
  //           setTimeout(() => copyNewNameInput.select(), 100);
  //         }
  //       }
  //     },

  //     // --- グループ編集 ---
  //     onGroupEdit: (propertyName) => {
  //       document.getElementById("edit-group-old-name").value = propertyName;
  //       document.getElementById("edit-group-new-name").value = propertyName;
  //       openModal(document.getElementById("edit-group-modal"));
  //     },

  //     // --- 集計表示 ---
  //     onGroupAggregate: (propertyName) => {
  //       const projectsInGroup = state.projects.filter(
  //         (p) => p.propertyName === propertyName,
  //       );
  //       if (projectsInGroup.length > 0) {
  //         const aggregatedData = calculateAggregatedResults(projectsInGroup);
  //         renderAggregatedResults(propertyName, aggregatedData);
  //         openModal(document.getElementById("aggregated-results-modal"));
  //       }
  //     },
  //   });
  // };

  // ▼▼▼ ボルトサイズ設定のタブ管理と描画ロジック ▼▼▼

  // 現在選択されているタブ（デフォルトはすべて）
  // ▼▼▼ ボルトサイズ設定のタブ管理と描画ロジック (グローバル対応) ▼▼▼

  // let activeBoltTab = "all";

  // document.querySelectorAll(".bolt-tab-btn").forEach((btn) => {
  //   btn.addEventListener("click", (e) => {
  //     activeBoltTab = e.target.dataset.tab;
  //     renderBoltSizeSettings(); // No arg
  //   });
  // });

  // 1. 設定モーダルを開く (NAVボタン)
  // nav-btn-bolt-settings 要素の取得とイベント設定
  // const navBtnBoltSettings = document.getElementById("nav-btn-bolt-settings");
  // if (navBtnBoltSettings) {
  //   navBtnBoltSettings.classList.remove("hidden"); // ボタンを表示
  //   navBtnBoltSettings.addEventListener("click", () => {
  //     // 種類セレクトボックスの選択肢生成
  //     newBoltTypeSelect.innerHTML = "";
  //     BOLT_TYPES.forEach((type) => {
  //       const opt = document.createElement("option");
  //       opt.value = type;
  //       opt.textContent = type;
  //       newBoltTypeSelect.appendChild(opt);
  //     });
  //     newBoltTypeSelect.value = "M16";

  //     renderBoltSizeSettings(); // Global
  //     openModal(boltSizeSettingsModal);
  //   });
  // }

  // // 2. 新規追加ボタン
  // addBoltSizeBtn.addEventListener("click", async () => {
  //   const type = newBoltTypeSelect.value;
  //   const length = parseInt(newBoltLengthInput.value);

  //   if (!length || length <= 0) {
  //     showToast("長さを正しく入力してください");
  //     return;
  //   }

  //   const newId = `${type}×${length}`;

  //   // 重複チェック
  //   if (state.globalBoltSizes.some((b) => b.id === newId)) {
  //     showToast("このサイズは既に登録されています");
  //     return;
  //   }

  //   // 追加
  //   state.globalBoltSizes.push({
  //     id: newId,
  //     label: newId,
  //     type: type,
  //     length: length,
  //   });

  //   // 再描画（ソート含む）
  //   sortGlobalBoltSizes();
  //   renderBoltSizeSettings();
  //   populateGlobalBoltSelectorModal(); // Update selector
  //   await saveGlobalBoltSizes();

  //   // 入力クリア
  //   newBoltLengthInput.value = "";
  //   newBoltLengthInput.focus();

  //   setTimeout(() => {
  //     const newItem = Array.from(boltSizeList.children).find((li) =>
  //       li.innerHTML.includes(newId),
  //     );
  //     if (newItem)
  //       newItem.scrollIntoView({ behavior: "smooth", block: "center" });
  //   }, 100);
  // });

  // 閉じるボタンの処理
  //とりあえずここに書いた
  // const finalizeBoltSettings = () => {
  //   const project = state.projects.find((p) => p.id === state.currentProjectId);
  //   const boltSizeSettingsModal = document.getElementById(
  //     "bolt-size-settings-modal",
  //   );

  //   // 保存処理 (calculator.js)
  //   if (project) {
  //     cleanupAndSaveBoltSettings(project);
  //   }

  //   // モーダルを閉じる (ui.js)
  //   closeModal(boltSizeSettingsModal);
  // };

  // //とりあえずここに書く。app.jsの移動はあとでやる
  // if (closeBoltSizeModalBtn)
  //   closeBoltSizeModalBtn.addEventListener("click", finalizeBoltSettings);
  // if (saveBoltSizeSettingsBtn)
  //   saveBoltSizeSettingsBtn.addEventListener("click", finalizeBoltSettings);

  // --- Event Listeners ---
  // ★ 修正版：新規工事登録（即時反映対応）
  // addProjectBtn.addEventListener("click", async () => {
  //   // async を追加
  //   const name = projectNameInput.value.trim();
  //   const propertyName = document.getElementById("property-name").value.trim();
  //   if (!name)
  //     return showCustomAlert("工事名を入力してください。", {
  //       invalidElements: [projectNameInput],
  //     });

  //   let newProjectData;
  //   if (advancedSettingsToggle.checked) {
  //     const levelsCount = parseInt(addCustomLevelsCountInput.value),
  //       areasCount = parseInt(addCustomAreasCountInput.value);
  //     if (isNaN(levelsCount) || levelsCount < 1)
  //       return showCustomAlert("階層数は1以上の数値を入力してください。", {
  //         invalidElements: [customLevelsCountInput],
  //       });
  //     if (isNaN(areasCount) || areasCount < 1)
  //       return showCustomAlert("エリア数は1以上の数値を入力してください。", {
  //         invalidElements: [customAreasCountInput],
  //       });
  //     const customLevels = Array.from(
  //       document.querySelectorAll("#custom-levels-container input"),
  //     ).map((input) => input.value.trim());
  //     const customAreas = Array.from(
  //       document.querySelectorAll("#custom-areas-container input"),
  //     ).map((input) => input.value.trim());
  //     if (
  //       customLevels.some((l) => l === "") ||
  //       customAreas.some((a) => a === "")
  //     )
  //       return showCustomAlert("すべての階層名とエリア名を入力してください。");
  //     newProjectData = {
  //       name,
  //       propertyName,
  //       mode: "advanced",
  //       customLevels,
  //       customAreas,
  //     };
  //   } else {
  //     const floors = parseInt(projectFloorsInput.value),
  //       sections = parseInt(projectSectionsInput.value);
  //     if (isNaN(sections) || sections < 1)
  //       return showCustomAlert("工区数を正しく入力してください。", {
  //         invalidElements: [projectSectionsInput],
  //       });
  //     if (isNaN(floors) || floors <= 1)
  //       return showCustomAlert("階数は2以上の数値を入力してください。", {
  //         invalidElements: [projectFloorsInput],
  //       });
  //     newProjectData = {
  //       name,
  //       propertyName,
  //       mode: "simple",
  //       floors,
  //       sections,
  //       hasPH: projectHasPhInput.checked,
  //     };
  //   }

  //   const newProject = {
  //     ...newProjectData,
  //     joints: [],
  //     members: [],
  //     tally: {},
  //     isTallySheetGenerated: false,
  //     tempBoltMap: {},
  //     tallyLocks: {},
  //   };

  //   // ▼▼▼ 修正：ローカルState更新と再描画を追加 ▼▼▼
  //   try {
  //     // 1. データベースに追加（awaitでID確定を待つ）
  //     const docRef = await addProject(newProject);

  //     // 2. ローカルのstateに新しい工事を追加
  //     const createdProject = { ...newProject, id: docRef.id };
  //     state.projects.push(createdProject);

  //     // 名前順にソート（一覧の並び順を維持するため）
  //     state.projects.sort((a, b) => a.name.localeCompare(b.name));

  //     // 3. 画面を再描画して即座に表示
  //     updateProjectListUI();
  //     showToast("新しい工事を登録しました。");
  //   } catch (err) {
  //     console.error(err);
  //     showCustomAlert("工事の追加に失敗しました。");
  //     return; // 失敗したら入力欄をリセットしない
  //   }
  //   // ▲▲▲ 修正ここまで ▲▲▲

  //   // フォームのリセット
  //   projectNameInput.value = "";
  //   document.getElementById("property-name").value = "";
  //   projectFloorsInput.value = "";
  //   projectSectionsInput.value = "";
  //   projectHasPhInput.checked = false;
  //   advancedSettingsToggle.checked = false;
  //   simpleProjectSettings.classList.remove("hidden");
  //   advancedProjectSettings.classList.add("hidden");
  //   addCustomLevelsCountInput.value = "1";
  //   addCustomAreasCountInput.value = "1";
  //   newLevelNameCache = [];
  //   newAreaNameCache = [];
  //   customLevelsContainer.innerHTML = "";
  //   customAreasContainer.innerHTML = "";
  //   // リセット後に入力欄を1つずつ再生成しておく
  //   generateCustomInputFields(1, customLevelsContainer, "custom-level");
  //   generateCustomInputFields(1, customAreasContainer, "custom-area");
  // }); // ★ 修正版：複製の実行処理
  // // ★ 修正版：複製の実行処理（連打防止 & 重複ブロック）
  // executeCopyBtn.addEventListener("click", async () => {
  //   // ▼▼▼ 追加：連打防止（処理開始時にボタンを無効化） ▼▼▼
  //   executeCopyBtn.disabled = true;
  //   executeCopyBtn.classList.add("opacity-50", "cursor-not-allowed");
  //   executeCopyBtn.textContent = "処理中...";
  //   // ▲▲▲ 追加ここまで ▲▲▲

  //   try {
  //     const sourceId = copySourceIdInput.value;
  //     const newName = copyNewNameInput.value.trim();
  //     const modeElement = document.querySelector(
  //       'input[name="copy-mode"]:checked',
  //     );
  //     const mode = modeElement ? modeElement.value : "with_master";

  //     if (!newName) throw new Error("工事名を入力してください。");

  //     const sourceProject = state.projects.find((p) => p.id === sourceId);
  //     if (!sourceProject) throw new Error("コピー元の工事が見つかりません。");

  //     // ▼▼▼ 追加：同名重複チェック（ブロック機能） ▼▼▼
  //     const isDuplicate = state.projects.some(
  //       (p) =>
  //         p.propertyName === sourceProject.propertyName && // 同じ物件グループで
  //         p.name === newName, // 同じ名前があるか
  //     );

  //     if (isDuplicate) {
  //       throw new Error(
  //         `物件「${
  //           sourceProject.propertyName || "(未設定)"
  //         }」内に、工事名「${newName}」は既に存在します。\n別の名前を指定してください。`,
  //       );
  //     }
  //     // ▲▲▲ 追加ここまで ▲▲▲

  //     // データのディープコピー
  //     const newProject = JSON.parse(JSON.stringify(sourceProject));

  //     newProject.name = newName;
  //     delete newProject.id;

  //     if (mode === "settings_only") {
  //       newProject.joints = [];
  //       newProject.members = [];
  //       newProject.tally = {};
  //       newProject.tempBoltMap = {};
  //       newProject.isTallySheetGenerated = false;
  //       newProject.tallyLocks = {};
  //     } else if (mode === "with_master") {
  //       newProject.tally = {};
  //       newProject.isTallySheetGenerated = false;
  //       newProject.tallyLocks = {};
  //     } else if (mode === "full") {
  //       if (!newProject.tallyLocks) newProject.tallyLocks = {};
  //     }

  //     // データベースに追加
  //     const docRef = await addProject(newProject);

  //     // ローカルState更新（楽観的UI）
  //     const createdProject = { ...newProject, id: docRef.id };
  //     state.projects.push(createdProject);
  //     state.projects.sort((a, b) => a.name.localeCompare(b.name));

  //     updateProjectListUI();
  //     closeModal(copyProjectModal);
  //     showToast("工事を複製しました。");
  //   } catch (err) {
  //     console.error("複製エラー:", err);
  //     // エラーメッセージをアラートで表示（Errorオブジェクトか文字列かで分岐）
  //     showCustomAlert(err.message || "工事の複製に失敗しました。");
  //   } finally {
  //     // ▼▼▼ 追加：連打防止解除（処理終了後にボタンを戻す） ▼▼▼
  //     executeCopyBtn.disabled = false;
  //     executeCopyBtn.classList.remove("opacity-50", "cursor-not-allowed");
  //     executeCopyBtn.textContent = "複製する";
  //     // ▲▲▲ 追加ここまで ▲▲▲
  //   }
  // });

  // ▼▼▼ 追加：複製モーダルを閉じる処理 ▼▼▼
  // [closeCopyModalBtn, cancelCopyBtn].forEach((btn) => {
  //   if (btn) {
  //     btn.addEventListener("click", () => closeModal(copyProjectModal));
  //   }
  // });
  // // ▲▲▲ 追加ここまで ▲▲▲

  // addJointBtn.addEventListener("click", () => {
  //   const project = state.projects.find((p) => p.id === state.currentProjectId);
  //   if (!project) return;
  //   const name = jointNameInput.value.trim();
  //   if (!name)
  //     return showCustomAlert("継手名を入力してください。", {
  //       invalidElements: [jointNameInput],
  //     });

  //   const type = jointTypeInput.value;
  //   const isPin = isPinJointInput.checked;
  //   const isDoubleShear = isDoubleShearInput.checked;
  //   const tempSetting = tempBoltSettingInput.value;
  //   const hasShopSpl = hasShopSplInput.checked;
  //   const isComplexSpl = isComplexSplInput.checked;

  //   const showSingle =
  //     type === "column" ||
  //     (isPin && isDoubleShear && tempSetting === "none" && hasShopSpl);
  //   const showDual =
  //     !isPin && tempSetting === "none" && hasShopSpl && type !== "column";

  //   if (showSingle) {
  //     const size = document.getElementById("shop-temp-bolt-size").value;
  //     const countInput = document.getElementById("shop-temp-bolt-count");
  //     const count = parseInt(countInput.value, 10);
  //     if ((count > 0 && !size) || (size && !count)) {
  //       return showCustomAlert(
  //         "手動指定の仮ボルトは、サイズと本数を両方入力してください。",
  //         {
  //           invalidElements: [
  //             size
  //               ? countInput
  //               : document.getElementById("shop-temp-bolt-size"),
  //           ],
  //         },
  //       );
  //     }
  //   } else if (showDual) {
  //     const sizeF = document.getElementById("shop-temp-bolt-size-f").value;
  //     const countFInput = document.getElementById("shop-temp-bolt-count-f");
  //     const countF = parseInt(countFInput.value, 10);
  //     if ((countF > 0 && !sizeF) || (sizeF && !countF)) {
  //       return showCustomAlert(
  //         "工場用F仮ボルトは、サイズと本数を両方入力してください。",
  //         {
  //           invalidElements: [
  //             sizeF
  //               ? countFInput
  //               : document.getElementById("shop-temp-bolt-size-f"),
  //           ],
  //         },
  //       );
  //     }

  //     const sizeW = document.getElementById("shop-temp-bolt-size-w").value;
  //     const countWInput = document.getElementById("shop-temp-bolt-count-w");
  //     const countW = parseInt(countWInput.value, 10);
  //     if ((countW > 0 && !sizeW) || (sizeW && !countW)) {
  //       return showCustomAlert(
  //         "工場用W仮ボルトは、サイズと本数を両方入力してください。",
  //         {
  //           invalidElements: [
  //             sizeW
  //               ? countWInput
  //               : document.getElementById("shop-temp-bolt-size-w"),
  //           ],
  //         },
  //       );
  //     }
  //   }
  //   // --- ここまで修正 ---

  //   const isCounted = countAsMemberInput.checked;
  //   let flangeSize = flangeSizeInput.value;
  //   let flangeCountStr = flangeCountInput.value;
  //   let webSize = webSizeInput.value;
  //   let webCountStr = webCountInput.value;
  //   const invalidElements = [];
  //   const twoBoltTypes = ["girder", "beam", "other", "stud"];
  //   const oneBoltTypes = ["column", "wall_girt", "roof_purlin"];

  //   if (twoBoltTypes.includes(type)) {
  //     if (isPin) {
  //       if (!webSize) invalidElements.push(webSizeInput.parentElement);
  //       if (webCountStr === "") invalidElements.push(webCountInput);
  //     } else {
  //       if (!flangeSize) invalidElements.push(flangeSizeInput.parentElement);
  //       if (flangeCountStr === "") invalidElements.push(flangeCountInput);
  //       if (!webSize) invalidElements.push(webSizeInput.parentElement);
  //       if (webCountStr === "") invalidElements.push(webCountInput);
  //     }
  //   } else if (oneBoltTypes.includes(type)) {
  //     if (!flangeSize) invalidElements.push(flangeSizeInput.parentElement);
  //     if (flangeCountStr === "") invalidElements.push(flangeCountInput);
  //   }

  //   if (invalidElements.length > 0)
  //     return showCustomAlert("必須項目をすべて入力してください。", {
  //       invalidElements,
  //     });

  //   let flangeCount = parseInt(flangeCountStr) || 0;
  //   let webCount = parseInt(webCountStr) || 0;
  //   const complexSplCount = parseInt(complexSplCountInput.value);
  //   let webInputsData = null;

  //   if (isComplexSpl) {
  //     webInputsData = [];
  //     for (let i = 1; i <= complexSplCount; i++) {
  //       const suffix = i > 1 ? `-${i}` : "";
  //       const sizeVal = document.getElementById(`web-size${suffix}`).value;
  //       const countVal = document.getElementById(`web-count${suffix}`).value;
  //       webInputsData.push({ size: sizeVal, count: parseInt(countVal) || 0 });
  //     }
  //     // 複合SPLの場合、ルートのwebSize/Countは空にする
  //     webSize = "";
  //     webCount = 0;
  //   }
  //   // ▲▲▲ ここまでが修正箇所 ▲▲▲
  //   else {
  //     // isComplexSplでない場合の既存ロジック
  //     if (isPin) {
  //       flangeSize = "";
  //       flangeCount = 0;
  //     }
  //     const oneBoltTypes = ["column", "wall_girt", "roof_purlin"];
  //     if (oneBoltTypes.includes(type)) {
  //       webSize = "";
  //       webCount = 0;
  //     }
  //   }

  //   const newJoint = {
  //     id: `joint_${Date.now()}`,
  //     type,
  //     name,
  //     // ▼▼▼ 追加：色が有効なら値を保存、無効ならnull ▼▼▼
  //     color: jointColorToggle.checked ? jointColorInput.value : null,
  //     // ▲▲▲ 追加ここまで ▲▲▲
  //     flangeSize,
  //     flangeCount,
  //     webSize: webSize,
  //     webCount: webCount,
  //     isComplexSpl: isComplexSpl,
  //     complexSplCount: isComplexSpl ? complexSplCount : null,
  //     webInputs: webInputsData,
  //     isPinJoint: isPin,
  //     isDoubleShear: isDoubleShearInput.checked,
  //     hasShopSpl:
  //       isPin && !isDoubleShearInput.checked ? false : hasShopSplInput.checked,
  //     hasBoltCorrection:
  //       isPin && !isDoubleShearInput.checked
  //         ? false
  //         : hasShopSplInput.checked && hasBoltCorrectionInput.checked,
  //     countAsMember: isCounted,
  //     tempBoltSetting: type === "column" ? "none" : tempBoltSettingInput.value,
  //     // ★追加: 本柱以外、かつチェックが入っている場合に true
  //     isBundledWithColumn:
  //       type !== "column" &&
  //       isBundledWithColumnInput &&
  //       isBundledWithColumnInput.checked,
  //     shopTempBoltCount:
  //       parseInt(document.getElementById("shop-temp-bolt-count").value) || null,
  //     shopTempBoltSize:
  //       document.getElementById("shop-temp-bolt-size").value || null,
  //     shopTempBoltCount_F:
  //       parseInt(document.getElementById("shop-temp-bolt-count-f").value) ||
  //       null,
  //     shopTempBoltSize_F:
  //       document.getElementById("shop-temp-bolt-size-f").value || null,
  //     shopTempBoltCount_W:
  //       parseInt(document.getElementById("shop-temp-bolt-count-w").value) ||
  //       null,
  //     shopTempBoltSize_W:
  //       document.getElementById("shop-temp-bolt-size-w").value || null,
  //   };

  //   // データベースに継手を追加し、成功したらトーストを表示する関数
  //   // ▼▼▼以下のコードに置き換え▼▼▼
  //   const addJointAndShowToast = (jointData) => {
  //     // 手順A: ブラウザ内のデータ（state）を先に書き換えます
  //     const projectIndex = state.projects.findIndex(
  //       (p) => p.id === state.currentProjectId,
  //     );
  //     if (projectIndex === -1) return;
  //     const updatedJoints = [...state.projects[projectIndex].joints, jointData];
  //     state.projects[projectIndex].joints = updatedJoints;

  //     // 手順B: 書き換えたデータで、画面を即座に再描画します
  //     renderDetailView();

  //     // 手順C: フォームをリセットし、ユーザーに完了を通知します
  //     let boltInfo = "";
  //     if (jointData.isComplexSpl && jointData.webInputs)
  //       boltInfo = jointData.webInputs
  //         .map((w) => `${w.size}/${w.count}本`)
  //         .join(", ");
  //     else if (jointData.isPinJoint)
  //       boltInfo = `${jointData.webSize} / ${jointData.webCount}本`;
  //     else if (["column", "wall_girt", "roof_purlin"].includes(jointData.type))
  //       boltInfo = `${jointData.flangeSize} / ${jointData.flangeCount}本`;
  //     else
  //       boltInfo = `F:${jointData.flangeSize}/${jointData.flangeCount}本, W:${jointData.webSize}/${jointData.webCount}本`;
  //     showToast(`継手「${jointData.name}」を登録しました (${boltInfo})`);
  //     resetJointForm();
  //     jointNameInput.focus();

  //     // 手順D: 裏側で、データベースへの保存処理を実行します
  //     updateProjectData(state.currentProjectId, {
  //       joints: updatedJoints,
  //     }).catch((err) => {
  //       // エラー時の処理（ユーザーへの通知）
  //       showCustomAlert(
  //         "継手の追加に失敗しました。ページをリロードしてデータを確認してください。",
  //       );
  //       console.error("継手の追加に失敗: ", err);
  //     });
  //   };

  //   // 既存の継手名チェック
  //   const existingJoint = project.joints.find((j) => j.name === name);
  //   if (existingJoint) {
  //     state.tempJointData = newJoint; // newJointは元のコードの入力チェック部分で作成
  //     confirmAddMessage.textContent = `継手名「${name}」は既に登録されています。このまま登録しますか？`;
  //     openModal(confirmAddModal);
  //   } else {
  //     addJointAndShowToast(newJoint); // newJointは元のコードの入力チェック部分で作成
  //   }
  // });

  // // ★ 修正版：部材追加ボタン（即時反映・階層情報対応版）
  // addMemberBtn.addEventListener("click", () => {
  //   const project = state.projects.find((p) => p.id === state.currentProjectId);
  //   if (!project) return;
  //   const name = memberNameInput.value.trim();
  //   const jointId = memberJointSelectId.value;
  //   if (!name)
  //     return showCustomAlert("部材名を入力してください。", {
  //       invalidElements: [memberNameInput],
  //     });
  //   if (!jointId)
  //     return showCustomAlert("使用する継手を選択してください。", {
  //       invalidElements: [memberJointSelectInput],
  //     });

  //   // チェックされた階層を取得
  //   const checkedLevels = Array.from(
  //     document.querySelectorAll(".static-level-checkbox:checked"),
  //   ).map((cb) => cb.value);

  //   // 新しい部材データを作成
  //   const newMember = {
  //     id: `member_${Date.now()}`,
  //     name,
  //     jointId,
  //     targetLevels: checkedLevels,
  //   };

  //   // ▼▼▼ 修正：ここから楽観的UI処理 ▼▼▼

  //   // 1. ローカルのstateを即座に更新
  //   if (!project.members) project.members = [];
  //   project.members.push(newMember);

  //   // 2. 画面を再描画して即座にリストに反映
  //   renderDetailView();

  //   // 3. フォームのリセットと通知
  //   memberNameInput.value = "";
  //   document
  //     .querySelectorAll(".static-level-checkbox")
  //     .forEach((cb) => (cb.checked = false));

  //   const jointName = memberJointSelectInput.value;
  //   showToast(`部材「${name}」を登録しました (使用継手: ${jointName})`);
  //   memberNameInput.focus();

  //   // 4. 裏側でデータベースに保存
  //   updateProjectData(state.currentProjectId, {
  //     members: project.members,
  //   }).catch((err) => {
  //     console.error("部材の追加に失敗: ", err);
  //     showCustomAlert(
  //       "部材の追加に失敗しました。ページをリロードして確認してください。",
  //     );
  //   });
  // });

  // ★ 修正版：継手リストのクリック処理（統合・完全版）
  // jointListsContainer.addEventListener("click", (e) => {
  //   // ボタン要素を取得（アイコンをクリックした場合も考慮してclosestを使う）
  //   const target = e.target.closest("button");
  //   if (!target) return;

  //   const jointId = target.dataset.id;
  //   const project = state.projects.find((p) => p.id === state.currentProjectId);
  //   if (!project) return;

  //   // --- 削除ボタン ---
  //   if (target.classList.contains("delete-joint-btn")) {
  //     openConfirmDeleteModal(jointId, "joint");
  //     return;
  //   }

  //   // --- 編集ボタン ---
  //   if (target.classList.contains("edit-joint-btn")) {
  //     const joint = project.joints.find((j) => j.id === jointId);
  //     if (joint) {
  //       // タイトルを「編集」に戻す（新規登録ボタンで書き換わっている可能性があるため）
  //       const modalTitle = document.querySelector("#edit-joint-modal h3");
  //       if (modalTitle) modalTitle.textContent = "継手の編集";

  //       // 編集モーダルを開く
  //       openEditModal(joint);
  //     }
  //     return;
  //   }
  // });

  // memberListsContainer.addEventListener("click", (e) => {
  //   const target = e.target.closest("button");
  //   if (!target) return;
  //   if (target.classList.contains("delete-member-btn")) {
  //     openConfirmDeleteModal(target.dataset.id, "member");
  //   } else if (target.classList.contains("edit-member-btn")) {
  //     // ▼▼▼ 追加：タイトルを「編集」に戻す ▼▼▼
  //     document.querySelector("#edit-member-modal h3").textContent =
  //       "部材の編集";

  //     openEditMemberModal(target.dataset.id);
  //   } else if (target.classList.contains("edit-joint-btn")) {
  //     const jointId = target.dataset.jointId;
  //     const project = state.projects.find(
  //       (p) => p.id === state.currentProjectId,
  //     );
  //     const joint = project?.joints.find((j) => j.id === jointId);
  //     if (joint) openEditModal(joint);
  //   }
  // });

  // // 列のロック状態を即座にUIに反映させるためのヘルパー関数
  // const updateColumnLockUI = (itemId, isLocked) => {
  //   const table = document.querySelector("#tally-sheet-container table");
  //   if (!table) return;

  //   // data-column-id を使って列全体のセルと入力を選択
  //   const cells = table.querySelectorAll(`[data-column-id="${itemId}"]`);
  //   const inputs = table.querySelectorAll(
  //     `input.tally-input[data-id="${itemId}"]`,
  //   );

  //   cells.forEach((cell) => {
  //     cell.classList.toggle("locked-column", isLocked);
  //   });
  //   inputs.forEach((input) => {
  //     input.disabled = isLocked;
  //   });
  // };

  // tallySheetContainer.addEventListener("change", (e) => {
  //   // ロック用チェックボックスが変更された時の処理
  //   if (e.target.classList.contains("tally-lock-checkbox")) {
  //     const project = state.projects.find(
  //       (p) => p.id === state.currentProjectId,
  //     );
  //     if (!project) return;
  //     const itemId = e.target.dataset.id;
  //     const isLocked = e.target.checked;

  //     // ブラウザ内のデータを即座に更新
  //     if (!project.tallyLocks) project.tallyLocks = {};
  //     project.tallyLocks[itemId] = isLocked;

  //     updateColumnLockUI(itemId, isLocked);

  //     const fieldPath = `tallyLocks.${itemId}`;

  //     updateProjectData(state.currentProjectId, {
  //       [fieldPath]: isLocked,
  //     }).catch((err) => {
  //       console.error("ロック状態の保存に失敗しました: ", err);
  //       showCustomAlert("ロック状態の保存に失敗しました。");
  //       e.target.checked = !isLocked;
  //       project.tallyLocks[itemId] = !isLocked; // 失敗時は戻す
  //       updateColumnLockUI(itemId, !isLocked);
  //     });
  //   }

  //   // 箇所数入力のセルが変更された時の処理
  //   if (e.target.classList.contains("tally-input")) {
  //     const project = state.projects.find(
  //       (p) => p.id === state.currentProjectId,
  //     );
  //     if (!project) return;
  //     const { location, id } = e.target.dataset;
  //     const fieldPath = `tally.${location}.${id}`;

  //     // 値をより厳密に取得・整形
  //     let valueStr = e.target.value.trim();
  //     valueStr = valueStr.replace(/[０-９]/g, (s) =>
  //       String.fromCharCode(s.charCodeAt(0) - 0xfee0),
  //     );

  //     const quantity = parseInt(valueStr, 10);

  //     // 1. ブラウザ内のデータ(state)を即座に更新
  //     if (!project.tally) project.tally = {};
  //     if (!project.tally[location]) project.tally[location] = {};

  //     if (valueStr === "" || isNaN(quantity)) {
  //       delete project.tally[location][id];
  //       e.target.value = ""; // 見た目もクリア
  //     } else {
  //       project.tally[location][id] = quantity;
  //       e.target.value = quantity; // 整形した数値を戻す
  //     }

  //     // 2. 箇所数入力の表の合計値を更新
  //     updateTallySheetCalculations(project);

  //     // 3. 全ての集計結果の表を再計算・再描画
  //     renderResults(project);

  //     // 4. 裏側でデータベースに保存
  //     const valueToSave = valueStr === "" || isNaN(quantity) ? null : quantity;
  //     updateProjectData(state.currentProjectId, {
  //       [fieldPath]: valueToSave,
  //     }).catch((err) => {
  //       showCustomAlert(`集計結果の保存に失敗`);
  //       console.error("Error updating tally: ", err);
  //     });
  //   }
  // });

  // ★ 修正版：継手の保存処理（新規・編集 両対応）
  // ★ 修正版：継手の保存処理（連続登録対応）
  // ★ 修正版：継手の保存処理（データ整合性確保・連続登録対応）
  // saveJointBtn.addEventListener("click", () => {
  //   const project = state.projects.find((p) => p.id === state.currentProjectId);
  //   const jointId = editJointIdInput.value; // 空なら新規
  //   if (!project) return;

  //   const oldJoint = jointId
  //     ? project.joints.find((j) => j.id === jointId)
  //     : {};

  //   // --- 入力値のチェック ---
  //   const type = editJointTypeInput.value;
  //   const name = editJointNameInput.value.trim();
  //   if (!name)
  //     return showCustomAlert("継手名を入力してください。", {
  //       invalidElements: [editJointNameInput],
  //     });

  //   // 新規登録時の名前重複チェック
  //   if (!jointId && project.joints.some((j) => j.name === name)) {
  //     return showCustomAlert(`継手名「${name}」は既に登録されています。`);
  //   }

  //   // ▼▼▼ 修正：継手の種類に応じてフラグを強制補正する ▼▼▼
  //   let isPin = editIsPinJointInput.checked;
  //   let isDoubleShear = editIsDoubleShearInput.checked;
  //   const tempSetting = editTempBoltSettingInput.value;
  //   let hasShopSpl = editHasShopSplInput.checked;
  //   let isComplexSpl = editIsComplexSplInput.checked;

  //   // ピン接合を持てるタイプ（これ以外は強制OFF）
  //   const pinCapableTypes = ["girder", "beam", "stud", "other"];
  //   if (!pinCapableTypes.includes(type)) {
  //     isPin = false;
  //     isDoubleShear = false;
  //     isComplexSpl = false; // 複合SPLも無効化
  //   }

  //   // 2面せん断がOFFなら、それに依存するオプションも整理
  //   if (!isPin) {
  //     isDoubleShear = false;
  //   }

  //   // 工場SPLを持てるタイプ
  //   const splCapableTypes = ["girder", "beam", "stud", "other"];
  //   if (!splCapableTypes.includes(type)) {
  //     hasShopSpl = false;
  //   }
  //   // ▲▲▲ 修正ここまで ▲▲▲

  //   if (isComplexSpl) {
  //     const splCount = parseInt(editComplexSplCountInput.value);
  //     const invalidElements = [];
  //     for (let i = 1; i <= splCount; i++) {
  //       const suffix = i > 1 ? `-${i}` : "";
  //       const sizeInput = document.getElementById(`edit-web-size${suffix}`);
  //       const countInput = document.getElementById(`edit-web-count${suffix}`);
  //       if (!sizeInput.value) invalidElements.push(sizeInput.parentElement);
  //       if (!countInput.value) invalidElements.push(countInput);
  //     }
  //     if (invalidElements.length > 0)
  //       return showCustomAlert(
  //         "複合型SPLのウェブサイズと本数をすべて入力してください。",
  //         { invalidElements },
  //       );
  //   }
  //   const webCountForValidation = isComplexSpl
  //     ? 0
  //     : parseInt(editWebCountInput.value) || 0;
  //   if (isPin && isDoubleShear && !isComplexSpl && webCountForValidation < 2) {
  //     return showCustomAlert(
  //       "2面せん断,シングルSPLの場合、ボルト本数は2本以上で入力してください。",
  //       { invalidElements: [editWebCountInput] },
  //     );
  //   }

  //   // --- データ作成 ---
  //   let updatedDataPayload = {
  //     ...oldJoint,
  //     id: jointId || `joint_${Date.now()}`,
  //     type,
  //     isPinJoint: isPin,
  //     isDoubleShear,
  //     hasShopSpl,
  //     hasBoltCorrection: hasShopSpl && editHasBoltCorrectionInput.checked,
  //     countAsMember: editCountAsMemberInput.checked,
  //     name: name,
  //     // ▼▼▼ 追加：色の保存（未設定フラグがあれば null） ▼▼▼
  //     color:
  //       editJointColorInput.dataset.isNull === "true"
  //         ? null
  //         : editJointColorInput.value,
  //     // ▲▲▲ 追加ここまで ▲▲▲
  //     // ★追加
  //     isBundledWithColumn:
  //       type !== "column" &&
  //       editIsBundledWithColumnInput &&
  //       editIsBundledWithColumnInput.checked,
  //     flangeSize: editFlangeSizeInput.value,
  //     flangeCount: parseInt(editFlangeCountInput.value) || 0,
  //     webSize: editWebSizeInput.value,
  //     webCount: parseInt(editWebCountInput.value) || 0,
  //     isComplexSpl,
  //     complexSplCount: isComplexSpl
  //       ? parseInt(editComplexSplCountInput.value)
  //       : null,
  //     webInputs: null,
  //     tempBoltSetting: type === "column" ? "none" : tempSetting,
  //     shopTempBoltCount:
  //       parseInt(document.getElementById("edit-shop-temp-bolt-count").value) ||
  //       null,
  //     shopTempBoltSize:
  //       document.getElementById("edit-shop-temp-bolt-size").value || null,
  //     shopTempBoltCount_F:
  //       parseInt(
  //         document.getElementById("edit-shop-temp-bolt-count-f").value,
  //       ) || null,
  //     shopTempBoltSize_F:
  //       document.getElementById("edit-shop-temp-bolt-size-f").value || null,
  //     shopTempBoltCount_W:
  //       parseInt(
  //         document.getElementById("edit-shop-temp-bolt-count-w").value,
  //       ) || null,
  //     shopTempBoltSize_W:
  //       document.getElementById("edit-shop-temp-bolt-size-w").value || null,
  //   };

  //   // サイズ情報のクリーンアップ
  //   if (isPin) {
  //     updatedDataPayload.flangeSize = "";
  //     updatedDataPayload.flangeCount = 0;
  //   } else if (["column", "wall_girt", "roof_purlin"].includes(type)) {
  //     updatedDataPayload.webSize = "";
  //     updatedDataPayload.webCount = 0;
  //   }

  //   if (isComplexSpl) {
  //     updatedDataPayload.webSize = "";
  //     updatedDataPayload.webCount = 0;
  //     updatedDataPayload.webInputs = Array.from(
  //       { length: parseInt(editComplexSplCountInput.value) },
  //       (_, i) => {
  //         const suffix = i === 0 ? "" : `-${i + 1}`;
  //         return {
  //           size:
  //             document.getElementById(`edit-web-size${suffix}`)?.value || "",
  //           count:
  //             parseInt(
  //               document.getElementById(`edit-web-count${suffix}`)?.value,
  //             ) || 0,
  //         };
  //       },
  //     );
  //   }

  //   // --- 保存実行 ---
  //   const performUpdate = (finalJointData, finalMembers) => {
  //     const projectIndex = state.projects.findIndex(
  //       (p) => p.id === state.currentProjectId,
  //     );
  //     if (projectIndex === -1) return;

  //     let newJointsList;
  //     if (jointId) {
  //       newJointsList = state.projects[projectIndex].joints.map((j) =>
  //         j.id === jointId ? finalJointData : j,
  //       );
  //     } else {
  //       newJointsList = [
  //         ...state.projects[projectIndex].joints,
  //         finalJointData,
  //       ];
  //     }

  //     state.projects[projectIndex].joints = newJointsList;
  //     if (finalMembers) {
  //       state.projects[projectIndex].members = finalMembers;
  //     }

  //     renderDetailView();

  //     if (jointId) {
  //       // 編集モードなら閉じる
  //       closeModal(editModal);
  //     } else {
  //       // 新規登録モードならリセットして継続
  //       resetJointForm();
  //       editJointIdInput.value = "";
  //       document.getElementById("edit-joint-name").focus();
  //     }

  //     let boltInfo = "";
  //     if (finalJointData.isComplexSpl && finalJointData.webInputs)
  //       boltInfo = finalJointData.webInputs
  //         .map((w) => `${w.size}/${w.count}本`)
  //         .join(", ");
  //     else if (finalJointData.isPinJoint)
  //       boltInfo = `${finalJointData.webSize} / ${finalJointData.webCount}本`;
  //     else if (
  //       ["column", "wall_girt", "roof_purlin"].includes(finalJointData.type)
  //     )
  //       boltInfo = `${finalJointData.flangeSize} / ${finalJointData.flangeCount}本`;
  //     else
  //       boltInfo = `F:${finalJointData.flangeSize}/${finalJointData.flangeCount}本, W:${finalJointData.webSize}/${finalJointData.webCount}本`;

  //     const actionWord = jointId ? "更新" : "登録";
  //     showToast(
  //       `継手「${finalJointData.name}」を${actionWord}しました (${boltInfo})`,
  //     );

  //     const updatePayload = { joints: newJointsList };
  //     if (finalMembers) updatePayload.members = finalMembers;

  //     updateProjectData(state.currentProjectId, updatePayload).catch((err) => {
  //       showCustomAlert(`継手の${actionWord}に失敗しました。`);
  //       console.error("保存失敗: ", err);
  //     });
  //   };

  //   if (
  //     jointId &&
  //     updatedDataPayload.countAsMember &&
  //     !oldJoint.countAsMember
  //   ) {
  //     const membersToDelete = (project.members || []).filter(
  //       (member) => member.jointId === jointId,
  //     );
  //     if (membersToDelete.length > 0) {
  //       const memberNames = membersToDelete
  //         .map((m) => `・${m.name}`)
  //         .join("<br>");
  //       confirmMemberDeletionMessage.innerHTML = `「部材としてカウント」をONにすると、紐付けられている以下の部材が削除されます。<br><strong class="text-red-600">${memberNames}</strong>`;
  //       const updatedMembers = (project.members || []).filter(
  //         (member) => member.jointId !== jointId,
  //       );
  //       state.pendingAction = () => {
  //         performUpdate(updatedDataPayload, updatedMembers);
  //         closeModal(confirmMemberDeletionModal);
  //       };
  //       openModal(confirmMemberDeletionModal);
  //       return;
  //     }
  //   }

  //   performUpdate(updatedDataPayload);
  // });
  // // ★ 修正版：部材の保存処理（新規・編集 両対応）
  // // ★ 修正版：部材保存（階層情報保存対応）
  // // ★ 修正版：部材の保存処理（新規登録時の連続入力対応）
  // saveMemberBtn.addEventListener("click", () => {
  //   const project = state.projects.find((p) => p.id === state.currentProjectId);
  //   const memberId = editMemberIdInput.value; // 空なら新規
  //   if (!project) return;

  //   const newName = editMemberNameInput.value.trim();
  //   const newJointId = editMemberJointSelect.value;
  //   if (!newName)
  //     return showCustomAlert("部材名を入力してください。", {
  //       invalidElements: [editMemberNameInput],
  //     });
  //   if (!newJointId)
  //     return showCustomAlert("使用する継手を選択してください。", {
  //       invalidElements: [editMemberJointSelect],
  //     });

  //   // チェックされた階層を取得
  //   const checkedLevels = Array.from(
  //     document.querySelectorAll(".level-checkbox:checked"),
  //   ).map((cb) => cb.value);

  //   // 手順A: ローカルデータの更新
  //   let newMembersList;
  //   if (memberId) {
  //     // 更新
  //     const member = project.members.find((m) => m.id === memberId);
  //     if (member) {
  //       member.name = newName;
  //       member.jointId = newJointId;
  //       member.targetLevels = checkedLevels; // 保存
  //     }
  //     newMembersList = project.members;
  //   } else {
  //     // 新規登録
  //     const newMember = {
  //       id: `member_${Date.now()}`,
  //       name: newName,
  //       jointId: newJointId,
  //       targetLevels: checkedLevels, // 保存
  //     };
  //     newMembersList = [...(project.members || []), newMember];
  //     const projectIndex = state.projects.findIndex(
  //       (p) => p.id === state.currentProjectId,
  //     );
  //     if (projectIndex !== -1)
  //       state.projects[projectIndex].members = newMembersList;
  //   }

  //   renderDetailView();

  //   const actionWord = memberId ? "更新" : "登録";
  //   showToast(`部材「${newName}」を${actionWord}しました`);

  //   // ▼▼▼ 修正：新規登録時はモーダルを閉じずにリセット ▼▼▼
  //   if (memberId) {
  //     // 編集モード：閉じる
  //     closeModal(editMemberModal);
  //   } else {
  //     // 新規登録モード：リセットして継続
  //     editMemberNameInput.value = "";

  //     // 連続入力の利便性を考慮し、継手選択と階層チェックは維持します。
  //     // 名前だけ変えて次々登録するケースが多いためです。
  //     // もし全てリセットしたい場合は以下のコメントアウトを外してください。
  //     /*
  //           editMemberJointSelect.value = '';
  //           document.querySelectorAll('.level-checkbox').forEach(cb => cb.checked = false);
  //           */

  //     // 名前入力欄にフォーカスを戻す
  //     editMemberNameInput.focus();
  //   }
  //   // ▲▲▲ 修正ここまで ▲▲▲

  //   updateProjectData(state.currentProjectId, {
  //     members: newMembersList,
  //   }).catch((err) => {
  //     showCustomAlert("部材の保存に失敗しました。");
  //     console.error("保存失敗: ", err);
  //   });
  // });
  // ▼▼▼【ここに新しいコードを貼り付け】▼▼▼
  // confirmDeleteBtn.addEventListener("click", () => {
  //   const id = deleteIdInput.value;
  //   const type = deleteTypeInput.value;
  //   const projectId = state.currentProjectId;
  //   const confirmDeleteModal = document.getElementById("confirm-delete-modal");
  //   // ▼ パターン1：プロジェクト自体の削除
  //   if (type === "project") {
  //     // ★ db.js の関数を使う（パス指定が不要になりスッキリ！）
  //     deleteProject(id).catch((err) =>
  //       showCustomAlert("工事の削除に失敗しました。"),
  //     );

  //     closeModal(confirmDeleteModal);
  //     return;
  //   }

  //   const projectIndex = state.projects.findIndex((p) => p.id === projectId);
  //   if (projectIndex === -1) {
  //     closeModal(confirmDeleteModal);
  //     return;
  //   }
  //   let updateData = {};
  //   let deletedItemName = "";

  //   // --- ここからが楽観的UIのロジックです ---

  //   if (type === "joint") {
  //     const joint = state.projects[projectIndex].joints.find(
  //       (j) => j.id === id,
  //     );
  //     if (joint) deletedItemName = joint.name;

  //     // 手順A: ブラウザ内のデータ（state）を先に書き換えます
  //     const updatedJoints = state.projects[projectIndex].joints.filter(
  //       (j) => j.id !== id,
  //     );
  //     state.projects[projectIndex].joints = updatedJoints;
  //     updateData = { joints: updatedJoints };
  //     showToast(`継手「${deletedItemName}」を削除しました。`);
  //   } else if (type === "member") {
  //     const member = state.projects[projectIndex].members.find(
  //       (m) => m.id === id,
  //     );
  //     if (member) deletedItemName = member.name;

  //     // 手順A: ブラウザ内のデータ（state）を先に書き換えます
  //     const updatedMembers = (
  //       state.projects[projectIndex].members || []
  //     ).filter((m) => m.id !== id);
  //     state.projects[projectIndex].members = updatedMembers;
  //     updateData = { members: updatedMembers };
  //     showToast(`部材「${deletedItemName}」を削除しました。`);
  //   }

  //   // 手順B: 書き換えたデータで、画面を即座に再描画します
  //   renderDetailView();
  //   // 手順C: モーダルを閉じます
  //   closeModal(confirmDeleteModal);

  //   // 手順D: 裏側で、データベースへの保存処理を実行します
  //   // ▼ パターン2：データベースへの保存処理
  //   if (Object.keys(updateData).length > 0) {
  //     // ★ db.js の関数を使う
  //     updateProjectData(projectId, updateData).catch((err) => {
  //       showCustomAlert(
  //         "削除に失敗しました。ページをリロードして確認してください。",
  //       );
  //       console.error("削除に失敗:", err);
  //     });
  //   }
  // });
  // ▲▲▲【新しいコードはここまで】▲▲▲

  // resultsCard.addEventListener("click", (e) => {
  //   const project = state.projects.find((p) => p.id === state.currentProjectId);
  //   if (!project) return;

  //   if (e.target.closest("#recalculate-btn")) {
  //     const newTally = {};
  //     const inputs = document.querySelectorAll(".tally-input");
  //     inputs.forEach((input) => {
  //       const quantity = parseInt(input.value) || 0;
  //       if (quantity > 0) {
  //         const { location, id } = input.dataset;
  //         if (!newTally[location]) newTally[location] = {};
  //         newTally[location][id] = quantity;
  //       }
  //     });

  //     project.tally = newTally;
  //     renderResults(project);

  //     updateProjectData(state.currentProjectId, { tally: newTally }).catch(
  //       (err) => {
  //         // 万が一失敗した時だけアラートを出す
  //         console.error("Error saving full tally:", err);
  //         showCustomAlert("保存に失敗しました。リロードしてください。");
  //       },
  //     );

  //     showCustomAlert("結果を更新しました。", {
  //       title: "成功",
  //       type: "success",
  //     });
  //   }

  //   if (e.target.closest("#export-excel-btn")) {
  //     const { resultsByLocation, allBoltSizes } = calculateResults(project);
  //     if (allBoltSizes.size === 0) {
  //       return showCustomAlert(
  //         "集計表にデータがないため、Excelファイルを出力できません。",
  //       );
  //     }
  //     const wb = XLSX.utils.book_new();
  //     const tallyList = getTallyList(project);
  //     const typeNameMap = {
  //       girder: "大梁",
  //       beam: "小梁",
  //       column: "本柱",
  //       stud: "間柱",
  //       wall_girt: "胴縁",
  //       roof_purlin: "母屋",
  //       other: "その他",
  //     };
  //     const tallyHeaders = [
  //       "階層 / エリア",
  //       ...tallyList.map((item) => {
  //         let typeName = typeNameMap[item.joint.type] || "不明";
  //         if (item.joint.isPinJoint) typeName += "(ピン取り)";
  //         return `${item.name}(${typeName})`;
  //       }),
  //     ];
  //     const tallyData = [tallyHeaders];
  //     let locations = [];
  //     if (project.mode === "advanced") {
  //       project.customLevels.forEach((level) =>
  //         project.customAreas.forEach((area) =>
  //           locations.push({
  //             id: `${level}-${area}`,
  //             label: `${level} - ${area}`,
  //           }),
  //         ),
  //       );
  //     } else {
  //       for (let f = 2; f <= project.floors; f++) {
  //         for (let s = 1; s <= project.sections; s++)
  //           locations.push({ id: `${f}-${s}`, label: `${f}階 ${s}工区` });
  //       }
  //       for (let s = 1; s <= project.sections; s++)
  //         locations.push({ id: `R-${s}`, label: `R階 ${s}工区` });
  //       if (project.hasPH) {
  //         for (let s = 1; s <= project.sections; s++)
  //           locations.push({ id: `${s}-${s}`, label: `PH階 ${s}工区` });
  //       }
  //     }
  //     locations.forEach((loc) => {
  //       const row = [loc.label];
  //       tallyList.forEach((item) => {
  //         const count = project.tally?.[loc.id]?.[item.id] || null;
  //         row.push(count);
  //       });
  //       tallyData.push(row);
  //     });
  //     const tallySheet = XLSX.utils.aoa_to_sheet(tallyData);
  //     XLSX.utils.book_append_sheet(wb, tallySheet, "箇所数シート");

  //     const sortedSizes = Array.from(allBoltSizes).sort();
  //     const summaryHeaders = ["ボルトサイズ"];
  //     const summaryColumns = [];
  //     locations.forEach((loc) =>
  //       summaryColumns.push({ id: loc.id, label: loc.label }),
  //     );
  //     summaryHeaders.push(...summaryColumns.map((c) => c.label), "総合計");
  //     const summaryData = [summaryHeaders];

  //     sortedSizes.forEach((size) => {
  //       let grandTotal = 0;
  //       const row = [size];
  //       summaryColumns.forEach((col) => {
  //         // ▼▼▼ 修正：オブジェクトから数値(.total)を取り出す ▼▼▼
  //         const cellData = resultsByLocation[col.id]?.[size];
  //         const count = cellData ? cellData.total : 0;

  //         grandTotal += count;
  //         // 0の場合は空欄(null)にして見やすくする
  //         row.push(count > 0 ? count : null);
  //         // ▲▲▲ 修正ここまで ▲▲▲
  //       });
  //       row.push(grandTotal);
  //       summaryData.push(row);
  //     });

  //     const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  //     XLSX.utils.book_append_sheet(wb, summarySheet, "ボルト集計シート");
  //     XLSX.writeFile(
  //       wb,
  //       `${project.name}_ボルト集計_${new Date()
  //         .toISOString()
  //         .slice(0, 10)}.xlsx`,
  //     );
  //   }
  //   // ▼▼▼【ここから追加】▼▼▼
  //   // 注文明細の表示切替ボタンがクリックされた時の処理
  //   if (e.target.closest("#toggle-order-view-btn")) {
  //     // --- デバッグ用のメッセージをコンソールに出力します ---
  //     console.log("「表示切替」ボタンがクリックされました！ (メッセージ1)");

  //     // 1. 表示モードの状態を切り替える
  //     state.orderDetailsView =
  //       state.orderDetailsView === "location" ? "section" : "location";
  //     console.log(
  //       "新しい表示モード: ",
  //       state.orderDetailsView,
  //       "(メッセージ2)",
  //     );

  //     // 2. 注文明細エリアだけを新しい表示モードで再描画する
  //     const { resultsByLocation } = calculateResults(project);
  //     const container = document.getElementById("order-details-container");
  //     if (container) {
  //       console.log("コンテナを見つけました。HTMLを更新します。(メッセージ3)");
  //       container.innerHTML = renderOrderDetails(project, resultsByLocation);
  //     } else {
  //       // もしコンテナが見つからない場合は、エラーメッセージを出します
  //       console.error("【エラー】 order-details-container が見つかりません！");
  //     }

  //     // ▼▼▼ 追加: 仮ボルト注文明細の再描画 ▼▼▼
  //     const tempContainer = document.getElementById(
  //       "temp-order-details-container",
  //     );
  //     if (tempContainer) {
  //       renderTempOrderDetails(tempContainer, project);
  //     }
  //     // ▲▲▲ 追加ここまで ▲▲▲
  //   }

  //   // ▼▼▼ 追加：仮ボルト注文明細の表示切替ボタン ▼▼▼
  //   if (e.target.closest("#toggle-temp-order-view-btn")) {
  //     // 1. 表示モードの状態を切り替える (state.tempOrderDetailsView を使用)
  //     state.tempOrderDetailsView =
  //       state.tempOrderDetailsView === "location" ? "section" : "location";

  //     // 2. 仮ボルト注文明細エリアだけを再描画する
  //     const tempContainer = document.getElementById(
  //       "temp-order-details-container",
  //     );
  //     if (tempContainer) {
  //       renderTempOrderDetails(tempContainer, project);
  //     }
  //   }

  //   // ▼▼▼ 追加：工区まとめ設定（チェックボックス）のイベントリスナー ▼▼▼
  //   if (e.target.matches("#temp-order-group-all-checkbox")) {
  //     // ステートを更新
  //     state.tempOrderDetailsGroupAll = e.target.checked;

  //     // 再描画
  //     const tempContainer = document.getElementById(
  //       "temp-order-details-container",
  //     );
  //     if (tempContainer) {
  //       renderTempOrderDetails(tempContainer, project);
  //     }
  //   }
  //   // ▲▲▲ 追加ここまで ▲▲▲

  //   // ▼▼▼ 追加：グループ化キー（ラジオボタン）のイベントリスナー ▼▼▼
  //   if (e.target.matches('input[name="temp-order-group-key"]')) {
  //     // ステートを更新
  //     state.tempOrderDetailsGroupKey = e.target.value;

  //     // 再描画
  //     const tempContainer = document.getElementById(
  //       "temp-order-details-container",
  //     );
  //     if (tempContainer) {
  //       renderTempOrderDetails(tempContainer, project);
  //     }
  //   }
  //   // ▲▲▲ 追加ここまで ▲▲▲
  //   // ▲▲▲ 追加ここまで ▲▲▲
  //   // ▲▲▲【ここまで追加】▲▲▲
  // });

  // // ★ 修正版：工事情報の保存処理（ハイフン付き階層名対応・即時反映）
  // saveProjectBtn.addEventListener("click", () => {
  //   const projectId = editProjectIdInput.value;
  //   const project = state.projects.find((p) => p.id === projectId);
  //   if (!project) return;

  //   const newName = editProjectNameInput.value.trim();
  //   const newPropertyName = document
  //     .getElementById("edit-property-name")
  //     .value.trim();
  //   if (!newName)
  //     return showCustomAlert("工事名を入力してください。", {
  //       invalidElements: [editProjectNameInput],
  //     });

  //   const performUpdate = (projectData) => {
  //     const projectIndex = state.projects.findIndex((p) => p.id === projectId);
  //     if (projectIndex !== -1) {
  //       state.projects[projectIndex] = {
  //         ...state.projects[projectIndex],
  //         ...projectData,
  //       };
  //     }
  //     updateProjectListUI();

  //     updateProjectData(state.currentProjectId, projectData).catch((err) => {
  //       console.error("工事情報の保存に失敗:", err);
  //       showCustomAlert("工事情報の保存に失敗しました。");
  //     });

  //     closeModal(editProjectModal);
  //     levelNameCache = [];
  //     areaNameCache = [];
  //     showToast(`工事情報を更新しました。`);
  //   };

  //   let updatedProjectData = { name: newName, propertyName: newPropertyName };

  //   if (project.mode === "advanced") {
  //     const newLevels = Array.from(
  //       document.querySelectorAll("#edit-custom-levels-container input"),
  //     ).map((i) => i.value.trim());
  //     const newAreas = Array.from(
  //       document.querySelectorAll("#edit-custom-areas-container input"),
  //     ).map((i) => i.value.trim());

  //     if (newLevels.includes("") || newAreas.includes("")) {
  //       const invalidInputs = [
  //         ...document.querySelectorAll(
  //           "#edit-custom-levels-container input, #edit-custom-areas-container input",
  //         ),
  //       ].filter((i) => i.value.trim() === "");
  //       showCustomAlert(
  //         "階層またはエリア名が空白です。すべての項目を入力してください。",
  //         { invalidElements: invalidInputs },
  //       );
  //       return;
  //     }

  //     const oldLevels = project.customLevels || [];
  //     const oldAreas = project.customAreas || [];

  //     updatedProjectData.customLevels = newLevels;
  //     updatedProjectData.customAreas = newAreas;

  //     // 箇所数データ(tally)のキーを、フロア・エリアの「順番」に基づいて更新する
  //     const newTally = {};
  //     const oldTally = project.tally || {};

  //     // 古いフロア名/エリア名と、その「順番(index)」をマップ化
  //     const oldLevelIndexMap = new Map(oldLevels.map((level, i) => [level, i]));
  //     const oldAreaIndexMap = new Map(oldAreas.map((area, i) => [area, i]));

  //     // ▼▼▼ 修正：階層名のマッチングロジックを強化（ハイフン対応） ▼▼▼
  //     // 長い名前順にソートしておくことで、前方一致の誤判定（例: "B-1" と "B"）を防ぐ
  //     const sortedOldLevels = [...oldLevels].sort(
  //       (a, b) => b.length - a.length,
  //     );

  //     for (const oldKey in oldTally) {
  //       // 単純な split('-') ではなく、登録済みの階層名で前方一致判定を行う
  //       let oldLevelName = null;
  //       let oldAreaName = null;

  //       for (const level of sortedOldLevels) {
  //         // キーが "LevelName-" で始まっているかチェック
  //         if (oldKey.startsWith(level + "-")) {
  //           oldLevelName = level;
  //           // 残りの部分をエリア名とする
  //           oldAreaName = oldKey.substring(level.length + 1);
  //           break;
  //         }
  //       }

  //       // マッチする階層名が見つからなかった場合（通常ありえないが念のため）
  //       if (!oldLevelName || !oldAreaName) continue;

  //       const levelIndex = oldLevelIndexMap.get(oldLevelName);
  //       const areaIndex = oldAreaIndexMap.get(oldAreaName);

  //       if (
  //         levelIndex !== undefined &&
  //         areaIndex !== undefined &&
  //         levelIndex < newLevels.length &&
  //         areaIndex < newAreas.length
  //       ) {
  //         const newLevelName = newLevels[levelIndex];
  //         const newAreaName = newAreas[areaIndex];
  //         const newKey = `${newLevelName}-${newAreaName}`;
  //         newTally[newKey] = oldTally[oldKey];
  //       }
  //     }
  //     // ▲▲▲ 修正ここまで ▲▲▲

  //     updatedProjectData.tally = newTally;

  //     const tallyDataToDeleteKeys = [];
  //     const oldTallyForDeletionCheck = project.tally || {};

  //     if (
  //       oldLevels.length > newLevels.length ||
  //       oldAreas.length > newAreas.length
  //     ) {
  //       for (const key in oldTallyForDeletionCheck) {
  //         // 削除確認用も同様のロジックで判定
  //         let level = null;
  //         let area = null;
  //         for (const lvl of sortedOldLevels) {
  //           if (key.startsWith(lvl + "-")) {
  //             level = lvl;
  //             area = key.substring(lvl.length + 1);
  //             break;
  //           }
  //         }

  //         if (level && area) {
  //           if (!newLevels.includes(level) || !newAreas.includes(area)) {
  //             tallyDataToDeleteKeys.push(key);
  //           }
  //         }
  //       }
  //     }

  //     if (tallyDataToDeleteKeys.length > 0) {
  //       const removedItems = [
  //         ...oldLevels.filter((l) => !newLevels.includes(l)),
  //         ...oldAreas.filter((a) => !newAreas.includes(a)),
  //       ];
  //       document.getElementById("confirm-action-title").textContent =
  //         "箇所数データの削除確認";
  //       confirmActionMessage.innerHTML = `階層またはエリアの数を減らしたため、以下の項目に関連する箇所数データが削除されます。よろしいですか？<br><br><strong class="text-red-600">${removedItems.join(
  //         "、",
  //       )}</strong>`;

  //       state.pendingAction = () => performUpdate(updatedProjectData);
  //       openModal(confirmActionModal);
  //       return;
  //     }
  //   } else {
  //     updatedProjectData.floors = parseInt(editProjectFloorsInput.value);
  //     updatedProjectData.sections = parseInt(editProjectSectionsInput.value);
  //     updatedProjectData.hasPH = editProjectHasPhInput.checked;
  //   }

  //   performUpdate(updatedProjectData);
  // });
  // --- ここから追加 ---

  // ▼▼▼ 追加：カラーピッカーの制御 ▼▼▼
  // editJointColorInput.addEventListener("input", () => {
  //   editJointColorInput.dataset.isNull = "false"; // 色を選んだら有効化
  // });

  // clearJointColorBtn.addEventListener("click", () => {
  //   editJointColorInput.value = "#ffffff";
  //   editJointColorInput.dataset.isNull = "true"; // 未設定状態にする
  // });

  // 確認モーダルの登録ボタンの処理も修正
  // ▼▼▼以下のコードに置き換え▼▼▼
  // confirmAddBtn.addEventListener("click", () => {
  //   if (state.tempJointData) {
  //     const jointData = state.tempJointData;
  //     const projectIndex = state.projects.findIndex(
  //       (p) => p.id === state.currentProjectId,
  //     );
  //     if (projectIndex !== -1) {
  //       // 手順A: ブラウザ内のデータを先に書き換える
  //       const updatedJoints = [
  //         ...state.projects[projectIndex].joints,
  //         jointData,
  //       ];
  //       state.projects[projectIndex].joints = updatedJoints;

  //       // 手順B: 画面を即座に再描画する
  //       renderDetailView();

  //       // 手順C: ユーザーに完了を通知し、フォームをリセット
  //       let boltInfo = "";
  //       if (jointData.isComplexSpl && jointData.webInputs)
  //         boltInfo = jointData.webInputs
  //           .map((w) => `${w.size}/${w.count}本`)
  //           .join(", ");
  //       else if (jointData.isPinJoint)
  //         boltInfo = `${jointData.webSize} / ${jointData.webCount}本`;
  //       else if (
  //         ["column", "wall_girt", "roof_purlin"].includes(jointData.type)
  //       )
  //         boltInfo = `${jointData.flangeSize} / ${jointData.flangeCount}本`;
  //       else
  //         boltInfo = `F:${jointData.flangeSize}/${jointData.flangeCount}本, W:${jointData.webSize}/${jointData.webCount}本`;
  //       showToast(`継手「${jointData.name}」を登録しました (${boltInfo})`);
  //       resetJointForm();
  //       jointNameInput.focus();

  //       // 手順D: 裏側でデータベースに保存する
  //       updateProjectData(state.currentProjectId, {
  //         joints: updatedJoints,
  //       }).catch((err) => {
  //         showCustomAlert(
  //           "継手の追加に失敗しました。ページをリロードしてデータを確認してください。",
  //         );
  //         console.error("継手の追加に失敗: ", err);
  //       });
  //     }
  //   }
  //   closeModal(confirmAddModal);
  //   state.tempJointData = null;
  // });

  // // ▼▼▼ このイベントリスナーを追記 ▼▼▼
  // document.addEventListener("click", (e) => {
  //   // 「▼」ボタンがクリックされた時の処理
  //   if (e.target.classList.contains("bolt-select-trigger")) {
  //     openBoltSelectorModal(e.target.dataset.target);
  //   }
  //   // 読み取り専用の入力欄がクリックされた時の処理
  //   else if (e.target.classList.contains("modal-trigger-input")) {
  //     const triggerButton = e.target.nextElementSibling;
  //     if (triggerButton) {
  //       // 隣にある「▼」ボタンのクリックをプログラムが実行する
  //       triggerButton.click();
  //     }
  //   }
  // });
  // boltOptionsContainer.addEventListener("click", (e) => {
  //   if (
  //     e.target.classList.contains("bolt-option-btn") &&
  //     state.activeBoltTarget
  //   ) {
  //     state.activeBoltTarget.value = e.target.dataset.size;
  //     closeModal(boltSelectorModal);
  //   }
  // });

  // [
  //   navTabJoints,
  //   navTabTally,
  //   document.getElementById("mobile-nav-tab-joints"),
  //   document.getElementById("mobile-nav-tab-tally"),
  // ].forEach((tab) => {
  //   tab.addEventListener("click", (e) => {
  //     switchTab(e.target.dataset.tab);
  //     if (window.innerWidth < 768) {
  //       mobileMenu.classList.add("hidden");
  //     }
  //   });
  // });

  // hamburgerBtn.addEventListener("click", () => {
  //   mobileMenu.classList.toggle("hidden");
  // });

  // // デスクトップ用「物件一覧に戻る」ボタンのイベントリスナー
  // document
  //   .getElementById("nav-back-to-list-btn")
  //   .addEventListener("click", () => {
  //     state.currentProjectId = null;

  //     // ▼▼▼ 修正箇所 ▼▼▼
  //     resetMemberForm(); // フォームをリセット
  //     // ▲▲▲ 修正ここまで ▲▲▲

  //     switchView("list");
  //   });
  // // モバイル用「物件一覧に戻る」ボタンのイベントリスナー
  // document
  //   .getElementById("mobile-nav-back-to-list-btn")
  //   .addEventListener("click", () => {
  //     state.currentProjectId = null;

  //     // ▼▼▼ 修正箇所 ▼▼▼
  //     resetMemberForm(); // フォームをリセット
  //     // ▲▲▲ 修正ここまで ▲▲▲

  //     switchView("list");
  //   });

  // // ▼▼▼ Undo/Redoボタンのイベントリスナー ▼▼▼
  // //とりあえず以前の場所に記載、あとで改善の余地あり
  // const undoBtn = document.getElementById("undo-btn");
  // const redoBtn = document.getElementById("redo-btn");
  // const mobileUndoBtn = document.getElementById("mobile-undo-btn");
  // const mobileRedoBtn = document.getElementById("mobile-redo-btn");

  // [undoBtn, mobileUndoBtn].forEach((btn) => {
  //   if (btn) btn.addEventListener("click", () => performHistoryAction("undo"));
  // });
  // [redoBtn, mobileRedoBtn].forEach((btn) => {
  //   if (btn) btn.addEventListener("click", () => performHistoryAction("redo"));
  // });

  // 「▼」ボタンがクリックされた時の処理
  // openJointSelectorBtn.addEventListener("click", () => {
  //   const project = state.projects.find((p) => p.id === state.currentProjectId);
  //   // 現在選択されている継手のIDをhidden inputから取得します
  //   const currentJointId = memberJointSelectId.value;
  //   // 取得したIDを引数としてモーダル生成関数に渡します
  //   populateJointSelectorModal(project, currentJointId);
  //   openModal(jointSelectorModal);
  // });

  // // テキスト入力欄がクリックされた時に、上の「▼」ボタンのクリックを代行する処理
  // document
  //   .getElementById("member-joint-select-input")
  //   .addEventListener("click", () => {
  //     openJointSelectorBtn.click();
  //   });

  // // ▲▲▲ ここまでを追加 ▲▲▲
  // closeJointModalBtn.addEventListener("click", () =>
  //   closeModal(jointSelectorModal),
  // );

  // jointOptionsContainer.addEventListener("click", (e) => {
  //   if (e.target.classList.contains("joint-option-btn")) {
  //     const { id, name } = e.target.dataset;
  //     memberJointSelectInput.value = name;
  //     memberJointSelectId.value = id;
  //     closeModal(jointSelectorModal);
  //   }
  // });

  // openTempBoltMappingBtn.addEventListener("click", () => {
  //   const project = state.projects.find((p) => p.id === state.currentProjectId);
  //   populateTempBoltMappingModal(project);
  //   openModal(tempBoltMappingModal);
  // });

  // closeTempBoltMappingModalBtn.addEventListener("click", () =>
  //   closeModal(tempBoltMappingModal),
  // );

  // cancelTempBoltMappingBtn.addEventListener("click", () =>
  //   closeModal(tempBoltMappingModal),
  // );

  // const saveTempBoltMappingBtn = document.getElementById(
  //   "save-temp-bolt-mapping-btn",
  // );
  // saveTempBoltMappingBtn.addEventListener("click", () => {
  //   const newMap = {};
  //   const selects = tempBoltMappingContainer.querySelectorAll(
  //     ".temp-bolt-map-select",
  //   );

  //   selects.forEach((select) => {
  //     const finalBolt = select.dataset.finalBolt;
  //     const tempBolt = select.value;
  //     if (finalBolt && tempBolt) {
  //       newMap[finalBolt] = tempBolt;
  //     }
  //   });

  //   // ▼▼▼ ここからが修正箇所 ▼▼▼

  //   // 1. ローカルのstate（アプリが保持しているデータ）を即座に更新する
  //   const project = state.projects.find((p) => p.id === state.currentProjectId);
  //   if (project) {
  //     project.tempBoltMap = newMap;
  //   }

  //   // 2. 更新されたローカルstateを使って、UI（見た目）を即座に再描画する
  //   renderDetailView();

  //   // 3. UIの操作（モーダルを閉じる、通知を出す）を完了させる
  //   closeModal(tempBoltMappingModal);
  //   showToast("仮ボルト設定を保存しました。"); // 操作を妨げないトースト通知に変更

  //   // 4. 裏側で、データベースへの実際の保存処理を実行する
  //   updateProjectData(state.currentProjectId, { tempBoltMap: newMap }).catch(
  //     (err) => {
  //       // 万が一失敗した時だけアラートを出す
  //       console.error("仮ボルト設定の保存に失敗しました: ", err);
  //       showCustomAlert(
  //         "設定の保存に失敗しました。エラーが発生したため、リロードが必要な場合があります。",
  //       );
  //     },
  //   );

  //   // ▲▲▲ ここまでが修正箇所 ▲▲▲
  // });

  // advancedSettingsToggle.addEventListener("change", (e) => {
  //   simpleProjectSettings.classList.toggle("hidden", e.target.checked);
  //   advancedProjectSettings.classList.toggle("hidden", !e.target.checked);
  // });
  // addDecrementLevelsBtn.addEventListener("click", () =>
  //   updateDynamicInputs(
  //     addCustomLevelsCountInput,
  //     customLevelsContainer,
  //     newLevelNameCache,
  //     "custom-level",
  //     -1,
  //   ),
  // );
  // addIncrementLevelsBtn.addEventListener("click", () =>
  //   updateDynamicInputs(
  //     addCustomLevelsCountInput,
  //     customLevelsContainer,
  //     newLevelNameCache,
  //     "custom-level",
  //     1,
  //   ),
  // );
  // addDecrementAreasBtn.addEventListener("click", () =>
  //   updateDynamicInputs(
  //     addCustomAreasCountInput,
  //     customAreasContainer,
  //     newAreaNameCache,
  //     "custom-area",
  //     -1,
  //   ),
  // );
  // addIncrementAreasBtn.addEventListener("click", () =>
  //   updateDynamicInputs(
  //     addCustomAreasCountInput,
  //     customAreasContainer,
  //     newAreaNameCache,
  //     "custom-area",
  //     1,
  //   ),
  // );

  // confirmMemberDeletionBtn.addEventListener("click", () => {
  //   if (state.pendingUpdateData) {
  //     updateProjectData(state.currentProjectId, state.pendingUpdateData).catch(
  //       (err) => {
  //         // 万が一失敗した時だけアラートを出す
  //         console.error(err);
  //         showCustomAlert("保存に失敗しました。リロードしてください。");
  //       },
  //     );
  //   }
  // });

  // cancelMemberDeletionBtn.addEventListener("click", () => {
  //   closeModal(confirmMemberDeletionModal);
  //   state.pendingUpdateData = null;
  // });

  // [editCustomLevelsCountInput, editCustomAreasCountInput].forEach((input) => {
  //   input.addEventListener("keydown", (e) => {
  //     if (e.key === "Backspace" || e.key === "Delete") {
  //       e.preventDefault();
  //     }
  //   });
  // });

  // decrementLevelsBtn.addEventListener("click", () =>
  //   updateDynamicInputs(
  //     editCustomLevelsCountInput,
  //     editCustomLevelsContainer,
  //     levelNameCache,
  //     "edit-level",
  //     -1,
  //   ),
  // );
  // incrementLevelsBtn.addEventListener("click", () =>
  //   updateDynamicInputs(
  //     editCustomLevelsCountInput,
  //     editCustomLevelsContainer,
  //     levelNameCache,
  //     "edit-level",
  //     1,
  //   ),
  // );
  // decrementAreasBtn.addEventListener("click", () =>
  //   updateDynamicInputs(
  //     editCustomAreasCountInput,
  //     editCustomAreasContainer,
  //     areaNameCache,
  //     "edit-area",
  //     -1,
  //   ),
  // );
  // incrementAreasBtn.addEventListener("click", () =>
  //   updateDynamicInputs(
  //     editCustomAreasCountInput,
  //     editCustomAreasContainer,
  //     areaNameCache,
  //     "edit-area",
  //     1,
  //   ),
  // );

  confirmActionBtn.addEventListener("click", () => {
    if (typeof state.pendingAction === "function") {
      state.pendingAction();
    }
    state.pendingAction = null;
    closeModal(confirmActionModal);
  });

  cancelActionBtn.addEventListener("click", () => {
    state.pendingAction = null;
    closeModal(confirmActionModal);
  });

  // グループ集計結果をモーダルに描画する関数
  // --- 修正後の renderAggregatedResults 関数 ---

  // const renderAggregatedResults = (propertyName, aggregatedData) => {
  //   document.getElementById("aggregated-results-title").textContent =
  //     `「${propertyName}」集計結果`;
  //   const contentEl = document.getElementById("aggregated-results-content");
  //   let html = "";

  //   // 1. 本ボルトの表
  //   const sortedFinalSizes = Object.keys(aggregatedData.finalBolts).sort();
  //   if (sortedFinalSizes.length > 0) {
  //     html += `<h4 class="text-xl font-bold text-slate-800 dark:text-slate-200">本ボルト 合計本数</h4>
  //                <div class="overflow-x-auto custom-scrollbar"><table class="w-auto text-sm border-collapse">
  //                <thead class="bg-slate-200 dark:bg-slate-700"><tr>
  //                   <th class="px-3 py-2 border border-slate-300 dark:border-slate-600">ボルトサイズ</th>
  //                   <th class="px-3 py-2 border border-slate-300 dark:border-slate-600">合計本数</th>
  //                </tr></thead><tbody>`;
  //     sortedFinalSizes.forEach((size) => {
  //       const data = aggregatedData.finalBolts[size];
  //       const tooltipText = Object.entries(data.joints)
  //         .map(([name, count]) => `${name}: ${count.toLocaleString()}本`)
  //         .join("\n");

  //       // --- 変更点: モバイルタップ用のクラスとデータ属性を追加 ---
  //       const detailsJson = JSON.stringify(data.joints);
  //       const detailsClass =
  //         "has-details cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-800/50 transition-colors";
  //       const dataAttribute = `data-details='${detailsJson}'`;

  //       html += `<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
  //                       <td class="px-3 py-2 border border-slate-200 dark:border-slate-700">${size}</td>
  //                       <td class="px-3 py-2 border border-slate-200 dark:border-slate-700 text-center ${detailsClass}" title="${tooltipText}" ${dataAttribute}>
  //                           ${data.total.toLocaleString()}
  //                       </td>
  //                   </tr>`;
  //     });
  //     html += `</tbody></table></div>`;
  //   } else {
  //     html += `<h4 class="text-xl font-bold text-slate-800 dark:text-slate-200">本ボルト 合計本数</h4>
  //                <p class="text-slate-500">集計対象の本ボルトはありません。</p>`;
  //   }

  //   // 2. 仮ボルトの表 (こちらは元々数値のみなので大きな変更はなし)
  //   // --- renderAggregatedResults 関数内、"// 2. 仮ボルトの表" の部分を差し替え ---

  //   // 2. 仮ボルトの表
  //   const sortedTempSizes = Object.keys(aggregatedData.tempBolts).sort();
  //   if (sortedTempSizes.length > 0) {
  //     html += `<h4 class="text-xl font-bold text-slate-800 dark:text-slate-200 mt-6">現場使用 仮ボルト 合計本数</h4>
  //            <div class="overflow-x-auto custom-scrollbar"><table class="w-auto text-sm border-collapse">
  //            <thead class="bg-slate-200 dark:bg-slate-700"><tr>
  //               <th class="px-3 py-2 border border-slate-300 dark:border-slate-600">ボルトサイズ</th>
  //               <th class="px-3 py-2 border border-slate-300 dark:border-slate-600">合計本数</th>
  //            </tr></thead><tbody>`;
  //     sortedTempSizes.forEach((size) => {
  //       const data = aggregatedData.tempBolts[size];
  //       const tooltipText = Object.entries(data.joints)
  //         .map(([name, count]) => `${name}: ${count.toLocaleString()}本`)
  //         .join("\n");

  //       const detailsJson = JSON.stringify(data.joints);
  //       const detailsClass =
  //         "has-details cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-800/50 transition-colors";
  //       const dataAttribute = `data-details='${detailsJson}'`;

  //       html += `<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
  //                   <td class="px-3 py-2 border border-slate-200 dark:border-slate-700">${size}</td>
  //                   <td class="px-3 py-2 border border-slate-200 dark:border-slate-700 text-center ${detailsClass}" title="${tooltipText}" ${dataAttribute}>
  //                       ${data.total.toLocaleString()}
  //                   </td>
  //               </tr>`;
  //     });
  //     html += `</tbody></table></div>`;
  //   }

  //   // 3. 工場用仮ボルトの表
  //   const sortedShopSizes = Object.keys(aggregatedData.shopTempBolts).sort();
  //   if (sortedShopSizes.length > 0) {
  //     html += `<h4 class="text-xl font-bold text-slate-800 dark:text-slate-200 mt-6">工場使用 仮ボルト 合計本数</h4>
  //                <div class="overflow-x-auto custom-scrollbar"><table class="w-auto text-sm border-collapse">
  //                <thead class="bg-slate-200 dark:bg-slate-700"><tr>
  //                   <th class="px-3 py-2 border border-slate-300 dark:border-slate-600">ボルトサイズ</th>
  //                   <th class="px-3 py-2 border border-slate-300 dark:border-slate-600">合計本数</th>
  //                   <th class="px-3 py-2 border border-slate-300 dark:border-slate-600">関連継手</th>
  //                </tr></thead><tbody>`;
  //     sortedShopSizes.forEach((size) => {
  //       const data = aggregatedData.shopTempBolts[size];
  //       const jointNames = Array.from(data.joints).join(", ");
  //       html += `<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
  //                       <td class="px-3 py-2 border border-slate-200 dark:border-slate-700">${size}</td>
  //                       <td class="px-3 py-2 border border-slate-200 dark:border-slate-700 text-center">${data.total.toLocaleString()}</td>
  //                       <td class="px-3 py-2 border border-slate-200 dark:border-slate-700">${jointNames}</td>
  //                   </tr>`;
  //     });
  //     html += `</tbody></table></div>`;
  //   }

  //   contentEl.innerHTML = html;
  // };
  // 物件名一括保存ボタンの処理
  // 物件名一括保存ボタンの処理 (楽観的UIを適用)
  // document
  //   .getElementById("save-group-btn")
  //   .addEventListener("click", async () => {
  //     const oldName = document.getElementById("edit-group-old-name").value;
  //     const newName = document
  //       .getElementById("edit-group-new-name")
  //       .value.trim();

  //     const projectsToUpdate = state.projects.filter(
  //       (p) => p.propertyName === oldName,
  //     );

  //     if (projectsToUpdate.length === 0) {
  //       closeModal(document.getElementById("edit-group-modal"));
  //       return;
  //     }

  //     // ▼▼▼ ここからが修正箇所 ▼▼▼

  //     // 1. ローカルのstate（アプリが保持しているデータ）を即座に更新する
  //     projectsToUpdate.forEach((project) => {
  //       const localProject = state.projects.find((p) => p.id === project.id);
  //       if (localProject) {
  //         localProject.propertyName = newName;
  //       }
  //     });

  //     // 2. 更新されたローカルstateを使って、UI（物件一覧）を即座に再描画する
  //     updateProjectListUI();

  //     // 3. UIの操作（モーダルを閉じる）を完了させる
  //     closeModal(document.getElementById("edit-group-modal"));
  //     showToast(`物件名を「${newName}」に更新しました。`);

  //     // ▼▼▼ 4. 裏側でDB更新 (ここを修正) ▼▼▼

  //     // 更新対象のIDリストを作成
  //     const targetIds = projectsToUpdate.map((p) => p.id);

  //     // DB操作関数を呼び出す（awaitなしで、裏側実行）
  //     updateProjectPropertyNameBatch(targetIds, newName).catch((err) => {
  //       console.error("物件名の一括更新に失敗しました: ", err);
  //       showCustomAlert(
  //         "物件名の一括更新に失敗しました。ページをリロードしてデータを確認してください。",
  //       );
  //     });
  //     // ▲▲▲ ここまでが修正箇所 ▲▲▲
  //   });

  // // 新しいモーダルを閉じるためのイベントリスナー
  // document
  //   .getElementById("close-edit-group-modal-btn")
  //   .addEventListener("click", () =>
  //     closeModal(document.getElementById("edit-group-modal")),
  //   );
  // document
  //   .getElementById("cancel-edit-group-btn")
  //   .addEventListener("click", () =>
  //     closeModal(document.getElementById("edit-group-modal")),
  //   );
  // document
  //   .getElementById("close-aggregated-results-modal-btn")
  //   .addEventListener("click", () =>
  //     closeModal(document.getElementById("aggregated-results-modal")),
  //   );
  // --- App Initialization --- の直前にこのコードブロックを追加 ---

  // --- ここから追加 ---
  document.body.addEventListener("click", (e) => {
    if (e.target.id === "copy-tally-btn") {
      const table = document.querySelector("#tally-sheet-container table");
      if (!table) {
        showToast("コピー対象の表がありません。");
        return;
      }

      const data = [];
      const tHead = table.querySelector("thead");
      const tBody = table.querySelector("tbody");
      const tFoot = table.querySelector("tfoot");

      // ▼▼▼ ここからが修正箇所 ▼▼▼
      if (tHead) {
        const headerRows = tHead.querySelectorAll("tr");
        // 1行目のヘッダーを処理
        if (headerRows[0]) {
          const rowData = Array.from(headerRows[0].cells).map(
            (cell) => `"${cell.textContent.trim()}"`,
          );
          data.push(rowData.join("\t"));
        }
        // 2行目のヘッダーを処理
        if (headerRows[1]) {
          const rowData = Array.from(headerRows[1].cells).map(
            (cell) => `"${cell.textContent.trim()}"`,
          );
          // 先頭に空のセルを追加して、横ずれを補正
          rowData.unshift('""');
          data.push(rowData.join("\t"));
        }
      }
      // ▲▲▲ ここまでが修正箇所 ▲▲▲

      // 本体行を収集 (変更なし)
      if (tBody) {
        tBody.querySelectorAll("tr").forEach((tr) => {
          const rowData = Array.from(tr.cells).map((cell) => {
            const input = cell.querySelector("input");
            return `"${input ? input.value : cell.textContent.trim()}"`;
          });
          data.push(rowData.join("\t"));
        });
      }

      // フッター行を収集 (変更なし)
      if (tFoot) {
        tFoot.querySelectorAll("tr").forEach((tr) => {
          const rowData = Array.from(tr.cells).map(
            (cell) => `"${cell.textContent.trim()}"`,
          );
          data.push(rowData.join("\t"));
        });
      }

      const tsvString = data.join("\n");

      navigator.clipboard
        .writeText(tsvString)
        .then(() => {
          showToast("表のデータをクリップボードにコピーしました。");
        })
        .catch((err) => {
          console.error("コピーに失敗しました: ", err);
          showCustomAlert("クリップボードへのコピーに失敗しました。");
        });
    }
  });
  // --- ここまで追加 ---
  // --- ここまで追加 ---

  // --- App Initialization ---
  // --- ここから追加 ---

  // // 詳細表示モーダルを制御するイベントリスナー

  // resultsCard.addEventListener("click", (e) => {
  //   const targetCell = e.target.closest("td.has-details");
  //   if (!targetCell) return;

  //   try {
  //     const detailsData = JSON.parse(targetCell.dataset.details);
  //     const row = targetCell.closest("tr");
  //     const boltSize = row.querySelector("td:first-child").textContent;
  //     const isTotal =
  //       targetCell.textContent ===
  //       row.querySelector("td:last-child").textContent;

  //     const modalTitle = document.getElementById("details-modal-title");
  //     const modalContent = document.getElementById("details-modal-content");

  //     modalTitle.textContent = isTotal
  //       ? `${boltSize} の総合計内訳`
  //       : `${boltSize} の内訳`;

  //     let contentHtml = '<ul class="space-y-2 text-base">';
  //     const sortedJoints = Object.entries(detailsData).sort((a, b) =>
  //       a[0].localeCompare(b[0]),
  //     );

  //     for (const [name, count] of sortedJoints) {
  //       contentHtml += `
  //               <li class="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-2">
  //                   <span class="text-slate-700 dark:text-slate-300">${name}:</span>
  //                   <span class="font-bold text-lg text-slate-900 dark:text-slate-100">${count.toLocaleString()}本</span>
  //               </li>`;
  //     }
  //     contentHtml += "</ul>";

  //     modalContent.innerHTML = contentHtml;
  //     openModal(document.getElementById("details-modal"));
  //   } catch (err) {
  //     console.error("Failed to parse details data:", err);
  //   }
  // });

  // // 詳細表示モーダルを閉じるボタンのリスナー
  // document
  //   .getElementById("close-details-modal-btn")
  //   .addEventListener("click", () => {
  //     closeModal(document.getElementById("details-modal"));
  //   });

  // --- ここから追加 ---

  // // 物件ごとの集計結果モーダル用の詳細表示リスナー
  // const aggregatedResultsContent = document.getElementById(
  //   "aggregated-results-content",
  // );
  // aggregatedResultsContent.addEventListener("click", (e) => {
  //   const targetCell = e.target.closest("td.has-details");
  //   if (!targetCell) return;

  //   try {
  //     const detailsData = JSON.parse(targetCell.dataset.details);
  //     const row = targetCell.closest("tr");
  //     const boltSize = row.querySelector("td:first-child").textContent;

  //     const modalTitle = document.getElementById("details-modal-title");
  //     const modalContent = document.getElementById("details-modal-content");

  //     modalTitle.textContent = `${boltSize} の合計内訳`;

  //     let contentHtml = '<ul class="space-y-2 text-base">';
  //     const sortedJoints = Object.entries(detailsData).sort((a, b) =>
  //       a[0].localeCompare(b[0]),
  //     );

  //     for (const [name, count] of sortedJoints) {
  //       contentHtml += `
  //               <li class="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-2">
  //                   <span class="text-slate-700 dark:text-slate-300">${name}:</span>
  //                   <span class="font-bold text-lg text-slate-900 dark:text-slate-100">${count.toLocaleString()}本</span>
  //               </li>`;
  //     }
  //     contentHtml += "</ul>";

  //     modalContent.innerHTML = contentHtml;
  //     openModal(document.getElementById("details-modal"));
  //   } catch (err) {
  //     console.error("Failed to parse aggregated details data:", err);
  //   }
  // });

  // --- ここまで追加 ---

  // --- ここまで追加 ---
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
  // // --- Dark Mode Logic ---
  // const darkModeToggle = document.getElementById("dark-mode-toggle");
  // const mobileDarkModeToggle = document.getElementById(
  //   "mobile-dark-mode-toggle",
  // );

  // const applyTheme = (theme) => {
  //   if (theme === "dark") {
  //     document.documentElement.classList.add("dark");
  //     darkModeToggle.checked = true;
  //     mobileDarkModeToggle.checked = true;
  //   } else {
  //     document.documentElement.classList.remove("dark");
  //     darkModeToggle.checked = false;
  //     mobileDarkModeToggle.checked = false;
  //   }
  // };

  // const toggleTheme = () => {
  //   const currentTheme = localStorage.getItem("theme");
  //   if (currentTheme === "dark") {
  //     localStorage.setItem("theme", "light");
  //     applyTheme("light");
  //   } else {
  //     localStorage.setItem("theme", "dark");
  //     applyTheme("dark");
  //   }
  // };

  // darkModeToggle.addEventListener("change", toggleTheme);
  // mobileDarkModeToggle.addEventListener("change", toggleTheme);

  // // Apply theme on initial load
  // const savedTheme = localStorage.getItem("theme");
  // const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  // if (savedTheme) {
  //   applyTheme(savedTheme);
  // } else if (prefersDark) {
  //   applyTheme("dark");
  // } else {
  //   applyTheme("light");
  // }
  // --- Start Application ---
  // ▼▼▼ 追加：クイックナビゲーションの制御ロジック ▼▼▼
  // const quickNavContainer = document.getElementById("quick-nav-container");
  // const quickNavToggle = document.getElementById("quick-nav-toggle");
  // let isQuickNavOpen = false;

  // // FABボタンクリック：モーダルを開く
  // fabBulkAddMember.addEventListener("click", () => {
  //   toggleFab(false);
  //   const project = state.projects.find((p) => p.id === state.currentProjectId);

  //   // 継手が一つも登録されていない場合は警告を出して中断
  //   if (!project || project.joints.length === 0) {
  //     // showCustomAlert はこのファイルで定義されている前提
  //     return showCustomAlert("先に継手情報を登録してください。");
  //   }

  //   // 継手セレクトボックスの準備（既存の関数を再利用）
  //   populateJointDropdownForEdit(bulkMemberJointSelect, "");

  //   // ▼▼▼ 修正追加: 継手選択をリセットする（最初の継手を選択） ▼▼▼
  //   if (project.joints.length > 0) {
  //     bulkMemberJointSelect.value = project.joints[0].id;
  //   } else {
  //     bulkMemberJointSelect.value = "";
  //   }
  //   // ▲▲▲ 修正追加ここまで ▲▲▲

  //   // ▼▼▼ 必須の修正追加: 部材ごとの個別階層設定をリセットする ▼▼▼
  //   state.bulkMemberLevels = [];
  //   // ▲▲▲ 必須の修正追加ここまで ▲▲▲

  //   // 入力欄を初期化（最初の5つを再描画。この関数内で state.bulkMemberLevels の長さも調整されます）
  //   renderBulkMemberInputs(5);

  //   openModal(bulkAddMemberModal);
  // });
  // // 入力欄追加ボタン
  // addBulkInputBtn.addEventListener("click", () => {
  //   const currentCount = bulkMemberInputsContainer.children.length;
  //   if (currentCount >= 15) {
  //     showToast("一度に登録できるのは最大15件までです。");
  //     return;
  //   }

  //   // 現在の入力値を保持
  //   const currentValues = Array.from(
  //     document.querySelectorAll(".bulk-member-name-input"),
  //   ).map((input) => input.value);

  //   // 入力欄を再描画（+1個）
  //   renderBulkMemberInputs(currentCount + 1);

  //   // 値を復元
  //   const newInputs = document.querySelectorAll(".bulk-member-name-input");
  //   currentValues.forEach((val, index) => {
  //     if (newInputs[index]) newInputs[index].value = val;
  //   });
  // });

  // // index.html内の <script>
  // // ... (省略) ...
  // // 入力欄追加ボタン
  // addBulkInputBtn.addEventListener("click", () => {
  //   const currentCount = bulkMemberInputsContainer.children.length;
  //   if (currentCount >= 15) {
  //     showToast("一度に登録できるのは最大15件までです。");
  //     return;
  //   }

  //   // 現在の入力値と階層を保持
  //   const currentValues = Array.from(
  //     document.querySelectorAll(".bulk-member-name-input"),
  //   ).map((input) => input.value);

  //   // 入力欄を再描画（+1個）
  //   renderBulkMemberInputs(currentCount + 1);

  //   // 値を復元
  //   const newInputs = document.querySelectorAll(".bulk-member-name-input");
  //   currentValues.forEach((val, index) => {
  //     if (newInputs[index]) newInputs[index].value = val;
  //   });
  // });

  // // ▼▼▼ 新規追加: 部材ごとの階層選択モーダル制御ロジック ▼▼▼
  // bulkMemberInputsContainer.addEventListener("click", (e) => {
  //   const button = e.target.closest(".open-bulk-level-selector");
  //   if (button) {
  //     const project = state.projects.find(
  //       (p) => p.id === state.currentProjectId,
  //     );
  //     if (!project) return;

  //     state.activeBulkMemberIndex = parseInt(button.dataset.index, 10);
  //     const currentSelection =
  //       state.bulkMemberLevels[state.activeBulkMemberIndex] || [];
  //     const levels = getProjectLevels(project);

  //     bulkLevelOptionsContainer.innerHTML = "";

  //     // 全階層チェックボックス
  //     const allLevelLabel = document.createElement("label");
  //     allLevelLabel.className =
  //       "flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200 cursor-pointer border-b pb-2";
  //     const isAllChecked = currentSelection.length === 0;
  //     allLevelLabel.innerHTML = `<input type="checkbox" id="bulk-level-select-all" class="h-4 w-4 rounded border-gray-300 text-blue-800 focus:ring-yellow-500" ${
  //       isAllChecked ? "checked" : ""
  //     }> 全階層を対象にする`;
  //     bulkLevelOptionsContainer.appendChild(allLevelLabel);

  //     // 個別階層チェックボックス
  //     levels.forEach((lvl) => {
  //       const isChecked = currentSelection.includes(lvl.id) || isAllChecked;
  //       const label = document.createElement("label");
  //       label.className = "flex items-center gap-2 text-sm cursor-pointer ml-3";
  //       label.innerHTML = `<input type="checkbox" value="${
  //         lvl.id
  //       }" class="bulk-level-checkbox-option h-4 w-4 rounded border-gray-300 text-blue-800 focus:ring-yellow-500" ${
  //         isChecked ? "checked" : ""
  //       } ${isAllChecked ? "disabled" : ""}> ${lvl.label}`;
  //       bulkLevelOptionsContainer.appendChild(label);
  //     });

  //     // 全階層チェックボックスの連動
  //     document
  //       .getElementById("bulk-level-select-all")
  //       .addEventListener("change", (e) => {
  //         const isChecked = e.target.checked;
  //         bulkLevelOptionsContainer
  //           .querySelectorAll(".bulk-level-checkbox-option")
  //           .forEach((cb) => {
  //             cb.checked = isChecked;
  //             cb.disabled = isChecked;
  //           });
  //       });

  //     openModal(bulkLevelSelectorModal);
  //   }
  // });

  // // 階層選択モーダル：決定ボタン
  // saveBulkLevelBtn.addEventListener("click", () => {
  //   // ▼▼▼ 修正追加: 現在の部材名入力値を取得する ▼▼▼
  //   const currentMemberNames = Array.from(
  //     document.querySelectorAll(".bulk-member-name-input"),
  //   ).map((input) => input.value);
  //   // ▲▲▲ 修正追加ここまで ▲▲▲

  //   const selectAll = document.getElementById("bulk-level-select-all").checked;
  //   let newSelection = [];

  //   if (!selectAll) {
  //     newSelection = Array.from(
  //       bulkLevelOptionsContainer.querySelectorAll(
  //         ".bulk-level-checkbox-option:checked",
  //       ),
  //     ).map((cb) => cb.value);
  //   }

  //   // グローバル状態を更新
  //   if (state.activeBulkMemberIndex !== -1) {
  //     state.bulkMemberLevels[state.activeBulkMemberIndex] = newSelection;
  //   }

  //   // UIを再描画して変更を反映
  //   // ▼▼▼ 修正: 取得した部材名リストを引数として渡す ▼▼▼
  //   renderBulkMemberInputs(
  //     bulkMemberInputsContainer.children.length,
  //     currentMemberNames,
  //   );
  //   // ▲▲▲ 修正ここまで ▲▲▲

  //   // モーダルを閉じる
  //   closeModal(bulkLevelSelectorModal);
  //   state.activeBulkMemberIndex = -1;
  // });

  // // 階層選択モーダル：閉じる
  // closeBulkLevelModalBtn.addEventListener("click", () => {
  //   closeModal(bulkLevelSelectorModal);
  //   state.activeBulkMemberIndex = -1;
  // });
  // // ▲▲▲ 新規追加: 部材ごとの階層選択モーダル制御ロジック ▲▲▲

  // // 保存ボタン
  // saveBulkMemberBtn.addEventListener("click", () => {
  //   const project = state.projects.find((p) => p.id === state.currentProjectId);
  //   if (!project) return;

  //   const jointId = bulkMemberJointSelect.value;
  //   if (!jointId)
  //     return showCustomAlert("使用する継手を選択してください。", {
  //       invalidElements: [bulkMemberJointSelect],
  //     });

  //   const nameInputs = document.querySelectorAll(".bulk-member-name-input");

  //   const newMembers = [];
  //   const timestamp = Date.now();

  //   // 入力された名前と、対応する階層設定を収集
  //   nameInputs.forEach((input, index) => {
  //     const name = input.value.trim();
  //     const targetLevels = state.bulkMemberLevels[index] || []; // グローバル配列から階層を取得

  //     if (name) {
  //       newMembers.push({
  //         id: `member_${timestamp}_${index}`,
  //         name: name,
  //         jointId: jointId,
  //         targetLevels: targetLevels,
  //       });
  //     }
  //   });

  //   if (newMembers.length === 0) {
  //     return showCustomAlert("少なくとも1つの部材名を入力してください。", {
  //       invalidElements: [nameInputs[0]],
  //     });
  //   }

  //   // 楽観的UI更新
  //   const updatedMembersList = [...(project.members || []), ...newMembers];
  //   const projectIndex = state.projects.findIndex(
  //     (p) => p.id === state.currentProjectId,
  //   );
  //   if (projectIndex !== -1)
  //     state.projects[projectIndex].members = updatedMembersList;

  //   renderDetailView();

  //   // モーダルを閉じて通知
  //   closeModal(bulkAddMemberModal);
  //   const jointName =
  //     bulkMemberJointSelect.options[bulkMemberJointSelect.selectedIndex].text;
  //   showToast(
  //     `${newMembers.length}件の部材を一括登録しました (継手: ${jointName})`,
  //   );

  //   // データベース保存
  //   updateProjectData(state.currentProjectId, { members: newMembers }).catch(
  //     (err) => {
  //       // 万が一失敗した時だけアラートを出す
  //       console.error(err);
  //       showCustomAlert("保存に失敗しました。リロードしてください。");
  //     },
  //   );
  // });

  // // 閉じるボタン等
  // [closeBulkAddMemberModalBtn, cancelBulkAddMemberBtn].forEach((btn) => {
  //   btn.addEventListener("click", () => closeModal(bulkAddMemberModal));
  // });
  // // ▲▲▲ 追加ここまで ▲▲▲

  // quickNavToggle.addEventListener("click", (e) => {
  //   e.stopPropagation(); // 親への伝播を止める（documentのclickで閉じないように）
  //   toggleQuickNav();
  // });

  // // メニューの外側をクリックしたら閉じる
  // document.addEventListener("click", (e) => {
  //   if (isQuickNavOpen && !quickNavContainer.contains(e.target)) {
  //     toggleQuickNav();
  //   }
  // });

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

  // // モーダル要素を取得してドラッグ可能にする
  // const modals = [
  //   document.getElementById("edit-joint-modal"),
  //   document.getElementById("edit-member-modal"),
  //   document.getElementById("bulk-add-member-modal"),
  //   document.getElementById("temp-bolt-mapping-modal"),
  // ];

  // modals.forEach((modal) => {
  //   if (modal) {
  //     makeDraggable(modal);
  //   }
  // });
  // if ("serviceWorker" in navigator) {
  //   window.addEventListener("load", () => {
  //     navigator.serviceWorker
  //       .register("sw.js")
  //       .then((reg) => console.log("SW registered!", reg))
  //       .catch((err) => console.log("SW registration failed:", err));
  //   });
  // }

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
  // --- Excel風の入力補助機能 最終版 (ハイライト、十字キー・Enter移動、クリック制御) ---
  // --- Excel風の入力補助機能 最終版 v3 (十字キー移動対応) ---
  // --- Excel風の入力補助機能 最終確定版 v5 ---
  //const tallySheetContainer = document.getElementById('tally-sheet-container');

  // if (tallySheetContainer) {
  //   let isEditing = false;

  //   const clearHighlights = () => {
  //     tallySheetContainer
  //       .querySelectorAll(".cell-highlight, .cell-selected")
  //       .forEach((el) => {
  //         el.classList.remove("cell-highlight", "cell-selected");
  //       });
  //   };

  //   const applyHighlightAndSelect = (targetInputElement) => {
  //     clearHighlights();
  //     if (!targetInputElement) return;
  //     const cell = targetInputElement.closest("td");
  //     if (!cell) return;
  //     const colIndex = cell.cellIndex;
  //     const row = cell.parentElement;
  //     const table = targetInputElement.closest("table");

  //     // ▼▼▼ ここから修正 ▼▼▼
  //     // 1. 行全体と、特に1列目のセルをハイライトする
  //     if (row) {
  //       row.classList.add("cell-highlight");
  //       // 1列目のセルにも明示的にクラスを適用して黄色表示を優先させる
  //       if (row.cells[0]) {
  //         row.cells[0].classList.add("cell-highlight");
  //       }
  //       // ▼▼▼ 追加：一番右側のセル（行合計）もハイライトする ▼▼▼
  //       const lastCellIndex = row.cells.length - 1;
  //       if (row.cells[lastCellIndex]) {
  //         row.cells[lastCellIndex].classList.add("cell-highlight");
  //       }
  //       // ▲▲▲ 追加ここまで ▲▲▲
  //     }

  //     // 2. 列全体（ヘッダー3行を含む）をハイライトする
  //     if (table && colIndex > 0) {
  //       const thead = table.querySelector("thead");
  //       if (thead) {
  //         // ヘッダー1行目：ロック用チェックボックスのセル
  //         if (thead.rows[0] && thead.rows[0].cells[colIndex]) {
  //           thead.rows[0].cells[colIndex].classList.add("cell-highlight");
  //         }
  //         // ヘッダー2行目：部材名のセル
  //         if (thead.rows[1] && thead.rows[1].cells[colIndex - 1]) {
  //           thead.rows[1].cells[colIndex - 1].classList.add("cell-highlight");
  //         }
  //         // ヘッダー3行目：ボルトサイズのセル
  //         if (thead.rows[2] && thead.rows[2].cells[colIndex - 1]) {
  //           thead.rows[2].cells[colIndex - 1].classList.add("cell-highlight");
  //         }
  //       }

  //       // 本体とフッターのセル
  //       table.querySelectorAll("tbody tr, tfoot tr").forEach((tableRow) => {
  //         if (tableRow.cells[colIndex]) {
  //           tableRow.cells[colIndex].classList.add("cell-highlight");
  //         }
  //       });
  //     }
  //     // ▲▲▲ ここまで修正 ▲▲▲

  //     cell.classList.add("cell-selected");
  //   };

  //   // --- イベントリスナー ---

  //   tallySheetContainer.addEventListener("dblclick", (e) => {
  //     if (e.target.classList.contains("tally-input")) {
  //       isEditing = true;
  //       e.target.setSelectionRange(
  //         e.target.value.length,
  //         e.target.value.length,
  //       );
  //     }
  //   });

  //   tallySheetContainer.addEventListener("focusin", (e) => {
  //     if (e.target.classList.contains("tally-input")) {
  //       applyHighlightAndSelect(e.target);
  //       e.target.select();
  //       isEditing = false;
  //     }
  //   });

  //   tallySheetContainer.addEventListener("focusout", (e) => {
  //     setTimeout(() => {
  //       if (!tallySheetContainer.contains(document.activeElement)) {
  //         clearHighlights();
  //       }
  //     }, 0);
  //   });

  //   // ★ 修正版：全角数字を半角に、それ以外の文字（全角・記号含む）を削除
  //   tallySheetContainer.addEventListener("input", (e) => {
  //     if (e.target.classList.contains("tally-input")) {
  //       const target = e.target;
  //       let val = target.value;

  //       // 1. 全角数字を半角に変換
  //       val = val.replace(/[０-９]/g, (s) =>
  //         String.fromCharCode(s.charCodeAt(0) - 0xfee0),
  //       );

  //       // 2. 数字以外（スペース、全角文字、記号など）をすべて削除
  //       // ※ マイナス記号(-)も不要であれば削除対象に含めています
  //       const newVal = val.replace(/[^0-9]/g, "");

  //       // 値が変わっている場合のみ更新（カーソル位置飛び防止のため）
  //       if (val !== newVal) {
  //         target.value = newVal;
  //       }
  //     }
  //   });

  //   // ... 既存の keydown イベントリスナーの後 ...

  //   // --- ここから追加 ---
  //   // ドラッグ＆ドロップによる数値移動の確認機能
  //   tallySheetContainer.addEventListener("dragstart", (e) => {
  //     if (e.target.classList.contains("tally-input") && !e.target.disabled) {
  //       dragSourceElement = e.target;
  //       e.dataTransfer.effectAllowed = "move";
  //     }
  //   });

  //   tallySheetContainer.addEventListener("dragover", (e) => {
  //     // ドロップを許可するために、デフォルトの動作をキャンセル
  //     if (e.target.classList.contains("tally-input") && !e.target.disabled) {
  //       e.preventDefault();
  //     }
  //   });

  //   tallySheetContainer.addEventListener("dragend", (e) => {
  //     // ドラッグ操作が終了した際（ドロップされなかった場合など）にリセット
  //     dragSourceElement = null;
  //   });

  //   tallySheetContainer.addEventListener("drop", (e) => {
  //     e.preventDefault();
  //     const dropTargetElement = e.target;

  //     // ドラッグ元が存在し、有効なドロップ先（別の入力可能なセル）であるかを確認
  //     if (
  //       !dragSourceElement ||
  //       !dropTargetElement ||
  //       !dropTargetElement.classList.contains("tally-input") ||
  //       dropTargetElement === dragSourceElement ||
  //       dropTargetElement.disabled
  //     ) {
  //       dragSourceElement = null;
  //       return;
  //     }

  //     const sourceValue = dragSourceElement.value || "(空)";
  //     const targetValue = dropTargetElement.value || "(空)";

  //     document.getElementById("confirm-action-title").textContent =
  //       "数値の移動確認";
  //     document.getElementById("confirm-action-message").innerHTML =
  //       `セルからセルへ数値を移動しますか？<br><br>
  //               移動元セルの値: <strong class="text-blue-600 dark:text-blue-400">${sourceValue}</strong><br>
  //               移動先セルの値: <strong class="text-red-600 dark:text-red-400">${targetValue}</strong> (この値は上書きされます)`;

  //     // 確認モーダルの「実行する」が押された時の動作を定義
  //     state.pendingAction = () => {
  //       // 移動を実行
  //       dropTargetElement.value = dragSourceElement.value;
  //       dragSourceElement.value = "";

  //       // 変更をアプリケーションに通知し、合計値の再計算や保存をトリガーする
  //       dragSourceElement.dispatchEvent(new Event("change", { bubbles: true }));
  //       dropTargetElement.dispatchEvent(new Event("change", { bubbles: true }));

  //       dragSourceElement = null; // 完了後にリセット
  //     };

  //     openModal(document.getElementById("confirm-action-modal"));
  //   });
  //   // --- ここまで追加 ---

  //   // ★ 最終決定版：キーボード操作（IME強制クリア・行き止まり維持・Excel挙動）
  //   tallySheetContainer.addEventListener("keydown", (e) => {
  //     if (!e.target.classList.contains("tally-input")) return;

  //     const key = e.key;
  //     const code = e.code;
  //     const target = e.target;
  //     const isComposing = e.isComposing; // IME入力中かどうか

  //     // --- 1. スペースキーで値をクリア (IME強制中断ロジック) ---
  //     if (code === "Space" || key === " " || key === "Spacebar") {
  //       e.preventDefault(); // ブラウザ標準動作を停止
  //       e.stopPropagation();

  //       // ★重要：IME変換窓が出ないように、一度フォーカスを外してIMEを殺す
  //       target.blur();

  //       // 値をクリア
  //       target.value = "";
  //       isEditing = true;

  //       // 変更を保存
  //       target.dispatchEvent(new Event("input", { bubbles: true }));
  //       target.dispatchEvent(new Event("change", { bubbles: true }));

  //       // フォーカスを戻して入力可能な状態にする
  //       // (blurで外れたので、微小な遅延を入れて戻すのが確実)
  //       setTimeout(() => {
  //         target.focus();
  //       }, 0);

  //       return;
  //     }

  //     // --- 2. 十字キーとEnterキーの移動ロジック ---
  //     const moveKeys = [
  //       "ArrowUp",
  //       "ArrowDown",
  //       "ArrowLeft",
  //       "ArrowRight",
  //       "Enter",
  //     ];
  //     if (moveKeys.includes(key)) {
  //       // 【左右キー】全角入力中(IME有効)は、文字変換の文節移動などに使うため移動しない
  //       if (isComposing && (key === "ArrowLeft" || key === "ArrowRight")) {
  //         return;
  //       }

  //       // 【Enterキー】全角入力中(IME有効)は、文字確定に使うため移動しない
  //       if (isComposing && key === "Enter") {
  //         return;
  //       }

  //       // 上下キーは、全角入力中でも「確定して移動」とみなす（Excelライク）
  //       e.preventDefault();

  //       // 現在のセルを Blur させることで値を確定
  //       target.blur();

  //       // --- 移動先を探す ---
  //       const table = target.closest("table");
  //       const tbody = table.querySelector("tbody");
  //       if (!tbody) return;

  //       const rows = Array.from(tbody.querySelectorAll("tr"));
  //       const currentRow = target.closest("tr");
  //       const currentIndex = rows.indexOf(currentRow);
  //       const currentCell = target.closest("td");
  //       const currentCellIndex = currentCell.cellIndex;

  //       let nextInput = null;

  //       if (key === "ArrowUp") {
  //         for (let i = currentIndex - 1; i >= 0; i--) {
  //           const input = rows[i].cells[currentCellIndex]?.querySelector(
  //             ".tally-input:not([disabled])",
  //           );
  //           if (input) {
  //             nextInput = input;
  //             break;
  //           }
  //         }
  //       } else if (key === "ArrowDown" || key === "Enter") {
  //         for (let i = currentIndex + 1; i < rows.length; i++) {
  //           const input = rows[i].cells[currentCellIndex]?.querySelector(
  //             ".tally-input:not([disabled])",
  //           );
  //           if (input) {
  //             nextInput = input;
  //             break;
  //           }
  //         }
  //       } else if (key === "ArrowLeft") {
  //         for (let i = currentCellIndex - 1; i >= 0; i--) {
  //           const input = currentRow.cells[i]?.querySelector(
  //             ".tally-input:not([disabled])",
  //           );
  //           if (input) {
  //             nextInput = input;
  //             break;
  //           }
  //         }
  //       } else if (key === "ArrowRight") {
  //         for (let i = currentCellIndex + 1; i < currentRow.cells.length; i++) {
  //           const input = currentRow.cells[i]?.querySelector(
  //             ".tally-input:not([disabled])",
  //           );
  //           if (input) {
  //             nextInput = input;
  //             break;
  //           }
  //         }
  //       }

  //       // --- 移動実行 or 維持 ---

  //       // IME確定後の値コピーバグを防ぐため、移動は非同期で行う
  //       setTimeout(() => {
  //         if (nextInput) {
  //           // 移動先がある場合
  //           nextInput.focus();
  //           nextInput.select();
  //         } else {
  //           // 行き止まりの場合
  //           // フォーカスを再設定して維持し、変更イベントを発火
  //           target.focus(); // ★ここを追加（迷子防止）
  //           target.select();
  //           target.dispatchEvent(new Event("change", { bubbles: true }));
  //         }
  //       }, 0);

  //       return;
  //     }

  //     // --- 3. Escapeキー ---
  //     if (key === "Escape") {
  //       e.preventDefault();
  //       isEditing = false;
  //       target.blur();
  //       return;
  //     }

  //     // --- 4. 入力開始 ---
  //     const isCharacterKey =
  //       !e.ctrlKey && !e.altKey && !e.metaKey && key.length === 1;
  //     if (isCharacterKey) {
  //       isEditing = true;
  //     }
  //   });
  // }

  // ▼▼▼ 追加：タブ切り替えイベントリスナーの登録 ▼▼▼
  // const tabJoints = document.getElementById("nav-tab-joints");
  // const tabTally = document.getElementById("nav-tab-tally");
  // const mobileTabJoints = document.getElementById("mobile-nav-tab-joints");
  // const mobileTabTally = document.getElementById("mobile-nav-tab-tally");

  // if (tabJoints) tabJoints.addEventListener("click", () => switchTab("joints"));
  // if (tabTally) tabTally.addEventListener("click", () => switchTab("tally"));
  // if (mobileTabJoints)
  //   mobileTabJoints.addEventListener("click", () => switchTab("joints"));
  // if (mobileTabTally)
  //   mobileTabTally.addEventListener("click", () => switchTab("tally"));
  // ▲▲▲ 追加ここまで ▲▲▲
}); // document.addEventListener('DOMContentLoaded', ...) の終わり
