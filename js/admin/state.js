// 管理画面 状態管理

export const adminState = {
  // ── 画面管理 ──────────────────────────────────────────────
  // 'calendar' | 'plan-form' | 'grid'
  adminScreen: 'calendar',

  // カレンダー表示月（月初日で管理）
  displayMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),

  // カレンダーで選択中の日付 'YYYY-MM-DD'
  selectedDate: null,

  // ── カレンダー用データ ────────────────────────────────────
  projects:   [],   // bolt プロジェクト一覧（カレンダー名称表示 + A1 コンボ候補）
  plansCache: {},   // { 'YYYY-MM': plan[] }

  // ── A1 計画登録フォーム内部状態 ───────────────────────────
  a1: {
    // A1 コンボボックス候補（bolt アプリ側工事一覧）
    boltProjects: [],

    // フォーム入力値
    form: {
      projectId:        '',
      newProjectName:   '',
      startDate:        '',          // カレンダー選択日。A1 では固定表示
      deliveryDays:     1,
      dateAssignMode:   'all_days',  // 'all_days' | 'weekday_only' | 'all_days_holiday'
      drawingAssignMode: 'serial',   // 'serial'（将来拡張予定）
    },

    // プレビュー行（登録本体）
    // deliveryDay は固定通し番号、他は編集可
    previewRows: [],
    // [{ deliveryDay, deliveryDate, dayLabel, drawingNo }]
  },

  // ── 選択中の計画 ──────────────────────────────────────────
  selectedProjectId: null,
  selectedPlanId:    null,

  // 選択中の号車・品目
  selectedTruckId:      null,
  selectedItemId:       null,   // 主選択（単一）
  multiSelectedItemIds: [],     // Ctrl/Shift 複数選択中の品目ID配列

  // 右サイドバーモード: 'idle' | 'view' | 'edit' | 'new'
  rightPanelMode: 'idle',

  // ロード済みデータ
  trucks:     [],   // getTrucksForPlan の結果
  itemsCache: {},   // { [truckId]: item[] }

  // ── A0 カレンダー右サイドバー（シリーズ編集）────────────────
  a0edit: {
    projectId:      null,
    // 編集対象計画（deliverySeriesIndex 順）
    // [{ id, deliveryDate, dayIndex, drawingNo, deliverySeriesId,
    //    deliverySeriesIndex, deliverySeriesLength, ... }]
    plans:          [],
    dateAssignMode: 'all_days',  // サイドバー内モード選択値
  },
};

/**
 * 号車を trucks 配列に追加する（createTruck 後に呼ぶ）
 * @param {object} truck - id 付き号車オブジェクト
 */
export function addTruckToState(truck) {
  adminState.trucks = [...adminState.trucks, truck];
}

/**
 * 品目をキャッシュに追加する（createItem 後に呼ぶ）
 * @param {string} truckId
 * @param {object} item - id 付き品目オブジェクト
 */
export function addItemToState(truckId, item) {
  if (!adminState.itemsCache[truckId]) adminState.itemsCache[truckId] = [];
  adminState.itemsCache[truckId] = [...adminState.itemsCache[truckId], item];
}

/**
 * キャッシュ内の品目を更新する（updateItem 後に呼ぶ）
 * @param {string} truckId
 * @param {object} item - id 付き更新済み品目オブジェクト
 */
export function updateItemInState(truckId, item) {
  if (!adminState.itemsCache[truckId]) return;
  adminState.itemsCache[truckId] = adminState.itemsCache[truckId].map(
    i => i.id === item.id ? { ...i, ...item } : i,
  );
}

/**
 * キャッシュから品目を削除する（deleteItem 後に呼ぶ）
 * @param {string} truckId
 * @param {string} itemId
 */
export function removeItemFromState(truckId, itemId) {
  if (!adminState.itemsCache[truckId]) return;
  adminState.itemsCache[truckId] = adminState.itemsCache[truckId].filter(i => i.id !== itemId);
}

/**
 * trucks 配列内の号車を更新する（updateTruck 後に呼ぶ）
 * @param {object} truck - id 付き更新済み号車オブジェクト
 */
export function updateTruckInState(truck) {
  adminState.trucks = adminState.trucks.map(t => t.id === truck.id ? { ...t, ...truck } : t);
}

/**
 * trucks 配列から号車を削除する（deleteTruckCascade 後に呼ぶ）
 * @param {string} truckId
 */
export function removeTruckFromState(truckId) {
  adminState.trucks = adminState.trucks.filter(t => t.id !== truckId);
  delete adminState.itemsCache[truckId];
}
