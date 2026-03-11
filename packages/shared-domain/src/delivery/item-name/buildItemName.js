/**
 * 品名パーツから表示用品名文字列を生成する
 *
 * @param {{
 *   prefix?:    { value: string, enabled?: boolean },
 *   baseName:   { value: string },
 *   separator?: { value: string, enabled?: boolean },
 *   suffix?:    { value: string, enabled?: boolean },
 *   note?:      { value: string, enabled?: boolean },
 * }} parts
 * @returns {string}
 *
 * @example
 * buildItemName({
 *   prefix:    { value: '2' },
 *   baseName:  { value: 'SB198' },
 *   separator: { value: '-' },
 *   suffix:    { value: '1' },
 *   note:      { value: '×4' },
 * })
 * // => '2SB198-1×4'
 *
 * // suffix が disabled なら separator も付かない
 * buildItemName({
 *   prefix:    { value: '2' },
 *   baseName:  { value: 'SB198' },
 *   separator: { value: '-' },
 *   suffix:    { value: '1', enabled: false },
 *   note:      { value: '×4' },
 * })
 * // => '2SB198×4'
 */
export function buildItemName({ prefix, baseName, separator, suffix, note } = {}) {
  if (!baseName?.value) return '';

  let name = '';

  if (prefix?.enabled !== false && prefix?.value) {
    name += prefix.value;
  }

  name += baseName.value;

  // separator は suffix が有効な場合のみ使う
  const suffixEnabled = suffix?.enabled !== false && !!suffix?.value;
  if (suffixEnabled) {
    if (separator?.enabled !== false && separator?.value) {
      name += separator.value;
    }
    name += suffix.value;
  }

  if (note?.enabled !== false && note?.value) {
    name += note.value;
  }

  return name;
}
