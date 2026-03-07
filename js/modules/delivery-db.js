// 搬入リスト固有の Firestore アクセス
// 既存 db.js とは責務を分ける

import { db, appId } from './firebase.js';
import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  setDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// コレクションパス（既存アプリの namespace に合わせる）
const base = () => `artifacts/${appId}/public/data`;
const deliveryProjectsCol = () => collection(db, `${base()}/deliveryProjects`);
const deliveryPlansCol = () => collection(db, `${base()}/deliveryPlans`);

// ── Projects ──────────────────────────────────────────────

export async function getDeliveryProjects() {
  try {
    const snap = await getDocs(deliveryProjectsCol());
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('[delivery-db] getDeliveryProjects:', e);
    return [];
  }
}

export async function addDeliveryProject(data) {
  return await addDoc(deliveryProjectsCol(), {
    ...data,
    sourceType: data.sourceType || 'manual',
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// ── Plans ─────────────────────────────────────────────────

/**
 * 指定月の搬入計画を全件取得
 * @param {number} year
 * @param {number} month - 0始まり (JS標準)
 */
export async function getPlansForMonth(year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
  try {
    const q = query(
      deliveryPlansCol(),
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

export async function addDeliveryPlan(data) {
  return await addDoc(deliveryPlansCol(), {
    ...data,
    status: 'planned',
    updatedAt: serverTimestamp(),
  });
}

/**
 * 指定 planId の号車一覧を取得（サブコレクション）
 */
export async function getTrucksForPlan(planId) {
  try {
    const trucksRef = collection(db, `${base()}/deliveryPlans/${planId}/trucks`);
    const snap = await getDocs(trucksRef);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('[delivery-db] getTrucksForPlan:', e);
    return [];
  }
}

/**
 * 指定 truck の品目一覧を取得（sortOrder 順）
 */
export async function getItemsForTruck(planId, truckId) {
  try {
    const ref = collection(db, `${base()}/deliveryPlans/${planId}/trucks/${truckId}/items`);
    const q = query(ref, orderBy('sortOrder'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    // orderBy index なしでも fallback
    try {
      const ref = collection(db, `${base()}/deliveryPlans/${planId}/trucks/${truckId}/items`);
      const snap = await getDocs(ref);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    } catch (e2) {
      console.error('[delivery-db] getItemsForTruck:', e2);
      return [];
    }
  }
}

/**
 * 指定 truck のチェック一覧を { itemId: checkStatus } マップで返す
 */
export async function getChecksForTruck(planId, truckId) {
  try {
    const ref = collection(db, `${base()}/deliveryPlans/${planId}/trucks/${truckId}/checks`);
    const snap = await getDocs(ref);
    const map = {};
    snap.docs.forEach(d => {
      const data = d.data();
      map[data.deliveryItemId || d.id] = data.checkStatus || 'unchecked';
    });
    return map;
  } catch (e) {
    console.error('[delivery-db] getChecksForTruck:', e);
    return {};
  }
}

/**
 * 品目チェック状態を書き込む（doc ID = itemId で upsert）
 */
export async function setItemCheck(planId, truckId, itemId, checkStatus) {
  const checkRef = doc(db, `${base()}/deliveryPlans/${planId}/trucks/${truckId}/checks/${itemId}`);
  await setDoc(checkRef, {
    deliveryItemId: itemId,
    checkType: 'item',
    checkStatus,
    checkedAt: serverTimestamp(),
    checkedBy: 'editor',
  }, { merge: true });
}

/**
 * 号車全体の progressStatus を更新
 */
export async function updateTruckStatus(planId, truckId, progressStatus) {
  const truckRef = doc(db, `${base()}/deliveryPlans/${planId}/trucks/${truckId}`);
  await updateDoc(truckRef, {
    progressStatus,
    updatedAt: serverTimestamp(),
    updatedBy: 'editor',
  });
}

export async function getActivePlansByProject(projectId) {
  try {
    const q = query(deliveryPlansCol(), where('projectId', '==', projectId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('[delivery-db] getActivePlansByProject:', e);
    return [];
  }
}
