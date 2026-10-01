/**
 * A5｜第一包 REPLACE 19 张换向新卡（`lib/v2-content/pack1-replaces/`）的**机器门禁**。
 *
 * 锁死十件事：
 * ① **逐卡值锁**：题面 / Heat / intensity / planning 字段，＋全部既有必填质量字段
 *    （`V2_REQUIRED_QUALITY_FIELDS`）逐卡锁死，改动即红；
 * ② **字数与句读**：题面 ≤30 个中文字（`pack1ReplaceCountHanzi` 可复算），且单句（一口气念完）；
 * ③ **结构**：`heatMin` 分布 H1≤3 / H3≥4 / H4≥3（档位张数由卡源派生，不手填）；类别覆盖达 A5 指标；
 *    **同档不同轴**（同 `heatMin` 档内内容轴互不相同）；
 * ④ **钩子当场可兑现**：每卡都有一条「旁人立刻能说出口的反问」，以「？」结尾、无需要时间的动作；
 * ⑤ **去重**：19 张互不重复，且与 Golden 12 / KEEP 5 / 第一包 REWRITE（244~250）/ 归档 19 张旧卡
 *    的题面均无重复或整句吞并；
 * ⑥ **ID 号段**：`PN-TRUTH-251~269` 连续 19 个、全库（SSOT＋KEEP 运行时＋归档退役＋Golden 12＋
 *    REWRITE 批＋本批）经 `analyzeTruthIdSpace` 扫描 0 collision，最大号 269 / 新起点 270；
 * ⑦ **planning-only 锁**：`category / followUpHook / expectedAnswerShape` **未进入**
 *    `GameCard` 正式 schema、`V2_REQUIRED_QUALITY_FIELDS`、桥接转发卡（Runtime 投影）；
 *    且本批**不进任何运行时卡池 / Formal 清单**（本单不 admission、不进 Formal）；
 * ⑧ **consent**：`body_preference` 卡（3 张）全部 `consentMode="skip-anytime"`、卡面源码逐张带
 *    「偏好 ≠ 授权」注释（删注释即红）；
 * ⑨ **`GOLDEN12-REVIEW-2.md` 的 5 条强制约束**逐条结构断言：
 *    ①同档不同轴（在 ③）②无「外观 A vs 外观 B」二元对照 ③钩子当场可兑现（在 ④）
 *    ④H4 统一 I3、禁价值倒挂（全批无 I4/I5）⑤元数据随题面同源（`category`/`topic`/`intimacyClass`/
 *    `followUpHook`/`boundaryTags` 交叉自洽）；
 * ⑩ **8 问自检的可机检部分**：无 AI 问卷 / 面试 / 咨询腔句式、无长期关系滑向词、不误触
 *    BAR-FIT 表演 / 记忆 / 安静依赖类硬失败。
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
import {
  PACK1_REPLACE_BODY_INTIMACY_CARD_IDS,
  PACK1_REPLACE_CARDS,
  PACK1_REPLACE_CARD_IDS,
  PACK1_REPLACE_CONSENT_NOTE,
} from "@/lib/v2-content/pack1-replaces/pack1-replace-cards";
import {
  PACK1_REPLACE_AXES,
  PACK1_REPLACE_CATEGORY_REQUIREMENTS,
  PACK1_REPLACE_HEAT_TIER_TARGETS,
  PACK1_REPLACE_HOOK_REDEEM_LINES,
  PACK1_REPLACE_MATRIX,
  pack1ReplaceAnswerShapeDistribution,
  pack1ReplaceAxesByHeatTier,
  pack1ReplaceCategoryCoverage,
  pack1ReplaceCategoryRequirementsMet,
  pack1ReplaceCountHanzi,
  pack1ReplaceFollowUpHookDistribution,
  pack1ReplaceHeatMinDistribution,
  pack1ReplaceIntensityDistribution,
  pack1ReplaceMatrixMarkdown,
} from "@/lib/v2-content/pack1-replaces/pack1-replace-matrix";
import { PACK1_REWRITE_CARDS, PACK1_REWRITE_CARD_IDS } from "@/lib/v2-content/pack1-rewrites/pack1-rewrite-cards";
import { analyzeTruthIdSpace, parseTruthCardNumber } from "@/lib/v2-content/card-id-space";
import { getV2ContentAdapter } from "@/lib/v2-content/v2-content-adapter";
import { FIXED_CONTENT_MANIFEST } from "@/lib/v2-content/fixed-content-manifest";
import { FORMAL_TRUTH_BOOTSTRAP_CARDS } from "@/lib/v2-content/formal-truth-bootstrap-pack";
import { FORMAL_TRUTH_CARDS } from "@/lib/v2-content/formal-truth-pack";
import {
  RETIRED_TRUTH_CARDS,
  RETIRED_TRUTH_CARD_IDS,
} from "@/lib/v2-content/archive/retired-truth-pack-2026-09-29";
import { RETIRED_PACK1_R6_CARD_IDS } from "@/lib/v2-content/archive/retired-pack1-r6-2026-09-29";
import { V2_REQUIRED_QUALITY_FIELDS, validateFixedCardMetadataStrict } from "@/lib/v2-content/v2-card-metadata";
import { mainlineRuntimeCards, mainlineSsotCards } from "@/lib/v2-content/v2-card-bridge";

const PLANNING_ONLY_FIELDS = ["category", "followUpHook", "expectedAnswerShape"] as const;

/** 既有 KEEP 5（内部风格闸对照集，本批不得与之语义重复）。 */
const KEEP_5_IDS = ["PN-TRUTH-203", "PN-TRUTH-205", "PN-TRUTH-209", "PN-TRUTH-227", "PN-TRUTH-229"] as const;

/** 本批所替换的 19 张旧卡 ID（`temp/BAR-AUDIT-PACK1-31.md` 的 REPLACE 19）；新批不得复用其 ID / 题面。 */
const OLD_REPLACE_IDS = [
  "PN-TRUTH-204", "PN-TRUTH-206", "PN-TRUTH-207", "PN-TRUTH-208", "PN-TRUTH-210",
  "PN-TRUTH-211", "PN-TRUTH-212", "PN-TRUTH-213", "PN-TRUTH-214", "PN-TRUTH-215",
  "PN-TRUTH-216", "PN-TRUTH-217", "PN-TRUTH-218", "PN-TRUTH-219", "PN-TRUTH-220",
  "PN-TRUTH-221", "PN-TRUTH-222", "PN-TRUTH-223", "PN-TRUTH-224",
] as const;

/** 去标点取纯汉字串：用于「换标点即绕过」的去重口径。 */
function stripNonHanzi(text: string): string {
  return text.replace(/[^\u4e00-\u9fff]/gu, "");
}

/**
 * A9-R6 §7.3：`attraction` 卡的 `topic` **逐卡精确真值**（⛔ 禁止 union 放宽）。
 * - `254`（更容易对哪种人上头）= `择偶偏好`；
 * - `256`（哪种搭讪最容易让你没兴趣）= `相处规则`（问「搭讪方式」的减分点＝相处/社交互动规则，非择偶）。
 * ⚠️ `256` 的 `category` 经 A7 改判为 `quick_know`，故下面另有独立精确断言锁它（不依赖 category 分桶）。
 */
const EXACT_ATTRACTION_TOPIC: Readonly<Record<string, string>> = {
  "PN-TRUTH-254": "择偶偏好",
  "PN-TRUTH-256": "相处规则",
};

/* ------------------------------------------------------------------ */
/* ① 逐卡值锁                                                          */
/* ------------------------------------------------------------------ */

describe("A5① 第一包 REPLACE 19 张逐卡值锁死", () => {
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
    "PN-TRUTH-251": {
      text: "这桌上，你第一眼先注意到的是谁？",
      intensity: 2, heatMin: 3, heatMax: 4,
      category: "flirt", followUpHook: "flirt_target", expectedAnswerShape: "short_phrase",
      topic: "live_chemistry", informationGain: "medium",
      informationGoal: "知道他在这一桌上第一眼先注意到谁",
      socialEnergy: "high", relationshipProgression: "deepen", intimacyClass: "none",
      informationGoalType: "live_observation", secondaryTopics: ["择偶偏好"],
      consentMode: "skip-anytime", boundaryTags: [],
    },
    "PN-TRUTH-252": {
      // A9-R7（2026-09-29 内容返工，RESEARCH_REVIEW-PACK1-FINAL-54 §1 252 行）：旧 C 选项
      // 「气氛一起来」与题干同义反复＝凑数选项 ⇒ C 改具体场景，三选项统一到「局的熟悉度」同轴。
      text: "哪种局你会比平时放得开：全是熟人、半熟不熟，还是谁也不认识？",
      intensity: 2, heatMin: 2, heatMax: 4,
      category: "quick_know", followUpHook: "social_style", expectedAnswerShape: "ternary",
      topic: "性格·习惯·小癖好", informationGain: "medium",
      informationGoal: "知道他在哪种熟悉度的局里会比平时更放得开",
      socialEnergy: "medium", relationshipProgression: "open", intimacyClass: "none",
      informationGoalType: "self_preference", secondaryTopics: ["生活方式"],
      consentMode: "skip-anytime", boundaryTags: [],
    },
    "PN-TRUTH-253": {
      text: "有人当场要加你微信，你会直接给、先聊聊，还是推掉？",
      intensity: 3, heatMin: 3, heatMax: 4,
      category: "flirt", followUpHook: "contact_preference", expectedAnswerShape: "ternary",
      topic: "live_chemistry", informationGain: "medium",
      informationGoal: "知道有人当场要加他微信时他会直接给、先聊聊还是推掉",
      socialEnergy: "high", relationshipProgression: "deepen", intimacyClass: "none",
      informationGoalType: "live_observation", secondaryTopics: ["择偶偏好"],
      consentMode: "skip-anytime", boundaryTags: ["social-account"],
    },
    "PN-TRUTH-254": {
      text: "你更容易对哪种人上头：让你心跳的，还是让你安心的？",
      intensity: 2, heatMin: 2, heatMax: 4,
      category: "attraction", followUpHook: "attraction", expectedAnswerShape: "binary",
      topic: "择偶偏好", informationGain: "medium",
      informationGoal: "知道他更容易对让他心跳的人还是让他安心的人上头",
      socialEnergy: "medium", relationshipProgression: "open", intimacyClass: "none",
      informationGoalType: "self_preference", secondaryTopics: ["恋爱观"],
      consentMode: "skip-anytime", boundaryTags: [],
    },
    "PN-TRUTH-255": {
      // A6（主审 §7.2）：绑现场＋指名（这桌谁最不能惹）。
      text: "这桌谁最不能惹，他惹到你，你是当场说开还是先冷一冷？",
      intensity: 2, heatMin: 2, heatMax: 3,
      category: "quick_know", followUpHook: "social_style", expectedAnswerShape: "binary",
      topic: "相处规则", informationGain: "medium",
      informationGoal: "知道这桌他最不能惹谁、被惹到时是当场说开还是先冷",
      socialEnergy: "high", relationshipProgression: "open", intimacyClass: "none",
      informationGoalType: "relationship_rule", secondaryTopics: ["性格·习惯·小癖好"],
      consentMode: "skip-anytime", boundaryTags: [],
    },
    "PN-TRUTH-256": {
      // A6（主审 §4 约束⑤ 轻度）：topic 由 择偶偏好 改 相处规则（搭讪减分属社交互动非择偶）。
      // A7（Part 2）：题面问**排斥偏好** ⇒ category 由 attraction 如实改 quick_know。
      text: "哪种搭讪最容易让你没兴趣：太油、太急，还是一本正经？",
      intensity: 2, heatMin: 2, heatMax: 4,
      // A8（Part 1，主审 Round-3 §1）：`followUpHook` 由 attraction 如实改 social_style（题面问排斥）。
      category: "quick_know", followUpHook: "social_style", expectedAnswerShape: "ternary",
      topic: "相处规则", informationGain: "medium",
      informationGoal: "知道哪种搭讪方式最容易让他没兴趣",
      socialEnergy: "high", relationshipProgression: "open", intimacyClass: "none",
      informationGoalType: "self_preference", secondaryTopics: ["性格·习惯·小癖好"],
      consentMode: "skip-anytime", boundaryTags: [],
    },
    "PN-TRUTH-257": {
      // A6（主审 §5.2＋§7.3-3）：换成「主动」骨架，断开与 Golden 238 的同骨架＋同逃逸口。
      text: "你想不想凑近谁，说句悄悄话？",
      intensity: 2, heatMin: 3, heatMax: 4,
      category: "flirt", followUpHook: "flirt_target", expectedAnswerShape: "yes_no",
      topic: "live_chemistry", informationGain: "medium",
      informationGoal: "知道他想不想凑近谁说句悄悄话",
      socialEnergy: "medium", relationshipProgression: "deepen", intimacyClass: "none",
      informationGoalType: "live_observation", secondaryTopics: ["择偶偏好"],
      consentMode: "skip-anytime", boundaryTags: [],
    },
    "PN-TRUTH-258": {
      // A6（主审 §5.2＋§7.2）：选项族由「最会说的/最安静的」换成「先夸一句 / 先自曝今晚干嘛」。
      // A7（Part 3 换题面）：把「先夸」格让给 283（283 已换角色位轴）⇒ 只留「自曝」轴。
      text: "你搭话一般怎么开：先自曝今晚干嘛，还是先抛个问题？",
      intensity: 2, heatMin: 3, heatMax: 4,
      category: "flirt", followUpHook: "flirt_target", expectedAnswerShape: "binary",
      topic: "live_chemistry", informationGain: "medium",
      informationGoal: "知道他搭话一般是先自曝今晚干嘛还是先抛个问题",
      socialEnergy: "high", relationshipProgression: "deepen", intimacyClass: "none",
      informationGoalType: "live_observation", secondaryTopics: ["择偶偏好"],
      consentMode: "skip-anytime", boundaryTags: [],
    },
    "PN-TRUTH-259": {
      // A6（主审 §4 约束⑤ 明确违反 ＋ §7.2）：topic 由 异性朋友边界 改同源合法枚举 相处规则，
      // 「异性朋友」语境移入 secondaryTopics；题面改为「异性朋友半夜发消息多久回」。
      text: "异性朋友半夜发消息，你多久回：马上、隔一会儿，还是第二天？",
      intensity: 2, heatMin: 2, heatMax: 3,
      category: "quick_know", followUpHook: "social_style", expectedAnswerShape: "ternary",
      topic: "相处规则", informationGain: "medium",
      informationGoal: "知道异性朋友半夜发消息时他多久回",
      socialEnergy: "medium", relationshipProgression: "open", intimacyClass: "none",
      informationGoalType: "self_preference", secondaryTopics: ["异性朋友边界"],
      consentMode: "skip-anytime", boundaryTags: [],
    },
    "PN-TRUTH-260": {
      // A6（主审 §5.2＋§7.2）：换轴换骨架为「吃醋时的行动」，断开与 Golden 245 的同构。
      text: "看到喜欢的人在跟别人聊，你会过去，还是忍着？",
      intensity: 2, heatMin: 3, heatMax: 4,
      category: "flirt", followUpHook: "flirt_target", expectedAnswerShape: "binary",
      topic: "live_chemistry", informationGain: "medium",
      informationGoal: "知道看到喜欢的人跟别人聊时他会过去还是忍着",
      socialEnergy: "high", relationshipProgression: "deepen", intimacyClass: "none",
      informationGoalType: "live_observation", secondaryTopics: ["吃醋·占有"],
      consentMode: "skip-anytime", boundaryTags: [],
    },
    "PN-TRUTH-261": {
      text: "现在是单身，还是已经有主了？",
      intensity: 1, heatMin: 1, heatMax: 3,
      category: "quick_know", followUpHook: "flirt_target", expectedAnswerShape: "binary",
      topic: "恋爱观", informationGain: "medium",
      informationGoal: "知道他现在的感情状态是单身还是已有伴侣",
      socialEnergy: "medium", relationshipProgression: "open", intimacyClass: "none",
      informationGoalType: "self_preference", secondaryTopics: ["生活方式"],
      consentMode: "skip-anytime", boundaryTags: [],
    },
    "PN-TRUTH-262": {
      // A7（Part 2）：followUpHook 由 attraction 如实改 social_style（旧「哭点」口径不是吸引钩）。
      // A8（Part 1，主审 Round-3 §1/§7）：题面换轴到「被一句话突然击中 / 突然安静」。
      // A9-R7（2026-09-29 内容返工，RESEARCH_REVIEW-PACK1-FINAL-54 §1 262 行）：A8 版仍偏走心抽象
      // ⇒ 按审查处方改具体、去掉抽象选项「被人夸的时候，你更吃哪种：夸到点上，还是夸得夸张？」；
      // `followUpHook=social_style` 按既有裁决保留（⛔ 不改回 attraction），兑现句随新题面同步。
      // 现役真值：category=quick_know、followUpHook=social_style、topic=性格·习惯·小癖好，无 attraction 残留。
      text: "被人夸的时候，你更吃哪种：夸到点上，还是夸得夸张？",
      intensity: 1, heatMin: 1, heatMax: 3,
      category: "quick_know", followUpHook: "social_style", expectedAnswerShape: "binary",
      topic: "性格·习惯·小癖好", informationGain: "medium",
      informationGoal: "知道他被人夸的时候更吃夸到点上的还是夸得夸张的",
      socialEnergy: "medium", relationshipProgression: "open", intimacyClass: "none",
      informationGoalType: "self_preference", secondaryTopics: ["生活方式"],
      consentMode: "skip-anytime", boundaryTags: [],
    },
    // A9-R6（2026-09-29 内容裁决）：原 `PN-TRUTH-263` 与 278 去重 ⇒ 退役，
    // 逐字归档在 lib/v2-content/archive/retired-pack1-r6-2026-09-29.ts，不再进本锁值表。
    "PN-TRUTH-264": {
      // A6（主审 §4 约束⑤ 轻度）：secondaryTopics 由 生活方式 改 相处规则（开玩笑的雷点＝相处方式）。
      // A7（Part 2）：followUpHook 由 attraction 如实改 social_style（玩笑雷点不是吸引钩）。
      text: "拿你哪一点开玩笑最容易翻车：记性、口味，还是脾气？",
      intensity: 2, heatMin: 2, heatMax: 3,
      category: "quick_know", followUpHook: "social_style", expectedAnswerShape: "ternary",
      topic: "性格·习惯·小癖好", informationGain: "medium",
      informationGoal: "知道拿他哪一点开玩笑最容易翻车",
      socialEnergy: "high", relationshipProgression: "open", intimacyClass: "none",
      informationGoalType: "self_preference", secondaryTopics: ["相处规则"],
      consentMode: "skip-anytime", boundaryTags: [],
    },
    "PN-TRUTH-265": {
      // A8（Part 1，主审 Round-3 §1/§5.2）：fuh 里唯一不点名对象 ⇒ category 降 quick_know、
      // hook 改 social_style（题面不动）；全批次 follow_up_hook 真值 10→9（仍 = 阈值 9，余量 0）。
      text: "今晚剩下的时间，你最想怎么用：再换一家、找人聊，还是回家睡？",
      intensity: 1, heatMin: 2, heatMax: 4,
      category: "quick_know", followUpHook: "social_style", expectedAnswerShape: "ternary",
      topic: "生活方式", informationGain: "medium",
      informationGoal: "知道今晚剩下的时间他最想怎么用",
      socialEnergy: "medium", relationshipProgression: "open", intimacyClass: "none",
      informationGoalType: "self_preference", secondaryTopics: ["性格·习惯·小癖好"],
      consentMode: "skip-anytime", boundaryTags: [],
    },
    "PN-TRUTH-266": {
      // A6（主审 §4 约束⑤ 轻度）：secondaryTopics 由 兴趣爱好 改 性格·习惯·小癖好（「约人」不是兴趣爱好）。
      // A9-R7（2026-09-29 内容返工，RESEARCH_REVIEW-PACK1-FINAL-54 §1 266 行）：旧三选项
      // 「收拾/家务 vs 剪头/形象 vs 约人/社交」＝拼盘、轴不统一 ⇒ 改同轴三选一（补觉/散步/看剧）。
      text: "你最近一直想抽空做的，是补觉、散步，还是看剧？",
      intensity: 1, heatMin: 1, heatMax: 3,
      category: "quick_know", followUpHook: "social_style", expectedAnswerShape: "ternary",
      topic: "生活方式", informationGain: "medium",
      informationGoal: "知道他最近一直想抽空做的是补觉、散步还是看剧",
      socialEnergy: "medium", relationshipProgression: "open", intimacyClass: "none",
      informationGoalType: "self_preference", secondaryTopics: ["性格·习惯·小癖好"],
      consentMode: "skip-anytime", boundaryTags: [],
    },
    "PN-TRUTH-267": {
      // A6（主审 §7.1 FAIL）：三项换当下可执行动作（先问一句 / 慢一点 / 抱久一点）；
      // secondaryTopics 由 性观念·亲密态度 改 相处规则。
      text: "亲密里哪样最加分：先问一句、慢一点，还是抱久一点？",
      intensity: 3, heatMin: 4, heatMax: 4,
      category: "body_preference", followUpHook: "body_preference", expectedAnswerShape: "ternary",
      topic: "亲密边界", informationGain: "medium",
      informationGoal: "知道亲密里他最看重先问一句、慢一点还是抱久一点",
      socialEnergy: "medium", relationshipProgression: "deepen", intimacyClass: "attitude",
      informationGoalType: "self_preference", secondaryTopics: ["相处规则"],
      consentMode: "skip-anytime", boundaryTags: [],
    },
    "PN-TRUTH-268": {
      // A6（主审 §4 约束⑤）：secondaryTopics 由 性观念·亲密态度 改 择偶偏好（题面是触觉部位偏好）。
      text: "喜欢的人碰你哪一下最心动：手、肩，还是头发？",
      intensity: 3, heatMin: 4, heatMax: 4,
      category: "body_preference", followUpHook: "body_preference", expectedAnswerShape: "ternary",
      topic: "亲密边界", informationGain: "medium",
      informationGoal: "知道喜欢的人碰到他哪里最让他心动",
      socialEnergy: "medium", relationshipProgression: "deepen", intimacyClass: "attitude",
      informationGoalType: "self_preference", secondaryTopics: ["择偶偏好"],
      consentMode: "skip-anytime", boundaryTags: [],
    },
    "PN-TRUTH-269": {
      // A6（主审 §4 约束⑤）：secondaryTopics 由 性观念·亲密态度 改 性格·习惯·小癖好（题面是节奏偏好）。
      // A7（Part 2 换轴）：由「节奏」换到「主动权」轴（与 267 不再撞轴），hook → initiative。
      text: "亲密里你更想当主动的那个，还是等对方先？",
      intensity: 3, heatMin: 4, heatMax: 4,
      category: "body_preference", followUpHook: "initiative", expectedAnswerShape: "binary",
      topic: "亲密边界", informationGain: "medium",
      informationGoal: "知道亲密里他更想当主动的那个还是等对方先",
      socialEnergy: "medium", relationshipProgression: "deepen", intimacyClass: "attitude",
      informationGoalType: "self_preference", secondaryTopics: ["性格·习惯·小癖好"],
      consentMode: "skip-anytime", boundaryTags: [],
    },
  };

  it("现役张数由卡源派生（A9-R6 退役 263 后为 18）；ID 落在 251~269 号段且唯一", () => {
    expect(PACK1_REPLACE_CARDS.length).toBe(PACK1_REPLACE_CARD_IDS.length);
    expect(PACK1_REPLACE_CARDS.length).toBeGreaterThan(0);
    expect(new Set(PACK1_REPLACE_CARD_IDS).size).toBe(PACK1_REPLACE_CARD_IDS.length);
    for (const card of PACK1_REPLACE_CARDS) {
      const number = parseTruthCardNumber(card.cardId);
      expect(number, card.cardId).not.toBeNull();
      expect(number!, card.cardId).toBeGreaterThanOrEqual(251);
      expect(number!, card.cardId).toBeLessThanOrEqual(269);
      expect(card.number, card.cardId).toBe(number);
      expect(card.gameType, card.cardId).toBe("truth");
      // 新批必须新开 ID：既不与所替换的旧卡同号，也不与归档卡（A3 26 / A9-R6 3）同号。
      expect(OLD_REPLACE_IDS as readonly string[], card.cardId).not.toContain(card.cardId);
      expect(RETIRED_TRUTH_CARD_IDS, card.cardId).not.toContain(card.cardId);
      expect(RETIRED_PACK1_R6_CARD_IDS, card.cardId).not.toContain(card.cardId);
    }
    // A9-R6：263 已退役（号段内缺，不再回卡源）。
    expect(PACK1_REPLACE_CARD_IDS).not.toContain("PN-TRUTH-263");
    expect(RETIRED_PACK1_R6_CARD_IDS).toContain("PN-TRUTH-263");
  });

  it("逐卡锁值：题面 / Heat / intensity / planning 字段 / 全部必填质量字段与冻结表一致", () => {
    expect(Object.keys(LOCKED).sort()).toEqual([...PACK1_REPLACE_CARD_IDS].sort());
    for (const card of PACK1_REPLACE_CARDS) {
      expect(card, card.cardId).toMatchObject(LOCKED[card.cardId]!);
    }
  });

  it("逐卡 strict 门禁：8 项必填质量字段零缺失、barFit=PASS、枚举合法", () => {
    for (const card of PACK1_REPLACE_CARDS) {
      const strict = validateFixedCardMetadataStrict(card);
      expect(strict.ok, `${card.cardId} strict：${strict.issues.join("；")}`).toBe(true);
      expect(card.barFit, card.cardId).toBe("PASS");
    }
  });
});

/* ------------------------------------------------------------------ */
/* ② 字数与句读                                                        */
/* ------------------------------------------------------------------ */

describe("A5② 字数与句读：题面 ≤30 个中文字且一口气念完（单句）", () => {
  it("逐卡 pack1ReplaceCountHanzi ≤ 30，且无一空题面", () => {
    for (const card of PACK1_REPLACE_CARDS) {
      const hanzi = pack1ReplaceCountHanzi(card.text);
      expect(hanzi, `${card.cardId}「${card.text}」= ${hanzi} 中文字`).toBeLessThanOrEqual(30);
      expect(card.text.length, card.cardId).toBeGreaterThan(0);
    }
  });

  it("逐卡单句：题面不含句中句末标点「。；！」，且恰以「？」收尾（一口气念完）", () => {
    for (const card of PACK1_REPLACE_CARDS) {
      expect(card.text, `${card.cardId} 含句末标点「。；！」`).not.toMatch(/[。；！]/u);
      expect((card.text.match(/？/gu) ?? []).length, `${card.cardId} 不是单一问句`).toBe(1);
      expect(card.text.endsWith("？"), `${card.cardId} 题面未以「？」收尾`).toBe(true);
      // 「前置状语 ＋ 二选一」＝ 两小句（Golden 233「微醺之后，你是……，还是……」同款句式）；
      // 破折点上限 2 个逗号，≥3 即判多层条件。
      const commaCount = (card.text.match(/，/gu) ?? []).length;
      expect(commaCount, `${card.cardId} 逗号 ${commaCount} 个，疑似多层条件`).toBeLessThanOrEqual(2);
    }
  });

  it("矩阵行字数与 pack1ReplaceCountHanzi 复算一致（矩阵不手填）", () => {
    for (const row of PACK1_REPLACE_MATRIX) {
      expect(row.hanziCount, row.cardId).toBe(pack1ReplaceCountHanzi(row.text));
    }
  });
});

/* ------------------------------------------------------------------ */
/* ③ 结构：热档目标 + 类别覆盖 + 同档不同轴                              */
/* ------------------------------------------------------------------ */

describe("A5③ 结构：H1≤3 / H3≥4 / H4≥3 + 类别覆盖达标 + 同档不同轴", () => {
  it("heatMin 分布＝逐卡独立复算的结果，且满足 A5 热档目标（H1≤3 / H3≥4 / H4≥3）", () => {
    const fromCards = pack1ReplaceHeatMinDistribution();
    const fromLock: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const card of PACK1_REPLACE_CARDS) {
      expect(card.heatMin, card.cardId).toBeGreaterThanOrEqual(1);
      expect(card.heatMin, card.cardId).toBeLessThanOrEqual(4);
      expect(card.heatMax, card.cardId).toBeGreaterThanOrEqual(card.heatMin);
      expect(card.heatMax, card.cardId).toBeLessThanOrEqual(4);
      expect(card.intensity, card.cardId).toBeGreaterThanOrEqual(1);
      expect(card.intensity, card.cardId).toBeLessThanOrEqual(5);
      fromLock[card.heatMin] = (fromLock[card.heatMin] ?? 0) + 1;
    }
    expect(fromCards).toEqual(fromLock);
    for (const tier of [1, 2, 3, 4]) {
      expect(fromCards[tier], `H${tier} 无卡，未覆盖 H1~H4`).toBeGreaterThan(0);
    }
    expect(fromCards[1], "H1 应少（补库存主力在 H3/H4）").toBeLessThanOrEqual(
      PACK1_REPLACE_HEAT_TIER_TARGETS.h1Max,
    );
    expect(fromCards[3], "H3 未达 ≥4").toBeGreaterThanOrEqual(PACK1_REPLACE_HEAT_TIER_TARGETS.h3Min);
    expect(fromCards[4], "H4 未达 ≥3").toBeGreaterThanOrEqual(PACK1_REPLACE_HEAT_TIER_TARGETS.h4Min);
  });

  it("类别覆盖（本批自查）达标：quick_know≥1 / attraction≥1 / flirt≥5 / body_preference≥3", () => {
    const { ok, gaps } = pack1ReplaceCategoryRequirementsMet();
    expect(gaps, gaps.join("；")).toEqual([]);
    expect(ok).toBe(true);
    const coverage = pack1ReplaceCategoryCoverage();
    expect(coverage.quick_know).toBeGreaterThanOrEqual(PACK1_REPLACE_CATEGORY_REQUIREMENTS.quick_know);
    expect(coverage.attraction).toBeGreaterThanOrEqual(PACK1_REPLACE_CATEGORY_REQUIREMENTS.attraction);
    expect(coverage.flirt).toBeGreaterThanOrEqual(PACK1_REPLACE_CATEGORY_REQUIREMENTS.flirt);
    expect(coverage.body_preference).toBeGreaterThanOrEqual(
      PACK1_REPLACE_CATEGORY_REQUIREMENTS.body_preference,
    );
    // A9-R6 §4.7：`follow_up_hook` 数量**退出放行门**（降级为诊断基线），本批不再有该阈值项；
    // 覆盖数字仍派生可读（不作断言门槛）。
    expect(coverage.follow_up_hook).toBeGreaterThan(0);
    // A7：`256` 改 `quick_know` 后，本批 `attraction` 的**卡面 category 真值**只剩 254（= 1），
    // 目标随之为 1（重叠口径为 2，因 256 的 hook 仍是 attraction）；**全批次** `attraction` 真值 ≥4
    // 由真值口径把关（见 pack1-supplements.test.ts 的 `pack1UnionCategoryTruthRequirementsMet`）。
    expect(PACK1_REPLACE_CATEGORY_REQUIREMENTS.attraction).toBe(1);
  });

  it("同档不同轴：同一 heatMin 档内内容轴互不相同（约束①）", () => {
    const tiers = pack1ReplaceAxesByHeatTier();
    for (const [tier, axes] of Object.entries(tiers)) {
      for (const axis of axes) expect(axis, `H${tier} 有卡缺轴标签`).not.toBe("");
      expect(new Set(axes).size, `H${tier} 同档重复轴：${axes.join(" / ")}`).toBe(axes.length);
    }
    expect(Object.keys(PACK1_REPLACE_AXES).sort()).toEqual([...PACK1_REPLACE_CARD_IDS].sort());
  });

  it("followUpHook / expectedAnswerShape 分布由卡源派生且各值合法（无卡落在枚举外）", () => {
    const hookDist = pack1ReplaceFollowUpHookDistribution();
    const shapeDist = pack1ReplaceAnswerShapeDistribution();
    expect(Object.values(hookDist).reduce((sum, count) => sum + count, 0)).toBe(PACK1_REPLACE_CARDS.length);
    expect(Object.values(shapeDist).reduce((sum, count) => sum + count, 0)).toBe(PACK1_REPLACE_CARDS.length);
    expect(hookDist.none, "本批不应有 none 空钩子卡").toBe(0);
  });

  it("intensity 与价值不倒挂：无 I4/I5，且 H4 档统一 I3（约束④）", () => {
    const intensityDist = pack1ReplaceIntensityDistribution();
    expect(intensityDist[4]).toBe(0);
    expect(intensityDist[5]).toBe(0);
    const h4 = PACK1_REPLACE_CARDS.filter((card) => card.heatMin === 4);
    expect(h4.length).toBeGreaterThanOrEqual(PACK1_REPLACE_HEAT_TIER_TARGETS.h4Min);
    for (const card of h4) expect(card.intensity, card.cardId).toBe(3);
    // H4 档同时也是本批的身体 / 亲密档（无 I4/I5 挂在弱信息题上）。
    for (const card of h4) expect(card.category, card.cardId).toBe("body_preference");
  });

  it("矩阵 Markdown 含全部 19 个 cardId（报告可直接引用，不手抄）", () => {
    const markdown = pack1ReplaceMatrixMarkdown();
    for (const id of PACK1_REPLACE_CARD_IDS) expect(markdown).toContain(id);
  });

  it("A8/A9-R7：改动卡的兑现句必须与**新题面同源**（Round-3 §10.3 第 2 条）", () => {
    // 262：A9-R7 换轴到「被夸的偏好（夸到点上 / 夸得夸张）」后，兑现句同步改为当场真夸一句；
    // ⛔ 无任何旧「哭点 / 安静 / 气 / attraction」口径残留（既有裁决 followUpHook=social_style 不变）。
    const line262 = PACK1_REPLACE_HOOK_REDEEM_LINES["PN-TRUTH-262"]!;
    expect(line262).toContain("夸");
    expect(line262).not.toContain("安静");
    expect(line262).not.toContain("哭");
    expect(line262).not.toContain("没说出口");
    // 256：兑现句仍与新题面同源（题面「太油 / 太急」）。
    const line256 = PACK1_REPLACE_HOOK_REDEEM_LINES["PN-TRUTH-256"]!;
    expect(line256.includes("太油") || line256.includes("太急")).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* ④ 钩子当场可兑现                                                     */
/* ------------------------------------------------------------------ */

describe("A5④ 钩子当场可兑现：每卡一条立刻能说出口的反问（约束③）", () => {
  const TIME_DEPENDENT = ["以后", "下次", "回头", "观察一下", "过两天", "等一等"] as const;

  it("逐卡有兑现句、以「？」结尾、≤30 字、不含需要时间的动作", () => {
    expect(Object.keys(PACK1_REPLACE_HOOK_REDEEM_LINES).sort()).toEqual([...PACK1_REPLACE_CARD_IDS].sort());
    for (const card of PACK1_REPLACE_CARDS) {
      const line = PACK1_REPLACE_HOOK_REDEEM_LINES[card.cardId];
      expect(line, `${card.cardId} 缺当场兑现句`).toBeTruthy();
      expect(line!.endsWith("？"), `${card.cardId} 兑现句不是一句反问：${line}`).toBe(true);
      expect(pack1ReplaceCountHanzi(line!), card.cardId).toBeLessThanOrEqual(30);
      for (const bad of TIME_DEPENDENT) {
        expect(line!.includes(bad), `${card.cardId} 兑现句含需要时间的动作「${bad}」：${line}`).toBe(false);
      }
      expect(card.followUpHook, card.cardId).not.toBe("none");
    }
  });
});

/* ------------------------------------------------------------------ */
/* ⑤ 去重（批内 / Golden 12 / KEEP 5 / REWRITE 批 / 归档旧卡）            */
/* ------------------------------------------------------------------ */

describe("A5⑤ 去重：批内互不重复，且与 Golden 12 / KEEP 5 / 244~250 / 归档旧卡无重复", () => {
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
    const hanzi = PACK1_REPLACE_CARDS.map((card) => stripNonHanzi(card.text));
    expect(new Set(hanzi).size).toBe(PACK1_REPLACE_CARDS.length);
    for (let i = 0; i < hanzi.length; i += 1) {
      for (let j = 0; j < hanzi.length; j += 1) {
        if (i === j) continue;
        expect(
          hanzi[i]!.includes(hanzi[j]!),
          `${PACK1_REPLACE_CARD_IDS[i]} 整句吞并 ${PACK1_REPLACE_CARD_IDS[j]}`,
        ).toBe(false);
      }
    }
  });

  it("与 Golden 12（12 张）无重复", () => {
    const golden = GOLDEN_12_CARDS.map((card) => [card.cardId, stripNonHanzi(card.text)] as const);
    for (const card of PACK1_REPLACE_CARDS) {
      assertNoOverlap(stripNonHanzi(card.text), card.cardId, golden, "Golden 12");
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
    for (const card of PACK1_REPLACE_CARDS) {
      assertNoOverlap(stripNonHanzi(card.text), card.cardId, keep, "KEEP 5");
    }
  });

  it("与第一包 REWRITE（244~250 号段，A9-R7 后现役 6 张）无重复", () => {
    const rewrites = PACK1_REWRITE_CARDS.map((card) => [card.cardId, stripNonHanzi(card.text)] as const);
    expect(PACK1_REWRITE_CARD_IDS).toHaveLength(PACK1_REWRITE_CARDS.length);
    for (const card of PACK1_REPLACE_CARDS) {
      assertNoOverlap(stripNonHanzi(card.text), card.cardId, rewrites, "第一包 REWRITE 现役 6 张");
    }
  });

  it("与归档 19 张旧卡无重复（禁止照搬旧题面）", () => {
    const retiredTextById = new Map(RETIRED_TRUTH_CARDS.map((entry) => [entry.cardId, entry.card.text]));
    const retired: Array<readonly [string, string]> = OLD_REPLACE_IDS.map((id) => {
      const text = retiredTextById.get(id);
      expect(text, `归档里没有旧卡 ${id}，去重断言会失去依据`).toBeTruthy();
      return [id, stripNonHanzi(text!)] as const;
    });
    for (const card of PACK1_REPLACE_CARDS) {
      assertNoOverlap(stripNonHanzi(card.text), card.cardId, retired, "归档 19 张旧卡");
    }
  });
});

/* ------------------------------------------------------------------ */
/* ⑥ ID 号段                                                            */
/* ------------------------------------------------------------------ */

describe("A5⑥ ID 号段：全库扫描 0 碰撞；最大号 269 / 新起点 270（A6 补卡另批，见 pack1-supplements.test.ts）", () => {
  const adapter = getV2ContentAdapter();

  it("全库（SSOT + KEEP 运行时 + 归档退役 + Golden 12 + REWRITE 批 + 本批）0 collision", () => {
    // ⚠️ 本断言的扫描集合**不含 A6 补卡批**（`PN-TRUTH-270~283`）：补卡不改变本批占位（251~269），
    // 但其落地后「全库最大号」已从 269 变为 283 ⇒ 全库口径的真源在 `card-id-space.test.ts` 与
    // `pack1-supplements.test.ts`，本处只锁「本批 + 既有批」这一段连续、无洞、无碰撞。
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
    ];
    const report = analyzeTruthIdSpace(libraryIds);
    expect(report.collisions, report.collisions.join(",")).toEqual([]);
    expect(report.malformed, report.malformed.join(",")).toEqual([]);
    // 最高号 / 新起点由扫描集派生（含 A9-R6 退役 236/263/277 ⇒ 最高号不再是本批的 269）。
    const scanned = libraryIds
      .map((id) => parseTruthCardNumber(id))
      .filter((n): n is number => n !== null);
    const maxScanned = Math.max(...scanned);
    expect(report.maxTruthNumber).toBe(maxScanned);
    expect(report.suggestedNextTruthStart).toBe(maxScanned + 1);
  });

  it("本批与归档退役卡（A3 26 ＋ A9-R6 3）、KEEP 运行时卡、Golden、REWRITE 批无任何 ID 交集", () => {
    const mine = new Set(PACK1_REPLACE_CARD_IDS);
    for (const id of [...RETIRED_TRUTH_CARD_IDS, ...RETIRED_PACK1_R6_CARD_IDS]) {
      expect(mine.has(id), id).toBe(false);
    }
    for (const id of GOLDEN_12_CARD_IDS) expect(mine.has(id), id).toBe(false);
    for (const id of PACK1_REWRITE_CARD_IDS) expect(mine.has(id), id).toBe(false);
    for (const card of [...FORMAL_TRUTH_CARDS, ...FORMAL_TRUTH_BOOTSTRAP_CARDS]) {
      expect(mine.has(card.cardId), card.cardId).toBe(false);
    }
  });
});

/* ------------------------------------------------------------------ */
/* ⑦ planning-only 锁 + 不进 Formal                                     */
/* ------------------------------------------------------------------ */

describe("A5⑦ planning-only 锁：三个设计字段未进 Runtime / GameCard 正式 schema；本批不进 Formal", () => {
  it("gameCardSchema（GameCard 正式 schema）不含 category / followUpHook / expectedAnswerShape", () => {
    const shapeKeys = Object.keys(gameCardSchema.shape);
    for (const field of PLANNING_ONLY_FIELDS) expect(shapeKeys).not.toContain(field);
  });

  it("V2_REQUIRED_QUALITY_FIELDS 不含三个 planning 字段", () => {
    for (const field of PLANNING_ONLY_FIELDS) expect(V2_REQUIRED_QUALITY_FIELDS).not.toContain(field);
  });

  it("桥接运行时投影不转发三字段（负向锁保留）；本批卡已进运行时卡池 / manifest 两轨，且逐张满足准入四条件", () => {
    const mine = new Set(PACK1_REPLACE_CARD_IDS);
    expect(mine.size).toBe(PACK1_REPLACE_CARD_IDS.length);
    const gameCards = mainlineSsotCards();
    expect(gameCards.length).toBeGreaterThan(0);
    const ssotIds = new Set(gameCards.map((card) => card.id));
    const runtimeCards = mainlineRuntimeCards();
    expect(runtimeCards.length).toBeGreaterThan(0);
    const runtimeIds = new Set(runtimeCards.map((card) => card.cardId));
    // 正向（A9 准入后）：本批卡真在两个运行时投影里 ⇒ 下面那条「不转发三字段」自动覆盖到本批卡。
    for (const id of PACK1_REPLACE_CARD_IDS) {
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
    for (const id of PACK1_REPLACE_CARD_IDS) {
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
    for (const card of PACK1_REPLACE_CARDS) {
      for (const key of V13_KEYS) expect(card, `${card.cardId} 缺 ${key}`).toHaveProperty(key);
    }
  });
});

/* ------------------------------------------------------------------ */
/* ⑧ consent（偏好 ≠ 授权）                                             */
/* ------------------------------------------------------------------ */

describe("A5⑧ consent：body_preference 卡可跳过且卡面带「偏好 ≠ 授权」注释", () => {
  const CARDS_SOURCE_PATH = join("lib", "v2-content", "pack1-replaces", "pack1-replace-cards.ts");

  it("全批 consentMode=skip-anytime；body_preference 派生清单 = 267/268/269", () => {
    const expected = PACK1_REPLACE_CARDS
      .filter((card) => card.category === "body_preference")
      .map((card) => card.cardId);
    expect([...PACK1_REPLACE_BODY_INTIMACY_CARD_IDS].sort()).toEqual([...expected].sort());
    expect([...PACK1_REPLACE_BODY_INTIMACY_CARD_IDS].sort()).toEqual([
      "PN-TRUTH-267",
      "PN-TRUTH-268",
      "PN-TRUTH-269",
    ]);
    for (const card of PACK1_REPLACE_CARDS) {
      expect(card.consentMode, card.cardId).toBe("skip-anytime");
    }
  });

  it("consent 注释常量写明「偏好 ≠ 授权 / 独立同意 / skip-anytime」", () => {
    expect(PACK1_REPLACE_CONSENT_NOTE).toContain("偏好 ≠ 授权");
    expect(PACK1_REPLACE_CONSENT_NOTE).toContain("独立同意");
    expect(PACK1_REPLACE_CONSENT_NOTE).toContain("skip-anytime");
  });

  it("卡面源码逐张 body_preference 卡带一行 consent 注释（删注释即红）", () => {
    const source = readFileSync(CARDS_SOURCE_PATH, "utf8");
    const noteCommentCount = source.split("// 偏好 ≠ 授权").length - 1;
    expect(
      noteCommentCount,
      `consent 注释 ${noteCommentCount} 条 ≠ body_preference 卡 ${PACK1_REPLACE_BODY_INTIMACY_CARD_IDS.length} 张`,
    ).toBe(PACK1_REPLACE_BODY_INTIMACY_CARD_IDS.length);
    expect(source).toContain("偏好 ≠ 授权，后续动作需独立同意");
  });

  it("安全红线：题面不露骨、不盘问性经历、不写成接触授权", () => {
    const FORBIDDEN = ["脱", "裸", "性经历", "第一次做", "上床", "睡过", "授权你碰", "随便摸"] as const;
    for (const card of PACK1_REPLACE_CARDS) {
      for (const word of FORBIDDEN) {
        expect(card.text.includes(word), `${card.cardId} 命中露骨/盘问词「${word}」`).toBe(false);
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/* ⑨ 5 条强制约束（`temp/GOLDEN12-REVIEW-2.md` §5.3）                    */
/* ------------------------------------------------------------------ */

describe("A5⑨ 5 条强制约束：同档不同轴 / 无外观二元对照 / 钩子兑现 / H4 统一 I3 / 元数据同源", () => {
  /** 约束②：Golden 235/236 已占用的外观评价轴，后续批次不得再出现（也不得出现两条外观词对照）。 */
  const APPEARANCE_AXIS_WORDS = ["穿着", "打扮", "长相", "颜值", "外貌", "外表", "身材"] as const;

  it("约束②：无「外观 A vs 外观 B」型二元对照（外观评价词在本批 0 命中）", () => {
    for (const card of PACK1_REPLACE_CARDS) {
      const hits = APPEARANCE_AXIS_WORDS.filter((word) => card.text.includes(word));
      expect(hits, `${card.cardId} 命中外观轴词：${hits.join(" / ")}（约束②禁止外观二元对照）`).toEqual([]);
    }
    // 身体部位偏好（268 的「手 / 肩 / 头发」）属 Golden 242/243 同族的身体偏好轴，不是外观评价轴，故不在此列。
    const c268 = PACK1_REPLACE_CARDS.find((card) => card.cardId === "PN-TRUTH-268");
    expect(c268?.text, "268 应仍是部位偏好题（与约束②的例外口径对应）").toContain("头发");
  });

  it("约束⑤：元数据随题面同源（category / topic / intimacyClass / hook / boundaryTags 交叉自洽）", () => {
    for (const card of PACK1_REPLACE_CARDS) {
      if (card.category === "body_preference") {
        // 身体 / 亲密卡：H4 + attitude + 亲密类主题 + 可跳过 consent。
        expect(card.heatMin, card.cardId).toBe(4);
        expect(card.intimacyClass, card.cardId).toBe("attitude");
        expect(["亲密边界", "性观念·亲密态度"], card.cardId).toContain(card.topic);
        expect(card.consentMode, card.cardId).toBe("skip-anytime");
      } else {
        // 非身体卡不得蹭亲密类元数据（241 反面教材：只换皮不换骨）。
        expect(card.intimacyClass, card.cardId).toBe("none");
        expect(card.topic, card.cardId).not.toBe("性观念·亲密态度");
      }
      if (card.followUpHook === "body_preference") {
        expect(card.category, card.cardId).toBe("body_preference");
      }
      if (card.category === "flirt") {
        // 暧昧卡是对**眼前现场**的即时反应，不是长期关系评估。
        expect(card.topic, card.cardId).toBe("live_chemistry");
        expect(card.relationStage, card.cardId).toBe("signal");
        expect(card.informationGoalType, card.cardId).toBe("live_observation");
        expect(card.relationshipProgression, card.cardId).toBe("deepen");
      }
      if (card.category === "attraction") {
        // A9-R6 §7.3：attraction 卡的 `topic` **逐卡精确断言**（⛔ 不用 union 放宽——
        // union 会让 topic 被误改回旧值时测试不红）。
        const expectedTopic = EXACT_ATTRACTION_TOPIC[card.cardId];
        expect(expectedTopic, `${card.cardId} 缺精确 topic 期望（禁止 union 放宽）`).toBeDefined();
        expect(card.topic, card.cardId).toBe(expectedTopic);
        expect(card.relationStage, card.cardId).toBe("know");
      }
      // 题面真实谈「加微信」⇒ 必须带精确开关标签（Plan §3.1「题面真实命中才写」）。
      if (card.text.includes("微信")) {
        expect(card.boundaryTags, card.cardId).toContain("social-account");
      }
      // 题面没谈账号交换的，不得挂该标签。
      if (!card.text.includes("微信")) {
        expect(card.boundaryTags, card.cardId).not.toContain("social-account");
      }
      // informationGoal 必须与题面同源（不得出现「性观念」类词挂在非亲密题上）。
      if (!card.text.includes("亲密") && !card.text.includes("碰")) {
        expect(card.informationGoal, card.cardId).not.toContain("亲密");
      }
    }
  });

  it("§7.3：256 topic 精确 = 相处规则；254 topic 精确 = 择偶偏好（⛔ 不用 union 放宽）", () => {
    const byId = new Map(PACK1_REPLACE_CARDS.map((card) => [card.cardId, card]));
    const c254 = byId.get("PN-TRUTH-254")!;
    const c256 = byId.get("PN-TRUTH-256")!;
    expect(c254.topic, "254 真值").toBe("择偶偏好");
    expect(c256.topic, "256 真值").toBe("相处规则");
    // 显式反证：union 口径若被写回（{择偶偏好, 相处规则}）会同时放过两种值 ⇒ 本断言按精确值锁。
    expect(EXACT_ATTRACTION_TOPIC["PN-TRUTH-254"]).toBe("择偶偏好");
    expect(EXACT_ATTRACTION_TOPIC["PN-TRUTH-256"]).toBe("相处规则");
    expect(c256.topic, "256 不得被误改回旧值 择偶偏好").not.toBe("择偶偏好");
  });
});

/* ------------------------------------------------------------------ */
/* ⑩ 8 问自检的可机检部分                                              */
/* ------------------------------------------------------------------ */

describe("A5⑩ 8 问自检（可机检部分）：无 AI 腔 / 无长期关系滑向 / 不误触 BAR-FIT 硬失败", () => {
  /** 问 7：AI 问卷 / 面试 / 心理咨询腔句式。 */
  const AI_SURVEY_PATTERNS = ["说说", "为什么", "当时", "举一个", "各占几成", "几成", "哪三段", "最近一次", "真发生过"] as const;
  /** 问 8：长期关系滑向（Human 冻结的四类退出项关键词）。 */
  const LONG_TERM_PATTERNS = ["前任", "上一段", "长期", "五年", "结婚", "未来", "人生", "理想生活", "伴侣"] as const;

  it("无 AI 问卷 / 面试 / 咨询腔句式（问 7）", () => {
    for (const card of PACK1_REPLACE_CARDS) {
      for (const pattern of AI_SURVEY_PATTERNS) {
        expect(card.text.includes(pattern), `${card.cardId} 命中 AI/问卷腔句式「${pattern}」`).toBe(false);
      }
    }
  });

  it("无长期关系 / 前任 / 人生规划滑向（问 8）", () => {
    for (const card of PACK1_REPLACE_CARDS) {
      for (const pattern of LONG_TERM_PATTERNS) {
        expect(card.text.includes(pattern), `${card.cardId} 命中长期关系/退出类词「${pattern}」`).toBe(false);
      }
    }
  });

  it("不误触 BAR-FIT 表演 / 记忆 / 安静依赖类硬失败（机器预筛无 HARD_FAIL_PATTERN）", () => {
    const hardFailTexts = PACK1_REPLACE_CARDS.filter(
      (card) => judgeBarFit({ cardId: card.cardId, text: card.text }).machineVerdict === "HARD_FAIL_PATTERN",
    ).map((card) => `${card.cardId}「${card.text}」`);
    expect(hardFailTexts, `命中硬失败题面：${hardFailTexts.join(" / ")}`).toEqual([]);
  });
});
