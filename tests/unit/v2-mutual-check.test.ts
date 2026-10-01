import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  beginMutualCheckRun,
  clearMutualCheckRun,
  finalizeMutualCheckRun,
  mutualCandidateIds,
  mutualCheckFinalEvents,
  mutualCheckTrigger,
  mutualFinalCheckTrigger,
  mutualPartnerIds,
  mutualPairRunExists,
  submitMutualChoice,
} from "@/lib/v2-relationship/v2-mutual-check";
import { mutualResult } from "@/lib/v2-relationship/v2-private";
import {
  mutualDueGates,
  recognitionEvidenceSummary,
  reduceRelationshipEvent,
  type RelationshipEvent,
} from "@/lib/v2-relationship/v2-reducer";
import { singleAnchorPlayerId } from "@/lib/v2-relationship/v2-routing";
import { createV2SessionState, reduceV2SessionEvents } from "@/lib/v2-relationship/v2-session";
import {
  createInitialRelationshipState,
  heatForEffectiveCount,
  isHeatAtLeast,
  LIVE_CHEMISTRY_BUFFER_TOPIC,
  MUTUAL_MIN_HEAT,
  type RecognitionEvidenceEntry,
  type RelationshipState,
  type SessionParticipant,
} from "@/lib/v2-relationship/v2-state";
import { V2_TOPICS } from "@/lib/v2-content/v2-card-metadata";

/* ------------------------------------------------------------------ */
/* 装置                                                                  */
/* ------------------------------------------------------------------ */

const participant = (
  playerId: string,
  pairGender: SessionParticipant["pairGender"],
  active = true,
): SessionParticipant => ({ playerId, active, pairGender });

/** 4 人 2 男 2 女：a/c 男、b/d 女 → 合法边 a::b、a::d、b::c、c::d。 */
const QUAD: SessionParticipant[] = [
  participant("a", "male"),
  participant("b", "female"),
  participant("c", "male"),
  participant("d", "female"),
];

const rel = (overrides: Partial<RelationshipState> = {}): RelationshipState => {
  const base = { ...createInitialRelationshipState(), ...overrides };
  // Heat 只由有效卡计数派生（与生产一致），避免测试里手写不一致的 Heat。
  return { ...base, heat: overrides.heat ?? heatForEffectiveCount(base.relationshipEffectiveCardCount) };
};

/**
 * P1-1｜§7.2 认识阈值证据：中及以上≥5（默认全部 medium）、高≥1（第 1 轮 high）、
 * 人物维度 3（择偶偏好/恋爱观/相处规则）、两名候选 a/b 各有本人披露。
 */
const recognizer = (count: number): RecognitionEvidenceEntry[] =>
  Array.from({ length: count }, (_, index) => ({
    cardId: `c${index}`,
    informationGain: index === 0 ? "high" : "medium",
    topic: (["择偶偏好", "恋爱观", "相处规则"] as const)[index % 3],
    disclosedPlayerIds: [index % 2 === 0 ? "a" : "b"],
  }));

/** 认识阈值已满足、且有效卡计数落在窗口内的关系态（Heat 由计数派生）。 */
const recognized = (count: number, overrides: Partial<RelationshipState> = {}): RelationshipState =>
  rel({
    relationshipEffectiveCardCount: count,
    sessionCompletedRounds: count,
    recognitionEvidence: recognizer(count),
    ...overrides,
  });

const matchOf = (first: string, second: string) => ({
  pairKey: [first, second].sort().join("::"),
  matchedAt: "2026-01-01T00:00:00.000Z",
  playerIds: [first, second] as [string, string],
});

const withoutMatch = (state: RelationshipState, key: string): RelationshipState => {
  const matches = { ...state.matches };
  delete matches[key];
  return { ...state, matches };
};

/* ------------------------------------------------------------------ */
/* 1. 触发判定（v2-state 口径 + D4 合法 pair）                              */
/* ------------------------------------------------------------------ */

describe("B9 触发判定：中途互选窗口 12–14 + 合法 pair", () => {
  it("未到窗口不弹；到 12 且存在合法 pair 且认识阈值已达才弹", () => {
    expect(
      mutualCheckTrigger({
        relationship: rel({ relationshipEffectiveCardCount: 11 }),
        participants: QUAD,
        sessionStatus: "active",
      }),
    ).toMatchObject({ due: false, checkpoint: null, reason: "not-at-checkpoint" });

    // 旧行为（仅 count=12 + 合法 pair 即 due）已废止：光有计数、没有认识证据不弹
    expect(
      mutualCheckTrigger({
        relationship: rel({ relationshipEffectiveCardCount: 12 }),
        participants: QUAD,
        sessionStatus: "active",
      }),
    ).toMatchObject({ due: false, checkpoint: 12, reason: "recognition-threshold-not-met" });

    expect(
      mutualCheckTrigger({
        relationship: recognized(12),
        participants: QUAD,
        sessionStatus: "active",
      }),
    ).toMatchObject({ due: true, checkpoint: 12, pairMode: "ACTIVE", reason: "ok" });
  });

  it("13/14 两个窗口检查点同样命中（按 v2-state 的 MUTUAL_CHECK_COUNTS）；15 起不再检查", () => {
    for (const count of [13, 14]) {
      const relationship = recognized(count);
      expect(
        mutualCheckTrigger({ relationship, participants: QUAD, sessionStatus: "active" }),
      ).toMatchObject({ due: true, checkpoint: count });
    }
    expect(
      mutualCheckTrigger({
        relationship: rel({ relationshipEffectiveCardCount: 15, sessionCompletedRounds: 15 }),
        participants: QUAD,
        sessionStatus: "active",
      }),
    ).toMatchObject({ due: false, checkpoint: null, reason: "not-at-checkpoint" });
  });

  it("旧检查点 9/19 不再是检查点：即使合法 pair 存在也不弹（旧频率废止）", () => {
    for (const count of [9, 19]) {
      const relationship = rel({
        relationshipEffectiveCardCount: count,
        sessionCompletedRounds: count,
        extensionActivated: true,
      });
      expect(
        mutualCheckTrigger({ relationship, participants: QUAD, sessionStatus: "active" }),
      ).toMatchObject({ due: false, checkpoint: null, reason: "not-at-checkpoint" });
    }
  });

  it("D4=A：无合法 pair（同性/未选）时不弹，也不建 run、不空转", () => {
    const noPair: SessionParticipant[] = [
      participant("a", "male"),
      participant("b", "male"),
      participant("c", null),
    ];
    expect(
      mutualCheckTrigger({
        relationship: rel({ relationshipEffectiveCardCount: 12 }),
        participants: noPair,
        sessionStatus: "active",
      }),
    ).toMatchObject({ due: false, checkpoint: 12, pairMode: "NO_ELIGIBLE_PAIR", reason: "no-eligible-pair" });

    expect(mutualCandidateIds(noPair)).toEqual([]);
    expect(beginMutualCheckRun(noPair).pairRuns).toEqual({});
  });

  it("暂停 / 已有私密流程在跑时不弹（R4 §7.1 mutualRunnable）", () => {
    const input = {
      relationship: rel({ relationshipEffectiveCardCount: 12 }),
      participants: QUAD,
    };
    expect(mutualCheckTrigger({ ...input, sessionStatus: "paused" })).toMatchObject({
      due: false,
      reason: "session-not-running",
    });
    expect(
      mutualCheckTrigger({ ...input, sessionStatus: "active", privateFlowRunning: true }),
    ).toMatchObject({ due: false, reason: "session-not-running" });
  });

  it("四道门与 reducer 单一口径一致（剩余轮次 / 一局一次上限 / 最小间隔）", () => {
    const late = rel({ relationshipEffectiveCardCount: 12, sessionCompletedRounds: 19 });
    const capped = rel({ relationshipEffectiveCardCount: 12, regularMutualCheckRuns: 1 });
    const tooClose = rel({ relationshipEffectiveCardCount: 12, lastMutualCheckAtEffectiveCount: 8 });
    for (const relationship of [late, capped, tooClose]) {
      expect(
        mutualCheckTrigger({ relationship, participants: QUAD, sessionStatus: "active" }).reason,
      ).toBe("gates-not-passed");
      const reduced = reduceRelationshipEvent(relationship, {
        eventId: "probe",
        type: "SYSTEM_MUTUAL_CHECK_DUE",
        dueCount: relationship.relationshipEffectiveCardCount,
      });
      expect(reduced.delta.reasons).not.toContain("mutual_due");
    }
    // 四道门＋认识阈值全过时 reducer 也标记 due（同口径正向核对）
    const ok = recognized(12);
    expect(
      reduceRelationshipEvent(ok, { eventId: "probe", type: "SYSTEM_MUTUAL_CHECK_DUE", dueCount: 12 })
        .delta.reasons,
    ).toContain("mutual_due");
  });
});

/* ------------------------------------------------------------------ */
/* 2. 候选人 / 单向 secret（纯内存）                                       */
/* ------------------------------------------------------------------ */

describe("B9 单向秘密：只选一人或跳过、非法目标按跳过", () => {
  it("候选人只含至少属于一条合法边的 active 参与者", () => {
    const withOutsider: SessionParticipant[] = [...QUAD, participant("e", "male", false)];
    expect(mutualCandidateIds(withOutsider)).toEqual(["a", "b", "c", "d"]);
  });

  it("非法目标（选自己 / 不在候选人里）一律按跳过处理，不留任何痕迹", () => {
    const run = beginMutualCheckRun(QUAD);
    submitMutualChoice(run, "a", "a");
    submitMutualChoice(run, "b", "outsider");
    for (const pairRun of Object.values(run.pairRuns)) {
      expect(Object.values(pairRun.selections).every((value) => value === null)).toBe(true);
      expect(pairRun.maskRevealed).toBe(false);
    }
    const before = JSON.stringify(run.pairRuns);
    submitMutualChoice(run, "outsider", "a");
    expect(JSON.stringify(run.pairRuns)).toBe(before);
  });

  it("选择只写进命中 pair 的本人一侧，其余 pair 保持 null", () => {
    const run = beginMutualCheckRun(QUAD);
    submitMutualChoice(run, "a", "b");
    expect(run.pairRuns["a::b"]!.selections.a).not.toBeNull();
    expect(run.pairRuns["a::b"]!.selections.b).toBeNull();
    for (const [key, pairRun] of Object.entries(run.pairRuns)) {
      if (key === "a::b") continue;
      expect(Object.values(pairRun.selections).every((value) => value === null)).toBe(true);
    }
  });

  it("R-CB10 mutualPairRunExists：只认建 run 快照里已有的 pair，新 pair 不在其中", () => {
    // 1男1女建 run：只有 f::m 一条边
    const run = beginMutualCheckRun([participant("f", "female"), participant("m", "male")]);
    expect(mutualPairRunExists(run, "f", "m")).toBe(true);
    expect(mutualPairRunExists(run, "m", "f")).toBe(true);
    // roster 中途变化新增的合法边（如补录性别后出现 f::m2）不在 run 快照里
    expect(mutualPairRunExists(run, "f", "m2")).toBe(false);
    expect(mutualPairRunExists(run, "m", "f2")).toBe(false);
    expect(mutualPairRunExists(run, "f", "f")).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* 3. finalize：互选成 MATCH、单向 no-action、跳过无惩罚                     */
/* ------------------------------------------------------------------ */

describe("B9 finalize：只公布双方互选的结果", () => {
  it("双方互选成 MATCH；单向选择只 no-action、不公开", () => {
    const run = beginMutualCheckRun(QUAD);
    submitMutualChoice(run, "a", "b");
    submitMutualChoice(run, "b", "a");
    submitMutualChoice(run, "c", "b");
    const result = finalizeMutualCheckRun(run, rel());
    expect(result.matches.map((item) => item.pairKey)).toEqual(["a::b"]);
    expect(JSON.stringify(result)).not.toContain('"c"');
  });

  it("无交集只返回空结果，且不含任何单向明细 / 参与者身份", () => {
    const run = beginMutualCheckRun(QUAD);
    submitMutualChoice(run, "a", "b");
    submitMutualChoice(run, "b", "c");
    submitMutualChoice(run, "c", "d");
    submitMutualChoice(run, "d", "a");
    const result = finalizeMutualCheckRun(run, rel());
    expect(result).toEqual({ matches: [] });
    expect(JSON.stringify(result)).toBe('{"matches":[]}');
  });

  it("跳过无惩罚：全员跳过 → 仍可正常收束，空结果且无惩罚字段", () => {
    const run = beginMutualCheckRun(QUAD);
    for (const playerId of run.playerIds) submitMutualChoice(run, playerId, null);
    const result = finalizeMutualCheckRun(run, rel());
    expect(result).toEqual({ matches: [] });
    expect(Object.keys(result)).toEqual(["matches"]);
    expect(JSON.stringify(result)).not.toMatch(/skip|penalt|惩罚|跳过/i);
  });

  it("finalize 后单向数据清零、遮罩关闭（R4 §6.2 先出公开结果再清空原始数据）", () => {
    const run = beginMutualCheckRun(QUAD);
    submitMutualChoice(run, "a", "b");
    submitMutualChoice(run, "b", "a");
    expect(run.pairRuns["a::b"]!.maskRevealed).toBe(true);

    finalizeMutualCheckRun(run, rel());
    for (const pairRun of Object.values(run.pairRuns)) {
      expect(Object.values(pairRun.selections).every((value) => value === null)).toBe(true);
      expect(pairRun.maskRevealed).toBe(false);
      expect(mutualResult(pairRun)).toEqual({ match: false });
    }
  });

  it("clearMutualCheckRun 就地清零（取消路径不留痕）", () => {
    const run = beginMutualCheckRun(QUAD);
    submitMutualChoice(run, "a", "b");
    submitMutualChoice(run, "b", "a");
    clearMutualCheckRun(run);
    for (const pairRun of Object.values(run.pairRuns)) {
      expect(Object.values(pairRun.selections).every((value) => value === null)).toBe(true);
      expect(pairRun.maskRevealed).toBe(false);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 4. D5 上限 2                                                          */
/* ------------------------------------------------------------------ */

describe("B9 D5 上限 2：拦截且不泄露超限的一方", () => {
  it("一方已有 2 个 active MATCH → 互选也不新建，结果里没有任何线索", () => {
    const full = rel({ matches: { "a::b": matchOf("a", "b"), "a::c": matchOf("a", "c") } });
    const run = beginMutualCheckRun(QUAD);
    submitMutualChoice(run, "a", "d");
    submitMutualChoice(run, "d", "a");
    const result = finalizeMutualCheckRun(run, full);
    expect(result.matches).toEqual([]);
    expect(JSON.stringify(result)).not.toContain('"a"');
    expect(JSON.stringify(result)).not.toContain('"d"');
    expect(JSON.stringify(result)).not.toMatch(/cap|under-limit|上限|已满/i);
  });

  it("只拦超限的那一方：同一次 run 里其他互选 pair 照常成 MATCH", () => {
    const full = rel({ matches: { "a::b": matchOf("a", "b"), "a::c": matchOf("a", "c") } });
    const run = beginMutualCheckRun(QUAD);
    submitMutualChoice(run, "a", "d");
    submitMutualChoice(run, "d", "a");
    submitMutualChoice(run, "b", "c");
    submitMutualChoice(run, "c", "b");
    const result = finalizeMutualCheckRun(run, full);
    expect(result.matches.map((item) => item.pairKey)).toEqual(["b::c"]);
  });

  it("退出释放名额：废掉一个人身上的 MATCH 后，同一 pair 可以新建", () => {
    const full = rel({ matches: { "a::b": matchOf("a", "b"), "a::c": matchOf("a", "c") } });
    const run1 = beginMutualCheckRun(QUAD);
    submitMutualChoice(run1, "a", "d");
    submitMutualChoice(run1, "d", "a");
    expect(finalizeMutualCheckRun(run1, full).matches).toEqual([]);

    const released = withoutMatch(full, "a::c");
    const run2 = beginMutualCheckRun(QUAD);
    submitMutualChoice(run2, "a", "d");
    submitMutualChoice(run2, "d", "a");
    expect(finalizeMutualCheckRun(run2, released).matches.map((item) => item.pairKey)).toEqual(["a::d"]);
  });
});

/* ------------------------------------------------------------------ */
/* 4b. 已 MATCH 的 pair 不重复公开（只公布本次新成立的 pair）                  */
/* ------------------------------------------------------------------ */

describe("B9 已 MATCH pair：不再当新互选公布、不建新 COMPLETE 事件", () => {
  const TS = "2026-01-01T00:00:00.000Z";

  it("旧 MATCH 再次互选：不公开、不建新 event、原 MATCH 原样保留", () => {
    const existing = rel({
      relationshipEffectiveCardCount: 12,
      matches: { "a::b": matchOf("a", "b") },
    });
    const run = beginMutualCheckRun(QUAD);
    submitMutualChoice(run, "a", "b");
    submitMutualChoice(run, "b", "a");

    const result = finalizeMutualCheckRun(run, existing);
    expect(result.matches).toEqual([]);

    const events = mutualCheckFinalEvents(run.runId, 12, result, TS);
    expect(events.map((event) => event.type)).toEqual(["SYSTEM_MUTUAL_CHECK_DUE"]);

    const state = {
      ...createV2SessionState({ sessionId: "s-old", participants: QUAD }),
      relationship: existing,
    };
    const after = reduceV2SessionEvents(state, events);
    expect(Object.keys(after.state.relationship.matches)).toEqual(["a::b"]);
    expect(after.state.relationship.matches["a::b"]).toEqual(existing.matches["a::b"]);
    expect(after.deltas.some((delta) => delta.reasons.includes("match_created"))).toBe(false);
    // cooldown / 5 档保障一律不重建：无 COMPLETE 事件 → 无 cooldown_set、无新 guarantee
    expect(after.state.relationship.cooldowns["a::b"]).toBeUndefined();
    expect(after.deltas.some((delta) => delta.reasons.includes("cooldown_set"))).toBe(false);
    expect(after.state.relationship.fiveGuarantees["a::b"]).toBeUndefined();
  });

  it("同一次 run 一旧一新：只公开新成立的 pair，旧 MATCH 不被重新公布", () => {
    const existing = rel({
      relationshipEffectiveCardCount: 12,
      matches: { "a::b": matchOf("a", "b") },
    });
    const run = beginMutualCheckRun(QUAD);
    submitMutualChoice(run, "a", "b");
    submitMutualChoice(run, "b", "a");
    submitMutualChoice(run, "c", "d");
    submitMutualChoice(run, "d", "c");

    const result = finalizeMutualCheckRun(run, existing);
    expect(result.matches.map((item) => item.pairKey)).toEqual(["c::d"]);

    const events = mutualCheckFinalEvents(run.runId, 12, result, TS);
    expect(events.map((event) => event.type)).toEqual([
      "SYSTEM_MUTUAL_CHECK_DUE",
      "SYSTEM_MUTUAL_CHECK_COMPLETE",
    ]);
    expect(events[1]).toMatchObject({ pairKey: "c::d" });

    const state = {
      ...createV2SessionState({ sessionId: "s-mix", participants: QUAD }),
      relationship: existing,
    };
    const after = reduceV2SessionEvents(state, events);
    expect(Object.keys(after.state.relationship.matches).sort()).toEqual(["a::b", "c::d"]);
    expect(after.state.relationship.matches["a::b"]).toEqual(existing.matches["a::b"]);
  });

  it("旧 MATCH 重选与 D5 超限同 run：只公开真正新成立且未超限的 pair", () => {
    // a 身上 2 个 active MATCH（a::b / a::c）；b::c 双方各 1 个 → 只有 b::c 可达
    const existing = rel({
      relationshipEffectiveCardCount: 12,
      matches: { "a::b": matchOf("a", "b"), "a::c": matchOf("a", "c") },
    });
    const run = beginMutualCheckRun(QUAD);
    submitMutualChoice(run, "a", "b");
    submitMutualChoice(run, "b", "a");
    submitMutualChoice(run, "a", "d");
    submitMutualChoice(run, "d", "a");
    submitMutualChoice(run, "b", "c");
    submitMutualChoice(run, "c", "b");

    const result = finalizeMutualCheckRun(run, existing);
    expect(result.matches.map((item) => item.pairKey)).toEqual(["b::c"]);
    expect(JSON.stringify(result)).not.toMatch(/cap|上限|已满|已存在/i);
  });

  it("reducer 侧幂等语义不变：直接归约「已 MATCH pair 的 COMPLETE」仍不重复建 MATCH、不动 matchedAt", () => {
    const existing = rel({ matches: { "a::b": matchOf("a", "b") } });
    const reduced = reduceRelationshipEvent(existing, {
      eventId: "probe-complete",
      type: "SYSTEM_MUTUAL_CHECK_COMPLETE",
      pairKey: "a::b",
      playerIds: ["a", "b"],
      consented: true,
      timestamp: "2027-01-01T00:00:00.000Z",
    });
    expect(Object.keys(reduced.state.matches)).toEqual(["a::b"]);
    expect(reduced.state.matches["a::b"]?.matchedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(reduced.delta.reasons).not.toContain("match_created");
  });
});

/* ------------------------------------------------------------------ */
/* 5. final 事件计划 + 幂等                                              */
/* ------------------------------------------------------------------ */

describe("B9 final 事件计划：DUE 记一次 + 每对新 MATCH 一条 COMPLETE", () => {
  it("事件只含公开信息；重复归约不重复建 MATCH、不重复计一次常规互选", () => {
    const run = beginMutualCheckRun(QUAD);
    submitMutualChoice(run, "a", "b");
    submitMutualChoice(run, "b", "a");
    const result = finalizeMutualCheckRun(run, rel());
    const events = mutualCheckFinalEvents(run.runId, 12, result, "2026-01-01T00:00:00.000Z");
    expect(events.map((event) => event.type)).toEqual([
      "SYSTEM_MUTUAL_CHECK_DUE",
      "SYSTEM_MUTUAL_CHECK_COMPLETE",
    ]);
    expect(JSON.stringify(events)).not.toMatch(/selection|choice|skip|跳过/i);

    const base = recognized(12);
    const state = { ...createV2SessionState({ sessionId: "s1", participants: QUAD }), relationship: base };
    const once = reduceV2SessionEvents(state, events);
    expect(Object.keys(once.state.relationship.matches)).toEqual(["a::b"]);
    expect(once.state.relationship.regularMutualCheckRuns).toBe(1);
    expect(once.state.relationship.fiveGuarantees["a::b"]).toBeDefined();

    const twice = reduceV2SessionEvents(once.state, events);
    expect(Object.keys(twice.state.relationship.matches)).toEqual(["a::b"]);
    expect(twice.state.relationship.regularMutualCheckRuns).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/* 6. 无持久化                                                            */
/* ------------------------------------------------------------------ */

describe("B9 隐私边界：单向秘密没有落盘入口", () => {
  it("控制器与面板源码零 storage / URL / 历史写入", () => {
    const files = [
      "lib/v2-relationship/v2-mutual-check.ts",
      "lib/v2-relationship/v2-private.ts",
      "components/game/MutualCheckSheet.tsx",
    ];
    for (const file of files) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(source).not.toMatch(/localStorage|sessionStorage|indexedDB|IDBKeyRange|openDB/);
      expect(source).not.toMatch(/@\/lib\/storage/);
      expect(source).not.toMatch(/history\.(pushState|replaceState)/);
    }
  });

  it("跑完一整次 run 后 localStorage 未被写入、IndexedDB 未被打开", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const openSpy = vi.spyOn(IDBFactory.prototype, "open");
    const run = beginMutualCheckRun(QUAD);
    submitMutualChoice(run, "a", "b");
    submitMutualChoice(run, "b", "a");
    submitMutualChoice(run, "c", null);
    submitMutualChoice(run, "d", "a");
    finalizeMutualCheckRun(run, rel());
    expect(setItem).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
    expect(window.localStorage.length).toBe(0);
    setItem.mockRestore();
    openSpy.mockRestore();
  });
});

/* ------------------------------------------------------------------ */
/* 7. R-CB9：候选视图按「当前合法异性候选数」分支（与 Guard 阈值解耦）          */
/* ------------------------------------------------------------------ */

/** 1男3女（Single-Anchor 桌）：anchor=a(男)，多数方 b/c/d(女)；合法边 a::b / a::c / a::d。 */
const ANCHOR_TABLE: SessionParticipant[] = [
  participant("a", "male"),
  participant("b", "female"),
  participant("c", "female"),
  participant("d", "female"),
];

/** 1男2女（3 人桌，Single-Anchor Guard 不触发）：合法边 e::f / e::g。 */
const SMALL_TABLE: SessionParticipant[] = [
  participant("e", "male"),
  participant("f", "female"),
  participant("g", "female"),
];

describe("R-CB9 Mutual 候选视图：只从真实 eligible 边派生（与 Single-Anchor Guard 阈值解耦）", () => {
  it("1男3女：多数方每人恰 1 个合法候选；anchor 本人有 3 个 → 不强制 Yes/No", () => {
    expect(mutualPartnerIds("b", ANCHOR_TABLE)).toEqual(["a"]);
    expect(mutualPartnerIds("c", ANCHOR_TABLE)).toEqual(["a"]);
    expect(mutualPartnerIds("d", ANCHOR_TABLE)).toEqual(["a"]);
    expect(mutualPartnerIds("a", ANCHOR_TABLE)).toEqual(["b", "c", "d"]);
  });

  it("1男2女：Guard=false 但多数方仍只有 1 个合法候选（UI 分支与 Guard 无关）", () => {
    expect(singleAnchorPlayerId(SMALL_TABLE)).toBeNull();
    expect(mutualPartnerIds("f", SMALL_TABLE)).toEqual(["e"]);
    expect(mutualPartnerIds("g", SMALL_TABLE)).toEqual(["e"]);
    // 少数方/多候选一侧不适用 Yes/No
    expect(mutualPartnerIds("e", SMALL_TABLE)).toEqual(["f", "g"]);
  });

  it("候选 = 真实合法边：暂离 / 性别未录入 / 同性的一律不在候选里", () => {
    const mixed: SessionParticipant[] = [
      participant("a", "male"),
      participant("b", "female"),
      participant("c", "female", false), // 暂离
      participant("d", null), // 未录入 → 不猜
      participant("e", "male"),
    ];
    // a(男) 的合法候选只有在场的 b；c 暂离、d 未录入、e 同性都不算
    expect(mutualPartnerIds("a", mixed)).toEqual(["b"]);
    // 所有人都是候选人的并集（mutualCandidateIds）也同步收窄
    expect(mutualCandidateIds(mixed)).toEqual(["a", "b", "e"]);
    // b 的候选含 a 与 e（两位在场男性）
    expect(mutualPartnerIds("b", mixed)).toEqual(["a", "e"]);
    // 暂离的人自己不再是任何人的候选
    expect(mutualCandidateIds(mixed)).not.toContain("c");
  });
});

describe("R-CB9 Yes/No 映射：愿意 → 唯一候选；暂时没有 → null（复用既有 mutual choice）", () => {
  it("愿意 → 该唯一候选：双方愿意才成 MATCH", () => {
    const run = beginMutualCheckRun(ANCHOR_TABLE);
    // b 在 Yes/No 界面点「愿意」→ 唯一候选 a
    expect(mutualPartnerIds("b", ANCHOR_TABLE)).toEqual(["a"]);
    submitMutualChoice(run, "b", mutualPartnerIds("b", ANCHOR_TABLE)[0]!);
    // a 在多人候选界面选 b
    submitMutualChoice(run, "a", "b");
    expect(finalizeMutualCheckRun(run, rel()).matches.map((item) => item.pairKey)).toEqual(["a::b"]);
  });

  it("暂时没有 → null：单向选择不成 MATCH、不公开、结果里没有任何线索", () => {
    const run = beginMutualCheckRun(ANCHOR_TABLE);
    submitMutualChoice(run, "b", null); // 暂时没有
    submitMutualChoice(run, "a", "b"); // a 单向选中 b
    const result = finalizeMutualCheckRun(run, rel());
    expect(result).toEqual({ matches: [] });
    expect(JSON.stringify(result)).toBe('{"matches":[]}');
  });

  it("提交的是失效目标（暂离后仍在快照里）：run 内边合法性照旧兜底，不产生非法 MATCH", () => {
    const stale: SessionParticipant[] = [participant("a", "male"), participant("b", "female", false)];
    const run = beginMutualCheckRun(stale);
    expect(run.playerIds).toEqual([]);
    submitMutualChoice(run, "a", "b"); // 已失效目标：既不在 playerIds 也不在任何 pairRun
    for (const pairRun of Object.values(run.pairRuns)) {
      expect(Object.values(pairRun.selections).every((value) => value === null)).toBe(true);
    }
    expect(finalizeMutualCheckRun(run, rel()).matches).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* 8. D5 四条冻结语义回归钉（B3 一行未改，测试钉住）                          */
/* ------------------------------------------------------------------ */

describe("D5 四条冻结语义回归钉（B3 未改）", () => {
  it("① 双向才 MATCH：单向选择再准也不成", () => {
    const run = beginMutualCheckRun(QUAD);
    submitMutualChoice(run, "a", "b");
    expect(finalizeMutualCheckRun(run, rel()).matches).toEqual([]);
  });

  it("② 单向选择不公开：结果空、final 事件里只有 DUE 且不含任何单向明细", () => {
    const run = beginMutualCheckRun(QUAD);
    submitMutualChoice(run, "a", "b");
    submitMutualChoice(run, "c", "d");
    const result = finalizeMutualCheckRun(run, rel());
    expect(result.matches).toEqual([]);
    const events = mutualCheckFinalEvents(run.runId, 12, result, "2026-01-01T00:00:00.000Z");
    expect(events.map((event) => event.type)).toEqual(["SYSTEM_MUTUAL_CHECK_DUE"]);
    expect(JSON.stringify(events)).not.toMatch(/selection|choice|跳过|skip/i);
  });

  it("③ active MATCH ≤ 2：一方已满 2 个 active 时不新建，且不泄露原因", () => {
    const full = rel({ matches: { "a::b": matchOf("a", "b"), "a::c": matchOf("a", "c") } });
    const run = beginMutualCheckRun(QUAD);
    submitMutualChoice(run, "a", "d");
    submitMutualChoice(run, "d", "a");
    const result = finalizeMutualCheckRun(run, full);
    expect(result.matches).toEqual([]);
    expect(JSON.stringify(result)).not.toMatch(/cap|上限|已满/i);
  });

  it("④ raw unilateral choice 不落盘：Storage / IndexedDB 全程无写入，finalize 后内存也清零", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const openSpy = vi.spyOn(IDBFactory.prototype, "open");
    const run = beginMutualCheckRun(ANCHOR_TABLE);
    submitMutualChoice(run, "b", "a"); // 愿意（单向秘密）
    finalizeMutualCheckRun(run, rel());
    expect(setItem).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
    for (const pairRun of Object.values(run.pairRuns)) {
      expect(Object.values(pairRun.selections).every((value) => value === null)).toBe(true);
    }
    setItem.mockRestore();
    openSpy.mockRestore();
  });
});

/* ------------------------------------------------------------------ */
/* 9. Mutual 频率整改：窗口 12–14、中途最多 1 次、旧存档不补、final 不叠加   */
/* ------------------------------------------------------------------ */

describe("Mutual 频率整改（12–14 窗口 / 中途最多一次 / final 独立）", () => {
  const TS = "2026-09-01T00:00:00.000Z";
  /** 已完成 count 个有效卡轮的存档（窗口判定只看 relationshipEffectiveCardCount；附认识证据）。 */
  const midSession = (count: number, overrides: Partial<RelationshipState> = {}): RelationshipState =>
    rel({
      relationshipEffectiveCardCount: count,
      sessionCompletedRounds: count,
      recognitionEvidence: recognizer(count),
      ...overrides,
    });

  it("① 一局中途互选最多触发 1 次：12 问过一次后，13/14 仍在窗口内也不再弹", () => {
    const base = midSession(12);
    expect(
      mutualCheckTrigger({ relationship: base, participants: QUAD, sessionStatus: "active" }),
    ).toMatchObject({ due: true, checkpoint: 12 });

    // 走完整生产路径：run → 互选 → finalize → 公开事件 → 落盘
    const run = beginMutualCheckRun(QUAD);
    submitMutualChoice(run, "a", "b");
    submitMutualChoice(run, "b", "a");
    const result = finalizeMutualCheckRun(run, base);
    const events = mutualCheckFinalEvents(run.runId, 12, result, TS);
    const state = { ...createV2SessionState({ sessionId: "s-once", participants: QUAD }), relationship: base };
    const after = reduceV2SessionEvents(state, events);
    expect(after.state.relationship.regularMutualCheckRuns).toBe(1);
    expect(Object.keys(after.state.relationship.matches)).toEqual(["a::b"]);

    // 之后无论继续到 13 还是 14，都不再弹第二次中途互选
    for (const count of [13, 14]) {
      const later: RelationshipState = {
        ...after.state.relationship,
        relationshipEffectiveCardCount: count,
        sessionCompletedRounds: count,
      };
      const again = mutualCheckTrigger({ relationship: later, participants: QUAD, sessionStatus: "active" });
      expect(again.due).toBe(false);
      expect(again.reason).toBe("gates-not-passed");
      expect(mutualDueGates(later, count)).toBe(false);
    }
  });

  it("② 旧存档（已消耗 9/14/19）不补触发：旧检查点不再是检查点，已问过也不再补", () => {
    // 旧存档：曾在 9/14/19 各问过一次（regularMutualCheckRuns=3，last=19）
    const legacy = midSession(20, { regularMutualCheckRuns: 3, lastMutualCheckAtEffectiveCount: 19 });
    expect(
      mutualCheckTrigger({ relationship: legacy, participants: QUAD, sessionStatus: "active" }),
    ).toMatchObject({ due: false, checkpoint: null, reason: "not-at-checkpoint" });

    // 旧存档继续推进到窗口内（12/13/14）也不补：已 consumed 不得转成新检查点待触发
    for (const count of [12, 13, 14]) {
      const atWindow: RelationshipState = {
        ...legacy,
        relationshipEffectiveCardCount: count,
        sessionCompletedRounds: count,
      };
      const trigger = mutualCheckTrigger({ relationship: atWindow, participants: QUAD, sessionStatus: "active" });
      expect(trigger.due).toBe(false);
      expect(trigger.reason).toBe("gates-not-passed");
      expect(mutualDueGates(atWindow, count)).toBe(false);
    }

    // 旧频率 9/19 彻底废止：即便从未问过，也不构成检查点
    for (const count of [9, 19]) {
      expect(
        mutualCheckTrigger({ relationship: midSession(count), participants: QUAD, sessionStatus: "active" }).reason,
      ).toBe("not-at-checkpoint");
    }
  });

  it("③ 12–14 之外不触发：11 与 15 都不是检查点，仅 12/13/14 可达", () => {
    for (const count of [0, 8, 11, 15, 20]) {
      const trigger = mutualCheckTrigger({ relationship: midSession(count), participants: QUAD, sessionStatus: "active" });
      expect(trigger.due).toBe(false);
      expect(trigger.checkpoint).toBeNull();
      expect(trigger.reason).toBe("not-at-checkpoint");
    }
    for (const count of [12, 13, 14]) {
      expect(
        mutualCheckTrigger({ relationship: midSession(count), participants: QUAD, sessionStatus: "active" }).due,
      ).toBe(true);
    }
  });

  it("④ 结束最终互选仍可正常发生一次，且不与中途「最多一次」叠加", () => {
    // 中途已问过一次（runs=1）：final 是独立事件类型，不受中途上限约束
    const state = midSession(14, {
      regularMutualCheckRuns: 1,
      lastMutualCheckAtEffectiveCount: 12,
    });
    const final = reduceRelationshipEvent(state, {
      eventId: "final-run::a::b",
      type: "SYSTEM_MUTUAL_CHECK_FINAL",
      pairKey: "a::b",
      playerIds: ["a", "b"],
      consented: true,
      timestamp: TS,
    });
    expect(final.delta.reasons).toContain("match_created");
    expect(final.state.matches["a::b"]).toBeDefined();
    // 不把 final 计进中途上限（不是 2），也不改有效卡计数
    expect(final.state.regularMutualCheckRuns).toBe(1);
    expect(final.state.relationshipEffectiveCardCount).toBe(14);

    // 同一 final 事件重放：幂等，不产生第二对 MATCH
    const replay = reduceRelationshipEvent(final.state, {
      eventId: "final-run::a::b",
      type: "SYSTEM_MUTUAL_CHECK_FINAL",
      pairKey: "a::b",
      playerIds: ["a", "b"],
      consented: true,
      timestamp: TS,
    });
    expect(replay.delta.replayed).toBe(true);
    expect(Object.keys(replay.state.matches)).toEqual(["a::b"]);
  });
});

/* ------------------------------------------------------------------ */
/* 10. P1-1 先了解再询问兴趣：有效信息轮 / 认识阈值 / 到 14 永久跳过          */
/* ------------------------------------------------------------------ */

describe("P1-1 先了解再询问兴趣（有效信息轮 + 认识阈值 + 到 14 永久跳过）", () => {
  /** 带 metadata 的 REL_CARD_COMPLETED（默认是「有效信息轮」：medium/high + 本人揭晓）。 */
  const relRound = (index: number, overrides: Partial<RelationshipEvent> = {}): RelationshipEvent => ({
    eventId: `ev-${index}`,
    type: "REL_CARD_COMPLETED",
    ref: `round-${index}`,
    cardId: `c-${index}`,
    informationGain: index === 0 ? "high" : "medium",
    topic: (["择偶偏好", "恋爱观", "相处规则"] as const)[index % 3],
    selfDisclosed: true,
    disclosedPlayerIds: [index % 2 === 0 ? "a" : "b"],
    ...overrides,
  });

  const reduceAll = (events: readonly RelationshipEvent[]): RelationshipState =>
    events.reduce(
      (state, event) => reduceRelationshipEvent(state, event).state,
      createInitialRelationshipState(),
    );

  /** 生成 n 条「只有 a 一人披露」的有效信息轮证据（其余三项阈值都满足）。 */
  const oneDiscloserEvidence = (count: number): RecognitionEvidenceEntry[] =>
    recognizer(count).map((entry) => ({ ...entry, disclosedPlayerIds: ["a"] }));

  it("① 14 个 relationship completed 全是 buffer（低信息高能量）→ 不涨有效卡计数、不得互选", () => {
    const state = reduceAll(Array.from({ length: 14 }, (_, index) => relRound(index, { informationGain: "low" })));

    expect(state.relationshipEffectiveCardCount).toBe(0);
    expect(state.recognitionEvidence).toEqual([]);
    expect(state.sessionCompletedRounds).toBe(14); // 只计进度/完局，不参与检查点
    expect(
      mutualCheckTrigger({ relationship: state, participants: QUAD, sessionStatus: "active" }),
    ).toMatchObject({ due: false, checkpoint: null, reason: "not-at-checkpoint" });
  });

  it("② 14 个纯猜测、本人未揭晓 → 不计有效信息轮、不得互选", () => {
    const state = reduceAll(
      Array.from({ length: 14 }, (_, index) =>
        relRound(index, { selfDisclosed: false, disclosedPlayerIds: [] }),
      ),
    );

    expect(state.relationshipEffectiveCardCount).toBe(0);
    expect(state.recognitionEvidence).toEqual([]);
    expect(
      mutualCheckTrigger({ relationship: state, participants: QUAD, sessionStatus: "active" }).due,
    ).toBe(false);
  });

  it("③ 中及以上≥5、高≥1、维度≥3，但只有一个候选本人披露 → 认识阈值未达，不得互选", () => {
    const onlyOneDiscloser = rel({
      relationshipEffectiveCardCount: 12,
      sessionCompletedRounds: 12,
      recognitionEvidence: oneDiscloserEvidence(12),
    });
    const summary = recognitionEvidenceSummary(onlyOneDiscloser);
    expect(summary.mediumPlusRounds).toBeGreaterThanOrEqual(5);
    expect(summary.highRounds).toBeGreaterThanOrEqual(1);
    expect(summary.topics).toHaveLength(3);
    expect(summary.disclosedCandidates).toEqual(["a"]);

    expect(
      mutualCheckTrigger({ relationship: onlyOneDiscloser, participants: QUAD, sessionStatus: "active" }),
    ).toMatchObject({ due: false, checkpoint: 12, reason: "recognition-threshold-not-met" });
  });

  it("④ 认识阈值全满足且有效卡计数 ∈ [12,14] → 才 due（reducer 与触发同口径）", () => {
    for (const count of [12, 13, 14]) {
      const state = recognized(count);
      expect(mutualDueGates(state, count)).toBe(true);
      expect(
        mutualCheckTrigger({ relationship: state, participants: QUAD, sessionStatus: "active" }),
      ).toMatchObject({ due: true, checkpoint: count, reason: "ok" });
      expect(
        reduceRelationshipEvent(state, {
          eventId: "probe",
          type: "SYSTEM_MUTUAL_CHECK_DUE",
          dueCount: count,
        }).delta.reasons,
      ).toContain("mutual_due");
    }

    // 正向对照：14 个有效信息轮且两名候选各有披露 → 到窗口上界也不放弃，仍 due（不过度放弃）
    const full = reduceAll(Array.from({ length: 14 }, (_, index) => relRound(index)));
    expect(full.relationshipEffectiveCardCount).toBe(14);
    expect(full.midMutualCheckAbandoned).toBeFalsy();
    expect(
      mutualCheckTrigger({ relationship: full, participants: QUAD, sessionStatus: "active" }),
    ).toMatchObject({ due: true, checkpoint: 14, reason: "ok" });
  });

  it("⑤ 到 14 仍不足 → 本局中途互选永久跳过；15+ completed 不补问", () => {
    // 每个有效信息轮都只由 a 一人披露 → 第四项「两名候选各有本人披露」不达。
    // 12/13 在窗口内仍只是「认识阈值未达」，到窗口上界 14 才判定永久跳过。
    let state = reduceAll(
      Array.from({ length: 12 }, (_, index) => relRound(index, { disclosedPlayerIds: ["a"] })),
    );
    expect(state.relationshipEffectiveCardCount).toBe(12);
    expect(state.midMutualCheckAbandoned).toBeFalsy();
    expect(
      mutualCheckTrigger({ relationship: state, participants: QUAD, sessionStatus: "active" }),
    ).toMatchObject({ due: false, checkpoint: 12, reason: "recognition-threshold-not-met" });

    state = reduceRelationshipEvent(state, relRound(12, { disclosedPlayerIds: ["a"] })).state;
    expect(state.relationshipEffectiveCardCount).toBe(13);
    expect(state.midMutualCheckAbandoned).toBeFalsy();
    expect(
      mutualCheckTrigger({ relationship: state, participants: QUAD, sessionStatus: "active" }),
    ).toMatchObject({ due: false, checkpoint: 13, reason: "recognition-threshold-not-met" });

    // 到 14 仍未全满足 → 持久化「本局中途互选已放弃」（不靠 count<12 顺手判掉）
    state = reduceRelationshipEvent(state, relRound(13, { disclosedPlayerIds: ["a"] })).state;
    expect(state.relationshipEffectiveCardCount).toBe(14);
    expect(state.midMutualCheckAbandoned).toBe(true);
    expect(
      mutualCheckTrigger({ relationship: state, participants: QUAD, sessionStatus: "active" }),
    ).toMatchObject({ due: false, reason: "mid-mutual-abandoned" });

    // 越过窗口继续出题（15/16）：仍永久跳过，不在后续 completed round 补问
    for (const index of [14, 15]) {
      state = reduceRelationshipEvent(state, relRound(index)).state;
      expect(state.midMutualCheckAbandoned).toBe(true);
      expect(
        mutualCheckTrigger({ relationship: state, participants: QUAD, sessionStatus: "active" }).due,
      ).toBe(false);
    }
    expect(state.relationshipEffectiveCardCount).toBe(16);
  });

  it("⑥ completedRoundCount=12–14 本身不得触发（只看有效卡计数与认识阈值）", () => {
    const progressOnly = rel({
      sessionCompletedRounds: 13,
      relationshipEffectiveCardCount: 5,
      recognitionEvidence: recognizer(5), // 认识证据也齐，但有效卡计数不在窗口
    });
    expect(
      mutualCheckTrigger({ relationship: progressOnly, participants: QUAD, sessionStatus: "active" }),
    ).toMatchObject({ due: false, checkpoint: null, reason: "not-at-checkpoint" });

    // 对照：有效卡计数落在窗口内才会 due（与 completedRoundCount 无关）
    expect(
      mutualCheckTrigger({ relationship: recognized(12), participants: QUAD, sessionStatus: "active" }).due,
    ).toBe(true);
  });

  it("⑦ 收局时有效卡计数 <12 → 无中途互选", () => {
    expect(
      mutualCheckTrigger({ relationship: recognized(11), participants: QUAD, sessionStatus: "active" }),
    ).toMatchObject({ due: false, checkpoint: null, reason: "not-at-checkpoint" });
  });

  it("⑧ 最终互选：认识阈值不满足（或候选不合法）→ 不得提出", () => {
    // 只有一名候选本人披露 → 不得提出
    const onlyOne = rel({
      relationshipEffectiveCardCount: 14,
      sessionCompletedRounds: 14,
      recognitionEvidence: oneDiscloserEvidence(14),
    });
    expect(
      mutualFinalCheckTrigger({ relationship: onlyOne, participants: QUAD, sessionStatus: "active" }),
    ).toMatchObject({ due: false, reason: "recognition-threshold-not-met" });

    // 单锚桌型：披露者与「此刻合法候选」取交集后不足两名 → 不得提出（不用锚点一人的披露冒充两人）
    expect(
      mutualFinalCheckTrigger({ relationship: onlyOne, participants: ANCHOR_TABLE, sessionStatus: "active" }),
    ).toMatchObject({ due: false, reason: "recognition-threshold-not-met" });

    // 阈值满足且候选合法 → 可提出
    expect(
      mutualFinalCheckTrigger({ relationship: recognized(14), participants: QUAD, sessionStatus: "active" }),
    ).toMatchObject({ due: true, reason: "ok" });
  });

  it("⑩ 最终互选不因 Heat 判定：Heat 变化不改变 due（Step 3 移除 Heat>=H3）", () => {
    // (a) 同一条生产链、真实改变 Heat：6 轮有效信息轮 → H2；14 轮 → H4；两者认识阈值均满足。
    //     （经 reduceRelationshipEvent 归约得到，不手搓 recognitionEvidence。）
    const sixRounds = reduceAll(Array.from({ length: 6 }, (_, index) => relRound(index)));
    const fourteenRounds = reduceAll(Array.from({ length: 14 }, (_, index) => relRound(index)));
    expect(sixRounds.heat).toBe("H2");
    expect(fourteenRounds.heat).toBe("H4");
    // 6 轮低于已移除的旧硬编码门 Heat>=H3（MUTUAL_MIN_HEAT）：若该门仍在，sixRounds 必被误判 gates-not-passed。
    expect(isHeatAtLeast(sixRounds.heat, MUTUAL_MIN_HEAT)).toBe(false);
    expect(isHeatAtLeast(fourteenRounds.heat, MUTUAL_MIN_HEAT)).toBe(true);
    for (const relationship of [sixRounds, fourteenRounds]) {
      expect(
        mutualFinalCheckTrigger({ relationship, participants: QUAD, sessionStatus: "active" }),
      ).toMatchObject({ due: true, reason: "ok" });
    }

    // (b) 同一条生产链状态，只把 Heat 字段换成远低于 H3 的 H1（其余量不动）→ due 仍不变。
    //     生产 Heat 恒为有效卡计数的纯函数，唯一能独立变动 Heat 的方式就是覆盖该字段，故此处显式隔离该变量。
    const heatForced = { ...fourteenRounds, heat: "H1" as const };
    expect(isHeatAtLeast(heatForced.heat, MUTUAL_MIN_HEAT)).toBe(false);
    expect(
      mutualFinalCheckTrigger({ relationship: heatForced, participants: QUAD, sessionStatus: "active" }),
    ).toMatchObject({ due: true, reason: "ok" });
  });

  it("缓冲主题常量与 §3 metadata 枚举同源（防漂移）", () => {
    expect(V2_TOPICS).toContain(LIVE_CHEMISTRY_BUFFER_TOPIC);
  });

  it("⑨ 旧存档（已消耗旧 9/14/19）不补触发", () => {    const legacy = rel({
      relationshipEffectiveCardCount: 20,
      sessionCompletedRounds: 20,
      regularMutualCheckRuns: 3,
      lastMutualCheckAtEffectiveCount: 19,
      recognitionEvidence: recognizer(20),
    });
    expect(
      mutualCheckTrigger({ relationship: legacy, participants: QUAD, sessionStatus: "active" }),
    ).toMatchObject({ due: false, checkpoint: null, reason: "not-at-checkpoint" });

    // 旧存档推进到窗口内也不补（已 consumed 不转成新检查点）
    for (const count of [12, 13, 14]) {
      const atWindow: RelationshipState = {
        ...legacy,
        relationshipEffectiveCardCount: count,
        sessionCompletedRounds: count,
        heat: heatForEffectiveCount(count),
      };
      expect(
        mutualCheckTrigger({ relationship: atWindow, participants: QUAD, sessionStatus: "active" }),
      ).toMatchObject({ due: false, reason: "gates-not-passed" });
    }

    // 旧检查点 9/19 彻底废止：即便从未问过也不构成检查点
    for (const count of [9, 19]) {
      const oldCheckpoint: RelationshipState = {
        ...legacy,
        relationshipEffectiveCardCount: count,
        sessionCompletedRounds: count,
        heat: heatForEffectiveCount(count),
      };
      expect(
        mutualCheckTrigger({ relationship: oldCheckpoint, participants: QUAD, sessionStatus: "active" }),
      ).toMatchObject({ checkpoint: null, reason: "not-at-checkpoint" });
    }
  });
});
