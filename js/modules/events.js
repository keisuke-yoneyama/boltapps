import {
  closeModal,
  resetProjectEditCache,
  changeEditComplexSplCount,
  changeComplexSplCount,
  updateJointFormUI,
  selectColor,
  updateEditComplexSplCacheItem,
  selectStaticColor,
  toggleFab,
  closeFabIfOutside,
  openNewJointModal,
  openNewMemberModal,
  openTempBoltSettingsModal,
  populateGlobalBoltSelectorModal,
  openModal,
  updateDynamicInputs,
} from "./ui.js"; // ui.jsで作った関数を使う

import { resetTempJointData, state } from "./state.js";
/**
 * アプリ全体のイベントリスナーを設定する関数
 */
export function setupEventListeners() {
  setupEditMemberModalEvents(); //部材編集モーダルの終了動作
  setupEditModalEvents(); //継手編集モーダルの終了動作
  setupComfirmDeleteModalEvents();
  setupEditProjectModalEvents();
  setupComfirmAddModalEvents();

  setupEditModalConplexSplPlusMinusBtnEvents();
  setupModalConplexSplPlusMinusBtnEvents(); //継手
  setupJointTypeChangedEvents(); //継手登録常設フォーム
  setupEditJointTypeChangedEvents();

  setupCloseBoltSizeSelectModalBtnEvents();
  setupCloseCustomAlertModalBtnEvents();

  setupColorPalleteEvents(); //カラーパレット関係

  setupFloatingFABBottunEvents(); //登録用フローティングボタン

  setupBoltSizeInputClicked(); //ボルトサイズ選択モーダルの起動イベント

  setupProjectFormEvents(); // 工事登録フォーム関係のイベント

  // ▼▼▼ 追加: 編集モーダル複合スプライス入力の監視 (4セット分) ▼▼▼
  for (let i = 1; i <= 4; i++) {
    const suffix = i > 1 ? `-${i}` : "";
    const sizeInput = document.getElementById(`edit-web-size${suffix}`);
    const countInput = document.getElementById(`edit-web-count${suffix}`);

    // 要素がある場合のみ登録
    if (sizeInput) {
      sizeInput.addEventListener("change", (e) => {
        // i-1 番目の 'size' を更新
        updateEditComplexSplCacheItem(i - 1, "size", e.target.value);
      });
    }

    if (countInput) {
      countInput.addEventListener("input", (e) => {
        // i-1 番目の 'count' を更新
        updateEditComplexSplCacheItem(i - 1, "count", e.target.value);
      });
    }
  }
}

//登録用フローティングボタンイベント
function setupFloatingFABBottunEvents() {
  // // メインのFABボタン
  // const fabMainBtn = document.getElementById("fab-toggle"); // IDは確認してください
  // if (fabMainBtn) {
  //   fabMainBtn.addEventListener("click", () => {
  //     toggleFab(); // 引数なし＝トグル
  //   });
  // }

  // (オプション) メニュー内のボタンを押したら閉じるようにしたい場合
  const subButtons = document.querySelectorAll(".fab-sub-button"); // htmlのクラス名で取得する
  subButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      toggleFab(false); // 強制的に閉じる
    });
  });

  // 1. FAB開閉ボタン
  const fabToggle = document.getElementById("fab-toggle"); // ID確認
  if (fabToggle) {
    fabToggle.addEventListener("click", (e) => {
      e.stopPropagation(); // 親への伝播を止める
      toggleFab();
    });
  }

  // 2. 画面の他の場所をクリックしたら閉じる
  document.addEventListener("click", (e) => {
    closeFabIfOutside(e.target);
  });

  // 3. 継手登録ボタン (fab-add-joint)
  const fabAddJoint = document.getElementById("fab-add-joint");
  if (fabAddJoint) {
    fabAddJoint.addEventListener("click", openNewJointModal);
  }

  // 4. 部材登録ボタン (fab-add-member)
  const fabAddMember = document.getElementById("fab-add-member");
  if (fabAddMember) {
    fabAddMember.addEventListener("click", openNewMemberModal);
  }

  // 5. 仮ボルト設定ボタン (fab-temp-bolt)
  const fabTempBolt = document.getElementById("fab-temp-bolt");
  if (fabTempBolt) {
    fabTempBolt.addEventListener("click", openTempBoltSettingsModal);
  }
}

//カラーバレット関係のイベントセットアップ
function setupColorPalleteEvents() {
  // ▼▼▼ 追加: カラーパレットのクリックイベント ▼▼▼
  const paletteContainer = document.getElementById("color-palette-container");

  if (paletteContainer) {
    paletteContainer.addEventListener("click", (e) => {
      // クリックされた要素が .color-swatch かどうか確認
      const swatch = e.target.closest(".color-swatch");

      if (swatch) {
        // swatchが持っている色情報を取得
        const color = swatch.dataset.color;

        // UI更新関数を呼び出す
        selectColor(color);
      }
    });
  }

  // ▼▼▼ 追加: 常設フォーム用カラーパレットのクリック ▼▼▼
  const staticContainer = document.getElementById(
    "static-color-palette-container",
  );

  if (staticContainer) {
    staticContainer.addEventListener("click", (e) => {
      const swatch = e.target.closest(".color-swatch");
      if (swatch) {
        const color = swatch.dataset.color;
        selectStaticColor(color); // UI更新関数を呼ぶ
      }
    });
  }
}

//ボルトサイズ選択モーダル終了ボタンイベント
function setupCloseBoltSizeSelectModalBtnEvents() {
  const closeBoltModalBtn = document.getElementById("close-bolt-modal-btn");
  closeBoltModalBtn.addEventListener("click", () =>
    closeModal(document.getElementById("bolt-selector-modal")),
  );
}
//カスタムアラートモーダル終了ボタンイベント
function setupCloseCustomAlertModalBtnEvents() {
  const closeAlertBtn = document.getElementById("close-alert-btn");
  closeAlertBtn.addEventListener("click", () =>
    closeModal(document.getElementById("custom-alert-modal")),
  );
}

// //カスタムアラートモーダル終了ボタンイベント
// function setupComplexSplInputsChangedEvents() {
//   // 1. 対象のIDを文字列でリストアップ
//   const complexSplInputIds = ["is-complex-spl", "edit-is-complex-spl"];

//   // 2. ループ処理
//   complexSplInputIds.forEach((id) => {
//     const el = document.getElementById(id);

//     // 要素が存在する場合のみイベント登録
//     if (el) {
//       el.addEventListener("change", () => {
//         // ID名に "edit" が含まれているかで true/false を判定するテクニック
//         // これで isModal 引数を自動判別できます
//         const isModal = id.includes("edit");
//         updateJointFormUI(isModal);
//       });
//     }
//   });
// }

//継手編集モーダルの入力変更時のイベント登録
function setupEditJointTypeChangedEvents() {
  // --- 2. 編集モーダル用のグループ ---
  const editInputs = [
    "edit-joint-type",
    "edit-temp-bolt-setting",
    "edit-is-pin-joint",
    "edit-is-double-shear", // ★ここに含まれているのでOK
    "edit-has-shop-spl",
    "edit-is-complex-spl",
    // "edit-has-bolt-correction"
  ];

  editInputs.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("change", () => updateJointFormUI(true));
    }
  });
}

//継手登録フォームの入力変更時のイベント登録
function setupJointTypeChangedEvents() {
  // --- 1. 新規登録フォーム用のグループ ---
  const newInputs = [
    "joint-type",
    "temp-bolt-setting",
    "is-pin-joint",
    "is-double-shear", // ★ここに含まれているのでOK
    "has-shop-spl",
    "is-complex-spl", // 必要ならこれらも追加
    // "has-bolt-correction"
  ];

  newInputs.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("change", () => updateJointFormUI(false));
    }
  });
}

//編集モーダルの複合スプライスの増減ボタンのイベント登録
function setupEditModalConplexSplPlusMinusBtnEvents() {
  const editIncrementBtn = document.getElementById(
    "edit-increment-complex-spl-btn",
  );
  const editDecrementBtn = document.getElementById(
    "edit-decrement-complex-spl-btn",
  ); // マイナスボタンもあると想定

  // プラスボタン(編集モーダル)
  if (editIncrementBtn) {
    editIncrementBtn.addEventListener("click", () => {
      changeEditComplexSplCount(1);
    });
  }

  // マイナスボタン(編集モーダル)
  if (editDecrementBtn) {
    editDecrementBtn.addEventListener("click", () => {
      changeEditComplexSplCount(-1);
    });
  }
}

//継手編集画面の複合スプライスの増減ボタンのイベント登録
function setupModalConplexSplPlusMinusBtnEvents() {
  const IncrementBtn = document.getElementById("increment-complex-spl-btn");
  const DecrementBtn = document.getElementById("decrement-complex-spl-btn"); // マイナスボタンもある

  // プラスボタン
  if (IncrementBtn) {
    IncrementBtn.addEventListener("click", () => {
      changeComplexSplCount(1);
    });
  }

  // マイナスボタン
  if (DecrementBtn) {
    DecrementBtn.addEventListener("click", () => {
      changeComplexSplCount(-1);
    });
  }
}
/**
 * モーダル関連のイベントを設定（内部関数）
 */
//部材編集モーダル画面の何もしないで終了時の動作登録
function setupEditMemberModalEvents() {
  // 1. ここでIDを使って要素を取得（変数はこの関数の中だけで生きる）
  const editMemberModal = document.getElementById("edit-member-modal");
  const closeBtn = document.getElementById("close-edit-member-modal-btn");
  const cancelBtn = document.getElementById("cancel-member-edit-btn");

  // 2. 要素が存在するかチェック（安全対策）
  if (!editMemberModal) return;

  // 3. まとめて登録処理
  // （配列の中に null が混ざっても大丈夫なように filter します）
  [editMemberModal, closeBtn, cancelBtn]
    .filter((el) => el !== null)
    .forEach((el) => {
      el.addEventListener("click", (e) => {
        // 判定ロジック
        // 変数比較ではなく、IDやクラスで判定するとより堅牢です
        if (
          e.target === editMemberModal ||
          e.target.closest("#close-edit-member-modal-btn") ||
          e.target.closest("#cancel-member-edit-btn")
        ) {
          closeModal(editMemberModal);
        }
      });
    });
}

//継手編集モーダル画面の何もしないで終了時の動作登録
function setupEditModalEvents() {
  // 1. ここでIDを使って要素を取得（変数はこの関数の中だけで生きる）
  const closeEditModalBtn = document.getElementById("close-edit-modal-btn");
  const cancelEditBtn = document.getElementById("cancel-edit-btn");
  const editModal = document.getElementById("edit-joint-modal"); //親要素

  // 2. 要素が存在するかチェック（安全対策）
  if (!editModal) return;

  // 2. 配列に editModal (背景用) も追加し、nullを除外してから登録
  [editModal, closeEditModalBtn, cancelEditBtn]
    .filter((el) => el !== null) // nullがあったら除外（エラー防止）
    .forEach((el) => {
      el.addEventListener("click", (e) => {
        if (
          e.target === editModal || // 背景クリック
          e.target.closest("button") === closeEditModalBtn || // ×ボタン
          e.target.closest("button") === cancelEditBtn // キャンセルボタン
        ) {
          closeModal(editModal);
        }
      });
    });
}

//削除確認モーダルのキャンセル終了の動作登録
function setupComfirmDeleteModalEvents() {
  const confirmDeleteModal = document.getElementById("confirm-delete-modal");
  const cancelDeleteBtn = document.getElementById("cancel-delete-btn");

  if (!confirmDeleteModal) return;

  [cancelDeleteBtn, confirmDeleteModal] //×ボタンはないこのモーダルは
    .filter((el) => el !== null)
    .forEach((el) => {
      el.addEventListener("click", (e) => {
        // 判定ロジック
        // 変数比較ではなく、IDやクラスで判定するとより堅牢です
        if (
          e.target === confirmDeleteModal ||
          e.target.closest("button") === cancelDeleteBtn
        )
          closeModal(confirmDeleteModal);
      });
    });
}

//プロジェクト編集モーダルの途中終了時の動作登録
function setupEditProjectModalEvents() {
  const editProjectModal = document.getElementById("edit-project-modal");
  const closeBtn = document.getElementById("close-edit-project-modal-btn");
  const cancelBtn = document.getElementById("cancel-project-edit-btn");

  if (!editProjectModal) return;

  [editProjectModal, closeBtn, cancelBtn]
    .filter((el) => el !== null)
    .forEach((el) => {
      el.addEventListener("click", (e) => {
        // 判定ロジック
        if (
          e.target === editProjectModal ||
          e.target.closest("button") === closeBtn ||
          e.target.closest("button") === cancelBtn
        ) {
          closeModal(editProjectModal);

          // ★ここでクリア関数を呼ぶ！
          resetProjectEditCache();
        }
      });
    });
}
//このまま継手を登録しますか？のモーダルのキャンセル動作登録
function setupComfirmAddModalEvents() {
  const cancelAddBtn = document.getElementById("cancel-add-btn");
  const confirmAddModal = document.getElementById("confirm-add-modal");
  if (!confirmAddModal) return;

  [cancelAddBtn, confirmAddModal] //×ボタンはないこのモーダルは
    .filter((el) => el !== null)
    .forEach((el) => {
      el.addEventListener("click", (e) => {
        // 判定ロジック
        // 変数比較ではなく、IDやクラスで判定するとより堅牢です
        if (
          e.target === confirmAddModal ||
          e.target.closest("button") === cancelAddBtn
        )
          closeModal(confirmAddModal);
        resetTempJointData();
      });
    });
}

function setupBoltSizeInputClicked() {
  // ▼▼▼ 修正：ボルト選択モーダルを開く対象のIDリスト ▼▼▼
  const boltInputIds = [
    // 編集モーダルの入力欄
    "edit-flange-size",
    "edit-web-size",

    // 仮ボルト詳細の入力欄
    "edit-shop-temp-bolt-size",
    "edit-shop-temp-bolt-size-f",
    "edit-shop-temp-bolt-size-w",

    // 複合スプライスの入力欄（初期表示されているもの）
    "edit-web-size", // 重複していますが念のため
    "edit-web-size-2",
    "edit-web-size-3",
    "edit-web-size-4",
  ];

  boltInputIds.forEach((id) => {
    const inputElement = document.getElementById(id);

    // 要素が存在する場合のみイベントを設定
    if (inputElement) {
      // クリックされたらボルト選択モーダルを開く
      inputElement.addEventListener("click", (e) => {
        // 1. 現在操作中の入力欄を state に保存
        state.activeBoltTarget = e.target;

        // 2. モーダルの中身（ボタン一覧）を生成
        populateGlobalBoltSelectorModal();

        // 3. モーダルを表示
        // ※IDはHTMLに合わせて修正してください
        const modal = document.getElementById("bolt-selector-modal");
        openModal(modal);
      });
    }
  });
}

/**
 * 工事登録・編集フォーム関連のイベント
 */
const setupProjectFormEvents = () => {
  // --- 1. 新規工事登録フォームの要素 ---
  const advancedSettingsToggle = document.getElementById(
    "advanced-settings-toggle",
  );
  const simpleProjectSettings = document.getElementById(
    "simple-project-settings",
  );
  const advancedProjectSettings = document.getElementById(
    "advanced-project-settings",
  );

  const addCustomLevelsCountInput = document.getElementById(
    "add-custom-levels-count",
  );
  const customLevelsContainer = document.getElementById(
    "custom-levels-container",
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
  const customAreasContainer = document.getElementById(
    "custom-areas-container",
  );
  const addDecrementAreasBtn = document.getElementById(
    "add-decrement-areas-btn",
  );
  const addIncrementAreasBtn = document.getElementById(
    "add-increment-areas-btn",
  );

  // --- 2. 工事編集モーダルの要素 ---
  const editCustomLevelsCountInput = document.getElementById(
    "edit-custom-levels-count",
  );
  const editCustomLevelsContainer = document.getElementById(
    "edit-custom-levels-container",
  );
  const decrementLevelsBtn = document.getElementById("decrement-levels-btn");
  const incrementLevelsBtn = document.getElementById("increment-levels-btn");

  const editCustomAreasCountInput = document.getElementById(
    "edit-custom-areas-count",
  );
  const editCustomAreasContainer = document.getElementById(
    "edit-custom-areas-container",
  );
  const decrementAreasBtn = document.getElementById("decrement-areas-btn");
  const incrementAreasBtn = document.getElementById("increment-areas-btn");

  // ▼▼▼ 新規登録フォームのイベント ▼▼▼

  // 詳細設定トグル
  if (
    advancedSettingsToggle &&
    simpleProjectSettings &&
    advancedProjectSettings
  ) {
    advancedSettingsToggle.addEventListener("change", (e) => {
      simpleProjectSettings.classList.toggle("hidden", e.target.checked);
      advancedProjectSettings.classList.toggle("hidden", !e.target.checked);
    });
  }

  // 階層数 (新規)
  if (addDecrementLevelsBtn) {
    addDecrementLevelsBtn.addEventListener("click", () =>
      updateDynamicInputs(
        addCustomLevelsCountInput,
        customLevelsContainer,
        state.newLevelNameCache, // stateから参照
        "custom-level",
        -1,
      ),
    );
  }
  if (addIncrementLevelsBtn) {
    addIncrementLevelsBtn.addEventListener("click", () =>
      updateDynamicInputs(
        addCustomLevelsCountInput,
        customLevelsContainer,
        state.newLevelNameCache, // stateから参照
        "custom-level",
        1,
      ),
    );
  }

  // エリア数 (新規)
  if (addDecrementAreasBtn) {
    addDecrementAreasBtn.addEventListener("click", () =>
      updateDynamicInputs(
        addCustomAreasCountInput,
        customAreasContainer,
        state.newAreaNameCache, // stateから参照
        "custom-area",
        -1,
      ),
    );
  }
  if (addIncrementAreasBtn) {
    addIncrementAreasBtn.addEventListener("click", () =>
      updateDynamicInputs(
        addCustomAreasCountInput,
        customAreasContainer,
        state.newAreaNameCache, // stateから参照
        "custom-area",
        1,
      ),
    );
  }

  // ▼▼▼ 工事編集モーダルのイベント ▼▼▼

  // 手入力防止 (Backspace/Delete無効化)
  [editCustomLevelsCountInput, editCustomAreasCountInput].forEach((input) => {
    if (input) {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" || e.key === "Delete") {
          e.preventDefault();
        }
      });
    }
  });

  // 階層数 (編集)
  if (decrementLevelsBtn) {
    decrementLevelsBtn.addEventListener("click", () =>
      updateDynamicInputs(
        editCustomLevelsCountInput,
        editCustomLevelsContainer,
        state.levelNameCache, // stateから参照
        "edit-level",
        -1,
      ),
    );
  }
  if (incrementLevelsBtn) {
    incrementLevelsBtn.addEventListener("click", () =>
      updateDynamicInputs(
        editCustomLevelsCountInput,
        editCustomLevelsContainer,
        state.levelNameCache, // stateから参照
        "edit-level",
        1,
      ),
    );
  }

  // エリア数 (編集)
  if (decrementAreasBtn) {
    decrementAreasBtn.addEventListener("click", () =>
      updateDynamicInputs(
        editCustomAreasCountInput,
        editCustomAreasContainer,
        state.areaNameCache, // stateから参照
        "edit-area",
        -1,
      ),
    );
  }
  if (incrementAreasBtn) {
    incrementAreasBtn.addEventListener("click", () =>
      updateDynamicInputs(
        editCustomAreasCountInput,
        editCustomAreasContainer,
        state.areaNameCache, // stateから参照
        "edit-area",
        1,
      ),
    );
  }
};
