/**
 * C1-8｜第一包「Formal Fixed 真心话」单包 Router Monte Carlo（truth-dare）。
 *
 * ## 与 A.1/A.2 全套 MC 的关系（本脚本独立，不改 A.1 脚本、不覆盖 A.1/A.2 留痕）
 * A.1/A.2 的 `scripts/audit-a1-router-montecarlo.ts` 跑 6 玩法跨包、用 `_reviews-a1` 的历史中文口径；
 * 本脚本**只跑 truth-dare 单包**，质量口径换成本包 Plan §3 metadata（走生产 sidecar
 * `metadataForCard`），并把 A.1 未区分的一件事显式分列：**Formal 卡曝光与 legacy 卡曝光**。
 *
 * ## 双 Router 卡源一致性（C1-8 的前置修复）
 * 本脚本用 `createV2MainlineRouter`（审计 / MC 侧 Router）。C1-8 已把它与生产
 * `createDeckRouter` 统一到桥接模块的同一份卡源 `mainlineRuntimeCards()`
 * （SSOT 主线 350 + 第一包 `PN-TRUTH-201~224` + Truth H1 Bootstrap `PN-TRUTH-225~231`），
 * 故本 MC 抽得到全部 Formal 卡，与生产牌堆同内容。**Formal 张数不写死**：由 manifest 真源
 * `formalFixedIdSet()` 动态判定，当前值见产物 `cardSource.formalTotal`。
 *
 * ## 两种 Heat 起点（任务硬要求，必须分列）
 * - **Mode A｜生产实况**：本局**不供给任何披露信号**（`eventForRoundTerminal` 不带 disclosure）
 *   ⇒ `isEffectiveInformationRound` fail-closed 恒 false ⇒ `relationshipEffectiveCardCount` 恒 0
 *   ⇒ **Heat 恒 H1**。这就是当前生产（disclosure 通道未落地）的实况。
 * - **Mode B｜disclosure 生产链口径**：每个 completed 轮显式给
 *   `{ selfDisclosed: true, disclosedPlayerIds: [本轮答题人] }`（与 `roundDisclosureSignal`
 *   同形，走同一条 `reduceV2SessionEvents` 归约；host 持机逐人递交 → 每人一次本人披露）。
 *   此时**只有带 Plan §3 metadata 的 Formal 卡**才算有效信息轮（legacy 卡 sidecar 恒 null
 *   ⇒ 仍 fail-closed 不计数），Heat 随有效信息轮推进。
 *
 * 参数与 A.1 同口径且**不放宽**：4 桌型 × 1000 局、每局 20 completed rounds、guard 上限 1000、
 * 显式超时（脚本本身非 vitest，无全局超时）；不调阈值、不降样本。
 *
 * 产物（新文件名，不覆盖 A.1/A.2 留痕）：
 * - `docs/qa/content-audit/FORMAL-TRUTH-MC.json`
 * - `docs/qa/content-audit/FORMAL-TRUTH-MC-WORST-TRACE.json`
 * - `docs/qa/content-audit/FORMAL-TRUTH-MC.md`（文字报告 + 缺口清单）
 */
import { writeFileSync } from "node:fs";

import {
  applyV2HostDecision,
  createV2SessionState,
  drawV2SessionCard,
  reduceV2SessionEvents,
  type V2SessionState,
} from "@/lib/v2-relationship/v2-session";
import { createV2MainlineRouter } from "@/lib/v2-relationship/v2-router";
import { eventForRoundTerminal } from "@/lib/engine/v2-deal";
import { mainlineRuntimeCards, mainlineSsotCardsByPack } from "@/lib/v2-content/v2-card-bridge";
import { metadataForCard } from "@/lib/v2-content/v2-card-quality-index";
import { formalFixedIdSet } from "@/lib/v2-content/fixed-content-manifest";
import { HEAT_ORDER, MUTUAL_CHECK_COUNTS, SOFT_DEDUP_WINDOW } from "@/lib/v2-relationship/v2-state";
import type { Heat, SessionParticipant } from "@/lib/v2-relationship/v2-state";

const ROOT = process.cwd();
const DIR = `${ROOT}/docs/qa/content-audit`;
const PACK_ID = "truth-dare";

/* ------------------------------------------------------------------ */
/* 确定性 PRNG                                                          */
/* ------------------------------------------------------------------ */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* 桌型                                                                  */
/* ------------------------------------------------------------------ */
interface TableSpec { key: string; label: string; males: number; females: number; }
const TABLES: TableSpec[] = [
  { key: "2m2f", label: "2男2女", males: 2, females: 2 },
  { key: "1m3f", label: "1男3女", males: 1, females: 3 },
  { key: "2m3f", label: "2男3女", males: 2, females: 3 },
  { key: "1m4f", label: "1男4女", males: 1, females: 4 },
];
const PARTICIPANTS: SessionParticipant[] = (() => {
  const list: SessionParticipant[] = [];
  for (let i = 0; i < 4; i += 1) list.push({ playerId: `m${i}`, active: true, pairGender: "male" });
  for (let i = 0; i < 4; i += 1) list.push({ playerId: `f${i}`, active: true, pairGender: "female" });
  return list;
})();
const tableParticipants = (spec: TableSpec): SessionParticipant[] => {
  const males = PARTICIPANTS.filter((p) => p.pairGender === "male").slice(0, spec.males).map((p, i) => ({ ...p, playerId: `m${i}` }));
  const females = PARTICIPANTS.filter((p) => p.pairGender === "female").slice(0, spec.females).map((p, i) => ({ ...p, playerId: `f${i}` }));
  return [...males, ...females];
};

/* ------------------------------------------------------------------ */
/* 单包内容事实（来源 = 桥接卡源；与生产牌堆同内容）                        */
/* ------------------------------------------------------------------ */
const packGameCards = mainlineSsotCardsByPack(PACK_ID);
const packRuntimeCards = mainlineRuntimeCards().filter((card) => card.gameType === "truth" || card.gameType === "dare");
const FORMAL_SET = formalFixedIdSet();
const isFormal = (cardId: string): boolean => FORMAL_SET.has(cardId);

/** 静态每 Heat 桶库存（Formal 按 heatMin/heatMax 区间；legacy 卡不受 Heat 硬过滤 ⇒ 各档恒可用）。 */
const staticHeatAvailability = HEAT_ORDER.map((heat, idx) => {
  const rank = idx + 1;
  const packCards = packRuntimeCards;
  const legal = packCards.filter((card) => (isFormal(card.cardId) ? rank >= card.heatMin && rank <= card.heatMax : true));
  const formalLegalIds = legal.filter((c) => isFormal(c.cardId)).map((c) => c.cardId).sort();
  return {
    heat,
    packTotal: packCards.length,
    legalCount: legal.length,
    formalLegal: formalLegalIds.length,
    formalLegalIds,
    legacyLegal: legal.filter((c) => !isFormal(c.cardId)).length,
  };
});
const formalTotal = packRuntimeCards.filter((c) => isFormal(c.cardId)).length;
const legacyTotal = packRuntimeCards.length - formalTotal;

/** 第一包 Formal 卡的画像（供缺口清单给「补什么 topic / heatMax / intensity」的量化依据）。 */
const bump = (m: Record<string, number>, key: string | number) => { m[String(key)] = (m[String(key)] ?? 0) + 1; };
const formalProfiles = (() => {
  const byIntensity: Record<string, number> = {}; const byHeatMax: Record<string, number> = {}; const byTopic: Record<string, number> = {};
  for (const card of packRuntimeCards) {
    if (!isFormal(card.cardId)) continue;
    bump(byIntensity, card.intensity);
    bump(byHeatMax, card.heatMax);
    const meta = metadataForCard(card.cardId);
    if (meta.topic) bump(byTopic, meta.topic);
  }
  return { byIntensity, byHeatMax, byTopic };
})();

/**
 * 第一包 **H1 桶可抽 Formal** 的画像（`heatMin=1` 且 H1 桶合法者）——即当前真实 UI（Heat 恒 H1）
 * 下实际进得了桶的 Formal 集合。报告侧据此派生「能抽到几张 / 强度构成 / 题材构成」，
 * **不允许在报告里写死张数或「全为 I1」这类结论**。
 */
const h1Formal = (() => {
  const ids = staticHeatAvailability[0]!.formalLegalIds;
  const set = new Set(ids);
  const byIntensity: Record<string, number> = {}; const byHeatMax: Record<string, number> = {}; const byTopic: Record<string, number> = {};
  for (const card of packRuntimeCards) {
    if (!set.has(card.cardId)) continue;
    bump(byIntensity, card.intensity);
    bump(byHeatMax, card.heatMax);
    const meta = metadataForCard(card.cardId);
    if (meta.topic) bump(byTopic, meta.topic);
  }
  return { count: ids.length, ids, byIntensity, byHeatMax, byTopic };
})();

/**
 * 第一包 Formal 卡按 `heatMin` 的分布（供报告派生「累积可计数库存」对比 H2/H3/H4 门槛，
 * 不写死张数）：`heatMin≤1` = H1 冷启能累积的有效轮上限；`heatMin≤2` / `heatMin≤3` 类推。
 */
const formalHeatMinDistribution = (() => {
  const m: Record<string, number> = {};
  for (const card of packRuntimeCards) {
    if (!isFormal(card.cardId)) continue;
    bump(m, card.heatMin);
  }
  return m;
})();
/** `heatMin ≤ n` 的 Formal 卡累计数（报告冷启门结论的唯一派生源）。 */
const formalCountableUpTo = (n: number): number =>
  Object.entries(formalHeatMinDistribution).reduce((sum, [min, count]) => (Number(min) <= n ? sum + count : sum), 0);

/* ------------------------------------------------------------------ */
/* 模拟主体                                                              */
/* ------------------------------------------------------------------ */
type TerminationReason = "round_limit" | "pack_exhausted" | "global_exhausted" | "awaiting_host" | "guard_limit";

interface TraceRound {
  round: number;
  cardId: string;
  formal: boolean;
  heatAtDraw: string;
  heatAfterTerminal: string;
  targetPairKey: string | null;
  terminal: "completed" | "skipped";
  informationGain: string | null;
  topic: string | null;
  selfDisclosed: boolean;
  effective: boolean;
}

interface SessionStat {
  table: string;
  intensityLimit: number;
  mode: "A" | "B";
  completedRounds: number;
  terminationReason: TerminationReason;
  deadEnd: boolean;
  truncated: boolean;
  guardUsed: number;
  drawOrdinal: number;
  formalDraws: number;
  formalBytes: Record<string, number>;
  heatAtDraw: Record<string, number>;
  heatAfterTerminal: Record<string, number>;
  maxHeatReached: Heat;
  effectiveRounds: number;
  effectiveByGain: Record<string, number>;
  effectiveTopics: Record<string, number>;
  repeatedDraws: number;
  firstFive: string[];
  longestLowZeroRun: number;
}

const SESSIONS_PER_TABLE = 1000;
const TARGET_ROUNDS = 20;
const GUARD_LIMIT = 1000;
const COMPLETED_PROBABILITY = 0.85;

function seedFor(spec: TableSpec, i: number): number {
  return 20260928 + i * 7919 + (TABLES.indexOf(spec) + 1) * 104729;
}

/** 本轮答题人（host 持机逐人递交 → 轮转，保证「≥2 名候选各有本人披露」可被判据看到）。 */
const answererFor = (spec: TableSpec, roundIndex: number): string => {
  const participants = tableParticipants(spec);
  return participants[roundIndex % participants.length]!.playerId;
};

function simulateOne(
  spec: TableSpec,
  seed: number,
  mode: "A" | "B",
  intensityLimitOverride: number | null = null,
  trace?: TraceRound[],
): SessionStat {
  const rnd = mulberry32(seed);
  const participants = tableParticipants(spec);
  const intensityLimit = intensityLimitOverride ?? 1 + Math.floor(rnd() * 5);
  let state: V2SessionState = createV2SessionState({ sessionId: `mcf-${spec.key}-${seed}`, participants });
  const router = createV2MainlineRouter({ packId: PACK_ID });

  const stat: SessionStat = {
    table: spec.key, intensityLimit, mode, completedRounds: 0,
    terminationReason: "round_limit", deadEnd: false, truncated: false, guardUsed: 0,
    drawOrdinal: 0, formalDraws: 0, formalBytes: {}, heatAtDraw: {}, heatAfterTerminal: {},
    maxHeatReached: "H1", effectiveRounds: 0, effectiveByGain: {}, effectiveTopics: {},
    repeatedDraws: 0,
    firstFive: [], longestLowZeroRun: 0,
  };
  let completed = 0;
  let guard = 0;
  let run = 0;
  let lastKind: TerminationReason | null = null;
  let lastDrawExhausted = false;

  while (completed < TARGET_ROUNDS && guard < GUARD_LIMIT) {
    guard += 1;
    const outcome = drawV2SessionCard(state, router, { intensityLimit });

    if (outcome.kind === "CARD") {
      lastDrawExhausted = false;
      lastKind = null;
      const cardId = outcome.cardId;
      stat.drawOrdinal += 1;
      if (state.relationship.usedCardIds.includes(cardId)) stat.repeatedDraws += 1;
      // 与生产 `startRound` 同口径：**出牌即记 used**。
      // （A.1 harness 只靠 R3 终态记 used，于是「非有效 completed 轮」会把同一张卡反复抽出；
      //  生产在 deal 时就把 cardId 写进 session.usedCardIds。本脚本按生产语义在抽卡时写入，
      //  去掉该失真，让候选池随局推进真实收缩。）
      state = {
        ...state,
        relationship: {
          ...state.relationship,
          usedCardIds: [...new Set([...state.relationship.usedCardIds, cardId])],
        },
      };
      const formal = isFormal(cardId);
      if (formal) {
        stat.formalDraws += 1;
        stat.formalBytes[cardId] = (stat.formalBytes[cardId] ?? 0) + 1;
      }
      const heatAtDraw = state.relationship.heat;
      if (stat.firstFive.length < 5) stat.firstFive.push(cardId);

      const terminal = rnd() < COMPLETED_PROBABILITY ? "completed" : "skipped";
      const disclosure =
        mode === "B" && terminal === "completed"
          ? { selfDisclosed: true as const, disclosedPlayerIds: [answererFor(spec, completed)] }
          : undefined;
      const roundLike = { id: `r${completed}-${guard}`, packId: PACK_ID, cardId, participantIds: [] as string[] };
      const ev = eventForRoundTerminal(roundLike as never, terminal as never, new Date(0).toISOString(), disclosure);
      state = reduceV2SessionEvents(state, [ev]).state;
      state = {
        ...state,
        relationship: { ...state.relationship, usedCardIds: [...new Set(state.relationship.usedCardIds)] },
      };
      const heatAfterTerminal = state.relationship.heat;
      stat.heatAtDraw[heatAtDraw] = (stat.heatAtDraw[heatAtDraw] ?? 0) + 1;
      stat.heatAfterTerminal[heatAfterTerminal] = (stat.heatAfterTerminal[heatAfterTerminal] ?? 0) + 1;
      if (HEAT_ORDER.indexOf(state.relationship.heat) > HEAT_ORDER.indexOf(stat.maxHeatReached)) {
        stat.maxHeatReached = state.relationship.heat;
      }

      if (terminal === "completed") {
        completed += 1;
        const meta = metadataForCard(cardId);
        const gain = meta.informationGain;
        const topic = meta.topic;
        const effective =
          disclosure?.selfDisclosed === true &&
          gain !== null &&
          gain !== "zero" &&
          gain !== "low" &&
          topic !== null;
        if (effective) {
          stat.effectiveRounds += 1;
          stat.effectiveByGain[gain!] = (stat.effectiveByGain[gain!] ?? 0) + 1;
          stat.effectiveTopics[topic!] = (stat.effectiveTopics[topic!] ?? 0) + 1;
          run = 0;
        } else {
          run += 1;
          stat.longestLowZeroRun = Math.max(stat.longestLowZeroRun, run);
        }
        if (trace) {
          trace.push({
            round: stat.drawOrdinal, cardId, formal, heatAtDraw, heatAfterTerminal,
            targetPairKey: outcome.targetPairKey, terminal,
            informationGain: gain ?? null, topic: topic ?? null,
            selfDisclosed: disclosure?.selfDisclosed === true, effective,
          });
        }
      }
      continue;
    }

    /* 单包无「切包」出口：任何耗尽都判本局 dead-end（生产在单玩局同样给不出该玩法的卡）。 */
    lastKind =
      outcome.kind === "PACK_EXHAUSTED" ? "pack_exhausted"
        : outcome.kind === "RELATIONSHIP_GLOBAL_EXHAUSTED" ? "global_exhausted"
          : "awaiting_host";
    if (outcome.kind === "AWAITING_HOST_EXHAUSTION_DECISION" && !lastDrawExhausted) {
      // 生产 Host 先「洗牌再玩」（清 used、cycle+1）；洗牌仍抽不出 → dead-end。
      state = applyV2HostDecision(outcome.state, { decision: "reshuffle", exhaustionCycle: outcome.exhaustionCycle }).state;
      lastDrawExhausted = true;
      continue;
    }
    state = outcome.state;
    break;
  }

  stat.completedRounds = completed;
  stat.guardUsed = guard;
  stat.terminationReason = completed >= TARGET_ROUNDS
    ? "round_limit"
    : guard >= GUARD_LIMIT
      ? "guard_limit"
      : lastKind ?? "guard_limit";
  stat.truncated = stat.terminationReason === "guard_limit" && stat.completedRounds < TARGET_ROUNDS;
  stat.deadEnd = stat.terminationReason !== "round_limit";
  return stat;
}

/* ------------------------------------------------------------------ */
/* 聚合                                                                  */
/* ------------------------------------------------------------------ */
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const countTermination = (stats: SessionStat[]): Record<string, number> => {
  const reasons: TerminationReason[] = ["round_limit", "pack_exhausted", "global_exhausted", "awaiting_host", "guard_limit"];
  return Object.fromEntries(reasons.map((r) => [r, stats.filter((s) => s.terminationReason === r).length]));
};
const orderHeat = (m: Record<string, number>): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const h of HEAT_ORDER) out[h] = m[h] ?? 0;
  return out;
};
const sumRecords = (stats: SessionStat[], pick: (s: SessionStat) => Record<string, number>): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const s of stats) for (const [k, v] of Object.entries(pick(s))) out[k] = (out[k] ?? 0) + v;
  return out;
};
const share = (m: Record<string, number>, total: number): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(m)) out[k] = +(v / (total || 1)).toFixed(4);
  return out;
};

function summarize(stats: SessionStat[], mode: "A" | "B") {
  const finished = stats.filter((s) => s.completedRounds >= TARGET_ROUNDS);
  const heatAtDraw = sumRecords(stats, (s) => s.heatAtDraw);
  const totalDraws = Object.values(heatAtDraw).reduce((a, b) => a + b, 0);
  const formalDraws = stats.reduce((a, s) => a + s.formalDraws, 0);
  const formalExposed = new Set<string>();
  for (const s of stats) for (const id of Object.keys(s.formalBytes)) formalExposed.add(id);
  const gainTotals = sumRecords(stats, (s) => s.effectiveByGain);
  const topicTotals = sumRecords(stats, (s) => s.effectiveTopics);
  const firstFive = new Map<string, number>();
  for (const s of stats) {
    const key = s.firstFive.join(">");
    firstFive.set(key, (firstFive.get(key) ?? 0) + 1);
  }
  let topFirstFive = 0;
  for (const v of firstFive.values()) topFirstFive = Math.max(topFirstFive, v);
  const reaching = (heat: Heat) =>
    stats.filter((s) => HEAT_ORDER.indexOf(s.maxHeatReached) >= HEAT_ORDER.indexOf(heat)).length;

  return {
    mode,
    sessions: stats.length,
    sessionsCompleted20: finished.length,
    sessionRate: +(finished.length / stats.length).toFixed(4),
    completedRoundsMean: +mean(stats.map((s) => s.completedRounds)).toFixed(2),
    deadEndSessions: stats.filter((s) => s.deadEnd).length,
    deadEndRate: +(stats.filter((s) => s.deadEnd).length / stats.length).toFixed(4),
    termination: countTermination(stats),
    truncatedSessions: stats.filter((s) => s.truncated).length,
    guardUsedMax: Math.max(...stats.map((s) => s.guardUsed)),
    totalDraws,
    drawsPerSession: +mean(stats.map((s) => s.drawOrdinal)).toFixed(2),
    formalDraws,
    formalShare: +(formalDraws / (totalDraws || 1)).toFixed(4),
    formalExposedDistinct: formalExposed.size,
    formalExposedIds: [...formalExposed].sort(),
    formalTotal,
    legacyTotal,
    heatAtDraw: orderHeat(heatAtDraw),
    heatAtDrawShare: share(orderHeat(heatAtDraw), totalDraws),
    heatAfterTerminal: orderHeat(sumRecords(stats, (s) => s.heatAfterTerminal)),
    sessionsReachingH2: reaching("H2"),
    sessionsReachingH3: reaching("H3"),
    sessionsReachingH4: reaching("H4"),
    repeatedDraws: stats.reduce((a, s) => a + s.repeatedDraws, 0),
    effectiveRoundsTotal: stats.reduce((a, s) => a + s.effectiveRounds, 0),
    effectivePerSession: +mean(stats.map((s) => s.effectiveRounds)).toFixed(2),
    effectiveByGain: Object.fromEntries(Object.entries(gainTotals).sort()),
    effectiveTopics: Object.fromEntries(Object.entries(topicTotals).sort((a, b) => b[1] - a[1])),
    distinctTopicsCovered: Object.keys(topicTotals).length,
    topicsPerSessionMean: +mean(stats.map((s) => Object.keys(s.effectiveTopics).length)).toFixed(2),
    highEffectivePerSession: +mean(stats.map((s) => s.effectiveByGain.high ?? 0)).toFixed(2),
    longestLowZeroRunMean: +mean(finished.map((s) => s.longestLowZeroRun)).toFixed(2),
    sessionsZeroFormal: stats.filter((s) => s.formalDraws === 0).length,
    sessionsZeroEffective: stats.filter((s) => s.effectiveRounds === 0).length,
    sessionsMediumPlus5: stats.filter(
      (s) => (s.effectiveByGain.high ?? 0) + (s.effectiveByGain.medium ?? 0) >= 5,
    ).length,
    sessionsHighAtLeast1: stats.filter((s) => (s.effectiveByGain.high ?? 0) >= 1).length,
    sessionsTopicsAtLeast3: stats.filter((s) => Object.keys(s.effectiveTopics).length >= 3).length,
    distinctFirstFive: firstFive.size,
    topFirstFiveShare: +(topFirstFive / stats.length).toFixed(4),
    mutualWindowReached: stats.filter((s) => s.effectiveRounds >= MUTUAL_CHECK_COUNTS[0]).length,
  };
}

/* ------------------------------------------------------------------ */
/* 主扫描：Mode A / Mode B                                               */
/* ------------------------------------------------------------------ */
interface RunEntry { spec: TableSpec; index: number; stat: SessionStat; }

const runAll = (mode: "A" | "B"): RunEntry[] => {
  const all: RunEntry[] = [];
  for (const spec of TABLES) {
    for (let i = 0; i < SESSIONS_PER_TABLE; i += 1) {
      all.push({ spec, index: i, stat: simulateOne(spec, seedFor(spec, i), mode) });
    }
  }
  return all;
};

const entriesA = runAll("A");
const entriesB = runAll("B");
const modeA = entriesA.map((e) => e.stat);
const modeB = entriesB.map((e) => e.stat);

/* ceiling 断粮：从主扫描按 intensityLimit 分档（intensityLimit 在 [1,5] 均匀取样 ⇒ 每档约 1/5）。
   与 A.1 的 cohortByIntensityLimit 同口径，不另起一套样本；A5 起覆盖全部 5 档（1~5）。 */
const CEILING_LIMITS = [1, 2, 3, 4, 5] as const;
const ceilingCohorts = (["A", "B"] as const).flatMap((mode) => {
  const stats = mode === "A" ? modeA : modeB;
  return CEILING_LIMITS.map((limit) => {
    const cohort = stats.filter((s) => s.intensityLimit === limit);
    const finished = cohort.filter((s) => s.completedRounds >= TARGET_ROUNDS);
    return {
      mode,
      intensityLimit: limit,
      sessions: cohort.length,
      deadEndSessions: cohort.filter((s) => s.deadEnd).length,
      deadEndRate: +(cohort.filter((s) => s.deadEnd).length / (cohort.length || 1)).toFixed(4),
      completedRoundsMean: +mean(cohort.map((s) => s.completedRounds)).toFixed(2),
      formalShare: +(
        cohort.reduce((a, s) => a + s.formalDraws, 0) /
        (cohort.reduce((a, s) => a + s.drawOrdinal, 0) || 1)
      ).toFixed(4),
      formalDrawsOnFinished: +mean(finished.map((s) => s.formalDraws)).toFixed(2),
      effectivePerSession: +mean(cohort.map((s) => s.effectiveRounds)).toFixed(2),
      termination: countTermination(cohort),
    };
  });
});

/* ------------------------------------------------------------------ */
/* 最差 trace（Mode B：选 dead-end 优先 / 完成轮最少 / 最低 Formal 曝光）    */
/* ------------------------------------------------------------------ */
const rankWorst = (a: SessionStat, b: SessionStat): number => {
  if (a.deadEnd !== b.deadEnd) return a.deadEnd ? -1 : 1; // dead-end 更差
  if (a.effectiveRounds !== b.effectiveRounds) return a.effectiveRounds - b.effectiveRounds; // 有效信息轮更少更差
  if (a.completedRounds !== b.completedRounds) return a.completedRounds - b.completedRounds;
  if (a.formalDraws !== b.formalDraws) return a.formalDraws - b.formalDraws; // Formal 曝光更少更差
  return b.longestLowZeroRun - a.longestLowZeroRun; // 低/0 信息连击更长更差
};
const sortedWorst = [...entriesB].sort((a, b) => rankWorst(a.stat, b.stat));
const worstEntry = sortedWorst[0]!;
const worst = worstEntry.stat;
const worstTrace: TraceRound[] = [];
simulateOne(worstEntry.spec, seedFor(worstEntry.spec, worstEntry.index), "B", null, worstTrace);

const worstTraceOut = {
  generator: "scripts/audit-formal-truth-montecarlo.ts",
  pack: PACK_ID,
  mode: "B",
  table: worst.table,
  seed: seedFor(worstEntry.spec, worstEntry.index),
  intensityLimit: worst.intensityLimit,
  selectionRule: "dead-end 优先 → 有效信息轮最少 → 完成轮最少 → Formal 曝光最少 → 最长低/0 信息连击最大",
  worstStat: {
    completedRounds: worst.completedRounds,
    terminationReason: worst.terminationReason,
    deadEnd: worst.deadEnd,
    formalDraws: worst.formalDraws,
    effectiveRounds: worst.effectiveRounds,
    longestLowZeroRun: worst.longestLowZeroRun,
    heatAtDraw: orderHeat(worst.heatAtDraw),
  },
  rounds: worstTrace,
};

/* ------------------------------------------------------------------ */
/* 落盘                                                                  */
/* ------------------------------------------------------------------ */
const out = {
  generator: "scripts/audit-formal-truth-montecarlo.ts",
  pack: PACK_ID,
  packLabel: "真心话（truth-dare）",
  router: "createV2MainlineRouter（审计 / MC 侧）— C1-8 起与生产 createDeckRouter 共享桥接卡源 mainlineRuntimeCards()",
  cardSource: {
    description: "mainlineSsotCardsByPack('truth-dare')（SSOT 主线 + 第一包正式内容）",
    packTotal: packGameCards.length,
    formalTotal,
    legacyTotal,
  },
  config: {
    sessionsPerTable: SESSIONS_PER_TABLE,
    targetCompletedRounds: TARGET_ROUNDS,
    guardLimit: GUARD_LIMIT,
    completedProbability: COMPLETED_PROBABILITY,
    softDedupWindow: SOFT_DEDUP_WINDOW,
    tables: TABLES.map((t) => ({ key: t.key, label: t.label, players: t.males + t.females })),
    seedFormula: "20260928 + i*7919 + (tableIndex+1)*104729",
    totalSessionsPerMode: TABLES.length * SESSIONS_PER_TABLE,
    modes: {
      A: "生产实况：不给披露信号 ⇒ Heat 恒 H1（disclosure 通道未落地）",
      B: "disclosure 生产链口径：每 completed 轮给 selfDisclosed + disclosedPlayerIds ⇒ Formal 卡推进有效计数与 Heat",
    },
  },
  staticHeatAvailability,
  formalProfiles,
  h1Formal,
  formalHeatMinDistribution,
  formalCountableUpTo: {
    heatMinLe1: formalCountableUpTo(1),
    heatMinLe2: formalCountableUpTo(2),
    heatMinLe3: formalCountableUpTo(3),
    heatMinLe4: formalCountableUpTo(4),
  },
  modeA: summarize(modeA, "A"),
  modeB: summarize(modeB, "B"),
  ceilingCohorts,
  worstTraceFile: "docs/qa/content-audit/FORMAL-TRUTH-MC-WORST-TRACE.json",
  readingGuide: [
    "Formal 曝光占比＝抽到 Formal（manifest 轨 tracks.formalFixed；A3 后为 KEEP 5）的次数 / 总抽卡次数；退出 Formal 的旧卡与 SSOT 旧卡都按 legacy 口径处理（不受 Heat 硬过滤）。",
    "Mode A 的 heatAtDraw 恒 H1 是「无披露通道」的确定性结果，不是 Router 抖动。",
    "Mode B 的有效信息轮只取决于抽到的卡是否带 Plan §3 metadata（informationGain/topic，走生产 sidecar），与是否仍在 Formal 无关——A3 退出的 26 张仍带 metadata，抽到仍计有效轮；真正无 metadata 的 SSOT 旧卡 sidecar 为 null ⇒ fail-closed 不计数。",
    "所有数字由本脚本机械产出，报告侧不得手写。",
  ].join(" "),
};

writeFileSync(`${DIR}/FORMAL-TRUTH-MC.json`, JSON.stringify(out, null, 2));
writeFileSync(`${DIR}/FORMAL-TRUTH-MC-WORST-TRACE.json`, JSON.stringify(worstTraceOut, null, 2));

console.log("第一包真心话单包 Monte Carlo 完成（truth-dare，两 mode）");
console.log("卡源：pack", packGameCards.length, "｜Formal", formalTotal, "｜legacy", legacyTotal);
console.log("静态每 Heat 可用库存：", staticHeatAvailability.map((h) => `${h.heat}=${h.legalCount}(formal ${h.formalLegal})`).join(" "));
console.log(
  `第一包 H1 可抽 Formal：${h1Formal.count} 张｜intensity ${JSON.stringify(h1Formal.byIntensity)}`,
  `｜累积可计数库存 heatMin≤1/≤2/≤3 = ${formalCountableUpTo(1)}/${formalCountableUpTo(2)}/${formalCountableUpTo(3)}`,
);
for (const s of [out.modeA, out.modeB]) {
  console.log(
    `Mode ${s.mode}｜局 ${s.sessions}｜跑满 20 轮 ${s.sessionsCompleted20}(${(s.sessionRate * 100).toFixed(1)}%)｜dead-end ${s.deadEndSessions}`,
    `｜Formal 曝光 ${s.formalShare}（${s.formalDraws}/${s.totalDraws}，distinct ${s.formalExposedDistinct}/${formalTotal}）`,
    `｜heatAtDraw ${JSON.stringify(s.heatAtDraw)}`,
    `｜到达 H2/H3/H4 ${s.sessionsReachingH2}/${s.sessionsReachingH3}/${s.sessionsReachingH4}`,
    `｜有效轮/局 ${s.effectivePerSession}${JSON.stringify(s.effectiveByGain)}｜窗口(≥12) ${s.mutualWindowReached}｜主题/局 ${s.topicsPerSessionMean}｜重复抽卡 ${s.repeatedDraws}`,
    `｜主题覆盖 ${s.distinctTopicsCovered}`,
    `｜distinctFirst5 ${s.distinctFirstFive}`,
  );
}
console.log("ceiling 断粮：", ceilingCohorts.map((c) => `M${c.mode} lim${c.intensityLimit}=deadEnd ${c.deadEndRate}`).join(" "));
console.log("最差 trace：", worstTraceOut.table, "seed", worstTraceOut.seed, "→", worstTraceOut.worstStat);
