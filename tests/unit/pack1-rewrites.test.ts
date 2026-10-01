/**
 * A4c｜第一包 REWRITE 7 张重写批（`lib/v2-content/pack1-rewrites/`）的**机器门禁**。
 *
 * 锁死七件事：
 * ① **逐卡值锁**：题面 / Heat / intensity / planning 字段，＋全部既有必填质量字段
 *    （`V2_REQUIRED_QUALITY_FIELDS`）逐卡锁死，改动即红；
 * ② **字数**：题面 ≤30 个中文字（`pack1CountHanzi` 可复算）；
 * ③ **结构**：`heatMin` 分布由实际产出派生（不硬编码档数）；类别覆盖按重叠口径达 A5 指标；
 *    **同档不同轴**（同 `heatMin` 档内内容轴互不相同）；
 * ④ **钩子当场可兑现**：每卡都有一条「旁人立刻能说出口的反问」，以「？」结尾、无需要时间的动作；
 * ⑤ **去重**：7 张互不重复，且与 Golden 12（12 张）与 KEEP 5 均无重复；
 * ⑥ **ID 号段**：`PN-TRUTH-244~250` 连续 7 个、全库（SSOT＋KEEP 运行时＋归档退役＋Golden 12＋本批）
 *    经 `analyzeTruthIdSpace` 扫描 0 collision；
 * ⑦ **planning-only 锁**：`category / followUpHook / expectedAnswerShape` **未进入**
 *    `GameCard` 正式 schema、`V2_REQUIRED_QUALITY_FIELDS`、桥接转发卡（Runtime 投影）；
 *    且本批**不进任何运行时卡池 / Formal 清单**（等审查通过后另一单处理）。
 *
 * ⚠️ **A5 口径变更（2026-09-29，编排者裁决）**：`248 / 249 / 250` 从 A4c 误写的 H3/H4 热档题
 * **回退**到旧 `230 / 231 / 226` 的原始方向（H1 生活 / 社交），于是本批 `heatMin` 自然变成
 * **H1×5 + H2×2**（`H3/H4 = 0`）、`flirt / body_preference` 覆盖为 0。相应断言随之改口径：
 * - 不再要求「H1~H4 四档均 >0」（派工单已定该批 `heatMin` 由内容自然决定，H4 允许为 0）；
 * - 去掉「每档 ≤3 张」硬上限（档位张数不是可控量），只保留真正的约束「同档轴互不相同」；
 * - 类别覆盖下界改按 A5 Part 1 指标（quick_know≥1 / attraction≥1 / follow_up_hook≥3）；
 * - 本批 `body_preference = 0` ⇒ 卡面无 consent 注释；H3/H4 与 flirt / body_preference 覆盖
 *   由同单新批 `PN-TRUTH-251~269`（`lib/v2-content/pack1-replaces/`）承担并单独断言。
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { gameCardSchema } from "@/lib/domain/schemas";
import {
  GOLDEN_12_CARD_IDS,
  GOLDEN_12_CARDS,
} from "@/lib/v2-content/golden12/golden-12-cards";
import { goldenCategoryCoverage } from "@/lib/v2-content/golden12/golden-12-matrix";
import {
  PACK1_REWRITE_BODY_INTIMACY_CARD_IDS,
  PACK1_REWRITE_CARDS,
  PACK1_REWRITE_CARD_IDS,
} from "@/lib/v2-content/pack1-rewrites/pack1-rewrite-cards";
import {
  PACK1_REWRITE_AXES,
  PACK1_REWRITE_HOOK_REDEEM_LINES,
  PACK1_REWRITE_MATRIX,
  pack1AnswerShapeDistribution,
  pack1AxesByHeatTier,
  pack1CategoryCoverage,
  pack1CategoryRequirementsMet,
  pack1CountHanzi,
  pack1FollowUpHookDistribution,
  pack1HeatMinDistribution,
  pack1IntensityDistribution,
  pack1RewriteMatrixMarkdown,
} from "@/lib/v2-content/pack1-rewrites/pack1-rewrite-matrix";
import { analyzeTruthIdSpace, parseTruthCardNumber } from "@/lib/v2-content/card-id-space";
import { getV2ContentAdapter } from "@/lib/v2-content/v2-content-adapter";
import { FIXED_CONTENT_MANIFEST } from "@/lib/v2-content/fixed-content-manifest";
import { FORMAL_TRUTH_BOOTSTRAP_CARDS } from "@/lib/v2-content/formal-truth-bootstrap-pack";
import { FORMAL_TRUTH_CARDS } from "@/lib/v2-content/formal-truth-pack";
import { RETIRED_TRUTH_CARD_IDS } from "@/lib/v2-content/archive/retired-truth-pack-2026-09-29";
import { RETIRED_PACK1_R7_CARD_IDS } from "@/lib/v2-content/archive/retired-pack1-r7-2026-09-29";
import { V2_REQUIRED_QUALITY_FIELDS, validateFixedCardMetadataStrict } from "@/lib/v2-content/v2-card-metadata";
import { mainlineRuntimeCards, mainlineSsotCards } from "@/lib/v2-content/v2-card-bridge";

const PLANNING_ONLY_FIELDS = ["category", "followUpHook", "expectedAnswerShape"] as const;

/** 既有 KEEP 5（内部风格闸对照集，本批不得与之语义重复）。 */
const KEEP_5_IDS = ["PN-TRUTH-203", "PN-TRUTH-205", "PN-TRUTH-209", "PN-TRUTH-227", "PN-TRUTH-229"] as const;

/** 本批所重写的 7 张旧卡 ID（`temp/BAR-AUDIT-PACK1-31.md` 的 REWRITE 7）；新批不得复用其 ID。 */
const OLD_REWRITE_IDS = ["PN-TRUTH-201", "PN-TRUTH-202", "PN-TRUTH-225", "PN-TRUTH-226", "PN-TRUTH-228", "PN-TRUTH-230", "PN-TRUTH-231"] as const;

/** 去标点取纯汉字串：用于「换标点即绕过」的去重口径。 */
function stripNonHanzi(text: string): string {
  return text.replace(/[^\u4e00-\u9fff]/gu, "");
}

/* ------------------------------------------------------------------ */
/* ① 逐卡值锁                                                          */
/* ------------------------------------------------------------------ */

describe("A4c① 第一包 REWRITE 7 张逐卡值锁死", () => {
  /** 逐卡期望值（题面 + Heat + intensity + planning 字段 + 全部必填质量字段）。 */
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
    "PN-TRUTH-244": {
      // A7（Part 3 换题面）：A6 的「这周有谁约过你」时间轴太泛 ⇒ 拉到今晚（主审 §A/§F）。
      text: "今晚到现在，有人约你去下一场，你是当场答应，还是说再看？",
      intensity: 1, heatMin: 1, heatMax: 3,
      category: "quick_know", followUpHook: "initiative", expectedAnswerShape: "binary",
      topic: "生活方式", informationGain: "medium",
      informationGoal: "知道他今晚有人约去下一场时是当场答应还是说再看",
      socialEnergy: "medium", relationshipProgression: "open", intimacyClass: "none",
      informationGoalType: "self_preference", secondaryTopics: ["相处规则"],
      consentMode: "skip-anytime", boundaryTags: [],
    },
    "PN-TRUTH-245": {
      text: "在场你更像哪种：先开口的，还是等人来聊的？",
      intensity: 1, heatMin: 1, heatMax: 3,
      category: "quick_know", followUpHook: "initiative", expectedAnswerShape: "binary",
      topic: "性格·习惯·小癖好", informationGain: "medium",
      informationGoal: "知道他在场上是先开口型还是等人来搭型",
      socialEnergy: "medium", relationshipProgression: "open", intimacyClass: "none",
      informationGoalType: "self_preference", secondaryTopics: ["相处规则"],
      consentMode: "skip-anytime", boundaryTags: [],
    },
    "PN-TRUTH-246": {
      text: "你更吃哪种人：像你的，还是跟你完全不一样的？",
      intensity: 2, heatMin: 2, heatMax: 4,
      category: "attraction", followUpHook: "attraction", expectedAnswerShape: "binary",
      topic: "择偶偏好", informationGain: "medium",
      informationGoal: "知道他更容易被像自己的人还是反差型的人吸引",
      socialEnergy: "medium", relationshipProgression: "open", intimacyClass: "none",
      informationGoalType: "self_preference", secondaryTopics: ["恋爱观"],
      consentMode: "skip-anytime", boundaryTags: [],
    },
    "PN-TRUTH-247": {
      text: "你的心动是看一眼就来，还是越聊越有？",
      intensity: 2, heatMin: 2, heatMax: 3,
      category: "attraction", followUpHook: "attraction", expectedAnswerShape: "binary",
      topic: "择偶偏好", informationGain: "medium",
      informationGoal: "知道他的心动是始于一眼还是始于相处",
      socialEnergy: "medium", relationshipProgression: "open", intimacyClass: "none",
      informationGoalType: "self_preference", secondaryTopics: ["恋爱观"],
      consentMode: "skip-anytime", boundaryTags: [],
    },
    "PN-TRUTH-248": {
      // A5：1:1 承接旧 230（与刚认识的人相处的规矩 / 容忍点），不再是从前那张 H3 告白题。
      text: "刚认识的人，你最受不了哪种：查户口、太热情，还是爱答不理？",
      intensity: 2, heatMin: 1, heatMax: 3,
      category: "quick_know", followUpHook: "social_style", expectedAnswerShape: "ternary",
      topic: "相处规则", informationGain: "medium",
      informationGoal: "知道他跟刚认识的人相处时最受不了对方哪一点",
      socialEnergy: "medium", relationshipProgression: "open", intimacyClass: "none",
      informationGoalType: "relationship_rule", secondaryTopics: ["性格·习惯·小癖好"],
      consentMode: "skip-anytime", boundaryTags: [],
    },
    // A9-R7（2026-09-29 内容返工）：原 `PN-TRUTH-249`（这周哪天最像在放假）与 250 同轴
    // ⇒ 退役，逐字归档在 lib/v2-content/archive/retired-pack1-r7-2026-09-29.ts，不再进本锁值表。
    "PN-TRUTH-250": {
      // A8（Part 3 换题面，主审 Round-3 §1/§10.2）：A7 版仍缺现场时间锚 ⇒ 时间轴绑到今晚。
      text: "这一周攒的劲，你打算今晚一次放完，还是留着明天再放？",
      intensity: 1, heatMin: 1, heatMax: 3,
      category: "quick_know", followUpHook: "social_style", expectedAnswerShape: "binary",
      topic: "生活方式", informationGain: "medium",
      informationGoal: "知道他这一周攒的劲打算今晚一次放完还是留着明天再放",
      socialEnergy: "medium", relationshipProgression: "open", intimacyClass: "none",
      informationGoalType: "self_preference", secondaryTopics: ["性格·习惯·小癖好"],
      consentMode: "skip-anytime", boundaryTags: [],
    },
  };

  it("现役张数由卡源派生（A9-R7 退役 249 后为 6）；ID 落在 244~250 号段且唯一", () => {
    expect(PACK1_REWRITE_CARDS).toHaveLength(PACK1_REWRITE_CARD_IDS.length);
    expect(PACK1_REWRITE_CARDS.length).toBeGreaterThan(0);
    // 号段 244~250 减去已退役的 249（ID 清单由「号段 + 退役集」派生，不写死 7/6）。
    expect(PACK1_REWRITE_CARD_IDS).toEqual(
      Array.from({ length: 7 }, (_, index) => `PN-TRUTH-${244 + index}`).filter(
        (id) => !RETIRED_PACK1_R7_CARD_IDS.includes(id),
      ),
    );
    expect(new Set(PACK1_REWRITE_CARD_IDS).size).toBe(PACK1_REWRITE_CARD_IDS.length);
    for (const card of PACK1_REWRITE_CARDS) {
      expect(card.number, card.cardId).toBe(parseTruthCardNumber(card.cardId));
      expect(card.gameType, card.cardId).toBe("truth");
      // 新批必须新开 ID：既不与所重写的 7 张旧卡同号，也不与归档 26 卡 / A9-R7 退役卡同号。
      expect(OLD_REWRITE_IDS as readonly string[], card.cardId).not.toContain(card.cardId);
      expect(RETIRED_TRUTH_CARD_IDS, card.cardId).not.toContain(card.cardId);
      expect(RETIRED_PACK1_R7_CARD_IDS, card.cardId).not.toContain(card.cardId);
    }
    // A9-R7：249 已退役（号段内缺，不再回卡源）。
    expect(PACK1_REWRITE_CARD_IDS).not.toContain("PN-TRUTH-249");
    expect(RETIRED_PACK1_R7_CARD_IDS).toContain("PN-TRUTH-249");
  });

  it("逐卡锁值：题面 / Heat / intensity / planning 字段 / 全部必填质量字段与冻结表一致", () => {
    expect(Object.keys(LOCKED).sort()).toEqual([...PACK1_REWRITE_CARD_IDS].sort());
    for (const card of PACK1_REWRITE_CARDS) {
      expect(card, card.cardId).toMatchObject(LOCKED[card.cardId]!);
    }
  });

  it("逐卡 strict 门禁：8 项必填质量字段零缺失、barFit=PASS、枚举合法", () => {
    for (const card of PACK1_REWRITE_CARDS) {
      const strict = validateFixedCardMetadataStrict(card);
      expect(strict.ok, `${card.cardId} strict：${strict.issues.join("；")}`).toBe(true);
      expect(card.barFit, card.cardId).toBe("PASS");
    }
  });
});

/* ------------------------------------------------------------------ */
/* ② 字数                                                              */
/* ------------------------------------------------------------------ */

describe("A4c② 字数：题面 ≤30 个中文字（可复算）", () => {
  it("逐卡 pack1CountHanzi ≤ 30，且无一空题面", () => {
    for (const card of PACK1_REWRITE_CARDS) {
      const hanzi = pack1CountHanzi(card.text);
      expect(hanzi, `${card.cardId}「${card.text}」= ${hanzi} 中文字`).toBeLessThanOrEqual(30);
      expect(card.text.length, card.cardId).toBeGreaterThan(0);
    }
  });

  it("矩阵行字数与 pack1CountHanzi 复算一致（矩阵不手填）", () => {
    for (const row of PACK1_REWRITE_MATRIX) {
      expect(row.hanziCount, row.cardId).toBe(pack1CountHanzi(row.text));
    }
  });
});

/* ------------------------------------------------------------------ */
/* ③ 结构：heatMin 覆盖 H1~H4 + 类别覆盖 + 同档不同轴                     */
/* ------------------------------------------------------------------ */

describe("A4c/A5③ 结构：热档分布派生对账 + 类别覆盖达标 + 同档不同轴", () => {
  it("heatMin 分布＝逐卡独立复算的结果（A5 后 H1×5 + H2×2，H3/H4 = 0 是旧方向决定的，不是漏卡）", () => {
    const fromCards = pack1HeatMinDistribution();
    const fromLock: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const card of PACK1_REWRITE_CARDS) {
      expect(card.heatMin, card.cardId).toBeGreaterThanOrEqual(1);
      expect(card.heatMin, card.cardId).toBeLessThanOrEqual(4);
      expect(card.heatMax, card.cardId).toBeGreaterThanOrEqual(card.heatMin);
      expect(card.heatMax, card.cardId).toBeLessThanOrEqual(4);
      expect(card.intensity, card.cardId).toBeGreaterThanOrEqual(1);
      expect(card.intensity, card.cardId).toBeLessThanOrEqual(5);
      fromLock[card.heatMin] = (fromLock[card.heatMin] ?? 0) + 1;
    }
    expect(fromCards).toEqual(fromLock);
    // A5：7 张旧 REWRITE 全是 H1 生活 / 兴趣 / 社交向 ⇒ 本批只自然产出 H1/H2（A9-R7 退役 249 后 H1 少一张）。
    // H3/H4 覆盖改由同单新批 PN-TRUTH-251~269 承担（断言在 pack1-replaces.test.ts）。
    expect(fromCards[1]).toBeGreaterThan(0);
    expect(fromCards[2]).toBeGreaterThan(0);
    expect(fromCards[3] + fromCards[4]).toBe(0);
  });

  it("类别覆盖按重叠口径达到 A5 Part 1 指标（quick_know≥1 / attraction≥1 / flirt=0 / body_preference=0 / follow_up_hook≥3）", () => {
    const { ok, gaps } = pack1CategoryRequirementsMet();
    expect(gaps, gaps.join("；")).toEqual([]);
    expect(ok).toBe(true);
    const coverage = pack1CategoryCoverage();
    expect(coverage.quick_know).toBeGreaterThanOrEqual(1);
    expect(coverage.attraction).toBeGreaterThanOrEqual(1);
    expect(coverage.follow_up_hook).toBeGreaterThanOrEqual(3);
    // 设计值（不是遗漏）：本批按旧方向 1:1 重写，天然不含暧昧 / 身体题。
    expect(coverage.flirt).toBe(0);
    expect(coverage.body_preference).toBe(0);
  });

  it("同档不同轴：同一 heatMin 档内内容轴互不相同（约束①）", () => {
    const tiers = pack1AxesByHeatTier();
    for (const [tier, axes] of Object.entries(tiers)) {
      for (const axis of axes) expect(axis, `H${tier} 有卡缺轴标签`).not.toBe("");
      expect(new Set(axes).size, `H${tier} 同档重复轴：${axes.join(" / ")}`).toBe(axes.length);
    }
    // 轴标签逐卡齐备（不手填断言：集合与卡源 ID 完全对应）。
    expect(Object.keys(PACK1_REWRITE_AXES).sort()).toEqual([...PACK1_REWRITE_CARD_IDS].sort());
  });

  it("followUpHook / expectedAnswerShape 分布由卡源派生且各值合法（无卡落在枚举外）", () => {
    const hookDist = pack1FollowUpHookDistribution();
    const shapeDist = pack1AnswerShapeDistribution();
    expect(Object.values(hookDist).reduce((sum, count) => sum + count, 0)).toBe(PACK1_REWRITE_CARDS.length);
    expect(Object.values(shapeDist).reduce((sum, count) => sum + count, 0)).toBe(PACK1_REWRITE_CARDS.length);
    expect(hookDist.none, "本批不应有 none 空钩子卡").toBe(0);
  });

  it("intensity 与价值不倒挂：无 I4/I5；若将来出现 H4 档卡，必须统一 I3（约束④）", () => {
    const intensityDist = pack1IntensityDistribution();
    expect(intensityDist[4]).toBe(0);
    expect(intensityDist[5]).toBe(0);
    for (const card of PACK1_REWRITE_CARDS) {
      if (card.heatMin === 4) expect(card.intensity, card.cardId).toBe(3);
    }
  });

  it("矩阵 Markdown 含全部 7 个 cardId（报告可直接引用，不手抄）", () => {
    const markdown = pack1RewriteMatrixMarkdown();
    for (const id of PACK1_REWRITE_CARD_IDS) expect(markdown).toContain(id);
  });
});

/* ------------------------------------------------------------------ */
/* ④ 钩子当场可兑现                                                     */
/* ------------------------------------------------------------------ */

describe("A4c④ 钩子当场可兑现：每卡一条立刻能说出口的反问（约束③）", () => {
  const TIME_DEPENDENT = ["以后", "下次", "回头", "观察一下", "过两天", "等一等"] as const;

  it("逐卡有兑现句、以「？」结尾、≤30 字、不含需要时间的动作", () => {
    expect(Object.keys(PACK1_REWRITE_HOOK_REDEEM_LINES).sort()).toEqual([...PACK1_REWRITE_CARD_IDS].sort());
    for (const card of PACK1_REWRITE_CARDS) {
      const line = PACK1_REWRITE_HOOK_REDEEM_LINES[card.cardId];
      expect(line, `${card.cardId} 缺当场兑现句`).toBeTruthy();
      expect(line!.endsWith("？"), `${card.cardId} 兑现句不是一句反问：${line}`).toBe(true);
      expect(pack1CountHanzi(line!), card.cardId).toBeLessThanOrEqual(30);
      for (const bad of TIME_DEPENDENT) {
        expect(line!.includes(bad), `${card.cardId} 兑现句含需要时间的动作「${bad}」：${line}`).toBe(false);
      }
      expect(card.followUpHook, card.cardId).not.toBe("none");
    }
  });
});

/* ------------------------------------------------------------------ */
/* ⑤ 去重（批内 / 与 Golden 12 / 与 KEEP 5）                            */
/* ------------------------------------------------------------------ */

describe("A4c⑤ 去重：批内互不重复，且与 Golden 12 / KEEP 5 无重复", () => {
  it("现役题面互不重复（去标点后仍唯一，且无一张整句被另一张吞并；A9-R7 后 6 张）", () => {
    const hanzi = PACK1_REWRITE_CARDS.map((card) => stripNonHanzi(card.text));
    expect(new Set(hanzi).size).toBe(PACK1_REWRITE_CARDS.length);
    for (let i = 0; i < hanzi.length; i += 1) {
      for (let j = 0; j < hanzi.length; j += 1) {
        if (i === j) continue;
        expect(hanzi[i]!.includes(hanzi[j]!), `${PACK1_REWRITE_CARD_IDS[i]} 整句吞并 ${PACK1_REWRITE_CARD_IDS[j]}`).toBe(false);
      }
    }
  });

  it("与 Golden 12（12 张）无重复（去标点全等 + 双向整句包含）", () => {
    const goldenHanzi = GOLDEN_12_CARDS.map((card) => [card.cardId, stripNonHanzi(card.text)] as const);
    for (const card of PACK1_REWRITE_CARDS) {
      const text = stripNonHanzi(card.text);
      for (const [goldenId, golden] of goldenHanzi) {
        expect(text, `${card.cardId} 与 ${goldenId} 题面重复`).not.toBe(golden);
        expect(text.includes(golden), `${card.cardId} 整句吞并 ${goldenId}`).toBe(false);
        expect(golden.includes(text), `${goldenId} 整句吞并 ${card.cardId}`).toBe(false);
      }
    }
  });

  it("与既有 KEEP 5（203/205/209/227/229）无重复（去标点全等 + 双向整句包含）", () => {
    const runtimeTextById = new Map(
      [...FORMAL_TRUTH_CARDS, ...FORMAL_TRUTH_BOOTSTRAP_CARDS].map((card) => [card.cardId, card.text]),
    );
    const keepHanzi: string[] = [];
    for (const id of KEEP_5_IDS) {
      const text = runtimeTextById.get(id);
      expect(text, `KEEP ${id} 不在运行时包内，去重断言会失去依据`).toBeTruthy();
      keepHanzi.push(stripNonHanzi(text!));
    }
    for (const card of PACK1_REWRITE_CARDS) {
      const text = stripNonHanzi(card.text);
      for (let k = 0; k < KEEP_5_IDS.length; k += 1) {
        expect(text, `${card.cardId} 与 KEEP ${KEEP_5_IDS[k]} 题面重复`).not.toBe(keepHanzi[k]);
        expect(text.includes(keepHanzi[k]!), `${card.cardId} 整句吞并 KEEP ${KEEP_5_IDS[k]}`).toBe(false);
        expect(keepHanzi[k]!.includes(text), `KEEP ${KEEP_5_IDS[k]} 整句吞并 ${card.cardId}`).toBe(false);
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/* ⑥ ID 号段 + body_preference 全库 ≥2                                  */
/* ------------------------------------------------------------------ */

describe("A4c/A5⑥ ID 号段：全库扫描 0 碰撞；本批不含身体卡（body_preference = 0）", () => {
  const adapter = getV2ContentAdapter();

  it("全库（SSOT + KEEP 运行时 + 归档退役 + Golden 12 + 本批）0 collision；本批占满 244~250", () => {
    const ssotIds = [...adapter.mainlineCards, ...adapter.expansionCards].map((card) => card.cardId);
    const keepIds = [
      ...FORMAL_TRUTH_CARDS.map((card) => card.cardId),
      ...FORMAL_TRUTH_BOOTSTRAP_CARDS.map((card) => card.cardId),
    ];
    const libraryIds = [...ssotIds, ...keepIds, ...RETIRED_TRUTH_CARD_IDS, ...GOLDEN_12_CARD_IDS, ...PACK1_REWRITE_CARD_IDS];
    const report = analyzeTruthIdSpace(libraryIds);
    expect(report.collisions, report.collisions.join(",")).toEqual([]);
    expect(report.malformed, report.malformed.join(",")).toEqual([]);
    expect(report.maxTruthNumber).toBe(250);
    expect(report.suggestedNextTruthStart).toBe(251);
  });

  it("本批与归档退役卡、KEEP 运行时卡、Golden 12 无任何 ID 交集", () => {
    const mine = new Set(PACK1_REWRITE_CARD_IDS);
    for (const id of RETIRED_TRUTH_CARD_IDS) expect(mine.has(id), id).toBe(false);
    for (const id of GOLDEN_12_CARD_IDS) expect(mine.has(id), id).toBe(false);
    for (const card of [...FORMAL_TRUTH_CARDS, ...FORMAL_TRUTH_BOOTSTRAP_CARDS]) {
      expect(mine.has(card.cardId), card.cardId).toBe(false);
    }
  });

  it("body_preference：本批为 0（A5 后 250 已回退生活方式题）；Golden 12 的 ≥2 不受影响", () => {
    const goldenCoverage = goldenCategoryCoverage();
    const packCoverage = pack1CategoryCoverage();
    expect(goldenCoverage.body_preference, "Golden 12 body_preference 跌破 2（241 改后零余量）").toBeGreaterThanOrEqual(2);
    expect(packCoverage.body_preference).toBe(0);
    expect([...PACK1_REWRITE_BODY_INTIMACY_CARD_IDS]).toEqual([]);
    // 跨批不倒退：Golden 12 + 本批合计仍 ≥2。
    expect(goldenCoverage.body_preference + packCoverage.body_preference).toBeGreaterThanOrEqual(2);
  });
});

/* ------------------------------------------------------------------ */
/* ⑦ planning-only 锁 + 先不进 Formal                                   */
/* ------------------------------------------------------------------ */

describe("A4c⑦ planning-only 锁：三个设计字段未进 Runtime / GameCard 正式 schema；本批先不进 Formal", () => {
  it("gameCardSchema（GameCard 正式 schema）不含 category / followUpHook / expectedAnswerShape", () => {
    const shapeKeys = Object.keys(gameCardSchema.shape);
    for (const field of PLANNING_ONLY_FIELDS) expect(shapeKeys).not.toContain(field);
  });

  it("V2_REQUIRED_QUALITY_FIELDS 不含三个 planning 字段", () => {
    for (const field of PLANNING_ONLY_FIELDS) expect(V2_REQUIRED_QUALITY_FIELDS).not.toContain(field);
  });

  it("桥接运行时投影不转发三字段（负向锁保留）；本批卡已进运行时卡池 / manifest 两轨，且逐张满足准入四条件", () => {
    const mine = new Set(PACK1_REWRITE_CARD_IDS);
    expect(mine.size).toBe(PACK1_REWRITE_CARD_IDS.length);
    const gameCards = mainlineSsotCards();
    expect(gameCards.length).toBeGreaterThan(0);
    const ssotIds = new Set(gameCards.map((card) => card.id));
    const runtimeCards = mainlineRuntimeCards();
    expect(runtimeCards.length).toBeGreaterThan(0);
    const runtimeIds = new Set(runtimeCards.map((card) => card.cardId));
    // 正向（A9 准入后）：本批卡真在两个运行时投影里 ⇒ 下面那条「不转发三字段」自动覆盖到本批卡。
    for (const id of PACK1_REWRITE_CARD_IDS) {
      expect(ssotIds.has(id), `${id} 应已在 SSOT 卡池`).toBe(true);
      expect(runtimeIds.has(id), `${id} 应已在运行时卡池`).toBe(true);
    }
    // 负向锁（不得删）：桥接运行时投影一个 planning-only 字段都不许转发。
    for (const card of gameCards) {
      for (const field of PLANNING_ONLY_FIELDS) expect(card, card.id).not.toHaveProperty(field);
    }
    for (const card of runtimeCards) {
      for (const field of PLANNING_ONLY_FIELDS) expect(card, card.cardId).not.toHaveProperty(field);
    }
    // 正向：在 manifest 两轨，且 Formal 四条件逐张成立。
    const legacy = FIXED_CONTENT_MANIFEST.tracks.legacyCompatibility;
    const formalAllowed = new Set(FIXED_CONTENT_MANIFEST.tracks.formalFixed.allowedCardIds);
    const legacyAllowed = new Set(legacy.allowedCardIds);
    for (const id of PACK1_REWRITE_CARD_IDS) {
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
    for (const card of PACK1_REWRITE_CARDS) {
      for (const key of V13_KEYS) expect(card, `${card.cardId} 缺 ${key}`).toHaveProperty(key);
    }
  });
});

/* ------------------------------------------------------------------ */
/* ⑧ consent（偏好 ≠ 授权）                                             */
/* ------------------------------------------------------------------ */

describe("A4c/A5⑧ consent：全批可跳过；本批无身体卡 ⇒ 卡面不挂「偏好 ≠ 授权」注释", () => {
  const CARDS_SOURCE_PATH = join("lib", "v2-content", "pack1-rewrites", "pack1-rewrite-cards.ts");

  it("全批 consentMode=skip-anytime；body_preference 派生清单为空（与卡源一致）", () => {
    const expected = PACK1_REWRITE_CARDS
      .filter((card) => card.category === "body_preference")
      .map((card) => card.cardId);
    expect([...PACK1_REWRITE_BODY_INTIMACY_CARD_IDS].sort()).toEqual([...expected].sort());
    expect(PACK1_REWRITE_BODY_INTIMACY_CARD_IDS).toHaveLength(0);
    for (const card of PACK1_REWRITE_CARDS) {
      expect(card.consentMode, card.cardId).toBe("skip-anytime");
    }
  });

  it("卡面源码无 consent 注释（0 张身体卡 ⇒ 注释数必须为 0，多写即红）", () => {
    const source = readFileSync(CARDS_SOURCE_PATH, "utf8");
    const noteCommentCount = source.split("// 偏好 ≠ 授权").length - 1;
    expect(
      noteCommentCount,
      `consent 注释 ${noteCommentCount} 条 ≠ body_preference 卡 ${PACK1_REWRITE_BODY_INTIMACY_CARD_IDS.length} 张`,
    ).toBe(0);
  });
});
