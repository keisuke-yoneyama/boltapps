/**
 * 品名の自然順ソート用比較関数
 * - 数値部分を数値として比較する
 * - 末尾の補足（×N など）はソート比較から除外する
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} 負: a が先、正: b が先、0: 同順
 *
 * @example
 * compareItemNames('2B100-1', '2B140-1') // => 負（2B100が先）
 * compareItemNames('2B100-1', '3B100-1') // => 負（2B100が先）
 * compareItemNames('2B140-1×4', '2B140-1×2') // => 0相当（補足除外）
 */
export function compareItemNames(a, b) {
  const normalize = s => String(s || '').replace(/[×x×]\d+$/, '').trim();
  return normalize(a).localeCompare(normalize(b), 'ja', {
    numeric: true,
    sensitivity: 'base',
  });
}
