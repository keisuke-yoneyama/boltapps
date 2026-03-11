import { diffColorIndex } from './diffColor.js';

/**
 * 差分エントリから表示ラベルと色インデックスを生成する
 *
 * @param {{ date: string, type: string }} diff
 * @returns {{ label: string, colorIndex: number }}
 *
 * @example
 * formatDiffBadge({ date: '2026-03-13', type: '追加' })
 * // => { label: '3/13追加', colorIndex: N }
 *
 * formatDiffBadge({ date: '', type: '変更' })
 * // => { label: '変更', colorIndex: 0 }
 */
export function formatDiffBadge(diff) {
  const date = diff?.date || '';
  const type = diff?.type || '';
  const [, m, day] = date.split('-');
  const label = m && day
    ? `${parseInt(m)}/${parseInt(day)}${type}`
    : (type || '差分');
  return { label, colorIndex: diffColorIndex(date) };
}
