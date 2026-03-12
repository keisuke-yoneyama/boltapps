// 管理画面 状態管理

export const adminState = {
  // 選択中の計画（起動時は DEV_MODE のデフォルト値）
  selectedProjectId: 'dev-project-1',
  selectedPlanId:    'dev-plan-1',

  // 選択中の号車・品目
  selectedTruckId:      null,
  selectedItemId:       null,   // 主選択（単一）
  multiSelectedItemIds: [],     // Ctrl/Shift 複数選択中の品目ID配列

  // 右サイドバーモード: 'idle' | 'view' | 'edit' | 'new'
  rightPanelMode: 'idle',

  // ロード済みデータ
  trucks:     [],   // getTrucksForPlan の結果
  itemsCache: {},   // { [truckId]: item[] }
};

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
