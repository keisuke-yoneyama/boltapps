// shared-domain エントリーポイント
// 各モジュールは個別 import も可

export { resolveTruckProgress } from './delivery/progress/resolveTruckProgress.js';
export { diffColorIndex }       from './delivery/diff/diffColor.js';
export { formatDiffBadge }      from './delivery/diff/formatDiffBadge.js';
export { summarizeCalendarDay } from './delivery/plans/summarizeCalendarDay.js';
export { buildItemName }        from './delivery/item-name/buildItemName.js';
export { compareItemNames }     from './delivery/sorting/compareItemNames.js';
export { sortItems }            from './delivery/sorting/sortItems.js';
