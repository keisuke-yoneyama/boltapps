// ui-members.js
// 部材（Member）関連のUI関数

import { state } from "./state.js";
import {
  boltSort,
  getTempBoltInfo,
  getProjectLevels,
} from "./calculator.js";
import { openModal } from "./ui-modal.js";
import { populateJointDropdownForEdit } from "./ui-joints.js";
import { generateCustomInputFields } from "./ui-projects.js";

/**
 * 部材登録フォームへ移動してフォーカスする
 * （部材登録はモーダルではなくインラインフォームのため、タブ切替＋スクロール）
 */
export const openNewMemberModal = () => {
  // 部材タブへ切り替え（HTMLインラインscriptのswitchTabと同じ処理）
  const switchBtn = document.getElementById("switch-view-members");
  if (switchBtn) switchBtn.click();

  // 部材名入力欄へスクロール＆フォーカス
  const memberNameInput = document.getElementById("member-name");
  if (memberNameInput) {
    setTimeout(() => {
      memberNameInput.scrollIntoView({ behavior: "smooth", block: "center" });
      memberNameInput.focus();
    }, 50);
  }
};

/**
 * 部材編集モーダルを開く（階層チェックボックス生成付き）
 * @param {string} memberId - 編集対象の部材ID
 */
export const openEditMemberModal = (memberId) => {
  const project = state.projects.find((p) => p.id === state.currentProjectId);
  if (!project) return;

  const member = (project.members || []).find((m) => m.id === memberId);
  if (!member) return;

  const idInput = document.getElementById("edit-member-id");
  const nameInput = document.getElementById("edit-member-name");
  const jointSelect = document.getElementById("edit-member-joint-select");

  if (idInput) idInput.value = member.id;
  if (nameInput) nameInput.value = member.name;

  populateJointDropdownForEdit(jointSelect, member.jointId);

  const levelsContainer = document.getElementById(
    "edit-member-levels-container",
  );

  if (levelsContainer) {
    levelsContainer.innerHTML = "";

    const levels = getProjectLevels(project);
    const targetLevels = member.targetLevels || [];

    levels.forEach((lvl) => {
      const isChecked = targetLevels.includes(lvl.id);
      const label = document.createElement("label");
      label.className = "flex items-center gap-2 text-sm cursor-pointer";
      label.innerHTML = `<input type="checkbox" value="${lvl.id}" class="level-checkbox h-4 w-4 text-blue-600 rounded border-gray-300" ${isChecked ? "checked" : ""}>`;
      label.append(` ${lvl.label}`);
      levelsContainer.appendChild(label);
    });
  }

  const modal = document.getElementById("edit-member-modal");
  openModal(modal);
};

/**
 * 部材リストを描画する（ソート・階層フィルタリング・部材アイコン統合版）
 */
export const renderMemberLists = (project) => {
  if (!project) return;
  const container = document.getElementById("member-lists-container");
  const tabsContainer = document.getElementById("member-list-tabs");
  if (!container || !tabsContainer) return;

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

  const levels = getProjectLevels(project);
  let tabsHtml = `<button class="level-tab-btn px-3 py-1 rounded-full text-sm font-bold transition-colors border ${state.activeMemberLevel === "all" ? "bg-blue-600 text-white border-blue-600" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600 hover:bg-slate-100"}" data-level="all">全て</button>`;

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

  const jointsMap = new Map(project.joints.map((j) => [j.id, j]));

  const allMembers = [
    ...(project.members || []).map((m) => ({ ...m, isMember: true })),
    ...project.joints
      .filter((j) => j.countAsMember)
      .map((j) => ({ id: j.id, name: j.name, jointId: j.id, isMember: false })),
  ]
    .map((m) => ({ ...m, joint: jointsMap.get(m.jointId) }))
    .filter((m) => m.joint)
    .filter((m) => {
      if (state.activeMemberLevel === "all") return true;
      if (!m.isMember) return true;
      if (!m.targetLevels || m.targetLevels.length === 0) return true;
      return m.targetLevels.includes(state.activeMemberLevel);
    });

  const editIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
  const memberIconSvgRaw = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`;

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

        const memberIconHtml = joint.countAsMember
          ? `<span class="inline-flex items-center justify-center ml-1 text-emerald-600 dark:text-emerald-400 cursor-help" title="部材として集計される継手">${memberIconSvgRaw}</span>`
          : "";

        let editBtnHtml = member.isMember
          ? `<button data-id="${member.id}" class="edit-member-btn text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors" title="部材を編集">${editIconSvg}</button>`
          : `<button data-joint-id="${member.jointId}" class="edit-joint-btn text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors" title="元の継手を編集">${editIconSvg}</button>`;

        const checkboxHtml = member.isMember
          ? `<input type="checkbox" class="item-checkbox w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" data-id="${member.id}" data-type="member">`
          : `<span class="w-4 h-4 inline-flex items-center justify-center text-gray-400 cursor-help" title="継手マスターで「部材としてカウント」されているデータは一括削除できません">-</span>`;

        let boltInfo = "";
        if (joint.isComplexSpl && joint.webInputs) {
          const webInfo = joint.webInputs
            .map((w) => `${w.size || "-"} / ${w.count}本`)
            .join(",<br>");
          boltInfo = `<td class="px-4 py-3 border-b border-r ${borderColor} ${darkBorderColor}">${webInfo}</td>`;
        } else {
          const singleBoltTypes = ["column", "wall_girt", "roof_purlin"];
          if (singleBoltTypes.includes(joint.type)) {
            boltInfo = `<td class="px-4 py-3 border-b border-r ${borderColor} ${darkBorderColor}">${joint.flangeSize || "-"} / ${joint.flangeCount}本</td>`;
          } else if (isPin) {
            boltInfo = `<td class="px-4 py-3 border-b border-r ${borderColor} ${darkBorderColor}">${joint.webSize || "-"} / ${joint.webCount}本</td>`;
          } else {
            boltInfo = `<td class="px-4 py-3 border-b border-r ${borderColor} ${darkBorderColor}">${joint.flangeSize || "-"} / ${joint.flangeCount}本</td>
                        <td class="px-4 py-3 border-b border-r ${borderColor} ${darkBorderColor}">${joint.webSize || "-"} / ${joint.webCount}本</td>`;
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
              tempBoltInfoCells = `<td class="px-4 py-3 text-center border-b border-r ${borderColor} ${darkBorderColor} ${flangeClass}" title="${tempBoltInfo.flange.formula}">${tempBoltInfo.flange.text}</td>
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
            <tr class="item-row bg-${color}-50 dark:bg-slate-800/50 hover:bg-${color}-100 dark:hover:bg-slate-700/50 transition-colors" data-id="${member.id}">
                <td class="px-3 py-3 border-b border-r ${borderColor} ${darkBorderColor}">
                    <div class="flex items-center justify-center gap-3">
                        <div class="flex items-center justify-center w-4">${checkboxHtml}</div>
                        ${editBtnHtml}
                    </div>
                </td>
                <td class="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 border-b border-r js-searchable-name ${borderColor} ${darkBorderColor}">
                    ${member.name}${floorBadge}
                </td>
                <td class="px-4 py-3 border-b border-r ${borderColor} ${darkBorderColor}">
                    <div class="flex items-center">
                        ${joint.name}${colorBadge}${memberIconHtml}
                    </div>
                </td>
                ${boltInfo}
                ${tempBoltInfoCells}
            </tr>`;
      })
      .join("");
  };

  const selectAllHtml =
    '<input type="checkbox" class="select-all-checkbox w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" title="全選択/解除">';

  const memberSections = [
    {
      type: "girder",
      isPin: false,
      title: "部材 - 大梁",
      color: "blue",
      cols: [
        { label: selectAllHtml, key: null },
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
        { label: selectAllHtml, key: null },
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
        { label: selectAllHtml, key: null },
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
        { label: selectAllHtml, key: null },
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
        { label: selectAllHtml, key: null },
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
        { label: selectAllHtml, key: null },
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
        { label: selectAllHtml, key: null },
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
        { label: selectAllHtml, key: null },
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
        { label: selectAllHtml, key: null },
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
        { label: selectAllHtml, key: null },
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
        { label: selectAllHtml, key: null },
        { label: "部材名", key: "name" },
        { label: "使用継手", key: "jointName" },
        { label: "ボルト", key: "bolt" },
        { label: "仮ボルト", key: "temp-web" },
      ],
    },
  ];

  // 凡例の追加
  let html = `
    <div class="flex justify-end mb-2 px-2">
      <span class="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
        <span class="text-emerald-600 dark:text-emerald-400">${memberIconSvgRaw}</span>
        = 部材として集計される継手
      </span>
    </div>
  `;
  const sectionsToRender = [];

  memberSections.forEach((section) => {
    const filteredMembers = allMembers.filter(
      (m) =>
        m.joint &&
        m.joint.type === section.type &&
        (m.joint.isPinJoint || false) === section.isPin,
    );
    if (filteredMembers.length > 0) {
      const sectionId = `member-${section.type}-${section.isPin ? "pin" : "rigid"}`;
      const sortState = state.sort[sectionId];

      if (sortState && sortState.key) {
        filteredMembers.sort((a, b) => {
          const key = sortState.key;
          const getVal = (m) => {
            if (key === "name") return m.name;
            if (key === "jointName") return m.joint.name;
            if (key === "flange")
              return `${m.joint.flangeSize}-${m.joint.flangeCount}`;
            if (key === "web") return `${m.joint.webSize}-${m.joint.webCount}`;
            if (key === "bolt")
              return (
                m.joint.flangeSize ||
                m.joint.webSize ||
                m.joint.shopTempBoltSize ||
                ""
              );
            if (key === "web_complex")
              return m.joint.webInputs && m.joint.webInputs.length > 0
                ? m.joint.webInputs[0].size
                : m.joint.webSize || "";
            if (key.startsWith("temp")) {
              const info = getTempBoltInfo(m.joint, project.tempBoltMap);
              if (key === "temp-flange") return info.flange.text;
              if (key === "temp-web") return info.web.text;
              if (key === "temp_web_complex")
                return info.webs && info.webs.length > 0
                  ? info.webs[0].text
                  : info.web.text;
            }
            return "";
          };

          const valA = getVal(a),
            valB = getVal(b);
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
            const cleanA = strA.split("/")[0].trim(),
              cleanB = strB.split("/")[0].trim();
            const cmp = boltSort(cleanA, cleanB);
            if (cmp !== 0) return sortState.order === "asc" ? cmp : -cmp;
            return sortState.order === "asc"
              ? strA.localeCompare(strB)
              : strB.localeCompare(strA);
          }
          if (valA < valB) return sortState.order === "asc" ? -1 : 1;
          if (valA > valB) return sortState.order === "asc" ? 1 : -1;
          return 0;
        });
      } else {
        filteredMembers.sort((a, b) => {
          const jointNameCompare = a.joint.name.localeCompare(
            b.joint.name,
            "ja",
          );
          if (jointNameCompare !== 0) return jointNameCompare;
          return a.name.localeCompare(b.name, "ja");
        });
      }

      const tbodyId = `members-list-${section.type}${section.isPin ? "-pin" : ""}`;
      let finalCols = section.cols;
      const hasComplexSpl = filteredMembers.some((m) => m.joint.isComplexSpl);
      if (hasComplexSpl && section.isPin) {
        finalCols = [
          { label: selectAllHtml, key: null },
          { label: "部材名", key: "name" },
          { label: "使用継手", key: "jointName" },
          { label: "ウェブ (複合SPL)", key: "web_complex" },
          { label: "仮ボルト (複合SPL)", key: "temp_web_complex" },
        ];
      }

      const headerHtml = finalCols
        .map((col) => {
          let sortIcon = "",
            cursorClass = "",
            dataAttr = "";
          if (col.key) {
            cursorClass =
              "cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors";
            dataAttr = `data-sort-key="${col.key}"`;
            if (sortState && sortState.key === col.key)
              sortIcon = sortState.order === "asc" ? " ▲" : " ▼";
          }
          return `<th class="px-4 py-3 whitespace-nowrap ${cursorClass}" ${dataAttr}>${col.label}${sortIcon}</th>`;
        })
        .join("");

      const anchorId = `anchor-member-${section.type}-${section.isPin ? "pin" : "rigid"}`;

      html += `
        <div id="${anchorId}" class="rounded-lg border border-slate-400 dark:border-slate-600 scroll-mt-24 mb-6" data-section-title="部材：${section.title}" data-section-color="${section.color}" data-section-id="${sectionId}">
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

  const bulkBar = document.getElementById("bulk-delete-bar");
  if (bulkBar) {
    bulkBar.classList.add("translate-y-24", "opacity-0", "pointer-events-none");
  }

  document.dispatchEvent(new CustomEvent("quickNavLinksUpdate"));
};

/**
 * 部材登録フォームをリセットする
 */
export const resetMemberForm = () => {
  const memberNameInput = document.getElementById("member-name");
  const memberJointSelectInput = document.getElementById(
    "member-joint-select-input",
  );
  const memberJointSelectId = document.getElementById("member-joint-select-id");

  if (memberNameInput) memberNameInput.value = "";
  if (memberJointSelectInput) memberJointSelectInput.value = "";
  if (memberJointSelectId) memberJointSelectId.value = "";

  const levelCheckboxes = document.querySelectorAll(".static-level-checkbox");
  levelCheckboxes.forEach((cb) => (cb.checked = false));
};

/**
 * 動的入力フィールドの数とキャッシュを更新する
 * (+/- ボタンが押された時に呼ばれる)
 */
export const updateDynamicInputs = (
  countInputElement,
  inputsContainer,
  cache,
  prefix,
  change,
) => {
  const currentInputs = inputsContainer.querySelectorAll("input[type='text']");
  currentInputs.forEach((input, index) => {
    cache[index] = input.value;
  });

  let newCount = parseInt(countInputElement.value) || 0;
  newCount += change;
  if (newCount < 1) newCount = 1;

  const currentCacheSize = cache.length;
  if (newCount > currentCacheSize) {
    for (let i = 0; i < newCount - currentCacheSize; i++) {
      cache.push("");
    }
  }

  countInputElement.value = newCount;

  generateCustomInputFields(newCount, inputsContainer, prefix, cache);
};

/**
 * 部材一括登録用の入力欄を生成する
 * @param {number} count - 生成する入力欄の数
 * @param {Array<string>} currentValues - 現在入力されている部材名の配列 (再描画時の値保持用)
 */
export const renderBulkMemberInputs = (count, currentValues = []) => {
  const container = document.getElementById("bulk-member-inputs-container");
  if (!container) return;

  const project = state.projects.find((p) => p.id === state.currentProjectId);
  if (!project) return;

  const levels = getProjectLevels(project);

  if (!state.bulkMemberLevels) {
    state.bulkMemberLevels = [];
  }

  while (state.bulkMemberLevels.length < count) {
    state.bulkMemberLevels.push([]);
  }
  state.bulkMemberLevels = state.bulkMemberLevels.slice(0, count);

  container.innerHTML = "";

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

    const savedName = currentValues[i] || "";

    const div = document.createElement("div");
    div.className = "flex items-center gap-2 mb-2";
    div.innerHTML = `
          <span class="text-sm text-slate-500 w-6 text-right">${i + 1}.</span>
          <input type="text" data-index="${i}" class="bulk-member-name-input w-full bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 rounded-md p-2 focus:ring-yellow-500 focus:border-yellow-500" placeholder="部材名" value="${savedName}">
          <button type="button" data-index="${i}" class="open-bulk-level-selector text-xs whitespace-nowrap bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-3 py-2 rounded-md border border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors" title="使用階層の選択">
              階層: ${levelsText}
          </button>
      `;
    container.appendChild(div);
  }

  setTimeout(() => {
    const firstInput = container.querySelector("input");
    if (firstInput) firstInput.focus();
  }, 50);
};

/**
 * プロジェクト選択バーの表示・非表示を更新する（一括操作用）
 */
export const updateProjectSelectionBar = () => {
  const opBar = document.getElementById("project-op-bar");
  if (!opBar) return;

  const checkedCount = document.querySelectorAll(
    ".project-checkbox:checked",
  ).length;

  if (checkedCount > 0) {
    opBar.classList.remove("translate-y-full");
    opBar.classList.add("translate-y-0");
    const countEl = document.getElementById("project-selected-count");
    if (countEl) countEl.textContent = `${checkedCount}件選択中`;
  } else {
    opBar.classList.add("translate-y-full", "opacity-0", "pointer-events-none");
    opBar.classList.remove("translate-y-0");
  }
};
