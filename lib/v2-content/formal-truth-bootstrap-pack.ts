/**
 * CONTENT-01｜Truth H1 Bootstrap「第一包 H1 补卡」内容源（**R2 新增；R3 已过两轮独立审查 ⇒ 曾是 Formal；
 * A4a 后只保留 KEEP 2 张**）。
 *
 * ## 现状（A4a 之后：只保留 KEEP 2）
 * 本文件导出 `FORMAL_TRUTH_BOOTSTRAP_CARDS`（**2 张** `PN-TRUTH-227 / 229`）。原始 7 张
 * （`225 226 227 228 229 230 231`）里，227 / 229 是 Human 2026-09-29 酒吧新内容基线审计的 KEEP；
 * 其余 5 张（225 226 228 230 231，全判 REWRITE）已**移出运行时内容源**，逐字归档在
 * `lib/v2-content/archive/retired-truth-pack-2026-09-29.ts`（含 7 张 REWRITE 中的第一包 2 张）。
 * ⛔ 退役卡不得留在卡源（否则按 legacy 豁免口径仍会被抽到、计有效轮，违反 Human 新基线）。
 *
 * ## 为什么要有这个包（Human 已冻结的问题定义）
 * 第一包 Heat 诚实重标后，`heatMin=1` 的 Formal 卡太少，而 H2 门槛是 `effective>=4`：
 * - 重标当时只有 3 张（201/202/203）⇒ 即便 Engine 每轮都给合法 disclosure，Truth 单玩法
 *   也只能完成 3 个有效信息轮，**卡在 H1 进不了 H2**（`FORMAL-TRUTH-PRODUCTION-CHAIN.json` 实测）；
 * - 修法是**补真正 H1 的浅关系高信息题，不是把深题压回 `heatMin=1`**。
 *
 * ## 本包与第一包的边界（**不要混为一谈**）
 * - 本包原始 7 张 R3 已过两轮独立审查（第一轮 PASS 4 / BORDERLINE 3 → 按建议重写 3 张 → 复判 PASS 7，
 *   报告见 `temp/REVIEW-BOOTSTRAP-7.md` 与 `temp/REVIEW-BOOTSTRAP-7-RECHECK.md`），结论已如实回填
 *   ⇒ 本包原有 7 张**曾是 Formal**；A4a 后仅 227/229 保持 Formal（其余 5 张退役）。
 * - 本包仍只随桥接进入卡源；准入与否**由 manifest 独立审查输入决定**，不在这里写死。
 * - ⛔ 不得把本包卡写进 `formal-truth-pack.ts`，也不得为了「能进 Formal」伪造审查输入。
 * - ⛔ 不得把 `PN-TRUTH-201~224` 里任何深题降级到 `heatMin=1` 来凑 H1 库存。
 *
 * ## 逐条硬规格
 * 1. **`heatMin` 一律 = 1**（真 H1：刚认识就能问），`heatMax` **逐卡诚实**：
 *    破冰题到 H4 已太浅的不许硬拉 4；保留的 227 / 229 的 `heatMax` 均为 3。
 * 2. **不是全 I1**：现有 3 张 H1 Formal 全为 I1，在建堆里容易被 legacy 高强度卡压住；
 *    本包做出 `H1+I2` 的「浅关系但更有现场能量」卡（227 I2 / 229 I2）。
 *    ⛔ 不为曝光做不自然的 I4/I5。
 * 3. **题材只取浅关系**：兴趣爱好 / 生活方式 / 性格·习惯·小癖好 / 相处规则。
 *    ⛔ 不碰前任、吃醋、性/亲密、深层边界、关系创伤、强价值观审问。
 *    （`live_chemistry` 是**现场化学反应缓冲维度**、按 Plan §4 不算人物认知维度，
 *    故本包人物信息卡一律不用它作 `topic`；`PN-TRUTH-227` 已由 reviewer 判为 `兴趣爱好`。）
 * 4. **8 项必填质量字段逐卡齐全**（`V2_REQUIRED_QUALITY_FIELDS`，真源 `v2-card-metadata.ts`）
 *    ＋逐卡 `secondaryTopics`；`barFit` 恒 `"PASS"`。
 * 5. **ID**：沿用 `PN-TRUTH-*` 族，保留 `227 / 229`，与既有 `PN-TRUTH-001~050` /
 *    `PN-TRUTH-201~224` 及全库 390 张**无碰撞**（自检脚本逐条核验）。
 *
 * 真源引用（只读，本文件不改任何真源）：
 * - `lib/v2-content/v2-card-metadata.ts`（Plan §3 质量字段枚举）
 * - `lib/v2-content/formal-truth-pack.ts`（`FormalTruthCard` 形状；本包**只复用类型**，不共用内容）
 * - `lib/v2-content/v2-types.ts`（SSOT 形状 18 字段）
 */

import type { FormalTruthCard } from "./formal-truth-pack";
import { V2_SSOT_SCHEMA_VERSION } from "./v2-types";

/** 冻结 SSOT schema 版本；与第一包同源（不新造版本号）。 */
const SCHEMA = V2_SSOT_SCHEMA_VERSION;

/**
 * Truth H1 Bootstrap 卡（**保留 KEEP 2 张**，`PN-TRUTH-227 / 229`；见文件头）。
 *
 * 排序：按 `cardId` 升序。桥接侧**只能追加在第一包之后**（不得前置/重排，
 * 否则既有取 `[0]` 的测试与 E2E 会漂移）。
 */
export const FORMAL_TRUTH_BOOTSTRAP_CARDS: readonly FormalTruthCard[] = [
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-227",
    gameType: "truth",
    number: 227,
    text: "说一样你最近反复安利给朋友的东西，再用一句话说服我们。",
    intensity: 2,
    heatMin: 1,
    heatMax: 3,
    relationStage: "notice",
    targetMode: "system-opposite-sex",
    responseMode: "public",
    interactionType: "disclosure",
    consentMode: "skip-anytime",
    matchRequired: false,
    boundaryTags: [],
    fallbackPolicy: "skip-card",
    signalEffects: [],
    postAction: "none",
    topic: "兴趣爱好",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "听到他最近真心安利的一件东西，以及他为什么觉得值得一试",
    socialEnergy: "high",
    relationshipProgression: "open",
    intimacyClass: "none",
    informationGoalType: "self_preference",
    // reviewer 判 `topic` 应为 `兴趣爱好`（现场化学反应不算人物维度）；原 `secondaryTopics=["兴趣爱好"]`
    // 因此升为主主题，避免主/次重复，次主题置空。
    secondaryTopics: [],
  },
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-229",
    gameType: "truth",
    number: 229,
    text: "哪一类电影或音乐你怎样都提不起兴趣？说说你试过的那次。",
    intensity: 2,
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
    topic: "兴趣爱好",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道他明确提不起兴趣的是哪一类内容，以及他试过之后为什么不感冒",
    socialEnergy: "medium",
    relationshipProgression: "open",
    intimacyClass: "none",
    informationGoalType: "self_preference",
    secondaryTopics: ["生活方式"],
  },
];
