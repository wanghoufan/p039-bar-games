/**
 * A4b｜Golden 12 —— 新酒吧真心话样板卡（`PN-TRUTH-232 ~ 243` 号段，新 ID，内部风格基准）。
 *
 * ## A9-R6 去重（2026-09-29 内容裁决）
 * 原 12 张中的 `PN-TRUTH-236`（第一印象 / 谈吐 vs 打扮）与 `PN-TRUTH-235` 同轴，
 * 样板位不应展示两条相近轴 ⇒ **236 退役**、逐字归档在
 * `lib/v2-content/archive/retired-pack1-r6-2026-09-29.ts`（不再回运行时卡源）。
 * 故本批现为 **11 张**（号段 232~243 内缺 236）；模块名与号段标识保留（历史批次身份），
 * 张数一律由 `GOLDEN_12_CARDS.length` 派生，⛔ 不得写死 11/12。
 *
 * ## 这是什么、不是什么
 * - **是** Human 冻结的「酒吧新内容基线」的**内部风格闸样板**：给后续 Builder / Reviewer 一个
 *   「合格长什么样」的锚点（`≤25~30 中文字`、一口气念完、一题一个核心、最多两小句、优先
 *   `binary/ternary/one_word/short_phrase`、不把「说说为什么……」当默认句式）。
 * - **不是** Formal 库存、不是配额凑数：本批**先不进 Formal**（等 Product Reviewer 内部闸判通过后
 *   才谈 admission）。⛔ 不得为了「能抽到」压低 `heatMin` 或拉高 `intensity`。
 *
 * ## 与运行时 / 正式 schema 的关系（**为什么本轮不改 Runtime Schema**）
 * 本文件**只新增一个 planning-only 内容模块**，一个字节都不碰：
 * - `lib/v2-content/v2-types.ts`（SSOT 形状 18 字段）与 `lib/domain/schemas.ts`（`GameCard` 冻结 schema）；
 * - `lib/v2-content/v2-card-metadata.ts`（Plan §3 质量字段枚举 / `V2_REQUIRED_QUALITY_FIELDS`）；
 * - `lib/v2-content/v2-card-bridge.ts`（内容 → `GameCard` 的唯一桥接出口）。
 *
 * 理由（不改 schema 才是对的）：
 * 1. **契约边界**：`category` / `followUpHook` / `expectedAnswerShape` 是**设计期分类**，不是
 *    运行期出卡 / 判定所需的字段。运行时只消费「题面 + Heat + intensity + consent + 质量档」
 *    （`isEffectiveInformationRound` 只看 `informationGain` / `topic`）。把设计字段塞进 `GameCard`
 *    或 SSOT schema 会污染冻结契约、波及既有 390 张卡的校验与快照 hash（本批硬约束：SSOT 零改动）。
 * 2. **单点接线**：本模块的卡**形状 = `FormalTruthCard` 超集**，admission 通过后只需在
 *    `mainlineSsotCards()` / `mainlineRuntimeCards()` 的末尾 **spread 一行**即可接上管线
 *    （与 KEEP 5 完全同形），无需任何 schema 迁移。
 * 3. **planning-only 锁**：`tests/unit/golden-12.test.ts` 断言这三个字段不进 `GameCard` /
 *    `V2_REQUIRED_QUALITY_FIELDS` / 桥接转发清单，防止将来有人「顺手」把它们升成正式字段。
 *
 * ## 安全与 consent（硬红线）
 * - 全部卡 `consentMode="skip-anytime"`（不愿意可无惩罚跳过）；涉及**身体 / 亲密偏好**的卡
 *   （`category="body_preference"`）额外在卡面注释写明「**偏好 ≠ 授权，后续动作需独立同意**」。
 * - 不露骨、不强迫、不盘问性经历、不把「偏好」写成「接触授权」。
 *
 * ## ID
 * 号段 `PN-TRUTH-232~243` 由 `scripts/audit-card-id-space.ts` 复算得出（全库最大 = 归档里的 231，
 * 安全新号段起点 = 232）；**禁止自己猜号段**。
 */

import type { FormalTruthCard } from "../formal-truth-pack";
import { V2_SSOT_SCHEMA_VERSION } from "../v2-types";

/* -------------------------------------------------------------------------- */
/* planning-only 枚举（本轮只作设计 / 审计字段，不进 Runtime / GameCard schema）  */
/* -------------------------------------------------------------------------- */

/** 设计分类：五类酒吧重点（与 Human 冻结的「主线重点五类」一一对应）。 */
export const GOLDEN_CATEGORIES = [
  "quick_know", // ①快速认识
  "attraction", // ②吸引偏好
  "flirt", // ③暧昧 / 现场化学反应
  "body_preference", // ④亲密 / 身体偏好
  "follow_up_hook", // ⑤后续玩法钩子
] as const;

/** 后续互动钩子类型（planning-only；**≠ 身体接触授权**）。 */
export const GOLDEN_FOLLOW_UP_HOOKS = [
  "none",
  "attraction",
  "initiative",
  "eye_contact",
  "body_preference",
  "contact_preference",
  "flirt_target",
  "social_style",
] as const;

/** 预期答案形状（优先封闭 / 半封闭；不鼓励「说说为什么」式长开放）。 */
export const GOLDEN_ANSWER_SHAPES = [
  "yes_no",
  "binary",
  "ternary",
  "one_word",
  "short_phrase",
] as const;

export type GoldenCategory = (typeof GOLDEN_CATEGORIES)[number];
export type GoldenFollowUpHook = (typeof GOLDEN_FOLLOW_UP_HOOKS)[number];
export type GoldenAnswerShape = (typeof GOLDEN_ANSWER_SHAPES)[number];

/**
 * Golden 卡的完整形状：`FormalTruthCard`（SSOT 18 字段 + Plan §3 质量字段）
 * **superset 三个 planning-only 字段**。因为它是超集，`GOLDEN_12_CARDS` 可**原样** spread 进
 * 桥接的卡源数组，接线上管线时不需要任何类型迁移。
 */
export interface GoldenTruthCard extends FormalTruthCard {
  /** 设计分类（planning-only）。 */
  category: GoldenCategory;
  /** 后续互动钩子（planning-only；**≠ 身体接触授权**）。 */
  followUpHook: GoldenFollowUpHook;
  /** 预期答案形状（planning-only）。 */
  expectedAnswerShape: GoldenAnswerShape;
}

/**
 * 涉及身体 / 亲密偏好时卡面必须写明的 consent 注释文案（偏好≠授权）。
 * 逐卡以行内注释落到对应卡上方；`tests/unit/golden-12.test.ts` 按出现次数核验，
 * 防止有人删掉注释而测试照绿。
 */
export const GOLDEN_BODY_INTIMACY_CONSENT_NOTE =
  "偏好 ≠ 授权：本卡只收集偏好，任何后续身体/亲密动作需独立同意（consentMode=skip-anytime 可随时跳过）。";

/** 冻结 SSOT schema 版本；与既有内容源同源（不新造版本号）。 */
const SCHEMA = V2_SSOT_SCHEMA_VERSION;

/**
 * Golden 卡（`PN-TRUTH-232 ~ 243` 号段，按 `cardId` 升序；A9-R6 起 236 已退役 ⇒ 现 11 张）。
 *
 * 结构（以 `heatMin` 为档）：原定 H1×3 / H2×3 / H3×3 / H4×3；`236`（H2）退役后 H2×2。
 * 若某档写不出真实题则少写并如实说明（本批档位分布由矩阵模块与报告派生）。
 */
export const GOLDEN_12_CARDS: readonly GoldenTruthCard[] = [
  /* ───────────────────────────── H1：轻破冰 / 快速了解 ───────────────────────────── */
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-232",
    gameType: "truth",
    number: 232,
    text: "今晚你更想认识新人，还是放松一下？",
    intensity: 1,
    heatMin: 1,
    heatMax: 3,
    relationStage: "notice",
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
    informationGoal: "知道他今晚来场子是想认识人还是只想放松",
    socialEnergy: "medium",
    relationshipProgression: "open",
    intimacyClass: "none",
    informationGoalType: "self_preference",
    secondaryTopics: ["性格·习惯·小癖好"],
    category: "quick_know",
    followUpHook: "social_style",
    expectedAnswerShape: "binary",
  },
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-233",
    gameType: "truth",
    number: 233,
    text: "微醺之后，你是看谁都顺眼，还是越来越挑？",
    intensity: 1,
    heatMin: 1,
    heatMax: 3,
    relationStage: "notice",
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
    informationGoal: "知道他微醺之后是看谁都顺眼还是越来越挑",
    socialEnergy: "low",
    relationshipProgression: "open",
    intimacyClass: "none",
    informationGoalType: "self_preference",
    secondaryTopics: ["性格·习惯·小癖好"],
    category: "quick_know",
    followUpHook: "attraction",
    expectedAnswerShape: "binary",
  },
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-234",
    gameType: "truth",
    number: 234,
    text: "你今晚是自己来的，还是被人拉来的？",
    intensity: 1,
    heatMin: 1,
    heatMax: 3,
    relationStage: "notice",
    targetMode: "choose-opposite-sex",
    responseMode: "public",
    interactionType: "disclosure",
    consentMode: "skip-anytime",
    matchRequired: false,
    boundaryTags: [],
    fallbackPolicy: "skip-card",
    signalEffects: [],
    postAction: "none",
    topic: "性格·习惯·小癖好",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道他今晚是自己来的还是被朋友拉来的",
    socialEnergy: "medium",
    relationshipProgression: "open",
    intimacyClass: "none",
    informationGoalType: "self_preference",
    secondaryTopics: ["生活方式"],
    category: "quick_know",
    followUpHook: "initiative",
    expectedAnswerShape: "binary",
  },

  /* ───────────────────── H2：吸引偏好 / 社交偏好 / 外貌气质 ───────────────────── */
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-235",
    gameType: "truth",
    number: 235,
    text: "第一眼更容易抓到你的是穿着还是气质？",
    intensity: 2,
    heatMin: 2,
    heatMax: 4,
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
    informationGoal: "知道他第一眼更容易被穿着还是气质打动",
    socialEnergy: "medium",
    relationshipProgression: "open",
    intimacyClass: "none",
    informationGoalType: "self_preference",
    secondaryTopics: ["性格·习惯·小癖好"],
    category: "attraction",
    followUpHook: "attraction",
    expectedAnswerShape: "binary",
  },
  // A9-R6（2026-09-29 内容裁决）：原 `PN-TRUTH-236`（刚认识时，你更看对方的谈吐还是打扮？）
  // 与 `PN-TRUTH-235` 同轴（第一印象 / 外在 vs 气质谈吐 / binary / H2 attraction）⇒ 退役，
  // 逐字归档在 `lib/v2-content/archive/retired-pack1-r6-2026-09-29.ts`，**不再回运行时卡源**。
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-237",
    gameType: "truth",
    number: 237,
    text: "你更容易被话多的人吸引，还是安静的人？",
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
    informationGoal: "知道他更容易被话多的人还是安静的人吸引",
    socialEnergy: "medium",
    relationshipProgression: "open",
    intimacyClass: "none",
    informationGoalType: "self_preference",
    secondaryTopics: ["性格·习惯·小癖好"],
    category: "attraction",
    followUpHook: "social_style",
    expectedAnswerShape: "binary",
  },

  /* ─────────────── H3：明显暧昧 / 对眼前人的即时反应（对视·搭话·联系方式） ─────────────── */
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-238",
    gameType: "truth",
    number: 238,
    text: "对方一直看你，你会回看还是装没看到？",
    intensity: 2,
    heatMin: 3,
    heatMax: 4,
    relationStage: "signal",
    targetMode: "choose-opposite-sex",
    responseMode: "public",
    interactionType: "expression",
    consentMode: "skip-anytime",
    matchRequired: false,
    boundaryTags: [],
    fallbackPolicy: "skip-card",
    signalEffects: [],
    postAction: "none",
    topic: "live_chemistry",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道对方注视他时他会回看还是回避",
    socialEnergy: "medium",
    relationshipProgression: "deepen",
    intimacyClass: "none",
    informationGoalType: "live_observation",
    secondaryTopics: ["择偶偏好"],
    category: "flirt",
    followUpHook: "eye_contact",
    expectedAnswerShape: "binary",
  },
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-239",
    gameType: "truth",
    number: 239,
    text: "今晚遇到有感觉的人，你会主动要联系方式吗？",
    intensity: 3,
    heatMin: 3,
    heatMax: 4,
    relationStage: "signal",
    targetMode: "choose-opposite-sex",
    responseMode: "public",
    interactionType: "expression",
    consentMode: "skip-anytime",
    matchRequired: false,
    // 题面真实谈「要联系方式」⇒ 命中精确开关 `social-account`（社交账号交换），
    // 按 Plan §3.1「题面真实命中才写」标注；本轮不进运行时，admission 后按用户开关过滤。
    boundaryTags: ["social-account"],
    fallbackPolicy: "skip-card",
    signalEffects: [],
    postAction: "none",
    topic: "live_chemistry",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道他对有感觉的人会不会当场主动要联系方式",
    socialEnergy: "high",
    relationshipProgression: "deepen",
    intimacyClass: "none",
    informationGoalType: "live_observation",
    secondaryTopics: ["择偶偏好"],
    category: "flirt",
    followUpHook: "contact_preference",
    expectedAnswerShape: "yes_no",
  },
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-240",
    gameType: "truth",
    number: 240,
    text: "有人主动坐你旁边，你是加分还是有压力？",
    intensity: 2,
    heatMin: 3,
    heatMax: 4,
    relationStage: "signal",
    targetMode: "choose-opposite-sex",
    responseMode: "public",
    interactionType: "expression",
    consentMode: "skip-anytime",
    matchRequired: false,
    boundaryTags: [],
    fallbackPolicy: "skip-card",
    signalEffects: [],
    postAction: "none",
    topic: "live_chemistry",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道有人主动坐到他旁边时他是加分还是有压力",
    socialEnergy: "high",
    relationshipProgression: "deepen",
    intimacyClass: "none",
    informationGoalType: "live_observation",
    secondaryTopics: ["恋爱观"],
    category: "flirt",
    followUpHook: "flirt_target",
    expectedAnswerShape: "binary",
  },

  /* ─────────────────── H4：更大胆但仍简单（身体 / 亲密偏好） ─────────────────── */
  // A9-R7（2026-09-29 内容返工，按 RESEARCH_REVIEW-PACK1-FINAL-54 §1/§专项3 P1）：
  // 旧题面「你最常被人夸的是哪一点？」是轻量自我展示、无身体/亲密元素，却 heatMin=4（全池唯一
  // `quick_know` H4）⇒ Heat 错配。按编排者裁决**改题面注入亲密/暧昧元素、保留 H4 定档**
  // （不降档：241 是 Golden H4 三张之一），category 由 `quick_know` 如实改 `body_preference`。
  // 题面真实只问**偏好**（距离偏好），不要求任何身体接触 ⇒ boundaryTags 仍为空、不挂 exact
  // `physical-contact`；consentMode=skip-anytime 不变。
  // 偏好 ≠ 授权：本卡只收集偏好，任何后续身体/亲密动作需独立同意（consentMode=skip-anytime 可随时跳过）。
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-241",
    gameType: "truth",
    number: 241,
    text: "跟喜欢的人独处，你是越靠越近，还是越坐越远？",
    intensity: 3,
    heatMin: 4,
    heatMax: 4,
    relationStage: "flirt",
    targetMode: "choose-opposite-sex",
    responseMode: "public",
    interactionType: "preference",
    consentMode: "skip-anytime",
    matchRequired: false,
    boundaryTags: [],
    fallbackPolicy: "skip-card",
    signalEffects: [],
    postAction: "none",
    // A9-R7：六字段随新题面同源换（category/hook/shape/topic/intimacyClass/socialEnergy）。
    topic: "亲密边界",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道他跟喜欢的人独处时是越靠越近还是越坐越远",
    socialEnergy: "medium",
    relationshipProgression: "deepen",
    intimacyClass: "attitude",
    informationGoalType: "self_preference",
    secondaryTopics: ["性观念·亲密态度"],
    category: "body_preference",
    followUpHook: "body_preference",
    expectedAnswerShape: "binary",
  },
  // 偏好 ≠ 授权：本卡只收集偏好，任何后续身体/亲密动作需独立同意（consentMode=skip-anytime 可随时跳过）。
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-242",
    gameType: "truth",
    number: 242,
    text: "第一眼，你最容易注意异性的哪里？",
    intensity: 3,
    heatMin: 4,
    heatMax: 4,
    relationStage: "flirt",
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
    informationGoal: "知道他第一眼最容易注意异性身体的哪个部位",
    socialEnergy: "high",
    relationshipProgression: "deepen",
    intimacyClass: "none",
    informationGoalType: "self_preference",
    secondaryTopics: ["性观念·亲密态度"],
    category: "body_preference",
    followUpHook: "body_preference",
    expectedAnswerShape: "one_word",
  },
  // 偏好 ≠ 授权：本卡只收集偏好，任何后续身体/亲密动作需独立同意（consentMode=skip-anytime 可随时跳过）。
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-243",
    gameType: "truth",
    number: 243,
    text: "对有感觉的人，拥抱还是牵手更让你心动？",
    intensity: 3,
    heatMin: 4,
    heatMax: 4,
    relationStage: "flirt",
    targetMode: "choose-opposite-sex",
    responseMode: "public",
    interactionType: "preference",
    consentMode: "skip-anytime",
    matchRequired: false,
    boundaryTags: [],
    fallbackPolicy: "skip-card",
    signalEffects: [],
    postAction: "none",
    topic: "亲密边界",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道对喜欢的人他更容易被拥抱还是牵手打动",
    socialEnergy: "medium",
    relationshipProgression: "deepen",
    intimacyClass: "attitude",
    informationGoalType: "self_preference",
    secondaryTopics: ["性观念·亲密态度"],
    category: "body_preference",
    followUpHook: "contact_preference",
    expectedAnswerShape: "binary",
  },
];

/** 卡 ID 列表（升序，派生自卡源，不手写）。 */
export const GOLDEN_12_CARD_IDS: readonly string[] = GOLDEN_12_CARDS.map((card) => card.cardId);

/** 涉及身体 / 亲密偏好（`category="body_preference"`）的卡 ID（派生；consent 断言据此收敛）。 */
export const GOLDEN_BODY_INTIMACY_CARD_IDS: readonly string[] = GOLDEN_12_CARDS.filter(
  (card) => card.category === "body_preference",
).map((card) => card.cardId);
