import { expect, test, type Page } from "@playwright/test";
import { currentSessionId, readSession, seedSession, startPackGame } from "./helpers";
import type { GameCard, GameSession, Intensity } from "@/lib/domain/schemas";

const switchEntry = (page: Page) => page.getByRole("button", { name: /切换玩法/ });

test("刷新后恢复切换过的当前玩法与同一张题卡", async ({ page }) => {
  await startPackGame(page, /我从来没有/);
  const id = currentSessionId(page);

  await switchEntry(page).click();
  await page.getByRole("dialog", { name: "切换玩法" }).getByRole("button", { name: /二选一/ }).click();
  await expect(switchEntry(page)).toContainText("二选一");
  const dealt = await page.locator(".would-you-rather").getAttribute("data-card-id");

  await page.reload();

  await expect(switchEntry(page)).toContainText("二选一");
  await expect(page.locator(".would-you-rather")).toHaveAttribute("data-card-id", dealt ?? "");
  const restored = await readSession(page, id);
  expect(restored.currentPackId).toBe("would-you-rather");
  expect(restored.currentRound?.packId).toBe("would-you-rather");
});

test("刷新后仍停在转瓶子（纯本地玩法没有题卡），不白屏", async ({ page }) => {
  await startPackGame(page, /我从来没有/);
  const id = currentSessionId(page);

  await switchEntry(page).click();
  await page.getByRole("dialog", { name: "切换玩法" }).getByRole("button", { name: /转瓶子/ }).click();
  await expect(page.locator(".spin-bottle")).toBeVisible();

  await page.reload();

  await expect(page.locator(".spin-bottle")).toBeVisible();
  await expect(page.getByRole("button", { name: "开始旋转" })).toBeVisible();
  await expect(page.getByRole("button", { name: /切换玩法/ })).toBeVisible();
  expect((await readSession(page, id)).currentPackId).toBe("spin-bottle");
});

/** 牌堆一张卡都没有的玩法：进 /game 经正常出卡链三层皆 0，判为 awaiting 无合法题，空状态而不是白屏。 */
function emptyDeckSession(): GameSession {
  const now = new Date().toISOString();
  const players = ["Alex", "Emma"].map((displayName, index) => ({ id: `p${index + 1}`, displayName, active: true, createdAt: now, lastUsedAt: now }));
  return {
    schemaVersion: 2, id: "e2e-empty-deck-session", status: "active", mode: "single",
    config: {
      players, relationship: "friends", vibes: ["funny"], intensity: 1,
      boundaries: { noPhysicalContact: true, noAlcoholPenalty: true, noExPartners: true, noSexualHistory: true, noMoneyIncome: true, noPhonePrivacy: true, noPublicPosting: true, noStrangerContact: true, noPhotoVideo: true, noSocialAccounts: true, customText: "" },
      enabledPackIds: ["never-have"], mode: "single",
    },
    deckSnapshot: [], usedCardIds: [], rounds: [],
    currentPackId: "never-have", currentSegmentId: "e2e-segment", currentPackState: {}, recentRejectedFingerprints: [],
    startedAt: now, updatedAt: now,
  };
}

test("刷新后仍停在没有可玩题卡的玩法上，不白屏也不自动切玩法", async ({ page }) => {
  await seedSession(page, emptyDeckSession());
  await page.goto("/game?session=e2e-empty-deck-session");

  // 牌堆真空（deckSnapshot=[]）经正常出卡链被判为 AWAITING_HOST_EXHAUSTION_DECISION（三层皆 0）；
  // Host 洗牌实测也救不回 → 渲染「可玩的题都出完了」＋中性说明，只给「结束本局」一条明确出路：
  // 不白屏、不自动切玩法、也不给空转的「洗牌再玩」（清 used 也补不出题卡）。
  await expect(page.locator("h1")).toHaveText("可玩的题都出完了");
  await expect(page.getByText("当前条件下没有可继续的合法题，本局到此为止。")).toBeVisible();
  await expect(page.getByRole("button", { name: "洗牌再玩" })).toHaveCount(0);
  // awaiting 态禁止切包：不渲染「切换玩法／查看总结／返回首页」，唯一出路是结束本局。
  await expect(page.getByRole("button", { name: "切换玩法" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "查看总结" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "返回首页" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "结束本局" })).toBeVisible();

  const persisted = await readSession(page, "e2e-empty-deck-session");
  expect(persisted.v2Orchestration?.awaitingHostDecision).toBe(true);
  expect(persisted.v2Orchestration?.lastExhaustionLevel).toBe("AWAITING_HOST_EXHAUSTION_DECISION");
  expect(persisted.currentPackId).toBe("never-have");

  await page.reload();

  // 刷新后不自动切玩法、不白屏：仍停在 awaiting 无合法题的同一出口，当前玩法不变。
  await expect(page.locator("h1")).toHaveText("可玩的题都出完了");
  await expect(page.getByText("当前条件下没有可继续的合法题，本局到此为止。")).toBeVisible();
  await expect(page.getByRole("button", { name: "结束本局" })).toBeVisible();
  expect((await readSession(page, "e2e-empty-deck-session")).currentPackId).toBe("never-have");
});

test("空牌堆耗尽态的出口有效：结束本局直接进结算，不再空转", async ({ page }) => {
  await seedSession(page, emptyDeckSession());
  await page.goto("/game?session=e2e-empty-deck-session");

  await expect(page.getByRole("button", { name: "结束本局" })).toBeVisible();
  await page.getByRole("button", { name: "结束本局" }).click();

  await expect(page).toHaveURL(/\/summary\?session=e2e-empty-deck-session/);
  expect((await readSession(page, "e2e-empty-deck-session")).status).toBe("finished");
});

/** 牌堆里还有没用过的卡（都已被出过 → 耗尽等待态）：洗牌能救回，仍应保留「洗牌再玩」。 */
function usedUpDeckSession(): GameSession {
  const now = new Date().toISOString();
  const players = ["Alex", "Emma"].map((displayName, index) => ({ id: `p${index + 1}`, displayName, active: true, createdAt: now, lastUsedAt: now }));
  const deckSnapshot: GameCard[] = [1, 2].map((n) => ({
    id: `nh-${n}`, packId: "never-have", type: "statement", content: `我从没做过第 ${n} 件事。`,
    instruction: "不愿意可无惩罚跳过", intensity: 1 as Intensity, tags: [], boundaryTags: [], minPlayers: 2, participantMode: "all", source: "builtin",
  }));
  return {
    schemaVersion: 2, id: "e2e-used-up-session", status: "active", mode: "single",
    config: {
      players, relationship: "friends", vibes: ["funny"], intensity: 5,
      boundaries: { noPhysicalContact: false, noAlcoholPenalty: true, noExPartners: false, noSexualHistory: false, noMoneyIncome: false, noPhonePrivacy: false, noPublicPosting: false, noStrangerContact: false, noPhotoVideo: false, noSocialAccounts: false, customText: "" },
      enabledPackIds: ["never-have"], mode: "single",
    },
    deckSnapshot, usedCardIds: deckSnapshot.map((card) => card.id), rounds: [],
    currentPackId: "never-have", currentSegmentId: "e2e-segment", currentPackState: {}, recentRejectedFingerprints: [],
    startedAt: now, updatedAt: now,
  };
}

test("牌堆还有没用过的卡时，洗牌仍能救回题卡（不给空转，但也不误杀洗牌）", async ({ page }) => {
  await seedSession(page, usedUpDeckSession());
  await page.goto("/game?session=e2e-used-up-session");

  await expect(page.locator("h1")).toHaveText("可玩的题都出完了");
  await expect(page.getByRole("button", { name: "洗牌再玩" })).toBeVisible();
  await page.getByRole("button", { name: "洗牌再玩" }).click();

  // 洗回一张卡：离开空牌堆页，回到正常主局。
  await expect(page.locator(".empty-deck")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /切换玩法/ })).toBeVisible();
});
