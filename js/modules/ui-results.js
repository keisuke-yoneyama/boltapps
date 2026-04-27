// ui-results.js
// 集計結果、注文明細、仮ボルト集計、タリーシート関連のUI関数

import { state } from "./state.js";
import {
  boltSort,
  getMasterOrderedKeys,
  getBoltWeight,
  aggregateByFloor,
  calculateAggregatedData,
  calculateTempBoltResults,
  getTallyList,
  calculateResults,
  calculateShopTempBoltResults,
  calculateAggregatedResults,
  getProjectLevels,
} from "./calculator.js";
import { showToast } from "./ui-notifications.js";
import { getJointFilterId, getJointFilterLabel, getJointCategoryColorClasses, getBoltTooltipText } from "./ui-joints.js";
import { updateProjectData } from "./db.js";

// 集計状態の変数
export let currentGroupingState = {};
export let currentViewMode = "detailed";

export let currentTempGroupingState = {};
export let currentTempViewMode = "detailed";

export function setCurrentViewMode(mode) {
  currentViewMode = mode;
}
export function resetCurrentGroupingState() {
  currentGroupingState = {};
}

export function setCurrentTempViewMode(mode) {
  currentTempViewMode = mode;
}
export function resetCurrentTempGroupingState() {
  currentTempGroupingState = {};
}

// ─── 工区まとめ設定のDB保存ヘルパー ──────────────────────────────
let _honGroupingSaveTimer = null;
let _tempGroupingSaveTimer = null;

const _saveHonGrouping = async (projectId) => {
  try {
    await updateProjectData(projectId, {
      'groupingSettings.honBolt': { ...currentGroupingState },
    });
  } catch (e) {
    console.error('[grouping] honBolt保存失敗 (non-fatal):', e);
  }
};

const _saveTempGrouping = async (projectId) => {
  try {
    await updateProjectData(projectId, {
      'groupingSettings.tempBolt': { ...currentTempGroupingState },
    });
  } catch (e) {
    console.error('[grouping] tempBolt保存失敗 (non-fatal):', e);
  }
};

// 部材アイコン（タリーシートで使用）
const memberIconSvgRaw = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`;

/**
 * データをエリア(工区)ごとに集計するヘルパー関数
 */
const aggregateTempBySection = (sourceData, project) => {
  const result = {};

  Object.keys(sourceData).forEach((locId) => {
    const parts = locId.split("-");
    const areaPart = parts[parts.length - 1];

    let sectionKey = areaPart;
    if (project.mode !== "advanced") {
      sectionKey = `${areaPart}工区`;
    } else {
      sectionKey = areaPart;
    }

    if (!result[sectionKey]) {
      result[sectionKey] = {};
    }

    const sizes = sourceData[locId];
    Object.keys(sizes).forEach((size) => {
      const srcInfo = sizes[size];
      const count =
        typeof srcInfo === "object" && srcInfo.total !== undefined
          ? srcInfo.total
          : srcInfo;

      const existing = result[sectionKey][size] || { total: 0, joints: {} };
      const merged = { total: existing.total + count, joints: { ...existing.joints } };
      if (typeof srcInfo === "object" && srcInfo.joints) {
        Object.entries(srcInfo.joints).forEach(([n, c]) => {
          merged.joints[n] = (merged.joints[n] || 0) + c;
        });
      }
      result[sectionKey][size] = merged;
    });
  });

  return result;
};

/**
 * 工区まとめ設定UIを描画する関数
 */
export function renderGroupingControls(
  container,
  originalResults,
  project,
  onUpdate,
  targetState,
  targetViewMode,
  customKeys = null,
  onPersist = null,
) {
  if (!container) return;

  const existingDetails = container.querySelector("details");
  const wasOpen = existingDetails ? existingDetails.open : false;

  container.innerHTML = "";

  if (targetViewMode === "floor") {
    container.style.display = "none";
    return;
  }
  container.style.display = "block";

  let targetKeys;

  if (customKeys && Array.isArray(customKeys)) {
    targetKeys = customKeys.filter((k) => originalResults[k]);
  } else {
    const masterKeys = getMasterOrderedKeys(project);
    targetKeys = masterKeys.filter((k) => originalResults[k]);
  }

  const details = document.createElement("details");
  details.className =
    "mb-6 bg-blue-50 dark:bg-slate-800/60 rounded-xl border border-blue-100 dark:border-slate-700 shadow-sm group";
  details.open = wasOpen;

  const summary = document.createElement("summary");
  summary.className =
    "flex items-center justify-between p-4 cursor-pointer list-none select-none hover:bg-blue-100/50 dark:hover:bg-slate-700/50 rounded-xl transition-colors";

  summary.innerHTML = `
        <div class="flex items-center gap-3">
            <div class="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
            </div>
            <div>
                <h4 class="text-sm font-bold text-slate-800 dark:text-slate-100">工区まとめ設定</h4>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    詳細モード用：同じ番号を選択した工区を合算します
                </p>
            </div>
        </div>
        <div class="transform transition-transform duration-200 group-open:rotate-180 text-slate-400">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
        </div>
    `;

  const content = document.createElement("div");
  content.className =
    "px-4 pb-4 border-t border-blue-100 dark:border-slate-700 pt-4";

  const actionArea = document.createElement("div");
  actionArea.className = "flex justify-end mb-3";

  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className =
    "px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors text-slate-600 dark:text-slate-300 flex items-center gap-1";
  resetBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        設定をリセット
    `;

  resetBtn.onclick = (e) => {
    e.stopPropagation();
    targetKeys.forEach((key, index) => {
      targetState[key] = index + 1;
    });
    onUpdate();
    if (onPersist) onPersist();
  };

  actionArea.appendChild(resetBtn);
  content.appendChild(actionArea);

  const controlsGrid = document.createElement("div");
  controlsGrid.className = "flex flex-wrap gap-2";

  const maxOptions = targetKeys.length;

  targetKeys.forEach((section) => {
    const item = document.createElement("div");
    item.className =
      "w-28 bg-white dark:bg-slate-800 p-2 rounded-lg border border-gray-200 dark:border-slate-600 flex flex-col";

    const label = document.createElement("span");
    label.className =
      "text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 truncate text-center";
    label.textContent = section;
    label.title = section;

    const select = document.createElement("select");
    select.className =
      "w-full text-sm py-1 px-1 bg-gray-50 dark:bg-slate-700 border-gray-300 dark:border-slate-500 rounded focus:ring-blue-500 focus:border-blue-500 dark:text-white cursor-pointer text-center";

    for (let i = 1; i <= maxOptions; i++) {
      const option = document.createElement("option");
      option.value = i;
      option.textContent = `No.${i}`;
      if (targetState[section] === i) {
        option.selected = true;
      }
      select.appendChild(option);
    }

    select.addEventListener("change", (e) => {
      targetState[section] = Number(e.target.value);
      onUpdate();
      if (onPersist) onPersist();
    });

    select.addEventListener("click", (e) => e.stopPropagation());

    item.appendChild(label);
    item.appendChild(select);
    controlsGrid.appendChild(item);
  });

  content.appendChild(controlsGrid);
  details.appendChild(summary);
  details.appendChild(content);
  container.appendChild(details);
}

/**
 * テーブル群を描画する関数（汎用版）
 */
export function renderAggregatedTables(
  container,
  aggregatedCounts,
  sortedKeys,
  specialBolts = {},
  onlySpecial = false,
  isTempBolt = false,
) {
  container.innerHTML = "";

  const renderTableHtml = (title, data, color, customHeader = null) => {
    if (!data || Object.keys(data).length === 0) return "";

    let headers = "";
    if (customHeader) {
      headers = customHeader;
    } else {
      const weightHeader = !isTempBolt
        ? `<th class="px-4 py-2 border border-${color}-300 dark:border-slate-600 text-center bg-${color}-200 dark:bg-slate-700 text-${color}-800 dark:text-${color}-200 whitespace-nowrap">重量(kg)</th>`
        : "";

      headers = `<tr>
            <th class="px-4 py-2 border border-${color}-300 dark:border-slate-600 text-center bg-${color}-200 dark:bg-slate-700 text-${color}-800 dark:text-${color}-200 whitespace-nowrap">種別</th>
            <th class="px-4 py-2 border border-${color}-300 dark:border-slate-600 text-center bg-${color}-200 dark:bg-slate-700 text-${color}-800 dark:text-${color}-200 whitespace-nowrap">ボルトサイズ</th>
            <th class="px-4 py-2 border border-${color}-300 dark:border-slate-600 text-center bg-${color}-200 dark:bg-slate-700 text-${color}-800 dark:text-${color}-200 whitespace-nowrap">本数</th>
            ${weightHeader}
        </tr>`;
    }

    let body = "";
    let tableTotalWeight = 0;

    Object.keys(data)
      .sort(boltSort)
      .forEach((key) => {
        const rawValue = data[key];
        const boltCount =
          typeof rawValue === "object" &&
          rawValue !== null &&
          rawValue.total !== undefined
            ? rawValue.total
            : rawValue;

        let rowWeightKg = 0;
        let weightValue = "-";
        let weightTooltip = "";

        if (!isTempBolt) {
          const singleWeightG = getBoltWeight(key);
          rowWeightKg = (boltCount * singleWeightG) / 1000;
          tableTotalWeight += rowWeightKg;

          weightValue = rowWeightKg > 0 ? rowWeightKg.toFixed(1) : "-";
          weightTooltip =
            singleWeightG > 0 ? `単体重量: ${singleWeightG} g` : "";
        }

        let type = "-";
        if (!isTempBolt) {
          type = key.includes("■") ? "F8T" : "S10T";
        }

        const commonCellClass = `px-4 py-2 border border-${color}-200 dark:border-slate-700 text-center`;

        const hasJoints =
          typeof rawValue === "object" &&
          rawValue !== null &&
          rawValue.joints &&
          Object.keys(rawValue.joints).length > 0;
        const qtyMapJson = (hasJoints && rawValue.qtyMap) ? JSON.stringify(rawValue.qtyMap).replace(/'/g, "&#39;") : "{}";
        const detailsAttr = hasJoints
          ? ` data-details='${JSON.stringify(rawValue.joints).replace(/'/g, "&#39;")}' data-bolt-size="${key}" data-qty='${qtyMapJson}'`
          : "";
        const detailsClass = hasJoints ? " has-details cursor-pointer" : "";

        let rowContent = "";
        if (customHeader) {
          rowContent = `
                    <td class="${commonCellClass}">${key}</td>
                    <td class="${commonCellClass} font-medium${detailsClass}"${detailsAttr}>${boltCount.toLocaleString()}</td>
                `;
        } else {
          const displayKey = title === "柱用" ? key.replace("(本柱)", "") : key;

          const weightCell = !isTempBolt
            ? `<td class="${commonCellClass} text-slate-500" title="${weightTooltip}">${weightValue}</td>`
            : "";

          rowContent = `
                    <td class="${commonCellClass}">${type}</td>
                    <td class="${commonCellClass}">${displayKey}</td>
                    <td class="${commonCellClass} font-medium${detailsClass}"${detailsAttr}>${boltCount.toLocaleString()}</td>
                    ${weightCell}
                `;
        }

        body += `<tr class="hover:bg-${color}-50 dark:hover:bg-slate-700/50">${rowContent}</tr>`;
      });

    const totalWeightDisplay =
      !isTempBolt && !customHeader && tableTotalWeight > 0
        ? `<span class="ml-auto text-sm font-bold text-red-600 dark:text-red-400">合計: ${tableTotalWeight.toFixed(
            1,
          )} kg</span>`
        : "";

    return `
            <div class="min-w-[320px] flex-grow-0 flex-shrink-0 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden mb-6">
                <div class="px-4 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <h3 class="text-lg font-bold text-slate-800 dark:text-slate-200 truncate pr-2" title="${title}">${title}</h3>
                    ${totalWeightDisplay}
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-sm border-collapse">
                        <tbody>${headers}${body}</tbody>
                    </table>
                </div>
            </div>`;
  };

  let tablesHtml = "";

  if (!onlySpecial && aggregatedCounts) {
    const keysToRender = sortedKeys || Object.keys(aggregatedCounts);

    keysToRender.forEach((groupName) => {
      if (aggregatedCounts[groupName]) {
        const headerColor = isTempBolt ? "teal" : "slate";
        tablesHtml += renderTableHtml(
          groupName,
          aggregatedCounts[groupName],
          headerColor,
        );
      }
    });

    if (sortedKeys) {
      Object.keys(aggregatedCounts).forEach((key) => {
        if (!sortedKeys.includes(key)) {
          const headerColor = isTempBolt ? "teal" : "slate";
          tablesHtml += renderTableHtml(
            key,
            aggregatedCounts[key],
            headerColor,
          );
        }
      });
    }
  }

  if (specialBolts) {
    if (specialBolts.column) {
      tablesHtml += renderTableHtml("柱用", specialBolts.column, "purple");
    }

    const simpleHeader = (color) => `<tr>
            <th class="px-4 py-2 border border-${color}-300 dark:border-slate-600 text-center bg-${color}-200 dark:bg-slate-700 text-${color}-800 dark:text-${color}-200 whitespace-nowrap">ボルトサイズ</th>
            <th class="px-4 py-2 border border-${color}-300 dark:border-slate-600 text-center bg-${color}-200 dark:bg-slate-700 text-${color}-800 dark:text-${color}-200 whitespace-nowrap">本数</th>
        </tr>`;

    if (specialBolts.dLock) {
      tablesHtml += renderTableHtml(
        "D-Lock",
        specialBolts.dLock,
        "gray",
        simpleHeader("gray"),
      );
    }
    if (specialBolts.naka) {
      tablesHtml += renderTableHtml(
        "中ボルト(ミリ)",
        specialBolts.naka,
        "blue",
        simpleHeader("blue"),
      );
    }
    if (specialBolts.nakaM) {
      tablesHtml += renderTableHtml(
        "中ボルト(Mネジ)",
        specialBolts.nakaM,
        "teal",
        simpleHeader("teal"),
      );
    }
  }

  if (tablesHtml === "") {
    container.innerHTML =
      '<p class="text-gray-500 w-full p-4">データがありません</p>';
  } else {
    container.innerHTML = tablesHtml;
  }
}

/**
 * 注文詳細画面の描画
 */
export const renderOrderDetails = (container, project, resultsByLocation) => {
  if (!container) return;
  if (!project) {
    container.innerHTML = "";
    return;
  }

  try {
    container.innerHTML = "";

    const masterKeys = getMasterOrderedKeys(project);
    const targetKeys = new Set(masterKeys.filter((k) => resultsByLocation[k]));

    const filteredHonBolts = {};
    const specialBolts = {
      column: {},
      shopGroundAssembly: {},
      groundAssembly: {},
      dLock: {},
      naka: {},
      nakaM: {},
    };

    masterKeys.forEach((locId) => {
      if (!targetKeys.has(locId)) return;
      const locationData = resultsByLocation[locId];

      filteredHonBolts[locId] = {};

      Object.keys(locationData).forEach((size) => {
        const data = locationData[size];

        const mergeSpecial = (target, key, srcData) => {
          const ex = target[key] || { total: 0, joints: {}, qtyMap: {} };
          const merged = { total: ex.total + (srcData.total || 0), joints: { ...ex.joints }, qtyMap: { ...(ex.qtyMap || {}) } };
          if (srcData.joints) {
            Object.entries(srcData.joints).forEach(([n, c]) => {
              merged.joints[n] = (merged.joints[n] || 0) + c;
            });
          }
          if (srcData.qtyMap) {
            Object.entries(srcData.qtyMap).forEach(([n, q]) => {
              merged.qtyMap[n] = (merged.qtyMap[n] || 0) + q;
            });
          }
          target[key] = merged;
        };

        if (size.includes("(本柱)")) {
          mergeSpecial(specialBolts.column, size, data);
        } else if (size.includes("(工場地組)")) {
          mergeSpecial(specialBolts.shopGroundAssembly, size.replace("(工場地組)", ""), data);
        } else if (size.includes("(地組)")) {
          mergeSpecial(specialBolts.groundAssembly, size.replace("(地組)", ""), data);
        } else if (size.startsWith("D")) {
          mergeSpecial(specialBolts.dLock, size, data);
        } else if (size.startsWith("中ボ")) {
          mergeSpecial(specialBolts.nakaM, size, data);
        } else if (size.startsWith("中")) {
          mergeSpecial(specialBolts.naka, size, data);
        } else {
          filteredHonBolts[locId][size] = data;
        }
      });

      if (Object.keys(filteredHonBolts[locId]).length === 0) {
        delete filteredHonBolts[locId];
      }
    });

    const honBoltSection = document.createElement("section");
    honBoltSection.className = "mb-16";
    container.appendChild(honBoltSection);

    const shopGroundAssemblySection = document.createElement("section");
    shopGroundAssemblySection.className = "mb-16";
    container.appendChild(shopGroundAssemblySection);

    const groundAssemblySection = document.createElement("section");
    groundAssemblySection.className = "mb-16";
    container.appendChild(groundAssemblySection);

    const dLockSection = document.createElement("section");
    dLockSection.className = "mb-16";
    container.appendChild(dLockSection);

    const nakaBoltSection = document.createElement("section");
    nakaBoltSection.className = "mb-16";
    container.appendChild(nakaBoltSection);

    const renderHonBoltSection = () => {
      const hasHonBolts = Object.keys(filteredHonBolts).length > 0;
      const hasColumnBolts = Object.keys(specialBolts.column).length > 0;

      if (!hasHonBolts && !hasColumnBolts) {
        honBoltSection.style.display = "none";
        return;
      }
      honBoltSection.style.display = "block";
      honBoltSection.innerHTML = "";

      const dataKeys = Object.keys(filteredHonBolts);
      const shouldReset = dataKeys.some(
        (sec) => !currentGroupingState.hasOwnProperty(sec),
      );
      if (shouldReset) {
        for (const key in currentGroupingState)
          delete currentGroupingState[key];

        const savedHon = project.groupingSettings?.honBolt;
        if (savedHon && dataKeys.some((k) => savedHon[k] !== undefined)) {
          dataKeys.forEach((section, index) => {
            currentGroupingState[section] = savedHon[section] ?? (index + 1);
          });
        } else {
          dataKeys.forEach((section, index) => {
            currentGroupingState[section] = index + 1;
          });
        }
      }

      const headerHtml = `
                <div class="flex flex-col md:flex-row justify-between items-start md:items-end mt-8 mb-10 border-b-2 border-pink-500 pb-4 gap-4">
                    <div>
                        <h2 class="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <span class="text-pink-500">■</span> 本ボルト注文明細
                        </h2>
                        <p class="text-sm text-slate-500 dark:text-slate-400 pl-6 mt-1">S10T / F8T / 柱用ボルト</p>
                    </div>

                    <div class="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                        <button id="view-mode-detailed" type="button" class="px-4 py-2 text-sm font-medium rounded-md transition-all">工区別 (詳細)</button>
                        <button id="view-mode-floor" type="button" class="px-4 py-2 text-sm font-medium rounded-md transition-all">フロア別 (集計)</button>
                    </div>
                </div>
            `;
      honBoltSection.insertAdjacentHTML("beforeend", headerHtml);

      const controlsContainer = document.createElement("div");
      honBoltSection.appendChild(controlsContainer);

      const tableContainer = document.createElement("div");
      tableContainer.className =
        "flex flex-wrap gap-8 items-start align-top content-start";
      honBoltSection.appendChild(tableContainer);

      const updateView = () => {
        const btnDetail = honBoltSection.querySelector("#view-mode-detailed");
        const btnFloor = honBoltSection.querySelector("#view-mode-floor");
        const activeClass =
          "bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400";
        const inactiveClass =
          "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300";

        if (currentViewMode === "detailed") {
          btnDetail.className = `px-4 py-2 text-sm font-medium rounded-md transition-all ${activeClass}`;
          btnFloor.className = `px-4 py-2 text-sm font-medium rounded-md transition-all ${inactiveClass}`;
        } else {
          btnDetail.className = `px-4 py-2 text-sm font-medium rounded-md transition-all ${inactiveClass}`;
          btnFloor.className = `px-4 py-2 text-sm font-medium rounded-md transition-all ${activeClass}`;
        }

        renderGroupingControls(
          controlsContainer,
          filteredHonBolts,
          project,
          updateView,
          currentGroupingState,
          currentViewMode,
          null,
          () => {
            clearTimeout(_honGroupingSaveTimer);
            _honGroupingSaveTimer = setTimeout(() => _saveHonGrouping(project.id), 600);
          },
        );

        let data, sortedKeys;
        if (currentViewMode === "floor") {
          const result = aggregateByFloor(filteredHonBolts, project);
          data = result.data;
          sortedKeys = result.order;
        } else {
          data = calculateAggregatedData(
            filteredHonBolts,
            currentGroupingState,
            project,
          );
          const allAggregatedKeys = Object.keys(data);
          const fullMasterList = getMasterOrderedKeys(project);
          sortedKeys = allAggregatedKeys.sort((a, b) => {
            const firstKeyA = a.split(" + ")[0];
            const firstKeyB = b.split(" + ")[0];
            return (
              fullMasterList.indexOf(firstKeyA) -
              fullMasterList.indexOf(firstKeyB)
            );
          });
        }

        renderAggregatedTables(tableContainer, data, sortedKeys, {
          column: specialBolts.column,
        });
      };

      honBoltSection.querySelector("#view-mode-detailed").onclick = () => {
        setCurrentViewMode("detailed");
        updateView();
      };
      honBoltSection.querySelector("#view-mode-floor").onclick = () => {
        setCurrentViewMode("floor");
        updateView();
      };

      updateView();
    };

    const renderGroundAssemblySection = (section, data, title, borderColor, markerColor) => {
      if (Object.keys(data).length === 0) {
        section.style.display = "none";
        return;
      }
      section.style.display = "block";
      section.innerHTML = `
        <div class="mt-12 mb-10 border-b-2 ${borderColor} pb-4">
          <h2 class="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span class="${markerColor}">■</span> ${title}
          </h2>
        </div>`;
      const tableContainer = document.createElement("div");
      tableContainer.className = "flex flex-wrap gap-8 items-start align-top";
      section.appendChild(tableContainer);
      renderAggregatedTables(tableContainer, { [title]: data }, [title], {});
    };

    const renderDLockSection = () => {
      if (Object.keys(specialBolts.dLock).length === 0) {
        dLockSection.style.display = "none";
        return;
      }
      dLockSection.style.display = "block";

      const headerHtml = `
                <div class="mt-12 mb-10 border-b-2 border-gray-500 pb-4">
                    <h2 class="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <span class="text-gray-500">■</span> D-Lock 注文明細
                    </h2>
                </div>
            `;
      dLockSection.innerHTML = headerHtml;

      const tableContainer = document.createElement("div");
      tableContainer.className = "flex flex-wrap gap-8 items-start align-top";
      dLockSection.appendChild(tableContainer);

      renderAggregatedTables(
        tableContainer,
        {},
        [],
        { dLock: specialBolts.dLock },
        true,
      );
    };

    const renderNakaBoltSection = () => {
      const hasNaka = Object.keys(specialBolts.naka).length > 0;
      const hasNakaM = Object.keys(specialBolts.nakaM).length > 0;
      if (!hasNaka && !hasNakaM) {
        nakaBoltSection.style.display = "none";
        return;
      }
      nakaBoltSection.style.display = "block";

      const headerHtml = `
                <div class="mt-12 mb-10 border-b-2 border-blue-500 pb-4">
                    <h2 class="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <span class="text-blue-500">■</span> 中ボルト注文明細
                    </h2>
                </div>
            `;
      nakaBoltSection.innerHTML = headerHtml;

      const tableContainer = document.createElement("div");
      tableContainer.className = "flex flex-wrap gap-8 items-start align-top";
      nakaBoltSection.appendChild(tableContainer);

      renderAggregatedTables(
        tableContainer,
        {},
        [],
        { naka: specialBolts.naka, nakaM: specialBolts.nakaM },
        true,
      );
    };

    renderHonBoltSection();
    renderGroundAssemblySection(
      shopGroundAssemblySection,
      specialBolts.shopGroundAssembly,
      "工場地組み用 注文明細",
      "border-orange-500",
      "text-orange-500",
    );
    renderGroundAssemblySection(
      groundAssemblySection,
      specialBolts.groundAssembly,
      "地組み用 注文明細",
      "border-violet-500",
      "text-violet-500",
    );
    renderDLockSection();
    renderNakaBoltSection();
  } catch (err) {
    console.error("renderOrderDetailsエラー:", err);
    container.innerHTML = `<div class="p-4 bg-red-100 text-red-700">表示エラー: ${err.message}</div>`;
  }
};

/**
 * 仮ボルト注文詳細画面の描画
 */
export const renderTempOrderDetails = (
  container,
  project,
  tempResultsByLocation,
) => {
  if (!container) return;
  if (!project || !tempResultsByLocation) {
    container.innerHTML = "";
    return;
  }

  try {
    container.innerHTML = "";

    const masterKeys = getMasterOrderedKeys(project);
    const targetKeys = new Set(
      masterKeys.filter((k) => tempResultsByLocation[k]),
    );
    const filteredTempBolts = {};

    masterKeys.forEach((locId) => {
      if (!targetKeys.has(locId)) return;
      const locationData = tempResultsByLocation[locId];
      filteredTempBolts[locId] = {};
      Object.keys(locationData).forEach((size) => {
        filteredTempBolts[locId][size] = locationData[size];
      });
      if (Object.keys(filteredTempBolts[locId]).length === 0) {
        delete filteredTempBolts[locId];
      }
    });

    if (Object.keys(filteredTempBolts).length === 0) return;

    const tempBoltSection = document.createElement("section");
    tempBoltSection.className = "mb-16";
    container.appendChild(tempBoltSection);

    const headerHtml = `
        <div class="flex flex-col md:flex-row justify-between items-start md:items-end mt-8 mb-10 border-b-2 border-teal-500 pb-4 gap-4">
            <div>
                <h2 class="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span class="text-teal-500">■</span> 仮ボルト注文明細
                </h2>
                <p class="text-sm text-slate-500 dark:text-slate-400 pl-6 mt-1">現場建方用ボルト</p>
            </div>
            <div class="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                <button id="temp-view-mode-detailed" type="button" class="px-4 py-2 text-sm font-medium rounded-md transition-all">工区別 (詳細)</button>
                <button id="temp-view-mode-section" type="button" class="px-4 py-2 text-sm font-medium rounded-md transition-all">工区別 (集計)</button>
                <button id="temp-view-mode-floor" type="button" class="px-4 py-2 text-sm font-medium rounded-md transition-all">フロア別 (集計)</button>
            </div>
        </div>
    `;
    tempBoltSection.insertAdjacentHTML("beforeend", headerHtml);

    const controlsContainer = document.createElement("div");
    tempBoltSection.appendChild(controlsContainer);

    const tableContainer = document.createElement("div");
    tableContainer.className =
      "flex flex-wrap gap-8 items-start align-top content-start";
    tempBoltSection.appendChild(tableContainer);

    const calculateLocalAggregation = (source, stateObj) => {
      const result = {};
      const groups = {};

      Object.keys(stateObj).forEach((key) => {
        if (source[key]) {
          const groupNum = stateObj[key];
          if (!groups[groupNum]) groups[groupNum] = [];
          groups[groupNum].push(key);
        }
      });

      Object.keys(groups).forEach((groupNum) => {
        const keys = groups[groupNum];
        const label = `No.${groupNum} (${keys.join(", ")})`;
        result[label] = {};

        keys.forEach((key) => {
          const sizes = source[key];
          Object.keys(sizes).forEach((size) => {
            const srcInfo = sizes[size];
            const qty =
              typeof srcInfo === "object" && srcInfo.total !== undefined
                ? srcInfo.total
                : srcInfo;
            const existing = result[label][size] || { total: 0, joints: {} };
            const merged = { total: existing.total + qty, joints: { ...existing.joints } };
            if (typeof srcInfo === "object" && srcInfo.joints) {
              Object.entries(srcInfo.joints).forEach(([n, c]) => {
                merged.joints[n] = (merged.joints[n] || 0) + c;
              });
            }
            result[label][size] = merged;
          });
        });
      });
      return result;
    };

    const updateView = () => {
      const validModes = ["detailed", "section", "floor"];
      if (!validModes.includes(currentTempViewMode))
        currentTempViewMode = "detailed";

      const activeClass =
        "bg-white dark:bg-slate-700 shadow text-teal-600 dark:text-teal-400";
      const inactiveClass =
        "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300";

      const btnMap = {
        detailed: tempBoltSection.querySelector("#temp-view-mode-detailed"),
        section: tempBoltSection.querySelector("#temp-view-mode-section"),
        floor: tempBoltSection.querySelector("#temp-view-mode-floor"),
      };
      Object.keys(btnMap).forEach((key) => {
        if (btnMap[key])
          btnMap[key].className =
            `px-4 py-2 text-sm font-medium rounded-md transition-all ${currentTempViewMode === key ? activeClass : inactiveClass}`;
      });

      let dataForControls = {};
      let customKeysForControls = null;

      if (currentTempViewMode === "section") {
        dataForControls = aggregateTempBySection(filteredTempBolts, project);

        if (project.mode === "advanced") {
          customKeysForControls = [...project.customAreas].sort();
        } else {
          customKeysForControls = Array.from(
            { length: project.sections },
            (_, i) => `${i + 1}工区`,
          );
        }
      } else if (currentTempViewMode === "detailed") {
        dataForControls = filteredTempBolts;
        customKeysForControls = null;
      }

      const currentDataKeys = Object.keys(dataForControls);
      const stateKeys = Object.keys(currentTempGroupingState);

      const needReset =
        stateKeys.length > 0 &&
        currentDataKeys.length > 0 &&
        !stateKeys.some((k) => currentDataKeys.includes(k));
      const needInit = stateKeys.length === 0 && currentDataKeys.length > 0;

      if (needReset || needInit) {
        for (const key in currentTempGroupingState)
          delete currentTempGroupingState[key];

        const keysToInit = customKeysForControls
          ? customKeysForControls.filter((k) => dataForControls[k])
          : getMasterOrderedKeys(project).filter((k) => dataForControls[k]);

        const savedTemp = project.groupingSettings?.tempBolt;
        if (savedTemp && keysToInit.some((k) => savedTemp[k] !== undefined)) {
          keysToInit.forEach((key, index) => {
            currentTempGroupingState[key] = savedTemp[key] ?? (index + 1);
          });
        } else {
          keysToInit.forEach((key, index) => {
            currentTempGroupingState[key] = index + 1;
          });
        }
      }

      renderGroupingControls(
        controlsContainer,
        dataForControls,
        project,
        updateView,
        currentTempGroupingState,
        currentTempViewMode,
        customKeysForControls,
        () => {
          clearTimeout(_tempGroupingSaveTimer);
          _tempGroupingSaveTimer = setTimeout(() => _saveTempGrouping(project.id), 600);
        },
      );

      let dataToRender, sortedKeysToRender;

      if (currentTempViewMode === "floor") {
        const result = aggregateByFloor(filteredTempBolts, project);
        dataToRender = result.data;
        sortedKeysToRender = result.order;
      } else {
        dataToRender = calculateLocalAggregation(
          dataForControls,
          currentTempGroupingState,
        );

        const allAggregatedKeys = Object.keys(dataToRender);
        sortedKeysToRender = allAggregatedKeys.sort((a, b) => {
          const numA = parseInt(a.match(/No\.(\d+)/)?.[1] || "0");
          const numB = parseInt(b.match(/No\.(\d+)/)?.[1] || "0");
          return numA - numB;
        });
      }

      renderAggregatedTables(
        tableContainer,
        dataToRender,
        sortedKeysToRender,
        {},
        false,
        true,
      );
    };

    const setMode = (mode) => {
      if (currentTempViewMode !== mode) {
        for (const key in currentTempGroupingState)
          delete currentTempGroupingState[key];
      }
      setCurrentTempViewMode(mode);
      updateView();
    };

    const btnDetail = tempBoltSection.querySelector("#temp-view-mode-detailed");
    const btnSection = tempBoltSection.querySelector("#temp-view-mode-section");
    const btnFloor = tempBoltSection.querySelector("#temp-view-mode-floor");

    if (btnDetail) btnDetail.onclick = () => setMode("detailed");
    if (btnSection) btnSection.onclick = () => setMode("section");
    if (btnFloor) btnFloor.onclick = () => setMode("floor");

    updateView();
  } catch (err) {
    console.error("renderTempOrderDetailsエラー:", err);
    container.innerHTML = `<div class="p-4 bg-red-100 text-red-700">表示エラー: ${err.message}</div>`;
  }
};

/**
 * 仮ボルト集計結果のHTML文字列を生成して返す
 */
export const renderTempBoltResults = (project) => {
  const { resultsByLocation } = calculateTempBoltResults(project);

  const targetLocationIds = new Set();
  let locations = [];

  if (project.mode === "advanced") {
    project.customLevels.forEach((level) => {
      if (state.activeTallyLevel !== "all" && state.activeTallyLevel !== level)
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
      if (state.activeTallyLevel !== "all" && state.activeTallyLevel !== lvlStr)
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
      if (state.activeTallyLevel === "all" || state.activeTallyLevel === "PH") {
        for (let s = 1; s <= project.sections; s++) {
          const id = `PH-${s}`;
          locations.push({ id, label: `PH階 ${s}工区` });
          targetLocationIds.add(id);
        }
      }
    }
  }

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

  let floorTable = `<div id="anchor-temp-bolt" data-section-title="仮ボルト集計：フロア工区別" data-section-color="green" class="scroll-mt-24">
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
    const grandTotalQtyMap = {};
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
        const qtyJson = JSON.stringify(cellData.qtyMap || {});
        dataAttribute = `data-details='${JSON.stringify(cellData.joints)}' data-qty='${qtyJson}'`;
        for (const [name, count] of Object.entries(cellData.joints)) {
          grandTotalJoints[name] = (grandTotalJoints[name] || 0) + count;
        }
        if (cellData.qtyMap) {
          for (const [name, qty] of Object.entries(cellData.qtyMap)) {
            grandTotalQtyMap[name] = (grandTotalQtyMap[name] || 0) + qty;
          }
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
    const hasGrandTotalJoints = Object.keys(grandTotalJoints).length > 0;
    const grandTotalDetailsClass = hasGrandTotalJoints
      ? "has-details cursor-pointer hover:bg-yellow-200 dark:hover:bg-yellow-700/50 transition-colors"
      : "";
    const grandTotalDataAttribute = hasGrandTotalJoints
      ? `data-details='${JSON.stringify(grandTotalJoints)}' data-qty='${JSON.stringify(grandTotalQtyMap)}'`
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

/**
 * 工場仮ボルト集計結果のHTMLを生成して返す
 */
export const renderShopTempBoltResults = (project) => {
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
            </div>`;
};

/**
 * 数量入力シート（Tally Sheet）を描画する
 */
export const renderTallySheet = (project, renderResultsFn) => {
  if (!project) return;

  const tallySheetContainer = document.getElementById("tally-sheet-container");
  const floorTabs = document.getElementById("tally-floor-tabs");
  const typeTabs = document.getElementById("tally-type-tabs");
  const tallyCard = document.getElementById("tally-card");
  const resultsCard = document.getElementById("results-card");

  if (!tallySheetContainer || !floorTabs) return;

  if (!state.activeTallyLevel) state.activeTallyLevel = "all";
  if (!state.activeTallyType) state.activeTallyType = "all";

  const allItems = getTallyList(project);

  const levels = getProjectLevels(project);
  let floorHtml = `<button class="tally-tab-btn px-4 py-1.5 rounded-full text-sm font-bold border transition-all ${
    state.activeTallyLevel === "all"
      ? "bg-blue-600 text-white border-blue-600 shadow-md"
      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
  }" data-level="all">全表示</button>`;

  levels.forEach((lvl) => {
    const active = state.activeTallyLevel === lvl.id;
    floorHtml += `<button class="tally-tab-btn px-4 py-1.5 rounded-full text-sm font-bold border transition-all ${
      active
        ? "bg-blue-600 text-white border-blue-600 shadow-md"
        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600"
    }" data-level="${lvl.id}">${lvl.label}</button>`;
  });
  floorTabs.innerHTML = floorHtml;

  const jointTypeOrder = [
    "girder",
    "girder_pin",
    "beam",
    "beam_pin",
    "column",
    "stud",
    "stud_pin",
    "wall_girt",
    "roof_purlin",
    "other",
    "other_pin",
  ];

  const uniqueFilterIds = [
    ...new Set(allItems.map((item) => getJointFilterId(item.joint))),
  ].sort((a, b) => {
    const indexA = jointTypeOrder.indexOf(a);
    const indexB = jointTypeOrder.indexOf(b);
    const finalA = indexA === -1 ? 999 : indexA;
    const finalB = indexB === -1 ? 999 : indexB;
    return finalA - finalB;
  });

  let typeHtml = `<button class="tally-type-tab-btn px-4 py-1.5 rounded-full text-sm font-bold border transition-all ${
    state.activeTallyType === "all"
      ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600 hover:bg-slate-100"
  }" data-type="all">全種別</button>`;

  uniqueFilterIds.forEach((fid) => {
    const active = state.activeTallyType === fid;
    typeHtml += `<button class="tally-type-tab-btn px-4 py-1.5 rounded-full text-sm font-bold border transition-all ${
      active
        ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300"
    }" data-type="${fid}">${getJointFilterLabel(fid)}</button>`;
  });

  if (typeTabs) typeTabs.innerHTML = typeHtml;

  floorTabs.querySelectorAll(".tally-tab-btn").forEach((btn) => {
    btn.onclick = () => {
      state.activeTallyLevel = btn.dataset.level;
      renderTallySheet(project, renderResultsFn);
      if (typeof renderResultsFn === "function") renderResultsFn(project);
    };
  });
  if (typeTabs) {
    typeTabs.querySelectorAll(".tally-type-tab-btn").forEach((btn) => {
      btn.onclick = () => {
        state.activeTallyType = btn.dataset.type;
        renderTallySheet(project, renderResultsFn);
        if (typeof renderResultsFn === "function") renderResultsFn(project);
      };
    });
  }

  const displayItems = allItems.filter((item) => {
    const isCommon = !item.targetLevels || item.targetLevels.length === 0;
    const matchLevel =
      state.activeTallyLevel === "all" ||
      !item.isMember ||
      isCommon ||
      item.targetLevels.includes(state.activeTallyLevel);
    const matchType =
      state.activeTallyType === "all" ||
      getJointFilterId(item.joint) === state.activeTallyType;
    return matchLevel && matchType;
  });

  if (displayItems.length === 0) {
    tallySheetContainer.innerHTML =
      '<p class="text-gray-500 p-12 text-center bg-slate-50 dark:bg-slate-800/50 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 font-bold">表示条件に合う部材がありません。</p>';
    if (resultsCard) resultsCard.classList.add("hidden");
    return;
  }

  let locations = [];
  if (project.mode === "advanced") {
    project.customLevels.forEach((lvl) => {
      if (state.activeTallyLevel !== "all" && state.activeTallyLevel !== lvl)
        return;
      project.customAreas.forEach((area) =>
        locations.push({ id: `${lvl}-${area}`, label: `${lvl}-${area}` }),
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
        locations.push({ id: `${f}-${s}`, label: `${f}階 ${s}工区` });
    }
    if (state.activeTallyLevel === "all" || state.activeTallyLevel === "R") {
      for (let s = 1; s <= project.sections; s++)
        locations.push({ id: `R-${s}`, label: `R階 ${s}工区` });
    }
    if (
      project.hasPH &&
      (state.activeTallyLevel === "all" || state.activeTallyLevel === "PH")
    ) {
      for (let s = 1; s <= project.sections; s++)
        locations.push({ id: `PH-${s}`, label: `PH階 ${s}工区` });
    }
  }

  const locks = project.tallyLocks || {};

  const lockRow = displayItems
    .map((item) => {
      const colorClass = getJointCategoryColorClasses(item.joint);
      return `<td class="px-2 py-1 text-center border border-slate-300 dark:border-slate-600 ${colorClass}">
              <input type="checkbox" class="tally-lock-checkbox h-4 w-4 rounded cursor-pointer" data-id="${item.id}" ${locks[item.id] ? "checked" : ""}>
            </td>`;
    })
    .join("");

  const headerRow = displayItems
    .map((item) => {
      const colorClass = getJointCategoryColorClasses(item.joint);
      const badgeColor = item.joint.color || "#cbd5e1";
      const cubeIcon = item.joint.countAsMember
        ? `<span class="inline-flex items-center justify-center ml-1.5 text-emerald-800 dark:text-emerald-300" title="部材として集計される継手">${memberIconSvgRaw}</span>`
        : "";

      return `<th class="px-4 py-3 text-center border border-slate-300 dark:border-slate-600 min-w-[180px] whitespace-nowrap font-bold ${colorClass}">
              <div class="flex items-center justify-center gap-1.5">
                <span>${item.name}</span>
                <span class="flex-shrink-0 w-3 h-3 rounded-full border border-black/20 dark:border-white/20 shadow-sm" style="background-color: ${badgeColor}"></span>
                ${cubeIcon}
              </div>
            </th>`;
    })
    .join("");

  const sizeRow = displayItems
    .map((item) => {
      const j = item.joint;
      const colorClass = getJointCategoryColorClasses(j);
      const tooltipText = getBoltTooltipText(j);
      let sizeDisplay =
        j.isComplexSpl && j.webInputs
          ? j.webInputs.map((w) => w.size).join(", ")
          : [j.flangeSize, j.webSize].filter(Boolean).join(", ");

      return `<th class="px-2 py-2 text-center border border-slate-300 dark:border-slate-600 min-w-[180px] text-[10px] leading-tight font-medium cursor-help whitespace-nowrap bolt-info-trigger ${colorClass}"
                title="${tooltipText}" data-tooltip-content="${tooltipText}">
              ${sizeDisplay || "-"}
            </th>`;
    })
    .join("");

  const bodyHtml = locations
    .map(
      (loc) => `
    <tr class="tally-row group">
      <td class="px-4 py-3 font-bold sticky left-0 z-10 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 whitespace-nowrap group-hover:bg-slate-50 dark:group-hover:bg-slate-700/50">${loc.label}</td>
      ${displayItems
        .map((item) => {
          const val = project.tally?.[loc.id]?.[item.id] ?? "";
          return `<td class="p-0 border border-slate-200 dark:border-slate-700 ${locks[item.id] ? "bg-slate-100 dark:bg-slate-900/40" : "group-hover:bg-slate-50 dark:group-hover:bg-slate-800/20"}">
                  <input type="text" inputmode="numeric" data-location="${loc.id}" data-id="${item.id}"
                         class="tally-input w-full bg-transparent border-transparent py-3 text-center text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-yellow-500 transition-all font-medium" value="${val}" ${locks[item.id] ? "disabled" : ""}>
                </td>`;
        })
        .join("")}
      <td class="row-total px-4 py-2 text-center font-bold sticky right-0 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-blue-700 dark:text-blue-400 whitespace-nowrap"></td>
    </tr>`,
    )
    .join("");

  const savedScrollLeft = tallySheetContainer.firstElementChild?.scrollLeft ?? 0;

  tallySheetContainer.innerHTML = `
    <div class="overflow-x-auto custom-scrollbar">
      <table class="w-max min-w-full table-fixed text-sm border-collapse">
        <thead class="sticky top-0 z-20">
          <tr class="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
            <th class="px-4 py-3 sticky left-0 z-30 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-xs align-bottom whitespace-nowrap" rowspan="3">階層 / 工区</th>
            ${lockRow}
            <th class="sticky right-0 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 font-bold align-middle whitespace-nowrap" rowspan="3">合計</th>
          </tr>
          <tr>${headerRow}</tr>
          <tr>${sizeRow}</tr>
        </thead>
        <tbody>${bodyHtml}</tbody>
        <tfoot class="font-bold sticky bottom-0 bg-orange-50 dark:bg-slate-900/95 backdrop-blur-sm">
          <tr class="whitespace-nowrap">
            <td class="px-4 py-2 sticky left-0 z-10 border border-orange-400 dark:border-orange-700 text-orange-800 dark:text-orange-300">列合計</td>
            ${displayItems.map((item) => `<td data-id="${item.id}" class="col-total px-2 py-2 text-center border border-orange-400 dark:border-orange-700 text-orange-900 dark:text-orange-300"></td>`).join("")}
            <td class="grand-total px-4 py-2 text-center sticky right-0 border border-orange-400 dark:border-orange-700 text-orange-900 dark:text-orange-300"></td>
          </tr>
        </tfoot>
      </table>
    </div>`;

  if (savedScrollLeft > 0 && tallySheetContainer.firstElementChild) {
    tallySheetContainer.firstElementChild.scrollLeft = savedScrollLeft;
  }

  tallySheetContainer.querySelectorAll(".bolt-info-trigger").forEach((el) => {
    el.onclick = () => {
      const content = el.dataset.tooltipContent;
      if (content && window.innerWidth < 768) {
        showToast(content.replace(/\n/g, " | "), 3500);
      }
    };
  });

  if (tallyCard) {
    tallyCard.id = "anchor-tally-input";
    tallyCard.classList.remove("hidden");
    tallyCard.setAttribute("data-section-title", "箇所数入力");
    tallyCard.classList.add("scroll-mt-24");
  }
  if (resultsCard) resultsCard.classList.remove("hidden");
  updateTallySheetCalculations(project);
};

/**
 * 数量入力シートの合計値をDOM操作で再計算して更新する
 */
export const updateTallySheetCalculations = (project) => {
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

  const grandTotal = Array.from(document.querySelectorAll(".col-total")).reduce(
    (sum, cell) => sum + (parseInt(cell.textContent) || 0),
    0,
  );

  const grandTotalCell = document.querySelector(".grand-total");
  if (grandTotalCell) {
    grandTotalCell.textContent = grandTotal;
  }
};

/**
 * 集計結果（Results）画面を描画する
 */
export const renderResults = (project) => {
  const resultsCardContent = document.getElementById("results-card-content");
  const resultsCard = document.getElementById("results-card");

  if (resultsCardContent) resultsCardContent.innerHTML = "";
  if (!resultsCard) return;

  resultsCard.classList.add("hidden");
  if (!project) return;

  const { resultsByLocation } = calculateResults(project);
  const activeLevel = state.activeTallyLevel || "all";
  const activeType = state.activeTallyType || "all";

  const allTallyItems = getTallyList(project);
  const nameToJointMap = new Map(
    allTallyItems.map((item) => [item.name, item.joint]),
  );

  const targetLocationIds = new Set();
  if (project.mode === "advanced") {
    project.customLevels.forEach((lvl) => {
      if (activeLevel !== "all" && activeLevel !== lvl) return;
      project.customAreas.forEach((area) =>
        targetLocationIds.add(`${lvl}-${area}`),
      );
    });
  } else {
    for (let f = 2; f <= project.floors; f++) {
      if (activeLevel !== "all" && activeLevel !== f.toString()) continue;
      for (let s = 1; s <= project.sections; s++)
        targetLocationIds.add(`${f}-${s}`);
    }
    if (activeLevel === "all" || activeLevel === "R") {
      for (let s = 1; s <= project.sections; s++)
        targetLocationIds.add(`R-${s}`);
    }
    if (project.hasPH && (activeLevel === "all" || activeLevel === "PH")) {
      for (let s = 1; s <= project.sections; s++)
        targetLocationIds.add(`PH-${s}`);
    }
  }

  const filteredData = {};
  const filteredBoltSizes = new Set();
  let grandTotalBolts = 0;

  for (const locId in resultsByLocation) {
    if (!targetLocationIds.has(locId)) continue;

    filteredData[locId] = {};
    const sizesAtLoc = resultsByLocation[locId];

    for (const size in sizesAtLoc) {
      const data = sizesAtLoc[size];
      const filteredJoints = {};
      const filteredQtyMap = {};
      let filteredTotal = 0;

      for (const [itemName, count] of Object.entries(data.joints)) {
        const jointObj = nameToJointMap.get(itemName);
        if (
          activeType === "all" ||
          (jointObj && getJointFilterId(jointObj) === activeType)
        ) {
          filteredJoints[itemName] = count;
          filteredTotal += count;
          if (data.qtyMap?.[itemName] !== undefined) {
            filteredQtyMap[itemName] = data.qtyMap[itemName];
          }
        }
      }

      if (filteredTotal > 0) {
        filteredData[locId][size] = {
          total: filteredTotal,
          joints: filteredJoints,
          qtyMap: filteredQtyMap,
        };
        filteredBoltSizes.add(size);
        grandTotalBolts += filteredTotal;
      }
    }
  }

  const buttonsHtml = `
    <div class="flex justify-end mb-4">
      <button id="export-excel-btn" class="btn bg-green-600 hover:bg-green-700 text-white text-sm font-bold flex items-center gap-2 px-4 py-2 rounded-lg shadow-sm transition-all active:scale-95">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
        Excelデータを出力
      </button>
    </div>`;

  const sortedSizes = Array.from(filteredBoltSizes).sort(boltSort);

  if (sortedSizes.length === 0) {
    if (resultsCardContent) {
      resultsCardContent.innerHTML =
        buttonsHtml +
        '<p class="text-gray-500 dark:text-slate-400 p-12 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 font-bold">集計データがありません。</p>';
    }
    resultsCard.classList.remove("hidden");
    return;
  }

  let floorColumns = [];
  if (project.mode === "advanced") {
    project.customLevels.forEach((lvl) => {
      if (activeLevel !== "all" && activeLevel !== lvl) return;
      project.customAreas.forEach((area) =>
        floorColumns.push({ id: `${lvl}-${area}`, label: `${lvl}-${area}` }),
      );
      floorColumns.push({
        id: `${lvl}_total`,
        label: `${lvl} 合計`,
        isTotal: true,
        level: lvl,
      });
    });
  } else {
    for (let f = 2; f <= project.floors; f++) {
      if (activeLevel !== "all" && activeLevel !== f.toString()) continue;
      for (let s = 1; s <= project.sections; s++)
        floorColumns.push({ id: `${f}-${s}`, label: `${f}F-${s}` });
      floorColumns.push({
        id: `${f}F_total`,
        label: `${f}F 合計`,
        isTotal: true,
        floor: f,
      });
    }
    if (activeLevel === "all" || activeLevel === "R") {
      for (let s = 1; s <= project.sections; s++)
        floorColumns.push({ id: `R-${s}`, label: `RF-${s}` });
      floorColumns.push({
        id: `R_total`,
        label: `RF 合計`,
        isTotal: true,
        floor: "R",
      });
    }
    if (project.hasPH && (activeLevel === "all" || activeLevel === "PH")) {
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

  let floorTableHtml = `
    <div id="anchor-result-floor" data-section-title="集計：フロア工区別" data-section-color="yellow" class="scroll-mt-24">
        <div class="flex items-center gap-4 mb-4 border-b-2 border-yellow-400 dark:border-yellow-600 pb-2">
            <h2 class="text-2xl font-bold text-slate-900 dark:text-slate-100">ボルト本数(フロア工区別)</h2>
            <span class="font-bold text-red-600 dark:text-red-400 text-lg">(総本数: ${grandTotalBolts.toLocaleString()}本)</span>
        </div>
        <div class="overflow-x-auto custom-scrollbar">
            <table class="w-auto text-sm border-collapse">
                <thead class="bg-slate-200 dark:bg-slate-700 text-xs">
                    <tr>
                        <th class="px-2 py-3 sticky left-0 bg-slate-200 dark:bg-slate-700 z-10 border border-slate-300 dark:border-slate-600 min-w-[120px]">ボルトサイズ</th>
                        ${floorColumns.map((col) => `<th class="px-2 py-3 text-center border border-slate-300 dark:border-slate-600 ${col.isTotal ? "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200" : ""}">${col.label}</th>`).join("")}
                        <th class="px-2 py-3 text-center sticky right-0 bg-yellow-300 dark:bg-yellow-800/80 text-yellow-900 dark:text-yellow-100 border border-yellow-400 dark:border-yellow-700 font-bold">総合計</th>
                    </tr>
                </thead>
                <tbody>`;

  sortedSizes.forEach((size) => {
    let rowTotal = 0;
    const rowTotalJoints = {};
    const rowTotalQty = {};
    floorTableHtml += `<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40"><td class="px-2 py-2 font-bold sticky left-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 break-all">${size}</td>`;

    floorColumns.forEach((col) => {
      let cellValue = 0;
      let jointData = {};
      let qtyData = {};
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
          const d = filteredData[id]?.[size];
          if (d) {
            cellValue += d.total;
            for (const [n, c] of Object.entries(d.joints))
              jointData[n] = (jointData[n] || 0) + c;
            if (d.qtyMap) {
              for (const [n, q] of Object.entries(d.qtyMap))
                qtyData[n] = (qtyData[n] || 0) + q;
            }
          }
        });
      } else {
        const d = filteredData[col.id]?.[size];
        cellValue = d?.total || 0;
        if (d?.joints) jointData = d.joints;
        if (d?.qtyMap) qtyData = d.qtyMap;
      }

      if (!col.isTotal) {
        rowTotal += cellValue;
        for (const [n, c] of Object.entries(jointData))
          rowTotalJoints[n] = (rowTotalJoints[n] || 0) + c;
        for (const [n, q] of Object.entries(qtyData))
          rowTotalQty[n] = (rowTotalQty[n] || 0) + q;
      }

      const hasJoints = Object.keys(jointData).length > 0;
      const detailsDataAttr = hasJoints
        ? `data-details='${JSON.stringify(jointData)}' data-qty='${JSON.stringify(qtyData)}'`
        : "";
      floorTableHtml += `<td class="px-2 py-2 text-center border border-slate-200 dark:border-slate-700 ${col.isTotal ? "bg-blue-50/50 dark:bg-blue-900/20 font-bold" : ""} has-details cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-900/40" ${detailsDataAttr}>${cellValue > 0 ? cellValue.toLocaleString() : "-"}</td>`;
    });

    const hasRowJoints = Object.keys(rowTotalJoints).length > 0;
    const rowTotalDetailsAttr = hasRowJoints
      ? `data-details='${JSON.stringify(rowTotalJoints)}' data-qty='${JSON.stringify(rowTotalQty)}'`
      : "";
    floorTableHtml += `<td class="px-2 py-2 text-center font-bold sticky right-0 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 has-details cursor-pointer hover:bg-yellow-200" ${rowTotalDetailsAttr}>${rowTotal > 0 ? rowTotal.toLocaleString() : "-"}</td></tr>`;
  });
  floorTableHtml += `</tbody></table></div></div>`;

  const orderDetailsContainer = `<div id="order-details-container" data-section-title="本ボルト注文明細" data-section-color="pink" class="scroll-mt-24 mt-12"></div>`;
  const tempBoltsHtml = renderTempBoltResults(project);
  const shopTempBoltsHtml = renderShopTempBoltResults(project);
  const tempOrderDetailsContainer = `<div id="temp-order-details-container" data-section-title="仮ボルト注文明細" data-section-color="teal" class="scroll-mt-24 mt-12"></div>`;

  if (resultsCardContent) {
    resultsCardContent.innerHTML =
      buttonsHtml + floorTableHtml + orderDetailsContainer + tempBoltsHtml + tempOrderDetailsContainer + shopTempBoltsHtml;
  }

  const container = document.getElementById("order-details-container");
  if (container) renderOrderDetails(container, project, filteredData);

  const tempContainer = document.getElementById("temp-order-details-container");
  if (tempContainer) {
    const { resultsByLocation: tempResultsByLocation } = calculateTempBoltResults(project);
    renderTempOrderDetails(tempContainer, project, tempResultsByLocation);
  }

  resultsCard.classList.remove("hidden");
};

/**
 * グループ集計結果をモーダルに描画する関数
 */
export const renderAggregatedResults = (propertyName, aggregatedData) => {
  const titleEl = document.getElementById("aggregated-results-title");
  const contentEl = document.getElementById("aggregated-results-content");

  if (!titleEl || !contentEl) return;

  titleEl.textContent = `「${propertyName}」集計結果`;
  let html = "";

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

/**
 * 列のロック状態を即座にUIに反映させる
 */
export const updateColumnLockUI = (itemId, isLocked) => {
  const table = document.querySelector("#tally-sheet-container table");
  if (!table) return;

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
