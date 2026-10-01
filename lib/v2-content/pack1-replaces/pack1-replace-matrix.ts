/**
 * A5｜第一包 REPLACE 换向新卡的派生矩阵（**从卡源派生，不手写数字**；planning-only 审计视图）。
 *
 * ⚠️ A9-R6（2026-09-29）：`263` 已退役 ⇒ 本批卡源现为 **18 张**（号段 251~269 内缺 263）、
 * `heatMin` 分布 H1×3 / H2×7 / H3×5 / H4×3；张数一律由 `PACK1_REPLACE_CARD_IDS.length` 派生。
 *
 * 「派生优先」纪律：热度分档 / 类别覆盖 / hook / shape 分布的每个数字都由 `PACK1_REPLACE_CARDS`
 * 现算得出，不做第二份手填副本 —— 卡源一改，矩阵与单测期望同步变化，不会出现「数据说没有、
 * 报告说有」的自相矛盾（本项目踩过的坑：note 硬编码结论与实测数据打架）。
 *
 * ## 类别覆盖口径（与 Golden 12 / 第一包 REWRITE 同一套重叠口径，便于三批合并统计）
 * - `quick_know`      = `category === "quick_know"`
 * - `attraction`      = `category === "attraction"` **或** `followUpHook === "attraction"`
 * - `flirt`           = `category === "flirt"`     **或** `followUpHook === "flirt_target"`
 * - `body_preference` = `category === "body_preference"` **或** `followUpHook === "body_preference"`
 * - `follow_up_hook`  = `followUpHook !== "none"`
 *
 * ## 「同档不同轴」的落地方式（`GOLDEN12-REVIEW-2.md` 约束①）
 * 每张卡的「轴」是**编辑判定的内容轴**（不是卡字段，故不进 Runtime），逐卡登记在
 * `PACK1_REPLACE_AXES`；单测断言**同一 `heatMin` 档内轴值互不相同**。
 * 本批档位张数（H1×3 / H2×7 / H3×5 / H4×3，A9-R6 退役 263 后）由内容自然决定，不设「每档 ≤3 张」上限。
 *
 * ## 「钩子当场可兑现」的落地方式（约束③）
 * 逐卡登记一句**旁人/对方立刻能说出口的反问**到 `PACK1_REPLACE_HOOK_REDEEM_LINES`；
 * 单测断言每张卡都有一条、以「？」结尾、且不含「以后再/下次/回头/观察」这类需要时间的动作。
 */

import {
  PACK1_REPLACE_CARDS,
} from "./pack1-replace-cards";
import {
  type GoldenAnswerShape,
  type GoldenCategory,
  type GoldenFollowUpHook,
  type GoldenTruthCard,
} from "../golden12/golden-12-cards";

/* -------------------------------------------------------------------------- */
/* 汇总阈值（A5 派工单 Part 2 冻结的结构指标）                                    */
/* -------------------------------------------------------------------------- */

/**
 * A5 对本批的类别覆盖下界（**放行门**；A9-R6 §4.7 起不含 `follow_up_hook`——
 * 其数量降级为**诊断基线**，当前真值由 `pack1ReplaceCategoryCoverage().follow_up_hook` 派生）。
 */
export const PACK1_REPLACE_CATEGORY_REQUIREMENTS: Readonly<Record<Exclude<GoldenCategory, "follow_up_hook">, number>> = {
  quick_know: 1,
  // A7：`256` 由 `attraction` 改 `quick_know`（题面问排斥偏好，`category` 真值口径不再计 attraction）；
  // 本批 `attraction` 的**卡面 `category` 真值**只剩 254（= 1），**重叠口径**（含 256 的 `attraction` hook）
  // 为 2。本批目标随之为 1；**全批次** `attraction` 真值 ≥4 由真值口径把关
  // （`pack1UnionCategoryTruthRequirementsMet()`），本批不再承担 `attraction` 主指标。
  attraction: 1,
  flirt: 5,
  body_preference: 3,
};

/**
 * A5 派工单对本批的热档指标：H3 ≥4、H4 ≥3（当前正式库存 H3/H4 ＝ 0，本批是补库存主力），
 * 且 `H1` 要少（≤3）。这三个数字都由卡源派生对账，不手填进断言之外的任何地方。
 */
export const PACK1_REPLACE_HEAT_TIER_TARGETS = {
  h1Max: 3,
  h3Min: 4,
  h4Min: 3,
} as const;

/* -------------------------------------------------------------------------- */
/* 编辑判定字段（planning-only audit 视图，不是卡字段）                           */
/* -------------------------------------------------------------------------- */

/** 逐卡的「内容轴」（约束①用；同档内必须互不相同）。 */
export const PACK1_REPLACE_AXES: Readonly<Record<string, string>> = {
  // H1
  "PN-TRUTH-261": "当前感情状态",
  // A9-R7（2026-09-29 内容返工）：262 换轴到「被夸的偏好（夸到点上 / 夸得夸张）」、266 三选项
  // 统一到「抽空想做的休闲小事」、252 C 选项改具体并把三选项统一到「局的熟悉度」；轴名随之更新。
  "PN-TRUTH-262": "被夸的偏好（夸到点上 / 夸得夸张）",
  "PN-TRUTH-266": "抽空想做的休闲小事（补觉 / 散步 / 看剧）",
  // H2
  "PN-TRUTH-252": "局的熟悉度（全是熟人 / 半熟不熟 / 谁也不认识）",
  "PN-TRUTH-254": "吸引对象气质（心跳 / 安心）",
  "PN-TRUTH-255": "当下摩擦的容忍阈值（这桌谁最不能惹）",
  "PN-TRUTH-256": "搭讪方式的减分点",
  "PN-TRUTH-259": "异性朋友消息的回复节奏",
  // A9-R6：263（快散场时的去留）已退役，轴登记随卡删除。
  "PN-TRUTH-264": "被开玩笑的雷点",
  "PN-TRUTH-265": "今晚剩余时间的用法",
  // H3
  "PN-TRUTH-251": "现场第一眼注意对象（被动吸引）",
  "PN-TRUTH-253": "联系方式请求的当场反应",
  "PN-TRUTH-257": "凑近说悄悄话的意愿",
  "PN-TRUTH-258": "搭话的开场策略（自曝 / 抛问题）",
  "PN-TRUTH-260": "看到喜欢的人跟别人聊时的行动",
  // H4
  "PN-TRUTH-267": "亲密里的加分项（先问一句 / 慢一点 / 抱久一点）",
  "PN-TRUTH-268": "接触部位偏好",
  // A7（主审 §F）：269 由「亲密节奏」换到**主动权**轴，与 267 的「加分项」不再撞轴。
  "PN-TRUTH-269": "亲密主动权（主动 / 等对方先）",
};

/** 逐卡的「当场可兑现钩子」（约束③用）：一句旁人/对方立刻能说出口的反问。 */
export const PACK1_REPLACE_HOOK_REDEEM_LINES: Readonly<Record<string, string>> = {
  "PN-TRUTH-251": "那我算被你注意到的吗？",
  "PN-TRUTH-252": "那今晚这局，你放得开吗？",
  "PN-TRUTH-253": "那我现在要，你给不给？",
  "PN-TRUTH-254": "那我现在算让你心跳的吗？",
  "PN-TRUTH-255": "那这桌最不能惹的，是我吗？",
  "PN-TRUTH-256": "那我这种，算太急还是太油？",
  "PN-TRUTH-257": "那我现在凑近说一句，你听不听？",
  "PN-TRUTH-258": "那我现在抛个问题，你接不接？",
  "PN-TRUTH-259": "那我半夜发，你回不回？",
  "PN-TRUTH-260": "那我现在找人聊两句，你会过来吗？",
  "PN-TRUTH-261": "那我今晚算有机会吗？",
  // A9-R7：262 兑现句随新题面同步（当场反问、与新题面同源，无「安静 / 气 / 哭」残留）。
  "PN-TRUTH-262": "那我现在夸你一句，你吃哪种？",
  // A9-R6：263 已退役，兑现句登记随卡删除。
  "PN-TRUTH-264": "那我拿这点逗你，会翻车吗？",
  "PN-TRUTH-265": "那找人聊那档，算我一个？",
  "PN-TRUTH-266": "那散步那件，算我一个？",
  "PN-TRUTH-267": "那我先问一句，算加分吗？",
  "PN-TRUTH-268": "那我碰你手这一下，算第几种？",
  "PN-TRUTH-269": "那我现在，算主动的那个吗？",
};

/* -------------------------------------------------------------------------- */
/* 派生                                                                        */
/* -------------------------------------------------------------------------- */

/** 矩阵一行（逐卡派生）。 */
export interface Pack1ReplaceMatrixRow {
  readonly cardId: string;
  readonly text: string;
  readonly hanziCount: number;
  readonly heatMin: number;
  readonly heatMax: number;
  readonly intensity: number;
  readonly category: GoldenCategory;
  readonly followUpHook: GoldenFollowUpHook;
  readonly expectedAnswerShape: GoldenAnswerShape;
  readonly topic: string;
  readonly informationGain: string;
  readonly axis: string;
}

/** 题面「中文字」字数：只数 CJK 汉字（与 Golden 12 / 第一包 REWRITE 同口径，便于合并复算）。 */
export function pack1ReplaceCountHanzi(text: string): number {
  return [...text].filter((char) => /[\u4e00-\u9fff]/u.test(char)).length;
}

/** 逐卡矩阵行（升序，与卡源同序）。 */
export const PACK1_REPLACE_MATRIX: readonly Pack1ReplaceMatrixRow[] = PACK1_REPLACE_CARDS.map(
  (card: GoldenTruthCard) => ({
    cardId: card.cardId,
    text: card.text,
    hanziCount: pack1ReplaceCountHanzi(card.text),
    heatMin: card.heatMin,
    heatMax: card.heatMax,
    intensity: card.intensity,
    category: card.category,
    followUpHook: card.followUpHook,
    expectedAnswerShape: card.expectedAnswerShape,
    topic: card.topic,
    informationGain: card.informationGain,
    axis: PACK1_REPLACE_AXES[card.cardId] ?? "",
  }),
);

/** 按 `heatMin` 分档计数。 */
export function pack1ReplaceHeatMinDistribution(): Record<number, number> {
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const card of PACK1_REPLACE_CARDS) dist[card.heatMin] = (dist[card.heatMin] ?? 0) + 1;
  return dist;
}

/** 按 `intensity` 分布计数。 */
export function pack1ReplaceIntensityDistribution(): Record<number, number> {
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const card of PACK1_REPLACE_CARDS) dist[card.intensity] = (dist[card.intensity] ?? 0) + 1;
  return dist;
}

/** 类别覆盖计数（重叠口径，见文件头）。 */
export function pack1ReplaceCategoryCoverage(): Record<GoldenCategory, number> {
  const coverage: Record<GoldenCategory, number> = {
    quick_know: 0,
    attraction: 0,
    flirt: 0,
    body_preference: 0,
    follow_up_hook: 0,
  };
  for (const card of PACK1_REPLACE_CARDS) {
    if (card.category === "quick_know") coverage.quick_know += 1;
    if (card.category === "attraction" || card.followUpHook === "attraction") coverage.attraction += 1;
    if (card.category === "flirt" || card.followUpHook === "flirt_target") coverage.flirt += 1;
    if (card.category === "body_preference" || card.followUpHook === "body_preference") {
      coverage.body_preference += 1;
    }
    if (card.followUpHook !== "none") coverage.follow_up_hook += 1;
  }
  return coverage;
}

/** `followUpHook` 分布（8 值全集，缺项计 0）。 */
export function pack1ReplaceFollowUpHookDistribution(): Record<GoldenFollowUpHook, number> {
  const dist: Record<string, number> = {
    none: 0,
    attraction: 0,
    initiative: 0,
    eye_contact: 0,
    body_preference: 0,
    contact_preference: 0,
    flirt_target: 0,
    social_style: 0,
  };
  for (const card of PACK1_REPLACE_CARDS) dist[card.followUpHook] += 1;
  return dist as Record<GoldenFollowUpHook, number>;
}

/** `expectedAnswerShape` 分布。 */
export function pack1ReplaceAnswerShapeDistribution(): Record<GoldenAnswerShape, number> {
  const dist: Record<string, number> = {
    yes_no: 0,
    binary: 0,
    ternary: 0,
    one_word: 0,
    short_phrase: 0,
  };
  for (const card of PACK1_REPLACE_CARDS) dist[card.expectedAnswerShape] += 1;
  return dist as Record<GoldenAnswerShape, number>;
}

/** 覆盖要求是否全部达标（逐项 ≥ 阈值）。 */
export function pack1ReplaceCategoryRequirementsMet(): { ok: boolean; gaps: string[] } {
  const coverage = pack1ReplaceCategoryCoverage();
  const gaps: string[] = [];
  for (const [category, required] of Object.entries(PACK1_REPLACE_CATEGORY_REQUIREMENTS) as Array<
    [GoldenCategory, number]
  >) {
    if (coverage[category] < required) gaps.push(`${category}: ${coverage[category]} < ${required}`);
  }
  return { ok: gaps.length === 0, gaps };
}

/** 同档轴值（`heatMin` → 该档内的内容轴列表），供「同档不同轴」断言使用。 */
export function pack1ReplaceAxesByHeatTier(): Record<number, string[]> {
  const tiers: Record<number, string[]> = {};
  for (const card of PACK1_REPLACE_CARDS) {
    (tiers[card.heatMin] ??= []).push(PACK1_REPLACE_AXES[card.cardId] ?? "");
  }
  return tiers;
}

/** 人类可读矩阵表（Markdown；报告与人工复核共用，避免手抄）。 */
export function pack1ReplaceMatrixMarkdown(): string {
  const header =
    "| cardId | 题面 | 字数 | heatMin-max | intensity | category | followUpHook | shape | topic | 轴 |";
  const sep = "|---|---|---|---|---|---|---|---|---|---|";
  const rows = PACK1_REPLACE_MATRIX.map(
    (row) =>
      `| ${row.cardId} | ${row.text} | ${row.hanziCount} | ${row.heatMin}-${row.heatMax} | ${row.intensity} | ` +
      `${row.category} | ${row.followUpHook} | ${row.expectedAnswerShape} | ${row.topic} | ${row.axis} |`,
  );
  return [header, sep, ...rows].join("\n");
}
