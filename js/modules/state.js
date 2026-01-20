export const state = {
  projects: [],
  currentProjectId: null,
  activeBoltTarget: null,
  tempJointData: null,
  activeTab: "joints",
  scrollPositions: { joints: 0, tally: 0 },
  pendingAction: null,
  pendingUpdateData: null,
  scrollPositions: { joints: 0, tally: 0 },
  orderDetailsView: "location", // 'location' または 'section'
  // ▼▼▼ 追加：タブの選択状態管理 ▼▼▼
  activeMemberLevel: "all", // 部材リスト用 ('all' または 階層ID)
  activeTallyLevel: "all", // 箇所数入力用 ('all' または 階層ID)
  tempOrderDetailsView: "section", // 'location' or 'section'
  tempOrderDetailsGroupAll: false, // 工区まとめ設定 (true=全工区まとめ, false=工区別)
  tempOrderDetailsGroupKey: "section", // 'section' (工区別) or 'floor' (フロア別)

  // ▼▼▼ 追記: 個別の階層設定を保持する配列 ▼▼▼
  bulkMemberLevels: [], // 部材ごとの階層ID配列を格納する配列
  activeBulkMemberIndex: -1, // 現在階層を選択中の部材のインデックス

  // ▼▼▼ 修正：ソート状態をセクションごとに管理するためのオブジェクト ▼▼▼
  sort: {}, // { 'sectionId': { key: 'name', order: 'asc' }, ... }

  pendingAction: null,
  pendingUpdateData: null,

  // ▼▼▼ 追加：グローバルボルトサイズ設定 ▼▼▼
  globalBoltSizes: [],
};

export function resetTempJointData() {
  state.tempJointData = null;
}
