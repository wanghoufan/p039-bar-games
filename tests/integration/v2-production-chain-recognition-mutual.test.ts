/**
 * B3-7｜正向 production-chain integration test（§7.2「真实认识 → Mutual」）。
 *
 * 证明链（全部走生产代码，测试只提供两支**正式输入**）：
 *
 * ```
 * audited metadata fixture（既有 sidecar override 入口）
 *   + 显式 disclosure signal（正式 round result 通道）
 * → resolveRoundAndReduce（唯一轮终态业务入口）
 * → eventForRoundTerminal（唯一 R3 事件产出点，卡侧 metadata 由 metadataForCard 读 sidecar）
 * → reduceV2SessionEvents → reduceRelationshipEvent
 * → recognitionEvidence / relationshipEffectiveCardCount / Heat / cooldown
 * → mutualCheckTrigger().due
 * ```
 *
 * 纪律（Human 冻结 + 编排者红线）：
 * - **不**直接赋值 `relationshipState` / `recognitionEvidence` / `relationshipEffectiveCardCount` /
 *   `heat` / `midMutualCheckAbandoned`；这些值一律由上面的生产链派生后**读回**。
 * - **不**手拼 `RelationshipEvent`：本文件没有任何一个字面量事件对象，事件只来自
 *   `resolveRoundAndReduce`（轮终态）与 `mutualCheckFinalEvents`（Mutual 收束，页面同款）。
 * - metadata 只经 `v2-card-quality-index` 既有的 `setCardQualityIndexOverrides` 注入；
 *   `afterEach` 清 override + 懒缓存，防测试污染。
 * - 认识阈值数值不改（reducer/mutual 的常量是唯一真源）。
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
import { orchestrationOf, relationshipOf, withV2State } from "@/lib/engine/v2-deal";
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
  submitMutualChoice,
} from "@/lib/v2-relationship/v2-mutual-check";
import { normalizeParticipants } from "@/lib/v2-relationship/v2-participants";
import { recognitionEvidenceSummary } from "@/lib/v2-relationship/v2-reducer";
import { reduceV2SessionEvents, type V2SessionState } from "@/lib/v2-relationship/v2-session";
import {
  HEAT_THRESHOLDS,
  heatForEffectiveCount,
  type SessionParticipant,
} from "@/lib/v2-relationship/v2-state";

/* ------------------------------------------------------------------ */
/* 装置                                                                  */
/* ------------------------------------------------------------------ */

/** 7 类主线里选一包「全桌」卡：participantMode=all，不引入任何 pair/MATCH 前置，出题链最干净。 */
const PACK_ID = "never-have";

const players = (): Player[] =>
  ["a", "b", "c", "d"].map((id) => ({
    id,
    displayName: `玩家${id}`,
    active: true,
    createdAt: "x",
    lastUsedAt: "x",
  }));

/** 2 男 2 女：合法边 a::b / a::d / b::c / c::d，四人都属当前合法候选。 */
const participants = (): SessionParticipant[] => [
  { playerId: "a", active: true, pairGender: "male" },
  { playerId: "b", active: true, pairGender: "female" },
  { playerId: "c", active: true, pairGender: "male" },
  { playerId: "d", active: true, pairGender: "female" },
];

const config = (): SessionConfig => ({
  players: players(),
  relationship: "friends",
  vibes: ["funny"],
  // 5：不让 intensity ceiling 成为出题过滤变量（本单考的是 metadata/认识链）。
  intensity: 5,
  boundaries: DEFAULT_BOUNDARIES,
  enabledPackIds: [PACK_ID],
  mode: "single",
});

/**
 * 18 张**真实 SSOT 主线卡**（PN-NHIE-*，冻结真源里的题面），全部 intensity ≤ 4：
 * - 取全桌卡 → 不受 pair / MATCH gating 影响；
 * - 无 5 档卡 → MATCH 后 D7 五档保障恒走 pause 分支，不产生 extra 硬过滤。
 */
const DECK_SIZE = 18;
const DECK: readonly GameCard[] = mainlineSsotCardsByPack(PACK_ID)
  .filter((card) => card.intensity <= 4)
  .sort((first, second) => (first.id < second.id ? -1 : first.id > second.id ? 1 : 0))
  .slice(0, DECK_SIZE);

if (DECK.length !== DECK_SIZE) {
  throw new Error(`B3-7 fixture 需要 ${DECK_SIZE} 张 ${PACK_ID} 全桌卡，实际 ${DECK.length}`);
}

const PERSON_TOPICS = ["择偶偏好", "恋爱观", "相处规则"] as const;

/**
 * audited metadata fixture 的分槽口径（按 deck 位置，与出卡顺序无关）：
 * - 人物维度 6/6/6 → 任意 14 张都有 ≥3 个维度（缺的只可能 ≤4 张，吃不满一个 6 张的维度）；
 * - high 6 张 → 任意 14 张必有 ≥1 个 high；
 * - 其余 medium → 中及以上恒 = 14 ≥ 5。
 */
const gainAt = (slot: number): V2RoundMetadataFields["informationGain"] =>
  slot % 3 === 0 ? "high" : "medium";
const topicAt = (slot: number): string => PERSON_TOPICS[slot % 3]!;

const AUDITED_DECK_METADATA: ReadonlyMap<string, V2RoundMetadataFields> = new Map(
  DECK.map((card, slot) => [
    card.id,
    { informationGain: gainAt(slot), topic: topicAt(slot) } satisfies V2RoundMetadataFields,
  ]),
);

/** 反例用：把整副牌都写成同一份（非法）metadata，抽到哪张都命中该变体。 */
const overrideWholeDeck = (fields: V2RoundMetadataFields): void =>
  setCardQualityIndexOverrides(new Map(DECK.map((card) => [card.id, fields])));

/** 注入 audited fixture（生产侧不调用；只在测试里显式开）。 */
const injectAuditedMetadata = (): void => {
  setCardQualityIndexOverrides(AUDITED_DECK_METADATA);
};

afterEach(() => {
  // 清理 override（传空 Map 即还原纯 SSOT 投影）＋清懒缓存，杜绝跨文件污染。
  setCardQualityIndexOverrides(new Map());
  resetCardQualityIndexCache();
});

const FIXED_DRAW_SEED = 20260928;

const newSession = (deck: readonly GameCard[] = DECK): GameSession =>
  createSession(config(), [...deck], participants());

/** 真实出题一轮（唯一出卡入口 startRound → drawV2SessionCard → Router）。 */
function drawCard(session: GameSession): GameSession {
  const next = startRound(session, () => 0, { drawSeed: FIXED_DRAW_SEED });
  expect(next.currentRound, "每轮都必须真实出题（不得进入耗尽/等待态）").toBeDefined();
  return next;
}

/** 正式轮终态通道：completed + 显式揭晓信号（走 roundHistory.result，不手拼事件）。 */
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

/** 连走 n 个真实「出题 → completed+揭晓」轮；披露者按 a/b 交替（两名合法候选各有本人披露）。 */
function driveEffectiveRounds(session: GameSession, rounds: number, startIndex: number): GameSession {
  let current = session;
  for (let index = 0; index < rounds; index += 1) {
    current = completeRoundWith(drawCard(current), (startIndex + index) % 2 === 0 ? ["a"] : ["b"]);
  }
  return current;
}

const relationshipOfSession = relationshipOf;

const triggerOf = (session: GameSession) =>
  mutualCheckTrigger({
    relationship: relationshipOfSession(session),
    participants: normalizeParticipants(session.participants, session.config.players),
    sessionStatus: session.status,
  });

const heatBandOf = (count: number) => {
  const band = HEAT_THRESHOLDS.find((item) => count >= item.min && count <= item.max);
  if (!band) throw new Error(`无 Heat 档覆盖 count=${count}`);
  return band.heat;
};

const MATCH_TS = "2026-09-28T00:00:00.000Z";

/**
 * Mutual 收束走**页面同款**生产路径（`app/game/page.tsx` finishMutualCheck）：
 * run → 双方互选 → finalize（只出公开结果）→ mutualCheckFinalEvents → reduceV2SessionEvents → withV2State。
 */
function finalizeMutual(
  session: GameSession,
  checkpoint: number,
  first: string,
  second: string,
): GameSession {
  const normalized = normalizeParticipants(session.participants, session.config.players);
  const run = beginMutualCheckRun(normalized);
  submitMutualChoice(run, first, second);
  submitMutualChoice(run, second, first);
  const result = finalizeMutualCheckRun(run, relationshipOf(session));
  expect(result.matches.map((match) => match.pairKey)).toEqual([
    [first, second].sort().join("::"),
  ]);

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
/* 1｜有效信息轮：真实出题 + 合格 metadata + 正式揭晓信号 → 三推进          */
/* 5｜窗口外不弹（count < 12）                                            */
/* ------------------------------------------------------------------ */

describe("B3-7｜正向 production-chain：认识证据 → effective count → Mutual", () => {
  it("① 有效信息轮计入：completed + sidecar metadata + selfDisclosed → count+1、evidence+1、Heat 按 HEAT_THRESHOLDS 推进", () => {
    injectAuditedMetadata();
    // 先真实走 3 个有效轮（count=3，落在 H1 档），再单独观察第 4 轮跨到 H2。
    let session = driveEffectiveRounds(newSession(), 3, 0);
    const before = relationshipOfSession(session);
    expect(before.relationshipEffectiveCardCount).toBe(3);
    expect(before.recognitionEvidence).toHaveLength(3);
    expect(before.heat).toBe(heatBandOf(3));
    expect(before.heat).toBe(heatForEffectiveCount(3));
    expect(HEAT_THRESHOLDS.find((band) => band.heat === "H1")).toMatchObject({ min: 0, max: 3 });

    // 第 4 轮：真实出题（记录被抽中的卡）→ completed + 本人揭晓（正式信号通道）。
    const dealt = drawCard(session);
    const drawnCardId = dealt.currentRound!.cardId;
    expect(DECK.some((card) => card.id === drawnCardId), "抽到的必须是本局 SSOT 真源卡").toBe(true);
    const expectedMetadata = metadataForCard(drawnCardId);
    expect(expectedMetadata.informationGain, "sidecar 必须已为这张卡补标").not.toBeNull();
    expect(expectedMetadata.topic).not.toBeNull();

    session = completeRoundWith(dealt, ["a"]);
    const after = relationshipOfSession(session);

    expect(after.relationshipEffectiveCardCount).toBe(before.relationshipEffectiveCardCount + 1);
    expect(after.recognitionEvidence).toHaveLength(before.recognitionEvidence!.length + 1);
    expect(after.recognitionEvidence!.at(-1)).toEqual({
      cardId: drawnCardId,
      informationGain: expectedMetadata.informationGain,
      topic: expectedMetadata.topic,
      disclosedPlayerIds: ["a"],
    });
    // Heat 是 count 的纯派生，跨 3→4 正好从 H1 推进到 H2。
    expect(heatBandOf(after.relationshipEffectiveCardCount)).toBe("H2");
    expect(after.heat).toBe(heatForEffectiveCount(after.relationshipEffectiveCardCount));
    expect(after.heat).toBe("H2");

    // 继续走到 11（仍在窗口下界之外）：认识证据齐备也不弹。
    session = driveEffectiveRounds(session, 7, 4);
    expect(relationshipOfSession(session).relationshipEffectiveCardCount).toBe(11);
    expect(triggerOf(session)).toMatchObject({
      due: false,
      checkpoint: null,
      reason: "not-at-checkpoint",
    });
  });

  /* ---------------------------------------------------------------- */
  /* 2｜无效轮 fail-closed：count / evidence / Heat 三冻结（≥3 条反例）    */
  /* ---------------------------------------------------------------- */

  it("② 无效轮不计入（fail-closed 反例）：metadata 缺失/zero/low、topic 缺失、未本人揭晓、swap/skip 一律冻结", () => {
    injectAuditedMetadata();
    const singleCardDeck = [DECK[0]!];

    /** 单轮驱动：新鲜局（单卡牌堆、必抽该卡）→ 指定终态/信号 → 读回。 */
    const driveOnce = (
      action: "complete" | "swap" | "skip",
      signal: ReturnType<typeof roundDisclosureSignal>,
    ) => {
      const dealt = drawCard(newSession(singleCardDeck));
      expect(dealt.currentRound!.cardId).toBe(DECK[0]!.id);
      return resolveRoundAndReduce(dealt, action, signal);
    };

    const disclosure = (disclosedPlayerIds: readonly string[]) =>
      roundDisclosureSignal({ selfDisclosed: true, disclosedPlayerIds: [...disclosedPlayerIds] });
    const noSelfDisclosure = roundDisclosureSignal({ selfDisclosed: false, disclosedPlayerIds: ["a"] });

    const cases: { name: string; run: () => GameSession }[] = [
      {
        name: "informationGain 缺失（未补标）",
        run: () => {
          overrideWholeDeck({ informationGain: null, topic: "恋爱观" });
          return driveOnce("complete", disclosure(["a"]));
        },
      },
      {
        name: "informationGain=zero",
        run: () => {
          overrideWholeDeck({ informationGain: "zero", topic: "恋爱观" });
          return driveOnce("complete", disclosure(["a"]));
        },
      },
      {
        name: "informationGain=low",
        run: () => {
          overrideWholeDeck({ informationGain: "low", topic: "恋爱观" });
          return driveOnce("complete", disclosure(["a"]));
        },
      },
      {
        name: "topic 缺失（未补标）",
        run: () => {
          overrideWholeDeck({ informationGain: "medium", topic: null });
          return driveOnce("complete", disclosure(["a"]));
        },
      },
      {
        name: "selfDisclosed!==true（纯猜测未揭晓）",
        run: () => {
          injectAuditedMetadata(); // 卡侧合格，唯一失败项是轮侧信号
          return driveOnce("complete", noSelfDisclosure);
        },
      },
      {
        name: "非 completed：swap",
        run: () => {
          injectAuditedMetadata();
          return driveOnce("swap", disclosure(["a"]));
        },
      },
      {
        name: "非 completed：skip",
        run: () => {
          injectAuditedMetadata();
          return driveOnce("skip", disclosure(["a"]));
        },
      },
    ];

    for (const { name, run } of cases) {
      const state = relationshipOfSession(run());
      expect(state.relationshipEffectiveCardCount, name).toBe(0);
      expect(state.recognitionEvidence ?? [], name).toEqual([]);
      expect(state.heat, name).toBe("H1");
      expect(state.heat, name).toBe(heatForEffectiveCount(0));
      expect(heatBandOf(0), name).toBe("H1");
      expect(state.regularMutualCheckRuns, name).toBe(0);
    }
  });

  /* ---------------------------------------------------------------- */
  /* 3｜cooldown 同源 + 4｜Mutual 触发 + 5｜窗口外不弹（count > 14）        */
  /* ---------------------------------------------------------------- */

  it("③④⑤ cooldown 同源 / Mutual 触发 / 窗口外不弹：非 effective 轮不递减、effective 轮 −1、MATCH 后 run 上限生效", () => {
    injectAuditedMetadata();
    // 14 个有效轮 → count=14（窗口上界）：任意 14 张都满足四阈值（fixture 分槽见文件头）。
    let session = driveEffectiveRounds(newSession(), 14, 0);
    const atWindow = relationshipOfSession(session);
    expect(atWindow.relationshipEffectiveCardCount).toBe(14);
    expect(atWindow.heat).toBe(heatForEffectiveCount(14));
    expect(atWindow.heat).toBe("H4");

    const summary = recognitionEvidenceSummary(atWindow);
    expect(summary.mediumPlusRounds).toBeGreaterThanOrEqual(5);
    expect(summary.highRounds).toBeGreaterThanOrEqual(1);
    expect(summary.topics.length).toBeGreaterThanOrEqual(3);
    // 「至少两名**当前合法候选**各有本人披露」用生产同源的候选投影核对，不手写候选名单。
    const legalCandidates = mutualCandidateIds(
      normalizeParticipants(session.participants, session.config.players),
    );
    expect(summary.disclosedCandidates.filter((id) => legalCandidates.includes(id))).toEqual(["a", "b"]);

    // ④ 窗口内 + 四阈值全满足 → due。
    expect(triggerOf(session)).toMatchObject({
      due: true,
      checkpoint: 14,
      pairMode: "ACTIVE",
      reason: "ok",
    });

    // Mutual 收束（页面同款生产路径）→ 建 MATCH 并按 MINIMUM_EFFECTIVE_CARDS_BETWEEN_RUNS 设 cooldown。
    session = finalizeMutual(session, 14, "a", "b");
    const matched = relationshipOfSession(session);
    expect(matched.matches["a::b"]).toBeDefined();
    expect(matched.regularMutualCheckRuns).toBe(1);
    expect(matched.cooldowns["a::b"]).toBe(5); // 现有契约：MATCH 即设 5 轮间隔

    // ④ 其它 gate 按现有契约：一局中途最多一次 → 同一个检查点 14 上 run 上限使其不再 due；
    //    失败原因必须给「硬门未过」，不得误报成认识阈值不够。
    expect(triggerOf(session)).toMatchObject({
      due: false,
      checkpoint: 14,
      reason: "gates-not-passed",
    });

    // ③ 非 effective 轮（swap / skip）：count / evidence / Heat / cooldown 全部冻结。
    const swapDrawn = drawCard(session);
    const afterSwap = resolveRoundAndReduce(
      swapDrawn,
      "swap",
      roundDisclosureSignal({ selfDisclosed: true, disclosedPlayerIds: ["a"] }),
    );
    const swapped = relationshipOfSession(afterSwap);
    expect(swapped.relationshipEffectiveCardCount).toBe(14);
    expect(swapped.recognitionEvidence!.length).toBe(14);
    expect(swapped.heat).toBe("H4");
    expect(swapped.cooldowns["a::b"]).toBe(5);

    const skipDrawn = drawCard(afterSwap);
    const afterSkip = resolveRoundAndReduce(
      skipDrawn,
      "skip",
      roundDisclosureSignal({ selfDisclosed: false, disclosedPlayerIds: [] }),
    );
    const skipped = relationshipOfSession(afterSkip);
    expect(skipped.relationshipEffectiveCardCount).toBe(14);
    expect(skipped.recognitionEvidence!.length).toBe(14);
    expect(skipped.heat).toBe("H4");
    expect(skipped.cooldowns["a::b"]).toBe(5);

    // ③ effective 轮：按既有规则 cooldown −1（下限 0）。
    const effectiveDrawn = drawCard(afterSkip);
    const afterEffective = completeRoundWith(effectiveDrawn, ["b"]);
    const advanced = relationshipOfSession(afterEffective);
    expect(advanced.relationshipEffectiveCardCount).toBe(15);
    expect(advanced.recognitionEvidence!.length).toBe(15);
    expect(advanced.heat).toBe("H4");
    expect(advanced.cooldowns["a::b"]).toBe(4);

    // ⑤ 窗口上界之外（count=15）→ checkpoint=null / not-at-checkpoint，不补问。
    expect(triggerOf(afterEffective)).toMatchObject({
      due: false,
      checkpoint: null,
      reason: "not-at-checkpoint",
    });

    // 真门已过、且中途互选已问过一次 → 不得被误标「本局永久跳过」。
    expect(relationshipOfSession(afterEffective).midMutualCheckAbandoned).toBeFalsy();
  });

  /* ---------------------------------------------------------------- */
  /* 6｜afterEach 清理自证（本文件最后一个用例，刻意不再注入）                */
  /* ---------------------------------------------------------------- */

  it("⑥ sidecar override 已由 afterEach 清理：复算回到纯 SSOT 投影（未补标 = 双 null）", () => {
    // 本用例**不**注入 override：上一条用例注入过、其 afterEach 已清 override + 懒缓存。
    // 若清理失效，这里会读到残留的「已补标」值，本断言即红。
    for (const card of [DECK[0]!, DECK[DECK.length - 1]!]) {
      expect(metadataForCard(card.id), `${card.id} 清理后应回到未补标`).toEqual({
        informationGain: null,
        topic: null,
      });
    }
    // 同一入口可再次生效（证明上面那次注入确实是显式可控，而不是靠残留）。
    injectAuditedMetadata();
    expect(metadataForCard(DECK[0]!.id)).toEqual(AUDITED_DECK_METADATA.get(DECK[0]!.id));
  });
});
