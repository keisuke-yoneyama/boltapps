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

const DEV_MODE = true;

const _M_PROJ_ID  = 'dev-project-1';
const _M_PLAN_ID  = 'dev-plan-1';
const _M_T1 = 'dev-truck-1';
const _M_T2 = 'dev-truck-2';
const _M_T3 = 'dev-truck-3';

const _todayStr = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

const MOCK_PROJECTS = [
  { id: _M_PROJ_ID, projectName: '【DEV】テスト工事', projectCode: 'DEV-001', isActive: true },
];

const MOCK_PLANS = [
  {
    id: _M_PLAN_ID, projectId: _M_PROJ_ID,
    deliveryDate: _todayStr, status: 'active', version: 1,
    hasDiff: true, diffCount: 2, truckCount: 3,
  },
];

const MOCK_TRUCKS = [
  {
    id: _M_T1, projectId: _M_PROJ_ID, planId: _M_PLAN_ID,
    truckNo: '1', truckOrder: 1, vehicleType: '4t平ボディ',
    progressStatus: 'pending', drawingNo: 'DWG-001',
    loadSummary: 'H鋼 / ボルト類',
    cautionNotes: '搬入口が狭いため要注意', hasCaution: true,
    loadingInstruction: '', hasLoadingInstruction: false,
    hasDiff: true, diffTypes: ['数量変更', '品目追加'],
    diffSummary: 'ボルトM16×40 数量 50→60 に変更。アングル L-65 追加。',
    itemCount: 4, checkedCount: 0,
  },
  {
    id: _M_T2, projectId: _M_PROJ_ID, planId: _M_PLAN_ID,
    truckNo: '2', truckOrder: 2, vehicleType: '2t箱車',
    progressStatus: 'in_progress',
    loadSummary: 'アンカーボルト / ナット',
    loadingInstruction: '精密部品のため横積み禁止', hasLoadingInstruction: true,
    cautionNotes: '', hasCaution: false,
    hasDiff: false,
    itemCount: 3, checkedCount: 1,
  },
  {
    id: _M_T3, projectId: _M_PROJ_ID, planId: _M_PLAN_ID,
    truckNo: '3', truckOrder: 3, vehicleType: '大型トレーラー',
    progressStatus: 'done', drawingNo: 'DWG-003',
    loadSummary: '鉄骨大梁',
    hasCaution: false, hasLoadingInstruction: false, hasDiff: false,
    itemCount: 5, checkedCount: 5,
  },
];

const MOCK_ITEMS = {
  [_M_T1]: [
    { id: 'mi-1-1', name: 'H鋼 200×100×5.5×8', quantity: 10, unit: '本', sortOrder: 1,
      checked: false, hasDiff: true, diffTypes: ['数量変更'], diffSummary: '8本→10本に変更' },
    { id: 'mi-1-2', name: 'ボルト M16×40', quantity: 60, unit: '個', sortOrder: 2,
      checked: true, cautionNote: '規格品との混入注意', hasCaution: true,
      hasDiff: true, diffTypes: ['数量変更'], diffSummary: '50個→60個に変更' },
    { id: 'mi-1-3', name: 'アングル L-65×65×6', quantity: 4, unit: '本', sortOrder: 3,
      checked: false, loadingInstruction: '束ねて積載すること', hasLoadingInstruction: true, hasDiff: false },
    { id: 'mi-1-4', name: 'ナット M16', quantity: 120, unit: '個', sortOrder: 4,
      checked: false, hasDiff: false },
  ],
  [_M_T2]: [
    { id: 'mi-2-1', name: 'アンカーボルト M20', quantity: 24, unit: '本', sortOrder: 1,
      checked: true, hasDiff: false },
    { id: 'mi-2-2', name: 'ナット M20', quantity: 48, unit: '個', sortOrder: 2,
      checked: false, hasDiff: false },
    { id: 'mi-2-3', name: '座金 φ22', quantity: 48, unit: '枚', sortOrder: 3,
      checked: false, cautionNote: '薄物のため変形注意', hasCaution: true, hasDiff: false },
  ],
  [_M_T3]: [
    { id: 'mi-3-1', name: '大梁 BH-400×200', quantity: 3, unit: '本', sortOrder: 1, checked: true, hasDiff: false },
    { id: 'mi-3-2', name: '小梁 H-200×100',  quantity: 6, unit: '本', sortOrder: 2, checked: true, hasDiff: false },
    { id: 'mi-3-3', name: 'スタッドボルト',   quantity: 200, unit: '本', sortOrder: 3, checked: true, hasDiff: false },
    { id: 'mi-3-4', name: 'デッキプレート',   quantity: 10, unit: '枚', sortOrder: 4, checked: true, hasDiff: false },
    { id: 'mi-3-5', name: '溶接棒',           quantity: 5, unit: 'kg', sortOrder: 5, checked: true, hasDiff: false },
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
    if (!result.length && DEV_MODE && planId === _M_PLAN_ID) return MOCK_TRUCKS;
    return result;
  } catch (e) {
    // orderBy index なしの fallback
    try {
      const ref  = collection(db, `projects/${projectId}/deliveryPlans/${planId}/trucks`);
      const snap = await getDocs(ref);
      const result = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.truckOrder ?? 999) - (b.truckOrder ?? 999));
      if (!result.length && DEV_MODE && planId === _M_PLAN_ID) return MOCK_TRUCKS;
      return result;
    } catch (e2) {
      console.error('[delivery-db] getTrucksForPlan:', e2);
      return DEV_MODE && planId === _M_PLAN_ID ? MOCK_TRUCKS : [];
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
  const ref = doc(db, `projects/${projectId}/deliveryPlans/${planId}/trucks/${truckId}/items/${itemId}`);
  await updateDoc(ref, { checked, updatedAt: serverTimestamp() });
}

/**
 * 号車全体の progressStatus を更新
 */
export async function updateTruckStatus(projectId, planId, truckId, progressStatus) {
  const ref = doc(db, `projects/${projectId}/deliveryPlans/${planId}/trucks/${truckId}`);
  await updateDoc(ref, { progressStatus, updatedAt: serverTimestamp() });
}
