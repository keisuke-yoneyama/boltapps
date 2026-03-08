// 搬入リスト固有のステート
// 将来的にボルト計算アプリと分離しやすいよう独立させる

export const deliveryState = {
  displayMonth: (() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  })(),
  selectedDate: null,
  selectedProjectId: null,
  selectedProjectName: null,
  selectedPlanId: null,
  // 搬入日詳細画面 (3)
  selectedTruckId: null,
  uncheckedOnly: false,
  projectSectionOpenState: {},  // { projectId: true=open / false=closed }
  dateDetailProjectFilter: '',
  // 号車詳細画面 (4)
  trucksForCurrentPlan: [],  // truckOrder 順ソート済み
  currentTruckIndex: 0,
  // キャッシュ
  deliveryProjects: [],  // 搬入リスト用工事マスタ
  plansCache: {},        // key: 'YYYY-MM', value: [planDoc...]
  trucksCache: {},       // key: planId, value: [truckDoc...]
  itemsCache: {},        // key: truckId, value: [itemDoc...]
  checksCache: {},       // key: truckId, value: { itemId: checkStatus }
};
