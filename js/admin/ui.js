// 管理画面 UI / イベント

import { adminState, addItemToState, updateItemInState, removeItemFromState } from './state.js';
import { getTrucksForPlan, getItemsForTruck, createItem, updateItem, deleteItem } from './db.js';
import { sortItems, buildItemName } from '../../packages/shared-domain/src/index.js';

// ── 種別順（ボルトアプリ準拠） ─────────────────────────────
const CATEGORY_ORDER = [
  '大梁', '小梁', 'ブレース', '柱', '根巻き柱脚', 'ランナー', 'スタッド',
  'スプライスプレート', 'ガセット', 'エンドプレート',
  '高力ボルト', 'アンカーボルト', 'デッキプレート', 'その他',
];

function sortedGroups(groups) {
  return [...groups.entries()].sort(([a], [b]) => {
    const ai = CATEGORY_ORDER.indexOf(a);
    const bi = CATEGORY_ORDER.indexOf(b);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return a.localeCompare(b, 'ja');
  });
}

// ── DOM refs ───────────────────────────────────────────────
const elTruckList    = document.getElementById('admin-truck-list');
const elMainGrid     = document.getElementById('admin-main-grid');
const elRightContent = document.getElementById('admin-right-content');
const elHeaderInfo   = document.getElementById('admin-header-info');

// ── Helpers ────────────────────────────────────────────────

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getItemDisplayName(item) {
  if (item.nameParts) return buildItemName(item.nameParts);
  return item.name || item.itemName || item.itemCode || '品目名不明';
}

// ── Right Panel: draft state ───────────────────────────────

let _diffDraft = [];
let _bulkDraft = []; // { name: string, nameParts: object }[]
let _inputHistoryTab  = 'input'; // 'input' | 'history'
let _pendingRestoreEntry = null;

function _diffDraftListHtml() {
  if (!_diffDraft.length) return '<span class="text-xs text-gray-500">差分なし</span>';
  return _diffDraft.map((d, i) => `
    <div class="flex items-center gap-1 mb-1">
      <span class="text-xs text-gray-300 flex-1">${esc(d.date)} ${esc(d.type)}</span>
      <button data-remove-diff="${i}" class="text-xs text-red-400 hover:text-red-300 px-1 leading-none">✕</button>
    </div>
  `).join('');
}

// ── History: localStorage ──────────────────────────────────

const HISTORY_KEY = 'admin_input_history';
const HISTORY_MAX = 50;

function _loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]'); }
  catch { return []; }
}

function _saveToHistory(entry) {
  const list = _loadHistory();
  list.unshift(entry);
  if (list.length > HISTORY_MAX) list.splice(HISTORY_MAX);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
}

function _deleteFromHistory(idx) {
  const list = _loadHistory();
  list.splice(idx, 1);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
}

function _historyDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function _historyListHtml(mode) {
  const all  = _loadHistory();
  const rows = all.map((e, i) => ({ e, i })).filter(({ e }) => e.mode === mode);
  if (!rows.length) return '<p class="text-xs text-gray-500 px-1 py-2">履歴がありません</p>';
  return rows.map(({ e, i }) => `
    <div class="flex items-center gap-1 py-1 border-b border-gray-800 last:border-0">
      <div class="flex-1 min-w-0 cursor-pointer rounded px-1 py-0.5 hover:bg-gray-800"
           data-history-apply="${i}">
        <div class="text-xs text-gray-200 truncate">${esc(e.displayName)}</div>
        <div class="text-xs text-gray-600">${esc(e.category || '—')} · ${_historyDate(e.savedAt)}</div>
      </div>
      <button data-history-del="${i}"
        class="text-xs text-red-400 hover:text-red-300 px-1 shrink-0 leading-none">✕</button>
    </div>
  `).join('');
}

function _applyHistoryEntry(entry) {
  _pendingRestoreEntry = entry;
  _inputHistoryTab     = 'input';
  adminState.rightPanelMode = entry.mode === 'bulk' ? 'bulk' : 'new';
  renderRightPanel();
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

    return `
      <li>
        <button
          data-truck-id="${esc(t.id)}"
          class="w-full text-left px-3 py-2.5 flex flex-col gap-0.5 transition-colors
            ${isSelected ? 'bg-blue-700 text-white' : 'hover:bg-gray-700 text-gray-200'}"
        >
          <span class="font-semibold text-sm">${esc(t.truckNo)}号車</span>
          <span class="text-xs ${isSelected ? 'text-blue-200' : 'text-gray-400'} truncate">${esc(t.vehicleType ?? '')}</span>
        </button>
      </li>
    `;
  }).join('');
}

// ── Render: Main Grid ──────────────────────────────────────

function renderMainGrid() {
  const { selectedTruckId, itemsCache, selectedItemId, multiSelectedItemIds } = adminState;

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
  const groups = new Map();
  for (const item of sortItems(items)) {
    const cat = item.category || 'その他';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(item);
  }

  const multiSet = new Set(multiSelectedItemIds);

  elMainGrid.innerHTML = sortedGroups(groups).map(([cat, catItems]) => `
    <section class="pb-2">
      <h2 class="sticky top-0 z-10 bg-gray-900 text-sm font-semibold text-gray-200 px-1 py-2 mb-3 border-b border-gray-700 flex items-center gap-1">
        ${esc(cat)}<span class="text-xs text-gray-500 font-normal">（${catItems.length}）</span>
      </h2>
      <div class="grid grid-cols-4 gap-2">
        ${catItems.map(item => renderItemCell(
          item,
          item.id === selectedItemId,
          multiSet.has(item.id) && item.id !== selectedItemId
        )).join('')}
      </div>
    </section>
  `).join('');
}

function renderItemCell(item, isPrimary, isMulti) {
  const hasDiff    = item.diffs?.length > 0;
  const hasCaution = !!item.cautionNote;
  const hasLoading = !!item.loadingInstruction;

  let borderCls;
  if (isPrimary) {
    borderCls = 'border-blue-400 bg-blue-900/60 ring-1 ring-blue-400 text-white';
  } else if (isMulti) {
    borderCls = 'border-blue-700 bg-blue-900/20 text-blue-100';
  } else {
    borderCls = 'border-gray-600 hover:border-gray-400 bg-gray-800 text-gray-200';
  }

  const name = getItemDisplayName(item);

  return `
    <button
      data-item-id="${esc(item.id)}"
      class="relative text-left rounded-md border p-2 transition-colors min-h-[64px] ${borderCls}"
    >
      ${hasDiff    ? '<span class="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-orange-400" title="差分あり"></span>'    : ''}
      ${hasCaution ? '<span class="absolute top-1.5 right-4   w-1.5 h-1.5 rounded-full bg-red-400"    title="注意事項あり"></span>' : ''}
      ${hasLoading ? '<span class="absolute top-1.5 right-7   w-1.5 h-1.5 rounded-full bg-blue-400"   title="積込指示あり"></span>' : ''}
      <div class="text-xs font-medium leading-snug line-clamp-2 pr-9">${esc(name)}</div>
      ${item.quantity != null ? `<div class="text-xs text-gray-400 mt-1">${esc(item.quantity)}${esc(item.unit ?? '')}</div>` : ''}
    </button>
  `;
}

// ── Render: Right Panel ────────────────────────────────────

function renderRightPanel() {
  const { rightPanelMode, selectedTruckId, selectedItemId, itemsCache } = adminState;

  const items = selectedTruckId ? (itemsCache[selectedTruckId] ?? []) : [];
  const item  = selectedItemId  ? items.find(i => i.id === selectedItemId) : null;

  if (rightPanelMode === 'view' && item) {
    _renderViewPanel(item);
  } else if (rightPanelMode === 'edit' && item) {
    _renderFormPanel('edit', item);
  } else if (rightPanelMode === 'new') {
    _renderFormPanel('new', null);
  } else if (rightPanelMode === 'bulk') {
    _renderBulkPanel();
  } else {
    // idle
    elRightContent.innerHTML = selectedTruckId ? `
      <div class="space-y-3">
        <p class="text-sm text-gray-500">品目を選択してください</p>
        <p class="text-xs text-gray-600">または新規登録を開始してください</p>
        <button data-rp-action="new"
          class="w-full text-sm bg-blue-700 hover:bg-blue-600 text-white py-2 rounded font-medium">
          ＋ 新規登録
        </button>
      </div>
    ` : `
      <p class="text-sm text-gray-500">号車を選択してください</p>
    `;
  }
}

function _renderViewPanel(item) {
  const name  = getItemDisplayName(item);
  const diffs = item.diffs ?? [];

  const diffsHtml = diffs.length
    ? diffs.map(d =>
        `<span class="inline-block text-xs bg-orange-700 text-orange-100 px-1.5 py-0.5 rounded mr-1 mb-1">${esc(d.date)} ${esc(d.type)}</span>`
      ).join('')
    : '<span class="text-gray-500 text-xs">なし</span>';

  const rows = [
    ['品名',       name],
    ['数量',       `${item.quantity ?? ''} ${item.unit ?? ''}`],
    ['カテゴリー', item.category || '—'],
    ['チェック',   item.checked ? '済' : '未'],
    ['注意事項',   item.cautionNote || '—'],
    ['積込指示',   item.loadingInstruction || '—'],
    ['並び順',     item.sortOrder ?? '—'],
  ];

  elRightContent.innerHTML = `
    <div class="flex gap-1.5 mb-4">
      <button data-rp-action="edit"
        class="flex-1 text-xs bg-gray-700 hover:bg-gray-600 text-white py-1.5 rounded">
        編集
      </button>
      <button data-rp-action="new"
        class="flex-1 text-xs bg-blue-700 hover:bg-blue-600 text-white py-1.5 rounded">
        ＋ 新規
      </button>
      <button data-rp-action="delete"
        class="text-xs bg-red-900 hover:bg-red-800 text-red-200 px-2.5 py-1.5 rounded">
        削除
      </button>
    </div>
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

function _renderFormPanel(mode, item) {
  const isEdit  = mode === 'edit';
  const restore = _pendingRestoreEntry;
  _pendingRestoreEntry = null;

  const np  = item?.nameParts ?? {};
  const inp = (extra = '') =>
    `w-full bg-gray-700 text-gray-100 rounded px-2 py-1 mt-0.5 text-sm ${extra}`;

  const defPrefix    = restore?.prefix             ?? np.prefix?.value    ?? '';
  const defBaseName  = restore?.baseName           ?? np.baseName?.value  ?? item?.name ?? '';
  const defSeparator = restore?.separator          ?? np.separator?.value ?? '-';
  const defSuffix    = restore?.suffix             ?? np.suffix?.value    ?? '';
  const defNote      = restore?.note               ?? np.note?.value      ?? '';
  const defCategory  = restore?.category           ?? item?.category      ?? '';
  const defCaution   = restore?.cautionNote        ?? item?.cautionNote   ?? '';
  const defLoading   = restore?.loadingInstruction ?? item?.loadingInstruction ?? '';

  const showTabs  = !isEdit;
  const isHistTab = showTabs && _inputHistoryTab === 'history';

  const catOptions = CATEGORY_ORDER.map(c =>
    `<option value="${esc(c)}" ${defCategory === c ? 'selected' : ''}>${esc(c)}</option>`
  ).join('');

  elRightContent.innerHTML = `
    ${showTabs ? `
      <div class="flex gap-0.5 mb-2 bg-gray-900 rounded-md p-0.5">
        <button data-rp-action="mode-single"
          class="flex-1 text-xs py-1 rounded bg-gray-600 text-white font-medium">単品</button>
        <button data-rp-action="mode-bulk"
          class="flex-1 text-xs py-1 rounded text-gray-400 hover:text-gray-200">一括</button>
      </div>
      <div class="flex gap-0.5 mb-3 bg-gray-900 rounded-md p-0.5">
        <button data-rp-action="history-tab-input"
          class="flex-1 text-xs py-1 rounded ${!isHistTab ? 'bg-gray-600 text-white font-medium' : 'text-gray-400 hover:text-gray-200'}">入力</button>
        <button data-rp-action="history-tab-history"
          class="flex-1 text-xs py-1 rounded ${isHistTab ? 'bg-gray-600 text-white font-medium' : 'text-gray-400 hover:text-gray-200'}">履歴</button>
      </div>
    ` : ''}

    ${!isHistTab ? `
      <div class="flex gap-1.5 mb-4">
        <button data-rp-action="save"
          class="flex-1 text-xs ${isEdit ? 'bg-green-700 hover:bg-green-600' : 'bg-blue-700 hover:bg-blue-600'} text-white py-1.5 rounded font-medium">
          ${isEdit ? '更新' : '登録'}
        </button>
        <button data-rp-action="cancel"
          class="flex-1 text-xs bg-gray-700 hover:bg-gray-600 text-white py-1.5 rounded">
          キャンセル
        </button>
        ${isEdit ? `
          <button data-rp-action="delete"
            class="text-xs bg-red-900 hover:bg-red-800 text-red-200 px-2.5 py-1.5 rounded">
            削除
          </button>
        ` : ''}
      </div>

      <div class="space-y-2.5 text-sm">
        <div>
          <label class="text-xs text-gray-400">カテゴリー</label>
          <select id="rp-category" class="${inp()}">
            <option value="">— 未選択 —</option>
            ${catOptions}
          </select>
        </div>

        <hr class="border-gray-700 my-1">
        <p class="text-xs font-semibold text-gray-400 tracking-widest">品名パーツ</p>

        <div>
          <label class="text-xs text-gray-400">接頭</label>
          <input id="rp-prefix" type="text" value="${esc(defPrefix)}"
            class="${inp()}" placeholder="例: 2S">
        </div>
        <div>
          <label class="text-xs text-gray-400">品名 <span class="text-red-400">*</span></label>
          <input id="rp-baseName" type="text" value="${esc(defBaseName)}"
            class="${inp()}" placeholder="例: G500">
        </div>
        <div class="flex gap-1.5">
          <div class="w-20 shrink-0">
            <label class="text-xs text-gray-400">区切り</label>
            <input id="rp-separator" type="text" value="${esc(defSeparator)}"
              class="${inp()}" placeholder="-">
          </div>
          <div class="flex-1">
            <label class="text-xs text-gray-400">枝番</label>
            <input id="rp-suffix" type="text" value="${esc(defSuffix)}"
              class="${inp()}" placeholder="例: 1">
          </div>
        </div>
        <div>
          <label class="text-xs text-gray-400">補足</label>
          <input id="rp-note" type="text" value="${esc(defNote)}"
            class="${inp()}" placeholder="×4 など">
        </div>

        <hr class="border-gray-700 my-1">

        <div>
          <label class="text-xs text-gray-400">注意事項</label>
          <textarea id="rp-cautionNote" rows="2"
            class="${inp('resize-none')}"
            placeholder="注意事項">${esc(defCaution)}</textarea>
        </div>
        <div>
          <label class="text-xs text-gray-400">積込指示</label>
          <textarea id="rp-loadingInstruction" rows="2"
            class="${inp('resize-none')}"
            placeholder="積込指示">${esc(defLoading)}</textarea>
        </div>

        <hr class="border-gray-700 my-1">
        <p class="text-xs font-semibold text-gray-400 tracking-widest">差分</p>

        <div id="rp-diff-list" class="mb-1">${_diffDraftListHtml()}</div>
        <div class="flex gap-1">
          <input id="rp-diff-date" type="date"
            class="flex-1 bg-gray-700 text-gray-100 rounded px-2 py-1 text-xs">
          <select id="rp-diff-type"
            class="bg-gray-700 text-gray-100 rounded px-2 py-1 text-xs">
            <option value="追加">追加</option>
            <option value="変更">変更</option>
            <option value="削除">削除</option>
          </select>
          <button data-rp-action="diff-add"
            class="text-xs bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded">＋</button>
        </div>
      </div>
    ` : `
      <div class="flex gap-1.5 mb-3">
        <button data-rp-action="cancel"
          class="flex-1 text-xs bg-gray-700 hover:bg-gray-600 text-white py-1.5 rounded">
          キャンセル
        </button>
      </div>
      <div id="rp-history-list" class="space-y-0.5">
        ${_historyListHtml('single')}
      </div>
    `}
  `;
}

// ── Right Panel: form helpers ──────────────────────────────

function _readFormData() {
  const q = id => elRightContent.querySelector(id);
  return {
    prefix:             q('#rp-prefix')?.value.trim()             ?? '',
    baseName:           q('#rp-baseName')?.value.trim()           ?? '',
    separator:          q('#rp-separator')?.value                 ?? '-',
    suffix:             q('#rp-suffix')?.value.trim()             ?? '',
    note:               q('#rp-note')?.value.trim()               ?? '',
    category:           q('#rp-category')?.value                  ?? '',
    cautionNote:        q('#rp-cautionNote')?.value.trim()        ?? '',
    loadingInstruction: q('#rp-loadingInstruction')?.value.trim() ?? '',
  };
}

// ── Bulk: helpers ──────────────────────────────────────────

function _readBulkFormData() {
  const q = id => elRightContent.querySelector(id);
  return {
    category:      q('#rp-bulk-category')?.value        ?? '',
    prefix:        q('#rp-bulk-prefix')?.value.trim()   ?? '',
    baseName:      q('#rp-bulk-baseName')?.value.trim() ?? '',
    separator:     q('#rp-bulk-separator')?.value       ?? '-',
    suffixStart:   q('#rp-bulk-suffixStart')?.value     ?? '1',
    note:          q('#rp-bulk-note')?.value.trim()     ?? '',
    count:         q('#rp-bulk-count')?.value           ?? '3',
    autoIncrement: q('#rp-bulk-auto')?.checked          ?? true,
  };
}

function _generateBulkItems(f) {
  const count    = Math.min(30, Math.max(2, parseInt(f.count) || 3));
  const startNum = parseInt(f.suffixStart) || 1;
  return Array.from({ length: count }, (_, i) => {
    const suffixVal = f.autoIncrement ? String(startNum + i) : f.suffixStart;
    const nameParts = {
      prefix:    { value: f.prefix },
      baseName:  { value: f.baseName },
      separator: { value: f.separator || '-' },
      suffix:    { value: suffixVal },
      note:      { value: f.note },
    };
    return { nameParts, name: buildItemName(nameParts) };
  });
}

function _updateBulkPreview() {
  const el = elRightContent.querySelector('#rp-bulk-preview');
  if (!el) return;
  const f = _readBulkFormData();
  if (!f.baseName) {
    _bulkDraft = [];
    el.innerHTML = '<p class="text-xs text-gray-600">品名を入力すると一覧が表示されます</p>';
    return;
  }
  // フォーム変更時はドラフトを再生成（手動編集は上書きされる）
  _bulkDraft = _generateBulkItems(f);
  _renderBulkDraftList();
}

function _renderBulkDraftList() {
  const el = elRightContent.querySelector('#rp-bulk-preview');
  if (!el) return;
  if (!_bulkDraft.length) {
    el.innerHTML = '<p class="text-xs text-gray-500">行がありません</p>';
    return;
  }
  el.innerHTML = _bulkDraft.map((item, i) => `
    <div class="flex items-center gap-1 py-0.5 border-b border-gray-800 last:border-0" data-bulk-row="${i}">
      <span class="text-xs text-gray-500 w-5 text-right shrink-0">${i + 1}</span>
      <span class="text-xs text-gray-200 flex-1 truncate">${esc(item.name)}</span>
      <button data-bulk-edit="${i}" class="text-xs text-blue-400 hover:text-blue-300 px-1 shrink-0">編集</button>
      <button data-bulk-del="${i}"  class="text-xs text-red-400  hover:text-red-300  px-1 shrink-0">削除</button>
    </div>
  `).join('');
}

function _startBulkRowEdit(idx) {
  const rowEl = elRightContent.querySelector(`[data-bulk-row="${idx}"]`);
  if (!rowEl || !_bulkDraft[idx]) return;
  const currentName = _bulkDraft[idx].name;
  rowEl.innerHTML = `
    <span class="text-xs text-gray-500 w-5 text-right shrink-0">${idx + 1}</span>
    <input data-bulk-input="${idx}" type="text" value="${esc(currentName)}"
      class="flex-1 bg-gray-600 text-gray-100 rounded px-1.5 py-0.5 text-xs min-w-0">
    <button data-bulk-confirm="${idx}" class="text-xs text-green-400 hover:text-green-300 px-1 shrink-0">確定</button>
    <button data-bulk-del="${idx}"     class="text-xs text-red-400  hover:text-red-300  px-1 shrink-0">削除</button>
  `;
  rowEl.querySelector(`[data-bulk-input="${idx}"]`)?.focus();
}

function _confirmBulkRowEdit(idx) {
  const input = elRightContent.querySelector(`[data-bulk-input="${idx}"]`);
  if (!input || !_bulkDraft[idx]) return;
  const newName = input.value.trim();
  if (newName) _bulkDraft[idx].name = newName;
  _renderBulkDraftList();
}

function _renderBulkPanel() {
  const restore = _pendingRestoreEntry;
  _pendingRestoreEntry = null;

  const inp = (extra = '') =>
    `w-full bg-gray-700 text-gray-100 rounded px-2 py-1 mt-0.5 text-sm ${extra}`;
  const catOptions = CATEGORY_ORDER.map(c =>
    `<option value="${esc(c)}">${esc(c)}</option>`
  ).join('');

  const isHistTab      = _inputHistoryTab === 'history';
  const defPrefix      = restore?.prefix       ?? '';
  const defBaseName    = restore?.baseName      ?? '';
  const defSeparator   = restore?.separator     ?? '-';
  const defSuffixStart = restore?.suffixStart   ?? '1';
  const defNote        = restore?.note          ?? '';
  const defCount       = restore?.count         ?? '3';
  const defAutoInc     = restore?.autoIncrement ?? true;

  elRightContent.innerHTML = `
    <div class="flex gap-0.5 mb-2 bg-gray-900 rounded-md p-0.5">
      <button data-rp-action="mode-single"
        class="flex-1 text-xs py-1 rounded text-gray-400 hover:text-gray-200">単品</button>
      <button data-rp-action="mode-bulk"
        class="flex-1 text-xs py-1 rounded bg-gray-600 text-white font-medium">一括</button>
    </div>
    <div class="flex gap-0.5 mb-3 bg-gray-900 rounded-md p-0.5">
      <button data-rp-action="history-tab-input"
        class="flex-1 text-xs py-1 rounded ${!isHistTab ? 'bg-gray-600 text-white font-medium' : 'text-gray-400 hover:text-gray-200'}">入力</button>
      <button data-rp-action="history-tab-history"
        class="flex-1 text-xs py-1 rounded ${isHistTab ? 'bg-gray-600 text-white font-medium' : 'text-gray-400 hover:text-gray-200'}">履歴</button>
    </div>

    ${!isHistTab ? `
      <div class="flex gap-1.5 mb-4">
        <button data-rp-action="bulk-save"
          class="flex-1 text-xs bg-blue-700 hover:bg-blue-600 text-white py-1.5 rounded font-medium">
          一括登録
        </button>
        <button data-rp-action="cancel"
          class="flex-1 text-xs bg-gray-700 hover:bg-gray-600 text-white py-1.5 rounded">
          キャンセル
        </button>
      </div>

      <div class="space-y-2.5 text-sm">
        <div>
          <label class="text-xs text-gray-400">カテゴリー</label>
          <select id="rp-bulk-category" class="${inp()}">
            <option value="">— 未選択 —</option>
            ${catOptions}
          </select>
        </div>

        <hr class="border-gray-700 my-1">
        <p class="text-xs font-semibold text-gray-400 tracking-widest">品名パーツ</p>

        <div>
          <label class="text-xs text-gray-400">接頭</label>
          <input id="rp-bulk-prefix" type="text" value="${esc(defPrefix)}"
            class="${inp()}" placeholder="例: 2S">
        </div>
        <div>
          <label class="text-xs text-gray-400">品名 <span class="text-red-400">*</span></label>
          <input id="rp-bulk-baseName" type="text" value="${esc(defBaseName)}"
            class="${inp()}" placeholder="例: B198">
        </div>
        <div class="flex gap-1.5">
          <div class="w-20 shrink-0">
            <label class="text-xs text-gray-400">区切り</label>
            <input id="rp-bulk-separator" type="text" value="${esc(defSeparator)}"
              class="${inp()}" placeholder="-">
          </div>
          <div class="flex-1">
            <label class="text-xs text-gray-400">枝番 開始</label>
            <input id="rp-bulk-suffixStart" type="text" value="${esc(defSuffixStart)}"
              class="${inp()}" placeholder="1">
          </div>
        </div>
        <div>
          <label class="text-xs text-gray-400">補足</label>
          <input id="rp-bulk-note" type="text" value="${esc(defNote)}"
            class="${inp()}" placeholder="×4 など">
        </div>

        <hr class="border-gray-700 my-1">
        <p class="text-xs font-semibold text-gray-400 tracking-widest">生成設定</p>

        <div class="flex items-end gap-3">
          <div class="flex-1">
            <label class="text-xs text-gray-400">登録個数（2〜30）</label>
            <input id="rp-bulk-count" type="number" min="2" max="30" value="${esc(defCount)}"
              class="${inp()}" placeholder="3">
          </div>
          <label class="flex items-center gap-1.5 pb-1.5 cursor-pointer shrink-0">
            <input id="rp-bulk-auto" type="checkbox" ${defAutoInc ? 'checked' : ''} class="accent-blue-500">
            <span class="text-xs text-gray-400">枝番連番</span>
          </label>
        </div>

        <hr class="border-gray-700 my-1">
        <p class="text-xs font-semibold text-gray-400 tracking-widest">プレビュー</p>

        <div id="rp-bulk-preview" class="rounded bg-gray-950 px-2 py-1.5 min-h-[48px]">
          <p class="text-xs text-gray-600">品名を入力すると一覧が表示されます</p>
        </div>
      </div>
    ` : `
      <div class="flex gap-1.5 mb-3">
        <button data-rp-action="cancel"
          class="flex-1 text-xs bg-gray-700 hover:bg-gray-600 text-white py-1.5 rounded">
          キャンセル
        </button>
      </div>
      <div id="rp-history-list" class="space-y-0.5">
        ${_historyListHtml('bulk')}
      </div>
    `}
  `;

  // restore 後はプレビューを更新
  if (!isHistTab && defBaseName) _updateBulkPreview();
}

async function _handleSave() {
  const {
    rightPanelMode, selectedProjectId, selectedPlanId,
    selectedTruckId, selectedItemId, itemsCache,
  } = adminState;

  const f = _readFormData();

  if (!f.baseName) {
    const el = elRightContent.querySelector('#rp-baseName');
    el?.focus();
    el?.classList.add('ring-1', 'ring-red-500');
    return;
  }

  const nameParts = {
    prefix:    { value: f.prefix },
    baseName:  { value: f.baseName },
    separator: { value: f.separator || '-' },
    suffix:    { value: f.suffix },
    note:      { value: f.note },
  };

  const items = itemsCache[selectedTruckId] ?? [];

  const itemData = {
    nameParts,
    name:               buildItemName(nameParts), // 表示名キャッシュ
    category:           f.category,
    cautionNote:        f.cautionNote,
    loadingInstruction: f.loadingInstruction,
    diffs:              [..._diffDraft],
  };

  if (rightPanelMode === 'new') {
    const maxOrder     = items.reduce((m, i) => Math.max(m, i.sortOrder ?? 0), 0);
    itemData.sortOrder = maxOrder + 10;
    itemData.checked   = false;

    const created = await createItem(selectedProjectId, selectedPlanId, selectedTruckId, itemData);
    addItemToState(selectedTruckId, created);
    adminState.selectedItemId = created.id;
    adminState.rightPanelMode = 'view';

    _saveToHistory({
      id:                 Date.now(),
      mode:               'single',
      prefix:             f.prefix,
      baseName:           f.baseName,
      separator:          f.separator,
      suffix:             f.suffix,
      note:               f.note,
      category:           f.category,
      cautionNote:        f.cautionNote,
      loadingInstruction: f.loadingInstruction,
      displayName:        buildItemName(nameParts),
      savedAt:            Date.now(),
    });

  } else {
    // edit
    const existing     = items.find(i => i.id === selectedItemId);
    itemData.sortOrder = existing?.sortOrder ?? 0;
    itemData.checked   = existing?.checked   ?? false;

    await updateItem(selectedProjectId, selectedPlanId, selectedTruckId, selectedItemId, itemData);
    updateItemInState(selectedTruckId, { id: selectedItemId, ...itemData });
    adminState.rightPanelMode = 'view';
  }

  _diffDraft = [];
  renderMainGrid();
  renderRightPanel();
}

async function _handleDelete() {
  const {
    selectedProjectId, selectedPlanId,
    selectedTruckId, selectedItemId, multiSelectedItemIds,
  } = adminState;
  if (!selectedTruckId || !selectedItemId) return;

  const idsToDelete = multiSelectedItemIds.length > 0
    ? [...multiSelectedItemIds]
    : [selectedItemId];

  // Optimistic: state 先更新 → 即再描画
  for (const id of idsToDelete) removeItemFromState(selectedTruckId, id);
  adminState.selectedItemId       = null;
  adminState.multiSelectedItemIds = [];
  adminState.rightPanelMode       = 'idle';
  _diffDraft = [];

  renderMainGrid();
  renderRightPanel();

  // Firestore 書き込み（DEV_MODE 時はスタブ）
  for (const id of idsToDelete) {
    await deleteItem(selectedProjectId, selectedPlanId, selectedTruckId, id);
  }
}

async function _handleBulkSave() {
  if (!_bulkDraft.length) {
    elRightContent.querySelector('#rp-bulk-baseName')?.focus();
    return;
  }

  const f = _readBulkFormData(); // category ほか使用
  const { selectedProjectId, selectedPlanId, selectedTruckId, itemsCache } = adminState;
  const items    = itemsCache[selectedTruckId] ?? [];
  let maxOrder   = items.reduce((m, i) => Math.max(m, i.sortOrder ?? 0), 0);

  let lastCreatedId = null;

  for (const draft of _bulkDraft) {
    maxOrder += 10;
    const itemData = {
      nameParts:          draft.nameParts,  // 構造体（将来の拡張用）
      name:               draft.name,       // 手動編集済みの表示名
      category:           f.category,
      cautionNote:        '',
      loadingInstruction: '',
      diffs:              [],
      sortOrder:          maxOrder,
      checked:            false,
    };
    const created = await createItem(selectedProjectId, selectedPlanId, selectedTruckId, itemData);
    addItemToState(selectedTruckId, created);
    lastCreatedId = created.id;
  }

  if (lastCreatedId) {
    _saveToHistory({
      id:            Date.now(),
      mode:          'bulk',
      prefix:        f.prefix,
      baseName:      f.baseName,
      separator:     f.separator,
      suffixStart:   f.suffixStart,
      note:          f.note,
      count:         f.count,
      autoIncrement: f.autoIncrement,
      category:      f.category,
      displayName:   `${f.prefix}${f.baseName}`,
      savedAt:       Date.now(),
    });
  }

  _bulkDraft = [];
  adminState.selectedItemId = lastCreatedId;
  adminState.rightPanelMode = lastCreatedId ? 'view' : 'idle';
  renderMainGrid();
  renderRightPanel();
}

// ── Actions: Truck / Item ───────────────────────────────────

async function selectTruck(truckId) {
  adminState.selectedTruckId      = truckId;
  adminState.selectedItemId       = null;
  adminState.multiSelectedItemIds = [];
  adminState.rightPanelMode       = 'idle';
  _diffDraft       = [];
  _bulkDraft       = [];
  _inputHistoryTab = 'input';

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
  elMainGrid.scrollTop = 0;
}

function selectItem(itemId, e = {}) {
  const isMulti = e.ctrlKey || e.metaKey;
  const isShift = e.shiftKey;

  if (isMulti) {
    // Ctrl/Cmd クリック: トグル追加/削除
    const set = new Set(adminState.multiSelectedItemIds);
    if (set.has(itemId)) {
      set.delete(itemId);
      if (adminState.selectedItemId === itemId) {
        adminState.selectedItemId = set.size > 0 ? [...set].at(-1) : null;
      }
    } else {
      set.add(itemId);
      adminState.selectedItemId = itemId;
    }
    adminState.multiSelectedItemIds = [...set];

  } else if (isShift && adminState.selectedItemId) {
    // Shift クリック: primary から対象まで範囲選択
    const items = adminState.itemsCache[adminState.selectedTruckId] ?? [];
    const flat  = sortItems(items).map(i => i.id);
    const fromIdx = flat.indexOf(adminState.selectedItemId);
    const toIdx   = flat.indexOf(itemId);
    if (fromIdx >= 0 && toIdx >= 0) {
      const [lo, hi] = [Math.min(fromIdx, toIdx), Math.max(fromIdx, toIdx)];
      adminState.multiSelectedItemIds = flat.slice(lo, hi + 1);
    }
    adminState.selectedItemId = itemId;

  } else {
    // 単クリック: 単一選択 → view モードへ
    adminState.selectedItemId       = itemId;
    adminState.multiSelectedItemIds = [];
    adminState.rightPanelMode       = 'view';
  }

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
    if (cell) selectItem(cell.dataset.itemId, e);
  });

  // 右パネル: イベント委譲
  elRightContent.addEventListener('click', async e => {
    // diff-remove は data-rp-action を持たないため先に処理
    const removeBtn = e.target.closest('[data-remove-diff]');
    if (removeBtn) {
      const idx = parseInt(removeBtn.dataset.removeDiff, 10);
      _diffDraft.splice(idx, 1);
      const listEl = elRightContent.querySelector('#rp-diff-list');
      if (listEl) listEl.innerHTML = _diffDraftListHtml();
      return;
    }

    // bulk ドラフト行: 編集・確定・削除
    const bulkEdit = e.target.closest('[data-bulk-edit]');
    if (bulkEdit) { _startBulkRowEdit(parseInt(bulkEdit.dataset.bulkEdit, 10)); return; }

    const bulkConfirm = e.target.closest('[data-bulk-confirm]');
    if (bulkConfirm) { _confirmBulkRowEdit(parseInt(bulkConfirm.dataset.bulkConfirm, 10)); return; }

    const bulkDel = e.target.closest('[data-bulk-del]');
    if (bulkDel) {
      _bulkDraft.splice(parseInt(bulkDel.dataset.bulkDel, 10), 1);
      _renderBulkDraftList();
      return;
    }

    // 履歴 apply / delete
    const histApply = e.target.closest('[data-history-apply]');
    if (histApply) {
      const idx  = parseInt(histApply.dataset.historyApply, 10);
      const list = _loadHistory();
      if (list[idx]) _applyHistoryEntry(list[idx]);
      return;
    }

    const histDel = e.target.closest('[data-history-del]');
    if (histDel) {
      const idx = parseInt(histDel.dataset.historyDel, 10);
      _deleteFromHistory(idx);
      const mode    = adminState.rightPanelMode === 'bulk' ? 'bulk' : 'single';
      const listEl  = elRightContent.querySelector('#rp-history-list');
      if (listEl) listEl.innerHTML = _historyListHtml(mode);
      return;
    }

    const action = e.target.closest('[data-rp-action]')?.dataset.rpAction;
    if (!action) return;

    if (action === 'new') {
      _diffDraft = [];
      adminState.rightPanelMode = 'new';
      renderRightPanel();
      return;
    }

    if (action === 'edit') {
      const items = adminState.itemsCache[adminState.selectedTruckId] ?? [];
      const item  = items.find(i => i.id === adminState.selectedItemId);
      _diffDraft = item ? [...(item.diffs ?? [])] : [];
      adminState.rightPanelMode = 'edit';
      renderRightPanel();
      return;
    }

    if (action === 'cancel') {
      _diffDraft = [];
      adminState.rightPanelMode = adminState.selectedItemId ? 'view' : 'idle';
      renderRightPanel();
      return;
    }

    if (action === 'save') {
      await _handleSave();
      return;
    }

    if (action === 'delete') {
      await _handleDelete();
      return;
    }

    if (action === 'diff-add') {
      const date = elRightContent.querySelector('#rp-diff-date')?.value;
      const type = elRightContent.querySelector('#rp-diff-type')?.value;
      if (!date || !type) return;
      _diffDraft.push({ date, type });
      elRightContent.querySelector('#rp-diff-date').value = '';
      const listEl = elRightContent.querySelector('#rp-diff-list');
      if (listEl) listEl.innerHTML = _diffDraftListHtml();
      return;
    }

    if (action === 'mode-single') {
      _bulkDraft       = [];
      _inputHistoryTab = 'input';
      adminState.rightPanelMode = 'new';
      renderRightPanel();
      return;
    }

    if (action === 'mode-bulk') {
      _inputHistoryTab = 'input';
      adminState.rightPanelMode = 'bulk';
      renderRightPanel();
      return;
    }

    if (action === 'bulk-save') {
      await _handleBulkSave();
      return;
    }

    if (action === 'history-tab-input') {
      _inputHistoryTab = 'input';
      renderRightPanel();
      return;
    }

    if (action === 'history-tab-history') {
      _inputHistoryTab = 'history';
      renderRightPanel();
      return;
    }
  });

  // 右パネル: 一括モードのリアルタイムプレビュー
  elRightContent.addEventListener('input',  () => { if (adminState.rightPanelMode === 'bulk') _updateBulkPreview(); });
  elRightContent.addEventListener('change', () => { if (adminState.rightPanelMode === 'bulk') _updateBulkPreview(); });

  // Delete キー: フォーム編集中は無効化、それ以外は品目削除
  document.addEventListener('keydown', async e => {
    if (e.key !== 'Delete') return;
    const mode = adminState.rightPanelMode;
    if (mode === 'edit' || mode === 'new' || mode === 'bulk') return; // フォーム入力中は誤削除防止
    if (!adminState.selectedTruckId || !adminState.selectedItemId) return;
    await _handleDelete();
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
