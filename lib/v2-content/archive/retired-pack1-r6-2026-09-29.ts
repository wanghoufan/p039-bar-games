/**
 * A9-R6｜内容裁决退役 Truth 卡归档（**只读历史，不参与任何运行时**）。
 *
 * ## 为什么存在
 * A9-R6 内容裁决单对本已进 Formal 的第一包重构批做了**去弱 / 去重**：
 * - `PN-TRUTH-277`（散场后你打算怎么回）——内容弱，几乎无吸引 / 人物信息 / 后续玩法价值；
 * - `PN-TRUTH-263`（快散场了，你会留下来把最想聊的人聊完，还是先走）——与 `PN-TRUTH-278`
 *   玩家感受层高度接近（同为「散场时走 / 留 / 等某个人」），保留更短更直接的 278；
 * - `PN-TRUTH-236`（刚认识时，你更看对方的谈吐还是打扮）——与 `PN-TRUTH-235` 同轴（第一印象 /
 *   外在 vs 气质谈吐 / binary / H2 attraction），Golden 批次不应用两个样板位展示相近轴。
 * 这 3 张**已移出运行时内容源**（`golden12/golden-12-cards.ts` / `pack1-replaces/pack1-replace-cards.ts` /
 * `pack1-supplements/pack1-supplement-cards.ts`）——若继续留在卡源里，按「legacy 不受 Heat 硬过滤」
 * 口径它们照样会被抽到、照样计有效轮（A4a 已堵过的同一漏洞）。旧版本**不删除**：逐字归档在此，
 * 原独立审查结论与 payloadHash 指纹锁定保留。
 *
 * ## 硬约束（由 `tests/unit/retired-pack1-archive.test.ts` 复核）
 * - ⛔ **本文件不得被任何运行时路径 import**：`lib/**` 运行时模块、`app/**`、MC / 生产链脚本
 *   一律不许引用；合法消费者是测试、只读号段扫描脚本（`audit-card-id-space`）与审计/裁决脚本
 *   （`audit-bar-fit-human-review-extend` / `audit-pack1-a2-adjudication`，仅 import 退役 ID 常量
 *   作号段域与 note 文案）——以上均不属运行时路径，退役卡内容不进任何运行时。
 * - 每张卡的 `card` 字段是**原卡逐字快照**（含 planning-only 三字段 `category` / `followUpHook` /
 *   `expectedAnswerShape`，全部 metadata 原样保留），可用于复算退役前的 `payloadHash`。
 * - `payloadHash` = 退役前 `fixed-content-manifest.json` 里该卡的 `provenance.payloadHash`（逐字冻结）。
 * - `retiredAt` / `retireReason` / `adjudicationSource` / `reviewConclusionPointer` 为显式退役标注；
 *   原独立审查结论（退役前均为 PASS）逐字归档在
 *   `docs/qa/content-audit-v2/BAR-FIT-HUMAN-REVIEW.json` 的 `history` 数组里，本文件只放指针，
 *   不复制结论（禁止出现第二份可漂移的真源）。
 *
 * ## 与运行时内容源的关系
 * 本归档**不进** `mainlineSsotCards()` / `mainlineRuntimeCards()` / 质量侧车 / manifest 两轨
 * ——即不在任何会被抽到的地方。旧 350 题 SSOT 一字未动。
 */

import type { GoldenTruthCard } from "../golden12/golden-12-cards";

/** 退役日期（A9-R6 内容裁决同日，2026-09-29）。 */
export const RETIRED_PACK1_R6_AT = "2026-09-29";

/** 退役原因（逐字，不含推测）。 */
export const RETIRED_PACK1_R6_REASON =
  "A9-R6 内容裁决：277 内容弱（全批最弱，Q4 弱／Q5✗／Q6△）退出本轮 Formal；263 与 278 玩家感受层高度接近（同为散场走／留）保留 278、263 退出；236 与 235 同轴（第一印象／外在 vs 气质谈吐／binary／H2 attraction）Golden 样板位去重，236 退出。三张自 2026-09-29 起移出运行时内容源并退出 Formal，不再计有效轮。";

/** 裁决来源（工程侧证据）。 */
export const RETIRED_PACK1_R6_ADJUDICATION_SOURCE =
  "docs/qa/content-audit/PACK1-SKELETON-CLUSTER.md ＋ PACK1-A2-ADJUDICATION.md ＋ A9-R6 内容裁决派工单（§9/§10/§11）";

/** 单张退役卡：显式退役标注 + 原卡逐字快照（字段完整，含 planning-only 三字段）。 */
export interface RetiredPack1Card {
  /** 原卡 `cardId`（保留，便于指纹与历史追溯）。 */
  readonly cardId: string;
  /** 退役日期。 */
  readonly retiredAt: string;
  /** 退役原因（逐条对应裁决理由）。 */
  readonly retireReason: string;
  /** 裁决来源文件 / 派工单。 */
  readonly adjudicationSource: string;
  /** 原独立审查结论指针（不复制结论，只指向唯一真源）。 */
  readonly reviewConclusionPointer: string;
  /** 退役前该卡的独立审查结论（冻结原值，供交叉核对）。 */
  readonly reviewHistoryOutcome: "PASS";
  /** 退役前 `fixed-content-manifest.json` 的 `provenance.payloadHash`（逐字冻结）。 */
  readonly payloadHash: string;
  /** 原卡逐字快照（全部 metadata 原样保留，含 planning-only 三字段）。 */
  readonly card: GoldenTruthCard;
}

/**
 * A9-R6 逐卡退役理由（升序：236 / 263 / 277），与「原值 → 新值 → 依据」逐条对应。
 */
const REASON_236 =
  "与 PN-TRUTH-235 同轴（第一印象／外在 vs 气质谈吐／binary／H2 attraction）——Golden 批次的样板位不应展示两条相近轴；按裁决保留 235、236 退出（Golden 批次去重）。";
const REASON_263 =
  "与 PN-TRUTH-278 玩家感受层高度接近（同为「散场时走／留／等某个人」）——按裁决保留更短、更直接、点名暧昧对象的 278，263 退出（跨档邻接去重）。";
const REASON_277 =
  "内容本身不好玩：几乎没有吸引／暧昧／有趣人物信息／后续玩法价值（Product Reviewer 曾判 Q4 弱、Q5 ✗、Q6 △，全批最弱）——退出本轮 Formal；本单**不挂** `location-sensitive` 标签续命。";

/**
 * 3 张退役 Truth 卡（按 `cardId` 升序）。**只读历史**，见文件头硬约束。
 */
export const RETIRED_PACK1_R6_CARDS: readonly RetiredPack1Card[] = [
  {
    cardId: "PN-TRUTH-236",
    retiredAt: RETIRED_PACK1_R6_AT,
    retireReason: REASON_236,
    adjudicationSource: RETIRED_PACK1_R6_ADJUDICATION_SOURCE,
    reviewConclusionPointer:
      "docs/qa/content-audit-v2/BAR-FIT-HUMAN-REVIEW.json#history[cardId=PN-TRUTH-236]",
    reviewHistoryOutcome: "PASS",
    payloadHash: "a5ea6127ac2cf78540c9700b78d6ed8d4f08b44f04347046e95f24fd18e2c150",
    card: {
      schemaVersion: "2.3",
      cardId: "PN-TRUTH-236",
      gameType: "truth",
      number: 236,
      text: "刚认识时，你更看对方的谈吐还是打扮？",
      intensity: 2,
      heatMin: 2,
      heatMax: 3,
      relationStage: "know",
      targetMode: "choose-opposite-sex",
      responseMode: "public",
      interactionType: "preference",
      consentMode: "skip-anytime",
      matchRequired: false,
      boundaryTags: [],
      fallbackPolicy: "skip-card",
      signalEffects: [],
      postAction: "none",
      topic: "择偶偏好",
      barFit: "PASS",
      informationGain: "medium",
      informationGoal: "知道他一见面更先看对方的谈吐还是打扮",
      socialEnergy: "medium",
      relationshipProgression: "open",
      intimacyClass: "none",
      informationGoalType: "self_preference",
      secondaryTopics: ["生活方式"],
      category: "attraction",
      followUpHook: "attraction",
      expectedAnswerShape: "binary",
    },
  },
  {
    cardId: "PN-TRUTH-263",
    retiredAt: RETIRED_PACK1_R6_AT,
    retireReason: REASON_263,
    adjudicationSource: RETIRED_PACK1_R6_ADJUDICATION_SOURCE,
    reviewConclusionPointer:
      "docs/qa/content-audit-v2/BAR-FIT-HUMAN-REVIEW.json#history[cardId=PN-TRUTH-263]",
    reviewHistoryOutcome: "PASS",
    payloadHash: "32153747b6ae48af51abc84cf9bc88e2229625a141b5c553254c9b75aafb9f61",
    card: {
      schemaVersion: "2.3",
      cardId: "PN-TRUTH-263",
      gameType: "truth",
      number: 263,
      text: "快散场了，你会留下来把最想聊的人聊完，还是先走？",
      intensity: 2,
      heatMin: 2,
      heatMax: 3,
      relationStage: "know",
      targetMode: "choose-opposite-sex",
      responseMode: "public",
      interactionType: "disclosure",
      consentMode: "skip-anytime",
      matchRequired: false,
      boundaryTags: [],
      fallbackPolicy: "skip-card",
      signalEffects: [],
      postAction: "none",
      topic: "生活方式",
      barFit: "PASS",
      informationGain: "medium",
      informationGoal: "知道快散场时他会留下把最想聊的人聊完还是先走",
      socialEnergy: "medium",
      relationshipProgression: "open",
      intimacyClass: "none",
      informationGoalType: "self_preference",
      secondaryTopics: ["性格·习惯·小癖好"],
      category: "quick_know",
      followUpHook: "flirt_target",
      expectedAnswerShape: "binary",
    },
  },
  {
    cardId: "PN-TRUTH-277",
    retiredAt: RETIRED_PACK1_R6_AT,
    retireReason: REASON_277,
    adjudicationSource: RETIRED_PACK1_R6_ADJUDICATION_SOURCE,
    reviewConclusionPointer:
      "docs/qa/content-audit-v2/BAR-FIT-HUMAN-REVIEW.json#history[cardId=PN-TRUTH-277]",
    reviewHistoryOutcome: "PASS",
    payloadHash: "a869bda033faf6924143242e7c05d1d8372a973f84847216d14495f17732196e",
    card: {
      schemaVersion: "2.3",
      cardId: "PN-TRUTH-277",
      gameType: "truth",
      number: 277,
      text: "散场后你打算怎么回：打车、地铁，还是走路？",
      intensity: 1,
      heatMin: 2,
      heatMax: 4,
      relationStage: "know",
      targetMode: "choose-opposite-sex",
      responseMode: "public",
      interactionType: "disclosure",
      consentMode: "skip-anytime",
      matchRequired: false,
      boundaryTags: [],
      fallbackPolicy: "skip-card",
      signalEffects: [],
      postAction: "none",
      topic: "生活方式",
      barFit: "PASS",
      informationGain: "medium",
      informationGoal: "知道散场后他打算打车、地铁还是走路",
      socialEnergy: "medium",
      relationshipProgression: "open",
      intimacyClass: "none",
      informationGoalType: "self_preference",
      secondaryTopics: ["性格·习惯·小癖好"],
      category: "quick_know",
      followUpHook: "social_style",
      expectedAnswerShape: "ternary",
    },
  },
];

/** 3 张退役卡的 `cardId`（派生；供只做号段 / 占位扫描、不 import 卡体的调用方使用）。 */
export const RETIRED_PACK1_R6_CARD_IDS: readonly string[] = RETIRED_PACK1_R6_CARDS.map(
  (entry) => entry.cardId,
);
