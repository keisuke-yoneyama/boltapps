// ui.js
// バレルファイル: 各サブモジュールからの再エクスポートと、
// 複数サブモジュールを横断するオーケストレーション関数を保持する

// ─── サブモジュールの再エクスポート ───────────────────────────────
export * from "./ui-notifications.js";
export * from "./ui-modal.js";
export * from "./ui-theme.js";
export * from "./ui-joints.js";
export * from "./ui-members.js";
export * from "./ui-projects.js";
export * from "./ui-results.js";

// ─── 必要なインポート ─────────────────────────────────────────────
import { HUG_BOLT_SIZES } from "./config.js";
import { state } from "./state.js";
import {
  ensureProjectBoltSizes,
  calculateAggregatedResults,
  getProjectLevels,
} from "./calculator.js";
import { saveGlobalBoltSizes } from "./firebase.js";

// サブモジュールからのインポート（オーケストレーター関数内で使用）
import { openModal, closeModal, resetBulkDeleteState } from "./ui-modal.js";
import { showCustomAlert } from "./ui-notifications.js";
import {
  renderColorPalette,
  renderStaticColorPalette,
  populateHugBoltSelector,
  updateJointFormUI,
  renderJointsList,
} from "./ui-joints.js";
import {
  renderMemberLists,
  updateProjectSelectionBar,
  resetMemberForm,
} from "./ui-members.js";
import {
  generateCustomInputFields,
  renderProjectList,
  renderProjectSwitcher,
  openEditProjectModal,
} from "./ui-projects.js";
import {
  renderTallySheet,
  renderResults,
  renderAggregatedResults,
} from "./ui-results.js";
import { performHistoryActionRaw as _performHistoryAction } from "./ui-theme.js";
import { openConfirmDeleteModal } from "./ui-modal.js";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ─── 定数 ─────────────────────────────────────────────────────────
// 並び順の定義
const BOLT_TYPE_ORDER = [
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

// ─── モジュールレベル変数 ──────────────────────────────────────────
let isQuickNavOpen = false;

// ─── CustomEvent リスナー: サブモジュールからの quickNavLinksUpdate ──
// renderJointsList / renderMemberLists が循環インポートを避けるために
// CustomEvent を dispatch するので、ここで受け取って updateQuickNavLinks を呼ぶ
document.addEventListener("quickNavLinksUpdate", () => {
  updateQuickNavLinks();
});

// ─── performHistoryAction のラッパー ──────────────────────────────
// ui-theme.js の performHistoryAction はコールバックを引数で受け取る設計。
// このラッパーが renderDetailView / renderProjectList への参照を渡す。
export const performHistoryAction = (action) => {
  _performHistoryAction(
    action,
    {}, // savedListCallbacks は ui-projects.js の _savedListCallbacks で管理されるため不要
    renderDetailView,
    renderProjectList,
  );
};

// ─── populateGlobalBoltSelectorModal ──────────────────────────────
/**
 * グローバルボルト選択モーダルの中身（ボタン一覧）を種類ごとに生成する
 */
export const populateGlobalBoltSelectorModal = () => {
  const container = document.getElementById("bolt-options-container");
  if (!container) return;

  container.innerHTML = "";

  const bolts = state.globalBoltSizes || [];

  // 種類ごとにグループ化
  const grouped = {};
  bolts.forEach((b) => {
    const type = b.type;
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(b);
  });

  // 定義順にソート
  const sortedTypes = Object.keys(grouped).sort((a, b) => {
    const idxA = BOLT_TYPE_ORDER.indexOf(a);
    const idxB = BOLT_TYPE_ORDER.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  // HTML生成
  sortedTypes.forEach((type) => {
    const list = grouped[type];

    const header = document.createElement("h4");
    header.className =
      "font-bold text-slate-700 dark:text-slate-200 mb-2 mt-4 border-b border-gray-200 dark:border-slate-700 pb-1";
    header.textContent = type;
    container.appendChild(header);

    const grid = document.createElement("div");
    grid.className = "grid grid-cols-3 gap-2";

    list.forEach((bolt) => {
      const btn = document.createElement("button");
      btn.className =
        "bolt-option-btn text-sm p-2 hover:bg-yellow-200 border border-blue-200 rounded-md transition-transform duration-150 hover:scale-105 dark:border-slate-600 dark:hover:bg-yellow-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200";
      btn.textContent = bolt.label;
      btn.dataset.value = bolt.id;

      btn.addEventListener("click", () => {
        if (state.activeBoltTarget) {
          state.activeBoltTarget.value = bolt.id;
          state.activeBoltTarget.dispatchEvent(
            new Event("change", { bubbles: true }),
          );
          state.activeBoltTarget = null;

          const modal = document.getElementById("bolt-selector-modal");
          if (modal) closeModal(modal);
        }
      });

      grid.appendChild(btn);
    });
    container.appendChild(grid);
  });
};

// ─── openBoltSelectorModal ────────────────────────────────────────
/**
 * ボルト選択モーダルを開く（ターゲットを指定）
 */
export const openBoltSelectorModal = (targetInputId) => {
  state.activeBoltTarget = document.getElementById(targetInputId);

  if (state.activeBoltTarget) {
    const currentValue = state.activeBoltTarget.value;
    populateBoltSelectorModal(currentValue);
    const modal = document.getElementById("bolt-selector-modal");
    openModal(modal);
  }
};

// ─── populateBoltSelectorModal ────────────────────────────────────
/**
 * ボルト選択モーダルの中身（ボタン一覧）を生成する
 */
export const populateBoltSelectorModal = (currentValue) => {
  const container = document.getElementById("bolt-options-container");
  if (!container) return;

  const project = state.projects.find((p) => p.id === state.currentProjectId);
  if (!project) return;

  if (typeof ensureProjectBoltSizes === "function") {
    ensureProjectBoltSizes(project);
  }

  const groupedBolts = project.boltSizes.reduce((acc, bolt) => {
    const groupKey = bolt.type;
    if (!acc[groupKey]) {
      acc[groupKey] = [];
    }
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

  container.innerHTML = groupOrder
    .map((group) => {
      const buttonsHtml = groupedBolts[group]
        .map((size) => {
          let displayText = size;
          if (size.startsWith("中ボ")) {
            displayText = size.substring(2);
          } else if (size.startsWith("中")) {
            displayText = size.substring(1);
          }

          const isSelected = size === currentValue;
          const selectedClass = isSelected
            ? "bg-yellow-400 dark:bg-yellow-600 font-bold"
            : "bg-blue-50 dark:bg-slate-700";

          return `
                <button data-size="${size}" class="bolt-option-btn text-sm p-2 border border-blue-200 rounded-md transition-transform duration-150 hover:scale-105 ${selectedClass}">
                    ${displayText}
                </button>`;
        })
        .join("");

      return `
            <div class="mb-4">
                <h4 class="font-bold text-blue-800 dark:text-blue-300 border-b border-blue-200 dark:border-slate-600 pb-1 mb-2">${group}</h4>
                <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    ${buttonsHtml}
                </div>
            </div>`;
    })
    .join("");

  container.querySelectorAll(".bolt-option-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (state.activeBoltTarget) {
        state.activeBoltTarget.value = btn.dataset.size;
        state.activeBoltTarget.dispatchEvent(
          new Event("change", { bubbles: true }),
        );
        state.activeBoltTarget = null;
        const modal = document.getElementById("bolt-selector-modal");
        if (modal) closeModal(modal);
      }
    });
  });
};

// ─── renderBoltSizeSettings ───────────────────────────────────────
/**
 * ボルトサイズ設定画面を描画する
 */
export const renderBoltSizeSettings = (activeBoltTab = "all") => {
  const listContainer = document.getElementById("bolt-size-list");
  if (!listContainer) return;

  listContainer.innerHTML = "";
  const boltSizes = state.globalBoltSizes || [];

  // タブの見た目を更新
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

  // データのフィルタリング
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

  const countEl = document.getElementById("bolt-size-count");
  if (countEl)
    countEl.textContent = `表示: ${filteredBolts.length} / 全${boltSizes.length} 件`;

  if (filteredBolts.length === 0) {
    listContainer.innerHTML =
      '<li class="text-center text-slate-400 py-4 text-sm">該当するサイズはありません</li>';
    return;
  }

  filteredBolts.forEach((bolt) => {
    const isUsed = state.projects.some((p) =>
      p.joints.some((j) => j.flangeSize === bolt.id || j.webSize === bolt.id),
    );

    const li = document.createElement("li");
    li.className =
      "flex justify-between items-center bg-white dark:bg-slate-700 p-3 rounded border border-gray-200 dark:border-slate-600 shadow-sm";

    const deleteBtnHtml = `
        <button class="delete-bolt-size-btn text-red-500 hover:text-red-700 p-2 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors" data-id="${bolt.id}" title="削除">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 000-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
        </button>`;

    li.innerHTML = `
            <div class="flex flex-col">
                <div class="flex items-center gap-2">
                    <span class="font-bold text-slate-800 dark:text-slate-200 text-lg">${esc(bolt.label)}</span>
                    ${isUsed ? '<span class="text-xs bg-gray-200 text-gray-600 px-1 rounded">使用中</span>' : ""}
                </div>
                <div class="text-xs text-slate-500 dark:text-slate-400">種類: ${esc(bolt.type)} / 長さ: ${bolt.length}mm</div>
            </div>
            ${deleteBtnHtml}
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

        renderBoltSizeSettings(activeBoltTab);

        await saveGlobalBoltSizes(state.globalBoltSizes);
      }
    });
  });
};

// ─── switchTab ────────────────────────────────────────────────────
/**
 * タブを切り替える（継手 <-> 入力と集計）
 */
export const switchTab = (tabName) => {
  const elements = {
    btnToTally: document.getElementById("fab-nav-tally-btn"),
    btnToJoints: document.getElementById("fab-nav-joints-btn"),
    jointsSection: document.getElementById("joints-section"),
    tallySection: document.getElementById("tally-section"),
    navTabJoints: document.getElementById("nav-tab-joints"),
    navTabTally: document.getElementById("nav-tab-tally"),
    mobileNavTabJoints: document.getElementById("mobile-nav-tab-joints"),
    mobileNavTabTally: document.getElementById("mobile-nav-tab-tally"),
    settingsCard: document.getElementById("settings-card"),
    memberCard: document.getElementById("member-registration-card"),
  };
  const searchWrapper = document.getElementById("fab-search-wrapper");

  // スクロール位置保存
  const currentScrollY = window.scrollY;
  if (state.activeTab) {
    if (!state.scrollPositions) state.scrollPositions = {};
    state.scrollPositions[state.activeTab] = currentScrollY;
  }
  state.activeTab = tabName;

  // タブのアクティブ状態リセット
  [
    elements.navTabJoints,
    elements.navTabTally,
    elements.mobileNavTabJoints,
    elements.mobileNavTabTally,
  ].forEach((tab) => {
    if (tab) tab.classList.remove("active");
  });

  if (tabName === "joints") {
    if (elements.jointsSection)
      elements.jointsSection.classList.remove("hidden");
    if (elements.settingsCard) elements.settingsCard.classList.remove("hidden");
    if (elements.memberCard) elements.memberCard.classList.remove("hidden");
    if (elements.tallySection) elements.tallySection.classList.add("hidden");

    if (elements.navTabJoints) elements.navTabJoints.classList.add("active");
    if (elements.mobileNavTabJoints)
      elements.mobileNavTabJoints.classList.add("active");
    if (elements.btnToTally) elements.btnToTally.classList.remove("hidden");
    if (elements.btnToJoints) elements.btnToJoints.classList.add("hidden");
    if (searchWrapper) searchWrapper.classList.remove("hidden");
  } else if (tabName === "tally") {
    if (elements.jointsSection) elements.jointsSection.classList.add("hidden");
    if (elements.settingsCard) elements.settingsCard.classList.add("hidden");
    if (elements.memberCard) elements.memberCard.classList.add("hidden");
    if (elements.tallySection) elements.tallySection.classList.remove("hidden");

    if (elements.navTabTally) elements.navTabTally.classList.add("active");
    if (elements.mobileNavTabTally)
      elements.mobileNavTabTally.classList.add("active");
    if (searchWrapper) searchWrapper.classList.add("hidden");
    if (elements.btnToTally) elements.btnToTally.classList.add("hidden");
    if (elements.btnToJoints) elements.btnToJoints.classList.remove("hidden");

    resetBulkDeleteState();
  }

  // スクロール位置復元
  const newScrollY =
    (state.scrollPositions && state.scrollPositions[tabName]) || 0;
  setTimeout(() => {
    window.scrollTo(0, newScrollY);
  }, 0);
  updateQuickNavLinks();
};

// ─── switchView ───────────────────────────────────────────────────
/**
 * 画面表示を切り替える (一覧画面 <-> 詳細画面)
 */
export const switchView = (viewName) => {
  const viewList =
    document.getElementById("view-project-list") ||
    document.getElementById("project-list-view");
  const viewDetail =
    document.getElementById("view-project-detail") ||
    document.getElementById("project-detail-view");

  if (!viewList || !viewDetail) return;

  const masterFab = document.getElementById("master-fab-container");

  window.scrollTo(0, 0);

  const navElements = {
    fixedNav: document.getElementById("fixed-nav"),
    navListContext: document.getElementById("nav-list-context"),
    navDetailContext: document.getElementById("nav-detail-context"),
    navDetailButtons: document.getElementById("nav-detail-buttons"),
    mobileNavDetailButtons: document.getElementById(
      "mobile-nav-detail-buttons",
    ),
    navProjectTitle: document.getElementById("nav-project-title"),
  };

  if (viewName === "detail") {
    viewList.classList.add("hidden");
    viewList.style.display = "none";
    viewDetail.classList.remove("hidden");
    viewDetail.style.display = "block";

    if (masterFab) masterFab.classList.remove("hidden");

    if (navElements.fixedNav) navElements.fixedNav.classList.remove("hidden");
    if (navElements.navListContext)
      navElements.navListContext.classList.add("hidden");
    if (navElements.navDetailContext)
      navElements.navDetailContext.classList.remove("hidden");

    if (navElements.navDetailButtons) {
      navElements.navDetailButtons.classList.remove("hidden");
      navElements.navDetailButtons.classList.add("flex");
    }
    if (navElements.mobileNavDetailButtons) {
      navElements.mobileNavDetailButtons.classList.remove("hidden");
    }

    switchTab("joints");
  } else {
    state.activeTallyLevel = "all";
    state.activeTallyType = "all";
    viewList.classList.remove("hidden");
    viewList.style.display = "block";
    viewDetail.classList.add("hidden");
    viewDetail.style.display = "none";

    if (navElements.navListContext)
      navElements.navListContext.classList.remove("hidden");
    if (navElements.navDetailContext)
      navElements.navDetailContext.classList.add("hidden");

    if (navElements.navDetailButtons) {
      navElements.navDetailButtons.classList.add("hidden");
      navElements.navDetailButtons.classList.remove("flex");
    }
    if (navElements.mobileNavDetailButtons) {
      navElements.mobileNavDetailButtons.classList.add("hidden");
    }

    if (masterFab) {
      masterFab.classList.add("hidden");

      const masterMenu = document.getElementById("master-fab-menu");
      const masterIcon = document.getElementById("master-fab-icon");
      const masterToggle = document.getElementById("master-fab-toggle");

      if (masterMenu && !masterMenu.classList.contains("opacity-0")) {
        masterMenu.classList.add(
          "opacity-0",
          "translate-y-10",
          "pointer-events-none",
        );
        masterMenu.classList.remove(
          "opacity-100",
          "translate-y-0",
          "pointer-events-auto",
        );
        if (masterIcon)
          masterIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7" />`;
        if (masterToggle) masterToggle.classList.remove("rotate-90");
      }
    }

    resetBulkDeleteState();

    state.currentProjectId = null;
  }

  const bulkBar = document.getElementById("project-op-bar");
  if (bulkBar) {
    if (viewName !== "list") {
      document
        .querySelectorAll(".project-checkbox")
        .forEach((cb) => (cb.checked = false));
      updateProjectSelectionBar();
    }
  }
};

// ─── renderDetailView ─────────────────────────────────────────────
/**
 * 詳細画面全体を描画する
 */
export const renderDetailView = () => {
  const project = state.projects.find((p) => p.id === state.currentProjectId);

  if (!project) {
    switchView("list");
    return;
  }

  const listContext = document.getElementById("nav-list-context");
  const detailContext = document.getElementById("nav-detail-context");
  const detailButtons = document.getElementById("nav-detail-buttons");
  const boltSettingsBtn = document.getElementById("nav-btn-bolt-settings");

  if (listContext) listContext.classList.add("hidden");
  if (detailContext) detailContext.classList.remove("hidden");
  if (detailButtons) detailButtons.classList.remove("hidden", "md:hidden");
  if (boltSettingsBtn) boltSettingsBtn.classList.remove("hidden");

  // プロジェクトセレクターを描画（renderDetailView を callback として渡す）
  renderProjectSwitcher(renderDetailView);

  // 各種リスト・シートの描画
  renderJointsList(project);
  renderMemberLists(project);

  // 常設フォームの階層チェックボックス
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
      label.innerHTML = `<input type="checkbox" value="${lvl.id}" class="static-level-checkbox h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-yellow-500">`;
      label.append(` ${lvl.label}`);
      staticLevelsContainer.appendChild(label);
    });
  }

  // renderTallySheet / renderResults に renderResults を callback として渡す
  renderTallySheet(project, renderResults);
  renderResults(project);
};

// ─── updateProjectListUI ──────────────────────────────────────────
/**
 * プロジェクトリストの描画とアクション定義を行うラッパー関数
 */
export const updateProjectListUI = () => {
  renderProjectList({
    onSelect: (id) => {
      const originalProject = state.projects.find((p) => p.id == id);
      if (originalProject) {
        state.currentProjectId = originalProject.id;
      }
      resetMemberForm();
      state.sort = {};
      renderDetailView();
      switchView("detail");
    },

    onEdit: (id) => {
      const project = state.projects.find((p) => p.id === id);
      if (project) {
        openEditProjectModal(project);
      }
    },

    onDelete: (id) => {
      openConfirmDeleteModal(id, "project");
    },

    onDuplicate: (id) => {
      const project = state.projects.find((p) => p.id === id);
      if (project) {
        const copySourceIdInput = document.getElementById(
          "copy-source-project-id",
        );
        const copyNewNameInput = document.getElementById(
          "copy-new-project-name",
        );
        const copyProjectModal = document.getElementById("copy-project-modal");

        if (copySourceIdInput && copyNewNameInput && copyProjectModal) {
          copySourceIdInput.value = id;
          let baseName = project.name.replace(/\(\d+\)$/, "").trim();
          let counter = 2;
          const sameGroupProjects = state.projects.filter(
            (p) => p.propertyName === project.propertyName,
          );
          while (
            sameGroupProjects.some(
              (p) =>
                p.name ===
                (counter === 1 ? baseName : `${baseName}(${counter})`),
            )
          ) {
            counter++;
          }
          copyNewNameInput.value = `${baseName}(${counter})`;
          openModal(copyProjectModal);
        }
      }
    },

    onGroupEdit: (propertyName) => {
      const oldNameInput = document.getElementById("edit-group-old-name");
      const newNameInput = document.getElementById("edit-group-new-name");
      if (oldNameInput) oldNameInput.value = propertyName;
      if (newNameInput) newNameInput.value = propertyName;
      openModal(document.getElementById("edit-group-modal"));
    },

    onGroupAggregate: (propertyName) => {
      const projectsInGroup = state.projects.filter(
        (p) => p.propertyName === propertyName,
      );
      if (projectsInGroup.length > 0) {
        const aggregatedData = calculateAggregatedResults(projectsInGroup);
        renderAggregatedResults(propertyName, aggregatedData);
        openModal(document.getElementById("aggregated-results-modal"));
      }
    },
  });
};

// ─── initializeUIComponents ───────────────────────────────────────
/**
 * UIコンポーネントの初期化（セレクトボックスやパレットなど）
 */
export const initializeUIComponents = () => {
  renderColorPalette(null);
  renderStaticColorPalette(null);

  const customLevelsContainer = document.getElementById(
    "custom-levels-container",
  );
  const customAreasContainer = document.getElementById(
    "custom-areas-container",
  );
  if (customLevelsContainer)
    generateCustomInputFields(1, customLevelsContainer, "custom-level");
  if (customAreasContainer)
    generateCustomInputFields(1, customAreasContainer, "custom-area");

  const boltInputs = [
    "shop-temp-bolt-size",
    "edit-shop-temp-bolt-size",
    "shop-temp-bolt-size-f",
    "shop-temp-bolt-size-w",
    "edit-shop-temp-bolt-size-f",
    "edit-shop-temp-bolt-size-w",
  ];
  boltInputs.forEach((id) => {
    const el = document.getElementById(id);
    if (el) populateHugBoltSelector(el);
  });
};

// ─── initializeJointFormState ─────────────────────────────────────
/**
 * 継手フォームの初期状態設定
 */
export const initializeJointFormState = () => {
  const jointTypeInput = document.getElementById("joint-type");
  const hasBoltCorrectionInput = document.getElementById("has-bolt-correction");
  const shopSplGroup = document.getElementById("shop-spl-group");
  const hasShopSplInput = document.getElementById("has-shop-spl");

  updateJointFormUI(false);

  if (jointTypeInput && shopSplGroup && hasShopSplInput) {
    const initialJointTypeForSpl = jointTypeInput.value;
    const applicableSplTypes = ["girder", "beam", "stud", "other"];

    if (applicableSplTypes.includes(initialJointTypeForSpl)) {
      shopSplGroup.classList.remove("hidden");
      hasShopSplInput.checked = true;
    }

    if (hasShopSplInput.checked) {
      if (hasBoltCorrectionInput) hasBoltCorrectionInput.disabled = false;
    } else {
      if (hasBoltCorrectionInput) {
        hasBoltCorrectionInput.disabled = true;
        hasBoltCorrectionInput.checked = false;
      }
    }
  }
};

// ─── setupQuickNav ────────────────────────────────────────────────
/**
 * FABのクイックナビゲーションのクリックイベント設定
 */
export const setupQuickNav = () => {
  const quickNavToggle = document.getElementById("quick-nav-toggle");
  if (quickNavToggle) {
    quickNavToggle.addEventListener("click", toggleQuickNav);
  }
};

// ─── toggleQuickNav (private) ─────────────────────────────────────
const toggleQuickNav = () => {
  const quickNavMenu = document.getElementById("quick-nav-menu");
  if (!quickNavMenu) return;

  isQuickNavOpen = !isQuickNavOpen;

  if (isQuickNavOpen) {
    updateQuickNavLinks();
    quickNavMenu.classList.remove("hidden");
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
    quickNavMenu.classList.remove(
      "scale-100",
      "opacity-100",
      "pointer-events-auto",
    );
    quickNavMenu.classList.add("scale-95", "opacity-0", "pointer-events-none");
    setTimeout(() => {
      if (!isQuickNavOpen) quickNavMenu.classList.add("hidden");
    }, 200);
  }
};

// ─── addQuickNavLink (private) ────────────────────────────────────
/**
 * ヘルパー関数: リンクボタンの作成 (マスターFAB対応版)
 */
const addQuickNavLink = (text, onClick, container, colorName = "gray") => {
  if (!container) return;

  const btn = document.createElement("button");
  btn.textContent = text;
  btn.className = `text-left w-full px-4 py-3 text-sm font-bold rounded-md transition-all truncate border-l-4 mb-1 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between`;

  const colorMap = {
    blue: { text: "#1d4ed8", bg: "#eff6ff", darkText: "#60a5fa" },
    cyan: { text: "#0e7490", bg: "#ecfeff", darkText: "#22d3ee" },
    green: { text: "#15803d", bg: "#f0fdf4", darkText: "#4ade80" },
    teal: { text: "#0f766e", bg: "#f0fdfa", darkText: "#2dd4bf" },
    indigo: { text: "#4338ca", bg: "#eef2ff", darkText: "#818cf8" },
    purple: { text: "#7e22ce", bg: "#faf5ff", darkText: "#c084fc" },
    red: { text: "#b91c1c", bg: "#fef2f2", darkText: "#f87171" },
    orange: { text: "#c2410c", bg: "#fff7ed", darkText: "#fb923c" },
    amber: { text: "#b45309", bg: "#fffbeb", darkText: "#fbbf24" },
    gray: { text: "#374151", bg: "#f9fafb", darkText: "#9ca3af" },
    slate: { text: "#334155", bg: "#f8fafc", darkText: "#94a3b8" },
  };

  const theme = colorMap[colorName] || colorMap.slate;

  btn.style.color = theme.text;
  btn.style.borderLeftColor = theme.text;

  if (document.documentElement.classList.contains("dark")) {
    btn.style.color = theme.darkText;
  }

  btn.addEventListener("click", () => {
    onClick();
    const masterFabToggle = document.getElementById("master-fab-toggle");
    if (masterFabToggle) masterFabToggle.click();
  });

  container.appendChild(btn);
};

// ─── updateQuickNavLinks ──────────────────────────────────────────
/**
 * セクション移動（目次）のリンクを動的に生成して更新する
 */
export function updateQuickNavLinks() {
  const linksContainer = document.getElementById("quick-nav-links");
  if (!linksContainer) return;

  linksContainer.innerHTML = "";

  addQuickNavLink(
    "↑ ページ最上部へ",
    () => window.scrollTo({ top: 0, behavior: "smooth" }),
    linksContainer,
    "blue",
  );

  let targets = [];
  if (state.activeTab === "joints") {
    targets = Array.from(
      document.querySelectorAll(
        '#joint-lists-container [id^="anchor-"], #member-lists-container [id^="anchor-"]',
      ),
    ).filter((el) => !el.closest(".hidden"));
  } else if (state.activeTab === "tally") {
    const tallyCard = document.getElementById("tally-card");
    const resultSections = Array.from(
      document.querySelectorAll("#results-card-content [data-section-title]"),
    );
    if (tallyCard && !tallyCard.classList.contains("hidden")) {
      targets = [tallyCard, ...resultSections];
    }
  }

  if (targets.length > 0) {
    targets.forEach((section) => {
      const title =
        section.dataset.sectionTitle ||
        (section.id === "tally-card" ? "箇所数入力" : "セクション");
      const color = section.dataset.sectionColor || "gray";

      addQuickNavLink(
        title,
        () => section.scrollIntoView({ behavior: "smooth", block: "start" }),
        linksContainer,
        color,
      );
    });
  } else {
    const p = document.createElement("p");
    p.textContent = "移動先がありません";
    p.className = "text-xs text-gray-500 p-4 text-center";
    linksContainer.appendChild(p);
  }

  addQuickNavLink(
    "↓ ページ最下部へ",
    () =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }),
    linksContainer,
    "blue",
  );
}

// ─── openTempBoltSettingsModal ────────────────────────────────────
export function openTempBoltSettingsModal() {
  const project = state.projects.find((p) => p.id === state.currentProjectId);
  populateTempBoltMappingModal(project);
  const modal = document.getElementById("temp-bolt-mapping-modal");
  openModal(modal);
}

// ─── populateTempBoltMappingModal ─────────────────────────────────
export const populateTempBoltMappingModal = (project) => {
  if (!project) return;

  const container = document.getElementById("temp-bolt-mapping-container");
  if (!container) return;

  container.innerHTML = "";
  const requiredFinalBolts = new Set();

  project.joints
    .filter(
      (j) =>
        j.tempBoltSetting === "calculated" &&
        j.type !== "wall_girt" &&
        j.type !== "roof_purlin" &&
        j.type !== "column",
    )
    .forEach((j) => {
      if (j.isComplexSpl && j.webInputs) {
        j.webInputs.forEach((input) => {
          if (input.size) requiredFinalBolts.add(input.size);
        });
      } else {
        if (j.flangeSize) requiredFinalBolts.add(j.flangeSize);
        if (j.webSize) requiredFinalBolts.add(j.webSize);
      }
    });

  if (requiredFinalBolts.size === 0) {
    container.innerHTML =
      '<p class="text-slate-500">仮ボルトを使用する継手が登録されていません。</p>';
    return;
  }

  const sortedFinalBolts = Array.from(requiredFinalBolts).sort((a, b) => {
    const regex = /M(\d+)[×xX](\d+)/;
    const matchA = a.match(regex);
    const matchB = b.match(regex);
    if (matchA && matchB) {
      const dA = parseInt(matchA[1]), lA = parseInt(matchA[2]);
      const dB = parseInt(matchB[1]), lB = parseInt(matchB[2]);
      if (dA !== dB) return dA - dB;
      return lA - lB;
    }
    return a.localeCompare(b);
  });

  const existingMap = project.tempBoltMap || {};
  const rowsHtml = sortedFinalBolts
    .map((boltSize) => {
      const boltSeriesMatch = boltSize.match(/M\d+/);
      if (!boltSeriesMatch) return "";
      const boltSeries = boltSeriesMatch[0];
      const availableHugBolts = HUG_BOLT_SIZES[boltSeries] || [];
      const savedHugBolt = existingMap[boltSize] || "";
      const hugBoltOptions = availableHugBolts
        .map(
          (size) =>
            `<option value="${size}" ${size === savedHugBolt ? "selected" : ""}>${size}</option>`,
        )
        .join("");
      return `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <label class="font-medium text-slate-800 dark:text-slate-100">本ボルト: ${boltSize}</label>
          <select data-final-bolt="${boltSize}" class="temp-bolt-map-select w-full bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 rounded-lg p-2 focus:ring-yellow-500 focus:border-yellow-500">
            <option value="">仮ボルトを選択...</option>
            ${hugBoltOptions}
          </select>
        </div>`;
    })
    .join("");

  container.innerHTML = `<div class="space-y-3">${rowsHtml}</div>`;
};
