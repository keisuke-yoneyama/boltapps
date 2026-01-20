import { appId, db, projectsCollectionRef } from "./firebase.js";

import {
  getFirestore,
  collection,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch,
  getDoc,
  setDoc,
  query,
  getDocs,
  where,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ▼▼▼ グローバル設定用のパス定義 ▼▼▼
const globalSettingsPath = `artifacts/${appId}/public/data/settings/global`;

/**
 * プロジェクト一覧を監視する関数
 * @param {Function} onUpdate - データ更新時に呼ばれる (projects: Array, source: string) => void
 * @param {Function} onError - エラー時に呼ばれる (error: Error) => void
 * @returns {Function} - 監視を解除する関数 (unsubscribe)
 */
export function subscribeToProjects(onUpdate, onError) {
  // onSnapshotの返り値（unsubscribe関数）をそのまま呼び出し元に返す
  return onSnapshot(
    projectsCollectionRef,
    (snapshot) => {
      // 1. データの出処を判定 (Local or Server)
      const source = snapshot.metadata.hasPendingWrites ? "Local" : "Server";

      // 2. ドキュメントを使いやすい配列データに変換
      const projects = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // 3. 整形したデータとソース情報をapp.jsへ渡す
      onUpdate(projects, source);
    },
    (error) => {
      if (onError) onError(error);
    }
  );
}
/**
 * 新しいプロジェクトを追加する関数
 * @param {Object} projectData
 * @returns {Promise} - 追加されたドキュメントの参照
 */
export async function addProject(projectData) {
  return await addDoc(projectsCollectionRef, projectData);
}
/**
 * プロジェクトを削除する関数
 * @param {string} projectId
 */
export async function deleteProject(projectId) {
  const projectRef = doc(projectsCollectionRef, projectId);
  await deleteDoc(projectRef);
}
/**
 * 汎用的なドキュメント更新関数 (updateDocのラッパー)
 * @param {string} projectId
 * @param {Object} data - 更新するデータ
 */
export async function updateProjectData(projectId, data) {
  const projectRef = doc(projectsCollectionRef, projectId);
  await updateDoc(projectRef, data);
}

/**
 * 指定したIDのプロジェクト情報を取得する
 * @returns {Promise<Object|null>} データがあればオブジェクト、なければnull
 */
export async function getProjectById(projectId) {
  const docRef = doc(projectsCollectionRef, projectId);
  const snapshot = await getDoc(docRef);

  if (snapshot.exists()) {
    return { id: snapshot.id, ...snapshot.data() };
  } else {
    return null;
  }
}

/**
 * IDを指定してプロジェクトを作成/上書きする
 */
export async function setProjectData(projectId, data) {
  const docRef = doc(projectsCollectionRef, projectId);
  await setDoc(docRef, data, { merge: true });
}

/**
 * 全てのプロジェクトデータを取得する
 * @returns {Promise<Array>} プロジェクトオブジェクトの配列
 */
export async function getAllProjects() {
  const snapshot = await getDocs(projectsCollectionRef);

  // Snapshot(Firebase固有) を 配列(JS標準) に変換して返す
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

/**
 * 複数のプロジェクトの物件名を一括更新する
 * @param {Array<string>} projectIds - 更新対象のプロジェクトIDのリスト
 * @param {string} newName - 新しい物件名
 */
export async function updateProjectPropertyNameBatch(projectIds, newName) {
  const batch = writeBatch(db);

  projectIds.forEach((id) => {
    // projectsCollectionRef を使えば doc(ref, id) だけでOK
    const projectRef = doc(projectsCollectionRef, id);
    batch.update(projectRef, { propertyName: newName });
  });

  await batch.commit();
}

/**
 * グローバル設定（ボルトサイズマスタなど）を取得する
 */
export async function getGlobalSettings() {
  const ref = doc(db, globalSettingsPath);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    return snap.data();
  } else {
    return null;
  }
}

/**
 * グローバル設定を保存する（マイグレーション用）
 */
export async function saveGlobalSettings(data) {
  const ref = doc(db, globalSettingsPath);
  await setDoc(ref, data, { merge: true });
}
