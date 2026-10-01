/**
 * A4c / A5｜第一包 REWRITE 7 张重写批的派生矩阵（**从卡源派生，不手写数字**；planning-only 审计视图）。
 *
 * 「派生优先」纪律：热度分档 / 类别覆盖 / hook / shape 分布的每个数字都由 `PACK1_REWRITE_CARDS`
 * 现算得出，不做第二份手填副本 —— 卡源一改，矩阵与单测期望同步变化，不会出现「数据说没有、
 * 报告说有」的自相矛盾（本项目踩过的坑：note 硬编码结论与实测数据打架）。
 *
 * ## A5 口径变更（2026-09-29，编排者裁决；卡源见 `pack1-rewrite-cards.ts` 文件头）
 * `248 / 249 / 250` 回退到旧 `230 / 231 / 226` 的**原始方向**（H1 生活 / 社交），本批因此：
 * - `heatMin` = **H1×4 + H2×2**（A9-R7 退役 249 后；`H3/H4` 在本批为 0，由 REPLACE 新卡承担）；
 * - 类别覆盖下界随之改由派工单 Part 1 口径给出：`quick_know≥1 / attraction≥1 / follow_up_hook≥3`；
 *   `flirt / body_preference` 在本批**按设计为 0**（⛔ 不得为覆盖指标抬 Heat 或改题向）。
 *
 * ⚠️ A9-R7（2026-09-29 内容返工）：`249` 经内容裁决退役（与 250 同轴）⇒ 移出卡源并逐字归档，
 * 其轴 / 兑现句登记随之删除；本批卡源现为 **6 张**（号段 244~250 内缺 249）。
 *
 * ## 类别覆盖口径（与 Golden 12 同一套重叠口径，便于两批合并统计）
 * - `quick_know`      = `category === "quick_know"`
 * - `attraction`      = `category === "attraction"` **或** `followUpHook === "attraction"`
 * - `flirt`           = `category === "flirt"`     **或** `followUpHook === "flirt_target"`
 * - `body_preference` = `category === "body_preference"` **或** `followUpHook === "body_preference"`
 * - `follow_up_hook`  = `followUpHook !== "none"`
 *
 * ## 「同档不同轴」的落地方式（`GOLDEN12-REVIEW-2.md` 约束①）
 * 每张卡的「轴」是**编辑判定的内容轴**（不是卡字段，故不进 Runtime），逐卡登记在
 * `PACK1_REWRITE_AXES`；单测断言**同一 `heatMin` 档内轴值互不相同**。
 * （A5 去掉了 A4c 的「每档 ≤3 张」硬上限：派工单已定 `heatMin` 由旧方向自然决定，
 * 旧 7 张按设计落 H1×5 + H2×2，档位张数不再是可控量。）
 *
 * ## 「钩子当场可兑现」的落地方式（约束③）
 * 逐卡登记一句**旁人/对方立刻能说出口的反问**到 `PACK1_REWRITE_HOOK_REDEEM_LINES`；
 * 单测断言每张卡都有一条、以「？」结尾、且不含「以后再/下次/回头/观察」这类需要时间的动作。
 */

import {
  PACK1_REWRITE_CARDS,
} from "./pack1-rewrite-cards";
import {
  type GoldenAnswerShape,
  type GoldenCategory,
  type GoldenFollowUpHook,
  type GoldenTruthCard,
} from "../golden12/golden-12-cards";

/* -------------------------------------------------------------------------- */
/* 汇总阈值（A5 派工单 Part 1 冻结的结构指标）                                    */
/* -------------------------------------------------------------------------- */

/**
 * A5 对本批的类别覆盖下界（**放行门**；A9-R6 §4.7 起不含 `follow_up_hook`——
 * 其数量降级为**诊断基线**，当前真值由 `pack1CategoryCoverage().follow_up_hook` 派生）。
 * `flirt` / `body_preference` 为 **0 是设计值**：本批是按旧方向 1:1 重写的 H1/H2 生活·社交题，
 * 这两项覆盖由 REPLACE 新卡承担（见 `pack1-replace-matrix.ts`）。
 */
export const PACK1_REWRITE_CATEGORY_REQUIREMENTS: Readonly<Record<Exclude<GoldenCategory, "follow_up_hook">, number>> = {
  quick_know: 1,
  attraction: 1,
  flirt: 0,
  body_preference: 0,
};

/* -------------------------------------------------------------------------- */
/* 编辑判定字段（planning-only audit 视图，不是卡字段）                           */
/* -------------------------------------------------------------------------- */

/** 逐卡的「内容轴」（约束①用；同档内必须互不相同）。 */
export const PACK1_REWRITE_AXES: Readonly<Record<string, string>> = {
  // A6（主审 §7.1/§7.2）：244 / 249 / 250 换题面后重新登记轴。
  // A7（主审 §A/§F）：244 时间轴拉到今晚、250 补现场因果链，轴随之更新（不换语义族）。
  "PN-TRUTH-244": "今晚被约去下一场时的回应（当场答应 / 再看）",
  "PN-TRUTH-245": "泛社交主动性",
  "PN-TRUTH-246": "吸引对象类型（像自己 / 反差）",
  "PN-TRUTH-247": "心动触发速度（一眼 / 相处）",
  "PN-TRUTH-248": "与新人相处的容忍点",
  // A9-R7：249（这周哪天最像在放假）已退役，轴登记随卡删除。
  // A8（主审 Round-3 §1）：250 的时间轴绑到今晚，轴名随之更新（仍属「休息时间怎么放」语义族）。
  "PN-TRUTH-250": "攒的劲什么时候放（今晚一次放完 / 留着明天）",
};

/** 逐卡的「当场可兑现钩子」（约束③用）：一句旁人/对方立刻能说出口的反问。 */
export const PACK1_REWRITE_HOOK_REDEEM_LINES: Readonly<Record<string, string>> = {
  "PN-TRUTH-244": "那我现在约你下一场，算答应吗？",
  "PN-TRUTH-245": "那我先开口，你接得上吗？",
  "PN-TRUTH-246": "那我算像你的，还是不一样的？",
  "PN-TRUTH-247": "那我现在这条，算一眼吗？",
  "PN-TRUTH-248": "那我这样，算太热情吗？",
  // A9-R7：249 已退役，兑现句登记随卡删除。
  // A8：兑现句随 250 新题面同步（当场反问，与「今晚一次放完 / 留着明天」同源）。
  "PN-TRUTH-250": "那你今晚算一次放完，还是留一点？",
};

/* -------------------------------------------------------------------------- */
/* 派生                                                                        */
/* -------------------------------------------------------------------------- */

/** 矩阵一行（逐卡派生）。 */
export interface Pack1RewriteMatrixRow {
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

/** 题面「中文字」字数：只数 CJK 汉字（与 Golden 12 同口径，便于合并复算）。 */
export function pack1CountHanzi(text: string): number {
  return [...text].filter((char) => /[\u4e00-\u9fff]/u.test(char)).length;
}

/** 逐卡矩阵行（升序，与卡源同序）。 */
export const PACK1_REWRITE_MATRIX: readonly Pack1RewriteMatrixRow[] = PACK1_REWRITE_CARDS.map(
  (card: GoldenTruthCard) => ({
    cardId: card.cardId,
    text: card.text,
    hanziCount: pack1CountHanzi(card.text),
    heatMin: card.heatMin,
    heatMax: card.heatMax,
    intensity: card.intensity,
    category: card.category,
    followUpHook: card.followUpHook,
    expectedAnswerShape: card.expectedAnswerShape,
    topic: card.topic,
    informationGain: card.informationGain,
    axis: PACK1_REWRITE_AXES[card.cardId] ?? "",
  }),
);

/** 按 `heatMin` 分档计数。 */
export function pack1HeatMinDistribution(): Record<number, number> {
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const card of PACK1_REWRITE_CARDS) dist[card.heatMin] = (dist[card.heatMin] ?? 0) + 1;
  return dist;
}

/** 按 `intensity` 分布计数。 */
export function pack1IntensityDistribution(): Record<number, number> {
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const card of PACK1_REWRITE_CARDS) dist[card.intensity] = (dist[card.intensity] ?? 0) + 1;
  return dist;
}

/** 类别覆盖计数（重叠口径，见文件头）。 */
export function pack1CategoryCoverage(): Record<GoldenCategory, number> {
  const coverage: Record<GoldenCategory, number> = {
    quick_know: 0,
    attraction: 0,
    flirt: 0,
    body_preference: 0,
    follow_up_hook: 0,
  };
  for (const card of PACK1_REWRITE_CARDS) {
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
export function pack1FollowUpHookDistribution(): Record<GoldenFollowUpHook, number> {
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
  for (const card of PACK1_REWRITE_CARDS) dist[card.followUpHook] += 1;
  return dist as Record<GoldenFollowUpHook, number>;
}

/** `expectedAnswerShape` 分布。 */
export function pack1AnswerShapeDistribution(): Record<GoldenAnswerShape, number> {
  const dist: Record<string, number> = {
    yes_no: 0,
    binary: 0,
    ternary: 0,
    one_word: 0,
    short_phrase: 0,
  };
  for (const card of PACK1_REWRITE_CARDS) dist[card.expectedAnswerShape] += 1;
  return dist as Record<GoldenAnswerShape, number>;
}

/** 覆盖要求是否全部达标（逐项 ≥ 阈值）。 */
export function pack1CategoryRequirementsMet(): { ok: boolean; gaps: string[] } {
  const coverage = pack1CategoryCoverage();
  const gaps: string[] = [];
  for (const [category, required] of Object.entries(PACK1_REWRITE_CATEGORY_REQUIREMENTS) as Array<
    [GoldenCategory, number]
  >) {
    if (coverage[category] < required) gaps.push(`${category}: ${coverage[category]} < ${required}`);
  }
  return { ok: gaps.length === 0, gaps };
}

/** 同档轴值（`heatMin` → 该档内的内容轴列表），供「同档不同轴」断言使用。 */
export function pack1AxesByHeatTier(): Record<number, string[]> {
  const tiers: Record<number, string[]> = {};
  for (const card of PACK1_REWRITE_CARDS) {
    (tiers[card.heatMin] ??= []).push(PACK1_REWRITE_AXES[card.cardId] ?? "");
  }
  return tiers;
}

/** 人类可读矩阵表（Markdown；报告与人工复核共用，避免手抄）。 */
export function pack1RewriteMatrixMarkdown(): string {
  const header =
    "| cardId | 题面 | 字数 | heatMin-max | intensity | category | followUpHook | shape | topic | 轴 |";
  const sep = "|---|---|---|---|---|---|---|---|---|---|";
  const rows = PACK1_REWRITE_MATRIX.map(
    (row) =>
      `| ${row.cardId} | ${row.text} | ${row.hanziCount} | ${row.heatMin}-${row.heatMax} | ${row.intensity} | ` +
      `${row.category} | ${row.followUpHook} | ${row.expectedAnswerShape} | ${row.topic} | ${row.axis} |`,
  );
  return [header, sep, ...rows].join("\n");
}
