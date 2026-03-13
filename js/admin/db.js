// 管理画面 データアクセス
// ─ 読み取りは delivery-db.js を再利用
// ─ 書き込みは Firestore 実装（DEV_MODE 時はスタブ）

import { db } from '../modules/firebase.js';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

function trucksCol(projectId, planId) {
  return collection(db, `projects/${projectId}/deliveryPlans/${planId}/trucks`);
}

/**
 * 号車を新規作成する
 * @param {string} projectId
 * @param {string} planId
 * @param {object} truck - truckNo, truckOrder, vehicleType, etc.
 * @returns {Promise<object>} 作成された号車（id 付き）
 */
export async function createTruck(projectId, planId, truck) {
  if (DEV_MODE) {
    const newId = `mock-truck-${Date.now()}`;
    console.log('[admin-db] createTruck DEV stub', { projectId, planId, truck });
    return { id: newId, ...truck };
  }
  const ref = await addDoc(trucksCol(projectId, planId), {
    ...truck,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id, ...truck };
}

export {
  getDeliveryProjects,
  getPlansForMonth,
  getTrucksForPlan,
  getItemsForTruck,
} from '../modules/delivery-db.js';

// bolt アプリ側の工事一覧（A1 工事セレクトの候補用）
export { getAllProjects as getBoltProjects } from '../modules/db.js';

function projectsCol() {
  return collection(db, 'projects');
}

function plansCol(projectId) {
  return collection(db, `projects/${projectId}/deliveryPlans`);
}

/**
 * 工事（プロジェクト）を新規作成する
 * @param {object} data - projectName, projectCode, isActive
 * @returns {Promise<object>} 作成されたプロジェクト（id 付き）
 */
export async function createProject(data) {
  const ref = await addDoc(projectsCol(), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id, ...data };
}

/**
 * 搬入計画を新規作成する
 * @param {string} projectId
 * @param {object} planData - deliveryDate, constructionDay, drawingNo, status, truckCount, etc.
 * @returns {Promise<object>} 作成された計画（id 付き）
 */
export async function createPlan(projectId, planData) {
  const ref = await addDoc(plansCol(projectId), {
    ...planData,
    projectId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id, projectId, ...planData };
}

/**
 * 搬入計画フィールドを更新する（号車・品目には触れない）
 * @param {string} projectId
 * @param {string} planId
 * @param {object} data - 更新するフィールド
 */
export async function updatePlan(projectId, planId, data) {
  const ref = doc(plansCol(projectId), planId);
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
}

/**
 * 搬入計画を1件削除する
 * @param {string} projectId
 * @param {string} planId
 */
export async function deletePlan(projectId, planId) {
  await deleteDoc(doc(plansCol(projectId), planId));
}

/**
 * deliverySeriesId が一致する計画を全件削除する（シリーズ一括削除）
 * @param {string} projectId
 * @param {string} seriesId
 */
export async function deletePlansBySeriesId(projectId, seriesId) {
  const q = query(plansCol(projectId), where('deliverySeriesId', '==', seriesId));
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
}

const DEV_MODE = false;

function itemsCol(projectId, planId, truckId) {
  return collection(db, `projects/${projectId}/deliveryPlans/${planId}/trucks/${truckId}/items`);
}

/**
 * 品目を新規作成する
 * @param {string} projectId
 * @param {string} planId
 * @param {string} truckId
 * @param {object} item - nameParts, category, quantity, unit, sortOrder, etc.
 * @returns {Promise<object>} 作成された品目（id 付き）
 */
export async function createItem(projectId, planId, truckId, item) {
  if (DEV_MODE) {
    const newId = `mock-${Date.now()}`;
    console.log('[admin-db] createItem DEV stub', { projectId, planId, truckId, item });
    return { id: newId, ...item };
  }
  const ref = await addDoc(itemsCol(projectId, planId, truckId), {
    ...item,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id, ...item };
}

/**
 * 品目を更新する
 * @param {string} projectId
 * @param {string} planId
 * @param {string} truckId
 * @param {string} itemId
 * @param {object} item - 更新するフィールド
 */
export async function updateItem(projectId, planId, truckId, itemId, item) {
  if (DEV_MODE) {
    console.log('[admin-db] updateItem DEV stub', { projectId, planId, truckId, itemId, item });
    return;
  }
  const ref = doc(itemsCol(projectId, planId, truckId), itemId);
  await updateDoc(ref, { ...item, updatedAt: serverTimestamp() });
}

/**
 * 品目を削除する
 * @param {string} projectId
 * @param {string} planId
 * @param {string} truckId
 * @param {string} itemId
 */
export async function deleteItem(projectId, planId, truckId, itemId) {
  if (DEV_MODE) {
    console.log('[admin-db] deleteItem DEV stub', { projectId, planId, truckId, itemId });
    return;
  }
  await deleteDoc(doc(itemsCol(projectId, planId, truckId), itemId));
}

/**
 * 号車情報を保存する（スタブ）
 * @param {string} projectId
 * @param {string} planId
 * @param {string} truckId
 * @param {object} data
 */
export async function saveTruck(projectId, planId, truckId, data) {
  // TODO: Firestore write
  console.log('[admin-db] saveTruck stub', { projectId, planId, truckId, data });
}
