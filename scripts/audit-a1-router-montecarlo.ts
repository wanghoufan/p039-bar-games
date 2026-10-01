/**
 * Phase A.1 / A.2｜真实 Router Monte Carlo（不改 Router 业务逻辑，只驱动它）
 *
 * 复用真实生产 Router 与编排器：
 *   - `createV2MainlineRouter`（lib/v2-relationship/v2-router.ts）= D2 唯一 Router，读 SSOT 主线
 *   - `drawV2SessionCard`（lib/v2-relationship/v2-session.ts）= 真实编排器（pair 路由 / Single-Anchor Guard / D7 / 去重 / 耗尽）
 *   - `applyV2HostDecision`（lib/v2-relationship/v2-session.ts）= 真实 Host 决策（幂等键 + 清 used + cycle+1）
 *   - `reduceV2SessionEvents` + `eventForRoundTerminal` = 真实回合终态归约（REL_CARD_COMPLETED 等）
 * 本文件只提供「桌面设定 / 玩法选择 / 完成-跳过决策 / 互选成立」这些**局外输入**与统计，
 * 不复制任何过滤、排序、调度逻辑——避免造第二套 Router。
 *
 * 桌型：2男2女 / 1男3女 / 2男3女 / 1男4女
 * 每桌型 >=1000 局，每局 20 completed rounds；另跑一遍 MATCH-enabled 用于 matchRequired 覆盖统计。
 *
 * A.1 整改（相对 Phase A 的三个确定性 bug）：见 git 历史与本文件下方注释。
 *
 * A.2 整改：
 *  1. **Heat 双口径**：同时记录 `heatAtDraw`（抽卡时，与 Router Heat 门控同一口径）与
 *     `heatAfterTerminal`（回合终态归约后）。体验统计主口径 = heatAtDraw，报告必须声明。
 *  2. **MATCH-enabled simulation**：用**生产**互选事件（`mutualCheckFinalEvents` →
 *     `SYSTEM_MUTUAL_CHECK_COMPLETE`，经生产 reducer 的 `mayCreateMatch` 原子校验）在互选检查点建 MATCH，
 *     让 38 张 matchRequired 卡可见。**只在 harness 造 MATCH 事件**，生产 reducer / MATCH 逻辑一行不改。
 *  3. **耗尽分支按生产实际分列**（不再无脑 reshuffle）：
 *     - `PACK_EXHAUSTED` / `RELATIONSHIP_GLOBAL_EXHAUSTED`：生产不是 AWAITING（app/game/page.tsx:213-224
 *       给「切换玩法 / 查看总结」，**不提供洗牌**）→ harness 直接切包，不调用 applyV2HostDecision。
 *     - `AWAITING_HOST_EXHAUSTION_DECISION`：生产交 Host 二选一（HostExhaustionSheet：结束本局 / 洗牌再玩）
 *       → harness 先洗牌；洗牌仍抽不出再按生产兜底（NO_RECOVERABLE_CARDS：换玩法）切包。
 *  4. **逐局 trace 落正式产物**（docs/qa/content-audit/MC-TRACE.json，每桌型 2 局，带 seed 与终止原因）。
 *  5. **桌型构成 bug 4**：原 `tableParticipants` 在男女分区数组上整段切片，2m2f/1m3f 实际都变成 4 男
 *     （无合法 pair → D4 降级、targetPairKey 恒 null、Single-Anchor Guard 永不触发）。现按桌型分别取足男女。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createV2MainlineRouter, type V2MainlineRouter } from "@/lib/v2-relationship/v2-router";
import {
  applyV2HostDecision,
  createV2SessionState,
  drawV2SessionCard,
  reduceV2SessionEvents,
  signalsFromRelationship,
  type V2SessionState,
} from "@/lib/v2-relationship/v2-session";
import { eventForRoundTerminal } from "@/lib/engine/v2-deal";
import { V2_MAINLINE_PACK_IDS } from "@/lib/v2-content/v2-card-bridge";
import { getV2ContentAdapter } from "@/lib/v2-content/v2-content-adapter";
import { HEAT_ORDER, MUTUAL_CHECK_COUNTS } from "@/lib/v2-relationship/v2-state";
import type { SessionParticipant } from "@/lib/v2-relationship/v2-state";
import type { V13MainlineCard } from "@/lib/v2-content/v2-types";
import { rankPairs } from "@/lib/v2-relationship/v2-routing";
import { mutualCheckFinalEvents } from "@/lib/v2-relationship/v2-mutual-check";
import { mayCreateMatch, mutualDueGates } from "@/lib/v2-relationship/v2-reducer";

const ROOT = process.cwd();
const DIR = `${ROOT}/docs/qa/content-audit`;

/* ------------------------------------------------------------------ */
/* 确定性 PRNG（可复算：同一 seed 必得同一结果）                          */
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

/**
 * 按桌型构造参与者。
 *
 * A.2 修 bug 4｜原实现 `.filter(男 ? startsWith("m") : startsWith("f")).slice(0, males+females)`
 * 在「男在前、女在后」的 PARTICIPANTS 上会**整段取到男的**（2m2f/1m3f 实际都变成 4 男），
 * 于是 D4 无合法 pair 降级、targetPairKey 恒 null、Single-Anchor Guard 永不触发、MATCH 也建不起来。
 * 现改为男/女分别取足人数后再拼接，桌型构成与 label 一致。
 */
const tableParticipants = (spec: TableSpec): SessionParticipant[] => {
  const males = PARTICIPANTS.filter((p) => p.pairGender === "male")
    .slice(0, spec.males)
    .map((p, i) => ({ ...p, playerId: `m${i}` }));
  const females = PARTICIPANTS.filter((p) => p.pairGender === "female")
    .slice(0, spec.females)
    .map((p, i) => ({ ...p, playerId: `f${i}` }));
  return [...males, ...females];
};

/* ------------------------------------------------------------------ */
/* 抽卡池：只许出主线卡的玩法（权重近似真实组局分布）                       */
/* ------------------------------------------------------------------ */
/** bug 1 修法：cardless 玩法（如 spin-bottle）不进抽卡池。 */
const PACK_WEIGHTS: { id: string; label: string; weight: number }[] = [
  { id: "truth-dare", label: "真心话大冒险", weight: 18 },
  { id: "never-have", label: "我从来没有", weight: 16 },
  { id: "would-you-rather", label: "二选一", weight: 16 },
  { id: "compatibility-test", label: "默契测试", weight: 14 },
  { id: "most-likely", label: "谁最可能", weight: 12 },
  { id: "pointing-game", label: "指人游戏", weight: 12 },
];

/* 真源兜底：抽卡池必须与 V2_MAINLINE_PACK_IDS 双向相等，防止日后再次混入 cardless 玩法或漏包。 */
const MAINLINE_PACK_SET = new Set<string>(V2_MAINLINE_PACK_IDS);
const POOL_PACK_SET = new Set<string>(PACK_WEIGHTS.map((p) => p.id));
const POOL_ILLEGAL = PACK_WEIGHTS.filter((p) => !MAINLINE_PACK_SET.has(p.id)).map((p) => p.id);
const POOL_MISSING = V2_MAINLINE_PACK_IDS.filter((id) => !POOL_PACK_SET.has(id));
if (POOL_ILLEGAL.length > 0) {
  throw new Error(`抽卡池含非主线（cardless）玩法，会每抽必耗尽：${POOL_ILLEGAL.join(", ")}`);
}
if (POOL_MISSING.length > 0) {
  throw new Error(`抽卡池漏掉主线玩法：${POOL_MISSING.join(", ")}`);
}

const PACK_TOTAL_WEIGHT = PACK_WEIGHTS.reduce((s, p) => s + p.weight, 0);
function pickPack(rnd: () => number): string {
  let r = rnd() * PACK_TOTAL_WEIGHT;
  for (const p of PACK_WEIGHTS) { r -= p.weight; if (r <= 0) return p.id; }
  return PACK_WEIGHTS[PACK_WEIGHTS.length - 1]!.id;
}
/** 切玩法：只在本池内换（永不切进 cardless 玩法）。 */
function pickOtherPack(rnd: () => number, current: string): string {
  const options = PACK_WEIGHTS.filter((p) => p.id !== current);
  const total = options.reduce((s, p) => s + p.weight, 0);
  let r = rnd() * total;
  for (const p of options) { r -= p.weight; if (r <= 0) return p.id; }
  return options[options.length - 1]!.id;
}

/* ------------------------------------------------------------------ */
/* 审查结论（内容侧）——决定「这张题值多少信息」                          */
/* ------------------------------------------------------------------ */
interface Review { infoGain: string; semanticType: string; topic: string; socialEnergy: string; relationshipProgression: string; }
const reviews = new Map<string, Review>();
const meta = new Map<string, string>();
const GAME_TYPES = ["truth", "dare", "most_likely", "never_have_i", "either_or", "pointing", "chemistry"];
for (const t of GAME_TYPES) {
  for (const line of readFileSync(`${DIR}/_reviews-a1/${t}.jsonl`, "utf8").split("\n").filter(Boolean)) {
    const r = JSON.parse(line) as Review & { cardId: string };
    reviews.set(r.cardId, r);
  }
  for (const line of readFileSync(`${DIR}/_slices/${t}.jsonl`, "utf8").split("\n").filter(Boolean)) {
    const r = JSON.parse(line) as { cardId: string; gameType: string };
    meta.set(r.cardId, r.gameType);
  }
}
const PERSON_TOPICS = new Set([
  "兴趣爱好", "生活方式", "性格/习惯/小癖好", "择偶偏好/吸引力", "恋爱观",
  "亲密/性观念", "边界/吃醋/异性朋友/前任", "人生价值/未来",
]);

/* 静态可用范围（读 SSOT 卡面 heatMin/heatMax，不把跨 Heat 卡塞进单一 Heat）；matchRequired 集合同源。 */
const mainlineCards = getV2ContentAdapter().mainlineCards as readonly V13MainlineCard[];
const matchRequiredIds = new Set(mainlineCards.filter((c) => c.matchRequired).map((c) => c.cardId));

/* ------------------------------------------------------------------ */
/* 模拟主体                                                              */
/* ------------------------------------------------------------------ */
type TerminationReason =
  | "round_limit"        // 跑满目标完成轮数（正常结束）
  | "pack_exhausted"     // 全池都被 PACK_EXHAUSTED 轮完仍无卡（生产：切换玩法无效）
  | "global_exhausted"   // RELATIONSHIP_GLOBAL_EXHAUSTED 且无可切玩法
  | "awaiting_host"      // AWAITING 且洗牌 + 切包均抽不出（生产：Host 结束本局）
  | "guard_limit";       // 撞 guard 上限被截断

interface TraceRound {
  round: number;
  packId: string;
  cardId: string;
  gameType: string;
  heatAtDraw: string;
  heatAfterTerminal: string;
  targetPairKey: string | null;
  pairRouting: "targeted-pair" | "neutral-all-players";
  terminal: "completed" | "skipped";
  guard: { singleAnchorTable: boolean; anchorPlayerId: string | null; applied: boolean; reason: string | null };
}
interface SessionTrace {
  table: string;
  label: string;
  seed: number;
  intensityLimit: number;
  matchEnabled: boolean;
  terminationReason: TerminationReason;
  completedRounds: number;
  guardUsed: number;
  rounds: TraceRound[];
}

interface SessionStat {
  table: string;
  intensityLimit: number;
  completedRounds: number;
  high: number;
  midPlus: number;
  personTopics: number;
  longestLowZeroRun: number;
  judgeShare: number;          // 现场评价/猜测占 REL 完成轮比例
  relRounds: number;
  socialHigh: number;
  progHigh: number;
  exposure: Record<string, number>;
  heatExposureAtDraw: Record<string, number>;       // 主口径：抽卡时（与 Router Heat 门控同口径）
  heatExposureAfterTerminal: Record<string, number>; // 副口径：回合终态归约后
  switches: number;
  reshuffles: number;          // 仅 AWAITING 分支走生产 applyV2HostDecision(reshuffle)
  exhausted: number;           // 所有非 CARD 结果的总次数
  packExhausted: number;       // PACK_EXHAUSTED 次数（生产：切玩法）
  globalExhausted: number;     // RELATIONSHIP_GLOBAL_EXHAUSTED 次数（生产：切玩法）
  awaitingHost: number;        // AWAITING_HOST_EXHAUSTION_DECISION 次数（生产：Host 二选一）
  matchesCreated: number;      // MATCH-enabled 下由 harness 注入并成功建成的 MATCH 数
  terminationReason: TerminationReason;
  guardUsed: number;
  truncated: boolean;          // 撞 guard 上限被截断（正常应为 false）
  deadEnd: boolean;            // 非 round_limit 结束（未跑满目标轮次）
}

const SESSIONS_PER_TABLE = 1000;
const MATCH_SESSIONS_PER_TABLE = 1000;
const TRACE_PER_TABLE = 2;
const TARGET_ROUNDS = 20;
/**
 * guard 上限：每局 20 轮完成 + 每轮最多几次耗尽；耗尽最多「洗牌 1 次 + 切包 1 次」。
 * 取 1000 是为了让异常抖动**可见**（truncated=true）而不是被上限悄悄截断。
 */
const GUARD_LIMIT = 1000;
/** 连续切包上限：全池轮一圈仍无卡即判本局 dead-end（防病态死循环）。 */
const MAX_CONSECUTIVE_SWITCHES = PACK_WEIGHTS.length * 2;
/** REL 事件族＝真实 V2 主线包集合（直接用真源常量，不手写第二份清单）。 */
const REL_PACKS = new Set<string>(V2_MAINLINE_PACK_IDS);

/**
 * MATCH-enabled 专用：在互选检查点用**生产**互选事件建模「本桌每个合法 pair 都互选成立」的上界口径。
 * 受生产 `mayCreateMatch`（D5：每人 active MATCH ≤2）约束；不建 MATCH 的 pair 不产生事件。
 * 该注入只影响 harness 出卡可见性统计，不改生产 reducer / MATCH 逻辑。
 */
const MATCH_ASSUMPTION = "上界口径：假设每个互选检查点（9/14/19）本桌全部合法 pair 都互选成立（受生产 D5 cap≤2/人 约束）";
function injectMutualMatches(state: V2SessionState, checkpoint: number): { state: V2SessionState; created: number } {
  const ranked = rankPairs(
    state.participants,
    signalsFromRelationship(state.relationship),
    new Set(Object.keys(state.relationship.matches)),
    state.relationship.cooldowns,
    state.relationship.playerCoverage,
  );
  const picks: { pairKey: string; playerIds: [string, string] }[] = [];
  let matches = state.relationship.matches;
  for (const key of ranked) {
    if (matches[key] !== undefined) continue;
    const [a, b] = key.split("::") as [string, string];
    if (!a || !b) continue;
    if (!mayCreateMatch(matches, [a, b], key)) continue;
    matches = { ...matches, [key]: { pairKey: key, matchedAt: new Date(0).toISOString(), playerIds: [a, b] } };
    picks.push({ pairKey: key, playerIds: [a, b] });
  }
  if (picks.length === 0) return { state, created: 0 };
  const events = mutualCheckFinalEvents(`mc-mutual-${checkpoint}`, checkpoint, { matches: picks }, new Date(0).toISOString());
  return { state: reduceV2SessionEvents(state, events).state, created: picks.length };
}

function simulateOne(
  spec: TableSpec,
  seed: number,
  opts: { matchEnabled?: boolean; trace?: TraceRound[] } = {},
): SessionStat {
  const rnd = mulberry32(seed);
  const participants = tableParticipants(spec);
  const intensityLimit = 1 + Math.floor(rnd() * 5);
  let state: V2SessionState = createV2SessionState({ sessionId: `mc-${spec.key}-${seed}`, participants });
  let packId = pickPack(rnd);
  let router: V2MainlineRouter = createV2MainlineRouter({ packId });

  const stat: SessionStat = {
    table: spec.key, intensityLimit, completedRounds: 0,
    high: 0, midPlus: 0, personTopics: 0, longestLowZeroRun: 0,
    judgeShare: 0, relRounds: 0, socialHigh: 0, progHigh: 0,
    exposure: {}, heatExposureAtDraw: {}, heatExposureAfterTerminal: {},
    switches: 0, reshuffles: 0, exhausted: 0, packExhausted: 0, globalExhausted: 0, awaitingHost: 0,
    matchesCreated: 0, terminationReason: "round_limit", guardUsed: 0, truncated: false, deadEnd: false,
  };
  const topicSet = new Set<string>();
  let run = 0;
  let completed = 0;
  let guard = 0;
  let drawOrdinal = 0;
  /** AWAITING 分支是否已洗过一次牌（同一 AWAITING 序列内）：true = 洗了仍抽不出 → 按生产兜底切包。 */
  let lastDrawExhausted = false;
  let switchesInARow = 0;
  /** 最近一次耗尽的 kind，用于判定终止原因。 */
  let lastKind: "PACK_EXHAUSTED" | "RELATIONSHIP_GLOBAL_EXHAUSTED" | "AWAITING_HOST_EXHAUSTION_DECISION" | null = null;

  while (completed < TARGET_ROUNDS && guard < GUARD_LIMIT) {
    guard += 1;
    const outcome = drawV2SessionCard(state, router, { intensityLimit });

    if (outcome.kind === "CARD") {
      lastDrawExhausted = false;
      switchesInARow = 0;
      lastKind = null;
      const cardId = outcome.cardId;
      stat.exposure[cardId] = (stat.exposure[cardId] ?? 0) + 1;
      drawOrdinal += 1;

      /* Heat 双口径：抽卡时（归约前，= Router Heat 门控所用值）与终态归约后各记一次。 */
      const heatAtDraw = state.relationship.heat;

      const rel = REL_PACKS.has(packId);
      // 真人现场终态分布：绝大多数完成，少量跳过
      const terminal = rnd() < 0.85 ? "completed" : "skipped";
      const roundLike = { id: `r${completed}-${guard}`, packId, cardId, participantIds: [] as string[] };
      const ev = eventForRoundTerminal(roundLike as never, terminal as never, new Date(0).toISOString());
      state = reduceV2SessionEvents(state, [ev]).state;
      const heatAfterTerminal = state.relationship.heat;

      stat.heatExposureAtDraw[heatAtDraw] = (stat.heatExposureAtDraw[heatAtDraw] ?? 0) + 1;
      stat.heatExposureAfterTerminal[heatAfterTerminal] = (stat.heatExposureAfterTerminal[heatAfterTerminal] ?? 0) + 1;

      if (opts.trace) {
        opts.trace.push({
          round: drawOrdinal,
          packId,
          cardId,
          gameType: meta.get(cardId) ?? "?",
          heatAtDraw,
          heatAfterTerminal,
          targetPairKey: outcome.targetPairKey,
          pairRouting: outcome.targetPairKey === null ? "neutral-all-players" : "targeted-pair",
          terminal,
          guard: {
            singleAnchorTable: outcome.guard.singleAnchorTable,
            anchorPlayerId: outcome.guard.anchorPlayerId,
            applied: outcome.guard.applied,
            reason: outcome.guard.reason,
          },
        });
      }

      if (terminal === "completed") {
        completed += 1;
        if (rel) {
          stat.relRounds += 1;
          const rv = reviews.get(cardId);
          if (rv) {
            if (rv.infoGain === "高") stat.high += 1;
            if (rv.infoGain === "高" || rv.infoGain === "中") stat.midPlus += 1;
            if (rv.semanticType === "现场评价/猜测") stat.judgeShare += 1;
            if (rv.socialEnergy === "高") stat.socialHigh += 1;
            if (rv.relationshipProgression === "高") stat.progHigh += 1;
            if (PERSON_TOPICS.has(rv.topic)) topicSet.add(rv.topic);
          }
          if (!rv || rv.infoGain === "低" || rv.infoGain === "0") { run += 1; stat.longestLowZeroRun = Math.max(stat.longestLowZeroRun, run); }
          else run = 0;
        }
        /* MATCH-enabled：到达互选检查点且过四道门时，用生产事件造互选 MATCH（只影响可见性统计）。 */
        if (opts.matchEnabled) {
          const eff = state.relationship.relationshipEffectiveCardCount;
          if ((MUTUAL_CHECK_COUNTS as readonly number[]).includes(eff) && mutualDueGates(state.relationship, eff)) {
            const injected = injectMutualMatches(state, eff);
            state = injected.state;
            stat.matchesCreated += injected.created;
          }
        }
      }
      continue;
    }

    /* ---------------- 耗尽：按生产实际的 outcome.kind 分列处置 ---------------- */
    stat.exhausted += 1;
    stat.awaitingHost += outcome.kind === "AWAITING_HOST_EXHAUSTION_DECISION" ? 1 : 0;

    /** 生产兜底：切换其他有卡玩法（不洗牌）——三个分支共用同一动作，但计数分列。 */
    const switchPack = (): void => {
      const next = pickOtherPack(rnd, packId);
      packId = next;
      router = createV2MainlineRouter({ packId });
      stat.switches += 1;
      switchesInARow += 1;
      lastDrawExhausted = false;
    };

    if (outcome.kind === "PACK_EXHAUSTED") {
      /* 生产（session-engine.ts:102 + app/game/page.tsx:223）：本玩法本局已玩完 → 切换其他有卡玩法，**不提供洗牌**。 */
      stat.packExhausted += 1;
      lastKind = "PACK_EXHAUSTED";
      state = outcome.state;
      switchPack();
      if (switchesInARow > MAX_CONSECUTIVE_SWITCHES) break;
      continue;
    }
    if (outcome.kind === "RELATIONSHIP_GLOBAL_EXHAUSTED") {
      /* 生产：关系主线当前已无合法卡 → 收敛到仍有卡的关系玩法（切包），**不提供洗牌**。 */
      stat.globalExhausted += 1;
      lastKind = "RELATIONSHIP_GLOBAL_EXHAUSTED";
      state = outcome.state;
      switchPack();
      if (switchesInARow > MAX_CONSECUTIVE_SWITCHES) break;
      continue;
    }

    /* AWAITING_HOST_EXHAUSTION_DECISION：生产交 Host 二选一（结束本局 / 洗牌再玩）。
       顺序：先洗牌（清 used，走生产 applyV2HostDecision）；洗牌仍抽不出 → 按生产兜底（NO_RECOVERABLE_CARDS：换玩法）。 */
    lastKind = "AWAITING_HOST_EXHAUSTION_DECISION";
    if (!lastDrawExhausted) {
      const applied = applyV2HostDecision(outcome.state, {
        decision: "reshuffle",
        exhaustionCycle: outcome.exhaustionCycle,
      });
      state = applied.state;
      stat.reshuffles += 1;
      lastDrawExhausted = true;
      continue;
    }
    state = outcome.state;
    switchPack();
    if (switchesInARow > MAX_CONSECUTIVE_SWITCHES) break;
  }

  stat.completedRounds = completed;
  stat.guardUsed = guard;
  if (completed >= TARGET_ROUNDS) {
    stat.terminationReason = "round_limit";
  } else if (guard >= GUARD_LIMIT) {
    stat.terminationReason = "guard_limit";
    stat.truncated = true;
  } else if (lastKind === "RELATIONSHIP_GLOBAL_EXHAUSTED") {
    stat.terminationReason = "global_exhausted";
  } else if (lastKind === "PACK_EXHAUSTED") {
    stat.terminationReason = "pack_exhausted";
  } else if (lastKind === "AWAITING_HOST_EXHAUSTION_DECISION") {
    stat.terminationReason = "awaiting_host";
  } else {
    stat.terminationReason = "guard_limit";
  }
  stat.deadEnd = stat.terminationReason !== "round_limit";

  stat.personTopics = topicSet.size;
  stat.judgeShare = stat.relRounds > 0 ? stat.judgeShare / stat.relRounds : 0;
  return stat;
}

/* ------------------------------------------------------------------ */
/* 聚合                                                                  */
/* ------------------------------------------------------------------ */
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))]! : 0; };
const seedFor = (spec: TableSpec, i: number) => 20260927 + i * 7919 + (TABLES.indexOf(spec) + 1) * 104729;

const TERMINATION_REASONS: TerminationReason[] = ["round_limit", "pack_exhausted", "global_exhausted", "awaiting_host", "guard_limit"];
const countTermination = (stats: SessionStat[]) =>
  Object.fromEntries(TERMINATION_REASONS.map((r) => [r, stats.filter((s) => s.terminationReason === r).length]));

function summarize(stats: SessionStat[]) {
  const finished = stats.filter((s) => s.completedRounds >= TARGET_ROUNDS);
  return {
    sessions: stats.length,
    sessionsCompleted20: finished.length,
    completedRoundsMean: +mean(stats.map((s) => s.completedRounds)).toFixed(2),
    highPerSession: +mean(finished.map((s) => s.high)).toFixed(2),
    midPlusPerSession: +mean(finished.map((s) => s.midPlus)).toFixed(2),
    personTopicsPerSession: +mean(finished.map((s) => s.personTopics)).toFixed(2),
    longestLowZeroRunMean: +mean(finished.map((s) => s.longestLowZeroRun)).toFixed(2),
    judgeShareMean: +mean(finished.map((s) => s.judgeShare)).toFixed(4),
    socialHighPerSession: +mean(finished.map((s) => s.socialHigh)).toFixed(2),
    progHighPerSession: +mean(finished.map((s) => s.progHigh)).toFixed(2),
    switchesMean: +mean(stats.map((s) => s.switches)).toFixed(3),
    reshufflesMean: +mean(stats.map((s) => s.reshuffles)).toFixed(3),
    exhaustedMean: +mean(stats.map((s) => s.exhausted)).toFixed(3),
    packExhaustedMean: +mean(stats.map((s) => s.packExhausted)).toFixed(3),
    globalExhaustedMean: +mean(stats.map((s) => s.globalExhausted)).toFixed(3),
    awaitingHostMean: +mean(stats.map((s) => s.awaitingHost)).toFixed(3),
    guardUsedMax: Math.max(...stats.map((s) => s.guardUsed)),
    truncatedSessions: stats.filter((s) => s.truncated).length,
    deadEndSessions: stats.filter((s) => s.deadEnd).length,
    deadEndRate: +(stats.filter((s) => s.deadEnd).length / stats.length).toFixed(4),
  };
}

/* ---------------- 主扫描（MATCH 关闭，与 A.1 基线可比） ---------------- */
const all: SessionStat[] = [];
const perTable: Record<string, unknown>[] = [];
const globalExposure: Record<string, number> = {};
const traces: SessionTrace[] = [];

for (const spec of TABLES) {
  const stats: SessionStat[] = [];
  for (let i = 0; i < SESSIONS_PER_TABLE; i += 1) {
    const seed = seedFor(spec, i);
    const traceRows: TraceRound[] | undefined = i < TRACE_PER_TABLE ? [] : undefined;
    const s = simulateOne(spec, seed, { matchEnabled: false, trace: traceRows });
    stats.push(s);
    for (const [k, v] of Object.entries(s.exposure)) globalExposure[k] = (globalExposure[k] ?? 0) + v;
    if (traceRows) {
      traces.push({
        table: spec.key, label: spec.label, seed, intensityLimit: s.intensityLimit, matchEnabled: false,
        terminationReason: s.terminationReason, completedRounds: s.completedRounds, guardUsed: s.guardUsed,
        rounds: traceRows,
      });
    }
  }
  all.push(...stats);
  const exposure: Record<string, number> = {};
  for (const s of stats) for (const [k, v] of Object.entries(s.exposure)) exposure[k] = (exposure[k] ?? 0) + v;
  /* perTable 口径 = 真正跑满 20 轮的子集（与「每局 20 completed rounds」的原始设定对齐）；
     低开放度 cohort 跑不满 20 轮，单独用 sessionsAll / deadEndSessions / completedRoundsMeanAll 披露。 */
  const finished = stats.filter((s) => s.completedRounds >= TARGET_ROUNDS);
  perTable.push({
    table: spec.key,
    label: spec.label,
    players: spec.males + spec.females,
    sessionsAll: stats.length,
    sessionsCompleted20: finished.length,
    deadEndSessions: stats.filter((s) => s.deadEnd).length,
    completedRoundsMeanAll: +mean(stats.map((s) => s.completedRounds)).toFixed(2),
    highPerSession: +mean(finished.map((s) => s.high)).toFixed(2),
    midPlusPerSession: +mean(finished.map((s) => s.midPlus)).toFixed(2),
    personTopicsPerSession: +mean(finished.map((s) => s.personTopics)).toFixed(2),
    personTopicsP50: q(finished.map((s) => s.personTopics), 0.5),
    personTopicsMax: Math.max(...finished.map((s) => s.personTopics)),
    longestLowZeroRunMean: +mean(finished.map((s) => s.longestLowZeroRun)).toFixed(2),
    longestLowZeroRunP90: q(finished.map((s) => s.longestLowZeroRun), 0.9),
    longestLowZeroRunMax: Math.max(...finished.map((s) => s.longestLowZeroRun)),
    judgeShareMean: +mean(finished.map((s) => s.judgeShare)).toFixed(4),
    socialHighPerSession: +mean(finished.map((s) => s.socialHigh)).toFixed(2),
    progHighPerSession: +mean(finished.map((s) => s.progHigh)).toFixed(2),
    relRoundsMean: +mean(finished.map((s) => s.relRounds)).toFixed(2),
    switchesMean: +mean(finished.map((s) => s.switches)).toFixed(3),
    reshufflesMean: +mean(finished.map((s) => s.reshuffles)).toFixed(3),
    exhaustedMean: +mean(finished.map((s) => s.exhausted)).toFixed(3),
    packExhaustedMean: +mean(finished.map((s) => s.packExhausted)).toFixed(3),
    globalExhaustedMean: +mean(finished.map((s) => s.globalExhausted)).toFixed(3),
    awaitingHostMean: +mean(finished.map((s) => s.awaitingHost)).toFixed(3),
    guardUsedMax: Math.max(...stats.map((s) => s.guardUsed)),
    truncatedSessions: stats.filter((s) => s.truncated).length,
    distinctCardsExposed: Object.keys(exposure).length,
  });
}

/**
 * 开放度上限（intensityLimit）分档：SSOT 里卡面 `intensity` 与 `heatMax` 单调绑定
 * （I1→hMax2、I2→hMax3、I3/I4/I5→hMax4），于是低开放度桌在 Heat 升档后会出现
 * **整池零合法卡**的真空——这不是 Router 抖动，而是卡面 intensity/Heat 区间绑定的结构性问题。
 */
const cohortByIntensityLimit = [1, 2, 3, 4, 5].map((limit) => {
  const stats = all.filter((s) => s.intensityLimit === limit);
  const finished = stats.filter((s) => s.completedRounds >= TARGET_ROUNDS);
  return {
    intensityLimit: limit,
    sessions: stats.length,
    deadEndSessions: stats.filter((s) => s.deadEnd).length,
    deadEndRate: +(stats.filter((s) => s.deadEnd).length / stats.length).toFixed(4),
    completedRoundsMean: +mean(stats.map((s) => s.completedRounds)).toFixed(2),
    highPerSession: +mean(stats.map((s) => s.high)).toFixed(2),
    finishedSessionHighPerSession: finished.length > 0 ? +mean(finished.map((s) => s.high)).toFixed(2) : null,
  };
});
const finishedAll = all.filter((s) => s.completedRounds >= TARGET_ROUNDS);

const exposureRows = Object.entries(globalExposure)
  .map(([cardId, count]) => ({ cardId, count, ...reviews.get(cardId) }))
  .sort((a, b) => b.count - a.count);

const exposureByGameType: Record<string, number> = {};
for (const e of exposureRows) {
  const gt = meta.get(e.cardId) ?? "?";
  exposureByGameType[gt] = (exposureByGameType[gt] ?? 0) + e.count;
}
const totalExposure = exposureRows.reduce((s, r) => s + r.count, 0);
const gainByGameType: Record<string, Record<string, number>> = {};
for (const gt of Object.keys(exposureByGameType)) gainByGameType[gt] = { 高: 0, 中: 0, 低: 0, "0": 0, 曝光: 0 };
for (const e of exposureRows) {
  const gt = meta.get(e.cardId) ?? "?";
  if (gainByGameType[gt] && e.infoGain) gainByGameType[gt][e.infoGain] = (gainByGameType[gt][e.infoGain] ?? 0) + e.count;
  if (gainByGameType[gt]) gainByGameType[gt].曝光 += e.count;
}

/* Heat 双口径曝光（主口径 heatAtDraw；副口径 heatAfterTerminal）。 */
const orderHeat = (m: Record<string, number>): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const h of HEAT_ORDER) out[h] = m[h] ?? 0;
  return out;
};
const heatAtDrawTotal: Record<string, number> = {};
const heatAfterTerminalTotal: Record<string, number> = {};
for (const s of all) {
  for (const [h, v] of Object.entries(s.heatExposureAtDraw)) heatAtDrawTotal[h] = (heatAtDrawTotal[h] ?? 0) + v;
  for (const [h, v] of Object.entries(s.heatExposureAfterTerminal)) heatAfterTerminalTotal[h] = (heatAfterTerminalTotal[h] ?? 0) + v;
}
const heatExpOrdered = orderHeat(heatAtDrawTotal);
const heatAfterTerminalOrdered = orderHeat(heatAfterTerminalTotal);

/* 静态可用范围（第二套口径，读 SSOT 卡面 heatMin/heatMax，不把跨 Heat 卡塞进单一 Heat）。 */
const staticHeatAvailability = HEAT_ORDER.map((heat, idx) => {
  const rank = idx + 1;
  const legal = mainlineCards.filter((c) => c.heatMin <= rank && c.heatMax >= rank);
  return {
    heat,
    legalCount: legal.length,
    legalRatio: +(legal.length / mainlineCards.length).toFixed(4),
    high: legal.filter((c) => reviews.get(c.cardId)?.infoGain === "高").length,
    midPlus: legal.filter((c) => {
      const g = reviews.get(c.cardId)?.infoGain;
      return g === "高" || g === "中";
    }).length,
  };
});
const crossHeatCount = mainlineCards.filter((c) => c.heatMax > c.heatMin).length;
const exactHeatCount = mainlineCards.filter((c) => c.heatMax === c.heatMin).length;

/* ---------------- MATCH-enabled 扫描（同一 seed / 同一局外输入，额外造生产互选事件） ---------------- */
const matchStats: SessionStat[] = [];
const matchExposure: Record<string, number> = {};
let matchesCreatedTotal = 0;
for (const spec of TABLES) {
  for (let i = 0; i < MATCH_SESSIONS_PER_TABLE; i += 1) {
    const s = simulateOne(spec, seedFor(spec, i), { matchEnabled: true });
    matchStats.push(s);
    matchesCreatedTotal += s.matchesCreated;
    for (const [k, v] of Object.entries(s.exposure)) matchExposure[k] = (matchExposure[k] ?? 0) + v;
  }
}
const matchExposureRows = Object.entries(matchExposure).map(([cardId, count]) => ({ cardId, count, gameType: meta.get(cardId) ?? "?" })).sort((a, b) => b.count - a.count);
const matchCovered = matchExposureRows.filter((r) => matchRequiredIds.has(r.cardId));
const withoutMatchCovered = exposureRows.filter((r) => matchRequiredIds.has(r.cardId));
const matchRequiredCoverage = {
  total: matchRequiredIds.size,
  note: "matchRequired=true 的卡为 targetMode=match-pair，只有目标 pair 已建立 MATCH 才可出；MATCH 关闭的扫描里曝光恒为 0（结构性不可见）。",
  withoutMatch: {
    covered: withoutMatchCovered.length,
    totalExposure: withoutMatchCovered.reduce((s, r) => s + r.count, 0),
    /* 主扫描 matchEnabled=false → 结构性不建 MATCH；这里由会话统计机械求和，不是手写 0。 */
    matchesCreated: all.reduce((s, x) => s + x.matchesCreated, 0),
    cards: withoutMatchCovered.map((r) => ({ cardId: r.cardId, gameType: meta.get(r.cardId) ?? "?", count: r.count })),
  },
  withMatch: {
    covered: matchCovered.length,
    totalExposure: matchCovered.reduce((s, r) => s + r.count, 0),
    cards: matchCovered.map((r) => ({ cardId: r.cardId, gameType: r.gameType, count: r.count })),
  },
};

const out = {
  generator: "scripts/audit-a1-router-montecarlo.ts",
  engine: {
    router: "createV2MainlineRouter (lib/v2-relationship/v2-router.ts) — 生产 D2 唯一 Router",
    orchestrator: "drawV2SessionCard (lib/v2-relationship/v2-session.ts) — 真实 pair 路由/Single-Anchor Guard/D7/去重/耗尽",
    hostDecision: "applyV2HostDecision (lib/v2-relationship/v2-session.ts) — 真实 reshuffle 分支（幂等键 + 清 usedCardIds + cycle+1）",
    roundTerminal: "eventForRoundTerminal (lib/engine/v2-deal.ts) — 真实 R3 事件映射",
    matchInjection: "mutualCheckFinalEvents (lib/v2-relationship/v2-mutual-check.ts) → SYSTEM_MUTUAL_CHECK_COMPLETE，经生产 reducer mayCreateMatch 原子校验（仅 MATCH-enabled 扫描使用）",
    note: "本 harness 只提供局外输入（桌型/玩法选择/完成-跳过决策/互选成立），不复制任何过滤排序调度逻辑。",
  },
  config: {
    sessionsPerTable: SESSIONS_PER_TABLE,
    matchSessionsPerTable: MATCH_SESSIONS_PER_TABLE,
    tracePerTable: TRACE_PER_TABLE,
    targetCompletedRounds: TARGET_ROUNDS,
    guardLimit: GUARD_LIMIT,
    tables: TABLES.map((t) => ({ key: t.key, label: t.label, players: t.males + t.females })),
    packs: PACK_WEIGHTS.map((p) => ({ id: p.id, label: p.label, weight: +((p.weight / PACK_TOTAL_WEIGHT).toFixed(4)) })),
    packsExcluded: {
      ids: ["spin-bottle"],
      reason: "转瓶子为 cardless 玩法，不在 V2_MAINLINE_PACK_IDS，createV2MainlineRouter 对它恒返回空集，即 Phase A bug 1",
    },
    completedProbability: 0.85,
    seedFormula: "20260927 + i*7919 + (tableIndex+1)*104729（每桌型独立 salt；原 Phase A 用 tableKey.length，四个桌型长度都是 4 → 种子撞车导致结果逐字相同）",
    totalSessions: TABLES.length * SESSIONS_PER_TABLE,
  },
  overall: {
    ...summarize(all),
    termination: countTermination(all),
    totalExposure,
    distinctCardsExposed: exposureRows.length,
  },
  /**
   * 「跑满 20 轮」的子集口径：只有开放度上限足够的局才跑得完（低开放度局在 Heat 升档后整池真空）。
   * 与 Phase A 的 20 轮口径对齐时**必须看这一块**，否则会被低开放度 cohort 拉低而误判。
   */
  overallCompleted20: {
    ...summarize(finishedAll),
    sessions: finishedAll.length,
    sessionRate: +(finishedAll.length / all.length).toFixed(4),
    completedRoundsMean: 20,
  },
  cohortByIntensityLimit,
  readingGuide: [
    "perTable 与 overallCompleted20 只统计「真跑满 20 轮」的局（开放度上限 >=3），与「每局 20 completed rounds」原始设定对齐。",
    "overall 统计全部 4000 局；低开放度（上限 1/2）的局在 Heat 升到 H3/H4 后整池零合法卡，必然 dead-end——见 cohortByIntensityLimit，这不是 Router 抖动。",
    "Heat 双口径：heatExposure 为 heatAtDraw（抽卡时，与 Router Heat 门控同口径，也是体验统计主口径）；heatExposureAfterTerminal 为终态归约后（副口径，仅供对照）。",
    "耗尽按生产 outcome.kind 分列：packExhausted / globalExhausted 走「切换玩法」（生产不提供洗牌）；awaitingHost 走「洗牌再玩」。",
    "全部数字由本脚本机械产出，报告侧不得手写任何统计值。",
  ].join(" "),
  perTable,
  exposureByGameType,
  gainByGameType,
  heatExposure: heatExpOrdered,
  heatExposureAfterTerminal: heatAfterTerminalOrdered,
  heatExposureNote:
    "主口径 heatAtDraw = 抽卡时 state.relationship.heat（与 Router 的 Heat 门控条件同一取值，体验统计用它）；副口径 heatExposureAfterTerminal = 回合终态归约后的 heat。两者差异即「触发升档的那张卡记在新档」的量级。与 staticHeatAvailability「静态可用范围」是另一套口径；跨 Heat 卡不塞进单一 Heat。",
  staticHeatAvailability,
  staticHeatNote: `按 SSOT heatMin/heatMax 区间统计；跨 Heat 卡 ${crossHeatCount} 张、单档卡 ${exactHeatCount} 张，故四档 legalCount 之和大于 ${mainlineCards.length}。`,
  crossHeatCards: crossHeatCount,
  exactHeatCards: exactHeatCount,
  /* A.2 新增：MATCH-enabled 覆盖统计（38 张 matchRequired 卡的可见性）。 */
  matchRequiredCoverage: {
    ...matchRequiredCoverage,
    assumption: MATCH_ASSUMPTION,
    run: {
      sessionsPerTable: MATCH_SESSIONS_PER_TABLE,
      totalSessions: matchStats.length,
      matchesCreated: matchesCreatedTotal,
      totalExposure: matchStats.reduce((s, x) => s + Object.values(x.exposure).reduce((a, b) => a + b, 0), 0),
      distinctCardsExposed: matchExposureRows.length,
      deadEndRate: +(matchStats.filter((s) => s.deadEnd).length / matchStats.length).toFixed(4),
      highPerSession: +mean(matchStats.filter((s) => s.completedRounds >= TARGET_ROUNDS).map((s) => s.high)).toFixed(2),
    },
  },
  traceFile: "docs/qa/content-audit/MC-TRACE.json",
  traceNote: `每桌型前 ${TRACE_PER_TABLE} 局（MATCH 关闭）完整逐轮 trace，含 seed；所有 dead-end 局记录终止原因（${TERMINATION_REASONS.join(" / ")}）。`,
  topExposed: exposureRows.slice(0, 40),
  leastExposed: exposureRows.slice(-20).reverse(),
};

writeFileSync(`${DIR}/ROUTER-MONTE-CARLO.json`, JSON.stringify(out, null, 2));
writeFileSync(`${DIR}/ROUTER-MONTE-CARLO-exposure.csv`,
  ["cardId,gameType,exposureCount,infoGain,semanticType,topic,socialEnergy,relationshipProgression"]
    .concat(exposureRows.map((r) => [r.cardId, meta.get(r.cardId), r.count, r.infoGain, r.semanticType, r.topic, r.socialEnergy, r.relationshipProgression]
      .map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")))
    .join("\n") + "\n");
writeFileSync(`${DIR}/MC-TRACE.json`, JSON.stringify({
  generator: "scripts/audit-a1-router-montecarlo.ts",
  note: out.traceNote,
  terminationReasons: TERMINATION_REASONS,
  traces,
}, null, 2));

console.log("真实 Router Monte Carlo 完成（复用生产 Router + 生产 Host 决策，未造第二套）");
console.log("总局数:", out.config.totalSessions, "｜每桌型局数:", SESSIONS_PER_TABLE, "｜每局目标完成轮:", TARGET_ROUNDS);
console.log("抽卡池:", out.config.packs.map((p) => `${p.id}(${p.weight})`).join(" "), "｜已排除:", out.config.packsExcluded.ids.join(","));
console.log("整体：完成轮/局", out.overall.completedRoundsMean, "｜high/局", out.overall.highPerSession, "｜mid+/局", out.overall.midPlusPerSession,
  "｜人物主题/局", out.overall.personTopicsPerSession, "｜最长连续低0 run 均值", out.overall.longestLowZeroRunMean,
  "｜现场评价占比", out.overall.judgeShareMean);
console.log("跑满 20 轮子集：局数", out.overallCompleted20.sessions, `(${(out.overallCompleted20.sessionRate * 100).toFixed(1)}%)`,
  "｜high/局", out.overallCompleted20.highPerSession, "｜mid+/局", out.overallCompleted20.midPlusPerSession,
  "｜人物主题/局", out.overallCompleted20.personTopicsPerSession);
console.log("耗尽分列（全 4000 局均值/局）：耗尽", out.overall.exhaustedMean, "｜洗牌(AWAITING)", out.overall.reshufflesMean,
  "｜包耗尽", out.overall.packExhaustedMean, "｜全局耗尽", out.overall.globalExhaustedMean, "｜AWAITING", out.overall.awaitingHostMean,
  "｜切包", out.overall.switchesMean);
console.log("终止原因:", JSON.stringify(out.overall.termination));
console.log("开放度分档（dead-end 全来自低开放度桌）:", cohortByIntensityLimit
  .map((c) => `lim${c.intensityLimit}:deadEnd ${c.deadEndSessions}/${c.sessions}`).join(" "));
console.log("曝光卡数:", out.overall.distinctCardsExposed, "/", mainlineCards.length, "｜总曝光:", totalExposure);
console.log("Heat 双口径（抽卡时）:", JSON.stringify(heatExpOrdered), "｜（终态归约后）:", JSON.stringify(heatAfterTerminalOrdered));
console.log("静态可用范围:", staticHeatAvailability.map((h) => `${h.heat}=${h.legalCount}`).join(" "),
  `｜跨 Heat 卡 ${crossHeatCount} ｜单档卡 ${exactHeatCount}`);
console.log(`matchRequired 覆盖：MATCH 关闭 ${matchRequiredCoverage.withoutMatch.covered}/${matchRequiredCoverage.total}，` +
  `MATCH 启用 ${matchRequiredCoverage.withMatch.covered}/${matchRequiredCoverage.total}（建 MATCH ${matchesCreatedTotal} 个，上界口径）`);
console.log(`trace: ${traces.length} 局（每桌型 ${TRACE_PER_TABLE} 局）→ docs/qa/content-audit/MC-TRACE.json`);
