/**
 * A9-R7｜内容返工退役 Truth 卡归档（**只读历史，不参与任何运行时**）。
 *
 * ## 为什么存在
 * A9-R7（2026-09-29 内容返工）按 Product Reviewer 对裁决后终池（Formal 54）的独立重审报告
 * `docs/review/RESEARCH_REVIEW-PACK1-FINAL-54.md` 逐张返工 6 张 BORDERLINE。其中
 * `PN-TRUTH-249`（`你这周哪天最像在放假：工作日的晚上、周六，还是周一？`）被判：
 * - 与 `PN-TRUTH-250` **同轴**（本周状态 / 今晚怎么安排）；
 * - 趣味 / 吸引 / 后续钩子**三弱**（八维表 ④ ✗ / ⑥ ✗）；
 * - 审查改法明确写「与 250 二选一（留 250）」。
 *
 * 编排者裁决：**249 退出 Formal 并逐字归档**（⛔ 不许改写保留）。该卡若只退出 Formal 而仍留在
 * 运行时卡源，按「legacy 不受 Heat 硬过滤」口径照样会被抽到、照样计有效轮（A4a 已堵过的同一漏洞）
 * ⇒ 必须**移出运行时内容源**。
 * 旧版本**不删除**：逐字归档在此，原独立审查结论与 payloadHash 指纹锁定保留。
 *
 * ## 硬约束（由 `tests/unit/retired-pack1-r7-archive.test.ts` 复核）
 * - ⛔ **本文件不得被任何运行时路径 import**：`lib/**` 运行时模块、`app/**`、MC / 生产链脚本
 *   一律不许引用；合法消费者是测试、只读号段扫描脚本（`audit-card-id-space`）与审计/裁决脚本
 *   （`audit-bar-fit-human-review-extend` / `audit-pack1-a2-adjudication`，仅 import 退役 ID 常量
 *   作号段域与 note 文案）——以上均不属运行时路径，退役卡内容不进任何运行时。
 * - 每张卡的 `card` 字段是**原卡逐字快照**（含 planning-only 三字段 `category` / `followUpHook` /
 *   `expectedAnswerShape`，全部 metadata 原样保留），可用于复算退役前的 `payloadHash`。
 * - `payloadHash` = 退役前 `fixed-content-manifest.json` 里该卡的 `provenance.payloadHash`（逐字冻结）。
 * - `retiredAt` / `retireReason` / `adjudicationSource` / `reviewConclusionPointer` 为显式退役标注；
 *   原独立审查结论（退役前为 PASS）逐字归档在
 *   `docs/qa/content-audit-v2/BAR-FIT-HUMAN-REVIEW.json` 的 `history` 数组里，本文件只放指针，
 *   不复制结论（禁止出现第二份可漂移的真源）。
 *
 * ## 与运行时内容源的关系
 * 本归档**不进** `mainlineSsotCards()` / `mainlineRuntimeCards()` / 质量侧车 / manifest 两轨
 * ——即不在任何会被抽到的地方。旧 350 题 SSOT 一字未动。
 */

import type { RetiredPack1Card } from "./retired-pack1-r6-2026-09-29";

/** 退役日期（A9-R7 内容返工同日，2026-09-29）。 */
export const RETIRED_PACK1_R7_AT = "2026-09-29";

/** 退役原因（逐字，不含推测）。 */
export const RETIRED_PACK1_R7_REASON =
  "A9-R7 内容返工（RESEARCH_REVIEW-PACK1-FINAL-54 §1 / §专项1）：249 与 250 同轴（本周状态），且趣味／吸引／后续钩子三弱（八维 ④ ✗ / ⑥ ✗）；审查改法为「与 250 二选一，留 250」，编排者裁决 249 退出 Formal 并逐字归档、移出运行时内容源，不再计有效轮。";

/** 裁决来源（工程侧证据）。 */
export const RETIRED_PACK1_R7_ADJUDICATION_SOURCE =
  "docs/review/RESEARCH_REVIEW-PACK1-FINAL-54.md §1（逐卡八维表 249 行）＋ §专项1（三张退判复核）＋ A9-R7 内容返工派工单 §3/§4.1";

/**
 * A9-R7 逐卡退役（现 1 张：249）。
 * ⚠️ 复用 R6 的 `RetiredPack1Card` 形状（同一套「显式退役标注 ＋ 原卡逐字快照」契约），
 * 不另造第二份可漂移的接口。
 */
export const RETIRED_PACK1_R7_CARDS: readonly RetiredPack1Card[] = [
  {
    cardId: "PN-TRUTH-249",
    retiredAt: RETIRED_PACK1_R7_AT,
    retireReason:
      "与 PN-TRUTH-250 同轴（本周状态；250「这一周攒的劲，你打算今晚一次放完，还是留着明天再放？」已保留）；249 自身趣味／吸引／钩子三弱。按裁决退出本轮 Formal、逐字归档并移出运行时内容源。",
    adjudicationSource: RETIRED_PACK1_R7_ADJUDICATION_SOURCE,
    reviewConclusionPointer:
      "docs/qa/content-audit-v2/BAR-FIT-HUMAN-REVIEW.json#history[cardId=PN-TRUTH-249]",
    reviewHistoryOutcome: "PASS",
    payloadHash: "745964b93c1f700d4a97f1028b7f5df09d53e64f50afd570f33b93ae47ccae49",
    card: {
      schemaVersion: "2.3",
      cardId: "PN-TRUTH-249",
      gameType: "truth",
      number: 249,
      text: "你这周哪天最像在放假：工作日的晚上、周六，还是周一？",
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
      informationGoal: "知道他这周哪天最像在放假",
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

/** 退役卡的 `cardId`（派生；供只做号段 / 占位扫描、不 import 卡体的调用方使用）。 */
export const RETIRED_PACK1_R7_CARD_IDS: readonly string[] = RETIRED_PACK1_R7_CARDS.map(
  (entry) => entry.cardId,
);
