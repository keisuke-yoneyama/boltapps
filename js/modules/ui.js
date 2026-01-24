import { PRESET_COLORS, HUG_BOLT_SIZES } from "./config.js";
import { state } from "./state.js";
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
} from "./calculator.js";

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

let isFabOpen = false;
let levelNameCache = [];
let areaNameCache = [];
let editComplexSplCache = Array.from({ length: 4 }, () => ({
  size: "",
  count: "",
}));

let newComplexSplCache = Array.from({ length: 4 }, () => ({
  size: "",
  count: "",
}));

/**
 * プロジェクト編集モーダルのキャッシュをクリアする
 */
export function resetProjectEditCache() {
  levelNameCache = [];
  areaNameCache = [];
}

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
 * キャッシュに値を保存する（app.jsやUI描画ロジックから使う場合）
 */
export function updateLevelNameCache(newCache) {
  levelNameCache = newCache;
}

/**
 * キャッシュに値を保存する（app.jsやUI描画ロジックから使う場合）
 */
export function updateAreaNameCache(newCache) {
  areaNameCache = newCache;
}

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

/**
 * 登録用FAB（フローティングアクションボタン）の開閉を切り替える
 * @param {boolean} [forceState] - 強制的に開く(true)か閉じる(false)か指定したい場合
 */
export function toggleFab(forceState) {
  // 1. 新しい状態を決定
  const newState = typeof forceState === "boolean" ? forceState : !isFabOpen;
  if (newState === isFabOpen) return;

  isFabOpen = newState;

  // 2. DOM要素の取得 (IDはHTMLに合わせてください)
  const fabIconPlus = document.getElementById("fab-icon-plus");
  const buttons = [
    document.getElementById("fab-add-joint"),
    document.getElementById("fab-add-member"),
    document.getElementById("fab-bulk-add-member"), // 追加されたボタン
    document.getElementById("fab-temp-bolt"),
  ].filter((el) => el !== null); // 存在しない要素は除外

  // 3. クラスの付け替え（アニメーション制御）
  if (isFabOpen) {
    if (fabIconPlus) fabIconPlus.style.transform = "rotate(45deg)";

    buttons.forEach((btn) => {
      btn.classList.remove(
        "translate-y-10",
        "opacity-0",
        "pointer-events-none",
      );
      btn.classList.add("pointer-events-auto");
    });
  } else {
    if (fabIconPlus) fabIconPlus.style.transform = "rotate(0deg)";

    buttons.forEach((btn) => {
      btn.classList.add("translate-y-10", "opacity-0", "pointer-events-none");
      btn.classList.remove("pointer-events-auto");
    });
  }
}

// --- FABの外部クリック判定用 ---
export function closeFabIfOutside(targetElement) {
  // isFabOpen は ui.js 内のローカル変数
  const fabContainer = document.getElementById("fab-container");
  // FABが開いていて、かつクリックされたのがFABの外側なら閉じる
  if (isFabOpen && fabContainer && !fabContainer.contains(targetElement)) {
    toggleFab(false);
  }
}

/**
 * 継手の新規登録モーダルを開く（フォームリセット含む）
 */
export function openNewJointModal() {
  toggleFab(false); // メニューを閉じる

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

  const modal = document.getElementById("edit-joint-modal"); // ID確認
  openModal(modal);
}

/**
 * 部材の新規登録モーダルを開く
 */
export function openNewMemberModal() {
  toggleFab(false);

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
  toggleFab(false);
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

/**
 * クイックナビとFABボタンの表示/非表示を更新する
 */
export const updateQuickNavVisibility = () => {
  // 1. 要素の取得 (IDはHTMLに合わせてください)
  const quickNavContainer = document.getElementById("quick-nav-container");
  const fabContainer = document.getElementById("fab-container");

  if (!quickNavContainer || !fabContainer) return;

  // 2. 表示ロジック
  // プロジェクトが開かれているならクイックナビは常に表示
  if (state.currentProjectId) {
    quickNavContainer.classList.remove("hidden");

    // 登録FABは「継手と部材(joints)」タブの時だけ表示
    if (state.activeTab === "joints") {
      fabContainer.classList.remove("hidden");
    } else {
      fabContainer.classList.add("hidden");

      // FABを強制的に閉じる (falseを渡せば閉じるように作ったはずなのでこれでOK)
      toggleFab(false);
    }
  } else {
    // プロジェクトが開いていないときは両方隠す
    quickNavContainer.classList.add("hidden");
    fabContainer.classList.add("hidden");
  }
};

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
  const input = document.getElementById("joint-color"); // ※ID確認
  if (input) {
    input.value = color;
  }
}

//まとめ設定関係の変数
export let currentGroupingState = {};
export let currentViewMode = "detailed";

// 外部からモードを変更するためのセッター関数（あると便利）
export function setCurrentViewMode(mode) {
  currentViewMode = mode;
}
export function resetCurrentGroupingState() {
  currentGroupingState = {};
}

/**
 * 工区まとめ設定UIを描画する関数
 */
export function renderGroupingControls(
  container,
  originalResults,
  project,
  onUpdate,
) {
  // 安全対策
  if (!container) return;

  // 現在の開閉状態を保存
  const existingDetails = container.querySelector("details");
  const wasOpen = existingDetails ? existingDetails.open : false;

  container.innerHTML = "";

  // 変数は同じファイル内にあるのでそのまま参照可能
  if (currentViewMode === "floor") {
    container.style.display = "none";
    return;
  }
  container.style.display = "block";

  // ★ getMasterOrderedKeys は import したものを使用
  const masterKeys = getMasterOrderedKeys(project);
  const targetKeys = masterKeys.filter((k) => originalResults[k]);

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
    targetKeys.forEach((key, index) => {
      // 同じファイル内の変数なので直接更新OK
      currentGroupingState[key] = index + 1;
    });
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
      if (currentGroupingState[section] === i) {
        option.selected = true;
      }
      select.appendChild(option);
    }

    select.addEventListener("change", (e) => {
      currentGroupingState[section] = Number(e.target.value);
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
 * テーブル群を描画する関数（汎用版）
 * * @param {HTMLElement} container  描画先のdiv要素
 * @param {Object} aggregatedCounts [本ボルト用] 合算されたデータ { "1F": { "M16...": 10 } }
 * @param {Array} sortedKeys        [本ボルト用] 表示順序のキー配列 ["M2F", "2F", ...]
 * @param {Object} specialBolts     [特殊用] { dLock: {...}, naka: {...}, column: {...} }
 * @param {boolean} onlySpecial     trueなら本ボルト(aggregatedCounts)の描画をスキップする
 */
export function renderAggregatedTables(
  container,
  aggregatedCounts,
  sortedKeys,
  specialBolts = {},
  onlySpecial = false,
) {
  // コンテナのクリア
  container.innerHTML = "";

  // データ生成ヘルパー
  const renderTableHtml = (title, data, color, customHeader = null) => {
    if (!data || Object.keys(data).length === 0) return "";

    // 通常ヘッダー
    const defaultHeader = `<tr>
            <th class="px-4 py-2 border border-${color}-300 dark:border-slate-600 text-center bg-${color}-200 dark:bg-slate-700 text-${color}-800 dark:text-${color}-200 whitespace-nowrap">種別</th>
            <th class="px-4 py-2 border border-${color}-300 dark:border-slate-600 text-center bg-${color}-200 dark:bg-slate-700 text-${color}-800 dark:text-${color}-200 whitespace-nowrap">ボルトサイズ</th>
            <th class="px-4 py-2 border border-${color}-300 dark:border-slate-600 text-center bg-${color}-200 dark:bg-slate-700 text-${color}-800 dark:text-${color}-200 whitespace-nowrap">本数</th>
            <th class="px-4 py-2 border border-${color}-300 dark:border-slate-600 text-center bg-${color}-200 dark:bg-slate-700 text-${color}-800 dark:text-${color}-200 whitespace-nowrap">重量(kg)</th>
        </tr>`;

    const headers = customHeader || defaultHeader;
    let body = "";
    let tableTotalWeight = 0;

    Object.keys(data)
      .sort(boltSort)
      .forEach((key) => {
        const boltCount = data[key];
        const singleWeightG = getBoltWeight(key);
        const rowWeightKg = (boltCount * singleWeightG) / 1000;
        tableTotalWeight += rowWeightKg;

        const weightValue = rowWeightKg > 0 ? rowWeightKg.toFixed(1) : "-";
        const weightTooltip =
          singleWeightG > 0 ? `単体重量: ${singleWeightG} g` : "";
        // ▼▼▼ 修正: 末尾チェック(endsWith)から、文字を含むか(includes)に変更 ▼▼▼
        const type = key.includes("■") ? "F8T" : "S10T";
        // ▲▲▲ 修正ここまで ▲▲▲
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
          rowContent = `
                    <td class="${commonCellClass}">${type}</td>
                    <td class="${commonCellClass}">${displayKey}</td>
                    <td class="${commonCellClass} font-medium">${boltCount.toLocaleString()}</td>
                    <td class="${commonCellClass} text-slate-500" title="${weightTooltip}">${weightValue}</td>
                `;
        }

        body += `<tr class="hover:bg-${color}-50 dark:hover:bg-slate-700/50">${rowContent}</tr>`;
      });

    const totalWeightDisplay =
      !customHeader && tableTotalWeight > 0
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

  // 1. 通常データ（本ボルトなど）の描画
  // onlySpecialがfalseのときだけ実行される（本ボルトセクション用）
  if (!onlySpecial && sortedKeys) {
    // マスタ順序にあるキーを表示
    sortedKeys.forEach((groupName) => {
      if (aggregatedCounts[groupName]) {
        tablesHtml += renderTableHtml(
          groupName,
          aggregatedCounts[groupName],
          "slate",
        );
      }
    });
    // マスタ外（その他）のキーを表示
    Object.keys(aggregatedCounts).forEach((key) => {
      if (!sortedKeys.includes(key)) {
        tablesHtml += renderTableHtml(key, aggregatedCounts[key], "slate");
      }
    });
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

          const modal = document.getElementById("bolt-selector-modal"); // ID確認
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
 * 仮ボルト注文明細のレンダリング関数
 */
export const renderTempOrderDetails = (container, project) => {
  if (!container || !project) return;

  container.innerHTML = ""; // クリア

  // stateはui.js内でimportされているので直接参照可能
  const viewMode = state.tempOrderDetailsView || "section";
  const toggleButtonText =
    viewMode === "location"
      ? "エリア・フロア別表示に切替"
      : "フロア工区別表示に切替";

  // ▼▼▼ 工区まとめ設定（チェックボックスとグループ化単位） ▼▼▼
  let settingsHtml = "";
  if (viewMode === "section") {
    const isGroupAll = state.tempOrderDetailsGroupAll;
    const groupKey = state.tempOrderDetailsGroupKey || "section"; // 'section' or 'floor'

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

  const headerHtml = `
        <div class="flex flex-col sm:flex-row justify-between sm:items-center mt-8 mb-4 border-b-2 border-green-400 pb-2 gap-3">
            <h2 class="text-2xl font-bold text-slate-900 dark:text-slate-100">仮ボルト注文明細</h2>
            <div class="flex flex-wrap gap-2 items-center self-end">
                ${settingsHtml}
                <button id="toggle-temp-order-view-btn" class="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded text-sm font-medium transition-colors border border-slate-300 dark:border-slate-600">${toggleButtonText}</button>
            </div>
        </div>`;

  // データ計算
  const { resultsByLocation } = calculateTempBoltResults(project);

  // 表示対象のロケーションIDを特定
  const targetLocationIds = new Set();
  if (project.mode === "advanced") {
    project.customLevels.forEach((level) => {
      if (state.activeTallyLevel !== "all" && state.activeTallyLevel !== level)
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
      if (state.activeTallyLevel === "all" || state.activeTallyLevel === "PH") {
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
            <div class="min-w-[200px] max-w-full flex-grow bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <h4 class="text-sm font-bold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-4 py-2 border-b border-green-200 dark:border-slate-700">${title}</h4>
                <table class="text-sm border-collapse w-full">
                    <thead class="bg-green-50 dark:bg-slate-700 text-xs text-green-800 dark:text-green-200">
                        <tr>
                            <th class="px-4 py-2 border border-green-200 dark:border-slate-600 text-center w-1/2">サイズ</th>
                            <th class="px-4 py-2 border border-green-200 dark:border-slate-600 text-center w-1/2">本数</th>
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
    targetLocationIds.forEach((locId) => {
      let label = locId;
      if (project.mode === "advanced") {
        label = locId.replace("-", " - ");
      } else {
        const parts = locId.split("-");
        if (["R", "PH"].includes(parts[0]))
          label = `${parts[0]}階 ${parts[1]}工区`;
        else label = `${parts[0]}階 ${parts[1]}工区`;
      }

      const locData = resultsByLocation[locId];
      if (locData) {
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
      if (state.tempOrderDetailsGroupAll) {
        return "全工区合計";
      }

      const groupKey = state.tempOrderDetailsGroupKey || "section";

      if (project.mode === "advanced") {
        const sortedLevels = [...project.customLevels].sort(
          (a, b) => b.length - a.length,
        );
        for (const level of sortedLevels) {
          if (locationId.startsWith(level + "-")) {
            // const area = locationId.substring(level.length + 1); // 未使用変数削除
            if (groupKey === "floor") {
              return level;
            } else {
              return locationId.substring(level.length + 1); // area
            }
          }
        }
        return locationId;
      } else {
        const parts = locationId.split("-");
        if (groupKey === "floor") {
          return `${parts[0]}階`;
        } else {
          return `${parts[1]}工区`;
        }
      }
    };

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

    Object.keys(resultsByGroup)
      .sort((a, b) => {
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

  // ★ HTMLを描画
  if (hasContent) {
    container.innerHTML =
      headerHtml +
      `<div class="flex flex-wrap gap-4 items-start content-start">${contentHtml}</div>`;
  } else {
    container.innerHTML =
      headerHtml +
      '<p class="text-gray-500 w-full text-center py-4">表示対象の仮ボルトはありません。</p>';
  }

  // ▼▼▼ イベントリスナーの再設定 (DOM生成直後に実行) ▼▼▼

  // 1. 表示モード切替ボタン
  const toggleBtn = container.querySelector("#toggle-temp-order-view-btn");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      // stateを更新して再描画
      state.tempOrderDetailsView =
        viewMode === "location" ? "section" : "location";
      renderTempOrderDetails(container, project);
    });
  }

  // 2. 「全工区まとめ」チェックボックス
  const groupAllCheckbox = container.querySelector(
    "#temp-order-group-all-checkbox",
  );
  if (groupAllCheckbox) {
    groupAllCheckbox.addEventListener("change", (e) => {
      state.tempOrderDetailsGroupAll = e.target.checked;
      renderTempOrderDetails(container, project);
    });
  }

  // 3. グループ化単位のラジオボタン
  const groupKeyRadios = container.querySelectorAll(
    'input[name="temp-order-group-key"]',
  );
  groupKeyRadios.forEach((radio) => {
    radio.addEventListener("change", (e) => {
      if (e.target.checked) {
        state.tempOrderDetailsGroupKey = e.target.value;
        renderTempOrderDetails(container, project);
      }
    });
  });
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

//★末尾に記載する
/**
 * プロジェクトリストを描画し、イベントを設定する
 * @param {Object} callbacks - 各ボタンのアクション { onSelect, onEdit, onDuplicate, onDelete, onGroupEdit, onGroupAggregate }
 */
export const renderProjectList = (callbacks = {}) => {
  // 1. コンテナ取得 (IDで直接取得)
  const container = document.getElementById("projects-container");
  if (!container) return;

  if (state.projects.length === 0) {
    container.innerHTML =
      '<p class="text-center text-gray-500 dark:text-gray-400 py-8">まだ工事が登録されていません。<br>右下の＋ボタンから追加してください。</p>';
    return;
  }

  const groupedProjects = {};
  const unGroupedProjects = [];

  // 2. プロジェクトを物件名でグループ化
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

  // 3. グループ化されたプロジェクトのHTML生成
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

      html += `
                <div class="project-card cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-600 transition-colors bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 p-3 rounded-lg flex flex-col justify-between gap-3 h-full" data-id="${p.id}">
                    <div class="project-card-content" data-id="${p.id}">
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

  // 4. グループ化されていないプロジェクトのHTML生成
  if (unGroupedProjects.length > 0) {
    if (Object.keys(groupedProjects).length > 0) {
      html += `<h3 class="text-lg font-semibold text-slate-700 dark:text-slate-300 my-4 border-t pt-4">物件名未設定の工事</h3>`;
    }

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
                    <div class="project-card-content" data-id="${p.id}">
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

    html += `</div>`;
  }

  container.innerHTML = html;

  // ▼▼▼ 5. イベントリスナーの設定 (デバッグログ付き) ▼▼▼

  const addListener = (selector, callback) => {
    if (!callback) return;
    container.querySelectorAll(selector).forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.dataset.id || btn.dataset.propertyName;
        console.log(`[DEBUG] Button clicked: ${selector}, ID: ${id}`); // ★ログ
        callback(id);
      });
    });
  };

  addListener(".select-project-btn", callbacks.onSelect);
  addListener(".edit-project-btn", callbacks.onEdit);
  addListener(".duplicate-project-btn", callbacks.onDuplicate);
  addListener(".delete-project-btn", callbacks.onDelete);
  addListener(".edit-group-btn", callbacks.onGroupEdit);
  addListener(".show-aggregated-results-btn", callbacks.onGroupAggregate);

  // カード自体のクリック（プロジェクト選択）
  if (callbacks.onSelect) {
    console.log("[DEBUG] Adding click listeners to cards..."); // ★ログ

    const cards = container.querySelectorAll(".project-card");
    console.log(`[DEBUG] Found ${cards.length} cards.`); // ★ログ

    cards.forEach((card) => {
      card.addEventListener("click", (e) => {
        console.log("[DEBUG] Card clicked!", e.target); // ★ログ

        // ボタンが押された場合は無視（念のため）
        if (e.target.closest("button")) {
          console.log("[DEBUG] Clicked on button, ignoring card click."); // ★ログ
          return;
        }

        const id = card.dataset.id;
        console.log(`[DEBUG] Card ID: ${id} (type: ${typeof id})`); // ★ログ

        if (id) {
          console.log("[DEBUG] Calling callbacks.onSelect..."); // ★ログ
          callbacks.onSelect(id);
        } else {
          console.error("[DEBUG] Error: Card has no ID!"); // ★ログ
        }
      });
    });
  }
};
/**
 * カスタム入力フィールド（階層・エリア名）を動的に生成する
 * ※ openEditProjectModal から呼ばれるヘルパー関数
 */
export function generateCustomInputFields(
  count,
  container,
  baseId,
  cacheArray,
) {
  if (!container) return;
  container.innerHTML = "";

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

    // キャッシュから値を復元
    input.value = cacheArray[i] || "";

    // 入力時にキャッシュを更新
    input.addEventListener("input", (e) => {
      cacheArray[i] = e.target.value;
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

  if (isAdvanced) {
    // キャッシュの更新 (ui.js内の変数を直接更新)
    // ※ levelNameCache, areaNameCache は ui.js 上部で let 定義されている前提
    // もし const で再代入できない場合は、中身を入れ替える処理が必要ですが、
    // let で定義されていれば以下のように配列ごと更新してもOK（ただしモジュール変数の書き換えに注意）

    // 安全策：配列の中身を入れ替える
    levelNameCache.length = 0;
    levelNameCache.push(...project.customLevels);

    areaNameCache.length = 0;
    areaNameCache.push(...project.customAreas);

    setVal("edit-custom-levels-count", project.customLevels.length);
    setVal("edit-custom-areas-count", project.customAreas.length);

    const levelsContainer = document.getElementById(
      "edit-custom-levels-container",
    );
    const areasContainer = document.getElementById(
      "edit-custom-areas-container",
    );

    generateCustomInputFields(
      project.customLevels.length,
      levelsContainer,
      "edit-level",
      levelNameCache,
    );
    generateCustomInputFields(
      project.customAreas.length,
      areasContainer,
      "edit-area",
      areaNameCache,
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
 * 継手リストを描画する（ソート機能付き）
 */
export const renderJointsList = (project) => {
  if (!project) return;

  // IDで要素を取得
  const container = document.getElementById("joint-lists-container");
  if (!container) return;

  const renderedJointIds = new Set();

  // ヘッダークリックイベント (イベント委譲で1回だけ設定)
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

        // 再描画 (自分自身を呼び出す)
        renderJointsList(
          state.projects.find((p) => p.id === state.currentProjectId),
        );
      }
    });
    container.dataset.listenerAdded = "true";
  }

  // ★ populateBoltSizeSelect は使用されていないため削除しました

  // テーブルの中身（行）を作るヘルパー関数
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
                                                              joint.webSize ||
                                                              "-"
                                                            } / ${joint.webCount}本</td>`;
          }
        }

        const borderColor = "border-slate-400",
          darkBorderColor = "dark:border-slate-600";

        // 仮ボルト情報の生成
        const tempBoltCells = (() => {
          if (["wall_girt", "roof_purlin", "column"].includes(joint.type))
            return "";

          // calculator.js から import した関数を使用
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
            const sizeA = a.flangeSize || a.webSize || "";
            const sizeB = b.flangeSize || b.webSize || "";
            const cmp = boltSort(sizeA, sizeB);
            return sortState.order === "asc" ? cmp : -cmp;
          } else if (key === "countAsMember") {
            const valA = a.countAsMember ? 1 : 0;
            const valB = b.countAsMember ? 1 : 0;
            return sortState.order === "asc" ? valA - valB : valB - valA;
          } else if (key === "web_complex") {
            const getFirstSize = (j) => {
              if (j.isComplexSpl && j.webInputs && j.webInputs.length > 0) {
                return { size: j.webInputs[0].size, isComplex: true };
              }
              return { size: j.webSize || "", isComplex: false };
            };

            const infoA = getFirstSize(a);
            const infoB = getFirstSize(b);

            if (infoA.isComplex !== infoB.isComplex) {
              const valA = infoA.isComplex ? 1 : 0;
              const valB = infoB.isComplex ? 1 : 0;
              return sortState.order === "asc" ? valA - valB : valB - valA;
            }

            const cmp = boltSort(infoA.size, infoB.size);
            if (cmp !== 0) return sortState.order === "asc" ? cmp : -cmp;

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
 * 部材リストを描画する（ソート・階層フィルタリング付き）
 */
export const renderMemberLists = (project) => {
  if (!project) return;

  const container = document.getElementById("member-lists-container");
  const tabsContainer = document.getElementById("member-list-tabs");

  if (!container || !tabsContainer) return;

  // ヘッダークリックイベント (イベント委譲)
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

        // 再描画
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

  // テーブル行生成ヘルパー
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

      const tbodyId = `members-list-${section.type}${section.isPin ? "-pin" : ""}`;
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

      const anchorId = `anchor-member-${section.type}-${section.isPin ? "pin" : "rigid"}`;

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

  // DOM要素の取得
  const tallySheetContainer = document.getElementById("tally-sheet-container");
  const tabsContainer = document.getElementById("tally-floor-tabs");
  const tallyCard = document.getElementById("tally-input-card"); // IDはHTMLに合わせて確認
  const resultsCard = document.getElementById("results-card");

  if (!tallySheetContainer || !tabsContainer) return;

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
      if (state.activeTallyLevel !== "all" && state.activeTallyLevel !== level)
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
      if (state.activeTallyLevel !== "all" && state.activeTallyLevel !== lvlId)
        continue;
      for (let s = 1; s <= project.sections; s++)
        locations.push({ id: `${f}-${s}`, label: `${f}階 ${s}工区` });
    }

    if (state.activeTallyLevel === "all" || state.activeTallyLevel === "R") {
      for (let s = 1; s <= project.sections; s++)
        locations.push({ id: `R-${s}`, label: `R階 ${s}工区` });
    }

    if (project.hasPH) {
      if (state.activeTallyLevel === "all" || state.activeTallyLevel === "PH") {
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

  // 1行目：ロック用チェックボックス
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

  // 2行目：部材名
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

      const colorBadge = j.color
        ? `<span class="inline-block w-3 h-3 rounded-full ml-1 border border-gray-400 align-middle" style="background-color: ${j.color};"></span>`
        : "";

      return `<th class="px-2 py-3 text-center border min-w-32 ${colorClass} ${lockedClass}" title="${tooltipText}" data-column-id="${item.id}">
                                ${headerText}${colorBadge}
                            </th>`;
    })
    .join("");

  // 3行目：ボルトサイズ
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

  // 計算結果の更新 (calculator.jsの関数)
  updateTallySheetCalculations(project);

  // フォーカスの復元 (ui.js内の変数を使用)
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

  // 1. 表示対象のロケーションIDを特定
  const targetLocationIds = new Set();
  if (project.mode === "advanced") {
    project.customLevels.forEach((level) => {
      if (state.activeTallyLevel !== "all" && state.activeTallyLevel !== level)
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
      if (state.activeTallyLevel === "all" || state.activeTallyLevel === "PH") {
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
    if (resultsCardContent) {
      resultsCardContent.innerHTML =
        buttonsHtml +
        '<p class="text-gray-500 dark:text-gray-400">該当するデータがありません。</p>';
    }
    resultsCard.classList.remove("hidden");
    return;
  }

  const sortedSizes = Array.from(filteredBoltSizes).sort(boltSort);

  // --- テーブル1：フロア工区別 ---
  let floorColumns = [];
  if (project.mode === "advanced") {
    project.customLevels.forEach((level) => {
      if (state.activeTallyLevel !== "all" && state.activeTallyLevel !== level)
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
      if (state.activeTallyLevel === "all" || state.activeTallyLevel === "PH") {
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

  const sortedLevels =
    project.mode === "advanced"
      ? [...project.customLevels].sort((a, b) => b.length - a.length)
      : [];

  for (const locationId in resultsByLocation) {
    if (!targetLocationIds.has(locationId)) continue;

    let foundArea = null;
    if (project.mode === "advanced") {
      for (const level of sortedLevels) {
        if (locationId.startsWith(level + "-")) {
          foundArea = locationId.substring(level.length + 1);
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

  // 各種コンテナHTML生成
  const orderDetailsContainer = `<div id="order-details-container" data-section-title="注文明細" data-section-color="pink" class="scroll-mt-24"></div>`;
  const tempOrderDetailsContainer = `<div id="temp-order-details-container" data-section-title="仮ボルト注文明細" data-section-color="purple" class="scroll-mt-24"></div>`;

  // HTML生成 (ui.js内関数呼び出し)
  const tempBoltsHtml = renderTempBoltResults(project);

  // renderShopTempBoltResults がまだ定義されていない場合のエラー回避
  // (もし ui.js にない場合は import が必要、あるいは移動してください)
  const shopTempBoltsHtml =
    typeof renderShopTempBoltResults === "function"
      ? renderShopTempBoltResults(project)
      : ""; // 未定義なら空

  if (resultsCardContent) {
    resultsCardContent.innerHTML =
      buttonsHtml +
      floorTable +
      sectionTable +
      orderDetailsContainer +
      tempBoltsHtml +
      tempOrderDetailsContainer +
      shopTempBoltsHtml;
  }

  // 注文明細の描画 (DOM要素生成後に実行)
  const container = document.getElementById("order-details-container");
  if (container) {
    renderOrderDetails(container, project, resultsByLocation);
  }

  // 仮ボルト注文明細の描画
  const tempContainer = document.getElementById("temp-order-details-container");
  if (tempContainer) {
    renderTempOrderDetails(tempContainer, project);
  }

  resultsCard.classList.remove("hidden");
};

/**
 * 詳細画面内のタブ切り替え (Joints <-> Tally)
 */
export const switchTab = (tabName) => {
  const jointsSection = document.getElementById("joints-section");
  const tallySection = document.getElementById("tally-section");
  const navTabJoints = document.getElementById("nav-tab-joints");
  const navTabTally = document.getElementById("nav-tab-tally");
  const mobileNavTabJoints = document.getElementById("mobile-nav-tab-joints");
  const mobileNavTabTally = document.getElementById("mobile-nav-tab-tally");

  // 内部セクションも明示的に取得
  const settingsCard = document.getElementById("settings-card");
  const memberCard = document.getElementById("member-registration-card");

  // 現在のスクロール位置を保存
  const currentScrollY = window.scrollY;
  if (state.activeTab) {
    state.scrollPositions[state.activeTab] = currentScrollY;
  }
  state.activeTab = tabName;

  // タブのアクティブ状態リセット
  [navTabJoints, navTabTally, mobileNavTabJoints, mobileNavTabTally].forEach(
    (tab) => {
      if (tab) tab.classList.remove("active");
    },
  );

  if (tabName === "joints") {
    if (jointsSection) jointsSection.classList.remove("hidden");

    // 内部セクションも表示
    if (settingsCard) settingsCard.classList.remove("hidden");
    if (memberCard) memberCard.classList.remove("hidden");

    if (tallySection) tallySection.classList.add("hidden");

    // タブの見た目をアクティブに
    if (navTabJoints) navTabJoints.classList.add("active");
    if (mobileNavTabJoints) mobileNavTabJoints.classList.add("active");
  } else if (tabName === "tally") {
    if (jointsSection) jointsSection.classList.add("hidden");

    // 内部セクションも非表示
    if (settingsCard) settingsCard.classList.add("hidden");
    if (memberCard) memberCard.classList.add("hidden");

    if (tallySection) tallySection.classList.remove("hidden");

    // タブの見た目をアクティブに
    if (navTabTally) navTabTally.classList.add("active");
    if (mobileNavTabTally) mobileNavTabTally.classList.add("active");
  }

  // スクロール位置の復元
  const newScrollY = state.scrollPositions[tabName] || 0;
  setTimeout(() => {
    window.scrollTo(0, newScrollY);
  }, 0);

  // FABの表示状態更新 (ui.js内の関数)
  if (typeof updateQuickNavVisibility === "function") {
    updateQuickNavVisibility();
  }
};

/**
 * 画面表示を切り替える (一覧画面 <-> 詳細画面)
 * デバッグログ付き
 */
export const switchView = (viewName) => {
  console.group(`[DEBUG] switchView called with: "${viewName}"`); // グループ化して見やすく

  // 1. メインコンテナの取得確認
  const viewList = document.getElementById("view-project-list");
  const viewDetail = document.getElementById("view-project-detail");

  // 要素の状態をログ出力
  console.log("DOM Elements Check:", {
    "view-project-list": viewList,
    "view-project-detail": viewDetail,
  });

  // 致命的なエラーチェック
  if (!viewList) {
    console.error(
      "❌ CRITICAL: 'view-project-list' element NOT found in HTML!",
    );
  }
  if (!viewDetail) {
    console.error(
      "❌ CRITICAL: 'view-project-detail' element NOT found in HTML!",
    );
  }

  // ナビゲーション関連の要素取得
  const fixedNav = document.getElementById("fixed-nav");
  const navListContext = document.getElementById("nav-list-context");
  const navDetailContext = document.getElementById("nav-detail-context");
  const navDetailButtons = document.getElementById("nav-detail-buttons");
  const mobileNavDetailButtons = document.getElementById(
    "mobile-nav-detail-buttons",
  );
  const navProjectTitle = document.getElementById("nav-project-title");

  // スクロールリセット
  window.scrollTo(0, 0);

  // 画面切り替えロジック
  if (viewName === "detail") {
    console.log("➡️ Action: Switching to DETAIL view");

    if (viewList) {
      viewList.classList.add("hidden");
      console.log("   - Added 'hidden' to viewList");
    }
    if (viewDetail) {
      viewDetail.classList.remove("hidden");
      console.log("   - Removed 'hidden' from viewDetail");
    }

    // ナビゲーション制御
    if (fixedNav) fixedNav.classList.remove("hidden");
    if (navListContext) navListContext.classList.add("hidden");
    if (navDetailContext) navDetailContext.classList.remove("hidden");

    if (navDetailButtons) {
      navDetailButtons.classList.remove("hidden");
      navDetailButtons.classList.add("flex");
    }
    if (mobileNavDetailButtons)
      mobileNavDetailButtons.classList.remove("hidden");

    // タイトル更新
    const project = state.projects.find((p) => p.id === state.currentProjectId);
    if (project) {
      console.log(`   - Project found: ${project.name}`);
      if (navProjectTitle) navProjectTitle.textContent = project.name;
    } else {
      console.warn(
        "   ⚠️ Project data not found for currentProjectId:",
        state.currentProjectId,
      );
    }

    // デフォルトタブ切り替え
    console.log("   - Calling switchTab('joints')...");
    switchTab("joints");

    // FAB表示更新
    if (typeof updateQuickNavVisibility === "function") {
      updateQuickNavVisibility();
    }
  } else {
    console.log("⬅️ Action: Switching to LIST view");

    if (viewList) {
      viewList.classList.remove("hidden");
      console.log("   - Removed 'hidden' from viewList");
    }
    if (viewDetail) {
      viewDetail.classList.add("hidden");
      console.log("   - Added 'hidden' to viewDetail");
    }

    // ナビゲーション制御
    if (navListContext) navListContext.classList.remove("hidden");
    if (navDetailContext) navDetailContext.classList.add("hidden");

    if (navDetailButtons) {
      navDetailButtons.classList.add("hidden");
      navDetailButtons.classList.remove("flex");
    }
    if (mobileNavDetailButtons) mobileNavDetailButtons.classList.add("hidden");

    // ナビとFABを隠し、状態をリセット
    const quickNav = document.getElementById("quick-nav-container");
    if (quickNav) quickNav.classList.add("hidden");

    const fabContainer = document.getElementById("fab-container");
    if (fabContainer) fabContainer.classList.add("hidden");

    if (
      typeof isFabOpen !== "undefined" &&
      isFabOpen &&
      typeof toggleFab === "function"
    ) {
      toggleFab();
    }

    state.currentProjectId = null;
  }

  console.groupEnd(); // ロググループ終了
};

/**
 * 詳細画面全体を描画する
 */
export const renderDetailView = () => {
  console.log(
    `[DEBUG] renderDetailView called. currentProjectId: ${state.currentProjectId}`,
  ); // ★ログ

  // プロジェクト検索の確認
  const project = state.projects.find((p) => p.id === state.currentProjectId);

  if (!project) {
    console.error(
      "[DEBUG] Project NOT found in ui.js state! Calling switchView('list').",
    ); // ★重要ログ
    console.log(
      "[DEBUG] Available projects in ui.js state:",
      state.projects.map((p) => p.id),
    );
    switchView("list");
    return;
  }

  console.log(`[DEBUG] Project found in ui.js: ${project.name}`); // ★ログ

  // タイトル更新
  const navProjectTitle = document.getElementById("nav-project-title");
  if (navProjectTitle) navProjectTitle.textContent = project.name;

  try {
    console.log("[DEBUG] Rendering Joints List...");
    renderJointsList(project);

    console.log("[DEBUG] Rendering Member Lists...");
    renderMemberLists(project);

    console.log("[DEBUG] Setting up static levels...");
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

    console.log("[DEBUG] Rendering Tally Sheet...");
    renderTallySheet(project);

    console.log("[DEBUG] Rendering Results...");
    renderResults(project);

    console.log("[DEBUG] renderDetailView finished successfully.");
  } catch (err) {
    console.error("[DEBUG] Error inside renderDetailView:", err);
  }
};
