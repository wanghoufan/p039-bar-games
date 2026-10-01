import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_BOUNDARIES } from "@/lib/domain/constants";
import type { GameCard, SessionConfig } from "@/lib/domain/schemas";
import { mainlineSsotCards, mainlineSsotCardsByPack } from "@/lib/v2-content/v2-card-bridge";
import {
  cardContentTrack,
  cardsOutsideManifest,
  countCardsOutsideFormalTrack,
  countCardsOutsideManifest,
  isFixedMainlineCard,
  refillAllowsCard,
  type FixedContentManifest,
} from "@/lib/v2-content/fixed-content-manifest";
import { ensurePackPlayable, refillPackFromSeeds, refillPackInBackground } from "@/lib/ai/generate-deck";
import { createSession } from "@/lib/engine/session-engine";
import { switchPackAndDeal } from "@/lib/engine/pack-switcher";
import { BUILTIN_SEED_CARDS } from "@/lib/game-packs/built-in-seeds";

/**
 * B3-5｜跨轨补卡闸（Human Step 5 冻结）：
 * 三条内容轨必须独立——正式 Fixed session 只能含 formal manifest ID；Legacy-only 始终 legacy-only，
 * 旧 seed session 不得因 `ensurePackPlayable` / `switchPack` / `spin-chain refill` / 后台补题偷偷补进 PN-*。
 *
 * 本文件用的都是**真实 manifest**（A3 后 `formalFixedIdSet().size === 5` = KEEP 5），因此：
 * - 快照轨补位 = 补 PN-*（放行）；
 * - 纯旧 seed 轨补位 = 一张都不补（拦住）；
 * - 「正式轨」分支用构造的 fixture manifest 覆盖（不依赖生产快照里 Formal 的具体张数）。
 *
 * B3-14（收尾）在此之上再收紧 custom/AI ↔ snapshot 方向：custom-only / AI-only 牌堆
 * 不再接收快照内旧题（见文件末尾「B3-14」describe）。
 */

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

const snapshotCards = mainlineSsotCardsByPack("truth-dare");
const snapshotCard = snapshotCards[0]!;
const legacySnapshotCard = snapshotCards[1]!;
const seedDeck = BUILTIN_SEED_CARDS.filter((card) => card.packId === "truth-dare");
const seedCard = seedDeck[0]!;

const customCard: GameCard = {
  id: "custom-truth-x", packId: "truth-dare", type: "truth", content: "自定义题：今晚最想记住谁",
  intensity: 1, tags: [], boundaryTags: [], minPlayers: 2, participantMode: "all", source: "custom",
};
const aiCard: GameCard = {
  id: "ai-truth-x", packId: "truth-dare", type: "truth", content: "AI 生成题",
  intensity: 1, tags: [], boundaryTags: [], minPlayers: 2, participantMode: "all", source: "ai",
};
const outsideBuiltin: GameCard = { ...seedCard, id: "unknown-builtin-9", content: "未知来源 builtin 卡" };

/**
 * fixture manifest：`formalCard` 是 Formal Fixed 轨，`legacyCard` 在快照内但未审（Legacy Compatibility）。
 * 用来覆盖生产快照当前为空的那条分支。
 */
function formalManifest(formalCard: GameCard, legacyCard: GameCard): FixedContentManifest {
  const hash = "0".repeat(64);
  return {
    snapshotVersion: "test-snapshot@formal",
    tracks: {
      legacyCompatibility: {
        track: "legacyCompatibility", isFormalFixedContent: false, purpose: "test legacy",
        admission: "legacy-compatibility", snapshotHash: hash,
        allowedCardIds: [formalCard.id, legacyCard.id],
        provenance: {
          [formalCard.id]: {
            cardId: formalCard.id, cardSet: "mainline", reviewed: true, machineVerdict: "PASS",
            humanBarFit: "PASS", metadataStatus: "audited", payloadHash: hash,
          },
          [legacyCard.id]: {
            cardId: legacyCard.id, cardSet: "mainline", reviewed: false, machineVerdict: "PASS",
            humanBarFit: "UNREVIEWED", metadataStatus: "legacy", payloadHash: hash,
          },
        },
        counts: { total: 2, mainline: 2, expansion: 0, legacyMetadata: 1, auditedMetadata: 1 },
      },
      formalFixed: {
        track: "formalFixed", isFormalFixedContent: true, purpose: "test formal", admission: "strict",
        requirements: ["test"], snapshotHash: hash, allowedCardIds: [formalCard.id],
        counts: { total: 1, mainline: 1, expansion: 0, legacyMetadata: 0, auditedMetadata: 1 },
        rejectedFromFormal: { total: 1, missingStrictMetadata: 1, humanBarFitNotPass: 0, notHumanReviewed: 0, provenanceIncomplete: 0 },
      },
    },
    buildInfo: {
      generatedBy: "test", source: "test", batchId: "test", contentVersion: "test",
      legacyReviewStage: "test", barFitSource: "test",
      humanReviewSource: "test", humanReviewedAt: "test", reviewerKind: "ai-role", formalAdmission: "test",
      ssotMainlineSha256: hash, ssotExpansionSha256: hash, ssotSchemaVersion: "test",
    },
  };
}

describe("B3-5｜卡级轨派生（同一份 manifest 真源，不新写判定）", () => {
  it("formal / snapshot / seed / custom / ai 各归各位；快照内未审 ≠ Formal", () => {
    const manifest = formalManifest(snapshotCard, legacySnapshotCard);
    expect(cardContentTrack(snapshotCard, manifest)).toBe("formal");
    expect(cardContentTrack(legacySnapshotCard, manifest)).toBe("snapshot");
    expect(cardContentTrack(seedCard, manifest)).toBe("seed");
    expect(cardContentTrack(customCard, manifest)).toBe("custom");
    expect(cardContentTrack(aiCard, manifest)).toBe("ai");
    // 生产快照当前 0 张 Formal：全部 PN-* 都是 snapshot 轨（在快照内，但不是 Formal）。
    expect(cardContentTrack(snapshotCard)).toBe("snapshot");
  });
});

describe("B3-5｜Human Step 5：seed-only + refill → 仍纯 legacy（不出现 PN-*）", () => {
  it("纯旧 seed 局补位一张都不补，牌堆仍是纯 legacy", () => {
    const refilled = refillPackFromSeeds(seedDeck, config(), "truth-dare");
    expect(refilled.map((card) => card.id)).toEqual(seedDeck.map((card) => card.id));
    expect(refilled.some((card) => isFixedMainlineCard(card))).toBe(false);
    expect(refilled.every((card) => cardContentTrack(card) === "seed")).toBe(true);
  });

  it("seed-only 局已见底时 ensurePackPlayable 也补不进来（added=0，不偷偷跨轨）", () => {
    const used = seedDeck.map((card) => card.id);
    const { deck, added } = ensurePackPlayable(seedDeck, config(), "truth-dare", used);
    expect(added).toBe(0);
    expect(deck.some((card) => isFixedMainlineCard(card))).toBe(false);
  });

  it("后台补题同样过闸：seed-only 局不会被 Provider 补进 PN-*", async () => {
    const request = vi.fn().mockResolvedValue([snapshotCard, legacySnapshotCard]);
    const deck = seedDeck.slice(0, 2);
    const merged = await refillPackInBackground({
      deck, profile: {} as never, apiKey: "sk-test", sessionConfig: config(), sessionId: "s1", packId: "truth-dare", request,
    });
    expect(merged.map((card) => card.id)).toEqual(deck.map((card) => card.id));
  });
});

describe("B3-5｜Human Step 5：seed-only + switch pack → 不混 fixed", () => {
  it("纯旧 seed 局切玩法不会补进目标玩法的 PN-*", () => {
    const session = createSession(config({ enabledPackIds: ["truth-dare", "would-you-rather"] }), seedDeck);
    const next = switchPackAndDeal(session, "would-you-rather", [], () => 0);
    expect(next.currentPackId).toBe("would-you-rather");
    expect(next.deckSnapshot).toHaveLength(seedDeck.length);
    expect(next.deckSnapshot.some((card) => card.packId === "would-you-rather")).toBe(false);
    expect(next.deckSnapshot.some((card) => isFixedMainlineCard(card))).toBe(false);
  });
});

describe("B3-5｜Human Step 5：formal fixed + custom → 拒绝（正式轨只收 Formal）", () => {
  it("正式轨 + custom 的牌堆拒绝补入 legacy/seed/custom/AI/快照外", () => {
    const manifest = formalManifest(snapshotCard, legacySnapshotCard);
    const formalDeck = [snapshotCard, customCard];
    expect(refillAllowsCard(formalDeck, legacySnapshotCard, manifest)).toBe(false);
    expect(refillAllowsCard(formalDeck, seedCard, manifest)).toBe(false);
    expect(refillAllowsCard(formalDeck, customCard, manifest)).toBe(false);
    expect(refillAllowsCard(formalDeck, aiCard, manifest)).toBe(false);
    expect(refillAllowsCard(formalDeck, outsideBuiltin, manifest)).toBe(false);
    // 同一张 Formal 卡仍可入正式轨。
    expect(refillAllowsCard(formalDeck, snapshotCard, manifest)).toBe(true);
    const { added } = ensurePackPlayable(formalDeck, config(), "truth-dare", [], 3, manifest);
    expect(added).toBe(0);
  });

  it("反过来：legacy 轨不得注入 Formal 卡", () => {
    const manifest = formalManifest(snapshotCard, legacySnapshotCard);
    expect(refillAllowsCard([legacySnapshotCard], snapshotCard, manifest)).toBe(false);
    expect(refillAllowsCard([legacySnapshotCard], legacySnapshotCard, manifest)).toBe(true);
  });
});

describe("B3-5｜Human Step 5：formal 轨中 AI / custom / alien / legacy 全部计入违规", () => {
  it("快照外统计扩到 custom / ai / 快照外 builtin（不能只数 alien builtin）", () => {
    const manifest = formalManifest(snapshotCard, legacySnapshotCard);
    expect(cardsOutsideManifest([aiCard, customCard, seedCard, outsideBuiltin], manifest).sort())
      .toEqual([aiCard.id, customCard.id, seedCard.id, outsideBuiltin.id].sort());
    expect(countCardsOutsideManifest([aiCard, customCard, seedCard, outsideBuiltin], manifest)).toBe(4);
    // 既有两个调用方口径不变：冻结 SSOT 自身 0，旧 seed-* 库整库计入。
    expect(countCardsOutsideManifest(mainlineSsotCards())).toBe(0);
    expect(countCardsOutsideManifest(BUILTIN_SEED_CARDS)).toBe(BUILTIN_SEED_CARDS.length);
    expect(countCardsOutsideManifest([snapshotCard, legacySnapshotCard], manifest)).toBe(0);
  });

  it("正式轨越轨计数把「快照内但未审的 legacy」也算违规（不止快照外）", () => {
    const manifest = formalManifest(snapshotCard, legacySnapshotCard);
    expect(countCardsOutsideFormalTrack([snapshotCard], manifest)).toBe(0);
    expect(countCardsOutsideFormalTrack([snapshotCard, legacySnapshotCard, seedCard, customCard, aiCard, outsideBuiltin], manifest)).toBe(5);
  });
});

describe("B3-5｜同轨不变量不得破坏既有行为", () => {
  it("空牌堆（转瓶子建局）仍按默认快照轨补 PN-*，链不会断游", () => {
    const { deck, added } = ensurePackPlayable([], config(), "truth-dare");
    expect(added).toBeGreaterThan(0);
    expect(deck.every((card) => isFixedMainlineCard(card))).toBe(true);
  });

  it("快照轨补位仍补 PN-*（同轨闸没把快照轨打死）", () => {
    const { added } = ensurePackPlayable([snapshotCard], config(), "truth-dare");
    expect(added).toBeGreaterThan(0);
    expect(refillAllowsCard([aiCard], aiCard)).toBe(true);
  });

  it("AI_MAINLINE_ENABLED 关闭时 refillPackInBackground 仍早返原 deck、不发请求", async () => {
    vi.stubEnv("AI_MAINLINE_ENABLED", "false");
    const request = vi.fn();
    const deck = [seedCard, customCard];
    const out = await refillPackInBackground({
      deck, profile: {} as never, apiKey: "sk-test", sessionConfig: config(), sessionId: "s1", packId: "truth-dare", request,
    });
    expect(out).toBe(deck);
    expect(request).not.toHaveBeenCalled();
  });
});

/**
 * B3-14（Human Step 5 收尾）：上一版 ④ 的 `|| candidateTrack === "snapshot"`
 * 让「快照内旧题」对**任何**牌堆都是默认补位，于是 custom-only / AI-only 的牌堆
 * 也会被塞进 PN-*——这正是 Human「Custom 不能与正式 snapshot 混装」禁止的方向。
 * 现在只堵 custom/AI ↔ snapshot 两向，其余既有补位行为（③ seed-only、空牌堆、快照轨、
 * 混装牌堆两轨续补）一律不动。
 */
describe("B3-14｜Human Step 5：custom / AI 轨不与 snapshot 混装", () => {
  it("custom-only 牌堆：拒收 snapshot / seed / AI / 快照外，只收同轨 custom", () => {
    expect(refillAllowsCard([customCard], snapshotCard)).toBe(false);
    expect(refillAllowsCard([customCard], legacySnapshotCard)).toBe(false);
    expect(refillAllowsCard([customCard], seedCard)).toBe(false);
    expect(refillAllowsCard([customCard], aiCard)).toBe(false);
    expect(refillAllowsCard([customCard], outsideBuiltin)).toBe(false);
    expect(refillAllowsCard([customCard], customCard)).toBe(true);
  });

  it("AI-only 牌堆：拒收 snapshot 卡，只收同轨 AI 卡", () => {
    expect(refillAllowsCard([aiCard], snapshotCard)).toBe(false);
    expect(refillAllowsCard([aiCard], seedCard)).toBe(false);
    expect(refillAllowsCard([aiCard], customCard)).toBe(false);
    expect(refillAllowsCard([aiCard], aiCard)).toBe(true);
  });

  it("经真实补位入口生效：custom-only 局补位一张 PN-* 都不进来", () => {
    const refilled = refillPackFromSeeds([customCard], config(), "truth-dare");
    expect(refilled.map((card) => card.id)).toEqual([customCard.id]);
    expect(refilled.some((card) => isFixedMainlineCard(card))).toBe(false);
  });

  it("既有「第二条路」不破：custom + snapshot 混装牌堆两轨都仍可续补", () => {
    const mixed = [customCard, snapshotCard];
    expect(refillAllowsCard(mixed, snapshotCard)).toBe(true);
    expect(refillAllowsCard(mixed, customCard)).toBe(true);
  });
});
