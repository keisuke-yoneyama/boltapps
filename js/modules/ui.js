import { PRESET_COLORS, HUG_BOLT_SIZES, BOLT_TYPES } from "./config.js";
import { state, MAX_HISTORY_SIZE } from "./state.js";
import {
  getProjectLevels,
  getMasterOrderedKeys,
  getBoltWeight,
  boltSort,
  aggregateByFloor,
  calculateAggregatedData,
  calculateTempBoltResults,
  ensureProjectBoltSizes,
  getTempBoltInfo,
  getTallyList,
  calculateResults,
  calculateShopTempBoltResults,
  sortGlobalBoltSizes,
  calculateAggregatedResults,
} from "./calculator.js";

import { saveGlobalBoltSizes } from "./firebase.js";

// 並び順の定義（定数として外に出しました）
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

// クイックナビゲーションの状態管理
let isQuickNavOpen = false;
// ▼▼▼ 追加: リスト描画用のコールバックを記憶する変数 ▼▼▼
let savedListCallbacks = {};

let isFabOpen = false;
// let levelNameCache = [];
// let areaNameCache = [];
let editComplexSplCache = Array.from({ length: 4 }, () => ({
  size: "",
  count: "",
}));

let newComplexSplCache = Array.from({ length: 4 }, () => ({
  size: "",
  count: "",
}));

// /**
//  * プロジェクト編集モーダルのキャッシュをクリアする
//  */
// export function resetProjectEditCache() {
//   levelNameCache = [];
//   areaNameCache = [];
// }

export function resetNewComplexSplCache() {
  newComplexSplCache = Array.from({ length: 4 }, () => ({
    size: "",
    count: "",
  }));
}

// キャッシュリセット用ヘルパー
function resetEditComplexSplCache() {
  // editComplexSplCache変数を初期化
  // (ui.js内の変数editComplexSplCacheにアクセス)
  editComplexSplCache = Array.from({ length: 4 }, () => ({
    size: "",
    count: "",
  }));
}

/**
//  * キャッシュに値を保存する（app.jsやUI描画ロジックから使う場合）
//  */
// export function updateLevelNameCache(newCache) {
//   levelNameCache = newCache;
// }

// /**
//  * キャッシュに値を保存する（app.jsやUI描画ロジックから使う場合）
//  */
// export function updateAreaNameCache(newCache) {
//   areaNameCache = newCache;
// }

// --- ▼ 追加: events.js からキャッシュを更新するための関数 ---
export function updateEditComplexSplCacheItem(index, key, value) {
  if (editComplexSplCache[index]) {
    editComplexSplCache[index][key] = value;
  }
}

// ▼▼▼ フォーカス制御用の変数 (ui.js内で管理し、exportして外部から更新可能にする) ▼▼▼
export let focusToRestore = null;
export let justFinishedIME = false;
export let isEditing = false;

// 外部（events.jsなど）からこれらを更新するためのセッター
export const setFocusState = (state) => {
  if (state.focusToRestore !== undefined) focusToRestore = state.focusToRestore;
  if (state.justFinishedIME !== undefined)
    justFinishedIME = state.justFinishedIME;
  if (state.isEditing !== undefined) isEditing = state.isEditing;
};

/**
 * トースト通知を表示する
 * @param {string} message
 * @param {number} duration
 */
export const showToast = (message, duration = 5000) => {
  // 1. トースト通知のコンテナを取得
  const container = document.getElementById("toast-container");
  if (!container) return;

  // 2. 新しいトースト要素を動的に作成
  const toastElement = document.createElement("div");
  toastElement.className = "toast-item"; // CSSで定義したスタイルを適用
  toastElement.textContent = message;

  // 3. コンテナの先頭に新しいトーストを追加
  //    （prependで追加することで、新しい通知が一番上に表示される）
  container.prepend(toastElement);

  // 4. 少し遅延させてから 'show' クラスを追加し、表示アニメーションを開始
  setTimeout(() => {
    toastElement.classList.add("show");
  }, 10); // 10ミリ秒の遅延

  // 5. 指定時間後にトーストを消す処理
  setTimeout(() => {
    // 'show' クラスを削除して、非表示アニメーションを開始
    toastElement.classList.remove("show");

    // 6. アニメーションが終わるのを待ってから、DOMから要素を完全に削除
    //    （CSSのdurationと合わせる）
    toastElement.addEventListener("transitionend", () => {
      toastElement.remove();
    });
  }, duration);
};
/**
 * 継手から「絞り込み用ID」を生成する
 */
const getJointFilterId = (joint) => {
  if (!joint) return "other";
  // すべての種別において、ピン取り(isPinJoint)がONなら "_pin" を付与
  return joint.type + (joint.isPinJoint ? "_pin" : "");
};

/**
 * 絞り込みIDから表示名を取得する
 */
const getJointFilterLabel = (filterId) => {
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
 * 継手の種別とピン取り設定から、カテゴリカラー（昼/夜対応）を返却する
 */
const getJointCategoryColorClasses = (joint) => {
  if (!joint) return "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200";
  const t = joint.type;
  const p = joint.isPinJoint;

  // ダークモード時は背景を深く、文字を明るく設定
  if (t === "girder") {
    return p 
      ? "bg-cyan-200 text-cyan-900 border-cyan-300 dark:bg-cyan-900 dark:text-cyan-100 dark:border-cyan-700" 
      : "bg-blue-200 text-blue-900 border-blue-300 dark:bg-blue-900 dark:text-blue-100 dark:border-blue-700";
  }
  if (t === "beam") {
    return p 
      ? "bg-teal-200 text-teal-900 border-teal-300 dark:bg-teal-900 dark:text-teal-100 dark:border-teal-700" 
      : "bg-green-200 text-green-900 border-green-300 dark:bg-emerald-900 dark:text-emerald-100 dark:border-emerald-700";
  }
  if (t === "column") return "bg-red-200 text-red-900 border-red-300 dark:bg-rose-900 dark:text-rose-100 dark:border-rose-700";
  if (t === "stud") {
    return p 
      ? "bg-purple-200 text-purple-900 border-purple-300 dark:bg-purple-900 dark:text-purple-100 dark:border-purple-700" 
      : "bg-indigo-200 text-indigo-900 border-indigo-300 dark:bg-indigo-900 dark:text-indigo-100 dark:border-indigo-700";
  }
  if (t === "wall_girt") return "bg-gray-200 text-gray-900 border-gray-300 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600";
  if (t === "roof_purlin") return "bg-orange-200 text-orange-900 border-orange-300 dark:bg-orange-900 dark:text-orange-100 dark:border-orange-700";
  
  return "bg-amber-200 text-amber-900 border-amber-300 dark:bg-amber-900 dark:text-amber-100 dark:border-amber-700";
};

/**
 * 継手の構成に基づき「継手名：n本」のペアを動的に生成する（ツールチップ用）
 */
const getBoltTooltipText = (joint) => {
  if (!joint) return "";
  let lines = [];
  const name = joint.name || "継手名未設定";

  // 胴縁(wall_girt)と母屋(roof_purlin)はピン取りと同じ「部位名なし」の処理
  const isSimpleLabel = joint.isPinJoint || joint.type === "wall_girt" || joint.type === "roof_purlin";

  if (joint.isComplexSpl && joint.webInputs) {
    joint.webInputs.forEach((w) => {
      if (w.count > 0) lines.push(`${w.name || name}：${w.count}本`);
    });
  } else if (isSimpleLabel) {
    const total = (joint.webCount || 0) + (joint.flangeCount || 0);
    if (total > 0) lines.push(`${name}：${total}本`);
  } else {
    // 剛接合などの部位（F/W）を分ける必要があるもの
    if (joint.flangeCount > 0) lines.push(`${name}(F)：${joint.flangeCount}本`);
    if (joint.webCount > 0) lines.push(`${name}(W)：${joint.webCount}本`);
  }
  
  return lines.length > 0 ? lines.join("\n") : "ボルト設定なし";
};

export const openModal = (modalElement) => {
  if (!modalElement) return;

  modalElement.classList.remove("hidden");

  if (modalElement.classList.contains("modeless")) {
    // フローティングの場合：透明な幕を表示してクリックをブロック（スクロールは効く）
    const backdrop = document.getElementById("modeless-backdrop");
    if (backdrop) backdrop.classList.remove("hidden");
  } else {
    // 通常モーダルの場合：bodyのスクロールを止める
    document.body.classList.add("overflow-hidden");
  }

  setTimeout(() => modalElement.classList.remove("opacity-0"), 10);
};

export const closeModal = (modalElement) => {
  modalElement.classList.add("opacity-0");

  if (modalElement.classList.contains("modeless")) {
    const backdrop = document.getElementById("modeless-backdrop");
    if (backdrop) backdrop.classList.add("hidden");
  } else {
    document.body.classList.remove("overflow-hidden");
  }

  setTimeout(() => modalElement.classList.add("hidden"), 300);
};

/**
 * カスタムアラートを表示する
 * (要素を関数内で取得するため、事前の変数定義は不要です)
 */
export const showCustomAlert = (message, options = {}) => {
  const { title = "エラー", type = "error", invalidElements = [] } = options;

  // 1. エラーハイライトのリセット
  document
    .querySelectorAll(".input-error")
    .forEach((el) => el.classList.remove("input-error"));

  // 2. 新しいエラー箇所のハイライト
  // invalidElementsはDOM要素そのものが渡ってくる想定なのでそのまま使用
  if (Array.isArray(invalidElements)) {
    invalidElements.forEach((el) => {
      if (el && el.classList) el.classList.add("input-error");
    });
  }

  // 3. IDを使って要素をその場で取得 (これがポイント！)
  const customAlertModal = document.getElementById("custom-alert-modal");
  const customAlertTitle = document.getElementById("custom-alert-title");
  const customAlertMessage = document.getElementById("custom-alert-message");

  // 要素が見つからなければ何もしない（安全策）
  if (!customAlertModal || !customAlertTitle || !customAlertMessage) {
    console.error("Alert modal elements not found in DOM.");
    alert(message); // フォールバック
    return;
  }

  // 4. 内容のセット
  customAlertTitle.textContent = title;
  customAlertMessage.textContent = message;

  // 5. 色の切り替え
  customAlertTitle.classList.remove("text-red-600", "text-green-600");
  if (type === "success") {
    customAlertTitle.classList.add("text-green-600");
  } else {
    customAlertTitle.classList.add("text-red-600");
  }

  // 6. モーダルを開く (同じファイル内の関数を使用)
  openModal(customAlertModal);
};

/**
 * 複合スプライスの入力欄（Web入力グループ）の表示数を制御する
 * @param {number} count - 表示数 (2〜4)
 * @param {Array} cache - 入力値を保持している配列 (サイズと本数のペア)
 * @param {boolean} isModal - モーダルかどうか（IDプレフィックスの切り替え用）
 */
export function renderComplexSplInputs(count, cache, isModal) {
  for (let i = 1; i <= 4; i++) {
    const prefix = isModal ? "edit-" : "";

    // ▼▼▼ 修正箇所（ID生成ロジック） ▼▼▼
    let groupId;
    if (isModal && i === 1) {
      groupId = "edit-web-group"; // モーダルの1つ目のグループID
    } else {
      const baseId = `${prefix}web-input-group`;
      groupId = i > 1 ? `${baseId}-${i}` : baseId;
    }
    // ▲▲▲ 修正箇所ここまで ▲▲▲

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
        // キャッシュがあれば値を復元、なければ空文字
        // (cache変数は引数で渡ってくるので、ui.js内の変数でもstate.jsの変数でも対応可能)
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
 * @param {number} delta - 増減値 (+1 または -1)
 */
export function changeEditComplexSplCount(delta) {
  console.log("① ボタンクリック検知: delta =", delta); // ログ追加
  // 1. ここで要素を取得する（events.js にIDを書かせないため）
  const editComplexSplCountInput = document.getElementById(
    "edit-complex-spl-count",
  );

  if (!editComplexSplCountInput) {
    console.error("② エラー: 入力欄(edit-complex-spl-count)が見つかりません！"); // ログ追加
    return;
  }

  console.log("③ 入力欄取得成功:", editComplexSplCountInput.value); // ログ追加
  // 2. 内部のキャッシュ変数を使って更新ロジックを呼ぶ
  updateComplexSplCount(
    editComplexSplCountInput, //もとの値
    editComplexSplCache, // ここで管理している変数
    true, // isModal
    delta, // change 増減値
  );
}

export function changeComplexSplCount(delta) {
  // 1. ここで要素を取得する（events.js にIDを書かせないため）

  console.log("① ボタンクリック検知: delta =", delta); // ログ追加
  const complexSplCountInput = document.getElementById("complex-spl-count");

  if (!complexSplCountInput) {
    console.error(
      "② エラー: 入力欄(complex-spl-count-input)が見つかりません！",
    ); // ログ追加
    return;
  }

  console.log("③ 入力欄取得成功:", complexSplCountInput.value); // ログ追加
  // 2. 内部のキャッシュ変数を使って更新ロジックを呼ぶ
  updateComplexSplCount(
    complexSplCountInput, //もとの値
    newComplexSplCache, // ここで管理している変数
    false, // isModal
    delta, // change 増減値
  );
}

/**
 * 接合部入力フォームのUI（表示・非表示など）を更新する
 * @param {boolean} isModal - モーダル（編集）かどうか
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

  // ▼▼▼ 追加: 要素の取得 ▼▼▼
  const bundleGroup = document.getElementById(`${prefix}bundle-column-group`);
  const isBundledInput = document.getElementById(
    `${prefix}is-bundled-with-column`,
  );
  // ▲▲▲ 追加ここまで ▲▲▲

  const type = elements.type.value;
  // ピン接合が可能なタイプ
  const twoBoltTypes = ["girder", "beam", "other", "stud"];
  // 単一ボルト入力のタイプ
  const oneBoltTypes = ["column", "wall_girt", "roof_purlin"];

  // ▼▼▼ 修正：タイプがピン非対応なら強制的にfalse扱いにする ▼▼▼
  // これにより、他でピンをONにしたまま胴縁に変えても入力欄が消えない
  const isPin = twoBoltTypes.includes(type) && elements.isPin?.checked;

  const tempSetting = elements.tempSetting?.value;
  const isDoubleShear = elements.isDoubleShear?.checked;

  // ▼▼▼ 追加: 本柱の場合は「本柱と同梱」オプションを隠す ▼▼▼
  if (bundleGroup) {
    if (type === "column") {
      bundleGroup.classList.add("hidden");
      if (isBundledInput) isBundledInput.checked = false; // 非表示時はOFFにする
    } else {
      bundleGroup.classList.remove("hidden");
    }
  }
  // ▲▲▲ 追加ここまで ▲▲▲
  // ▼▼▼ 修正：表示ロジックの整理 ▼▼▼
  if (oneBoltTypes.includes(type)) {
    // 胴縁・母屋・本柱の場合
    if (elements.flangeGroup) elements.flangeGroup.style.display = "grid"; // 常に表示
    if (elements.webGroup) elements.webGroup.style.display = "none"; // 常に非表示
  } else {
    // 大梁・小梁などの場合
    if (elements.flangeGroup)
      elements.flangeGroup.style.display = isPin ? "none" : "grid";
    if (elements.webGroup) elements.webGroup.style.display = "grid";
  }
  // ▲▲▲ 修正ここまで ▲▲▲

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
    // 胴縁・母屋
    if (elements.flangePlaceholder)
      elements.flangePlaceholder.placeholder = "ボルト サイズ";
    if (elements.flangeLabel) elements.flangeLabel.textContent = "ボルト情報";
  } else {
    // 大梁など
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
 * カラーパレットを描画する（イベントリスナーはここでは付けない！）
 */
export function renderColorPalette(selectedColor) {
  const container = document.getElementById("color-palette-container");
  if (!container) return;

  container.innerHTML = "";

  PRESET_COLORS.forEach((color) => {
    const swatch = document.createElement("div");
    swatch.className = "color-swatch";
    swatch.style.backgroundColor = color;
    swatch.dataset.color = color; // データ属性に色を持たせる

    if (color === selectedColor) {
      swatch.classList.add("selected");
    }

    // ★重要: ここにあった addEventListener は削除！

    container.appendChild(swatch);
  });
}

/**
 * パレットの色が選択されたときのUI更新処理
 */
export function selectColor(color) {
  // 1. すべての選択状態を解除
  document.querySelectorAll(".color-swatch").forEach((el) => {
    el.classList.remove("selected");
  });

  // 2. 該当する色のスウォッチを選択状態にする
  // (データ属性を使って要素を探すテクニック)
  const targetSwatch = document.querySelector(
    `.color-swatch[data-color="${color}"]`,
  );
  if (targetSwatch) {
    targetSwatch.classList.add("selected");
  }

  // 3. 入力欄（隠しフィールド）の更新
  const input = document.getElementById("edit-joint-color");
  if (input) {
    input.value = color;
    input.dataset.isNull = "false";
  }
}

export function openEditModal(joint) {
  // 1. 各要素への値セット (変数が使えないので getElementById を使用)
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

  // 本柱同梱
  setCheck("edit-is-bundled-with-column", joint.isBundledWithColumn || false);

  // 色設定
  const colorInput = document.getElementById("edit-joint-color");
  if (colorInput) {
    if (joint.color) {
      colorInput.value = joint.color;
      colorInput.dataset.isNull = "false";
      renderColorPalette(joint.color); // ui.js内にあれば呼び出す
    } else {
      colorInput.value = "#ffffff";
      colorInput.dataset.isNull = "true";
      renderColorPalette(null);
    }
  }

  setVal("edit-flange-size", joint.flangeSize);
  setVal("edit-flange-count", joint.flangeCount);
  setVal("edit-web-size", joint.webSize);
  setVal("edit-web-count", joint.webCount);
  setVal("edit-temp-bolt-setting", joint.tempBoltSetting || "none");

  // 仮ボルト詳細
  setVal("edit-shop-temp-bolt-count", joint.shopTempBoltCount ?? "");
  setVal("edit-shop-temp-bolt-size", joint.shopTempBoltSize || "");
  setVal("edit-shop-temp-bolt-count-f", joint.shopTempBoltCount_F ?? "");
  setVal("edit-shop-temp-bolt-size-f", joint.shopTempBoltSize_F || "");
  setVal("edit-shop-temp-bolt-count-w", joint.shopTempBoltCount_W ?? "");
  setVal("edit-shop-temp-bolt-size-w", joint.shopTempBoltSize_W || "");

  // 複合スプライス設定
  setCheck("edit-is-complex-spl", joint.isComplexSpl || false);
  setVal("edit-complex-spl-count", joint.complexSplCount || "2");

  // 2. キャッシュの初期化
  // (resetEditComplexSplCache関数がある前提、なければここで空配列化)
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

  // ★重要: ここにあった addEventListener のループ処理は削除します！
  // 代わりに events.js で一度だけ設定します。

  // 3. UI更新とモーダル表示
  updateJointFormUI(true);

  // openModal も ui.js 内の関数ならそのまま呼べます
  const editModal = document.getElementById("edit-joint-modal");
  openModal(editModal);
}

/**
 * 編集用ドロップダウンに選択肢（ジョイント一覧）を生成する
 * @param {HTMLElement} selectElement - <select>要素
 * @param {string} currentJointId - 現在選択されているID
 */
export const populateJointDropdownForEdit = (selectElement, currentJointId) => {
  // 安全対策: 要素がなければ何もしない
  if (!selectElement) return;

  const project = state.projects.find((p) => p.id === state.currentProjectId);
  if (!project) return;

  selectElement.innerHTML = "";

  // 表示用データの作成（フィルタリングとソート）
  const availableJoints = project.joints
    .filter((j) => !j.countAsMember)
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));

  // 選択肢の生成
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

// /**
//  * 登録用FAB（フローティングアクションボタン）の開閉を切り替える
//  * @param {boolean} [forceState] - 強制的に開く(true)か閉じる(false)か指定したい場合
//  */
// export function toggleFab(forceState) {
//   // 1. 新しい状態を決定
//   const newState = typeof forceState === "boolean" ? forceState : !isFabOpen;
//   if (newState === isFabOpen) return;

//   isFabOpen = newState;

//   // 2. DOM要素の取得 (IDはHTMLに合わせてください)
//   const fabIconPlus = document.getElementById("fab-icon-plus");
//   const buttons = [
//     document.getElementById("fab-add-joint"),
//     document.getElementById("fab-add-member"),
//     document.getElementById("fab-bulk-add-member"), // 追加されたボタン
//     document.getElementById("fab-temp-bolt"),
//   ].filter((el) => el !== null); // 存在しない要素は除外

//   // 3. クラスの付け替え（アニメーション制御）
//   if (isFabOpen) {
//     if (fabIconPlus) fabIconPlus.style.transform = "rotate(45deg)";

//     buttons.forEach((btn) => {
//       btn.classList.remove(
//         "translate-y-10",
//         "opacity-0",
//         "pointer-events-none",
//       );
//       btn.classList.add("pointer-events-auto");
//     });
//   } else {
//     if (fabIconPlus) fabIconPlus.style.transform = "rotate(0deg)";

//     buttons.forEach((btn) => {
//       btn.classList.add("translate-y-10", "opacity-0", "pointer-events-none");
//       btn.classList.remove("pointer-events-auto");
//     });
//   }
// }

// // --- FABの外部クリック判定用 ---
// export function closeFabIfOutside(targetElement) {
//   // isFabOpen は ui.js 内のローカル変数
//   const fabContainer = document.getElementById("master-fab-container");
//   // FABが開いていて、かつクリックされたのがFABの外側なら閉じる
//   if (isFabOpen && fabContainer && !fabContainer.contains(targetElement)) {
//     toggleFab(false);
//   }
// }

/**
 * 継手の新規登録モーダルを開く（フォームリセット含む）
 */
export function openNewJointModal() {
  // toggleFab(false); // メニューを閉じる

  // タイトル変更
  const title = document.querySelector("#edit-joint-modal h3");
  if (title) title.textContent = "継手の新規登録";

  // フォームリセット (ヘルパー関数を作ると楽ですが、ベタ書きでもOK)
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

  // 仮ボルト詳細リセット
  ["count", "size", "count-f", "size-f", "count-w", "size-w"].forEach(
    (suffix) => {
      setVal(`edit-shop-temp-bolt-${suffix}`, "");
    },
  );

  // キャッシュのリセット (ui.js内の変数)
  // editComplexSplCache は let で定義されている必要があります
  // もし export されていないなら直接代入、 export されているならセッター関数を使う
  resetEditComplexSplCache(); // ※下で作る関数

  // 色のリセット
  const colorInput = document.getElementById("edit-joint-color");
  if (colorInput) {
    colorInput.value = "#ffffff";
    colorInput.dataset.isNull = "true";
    renderColorPalette(null); // 選択解除
  }

  updateJointFormUI(true);

  const modal = document.getElementById("edit-joint-modal");
  openModal(modal);
}

/**
 * 部材の新規登録モーダルを開く
 */
export function openNewMemberModal() {
  // toggleFab(false);

  const project = state.projects.find((p) => p.id === state.currentProjectId);
  if (!project) return;

  const title = document.querySelector("#edit-member-modal h3");
  if (title) title.textContent = "部材の新規登録";

  const idInput = document.getElementById("edit-member-id");
  const nameInput = document.getElementById("edit-member-name");
  const jointSelect = document.getElementById("edit-member-joint-select");
  const levelsContainer = document.getElementById(
    "edit-member-levels-container",
  );

  if (idInput) idInput.value = "";
  if (nameInput) nameInput.value = "";

  // ドロップダウン生成
  populateJointDropdownForEdit(jointSelect, "");

  // 階層チェックボックス生成
  if (levelsContainer) {
    levelsContainer.innerHTML = "";
    const levels = getProjectLevels(project);
    levels.forEach((lvl) => {
      const label = document.createElement("label");
      label.className = "flex items-center gap-2 text-sm cursor-pointer";
      label.innerHTML = `<input type="checkbox" value="${lvl.id}" class="level-checkbox h-4 w-4 text-blue-600 rounded border-gray-300"> ${lvl.label}`;
      levelsContainer.appendChild(label);
    });
  }

  const modal = document.getElementById("edit-member-modal");
  openModal(modal);
}

/**
 * 仮ボルト設定モーダルを開く
 */
export function openTempBoltSettingsModal() {
  // toggleFab(false);
  const project = state.projects.find((p) => p.id === state.currentProjectId);

  // populateTempBoltMappingModal が ui.js にあるか、importしている前提
  populateTempBoltMappingModal(project);

  const modal = document.getElementById("temp-bolt-mapping-modal");
  openModal(modal);
}

/**
 * 仮ボルト設定モーダルの中身（マッピングリスト）を生成する
 */
export const populateTempBoltMappingModal = (project) => {
  if (!project) return;

  // 1. 要素の取得 (変数は使えないのでIDで取得)
  const container = document.getElementById("temp-bolt-mapping-container");
  if (!container) return;

  container.innerHTML = "";
  const requiredFinalBolts = new Set();

  // 2. 必要なボルトの抽出 (ロジックはそのまま)
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
          if (input.size) {
            requiredFinalBolts.add(input.size);
          }
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

  // 3. ソート処理 (そのまま)
  const sortedFinalBolts = Array.from(requiredFinalBolts).sort((a, b) => {
    const regex = /M(\d+)[×xX](\d+)/;
    const matchA = a.match(regex);
    const matchB = b.match(regex);

    if (matchA && matchB) {
      const diameterA = parseInt(matchA[1]);
      const lengthA = parseInt(matchA[2]);
      const diameterB = parseInt(matchB[1]);
      const lengthB = parseInt(matchB[2]);

      if (diameterA !== diameterB) {
        return diameterA - diameterB;
      }
      return lengthA - lengthB;
    }
    return a.localeCompare(b);
  });

  // 4. HTML生成 (HUG_BOLT_SIZESを使用)
  const existingMap = project.tempBoltMap || {};
  const rowsHtml = sortedFinalBolts
    .map((boltSize) => {
      const boltSeriesMatch = boltSize.match(/M\d+/);
      if (!boltSeriesMatch) return "";

      const boltSeries = boltSeriesMatch[0];
      // ここで HUG_BOLT_SIZES を使う
      const availableHugBolts = HUG_BOLT_SIZES[boltSeries] || [];
      const savedHugBolt = existingMap[boltSize] || "";

      const hugBoltOptions = availableHugBolts
        .map(
          (size) =>
            `<option value="${size}" ${
              size === savedHugBolt ? "selected" : ""
            }>${size}</option>`,
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

// /**
//  * クイックナビとFABボタンの表示/非表示を更新する
//  */
// export const updateQuickNavVisibility = () => {
//   // 1. 要素の取得 (IDはHTMLに合わせてください)
//   const quickNavContainer = document.getElementById("quick-nav-container");
//   const fabContainer = document.getElementById("fab-container");

//   if (!quickNavContainer || !fabContainer) return;

//   // 2. 表示ロジック
//   // プロジェクトが開かれているならクイックナビは常に表示
//   if (state.currentProjectId) {
//     quickNavContainer.classList.remove("hidden");

//     // 登録FABは「継手と部材(joints)」タブの時だけ表示
//     if (state.activeTab === "joints") {
//       fabContainer.classList.remove("hidden");
//     } else {
//       fabContainer.classList.add("hidden");

//       // FABを強制的に閉じる (falseを渡せば閉じるように作ったはずなのでこれでOK)
//       toggleFab(false);
//     }
//   } else {
//     // プロジェクトが開いていないときは両方隠す
//     quickNavContainer.classList.add("hidden");
//     fabContainer.classList.add("hidden");
//   }
// };

/**
 * 常設フォーム用のカラーパレットを描画する
 */
export function renderStaticColorPalette(selectedColor) {
  // ※IDはHTMLに合わせて修正してください
  const container = document.getElementById("static-color-palette-container");
  if (!container) return;

  container.innerHTML = "";

  PRESET_COLORS.forEach((color) => {
    const swatch = document.createElement("div");
    swatch.className = "color-swatch";
    swatch.style.backgroundColor = color;
    swatch.dataset.color = color; // データ属性に色を持たせる

    if (color === selectedColor) {
      swatch.classList.add("selected");
    }

    // ★イベントリスナーはここには書かない！

    container.appendChild(swatch);
  });
}

/**
 * 常設フォームの色が選択されたときのUI更新処理
 */
export function selectStaticColor(color) {
  const container = document.getElementById("static-color-palette-container");
  if (!container) return;

  // 1. このコンテナ内の選択状態だけを解除
  container.querySelectorAll(".color-swatch").forEach((el) => {
    el.classList.remove("selected");
  });

  // 2. 該当する色を選択状態に
  const targetSwatch = container.querySelector(
    `.color-swatch[data-color="${color}"]`,
  );
  if (targetSwatch) {
    targetSwatch.classList.add("selected");
  }

  // 3. 入力欄の更新
  const input = document.getElementById("joint-color-input");
  if (input) {
    input.value = color;
  }
}

//まとめ設定関係の変数
export let currentGroupingState = {};
export let currentViewMode = "detailed";

// --- ★新規追加: 仮ボルト用の変数 ---
export let currentTempGroupingState = {}; // 仮ボルト用まとめ設定
export let currentTempViewMode = "detailed"; // 仮ボルト用ビューモード (detailed | floor)

// 外部からモードを変更するためのセッター関数（あると便利）
export function setCurrentViewMode(mode) {
  currentViewMode = mode;
}
export function resetCurrentGroupingState() {
  currentGroupingState = {};
}

// セッター関数
export function setCurrentTempViewMode(mode) {
  currentTempViewMode = mode;
}
export function resetCurrentTempGroupingState() {
  currentTempGroupingState = {};
}

/**
 * 工区まとめ設定UIを描画する関数（汎用化修正版）
 * @param {HTMLElement} container - 描画先コンテナ
 * @param {Object} originalResults - データ
 * @param {Object} project - プロジェクト情報
 * @param {Function} onUpdate - 更新時のコールバック
 * @param {Object} targetState - ★追加: 操作対象の状態オブジェクト (currentGroupingState または currentTempGroupingState)
 * @param {string} targetViewMode - ★追加: 現在のビューモード
 */
/**
 * 工区まとめ設定UIを描画する関数
 * @param {Array} customKeys ★追加: キーのリストを強制指定する場合に使用 (デフォルトはnull)
 */
export function renderGroupingControls(
  container,
  originalResults,
  project,
  onUpdate,
  targetState,
  targetViewMode,
  customKeys = null, // ▼▼▼ 修正: 第7引数を追加 (デフォルトnull) ▼▼▼
) {
  // 安全対策
  if (!container) return;

  // 現在の開閉状態を保存
  const existingDetails = container.querySelector("details");
  const wasOpen = existingDetails ? existingDetails.open : false;

  container.innerHTML = "";

  if (targetViewMode === "floor") {
    container.style.display = "none";
    return;
  }
  container.style.display = "block";

  // ▼▼▼ 修正: キーリストの決定ロジックを変更 ▼▼▼
  // customKeysが渡されていればそれを使い、なければ従来通り getMasterOrderedKeys を使う
  let targetKeys;

  if (customKeys && Array.isArray(customKeys)) {
    // 【新機能用】外部からキーが指定された場合 (例: 工区集計モード)
    // データ(originalResults)に存在するキーだけを抽出
    targetKeys = customKeys.filter((k) => originalResults[k]);
  } else {
    // 【従来通り】詳細モードなど
    const masterKeys = getMasterOrderedKeys(project);
    targetKeys = masterKeys.filter((k) => originalResults[k]);
  }
  // ▲▲▲ 修正ここまで ▲▲▲

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

  // リセットボタンエリア
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
    // ▼▼▼ 修正: 上記で決定した targetKeys に基づいてリセットを行う ▼▼▼
    targetKeys.forEach((key, index) => {
      targetState[key] = index + 1;
    });
    // ▲▲▲ 修正ここまで ▲▲▲
    onUpdate(); // コールバック実行
  };

  actionArea.appendChild(resetBtn);
  content.appendChild(actionArea);

  // ドロップダウンリスト
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
 * テーブル群を描画する関数（汎用版・修正版）
 * @param {HTMLElement} container  描画先のdiv要素
 * @param {Object} aggregatedCounts [本ボルト用] 合算されたデータ { "1F": { "M16...": 10 } }
 * @param {Array} sortedKeys        [本ボルト用] 表示順序のキー配列 ["M2F", "2F", ...]
 * @param {Object} specialBolts     [特殊用] { dLock: {...}, naka: {...}, column: {...} }
 * @param {boolean} onlySpecial     trueなら本ボルト(aggregatedCounts)の描画をスキップする
 * @param {boolean} isTempBolt      ★追加: trueなら仮ボルトモード（重量なし、種別ハイフン）
 */
export function renderAggregatedTables(
  container,
  aggregatedCounts,
  sortedKeys,
  specialBolts = {},
  onlySpecial = false,
  isTempBolt = false, // ▼▼▼ 変更: ここに追加しました
) {
  // コンテナのクリア
  container.innerHTML = "";

  // データ生成ヘルパー
  const renderTableHtml = (title, data, color, customHeader = null) => {
    if (!data || Object.keys(data).length === 0) return "";

    // ▼▼▼ 変更: ヘッダー生成ロジックを修正 (重量列の出し分け) ▼▼▼
    let headers = "";
    if (customHeader) {
      headers = customHeader;
    } else {
      // 通常ヘッダー
      // 重量列は isTempBolt が false の場合のみ表示する
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
    // ▲▲▲ 変更ここまで ▲▲▲

    let body = "";
    let tableTotalWeight = 0;

    Object.keys(data)
      .sort(boltSort)
      .forEach((key) => {
        // ▼▼▼ 変更: データ構造の正規化 (totalプロパティがある場合と数値そのままの場合に対応) ▼▼▼
        const rawValue = data[key];
        const boltCount =
          typeof rawValue === "object" &&
          rawValue !== null &&
          rawValue.total !== undefined
            ? rawValue.total
            : rawValue;
        // ▲▲▲ 変更ここまで ▲▲▲

        let rowWeightKg = 0;
        let weightValue = "-";
        let weightTooltip = "";

        // ▼▼▼ 変更: 重量計算ロジック (仮ボルト以外の場合のみ実行) ▼▼▼
        if (!isTempBolt) {
          const singleWeightG = getBoltWeight(key);
          rowWeightKg = (boltCount * singleWeightG) / 1000;
          tableTotalWeight += rowWeightKg;

          weightValue = rowWeightKg > 0 ? rowWeightKg.toFixed(1) : "-";
          weightTooltip =
            singleWeightG > 0 ? `単体重量: ${singleWeightG} g` : "";
        }
        // ▲▲▲ 変更ここまで ▲▲▲

        // ▼▼▼ 変更: 種別判定ロジック (仮ボルトはハイフン、それ以外はS10T/F8T判定) ▼▼▼
        let type = "-";
        if (!isTempBolt) {
          // 末尾チェック(endsWith)から、文字を含むか(includes)に変更済みのコード
          type = key.includes("■") ? "F8T" : "S10T";
        }
        // ▲▲▲ 変更ここまで ▲▲▲

        const commonCellClass = `px-4 py-2 border border-${color}-200 dark:border-slate-700 text-center`;

        let rowContent = "";
        if (customHeader) {
          // 簡易版（D-Lockなど）
          rowContent = `
                    <td class="${commonCellClass}">${key}</td>
                    <td class="${commonCellClass} font-medium">${boltCount.toLocaleString()}</td>
                `;
        } else {
          // 通常版
          const displayKey = title === "柱用" ? key.replace("(本柱)", "") : key;

          // ▼▼▼ 変更: 行のHTML生成 (重量セルの出し分け) ▼▼▼
          const weightCell = !isTempBolt
            ? `<td class="${commonCellClass} text-slate-500" title="${weightTooltip}">${weightValue}</td>`
            : "";

          rowContent = `
                    <td class="${commonCellClass}">${type}</td>
                    <td class="${commonCellClass}">${displayKey}</td>
                    <td class="${commonCellClass} font-medium">${boltCount.toLocaleString()}</td>
                    ${weightCell}
                `;
          // ▲▲▲ 変更ここまで ▲▲▲
        }

        body += `<tr class="hover:bg-${color}-50 dark:hover:bg-slate-700/50">${rowContent}</tr>`;
      });

    // ▼▼▼ 変更: 合計重量の表示条件 (仮ボルトの場合は表示しない) ▼▼▼
    const totalWeightDisplay =
      !isTempBolt && !customHeader && tableTotalWeight > 0
        ? `<span class="ml-auto text-sm font-bold text-red-600 dark:text-red-400">合計: ${tableTotalWeight.toFixed(
            1,
          )} kg</span>`
        : "";
    // ▲▲▲ 変更ここまで ▲▲▲

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

  // 1. 通常データ（本ボルトなど）の描画
  // onlySpecialがfalseのときだけ実行される（本ボルトセクション用）
  if (!onlySpecial && aggregatedCounts) {
    // キー配列がある場合はその順序で、なければオブジェクトのキー順で
    const keysToRender = sortedKeys || Object.keys(aggregatedCounts);

    keysToRender.forEach((groupName) => {
      if (aggregatedCounts[groupName]) {
        // ▼▼▼ 変更: ヘッダー色を仮ボルト時はtealに変更 ▼▼▼
        const headerColor = isTempBolt ? "teal" : "slate";
        tablesHtml += renderTableHtml(
          groupName,
          aggregatedCounts[groupName],
          headerColor,
        );
        // ▲▲▲ 変更ここまで ▲▲▲
      }
    });

    // マスタ外（その他）のキーを表示
    if (sortedKeys) {
      Object.keys(aggregatedCounts).forEach((key) => {
        if (!sortedKeys.includes(key)) {
          // ▼▼▼ 変更: ヘッダー色を仮ボルト時はtealに変更 ▼▼▼
          const headerColor = isTempBolt ? "teal" : "slate";
          tablesHtml += renderTableHtml(
            key,
            aggregatedCounts[key],
            headerColor,
          );
          // ▲▲▲ 変更ここまで ▲▲▲
        }
      });
    }
  }

  // 2. 特殊データ（指定があれば描画）
  if (specialBolts) {
    // 柱用 (Purple) -> 本ボルトセクションの一部として表示される想定
    if (specialBolts.column) {
      tablesHtml += renderTableHtml("柱用", specialBolts.column, "purple");
    }

    // 簡易ヘッダー定義
    const simpleHeader = (color) => `<tr>
            <th class="px-4 py-2 border border-${color}-300 dark:border-slate-600 text-center bg-${color}-200 dark:bg-slate-700 text-${color}-800 dark:text-${color}-200 whitespace-nowrap">ボルトサイズ</th>
            <th class="px-4 py-2 border border-${color}-300 dark:border-slate-600 text-center bg-${color}-200 dark:bg-slate-700 text-${color}-800 dark:text-${color}-200 whitespace-nowrap">本数</th>
        </tr>`;

    // D-Lock (Gray)
    if (specialBolts.dLock) {
      tablesHtml += renderTableHtml(
        "D-Lock",
        specialBolts.dLock,
        "gray",
        simpleHeader("gray"),
      );
    }
    // 中ボルト・ミリ (Blue)
    if (specialBolts.naka) {
      tablesHtml += renderTableHtml(
        "中ボルト(ミリ)",
        specialBolts.naka,
        "blue",
        simpleHeader("blue"),
      );
    }
    // 中ボルト・Mネジ (Teal)
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
 * モーダル要素をドラッグ可能にするUIヘルパー関数
 * @param {HTMLElement} modalElement - ドラッグ対象のモーダル要素
 */
export const makeDraggable = (modalElement) => {
  // 安全対策
  if (!modalElement) return;

  const header = modalElement.querySelector(".border-b"); // ヘッダー部分をハンドルにする
  if (!header) return;

  header.style.cursor = "move"; // マウス用カーソル
  header.style.touchAction = "none"; // タッチ時のスクロールを無効化（ドラッグ優先）

  let isDragging = false;
  let startX, startY, initialLeft, initialTop;

  // --- 共通処理：ドラッグ開始 ---
  const startDrag = (clientX, clientY) => {
    isDragging = true;
    startX = clientX;
    startY = clientY;

    // 現在の位置を取得
    const rect = modalElement.getBoundingClientRect();

    // CSSのtransformによる中央揃えを解除し、絶対座標に変換して固定する
    if (modalElement.style.transform !== "none") {
      modalElement.style.left = `${rect.left}px`;
      modalElement.style.top = `${rect.top}px`;
      modalElement.style.transform = "none";
      modalElement.style.bottom = "auto";
      modalElement.style.right = "auto";
    }

    initialLeft = parseInt(modalElement.style.left || rect.left);
    initialTop = parseInt(modalElement.style.top || rect.top);
  };

  // --- 共通処理：ドラッグ中 ---
  const moveDrag = (clientX, clientY) => {
    if (!isDragging) return;
    const dx = clientX - startX;
    const dy = clientY - startY;
    modalElement.style.left = `${initialLeft + dx}px`;
    modalElement.style.top = `${initialTop + dy}px`;
  };

  // --- 共通処理：ドラッグ終了 ---
  const endDrag = () => {
    isDragging = false;
  };

  // --- マウスイベントの設定 ---
  header.addEventListener("mousedown", (e) => startDrag(e.clientX, e.clientY));
  document.addEventListener("mousemove", (e) => {
    if (isDragging) {
      e.preventDefault();
      moveDrag(e.clientX, e.clientY);
    }
  });
  document.addEventListener("mouseup", endDrag);

  // --- タッチイベントの設定 ---
  header.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        startDrag(touch.clientX, touch.clientY);
      }
    },
    { passive: false },
  );

  document.addEventListener(
    "touchmove",
    (e) => {
      if (isDragging && e.touches.length === 1) {
        e.preventDefault();
        const touch = e.touches[0];
        moveDrag(touch.clientX, touch.clientY);
      }
    },
    { passive: false },
  );

  document.addEventListener("touchend", endDrag);
};

/**
 * グローバルボルト選択モーダルの中身を生成する
 */
export const populateGlobalBoltSelectorModal = () => {
  // 1. 要素の取得
  const container = document.getElementById("bolt-options-container");
  if (!container) return;

  container.innerHTML = "";

  const bolts = state.globalBoltSizes || [];

  // 2. 種類ごとにグループ化
  const grouped = {};
  bolts.forEach((b) => {
    const type = b.type;
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(b);
  });

  // 3. 定義順にソート
  const sortedTypes = Object.keys(grouped).sort((a, b) => {
    const idxA = BOLT_TYPE_ORDER.indexOf(a);
    const idxB = BOLT_TYPE_ORDER.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  // 4. HTML生成
  sortedTypes.forEach((type) => {
    const list = grouped[type];

    // ヘッダー
    const header = document.createElement("h4");
    header.className =
      "font-bold text-slate-700 dark:text-slate-200 mb-2 mt-4 border-b border-gray-200 dark:border-slate-700 pb-1";
    header.textContent = type;
    container.appendChild(header);

    // グリッド
    const grid = document.createElement("div");
    grid.className = "grid grid-cols-3 gap-2";

    list.forEach((bolt) => {
      const btn = document.createElement("button");
      btn.className =
        "bolt-option-btn text-sm p-2 hover:bg-yellow-200 border border-blue-200 rounded-md transition-transform duration-150 hover:scale-105 dark:border-slate-600 dark:hover:bg-yellow-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200";
      btn.textContent = bolt.label;
      btn.dataset.value = bolt.id;

      // クリックイベント
      btn.addEventListener("click", () => {
        // state.activeBoltTarget に保存された入力欄要素へ値をセット
        if (state.activeBoltTarget) {
          state.activeBoltTarget.value = bolt.id;

          // changeイベントを発火させて、計算処理などを走らせる
          state.activeBoltTarget.dispatchEvent(
            new Event("change", { bubbles: true }),
          );

          // 処理完了後の後始末
          state.activeBoltTarget = null;

          const modal = document.getElementById("bolt-selector-modal");
          if (modal && typeof closeModal === "function") {
            closeModal(modal);
          }
        }
      });

      grid.appendChild(btn);
    });
    container.appendChild(grid);
  });
};

/**
 * 注文詳細画面の描画（修正版：トップ余白を mt-8 に統一）
 */
export const renderOrderDetails = (container, project, resultsByLocation) => {
  if (!container) return;
  if (!project) {
    container.innerHTML = "";
    return;
  }

  try {
    container.innerHTML = ""; // 全体初期化

    // ---------------------------------------------------------
    // 1. データの前処理
    // ---------------------------------------------------------
    const masterKeys = getMasterOrderedKeys(project);
    const targetKeys = new Set(masterKeys.filter((k) => resultsByLocation[k]));

    const filteredHonBolts = {}; // 本ボルト用
    const specialBolts = {
      column: {}, // 柱用
      dLock: {}, // D-Lock
      naka: {}, // 中ボルト(ミリ)
      nakaM: {}, // 中ボルト(Mネジ)
    };

    masterKeys.forEach((locId) => {
      if (!targetKeys.has(locId)) return;
      const locationData = resultsByLocation[locId];

      filteredHonBolts[locId] = {}; // 箱作成

      Object.keys(locationData).forEach((size) => {
        const data = locationData[size];
        const qty = data.total || 0;

        if (size.includes("(本柱)")) {
          specialBolts.column[size] = (specialBolts.column[size] || 0) + qty;
        } else if (size.startsWith("D")) {
          specialBolts.dLock[size] = (specialBolts.dLock[size] || 0) + qty;
        } else if (size.startsWith("中ボ")) {
          specialBolts.nakaM[size] = (specialBolts.nakaM[size] || 0) + qty;
        } else if (size.startsWith("中")) {
          specialBolts.naka[size] = (specialBolts.naka[size] || 0) + qty;
        } else {
          filteredHonBolts[locId][size] = data;
        }
      });

      if (Object.keys(filteredHonBolts[locId]).length === 0) {
        delete filteredHonBolts[locId];
      }
    });

    // ---------------------------------------------------------
    // 2. セクションコンテナの作成
    // ---------------------------------------------------------

    // A. 本ボルトセクション
    const honBoltSection = document.createElement("section");
    honBoltSection.className = "mb-16";
    container.appendChild(honBoltSection);

    // B. D-Lockセクション
    const dLockSection = document.createElement("section");
    dLockSection.className = "mb-16";
    container.appendChild(dLockSection);

    // C. 中ボルトセクション
    const nakaBoltSection = document.createElement("section");
    nakaBoltSection.className = "mb-16";
    container.appendChild(nakaBoltSection);

    // ---------------------------------------------------------
    // 3. 本ボルトセクションの描画ロジック
    // ---------------------------------------------------------
    const renderHonBoltSection = () => {
      const hasHonBolts = Object.keys(filteredHonBolts).length > 0;
      const hasColumnBolts = Object.keys(specialBolts.column).length > 0;

      if (!hasHonBolts && !hasColumnBolts) {
        honBoltSection.style.display = "none";
        return;
      }
      honBoltSection.style.display = "block";
      honBoltSection.innerHTML = "";

      // state初期化 (ui.js内の変数 currentGroupingState を直接使用)
      const dataKeys = Object.keys(filteredHonBolts);
      const shouldReset = dataKeys.some(
        (sec) => !currentGroupingState.hasOwnProperty(sec),
      );
      if (shouldReset) {
        // オブジェクトの中身をクリア
        for (const key in currentGroupingState)
          delete currentGroupingState[key];

        dataKeys.forEach((section, index) => {
          currentGroupingState[section] = index + 1;
        });
      }

      // ヘッダー
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

      // コントロール & テーブルエリア
      const controlsContainer = document.createElement("div");
      honBoltSection.appendChild(controlsContainer);

      const tableContainer = document.createElement("div");
      tableContainer.className =
        "flex flex-wrap gap-8 items-start align-top content-start";
      honBoltSection.appendChild(tableContainer);

      // 更新関数
      const updateView = () => {
        const btnDetail = honBoltSection.querySelector("#view-mode-detailed");
        const btnFloor = honBoltSection.querySelector("#view-mode-floor");
        const activeClass =
          "bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400";
        const inactiveClass =
          "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300";

        // ui.js内の変数 currentViewMode を直接参照
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
          currentGroupingState, // 本ボルト用のStateを渡す
          currentViewMode, // 本ボルト用のViewModeを渡す
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

      // イベントリスナー設定
      // (同じファイル内の変数なので、直接書き換えられます)
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

    // ---------------------------------------------------------
    // 4. D-Lockセクションの描画ロジック
    // ---------------------------------------------------------
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

    // ---------------------------------------------------------
    // 5. 中ボルトセクションの描画ロジック
    // ---------------------------------------------------------
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

    // 実行
    renderHonBoltSection();
    renderDLockSection();
    renderNakaBoltSection();
  } catch (err) {
    console.error("renderOrderDetailsエラー:", err);
    container.innerHTML = `<div class="p-4 bg-red-100 text-red-700">表示エラー: ${err.message}</div>`;
  }
};

/**
 * データを工区(エリア)ごとに集計するヘルパー関数 (修正版)
 */
const aggregateTempBySection = (sourceData, project) => {
  const result = {};

  Object.keys(sourceData).forEach((locId) => {
    // locId (例: "2F-1", "M2階-Aエリア") から工区/エリア部分を抽出
    const parts = locId.split("-");
    const areaPart = parts[parts.length - 1]; // ハイフンの後ろを取得

    // ▼▼▼ 修正: キー名の生成ルールをプロジェクト設定と合わせる ▼▼▼
    let sectionKey = areaPart;
    if (project.mode !== "advanced") {
      // 標準モードなら "1" -> "1工区" に統一
      sectionKey = `${areaPart}工区`;
    } else {
      // Advancedモードなら、エリア名をそのまま使う ("A", "1" など)
      sectionKey = areaPart;
    }
    // ▲▲▲ 修正ここまで ▲▲▲

    if (!result[sectionKey]) {
      result[sectionKey] = {};
    }

    const sizes = sourceData[locId];
    Object.keys(sizes).forEach((size) => {
      // データ構造の揺らぎ吸収
      const count =
        typeof sizes[size] === "object" && sizes[size].total !== undefined
          ? sizes[size].total
          : sizes[size];

      if (!result[sectionKey][size]) {
        result[sectionKey][size] = 0;
      }
      result[sectionKey][size] += count;
    });
  });

  return result;
};

/**
 * 仮ボルト注文詳細画面の描画（3モード対応・集計ロジック内蔵版）
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

    // 1. データの前処理
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

    // 2. セクション作成
    const tempBoltSection = document.createElement("section");
    tempBoltSection.className = "mb-16";
    container.appendChild(tempBoltSection);

    // 3. ヘッダー描画
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

    // ▼▼▼ 追加: 内部専用の集計ロジック (外部依存をなくすため) ▼▼▼
    const calculateLocalAggregation = (source, state) => {
      const result = {};
      const groups = {};

      // Stateに基づいてグループ分け
      Object.keys(state).forEach((key) => {
        if (source[key]) {
          // データが存在するキーのみ対象
          const groupNum = state[key];
          if (!groups[groupNum]) groups[groupNum] = [];
          groups[groupNum].push(key);
        }
      });

      // 集計実行
      Object.keys(groups).forEach((groupNum) => {
        const keys = groups[groupNum];
        // ラベル作成: "No.1 (1工区)" のような形式
        const label = `No.${groupNum} (${keys.join(", ")})`;
        result[label] = {};

        keys.forEach((key) => {
          const sizes = source[key];
          Object.keys(sizes).forEach((size) => {
            const qty =
              typeof sizes[size] === "object" && sizes[size].total !== undefined
                ? sizes[size].total
                : sizes[size];
            result[label][size] = (result[label][size] || 0) + qty;
          });
        });
      });
      return result;
    };
    // ▲▲▲ 追加ここまで ▲▲▲

    // 4. 更新ロジック
    const updateView = () => {
      // A. ボタン制御
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

      // B. データ準備
      let dataForControls = {};
      let customKeysForControls = null;

      if (currentTempViewMode === "section") {
        dataForControls = aggregateTempBySection(filteredTempBolts, project);

        // キー順序の生成
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

      // C. まとめ設定(State)のリセット
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

        keysToInit.forEach((key, index) => {
          currentTempGroupingState[key] = index + 1;
        });
      }

      // コントロール表示
      renderGroupingControls(
        controlsContainer,
        dataForControls,
        project,
        updateView,
        currentTempGroupingState,
        currentTempViewMode,
        customKeysForControls,
      );

      // D. 表示データ生成
      let dataToRender, sortedKeysToRender;

      if (currentTempViewMode === "floor") {
        const result = aggregateByFloor(filteredTempBolts, project);
        dataToRender = result.data;
        sortedKeysToRender = result.order;
      } else {
        // ▼▼▼ 修正: 内部関数 calculateLocalAggregation を使用 ▼▼▼
        dataToRender = calculateLocalAggregation(
          dataForControls,
          currentTempGroupingState,
        );

        // ソート
        const allAggregatedKeys = Object.keys(dataToRender);
        if (currentTempViewMode === "detailed") {
          const fullMasterList = getMasterOrderedKeys(project);
          sortedKeysToRender = allAggregatedKeys.sort((a, b) => {
            const firstKeyA = a.split(" + ")[0]; // "No.1 (Key)" 形式なら微調整が必要だが、汎用的に前方一致で比較
            // calculateLocalAggregationのラベル形式 "No.1 (...)" からカッコ内を取り出すのは複雑なので
            // ここでは単純な文字列ソート、または No. の数字でソートする
            const numA = parseInt(a.match(/No\.(\d+)/)?.[1] || "0");
            const numB = parseInt(b.match(/No\.(\d+)/)?.[1] || "0");
            return numA - numB;
          });
        } else {
          // 工区集計モード: No.順にソート
          sortedKeysToRender = allAggregatedKeys.sort((a, b) => {
            const numA = parseInt(a.match(/No\.(\d+)/)?.[1] || "0");
            const numB = parseInt(b.match(/No\.(\d+)/)?.[1] || "0");
            return numA - numB;
          });
        }
      }

      // ▼▼▼ デバッグログ: データが空なら出力 ▼▼▼
      if (Object.keys(dataToRender).length === 0) {
        console.warn("⚠️ dataToRender is empty!", {
          mode: currentTempViewMode,
          sourceKeys: Object.keys(dataForControls),
          stateKeys: Object.keys(currentTempGroupingState),
        });
      }

      // E. 描画
      renderAggregatedTables(
        tableContainer,
        dataToRender,
        sortedKeysToRender,
        {},
        false,
        true, // isTempBolt = true
      );
    };

    // 5. イベントリスナー
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
 * renderTempBoltResults（ボルトサイズの絞り込み対応・完全版）
 * 集計結果のHTML文字列を生成して返す（コンテナへの描画は呼び出し側で行う想定、またはこの中で行う）
 * ※元のコードが `return floorTable` しているので、文字列を返す関数として定義します。
 */
export const renderTempBoltResults = (project) => {
  // 1. まず全データを計算
  // (ui.js内でimport済みの関数を使用)
  const { resultsByLocation } = calculateTempBoltResults(project);

  // 2. 表示対象のロケーションIDを特定
  const targetLocationIds = new Set();
  let locations = []; // 表示用の配列

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

/**
 * 物件一覧を描画し、アニメーション付きのアコーディオンを設定する
 */
export const renderProjectList = (callbacks) => {
  if (callbacks) savedListCallbacks = callbacks;
  const currentCallbacks = callbacks || savedListCallbacks;

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

  // ボタンイベント
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

  // ★アニメーション付き排他的アコーディオン制御
  container.querySelectorAll(".accordion-trigger").forEach((trigger) => {
    trigger.onclick = () => {
      const groupDiv = trigger.closest(".project-group");
      const content = groupDiv.querySelector(".project-group-content");
      const arrow = trigger.querySelector(".group-arrow");
      const isOpening =
        content.style.maxHeight === "0px" || content.style.maxHeight === "";

      // 1. 全てを閉じる
      container.querySelectorAll(".project-group-content").forEach((c) => {
        c.style.maxHeight = "0px";
        c.classList.add("opacity-0");
      });
      container
        .querySelectorAll(".group-arrow")
        .forEach((a) => a.classList.remove("rotate-90"));

      // 2. ターゲットだけを開く
      if (isOpening) {
        // scrollHeight を使うことで、中身に応じた正確な高さをセットできる
        content.style.maxHeight = content.scrollHeight + "px";
        content.classList.remove("opacity-0");
        if (arrow) arrow.classList.add("rotate-90");

        // --- ★追加：オートスクロール処理 ---
        // アニメーションの開始と同時にスクロール位置を調整
        setTimeout(() => {
          const navHeight =
            document.getElementById("fixed-nav")?.offsetHeight || 0;
          const elementPosition = groupDiv.getBoundingClientRect().top;
          const offsetPosition =
            elementPosition + window.pageYOffset - navHeight - 10; // 10pxの余白

          window.scrollTo({
            top: offsetPosition,
            behavior: "smooth", // 滑らかにスクロール
          });
        }, 50); // アコーディオン展開の計算待ちでわずかに遅延
      }
    };
  });

  // 工事行のクリック
  container.querySelectorAll(".project-item-row").forEach((row) => {
    row.onclick = (e) => {
      if (
        e.target.closest(".checkbox-click-zone") ||
        e.target.classList.contains("project-checkbox")
      ) {
        updateProjectOpBar(currentCallbacks);
        return;
      }
      currentCallbacks.onSelect(row.dataset.id);
    };
  });
};
/**
 * 物件用フローティングバーの表示更新
 */
function updateProjectOpBar(callbacks) {
  const bar = document.getElementById("project-op-bar");
  const countLabel = document.getElementById("project-selection-count");
  const checkedBoxes = Array.from(
    document.querySelectorAll(".project-checkbox:checked"),
  );
  const count = checkedBoxes.length;

  if (!bar) return;

  if (count > 0) {
    if (countLabel) countLabel.textContent = count;
    bar.classList.remove("translate-y-24", "opacity-0", "pointer-events-none");

    const firstId = checkedBoxes[0].dataset.id;

    // 編集・複製・削除ボタンのセットアップ
    const setupBtn = (id, action, isSingleOnly) => {
      const btn = document.getElementById(id);
      if (!btn) return;

      // イベントの二重登録を防ぐため、一度クリアしてから設定
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
 * カスタム入力フィールド（階層・エリア名）を動的に生成する
 * ※ openEditProjectModal から呼ばれるヘルパー関数
 */
export function generateCustomInputFields(
  count,
  container,
  baseId,
  cacheArray = [], // ★修正1: デフォルト値を設定（これでエラーは消えます）
) {
  if (!container) return;
  container.innerHTML = "";

  // cacheArray が万が一 null/undefined だった場合の安全策
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

    // キャッシュから値を復元 (safeCacheを使う)
    input.value = safeCache[i] || "";

    // 入力時にキャッシュを更新
    input.addEventListener("input", (e) => {
      // 呼び出し元が配列を渡していない場合、ここで記録しても保持されませんがエラーは防げます
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
  // 1. 各入力欄への値セット (getElementByIdを使用)
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

  // 表示切り替え
  const toggleWrapper = document.getElementById("edit-advanced-toggle-wrapper");
  const simpleSettings = document.getElementById(
    "edit-simple-project-settings",
  );
  const advancedSettings = document.getElementById(
    "edit-advanced-project-settings",
  );

  if (toggleWrapper) toggleWrapper.classList.add("hidden"); // 編集時はモード切替不可
  if (simpleSettings) simpleSettings.classList.toggle("hidden", isAdvanced);
  if (advancedSettings)
    advancedSettings.classList.toggle("hidden", !isAdvanced);

  // ▼▼▼ 修正: state.js の変数を直接リセットする形に統一 ▼▼▼
  state.levelNameCache.length = 0;
  state.areaNameCache.length = 0;
  // ▲▲▲ 修正ここまで ▲▲▲

  if (isAdvanced) {
    // ▼▼▼ 修正: プロジェクトのデータを state のキャッシュに格納 ▼▼▼
    if (Array.isArray(project.customLevels)) {
      state.levelNameCache.push(...project.customLevels);
    }
    if (Array.isArray(project.customAreas)) {
      state.areaNameCache.push(...project.customAreas);
    }
    // ▲▲▲ 修正ここまで ▲▲▲

    setVal("edit-custom-levels-count", state.levelNameCache.length);
    setVal("edit-custom-areas-count", state.areaNameCache.length);

    const levelsContainer = document.getElementById(
      "edit-custom-levels-container",
    );
    const areasContainer = document.getElementById(
      "edit-custom-areas-container",
    );

    generateCustomInputFields(
      state.levelNameCache.length, // stateのlengthを使う
      levelsContainer,
      "edit-level",
      state.levelNameCache, // 参照として state を渡す
    );
    generateCustomInputFields(
      state.areaNameCache.length,
      areasContainer,
      "edit-area",
      state.areaNameCache, // 参照として state を渡す
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
 * 削除確認モーダルを開く
 */
export const openConfirmDeleteModal = (id, type) => {
  const confirmDeleteModal = document.getElementById("confirm-delete-modal");
  if (!confirmDeleteModal) return;

  // 変数を getElementById に置き換え
  const deleteIdInput = document.getElementById("delete-id");
  const deleteTypeInput = document.getElementById("delete-type");
  const confirmDeleteMessage = document.getElementById(
    "confirm-delete-message",
  );

  if (deleteIdInput) deleteIdInput.value = id;
  if (deleteTypeInput) deleteTypeInput.value = type;

  if (confirmDeleteMessage) {
    const typeName =
      type === "joint" ? "継手" : type === "member" ? "部材" : "工事";
    confirmDeleteMessage.textContent = `この${typeName}を削除しますか？\nデータは復元できません。`;
  }

  openModal(confirmDeleteModal);
};
/**
 * ボルト選択モーダルを開く（ターゲットを指定）
 */
export const openBoltSelectorModal = (targetInputId) => {
  // ID文字列から要素を取得して state に保存
  state.activeBoltTarget = document.getElementById(targetInputId);

  if (state.activeBoltTarget) {
    const currentValue = state.activeBoltTarget.value;

    // 下で定義する関数を呼び出す
    populateBoltSelectorModal(currentValue);

    const modal = document.getElementById("bolt-selector-modal");
    openModal(modal);
  }
};

/**
 * ボルト選択モーダルの中身（ボタン一覧）を生成する
 */
export const populateBoltSelectorModal = (currentValue) => {
  // 1. 要素取得
  const container = document.getElementById("bolt-options-container");
  if (!container) return;

  // 2. プロジェクトデータの取得
  const project = state.projects.find((p) => p.id === state.currentProjectId);
  if (!project) return;

  // 安全装置（calculator.jsからインポートした関数を使用）
  if (typeof ensureProjectBoltSizes === "function") {
    ensureProjectBoltSizes(project);
  }

  // 3. groupedBolts の生成ロジック
  const groupedBolts = project.boltSizes.reduce((acc, bolt) => {
    const groupKey = bolt.type;
    if (!acc[groupKey]) {
      acc[groupKey] = [];
    }
    acc[groupKey].push(bolt.id);
    return acc;
  }, {});

  // 4. ソートロジック
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

  // 5. HTML生成
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

          // 現在選択中の値と一致すればハイライト
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

  // ※ボタンのクリックイベントは、populateGlobalBoltSelectorModal の時と同様に
  //   events.js 側で「イベント委譲」を使って一括設定するか、
  //   ここで addEventListener する必要があります。
  //   今回は「HTML文字列」で作っているので、生成後にイベントを設定します。

  container.querySelectorAll(".bolt-option-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      if (state.activeBoltTarget) {
        // 値をセット
        state.activeBoltTarget.value = btn.dataset.size;

        // changeイベント発火
        state.activeBoltTarget.dispatchEvent(
          new Event("change", { bubbles: true }),
        );

        // 後始末
        state.activeBoltTarget = null;
        const modal = document.getElementById("bolt-selector-modal");
        if (modal) closeModal(modal);
      }
    });
  });
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
  // 部材アイコン (キューブ)
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

        // ▼▼▼ 追加: 部材カウントされている場合はアイコンを表示 ▼▼▼
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

  // ▼▼▼ 修正: 全ての cols から { label: "部材カウント", ... } を削除 ▼▼▼
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

  updateQuickNavLinks();
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

  // 1. 各入力欄への値セット (変数は使えないのでgetElementByIdを使用)
  const idInput = document.getElementById("edit-member-id");
  const nameInput = document.getElementById("edit-member-name");
  const jointSelect = document.getElementById("edit-member-joint-select");

  if (idInput) idInput.value = member.id;
  if (nameInput) nameInput.value = member.name;

  // ドロップダウン生成 (ui.js内の関数)
  populateJointDropdownForEdit(jointSelect, member.jointId);

  // 2. 階層チェックボックスの生成と初期値セット
  const levelsContainer = document.getElementById(
    "edit-member-levels-container",
  );

  if (levelsContainer) {
    levelsContainer.innerHTML = "";

    // getProjectLevels は calculator.js から import されている前提
    const levels = getProjectLevels(project);
    const targetLevels = member.targetLevels || []; // 未設定なら空

    levels.forEach((lvl) => {
      const isChecked = targetLevels.includes(lvl.id);
      const label = document.createElement("label");
      label.className = "flex items-center gap-2 text-sm cursor-pointer";
      label.innerHTML = `<input type="checkbox" value="${lvl.id}" class="level-checkbox h-4 w-4 text-blue-600 rounded border-gray-300" ${isChecked ? "checked" : ""}> ${lvl.label}`;
      levelsContainer.appendChild(label);
    });
  }

  // 3. モーダル表示
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
  // 部材アイコン (キューブ)
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

        // ▼▼▼ 追加: 継手側に設定されているアイコンを表示 ▼▼▼
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

  updateQuickNavLinks();
};

/**
 * 数量入力シートの合計値をDOM操作で再計算して更新する
 * (画面上の入力値を拾って集計するため、UIモジュールに配置)
 */
export const updateTallySheetCalculations = (project) => {
  if (!project) return;
  // getTallyList は calculator.js から import 済み
  const tallyList = getTallyList(project);

  // 1. 列合計 (Column Total) の計算
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

  // 2. 行合計 (Row Total) の計算
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

  // 3. 総合計 (Grand Total) の計算
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
 * 工場仮ボルト集計結果のHTMLを生成して返す
 */
export const renderShopTempBoltResults = (project) => {
  // calculator.js から import した関数を使用
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
export const renderTallySheet = (project) => {
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

  // 1. 階層タブ (ダークモード対応)
  const levels = getProjectLevels(project);
  let floorHtml = `<button class="tally-tab-btn px-4 py-1.5 rounded-full text-sm font-bold border transition-all ${
    state.activeTallyLevel === "all" 
      ? "bg-blue-600 text-white border-blue-600 shadow-md" 
      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
  }" data-level="all">全表示</button>`;

  levels.forEach(lvl => {
    const active = state.activeTallyLevel === lvl.id;
    floorHtml += `<button class="tally-tab-btn px-4 py-1.5 rounded-full text-sm font-bold border transition-all ${
      active 
        ? "bg-blue-600 text-white border-blue-600 shadow-md" 
        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600"
    }" data-level="${lvl.id}">${lvl.label}</button>`;
  });
  floorTabs.innerHTML = floorHtml;

  // 2. 種別タブ (ダークモード対応)
  const uniqueFilterIds = [...new Set(allItems.map(item => getJointFilterId(item.joint)))].sort();
  let typeHtml = `<button class="tally-type-tab-btn px-4 py-1.5 rounded-full text-sm font-bold border transition-all ${
    state.activeTallyType === "all" 
      ? "bg-emerald-600 text-white border-emerald-600 shadow-md" 
      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
  }" data-type="all">全種別</button>`;

  uniqueFilterIds.forEach(fid => {
    const active = state.activeTallyType === fid;
    typeHtml += `<button class="tally-type-tab-btn px-4 py-1.5 rounded-full text-sm font-bold border transition-all ${
      active 
        ? "bg-emerald-600 text-white border-emerald-600 shadow-md" 
        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600"
    }" data-type="${fid}">${getJointFilterLabel(fid)}</button>`;
  });
  if (typeTabs) typeTabs.innerHTML = typeHtml;

  // タブクリックイベント
  floorTabs.querySelectorAll(".tally-tab-btn").forEach(btn => {
    btn.onclick = () => { state.activeTallyLevel = btn.dataset.level; renderTallySheet(project); renderResults(project); };
  });
  if (typeTabs) {
    typeTabs.querySelectorAll(".tally-type-tab-btn").forEach(btn => {
      btn.onclick = () => { state.activeTallyType = btn.dataset.type; renderTallySheet(project); renderResults(project); };
    });
  }

  // 3. 表示データのフィルタリング
  const displayItems = allItems.filter(item => {
    const isCommon = !item.targetLevels || item.targetLevels.length === 0;
    const matchLevel = state.activeTallyLevel === "all" || !item.isMember || isCommon || item.targetLevels.includes(state.activeTallyLevel);
    const matchType = state.activeTallyType === "all" || getJointFilterId(item.joint) === state.activeTallyType;
    return matchLevel && matchType;
  });

  if (displayItems.length === 0) {
    tallySheetContainer.innerHTML = '<p class="text-gray-500 p-12 text-center bg-slate-50 dark:bg-slate-800/50 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 font-bold">表示条件に合う部材がありません。</p>';
    if (resultsCard) resultsCard.classList.add("hidden");
    return;
  }

  // 4. ロケーション(行)のフィルタリング
  let locations = [];
  if (project.mode === "advanced") {
    project.customLevels.forEach(lvl => {
      if (state.activeTallyLevel !== "all" && state.activeTallyLevel !== lvl) return;
      project.customAreas.forEach(area => locations.push({ id: `${lvl}-${area}`, label: `${lvl}-${area}` }));
    });
  } else {
    for (let f = 2; f <= project.floors; f++) {
      if (state.activeTallyLevel !== "all" && state.activeTallyLevel !== f.toString()) continue;
      for (let s = 1; s <= project.sections; s++) locations.push({ id: `${f}-${s}`, label: `${f}階 ${s}工区` });
    }
    if (state.activeTallyLevel === "all" || state.activeTallyLevel === "R") {
      for (let s = 1; s <= project.sections; s++) locations.push({ id: `R-${s}`, label: `R階 ${s}工区` });
    }
    if (project.hasPH && (state.activeTallyLevel === "all" || state.activeTallyLevel === "PH")) {
      for (let s = 1; s <= project.sections; s++) locations.push({ id: `PH-${s}`, label: `PH階 ${s}工区` });
    }
  }

  const locks = project.tallyLocks || {};

  // --- テーブル構築：カラー・バッジ語尾・折り返し禁止 ---
  const lockRow = displayItems.map(item => {
    const colorClass = getJointCategoryColorClasses(item.joint);
    return `<td class="px-2 py-1 text-center border ${colorClass}">
              <input type="checkbox" class="tally-lock-checkbox h-4 w-4 rounded cursor-pointer" data-id="${item.id}" ${locks[item.id] ? "checked" : ""}>
            </td>`;
  }).join("");

  const headerRow = displayItems.map(item => {
    const colorClass = getJointCategoryColorClasses(item.joint);
    const badgeColor = item.joint.color || '#cbd5e1';
    
    // ご指定のSVGアイコンを使用
    const memberIconHtml = item.joint.countAsMember
      ? `<span class="inline-flex items-center justify-center ml-1 text-emerald-600 dark:text-emerald-300 cursor-help" title="部材として集計される継手">${memberIconSvgRaw}</span>`
      : "";

    return `<th class="px-4 py-3 text-center border min-w-[160px] whitespace-nowrap font-bold ${colorClass}">
              <div class="flex items-center justify-center gap-1.5">
                <span>${item.name}</span>
                <span class="flex-shrink-0 w-3 h-3 rounded-full border border-black/20 dark:border-white/20 shadow-sm" style="background-color: ${badgeColor}"></span>
                ${memberIconHtml}
              </div>
            </th>`;
  }).join("");

  const sizeRow = displayItems.map(item => {
    const j = item.joint;
    const colorClass = getJointCategoryColorClasses(j);
    const tooltipText = getBoltTooltipText(j);
    let sizeDisplay = j.isComplexSpl && j.webInputs ? j.webInputs.map(w => w.size).join(", ") : [j.flangeSize, j.webSize].filter(Boolean).join(", ");
    
    return `<th class="px-2 py-2 text-center border min-w-[160px] text-[10px] leading-tight font-medium cursor-help whitespace-nowrap bolt-info-trigger ${colorClass}" 
                title="${tooltipText}" data-tooltip-content="${tooltipText}">
              ${sizeDisplay || "-"}
            </th>`;
  }).join("");

  const bodyHtml = locations.map(loc => `
    <tr class="tally-row group">
      <td class="px-4 py-3 font-bold sticky left-0 z-10 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 whitespace-nowrap group-hover:bg-slate-50 dark:group-hover:bg-slate-700/50">${loc.label}</td>
      ${displayItems.map(item => {
        const val = project.tally?.[loc.id]?.[item.id] ?? "";
        return `<td class="p-0 border border-slate-200 dark:border-slate-700 ${locks[item.id] ? 'bg-slate-100 dark:bg-slate-900/40' : 'group-hover:bg-slate-50/50 dark:group-hover:bg-slate-800/20'}">
                  <input type="text" inputmode="numeric" data-location="${loc.id}" data-id="${item.id}" 
                         class="tally-input w-full bg-transparent border-transparent py-3 text-center text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-yellow-500 transition-all" value="${val}" ${locks[item.id] ? "disabled" : ""}>
                </td>`;
      }).join("")}
      <td class="row-total px-4 py-2 text-center font-bold sticky right-0 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-blue-700 dark:text-blue-400 whitespace-nowrap"></td>
    </tr>`).join("");

  tallySheetContainer.innerHTML = `
    <div class="overflow-x-auto custom-scrollbar">
      <table class="table-fixed text-sm border-collapse w-full">
        <thead class="sticky top-0 z-20">
          <tr class="bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
            <th class="px-4 py-3 sticky left-0 z-30 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-xs align-bottom whitespace-nowrap" rowspan="3">階層 / 工区</th>
            ${lockRow}
            <th class="sticky right-0 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 font-bold align-middle whitespace-nowrap" rowspan="3">合計</th>
          </tr>
          <tr>${headerRow}</tr>
          <tr>${sizeRow}</tr>
        </thead>
        <tbody>${bodyHtml}</tbody>
        <tfoot class="font-bold sticky bottom-0 bg-orange-50 dark:bg-slate-900/95 backdrop-blur-sm">
          <tr class="whitespace-nowrap">
            <td class="px-4 py-2 sticky left-0 z-10 border border-orange-400 dark:border-orange-700 text-orange-800 dark:text-orange-300">列合計</td>
            ${displayItems.map(item => `<td data-id="${item.id}" class="col-total px-2 py-2 text-center border border-orange-400 dark:border-orange-700 text-orange-900 dark:text-orange-300"></td>`).join("")}
            <td class="grand-total px-4 py-2 text-center sticky right-0 border border-orange-400 dark:border-orange-700 text-orange-900 dark:text-orange-300"></td>
          </tr>
        </tfoot>
      </table>
    </div>`;

  // モバイル対応用タップイベント登録
  tallySheetContainer.querySelectorAll(".bolt-info-trigger").forEach(el => {
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
  const nameToJointMap = new Map(allTallyItems.map(item => [item.name, item.joint]));

  const targetLocationIds = new Set();
  if (project.mode === "advanced") {
    project.customLevels.forEach(lvl => {
      if (activeLevel !== "all" && activeLevel !== lvl) return;
      project.customAreas.forEach(area => targetLocationIds.add(`${lvl}-${area}`));
    });
  } else {
    for (let f = 2; f <= project.floors; f++) {
      if (activeLevel !== "all" && activeLevel !== f.toString()) continue;
      for (let s = 1; s <= project.sections; s++) targetLocationIds.add(`${f}-${s}`);
    }
    if (activeLevel === "all" || activeLevel === "R") {
      for (let s = 1; s <= project.sections; s++) targetLocationIds.add(`R-${s}`);
    }
    if (project.hasPH && (activeLevel === "all" || activeLevel === "PH")) {
      for (let s = 1; s <= project.sections; s++) targetLocationIds.add(`PH-${s}`);
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
      let filteredTotal = 0;

      for (const [itemName, count] of Object.entries(data.joints)) {
        const jointObj = nameToJointMap.get(itemName);
        if (activeType === "all" || (jointObj && getJointFilterId(jointObj) === activeType)) {
          filteredJoints[itemName] = count;
          filteredTotal += count;
        }
      }

      if (filteredTotal > 0) {
        filteredData[locId][size] = { total: filteredTotal, joints: filteredJoints };
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
      resultsCardContent.innerHTML = buttonsHtml + '<p class="text-gray-500 dark:text-slate-400 p-12 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 font-bold">集計データがありません。</p>';
    }
    resultsCard.classList.remove("hidden");
    return;
  }

  // テーブル1：フロア工区別テーブル（ダークモード対応）
  let floorColumns = [];
  if (project.mode === "advanced") {
    project.customLevels.forEach(lvl => {
      if (activeLevel !== "all" && activeLevel !== lvl) return;
      project.customAreas.forEach(area => floorColumns.push({ id: `${lvl}-${area}`, label: `${lvl}-${area}` }));
      floorColumns.push({ id: `${lvl}_total`, label: `${lvl} 合計`, isTotal: true, level: lvl });
    });
  } else {
    for (let f = 2; f <= project.floors; f++) {
      if (activeLevel !== "all" && activeLevel !== f.toString()) continue;
      for (let s = 1; s <= project.sections; s++) floorColumns.push({ id: `${f}-${s}`, label: `${f}F-${s}` });
      floorColumns.push({ id: `${f}F_total`, label: `${f}F 合計`, isTotal: true, floor: f });
    }
    if (activeLevel === "all" || activeLevel === "R") {
      for (let s = 1; s <= project.sections; s++) floorColumns.push({ id: `R-${s}`, label: `RF-${s}` });
      floorColumns.push({ id: `R_total`, label: `RF 合計`, isTotal: true, floor: "R" });
    }
    if (project.hasPH && (activeLevel === "all" || activeLevel === "PH")) {
      for (let s = 1; s <= project.sections; s++) floorColumns.push({ id: `PH-${s}`, label: `PH-${s}` });
      floorColumns.push({ id: `PH_total`, label: `PH 合計`, isTotal: true, floor: "PH" });
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
                        ${floorColumns.map(col => `<th class="px-2 py-3 text-center border border-slate-300 dark:border-slate-600 ${col.isTotal ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200' : ''}">${col.label}</th>`).join("")}
                        <th class="px-2 py-3 text-center sticky right-0 bg-yellow-300 dark:bg-yellow-800/80 text-yellow-900 dark:text-yellow-100 border border-yellow-400 dark:border-yellow-700 font-bold">総合計</th>
                    </tr>
                </thead>
                <tbody>`;

  sortedSizes.forEach((size) => {
    let rowTotal = 0;
    const rowTotalJoints = {};
    floorTableHtml += `<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40"><td class="px-2 py-2 font-bold sticky left-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 break-all">${size}</td>`;

    floorColumns.forEach((col) => {
      let cellValue = 0;
      let jointData = {};
      if (col.isTotal) {
        const areas = project.mode === "advanced" ? project.customAreas : Array.from({ length: project.sections }, (_, i) => i + 1);
        areas.forEach(area => {
          const id = project.mode === "advanced" ? `${col.level}-${area}` : `${col.floor}-${area}`;
          const d = filteredData[id]?.[size];
          if (d) {
            cellValue += d.total;
            for (const [n, c] of Object.entries(d.joints)) jointData[n] = (jointData[n] || 0) + c;
          }
        });
      } else {
        const d = filteredData[col.id]?.[size];
        cellValue = d?.total || 0;
        if (d?.joints) jointData = d.joints;
      }
      
      if (!col.isTotal) {
        rowTotal += cellValue;
        for (const [n, c] of Object.entries(jointData)) rowTotalJoints[n] = (rowTotalJoints[n] || 0) + c;
      }
      
      const detailsDataAttr = Object.keys(jointData).length > 0 ? `data-details='${JSON.stringify(jointData)}'` : "";
      floorTableHtml += `<td class="px-2 py-2 text-center border border-slate-200 dark:border-slate-700 ${col.isTotal ? 'bg-blue-50/50 dark:bg-blue-900/20 font-bold' : ''} has-details cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-900/40" ${detailsDataAttr}>${cellValue > 0 ? cellValue.toLocaleString() : "-"}</td>`;
    });

    const rowTotalDetailsAttr = Object.keys(rowTotalJoints).length > 0 ? `data-details='${JSON.stringify(rowTotalJoints)}'` : "";
    floorTableHtml += `<td class="px-2 py-2 text-center font-bold sticky right-0 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 has-details cursor-pointer hover:bg-yellow-200" ${rowTotalDetailsAttr}>${rowTotal > 0 ? rowTotal.toLocaleString() : "-"}</td></tr>`;
  });
  floorTableHtml += `</tbody></table></div></div>`;

  const orderDetailsContainer = `<div id="order-details-container" data-section-title="本ボルト注文明細" data-section-color="pink" class="scroll-mt-24 mt-12"></div>`;
  const tempBoltsHtml = renderTempBoltResults(project);

  if (resultsCardContent) {
    resultsCardContent.innerHTML = buttonsHtml + floorTableHtml + orderDetailsContainer + tempBoltsHtml;
  }

  const container = document.getElementById("order-details-container");
  if (container) renderOrderDetails(container, project, filteredData);

  resultsCard.classList.remove("hidden");
};

/**
 * 詳細画面内のタブ切り替え (Joints <-> Tally)
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
  //継手と部材
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
    // ▼ 継手タブでは検索ボタンを表示する
    if (searchWrapper) searchWrapper.classList.remove("hidden");
  } else if (tabName === "tally") //入力集計
  {
    if (elements.jointsSection) elements.jointsSection.classList.add("hidden");
    if (elements.settingsCard) elements.settingsCard.classList.add("hidden");
    if (elements.memberCard) elements.memberCard.classList.add("hidden");
    if (elements.tallySection) elements.tallySection.classList.remove("hidden");

    if (elements.navTabTally) elements.navTabTally.classList.add("active");
    if (elements.mobileNavTabTally)
      elements.mobileNavTabTally.classList.add("active");
    if (searchWrapper) searchWrapper.classList.add("hidden");
    // ▼▼▼ 追加: FAB内のボタン切り替え ▼▼▼
    if (elements.btnToTally) elements.btnToTally.classList.add("hidden");
    if (elements.btnToJoints) elements.btnToJoints.classList.remove("hidden");
    // 「入力と集計」に切り替わった時に一括削除の状態をリセット
    if (typeof resetBulkDeleteState === "function") {
      resetBulkDeleteState();
    }
  }

  // スクロール位置復元
  const newScrollY =
    (state.scrollPositions && state.scrollPositions[tabName]) || 0;
  setTimeout(() => {
    window.scrollTo(0, newScrollY);
  }, 0);
  updateQuickNavLinks();
};
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

  // マスターFABコンテナの要素を取得
  const masterFab = document.getElementById("master-fab-container");

  // スクロールリセット
  window.scrollTo(0, 0);

  // ナビゲーション要素
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
    // リストを隠す
    viewList.classList.add("hidden");
    viewList.style.display = "none";
    // 詳細を表示
    viewDetail.classList.remove("hidden");
    viewDetail.style.display = "block";

    // マスターFABを表示する
    if (masterFab) masterFab.classList.remove("hidden");

    // ナビゲーション制御
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

    // // タイトル更新
    // const project = state.projects.find((p) => p.id === state.currentProjectId);
    // if (project && navElements.navProjectTitle) {
    //   navElements.navProjectTitle.textContent = project.name;
    // }

    switchTab("joints");

    // ※古い updateQuickNavVisibility() の呼び出しは削除しました
  } else {
    state.activeTallyLevel = "all";
    state.activeTallyType = "all";
    // リストを表示
    viewList.classList.remove("hidden");
    viewList.style.display = "block";
    // 詳細を隠す
    viewDetail.classList.add("hidden");
    viewDetail.style.display = "none";

    // ナビゲーション制御
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

    // マスターFABを隠し、開きっぱなしの場合はリセットする
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

    // ※古い fabContainer のリセット処理は不要になったため削除しました

    // 一括削除の状態をリセット
    if (typeof resetBulkDeleteState === "function") {
      resetBulkDeleteState();
    }

    state.currentProjectId = null;
  }
};

/**
 * 詳細画面全体を描画する
 */
export const renderDetailView = () => {
  const project = state.projects.find((p) => p.id === state.currentProjectId);

  if (!project) {
    switchView("list");
    return;
  }

  // --- ▼▼▼ 追加：ヘッダー表示の切り替え ▼▼▼ ---
  const listContext = document.getElementById("nav-list-context");
  const detailContext = document.getElementById("nav-detail-context");
  const detailButtons = document.getElementById("nav-detail-buttons");
  const boltSettingsBtn = document.getElementById("nav-btn-bolt-settings");

  // 物件一覧用のタイトル（システム名）を隠し、詳細用のエリア（セレクター用）を表示する
  if (listContext) listContext.classList.add("hidden");
  if (detailContext) detailContext.classList.remove("hidden");

  // 右側のタブボタンや設定ボタンも表示
  if (detailButtons) detailButtons.classList.remove("hidden", "md:hidden");
  if (boltSettingsBtn) boltSettingsBtn.classList.remove("hidden");
  // --- ▲▲▲ 追加ここまで ▲▲▲ ---

  // プロジェクトセレクターを描画（中身を流し込む）
  renderProjectSwitcher();

  // 以前のタイトル表示用コードは不要なのでコメントアウトまたは削除
  // const navProjectTitle = document.getElementById("nav-project-title");
  // if (navProjectTitle) navProjectTitle.textContent = project.name;

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
      label.innerHTML = `<input type="checkbox" value="${lvl.id}" class="static-level-checkbox h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-yellow-500"> ${lvl.label}`;
      staticLevelsContainer.appendChild(label);
    });
  }

  renderTallySheet(project);
  renderResults(project);
};
/**
 * Undo/Redoボタンの活性状態を更新する
 */
export const updateUndoRedoButtons = () => {
  const undoBtn = document.getElementById("undo-btn");
  const redoBtn = document.getElementById("redo-btn");
  const mobileUndoBtn = document.getElementById("mobile-undo-btn");
  const mobileRedoBtn = document.getElementById("mobile-redo-btn");

  const canUndo = state.history.currentIndex > 0;
  const canRedo = state.history.currentIndex < state.history.stack.length - 1;

  [undoBtn, mobileUndoBtn].forEach((btn) => {
    if (btn) btn.disabled = !canUndo;
  });
  [redoBtn, mobileRedoBtn].forEach((btn) => {
    if (btn) btn.disabled = !canRedo;
  });
};

/**
 * 現在の状態をヒストリーに保存する
 */
export const saveStateToHistory = (projectsData) => {
  if (state.isUndoRedoOperation) return;

  // 新しい履歴を追加する場合、現在の位置より先の履歴（Redo用）は削除
  if (state.history.currentIndex < state.history.stack.length - 1) {
    state.history.stack = state.history.stack.slice(
      0,
      state.history.currentIndex + 1,
    );
  }

  // Deep Copyして保存
  state.history.stack.push(JSON.parse(JSON.stringify(projectsData)));
  state.history.currentIndex++;

  // 最大履歴数の制限
  if (state.history.stack.length > MAX_HISTORY_SIZE) {
    state.history.stack.shift();
    state.history.currentIndex--;
  }
  updateUndoRedoButtons();
};

/**
 * Undo/Redoを実行する
 */
export const performHistoryAction = (action) => {
  if (action === "undo" && state.history.currentIndex > 0) {
    state.isUndoRedoOperation = true;
    state.history.currentIndex--;
  } else if (
    action === "redo" &&
    state.history.currentIndex < state.history.stack.length - 1
  ) {
    state.isUndoRedoOperation = true;
    state.history.currentIndex++;
  } else {
    return;
  }

  // 履歴から復元
  state.projects = JSON.parse(
    JSON.stringify(state.history.stack[state.history.currentIndex]),
  );

  // 画面の再描画
  // 詳細画面が表示されているかどうかを、コンテナのクラスで判定
  const viewDetail = document.getElementById("view-project-detail");
  const isDetailVisible =
    viewDetail && !viewDetail.classList.contains("hidden");

  if (isDetailVisible) {
    // ui.js内の関数なので直接呼べる
    // renderDetailView は export されている前提ですが、
    // 同じファイル内なら関数定義の順序に注意するか、直接呼び出せます。
    // (renderDetailViewの定義がこれより上にあるか、関数宣言ならOK)
    if (typeof renderDetailView === "function") {
      renderDetailView();
    }
  } else {
    // リスト画面の再描画（保存しておいたコールバックを使用）
    renderProjectList(savedListCallbacks);
  }

  updateUndoRedoButtons();

  setTimeout(() => {
    state.isUndoRedoOperation = false;
  }, 100);
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
 * 継手入力フォームをリセットする
 */
export const resetJointForm = () => {
  // DOM要素の取得 (変数定義が外にある場合はそのままでOKですが、安全のためここで取得推奨)
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
  ); // ★本柱と同梱

  if (jointNameInput) jointNameInput.value = "";

  // 常設フォームのカラー設定リセット
  if (jointColorToggle) {
    jointColorToggle.checked = false;
    if (jointColorSection) jointColorSection.classList.add("hidden");
    if (jointColorInput) jointColorInput.value = "#ffffff";

    // ui.js内の関数
    if (typeof renderStaticColorPalette === "function")
      renderStaticColorPalette(null);
  }

  // 編集フォームのカラーリセット
  if (editJointColorInput) {
    editJointColorInput.value = "#ffffff";
    editJointColorInput.dataset.isNull = "true";

    // ui.js内の関数
    if (typeof renderColorPalette === "function") renderColorPalette(null);
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

  // キャッシュのリセット
  newComplexSplCache = Array.from({ length: 4 }, () => ({
    size: "",
    count: "",
  }));
  //本柱と同梱
  if (isBundledWithColumnInput) isBundledWithColumnInput.checked = false;

  // ui.js内の関数（UIの表示状態更新）
  // ※この関数も ui.js に移動する必要があります
  if (typeof updateJointFformUI === "function") {
    updateJointFormUI(false);
  }
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
  // 1. 現在の入力値をDOMから読み取る（※ここでは長さを切り捨てない！）
  const currentInputs = inputsContainer.querySelectorAll("input[type='text']");
  currentInputs.forEach((input, index) => {
    cache[index] = input.value; // 入力された値を上書き保存
  });

  // 2. 新しい項目数を計算する
  let newCount = parseInt(countInputElement.value) || 0;
  newCount += change;
  if (newCount < 1) newCount = 1;

  // 3. 項目数が増える場合のみ、キャッシュ配列の長さを調整する
  const currentCacheSize = cache.length;
  if (newCount > currentCacheSize) {
    // 未知の領域まで増えた場合だけ、空枠を追加する
    for (let i = 0; i < newCount - currentCacheSize; i++) {
      cache.push("");
    }
  }

  // 4. 表示されている項目数を更新する
  countInputElement.value = newCount;

  // 5. 更新されたキャッシュを元に入力欄を再生成する
  generateCustomInputFields(newCount, inputsContainer, prefix, cache);
};

/**
 * 継手選択モダルの内容を生成する
 */
export const populateJointSelectorModal = (project, currentJointId) => {
  // DOM要素を取得（IDは HTML に合わせて確認してください。恐らく "joint-options-container" です）
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
 * ボルト設定画面のリストを描画する
 */
export const renderBoltSizeSettings = (activeBoltTab = "all") => {
  const listContainer = document.getElementById("bolt-size-list");
  if (!listContainer) return;

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

  const countEl = document.getElementById("bolt-size-count");
  if (countEl)
    countEl.textContent = `表示: ${filteredBolts.length} / 全${boltSizes.length} 件`;

  // 3. リスト生成
  if (filteredBolts.length === 0) {
    listContainer.innerHTML =
      '<li class="text-center text-slate-400 py-4 text-sm">該当するサイズはありません</li>';
    return;
  }

  filteredBolts.forEach((bolt) => {
    // 使用中チェック (全てのプロジェクトから検索)
    // ※state.projectsへのアクセスが必要
    const isUsed = state.projects.some((p) =>
      p.joints.some((j) => j.flangeSize === bolt.id || j.webSize === bolt.id),
    );

    const li = document.createElement("li");
    li.className =
      "flex justify-between items-center bg-white dark:bg-slate-700 p-3 rounded border border-gray-200 dark:border-slate-600 shadow-sm";

    // 使用中の場合は削除ボタンを無効化するなどのUI処理を入れても良いでしょう
    const deleteBtnHtml = `
        <button class="delete-bolt-size-btn text-red-500 hover:text-red-700 p-2 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors" data-id="${bolt.id}" title="削除">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 000-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
        </button>`;

    li.innerHTML = `
            <div class="flex flex-col">
                <div class="flex items-center gap-2">
                    <span class="font-bold text-slate-800 dark:text-slate-200 text-lg">${bolt.label}</span>
                    ${isUsed ? '<span class="text-xs bg-gray-200 text-gray-600 px-1 rounded">使用中</span>' : ""}
                </div>
                <div class="text-xs text-slate-500 dark:text-slate-400">種類: ${bolt.type} / 長さ: ${bolt.length}mm</div>
            </div>
            ${deleteBtnHtml}
        `;
    listContainer.appendChild(li);
  });

  // 削除ボタンイベント設定
  listContainer.querySelectorAll(".delete-bolt-size-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const idToDelete = e.currentTarget.dataset.id;

      // 再度使用チェック
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

        // セレクタの更新が必要ならここで行う
        // populateGlobalBoltSelectorModal();

        await saveGlobalBoltSizes(state.globalBoltSizes);
      }
    });
  });
};

// /**
//  * ボルト設定画面のイベントリスナーを設定する
//  * (app.jsから呼び出す)
//  */
// export const setupBoltSettingsUI = () => {
//   const navBtnBoltSettings = document.getElementById("nav-btn-bolt-settings");
//   const newBoltTypeSelect = document.getElementById("new-bolt-type-select");
//   const boltSizeSettingsModal = document.getElementById(
//     "bolt-size-settings-modal",
//   ); // ID確認要
//   const addBoltSizeBtn = document.getElementById("add-bolt-size-btn"); // ID確認要
//   const newBoltLengthInput = document.getElementById("new-bolt-length-input"); // ID確認要
//   const boltSizeList = document.getElementById("bolt-size-list");

//   // 1. 設定モーダルを開く
//   if (navBtnBoltSettings) {
//     navBtnBoltSettings.classList.remove("hidden");
//     navBtnBoltSettings.addEventListener("click", () => {
//       console.log("🔧 設定ボタンがクリックされました");
//       if (newBoltTypeSelect) {
//         console.log(
//           "✅ セレクトボックスが見つかりました。選択肢を生成します。",
//         );
//         newBoltTypeSelect.innerHTML = "";
//         BOLT_TYPES.forEach((type) => {
//           const opt = document.createElement("option");
//           opt.value = type;
//           opt.textContent = type;
//           newBoltTypeSelect.appendChild(opt);
//         });
//         newBoltTypeSelect.value = "M16";
//       } else {
//         console.error(
//           "❌ エラー: id='new-bolt-type-select' の要素が見つかりません！",
//         );
//       }
//       renderBoltSizeSettings();
//       openModal(boltSizeSettingsModal);
//     });
//   }

//   // 2. 新規追加ボタン
//   if (addBoltSizeBtn) {
//     addBoltSizeBtn.addEventListener("click", async () => {
//       const type = newBoltTypeSelect.value;
//       const length = parseInt(newBoltLengthInput.value);

//       if (!length || length <= 0) {
//         showToast("長さを正しく入力してください");
//         return;
//       }

//       const newId = `${type}×${length}`;

//       if (state.globalBoltSizes.some((b) => b.id === newId)) {
//         showToast("このサイズは既に登録されています");
//         return;
//       }

//       state.globalBoltSizes.push({
//         id: newId,
//         label: newId,
//         type: type,
//         length: length,
//       });

//       sortGlobalBoltSizes();
//       renderBoltSizeSettings();
//       populateGlobalBoltSelectorModal(); // 必要なら
//       await saveGlobalBoltSizes(state.globalBoltSizes);

//       newBoltLengthInput.value = "";
//       newBoltLengthInput.focus();

//       setTimeout(() => {
//         const newItem = Array.from(boltSizeList.children).find((li) =>
//           li.innerHTML.includes(newId),
//         );
//         if (newItem)
//           newItem.scrollIntoView({ behavior: "smooth", block: "center" });
//       }, 100);
//     });
//   }
// };

/**
 * 部材登録フォームをリセットする
 */
export const resetMemberForm = () => {
  // HTMLのIDに合わせて取得してください
  const memberNameInput = document.getElementById("member-name");
  const memberJointSelectInput = document.getElementById(
    "member-joint-select-input",
  );
  const memberJointSelectId = document.getElementById("member-joint-select-id");

  if (memberNameInput) memberNameInput.value = "";
  if (memberJointSelectInput) memberJointSelectInput.value = "";
  if (memberJointSelectId) memberJointSelectId.value = "";

  // もし階層チェックボックスのクリアも必要ならここに追加
  const levelCheckboxes = document.querySelectorAll(".static-level-checkbox");
  levelCheckboxes.forEach((cb) => (cb.checked = false));
};
/**
 * 列のロック状態を即座にUIに反映させる
 * @param {string} itemId - 対象の部材ID
 * @param {boolean} isLocked - ロックするかどうか
 */
export const updateColumnLockUI = (itemId, isLocked) => {
  const table = document.querySelector("#tally-sheet-container table");
  if (!table) return;

  // data-column-id を使って列全体のセルを取得
  const cells = table.querySelectorAll(`[data-column-id="${itemId}"]`);

  // input要素を取得
  const inputs = table.querySelectorAll(
    `input.tally-input[data-id="${itemId}"]`,
  );

  // 見た目の更新 (背景色など)
  cells.forEach((cell) => {
    cell.classList.toggle("locked-column", isLocked);
  });

  // 機能の更新 (入力不可)
  inputs.forEach((input) => {
    input.disabled = isLocked;
  });
};

/**
 * 部材一括登録用の入力欄を生成する
 * @param {number} count - 生成する入力欄の数
 * @param {Array<string>} currentValues - 現在入力されている部材名の配列 (再描画時の値保持用)
 */
export const renderBulkMemberInputs = (count, currentValues = []) => {
  // HTML側に id="bulk-member-inputs-container" の要素が必要です
  const container = document.getElementById("bulk-member-inputs-container");
  if (!container) return;

  const project = state.projects.find((p) => p.id === state.currentProjectId);
  if (!project) return;

  const levels = getProjectLevels(project); // 利用可能な階層を取得

  // state.bulkMemberLevels が未定義の場合のガード
  if (!state.bulkMemberLevels) {
    state.bulkMemberLevels = [];
  }

  // キャッシュの長さを調整
  while (state.bulkMemberLevels.length < count) {
    state.bulkMemberLevels.push([]); // 新しい部材には空の配列（全階層）を割り当てる
  }
  // 配列を切り詰める（入力欄が減った場合）
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

    // 既存の値（currentValues[i]）を取得し、inputタグにセット
    const savedName = currentValues[i] || "";

    const div = document.createElement("div");
    div.className = "flex items-center gap-2 mb-2"; // mb-2を追加して少し隙間を空ける
    div.innerHTML = `
          <span class="text-sm text-slate-500 w-6 text-right">${i + 1}.</span>
          <input type="text" data-index="${i}" class="bulk-member-name-input w-full bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 rounded-md p-2 focus:ring-yellow-500 focus:border-yellow-500" placeholder="部材名" value="${savedName}">
          <button type="button" data-index="${i}" class="open-bulk-level-selector text-xs whitespace-nowrap bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-3 py-2 rounded-md border border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors" title="使用階層の選択">
              階層: ${levelsText}
          </button>
      `;
    container.appendChild(div);
  }

  // 最初の入力欄にフォーカス (少し遅らせて実行)
  setTimeout(() => {
    const firstInput = container.querySelector("input");
    if (firstInput) firstInput.focus();
  }, 50);
};
// /**
//  * クイックナビゲーションの開閉を切り替える
//  */
// export const toggleQuickNav = () => {
//   const quickNavMenu = document.getElementById("quick-nav-menu");
//   if (!quickNavMenu) return;

//   isQuickNavOpen = !isQuickNavOpen;

//   if (isQuickNavOpen) {
//     // メニューを開く時に中身を生成
//     updateQuickNavLinks();

//     quickNavMenu.classList.remove("hidden");

//     // アニメーション
//     requestAnimationFrame(() => {
//       quickNavMenu.classList.remove(
//         "scale-95",
//         "opacity-0",
//         "pointer-events-none",
//       );
//       quickNavMenu.classList.add(
//         "scale-100",
//         "opacity-100",
//         "pointer-events-auto",
//       );
//     });
//   } else {
//     // メニューを閉じる
//     quickNavMenu.classList.remove(
//       "scale-100",
//       "opacity-100",
//       "pointer-events-auto",
//     );
//     quickNavMenu.classList.add("scale-95", "opacity-0", "pointer-events-none");

//     setTimeout(() => {
//       if (!isQuickNavOpen) quickNavMenu.classList.add("hidden");
//     }, 200);
//   }
// };

// /**
//  * ナビゲーションリンクを生成する
//  */
// export const updateQuickNavLinks = () => {
//   const quickNavLinks = document.getElementById("quick-nav-links");
//   if (!quickNavLinks) return;

//   quickNavLinks.innerHTML = "";

//   // 1. ページトップへ
//   addQuickNavLink(
//     "▲ ページトップへ",
//     () => window.scrollTo({ top: 0, behavior: "smooth" }),
//     "bg-gray-100 dark:bg-slate-700 font-bold border-b border-gray-200 dark:border-slate-600",
//     quickNavLinks,
//   );

//   // 2. タブに応じて対象セクションを取得
//   let targets = [];
//   if (state.activeTab === "joints") {
//     targets = document.querySelectorAll(
//       '#joint-lists-container [id^="anchor-"], #member-lists-container [id^="anchor-"]',
//     );
//   } else if (state.activeTab === "tally") {
//     const tallyCard = document.getElementById("tally-card");
//     const resultSections = document.querySelectorAll(
//       "#results-card-content [data-section-title]",
//     );
//     if (tallyCard && !tallyCard.classList.contains("hidden")) {
//       targets = [tallyCard, ...resultSections];
//     }
//   }

//   if (targets.length > 0) {
//     targets.forEach((section) => {
//       const title = section.dataset.sectionTitle || "セクション";
//       const color = section.dataset.sectionColor || "gray";
//       const colorClass = `text-${color}-700 dark:text-${color}-300 hover:bg-${color}-50 dark:hover:bg-${color}-900/30`;

//       addQuickNavLink(
//         title,
//         () => {
//           section.scrollIntoView({ behavior: "smooth", block: "start" });
//         },
//         colorClass,
//         quickNavLinks,
//       );
//     });
//   } else {
//     const p = document.createElement("p");
//     p.textContent = "移動先がありません";
//     p.className = "text-xs text-gray-500 p-2";
//     quickNavLinks.appendChild(p);
//   }

//   // 3. ページ最下部へ
//   addQuickNavLink(
//     "▼ ページ最下部へ",
//     () =>
//       window.scrollTo({
//         top: document.body.scrollHeight,
//         behavior: "smooth",
//       }),
//     "bg-gray-100 dark:bg-slate-700 font-bold border-t border-gray-200 dark:border-slate-600 mt-1",
//     quickNavLinks,
//   );
// };

/**
 * ヘルパー関数: リンクボタンの作成 (マスターFAB対応版)
 */
const addQuickNavLink = (text, onClick, container, colorName = "gray") => {
  if (!container) return;

  const btn = document.createElement("button");
  btn.textContent = text;
  // 基本的なレイアウト設定
  btn.className = `text-left w-full px-4 py-3 text-sm font-bold rounded-md transition-all truncate border-l-4 mb-1 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between`;

  // Tailwindの動的クラス問題を回避するため、直接色を定義
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

  // インラインスタイルで確実に色を適用
  btn.style.color = theme.text;
  btn.style.borderLeftColor = theme.text;

  // ダークモード時の色調整（CSS変数などを利用していない場合、JSで判定するかCSSで制御）
  if (document.documentElement.classList.contains("dark")) {
    btn.style.color = theme.darkText;
  }

  btn.addEventListener("click", () => {
    onClick();
    // マスターFABを閉じる
    const masterFabToggle = document.getElementById("master-fab-toggle");
    if (masterFabToggle) masterFabToggle.click();
  });

  container.appendChild(btn);
};

// 初期化用: FABのクリックイベント設定など
export const setupQuickNav = () => {
  const quickNavToggle = document.getElementById("quick-nav-toggle");
  if (quickNavToggle) {
    // 重複登録防止のため、一度削除してから追加するか、フラグ管理が必要
    // ここではシンプルに追加のみ（initAppで一度だけ呼ばれる前提）
    quickNavToggle.addEventListener("click", toggleQuickNav);
  }
};

/**
 * プロジェクトリストの描画とアクション定義を行うラッパー関数
 */
export const updateProjectListUI = () => {
  // renderProjectList を呼び出す際、callbacksオブジェクトだけを渡すように統一
  renderProjectList({
    // --- 選択 ---
    onSelect: (id) => {
      const originalProject = state.projects.find((p) => p.id == id);
      if (originalProject) {
        state.currentProjectId = originalProject.id;
      }
      if (typeof resetMemberForm === "function") resetMemberForm();
      state.sort = {};
      if (typeof renderDetailView === "function") renderDetailView();
      switchView("detail");
    },

    // --- 編集 ---
    onEdit: (id) => {
      const project = state.projects.find((p) => p.id === id);
      if (project && typeof openEditProjectModal === "function") {
        openEditProjectModal(project);
      }
    },

    // --- 削除 ---
    onDelete: (id) => {
      if (typeof openConfirmDeleteModal === "function") {
        openConfirmDeleteModal(id, "project");
      }
    },

    // --- 複製 ---
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

    // --- 物件情報編集 ---
    onGroupEdit: (propertyName) => {
      const oldNameInput = document.getElementById("edit-group-old-name");
      const newNameInput = document.getElementById("edit-group-new-name");
      if (oldNameInput) oldNameInput.value = propertyName;
      if (newNameInput) newNameInput.value = propertyName;
      openModal(document.getElementById("edit-group-modal"));
    },

    // --- 集計表示 ---
    onGroupAggregate: (propertyName) => {
      const projectsInGroup = state.projects.filter(
        (p) => p.propertyName === propertyName,
      );
      if (projectsInGroup.length > 0) {
        // calculator.jsからインポートした集計ロジックを使用
        if (typeof calculateAggregatedResults === "function") {
          const aggregatedData = calculateAggregatedResults(projectsInGroup);
          if (typeof renderAggregatedResults === "function") {
            renderAggregatedResults(propertyName, aggregatedData);
          }
          openModal(document.getElementById("aggregated-results-modal"));
        }
      }
    },
  });
};

/**
 * グループ集計結果をモーダルに描画する関数
 * (app.js から ui.js に移動)
 */
export const renderAggregatedResults = (propertyName, aggregatedData) => {
  const titleEl = document.getElementById("aggregated-results-title");
  const contentEl = document.getElementById("aggregated-results-content");

  // 安全のため要素の存在チェック
  if (!titleEl || !contentEl) return;

  titleEl.textContent = `「${propertyName}」集計結果`;
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
      // ツールチップ用テキスト
      const tooltipText = Object.entries(data.joints)
        .map(([name, count]) => `${name}: ${count.toLocaleString()}本`)
        .join("\n");

      // モバイルタップ詳細表示用の属性
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

// /**
//  * クイックナビゲーションの外側がクリックされたら閉じる関数
//  * (events.js から呼び出す)
//  */
// export const closeQuickNavIfOutside = (target) => {
//   const quickNavContainer = document.getElementById("quick-nav-container");

//   // メニューが開いていて、かつクリックされた場所がコンテナの外側なら閉じる
//   // (toggleQuickNavの実装が「開いていれば閉じる」ようになっている前提)
//   if (
//     isQuickNavOpen &&
//     quickNavContainer &&
//     !quickNavContainer.contains(target)
//   ) {
//     toggleQuickNav();
//   }
// };

/**
 * テーマ（ダーク/ライト）を適用する関数
 */
export const applyTheme = (theme) => {
  const darkModeToggle = document.getElementById("dark-mode-toggle");
  const mobileDarkModeToggle = document.getElementById(
    "mobile-dark-mode-toggle",
  );

  if (theme === "dark") {
    document.documentElement.classList.add("dark");
    if (darkModeToggle) darkModeToggle.checked = true;
    if (mobileDarkModeToggle) mobileDarkModeToggle.checked = true;
  } else {
    document.documentElement.classList.remove("dark");
    if (darkModeToggle) darkModeToggle.checked = false;
    if (mobileDarkModeToggle) mobileDarkModeToggle.checked = false;
  }
};

/**
 * テーマを切り替える関数（トグル用）
 */
export const toggleTheme = () => {
  const currentTheme = localStorage.getItem("theme");
  if (currentTheme === "dark") {
    localStorage.setItem("theme", "light");
    applyTheme("light");
  } else {
    localStorage.setItem("theme", "dark");
    applyTheme("dark");
  }
};

/**
 * アプリ起動時のテーマ初期化
 */
export const initTheme = () => {
  const savedTheme = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  if (savedTheme) {
    applyTheme(savedTheme);
  } else if (prefersDark) {
    applyTheme("dark");
  } else {
    applyTheme("light");
  }
};

// ▼ 追加: UIコンポーネントの初期化（セレクトボックスやパレットなど）
export const initializeUIComponents = () => {
  // カラーパレット
  renderColorPalette(null);
  renderStaticColorPalette(null);

  // カスタム入力欄生成
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

  // ボルトセレクトボックス (HUGボルトなど)
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

// ▼ 追加: 継手フォームの初期状態設定 (一番下にあったロジック)
export const initializeJointFormState = () => {
  const jointTypeInput = document.getElementById("joint-type");
  const hasBoltCorrectionInput = document.getElementById("has-bolt-correction");
  const shopSplGroup = document.getElementById("shop-spl-group");
  const hasShopSplInput = document.getElementById("has-shop-spl");

  updateJointFormUI(false); // 既存関数

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

/**
 * 一括削除の選択状態とUIを初期状態にリセットする
 */
export const resetBulkDeleteState = () => {
  // 1. フローティングバーを隠す
  const bulkBar = document.getElementById("bulk-delete-bar");
  if (bulkBar) {
    bulkBar.classList.add("translate-y-24", "opacity-0", "pointer-events-none");
  }

  // 2. すべてのチェックボックスのチェックを外す
  document
    .querySelectorAll(".item-checkbox, .select-all-checkbox")
    .forEach((cb) => {
      cb.checked = false;
    });

  // 3. 行のハイライト（背景色）を元に戻す
  document.querySelectorAll(".item-row").forEach((row) => {
    row.classList.remove("!bg-yellow-100", "dark:!bg-yellow-900/40");
  });

  // 4. 裏側のメモリ（削除対象リスト）をクリア
  if (state.bulkDeleteTargets) {
    state.bulkDeleteTargets = null;
  }
};

/**
 * セクション移動（目次）のリンクを動的に生成して更新する
 */
export function updateQuickNavLinks() {
  const linksContainer = document.getElementById("quick-nav-links");
  if (!linksContainer) return;

  linksContainer.innerHTML = "";

  // 1. 固定リンク: 一番上へ
  addQuickNavLink(
    "↑ ページ最上部へ",
    () => window.scrollTo({ top: 0, behavior: "smooth" }),
    linksContainer,
    "blue",
  );

  // 2. タブに応じて対象セクションを取得
  let targets = [];
  if (state.activeTab === "joints") {
    // 継手・部材リスト内のアンカーを探す
    targets = Array.from(
      document.querySelectorAll(
        '#joint-lists-container [id^="anchor-"], #member-lists-container [id^="anchor-"]',
      ),
    ).filter((el) => !el.closest(".hidden"));
  } else if (state.activeTab === "tally") {
    // 箇所数入力カードと、結果の内訳セクションを探す
    const tallyCard = document.getElementById("tally-card");
    const resultSections = Array.from(
      document.querySelectorAll("#results-card-content [data-section-title]"),
    );
    if (tallyCard && !tallyCard.classList.contains("hidden")) {
      targets = [tallyCard, ...resultSections];
    }
  }

  // 3. 各セクションへのリンク生成
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

  // 4. ▼▼▼ 追加：固定リンク: 一番下へ ▼▼▼
  addQuickNavLink(
    "↓ ページ最下部へ",
    () =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }),
    linksContainer,
    "blue",
  );
}

/**
 * 固定ヘッダー内にプロジェクト切り替えUIを描画する
 */
export const renderProjectSwitcher = () => {
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
    // トリガーをクリックした時の挙動
    trigger.onclick = (e) => {
      e.stopPropagation(); // windowへのクリック伝播を止める
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

    // ★追加：画面のどこをクリックしても閉じる処理
    const handleOutsideClick = (e) => {
      if (!dropdown.contains(e.target) && e.target !== trigger) {
        dropdown.classList.add(
          "opacity-0",
          "pointer-events-none",
          "translate-y-2",
        );
        // メニューが閉じたらイベントリスナーを解除してメモリを節約
        document.removeEventListener("click", handleOutsideClick);
      }
    };

    // メニューが開いたときだけリスナーを登録する仕組み
    trigger.addEventListener("click", () => {
      document.addEventListener("click", handleOutsideClick);
    });
  }

  // 切り替え実行
  container.querySelectorAll(".switcher-item").forEach((item) => {
    item.onclick = () => {
      const targetId = item.dataset.targetId;
      if (targetId === state.currentProjectId) return;
      // ★ 切り替え前に絞り込み状態をリセット
      state.activeTallyLevel = "all";
      state.activeTallyType = "all";
      state.currentProjectId = targetId;
      if (typeof renderDetailView === "function") renderDetailView();
      showToast(`${item.querySelector("span").textContent} へジャンプしました`);
    };
  });
};
