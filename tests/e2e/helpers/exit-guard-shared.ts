import { expect, type Page } from "@playwright/test";

/**
 * exit-confirm 两个 spec（exit-confirm / exit-confirm-cold-start）的共用真源。
 * 端口与 origin 一律从 Playwright 的 baseURL fixture 派生（playwright.config.ts 由
 * PLAYWRIGHT_BASE_URL 单一环境变量决定），禁止在本目录再写死 host:port。
 */

export const EXIT_TITLE = "要退出 Party Night 吗？";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 「回到首页」断言的唯一出口：origin 必须严格等于 baseURL 的 origin，且 path 恰为 `/`。
 *
 * 等价性说明：原先两个 spec 各写一份硬编码 host:port 的结尾锚定正则（只在结尾锚定，
 * 理论上「任意前缀＋正确 host:port 结尾」的 URL 也会匹配）。本断言两端全锚定，
 * 「错误 origin」（含换端口后的真实 origin）与「错误 path」都会失败——断言强度严格更强。
 */
export async function expectAtHomeRoot(page: Page, baseURL: string | undefined): Promise<void> {
  if (!baseURL) throw new Error("baseURL fixture 缺失：playwright.config 的 use.baseURL 未配置");
  const origin = new URL(baseURL).origin;
  await expect(page).toHaveURL(new RegExp(`^${escapeRegExp(origin)}/$`));
}
