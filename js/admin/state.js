// 管理画面 状態管理

export const adminState = {
  // 選択中の計画（起動時は DEV_MODE のデフォルト値）
  selectedProjectId: 'dev-project-1',
  selectedPlanId:    'dev-plan-1',

  // 選択中の号車・品目
  selectedTruckId:      null,
  selectedItemId:       null,   // 主選択（単一）
  multiSelectedItemIds: [],     // Ctrl/Shift 複数選択中の品目ID配列

  // ロード済みデータ
  trucks:     [],   // getTrucksForPlan の結果
  itemsCache: {},   // { [truckId]: item[] }
};
