/**
 * A3 / A4a｜第一包 Heat metadata 逐字照 reviewer 表落地（只改 `heatMin` / `heatMax`）。
 *
 * Human 2026-09-28 冻结口径：`Heat` = 关系聊到多深、`Intensity` = 用户接受多大尺度，**两者正交**；
 * 不得因为「当前真实 UI Heat 恒 H1、深关系题抽不到」就把深关系题标成 H1；`heatMax` 也必须诚实，
 * 禁止为了库存统一拉 4。
 *
 * 本文件的期望值**全部来自 reviewer 逐卡判定表**（原文转录于 `temp/HEAT-REVIEW-PACK1.md`，
 * 但 `temp/` 不入仓，故在这里固化为显式期望对象，**测试绝不读 `temp/`**）。
 *
 * ⚠️ A4a 更新（2026-09-29）：第一包 24 张里只有 KEEP 3（203/205/209）仍在运行时卡源，
 * 其余 21 张已**移出运行时内容源**、逐字归档在
 * `lib/v2-content/archive/retired-truth-pack-2026-09-29.ts`。
 * 本文件因此逐卡锁**完整历史 24 张**（运行时 3 + 归档 21），证明退役版本一字未改、指纹可复算。
 *
 * 锁死四件事：
 * ① 逐卡 `heatMin`/`heatMax` 与 reviewer 表**逐字一致**（24/24），且 `heatMin <= heatMax` 成立；
 * ② 分布与 reviewer 汇总逐项对齐（Heat 分布变化是**预期结果**，不是回归）；
 * ③ **非 Heat 字段一字未改**：以「去掉 `heatMin`/`heatMax` 后的整卡 sha256 指纹」对照落地前快照；
 * ④ 两个口径的「抽得到 / 抽不到」如实呈现（桶内 Formal 集合一律用 `formalFixedIdSet()` 判定）。
 */

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { createDeckRouter } from "@/lib/engine/v2-deal";
import { RETIRED_TRUTH_CARDS } from "@/lib/v2-content/archive/retired-truth-pack-2026-09-29";
import { formalFixedIdSet } from "@/lib/v2-content/fixed-content-manifest";
import { FORMAL_TRUTH_BOOTSTRAP_CARDS } from "@/lib/v2-content/formal-truth-bootstrap-pack";
import { FORMAL_TRUTH_CARDS, type FormalTruthCard } from "@/lib/v2-content/formal-truth-pack";
import { PACK1_ADMISSION_CARDS } from "@/lib/v2-content/pack1-admission";
import { mainlineRuntimeCards, mainlineSsotCards, V2_MAINLINE_PACK_IDS } from "@/lib/v2-content/v2-card-bridge";
import { createV2MainlineRouter } from "@/lib/v2-relationship/v2-router";
import type { V2RouterInput } from "@/lib/v2-relationship/v2-session";
import {
  createInitialRelationshipState,
  pairKey,
  type Heat,
  type RelationshipState,
  type SessionParticipant,
} from "@/lib/v2-relationship/v2-state";

/* ------------------------------------------------------------------ */
/* 期望值①：reviewer 逐卡表（transcript，唯一数据来源）                     */
/* ------------------------------------------------------------------ */

/** reviewer「建议 min / 建议 max」逐卡原值（24 行，一字不改；205 为 2026-09-29 单卡复核后的落地值）。 */
const REVIEWER_HEAT: Readonly<Record<string, readonly [number, number]>> = {
  "PN-TRUTH-201": [1, 3],
  "PN-TRUTH-202": [1, 4],
  "PN-TRUTH-203": [1, 3],
  "PN-TRUTH-204": [2, 3],
  "PN-TRUTH-205": [1, 3],
  "PN-TRUTH-206": [2, 3],
  "PN-TRUTH-207": [2, 4],
  "PN-TRUTH-208": [2, 4],
  "PN-TRUTH-209": [2, 4],
  "PN-TRUTH-210": [2, 4],
  "PN-TRUTH-211": [3, 4],
  "PN-TRUTH-212": [3, 4],
  "PN-TRUTH-213": [3, 4],
  "PN-TRUTH-214": [3, 4],
  "PN-TRUTH-215": [3, 4],
  "PN-TRUTH-216": [3, 4],
  "PN-TRUTH-217": [3, 4],
  "PN-TRUTH-218": [3, 4],
  "PN-TRUTH-219": [3, 4],
  "PN-TRUTH-220": [2, 4],
  "PN-TRUTH-221": [2, 4],
  "PN-TRUTH-222": [3, 4],
  "PN-TRUTH-223": [4, 4],
  "PN-TRUTH-224": [4, 4],
};

/**
 * 期望值③：落地前（且落地后必须一致）的「非 Heat 字段」指纹。
 * = sha256(JSON.stringify(整卡去掉 heatMin/heatMax))；覆盖 `text` 与其余全部 metadata。
 * A4a：这 24 个指纹横跨「运行时 KEEP 3 + 归档 21」两处，两边都要命中。
 */
const NON_HEAT_SHA256: Readonly<Record<string, string>> = {
  "PN-TRUTH-201": "ef9935189ac0b692602c9132f7c24cc3e134076b5e1a8caca288f2061877ec34",
  "PN-TRUTH-202": "00dbc50fcb5f6fdbd2bdd3da9280db66b64ebdb39feeadceac82c8797c8fa56d",
  // A9-R7（2026-09-29 内容返工）：203 题面按审查处方改写（RESEARCH_REVIEW-PACK1-FINAL-54 §1），
  // 非 Heat 指纹随之更新（heatMin/heatMax 未动，见上方 EXPECTED_HEAT 表）。
  "PN-TRUTH-203": "e28823922873f85130ffcf66cd9dee8dc012da6e89f293162f6987f5cf1bd8c9",
  "PN-TRUTH-204": "69234348b62495da7057e18c2cb5c099fa0eeb3c177393453cd54a9fcb1cdf5e",
  "PN-TRUTH-205": "f99948c31d9cc8f8421aae6426db824370944254e17d133ca5076bb53313e72f",
  "PN-TRUTH-206": "6ee884a7308bc6b2adddae4ffdb963fd22c60f630301d5ff8581408a16243cc9",
  "PN-TRUTH-207": "7a54f39a31c3de65595645bd956b4e4eaf47691d1482e814b5a024aa6e0aa1e5",
  "PN-TRUTH-208": "020f2e24c372a0e2a1dc3e7ee1e6ffe173feb733de6401cfb4782ba5a9c478b8",
  "PN-TRUTH-209": "3c2e87615ff3cbbae3e116d71e718bc53acafc751e5cbbe418e1697ef54aa230",
  "PN-TRUTH-210": "b33ebee71bdb17415dd3ed2b6630d37ba2294758b79dfdb977f05445dad68b01",
  "PN-TRUTH-211": "8e179a1bbbb425eec97aec2f7e3deb9f069e5b8776e10dedd3a16453289e0c42",
  "PN-TRUTH-212": "d3067eb2e58582b0cf610f5c911fab07bec958110380320dfa313a0be48fe85b",
  "PN-TRUTH-213": "43ad3167e1f30b9935b0158bf0fc048551fcf7ea9da63f3edb62ec7cba94147f",
  "PN-TRUTH-214": "b3a9a6a0ac717341fcdbf7e29b585915f3e7e14bd6bcac5f80a27cf3498980ca",
  "PN-TRUTH-215": "77bc59176d093588d1027c01fec6b86e786949f787db45f375da2121b1924ad2",
  "PN-TRUTH-216": "8b216929ab3707ac10c652cb7428607c3c5704a746d7301f160a35394790b521",
  "PN-TRUTH-217": "bac5da8caaf50454b71add92895ed986b8e6c95f0f5635828cb6bdf4790f20d0",
  "PN-TRUTH-218": "dbe69161fb6ff5f0816f808e74eb3875cb92730045b8672f7ac027f9a2a4d265",
  "PN-TRUTH-219": "d95cb58de164fc96f4f61816e0ca5ba9598dee15323f8b8da7ee6f9a6c7b5a8e",
  "PN-TRUTH-220": "cec940a9628ff7da80822922f29e1845fae7c03345172eac71d9de33c97d3326",
  "PN-TRUTH-221": "93be496aae2be066f44deb293117f4c0af010dca71646783a7156b2a5110bd25",
  "PN-TRUTH-222": "28bc7c557c9e4d37dbb871fe6550014d3e23ec1382a835c07c5e7564c26ba212",
  "PN-TRUTH-223": "6fbe3b72ec81bd4a849413d35b6a935b3937f4347707632e2a8c36de71fb14c9",
  "PN-TRUTH-224": "f42d4b125e489e86ace74a8d5c6e7ff2387a84d4c9ac8e2447195cb2425eb391",
};

/** 期望值②：reviewer 汇总（编排者裁决 #1 更正后；205 依 2026-09-29 单卡复核重算）。 */
const EXPECTED_COUNTS = {
  heatMin: { 1: 4, 2: 8, 3: 10, 4: 2 },
  heatMax: { 1: 0, 2: 0, 3: 5, 4: 19 },
} as const;

/** 编号（末段数字）升序。 */
const numberOf = (cardId: string): number => Number(cardId.slice("PN-TRUTH-".length));

/** 归档里的第一包卡（编号 ≤224），逐字快照。 */
const ARCHIVED_FIRST_PACK = RETIRED_TRUTH_CARDS.filter((entry) => numberOf(entry.cardId) <= 224);
/**
 * 完整历史第一包 24 张 = 运行时 KEEP 3 + 归档 21（按编号升序，与 reviewer 表同序）。
 * 这是「逐字锁值」与「指纹复算」的唯一数据来源。
 */
const FIRST_PACK_HISTORICAL: readonly FormalTruthCard[] = [
  ...FORMAL_TRUTH_CARDS,
  ...ARCHIVED_FIRST_PACK.map((entry) => entry.card),
].sort((a, b) => a.number - b.number);

const nonHeatSha256 = (card: object): string => {
  // 浅拷贝后删掉两个 Heat 字段：删除不改变其余 key 的插入顺序 ⇒ 序列化结果可复现。
  const nonHeat = { ...(card as Record<string, unknown>) };
  delete nonHeat.heatMin;
  delete nonHeat.heatMax;
  return createHash("sha256").update(JSON.stringify(nonHeat)).digest("hex");
};

const heatMinDist = (): Record<number, number> => {
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const card of FIRST_PACK_HISTORICAL) dist[card.heatMin] = (dist[card.heatMin] ?? 0) + 1;
  return dist;
};
const heatMaxDist = (): Record<number, number> => {
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const card of FIRST_PACK_HISTORICAL) dist[card.heatMax] = (dist[card.heatMax] ?? 0) + 1;
  return dist;
};

/* ------------------------------------------------------------------ */
/* ① 逐卡一致性 + 合法性                                                  */
/* ------------------------------------------------------------------ */

describe("A3/A4a① 逐卡 heatMin/heatMax 与 reviewer 表逐字一致（完整历史 24 张：运行时 3 + 归档 21）", () => {
  it("24 张全覆盖：值 === reviewer「建议 min / 建议 max」，无缺卡无多余", () => {
    expect(FIRST_PACK_HISTORICAL).toHaveLength(24);
    expect(FIRST_PACK_HISTORICAL.map((card) => card.cardId)).toEqual(Object.keys(REVIEWER_HEAT));
    for (const card of FIRST_PACK_HISTORICAL) {
      const expected = REVIEWER_HEAT[card.cardId];
      expect(expected, `${card.cardId} 不在 reviewer 表内`).toBeDefined();
      expect({ heatMin: card.heatMin, heatMax: card.heatMax }, card.cardId).toEqual({
        heatMin: expected![0],
        heatMax: expected![1],
      });
    }
  });

  it("heatMin <= heatMax 24/24 成立（边界卡 202=1/4、223=4/4、224=4/4；205 已由复核改为 1/3）", () => {
    for (const card of FIRST_PACK_HISTORICAL) {
      expect(card.heatMin, `${card.cardId} heatMin<=heatMax`).toBeLessThanOrEqual(card.heatMax);
    }
    const boundary = FIRST_PACK_HISTORICAL.filter(
      (card) => card.heatMin === card.heatMax || card.cardId === "PN-TRUTH-202",
    ).map((card) => `${card.cardId}=${card.heatMin}/${card.heatMax}`);
    expect(boundary).toEqual(["PN-TRUTH-202=1/4", "PN-TRUTH-223=4/4", "PN-TRUTH-224=4/4"]);
  });
});

/* ------------------------------------------------------------------ */
/* ② 分布（预期变化，非回归）                                              */
/* ------------------------------------------------------------------ */

describe("A3/A4a② 分布与 reviewer 汇总逐项对齐", () => {
  it("heatMin H1=4 / H2=8 / H3=10 / H4=2；heatMax H3=5 / H4=19", () => {
    expect(heatMinDist()).toEqual(EXPECTED_COUNTS.heatMin);
    expect(heatMaxDist()).toEqual(EXPECTED_COUNTS.heatMax);
    // 合计守恒：两列都是 24。
    expect(Object.values(heatMinDist()).reduce((a, b) => a + b, 0)).toBe(24);
    expect(Object.values(heatMaxDist()).reduce((a, b) => a + b, 0)).toBe(24);
  });
});

/* ------------------------------------------------------------------ */
/* ③ 非 Heat 字段一字未改（指纹快照）                                      */
/* ------------------------------------------------------------------ */

describe("A3/A4a③ 非 Heat 字段一字未改", () => {
  it("去 heatMin/heatMax 后的整卡 sha256 24/24 命中落地前快照（运行时 3 + 归档 21，含 text 与全部其它 metadata）", () => {
    for (const card of FIRST_PACK_HISTORICAL) {
      expect(nonHeatSha256(card), `${card.cardId} 非 Heat 字段被改动`).toBe(NON_HEAT_SHA256[card.cardId]);
    }
    // 归档 21 张必须真的贡献了其中 21 个指纹（防空断言被运行时 3 张独自满足）。
    expect(ARCHIVED_FIRST_PACK).toHaveLength(21);
    for (const entry of ARCHIVED_FIRST_PACK) {
      expect(nonHeatSha256(entry.card), `${entry.cardId} 归档快照指纹`).toBe(NON_HEAT_SHA256[entry.cardId]);
    }
  });

  it("指纹口径自证：改 heatMin/heatMax 不改指纹，改 text 或其它字段必改指纹", () => {
    const card = FIRST_PACK_HISTORICAL[0]!;
    expect(nonHeatSha256({ ...card, heatMin: 4, heatMax: 4 })).toBe(nonHeatSha256(card));
    expect(nonHeatSha256({ ...card, text: `${card.text}（篡改）` })).not.toBe(nonHeatSha256(card));
    expect(nonHeatSha256({ ...card, intensity: card.intensity + 1 })).not.toBe(nonHeatSha256(card));
  });
});

/* ------------------------------------------------------------------ */
/* ④ 两个口径的「抽得到 / 抽不到」（按 manifest 真源判 Formal）               */
/* ------------------------------------------------------------------ */

const TABLE_2M2F: SessionParticipant[] = [
  { playerId: "m1", active: true, pairGender: "male" },
  { playerId: "m2", active: true, pairGender: "male" },
  { playerId: "f1", active: true, pairGender: "female" },
  { playerId: "f2", active: true, pairGender: "female" },
];

const routerInputAt = (heat: Heat, drawSeed: number): V2RouterInput => {
  const relationship: RelationshipState = { ...createInitialRelationshipState(), heat };
  return {
    relationship,
    participants: TABLE_2M2F,
    targetPairKey: pairKey("f1", "m1"),
    intensityLimit: 5,
    softDedupWindow: 5,
    requireFiveTierForPair: null,
    drawSeed,
  };
};

/**
 * 判「Formal」一律用 manifest 真源 `formalFixedIdSet()`——`PN-TRUTH-2*` 前缀不再等价于「全部 31 张」
 * （26 张已退役离开卡源）。
 */
const FORMAL_ID_SET = formalFixedIdSet();
/** 运行时第一包 3 张的 id 集（本文件只锁第一包 Heat 表；Bootstrap 由 `formal-truth-bootstrap-pack.test.ts` 锁）。 */
const FIRST_PACK_ID_SET: ReadonlySet<string> = new Set(FORMAL_TRUTH_CARDS.map((card) => card.cardId));
const metaById = new Map(mainlineRuntimeCards().map((card) => [card.cardId, card]));
const runtimeIdSet = new Set(mainlineRuntimeCards().map((card) => card.cardId));

const formalIdsInBucketAt = (heat: Heat): string[] =>
  createV2MainlineRouter({ packId: "truth-dare" })
    .bucket(routerInputAt(heat, 0))
    .map((card) => card.cardId)
    .filter((cardId) => FORMAL_ID_SET.has(cardId))
    .sort();

const firstPackFormalInBucketAt = (heat: Heat): string[] =>
  formalIdsInBucketAt(heat).filter((cardId) => FIRST_PACK_ID_SET.has(cardId));

/**
 * 当前真实 UI（Heat 恒 H1）下，**Formal** 里 heatMin=1 的浅题集合。
 *
 * 由**内容源**派生（第一包 ＋ Bootstrap ＋ A9 重构批里 `heatMin<=1<=heatMax` 的卡），
 * 与下方「运行时卡源 ∩ manifest」派生集合双向比对 —— 不写死张数（A9 准入后集合已扩容）。
 */
const H1_REACHABLE_FORMAL: readonly string[] = [
  ...FORMAL_TRUTH_CARDS,
  ...FORMAL_TRUTH_BOOTSTRAP_CARDS,
  ...PACK1_ADMISSION_CARDS,
]
  .filter((card) => card.heatMin <= 1 && 1 <= card.heatMax)
  .map((card) => card.cardId)
  .sort();

describe("A3/A4a④ 当前 UI（Heat 恒 H1）与 engine/显式 disclosure 两个口径", () => {
  it("当前真实 UI：H1 桶内 Formal 集合 === 卡源里 heatMin=1<=heatMax 的 Formal 卡（逐 id 派生）", () => {
    const h1 = formalIdsInBucketAt("H1");
    const expected = mainlineRuntimeCards()
      .filter((card) => FORMAL_ID_SET.has(card.cardId) && card.heatMin === 1 && card.heatMax >= 1)
      .map((card) => card.cardId)
      .sort();
    expect(expected).toEqual([...H1_REACHABLE_FORMAL]);
    expect(h1).toEqual(expected);
    expect(h1.length).toBeGreaterThan(0);
  });

  it("第一包 Formal 只剩 203/205/209：H1 桶内只有 203/205；209（heatMin=2）被硬过滤；退役 21 张不在任何运行时卡池", () => {
    const firstPackFormal = [...FIRST_PACK_ID_SET].filter((id) => FORMAL_ID_SET.has(id)).sort();
    expect(firstPackFormal).toEqual(["PN-TRUTH-203", "PN-TRUTH-205", "PN-TRUTH-209"]);
    expect(firstPackFormalInBucketAt("H1")).toEqual(["PN-TRUTH-203", "PN-TRUTH-205"]);

    // A4a：退役 21 张已移出运行时卡源 ⇒ 既不在卡源、也不在 H1 桶（这正是本单要堵的漏洞）。
    const archivedFirstPack = ARCHIVED_FIRST_PACK.map((entry) => entry.cardId);
    expect(archivedFirstPack).toHaveLength(21);
    const h1 = new Set(
      createV2MainlineRouter({ packId: "truth-dare" })
        .bucket(routerInputAt("H1", 0))
        .map((card) => card.cardId),
    );
    for (const id of archivedFirstPack) {
      expect(runtimeIdSet.has(id), `${id} 不得在运行时卡源`).toBe(false);
      expect(h1.has(id), `${id} 不得进 H1 桶`).toBe(false);
    }
    // 209 仍是 Formal ⇒ 受硬过滤，H1 抽不到。
    expect(h1.has("PN-TRUTH-209")).toBe(false);
  });

  it("engine / 显式 disclosure 口径：Formal 逐档首次解锁与桶内可抽数由卡源派生（两路真源交叉，不写死）", () => {
    // 「该档首次解锁」= Formal 里 heatMin === H 的张数；「该档 bucket 内可抽总数」= heatMin<=H<=heatMax。
    // 两路真源：① 内容源（第一包 ＋ Bootstrap ＋ A9 重构批）；② 运行时卡源 ∩ manifest。
    const contentFormal = [...FORMAL_TRUTH_CARDS, ...FORMAL_TRUTH_BOOTSTRAP_CARDS, ...PACK1_ADMISSION_CARDS];
    const contentFirstUnlock: Record<Heat, number> = {
      H1: contentFormal.filter((card) => card.heatMin === 1).length,
      H2: contentFormal.filter((card) => card.heatMin === 2).length,
      H3: contentFormal.filter((card) => card.heatMin === 3).length,
      H4: contentFormal.filter((card) => card.heatMin === 4).length,
    };
    const runtimeFirstUnlock: Record<Heat, number> = {
      H1: [...FORMAL_ID_SET].filter((id) => metaById.get(id)!.heatMin === 1).length,
      H2: [...FORMAL_ID_SET].filter((id) => metaById.get(id)!.heatMin === 2).length,
      H3: [...FORMAL_ID_SET].filter((id) => metaById.get(id)!.heatMin === 3).length,
      H4: [...FORMAL_ID_SET].filter((id) => metaById.get(id)!.heatMin === 4).length,
    };
    // 两路真源必须一致；四档合计 = Formal 总数（张数由真源派生，不写死 —— 上一版锁的是 A3 的 {4,1,0,0} 断档态）。
    expect(runtimeFirstUnlock).toEqual(contentFirstUnlock);
    expect(Object.values(contentFirstUnlock).reduce((sum, count) => sum + count, 0)).toBe(FORMAL_ID_SET.size);

    for (const heat of ["H1", "H2", "H3", "H4"] as const) {
      const rank = Number(heat.slice(1));
      const expectedInBucket = mainlineRuntimeCards()
        .filter((card) => FORMAL_ID_SET.has(card.cardId) && card.heatMin <= rank && rank <= card.heatMax)
        .map((card) => card.cardId)
        .sort();
      // 运行期 Router 的桶必须与卡源派生集合逐字相同。
      expect(formalIdsInBucketAt(heat), `${heat} 桶内 Formal 集合`).toEqual(expectedInBucket);
      // 「该档桶内可抽总数」= 内容源里 heatMin<=rank<=heatMax 的 Formal 卡数（如实报告口径，不写死）。
      const derivedInBucket = contentFormal.filter((card) => card.heatMin <= rank && rank <= card.heatMax).length;
      expect(formalIdsInBucketAt(heat).length, `${heat} 桶内 Formal 数`).toBe(derivedInBucket);
    }
  });

  it("两 Router 同口径：生产 createDeckRouter 在 H1 也只放行 heatMin=1 的 Formal 卡", () => {
    const deck = createDeckRouter({
      deck: mainlineSsotCards(),
      preferredPackIds: ["truth-dare"],
      enabledPackIds: [...V2_MAINLINE_PACK_IDS],
    });
    const productionH1 = deck
      .bucket(routerInputAt("H1", 0))
      .map((card) => card.cardId)
      .filter((cardId) => FORMAL_ID_SET.has(cardId))
      .sort();
    expect(productionH1).toEqual(formalIdsInBucketAt("H1"));
  });
});
