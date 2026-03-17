// 搬入リスト管理 - UI / イベント / 初期化
// ボルト計算アプリの state.projects を読み取り専用で参照する以外は独立

import { deliveryState } from './delivery-state.js';
import {
  getDeliveryProjects,
  getPlansForMonth,
  getTrucksForPlan,
  getItemsForTruck,
  setItemChecked,
  updateTruckStatus,
} from './delivery-db.js';
import {
  resolveTruckProgress,
  formatDiffBadge,
  summarizeCalendarDay,
} from '../../packages/shared-domain/src/index.js';

// 号車詳細画面のコンテキスト（再描画時に参照）
let _truckProjectId = null;
let _truckPlanId    = null;

// Date → 'YYYY-MM-DD' 文字列
function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const esc = s =>
  String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// ── 差分バッジ ────────────────────────────────────────────

const DIFF_COLORS = [
  'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300',
  'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  'bg-yellow-200 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-200',
  'bg-stone-100 text-stone-700 dark:bg-stone-700 dark:text-stone-200',
  'bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200',
];


// item.checked 集計から進捗を算出（shared-domain へ委譲）
const _computeProgress = resolveTruckProgress;

// HTML組み立ては delivery.js が担当、ラベル/色インデックス生成は shared-domain に委譲
function _diffBadges(diffs) {
  if (!diffs?.length) return '';
  return diffs.map(d => {
    const { label, colorIndex } = formatDiffBadge(d);
    return `<span class="text-xs px-1.5 py-0.5 rounded font-medium ${DIFF_COLORS[colorIndex]}">${esc(label)}</span>`;
  }).join('');
}

// ── アプリモード切替 ──────────────────────────────────────

export function switchAppMode(mode) {
  const calView    = document.getElementById('delivery-calendar-view');
  const detailView = document.getElementById('delivery-detail-view');
  const truckView  = document.getElementById('delivery-truck-detail-view');
  const boltList   = document.getElementById('project-list-view');
  const boltDetail = document.getElementById('project-detail-view');

  const navDelivery    = document.getElementById('nav-delivery-context');
  const navList        = document.getElementById('nav-list-context');
  const navDetail      = document.getElementById('nav-detail-context');
  const navDetailBtns  = document.getElementById('nav-detail-buttons');
  const masterFab      = document.getElementById('master-fab-container');

  // 全ビューを非表示
  [calView, detailView, truckView, boltList, boltDetail].forEach(el => {
    if (el) el.style.display = 'none';
  });

  // delivery 系共通: ボルト nav を隠す
  const isDelivery = mode.startsWith('delivery');
  if (navList)       navList.classList.toggle('hidden', isDelivery);
  if (navDetail)     navDetail.classList.toggle('hidden', true);
  if (navDetailBtns) { navDetailBtns.classList.add('hidden'); navDetailBtns.classList.remove('flex'); }
  if (masterFab)     masterFab.classList.toggle('hidden', isDelivery);
  if (navDelivery)   navDelivery.classList.toggle('hidden', !isDelivery);

  if (mode === 'delivery') {
    if (calView) calView.style.display = 'block';
    loadAndRenderCalendar();

  } else if (mode === 'delivery-detail') {
    if (detailView) detailView.style.display = 'block';
    loadAndRenderDateDetail(deliveryState.selectedDate);

  } else if (mode === 'delivery-truck-detail') {
    if (truckView) truckView.style.display = 'block';
    loadAndRenderTruckDetail(deliveryState.selectedProjectId, deliveryState.selectedPlanId, deliveryState.selectedTruckId);

  } else {
    // bolt モード
    if (boltList) boltList.style.display = 'block';
    if (navList)  navList.classList.remove('hidden');
  }
}

// ── カレンダー ────────────────────────────────────────────

async function loadAndRenderCalendar() {
  const { displayMonth } = deliveryState;
  const year  = displayMonth.getFullYear();
  const month = displayMonth.getMonth();
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

  const grid = document.getElementById('dl-calendar-grid');
  if (grid) grid.innerHTML = '<p class="text-center text-slate-400 py-8 col-span-7">読み込み中...</p>';

  if (!deliveryState.plansCache[monthKey]) {
    deliveryState.plansCache[monthKey] = await getPlansForMonth(year, month);
  }
  renderCalendar();
}

function renderCalendar() {
  const { displayMonth, plansCache, selectedDate } = deliveryState;
  const year  = displayMonth.getFullYear();
  const month = displayMonth.getMonth();
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const plans = plansCache[monthKey] || [];

  const label = document.getElementById('dl-month-label');
  if (label) label.textContent = `${year}年${month + 1}月`;

  // 日付ごとに工事名を集計
  const plansByDate = {};
  plans.forEach(plan => {
    const d = plan.deliveryDate;
    if (!d) return;
    if (!plansByDate[d]) plansByDate[d] = [];
    const proj = deliveryState.deliveryProjects.find(p => p.id === plan.projectId);
    plansByDate[d].push(proj?.name || proj?.projectName || '工事');
  });

  const now = new Date();
  const todayStr = toDateStr(now);

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const DAY_LABELS  = ['日', '月', '火', '水', '木', '金', '土'];

  let html = '<div class="grid grid-cols-7 gap-1">';

  // 曜日ヘッダー
  DAY_LABELS.forEach((d, i) => {
    const c = i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-600 dark:text-slate-400';
    html += `<div class="text-center text-xs font-bold py-1 ${c}">${d}</div>`;
  });

  // 月初め前の空セル
  for (let i = 0; i < firstDay; i++) {
    html += '<div class="min-h-[64px]"></div>';
  }

  // 日付セル
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr  = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const projects  = plansByDate[dateStr] || [];
    const hasPlans  = projects.length > 0;
    const dow       = (firstDay + d - 1) % 7;
    const isToday   = dateStr === todayStr;
    const isSel     = dateStr === selectedDate;

    // セルスタイル優先順位: 今日 > 選択中 > 差分あり > 搬入あり > 通常
    let cellCls = 'min-h-[64px] p-1 rounded-lg border cursor-pointer transition-colors ';
    if (isToday) {
      cellCls += 'border-blue-400 bg-blue-50 dark:bg-blue-900/30 ';
    } else if (isSel) {
      cellCls += 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 ';
    } else if (hasPlans) {
      cellCls += 'border-orange-200 bg-orange-50/40 dark:bg-orange-900/10 dark:border-orange-800/40 ';
    } else {
      cellCls += 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 ';
    }

    // 日付番号
    const numCls = dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-slate-700 dark:text-slate-200';
    const numEl  = isToday
      ? `<span class="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">${d}</span>`
      : `<span class="text-xs font-semibold ${numCls}">${d}</span>`;

    const projHtml = projects.map(name =>
      `<span class="text-xs leading-tight text-orange-700 dark:text-orange-300 truncate block">${esc(name)}</span>`
    ).join('');

    html += `
      <div class="${cellCls}" data-date="${dateStr}">
        <div class="flex">${numEl}</div>
        <div class="mt-0.5 flex flex-col gap-0.5 overflow-hidden">${projHtml}</div>
      </div>`;
  }

  html += '</div>';

  const grid = document.getElementById('dl-calendar-grid');
  if (!grid) return;
  grid.innerHTML = html;

  // 日付セルクリック → 搬入日詳細一覧へ遷移
  grid.querySelectorAll('[data-date]').forEach(cell => {
    cell.addEventListener('click', () => {
      deliveryState.selectedDate = cell.dataset.date;
      switchAppMode('delivery-detail');
    });
  });
}

// ── 搬入日詳細一覧画面 (3) ────────────────────────────────

async function loadAndRenderDateDetail(date) {
  if (!date) { switchAppMode('delivery'); return; }

  const content = document.getElementById('dl-detail-content');
  if (content) content.innerHTML = '<p class="text-center text-slate-400 py-8">読み込み中...</p>';

  // plansCache から該当日の計画を取得（なければロード）
  const [y, m] = date.split('-');
  const monthKey = `${y}-${m}`;
  if (!deliveryState.plansCache[monthKey]) {
    deliveryState.plansCache[monthKey] = await getPlansForMonth(parseInt(y), parseInt(m) - 1);
  }
  const plansForDate = (deliveryState.plansCache[monthKey] || []).filter(p => p.deliveryDate === date);

  // 号車を plan ごとに取得（キャッシュ優先）
  const plansWithTrucks = [];
  for (const plan of plansForDate) {
    if (!deliveryState.trucksCache[plan.id]) {
      deliveryState.trucksCache[plan.id] = await getTrucksForPlan(plan.projectId, plan.id);
    }
    const proj = deliveryState.deliveryProjects.find(p => p.id === plan.projectId);
    plansWithTrucks.push({
      plan,
      trucks: deliveryState.trucksCache[plan.id] || [],
      projectName: proj?.name || proj?.projectName || '工事名不明',
    });
  }

  renderDateDetail(date, plansWithTrucks);
}

function renderDateDetail(date, plansWithTrucks) {
  // 日付ラベル更新: 2026/03/12 の搬入一覧
  const [y, m, d] = (date || '').split('-');
  const dateLabel = document.getElementById('dl-detail-date-label');
  if (dateLabel && y) {
    dateLabel.textContent = `${y}/${m}/${d} の搬入一覧`;
  }

  // サマリー（差分件数を含む）
  const projIds     = new Set(plansWithTrucks.map(pw => pw.plan.projectId).filter(Boolean));
  const allTrucks   = plansWithTrucks.flatMap(pw => pw.trucks);
  const totalTrucks = allTrucks.length;
  const summary = document.getElementById('dl-detail-summary');
  if (summary) {
    summary.textContent = `${projIds.size}工事 / 号車${totalTrucks}台`;
  }

  // 全体注意事項
  const notes   = plansWithTrucks.map(pw => pw.plan.overallNotes).filter(Boolean);
  const notesEl = document.getElementById('dl-detail-notes');
  if (notesEl) {
    if (notes.length > 0) {
      notesEl.classList.remove('hidden');
      notesEl.textContent = notes.join(' / ');
    } else {
      notesEl.classList.add('hidden');
    }
  }

  if (plansWithTrucks.length === 0) {
    const content = document.getElementById('dl-detail-content');
    if (content) content.innerHTML = '<p class="text-center text-slate-400 py-8">この日の搬入計画はありません</p>';
    return;
  }

  // フィルタ適用
  const projectFilter = deliveryState.dateDetailProjectFilter.toLowerCase();
  const uncheckedOnly = deliveryState.uncheckedOnly;

  let filtered = plansWithTrucks;
  if (projectFilter) {
    filtered = filtered.filter(pw => pw.projectName.toLowerCase().includes(projectFilter));
  }

  // projectId でグループ化
  const grouped = {};
  filtered.forEach(pw => {
    const key = pw.plan.projectId || '_none';
    if (!grouped[key]) grouped[key] = {
      projectName: pw.projectName,
      drawingNo:   pw.plan.drawingNo || '',
      dayIndex:    pw.plan.dayIndex  ?? null,
      items: [],
    };
    grouped[key].items.push(pw);
  });

  let html = '';
  for (const [projId, group] of Object.entries(grouped)) {
    const isOpen = deliveryState.projectSectionOpenState[projId] !== false;

    // 号車を平坦化・ソート・フィルタ
    let trucks = group.items.flatMap(pw =>
      pw.trucks.map(t => ({ ...t, _planId: pw.plan.id, _projectId: pw.plan.projectId }))
    );
    trucks.sort((a, b) => {
      const orderDiff = (a.truckOrder ?? 999) - (b.truckOrder ?? 999);
      if (orderDiff !== 0) return orderDiff;
      return String(a.truckNo ?? '').localeCompare(String(b.truckNo ?? ''), 'ja', { numeric: true });
    });
    if (uncheckedOnly) trucks = trucks.filter(t => {
      const _it = deliveryState.itemsCache[t.id];
      return (_it ? _computeProgress(_it) : t.progressStatus) !== 'done';
    });

    const hasCaution = trucks.some(t => t.hasCaution || (t.cautionNotes || t.notes || '').trim());
    const doneCount  = trucks.filter(t => t.progressStatus === 'done').length;

    html += `
      <section class="bg-white dark:bg-slate-800 rounded-2xl shadow mb-3 overflow-hidden">
        <div class="dl-section-toggle flex items-center justify-between px-4 py-3 cursor-pointer
          hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
          data-project-id="${esc(projId)}">
          <div class="flex items-center gap-2 min-w-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 flex-shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}"
              fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
            <h3 class="font-bold text-slate-800 dark:text-slate-100 truncate">${esc(group.projectName)}</h3>
            ${group.drawingNo ? `<span class="flex-shrink-0 text-xs bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full">計画図 ${esc(group.drawingNo)}</span>` : ''}
            ${group.dayIndex  ? `<span class="flex-shrink-0 text-xs bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300 px-2 py-0.5 rounded-full">搬入${esc(String(group.dayIndex))}日目</span>` : ''}
            ${hasCaution ? '<span class="flex-shrink-0 text-xs bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300 px-2 py-0.5 rounded-full">注意</span>' : ''}
          </div>
          <span class="flex-shrink-0 text-sm text-slate-500 ml-2">${doneCount}/${trucks.length}台</span>
        </div>
        <div class="dl-section-body ${isOpen ? '' : 'hidden'} grid grid-cols-1 sm:grid-cols-2 gap-2 px-3 pb-3 pt-1"
          data-project-id="${esc(projId)}">
          ${trucks.length === 0
            ? '<p class="text-sm text-slate-400 py-2 col-span-full">表示する号車がありません</p>'
            : trucks.map(t => renderTruckCard(t)).join('')
          }
        </div>
      </section>`;
  }

  if (!html) {
    html = '<p class="text-center text-slate-400 py-8">条件に該当する搬入がありません</p>';
  }

  const content = document.getElementById('dl-detail-content');
  if (!content) return;
  content.innerHTML = html;

  // セクション開閉
  content.querySelectorAll('.dl-section-toggle').forEach(el => {
    el.addEventListener('click', () => {
      const pid   = el.dataset.projectId;
      const body  = content.querySelector(`.dl-section-body[data-project-id="${pid}"]`);
      const arrow = el.querySelector('svg');
      const open  = body && !body.classList.contains('hidden');
      deliveryState.projectSectionOpenState[pid] = !open;
      if (body)  body.classList.toggle('hidden', open);
      if (arrow) arrow.classList.toggle('rotate-90', !open);
    });
  });

  // 号車カードタップ → 画面4へ遷移
  content.querySelectorAll('.dl-truck-row').forEach(el => {
    el.addEventListener('click', () => {
      deliveryState.selectedTruckId   = el.dataset.truckId;
      deliveryState.selectedPlanId    = el.dataset.planId;
      deliveryState.selectedProjectId = el.dataset.projectId;
      switchAppMode('delivery-truck-detail');
    });
  });
}

function renderTruckCard(truck) {
  const _items  = deliveryState.itemsCache[truck.id];
  const _prog   = _items ? _computeProgress(_items) : (truck.progressStatus || 'pending');
  const progCls = progressCls(_prog);
  const progLbl = progressLabel(_prog);
  const hasCaution     = truck.hasCaution || !!(truck.cautionNotes || truck.notes || '').trim();
  const hasLoadingInst = truck.hasLoadingInstruction || !!truck.loadingInstruction?.trim();
  const hasDiff        = (truck.diffs?.length ?? 0) > 0;
  const hasBadge       = hasCaution || hasLoadingInst || hasDiff;

  return `
    <div class="dl-truck-row border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden
      cursor-pointer hover:border-blue-300 dark:hover:border-blue-600 active:opacity-70 transition-all
      bg-white dark:bg-slate-800/80"
      data-truck-id="${esc(truck.id)}" data-plan-id="${esc(truck._planId || '')}" data-project-id="${esc(truck._projectId || '')}">

      <!-- 行1: 号車番号 / 車種 / 進捗 -->
      <div class="flex items-center gap-2 px-3 pt-3 pb-1">
        <span class="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700
          flex items-center justify-center font-bold text-sm text-slate-700 dark:text-slate-200">
          ${esc(String(truck.truckNo || '?'))}
        </span>
        <span class="font-semibold text-slate-800 dark:text-slate-100 flex-1 text-sm leading-snug">
          ${esc(truck.vehicleType || '車種未設定')}
        </span>
        <span class="flex-shrink-0 text-xs px-2 py-0.5 rounded-full ${progCls}">${progLbl}</span>
      </div>

      <!-- 行2: 主な積載物 -->
      ${truck.loadSummary ? `
        <p class="text-xs text-slate-500 dark:text-slate-400 px-3 py-1 leading-snug">${esc(truck.loadSummary)}</p>
      ` : ''}

      <!-- バッジ行 -->
      ${hasBadge ? `
        <div class="flex gap-1 px-3 pb-3 pt-1.5 flex-wrap ${truck.loadSummary ? 'border-t border-slate-100 dark:border-slate-700/50' : ''}">
          ${hasCaution     ? '<span class="text-xs bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300 px-2 py-0.5 rounded-full font-medium">注意</span>' : ''}
          ${hasLoadingInst ? '<span class="text-xs bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">積込指示</span>' : ''}
          ${_diffBadges(truck.diffs)}
        </div>
      ` : (!truck.loadSummary ? '<div class="pb-2"></div>' : '<div class="pb-3"></div>')}
    </div>`;
}

// ── 号車詳細画面 (4) ──────────────────────────────────────

async function loadAndRenderTruckDetail(projectId, planId, truckId) {
  _truckProjectId = projectId;
  _truckPlanId    = planId;
  const content = document.getElementById('dl-truck-content');
  if (content) content.innerHTML = '<p class="text-center text-slate-400 py-8">読み込み中...</p>';

  // trucks キャッシュ確保
  if (!deliveryState.trucksCache[planId]) {
    deliveryState.trucksCache[planId] = await getTrucksForPlan(projectId, planId);
  }
  const sorted = (deliveryState.trucksCache[planId] || []).slice()
    .sort((a, b) => (a.truckOrder ?? 999) - (b.truckOrder ?? 999));
  deliveryState.trucksForCurrentPlan = sorted;

  const idx = sorted.findIndex(t => t.id === truckId);
  deliveryState.currentTruckIndex = idx >= 0 ? idx : 0;
  deliveryState.selectedTruckId = sorted[deliveryState.currentTruckIndex]?.id || truckId;

  await _loadAndDrawCurrentTruck();
}

async function _loadAndDrawCurrentTruck() {
  const { trucksForCurrentPlan, currentTruckIndex } = deliveryState;
  const truck = trucksForCurrentPlan[currentTruckIndex];
  if (!truck) return;

  const content = document.getElementById('dl-truck-content');
  if (content && !content.innerHTML.includes('読み込み中')) {
    content.innerHTML = '<p class="text-center text-slate-400 py-8">読み込み中...</p>';
  }

  if (!deliveryState.itemsCache[truck.id]) {
    deliveryState.itemsCache[truck.id] = await getItemsForTruck(_truckProjectId, _truckPlanId, truck.id);
  }
  _renderTruckDetail(truck);
}

function _reRenderTruck() {
  const truck = deliveryState.trucksForCurrentPlan[deliveryState.currentTruckIndex];
  if (truck) _renderTruckDetail(truck);
}

function navigateTruck(dir) {
  const { trucksForCurrentPlan, currentTruckIndex } = deliveryState;
  const next = currentTruckIndex + dir;
  if (next < 0 || next >= trucksForCurrentPlan.length) return;
  deliveryState.currentTruckIndex = next;
  deliveryState.selectedTruckId = trucksForCurrentPlan[next].id;
  _loadAndDrawCurrentTruck();
}

function _renderTruckDetail(truck) {
  const { trucksForCurrentPlan, currentTruckIndex } = deliveryState;
  const items = deliveryState.itemsCache[truck.id] || [];
  const total = trucksForCurrentPlan.length;

  // ── ヘッダー更新 ──
  const el = id => document.getElementById(id);

  // 搬入日ラベル
  let planData = null;
  for (const plans of Object.values(deliveryState.plansCache)) {
    planData = plans.find(p => p.id === _truckPlanId);
    if (planData) break;
  }
  const dateRaw = planData?.deliveryDate || '';
  if (el('dl-truck-date-label')) {
    el('dl-truck-date-label').textContent = dateRaw ? `${dateRaw.replace(/-/g, '/')} 搬入` : '';
  }

  // 号車情報行: 号車番号 / 車種 / 計画図番号(plan側) / 搬入日目
  const infoRow = [
    truck.truckNo       ? `${truck.truckNo}号車`          : null,
    truck.vehicleType                                      || null,
    planData?.drawingNo ? `計画図 ${planData.drawingNo}`  : null,
    planData?.dayIndex  ? `搬入${planData.dayIndex}日目`  : null,
  ].filter(Boolean).join(' / ');
  if (el('dl-truck-info-row')) el('dl-truck-info-row').textContent = infoRow;

  // 前後ボタン
  if (el('dl-truck-prev-btn')) el('dl-truck-prev-btn').disabled = currentTruckIndex === 0;
  if (el('dl-truck-next-btn')) el('dl-truck-next-btn').disabled = currentTruckIndex === total - 1;

  // タブバー
  _renderTruckTabBar(trucksForCurrentPlan, currentTruckIndex);

  // ── コンテンツ描画 ──
  const checkedCount    = items.filter(item => item.checked).length;
  const loadSummary     = truck.loadSummary      || '';
  const cautionNotes    = truck.cautionNotes     || truck.notes || '';
  const loadingInstr    = truck.loadingInstruction || '';
  const truckHasDiff    = truck.hasDiff;
  const truckDiffTypes  = truck.diffTypes;
  const truckDiffSum    = truck.diffSummary || '';

  let html = '';

  // 1. 号車サマリー
  if (loadSummary || cautionNotes || loadingInstr || truckHasDiff) {
    html += `<div class="bg-white dark:bg-slate-800 rounded-2xl shadow overflow-hidden">`;

    if (loadSummary) {
      html += `
        <div class="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
          <p class="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">主な積載物</p>
          <div class="flex flex-wrap items-center gap-1.5">
            <span class="text-sm text-slate-800 dark:text-slate-100">${esc(loadSummary)}</span>
            ${_diffBadges(truck.diffs)}
          </div>
        </div>`;
    }
    if (cautionNotes) {
      html += `
        <div class="px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-red-50 dark:bg-red-900/20">
          <p class="text-xs font-bold text-red-600 dark:text-red-400 mb-1">注意事項</p>
          <p class="text-sm text-red-700 dark:text-red-300 whitespace-pre-wrap">${esc(cautionNotes)}</p>
        </div>`;
    }
    if (loadingInstr) {
      html += `
        <div class="px-4 py-3 ${truckHasDiff ? 'border-b border-slate-100 dark:border-slate-700' : ''}">
          <p class="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">積込指示</p>
          <p class="text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap">${esc(loadingInstr)}</p>
        </div>`;
    }
    if (truckHasDiff) {
      const diffLabel = Array.isArray(truckDiffTypes) ? truckDiffTypes.join(' / ') : String(truckDiffTypes || '');
      const diffBody  = truckDiffSum || diffLabel;
      html += `
        <div class="px-4 py-3 bg-yellow-50 dark:bg-yellow-900/20">
          <p class="text-xs font-bold text-yellow-700 dark:text-yellow-400 mb-1">差分あり${diffLabel ? '：' + diffLabel : ''}</p>
          ${diffBody ? `<p class="text-sm text-yellow-700 dark:text-yellow-300 whitespace-pre-wrap">${esc(diffBody)}</p>` : ''}
        </div>`;
    }
    html += `</div>`;
  }

  // 2. 積込完了バナー（全品目 checked のときのみ）
  if (items.length > 0 && checkedCount === items.length) {
    html += `
      <div class="bg-green-50 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-2xl px-4 py-3 flex items-center gap-2">
        <svg class="w-5 h-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
        </svg>
        <span class="text-sm font-bold text-green-700 dark:text-green-300">積込完了</span>
      </div>`;
  }

  // 3. 品目グリッド
  html += `
    <div class="bg-white dark:bg-slate-800 rounded-2xl shadow overflow-hidden">
      <div class="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
        <h3 class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          品目一覧 <span class="font-normal normal-case text-slate-400">(${items.length}点)</span>
        </h3>
        ${checkedCount > 0 ? `<span class="text-xs text-green-600 dark:text-green-400">${checkedCount}件済</span>` : ''}
      </div>
      <div class="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
        ${items.length === 0
          ? '<p class="text-sm text-slate-400 col-span-full py-2">品目データがありません</p>'
          : items.map(item => _renderItemCard(item, truck.id)).join('')
        }
      </div>
    </div>`;

  const content = document.getElementById('dl-truck-content');
  if (!content) return;
  content.innerHTML = html;

  // 品目チェックボタン
  content.querySelectorAll('.dl-item-check-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { truckId, itemId } = btn.dataset;
      const items = deliveryState.itemsCache[truckId];
      const item  = items?.find(i => i.id === itemId);
      if (!item) return;
      const newChecked = !item.checked;
      item.checked = newChecked;
      // 進捗を再計算してキャッシュ更新（画面3の再表示に備える）
      const newProgress = _computeProgress(deliveryState.itemsCache[truckId]);
      [deliveryState.trucksForCurrentPlan, deliveryState.trucksCache[_truckPlanId]].forEach(arr => {
        const t = arr?.find(t => t.id === truckId);
        if (t) t.progressStatus = newProgress;
      });
      _reRenderTruck();
      try {
        await setItemChecked(_truckProjectId, _truckPlanId, truckId, itemId, newChecked);
      } catch (e) {
        console.error('[delivery] setItemChecked:', e);
        item.checked = !newChecked;
        _reRenderTruck();
      }
    });
  });

  // タグ展開ボタン
  content.querySelectorAll('.dl-item-tag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const card     = btn.closest('.dl-item-card');
      const expandEl = card?.querySelector('.dl-item-expand');
      if (!expandEl) return;
      const tag    = btn.dataset.tag;
      const text   = btn.dataset.content;
      const labels = { caution: '注意事項', loading: '積込指示', diff: '差分' };
      const isSame = expandEl.dataset.activeTag === tag && !expandEl.classList.contains('hidden');
      if (isSame) {
        expandEl.classList.add('hidden');
        expandEl.dataset.activeTag = '';
      } else {
        expandEl.classList.remove('hidden');
        expandEl.dataset.activeTag = tag;
        expandEl.innerHTML = `<span class="font-bold">▼ ${labels[tag]}</span><br><span class="whitespace-pre-wrap">${esc(text)}</span>`;
      }
    });
  });
}

// 号車タブバーを描画してクリックイベントを設定
function _renderTruckTabBar(trucks, currentIndex) {
  const tabBar = document.getElementById('dl-truck-tab-bar');
  if (!tabBar) return;

  tabBar.innerHTML = trucks.map((t, i) => {
    const active = i === currentIndex;
    return `<button class="dl-truck-tab flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold transition-colors
      ${active
        ? 'bg-blue-600 text-white'
        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}"
      data-index="${i}">${esc(String(t.truckNo || i + 1))}号車</button>`;
  }).join('');

  // アクティブタブを中央に
  const activeTab = tabBar.querySelector(`.dl-truck-tab[data-index="${currentIndex}"]`);
  if (activeTab) activeTab.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });

  tabBar.querySelectorAll('.dl-truck-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      if (idx === deliveryState.currentTruckIndex) return;
      deliveryState.currentTruckIndex = idx;
      deliveryState.selectedTruckId = trucks[idx].id;
      _loadAndDrawCurrentTruck();
    });
  });
}

// 品目カード（横並びグリッド用）
function _renderItemCard(item, truckId) {
  const isChecked    = !!item.checked;
  const name         = item.name || item.itemName || item.itemCode || '品目名不明';
  const cautionNote  = item.cautionNote || item.noteText || '';
  const loadingInstr = item.loadingInstruction || '';
  const itemDiffs    = item.diffs || [];

  return `
    <div class="dl-item-card flex flex-col rounded-xl border-2 transition-all
      ${isChecked
        ? 'border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-700'
        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'}"
      data-item-id="${esc(item.id)}">

      <!-- チェック + 品名 -->
      <button class="dl-item-check-btn text-left p-3 flex items-start gap-2 flex-1 active:opacity-70 w-full"
        data-truck-id="${esc(truckId)}" data-item-id="${esc(item.id)}">
        <span class="flex-shrink-0 w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center transition-colors
          ${isChecked ? 'bg-green-500 border-green-500' : 'border-slate-300 dark:border-slate-500'}">
          ${isChecked
            ? '<svg class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>'
            : ''}
        </span>
        <span class="text-sm font-bold leading-snug ${isChecked ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'}">${esc(name)}</span>
      </button>

      ${item.quantity != null
        ? `<p class="text-xs text-slate-400 px-3 -mt-1 pb-1">${esc(String(item.quantity))}${item.unit ? '&nbsp;' + esc(item.unit) : ''}</p>`
        : ''}

      <!-- タグ行 -->
      ${(cautionNote || loadingInstr || itemDiffs.length) ? `
        <div class="flex gap-1 px-2 pb-2 flex-wrap">
          ${cautionNote  ? `<button class="dl-item-tag-btn text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300 font-medium active:opacity-70"
            data-tag="caution" data-content="${esc(cautionNote)}">注意</button>` : ''}
          ${loadingInstr ? `<button class="dl-item-tag-btn text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300 font-medium active:opacity-70"
            data-tag="loading" data-content="${esc(loadingInstr)}">積込</button>` : ''}
          ${_diffBadges(itemDiffs)}
        </div>` : ''}

      <!-- タグ展開エリア -->
      <div class="dl-item-expand hidden px-3 pb-2 pt-2 text-xs border-t border-slate-100 dark:border-slate-700
        text-slate-700 dark:text-slate-300"></div>
    </div>`;
}


function _progressBtn(status, label, current) {
  const active = status === current;
  const activeCls = {
    pending:     'bg-slate-500 text-white',
    in_progress: 'bg-orange-500 text-white',
    done:        'bg-green-500 text-white',
  }[status] || 'bg-slate-400 text-white';
  const inactiveCls = 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600';
  return `<button class="dl-truck-progress-btn flex-1 py-3 rounded-xl text-sm font-bold transition-colors active:scale-95 ${active ? activeCls : inactiveCls}"
    data-status="${status}">${label}</button>`;
}

/** キャッシュから plansWithTrucks を同期的に再構築（フィルタ再描画用） */
function buildPlansWithTrucksFromCache(date) {
  if (!date) return [];
  const [y, m] = date.split('-');
  const monthKey = `${y}-${m}`;
  const plans = (deliveryState.plansCache[monthKey] || []).filter(p => p.deliveryDate === date);
  return plans.map(plan => {
    const proj = deliveryState.deliveryProjects.find(p => p.id === plan.projectId);
    return {
      plan,
      trucks: deliveryState.trucksCache[plan.id] || [],
      projectName: proj?.name || proj?.projectName || '工事名不明',
    };
  });
}

function progressLabel(status) {
  return { pending: '未着手', in_progress: '積込中', done: '完了' }[status] || '未着手';
}

function progressCls(status) {
  return {
    pending:     'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
    in_progress: 'bg-orange-100 text-orange-600 dark:bg-orange-900/50 dark:text-orange-300',
    done:        'bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-300',
  }[status] || 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400';
}

// ── イベント設定 ──────────────────────────────────────────

function on(id, event, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, handler);
}

// 前日 / 翌日へ移動（delta = -1 or +1）
function navigateDate(delta) {
  const cur = deliveryState.selectedDate;
  if (!cur) return;
  const [y, m, d] = cur.split('-').map(Number);
  const next = new Date(y, m - 1, d + delta);
  const nextStr = toDateStr(next);
  deliveryState.selectedDate = nextStr;
  // 月をまたいだ場合は displayMonth を更新
  const newMonthStart = new Date(next.getFullYear(), next.getMonth(), 1);
  deliveryState.displayMonth = newMonthStart;
  loadAndRenderDateDetail(nextStr);
}

function setupDeliveryEvents() {
  // Nav
  on('nav-to-bolt-btn',     'click', () => switchAppMode('bolt'));
  on('nav-to-delivery-btn', 'click', () => switchAppMode('delivery'));

  // カレンダー操作
  on('dl-prev-month', 'click', () => {
    const d = deliveryState.displayMonth;
    deliveryState.displayMonth = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    loadAndRenderCalendar();
  });
  on('dl-next-month', 'click', () => {
    const d = deliveryState.displayMonth;
    deliveryState.displayMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    loadAndRenderCalendar();
  });
  on('dl-today-btn', 'click', () => {
    const now = new Date();
    deliveryState.displayMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    deliveryState.selectedDate = toDateStr(now);
    switchAppMode('delivery-detail');
  });

  // 号車詳細画面 (4)
  on('dl-truck-back-btn',  'click', () => switchAppMode('delivery-detail'));
  on('dl-truck-prev-btn',  'click', () => navigateTruck(-1));
  on('dl-truck-next-btn',  'click', () => navigateTruck(1));

  // スワイプ（左→次、右→前）
  let _swipeX = 0;
  const truckContent = document.getElementById('dl-truck-content');
  if (truckContent) {
    truckContent.addEventListener('touchstart', e => {
      _swipeX = e.touches[0].clientX;
    }, { passive: true });
    truckContent.addEventListener('touchend', e => {
      const diff = _swipeX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 60) navigateTruck(diff > 0 ? 1 : -1);
    }, { passive: true });
  }

  // 搬入日詳細一覧画面 (3)
  on('dl-detail-back-btn', 'click', () => switchAppMode('delivery'));
  on('dl-detail-prev-btn', 'click', () => navigateDate(-1));
  on('dl-detail-next-btn', 'click', () => navigateDate(+1));
  on('dl-detail-project-filter', 'input', e => {
    deliveryState.dateDetailProjectFilter = e.target.value;
    renderDateDetail(deliveryState.selectedDate,
      // キャッシュから再構築
      buildPlansWithTrucksFromCache(deliveryState.selectedDate)
    );
  });
  on('dl-detail-unchecked-only', 'change', e => {
    deliveryState.uncheckedOnly = e.target.checked;
    renderDateDetail(deliveryState.selectedDate,
      buildPlansWithTrucksFromCache(deliveryState.selectedDate)
    );
  });

}

// ── 初期化（エントリーポイント） ──────────────────────────

export async function initDelivery() {
  try {
    deliveryState.deliveryProjects = await getDeliveryProjects();
  } catch (e) {
    console.error('[delivery] initDelivery: failed to load delivery projects', e);
  }

  setupDeliveryEvents();
  switchAppMode('delivery');
}
