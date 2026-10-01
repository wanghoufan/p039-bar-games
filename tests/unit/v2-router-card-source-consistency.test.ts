/**
 * C1-8｜双 Router 卡源一致性（共享同一份主线卡源，不改任何过滤 / 排序 / Heat 口径）。
 *
 * 背景（C1-3 发现的结构不一致）：
 * - 生产 `/game` 链走 `createDeckRouter`（`lib/engine/v2-deal.ts`），牌堆来自 `mainlineSsotCards()`
 *   （SSOT 主线 350 + 运行时 KEEP 5），**本来就能看到这批正式卡**；
 * - 审计 / MC 链走 `createV2MainlineRouter`（`lib/v2-relationship/v2-router.ts`），上一版直读
 *   SSOT adapter（350）⇒ 看不到这批卡 ⇒ 审计候选集小于生产牌堆，两 Router 卡源漂移。
 *
 * 本单把两个 Router 统一到桥接模块的**同一份卡源** `mainlineRuntimeCards()`
 * （= SSOT adapter 主线 + `FORMAL_TRUTH_CARDS`），`mainlineSsotCards()` 与它逐 id 一致
 * （同一份内容的两种投影：GameCard ↔ V13 卡）。
 *
 * 本文件只锁三件事：
 * 1. `mainlineRuntimeCards()` 与 `mainlineSsotCards()` 逐 id 一致（同一内容，两个投影）；
 * 2. 审计 Router 现在真的能出运行时 KEEP 卡（`PN-TRUTH-203/205/209/227/229`）；
 * 3. 三个层级（bucket/pack/global）**与生产 `createDeckRouter` 的候选集合逐字相同** ——
 *    即两 Router 同口径（同卡源、同硬过滤），且既有「Heat 只对 Formal 卡生效」的口径未改。
 */

import { describe, expect, it } from "vitest";

import { createDeckRouter } from "@/lib/engine/v2-deal";
import {
  mainlineRuntimeCards,
  mainlineSsotCards,
  V2_MAINLINE_PACK_IDS,
} from "@/lib/v2-content/v2-card-bridge";
import { createV2MainlineRouter } from "@/lib/v2-relationship/v2-router";
import { formalFixedIdSet } from "@/lib/v2-content/fixed-content-manifest";
import { FORMAL_TRUTH_BOOTSTRAP_CARDS } from "@/lib/v2-content/formal-truth-bootstrap-pack";
import { FORMAL_TRUTH_CARDS } from "@/lib/v2-content/formal-truth-pack";
import { PACK1_ADMISSION_CARD_IDS } from "@/lib/v2-content/pack1-admission";
import { getV2ContentAdapter } from "@/lib/v2-content/v2-content-adapter";
import type { V2RouterInput } from "@/lib/v2-relationship/v2-session";
import {
  createInitialRelationshipState,
  pairKey,
  type RelationshipState,
  type SessionParticipant,
} from "@/lib/v2-relationship/v2-state";

const PACK_ID = "truth-dare";

const TABLE_2M2F: SessionParticipant[] = [
  { playerId: "m1", active: true, pairGender: "male" },
  { playerId: "m2", active: true, pairGender: "male" },
  { playerId: "f1", active: true, pairGender: "female" },
  { playerId: "f2", active: true, pairGender: "female" },
];

const input = (overrides: Partial<V2RouterInput> = {}): V2RouterInput => ({
  relationship: overrides.relationship ?? createInitialRelationshipState(),
  participants: overrides.participants ?? TABLE_2M2F,
  targetPairKey: overrides.targetPairKey ?? pairKey("f1", "m1"),
  intensityLimit: overrides.intensityLimit ?? 5,
  softDedupWindow: overrides.softDedupWindow ?? 5,
  requireFiveTierForPair: overrides.requireFiveTierForPair ?? null,
  ...(overrides.drawSeed === undefined ? {} : { drawSeed: overrides.drawSeed }),
});

const sortedIds = (cards: readonly { cardId: string }[]): string[] =>
  cards.map((card) => card.cardId).sort();

/**
 * `PN-TRUTH-2*` 家族**运行时**卡逐张派生（第一包 3 ＋ Bootstrap 2 ＋ A9 重构批 52）。
 *
 * ⚠️ A4a（2026-09-29）：26 张退役 `PN-TRUTH-2*` 已**移出运行时内容源**（逐字归档于
 * `lib/v2-content/archive/retired-truth-pack-2026-09-29.ts`，不进任何运行时卡池）。
 * ⚠️ A9（2026-09-29）：52 张重构批经准入后与 KEEP 5 同形进入运行时卡源。
 * 因此**不得**再用 `PN-TRUTH-2*` 前缀冒充「全部 31 张」或「全部 Formal」——判 Formal 一律走
 * `formalFixedIdSet()`（本文件用两路派生互校：运行时家族 ⇄ manifest Formal）。
 * 张数不写死：见下方用例里的逐 id 比对。
 */
const P2_FAMILY_IDS = mainlineRuntimeCards()
  .map((card) => card.cardId)
  .filter((cardId) => cardId.startsWith("PN-TRUTH-2"));
const FORMAL_IDS = formalFixedIdSet();
/** A3/A4a 冻结的 KEEP 5（必须仍是运行时家族的一部分）。 */
const KEEP_5_IDS = ["PN-TRUTH-203", "PN-TRUTH-205", "PN-TRUTH-209", "PN-TRUTH-227", "PN-TRUTH-229"] as const;

describe("C1-8｜双 Router 卡源一致性（共享 mainlineRuntimeCards）", () => {
  it("mainlineRuntimeCards() 与 mainlineSsotCards() 逐 id 一致（同一内容的两个投影）", () => {
    const runtimeIds = mainlineRuntimeCards().map((card) => card.cardId);
    const gameCardIds = mainlineSsotCards().map((card) => card.id);
    expect(runtimeIds).toEqual(gameCardIds);
    // 张数由内容源派生（SSOT 冻结主线 ＋ 运行时正式内容源；退役卡已移出卡源），不写死。
    const extra = FORMAL_TRUTH_CARDS.length + FORMAL_TRUTH_BOOTSTRAP_CARDS.length + PACK1_ADMISSION_CARD_IDS.length;
    expect(runtimeIds).toHaveLength(getV2ContentAdapter().mainlineCards.length + extra);
  });

  it("审计 Router 现在能出运行时 PN-TRUTH-2* 家族卡（= manifest Formal 全集，出现在三层候选里）", () => {
    // 两路派生互校：运行时家族 ⇄ manifest Formal（A9 后二者逐 id 相等）。
    expect([...P2_FAMILY_IDS].sort()).toEqual([...FORMAL_IDS].sort());
    expect(P2_FAMILY_IDS.length).toBeGreaterThan(0);
    for (const id of KEEP_5_IDS) expect(P2_FAMILY_IDS, `${id}（KEEP）应在运行时家族里`).toContain(id);
    const router = createV2MainlineRouter({ packId: PACK_ID });
    const req = input({ drawSeed: 0 });
    for (const tier of ["bucket", "pack", "global"] as const) {
      const ids = sortedIds(router[tier](req));
      expect(P2_FAMILY_IDS.some((cardId) => ids.includes(cardId)), tier).toBe(true);
    }
  });

  it("三层候选集合与生产 createDeckRouter 逐字相同（同卡源 == 同口径）", () => {
    const mainline = createV2MainlineRouter({ packId: PACK_ID });
    // 生产 Router 的 `global` 覆盖「本局启用玩法」；这里给全部主线玩法，才与主线 Router 的
    // `global`（覆盖全部 6 个 relationship-aware 玩法）同域。
    const deck = createDeckRouter({
      deck: mainlineSsotCards(),
      preferredPackIds: [PACK_ID],
      enabledPackIds: [...V2_MAINLINE_PACK_IDS],
    });

    for (const heat of ["H1", "H2", "H3", "H4"] as const) {
      const relationship: RelationshipState = { ...createInitialRelationshipState(), heat };
      const req = input({ relationship, drawSeed: 7 });
      for (const tier of ["bucket", "pack", "global"] as const) {
        expect(sortedIds(mainline[tier](req)), `${tier}@${heat}`).toEqual(sortedIds(deck[tier](req)));
      }
    }
  });

  it("Heat 档硬过滤口径未改：H1 桶内 Formal 卡集合 == 卡源里 heatMin<=1<=heatMax 的 Formal 卡集合（legacy 仍整批豁免）", () => {
    // ⚠️ 口径变更（A3，2026-09-29）：判「Formal」不得再用 `PN-TRUTH-2*` 前缀——该家族 31 张里
    // 只有 KEEP 5 仍是 Formal，其余 26 张已退出 ⇒ 按既有 legacy 豁免口径进桶（不再受 Heat 硬过滤）。
    // 本断言仍有实质约束力：H1 桶内 Formal 集合必须与卡源 heatMin/heatMax 派生集合**逐字相同**。
    const router = createV2MainlineRouter({ packId: PACK_ID });
    const h1 = sortedIds(router.bucket(input({ drawSeed: 0 })));

    const expectedH1Formal = mainlineRuntimeCards()
      .filter((card) => FORMAL_IDS.has(card.cardId) && card.heatMin <= 1 && 1 <= card.heatMax)
      .map((card) => card.cardId)
      .sort();
    expect(h1.filter((cardId) => FORMAL_IDS.has(cardId))).toEqual(expectedH1Formal);
    expect(expectedH1Formal.length).toBeGreaterThan(0);
    expect(expectedH1Formal.length).toBeLessThan(FORMAL_IDS.size); // 确实收窄了，不再全量
    // KEEP 浅题必须仍在 H1 集合里（防「集合换了一批卡还照样绿」）。
    for (const id of ["PN-TRUTH-203", "PN-TRUTH-205", "PN-TRUTH-227", "PN-TRUTH-229"]) {
      expect(expectedH1Formal, `${id}（KEEP 浅题）应在 H1 集合里`).toContain(id);
    }

    // Formal 里 heatMin≥2 的卡（含 KEEP 里唯一 heatMin=2 的 209）一张都不在 H1 桶内。
    const unreachable = [...FORMAL_IDS].filter((cardId) => !expectedH1Formal.includes(cardId));
    expect(unreachable.length).toBeGreaterThan(0);
    expect(unreachable, "KEEP 里唯一 heatMin=2 的 209 应受硬过滤").toContain("PN-TRUTH-209");
    expect(h1).not.toContain("PN-TRUTH-209");
    expect(unreachable.some((cardId) => h1.includes(cardId))).toBe(false);

    // legacy 里存在 heatMin>1 的卡也在 H1 桶内（B3-4 的豁免口径没被本单改回）。
    const legacyHighMin = mainlineRuntimeCards()
      .filter((card) => !FORMAL_IDS.has(card.cardId) && card.heatMin > 1)
      .map((card) => card.cardId);
    expect(legacyHighMin.length).toBeGreaterThan(0);
    expect(legacyHighMin.some((cardId) => h1.includes(cardId))).toBe(true);
  });
});
