import { expect, test, type Page } from "@playwright/test";
import { EXIT_GUARD_ARMED_ATTR, EXIT_GUARD_SENTINEL_DEPTH, EXIT_GUARD_STATE_KEY } from "@/lib/system/exit-guard";
import { EXIT_TITLE, expectAtHomeRoot } from "./helpers/exit-guard-shared";

/**
 * Change A 返工（EXIT-GUARD-001）：冷启动直开静态导出路由时的「装配空窗」。
 *
 * 修前：哨兵由 React effect 装配，首屏到 hydration 之间按返回会直接落到 about:blank。
 * 修后：哨兵由 head 的内联脚本在解析阶段就压好，`data-pn-exit-guard-armed` 随之提前。
 *
 * 口径说明：QA 原脚本用的是 `waitUntil: "commit"` + 立刻返回。实测该时点文档连 `documentElement`
 * 之后的第一个 `<script>` 都还没解析到（连 commit 耗时 427ms 的那次也仍 `armed=null`），也就是说
 * 那一刻**本页还没有任何一行代码执行过**，任何 in-page 手段都覆盖不到（beforeunload 明确不采纳）。
 * 所以这里取「文档刚解析完（DOMContentLoaded）」——用户真能按到返回键的最早时刻：修前此刻守门
 * 仍未 armed（实测 3/3 为 null），修后必定已 armed（实测 12/12），是同一场景的确定性等价口径。
 *
 * 「回到首页」断言统一走 helpers/exit-guard-shared.ts 的 expectAtHomeRoot（从 baseURL 派生，
 * 不写死 host:port——端口由 PLAYWRIGHT_BASE_URL 决定）。
 */

const GUARD_ROUTES = ["/setup", "/settings/ai"];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function entryDepth(page: Page) {
  return page.evaluate((key: string) => (window.history.state as Record<string, unknown> | null)?.[key] ?? null, EXIT_GUARD_STATE_KEY);
}

/** 停在「文档刚解析完」这一刻：守门若还靠 hydration，就来不及拦下这一按。 */
async function gotoDomReady(page: Page, route: string) {
  await page.goto(route, { waitUntil: "commit" });
  await page.waitForLoadState("domcontentloaded");
}

for (const route of GUARD_ROUTES) {
  test(`冷启动直开 ${route}，文档一解析完就返回：守门已生效、不落 about:blank、并弹出确认框`, async ({ page }) => {
    await gotoDomReady(page, route);

    // 修前这里是 null（守门还在等 hydration）——docReady 一到就必须 armed
    await expect(page.locator("html")).toHaveAttribute(EXIT_GUARD_ARMED_ATTR, "1");

    await page.goBack();

    // 这一按落在站内入口条目上，且哨兵已被补回（当前条目深度回到 1），不是 about:blank
    await expect(page).not.toHaveURL(/^about:blank/);
    await expect(page).toHaveURL(new RegExp(`${escapeRegExp(route)}/?$`));
    await expect.poll(() => entryDepth(page)).toBe(EXIT_GUARD_SENTINEL_DEPTH);
    // 且那一下返回不静默：守门接管后补上确认框
    await expect(page.getByRole("dialog", { name: EXIT_TITLE })).toBeVisible({ timeout: 15_000 });
  });
}

test("冷启动直开 /setup，React 一行都没跑（JS chunk 全断）时返回：仍留在站内", async ({ page }) => {
  // 断掉所有脚本资源（样式放行）：React 永远不会 hydration，能起作用的只有 head 内联脚本。
  await page.route("**/_next/static/**", (route) =>
    route.request().resourceType() === "script" ? route.abort() : route.continue(),
  );

  await page.goto("/setup", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute(EXIT_GUARD_ARMED_ATTR, "1");

  await page.goBack();
  await page.waitForTimeout(500);
  await expect(page).toHaveURL(/\/setup\/?$/);
  await expect(page).not.toHaveURL(/^about:blank/);
  // 没有 React 就没有确认框；但「首屏到 hydration 之间的窗口」已被证明不再漏人
  await expect(page.getByRole("dialog", { name: EXIT_TITLE })).toHaveCount(0);
});

test("冷启动直开 /setup，等 armed 后再返回：只有一条哨兵、只弹一个确认框", async ({ page }) => {
  await page.goto("/setup");
  await expect(page.locator("html")).toHaveAttribute(EXIT_GUARD_ARMED_ATTR);
  // 当前条目就是哨兵（深度 1）；出现 2 就等于重复压了第二条
  await expect.poll(() => entryDepth(page)).toBe(EXIT_GUARD_SENTINEL_DEPTH);

  await page.goBack();
  const dialog = page.getByRole("dialog", { name: EXIT_TITLE });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(page).toHaveURL(/\/setup\/?$/);

  // 再按一次：只关框，仍站内（深度判定没偏，没有多出第二层点击）
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/setup\/?$/);
});

test("冷启动首页连按两次返回：第一下弹框、第二下只关框，始终不退出", async ({ page, baseURL }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute(EXIT_GUARD_ARMED_ATTR);

  await page.goBack();
  const dialog = page.getByRole("dialog", { name: EXIT_TITLE });
  await expect(dialog).toBeVisible();

  await page.goBack();
  await expect(dialog).toHaveCount(0);
  await expectAtHomeRoot(page, baseURL);
  await expect(page).not.toHaveURL(/^about:blank/);
});
