import { compareItemNames } from './compareItemNames.js';

/**
 * 品目リストをソートして新しい配列を返す
 * sortOrder が両方あれば数値順優先、なければ品名の自然順
 *
 * 既存の Firestore orderBy('sortOrder') 結果を壊さないよう、
 * sortOrder が設定済みの場合はそれを最優先する。
 *
 * @param {Array<{ name?: string, itemName?: string, sortOrder?: number }>} items
 * @returns {Array}
 */
export function sortItems(items) {
  return [...items].sort((a, b) => {
    const oa = a.sortOrder ?? null;
    const ob = b.sortOrder ?? null;

    // 両方 sortOrder あり → 数値順
    if (oa !== null && ob !== null) return oa - ob;
    // 片方のみ → sortOrder ありが先
    if (oa !== null) return -1;
    if (ob !== null) return 1;
    // 両方なし → 品名の自然順
    const nameA = a.name || a.itemName || '';
    const nameB = b.name || b.itemName || '';
    return compareItemNames(nameA, nameB);
  });
}
