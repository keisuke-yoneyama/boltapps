// 搬入リスト管理 - UI / イベント / 初期化
// ボルト計算アプリの state.projects を読み取り専用で参照する以外は独立

import { deliveryState } from './delivery-state.js';
import {
  getDeliveryProjects,
  getPlansForMonth,
  getTrucksForPlan,
  getItemsForTruck,
  getChecksForTruck,
  setItemCheck,
  updateTruckStatus,
} from './delivery-db.js';

// 号車詳細画面のコンテキスト（再描画時に参照）
let _truckPlanId = null;
let _truckProjectName = '';

const esc = s =>
  String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

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
    loadAndRenderTruckDetail(deliveryState.selectedPlanId, deliveryState.selectedTruckId);

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

  // 日付ごとに集計
  const plansByDate = {};
  plans.forEach(plan => {
    const d = plan.deliveryDate;
    if (!d) return;
    if (!plansByDate[d]) plansByDate[d] = [];
    plansByDate[d].push(plan);
  });

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const firstDay    = new Date(year, month, 1).getDay(); // 0=日
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
    html += '<div class="min-h-[60px]"></div>';
  }

  // 日付セル
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr  = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayPlans = plansByDate[dateStr] || [];
    const dow      = (firstDay + d - 1) % 7;
    const isToday  = dateStr === todayStr;
    const isSel    = dateStr === selectedDate;

    let cellCls = 'min-h-[60px] p-1 rounded-lg border cursor-pointer transition-colors ';
    if (isToday) {
      cellCls += 'border-blue-400 bg-blue-50 dark:bg-blue-900/30 ';
    } else if (isSel) {
      cellCls += 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 ';
    } else {
      cellCls += 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 ';
    }

    const numCls = dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-slate-700 dark:text-slate-200';
    const numEl  = isToday
      ? `<span class="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">${d}</span>`
      : `<span class="text-sm font-semibold ${numCls}">${d}</span>`;

    const planBadge = dayPlans.length > 0
      ? `<span class="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300 rounded px-1 leading-tight">${dayPlans.length}件</span>`
      : '';

    const projIds   = [...new Set(dayPlans.map(p => p.projectId).filter(Boolean))];
    const projBadge = projIds.length > 0
      ? `<span class="text-xs text-slate-400 dark:text-slate-500">${projIds.length}工事</span>`
      : '';

    html += `
      <div class="${cellCls}" data-date="${dateStr}">
        <div class="flex">${numEl}</div>
        <div class="mt-0.5 flex flex-col gap-0.5">${planBadge}${projBadge}</div>
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
      deliveryState.trucksCache[plan.id] = await getTrucksForPlan(plan.id);
    }
    const proj = deliveryState.deliveryProjects.find(p => p.id === plan.projectId);
    plansWithTrucks.push({
      plan,
      trucks: deliveryState.trucksCache[plan.id] || [],
      projectName: proj?.projectName || '工事名不明',
    });
  }

  renderDateDetail(date, plansWithTrucks);
}

function renderDateDetail(date, plansWithTrucks) {
  // 日付ラベル更新
  const [y, m, d] = (date || '').split('-');
  const dateLabel = document.getElementById('dl-detail-date-label');
  if (dateLabel && y) dateLabel.textContent = `${y}年${parseInt(m)}月${parseInt(d)}日`;

  // サマリー
  const projIds = new Set(plansWithTrucks.map(pw => pw.plan.projectId).filter(Boolean));
  const totalTrucks = plansWithTrucks.reduce((s, pw) => s + pw.trucks.length, 0);
  const summary = document.getElementById('dl-detail-summary');
  if (summary) summary.textContent = `${projIds.size}工事 / ${plansWithTrucks.length}件 / 号車${totalTrucks}台`;

  // 全体注意事項（複数 plan の overallNotes をまとめて表示）
  const notes = plansWithTrucks.map(pw => pw.plan.overallNotes).filter(Boolean);
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
  const projectFilter  = deliveryState.dateDetailProjectFilter.toLowerCase();
  const uncheckedOnly  = deliveryState.uncheckedOnly;

  let filtered = plansWithTrucks;
  if (projectFilter) {
    filtered = filtered.filter(pw => pw.projectName.toLowerCase().includes(projectFilter));
  }

  // projectId でグループ化
  const grouped = {};
  filtered.forEach(pw => {
    const key = pw.plan.projectId || '_none';
    if (!grouped[key]) grouped[key] = { projectName: pw.projectName, items: [] };
    grouped[key].items.push(pw);
  });

  let html = '';
  for (const [projId, group] of Object.entries(grouped)) {
    const isOpen = deliveryState.projectSectionOpenState[projId] !== false; // default: open

    // 号車を平坦化して未完了フィルタ
    let trucks = group.items.flatMap(pw =>
      pw.trucks.map(t => ({ ...t, _planId: pw.plan.id }))
    );
    trucks.sort((a, b) => (a.truckOrder ?? 999) - (b.truckOrder ?? 999));
    if (uncheckedOnly) trucks = trucks.filter(t => t.progressStatus !== 'done');

    const hasAlert = trucks.some(t => t.notes && t.notes.trim());
    const doneCount = trucks.filter(t => t.progressStatus === 'done').length;

    html += `
      <section class="bg-white dark:bg-slate-800 rounded-2xl shadow mb-3 overflow-hidden">
        <div class="dl-section-toggle flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
          data-project-id="${esc(projId)}">
          <div class="flex items-center gap-2 min-w-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 flex-shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}"
              fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
            <h3 class="font-bold text-slate-800 dark:text-slate-100 truncate">${esc(group.projectName)}</h3>
            ${hasAlert ? '<span class="flex-shrink-0 text-xs bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300 px-2 py-0.5 rounded-full">注意あり</span>' : ''}
          </div>
          <span class="flex-shrink-0 text-sm text-slate-500 ml-2">${doneCount}/${trucks.length}台</span>
        </div>
        <div class="dl-section-body ${isOpen ? '' : 'hidden'}" data-project-id="${esc(projId)}">
          ${trucks.length === 0
            ? '<p class="text-sm text-slate-400 px-4 pb-4">表示する号車がありません</p>'
            : trucks.map(t => renderTruckRow(t)).join('')
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
      const pid  = el.dataset.projectId;
      const body  = content.querySelector(`.dl-section-body[data-project-id="${pid}"]`);
      const arrow = el.querySelector('svg');
      const open  = body && !body.classList.contains('hidden');
      deliveryState.projectSectionOpenState[pid] = !open;
      if (body)  body.classList.toggle('hidden', open);
      if (arrow) arrow.classList.toggle('rotate-90', !open);
    });
  });

  // 号車行クリック → selectedTruckId 更新（phase 4: 号車詳細へ遷移）
  content.querySelectorAll('.dl-truck-row').forEach(el => {
    el.addEventListener('click', () => {
      deliveryState.selectedTruckId = el.dataset.truckId;
      deliveryState.selectedPlanId  = el.dataset.planId;
      content.querySelectorAll('.dl-truck-row').forEach(r =>
        r.classList.remove('ring-2', 'ring-inset', 'ring-yellow-400')
      );
      el.classList.add('ring-2', 'ring-inset', 'ring-yellow-400');
      switchAppMode('delivery-truck-detail');
    });
  });
}

function renderTruckRow(truck) {
  const progCls   = progressCls(truck.progressStatus);
  const progLabel = progressLabel(truck.progressStatus);
  const hasNotes  = truck.notes && truck.notes.trim();
  return `
    <div class="dl-truck-row flex items-center gap-3 px-4 py-3 border-t border-slate-100 dark:border-slate-700/50
      hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors"
      data-truck-id="${esc(truck.id)}" data-plan-id="${esc(truck._planId || '')}">
      <div class="flex-shrink-0 w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
        <span class="font-bold text-slate-700 dark:text-slate-200 text-sm">${esc(truck.truckNo || '?')}</span>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="font-semibold text-slate-800 dark:text-slate-100">${esc(truck.vehicleType || '車種未設定')}</span>
          ${truck.loadingPriority ? `<span class="text-xs bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 px-1.5 py-0.5 rounded">優先${esc(String(truck.loadingPriority))}</span>` : ''}
          ${hasNotes ? '<span class="text-xs bg-red-50 text-red-500 dark:bg-red-900/30 dark:text-red-300 px-1.5 py-0.5 rounded">注意</span>' : ''}
        </div>
        ${truck.drawingNo ? `<p class="text-xs text-slate-400 mt-0.5">図番: ${esc(truck.drawingNo)}</p>` : ''}
      </div>
      <span class="flex-shrink-0 text-xs px-2 py-1 rounded-full ${progCls}">${progLabel}</span>
      <svg xmlns="http://www.w3.org/2000/svg" class="flex-shrink-0 h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
      </svg>
    </div>`;
}

// ── 号車詳細画面 (4) ──────────────────────────────────────

async function loadAndRenderTruckDetail(planId, truckId) {
  _truckPlanId = planId;
  const content = document.getElementById('dl-truck-content');
  if (content) content.innerHTML = '<p class="text-center text-slate-400 py-8">読み込み中...</p>';

  // trucks キャッシュ確保
  if (!deliveryState.trucksCache[planId]) {
    deliveryState.trucksCache[planId] = await getTrucksForPlan(planId);
  }
  const sorted = (deliveryState.trucksCache[planId] || []).slice()
    .sort((a, b) => (a.truckOrder ?? 999) - (b.truckOrder ?? 999));
  deliveryState.trucksForCurrentPlan = sorted;

  const idx = sorted.findIndex(t => t.id === truckId);
  deliveryState.currentTruckIndex = idx >= 0 ? idx : 0;
  deliveryState.selectedTruckId = sorted[deliveryState.currentTruckIndex]?.id || truckId;

  // projectName 解決
  let planData = null;
  for (const plans of Object.values(deliveryState.plansCache)) {
    planData = plans.find(p => p.id === planId);
    if (planData) break;
  }
  const proj = deliveryState.deliveryProjects.find(p => p.id === planData?.projectId);
  _truckProjectName = proj?.projectName || '';

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
    deliveryState.itemsCache[truck.id] = await getItemsForTruck(_truckPlanId, truck.id);
  }
  if (!deliveryState.checksCache[truck.id]) {
    deliveryState.checksCache[truck.id] = await getChecksForTruck(_truckPlanId, truck.id);
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
  const items     = deliveryState.itemsCache[truck.id] || [];
  const checksMap = deliveryState.checksCache[truck.id] || {};
  const total     = trucksForCurrentPlan.length;

  // ヘッダー更新
  const el = id => document.getElementById(id);
  if (el('dl-truck-project-name')) el('dl-truck-project-name').textContent = _truckProjectName;
  if (el('dl-truck-no-label'))     el('dl-truck-no-label').textContent = `${truck.truckNo || '-'}号車`;
  if (el('dl-truck-position'))     el('dl-truck-position').textContent = `${currentTruckIndex + 1} / ${total}`;
  const prevBtn = el('dl-truck-prev-btn');
  const nextBtn = el('dl-truck-next-btn');
  if (prevBtn) prevBtn.disabled = currentTruckIndex === 0;
  if (nextBtn) nextBtn.disabled = currentTruckIndex === total - 1;

  const checkedCount = items.filter(item => checksMap[item.id] === 'checked').length;
  const progress = truck.progressStatus || 'pending';
  const hasNotes = truck.notes && truck.notes.trim();

  let html = '';

  // 1. 基本情報
  html += `
    <div class="bg-white dark:bg-slate-800 rounded-2xl shadow p-4">
      <h3 class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">基本情報</h3>
      <div class="grid grid-cols-2 gap-y-3 gap-x-4">
        ${_infoRow('車種', truck.vehicleType)}
        ${_infoRow('優先順位', truck.loadingPriority != null ? `優先 ${truck.loadingPriority}` : null)}
        ${_infoRow('積む向き', truck.loadingOrientation)}
        ${_infoRow('高さ制限', truck.heightLimit != null ? `${truck.heightLimit} m 以下` : null)}
        ${_infoRow('幅制限',   truck.widthLimit  != null ? `${truck.widthLimit} m 以下`  : null)}
      </div>
    </div>`;

  // 2. 注意事項
  if (hasNotes) {
    html += `
      <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4">
        <h3 class="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-2">注意事項</h3>
        <p class="text-sm text-red-700 dark:text-red-300 whitespace-pre-wrap">${esc(truck.notes)}</p>
      </div>`;
  }

  // 3. 積込進捗（号車全体）
  html += `
    <div class="bg-white dark:bg-slate-800 rounded-2xl shadow p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">積込進捗</h3>
        <span class="text-xs text-slate-400">${checkedCount} / ${items.length} 品目完了</span>
      </div>
      <div class="flex gap-2" data-plan-id="${esc(_truckPlanId)}" data-truck-id="${esc(truck.id)}">
        ${_progressBtn('pending',     '未着手', progress)}
        ${_progressBtn('in_progress', '積込中', progress)}
        ${_progressBtn('done',        '完了',   progress)}
      </div>
    </div>`;

  // 4. 品目一覧
  html += `
    <div class="bg-white dark:bg-slate-800 rounded-2xl shadow overflow-hidden">
      <div class="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
        <h3 class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          品目一覧 <span class="font-normal normal-case text-slate-400">(${items.length}点)</span>
        </h3>
      </div>
      ${items.length === 0
        ? '<p class="text-sm text-slate-400 px-4 py-4">品目データがありません</p>'
        : items.map(item => _renderItemRow(item, checksMap, truck.id)).join('')
      }
    </div>`;

  // 5. 補足情報
  const updatedAt = truck.updatedAt?.toDate?.();
  const updatedStr = updatedAt
    ? updatedAt.toLocaleDateString('ja-JP') + ' ' + updatedAt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
    : '-';
  html += `
    <div class="text-xs text-slate-400 dark:text-slate-500 px-1 pb-6 space-y-0.5">
      ${truck.drawingNo ? `<p>計画図番号: ${esc(truck.drawingNo)}</p>` : ''}
      <p>更新: ${updatedStr}${truck.updatedBy ? ' ／ ' + esc(truck.updatedBy) : ''}</p>
    </div>`;

  const content = document.getElementById('dl-truck-content');
  if (!content) return;
  content.innerHTML = html;

  // 号車進捗ボタン
  content.querySelectorAll('.dl-truck-progress-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const wrap = btn.closest('[data-plan-id]');
      const pId  = wrap?.dataset.planId;
      const tId  = wrap?.dataset.truckId;
      if (!pId || !tId) return;
      const status = btn.dataset.status;
      try {
        await updateTruckStatus(pId, tId, status);
        // キャッシュ更新
        [deliveryState.trucksCache[pId], deliveryState.trucksForCurrentPlan].forEach(arr => {
          const t = arr?.find(t => t.id === tId);
          if (t) t.progressStatus = status;
        });
        _reRenderTruck();
      } catch (e) {
        console.error('[delivery] updateTruckStatus:', e);
        alert('更新に失敗しました');
      }
    });
  });

  // 品目チェックボタン
  content.querySelectorAll('.dl-item-check-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { truckId, itemId, checkStatus } = btn.dataset;
      const newStatus = checkStatus === 'checked' ? 'unchecked' : 'checked';
      // 即時 UI 更新（楽観的更新）
      if (!deliveryState.checksCache[truckId]) deliveryState.checksCache[truckId] = {};
      deliveryState.checksCache[truckId][itemId] = newStatus;
      _reRenderTruck();
      try {
        await setItemCheck(_truckPlanId, truckId, itemId, newStatus);
      } catch (e) {
        console.error('[delivery] setItemCheck:', e);
        // ロールバック
        deliveryState.checksCache[truckId][itemId] = checkStatus;
        _reRenderTruck();
      }
    });
  });
}

function _renderItemRow(item, checksMap, truckId) {
  const checkStatus = checksMap[item.id] || 'unchecked';
  const isChecked   = checkStatus === 'checked';
  return `
    <div class="flex items-center gap-3 px-4 py-3 border-t border-slate-100 dark:border-slate-700/50
      ${isChecked ? 'opacity-50' : 'hover:bg-slate-50 dark:hover:bg-slate-700/20'} transition-colors">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1.5 flex-wrap mb-0.5">
          ${item.itemCategory ? `<span class="text-xs text-slate-400">${esc(item.itemCategory)}</span>` : ''}
          ${item.hasDiff    ? '<span class="text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300 px-1 rounded">差分</span>' : ''}
          ${item.noteText   ? '<span class="text-xs bg-red-50 text-red-500 dark:bg-red-900/30 dark:text-red-300 px-1 rounded">注意</span>' : ''}
        </div>
        <p class="text-sm font-semibold text-slate-800 dark:text-slate-100 ${isChecked ? 'line-through' : ''}">
          ${esc(item.itemName || item.itemCode || '品目名不明')}
        </p>
        <p class="text-xs text-slate-400 mt-0.5">
          ${item.quantity != null ? esc(String(item.quantity)) : ''}${item.unit ? '&nbsp;' + esc(item.unit) : ''}
        </p>
      </div>
      <button class="dl-item-check-btn flex-shrink-0 w-12 h-12 rounded-full border-2 transition-all active:scale-95
        ${isChecked
          ? 'bg-green-500 border-green-500 text-white'
          : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-500 text-transparent hover:border-green-400'}"
        data-truck-id="${esc(truckId)}" data-item-id="${esc(item.id)}" data-check-status="${checkStatus}">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 mx-auto" fill="none" viewBox="0 0 24 24"
          stroke="currentColor" stroke-width="3">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
        </svg>
      </button>
    </div>`;
}

function _infoRow(label, value) {
  if (value == null || value === '') return '';
  return `
    <div>
      <p class="text-xs text-slate-400 dark:text-slate-500">${label}</p>
      <p class="text-sm font-semibold text-slate-800 dark:text-slate-100">${esc(String(value))}</p>
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
      projectName: proj?.projectName || '工事名不明',
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
    deliveryState.selectedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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
