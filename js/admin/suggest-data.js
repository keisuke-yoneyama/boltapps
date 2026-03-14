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
 * 自然ソート比較関数
 * 数値部分を数値として比較するため 2SB198-2 < 2SB198-10 になる
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function naturalCompare(a, b) {
  const split = s => s.match(/(\d+|\D+)/g) ?? [];
  const pa = split(a);
  const pb = split(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if (i >= pa.length) return -1;
    if (i >= pb.length) return 1;
    const na = parseInt(pa[i], 10);
    const nb = parseInt(pb[i], 10);
    if (!isNaN(na) && !isNaN(nb)) {
      if (na !== nb) return na - nb;
    } else {
      const cmp = pa[i].localeCompare(pb[i], 'ja');
      if (cmp !== 0) return cmp;
    }
  }
  return 0;
}

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

/**
 * 全候補を返す（フォーカス時のブラウズモード用）
 * 現在カテゴリーを先頭に出し、残りは自然ソート
 * @param {string} currentCategory
 * @param {object} itemsCache
 * @returns {{ baseName: string, category: string }[]}
 */
export function getAllCandidates(currentCategory, itemsCache) {
  const dynamic   = getDynamicCandidates(itemsCache);
  const dynKeys   = new Set(dynamic.map(c => `${c.baseName}\x00${c.category}`));
  const staticFill = MEMBER_CATALOG.filter(c => !dynKeys.has(`${c.baseName}\x00${c.category}`));
  const all = [...dynamic, ...staticFill];

  // カテゴリー優先 → 自然ソート
  all.sort((a, b) => {
    const catA = a.category === currentCategory ? 0 : 1;
    const catB = b.category === currentCategory ? 0 : 1;
    if (catA !== catB) return catA - catB;
    return naturalCompare(a.baseName, b.baseName);
  });

  // baseName 重複排除（最初に出たものを残す）
  const seen = new Set();
  return all.filter(c => {
    if (seen.has(c.baseName)) return false;
    seen.add(c.baseName);
    return true;
  });
}

const MAX_SUGGESTIONS = 200;

/**
 * サジェスト候補を返す（入力文字列でフィルタ）
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
    b.score - a.score || naturalCompare(a.baseName, b.baseName)
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
