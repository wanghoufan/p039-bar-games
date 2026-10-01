import { expect, test, type Page } from "@playwright/test";
import { currentSessionId, readSession } from "./helpers";

/** 二选一题卡由 binary-choice renderer 承载：A / VS / B + 一主（下一题）一辅（换一个）。 */
const view = (page: Page) => page.locator(".would-you-rather");
const options = (page: Page) => page.locator(".would-you-rather__option");
const primary = (page: Page) => page.getByRole("button", { name: "下一题" });
const swap = (page: Page) => page.getByRole("button", { name: "换一个" });

/**
 * 从首页玩法卡直接进“二选一”单玩法一局，走到生成页为止（V1.4 R-050：7 个玩法直接铺在首页）。
 * 默认尺度调到 5 并放开手机隐私/公开发布两个雷区，让本地 11 张二选一 seed 全部可玩（覆盖 10 轮＋换题）。
 */
async function prepareWouldYouRather(page: Page, intensity = "5") {
  await page.goto("/");
  await page.getByRole("link", { name: /二选一/ }).click();
  await expect(page).toHaveURL(/\/setup\?pack=would-you-rather/);
  await page.getByLabel("游戏强度").fill(intensity);
  await page.getByRole("button", { name: /下一步：雷区设置/ }).click();
  await expect(page).toHaveURL(/\/boundaries/);
  await page.getByLabel("禁用手机隐私").uncheck();
  await page.getByLabel("禁用公开发布").uncheck();
  await page.getByRole("button", { name: /下一步：生成游戏/ }).click();
  await expect(page).toHaveURL(/\/generating/);
}

async function dealLocalSeeds(page: Page) {
  await page.getByRole("button", { name: /使用本地题库开始/ }).click();
  await expect(page).toHaveURL(/\/game/);
  await expect(view(page)).toBeVisible();
}

test("二选一：出 A/VS/B 题面，下一题记 completed、换一个记 swapped 并留拒绝指纹", async ({ page }) => {
  await prepareWouldYouRather(page);
  await dealLocalSeeds(page);

  const id = currentSessionId(page);
  const first = await readSession(page, id);
  const firstCard = first.deckSnapshot.find((card) => card.id === first.currentRound?.cardId)!;
  expect(firstCard.packId).toBe("would-you-rather");
  const [a, b] = firstCard.content.split(" VS ");

  await expect(page.getByRole("heading", { name: "必须选一个" })).toBeVisible();
  await expect(view(page)).toHaveAttribute("data-card-id", firstCard.id);
  await expect(options(page)).toHaveCount(2);
  await expect(options(page).nth(0)).toContainText(a);
  await expect(options(page).nth(1)).toContainText(b);
  await expect(page.locator(".would-you-rather__vs")).toHaveText("VS");
  await expect(page.locator(".would-you-rather__countdown")).toContainText("3 · 2 · 1");
  // 可选短倒计时：默认按 3/2/1 三步动画播放；reduced-motion 时不出现数字，直接停在静态提示
  await expect(page.locator(".would-you-rather__count")).toHaveCount(3);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".would-you-rather__hint")).toBeVisible();
  await expect(page.locator(".would-you-rather__count").first()).toBeHidden();
  await page.emulateMedia({ reducedMotion: null });
  await expect(page.locator(".game-card__source")).toHaveText("本地题库");
  // 一屏一主一辅：没有第二个主按钮，也没有跳过
  await expect(page.locator(".round-actions .button")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "跳过" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "完成" })).toHaveCount(0);

  // 换一个 → swapped + 拒绝指纹（recentRejectedFingerprints），题面换新
  await swap(page).click();
  await expect.poll(() => options(page).nth(0).textContent()).not.toContain(a);
  const swapped = await readSession(page, id);
  expect(swapped.rounds.map((round) => round.status)).toEqual(["swapped"]);
  expect(swapped.rounds[0].packId).toBe("would-you-rather");
  expect(swapped.currentRound?.cardId).not.toBe(firstCard.id);
  expect(swapped.recentRejectedFingerprints?.length).toBe(1);

  // 下一题 → completed（V1.5 顶栏只数已完成：换一个不推进，完成后才到第 2 轮）
  const second = swapped.deckSnapshot.find((card) => card.id === swapped.currentRound?.cardId)!;
  await primary(page).click();
  try {
    await expect(page.getByText(/第 2 \/ /)).toBeVisible({ timeout: 15000 });
  } catch {
    const dbg = await readSession(page, id);
    throw new Error(`第2轮header未出现 rounds=${JSON.stringify(dbg.rounds.map((r) => r.status))} cur=${dbg.currentRound?.cardId} used=${dbg.usedCardIds.length} deck=${dbg.deckSnapshot.length}`);
  }
  const done = await readSession(page, id);
  expect(done.rounds.map((round) => round.status)).toEqual(["swapped", "completed"]);
  expect(done.usedCardIds).toContain(second.id);
});

test("二选一：连续 10 轮不重题、全部 completed，Session 尺度与配置原样继承", async ({ page }) => {
  await prepareWouldYouRather(page);
  await dealLocalSeeds(page);

  const id = currentSessionId(page);
  const before = await readSession(page, id);

  for (let round = 1; round <= 10; round += 1) {
    await primary(page).click();
    await expect(page.getByText(new RegExp(`第 ${round + 1} / `))).toBeVisible();
  }

  const after = await readSession(page, id);
  expect(after.id).toBe(before.id);
  expect(after.rounds).toHaveLength(10);
  expect(after.rounds.every((round) => round.status === "completed")).toBe(true);
  expect(after.rounds.every((round) => round.packId === "would-you-rather")).toBe(true);
  expect(new Set(after.rounds.map((round) => round.cardId)).size).toBe(10);
  // 尺度继承：Session 配置一题一路不变，且没有一张题卡越过本局尺度
  expect(after.config).toEqual(before.config);
  expect(after.config.intensity).toBe(5);
  const dealt = after.rounds.map((round) => after.deckSnapshot.find((card) => card.id === round.cardId)!);
  expect(dealt.every((card) => card.intensity <= after.config.intensity)).toBe(true);
  expect(dealt.some((card) => card.intensity >= 3)).toBe(true);
  await expect(view(page)).toBeVisible();
});

/**
 * 二选一：AI 主线缺省关闭（`AI_MAINLINE_ENABLED` 未显式置 true）时，生成入口被隔离，
 * 组局页如实告知「本次使用本地固定题库」，本地固定题库照常能开局、换题、下一题。
 * 这是 Phase B Fixed Content First（Plan §13）的新契约：不再是「生成失败」错误页。
 */
test("二选一：AI 缺省关闭时如实提示「本次使用本地固定题库」，本地题库仍能开局/换题/下一题", async ({ page }) => {
  await prepareWouldYouRather(page);
  await expect(page.getByRole("heading", { name: "本次使用本地固定题库" })).toBeVisible();
  await dealLocalSeeds(page);

  const id = currentSessionId(page);
  const session = await readSession(page, id);
  expect(session.deckSnapshot.length).toBeGreaterThanOrEqual(10);
  expect(session.deckSnapshot.every((card) => card.packId === "would-you-rather")).toBe(true);
  expect(session.deckSnapshot.some((card) => card.source === "ai")).toBe(false);
  await expect(page.locator(".game-card__source")).toHaveText("本地题库");

  // 缺省关闭下继续玩：换一个 + 下一题都能出题
  await swap(page).click();
  await expect(view(page)).toBeVisible();
  await primary(page).click();
  try {
    await expect(page.getByText(/第 2 \/ /)).toBeVisible({ timeout: 15000 });
  } catch {
    const dbg = await readSession(page, id);
    throw new Error(`缺省关闭第2轮header未出现 rounds=${JSON.stringify(dbg.rounds.map((r) => r.status))} cur=${dbg.currentRound?.cardId} used=${dbg.usedCardIds.length} deck=${dbg.deckSnapshot.length} url=${page.url()}`);
  }
  const done = await readSession(page, id);
  expect(done.rounds.map((round) => round.status)).toEqual(["swapped", "completed"]);
  expect(done.currentPackId).toBe("would-you-rather");
});

/**
 * 二选一：AI 已启用但断网时，回退本地 seed，出题与换题都不卡。
 *
 * 【单独跑法】与 `PARTY_NIGHT_PRODUCTION_SMOKE` 同理用环境变量门控，默认（AI 缺省关闭）下跳过：
 *   AI_MAINLINE_ENABLED=true pnpm exec playwright test tests/e2e/would-you-rather.spec.ts -g "AI 启用但断网"
 *
 * 【为什么要额外注入 flag】`isAiMainlineEnabled()` 在**浏览器端**读 `process.env.AI_MAINLINE_ENABLED`；
 * Next 把浏览器侧 `process` polyfill 成 `{ env: {} }`（见 next/dist/compiled/process/browser.js），
 * 故仅靠 dev server 进程环境变量无法在客户端打开开关。本用例用 `page.addInitScript` 在页面加载前
 * 把该键注入浏览器 `process.env`（不改任何业务代码，也不放宽上面那条「AI 缺省关闭」契约断言）。
 * 注：若某天开关挪到服务端守卫，CLI 的 `AI_MAINLINE_ENABLED=true` 即生效，本注入成为无害冗余。
 */
test("二选一：AI 启用但断网时回退本地 seed，出题与换题都不卡", async ({ page }) => {
  test.skip(process.env.AI_MAINLINE_ENABLED !== "true", "需 AI 主线启用时单独跑：AI_MAINLINE_ENABLED=true playwright test -g \"AI 启用但断网\"");
  // 注入浏览器侧开关（见上方说明）；同时兜底拦断/阻塞 CDN，杜绝任何真实外网请求。
  await page.addInitScript(() => {
    (globalThis as unknown as { process: { env: Record<string, string> } }).process = { env: { AI_MAINLINE_ENABLED: "true" } };
  });
  await page.route("**/api/generate-session", (route) => route.abort("internetdisconnected"));
  await page.route("https://**", (route) => route.abort("internetdisconnected"));

  // 配置一个 Provider；故意留空 baseUrl → 直连在 URL 校验处即失败（不发任何网络请求）。
  await page.goto("/settings/ai");
  await page.getByRole("textbox", { name: "API Key", exact: true }).fill("sk-e2e-offline-never-log-this");
  await page.getByRole("button", { name: "保存配置" }).click();
  await expect(page.getByText(/配置已加密保存|仅本次会话使用/)).toBeVisible();

  await prepareWouldYouRather(page);
  await expect(page.getByRole("heading", { name: "这次生成没有完成" })).toBeVisible();
  await dealLocalSeeds(page);

  const id = currentSessionId(page);
  const session = await readSession(page, id);
  expect(session.deckSnapshot.length).toBeGreaterThanOrEqual(10);
  expect(session.deckSnapshot.every((card) => card.packId === "would-you-rather")).toBe(true);
  expect(session.deckSnapshot.some((card) => card.source === "ai")).toBe(false);
  await expect(page.locator(".game-card__source")).toHaveText("本地题库");

  // 断网状态下继续玩：换一个 + 下一题都能出题
  await swap(page).click();
  await expect(view(page)).toBeVisible();
  await primary(page).click();
  try {
    await expect(page.getByText(/第 2 \/ /)).toBeVisible({ timeout: 15000 });
  } catch {
    const dbg = await readSession(page, id);
    throw new Error(`AI断网第2轮header未出现 rounds=${JSON.stringify(dbg.rounds.map((r) => r.status))} cur=${dbg.currentRound?.cardId} used=${dbg.usedCardIds.length} deck=${dbg.deckSnapshot.length} url=${page.url()}`);
  }
  const done = await readSession(page, id);
  expect(done.rounds.map((round) => round.status)).toEqual(["swapped", "completed"]);
  expect(done.currentPackId).toBe("would-you-rather");
});
