import { expect, test, type Page } from "@playwright/test";
import { readSession, seedSession } from "./helpers";
import { BUILTIN_SEED_CARDS } from "@/lib/game-packs/built-in-seeds";
import { isFormalFixedCard } from "@/lib/v2-content/fixed-content-manifest";
import type { GameSession, Intensity } from "@/lib/domain/schemas";

/**
 * V2 中途互选｜**负向** E2E：legacy / metadata 不足轨，走满 20 轮也不弹 Mutual、不产生 MATCH。
 *
 * 这是 Human 冻结的负向语义（唯一产品依据）：
 * - `temp/B2.2批次提示词-V1.1.md` Step 2 A：
 *   `legacy / metadata 不足 → 20 轮正常完成 → 不弹中途互选 → 不产生 MATCH`；
 *   同节末段：**禁止测试直接向 state 手工塞 `recognitionEvidence` 来绕过生产链**。
 * - `temp/B3-1-轨识别设计.md` §4 不变量②（legacy 计数全冻结：effective 恒 0 / evidence 恒空 / Heat 恒 H1）
 *   与不变量③（legacy 不弹 Mutual、不产 MATCH，UI 不出现 `MutualCheckSheet`）。
 *
 * 本用例只做两件事：**驱动真实 UI**（`.round-action--complete` 点击）完成 20 轮，
 * 然后 `readSession` 读回**真实落盘**。全程不写 `relationshipState` / `recognitionEvidence` /
 * `relationshipEffectiveCardCount` / `heat` / `midMutualCheckAbandoned`，所有断言以磁盘读回为准。
 *
 * 刻意**不**断言 `midMutualCheckAbandoned === true`：legacy 局 effective count 恒 0，永远到不了窗口上界 14，
 * 那条断言会把「到 14 才判放弃」的错误语义锁死（Human/编排者已冻结禁止）。
 *
 * 正向覆盖的边界（不得伪称已有正向 UI 覆盖）：
 * - 正向 **production-chain**（完整 audited metadata fixture → 出题/完成链 → recognitionEvidence →
 *   12–14 且四阈值满足 → 弹一次 Mutual → 双选成 MATCH）在 **unit/integration 层**覆盖（下一单）；
 * - UI 正向 Playwright E2E 仍属 `DEFERRED_BY_HUMAN`（Human 已冻结本批不做），见文件末尾显式 skip 的用例。
 */

const SESSION_ID = "e2e-v2-mutual-flow-negative";

/**
 * Human Step 2 A 冻结的负向语义：legacy 轨（`seed-*`）无 audited metadata，
 * `isEffectiveInformationRound` 四项 fail-closed ⇒ 有效信息轮恒 0 ⇒ completed 上限就是基础 20 轮
 * （`BASE_SESSION_COMPLETED_ROUND_LIMIT`）。
 */
const LEGACY_COMPLETED_ROUNDS = 20;

/**
 * 单玩法 legacy 局牌堆：`truth-dare` 的 `seed-*` 前 40 张（与生产牌堆同规模）。
 * 必须 **> 20**：20 轮之后还要留得出第 21 张，否则第 20 轮完成那一刻就会落到 PACK_EXHAUSTED 空牌堆页。
 */
const LEGACY_DECK_SIZE = 40;

/** 2男2女：存在合法异性 pair，因此「不弹 Mutual」不是因为没候选，而是因为 legacy 轨恒 0 有效轮。 */
function legacySession(): GameSession {
  const now = new Date().toISOString();
  const names = ["Alex", "Emma", "Kai", "Mia"];
  const players = names.map((displayName, index) => ({ id: `p${index + 1}`, displayName, active: true, createdAt: now, lastUsedAt: now }));
  const deck = BUILTIN_SEED_CARDS.filter((card) => card.packId === "truth-dare").slice(0, LEGACY_DECK_SIZE);
  if (deck.length < LEGACY_COMPLETED_ROUNDS + 1) throw new Error(`truth-dare legacy seed only ${deck.length}`);
  return {
    schemaVersion: 2, id: SESSION_ID, status: "active", mode: "single",
    config: {
      // intensity 5：牌堆内每张都 ≤5 档可用。刻意拉满尺度，让「抽不到卡」不可能成为不弹 Mutual 的原因。
      players, relationship: "friends", vibes: ["funny"], intensity: 5 as Intensity,
      boundaries: { noPhysicalContact: false, noAlcoholPenalty: true, noExPartners: false, noSexualHistory: false, noMoneyIncome: false, noPhonePrivacy: true, noPublicPosting: true, noStrangerContact: true, noPhotoVideo: false, noSocialAccounts: false, customText: "" },
      enabledPackIds: ["truth-dare"], mode: "single",
    },
    deckSnapshot: deck, usedCardIds: [], rounds: [],
    currentPackId: "truth-dare", currentSegmentId: "e2e-mutual-negative", currentPackState: {},
    recentRejectedFingerprints: [],
    participants: [
      { playerId: "p1", active: true, pairGender: "male" },
      { playerId: "p2", active: true, pairGender: "female" },
      { playerId: "p3", active: true, pairGender: "male" },
      { playerId: "p4", active: true, pairGender: "female" },
    ],
    startedAt: now, updatedAt: now,
  } as GameSession;
}

const completeBtn = (page: Page) => page.locator(".round-action--complete");
/** 任何「空牌堆 / 耗尽」页都带 `.empty-deck`（PACK_EXHAUSTED / GLOBAL_EXHAUSTED / 无题卡 / 错误页）。 */
const emptyDeck = (page: Page) => page.locator(".empty-deck");
/** `MutualCheckSheet` 的唯一 portal 根：三个屏（SELECT / 交接遮罩 / 结果）都在它里面。 */
const mutualSheet = (page: Page) => page.locator(".mutual-backdrop");

/** 失败时能一眼看出「是没落盘还是走了耗尽」，而不是只报按钮不可见。 */
const sessionSnapshot = (session: GameSession): string => {
  const completed = session.rounds.filter((round) => round.status === "completed").length;
  const relationship = session.relationshipState;
  return [
    `status=${session.status}`,
    `rounds(completed)=${completed}`,
    `currentRound=${session.currentRound?.cardId ?? "none"}`,
    `sessionCompletedRounds=${relationship?.sessionCompletedRounds ?? "n/a"}`,
    `effective=${relationship?.relationshipEffectiveCardCount ?? "n/a"}`,
    `lastExhaustionLevel=${session.v2Orchestration?.lastExhaustionLevel ?? "n/a"}`,
    `awaiting=${session.v2Orchestration?.awaitingHostDecision ?? "n/a"}`,
  ].join(" ");
};

test("V2负向：legacy 局走满 20 轮、计数全冻结、不弹中途互选、不产生 MATCH", async ({ page }) => {
  await seedSession(page, legacySession());
  await page.goto(`/game?session=${SESSION_ID}`);

  // 前置：本局真的是 legacy 轨（旧 seed-* 卡，全部不在冻结 manifest 的 Formal 集内）。
  // 没有这条，下面的「计数恒 0」可能只是抽到了别的轨的卡。
  const seeded = await readSession(page, SESSION_ID);
  expect(seeded.deckSnapshot).toHaveLength(LEGACY_DECK_SIZE);
  expect(seeded.deckSnapshot.every((card) => card.source === "builtin" && card.id.startsWith("seed-"))).toBe(true);
  expect(seeded.deckSnapshot.every((card) => !isFormalFixedCard(card))).toBe(true);

  // 20 轮普通回合：每轮点「完成」→ 等 `sessionCompletedRounds` 真实落盘到本轮序号。
  // 每轮同时锁三件事：本轮落盘、没有空牌堆页、UI 从未出现 MutualCheckSheet。
  for (let round = 1; round <= LEGACY_COMPLETED_ROUNDS; round += 1) {
    try {
      await expect(completeBtn(page)).toBeVisible({ timeout: 15000 });
    } catch {
      throw new Error(`第 ${round} 轮主按钮不可见（可能已落到空牌堆页）：${sessionSnapshot(await readSession(page, SESSION_ID))}`);
    }
    // 卡面切换动画里按钮会短暂重挂载：detached 就重试本轮（成功点击后即返回，不会重复提交）。
    await expect(async () => {
      await completeBtn(page).click({ timeout: 5000 });
    }).toPass({ timeout: 20000 });

    const relationshipAt = async () => (await readSession(page, SESSION_ID)).relationshipState?.sessionCompletedRounds ?? 0;
    try {
      await expect.poll(relationshipAt, { timeout: 15000 }).toBe(round);
    } catch {
      throw new Error(`第 ${round} 轮未按 sessionCompletedRounds 落盘：${sessionSnapshot(await readSession(page, SESSION_ID))}`);
    }
    // Human Step 2 A：全程不弹中途互选（三个互选屏都在 .mutual-backdrop 里）。
    await expect(mutualSheet(page)).toHaveCount(0);
    // 全程不得出现 PACK_EXHAUSTED / 空牌堆页。
    await expect(emptyDeck(page)).toHaveCount(0);
  }

  // 第 21 张卡仍出得来（真·还有牌），并证明这一局没有被耗尽页接管。
  try {
    await expect(page.getByText(/第 21 \/ 40 轮/)).toBeVisible({ timeout: 15000 });
  } catch {
    throw new Error(`第 21 轮未出题（20 轮后是否耗尽？）：${sessionSnapshot(await readSession(page, SESSION_ID))}`);
  }

  const stored = await readSession(page, SESSION_ID);
  const relationship = stored.relationshipState;

  // ① 20 轮普通回合正常完成，且每轮都是 completed（没有 skip / swap 顶替）。
  expect(stored.rounds).toHaveLength(LEGACY_COMPLETED_ROUNDS);
  expect(stored.rounds.every((round) => round.status === "completed")).toBe(true);
  expect(stored.rounds.every((round) => round.packId === "truth-dare")).toBe(true);
  expect(new Set(stored.rounds.map((round) => round.cardId)).size).toBe(LEGACY_COMPLETED_ROUNDS);
  expect(stored.usedCardIds).toHaveLength(LEGACY_COMPLETED_ROUNDS + 1); // 20 轮已完成 + 第 21 轮已出牌

  // ② sessionCompletedRounds 正常增加（reducer 基础上限 20，未被耗尽/异常打断）。
  expect(relationship?.sessionCompletedRounds).toBe(LEGACY_COMPLETED_ROUNDS);

  // ③ legacy 计数全冻结：有效信息轮恒 0、无认识证据、Heat 停在 H1。
  expect(relationship?.relationshipEffectiveCardCount).toBe(0);
  expect(relationship?.recognitionEvidence ?? []).toHaveLength(0);
  expect(relationship?.heat).toBe("H1");

  // ④ 全程无中途互选：UI 从未出现 MutualCheckSheet（互选屏 / 交接遮罩 / 结果屏都不得出现）。
  await expect(mutualSheet(page)).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "选择你想进一步认识的人" })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "交接遮罩" })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "互选结果" })).toHaveCount(0);
  await expect(page.getByText("男女秘密互选 · 手机传阅")).toHaveCount(0);
  await expect(page.getByText(/请把手机交给/)).toHaveCount(0);

  // ⑤ 不产生任何 MATCH（互选成的、单向的、跳过的都不留痕）。
  expect(Object.keys(relationship?.matches ?? {})).toHaveLength(0);

  // ⑥ 没有任何一次「常规互选已发生」的记账（弹过就会 +1）。
  expect(relationship?.regularMutualCheckRuns).toBe(0);
  expect(relationship?.lastMutualCheckAtEffectiveCount).toBeNull();

  // ⑦ 轮次推进本身是干净的正常路：第 21 轮出卡成功（BUCKET_OK）、不处于等待 Host 决策。
  expect(stored.v2Orchestration?.lastExhaustionLevel).toBe("BUCKET_OK");
  expect(stored.v2Orchestration?.awaitingHostDecision).toBe(false);
  expect(stored.status).toBe("active");
});

/**
 * 正向 UI E2E：完整 audited metadata fixture → 走真实生产链 → 形成 recognitionEvidence →
 * 落进 12–14 窗口且四阈值满足 → 弹一次 Mutual → 双选成 MATCH。
 *
 * `DEFERRED_BY_HUMAN`（2026-09-27 冻结，不可自行解冻）：
 * Human 裁定「UI 正向 Playwright E2E 不属于 B2.2 blocker，**但不得写成 PASS**」；
 * 且当前 formal manifest 的 audited 卡为 0 张，正向链在真实数据下本就不可达。
 * 正向 production-chain 覆盖改在 unit/integration 层做（下一单），本文件不伪称已有正向 UI 覆盖。
 */
test("V2正向：audited metadata → 弹 Mutual → 双选成 MATCH（DEFERRED_BY_HUMAN，本批不做）", async () => {
  test.skip(true, "DEFERRED_BY_HUMAN：Human 已冻结本批不做正向 UI E2E（不得写成 PASS）；正向 production-chain 覆盖在 unit/integration 层（下一单）。");
});
