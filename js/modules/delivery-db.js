// 搬入リスト固有の Firestore アクセス

import { db } from './firebase.js';
import {
  collection,
  collectionGroup,
  doc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// ── 開発用モック ───────────────────────────────────────────
// Firestoreが空のときだけ使用。本番時は false に切り替える。

// true: Firestoreが空またはエラーの時にモックデータで補完（開発専用）
// false: 本番モード。Firestore実データのみ使用
const DEV_MODE = false;

// プロジェクト1: 計画図番あり・3日シリーズ（日切替UIテスト用）
const _M_PROJ_ID   = 'dev-project-1';
const _M_SERIES_ID = 'dev-series-1';
const _M_PLAN_ID   = 'dev-plan-1';   // シリーズ 1日目
const _M_PLAN_S2   = 'dev-plan-s2';  // シリーズ 2日目
const _M_PLAN_S3   = 'dev-plan-s3';  // シリーズ 3日目
const _M_T1  = 'dev-truck-1';
const _M_T2  = 'dev-truck-2';
const _M_T3  = 'dev-truck-3';
const _M_TS2 = 'dev-truck-s2';       // plan-s2 用
const _M_TS3 = 'dev-truck-s3';       // plan-s3 用

// プロジェクト2: 計画図番なし・単体計画
const _M_PROJ2_ID = 'dev-project-2';
const _M_PLAN2_ID = 'dev-plan-2';
const _M_T4 = 'dev-truck-4';

const _todayStr = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

const _day2Str = (() => {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

const _day3Str = (() => {
  const d = new Date(); d.setDate(d.getDate() + 2);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

const MOCK_PROJECTS = [
  { id: _M_PROJ_ID,  projectName: '【DEV】テスト工事 A', projectCode: 'DEV-001', isActive: true },
  { id: _M_PROJ2_ID, projectName: '【DEV】テスト工事 B', projectCode: 'DEV-002', isActive: true },
];

const MOCK_PLANS = [
  // ── 工事A: 3日間シリーズ（日切替UIテスト用） ──────────────
  // Plan1: シリーズ1日目（計画図番あり・差分あり）
  {
    id: _M_PLAN_ID, projectId: _M_PROJ_ID,
    deliveryDate: _todayStr, status: 'active', version: 1,
    drawingNo: 'DWG-2026-001', truckCount: 3,
    deliverySeriesId: _M_SERIES_ID, deliverySeriesIndex: 1, deliverySeriesLength: 3, dayIndex: 1,
  },
  // Plan-S2: シリーズ2日目
  {
    id: _M_PLAN_S2, projectId: _M_PROJ_ID,
    deliveryDate: _day2Str, status: 'active', version: 1,
    drawingNo: 'DWG-2026-002', truckCount: 1,
    deliverySeriesId: _M_SERIES_ID, deliverySeriesIndex: 2, deliverySeriesLength: 3, dayIndex: 2,
  },
  // Plan-S3: シリーズ3日目
  {
    id: _M_PLAN_S3, projectId: _M_PROJ_ID,
    deliveryDate: _day3Str, status: 'active', version: 1,
    drawingNo: 'DWG-2026-003', truckCount: 1,
    deliverySeriesId: _M_SERIES_ID, deliverySeriesIndex: 3, deliverySeriesLength: 3, dayIndex: 3,
  },
  // ── 工事B: 単体計画（計画図番なし・別工事・同日） ─────────
  {
    id: _M_PLAN2_ID, projectId: _M_PROJ2_ID,
    deliveryDate: _todayStr, status: 'active', version: 1,
    truckCount: 1,
  },
];

const MOCK_TRUCKS = [
  // ── Plan1: 工事A ──────────────────────────────────────
  // Truck1: 多種別混在・差分複数色・注意・積込指示・チェック一部ON ← 画面A中央グリッド確認メイン
  {
    id: _M_T1, projectId: _M_PROJ_ID, planId: _M_PLAN_ID,
    truckNo: '1', truckOrder: 1, vehicleType: '4t平ボディ',
    progressStatus: 'pending', constructionDay: 1,
    loadSummary: '大梁 / 小梁 / 柱 他',
    cautionNotes: '搬入口が狭いため要注意', hasCaution: true,
    loadingInstruction: '', hasLoadingInstruction: false,
    diffs: [{ date: '2026-03-13', type: '追加' }, { date: '2026-03-14', type: '変更' }],
    itemCount: 14, checkedCount: 1,
  },
  // Truck2: アンカーボルト系・積込指示あり・差分あり・チェック一部ON
  {
    id: _M_T2, projectId: _M_PROJ_ID, planId: _M_PLAN_ID,
    truckNo: '2', truckOrder: 2, vehicleType: '2t箱車',
    progressStatus: 'in_progress', constructionDay: 1,
    loadSummary: 'アンカーボルト / ナット / 座金',
    loadingInstruction: '精密部品のため横積み禁止', hasLoadingInstruction: true,
    cautionNotes: '', hasCaution: false,
    diffs: [{ date: '2026-03-13', type: '変更' }],
    itemCount: 3, checkedCount: 1,
  },
  // Truck3: 全チェック済み・積込完了バナー確認用・建方2日目
  {
    id: _M_T3, projectId: _M_PROJ_ID, planId: _M_PLAN_ID,
    truckNo: '3', truckOrder: 3, vehicleType: '大型トレーラー',
    progressStatus: 'done', constructionDay: 2,
    loadSummary: '大梁 / 小梁 / スタッド / デッキ',
    hasCaution: false, hasLoadingInstruction: false, diffs: [],
    itemCount: 5, checkedCount: 5,
  },
  // ── Plan-S2: 工事A シリーズ2日目 ─────────────────────
  {
    id: _M_TS2, projectId: _M_PROJ_ID, planId: _M_PLAN_S2,
    truckNo: '1', truckOrder: 1, vehicleType: '10t平ボディ',
    progressStatus: 'pending', constructionDay: 2,
    loadSummary: '小梁 / ブレス / デッキ',
    cautionNotes: '', hasCaution: false,
    loadingInstruction: '', hasLoadingInstruction: false, diffs: [],
    itemCount: 3, checkedCount: 0,
  },
  // ── Plan-S3: 工事A シリーズ3日目 ─────────────────────
  {
    id: _M_TS3, projectId: _M_PROJ_ID, planId: _M_PLAN_S3,
    truckNo: '1', truckOrder: 1, vehicleType: '4t平ボディ',
    progressStatus: 'pending', constructionDay: 3,
    loadSummary: 'ボルト / 仮ボルト / その他',
    cautionNotes: '', hasCaution: false,
    loadingInstruction: '', hasLoadingInstruction: false, diffs: [],
    itemCount: 2, checkedCount: 0,
  },
  // ── Plan2: 工事B（計画図番なし）──────────────────────
  {
    id: _M_T4, projectId: _M_PROJ2_ID, planId: _M_PLAN2_ID,
    truckNo: '1', truckOrder: 1, vehicleType: '4t平ボディ',
    progressStatus: 'pending',
    loadSummary: 'PC柱 / スリーブ',
    cautionNotes: '', hasCaution: false,
    loadingInstruction: '', hasLoadingInstruction: false, diffs: [],
    itemCount: 3, checkedCount: 0,
  },
];

const MOCK_ITEMS = {
  // ── Truck1: 多種別混在（画面A種別セクション・4列グリッド確認用） ──────────
  [_M_T1]: [
    // 大梁 (3品目)
    { id: 'mi-1-g1', name: '2SG500-1',  category: '大梁', quantity: 1, unit: '本', sortOrder:  1,
      checked: false, diffs: [{ date: '2026-03-13', type: '追加' }] },
    { id: 'mi-1-g2', name: '2SG588-1',  category: '大梁', quantity: 1, unit: '本', sortOrder:  2,
      checked: false, diffs: [] },
    { id: 'mi-1-g3', name: '2SG600-1',  category: '大梁', quantity: 1, unit: '本', sortOrder:  3,
      checked: true,  diffs: [{ date: '2026-03-14', type: '変更' }] },
    // 小梁 (4品目)
    { id: 'mi-1-b1', name: '2SB198-1',  category: '小梁', quantity: 2, unit: '本', sortOrder: 10,
      checked: false, diffs: [] },
    { id: 'mi-1-b2', name: '2SB198-2',  category: '小梁', quantity: 2, unit: '本', sortOrder: 11,
      checked: false, cautionNote: '養生テープ剥がし忘れ注意', diffs: [] },
    { id: 'mi-1-b3', name: '2SB300-1',  category: '小梁', quantity: 1, unit: '本', sortOrder: 12,
      checked: false, diffs: [{ date: '2026-03-13', type: '変更' }] },
    { id: 'mi-1-b4', name: '2SB350-1',  category: '小梁', quantity: 1, unit: '本', sortOrder: 13,
      checked: false, diffs: [] },
    // 柱 (2品目)
    { id: 'mi-1-c1', name: '2C1',        category: '柱',   quantity: 1, unit: '本', sortOrder: 20,
      checked: false, diffs: [] },
    { id: 'mi-1-c2', name: '2C2',        category: '柱',   quantity: 1, unit: '本', sortOrder: 21,
      checked: false, loadingInstruction: '底板養生必須', diffs: [] },
    // 間柱 (2品目)
    { id: 'mi-1-m1', name: 'M1',         category: '間柱', quantity: 4, unit: '本', sortOrder: 30,
      checked: false, diffs: [] },
    { id: 'mi-1-m2', name: 'M2',         category: '間柱', quantity: 4, unit: '本', sortOrder: 31,
      checked: false, diffs: [{ date: '2026-03-14', type: '削除' }] },
    // ブレース (2品目)
    { id: 'mi-1-br1', name: 'BR1',       category: 'ブレース', quantity: 1, unit: '本', sortOrder: 40,
      checked: false, diffs: [] },
    { id: 'mi-1-br2', name: 'BR2',       category: 'ブレース', quantity: 1, unit: '本', sortOrder: 41,
      checked: false, diffs: [] },
    // その他 (1品目)
    { id: 'mi-1-z1', name: '小物セット', category: 'その他',   quantity: 1, unit: '式', sortOrder: 50,
      checked: false, diffs: [] },
  ],
  // ── Truck2: アンカーボルト系・チェック一部ON ─────────────────────────────
  [_M_T2]: [
    { id: 'mi-2-1', name: 'アンカーボルト M20×200', category: 'アンカーボルト', quantity: 24, unit: '本', sortOrder: 1,
      checked: true,  diffs: [] },
    { id: 'mi-2-2', name: 'ナット M20',              category: 'アンカーボルト', quantity: 48, unit: '個', sortOrder: 2,
      checked: false, diffs: [] },
    { id: 'mi-2-3', name: '座金 φ22',               category: 'アンカーボルト', quantity: 48, unit: '枚', sortOrder: 3,
      checked: false, cautionNote: '薄物のため変形注意', diffs: [{ date: '2026-03-13', type: '変更' }] },
  ],
  // ── Truck3: 全チェック済み（積込完了バナー確認用） ───────────────────────
  [_M_T3]: [
    { id: 'mi-3-1', name: '2SG400-1',    category: '大梁',         quantity: 3,   unit: '本', sortOrder: 1, checked: true, diffs: [] },
    { id: 'mi-3-2', name: '2SB200-1',    category: '小梁',         quantity: 6,   unit: '本', sortOrder: 2, checked: true, diffs: [] },
    { id: 'mi-3-3', name: 'スタッドボルト', category: 'スタッド',   quantity: 200, unit: '本', sortOrder: 3, checked: true, diffs: [] },
    { id: 'mi-3-4', name: 'デッキプレート', category: 'デッキプレート', quantity: 10, unit: '枚', sortOrder: 4, checked: true, diffs: [] },
    { id: 'mi-3-5', name: '溶接棒',       category: 'その他',       quantity: 5,   unit: 'kg', sortOrder: 5, checked: true, diffs: [] },
  ],
  // ── Truck-S2: 工事A シリーズ2日目 ───────────────────────────────────────
  [_M_TS2]: [
    { id: 'mi-s2-1', name: '2SB198-5',    category: '小梁', quantity: 2, unit: '本', sortOrder: 1, checked: false, diffs: [] },
    { id: 'mi-s2-2', name: 'BR3',          category: 'ブレス', quantity: 1, unit: '本', sortOrder: 2, checked: false, diffs: [] },
    { id: 'mi-s2-3', name: 'デッキプレート', category: 'デッキ', quantity: 5, unit: '枚', sortOrder: 3, checked: false, diffs: [] },
  ],
  // ── Truck-S3: 工事A シリーズ3日目 ───────────────────────────────────────
  [_M_TS3]: [
    { id: 'mi-s3-1', name: 'M20×200 セット', category: 'ボルト',   quantity: 48, unit: '本', sortOrder: 1, checked: false, diffs: [] },
    { id: 'mi-s3-2', name: '仮ボルト M20',   category: '仮ボルト', quantity: 24, unit: '本', sortOrder: 2, checked: false, diffs: [] },
  ],
  // ── Truck4: 工事B・計画図番なし確認用 ────────────────────────────────────
  [_M_T4]: [
    { id: 'mi-4-1', name: 'PC柱 C1',    category: '柱',    quantity: 2, unit: '本', sortOrder: 1, checked: false, diffs: [] },
    { id: 'mi-4-2', name: 'スリーブ φ100', category: 'その他', quantity: 8, unit: '個', sortOrder: 2, checked: false, diffs: [] },
    { id: 'mi-4-3', name: '支持金物',   category: 'その他', quantity: 4, unit: '個', sortOrder: 3, checked: false, diffs: [] },
  ],
};

// ── Projects ──────────────────────────────────────────────

export async function getDeliveryProjects() {
  try {
    const snap = await getDocs(collection(db, 'projects'));
    const result = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!result.length && DEV_MODE) return MOCK_PROJECTS;
    return result;
  } catch (e) {
    console.error('[delivery-db] getDeliveryProjects:', e);
    return DEV_MODE ? MOCK_PROJECTS : [];
  }
}

// ── Plans ─────────────────────────────────────────────────

/**
 * 指定月の搬入計画を全プロジェクト横断で取得
 * @param {number} year
 * @param {number} month - 0始まり (JS標準)
 */
export async function getPlansForMonth(year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const end   = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
  try {
    const q = query(
      collectionGroup(db, 'deliveryPlans'),
      where('deliveryDate', '>=', start),
      where('deliveryDate', '<=', end),
    );
    const snap = await getDocs(q);
    const result = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!result.length && DEV_MODE) {
      return MOCK_PLANS.filter(p => p.deliveryDate >= start && p.deliveryDate <= end);
    }
    return result;
  } catch (e) {
    console.error('[delivery-db] getPlansForMonth:', e);
    if (DEV_MODE) return MOCK_PLANS.filter(p => p.deliveryDate >= start && p.deliveryDate <= end);
    return [];
  }
}

// ── Trucks ────────────────────────────────────────────────

/**
 * 号車一覧を取得（truckOrder 昇順）
 */
export async function getTrucksForPlan(projectId, planId) {
  try {
    const ref  = collection(db, `projects/${projectId}/deliveryPlans/${planId}/trucks`);
    const q    = query(ref, orderBy('truckOrder'));
    const snap = await getDocs(q);
    const result = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!result.length && DEV_MODE) return MOCK_TRUCKS.filter(t => t.planId === planId);
    return result;
  } catch (e) {
    // orderBy index なしの fallback
    try {
      const ref  = collection(db, `projects/${projectId}/deliveryPlans/${planId}/trucks`);
      const snap = await getDocs(ref);
      const result = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.truckOrder ?? 999) - (b.truckOrder ?? 999));
      if (!result.length && DEV_MODE) return MOCK_TRUCKS.filter(t => t.planId === planId);
      return result;
    } catch (e2) {
      console.error('[delivery-db] getTrucksForPlan:', e2);
      return DEV_MODE ? MOCK_TRUCKS.filter(t => t.planId === planId) : [];
    }
  }
}

// ── Items ─────────────────────────────────────────────────

/**
 * 品目一覧を取得（sortOrder 昇順）
 * item.checked を正とするため checks サブコレクションは参照しない
 */
export async function getItemsForTruck(projectId, planId, truckId) {
  try {
    const ref  = collection(db, `projects/${projectId}/deliveryPlans/${planId}/trucks/${truckId}/items`);
    const q    = query(ref, orderBy('sortOrder'));
    const snap = await getDocs(q);
    const result = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!result.length && DEV_MODE) return MOCK_ITEMS[truckId] ?? [];
    return result;
  } catch (e) {
    // orderBy index なしの fallback
    try {
      const ref  = collection(db, `projects/${projectId}/deliveryPlans/${planId}/trucks/${truckId}/items`);
      const snap = await getDocs(ref);
      const result = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      if (!result.length && DEV_MODE) return MOCK_ITEMS[truckId] ?? [];
      return result;
    } catch (e2) {
      console.error('[delivery-db] getItemsForTruck:', e2);
      return DEV_MODE ? (MOCK_ITEMS[truckId] ?? []) : [];
    }
  }
}

// ── Writes ────────────────────────────────────────────────

/**
 * 品目のチェック状態を item.checked で更新
 */
export async function setItemChecked(projectId, planId, truckId, itemId, checked) {
  if (DEV_MODE) return; // モックデータのためFirestore書き込みをスキップ
  const ref = doc(db, `projects/${projectId}/deliveryPlans/${planId}/trucks/${truckId}/items/${itemId}`);
  await updateDoc(ref, { checked, updatedAt: serverTimestamp() });
}

/**
 * 号車全体の progressStatus を更新
 */
export async function updateTruckStatus(projectId, planId, truckId, progressStatus) {
  if (DEV_MODE) return; // モックデータのためFirestore書き込みをスキップ
  const ref = doc(db, `projects/${projectId}/deliveryPlans/${planId}/trucks/${truckId}`);
  await updateDoc(ref, { progressStatus, updatedAt: serverTimestamp() });
}
