/**
 * 日付文字列から固定色インデックスを返す（0〜19）
 * 同じ日付は常に同じインデックスを返す決定的ハッシュ関数
 *
 * @param {string} dateStr - 'YYYY-MM-DD' 形式を推奨
 * @returns {number} 0〜19 の整数
 */
export function diffColorIndex(dateStr) {
  let h = 0;
  for (const c of String(dateStr || '')) {
    h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  }
  return h % 20;
}
