import { expect, test } from "@playwright/test";
import { readSession, seedSession } from "./helpers";
import { mainlineSsotCardsByPack } from "@/lib/v2-content/v2-card-bridge";
import { BUILTIN_SEED_CARDS } from "@/lib/game-packs/built-in-seeds";
import type { GameCard, GameSession, Intensity } from "@/lib/domain/schemas";

/**
 * P1-3｜「混合旧缓存」恢复的受控迁移（Plan §13：离线恢复校验来源，混合旧缓存拒绝进入正式主线）。
 *
 * 落一局**混装**牌堆：固定库卡（PN-*）+ 旧 seed 卡 + AI 卡 + 自定义卡，且 `currentRound`
 * 正指向那张 AI 卡。要求：
 * - 打开不白屏、继续有题卡；
 * - AI 卡与快照外 seed 卡被剔除，固定库卡与自定义卡保留；
 * - 悬空的 `currentRound` 被同步迁移（落到净化后的牌堆上），绝不继续未知卡。
 */

const SESSION_ID = "e2e-mainline-mixed-cache";

function mixedSession(): GameSession {
  const now = new Date().toISOString();
  const players = ["Alex", "Emma", "Kai"].map((displayName, index) => ({ id: `p${index + 1}`, displayName, active: true, createdAt: now, lastUsedAt: now }));
  const fixed = mainlineSsotCardsByPack("truth-dare")[0]!;
  const seed = BUILTIN_SEED_CARDS.find((card) => card.packId === "truth-dare")!;
  const custom: GameCard = {
    id: "e2e-custom-truth", packId: "truth-dare", type: "truth", content: "自定义题：说出今晚最想夸的人",
    intensity: 1, tags: [], boundaryTags: [], minPlayers: 2, participantMode: "all", source: "custom",
  };
  const ai: GameCard = {
    id: "e2e-ai-truth", packId: "truth-dare", type: "truth", content: "AI 生成的题面",
    intensity: 1, tags: [], boundaryTags: [], minPlayers: 2, participantMode: "all", source: "ai",
  };
  return {
    schemaVersion: 2, id: SESSION_ID, status: "active", mode: "single",
    config: {
      players, relationship: "friends", vibes: ["funny"], intensity: 3 as Intensity,
      boundaries: { noPhysicalContact: false, noAlcoholPenalty: true, noExPartners: false, noSexualHistory: false, noMoneyIncome: false, noPhonePrivacy: false, noPublicPosting: false, noStrangerContact: true, noPhotoVideo: false, noSocialAccounts: false, customText: "" },
      enabledPackIds: ["truth-dare"], mode: "single",
    },
    deckSnapshot: [fixed, seed, ai, custom],
    usedCardIds: [], rounds: [],
    currentRound: { id: "e2e-round-1", cardId: ai.id, packId: "truth-dare", participantIds: ["p1"], startedAt: now, segmentId: "e2e-segment", logicalRoundId: "e2e-round-1", displayRoundNo: 1 },
    currentPackId: "truth-dare", currentSegmentId: "e2e-segment", currentPackState: {}, recentRejectedFingerprints: [],
    startedAt: now, updatedAt: now,
  };
}

test("混合旧缓存恢复：剔除 AI 与快照外卡、同步 currentRound、不白屏也不继续未知卡", async ({ page }) => {
  const session = mixedSession();
  const fixedId = session.deckSnapshot[0]!.id;
  const seedId = session.deckSnapshot[1]!.id;
  const aiId = session.deckSnapshot[2]!.id;
  const customId = session.deckSnapshot[3]!.id;

  await seedSession(page, session);
  await page.goto(`/game?session=${SESSION_ID}`);

  // 不白屏：正常出题卡（迁移后仍有 PN-* 与自定义卡可出）
  await expect(page.locator(".game-card")).toBeVisible();

  const restored = await readSession(page, SESSION_ID);
  const ids = restored.deckSnapshot.map((card) => card.id);
  expect(ids).toContain(fixedId);
  expect(ids).toContain(customId);
  expect(ids).not.toContain(aiId);
  expect(ids).not.toContain(seedId);
  expect(restored.deckSnapshot.filter((card) => card.source === "ai")).toHaveLength(0);
  // currentRound 已被同步迁移，不再指向被剔掉的 AI 卡
  if (restored.currentRound) {
    expect(restored.currentRound.cardId).not.toBe(aiId);
    expect(ids).toContain(restored.currentRound.cardId);
  }
});
