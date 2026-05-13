# Firestore接続設計 引き継ぎ資料

対象: Blazor Hybrid モバイルアプリ実装者  
Web参照元: `js/modules/firebase.js`, `js/modules/db.js`, `js/app.js`

---

## 1. Firebase設定とappId解決

### Firebase設定の読み込み

Webアプリは2つの環境で動作する。

| 環境 | 設定の取得元 |
|---|---|
| Netlify本番 | `firebase-env.js`（ビルド時に生成される静的ファイル） |
| Canvas開発環境 | グローバル変数 `__firebase_config`（JSONシリアライズ文字列） |

```js
const firebaseConfig =
  typeof __firebase_config !== "undefined"
    ? JSON.parse(__firebase_config)
    : netlifyFirebaseConfig; // firebase-env.js由来
```

**Blazorでの対応方針**: `google-services.json`（Android）/ `GoogleService-Info.plist`（iOS）に設定を持ち、
`FirebaseApp.InitializeApp()`で初期化する。Webアプリと同一Firebaseプロジェクトに接続する。

---

### appIdの解決

Webアプリ内では**appId**がFirestoreパスの一部として使われる。

```js
export const appId =
  typeof __app_id !== "undefined"
    ? __app_id                            // Canvas開発環境: 独自のアプリID
    : firebaseConfig.projectId;           // Netlify本番: Firebaseプロジェクト名
```

本番環境では `appId === firebaseConfig.projectId`（例: `"bolt-calculator-3b175"`）。

**Blazorでの対応**: `FirebaseApp.DefaultInstance.Options.ProjectId` を appId として使用する。

---

## 2. Firestoreパス一覧

```
artifacts/{appId}/public/data/projects/               ← プロジェクト一覧コレクション
artifacts/{appId}/public/data/projects/{projectId}    ← 個別プロジェクトドキュメント
artifacts/{appId}/public/data/settings/global         ← グローバルボルトサイズマスタ
```

Webアプリでは以下のように参照している。

```js
projectsCollectionRef = collection(db, `artifacts/${appId}/public/data/projects`);
globalSettingsPath     = `artifacts/${appId}/public/data/settings/global`;
```

---

## 3. 認証フロー

### 認証方式

| 環境 | 方式 |
|---|---|
| 本番（Netlify） | 匿名認証 `signInAnonymously` |
| 開発（Canvas） | カスタムトークン認証 `signInWithCustomToken(__initial_auth_token)` |

### フロー概要

```
onAuthStateChanged
  ├─ user存在 → loadGlobalSettings() + loadProjects()
  └─ user不在
       ├─ isDevelopmentEnvironment && __initial_auth_token あり → signInWithCustomToken
       └─ それ以外 → signInAnonymously
            └─ 成功 → 再度 onAuthStateChanged 発火 → loadProjects()
```

### Blazorでの対応

`FirebaseAuth.DefaultInstance.SignInAnonymouslyAsync()` で匿名サインイン後にFirestoreアクセスを開始する。
認証完了を待たずにFirestoreを読もうとするとパーミッションエラーになるため、
**必ず認証完了後にデータ取得を開始すること**。

---

## 4. プロジェクトドキュメント構造

`projects/{projectId}` の1ドキュメント = 1工事。継手・部材・箇所数・設定を全て含む大きなドキュメント。

### 4-1. トップレベルフィールド（全モード共通）

| フィールド | 型 | 説明 |
|---|---|---|
| `name` | string | 工事名（UIでの主キー的役割） |
| `propertyName` | string | 物件名（任意） |
| `mode` | `"simple"` \| `"advanced"` | 工事設定モード |
| `joints` | Joint[] | 継手の配列（後述） |
| `members` | Member[] | 部材の配列（後述） |
| `tally` | Record<locationId, Record<memberId, number>> | 箇所数マトリクス |
| `tallyLocks` | Record<string, boolean> | 箇所数のロック状態 |
| `isTallySheetGenerated` | boolean | 集計シート生成済みフラグ |
| `tempBoltMap` | object | 仮ボルトマッピング。キー: 本ボルトサイズ（例: `"M20×60"`）、値: 対応仮ボルトサイズ（例: `"M20×50"`） |
| `tempBoltKindMap` | object | 仮ボルト種別マッピング。キー: 本ボルトサイズ、値: 種別文字列（`"HUG"` / `"中ボルト(Mネジ)"` / `"中ボルト(Wネジ)"`）。未設定時は全て `"HUG"` 扱い |
| `groupingSettings` | GroupingSettings | 工区まとめ設定（後述） |

### 4-2. simpleモード固有フィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `floors` | number | 最上階（2以上）。2F〜RF + PH が生成される |
| `sections` | number | 工区数。1〜Nで連番IDが生成される |
| `hasPH` | boolean | PH階（ペントハウス）の有無 |

simpleモードでは工区IDが自動生成される。  
フォーマット: `"{floor}-{section}"` → 例: `"2-1"`, `"3-2"`, `"R-1"`, `"PH-1"`

### 4-3. advancedモード固有フィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `customLevels` | string[] | カスタム階層名（例: `["1F", "2F", "RF"]`） |
| `customAreas` | string[] | カスタムエリア名（例: `["A工区", "B工区"]`） |

advancedモードの工区IDはフォーマット: `"{level}-{area}"` 形式（カスタム文字列の組み合わせ）。

---

### 4-4. Joint（継手）オブジェクト構造

`joints` 配列の各要素。1つの接合部タイプを表す。

#### 基本フィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `id` | string | `"joint_{timestamp}"` 形式のユニークID |
| `name` | string | 継手名（プロジェクト内でユニーク） |
| `type` | string | 継手種別（下記参照） |
| `color` | string \| null | 表示色（CSS color文字列） |
| `isPinJoint` | boolean | ピン接合フラグ |
| `isDoubleShear` | boolean | 2面せん断フラグ（isPinJointがtrueの場合のみ有効） |
| `countAsMember` | boolean | 部材リストに仮想部材として表示するかどうか |

#### 継手種別（type）一覧

| 値 | 日本語 | 備考 |
|---|---|---|
| `"girder"` | 大梁 | ピン接合可 |
| `"beam"` | 小梁 | ピン接合可 |
| `"column"` | 本柱 | ピン接合不可 |
| `"stud"` | 間柱 | ピン接合可 |
| `"wall_girt"` | 胴縁 | ピン接合不可 |
| `"roof_purlin"` | 母屋 | ピン接合不可 |
| `"other"` | その他 | ピン接合可 |

#### ボルト設計フィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `flangeSize` | string | フランジボルトサイズ（例: `"M20×60"`）。ピン接合時は空 |
| `flangeCount` | number | フランジボルト本数。ピン接合時は0 |
| `webSize` | string | ウェブボルトサイズ。complexSpl時は空 |
| `webCount` | number | ウェブボルト本数。complexSpl時は0 |
| `isComplexSpl` | boolean | 複合型SPL（ウェブが複数種類）フラグ |
| `complexSplCount` | number \| null | 複合SPL時のウェブグループ数 |
| `webInputs` | `{size:string, count:number}[]` \| null | 複合SPL時の各ウェブ詳細 |

#### 工場SPL・組立フィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `hasShopSpl` | boolean | 工場SPLフラグ（工場接合部） |
| `hasBoltCorrection` | boolean | 工場SPL時のボルト本数補正フラグ |
| `isShopGroundAssembly` | boolean | 工場建方組立フラグ |
| `isGroundAssembly` | boolean | 建方組立フラグ |

#### 仮ボルトフィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `tempBoltSetting` | string | 仮ボルト設定方式。`"calculated"`（自動計算）または `"none"`（手動）。本柱は常に `"none"` |
| `shopTempBoltCount` | number \| null | 工場仮ボルト本数（本柱・ピンDoubleShear・手動設定時） |
| `shopTempBoltSize` | string \| null | 工場仮ボルトサイズ（ピンDoubleShear・手動設定の継手のみ）。**本柱は廃止**済み → `project.tempBoltMap[flangeSize]` を参照 |
| `shopTempBoltCount_F` | number \| null | フランジ側工場仮ボルト本数（F/W分離指定時） |
| `shopTempBoltSize_F` | string \| null | フランジ側工場仮ボルトサイズ |
| `shopTempBoltCount_W` | number \| null | ウェブ側工場仮ボルト本数 |
| `shopTempBoltSize_W` | string \| null | ウェブ側工場仮ボルトサイズ |

**本柱（`type === "column"`）の仮ボルト解決ロジック:**

```
仮ボルトサイズ = project.tempBoltMap[joint.flangeSize]  // 優先
                 ?? joint.shopTempBoltSize               // 旧データフォールバック
仮ボルト本数   = joint.shopTempBoltCount               // 継手ごとに手動設定
```

本柱のサイズは「仮ボルト対応設定」モーダルで `flangeSize`（エレクションサイズ）単位で一括管理する。

#### 配置フラグ

| フィールド | 型 | 説明 |
|---|---|---|
| `isBundledWithColumn` | boolean | 本柱まとめフラグ。本柱以外の継手が本柱と同一工区まとめに含まれる |

---

### 4-5. Member（部材）オブジェクト構造

`members` 配列の各要素。1部材 = 1エントリ。

| フィールド | 型 | 説明 |
|---|---|---|
| `id` | string | `"member_{timestamp}"` 形式のユニークID |
| `name` | string | 部材名 |
| `jointId` | string | 使用する継手のID（joints配列内の `id` を参照） |
| `targetLevels` | string[] | この部材が使われる階層ID一覧。空配列 = 全階層適用 |

**注意**: `countAsMember: true` の継手は `members` 配列には入らない。  
部材UIには仮想的に表示されるが、Firestoreには継手として保存されている。

---

### 4-6. Tally（箇所数）構造

```js
tally: {
  "2-1": {
    "member_1234": 3,   // 2-1工区に部材Aが3箇所
    "member_5678": 1,   // 2-1工区に部材Bが1箇所
  },
  "3-2": {
    "member_1234": 2,
  },
  // ...
}
```

キー形式: `tally[locationId][memberId] = 箇所数（整数）`

- locationId: `"2-1"`, `"R-1"`, `"PH-1"` など（simpleモード）
- memberId: `members` 配列の `id` フィールド
- 値が0またはundefinedの場合はその工区に箇所なし
- Firestore書き込みは dot notation 部分更新: `{ "tally.2-1.member_1234": 3 }`

---

### 4-7. groupingSettings（工区まとめ設定）構造

```js
groupingSettings: {
  honBolt: {
    "2-1": 1,
    "2-2": 1,   // 2-1 と同グループ → 注文明細で合算表示される
    "3-1": 2,
    "R-1": 3,
  },
  tempBolt: {
    "2-1": 1,
    "2-2": 2,
    "3-1": 1,   // 2-1 と同グループ
  }
}
```

- キー: locationId（`"2-1"` など）
- 値: グループ番号（1始まりの整数）
- honBolt と tempBolt は独立して管理・保存される
- **未設定の場合**: `project.groupingSettings` 自体が存在しない → デフォルト（全工区を別グループ）
- 書き込みは dot notation 部分更新: `updateDoc(ref, { "groupingSettings.honBolt": {...} })`

---

## 5. Firestoreに保存されないもの（重要）

以下はすべて**クライアントサイドで計算する**。Firestoreには存在しない。

| 情報 | 説明 |
|---|---|
| `resultsByLocation` | 工区ごとのボルト本数集計。joints × members × tally × boltPatterns から毎回計算 |
| 注文明細のグループ名 | `"2-1 + 2-3"` や `"No.1 (2-3, 3-2)"` は groupingSettings を読んで描画時に生成 |
| 工区一覧（locationIds） | `getMasterOrderedKeys(project)` で project.floors / sections などから生成 |
| 部材リストの表示グループ | `memberSections` 固定配列に基づき `type × isPinJoint` でグループ化（描画時に分類） |
| 集計結果（重量など） | ボルト本数 × 重量テーブルで計算 |
| 仮ボルト本数（建方） | `tally × joint.tempBoltSetting` から計算 |

**Blazorでの注意**: `project` ドキュメントを読んだだけでは集計結果は得られない。
`calculator.js` に相当するロジックをDart/C#で再実装する必要がある。

---

## 6. データ取得パターン

### 6-1. リアルタイム購読（推奨）

`onSnapshot` で全プロジェクトを購読する。変更があれば即座に通知される。

```js
// Webアプリの実装
subscribeToProjects((projects, source) => {
  if (source === "Local") return;  // 自分自身の書き込みによる更新はスキップ
  state.projects = projects;       // 全プロジェクトをメモリに保持
  // UI再描画...
});
```

重要: **個別プロジェクトの詳細取得は行わない。** 全プロジェクトを一括でメモリ上に持ち、
選択時はそこから `find` する設計。

### 6-2. 一度限りの全件取得

```js
const projects = await getAllProjects();
// snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
```

### 6-3. 個別プロジェクト取得

```js
const project = await getProjectById(projectId);
// getDoc(doc(ref, projectId)) → { id, ...data }
```

### 6-4. ドキュメントのマッピング

Webアプリは変換なしでフラットスプレッドする。

```js
{ id: doc.id, ...doc.data() }
```

Blazorでは `DocumentSnapshot` → C#モデルへの明示的なマッパーが必要（後述）。

---

## 7. データ書き込みパターン

### 7-1. 汎用部分更新（最多使用）

```js
await updateProjectData(projectId, {
  members: newMembersList,
});
```

内部では `updateDoc(ref, data)` を呼ぶ。**既存フィールドを上書きせずに指定フィールドだけ更新**する。

### 7-2. dot notation による深い部分更新

Firestore は dot notation で入れ子フィールドを個別更新できる。

```js
// tally の特定工区・部材のみ更新（他の工区は触らない）
await updateProjectData(projectId, {
  "tally.2-1.member_1234": 5,
});

// groupingSettings.honBolt のみ更新（tempBolt は触らない）
await updateProjectData(projectId, {
  "groupingSettings.honBolt": { "2-1": 1, "2-2": 1, "3-1": 2 },
});
```

### 7-3. 配列フィールドの全件置換

joints・members はFirestoreでは配列として保存されており、
変更時は**配列全体を上書き**する（Firestore配列への部分更新は使わない）。

```js
await updateProjectData(projectId, {
  joints: updatedJointsArray,   // 全件
  members: updatedMembersArray, // 全件
});
```

### 7-4. 新規プロジェクト作成

```js
await addProject({
  name, propertyName, mode,
  floors, sections, hasPH,       // simpleモードの場合
  joints: [],
  members: [],
  tally: {},
  isTallySheetGenerated: false,
  tempBoltMap: {},
  tempBoltKindMap: {},
  tallyLocks: {},
});
```

---

## 8. sessionStorageキャッシュパターン

Webアプリは起動を高速化するため `sessionStorage` にプロジェクト一覧をキャッシュしている。

```js
const BOLT_PROJECTS_CACHE_KEY = 'boltProjectsCache';

// 起動時: キャッシュがあれば即座に表示（認証完了を待たない）
const cached = sessionStorage.getItem(BOLT_PROJECTS_CACHE_KEY);
if (cached) {
  state.projects = JSON.parse(cached);
  updateProjectListUI(); // 即座に描画
}

// onSnapshot 更新時: キャッシュを更新
sessionStorage.setItem(BOLT_PROJECTS_CACHE_KEY, JSON.stringify(state.projects));
```

**Blazorでの対応**: モバイルでは `Preferences` または SQLite に同様のキャッシュを持つことを検討する。
初回表示でのローディング体験が改善される。

---

## 8b. 仮ボルト設定システム詳細

### 仮ボルト種別

仮ボルトは3種別に分かれ、本ボルト系統（M16 / M20 / M22）ごとに**個別に**種別を設定できる。

| 種別文字列 | 短縮表示 | M16系 | M20系 | M22系 |
|---|---|---|---|---|
| `"HUG"` | HUG | M16(HUG): 30〜60mm×10mmステップ | M20(HUG): 40〜100mm | M22(HUG): 50〜140mm |
| `"中ボルト(Mネジ)"` | 中ボM | M16: 35〜60mm | M20: 35〜100mm | M22: 50〜110mm |
| `"中ボルト(Wネジ)"` | 中ボW | W5/8: 38, 45, 50, 55mm | W3/4: 38〜100mm | W7/8: 45〜115mm |

### Firestoreに保存される仮ボルト設定フィールド

```js
// プロジェクトドキュメント内
tempBoltMap: {
  "M16×40": "M16×35",     // 本ボルトサイズ → 使用する仮ボルトサイズ
  "M20×60": "M20×50",
  "M22×70": "W7/8×65",    // 中ボルト(Wネジ)選択時はW系サイズになる
  // 本柱のエレクションサイズも含まれる
  "M22×90": "M22×75",
}

tempBoltKindMap: {
  "M16×40": "HUG",             // 本ボルトサイズ → 仮ボルト種別
  "M20×60": "中ボルト(Mネジ)",
  "M22×70": "中ボルト(Wネジ)",
  "M22×90": "HUG",             // 本柱のエレクションサイズも含まれる
}
```

**設計ポイント:**
- `tempBoltKindMap` が存在しないキー、またはフィールド自体が存在しない場合 → `"HUG"` として扱う（後方互換）
- 旧データ（`tempBoltKind`: 単一文字列）は廃止。読み込まない
- 本柱（`type === "column"`）の `flangeSize` も `tempBoltMap` / `tempBoltKindMap` の対象に含まれる

### 仮ボルト集計の計算方法（Blazor実装参考）

**建方用仮ボルト**（`calculateTempBoltResults`）:
- 対象: `tempBoltSetting === "calculated"` かつ `type` が `column / wall_girt / roof_purlin` 以外の継手
- `joint.flangeSize / webSize` → `project.tempBoltMap[size]` → 仮ボルトサイズ取得
- 本数は継手タイプ・ボルト本数に応じた計算式で算出（`getTempBoltInfo` 関数）

**工場仮ボルト**（`calculateShopTempBoltResults`）:
- `type === "column"`: `tempBoltMap[flangeSize]` のサイズ × `shopTempBoltCount` 本数
- `hasShopSpl && tempBoltSetting === "none"`: `shopTempBoltSize` / `shopTempBoltSize_F` / `shopTempBoltSize_W` × 対応本数
- `hasShopSpl && tempBoltSetting === "calculated"`: `getTempBoltInfo` で計算

### 表示時の種別ラベル変換

```
"HUG"          → "HUG"
"中ボルト(Mネジ)" → "中ボM"
"中ボルト(Wネジ)" → "中ボW"
```

---

## 9. Blazor Hybrid 実装ガイド

### 9-1. C#モデル設計

Firestoreのフィールド名はすべてキャメルケース（`isPinJoint` など）なので、
C#モデルでは `[FirestoreProperty]` アトリビュートで対応する。

```csharp
[FirestoreData]
public class ProjectDocument
{
    [FirestoreProperty("name")]
    public string Name { get; set; }

    [FirestoreProperty("propertyName")]
    public string? PropertyName { get; set; }

    [FirestoreProperty("mode")]
    public string Mode { get; set; }  // "simple" | "advanced"

    // simple mode
    [FirestoreProperty("floors")]
    public int? Floors { get; set; }

    [FirestoreProperty("sections")]
    public int? Sections { get; set; }

    [FirestoreProperty("hasPH")]
    public bool? HasPH { get; set; }

    // advanced mode
    [FirestoreProperty("customLevels")]
    public List<string>? CustomLevels { get; set; }

    [FirestoreProperty("customAreas")]
    public List<string>? CustomAreas { get; set; }

    [FirestoreProperty("joints")]
    public List<JointDocument> Joints { get; set; } = new();

    [FirestoreProperty("members")]
    public List<MemberDocument> Members { get; set; } = new();

    [FirestoreProperty("tally")]
    public Dictionary<string, Dictionary<string, long>> Tally { get; set; } = new();

    [FirestoreProperty("groupingSettings")]
    public GroupingSettings? GroupingSettings { get; set; }

    // 仮ボルト設定: 本ボルトサイズ → 仮ボルトサイズ
    [FirestoreProperty("tempBoltMap")]
    public Dictionary<string, string>? TempBoltMap { get; set; }

    // 仮ボルト種別設定: 本ボルトサイズ → 種別文字列 ("HUG" / "中ボルト(Mネジ)" / "中ボルト(Wネジ)")
    // 未設定のキーは "HUG" 扱い
    [FirestoreProperty("tempBoltKindMap")]
    public Dictionary<string, string>? TempBoltKindMap { get; set; }
}

[FirestoreData]
public class JointDocument
{
    [FirestoreProperty("id")]
    public string Id { get; set; }

    [FirestoreProperty("name")]
    public string Name { get; set; }

    [FirestoreProperty("type")]
    public string Type { get; set; }

    [FirestoreProperty("isPinJoint")]
    public bool IsPinJoint { get; set; }

    [FirestoreProperty("isDoubleShear")]
    public bool IsDoubleShear { get; set; }

    [FirestoreProperty("countAsMember")]
    public bool CountAsMember { get; set; }

    [FirestoreProperty("color")]
    public string? Color { get; set; }

    [FirestoreProperty("flangeSize")]
    public string? FlangeSize { get; set; }

    [FirestoreProperty("flangeCount")]
    public int FlangeCount { get; set; }

    [FirestoreProperty("webSize")]
    public string? WebSize { get; set; }

    [FirestoreProperty("webCount")]
    public int WebCount { get; set; }

    [FirestoreProperty("isComplexSpl")]
    public bool IsComplexSpl { get; set; }

    [FirestoreProperty("complexSplCount")]
    public int? ComplexSplCount { get; set; }

    [FirestoreProperty("webInputs")]
    public List<WebInput>? WebInputs { get; set; }

    [FirestoreProperty("isBundledWithColumn")]
    public bool IsBundledWithColumn { get; set; }

    [FirestoreProperty("isShopGroundAssembly")]
    public bool IsShopGroundAssembly { get; set; }

    [FirestoreProperty("isGroundAssembly")]
    public bool IsGroundAssembly { get; set; }

    [FirestoreProperty("hasShopSpl")]
    public bool HasShopSpl { get; set; }

    [FirestoreProperty("hasBoltCorrection")]
    public bool HasBoltCorrection { get; set; }

    [FirestoreProperty("tempBoltSetting")]
    public string? TempBoltSetting { get; set; }

    // 工場仮ボルト本数（本柱・手動設定継手で使用）
    [FirestoreProperty("shopTempBoltCount")]
    public int? ShopTempBoltCount { get; set; }

    // 工場仮ボルトサイズ（手動設定継手のみ。本柱は project.TempBoltMap[FlangeSize] を優先使用）
    [FirestoreProperty("shopTempBoltSize")]
    public string? ShopTempBoltSize { get; set; }

    [FirestoreProperty("shopTempBoltCount_F")]
    public int? ShopTempBoltCountF { get; set; }

    [FirestoreProperty("shopTempBoltSize_F")]
    public string? ShopTempBoltSizeF { get; set; }

    [FirestoreProperty("shopTempBoltCount_W")]
    public int? ShopTempBoltCountW { get; set; }

    [FirestoreProperty("shopTempBoltSize_W")]
    public string? ShopTempBoltSizeW { get; set; }
}

[FirestoreData]
public class MemberDocument
{
    [FirestoreProperty("id")]
    public string Id { get; set; }

    [FirestoreProperty("name")]
    public string Name { get; set; }

    [FirestoreProperty("jointId")]
    public string JointId { get; set; }

    [FirestoreProperty("targetLevels")]
    public List<string> TargetLevels { get; set; } = new();
}

[FirestoreData]
public class WebInput
{
    [FirestoreProperty("size")]
    public string Size { get; set; }

    [FirestoreProperty("count")]
    public int Count { get; set; }
}

[FirestoreData]
public class GroupingSettings
{
    [FirestoreProperty("honBolt")]
    public Dictionary<string, long>? HonBolt { get; set; }

    [FirestoreProperty("tempBolt")]
    public Dictionary<string, long>? TempBolt { get; set; }
}
```

### 9-2. Repository設計

```csharp
public interface IProjectRepository
{
    // リアルタイム購読（推奨）
    IDisposable SubscribeToProjects(Action<IReadOnlyList<Project>> onUpdate);

    // 一度限り取得
    Task<IReadOnlyList<Project>> GetAllProjectsAsync();
    Task<Project?> GetProjectByIdAsync(string projectId);

    // 書き込み
    Task UpdateProjectAsync(string projectId, Dictionary<string, object> data);
    Task<string> AddProjectAsync(ProjectDocument data);
}
```

`UpdateProjectAsync` には dot notation キー（`"groupingSettings.honBolt"` など）を直接渡せるようにする。

### 9-3. クライアントサイドで実装すべき計算

| 計算 | 対応するWebモジュール | 説明 |
|---|---|---|
| 工区ID一覧の生成 | `getMasterOrderedKeys(project)` | floors/sections から `"2-1"`, `"R-1"` を生成 |
| ボルト本数集計 | `calculateAggregatedData()` | tally × joint bolt patterns → 工区別本数 |
| 本ボルト注文明細グループ化 | `renderHonBoltSection()` 内 groupingSettings 適用 | グループ番号でまとめて合算 |
| 仮ボルト注文明細グループ化 | `renderTempOrderDetails()` 内 groupingSettings 適用 | 同上 |
| 工区まとめタイトル生成（本ボルト） | `group.names.join(" + ")` | `"2-1 + 2-3"` 形式 |
| 工区まとめタイトル生成（仮ボルト） | `` `No.${n} (${keys.join(", ")})` `` | `"No.1 (2-3, 3-2)"` 形式 |
| 部材リストのセクション分類 | `memberSections` 固定配列（11グループ） | `type × isPinJoint` でマッピング |

---

## 10. よくあるミスと対策

| ミス | 対策 |
|---|---|
| 認証前にFirestoreにアクセスしようとする | `onAuthStateChanged` のコールバック内でデータ取得を開始する |
| appId を Firebase App ID と混同する | appIdはFirestoreパスのみに使う識別子。本番は `projectId` と同一 |
| `groupingSettings` がnullの場合を考慮しない | `project.groupingSettings?.honBolt ?? {}` で安全にアクセス |
| 全プロジェクトを再取得せずにローカル更新だけで済ませる | onSnapshot が自動的に更新を受信する。書き込み後に再取得は不要 |
| tally の値が int か long かを間違える | Firestore の number は long（64bit）として受け取る。C#では `long` を使う |
| joints/members を部分更新しようとする | これらは配列なので必ず全件置換する |
| 集計結果がFirestoreにあると思い込む | `resultsByLocation` 等は存在しない。全てクライアントで計算する |

---

## 更新履歴

| 日付 | 内容 |
|---|---|
| 2026-05-11 | 初版作成 |
| 2026-05-13 | 仮ボルト種別システム刷新: `tempBoltKind`（単一文字列）廃止 → `tempBoltKindMap`（本ボルトサイズ単位の種別設定）追加。HUG / 中ボルト(Mネジ) / 中ボルト(Wネジ) の3種別対応。W5/8・W3/4・W7/8 サイズ系追加 |
| 2026-05-13 | 本柱の工場仮ボルトサイズを継手フォームから `tempBoltMap[flangeSize]` 管理に移行。`shopTempBoltSize`（本柱）は廃止済み（旧データフォールバックあり） |
| 2026-05-13 | セクション8b（仮ボルト設定システム詳細）追加。C# `ProjectDocument` に `TempBoltMap` / `TempBoltKindMap` フィールド追加 |
