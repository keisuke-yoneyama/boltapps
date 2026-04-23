# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 開発・実行環境

**ビルドシステムなし。** package.json / npm / bundler は存在しない。

- ブラウザのネイティブ ES modules (`type="module"`) を直接使用
- Firebase SDK は CDN から読み込み (`https://www.gstatic.com/firebasejs/11.6.1/...`)
- 開発時は静的ファイルサーバー（例: VS Code Live Server）で `index.html` を開く
- bolt: ルート `index.html`
- admin: `admin/index.html`
- field: `field/index.html`
- Netlify へのデプロイは `_redirects` がルーティングを担う

---

## bolt アプリのモジュール構成

エントリポイント: `js/app.js` → `js/modules/`

| モジュール | 責務 |
|---|---|
| `state.js` | シングルトン `state` オブジェクト。UI状態・選択状態・ヒストリー管理 |
| `firebase.js` | Firebase初期化、`db`・`auth`・`appId`・`projectsCollectionRef` を export |
| `db.js` | Firestore CRUD関数。`subscribeToProjects`・`getGlobalSettings` など |
| `calculator.js` | ボルト本数計算ロジック（純粋関数寄り）。ボルトサイズ移行処理も担う |
| `events.js` | DOMイベントリスナー一括登録。`setupEventListeners()` のみ export |
| `ui.js` | メインUI描画・モーダル制御・タブ切替・クイックナビ |
| `ui-joints.js` | 継手フォーム・継手リスト描画 |
| `ui-members.js` | 部材フォーム・部材リスト描画 |
| `ui-results.js` | 集計・発注詳細・工場使用仮ボルト集計 描画 |
| `ui-modal.js` | 汎用モーダル開閉 (`openModal` / `closeModal`) |
| `ui-projects.js` | プロジェクト一覧UI |
| `ui-notifications.js` | トースト通知 |
| `ui-theme.js` | ダーク/ライトテーマ切替 |
| `delivery.js` / `delivery-db.js` / `delivery-state.js` | 搬入関連（bolt側） |
| `config.js` | 定数・設定値 |

### state → ui の流れ
1. Firestore `onSnapshot` → `db.js` → `state.projects` 更新 → UI再描画
2. ユーザー操作 → `events.js` → `state` 変更 → UI関数呼び出し
3. グローバルボルトサイズは `state.globalBoltSizes`（Firestoreパス: `artifacts/${appId}/public/data/settings/global`）

### モーダル再利用パターン
- `edit-member-modal` は新規登録・編集の両方で使う（`edit-member-id` が空なら新規）
- `edit-joint-modal` も同様
- 新規登録時はタイトルを書き換えてIDをクリアして `openModal` を呼ぶ

---

## admin アプリのモジュール構成

エントリポイント: `admin/app.js` → `admin/`（`js/admin/`ではなく`admin/`直下）

| モジュール | 責務 |
|---|---|
| `admin/state.js` | `adminState` シングルトン |
| `admin/db.js` | Firestore CRUD（deliveryPlan / truck / item） |
| `admin/ui.js` | A0/A1/A2 画面描画 |
| `admin/calendar.js` | カレンダー描画・シリーズ管理 |
| `admin/suggest-data.js` | 入力補助データ |

---

## このプロジェクトの目的
このリポジトリは、建築鉄骨ファブ向けの業務アプリ群を管理する。

主なアプリは以下の3つ。

- bolt: ボルト本数計算アプリ
- field: 現場向け搬入閲覧・チェックアプリ
- admin: 事務所向け搬入入力・管理アプリ

最重要方針は、**既存機能を壊さず、段階的に改善すること**。

---

## 最優先ルール

### 1. 既存機能保護を最優先
- 既存の bolt / field の動作を壊さないこと
- 大規模リファクタは禁止
- 一気に設計を変えず、最小差分で進める
- 既存コードを削除する前に、影響範囲を説明すること

### 2. まず方針確認、次に実装
- いきなり大量変更しない
- まず変更対象ファイル一覧を示す
- 次に実装方針を短く説明する
- その後に実装する

### 3. 共通化は慎重に
- shared-domain / shared-ui / shared-firebase への切り出しは歓迎
- ただし「本当に共通化すべきもの」だけを移す
- アプリ固有ロジックを無理に shared に入れない

### 4. UIより業務ルールを優先
このプロジェクトでは見た目の美しさより、以下を優先する。
- 入力速度
- ミス防止
- 実務での視認性
- 既存業務フローとの整合
- 鉄骨ファブ実務への適合

---

## アプリごとの役割

### bolt
- 工事名
- 部材名
- 種別
などの元データを持つ

### field
- 閲覧と積込チェックに特化
- 入力導線は持たない
- 主要導線は 0 → 3 → 4

### admin
- 搬入リスト入力・編集・公開に特化
- 現場アプリへ渡す元データを作る
- 画面 A0（カレンダー）・A1（計画登録フォーム）・A2（グリッド編集）が中核

---

## admin 画面構成

### A0: カレンダー画面
- 月間カレンダーで搬入計画を一覧する
- 右サイドバー: シリーズ編集（`a0edit` 状態で管理）
- 計画削除は必ずカスケード削除（trucks / items も削除）

### A1: 計画登録フォーム
- 工事選択 → 日付・納入日数・日程モード入力 → プレビュー → 登録
- 登録するとシリーズ（`deliverySeriesId` 共通の複数 plan）が作られる
- `deliverySeriesIndex` で順序管理、`deliverySeriesLength` でシリーズ長管理

### A2: グリッド編集画面
- 搬入計画1件の号車・品目を編集する中核画面
- 上部ヘッダ: 工事名 / 搬入○日目 / 計画図番○
- 上部タブ: 同一シリーズの日切替（`_onSwitchA2Plan` コールバック経由）
- 左ペイン: 号車一覧（＋ボタンで追加）
- 中央: 種別別4列グリッド
- 右サイドバー: `idle / view / edit / new / bulk` モード

#### A2 右サイドバーモード
- `rightPanelMode`: `'idle' | 'view' | 'edit' | 'new' | 'bulk'`
- `_truckPanelMode`: モジュール変数 `null | 'new' | 'edit' | 'delete-confirm'`
  - renderRightPanel() では `_truckPanelMode` を先にチェックし、非 null なら号車フォームを表示
  - 号車フォーム表示中は `rightPanelMode` を見ない

---

## 重要な業務ルール

### 計画図番
- 計画図番は truck 単位ではなく deliveryPlan 単位
- 同一搬入日・同一工事では全号車共通
- 同日でも工事が違えば別でよい

### 建方○日目
- 計画図番とは別データ（`dayIndex` フィールド）
- deliveryPlan 単位で保持
- field の画面3 / 4 に表示する
- A2 ヘッダにも表示する

### 進捗判定
field 側の進捗は手入力ではなく、item.checked から自動判定する。

- 全OFF: 未着手
- 一部ON: 積込み中
- 全ON: 完了

admin 側では進捗表示は不要。

### 差分
差分は品目に対して保持する。

基本情報:
- 日付
- 種別（追加 / 削除 / 変更）

表示方針:
- 日付ごとに固定色
- 画面3: 号車カードに短い差分バッジ
- 画面4: 品目カードに短い差分バッジ
- 差分件数表示は不要なことがあるため、画面ごとの要件を優先すること

### 品名の構造
品名は以下の構造体として扱う。

- prefix（頭マーク）
- baseName（部材名）
- separator（つなぎ文字）
- suffix（枝番）
- note（補足）

表示名は buildItemName 的な関数で組み立てる。

### 品名ソート
自然順ソートを行う。

例:
- 2B100-1 は 2B140-1 より先
- 2B100-1 は 3B100-1 より先
- 補足（例: ×4）はソート比較から除外

### 種別（カテゴリ）
実務に合わせた固定リストを使う。順序は以下の通り。

```
柱 / 間柱 / 大梁 / 小梁 / ブレス / ボルト / 仮ボルト / デッキ / コン止め / その他
```

- ボルトアプリ由来データは種別を自動取得
- 手入力時は種別をユーザー選択
- ピン取りは考慮せず、実務分類に丸める

---

## admin 画面Aの設計思想

### レイアウト
- 上部: 搬入計画ヘッダ（工事名 / 搬入○日目 / 計画図番○）
- 左: 号車一覧
- 中央: 種別別4列グリッド
- 右: 入力補助 / 詳細編集サイドバー

### 中央グリッド
- 種別ごとのセクション
- 各セクションは4列グリッド
- データがない種別は表示しない
- 品目セルは簡潔表示
- 詳細編集は右サイドバーで行う
- グリッド最上部にシリーズ日切替タブを表示（同一シリーズ計画が2件以上の場合のみ）

### 右サイドバー
- idle / view / edit / new を持つ
- 入力補助単品モード
- 入力補助一括モード
- 復元機能は入力補助内のみで使う
- 手入力モードでは復元しない

### 復元機能
- 入力補助サイドバー内の機能
- 単品 / 一括の両モードで使用
- 履歴選択でインプット群へ展開
- 品目リストへは自動登録しない

### 一括登録
- 入力補助の一機能
- 登録個数は 2〜30
- 枝番連番補完 ON/OFF
- 生成プレビュー必須
- 保存時は単品 item の集合として扱う

---

## Firestore 方針

基本構造:

- projects/{projectId}
- projects/{projectId}/deliveryPlans/{planId}
- projects/{projectId}/deliveryPlans/{planId}/trucks/{truckId}
- projects/{projectId}/deliveryPlans/{planId}/trucks/{truckId}/items/{itemId}

### 重要
- Firestore 構造は安易に変更しない
- path 変更は影響範囲を必ず説明する
- deliveryPlans は project 配下
- 月間取得は collectionGroup 前提になる可能性がある

### カスケード削除
**Firestore はドキュメント削除時にサブコレクションを自動削除しない。**
deliveryPlan を削除する際は必ず以下の順でカスケード削除すること。

1. `deletePlanCascade(projectId, planId)`: plan配下のすべてのtrucksを取得 → 各truckを `deleteTruckCascade` で削除 → plan本体を削除
2. `deleteTruckCascade(projectId, planId, truckId)`: truck配下のすべてのitemsを取得 → 各itemを削除 → truck本体を削除
3. `deletePlansBySeriesId(projectId, seriesId)`: シリーズIDで一致するplansをFirestoreから取得 → 各planを `deletePlanCascade` で削除

単体の `deletePlan` / `deleteTruck` / `deleteItem` は意図的な部分削除のみに使う。

### MVP方針
- checks サブコレクションは必須ではない
- まずは item.checked を優先する

---

## adminState の重要フィールド

```js
adminState.a2 = {
  currentPlan: null,   // 現在A2で表示中のplan（ヘッダ・タブ表示に使う）
  seriesPlans: [],     // 同一deliverySeriesIdのplan群（deliverySeriesIndex昇順）
};

adminState._onSwitchA2Plan = null;
// calendar.js がセットするコールバック。
// ui.js から日切替タブクリック時に呼び出す。
// ui.js → calendar.js の直接 import は循環依存になるため、このコールバックで解決する。

adminState.a0edit = {
  projectId: null,
  plans: [],           // 編集対象計画（deliverySeriesIndex順）
  dateAssignMode: 'all_days',
};
```

---

## 実装上の注意点（過去バグからの教訓）

### SCREEN_DISPLAY の calendar は 'flex' にすること
```js
const SCREEN_DISPLAY = {
  calendar: 'flex',   // ← 'block' にすると右サイドバーが下に落ちるバグが出る
  'plan-form': 'block',
  grid: 'flex',
};
```

### 一括プレビューのフォーカスバグ対策
`elRightContent` の `input` イベントリスナーで `_updateBulkPreview()` を呼ぶ際、
`#rp-bulk-preview` 内のインライン編集 input からイベントが bubble してくると
再レンダリングで DOM が破壊されフォーカスが失われる。

```js
elRightContent.addEventListener('input', e => {
  if (adminState.rightPanelMode !== 'bulk') return;
  if (e.target.closest('#rp-bulk-preview')) return; // ← この行が必須
  _updateBulkPreview();
});
```

---

## Netlify 方針

このプロジェクトは **1 Netlify サイト + 複数パス運用** を前提とする。

想定URL:
- /bolt/
- /field/
- /admin/

ルール:
- 絶対パスを避ける
- 相対パスを優先する
- 各アプリは index.html を持つ
- _redirects を壊さない

---

## 変更時の出力ルール

Claude は実装前に、必ず以下を出すこと。

1. 変更対象ファイル一覧
2. 実装方針
3. 既存機能を壊さないための注意点

大きな変更では、さらに以下も出すこと。

4. 影響範囲
5. 既存コードから流用する部分
6. 今回触らないファイル

---

## 実装ルール

### やってよい
- 小さな関数分割
- shared-domain への純粋関数切り出し
- UIの局所改善
- テストデータ追加
- フォールバック維持しつつ整理

### やってはいけない
- 無断で大規模ファイル移動
- bolt / field / admin をまとめて一気に作り直す
- Firestore構造を勝手に変更
- 既存HTMLエントリを消す
- 既存フォールバックを急に削除
- 管理アプリ都合で field 側の挙動を壊す

---

## テストデータ方針
テストデータは、最新要件を確認できるように維持する。

最低限確認できること:
- 複数工事
- 計画図番あり / なし
- 建方○日目あり（`dayIndex` フィールド）
- 差分あり
- 注意あり
- 積込指示あり
- 種別が複数ある（柱・大梁・小梁・ボルト など）
- 進捗判定確認用に checked 状態が混在
- admin の中央グリッドで種別別セクションが確認できる
- シリーズ計画（`deliverySeriesId` 共通の複数 plan）が確認できる
- A2 の日切替タブが表示される状態が確認できる

---

## コード品質方針
- 名前は実務に寄せて明確にする
- 複雑な処理は関数化する
- 純粋関数にできるものは shared-domain に寄せる
- 一時対応なら TODO を残す
- コメントは「なぜ必要か」を書く
- 見た目だけの修正でロジックを壊さない

---

## 困った時の優先順位
判断に迷ったら、以下の順で優先する。

1. 既存機能を壊さない
2. 実務フローに合う
3. 最小差分
4. 将来共通化しやすい
5. 見た目のきれいさ

---

## Claudeへの期待
- 実装前に整理して提案すること
- 最小差分で進めること
- shared 化は慎重に行うこと
- 業務ルールを勝手に変えないこと
- 不明点があれば、コードから推測しつつ安全側に倒すこと
