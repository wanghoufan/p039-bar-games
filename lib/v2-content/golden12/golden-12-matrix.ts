/**
 * A4b｜Golden 12 矩阵表（**从卡源派生，不手写**；planning-only 审计视图）。
 *
 * 「派生优先」纪律：矩阵里的每一个数字都由 `GOLDEN_12_CARDS` 现算得出，
 * 不做第二份手填副本 —— 卡源一改，矩阵与单测期望同步变化，不会出现「数据说没有、
 * 报告说有」的自相矛盾（本项目曾踩过：note 硬编码结论与实测数据打架）。
 *
 * ## 类别覆盖口径（含「可与其它类别重叠」的落地方式）
 * 单张卡只有一个 `category`，但覆盖统计允许重叠，规则如下（写死在这里、由单测复算）：
 * - `quick_know`  = `category === "quick_know"`
 * - `attraction`  = `category === "attraction"` **或** `followUpHook === "attraction"`
 * - `flirt`       = `category === "flirt"`     **或** `followUpHook === "flirt_target"`
 * - `body_preference` = `category === "body_preference"` **或** `followUpHook === "body_preference"`
 * - `follow_up_hook`  = `followUpHook !== "none"`（本卡是否带后续互动钩子）
 *
 * 即：`category` 定主类，`followUpHook` 可让同一张卡再进 attraction / flirt / body_preference /
 * follow_up_hook 的覆盖桶。这样「attraction ≥3 / flirt ≥3 / body_preference ≥2 / follow_up_hook ≥4」
 * 与「quick_know ≥2」能同时成立而无需硬凑卡数。
 */

import {
  GOLDEN_12_CARDS,
  type GoldenAnswerShape,
  type GoldenCategory,
  type GoldenFollowUpHook,
  type GoldenTruthCard,
} from "./golden-12-cards";

/* -------------------------------------------------------------------------- */
/* 汇总阈值（Human 冻结的类别覆盖要求）                                          */
/* -------------------------------------------------------------------------- */

/**
 * Human 对本批的类别覆盖下界（**放行门**；A9-R6 §4.7 起不含 `follow_up_hook`）。
 *
 * `follow_up_hook` 的**数量**不再作放行条件——它降级为**诊断基线**（当前真值由
 * `goldenCategoryCoverage().follow_up_hook` 派生，报告如实引用）；语义门禁改由
 * 「`category="follow_up_hook"` 的卡题面须点名对象/动作」承担（见 `pack1-supplement-matrix.ts`
 * 的 `PACK1_FOLLOW_UP_HOOK_TARGET_TOKENS` 与 `pack1FollowUpHookCardsMissingTarget()`）。
 */
export const GOLDEN_CATEGORY_REQUIREMENTS: Readonly<Record<Exclude<GoldenCategory, "follow_up_hook">, number>> = {
  quick_know: 2,
  attraction: 3,
  flirt: 3,
  body_preference: 2,
};

/* -------------------------------------------------------------------------- */
/* 派生工具                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 题面「中文字」字数：只数 CJK 汉字，不含标点/数字/拉丁字母。
 * 与「≤25~30 中文字、一口气念完」的硬风格对齐；由单测复算（≤30）。
 */
export function countHanzi(text: string): number {
  return [...text].filter((char) => /[\u4e00-\u9fff]/u.test(char)).length;
}

/** 矩阵一行（逐卡派生）。 */
export interface GoldenMatrixRow {
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
}

/** 逐卡矩阵行（升序，与卡源同序）。 */
export const GOLDEN_12_MATRIX: readonly GoldenMatrixRow[] = GOLDEN_12_CARDS.map((card: GoldenTruthCard) => ({
  cardId: card.cardId,
  text: card.text,
  hanziCount: countHanzi(card.text),
  heatMin: card.heatMin,
  heatMax: card.heatMax,
  intensity: card.intensity,
  category: card.category,
  followUpHook: card.followUpHook,
  expectedAnswerShape: card.expectedAnswerShape,
  topic: card.topic,
  informationGain: card.informationGain,
}));

/** 按 `heatMin` 分档计数（结构断言用；不硬编码 3/3/3/3）。 */
export function goldenHeatMinDistribution(): Record<number, number> {
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const card of GOLDEN_12_CARDS) dist[card.heatMin] = (dist[card.heatMin] ?? 0) + 1;
  return dist;
}

/** 按 `intensity` 分布计数（派生；报告与断言共用，不手抄）。 */
export function goldenIntensityDistribution(): Record<number, number> {
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const card of GOLDEN_12_CARDS) dist[card.intensity] = (dist[card.intensity] ?? 0) + 1;
  return dist;
}

/** 类别覆盖计数（含重叠口径，见文件头）。 */
export function goldenCategoryCoverage(): Record<GoldenCategory, number> {
  const coverage: Record<GoldenCategory, number> = {
    quick_know: 0,
    attraction: 0,
    flirt: 0,
    body_preference: 0,
    follow_up_hook: 0,
  };
  for (const card of GOLDEN_12_CARDS) {
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
export function goldenFollowUpHookDistribution(): Record<GoldenFollowUpHook, number> {
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
  for (const card of GOLDEN_12_CARDS) dist[card.followUpHook] += 1;
  return dist as Record<GoldenFollowUpHook, number>;
}

/** `expectedAnswerShape` 分布。 */
export function goldenAnswerShapeDistribution(): Record<GoldenAnswerShape, number> {
  const dist: Record<string, number> = {
    yes_no: 0,
    binary: 0,
    ternary: 0,
    one_word: 0,
    short_phrase: 0,
  };
  for (const card of GOLDEN_12_CARDS) dist[card.expectedAnswerShape] += 1;
  return dist as Record<GoldenAnswerShape, number>;
}

/** 覆盖要求是否全部达标（逐项 ≥ 阈值）。 */
export function goldenCategoryRequirementsMet(): { ok: boolean; gaps: string[] } {
  const coverage = goldenCategoryCoverage();
  const gaps: string[] = [];
  for (const [category, required] of Object.entries(GOLDEN_CATEGORY_REQUIREMENTS) as Array<
    [GoldenCategory, number]
  >) {
    if (coverage[category] < required) {
      gaps.push(`${category}: ${coverage[category]} < ${required}`);
    }
  }
  return { ok: gaps.length === 0, gaps };
}

/** 人类可读矩阵表（Markdown；报告与人工复核共用，避免手抄）。 */
export function golden12MatrixMarkdown(): string {
  const header =
    "| cardId | 题面 | 字数 | heatMin-max | intensity | category | followUpHook | shape | topic | informationGain |";
  const sep = "|---|---|---|---|---|---|---|---|---|---|";
  const rows = GOLDEN_12_MATRIX.map(
    (row) =>
      `| ${row.cardId} | ${row.text} | ${row.hanziCount} | ${row.heatMin}-${row.heatMax} | ${row.intensity} | ` +
      `${row.category} | ${row.followUpHook} | ${row.expectedAnswerShape} | ${row.topic} | ${row.informationGain} |`,
  );
  return [header, sep, ...rows].join("\n");
}
