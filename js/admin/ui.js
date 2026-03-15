// 管理画面 UI / イベント

import { adminState, addItemToState, updateItemInState, removeItemFromState, addTruckToState, updateTruckInState, removeTruckFromState } from './state.js';
import { getTrucksForPlan, getItemsForTruck, createItem, updateItem, deleteItem, createTruck, updateTruck, deleteTruckCascade } from './db.js';
import { sortItems, buildItemName } from '../../packages/shared-domain/src/index.js';
import { getSuggestions, getAllCandidates, naturalCompare } from './suggest-data.js';
import { getProjectLevels } from '../modules/calculator.js';

// ── 種別順（ボルトアプリ準拠） ─────────────────────────────
const CATEGORY_ORDER = [
  '柱', '間柱', '大梁', '小梁', 'ブレス', 'ボルト', '仮ボルト', 'デッキ', 'コン止め', 'その他',
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
const elTruckList      = document.getElementById('admin-truck-list');
const elMainGrid       = document.getElementById('admin-main-grid');
const elRightContent   = document.getElementById('admin-right-content');
const elHeaderInfo     = document.getElementById('admin-header-info');
const elSuggestSidebar = document.getElementById('admin-suggest-sidebar');

// ── Helpers ────────────────────────────────────────────────

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getItemDisplayName(item) {
  // item.name を優先（一括登録の手動編集名を尊重）
  // nameParts よりも name が確定している場合はそちらを返す
  if (item.name) return item.name;
  if (item.nameParts) return buildItemName(item.nameParts);
  return item.itemName || item.itemCode || '品目名不明';
}

// ── bindEvents ガード（複数回呼び出し防止） ────────────────
let _eventsBound = false;

// ── 保存中フラグ（二重実行防止） ──────────────────────────
// _handleSave / _handleBulkSave / _handleTruckSave / _handleCopyTruck で共用
let _saving = false;

// ── Truck Panel mode ────────────────────────────────────────
// null | 'new' | 'edit' | 'delete-confirm'
// renderRightPanel() の先頭で確認し、セット時は号車フォームを描画
let _truckPanelMode = null;

// ── Right Panel: draft state ───────────────────────────────

let _diffDraft = [];
let _bulkDraft = []; // { name: string, nameParts: object }[]
let _inputHistoryTab  = 'input'; // 'input' | 'history'
let _pendingRestoreEntry = null;

// ── Right Panel: フォーム入力保持 draft ────────────────────
// 同一 A2 / 同一搬入日の操作中に保持し、initGridScreen でリセット
// 号車切替では保持し続ける（同日内の連続作業を想定）
let _singleFormDraft = null; // null | { prefix, baseName, separator, suffix, note, category, cautionNote, loadingInstruction }
let _bulkFormDraft   = null; // null | { category, prefix, baseName, separator, suffixStart, note, count, autoIncrement }

// ── サジェスト専用サイドバー state ──────────────────────────
// bolt 連携工事のとき baseName フォーカス中のみ表示する
const NO_SUGGEST_CATS = new Set(['ボルト', '仮ボルト', 'コン止め']);
let _suggestLevel       = 'all'; // アクティブ階層タブ ID
let _suggestSearch      = '';    // 絞り込み検索文字列
let _activeSuggestInput = null;  // 現在フォーカス中の baseName input 要素
let _activeSuggestCatEl = null;  // 現在フォーカス中の category select 要素
let _sidebarBlurTimer   = null;  // blur 時の遅延非表示タイマー

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

// ── Suggest: bolt サジェストサイドバー ─────────────────────

/** 現在工事に紐づく bolt プロジェクトを返す（なければ null） */
function _getBoltProject() {
  const { selectedProjectId, a1 } = adminState;
  return (a1?.boltProjects ?? []).find(p => p.id === selectedProjectId) ?? null;
}

/** サジェスト専用サイドバーを表示すべきか判定する */
function _shouldShowBoltSuggest() {
  if (!_getBoltProject()) return false;
  const cat = _activeSuggestCatEl?.value ?? '';
  return !NO_SUGGEST_CATS.has(cat);
}

/** サジェストサイドバーを表示して描画する */
function _showBoltSuggest() {
  if (!elSuggestSidebar) return;
  const searchEl = elSuggestSidebar.querySelector('#admin-suggest-search');
  if (searchEl && searchEl.value !== _suggestSearch) searchEl.value = _suggestSearch;
  _renderSuggestSidebar();
  elSuggestSidebar.style.display = 'flex';
}

/** サジェストサイドバーを非表示にする */
function _hideBoltSuggest() {
  if (!elSuggestSidebar) return;
  elSuggestSidebar.style.display = 'none';
}

/**
 * サジェストサイドバーのコンテンツを描画する
 * - 階層タブ: _suggestLevel に応じてアクティブ表示
 * - 候補リスト: _suggestSearch でフィルタ、自然ソート
 */
function _renderSuggestSidebar() {
  if (!elSuggestSidebar) return;
  const proj = _getBoltProject();
  if (!proj) return;

  const levels  = getProjectLevels(proj); // [{ id, label }]
  const members = proj.members ?? [];

  // ── 階層タブ ──
  const tabsEl = elSuggestSidebar.querySelector('#admin-suggest-tabs');
  if (tabsEl) {
    const allTabs = [{ id: 'all', label: '全て' }, ...levels];
    tabsEl.innerHTML = allTabs.map(l => `
      <button data-suggest-level="${esc(l.id)}"
        class="px-2.5 py-1 text-xs shrink-0 border-r border-gray-700 whitespace-nowrap
               ${l.id === _suggestLevel
                 ? 'bg-blue-700 text-white'
                 : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'}">
        ${esc(l.label)}
      </button>
    `).join('');
  }

  // ── 候補フィルタ ──
  let filtered = _suggestLevel === 'all'
    ? [...members]
    : members.filter(m => (m.targetLevels ?? []).includes(_suggestLevel));

  const search = _suggestSearch.toLowerCase();
  if (search) filtered = filtered.filter(m => (m.name ?? '').toLowerCase().includes(search));

  // 自然ソート
  filtered.sort((a, b) => naturalCompare(a.name ?? '', b.name ?? ''));

  // ── 件数 ──
  const countEl = elSuggestSidebar.querySelector('#admin-suggest-count');
  if (countEl) countEl.textContent = `${filtered.length}件`;

  // ── リスト ──
  const listEl = elSuggestSidebar.querySelector('#admin-suggest-list');
  if (!listEl) return;
  listEl.innerHTML = filtered.length
    ? filtered.map(m => `
        <li data-suggest-member="${esc(m.name ?? '')}"
          class="px-2 py-1 text-xs text-gray-200 cursor-pointer hover:bg-gray-700 truncate select-none">
          ${esc(m.name ?? '')}
        </li>`).join('')
    : '<li class="text-xs text-gray-600 px-2 py-2">候補なし</li>';
}

/**
 * サジェストサイドバーのイベントを一度だけバインドする（bindEvents 内から呼ぶ）
 */
function _initSuggestSidebar() {
  if (!elSuggestSidebar) return;
  const searchEl = elSuggestSidebar.querySelector('#admin-suggest-search');

  // 階層タブ / 候補クリック
  elSuggestSidebar.addEventListener('click', e => {
    const tab = e.target.closest('[data-suggest-level]');
    if (tab) {
      _suggestLevel = tab.dataset.suggestLevel;
      _renderSuggestSidebar();
      return;
    }
    const member = e.target.closest('[data-suggest-member]');
    if (member && _activeSuggestInput) {
      _activeSuggestInput.value = member.dataset.suggestMember;
      if (adminState.rightPanelMode === 'bulk') _updateBulkPreview();
      clearTimeout(_sidebarBlurTimer);
      _activeSuggestInput.focus(); // サイドバーを維持しつつ input に戻る
    }
  });

  // 検索入力
  searchEl?.addEventListener('input', e => {
    _suggestSearch = e.target.value;
    _renderSuggestSidebar();
  });

  // mousedown: search input 以外は baseName の blur を抑止
  elSuggestSidebar.addEventListener('mousedown', e => {
    if (e.target !== searchEl && !searchEl?.contains(e.target)) {
      e.preventDefault();
    }
  });

  // search input にフォーカスが移ったとき blur タイマーをキャンセル
  elSuggestSidebar.addEventListener('focusin', () => {
    clearTimeout(_sidebarBlurTimer);
  });

  // サイドバー内フォーカスが完全に外れたら非表示
  elSuggestSidebar.addEventListener('focusout', e => {
    if (!elSuggestSidebar.contains(e.relatedTarget)) {
      _hideBoltSuggest();
      _activeSuggestInput = null;
      _activeSuggestCatEl = null;
    }
  });

  // Escape で閉じて baseName に戻る
  searchEl?.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      _hideBoltSuggest();
      _activeSuggestInput?.focus();
    }
  });
}

// ── Suggest: baseName サジェスト（ドロップダウン + サイドバー） ──

/**
 * baseName 入力欄にサジェストを attach する
 *
 * bolt 工事リンクあり + サジェスト対象カテゴリ
 *   → サイドバーで bolt 部材名を表示
 * bolt 工事リンクなし / 対象外カテゴリ（ボルト・仮ボルト・コン止め）
 *   → 既存ドロップダウン（itemsCache + 静的カタログ）
 *
 * @param {HTMLInputElement}  inputEl  baseName input
 * @param {HTMLSelectElement} catEl    category select
 */
function _attachSuggest(inputEl, catEl) {
  if (!inputEl) return;

  // ── ドロップダウン（non-bolt モード用） ──
  const container = inputEl.parentElement;
  container.style.position = 'relative';

  const suggEl = document.createElement('div');
  suggEl.className = [
    'absolute z-50 left-0 right-0 top-full mt-px',
    'bg-gray-800 border border-gray-600 rounded shadow-lg',
    'max-h-56 overflow-y-auto hidden',
  ].join(' ');
  container.appendChild(suggEl);

  let _results  = [];
  let _activeIdx = -1;

  function renderList() {
    if (!_results.length) { hideDropdown(); return; }
    suggEl.innerHTML = _results.map((r, i) => `
      <div data-si="${i}"
        class="px-2 py-1.5 text-xs cursor-pointer flex items-center justify-between gap-2
               ${i === _activeIdx ? 'bg-gray-600 text-white' : 'hover:bg-gray-700 text-gray-100'}">
        <span class="font-medium">${esc(r.baseName)}</span>
        <span class="text-gray-500 shrink-0 text-[10px]">${esc(r.category)}</span>
      </div>
    `).join('');
    suggEl.classList.remove('hidden');
  }

  function showDropdown() {
    const val = inputEl.value;
    const cat = catEl?.value ?? '';
    _results   = val ? getSuggestions(val, cat, adminState.itemsCache)
                     : getAllCandidates(cat, adminState.itemsCache);
    _activeIdx = -1;
    renderList();
  }

  function hideDropdown() {
    suggEl.classList.add('hidden');
    _activeIdx = -1;
  }

  function setActive(idx) {
    _activeIdx = Math.max(0, Math.min(idx, _results.length - 1));
    renderList();
    suggEl.querySelector(`[data-si="${_activeIdx}"]`)?.scrollIntoView({ block: 'nearest' });
  }

  function applyDropdown(idx) {
    const chosen = _results[idx];
    if (!chosen) return;
    inputEl.value = chosen.baseName;
    if (catEl && chosen.category) catEl.value = chosen.category;
    hideDropdown();
    if (adminState.rightPanelMode === 'bulk') _updateBulkPreview();
  }

  // bolt / 通常モードの切替
  function updateMode() {
    if (_activeSuggestInput !== inputEl) return;
    if (_shouldShowBoltSuggest()) {
      hideDropdown();
      _showBoltSuggest();
    } else {
      _hideBoltSuggest();
      showDropdown();
    }
  }

  // フォーカス
  inputEl.addEventListener('focus', () => {
    _activeSuggestInput = inputEl;
    _activeSuggestCatEl = catEl;
    clearTimeout(_sidebarBlurTimer);
    if (_shouldShowBoltSuggest()) {
      // 初回フォーカスで検索欄をリセット
      const searchEl = elSuggestSidebar?.querySelector('#admin-suggest-search');
      if (searchEl) { searchEl.value = ''; _suggestSearch = ''; }
      hideDropdown();
      _showBoltSuggest();
    } else {
      _hideBoltSuggest();
      showDropdown();
    }
  });

  // 入力: bolt モードは検索連動、通常モードはドロップダウン絞り込み
  inputEl.addEventListener('input', () => {
    if (_activeSuggestInput !== inputEl) {
      _activeSuggestInput = inputEl;
      _activeSuggestCatEl = catEl;
    }
    if (_shouldShowBoltSuggest()) {
      _suggestSearch = inputEl.value;
      const searchEl = elSuggestSidebar?.querySelector('#admin-suggest-search');
      if (searchEl) searchEl.value = _suggestSearch;
      _renderSuggestSidebar();
      hideDropdown();
    } else {
      _hideBoltSuggest();
      showDropdown();
    }
  });

  // カテゴリ変更でモード再評価
  catEl?.addEventListener('change', updateMode);

  // blur: ドロップダウンは即非表示、サイドバーは 200ms 遅延（search input への移動を許容）
  inputEl.addEventListener('blur', () => {
    hideDropdown();
    _sidebarBlurTimer = setTimeout(() => {
      if (_activeSuggestInput === inputEl) {
        _hideBoltSuggest();
        _activeSuggestInput = null;
        _activeSuggestCatEl = null;
      }
    }, 200);
  });

  // ドロップダウン: mousedown で blur 抑止
  suggEl.addEventListener('mousedown', e => {
    e.preventDefault();
    const row = e.target.closest('[data-si]');
    if (row) applyDropdown(parseInt(row.dataset.si, 10));
  });

  // キーボード（ドロップダウンモードのみ対応）
  inputEl.addEventListener('keydown', e => {
    const isOpen = !suggEl.classList.contains('hidden');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) { showDropdown(); return; }
      setActive(_activeIdx < 0 ? 0 : _activeIdx + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isOpen) setActive(_activeIdx <= 0 ? 0 : _activeIdx - 1);
    } else if (e.key === 'Enter' && isOpen && _activeIdx >= 0) {
      e.preventDefault();
      applyDropdown(_activeIdx);
    } else if (e.key === 'Escape') {
      hideDropdown();
      _hideBoltSuggest();
    }
  });
}

function _applyHistoryEntry(entry) {
  _pendingRestoreEntry = entry;
  _inputHistoryTab     = 'input';
  adminState.rightPanelMode = entry.mode === 'bulk' ? 'bulk' : 'new';
  renderRightPanel();
}

// ── Render: Header ─────────────────────────────────────────

function renderHeader() {
  // 通常は calendar.js の enterGrid が updateHeaderInfo を呼ぶ
  // initAdmin（フォールバック）経由の場合のみここが使われる
  const { selectedProjectId } = adminState;
  const { currentPlan } = adminState.a2 ?? {};
  const parts = [`<span class="text-gray-400">${esc(selectedProjectId)}</span>`];
  if (currentPlan?.dayIndex != null) {
    parts.push(`<span class="text-gray-400 text-xs">搬入${esc(String(currentPlan.dayIndex))}日目</span>`);
  }
  if (currentPlan?.drawingNo) {
    parts.push(`<span class="text-gray-500 text-xs">計画図番 ${esc(currentPlan.drawingNo)}</span>`);
  }
  elHeaderInfo.innerHTML = parts.join('<span class="text-gray-600 mx-1">/</span>');
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
    const btnCls = isSelected
      ? 'text-blue-200 hover:text-white hover:bg-blue-600'
      : 'text-gray-500 hover:text-blue-300 hover:bg-gray-600';
    const visCls = isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100';

    return `
      <li class="relative group">
        <button
          data-truck-id="${esc(t.id)}"
          class="w-full text-left px-3 py-2.5 pr-14 flex flex-col gap-0.5 transition-colors
            ${isSelected ? 'bg-blue-700 text-white' : 'hover:bg-gray-700 text-gray-200'}"
        >
          <span class="font-semibold text-sm">${esc(t.truckNo)}号車</span>
          <span class="text-xs ${isSelected ? 'text-blue-200' : 'text-gray-400'} truncate">${esc(t.vehicleType ?? '')}</span>
        </button>
        <div class="absolute top-1/2 -translate-y-1/2 right-1 flex gap-0.5 ${visCls} transition-opacity">
          <button data-edit-truck="${esc(t.id)}" title="編集"
            class="w-6 h-6 flex items-center justify-center rounded text-xs ${btnCls}">✏</button>
          <button data-copy-truck="${esc(t.id)}" title="複製"
            class="w-6 h-6 flex items-center justify-center rounded text-xs ${btnCls}">⧉</button>
        </div>
      </li>
    `;
  }).join('');
}

// ── Render: Series Switcher ────────────────────────────────

function _renderSeriesSwitcherHtml() {
  const { seriesPlans = [], currentPlan } = adminState.a2 ?? {};
  if (seriesPlans.length <= 1) return '';

  const tabs = seriesPlans.map(p => {
    const isActive = p.id === currentPlan?.id;
    const label    = `${p.dayIndex ?? p.deliverySeriesIndex ?? '?'}日目`;
    return `<button
      data-switch-plan-id="${esc(p.id)}"
      data-switch-project-id="${esc(p.projectId)}"
      class="shrink-0 px-2.5 py-1 text-xs rounded transition-colors whitespace-nowrap
        ${isActive
          ? 'bg-blue-700 text-white font-medium'
          : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}">
      ${esc(label)}
    </button>`;
  }).join('');

  return `
    <div class="sticky top-0 z-10 bg-gray-900 border-b border-gray-700
                flex items-center gap-1.5 overflow-x-auto py-2 mb-2">
      <span class="text-xs text-gray-500 shrink-0">日切替:</span>
      ${tabs}
    </div>`;
}

// ── Render: Main Grid ──────────────────────────────────────

function renderMainGrid() {
  const switcherHtml = _renderSeriesSwitcherHtml();
  const { selectedTruckId, itemsCache, selectedItemId, multiSelectedItemIds } = adminState;

  if (!selectedTruckId) {
    elMainGrid.innerHTML = switcherHtml + '<p class="text-gray-500 text-sm">号車を選択してください</p>';
    return;
  }

  const items = itemsCache[selectedTruckId] ?? [];

  if (!items.length) {
    elMainGrid.innerHTML = switcherHtml + '<p class="text-gray-500 text-sm">品目がありません</p>';
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

  elMainGrid.innerHTML = switcherHtml + sortedGroups(groups).map(([cat, catItems]) => `
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
  // 右パネル切替時はサジェストサイドバーを閉じる
  _hideBoltSuggest();
  _activeSuggestInput = null;
  _activeSuggestCatEl = null;

  // 号車フォームモードが優先
  if (_truckPanelMode === 'new' || _truckPanelMode === 'edit') {
    _renderTruckFormPanel(_truckPanelMode);
    return;
  }
  if (_truckPanelMode === 'delete-confirm') {
    _renderTruckDeleteConfirm();
    return;
  }

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

  // new モードかつ restore なしのとき _singleFormDraft を fallback に使う
  const draft = (!isEdit && !restore) ? _singleFormDraft : null;

  const defPrefix    = restore?.prefix             ?? np.prefix?.value    ?? draft?.prefix    ?? '';
  const defBaseName  = restore?.baseName           ?? np.baseName?.value  ?? item?.name ?? draft?.baseName  ?? '';
  const defSeparator = restore?.separator          ?? np.separator?.value ?? draft?.separator ?? '-';
  const defSuffix    = restore?.suffix             ?? np.suffix?.value    ?? draft?.suffix    ?? '';
  const defNote      = restore?.note               ?? np.note?.value      ?? draft?.note      ?? '';
  const defCategory  = restore?.category           ?? item?.category      ?? draft?.category  ?? '';
  const defCaution   = restore?.cautionNote        ?? item?.cautionNote   ?? draft?.cautionNote        ?? '';
  const defLoading   = restore?.loadingInstruction ?? item?.loadingInstruction ?? draft?.loadingInstruction ?? '';

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

  // サジェスト attach（履歴タブ以外で常に実行）
  if (!isHistTab) {
    _attachSuggest(
      elRightContent.querySelector('#rp-baseName'),
      elRightContent.querySelector('#rp-category'),
    );
  }
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

// ── Truck Form Panel ───────────────────────────────────────

function _renderTruckFormPanel(mode) {
  const { trucks, selectedTruckId } = adminState;
  const isEdit = mode === 'edit';
  const truck  = isEdit ? trucks.find(t => t.id === selectedTruckId) : null;

  const maxNo = Math.max(0, ...trucks.map(t => parseInt(t.truckNo) || 0));
  const defNo  = isEdit ? (truck?.truckNo ?? '') : String(maxNo + 1);
  const defVeh = truck?.vehicleType        ?? '';
  const defCau = truck?.cautionNotes       ?? '';
  const defLoa = truck?.loadingInstruction ?? '';

  const inp = 'w-full bg-gray-700 text-gray-100 rounded px-2 py-1 mt-0.5 text-sm';

  elRightContent.innerHTML = `
    <div class="px-3 py-2 text-xs font-semibold text-gray-400 tracking-widest
                border-b border-gray-700 -mx-3 -mt-3 mb-3">
      ${isEdit ? '号車 編集' : '号車 新規登録'}
    </div>

    <div class="flex gap-1.5 mb-4">
      <button data-truck-action="save"
        class="flex-1 text-xs ${isEdit ? 'bg-green-700 hover:bg-green-600' : 'bg-blue-700 hover:bg-blue-600'} text-white py-1.5 rounded font-medium">
        ${isEdit ? '更新' : '登録'}
      </button>
      <button data-truck-action="cancel"
        class="flex-1 text-xs bg-gray-700 hover:bg-gray-600 text-white py-1.5 rounded">
        キャンセル
      </button>
      ${isEdit ? `
        <button data-truck-action="delete-request"
          class="text-xs bg-red-900 hover:bg-red-800 text-red-200 px-2.5 py-1.5 rounded">
          削除
        </button>
      ` : ''}
    </div>

    <div class="space-y-2.5 text-sm">
      <div>
        <label class="text-xs text-gray-400">号車番号 <span class="text-red-400">*</span></label>
        <input id="tp-truckNo" type="text" value="${esc(defNo)}"
          class="${inp}" placeholder="1">
      </div>
      <div>
        <label class="text-xs text-gray-400">車種</label>
        <input id="tp-vehicleType" type="text" value="${esc(defVeh)}"
          class="${inp}" placeholder="例: 10t">
      </div>
      <div>
        <label class="text-xs text-gray-400">注意事項</label>
        <textarea id="tp-cautionNotes" rows="3"
          class="${inp} resize-none"
          placeholder="注意事項">${esc(defCau)}</textarea>
      </div>
      <div>
        <label class="text-xs text-gray-400">積込指示</label>
        <textarea id="tp-loadingInstruction" rows="3"
          class="${inp} resize-none"
          placeholder="積込指示">${esc(defLoa)}</textarea>
      </div>
    </div>
  `;

  elRightContent.querySelector('#tp-truckNo')?.focus();
}

function _renderTruckDeleteConfirm() {
  const { trucks, selectedTruckId } = adminState;
  const truck = trucks.find(t => t.id === selectedTruckId);
  if (!truck) return;

  elRightContent.innerHTML = `
    <div class="text-sm font-semibold text-red-400 mb-3">${esc(truck.truckNo)}号車を削除</div>
    <div class="bg-red-950/40 border border-red-900/60 rounded p-3 text-xs text-red-300 leading-relaxed mb-4">
      ⚠️ 削除すると元に戻せません。<br>
      この号車に紐づく品目データも一緒に削除されます。
    </div>
    <div class="flex gap-2">
      <button data-truck-action="delete-confirm"
        class="flex-1 bg-red-700 hover:bg-red-600 text-white py-2 rounded text-sm font-medium">
        削除する
      </button>
      <button data-truck-action="delete-cancel"
        class="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded text-sm">
        キャンセル
      </button>
    </div>
  `;
}

async function _handleTruckSave() {
  if (_saving) return;
  _saving = true;
  const saveBtn = elRightContent.querySelector('[data-truck-action="save"]');
  const origSaveBtnText = saveBtn?.textContent;
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '保存中…'; }

  try {
  const { selectedProjectId, selectedPlanId, selectedTruckId, trucks } = adminState;
  const isEdit = _truckPanelMode === 'edit';

  const q      = id => elRightContent.querySelector(id);
  const truckNo = q('#tp-truckNo')?.value.trim();
  if (!truckNo) { q('#tp-truckNo')?.focus(); return; }

  const cautionNotes       = q('#tp-cautionNotes')?.value.trim()        ?? '';
  const loadingInstruction = q('#tp-loadingInstruction')?.value.trim()  ?? '';
  const truckData = {
    truckNo,
    vehicleType:           q('#tp-vehicleType')?.value.trim() ?? '',
    cautionNotes,
    loadingInstruction,
    hasCaution:            !!cautionNotes,
    hasLoadingInstruction: !!loadingInstruction,
  };

  if (isEdit) {
    const existing = trucks.find(t => t.id === selectedTruckId);
    truckData.truckOrder = existing?.truckOrder ?? 0;
    await updateTruck(selectedProjectId, selectedPlanId, selectedTruckId, truckData);
    updateTruckInState({ id: selectedTruckId, ...truckData });
  } else {
    const maxOrder = Math.max(0, ...trucks.map(t => t.truckOrder ?? 0));
    truckData.truckOrder = maxOrder + 1;
    const newTruck = await createTruck(selectedProjectId, selectedPlanId, truckData);
    addTruckToState(newTruck);
    adminState.selectedTruckId = newTruck.id;
    adminState.itemsCache[newTruck.id] = [];
  }

  _truckPanelMode = null;
  renderTruckList();
  renderMainGrid();
  renderRightPanel();
  } catch (err) {
    console.error('[A2] 号車保存失敗', err);
    if (saveBtn?.isConnected) { saveBtn.disabled = false; saveBtn.textContent = origSaveBtnText; }
  } finally {
    _saving = false;
  }
}

async function _handleTruckDelete() {
  const { selectedProjectId, selectedPlanId, selectedTruckId } = adminState;

  // Optimistic: state 先更新 → 即再描画
  removeTruckFromState(selectedTruckId);
  adminState.selectedTruckId      = null;
  adminState.selectedItemId       = null;
  adminState.multiSelectedItemIds = [];
  _truckPanelMode = null;
  _diffDraft      = [];
  _bulkDraft      = [];

  renderTruckList();
  renderMainGrid();
  renderRightPanel();

  // Firestore cascade 削除
  try {
    await deleteTruckCascade(selectedProjectId, selectedPlanId, selectedTruckId);
  } catch (err) {
    console.error('[A2] 号車削除失敗', { selectedProjectId, selectedPlanId, selectedTruckId }, err);
  }
}

function _renderBulkPanel() {
  const restore = _pendingRestoreEntry;
  _pendingRestoreEntry = null;

  const inp = (extra = '') =>
    `w-full bg-gray-700 text-gray-100 rounded px-2 py-1 mt-0.5 text-sm ${extra}`;

  const isHistTab      = _inputHistoryTab === 'history';
  // restore なしのとき _bulkFormDraft を fallback に使う
  const bdraft = restore ? null : _bulkFormDraft;
  const defCategory    = restore?.category     ?? bdraft?.category     ?? '';

  const catOptions = CATEGORY_ORDER.map(c =>
    `<option value="${esc(c)}" ${defCategory === c ? 'selected' : ''}>${esc(c)}</option>`
  ).join('');
  const defPrefix      = restore?.prefix       ?? bdraft?.prefix       ?? '';
  const defBaseName    = restore?.baseName      ?? bdraft?.baseName     ?? '';
  const defSeparator   = restore?.separator     ?? bdraft?.separator    ?? '-';
  const defSuffixStart = restore?.suffixStart   ?? bdraft?.suffixStart  ?? '1';
  const defNote        = restore?.note          ?? bdraft?.note         ?? '';
  const defCount       = restore?.count         ?? bdraft?.count        ?? '3';
  const defAutoInc     = restore?.autoIncrement ?? bdraft?.autoIncrement ?? true;

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

  if (!isHistTab) {
    // サジェスト attach
    _attachSuggest(
      elRightContent.querySelector('#rp-bulk-baseName'),
      elRightContent.querySelector('#rp-bulk-category'),
    );
    // restore 後はプレビューを更新
    if (defBaseName) _updateBulkPreview();
  }
}

async function _handleSave() {
  if (_saving) return;
  _saving = true;
  const saveBtn = elRightContent.querySelector('[data-rp-action="save"]');
  const origSaveBtnText = saveBtn?.textContent;
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '保存中…'; }
  try {

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

  // new モード完了後も入力内容を保持（次回新規登録で復元される）
  if (rightPanelMode === 'new') _singleFormDraft = f;

  _diffDraft = [];
  renderMainGrid();
  renderRightPanel();
  } catch (err) {
    console.error('[A2] 品目保存失敗', err);
    if (saveBtn?.isConnected) { saveBtn.disabled = false; saveBtn.textContent = origSaveBtnText; }
  } finally {
    _saving = false;
  }
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
  if (_saving) return;
  _saving = true;
  const saveBtn = elRightContent.querySelector('[data-rp-action="bulk-save"]');
  const origSaveBtnText = saveBtn?.textContent;
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '登録中…'; }
  try {

  // 未確定のインライン編集を自動コミット（確定ボタンを押さずに登録した場合対応）
  elRightContent.querySelectorAll('[data-bulk-input]').forEach(input => {
    const idx = parseInt(input.dataset.bulkInput, 10);
    const newName = input.value.trim();
    if (newName && _bulkDraft[idx]) _bulkDraft[idx].name = newName;
  });

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

  // 一括登録完了後もフォーム入力内容を保持（次回一括パネルで復元される）
  _bulkFormDraft = f;
  _bulkDraft = [];
  adminState.selectedItemId = lastCreatedId;
  adminState.rightPanelMode = lastCreatedId ? 'view' : 'idle';
  renderMainGrid();
  renderRightPanel();
  } catch (err) {
    console.error('[A2] 一括登録失敗', err);
    if (saveBtn?.isConnected) { saveBtn.disabled = false; saveBtn.textContent = origSaveBtnText; }
  } finally {
    _saving = false;
  }
}

// ── Actions: Truck / Item ───────────────────────────────────

/**
 * 号車を複製する
 * - truck 基本情報（vehicleType / loadSummary / cautionNotes / loadingInstruction）をコピー
 * - items 全件をコピー（checked=false にリセット、sortOrder は維持）
 * - progressStatus / checkedCount / diffs はリセット
 * - 新しい truckNo = 既存最大 + 1
 */
async function _handleCopyTruck(sourceTruckId) {
  if (_saving) return;
  _saving = true;
  const copyBtn = elTruckList.querySelector(`[data-copy-truck="${sourceTruckId}"]`);
  if (copyBtn) { copyBtn.disabled = true; }
  try {

  const { selectedProjectId, selectedPlanId, trucks, itemsCache } = adminState;
  const sourceTruck = trucks.find(t => t.id === sourceTruckId);
  if (!sourceTruck) return;

  // items が未ロードなら先にフェッチ
  let sourceItems = itemsCache[sourceTruckId];
  if (!sourceItems) {
    sourceItems = await getItemsForTruck(selectedProjectId, selectedPlanId, sourceTruckId);
    adminState.itemsCache[sourceTruckId] = sourceItems;
  }

  // 新しい truckNo / truckOrder
  const maxNo    = Math.max(0, ...trucks.map(t => parseInt(t.truckNo) || 0));
  const maxOrder = Math.max(0, ...trucks.map(t => t.truckOrder ?? 0));

  const newTruckData = {
    truckNo:              String(maxNo + 1),
    truckOrder:           maxOrder + 1,
    // コピー対象フィールド
    vehicleType:          sourceTruck.vehicleType         ?? '',
    loadSummary:          sourceTruck.loadSummary         ?? '',
    cautionNotes:         sourceTruck.cautionNotes        ?? '',
    hasCaution:           !!(sourceTruck.cautionNotes),
    loadingInstruction:   sourceTruck.loadingInstruction  ?? '',
    hasLoadingInstruction: !!(sourceTruck.loadingInstruction),
    constructionDay:      sourceTruck.constructionDay     ?? 1,
    // リセット
    progressStatus:       'pending',
    diffs:                [],
    itemCount:            sourceItems.length,
    checkedCount:         0,
  };

  const newTruck = await createTruck(selectedProjectId, selectedPlanId, newTruckData);
  addTruckToState(newTruck);

  // items を順番に複製（checked リセット、sortOrder 維持）
  const newItems = [];
  for (const item of sourceItems) {
    const itemData = {
      nameParts:          item.nameParts          ?? {},
      name:               item.name               ?? '',
      category:           item.category           ?? '',
      cautionNote:        item.cautionNote        ?? '',
      loadingInstruction: item.loadingInstruction ?? '',
      diffs:              item.diffs              ?? [],
      sortOrder:          item.sortOrder          ?? 0,
      checked:            false,
    };
    const created = await createItem(selectedProjectId, selectedPlanId, newTruck.id, itemData);
    newItems.push(created);
  }
  adminState.itemsCache[newTruck.id] = newItems;

  // 複製した号車を選択（itemsCache 設定済みなので再フェッチなし）
  await selectTruck(newTruck.id);
  } catch (err) {
    console.error('[A2] 号車複製失敗', err);
    if (copyBtn?.isConnected) { copyBtn.disabled = false; }
  } finally {
    _saving = false;
  }
}

async function selectTruck(truckId) {
  _truckPanelMode                 = null;
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
  if (_eventsBound) return;
  _eventsBound = true;

  elTruckList.addEventListener('click', async e => {
    const copyBtn = e.target.closest('[data-copy-truck]');
    if (copyBtn) { await _handleCopyTruck(copyBtn.dataset.copyTruck); return; }

    const editBtn = e.target.closest('[data-edit-truck]');
    if (editBtn) {
      // 編集対象号車を選択済みにしてからフォームを開く
      const truckId = editBtn.dataset.editTruck;
      adminState.selectedTruckId = truckId;
      _truckPanelMode = 'edit';
      renderTruckList();
      renderRightPanel();
      return;
    }

    const btn = e.target.closest('[data-truck-id]');
    if (btn) selectTruck(btn.dataset.truckId);
  });

  document.getElementById('admin-truck-add-btn')?.addEventListener('click', () => {
    _truckPanelMode = 'new';
    renderRightPanel();
  });

  elMainGrid.addEventListener('click', async e => {
    const switchBtn = e.target.closest('[data-switch-plan-id]');
    if (switchBtn && adminState._onSwitchA2Plan) {
      await adminState._onSwitchA2Plan(
        switchBtn.dataset.switchProjectId,
        switchBtn.dataset.switchPlanId,
      );
      return;
    }
    const cell = e.target.closest('[data-item-id]');
    if (cell) selectItem(cell.dataset.itemId, e);
  });

  // ダブルクリックで品目を即編集（単クリック選択と競合しない）
  // click が先行して renderMainGrid() を呼ぶため e.target は detach 済みの可能性がある。
  // 代わりに click 時に確定済みの adminState.selectedItemId を使う。
  elMainGrid.addEventListener('dblclick', () => {
    const itemId = adminState.selectedItemId;
    if (!itemId || !adminState.selectedTruckId) return;
    const items = adminState.itemsCache[adminState.selectedTruckId] ?? [];
    const item  = items.find(i => i.id === itemId);
    if (!item) return;
    _diffDraft = [...(item.diffs ?? [])];
    adminState.rightPanelMode = 'edit';
    // グリッドは click 時に描画済みのため再描画不要
    renderRightPanel();
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

    // 号車フォームアクション
    const truckAction = e.target.closest('[data-truck-action]')?.dataset.truckAction;
    if (truckAction) {
      if (truckAction === 'save')           { await _handleTruckSave(); return; }
      if (truckAction === 'cancel')         { _truckPanelMode = null; renderRightPanel(); return; }
      if (truckAction === 'delete-request') { _truckPanelMode = 'delete-confirm'; renderRightPanel(); return; }
      if (truckAction === 'delete-confirm') { await _handleTruckDelete(); return; }
      if (truckAction === 'delete-cancel')  { _truckPanelMode = 'edit'; renderRightPanel(); return; }
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
      // 一括フォームの入力を保存してから切替
      _bulkFormDraft   = _readBulkFormData();
      _bulkDraft       = [];
      _inputHistoryTab = 'input';
      adminState.rightPanelMode = 'new';
      renderRightPanel();
      return;
    }

    if (action === 'mode-bulk') {
      // 単品フォームの入力を保存してから切替
      _singleFormDraft = _readFormData();
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
  // プレビュー内のインライン編集 input は除外（フォーカスが飛ぶのを防ぐ）
  elRightContent.addEventListener('input', e => {
    if (adminState.rightPanelMode !== 'bulk') return;
    if (e.target.closest('#rp-bulk-preview')) return;
    _updateBulkPreview();
  });
  elRightContent.addEventListener('change', e => {
    if (adminState.rightPanelMode !== 'bulk') return;
    if (e.target.closest('#rp-bulk-preview')) return;
    _updateBulkPreview();
  });

  // Delete キー: フォーム編集中は無効化、それ以外は品目削除
  document.addEventListener('keydown', async e => {
    if (e.key !== 'Delete') return;
    const mode = adminState.rightPanelMode;
    if (mode === 'edit' || mode === 'new' || mode === 'bulk') return; // フォーム入力中は誤削除防止
    if (!adminState.selectedTruckId || !adminState.selectedItemId) return;
    await _handleDelete();
  });

  _initSuggestSidebar();
}

// ── Init ───────────────────────────────────────────────────

/**
 * 品目グリッド画面（A2）を指定計画で初期化する
 * calendar.js から呼ばれる。ヘッダー更新は呼び出し元が行う。
 * @param {string} projectId
 * @param {string} planId
 */
export async function initGridScreen(projectId, planId) {
  _truckPanelMode                 = null;
  adminState.selectedProjectId    = projectId;
  adminState.selectedPlanId       = planId;
  adminState.selectedTruckId      = null;
  adminState.selectedItemId       = null;
  adminState.multiSelectedItemIds = [];
  adminState.rightPanelMode       = 'idle';
  adminState.trucks               = [];
  adminState.itemsCache           = {};
  // 搬入日切替または A2 離脱時はフォーム draft をリセット
  _singleFormDraft = null;
  _bulkFormDraft   = null;

  bindEvents(); // 2回目以降は no-op

  const trucks = await getTrucksForPlan(projectId, planId);
  adminState.trucks = trucks;

  if (trucks.length > 0) {
    await selectTruck(trucks[0].id);
  } else {
    renderTruckList();
    renderMainGrid();
    renderRightPanel();
  }
}

/** 後方互換: DEV デフォルト計画で直接グリッドを開く */
export async function initAdmin() {
  renderHeader();
  await initGridScreen(
    adminState.selectedProjectId ?? 'dev-project-1',
    adminState.selectedPlanId    ?? 'dev-plan-1',
  );
}
