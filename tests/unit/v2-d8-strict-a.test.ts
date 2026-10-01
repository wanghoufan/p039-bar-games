import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DEFAULT_BOUNDARIES } from "@/lib/domain/constants";
import type { GameCard, Player, SessionConfig } from "@/lib/domain/schemas";
import { completeRound, createSession, startRound, switchPack } from "@/lib/engine/session-engine";
import { switchPackAndDeal } from "@/lib/engine/pack-switcher";
import { awaitingHostDecision, reshuffleWouldRevealCard } from "@/lib/engine/v2-deal";

/**
 * D8 严格方案 A（P1-D8-AWAITING-EXIT）：
 * AWAITING_HOST_EXHAUSTION_DECISION 期间 Host 只保留冻结的「结束本局 / 洗牌再玩」——
 * 禁止抽卡、禁止切换玩法（含 cardless/neutral 玩法），且不得偷偷加入第三种 Host 状态迁移。
 */

const players = (count = 3): Player[] =>
  ["a", "b", "c"].slice(0, count).map((id) => ({ id, displayName: `玩家${id}`, active: true, createdAt: "x", lastUsedAt: "x" }));

const config = (overrides: Partial<SessionConfig> = {}): SessionConfig => ({
  players: players(), relationship: "friends", vibes: ["funny"], intensity: 3,
  boundaries: DEFAULT_BOUNDARIES, enabledPackIds: ["truth-dare"], mode: "single", ...overrides,
});

const localCards: GameCard[] = [1, 2].map((n) => ({
  id: `local-${n}`, packId: "truth-dare", type: "truth", content: `本地题 ${n}`,
  intensity: 1, tags: [], boundaryTags: [], minPlayers: 2, participantMode: "all", source: "builtin",
}));

/** 把两张牌打空后再抽一次 → AWAITING_HOST_EXHAUSTION_DECISION。 */
function exhaustedFrom(deck: GameCard[], configuration = config()): ReturnType<typeof createSession> {
  const created = deck.length ? createSession(configuration, deck) : { ...createSession(configuration, []), status: "active" as const };
  let session = startRound(created, () => 0);
  if (session.currentRound) session = completeRound(session);
  session = startRound(session, () => 0);
  if (session.currentRound) session = completeRound(session);
  return startRound(session, () => 0);
}

describe("D8 严格 A · awaiting 下抽卡被拦", () => {
  it("awaiting 时 startRound 原样返回，不产生新轮次、状态机仍停在 awaiting", () => {
    const awaiting = exhaustedFrom(localCards);
    expect(awaitingHostDecision(awaiting)).toBeDefined();
    expect(startRound(awaiting, () => 0)).toBe(awaiting);
  });

  it("即使当前玩法是 cardless（转瓶子），startRound 也不得越过 awaiting 分支", () => {
    const awaiting = { ...exhaustedFrom(localCards), currentPackId: "spin-bottle" };
    expect(awaitingHostDecision(awaiting)).toBeDefined();
    expect(startRound(awaiting, () => 0)).toBe(awaiting);
  });

  it("源码顺序：startRound 的 awaiting 守卫先于 cardless 早返（否则 cardless 会绕过 awaiting）", () => {
    const source = readFileSync(join(process.cwd(), "lib/engine/session-engine.ts"), "utf8");
    const awaitingGuard = source.indexOf("if (awaitingHostDecision(session)) return session;");
    const cardlessEarlyReturn = source.indexOf("if (packIsCardless(session.currentPackId)) return session;");
    expect(awaitingGuard).toBeGreaterThan(-1);
    expect(cardlessEarlyReturn).toBeGreaterThan(-1);
    expect(awaitingGuard).toBeLessThan(cardlessEarlyReturn);
  });
});

describe("D8 严格 A · awaiting 下切包被拦", () => {
  it("switchPack 在 awaiting 下原样返回：普通玩法与 cardless 玩法都切不动", () => {
    const awaiting = exhaustedFrom(localCards);
    expect(switchPack(awaiting, "most-likely")).toBe(awaiting);
    expect(switchPack(awaiting, "spin-bottle")).toBe(awaiting);
  });

  it("switchPackAndDeal 同样被阻断（经 switchPack 传递，不另写第二份判定）", () => {
    const awaiting = exhaustedFrom(localCards);
    expect(switchPackAndDeal(awaiting, "most-likely", [], () => 0)).toBe(awaiting);
    expect(switchPackAndDeal(awaiting, "spin-bottle", [], () => 0)).toBe(awaiting);
    // 状态机口径不变：仍是 awaiting，没有被切包悄悄清掉
    expect(awaitingHostDecision(awaiting)?.kind).toBe("AWAITING_HOST_EXHAUSTION_DECISION");
  });
});

describe("D8 严格 A · 洗牌有效性前置判定", () => {
  it("牌堆还有没用过的卡：洗牌能救回题卡（有效）", () => {
    const awaiting = exhaustedFrom(localCards);
    expect(reshuffleWouldRevealCard(awaiting)).toBe(true);
  });

  it("牌堆为空：洗牌救不回任何卡（无效应只给结束本局）", () => {
    const awaiting = exhaustedFrom([]);
    expect(awaitingHostDecision(awaiting)).toBeDefined();
    expect(reshuffleWouldRevealCard(awaiting)).toBe(false);
  });

  it("人数不足导致本玩法零硬合法卡：洗牌同样救不回", () => {
    const twoPlayers = config({ players: players(2), enabledPackIds: ["pointing-game"] });
    const deck: GameCard[] = [1, 2, 3].map((n) => ({
      ...localCards[0]!, id: `pg-${n}`, packId: "pointing-game", type: "pointing", minPlayers: 3,
    }));
    const awaiting = startRound(createSession(twoPlayers, deck), () => 0);
    expect(awaitingHostDecision(awaiting)).toBeDefined();
    expect(reshuffleWouldRevealCard(awaiting)).toBe(false);
  });
});
