// ui-projects.js
// プロジェクト（工事・物件）関連のUI関数

import { state } from "./state.js";
import { openModal } from "./ui-modal.js";
import { showToast } from "./ui-notifications.js";

/**
 * カスタム入力フィールド（階層・エリア名）を動的に生成する
 * ※ openEditProjectModal から呼ばれるヘルパー関数
 */
export function generateCustomInputFields(
  count,
  container,
  baseId,
  cacheArray = [],
) {
  if (!container) return;
  container.innerHTML = "";

  const safeCache = Array.isArray(cacheArray) ? cacheArray : [];

  for (let i = 0; i < count; i++) {
    const wrapper = document.createElement("div");
    wrapper.className = "flex items-center gap-2 mb-2";

    const label = document.createElement("span");
    label.className = "text-sm text-slate-600 dark:text-slate-400 w-8";
    label.textContent = `${i + 1}:`;

    const input = document.createElement("input");
    input.type = "text";
    input.id = `${baseId}-${i}`;
    input.className =
      "input-field flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-800 dark:text-slate-100";
    input.placeholder = "名称を入力";

    input.value = safeCache[i] || "";

    input.addEventListener("input", (e) => {
      if (Array.isArray(cacheArray)) {
        cacheArray[i] = e.target.value;
      }
    });

    wrapper.appendChild(label);
    wrapper.appendChild(input);
    container.appendChild(wrapper);
  }
}

/**
 * プロジェクト編集モーダルを開く
 */
export const openEditProjectModal = (project) => {
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };
  const setCheck = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.checked = val;
  };

  setVal("edit-project-id", project.id);
  setVal("edit-project-name", project.name);
  setVal("edit-property-name", project.propertyName || "");

  const isAdvanced = project.mode === "advanced";

  const toggleWrapper = document.getElementById("edit-advanced-toggle-wrapper");
  const simpleSettings = document.getElementById(
    "edit-simple-project-settings",
  );
  const advancedSettings = document.getElementById(
    "edit-advanced-project-settings",
  );

  if (toggleWrapper) toggleWrapper.classList.add("hidden");
  if (simpleSettings) simpleSettings.classList.toggle("hidden", isAdvanced);
  if (advancedSettings)
    advancedSettings.classList.toggle("hidden", !isAdvanced);

  state.levelNameCache.length = 0;
  state.areaNameCache.length = 0;

  if (isAdvanced) {
    if (Array.isArray(project.customLevels)) {
      state.levelNameCache.push(...project.customLevels);
    }
    if (Array.isArray(project.customAreas)) {
      state.areaNameCache.push(...project.customAreas);
    }

    setVal("edit-custom-levels-count", state.levelNameCache.length);
    setVal("edit-custom-areas-count", state.areaNameCache.length);

    const levelsContainer = document.getElementById(
      "edit-custom-levels-container",
    );
    const areasContainer = document.getElementById(
      "edit-custom-areas-container",
    );

    generateCustomInputFields(
      state.levelNameCache.length,
      levelsContainer,
      "edit-level",
      state.levelNameCache,
    );
    generateCustomInputFields(
      state.areaNameCache.length,
      areasContainer,
      "edit-area",
      state.areaNameCache,
    );
  } else {
    setVal("edit-project-floors", project.floors);
    setVal("edit-project-sections", project.sections);
    setCheck("edit-project-has-ph", project.hasPH);
  }

  const modal = document.getElementById("edit-project-modal");
  openModal(modal);
};

/**
 * プロジェクトリストの描画とアクション定義を行うラッパー関数
 */
const updateProjectListUI = (
  openEditProjectModalFn,
  openConfirmDeleteModalFn,
  renderDetailViewFn,
  renderAggregatedResultsFn,
  calculateAggregatedResultsFn,
  resetMemberFormFn,
  switchViewFn,
) => {
  renderProjectList({
    onSelect: (id) => {
      const originalProject = state.projects.find((p) => p.id == id);
      if (originalProject) {
        state.currentProjectId = originalProject.id;
      }
      if (typeof resetMemberFormFn === "function") resetMemberFormFn();
      state.sort = {};
      if (typeof renderDetailViewFn === "function") renderDetailViewFn();
      switchViewFn("detail");
    },

    onEdit: (id) => {
      const project = state.projects.find((p) => p.id === id);
      if (project && typeof openEditProjectModalFn === "function") {
        openEditProjectModalFn(project);
      }
    },

    onDelete: (id) => {
      if (typeof openConfirmDeleteModalFn === "function") {
        openConfirmDeleteModalFn(id, "project");
      }
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
        if (typeof calculateAggregatedResultsFn === "function") {
          const aggregatedData = calculateAggregatedResultsFn(projectsInGroup);
          if (typeof renderAggregatedResultsFn === "function") {
            renderAggregatedResultsFn(propertyName, aggregatedData);
          }
          openModal(document.getElementById("aggregated-results-modal"));
        }
      }
    },
  });
};

/**
 * プロジェクトリストの描画
 */
export const renderProjectList = (callbacks) => {
  if (callbacks) _savedListCallbacks = callbacks;
  const currentCallbacks = callbacks || _savedListCallbacks;

  const container = document.getElementById("projects-container");
  if (!container || !currentCallbacks) return;

  if (state.projects.length === 0) {
    container.innerHTML =
      '<p class="text-center text-gray-500 py-8">工事が登録されていません。</p>';
    return;
  }

  const groups = {};
  state.projects.forEach((p) => {
    const propName = p.propertyName || "（物件名未設定）";
    if (!groups[propName]) groups[propName] = [];
    groups[propName].push(p);
  });

  const sortedGroupNames = Object.keys(groups).sort((a, b) =>
    a === "（物件名未設定）"
      ? 1
      : b === "（物件名未設定）"
        ? -1
        : a.localeCompare(b, "ja"),
  );

  let html = "";
  sortedGroupNames.forEach((groupName) => {
    const groupProjects = groups[groupName];
    html += `
      <div class="project-group mb-4 bg-white dark:bg-slate-800 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div class="flex items-center bg-slate-50 dark:bg-slate-700/30 border-b border-slate-100 dark:border-slate-700">
          <div class="accordion-trigger flex-1 flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" data-group-name="${groupName}">
            <svg class="w-5 h-5 text-yellow-500 transition-transform duration-300 group-arrow pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
            <h3 class="font-bold text-slate-800 dark:text-slate-100 truncate pointer-events-none">物件名：${groupName}</h3>
            <span class="bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 text-[10px] px-2 py-0.5 rounded-full pointer-events-none">${groupProjects.length}件</span>
          </div>

          <div class="flex items-center gap-1 px-3">
            <button class="edit-group-action-btn p-2 text-slate-500 hover:bg-white dark:hover:bg-slate-600 rounded-lg transition-colors" data-group-name="${groupName}">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pointer-events-none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="aggregate-group-action-btn p-2 text-blue-600 hover:bg-white dark:hover:bg-slate-600 rounded-lg transition-colors" data-group-name="${groupName}">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pointer-events-none"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
            </button>
          </div>
        </div>

        <div class="project-group-content transition-all duration-300 ease-in-out max-h-0 opacity-0 overflow-hidden flex flex-col divide-y divide-slate-100 dark:divide-slate-700">
          ${groupProjects
            .map(
              (p) => `
            <div class="project-item-row flex items-center p-3 hover:bg-yellow-50 dark:hover:bg-yellow-900/10 transition-colors cursor-pointer" data-id="${p.id}">
              <div class="px-2 py-1 checkbox-click-zone">
                <input type="checkbox" class="project-checkbox w-6 h-6 rounded border-slate-300 text-yellow-500 focus:ring-yellow-400 cursor-pointer" data-id="${p.id}">
              </div>
              <div class="flex-1 min-w-0 px-2 pointer-events-none">
                <h4 class="font-bold text-slate-900 dark:text-slate-100 truncate">${p.name}</h4>
              </div>
              <div class="text-slate-300 px-2 pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
              </div>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  container.querySelectorAll(".edit-group-action-btn").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      currentCallbacks.onGroupEdit(btn.dataset.groupName);
    };
  });
  container.querySelectorAll(".aggregate-group-action-btn").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      currentCallbacks.onGroupAggregate(btn.dataset.groupName);
    };
  });

  container.querySelectorAll(".accordion-trigger").forEach((trigger) => {
    trigger.onclick = () => {
      const groupDiv = trigger.closest(".project-group");
      const content = groupDiv.querySelector(".project-group-content");
      const arrow = trigger.querySelector(".group-arrow");
      const isOpening =
        content.style.maxHeight === "0px" || content.style.maxHeight === "";

      container.querySelectorAll(".project-group-content").forEach((c) => {
        c.style.maxHeight = "0px";
        c.classList.add("opacity-0");
      });
      container
        .querySelectorAll(".group-arrow")
        .forEach((a) => a.classList.remove("rotate-90"));

      if (isOpening) {
        content.style.maxHeight = content.scrollHeight + "px";
        content.classList.remove("opacity-0");
        if (arrow) arrow.classList.add("rotate-90");

        setTimeout(() => {
          const navHeight =
            document.getElementById("fixed-nav")?.offsetHeight || 0;
          const elementPosition = groupDiv.getBoundingClientRect().top;
          const offsetPosition =
            elementPosition + window.pageYOffset - navHeight - 10;

          window.scrollTo({
            top: offsetPosition,
            behavior: "smooth",
          });
        }, 50);
      }
    };
  });

  container.querySelectorAll(".project-item-row").forEach((row) => {
    row.onclick = (e) => {
      if (
        e.target.closest(".checkbox-click-zone") ||
        e.target.classList.contains("project-checkbox")
      ) {
        _updateProjectOpBar(currentCallbacks);
        return;
      }
      currentCallbacks.onSelect(row.dataset.id);
    };
  });
};

// savedListCallbacks をモジュール内で管理
let _savedListCallbacks = {};

/**
 * 物件用フローティングバーの表示更新（内部ヘルパー）
 */
function _updateProjectOpBar(callbacks) {
  const bar = document.getElementById("project-op-bar");
  const countLabel = document.getElementById("project-selection-count");
  const checkedBoxes = Array.from(
    document.querySelectorAll(".project-checkbox:checked"),
  );
  const count = checkedBoxes.length;

  if (!bar) return;

  if (count > 0) {
    if (countLabel) countLabel.textContent = count;
    bar.classList.remove("translate-y-24", "translate-y-full", "opacity-0", "pointer-events-none");

    const firstId = checkedBoxes[0].dataset.id;

    const setupBtn = (id, action, isSingleOnly) => {
      const btn = document.getElementById(id);
      if (!btn) return;

      btn.onclick = null;

      if (isSingleOnly && count !== 1) {
        btn.classList.add("hidden");
      } else {
        btn.classList.remove("hidden");
        btn.onclick = (e) => {
          e.stopPropagation();
          action(firstId);
        };
      }
    };

    setupBtn("project-edit-btn-bulk", callbacks.onEdit, true);
    setupBtn("project-copy-btn-bulk", callbacks.onDuplicate, true);
    setupBtn(
      "project-delete-btn-bulk",
      (id) => {
        if (count === 1) callbacks.onDelete(id);
        else alert("複数削除は現在1件ずつのみ対応しています。");
      },
      false,
    );
  } else {
    bar.classList.add("translate-y-24", "opacity-0", "pointer-events-none");
  }
}

/**
 * 固定ヘッダー内にプロジェクト切り替えUIを描画する
 */
export const renderProjectSwitcher = (renderDetailViewFn) => {
  const container = document.getElementById("project-switcher-container");
  if (!container) return;

  const currentProject = state.projects.find(
    (p) => p.id === state.currentProjectId,
  );
  if (!currentProject) return;

  const propertyName = currentProject.propertyName || "（物件名未設定）";
  const peers = state.projects.filter((p) => p.propertyName === propertyName);

  container.innerHTML = `
    <div class="text-[10px] text-slate-500 dark:text-slate-400 font-bold tracking-wider truncate mb-[-2px]">
      ${propertyName}
    </div>
    <div class="relative inline-block text-left">
      <button id="switcher-trigger" class="flex items-center gap-1 py-0.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors group">
        <span class="text-base font-bold text-slate-900 dark:text-slate-100 truncate max-w-[150px] sm:max-w-xs">
          ${currentProject.name}
        </span>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-slate-400 group-hover:text-yellow-500 transition-transform"><path d="m6 9 6 6 6-6"/></svg>
      </button>

      <div id="switcher-dropdown" class="absolute left-0 mt-2 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl opacity-0 pointer-events-none translate-y-2 transition-all z-50 overflow-hidden">
        <div class="p-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
          同物件内の工事
        </div>
        <div class="max-h-80 overflow-y-auto py-1">
          ${peers
            .map(
              (p) => `
            <button data-target-id="${p.id}" class="switcher-item w-full text-left px-4 py-3 text-sm ${p.id === currentProject.id ? "bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 font-bold" : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"} transition-colors flex items-center justify-between border-l-4 ${p.id === currentProject.id ? "border-yellow-500" : "border-transparent"}">
              <span class="truncate">${p.name}</span>
              ${p.id === currentProject.id ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' : ""}
            </button>
          `,
            )
            .join("")}
        </div>
      </div>
    </div>
  `;

  const trigger = document.getElementById("switcher-trigger");
  const dropdown = document.getElementById("switcher-dropdown");

  if (trigger && dropdown) {
    trigger.onclick = (e) => {
      e.stopPropagation();
      const isHidden = dropdown.classList.contains("opacity-0");
      if (isHidden) {
        dropdown.classList.remove(
          "opacity-0",
          "pointer-events-none",
          "translate-y-2",
        );
      } else {
        dropdown.classList.add(
          "opacity-0",
          "pointer-events-none",
          "translate-y-2",
        );
      }
    };

    const handleOutsideClick = (e) => {
      if (!dropdown.contains(e.target) && e.target !== trigger) {
        dropdown.classList.add(
          "opacity-0",
          "pointer-events-none",
          "translate-y-2",
        );
        document.removeEventListener("click", handleOutsideClick);
      }
    };

    trigger.addEventListener("click", () => {
      document.addEventListener("click", handleOutsideClick);
    });
  }

  container.querySelectorAll(".switcher-item").forEach((item) => {
    item.onclick = () => {
      const targetId = item.dataset.targetId;
      if (targetId === state.currentProjectId) return;
      state.activeTallyLevel = "all";
      state.activeTallyType = "all";
      state.currentProjectId = targetId;
      if (typeof renderDetailViewFn === "function") renderDetailViewFn();
      showToast(`${item.querySelector("span").textContent} へジャンプしました`);
    };
  });
};
