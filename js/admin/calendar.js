// 管理画面 カレンダー + 計画登録フォーム

import { adminState } from './state.js';
import {
  getDeliveryProjects,
  getPlansForMonth,
  createPlan,
  createProject,
} from './db.js';
import { initGridScreen } from './ui.js';

// ── Helpers ────────────────────────────────────────────────

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

// ── Screen management ──────────────────────────────────────

// A2（グリッド）は flex で表示する必要があるため個別に指定
const SCREEN_DISPLAY = { calendar: 'block', 'plan-form': 'block', grid: 'flex' };

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

// ── Calendar (A0) ──────────────────────────────────────────

async function loadAndRenderCalendar() {
  const { displayMonth } = adminState;
  const year     = displayMonth.getFullYear();
  const month    = displayMonth.getMonth();
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

  const gridEl = document.getElementById('admin-cal-grid');
  if (gridEl && !adminState.plansCache[monthKey]) {
    gridEl.innerHTML = '<p class="text-center text-gray-500 py-6 col-span-7">読み込み中…</p>';
  }

  if (!adminState.plansCache[monthKey]) {
    adminState.plansCache[monthKey] = await getPlansForMonth(year, month);
  }
  renderCalendar();
}

function renderCalendar() {
  const { displayMonth, plansCache, selectedDate, projects } = adminState;
  const year     = displayMonth.getFullYear();
  const month    = displayMonth.getMonth();
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const plans    = plansCache[monthKey] || [];
  const todayStr = toDateStr(new Date());

  const monthLabelEl = document.getElementById('admin-cal-month');
  if (monthLabelEl) monthLabelEl.textContent = `${year}年${month + 1}月`;

  // 日付ごとの計画集計
  const plansByDate = {};
  for (const plan of plans) {
    if (!plan.deliveryDate) continue;
    if (!plansByDate[plan.deliveryDate]) plansByDate[plan.deliveryDate] = [];
    const proj = projects.find(p => p.id === plan.projectId);
    plansByDate[plan.deliveryDate].push(proj?.projectName || '工事');
  }

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const DAY_LABELS  = ['日', '月', '火', '水', '木', '金', '土'];

  let html = '<div class="grid grid-cols-7 gap-1">';

  DAY_LABELS.forEach((d, i) => {
    const c = i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-500';
    html += `<div class="text-center text-xs font-bold py-1 ${c}">${d}</div>`;
  });

  for (let i = 0; i < firstDay; i++) {
    html += '<div class="min-h-[72px]"></div>';
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr  = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const names    = plansByDate[dateStr] || [];
    const hasPlans = names.length > 0;
    const dow      = (firstDay + d - 1) % 7;
    const isToday  = dateStr === todayStr;
    const isSel    = dateStr === selectedDate;

    let cellCls = 'min-h-[72px] p-1.5 rounded-lg border cursor-pointer transition-colors ';
    if (isToday)       cellCls += 'border-blue-500 bg-blue-900/25 ';
    else if (isSel)    cellCls += 'border-yellow-400 bg-yellow-900/20 ';
    else if (hasPlans) cellCls += 'border-orange-700/50 bg-orange-900/10 hover:bg-orange-900/20 ';
    else               cellCls += 'border-gray-700 bg-gray-800 hover:bg-gray-700/50 ';

    const numCls = dow === 0 ? 'text-red-400' : dow === 6 ? 'text-blue-400' : 'text-gray-300';
    const numEl  = isToday
      ? `<span class="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">${d}</span>`
      : `<span class="text-xs font-semibold ${numCls}">${d}</span>`;

    const projHtml = names.map(name =>
      `<span class="text-xs leading-tight text-orange-300 truncate block">${esc(name)}</span>`
    ).join('');

    html += `
      <div class="${cellCls}" data-cal-date="${dateStr}">
        <div class="flex">${numEl}</div>
        <div class="mt-0.5 flex flex-col gap-0.5 overflow-hidden">${projHtml}</div>
      </div>`;
  }

  html += '</div>';

  const gridEl = document.getElementById('admin-cal-grid');
  if (gridEl) gridEl.innerHTML = html;
}

function renderDateDetail(dateStr) {
  const detailEl = document.getElementById('admin-cal-detail');
  if (!detailEl) return;

  const { displayMonth, plansCache, projects } = adminState;
  const year     = displayMonth.getFullYear();
  const month    = displayMonth.getMonth();
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const plans    = (plansCache[monthKey] || []).filter(p => p.deliveryDate === dateStr);

  const [, m, d] = dateStr.split('-');
  const label = `${parseInt(m)}月${parseInt(d)}日`;

  const planCards = plans.map(plan => {
    const proj = projects.find(p => p.id === plan.projectId);
    const meta = [
      plan.drawingNo ? `計画図 ${plan.drawingNo}` : null,
      plan.truckCount ? `${plan.truckCount}台` : null,
    ].filter(Boolean).join(' · ');

    return `
      <div class="flex items-center gap-3 p-3 rounded-lg bg-gray-800 border border-gray-700
                  hover:border-gray-500 cursor-pointer transition-colors"
           data-plan-id="${esc(plan.id)}" data-project-id="${esc(plan.projectId)}">
        <div class="flex-1 min-w-0">
          <div class="font-medium text-sm text-gray-100 truncate">${esc(proj?.projectName || '—')}</div>
          ${meta ? `<div class="text-xs text-gray-400 mt-0.5">${esc(meta)}</div>` : ''}
        </div>
        <span class="text-gray-500">›</span>
      </div>
    `;
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
    </div>
  `;
}

// ── Plan Form (A1) ─────────────────────────────────────────

function showPlanForm(dateStr) {
  if (dateStr) adminState.selectedDate = dateStr;
  showScreen('plan-form');
  updateHeaderInfo('<span class="text-gray-400">搬入計画 登録</span>');
  renderPlanForm();
}

function renderPlanForm() {
  const el = document.getElementById('admin-plan-form-content');
  if (!el) return;

  const { projects, selectedDate } = adminState;

  const projOptions = [
    '<option value="">— 既存工事を選択 —</option>',
    ...projects.map(p => `<option value="${esc(p.id)}">${esc(p.projectName)}</option>`),
    '<option value="__new__">＋ 新規工事を作成…</option>',
  ].join('');

  const inp = 'w-full bg-gray-700 text-gray-100 rounded px-3 py-2 text-sm';

  el.innerHTML = `
    <h2 class="text-lg font-semibold text-gray-100 mb-6">搬入計画 登録</h2>
    <div class="space-y-4">

      <div>
        <label class="text-xs text-gray-400 block mb-1">工事 <span class="text-red-400">*</span></label>
        <select id="pf-project" class="${inp}">
          ${projOptions}
        </select>
      </div>

      <div id="pf-new-project-area" class="hidden space-y-2 pl-2 border-l-2 border-blue-700">
        <div>
          <label class="text-xs text-gray-400 block mb-1">新規工事名 <span class="text-red-400">*</span></label>
          <input id="pf-new-project-name" type="text" class="${inp}" placeholder="例: ○○ビル新築工事">
        </div>
        <div>
          <label class="text-xs text-gray-400 block mb-1">工事コード</label>
          <input id="pf-new-project-code" type="text" class="${inp}" placeholder="例: PROJ-001">
        </div>
      </div>

      <div>
        <label class="text-xs text-gray-400 block mb-1">搬入日 <span class="text-red-400">*</span></label>
        <input id="pf-date" type="date" value="${esc(selectedDate || '')}" class="${inp}">
      </div>

      <div class="flex gap-3">
        <div class="flex-1">
          <label class="text-xs text-gray-400 block mb-1">建方○日目</label>
          <input id="pf-construction-day" type="number" min="1" value="1" class="${inp}">
        </div>
        <div class="flex-1">
          <label class="text-xs text-gray-400 block mb-1">搬入日数</label>
          <input id="pf-delivery-days" type="number" min="1" max="30" value="1" class="${inp}">
        </div>
      </div>

      <div>
        <label class="text-xs text-gray-400 block mb-1">計画図番</label>
        <input id="pf-drawing-no" type="text" class="${inp}" placeholder="例: DWG-2026-001">
      </div>

      <div class="flex gap-3 pt-2">
        <button id="pf-save"
          class="flex-1 bg-blue-700 hover:bg-blue-600 text-white py-2 rounded text-sm font-medium">
          登録
        </button>
        <button id="pf-cancel"
          class="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded text-sm">
          キャンセル
        </button>
      </div>

    </div>
  `;

  // 工事セレクト変更 → 新規入力エリア表示切替
  document.getElementById('pf-project').addEventListener('change', e => {
    document.getElementById('pf-new-project-area').classList.toggle('hidden', e.target.value !== '__new__');
  });

  document.getElementById('pf-save').addEventListener('click', handlePlanFormSave);
  document.getElementById('pf-cancel').addEventListener('click', goToCalendar);
}

async function handlePlanFormSave() {
  const projectSel     = document.getElementById('pf-project').value;
  const deliveryDate   = document.getElementById('pf-date').value;
  const constructionDay = parseInt(document.getElementById('pf-construction-day').value) || 1;
  const drawingNo      = document.getElementById('pf-drawing-no').value.trim();

  // 簡易バリデーション
  let valid = true;
  if (!projectSel) {
    document.getElementById('pf-project').classList.add('ring-1', 'ring-red-500');
    valid = false;
  }
  if (!deliveryDate) {
    document.getElementById('pf-date').classList.add('ring-1', 'ring-red-500');
    valid = false;
  }
  if (!valid) return;

  let projectId = projectSel;

  // 新規工事作成
  if (projectSel === '__new__') {
    const newName = document.getElementById('pf-new-project-name').value.trim();
    const newCode = document.getElementById('pf-new-project-code').value.trim();
    if (!newName) {
      document.getElementById('pf-new-project-name').classList.add('ring-1', 'ring-red-500');
      return;
    }
    const created = await createProject({ projectName: newName, projectCode: newCode, isActive: true });
    adminState.projects.push(created);
    projectId = created.id;
  }

  await createPlan(projectId, {
    deliveryDate,
    constructionDay,
    drawingNo: drawingNo || null,
    status:    'active',
    truckCount: 0,
  });

  // キャッシュを無効化して再ロード（登録した月）
  const [y, m] = deliveryDate.split('-');
  delete adminState.plansCache[`${y}-${m}`];

  adminState.selectedDate = deliveryDate;
  await goToCalendar();
}

// ── Grid (A2) ─────────────────────────────────────────────

async function enterGrid(projectId, planId) {
  const proj = adminState.projects.find(p => p.id === projectId);
  showScreen('grid');
  updateHeaderInfo(`
    <span class="text-gray-300 truncate max-w-[200px]">${esc(proj?.projectName || projectId)}</span>
    <span class="text-gray-600">/</span>
    <span class="text-gray-500 text-xs">${esc(planId)}</span>
  `);
  await initGridScreen(projectId, planId);
}

// ── Navigation ─────────────────────────────────────────────

async function goToCalendar() {
  showScreen('calendar');
  updateHeaderInfo('');
  await loadAndRenderCalendar();
  if (adminState.selectedDate) {
    renderDateDetail(adminState.selectedDate);
  }
}

// ── Event Delegation ───────────────────────────────────────

function bindCalendarEvents() {
  // 月移動
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

  // 日付セルクリック（イベント委譲）
  document.getElementById('admin-cal-grid').addEventListener('click', e => {
    const cell = e.target.closest('[data-cal-date]');
    if (!cell) return;
    adminState.selectedDate = cell.dataset.calDate;
    renderCalendar();
    renderDateDetail(adminState.selectedDate);
  });

  // 計画一覧エリアのクリック（イベント委譲）
  document.getElementById('admin-cal-detail').addEventListener('click', async e => {
    // 「搬入計画を登録」ボタン
    const addBtn = e.target.closest('[data-action="add-plan"]');
    if (addBtn) {
      showPlanForm(addBtn.dataset.date);
      return;
    }
    // 計画カードクリック → グリッドへ
    const card = e.target.closest('[data-plan-id]');
    if (card) {
      await enterGrid(card.dataset.projectId, card.dataset.planId);
    }
  });

  // 戻るボタン
  document.getElementById('admin-back-btn').addEventListener('click', goToCalendar);
}

// ── Init ───────────────────────────────────────────────────

export async function initAdminApp() {
  // プロジェクト一覧を先にロード（計画フォームのセレクトで使用）
  adminState.projects = await getDeliveryProjects();

  // イベント bind
  bindCalendarEvents();

  // カレンダー画面から開始
  await goToCalendar();
}
