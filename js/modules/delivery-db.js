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

// ── Projects ──────────────────────────────────────────────

export async function getDeliveryProjects() {
  try {
    const snap = await getDocs(collection(db, 'projects'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('[delivery-db] getDeliveryProjects:', e);
    return [];
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
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('[delivery-db] getPlansForMonth:', e);
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
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    // orderBy index なしの fallback
    try {
      const ref  = collection(db, `projects/${projectId}/deliveryPlans/${planId}/trucks`);
      const snap = await getDocs(ref);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.truckOrder ?? 999) - (b.truckOrder ?? 999));
    } catch (e2) {
      console.error('[delivery-db] getTrucksForPlan:', e2);
      return [];
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
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    // orderBy index なしの fallback
    try {
      const ref  = collection(db, `projects/${projectId}/deliveryPlans/${planId}/trucks/${truckId}/items`);
      const snap = await getDocs(ref);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    } catch (e2) {
      console.error('[delivery-db] getItemsForTruck:', e2);
      return [];
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
