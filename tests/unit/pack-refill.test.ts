import { describe, expect, it, vi } from "vitest";
import { DEFAULT_BOUNDARIES } from "@/lib/domain/constants";
import type { GameCard, SessionConfig } from "@/lib/domain/schemas";
import {
  PACK_PLAYABLE_THRESHOLD, countPlayablePackCards, ensurePackPlayable, refillPackFromSeeds, refillPackInBackground,
} from "@/lib/ai/generate-deck";
import { BUILTIN_SEED_CARDS } from "@/lib/game-packs/built-in-seeds";
import { cardContentTrack } from "@/lib/v2-content/fixed-content-manifest";
import { mainlineSsotCardsByPack } from "@/lib/v2-content/v2-card-bridge";

const config = (overrides: Partial<SessionConfig> = {}): SessionConfig => ({
  players: ["a", "b", "c"].map((id) => ({ id, displayName: id, active: true, createdAt: "x", lastUsedAt: "x" })),
  relationship: "friends", vibes: ["funny"], intensity: 3, boundaries: DEFAULT_BOUNDARIES, mode: "mixed",
  enabledPackIds: ["truth-dare", "would-you-rather", "pointing-game", "compatibility-test"], ...overrides,
});

const aiCard = (id: string, packId: string, content: string, intensity: GameCard["intensity"] = 2): GameCard => ({
  id, packId, type: packId, content, intensity, tags: [], boundaryTags: [], minPlayers: 2, participantMode: "all", source: "ai",
});

const seedsOf = (packId: string) => BUILTIN_SEED_CARDS.filter((card) => card.packId === packId);

describe("pack-specific refill", () => {
  it("counts only un-played, allowed cards of the target pack", () => {
    const deck = [aiCard("w1", "would-you-rather", "A VS B"), aiCard("w2", "would-you-rather", "C VS D"), aiCard("p1", "pointing-game", "指一个人")];
    expect(countPlayablePackCards(deck, config(), "would-you-rather")).toBe(2);
    expect(countPlayablePackCards(deck, config(), "would-you-rather", ["w1", "w2"])).toBe(0);
  });

  it("keeps refill inside the target pack and never duplicates ids", () => {
    // B3-14：跨轨补卡闸收紧后，补位只能与牌堆同轨。本局以快照轨（PN-*）建堆，补位来源同属快照轨
    // （原 fixture 用一张 AI 卡当牌堆，等于让 AI 轨吃下快照卡，正是本次要堵的方向）。
    const base = mainlineSsotCardsByPack("would-you-rather")[0]!;
    const refilled = refillPackFromSeeds([base], config(), "compatibility-test");
    const added = refilled.filter((card) => card.id !== base.id);
    expect(added.length).toBeGreaterThan(0);
    expect(added.every((card) => card.packId === "compatibility-test")).toBe(true);
    expect(new Set(refilled.map((card) => card.id)).size).toBe(refilled.length);
  });

  it("tops a starved pack up from the frozen snapshot immediately, with no network", () => {
    // 玩法全开时，只要目标玩法在牌堆里一张可玩卡都没有（例如对手玩法占满了牌堆），就需要 pack-specific 补位。
    const allPacks = config({ enabledPackIds: ["truth-dare", "most-likely", "never-have", "ai-improv", "would-you-rather", "pointing-game", "compatibility-test", "spin-bottle"] });
    // Human Step 5 同轨闸：本局是**快照轨**（快照内旧题局），补位只补快照内卡。
    // ⚠️ 前提更新（C1-3 之后）：`truth-dare` 池里已追加第一包 Formal 卡（PN-TRUTH-201~224），
    // 整包建堆会被判定为「已有 Formal 卡 ⇒ Formal session」而拒收快照卡补位。本用例的前提是
    // 快照轨，故显式只取快照轨卡（`cardContentTrack === "snapshot"`），使牌堆轨与前提一致。
    const deck = mainlineSsotCardsByPack("truth-dare").filter((card) => cardContentTrack(card) === "snapshot");
    expect(deck.length).toBeGreaterThan(0);
    expect(deck.every((card) => cardContentTrack(card) === "snapshot")).toBe(true);
    const before = countPlayablePackCards(deck, allPacks, "compatibility-test");
    const { deck: refilled, added } = ensurePackPlayable(deck, allPacks, "compatibility-test");
    expect(before).toBeLessThan(PACK_PLAYABLE_THRESHOLD);
    expect(added).toBeGreaterThan(0);
    expect(countPlayablePackCards(refilled, allPacks, "compatibility-test")).toBeGreaterThanOrEqual(PACK_PLAYABLE_THRESHOLD);
  });

  it("leaves an already playable pack untouched", () => {
    const deck = seedsOf("would-you-rather");
    expect(ensurePackPlayable(deck, config(), "would-you-rather")).toEqual({ deck, added: 0 });
  });

  it("still respects boundaries when topping up from seeds", () => {
    const strict = config({ boundaries: { ...DEFAULT_BOUNDARIES, noMoneyIncome: true } });
    const refilled = refillPackFromSeeds([], strict, "compatibility-test");
    expect(refilled.length).toBeGreaterThan(0);
    expect(refilled.every((card) => !card.boundaryTags.includes("money"))).toBe(true);
  });
});

describe("background refill", () => {
  const request = vi.fn();

  it("merges only the target pack's provider cards", async () => {
    request.mockResolvedValueOnce([aiCard("new-w", "would-you-rather", "新题 A VS B"), aiCard("new-t", "truth-dare", "别家题")]);
    const deck = await refillPackInBackground({ deck: [aiCard("w1", "would-you-rather", "A VS B")], sessionConfig: config(), packId: "would-you-rather", profile: {} as never, apiKey: "sk-test", sessionId: "s1", request });
    expect(deck.map((card) => card.id)).toEqual(["w1", "new-w"]);
  });

  it("never throws when the provider fails and returns the deck unchanged", async () => {
    const original = [aiCard("w1", "would-you-rather", "A VS B")];
    request.mockRejectedValueOnce(new Error("NETWORK_ERROR"));
    await expect(refillPackInBackground({ deck: original, sessionConfig: config(), packId: "would-you-rather", profile: {} as never, apiKey: "sk-test", sessionId: "s1", request })).resolves.toEqual(original);
  });
});
