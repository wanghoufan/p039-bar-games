import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_BOUNDARIES } from "@/lib/domain/constants";
import type { CustomGamePack, GameCard, SessionConfig } from "@/lib/domain/schemas";
import { mainlineSsotCardsByPack } from "@/lib/v2-content/v2-card-bridge";
import { cardContentTrack, refillAllowsCard } from "@/lib/v2-content/fixed-content-manifest";
import { buildPlayableDeck, localSeedDeck, requestDeckWithFallbackResult } from "@/lib/ai/generate-deck";
import { AI_MAINLINE_DISABLED, reconcileMainlineSession } from "@/lib/ai/mainline-flag";
import { createSession, startRound, swapRound } from "@/lib/engine/session-engine";
import { mixedCandidatePackIds, switchPackAndDeal } from "@/lib/engine/pack-switcher";
import { awaitingHostDecision, reshuffleWouldRevealCard } from "@/lib/engine/v2-deal";
import { BUILTIN_SEED_CARDS } from "@/lib/game-packs/built-in-seeds";

/**
 * B3-16｜Plan A（Human 2026-09-28 已定）：自定义包退出 Mixed 正式组局，只保留独立 Custom self-mode。
 *
 * 三条内容轨必须独立（复用既有派生判定 `cardContentTrack` / `refillAllowsCard`，不新写第二套）：
 * - 正式 / Local / Fixed 路径：`customCards` 不得进入正式 snapshot pool；
 * - Custom self-mode：只出 custom 内容，不自动混入 PN-* / snapshot / AI；
 * - AI 关闭时：不发网络请求，回退不把 Custom 与 snapshot 混到一起；
 * - 历史混装 Session：兼容读取、不静默重写成 Formal，新建 Session 不再产生混装。
 */

const SELF_PACK = "custom-pack";

const players = ["a", "b", "c", "d"].map((id) => ({ id, displayName: id, active: true, createdAt: "x", lastUsedAt: "x" }));

const config = (overrides: Partial<SessionConfig> = {}): SessionConfig => ({
  players, relationship: "friends", vibes: ["funny"], intensity: 3,
  boundaries: DEFAULT_BOUNDARIES, enabledPackIds: ["truth-dare"], mode: "single", ...overrides,
});

const customCards = (packId: string, count: number): GameCard[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `${packId}-c${index + 1}`, packId, type: "custom", content: `自定义题 ${index + 1}`,
    intensity: 1, tags: [], boundaryTags: [], minPlayers: 2, participantMode: "all", source: "custom" as const,
  }));

const aiCardOn = (packId: string): GameCard => ({
  id: `${packId}-ai-1`, packId, type: "custom", content: "AI 生成的题",
  intensity: 1, tags: [], boundaryTags: [], minPlayers: 2, participantMode: "all", source: "ai",
});

const customPackFixture: CustomGamePack = {
  schemaVersion: 1,
  definition: { id: SELF_PACK, name: "自定义包", icon: "🎲", enabledByDefault: true, mixable: true, minPlayers: 2, supportedCardTypes: ["custom"], weight: 1, source: "custom" },
  cards: [], enabled: true, updatedAt: "x",
};

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("B3-16｜Custom self-mode：只含 custom（无 PN-* / snapshot / AI）", () => {
  it("buildPlayableDeck：启用集合只含自定义包 ⇒ 全为 custom 轨", () => {
    const deck = buildPlayableDeck({ cards: [] }, config({ enabledPackIds: [SELF_PACK] }), 20, customCards(SELF_PACK, 5));
    expect(deck.length).toBeGreaterThan(0);
    expect(deck.every((card) => card.source === "custom")).toBe(true);
    expect(deck.every((card) => cardContentTrack(card) === "custom")).toBe(true);
    expect(deck.some((card) => card.id.startsWith("PN-"))).toBe(false);
  });

  it("即便 AI 开关打开、且 AI 卡也声称属于该自定义包，也不得混入 custom 局", () => {
    vi.stubEnv("AI_MAINLINE_ENABLED", "true");
    const raw = { cards: [aiCardOn(SELF_PACK), aiCardOn(SELF_PACK)] };
    const deck = buildPlayableDeck(raw, config({ enabledPackIds: [SELF_PACK] }), 20, customCards(SELF_PACK, 5));
    expect(deck.every((card) => card.source === "custom")).toBe(true);
    expect(deck.some((card) => card.source === "ai")).toBe(false);
  });

  it("custom-only 局能正常开局、换题；deck 仍纯 custom", () => {
    const cards = customCards(SELF_PACK, 6);
    const deck = localSeedDeck(config({ enabledPackIds: [SELF_PACK] }), cards);
    expect(deck.every((card) => cardContentTrack(card) === "custom")).toBe(true);

    const session = createSession(config({ enabledPackIds: [SELF_PACK] }), deck);
    const dealt = startRound(session, () => 0);
    expect(dealt.currentRound).toBeDefined();
    expect(cards.some((card) => card.id === dealt.currentRound?.cardId)).toBe(true);

    const swapped = swapRound(dealt);
    expect(swapped.currentRound).toBeUndefined();
    expect(swapped.rounds.at(-1)?.status).toBe("swapped");

    const next = startRound(swapped, () => 0);
    expect(next.currentRound).toBeDefined();
  });

  it("切内置玩法有明确出口：不补 PN-*（不混轨），落到既有耗尽出口（可结束本局）", () => {
    const session = createSession(config({ enabledPackIds: [SELF_PACK] }), customCards(SELF_PACK, 6));
    const switched = switchPackAndDeal(session, "truth-dare", [], () => 0);
    expect(switched.currentPackId).toBe("truth-dare");
    expect(switched.deckSnapshot.some((card) => card.source === "builtin")).toBe(false);
    // 无卡可出 ⇒ 交 Host 决策；洗牌也救不回 ⇒ UI 只给「结束本局」（既有 AWAITING 出口，不是新的死循环）
    expect(awaitingHostDecision(switched)).toBeTruthy();
    expect(reshuffleWouldRevealCard(switched)).toBe(false);
  });
});

describe("B3-16｜普通本地组局不含 custom", () => {
  it("mixed 配置即便 caller 传了 customCards，正式 snapshot pool 也不混入 custom", () => {
    // 模拟历史/越界调用：启用集合同时含内置与自定义包 id
    const deck = buildPlayableDeck({ cards: [] }, config({ enabledPackIds: ["truth-dare", "never-have", SELF_PACK], mode: "mixed" }), 40, customCards(SELF_PACK, 5));
    expect(deck.length).toBeGreaterThan(0);
    expect(deck.some((card) => card.source === "custom")).toBe(false);
    expect(deck.every((card) => card.source === "builtin")).toBe(true);
    expect(deck.every((card) => cardContentTrack(card) === "snapshot")).toBe(true);
  });

  it("内置单玩配置（本地题库开局）同样不含 custom", () => {
    const deck = localSeedDeck(config({ enabledPackIds: ["truth-dare"] }), customCards(SELF_PACK, 5));
    expect(deck.some((card) => card.source === "custom")).toBe(false);
    expect(deck.every((card) => card.source === "builtin")).toBe(true);
  });
});

describe("B3-16｜AI-off fallback：不发网络请求、不混 custom", () => {
  it("AI_MAINLINE_ENABLED=false ⇒ 不发 fetch，回退牌堆不含 custom", async () => {
    vi.stubEnv("AI_MAINLINE_ENABLED", "false");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestDeckWithFallbackResult({
      profile: {} as never, apiKey: "sk-test",
      sessionConfig: config({ enabledPackIds: ["truth-dare", SELF_PACK], mode: "mixed" }),
      sessionId: "s1", customCards: customCards(SELF_PACK, 3),
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.fallbackCode).toBe(AI_MAINLINE_DISABLED);
    expect(result.cards.some((card) => card.source === "custom")).toBe(false);
    expect(result.cards.every((card) => card.source === "builtin")).toBe(true);
  });
});

describe("B3-16｜新建 Mixed 入口不得产生 custom + snapshot", () => {
  it("mixedCandidatePackIds 把自定义包排除在 AI 组局候选之外", () => {
    expect(mixedCandidatePackIds([customPackFixture], [])).not.toContain(SELF_PACK);
  });

  it("由 Mixed 候选生成的 config 开局，牌堆不含 custom（只 snapshot）", () => {
    const mixedPackIds = mixedCandidatePackIds([customPackFixture], []).filter((id) => id !== "ai-improv");
    const deck = localSeedDeck(config({ enabledPackIds: mixedPackIds, mode: "mixed" }), customCards(SELF_PACK, 5));
    expect(deck.some((card) => card.source === "custom")).toBe(false);
    const tracks = new Set(deck.map((card) => cardContentTrack(card)));
    expect(tracks.has("custom")).toBe(false);
    expect(tracks.has("snapshot")).toBe(true);
  });
});

describe("B3-16｜历史混装 Session 恢复不被破坏（兼容读取）", () => {
  const snapshotCard = mainlineSsotCardsByPack("truth-dare")[0]!;
  const customCard: GameCard = {
    id: "hist-custom-1", packId: "truth-dare", type: "truth", content: "历史自定义题",
    intensity: 1, tags: [], boundaryTags: [], minPlayers: 2, participantMode: "all", source: "custom",
  };
  const seedCard = BUILTIN_SEED_CARDS.find((card) => card.packId === "truth-dare")!;
  const aiCard: GameCard = {
    id: "hist-ai-1", packId: "truth-dare", type: "truth", content: "历史 AI 题",
    intensity: 1, tags: [], boundaryTags: [], minPlayers: 2, participantMode: "all", source: "ai",
  };

  it("既有 snapshot + custom 混装牌堆不被静默重写（同一引用、不落 Formal）", () => {
    vi.stubEnv("AI_MAINLINE_ENABLED", "false");
    const session = createSession(config(), [snapshotCard, customCard]);
    const report = reconcileMainlineSession(session);
    expect(report.migrated).toBe(false);
    expect(report.session).toBe(session);
    expect(report.session.deckSnapshot.map((card) => card.id)).toEqual([snapshotCard.id, customCard.id]);
    // 仍兼容读取（轨判定沿用既有真源）
    expect(cardContentTrack(customCard)).toBe("custom");
    expect(cardContentTrack(snapshotCard)).toBe("snapshot");
  });

  it("历史混合旧缓存：AI / 快照外卡被剔，snapshot 与 custom 保留（不破坏存档）", () => {
    vi.stubEnv("AI_MAINLINE_ENABLED", "false");
    const session = createSession(config(), [snapshotCard, customCard, seedCard, aiCard]);
    const report = reconcileMainlineSession(session);
    expect(report.migrated).toBe(true);
    expect(report.removedCardIds.sort()).toEqual([seedCard.id, aiCard.id].sort());
    expect(report.session.deckSnapshot.map((card) => card.id)).toEqual([snapshotCard.id, customCard.id]);
  });

  it("跨轨补卡闸（既有判定）对历史混装牌堆两轨仍可各自续补", () => {
    const mixedDeck = [customCard, snapshotCard];
    expect(refillAllowsCard(mixedDeck, snapshotCard)).toBe(true);
    expect(refillAllowsCard(mixedDeck, customCard)).toBe(true);
    // custom-only 牌堆不接收 snapshot（B3-14 收紧方向保持）
    expect(refillAllowsCard([customCard], snapshotCard)).toBe(false);
  });
});
