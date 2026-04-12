// 管理画面 カレンダー + 計画登録フォーム

import { adminState } from './state.js';
import {
  getBoltProjects,
  getPlansForMonth,
  createPlan,
  createProject,
  updatePlan,
  deletePlanCascade,
  deletePlansBySeriesId,
  getPlansBySeriesId,
} from './db.js';
import { initGridScreen } from './ui.js';

// ══════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// bolt プロジェクトの表示名（name 優先、なければ projectName）
function projDisplayName(proj) {
  return proj?.name || proj?.projectName || null;
}

// ── カレンダー色分け ──────────────────────────────────────

const PROJECT_COLORS = [
  '#e57373','#f06292','#ba68c8','#9575cd','#7986cb',
  '#64b5f6','#4dd0e1','#4db6ac','#81c784','#aed581',
  '#fff176','#ffb74d','#ff8a65','#a1887f','#90a4ae',
  '#e53935','#8e24aa','#1e88e5','#00acc1','#43a047',
];

/** projectId から安定した色を返す（同じ ID は常に同じ色） */
function getProjectColor(projectId) {
  let hash = 0;
  for (const ch of String(projectId)) {
    hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff;
  }
  return PROJECT_COLORS[hash % PROJECT_COLORS.length];
}

/**
 * プランをバーアイテムに変換して日付別に整理する
 * @param {object[]} plans - getPlansForMonth の結果
 * @param {object[]} boltProjects - a1.boltProjects
 * @returns {{ [dateStr]: {position, color, name, planId, projectId}[] }}
 */
function buildBarLayout(plans, boltProjects) {
  const byDate = {};
  for (const plan of plans) {
    if (!plan.deliveryDate) continue;
    if (!byDate[plan.deliveryDate]) byDate[plan.deliveryDate] = [];

    const proj  = boltProjects.find(p => p.id === plan.projectId);
    const name  = projDisplayName(proj) || '工事';
    const color = getProjectColor(plan.projectId || '');

    let position = 'bar-single';
    if (plan.deliverySeriesId && plan.deliverySeriesLength > 1) {
      if (plan.deliverySeriesIndex === 1)                              position = 'bar-start';
      else if (plan.deliverySeriesIndex === plan.deliverySeriesLength) position = 'bar-end';
      else                                                            position = 'bar-middle';
    }

    byDate[plan.deliveryDate].push({
      position, color, name,
      planId: plan.id, projectId: plan.projectId,
    });
  }
  return byDate;
}

/** カレンダーセル内のバーアイテム HTML を返す */
function renderBarItem({ position, color, name, planId, projectId }) {
  // bar-start / bar-single のみ名称表示・角丸。middle / end は詰めて連続感を出す
  const showName = position === 'bar-single' || position === 'bar-start';
  const radiusCls = {
    'bar-single': 'rounded',
    'bar-start':  'rounded-l',
    'bar-middle': 'rounded-none',
    'bar-end':    'rounded-r',
  }[position] || 'rounded';

  return `<div class="text-xs leading-tight px-1 py-0.5 mb-px ${radiusCls} truncate cursor-pointer hover:brightness-125"
     style="background-color:${color};color:#fff;"
     data-plan-id="${esc(planId)}" data-project-id="${esc(projectId)}">
    ${showName ? esc(name) : '&nbsp;'}
  </div>`;
}

// ══════════════════════════════════════════════════════════
// Screen management
// ══════════════════════════════════════════════════════════

// calendar は左右2ペイン（flex row）、A2 も flex。plan-form は block
const SCREEN_DISPLAY = { calendar: 'flex', 'plan-form': 'block', grid: 'flex' };

function showScreen(name) {
  adminState.adminScreen = name;
  for (const [key, display] of Object.entries(SCREEN_DISPLAY)) {
    const el = document.getElementById(`admin-screen-${key}`);
    if (el) el.style.display = key === name ? display : 'none';
  }
  const backBtn = document.getElementById('admin-back-btn');
  if (backBtn) backBtn.classList.toggle('hidden', name === 'calendar');
}

function updateHeaderInfo(html) {
  const infoEl = document.getElementById('admin-header-info');
  const sepEl  = document.getElementById('admin-header-sep');
  if (infoEl) infoEl.innerHTML = html;
  if (sepEl)  sepEl.classList.toggle('hidden', !html);
}

// ══════════════════════════════════════════════════════════
// A0: Calendar
// ══════════════════════════════════════════════════════════

async function loadAndRenderCalendar() {
  const { displayMonth } = adminState;
  const year     = displayMonth.getFullYear();
  const month    = displayMonth.getMonth();
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

  const gridEl = document.getElementById('admin-cal-grid');
  if (gridEl && !adminState.plansCache[monthKey]) {
    gridEl.innerHTML = '<div class="col-span-7 flex items-center justify-center gap-2 py-8 text-gray-500"><span class="admin-spinner"></span><span class="text-sm">読み込み中…</span></div>';
  }

  if (!adminState.plansCache[monthKey]) {
    adminState.plansCache[monthKey] = await getPlansForMonth(year, month);
  }
  renderCalendar();
}

function renderCalendar() {
  const { displayMonth, plansCache, selectedDate } = adminState;
  const boltProjects = adminState.a1.boltProjects;
  const year     = displayMonth.getFullYear();
  const month    = displayMonth.getMonth();
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const plans    = plansCache[monthKey] || [];
  const todayStr = toDateStr(new Date());

  const monthLabelEl = document.getElementById('admin-cal-month');
  if (monthLabelEl) monthLabelEl.textContent = `${year}年${month + 1}月`;

  const barsByDate = buildBarLayout(plans, boltProjects);

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const DAY_LABELS  = ['日', '月', '火', '水', '木', '金', '土'];

  let html = '<div class="grid grid-cols-7 gap-1">';
  DAY_LABELS.forEach((d, i) => {
    const c = i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-500';
    html += `<div class="text-center text-xs font-bold py-1 ${c}">${d}</div>`;
  });
  for (let i = 0; i < firstDay; i++) html += '<div class="min-h-[72px]"></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr  = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const bars     = barsByDate[dateStr] || [];
    const hasPlans = bars.length > 0;
    const dow      = (firstDay + d - 1) % 7;
    const isToday  = dateStr === todayStr;
    const isSel    = dateStr === selectedDate;

    let cellCls = 'min-h-[72px] p-1.5 rounded-lg border cursor-pointer transition-colors ';
    if (isToday)       cellCls += 'border-blue-500 bg-blue-900/25 ';
    else if (isSel)    cellCls += 'border-yellow-400 bg-yellow-900/20 ';
    else if (hasPlans) cellCls += 'border-gray-600 bg-gray-800/80 hover:bg-gray-700/50 ';
    else               cellCls += 'border-gray-700 bg-gray-800 hover:bg-gray-700/50 ';

    const numCls = dow === 0 ? 'text-red-400' : dow === 6 ? 'text-blue-400' : 'text-gray-300';
    const numEl  = isToday
      ? `<span class="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">${d}</span>`
      : `<span class="text-xs font-semibold ${numCls}">${d}</span>`;

    const barsHtml = bars.map(bar => renderBarItem(bar)).join('');

    html += `
      <div class="${cellCls}" data-cal-date="${dateStr}">
        <div class="flex">${numEl}</div>
        <div class="mt-0.5 overflow-hidden">${barsHtml}</div>
      </div>`;
  }
  html += '</div>';

  const gridEl = document.getElementById('admin-cal-grid');
  if (gridEl) gridEl.innerHTML = html;
}

function renderDateDetail(dateStr) {
  const detailEl = document.getElementById('admin-cal-detail');
  if (!detailEl) return;

  const { displayMonth, plansCache } = adminState;
  const boltProjects = adminState.a1.boltProjects;
  const year     = displayMonth.getFullYear();
  const month    = displayMonth.getMonth();
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const plans    = (plansCache[monthKey] || []).filter(p => p.deliveryDate === dateStr);

  const [, m, d] = dateStr.split('-');
  const label = `${parseInt(m)}月${parseInt(d)}日`;

  const planCards = plans.map(plan => {
    const proj = boltProjects.find(p => p.id === plan.projectId);
    const name = projDisplayName(proj) || '—';
    const meta = [
      plan.drawingNo  ? `計画図 ${plan.drawingNo}` : null,
      plan.truckCount ? `${plan.truckCount}台`      : null,
    ].filter(Boolean).join(' · ');

    return `
      <div class="flex items-center gap-3 p-3 rounded-lg bg-gray-800 border border-gray-700
                  hover:border-gray-500 cursor-pointer transition-colors"
           data-plan-id="${esc(plan.id)}" data-project-id="${esc(plan.projectId)}">
        <div class="flex-1 min-w-0">
          <div class="font-medium text-sm text-gray-100 truncate">${esc(name)}</div>
          ${meta ? `<div class="text-xs text-gray-400 mt-0.5">${esc(meta)}</div>` : ''}
        </div>
        <span class="text-gray-500">›</span>
      </div>`;
  }).join('');

  detailEl.innerHTML = `
    <div class="border-t border-gray-700 pt-4 mt-2">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold text-gray-300">${esc(label)} の搬入計画</h3>
        <button data-action="add-plan" data-date="${esc(dateStr)}"
          class="text-xs bg-blue-700 hover:bg-blue-600 text-white px-3 py-1.5 rounded font-medium">
          ＋ 搬入計画を登録
        </button>
      </div>
      ${plans.length
        ? `<div class="space-y-2">${planCards}</div>`
        : '<p class="text-sm text-gray-500">この日の搬入計画はありません</p>'
      }
    </div>`;
}

// ══════════════════════════════════════════════════════════
// A0: Calendar — Right Sidebar (Series Edit)
// ══════════════════════════════════════════════════════════

/** サイドバーを閉じ a0edit state をリセットする */
function closeA0EditSidebar() {
  adminState.a0edit = { projectId: null, plans: [], dateAssignMode: 'all_days' };
  document.getElementById('admin-cal-sidebar')?.classList.add('hidden');
}

/**
 * 現在のサイドバー編集対象の削除情報を返す
 * @returns {{ projectId, planId, deliverySeriesId, isSeries, seriesLength } | null}
 */
function getSidebarDeleteTarget() {
  const { plans, projectId } = adminState.a0edit;
  if (!plans.length || !projectId) return null;
  const first = plans[0];
  const hasSeries = !!first.deliverySeriesId;
  return {
    projectId,
    planId:           first.id,
    deliverySeriesId: first.deliverySeriesId || null,
    isSeries:         hasSeries && plans.length > 1,
    seriesLength:     plans.length,
  };
}

/** 削除ボタン押下 → 確認viewに切り替える */
function handleA0DeleteRequest() {
  adminState.a0edit.confirmDelete = true;
  renderA0ConfirmDelete();
}

/** サイドバーを削除確認viewに差し替える */
function renderA0ConfirmDelete() {
  const contentEl = document.getElementById('admin-cal-sidebar-content');
  if (!contentEl) return;

  const target = getSidebarDeleteTarget();
  if (!target) return;

  const { plans, projectId } = adminState.a0edit;
  const proj      = adminState.a1.boltProjects.find(p => p.id === projectId);
  const name      = projDisplayName(proj) || '—';
  const startDate = plans[0]?.deliveryDate || '—';
  const dayCount  = plans.length;

  const titleText = target.isSeries
    ? `連続搬入 ${dayCount}日間 を削除`
    : 'この搬入予定を削除';

  const warnText = target.isSeries
    ? 'この連続搬入に紐づく号車・品目データも一緒に削除されます。'
    : 'この搬入予定に紐づく号車・品目データも一緒に削除されます。';

  contentEl.innerHTML = `
    <div>
      <div class="text-sm font-semibold text-red-400 mb-3">${esc(titleText)}</div>
      <div class="text-xs text-gray-400 space-y-1.5 mb-4">
        <div>工事: <span class="text-gray-200">${esc(name)}</span></div>
        <div>搬入開始日: <span class="text-gray-200">${esc(startDate)}</span></div>
        <div>対象日数: <span class="text-gray-200">${dayCount}日</span></div>
      </div>

      <div class="bg-red-950/40 border border-red-900/60 rounded p-3 text-xs text-red-300 leading-relaxed mb-4">
        ⚠️ 削除すると元に戻せません。<br>
        ${esc(warnText)}
      </div>

      <div class="flex gap-2">
        <button id="a0-delete-confirm-btn"
          class="flex-1 bg-red-700 hover:bg-red-600 text-white py-2 rounded text-sm font-medium">
          削除する
        </button>
        <button id="a0-delete-cancel-btn"
          class="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded text-sm">
          キャンセル
        </button>
      </div>
    </div>`;
}

/** 削除確認後の実行処理 */
async function handleA0DeleteConfirm() {
  const target = getSidebarDeleteTarget();
  if (!target) return;

  const confirmBtn = document.getElementById('a0-delete-confirm-btn');
  if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.innerHTML = '<span class="admin-spinner"></span> 削除中'; }

  // 影響月を先に記録（close 後はアクセスできなくなるため）
  const affectedMonths = new Set();
  adminState.a0edit.plans.forEach(p => {
    if (p.deliveryDate) {
      const [y, mo] = p.deliveryDate.split('-');
      affectedMonths.add(`${y}-${mo}`);
    }
  });

  try {
    if (target.isSeries) {
      await deletePlansBySeriesId(target.projectId, target.deliverySeriesId);
    } else {
      await deletePlanCascade(target.projectId, target.planId);
    }
  } catch (err) {
    console.error('[A0 delete] failed', err);
    alert('削除に失敗しました');
    if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = '削除する'; }
    return;
  }

  for (const key of affectedMonths) delete adminState.plansCache[key];
  adminState.selectedDate = null;  // 削除後は日付選択をリセット
  closeA0EditSidebar();
  await loadAndRenderCalendar();

  // 軽い完了通知（2.5秒で自動消去）
  updateHeaderInfo('<span class="text-green-400 text-xs font-normal">削除しました</span>');
  setTimeout(() => updateHeaderInfo(''), 2500);
}

/**
 * a0edit.plans の rowIndex 行の日付を newDate に設定し、後続行を再計算する
 * rowIndex 行自身の DOM は呼び出し元が担当（ユーザー入力 or 全更新）
 */
function reflowA0DatesFromRow(rowIndex, newDate) {
  const { plans, dateAssignMode } = adminState.a0edit;
  plans[rowIndex].deliveryDate = newDate;

  let prev = newDate;
  for (let i = rowIndex + 1; i < plans.length; i++) {
    const next = getNextDateByMode(prev, dateAssignMode);
    plans[i].deliveryDate = next;
    prev = next;
  }

  // 後続行の date input だけ surgical update（focus を保持）
  for (let i = rowIndex + 1; i < plans.length; i++) {
    const el = document.querySelector(`.a0-edit-date[data-row-index="${i}"]`);
    if (el) el.value = plans[i].deliveryDate;
  }
}

/** シリーズ全体の日付を1スロット前後にずらす */
function shiftA0SeriesDates(direction) {
  const { plans, dateAssignMode } = adminState.a0edit;
  if (!plans.length) return;

  const newFirst = direction > 0
    ? getNextDateByMode(plans[0].deliveryDate, dateAssignMode)
    : getPrevDateByMode(plans[0].deliveryDate, dateAssignMode);

  // 全行を state 更新
  plans[0].deliveryDate = newFirst;
  let prev = newFirst;
  for (let i = 1; i < plans.length; i++) {
    const next = getNextDateByMode(prev, dateAssignMode);
    plans[i].deliveryDate = next;
    prev = next;
  }

  // 全行の DOM を一括更新
  for (let i = 0; i < plans.length; i++) {
    const el = document.querySelector(`.a0-edit-date[data-row-index="${i}"]`);
    if (el) el.value = plans[i].deliveryDate;
  }
}

/** サイドバーの innerHTML を現在の a0edit state から再描画する */
function renderA0EditSidebar() {
  const contentEl = document.getElementById('admin-cal-sidebar-content');
  if (!contentEl) return;

  const { plans, projectId, dateAssignMode } = adminState.a0edit;
  const proj   = adminState.a1.boltProjects.find(p => p.id === projectId);
  const name   = projDisplayName(proj) || '—';
  const inp    = 'bg-gray-700 text-gray-100 rounded px-2 py-1 text-xs w-full';
  const target = getSidebarDeleteTarget();

  const modeOptions = [
    ['all_days',         '連続（土日含む）'],
    ['weekday_only',     '平日のみ'],
    ['all_days_holiday', '平日＋土（日曜除く）'],
  ];

  const rowsHtml = plans.map((plan, i) => `
    <tr data-row-index="${i}" class="border-t border-gray-700">
      <td class="px-2 py-1.5 text-xs text-gray-400 text-center whitespace-nowrap select-none">
        搬入${plan.dayIndex}日目
      </td>
      <td class="px-2 py-1.5">
        <input type="date" class="a0-edit-date ${inp}"
          data-row-index="${i}" value="${esc(plan.deliveryDate)}">
      </td>
      <td class="px-2 py-1.5">
        <input type="text" class="a0-edit-drawing-no ${inp}"
          data-row-index="${i}" value="${esc(plan.drawingNo || '')}" placeholder="1">
      </td>
    </tr>`).join('');

  const seriesLabel = plans.length > 1 ? `${plans.length}日間シリーズ` : '単体';
  const startDate   = plans[0]?.deliveryDate || '—';
  // 開発用: シリーズIDを小さく表示（あれば）
  const seriesId    = plans[0]?.deliverySeriesId || null;
  const deleteLabel = target?.isSeries ? 'この連続搬入を削除…' : 'この搬入予定を削除…';

  contentEl.innerHTML = `
    <div>
      <div class="text-sm font-medium text-gray-200 truncate">${esc(name)}</div>
      <div class="text-xs text-gray-500 mt-0.5 space-y-0.5">
        <div>${seriesLabel}</div>
        <div>搬入開始日: ${esc(startDate)}</div>
        ${seriesId ? `<div class="truncate text-gray-600">ID: ${esc(seriesId)}</div>` : ''}
      </div>
    </div>

    <div>
      <label class="text-xs text-gray-400 block mb-1">日付割当モード（シフト・再計算に使用）</label>
      <select id="a0-date-assign-mode"
        class="w-full bg-gray-700 text-gray-100 rounded px-2 py-1.5 text-sm">
        ${modeOptions.map(([val, label]) =>
          `<option value="${val}"${dateAssignMode === val ? ' selected' : ''}>${label}</option>`
        ).join('')}
      </select>
    </div>

    <div class="flex gap-2">
      <button id="a0-shift-backward-btn"
        class="flex-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 py-1.5 rounded">
        ← 1日前へ
      </button>
      <button id="a0-shift-forward-btn"
        class="flex-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 py-1.5 rounded">
        1日後ろへ →
      </button>
    </div>

    <div class="bg-gray-900 border border-gray-700 rounded overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-xs text-gray-500">
            <th class="px-2 py-1 text-center w-20">搬入日目</th>
            <th class="px-2 py-1 text-left">日付</th>
            <th class="px-2 py-1 text-left">計画図番</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>

    <div class="flex gap-2 pt-1">
      <button id="a0-edit-save-btn"
        class="flex-1 bg-blue-700 hover:bg-blue-600 text-white py-2 rounded text-sm font-medium">
        保存
      </button>
      <button id="a0-edit-cancel-btn"
        class="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded text-sm">
        キャンセル
      </button>
    </div>

    <div class="border-t border-gray-700 pt-3">
      <button id="a0-delete-btn"
        class="w-full text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20
               border border-red-900/50 hover:border-red-700 py-1.5 rounded transition-colors">
        ${esc(deleteLabel)}
      </button>
    </div>`;
}

/**
 * バークリック時にサイドバーを開く
 * planId が属するシリーズを plansCache から取得して a0edit state に格納する
 */
function openA0EditSidebar(planId, projectId) {
  const { displayMonth, plansCache } = adminState;
  const year     = displayMonth.getFullYear();
  const month    = displayMonth.getMonth();
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const allPlans = plansCache[monthKey] || [];

  const clicked = allPlans.find(p => p.id === planId);
  if (!clicked) return;

  let series;
  if (clicked.deliverySeriesId) {
    series = allPlans
      .filter(p => p.deliverySeriesId === clicked.deliverySeriesId && p.projectId === projectId)
      .sort((a, b) => (a.deliverySeriesIndex || 0) - (b.deliverySeriesIndex || 0));
  } else {
    series = [clicked];
  }

  adminState.a0edit = {
    projectId,
    plans:          series.map(p => ({ ...p })),  // shallow copy（元データを直接変更しない）
    dateAssignMode: series[0]?.dateAssignMode || 'all_days',
  };

  document.getElementById('admin-cal-sidebar')?.classList.remove('hidden');
  renderA0EditSidebar();
}

/** サイドバーの保存処理 — planId を維持したまま updatePlan を順次実行 */
async function handleA0EditSave() {
  const { plans, projectId } = adminState.a0edit;
  const saveBtn = document.getElementById('a0-edit-save-btn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<span class="admin-spinner"></span> 保存中'; }

  const affectedMonths = new Set();
  try {
    for (const plan of plans) {
      await updatePlan(projectId, plan.id, {
        deliveryDate:         plan.deliveryDate,
        drawingNo:            plan.drawingNo || null,
        dayIndex:             plan.dayIndex,
        deliverySeriesIndex:  plan.deliverySeriesIndex,
        deliverySeriesLength: plan.deliverySeriesLength,
      });
      const [y, mo] = plan.deliveryDate.split('-');
      affectedMonths.add(`${y}-${mo}`);
    }
  } catch (err) {
    console.error('[A0 edit] save failed', err);
    alert('保存に失敗しました');
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '保存'; }
    return;
  }

  for (const key of affectedMonths) delete adminState.plansCache[key];
  const prevSelectedDate = adminState.selectedDate;
  closeA0EditSidebar();
  await loadAndRenderCalendar();
  if (prevSelectedDate) renderDateDetail(prevSelectedDate);
}

/** サイドバーのイベントを委譲バインド（一度だけ呼ぶ） */
function bindA0SidebarEvents() {
  const sidebar = document.getElementById('admin-cal-sidebar');
  if (!sidebar) return;

  sidebar.addEventListener('click', async e => {
    if (e.target.id === 'a0-sidebar-close-btn' || e.target.id === 'a0-edit-cancel-btn') {
      closeA0EditSidebar();
      return;
    }
    if (e.target.id === 'a0-edit-save-btn') {
      await handleA0EditSave();
      return;
    }
    if (e.target.id === 'a0-shift-forward-btn') {
      shiftA0SeriesDates(1);
      return;
    }
    if (e.target.id === 'a0-shift-backward-btn') {
      shiftA0SeriesDates(-1);
      return;
    }
    if (e.target.id === 'a0-delete-btn') {
      handleA0DeleteRequest();
      return;
    }
    if (e.target.id === 'a0-delete-confirm-btn') {
      await handleA0DeleteConfirm();
      return;
    }
    if (e.target.id === 'a0-delete-cancel-btn') {
      adminState.a0edit.confirmDelete = false;
      renderA0EditSidebar();
      return;
    }
  });

  sidebar.addEventListener('change', e => {
    if (e.target.id === 'a0-date-assign-mode') {
      adminState.a0edit.dateAssignMode = e.target.value;
      return;
    }
    if (e.target.matches('.a0-edit-date')) {
      const rowIndex = parseInt(e.target.dataset.rowIndex);
      if (e.target.value) reflowA0DatesFromRow(rowIndex, e.target.value);
    }
  });

  sidebar.addEventListener('input', e => {
    if (e.target.matches('.a0-edit-drawing-no')) {
      const rowIndex = parseInt(e.target.dataset.rowIndex);
      if (adminState.a0edit.plans[rowIndex]) {
        adminState.a0edit.plans[rowIndex].drawingNo = e.target.value;
      }
    }
  });
}

// ══════════════════════════════════════════════════════════
// A1: Plan Form — state.a1 ベース
//
// dateAssignMode enum:
//   'all_days'         … 連続（土日含む全日）
//   'weekday_only'     … 平日のみ（土日スキップ）
//   'all_days_holiday' … 平日+土日+祝日（将来の祝日対応用。現状は all_days と同じ）
//
// drawingAssignMode enum:
//   'serial' … 連番（1, 2, 3…）。将来拡張予定。
// ══════════════════════════════════════════════════════════

// ── state 更新 ─────────────────────────────────────────────

function updateA1FormField(field, value) {
  if (!adminState.a1?.form) return;
  adminState.a1.form[field] = value;
}

function updateA1PreviewCell(rowIndex, field, value) {
  if (!adminState.a1?.previewRows?.[rowIndex]) return;
  adminState.a1.previewRows[rowIndex][field] = value;
}

// ── 再計算ロジック ─────────────────────────────────────────

/**
 * dateStr の翌日から dateAssignMode に従った次の有効日を返す
 * T00:00:00 付与でタイムゾーンによるズレを防ぐ
 * @param {string} dateStr 'YYYY-MM-DD'
 * @param {'all_days'|'weekday_only'|'all_days_holiday'} mode
 * @returns {string} 翌有効日 'YYYY-MM-DD'
 */
function getNextDateByMode(dateStr, mode) {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + 1);

  if (mode === 'weekday_only') {
    while (date.getDay() === 0 || date.getDay() === 6) {
      date.setDate(date.getDate() + 1);
    }
  } else if (mode === 'all_days_holiday') {
    // 日曜のみスキップ（土曜は搬入可）
    while (date.getDay() === 0) {
      date.setDate(date.getDate() + 1);
    }
  }

  return toDateStr(date);
}

/**
 * dateStr の前日から dateAssignMode に従った前の有効日を返す（シフト後退用）
 * @param {string} dateStr 'YYYY-MM-DD'
 * @param {'all_days'|'weekday_only'|'all_days_holiday'} mode
 * @returns {string} 前有効日 'YYYY-MM-DD'
 */
function getPrevDateByMode(dateStr, mode) {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() - 1);

  if (mode === 'weekday_only') {
    while (date.getDay() === 0 || date.getDay() === 6) {
      date.setDate(date.getDate() - 1);
    }
  } else if (mode === 'all_days_holiday') {
    while (date.getDay() === 0) {
      date.setDate(date.getDate() - 1);
    }
  }

  return toDateStr(date);
}

/**
 * 搬入日プレビュー行を全生成する
 * @param {{ startDate, deliveryDays, dateAssignMode, drawingAssignMode }} params
 * @returns {{ deliveryDay, deliveryDate, dayLabel, drawingNo }[]}
 */
function buildA1PreviewRows({ startDate, deliveryDays, dateAssignMode, drawingAssignMode }) {
  const rows = [];
  if (!startDate || deliveryDays < 1) return rows;

  // 開始日自体が無効な場合（例: weekday_only で土日）に最初の有効日まで進める
  const firstDay = new Date(`${startDate}T00:00:00`);
  if (dateAssignMode === 'weekday_only') {
    while (firstDay.getDay() === 0 || firstDay.getDay() === 6) {
      firstDay.setDate(firstDay.getDate() + 1);
    }
  } else if (dateAssignMode === 'all_days_holiday') {
    // 日曜のみスキップ
    while (firstDay.getDay() === 0) {
      firstDay.setDate(firstDay.getDate() + 1);
    }
  }

  let curDate = toDateStr(firstDay);

  for (let i = 0; i < deliveryDays; i++) {
    rows.push({
      deliveryDay:  i + 1,
      deliveryDate: curDate,
      drawingNo:    drawingAssignMode === 'serial' ? String(i + 1) : '',
    });
    curDate = getNextDateByMode(curDate, dateAssignMode);
  }
  return rows;
}

/**
 * 現在の form 状態から previewRows を全再生成して state に保存する
 */
function regenerateA1PreviewRows() {
  const { form } = adminState.a1;
  adminState.a1.previewRows = buildA1PreviewRows({
    startDate:         form.startDate,
    deliveryDays:      form.deliveryDays,
    dateAssignMode:    form.dateAssignMode,
    drawingAssignMode: form.drawingAssignMode,
  });
}

/**
 * rowIndex 行の日付を newDate に設定し、後続行のみ再計算する
 * drawingNo には触れない
 * @param {number} rowIndex - 0ベースのインデックス
 * @param {string} newDate  - 変更後の日付 'YYYY-MM-DD'
 */
function reflowA1DatesFromRow(rowIndex, newDate) {
  const { dateAssignMode } = adminState.a1.form;

  updateA1PreviewCell(rowIndex, 'deliveryDate', newDate);

  let prevDate = newDate;
  for (let i = rowIndex + 1; i < adminState.a1.previewRows.length; i++) {
    const nextDate = getNextDateByMode(prevDate, dateAssignMode);
    updateA1PreviewCell(i, 'deliveryDate', nextDate);
    prevDate = nextDate;
  }

  // 後続行の日付 input だけ surgical update（focus を失わない）
  for (let i = rowIndex + 1; i < adminState.a1.previewRows.length; i++) {
    const el = document.querySelector(`.a1-preview-date[data-row-index="${i}"]`);
    if (el) el.value = adminState.a1.previewRows[i].deliveryDate;
  }
}

/**
 * drawingAssignMode に従い drawingNo を更新する
 * state と DOM の両方を surgical update する（現在は 'serial' のみ実装）
 */
function applyDrawingAssignMode() {
  const { drawingAssignMode } = adminState.a1.form;
  if (drawingAssignMode !== 'serial') return;

  adminState.a1.previewRows.forEach((row, i) => {
    row.drawingNo = String(i + 1);
    const el = document.querySelector(`.a1-preview-drawing-no[data-row-index="${i}"]`);
    if (el) el.value = row.drawingNo;
  });
}

// ── イベントハンドラ ──────────────────────────────────────

function handleA1DeliveryDaysChange(value) {
  updateA1FormField('deliveryDays', Math.max(1, Math.min(30, parseInt(value) || 1)));
  regenerateA1PreviewRows();
  // プレビューのみ更新（ヘッダ入力のフォーカスを保持する）
  const preview = document.getElementById('pf-preview');
  if (preview) preview.innerHTML = buildPreviewTableHTML();
}

function handleA1DateAssignModeChange(value) {
  updateA1FormField('dateAssignMode', value);
  regenerateA1PreviewRows();
  const preview = document.getElementById('pf-preview');
  if (preview) preview.innerHTML = buildPreviewTableHTML();
}

function handleA1DrawingAssignModeChange(value) {
  // 日付は再計算せず drawingNo だけ更新する（手修正した日付を保持）
  updateA1FormField('drawingAssignMode', value);
  applyDrawingAssignMode();
}

function handleA1PreviewDateChange(rowIndex, value) {
  if (!value) return;
  reflowA1DatesFromRow(rowIndex, value);
}

function handleA1PreviewDrawingNoChange(rowIndex, value) {
  updateA1PreviewCell(rowIndex, 'drawingNo', value);
}

// ── 描画 ─────────────────────────────────────────────────

/**
 * 工事選択コンボの <option> HTML を返す
 * id / projectId 両フィールドに対応（bolt プロジェクトのフィールド差異を吸収）
 */
function renderBoltProjectOptions() {
  const { boltProjects, form } = adminState.a1;
  const selectedId = String(form.projectId ?? '');

  return (boltProjects || []).map(p => {
    const id   = String(p.id || p.projectId || '');
    const name = projDisplayName(p) || id;
    return `<option value="${esc(id)}"${id === selectedId ? ' selected' : ''}>${esc(name)}</option>`;
  }).join('');
}

/**
 * A1 上部（工事選択・開始日・日数・モード）の HTML を返す
 */
function renderA1HeaderSection() {
  const { form } = adminState.a1;
  const inp       = 'w-full bg-gray-700 text-gray-100 rounded px-3 py-2 text-sm';
  const radioBase = 'accent-blue-500';
  const isNewProj = form.projectId === '__new__';

  const [, m, d]   = form.startDate.split('-');
  const startLabel = `${parseInt(m)}月${parseInt(d)}日`;

  const dayModes = [
    ['all_days',         '通常モード（連続）'],
    ['weekday_only',     '平日のみモード'],
    ['all_days_holiday', '平日+土日+祝日モード'],
  ];

  return `
    <div>
      <label class="text-xs text-gray-400 block mb-1">工事 <span class="text-red-400">*</span></label>
      <select id="a1-project-id" class="${inp}">
        <option value="">— 工事を選択 —</option>
        ${renderBoltProjectOptions()}
        <option value="__new__"${'__new__' === form.projectId ? ' selected' : ''}>＋ 新規工事を作成…</option>
      </select>
    </div>

    <div id="pf-new-project-area" class="${isNewProj ? '' : 'hidden'} space-y-2 pl-2 border-l-2 border-blue-700">
      <label class="text-xs text-gray-400 block mb-1">新規工事名 <span class="text-red-400">*</span></label>
      <input id="pf-new-project-name" type="text" value="${esc(form.newProjectName)}"
        class="${inp}" placeholder="例: ○○ビル新築工事">
    </div>

    <div>
      <label class="text-xs text-gray-400 block mb-1">搬入開始日</label>
      <div class="px-3 py-2 text-sm text-gray-300 bg-gray-800 rounded border border-gray-700 select-none">
        ${esc(startLabel)}
      </div>
    </div>

    <div class="flex gap-4 items-start">
      <div class="w-24 flex-shrink-0">
        <label class="text-xs text-gray-400 block mb-1">搬入日数 <span class="text-red-400">*</span></label>
        <input id="a1-delivery-days" type="number" min="1" max="30"
          value="${form.deliveryDays}" class="${inp}">
      </div>
      <div class="flex-1">
        <label class="text-xs text-gray-400 block mb-1">日付割当モード</label>
        <div class="flex flex-col gap-1.5 py-1">
          ${dayModes.map(([val, label]) => `
            <label class="flex items-center gap-1.5 text-sm text-gray-300 cursor-pointer">
              <input type="radio" name="a1-date-assign-mode" value="${val}"
                ${form.dateAssignMode === val ? 'checked' : ''} class="${radioBase}">
              ${label}
            </label>`).join('')}
        </div>
      </div>
      <div class="flex-1">
        <label class="text-xs text-gray-400 block mb-1">計画図番割当</label>
        <div class="flex flex-col gap-1.5 py-1">
          <label class="flex items-center gap-1.5 text-sm text-gray-300 cursor-pointer">
            <input type="radio" name="a1-drawing-assign-mode" value="serial"
              ${form.drawingAssignMode === 'serial' ? 'checked' : ''} class="${radioBase}">
            連番モード
          </label>
        </div>
      </div>
    </div>`;
}

/**
 * previewRows の <tr> 列 HTML を返す
 */
function renderA1PreviewRows() {
  const { previewRows } = adminState.a1;
  const inp = 'bg-gray-700 text-gray-100 rounded px-2 py-1 text-xs w-full';

  return previewRows.map(({ deliveryDay, deliveryDate, drawingNo }, i) => `
    <tr data-row-index="${i}" class="border-t border-gray-700">
      <td class="px-2 py-1.5 text-xs text-gray-400 text-center whitespace-nowrap select-none">
        搬入${deliveryDay}日目
      </td>
      <td class="px-2 py-1.5">
        <input type="date" class="a1-preview-date ${inp}"
          data-row-index="${i}" value="${esc(deliveryDate)}">
      </td>
      <td class="px-2 py-1.5">
        <input type="text" class="a1-preview-drawing-no ${inp}"
          data-row-index="${i}" value="${esc(drawingNo)}" placeholder="1">
      </td>
    </tr>`).join('');
}

/** #pf-preview の innerHTML として使うテーブル HTML（private helper）*/
function buildPreviewTableHTML() {
  const { previewRows } = adminState.a1;
  if (!previewRows.length) return '<p class="text-xs text-gray-500 p-3">（日付なし）</p>';
  return `
    <table class="w-full text-sm">
      <thead>
        <tr class="text-xs text-gray-500">
          <th class="px-2 py-1 text-center w-24">搬入日目</th>
          <th class="px-2 py-1 text-left">日付</th>
          <th class="px-2 py-1 text-left">計画図番</th>
        </tr>
      </thead>
      <tbody>${renderA1PreviewRows()}</tbody>
    </table>`;
}

/**
 * 搬入日プレビューセクション（ラベル + #pf-preview ラッパー）の HTML を返す
 */
function renderA1PreviewSection() {
  return `
    <div>
      <label class="text-xs text-gray-400 block mb-2">搬入日プレビュー</label>
      <div id="pf-preview" class="bg-gray-800 border border-gray-700 rounded overflow-x-auto">
        ${buildPreviewTableHTML()}
      </div>
    </div>`;
}

/**
 * A1 フォーム全体を描画する（state.a1 の値を初期値として使用）
 */
function renderPlanForm() {
  const el = document.getElementById('admin-plan-form-content');
  if (!el) return;

  el.innerHTML = `
    <h2 class="text-lg font-semibold text-gray-100 mb-6">搬入計画 登録</h2>
    <div class="space-y-4">
      ${renderA1HeaderSection()}
      ${renderA1PreviewSection()}
      <div class="flex gap-3 pt-2">
        <button id="a1-save-btn"
          class="flex-1 bg-blue-700 hover:bg-blue-600 text-white py-2 rounded text-sm font-medium">
          登録
        </button>
        <button id="a1-back-btn" type="button"
          class="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded text-sm">
          戻る
        </button>
      </div>
    </div>`;

  bindPlanFormEvents();
}

// ── イベントバインド ──────────────────────────────────────

// el への委譲で一度だけバインドする（re-render 後も動作する）
let _planFormEventsBound = false;

/** ヘッダ部（工事・日数・モード）のイベントを el に委譲してバインドする */
function bindA1HeaderEvents(el) {
  el.addEventListener('change', e => {
    if (e.target.id === 'a1-project-id') {
      updateA1FormField('projectId', e.target.value);
      document.getElementById('pf-new-project-area')
        ?.classList.toggle('hidden', e.target.value !== '__new__');
      return;
    }
    if (e.target.matches('input[name="a1-date-assign-mode"]')) {
      handleA1DateAssignModeChange(e.target.value);
      return;
    }
    if (e.target.matches('input[name="a1-drawing-assign-mode"]')) {
      handleA1DrawingAssignModeChange(e.target.value);
    }
  });

  el.addEventListener('input', e => {
    if (e.target.id === 'a1-delivery-days') {
      handleA1DeliveryDaysChange(e.target.value);
      return;
    }
    if (e.target.id === 'pf-new-project-name') {
      updateA1FormField('newProjectName', e.target.value);
    }
  });

  el.addEventListener('click', e => {
    if (e.target.id === 'a1-save-btn')  handlePlanFormSave();
    if (e.target.id === 'a1-back-btn')  goToCalendar();
  });
}

/** プレビュー行（日付・日名称・計画図番）のイベントを el に委譲してバインドする */
function bindA1PreviewEvents(el) {
  el.addEventListener('change', e => {
    if (e.target.matches('.a1-preview-date')) {
      const rowIndex = parseInt(e.target.dataset.rowIndex);
      handleA1PreviewDateChange(rowIndex, e.target.value);
    }
  });

  el.addEventListener('input', e => {
    if (e.target.matches('.a1-preview-drawing-no')) {
      handleA1PreviewDrawingNoChange(parseInt(e.target.dataset.rowIndex), e.target.value);
    }
  });
}

function bindPlanFormEvents() {
  const el = document.getElementById('admin-plan-form-content');
  if (!el || _planFormEventsBound) return;
  _planFormEventsBound = true;
  bindA1HeaderEvents(el);
  bindA1PreviewEvents(el);
}

// ── 保存 ─────────────────────────────────────────────────

/**
 * previewRow を createPlan に渡す planData に変換する
 * Firestore 構造は変えない（dayIndex / status: 'active' を維持）
 */
function previewRowToPlanData(row) {
  return {
    deliveryDate: row.deliveryDate,
    dayIndex:     row.deliveryDay,   // Firestore フィールド名は dayIndex
    drawingNo:    row.drawingNo || null,
    status:       'active',          // Firestore の既存値に合わせる
    truckCount:   0,
  };
}

async function handlePlanFormSave() {
  const { form, previewRows } = adminState.a1;

  if (!form.projectId) {
    document.getElementById('a1-project-id')?.classList.add('ring-1', 'ring-red-500');
    return;
  }

  let projectId = form.projectId;

  if (form.projectId === '__new__') {
    if (!form.newProjectName.trim()) {
      document.getElementById('pf-new-project-name')?.classList.add('ring-1', 'ring-red-500');
      return;
    }
    const created = await createProject({ projectName: form.newProjectName.trim(), isActive: true });
    adminState.a1.boltProjects.push(created);
    projectId = created.id;
  }

  if (!previewRows?.length) {
    alert('搬入日が1件もありません');
    return;
  }

  const saveBtn = document.getElementById('a1-save-btn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<span class="admin-spinner"></span> 登録中'; }

  const affectedMonths = new Set();

  // シリーズID生成（同一 A1 登録の計画群をグループ化）
  const seriesId    = `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const validRows   = previewRows.filter(row => row.deliveryDate);
  const seriesLength = validRows.length;

  try {
    for (let idx = 0; idx < validRows.length; idx++) {
      const row = validRows[idx];
      await createPlan(projectId, {
        ...previewRowToPlanData(row),
        deliverySeriesId:     seriesId,
        deliverySeriesIndex:  idx + 1,
        deliverySeriesLength: seriesLength,
        dateAssignMode:       form.dateAssignMode,
      });
      const [y, mo] = row.deliveryDate.split('-');
      affectedMonths.add(`${y}-${mo}`);
    }
  } catch (err) {
    console.error('[A1] save failed', err);
    alert('登録に失敗しました');
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '登録'; }
    return;
  }

  for (const key of affectedMonths) delete adminState.plansCache[key];
  await goToCalendar();
}

// ── 入口 ─────────────────────────────────────────────────

/**
 * bolt 工事一覧を a1.boltProjects にロードする
 * initializeA1State が boltProjects をリセットするため毎回取得する
 */
async function loadA1BoltProjects() {
  try {
    const projects = await getBoltProjects();
    adminState.a1.boltProjects = Array.isArray(projects) ? projects : [];
  } catch (err) {
    console.error('[A1] Failed to load bolt projects', err);
    adminState.a1.boltProjects = [];
  }
}

/**
 * A1 表示前に state.a1 を全体リセットする（showPlanForm から毎回呼ぶ）
 * @param {string} startDate 'YYYY-MM-DD'
 */
function initializeA1State(startDate) {
  adminState.a1 = {
    boltProjects: [],   // loadA1BoltProjects で上書きされる
    form: {
      projectId:         '',
      newProjectName:    '',
      startDate,         // カレンダー選択日で固定
      deliveryDays:      1,
      dateAssignMode:    'all_days',
      drawingAssignMode: 'serial',
    },
    previewRows: buildA1PreviewRows({
      startDate,
      deliveryDays:      1,
      dateAssignMode:    'all_days',
      drawingAssignMode: 'serial',
    }),
  };
}

async function showPlanForm(dateStr) {
  if (dateStr) adminState.selectedDate = dateStr;
  const startDate = adminState.selectedDate || toDateStr(new Date());

  initializeA1State(startDate);          // state リセット
  await loadA1BoltProjects();            // 工事候補ロード
  updateHeaderInfo('<span class="text-gray-400">搬入計画 登録</span>');
  renderPlanForm();                      // 描画
  showScreen('plan-form');              // 画面切替
}

// ══════════════════════════════════════════════════════════
// A2: Grid
// ══════════════════════════════════════════════════════════

async function enterGrid(projectId, planId) {
  const proj = adminState.a1.boltProjects.find(p => p.id === projectId);
  const projName = projDisplayName(proj) || '—';

  // plansCache から currentPlan を検索
  let currentPlan = null;
  for (const plans of Object.values(adminState.plansCache)) {
    currentPlan = plans.find(p => p.id === planId);
    if (currentPlan) break;
  }

  // 同一 deliverySeriesId の計画を全 cache から収集（deliverySeriesIndex 昇順）
  let seriesPlans = [];
  if (currentPlan?.deliverySeriesId) {
    const sid = currentPlan.deliverySeriesId;
    for (const plans of Object.values(adminState.plansCache)) {
      seriesPlans.push(...plans.filter(p => p.deliverySeriesId === sid));
    }
    // 重複除去（同月で複数ページになっても安全）
    const seen = new Set();
    seriesPlans = seriesPlans.filter(p => seen.has(p.id) ? false : (seen.add(p.id), true));
    seriesPlans.sort((a, b) => (a.deliverySeriesIndex ?? 0) - (b.deliverySeriesIndex ?? 0));

    // キャッシュ不足時は Firestore から補完（月跨ぎシリーズ対応）
    const expectedLen = currentPlan.deliverySeriesLength ?? 2;
    if (seriesPlans.length < expectedLen) {
      try {
        const fetched = await getPlansBySeriesId(projectId, sid);
        const seenIds = new Set(seriesPlans.map(p => p.id));
        for (const p of fetched) {
          if (!seenIds.has(p.id)) seriesPlans.push(p);
        }
        seriesPlans.sort((a, b) => (a.deliverySeriesIndex ?? 0) - (b.deliverySeriesIndex ?? 0));
      } catch (e) {
        console.warn('[enterGrid] シリーズ計画補完取得失敗', e);
      }
    }
  }

  adminState.a2 = { currentPlan, seriesPlans };

  // ヘッダー: 工事名 / 搬入〇日目 / 計画図番〇
  const headerParts = [
    `<span class="text-gray-300 truncate max-w-[160px]">${esc(projName)}</span>`,
  ];
  if (currentPlan?.dayIndex != null) {
    headerParts.push(`<span class="text-gray-400 text-xs shrink-0">搬入${esc(String(currentPlan.dayIndex))}日目</span>`);
  }
  if (currentPlan?.drawingNo) {
    headerParts.push(`<span class="text-gray-500 text-xs shrink-0">計画図番 ${esc(currentPlan.drawingNo)}</span>`);
  }
  const sep = '<span class="text-gray-600 mx-1 shrink-0">/</span>';

  showScreen('grid');
  updateHeaderInfo(headerParts.join(sep));
  await initGridScreen(projectId, planId);
}

// ══════════════════════════════════════════════════════════
// Navigation
// ══════════════════════════════════════════════════════════

async function goToCalendar() {
  showScreen('calendar');
  updateHeaderInfo('');
  await loadAndRenderCalendar();
  if (adminState.selectedDate) renderDateDetail(adminState.selectedDate);
}

// ══════════════════════════════════════════════════════════
// A0 Event Delegation
// ══════════════════════════════════════════════════════════

function bindCalendarEvents() {
  document.getElementById('admin-cal-prev').addEventListener('click', async () => {
    const d = adminState.displayMonth;
    adminState.displayMonth = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    document.getElementById('admin-cal-detail').innerHTML = '';
    adminState.selectedDate = null;
    await loadAndRenderCalendar();
  });

  document.getElementById('admin-cal-next').addEventListener('click', async () => {
    const d = adminState.displayMonth;
    adminState.displayMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    document.getElementById('admin-cal-detail').innerHTML = '';
    adminState.selectedDate = null;
    await loadAndRenderCalendar();
  });

  document.getElementById('admin-cal-grid').addEventListener('click', e => {
    // バーアイテムのクリック → サイドバー編集を優先
    const bar = e.target.closest('[data-plan-id]');
    if (bar) {
      openA0EditSidebar(bar.dataset.planId, bar.dataset.projectId);
      // 工事バーの搬入日に下部パネルを切り替える
      const firstDate = adminState.a0edit.plans[0]?.deliveryDate;
      if (firstDate && firstDate !== adminState.selectedDate) {
        adminState.selectedDate = firstDate;
        renderCalendar();
        renderDateDetail(firstDate);
      }
      return;
    }
    // セル背景クリック → 日付選択
    const cell = e.target.closest('[data-cal-date]');
    if (!cell) return;
    adminState.selectedDate = cell.dataset.calDate;
    renderCalendar();
    renderDateDetail(adminState.selectedDate);
  });

  document.getElementById('admin-cal-detail').addEventListener('click', async e => {
    const addBtn = e.target.closest('[data-action="add-plan"]');
    if (addBtn) { showPlanForm(addBtn.dataset.date); return; }

    const card = e.target.closest('[data-plan-id]');
    if (card) await enterGrid(card.dataset.projectId, card.dataset.planId);
  });

  document.getElementById('admin-back-btn').addEventListener('click', goToCalendar);

  // A2 日切替コールバック（ui.js の日切替ボタンから呼ばれる）
  adminState._onSwitchA2Plan = async (projId, pId) => {
    await enterGrid(projId, pId);
  };

  bindA0SidebarEvents();
}

// ══════════════════════════════════════════════════════════
// Init
// ══════════════════════════════════════════════════════════

// ── sessionStorage キャッシュ helpers ──────────────────────
const CACHE_KEY_PROJECTS = 'adminBoltProjectsCache';
const CACHE_KEY_PLANS    = 'adminPlansCacheData';

function saveAdminCache() {
  try {
    sessionStorage.setItem(CACHE_KEY_PROJECTS, JSON.stringify(adminState.a1.boltProjects));
    sessionStorage.setItem(CACHE_KEY_PLANS,    JSON.stringify(adminState.plansCache));
  } catch (_) {}
}

function restoreAdminCache() {
  try {
    const cp = sessionStorage.getItem(CACHE_KEY_PROJECTS);
    const cc = sessionStorage.getItem(CACHE_KEY_PLANS);
    if (cp) adminState.a1.boltProjects = JSON.parse(cp);
    if (cc) adminState.plansCache       = JSON.parse(cc);
    return !!(cp && cc);
  } catch (_) { return false; }
}

export async function initAdminApp() {
  // A1 state の初期化（boltProjects は showPlanForm 時にロード）
  initializeA1State(toDateStr(new Date()));

  const hasCachedData = restoreAdminCache();

  bindCalendarEvents();
  await goToCalendar(); // キャッシュがあれば Firestore 不要で即座に描画

  if (hasCachedData) {
    // バックグラウンドで最新データを取得してキャッシュを更新
    (async () => {
      await loadA1BoltProjects();
      const d = adminState.displayMonth;
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      delete adminState.plansCache[monthKey]; // 今月は必ず再取得
      await loadAndRenderCalendar();
      saveAdminCache();
    })();
  } else {
    // 初回: 待機してからキャッシュ保存
    await loadA1BoltProjects();
    renderCalendar(); // 工事名を反映して再描画
    saveAdminCache();
  }
}
