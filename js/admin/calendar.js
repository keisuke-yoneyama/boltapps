// 管理画面 カレンダー + 計画登録フォーム

import { adminState } from './state.js';
import {
  getBoltProjects,
  getPlansForMonth,
  createPlan,
  createProject,
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

// ══════════════════════════════════════════════════════════
// Screen management
// ══════════════════════════════════════════════════════════

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
    gridEl.innerHTML = '<p class="text-center text-gray-500 py-6 col-span-7">読み込み中…</p>';
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

  const plansByDate = {};
  for (const plan of plans) {
    if (!plan.deliveryDate) continue;
    if (!plansByDate[plan.deliveryDate]) plansByDate[plan.deliveryDate] = [];
    const proj = boltProjects.find(p => p.id === plan.projectId);
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
  for (let i = 0; i < firstDay; i++) html += '<div class="min-h-[72px]"></div>';

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
// A1: Plan Form — state.a1 ベース
//
// dateAssignMode enum:
//   'all_days'         … 連続（土日含む全日）
//   'weekday_only'     … 平日のみ（土日スキップ）
//   'all_days_holiday' … 平日+土日+祝日（将来の祝日スキップ用。現状は all_days と同じ）
//
// drawingAssignMode enum:
//   'serial' … 連番（1, 2, 3…）。将来拡張予定。
// ══════════════════════════════════════════════════════════

// ── state 更新 ─────────────────────────────────────────────

function updateA1FormField(field, value) {
  adminState.a1.form[field] = value;
}

function updateA1PreviewCell(rowIndex, field, value) {
  if (adminState.a1.previewRows[rowIndex]) {
    adminState.a1.previewRows[rowIndex][field] = value;
  }
}

// ── 再計算ロジック ─────────────────────────────────────────

/**
 * dateStr の翌日から dateAssignMode に従った次の有効日を返す
 * @param {string} dateStr 'YYYY-MM-DD'
 * @param {'all_days'|'weekday_only'|'all_days_holiday'} mode
 * @returns {string} 翌有効日 'YYYY-MM-DD'
 */
function getNextDateByMode(dateStr, mode) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const next = new Date(y, mo - 1, d + 1);

  if (mode === 'weekday_only') {
    while (next.getDay() === 0 || next.getDay() === 6) {
      next.setDate(next.getDate() + 1);
    }
  }
  // 'all_days_holiday': 将来の祝日スキップをここに追加

  return toDateStr(next);
}

/**
 * 搬入日プレビュー行を全生成する
 * @param {{ startDate, deliveryDays, dateAssignMode, drawingAssignMode }} params
 * @returns {{ deliveryDay, deliveryDate, dayLabel, drawingNo }[]}
 */
function buildA1PreviewRows({ startDate, deliveryDays, dateAssignMode, drawingAssignMode }) {
  const rows = [];
  const [y, mo, d] = startDate.split('-').map(Number);
  const firstDay = new Date(y, mo - 1, d);

  // 開始日自体が無効な場合に最初の有効日まで進める
  if (dateAssignMode === 'weekday_only') {
    while (firstDay.getDay() === 0 || firstDay.getDay() === 6) {
      firstDay.setDate(firstDay.getDate() + 1);
    }
  }
  // 'all_days_holiday': 将来の祝日スキップをここに追加

  let curDate = toDateStr(firstDay);

  for (let i = 0; i < deliveryDays; i++) {
    rows.push({
      deliveryDay:  i + 1,
      deliveryDate: curDate,
      dayLabel:     `搬入${i + 1}日目`,
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
 * rowIndex 行の日付を newDate に設定し、後続行のみ dateAssignMode に従って再計算する
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
    const el = document.querySelector(`#pf-preview tr[data-row-index="${i}"] input[name="deliveryDate"]`);
    if (el) el.value = adminState.a1.previewRows[i].deliveryDate;
  }
}

/**
 * drawingAssignMode に従い drawingNo を更新する
 * state と DOM の両方を更新する（現在は 'serial' のみ実装）
 */
function applyDrawingAssignMode() {
  const { drawingAssignMode } = adminState.a1.form;
  if (drawingAssignMode !== 'serial') return;

  adminState.a1.previewRows.forEach((row, i) => {
    row.drawingNo = String(i + 1);
    const el = document.querySelector(`#pf-preview tr[data-row-index="${i}"] input[name="drawingNo"]`);
    if (el) el.value = row.drawingNo;
  });
}

// ── イベントハンドラ ──────────────────────────────────────

function handleA1DeliveryDaysChange(value) {
  updateA1FormField('deliveryDays', Math.max(1, Math.min(30, parseInt(value) || 1)));
  regenerateA1PreviewRows();
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
  updateA1FormField('drawingAssignMode', value);
  applyDrawingAssignMode();
}

function handleA1PreviewDateChange(rowIndex, value) {
  reflowA1DatesFromRow(rowIndex, value);
}

function handleA1PreviewDayLabelChange(rowIndex, value) {
  updateA1PreviewCell(rowIndex, 'dayLabel', value);
}

function handleA1PreviewDrawingNoChange(rowIndex, value) {
  updateA1PreviewCell(rowIndex, 'drawingNo', value);
}

// ── 描画 ─────────────────────────────────────────────────

/**
 * 工事選択コンボの <option> HTML を返す
 * bolt アプリ側の工事一覧を候補にする
 */
function renderBoltProjectOptions() {
  const { boltProjects, form } = adminState.a1;
  return [
    '<option value="">— 工事を選択 —</option>',
    ...boltProjects.map(p =>
      `<option value="${esc(p.id)}"${p.id === form.projectId ? ' selected' : ''}>${esc(projDisplayName(p) || p.id)}</option>`
    ),
    `<option value="__new__"${'__new__' === form.projectId ? ' selected' : ''}>＋ 新規工事を作成…</option>`,
  ].join('');
}

/**
 * A1 上部（工事選択・開始日・日数・モード）の HTML を返す
 */
function renderA1HeaderSection() {
  const { form } = adminState.a1;
  const inp       = 'w-full bg-gray-700 text-gray-100 rounded px-3 py-2 text-sm';
  const radioBase = 'accent-blue-500';
  const isNewProj = form.projectId === '__new__';

  const [, m, d]    = form.startDate.split('-');
  const startLabel  = `${parseInt(m)}月${parseInt(d)}日`;

  const dayModes = [
    ['all_days',         '連続'],
    ['weekday_only',     '平日のみ'],
    ['all_days_holiday', '平日+土日+祝日'],
  ];

  return `
    <div>
      <label class="text-xs text-gray-400 block mb-1">工事 <span class="text-red-400">*</span></label>
      <select id="pf-project" class="${inp}">${renderBoltProjectOptions()}</select>
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
        <input id="pf-delivery-days" type="number" min="1" max="30"
          value="${form.deliveryDays}" class="${inp}">
      </div>
      <div class="flex-1">
        <label class="text-xs text-gray-400 block mb-1">日付割当モード</label>
        <div class="flex flex-col gap-1.5 py-1">
          ${dayModes.map(([val, label]) => `
            <label class="flex items-center gap-1.5 text-sm text-gray-300 cursor-pointer">
              <input type="radio" name="pf-day-mode" value="${val}"
                ${form.dateAssignMode === val ? 'checked' : ''} class="${radioBase}">
              ${label}
            </label>`).join('')}
        </div>
      </div>
      <div class="flex-1">
        <label class="text-xs text-gray-400 block mb-1">計画図番割当</label>
        <div class="flex flex-col gap-1.5 py-1">
          <label class="flex items-center gap-1.5 text-sm text-gray-300 cursor-pointer">
            <input type="radio" name="pf-drawing-mode" value="serial"
              ${form.drawingAssignMode === 'serial' ? 'checked' : ''} class="${radioBase}">
            連番
          </label>
        </div>
      </div>
    </div>`;
}

/**
 * previewRows の <tr> 列 HTML を返す（#pf-preview 内のテーブルに使う）
 */
function renderA1PreviewRows() {
  const { previewRows } = adminState.a1;
  const inp = 'bg-gray-700 text-gray-100 rounded px-2 py-1 text-xs w-full';

  return previewRows.map(({ deliveryDay, deliveryDate, dayLabel, drawingNo }, i) => `
    <tr data-row-index="${i}" class="border-t border-gray-700">
      <td class="px-2 py-1.5 text-xs text-gray-400 text-center whitespace-nowrap select-none">${deliveryDay}</td>
      <td class="px-2 py-1.5">
        <input type="date" name="deliveryDate" value="${esc(deliveryDate)}" class="${inp}">
      </td>
      <td class="px-2 py-1.5">
        <input type="text" name="dayLabel" value="${esc(dayLabel)}" class="${inp}" placeholder="日名称">
      </td>
      <td class="px-2 py-1.5">
        <input type="text" name="drawingNo" value="${esc(drawingNo)}" class="${inp}" placeholder="1">
      </td>
    </tr>`).join('');
}

/**
 * #pf-preview の innerHTML として入れるテーブル HTML を返す（private）
 */
function buildPreviewTableHTML() {
  const { previewRows } = adminState.a1;
  if (!previewRows.length) return '<p class="text-xs text-gray-500 p-3">（日付なし）</p>';
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
        <button id="pf-save"
          class="flex-1 bg-blue-700 hover:bg-blue-600 text-white py-2 rounded text-sm font-medium">
          登録
        </button>
        <button id="pf-cancel"
          class="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded text-sm">
          キャンセル
        </button>
      </div>
    </div>`;

  bindPlanFormEvents();
}

// ── イベントバインド ──────────────────────────────────────

// el への委譲で一度だけバインドする（re-render 後も動作する）
let _planFormEventsBound = false;

function bindPlanFormEvents() {
  const el = document.getElementById('admin-plan-form-content');
  if (!el || _planFormEventsBound) return;
  _planFormEventsBound = true;

  // change: select / radio / date input
  el.addEventListener('change', e => {
    if (e.target.matches('input[name="pf-day-mode"]')) {
      handleA1DateAssignModeChange(e.target.value);
      return;
    }
    if (e.target.matches('input[name="pf-drawing-mode"]')) {
      handleA1DrawingAssignModeChange(e.target.value);
      return;
    }
    if (e.target.id === 'pf-project') {
      updateA1FormField('projectId', e.target.value);
      document.getElementById('pf-new-project-area')
        .classList.toggle('hidden', e.target.value !== '__new__');
      return;
    }
    if (e.target.matches('#pf-preview input[name="deliveryDate"]')) {
      const row = e.target.closest('tr[data-row-index]');
      if (row) handleA1PreviewDateChange(parseInt(row.dataset.rowIndex), e.target.value);
    }
  });

  // input: number / text（即時反映）
  el.addEventListener('input', e => {
    if (e.target.id === 'pf-delivery-days') {
      handleA1DeliveryDaysChange(e.target.value);
      return;
    }
    if (e.target.id === 'pf-new-project-name') {
      updateA1FormField('newProjectName', e.target.value);
      return;
    }
    if (e.target.matches('#pf-preview input[name="dayLabel"]')) {
      const row = e.target.closest('tr[data-row-index]');
      if (row) handleA1PreviewDayLabelChange(parseInt(row.dataset.rowIndex), e.target.value);
      return;
    }
    if (e.target.matches('#pf-preview input[name="drawingNo"]')) {
      const row = e.target.closest('tr[data-row-index]');
      if (row) handleA1PreviewDrawingNoChange(parseInt(row.dataset.rowIndex), e.target.value);
    }
  });

  // click: ボタン
  el.addEventListener('click', e => {
    if (e.target.id === 'pf-save')   handlePlanFormSave();
    if (e.target.id === 'pf-cancel') goToCalendar();
  });
}

// ── 保存 ─────────────────────────────────────────────────

/**
 * previewRow を createPlan に渡す planData に変換する
 * @param {{ deliveryDay, deliveryDate, dayLabel, drawingNo }} row
 */
function previewRowToPlanData(row) {
  return {
    deliveryDate: row.deliveryDate,
    dayIndex:     row.deliveryDay,
    dayLabel:     row.dayLabel  || null,
    drawingNo:    row.drawingNo || null,
    status:       'active',
    truckCount:   0,
  };
}

async function handlePlanFormSave() {
  // 登録本体は state.a1.previewRows。DOM からは読まない。
  const { form, previewRows } = adminState.a1;

  if (!form.projectId) {
    document.getElementById('pf-project').classList.add('ring-1', 'ring-red-500');
    return;
  }

  let projectId = form.projectId;

  if (form.projectId === '__new__') {
    if (!form.newProjectName.trim()) {
      document.getElementById('pf-new-project-name').classList.add('ring-1', 'ring-red-500');
      return;
    }
    const created = await createProject({ projectName: form.newProjectName.trim(), isActive: true });
    adminState.a1.boltProjects.push(created);
    projectId = created.id;
  }

  if (!previewRows.length) {
    alert('搬入日が1件もありません');
    return;
  }

  const saveBtn = document.getElementById('pf-save');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '登録中…'; }

  const affectedMonths = new Set();

  for (const row of previewRows) {
    if (!row.deliveryDate) continue;
    await createPlan(projectId, previewRowToPlanData(row));
    const [y, mo] = row.deliveryDate.split('-');
    affectedMonths.add(`${y}-${mo}`);
  }

  for (const key of affectedMonths) delete adminState.plansCache[key];

  await goToCalendar();
}

// ── 入口 ─────────────────────────────────────────────────

/**
 * bolt 工事一覧を a1.boltProjects にロードする（未ロードの場合のみ取得）
 */
async function loadA1BoltProjects() {
  if (adminState.a1.boltProjects.length > 0) return;
  adminState.a1.boltProjects = await getBoltProjects();
}

/**
 * A1 表示前に state.a1 を初期化する（showPlanForm から毎回呼ぶ）
 * @param {string} startDate 'YYYY-MM-DD'
 */
function initializeA1State(startDate) {
  adminState.a1.form = {
    projectId:         '',
    newProjectName:    '',
    startDate,
    deliveryDays:      1,
    dateAssignMode:    'all_days',
    drawingAssignMode: 'serial',
  };
  adminState.a1.previewRows = buildA1PreviewRows({
    startDate,
    deliveryDays:      1,
    dateAssignMode:    'all_days',
    drawingAssignMode: 'serial',
  });
}

function showPlanForm(dateStr) {
  if (dateStr) adminState.selectedDate = dateStr;
  const startDate = adminState.selectedDate || toDateStr(new Date());
  initializeA1State(startDate);
  showScreen('plan-form');
  updateHeaderInfo('<span class="text-gray-400">搬入計画 登録</span>');
  renderPlanForm();
}

// ══════════════════════════════════════════════════════════
// A2: Grid
// ══════════════════════════════════════════════════════════

async function enterGrid(projectId, planId) {
  const proj = adminState.a1.boltProjects.find(p => p.id === projectId);
  const name = projDisplayName(proj) || projectId;
  showScreen('grid');
  updateHeaderInfo(`
    <span class="text-gray-300 truncate max-w-[200px]">${esc(name)}</span>
    <span class="text-gray-600">/</span>
    <span class="text-gray-500 text-xs">${esc(planId)}</span>`);
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
}

// ══════════════════════════════════════════════════════════
// Init
// ══════════════════════════════════════════════════════════

export async function initAdminApp() {
  await loadA1BoltProjects(); // カレンダー名称表示 + A1 コンボ候補
  bindCalendarEvents();
  await goToCalendar();
}
