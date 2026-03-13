// 管理画面 カレンダー + 計画登録フォーム

import { adminState } from './state.js';
import {
  getBoltProjects,
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

// bolt プロジェクトの表示名を取得（name 優先、なければ projectName）
function projDisplayName(proj) {
  return proj?.name || proj?.projectName || null;
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
    plansByDate[plan.deliveryDate].push(projDisplayName(proj) || '工事');
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
    const name = projDisplayName(proj) || '—';
    const meta = [
      plan.drawingNo ? `計画図 ${plan.drawingNo}` : null,
      plan.truckCount ? `${plan.truckCount}台` : null,
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

/**
 * 日付割当モード
 * 'continuous' : 連続（土日含む全日）
 * 'weekday'    : 平日のみ（土日スキップ）
 * 'all'        : 平日+土日+祝日（将来の祝日対応用。現状は 'continuous' と同じ全日連続）
 */

/**
 * 搬入日リストを生成する
 * @param {string} startDateStr - 'YYYY-MM-DD'
 * @param {number} count
 * @param {'continuous'|'weekday'|'all'} mode
 * @returns {{ dayIndex: number, date: string, dayLabel: string, drawingNo: string }[]}
 */
function generateDays(startDateStr, count, mode) {
  const days = [];
  const [y, mo, d] = startDateStr.split('-').map(Number);
  const cur = new Date(y, mo - 1, d);
  let idx = 1;

  while (days.length < count) {
    const dow  = cur.getDay();
    const skip = mode === 'weekday' && (dow === 0 || dow === 6);
    // 'all' は将来の祝日スキップをここに追加予定。現状はスキップなし。

    if (!skip) {
      days.push({
        dayIndex: idx,
        date: toDateStr(cur),
        dayLabel: `搬入${idx}日目`,
        drawingNo: '',
      });
      idx++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

/**
 * 指定行以降の日付を、その行の日付を起点に後ろへ再計算する
 * @param {number} fromDayIndex - 変更した行の dayIndex（この行自体は変えない）
 * @param {string} baseDateStr  - 変更後の日付 'YYYY-MM-DD'
 * @param {'continuous'|'weekday'|'all'} mode
 */
function recalcFrom(fromDayIndex, baseDateStr, mode) {
  const rows = [...document.querySelectorAll('#pf-preview tr[data-day-index]')];
  const afterRows = rows.filter(r => parseInt(r.dataset.dayIndex) > fromDayIndex);

  const [y, mo, d] = baseDateStr.split('-').map(Number);
  const cur = new Date(y, mo - 1, d);
  cur.setDate(cur.getDate() + 1); // 次の日から開始

  for (const row of afterRows) {
    // 平日のみモード: 土日をスキップ
    if (mode === 'weekday') {
      while (cur.getDay() === 0 || cur.getDay() === 6) {
        cur.setDate(cur.getDate() + 1);
      }
    }
    // 'all' は将来の祝日スキップをここに追加予定
    row.querySelector('input[name="date"]').value = toDateStr(cur);
    cur.setDate(cur.getDate() + 1);
  }
}

/**
 * 計画図番割当モードをプレビュー行に適用する
 * @param {'sequential'} drawingMode
 */
function applyDrawingNoMode(drawingMode) {
  if (drawingMode !== 'sequential') return;
  const rows = document.querySelectorAll('#pf-preview tr[data-day-index]');
  rows.forEach((row, i) => {
    row.querySelector('input[name="drawingNo"]').value = String(i + 1);
  });
}

function renderPreviewTable(days) {
  if (!days.length) return '<p class="text-xs text-gray-500 p-3">（日付なし）</p>';

  const inp = 'bg-gray-700 text-gray-100 rounded px-2 py-1 text-xs w-full';
  const rows = days.map(({ dayIndex, date, dayLabel, drawingNo }) => `
    <tr data-day-index="${dayIndex}" class="border-t border-gray-700">
      <td class="px-2 py-1.5 text-xs text-gray-400 text-center whitespace-nowrap">${dayIndex}</td>
      <td class="px-2 py-1.5">
        <input type="date" name="date" value="${esc(date)}" class="${inp}">
      </td>
      <td class="px-2 py-1.5">
        <input type="text" name="dayLabel" value="${esc(dayLabel)}" class="${inp}" placeholder="日名称">
      </td>
      <td class="px-2 py-1.5">
        <input type="text" name="drawingNo" value="${esc(drawingNo)}" class="${inp}" placeholder="1">
      </td>
    </tr>
  `).join('');

  return `
    <table class="w-full text-sm">
      <thead>
        <tr class="text-xs text-gray-500">
          <th class="px-2 py-1 text-center w-10">日目</th>
          <th class="px-2 py-1 text-left">日付</th>
          <th class="px-2 py-1 text-left">日名称</th>
          <th class="px-2 py-1 text-left">計画図番</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function showPlanForm(dateStr) {
  if (dateStr) adminState.selectedDate = dateStr;
  showScreen('plan-form');
  updateHeaderInfo('<span class="text-gray-400">搬入計画 登録</span>');
  renderPlanForm();
}

// A1 フォームのイベントは el への委譲で一度だけバインド
let _planFormEventsBound = false;

function renderPlanForm() {
  const el = document.getElementById('admin-plan-form-content');
  if (!el) return;

  const { projects, selectedDate } = adminState;

  const projOptions = [
    '<option value="">— 工事を選択 —</option>',
    ...projects.map(p => `<option value="${esc(p.id)}">${esc(projDisplayName(p) || p.id)}</option>`),
    '<option value="__new__">＋ 新規工事を作成…</option>',
  ].join('');

  const inp = 'w-full bg-gray-700 text-gray-100 rounded px-3 py-2 text-sm';

  const startDateLabel = selectedDate
    ? (() => { const [, m, d] = selectedDate.split('-'); return `${parseInt(m)}月${parseInt(d)}日`; })()
    : '未選択';

  // 初期プレビュー（搬入1日目、連番図番）
  const initialDays = selectedDate ? generateDays(selectedDate, 1, 'continuous') : [];
  initialDays.forEach((day, i) => { day.drawingNo = String(i + 1); });

  const radioBase = 'accent-blue-500';

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
      </div>

      <div>
        <label class="text-xs text-gray-400 block mb-1">搬入開始日</label>
        <div class="px-3 py-2 text-sm text-gray-300 bg-gray-800 rounded border border-gray-700">
          ${esc(startDateLabel)}
        </div>
      </div>

      <div class="flex gap-4 items-start">
        <div class="w-24 flex-shrink-0">
          <label class="text-xs text-gray-400 block mb-1">搬入日数 <span class="text-red-400">*</span></label>
          <input id="pf-delivery-days" type="number" min="1" max="30" value="1" class="${inp}">
        </div>
        <div class="flex-1">
          <label class="text-xs text-gray-400 block mb-1">日付割当モード</label>
          <div class="flex flex-col gap-1.5 py-1">
            <label class="flex items-center gap-1.5 text-sm text-gray-300 cursor-pointer">
              <input type="radio" name="pf-day-mode" value="continuous" checked class="${radioBase}"> 連続
            </label>
            <label class="flex items-center gap-1.5 text-sm text-gray-300 cursor-pointer">
              <input type="radio" name="pf-day-mode" value="weekday" class="${radioBase}"> 平日のみ
            </label>
            <label class="flex items-center gap-1.5 text-sm text-gray-300 cursor-pointer">
              <input type="radio" name="pf-day-mode" value="all" class="${radioBase}"> 平日+土日+祝日
            </label>
          </div>
        </div>
        <div class="flex-1">
          <label class="text-xs text-gray-400 block mb-1">計画図番割当</label>
          <div class="flex flex-col gap-1.5 py-1">
            <label class="flex items-center gap-1.5 text-sm text-gray-300 cursor-pointer">
              <input type="radio" name="pf-drawing-mode" value="sequential" checked class="${radioBase}"> 連番
            </label>
          </div>
        </div>
      </div>

      <div>
        <label class="text-xs text-gray-400 block mb-2">搬入日プレビュー</label>
        <div id="pf-preview" class="bg-gray-800 border border-gray-700 rounded overflow-x-auto">
          ${renderPreviewTable(initialDays)}
        </div>
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

  // イベントバインドは初回のみ（el への委譲なので rerenderでも動作する）
  if (_planFormEventsBound) return;
  _planFormEventsBound = true;

  function getCurrentDayMode() {
    return document.querySelector('input[name="pf-day-mode"]:checked')?.value ?? 'continuous';
  }

  function refreshPreview() {
    const count = Math.max(1, Math.min(30, parseInt(document.getElementById('pf-delivery-days').value) || 1));
    const mode  = getCurrentDayMode();
    const drawingMode = document.querySelector('input[name="pf-drawing-mode"]:checked')?.value ?? 'sequential';
    const days  = adminState.selectedDate ? generateDays(adminState.selectedDate, count, mode) : [];

    // 計画図番割当モードを初期適用
    if (drawingMode === 'sequential') {
      days.forEach((day, i) => { day.drawingNo = String(i + 1); });
    }

    document.getElementById('pf-preview').innerHTML = renderPreviewTable(days);
  }

  el.addEventListener('input', e => {
    if (e.target.id === 'pf-delivery-days') refreshPreview();
  });

  el.addEventListener('change', e => {
    // 日付割当モード変更 → プレビュー全体を再生成
    if (e.target.matches('input[name="pf-day-mode"]')) {
      refreshPreview();
      return;
    }
    // 計画図番割当モード変更 → 既存行の図番だけ書き換え（手修正は保持）
    if (e.target.matches('input[name="pf-drawing-mode"]')) {
      applyDrawingNoMode(e.target.value);
      return;
    }
    // 工事セレクト変更 → 新規入力エリア表示切替
    if (e.target.id === 'pf-project') {
      document.getElementById('pf-new-project-area').classList.toggle('hidden', e.target.value !== '__new__');
      return;
    }
    // プレビュー行の日付変更 → その行以降を再計算
    if (e.target.matches('#pf-preview input[name="date"]')) {
      const row = e.target.closest('tr[data-day-index]');
      if (!row) return;
      recalcFrom(parseInt(row.dataset.dayIndex), e.target.value, getCurrentDayMode());
    }
  });

  el.addEventListener('click', e => {
    if (e.target.id === 'pf-save')   handlePlanFormSave();
    if (e.target.id === 'pf-cancel') goToCalendar();
  });
}

async function handlePlanFormSave() {
  const projectSel = document.getElementById('pf-project').value;

  if (!projectSel) {
    document.getElementById('pf-project').classList.add('ring-1', 'ring-red-500');
    return;
  }

  let projectId = projectSel;

  // 新規工事作成
  if (projectSel === '__new__') {
    const newName = document.getElementById('pf-new-project-name').value.trim();
    if (!newName) {
      document.getElementById('pf-new-project-name').classList.add('ring-1', 'ring-red-500');
      return;
    }
    const created = await createProject({ projectName: newName, isActive: true });
    adminState.projects.push(created);
    projectId = created.id;
  }

  // プレビュー表の各行を読み取る
  const rows = document.querySelectorAll('#pf-preview tr[data-day-index]');
  if (!rows.length) {
    alert('搬入日が1件もありません');
    return;
  }

  const saveBtn = document.getElementById('pf-save');
  saveBtn.disabled = true;
  saveBtn.textContent = '登録中…';

  const affectedMonths = new Set();

  for (const row of rows) {
    const dayIndex     = parseInt(row.dataset.dayIndex);
    const deliveryDate = row.querySelector('input[name="date"]').value;
    const dayLabel     = row.querySelector('input[name="dayLabel"]').value.trim();
    const drawingNo    = row.querySelector('input[name="drawingNo"]').value.trim();

    if (!deliveryDate) continue;

    await createPlan(projectId, {
      deliveryDate,
      dayIndex,
      dayLabel:  dayLabel  || null,
      drawingNo: drawingNo || null,
      status:    'active',
      truckCount: 0,
    });

    const [y, m] = deliveryDate.split('-');
    affectedMonths.add(`${y}-${m}`);
  }

  // 影響月のキャッシュを無効化
  for (const key of affectedMonths) {
    delete adminState.plansCache[key];
  }

  await goToCalendar();
}

// ── Grid (A2) ─────────────────────────────────────────────

async function enterGrid(projectId, planId) {
  const proj = adminState.projects.find(p => p.id === projectId);
  const name = projDisplayName(proj) || projectId;
  showScreen('grid');
  updateHeaderInfo(`
    <span class="text-gray-300 truncate max-w-[200px]">${esc(name)}</span>
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
  // bolt アプリ側の工事一覧をロード（A1 コンボボックス候補 + カレンダー名称表示に使用）
  adminState.projects = await getBoltProjects();

  // イベント bind
  bindCalendarEvents();

  // カレンダー画面から開始
  await goToCalendar();
}
