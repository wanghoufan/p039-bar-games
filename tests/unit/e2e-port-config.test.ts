import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * E2E 端口真源守护测试（配套 playwright.config.ts 的 PLAYWRIGHT_BASE_URL 改造）。
 *
 * 背景：端口 3000 被别的项目长期占用，历史上每次跑 E2E 都要「临时改 spec 常量再 git checkout
 * 还原」，并多次造成「6 条端口伪失败」被误当真实失败。治本方案：playwright.config.ts 由
 * PLAYWRIGHT_BASE_URL 单一环境变量派生 use.baseURL / webServer.url / dev server 端口；
 * spec 断言从 baseURL fixture 派生，不再写死 host:port。
 *
 * 本文件锁死两件事：
 * 1. config 三处同源、端口真传入 `next dev -p`，默认（无环境变量）仍是 3000，行为不变；
 * 2. tests/e2e/** 内禁止出现任何硬编码 host:port —— spec 再写死 3000 时这里必须变红。
 */

const E2E_DIR = join(__dirname, "../e2e");

function listTsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return listTsFiles(full);
    return name.endsWith(".ts") ? [full] : [];
  });
}

async function loadConfig() {
  vi.resetModules();
  return (await import("@/playwright.config")).default;
}

/** 本仓 config 的 webServer 是单对象而非数组，这里收窄成非空单对象便于断言。 */
function soleWebServer(config: Awaited<ReturnType<typeof loadConfig>>) {
  const ws = Array.isArray(config.webServer) ? config.webServer[0] : config.webServer;
  if (!ws) throw new Error("playwright.config.webServer 缺失");
  return ws;
}

const savedEnv = process.env.PLAYWRIGHT_BASE_URL;

afterEach(() => {
  if (savedEnv === undefined) delete process.env.PLAYWRIGHT_BASE_URL;
  else process.env.PLAYWRIGHT_BASE_URL = savedEnv;
});

describe("playwright.config 端口唯一真源（PLAYWRIGHT_BASE_URL）", () => {
  it("默认（未设置 PLAYWRIGHT_BASE_URL）保持 3000，use.baseURL 与 webServer.url 同源", async () => {
    delete process.env.PLAYWRIGHT_BASE_URL;
    const config = await loadConfig();

    expect(config.use?.baseURL).toBe("http://127.0.0.1:3000");
    expect(soleWebServer(config).url).toBe("http://127.0.0.1:3000");
  });

  it("默认命令把端口真传入 dev server（next dev -p 3000，与 url 同源）", async () => {
    delete process.env.PLAYWRIGHT_BASE_URL;
    const config = await loadConfig();

    expect(soleWebServer(config).command).toBe("pnpm dev --hostname 127.0.0.1 -p 3000");
  });

  it("设置 PLAYWRIGHT_BASE_URL 后三处全部同源派生，端口真传入 dev server（非 3000 免改源码）", async () => {
    process.env.PLAYWRIGHT_BASE_URL = "http://127.0.0.1:3210";
    const config = await loadConfig();

    expect(config.use?.baseURL).toBe("http://127.0.0.1:3210");
    expect(soleWebServer(config).url).toBe("http://127.0.0.1:3210");
    expect(soleWebServer(config).command).toBe("pnpm dev --hostname 127.0.0.1 -p 3210");
  });

  it("PLAYWRIGHT_BASE_URL 缺显式端口时 fail-fast，不许静默回落", async () => {
    process.env.PLAYWRIGHT_BASE_URL = "http://127.0.0.1";
    await expect(loadConfig()).rejects.toThrow(/显式端口/);
  });
});

describe("tests/e2e 禁止硬编码 host:port", () => {
  it("所有 e2e 源码文件（含 spec 与 helper）都不含写死的 127.0.0.1 / localhost / :3000", () => {
    const offenders = listTsFiles(E2E_DIR)
      .map((file) => {
        const source = readFileSync(file, "utf8");
        // 只匹配代码会写死的形态：127.0.0.1、localhost、显式 :3000 端口。
        const hits = source.match(/127\.0\.0\.1|localhost|:3000/g);
        return hits ? `${file}: ${[...new Set(hits)].join(", ")}` : null;
      })
      .filter((v): v is string => v !== null);

    expect(offenders).toEqual([]);
  });
});
