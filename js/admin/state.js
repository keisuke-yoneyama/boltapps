// 管理画面 状態管理

export const adminState = {
  // 選択中の計画（起動時は DEV_MODE のデフォルト値）
  selectedProjectId: 'dev-project-1',
  selectedPlanId:    'dev-plan-1',

  // 選択中の号車・品目
  selectedTruckId: null,
  selectedItemId:  null,

  // ロード済みデータ
  trucks:     [],   // getTrucksForPlan の結果
  itemsCache: {},   // { [truckId]: item[] }
};
