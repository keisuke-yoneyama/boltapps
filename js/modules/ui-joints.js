// ui-joints.js
// 継手関連のUI関数

import { PRESET_COLORS, HUG_BOLT_SIZES } from "./config.js";
import { state } from "./state.js";
import { boltSort, getTempBoltInfo, getProjectLevels } from "./calculator.js";
import { openModal } from "./ui-modal.js";
import { showToast } from "./ui-notifications.js";

// 複合スプライスキャッシュ
export let editComplexSplCache = Array.from({ length: 4 }, () => ({
  size: "",
  count: "",
}));

export let newComplexSplCache = Array.from({ length: 4 }, () => ({
  size: "",
  count: "",
}));

export function resetNewComplexSplCache() {
  newComplexSplCache = Array.from({ length: 4 }, () => ({
    size: "",
    count: "",
  }));
}

// キャッシュリセット用ヘルパー
function resetEditComplexSplCache() {
  editComplexSplCache = Array.from({ length: 4 }, () => ({
    size: "",
    count: "",
  }));
}

// --- ▼ 追加: events.js からキャッシュを更新するための関数 ---
export function updateEditComplexSplCacheItem(index, key, value) {
  if (editComplexSplCache[index]) {
    editComplexSplCache[index][key] = value;
  }
}

/**
 * 継手から「絞り込み用ID」を生成する
 */
export const getJointFilterId = (joint) => {
  if (!joint) return "other";
  return joint.type + (joint.isPinJoint ? "_pin" : "");
};

/**
 * 絞り込みIDから表示名を取得する
 */
export const getJointFilterLabel = (filterId) => {
  const baseMap = {
    girder: "大梁",
    beam: "小梁",
    column: "本柱",
    stud: "間柱",
    wall_girt: "胴縁",
    roof_purlin: "母屋",
    other: "その他",
  };
  const isPin = filterId.endsWith("_pin");
  const baseType = isPin ? filterId.replace("_pin", "") : filterId;
  const label = baseMap[baseType] || baseType;
  return isPin ? `${label}(ピン)` : label;
};

/**
 * カテゴリカラーの定義（ダークモード完全対応）
 */
export const getJointCategoryColorClasses = (joint) => {
  if (!joint)
    return "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200";
  const t = joint.type;
  const p = joint.isPinJoint;
  if (t === "girder")
    return p
      ? "bg-cyan-200 text-cyan-900 border-cyan-300 dark:bg-cyan-900 dark:text-cyan-100"
      : "bg-blue-200 text-blue-900 border-blue-300 dark:bg-blue-900 dark:text-blue-100";
  if (t === "beam")
    return p
      ? "bg-teal-200 text-teal-900 border-teal-300 dark:bg-teal-900 dark:text-teal-100"
      : "bg-green-200 text-green-900 border-green-300 dark:bg-emerald-900 dark:text-emerald-100";
  if (t === "column")
    return "bg-red-200 text-red-900 border-red-300 dark:bg-rose-900 dark:text-rose-100";
  if (t === "stud")
    return p
      ? "bg-purple-200 text-purple-900 border-purple-300 dark:bg-purple-900 dark:text-purple-100"
      : "bg-indigo-200 text-indigo-900 border-indigo-300 dark:bg-indigo-900 dark:text-indigo-100";
  if (t === "wall_girt")
    return "bg-slate-200 text-slate-900 border-slate-300 dark:bg-slate-700 dark:text-slate-200";
  if (t === "roof_purlin")
    return "bg-orange-200 text-orange-900 border-orange-300 dark:bg-orange-900 dark:text-orange-100";
  return "bg-amber-200 text-amber-900 border-amber-300 dark:bg-amber-900 dark:text-amber-100";
};

/**
 * 継手の部位に基づいた詳細（ツールチップ用）
 */
export const getBoltTooltipText = (joint) => {
  if (!joint) return "";
  let lines = [];
  const name = joint.name || "継手名未設定";
  const isSimpleLabel =
    joint.isPinJoint ||
    joint.type === "wall_girt" ||
    joint.type === "roof_purlin";

  if (joint.isComplexSpl && joint.webInputs) {
    joint.webInputs.forEach((w) => {
      if (w.count > 0) lines.push(`${w.name || name}：${w.count}本`);
    });
  } else if (isSimpleLabel) {
    const total = (joint.webCount || 0) + (joint.flangeCount || 0);
    if (total > 0) lines.push(`${name}：${total}本`);
  } else {
    if (joint.flangeCount > 0) lines.push(`${name}(F)：${joint.flangeCount}本`);
    if (joint.webCount > 0) lines.push(`${name}(W)：${joint.webCount}本`);
  }
  return lines.length > 0 ? lines.join("\n") : "ボルト設定なし";
};

/**
 * 複合スプライスの入力欄の表示数を制御する
 */
export function renderComplexSplInputs(count, cache, isModal) {
  for (let i = 1; i <= 4; i++) {
    const prefix = isModal ? "edit-" : "";

    let groupId;
    if (isModal && i === 1) {
      groupId = "edit-web-group";
    } else {
      const baseId = `${prefix}web-input-group`;
      groupId = i > 1 ? `${baseId}-${i}` : baseId;
    }

    const group = document.getElementById(groupId);
    const sizeInput = document.getElementById(
      `${prefix}web-size${i > 1 ? "-" + i : ""}`,
    );
    const countInput = document.getElementById(
      `${prefix}web-count${i > 1 ? "-" + i : ""}`,
    );

    if (group && sizeInput && countInput) {
      if (i <= count) {
        group.classList.remove("hidden");
        sizeInput.value = cache[i - 1]?.size || "";
        countInput.value = cache[i - 1]?.count || "";
      } else {
        group.classList.add("hidden");
      }
    }
  }
}

const updateComplexSplCount = (countInputElement, cache, isModal, change) => {
  let newCount = parseInt(countInputElement.value) + change;
  if (newCount < 2) newCount = 2;
  if (newCount > 4) newCount = 4;
  countInputElement.value = newCount;
  renderComplexSplInputs(newCount, cache, isModal);
};

/**
 * 編集モーダルのComplexSplカウントを変更する
 */
export function changeEditComplexSplCount(delta) {
  console.log("① ボタンクリック検知: delta =", delta);
  const editComplexSplCountInput = document.getElementById(
    "edit-complex-spl-count",
  );

  if (!editComplexSplCountInput) {
    console.error("② エラー: 入力欄(edit-complex-spl-count)が見つかりません！");
    return;
  }

  console.log("③ 入力欄取得成功:", editComplexSplCountInput.value);
  updateComplexSplCount(
    editComplexSplCountInput,
    editComplexSplCache,
    true,
    delta,
  );
}

export function changeComplexSplCount(delta) {
  console.log("① ボタンクリック検知: delta =", delta);
  const complexSplCountInput = document.getElementById("complex-spl-count");

  if (!complexSplCountInput) {
    console.error("② エラー: 入力欄(complex-spl-count-input)が見つかりません！");
    return;
  }

  console.log("③ 入力欄取得成功:", complexSplCountInput.value);
  updateComplexSplCount(
    complexSplCountInput,
    newComplexSplCache,
    false,
    delta,
  );
}

/**
 * 接合部入力フォームのUI（表示・非表示など）を更新する
 */
export const updateJointFormUI = (isModal) => {
  const prefix = isModal ? "edit-" : "";
  const elements = {
    type: document.getElementById(`${prefix}joint-type`),
    tempSetting: document.getElementById(`${prefix}temp-bolt-setting`),
    isPin: document.getElementById(`${prefix}is-pin-joint`),
    isDoubleShear: document.getElementById(`${prefix}is-double-shear`),
    isComplexSpl: document.getElementById(`${prefix}is-complex-spl`),
    hasShopSpl: document.getElementById(`${prefix}has-shop-spl`),
    hasBoltCorrection: document.getElementById(`${prefix}has-bolt-correction`),
    webGroup: document.getElementById(
      isModal ? "edit-web-group" : "web-input-group",
    ),
    flangeGroup: document.getElementById(
      isModal ? "edit-flange-group" : "flange-input-group",
    ),
    pinGroup: document.getElementById(`${prefix}pin-joint-group`),
    shearGroup: document.getElementById(`${prefix}double-shear-group`),
    splGroup: document.getElementById(`${prefix}shop-spl-group`),
    complexSplGroup: document.getElementById(`${prefix}complex-spl-group`),
    complexSplCountGroup: document.getElementById(
      `${prefix}complex-spl-count-group`,
    ),
    manualTempBoltGroupSingle: document.getElementById(
      `${prefix}shop-temp-bolt-group-single`,
    ),
    manualTempBoltGroupDual: document.getElementById(
      `${prefix}shop-temp-bolt-group-dual`,
    ),
    flangePlaceholder: document.getElementById(`${prefix}flange-size`),
    flangeLabel: document.getElementById(`${prefix}flange-label`),
  };

  const bundleGroup = document.getElementById(`${prefix}bundle-column-group`);
  const isBundledInput = document.getElementById(
    `${prefix}is-bundled-with-column`,
  );

  const type = elements.type.value;
  const twoBoltTypes = ["girder", "beam", "other", "stud"];
  const oneBoltTypes = ["column", "wall_girt", "roof_purlin"];

  const isPin = twoBoltTypes.includes(type) && elements.isPin?.checked;

  const tempSetting = elements.tempSetting?.value;
  const isDoubleShear = elements.isDoubleShear?.checked;

  if (bundleGroup) {
    if (type === "column") {
      bundleGroup.classList.add("hidden");
      if (isBundledInput) isBundledInput.checked = false;
    } else {
      bundleGroup.classList.remove("hidden");
    }
  }

  if (oneBoltTypes.includes(type)) {
    if (elements.flangeGroup) elements.flangeGroup.style.display = "grid";
    if (elements.webGroup) elements.webGroup.style.display = "none";
  } else {
    if (elements.flangeGroup)
      elements.flangeGroup.style.display = isPin ? "none" : "grid";
    if (elements.webGroup) elements.webGroup.style.display = "grid";
  }

  const complexSplApplicableTypes = ["girder", "beam", "stud", "other"];
  const showComplexSplOption =
    complexSplApplicableTypes.includes(type) &&
    tempSetting === "calculated" &&
    isPin &&
    isDoubleShear;

  if (elements.complexSplGroup) {
    elements.complexSplGroup.classList.toggle("hidden", !showComplexSplOption);
    if (!showComplexSplOption && elements.isComplexSpl)
      elements.isComplexSpl.checked = false;
  }
  if (elements.complexSplCountGroup && elements.isComplexSpl) {
    elements.complexSplCountGroup.classList.toggle(
      "hidden",
      !elements.isComplexSpl.checked,
    );
  }

  const applicableSplTypes = ["girder", "beam", "stud", "other"];
  const tempBoltExcludedTypes = ["wall_girt", "roof_purlin", "column"];

  if (elements.pinGroup)
    elements.pinGroup.classList.toggle("hidden", !twoBoltTypes.includes(type));
  if (elements.shearGroup)
    elements.shearGroup.classList.toggle("hidden", !isPin);

  const showSpl =
    applicableSplTypes.includes(type) && !(isPin && !isDoubleShear);
  if (elements.splGroup) elements.splGroup.classList.toggle("hidden", !showSpl);
  if (elements.hasShopSpl) elements.hasShopSpl.disabled = !showSpl;

  const disableBoltCorrection =
    !showSpl ||
    !elements.hasShopSpl?.checked ||
    (!isPin && tempSetting === "none" && elements.hasShopSpl?.checked);

  if (elements.hasBoltCorrection) {
    elements.hasBoltCorrection.disabled = disableBoltCorrection;
    if (disableBoltCorrection) elements.hasBoltCorrection.checked = false;
  }
  if (elements.tempSetting?.parentElement) {
    elements.tempSetting.parentElement.classList.toggle(
      "hidden",
      tempBoltExcludedTypes.includes(type),
    );
  }

  if (elements.manualTempBoltGroupSingle)
    elements.manualTempBoltGroupSingle.classList.add("hidden");
  if (elements.manualTempBoltGroupDual)
    elements.manualTempBoltGroupDual.classList.add("hidden");

  if (type === "column") {
    if (elements.manualTempBoltGroupSingle)
      elements.manualTempBoltGroupSingle.classList.remove("hidden");
    if (elements.flangePlaceholder)
      elements.flangePlaceholder.placeholder = "エレクションサイズ";
    if (elements.flangeLabel) elements.flangeLabel.textContent = "エレクション";
  } else if (oneBoltTypes.includes(type)) {
    if (elements.flangePlaceholder)
      elements.flangePlaceholder.placeholder = "ボルト サイズ";
    if (elements.flangeLabel) elements.flangeLabel.textContent = "ボルト情報";
  } else {
    if (elements.flangePlaceholder)
      elements.flangePlaceholder.placeholder = "フランジ サイズ";
    if (elements.flangeLabel) elements.flangeLabel.textContent = "フランジ";
    const showManualInputs =
      tempSetting === "none" &&
      elements.hasShopSpl?.checked &&
      applicableSplTypes.includes(type);
    if (showManualInputs) {
      if (isPin && isDoubleShear) {
        if (elements.manualTempBoltGroupSingle)
          elements.manualTempBoltGroupSingle.classList.remove("hidden");
      } else if (!isPin) {
        if (elements.manualTempBoltGroupDual)
          elements.manualTempBoltGroupDual.classList.remove("hidden");
      }
    }
  }

  const splCountInput = document.getElementById(`${prefix}complex-spl-count`);
  if (splCountInput && elements.isComplexSpl) {
    const splCount = parseInt(splCountInput.value);
    const cache = isModal ? editComplexSplCache : newComplexSplCache;
    renderComplexSplInputs(
      elements.isComplexSpl.checked ? splCount : 1,
      cache,
      isModal,
    );
  }
};

/**
 * カラーパレットを描画する
 */
export function renderColorPalette(selectedColor) {
  const container = document.getElementById("color-palette-container");
  if (!container) return;

  container.innerHTML = "";

  PRESET_COLORS.forEach((color) => {
    const swatch = document.createElement("div");
    swatch.className = "color-swatch";
    swatch.style.backgroundColor = color;
    swatch.dataset.color = color;

    if (color === selectedColor) {
      swatch.classList.add("selected");
    }

    container.appendChild(swatch);
  });
}

/**
 * パレットの色が選択されたときのUI更新処理
 */
export function selectColor(color) {
  document.querySelectorAll(".color-swatch").forEach((el) => {
    el.classList.remove("selected");
  });

  const targetSwatch = document.querySelector(
    `.color-swatch[data-color="${color}"]`,
  );
  if (targetSwatch) {
    targetSwatch.classList.add("selected");
  }

  const input = document.getElementById("edit-joint-color");
  if (input) {
    input.value = color;
    input.dataset.isNull = "false";
  }
}

/**
 * 常設フォーム用のカラーパレットを描画する
 */
export function renderStaticColorPalette(selectedColor) {
  const container = document.getElementById("static-color-palette-container");
  if (!container) return;

  container.innerHTML = "";

  PRESET_COLORS.forEach((color) => {
    const swatch = document.createElement("div");
    swatch.className = "color-swatch";
    swatch.style.backgroundColor = color;
    swatch.dataset.color = color;

    if (color === selectedColor) {
      swatch.classList.add("selected");
    }

    container.appendChild(swatch);
  });
}

/**
 * 常設フォームの色が選択されたときのUI更新処理
 */
export function selectStaticColor(color) {
  const container = document.getElementById("static-color-palette-container");
  if (!container) return;

  container.querySelectorAll(".color-swatch").forEach((el) => {
    el.classList.remove("selected");
  });

  const targetSwatch = container.querySelector(
    `.color-swatch[data-color="${color}"]`,
  );
  if (targetSwatch) {
    targetSwatch.classList.add("selected");
  }

  const input = document.getElementById("joint-color-input");
  if (input) {
    input.value = color;
  }
}

export function openEditModal(joint) {
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };
  const setCheck = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.checked = val;
  };

  setVal("edit-joint-id", joint.id);
  setVal("edit-joint-type", joint.type);
  setCheck("edit-is-pin-joint", joint.isPinJoint || false);
  setCheck("edit-is-double-shear", joint.isDoubleShear || false);
  setCheck("edit-count-as-member", joint.countAsMember || false);
  setCheck("edit-has-shop-spl", joint.hasShopSpl ?? true);
  setCheck("edit-has-bolt-correction", joint.hasBoltCorrection || false);
  setVal("edit-joint-name", joint.name);

  setCheck("edit-is-bundled-with-column", joint.isBundledWithColumn || false);

  const colorInput = document.getElementById("edit-joint-color");
  if (colorInput) {
    if (joint.color) {
      colorInput.value = joint.color;
      colorInput.dataset.isNull = "false";
      renderColorPalette(joint.color);
    } else {
      colorInput.value = "#ffffff";
      colorInput.dataset.isNull = "true";
      renderColorPalette(null);
    }
  }
  const colorPaletteArea = document.getElementById("color-palette-area");
  if (colorPaletteArea) colorPaletteArea.classList.add("hidden");
  const colorPaletteChevron = document.getElementById("color-palette-chevron");
  if (colorPaletteChevron) colorPaletteChevron.classList.remove("rotate-180");

  setVal("edit-flange-size", joint.flangeSize);
  setVal("edit-flange-count", joint.flangeCount);
  setVal("edit-web-size", joint.webSize);
  setVal("edit-web-count", joint.webCount);
  setVal("edit-temp-bolt-setting", joint.tempBoltSetting || "none");

  setVal("edit-shop-temp-bolt-count", joint.shopTempBoltCount ?? "");
  setVal("edit-shop-temp-bolt-size", joint.shopTempBoltSize || "");
  setVal("edit-shop-temp-bolt-count-f", joint.shopTempBoltCount_F ?? "");
  setVal("edit-shop-temp-bolt-size-f", joint.shopTempBoltSize_F || "");
  setVal("edit-shop-temp-bolt-count-w", joint.shopTempBoltCount_W ?? "");
  setVal("edit-shop-temp-bolt-size-w", joint.shopTempBoltSize_W || "");

  setCheck("edit-is-complex-spl", joint.isComplexSpl || false);
  setVal("edit-complex-spl-count", joint.complexSplCount || "2");

  editComplexSplCache = Array.from({ length: 4 }, () => ({
    size: "",
    count: "",
  }));

  if (joint.isComplexSpl && joint.webInputs) {
    joint.webInputs.forEach((input, index) => {
      if (index < 4) {
        editComplexSplCache[index] = { ...input };
      }
    });
  } else {
    editComplexSplCache[0] = { size: joint.webSize, count: joint.webCount };
  }

  updateJointFormUI(true);

  const editModal = document.getElementById("edit-joint-modal");
  openModal(editModal);
}

/**
 * 編集用ドロップダウンに選択肢（ジョイント一覧）を生成する
 */
export const populateJointDropdownForEdit = (selectElement, currentJointId) => {
  if (!selectElement) return;

  const project = state.projects.find((p) => p.id === state.currentProjectId);
  if (!project) return;

  selectElement.innerHTML = "";

  const availableJoints = project.joints
    .filter((j) => !j.countAsMember)
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));

  availableJoints.forEach((joint) => {
    const option = document.createElement("option");
    option.value = joint.id;
    option.textContent = joint.name;

    if (joint.id === currentJointId) {
      option.selected = true;
    }

    selectElement.appendChild(option);
  });
};

/**
 * 継手の新規登録モーダルを開く（フォームリセット含む）
 */
export function openNewJointModal() {
  const title = document.querySelector("#edit-joint-modal h3");
  if (title) title.textContent = "継手の新規登録";

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };
  const setCheck = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.checked = val;
  };

  setVal("edit-joint-id", "");
  setVal("edit-joint-name", "");
  setVal("edit-joint-type", "girder");

  setVal("edit-flange-size", "");
  setVal("edit-flange-count", "");
  setVal("edit-web-size", "");
  setVal("edit-web-count", "");

  setCheck("edit-is-pin-joint", false);
  setCheck("edit-is-double-shear", false);
  setCheck("edit-count-as-member", false);
  setCheck("edit-has-shop-spl", false);
  setCheck("edit-has-bolt-correction", false);
  setCheck("edit-is-complex-spl", false);

  setVal("edit-temp-bolt-setting", "calculated");
  setVal("edit-complex-spl-count", "2");

  ["count", "size", "count-f", "size-f", "count-w", "size-w"].forEach(
    (suffix) => {
      setVal(`edit-shop-temp-bolt-${suffix}`, "");
    },
  );

  resetEditComplexSplCache();

  const colorInput = document.getElementById("edit-joint-color");
  if (colorInput) {
    colorInput.value = "#ffffff";
    colorInput.dataset.isNull = "true";
    renderColorPalette(null);
  }
  const colorPaletteArea = document.getElementById("color-palette-area");
  if (colorPaletteArea) colorPaletteArea.classList.add("hidden");
  const colorPaletteChevron = document.getElementById("color-palette-chevron");
  if (colorPaletteChevron) colorPaletteChevron.classList.remove("rotate-180");

  updateJointFormUI(true);

  const modal = document.getElementById("edit-joint-modal");
  openModal(modal);
}

/**
 * 継手入力フォームをリセットする
 */
export const resetJointForm = () => {
  const jointNameInput = document.getElementById("joint-name");
  const jointColorToggle = document.getElementById("joint-color-toggle");
  const jointColorSection = document.getElementById("joint-color-section");
  const jointColorInput = document.getElementById("joint-color-input");
  const editJointColorInput = document.getElementById("edit-joint-color");
  const flangeSizeInput = document.getElementById("flange-size");
  const flangeCountInput = document.getElementById("flange-count");
  const webSizeInput = document.getElementById("web-size");
  const webCountInput = document.getElementById("web-count");
  const shopTempBoltCountInput = document.getElementById(
    "shop-temp-bolt-count",
  );
  const shopTempBoltSizeInput = document.getElementById("shop-temp-bolt-size");
  const isPinJointInput = document.getElementById("is-pin-joint");
  const isDoubleShearInput = document.getElementById("is-double-shear");
  const countAsMemberInput = document.getElementById("count-as-member");
  const hasShopSplInput = document.getElementById("has-shop-spl");
  const hasBoltCorrectionInput = document.getElementById("has-bolt-correction");
  const tempBoltSettingInput = document.getElementById("temp-bolt-setting");
  const isComplexSplInput = document.getElementById("is-complex-spl");
  const complexSplCountInput = document.getElementById("complex-spl-count");
  const isBundledWithColumnInput = document.getElementById(
    "is-bundled-with-column",
  );

  if (jointNameInput) jointNameInput.value = "";

  if (jointColorToggle) {
    jointColorToggle.checked = false;
    if (jointColorSection) jointColorSection.classList.add("hidden");
    if (jointColorInput) jointColorInput.value = "#ffffff";

    renderStaticColorPalette(null);
  }

  if (editJointColorInput) {
    editJointColorInput.value = "#ffffff";
    editJointColorInput.dataset.isNull = "true";

    renderColorPalette(null);
  }

  if (flangeSizeInput) flangeSizeInput.value = "";
  if (flangeCountInput) flangeCountInput.value = "";
  if (webSizeInput) webSizeInput.value = "";
  if (webCountInput) webCountInput.value = "";
  if (shopTempBoltCountInput) shopTempBoltCountInput.value = "";
  if (shopTempBoltSizeInput) shopTempBoltSizeInput.value = "";

  if (isPinJointInput) isPinJointInput.checked = false;
  if (isDoubleShearInput) isDoubleShearInput.checked = false;
  if (countAsMemberInput) countAsMemberInput.checked = false;
  if (hasShopSplInput) hasShopSplInput.checked = false;
  if (hasBoltCorrectionInput) hasBoltCorrectionInput.checked = false;
  if (tempBoltSettingInput) tempBoltSettingInput.value = "calculated";

  if (isComplexSplInput) isComplexSplInput.checked = false;
  if (complexSplCountInput) complexSplCountInput.value = "2";

  newComplexSplCache = Array.from({ length: 4 }, () => ({
    size: "",
    count: "",
  }));

  if (isBundledWithColumnInput) isBundledWithColumnInput.checked = false;

  updateJointFormUI(false);
};

/**
 * HUGボルトのサイズ選択肢を生成する
 */
export const populateHugBoltSelector = (selectElement) => {
  const allHugBolts = Object.values(HUG_BOLT_SIZES).flat();
  selectElement.innerHTML = '<option value="">サイズを選択...</option>';
  allHugBolts.forEach((size) => {
    const option = document.createElement("option");
    option.value = size;
    option.textContent = size;
    selectElement.appendChild(option);
  });
};

/**
 * 継手選択モダルの内容を生成する
 */
export const populateJointSelectorModal = (project, currentJointId) => {
  const jointOptionsContainer = document.getElementById(
    "joint-options-container",
  );

  if (!jointOptionsContainer || !project) return;

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
  for (const group of groupOrder) {
    html += `<h4 class="font-bold text-blue-800 border-b border-blue-200 pb-1 mb-2">${group}</h4>
             <div class="grid grid-cols-2 sm-grid-cols-3 md-grid-cols-4 lg-grid-cols-5 gap-2 mb-4">`;

    const sortedJoints = groupedJoints[group].sort((a, b) =>
      a.name.localeCompare(b.name, "ja"),
    );

    for (const joint of sortedJoints) {
      const isSelected = joint.id && joint.id === currentJointId;
      const selectedClass = isSelected
        ? "bg-yellow-400 dark:bg-yellow-600 font-bold"
        : "bg-blue-50 dark:bg-slate-700";
      const dataId = joint.id || "";

      html += `<button data-id="${dataId}" data-name="${joint.name}" class="joint-option-btn text-sm p-2 border border-blue-200 rounded-md transition-transform duration-150 hover:scale-105 ${selectedClass}">${joint.name}</button>`;
    }
    html += `</div>`;
  }
  jointOptionsContainer.innerHTML = html;
};

/**
 * 継手リストを描画する（ソート機能付き・編集アイコン・部材アイコン統合版）
 */
export const renderJointsList = (project) => {
  if (!project) return;
  const container = document.getElementById("joint-lists-container");
  if (!container) return;

  const renderedJointIds = new Set();

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

  const editIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
  const memberIconSvgRaw = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`;

  const populateTable = (tbodyId, joints, color) => {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    tbody.innerHTML = joints
      .map((joint) => {
        const isPin = joint.isPinJoint || false;
        const colorBadge = joint.color
          ? `<span class="inline-block w-3 h-3 rounded-full ml-2 border border-gray-400" style="background-color: ${joint.color}; vertical-align: middle;"></span>`
          : "";

        const memberIconHtml = joint.countAsMember
          ? `<span class="inline-flex items-center justify-center ml-1 text-emerald-600 dark:text-emerald-400 cursor-help" title="部材として集計される継手">${memberIconSvgRaw}</span>`
          : "";

        let boltInfo = "";
        const borderColor = "border-slate-400",
          darkBorderColor = "dark:border-slate-600";
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
            <tr class="item-row bg-${color}-50 dark:bg-transparent hover:bg-${color}-100 dark:hover:bg-slate-700/50 transition-colors" data-id="${joint.id}">
                <td class="px-3 py-3 border-b border-r ${borderColor} ${darkBorderColor}">
                    <div class="flex items-center justify-center gap-3">
                        <input type="checkbox" class="item-checkbox w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" data-id="${joint.id}" data-type="joint">
                        <button data-id="${joint.id}" class="edit-joint-btn text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors" title="編集">
                            ${editIconSvg}
                        </button>
                    </div>
                </td>
                <td class="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 border-b border-r js-searchable-name ${borderColor} ${darkBorderColor}">
                    <div class="flex items-center">
                        ${joint.name}${colorBadge}${memberIconHtml}
                    </div>
                </td>
                ${boltInfo}
                ${tempBoltCells}
            </tr>`;
      })
      .join("");
  };

  const selectAllHtml =
    '<input type="checkbox" class="select-all-checkbox w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" title="全選択/解除">';

  const sections = [
    {
      type: "girder",
      isPin: false,
      title: "大梁",
      color: "blue",
      cols: [
        { label: selectAllHtml, key: null },
        { label: "継手名", key: "name" },
        { label: "フランジ", key: "flange" },
        { label: "ウェブ", key: "web" },
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
        { label: selectAllHtml, key: null },
        { label: "継手名", key: "name" },
        { label: "ウェブ", key: "web" },
        { label: "仮ボルト", key: "temp-web" },
      ],
    },
    {
      type: "beam",
      isPin: false,
      title: "小梁",
      color: "green",
      cols: [
        { label: selectAllHtml, key: null },
        { label: "継手名", key: "name" },
        { label: "フランジ", key: "flange" },
        { label: "ウェブ", key: "web" },
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
        { label: selectAllHtml, key: null },
        { label: "継手名", key: "name" },
        { label: "ウェブ", key: "web" },
        { label: "仮ボルト", key: "temp-web" },
      ],
    },
    {
      type: "stud",
      isPin: false,
      title: "間柱",
      color: "indigo",
      cols: [
        { label: selectAllHtml, key: null },
        { label: "継手名", key: "name" },
        { label: "フランジボルト", key: "flange" },
        { label: "ウェブボルト", key: "web" },
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
        { label: selectAllHtml, key: null },
        { label: "継手名", key: "name" },
        { label: "ボルトサイズ", key: "bolt" },
        { label: "仮ボルト", key: "temp-web" },
      ],
    },
    {
      type: "column",
      isPin: false,
      title: "本柱",
      color: "red",
      cols: [
        { label: selectAllHtml, key: null },
        { label: "継手名", key: "name" },
        { label: "エレクション", key: "bolt" },
      ],
    },
    {
      type: "wall_girt",
      isPin: false,
      title: "胴縁",
      color: "gray",
      cols: [
        { label: selectAllHtml, key: null },
        { label: "継手名", key: "name" },
        { label: "ボルトサイズ", key: "bolt" },
      ],
    },
    {
      type: "roof_purlin",
      isPin: false,
      title: "母屋",
      color: "orange",
      cols: [
        { label: selectAllHtml, key: null },
        { label: "継手名", key: "name" },
        { label: "ボルトサイズ", key: "bolt" },
      ],
    },
    {
      type: "other",
      isPin: false,
      title: "その他",
      color: "amber",
      cols: [
        { label: selectAllHtml, key: null },
        { label: "継手名", key: "name" },
        { label: "フランジ", key: "flange" },
        { label: "ウェブ", key: "web" },
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
        { label: selectAllHtml, key: null },
        { label: "継手名", key: "name" },
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
  sections.forEach((section) => {
    const filteredJoints = project.joints.filter(
      (j) =>
        j.type === section.type && (j.isPinJoint || false) === section.isPin,
    );
    if (filteredJoints.length > 0) {
      filteredJoints.forEach((j) => renderedJointIds.add(j.id));
      const tbodyId = `joints-list-${section.type}${section.isPin ? "-pin" : ""}`;
      let finalCols = section.cols;
      if (filteredJoints.some((j) => j.isComplexSpl)) {
        if (section.isPin) {
          finalCols = [
            { label: selectAllHtml, key: null },
            { label: "継手名", key: "name" },
            { label: "ウェブ (複合SPL)", key: "web_complex" },
            { label: "仮ボルト (複合SPL)", key: "temp_web_complex" },
          ];
        }
      }

      const sectionId = `joint-${section.type}-${section.isPin ? "pin" : "rigid"}`;
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
            const sizeA = a.flangeSize || a.webSize || "";
            const sizeB = b.flangeSize || b.webSize || "";
            return sortState.order === "asc"
              ? boltSort(sizeA, sizeB)
              : -boltSort(sizeA, sizeB);
          } else if (key === "web_complex") {
            const getFirstSize = (j) =>
              j.isComplexSpl && j.webInputs && j.webInputs.length > 0
                ? { size: j.webInputs[0].size, isComplex: true }
                : { size: j.webSize || "", isComplex: false };
            const infoA = getFirstSize(a),
              infoB = getFirstSize(b);
            if (infoA.isComplex !== infoB.isComplex)
              return sortState.order === "asc"
                ? (infoA.isComplex ? 1 : 0) - (infoB.isComplex ? 1 : 0)
                : (infoB.isComplex ? 1 : 0) - (infoA.isComplex ? 1 : 0);
            const cmp = boltSort(infoA.size, infoB.size);
            if (cmp !== 0) return sortState.order === "asc" ? cmp : -cmp;
            return 0;
          }
        });
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

      const anchorId = `anchor-joint-${section.type}-${section.isPin ? "pin" : "rigid"}`;
      html += `
        <div id="${anchorId}" class="rounded-lg border border-slate-400 dark:border-slate-600 scroll-mt-24 mb-6" data-section-title="継手：${section.title}" data-section-color="${section.color}" data-section-id="${sectionId}">
            <h3 class="text-lg font-semibold bg-${section.color}-200 text-${section.color}-800 dark:bg-slate-700 dark:text-${section.color}-300 px-4 py-2 rounded-t-lg">${section.title}</h3>
            <div class="overflow-x-auto custom-scrollbar bg-slate-50 dark:bg-slate-800 rounded-b-lg">
                <table class="w-full min-w-[400px] text-sm text-left">
                    <thead class="bg-${section.color}-100 text-${section.color}-700 dark:bg-slate-700/50 dark:text-${section.color}-300 text-xs"><tr>${headerHtml}</tr></thead>
                    <tbody id="${tbodyId}"></tbody>
                </table>
            </div>
        </div>`;
      sectionsToRender.push({ tbodyId, filteredJoints, color: section.color });
    }
  });

  const unknownJoints = project.joints.filter(
    (j) => !renderedJointIds.has(j.id),
  );
  if (unknownJoints.length > 0) {
    const tbodyId = "joints-list-unknown";
    const headerHtml = [
      selectAllHtml,
      "継手名",
      "種別(内部値)",
      "ピン(内部値)",
      "情報",
    ]
      .map((col) => `<th class="px-4 py-3 whitespace-nowrap">${col}</th>`)
      .join("");

    html += `
        <div id="anchor-joint-unknown" class="rounded-lg border border-red-400 dark:border-red-600 scroll-mt-24 mb-6" data-section-title="未分類・不整合データ" data-section-color="red">
            <h3 class="text-lg font-semibold bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-100 px-4 py-2 rounded-t-lg flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
                未分類・不整合データ
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
            const borderColor = "border-slate-400",
              darkBorderColor = "dark:border-slate-600";
            const colorBadge = joint.color
              ? `<span class="inline-block w-3 h-3 rounded-full ml-2 border border-gray-400" style="background-color: ${joint.color}; vertical-align: middle;"></span>`
              : "";
            const memberIconHtml = joint.countAsMember
              ? `<span class="inline-flex items-center justify-center ml-1 text-emerald-600 dark:text-emerald-400 cursor-help" title="部材として集計される継手">${memberIconSvgRaw}</span>`
              : "";

            return `
                <tr class="item-row bg-red-50 dark:bg-transparent hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors" data-id="${joint.id}">
                    <td class="px-3 py-3 border-b border-r ${borderColor} ${darkBorderColor}">
                        <div class="flex items-center justify-center gap-3">
                            <input type="checkbox" class="item-checkbox w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" data-id="${joint.id}" data-type="joint">
                            <button data-id="${joint.id}" class="edit-joint-btn text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors" title="編集">
                                ${editIconSvg}
                            </button>
                        </div>
                    </td>
                    <td class="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 border-b border-r js-searchable-name ${borderColor} ${darkBorderColor}">
                        <div class="flex items-center">
                            ${joint.name}${colorBadge}${memberIconHtml}
                        </div>
                    </td>
                    <td class="px-4 py-3 border-b border-r ${borderColor} ${darkBorderColor}">${joint.type}</td>
                    <td class="px-4 py-3 border-b border-r ${borderColor} ${darkBorderColor}">${joint.isPinJoint ? "ON" : "OFF"}</td>
                    <td class="px-4 py-3 text-xs border-b border-r ${borderColor} ${darkBorderColor} text-red-600 dark:text-red-400">種類と設定の不一致</td>
                </tr>`;
          })
          .join("");
      }
    } else {
      populateTable(s.tbodyId, s.filteredJoints, s.color);
    }
  });

  const bulkBar = document.getElementById("bulk-delete-bar");
  if (bulkBar) {
    bulkBar.classList.add("translate-y-24", "opacity-0", "pointer-events-none");
  }

  // updateQuickNavLinks は ui.js（バレル）に残す関数なので、ここでは import して呼ぶ
  // 循環依存を避けるため、グローバルイベントで通知する方法もあるが、
  // ui.js から renderJointsList を呼ぶ際に ui.js 側でフックするか、
  // ui.js の updateQuickNavLinks をここで直接 import する。
  // ui.js (barrel) からは re-export されているので、下記で OK。
  // ただしバレルファイルからの循環を避けるため、ここでは直接 updateQuickNavLinks の実装を置くか、
  // コールバックを使う必要がある。
  // 今回はシンプルに ui.js のバレルから import することにし、
  // ui.js が sub-module をインポートする際に循環が生じないことを確認する。
  // renderJointsList -> updateQuickNavLinks(ui.js) -> (no sub-module deps)
  // updateQuickNavLinks は ui.js に残るため、ここからは呼べない（循環になる）。
  // 解決策: updateQuickNavLinks の実装をここで行うか、カスタムイベントを使う。
  // 今回は updateQuickNavLinks の実装を ui.js に残し、
  // renderJointsList / renderMemberLists の末尾では CustomEvent を使って通知する。
  document.dispatchEvent(new CustomEvent("quickNavLinksUpdate"));
};
