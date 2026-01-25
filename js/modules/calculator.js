import {
  PRESET_COLORS,
  HUG_BOLT_SIZES,
  BOLT_TYPES,
  LEGACY_DEFAULT_BOLT_SIZES,
  S10T_WEIGHTS_G,
  F8T_WEIGHTS_G,
} from "./config.js";

import { saveGlobalBoltSizes } from "./firebase.js";

import { showToast } from "./ui.js";

import { state } from "./state.js";

import { updateProjectData, getAllProjects } from "./db.js";
export const getBoltWeight = (boltSize) => {
  // Mから始まらないボルト（D-Lock, 中ボルトなど）は重量計算の対象外
  if (!boltSize.startsWith("M")) {
    return 0;
  }

  // ▼▼▼ 修正: 末尾チェック(endsWith)から、文字を含むか(includes)に変更 ▼▼▼
  // ボルト名に「■」が含まれていればメッキ(F8T)と判断する
  const isPlated = boltSize.includes("■");
  // ▲▲▲ 修正ここまで ▲▲▲
  const weightTable = isPlated ? F8T_WEIGHTS_G : S10T_WEIGHTS_G;

  const match = boltSize.match(/^M(\d+)[×xX](\d+)/);
  if (!match) return 0;

  const diameter = `M${match[1]}`;
  const length = parseInt(match[2], 10);

  // 適切な重量テーブルから重量を取得
  return weightTable[diameter]?.[length] || 0;
};

// ★ 修正版：boltSort（数値順・プレフィックス正規化・NaN対策）
export const boltSort = (a, b) => {
  const parse = (s) => {
    const str = s === null || s === undefined ? "" : String(s);
    const match = str.match(/^([^0-9]+)?(\d+)[×xX*](\d+)(.*)$/);
    if (!match)
      return {
        prefix: str,
        diam: 0,
        len: 0,
        suffix: "",
        isPlated: false,
        raw: str,
      };

    let rawPrefix = match[1] || "M";
    let prefix = rawPrefix;
    if (prefix.includes("中ボ")) prefix = "中ボ";
    else if (prefix.includes("Dドブ")) prefix = "Dドブ";
    else if (prefix.includes("Dユニ")) prefix = "Dユニ";
    else if (prefix.trim() === "" || prefix === "M") prefix = "M";

    const suffix = match[4] || "";
    const isPlated = suffix.includes("■");

    return {
      prefix: prefix,
      diam: parseInt(match[2], 10) || 0,
      len: parseInt(match[3], 10) || 0,
      suffix: suffix,
      isPlated: isPlated,
      raw: str,
    };
  };

  const pA = parse(a);
  const pB = parse(b);

  // ▼▼▼ 1. カテゴリの優先順位を決定 ▼▼▼
  const getCategoryRank = (p) => {
    if (p.prefix === "M") {
      return p.isPlated ? 2 : 1; // 1:通常M, 2:メッキM
    }
    if (p.prefix === "中ボ") return 3;
    if (p.prefix.startsWith("D")) return 4;
    return 99; // その他
  };

  const rankA = getCategoryRank(pA);
  const rankB = getCategoryRank(pB);

  if (rankA !== rankB) return rankA - rankB;
  // ▲▲▲ ここまで ▲▲▲

  // 2. 径 (Diameter)
  if (pA.diam !== pB.diam) return pA.diam - pB.diam;

  // 3. 長さ (Length)
  if (pA.len !== pB.len) return pA.len - pB.len;

  // 4. その他の接尾辞比較
  return pA.suffix.localeCompare(pB.suffix);
};

export const getProjectLevels = (project) => {
  if (!project) return [];
  const levels = [];
  if (project.mode === "advanced") {
    return project.customLevels.map((l) => ({ id: l, label: l }));
  } else {
    for (let i = 2; i <= project.floors; i++) {
      levels.push({ id: i.toString(), label: `${i}F` });
    }
    levels.push({ id: "R", label: "RF" });
    if (project.hasPH) {
      levels.push({ id: "PH", label: "PH階" });
    }
  }
  return levels;
};

/**
 * 箇所数入力画面の並び順（マスタ順）のキーリストを生成する関数
 */
export function getMasterOrderedKeys(project) {
  const keys = [];

  // projectがまだ読み込まれていない場合のガード
  if (!project) return keys;

  if (project.mode === "advanced") {
    // 詳細モード: customLevels(行) × customAreas(列)
    const levels = project.customLevels || [];
    const areas = project.customAreas || [];

    levels.forEach((level) => {
      areas.forEach((area) => {
        keys.push(`${level}-${area}`);
      });
    });
  } else {
    // シンプルモード: 階数 × 工区
    const floors = parseInt(project.floors) || 0;
    const sections = parseInt(project.sections) || 0;

    // 2階〜最上階
    for (let f = 2; f <= floors; f++) {
      for (let s = 1; s <= sections; s++) {
        keys.push(`${f}-${s}`);
      }
    }
    // R階
    // ※ app.jsでは state.activeTallyLevel を参照していましたが、
    // 純粋な関数にするため、一旦すべて生成するか、引数でフィルタ条件をもらう設計が良いです。
    // ここでは「全ての可能なキー」を返すようにし、フィルタリングは使う側で行うのが安全です。
    for (let s = 1; s <= sections; s++) keys.push(`R-${s}`);

    // PH階
    if (project.hasPH) {
      for (let s = 1; s <= sections; s++) keys.push(`PH-${s}`);
    }
  }
  return keys;
}

/**
 * フロア単位（階ごと）にデータを集約する関数
 */
export function aggregateByFloor(originalResults, project) {
  const floorCounts = {};

  // マスタからフロア順序リストを作成
  let floorOrder = [];
  if (project.mode === "advanced") {
    floorOrder = project.customLevels || [];
  } else {
    const floors = parseInt(project.floors) || 0;
    for (let f = 2; f <= floors; f++) floorOrder.push(`${f}階`);
    floorOrder.push("R階");
    if (project.hasPH) floorOrder.push("PH階");
  }

  // 集計処理
  Object.keys(originalResults).forEach((locationId) => {
    let floorName = "";

    if (project.mode === "advanced") {
      // マスタのレベル名で前方一致判定
      const levels = project.customLevels || [];
      // 長い名前順にソートしてマッチング（誤爆防止）
      const sortedLevels = [...levels].sort((a, b) => b.length - a.length);
      const matched = sortedLevels.find((lvl) =>
        locationId.startsWith(lvl + "-"),
      );
      floorName = matched || locationId.split("-")[0];
    } else {
      // シンプルモード
      const parts = locationId.split("-");
      if (["R", "PH"].includes(parts[0])) floorName = `${parts[0]}階`;
      else floorName = `${parts[0]}階`;
    }

    if (!floorCounts[floorName]) floorCounts[floorName] = {};

    const sizesObj = originalResults[locationId];
    Object.keys(sizesObj).forEach((size) => {
      // 通常ボルトのみ集計
      if (
        !size.startsWith("D") &&
        !size.includes("(本柱)") &&
        !size.startsWith("中ボ") &&
        !size.startsWith("中")
      ) {
        const info = sizesObj[size];
        const qty = info.total || 0;
        floorCounts[floorName][size] =
          (floorCounts[floorName][size] || 0) + qty;
      }
    });
  });

  return { data: floorCounts, order: floorOrder };
}

/**
 * ユーザー設定（シミュレーション）に基づいてデータを合算する関数
 */
export function calculateAggregatedData(
  originalResults,
  groupingState,
  project,
) {
  const aggregatedCounts = {};
  const groups = {};

  // ★マスタ順にキーを並べてから処理する
  const masterKeys = getMasterOrderedKeys(project);
  // 実際にデータがあるキーだけに絞るが、順序は維持
  const sortedTargetKeys = masterKeys.filter((k) => originalResults[k]);

  sortedTargetKeys.forEach((locationId) => {
    // 設定がなければスキップ（またはデフォルト処理）
    if (groupingState[locationId] === undefined) return;

    const groupID = groupingState[locationId];

    if (!groups[groupID]) {
      groups[groupID] = { names: [], sizes: {} };
    }

    groups[groupID].names.push(locationId);

    const sizesObj = originalResults[locationId];
    Object.keys(sizesObj).forEach((size) => {
      if (
        !size.startsWith("D") &&
        !size.includes("(本柱)") &&
        !size.startsWith("中ボ") &&
        !size.startsWith("中")
      ) {
        const info = sizesObj[size];
        const qty = info.total || 0;
        groups[groupID].sizes[size] = (groups[groupID].sizes[size] || 0) + qty;
      }
    });
  });

  // グループID順(1,2,3...)に並べて出力オブジェクトを作成
  // ※順序保証のため、戻り値とは別にキー順序配列を返すべきだが、
  // ここでは簡易的に「グループID順」で生成されたオブジェクトを返す
  Object.keys(groups)
    .sort((a, b) => Number(a) - Number(b))
    .forEach((groupID) => {
      const group = groups[groupID];
      if (group.names.length === 0) return;

      const displayName = group.names.join(" + ");
      aggregatedCounts[displayName] = group.sizes;
    });

  return aggregatedCounts;
}

export const calculateResults = (project) => {
  const resultsByLocation = {};
  const allBoltSizes = new Set();
  if (!project || !project.tally) {
    return { resultsByLocation, allBoltSizes };
  }
  const tallyList = getTallyList(project);
  const tallyMap = new Map(tallyList.map((item) => [item.id, item]));

  for (const locationId in project.tally) {
    resultsByLocation[locationId] = resultsByLocation[locationId] || {};
    for (const itemId in project.tally[locationId]) {
      const quantity = project.tally[locationId][itemId] || 0;
      const item = tallyMap.get(itemId);
      if (quantity > 0 && item && item.joint) {
        const { joint } = item;

        // ▼▼▼ 複合SPLの集計ロジックを追加 ▼▼▼
        let parts = [];
        if (joint.isComplexSpl && joint.webInputs) {
          parts = joint.webInputs.map((w) => ({
            size: w.size,
            count: w.count,
          }));
        }
        // ▲▲▲ ここまで ▲▲▲
        else {
          parts = joint.isPinJoint
            ? [{ size: joint.webSize, count: joint.webCount }]
            : [
                { size: joint.flangeSize, count: joint.flangeCount },
                { size: joint.webSize, count: joint.webCount },
              ];
        }

        parts.forEach((part) => {
          if (part.size && part.count > 0) {
            // ▼▼▼ 修正: タイプがcolumn または「同梱フラグ」がある場合に (本柱) を付与 ▼▼▼
            const isColumn =
              joint.type === "column" || joint.isBundledWithColumn;
            const displaySize = isColumn ? `${part.size}(本柱)` : part.size;
            // ▲▲▲ 修正ここまで ▲▲▲
            allBoltSizes.add(displaySize);

            if (!resultsByLocation[locationId][displaySize]) {
              resultsByLocation[locationId][displaySize] = {
                total: 0,
                joints: {},
              };
            }

            const currentData = resultsByLocation[locationId][displaySize];
            const boltCount = quantity * part.count;

            currentData.total += boltCount;

            const memberName = item.name;
            currentData.joints[memberName] =
              (currentData.joints[memberName] || 0) + boltCount;
          }
        });
      }
    }
  }
  return { resultsByLocation, allBoltSizes };
};

// ★ 修正版：getTallyList（階層情報 targetLevels を正しく渡す）
export const getTallyList = (project) => {
  const jointsMap = new Map(project.joints.map((j) => [j.id, j]));
  const typeOrder = {
    girder: 1,
    beam: 2,
    column: 3,
    stud: 4,
    wall_girt: 5,
    roof_purlin: 6,
    other: 7,
  };
  return [
    ...(project.members || []).map((m) => ({
      id: m.id,
      name: m.name,
      joint: jointsMap.get(m.jointId),
      isMember: true,
      // ▼▼▼ 重要：この行がないとフィルタリングが効きません ▼▼▼
      targetLevels: m.targetLevels || [],
      // ▲▲▲ 追加ここまで ▲▲▲
    })),
    ...project.joints
      .filter((j) => j.countAsMember)
      .map((j) => ({
        id: j.id,
        name: j.name,
        joint: j,
        isMember: false,
        targetLevels: [], // 継手カウントは全フロア表示
      })),
  ]
    .filter((item) => item.joint)
    .sort((a, b) => {
      const orderA = typeOrder[a.joint.type] || 99,
        orderB = typeOrder[b.joint.type] || 99;
      if (orderA !== orderB) return orderA - orderB;
      if ((a.joint.isPinJoint || false) !== (b.joint.isPinJoint || false))
        return a.joint.isPinJoint || false ? 1 : -1;
      return a.name.localeCompare(b.name, "ja");
    });
};

export const getTempBoltInfo = (joint, tempBoltMap = {}) => {
  const result = {
    flange: { text: "—", formula: "" },
    web: { text: "—", formula: "" },
    single: { text: "—", formula: "" },
    webs: [],
  };

  if (joint.tempBoltSetting !== "calculated") {
    const noUse = "使用しない";
    return {
      flange: { text: noUse, formula: "" },
      web: { text: noUse, formula: "" },
      single: { text: noUse, formula: "" },
      webs: [{ text: noUse, formula: "" }],
    };
  }

  const isPin = joint.isPinJoint;
  let applyCorrection = joint.hasBoltCorrection;

  if (joint.isComplexSpl && joint.webInputs) {
    joint.webInputs.forEach((webInput) => {
      const webSize = webInput.size;
      const webCount = parseInt(webInput.count) || 0;
      let tempWebCount = 0;
      let formula = "";
      let localApplyCorrection = applyCorrection;

      if (webCount > 0) {
        const boltsPerPlane = webCount / 2;
        if (joint.hasShopSpl) {
          if (webCount <= 4) {
            tempWebCount =
              webCount >= 2 ? webCount - Math.floor(webCount / 2) : webCount;
            formula = `${webCount}本 - ${Math.floor(
              webCount / 2,
            )} = ${tempWebCount}本`;
            localApplyCorrection = false;
          } else {
            tempWebCount = Math.max(Math.ceil(boltsPerPlane * 0.33), 2);
            formula = `最大値( 切り上げ( (${webCount}本 / 2) * 0.33 ), 2) = ${tempWebCount}本`;
          }
        } else {
          if (webCount <= 3) {
            tempWebCount = webCount;
            formula = `${webCount}本 (3本以下のため全数) = ${tempWebCount}本`;
            localApplyCorrection = false;
          } else {
            tempWebCount = Math.max(Math.ceil(boltsPerPlane * 0.33), 2);
            formula = `最大値( 切り上げ( (${webCount}本 / 2) * 0.33 ), 2) = ${tempWebCount}本`;
          }
        }
      }

      const originalTempCount = tempWebCount;
      if (localApplyCorrection) {
        const webCorrection = originalTempCount - 2;
        if (webCorrection > 0) {
          tempWebCount = originalTempCount + webCorrection;
          formula += `\n増しボルト補正: ${originalTempCount}本 + (${originalTempCount}本 - 2) = ${tempWebCount}本`;
        }
      }

      const tempWebSize = tempBoltMap[webSize] || "未設定";
      result.webs.push({
        text: tempWebCount > 0 ? `${tempWebSize} / ${tempWebCount}本` : "—",
        formula: formula,
      });
    });
    return result;
  }

  const flangeSize = joint.flangeSize,
    webSize = joint.webSize;
  const flangeCount = parseInt(joint.flangeCount) || 0,
    webCount = parseInt(joint.webCount) || 0;
  let tempFlangeCount = 0,
    tempWebCount = 0;
  let flangeFormula = "",
    webFormula = "";

  if (["girder", "beam", "other", "stud"].includes(joint.type) && !isPin) {
    if (flangeCount > 0) {
      tempFlangeCount = Math.ceil((flangeCount / 4) * 0.33) * 2;
      flangeFormula = `切り上げ( (${flangeCount}本 / 4) * 0.33 ) * 2 = ${tempFlangeCount}本`;
    }
    if (webCount > 0) {
      const webCountPerSide = webCount / 2;
      tempWebCount =
        webCountPerSide === 1
          ? 1
          : Math.max(Math.ceil(webCountPerSide * 0.33), 2);
      webFormula =
        webCountPerSide === 1
          ? `片側1本のため = 1本`
          : `最大値( 切り上げ( (${webCount}本 / 2) * 0.33 ), 2) = ${tempWebCount}本`;
    }
  } else {
    const totalBolts = isPin ? webCount : flangeCount;
    if (totalBolts > 0) {
      let tempTotal;
      let formula = "";
      let localApplyCorrection = applyCorrection;

      if (isPin && joint.isDoubleShear) {
        const boltsPerPlane = totalBolts / 2;
        if (joint.hasShopSpl) {
          if (totalBolts <= 4) {
            tempTotal =
              totalBolts >= 2
                ? totalBolts - Math.floor(totalBolts / 2)
                : totalBolts;
            formula = `${totalBolts}本 - ${Math.floor(
              totalBolts / 2,
            )} = ${tempTotal}本`;
            localApplyCorrection = false;
          } else {
            tempTotal = Math.max(Math.ceil(boltsPerPlane * 0.33), 2);
            formula = `最大値( 切り上げ( (${totalBolts}本 / 2) * 0.33 ), 2) = ${tempTotal}本`;
          }
        } else {
          if (totalBolts <= 3) {
            tempTotal = totalBolts;
            formula = `${totalBolts}本 (3本以下のため全数) = ${tempTotal}本`;
            localApplyCorrection = false;
          } else {
            tempTotal = Math.max(Math.ceil(boltsPerPlane * 0.33), 2);
            formula = `最大値( 切り上げ( (${totalBolts}本 / 2) * 0.33 ), 2) = ${tempTotal}本`;
          }
        }
      } else {
        tempTotal =
          totalBolts === 1 ? 1 : Math.max(Math.ceil(totalBolts * 0.33), 2);
        formula =
          totalBolts === 1
            ? `1本のため = 1本`
            : `最大値( 切り上げ(${totalBolts}本 * 0.33), 2) = ${tempTotal}本`;
      }
      if (isPin) {
        tempWebCount = tempTotal;
        webFormula = formula;
        applyCorrection = localApplyCorrection;
      } else {
        tempFlangeCount = tempTotal;
        flangeFormula = formula;
      }
    }
  }

  const originalTempWebCount = tempWebCount;
  const originalTempFlangeCount = tempFlangeCount;

  if (applyCorrection) {
    if (isPin && joint.isDoubleShear) {
      const webCorrection = originalTempWebCount - 2;
      if (webCorrection > 0) {
        tempWebCount = originalTempWebCount + webCorrection;
        webFormula += `\n増しボルト補正: ${originalTempWebCount}本 + (${originalTempWebCount}本 - 2) = ${tempWebCount}本`;
      }
    } else if (!isPin) {
      const flangeCorrection = originalTempFlangeCount - 6;
      if (flangeCorrection > 0) {
        tempFlangeCount = originalTempFlangeCount + flangeCorrection;
        flangeFormula += `\n増しボルト補正: ${originalTempFlangeCount}本 + (${originalTempFlangeCount}本 - 6) = ${tempFlangeCount}本`;
      }
      const webCorrection = originalTempWebCount - 2;
      if (webCorrection > 0) {
        tempWebCount = originalTempWebCount + webCorrection;
        webFormula += `\n増しボルト補正: ${originalTempWebCount}本 + (${originalTempWebCount}本 - 2) = ${tempWebCount}本`;
      }
    }
  }

  const tempFlangeSize = tempBoltMap[flangeSize] || "未設定";
  const tempWebSize = tempBoltMap[webSize] || "未設定";

  if (tempFlangeCount > 0) {
    result.flange = {
      text: `${tempFlangeSize} / ${tempFlangeCount}本`,
      formula: flangeFormula,
    };
    result.single = {
      text: result.flange.text,
      formula: result.flange.formula,
    };
  }
  if (tempWebCount > 0) {
    result.web = {
      text: `${tempWebSize} / ${tempWebCount}本`,
      formula: webFormula,
    };
    if (result.single.text === "—") {
      result.single = { text: result.web.text, formula: result.web.formula };
    }
  }
  return result;
};

export const calculateTempBoltResults = (project) => {
  const resultsByLocation = {};
  const allTempBoltSizes = new Set();
  if (!project || !project.tally)
    return { resultsByLocation, allTempBoltSizes };

  const tallyList = getTallyList(project);
  const tallyMap = new Map(tallyList.map((item) => [item.id, item]));
  const excludedTypes = ["column", "wall_girt", "roof_purlin"];

  for (const locationId in project.tally) {
    resultsByLocation[locationId] = resultsByLocation[locationId] || {};
    for (const itemId in project.tally[locationId]) {
      const quantity = project.tally[locationId][itemId] || 0;
      if (quantity === 0) continue;

      const item = tallyMap.get(itemId);
      if (!item || excludedTypes.includes(item.joint.type)) continue;

      const tempBoltInfo = getTempBoltInfo(item.joint, project.tempBoltMap);

      // --- ここからが修正箇所 ---
      let infoObjects = [];
      if (item.joint.isComplexSpl) {
        infoObjects = tempBoltInfo.webs; // [{text, formula}, ...]
      } else {
        infoObjects = [tempBoltInfo.flange, tempBoltInfo.web]; // [{text, formula}, ...]
      }

      infoObjects.forEach((infoObject) => {
        // infoObject.text プロパティをチェックするように修正
        if (
          infoObject &&
          infoObject.text &&
          !["—", "使用しない", "未設定"].some((s) =>
            infoObject.text.includes(s),
          )
        ) {
          // infoObject.text プロパティを元にサイズと本数を取得するように修正
          const [size, countStr] = infoObject.text.split(" / ");
          const count = parseInt(countStr) || 0;
          const trimmedSize = size.trim();

          if (trimmedSize && count > 0) {
            allTempBoltSizes.add(trimmedSize);
            if (!resultsByLocation[locationId][trimmedSize]) {
              resultsByLocation[locationId][trimmedSize] = {
                total: 0,
                joints: {},
              };
            }
            const boltCount = quantity * count;
            resultsByLocation[locationId][trimmedSize].total += boltCount;
            const memberName = item.name;
            resultsByLocation[locationId][trimmedSize].joints[memberName] =
              (resultsByLocation[locationId][trimmedSize].joints[memberName] ||
                0) + boltCount;
          }
        }
      });
      // --- ここまでが修正箇所 ---
    }
  }
  return { resultsByLocation, allTempBoltSizes };
};

// ★ 修正版：calculateShopTempBoltResults（胴縁・母屋を明示的に除外）
export const calculateShopTempBoltResults = (project) => {
  const totals = {};
  if (!project || !project.tally) return totals;

  const tallyList = getTallyList(project);
  const tallyMap = new Map(tallyList.map((item) => [item.id, item]));

  // ▼▼▼ 追加：工場仮ボルトの集計から除外するタイプ ▼▼▼
  const excludedTypes = ["wall_girt", "roof_purlin"];

  for (const locationId in project.tally) {
    for (const itemId in project.tally[locationId]) {
      const quantity = project.tally[locationId][itemId] || 0;
      if (quantity === 0) continue;

      const item = tallyMap.get(itemId);
      if (!item) continue;

      const joint = item.joint;

      // ▼▼▼ 追加：除外タイプならスキップ ▼▼▼
      if (excludedTypes.includes(joint.type)) continue;

      if (joint.isComplexSpl && joint.webInputs && joint.hasShopSpl) {
        const tempBoltInfo = getTempBoltInfo(joint, project.tempBoltMap);
        joint.webInputs.forEach((webInput, index) => {
          const originalBoltCount = parseInt(webInput.count) || 0;
          if (originalBoltCount === 0) return;

          const tempInfo = tempBoltInfo.webs[index];
          if (
            tempInfo &&
            tempInfo.text &&
            !["—", "使用しない", "未設定"].some((s) =>
              tempInfo.text.includes(s),
            )
          ) {
            const [tempBoltSize] = tempInfo.text.split(" / ");
            const boltSize = tempBoltSize.trim();
            let shopBoltCount =
              originalBoltCount === 2 || originalBoltCount === 3
                ? 1
                : originalBoltCount >= 4
                  ? 2
                  : 0;
            if (shopBoltCount > 0) {
              if (!totals[boltSize])
                totals[boltSize] = { total: 0, joints: new Set() };
              totals[boltSize].total += quantity * shopBoltCount;
              totals[boltSize].joints.add(joint.name);
            }
          }
        });
      } else if (joint.type === "column") {
        const boltSize = joint.shopTempBoltSize;
        const shopBoltCount = joint.shopTempBoltCount;
        if (boltSize && shopBoltCount > 0) {
          if (!totals[boltSize])
            totals[boltSize] = { total: 0, joints: new Set() };
          totals[boltSize].total += quantity * shopBoltCount;
          totals[boltSize].joints.add(joint.name);
        }
      } else if (joint.hasShopSpl) {
        if (joint.tempBoltSetting === "none") {
          if (joint.shopTempBoltSize && joint.shopTempBoltCount > 0) {
            const boltSize = joint.shopTempBoltSize;
            if (!totals[boltSize])
              totals[boltSize] = { total: 0, joints: new Set() };
            totals[boltSize].total += quantity * joint.shopTempBoltCount;
            totals[boltSize].joints.add(joint.name);
          }
          if (joint.shopTempBoltSize_F && joint.shopTempBoltCount_F > 0) {
            const boltSize = joint.shopTempBoltSize_F;
            if (!totals[boltSize])
              totals[boltSize] = { total: 0, joints: new Set() };
            totals[boltSize].total += quantity * joint.shopTempBoltCount_F;
            totals[boltSize].joints.add(joint.name);
          }
          if (joint.shopTempBoltSize_W && joint.shopTempBoltCount_W > 0) {
            const boltSize = joint.shopTempBoltSize_W;
            if (!totals[boltSize])
              totals[boltSize] = { total: 0, joints: new Set() };
            totals[boltSize].total += quantity * joint.shopTempBoltCount_W;
            totals[boltSize].joints.add(joint.name);
          }
        } else {
          const tempBoltInfo = getTempBoltInfo(joint, project.tempBoltMap);
          if (!joint.isPinJoint) {
            if (
              tempBoltInfo.flange &&
              tempBoltInfo.flange.text &&
              !tempBoltInfo.flange.text.includes("未設定")
            ) {
              const [size] = tempBoltInfo.flange.text.split(" / ");
              const boltSize = size.trim();
              if (!totals[boltSize])
                totals[boltSize] = { total: 0, joints: new Set() };
              totals[boltSize].total += quantity * 6;
              totals[boltSize].joints.add(joint.name);
            }
            if (
              tempBoltInfo.web &&
              tempBoltInfo.web.text &&
              !tempBoltInfo.web.text.includes("未設定")
            ) {
              const [size] = tempBoltInfo.web.text.split(" / ");
              const boltSize = size.trim();
              if (!totals[boltSize])
                totals[boltSize] = { total: 0, joints: new Set() };
              totals[boltSize].total += quantity * 2;
              totals[boltSize].joints.add(joint.name);
            }
          } else if (joint.isPinJoint && joint.isDoubleShear) {
            if (
              tempBoltInfo.web &&
              tempBoltInfo.web.text &&
              !tempBoltInfo.web.text.includes("未設定")
            ) {
              const [size] = tempBoltInfo.web.text.split(" / ");
              const boltSize = size.trim();
              const originalTotalBolts = joint.webCount;
              let shopBoltCount =
                originalTotalBolts === 2 || originalTotalBolts === 3 ? 1 : 2;
              if (!totals[boltSize])
                totals[boltSize] = { total: 0, joints: new Set() };
              totals[boltSize].total += quantity * shopBoltCount;
              totals[boltSize].joints.add(joint.name);
            }
          }
        }
      }
    }
  }
  return totals;
};

export const calculateAggregatedResults = (projectsInGroup) => {
  const aggregated = {
    finalBolts: {},
    tempBolts: {},
    shopTempBolts: {},
  };

  projectsInGroup.forEach((project) => {
    // 1. 本ボルト集計 (継手ごとの内訳も合算する)
    const { resultsByLocation } = calculateResults(project);
    for (const locId in resultsByLocation) {
      for (const size in resultsByLocation[locId]) {
        if (!aggregated.finalBolts[size]) {
          aggregated.finalBolts[size] = { total: 0, joints: {} };
        }
        const projectData = resultsByLocation[locId][size];
        aggregated.finalBolts[size].total += projectData.total;
        for (const jointName in projectData.joints) {
          aggregated.finalBolts[size].joints[jointName] =
            (aggregated.finalBolts[size].joints[jointName] || 0) +
            projectData.joints[jointName];
        }
      }
    }

    // ▼▼▼ ここからが修正箇所 ▼▼▼
    // 2. 仮ボルト集計 (継手ごとの内訳も正しく合算する)
    const { resultsByLocation: tempResults } =
      calculateTempBoltResults(project);
    for (const locId in tempResults) {
      for (const size in tempResults[locId]) {
        if (!aggregated.tempBolts[size]) {
          aggregated.tempBolts[size] = { total: 0, joints: {} };
        }
        const projectData = tempResults[locId][size];
        aggregated.tempBolts[size].total += projectData.total;
        for (const jointName in projectData.joints) {
          aggregated.tempBolts[size].joints[jointName] =
            (aggregated.tempBolts[size].joints[jointName] || 0) +
            projectData.joints[jointName];
        }
      }
    }
    // ▲▲▲ ここまでが修正箇所 ▲▲▲

    // 3. 工場用仮ボルト集計
    const shopResults = calculateShopTempBoltResults(project);
    for (const size in shopResults) {
      if (!aggregated.shopTempBolts[size]) {
        aggregated.shopTempBolts[size] = { total: 0, joints: new Set() };
      }
      aggregated.shopTempBolts[size].total += shopResults[size].total;
      shopResults[size].joints.forEach((jointName) =>
        aggregated.shopTempBolts[size].joints.add(jointName),
      );
    }
  });
  return aggregated;
};

/**
 * 【決定版・改2】ボルトサイズ整合性チェック (表記統一機能付き)
 */
export const ensureProjectBoltSizes = async (project) => {
  // 1. ヘルパー関数: ID文字列から情報を解析
  const parseBoltId = (idString) => {
    // IDの表記揺れ統一 (半角x -> 全角×)
    const cleanId = idString.trim().replace(/x/g, "×");
    const separator = "×";

    const isMekki = cleanId.endsWith("■");
    const processingId = isMekki ? cleanId.replace("■", "") : cleanId;

    const parts = processingId.split(separator);
    let type = "Unknown";
    let length = 0;

    if (parts.length >= 2) {
      const lenStr = parts.pop();
      length = parseInt(lenStr) || 0;
      let rawType = parts.join(separator);

      if (rawType.startsWith("中ボ")) {
        const sizePart = rawType.replace("中ボ", "");
        // ▼▼▼ 修正: 表記を「中ボ(Mネジ)」に統一 ▼▼▼
        type = `中ボ(Mネジ) ${sizePart}`;
      } else if (isMekki) {
        type = `${rawType}めっき`;
      } else {
        type = rawType;
      }
    } else {
      type = cleanId;
    }

    return { id: cleanId, label: cleanId, type, length };
  };

  // 2. リスト初期化
  if (!project.boltSizes || !Array.isArray(project.boltSizes)) {
    project.boltSizes = [];
  }

  // 空ならレガシーリスト適用
  if (project.boltSizes.length === 0) {
    project.boltSizes = LEGACY_DEFAULT_BOLT_SIZES.map((label) =>
      parseBoltId(label),
    );
  }

  // ▼▼▼ 3. 既存データの名称・表記の強制アップデート ▼▼▼
  const uniqueMap = new Map();
  let updatedCount = 0; // 変更があった件数

  project.boltSizes.forEach((bolt) => {
    // IDから最新の情報を再解析（これで type が「中ボ(Mネジ)...」に更新される）
    const newInfo = parseBoltId(bolt.id);

    // 既存のプロパティ（restoredフラグなど）を維持しつつ、type等を上書き
    const updatedBolt = { ...bolt, ...newInfo };

    // 変更検知（表記が変わる場合）
    if (bolt.type !== newInfo.type || bolt.id !== newInfo.id) {
      updatedCount++;
    }

    if (!uniqueMap.has(updatedBolt.id)) {
      uniqueMap.set(updatedBolt.id, updatedBolt);
    }
  });

  // リストを更新
  project.boltSizes = Array.from(uniqueMap.values());
  // ▲▲▲ アップデート処理ここまで ▲▲▲

  // 4. 隠れデータの復元スキャン
  const existingIds = new Set(project.boltSizes.map((b) => b.id));
  let restoredCount = 0;

  if (project.joints && Array.isArray(project.joints)) {
    project.joints.forEach((j) => {
      const sizesToCheck = [j.flangeSize, j.webSize];
      sizesToCheck.forEach((val) => {
        if (!val || val.trim() === "") return;

        // 比較用IDも統一してチェック
        const unifiedVal = val.trim().replace(/x/g, "×");

        if (existingIds.has(unifiedVal)) return;

        const boltInfo = parseBoltId(unifiedVal);
        boltInfo.restored = true;

        project.boltSizes.push(boltInfo);
        existingIds.add(unifiedVal);
        restoredCount++;
      });
    });
  }

  // 5. ソート (定義も新しい名前に合わせる)
  const typeOrderList = [
    "M16",
    "M16めっき",
    "M20",
    "M20めっき",
    "M22",
    "M22めっき",
    // ▼▼▼ 修正: ソート順定義も「中ボ(Mネジ)」に変更 ▼▼▼
    "中ボ(Mネジ) M16",
    "中ボ(Mネジ) M20",
    "中ボ(Mネジ) M22",
    "Dドブ12",
    "Dユニ12",
    "Dドブ16",
    "Dユニ16",
  ];
  const typeOrder = {};
  typeOrderList.forEach((t, i) => (typeOrder[t] = i));

  project.boltSizes.sort((a, b) => {
    let orderA = typeOrder[a.type] !== undefined ? typeOrder[a.type] : 999;
    let orderB = typeOrder[b.type] !== undefined ? typeOrder[b.type] : 999;

    if (orderA !== orderB) return orderA - orderB;
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.length - b.length;
  });

  // 6. 自動保存 (復元、または名称変更があった場合)
  if (restoredCount > 0 || updatedCount > 0) {
    console.log(
      `✅ データの統一(名称変更:${updatedCount}件)と復元(${restoredCount}件)を行いました`,
    );
    // データベースを更新
    if (project.id) {
      try {
        await updateProjectData(project.id, {
          boltSizes: project.boltSizes,
        });
        console.log("ボルトサイズ設定をDBに保存しました。");
      } catch (err) {
        console.error("ボルトサイズ設定の保存に失敗しました:", err);
      }
    } else {
      console.warn("プロジェクトIDが不明なため、DB保存をスキップしました。");
    }
  }

  return project;
};

/**
 * ヘルパー: グローバル設定用ID解析
 */
export const parseBoltIdForGlobal = (idString) => {
  const cleanId = idString.trim().replace(/x/g, "×");
  const separator = "×";
  const isMekki = cleanId.endsWith("■");
  const processingId = isMekki ? cleanId.replace("■", "") : cleanId;
  const parts = processingId.split(separator);
  let type = "Unknown";
  let length = 0;

  if (parts.length >= 2) {
    const lenStr = parts.pop();
    length = parseInt(lenStr) || 0;
    let rawType = parts.join(separator);
    if (rawType.startsWith("中ボ")) {
      const sizePart = rawType.replace("中ボ", "");
      type = `中ボ(Mネジ) ${sizePart}`;
    } else if (isMekki) {
      type = `${rawType}めっき`;
    } else {
      type = rawType;
    }
  } else {
    type = cleanId;
  }
  return { id: cleanId, label: cleanId, type, length };
};

/**
 * グローバルボルトサイズをソートする
 */
export const sortGlobalBoltSizes = () => {
  if (!state.globalBoltSizes) return;

  const typeOrderList = [
    "M16",
    "M16めっき",
    "M20",
    "M20めっき",
    "M22",
    "M22めっき",
    "中ボ(Mネジ) M16",
    "中ボ(Mネジ) M20",
    "中ボ(Mネジ) M22",
    "Dドブ12",
    "Dユニ12",
    "Dドブ16",
    "Dユニ16",
  ];
  const typeOrder = {};
  typeOrderList.forEach((t, i) => (typeOrder[t] = i));

  state.globalBoltSizes.sort((a, b) => {
    let orderA = typeOrder[a.type] !== undefined ? typeOrder[a.type] : 999;
    let orderB = typeOrder[b.type] !== undefined ? typeOrder[b.type] : 999;
    if (orderA !== orderB) return orderA - orderB;
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.length - b.length;
  });
};

/**
 * 既存プロジェクトからボルトサイズを吸い上げて移行する
 */
export const checkAndMigrateBoltSizes = async () => {
  try {
    // firebase.js から import した関数を使用
    const allProjects = await getAllProjects();

    if (allProjects.length === 0) {
      state.globalBoltSizes = LEGACY_DEFAULT_BOLT_SIZES.map((label) =>
        parseBoltIdForGlobal(label),
      );
      // firebase.js から import した関数を使用
      await saveGlobalBoltSizes(state.globalBoltSizes);
      return;
    }

    const allBoltSizesMap = new Map();

    allProjects.forEach((project) => {
      if (project.boltSizes && Array.isArray(project.boltSizes)) {
        project.boltSizes.forEach((bolt) => {
          const parsed = parseBoltIdForGlobal(bolt.id);
          if (!allBoltSizesMap.has(parsed.id)) {
            allBoltSizesMap.set(parsed.id, parsed);
          }
        });
      }
    });

    if (allBoltSizesMap.size === 0) {
      LEGACY_DEFAULT_BOLT_SIZES.forEach((label) => {
        const parsed = parseBoltIdForGlobal(label);
        allBoltSizesMap.set(parsed.id, parsed);
      });
    }

    state.globalBoltSizes = Array.from(allBoltSizesMap.values());

    sortGlobalBoltSizes();
    await saveGlobalBoltSizes(state.globalBoltSizes);

    console.log(
      "Migration completed. Total global sizes:",
      state.globalBoltSizes.length,
    );
    // ui.js から import した関数を使用
    showToast("既存データからボルトサイズ設定を統合しました");
  } catch (error) {
    console.error("Migration failed:", error);
  }
};
