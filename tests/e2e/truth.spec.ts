import { test, expect, type Page } from "@playwright/test";
import { truthPair } from "../../content/truth/pair";

async function current(page: Page) { return page.locator(".punishment-card").getAttribute("data-card-id"); }

test("entry from home, saved language, and no timer controls", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "真心话", exact: true }).click();
  await expect(page).toHaveURL(/\/truth$/);
  await page.getByRole("button", { name: "English", exact: true }).click();
  await page.getByRole("button", { name: "开始", exact: true }).click();
  await expect(page).toHaveURL(/truth\/play/);
  await expect(page.locator("[lang=en]")).toBeVisible();
  await expect(page.locator(".punishment-zh")).toHaveCount(0);
  await expect(page.getByText(/开始\d+秒/)).toHaveCount(0);
  await page.goto("/truth");
  await expect(page.getByRole("button", { name: "English", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("defaults to bilingual and renders both languages", async ({ page }) => {
  await page.goto("/truth");
  await page.getByRole("button", { name: "开始", exact: true }).click();
  await expect(page).toHaveURL(/truth\/play/);
  await expect(page.locator(".punishment-zh")).toBeVisible();
  await expect(page.locator(".punishment-en")).toBeVisible();
  await expect(page.locator(".punishment-divider")).toBeVisible();
});

test("five exact-level pools, next/switch, no adjacent repeat", async ({ page }) => {
  await page.goto("/truth/play");
  await expect(page.locator(".punishment-card")).toBeVisible();
  const first = await current(page);
  // 切档保留当前题面（与大冒险一致），随后「下一个」才从新档抽取。
  await page.getByLabel("选择 3", { exact: true }).click();
  expect(await current(page)).toBe(first);
  let last = first;
  for (let i = 0; i < 5; i++) {
    await page.getByRole("button", { name: i % 2 ? "换一个" : "下一个", exact: true }).click();
    await expect.poll(() => current(page)).not.toBe(last);
    const id = await current(page);
    expect(truthPair.find(c => c.id === id)?.level).toBe(3);
    last = id;
  }
  await page.reload();
  await expect(page.locator(".punishment-card")).toBeVisible();
});

test("普通 bank shows placeholder empty state", async ({ page }) => {
  await page.goto("/truth");
  await page.getByRole("button", { name: /普通/ }).click();
  await page.getByRole("button", { name: "开始", exact: true }).click();
  await expect(page).toHaveURL(/truth\/play/);
  await expect(page.getByText("普通题库即将上线", { exact: true })).toBeVisible();
  await expect(page.locator(".punishment-empty")).toBeVisible();
});

test("language modal switches while keeping the card", async ({ page }) => {
  await page.goto("/truth/play");
  await expect(page.locator(".punishment-card")).toBeVisible();
  const id = await current(page);
  await page.getByLabel("切换语言", { exact: true }).click();
  await page.getByRole("button", { name: "中文", exact: true }).click();
  await page.getByText("完成", { exact: true }).click();
  expect(await current(page)).toBe(id);
  await expect(page.locator(".punishment-zh")).toBeVisible();
});

for (const width of [360, 390, 1280])
  test(`layout and reachable footer at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/truth/play");
    await expect(page.locator(".punishment-actions button")).toHaveCount(2);
    const buttons = await page.locator(".punishment-actions button").evaluateAll(nodes => nodes.map(n => { const r = n.getBoundingClientRect(); return { y: r.y, bottom: r.bottom }; }));
    expect(new Set(buttons.map(b => b.y)).size).toBe(1);
    expect(buttons.every(b => b.bottom <= 844)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `docs/qa/truth/idle-${width}.png` });
  });