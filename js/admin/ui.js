// 管理画面 UI / イベント

import { adminState } from './state.js';
import { getTrucksForPlan, getItemsForTruck } from './db.js';
import { sortItems } from '../../packages/shared-domain/src/index.js';

// ── DOM refs ───────────────────────────────────────────────
const elTruckList    = document.getElementById('admin-truck-list');
const elMainGrid     = document.getElementById('admin-main-grid');
const elRightContent = document.getElementById('admin-right-content');
const elHeaderInfo   = document.getElementById('admin-header-info');

// ── Helpers ────────────────────────────────────────────────

const PROGRESS_LABEL = { pending: '未着手', in_progress: '進行中', done: '完了' };
const PROGRESS_CLS   = {
  pending:     'bg-gray-600 text-gray-200',
  in_progress: 'bg-yellow-600 text-yellow-100',
  done:        'bg-green-600 text-green-100',
};

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Render: Header ─────────────────────────────────────────

function renderHeader() {
  const { selectedProjectId, selectedPlanId } = adminState;
  elHeaderInfo.innerHTML = `
    <span class="text-gray-400">${esc(selectedProjectId)}</span>
    <span class="text-gray-600">/</span>
    <span class="text-gray-300">${esc(selectedPlanId)}</span>
  `;
}

// ── Render: Truck List ─────────────────────────────────────

function renderTruckList() {
  const { trucks, selectedTruckId } = adminState;

  if (!trucks.length) {
    elTruckList.innerHTML = '<li class="px-3 py-2 text-xs text-gray-500">号車なし</li>';
    return;
  }

  elTruckList.innerHTML = trucks.map(t => {
    const isSelected = t.id === selectedTruckId;
    const pLabel = PROGRESS_LABEL[t.progressStatus] ?? t.progressStatus ?? '';
    const pCls   = PROGRESS_CLS[t.progressStatus]   ?? 'bg-gray-700 text-gray-300';

    return `
      <li>
        <button
          data-truck-id="${esc(t.id)}"
          class="w-full text-left px-3 py-2.5 flex flex-col gap-0.5 transition-colors
            ${isSelected ? 'bg-blue-700 text-white' : 'hover:bg-gray-700 text-gray-200'}"
        >
          <span class="font-semibold text-sm">${esc(t.truckNo)}号車</span>
          <span class="text-xs ${isSelected ? 'text-blue-200' : 'text-gray-400'} truncate">${esc(t.vehicleType ?? '')}</span>
          <span class="text-xs mt-0.5 px-1.5 py-0.5 rounded inline-block w-fit ${pCls}">${esc(pLabel)}</span>
        </button>
      </li>
    `;
  }).join('');
}

// ── Render: Main Grid ──────────────────────────────────────

function renderMainGrid() {
  const { selectedTruckId, itemsCache, selectedItemId } = adminState;

  if (!selectedTruckId) {
    elMainGrid.innerHTML = '<p class="text-gray-500 text-sm">号車を選択してください</p>';
    return;
  }

  const items = itemsCache[selectedTruckId] ?? [];

  if (!items.length) {
    elMainGrid.innerHTML = '<p class="text-gray-500 text-sm">品目がありません</p>';
    return;
  }

  // カテゴリー別にグループ化（sortItems で sortOrder / 品名順を適用）
  const groups = new Map(); // category => item[]
  for (const item of sortItems(items)) {
    const cat = item.category || 'その他';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(item);
  }

  elMainGrid.innerHTML = [...groups.entries()].map(([cat, catItems]) => `
    <section>
      <h2 class="text-xs font-semibold text-gray-400 tracking-widest uppercase mb-2 px-1 border-b border-gray-700 pb-1">
        ${esc(cat)}
        <span class="ml-2 text-gray-600 font-normal normal-case">${catItems.length}品目</span>
      </h2>
      <div class="grid grid-cols-4 gap-2">
        ${catItems.map(item => renderItemCell(item, item.id === selectedItemId)).join('')}
      </div>
    </section>
  `).join('');
}

function renderItemCell(item, isSelected) {
  const hasDiff = item.diffs?.length > 0;
  const hasCaution = !!item.cautionNote;
  const borderCls = isSelected
    ? 'border-blue-400 bg-blue-900/40 text-white'
    : 'border-gray-600 hover:border-gray-400 bg-gray-800 text-gray-200';

  return `
    <button
      data-item-id="${esc(item.id)}"
      class="relative text-left rounded-md border p-2 transition-colors min-h-[64px] ${borderCls}"
    >
      ${hasDiff    ? '<span class="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-orange-400" title="差分あり"></span>' : ''}
      ${hasCaution ? '<span class="absolute top-1.5 right-4   w-1.5 h-1.5 rounded-full bg-red-400"    title="注意事項あり"></span>' : ''}
      <div class="text-xs font-medium leading-snug line-clamp-2 pr-3">${esc(item.name)}</div>
      <div class="text-xs text-gray-400 mt-1">${esc(item.quantity)}${esc(item.unit)}</div>
    </button>
  `;
}

// ── Render: Right Panel ────────────────────────────────────

function renderRightPanel() {
  const { selectedTruckId, selectedItemId, itemsCache } = adminState;

  if (!selectedItemId) {
    elRightContent.innerHTML = '<p class="text-sm text-gray-500">品目を選択してください</p>';
    return;
  }

  const items = itemsCache[selectedTruckId] ?? [];
  const item  = items.find(i => i.id === selectedItemId);

  if (!item) {
    elRightContent.innerHTML = '<p class="text-sm text-gray-500">品目が見つかりません</p>';
    return;
  }

  const rows = [
    ['品名',       item.name],
    ['数量',       `${item.quantity} ${item.unit}`],
    ['カテゴリー', item.category || '—'],
    ['チェック',   item.checked ? '済' : '未'],
    ['注意事項',   item.cautionNote || '—'],
    ['積込指示',   item.loadingInstruction || '—'],
    ['並び順',     item.sortOrder ?? '—'],
  ];

  const diffsHtml = item.diffs?.length
    ? item.diffs.map(d =>
        `<span class="inline-block text-xs bg-orange-700 text-orange-100 px-1.5 py-0.5 rounded mr-1 mb-1">${esc(d.date)} ${esc(d.type)}</span>`
      ).join('')
    : '<span class="text-gray-500 text-xs">なし</span>';

  elRightContent.innerHTML = `
    <dl class="space-y-3">
      ${rows.map(([label, value]) => `
        <div>
          <dt class="text-xs text-gray-400 mb-0.5">${esc(label)}</dt>
          <dd class="text-sm text-gray-100 break-words">${esc(String(value ?? '—'))}</dd>
        </div>
      `).join('')}
      <div>
        <dt class="text-xs text-gray-400 mb-1">差分</dt>
        <dd>${diffsHtml}</dd>
      </div>
    </dl>
  `;
}

// ── Actions ────────────────────────────────────────────────

async function selectTruck(truckId) {
  adminState.selectedTruckId = truckId;
  adminState.selectedItemId  = null;

  if (!adminState.itemsCache[truckId]) {
    const items = await getItemsForTruck(
      adminState.selectedProjectId,
      adminState.selectedPlanId,
      truckId,
    );
    adminState.itemsCache[truckId] = items;
  }

  renderTruckList();
  renderMainGrid();
  renderRightPanel();
}

function selectItem(itemId) {
  adminState.selectedItemId = itemId;
  renderMainGrid();
  renderRightPanel();
}

// ── Event Delegation ───────────────────────────────────────

function bindEvents() {
  elTruckList.addEventListener('click', e => {
    const btn = e.target.closest('[data-truck-id]');
    if (btn) selectTruck(btn.dataset.truckId);
  });

  elMainGrid.addEventListener('click', e => {
    const cell = e.target.closest('[data-item-id]');
    if (cell) selectItem(cell.dataset.itemId);
  });
}

// ── Init ───────────────────────────────────────────────────

export async function initAdmin() {
  renderHeader();
  bindEvents();

  const trucks = await getTrucksForPlan(
    adminState.selectedProjectId,
    adminState.selectedPlanId,
  );
  adminState.trucks = trucks;

  // 最初の号車を自動選択
  if (trucks.length > 0 && !adminState.selectedTruckId) {
    await selectTruck(trucks[0].id);
  } else {
    renderTruckList();
    renderMainGrid();
    renderRightPanel();
  }
}
