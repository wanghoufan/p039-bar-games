import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_BOUNDARIES } from "@/lib/domain/constants";
import { gameSessionSchema, type GameCard, type GameSession, type SessionConfig } from "@/lib/domain/schemas";
import { mainlineSsotCards, mainlineSsotCardsByPack } from "@/lib/v2-content/v2-card-bridge";
import { countCardsOutsideManifest } from "@/lib/v2-content/fixed-content-manifest";
import {
  filterMainlineCards,
  isolateLegacyAiDeck,
  mainlineAllowsCard,
  reconcileMainlineSession,
} from "@/lib/ai/mainline-flag";
import { buildPlayableDeck, refillPackFromSeeds } from "@/lib/ai/generate-deck";
import { createSession, startRound } from "@/lib/engine/session-engine";
import { BUILTIN_SEED_CARDS } from "@/lib/game-packs/built-in-seeds";

/**
 * P1-3｜正式主线准入门 + 旧缓存受控迁移。
 *
 * 锁死的边界：
 * ① AI 关闭时，`custom` / 旧 `seed-*` / 未知 builtin 不得仅凭「不是 AI」进正式主线（custom 另按第二条路放行）；
 * ② 恢复路径是**受控迁移**：AI 卡必剔；混合旧缓存的快照外卡必剔；`currentRound` 指向被剔卡时同步迁移；
 * ③ 纯旧局不做破坏性清空（既有 history-only 兼容），但要留痕且永不回流新牌堆；
 * ④ 新牌堆（快照创建 / 每轮补位）只收当前冻结固定库卡。
 *
 * 注：`tests/setup.ts` 默认把 `AI_MAINLINE_ENABLED` 置 true（覆盖保留的 AI 代码路径），
 * 本文件显式关闭，走正式主线验收口径。
 */

beforeEach(() => vi.stubEnv("AI_MAINLINE_ENABLED", "false"));
afterEach(() => vi.unstubAllEnvs());

const config = (overrides: Partial<SessionConfig> = {}): SessionConfig => ({
  players: ["a", "b", "c", "d"].map((id) => ({ id, displayName: id, active: true, createdAt: "x", lastUsedAt: "x" })),
  relationship: "friends",
  vibes: ["funny"],
  intensity: 5,
  boundaries: DEFAULT_BOUNDARIES,
  enabledPackIds: ["truth-dare"],
  mode: "single",
  ...overrides,
});

const fixedCard = mainlineSsotCardsByPack("truth-dare")[0]!;
const seedCard = BUILTIN_SEED_CARDS.find((card) => card.packId === "truth-dare")!;

const customCard: GameCard = {
  id: "custom-truth-1", packId: "truth-dare", type: "truth", content: "自定义题：说出今晚最开心的一刻",
  intensity: 1, tags: [], boundaryTags: [], minPlayers: 2, participantMode: "all", source: "custom",
};
const aiCard: GameCard = {
  id: "ai-truth-1", packId: "truth-dare", type: "truth", content: "AI 生成题",
  intensity: 1, tags: [], boundaryTags: [], minPlayers: 2, participantMode: "all", source: "ai",
};

/** 造一个「牌堆 + currentRound 指向某张卡」的进行中 Session。 */
function sessionWith(deck: GameCard[], roundCardId?: string): GameSession {
  const session = createSession(config(), deck);
  if (!roundCardId) return session;
  return {
    ...session,
    currentRound: {
      id: "round-1", cardId: roundCardId, packId: "truth-dare", participantIds: ["a", "b"],
      startedAt: "x", segmentId: session.currentSegmentId, logicalRoundId: "round-1", displayRoundNo: 1,
    },
  };
}

describe("准入门是正向允许清单（AI 关闭时）", () => {
  it("fixed / custom 放行；ai / 快照外 builtin 拒绝", () => {
    expect(mainlineAllowsCard(fixedCard)).toBe(true);
    expect(mainlineAllowsCard(customCard)).toBe(true);
    expect(mainlineAllowsCard(aiCard)).toBe(false);
    expect(mainlineAllowsCard(seedCard)).toBe(false);
    expect(mainlineAllowsCard({ ...fixedCard, id: "unknown-builtin-9" })).toBe(false);
  });

  it("filterMainlineCards 只在混装列表里剔掉 ai 与快照外卡，保留 fixed + custom", () => {
    const kept = filterMainlineCards([fixedCard, customCard, seedCard, aiCard]).map((card) => card.id);
    expect(kept).toEqual([fixedCard.id, customCard.id]);
  });

  it("AI 启用时按原样放行（只隔离、不删代码）；关闭时才收紧", () => {
    vi.stubEnv("AI_MAINLINE_ENABLED", "true");
    expect(mainlineAllowsCard(aiCard)).toBe(true);
    expect(mainlineAllowsCard(seedCard)).toBe(true);
  });
});

describe("恢复路径：混合旧缓存的受控迁移", () => {
  it("currentRound 指向 AI 卡 → AI 卡与快照外卡一并剔除，currentRound 同步迁移，不白屏", () => {
    const session = sessionWith([fixedCard, customCard, seedCard, aiCard], aiCard.id);
    const report = reconcileMainlineSession(session);

    expect(report.migrated).toBe(true);
    expect(report.removedCardIds.sort()).toEqual([aiCard.id, seedCard.id].sort());
    expect(report.grandfatheredAlienIds).toEqual([]);
    expect(report.droppedCurrentRoundCardId).toBe(aiCard.id);

    const next = report.session;
    expect(next.deckSnapshot.map((card) => card.id)).toEqual([fixedCard.id, customCard.id]);
    expect(next.currentRound).toBeUndefined();
    expect(next.deckSnapshot.filter((card) => card.source === "ai")).toHaveLength(0);
    // 迁移结果仍是合法的进行中 Session（页面走既有出卡链，不会白屏）
    expect(gameSessionSchema.safeParse(next).success).toBe(true);

    // 下一轮从「已净化」的牌堆里出卡，绝不继续未知卡
    const dealt = startRound(next, () => 0);
    if (dealt.currentRound) {
      expect([fixedCard.id, customCard.id]).toContain(dealt.currentRound.cardId);
    }
    expect(dealt.deckSnapshot.filter((card) => card.source === "ai")).toHaveLength(0);
  });

  it("currentRound 指向存活卡 → 迁移后该轮原样保留（只剔被剔的，不动别人）", () => {
    const session = sessionWith([fixedCard, seedCard, aiCard], fixedCard.id);
    const report = reconcileMainlineSession(session);
    expect(report.migrated).toBe(true);
    expect(report.session.currentRound?.cardId).toBe(fixedCard.id);
    expect(report.droppedCurrentRoundCardId).toBeUndefined();
    expect(report.session.deckSnapshot.map((card) => card.id)).toEqual([fixedCard.id]);
  });

  it("纯 AI 牌堆 → 全剔为空，不写中性卡顶替（交给既有空牌堆出口）", () => {
    const session = sessionWith([aiCard], aiCard.id);
    const report = reconcileMainlineSession(session);
    expect(report.removedCardIds).toEqual([aiCard.id]);
    expect(report.session.deckSnapshot).toHaveLength(0);
    expect(report.session.currentRound).toBeUndefined();
    expect(gameSessionSchema.safeParse(report.session).success).toBe(true);
  });

  it("纯旧局（整副牌堆都是旧 seed）→ 不破坏性清空，但留痕且不外流", () => {
    const legacyOnly = sessionWith([seedCard, BUILTIN_SEED_CARDS.filter((card) => card.packId === "never-have")[0]!]);
    const report = reconcileMainlineSession(legacyOnly);
    expect(report.migrated).toBe(false);
    expect(report.session).toBe(legacyOnly); // 原样返回同一引用
    expect(report.grandfatheredAlienIds).toHaveLength(2);
    expect(report.session.deckSnapshot).toHaveLength(2);
  });

  it("无 AI、无快照外卡 → 原样返回同一引用（调用方按引用判「是否发生隔离」）", () => {
    const clean = sessionWith([fixedCard, customCard], fixedCard.id);
    expect(isolateLegacyAiDeck(clean)).toBe(clean);
  });
});

describe("新牌堆（快照创建 / 每轮补位）只收当前冻结固定库卡", () => {
  it("buildPlayableDeck 产出的固定库卡快照外 ID 数 = 0", () => {
    const deck = buildPlayableDeck({ cards: [] }, config({ enabledPackIds: ["truth-dare", "never-have", "pointing-game"] }), 20);
    expect(deck.length).toBeGreaterThan(0);
    expect(countCardsOutsideManifest(deck)).toBe(0);
    expect(deck.every((card) => card.source !== "ai")).toBe(true);
  });

  it("refillPackFromSeeds 只在同轨内补位：快照轨补快照卡，纯旧 seed 轨不注入 PN-*", () => {
    // 快照轨（本局是快照内旧题）⇒ 补位仍是快照内旧题，快照外 ID 数保持 0。
    const fromSnapshot = refillPackFromSeeds([fixedCard], config(), "truth-dare");
    const added = fromSnapshot.filter((card) => card.id !== fixedCard.id);
    expect(added.length).toBeGreaterThan(0);
    expect(countCardsOutsideManifest(added)).toBe(0);
    expect(new Set(added.map((card) => card.id)).size).toBe(added.length);
    // Human Step 5｜跨轨补卡闸：纯旧 seed 局始终 legacy-only，不得被偷偷补进快照内 PN-*。
    const seeded = refillPackFromSeeds([seedCard], config(), "truth-dare");
    expect(seeded.map((card) => card.id)).toEqual([seedCard.id]);
  });

  it("自定义卡只在 Custom self-mode 进新牌堆；内置玩法局不被 custom 混入（Plan A）", () => {
    // Custom self-mode：本局只请求自定义玩法（enabledPackIds 全是自定义包）⇒ 只出 custom 卡。
    const selfModeCard = { ...customCard, packId: "custom-pack" };
    const customDeck = buildPlayableDeck({ cards: [] }, config({ enabledPackIds: ["custom-pack"] }), 20, [selfModeCard]);
    expect(customDeck.some((card) => card.id === selfModeCard.id && card.source === "custom")).toBe(true);
    expect(customDeck.some((card) => card.source === "builtin")).toBe(false);
    // 内置玩法局：即便 caller 传了带自己 packId 的 customCards，也不得混进正式 snapshot 池。
    const builtinDeck = buildPlayableDeck({ cards: [] }, config({ enabledPackIds: ["truth-dare"] }), 20, [selfModeCard]);
    expect(builtinDeck.some((card) => card.source === "custom")).toBe(false);
    expect(builtinDeck.every((card) => card.source === "builtin")).toBe(true);
  });
});

describe("manifest 与固定库的覆盖面（防漂移）", () => {
  it("冻结 SSOT 的每一张都在 manifest 允许清单内", () => {
    expect(countCardsOutsideManifest(mainlineSsotCards())).toBe(0);
  });
});
