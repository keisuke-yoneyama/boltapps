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
  getBoltWeight,
  boltSort,
  getProjectLevels,
  getMasterOrderedKeys,
  aggregateByFloor,
  calculateAggregatedData,
  calculateResults,
  getTallyList,
  getTempBoltInfo,
  calculateTempBoltResults,
  calculateShopTempBoltResults,
  calculateAggregatedResults,
} from "./modules/calculator.js";

import {
  appId,
  auth,
  db,
  isDevelopmentEnvironment,
} from "./modules/firebase.js";

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
  renderColorPalette,
  updateJointFormUI,
  openEditModal,
  renderStaticColorPalette,
  toggleFab,
  updateQuickNavVisibility,
  populateJointDropdownForEdit,
  renderAggregatedTables,
  makeDraggable,
  populateGlobalBoltSelectorModal,
  renderOrderDetails,
} from "./modules/ui.js";

import {
  subscribeToProjects,
  addProject,
  deleteProject,
  updateProjectData,
  getProjectById,
  setProjectData,
  getAllProjects,
  updateProjectPropertyNameBatch,
  getGlobalSettings,
  saveGlobalSettings,
} from "./modules/db.js";

import { setupEventListeners } from "./modules/events.js";

import { state } from "./modules/state.js";
// let state = {
//   projects: [],
//   currentProjectId: null,
//   activeBoltTarget: null,
//   tempJointData: null,
//   activeTab: "joints",
//   scrollPositions: { joints: 0, tally: 0 },
//   pendingAction: null,
//   pendingUpdateData: null,
//   scrollPositions: { joints: 0, tally: 0 },
//   // ▼▼▼ この行を追加 ▼▼▼
//   orderDetailsView: "location", // 'location' または 'section'
//   // ▼▼▼ 追加：タブの選択状態管理 ▼▼▼
//   activeMemberLevel: "all", // 部材リスト用 ('all' または 階層ID)
//   activeTallyLevel: "all", // 箇所数入力用 ('all' または 階層ID)
//   tempOrderDetailsView: "section", // 'location' or 'section'
//   tempOrderDetailsGroupAll: false, // 工区まとめ設定 (true=全工区まとめ, false=工区別)
//   tempOrderDetailsGroupKey: "section", // 'section' (工区別) or 'floor' (フロア別)
//   // ▲▲▲ 追加ここまで ▲▲▲
//   // ▼▼▼ 追記: 個別の階層設定を保持する配列 ▼▼▼
//   bulkMemberLevels: [], // 部材ごとの階層ID配列を格納する配列
//   activeBulkMemberIndex: -1, // 現在階層を選択中の部材のインデックス
//   // ▲▲▲ 追記ここまで ▲▼▼
//   // ▼▼▼ 追加：ソート状態の管理 ▼▼▼
//   // ▼▼▼ 修正：ソート状態をセクションごとに管理するためのオブジェクト ▼▼▼
//   sort: {}, // { 'sectionId': { key: 'name', order: 'asc' }, ... }
//   // ▲▲▲ 修正ここまで ▲▲▲
//   // ▲▲▲ 追加ここまで ▲▲▲
//   pendingAction: null,
//   pendingUpdateData: null,
//   // ▼▼▼ 追加：グローバルボルトサイズ設定 ▼▼▼
//   globalBoltSizes: [],
//   // ▲▲▲ 追加ここまで ▲▲▲
// };
// ▼▼▼ この1行を追記 ▼▼▼
let focusToRestore = null;
let justFinishedIME = false;
// let db, auth, projectsCollectionRef,
let unsubscribeProjects;
const MAX_HISTORY_SIZE = 21;
let history = { stack: [], currentIndex: -1 };
let isUndoRedoOperation = false;
let levelNameCache = []; //★Ui.jsに移動中
let areaNameCache = []; //★Ui.jsに移動中
let newLevelNameCache = [];
let newAreaNameCache = [];
// let newComplexSplCache = Array.from({ length: 4 }, () => ({
//   size: "",
//   count: "",
// }));
// let editComplexSplCache = Array.from({ length: 4 }, () => ({
//   size: "",
//   count: "",
// }));
let dragSourceElement = null;

// const renderComplexSplInputs = (count, cache, isModal) => {
// for (let i = 1; i <= 4; i++) {
//   const prefix = isModal ? "edit-" : "";

//   // ▼▼▼ ここからが修正箇所 ▼▼▼
//   // モーダルと通常フォームでIDの命名規則が異なる問題を吸収
//   let groupId;
//   if (isModal && i === 1) {
//     groupId = "edit-web-group"; // モーダルの1つ目のグループID
//   } else {
//     const baseId = `${prefix}web-input-group`;
//     groupId = i > 1 ? `${baseId}-${i}` : baseId;
//   }
//   // ▲▲▲ ここまでが修正箇所 ▲▲▲

//   const group = document.getElementById(groupId);
//   const sizeInput = document.getElementById(
//     `${prefix}web-size${i > 1 ? "-" + i : ""}`
//   );
//   const countInput = document.getElementById(
//     `${prefix}web-count${i > 1 ? "-" + i : ""}`
//   );

//   if (group && sizeInput && countInput) {
//     if (i <= count) {
//       group.classList.remove("hidden");
//       sizeInput.value = cache[i - 1]?.size || "";
//       countInput.value = cache[i - 1]?.count || "";
//     } else {
//       group.classList.add("hidden");
//     }
//   }
// }
// };
// const updateComplexSplCount = (countInputElement, cache, isModal, change) => {
//   let newCount = parseInt(countInputElement.value) + change;
//   if (newCount < 2) newCount = 2;
//   if (newCount > 4) newCount = 4;
//   countInputElement.value = newCount;
//   renderComplexSplInputs(newCount, cache, isModal);
// };

// const makeDraggable = (modalElement) => {
//   const header = modalElement.querySelector(".border-b"); // ヘッダー部分をハンドルにする
//   if (!header) return;

//   header.style.cursor = "move"; // マウス用カーソル
//   header.style.touchAction = "none"; // タッチ時のスクロールを無効化（ドラッグ優先）

//   let isDragging = false;
//   let startX, startY, initialLeft, initialTop;

//   // --- 共通処理：ドラッグ開始 ---
//   const startDrag = (clientX, clientY) => {
//     isDragging = true;
//     startX = clientX;
//     startY = clientY;

//     // 現在の位置を取得
//     const rect = modalElement.getBoundingClientRect();

//     // CSSのtransformによる中央揃えを解除し、絶対座標に変換して固定する
//     // (これを行わないとドラッグ時に座標がズレたり、初期位置に戻ったりするため)
//     if (modalElement.style.transform !== "none") {
//       modalElement.style.left = `${rect.left}px`;
//       modalElement.style.top = `${rect.top}px`;
//       modalElement.style.transform = "none";
//       modalElement.style.bottom = "auto";
//       modalElement.style.right = "auto";
//     }

//     // style.left/top が未設定（初期状態）の場合は rect の値を使う
//     initialLeft = parseInt(modalElement.style.left || rect.left);
//     initialTop = parseInt(modalElement.style.top || rect.top);
//   };

//   // --- 共通処理：ドラッグ中 ---
//   const moveDrag = (clientX, clientY) => {
//     if (!isDragging) return;
//     const dx = clientX - startX;
//     const dy = clientY - startY;
//     modalElement.style.left = `${initialLeft + dx}px`;
//     modalElement.style.top = `${initialTop + dy}px`;
//   };

//   // --- 共通処理：ドラッグ終了 ---
//   const endDrag = () => {
//     isDragging = false;
//   };

//   // --- マウスイベントの設定 ---
//   header.addEventListener("mousedown", (e) => startDrag(e.clientX, e.clientY));
//   document.addEventListener("mousemove", (e) => {
//     if (isDragging) {
//       e.preventDefault(); // テキスト選択などを防止
//       moveDrag(e.clientX, e.clientY);
//     }
//   });
//   document.addEventListener("mouseup", endDrag);

//   // --- タッチイベントの設定（追加部分）---
//   header.addEventListener(
//     "touchstart",
//     (e) => {
//       if (e.touches.length === 1) {
//         const touch = e.touches[0];
//         startDrag(touch.clientX, touch.clientY);
//       }
//     },
//     { passive: false },
//   );

//   document.addEventListener(
//     "touchmove",
//     (e) => {
//       if (isDragging && e.touches.length === 1) {
//         e.preventDefault(); // 画面スクロールを防止してドラッグを優先
//         const touch = e.touches[0];
//         moveDrag(touch.clientX, touch.clientY);
//       }
//     },
//     { passive: false },
//   );

//   document.addEventListener("touchend", endDrag);
// };
// const openModal = (modalElement) => {
//   modalElement.classList.remove("hidden");

//   if (modalElement.classList.contains("modeless")) {
//     // フローティングの場合：透明な幕を表示してクリックをブロック（スクロールは効く）
//     const backdrop = document.getElementById("modeless-backdrop");
//     if (backdrop) backdrop.classList.remove("hidden");
//   } else {
//     // 通常モーダルの場合：bodyのスクロールを止める
//     document.body.classList.add("overflow-hidden");
//   }

//   setTimeout(() => modalElement.classList.remove("opacity-0"), 10);
// };

// ==========================================
// ▼ 注文明細：工区合算＆マスタ順表示機能（修正完了版） ▼
// ==========================================

// // グルーピング状態を保持する変数
// let currentGroupingState = {};
// // 表示モードを保持する変数
// let currentViewMode = "detailed";

// /**
//  * 工区まとめ設定UIを描画する関数（修正版：リセットボタン付き）
//  */
// function renderGroupingControls(container, originalResults, project, onUpdate) {
//   // 現在の開閉状態を保存（再描画時に引き継ぐため）
//   const existingDetails = container.querySelector("details");
//   const wasOpen = existingDetails ? existingDetails.open : false; // デフォルトはfalse

//   container.innerHTML = "";

//   // フロアモード時は非表示
//   if (currentViewMode === "floor") {
//     container.style.display = "none";
//     return;
//   }
//   container.style.display = "block";

//   // マスタ順のキーリストを取得
//   const masterKeys = getMasterOrderedKeys(project);
//   const targetKeys = masterKeys.filter((k) => originalResults[k]);

//   // 折りたたみ可能なコンテナ
//   const details = document.createElement("details");
//   details.className =
//     "mb-6 bg-blue-50 dark:bg-slate-800/60 rounded-xl border border-blue-100 dark:border-slate-700 shadow-sm group";
//   details.open = wasOpen;

//   // ヘッダー部分
//   const summary = document.createElement("summary");
//   summary.className =
//     "flex items-center justify-between p-4 cursor-pointer list-none select-none hover:bg-blue-100/50 dark:hover:bg-slate-700/50 rounded-xl transition-colors";

//   summary.innerHTML = `
//         <div class="flex items-center gap-3">
//             <div class="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400">
//                 <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
//                 </svg>
//             </div>
//             <div>
//                 <h4 class="text-sm font-bold text-slate-800 dark:text-slate-100">工区まとめ設定</h4>
//                 <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
//                     詳細モード用：同じ番号を選択した工区を合算します
//                 </p>
//             </div>
//         </div>
//         <div class="transform transition-transform duration-200 group-open:rotate-180 text-slate-400">
//             <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
//             </svg>
//         </div>
//     `;

//   // 中身のエリア
//   const content = document.createElement("div");
//   content.className =
//     "px-4 pb-4 border-t border-blue-100 dark:border-slate-700 pt-4";

//   // ★リセットボタンエリア
//   const actionArea = document.createElement("div");
//   actionArea.className = "flex justify-end mb-3";

//   const resetBtn = document.createElement("button");
//   resetBtn.type = "button";
//   resetBtn.className =
//     "px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors text-slate-600 dark:text-slate-300 flex items-center gap-1";
//   resetBtn.innerHTML = `
//         <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
//         </svg>
//         設定をリセット
//     `;

//   // リセット処理：連番（1, 2, 3...）に戻す
//   resetBtn.onclick = (e) => {
//     e.stopPropagation(); // summaryが閉じないように
//     targetKeys.forEach((key, index) => {
//       currentGroupingState[key] = index + 1;
//     });
//     onUpdate();
//   };

//   actionArea.appendChild(resetBtn);
//   content.appendChild(actionArea);

//   // ドロップダウンリスト表示
//   const controlsGrid = document.createElement("div");
//   controlsGrid.className = "flex flex-wrap gap-2";

//   const maxOptions = targetKeys.length;

//   targetKeys.forEach((section) => {
//     const item = document.createElement("div");
//     item.className =
//       "w-28 bg-white dark:bg-slate-800 p-2 rounded-lg border border-gray-200 dark:border-slate-600 flex flex-col";

//     const label = document.createElement("span");
//     label.className =
//       "text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 truncate text-center";
//     label.textContent = section;
//     label.title = section;

//     const select = document.createElement("select");
//     select.className =
//       "w-full text-sm py-1 px-1 bg-gray-50 dark:bg-slate-700 border-gray-300 dark:border-slate-500 rounded focus:ring-blue-500 focus:border-blue-500 dark:text-white cursor-pointer text-center";

//     for (let i = 1; i <= maxOptions; i++) {
//       const option = document.createElement("option");
//       option.value = i;
//       option.textContent = `No.${i}`;
//       if (currentGroupingState[section] === i) {
//         option.selected = true;
//       }
//       select.appendChild(option);
//     }

//     select.addEventListener("change", (e) => {
//       currentGroupingState[section] = Number(e.target.value);
//       onUpdate();
//     });

//     select.addEventListener("click", (e) => e.stopPropagation());

//     item.appendChild(label);
//     item.appendChild(select);
//     controlsGrid.appendChild(item);
//   });

//   content.appendChild(controlsGrid);
//   details.appendChild(summary);
//   details.appendChild(content);
//   container.appendChild(details);
// }
/**
 * 注文詳細画面の描画（修正版：トップ余白を mt-8 に統一）
 */
// const renderOrderDetails = (container, project, resultsByLocation) => {
//   if (!container) return;
//   if (!project) {
//     container.innerHTML = "";
//     return;
//   }

//   try {
//     container.innerHTML = ""; // 全体初期化

//     // ---------------------------------------------------------
//     // 1. データの前処理
//     // ---------------------------------------------------------
//     const masterKeys = getMasterOrderedKeys(project);
//     const targetKeys = new Set(masterKeys.filter((k) => resultsByLocation[k]));

//     const filteredHonBolts = {}; // 本ボルト用
//     const specialBolts = {
//       column: {}, // 柱用
//       dLock: {}, // D-Lock
//       naka: {}, // 中ボルト(ミリ)
//       nakaM: {}, // 中ボルト(Mネジ)
//     };

//     masterKeys.forEach((locId) => {
//       if (!targetKeys.has(locId)) return;
//       const locationData = resultsByLocation[locId];

//       filteredHonBolts[locId] = {}; // 箱作成

//       Object.keys(locationData).forEach((size) => {
//         const data = locationData[size];
//         const qty = data.total || 0;

//         if (size.includes("(本柱)")) {
//           specialBolts.column[size] = (specialBolts.column[size] || 0) + qty;
//         } else if (size.startsWith("D")) {
//           specialBolts.dLock[size] = (specialBolts.dLock[size] || 0) + qty;
//         } else if (size.startsWith("中ボ")) {
//           specialBolts.nakaM[size] = (specialBolts.nakaM[size] || 0) + qty;
//         } else if (size.startsWith("中")) {
//           specialBolts.naka[size] = (specialBolts.naka[size] || 0) + qty;
//         } else {
//           filteredHonBolts[locId][size] = data;
//         }
//       });

//       if (Object.keys(filteredHonBolts[locId]).length === 0) {
//         delete filteredHonBolts[locId];
//       }
//     });

//     // ---------------------------------------------------------
//     // 2. セクションコンテナの作成
//     // ---------------------------------------------------------

//     // A. 本ボルトセクション
//     const honBoltSection = document.createElement("section");
//     honBoltSection.className = "mb-16";
//     container.appendChild(honBoltSection);

//     // B. D-Lockセクション
//     const dLockSection = document.createElement("section");
//     dLockSection.className = "mb-16";
//     container.appendChild(dLockSection);

//     // C. 中ボルトセクション
//     const nakaBoltSection = document.createElement("section");
//     nakaBoltSection.className = "mb-16";
//     container.appendChild(nakaBoltSection);

//     // ---------------------------------------------------------
//     // 3. 本ボルトセクションの描画ロジック
//     // ---------------------------------------------------------
//     const renderHonBoltSection = () => {
//       const hasHonBolts = Object.keys(filteredHonBolts).length > 0;
//       const hasColumnBolts = Object.keys(specialBolts.column).length > 0;

//       if (!hasHonBolts && !hasColumnBolts) {
//         honBoltSection.style.display = "none";
//         return;
//       }
//       honBoltSection.style.display = "block";
//       honBoltSection.innerHTML = "";

//       // state初期化
//       const dataKeys = Object.keys(filteredHonBolts);
//       const shouldReset = dataKeys.some(
//         (sec) => !currentGroupingState.hasOwnProperty(sec),
//       );
//       if (shouldReset) {
//         currentGroupingState = {};
//         dataKeys.forEach((section, index) => {
//           currentGroupingState[section] = index + 1;
//         });
//       }

//       // ヘッダー（★修正：mt-4 を mt-8 に変更して他のセクションと合わせる）
//       const headerHtml = `
//                 <div class="flex flex-col md:flex-row justify-between items-start md:items-end mt-8 mb-10 border-b-2 border-pink-500 pb-4 gap-4">
//                     <div>
//                         <h2 class="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
//                             <span class="text-pink-500">■</span> 本ボルト注文明細
//                         </h2>
//                         <p class="text-sm text-slate-500 dark:text-slate-400 pl-6 mt-1">S10T / F8T / 柱用ボルト</p>
//                     </div>

//                     <div class="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
//                         <button id="view-mode-detailed" type="button" class="px-4 py-2 text-sm font-medium rounded-md transition-all">工区別 (詳細)</button>
//                         <button id="view-mode-floor" type="button" class="px-4 py-2 text-sm font-medium rounded-md transition-all">フロア別 (集計)</button>
//                     </div>
//                 </div>
//             `;
//       honBoltSection.insertAdjacentHTML("beforeend", headerHtml);

//       // コントロール & テーブルエリア
//       const controlsContainer = document.createElement("div");
//       honBoltSection.appendChild(controlsContainer);

//       const tableContainer = document.createElement("div");
//       tableContainer.className =
//         "flex flex-wrap gap-8 items-start align-top content-start";
//       honBoltSection.appendChild(tableContainer);

//       // 更新関数
//       const updateView = () => {
//         const btnDetail = honBoltSection.querySelector("#view-mode-detailed");
//         const btnFloor = honBoltSection.querySelector("#view-mode-floor");
//         const activeClass =
//           "bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400";
//         const inactiveClass =
//           "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300";

//         if (currentViewMode === "detailed") {
//           btnDetail.className = `px-4 py-2 text-sm font-medium rounded-md transition-all ${activeClass}`;
//           btnFloor.className = `px-4 py-2 text-sm font-medium rounded-md transition-all ${inactiveClass}`;
//         } else {
//           btnDetail.className = `px-4 py-2 text-sm font-medium rounded-md transition-all ${inactiveClass}`;
//           btnFloor.className = `px-4 py-2 text-sm font-medium rounded-md transition-all ${activeClass}`;
//         }

//         renderGroupingControls(
//           controlsContainer,
//           filteredHonBolts,
//           project,
//           updateView,
//         );

//         let data, sortedKeys;
//         if (currentViewMode === "floor") {
//           const result = aggregateByFloor(filteredHonBolts, project);
//           data = result.data;
//           sortedKeys = result.order;
//         } else {
//           data = calculateAggregatedData(
//             filteredHonBolts,
//             currentGroupingState,
//             project,
//           );
//           const allAggregatedKeys = Object.keys(data);
//           const fullMasterList = getMasterOrderedKeys(project);
//           sortedKeys = allAggregatedKeys.sort((a, b) => {
//             const firstKeyA = a.split(" + ")[0];
//             const firstKeyB = b.split(" + ")[0];
//             return (
//               fullMasterList.indexOf(firstKeyA) -
//               fullMasterList.indexOf(firstKeyB)
//             );
//           });
//         }

//         renderAggregatedTables(tableContainer, data, sortedKeys, {
//           column: specialBolts.column,
//         });
//       };

//       honBoltSection.querySelector("#view-mode-detailed").onclick = () => {
//         currentViewMode = "detailed";
//         updateView();
//       };
//       honBoltSection.querySelector("#view-mode-floor").onclick = () => {
//         currentViewMode = "floor";
//         updateView();
//       };

//       updateView();
//     };

//     // ---------------------------------------------------------
//     // 4. D-Lockセクションの描画ロジック
//     // ---------------------------------------------------------
//     const renderDLockSection = () => {
//       if (Object.keys(specialBolts.dLock).length === 0) {
//         dLockSection.style.display = "none";
//         return;
//       }
//       dLockSection.style.display = "block";

//       // ヘッダー（2つ目以降のセクションは mt-12 で少し広めに空ける）
//       const headerHtml = `
//                 <div class="mt-12 mb-10 border-b-2 border-gray-500 pb-4">
//                     <h2 class="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
//                         <span class="text-gray-500">■</span> D-Lock 注文明細
//                     </h2>
//                 </div>
//             `;
//       dLockSection.innerHTML = headerHtml;

//       const tableContainer = document.createElement("div");
//       tableContainer.className = "flex flex-wrap gap-8 items-start align-top";
//       dLockSection.appendChild(tableContainer);

//       // D-Lockテーブル描画
//       renderAggregatedTables(
//         tableContainer,
//         {},
//         [],
//         { dLock: specialBolts.dLock },
//         true,
//       );
//     };

//     // ---------------------------------------------------------
//     // 5. 中ボルトセクションの描画ロジック
//     // ---------------------------------------------------------
//     const renderNakaBoltSection = () => {
//       const hasNaka = Object.keys(specialBolts.naka).length > 0;
//       const hasNakaM = Object.keys(specialBolts.nakaM).length > 0;
//       if (!hasNaka && !hasNakaM) {
//         nakaBoltSection.style.display = "none";
//         return;
//       }
//       nakaBoltSection.style.display = "block";

//       // ヘッダー
//       const headerHtml = `
//                 <div class="mt-12 mb-10 border-b-2 border-blue-500 pb-4">
//                     <h2 class="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
//                         <span class="text-blue-500">■</span> 中ボルト注文明細
//                     </h2>
//                 </div>
//             `;
//       nakaBoltSection.innerHTML = headerHtml;

//       const tableContainer = document.createElement("div");
//       tableContainer.className = "flex flex-wrap gap-8 items-start align-top";
//       nakaBoltSection.appendChild(tableContainer);

//       // 中ボルトテーブル描画
//       renderAggregatedTables(
//         tableContainer,
//         {},
//         [],
//         { naka: specialBolts.naka, nakaM: specialBolts.nakaM },
//         true,
//       );
//     };

//     // 実行
//     renderHonBoltSection();
//     renderDLockSection();
//     renderNakaBoltSection();
//   } catch (err) {
//     console.error("renderOrderDetailsエラー:", err);
//     container.innerHTML = `<div class="p-4 bg-red-100 text-red-700">表示エラー: ${err.message}</div>`;
//   }
// };

// /**
//  * テーブル群を描画する関数（汎用版）
//  * * @param {HTMLElement} container  描画先のdiv要素
//  * @param {Object} aggregatedCounts [本ボルト用] 合算されたデータ { "1F": { "M16...": 10 } }
//  * @param {Array} sortedKeys        [本ボルト用] 表示順序のキー配列 ["M2F", "2F", ...]
//  * @param {Object} specialBolts     [特殊用] { dLock: {...}, naka: {...}, column: {...} }
//  * @param {boolean} onlySpecial     trueなら本ボルト(aggregatedCounts)の描画をスキップする
//  */
// function renderAggregatedTables(
//   container,
//   aggregatedCounts,
//   sortedKeys,
//   specialBolts = {},
//   onlySpecial = false,
// ) {
//   // コンテナのクリア
//   container.innerHTML = "";

//   // データ生成ヘルパー
//   const renderTableHtml = (title, data, color, customHeader = null) => {
//     if (!data || Object.keys(data).length === 0) return "";

//     // 通常ヘッダー
//     const defaultHeader = `<tr>
//             <th class="px-4 py-2 border border-${color}-300 dark:border-slate-600 text-center bg-${color}-200 dark:bg-slate-700 text-${color}-800 dark:text-${color}-200 whitespace-nowrap">種別</th>
//             <th class="px-4 py-2 border border-${color}-300 dark:border-slate-600 text-center bg-${color}-200 dark:bg-slate-700 text-${color}-800 dark:text-${color}-200 whitespace-nowrap">ボルトサイズ</th>
//             <th class="px-4 py-2 border border-${color}-300 dark:border-slate-600 text-center bg-${color}-200 dark:bg-slate-700 text-${color}-800 dark:text-${color}-200 whitespace-nowrap">本数</th>
//             <th class="px-4 py-2 border border-${color}-300 dark:border-slate-600 text-center bg-${color}-200 dark:bg-slate-700 text-${color}-800 dark:text-${color}-200 whitespace-nowrap">重量(kg)</th>
//         </tr>`;

//     const headers = customHeader || defaultHeader;
//     let body = "";
//     let tableTotalWeight = 0;

//     Object.keys(data)
//       .sort(boltSort)
//       .forEach((key) => {
//         const boltCount = data[key];
//         const singleWeightG = getBoltWeight(key);
//         const rowWeightKg = (boltCount * singleWeightG) / 1000;
//         tableTotalWeight += rowWeightKg;

//         const weightValue = rowWeightKg > 0 ? rowWeightKg.toFixed(1) : "-";
//         const weightTooltip =
//           singleWeightG > 0 ? `単体重量: ${singleWeightG} g` : "";
//         // ▼▼▼ 修正: 末尾チェック(endsWith)から、文字を含むか(includes)に変更 ▼▼▼
//         const type = key.includes("■") ? "F8T" : "S10T";
//         // ▲▲▲ 修正ここまで ▲▲▲
//         const commonCellClass = `px-4 py-2 border border-${color}-200 dark:border-slate-700 text-center`;

//         let rowContent = "";
//         if (customHeader) {
//           // 簡易版（D-Lockなど）
//           rowContent = `
//                     <td class="${commonCellClass}">${key}</td>
//                     <td class="${commonCellClass} font-medium">${boltCount.toLocaleString()}</td>
//                 `;
//         } else {
//           // 通常版
//           const displayKey = title === "柱用" ? key.replace("(本柱)", "") : key;
//           rowContent = `
//                     <td class="${commonCellClass}">${type}</td>
//                     <td class="${commonCellClass}">${displayKey}</td>
//                     <td class="${commonCellClass} font-medium">${boltCount.toLocaleString()}</td>
//                     <td class="${commonCellClass} text-slate-500" title="${weightTooltip}">${weightValue}</td>
//                 `;
//         }

//         body += `<tr class="hover:bg-${color}-50 dark:hover:bg-slate-700/50">${rowContent}</tr>`;
//       });

//     const totalWeightDisplay =
//       !customHeader && tableTotalWeight > 0
//         ? `<span class="ml-auto text-sm font-bold text-red-600 dark:text-red-400">合計: ${tableTotalWeight.toFixed(
//             1,
//           )} kg</span>`
//         : "";

//     return `
//             <div class="min-w-[320px] flex-grow-0 flex-shrink-0 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden mb-6">
//                 <div class="px-4 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
//                     <h3 class="text-lg font-bold text-slate-800 dark:text-slate-200 truncate pr-2" title="${title}">${title}</h3>
//                     ${totalWeightDisplay}
//                 </div>
//                 <div class="overflow-x-auto">
//                     <table class="w-full text-sm border-collapse">
//                         <tbody>${headers}${body}</tbody>
//                     </table>
//                 </div>
//             </div>`;
//   };

//   let tablesHtml = "";

//   // 1. 通常データ（本ボルトなど）の描画
//   // onlySpecialがfalseのときだけ実行される（本ボルトセクション用）
//   if (!onlySpecial && sortedKeys) {
//     // マスタ順序にあるキーを表示
//     sortedKeys.forEach((groupName) => {
//       if (aggregatedCounts[groupName]) {
//         tablesHtml += renderTableHtml(
//           groupName,
//           aggregatedCounts[groupName],
//           "slate",
//         );
//       }
//     });
//     // マスタ外（その他）のキーを表示
//     Object.keys(aggregatedCounts).forEach((key) => {
//       if (!sortedKeys.includes(key)) {
//         tablesHtml += renderTableHtml(key, aggregatedCounts[key], "slate");
//       }
//     });
//   }

//   // 2. 特殊データ（指定があれば描画）
//   if (specialBolts) {
//     // 柱用 (Purple) -> 本ボルトセクションの一部として表示される想定
//     if (specialBolts.column) {
//       tablesHtml += renderTableHtml("柱用", specialBolts.column, "purple");
//     }

//     // 簡易ヘッダー定義
//     const simpleHeader = (color) => `<tr>
//             <th class="px-4 py-2 border border-${color}-300 dark:border-slate-600 text-center bg-${color}-200 dark:bg-slate-700 text-${color}-800 dark:text-${color}-200 whitespace-nowrap">ボルトサイズ</th>
//             <th class="px-4 py-2 border border-${color}-300 dark:border-slate-600 text-center bg-${color}-200 dark:bg-slate-700 text-${color}-800 dark:text-${color}-200 whitespace-nowrap">本数</th>
//         </tr>`;

//     // D-Lock (Gray)
//     if (specialBolts.dLock) {
//       tablesHtml += renderTableHtml(
//         "D-Lock",
//         specialBolts.dLock,
//         "gray",
//         simpleHeader("gray"),
//       );
//     }
//     // 中ボルト・ミリ (Blue)
//     if (specialBolts.naka) {
//       tablesHtml += renderTableHtml(
//         "中ボルト(ミリ)",
//         specialBolts.naka,
//         "blue",
//         simpleHeader("blue"),
//       );
//     }
//     // 中ボルト・Mネジ (Teal)
//     if (specialBolts.nakaM) {
//       tablesHtml += renderTableHtml(
//         "中ボルト(Mネジ)",
//         specialBolts.nakaM,
//         "teal",
//         simpleHeader("teal"),
//       );
//     }
//   }

//   if (tablesHtml === "") {
//     container.innerHTML =
//       '<p class="text-gray-500 w-full p-4">データがありません</p>';
//   } else {
//     container.innerHTML = tablesHtml;
//   }
// }

document.addEventListener("DOMContentLoaded", () => {
  // --- DOM Elements ---
  setupEventListeners();

  const loader = document.getElementById("loader");
  const views = {
    list: document.getElementById("project-list-view"),
    detail: document.getElementById("project-detail-view"),
  };
  // ▼▼▼ 追加：一括登録用モーダル関連の変数 ▼▼▼
  const fabBulkAddMember = document.getElementById("fab-bulk-add-member");
  const bulkAddMemberModal = document.getElementById("bulk-add-member-modal");
  const closeBulkAddMemberModalBtn = document.getElementById(
    "close-bulk-add-member-modal-btn",
  );
  const cancelBulkAddMemberBtn = document.getElementById(
    "cancel-bulk-add-member-btn",
  );
  const saveBulkMemberBtn = document.getElementById("save-bulk-member-btn");
  const bulkMemberJointSelect = document.getElementById(
    "bulk-member-joint-select",
  );
  //const bulkMemberLevelsContainer = document.getElementById('bulk-member-levels-container');
  const bulkMemberInputsContainer = document.getElementById(
    "bulk-member-inputs-container",
  );
  const addBulkInputBtn = document.getElementById("add-bulk-input-btn");
  // ▲▲▲ 追加ここまで ▲▲▲
  // ▼▼▼ 新規追加: 部材一括登録用の階層選択モーダル関連 ▼▼▼
  const bulkLevelSelectorModal = document.getElementById(
    "bulk-level-selector-modal",
  );
  const closeBulkLevelModalBtn = document.getElementById(
    "close-bulk-level-modal-btn",
  );
  const saveBulkLevelBtn = document.getElementById("save-bulk-level-btn");
  const bulkLevelOptionsContainer = document.getElementById(
    "bulk-level-options-container",
  );
  const mainHeader = document.getElementById("main-header");
  const fixedNav = document.getElementById("fixed-nav");
  const navProjectTitle = document.getElementById("nav-project-title");
  const navTabJoints = document.getElementById("nav-tab-joints");
  const navTabTally = document.getElementById("nav-tab-tally");
  const jointsSection = document.getElementById("joints-section");
  const tallySection = document.getElementById("tally-section");
  const hamburgerBtn = document.getElementById("hamburger-btn");
  const mobileMenu = document.getElementById("mobile-menu");
  const undoBtn = document.getElementById("undo-btn");
  const redoBtn = document.getElementById("redo-btn");
  const mobileUndoBtn = document.getElementById("mobile-undo-btn");
  const mobileRedoBtn = document.getElementById("mobile-redo-btn");
  const projectsContainer = document.getElementById("projects-container");
  const projectNameInput = document.getElementById("project-name");
  const projectFloorsInput = document.getElementById("project-floors");
  const projectSectionsInput = document.getElementById("project-sections");
  const projectHasPhInput = document.getElementById("project-has-ph");
  const addProjectBtn = document.getElementById("add-project-btn");
  const advancedSettingsToggle = document.getElementById(
    "advanced-settings-toggle",
  );
  const simpleProjectSettings = document.getElementById(
    "simple-project-settings",
  );
  const advancedProjectSettings = document.getElementById(
    "advanced-project-settings",
  );
  const customLevelsCountInput = document.getElementById("custom-levels-count");
  const customLevelsContainer = document.getElementById(
    "custom-levels-container",
  );
  const customAreasCountInput = document.getElementById("custom-areas-count");
  const customAreasContainer = document.getElementById(
    "custom-areas-container",
  );
  const addCustomLevelsCountInput = document.getElementById(
    "add-custom-levels-count",
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
  const addDecrementAreasBtn = document.getElementById(
    "add-decrement-areas-btn",
  );
  const addIncrementAreasBtn = document.getElementById(
    "add-increment-areas-btn",
  );
  const jointTypeInput = document.getElementById("joint-type");
  const jointNameInput = document.getElementById("joint-name");
  const flangeSizeInput = document.getElementById("flange-size");
  const flangeCountInput = document.getElementById("flange-count");
  const webSizeInput = document.getElementById("web-size");
  const webCountInput = document.getElementById("web-count");
  const addJointBtn = document.getElementById("add-joint-btn");
  const jointListsContainer = document.getElementById("joint-lists-container");
  // const createSheetBtn = document.getElementById('create-sheet-btn');
  const tallyCard = document.getElementById("tally-card");
  const tallySheetContainer = document.getElementById("tally-sheet-container");
  const resultsCard = document.getElementById("results-card");
  const resultsCardContent = document.getElementById("results-card-content");
  const pinJointGroup = document.getElementById("pin-joint-group");
  const isPinJointInput = document.getElementById("is-pin-joint");
  const countAsMemberInput = document.getElementById("count-as-member");
  const memberNameInput = document.getElementById("member-name");
  const addMemberBtn = document.getElementById("add-member-btn");
  const memberListsContainer = document.getElementById(
    "member-lists-container",
  );
  const editModal = document.getElementById("edit-joint-modal");
  const closeEditModalBtn = document.getElementById("close-edit-modal-btn");
  const cancelEditBtn = document.getElementById("cancel-edit-btn");
  const saveJointBtn = document.getElementById("save-joint-btn");
  const editJointIdInput = document.getElementById("edit-joint-id");
  const editJointTypeInput = document.getElementById("edit-joint-type");
  const editJointNameInput = document.getElementById("edit-joint-name");
  const editFlangeSizeInput = document.getElementById("edit-flange-size");
  const editFlangeCountInput = document.getElementById("edit-flange-count");
  const editWebSizeInput = document.getElementById("edit-web-size");
  const editWebCountInput = document.getElementById("edit-web-count");
  const editPinJointGroup = document.getElementById("edit-pin-joint-group");
  const editIsPinJointInput = document.getElementById("edit-is-pin-joint");
  const editCountAsMemberInput = document.getElementById(
    "edit-count-as-member",
  );
  const editMemberModal = document.getElementById("edit-member-modal");
  const closeEditMemberModalBtn = document.getElementById(
    "close-edit-member-modal-btn",
  );
  const cancelMemberEditBtn = document.getElementById("cancel-member-edit-btn");
  const saveMemberBtn = document.getElementById("save-member-btn");
  const editMemberIdInput = document.getElementById("edit-member-id");
  const editMemberNameInput = document.getElementById("edit-member-name");
  const editMemberJointSelect = document.getElementById(
    "edit-member-joint-select",
  );
  const editProjectModal = document.getElementById("edit-project-modal");
  // const closeEditProjectModalBtn = document.getElementById(
  //   "close-edit-project-modal-btn"
  // );
  // const cancelProjectEditBtn = document.getElementById(
  //   "cancel-project-edit-btn"
  // );
  const saveProjectBtn = document.getElementById("save-project-btn");
  const editProjectIdInput = document.getElementById("edit-project-id");
  const editProjectNameInput = document.getElementById("edit-project-name");
  const editProjectFloorsInput = document.getElementById("edit-project-floors");
  const editProjectSectionsInput = document.getElementById(
    "edit-project-sections",
  );
  const editProjectHasPhInput = document.getElementById("edit-project-has-ph");
  const editAdvancedSettingsToggle = document.getElementById(
    "edit-advanced-settings-toggle",
  );
  const editSimpleProjectSettings = document.getElementById(
    "edit-simple-project-settings",
  );
  const editAdvancedProjectSettings = document.getElementById(
    "edit-advanced-project-settings",
  );
  const editCustomLevelsCountInput = document.getElementById(
    "edit-custom-levels-count",
  );
  const editCustomLevelsContainer = document.getElementById(
    "edit-custom-levels-container",
  );
  const editCustomAreasCountInput = document.getElementById(
    "edit-custom-areas-count",
  );
  const editCustomAreasContainer = document.getElementById(
    "edit-custom-areas-container",
  );
  // const confirmDeleteModal = document.getElementById("confirm-delete-modal");
  const confirmDeleteBtn = document.getElementById("confirm-delete-btn");
  // const cancelDeleteBtn = document.getElementById("cancel-delete-btn");
  const deleteIdInput = document.getElementById("delete-id");
  const deleteTypeInput = document.getElementById("delete-type");
  const confirmDeleteMessage = document.getElementById(
    "confirm-delete-message",
  );
  const confirmAddModal = document.getElementById("confirm-add-modal");
  const confirmAddMessage = document.getElementById("confirm-add-message");
  const confirmAddBtn = document.getElementById("confirm-add-btn");
  const cancelAddBtn = document.getElementById("cancel-add-btn");
  // const customAlertModal = document.getElementById("custom-alert-modal");
  // const customAlertTitle = document.getElementById("custom-alert-title");
  // const customAlertMessage = document.getElementById("custom-alert-message");
  const closeAlertBtn = document.getElementById("close-alert-btn");
  const boltSelectorModal = document.getElementById("bolt-selector-modal");
  const closeBoltModalBtn = document.getElementById("close-bolt-modal-btn");
  const boltOptionsContainer = document.getElementById(
    "bolt-options-container",
  );
  const tempBoltSettingGroup = document.getElementById(
    "temp-bolt-setting-group",
  );
  const tempBoltSettingInput = document.getElementById("temp-bolt-setting");
  const editTempBoltSettingGroup = document.getElementById(
    "edit-temp-bolt-setting-group",
  );
  const editTempBoltSettingInput = document.getElementById(
    "edit-temp-bolt-setting",
  );
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
  const tempBoltMappingModal = document.getElementById(
    "temp-bolt-mapping-modal",
  );
  const openTempBoltMappingBtn = document.getElementById(
    "open-temp-bolt-mapping-btn",
  );
  const closeTempBoltMappingModalBtn = document.getElementById(
    "close-temp-bolt-mapping-modal-btn",
  );
  const cancelTempBoltMappingBtn = document.getElementById(
    "cancel-temp-bolt-mapping-btn",
  );
  const tempBoltMappingContainer = document.getElementById(
    "temp-bolt-mapping-container",
  );
  const shopTempBoltGroup = document.getElementById("shop-temp-bolt-group");
  const shopTempBoltCountInput = document.getElementById(
    "shop-temp-bolt-count",
  );
  const editShopTempBoltGroup = document.getElementById(
    "edit-shop-temp-bolt-group",
  );
  const editShopTempBoltCountInput = document.getElementById(
    "edit-shop-temp-bolt-count",
  );
  const isDoubleShearInput = document.getElementById("is-double-shear");
  const doubleShearGroup = document.getElementById("double-shear-group");
  const editIsDoubleShearInput = document.getElementById(
    "edit-is-double-shear",
  );
  const editDoubleShearGroup = document.getElementById(
    "edit-double-shear-group",
  );
  const hasBoltCorrectionInput = document.getElementById("has-bolt-correction");
  const editHasBoltCorrectionInput = document.getElementById(
    "edit-has-bolt-correction",
  );
  const shopSplGroup = document.getElementById("shop-spl-group");
  const hasShopSplInput = document.getElementById("has-shop-spl");
  const editShopSplGroup = document.getElementById("edit-shop-spl-group");
  const editHasShopSplInput = document.getElementById("edit-has-shop-spl");
  const confirmMemberDeletionModal = document.getElementById(
    "confirm-member-deletion-modal",
  );
  const confirmMemberDeletionMessage = document.getElementById(
    "confirm-member-deletion-message",
  );
  const confirmMemberDeletionBtn = document.getElementById(
    "confirm-member-deletion-btn",
  );
  const cancelMemberDeletionBtn = document.getElementById(
    "cancel-member-deletion-btn",
  );
  const decrementLevelsBtn = document.getElementById("decrement-levels-btn");
  const incrementLevelsBtn = document.getElementById("increment-levels-btn");
  const decrementAreasBtn = document.getElementById("decrement-areas-btn");
  const incrementAreasBtn = document.getElementById("increment-areas-btn");
  const confirmActionModal = document.getElementById("confirm-action-modal");
  const confirmActionMessage = document.getElementById(
    "confirm-action-message",
  );
  const confirmActionBtn = document.getElementById("confirm-action-btn");
  const cancelActionBtn = document.getElementById("cancel-action-btn");
  const shopTempBoltSizeInput = document.getElementById("shop-temp-bolt-size");
  const editShopTempBoltSizeInput = document.getElementById(
    "edit-shop-temp-bolt-size",
  );
  // --- ここから追加 ---
  const complexSplGroup = document.getElementById("complex-spl-group");
  const isComplexSplInput = document.getElementById("is-complex-spl");
  const complexSplCountGroup = document.getElementById(
    "complex-spl-count-group",
  );
  const complexSplCountInput = document.getElementById("complex-spl-count"); //ui.jsに移動中
  // const decrementComplexSplBtn = document.getElementById(
  //   "decrement-complex-spl-btn",
  // );
  // const incrementComplexSplBtn = document.getElementById(
  //   "increment-complex-spl-btn",
  // );

  const editComplexSplGroup = document.getElementById("edit-complex-spl-group");
  const editIsComplexSplInput = document.getElementById("edit-is-complex-spl"); //ui.jsに移動中
  const editComplexSplCountGroup = document.getElementById(
    "edit-complex-spl-count-group",
  );
  const editComplexSplCountInput = document.getElementById(
    "edit-complex-spl-count",
  );
  // const editDecrementComplexSplBtn = document.getElementById(
  //   "edit-decrement-complex-spl-btn"
  // );
  // const editIncrementComplexSplBtn = document.getElementById(
  //   "edit-increment-complex-spl-btn"
  // );
  // --- ここまで追加 ---
  // ▼▼▼ 追加：複製機能のロジック ▼▼▼
  const copyProjectModal = document.getElementById("copy-project-modal");
  const copySourceIdInput = document.getElementById("copy-source-project-id");
  const copyNewNameInput = document.getElementById("copy-new-project-name");
  const executeCopyBtn = document.getElementById("execute-copy-btn");
  const closeCopyModalBtn = document.getElementById("close-copy-modal-btn");
  const cancelCopyBtn = document.getElementById("cancel-copy-btn");
  // ▼▼▼ 追加：カラー関連の変数と関数 ▼▼▼
  // 変数定義
  const editJointColorInput = document.getElementById("edit-joint-color");
  const clearJointColorBtn = document.getElementById("clear-joint-color-btn");
  const colorPaletteContainer = document.getElementById(
    "color-palette-container",
  );
  // ▼▼▼ 追加：常設フォーム用カラー関連変数 ▼▼▼
  const jointColorToggle = document.getElementById("joint-color-toggle");
  const jointColorSection = document.getElementById("joint-color-section");
  const jointColorInput = document.getElementById("joint-color-input");
  const staticClearJointColorBtn = document.getElementById(
    "static-clear-joint-color-btn",
  );
  const staticColorPaletteContainer = document.getElementById(
    "static-color-palette-container",
  );
  // ▲▲▲ 追加ここまで ▲▲▲
  // ▼▼▼ 修正：Excel風プリセットカラー定義（蛍光色追加） ▼▼▼

  // 新規追加: ボルト設定関連のDOM要素
  const btnBoltSizeSettings = document.getElementById("btn-bolt-size-settings");
  const boltSizeSettingsModal = document.getElementById(
    "bolt-size-settings-modal",
  );
  const closeBoltSizeModalBtn = document.getElementById(
    "close-bolt-size-modal-btn",
  );
  const saveBoltSizeSettingsBtn = document.getElementById(
    "save-bolt-size-settings-btn",
  );
  const newBoltTypeSelect = document.getElementById("new-bolt-type-select");
  const newBoltLengthInput = document.getElementById("new-bolt-length-input");
  const addBoltSizeBtn = document.getElementById("add-bolt-size-btn");
  const boltSizeList = document.getElementById("bolt-size-list");

  // --- DOM Elements --- セクションに追加

  const isBundledWithColumnInput = document.getElementById(
    "is-bundled-with-column",
  );
  const bundleColumnGroup = document.getElementById("bundle-column-group");

  const editIsBundledWithColumnInput = document.getElementById(
    "edit-is-bundled-with-column",
  );
  const editBundleColumnGroup = document.getElementById(
    "edit-bundle-column-group",
  );

  // イベントリスナー：標準ピッカーで色が選ばれた時
  if (editJointColorInput) {
    editJointColorInput.addEventListener("input", (e) => {
      editJointColorInput.dataset.isNull = "false";
      // パレットの選択解除
      document
        .querySelectorAll(".color-swatch")
        .forEach((el) => el.classList.remove("selected"));
    });
  }

  // イベントリスナー：設定なしボタン
  if (clearJointColorBtn) {
    clearJointColorBtn.addEventListener("click", () => {
      editJointColorInput.value = "#ffffff";
      editJointColorInput.dataset.isNull = "true";
      document
        .querySelectorAll(".color-swatch")
        .forEach((el) => el.classList.remove("selected"));
    });
  }
  // パレットの生成関数
  // const renderColorPalette = (selectedColor) => {
  //   if (!colorPaletteContainer) return;
  //   colorPaletteContainer.innerHTML = "";
  //   PRESET_COLORS.forEach((color) => {
  //     const swatch = document.createElement("div");
  //     swatch.className = "color-swatch";
  //     swatch.style.backgroundColor = color;
  //     swatch.dataset.color = color;

  //     if (color === selectedColor) {
  //       swatch.classList.add("selected");
  //     }

  //     swatch.addEventListener("click", () => {
  //       // 選択状態の更新
  //       document
  //         .querySelectorAll(".color-swatch")
  //         .forEach((el) => el.classList.remove("selected"));
  //       swatch.classList.add("selected");

  //       // 入力値の更新
  //       editJointColorInput.value = color;
  //       editJointColorInput.dataset.isNull = "false";
  //     });

  //     colorPaletteContainer.appendChild(swatch);
  //   });
  // };
  // 初期化時にパレット生成（デフォルト選択なし）
  renderColorPalette(null);
  // ▲▲▲ 修正ここまで ▲▲▲
  // ▼▼▼ 追加：常設フォーム用カラーパレット制御 ▼▼▼
  // const renderStaticColorPalette = (selectedColor) => {
  //   if (!staticColorPaletteContainer) return;
  //   staticColorPaletteContainer.innerHTML = "";
  //   PRESET_COLORS.forEach((color) => {
  //     const swatch = document.createElement("div");
  //     swatch.className = "color-swatch";
  //     swatch.style.backgroundColor = color;

  //     if (color === selectedColor) {
  //       swatch.classList.add("selected");
  //     }

  //     swatch.addEventListener("click", () => {
  //       // 選択状態の更新
  //       staticColorPaletteContainer
  //         .querySelectorAll(".color-swatch")
  //         .forEach((el) => el.classList.remove("selected"));
  //       swatch.classList.add("selected");
  //       // 入力値の更新
  //       jointColorInput.value = color;
  //     });

  //     staticColorPaletteContainer.appendChild(swatch);
  //   });
  // };

  // トグルスイッチの制御
  if (jointColorToggle) {
    jointColorToggle.addEventListener("change", (e) => {
      jointColorSection.classList.toggle("hidden", !e.target.checked);
    });
  }

  // 標準ピッカー
  if (jointColorInput) {
    jointColorInput.addEventListener("input", () => {
      staticColorPaletteContainer
        .querySelectorAll(".color-swatch")
        .forEach((el) => el.classList.remove("selected"));
    });
  }

  // 解除ボタン
  if (staticClearJointColorBtn) {
    staticClearJointColorBtn.addEventListener("click", () => {
      jointColorInput.value = "#ffffff";
      staticColorPaletteContainer
        .querySelectorAll(".color-swatch")
        .forEach((el) => el.classList.remove("selected"));
    });
  }

  // 初期化
  renderStaticColorPalette(null);
  // ▲▲▲ 追加ここまで ▲▲▲

  // --- UI & Modal Functions ---

  // ★ 修正版：画面切り替え処理（FABの非表示対応済み）
  const switchView = (viewName) => {
    Object.values(views).forEach((v) => v.classList.remove("active"));
    if (views[viewName]) {
      views[viewName].classList.add("active");
    }

    const navDetailContext = document.getElementById("nav-detail-context");
    const navListContext = document.getElementById("nav-list-context");
    const navDetailButtons = document.getElementById("nav-detail-buttons");
    const mobileNavDetailButtons = document.getElementById(
      "mobile-nav-detail-buttons",
    );

    if (viewName === "detail") {
      fixedNav.classList.remove("hidden");
      navListContext.classList.add("hidden");
      navDetailContext.classList.remove("hidden");
      navDetailButtons.classList.remove("hidden");
      navDetailButtons.classList.add("flex");
      mobileNavDetailButtons.classList.remove("hidden");

      const project = state.projects.find(
        (p) => p.id === state.currentProjectId,
      );
      if (project) {
        navProjectTitle.textContent = project.name;
      }
      switchTab("joints");

      // 詳細画面に入った時にFABの表示状態を更新
      if (typeof updateQuickNavVisibility === "function")
        updateQuickNavVisibility();
    } else {
      navListContext.classList.remove("hidden");
      navDetailContext.classList.add("hidden");
      navDetailButtons.classList.add("hidden");
      navDetailButtons.classList.remove("flex");
      mobileNavDetailButtons.classList.add("hidden");

      // ▼▼▼ 修正：一覧画面に戻ったらナビとFABを隠し、状態をリセット ▼▼▼
      const quickNav = document.getElementById("quick-nav-container");
      if (quickNav) quickNav.classList.add("hidden");

      const fabContainer = document.getElementById("fab-container");
      if (fabContainer) fabContainer.classList.add("hidden");

      // メニューが開いたまま戻った場合、閉じた状態にリセットする
      if (
        typeof isFabOpen !== "undefined" &&
        isFabOpen &&
        typeof toggleFab === "function"
      ) {
        toggleFab();
      }
      // ▲▲▲ 修正ここまで ▲▲▲
    }
  };
  const switchTab = (tabName) => {
    const jointsSection = document.getElementById("joints-section");
    const tallySection = document.getElementById("tally-section");
    const navTabJoints = document.getElementById("nav-tab-joints");
    const navTabTally = document.getElementById("nav-tab-tally");
    const mobileNavTabJoints = document.getElementById("mobile-nav-tab-joints");
    const mobileNavTabTally = document.getElementById("mobile-nav-tab-tally");

    // ▼▼▼ 追加：内部セクションも明示的に取得 ▼▼▼
    const settingsCard = document.getElementById("settings-card");
    const memberCard = document.getElementById("member-registration-card");
    // ▲▲▲ 追加ここまで ▲▲▲

    const currentScrollY = window.scrollY;
    state.scrollPositions[state.activeTab] = currentScrollY;
    state.activeTab = tabName;

    [navTabJoints, navTabTally, mobileNavTabJoints, mobileNavTabTally].forEach(
      (tab) => {
        if (tab) tab.classList.remove("active");
      },
    );

    if (tabName === "joints") {
      if (jointsSection) jointsSection.classList.remove("hidden");
      // ▼▼▼ 追加：念のため内部セクションも表示 ▼▼▼
      if (settingsCard) settingsCard.classList.remove("hidden");
      if (memberCard) memberCard.classList.remove("hidden");
      // ▲▲▲ 追加ここまで ▲▲▲

      if (tallySection) tallySection.classList.add("hidden");
      if (navTabJoints) navTabJoints.classList.add("active");
      if (mobileNavTabJoints) mobileNavTabJoints.classList.add("active");
    } else if (tabName === "tally") {
      if (jointsSection) jointsSection.classList.add("hidden");
      // ▼▼▼ 追加：念のため内部セクションも非表示 ▼▼▼
      if (settingsCard) settingsCard.classList.add("hidden");
      if (memberCard) memberCard.classList.add("hidden");
      // ▲▲▲ 追加ここまで ▲▲▲

      if (tallySection) tallySection.classList.remove("hidden");
      if (navTabTally) navTabTally.classList.add("active");
      if (mobileNavTabTally) mobileNavTabTally.classList.add("active");
    }

    const newScrollY = state.scrollPositions[tabName] || 0;
    setTimeout(() => {
      window.scrollTo(0, newScrollY);
    }, 0);

    if (typeof updateQuickNavVisibility === "function")
      updateQuickNavVisibility();
  };

  // const closeModal = (modalElement) => {
  //   modalElement.classList.add("opacity-0");

  //   if (modalElement.classList.contains("modeless")) {
  //     const backdrop = document.getElementById("modeless-backdrop");
  //     if (backdrop) backdrop.classList.add("hidden");
  //   } else {
  //     document.body.classList.remove("overflow-hidden");
  //   }

  //   setTimeout(() => modalElement.classList.add("hidden"), 300);
  // };
  // ▲▲▲ 修正ここまで ▲▲▲

  // const showCustomAlert = (message, options = {}) => {
  //   const { title = "エラー", type = "error", invalidElements = [] } = options;

  //   document
  //     .querySelectorAll(".input-error")
  //     .forEach((el) => el.classList.remove("input-error"));
  //   invalidElements.forEach((el) => el.classList.add("input-error"));

  //   customAlertTitle.textContent = title;
  //   customAlertMessage.textContent = message;

  //   customAlertTitle.classList.remove("text-red-600", "text-green-600");
  //   if (type === "success") {
  //     customAlertTitle.classList.add("text-green-600");
  //   } else {
  //     customAlertTitle.classList.add("text-red-600");
  //   }

  //   openModal(customAlertModal);
  // };

  // const openEditModal = (joint) => {
  //   editJointIdInput.value = joint.id;
  //   editJointTypeInput.value = joint.type;
  //   editIsPinJointInput.checked = joint.isPinJoint || false;
  //   editIsDoubleShearInput.checked = joint.isDoubleShear || false;
  //   editCountAsMemberInput.checked = joint.countAsMember || false;
  //   editHasShopSplInput.checked = joint.hasShopSpl ?? true;
  //   editHasBoltCorrectionInput.checked = joint.hasBoltCorrection || false;
  //   editJointNameInput.value = joint.name;
  //   // ★追加: 本柱同梱フラグの読み込み
  //   if (editIsBundledWithColumnInput) {
  //     editIsBundledWithColumnInput.checked = joint.isBundledWithColumn || false;
  //   }
  //   // ▼▼▼ 修正：色の読み込みとパレット反映 ▼▼▼
  //   if (joint.color) {
  //     editJointColorInput.value = joint.color;
  //     editJointColorInput.dataset.isNull = "false";
  //     renderColorPalette(joint.color); // パレットの選択状態を更新
  //   } else {
  //     editJointColorInput.value = "#ffffff";
  //     editJointColorInput.dataset.isNull = "true";
  //     renderColorPalette(null); // 選択なし
  //   }
  //   // ▲▲▲ 修正ここまで ▲▲▲
  //   editFlangeSizeInput.value = joint.flangeSize;
  //   editFlangeCountInput.value = joint.flangeCount;
  //   editWebSizeInput.value = joint.webSize;
  //   editWebCountInput.value = joint.webCount;
  //   editTempBoltSettingInput.value = joint.tempBoltSetting || "none";

  //   document.getElementById("edit-shop-temp-bolt-count").value =
  //     joint.shopTempBoltCount ?? "";
  //   document.getElementById("edit-shop-temp-bolt-size").value =
  //     joint.shopTempBoltSize || "";
  //   document.getElementById("edit-shop-temp-bolt-count-f").value =
  //     joint.shopTempBoltCount_F ?? "";
  //   document.getElementById("edit-shop-temp-bolt-size-f").value =
  //     joint.shopTempBoltSize_F || "";
  //   document.getElementById("edit-shop-temp-bolt-count-w").value =
  //     joint.shopTempBoltCount_W ?? "";
  //   document.getElementById("edit-shop-temp-bolt-size-w").value =
  //     joint.shopTempBoltSize_W || "";

  //   editIsComplexSplInput.checked = joint.isComplexSpl || false;
  //   editComplexSplCountInput.value = joint.complexSplCount || "2";

  //   // editComplexSplCache = Array.from({ length: 4 }, () => ({
  //   //   size: "",
  //   //   count: "",
  //   // }));
  //   resetEditComplexSplCache();

  //   if (joint.isComplexSpl && joint.webInputs) {
  //     joint.webInputs.forEach((input, index) => {
  //       if (index < 4) {
  //         editComplexSplCache[index] = { ...input };
  //       }
  //     });
  //   } else {
  //     editComplexSplCache[0] = { size: joint.webSize, count: joint.webCount };
  //   }

  //   // ▼▼▼ ここからが重要: イベントリスナーをここで再設定する ▼▼▼
  //   for (let i = 1; i <= 4; i++) {
  //     const suffix = i > 1 ? `-${i}` : "";
  //     const sizeInput = document.getElementById(`edit-web-size${suffix}`);
  //     const countInput = document.getElementById(`edit-web-count${suffix}`);

  //     const sizeChangeHandler = (e) => {
  //       editComplexSplCache[i - 1].size = e.target.value;
  //     };
  //     const countInputHandler = (e) => {
  //       editComplexSplCache[i - 1].count = e.target.value;
  //     };

  //     // 既存のリスナーを一旦削除
  //     sizeInput.removeEventListener("change", sizeInput.handler);
  //     countInput.removeEventListener("input", countInput.handler);

  //     // 新しいハンドラをプロパティとして保持させてから追加
  //     sizeInput.handler = sizeChangeHandler;
  //     countInput.handler = countInputHandler;
  //     sizeInput.addEventListener("change", sizeInput.handler);
  //     countInput.addEventListener("input", countInput.handler);
  //   }
  //   // ▲▲▲ ここまでが重要 ▲▲▲

  //   updateJointFormUI(true);
  //   openModal(editModal);
  // };
  // ★ 修正版：openEditMemberModal（階層チェックボックス生成）
  // const openEditMemberModal = (memberId) => {
  //   const project = state.projects.find((p) => p.id === state.currentProjectId);
  //   if (!project) return;
  //   const member = (project.members || []).find((m) => m.id === memberId);
  //   if (!member) return;

  //   editMemberIdInput.value = member.id;
  //   editMemberNameInput.value = member.name;
  //   populateJointDropdownForEdit(editMemberJointSelect, member.jointId);

  //   // ▼▼▼ 追加：階層チェックボックスの生成と初期値セット ▼▼▼
  //   const levelsContainer = document.getElementById(
  //     "edit-member-levels-container",
  //   );
  //   levelsContainer.innerHTML = "";
  //   const levels = getProjectLevels(project);
  //   const targetLevels = member.targetLevels || []; // 未設定なら空(全フロア扱いだがUI上はチェックなし)

  //   levels.forEach((lvl) => {
  //     const isChecked = targetLevels.includes(lvl.id);
  //     const label = document.createElement("label");
  //     label.className = "flex items-center gap-2 text-sm cursor-pointer";
  //     label.innerHTML = `<input type="checkbox" value="${
  //       lvl.id
  //     }" class="level-checkbox h-4 w-4 text-blue-600 rounded border-gray-300" ${
  //       isChecked ? "checked" : ""
  //     }> ${lvl.label}`;
  //     levelsContainer.appendChild(label);
  //   });
  //   // ▲▲▲ 追加ここまで ▲▲▲

  //   openModal(editMemberModal);
  // };

  const openConfirmDeleteModal = (id, type) => {
    const confirmDeleteModal = document.getElementById("confirm-delete-modal");

    // 安全対策
    if (!confirmDeleteModal) return;

    deleteIdInput.value = id;
    deleteTypeInput.value = type;
    const typeName =
      type === "joint" ? "継手" : type === "member" ? "部材" : "工事";
    confirmDeleteMessage.textContent = `この${typeName}を削除しますか？\nデータは復元できません。`;
    openModal(confirmDeleteModal);
  };

  const openBoltSelectorModal = (targetInputId) => {
    state.activeBoltTarget = document.getElementById(targetInputId);
    // 現在の入力値を取得して、モーダル生成関数に渡す
    const currentValue = state.activeBoltTarget.value;
    populateBoltSelectorModal(currentValue);
    openModal(boltSelectorModal);
  };

  // const openEditProjectModal = (project) => {
  //   editProjectIdInput.value = project.id;
  //   editProjectNameInput.value = project.name;
  //   document.getElementById("edit-property-name").value =
  //     project.propertyName || ""; // この行を追加
  //   const isAdvanced = project.mode === "advanced";
  //   document
  //     .getElementById("edit-advanced-toggle-wrapper")
  //     .classList.add("hidden");
  //   editSimpleProjectSettings.classList.toggle("hidden", isAdvanced);
  //   editAdvancedProjectSettings.classList.toggle("hidden", !isAdvanced);

  //   if (isAdvanced) {
  //     levelNameCache = [...project.customLevels];
  //     areaNameCache = [...project.customAreas];
  //     editCustomLevelsCountInput.value = project.customLevels.length;
  //     editCustomAreasCountInput.value = project.customAreas.length;
  //     generateCustomInputFields(
  //       project.customLevels.length,
  //       editCustomLevelsContainer,
  //       "edit-level",
  //       levelNameCache,
  //     );
  //     generateCustomInputFields(
  //       project.customAreas.length,
  //       editCustomAreasContainer,
  //       "edit-area",
  //       areaNameCache,
  //     );
  //   } else {
  //     editProjectFloorsInput.value = project.floors;
  //     editProjectSectionsInput.value = project.sections;
  //     editProjectHasPhInput.checked = project.hasPH;
  //   }
  //   openModal(editProjectModal);
  // };

  const populateJointSelectorModal = (project, currentJointId) => {
    if (!project) return;
    jointOptionsContainer.innerHTML = "";

    const availableJoints = project.joints.filter((j) => !j.countAsMember);

    const groupedJoints = availableJoints.reduce((acc, joint) => {
      const typeName = {
        girder: "大梁",
        beam: "小梁",
        column: "本柱",
        stud: "間柱",
        wall_girt: "胴縁",
        roof_purlin: "母屋",
        other: "その他",
      }[joint.type];

      const groupKey = joint.isPinJoint ? `${typeName} (ピン取り)` : typeName;
      if (!acc[groupKey]) acc[groupKey] = [];
      acc[groupKey].push(joint);
      return acc;
    }, {});

    const desiredOrder = [
      "大梁",
      "大梁 (ピン取り)",
      "小梁",
      "小梁 (ピン取り)",
      "間柱",
      "間柱 (ピン取り)",
      "本柱",
      "胴縁",
      "母屋",
      "その他",
      "その他 (ピン取り)",
    ];

    const groupOrder = Object.keys(groupedJoints).sort((a, b) => {
      const indexA = desiredOrder.indexOf(a);
      const indexB = desiredOrder.indexOf(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });

    let html = "";
    // ▼ この外側のループが重要です
    for (const group of groupOrder) {
      // グループ名と、ボタンを囲む「箱」を開始します
      html += `<h4 class="font-bold text-blue-800 border-b border-blue-200 pb-1 mb-2">${group}</h4>
                 <div class="grid grid-cols-2 sm-grid-cols-3 md-grid-cols-4 lg-grid-cols-5 gap-2 mb-4">`;

      const sortedJoints = groupedJoints[group].sort((a, b) =>
        a.name.localeCompare(b.name, "ja"),
      );

      // ▼ 内側のループで各ボタンを生成します
      for (const joint of sortedJoints) {
        // 継手にIDが存在し、かつ、現在選択されているIDと一致する場合にのみtrueになります
        const isSelected = joint.id && joint.id === currentJointId;

        // isSelectedの結果に基づいてクラスを決定します
        const selectedClass = isSelected
          ? "bg-yellow-400 dark:bg-yellow-600 font-bold"
          : "bg-blue-50 dark:bg-slate-700";

        // data-idにも、IDがなければ空文字が入るようにします
        const dataId = joint.id || "";

        // ボタンの表示を継手名（joint.name）のみに戻します
        html += `<button data-id="${dataId}" data-name="${joint.name}" class="joint-option-btn text-sm p-2 border border-blue-200 rounded-md transition-transform duration-150 hover:scale-105 ${selectedClass}">${joint.name}</button>`;
      }
      // 内側のループが終わった後で「箱」を閉じます
      html += `</div>`;
    }
    jointOptionsContainer.innerHTML = html;
  };

  // const populateTempBoltMappingModal = (project) => {
  //   if (!project) return;
  //   tempBoltMappingContainer.innerHTML = "";
  //   const requiredFinalBolts = new Set();

  //   project.joints
  //     .filter(
  //       (j) =>
  //         j.tempBoltSetting === "calculated" &&
  //         j.type !== "wall_girt" &&
  //         j.type !== "roof_purlin" &&
  //         j.type !== "column",
  //     )
  //     .forEach((j) => {
  //       if (j.isComplexSpl && j.webInputs) {
  //         j.webInputs.forEach((input) => {
  //           if (input.size) {
  //             requiredFinalBolts.add(input.size);
  //           }
  //         });
  //       } else {
  //         if (j.flangeSize) requiredFinalBolts.add(j.flangeSize);
  //         if (j.webSize) requiredFinalBolts.add(j.webSize);
  //       }
  //     });

  //   if (requiredFinalBolts.size === 0) {
  //     tempBoltMappingContainer.innerHTML =
  //       '<p class="text-slate-500">仮ボルトを使用する継手が登録されていません。</p>';
  //     return;
  //   }

  //   // ▼▼▼ ここからが修正箇所: ボルトサイズを径と長さでソートする処理 ▼▼▼
  //   const sortedFinalBolts = Array.from(requiredFinalBolts).sort((a, b) => {
  //     const regex = /M(\d+)[×xX](\d+)/;
  //     const matchA = a.match(regex);
  //     const matchB = b.match(regex);

  //     if (matchA && matchB) {
  //       const diameterA = parseInt(matchA[1]);
  //       const lengthA = parseInt(matchA[2]);
  //       const diameterB = parseInt(matchB[1]);
  //       const lengthB = parseInt(matchB[2]);

  //       // 最初に径で比較
  //       if (diameterA !== diameterB) {
  //         return diameterA - diameterB;
  //       }
  //       // 径が同じ場合は長さで比較
  //       return lengthA - lengthB;
  //     }

  //     // "M"から始まらないボルトサイズ（D-Lock等）は、通常の文字順でソート
  //     return a.localeCompare(b);
  //   });
  //   // ▲▲▲ ここまでが修正箇所 ▲▲▲

  //   const existingMap = project.tempBoltMap || {};
  //   const rowsHtml = sortedFinalBolts
  //     .map((boltSize) => {
  //       const boltSeriesMatch = boltSize.match(/M\d+/);
  //       if (!boltSeriesMatch) return "";

  //       const boltSeries = boltSeriesMatch[0];
  //       const availableHugBolts = HUG_BOLT_SIZES[boltSeries] || [];
  //       const savedHugBolt = existingMap[boltSize] || "";
  //       const hugBoltOptions = availableHugBolts
  //         .map(
  //           (size) =>
  //             `<option value="${size}" ${
  //               size === savedHugBolt ? "selected" : ""
  //             }>${size}</option>`,
  //         )
  //         .join("");
  //       return `
  //               <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
  //                   <label class="font-medium text-slate-800 dark:text-slate-100">本ボルト: ${boltSize}</label>
  //                   <select data-final-bolt="${boltSize}" class="temp-bolt-map-select w-full bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 rounded-lg p-2 focus:ring-yellow-500 focus:border-yellow-500">
  //                       <option value="">仮ボルトを選択...</option>
  //                       ${hugBoltOptions}
  //                   </select>
  //               </div>`;
  //     })
  //     .join("");
  //   tempBoltMappingContainer.innerHTML = `<div class="space-y-3">${rowsHtml}</div>`;
  // };

  // const populateJointDropdownForEdit = (selectElement, currentJointId) => {
  //   const project = state.projects.find((p) => p.id === state.currentProjectId);
  //   if (!project) return;

  //   selectElement.innerHTML = "";
  //   const availableJoints = project.joints
  //     .filter((j) => !j.countAsMember)
  //     .sort((a, b) => a.name.localeCompare(b.name, "ja"));

  //   availableJoints.forEach((joint) => {
  //     const option = document.createElement("option");
  //     option.value = joint.id;
  //     option.textContent = joint.name;
  //     if (joint.id === currentJointId) {
  //       option.selected = true;
  //     }
  //     selectElement.appendChild(option);
  //   });
  // };

  const populateHugBoltSelector = (selectElement) => {
    const allHugBolts = Object.values(HUG_BOLT_SIZES).flat();
    selectElement.innerHTML = '<option value="">サイズを選択...</option>';
    allHugBolts.forEach((size) => {
      const option = document.createElement("option");
      option.value = size;
      option.textContent = size;
      selectElement.appendChild(option);
    });
  };

  const resetJointForm = () => {
    jointNameInput.value = "";
    // ▼▼▼ 追加：常設フォームのカラー設定リセット ▼▼▼
    if (jointColorToggle) {
      jointColorToggle.checked = false;
      jointColorSection.classList.add("hidden");
      jointColorInput.value = "#ffffff";
      renderStaticColorPalette(null);
    }
    // ▲▲▲ 追加ここまで ▲▲▲
    // ▼▼▼ 修正：色のリセット ▼▼▼
    // editJointColorInput.value = '#ffffff';
    // editJointColorInput.dataset.isNull = "true";
    if (typeof editJointColorInput !== "undefined" && editJointColorInput) {
      editJointColorInput.value = "#ffffff";
      editJointColorInput.dataset.isNull = "true";
      renderColorPalette(null);
    }
    // ▲▲▲ 修正ここまで ▲▲▲
    flangeSizeInput.value = "";
    flangeCountInput.value = "";
    webSizeInput.value = "";
    webCountInput.value = "";
    shopTempBoltCountInput.value = "";
    shopTempBoltSizeInput.value = "";
    isPinJointInput.checked = false;
    isDoubleShearInput.checked = false;
    countAsMemberInput.checked = false;
    hasShopSplInput.checked = false;
    hasBoltCorrectionInput.checked = false;
    tempBoltSettingInput.value = "calculated";
    isComplexSplInput.checked = false;
    complexSplCountInput.value = "2";
    newComplexSplCache = Array.from({ length: 4 }, () => ({
      size: "",
      count: "",
    }));
    if (isBundledWithColumnInput) isBundledWithColumnInput.checked = false; // ★追加
    updateJointFformUI(false);
  };

  const generateCustomInputFields = (count, container, prefix, values = []) => {
    container.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const input = document.createElement("input");
      input.type = "text";
      input.className = `custom-input w-full bg-white border border-gray-400 text-gray-900 rounded-md p-2 focus:ring-yellow-500 focus:border-yellow-500`;
      input.placeholder = `${prefix.includes("level") ? "階層" : "エリア"} ${
        i + 1
      }`;
      input.id = `${prefix}-${i}`;
      input.value = values[i] || "";
      container.appendChild(input);
    }
  };
  // (Remaining functions would be here in the full code)

  // ★ 修正版：UI更新処理（胴縁などの単一ボルト表示バグ修正済み）
  // const updateJointFormUI = (isModal) => {
  //   const prefix = isModal ? "edit-" : "";
  //   const elements = {
  //     type: document.getElementById(`${prefix}joint-type`),
  //     tempSetting: document.getElementById(`${prefix}temp-bolt-setting`),
  //     isPin: document.getElementById(`${prefix}is-pin-joint`),
  //     isDoubleShear: document.getElementById(`${prefix}is-double-shear`),
  //     isComplexSpl: document.getElementById(`${prefix}is-complex-spl`),
  //     hasShopSpl: document.getElementById(`${prefix}has-shop-spl`),
  //     hasBoltCorrection: document.getElementById(
  //       `${prefix}has-bolt-correction`,
  //     ),
  //     webGroup: document.getElementById(
  //       isModal ? "edit-web-group" : "web-input-group",
  //     ),
  //     flangeGroup: document.getElementById(
  //       isModal ? "edit-flange-group" : "flange-input-group",
  //     ),
  //     pinGroup: document.getElementById(`${prefix}pin-joint-group`),
  //     shearGroup: document.getElementById(`${prefix}double-shear-group`),
  //     splGroup: document.getElementById(`${prefix}shop-spl-group`),
  //     complexSplGroup: document.getElementById(`${prefix}complex-spl-group`),
  //     complexSplCountGroup: document.getElementById(
  //       `${prefix}complex-spl-count-group`,
  //     ),
  //     manualTempBoltGroupSingle: document.getElementById(
  //       `${prefix}shop-temp-bolt-group-single`,
  //     ),
  //     manualTempBoltGroupDual: document.getElementById(
  //       `${prefix}shop-temp-bolt-group-dual`,
  //     ),
  //     flangePlaceholder: document.getElementById(`${prefix}flange-size`),
  //     flangeLabel: document.getElementById(`${prefix}flange-label`),
  //   };

  //   // ▼▼▼ 追加: 要素の取得 ▼▼▼
  //   const bundleGroup = document.getElementById(`${prefix}bundle-column-group`);
  //   const isBundledInput = document.getElementById(
  //     `${prefix}is-bundled-with-column`,
  //   );
  //   // ▲▲▲ 追加ここまで ▲▲▲

  //   const type = elements.type.value;
  //   // ピン接合が可能なタイプ
  //   const twoBoltTypes = ["girder", "beam", "other", "stud"];
  //   // 単一ボルト入力のタイプ
  //   const oneBoltTypes = ["column", "wall_girt", "roof_purlin"];

  //   // ▼▼▼ 修正：タイプがピン非対応なら強制的にfalse扱いにする ▼▼▼
  //   // これにより、他でピンをONにしたまま胴縁に変えても入力欄が消えない
  //   const isPin = twoBoltTypes.includes(type) && elements.isPin?.checked;

  //   const tempSetting = elements.tempSetting?.value;
  //   const isDoubleShear = elements.isDoubleShear?.checked;

  //   // ▼▼▼ 追加: 本柱の場合は「本柱と同梱」オプションを隠す ▼▼▼
  //   if (bundleGroup) {
  //     if (type === "column") {
  //       bundleGroup.classList.add("hidden");
  //       if (isBundledInput) isBundledInput.checked = false; // 非表示時はOFFにする
  //     } else {
  //       bundleGroup.classList.remove("hidden");
  //     }
  //   }
  //   // ▲▲▲ 追加ここまで ▲▲▲
  //   // ▼▼▼ 修正：表示ロジックの整理 ▼▼▼
  //   if (oneBoltTypes.includes(type)) {
  //     // 胴縁・母屋・本柱の場合
  //     if (elements.flangeGroup) elements.flangeGroup.style.display = "grid"; // 常に表示
  //     if (elements.webGroup) elements.webGroup.style.display = "none"; // 常に非表示
  //   } else {
  //     // 大梁・小梁などの場合
  //     if (elements.flangeGroup)
  //       elements.flangeGroup.style.display = isPin ? "none" : "grid";
  //     if (elements.webGroup) elements.webGroup.style.display = "grid";
  //   }
  //   // ▲▲▲ 修正ここまで ▲▲▲

  //   const complexSplApplicableTypes = ["girder", "beam", "stud", "other"];
  //   const showComplexSplOption =
  //     complexSplApplicableTypes.includes(type) &&
  //     tempSetting === "calculated" &&
  //     isPin &&
  //     isDoubleShear;

  //   if (elements.complexSplGroup) {
  //     elements.complexSplGroup.classList.toggle(
  //       "hidden",
  //       !showComplexSplOption,
  //     );
  //     if (!showComplexSplOption && elements.isComplexSpl)
  //       elements.isComplexSpl.checked = false;
  //   }
  //   if (elements.complexSplCountGroup && elements.isComplexSpl) {
  //     elements.complexSplCountGroup.classList.toggle(
  //       "hidden",
  //       !elements.isComplexSpl.checked,
  //     );
  //   }

  //   const applicableSplTypes = ["girder", "beam", "stud", "other"];
  //   const tempBoltExcludedTypes = ["wall_girt", "roof_purlin", "column"];

  //   if (elements.pinGroup)
  //     elements.pinGroup.classList.toggle(
  //       "hidden",
  //       !twoBoltTypes.includes(type),
  //     );
  //   if (elements.shearGroup)
  //     elements.shearGroup.classList.toggle("hidden", !isPin);

  //   const showSpl =
  //     applicableSplTypes.includes(type) && !(isPin && !isDoubleShear);
  //   if (elements.splGroup)
  //     elements.splGroup.classList.toggle("hidden", !showSpl);
  //   if (elements.hasShopSpl) elements.hasShopSpl.disabled = !showSpl;

  //   const disableBoltCorrection =
  //     !showSpl ||
  //     !elements.hasShopSpl?.checked ||
  //     (!isPin && tempSetting === "none" && elements.hasShopSpl?.checked);

  //   if (elements.hasBoltCorrection) {
  //     elements.hasBoltCorrection.disabled = disableBoltCorrection;
  //     if (disableBoltCorrection) elements.hasBoltCorrection.checked = false;
  //   }
  //   if (elements.tempSetting?.parentElement) {
  //     elements.tempSetting.parentElement.classList.toggle(
  //       "hidden",
  //       tempBoltExcludedTypes.includes(type),
  //     );
  //   }

  //   if (elements.manualTempBoltGroupSingle)
  //     elements.manualTempBoltGroupSingle.classList.add("hidden");
  //   if (elements.manualTempBoltGroupDual)
  //     elements.manualTempBoltGroupDual.classList.add("hidden");

  //   if (type === "column") {
  //     if (elements.manualTempBoltGroupSingle)
  //       elements.manualTempBoltGroupSingle.classList.remove("hidden");
  //     if (elements.flangePlaceholder)
  //       elements.flangePlaceholder.placeholder = "エレクションサイズ";
  //     if (elements.flangeLabel)
  //       elements.flangeLabel.textContent = "エレクション";
  //   } else if (oneBoltTypes.includes(type)) {
  //     // 胴縁・母屋
  //     if (elements.flangePlaceholder)
  //       elements.flangePlaceholder.placeholder = "ボルト サイズ";
  //     if (elements.flangeLabel) elements.flangeLabel.textContent = "ボルト情報";
  //   } else {
  //     // 大梁など
  //     if (elements.flangePlaceholder)
  //       elements.flangePlaceholder.placeholder = "フランジ サイズ";
  //     if (elements.flangeLabel) elements.flangeLabel.textContent = "フランジ";
  //     const showManualInputs =
  //       tempSetting === "none" &&
  //       elements.hasShopSpl?.checked &&
  //       applicableSplTypes.includes(type);
  //     if (showManualInputs) {
  //       if (isPin && isDoubleShear) {
  //         if (elements.manualTempBoltGroupSingle)
  //           elements.manualTempBoltGroupSingle.classList.remove("hidden");
  //       } else if (!isPin) {
  //         if (elements.manualTempBoltGroupDual)
  //           elements.manualTempBoltGroupDual.classList.remove("hidden");
  //       }
  //     }
  //   }

  //   const splCountInput = document.getElementById(`${prefix}complex-spl-count`);
  //   if (splCountInput && elements.isComplexSpl) {
  //     const splCount = parseInt(splCountInput.value);
  //     const cache = isModal ? editComplexSplCache : newComplexSplCache;
  //     renderComplexSplInputs(
  //       elements.isComplexSpl.checked ? splCount : 1,
  //       cache,
  //       isModal,
  //     );
  //   }
  // };
  const populateBoltSelectorModal = (currentValue) => {
    // currentValue引数を追加
    // ▼▼▼ 1. プロジェクトデータの取得を追加 ▼▼▼
    const project = state.projects.find((p) => p.id === state.currentProjectId);
    if (!project) return;

    // 安全装置（リストが無ければ復元）
    ensureProjectBoltSizes(project);
    // ▲▲▲ 追加ここまで ▲▲▲

    // ▼▼▼ 2. groupedBolts の生成ロジックを書き換え ▼▼▼
    const groupedBolts = project.boltSizes.reduce((acc, bolt) => {
      // データ自体に 'M16' や 'M16めっき' などの情報(type)を持たせているので、それを使うだけ！
      const groupKey = bolt.type;

      if (!acc[groupKey]) {
        acc[groupKey] = [];
      }

      // 従来のUI描画コードが文字列の配列を期待しているため、ID(名前)を入れる
      acc[groupKey].push(bolt.id);

      return acc;
    }, {});

    const groupOrder = Object.keys(groupedBolts).sort((a, b) => {
      const aIsD = a.startsWith("D"),
        bIsD = b.startsWith("D");
      const aIsNaka = a.startsWith("中"),
        bIsNaka = b.startsWith("中");

      if (aIsD && !bIsD) return 1;
      if (!aIsD && bIsD) return -1;
      if (aIsNaka && !(bIsD || bIsNaka)) return 1;
      if (!aIsNaka && (bIsD || bIsNaka)) return -1;

      const aMatch = a.match(/(\D+)(\d+)/),
        bMatch = b.match(/(\D+)(\d+)/);
      if (aMatch && bMatch) {
        if (aMatch[1] !== bMatch[1]) return aMatch[1].localeCompare(bMatch[1]);
        const numA = parseInt(aMatch[2]),
          numB = parseInt(bMatch[2]);
        if (numA !== numB) return numA - numB;
      }
      return a.localeCompare(b);
    });

    boltOptionsContainer.innerHTML = groupOrder
      .map((group) => {
        const buttonsHtml = groupedBolts[group]
          .map((size) => {
            let displayText = size;
            if (size.startsWith("中ボ")) {
              displayText = size.substring(2);
            } else if (size.startsWith("中")) {
              displayText = size.substring(1);
            }

            // ▼▼▼ 修正箇所 ▼▼▼
            // 現在選択中の値と一致すればハイライト用のクラスを付与
            const isSelected = size === currentValue;
            const selectedClass = isSelected
              ? "bg-yellow-400 dark:bg-yellow-600 font-bold"
              : "bg-blue-50 dark:bg-slate-700";

            return `
                <button data-size="${size}" class="bolt-option-btn text-sm p-2 border border-blue-200 rounded-md transition-transform duration-150 hover:scale-105 ${selectedClass}">
                    ${displayText}
                </button>`;
            // ▲▲▲ 修正ここまで ▲▲▲
          })
          .join("");

        return `
                    <div class="mb-4">
                        <h4 class="font-bold text-blue-800 border-b border-blue-200 pb-1 mb-2">${group}</h4>
                        <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                           ${buttonsHtml}
                        </div>
                    </div>`;
      })
      .join("");
  };
  // --- History Management Functions ---
  const updateUndoRedoButtons = () => {
    const canUndo = history.currentIndex > 0;
    const canRedo = history.currentIndex < history.stack.length - 1;

    [undoBtn, mobileUndoBtn].forEach((btn) => (btn.disabled = !canUndo));
    [redoBtn, mobileRedoBtn].forEach((btn) => (btn.disabled = !canRedo));
  };

  const saveStateToHistory = (projectsData) => {
    if (isUndoRedoOperation) return;

    if (history.currentIndex < history.stack.length - 1) {
      history.stack = history.stack.slice(0, history.currentIndex + 1);
    }

    history.stack.push(JSON.parse(JSON.stringify(projectsData)));
    history.currentIndex++;

    if (history.stack.length > MAX_HISTORY_SIZE) {
      history.stack.shift();
      history.currentIndex--;
    }
    updateUndoRedoButtons();
  };

  const performHistoryAction = (action) => {
    if (action === "undo" && history.currentIndex > 0) {
      isUndoRedoOperation = true;
      history.currentIndex--;
    } else if (
      action === "redo" &&
      history.currentIndex < history.stack.length - 1
    ) {
      isUndoRedoOperation = true;
      history.currentIndex++;
    } else {
      return;
    }

    state.projects = JSON.parse(
      JSON.stringify(history.stack[history.currentIndex]),
    );

    if (views.detail.classList.contains("active")) {
      renderDetailView();
    } else {
      renderProjectList();
    }
    updateUndoRedoButtons();

    setTimeout(() => {
      isUndoRedoOperation = false;
    }, 100);
  };

  // --- Rendering Functions ---
  // ★ 修正版：renderProjectList（グリッド表示・コンパクトカード化）
  const renderProjectList = () => {
    if (state.projects.length === 0) {
      projectsContainer.innerHTML =
        '<p class="text-center text-gray-500 dark:text-gray-400">まだ工事が登録されていません。</p>';
      return;
    }

    const groupedProjects = {};
    const unGroupedProjects = [];

    // 1. プロジェクトを物件名でグループ化
    state.projects.forEach((p) => {
      if (p.propertyName) {
        if (!groupedProjects[p.propertyName]) {
          groupedProjects[p.propertyName] = [];
        }
        groupedProjects[p.propertyName].push(p);
      } else {
        unGroupedProjects.push(p);
      }
    });

    let html = "";

    // 2. グループ化されたプロジェクトのHTMLを生成
    for (const propertyName in groupedProjects) {
      const projectsInGroup = groupedProjects[propertyName];
      html += `
            <section class="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 mb-6">
                <div class="flex flex-col sm:flex-row justify-between sm:items-center mb-4 border-b border-slate-300 dark:border-slate-600 pb-3 gap-2">
                    <h3 class="text-xl font-bold text-slate-800 dark:text-slate-200 truncate" title="${propertyName}">
                        <span class="text-sm font-normal text-slate-500">物件名：</span>${propertyName}
                    </h3>
                    <div class="flex items-center gap-2">
                        <button data-property-name="${propertyName}" class="edit-group-btn btn btn-neutral text-sm">物件情報編集</button>
                        <button data-property-name="${propertyName}" class="show-aggregated-results-btn btn btn-secondary text-sm">集計結果表示</button>
                    </div>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            `;
      projectsInGroup.forEach((p) => {
        let description =
          p.mode === "advanced"
            ? `${p.customLevels.length}階層 / ${p.customAreas.length}エリア`
            : `${p.floors}階建て (+R階${p.hasPH ? ", +PH階" : ""}) / ${
                p.sections
              }工区`;

        // ▼▼▼ 修正: カード内を縦並びにし、ボタンをグリッド配置で整列 ▼▼▼
        html += `
                <div class="project-card cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-600 transition-colors bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 p-3 rounded-lg flex flex-col justify-between gap-3 h-full" data-id="${p.id}">
                    <div>
                        <h4 class="font-bold text-slate-900 dark:text-slate-100 mb-1">${p.name}</h4>
                        <p class="text-sm text-slate-600 dark:text-slate-400">${description}</p>
                    </div>
                    <div class="grid grid-cols-4 gap-2 w-full">
                        <button data-id="${p.id}" class="select-project-btn btn btn-primary text-xs px-1 py-2 flex justify-center items-center">選択</button>
                        <button data-id="${p.id}" class="edit-project-btn btn btn-neutral text-xs px-1 py-2 flex justify-center items-center">編集</button>
                        <button data-id="${p.id}" class="duplicate-project-btn btn btn-secondary text-xs px-1 py-2 flex justify-center items-center" title="複製">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        </button>
                        <button data-id="${p.id}" class="delete-project-btn btn btn-danger text-xs px-1 py-2 flex justify-center items-center">削除</button>
                    </div>
                </div>`;
      });
      html += `</div></section>`;
    }

    // 3. グループ化されていないプロジェクトのHTMLを生成
    if (unGroupedProjects.length > 0) {
      if (Object.keys(groupedProjects).length > 0) {
        html += `<h3 class="text-lg font-semibold text-slate-700 dark:text-slate-300 my-4 border-t pt-4">物件名未設定の工事</h3>`;
      }

      // ▼▼▼ 修正: こちらもグリッドレイアウトに変更 ▼▼▼
      html += `<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">`;

      unGroupedProjects.forEach((p) => {
        let description =
          p.mode === "advanced"
            ? `${p.customLevels.length}階層 / ${p.customAreas.length}エリア`
            : `${p.floors}階建て (+R階${p.hasPH ? ", +PH階" : ""}) / ${
                p.sections
              }工区`;

        html += `
                <div class="project-card cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-lg flex flex-col justify-between gap-3 h-full shadow-sm" data-id="${p.id}">
                    <div>
                        <h4 class="font-bold text-lg text-slate-900 dark:text-slate-100 mb-1">${p.name}</h4>
                        <p class="text-sm text-slate-700 dark:text-slate-300">${description}</p>
                    </div>
                    <div class="grid grid-cols-4 gap-2 w-full">
                        <button data-id="${p.id}" class="select-project-btn btn btn-primary text-xs px-1 py-2 flex justify-center items-center">選択</button>
                        <button data-id="${p.id}" class="edit-project-btn btn btn-secondary text-xs px-1 py-2 flex justify-center items-center">編集</button>
                        <button data-id="${p.id}" class="duplicate-project-btn btn btn-secondary text-xs px-1 py-2 flex justify-center items-center" title="複製">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        </button>
                        <button data-id="${p.id}" class="delete-project-btn btn btn-danger text-xs px-1 py-2 flex justify-center items-center">削除</button>
                    </div>
                </div>`;
      });

      html += `</div>`; // grid閉じ
    }

    projectsContainer.innerHTML = html;
  };
  // ★ 修正版：renderJointsList（迷子データ救済機能付き）
  // ★ 修正版：renderJointsList（ボルトサイズ順ソート対応）
  // ★ 修正版：renderJointsList（セクション別ソート・複合SPLヘッダー対応）
  // ★ 修正版：renderJointsList（ソート・色バッジ・不整合データ表示対応の完全版）
  // ★ 修正版：renderJointsList（複合SPLの1本目ソート対応）
  // ★ 修正版：renderJointsList（安全なソート対応版）
  const renderJointsList = (project) => {
    if (!project) return;
    const container = document.getElementById("joint-lists-container");
    const renderedJointIds = new Set();

    // ヘッダークリックイベント
    if (!container.dataset.listenerAdded) {
      container.addEventListener("click", (e) => {
        const th = e.target.closest("th[data-sort-key]");
        if (th) {
          const sectionDiv = th.closest("div[data-section-id]");
          if (!sectionDiv) return;
          const sectionId = sectionDiv.dataset.sectionId;
          const key = th.dataset.sortKey;

          if (!state.sort[sectionId])
            state.sort[sectionId] = { key: null, order: "asc" };
          const currentSort = state.sort[sectionId];

          if (currentSort.key === key) {
            currentSort.order = currentSort.order === "asc" ? "desc" : "asc";
          } else {
            currentSort.key = key;
            currentSort.order = "asc";
          }
          renderJointsList(
            state.projects.find((p) => p.id === state.currentProjectId),
          );
        }
      });
      container.dataset.listenerAdded = "true";
    }
    /**
     * ▼▼▼ 新規追加: ボルトサイズのプルダウンを生成する共通関数 ▼▼▼
     * * @param {HTMLElement} selectElement - <select>タグのDOM要素
     * @param {string} selectedValue - 初期選択しておきたい値（編集時など）
     */
    const populateBoltSizeSelect = (selectElement, selectedValue = "") => {
      const project = state.projects.find(
        (p) => p.id === state.currentProjectId,
      );
      if (!project) return;

      // 安全装置: リストがなければ復元する
      ensureProjectBoltSizes(project);

      // 一旦中身を空にして、「選択...」を追加
      selectElement.innerHTML = '<option value="">選択...</option>';

      // プロジェクトに保存されている設定(project.boltSizes)を使ってoptionを作る
      project.boltSizes.forEach((bolt) => {
        const option = document.createElement("option");
        option.value = bolt.id;
        option.textContent = bolt.label; // 例: "M16x45"

        // 編集時など、既に値が決まっている場合はそれを選択状態にする
        if (bolt.id === selectedValue) {
          option.selected = true;
        }
        selectElement.appendChild(option);
      });
    };
    const populateTable = (tbodyId, joints, color) => {
      const tbody = document.getElementById(tbodyId);
      if (!tbody) return;
      tbody.innerHTML = joints
        .map((joint) => {
          const isPin = joint.isPinJoint || false;
          const countAsMemberHtml = joint.countAsMember
            ? '<span class="text-green-600 font-bold">✔</span>'
            : '<span class="text-gray-400 dark:text-gray-500">-</span>';
          const colorBadge = joint.color
            ? `<span class="inline-block w-3 h-3 rounded-full ml-2 border border-gray-400" style="background-color: ${joint.color}; vertical-align: middle;"></span>`
            : "";

          let boltInfo = "";
          if (joint.isComplexSpl && joint.webInputs) {
            const webInfo = joint.webInputs
              .map((w) => `${w.size || "-"} / ${w.count}本`)
              .join(",<br>");
            boltInfo = `<td class="px-4 py-3 border-b border-r border-slate-400 dark:border-slate-600">${webInfo}</td>`;
          } else {
            const singleBoltTypes = ["column", "wall_girt", "roof_purlin"];
            if (singleBoltTypes.includes(joint.type)) {
              boltInfo = `<td class="px-4 py-3 border-b border-r border-slate-400 dark:border-slate-600">${
                joint.flangeSize || "-"
              } / ${joint.flangeCount}本</td>`;
            } else if (isPin) {
              boltInfo = `<td class="px-4 py-3 border-b border-r border-slate-400 dark:border-slate-600">${
                joint.webSize || "-"
              } / ${joint.webCount}本</td>`;
            } else {
              boltInfo = `<td class="px-4 py-3 border-b border-r border-slate-400 dark:border-slate-600">${
                joint.flangeSize || "-"
              } / ${joint.flangeCount}本</td>
                                        <td class="px-4 py-3 border-b border-r border-slate-400 dark:border-slate-600">${
                                          joint.webSize || "-"
                                        } / ${joint.webCount}本</td>`;
            }
          }

          const borderColor = "border-slate-400",
            darkBorderColor = "dark:border-slate-600";
          const tempBoltCells = (() => {
            if (["wall_girt", "roof_purlin", "column"].includes(joint.type))
              return "";
            const tempBoltInfo = getTempBoltInfo(joint, project.tempBoltMap);
            if (joint.isComplexSpl) {
              const webTempInfo = tempBoltInfo.webs
                .map((info) => {
                  const className = info.text.includes("未設定")
                    ? "text-red-600 font-bold"
                    : "";
                  return `<span class="${className}" title="${info.formula}">${info.text}</span>`;
                })
                .join(",<br>");
              return `<td class="px-4 py-3 text-center border-b border-r ${borderColor} ${darkBorderColor}">${webTempInfo}</td>`;
            }
            const twoColumns =
              ["girder", "beam", "other", "stud"].includes(joint.type) &&
              !joint.isPinJoint;
            if (twoColumns) {
              const flangeClass = tempBoltInfo.flange.text.includes("未設定")
                ? "text-red-600 font-bold"
                : "";
              const webClass = tempBoltInfo.web.text.includes("未設定")
                ? "text-red-600 font-bold"
                : "";
              return `<td class="px-4 py-3 text-center border-b border-r ${borderColor} ${darkBorderColor} ${flangeClass}" title="${tempBoltInfo.flange.formula}">${tempBoltInfo.flange.text}</td>
                                        <td class="px-4 py-3 text-center border-b border-r ${borderColor} ${darkBorderColor} ${webClass}" title="${tempBoltInfo.web.formula}">${tempBoltInfo.web.text}</td>`;
            } else {
              const singleClass = tempBoltInfo.single.text.includes("未設定")
                ? "text-red-600 font-bold"
                : "";
              return `<td class="px-4 py-3 text-center border-b border-r ${borderColor} ${darkBorderColor} ${singleClass}" title="${tempBoltInfo.single.formula}">${tempBoltInfo.single.text}</td>`;
            }
          })();

          return `
                        <tr class="bg-${color}-50 dark:bg-transparent hover:bg-${color}-100 dark:hover:bg-slate-700/50">
                            <td class="px-4 py-3 text-center border-b border-r ${borderColor} ${darkBorderColor}">
                                <div class="flex justify-center gap-2 whitespace-nowrap">
                                    <button data-id="${joint.id}" class="edit-joint-btn text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-semibold">編集</button>
                                    <button data-id="${joint.id}" class="delete-joint-btn text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-semibold">削除</button>
                                </div>
                            </td>
                            <td class="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 border-b border-r ${borderColor} ${darkBorderColor}">
                                ${joint.name}${colorBadge}
                            </td>
                            ${boltInfo}
                            <td class="px-4 py-3 text-center border-b border-r ${borderColor} ${darkBorderColor}">${countAsMemberHtml}</td>
                            ${tempBoltCells}
                        </tr>`;
        })
        .join("");
    };

    const sections = [
      {
        type: "girder",
        isPin: false,
        title: "大梁",
        color: "blue",
        cols: [
          { label: "操作", key: null },
          { label: "継手名", key: "name" },
          { label: "フランジ", key: "flange" },
          { label: "ウェブ", key: "web" },
          { label: "部材カウント", key: "countAsMember" },
          { label: "仮ボルト(フランジ)", key: "temp-flange" },
          { label: "仮ボルト(ウェブ)", key: "temp-web" },
        ],
      },
      {
        type: "girder",
        isPin: true,
        title: "大梁 (ピン取り)",
        color: "cyan",
        cols: [
          { label: "操作", key: null },
          { label: "継手名", key: "name" },
          { label: "ウェブ", key: "web" },
          { label: "部材カウント", key: "countAsMember" },
          { label: "仮ボルト", key: "temp-web" },
        ],
      },
      {
        type: "beam",
        isPin: false,
        title: "小梁",
        color: "green",
        cols: [
          { label: "操作", key: null },
          { label: "継手名", key: "name" },
          { label: "フランジ", key: "flange" },
          { label: "ウェブ", key: "web" },
          { label: "部材カウント", key: "countAsMember" },
          { label: "仮ボルト(フランジ)", key: "temp-flange" },
          { label: "仮ボルト(ウェブ)", key: "temp-web" },
        ],
      },
      {
        type: "beam",
        isPin: true,
        title: "小梁 (ピン取り)",
        color: "teal",
        cols: [
          { label: "操作", key: null },
          { label: "継手名", key: "name" },
          { label: "ウェブ", key: "web" },
          { label: "部材カウント", key: "countAsMember" },
          { label: "仮ボルト", key: "temp-web" },
        ],
      },
      {
        type: "stud",
        isPin: false,
        title: "間柱",
        color: "indigo",
        cols: [
          { label: "操作", key: null },
          { label: "継手名", key: "name" },
          { label: "フランジボルト", key: "flange" },
          { label: "ウェブボルト", key: "web" },
          { label: "部材カウント", key: "countAsMember" },
          { label: "仮ボルト(フランジ)", key: "temp-flange" },
          { label: "仮ボルト(ウェブ)", key: "temp-web" },
        ],
      },
      {
        type: "stud",
        isPin: true,
        title: "間柱 (ピン取り)",
        color: "purple",
        cols: [
          { label: "操作", key: null },
          { label: "継手名", key: "name" },
          { label: "ボルトサイズ", key: "bolt" },
          { label: "部材カウント", key: "countAsMember" },
          { label: "仮ボルト", key: "temp-web" },
        ],
      },
      {
        type: "column",
        isPin: false,
        title: "本柱",
        color: "red",
        cols: [
          { label: "操作", key: null },
          { label: "継手名", key: "name" },
          { label: "エレクション", key: "bolt" },
          { label: "部材カウント", key: "countAsMember" },
        ],
      },
      {
        type: "wall_girt",
        isPin: false,
        title: "胴縁",
        color: "gray",
        cols: [
          { label: "操作", key: null },
          { label: "継手名", key: "name" },
          { label: "ボルトサイズ", key: "bolt" },
          { label: "部材カウント", key: "countAsMember" },
        ],
      },
      {
        type: "roof_purlin",
        isPin: false,
        title: "母屋",
        color: "orange",
        cols: [
          { label: "操作", key: null },
          { label: "継手名", key: "name" },
          { label: "ボルトサイズ", key: "bolt" },
          { label: "部材カウント", key: "countAsMember" },
        ],
      },
      {
        type: "other",
        isPin: false,
        title: "その他",
        color: "amber",
        cols: [
          { label: "操作", key: null },
          { label: "継手名", key: "name" },
          { label: "フランジ", key: "flange" },
          { label: "ウェブ", key: "web" },
          { label: "部材カウント", key: "countAsMember" },
          { label: "仮ボルト(フランジ)", key: "temp-flange" },
          { label: "仮ボルト(ウェブ)", key: "temp-web" },
        ],
      },
      {
        type: "other",
        isPin: true,
        title: "その他 (ピン取り)",
        color: "amber",
        cols: [
          { label: "操作", key: null },
          { label: "継手名", key: "name" },
          { label: "ボルト", key: "bolt" },
          { label: "部材カウント", key: "countAsMember" },
          { label: "仮ボルト", key: "temp-web" },
        ],
      },
    ];

    let html = "";
    const sectionsToRender = [];
    sections.forEach((section) => {
      const filteredJoints = project.joints.filter(
        (j) =>
          j.type === section.type && (j.isPinJoint || false) === section.isPin,
      );
      if (filteredJoints.length > 0) {
        filteredJoints.forEach((j) => renderedJointIds.add(j.id));

        const tbodyId = `joints-list-${section.type}${
          section.isPin ? "-pin" : ""
        }`;
        let finalCols = section.cols;
        if (filteredJoints.some((j) => j.isComplexSpl)) {
          if (section.isPin) {
            finalCols = [
              { label: "操作", key: null },
              { label: "継手名", key: "name" },
              { label: "ウェブ (複合SPL)", key: "web_complex" },
              { label: "部材カウント", key: "countAsMember" },
              { label: "仮ボルト (複合SPL)", key: "temp_web_complex" },
            ];
          }
        }

        const sectionId = `joint-${section.type}-${
          section.isPin ? "pin" : "rigid"
        }`;
        const sortState = state.sort[sectionId];

        if (sortState && sortState.key) {
          filteredJoints.sort((a, b) => {
            const key = sortState.key;

            if (key === "name") {
              if (a.name < b.name) return sortState.order === "asc" ? -1 : 1;
              if (a.name > b.name) return sortState.order === "asc" ? 1 : -1;
              return 0;
            } else if (key === "flange" || key === "web") {
              const sizeA = key === "flange" ? a.flangeSize : a.webSize;
              const sizeB = key === "flange" ? b.flangeSize : b.webSize;
              const cmp = boltSort(sizeA || "", sizeB || "");
              if (cmp !== 0) return sortState.order === "asc" ? cmp : -cmp;

              const countA = key === "flange" ? a.flangeCount : a.webCount;
              const countB = key === "flange" ? b.flangeCount : b.webCount;
              return sortState.order === "asc"
                ? countA - countB
                : countB - countA;
            } else if (key === "bolt") {
              // ▼▼▼ 修正：flangeSize か webSize のどちらかある方を使う ▼▼▼
              const sizeA = a.flangeSize || a.webSize || "";
              const sizeB = b.flangeSize || b.webSize || "";
              const cmp = boltSort(sizeA, sizeB);
              return sortState.order === "asc" ? cmp : -cmp;
            }
            // ▼▼▼ 修正：部材カウントを安全に比較 ▼▼▼
            else if (key === "countAsMember") {
              const valA = a.countAsMember ? 1 : 0;
              const valB = b.countAsMember ? 1 : 0;
              return sortState.order === "asc" ? valA - valB : valB - valA;
            }
            // ▲▲▲ 修正ここまで ▲▲▲
            else if (key === "web_complex") {
              // データ取得ヘルパー：単純なwebSizeか、複合の1本目か
              const getFirstSize = (j) => {
                if (j.isComplexSpl && j.webInputs && j.webInputs.length > 0) {
                  return { size: j.webInputs[0].size, isComplex: true };
                }
                // 複合列だが単純継手が混ざっている場合（念のため）
                return { size: j.webSize || "", isComplex: false };
              };

              const infoA = getFirstSize(a);
              const infoB = getFirstSize(b);

              // 1. 単純継手(Not Complex) < 複合継手(Complex) の順にする
              // ※もし「複合列」には複合継手しか表示されない仕様ならこの分岐は不要ですが、
              //  データの混在に備えて実装しておくと安全です。
              if (infoA.isComplex !== infoB.isComplex) {
                // false(単純) < true(複合) としたい場合
                const valA = infoA.isComplex ? 1 : 0;
                const valB = infoB.isComplex ? 1 : 0;
                return sortState.order === "asc" ? valA - valB : valB - valA;
              }

              // 2. サイズで比較
              const cmp = boltSort(infoA.size, infoB.size);
              if (cmp !== 0) return sortState.order === "asc" ? cmp : -cmp;

              // 3. 全く同じサイズなら文字列全体で比較
              const strA = a.webInputs
                ? a.webInputs.map((w) => `${w.size}-${w.count}`).join(",")
                : "";
              const strB = b.webInputs
                ? b.webInputs.map((w) => `${w.size}-${w.count}`).join(",")
                : "";
              if (strA < strB) return sortState.order === "asc" ? -1 : 1;
              if (strA > strB) return sortState.order === "asc" ? 1 : -1;
              return 0;
            }
          });
        }

        const headerHtml = finalCols
          .map((col) => {
            let sortIcon = "";
            let cursorClass = "";
            let dataAttr = "";
            if (col.key) {
              cursorClass =
                "cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors";
              dataAttr = `data-sort-key="${col.key}"`;
              if (sortState && sortState.key === col.key) {
                sortIcon = sortState.order === "asc" ? " ▲" : " ▼";
              }
            }
            return `<th class="px-4 py-3 whitespace-nowrap ${cursorClass}" ${dataAttr}>${col.label}${sortIcon}</th>`;
          })
          .join("");

        const anchorId = `anchor-joint-${section.type}-${
          section.isPin ? "pin" : "rigid"
        }`;

        html += `
                        <div id="${anchorId}" class="rounded-lg border border-slate-400 dark:border-slate-600 scroll-mt-24" data-section-title="継手：${section.title}" data-section-color="${section.color}" data-section-id="${sectionId}">
                            <h3 class="text-lg font-semibold bg-${section.color}-200 text-${section.color}-800 dark:bg-slate-700 dark:text-${section.color}-300 px-4 py-2 rounded-t-lg">${section.title}</h3>
                            <div class="overflow-x-auto custom-scrollbar bg-slate-50 dark:bg-slate-800 rounded-b-lg">
                                <table class="w-full min-w-[400px] text-sm text-left">
                                    <thead class="bg-${section.color}-100 text-${section.color}-700 dark:bg-slate-700/50 dark:text-${section.color}-300 text-xs"><tr>${headerHtml}</tr></thead>
                                    <tbody id="${tbodyId}"></tbody>
                                </table>
                            </div>
                        </div>`;
        sectionsToRender.push({
          tbodyId,
          filteredJoints,
          color: section.color,
        });
      }
    });

    // ... (unknownJoints の処理は変更なし) ...
    const unknownJoints = project.joints.filter(
      (j) => !renderedJointIds.has(j.id),
    );
    if (unknownJoints.length > 0) {
      const tbodyId = "joints-list-unknown";
      const headerHtml = [
        "操作",
        "継手名",
        "種別(内部値)",
        "ピン(内部値)",
        "部材カウント",
        "情報",
      ]
        .map((col) => `<th class="px-4 py-3 whitespace-nowrap">${col}</th>`)
        .join("");

      html += `
                    <div id="anchor-joint-unknown" class="rounded-lg border border-red-400 dark:border-red-600 scroll-mt-24" data-section-title="未分類・不整合データ" data-section-color="red">
                        <h3 class="text-lg font-semibold bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-100 px-4 py-2 rounded-t-lg flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
                            未分類・不整合データ (編集して保存し直すか削除してください)
                        </h3>
                        <div class="overflow-x-auto custom-scrollbar bg-red-50 dark:bg-slate-900/50 rounded-b-lg">
                            <table class="w-full min-w-[400px] text-sm text-left">
                                <thead class="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200 text-xs"><tr>${headerHtml}</tr></thead>
                                <tbody id="${tbodyId}"></tbody>
                            </table>
                        </div>
                    </div>`;

      sectionsToRender.push({
        tbodyId,
        filteredJoints: unknownJoints,
        color: "red",
        isUnknown: true,
      });
    }
    container.innerHTML = html;

    sectionsToRender.forEach((s) => {
      if (s.isUnknown) {
        const tbody = document.getElementById(s.tbodyId);
        if (tbody) {
          tbody.innerHTML = s.filteredJoints
            .map((joint) => {
              const countAsMemberHtml = joint.countAsMember
                ? '<span class="text-green-600 font-bold">✔</span>'
                : "-";
              const typeName = joint.type;
              const isPinText = joint.isPinJoint ? "ON" : "OFF";
              const borderColor = "border-slate-400",
                darkBorderColor = "dark:border-slate-600";
              const colorBadge = joint.color
                ? `<span class="inline-block w-3 h-3 rounded-full ml-2 border border-gray-400" style="background-color: ${joint.color}; vertical-align: middle;"></span>`
                : "";

              return `
                                <tr class="bg-red-50 dark:bg-transparent hover:bg-red-100 dark:hover:bg-red-900/30">
                                    <td class="px-4 py-3 text-center border-b border-r ${borderColor} ${darkBorderColor}">
                                        <div class="flex justify-center gap-2 whitespace-nowrap">
                                            <button data-id="${joint.id}" class="edit-joint-btn text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-semibold">編集</button>
                                            <button data-id="${joint.id}" class="delete-joint-btn text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-semibold">削除</button>
                                        </div>
                                    </td>
                                    <td class="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 border-b border-r ${borderColor} ${darkBorderColor}">
                                        ${joint.name}${colorBadge}
                                    </td>
                                    <td class="px-4 py-3 border-b border-r ${borderColor} ${darkBorderColor}">${typeName}</td>
                                    <td class="px-4 py-3 border-b border-r ${borderColor} ${darkBorderColor}">${isPinText}</td>
                                    <td class="px-4 py-3 text-center border-b border-r ${borderColor} ${darkBorderColor}">${countAsMemberHtml}</td>
                                    <td class="px-4 py-3 text-xs border-b border-r ${borderColor} ${darkBorderColor} text-red-600 dark:text-red-400">種類と設定の不一致</td>
                                </tr>`;
            })
            .join("");
        }
      } else {
        populateTable(s.tbodyId, s.filteredJoints, s.color);
      }
    });
  };
  const resetMemberForm = () => {
    memberNameInput.value = "";
    memberJointSelectInput.value = "";
    memberJointSelectId.value = "";
  };

  // ★ 修正版：renderMemberLists（操作列を左端に移動）
  // ★ 修正版：renderMemberLists（ボルトソート修正・間柱ピン等対応版）
  const renderMemberLists = (project) => {
    if (!project) return;
    const container = document.getElementById("member-lists-container");
    const tabsContainer = document.getElementById("member-list-tabs");

    // ヘッダークリックイベント
    if (!container.dataset.listenerAdded) {
      container.addEventListener("click", (e) => {
        const th = e.target.closest("th[data-sort-key]");
        if (th) {
          const sectionDiv = th.closest("div[data-section-id]");
          if (!sectionDiv) return;
          const sectionId = sectionDiv.dataset.sectionId;
          const key = th.dataset.sortKey;

          if (!state.sort[sectionId])
            state.sort[sectionId] = { key: null, order: "asc" };
          const currentSort = state.sort[sectionId];

          if (currentSort.key === key) {
            currentSort.order = currentSort.order === "asc" ? "desc" : "asc";
          } else {
            currentSort.key = key;
            currentSort.order = "asc";
          }
          renderMemberLists(
            state.projects.find((p) => p.id === state.currentProjectId),
          );
        }
      });
      container.dataset.listenerAdded = "true";
    }

    // 1. 階層タブ生成
    const levels = getProjectLevels(project);
    let tabsHtml = `<button class="level-tab-btn px-3 py-1 rounded-full text-sm font-bold transition-colors border ${
      state.activeMemberLevel === "all"
        ? "bg-blue-600 text-white border-blue-600"
        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600 hover:bg-slate-100"
    }" data-level="all">全て</button>`;
    levels.forEach((lvl) => {
      const isActive = state.activeMemberLevel === lvl.id;
      const activeClass = isActive
        ? "bg-blue-600 text-white border-blue-600"
        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600 hover:bg-slate-100";
      tabsHtml += `<button class="level-tab-btn px-3 py-1 rounded-full text-sm font-bold transition-colors border ${activeClass}" data-level="${lvl.id}">${lvl.label}</button>`;
    });
    tabsContainer.innerHTML = tabsHtml;
    tabsContainer.querySelectorAll(".level-tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.activeMemberLevel = btn.dataset.level;
        renderMemberLists(project);
      });
    });

    // 2. 部材データのフィルタリング
    const jointsMap = new Map(project.joints.map((j) => [j.id, j]));
    const allMembers = [
      ...(project.members || []).map((m) => ({ ...m, isMember: true })),
      ...project.joints
        .filter((j) => j.countAsMember)
        .map((j) => ({
          id: j.id,
          name: j.name,
          jointId: j.id,
          isMember: false,
        })),
    ]
      .map((m) => ({ ...m, joint: jointsMap.get(m.jointId) }))
      .filter((m) => m.joint)
      .filter((m) => {
        if (state.activeMemberLevel === "all") return true;
        if (!m.isMember) return true;
        if (!m.targetLevels || m.targetLevels.length === 0) return true;
        return m.targetLevels.includes(state.activeMemberLevel);
      });

    const populateMemberTable = (tbodyId, members, color) => {
      const tbody = document.getElementById(tbodyId);
      if (!tbody) return;
      tbody.innerHTML = members
        .map((member) => {
          const { joint } = member;
          const borderColor = "border-slate-400",
            darkBorderColor = "dark:border-slate-600";
          const isPin = joint.isPinJoint || false;
          const colorBadge = joint.color
            ? `<span class="inline-block w-3 h-3 rounded-full ml-2 border border-gray-400" style="background-color: ${joint.color}; vertical-align: middle;"></span>`
            : "";

          let actionsHtml = member.isMember
            ? `<button data-id="${member.id}" class="edit-member-btn text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-semibold">編集</button>
                             <button data-id="${member.id}" class="delete-member-btn text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-semibold">削除</button>`
            : `<button data-joint-id="${member.jointId}" class="edit-joint-btn text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-semibold">継手編集</button>`;

          let boltInfo = "";
          if (joint.isComplexSpl && joint.webInputs) {
            const webInfo = joint.webInputs
              .map((w) => `${w.size || "-"} / ${w.count}本`)
              .join(",<br>");
            boltInfo = `<td class="px-4 py-3 border-b border-r ${borderColor} ${darkBorderColor}">${webInfo}</td>`;
          } else {
            const singleBoltTypes = ["column", "wall_girt", "roof_purlin"];
            if (singleBoltTypes.includes(joint.type)) {
              boltInfo = `<td class="px-4 py-3 border-b border-r ${borderColor} ${darkBorderColor}">${
                joint.flangeSize || "-"
              } / ${joint.flangeCount}本</td>`;
            } else if (isPin) {
              boltInfo = `<td class="px-4 py-3 border-b border-r ${borderColor} ${darkBorderColor}">${
                joint.webSize || "-"
              } / ${joint.webCount}本</td>`;
            } else {
              boltInfo = `<td class="px-4 py-3 border-b border-r ${borderColor} ${darkBorderColor}">${
                joint.flangeSize || "-"
              } / ${joint.flangeCount}本</td>
                                <td class="px-4 py-3 border-b border-r ${borderColor} ${darkBorderColor}">${
                                  joint.webSize || "-"
                                } / ${joint.webCount}本</td>`;
            }
          }

          let tempBoltInfoCells = "";
          if (!["wall_girt", "roof_purlin", "column"].includes(joint.type)) {
            const tempBoltInfo = getTempBoltInfo(joint, project.tempBoltMap);
            if (joint.isComplexSpl) {
              const webTempInfo = tempBoltInfo.webs
                .map((info) => {
                  const className = info.text.includes("未設定")
                    ? "text-red-600 font-bold"
                    : "";
                  return `<span class="${className}" title="${info.formula}">${info.text}</span>`;
                })
                .join(",<br>");
              tempBoltInfoCells = `<td class="px-4 py-3 text-center border-b border-r ${borderColor} ${darkBorderColor}">${webTempInfo}</td>`;
            } else {
              const twoColumns =
                ["girder", "beam", "other", "stud"].includes(joint.type) &&
                !joint.isPinJoint;
              if (twoColumns) {
                const flangeClass = tempBoltInfo.flange.text.includes("未設定")
                  ? "text-red-600 font-bold"
                  : "";
                const webClass = tempBoltInfo.web.text.includes("未設定")
                  ? "text-red-600 font-bold"
                  : "";
                tempBoltInfoCells = `
                            <td class="px-4 py-3 text-center border-b border-r ${borderColor} ${darkBorderColor} ${flangeClass}" title="${tempBoltInfo.flange.formula}">${tempBoltInfo.flange.text}</td>
                            <td class="px-4 py-3 text-center border-b border-r ${borderColor} ${darkBorderColor} ${webClass}" title="${tempBoltInfo.web.formula}">${tempBoltInfo.web.text}</td>`;
              } else {
                const singleClass = tempBoltInfo.single.text.includes("未設定")
                  ? "text-red-600 font-bold"
                  : "";
                tempBoltInfoCells = `<td class="px-4 py-3 text-center border-b border-r ${borderColor} ${darkBorderColor} ${singleClass}" title="${tempBoltInfo.single.formula}">${tempBoltInfo.single.text}</td>`;
              }
            }
          }

          let floorBadge = "";
          if (member.isMember) {
            if (!member.targetLevels || member.targetLevels.length === 0) {
              floorBadge =
                '<span class="text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded ml-2">全</span>';
            } else {
              const displayLevels =
                member.targetLevels.length > 3
                  ? `${member.targetLevels.length}フロア`
                  : member.targetLevels
                      .map((l) => {
                        const lvlObj = levels.find((x) => x.id === l);
                        return lvlObj
                          ? lvlObj.label.replace("階", "").replace("F", "")
                          : l;
                      })
                      .join(",");
              floorBadge = `<span class="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-1 rounded ml-2">${displayLevels}</span>`;
            }
          } else {
            floorBadge =
              '<span class="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-1 rounded ml-2">全</span>';
          }

          return `
                <tr class="bg-${color}-50 dark:bg-slate-800/50 hover:bg-${color}-100 dark:hover:bg-slate-700/50">
                    <td class="px-4 py-3 text-center border-b border-r ${borderColor} ${darkBorderColor}">
                        <div class="flex justify-center gap-2 whitespace-nowrap">${actionsHtml}</div>
                    </td>
                    <td class="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 border-b border-r ${borderColor} ${darkBorderColor}">
                        ${member.name}${floorBadge}
                    </td>
                    <td class="px-4 py-3 border-b border-r ${borderColor} ${darkBorderColor}">
                        ${joint.name}${colorBadge}
                    </td>
                    ${boltInfo}
                    ${tempBoltInfoCells}
                </tr>`;
        })
        .join("");
    };

    const memberSections = [
      {
        type: "girder",
        isPin: false,
        title: "部材 - 大梁",
        color: "blue",
        cols: [
          { label: "操作", key: null },
          { label: "部材名", key: "name" },
          { label: "使用継手", key: "jointName" },
          { label: "フランジ", key: "flange" },
          { label: "ウェブ", key: "web" },
          { label: "仮ボルト(フランジ)", key: "temp-flange" },
          { label: "仮ボルト(ウェブ)", key: "temp-web" },
        ],
      },
      {
        type: "girder",
        isPin: true,
        title: "部材 - 大梁 (ピン取り)",
        color: "cyan",
        cols: [
          { label: "操作", key: null },
          { label: "部材名", key: "name" },
          { label: "使用継手", key: "jointName" },
          { label: "ウェブ", key: "web" },
          { label: "仮ボルト", key: "temp-web" },
        ],
      },
      {
        type: "beam",
        isPin: false,
        title: "部材 - 小梁",
        color: "green",
        cols: [
          { label: "操作", key: null },
          { label: "部材名", key: "name" },
          { label: "使用継手", key: "jointName" },
          { label: "フランジ", key: "flange" },
          { label: "ウェブ", key: "web" },
          { label: "仮ボルト(フランジ)", key: "temp-flange" },
          { label: "仮ボルト(ウェブ)", key: "temp-web" },
        ],
      },
      {
        type: "beam",
        isPin: true,
        title: "部材 - 小梁 (ピン取り)",
        color: "teal",
        cols: [
          { label: "操作", key: null },
          { label: "部材名", key: "name" },
          { label: "使用継手", key: "jointName" },
          { label: "ウェブ", key: "web" },
          { label: "仮ボルト", key: "temp-web" },
        ],
      },
      {
        type: "column",
        isPin: false,
        title: "部材 - 本柱",
        color: "red",
        cols: [
          { label: "操作", key: null },
          { label: "部材名", key: "name" },
          { label: "使用継手", key: "jointName" },
          { label: "エレクション", key: "bolt" },
        ],
      },
      {
        type: "stud",
        isPin: false,
        title: "部材 - 間柱",
        color: "indigo",
        cols: [
          { label: "操作", key: null },
          { label: "部材名", key: "name" },
          { label: "使用継手", key: "jointName" },
          { label: "フランジボルト", key: "flange" },
          { label: "ウェブボルト", key: "web" },
          { label: "仮ボルト(フランジ)", key: "temp-flange" },
          { label: "仮ボルト(ウェブ)", key: "temp-web" },
        ],
      },
      {
        type: "stud",
        isPin: true,
        title: "部材 - 間柱 (ピン取り)",
        color: "purple",
        cols: [
          { label: "操作", key: null },
          { label: "部材名", key: "name" },
          { label: "使用継手", key: "jointName" },
          { label: "ボルトサイズ", key: "bolt" },
          { label: "仮ボルト", key: "temp-web" },
        ],
      },
      {
        type: "wall_girt",
        isPin: false,
        title: "部材 - 胴縁",
        color: "gray",
        cols: [
          { label: "操作", key: null },
          { label: "部材名", key: "name" },
          { label: "使用継手", key: "jointName" },
          { label: "ボルトサイズ", key: "bolt" },
        ],
      },
      {
        type: "roof_purlin",
        isPin: false,
        title: "部材 - 母屋",
        color: "orange",
        cols: [
          { label: "操作", key: null },
          { label: "部材名", key: "name" },
          { label: "使用継手", key: "jointName" },
          { label: "ボルトサイズ", key: "bolt" },
        ],
      },
      {
        type: "other",
        isPin: false,
        title: "部材 - その他",
        color: "amber",
        cols: [
          { label: "操作", key: null },
          { label: "部材名", key: "name" },
          { label: "使用継手", key: "jointName" },
          { label: "フランジ", key: "flange" },
          { label: "ウェブ", key: "web" },
          { label: "仮ボルト(フランジ)", key: "temp-flange" },
          { label: "仮ボルト(ウェブ)", key: "temp-web" },
        ],
      },
      {
        type: "other",
        isPin: true,
        title: "部材 - その他 (ピン取り)",
        color: "amber",
        cols: [
          { label: "操作", key: null },
          { label: "部材名", key: "name" },
          { label: "使用継手", key: "jointName" },
          { label: "ボルト", key: "bolt" },
          { label: "仮ボルト", key: "temp-web" },
        ],
      },
    ];

    let html = "";
    const sectionsToRender = [];
    memberSections.forEach((section) => {
      const filteredMembers = allMembers.filter(
        (m) =>
          m.joint &&
          m.joint.type === section.type &&
          (m.joint.isPinJoint || false) === section.isPin,
      );
      if (filteredMembers.length > 0) {
        const sectionId = `member-${section.type}-${
          section.isPin ? "pin" : "rigid"
        }`;
        const sortState = state.sort[sectionId];

        if (sortState && sortState.key) {
          filteredMembers.sort((a, b) => {
            const key = sortState.key;

            const getVal = (m) => {
              if (key === "name") return m.name;
              if (key === "jointName") return m.joint.name;
              if (key === "flange")
                return `${m.joint.flangeSize}-${m.joint.flangeCount}`;
              if (key === "web")
                return `${m.joint.webSize}-${m.joint.webCount}`;
              // ▼▼▼ 修正：間柱ピンなどのため webSize も参照 ▼▼▼
              if (key === "bolt")
                return (
                  m.joint.flangeSize ||
                  m.joint.webSize ||
                  m.joint.shopTempBoltSize ||
                  ""
                );
              // ▲▲▲ 修正ここまで ▲▲▲
              if (key === "web_complex") {
                return m.joint.webInputs && m.joint.webInputs.length > 0
                  ? m.joint.webInputs[0].size
                  : m.joint.webSize || "";
              }

              if (key.startsWith("temp")) {
                const info = getTempBoltInfo(m.joint, project.tempBoltMap);
                if (key === "temp-flange") return info.flange.text;
                if (key === "temp-web") return info.web.text;
                if (key === "temp_web_complex") {
                  if (info.webs && info.webs.length > 0)
                    return info.webs[0].text;
                  return info.web.text;
                }
              }
              return "";
            };

            const valA = getVal(a);
            const valB = getVal(b);

            // ボルトサイズ系なら boltSort を使う
            if (
              [
                "flange",
                "web",
                "bolt",
                "web_complex",
                "temp-flange",
                "temp-web",
                "temp_web_complex",
              ].includes(key)
            ) {
              const strA =
                valA === null || valA === undefined ? "" : String(valA);
              const strB =
                valB === null || valB === undefined ? "" : String(valB);
              const cleanA = strA.split("/")[0].trim();
              const cleanB = strB.split("/")[0].trim();

              const cmp = boltSort(cleanA, cleanB);
              if (cmp !== 0) return sortState.order === "asc" ? cmp : -cmp;

              return sortState.order === "asc"
                ? strA.localeCompare(strB)
                : strB.localeCompare(strA);
            }

            // 通常の文字列比較
            if (valA < valB) return sortState.order === "asc" ? -1 : 1;
            if (valA > valB) return sortState.order === "asc" ? 1 : -1;
            return 0;
          });
        } else {
          // デフォルトソート
          filteredMembers.sort((a, b) => {
            const jointNameCompare = a.joint.name.localeCompare(
              b.joint.name,
              "ja",
            );
            if (jointNameCompare !== 0) return jointNameCompare;
            return a.name.localeCompare(b.name, "ja");
          });
        }

        const tbodyId = `members-list-${section.type}${
          section.isPin ? "-pin" : ""
        }`;
        let finalCols = section.cols;
        const hasComplexSpl = filteredMembers.some((m) => m.joint.isComplexSpl);
        if (hasComplexSpl && section.isPin) {
          finalCols = [
            { label: "操作", key: null },
            { label: "部材名", key: "name" },
            { label: "使用継手", key: "jointName" },
            { label: "ウェブ (複合SPL)", key: "web_complex" },
            { label: "仮ボルト (複合SPL)", key: "temp_web_complex" },
          ];
        }

        const headerHtml = finalCols
          .map((col) => {
            let sortIcon = "";
            let cursorClass = "";
            let dataAttr = "";
            if (col.key) {
              cursorClass =
                "cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors";
              dataAttr = `data-sort-key="${col.key}"`;
              if (sortState && sortState.key === col.key) {
                sortIcon = sortState.order === "asc" ? " ▲" : " ▼";
              }
            }
            return `<th class="px-4 py-3 whitespace-nowrap ${cursorClass}" ${dataAttr}>${col.label}${sortIcon}</th>`;
          })
          .join("");

        const anchorId = `anchor-member-${section.type}-${
          section.isPin ? "pin" : "rigid"
        }`;

        html += `
                        <div id="${anchorId}" class="rounded-lg border border-slate-400 dark:border-slate-600 scroll-mt-24" data-section-title="部材：${section.title}" data-section-color="${section.color}" data-section-id="${sectionId}">
                            <h3 class="text-lg font-semibold bg-${section.color}-200 text-${section.color}-800 dark:bg-slate-700 dark:text-${section.color}-200 px-4 py-2 rounded-t-lg">${section.title}</h3>
                            <div class="overflow-x-auto custom-scrollbar bg-${section.color}-50 dark:bg-slate-900/50 rounded-b-lg">
                                <table class="w-full min-w-[400px] text-sm text-left">
                                    <thead class="bg-${section.color}-100 text-${section.color}-700 dark:bg-slate-800/60 dark:text-${section.color}-200 text-xs"><tr>${headerHtml}</tr></thead>
                                    <tbody id="${tbodyId}"></tbody>
                                </table>
                            </div>
                        </div>`;
        sectionsToRender.push({
          tbodyId,
          filteredMembers,
          color: section.color,
          section,
        });
      }
    });
    container.innerHTML = html;
    sectionsToRender.forEach((s) =>
      populateMemberTable(s.tbodyId, s.filteredMembers, s.color, s.section),
    );
  };
  // ★ 修正版：renderTallySheet（色バッジ対応・ヘッダー背景色削除版）
  const renderTallySheet = (project) => {
    if (!project) return;
    const tallySheetContainer = document.getElementById(
      "tally-sheet-container",
    );
    const tabsContainer = document.getElementById("tally-floor-tabs");

    // 1. 階層タブの生成
    const levels = getProjectLevels(project);
    let tabsHtml = `<button class="tally-tab-btn px-3 py-1 rounded-full text-sm font-bold transition-colors border ${
      state.activeTallyLevel === "all"
        ? "bg-blue-600 text-white border-blue-600"
        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600 hover:bg-slate-100"
    }" data-level="all">全表示</button>`;

    levels.forEach((lvl) => {
      const isActive = state.activeTallyLevel === lvl.id;
      const activeClass = isActive
        ? "bg-blue-600 text-white border-blue-600"
        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600 hover:bg-slate-100";
      tabsHtml += `<button class="tally-tab-btn px-3 py-1 rounded-full text-sm font-bold transition-colors border ${activeClass}" data-level="${lvl.id}">${lvl.label}</button>`;
    });
    tabsContainer.innerHTML = tabsHtml;

    // タブクリック時の処理
    tabsContainer.querySelectorAll(".tally-tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.activeTallyLevel = btn.dataset.level;
        renderTallySheet(project);
        renderResults(project);
      });
    });

    // 2. データのフィルタリング
    const tallyList = getTallyList(project).filter((item) => {
      if (state.activeTallyLevel === "all") return true;
      if (!item.isMember) return true;
      if (!item.targetLevels || item.targetLevels.length === 0) return true;
      return item.targetLevels.includes(state.activeTallyLevel);
    });

    if (tallyList.length === 0) {
      tallySheetContainer.innerHTML =
        '<p class="text-gray-500 dark:text-gray-400">この階層に表示する部材がありません。</p>';
      if (resultsCard) resultsCard.classList.add("hidden");
      return;
    }

    // ロケーション行のフィルタリング
    let locations = [];
    if (project.mode === "advanced") {
      project.customLevels.forEach((level) => {
        if (
          state.activeTallyLevel !== "all" &&
          state.activeTallyLevel !== level
        )
          return;
        project.customAreas.forEach((area) =>
          locations.push({
            id: `${level}-${area}`,
            label: `${level} - ${area}`,
          }),
        );
      });
    } else {
      for (let f = 2; f <= project.floors; f++) {
        const lvlId = f.toString();
        if (
          state.activeTallyLevel !== "all" &&
          state.activeTallyLevel !== lvlId
        )
          continue;
        for (let s = 1; s <= project.sections; s++)
          locations.push({ id: `${f}-${s}`, label: `${f}階 ${s}工区` });
      }

      if (state.activeTallyLevel === "all" || state.activeTallyLevel === "R") {
        for (let s = 1; s <= project.sections; s++)
          locations.push({ id: `R-${s}`, label: `R階 ${s}工区` });
      }

      if (project.hasPH) {
        if (
          state.activeTallyLevel === "all" ||
          state.activeTallyLevel === "PH"
        ) {
          for (let s = 1; s <= project.sections; s++)
            locations.push({ id: `PH-${s}`, label: `PH階 ${s}工区` });
        }
      }
    }

    if (locations.length === 0) {
      tallySheetContainer.innerHTML =
        '<p class="text-gray-500 dark:text-gray-400">表示するエリアがありません。</p>';
      if (resultsCard) resultsCard.classList.add("hidden");
      return;
    }

    const typeNameMap = {
      girder: "大梁",
      beam: "小梁",
      column: "本柱",
      stud: "間柱",
      wall_girt: "胴縁",
      roof_purlin: "母屋",
      other: "その他",
    };

    const locks = project.tallyLocks || {};

    // ▼▼▼ 1行目：ロック用チェックボックス（修正：style属性を削除） ▼▼▼
    const lockHeaderRow = tallyList
      .map((item) => {
        const isLocked = locks[item.id] || false;
        const lockedClass = isLocked ? "locked-column" : "";
        const j = item.joint;
        let colorClass = "";

        if (j.type === "girder")
          colorClass = j.isPinJoint
            ? "bg-cyan-200 text-cyan-800 border-cyan-300 dark:bg-cyan-900/50 dark:text-cyan-200 dark:border-cyan-700"
            : "bg-blue-200 text-blue-800 border-blue-300 dark:bg-blue-900/50 dark:text-blue-200 dark:border-blue-700";
        else if (j.type === "beam")
          colorClass = j.isPinJoint
            ? "bg-teal-200 text-teal-800 border-teal-300 dark:bg-teal-900/50 dark:text-teal-200 dark:border-teal-700"
            : "bg-green-200 text-green-800 border-green-300 dark:bg-green-900/50 dark:text-green-200 dark:border-green-700";
        else if (j.type === "column")
          colorClass =
            "bg-red-200 text-red-800 border-red-300 dark:bg-red-900/50 dark:text-red-200 dark:border-red-700";
        else if (j.type === "stud")
          colorClass = j.isPinJoint
            ? "bg-purple-200 text-purple-800 border-purple-300 dark:bg-purple-900/50 dark:text-purple-200 dark:border-purple-700"
            : "bg-indigo-200 text-indigo-800 border-indigo-300 dark:bg-indigo-900/50 dark:text-indigo-200 dark:border-indigo-700";
        else if (j.type === "wall_girt")
          colorClass =
            "bg-gray-200 text-gray-800 border-gray-300 dark:bg-gray-800/60 dark:text-gray-200 dark:border-gray-700";
        else if (j.type === "roof_purlin")
          colorClass =
            "bg-orange-200 text-orange-800 border-orange-300 dark:bg-orange-900/50 dark:text-orange-200 dark:border-orange-700";
        else if (j.type === "other")
          colorClass =
            "bg-amber-200 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-200 dark:border-amber-700";

        return `<td class="px-2 py-1 text-center border ${colorClass} ${lockedClass}" data-column-id="${
          item.id
        }">
                            <input type="checkbox" class="tally-lock-checkbox h-4 w-4 rounded border-gray-300 text-blue-800 focus:ring-yellow-500" data-id="${
                              item.id
                            }" ${isLocked ? "checked" : ""}>
                        </td>`;
      })
      .join("");

    // ▼▼▼ 2行目：部材名（修正：style属性削除、バッジ追加） ▼▼▼
    const headers = tallyList
      .map((item) => {
        const j = item.joint;
        let typeName = typeNameMap[j.type] || "不明";
        if (j.isPinJoint) typeName += "(ピン取り)";
        const headerText = item.name;
        const tooltipText = `部材: ${item.name}\n対応継手: ${j.name} (${typeName})`;
        const isLocked = locks[item.id] || false;
        const lockedClass = isLocked ? "locked-column" : "";

        let colorClass = "";
        if (j.type === "girder")
          colorClass = j.isPinJoint
            ? "bg-cyan-200 text-cyan-800 border-cyan-300 dark:bg-cyan-900/50 dark:text-cyan-200 dark:border-cyan-700"
            : "bg-blue-200 text-blue-800 border-blue-300 dark:bg-blue-900/50 dark:text-blue-200 dark:border-blue-700";
        else if (j.type === "beam")
          colorClass = j.isPinJoint
            ? "bg-teal-200 text-teal-800 border-teal-300 dark:bg-teal-900/50 dark:text-teal-200 dark:border-teal-700"
            : "bg-green-200 text-green-800 border-green-300 dark:bg-green-900/50 dark:text-green-200 dark:border-green-700";
        else if (j.type === "column")
          colorClass =
            "bg-red-200 text-red-800 border-red-300 dark:bg-red-900/50 dark:text-red-200 dark:border-red-700";
        else if (j.type === "stud")
          colorClass = j.isPinJoint
            ? "bg-purple-200 text-purple-800 border-purple-300 dark:bg-purple-900/50 dark:text-purple-200 dark:border-purple-700"
            : "bg-indigo-200 text-indigo-800 border-indigo-300 dark:bg-indigo-900/50 dark:text-indigo-200 dark:border-indigo-700";
        else if (j.type === "wall_girt")
          colorClass =
            "bg-gray-200 text-gray-800 border-gray-300 dark:bg-gray-800/60 dark:text-gray-200 dark:border-gray-700";
        else if (j.type === "roof_purlin")
          colorClass =
            "bg-orange-200 text-orange-800 border-orange-300 dark:bg-orange-900/50 dark:text-orange-200 dark:border-orange-700";
        else if (j.type === "other")
          colorClass =
            "bg-amber-200 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-200 dark:border-amber-700";

        // 色設定がある場合、バッジを作成（背景色はデフォルトのまま）
        const colorBadge = j.color
          ? `<span class="inline-block w-3 h-3 rounded-full ml-1 border border-gray-400 align-middle" style="background-color: ${j.color};"></span>`
          : "";

        return `<th class="px-2 py-3 text-center border min-w-32 ${colorClass} ${lockedClass}" title="${tooltipText}" data-column-id="${item.id}">
                        ${headerText}${colorBadge}
                    </th>`;
      })
      .join("");

    // ▼▼▼ 3行目：ボルトサイズ（修正：style属性を削除） ▼▼▼
    const boltSizeHeaders = tallyList
      .map((item) => {
        const j = item.joint;
        let boltSizeText = "-";
        let tooltipText = "";
        if (j.isComplexSpl && j.webInputs) {
          boltSizeText = j.webInputs.map((w) => w.size || "-").join(", ");
          tooltipText = j.webInputs
            .map((w) => `${w.size || "サイズ未設定"}: ${w.count || 0}本`)
            .join("\n");
        } else {
          const sizes = [];
          if (j.flangeSize) sizes.push(j.flangeSize);
          if (j.webSize) sizes.push(j.webSize);
          if (sizes.length > 0) boltSizeText = sizes.join("・");
          const tooltipParts = [];
          if (j.flangeSize && j.flangeCount > 0)
            tooltipParts.push(`フランジ: ${j.flangeCount}本`);
          if (j.webSize && j.webCount > 0)
            tooltipParts.push(`ウェブ: ${j.webCount}本`);
          tooltipText = tooltipParts.join("\n");
        }
        const isLocked = locks[item.id] || false;
        const lockedClass = isLocked ? "locked-column" : "";
        let colorClass = "";
        if (j.type === "girder")
          colorClass = j.isPinJoint
            ? "bg-cyan-200 text-cyan-800 border-cyan-300 dark:bg-cyan-900/50 dark:text-cyan-200 dark:border-cyan-700"
            : "bg-blue-200 text-blue-800 border-blue-300 dark:bg-blue-900/50 dark:text-blue-200 dark:border-blue-700";
        else if (j.type === "beam")
          colorClass = j.isPinJoint
            ? "bg-teal-200 text-teal-800 border-teal-300 dark:bg-teal-900/50 dark:text-teal-200 dark:border-teal-700"
            : "bg-green-200 text-green-800 border-green-300 dark:bg-green-900/50 dark:text-green-200 dark:border-green-700";
        else if (j.type === "column")
          colorClass =
            "bg-red-200 text-red-800 border-red-300 dark:bg-red-900/50 dark:text-red-200 dark:border-red-700";
        else if (j.type === "stud")
          colorClass = j.isPinJoint
            ? "bg-purple-200 text-purple-800 border-purple-300 dark:bg-purple-900/50 dark:text-purple-200 dark:border-purple-700"
            : "bg-indigo-200 text-indigo-800 border-indigo-300 dark:bg-indigo-900/50 dark:text-indigo-200 dark:border-indigo-700";
        else if (j.type === "wall_girt")
          colorClass =
            "bg-gray-200 text-gray-800 border-gray-300 dark:bg-gray-800/60 dark:text-gray-200 dark:border-gray-700";
        else if (j.type === "roof_purlin")
          colorClass =
            "bg-orange-200 text-orange-800 border-orange-300 dark:bg-orange-900/50 dark:text-orange-200 dark:border-orange-700";
        else if (j.type === "other")
          colorClass =
            "bg-amber-200 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-200 dark:border-amber-700";

        return `<th class="px-2 py-3 text-center border min-w-32 ${colorClass} ${lockedClass}" title="${tooltipText}" data-column-id="${item.id}">${boltSizeText}</th>`;
      })
      .join("");

    const bodyRows = locations
      .map(
        (loc) => `
                <tr class="tally-row table-row-color">
                    <td class="whitespace-nowrap px-2 py-3 font-medium text-gray-900 dark:text-gray-100 sticky left-0 z-10 border border-slate-200 dark:border-slate-700 table-sticky-color">
                        <label class="font-bold">${loc.label}</label>
                    </td>
                    ${tallyList
                      .map((item) => {
                        const dbValue = project.tally?.[loc.id]?.[item.id];
                        const value = dbValue === 0 ? 0 : dbValue || "";
                        const isLocked = locks[item.id] || false;
                        const lockedClass = isLocked ? "locked-column" : "";
                        return `
<td class="p-0 border border-slate-200 dark:border-slate-700 ${lockedClass}" data-column-id="${
                          item.id
                        }">
    <input type="text" inputmode="numeric" pattern="\\d*" data-location="${
      loc.id
    }" data-id="${
      item.id
    }" class="tally-input w-full bg-transparent dark:bg-slate-800/50 border-transparent text-slate-900 dark:text-slate-100 rounded-md py-3 px-2 text-center focus:outline-none focus:ring-2 focus:ring-yellow-500" value="${value}" ${
      isLocked ? "disabled" : ""
    }>
</td>`;
                      })
                      .join("")}
                    <td class="row-total px-2 py-2 text-center font-bold text-blue-800 dark:text-blue-300 align-middle sticky right-0 border border-slate-200 dark:border-slate-700 table-sticky-color"></td>
                </tr>`,
      )
      .join("");

    const footerCols = tallyList
      .map((item) => {
        const isLocked = locks[item.id] || false;
        const lockedClass = isLocked ? "locked-column" : "";
        return `<td data-id="${item.id}" class="col-total px-2 py-2 text-center border border-orange-400 dark:border-orange-700 ${lockedClass}" data-column-id="${item.id}"></td>`;
      })
      .join("");

    tallySheetContainer.innerHTML = `
            <table class="table-fixed text-sm text-left border-collapse">
                <colgroup>
                    <col style="width: 128px;">
                </colgroup>
                <thead class="text-xs sticky top-0 z-20">
                    <tr>
                        <th class="whitespace-nowrap px-2 py-3 sticky left-0 z-30 table-sticky-header-color align-bottom" rowspan="3">
                           <div class="flex flex-col items-center justify-center h-full">
                               <span>階層 / エリア</span>
                               <span class="text-xs font-normal mt-1">(ロック)</span>
                           </div>
                        </th>
                        ${lockHeaderRow}
                        <th class="px-2 py-3 sticky right-0 table-sticky-header-color align-middle font-bold text-slate-700 dark:text-slate-200" rowspan="3">合計</th>
                    </tr>
                    <tr>
                        ${headers}
                    </tr>
                    <tr>
                        ${boltSizeHeaders}
                    </tr>
                </thead>
                <tbody>${bodyRows}</tbody>
                <tfoot class="font-bold sticky bottom-0 table-footer-color">
                    <tr>
                        <td class="px-2 py-2 sticky left-0 z-10 border border-orange-400 dark:border-orange-700">列合計</td>
                        
                        ${footerCols}
                        
                        <td class="grand-total px-2 py-2 text-center sticky right-0 border border-orange-400 dark:border-orange-700"></td>
                    </tr>
                </tfoot>
            </table>`;

    if (tallyCard) {
      tallyCard.classList.remove("hidden");
      tallyCard.id = "anchor-tally-input";
      tallyCard.setAttribute("data-section-title", "箇所数入力");
      tallyCard.setAttribute("data-section-color", "blue");
      tallyCard.classList.add("scroll-mt-24");
    }
    if (resultsCard) resultsCard.classList.remove("hidden");
    updateTallySheetCalculations(project);

    if (focusToRestore) {
      const inputToFocus = tallySheetContainer.querySelector(
        `input[data-location="${focusToRestore.location}"][data-id="${focusToRestore.id}"]`,
      );
      if (inputToFocus) {
        inputToFocus.focus();
        if (justFinishedIME) {
          isEditing = true;
          inputToFocus.setSelectionRange(
            inputToFocus.value.length,
            inputToFocus.value.length,
          );
          justFinishedIME = false;
        }
      }
      focusToRestore = null;
    }
  };
  // ★ 修正版：renderResults（タブによる完全なフィルタリング対応）
  // ★ 修正版：renderResults（エリア別集計のバグ修正・完全版）
  const renderResults = (project) => {
    const resultsCardContent = document.getElementById("results-card-content");
    resultsCardContent.innerHTML = "";
    if (!resultsCard) return;
    resultsCard.classList.add("hidden");

    if (!project) return;

    const { resultsByLocation } = calculateResults(project);

    // 1. 表示対象のロケーションIDを特定
    const targetLocationIds = new Set();
    if (project.mode === "advanced") {
      project.customLevels.forEach((level) => {
        if (
          state.activeTallyLevel !== "all" &&
          state.activeTallyLevel !== level
        )
          return;
        project.customAreas.forEach((area) =>
          targetLocationIds.add(`${level}-${area}`),
        );
      });
    } else {
      for (let f = 2; f <= project.floors; f++) {
        if (
          state.activeTallyLevel !== "all" &&
          state.activeTallyLevel !== f.toString()
        )
          continue;
        for (let s = 1; s <= project.sections; s++)
          targetLocationIds.add(`${f}-${s}`);
      }
      if (state.activeTallyLevel === "all" || state.activeTallyLevel === "R") {
        for (let s = 1; s <= project.sections; s++)
          targetLocationIds.add(`R-${s}`);
      }
      if (project.hasPH) {
        if (
          state.activeTallyLevel === "all" ||
          state.activeTallyLevel === "PH"
        ) {
          for (let s = 1; s <= project.sections; s++)
            targetLocationIds.add(`PH-${s}`);
        }
      }
    }

    // 2. 有効なボルトサイズと総本数をフィルタリングして再計算
    const filteredBoltSizes = new Set();
    let grandTotalBolts = 0;

    for (const locId in resultsByLocation) {
      if (!targetLocationIds.has(locId)) continue;

      const dataBySize = resultsByLocation[locId];
      for (const size in dataBySize) {
        const count = dataBySize[size].total;
        if (count > 0) {
          filteredBoltSizes.add(size);
          grandTotalBolts += count;
        }
      }
    }

    const buttonsHtml = `
        <div class="flex justify-end gap-4 mb-4">
            <button id="recalculate-btn" class="btn btn-secondary text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/></svg>
                結果を再計算
            </button>
            <button id="export-excel-btn" class="btn bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                Excelデータを出力
            </button>
        </div>`;

    if (filteredBoltSizes.size === 0) {
      resultsCardContent.innerHTML =
        buttonsHtml +
        '<p class="text-gray-500 dark:text-gray-400">該当するデータがありません。</p>';
      resultsCard.classList.remove("hidden");
      return;
    }

    const sortedSizes = Array.from(filteredBoltSizes).sort(boltSort);

    // --- テーブル1：フロア工区別 ---
    let floorColumns = [];
    if (project.mode === "advanced") {
      project.customLevels.forEach((level) => {
        if (
          state.activeTallyLevel !== "all" &&
          state.activeTallyLevel !== level
        )
          return;
        project.customAreas.forEach((area) =>
          floorColumns.push({
            id: `${level}-${area}`,
            label: `${level}-${area}`,
          }),
        );
        floorColumns.push({
          id: `${level}_total`,
          label: `${level} 合計`,
          isTotal: true,
          level: level,
        });
      });
    } else {
      for (let f = 2; f <= project.floors; f++) {
        if (
          state.activeTallyLevel !== "all" &&
          state.activeTallyLevel !== f.toString()
        )
          continue;
        for (let s = 1; s <= project.sections; s++)
          floorColumns.push({ id: `${f}-${s}`, label: `${f}F-${s}` });
        floorColumns.push({
          id: `${f}F_total`,
          label: `${f}F 合計`,
          isTotal: true,
          floor: f,
        });
      }
      if (state.activeTallyLevel === "all" || state.activeTallyLevel === "R") {
        for (let s = 1; s <= project.sections; s++)
          floorColumns.push({ id: `R-${s}`, label: `RF-${s}` });
        floorColumns.push({
          id: `R_total`,
          label: `RF 合計`,
          isTotal: true,
          floor: "R",
        });
      }
      if (project.hasPH) {
        if (
          state.activeTallyLevel === "all" ||
          state.activeTallyLevel === "PH"
        ) {
          for (let s = 1; s <= project.sections; s++)
            floorColumns.push({ id: `PH-${s}`, label: `PH-${s}` });
          floorColumns.push({
            id: `PH_total`,
            label: `PH 合計`,
            isTotal: true,
            floor: "PH",
          });
        }
      }
    }

    const floorHeaders = floorColumns
      .map((col) => {
        const totalColClass = col.isTotal
          ? "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200"
          : "";
        return `<th class="px-2 py-3 text-center border border-slate-300 dark:border-slate-600 ${totalColClass}">${col.label}</th>`;
      })
      .join("");

    let floorTable = `
        <div id="anchor-result-floor" data-section-title="集計：フロア工区別" data-section-color="yellow" class="scroll-mt-24">
            <div class="flex items-center gap-4 mb-4 border-b-2 border-yellow-400 pb-2">
                <h2 class="text-2xl font-bold text-slate-900 dark:text-slate-100">ボルト本数(フロア工区別)</h2>
                <span class="font-bold text-red-600 dark:text-red-400 text-lg">(総本数: ${grandTotalBolts.toLocaleString()}本)</span>
            </div>
        </div>
        <div class="overflow-x-auto custom-scrollbar">
            <table class="w-auto text-sm border-collapse">
                <thead class="bg-slate-200 dark:bg-slate-700 text-xs text-slate-700 dark:text-slate-300">
                    <tr>
                        <th class="px-2 py-3 sticky left-0 bg-slate-200 dark:bg-slate-700 z-10 border border-slate-300 dark:border-slate-600">ボルトサイズ</th>
                        ${floorHeaders}
                        <th class="px-2 py-3 text-center sticky right-0 bg-yellow-300 dark:bg-yellow-800/50 text-yellow-800 dark:text-yellow-200 border border-yellow-400 dark:border-yellow-700">総合計</th>
                    </tr>
                </thead>
                <tbody>`;

    sortedSizes.forEach((size) => {
      let rowTotal = 0;
      const rowTotalJoints = {};
      let rowHtml = `<tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50"><td class="px-2 py-2 font-bold text-gray-900 dark:text-gray-100 sticky left-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">${size}</td>`;

      floorColumns.forEach((col) => {
        let cellValue = 0;
        let tooltipText = "",
          detailsClass = "",
          dataAttribute = "",
          jointData = {};
        if (col.isTotal) {
          const areas =
            project.mode === "advanced"
              ? project.customAreas
              : Array.from({ length: project.sections }, (_, i) => i + 1);
          areas.forEach((area) => {
            const id =
              project.mode === "advanced"
                ? `${col.level}-${area}`
                : `${col.floor}-${area}`;
            const dataForCell = resultsByLocation[id]?.[size];
            if (dataForCell) {
              cellValue += dataForCell.total;
              for (const [name, count] of Object.entries(dataForCell.joints))
                jointData[name] = (jointData[name] || 0) + count;
            }
          });
        } else {
          const cellData = resultsByLocation[col.id]?.[size];
          cellValue = cellData?.total || 0;
          if (cellData?.joints) jointData = cellData.joints;
        }
        if (Object.keys(jointData).length > 0) {
          tooltipText = Object.entries(jointData)
            .map(([name, count]) => `${name}: ${count.toLocaleString()}本`)
            .join("\n");
          detailsClass =
            "has-details cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-800/50 transition-colors";
          dataAttribute = `data-details='${JSON.stringify(jointData)}'`;
          if (!col.isTotal) {
            for (const [name, count] of Object.entries(jointData))
              rowTotalJoints[name] = (rowTotalJoints[name] || 0) + count;
          }
        }
        if (!col.isTotal) rowTotal += cellValue;
        const totalColClass = col.isTotal
          ? "font-bold bg-blue-50 dark:bg-blue-900/40"
          : "";
        rowHtml += `<td class="px-2 py-2 text-center border border-slate-200 dark:border-slate-700 ${totalColClass} ${detailsClass}" title="${tooltipText}" ${dataAttribute}>${
          cellValue > 0 ? cellValue.toLocaleString() : "-"
        }</td>`;
      });

      const grandTotalTooltip = Object.entries(rowTotalJoints)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, count]) => `${name}: ${count.toLocaleString()}本`)
        .join("\n");
      const grandTotalDetailsClass =
        Object.keys(rowTotalJoints).length > 0
          ? "has-details cursor-pointer hover:bg-yellow-200 dark:hover:bg-yellow-700/50 transition-colors"
          : "";
      const grandTotalDataAttribute =
        Object.keys(rowTotalJoints).length > 0
          ? `data-details='${JSON.stringify(rowTotalJoints)}'`
          : "";
      rowHtml += `<td class="px-2 py-2 text-center font-bold sticky right-0 bg-yellow-100 dark:bg-yellow-900/50 border border-yellow-200 dark:border-yellow-800 ${grandTotalDetailsClass}" title="${grandTotalTooltip}" ${grandTotalDataAttribute}>${
        rowTotal > 0 ? rowTotal.toLocaleString() : "-"
      }</td></tr>`;
      floorTable += rowHtml;
    });
    floorTable += `</tbody></table></div>`;

    // --- テーブル2：工区/エリア別集計 ---
    let sectionColumns = [];
    if (project.mode === "advanced") {
      project.customAreas.forEach((area) =>
        sectionColumns.push({ id: area, label: area }),
      );
    } else {
      for (let s = 1; s <= project.sections; s++)
        sectionColumns.push({ id: `${s}工区`, label: `${s}工区` });
    }

    const resultsBySection = {};
    sectionColumns.forEach((sc) => (resultsBySection[sc.id] = {}));

    // ▼▼▼ 修正：エリア名抽出ロジックの強化 ▼▼▼
    // 長い階層名から順にマッチングさせることで、前方一致の誤爆を防ぐ
    const sortedLevels =
      project.mode === "advanced"
        ? [...project.customLevels].sort((a, b) => b.length - a.length)
        : [];

    for (const locationId in resultsByLocation) {
      if (!targetLocationIds.has(locationId)) continue; // フィルタリング

      let foundArea = null;
      if (project.mode === "advanced") {
        // "GL-RF-1面" のようなケースに対応するため、階層名を除去してエリア名を取得
        for (const level of sortedLevels) {
          if (locationId.startsWith(level + "-")) {
            foundArea = locationId.substring(level.length + 1); // "1面" を取得
            break;
          }
        }
      } else {
        foundArea = `${locationId.split("-")[1]}工区`;
      }

      if (foundArea && resultsBySection[foundArea]) {
        for (const size in resultsByLocation[locationId]) {
          if (!resultsBySection[foundArea][size])
            resultsBySection[foundArea][size] = { total: 0, joints: {} };
          const locData = resultsByLocation[locationId][size];
          resultsBySection[foundArea][size].total += locData.total;
          for (const jointName in locData.joints) {
            resultsBySection[foundArea][size].joints[jointName] =
              (resultsBySection[foundArea][size].joints[jointName] || 0) +
              locData.joints[jointName];
          }
        }
      }
    }
    // ▲▲▲ 修正ここまで ▲▲▲

    const sectionHeaders = sectionColumns
      .map(
        (col) =>
          `<th class="px-2 py-3 text-center border border-slate-300 dark:border-slate-600">${col.label}</th>`,
      )
      .join("");

    let sectionTable = `
        <div id="anchor-result-area" data-section-title="集計：工区/エリア別" data-section-color="orange" class="scroll-mt-24">
            <div class="flex items-center gap-4 mt-8 mb-4 border-b-2 border-yellow-400 pb-2">
            <h2 class="text-2xl font-bold text-slate-900 dark:text-slate-100">ボルト本数(${
              project.mode === "advanced" ? "エリア別" : "工区別"
            })</h2>
            <span class="font-bold text-red-600 dark:text-red-400 text-lg">(総本数: ${grandTotalBolts.toLocaleString()}本)</span>
        </div>
        <div class="overflow-x-auto custom-scrollbar">
            <table class="w-auto text-sm border-collapse">
                <thead class="bg-slate-200 dark:bg-slate-700 text-xs text-slate-700 dark:text-slate-300">
                    <tr>
                        <th class="px-2 py-3 sticky left-0 bg-slate-200 dark:bg-slate-700 z-10 border border-slate-300 dark:border-slate-600">ボルトサイズ</th>
                        ${sectionHeaders}
                        <th class="px-2 py-3 text-center sticky right-0 bg-yellow-300 dark:bg-yellow-800/50 text-yellow-800 dark:text-yellow-200 border border-yellow-400 dark:border-yellow-700">総合計</th>
                    </tr>
                </thead>
                <tbody>`;

    sortedSizes.forEach((size) => {
      let rowTotal = 0;
      const rowTotalJoints = {};
      let rowHtml = `<tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50"><td class="px-2 py-2 font-bold text-gray-900 dark:text-gray-100 sticky left-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">${size}</td>`;

      sectionColumns.forEach((col) => {
        const cellData = resultsBySection[col.id]?.[size];
        const cellValue = cellData?.total || 0;
        let tooltipText = "",
          detailsClass = "",
          dataAttribute = "";
        if (cellData?.joints && Object.keys(cellData.joints).length > 0) {
          tooltipText = Object.entries(cellData.joints)
            .map(([name, count]) => `${name}: ${count.toLocaleString()}本`)
            .join("\n");
          for (const [name, count] of Object.entries(cellData.joints))
            rowTotalJoints[name] = (rowTotalJoints[name] || 0) + count;
          detailsClass =
            "has-details cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-800/50 transition-colors";
          dataAttribute = `data-details='${JSON.stringify(cellData.joints)}'`;
        }
        rowTotal += cellValue;
        rowHtml += `<td class="px-2 py-2 text-center border border-slate-200 dark:border-slate-700 ${detailsClass}" title="${tooltipText}" ${dataAttribute}>${
          cellValue > 0 ? cellValue.toLocaleString() : "-"
        }</td>`;
      });

      const grandTotalTooltip = Object.entries(rowTotalJoints)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, count]) => `${name}: ${count.toLocaleString()}本`)
        .join("\n");
      const grandTotalDetailsClass =
        Object.keys(rowTotalJoints).length > 0
          ? "has-details cursor-pointer hover:bg-yellow-200 dark:hover:bg-yellow-700/50 transition-colors"
          : "";
      const grandTotalDataAttribute =
        Object.keys(rowTotalJoints).length > 0
          ? `data-details='${JSON.stringify(rowTotalJoints)}'`
          : "";
      rowHtml += `<td class="px-2 py-2 text-center font-bold sticky right-0 bg-yellow-100 dark:bg-yellow-900/50 border border-yellow-200 dark:border-yellow-800 ${grandTotalDetailsClass}" title="${grandTotalTooltip}" ${grandTotalDataAttribute}>${
        rowTotal > 0 ? rowTotal.toLocaleString() : "-"
      }</td></tr>`;
      sectionTable += rowHtml;
    });
    sectionTable += `</tbody></table></div>`;
    floorTable += `</div>`;

    const orderDetailsContainer = `<div id="order-details-container" data-section-title="注文明細" data-section-color="pink" class="scroll-mt-24"></div>`;
    // ▼▼▼ 追加: 仮ボルト注文明細用コンテナ ▼▼▼
    const tempOrderDetailsContainer = `<div id="temp-order-details-container" data-section-title="仮ボルト注文明細" data-section-color="purple" class="scroll-mt-24"></div>`;
    // ▲▲▲ 追加ここまで ▲▲▲
    const tempBoltsHtml = renderTempBoltResults(project);
    const shopTempBoltsHtml = renderShopTempBoltResults(project);

    resultsCardContent.innerHTML =
      buttonsHtml +
      floorTable +
      sectionTable +
      orderDetailsContainer +
      tempBoltsHtml +
      tempOrderDetailsContainer +
      shopTempBoltsHtml;

    const container = document.getElementById("order-details-container");
    if (container) {
      // HTML文字列の代入をやめ、要素を引数として渡す
      renderOrderDetails(container, project, resultsByLocation);
    }

    // ▼▼▼ 追加: 仮ボルト注文明細の描画呼び出し ▼▼▼
    const tempContainer = document.getElementById(
      "temp-order-details-container",
    );
    if (tempContainer) {
      renderTempOrderDetails(tempContainer, project);
    }
    // ▲▲▲ 追加ここまで ▲▲▲

    if (resultsCard) resultsCard.classList.remove("hidden");
  };

  // ★ 修正版：renderTempBoltResults（ボルトサイズの絞り込み対応・完全版）
  const renderTempBoltResults = (project) => {
    // 1. まず全データを計算
    const { resultsByLocation } = calculateTempBoltResults(project);

    // 2. 表示対象のロケーションIDを特定
    const targetLocationIds = new Set();
    let locations = []; // 表示用の配列

    if (project.mode === "advanced") {
      project.customLevels.forEach((level) => {
        if (
          state.activeTallyLevel !== "all" &&
          state.activeTallyLevel !== level
        )
          return;
        project.customAreas.forEach((area) => {
          const id = `${level}-${area}`;
          locations.push({ id, label: `${level} - ${area}` });
          targetLocationIds.add(id);
        });
      });
    } else {
      for (let f = 2; f <= project.floors; f++) {
        const lvlStr = f.toString();
        if (
          state.activeTallyLevel !== "all" &&
          state.activeTallyLevel !== lvlStr
        )
          continue;
        for (let s = 1; s <= project.sections; s++) {
          const id = `${f}-${s}`;
          locations.push({ id, label: `${f}階 ${s}工区` });
          targetLocationIds.add(id);
        }
      }

      if (state.activeTallyLevel === "all" || state.activeTallyLevel === "R") {
        for (let s = 1; s <= project.sections; s++) {
          const id = `R-${s}`;
          locations.push({ id, label: `R階 ${s}工区` });
          targetLocationIds.add(id);
        }
      }

      if (project.hasPH) {
        if (
          state.activeTallyLevel === "all" ||
          state.activeTallyLevel === "PH"
        ) {
          for (let s = 1; s <= project.sections; s++) {
            const id = `PH-${s}`;
            locations.push({ id, label: `PH階 ${s}工区` });
            targetLocationIds.add(id);
          }
        }
      }
    }

    // ▼▼▼ 表示対象のロケーションで「実際に使われているボルトサイズ」だけを抽出 ▼▼▼
    const filteredBoltSizes = new Set();

    for (const locId in resultsByLocation) {
      if (!targetLocationIds.has(locId)) continue;

      const dataBySize = resultsByLocation[locId];
      for (const size in dataBySize) {
        if (dataBySize[size].total > 0) {
          filteredBoltSizes.add(size);
        }
      }
    }

    if (filteredBoltSizes.size === 0) {
      return "";
    }

    const sortedSizes = Array.from(filteredBoltSizes).sort(boltSort);

    let floorTable = `<div id="anchor-temp-bolt" data-section-title="仮ボルト集計" data-section-color="green" class="scroll-mt-24">
                    <h2 class="text-2xl font-bold mt-8 mb-4 border-b-2 border-green-400 pb-2 text-slate-900 dark:text-slate-100">仮ボルト本数集計</h2>
                      <h3 class="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-2">フロア工区別</h3>
                      <div class="overflow-x-auto custom-scrollbar">
                        <table class="w-auto text-sm border-collapse">
                            <thead class="bg-slate-200 dark:bg-slate-700 text-xs text-slate-700 dark:text-slate-300"><tr>
                                <th class="px-2 py-3 sticky left-0 bg-slate-200 dark:bg-slate-700 z-10 border border-slate-300 dark:border-slate-600">仮ボルトサイズ</th>
                                ${locations
                                  .map(
                                    (loc) =>
                                      `<th class="px-2 py-3 text-center border border-slate-300 dark:border-slate-600">${loc.label}</th>`,
                                  )
                                  .join("")}
                                <th class="px-2 py-3 text-center sticky right-0 bg-yellow-300 dark:bg-yellow-800/50 text-yellow-800 dark:text-yellow-200 border border-yellow-400 dark:border-yellow-700">総合計</th>
                            </tr></thead><tbody>`;

    sortedSizes.forEach((size) => {
      let grandTotal = 0;
      const grandTotalJoints = {};
      let rowHtml = `<tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50"><td class="px-2 py-2 font-bold text-gray-900 dark:text-gray-100 sticky left-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">${size}</td>`;

      locations.forEach((loc) => {
        const cellData = resultsByLocation[loc.id]?.[size];
        const cellValue = cellData?.total || 0;
        let tooltipText = "",
          detailsClass = "",
          dataAttribute = "";

        if (cellData?.joints && Object.keys(cellData.joints).length > 0) {
          tooltipText = Object.entries(cellData.joints)
            .map(([name, count]) => `${name}: ${count.toLocaleString()}本`)
            .join("\n");
          detailsClass =
            "has-details cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-800/50 transition-colors";
          dataAttribute = `data-details='${JSON.stringify(cellData.joints)}'`;
          for (const [name, count] of Object.entries(cellData.joints)) {
            grandTotalJoints[name] = (grandTotalJoints[name] || 0) + count;
          }
        }

        grandTotal += cellValue;
        rowHtml += `<td class="px-2 py-2 text-center border border-slate-200 dark:border-slate-700 ${detailsClass}" title="${tooltipText}" ${dataAttribute}>${
          cellValue > 0 ? cellValue.toLocaleString() : "-"
        }</td>`;
      });

      const grandTotalTooltip = Object.entries(grandTotalJoints)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, count]) => `${name}: ${count.toLocaleString()}本`)
        .join("\n");
      const grandTotalDetailsClass =
        Object.keys(grandTotalJoints).length > 0
          ? "has-details cursor-pointer hover:bg-yellow-200 dark:hover:bg-yellow-700/50 transition-colors"
          : "";
      const grandTotalDataAttribute =
        Object.keys(grandTotalJoints).length > 0
          ? `data-details='${JSON.stringify(grandTotalJoints)}'`
          : "";

      rowHtml += `<td class="px-2 py-2 text-center font-bold sticky right-0 bg-yellow-100 dark:bg-yellow-900/50 border border-yellow-200 dark:border-yellow-800 ${grandTotalDetailsClass}" title="${grandTotalTooltip}" ${grandTotalDataAttribute}>${
        grandTotal > 0 ? grandTotal.toLocaleString() : "-"
      }</td></tr>`;
      floorTable += rowHtml;
    });
    floorTable += `</tbody></table></div>`;
    floorTable += `</div>`;

    return floorTable;
  };
  const renderShopTempBoltResults = (project) => {
    const totals = calculateShopTempBoltResults(project);

    if (Object.keys(totals).length === 0) {
      return "";
    }

    const sortedSizes = Object.keys(totals).sort(boltSort);

    let tableRows = "";
    sortedSizes.forEach((size) => {
      const data = totals[size];
      const jointNamesString = Array.from(data.joints).join(", ");

      tableRows += `
                    <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <td class="px-2 py-2 border border-slate-200 dark:border-slate-700 text-center">${size}</td>
                        <td class="px-2 py-2 border border-slate-200 dark:border-slate-700 text-center">${data.total.toLocaleString()}</td>
                        <td class="px-2 py-2 border border-slate-200 dark:border-slate-700 text-center">${jointNamesString}</td>
                    </tr>
                `;
    });

    // ▼▼▼ 修正：ナビゲーション用ラッパーを追加 ▼▼▼
    return `
                <div id="anchor-shop-bolt" data-section-title="工場仮ボルト集計" data-section-color="cyan" class="scroll-mt-24">
                    <h2 class="text-2xl font-bold mt-8 mb-4 border-b-2 border-cyan-400 pb-2 text-slate-900 dark:text-slate-100">工場使用仮ボルト集計</h2>
                <div class="overflow-x-auto custom-scrollbar">
                    <table class="w-auto text-sm border-collapse">
                        <thead class="bg-slate-200 dark:bg-slate-700 text-xs text-slate-700 dark:text-slate-300">
                            <tr>
                                <th class="px-2 py-3 border border-slate-300 dark:border-slate-600 text-center">ボルトサイズ</th>
                                <th class="px-2 py-3 border border-slate-300 dark:border-slate-600 text-center">本数</th>
                                <th class="px-2 py-3 border border-slate-300 dark:border-slate-600 text-center">継手名</th>
                            </tr>
                        </thead>
                        <tbody class="dark:bg-slate-800">${tableRows}</tbody>
                    </table>
                </div>
            </div>`; // ← ▼▼▼ 修正：ラッパーの閉じタグを追加（テンプレートリテラル内）
  };

  // ★ 追加：仮ボルト注文明細のレンダリング関数
  const renderTempOrderDetails = (container, project) => {
    if (!container || !project) return;

    container.innerHTML = ""; // クリア

    const viewMode = state.tempOrderDetailsView || "section"; // 独自のステートを使用
    const toggleButtonText =
      viewMode === "location"
        ? "エリア・フロア別表示に切替"
        : "フロア工区別表示に切替";

    // ▼▼▼ 追加：工区まとめ設定（チェックボックスとグループ化単位） ▼▼▼
    let settingsHtml = "";
    if (viewMode === "section") {
      const isGroupAll = state.tempOrderDetailsGroupAll;
      const groupKey = state.tempOrderDetailsGroupKey || "section"; // 'section' or 'floor'

      // グループ化単位の選択肢（全工区まとめがOFFの時のみ有効）
      const disabledClass = isGroupAll ? "opacity-50 pointer-events-none" : "";

      settingsHtml = `
                <div class="flex items-center gap-3 bg-white dark:bg-slate-700 px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 shadow-sm">
                    <label class="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300">
                        <input type="checkbox" id="temp-order-group-all-checkbox" class="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500" ${
                          isGroupAll ? "checked" : ""
                        }>
                        <span>工区まとめ (全工区合算)</span>
                    </label>
                    <div class="h-4 w-px bg-slate-300 dark:bg-slate-500 mx-1"></div>
                    <div class="flex items-center gap-2 text-sm ${disabledClass}" id="temp-order-group-key-container">
                        <span class="text-slate-600 dark:text-slate-400 font-normal">グループ化:</span>
                        <label class="inline-flex items-center cursor-pointer">
                            <input type="radio" name="temp-order-group-key" value="section" class="text-green-600 focus:ring-green-500" ${
                              groupKey === "section" ? "checked" : ""
                            }>
                            <span class="ml-1 text-slate-700 dark:text-slate-300">工区ごと</span>
                        </label>
                        <label class="inline-flex items-center cursor-pointer">
                            <input type="radio" name="temp-order-group-key" value="floor" class="text-green-600 focus:ring-green-500" ${
                              groupKey === "floor" ? "checked" : ""
                            }>
                            <span class="ml-1 text-slate-700 dark:text-slate-300">フロアごと</span>
                        </label>
                    </div>
                </div>
             `;
    }
    // ▲▲▲ 追加ここまで ▲▲▲

    const headerHtml = `
        <div class="flex flex-col sm:flex-row justify-between sm:items-center mt-8 mb-4 border-b-2 border-green-400 pb-2 gap-3">
            <h2 class="text-2xl font-bold text-slate-900 dark:text-slate-100">仮ボルト注文明細</h2>
            <!-- ★ 修正：独立した切替ボタンと設定を追加 -->
            <div class="flex flex-wrap gap-2 items-center self-end">
                ${settingsHtml}
                <button id="toggle-temp-order-view-btn" class="btn btn-neutral text-sm">${toggleButtonText}</button>
            </div>
        </div>`;

    // データ計算
    const { resultsByLocation } = calculateTempBoltResults(project);

    // 表示対象のロケーションIDを特定
    const targetLocationIds = new Set();
    if (project.mode === "advanced") {
      project.customLevels.forEach((level) => {
        if (
          state.activeTallyLevel !== "all" &&
          state.activeTallyLevel !== level
        )
          return;
        project.customAreas.forEach((area) =>
          targetLocationIds.add(`${level}-${area}`),
        );
      });
    } else {
      for (let f = 2; f <= project.floors; f++) {
        if (
          state.activeTallyLevel !== "all" &&
          state.activeTallyLevel !== f.toString()
        )
          continue;
        for (let s = 1; s <= project.sections; s++)
          targetLocationIds.add(`${f}-${s}`);
      }
      if (state.activeTallyLevel === "all" || state.activeTallyLevel === "R") {
        for (let s = 1; s <= project.sections; s++)
          targetLocationIds.add(`R-${s}`);
      }
      if (project.hasPH) {
        if (
          state.activeTallyLevel === "all" ||
          state.activeTallyLevel === "PH"
        ) {
          for (let s = 1; s <= project.sections; s++)
            targetLocationIds.add(`PH-${s}`);
        }
      }
    }

    // テーブル生成用ヘルパー
    const createTable = (title, data) => {
      if (Object.keys(data).length === 0) return "";

      let body = "";
      // サイズ順にソート（boltSortを利用）
      Object.keys(data)
        .sort(boltSort)
        .forEach((size) => {
          const count = data[size];
          body += `
                <tr class="hover:bg-green-50 dark:hover:bg-slate-700/50">
                    <td class="px-4 py-2 border border-green-200 dark:border-slate-700 text-center">${size}</td>
                    <td class="px-4 py-2 border border-green-200 dark:border-slate-700 text-center">${count.toLocaleString()}</td>
                </tr>`;
        });

      return `
            <div class="min-w-[200px] max-w-full flex-grow">
                <h4 class="text-lg font-semibold text-green-800 dark:text-green-300 mb-1">${title}</h4>
                <table class="text-sm border-collapse w-full">
                    <thead class="bg-green-200 text-xs text-green-800 dark:bg-slate-700 dark:text-green-200">
                        <tr>
                            <th class="px-4 py-2 border border-green-300 dark:border-slate-600 text-center">サイズ</th>
                            <th class="px-4 py-2 border border-green-300 dark:border-slate-600 text-center">本数</th>
                        </tr>
                    </thead>
                    <tbody class="dark:bg-slate-800">${body}</tbody>
                </table>
            </div>`;
    };

    let contentHtml = "";
    let hasContent = false;

    if (viewMode === "location") {
      // エリア・フロア別
      const sortedLocs = [];
      // ロケーション一覧を再構築してソート順を保証する（targetLocationIdsの順序だとバラバラになる可能性があるため）
      // ここでは簡易的に targetLocationIds を利用するが、本来は project.customLevels/Areas の二重ループ順で回すべき
      // ですが、targetLocationIds を生成した順序（上部で定義）が生きていればその順序で表示されます。
      // Setのイテレーション順序は挿入順なので、上記のループ順（階層→工区）で出てくるはずです。

      targetLocationIds.forEach((locId) => {
        // ラベルの復元（簡易的）
        let label = locId;
        if (project.mode === "advanced") {
          label = locId.replace("-", " - ");
        } else {
          const parts = locId.split("-");
          if (["R", "PH"].includes(parts[0]))
            label = `${parts[0]}階 ${parts[1]}工区`;
          else label = `${parts[0]}階 ${parts[1]}工区`;
        }

        // データ抽出
        const locData = resultsByLocation[locId];
        if (locData) {
          // サイズごとの合計を集計
          const sizeCounts = {};
          let total = 0;
          Object.keys(locData).forEach((size) => {
            if (locData[size].total > 0) {
              sizeCounts[size] = locData[size].total;
              total += locData[size].total;
            }
          });

          if (total > 0) {
            contentHtml += createTable(label, sizeCounts);
            hasContent = true;
          }
        }
      });
    } else {
      // フロア/工区別 (Group View)
      const resultsByGroup = {};

      const getGroupName = (locationId) => {
        // ▼▼▼ 追加：全工区まとめロジック ▼▼▼
        if (state.tempOrderDetailsGroupAll) {
          return "全工区合計";
        }
        // ▲▲▲ 追加ここまで ▲▲▲

        // ▼▼▼ 追加：グループ化キー（工区 or フロア）による分岐 ▼▼▼
        const groupKey = state.tempOrderDetailsGroupKey || "section";

        if (project.mode === "advanced") {
          // customLevels (長い順) でマッチング
          const sortedLevels = [...project.customLevels].sort(
            (a, b) => b.length - a.length,
          );
          for (const level of sortedLevels) {
            if (locationId.startsWith(level + "-")) {
              const area = locationId.substring(level.length + 1);
              if (groupKey === "floor") {
                return level; // フロア（階層）のみを返す
              } else {
                return area; // エリア（工区）のみを返す
              }
            }
          }
          return locationId; // fallback
        } else {
          // "2-1" -> parts[0]="2", parts[1]="1"
          const parts = locationId.split("-");
          if (groupKey === "floor") {
            // フロアごと: "2階", "R階"
            if (["R", "PH"].includes(parts[0])) return `${parts[0]}階`;
            return `${parts[0]}階`;
          } else {
            // 工区ごと: "1工区"
            return `${parts[1]}工区`;
          }
        }
        // ▲▲▲ 追加ここまで ▲▲▲
      };

      // グループ化処理
      targetLocationIds.forEach((locId) => {
        const groupName = getGroupName(locId);
        const locData = resultsByLocation[locId];
        if (locData) {
          if (!resultsByGroup[groupName]) resultsByGroup[groupName] = {};
          Object.keys(locData).forEach((size) => {
            if (locData[size].total > 0) {
              resultsByGroup[groupName][size] =
                (resultsByGroup[groupName][size] || 0) + locData[size].total;
            }
          });
        }
      });

      // グループ名でソートして表示
      Object.keys(resultsByGroup)
        .sort((a, b) => {
          // 数値を含む場合、数値順にしたい ("1工区", "2工区"...)
          const numA = parseInt(a.replace(/\D/g, "")) || 0;
          const numB = parseInt(b.replace(/\D/g, "")) || 0;
          if (numA !== numB) return numA - numB;
          return a.localeCompare(b);
        })
        .forEach((groupName) => {
          if (Object.keys(resultsByGroup[groupName]).length > 0) {
            contentHtml += createTable(groupName, resultsByGroup[groupName]);
            hasContent = true;
          }
        });
    }

    if (hasContent) {
      container.innerHTML =
        headerHtml +
        `<div class="flex flex-wrap gap-4 items-start content-start">${contentHtml}</div>`;
    } else {
      // データがない場合は何も表示しない、またはメッセージを表示
      // container.innerHTML = headerHtml + '<p class="text-gray-500">仮ボルトはありません。</p>';
    }
  };

  // ★ 修正版：renderDetailView（常に表を表示し、リアルタイム反映させる）
  const renderDetailView = () => {
    const project = state.projects.find((p) => p.id === state.currentProjectId);
    if (!project) {
      switchView("list");
      return;
    }
    navProjectTitle.textContent = project.name;

    // リストの描画
    renderJointsList(project);
    renderMemberLists(project);

    // ▼▼▼ 追加：常設フォームの階層チェックボックスを生成 ▼▼▼
    const staticLevelsContainer = document.getElementById(
      "add-member-levels-container",
    );
    if (staticLevelsContainer) {
      staticLevelsContainer.innerHTML = "";
      const levels = getProjectLevels(project);
      levels.forEach((lvl) => {
        const label = document.createElement("label");
        label.className =
          "flex items-center gap-2 text-sm cursor-pointer text-slate-700 dark:text-slate-300";
        // クラス名 'static-level-checkbox' を付与して識別
        label.innerHTML = `<input type="checkbox" value="${lvl.id}" class="static-level-checkbox h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-yellow-500"> ${lvl.label}`;
        staticLevelsContainer.appendChild(label);
      });
    }
    // ▲▲▲ 追加ここまで ▲▲▲

    // 集計表と結果の描画
    renderTallySheet(project);
    renderResults(project);
  };

  // --- Calculation Functions ---

  const updateTallySheetCalculations = (project) => {
    if (!project) return;
    const tallyList = getTallyList(project);

    tallyList.forEach((item) => {
      let colTotal = 0;
      document
        .querySelectorAll(`.tally-input[data-id="${item.id}"]`)
        .forEach((input) => (colTotal += parseInt(input.value) || 0));
      const totalCell = document.querySelector(
        `.col-total[data-id="${item.id}"]`,
      );
      if (totalCell) {
        totalCell.textContent = colTotal;
      }
    });

    document.querySelectorAll(".tally-row").forEach((row) => {
      let rowTotal = 0;
      row
        .querySelectorAll(".tally-input")
        .forEach((input) => (rowTotal += parseInt(input.value) || 0));
      const totalCell = row.querySelector(".row-total");
      if (totalCell) {
        totalCell.textContent = rowTotal;
      }
    });

    const grandTotal = Array.from(
      document.querySelectorAll(".col-total"),
    ).reduce((sum, cell) => sum + (parseInt(cell.textContent) || 0), 0);
    const grandTotalCell = document.querySelector(".grand-total");
    if (grandTotalCell) {
      grandTotalCell.textContent = grandTotal;
    }
  };

  // --- ロジック定義エリアに追加 ---

  // ▼▼▼ 追加: グローバル設定の読み込みと移行ロジック ▼▼▼
  const loadGlobalSettings = async () => {
    try {
      // ★修正: 特定のプロジェクトIDではなく、グローバル設定を取りに行きます
      const settingsData = await getGlobalSettings();

      // データが存在し、かつ boltSizes があるか確認
      if (settingsData && settingsData.boltSizes) {
        state.globalBoltSizes = settingsData.boltSizes;
        console.log(
          "Global settings loaded:",
          state.globalBoltSizes.length,
          "items",
        );
      } else {
        console.log("No global settings found. Checking for migration...");
        // 設定がない場合は、既存プロジェクトから吸い上げる処理へ
        await checkAndMigrateBoltSizes();
      }
    } catch (error) {
      console.error("Error loading global settings:", error);
      showCustomAlert("設定の読み込みに失敗しました。");
    }
  };

  const checkAndMigrateBoltSizes = async () => {
    try {
      // 1. 全プロジェクトのデータを配列として取得
      // （以前の getDocs(projectsCollectionRef) を置き換え）
      const allProjects = await getAllProjects();

      // snapshot.empty の代わりに 配列の長さ(length)で判定
      if (allProjects.length === 0) {
        // プロジェクトが一つもない場合は、デフォルト値で初期化
        state.globalBoltSizes = LEGACY_DEFAULT_BOLT_SIZES.map((label) =>
          parseBoltIdForGlobal(label),
        );
        await saveGlobalBoltSizes(); // ※ここも後でdb.js化が必要かも
        return;
      }

      const allBoltSizesMap = new Map();

      // 2. 各プロジェクトのボルトサイズを収集
      // snapshot.forEach ではなく、普通の配列の forEach になります
      allProjects.forEach((project) => {
        // project = doc.data() は不要です（すでにデータになっています）

        if (project.boltSizes && Array.isArray(project.boltSizes)) {
          project.boltSizes.forEach((bolt) => {
            // IDのゆらぎを吸収してマップに登録
            const parsed = parseBoltIdForGlobal(bolt.id);
            if (!allBoltSizesMap.has(parsed.id)) {
              allBoltSizesMap.set(parsed.id, parsed);
            }
          });
        }
      });

      // 3. データが何もない場合はデフォルト値を適用
      if (allBoltSizesMap.size === 0) {
        LEGACY_DEFAULT_BOLT_SIZES.forEach((label) => {
          const parsed = parseBoltIdForGlobal(label);
          allBoltSizesMap.set(parsed.id, parsed);
        });
      }

      // 4. マップから配列に変換してStateへ設定
      state.globalBoltSizes = Array.from(allBoltSizesMap.values());

      // 5. ソートして保存
      sortGlobalBoltSizes();
      await saveGlobalBoltSizes(); // ★注意点あり（後述）

      console.log(
        "Migration completed. Total global sizes:",
        state.globalBoltSizes.length,
      );
      showToast("既存データからボルトサイズ設定を統合しました");
    } catch (error) {
      console.error("Migration failed:", error);
    }
  };

  const saveGlobalBoltSizes = async () => {
    try {
      // const globalSettingsRef = doc(
      //   db,
      //   "artifacts",
      //   appId,
      //   "public",
      //   "data",
      //   "settings",
      //   "global"
      // );
      /* firestoreのsetDocは、merge:trueオプションをつけることで、
               ドキュメントが存在しない場合は作成、存在する場合は指定フィールドのみ更新が可能 */
      // await setDoc(
      //   globalSettingsRef,
      //   {
      //     boltSizes: state.globalBoltSizes,
      //   },
      //   { merge: true }
      // );
      await setProjectData(state.currentProjectId, {
        boltsizes: state.globalBoltSizes,
      });
    } catch (error) {
      console.error("Error saving global settings:", error);
      throw error;
    }
  };

  // ヘルパー: ID解析 (ensureProjectBoltSizes内のものをグローバル用に再定義)
  const parseBoltIdForGlobal = (idString) => {
    const cleanId = idString.trim().replace(/x/g, "×");
    const separator = "×";
    const isMekki = cleanId.endsWith("■");
    const processingId = isMekki ? cleanId.replace("■", "") : cleanId;
    const parts = processingId.split(separator);
    let type = "Unknown";
    let length = 0;

    if (parts.length >= 2) {
      const lenStr = parts.pop();
      length = parseInt(lenStr) || 0;
      let rawType = parts.join(separator);
      if (rawType.startsWith("中ボ")) {
        const sizePart = rawType.replace("中ボ", "");
        type = `中ボ(Mネジ) ${sizePart}`;
      } else if (isMekki) {
        type = `${rawType}めっき`;
      } else {
        type = rawType;
      }
    } else {
      type = cleanId;
    }
    return { id: cleanId, label: cleanId, type, length };
  };

  const sortGlobalBoltSizes = () => {
    const typeOrderList = [
      "M16",
      "M16めっき",
      "M20",
      "M20めっき",
      "M22",
      "M22めっき",
      "中ボ(Mネジ) M16",
      "中ボ(Mネジ) M20",
      "中ボ(Mネジ) M22",
      "Dドブ12",
      "Dユニ12",
      "Dドブ16",
      "Dユニ16",
    ];
    const typeOrder = {};
    typeOrderList.forEach((t, i) => (typeOrder[t] = i));

    state.globalBoltSizes.sort((a, b) => {
      let orderA = typeOrder[a.type] !== undefined ? typeOrder[a.type] : 999;
      let orderB = typeOrder[b.type] !== undefined ? typeOrder[b.type] : 999;
      if (orderA !== orderB) return orderA - orderB;
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      return a.length - b.length;
    });
  };
  // ▲▲▲ 追加ここまで ▲▲▲

  /**
/**
* 【決定版・改2】ボルトサイズ整合性チェック (表記統一機能付き)
* ・「中ボルト(Mネジ)」を「中ボ(Mネジ)」に統一
* ・半角xを全角×に統一
*/
  const ensureProjectBoltSizes = async (project) => {
    // 1. ヘルパー関数: ID文字列から情報を解析
    const parseBoltId = (idString) => {
      // IDの表記揺れ統一 (半角x -> 全角×)
      const cleanId = idString.trim().replace(/x/g, "×");
      const separator = "×";

      const isMekki = cleanId.endsWith("■");
      const processingId = isMekki ? cleanId.replace("■", "") : cleanId;

      const parts = processingId.split(separator);
      let type = "Unknown";
      let length = 0;

      if (parts.length >= 2) {
        const lenStr = parts.pop();
        length = parseInt(lenStr) || 0;
        let rawType = parts.join(separator);

        if (rawType.startsWith("中ボ")) {
          const sizePart = rawType.replace("中ボ", "");
          // ▼▼▼ 修正: 表記を「中ボ(Mネジ)」に統一 ▼▼▼
          type = `中ボ(Mネジ) ${sizePart}`;
        } else if (isMekki) {
          type = `${rawType}めっき`;
        } else {
          type = rawType;
        }
      } else {
        type = cleanId;
      }

      return { id: cleanId, label: cleanId, type, length };
    };

    // 2. リスト初期化
    if (!project.boltSizes || !Array.isArray(project.boltSizes)) {
      project.boltSizes = [];
    }

    // 空ならレガシーリスト適用
    if (project.boltSizes.length === 0) {
      project.boltSizes = LEGACY_DEFAULT_BOLT_SIZES.map((label) =>
        parseBoltId(label),
      );
    }

    // ▼▼▼ 3. 既存データの名称・表記の強制アップデート ▼▼▼
    const uniqueMap = new Map();
    let updatedCount = 0; // 変更があった件数

    project.boltSizes.forEach((bolt) => {
      // IDから最新の情報を再解析（これで type が「中ボ(Mネジ)...」に更新される）
      const newInfo = parseBoltId(bolt.id);

      // 既存のプロパティ（restoredフラグなど）を維持しつつ、type等を上書き
      const updatedBolt = { ...bolt, ...newInfo };

      // 変更検知（表記が変わる場合）
      if (bolt.type !== newInfo.type || bolt.id !== newInfo.id) {
        updatedCount++;
      }

      if (!uniqueMap.has(updatedBolt.id)) {
        uniqueMap.set(updatedBolt.id, updatedBolt);
      }
    });

    // リストを更新
    project.boltSizes = Array.from(uniqueMap.values());
    // ▲▲▲ アップデート処理ここまで ▲▲▲

    // 4. 隠れデータの復元スキャン
    const existingIds = new Set(project.boltSizes.map((b) => b.id));
    let restoredCount = 0;

    if (project.joints && Array.isArray(project.joints)) {
      project.joints.forEach((j) => {
        const sizesToCheck = [j.flangeSize, j.webSize];
        sizesToCheck.forEach((val) => {
          if (!val || val.trim() === "") return;

          // 比較用IDも統一してチェック
          const unifiedVal = val.trim().replace(/x/g, "×");

          if (existingIds.has(unifiedVal)) return;

          const boltInfo = parseBoltId(unifiedVal);
          boltInfo.restored = true;

          project.boltSizes.push(boltInfo);
          existingIds.add(unifiedVal);
          restoredCount++;
        });
      });
    }

    // 5. ソート (定義も新しい名前に合わせる)
    const typeOrderList = [
      "M16",
      "M16めっき",
      "M20",
      "M20めっき",
      "M22",
      "M22めっき",
      // ▼▼▼ 修正: ソート順定義も「中ボ(Mネジ)」に変更 ▼▼▼
      "中ボ(Mネジ) M16",
      "中ボ(Mネジ) M20",
      "中ボ(Mネジ) M22",
      "Dドブ12",
      "Dユニ12",
      "Dドブ16",
      "Dユニ16",
    ];
    const typeOrder = {};
    typeOrderList.forEach((t, i) => (typeOrder[t] = i));

    project.boltSizes.sort((a, b) => {
      let orderA = typeOrder[a.type] !== undefined ? typeOrder[a.type] : 999;
      let orderB = typeOrder[b.type] !== undefined ? typeOrder[b.type] : 999;

      if (orderA !== orderB) return orderA - orderB;
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      return a.length - b.length;
    });

    // 6. 自動保存 (復元、または名称変更があった場合)
    if (restoredCount > 0 || updatedCount > 0) {
      console.log(
        `✅ データの統一(名称変更:${updatedCount}件)と復元(${restoredCount}件)を行いました`,
      );
      // データベースを更新
      // ★ ここで state.currentProjectId ではなく project.id を使います
      if (project.id) {
        try {
          await updateProjectData(project.id, {
            boltSizes: project.boltSizes,
          });
          console.log("ボルトサイズ設定をDBに保存しました。");
        } catch (err) {
          console.error("ボルトサイズ設定の保存に失敗しました:", err);
        }
      } else {
        console.warn("プロジェクトIDが不明なため、DB保存をスキップしました。");
      }
    }

    return project;
  };

  // ▼▼▼ ボルトサイズ設定のタブ管理と描画ロジック ▼▼▼

  // 現在選択されているタブ（デフォルトはすべて）
  // ▼▼▼ ボルトサイズ設定のタブ管理と描画ロジック (グローバル対応) ▼▼▼

  let activeBoltTab = "all";

  document.querySelectorAll(".bolt-tab-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      activeBoltTab = e.target.dataset.tab;
      renderBoltSizeSettings(); // No arg
    });
  });

  /**
   * ボルト設定画面のリスト描画 (グローバル版)
   */
  const renderBoltSizeSettings = () => {
    const listContainer = document.getElementById("bolt-size-list");
    listContainer.innerHTML = "";
    const boltSizes = state.globalBoltSizes || [];

    // 1. タブの見た目を更新
    document.querySelectorAll(".bolt-tab-btn").forEach((btn) => {
      const isTarget = btn.dataset.tab === activeBoltTab;
      if (isTarget) {
        btn.className =
          "bolt-tab-btn px-4 py-2 text-sm font-medium whitespace-nowrap text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400 transition-colors";
      } else {
        btn.className =
          "bolt-tab-btn px-4 py-2 text-sm font-medium whitespace-nowrap text-slate-500 border-b-2 border-transparent hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200 transition-colors";
      }
    });

    // 2. データのフィルタリング
    const filteredBolts = boltSizes.filter((bolt) => {
      const type = bolt.type || "";
      switch (activeBoltTab) {
        case "all":
          return true;
        case "M16":
          return type.startsWith("M16");
        case "M20":
          return type.startsWith("M20");
        case "M22":
          return type.startsWith("M22");
        case "chubo":
          return type.startsWith("中ボ");
        case "dlock_dobu":
          return type.startsWith("Dドブ");
        case "dlock_uni":
          return type.startsWith("Dユニ");
        case "other":
          return (
            !type.startsWith("M16") &&
            !type.startsWith("M20") &&
            !type.startsWith("M22") &&
            !type.startsWith("中ボ") &&
            !type.startsWith("Dドブ") &&
            !type.startsWith("Dユニ")
          );
        default:
          return true;
      }
    });

    document.getElementById("bolt-size-count").textContent =
      `表示: ${filteredBolts.length} / 全${boltSizes.length} 件`;

    // 3. リスト生成
    if (filteredBolts.length === 0) {
      listContainer.innerHTML =
        '<li class="text-center text-slate-400 py-4 text-sm">該当するサイズはありません</li>';
      return;
    }

    filteredBolts.forEach((bolt) => {
      // 使用中チェック (全てのプロジェクトから検索)
      const isUsed = state.projects.some((p) =>
        p.joints.some((j) => j.flangeSize === bolt.id || j.webSize === bolt.id),
      );

      const li = document.createElement("li");
      li.className =
        "flex justify-between items-center bg-white dark:bg-slate-700 p-3 rounded border border-gray-200 dark:border-slate-600 shadow-sm";
      li.innerHTML = `
            <div class="flex flex-col">
                <div class="flex items-center gap-2">
                    <span class="font-bold text-slate-800 dark:text-slate-200 text-lg">${bolt.label}</span>
                </div>
                <div class="text-xs text-slate-500 dark:text-slate-400">種類: ${bolt.type} / 長さ: ${bolt.length}mm</div>
            </div>
            <button class="delete-bolt-size-btn text-red-500 hover:text-red-700 p-2 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors" data-id="${bolt.id}" title="削除">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 000-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                </svg>
            </button>
        `;
      listContainer.appendChild(li);
    });

    // 削除ボタンイベント設定
    listContainer.querySelectorAll(".delete-bolt-size-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const idToDelete = e.currentTarget.dataset.id;

        const isUsed = state.projects.some((p) =>
          p.joints.some(
            (j) => j.flangeSize === idToDelete || j.webSize === idToDelete,
          ),
        );
        if (isUsed) {
          // 使用中のプロジェクト名を取得して表示するとなお親切だが、まずは単純な警告で
          showCustomAlert(
            `「${idToDelete}」は登録されている継手(いずれかの工事)で使用されているため、削除できません。`,
          );
          return;
        }

        if (
          confirm(
            `「${idToDelete}」をリストから削除しますか？\n(全ての工事の選択肢から削除されます)`,
          )
        ) {
          state.globalBoltSizes = state.globalBoltSizes.filter(
            (b) => b.id !== idToDelete,
          );
          renderBoltSizeSettings();
          populateGlobalBoltSelectorModal(); // Update selector
          await saveGlobalBoltSizes();
        }
      });
    });
  };

  // 1. 設定モーダルを開く (NAVボタン)
  // nav-btn-bolt-settings 要素の取得とイベント設定
  const navBtnBoltSettings = document.getElementById("nav-btn-bolt-settings");
  if (navBtnBoltSettings) {
    navBtnBoltSettings.classList.remove("hidden"); // ボタンを表示
    navBtnBoltSettings.addEventListener("click", () => {
      // 種類セレクトボックスの選択肢生成
      newBoltTypeSelect.innerHTML = "";
      BOLT_TYPES.forEach((type) => {
        const opt = document.createElement("option");
        opt.value = type;
        opt.textContent = type;
        newBoltTypeSelect.appendChild(opt);
      });
      newBoltTypeSelect.value = "M16";

      renderBoltSizeSettings(); // Global
      openModal(boltSizeSettingsModal);
    });
  }

  // 2. 新規追加ボタン
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

    // 再描画（ソート含む）
    sortGlobalBoltSizes();
    renderBoltSizeSettings();
    populateGlobalBoltSelectorModal(); // Update selector
    await saveGlobalBoltSizes();

    // 入力クリア
    newBoltLengthInput.value = "";
    newBoltLengthInput.focus();

    setTimeout(() => {
      const newItem = Array.from(boltSizeList.children).find((li) =>
        li.innerHTML.includes(newId),
      );
      if (newItem)
        newItem.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  });

  /**
   * 設定画面を閉じる時の処理
   * 「復元マーク」を全て削除して、きれいな状態で保存します。
   */
  const finalizeBoltSettings = () => {
    const project = state.projects.find((p) => p.id === state.currentProjectId);

    if (project && project.boltSizes) {
      let hasChanges = false;

      // 全てのボルトデータから 'restored' フラグを削除する
      project.boltSizes.forEach((bolt) => {
        if (bolt.restored) {
          delete bolt.restored; // フラグを消す
          hasChanges = true;
        }
      });

      // 変更があった（マークを消した）場合、または単に閉じる場合でも保存を実行
      // ▼▼▼ 修正箇所 ▼▼▼
      // db.js の関数を使うことで、パス指定などの複雑な処理を削除できます
      updateProjectData(state.currentProjectId, {
        boltSizes: project.boltSizes,
      })
        .then(() => console.log("💾 復元マークをクリアして保存しました"))
        .catch((err) => console.error("保存エラー:", err));
      // ▲▲▲ 修正箇所ここまで ▲▲▲
    }

    // モーダルを閉じる
    closeModal(boltSizeSettingsModal);
  };

  // ×ボタンで閉じる時
  closeBoltSizeModalBtn.addEventListener("click", finalizeBoltSettings);

  // 下部の「閉じる(保存)」ボタンで閉じる時
  saveBoltSizeSettingsBtn.addEventListener("click", finalizeBoltSettings);

  // --- Event Listeners ---
  // ★ 修正版：新規工事登録（即時反映対応）
  addProjectBtn.addEventListener("click", async () => {
    // async を追加
    const name = projectNameInput.value.trim();
    const propertyName = document.getElementById("property-name").value.trim();
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
          invalidElements: [customLevelsCountInput],
        });
      if (isNaN(areasCount) || areasCount < 1)
        return showCustomAlert("エリア数は1以上の数値を入力してください。", {
          invalidElements: [customAreasCountInput],
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
        return showCustomAlert("すべての階層名とエリア名を入力してください。");
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

    // ▼▼▼ 修正：ローカルState更新と再描画を追加 ▼▼▼
    try {
      // 1. データベースに追加（awaitでID確定を待つ）
      const docRef = await addProject(newProject);

      // 2. ローカルのstateに新しい工事を追加
      const createdProject = { ...newProject, id: docRef.id };
      state.projects.push(createdProject);

      // 名前順にソート（一覧の並び順を維持するため）
      state.projects.sort((a, b) => a.name.localeCompare(b.name));

      // 3. 画面を再描画して即座に表示
      renderProjectList();
      showToast("新しい工事を登録しました。");
    } catch (err) {
      console.error(err);
      showCustomAlert("工事の追加に失敗しました。");
      return; // 失敗したら入力欄をリセットしない
    }
    // ▲▲▲ 修正ここまで ▲▲▲

    // フォームのリセット
    projectNameInput.value = "";
    document.getElementById("property-name").value = "";
    projectFloorsInput.value = "";
    projectSectionsInput.value = "";
    projectHasPhInput.checked = false;
    advancedSettingsToggle.checked = false;
    simpleProjectSettings.classList.remove("hidden");
    advancedProjectSettings.classList.add("hidden");
    addCustomLevelsCountInput.value = "1";
    addCustomAreasCountInput.value = "1";
    newLevelNameCache = [];
    newAreaNameCache = [];
    customLevelsContainer.innerHTML = "";
    customAreasContainer.innerHTML = "";
    // リセット後に入力欄を1つずつ再生成しておく
    generateCustomInputFields(1, customLevelsContainer, "custom-level");
    generateCustomInputFields(1, customAreasContainer, "custom-area");
  }); // ★ 修正版：複製の実行処理
  // ★ 修正版：複製の実行処理（連打防止 & 重複ブロック）
  executeCopyBtn.addEventListener("click", async () => {
    // ▼▼▼ 追加：連打防止（処理開始時にボタンを無効化） ▼▼▼
    executeCopyBtn.disabled = true;
    executeCopyBtn.classList.add("opacity-50", "cursor-not-allowed");
    executeCopyBtn.textContent = "処理中...";
    // ▲▲▲ 追加ここまで ▲▲▲

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

      // ▼▼▼ 追加：同名重複チェック（ブロック機能） ▼▼▼
      const isDuplicate = state.projects.some(
        (p) =>
          p.propertyName === sourceProject.propertyName && // 同じ物件グループで
          p.name === newName, // 同じ名前があるか
      );

      if (isDuplicate) {
        throw new Error(
          `物件「${
            sourceProject.propertyName || "(未設定)"
          }」内に、工事名「${newName}」は既に存在します。\n別の名前を指定してください。`,
        );
      }
      // ▲▲▲ 追加ここまで ▲▲▲

      // データのディープコピー
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

      // データベースに追加
      const docRef = await addProject(newProject);

      // ローカルState更新（楽観的UI）
      const createdProject = { ...newProject, id: docRef.id };
      state.projects.push(createdProject);
      state.projects.sort((a, b) => a.name.localeCompare(b.name));

      renderProjectList();
      closeModal(copyProjectModal);
      showToast("工事を複製しました。");
    } catch (err) {
      console.error("複製エラー:", err);
      // エラーメッセージをアラートで表示（Errorオブジェクトか文字列かで分岐）
      showCustomAlert(err.message || "工事の複製に失敗しました。");
    } finally {
      // ▼▼▼ 追加：連打防止解除（処理終了後にボタンを戻す） ▼▼▼
      executeCopyBtn.disabled = false;
      executeCopyBtn.classList.remove("opacity-50", "cursor-not-allowed");
      executeCopyBtn.textContent = "複製する";
      // ▲▲▲ 追加ここまで ▲▲▲
    }
  });

  // ▼▼▼ 追加：複製モーダルを閉じる処理 ▼▼▼
  [closeCopyModalBtn, cancelCopyBtn].forEach((btn) => {
    if (btn) {
      btn.addEventListener("click", () => closeModal(copyProjectModal));
    }
  });
  // ▲▲▲ 追加ここまで ▲▲▲

  // ★ 修正版：物件一覧のクリック処理（カード全体クリック対応）
  // ★ 修正版：物件一覧のクリック処理（複製・編集・削除・グループ・選択の統合版）
  // ★ 修正版：物件一覧のクリック処理（自動連番命名 & 複製対応版）
  projectsContainer.addEventListener("click", (e) => {
    const editBtn = e.target.closest(".edit-project-btn");
    const deleteBtn = e.target.closest(".delete-project-btn");
    const duplicateBtn = e.target.closest(".duplicate-project-btn");
    const editGroupBtn = e.target.closest(".edit-group-btn");
    const showAggBtn = e.target.closest(".show-aggregated-results-btn");

    if (editBtn) {
      const project = state.projects.find((p) => p.id === editBtn.dataset.id);
      if (project) openEditProjectModal(project);
      return;
    }

    if (deleteBtn) {
      openConfirmDeleteModal(deleteBtn.dataset.id, "project");
      return;
    }

    // --- ▼▼▼ 修正：複製ボタン（連番名生成ロジック） ▼▼▼ ---
    if (duplicateBtn) {
      const projectId = duplicateBtn.dataset.id;
      const project = state.projects.find((p) => p.id === projectId);
      if (project) {
        copySourceIdInput.value = projectId;

        // 1. 同じ物件グループの工事を抽出
        const sameGroupProjects = state.projects.filter(
          (p) => p.propertyName === project.propertyName,
        );

        // 2. 名前から既存の連番「(N)」を除去してベース名を取得
        // 例: "工事A(2)" -> "工事A"
        let baseName = project.name.replace(/\(\d+\)$/, "").trim();

        // 3. 空き番号を探す
        let newName = baseName;
        let counter = 2;

        // 同名の工事が存在する限り番号を増やしていく
        while (
          sameGroupProjects.some(
            (p) =>
              p.name === (counter === 1 ? baseName : `${baseName}(${counter})`),
          )
        ) {
          counter++;
        }

        // 4. 新しい名前を決定
        copyNewNameInput.value = `${baseName}(${counter})`;

        const defaultRadio = document.querySelector(
          'input[name="copy-mode"][value="with_master"]',
        );
        if (defaultRadio) defaultRadio.checked = true;

        openModal(copyProjectModal);
        setTimeout(() => copyNewNameInput.select(), 100);
      }
      return;
    }
    // --- ▲▲▲ 修正ここまで ▲▲▲ ---

    if (editGroupBtn) {
      const propertyName = editGroupBtn.dataset.propertyName;
      document.getElementById("edit-group-old-name").value = propertyName;
      document.getElementById("edit-group-new-name").value = propertyName;
      openModal(document.getElementById("edit-group-modal"));
      return;
    }

    if (showAggBtn) {
      const propertyName = showAggBtn.dataset.propertyName;
      const projectsInGroup = state.projects.filter(
        (p) => p.propertyName === propertyName,
      );
      if (projectsInGroup.length > 0) {
        const aggregatedData = calculateAggregatedResults(projectsInGroup);
        renderAggregatedResults(propertyName, aggregatedData);
        openModal(document.getElementById("aggregated-results-modal"));
      }
      return;
    }

    const projectCard = e.target.closest(".project-card");
    if (projectCard) {
      const projectId = projectCard.dataset.id;

      // プロジェクト選択時の処理を実行
      resetMemberForm();

      // ▼▼▼ 追加：ソート状態をリセット ▼▼▼
      state.sort = {};
      // ▲▲▲ 追加ここまで ▲▲▲

      state.currentProjectId = projectId;
      renderDetailView();
      switchView("detail");
    }
  });

  addJointBtn.addEventListener("click", () => {
    const project = state.projects.find((p) => p.id === state.currentProjectId);
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
    // --- ここまで修正 ---

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
      // 複合SPLの場合、ルートのwebSize/Countは空にする
      webSize = "";
      webCount = 0;
    }
    // ▲▲▲ ここまでが修正箇所 ▲▲▲
    else {
      // isComplexSplでない場合の既存ロジック
      if (isPin) {
        flangeSize = "";
        flangeCount = 0;
      }
      const oneBoltTypes = ["column", "wall_girt", "roof_purlin"];
      if (oneBoltTypes.includes(type)) {
        webSize = "";
        webCount = 0;
      }
    }

    const newJoint = {
      id: `joint_${Date.now()}`,
      type,
      name,
      // ▼▼▼ 追加：色が有効なら値を保存、無効ならnull ▼▼▼
      color: jointColorToggle.checked ? jointColorInput.value : null,
      // ▲▲▲ 追加ここまで ▲▲▲
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
        isPin && !isDoubleShearInput.checked ? false : hasShopSplInput.checked,
      hasBoltCorrection:
        isPin && !isDoubleShearInput.checked
          ? false
          : hasShopSplInput.checked && hasBoltCorrectionInput.checked,
      countAsMember: isCounted,
      tempBoltSetting: type === "column" ? "none" : tempBoltSettingInput.value,
      // ★追加: 本柱以外、かつチェックが入っている場合に true
      isBundledWithColumn:
        type !== "column" &&
        isBundledWithColumnInput &&
        isBundledWithColumnInput.checked,
      shopTempBoltCount:
        parseInt(document.getElementById("shop-temp-bolt-count").value) || null,
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

    // データベースに継手を追加し、成功したらトーストを表示する関数
    // ▼▼▼以下のコードに置き換え▼▼▼
    const addJointAndShowToast = (jointData) => {
      // 手順A: ブラウザ内のデータ（state）を先に書き換えます
      const projectIndex = state.projects.findIndex(
        (p) => p.id === state.currentProjectId,
      );
      if (projectIndex === -1) return;
      const updatedJoints = [...state.projects[projectIndex].joints, jointData];
      state.projects[projectIndex].joints = updatedJoints;

      // 手順B: 書き換えたデータで、画面を即座に再描画します
      renderDetailView();

      // 手順C: フォームをリセットし、ユーザーに完了を通知します
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
      jointNameInput.focus();

      // 手順D: 裏側で、データベースへの保存処理を実行します
      updateProjectData(state.currentProjectId, {
        joints: updatedJoints,
      }).catch((err) => {
        // エラー時の処理（ユーザーへの通知）
        showCustomAlert(
          "継手の追加に失敗しました。ページをリロードしてデータを確認してください。",
        );
        console.error("継手の追加に失敗: ", err);
      });
    };

    // 既存の継手名チェック
    const existingJoint = project.joints.find((j) => j.name === name);
    if (existingJoint) {
      state.tempJointData = newJoint; // newJointは元のコードの入力チェック部分で作成
      confirmAddMessage.textContent = `継手名「${name}」は既に登録されています。このまま登録しますか？`;
      openModal(confirmAddModal);
    } else {
      addJointAndShowToast(newJoint); // newJointは元のコードの入力チェック部分で作成
    }
  });

  // ★ 修正版：部材追加ボタン（即時反映・階層情報対応版）
  addMemberBtn.addEventListener("click", () => {
    const project = state.projects.find((p) => p.id === state.currentProjectId);
    if (!project) return;
    const name = memberNameInput.value.trim();
    const jointId = memberJointSelectId.value;
    if (!name)
      return showCustomAlert("部材名を入力してください。", {
        invalidElements: [memberNameInput],
      });
    if (!jointId)
      return showCustomAlert("使用する継手を選択してください。", {
        invalidElements: [memberJointSelectInput],
      });

    // チェックされた階層を取得
    const checkedLevels = Array.from(
      document.querySelectorAll(".static-level-checkbox:checked"),
    ).map((cb) => cb.value);

    // 新しい部材データを作成
    const newMember = {
      id: `member_${Date.now()}`,
      name,
      jointId,
      targetLevels: checkedLevels,
    };

    // ▼▼▼ 修正：ここから楽観的UI処理 ▼▼▼

    // 1. ローカルのstateを即座に更新
    if (!project.members) project.members = [];
    project.members.push(newMember);

    // 2. 画面を再描画して即座にリストに反映
    renderDetailView();

    // 3. フォームのリセットと通知
    memberNameInput.value = "";
    document
      .querySelectorAll(".static-level-checkbox")
      .forEach((cb) => (cb.checked = false));

    const jointName = memberJointSelectInput.value;
    showToast(`部材「${name}」を登録しました (使用継手: ${jointName})`);
    memberNameInput.focus();

    // 4. 裏側でデータベースに保存
    updateProjectData(state.currentProjectId, {
      members: project.members,
    }).catch((err) => {
      console.error("部材の追加に失敗: ", err);
      showCustomAlert(
        "部材の追加に失敗しました。ページをリロードして確認してください。",
      );
    });
  });

  // ★ 修正版：継手リストのクリック処理（統合・完全版）
  jointListsContainer.addEventListener("click", (e) => {
    // ボタン要素を取得（アイコンをクリックした場合も考慮してclosestを使う）
    const target = e.target.closest("button");
    if (!target) return;

    const jointId = target.dataset.id;
    const project = state.projects.find((p) => p.id === state.currentProjectId);
    if (!project) return;

    // --- 削除ボタン ---
    if (target.classList.contains("delete-joint-btn")) {
      openConfirmDeleteModal(jointId, "joint");
      return;
    }

    // --- 編集ボタン ---
    if (target.classList.contains("edit-joint-btn")) {
      const joint = project.joints.find((j) => j.id === jointId);
      if (joint) {
        // タイトルを「編集」に戻す（新規登録ボタンで書き換わっている可能性があるため）
        const modalTitle = document.querySelector("#edit-joint-modal h3");
        if (modalTitle) modalTitle.textContent = "継手の編集";

        // 編集モーダルを開く
        openEditModal(joint);
      }
      return;
    }
  });

  memberListsContainer.addEventListener("click", (e) => {
    const target = e.target.closest("button");
    if (!target) return;
    if (target.classList.contains("delete-member-btn")) {
      openConfirmDeleteModal(target.dataset.id, "member");
    } else if (target.classList.contains("edit-member-btn")) {
      // ▼▼▼ 追加：タイトルを「編集」に戻す ▼▼▼
      document.querySelector("#edit-member-modal h3").textContent =
        "部材の編集";

      openEditMemberModal(target.dataset.id);
    } else if (target.classList.contains("edit-joint-btn")) {
      const jointId = target.dataset.jointId;
      const project = state.projects.find(
        (p) => p.id === state.currentProjectId,
      );
      const joint = project?.joints.find((j) => j.id === jointId);
      if (joint) openEditModal(joint);
    }
  });

  // 列のロック状態を即座にUIに反映させるためのヘルパー関数
  const updateColumnLockUI = (itemId, isLocked) => {
    const table = document.querySelector("#tally-sheet-container table");
    if (!table) return;

    // data-column-id を使って列全体のセルと入力を選択
    const cells = table.querySelectorAll(`[data-column-id="${itemId}"]`);
    const inputs = table.querySelectorAll(
      `input.tally-input[data-id="${itemId}"]`,
    );

    cells.forEach((cell) => {
      cell.classList.toggle("locked-column", isLocked);
    });
    inputs.forEach((input) => {
      input.disabled = isLocked;
    });
  };

  tallySheetContainer.addEventListener("change", (e) => {
    // ロック用チェックボックスが変更された時の処理
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

      updateColumnLockUI(itemId, isLocked);

      const fieldPath = `tallyLocks.${itemId}`;

      updateProjectData(state.currentProjectId, {
        [fieldPath]: isLocked,
      }).catch((err) => {
        console.error("ロック状態の保存に失敗しました: ", err);
        showCustomAlert("ロック状態の保存に失敗しました。");
        e.target.checked = !isLocked;
        project.tallyLocks[itemId] = !isLocked; // 失敗時は戻す
        updateColumnLockUI(itemId, !isLocked);
      });
    }

    // 箇所数入力のセルが変更された時の処理
    if (e.target.classList.contains("tally-input")) {
      const project = state.projects.find(
        (p) => p.id === state.currentProjectId,
      );
      if (!project) return;
      const { location, id } = e.target.dataset;
      const fieldPath = `tally.${location}.${id}`;

      // 値をより厳密に取得・整形
      let valueStr = e.target.value.trim();
      valueStr = valueStr.replace(/[０-９]/g, (s) =>
        String.fromCharCode(s.charCodeAt(0) - 0xfee0),
      );

      const quantity = parseInt(valueStr, 10);

      // 1. ブラウザ内のデータ(state)を即座に更新
      if (!project.tally) project.tally = {};
      if (!project.tally[location]) project.tally[location] = {};

      if (valueStr === "" || isNaN(quantity)) {
        delete project.tally[location][id];
        e.target.value = ""; // 見た目もクリア
      } else {
        project.tally[location][id] = quantity;
        e.target.value = quantity; // 整形した数値を戻す
      }

      // 2. 箇所数入力の表の合計値を更新
      updateTallySheetCalculations(project);

      // 3. 全ての集計結果の表を再計算・再描画
      renderResults(project);

      // 4. 裏側でデータベースに保存
      const valueToSave = valueStr === "" || isNaN(quantity) ? null : quantity;
      updateProjectData(state.currentProjectId, {
        [fieldPath]: valueToSave,
      }).catch((err) => {
        showCustomAlert(`集計結果の保存に失敗`);
        console.error("Error updating tally: ", err);
      });
    }
  });

  // ★ 修正版：継手の保存処理（新規・編集 両対応）
  // ★ 修正版：継手の保存処理（連続登録対応）
  // ★ 修正版：継手の保存処理（データ整合性確保・連続登録対応）
  saveJointBtn.addEventListener("click", () => {
    const project = state.projects.find((p) => p.id === state.currentProjectId);
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

    // ▼▼▼ 修正：継手の種類に応じてフラグを強制補正する ▼▼▼
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
    // ▲▲▲ 修正ここまで ▲▲▲

    if (isComplexSpl) {
      const splCount = parseInt(editComplexSplCountInput.value);
      const invalidElements = [];
      for (let i = 1; i <= splCount; i++) {
        const suffix = i > 1 ? `-${i}` : "";
        const sizeInput = document.getElementById(`edit-web-size${suffix}`);
        const countInput = document.getElementById(`edit-web-count${suffix}`);
        if (!sizeInput.value) invalidElements.push(sizeInput.parentElement);
        if (!countInput.value) invalidElements.push(countInput);
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
    if (isPin && isDoubleShear && !isComplexSpl && webCountForValidation < 2) {
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
      // ▼▼▼ 追加：色の保存（未設定フラグがあれば null） ▼▼▼
      color:
        editJointColorInput.dataset.isNull === "true"
          ? null
          : editJointColorInput.value,
      // ▲▲▲ 追加ここまで ▲▲▲
      // ★追加
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
      shopTempBoltCount:
        parseInt(document.getElementById("edit-shop-temp-bolt-count").value) ||
        null,
      shopTempBoltSize:
        document.getElementById("edit-shop-temp-bolt-size").value || null,
      shopTempBoltCount_F:
        parseInt(
          document.getElementById("edit-shop-temp-bolt-count-f").value,
        ) || null,
      shopTempBoltSize_F:
        document.getElementById("edit-shop-temp-bolt-size-f").value || null,
      shopTempBoltCount_W:
        parseInt(
          document.getElementById("edit-shop-temp-bolt-count-w").value,
        ) || null,
      shopTempBoltSize_W:
        document.getElementById("edit-shop-temp-bolt-size-w").value || null,
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

    // --- 保存実行 ---
    const performUpdate = (finalJointData, finalMembers) => {
      const projectIndex = state.projects.findIndex(
        (p) => p.id === state.currentProjectId,
      );
      if (projectIndex === -1) return;

      let newJointsList;
      if (jointId) {
        newJointsList = state.projects[projectIndex].joints.map((j) =>
          j.id === jointId ? finalJointData : j,
        );
      } else {
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
        closeModal(editModal);
      } else {
        // 新規登録モードならリセットして継続
        resetJointForm();
        editJointIdInput.value = "";
        document.getElementById("edit-joint-name").focus();
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

      updateProjectData(state.currentProjectId, updatePayload).catch((err) => {
        showCustomAlert(`継手の${actionWord}に失敗しました。`);
        console.error("保存失敗: ", err);
      });
    };

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
        confirmMemberDeletionMessage.innerHTML = `「部材としてカウント」をONにすると、紐付けられている以下の部材が削除されます。<br><strong class="text-red-600">${memberNames}</strong>`;
        const updatedMembers = (project.members || []).filter(
          (member) => member.jointId !== jointId,
        );
        state.pendingAction = () => {
          performUpdate(updatedDataPayload, updatedMembers);
          closeModal(confirmMemberDeletionModal);
        };
        openModal(confirmMemberDeletionModal);
        return;
      }
    }

    performUpdate(updatedDataPayload);
  });
  // ★ 修正版：部材の保存処理（新規・編集 両対応）
  // ★ 修正版：部材保存（階層情報保存対応）
  // ★ 修正版：部材の保存処理（新規登録時の連続入力対応）
  saveMemberBtn.addEventListener("click", () => {
    const project = state.projects.find((p) => p.id === state.currentProjectId);
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
      // 更新
      const member = project.members.find((m) => m.id === memberId);
      if (member) {
        member.name = newName;
        member.jointId = newJointId;
        member.targetLevels = checkedLevels; // 保存
      }
      newMembersList = project.members;
    } else {
      // 新規登録
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

    renderDetailView();

    const actionWord = memberId ? "更新" : "登録";
    showToast(`部材「${newName}」を${actionWord}しました`);

    // ▼▼▼ 修正：新規登録時はモーダルを閉じずにリセット ▼▼▼
    if (memberId) {
      // 編集モード：閉じる
      closeModal(editMemberModal);
    } else {
      // 新規登録モード：リセットして継続
      editMemberNameInput.value = "";

      // 連続入力の利便性を考慮し、継手選択と階層チェックは維持します。
      // 名前だけ変えて次々登録するケースが多いためです。
      // もし全てリセットしたい場合は以下のコメントアウトを外してください。
      /*
            editMemberJointSelect.value = ''; 
            document.querySelectorAll('.level-checkbox').forEach(cb => cb.checked = false);
            */

      // 名前入力欄にフォーカスを戻す
      editMemberNameInput.focus();
    }
    // ▲▲▲ 修正ここまで ▲▲▲

    updateProjectData(state.currentProjectId, {
      members: newMembersList,
    }).catch((err) => {
      showCustomAlert("部材の保存に失敗しました。");
      console.error("保存失敗: ", err);
    });
  });
  // ▼▼▼【ここに新しいコードを貼り付け】▼▼▼
  confirmDeleteBtn.addEventListener("click", () => {
    const id = deleteIdInput.value;
    const type = deleteTypeInput.value;
    const projectId = state.currentProjectId;
    const confirmDeleteModal = document.getElementById("confirm-delete-modal");
    // ▼ パターン1：プロジェクト自体の削除
    if (type === "project") {
      // ★ db.js の関数を使う（パス指定が不要になりスッキリ！）
      deleteProject(id).catch((err) =>
        showCustomAlert("工事の削除に失敗しました。"),
      );

      closeModal(confirmDeleteModal);
      return;
    }

    const projectIndex = state.projects.findIndex((p) => p.id === projectId);
    if (projectIndex === -1) {
      closeModal(confirmDeleteModal);
      return;
    }
    let updateData = {};
    let deletedItemName = "";

    // --- ここからが楽観的UIのロジックです ---

    if (type === "joint") {
      const joint = state.projects[projectIndex].joints.find(
        (j) => j.id === id,
      );
      if (joint) deletedItemName = joint.name;

      // 手順A: ブラウザ内のデータ（state）を先に書き換えます
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

      // 手順A: ブラウザ内のデータ（state）を先に書き換えます
      const updatedMembers = (
        state.projects[projectIndex].members || []
      ).filter((m) => m.id !== id);
      state.projects[projectIndex].members = updatedMembers;
      updateData = { members: updatedMembers };
      showToast(`部材「${deletedItemName}」を削除しました。`);
    }

    // 手順B: 書き換えたデータで、画面を即座に再描画します
    renderDetailView();
    // 手順C: モーダルを閉じます
    closeModal(confirmDeleteModal);

    // 手順D: 裏側で、データベースへの保存処理を実行します
    // ▼ パターン2：データベースへの保存処理
    if (Object.keys(updateData).length > 0) {
      // ★ db.js の関数を使う
      updateProjectData(projectId, updateData).catch((err) => {
        showCustomAlert(
          "削除に失敗しました。ページをリロードして確認してください。",
        );
        console.error("削除に失敗:", err);
      });
    }
  });
  // ▲▲▲【新しいコードはここまで】▲▲▲

  resultsCard.addEventListener("click", (e) => {
    const project = state.projects.find((p) => p.id === state.currentProjectId);
    if (!project) return;

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
      renderResults(project);

      updateProjectData(state.currentProjectId, { tally: newTally }).catch(
        (err) => {
          // 万が一失敗した時だけアラートを出す
          console.error("Error saving full tally:", err);
          showCustomAlert("保存に失敗しました。リロードしてください。");
        },
      );

      showCustomAlert("結果を更新しました。", {
        title: "成功",
        type: "success",
      });
    }

    if (e.target.closest("#export-excel-btn")) {
      const { resultsByLocation, allBoltSizes } = calculateResults(project);
      if (allBoltSizes.size === 0) {
        return showCustomAlert(
          "集計表にデータがないため、Excelファイルを出力できません。",
        );
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
          // ▼▼▼ 修正：オブジェクトから数値(.total)を取り出す ▼▼▼
          const cellData = resultsByLocation[col.id]?.[size];
          const count = cellData ? cellData.total : 0;

          grandTotal += count;
          // 0の場合は空欄(null)にして見やすくする
          row.push(count > 0 ? count : null);
          // ▲▲▲ 修正ここまで ▲▲▲
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
    }
    // ▼▼▼【ここから追加】▼▼▼
    // 注文明細の表示切替ボタンがクリックされた時の処理
    if (e.target.closest("#toggle-order-view-btn")) {
      // --- デバッグ用のメッセージをコンソールに出力します ---
      console.log("「表示切替」ボタンがクリックされました！ (メッセージ1)");

      // 1. 表示モードの状態を切り替える
      state.orderDetailsView =
        state.orderDetailsView === "location" ? "section" : "location";
      console.log(
        "新しい表示モード: ",
        state.orderDetailsView,
        "(メッセージ2)",
      );

      // 2. 注文明細エリアだけを新しい表示モードで再描画する
      const { resultsByLocation } = calculateResults(project);
      const container = document.getElementById("order-details-container");
      if (container) {
        console.log("コンテナを見つけました。HTMLを更新します。(メッセージ3)");
        container.innerHTML = renderOrderDetails(project, resultsByLocation);
      } else {
        // もしコンテナが見つからない場合は、エラーメッセージを出します
        console.error("【エラー】 order-details-container が見つかりません！");
      }

      // ▼▼▼ 追加: 仮ボルト注文明細の再描画 ▼▼▼
      const tempContainer = document.getElementById(
        "temp-order-details-container",
      );
      if (tempContainer) {
        renderTempOrderDetails(tempContainer, project);
      }
      // ▲▲▲ 追加ここまで ▲▲▲
    }

    // ▼▼▼ 追加：仮ボルト注文明細の表示切替ボタン ▼▼▼
    if (e.target.closest("#toggle-temp-order-view-btn")) {
      // 1. 表示モードの状態を切り替える (state.tempOrderDetailsView を使用)
      state.tempOrderDetailsView =
        state.tempOrderDetailsView === "location" ? "section" : "location";

      // 2. 仮ボルト注文明細エリアだけを再描画する
      const tempContainer = document.getElementById(
        "temp-order-details-container",
      );
      if (tempContainer) {
        renderTempOrderDetails(tempContainer, project);
      }
    }

    // ▼▼▼ 追加：工区まとめ設定（チェックボックス）のイベントリスナー ▼▼▼
    if (e.target.matches("#temp-order-group-all-checkbox")) {
      // ステートを更新
      state.tempOrderDetailsGroupAll = e.target.checked;

      // 再描画
      const tempContainer = document.getElementById(
        "temp-order-details-container",
      );
      if (tempContainer) {
        renderTempOrderDetails(tempContainer, project);
      }
    }
    // ▲▲▲ 追加ここまで ▲▲▲

    // ▼▼▼ 追加：グループ化キー（ラジオボタン）のイベントリスナー ▼▼▼
    if (e.target.matches('input[name="temp-order-group-key"]')) {
      // ステートを更新
      state.tempOrderDetailsGroupKey = e.target.value;

      // 再描画
      const tempContainer = document.getElementById(
        "temp-order-details-container",
      );
      if (tempContainer) {
        renderTempOrderDetails(tempContainer, project);
      }
    }
    // ▲▲▲ 追加ここまで ▲▲▲
    // ▲▲▲ 追加ここまで ▲▲▲
    // ▲▲▲【ここまで追加】▲▲▲
  });

  // ★ 修正版：工事情報の保存処理（ハイフン付き階層名対応・即時反映）
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

    const performUpdate = (projectData) => {
      const projectIndex = state.projects.findIndex((p) => p.id === projectId);
      if (projectIndex !== -1) {
        state.projects[projectIndex] = {
          ...state.projects[projectIndex],
          ...projectData,
        };
      }
      renderProjectList();

      updateProjectData(state.currentProjectId, projectData).catch((err) => {
        console.error("工事情報の保存に失敗:", err);
        showCustomAlert("工事情報の保存に失敗しました。");
      });

      closeModal(editProjectModal);
      levelNameCache = [];
      areaNameCache = [];
      showToast(`工事情報を更新しました。`);
    };

    let updatedProjectData = { name: newName, propertyName: newPropertyName };

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

      // 箇所数データ(tally)のキーを、フロア・エリアの「順番」に基づいて更新する
      const newTally = {};
      const oldTally = project.tally || {};

      // 古いフロア名/エリア名と、その「順番(index)」をマップ化
      const oldLevelIndexMap = new Map(oldLevels.map((level, i) => [level, i]));
      const oldAreaIndexMap = new Map(oldAreas.map((area, i) => [area, i]));

      // ▼▼▼ 修正：階層名のマッチングロジックを強化（ハイフン対応） ▼▼▼
      // 長い名前順にソートしておくことで、前方一致の誤判定（例: "B-1" と "B"）を防ぐ
      const sortedOldLevels = [...oldLevels].sort(
        (a, b) => b.length - a.length,
      );

      for (const oldKey in oldTally) {
        // 単純な split('-') ではなく、登録済みの階層名で前方一致判定を行う
        let oldLevelName = null;
        let oldAreaName = null;

        for (const level of sortedOldLevels) {
          // キーが "LevelName-" で始まっているかチェック
          if (oldKey.startsWith(level + "-")) {
            oldLevelName = level;
            // 残りの部分をエリア名とする
            oldAreaName = oldKey.substring(level.length + 1);
            break;
          }
        }

        // マッチする階層名が見つからなかった場合（通常ありえないが念のため）
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
      // ▲▲▲ 修正ここまで ▲▲▲

      updatedProjectData.tally = newTally;

      const tallyDataToDeleteKeys = [];
      const oldTallyForDeletionCheck = project.tally || {};

      if (
        oldLevels.length > newLevels.length ||
        oldAreas.length > newAreas.length
      ) {
        for (const key in oldTallyForDeletionCheck) {
          // 削除確認用も同様のロジックで判定
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
        openModal(confirmActionModal);
        return;
      }
    } else {
      updatedProjectData.floors = parseInt(editProjectFloorsInput.value);
      updatedProjectData.sections = parseInt(editProjectSectionsInput.value);
      updatedProjectData.hasPH = editProjectHasPhInput.checked;
    }

    performUpdate(updatedProjectData);
  });
  // --- ここから追加 ---

  // ▼▼▼ 追加：カラーピッカーの制御 ▼▼▼
  editJointColorInput.addEventListener("input", () => {
    editJointColorInput.dataset.isNull = "false"; // 色を選んだら有効化
  });

  clearJointColorBtn.addEventListener("click", () => {
    editJointColorInput.value = "#ffffff";
    editJointColorInput.dataset.isNull = "true"; // 未設定状態にする
  });
  // ▲▲▲ 追加ここまで ▲▲▲
  // [isComplexSplInput, editIsComplexSplInput].forEach((el) =>
  //   el.addEventListener("change", () =>
  //     updateJointFormUI(el.id.includes("edit")),
  //   ),
  // );

  // decrementComplexSplBtn.addEventListener("click", () =>
  //   updateComplexSplCount(complexSplCountInput, newComplexSplCache, false, -1),
  // );
  // incrementComplexSplBtn.addEventListener("click", () =>
  //   updateComplexSplCount(complexSplCountInput, newComplexSplCache, false, 1),
  // );
  // editDecrementComplexSplBtn.addEventListener("click", () =>
  //   updateComplexSplCount(
  //     editComplexSplCountInput,
  //     editComplexSplCache,
  //     true,
  //     -1
  //   )
  // );
  // editIncrementComplexSplBtn.addEventListener("click", () =>
  //   updateComplexSplCount(
  //     editComplexSplCountInput,
  //     editComplexSplCache,
  //     true,
  //     1
  //   )
  // );

  // [closeEditProjectModalBtn, cancelProjectEditBtn].forEach((el) =>
  //   el.addEventListener("click", (e) => {
  //     closeModal(editProjectModal);
  //     levelNameCache = [];
  //     areaNameCache = [];
  //   })
  // );

  // [closeEditModalBtn, cancelEditBtn].forEach((el) =>
  //   el.addEventListener("click", (e) => {
  //     if (
  //       e.target === editModal ||
  //       e.target.closest("button") === closeEditModalBtn ||
  //       e.target.closest("button") === cancelEditBtn
  //     )
  //       closeModal(editModal);
  //   })
  // );
  // [cancelDeleteBtn, confirmDeleteModal].forEach((el) =>
  //   el.addEventListener("click", (e) => {
  //     if (
  //       e.target === confirmDeleteModal ||
  //       e.target.closest("button") === cancelDeleteBtn
  //     )
  //       closeModal(confirmDeleteModal);
  //   })
  // );
  // [closeEditMemberModalBtn, cancelMemberEditBtn, editMemberModal].forEach(
  //   (el) =>
  //     el.addEventListener("click", (e) => {
  //       if (
  //         e.target === editMemberModal ||
  //         e.target.closest("button") === closeEditMemberModalBtn ||
  //         e.target.closest("button") === cancelMemberEditBtn
  //       )
  //         closeModal(editMemberModal);
  //     })
  // );
  // [cancelAddBtn, confirmAddModal].forEach((el) =>
  //   el.addEventListener("click", (e) => {
  //     if (
  //       e.target === confirmAddModal ||
  //       e.target.closest("button") === cancelAddBtn
  //     ) {
  //       closeModal(confirmAddModal);
  //       state.tempJointData = null;
  //     }
  //   })
  // );
  // 確認モーダルの登録ボタンの処理も修正
  // ▼▼▼以下のコードに置き換え▼▼▼
  confirmAddBtn.addEventListener("click", () => {
    if (state.tempJointData) {
      const jointData = state.tempJointData;
      const projectIndex = state.projects.findIndex(
        (p) => p.id === state.currentProjectId,
      );
      if (projectIndex !== -1) {
        // 手順A: ブラウザ内のデータを先に書き換える
        const updatedJoints = [
          ...state.projects[projectIndex].joints,
          jointData,
        ];
        state.projects[projectIndex].joints = updatedJoints;

        // 手順B: 画面を即座に再描画する
        renderDetailView();

        // 手順C: ユーザーに完了を通知し、フォームをリセット
        let boltInfo = "";
        if (jointData.isComplexSpl && jointData.webInputs)
          boltInfo = jointData.webInputs
            .map((w) => `${w.size}/${w.count}本`)
            .join(", ");
        else if (jointData.isPinJoint)
          boltInfo = `${jointData.webSize} / ${jointData.webCount}本`;
        else if (
          ["column", "wall_girt", "roof_purlin"].includes(jointData.type)
        )
          boltInfo = `${jointData.flangeSize} / ${jointData.flangeCount}本`;
        else
          boltInfo = `F:${jointData.flangeSize}/${jointData.flangeCount}本, W:${jointData.webSize}/${jointData.webCount}本`;
        showToast(`継手「${jointData.name}」を登録しました (${boltInfo})`);
        resetJointForm();
        jointNameInput.focus();

        // 手順D: 裏側でデータベースに保存する
        updateProjectData(state.currentProjectId, {
          joints: updatedJoints,
        }).catch((err) => {
          showCustomAlert(
            "継手の追加に失敗しました。ページをリロードしてデータを確認してください。",
          );
          console.error("継手の追加に失敗: ", err);
        });
      }
    }
    closeModal(confirmAddModal);
    state.tempJointData = null;
  });

  // closeBoltModalBtn.addEventListener("click", () =>
  //   closeModal(boltSelectorModal),
  // );
  // closeAlertBtn.addEventListener("click", () =>
  //   closeModal(document.getElementById("custom-alert-modal")),
  // );

  // [
  //   jointTypeInput,
  //   tempBoltSettingInput,
  //   isPinJointInput,
  //   isDoubleShearInput,
  //   hasShopSplInput,
  // ].forEach((el) => {
  //   el.addEventListener("change", () => updateJointFormUI(false));
  // });
  // [
  //   editJointTypeInput,
  //   editTempBoltSettingInput,
  //   editIsPinJointInput,
  //   editIsDoubleShearInput,
  //   editHasShopSplInput,
  // ].forEach((el) => {
  //   el.addEventListener("change", () => updateJointFormUI(true));
  // });
  // isDoubleShearInput.addEventListener("change", () => {
  //   updateJointFormUI(false);
  // });
  // editIsDoubleShearInput.addEventListener("change", () => {
  //   updateJointFormUI(true);
  // });

  // ▼▼▼ このイベントリスナーを追記 ▼▼▼
  document.addEventListener("click", (e) => {
    // 「▼」ボタンがクリックされた時の処理
    if (e.target.classList.contains("bolt-select-trigger")) {
      openBoltSelectorModal(e.target.dataset.target);
    }
    // 読み取り専用の入力欄がクリックされた時の処理
    else if (e.target.classList.contains("modal-trigger-input")) {
      const triggerButton = e.target.nextElementSibling;
      if (triggerButton) {
        // 隣にある「▼」ボタンのクリックをプログラムが実行する
        triggerButton.click();
      }
    }
  });
  boltOptionsContainer.addEventListener("click", (e) => {
    if (
      e.target.classList.contains("bolt-option-btn") &&
      state.activeBoltTarget
    ) {
      state.activeBoltTarget.value = e.target.dataset.size;
      closeModal(boltSelectorModal);
    }
  });

  [
    navTabJoints,
    navTabTally,
    document.getElementById("mobile-nav-tab-joints"),
    document.getElementById("mobile-nav-tab-tally"),
  ].forEach((tab) => {
    tab.addEventListener("click", (e) => {
      switchTab(e.target.dataset.tab);
      if (window.innerWidth < 768) {
        mobileMenu.classList.add("hidden");
      }
    });
  });

  hamburgerBtn.addEventListener("click", () => {
    mobileMenu.classList.toggle("hidden");
  });

  // デスクトップ用「物件一覧に戻る」ボタンのイベントリスナー
  document
    .getElementById("nav-back-to-list-btn")
    .addEventListener("click", () => {
      state.currentProjectId = null;

      // ▼▼▼ 修正箇所 ▼▼▼
      resetMemberForm(); // フォームをリセット
      // ▲▲▲ 修正ここまで ▲▲▲

      switchView("list");
    });
  // モバイル用「物件一覧に戻る」ボタンのイベントリスナー
  document
    .getElementById("mobile-nav-back-to-list-btn")
    .addEventListener("click", () => {
      state.currentProjectId = null;

      // ▼▼▼ 修正箇所 ▼▼▼
      resetMemberForm(); // フォームをリセット
      // ▲▲▲ 修正ここまで ▲▲▲

      switchView("list");
    });

  undoBtn.addEventListener("click", () => performHistoryAction("undo"));
  redoBtn.addEventListener("click", () => performHistoryAction("redo"));
  mobileUndoBtn.addEventListener("click", () => performHistoryAction("undo"));
  mobileRedoBtn.addEventListener("click", () => performHistoryAction("redo"));

  //const memberJointSelectInputForClick = document.getElementById('member-joint-select-input');
  //memberJointSelectInputForClick.addEventListener('click', () => {
  //    openJointSelectorBtn.click(); // 既に機能があるボタンのクリックイベントを呼び出す
  //});
  // ▼▼▼ このコードブロックをまるごと追加してください ▼▼▼

  // 「▼」ボタンがクリックされた時の処理
  openJointSelectorBtn.addEventListener("click", () => {
    const project = state.projects.find((p) => p.id === state.currentProjectId);
    // 現在選択されている継手のIDをhidden inputから取得します
    const currentJointId = memberJointSelectId.value;
    // 取得したIDを引数としてモーダル生成関数に渡します
    populateJointSelectorModal(project, currentJointId);
    openModal(jointSelectorModal);
  });

  // テキスト入力欄がクリックされた時に、上の「▼」ボタンのクリックを代行する処理
  document
    .getElementById("member-joint-select-input")
    .addEventListener("click", () => {
      openJointSelectorBtn.click();
    });

  // ▲▲▲ ここまでを追加 ▲▲▲
  closeJointModalBtn.addEventListener("click", () =>
    closeModal(jointSelectorModal),
  );

  jointOptionsContainer.addEventListener("click", (e) => {
    if (e.target.classList.contains("joint-option-btn")) {
      const { id, name } = e.target.dataset;
      memberJointSelectInput.value = name;
      memberJointSelectId.value = id;
      closeModal(jointSelectorModal);
    }
  });

  openTempBoltMappingBtn.addEventListener("click", () => {
    const project = state.projects.find((p) => p.id === state.currentProjectId);
    populateTempBoltMappingModal(project);
    openModal(tempBoltMappingModal);
  });

  closeTempBoltMappingModalBtn.addEventListener("click", () =>
    closeModal(tempBoltMappingModal),
  );
  cancelTempBoltMappingBtn.addEventListener("click", () =>
    closeModal(tempBoltMappingModal),
  );

  const saveTempBoltMappingBtn = document.getElementById(
    "save-temp-bolt-mapping-btn",
  );
  saveTempBoltMappingBtn.addEventListener("click", () => {
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

    // ▼▼▼ ここからが修正箇所 ▼▼▼

    // 1. ローカルのstate（アプリが保持しているデータ）を即座に更新する
    const project = state.projects.find((p) => p.id === state.currentProjectId);
    if (project) {
      project.tempBoltMap = newMap;
    }

    // 2. 更新されたローカルstateを使って、UI（見た目）を即座に再描画する
    renderDetailView();

    // 3. UIの操作（モーダルを閉じる、通知を出す）を完了させる
    closeModal(tempBoltMappingModal);
    showToast("仮ボルト設定を保存しました。"); // 操作を妨げないトースト通知に変更

    // 4. 裏側で、データベースへの実際の保存処理を実行する
    updateProjectData(state.currentProjectId, { tempBoltMap: newMap }).catch(
      (err) => {
        // 万が一失敗した時だけアラートを出す
        console.error("仮ボルト設定の保存に失敗しました: ", err);
        showCustomAlert(
          "設定の保存に失敗しました。エラーが発生したため、リロードが必要な場合があります。",
        );
      },
    );

    // ▲▲▲ ここまでが修正箇所 ▲▲▲
  });

  advancedSettingsToggle.addEventListener("change", (e) => {
    simpleProjectSettings.classList.toggle("hidden", e.target.checked);
    advancedProjectSettings.classList.toggle("hidden", !e.target.checked);
  });
  addDecrementLevelsBtn.addEventListener("click", () =>
    updateDynamicInputs(
      addCustomLevelsCountInput,
      customLevelsContainer,
      newLevelNameCache,
      "custom-level",
      -1,
    ),
  );
  addIncrementLevelsBtn.addEventListener("click", () =>
    updateDynamicInputs(
      addCustomLevelsCountInput,
      customLevelsContainer,
      newLevelNameCache,
      "custom-level",
      1,
    ),
  );
  addDecrementAreasBtn.addEventListener("click", () =>
    updateDynamicInputs(
      addCustomAreasCountInput,
      customAreasContainer,
      newAreaNameCache,
      "custom-area",
      -1,
    ),
  );
  addIncrementAreasBtn.addEventListener("click", () =>
    updateDynamicInputs(
      addCustomAreasCountInput,
      customAreasContainer,
      newAreaNameCache,
      "custom-area",
      1,
    ),
  );

  confirmMemberDeletionBtn.addEventListener("click", () => {
    if (state.pendingUpdateData) {
      updateProjectData(state.currentProjectId, state.pendingUpdateData).catch(
        (err) => {
          // 万が一失敗した時だけアラートを出す
          console.error(err);
          showCustomAlert("保存に失敗しました。リロードしてください。");
        },
      );
    }
  });

  cancelMemberDeletionBtn.addEventListener("click", () => {
    closeModal(confirmMemberDeletionModal);
    state.pendingUpdateData = null;
  });

  [editCustomLevelsCountInput, editCustomAreasCountInput].forEach((input) => {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
      }
    });
  });

  // --- 修正後のコード (この関数に差し替える) ---

  const updateDynamicInputs = (
    countInputElement,
    inputsContainer,
    cache,
    prefix,
    change,
  ) => {
    // 1. 現在の入力値をDOMから読み取り、キャッシュ配列を更新する (変更なし)
    const currentInputs = inputsContainer.querySelectorAll("input");
    currentInputs.forEach((input, index) => {
      if (index < cache.length) {
        cache[index] = input.value;
      }
    });

    // 2. 新しい項目数を計算する (変更なし)
    let newCount = parseInt(countInputElement.value) || 0;
    newCount += change;
    if (newCount < 1) newCount = 1;

    // 3. 項目数が増える場合のみ、キャッシュ配列の長さを調整する【ここが重要】
    const currentCacheSize = cache.length;
    if (newCount > currentCacheSize) {
      // 項目が増えた場合、新しい空の要素をキャッシュに追加
      for (let i = 0; i < newCount - currentCacheSize; i++) {
        cache.push("");
      }
    }
    // ★★★ 項目数が減った場合に cache.splice() を呼び出す 'else if' ブロックを削除 ★★★
    // これにより、キャッシュ配列からデータが削除されなくなります。

    // 4. 表示されている項目数を更新する (変更なし)
    countInputElement.value = newCount;

    // 5. 更新されたキャッシュを元に入力欄を再生成する (変更なし)
    // generateCustomInputFieldsは最初の `newCount` 個だけ入力欄を生成するため、
    // キャッシュに余分なデータがあっても問題ありません。
    generateCustomInputFields(newCount, inputsContainer, prefix, cache);
  };

  decrementLevelsBtn.addEventListener("click", () =>
    updateDynamicInputs(
      editCustomLevelsCountInput,
      editCustomLevelsContainer,
      levelNameCache,
      "edit-level",
      -1,
    ),
  );
  incrementLevelsBtn.addEventListener("click", () =>
    updateDynamicInputs(
      editCustomLevelsCountInput,
      editCustomLevelsContainer,
      levelNameCache,
      "edit-level",
      1,
    ),
  );
  decrementAreasBtn.addEventListener("click", () =>
    updateDynamicInputs(
      editCustomAreasCountInput,
      editCustomAreasContainer,
      areaNameCache,
      "edit-area",
      -1,
    ),
  );
  incrementAreasBtn.addEventListener("click", () =>
    updateDynamicInputs(
      editCustomAreasCountInput,
      editCustomAreasContainer,
      areaNameCache,
      "edit-area",
      1,
    ),
  );

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

  const renderAggregatedResults = (propertyName, aggregatedData) => {
    document.getElementById("aggregated-results-title").textContent =
      `「${propertyName}」集計結果`;
    const contentEl = document.getElementById("aggregated-results-content");
    let html = "";

    // 1. 本ボルトの表
    const sortedFinalSizes = Object.keys(aggregatedData.finalBolts).sort();
    if (sortedFinalSizes.length > 0) {
      html += `<h4 class="text-xl font-bold text-slate-800 dark:text-slate-200">本ボルト 合計本数</h4>
                 <div class="overflow-x-auto custom-scrollbar"><table class="w-auto text-sm border-collapse">
                 <thead class="bg-slate-200 dark:bg-slate-700"><tr>
                    <th class="px-3 py-2 border border-slate-300 dark:border-slate-600">ボルトサイズ</th>
                    <th class="px-3 py-2 border border-slate-300 dark:border-slate-600">合計本数</th>
                 </tr></thead><tbody>`;
      sortedFinalSizes.forEach((size) => {
        const data = aggregatedData.finalBolts[size];
        const tooltipText = Object.entries(data.joints)
          .map(([name, count]) => `${name}: ${count.toLocaleString()}本`)
          .join("\n");

        // --- 変更点: モバイルタップ用のクラスとデータ属性を追加 ---
        const detailsJson = JSON.stringify(data.joints);
        const detailsClass =
          "has-details cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-800/50 transition-colors";
        const dataAttribute = `data-details='${detailsJson}'`;

        html += `<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td class="px-3 py-2 border border-slate-200 dark:border-slate-700">${size}</td>
                        <td class="px-3 py-2 border border-slate-200 dark:border-slate-700 text-center ${detailsClass}" title="${tooltipText}" ${dataAttribute}>
                            ${data.total.toLocaleString()}
                        </td>
                    </tr>`;
      });
      html += `</tbody></table></div>`;
    } else {
      html += `<h4 class="text-xl font-bold text-slate-800 dark:text-slate-200">本ボルト 合計本数</h4>
                 <p class="text-slate-500">集計対象の本ボルトはありません。</p>`;
    }

    // 2. 仮ボルトの表 (こちらは元々数値のみなので大きな変更はなし)
    // --- renderAggregatedResults 関数内、"// 2. 仮ボルトの表" の部分を差し替え ---

    // 2. 仮ボルトの表
    const sortedTempSizes = Object.keys(aggregatedData.tempBolts).sort();
    if (sortedTempSizes.length > 0) {
      html += `<h4 class="text-xl font-bold text-slate-800 dark:text-slate-200 mt-6">現場使用 仮ボルト 合計本数</h4>
             <div class="overflow-x-auto custom-scrollbar"><table class="w-auto text-sm border-collapse">
             <thead class="bg-slate-200 dark:bg-slate-700"><tr>
                <th class="px-3 py-2 border border-slate-300 dark:border-slate-600">ボルトサイズ</th>
                <th class="px-3 py-2 border border-slate-300 dark:border-slate-600">合計本数</th>
             </tr></thead><tbody>`;
      sortedTempSizes.forEach((size) => {
        const data = aggregatedData.tempBolts[size];
        const tooltipText = Object.entries(data.joints)
          .map(([name, count]) => `${name}: ${count.toLocaleString()}本`)
          .join("\n");

        const detailsJson = JSON.stringify(data.joints);
        const detailsClass =
          "has-details cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-800/50 transition-colors";
        const dataAttribute = `data-details='${detailsJson}'`;

        html += `<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td class="px-3 py-2 border border-slate-200 dark:border-slate-700">${size}</td>
                    <td class="px-3 py-2 border border-slate-200 dark:border-slate-700 text-center ${detailsClass}" title="${tooltipText}" ${dataAttribute}>
                        ${data.total.toLocaleString()}
                    </td>
                </tr>`;
      });
      html += `</tbody></table></div>`;
    }

    // 3. 工場用仮ボルトの表
    const sortedShopSizes = Object.keys(aggregatedData.shopTempBolts).sort();
    if (sortedShopSizes.length > 0) {
      html += `<h4 class="text-xl font-bold text-slate-800 dark:text-slate-200 mt-6">工場使用 仮ボルト 合計本数</h4>
                 <div class="overflow-x-auto custom-scrollbar"><table class="w-auto text-sm border-collapse">
                 <thead class="bg-slate-200 dark:bg-slate-700"><tr>
                    <th class="px-3 py-2 border border-slate-300 dark:border-slate-600">ボルトサイズ</th>
                    <th class="px-3 py-2 border border-slate-300 dark:border-slate-600">合計本数</th>
                    <th class="px-3 py-2 border border-slate-300 dark:border-slate-600">関連継手</th>
                 </tr></thead><tbody>`;
      sortedShopSizes.forEach((size) => {
        const data = aggregatedData.shopTempBolts[size];
        const jointNames = Array.from(data.joints).join(", ");
        html += `<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td class="px-3 py-2 border border-slate-200 dark:border-slate-700">${size}</td>
                        <td class="px-3 py-2 border border-slate-200 dark:border-slate-700 text-center">${data.total.toLocaleString()}</td>
                        <td class="px-3 py-2 border border-slate-200 dark:border-slate-700">${jointNames}</td>
                    </tr>`;
      });
      html += `</tbody></table></div>`;
    }

    contentEl.innerHTML = html;
  };
  // 物件名一括保存ボタンの処理
  // 物件名一括保存ボタンの処理 (楽観的UIを適用)
  document
    .getElementById("save-group-btn")
    .addEventListener("click", async () => {
      const oldName = document.getElementById("edit-group-old-name").value;
      const newName = document
        .getElementById("edit-group-new-name")
        .value.trim();

      const projectsToUpdate = state.projects.filter(
        (p) => p.propertyName === oldName,
      );

      if (projectsToUpdate.length === 0) {
        closeModal(document.getElementById("edit-group-modal"));
        return;
      }

      // ▼▼▼ ここからが修正箇所 ▼▼▼

      // 1. ローカルのstate（アプリが保持しているデータ）を即座に更新する
      projectsToUpdate.forEach((project) => {
        const localProject = state.projects.find((p) => p.id === project.id);
        if (localProject) {
          localProject.propertyName = newName;
        }
      });

      // 2. 更新されたローカルstateを使って、UI（物件一覧）を即座に再描画する
      renderProjectList();

      // 3. UIの操作（モーダルを閉じる）を完了させる
      closeModal(document.getElementById("edit-group-modal"));
      showToast(`物件名を「${newName}」に更新しました。`);

      // ▼▼▼ 4. 裏側でDB更新 (ここを修正) ▼▼▼

      // 更新対象のIDリストを作成
      const targetIds = projectsToUpdate.map((p) => p.id);

      // DB操作関数を呼び出す（awaitなしで、裏側実行）
      updateProjectPropertyNameBatch(targetIds, newName).catch((err) => {
        console.error("物件名の一括更新に失敗しました: ", err);
        showCustomAlert(
          "物件名の一括更新に失敗しました。ページをリロードしてデータを確認してください。",
        );
      });
      // ▲▲▲ ここまでが修正箇所 ▲▲▲
    });

  // 新しいモーダルを閉じるためのイベントリスナー
  document
    .getElementById("close-edit-group-modal-btn")
    .addEventListener("click", () =>
      closeModal(document.getElementById("edit-group-modal")),
    );
  document
    .getElementById("cancel-edit-group-btn")
    .addEventListener("click", () =>
      closeModal(document.getElementById("edit-group-modal")),
    );
  document
    .getElementById("close-aggregated-results-modal-btn")
    .addEventListener("click", () =>
      closeModal(document.getElementById("aggregated-results-modal")),
    );
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

  // 詳細表示モーダルを制御するイベントリスナー

  resultsCard.addEventListener("click", (e) => {
    const targetCell = e.target.closest("td.has-details");
    if (!targetCell) return;

    try {
      const detailsData = JSON.parse(targetCell.dataset.details);
      const row = targetCell.closest("tr");
      const boltSize = row.querySelector("td:first-child").textContent;
      const isTotal =
        targetCell.textContent ===
        row.querySelector("td:last-child").textContent;

      const modalTitle = document.getElementById("details-modal-title");
      const modalContent = document.getElementById("details-modal-content");

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
      openModal(document.getElementById("details-modal"));
    } catch (err) {
      console.error("Failed to parse details data:", err);
    }
  });

  // 詳細表示モーダルを閉じるボタンのリスナー
  document
    .getElementById("close-details-modal-btn")
    .addEventListener("click", () => {
      closeModal(document.getElementById("details-modal"));
    });

  // --- ここから追加 ---

  // 物件ごとの集計結果モーダル用の詳細表示リスナー
  const aggregatedResultsContent = document.getElementById(
    "aggregated-results-content",
  );
  aggregatedResultsContent.addEventListener("click", (e) => {
    const targetCell = e.target.closest("td.has-details");
    if (!targetCell) return;

    try {
      const detailsData = JSON.parse(targetCell.dataset.details);
      const row = targetCell.closest("tr");
      const boltSize = row.querySelector("td:first-child").textContent;

      const modalTitle = document.getElementById("details-modal-title");
      const modalContent = document.getElementById("details-modal-content");

      modalTitle.textContent = `${boltSize} の合計内訳`;

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
      openModal(document.getElementById("details-modal"));
    } catch (err) {
      console.error("Failed to parse aggregated details data:", err);
    }
  });

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
          renderProjectList();
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
  // --- Dark Mode Logic ---
  const darkModeToggle = document.getElementById("dark-mode-toggle");
  const mobileDarkModeToggle = document.getElementById(
    "mobile-dark-mode-toggle",
  );

  const applyTheme = (theme) => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      darkModeToggle.checked = true;
      mobileDarkModeToggle.checked = true;
    } else {
      document.documentElement.classList.remove("dark");
      darkModeToggle.checked = false;
      mobileDarkModeToggle.checked = false;
    }
  };

  const toggleTheme = () => {
    const currentTheme = localStorage.getItem("theme");
    if (currentTheme === "dark") {
      localStorage.setItem("theme", "light");
      applyTheme("light");
    } else {
      localStorage.setItem("theme", "dark");
      applyTheme("dark");
    }
  };

  darkModeToggle.addEventListener("change", toggleTheme);
  mobileDarkModeToggle.addEventListener("change", toggleTheme);

  // Apply theme on initial load
  const savedTheme = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  if (savedTheme) {
    applyTheme(savedTheme);
  } else if (prefersDark) {
    applyTheme("dark");
  } else {
    applyTheme("light");
  }
  // --- Start Application ---
  // ▼▼▼ 追加：クイックナビゲーションの制御ロジック ▼▼▼
  const quickNavContainer = document.getElementById("quick-nav-container");
  const quickNavMenu = document.getElementById("quick-nav-menu");
  const quickNavLinks = document.getElementById("quick-nav-links");
  const quickNavToggle = document.getElementById("quick-nav-toggle");
  let isQuickNavOpen = false;

  const toggleQuickNav = () => {
    isQuickNavOpen = !isQuickNavOpen;
    if (isQuickNavOpen) {
      // メニューを開く時に中身を生成
      updateQuickNavLinks();
      quickNavMenu.classList.remove("hidden");
      // 少し遅れてクラスを切り替えることでアニメーションさせる
      requestAnimationFrame(() => {
        quickNavMenu.classList.remove(
          "scale-95",
          "opacity-0",
          "pointer-events-none",
        );
        quickNavMenu.classList.add(
          "scale-100",
          "opacity-100",
          "pointer-events-auto",
        );
      });
    } else {
      // メニューを閉じる
      quickNavMenu.classList.remove(
        "scale-100",
        "opacity-100",
        "pointer-events-auto",
      );
      quickNavMenu.classList.add(
        "scale-95",
        "opacity-0",
        "pointer-events-none",
      );
      setTimeout(() => {
        if (!isQuickNavOpen) quickNavMenu.classList.add("hidden");
      }, 200);
    }
  };

  // ★ 修正版：ナビゲーションリンク生成（多色対応 & タブ分岐）
  const updateQuickNavLinks = () => {
    quickNavLinks.innerHTML = "";

    // 1. ページトップへ
    addQuickNavLink(
      "▲ ページトップへ",
      () => window.scrollTo({ top: 0, behavior: "smooth" }),
      "bg-gray-100 dark:bg-slate-700 font-bold border-b border-gray-200 dark:border-slate-600",
    );

    // 2. タブに応じて対象セクションを取得
    let targets = [];
    if (state.activeTab === "joints") {
      // 継手・部材タブ: IDが anchor- で始まる要素
      targets = document.querySelectorAll(
        '#joint-lists-container [id^="anchor-"], #member-lists-container [id^="anchor-"]',
      );
    } else if (state.activeTab === "tally") {
      // 入力・集計タブ: 特定のIDを持つ要素や属性を持つ要素
      // 箇所数入力カード(tally-card) と 集計結果内の各セクション
      const tallyCard = document.getElementById("tally-card");
      const resultSections = document.querySelectorAll(
        "#results-card-content [data-section-title]",
      );

      if (tallyCard && !tallyCard.classList.contains("hidden")) {
        targets = [tallyCard, ...resultSections];
      }
    }

    if (targets.length > 0) {
      targets.forEach((section) => {
        const title = section.dataset.sectionTitle || "セクション";
        const color = section.dataset.sectionColor || "gray";

        // Tailwindの色名からクラスを生成
        // text-{color}-700 dark:text-{color}-300 hover:bg-{color}-50
        const colorClass = `text-${color}-700 dark:text-${color}-300 hover:bg-${color}-50 dark:hover:bg-${color}-900/30`;

        addQuickNavLink(
          title,
          () => {
            section.scrollIntoView({ behavior: "smooth", block: "start" });
          },
          colorClass,
        );
      });
    } else {
      const p = document.createElement("p");
      p.textContent = "移動先がありません";
      p.className = "text-xs text-gray-500 p-2";
      quickNavLinks.appendChild(p);
    }

    // 3. ページ最下部へ
    addQuickNavLink(
      "▼ ページ最下部へ",
      () =>
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: "smooth",
        }),
      "bg-gray-100 dark:bg-slate-700 font-bold border-t border-gray-200 dark:border-slate-600 mt-1",
    );
  };
  // ▼▼▼ 追加：登録用フローティングボタン(FAB)の制御ロジック ▼▼▼
  // ▼▼▼ 修正：登録用FABの制御ロジック（3ボタン対応） ▼▼▼
  // ▼▼▼ 修正：登録用フローティングボタン(FAB)の制御ロジック（縦並び・位置調整版） ▼▼▼
  // ▼▼▼ 修正：登録用フローティングボタン(FAB)の制御ロジック（完全版） ▼▼▼
  const fabContainer = document.getElementById("fab-container");
  const fabToggle = document.getElementById("fab-toggle");
  const fabIconPlus = document.getElementById("fab-icon-plus");

  const fabAddJoint = document.getElementById("fab-add-joint");
  const fabAddMember = document.getElementById("fab-add-member");
  const fabTempBolt = document.getElementById("fab-temp-bolt");

  let isFabOpen = false;

  // ▼▼▼ 修正：登録用FABの制御ロジック（一括登録ボタンを追加） ▼▼▼
  // const toggleFab = (forceState) => {
  //   const newState = typeof forceState === "boolean" ? forceState : !isFabOpen;
  //   if (newState === isFabOpen) return;
  //   isFabOpen = newState;

  //   // 配列に fabBulkAddMember を追加
  //   const buttons = [fabAddJoint, fabAddMember, fabBulkAddMember, fabTempBolt];

  //   if (isFabOpen) {
  //     fabIconPlus.style.transform = "rotate(45deg)";
  //     buttons.forEach((btn) => {
  //       btn.classList.remove(
  //         "translate-y-10",
  //         "opacity-0",
  //         "pointer-events-none",
  //       );
  //       btn.classList.add("pointer-events-auto");
  //     });
  //   } else {
  //     fabIconPlus.style.transform = "rotate(0deg)";
  //     buttons.forEach((btn) => {
  //       btn.classList.add("translate-y-10", "opacity-0", "pointer-events-none");
  //       btn.classList.remove("pointer-events-auto");
  //     });
  //   }
  // };
  // ▲▲▲ 修正ここまで ▲▲▲
  // クリックで開閉
  // fabToggle.addEventListener("click", (e) => {
  //   e.stopPropagation();
  //   toggleFab();
  // });

  // 画面の他の場所をクリックしたら閉じる
  // document.addEventListener("click", (e) => {
  //   if (isFabOpen && !fabContainer.contains(e.target)) {
  //     toggleFab(false);
  //   }
  // });

  // ■ 継手登録ボタンが押された時の処理
  // fabAddJoint.addEventListener("click", () => {
  //   toggleFab(false); // 閉じる

  //   document.querySelector("#edit-joint-modal h3").textContent =
  //     "継手の新規登録";

  //   // フォームリセット
  //   editJointIdInput.value = "";
  //   editJointNameInput.value = "";
  //   editJointTypeInput.value = "girder";
  //   editFlangeSizeInput.value = "";
  //   editFlangeCountInput.value = "";
  //   editWebSizeInput.value = "";
  //   editWebCountInput.value = "";
  //   editIsPinJointInput.checked = false;
  //   editIsDoubleShearInput.checked = false;
  //   editCountAsMemberInput.checked = false;
  //   editHasShopSplInput.checked = false;
  //   editHasBoltCorrectionInput.checked = false;
  //   editIsComplexSplInput.checked = false;
  //   editTempBoltSettingInput.value = "calculated";
  //   editComplexSplCountInput.value = "2";
  //   document.getElementById("edit-shop-temp-bolt-count").value = "";
  //   document.getElementById("edit-shop-temp-bolt-size").value = "";
  //   document.getElementById("edit-shop-temp-bolt-count-f").value = "";
  //   document.getElementById("edit-shop-temp-bolt-size-f").value = "";
  //   document.getElementById("edit-shop-temp-bolt-count-w").value = "";
  //   document.getElementById("edit-shop-temp-bolt-size-w").value = "";
  //   editComplexSplCache = Array.from({ length: 4 }, () => ({
  //     size: "",
  //     count: "",
  //   }));
  //   // ▼▼▼ 追加：色のリセット処理 ▼▼▼
  //   if (editJointColorInput) {
  //     editJointColorInput.value = "#ffffff";
  //     editJointColorInput.dataset.isNull = "true";
  //     // パレットの選択解除（関数が定義済みであれば）
  //     if (typeof renderColorPalette === "function") renderColorPalette(null);
  //   }
  //   // ▲▲▲ 追加ここまで ▲▲▲
  //   updateJointFormUI(true);
  //   openModal(editModal);
  // });

  // ■ 部材登録ボタンが押された時の処理
  // ■ 部材登録ボタンが押された時の処理（修正版）
  // fabAddMember.addEventListener("click", () => {
  //   toggleFab(false);
  //   const project = state.projects.find((p) => p.id === state.currentProjectId);
  //   if (!project) return;
  //   document.querySelector("#edit-member-modal h3").textContent =
  //     "部材の新規登録";
  //   editMemberIdInput.value = "";
  //   editMemberNameInput.value = "";
  //   populateJointDropdownForEdit(editMemberJointSelect, "");

  //   // ▼▼▼ 追加：チェックボックス生成（全て空で初期化） ▼▼▼
  //   const levelsContainer = document.getElementById(
  //     "edit-member-levels-container",
  //   );
  //   levelsContainer.innerHTML = "";
  //   const levels = getProjectLevels(project);
  //   levels.forEach((lvl) => {
  //     const label = document.createElement("label");
  //     label.className = "flex items-center gap-2 text-sm cursor-pointer";
  //     label.innerHTML = `<input type="checkbox" value="${lvl.id}" class="level-checkbox h-4 w-4 text-blue-600 rounded border-gray-300"> ${lvl.label}`;
  //     levelsContainer.appendChild(label);
  //   });
  //   // ▲▲▲ 追加ここまで ▲▲▲

  //   openModal(editMemberModal);
  // });

  // ■ 仮ボルト設定ボタンの処理
  // fabTempBolt.addEventListener("click", () => {
  //   toggleFab(false);
  //   const project = state.projects.find((p) => p.id === state.currentProjectId);
  //   populateTempBoltMappingModal(project);
  //   openModal(tempBoltMappingModal);
  // });
  // ▲▲▲ 修正ここまで ▲▲▲

  // ▼▼▼ 追加：部材一括登録の実装 ▼▼▼
  // 入力欄を生成する関数
  // index.html内の <script> タグ内

  // 入力欄を生成する関数
  // ▼▼▼ 修正: currentValues (既存の部材名配列) を引数として受け取るようにする ▼▼▼
  const renderBulkMemberInputs = (count, currentValues = []) => {
    const project = state.projects.find((p) => p.id === state.currentProjectId);
    if (!project) return;
    const levels = getProjectLevels(project); // 利用可能な階層を取得

    // キャッシュの長さを調整
    while (state.bulkMemberLevels.length < count) {
      state.bulkMemberLevels.push([]); // 新しい部材には空の配列（全階層）を割り当てる
    }
    state.bulkMemberLevels = state.bulkMemberLevels.slice(0, count);

    bulkMemberInputsContainer.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const currentLevels = state.bulkMemberLevels[i];
      const levelsText =
        currentLevels.length === 0
          ? "全階層"
          : currentLevels.length > 3
            ? `${currentLevels.length}フロア`
            : currentLevels
                .map((id) => levels.find((l) => l.id === id)?.label || id)
                .join(", ");

      // ▼▼▼ 修正: ここで既存の値（currentValues[i]）を取得し、inputタグにセットする ▼▼▼
      const savedName = currentValues[i] || "";

      const div = document.createElement("div");
      div.className = "flex items-center gap-2";
      div.innerHTML = `
            <span class="text-sm text-slate-500 w-6 text-right">${i + 1}.</span>
            <input type="text" data-index="${i}" class="bulk-member-name-input w-full bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 rounded-md p-2 focus:ring-yellow-500 focus:border-yellow-500" placeholder="部材名" value="${savedName}">
            <button type="button" data-index="${i}" class="open-bulk-level-selector text-xs whitespace-nowrap bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-3 py-2 rounded-md border border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors" title="使用階層の選択">
                階層: ${levelsText}
            </button>
        `;
      bulkMemberInputsContainer.appendChild(div);
    }
    // 最初の入力欄にフォーカス
    setTimeout(() => {
      const firstInput = bulkMemberInputsContainer.querySelector("input");
      if (firstInput) firstInput.focus();
    }, 50);
  };
  // FABボタンクリック：モーダルを開く
  fabBulkAddMember.addEventListener("click", () => {
    toggleFab(false);
    const project = state.projects.find((p) => p.id === state.currentProjectId);

    // 継手が一つも登録されていない場合は警告を出して中断
    if (!project || project.joints.length === 0) {
      // showCustomAlert はこのファイルで定義されている前提
      return showCustomAlert("先に継手情報を登録してください。");
    }

    // 継手セレクトボックスの準備（既存の関数を再利用）
    populateJointDropdownForEdit(bulkMemberJointSelect, "");

    // ▼▼▼ 修正追加: 継手選択をリセットする（最初の継手を選択） ▼▼▼
    if (project.joints.length > 0) {
      bulkMemberJointSelect.value = project.joints[0].id;
    } else {
      bulkMemberJointSelect.value = "";
    }
    // ▲▲▲ 修正追加ここまで ▲▲▲

    // ▼▼▼ 必須の修正追加: 部材ごとの個別階層設定をリセットする ▼▼▼
    state.bulkMemberLevels = [];
    // ▲▲▲ 必須の修正追加ここまで ▲▲▲

    // 入力欄を初期化（最初の5つを再描画。この関数内で state.bulkMemberLevels の長さも調整されます）
    renderBulkMemberInputs(5);

    openModal(bulkAddMemberModal);
  });
  // 入力欄追加ボタン
  addBulkInputBtn.addEventListener("click", () => {
    const currentCount = bulkMemberInputsContainer.children.length;
    if (currentCount >= 15) {
      showToast("一度に登録できるのは最大15件までです。");
      return;
    }

    // 現在の入力値を保持
    const currentValues = Array.from(
      document.querySelectorAll(".bulk-member-name-input"),
    ).map((input) => input.value);

    // 入力欄を再描画（+1個）
    renderBulkMemberInputs(currentCount + 1);

    // 値を復元
    const newInputs = document.querySelectorAll(".bulk-member-name-input");
    currentValues.forEach((val, index) => {
      if (newInputs[index]) newInputs[index].value = val;
    });
  });

  // index.html内の <script>
  // ... (省略) ...
  // 入力欄追加ボタン
  addBulkInputBtn.addEventListener("click", () => {
    const currentCount = bulkMemberInputsContainer.children.length;
    if (currentCount >= 15) {
      showToast("一度に登録できるのは最大15件までです。");
      return;
    }

    // 現在の入力値と階層を保持
    const currentValues = Array.from(
      document.querySelectorAll(".bulk-member-name-input"),
    ).map((input) => input.value);

    // 入力欄を再描画（+1個）
    renderBulkMemberInputs(currentCount + 1);

    // 値を復元
    const newInputs = document.querySelectorAll(".bulk-member-name-input");
    currentValues.forEach((val, index) => {
      if (newInputs[index]) newInputs[index].value = val;
    });
  });

  // ▼▼▼ 新規追加: 部材ごとの階層選択モーダル制御ロジック ▼▼▼
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
      const levels = getProjectLevels(project);

      bulkLevelOptionsContainer.innerHTML = "";

      // 全階層チェックボックス
      const allLevelLabel = document.createElement("label");
      allLevelLabel.className =
        "flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200 cursor-pointer border-b pb-2";
      const isAllChecked = currentSelection.length === 0;
      allLevelLabel.innerHTML = `<input type="checkbox" id="bulk-level-select-all" class="h-4 w-4 rounded border-gray-300 text-blue-800 focus:ring-yellow-500" ${
        isAllChecked ? "checked" : ""
      }> 全階層を対象にする`;
      bulkLevelOptionsContainer.appendChild(allLevelLabel);

      // 個別階層チェックボックス
      levels.forEach((lvl) => {
        const isChecked = currentSelection.includes(lvl.id) || isAllChecked;
        const label = document.createElement("label");
        label.className = "flex items-center gap-2 text-sm cursor-pointer ml-3";
        label.innerHTML = `<input type="checkbox" value="${
          lvl.id
        }" class="bulk-level-checkbox-option h-4 w-4 rounded border-gray-300 text-blue-800 focus:ring-yellow-500" ${
          isChecked ? "checked" : ""
        } ${isAllChecked ? "disabled" : ""}> ${lvl.label}`;
        bulkLevelOptionsContainer.appendChild(label);
      });

      // 全階層チェックボックスの連動
      document
        .getElementById("bulk-level-select-all")
        .addEventListener("change", (e) => {
          const isChecked = e.target.checked;
          bulkLevelOptionsContainer
            .querySelectorAll(".bulk-level-checkbox-option")
            .forEach((cb) => {
              cb.checked = isChecked;
              cb.disabled = isChecked;
            });
        });

      openModal(bulkLevelSelectorModal);
    }
  });

  // 階層選択モーダル：決定ボタン
  saveBulkLevelBtn.addEventListener("click", () => {
    // ▼▼▼ 修正追加: 現在の部材名入力値を取得する ▼▼▼
    const currentMemberNames = Array.from(
      document.querySelectorAll(".bulk-member-name-input"),
    ).map((input) => input.value);
    // ▲▲▲ 修正追加ここまで ▲▲▲

    const selectAll = document.getElementById("bulk-level-select-all").checked;
    let newSelection = [];

    if (!selectAll) {
      newSelection = Array.from(
        bulkLevelOptionsContainer.querySelectorAll(
          ".bulk-level-checkbox-option:checked",
        ),
      ).map((cb) => cb.value);
    }

    // グローバル状態を更新
    if (state.activeBulkMemberIndex !== -1) {
      state.bulkMemberLevels[state.activeBulkMemberIndex] = newSelection;
    }

    // UIを再描画して変更を反映
    // ▼▼▼ 修正: 取得した部材名リストを引数として渡す ▼▼▼
    renderBulkMemberInputs(
      bulkMemberInputsContainer.children.length,
      currentMemberNames,
    );
    // ▲▲▲ 修正ここまで ▲▲▲

    // モーダルを閉じる
    closeModal(bulkLevelSelectorModal);
    state.activeBulkMemberIndex = -1;
  });

  // 階層選択モーダル：閉じる
  closeBulkLevelModalBtn.addEventListener("click", () => {
    closeModal(bulkLevelSelectorModal);
    state.activeBulkMemberIndex = -1;
  });
  // ▲▲▲ 新規追加: 部材ごとの階層選択モーダル制御ロジック ▲▲▲

  // 保存ボタン
  saveBulkMemberBtn.addEventListener("click", () => {
    const project = state.projects.find((p) => p.id === state.currentProjectId);
    if (!project) return;

    const jointId = bulkMemberJointSelect.value;
    if (!jointId)
      return showCustomAlert("使用する継手を選択してください。", {
        invalidElements: [bulkMemberJointSelect],
      });

    const nameInputs = document.querySelectorAll(".bulk-member-name-input");

    const newMembers = [];
    const timestamp = Date.now();

    // 入力された名前と、対応する階層設定を収集
    nameInputs.forEach((input, index) => {
      const name = input.value.trim();
      const targetLevels = state.bulkMemberLevels[index] || []; // グローバル配列から階層を取得

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

    // 楽観的UI更新
    const updatedMembersList = [...(project.members || []), ...newMembers];
    const projectIndex = state.projects.findIndex(
      (p) => p.id === state.currentProjectId,
    );
    if (projectIndex !== -1)
      state.projects[projectIndex].members = updatedMembersList;

    renderDetailView();

    // モーダルを閉じて通知
    closeModal(bulkAddMemberModal);
    const jointName =
      bulkMemberJointSelect.options[bulkMemberJointSelect.selectedIndex].text;
    showToast(
      `${newMembers.length}件の部材を一括登録しました (継手: ${jointName})`,
    );

    // データベース保存
    updateProjectData(state.currentProjectId, { members: newMembers }).catch(
      (err) => {
        // 万が一失敗した時だけアラートを出す
        console.error(err);
        showCustomAlert("保存に失敗しました。リロードしてください。");
      },
    );
  });

  // 閉じるボタン等
  [closeBulkAddMemberModalBtn, cancelBulkAddMemberBtn].forEach((btn) => {
    btn.addEventListener("click", () => closeModal(bulkAddMemberModal));
  });
  // ▲▲▲ 追加ここまで ▲▲▲

  const addQuickNavLink = (text, onClick, extraClasses = "") => {
    const btn = document.createElement("button");
    btn.textContent = text;
    // Tailwindの動的クラス生成に対応するため、style属性ではなくclassNameで渡す
    btn.className = `text-left w-full px-4 py-3 text-sm font-medium rounded-md transition-colors ${extraClasses}`;

    // 色クラスが動的なので、念のためデフォルト色も当てておく（上書きされる）
    if (!extraClasses.includes("text-")) {
      btn.classList.add(
        "text-slate-700",
        "dark:text-slate-200",
        "hover:bg-slate-100",
        "dark:hover:bg-slate-700",
      );
    }

    btn.addEventListener("click", () => {
      onClick();
      toggleQuickNav(); // クリックしたら閉じる
    });
    quickNavLinks.appendChild(btn);
  };

  quickNavToggle.addEventListener("click", (e) => {
    e.stopPropagation(); // 親への伝播を止める（documentのclickで閉じないように）
    toggleQuickNav();
  });

  // メニューの外側をクリックしたら閉じる
  document.addEventListener("click", (e) => {
    if (isQuickNavOpen && !quickNavContainer.contains(e.target)) {
      toggleQuickNav();
    }
  });

  // // ★ 修正版：表示制御（クイックナビとFABの両方を制御）
  // const updateQuickNavVisibility = () => {
  //   // プロジェクトが開かれているならクイックナビは常に表示
  //   if (state.currentProjectId) {
  //     quickNavContainer.classList.remove("hidden");

  //     // 登録FABは「継手と部材」タブの時だけ表示
  //     if (state.activeTab === "joints") {
  //       fabContainer.classList.remove("hidden");
  //     } else {
  //       fabContainer.classList.add("hidden");
  //       if (isFabOpen) toggleFab(); // タブ切り替え時に閉じる
  //     }
  //   } else {
  //     quickNavContainer.classList.add("hidden");
  //     fabContainer.classList.add("hidden");
  //   }
  // };
  // 既存の switchView / switchTab 関数にも、この updateQuickNavVisibility() を呼び出す処理を入れる必要があります。
  // しかし、ここでは MutationObserver などを仕込むよりも、
  // 単純に定期的、またはクリックイベントにフックさせるのが簡単です。
  // 一番確実なのは、switchTab関数の最後に追加することです。
  // ▲▲▲ 追加ここまで ▲▲▲
  // ▼▼▼ 追加：グローバルボルトサイズ選択モーダルの生成 ▼▼▼
  // const populateGlobalBoltSelectorModal = () => {
  //   const container = document.getElementById("bolt-options-container");
  //   if (!container) return;
  //   container.innerHTML = "";

  //   const bolts = state.globalBoltSizes || [];

  //   // 種類ごとにグループ化
  //   const grouped = {};
  //   const typeOrderList = [
  //     "M16",
  //     "M16めっき",
  //     "M20",
  //     "M20めっき",
  //     "M22",
  //     "M22めっき",
  //     "中ボ(Mネジ) M16",
  //     "中ボ(Mネジ) M20",
  //     "中ボ(Mネジ) M22",
  //     "Dドブ12",
  //     "Dユニ12",
  //     "Dドブ16",
  //     "Dユニ16",
  //   ];

  //   // ソート順の確保
  //   bolts.forEach((b) => {
  //     const type = b.type;
  //     if (!grouped[type]) grouped[type] = [];
  //     grouped[type].push(b);
  //   });

  //   // 定義順に出力
  //   const sortedTypes = Object.keys(grouped).sort((a, b) => {
  //     const idxA = typeOrderList.indexOf(a);
  //     const idxB = typeOrderList.indexOf(b);
  //     if (idxA !== -1 && idxB !== -1) return idxA - idxB;
  //     if (idxA !== -1) return -1;
  //     if (idxB !== -1) return 1;
  //     return a.localeCompare(b);
  //   });

  //   sortedTypes.forEach((type) => {
  //     const list = grouped[type];
  //     // ヘッダー
  //     const header = document.createElement("h4");
  //     header.className =
  //       "font-bold text-slate-700 dark:text-slate-200 mb-2 mt-4 border-b border-gray-200 dark:border-slate-700 pb-1";
  //     header.textContent = type;
  //     container.appendChild(header);

  //     const grid = document.createElement("div");
  //     grid.className = "grid grid-cols-3 gap-2";

  //     list.forEach((bolt) => {
  //       const btn = document.createElement("button");
  //       // bolt-option-btn クラスを使用
  //       btn.className =
  //         "bolt-option-btn text-sm p-2 hover:bg-yellow-200 border border-blue-200 rounded-md transition-transform duration-150 hover:scale-105 dark:border-slate-600 dark:hover:bg-yellow-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200";
  //       btn.textContent = bolt.label;
  //       btn.dataset.value = bolt.id;

  //       btn.addEventListener("click", () => {
  //         if (state.activeBoltTarget) {
  //           state.activeBoltTarget.value = bolt.id;
  //           state.activeBoltTarget.dispatchEvent(
  //             new Event("change", { bubbles: true }),
  //           );
  //           state.activeBoltTarget = null;
  //           const modal = document.getElementById("bolt-selector-modal");
  //           if (modal) closeModal(modal);
  //         }
  //       });
  //       grid.appendChild(btn);
  //     });
  //     container.appendChild(grid);
  //   });
  // };
  // ▲▲▲ 追加ここまで ▲▲▲

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

  // モーダル要素を取得してドラッグ可能にする
  const modals = [
    document.getElementById("edit-joint-modal"),
    document.getElementById("edit-member-modal"),
    document.getElementById("bulk-add-member-modal"),
    document.getElementById("temp-bolt-mapping-modal"),
  ];

  modals.forEach((modal) => {
    if (modal) {
      makeDraggable(modal);
    }
  });
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("sw.js")
        .then((reg) => console.log("SW registered!", reg))
        .catch((err) => console.log("SW registration failed:", err));
    });
  }

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

  if (tallySheetContainer) {
    let isEditing = false;

    const clearHighlights = () => {
      tallySheetContainer
        .querySelectorAll(".cell-highlight, .cell-selected")
        .forEach((el) => {
          el.classList.remove("cell-highlight", "cell-selected");
        });
    };

    const applyHighlightAndSelect = (targetInputElement) => {
      clearHighlights();
      if (!targetInputElement) return;
      const cell = targetInputElement.closest("td");
      if (!cell) return;
      const colIndex = cell.cellIndex;
      const row = cell.parentElement;
      const table = targetInputElement.closest("table");

      // ▼▼▼ ここから修正 ▼▼▼
      // 1. 行全体と、特に1列目のセルをハイライトする
      if (row) {
        row.classList.add("cell-highlight");
        // 1列目のセルにも明示的にクラスを適用して黄色表示を優先させる
        if (row.cells[0]) {
          row.cells[0].classList.add("cell-highlight");
        }
        // ▼▼▼ 追加：一番右側のセル（行合計）もハイライトする ▼▼▼
        const lastCellIndex = row.cells.length - 1;
        if (row.cells[lastCellIndex]) {
          row.cells[lastCellIndex].classList.add("cell-highlight");
        }
        // ▲▲▲ 追加ここまで ▲▲▲
      }

      // 2. 列全体（ヘッダー3行を含む）をハイライトする
      if (table && colIndex > 0) {
        const thead = table.querySelector("thead");
        if (thead) {
          // ヘッダー1行目：ロック用チェックボックスのセル
          if (thead.rows[0] && thead.rows[0].cells[colIndex]) {
            thead.rows[0].cells[colIndex].classList.add("cell-highlight");
          }
          // ヘッダー2行目：部材名のセル
          if (thead.rows[1] && thead.rows[1].cells[colIndex - 1]) {
            thead.rows[1].cells[colIndex - 1].classList.add("cell-highlight");
          }
          // ヘッダー3行目：ボルトサイズのセル
          if (thead.rows[2] && thead.rows[2].cells[colIndex - 1]) {
            thead.rows[2].cells[colIndex - 1].classList.add("cell-highlight");
          }
        }

        // 本体とフッターのセル
        table.querySelectorAll("tbody tr, tfoot tr").forEach((tableRow) => {
          if (tableRow.cells[colIndex]) {
            tableRow.cells[colIndex].classList.add("cell-highlight");
          }
        });
      }
      // ▲▲▲ ここまで修正 ▲▲▲

      cell.classList.add("cell-selected");
    };

    // --- イベントリスナー ---

    tallySheetContainer.addEventListener("dblclick", (e) => {
      if (e.target.classList.contains("tally-input")) {
        isEditing = true;
        e.target.setSelectionRange(
          e.target.value.length,
          e.target.value.length,
        );
      }
    });

    tallySheetContainer.addEventListener("focusin", (e) => {
      if (e.target.classList.contains("tally-input")) {
        applyHighlightAndSelect(e.target);
        e.target.select();
        isEditing = false;
      }
    });

    tallySheetContainer.addEventListener("focusout", (e) => {
      setTimeout(() => {
        if (!tallySheetContainer.contains(document.activeElement)) {
          clearHighlights();
        }
      }, 0);
    });

    // ★ 修正版：全角数字を半角に、それ以外の文字（全角・記号含む）を削除
    tallySheetContainer.addEventListener("input", (e) => {
      if (e.target.classList.contains("tally-input")) {
        const target = e.target;
        let val = target.value;

        // 1. 全角数字を半角に変換
        val = val.replace(/[０-９]/g, (s) =>
          String.fromCharCode(s.charCodeAt(0) - 0xfee0),
        );

        // 2. 数字以外（スペース、全角文字、記号など）をすべて削除
        // ※ マイナス記号(-)も不要であれば削除対象に含めています
        const newVal = val.replace(/[^0-9]/g, "");

        // 値が変わっている場合のみ更新（カーソル位置飛び防止のため）
        if (val !== newVal) {
          target.value = newVal;
        }
      }
    });

    // ... 既存の keydown イベントリスナーの後 ...

    // --- ここから追加 ---
    // ドラッグ＆ドロップによる数値移動の確認機能
    tallySheetContainer.addEventListener("dragstart", (e) => {
      if (e.target.classList.contains("tally-input") && !e.target.disabled) {
        dragSourceElement = e.target;
        e.dataTransfer.effectAllowed = "move";
      }
    });

    tallySheetContainer.addEventListener("dragover", (e) => {
      // ドロップを許可するために、デフォルトの動作をキャンセル
      if (e.target.classList.contains("tally-input") && !e.target.disabled) {
        e.preventDefault();
      }
    });

    tallySheetContainer.addEventListener("dragend", (e) => {
      // ドラッグ操作が終了した際（ドロップされなかった場合など）にリセット
      dragSourceElement = null;
    });

    tallySheetContainer.addEventListener("drop", (e) => {
      e.preventDefault();
      const dropTargetElement = e.target;

      // ドラッグ元が存在し、有効なドロップ先（別の入力可能なセル）であるかを確認
      if (
        !dragSourceElement ||
        !dropTargetElement ||
        !dropTargetElement.classList.contains("tally-input") ||
        dropTargetElement === dragSourceElement ||
        dropTargetElement.disabled
      ) {
        dragSourceElement = null;
        return;
      }

      const sourceValue = dragSourceElement.value || "(空)";
      const targetValue = dropTargetElement.value || "(空)";

      document.getElementById("confirm-action-title").textContent =
        "数値の移動確認";
      document.getElementById("confirm-action-message").innerHTML =
        `セルからセルへ数値を移動しますか？<br><br>
                移動元セルの値: <strong class="text-blue-600 dark:text-blue-400">${sourceValue}</strong><br>
                移動先セルの値: <strong class="text-red-600 dark:text-red-400">${targetValue}</strong> (この値は上書きされます)`;

      // 確認モーダルの「実行する」が押された時の動作を定義
      state.pendingAction = () => {
        // 移動を実行
        dropTargetElement.value = dragSourceElement.value;
        dragSourceElement.value = "";

        // 変更をアプリケーションに通知し、合計値の再計算や保存をトリガーする
        dragSourceElement.dispatchEvent(new Event("change", { bubbles: true }));
        dropTargetElement.dispatchEvent(new Event("change", { bubbles: true }));

        dragSourceElement = null; // 完了後にリセット
      };

      openModal(document.getElementById("confirm-action-modal"));
    });
    // --- ここまで追加 ---

    // ★ 最終決定版：キーボード操作（IME強制クリア・行き止まり維持・Excel挙動）
    tallySheetContainer.addEventListener("keydown", (e) => {
      if (!e.target.classList.contains("tally-input")) return;

      const key = e.key;
      const code = e.code;
      const target = e.target;
      const isComposing = e.isComposing; // IME入力中かどうか

      // --- 1. スペースキーで値をクリア (IME強制中断ロジック) ---
      if (code === "Space" || key === " " || key === "Spacebar") {
        e.preventDefault(); // ブラウザ標準動作を停止
        e.stopPropagation();

        // ★重要：IME変換窓が出ないように、一度フォーカスを外してIMEを殺す
        target.blur();

        // 値をクリア
        target.value = "";
        isEditing = true;

        // 変更を保存
        target.dispatchEvent(new Event("input", { bubbles: true }));
        target.dispatchEvent(new Event("change", { bubbles: true }));

        // フォーカスを戻して入力可能な状態にする
        // (blurで外れたので、微小な遅延を入れて戻すのが確実)
        setTimeout(() => {
          target.focus();
        }, 0);

        return;
      }

      // --- 2. 十字キーとEnterキーの移動ロジック ---
      const moveKeys = [
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Enter",
      ];
      if (moveKeys.includes(key)) {
        // 【左右キー】全角入力中(IME有効)は、文字変換の文節移動などに使うため移動しない
        if (isComposing && (key === "ArrowLeft" || key === "ArrowRight")) {
          return;
        }

        // 【Enterキー】全角入力中(IME有効)は、文字確定に使うため移動しない
        if (isComposing && key === "Enter") {
          return;
        }

        // 上下キーは、全角入力中でも「確定して移動」とみなす（Excelライク）
        e.preventDefault();

        // 現在のセルを Blur させることで値を確定
        target.blur();

        // --- 移動先を探す ---
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

        // --- 移動実行 or 維持 ---

        // IME確定後の値コピーバグを防ぐため、移動は非同期で行う
        setTimeout(() => {
          if (nextInput) {
            // 移動先がある場合
            nextInput.focus();
            nextInput.select();
          } else {
            // 行き止まりの場合
            // フォーカスを再設定して維持し、変更イベントを発火
            target.focus(); // ★ここを追加（迷子防止）
            target.select();
            target.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }, 0);

        return;
      }

      // --- 3. Escapeキー ---
      if (key === "Escape") {
        e.preventDefault();
        isEditing = false;
        target.blur();
        return;
      }

      // --- 4. 入力開始 ---
      const isCharacterKey =
        !e.ctrlKey && !e.altKey && !e.metaKey && key.length === 1;
      if (isCharacterKey) {
        isEditing = true;
      }
    });
  }

  // ▼▼▼ 追加：タブ切り替えイベントリスナーの登録 ▼▼▼
  const tabJoints = document.getElementById("nav-tab-joints");
  const tabTally = document.getElementById("nav-tab-tally");
  const mobileTabJoints = document.getElementById("mobile-nav-tab-joints");
  const mobileTabTally = document.getElementById("mobile-nav-tab-tally");

  if (tabJoints) tabJoints.addEventListener("click", () => switchTab("joints"));
  if (tabTally) tabTally.addEventListener("click", () => switchTab("tally"));
  if (mobileTabJoints)
    mobileTabJoints.addEventListener("click", () => switchTab("joints"));
  if (mobileTabTally)
    mobileTabTally.addEventListener("click", () => switchTab("tally"));
  // ▲▲▲ 追加ここまで ▲▲▲
}); // document.addEventListener('DOMContentLoaded', ...) の終わり
