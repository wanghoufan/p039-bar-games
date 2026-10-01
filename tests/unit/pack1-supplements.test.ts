/**
 * A6｜第一包覆盖率补卡批（`lib/v2-content/pack1-supplements/`）的**机器门禁**。
 *
 * 锁死十一件事：
 * ① **逐卡值锁**：题面 / Heat / intensity / planning 字段 ＋全部既有必填质量字段逐卡锁死，改动即红；
 * ② **字数与句读**：题面 ≤30 个中文字（`pack1SupplementCountHanzi` 可复算）、单一问句、≤2 逗号；
 * ③ **结构**：`heatMin` 分布由卡源派生（H2×5 / H3×9、**H1/H4 = 0**）；**同档不同轴**；
 * ④ **钩子当场可兑现**：每卡一条「旁人立刻能说出口的反问」，以「？」结尾、无需要时间的动作；
 * ⑤ **去重**：本批现役 13 张互不重复（A9-R6 退役 277），且与 Golden / KEEP 5 / REWRITE（244~250）/ REPLACE（251~269）
 *    的题面**双向整句包含 0 命中**（去标点口径）；
 * ⑥ **ID 号段**：`PN-TRUTH-270~283` 号段（A9-R6 退役 277 后现 13 张）；全库扫描 0 collision、最大 283 / 新起点 284；
 * ⑦ **planning-only 锁**：`category / followUpHook / expectedAnswerShape` **未进入** `GameCard`
 *    正式 schema、`V2_REQUIRED_QUALITY_FIELDS`、桥接转发卡；本批**不进任何运行时卡池 / Formal 清单**；
 * ⑧ **consent**：全批 `skip-anytime`；本批无 `body_preference` 卡 ⇒ 卡面 0 条 consent 注释；
 * ⑨ **5 条强制约束**（`temp/GOLDEN12-REVIEW-2.md` §5.3）：①同档不同轴②无外观二元对照③钩子兑现
 *    ④H4 统一 I3（本批无 H4）⑤元数据随题面同源；
 * ⑩ **覆盖率按「卡面 `category` 真值」放行**：`pack1UnionCategoryTruthRequirementsMet()` 全绿，
 *    且**明确锁死**真值口径 ≠ 重叠口径（重叠口径报的是「带钩子的张数」，**禁止**用它通过）；
 *    另加「统计函数只按 `category` 计」「`category=follow_up_hook` 的卡必须点名对象或动作」两道护栏；
 * ⑪ **`followUpHook` 枚举分布单列统计**（8 值全集）+ 全批次 H1~H4 分布 + 强度不倒挂（无 I4/I5、H3 不配 I1）。
 *
 * **A7 修正（2026-09-29）**：本文件按编排者裁决 1（`follow_up_hook` 定义收紧、阈值 12→9）与
 * `temp/PACK1-ROUND2-REVIEW.md` 的 §F 字面量逐张更新；新增「同档不同镜头」「follow_up_hook 必须
 * 点名对象或动作」「只按 category 计」「H3 不配 I1」四道护栏。
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { gameCardSchema } from "@/lib/domain/schemas";
import { judgeBarFit } from "@/lib/v2-content/bar-fit";
import {
  GOLDEN_12_CARD_IDS,
  GOLDEN_12_CARDS,
} from "@/lib/v2-content/golden12/golden-12-cards";
import { PACK1_REWRITE_CARDS, PACK1_REWRITE_CARD_IDS } from "@/lib/v2-content/pack1-rewrites/pack1-rewrite-cards";
import { PACK1_REPLACE_CARDS, PACK1_REPLACE_CARD_IDS } from "@/lib/v2-content/pack1-replaces/pack1-replace-cards";
import {
  PACK1_SUPPLEMENT_BODY_INTIMACY_CARD_IDS,
  PACK1_SUPPLEMENT_CARDS,
  PACK1_SUPPLEMENT_CARD_IDS,
} from "@/lib/v2-content/pack1-supplements/pack1-supplement-cards";
import {
  PACK1_FOLLOW_UP_HOOK_TARGET_TOKENS,
  PACK1_SUPPLEMENT_AXES,
  PACK1_SUPPLEMENT_HOOK_REDEEM_LINES,
  PACK1_SUPPLEMENT_MATRIX,
  PACK1_SUPPLEMENT_SHOTS,
  PACK1_UNION_CATEGORY_REQUIREMENTS,
  PACK1_UNION_CARDS,
  pack1FollowUpHookCardsMissingTarget,
  pack1SupplementAnswerShapeDistribution,
  pack1SupplementAxesByHeatTier,
  pack1SupplementCategoryTruth,
  pack1SupplementCountHanzi,
  pack1SupplementFollowUpHookDistribution,
  pack1SupplementHeatMinDistribution,
  pack1SupplementIntensityDistribution,
  pack1SupplementMatrixMarkdown,
  pack1SupplementShotsByHeatTier,
  pack1UnionCategoryCoverageOverlap,
  pack1UnionCategoryCoverageOverlapByBatch,
  pack1UnionCategoryTruth,
  pack1UnionCategoryTruthRequirementsMet,
  pack1UnionFollowUpHookDistribution,
  pack1UnionHeatMinDistribution,
} from "@/lib/v2-content/pack1-supplements/pack1-supplement-matrix";
import { analyzeTruthIdSpace, parseTruthCardNumber } from "@/lib/v2-content/card-id-space";
import { getV2ContentAdapter } from "@/lib/v2-content/v2-content-adapter";
import { FIXED_CONTENT_MANIFEST } from "@/lib/v2-content/fixed-content-manifest";
import { FORMAL_TRUTH_BOOTSTRAP_CARDS } from "@/lib/v2-content/formal-truth-bootstrap-pack";
import { FORMAL_TRUTH_CARDS } from "@/lib/v2-content/formal-truth-pack";
import { RETIRED_TRUTH_CARD_IDS } from "@/lib/v2-content/archive/retired-truth-pack-2026-09-29";
import { RETIRED_PACK1_R6_CARD_IDS } from "@/lib/v2-content/archive/retired-pack1-r6-2026-09-29";
import { V2_REQUIRED_QUALITY_FIELDS, validateFixedCardMetadataStrict } from "@/lib/v2-content/v2-card-metadata";
import { mainlineRuntimeCards, mainlineSsotCards } from "@/lib/v2-content/v2-card-bridge";

const PLANNING_ONLY_FIELDS = ["category", "followUpHook", "expectedAnswerShape"] as const;

/** 既有 KEEP 5（内部风格闸对照集，本批不得与之语义重复）。 */
const KEEP_5_IDS = ["PN-TRUTH-203", "PN-TRUTH-205", "PN-TRUTH-209", "PN-TRUTH-227", "PN-TRUTH-229"] as const;

/** 去标点取纯汉字串：用于「换标点即绕过」的去重口径。 */
function stripNonHanzi(text: string): string {
  return text.replace(/[^\u4e00-\u9fff]/gu, "");
}

/* ------------------------------------------------------------------ */
/* ① 逐卡值锁                                                          */
/* ------------------------------------------------------------------ */

describe("A6① 补卡逐卡值锁死（A9-R6 后 13 张）", () => {
  const LOCKED: Record<
    string,
    {
      text: string;
      intensity: number;
      heatMin: number;
      heatMax: number;
      category: string;
      followUpHook: string;
      expectedAnswerShape: string;
      topic: string;
      informationGain: string;
      informationGoal: string;
      socialEnergy: string;
      relationshipProgression: string;
      intimacyClass: string;
      informationGoalType: string;
      secondaryTopics: readonly string[];
      consentMode: string;
      boundaryTags: readonly string[];
    }
  > = {
    "PN-TRUTH-270": {
      // A7（编排者裁决 1）：题面「再战一轮 / 趁没醉先撤」；category 如实降 quick_know。
      // A8（Part 1，主审 Round-3 §1/§3.2-E）：A7 版与 278 撞「去留」轴 ⇒ 换轴到饮品方式。
      text: "今晚你更想接着干杯，还是改喝点软的？",
      intensity: 1, heatMin: 2, heatMax: 4,
      category: "quick_know", followUpHook: "social_style", expectedAnswerShape: "binary",
      topic: "生活方式", informationGain: "medium",
      informationGoal: "知道他今晚更想接着干杯还是改喝点软的",
      socialEnergy: "medium", relationshipProgression: "open", intimacyClass: "none",
      informationGoalType: "self_preference", secondaryTopics: ["性格·习惯·小癖好"],
      consentMode: "skip-anytime", boundaryTags: [],
    },
    "PN-TRUTH-271": {
      // A7（编排者裁决 1）：场所口味是风格偏好 ⇒ category 如实降 quick_know（题面不变）。
      text: "今晚要是换个地方，你想去安静的，还是更吵的？",
      intensity: 1, heatMin: 2, heatMax: 4,
      category: "quick_know", followUpHook: "social_style", expectedAnswerShape: "binary",
      topic: "生活方式", informationGain: "medium",
      informationGoal: "知道换个地方时他更想去安静的还是更吵的",
      socialEnergy: "medium", relationshipProgression: "open", intimacyClass: "none",
      informationGoalType: "self_preference", secondaryTopics: ["择偶偏好"],
      consentMode: "skip-anytime", boundaryTags: [],
    },
    "PN-TRUTH-272": {
      // A7（Part 1 P0）：改点名两人（刚坐过来的那位 / 原本在聊的那位），轴换「下一轮续聊对象」。
      text: "下一轮你想接着聊的，是刚坐过来的那位，还是你原本就在聊的那位？",
      intensity: 1, heatMin: 2, heatMax: 3,
      category: "follow_up_hook", followUpHook: "flirt_target", expectedAnswerShape: "binary",
      topic: "live_chemistry", informationGain: "medium",
      informationGoal: "知道下一轮他想接着聊的是刚坐过来的那位还是原本就在聊的那位",
      socialEnergy: "medium", relationshipProgression: "open", intimacyClass: "none",
      informationGoalType: "live_observation", secondaryTopics: ["择偶偏好"],
      consentMode: "skip-anytime", boundaryTags: [],
    },
    "PN-TRUTH-273": {
      text: "这桌散了，你最想跟谁一起走？",
      intensity: 2, heatMin: 3, heatMax: 4,
      category: "follow_up_hook", followUpHook: "flirt_target", expectedAnswerShape: "short_phrase",
      topic: "live_chemistry", informationGain: "medium",
      informationGoal: "知道这桌散了他最想跟谁一起走",
      socialEnergy: "high", relationshipProgression: "deepen", intimacyClass: "none",
      informationGoalType: "live_observation", secondaryTopics: ["择偶偏好"],
      consentMode: "skip-anytime", boundaryTags: [],
    },
    "PN-TRUTH-274": {
      text: "要是分两组玩，你想跟谁一队？",
      intensity: 2, heatMin: 3, heatMax: 4,
      category: "follow_up_hook", followUpHook: "initiative", expectedAnswerShape: "short_phrase",
      topic: "live_chemistry", informationGain: "medium",
      informationGoal: "知道分两组玩时他想跟谁一队",
      socialEnergy: "high", relationshipProgression: "deepen", intimacyClass: "none",
      informationGoalType: "live_observation", secondaryTopics: ["择偶偏好"],
      consentMode: "skip-anytime", boundaryTags: [],
    },
    "PN-TRUTH-275": {
      // A7（Part 3 换题面）：换成玩法轴（跟谁玩一局狼人杀）。
      // A8（Part 1，主审 Round-3 §3.2-A）：A7 的「玩一局狼人杀」＝组队、与 274 仍同轴 ⇒
      // 动作帧换成 1v1 单挑（跟谁比一局飞镖），脱离与 274 的同签名。
      text: "下一轮你最想跟谁比一局飞镖？",
      intensity: 2, heatMin: 3, heatMax: 4,
      category: "follow_up_hook", followUpHook: "flirt_target", expectedAnswerShape: "short_phrase",
      topic: "live_chemistry", informationGain: "medium",
      informationGoal: "知道下一轮他最想跟谁比一局飞镖",
      socialEnergy: "medium", relationshipProgression: "deepen", intimacyClass: "none",
      informationGoalType: "live_observation", secondaryTopics: ["择偶偏好"],
      consentMode: "skip-anytime", boundaryTags: [],
    },
    "PN-TRUTH-276": {
      text: "你想拉谁陪你出去透口气？",
      intensity: 2, heatMin: 3, heatMax: 4,
      category: "follow_up_hook", followUpHook: "flirt_target", expectedAnswerShape: "short_phrase",
      topic: "live_chemistry", informationGain: "medium",
      informationGoal: "知道他想拉谁陪他出去透口气",
      socialEnergy: "high", relationshipProgression: "deepen", intimacyClass: "none",
      informationGoalType: "live_observation", secondaryTopics: ["择偶偏好"],
      consentMode: "skip-anytime", boundaryTags: [],
    },
    // A9-R6（2026-09-29 内容裁决）：原 `PN-TRUTH-277` 内容弱 ⇒ 退役，
    // 逐字归档在 lib/v2-content/archive/retired-pack1-r6-2026-09-29.ts，不再进本锁值表。
    "PN-TRUTH-278": {
      // A7（Part 1 P0 FAIL）：换成「先溜 / 等某个人一起溜」，short_phrase → binary、infoGoalType → self_preference。
      text: "最后一圈，你想先溜的是自己，还是等某个人一起溜？",
      intensity: 2, heatMin: 3, heatMax: 4,
      category: "follow_up_hook", followUpHook: "flirt_target", expectedAnswerShape: "binary",
      topic: "live_chemistry", informationGain: "medium",
      informationGoal: "知道他最后一圈会自己先溜还是等某个人一起溜",
      socialEnergy: "high", relationshipProgression: "deepen", intimacyClass: "none",
      informationGoalType: "self_preference", secondaryTopics: ["择偶偏好"],
      consentMode: "skip-anytime", boundaryTags: [],
    },
    "PN-TRUTH-279": {
      // A7（Part 3 换题面）：改「当场要微信」，topic → live_chemistry、hook → contact_preference，
      // 题面真实谈「微信」⇒ 挂精确开关 social-account（与 Golden 239 / REPLACE 253 同口径）。
      text: "散场之前，你想把哪个微信当场要过来？",
      intensity: 2, heatMin: 3, heatMax: 4,
      category: "follow_up_hook", followUpHook: "contact_preference", expectedAnswerShape: "short_phrase",
      topic: "live_chemistry", informationGain: "medium",
      informationGoal: "知道散场前他想把哪个微信当场要过来",
      socialEnergy: "medium", relationshipProgression: "deepen", intimacyClass: "none",
      informationGoalType: "live_observation", secondaryTopics: ["择偶偏好"],
      consentMode: "skip-anytime", boundaryTags: ["social-account"],
    },
    "PN-TRUTH-280": {
      text: "最后一首歌，你想点给谁听？",
      intensity: 2, heatMin: 3, heatMax: 4,
      category: "follow_up_hook", followUpHook: "flirt_target", expectedAnswerShape: "short_phrase",
      topic: "择偶偏好", informationGain: "medium",
      informationGoal: "知道最后一首歌他想点给谁听",
      socialEnergy: "medium", relationshipProgression: "deepen", intimacyClass: "none",
      informationGoalType: "live_observation", secondaryTopics: ["兴趣爱好"],
      consentMode: "skip-anytime", boundaryTags: [],
    },
    "PN-TRUTH-281": {
      // A7（Part 3 换题面）：换成物理动作（跟谁把这杯喝完）。
      text: "最后一段，你想跟谁把这杯喝完？",
      intensity: 2, heatMin: 3, heatMax: 4,
      category: "follow_up_hook", followUpHook: "flirt_target", expectedAnswerShape: "short_phrase",
      topic: "live_chemistry", informationGain: "medium",
      informationGoal: "知道最后一段他想跟谁把这杯喝完",
      socialEnergy: "high", relationshipProgression: "deepen", intimacyClass: "none",
      informationGoalType: "live_observation", secondaryTopics: ["择偶偏好"],
      consentMode: "skip-anytime", boundaryTags: [],
    },
    "PN-TRUTH-282": {
      text: "撒娇和嘴硬，你更扛不住哪个？",
      intensity: 2, heatMin: 2, heatMax: 4,
      category: "attraction", followUpHook: "attraction", expectedAnswerShape: "binary",
      topic: "择偶偏好", informationGain: "medium",
      informationGoal: "知道撒娇和嘴硬哪种更让他扛不住",
      socialEnergy: "medium", relationshipProgression: "open", intimacyClass: "none",
      informationGoalType: "self_preference", secondaryTopics: ["性格·习惯·小癖好"],
      consentMode: "skip-anytime", boundaryTags: [],
    },
    "PN-TRUTH-283": {
      // A7（Part 1 P0）：与 258 重复 ⇒ 换到角色位轴（主动逗 / 被逗）；category 仍 attraction。
      text: "你想当逗别人玩的那个，还是被别人逗的那个？",
      intensity: 2, heatMin: 2, heatMax: 4,
      category: "attraction", followUpHook: "attraction", expectedAnswerShape: "binary",
      topic: "择偶偏好", informationGain: "medium",
      informationGoal: "知道他想当逗别人玩的那个还是被别人逗的那个",
      socialEnergy: "medium", relationshipProgression: "open", intimacyClass: "none",
      informationGoalType: "self_preference", secondaryTopics: ["性格·习惯·小癖好"],
      consentMode: "skip-anytime", boundaryTags: [],
    },
  };

  it("现役张数由卡源派生（A9-R6 退役 277 后为 13）；ID 落在 270~283 号段且唯一", () => {
    expect(PACK1_SUPPLEMENT_CARDS.length).toBe(PACK1_SUPPLEMENT_CARD_IDS.length);
    expect(PACK1_SUPPLEMENT_CARDS.length).toBeGreaterThan(0);
    expect(new Set(PACK1_SUPPLEMENT_CARD_IDS).size).toBe(PACK1_SUPPLEMENT_CARD_IDS.length);
    for (const card of PACK1_SUPPLEMENT_CARDS) {
      const number = parseTruthCardNumber(card.cardId);
      expect(number, card.cardId).not.toBeNull();
      expect(number!, card.cardId).toBeGreaterThanOrEqual(270);
      expect(number!, card.cardId).toBeLessThanOrEqual(283);
      expect(card.number, card.cardId).toBe(number);
      expect(card.gameType, card.cardId).toBe("truth");
      expect(RETIRED_TRUTH_CARD_IDS, card.cardId).not.toContain(card.cardId);
      expect(RETIRED_PACK1_R6_CARD_IDS, card.cardId).not.toContain(card.cardId);
    }
    // A9-R6：277 已退役（号段内缺，不再回卡源）。
    expect(PACK1_SUPPLEMENT_CARD_IDS).not.toContain("PN-TRUTH-277");
    expect(RETIRED_PACK1_R6_CARD_IDS).toContain("PN-TRUTH-277");
  });

  it("逐卡锁值：题面 / Heat / intensity / planning 字段 / 全部必填质量字段与冻结表一致", () => {
    expect(Object.keys(LOCKED).sort()).toEqual([...PACK1_SUPPLEMENT_CARD_IDS].sort());
    for (const card of PACK1_SUPPLEMENT_CARDS) {
      expect(card, card.cardId).toMatchObject(LOCKED[card.cardId]!);
    }
  });

  it("逐卡 strict 门禁：8 项必填质量字段零缺失、barFit=PASS、枚举合法", () => {
    for (const card of PACK1_SUPPLEMENT_CARDS) {
      const strict = validateFixedCardMetadataStrict(card);
      expect(strict.ok, `${card.cardId} strict：${strict.issues.join("；")}`).toBe(true);
      expect(card.barFit, card.cardId).toBe("PASS");
    }
  });
});

/* ------------------------------------------------------------------ */
/* ② 字数与句读                                                        */
/* ------------------------------------------------------------------ */

describe("A6② 字数与句读：题面 ≤30 个中文字且一口气念完（单句）", () => {
  it("逐卡 pack1SupplementCountHanzi ≤ 30，且无一空题面", () => {
    for (const card of PACK1_SUPPLEMENT_CARDS) {
      const hanzi = pack1SupplementCountHanzi(card.text);
      expect(hanzi, `${card.cardId}「${card.text}」= ${hanzi} 中文字`).toBeLessThanOrEqual(30);
      expect(card.text.length, card.cardId).toBeGreaterThan(0);
    }
  });

  it("逐卡单句：题面不含「。；！」、恰以「？」收尾、逗号 ≤2（无多层条件）", () => {
    for (const card of PACK1_SUPPLEMENT_CARDS) {
      expect(card.text, `${card.cardId} 含句末标点「。；！」`).not.toMatch(/[。；！]/u);
      expect((card.text.match(/？/gu) ?? []).length, `${card.cardId} 不是单一问句`).toBe(1);
      expect(card.text.endsWith("？"), `${card.cardId} 题面未以「？」收尾`).toBe(true);
      const commaCount = (card.text.match(/，/gu) ?? []).length;
      expect(commaCount, `${card.cardId} 逗号 ${commaCount} 个，疑似多层条件`).toBeLessThanOrEqual(2);
    }
  });

  it("矩阵行字数与 pack1SupplementCountHanzi 复算一致（矩阵不手填）", () => {
    for (const row of PACK1_SUPPLEMENT_MATRIX) {
      expect(row.hanziCount, row.cardId).toBe(pack1SupplementCountHanzi(row.text));
    }
  });
});

/* ------------------------------------------------------------------ */
/* ③ 结构：热档分布 + 同档不同轴                                        */
/* ------------------------------------------------------------------ */

describe("A6③ 结构：heatMin 分布派生对账 + 同档不同轴 / 不同镜头", () => {
  it("heatMin 分布＝逐卡独立复算（H2×6 / H3×8，H1/H4 = 0 —— 补卡不硬抬 H4）", () => {
    const fromCards = pack1SupplementHeatMinDistribution();
    const fromLock: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const card of PACK1_SUPPLEMENT_CARDS) {
      expect(card.heatMin, card.cardId).toBeGreaterThanOrEqual(1);
      expect(card.heatMin, card.cardId).toBeLessThanOrEqual(4);
      expect(card.heatMax, card.cardId).toBeGreaterThanOrEqual(card.heatMin);
      expect(card.heatMax, card.cardId).toBeLessThanOrEqual(4);
      expect(card.intensity, card.cardId).toBeGreaterThanOrEqual(1);
      expect(card.intensity, card.cardId).toBeLessThanOrEqual(5);
      fromLock[card.heatMin] = (fromLock[card.heatMin] ?? 0) + 1;
    }
    expect(fromCards).toEqual(fromLock);
    expect(fromCards[2], "H2 无卡").toBeGreaterThan(0);
    expect(fromCards[3], "H3 无卡").toBeGreaterThan(0);
    expect(fromCards[1] + fromCards[4], "补卡不应落 H1/H4（它们不是身体/亲密偏好题）").toBe(0);
  });

  it("【审计辅助，非约束①证据】同档内容轴(AXES)互不相同 —— 真判据见语义签名测试", () => {
    const tiers = pack1SupplementAxesByHeatTier();
    for (const [tier, axes] of Object.entries(tiers)) {
      for (const axis of axes) expect(axis, `H${tier} 有卡缺轴标签`).not.toBe("");
      expect(new Set(axes).size, `H${tier} 同档重复轴：${axes.join(" / ")}`).toBe(axes.length);
    }
    expect(Object.keys(PACK1_SUPPLEMENT_AXES).sort()).toEqual([...PACK1_SUPPLEMENT_CARD_IDS].sort());
  });

  it("【审计辅助，非约束①证据】同档动作帧(SHOTS)互不相同 —— 只提醒审计员逐张看，不放行", () => {
    // ⚠️ A8 降级（主审 Round-3 §4/§10.3）：`SHOTS`/`AXES` 是**逐卡手写自由字符串**，
    // 「同档唯一」只因作者给每张卡各编了一个名字，**证明不了语义不同轴**（`274` 组队 vs `275` 玩一局
    // 狼人杀＝字符串不同即过闸，但答案必然同一人）。**约束①的真判据＝语义签名**，
    // 见 `tests/unit/pack1-semantic-axes.test.ts`（`pack1SemanticDuplicatePairs()` 必须为空）。
    // 本断言**只作审计辅助**：表在、键集对得上、同档不撞标签，便于人工逐张看，**不得当达成证据**。
    const tiers = pack1SupplementShotsByHeatTier();
    for (const [tier, shots] of Object.entries(tiers)) {
      for (const shot of shots) expect(shot, `H${tier} 有卡缺镜头/动作帧标签`).not.toBe("");
      expect(new Set(shots).size, `H${tier} 同档重复镜头：${shots.join(" / ")}`).toBe(shots.length);
    }
    expect(Object.keys(PACK1_SUPPLEMENT_SHOTS).sort()).toEqual([...PACK1_SUPPLEMENT_CARD_IDS].sort());
  });

  it("【审计辅助】H3「跟谁」8 张簇（273/274/275/276/278/279/280/281）：轴与镜头双双互不相同", () => {
    const H3_CLUSTER = [
      "PN-TRUTH-273", "PN-TRUTH-274", "PN-TRUTH-275", "PN-TRUTH-276",
      "PN-TRUTH-278", "PN-TRUTH-279", "PN-TRUTH-280", "PN-TRUTH-281",
    ] as const;
    const h3 = new Set(
      PACK1_SUPPLEMENT_CARDS.filter((card) => card.heatMin === 3).map((card) => card.cardId),
    );
    for (const id of H3_CLUSTER) expect(h3.has(id), `${id} 不在 H3 档`).toBe(true);
    const axes = H3_CLUSTER.map((id) => PACK1_SUPPLEMENT_AXES[id]!);
    const shots = H3_CLUSTER.map((id) => PACK1_SUPPLEMENT_SHOTS[id]!);
    expect(new Set(axes).size, `H3「跟谁」簇轴重复：${axes.join(" / ")}`).toBe(H3_CLUSTER.length);
    expect(new Set(shots).size, `H3「跟谁」簇镜头重复：${shots.join(" / ")}`).toBe(H3_CLUSTER.length);
  });

  it("intensity 与价值不倒挂：无 I4/I5；若出现 H4 档卡必须统一 I3（本批 H4 = 0）", () => {
    const intensityDist = pack1SupplementIntensityDistribution();
    expect(intensityDist[4]).toBe(0);
    expect(intensityDist[5]).toBe(0);
    const h4 = PACK1_SUPPLEMENT_CARDS.filter((card) => card.heatMin === 4);
    expect(h4).toHaveLength(0);
    for (const card of h4) expect(card.intensity, card.cardId).toBe(3);
  });

  it("followUpHook / expectedAnswerShape 分布由卡源派生且各值合法（无卡落在枚举外）", () => {
    const hookDist = pack1SupplementFollowUpHookDistribution();
    const shapeDist = pack1SupplementAnswerShapeDistribution();
    expect(Object.values(hookDist).reduce((sum, count) => sum + count, 0)).toBe(PACK1_SUPPLEMENT_CARDS.length);
    expect(Object.values(shapeDist).reduce((sum, count) => sum + count, 0)).toBe(PACK1_SUPPLEMENT_CARDS.length);
    expect(hookDist.none, "本批不应有 none 空钩子卡").toBe(0);
  });

  it("矩阵 Markdown 含全部 cardId（报告可直接引用，不手抄）", () => {
    const markdown = pack1SupplementMatrixMarkdown();
    for (const id of PACK1_SUPPLEMENT_CARD_IDS) expect(markdown).toContain(id);
  });
});

/* ------------------------------------------------------------------ */
/* ④ 钩子当场可兑现                                                     */
/* ------------------------------------------------------------------ */

describe("A6④ 钩子当场可兑现：每卡一条立刻能说出口的反问（约束③）", () => {
  const TIME_DEPENDENT = ["以后", "下次", "回头", "观察一下", "过两天", "等一等"] as const;

  it("逐卡有兑现句、以「？」结尾、≤30 字、不含需要时间的动作", () => {
    expect(Object.keys(PACK1_SUPPLEMENT_HOOK_REDEEM_LINES).sort()).toEqual([...PACK1_SUPPLEMENT_CARD_IDS].sort());
    for (const card of PACK1_SUPPLEMENT_CARDS) {
      const line = PACK1_SUPPLEMENT_HOOK_REDEEM_LINES[card.cardId];
      expect(line, `${card.cardId} 缺当场兑现句`).toBeTruthy();
      expect(line!.endsWith("？"), `${card.cardId} 兑现句不是一句反问：${line}`).toBe(true);
      expect(pack1SupplementCountHanzi(line!), card.cardId).toBeLessThanOrEqual(30);
      for (const bad of TIME_DEPENDENT) {
        expect(line!.includes(bad), `${card.cardId} 兑现句含需要时间的动作「${bad}」：${line}`).toBe(false);
      }
      expect(card.followUpHook, card.cardId).not.toBe("none");
    }
  });

  it("A8：改动卡（270/275）的兑现句必须与**新题面同源**（Round-3 §10.3 第 2 条）", () => {
    // 270：新题面「接着干杯 / 改喝点软的」⇒ 兑现句须落在干杯/软上。
    const line270 = PACK1_SUPPLEMENT_HOOK_REDEEM_LINES["PN-TRUTH-270"]!;
    expect(line270.includes("干杯") || line270.includes("软")).toBe(true);
    // 275：新题面「比一局飞镖」⇒ 兑现句须落在飞镖上（不再靠「狼人杀」）。
    const line275 = PACK1_SUPPLEMENT_HOOK_REDEEM_LINES["PN-TRUTH-275"]!;
    expect(line275).toContain("飞镖");
    expect(line275).not.toContain("狼人杀");
  });
});

/* ------------------------------------------------------------------ */
/* ⑤ 去重（批内 / Golden 12 / KEEP 5 / 244~250 / 251~269）               */
/* ------------------------------------------------------------------ */

describe("A6⑤ 去重：批内互不重复，且与全批次既有卡双向整句包含 0 命中", () => {
  function assertNoOverlap(
    text: string,
    cardId: string,
    others: ReadonlyArray<readonly [string, string]>,
    label: string,
  ) {
    for (const [otherId, otherText] of others) {
      expect(text, `${cardId} 与 ${otherId} 题面重复`).not.toBe(otherText);
      expect(text.includes(otherText), `${cardId} 整句吞并 ${otherId}`).toBe(false);
      expect(otherText.includes(text), `${otherId} 整句吞并 ${cardId}`).toBe(false);
    }
    expect(others.length, `${label} 对照集为空，去重断言会失去依据`).toBeGreaterThan(0);
  }

  it("题面互不重复（去标点后仍唯一，且无一张整句被另一张吞并）", () => {
    const hanzi = PACK1_SUPPLEMENT_CARDS.map((card) => stripNonHanzi(card.text));
    expect(new Set(hanzi).size).toBe(PACK1_SUPPLEMENT_CARDS.length);
    for (let i = 0; i < hanzi.length; i += 1) {
      for (let j = 0; j < hanzi.length; j += 1) {
        if (i === j) continue;
        expect(
          hanzi[i]!.includes(hanzi[j]!),
          `${PACK1_SUPPLEMENT_CARD_IDS[i]} 整句吞并 ${PACK1_SUPPLEMENT_CARD_IDS[j]}`,
        ).toBe(false);
      }
    }
  });

  it("与 Golden 12 / REWRITE 244~250 / REPLACE 251~269 的题面双向整句包含 0 命中", () => {
    const others: Array<readonly [string, string]> = [
      ...GOLDEN_12_CARDS.map((card) => [card.cardId, stripNonHanzi(card.text)] as const),
      ...PACK1_REWRITE_CARDS.map((card) => [card.cardId, stripNonHanzi(card.text)] as const),
      ...PACK1_REPLACE_CARDS.map((card) => [card.cardId, stripNonHanzi(card.text)] as const),
    ];
    expect(others).toHaveLength(GOLDEN_12_CARDS.length + PACK1_REWRITE_CARDS.length + PACK1_REPLACE_CARDS.length);
    for (const card of PACK1_SUPPLEMENT_CARDS) {
      assertNoOverlap(stripNonHanzi(card.text), card.cardId, others, "Golden 12 + REWRITE + REPLACE");
    }
  });

  it("与既有 KEEP 5（203/205/209/227/229）无重复", () => {
    const runtimeTextById = new Map(
      [...FORMAL_TRUTH_CARDS, ...FORMAL_TRUTH_BOOTSTRAP_CARDS].map((card) => [card.cardId, card.text]),
    );
    const keep: Array<readonly [string, string]> = KEEP_5_IDS.map((id) => {
      const text = runtimeTextById.get(id);
      expect(text, `KEEP ${id} 不在运行时包内，去重断言会失去依据`).toBeTruthy();
      return [id, stripNonHanzi(text!)] as const;
    });
    for (const card of PACK1_SUPPLEMENT_CARDS) {
      assertNoOverlap(stripNonHanzi(card.text), card.cardId, keep, "KEEP 5");
    }
  });
});

/* ------------------------------------------------------------------ */
/* ⑥ ID 号段 + ⑦ planning-only 锁                                        */
/* ------------------------------------------------------------------ */

describe("A6⑥⑦ ID 号段 + planning-only 锁 + 不进 Formal", () => {
  const adapter = getV2ContentAdapter();

  it("全库（SSOT + KEEP 运行时 + 归档退役 + Golden 12 + REWRITE + REPLACE + 本批）0 collision；最大 283 / 新起点 284", () => {
    const ssotIds = [...adapter.mainlineCards, ...adapter.expansionCards].map((card) => card.cardId);
    const keepIds = [
      ...FORMAL_TRUTH_CARDS.map((card) => card.cardId),
      ...FORMAL_TRUTH_BOOTSTRAP_CARDS.map((card) => card.cardId),
    ];
    const libraryIds = [
      ...ssotIds,
      ...keepIds,
      ...RETIRED_TRUTH_CARD_IDS,
      ...RETIRED_PACK1_R6_CARD_IDS,
      ...GOLDEN_12_CARD_IDS,
      ...PACK1_REWRITE_CARD_IDS,
      ...PACK1_REPLACE_CARD_IDS,
      ...PACK1_SUPPLEMENT_CARD_IDS,
    ];
    const report = analyzeTruthIdSpace(libraryIds);
    expect(report.collisions, report.collisions.join(",")).toEqual([]);
    expect(report.malformed, report.malformed.join(",")).toEqual([]);
    expect(report.maxTruthNumber).toBe(283);
    expect(report.suggestedNextTruthStart).toBe(284);
  });

  it("本批与归档退役卡（A3 26 ＋ A9-R6 3）、KEEP、Golden、REWRITE / REPLACE 批无任何 ID 交集", () => {
    const mine = new Set(PACK1_SUPPLEMENT_CARD_IDS);
    for (const id of [...RETIRED_TRUTH_CARD_IDS, ...RETIRED_PACK1_R6_CARD_IDS]) {
      expect(mine.has(id), id).toBe(false);
    }
    for (const id of [...GOLDEN_12_CARD_IDS, ...PACK1_REWRITE_CARD_IDS, ...PACK1_REPLACE_CARD_IDS]) {
      expect(mine.has(id), id).toBe(false);
    }
    for (const card of [...FORMAL_TRUTH_CARDS, ...FORMAL_TRUTH_BOOTSTRAP_CARDS]) {
      expect(mine.has(card.cardId), card.cardId).toBe(false);
    }
  });

  it("planning-only 锁（负向保留）：三字段未进 GameCard schema / 必填质量字段 / 桥接投影；本批卡已进运行时与 Formal 且逐张满足四条件", () => {
    const shapeKeys = Object.keys(gameCardSchema.shape);
    for (const field of PLANNING_ONLY_FIELDS) {
      expect(shapeKeys).not.toContain(field);
      expect(V2_REQUIRED_QUALITY_FIELDS as readonly string[]).not.toContain(field);
    }
    const mine = new Set(PACK1_SUPPLEMENT_CARD_IDS);
    expect(mine.size).toBe(PACK1_SUPPLEMENT_CARD_IDS.length);
    const runtimeCards = mainlineRuntimeCards();
    const ssotIds = new Set(mainlineSsotCards().map((card) => card.id));
    const runtimeIds = new Set(runtimeCards.map((card) => card.cardId));
    // 正向（A9 准入后）：本批卡真在两个运行时投影里 ⇒ 下面那条「不转发三字段」自动覆盖到本批卡。
    for (const id of PACK1_SUPPLEMENT_CARD_IDS) {
      expect(ssotIds.has(id), `${id} 应已在 SSOT 卡池`).toBe(true);
      expect(runtimeIds.has(id), `${id} 应已在运行时卡池`).toBe(true);
    }
    for (const card of mainlineSsotCards()) {
      for (const field of PLANNING_ONLY_FIELDS) expect(card, card.id).not.toHaveProperty(field);
    }
    for (const card of runtimeCards) {
      for (const field of PLANNING_ONLY_FIELDS) expect(card, card.cardId).not.toHaveProperty(field);
    }
    // 正向：在 manifest 两轨，且 Formal 四条件逐张成立。
    const legacy = FIXED_CONTENT_MANIFEST.tracks.legacyCompatibility;
    const formalAllowed = new Set(FIXED_CONTENT_MANIFEST.tracks.formalFixed.allowedCardIds);
    const legacyAllowed = new Set(legacy.allowedCardIds);
    for (const id of PACK1_SUPPLEMENT_CARD_IDS) {
      expect(legacyAllowed.has(id), `${id} 应在 legacyCompatibility`).toBe(true);
      expect(formalAllowed.has(id), `${id} 应在 formalFixed`).toBe(true);
      const provenance = legacy.provenance[id];
      expect(provenance, `${id} 缺 provenance`).toBeDefined();
      expect(provenance!.metadataStatus, id).toBe("audited");
      expect(provenance!.reviewed, id).toBe(true);
      expect(provenance!.humanBarFit, id).toBe("PASS");
      expect(provenance!.payloadHash, id).toMatch(/^[0-9a-f]{64}$/u);
    }
  });

  it("管线可接：本批卡形状为 FormalTruthCard 超集（含 SSOT 18 字段全部键）", () => {
    const V13_KEYS = [
      "schemaVersion", "cardId", "gameType", "number", "text", "intensity", "heatMin", "heatMax",
      "relationStage", "targetMode", "responseMode", "interactionType", "consentMode",
      "matchRequired", "boundaryTags", "fallbackPolicy", "signalEffects", "postAction",
    ] as const;
    for (const card of PACK1_SUPPLEMENT_CARDS) {
      for (const key of V13_KEYS) expect(card, `${card.cardId} 缺 ${key}`).toHaveProperty(key);
    }
  });
});

/* ------------------------------------------------------------------ */
/* ⑧ consent                                                           */
/* ------------------------------------------------------------------ */

describe("A6⑧ consent：全批可跳过；本批无身体卡 ⇒ 卡面不挂「偏好 ≠ 授权」注释", () => {
  const CARDS_SOURCE_PATH = join("lib", "v2-content", "pack1-supplements", "pack1-supplement-cards.ts");

  it("全批 consentMode=skip-anytime；body_preference 派生清单为空（与卡源一致）", () => {
    const expected = PACK1_SUPPLEMENT_CARDS
      .filter((card) => card.category === "body_preference")
      .map((card) => card.cardId);
    expect([...PACK1_SUPPLEMENT_BODY_INTIMACY_CARD_IDS].sort()).toEqual([...expected].sort());
    expect(PACK1_SUPPLEMENT_BODY_INTIMACY_CARD_IDS).toHaveLength(0);
    for (const card of PACK1_SUPPLEMENT_CARDS) {
      expect(card.consentMode, card.cardId).toBe("skip-anytime");
    }
  });

  it("卡面源码无 consent 注释（0 张身体卡 ⇒ 注释数必须为 0，多写即红）", () => {
    const source = readFileSync(CARDS_SOURCE_PATH, "utf8");
    const noteCommentCount = source.split("// 偏好 ≠ 授权").length - 1;
    expect(noteCommentCount).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* ⑨ 5 条强制约束（`temp/GOLDEN12-REVIEW-2.md` §5.3）                    */
/* ------------------------------------------------------------------ */

describe("A6⑨ 5 条强制约束：同档不同轴 / 无外观二元对照 / 钩子兑现 / H4 统一 I3 / 元数据同源", () => {
  const APPEARANCE_AXIS_WORDS = ["穿着", "打扮", "长相", "颜值", "外貌", "外表", "身材"] as const;

  it("约束②：无「外观 A vs 外观 B」型二元对照（外观评价词在本批 0 命中）", () => {
    for (const card of PACK1_SUPPLEMENT_CARDS) {
      const hits = APPEARANCE_AXIS_WORDS.filter((word) => card.text.includes(word));
      expect(hits, `${card.cardId} 命中外观轴词：${hits.join(" / ")}`).toEqual([]);
    }
  });

  it("约束⑤：元数据随题面同源（category / topic / intimacyClass / hook / boundaryTags 交叉自洽）", () => {
    for (const card of PACK1_SUPPLEMENT_CARDS) {
      // 本批非身体卡：不得蹭亲密类元数据（241 反面教材）。
      expect(card.intimacyClass, card.cardId).toBe("none");
      expect(card.topic, card.cardId).not.toBe("性观念·亲密态度");
      if (card.followUpHook === "body_preference") expect(card.category, card.cardId).toBe("body_preference");
      if (card.category === "attraction") {
        expect(card.topic, card.cardId).toBe("择偶偏好");
        expect(card.relationStage, card.cardId).toBe("know");
      }
      if (card.category === "follow_up_hook") {
        // follow_up_hook 的答案必须是「下一步玩法 / 邀约」，主题须落在现场化学或生活 / 相处规则。
        expect(["live_chemistry", "生活方式", "相处规则", "择偶偏好"], card.cardId).toContain(card.topic);
      }
      // 题面真实谈「微信 / 账号交换」才写 social-account（A7：279 换题面后真实命中，故须挂）；
      // 未谈账号交换的卡不得挂该标签。
      if (card.text.includes("微信")) {
        expect(card.boundaryTags, card.cardId).toContain("social-account");
      } else {
        expect(card.boundaryTags, card.cardId).not.toContain("social-account");
      }
    }
  });

  it("约束②附：题面不含外观对照，且「谁 / 哪个」类卡不得出现外观评价词（同上已覆盖）", () => {
    for (const card of PACK1_SUPPLEMENT_CARDS) {
      expect(card.text, card.cardId).not.toMatch(/穿着|打扮/u);
    }
  });
});

/* ------------------------------------------------------------------ */
/* ⑩ 覆盖率：卡面 category 真值放行，明确禁止重叠口径                     */
/* ------------------------------------------------------------------ */

describe("A7⑩ 覆盖率按「卡面 category 真值」放行；重叠口径只作对照，禁止用于通过", () => {
  it("本批真值：follow_up_hook 9 张 + attraction 2 张 + quick_know 2 张（逐卡 re-count；A9-R6 退役 277 后）", () => {
    const truth = pack1SupplementCategoryTruth();
    expect(truth.follow_up_hook).toBe(9);
    expect(truth.attraction).toBe(2);
    expect(truth.quick_know).toBe(2);
    expect(truth.flirt).toBe(0);
    expect(truth.body_preference).toBe(0);
  });

  it("全批次真值放行：quick_know≥1 / attraction≥4 / flirt≥5 / body_preference≥3（follow_up_hook 数量不作放行门）", () => {
    const { ok, gaps } = pack1UnionCategoryTruthRequirementsMet();
    expect(gaps, gaps.join("；")).toEqual([]);
    expect(ok).toBe(true);
    const truth = pack1UnionCategoryTruth();
    expect(truth.quick_know).toBeGreaterThanOrEqual(PACK1_UNION_CATEGORY_REQUIREMENTS.quick_know);
    expect(truth.attraction).toBeGreaterThanOrEqual(PACK1_UNION_CATEGORY_REQUIREMENTS.attraction);
    expect(truth.flirt).toBeGreaterThanOrEqual(PACK1_UNION_CATEGORY_REQUIREMENTS.flirt);
    expect(truth.body_preference).toBeGreaterThanOrEqual(PACK1_UNION_CATEGORY_REQUIREMENTS.body_preference);
    // A9-R6 §4.7：`follow_up_hook` 数量**退出放行门**（降级为诊断基线）——requirement 表里不再有该键，
    // 其真值只作诊断输出（下方精确真值锁仍如实记录 9，但不再当门槛）。
    expect("follow_up_hook" in PACK1_UNION_CATEGORY_REQUIREMENTS).toBe(false);
    expect(truth.follow_up_hook).toBe(9);
    // 精确真值锁（防止将来有人把统计口径改成「category 或 hook」仍报同一句话）。
    // A9-R6：退役 236（attraction）/ 263（quick_know）/ 277（quick_know）；
    // A9-R7：退役 249（quick_know）＋ 241 改写（quick_know → body_preference，编排者裁决注入亲密元素）。
    expect(truth).toEqual({
      quick_know: 18,
      attraction: 7,
      flirt: 8,
      body_preference: 6,
      follow_up_hook: 9,
    });
  });

  it("⛔ 统计函数**只按 `category` 计**，不得混入 `hook`（与重叠口径对账）", () => {
    // 独立 re-count（只读 card.category），逐卡对账 pack1UnionCategoryTruth()。
    const manual: Record<string, number> = {
      quick_know: 0, attraction: 0, flirt: 0, body_preference: 0, follow_up_hook: 0,
    };
    for (const card of PACK1_UNION_CARDS) manual[card.category] = (manual[card.category] ?? 0) + 1;
    expect(pack1UnionCategoryTruth()).toEqual(manual);
    // 反证：真值之和 = 卡数（每张卡只进一个桶）；若函数混入 hook，计数会 > 卡数。
    expect(Object.values(pack1UnionCategoryTruth()).reduce((sum, n) => sum + n, 0)).toBe(
      PACK1_UNION_CARDS.length,
    );
  });

  it("⛔ 重叠口径与真值口径**必须不同**（重叠口径把 follow_up_hook 报成「带钩子的张数」）", () => {
    const truth = pack1UnionCategoryTruth();
    const overlap = pack1UnionCategoryCoverageOverlap();
    expect(overlap.follow_up_hook).not.toBe(truth.follow_up_hook);
    expect(overlap.follow_up_hook, "重叠口径下 follow_up_hook ＝ 全部带钩子的张数").toBe(
      PACK1_UNION_CARDS.length,
    );
    expect(truth.follow_up_hook, "真值口径下 follow_up_hook ＝ 归这一类的张数").toBe(9);
    // 各批重叠之和与全批次重叠一致（两处派生对账，防手填）。
    expect(pack1UnionCategoryCoverageOverlapByBatch()).toEqual(overlap);
  });

  it("⛔ `category=follow_up_hook` 的卡，题面必须**点名对象或动作**（防下一批再靠风格偏好扩义凑数）", () => {
    // 全批次（不只本批）：所有 follow_up_hook 卡都要命中「对象/动作指向词」。
    expect(pack1FollowUpHookCardsMissingTarget(PACK1_UNION_CARDS)).toEqual([]);
    // 本批同样为零命中。
    expect(pack1FollowUpHookCardsMissingTarget()).toEqual([]);
    // 词表非空且都为短词（防「往词表里塞泛词」绕过）。
    expect(PACK1_FOLLOW_UP_HOOK_TARGET_TOKENS.length).toBeGreaterThan(0);
    for (const token of PACK1_FOLLOW_UP_HOOK_TARGET_TOKENS) expect(token.length).toBeLessThanOrEqual(3);
  });
});

/* ------------------------------------------------------------------ */
/* ⑪ followUpHook 单列分布 + 全批次热档余量                              */
/* ------------------------------------------------------------------ */

describe("A7⑪ followUpHook 枚举单列分布 + 全批次 H1~H4 余量", () => {
  it("全批次 followUpHook 分布（单列统计，8 值全集；none 归零）", () => {
    const dist = pack1UnionFollowUpHookDistribution();
    expect(Object.values(dist).reduce((sum, count) => sum + count, 0)).toBe(PACK1_UNION_CARDS.length);
    expect(dist.none, "全批次不应有 none 空钩子卡").toBe(0);
    // A9-R6 退役 236（attraction）/ 263（flirt_target）/ 277（social_style）；
    // A9-R7 退役 249（social_style）＋ 241 改写（attraction → body_preference）后精确分布：
    expect(dist).toEqual({
      none: 0,
      attraction: 7,
      initiative: 5,
      eye_contact: 1,
      body_preference: 4,
      contact_preference: 4,
      flirt_target: 13,
      social_style: 14,
    });
  });

  it("全批次 heatMin 分布：H3 ≥4 且 H4 ≥3（余量非零）", () => {
    const dist = pack1UnionHeatMinDistribution();
    expect(Object.values(dist).reduce((sum, count) => sum + count, 0)).toBe(PACK1_UNION_CARDS.length);
    // A9-R6 退役 236/263/277（均 H2）：H2 19→16；A9-R7 退役 249（H1）：H1 11→10。
    expect(dist).toEqual({ 1: 10, 2: 16, 3: 16, 4: 6 });
    expect(dist[3], "H3 未达 ≥4").toBeGreaterThanOrEqual(4);
    expect(dist[4], "H4 未达 ≥3").toBeGreaterThanOrEqual(3);
    // 余量：H3 / H4 都严格大于阈值（修「零余量」）。
    expect(dist[3]).toBeGreaterThan(4);
    expect(dist[4]).toBeGreaterThan(3);
  });

  it("强度不倒挂：全批次无 I4/I5，且 H3 档不得配 I1（约束④）", () => {
    for (const card of PACK1_UNION_CARDS) {
      expect(card.intensity, `${card.cardId} 出现 I4/I5`).toBeLessThanOrEqual(3);
      expect(card.intensity, card.cardId).toBeGreaterThanOrEqual(1);
    }
    // H3 是「明显暧昧」，配 I1 即档位高于强度的倒挂（277 修前正是 H3×I1；277 已退役，判据仍保留）。
    const h3i1 = PACK1_UNION_CARDS
      .filter((card) => card.heatMin === 3 && card.intensity === 1)
      .map((card) => card.cardId);
    expect(h3i1, `H3×I1 倒挂：${h3i1.join(" / ")}`).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* ⑫ 8 问自检（可机检部分）                                             */
/* ------------------------------------------------------------------ */

describe("A6⑫ 8 问自检（可机检部分）：无 AI 腔 / 无长期关系滑向 / 不误触 BAR-FIT 硬失败", () => {
  const AI_SURVEY_PATTERNS = ["说说", "为什么", "当时", "举一个", "各占几成", "几成", "哪三段", "最近一次", "真发生过"] as const;
  const LONG_TERM_PATTERNS = ["前任", "上一段", "长期", "五年", "结婚", "未来", "人生", "理想生活", "伴侣"] as const;

  it("无 AI 问卷 / 面试 / 咨询腔句式（问 7）", () => {
    for (const card of PACK1_SUPPLEMENT_CARDS) {
      for (const pattern of AI_SURVEY_PATTERNS) {
        expect(card.text.includes(pattern), `${card.cardId} 命中 AI/问卷腔句式「${pattern}」`).toBe(false);
      }
    }
  });

  it("无长期关系 / 前任 / 人生规划滑向（问 8）", () => {
    for (const card of PACK1_SUPPLEMENT_CARDS) {
      for (const pattern of LONG_TERM_PATTERNS) {
        expect(card.text.includes(pattern), `${card.cardId} 命中长期关系/退出类词「${pattern}」`).toBe(false);
      }
    }
  });

  it("不误触 BAR-FIT 表演 / 记忆 / 安静依赖类硬失败（机器预筛无 HARD_FAIL_PATTERN）", () => {
    const hardFailTexts = PACK1_SUPPLEMENT_CARDS.filter(
      (card) => judgeBarFit({ cardId: card.cardId, text: card.text }).machineVerdict === "HARD_FAIL_PATTERN",
    ).map((card) => `${card.cardId}「${card.text}」`);
    expect(hardFailTexts, `命中硬失败题面：${hardFailTexts.join(" / ")}`).toEqual([]);
  });

  it("安全红线：题面不露骨、不盘问性经历、不写成接触授权", () => {
    const FORBIDDEN = ["脱", "裸", "性经历", "第一次做", "上床", "睡过", "授权你碰", "随便摸"] as const;
    for (const card of PACK1_SUPPLEMENT_CARDS) {
      for (const word of FORBIDDEN) {
        expect(card.text.includes(word), `${card.cardId} 命中露骨/盘问词「${word}」`).toBe(false);
      }
    }
  });
});
