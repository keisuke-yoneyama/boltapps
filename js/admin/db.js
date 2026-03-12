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
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

export {
  getTrucksForPlan,
  getItemsForTruck,
} from '../modules/delivery-db.js';

const DEV_MODE = true;

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
