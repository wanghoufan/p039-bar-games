import { expect, test, type Page } from "@playwright/test";
import { EXIT_GUARD_ARMED_ATTR } from "@/lib/system/exit-guard";
import { EXIT_TITLE, expectAtHomeRoot } from "./helpers/exit-guard-shared";

/**
 * Change A：返回键退出确认。
 * 覆盖两条最容易做错的边界：① 顶层返回要弹确认；② 有上一层的返回**绝不能**弹（不许多一次点击）。
 * Web 环境没有关标签页的权限，所以「退出」的可测口径是离开本站（about:blank），不是空断言。
 *
 * 守门由 head 的 beforeInteractive 内联脚本在首屏就压好哨兵，`data-pn-exit-guard-armed` 随之
 * 提前出现；这里仍统一等它，是为了让断言落在「守门已生效」的稳态上。
 * 冷启动下「不等 armed 就返回」的空窗另有专测：tests/e2e/exit-confirm-cold-start.spec.ts。
 *
 * 「回到首页」断言统一走 helpers/exit-guard-shared.ts 的 expectAtHomeRoot（从 baseURL 派生，
 * 不写死 host:port——端口由 PLAYWRIGHT_BASE_URL 决定）。
 */

async function gotoArmed(page: Page, path = "/") {
  await page.goto(path);
  await expect(page.locator("html")).toHaveAttribute(EXIT_GUARD_ARMED_ATTR);
}

test("首页按浏览器返回：弹退出确认，点「继续玩」留在原地", async ({ page, baseURL }) => {
  await gotoArmed(page);
  await page.goBack();

  const dialog = page.getByRole("dialog", { name: EXIT_TITLE });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("不小心点到返回了？点「继续玩」就留在这里。");

  await dialog.getByRole("button", { name: "继续玩" }).click();
  await expect(dialog).toHaveCount(0);
  await expectAtHomeRoot(page, baseURL);
});

test("确认框里点「退出」：真的离开当前页（Web 口径＝导航离开本站）", async ({ page }) => {
  await gotoArmed(page);
  await page.goBack();

  const dialog = page.getByRole("dialog", { name: EXIT_TITLE });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "退出" }).click();

  await page.waitForURL(/^about:blank$/);
  await expect(page).toHaveURL(/^about:blank$/);
});

test("确认框里按 ESC＝取消，不退出", async ({ page, baseURL }) => {
  await gotoArmed(page);
  await page.goBack();
  const dialog = page.getByRole("dialog", { name: EXIT_TITLE });
  await expect(dialog).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expectAtHomeRoot(page, baseURL);
});

test("顶层连点返回：只关框不误退，第三次才重新弹框", async ({ page, baseURL }) => {
  await gotoArmed(page);
  await page.goBack();
  const dialog = page.getByRole("dialog", { name: EXIT_TITLE });
  await expect(dialog).toBeVisible();

  // 第二次返回＝关掉确认框（防连点误退）
  await page.goBack();
  await expect(dialog).toHaveCount(0);
  await expectAtHomeRoot(page, baseURL);

  // 还在顶层：第三次返回重新弹，不是静默退出
  await page.goBack();
  await expect(dialog).toBeVisible();
  await expectAtHomeRoot(page, baseURL);
});

test("/setup 这类有上一层的页面返回：不弹确认，正常退回首页", async ({ page, baseURL }) => {
  await gotoArmed(page);
  await page.getByRole("link", { name: /今晚开局/ }).click();
  await expect(page).toHaveURL(/\/setup/);

  await page.goBack();
  await expectAtHomeRoot(page, baseURL);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("多层页面逐级返回都不弹框，退到顶层才弹", async ({ page, baseURL }) => {
  await gotoArmed(page);
  await page.getByRole("navigation", { name: "主导航" }).getByRole("link", { name: "游戏包" }).click();
  await expect(page.getByRole("heading", { name: "我的游戏包" })).toBeVisible();
  await page.getByRole("link", { name: "新建游戏包" }).click();
  await expect(page.getByRole("heading", { name: "新建游戏包" })).toBeVisible();

  await page.goBack();
  // dev 下是 /packs，静态导出（trailingSlash）下是 /packs/，两种口径都要接受
  await expect(page).toHaveURL(/\/packs\/?(?:\?|$)/);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.goBack();
  await expectAtHomeRoot(page, baseURL);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.goBack();
  await expect(page.getByRole("dialog", { name: EXIT_TITLE })).toBeVisible();
});
