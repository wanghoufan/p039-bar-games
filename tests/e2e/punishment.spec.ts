import { test, expect, type Page } from "@playwright/test";
import { challenges } from "../../content/punishment/challenges";
import { newSession } from "../../lib/punishment/session";
const key = "party-night-punishment-session-v1";
async function current(page: Page) { return page.locator(".punishment-card").getAttribute("data-card-id"); }
async function timed(page: Page) { await page.goto("/punishment"); await page.evaluate(({ key, s }) => sessionStorage.setItem(key, JSON.stringify(s)), { key, s: { ...newSession(), selectedLevel: 2 as const, currentCardId: "sample-2-a" } }); await page.goto("/punishment/play"); await expect(page.getByText("开始15秒")).toBeVisible(); }
async function settings(page: Page) { await page.getByRole("button", { name: "设置与盾牌" }).click(); await expect(page.getByRole("dialog")).toBeVisible(); }
test("new entry, saved preferences, clearable new session, old entry preserved", async ({ page }) => { await page.goto("/"); await page.getByRole("link", { name: "大冒险", exact: true }).click(); await page.getByRole("button", { name: "English", exact: true }).click(); await page.getByRole("checkbox", { name: "亲吻", exact: true }).uncheck(); await page.getByRole("button", { name: "开始", exact: true }).click(); await expect(page).toHaveURL(/punishment\/play/); await expect(page.locator("[lang=en]")).toBeVisible(); await expect(page.locator(".punishment-zh")).toHaveCount(0); await page.goto("/punishment"); await expect(page.getByRole("button", { name: "English", exact: true })).toHaveAttribute("aria-pressed", "true"); await expect(page.getByRole("checkbox", { name: "亲吻", exact: true })).not.toBeChecked(); await page.goto("/"); await page.getByRole("link", { name: /真心话大冒险/ }).click(); await expect(page).toHaveURL(/setup\?pack=truth-dare/); });
test("five exact-level pools, immediate next selection, progress, no adjacent repeat, speed", async ({ page }) => { await page.goto("/punishment/play"); for (const level of [2, 4, 2, 5, 3, 1]) {
    const before = await current(page);
    await page.getByLabel(`选择 ${level}`, { exact: true }).click();
    expect(await current(page)).toBe(before);
    let last = before;
    for (let i = 0; i < 5; i++) {
        const start = Date.now();
        await page.getByRole("button", { name: i % 2 ? "换一个" : "下一个", exact: true }).click();
        await expect.poll(() => current(page)).not.toBe(last);
        expect(Date.now() - start).toBeLessThan(500);
        const id = await current(page);
        expect(challenges.find(c => c.id === id)?.level).toBe(level);
        last = id;
    }
} await page.reload(); await expect(page.locator(".punishment-card")).toBeVisible(); });
test("shields keep current card, fail closed and recover through both empty actions", async ({ page }) => { await page.goto("/punishment/play"); const id = await current(page); await settings(page); for (const box of await page.getByRole("checkbox").all())
    await box.uncheck(); await page.getByRole("button", { name: "完成", exact: true }).click(); expect(await current(page)).toBe(id); await page.getByRole("button", { name: "下一个", exact: true }).click(); await expect(page.getByText("暂无可用", { exact: true })).toBeVisible(); expect(await page.locator(".punishment-empty button").allTextContents()).toEqual(["切换其他", "调整盾牌"]); await page.getByText("切换其他", { exact: true }).click(); await expect(page.getByText("暂无可用", { exact: true })).toBeVisible(); await page.getByText("调整盾牌", { exact: true }).click(); await page.getByRole("checkbox", { name: "表演", exact: true }).check(); await page.getByRole("button", { name: "完成", exact: true }).click(); for (let i = 0; i < 5 && !(await page.locator(".punishment-copy").count()); i++)
    await page.getByText("切换其他", { exact: true }).click(); await expect(page.locator(".punishment-copy")).toBeVisible(); const cardId = await current(page); const card = challenges.find(c => c.id === cardId); expect(card?.contentTags.every(t => ["performance"].includes(t))).toBe(true); });
test("languages and all themes preserve card, session and timer", async ({ page }) => { await timed(page); const id = await current(page); const saved = await page.evaluate(key => sessionStorage.getItem(key), key); for (const language of ["English", "中文", "中英双语"]) {
    await page.getByLabel("切换语言", { exact: true }).click();
    await page.getByRole("button", { name: language, exact: true }).click();
    await page.getByText("完成", { exact: true }).click();
    expect(await current(page)).toBe(id);
    expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBe(saved);
} for (const theme of ["浅色", "深色", "跟随系统"]) {
    await settings(page);
    await page.getByRole("button", { name: theme, exact: true }).click();
    await page.getByText("完成", { exact: true }).click();
    expect(await current(page)).toBe(id);
    expect(await page.locator(".punishment-actions button").count()).toBe(3);
} });
test("direct countdown, pause/resume/end/finish same card with feedback and mute", async ({ page }) => { test.setTimeout(45000); await timed(page); await page.evaluate(() => { const w = window as unknown as {
    vibrations: number;
    tones: number;
}; w.vibrations = 0; w.tones = 0; Object.defineProperty(navigator, "vibrate", { value: () => { w.vibrations++; return true; }, configurable: true }); const old = AudioContext.prototype.createOscillator; AudioContext.prototype.createOscillator = function () { w.tones++; return old.call(this); }; }); const id = await current(page); const started = Date.now(); await page.getByText("开始15秒", { exact: true }).click(); await expect(page.getByRole("timer")).toBeVisible(); expect(Date.now() - started).toBeLessThan(500); await expect(page.getByRole("timer")).toContainText("15"); await expect(page.getByText("再来一次", { exact: true })).toHaveCount(0); await expect(page.locator(".punishment-copy")).toBeVisible(); await page.getByText("暂停", { exact: true }).click(); const paused = await page.getByRole("timer").textContent(); await page.waitForTimeout(1100); expect(await page.getByRole("timer").textContent()).toBe(paused); await page.getByText("继续", { exact: true }).click(); await page.getByText("结束", { exact: true }).click(); expect(await current(page)).toBe(id); await expect(page.getByText("开始15秒", { exact: true })).toBeVisible(); await page.getByText("开始15秒", { exact: true }).click(); await expect(page.getByText("时间到！", { exact: true })).toBeVisible({ timeout: 17000 }); expect(await current(page)).toBe(id); expect(await page.evaluate(() => (window as unknown as {
    vibrations: number;
}).vibrations)).toBe(1); expect(await page.evaluate(() => (window as unknown as {
    tones: number;
}).tones)).toBeGreaterThan(0); await expect(page.getByText("时间到！", { exact: true })).toHaveCount(0); await settings(page); await page.getByRole("checkbox", { name: "声音", exact: true }).uncheck(); await page.getByRole("checkbox", { name: "震动", exact: true }).uncheck(); await page.getByText("完成", { exact: true }).click(); const tones = await page.evaluate(() => (window as unknown as {
    tones: number;
}).tones); await page.getByText("开始15秒", { exact: true }).click(); await expect(page.getByText("时间到！", { exact: true })).toBeVisible({ timeout: 17000 }); expect(await page.evaluate(() => (window as unknown as {
    vibrations: number;
}).vibrations)).toBe(1); expect(await page.evaluate(() => (window as unknown as {
    tones: number;
}).tones)).toBe(tones); });
for (const width of [360, 390, 430, 1280])
    test(`layout and actual controls at ${width}px`, async ({ page }) => { await page.setViewportSize({ width, height: 844 }); await timed(page); const buttons = await page.locator(".punishment-actions button").evaluateAll(nodes => nodes.map(n => { const r = n.getBoundingClientRect(); return { y: r.y, bottom: r.bottom }; })); expect(new Set(buttons.map(b => b.y)).size).toBe(1); expect(buttons.every(b => b.bottom <= 844)).toBe(true); const size = await page.locator(".punishment-en").evaluate(n => parseFloat(getComputedStyle(n).fontSize)); expect(size).toBeGreaterThanOrEqual(28); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: `docs/qa/punishment/idle-${width}.png` }); await page.getByText("开始15秒", { exact: true }).click(); await page.screenshot({ path: `docs/qa/punishment/timer-${width}.png` }); await page.getByText("结束", { exact: true }).click(); });
test("offline core operates without remote requests", async ({ page, context }) => { await timed(page); const requests: string[] = []; page.on("request", r => { if (r.url().includes("/api/"))
    requests.push(r.url()); }); await context.setOffline(true); await page.getByLabel("选择 4", { exact: true }).click(); await page.getByText("换一个", { exact: true }).click(); let cardId = await current(page); expect(challenges.find(c => c.id === cardId)?.level).toBe(4); await page.getByLabel("切换语言", { exact: true }).click(); await page.getByText("English", { exact: true }).click(); await page.getByText("完成", { exact: true }).click(); await settings(page); await page.getByRole("checkbox", { name: "亲吻", exact: true }).uncheck(); await page.getByText("完成", { exact: true }).click(); for (let i = 0; i < 4; i++) {
    await page.getByText("换一个", { exact: true }).click();
    cardId = await current(page);
    expect(challenges.find(c => c.id === cardId)?.contentTags).not.toContain("kiss");
} expect(requests).toEqual([]); await context.setOffline(false); });

test("running timer survives language, shield, theme and system appearance changes",async({page})=>{
 await timed(page);const id=await current(page);await page.getByText("开始15秒",{exact:true}).click();
 await settings(page);await page.getByRole("button",{name:"English",exact:true}).click();await page.getByRole("button",{name:"跟随系统",exact:true}).click();await page.getByRole("checkbox",{name:"暧昧",exact:true}).uncheck();await page.getByText("关于 / 隐私",{exact:true}).click();await expect(page.getByText(/仅在本机保存偏好/)).toBeVisible();await page.getByText("完成",{exact:true}).click();
 await page.emulateMedia({colorScheme:"light"});await expect(page.locator("html")).toHaveAttribute("data-theme","light");
 await expect(page.getByRole("timer")).toHaveAttribute("aria-label","倒计时");expect(await current(page)).toBe(id);await expect(page.locator(".punishment-zh")).toHaveCount(0);await page.getByText("结束",{exact:true}).click();await page.getByText("换一个",{exact:true}).click();const drawn=await current(page);expect(challenges.find(c=>c.id===drawn)?.contentTags).not.toContain("flirt");
});

test("long bilingual content and short screens keep footer reachable",async({page})=>{
 await page.setViewportSize({width:360,height:640});await timed(page);
 // Boundary typography fixture: exercise the real finite-size CSS with an over-length reviewed card shape.
 await page.locator(".punishment-card").evaluate(n=>{n.classList.add("is-long");n.querySelector(".punishment-zh")!.textContent="这是长题面边界样本，用于检查中文换行、题卡滚动和底部按钮是否仍然清晰可见。".repeat(2);n.querySelector(".punishment-en")!.textContent="This long bilingual boundary sample checks readable text wrapping and card scrolling while all three footer buttons remain reachable. ".repeat(2);});
 expect(await page.locator(".punishment-en").evaluate(n=>parseFloat(getComputedStyle(n).fontSize))).toBeGreaterThanOrEqual(28);
 expect(await page.locator(".punishment-actions").evaluate(n=>n.getBoundingClientRect().bottom)).toBeLessThanOrEqual(640);
 await page.screenshot({path:"docs/qa/punishment/long-360x640.png"});await page.getByText("换一个",{exact:true}).click();
});
