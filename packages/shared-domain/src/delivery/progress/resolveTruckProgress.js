/**
 * item.checked 集計から号車の積込進捗を返す
 *
 * @param {Array<{ checked?: boolean }>} items
 * @returns {'pending' | 'in_progress' | 'done'}
 */
export function resolveTruckProgress(items) {
  if (!items?.length) return 'pending';
  const checkedCount = items.filter(i => i.checked).length;
  if (checkedCount === 0) return 'pending';
  if (checkedCount === items.length) return 'done';
  return 'in_progress';
}
