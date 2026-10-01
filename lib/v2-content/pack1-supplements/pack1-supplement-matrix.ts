/**
 * A6｜覆盖率补卡批 + **全批次「卡面 `category` 真值」口径**的派生矩阵（从卡源派生，不手写数字）。
 *
 * ## 为什么单列一份「卡面真值」口径
 * `temp/PACK1-NEW26-REVIEW-1.md` §6-⑥/⑦ 指出：既有三份矩阵（Golden 12 / REWRITE / REPLACE）
 * 的 `*CategoryCoverage()` 都是**重叠口径**——
 * - `attraction` = `category==="attraction"` **或** `followUpHook==="attraction"`
 * - `flirt` = `category==="flirt"` **或** `followUpHook==="flirt_target"`
 * - `body_preference` = `category==="body_preference"` **或** `followUpHook==="body_preference"`
 * - `follow_up_hook` = `followUpHook !== "none"`（＝「带钩子的张数」，**不是**归这一类的张数）
 *
 * 于是「`follow_up_hook` 19」其实是「19 张带钩子」，而**卡面真值只有 1 张**
 * （`PN-TRUTH-265`）。派工单（A6）明确要求：覆盖率断言必须按**卡面 `category` 真值**统计，
 * 且**禁止**再用重叠口径通过。故本模块提供：
 * - `pack1UnionCategoryTruth()`：全批次（Golden 12 ＋ REWRITE ＋ REPLACE ＋ 补卡）**逐卡 re-count 真值**；
 * - `pack1UnionCategoryCoverageOverlap()`：同集合的**重叠口径**（仅供对照/自证差异，**不得用于放行**）；
 * - `PACK1_UNION_CATEGORY_REQUIREMENTS`：A9-R6 §4.7 收紧后的**真值放行门**
 *   （`quick_know≥1 / attraction≥4 / flirt≥5 / body_preference≥3`；`follow_up_hook` 数量**退出放行门**、
 *   降级为诊断基线）。
 *
 * ## A7 `follow_up_hook` 定义收紧（编排者裁决 1）＋ A9-R6 数量退出放行门
 * `follow_up_hook` **只允许**用于「题面本身点名对象或动作、能当场产生后续互动」的卡；
 * 「今晚想接着玩还是先歇」这类**风格偏好**不得标此 category。据此本批 `270 / 271 / 277`
 * 如实降为 `quick_know`（`272` 改为点名两人后仍成立）。
 * ⚠️ A9-R6（§4.7）：数量阈值（曾 12→9）**不再作放行门**，降级为诊断基线；放行只看其余 4 类真值，
 * hook 由**语义门禁**把关（`PACK1_FOLLOW_UP_HOOK_TARGET_TOKENS`：题面须命中对象/动作指向词）。
 *
 * ## 五个 category 的真值语义（逐卡只算一个）
 * `category` 定**主类**，必须如实反映题面：补卡批现为 follow_up_hook（答案本身就是下一步玩法/邀约）
 * ＋ attraction（问「哪种人/哪种互动方式更打动你」）＋ quick_know（风格偏好）三类构成
 * （2026-09-29 A9-R6 退役 277 后现 13 张，逐类张数一律由卡源派生）；
 * ⛔ 不为凑数改既有卡标签、⛔ 不为达标扩义。
 */

import {
  PACK1_REPLACE_CARDS,
} from "../pack1-replaces/pack1-replace-cards";
import {
  PACK1_REWRITE_CARDS,
} from "../pack1-rewrites/pack1-rewrite-cards";
import {
  GOLDEN_12_CARDS,
  type GoldenAnswerShape,
  type GoldenCategory,
  type GoldenFollowUpHook,
  type GoldenTruthCard,
} from "../golden12/golden-12-cards";
import { PACK1_SUPPLEMENT_CARDS } from "./pack1-supplement-cards";
import { pack1CategoryCoverage } from "../pack1-rewrites/pack1-rewrite-matrix";
import { pack1ReplaceCategoryCoverage } from "../pack1-replaces/pack1-replace-matrix";
import { goldenCategoryCoverage } from "../golden12/golden-12-matrix";

/* -------------------------------------------------------------------------- */
/* 汇总阈值（A6 派工单 Part 4 冻结的真值目标）                                    */
/* -------------------------------------------------------------------------- */

/**
 * 全批次（Golden 12 ＋ REWRITE ＋ REPLACE ＋ 补卡）**卡面 `category` 真值**下界（**放行门**）。
 *
 * ## A9-R6 §4.7｜`follow_up_hook` 退出放行门
 * Human 冻结的是「hook 很重要、必须是真钩子」，**没有**冻结「必须 12」或「必须 9」。
 * 旧做法「阈值 12→9 然后宣布 PASS」属**指标追着现状跑** ⇒ 本单取消这个放行门：
 * `follow_up_hook` 的**数量**降级为**诊断基线**（当前真值由 `pack1UnionCategoryTruth().follow_up_hook`
 * 派生，报告如实引用）；其**语义门禁**保留并加强为「`category="follow_up_hook"` 的卡题面必须直接
 * 产出下一步对象 / 动作 / 可兑现互动」（见 `PACK1_FOLLOW_UP_HOOK_TARGET_TOKENS` 与
 * `pack1FollowUpHookCardsMissingTarget()`）。
 *
 * ⛔ 只按真值判定；**不得**用重叠口径替代（重叠口径会把 `follow_up_hook` 报成「带钩子张数」）。
 */
export const PACK1_UNION_CATEGORY_REQUIREMENTS: Readonly<Record<Exclude<GoldenCategory, "follow_up_hook">, number>> = {
  quick_know: 1,
  attraction: 4,
  flirt: 5,
  body_preference: 3,
};

/**
 * `follow_up_hook` 数量的**诊断基线**说明（A9-R6 §4.7）。
 * 数量本身不再作放行门；真实值一律从 `pack1UnionCategoryTruth()` 派生后由报告引用。
 */
export const PACK1_FOLLOW_UP_HOOK_DIAGNOSTIC_NOTE =
  "`follow_up_hook` 数量为**诊断基线**（当前真值由卡面 category 真值派生），⛔ 不作单批/全批放行条件；" +
  "放行只看全批次 category 真值（quick_know / attraction / flirt / body_preference），" +
  "语义门禁由「category=follow_up_hook 的卡题面须点名对象/动作」承担。";

/**
 * A7 `follow_up_hook` 收紧口径的**可机检护栏**：`category="follow_up_hook"` 的卡，题面必须
 * **点名对象或动作**（不是纯风格偏好）。命中下列任一「对象/动作指向词」才算成立：
 * - 对象指向：`谁`（跟谁/拉谁/给谁/听谁）、`哪个`（哪个微信）、`那位`（刚坐过来的那位）、`某个`（等某个人一起溜）；
 * - 动作指向：`找人`（265 的「找人聊」——一个可执行的下一步动作）。
 *
 * ⛔ 不得为让某张风格偏好卡「达标」而往词表里塞泛词；新增指向词须同时说明它对应该卡哪一个
 * **具体对象或可执行动作**（防下一批再靠扩义凑数）。
 */
export const PACK1_FOLLOW_UP_HOOK_TARGET_TOKENS = ["谁", "哪个", "那位", "某个", "找人"] as const;

/* -------------------------------------------------------------------------- */
/* 编辑判定字段（planning-only audit 视图，不是卡字段）                           */
/* -------------------------------------------------------------------------- */

/** 逐卡的「内容轴」（约束①用；同档内必须互不相同）。 */
export const PACK1_SUPPLEMENT_AXES: Readonly<Record<string, string>> = {
  // H2
  // A8（主审 Round-3 §1）：270 换轴到饮品方式（旧「再战还是先撤」与 278 撞去留轴）。
  "PN-TRUTH-270": "喝法（接着干杯 / 改喝点软的）",
  "PN-TRUTH-271": "换场口味（安静 / 吵）",
  "PN-TRUTH-272": "下一轮续聊对象（刚坐过来的 / 原本在聊的）",
  // A9-R6：277（回程方式）已退役，轴登记随卡删除。
  "PN-TRUTH-282": "心动风格（撒娇 / 嘴硬）",
  "PN-TRUTH-283": "角色位（主动逗 / 被逗）",
  // H3
  "PN-TRUTH-273": "散场同行人",
  "PN-TRUTH-274": "组队对象",
  // A8（主审 Round-3 §1）：275 由「跟谁玩一局狼人杀」（＝组队）换成 1v1 单挑，脱离与 274 的同轴。
  "PN-TRUTH-275": "下一轮单挑对象（跟谁比一局飞镖）",
  "PN-TRUTH-276": "单独透气对象",
  "PN-TRUTH-278": "最后一圈走还是留（先溜 / 等某人一起）",
  "PN-TRUTH-279": "当场要微信的对象（散场前）",
  "PN-TRUTH-280": "点歌对象",
  "PN-TRUTH-281": "最后一段同行对象（跟谁把这杯喝完）",
};

/**
 * 逐卡的「镜头 / 动作帧」（**审计辅助表**，不再是约束①的达成证据）。
 *
 * 为什么单列：主审 §E① 指出「轴名唯一 ≠ 语义不同轴」——只靠 `PACK1_SUPPLEMENT_AXES` 的字符串
 * 去重就能过闸，是被人绕过的口子。
 *
 * ⚠️ **A8 降级（主审 Round-3 §4/§10.3 裁决）**：本表与 `PACK1_SUPPLEMENT_AXES` 同为**逐卡手写的
 * 自由字符串**，「同档唯一」只因作者给每张卡各编了一个名字 ⇒ **只能当审计辅助**（提醒审计员逐张看），
 * **不得再单独充当约束①（同档不同轴）的达成证据**。约束①的真判据＝`pack1-semantic-axes.ts` 的
 * **语义签名**（`referent`＋`answerSpace`＋`axis`，轴由 token 规则派生、非逐卡手写）。
 */
export const PACK1_SUPPLEMENT_SHOTS: Readonly<Record<string, string>> = {
  // H2
  "PN-TRUTH-270": "喝法（干杯 / 换软的）",
  "PN-TRUTH-271": "换场",
  "PN-TRUTH-272": "续聊",
  // A9-R6：277 已退役，镜头登记随卡删除。
  "PN-TRUTH-282": "风格偏好（撒娇 / 嘴硬）",
  "PN-TRUTH-283": "角色位（逗 / 被逗）",
  // H3
  "PN-TRUTH-273": "同行·走",
  "PN-TRUTH-274": "组队",
  "PN-TRUTH-275": "单挑·飞镖",
  "PN-TRUTH-276": "透气",
  "PN-TRUTH-278": "走 / 留",
  "PN-TRUTH-279": "要联系方式",
  "PN-TRUTH-280": "点歌",
  "PN-TRUTH-281": "喝完这杯",
};

/** 逐卡的「当场可兑现钩子」（约束③用）：一句旁人/对方立刻能说出口的反问。 */
export const PACK1_SUPPLEMENT_HOOK_REDEEM_LINES: Readonly<Record<string, string>> = {
  // A8：兑现句随 270 / 275 新题面同步（当场反问、与新题面同源）。
  "PN-TRUTH-270": "那你跟我干杯，还是换软的？",
  "PN-TRUTH-271": "那换个安静点的地方，你跟我走吗？",
  "PN-TRUTH-272": "那下一轮，我算那位吗？",
  "PN-TRUTH-273": "那走的时候，算我一个？",
  "PN-TRUTH-274": "那分队的时候，我能跟你一队吗？",
  "PN-TRUTH-275": "那这局飞镖，我先手？",
  "PN-TRUTH-276": "那这口气，陪我一起透？",
  // A9-R6：277 已退役，兑现句登记随卡删除。
  "PN-TRUTH-278": "那你要等的某人，是我吗？",
  "PN-TRUTH-279": "那我现在要你的微信，给不给？",
  "PN-TRUTH-280": "那这首歌，我先点给你？",
  "PN-TRUTH-281": "那这杯，我陪你喝完？",
  "PN-TRUTH-282": "那我这样算撒娇还是嘴硬？",
  "PN-TRUTH-283": "那我现在逗你一下，算哪种？",
};

/* -------------------------------------------------------------------------- */
/* 派生                                                                        */
/* -------------------------------------------------------------------------- */

/** 矩阵一行（逐卡派生）。 */
export interface Pack1SupplementMatrixRow {
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
  readonly shot: string;
}

/** 题面「中文字」字数：只数 CJK 汉字（与三批同口径，便于合并复算）。 */
export function pack1SupplementCountHanzi(text: string): number {
  return [...text].filter((char) => /[\u4e00-\u9fff]/u.test(char)).length;
}

/** 逐卡矩阵行（升序，与卡源同序）。 */
export const PACK1_SUPPLEMENT_MATRIX: readonly Pack1SupplementMatrixRow[] = PACK1_SUPPLEMENT_CARDS.map(
  (card: GoldenTruthCard) => ({
    cardId: card.cardId,
    text: card.text,
    hanziCount: pack1SupplementCountHanzi(card.text),
    heatMin: card.heatMin,
    heatMax: card.heatMax,
    intensity: card.intensity,
    category: card.category,
    followUpHook: card.followUpHook,
    expectedAnswerShape: card.expectedAnswerShape,
    topic: card.topic,
    informationGain: card.informationGain,
    axis: PACK1_SUPPLEMENT_AXES[card.cardId] ?? "",
    shot: PACK1_SUPPLEMENT_SHOTS[card.cardId] ?? "",
  }),
);

/** 按 `heatMin` 分档计数。 */
export function pack1SupplementHeatMinDistribution(): Record<number, number> {
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const card of PACK1_SUPPLEMENT_CARDS) dist[card.heatMin] = (dist[card.heatMin] ?? 0) + 1;
  return dist;
}

/** 按 `intensity` 分布计数。 */
export function pack1SupplementIntensityDistribution(): Record<number, number> {
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const card of PACK1_SUPPLEMENT_CARDS) dist[card.intensity] = (dist[card.intensity] ?? 0) + 1;
  return dist;
}

/** 本批**卡面 `category` 真值**计数（逐卡 re-count，无重叠）。 */
export function pack1SupplementCategoryTruth(): Record<GoldenCategory, number> {
  const truth: Record<GoldenCategory, number> = {
    quick_know: 0,
    attraction: 0,
    flirt: 0,
    body_preference: 0,
    follow_up_hook: 0,
  };
  for (const card of PACK1_SUPPLEMENT_CARDS) truth[card.category] += 1;
  return truth;
}

/** `followUpHook` 分布（8 值全集，缺项计 0）。 */
export function pack1SupplementFollowUpHookDistribution(): Record<GoldenFollowUpHook, number> {
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
  for (const card of PACK1_SUPPLEMENT_CARDS) dist[card.followUpHook] += 1;
  return dist as Record<GoldenFollowUpHook, number>;
}

/** `expectedAnswerShape` 分布。 */
export function pack1SupplementAnswerShapeDistribution(): Record<GoldenAnswerShape, number> {
  const dist: Record<string, number> = {
    yes_no: 0,
    binary: 0,
    ternary: 0,
    one_word: 0,
    short_phrase: 0,
  };
  for (const card of PACK1_SUPPLEMENT_CARDS) dist[card.expectedAnswerShape] += 1;
  return dist as Record<GoldenAnswerShape, number>;
}

/** 同档轴值（`heatMin` → 该档内的内容轴列表），供「同档不同轴」断言使用。 */
export function pack1SupplementAxesByHeatTier(): Record<number, string[]> {
  const tiers: Record<number, string[]> = {};
  for (const card of PACK1_SUPPLEMENT_CARDS) {
    (tiers[card.heatMin] ??= []).push(PACK1_SUPPLEMENT_AXES[card.cardId] ?? "");
  }
  return tiers;
}

/** 同档镜头/动作帧（`heatMin` → 该档内的动作帧列表），供「同档不同镜头」断言使用。 */
export function pack1SupplementShotsByHeatTier(): Record<number, string[]> {
  const tiers: Record<number, string[]> = {};
  for (const card of PACK1_SUPPLEMENT_CARDS) {
    (tiers[card.heatMin] ??= []).push(PACK1_SUPPLEMENT_SHOTS[card.cardId] ?? "");
  }
  return tiers;
}

/**
 * `category="follow_up_hook"` 的卡是否**在题面里点名了对象或动作**（A7 收紧口径机检）。
 * 返回未命中任何指向词的卡 ID（空数组 = 全部合规）。
 */
export function pack1FollowUpHookCardsMissingTarget(
  cards: readonly GoldenTruthCard[] = PACK1_SUPPLEMENT_CARDS,
): string[] {
  return cards
    .filter((card) => card.category === "follow_up_hook")
    .filter(
      (card) => !PACK1_FOLLOW_UP_HOOK_TARGET_TOKENS.some((token) => card.text.includes(token)),
    )
    .map((card) => card.cardId);
}

/* -------------------------------------------------------------------------- */
/* 全批次（Golden 12 ＋ REWRITE ＋ REPLACE ＋ 补卡）真值 / 重叠双口径             */
/* -------------------------------------------------------------------------- */

/** 全批次卡源（升序：Golden 12 → REWRITE → REPLACE → 补卡）。 */
export const PACK1_UNION_CARDS: readonly GoldenTruthCard[] = [
  ...GOLDEN_12_CARDS,
  ...PACK1_REWRITE_CARDS,
  ...PACK1_REPLACE_CARDS,
  ...PACK1_SUPPLEMENT_CARDS,
];

/**
 * 全批次**卡面 `category` 真值**（逐卡 re-count，无重叠）。
 * ⛔ 覆盖率放行只看这个口径；重叠口径只作对照（见下）。
 */
export function pack1UnionCategoryTruth(): Record<GoldenCategory, number> {
  const truth: Record<GoldenCategory, number> = {
    quick_know: 0,
    attraction: 0,
    flirt: 0,
    body_preference: 0,
    follow_up_hook: 0,
  };
  for (const card of PACK1_UNION_CARDS) truth[card.category] += 1;
  return truth;
}

/**
 * 全批次**重叠口径**（`category` 或 `hook`）——**仅供对照/自证差异，禁止用于放行**。
 * `follow_up_hook` 一项在这口径下＝「带钩子的张数」，与真值口径不可混用（主审 §6-⑦ 的病根）。
 */
export function pack1UnionCategoryCoverageOverlap(): Record<GoldenCategory, number> {
  const overlap: Record<GoldenCategory, number> = {
    quick_know: 0,
    attraction: 0,
    flirt: 0,
    body_preference: 0,
    follow_up_hook: 0,
  };
  for (const card of PACK1_UNION_CARDS) {
    if (card.category === "quick_know") overlap.quick_know += 1;
    if (card.category === "attraction" || card.followUpHook === "attraction") overlap.attraction += 1;
    if (card.category === "flirt" || card.followUpHook === "flirt_target") overlap.flirt += 1;
    if (card.category === "body_preference" || card.followUpHook === "body_preference") {
      overlap.body_preference += 1;
    }
    if (card.followUpHook !== "none") overlap.follow_up_hook += 1;
  }
  return overlap;
}

/** 各批重叠口径之和（与 `pack1UnionCategoryCoverageOverlap()` 对账用；两者必须相等）。 */
export function pack1UnionCategoryCoverageOverlapByBatch(): Record<GoldenCategory, number> {
  const batches = [
    goldenCategoryCoverage(),
    pack1CategoryCoverage(),
    pack1ReplaceCategoryCoverage(),
    // 补卡批的重叠口径（就地算，避免再引一个函数）。
    (() => {
      const local: Record<GoldenCategory, number> = {
        quick_know: 0,
        attraction: 0,
        flirt: 0,
        body_preference: 0,
        follow_up_hook: 0,
      };
      for (const card of PACK1_SUPPLEMENT_CARDS) {
        if (card.category === "quick_know") local.quick_know += 1;
        if (card.category === "attraction" || card.followUpHook === "attraction") local.attraction += 1;
        if (card.category === "flirt" || card.followUpHook === "flirt_target") local.flirt += 1;
        if (card.category === "body_preference" || card.followUpHook === "body_preference") {
          local.body_preference += 1;
        }
        if (card.followUpHook !== "none") local.follow_up_hook += 1;
      }
      return local;
    })(),
  ];
  const sum: Record<GoldenCategory, number> = {
    quick_know: 0,
    attraction: 0,
    flirt: 0,
    body_preference: 0,
    follow_up_hook: 0,
  };
  for (const batch of batches) {
    for (const key of Object.keys(sum) as GoldenCategory[]) sum[key] += batch[key];
  }
  return sum;
}

/** 真值口径是否全部达标（逐项 ≥ 阈值）。⛔ 只用真值口径。 */
export function pack1UnionCategoryTruthRequirementsMet(): { ok: boolean; gaps: string[] } {
  const truth = pack1UnionCategoryTruth();
  const gaps: string[] = [];
  for (const [category, required] of Object.entries(PACK1_UNION_CATEGORY_REQUIREMENTS) as Array<
    [GoldenCategory, number]
  >) {
    if (truth[category] < required) gaps.push(`${category}: ${truth[category]} < ${required}`);
  }
  return { ok: gaps.length === 0, gaps };
}

/** 全批次 `followUpHook` 分布（单列统计，8 值全集）。 */
export function pack1UnionFollowUpHookDistribution(): Record<GoldenFollowUpHook, number> {
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
  for (const card of PACK1_UNION_CARDS) dist[card.followUpHook] += 1;
  return dist as Record<GoldenFollowUpHook, number>;
}

/** 全批次 `heatMin` 分档（H1~H4 分布与余量）。 */
export function pack1UnionHeatMinDistribution(): Record<number, number> {
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const card of PACK1_UNION_CARDS) dist[card.heatMin] = (dist[card.heatMin] ?? 0) + 1;
  return dist;
}

/** 人类可读矩阵表（Markdown；报告与人工复核共用，避免手抄）。 */
export function pack1SupplementMatrixMarkdown(): string {
  const header =
    "| cardId | 题面 | 字数 | heatMin-max | intensity | category | followUpHook | shape | topic | 轴 | 镜头 |";
  const sep = "|---|---|---|---|---|---|---|---|---|---|---|";
  const rows = PACK1_SUPPLEMENT_MATRIX.map(
    (row) =>
      `| ${row.cardId} | ${row.text} | ${row.hanziCount} | ${row.heatMin}-${row.heatMax} | ${row.intensity} | ` +
      `${row.category} | ${row.followUpHook} | ${row.expectedAnswerShape} | ${row.topic} | ${row.axis} | ${row.shot} |`,
  );
  return [header, sep, ...rows].join("\n");
}
