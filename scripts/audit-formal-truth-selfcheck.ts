/**
 * CONTENT-01｜第一包「Formal Fixed 真心话」静态自检（C1-2 配套脚本，**只读**）。
 *
 * 只做静态核验，不接管线、不改任何产物。fail-closed：任何一项不合规即 `process.exit(1)`。
 * 覆盖：
 * 1. 张数（第一包 18~24；R2 Bootstrap 6~8；两包都只是**内容源**——A3 后其中仅 KEEP 5 保持 Formal，
 *    其余 26 张已退出 Formal，待在后续批次重构/新开 ID 后重新审查）与 ID 唯一性 /
 *    与既有 SSOT 390 张不冲突 /
 *    `PN-TRUTH` 编号段不重叠（两包合并核验）；
 * 2. 分布：intensity(I1~I5) / heatMin·heatMax / topic / informationGain / relationshipProgression；
 *    R2 另单独打印 Bootstrap 包的 intensity / heatMin / heatMax / topic / socialEnergy 分布；
 * 3. 枚举合法性：SSOT 形状 18 字段 + Plan §3 质量字段逐字段对照真源枚举集合（0 非法）；
 * 4. 必填字段缺失 = 0（直接用正式入库校验器 `validateFixedCardMetadataStrict`）；
 * 5. 与既有 350 题的重复检查：精确重复必须 0；近似（字符 bigram Jaccard）只列清单不沉默；
 * 6. canonical BAR-FIT 机器预筛：`HARD_FAIL_PATTERN` 必须 0（SUSPECT 只列池）；
 * 7. R2 Bootstrap 反向护栏（**对已入正式库的这 7 张仍逐条适用**，是内容形状护栏、非「未审查」口径）：heatMin 全 1、heatMax 不得全 4、intensity 不得全 1、不得用深关系题材；
 * 8. 三红线零命中（复用生产 `isHardBlocked`：露骨 / 强迫惩罚灌酒 / 隐私脱衣非自愿）。
 *
 * 运行：`npx vite-node -c vitest.config.ts scripts/audit-formal-truth-selfcheck.ts`
 * 退出码 0 = 全部合规；非 0 = 有不合规项（逐条打印）。
 */

import { readFileSync } from "node:fs";
import { isHardBlocked } from "@/lib/ai/safety-filter";
import { judgeCanonicalBarFit } from "@/lib/v2-content/bar-fit-input";
import {
  V2_BAR_FIT,
  V2_BOUNDARY_TAG_CATALOG,
  V2_INFORMATION_GAIN,
  V2_INFORMATION_GOAL_TYPES,
  V2_INTIMACY_CLASSES,
  V2_RELATIONSHIP_PROGRESSION,
  V2_REQUIRED_QUALITY_FIELDS,
  V2_SOCIAL_ENERGY,
  V2_TOPICS,
  findUnknownBoundaryTags,
  validateFixedCardMetadataStrict,
  type V2Topic,
} from "@/lib/v2-content/v2-card-metadata";
import { FORMAL_TRUTH_BOOTSTRAP_CARDS } from "@/lib/v2-content/formal-truth-bootstrap-pack";
import { FORMAL_TRUTH_CARDS } from "@/lib/v2-content/formal-truth-pack";
import {
  V2_CONSENT_MODES,
  V2_GAME_TYPES,
  V2_INTERACTION_TYPES,
  V2_MAINLINE_FALLBACK_POLICIES,
  V2_POST_ACTIONS,
  V2_RELATION_STAGES,
  V2_RESPONSE_MODES,
  V2_SIGNAL_EFFECTS,
  V2_TARGET_MODES,
} from "@/lib/v2-content/v2-types";

const ROOT = process.cwd();
const SSOT_PATH = `${ROOT}/lib/v2-content/generated/v2-ssot.generated.json`;

const MIN_CARDS = 18;
const MAX_CARDS = 24;
/** R2｜Truth H1 Bootstrap 包张数区间（宁少勿滥，不设「必须 8 张」quota；7 张是内容源，A3 后仅 227/229 保持 Formal）。 */
const BOOTSTRAP_MIN_CARDS = 6;
const BOOTSTRAP_MAX_CARDS = 8;
/** 近似判定阈值（字符 bigram Jaccard）：≥ 该值列入近似清单（不自动判失败，人读复核）。 */
const NEAR_DUPLICATE_THRESHOLD = 0.5;

const errors: string[] = [];
const warnings: string[] = [];

/* ------------------------------------------------------------------ */
/* 既有 390 张真源（只读）                                              */
/* ------------------------------------------------------------------ */

interface ExistingCard {
  cardId: string;
  gameType: string;
  text: string;
}

const ssot = JSON.parse(readFileSync(SSOT_PATH, "utf8")) as {
  mainlineCards: ExistingCard[];
  expansionCards: ExistingCard[];
};
const existingCards: ExistingCard[] = [...ssot.mainlineCards, ...ssot.expansionCards];
const existingById = new Map<string, ExistingCard>(existingCards.map((card) => [card.cardId, card]));
const existingMainline = ssot.mainlineCards;

/* ------------------------------------------------------------------ */
/* 语言无关的工具                                                       */
/* ------------------------------------------------------------------ */

const normText = (value: string): string => value.replace(/[\s，。？！、；：（）「」『』"'…—,.?!;:()<>《》~～\-]/gu, "");

const bigrams = (value: string): Set<string> => {
  const set = new Set<string>();
  for (let i = 0; i + 1 < value.length; i += 1) set.add(value.slice(i, i + 2));
  return set;
};

const jaccard = (a: ReadonlySet<string>, b: ReadonlySet<string>): number => {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const token of a) if (b.has(token)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
};

const enumErrors: string[] = [];

const enumIssue = (cardId: string, field: string, value: unknown, allowed: readonly string[]): void => {
  if (typeof value !== "string" || !allowed.includes(value)) {
    enumErrors.push(`${cardId}: ${field} 非法枚举值「${String(value)}」（真源 ${allowed.length} 值）`);
  }
};

const tagArrayIssue = (cardId: string, field: string, value: unknown, allowed: readonly string[]): void => {
  if (!Array.isArray(value) || value.some((tag) => typeof tag !== "string" || !allowed.includes(tag))) {
    enumErrors.push(`${cardId}: ${field} 含非法枚举值 ${JSON.stringify(value)}`);
  }
};

const countBy = <T extends string | number>(values: readonly T[]): Map<T, number> => {
  const map = new Map<T, number>();
  for (const value of values) map.set(value, (map.get(value) ?? 0) + 1);
  return map;
};

const printDistribution = (title: string, map: ReadonlyMap<string | number, number>, order?: readonly (string | number)[]): void => {
  const keys = order ?? [...map.keys()].sort((a, b) => String(a).localeCompare(String(b)));
  const parts = keys.map((key) => `${String(key)}:${map.get(key) ?? 0}`);
  console.log(`${title} | ${parts.join("  ")}`);
};

const intOf = (value: unknown): number | null => (typeof value === "number" && Number.isInteger(value) ? value : null);

/* ------------------------------------------------------------------ */
/* 1. 张数 / ID 唯一性 / 与既有 390 不冲突                              */
/* ------------------------------------------------------------------ */

const cards = [...FORMAL_TRUTH_CARDS, ...FORMAL_TRUTH_BOOTSTRAP_CARDS];
const cardIds = cards.map((card) => card.cardId);
const cardIdSet = new Set(cardIds);

console.log(
  `\n=== C1-2 真心话静态自检（第一包 ${FORMAL_TRUTH_CARDS.length} 张 + H1 Bootstrap ${FORMAL_TRUTH_BOOTSTRAP_CARDS.length} 张（内容源；Formal 归属见 manifest = KEEP 5）= ${cards.length} 张） ===`,
);
if (FORMAL_TRUTH_CARDS.length < MIN_CARDS || FORMAL_TRUTH_CARDS.length > MAX_CARDS) {
  errors.push(`第一包张数 ${FORMAL_TRUTH_CARDS.length} 不在 ${MIN_CARDS}~${MAX_CARDS}`);
}
if (
  FORMAL_TRUTH_BOOTSTRAP_CARDS.length < BOOTSTRAP_MIN_CARDS ||
  FORMAL_TRUTH_BOOTSTRAP_CARDS.length > BOOTSTRAP_MAX_CARDS
) {
  errors.push(
    `Bootstrap 包张数 ${FORMAL_TRUTH_BOOTSTRAP_CARDS.length} 不在 ${BOOTSTRAP_MIN_CARDS}~${BOOTSTRAP_MAX_CARDS}（宁少勿滥，也不可超 8）`,
  );
}
if (cardIdSet.size !== cardIds.length) {
  const dup = cardIds.filter((id, i) => cardIds.indexOf(id) !== i);
  errors.push(`本包内 cardId 重复：${[...new Set(dup)].join(",")}`);
}
for (const card of cards) {
  if (existingById.has(card.cardId)) errors.push(`${card.cardId}: 与既有 SSOT 390 张 cardId 冲突`);
  if (!card.cardId.startsWith("PN-TRUTH-")) errors.push(`${card.cardId}: 未沿用 PN-TRUTH 前缀族`);
  if (card.gameType !== "truth") errors.push(`${card.cardId}: gameType=${card.gameType} ≠ truth`);
  const numberMatch = /^PN-TRUTH-(\d+)$/u.exec(card.cardId);
  if (!numberMatch) {
    errors.push(`${card.cardId}: ID 形态不合法（期望 PN-TRUTH-<数字>）`);
  } else if (Number(numberMatch[1]) !== card.number) {
    errors.push(`${card.cardId}: number=${card.number} 与 ID 末段不一致`);
  }
}
const newNumbers = cardIds.map((id) => Number(/^PN-TRUTH-(\d+)$/u.exec(id)?.[1] ?? -1)).filter((n) => n > 0);
const existingTruthNumbers = new Set(
  existingMainline
    .filter((card) => card.gameType === "truth")
    .map((card) => Number(/^PN-TRUTH-(\d+)$/u.exec(card.cardId)?.[1] ?? -1)),
);
const numberOverlap = newNumbers.filter((n) => existingTruthNumbers.has(n));
if (numberOverlap.length > 0) errors.push(`编号段与既有 PN-TRUTH 重叠：${numberOverlap.join(",")}`);
console.log(`ID 唯一：${cardIdSet.size}/${cards.length}；与既有 390 张冲突：${cardIds.filter((id) => existingById.has(id)).length}；编号段重叠：${numberOverlap.length}`);
console.log(`既有 PN-TRUTH 编号范围：${Math.min(...existingTruthNumbers)}~${Math.max(...existingTruthNumbers)}；本包：${Math.min(...newNumbers)}~${Math.max(...newNumbers)}`);

/* ------------------------------------------------------------------ */
/* 2. 分布                                                            */
/* ------------------------------------------------------------------ */

const intDist = countBy(cards.map((card) => card.intensity));
const heatMinDist = countBy(cards.map((card) => card.heatMin));
const heatMaxDist = countBy(cards.map((card) => card.heatMax));
const topicDist = countBy(cards.map((card) => card.topic));
const gainDist = countBy(cards.map((card) => card.informationGain));
const rpDist = countBy(cards.map((card) => card.relationshipProgression));
const socialEnergyDist = countBy(cards.map((card) => card.socialEnergy));
const goalTypeDist = countBy(cards.map((card) => card.informationGoalType));
const intimacyDist = countBy(cards.map((card) => card.intimacyClass));

console.log("\n--- 分布 ---");
printDistribution("intensity(I1~I5)", intDist, [1, 2, 3, 4, 5]);
printDistribution("heatMin", heatMinDist, [1, 2, 3, 4]);
printDistribution("heatMax", heatMaxDist, [1, 2, 3, 4]);
printDistribution("informationGain", gainDist, ["zero", "low", "medium", "high"]);
printDistribution("relationshipProgression", rpDist, ["none", "open", "deepen", "clarify_boundary"]);
printDistribution("socialEnergy", socialEnergyDist, ["low", "medium", "high"]);
printDistribution("intimacyClass", intimacyDist, ["none", "action", "attitude"]);
printDistribution("informationGoalType", goalTypeDist, V2_INFORMATION_GOAL_TYPES);
printDistribution("topic", topicDist, V2_TOPICS);

for (const level of [1, 2, 3, 4, 5]) if ((intDist.get(level) ?? 0) === 0) errors.push(`intensity=${level} 无库存（必须覆盖 1~5）`);
/**
 * A3（2026-09-28，Human 冻结「Heat / Intensity 正交、标注必须诚实」）废止两条旧律：
 *   旧①「`heatMin` 一律 = 1」（disclosure 未落地时的妥协，已由 Human 明令废弃）；
 *   旧②「`heatMax` 必须覆盖 H1~H4」（H1 已无卡，且禁止为库存统一拉 4）。
 * 新律 = 原则性不变量（不钉死具体张数，避免下次补卡即误红）；逐卡真值由
 * `tests/unit/formal-truth-heat-labels.test.ts` 按 reviewer 表逐字锁死。
 */
for (const level of [1, 2, 3, 4]) {
  if ((heatMinDist.get(level) ?? 0) === 0) errors.push(`heatMin=H${level} 无库存（四档都必须有「首次解锁」的卡，不得空档）`);
}
for (const level of [2, 3, 4]) {
  if ((heatMaxDist.get(level) ?? 0) === 0) errors.push(`heatMax=H${level} 无库存（深档必须有卡）`);
}
if ((heatMaxDist.get(4) ?? 0) === cards.length) errors.push("heatMax 全为 H4（禁止为了库存统一拉 4）");
if ((heatMaxDist.get(1) ?? 0) + (heatMaxDist.get(2) ?? 0) + (heatMaxDist.get(3) ?? 0) === 0) {
  errors.push("heatMax 无一低于 H4（禁止为了库存统一拉 4）");
}
if ((intDist.get(1) ?? 0) + (intDist.get(2) ?? 0) < 8) errors.push(`intensity=1/2 合计 <8，ceiling=1/2 库存不足`);

/* ------------------------------------------------------------------ */
/* 2b. R2｜Truth H1 Bootstrap 包分布（内容形状；单独打印 + 反向护栏）        */
/* ------------------------------------------------------------------ */

console.log("\n--- R2｜Truth H1 Bootstrap 包分布（内容形状，PN-TRUTH-225 起）---");
const bootstrap = FORMAL_TRUTH_BOOTSTRAP_CARDS;
const bootIntDist = countBy(bootstrap.map((card) => card.intensity));
const bootHeatMinDist = countBy(bootstrap.map((card) => card.heatMin));
const bootHeatMaxDist = countBy(bootstrap.map((card) => card.heatMax));
const bootTopicDist = countBy(bootstrap.map((card) => card.topic));
const bootGainDist = countBy(bootstrap.map((card) => card.informationGain));
const bootEnergyDist = countBy(bootstrap.map((card) => card.socialEnergy));
printDistribution("intensity(I1~I5)", bootIntDist, [1, 2, 3, 4, 5]);
printDistribution("heatMin", bootHeatMinDist, [1, 2, 3, 4]);
printDistribution("heatMax", bootHeatMaxDist, [1, 2, 3, 4]);
printDistribution("informationGain", bootGainDist, ["zero", "low", "medium", "high"]);
printDistribution("socialEnergy", bootEnergyDist, ["low", "medium", "high"]);
printDistribution("topic", bootTopicDist, V2_TOPICS);

if (bootstrap.length === 0) errors.push("Bootstrap 包为空（本单要求新增 6~8 张 H1 补卡）");
for (const card of bootstrap) {
  if (card.heatMin !== 1) errors.push(`${card.cardId}: Bootstrap 卡 heatMin=${card.heatMin} ≠ 1（必须是真 H1）`);
}
if ((bootHeatMaxDist.get(4) ?? 0) === bootstrap.length) {
  errors.push("Bootstrap 包 heatMax 全为 H4（禁止为了库存统一拉 4）");
}
if ((bootHeatMaxDist.get(1) ?? 0) + (bootHeatMaxDist.get(2) ?? 0) + (bootHeatMaxDist.get(3) ?? 0) === 0) {
  errors.push("Bootstrap 包 heatMax 无一低于 H4（破冰题到 H4 已太浅，必须逐卡诚实）");
}
if ((bootIntDist.get(1) ?? 0) === bootstrap.length) {
  errors.push("Bootstrap 包 intensity 全为 1（要求做出真正「浅关系但更有现场能量」的 H1+I2/I3 卡）");
}
/** 浅关系题材护栏：Bootstrap 不得触碰深层关系/性/边界题材（由 topic 表达）。 */
const BOOTSTRAP_FORBIDDEN_TOPICS: readonly V2Topic[] = [
  "前任态度",
  "吃醋·占有",
  "异性朋友边界",
  "底线·雷区",
  "亲密边界",
  "性观念·亲密态度",
  "恋爱观",
  "择偶偏好",
  "人生目标·理想生活",
];
for (const card of bootstrap) {
  if (BOOTSTRAP_FORBIDDEN_TOPICS.includes(card.topic)) {
    errors.push(`${card.cardId}: Bootstrap 卡不得用深关系/性/边界题材「${card.topic}」`);
  }
  if (card.intimacyClass !== "none") errors.push(`${card.cardId}: Bootstrap 卡 intimacyClass 必须为 none`);
  if (card.intensity > 3) errors.push(`${card.cardId}: Bootstrap 卡 intensity=${card.intensity} 超出（禁止为曝光做不自然的 I4/I5）`);
}

/** 三红线零命中（复用生产安全硬规则 `isHardBlocked`：露骨 / 强迫惩罚灌酒 / 隐私脱衣非自愿）。 */
const redlineHits = cards.filter((card) => isHardBlocked(`${card.text} ${card.informationGoal}`));
console.log(`\n--- 三红线扫描（生产 isHardBlocked）---\n命中：${redlineHits.length}`);
for (const card of redlineHits) console.log(`  - ${card.cardId}: ${card.text}`);
if (redlineHits.length > 0) errors.push(`三红线命中 ${redlineHits.length} 张（必须 0）`);

/** A.1 审查发现的 2 个零维度 → 既有合法 topic 值。 */
const ZERO_DIMENSIONS: ReadonlyArray<{ label: string; topics: readonly V2Topic[] }> = [
  { label: "零维度1 边界/吃醋/异性朋友/前任", topics: ["吃醋·占有", "异性朋友边界", "前任态度", "底线·雷区"] },
  { label: "零维度2 人生价值/未来", topics: ["人生目标·理想生活"] },
];
console.log("\n--- A.1 零维度补齐 ---");
for (const dimension of ZERO_DIMENSIONS) {
  const detail = dimension.topics.map((topic) => `${topic}:${topicDist.get(topic) ?? 0}`).join("  ");
  const total = dimension.topics.reduce((sum, topic) => sum + (topicDist.get(topic) ?? 0), 0);
  console.log(`${dimension.label} | ${detail} | 合计 ${total}`);
  if (total === 0) errors.push(`${dimension.label} 仍未补齐`);
  for (const topic of dimension.topics) {
    if ((topicDist.get(topic) ?? 0) === 0) errors.push(`${dimension.label} 的 topic「${topic}」仍为 0`);
  }
}
console.log(`性观念·亲密态度 | ${topicDist.get("性观念·亲密态度") ?? 0}；亲密边界 | ${topicDist.get("亲密边界") ?? 0}`);
if ((topicDist.get("性观念·亲密态度") ?? 0) === 0) errors.push("性观念·亲密态度 仍为 0");
const sexualCards = cards.filter((card) => card.topic === "性观念·亲密态度");
for (const card of sexualCards) {
  if (card.intensity < 4) errors.push(`${card.cardId}: 性观念·亲密态度 出现在 intensity=${card.intensity}（只允许 I4/I5）`);
  if (card.intimacyClass !== "attitude") errors.push(`${card.cardId}: 性观念·亲密态度 必须 intimacyClass=attitude`);
}
for (const card of cards.filter((c) => c.intimacyClass === "attitude" && c.intensity < 4)) {
  errors.push(`${card.cardId}: 亲密态度题 intensity=${card.intensity} 低于 4（I4/I5 才可触及）`);
}

/* ------------------------------------------------------------------ */
/* 3~4. 枚举合法性 + 必填字段（逐卡，对照真源 + 正式入库校验器）          */
/* ------------------------------------------------------------------ */

let missingRequiredTotal = 0;
console.log("\n--- 枚举合法性 / 必填字段 ---");
for (const card of cards) {
  enumIssue(card.cardId, "gameType", card.gameType, V2_GAME_TYPES);
  enumIssue(card.cardId, "relationStage", card.relationStage, V2_RELATION_STAGES);
  enumIssue(card.cardId, "targetMode", card.targetMode, V2_TARGET_MODES);
  enumIssue(card.cardId, "responseMode", card.responseMode, V2_RESPONSE_MODES);
  enumIssue(card.cardId, "interactionType", card.interactionType, V2_INTERACTION_TYPES);
  enumIssue(card.cardId, "consentMode", card.consentMode, V2_CONSENT_MODES);
  enumIssue(card.cardId, "fallbackPolicy", card.fallbackPolicy, V2_MAINLINE_FALLBACK_POLICIES);
  enumIssue(card.cardId, "postAction", card.postAction, V2_POST_ACTIONS);
  enumIssue(card.cardId, "topic", card.topic, V2_TOPICS);
  enumIssue(card.cardId, "barFit", card.barFit, V2_BAR_FIT);
  enumIssue(card.cardId, "informationGain", card.informationGain, V2_INFORMATION_GAIN);
  enumIssue(card.cardId, "socialEnergy", card.socialEnergy, V2_SOCIAL_ENERGY);
  enumIssue(card.cardId, "relationshipProgression", card.relationshipProgression, V2_RELATIONSHIP_PROGRESSION);
  enumIssue(card.cardId, "intimacyClass", card.intimacyClass, V2_INTIMACY_CLASSES);
  enumIssue(card.cardId, "informationGoalType", card.informationGoalType, V2_INFORMATION_GOAL_TYPES);
  tagArrayIssue(card.cardId, "signalEffects", card.signalEffects, V2_SIGNAL_EFFECTS);
  tagArrayIssue(card.cardId, "boundaryTags", card.boundaryTags, V2_BOUNDARY_TAG_CATALOG);
  tagArrayIssue(card.cardId, "secondaryTopics", card.secondaryTopics, V2_TOPICS);

  const unknownTags = findUnknownBoundaryTags(card.boundaryTags);
  if (unknownTags.length > 0) errors.push(`${card.cardId}: boundaryTags 含未登记 tag ${unknownTags.join(",")}（Plan §3.1 未知 tag 拒收）`);
  if (new Set(card.boundaryTags).size !== card.boundaryTags.length) errors.push(`${card.cardId}: boundaryTags 有重复项`);
  if (new Set(card.secondaryTopics).size !== card.secondaryTopics.length) errors.push(`${card.cardId}: secondaryTopics 有重复项`);
  if (card.secondaryTopics.includes(card.topic)) errors.push(`${card.cardId}: secondaryTopics 与主 topic 重复`);

  if (typeof card.number !== "number") errors.push(`${card.cardId}: number 非数字`);
  if (typeof card.matchRequired !== "boolean") errors.push(`${card.cardId}: matchRequired 非布尔`);
  if (intOf(card.intensity) === null || card.intensity < 1 || card.intensity > 5) errors.push(`${card.cardId}: intensity 应为 1~5 整数`);
  if (intOf(card.heatMin) === null || card.heatMin < 1 || card.heatMin > 4) errors.push(`${card.cardId}: heatMin 应为 1~4 整数`);
  if (intOf(card.heatMax) === null || card.heatMax < 1 || card.heatMax > 4) errors.push(`${card.cardId}: heatMax 应为 1~4 整数`);
  if (card.heatMax < card.heatMin) errors.push(`${card.cardId}: heatMax < heatMin`);

  const strict = validateFixedCardMetadataStrict(card);
  missingRequiredTotal += strict.missing.filter((field) => (V2_REQUIRED_QUALITY_FIELDS as readonly string[]).includes(field)).length;
  if (!strict.ok) errors.push(`${card.cardId}: validateFixedCardMetadataStrict 不通过（issues=${strict.issues.join("；") || "无"} missing=${strict.missing.join(",") || "无"}）`);
}
console.log(`枚举非法：${enumErrors.length}`);
errors.push(...enumErrors);
console.log(`strict 必填字段缺失数：${missingRequiredTotal}`);
if (missingRequiredTotal !== 0) errors.push(`strict 必填字段缺失 ${missingRequiredTotal} 项 ≠ 0`);
const barFitNotPass = cards.filter((card) => card.barFit !== "PASS");
if (barFitNotPass.length > 0) errors.push(`barFit ≠ PASS 的卡：${barFitNotPass.map((c) => c.cardId).join(",")}`);
const goalGeneric = cards.filter((card) => card.informationGoal.trim() === "促进了解" || card.informationGoal.trim().length === 0);
if (goalGeneric.length > 0) errors.push(`informationGoal 空或泛化：${goalGeneric.map((c) => c.cardId).join(",")}`);

/* ------------------------------------------------------------------ */
/* 5. 与既有 350 题的重复检查                                            */
/* ------------------------------------------------------------------ */

console.log("\n--- 与既有 350 题重复检查 ---");
const existingNorm = new Map(
  existingMainline.map((card) => [card.cardId, { norm: normText(card.text), grams: bigrams(normText(card.text)) }]),
);
const rawTextSet = new Map(existingMainline.map((card) => [card.text.trim(), card.cardId]));
let exactRaw = 0;
let exactNorm = 0;
let maxSim = 0;
let maxSimPair = "";
const nearRows: string[] = [];

for (const card of cards) {
  if (rawTextSet.has(card.text.trim())) {
    exactRaw += 1;
    errors.push(`${card.cardId}: 与 ${rawTextSet.get(card.text.trim())} 题面逐字重复`);
  }
  const norm = normText(card.text);
  const grams = bigrams(norm);
  const sameNorm = [...existingNorm.entries()].filter(([, value]) => value.norm === norm);
  if (sameNorm.length > 0) {
    exactNorm += 1;
    errors.push(`${card.cardId}: 去标点后与 ${sameNorm.map(([id]) => id).join(",")} 完全重复`);
  }
  const scored = [...existingNorm.entries()]
    .map(([id, value]) => ({ id, sim: jaccard(grams, value.grams) }))
    .sort((a, b) => b.sim - a.sim);
  const top = scored.slice(0, 3);
  if (top[0]) {
    if (top[0].sim > maxSim) {
      maxSim = top[0].sim;
      maxSimPair = `${card.cardId} ↔ ${top[0].id}`;
    }
    if (top[0].sim >= NEAR_DUPLICATE_THRESHOLD) {
      nearRows.push(`${card.cardId}（sim ${top[0].sim.toFixed(2)}）↔ ${top.map((r) => `${r.id}:${r.sim.toFixed(2)}`).join(" / ")}`);
    }
  }
}
console.log(`精确重复（逐字）：${exactRaw}；精确重复（去标点）：${exactNorm}`);
console.log(`最高相似度：${maxSim.toFixed(3)}（${maxSimPair}，阈值 ${NEAR_DUPLICATE_THRESHOLD}）`);
if (exactRaw !== 0 || exactNorm !== 0) errors.push("存在精确重复题面（必须改写）");
console.log(`近似清单（bigram Jaccard ≥ ${NEAR_DUPLICATE_THRESHOLD}）：${nearRows.length} 条`);
for (const row of nearRows) console.log(`  - ${row}`);
if (nearRows.length > 0) warnings.push(`近似题面 ${nearRows.length} 条，需人读复核是否改写（不自动判失败）`);
console.log("同 topic 聚集：既有 350 题无 topic 字段（SSOT 0 个质量字段）⇒ 以题面相似度替代比对，见上近似清单。");

// 本包内部重复（同一批内容也不许自我重复）
const internal: string[] = [];
for (let i = 0; i < cards.length; i += 1) {
  for (let j = i + 1; j < cards.length; j += 1) {
    const sim = jaccard(bigrams(normText(cards[i].text)), bigrams(normText(cards[j].text)));
    if (sim >= NEAR_DUPLICATE_THRESHOLD) internal.push(`${cards[i].cardId} ↔ ${cards[j].cardId}（sim ${sim.toFixed(2)}）`);
  }
}
console.log(`本包内近似对（≥ ${NEAR_DUPLICATE_THRESHOLD}）：${internal.length} 条`);
for (const row of internal) console.log(`  - ${row}`);
if (internal.length > 0) warnings.push(`本包内近似 ${internal.length} 对`);

/* ------------------------------------------------------------------ */
/* 6. canonical BAR-FIT 机器预筛                                        */
/* ------------------------------------------------------------------ */

console.log("\n--- canonical BAR-FIT 机器预筛（正文 + consentMode instruction） ---");
const verdictDist = new Map<string, number>();
const suspectRows: string[] = [];
for (const card of cards) {
  const result = judgeCanonicalBarFit(card);
  verdictDist.set(result.machineVerdict, (verdictDist.get(result.machineVerdict) ?? 0) + 1);
  if (result.machineVerdict !== "PASS") {
    suspectRows.push(`${card.cardId}: ${result.machineVerdict} ← ${result.ruleHits.join(",")}（读秒 ${result.metrics.readSeconds}s / 动作 ${result.metrics.startActions}）`);
  }
}
printDistribution("machineVerdict", verdictDist, ["PASS", "SUSPECT", "HARD_FAIL_PATTERN"]);
for (const row of suspectRows) console.log(`  - ${row}`);
if ((verdictDist.get("HARD_FAIL_PATTERN") ?? 0) > 0) errors.push(`canonical BAR-FIT 出现 HARD_FAIL_PATTERN ${verdictDist.get("HARD_FAIL_PATTERN")} 张`);
if ((verdictDist.get("SUSPECT") ?? 0) > 0) warnings.push(`BAR-FIT SUSPECT ${verdictDist.get("SUSPECT")} 张（只进人工复核池，非正式判据）`);

/* ------------------------------------------------------------------ */
/* 7. 逐卡一览                                                          */
/* ------------------------------------------------------------------ */

console.log("\n--- 逐卡一览 ---");
console.log("cardId | intensity | heatMin-heatMax | topic | infoGain | RP | goalType | intimacy | tags | text");
for (const card of cards) {
  console.log(
    [
      card.cardId,
      card.intensity,
      `${card.heatMin}-${card.heatMax}`,
      card.topic,
      card.informationGain,
      card.relationshipProgression,
      card.informationGoalType,
      card.intimacyClass,
      card.boundaryTags.length > 0 ? card.boundaryTags.join("+") : "-",
      card.text,
    ].join(" | "),
  );
}

/* ------------------------------------------------------------------ */
/* 结论                                                               */
/* ------------------------------------------------------------------ */

console.log("\n=== 结论 ===");
for (const warning of warnings) console.log(`WARN ${warning}`);
if (errors.length > 0) {
  console.log(`\n不合规 ${errors.length} 条：`);
  for (const error of errors.slice(0, 80)) console.log(`  - ${error}`);
  process.exit(1);
}
console.log(
  `全部合规：第一包 ${FORMAL_TRUTH_CARDS.length} 张 + Bootstrap ${FORMAL_TRUTH_BOOTSTRAP_CARDS.length} 张（内容源；Formal 归属见 manifest = KEEP 5）= ${cards.length} 张；` +
    `精确重复 0；枚举非法 0；strict 必填缺失 0；heatMin 覆盖 H1~H4（无空档）；heatMax 未统一拉 4；` +
    `intensity 覆盖 1~5；零维度已补；三红线 0 命中；BAR-FIT HARD_FAIL_PATTERN 0。`,
);
