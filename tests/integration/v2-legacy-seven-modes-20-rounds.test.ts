/**
 * B3-15｜七种单玩法 legacy 局 × 20 轮 全覆盖（QA-COV-01 覆盖缺口）。
 *
 * 起因：`docs/qa/BUGS-PHASEB-B2.2.md` 的 QA-COV-01 —— 旧 E2E
 * （`tests/e2e/v2-mutual-flow.spec.ts:94`）只对 `truth-dare` 一种玩法跑满 20 轮，
 * 其余六种没有任何「单玩法 legacy 20 轮」证据，因此不能把负向结论外推到七种玩法。
 * 本用例把这条矩阵补成**数据驱动的 7 个玩法 × 20 轮**，全部走真实生产链。
 *
 * ## 玩法枚举真源（不手写字符串猜玩法 id）
 * - 玩法（gameType）枚举：`lib/v2-content/v2-types.ts:26` 的 `V2_GAME_TYPES`
 *   （`truth / dare / most_likely / never_have_i / either_or / pointing / chemistry`）。
 * - gameType → pack/cardType 映射：`lib/v2-content/v2-card-bridge.ts:46` 的
 *   `V2_MAINLINE_PACK_BY_GAME_TYPE`（不另写第二份映射）。
 * - 每个玩法的 legacy 牌堆：`BUILTIN_SEED_CARDS`（`seed-*`，旧 V1.6 终稿）按
 *   `packId + type` 过滤 —— 与生产 legacy 局的旧种子同源。
 *
 * ## 纪律（Human 冻结 + 编排者红线，与 B3-7 integration 同口径）
 * - 出卡走**唯一出卡入口** `startRound → drawDeckCard → drawV2SessionCard`（V2 Router）；
 *   终态走**唯一轮终态业务入口** `resolveRoundAndReduce`（engine 级 resolve + reduce）。
 * - **不**直接写 `relationshipState` / `recognitionEvidence` / count / heat / abandoned：
 *   本文件没有任何一处对关系态赋值，全部由生产链派生后**读回**。
 * - **metadata 不注入**（本单考 legacy 轨；注入就失去意义）：全程不调用
 *   `setCardQualityIndexOverrides`，并在每轮断言 sidecar 投影仍为 `{null, null}`。
 * - 认识阈值 / 窗口 `[12,14]` / Heat 硬门 / D6 / 四项 fail-closed / SSOT 文本 / 版本三处 /
 *   manifest 两轨 / BAR-FIT 口径一律不动。
 * - 若某玩法实际跑不满 20 轮（真库存不足 / 真回归），**不改断言掩盖**，用例直接红并给出真实卡量。
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_BOUNDARIES } from "@/lib/domain/constants";
import type { GameCard, GameSession, Intensity, Player, SessionConfig } from "@/lib/domain/schemas";
import { BUILTIN_SEED_CARDS } from "@/lib/game-packs/built-in-seeds";
import { createSession, resolveRoundAndReduce, startRound } from "@/lib/engine/session-engine";
import { orchestrationOf, relationshipOf } from "@/lib/engine/v2-deal";
import {
  V2_MAINLINE_PACK_BY_GAME_TYPE,
  mainlineSsotCardsByPack,
} from "@/lib/v2-content/v2-card-bridge";
import { V2_GAME_TYPES } from "@/lib/v2-content/v2-types";
import { metadataForCard } from "@/lib/v2-content/v2-card-quality-index";
import {
  cardContentTrack,
  refillAllowsCard,
  type ContentTrack,
} from "@/lib/v2-content/fixed-content-manifest";
import {
  mutualCheckTrigger,
  mutualFinalCheckTrigger,
} from "@/lib/v2-relationship/v2-mutual-check";
import { normalizeParticipants } from "@/lib/v2-relationship/v2-participants";
import {
  BASE_SESSION_COMPLETED_ROUND_LIMIT,
  type SessionParticipant,
} from "@/lib/v2-relationship/v2-state";

/* ------------------------------------------------------------------ */
/* 常量：轮数与耗尽口径                                                  */
/* ------------------------------------------------------------------ */

/** 20 轮＝`BASE_SESSION_COMPLETED_ROUND_LIMIT`（生产常量，不另写数字）。 */
const COMPLETED_ROUNDS = BASE_SESSION_COMPLETED_ROUND_LIMIT;

/** 真「耗尽」（本轮出不了卡、必须由 Host 决策）：这两种任一命中即判失败。 */
const HARD_EXHAUSTION_LEVELS = [
  "PACK_EXHAUSTED",
  "RELATIONSHIP_GLOBAL_EXHAUSTED",
  "AWAITING_HOST_EXHAUSTION_DECISION",
] as const;

/** 固定出卡 seed（复算专用）：保证同一 seed 下逐轮出卡确定，不引入随机源。 */
const FIXED_DRAW_SEED = 20260928;

/* ------------------------------------------------------------------ */
/* 装置                                                                  */
/* ------------------------------------------------------------------ */

/** 2 男 2 女：存在合法异性 pair（「不弹 Mutual」不是因为没候选）。 */
const players = (): Player[] =>
  ["p1", "p2", "p3", "p4"].map((id, index) => ({
    id,
    displayName: `玩家${id}`,
    active: true,
    createdAt: `t${index}`,
    lastUsedAt: `t${index}`,
  }));

const participants = (): SessionParticipant[] => [
  { playerId: "p1", active: true, pairGender: "male" },
  { playerId: "p2", active: true, pairGender: "female" },
  { playerId: "p3", active: true, pairGender: "male" },
  { playerId: "p4", active: true, pairGender: "female" },
];

/** 单玩法 legacy 牌堆：当前玩法自己的旧 `seed-*`（不掺 PN-* / custom / AI）。 */
function legacyDeckFor(gameType: (typeof V2_GAME_TYPES)[number]): GameCard[] {
  const mapping = V2_MAINLINE_PACK_BY_GAME_TYPE[gameType];
  return BUILTIN_SEED_CARDS.filter(
    (card) => card.packId === mapping.packId && card.type === mapping.cardType,
  );
}

const configFor = (packId: string): SessionConfig => ({
  players: players(),
  relationship: "friends",
  vibes: ["funny"],
  // 5：不让 intensity ceiling 成为过滤变量——20 轮可达性只由库存与规则决定。
  intensity: 5 as Intensity,
  boundaries: DEFAULT_BOUNDARIES,
  enabledPackIds: [packId],
  mode: "single",
});

/* ------------------------------------------------------------------ */
/* 驱动：真实生产链跑满 20 轮                                             */
/* ------------------------------------------------------------------ */

interface LegacyModeRun {
  gameType: (typeof V2_GAME_TYPES)[number];
  packId: string;
  deckSize: number;
  drawnCardIds: string[];
  /** 逐轮记录：本轮出卡后的编排态（用于证明「全程不出现真耗尽」）。 */
  perRoundExhaustionLevels: string[];
  session: GameSession;
}

function runLegacyMode(gameType: (typeof V2_GAME_TYPES)[number]): LegacyModeRun {
  const deck = legacyDeckFor(gameType);
  const mapping = V2_MAINLINE_PACK_BY_GAME_TYPE[gameType];
  let session = createSession(configFor(mapping.packId), [...deck], participants());

  const drawnCardIds: string[] = [];
  const perRoundExhaustionLevels: string[] = [];

  for (let round = 0; round < COMPLETED_ROUNDS; round += 1) {
    // 真实出题：唯一入口 startRound（内部 drawDeckCard → drawV2SessionCard → V2 Router）。
    session = startRound(session, () => 0, { drawSeed: FIXED_DRAW_SEED });
    const cardId = session.currentRound?.cardId;
    if (!cardId) {
      throw new Error(
        `${gameType} 第 ${round + 1} 轮未出卡（真耗尽）：` +
          `deckSize=${deck.length} level=${orchestrationOf(session).lastExhaustionLevel} ` +
          `awaiting=${orchestrationOf(session).awaitingHostDecision}`,
      );
    }
    drawnCardIds.push(cardId);
    perRoundExhaustionLevels.push(orchestrationOf(session).lastExhaustionLevel);

    // 真实轮终态：唯一业务入口 resolveRoundAndReduce（resolve + reduce 原子）。
    session = resolveRoundAndReduce(session, "complete");
  }

  return {
    gameType,
    packId: mapping.packId,
    deckSize: deck.length,
    drawnCardIds,
    perRoundExhaustionLevels,
    session,
  };
}

/* ------------------------------------------------------------------ */
/* 断言：五组不变量（逐玩法复用同一套口径）                                 */
/* ------------------------------------------------------------------ */

function expectLegacyTwentyRounds(run: LegacyModeRun): void {
  const { gameType, session, deckSize } = run;
  const relationship = relationshipOf(session);
  const orchestration = orchestrationOf(session);
  const label = `${gameType}(${run.packId})`;

  // 前置：牌堆确实够 20 轮（不足要如实红，不许改断言迁就）。
  expect(deckSize, `${label} legacy 库存`).toBeGreaterThanOrEqual(COMPLETED_ROUNDS + 1);

  /* 1｜连续完成 20 轮：rounds 全 completed、卡 id 不重复、sessionCompletedRounds 达 20。 */
  const completedRounds = session.rounds.filter((round) => round.status === "completed");
  expect(completedRounds, `${label} completed 轮数`).toHaveLength(COMPLETED_ROUNDS);
  expect(relationship.sessionCompletedRounds, `${label} sessionCompletedRounds`).toBe(
    COMPLETED_ROUNDS,
  );
  expect(new Set(run.drawnCardIds).size, `${label} 卡 id 唯一性`).toBe(COMPLETED_ROUNDS);

  /* 2｜全程不出现真耗尽（PACK_EXHAUSTED / GLOBAL / AWAITING 任一都不允许）。 */
  for (const level of run.perRoundExhaustionLevels) {
    expect(
      (HARD_EXHAUSTION_LEVELS as readonly string[]).includes(level),
      `${label} 逐轮编排态=${level}`,
    ).toBe(false);
  }
  expect(orchestration.awaitingHostDecision, `${label} 终态 awaiting`).toBe(false);
  expect(
    (HARD_EXHAUSTION_LEVELS as readonly string[]).includes(orchestration.lastExhaustionLevel),
    `${label} 终态 lastExhaustionLevel=${orchestration.lastExhaustionLevel}`,
  ).toBe(false);

  /* 3｜不产生关系推进：count=0 / evidence 空 / Heat=H1 / cooldowns 不变。 */
  expect(relationship.relationshipEffectiveCardCount, `${label} effective count`).toBe(0);
  expect(relationship.recognitionEvidence ?? [], `${label} recognitionEvidence`).toEqual([]);
  expect(relationship.heat, `${label} heat`).toBe("H1");
  expect(relationship.cooldowns, `${label} cooldowns`).toEqual({});
  expect(relationship.midMutualCheckAbandoned, `${label} abandoned（legacy 恒不到 14）`).toBeFalsy();

  /* 4｜不触发 Mutual / MATCH。 */
  const normalized = normalizeParticipants(session.participants, session.config.players);
  const midTrigger = mutualCheckTrigger({
    relationship,
    participants: normalized,
    sessionStatus: session.status,
  });
  const finalTrigger = mutualFinalCheckTrigger({
    relationship,
    participants: normalized,
    sessionStatus: session.status,
  });
  expect(midTrigger.due, `${label} mutualCheckTrigger due`).toBe(false);
  expect(finalTrigger.due, `${label} mutualFinalCheckTrigger due`).toBe(false);
  expect(Object.keys(relationship.matches), `${label} matches`).toEqual([]);
  expect(relationship.regularMutualCheckRuns, `${label} regularMutualCheckRuns`).toBe(0);

  /* 5｜整局轨一致性：全部卡仍是 legacy 轨（cardContentTrack === "seed"），未跨轨混入。 */
  const deckTrackSet = new Set<ContentTrack>(session.deckSnapshot.map((card) => cardContentTrack(card)));
  expect([...deckTrackSet], `${label} 牌堆轨集合`).toEqual(["seed"]);
  for (const round of session.rounds) {
    const card = session.deckSnapshot.find((item) => item.id === round.cardId);
    expect(card, `${label} 第 ${round.displayRoundNo} 轮卡必须在牌堆内`).toBeDefined();
    expect(cardContentTrack(card!), `${label} 轮 ${round.cardId} 轨`).toBe("seed");
  }
  // 跨轨闸（B3-5 口径）：seed-only 局只收 seed 候选，PN-* 快照卡 / custom / AI 一律拒入。
  const snapshotCandidate = mainlineSsotCardsByPack(run.packId)[0]!;
  expect(cardContentTrack(snapshotCandidate), `${label} PN-* 应为快照轨`).toBe("snapshot");
  expect(refillAllowsCard(session.deckSnapshot, snapshotCandidate), `${label} 拒 PN-*`).toBe(false);
  expect(refillAllowsCard(session.deckSnapshot, { id: "custom-x", source: "custom" })).toBe(false);
  expect(refillAllowsCard(session.deckSnapshot, { id: "ai-x", source: "ai" })).toBe(false);
  expect(
    refillAllowsCard(session.deckSnapshot, legacyDeckFor(gameType)[0]!),
    `${label} 收同轨 seed`,
  ).toBe(true);

  /* 附加｜metadata 未注入（sidecar 投影仍为双 null，legacy 判定未被绕过）。 */
  for (const cardId of run.drawnCardIds) {
    expect(metadataForCard(cardId), `${label} ${cardId} sidecar 投影`).toEqual({
      informationGain: null,
      topic: null,
    });
  }

  // 逐玩法真实输出（报告用，不参与断言）。
  console.log(
    `[B3-15] ${label} 完成轮数=${relationship.sessionCompletedRounds}/${COMPLETED_ROUNDS} ` +
      `牌堆=${deckSize} 出卡=${run.drawnCardIds.length} ` +
      `effective=${relationship.relationshipEffectiveCardCount} heat=${relationship.heat} ` +
      `evidence=${(relationship.recognitionEvidence ?? []).length} ` +
      `midDue=${midTrigger.due} finalDue=${finalTrigger.due} matches=${Object.keys(relationship.matches).length} ` +
      `awaiting=${orchestration.awaitingHostDecision} lastLevel=${orchestration.lastExhaustionLevel}`,
  );
}

/* ------------------------------------------------------------------ */
/* 用例：7 个玩法各一条（数据驱动）                                        */
/* ------------------------------------------------------------------ */

describe("B3-15｜七种单玩法 legacy 局 × 20 轮（QA-COV-01 覆盖）", () => {
  it("玩法枚举真源就是 7 个（V2_GAME_TYPES）", () => {
    expect([...V2_GAME_TYPES]).toEqual([
      "truth",
      "dare",
      "most_likely",
      "never_have_i",
      "either_or",
      "pointing",
      "chemistry",
    ]);
    expect(COMPLETED_ROUNDS).toBe(20);
  });

  describe.each([...V2_GAME_TYPES])("玩法 %s", (gameType) => {
    it(`${gameType}：legacy 局走满 20 轮、不耗尽、不推进关系、不弹 Mutual、整局同轨`, () => {
      expectLegacyTwentyRounds(runLegacyMode(gameType));
    });
  });
});
