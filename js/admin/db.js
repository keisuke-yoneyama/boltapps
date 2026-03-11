// 管理画面 データアクセス
// ─ 読み取りは delivery-db.js を再利用
// ─ 書き込みはスタブ（TODO: Firestore 実装）

export {
  getTrucksForPlan,
  getItemsForTruck,
} from '../modules/delivery-db.js';

/**
 * 品目を保存する（スタブ）
 * @param {string} projectId
 * @param {string} planId
 * @param {string} truckId
 * @param {string|null} itemId - null のとき新規作成
 * @param {object} data
 */
export async function saveItem(projectId, planId, truckId, itemId, data) {
  // TODO: Firestore write
  console.log('[admin-db] saveItem stub', { projectId, planId, truckId, itemId, data });
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
