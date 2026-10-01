/**
 * CONTENT-01｜第一包「Formal Fixed 真心话」正式内容源（C1-2 产出；**已接入生产链路，非「零引用」**）。
 *
 * ## 现状（A4a 之后：只保留 KEEP 3）
 * 本文件导出 `FORMAL_TRUTH_CARDS`（**3 张** `PN-TRUTH-203 / 205 / 209`），当前被以下位置 import：
 * - `lib/v2-content/v2-card-bridge.ts`（C1-3 桥接）：`mainlineSsotCards()` 在既有 350 张**之后
 *   追加**本包，`mainlineRuntimeCards()` / `mainlineCardMetaById()` 共用同一份卡源；
 * - `lib/v2-content/v2-card-quality-index.ts`（C1-4 质量侧车）；
 * - `lib/v2-content/archive/retired-truth-pack-2026-09-29.ts`（**只引用本文件的 `FormalTruthCard`
 *   类型**，不引用内容——退役卡逐字归档在那里；归档不得被运行时 import）；
 * - `scripts/audit-bar-fit-human-review-skeleton.ts` / `scripts/audit-formal-truth-selfcheck.ts`（C1-6）；
 * - `tests/unit/*`（formal-truth-pipeline / fixed-content-manifest / v2-b7-content-switch 等）。
 * 经构建期准入（`pnpm build:fixed-manifest`）后进入 `tracks.formalFixed`；当前值见产物。
 *
 * ## A4a 退役说明（2026-09-29，Human 冻结的酒吧新内容基线）
 * 第一包原始 24 张 `PN-TRUTH-201~224` 经逐卡审计（`temp/BAR-AUDIT-PACK1-31.md`）为
 * KEEP 5 / REWRITE 7 / REPLACE 19 中的一部分；本包 24 张里 **只有 203 / 205 / 209 是 KEEP**，
 * 其余 21 张（7 REWRITE + 14 REPLACE 属于本包）已**移出运行时内容源**，逐字归档在
 * `lib/v2-content/archive/retired-truth-pack-2026-09-29.ts`。
 * ⛔ 退役卡不得留在卡源（否则按 legacy 豁免口径仍会被抽到、计有效轮，违反 Human 新基线）；
 * ⛔ 本包不再新增题面（Golden 12 / REPLACE 批次走新 ID，另单）；⛔ 不得「改个词继续留在正式池」。
 *
 * ## C1-2 当时范围说明（历史注记，非现状）
 * 本单只产出**内容**：一批带完整 Plan §3 质量字段的真心话卡（`PN-TRUTH-2xx`）。当时本文件
 * **不被任何文件 import**——桥接（C1-3）、质量侧车（C1-4）、人审输入（C1-5）、审查脚本（C1-6）、
 * 单包 Monte Carlo（C1-7）都是后续单，落地后本源才真正生效；故当时业务行为变化为 **0**，
 * 既有 390 张卡与冻结 SSOT 零改动（至今 SSOT 仍零改动）。
 *
 * ## 为什么另起内容源，而不是改既有 390 卡（C1-1 设计稿 §2.2/§9 的结论）
 * - 冻结 SSOT（`generated/v2-ssot.generated.json`，两个硬编码 SHA256）是唯一真源，不得就地改；
 * - 生产 Heat 恒 H1（disclosure 通道未落地 ⇒ 有效轮恒 0），**任何 `heatMin≥2` 的 Formal 卡
 *   在运行时都抽不到**。若把既有 `PN-TRUTH-*` 改判 Formal，等于把那批卡从可玩库存里删掉，
 *   会重演刚修好的「H1 桶耗尽 / PACK_EXHAUSTED」。
 * - 故第一包走「**新 ID + 独立正式内容源**」，既有 390 卡一张不动。
 *
 * ## ID 约定
 * - 前缀沿用 `PN-TRUTH`（既有 pack / gameType 映射表 `V2_MAINLINE_PACK_BY_GAME_TYPE` 已认它）；
 * - 本包保留编号 `203 / 205 / 209`，与既有 `PN-TRUTH-001~050` **不重叠**，全库唯一性可机械核验；
 * - `number` 与 ID 末段同值，不与既有 1~50 冲突。
 *
 * ## 逐条硬规格（Human + C1-1 设计稿，实现时逐条对齐）
 * 1. **玩法**：`gameType="truth"` → pack `truth-dare`（真心话）。
 * 2. **`heatMin` / `heatMax` 按卡的真实关系深度诚实标注**（Human 2026-09-28 冻结）：`Heat` =
 *    关系聊到多深、`Intensity` = 用户接受多大尺度，**两者正交** —— 不得用 `Intensity` 代替
 *    `Heat` 的推进作用，不得为库存好看压低 `heatMin`，也不得把 `heatMax` 统一拉 4。
 *    ⚠️ 生产 UI 未落地 disclosure ⇒ 运行时 Heat 恒 H1，故 `heatMin≥2` 的卡**当前抽不到**；
 *    这是 Human 已明确接受的正确结果，**不得**为了「能抽到」反向改标注。
 * 3. **`intensity` 覆盖 1~5**（原始 24 张设计；保留的 3 张为 I1/I1/I2）。
 * 4. **8 项必填质量字段逐卡齐全**（`V2_REQUIRED_QUALITY_FIELDS`，真源 `v2-card-metadata.ts`）：
 *    `topic` / `barFit` / `informationGain` / `informationGoal` / `socialEnergy` /
 *    `relationshipProgression` / `intimacyClass` / `informationGoalType`；另逐卡附
 *    `secondaryTopics`（可选字段，本包全体给出，不计主主题配额）。
 *    `barFit` 恒 `"PASS"`（Plan §3:52：正式快照只允许 PASS）。
 * 5. **题面口径**：全部是「今晚问得出口、对方答了就真的更了解他」的**本人自述**问题；
 *    不做现场评价、不做猜测、不写「你们觉得呢」式空话；不复述既有 350 题句式（见 C1-2 自检
 *    脚本 `scripts/audit-formal-truth-selfcheck.ts` 的重复/近似检查）。
 * 6. **内容安全**：不做露骨、不做强迫惩罚灌酒、不做隐私脱衣非自愿；I1~I3 不出现亲密/性内容，
 *    I4/I5 才触及亲密态度与边界，且全部 `consentMode="skip-anytime"`（卡面说明「不愿意可无惩罚跳过」）。
 *
 * ## boundaryTags 口径（Plan §3.1，逐题只看「题面真实命中哪个用户开关」）
 * Plan §3.1 明令：泛标签 `relationship-sensitive` **不自动等于** `ex-partner`，
 * 「只有题面真实命中精确开关才写对应过滤标签」；且 `V2_BOUNDARY_TAG_CATALOG` 之外的语义标签
 * （`jealousy-possessiveness` / `opposite-sex-friends` / `bottom-line` / `intimacy-attitude` 等，
 * 见 `V2_CONTENT_SEMANTIC_TAGS`）**不是用户开关**，不得写进 `boundaryTags`。
 * 保留的 3 张全部 `boundaryTags=[]`（无身体接触、无饮酒、无金额、无手机/相册、无拍摄、无陌生人、
 * 无账号交换、无前任相关；`ex-partner` 标签随退役卡 216/217 一并移入归档）。
 *
 * ⚠️ 给 C1-3（桥接）的交接要求：`SSOT_BOUNDARY_TAG_MAP` 目前只登记泛 5 项，遇到 `ex-partner`
 * 会 **fail closed 抛错**。C1-3 必须把 §3.1 的精确 10 项补进映射（与 App `BoundaryTag` 同名同义，
 * 1:1 直映），**且不得**把 `relationship-sensitive` 继续自动映到 `ex-partner`（Plan §3.1 明文禁止）。
 *
 * 真源引用（只读，本文件不改任何真源）：
 * - `lib/v2-content/v2-types.ts`（SSOT 形状 18 字段 + 硬编码 schemaVersion）
 * - `lib/v2-content/v2-card-metadata.ts`（Plan §3 质量字段枚举 + 精确雷区全集）
 */

import type {
  V2BoundaryTagName,
  V2InformationGain,
  V2InformationGoalType,
  V2IntimacyClass,
  V2RelationshipProgression,
  V2SocialEnergy,
  V2Topic,
} from "./v2-card-metadata";
import { V2_SSOT_SCHEMA_VERSION, type V13MainlineCard } from "./v2-types";

/**
 * 第一包正式固定卡的完整形状：SSOT 形状 18 字段（`V13MainlineCard`）+ Plan §3 质量字段。
 *
 * 与 `V13MainlineCard` 的差异是三处**按 Plan 收紧/放宽**（其余字段一律原样继承，不另造）：
 * - `gameType` 收窄为 `"truth"`（本源只产真心话）；
 * - `barFit` 收窄为 `"PASS"`（Plan §3:52：正式快照只允许 PASS）；
 * - `boundaryTags` 换成 `V2_BOUNDARY_TAG_CATALOG`（Plan §3 该行写的就是「§3.1 精确枚举」）：
 *   `V13MainlineCard.boundaryTags` 只登记既有 SSOT 的泛 5 项，装不下 §3.1 的精确标签
 *   （如 `ex-partner`）。这里是**放宽类型**而不是改真源——`v2-types.ts` 一个字未动。
 * 其余质量字段显式声明为**必填**（`V2CardQualityMetadata` 里它们是可选的，旧卡可缺）；
 * `secondaryTopics` 虽为可选字段，本包逐卡给出，故在此也声明为必填（允许空数组）。
 */
export interface FormalTruthCard
  extends Omit<V13MainlineCard, "gameType" | "boundaryTags"> {
  gameType: "truth";
  /** Plan §3.1 精确雷区标签（全集 `V2_BOUNDARY_TAG_CATALOG`，未知 tag 须拒收）。 */
  boundaryTags: readonly V2BoundaryTagName[];
  /** 主主题（Plan §3:48：§4 的 13 个人物主题之一，或 `live_chemistry`；单一主主题）。 */
  topic: V2Topic;
  /** 酒吧适配正式定档；正式入库只允许 `PASS`（Plan §3:52）。 */
  barFit: "PASS";
  /** 信息增量（Plan §3:53）：本人作答后能复述「谁的什么」的档位。 */
  informationGain: V2InformationGain;
  /** Plan §3:54 一句可复述的目标陈述；禁止泛化「促进了解」。 */
  informationGoal: string;
  /** 现场社交能量（Plan §3:55）：评价/投票/指认带来的现场反应强度，与信息量分开计。 */
  socialEnergy: V2SocialEnergy;
  /** 关系推进（Plan §3:56）：none/open/deepen/clarify_boundary。 */
  relationshipProgression: V2RelationshipProgression;
  /** 亲密类别（Plan §3:57，三值互斥）。本包全是态度/自述题，故只出现 `none` / `attitude`。 */
  intimacyClass: V2IntimacyClass;
  /** 信息目标类型（Plan §3:58，主目标只取一个）。 */
  informationGoalType: V2InformationGoalType;
  /** Plan §3:60 可选次主题数组；本包逐卡给出，不计主主题配额。 */
  secondaryTopics: readonly V2Topic[];
}

/** 冻结 SSOT schema 版本；本源同步沿用（不新造版本号）。 */
const SCHEMA = V2_SSOT_SCHEMA_VERSION;

/**
 * 第一包真心话正式固定卡（**保留 KEEP 3 张**，`PN-TRUTH-203 / 205 / 209`；
 * Heat 按真实关系深度标注，见文件头规格 2）。
 *
 * 排序：按 `cardId` 升序（203 → 205 → 209）。桥接侧若追加进 `mainlineSsotCards()`，
 * **只能追加在末尾**（不得前置/重排，否则既有取 `[0]` 的测试与 E2E 会漂移）。
 */
export const FORMAL_TRUTH_CARDS: readonly FormalTruthCard[] = [
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-203",
    gameType: "truth",
    number: 203,
    // A9-R7（2026-09-29 内容返工，按 RESEARCH_REVIEW-PACK1-FINAL-54 §1 P1）：
    // 旧题面「下班或放学到睡前，你一个人最固定的一段安排是什么？」是开放回忆题，
    // 理解＋组织答案超 10 秒、现场无即时反应，且「安排」偏书面 ⇒ 改成**封闭二选一**，
    // 保 H1 轻量破冰定位（heat/intensity/relationStage 一律不动）。
    text: "睡前的最后半小时，你是刷手机，还是直接躺平？",
    intensity: 1,
    heatMin: 1,
    heatMax: 3,
    relationStage: "continue",
    targetMode: "choose-opposite-sex",
    responseMode: "public",
    interactionType: "disclosure",
    consentMode: "skip-anytime",
    matchRequired: false,
    boundaryTags: [],
    fallbackPolicy: "skip-card",
    signalEffects: ["personal"],
    postAction: "none",
    topic: "生活方式",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道他睡前的最后半小时一般是刷手机还是直接躺平",
    socialEnergy: "low",
    relationshipProgression: "open",
    intimacyClass: "none",
    informationGoalType: "self_preference",
    secondaryTopics: ["性格·习惯·小癖好"],
  },
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-205",
    gameType: "truth",
    number: 205,
    text: "说一个小习惯，是熟人相处久了才会发现的。",
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
    informationGoal: "拿到一个只有熟人相处久了才会知道的生活小习惯",
    socialEnergy: "low",
    relationshipProgression: "open",
    intimacyClass: "none",
    informationGoalType: "self_preference",
    secondaryTopics: ["生活方式"],
  },
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-209",
    gameType: "truth",
    number: 209,
    text: "你会被哪种人吸引？说一个具体行为，别只给形容词。",
    intensity: 2,
    heatMin: 2,
    heatMax: 4,
    relationStage: "know",
    targetMode: "choose-opposite-sex",
    responseMode: "public",
    interactionType: "expression",
    consentMode: "skip-anytime",
    matchRequired: false,
    boundaryTags: [],
    fallbackPolicy: "skip-card",
    signalEffects: [],
    postAction: "none",
    topic: "择偶偏好",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "把择偶标准落成一个别人看得见的具体行为",
    socialEnergy: "low",
    relationshipProgression: "open",
    intimacyClass: "none",
    informationGoalType: "self_preference",
    secondaryTopics: ["恋爱观"],
  },
];
