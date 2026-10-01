/**
 * R0-2｜`FORMAL-TRUTH-PRODUCTION-CHAIN.json` 的 **note 必须由实测数据派生**（自相矛盾回归门禁）。
 *
 * 背景：该产物原先在 `scenarioFormalOnly.note` 里硬编码了
 * 「Heat 逐档 H1→H2→H3→H4，逐档首次到达计数 = min+1（4/8/13）」，
 * 而同一份 JSON 的实测数据是 `firstReachRoundByHeat = { H1:1, H2:null, H3:null, H4:null }`
 * —— 数据说「没到 H2」、note 说「逐档到 H4」。机器/后续 reviewer 读到的是两套互斥信息。
 *
 * 本文件把这条锁死，五个角度：
 * 1. note 声称的「已到达 / 未到达」档位 = `firstReachRoundByHeat` 的实测档位（不得谎报）；
 * 2. Formal / Bootstrap 子集情形的冷启结论与实测档位一致（note 报的缺口数在测试内**独立复算**，不复用脚本）；
 * 3. 产物未被手改：note 必须能由本情形的 `rounds` + 库存 + 阈值现算出来（逐字比对）；
 * 4. 构造性反例：受控 fixture 里某档已到达 ⇒ note 必须提到它；原因非「库存不足」时不得写成库存不足。
 *
 * ⚠️ A9 口径（2026-09-29）：`FORMAL-TRUTH-PRODUCTION-CHAIN.json` 已按**当前卡源**重刷
 * （第一包 3 ＋ Bootstrap 2 ＋ 重构批 52，逐张 Formal 归属按 manifest 真源判）。本文件不再重建
 * A3 时代的历史卡源；牌堆、可计数库存、期望档位一律由**运行时卡源 + manifest 真源**派生。
 *
 * 只读产物 + 纯函数：不写盘、不跑模拟、不改任何判定/阈值。
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { mainlineRuntimeCards, mainlineSsotCardsByPack } from "@/lib/v2-content/v2-card-bridge";
import { formalFixedIdSet } from "@/lib/v2-content/fixed-content-manifest";
import { FORMAL_TRUTH_BOOTSTRAP_CARDS } from "@/lib/v2-content/formal-truth-bootstrap-pack";
import { HEAT_THRESHOLDS } from "@/lib/v2-relationship/v2-state";
import { deriveHeatReachNote } from "@/scripts/audit-formal-truth-heat-note";

const CHAIN_JSON = join(process.cwd(), "docs/qa/content-audit/FORMAL-TRUTH-PRODUCTION-CHAIN.json");
const PACK_ID = "truth-dare";
const FORMAL_PREFIX = "PN-TRUTH-2";

interface ChainRound {
  round: number;
  cardId: string;
  formal: boolean;
  informationGain: string | null;
  topic: string | null;
  effectiveCount: number;
  heat: string;
}
interface ChainScenario {
  deck: string;
  rounds: ChainRound[];
  finalHeat: string;
  finalEffective: number;
  terminal: { afterRound: number; outcome: string | null };
  firstReachRoundByHeat: Record<string, number | null>;
  note: string;
}

const chain = JSON.parse(readFileSync(CHAIN_JSON, "utf8")) as Record<string, unknown>;
const scenario = (key: string): ChainScenario => chain[key] as ChainScenario;

const HEAT_ORDER = HEAT_THRESHOLDS.map((band) => band.heat);
const H2_MIN = HEAT_THRESHOLDS.find((band) => band.heat === "H2")!.min;
/** ⑤ 的构造性反例（受控 fixture，与真实产物无关）用到 H3 门槛。 */
const H3_MIN = HEAT_THRESHOLDS.find((band) => band.heat === "H3")!.min;

/**
 * 卡侧元数据视图 = **运行时卡源**（与落盘脚本 `audit-formal-truth-production-chain.ts` 同一份卡源）。
 * A9 后产物已按当前卡源重刷，故不再重建 A3 时代「运行时 KEEP 5 ∪ 归档 26」的历史视图。
 */
const metaById = new Map<
  string,
  { heatMin: number; heatMax: number; informationGain?: string | null; topic?: string | null }
>(mainlineRuntimeCards().map((card) => [card.cardId, card] as const));

/** 卡侧「可形成有效信息轮」的前置条件（与 `isEffectiveInformationRound` 同源，测试内独立判定）。 */
const isCountable = (cardId: string): boolean => {
  const meta = metaById.get(cardId);
  if (!meta) return false;
  const informationGain = meta.informationGain ?? null;
  const topic = meta.topic ?? null;
  return informationGain !== null && informationGain !== "zero" && informationGain !== "low" && topic !== null;
};

/** 真实生产牌堆（与落盘脚本同口径）= truth-dare 全部运行时卡（SSOT 主线 ＋ 第一包 ＋ Bootstrap ＋ A9 重构批）。 */
const PACK_DECK: readonly { id: string }[] = mainlineSsotCardsByPack(PACK_ID);
/**
 * 各情形牌堆与落盘脚本**同口径**（Formal 用 manifest 真源，不用 `PN-TRUTH-2*` 前缀）：
 * Formal（manifest 轨全部）/ Bootstrap（Bootstrap 内容源）/ Legacy（SSOT 主线卡，无 metadata）。
 */
const FORMAL_ID_SET = formalFixedIdSet();
const BOOTSTRAP_ID_SET: ReadonlySet<string> = new Set(FORMAL_TRUTH_BOOTSTRAP_CARDS.map((card) => card.cardId));
const deckOf = (which: "full" | "formal" | "bootstrap" | "legacy") => {
  if (which === "full") return PACK_DECK;
  if (which === "formal") return PACK_DECK.filter((card) => FORMAL_ID_SET.has(card.id));
  if (which === "bootstrap") return PACK_DECK.filter((card) => BOOTSTRAP_ID_SET.has(card.id));
  return PACK_DECK.filter((card) => !card.id.startsWith(FORMAL_PREFIX));
};

/** 独立复算：牌堆里「可计数」且 Heat 合法区间覆盖 H1 的卡数（= 冷启能累积的有效轮上限）。 */
const h1CountableOf = (deck: readonly { id: string }[]): number =>
  deck.filter((card) => {
    if (!isCountable(card.id)) return false;
    const meta = metaById.get(card.id);
    if (!meta) return false;
    return meta.heatMin <= 1 && 1 <= meta.heatMax;
  }).length;

const bandsIn = (text: string): string[] => text.match(/H[1-4]/g) ?? [];
const reachedClaimedBy = (note: string): string[] => {
  const match = /实际到达的档：([^；]*)/.exec(note);
  return match ? [...new Set(bandsIn(match[1]!))] : [];
};
const unreachedClaimedBy = (note: string): string[] => {
  const match = /未到达的档：([^。]*)/.exec(note);
  return match ? [...new Set(bandsIn(match[1]!))] : [];
};
const actualReached = (s: ChainScenario): string[] => HEAT_ORDER.filter((heat) => s.firstReachRoundByHeat[heat] !== null);
const actualUnreached = (s: ChainScenario): string[] => HEAT_ORDER.filter((heat) => s.firstReachRoundByHeat[heat] === null);
const sortedEq = (a: readonly string[], b: readonly string[]): boolean =>
  [...a].sort().join(",") === [...b].sort().join(",");

const SCENARIOS: Array<[string, "full" | "formal" | "bootstrap" | "legacy"]> = [
  ["scenarioFullPack", "full"],
  ["scenarioFormalOnly", "formal"],
  ["scenarioBootstrapOnly", "bootstrap"],
  ["scenarioLegacyOnly", "legacy"],
];

describe("R0-2｜production-chain 的 note 必须由实测结果派生（不得与 firstReachRoundByHeat 矛盾）", () => {
  it("① 三个情形：note 声称的「已到达 / 未到达」档位 = firstReachRoundByHeat 的实测档位", () => {
    for (const [key] of SCENARIOS) {
      const s = scenario(key);
      const reached = reachedClaimedBy(s.note);
      const unreached = unreachedClaimedBy(s.note);

      expect(sortedEq(reached, actualReached(s)), `${key}：note 谎报/漏报「已到达」档位`).toBe(true);
      expect(sortedEq(unreached, actualUnreached(s)), `${key}：note 谎报/漏报「未到达」档位`).toBe(true);
      // 两段互斥且并集覆盖全部 Heat 档（不留模糊地带）
      expect(reached.filter((heat) => unreached.includes(heat)), `${key}：同一档不得既已到达又未到达`).toEqual([]);
      expect(sortedEq([...reached, ...unreached], HEAT_ORDER), `${key}：档位未全覆盖`).toBe(true);
      // 未全到达时，禁止再出现「逐档 H1→H2→H3→H4」这类旧口径谎报
      if (actualUnreached(s).length > 0) {
        expect(s.note, `${key}：仍有「逐档 H1→H2→H3→H4」旧结论`).not.toMatch(/逐档\s*H1→H2→H3→H4/);
      }
    }
  });

  it("② formalOnly：Formal 可计数库存全部可用、H1 浅题 ≥ H2 门槛 ⇒ 逐档可达（档位由实测派生）", () => {
    const s = scenario("scenarioFormalOnly");
    const h1Countable = h1CountableOf(deckOf("formal"));
    const countableFormal = deckOf("formal").filter((card) => isCountable(card.id));

    // Formal 每张都带 metadata ⇒ 可计数张数 = Formal 全集（逐张派生，不写死）。
    expect(countableFormal).toHaveLength(FORMAL_ID_SET.size);
    expect(h1Countable).toBeGreaterThan(0);
    expect(h1Countable).toBeGreaterThanOrEqual(H2_MIN);

    // 终态一律由实测的逐档首达派生（不写死档位：A3 的断档态是 {1,4,null,null}，A9 准入后可达更高档）。
    const reached = actualReached(s);
    expect(s.firstReachRoundByHeat.H1).toBe(1);
    expect(reached.length).toBeGreaterThan(0);
    expect(s.finalHeat).toBe(reached.at(-1));
    // 牌堆全是 Formal 且每张可计数、局局给合法披露 ⇒ 每一轮都是有效信息轮。
    expect(s.finalEffective).toBeGreaterThan(0);
    expect(s.finalEffective).toBe(s.rounds.length);

    // note 文本层：与实测档位逐档一致，且不得再有旧口径谎报。
    expect(sortedEq(reachedClaimedBy(s.note), reached)).toBe(true);
    expect(sortedEq(unreachedClaimedBy(s.note), actualUnreached(s))).toBe(true);
    expect(s.note).not.toMatch(/逐档\s*H1→H2→H3→H4/);
  });

  it("②b bootstrapOnly：Bootstrap 内容源可计数、但张数 < H2 门槛 ⇒ 首个断档门如实写缺口（不写死张数）", () => {
    const s = scenario("scenarioBootstrapOnly");
    const countable = deckOf("bootstrap").filter((card) => isCountable(card.id)).length;
    expect(countable).toBe(BOOTSTRAP_ID_SET.size);
    expect(countable).toBeGreaterThan(0);
    // Bootstrap 内容源全部仍属 Formal（逐张按 manifest 真源判，不整批假设）。
    const bootstrapFormal = deckOf("bootstrap").filter((card) => FORMAL_ID_SET.has(card.id)).map((card) => card.id).sort();
    expect(bootstrapFormal).toEqual([...BOOTSTRAP_ID_SET].sort());

    // 张数 < H2 门槛 ⇒ H2 不可达（首个断档门 = H2），Heat 停在 H1。
    expect(countable).toBeLessThan(H2_MIN);
    expect(s.firstReachRoundByHeat.H2).toBeNull();
    expect(s.finalHeat).toBe("H1");
    expect(s.finalEffective).toBe(countable);
    expect(sortedEq(reachedClaimedBy(s.note), ["H1"])).toBe(true);
    expect(sortedEq(unreachedClaimedBy(s.note), ["H2", "H3", "H4"])).toBe(true);

    // 缺口数由实算派生（门槛真源 − 可计数库存），不写死。
    const firstUnreached = actualUnreached(s)[0]!;
    const threshold = HEAT_THRESHOLDS.find((band) => band.heat === firstUnreached)!.min;
    const available = /可计数卡 (\d+) 张/.exec(s.note);
    const gateThreshold = /门槛 (\d+)/.exec(s.note);
    const gap = /缺口 (\d+) 张/.exec(s.note);
    expect(available?.[1]).toBe(String(countable));
    expect(gateThreshold?.[1]).toBe(String(threshold));
    expect(Number(gap![1])).toBe(threshold - countable);
  });

  it("③ legacyOnly：可计数库存为 0 时如实写「0 张」，不编造缺口，也不谎报到达", () => {
    const s = scenario("scenarioLegacyOnly");
    expect(h1CountableOf(deckOf("legacy"))).toBe(0);
    expect(s.note).toMatch(/可计数卡 0 张/);
    expect(sortedEq(reachedClaimedBy(s.note), ["H1"])).toBe(true);
    expect(s.finalEffective).toBe(0);
    expect(s.firstReachRoundByHeat.H2).toBeNull();
  });

  it("④ 复算闸门：note 必须能由本情形 rounds + 库存 + 阈值现算出来（产物不可手改）", () => {
    for (const [key, which] of SCENARIOS) {
      const s = scenario(key);
      const countableCards = deckOf(which)
        .filter((card) => isCountable(card.id))
        .map((card) => {
          const meta = metaById.get(card.id)!;
          return { cardId: card.id, heatMin: meta.heatMin, heatMax: meta.heatMax };
        });

      const rebuilt = deriveHeatReachNote({
        label: s.deck,
        rounds: s.rounds,
        finalHeat: s.finalHeat,
        finalEffective: s.finalEffective,
        thresholds: HEAT_THRESHOLDS,
        countableCards,
      });

      expect(rebuilt.note, `${key}：note 与「按实测数据复算」的结果不一致（疑似手写/手改）`).toBe(s.note);
      expect(rebuilt.firstReachRoundByHeat, `${key}：firstReachRoundByHeat 与复算不一致`).toEqual(s.firstReachRoundByHeat);
    }
  });

  it("⑤ 构造性反例：某档已到达时，note 必须把它列为已到达（不得再称未到达）", () => {
    const fixture = deriveHeatReachNote({
      label: "fixture-H2-reached",
      rounds: [
        { heat: "H1", effectiveCount: 1 },
        { heat: "H1", effectiveCount: 2 },
        { heat: "H1", effectiveCount: 3 },
        { heat: "H2", effectiveCount: 4 },
        { heat: "H2", effectiveCount: 7 },
      ],
      finalHeat: "H2",
      finalEffective: 7,
      thresholds: HEAT_THRESHOLDS,
      countableCards: Array.from({ length: 4 }, (_, i) => ({ cardId: `F${i}`, heatMin: 1, heatMax: 2 })),
    });

    expect(fixture.reachedBands).toEqual(["H1", "H2"]);
    expect(fixture.unreachedBands).toEqual(["H3", "H4"]);
    expect(fixture.firstReachRoundByHeat.H2).toBe(4);

    // note 文本层：到达段必须含 H2，未到达段必须不含 H2
    expect(bandsIn(/实际到达的档：([^；]*)/.exec(fixture.note)![1]!)).toContain("H2");
    expect(bandsIn(/未到达的档：([^。]*)/.exec(fixture.note)![1]!)).not.toContain("H2");

    // 冷启门顺移到 H3：可计数卡 4 张（heatMin≤2）< H3 门槛 8 ⇒ 缺口 4
    expect(fixture.bootstrapGate?.band).toBe("H3");
    expect(fixture.bootstrapGate?.availableBelow).toBe(4);
    expect(fixture.bootstrapGate?.shortfall).toBe(H3_MIN - 4);
    expect(fixture.note).toMatch(/H3 门槛 8/);
  });

  it("⑥ 构造性反例：库存够却被别的原因卡住 ⇒ note 必须写「非库存不足」并指向可观测原因", () => {
    const fixture = deriveHeatReachNote({
      label: "fixture-inventory-enough",
      rounds: [{ heat: "H1", effectiveCount: 1 }],
      finalHeat: "H1",
      finalEffective: 1,
      thresholds: HEAT_THRESHOLDS,
      countableCards: Array.from({ length: 6 }, (_, i) => ({ cardId: `G${i}`, heatMin: 1, heatMax: 1 })),
    });

    expect(fixture.bootstrapGate?.band).toBe("H2");
    expect(fixture.bootstrapGate!.availableBelow).toBeGreaterThanOrEqual(H2_MIN);
    expect(fixture.bootstrapGate!.shortfall).toBeLessThanOrEqual(0);
    expect(fixture.note).toMatch(/非「库存不足」/);
    expect(fixture.note).toMatch(/牌堆耗尽／intensity 过滤／软去重／抽卡排序/);
    expect(fixture.note).not.toMatch(/缺口 -\d+ 张/);
  });
});
