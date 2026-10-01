import { describe, expect, it } from "vitest";

import { BOUNDARIES } from "@/lib/domain/constants";
import { getV2ContentAdapter } from "@/lib/v2-content/v2-content-adapter";
import {
  cardPassesBoundaryFilter,
  filterCardsByDisabledBoundaries,
  findUnknownBoundaryTags,
  isKnownBoundaryTag,
  V2_BAR_FIT,
  V2_BOUNDARY_TAG_CATALOG,
  V2_CONTENT_SEMANTIC_TAGS,
  V2_GENERIC_BOUNDARY_TAGS,
  V2_INFORMATION_GAIN,
  V2_INFORMATION_GOAL_TYPES,
  V2_INTIMACY_CLASSES,
  V2_PRECISE_BOUNDARY_TAGS,
  V2_RELATIONSHIP_PROGRESSION,
  V2_REQUIRED_QUALITY_FIELDS,
  V2_SOCIAL_ENERGY,
  V2_TOPICS,
  validateFixedCardMetadataStrict,
  validateLegacyCardQualityMetadata,
} from "@/lib/v2-content/v2-card-metadata";
import { V2_BOUNDARY_TAGS } from "@/lib/v2-content/v2-types";

const asSet = (tags: readonly string[]) => new Set(tags);

/** P1-7：本批被降级的 6 项（无直连用户开关，只作内容语义 / 风险元数据）。 */
const DEMOTED_SEMANTIC_TAGS = [
  "jealousy-possessiveness",
  "opposite-sex-friends",
  "bottom-line",
  "intimacy-attitude",
  "intimate-interaction",
  "late-night-topic",
] as const;

/** 一份 strict 合同全部必填字段齐备且合法的样本（barFit=PASS）。 */
const validStrictMetadata = (): Record<string, unknown> => ({
  topic: "恋爱观",
  barFit: "PASS",
  informationGain: "medium",
  informationGoal: "想知道你最看重伴侣的哪种品质",
  socialEnergy: "medium",
  relationshipProgression: "open",
  intimacyClass: "none",
  informationGoalType: "self_preference",
});

describe("两层校验器边界：legacy 兼容读取（fail-open）", () => {
  it("接受每个字段的全部合法枚举值（legacy）", () => {
    for (const topic of V2_TOPICS) {
      expect(validateLegacyCardQualityMetadata({ topic }).ok, `topic=${topic}`).toBe(true);
    }
    for (const barFit of V2_BAR_FIT) expect(validateLegacyCardQualityMetadata({ barFit }).ok).toBe(true);
    for (const informationGain of V2_INFORMATION_GAIN) {
      expect(validateLegacyCardQualityMetadata({ informationGain }).ok).toBe(true);
    }
    for (const socialEnergy of V2_SOCIAL_ENERGY) {
      expect(validateLegacyCardQualityMetadata({ socialEnergy }).ok).toBe(true);
    }
    for (const relationshipProgression of V2_RELATIONSHIP_PROGRESSION) {
      expect(validateLegacyCardQualityMetadata({ relationshipProgression }).ok).toBe(true);
    }
    for (const intimacyClass of V2_INTIMACY_CLASSES) {
      expect(validateLegacyCardQualityMetadata({ intimacyClass }).ok).toBe(true);
    }
    for (const informationGoalType of V2_INFORMATION_GOAL_TYPES) {
      expect(validateLegacyCardQualityMetadata({ informationGoalType }).ok, informationGoalType).toBe(true);
    }
    expect(validateLegacyCardQualityMetadata({ informationGoal: "最近坚持的一个爱好是什么" }).ok).toBe(true);
    expect(validateLegacyCardQualityMetadata({ secondaryTopics: ["恋爱观", "live_chemistry"] }).ok).toBe(true);
  });

  // 改前：validateCardQualityMetadata({}) → ok=true（fail-open 被锁死）。
  // 改后：明确指向 legacy —— 兼容读取允许缺失，这是**兼容**不是合规。
  it("legacy：空对象降级通过（兼容老卡缺字段，不是合规）", () => {
    const result = validateLegacyCardQualityMetadata({});
    expect(result.ok).toBe(true);
    expect(result.present).toEqual([]);
    expect(result.missing).toEqual([
      "topic",
      "barFit",
      "informationGain",
      "informationGoal",
      "socialEnergy",
      "relationshipProgression",
      "intimacyClass",
      "informationGoalType",
      "secondaryTopics",
    ]);
  });

  it("legacy：只补齐部分字段时，其余仍降级通过（老卡可缺）", () => {
    const result = validateLegacyCardQualityMetadata({ topic: "恋爱观", barFit: "PASS" });
    expect(result.ok).toBe(true);
    expect(result.present).toEqual(["topic", "barFit"]);
    expect(result.missing).toEqual([
      "informationGain",
      "informationGoal",
      "socialEnergy",
      "relationshipProgression",
      "intimacyClass",
      "informationGoalType",
      "secondaryTopics",
    ]);
  });

  it("legacy：出现但非法的枚举值被拒（每个字段各验一次）", () => {
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ topic: "不存在的主题" }, "topic"],
      [{ barFit: "MAYBE" }, "barFit"],
      [{ informationGain: "very-high" }, "informationGain"],
      [{ socialEnergy: "ultra" }, "socialEnergy"],
      [{ relationshipProgression: "extremely-high" }, "relationshipProgression"],
      [{ intimacyClass: "ACTION" }, "intimacyClass"],
      [{ informationGoalType: "self_xxxx" }, "informationGoalType"],
      [{ secondaryTopics: "恋爱观" }, "secondaryTopics"],
      [{ secondaryTopics: ["不存在的主题"] }, "secondaryTopics"],
      [{ topic: "" }, "topic"],
    ];
    for (const [input, field] of cases) {
      const result = validateLegacyCardQualityMetadata(input);
      expect(result.ok, JSON.stringify(input)).toBe(false);
      expect(result.issues.some((issue) => issue.startsWith(field))).toBe(true);
    }
  });

  it("legacy：informationGoal 不可为空、不可填泛化「促进了解」（Plan §3:54）", () => {
    for (const goal of ["", "   ", "促进了解", "促进了解。"]) {
      const result = validateLegacyCardQualityMetadata({ informationGoal: goal });
      expect(result.ok, JSON.stringify(goal)).toBe(false);
      expect(result.issues.some((issue) => issue.startsWith("informationGoal"))).toBe(true);
    }
  });

  it("legacy：显式 null 视为非法（只有缺失/undefined 才降级）", () => {
    const result = validateLegacyCardQualityMetadata({ topic: null });
    expect(result.ok).toBe(false);
    expect(result.missing).not.toContain("topic");
    expect(result.issues).toContain("topic 非法枚举值：null");
  });

  it("legacy：非对象输入直接失败", () => {
    for (const input of [null, undefined, 42, "topic", ["恋爱观"]]) {
      const result = validateLegacyCardQualityMetadata(input);
      expect(result.ok, String(input)).toBe(false);
      expect(result.issues).toEqual(["metadata 非对象"]);
    }
  });

  it("拒绝 intimacyClass=action 且 topic=性观念·亲密态度 的组合（Plan §3:57）", () => {
    const bad = validateLegacyCardQualityMetadata({ intimacyClass: "action", topic: "性观念·亲密态度" });
    expect(bad.ok).toBe(false);
    expect(bad.issues.some((issue) => issue.includes("intimacyClass=action"))).toBe(true);
  });

  it("允许 attitude×性观念·亲密态度 与 action×亲密边界（只有被点名的组合非法）", () => {
    expect(validateLegacyCardQualityMetadata({ intimacyClass: "attitude", topic: "性观念·亲密态度" }).ok).toBe(true);
    expect(validateLegacyCardQualityMetadata({ intimacyClass: "action", topic: "亲密边界" }).ok).toBe(true);
  });
});

describe("严格入库门禁：fixed snapshot / manifest / 新题冻结（fail-closed）", () => {
  it("strict：全字段合法 → ok=true（含可选 secondaryTopics 与否均可）", () => {
    expect(validateFixedCardMetadataStrict(validStrictMetadata()).ok).toBe(true);
    const withSecondary = {
      ...validStrictMetadata(),
      secondaryTopics: ["相处规则", "live_chemistry"],
    };
    const result = validateFixedCardMetadataStrict(withSecondary);
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("strict：缺任意一个必填字段 → ok=false（参数化遍历全部必填字段）", () => {
    // 先自证样本本身过门禁，避免样本坏掉导致假绿。
    expect(validateFixedCardMetadataStrict(validStrictMetadata()).ok).toBe(true);

    expect(V2_REQUIRED_QUALITY_FIELDS).toEqual([
      "topic",
      "barFit",
      "informationGain",
      "informationGoal",
      "socialEnergy",
      "relationshipProgression",
      "intimacyClass",
      "informationGoalType",
    ]);

    for (const field of V2_REQUIRED_QUALITY_FIELDS) {
      const input = validStrictMetadata();
      delete input[field];
      const result = validateFixedCardMetadataStrict(input);
      expect(result.ok, `缺 ${field} 应 FAIL`).toBe(false);
      expect(result.missing, `缺 ${field}`).toContain(field);
    }
  });

  it("strict：空对象必须失败（missing 非空即 FAIL，与 legacy 相反）", () => {
    const result = validateFixedCardMetadataStrict({});
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual([...V2_REQUIRED_QUALITY_FIELDS, "secondaryTopics"]);
  });

  it("strict：barFit=BORDERLINE/FAIL 不得通过（正式快照只能 PASS，Plan §3:52 / :197）", () => {
    for (const barFit of ["BORDERLINE", "FAIL"] as const) {
      const result = validateFixedCardMetadataStrict({ ...validStrictMetadata(), barFit });
      expect(result.ok, barFit).toBe(false);
      expect(result.issues.some((issue) => issue.includes("barFit")), barFit).toBe(true);
      // 是合法枚举值（不记 missing），只是不可入库。
      expect(result.missing, barFit).not.toContain("barFit");
    }
  });

  it("strict：非法枚举 / 跨字段互斥同样 FAIL（action × sexual_attitude_self_disclosure，Plan §3:58）", () => {
    const badEnum = validateFixedCardMetadataStrict({ ...validStrictMetadata(), informationGain: "very-high" });
    expect(badEnum.ok).toBe(false);

    const badCombo = validateFixedCardMetadataStrict({
      ...validStrictMetadata(),
      intimacyClass: "action",
      informationGoalType: "sexual_attitude_self_disclosure",
    });
    expect(badCombo.ok).toBe(false);
    expect(badCombo.issues.some((issue) => issue.includes("sexual_attitude_self_disclosure"))).toBe(true);
  });

  it("strict：非对象输入直接失败", () => {
    for (const input of [null, undefined, 42, "topic"]) {
      const result = validateFixedCardMetadataStrict(input);
      expect(result.ok, String(input)).toBe(false);
      expect(result.issues).toEqual(["metadata 非对象"]);
    }
  });
});

describe("枚举真源是 Plan §3（历史留痕不得混用）", () => {
  it("三个字段的精确取值逐字对齐，且旧的中文口径一律被拒", () => {
    // Plan §3 原文（docs/pm/PRODUCT_PLAN_V2.2-FIXED-CONTENT-FIRST.md）。
    expect([...V2_INFORMATION_GAIN]).toEqual(["zero", "low", "medium", "high"]);
    expect([...V2_SOCIAL_ENERGY]).toEqual(["low", "medium", "high"]);
    expect([...V2_RELATIONSHIP_PROGRESSION]).toEqual(["none", "open", "deepen", "clarify_boundary"]);
    expect([...V2_INFORMATION_GOAL_TYPES]).toEqual([
      "self_preference",
      "experience",
      "relationship_rule",
      "boundary_attitude",
      "sexual_attitude_self_disclosure",
      "live_observation",
      "action_only",
      "other",
    ]);

    // A.2 审计产物里的中文值是历史留痕，**不是** schema 真源，必须被 schema 拒绝。
    const legacyChinese: Array<[Record<string, unknown>, string]> = [
      [{ informationGain: "高" }, "informationGain"],
      [{ informationGain: "中" }, "informationGain"],
      [{ informationGain: "低" }, "informationGain"],
      [{ informationGain: "0" }, "informationGain"],
      [{ socialEnergy: "高" }, "socialEnergy"],
      [{ socialEnergy: "中" }, "socialEnergy"],
      [{ socialEnergy: "低" }, "socialEnergy"],
      [{ relationshipProgression: "高" }, "relationshipProgression"],
      [{ relationshipProgression: "中" }, "relationshipProgression"],
      [{ relationshipProgression: "低" }, "relationshipProgression"],
    ];
    for (const [input, field] of legacyChinese) {
      const result = validateLegacyCardQualityMetadata(input);
      expect(result.ok, JSON.stringify(input)).toBe(false);
      expect(result.issues.some((issue) => issue.startsWith(field))).toBe(true);
    }
  });

  it("relationshipProgression 是四值而非三值（Plan §3:56，不得折成高/中/低）", () => {
    expect(V2_RELATIONSHIP_PROGRESSION).toHaveLength(4);
    for (const value of V2_RELATIONSHIP_PROGRESSION) {
      expect(validateLegacyCardQualityMetadata({ relationshipProgression: value }).ok, value).toBe(true);
    }
  });

  it("topic 枚举 = §4 的 13 个人物主题 + live_chemistry（共 14 项）", () => {
    expect(V2_TOPICS).toHaveLength(14);
    expect(V2_TOPICS).toContain("live_chemistry");
    expect(V2_TOPICS).toContain("性观念·亲密态度");
    // 旧口径里的「无明确主题」与斜杠写法不在 Plan §3 枚举内。
    for (const legacy of ["无明确主题", "现场化学反应", "择偶偏好/吸引力", "性观念/亲密态度"]) {
      expect(validateLegacyCardQualityMetadata({ topic: legacy }).ok, legacy).toBe(false);
    }
  });
});

describe("精确雷区标签全集与过滤（V2.2 §3.1）", () => {
  it("精确关闭标签 = App 现有 10 个用户开关，逐项同名同义", () => {
    expect(V2_PRECISE_BOUNDARY_TAGS).toHaveLength(10);
    expect([...V2_PRECISE_BOUNDARY_TAGS].sort()).toEqual(BOUNDARIES.map((boundary) => boundary.tag).sort());
  });

  it("P1-7：6 项语义标签已移出精确关闭标签与雷区全集，只作内容语义/风险元数据", () => {
    expect([...V2_CONTENT_SEMANTIC_TAGS]).toEqual([...DEMOTED_SEMANTIC_TAGS]);
    for (const tag of DEMOTED_SEMANTIC_TAGS) {
      expect(V2_PRECISE_BOUNDARY_TAGS, tag).not.toContain(tag);
      expect(V2_BOUNDARY_TAG_CATALOG, tag).not.toContain(tag);
      expect(isKnownBoundaryTag(tag), tag).toBe(false);
    }
  });

  it("P1-7：语义标签不参与用户关闭过滤（不是用户可关闭项，不会被误挡）", () => {
    const semanticOnly = [...DEMOTED_SEMANTIC_TAGS] as string[];
    const allSwitchesOn = asSet(BOUNDARIES.map((boundary) => boundary.tag));
    expect(cardPassesBoundaryFilter(semanticOnly, allSwitchesOn)).toBe(true);
  });

  it("全集无重复，且覆盖既有两套枚举（扩展而非替换）", () => {
    expect(new Set(V2_BOUNDARY_TAG_CATALOG).size).toBe(V2_BOUNDARY_TAG_CATALOG.length);
    expect(V2_BOUNDARY_TAG_CATALOG.length).toBe(V2_PRECISE_BOUNDARY_TAGS.length + V2_GENERIC_BOUNDARY_TAGS.length);

    for (const tag of V2_BOUNDARY_TAGS) expect(isKnownBoundaryTag(tag), `SSOT 泛标签 ${tag}`).toBe(true);
    for (const boundary of BOUNDARIES) expect(isKnownBoundaryTag(boundary.tag), `App 开关标签 ${boundary.tag}`).toBe(true);
  });

  it("不破坏现有卡：generated 快照全部 350+40 卡在 catalog 内，legacy 降级通过、strict 明确拒绝", () => {
    const adapter = getV2ContentAdapter();
    const cards = [...adapter.mainlineCards, ...adapter.expansionCards];
    expect(cards).toHaveLength(390);
    for (const card of cards) {
      expect(findUnknownBoundaryTags(card.boundaryTags), card.cardId).toEqual([]);
      // 老卡没有新 metadata → legacy 应降级通过而不是判非法。
      expect(validateLegacyCardQualityMetadata(card).ok, card.cardId).toBe(true);
    }
    // 同一张老卡在正式入库口径下必须 FAIL（未补标不得进新正式库，Plan §3.1:64）。
    const strict = validateFixedCardMetadataStrict(cards[0]);
    expect(strict.ok).toBe(false);
    expect(strict.missing).toContain("informationGoalType");
  });

  it("多标签卡：命中任一关闭雷区即拒，全不命中则出", () => {
    const multiTagCard = ["ex-partner", "sexual-history"];
    expect(cardPassesBoundaryFilter(multiTagCard, asSet(["ex-partner"]))).toBe(false);
    expect(cardPassesBoundaryFilter(multiTagCard, asSet(["sexual-history"]))).toBe(false);
    expect(cardPassesBoundaryFilter(multiTagCard, asSet(["ex-partner", "alcohol"]))).toBe(false);
    expect(cardPassesBoundaryFilter(multiTagCard, asSet(["alcohol"]))).toBe(true);
  });

  it("关闭集合为空则全出（例：ex-partner 题在 noExPartners 未关闭时可出）", () => {
    const cards = [
      { cardId: "A", boundaryTags: [] },
      { cardId: "B", boundaryTags: ["ex-partner"] },
      { cardId: "C", boundaryTags: ["ex-partner", "sexual-history"] },
      { cardId: "D", boundaryTags: ["proximity"] },
    ];
    expect(filterCardsByDisabledBoundaries(cards, asSet([])).map((card) => card.cardId)).toEqual([
      "A",
      "B",
      "C",
      "D",
    ]);
  });

  it("关闭 ex-partner 后，所有前任相关题全部禁止出现", () => {
    const cards = [
      { cardId: "A", boundaryTags: [] },
      { cardId: "B", boundaryTags: ["ex-partner"] },
      { cardId: "C", boundaryTags: ["ex-partner", "sexual-history"] },
      { cardId: "D", boundaryTags: ["alcohol"] },
    ];
    expect(filterCardsByDisabledBoundaries(cards, asSet(["ex-partner"])).map((card) => card.cardId)).toEqual(["A", "D"]);
  });

  it("多关闭项按并集生效：命中任一用户关闭标签即拒", () => {
    const cards = [
      { cardId: "A", boundaryTags: ["alcohol"] },
      { cardId: "B", boundaryTags: ["sexual-history"] },
      { cardId: "C", boundaryTags: ["money"] },
      { cardId: "D", boundaryTags: ["phone-privacy"] },
    ];
    expect(
      filterCardsByDisabledBoundaries(cards, asSet(["alcohol", "phone-privacy"])).map((card) => card.cardId),
    ).toEqual(["B", "C"]);
  });

  it("findUnknownBoundaryTags 检出未登记标签（构建期应拒收；含已降级的语义标签）", () => {
    expect(findUnknownBoundaryTags(["ex-partner", "not-a-tag", "proximity"])).toEqual(["not-a-tag"]);
    expect(findUnknownBoundaryTags([])).toEqual([]);
    expect(isKnownBoundaryTag("not-a-tag")).toBe(false);
    // P1-7：语义标签写法已不再是雷区标签，若被塞进 boundaryTags 必须被拒收。
    expect(findUnknownBoundaryTags(["late-night-topic"])).toEqual(["late-night-topic"]);
  });
});
