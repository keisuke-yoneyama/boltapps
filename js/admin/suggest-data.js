// 管理画面 部材名サジェスト

/** 静的カタログ（候補ゼロ時・入力初期の補完用） */
export const MEMBER_CATALOG = [
  { baseName: 'G100',  category: '大梁' },
  { baseName: 'G150',  category: '大梁' },
  { baseName: 'G200',  category: '大梁' },
  { baseName: 'G300',  category: '大梁' },
  { baseName: 'G500',  category: '大梁' },
  { baseName: 'G588',  category: '大梁' },
  { baseName: 'B100',  category: '小梁' },
  { baseName: 'B150',  category: '小梁' },
  { baseName: 'B198',  category: '小梁' },
  { baseName: 'B200',  category: '小梁' },
  { baseName: 'B250',  category: '小梁' },
  { baseName: 'B300',  category: '小梁' },
  { baseName: 'B350',  category: '小梁' },
  { baseName: 'C1',    category: '柱' },
  { baseName: 'C2',    category: '柱' },
  { baseName: 'C3',    category: '柱' },
  { baseName: 'M1',    category: '間柱' },
  { baseName: 'M2',    category: '間柱' },
  { baseName: 'BR1',   category: 'ブレース' },
  { baseName: 'BR2',   category: 'ブレース' },
];

/**
 * itemsCache の全号車から baseName を動的に抽出する（主力候補源）
 * @param {object} itemsCache - adminState.itemsCache
 * @returns {{ baseName: string, category: string }[]}
 */
export function getDynamicCandidates(itemsCache) {
  const seen   = new Set();
  const result = [];
  for (const items of Object.values(itemsCache)) {
    for (const item of (items ?? [])) {
      const bn  = item.nameParts?.baseName?.value;
      const cat = item.category ?? '';
      if (!bn) continue;
      const key = `${bn}\x00${cat}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ baseName: bn, category: cat });
    }
  }
  return result;
}

const MAX_SUGGESTIONS = 10;

/**
 * サジェスト候補を返す
 *
 * 優先度スコア:
 *   種別一致  +20
 *   先頭一致  +10
 *   部分一致   +5
 *
 * 動的候補（既登録 items）を主力として先に評価し、
 * 静的カタログは動的候補で不足する分を補完する。
 *
 * @param {string} inputVal        入力中の値
 * @param {string} currentCategory 現在選択中のカテゴリー
 * @param {object} itemsCache      adminState.itemsCache
 * @returns {{ baseName: string, category: string }[]}
 */
export function getSuggestions(inputVal, currentCategory, itemsCache) {
  if (!inputVal) return [];
  const query = inputVal.toLowerCase();

  const dynamic  = getDynamicCandidates(itemsCache);
  const dynKeys  = new Set(dynamic.map(c => `${c.baseName}\x00${c.category}`));
  const staticFill = MEMBER_CATALOG.filter(
    c => !dynKeys.has(`${c.baseName}\x00${c.category}`)
  );

  const scored = [];
  for (const c of [...dynamic, ...staticFill]) {
    const name = c.baseName.toLowerCase();
    let score = 0;
    if      (name.startsWith(query)) score += 10;
    else if (name.includes(query))   score += 5;
    else continue;
    if (c.category === currentCategory) score += 20;
    scored.push({ ...c, score });
  }

  scored.sort((a, b) =>
    b.score - a.score || a.baseName.localeCompare(b.baseName, 'ja')
  );

  // baseName 重複は最高スコアのものだけ残す
  const seen   = new Set();
  const result = [];
  for (const item of scored) {
    if (seen.has(item.baseName)) continue;
    seen.add(item.baseName);
    result.push(item);
    if (result.length >= MAX_SUGGESTIONS) break;
  }
  return result;
}
