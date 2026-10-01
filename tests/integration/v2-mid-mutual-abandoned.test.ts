/**
 * B3-8｜`midMutualCheckAbandoned` 完整前置条件覆盖（Human Step 2 / HANDOFF §5.5）。
 *
 * 证明链（全走生产代码，测试只提供两支**正式输入**，与 B3-7 同手法）：
 *
 * ```
 * audited metadata fixture（既有 sidecar override 入口）
 *   + 显式 disclosure signal（正式 round result 通道）
 * → resolveRoundAndReduce（唯一轮终态业务入口）
 * → eventForRoundTerminal（唯一 R3 事件产出点）
 * → reduceV2SessionEvents → reduceRelationshipEvent
 * → recognitionEvidence / relationshipEffectiveCardCount / Heat
 * → midMutualCheckAbandoned（持久化）＋ mutualCheckTrigger().reason
 * ```
 *
 * 纪律（Human 冻结 + 编排者红线，与 B3-7 一致）：
 * - **不**直接赋值 `relationshipState` / `recognitionEvidence` / `relationshipEffectiveCardCount` /
 *   `heat` / `midMutualCheckAbandoned`；这些值一律由上面的生产链派生后**读回**。
 * - **不**手拼 `RelationshipEvent`；事件只来自 `resolveRoundAndReduce`（轮终态）与
 *   `mutualCheckFinalEvents`（Mutual 收束，页面同款）。
 * - metadata 只经 `v2-card-quality-index` 的 `setCardQualityIndexOverrides` 注入；
 *   `afterEach` 清 override + 懒缓存。
 * - 认识阈值数值（medium+≥5 / high≥1 / 人物维度≥3 / ≥2 合法候选本人披露）与窗口 [12,14] 一律不改。
 * - 本文件只新增测试，不改生产代码；断言一律以 Human Step 2 冻结行为为准
 *   （B3-9 修复 D1 候选口径 / D2 awaiting 实时阻断后，原「留档缺陷」断言已改为断言正确行为）。
 */

import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_BOUNDARIES } from "@/lib/domain/constants";
import type { GameCard, GameSession, Player, SessionConfig } from "@/lib/domain/schemas";
import {
  createSession,
  resolveRoundAndReduce,
  roundDisclosureSignal,
  startRound,
} from "@/lib/engine/session-engine";
import { awaitingHostDecision, orchestrationOf, relationshipOf, withV2State } from "@/lib/engine/v2-deal";
import { mainlineSsotCardsByPack } from "@/lib/v2-content/v2-card-bridge";
import type { V2RoundMetadataFields } from "@/lib/v2-content/v2-card-metadata";
import {
  metadataForCard,
  resetCardQualityIndexCache,
  setCardQualityIndexOverrides,
} from "@/lib/v2-content/v2-card-quality-index";
import {
  beginMutualCheckRun,
  finalizeMutualCheckRun,
  mutualCandidateIds,
  mutualCheckFinalEvents,
  mutualCheckTrigger,
  mutualFinalCheckTrigger,
  submitMutualChoice,
} from "@/lib/v2-relationship/v2-mutual-check";
import { normalizeParticipants } from "@/lib/v2-relationship/v2-participants";
import { recognitionThresholdMet } from "@/lib/v2-relationship/v2-reducer";
import { reduceV2SessionEvents, type V2SessionState } from "@/lib/v2-relationship/v2-session";
import {
  HEAT_THRESHOLDS,
  heatForEffectiveCount,
  isHeatAtLeast,
  MUTUAL_CHECK_WINDOW_MAX,
  MUTUAL_MIN_HEAT,
  type SessionParticipant,
} from "@/lib/v2-relationship/v2-state";

/* ------------------------------------------------------------------ */
/* 装置（复用 B3-7：同一 PACK / 同副牌 / 同一 sidecar override 入口）        */
/* ------------------------------------------------------------------ */

const PACK_ID = "never-have";

const players = (): Player[] =>
  ["a", "b", "c", "d"].map((id) => ({
    id,
    displayName: `玩家${id}`,
    active: true,
    createdAt: "x",
    lastUsedAt: "x",
  }));

/** 标准 2 男 2 女：合法边 a::b / a::d / b::c / c::d，四人都属当前合法候选。 */
const standardParticipants = (): SessionParticipant[] => [
  { playerId: "a", active: true, pairGender: "male" },
  { playerId: "b", active: true, pairGender: "female" },
  { playerId: "c", active: true, pairGender: "male" },
  { playerId: "d", active: true, pairGender: "female" },
];

/** 反例：全员同性 → 无任何合法男女边（pairMode = NO_ELIGIBLE_PAIR）。 */
const noPairParticipants = (): SessionParticipant[] => [
  { playerId: "a", active: true, pairGender: "male" },
  { playerId: "b", active: true, pairGender: "male" },
  { playerId: "c", active: true, pairGender: "male" },
  { playerId: "d", active: true, pairGender: "male" },
];

/**
 * 反例：d 未录性别 → 合法边只剩 a::c / b::c，合法候选 = [a,b,c]（d 不是候选）。
 * 用于考「reducer 与 trigger 的候选口径是否一致」。
 */
const nonCandidateDiscloserParticipants = (): SessionParticipant[] => [
  { playerId: "a", active: true, pairGender: "male" },
  { playerId: "b", active: true, pairGender: "male" },
  { playerId: "c", active: true, pairGender: "female" },
  { playerId: "d", active: true, pairGender: null },
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

const DECK_SIZE = 18;
const DECK: readonly GameCard[] = mainlineSsotCardsByPack(PACK_ID)
  .filter((card) => card.intensity <= 4)
  .sort((first, second) => (first.id < second.id ? -1 : first.id > second.id ? 1 : 0))
  .slice(0, DECK_SIZE);

if (DECK.length !== DECK_SIZE) {
  throw new Error(`B3-8 fixture 需要 ${DECK_SIZE} 张 ${PACK_ID} 全桌卡，实际 ${DECK.length}`);
}

const PERSON_TOPICS = ["择偶偏好", "恋爱观", "相处规则"] as const;

/** 基准 audited fixture：任意 14 张都有 ≥1 high、≥3 个人物维度、中及以上 = 14。 */
const auditedFieldsAt = (slot: number): V2RoundMetadataFields => ({
  informationGain: slot % 3 === 0 ? "high" : "medium",
  topic: PERSON_TOPICS[slot % 3]!,
});

/** 把整副牌按 slot 分槽写同一份 metadata 变体（抽到哪张都命中）。 */
const overrideDeck = (fieldsAt: (slot: number) => V2RoundMetadataFields): void =>
  setCardQualityIndexOverrides(new Map(DECK.map((card, slot) => [card.id, fieldsAt(slot)])));

const injectAuditedMetadata = (): void => overrideDeck(auditedFieldsAt);

afterEach(() => {
  setCardQualityIndexOverrides(new Map());
  resetCardQualityIndexCache();
});

const FIXED_DRAW_SEED = 20260928;

const newSession = (
  deck: readonly GameCard[] = DECK,
  participants: readonly SessionParticipant[] = standardParticipants(),
): GameSession => createSession(config(), [...deck], [...participants]);

/** 真实出题一轮（唯一出卡入口 startRound → drawV2SessionCard → Router）。 */
function drawCard(session: GameSession): GameSession {
  const next = startRound(session, () => 0, { drawSeed: FIXED_DRAW_SEED });
  expect(next.currentRound, "每轮都必须真实出题（不得进入耗尽/等待态）").toBeDefined();
  return next;
}

/** 正式轮终态通道：completed + 显式揭晓信号。 */
function completeRoundWith(
  session: GameSession,
  disclosedPlayerIds: readonly string[],
): GameSession {
  return resolveRoundAndReduce(
    session,
    "complete",
    roundDisclosureSignal({ selfDisclosed: true, disclosedPlayerIds: [...disclosedPlayerIds] }),
  );
}

/** 连走 n 个真实「出题 → completed+揭晓」轮；披露者由 discloseAt(index) 决定。 */
function driveRounds(
  session: GameSession,
  rounds: number,
  discloseAt: (index: number) => readonly string[],
): GameSession {
  let current = session;
  for (let index = 0; index < rounds; index += 1) {
    current = completeRoundWith(drawCard(current), discloseAt(index));
  }
  return current;
}

/** B3-7 同款：a/b 交替披露（两名合法候选各有本人披露）。 */
const driveEffectiveRounds = (session: GameSession, rounds: number): GameSession =>
  driveRounds(session, rounds, (index) => (index % 2 === 0 ? ["a"] : ["b"]));

const triggerOf = (
  session: GameSession,
  extra: Partial<Parameters<typeof mutualCheckTrigger>[0]> = {},
) =>
  mutualCheckTrigger({
    relationship: relationshipOf(session),
    participants: normalizeParticipants(session.participants, session.config.players),
    sessionStatus: session.status,
    ...extra,
  });

const finalTriggerOf = (
  session: GameSession,
  extra: Partial<Parameters<typeof mutualFinalCheckTrigger>[0]> = {},
) =>
  mutualFinalCheckTrigger({
    relationship: relationshipOf(session),
    participants: normalizeParticipants(session.participants, session.config.players),
    sessionStatus: session.status,
    ...extra,
  });

const countOf = (session: GameSession): number =>
  relationshipOf(session).relationshipEffectiveCardCount;
const abandonedOf = (session: GameSession): boolean | undefined =>
  relationshipOf(session).midMutualCheckAbandoned;

const MATCH_TS = "2026-09-28T00:00:00.000Z";

/** 页面同款 Mutual 收束（B3-7 同形）：run → 双方互选 → finalize → DUE/MATCH 事件归约。 */
function finalizeMutual(session: GameSession, checkpoint: number, first: string, second: string): GameSession {
  const normalized = normalizeParticipants(session.participants, session.config.players);
  const run = beginMutualCheckRun(normalized);
  submitMutualChoice(run, first, second);
  submitMutualChoice(run, second, first);
  const result = finalizeMutualCheckRun(run, relationshipOf(session));
  expect(result.matches.map((match) => match.pairKey)).toEqual([[first, second].sort().join("::")]);
  const events = mutualCheckFinalEvents(run.runId, checkpoint, result, MATCH_TS);
  const state: V2SessionState = {
    sessionId: session.id,
    relationship: relationshipOf(session),
    participants: normalized,
    orchestration: orchestrationOf(session),
  };
  return withV2State(session, reduceV2SessionEvents(state, events).state);
}

/* ------------------------------------------------------------------ */
/* ① 边界：count===14 且全部前置条件满足 → 不得置 abandoned，且应能弹          */
/* ------------------------------------------------------------------ */

describe("B3-8｜count=14 midMutualCheckAbandoned 完整前置条件覆盖", () => {
  it("① 边界：count===14 全条件满足 → abandoned 不置位，且 trigger.due（弹一次）", () => {
    injectAuditedMetadata();
    const session = driveEffectiveRounds(newSession(), 14);

    expect(countOf(session)).toBe(MUTUAL_CHECK_WINDOW_MAX);
    expect(countOf(session)).toBe(14);
    expect(abandonedOf(session)).toBeFalsy();
    expect(triggerOf(session)).toMatchObject({
      due: true,
      checkpoint: 14,
      pairMode: "ACTIVE",
      reason: "ok",
    });
  });

  /* ---------------------------------------------------------------- */
  /* ② recognition 阈值任一子条件不达 → count=14 置 abandoned，且此后不补弹    */
  /* ---------------------------------------------------------------- */

  it("② recognition 阈值不达（high=0 / 人物维度<3 / 候选披露<2）→ count=14 置 abandoned，此后不补弹", () => {
    /** 不达变体：全部走真实 14 个 effective 轮 → 由生产链自己判 abandoned。 */
    const cases: { name: string; run: () => GameSession }[] = [
      {
        name: "high=0（全 medium）",
        run: () => {
          overrideDeck((slot) => ({
            informationGain: "medium",
            topic: PERSON_TOPICS[slot % 3]!,
          }));
          return driveEffectiveRounds(newSession(), 14);
        },
      },
      {
        name: "人物维度<3（14 轮同一人物维度）",
        run: () => {
          overrideDeck((slot) => ({
            informationGain: slot % 3 === 0 ? "high" : "medium",
            topic: PERSON_TOPICS[0]!,
          }));
          return driveEffectiveRounds(newSession(), 14);
        },
      },
      {
        name: "候选本人披露<2（14 轮只有 a 一人披露）",
        run: () => {
          injectAuditedMetadata();
          return driveRounds(newSession(), 14, () => ["a"]);
        },
      },
    ];

    for (const { name, run } of cases) {
      const session = run();
      expect(countOf(session), `${name}｜有效卡计数应仍真实到 14`).toBe(14);
      expect(abandonedOf(session), `${name}｜应置 midMutualCheckAbandoned=true`).toBe(true);
      expect(triggerOf(session), `${name}｜应拒弹并给出 abandoned 原因`).toMatchObject({
        due: false,
        checkpoint: 14,
        reason: "mid-mutual-abandoned",
      });

      // 此后不得补弹：继续喂轮次（≥3 轮）也不得 due。
      const later = driveEffectiveRounds(session, 3);
      expect(countOf(later), `${name}｜继续有效轮`).toBeGreaterThan(14);
      expect(abandonedOf(later), `${name}｜abandoned 必须保持`).toBe(true);
      expect(triggerOf(later).due, `${name}｜本局后续不得补问`).toBe(false);
      expect(triggerOf(later).reason, `${name}｜原因恒为 abandoned`).toBe("mid-mutual-abandoned");
    }
  });

  it("③ 契约：count=14 时 medium+ 恒 = 14（结构上不可能 <5），故「中及以上<5」不可单独成为反例", () => {
    injectAuditedMetadata();
    const session = driveEffectiveRounds(newSession(), 14);
    const state = relationshipOf(session);
    const evidence = state.recognitionEvidence ?? [];

    // 「有效信息轮」谓词只放行 medium/high，且每次 +1 必同写一条证据 → 两者恒等。
    expect(evidence).toHaveLength(14);
    const mediumPlus = evidence.filter(
      (entry) => entry.informationGain === "medium" || entry.informationGain === "high",
    ).length;
    expect(mediumPlus).toBe(14);
    expect(countOf(session)).toBe(mediumPlus);
    // 因此 count=14 ⇒ medium+ = 14 ≥ 5（见报告：本条只能做契约断言，不能构造独立反例）。
  });

  /* ---------------------------------------------------------------- */
  /* ④ 无 eligible pair / 当前无合法候选                                    */
  /* ---------------------------------------------------------------- */

  it("④ 无 eligible pair（全员同性）→ trigger 拒弹；count=14 置 abandoned（eligible pair 是前置条件）", () => {
    injectAuditedMetadata();
    // 全员同性：无任何合法男女边，但牌堆是全桌卡，14 个 effective 轮照常可达。
    const session = driveRounds(
      newSession(DECK, noPairParticipants()),
      14,
      (index) => (index % 2 === 0 ? ["a"] : ["b"]),
    );

    expect(countOf(session)).toBe(14);
    expect(normalizeParticipants(session.participants, session.config.players)).toHaveLength(4);
    expect(mutualCandidateIds(normalizeParticipants(session.participants, session.config.players))).toEqual([]);
    // 拒弹原因：abandoned 标志已在第 14 轮由 reducer 持久化，优先于 pairMode 检查（故 reason 为
    // mid-mutual-abandoned）；仍如实回传 pairMode=NO_ELIGIBLE_PAIR。
    expect(triggerOf(session)).toMatchObject({
      due: false,
      checkpoint: 14,
      pairMode: "NO_ELIGIBLE_PAIR",
      reason: "mid-mutual-abandoned",
    });

    // Human Step 2：eligible pair / 当前合法 candidate 是中途互选前置条件之一；
    // 到 count=14 仍无合法候选 → 必须持久化 midMutualCheckAbandoned=true。
    expect(abandonedOf(session), "无合法候选 → 窗口上界必须置 abandoned").toBe(true);

    // 此后不补问：abandoned 持久化（触发点先看 abandoned，原因转为 mid-mutual-abandoned）。
    const later = driveRounds(session, 2, (index) => (index % 2 === 0 ? ["a"] : ["b"]));
    expect(abandonedOf(later)).toBe(true);
    expect(triggerOf(later)).toMatchObject({ due: false, reason: "mid-mutual-abandoned" });
  });

  /* ---------------------------------------------------------------- */
  /* ⑤ Heat gate 真实取值                                                  */
  /* ---------------------------------------------------------------- */

  it("⑤ Heat gate 真实条件：count=14 时 Heat=H4 ≥ H3（Heat 不可单独成为窗口内反例）", () => {
    injectAuditedMetadata();
    const session = driveEffectiveRounds(newSession(), 14);
    const state = relationshipOf(session);

    // Heat 是 relationshipEffectiveCardCount 的纯派生（v2-state.ts heatForEffectiveCount / HEAT_THRESHOLDS）。
    expect(state.heat).toBe(heatForEffectiveCount(14));
    expect(state.heat).toBe("H4");
    expect(HEAT_THRESHOLDS.find((band) => band.heat === "H4")).toMatchObject({ min: 13, max: Infinity });

    // 代码契约：Mutual 最低 Heat = "H3"（v2-state.ts:82 MUTUAL_MIN_HEAT）；窗口下界 12 已落 H3 档。
    expect(MUTUAL_MIN_HEAT).toBe("H3");
    expect(HEAT_THRESHOLDS.find((band) => band.heat === "H3")).toMatchObject({ min: 8, max: 12 });
    expect(isHeatAtLeast(state.heat, MUTUAL_MIN_HEAT)).toBe(true);
    // 因 Heat 纯派生且 count=14⇒H4，mutualMidWindowGates 的 Heat 子门在窗口内恒成立：
    // 无法用真实事件链构造「count=14 且 Heat<H3」→ 本条只做契约断言（报告写明，不写成产品规则）。
  });

  /* ---------------------------------------------------------------- */
  /* ⑥ 已发生 regular mutual（regularMutualCheckRuns > 0）                  */
  /* ---------------------------------------------------------------- */

  it("⑥ 已发生 regular mutual → 不置 abandoned（互选已用过，非「跳过」），run 上限生效", () => {
    injectAuditedMetadata();
    let session = driveEffectiveRounds(newSession(), 14);
    expect(triggerOf(session)).toMatchObject({ due: true, checkpoint: 14, reason: "ok" });

    session = finalizeMutual(session, 14, "a", "b");
    expect(relationshipOf(session).regularMutualCheckRuns).toBe(1);
    expect(abandonedOf(session)).toBeFalsy();

    // run 上限（一局一次）使同一检查点不再 due；原因必须是「硬门未过」，不得误报认识阈值不够。
    expect(triggerOf(session)).toMatchObject({ due: false, checkpoint: 14, reason: "gates-not-passed" });

    // 继续有效轮越过窗口：已问过 → 仍不得被标成本局永久跳过。
    const later = driveEffectiveRounds(session, 2);
    expect(countOf(later)).toBeGreaterThan(14);
    expect(abandonedOf(later)).toBeFalsy();
  });

  /* ---------------------------------------------------------------- */
  /* ⑦ private mutual flow 进行中                                          */
  /* ---------------------------------------------------------------- */

  it("⑦ private mutual flow 进行中 → 触发点挡下（session-not-running），不置 abandoned（暂时被挡≠永久放弃）", () => {
    injectAuditedMetadata();
    const session = driveEffectiveRounds(newSession(), 14);

    // 同一点，不传 privateFlowRunning = due；传 true = 被挡。证明挡它的只有「已有私密流程在跑」。
    expect(triggerOf(session)).toMatchObject({ due: true, checkpoint: 14, reason: "ok" });
    expect(triggerOf(session, { privateFlowRunning: true })).toMatchObject({
      due: false,
      checkpoint: 14,
      reason: "session-not-running",
    });
    // private flow 是 UI 运行态（不在 relationshipState 内）：reducer 6a 有意不判死，
    // 以免把「条件其实够、只是暂时被挡」误标为永久放弃（v2-reducer.ts 6a 注释）。
    expect(abandonedOf(session)).toBeFalsy();
  });

  /* ---------------------------------------------------------------- */
  /* ⑧ exhaustion / awaiting（AWAITING_HOST_EXHAUSTION_DECISION）          */
  /* ---------------------------------------------------------------- */

  it("⑧ 恰好 14 张牌走满 → count=14 且进入 AWAITING；awaiting 实时阻断，但不置 abandoned", () => {
    injectAuditedMetadata();
    // 14 张牌 = 14 个 effective 轮刚好用尽，随后 startRound 进入 Host 决策等待态（不自动结束）。
    const windowed = driveEffectiveRounds(newSession(DECK.slice(0, 14)), 14);
    expect(countOf(windowed)).toBe(14);

    const awaiting = startRound(windowed, () => 0, { drawSeed: FIXED_DRAW_SEED });
    expect(awaitingHostDecision(awaiting), "应进入 AWAITING_HOST_EXHAUSTION_DECISION").toBeDefined();
    expect(countOf(awaiting), "等待态不推进有效卡计数").toBe(14);

    // Human Step 2：exhaustion / awaiting 是中途互选前置条件之一 → trigger 侧实时阻断（不弹）。
    expect(triggerOf(awaiting, { awaitingHostDecision: true })).toMatchObject({
      due: false,
      checkpoint: 14,
      reason: "awaiting-host-decision",
    });
    // 对照：不带 awaiting 输入时同一点仍 due —— 证明阻断确实来自 awaiting 这一实时前置条件。
    expect(triggerOf(awaiting)).toMatchObject({ due: true, checkpoint: 14, reason: "ok" });
    // 「暂时被挡 ≠ 永久放弃」：awaiting 由触发点实时复核，不由 reducer 判死 → 不得置 abandoned。
    expect(abandonedOf(awaiting), "awaiting 属实时阻断，不得置永久放弃").toBeFalsy();
  });

  /* ---------------------------------------------------------------- */
  /* ⑨ count > 14（错过窗口）                                             */
  /* ---------------------------------------------------------------- */

  it("⑨ count>14 错过窗口：认识阈值不达 → abandoned=true；条件达成但从未问过 → 按现契约不置位", () => {
    // ⑨a：15 个 effective 轮且 high=0（阈值始终不达）→ 越过窗口即永久跳过。
    overrideDeck((slot) => ({ informationGain: "medium", topic: PERSON_TOPICS[slot % 3]! }));
    const missed = driveEffectiveRounds(newSession(), 15);
    expect(countOf(missed)).toBe(15);
    expect(abandonedOf(missed)).toBe(true);
    expect(triggerOf(missed)).toMatchObject({ due: false, checkpoint: null, reason: "mid-mutual-abandoned" });

    // ⑨b：条件在 14 全满足（含此刻合法候选）→ 按 Human Step 2「只有到 14 时前置条件仍不成立才放弃」，
    // 不置 abandoned；越过窗口后 trigger 已 not-at-checkpoint（不再补弹），与 abandoned 标志无关。
    overrideDeck(auditedFieldsAt);
    const viablePast = driveEffectiveRounds(newSession(), 15);
    expect(countOf(viablePast)).toBe(15);
    expect(relationshipOf(viablePast).regularMutualCheckRuns).toBe(0);
    expect(abandonedOf(viablePast), "窗口内前置条件全满足 → 不得标永久放弃").toBeFalsy();
    expect(triggerOf(viablePast)).toMatchObject({ due: false, checkpoint: null, reason: "not-at-checkpoint" });
  });

  /* ---------------------------------------------------------------- */
  /* ⑩ reducer 与 trigger 的候选口径一致性（Human 点名缺口）                  */
  /* ---------------------------------------------------------------- */

  it("⑩ 候选口径一致性：reducer 与 trigger 同源收窄 → count=14 置 abandoned", () => {
    injectAuditedMetadata();
    // 合法边只剩 a::c / b::c（d 未录性别）→ 合法候选 = [a,b,c]；14 轮交替披露 a 与 d（d 不是候选）。
    const session = driveRounds(
      newSession(DECK, nonCandidateDiscloserParticipants()),
      14,
      (index) => (index % 2 === 0 ? ["a"] : ["d"]),
    );
    expect(countOf(session)).toBe(14);

    const state = relationshipOf(session);
    const candidates = mutualCandidateIds(
      normalizeParticipants(session.participants, session.config.players),
    );
    expect(candidates).toEqual(["a", "b", "c"]);

    // 候选口径差异（旧缺陷根因）：同一份认识证据，收窄到合法候选后只剩 a（不足两名），不收窄则有 a/d 两名。
    expect(recognitionThresholdMet(state, candidates), "trigger 口径：按合法候选收窄 → 不达").toBe(false);
    expect(recognitionThresholdMet(state, undefined), "不传候选（旧 reducer 口径）→ 达（缺陷根因）").toBe(true);

    // D1：reducer 6a 现在与 trigger 同源收窄 → 窗口上界持久化 abandoned；
    // 触发点因此拒弹并报 abandoned（不再出现「trigger 拒弹、reducer 却不落标志」的口径裂缝）。
    expect(abandonedOf(session), "口径一致后，合法候选不足两名 → 置 abandoned").toBe(true);
    expect(triggerOf(session)).toMatchObject({
      due: false,
      checkpoint: 14,
      reason: "mid-mutual-abandoned",
    });
  });

  /* ---------------------------------------------------------------- */
  /* ⑪ afterEach 清理自证                                                  */
  /* ---------------------------------------------------------------- */

  it("⑪ sidecar override 已由 afterEach 清理：复算回到纯 SSOT 投影（未补标 = 双 null）", () => {
    for (const card of [DECK[0]!, DECK[DECK.length - 1]!]) {
      expect(metadataForCard(card.id), `${card.id} 清理后应回到未补标`).toEqual({
        informationGain: null,
        topic: null,
      });
    }
    injectAuditedMetadata();
    expect(metadataForCard(DECK[0]!.id)).toEqual(auditedFieldsAt(0));
  });
});

/* ------------------------------------------------------------------ */
/* B3-17｜final Mutual 的 awaiting 实时阻断（Step 3 尾巴，Human 7.1）         */
/* ------------------------------------------------------------------ */

describe("B3-17｜final Mutual awaiting 实时阻断（同 reason、不置 abandoned）", () => {
  it("① awaiting=false 且资格满足 → final due=true（技术能力仍在，未接 App 结束流程）", () => {
    injectAuditedMetadata();
    const session = driveEffectiveRounds(newSession(), 14);
    expect(countOf(session)).toBe(14);
    expect(abandonedOf(session)).toBeFalsy();

    // 显式 awaiting=false 与缺省 undefined 都不得阻断（加输入前逐条一致）。
    expect(finalTriggerOf(session, { awaitingHostDecision: false })).toMatchObject({
      due: true,
      checkpoint: null,
      pairMode: "ACTIVE",
      reason: "ok",
    });
    expect(finalTriggerOf(session)).toMatchObject({ due: true, reason: "ok" });
  });

  it("② awaiting=true → final due=false 且 reason=awaiting-host-decision（真实 AWAITING 态）", () => {
    injectAuditedMetadata();
    // 14 张牌走满 14 个 effective 轮 → startRound 进入真实 AWAITING（D8=A+ 等待态）。
    const windowed = driveEffectiveRounds(newSession(DECK.slice(0, 14)), 14);
    const awaiting = startRound(windowed, () => 0, { drawSeed: FIXED_DRAW_SEED });
    expect(awaitingHostDecision(awaiting), "应进入 AWAITING_HOST_EXHAUSTION_DECISION").toBeDefined();

    expect(finalTriggerOf(awaiting, { awaitingHostDecision: true })).toMatchObject({
      due: false,
      checkpoint: null,
      pairMode: "ACTIVE",
      reason: "awaiting-host-decision",
    });
    // 对照：同一等待态不传 awaiting → 仍 due：证明阻断确来自 awaiting 这一实时前置条件。
    expect(finalTriggerOf(awaiting)).toMatchObject({ due: true, reason: "ok" });
  });

  it("③ awaiting=true 不产生 abandoned（纯判定、不改状态：abandoned 仍 false、无 MATCH）", () => {
    injectAuditedMetadata();
    const windowed = driveEffectiveRounds(newSession(DECK.slice(0, 14)), 14);
    const awaiting = startRound(windowed, () => 0, { drawSeed: FIXED_DRAW_SEED });

    const before = relationshipOf(awaiting);
    expect(abandonedOf(awaiting)).toBeFalsy();

    expect(finalTriggerOf(awaiting, { awaitingHostDecision: true }).due).toBe(false);

    // 阻断是「暂时被挡」不是「永久放弃」：判定前后 relationship 未变（无 abandoned、无 MATCH）。
    expect(relationshipOf(awaiting)).toEqual(before);
    expect(abandonedOf(awaiting)).toBeFalsy();
    expect(relationshipOf(awaiting).regularMutualCheckRuns).toBe(0);
    expect(Object.keys(relationshipOf(awaiting).matches)).toEqual([]);
  });

  it("④ 回归：同一 AWAITING 态下中途 Mutual 的 awaiting-host-decision 阻断不变（同 reason）", () => {
    injectAuditedMetadata();
    const windowed = driveEffectiveRounds(newSession(DECK.slice(0, 14)), 14);
    const awaiting = startRound(windowed, () => 0, { drawSeed: FIXED_DRAW_SEED });
    expect(countOf(awaiting)).toBe(14);

    // 中途：awaiting 阻断（checkpoint 仍在窗口内）——与 final 同一个 reason 字面量。
    const midBlocked = triggerOf(awaiting, { awaitingHostDecision: true });
    expect(midBlocked).toMatchObject({ due: false, checkpoint: 14, reason: "awaiting-host-decision" });
    expect(midBlocked.reason).toBe(finalTriggerOf(awaiting, { awaitingHostDecision: true }).reason);
    // 对照：不传 awaiting 时中途仍 due（阻断只来自 awaiting，行为未变）。
    expect(triggerOf(awaiting)).toMatchObject({ due: true, checkpoint: 14, reason: "ok" });
  });
});
