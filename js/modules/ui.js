import { PRESET_COLORS } from "./config.js";
import { state } from "./state.js";
import { getProjectLevels } from "./calculator.js";

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
