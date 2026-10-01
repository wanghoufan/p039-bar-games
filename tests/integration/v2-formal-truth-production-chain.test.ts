/**
 * C1-8｜§十八 第一段：第一包 Formal Truth 的**真实生产链**验证。
 *
 * 要证明的链（全部走生产代码，测试只提供两支**正式输入**：真实牌堆 + 正式披露信号）：
 *
 * ```
 * 真实牌堆（mainlineSsotCardsByPack('truth-dare')，含 Formal 5 张 + legacy 100 张；A4a 后共 105 张）
 *   → startRound（唯一出题入口：drawDeckCard → createDeckRouter → 生产 Router 三层计数）
 *   → resolveRoundAndReduce(session, 'complete', roundDisclosureSignal({ selfDisclosed, disclosedPlayerIds }))
 *   → eventForRoundTerminal（卡侧 metadata 由 metadataForCard 读生产 sidecar；轮侧披露由正式信号提供）
 *   → reduceV2SessionEvents → relationshipEffectiveCardCount / Heat（heatForEffectiveCount）
 * ```
 *
 * 纪律：
 * - **不**注入任何 metadata override（`setCardQualityIndexOverrides` 在本文件里一次都不调用）——
 *   Formal 卡（第一包 24 + Bootstrap 7）的 `informationGain`/`topic` 来自生产 sidecar（bridge → quality index 的真实投影）；
 * - **不**直接赋值 relationship / effective count / heat；这些一律由上面的生产链派生后读回；
 * - 认识阈值 / 窗口 / Heat 契约 / D6 / `isEffectiveInformationRound` fail-closed 一律不动。
 *
 * 五个情形（口径随 A3「Heat 标注必须诚实」+ A5「双口径」+ **A3 退出 Formal** + **A4a 退役卡移出卡源**
 * + **A9 重构批准入** 更新）：
 * 1. 全包（生产真实牌堆 = SSOT 100 ＋ 运行时正式内容源）：本 seed 下 0 张 Formal 被抽到，
 *    故有效轮 = 0、Heat 恒 H1；26 张退役旧卡已**移出运行时卡源** ⇒ 全包内带 metadata 的卡**全部是 Formal**，
 *    A4a 前的「legacy 带 metadata 照样计有效轮」漏洞仍被堵死；
 * 2. 仅 Formal（manifest 轨，真实生产卡子集）seed=1：每张可计数 ⇒ 每轮都是有效信息轮，
 *    Heat 随有效轮逐档推进（档位由实测派生，不再假设 H3/H4 断档）；
 * 2b. 仅运行时 Bootstrap 内容源（227/229，均属 Formal）：可计数但 < H2 门槛 ⇒ 抽满即交 Host（Heat 仍在 H1）；
 * 3. 仅 legacy 卡（无 metadata）：负向对照 —— sidecar 恒 null ⇒ 有效计数恒 0、Heat 恒 H1（fail-closed 成立）；
 * 4. **当前真实 UI 口径（A5 新增，可执行门禁）**：`roundDisclosureForCurrentRound()` 恒 `undefined`
 *    ⇒ 无披露生产者 ⇒ 即便牌堆全是可计数的 Formal 卡（真被抽出、sidecar 有 metadata），
 *    有效计数仍恒 0、Heat 仍恒 H1。这条把「口径 B」从报告文字变成红灯会亮的测试。
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DEFAULT_BOUNDARIES } from "@/lib/domain/constants";
import type { GameCard, GameSession, Player, SessionConfig } from "@/lib/domain/schemas";
import {
  createSession,
  resolveRoundAndReduce,
  roundDisclosureSignal,
  startRound,
} from "@/lib/engine/session-engine";
import { relationshipOf } from "@/lib/engine/v2-deal";
import { mainlineRuntimeCards, mainlineSsotCardsByPack } from "@/lib/v2-content/v2-card-bridge";
import { formalFixedIdSet } from "@/lib/v2-content/fixed-content-manifest";
import { FORMAL_TRUTH_BOOTSTRAP_CARDS } from "@/lib/v2-content/formal-truth-bootstrap-pack";
import { metadataForCard } from "@/lib/v2-content/v2-card-quality-index";
import { HEAT_THRESHOLDS, heatForEffectiveCount } from "@/lib/v2-relationship/v2-state";

const PACK_ID = "truth-dare";
const FIXED_DRAW_SEED = 1;
const MAX_ROUNDS = 20;
const HEAT_ORDER = HEAT_THRESHOLDS.map((band) => band.heat);
const EXPLICIT_TIMEOUT_MS = 30_000;
const BOOTSTRAP_ID_SET = new Set(FORMAL_TRUTH_BOOTSTRAP_CARDS.map((card) => card.cardId));

const players = (): Player[] =>
  ["a", "b", "c", "d"].map((id) => ({
    id,
    displayName: `玩家${id}`,
    active: true,
    createdAt: "x",
    lastUsedAt: "x",
  }));

/** 2 男 2 女：合法边 a::b / a::d / b::c / c::d，pair 路由全程可用。 */
const participants = () => [
  { playerId: "a", active: true, pairGender: "male" as const },
  { playerId: "b", active: true, pairGender: "female" as const },
  { playerId: "c", active: true, pairGender: "male" as const },
  { playerId: "d", active: true, pairGender: "female" as const },
];

const config = (): SessionConfig => ({
  players: players(),
  relationship: "friends",
  vibes: ["funny"],
  intensity: 5,
  boundaries: DEFAULT_BOUNDARIES,
  enabledPackIds: [PACK_ID],
  mode: "single",
});

const PACK_CARDS = mainlineSsotCardsByPack(PACK_ID);
/**
 * 「Formal」用 manifest 真源 `formalFixedIdSet()` 判定（不用 `PN-TRUTH-2*` 前缀）。
 * B5（2026-09-29）：Bootstrap 7 张（`PN-TRUTH-225~231`）已过两轮独立审查并回填
 * `humanBarFit=PASS / reviewed=true` ⇒ **已是 Formal**，原「未过审候选桶」归零；
 * 这里改用 `BOOTSTRAP_CARDS` 表示「Formal 里的 Bootstrap 子集」（子集证据，不是未过审证据）。
 */
const FORMAL_IDS = formalFixedIdSet();
const FORMAL_CARDS = PACK_CARDS.filter((card) => FORMAL_IDS.has(card.id));
const BOOTSTRAP_CARDS = PACK_CARDS.filter((card) => BOOTSTRAP_ID_SET.has(card.id));
const LEGACY_CARDS = PACK_CARDS.filter((card) => !card.id.startsWith("PN-TRUTH-2"));

interface RoundEvidence {
  round: number;
  cardId: string;
  formal: boolean;
  informationGain: string | null;
  topic: string | null;
  effectiveCount: number;
  heat: string;
}

/** 真实生产链驱动：出题 → completed + 本人披露（host 持机逐人递交，轮转答题人）。 */
function driveProductionChain(deck: readonly GameCard[], maxRounds = 20): RoundEvidence[] {
  let session: GameSession = createSession(config(), [...deck], participants());
  const evidence: RoundEvidence[] = [];
  for (let i = 0; i < maxRounds; i += 1) {
    const dealt = startRound(session, () => 0, { drawSeed: FIXED_DRAW_SEED });
    if (!dealt.currentRound) break; // 耗尽：生产给不出卡（本局到此为止）
    const cardId = dealt.currentRound.cardId;
    session = resolveRoundAndReduce(
      dealt,
      "complete",
      roundDisclosureSignal({ selfDisclosed: true, disclosedPlayerIds: [["a", "b"][i % 2]!] }),
    );
    const relationship = relationshipOf(session);
    evidence.push({
      round: i + 1,
      cardId,
      formal: FORMAL_IDS.has(cardId),
      informationGain: metadataForCard(cardId).informationGain,
      topic: metadataForCard(cardId).topic,
      effectiveCount: relationship.relationshipEffectiveCardCount,
      heat: relationship.heat,
    });
  }
  return evidence;
}

/**
 * 当前真实 UI 同款驱动：`app/game/page.tsx` 的 `applyRoundSignal` 调
 * `roundDisclosureForCurrentRound()` **恒得 `undefined`** ⇒ `resolveRoundAndReduce(session, "complete", undefined)`。
 * 本函数**不提供第三参**（未判定），复刻当前生产 UI 的披露行为，用于把「口径 B」变成可执行门禁。
 */
function driveProductionChainCurrentUI(deck: readonly GameCard[], maxRounds = 20): RoundEvidence[] {
  let session: GameSession = createSession(config(), [...deck], participants());
  const evidence: RoundEvidence[] = [];
  for (let i = 0; i < maxRounds; i += 1) {
    const dealt = startRound(session, () => 0, { drawSeed: FIXED_DRAW_SEED });
    if (!dealt.currentRound) break; // 耗尽：生产给不出卡
    const cardId = dealt.currentRound.cardId;
    session = resolveRoundAndReduce(dealt, "complete"); // 无披露信号（未判定）
    const relationship = relationshipOf(session);
    evidence.push({
      round: i + 1,
      cardId,
      formal: FORMAL_IDS.has(cardId),
      informationGain: metadataForCard(cardId).informationGain,
      topic: metadataForCard(cardId).topic,
      effectiveCount: relationship.relationshipEffectiveCardCount,
      heat: relationship.heat,
    });
  }
  return evidence;
}

const lastHeat = (evidence: RoundEvidence[]): string => evidence.at(-1)!.heat;
const maxEffective = (evidence: RoundEvidence[]): number =>
  Math.max(...evidence.map((row) => row.effectiveCount));

describe("C1-8｜Formal Truth → Router → production event → effective count → Heat（真实生产链）", () => {
  it("① 全包真实牌堆（口径 A：给合法披露）：0 张 Formal 被抽到；26 张退役已移出卡源 ⇒ 有效轮 0、Heat 恒 H1（漏洞已堵）", () => {
    const evidence = driveProductionChain(PACK_CARDS);

    expect(evidence).toHaveLength(MAX_ROUNDS); // 全包牌堆足够跑满上限（legacy 卡豁免 Heat，不会断粮）

    // 本 seed 下 20 轮一张 Formal 都没抽到（H1 桶里 Formal 全是浅卡，排不上 top 强度档）。
    const formalRows = evidence.filter((row) => row.formal);
    expect(formalRows).toHaveLength(0);

    // 归因护栏（不是「卡没了」）：H1 桶里确实仍有 heatMin=1 的 Formal 卡（逐张由卡源 ∩ manifest 派生，不写死清单）。
    const h1Formal = mainlineRuntimeCards()
      .filter((card) => FORMAL_IDS.has(card.cardId) && card.heatMin <= 1 && 1 <= card.heatMax)
      .map((card) => card.cardId);
    expect(h1Formal.length).toBeGreaterThan(0);
    for (const id of ["PN-TRUTH-203", "PN-TRUTH-205", "PN-TRUTH-227", "PN-TRUTH-229"]) {
      expect(h1Formal, `${id}（KEEP 浅题）应在 H1 Formal 集合里`).toContain(id);
    }

    // ⚠️ A4a 口径变更（2026-09-29）：26 张退役旧卡已**移出运行时卡源** ⇒ 全包里再没有
    // 「带 §7.2 metadata 的非 Formal 卡」。⚠️ A9（2026-09-29）：52 张重构批经准入后**同为 Formal**，
    // 故全包内可计数卡 = Formal 全集（逐张派生），退役卡一张都不在卡源。
    const countableInPack = mainlineSsotCardsByPack(PACK_ID)
      .filter((card) => metadataForCard(card.id).informationGain !== null)
      .map((card) => card.id)
      .sort();
    expect(countableInPack).toEqual(FORMAL_CARDS.map((card) => card.id).sort());
    // 退役卡既不在卡源、也不在可计数集合里。
    for (const id of ["PN-TRUTH-201", "PN-TRUTH-216", "PN-TRUTH-217", "PN-TRUTH-225", "PN-TRUTH-231"]) {
      expect(countableInPack, `${id} 已退役，不得可计数`).not.toContain(id);
    }
    // 全包局本 seed 抽不到任何 Formal ⇒ 带 metadata 的轮 = 0 ⇒ 有效轮 0、Heat 恒 H1。
    const withMeta = evidence.filter((row) => row.informationGain !== null && row.topic !== null);
    expect(withMeta).toEqual([]);
    expect(maxEffective(evidence)).toBe(0);
    expect(lastHeat(evidence)).toBe("H1");

    // Heat 仍是 effective count 的纯派生（逐轮不变式，判定口径一字未改）。
    for (const row of evidence) {
      expect(row.heat, `${row.cardId} 轮次 Heat 必须是 effective count 的纯派生`).toBe(
        heatForEffectiveCount(row.effectiveCount),
      );
    }
  }, EXPLICIT_TIMEOUT_MS);

  it("② 仅 Formal 子集（真实生产卡子集，逐张由 manifest 派生）：每轮都有效 ⇒ Heat 随有效轮逐档推进", () => {
    // 张数由 manifest 真源派生（不写死）：Formal 卡必须恰好是这套集合。
    expect(FORMAL_CARDS).toHaveLength(FORMAL_IDS.size);
    expect(FORMAL_CARDS.map((card) => card.id).sort()).toEqual([...FORMAL_IDS].sort());
    // KEEP 5（A3/A4a 冻结）必须仍全部在 Formal 里（未被退役/降级）。
    for (const id of ["PN-TRUTH-203", "PN-TRUTH-205", "PN-TRUTH-209", "PN-TRUTH-227", "PN-TRUTH-229"]) {
      expect(FORMAL_IDS.has(id), `${id} 应保持 Formal`).toBe(true);
    }

    const evidence = driveProductionChain(FORMAL_CARDS);

    // 牌堆只有 Formal 卡 ⇒ 每一张 completed 都是有效信息轮
    expect(evidence.every((row) => row.formal)).toBe(true);
    expect(evidence.every((row) => row.informationGain !== null && row.topic !== null)).toBe(true);
    expect(evidence.map((row) => row.effectiveCount)).toEqual(
      evidence.map((_, index) => index + 1),
    );

    const firstReach = (heat: string): number | null => {
      const index = evidence.findIndex((row) => row.heat === heat);
      return index === -1 ? null : index + 1;
    };
    const measured: Record<string, number | null> = {
      H1: firstReach("H1"),
      H2: firstReach("H2"),
      H3: firstReach("H3"),
      H4: firstReach("H4"),
    };
    // 牌堆只有 Formal、每张可计数 ⇒ 抽满上限（或牌堆耗尽即停），有效轮 = 抽出的张数。
    expect(evidence).toHaveLength(Math.min(FORMAL_CARDS.length, MAX_ROUNDS));
    expect(maxEffective(evidence)).toBe(evidence.length);
    // 终态 Heat 一律由实测的逐档首达派生（不写死档位：A3 断档态是 H2，A9 准入后可达更高档）。
    expect(measured.H1).toBe(1);
    const reached = HEAT_ORDER.filter((heat) => measured[heat] !== null);
    expect(reached.length).toBeGreaterThan(0);
    expect(lastHeat(evidence)).toBe(reached.at(-1));
    // 与落盘产物 `FORMAL-TRUTH-PRODUCTION-CHAIN.json#scenarioFormalOnly` 同源同口径。
  }, EXPLICIT_TIMEOUT_MS);

  it("②b 仅运行时 Bootstrap 2 张（227/229，均属 Formal）：2 张可计数但 < H2 门槛 4 ⇒ 抽满 2 张即交 Host（Heat 仍在 H1）", () => {
    // A4a：Bootstrap 原始 7 张里 5 张（225/226/228/230/231）已退役移出卡源，运行时只剩 227/229。
    expect(BOOTSTRAP_ID_SET.size).toBe(2);
    expect(BOOTSTRAP_CARDS).toHaveLength(BOOTSTRAP_ID_SET.size);
    expect(BOOTSTRAP_CARDS).toHaveLength(2);
    const bootstrapFormal = BOOTSTRAP_CARDS.filter((card) => FORMAL_IDS.has(card.id)).map((card) => card.id).sort();
    expect(bootstrapFormal).toEqual(["PN-TRUTH-227", "PN-TRUTH-229"]);
    const evidence = driveProductionChain(BOOTSTRAP_CARDS);
    // 2 张都带 metadata ⇒ 每一轮都是有效信息轮（Formal 归属只影响曝光统计，不影响计数口径）。
    expect(evidence.every((row) => row.informationGain !== null && row.topic !== null)).toBe(true);
    expect(evidence.map((row) => row.effectiveCount)).toEqual(evidence.map((_, index) => index + 1));
    expect(evidence).toHaveLength(2); // 抽满 2 张后桶空、本包无更深档 ⇒ 交 Host
    expect(maxEffective(evidence)).toBe(2);
    // 2 < H2 门槛 4（effective>=4）⇒ H2 不可达，Heat 仍 H1。
    expect(evidence.findIndex((row) => row.heat === "H2")).toBe(-1);
    expect(lastHeat(evidence)).toBe("H1");
  }, EXPLICIT_TIMEOUT_MS);

  it("③ 负向对照：仅 legacy 卡（无第一包）⇒ sidecar 恒 null，有效计数恒 0、Heat 恒 H1（fail-closed）", () => {
    const evidence = driveProductionChain(LEGACY_CARDS);
    expect(evidence.length).toBeGreaterThan(0);
    expect(evidence.every((row) => !row.formal)).toBe(true);
    expect(evidence.every((row) => row.informationGain === null && row.topic === null)).toBe(true);
    expect(maxEffective(evidence)).toBe(0);
    expect(evidence.every((row) => row.heat === "H1")).toBe(true);
  }, EXPLICIT_TIMEOUT_MS);

  it("④ 当前真实 UI 口径（A5）：roundDisclosureForCurrentRound 恒 undefined ⇒ 无披露生产者，Formal 卡抽到也不计有效轮、Heat 恒 H1", () => {
    /* (1) 生产者级：源码扫描证明生产页面没有产出 disclosure signal（口径 B 的根因）。 */
    const page = readFileSync(join(process.cwd(), "app/game/page.tsx"), "utf8");
    const start = page.indexOf("function roundDisclosureForCurrentRound(");
    expect(start).toBeGreaterThan(-1);
    const producerBody = page.slice(start, page.indexOf("\n}", start));
    expect(producerBody, "当前 UI 的披露生产者必须恒返回 undefined").toMatch(/return undefined;/);
    // 一旦未来接入真实采集通道，本条会变红 —— 届时须同步撤销「口径 B」表述并重跑 MC。
    expect(producerBody).not.toMatch(/return roundDisclosureSignal/);
    expect(producerBody).not.toMatch(/selfDisclosed/);
    // 页面确实把这个「未判定」结果喂给唯一轮终态入口 applyRoundSignal。
    const applyStart = page.indexOf("function applyRoundSignal");
    expect(applyStart).toBeGreaterThan(-1);
    expect(page.slice(applyStart, page.indexOf("\n}", applyStart))).toMatch(
      /roundDisclosureForCurrentRound\(\)/,
    );

    /* (2) 行为级：即便牌堆全是可计数的 Formal 卡，没有披露信号 ⇒ fail-closed ⇒ 有效计数 0 / Heat H1。 */
    const evidence = driveProductionChainCurrentUI(FORMAL_CARDS);
    expect(evidence.length).toBeGreaterThan(0);
    expect(evidence.every((row) => row.formal)).toBe(true);
    // sidecar 有 metadata（不是「卡没标」）……
    expect(evidence.every((row) => row.informationGain !== null && row.topic !== null)).toBe(true);
    // ……但缺「本人披露」⇒ 一个有效轮都不计，Heat 纹丝不动。
    expect(evidence.map((row) => row.effectiveCount)).toEqual(evidence.map(() => 0));
    expect(maxEffective(evidence)).toBe(0);
    expect(evidence.every((row) => row.heat === "H1")).toBe(true);
    expect(lastHeat(evidence)).toBe("H1");
  }, EXPLICIT_TIMEOUT_MS);
});
