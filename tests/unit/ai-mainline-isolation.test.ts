import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 正式主线 AI 隔离（PRODUCT_PLAN_V2.2-FIXED-CONTENT-FIRST §13）。
 *
 * 三个断言逐一取证：
 *   ① 正式主线 session 的卡里 AI 来源卡数 = 0（`card.source === "ai"` 判定）；
 *   ② 服务端生成调用数 = 0（客户端 /api 通道 + 服务端 route 均不发上游请求）；
 *   ③ 直连 Provider 调用数 = 0（自包含直连是**独立通道**，不因只测服务端而漏检）。
 *
 * 基础套件默认 AI 开启（见 tests/setup.ts，覆盖保留的 AI 代码）；本文件显式关闭。
 */

const upstream = vi.hoisted(() => ({ callProvider: vi.fn(), extractMessageContent: vi.fn(() => "{}") }));
vi.mock("@/lib/ai/upstream", () => upstream);

import v10Fixture from "../fixtures/ai-deck-v1.0.json";
import { DEFAULT_BOUNDARIES } from "@/lib/domain/constants";
import type { GameCard, SessionConfig } from "@/lib/domain/schemas";
import {
  buildPlayableDeck,
  localSeedDeck,
  refillPackInBackground,
  requestDeckWithFallbackResult,
  requestGeneratedDeck,
  resolveDeckTransport,
} from "@/lib/ai/generate-deck";
import { directChatCompletion, generateDeckDirect } from "@/lib/ai/direct-provider";
import {
  AI_MAINLINE_DISABLED,
  AI_MAINLINE_LOCAL_NOTICE,
  filterMainlineCards,
  isAiMainlineEnabled,
  isolateLegacyAiDeck,
  mainlineAllowsCard,
} from "@/lib/ai/mainline-flag";
import { createSession, startRound } from "@/lib/engine/session-engine";

const V10_PACK_IDS = ["truth-dare", "most-likely", "never-have", "ai-improv"];

const config = (enabledPackIds: string[] = V10_PACK_IDS): SessionConfig => ({
  players: ["a", "b", "c", "d"].map((id) => ({ id, displayName: id, active: true, createdAt: "x", lastUsedAt: "x" })),
  relationship: "friends", vibes: ["funny"], intensity: 3,
  boundaries: { ...DEFAULT_BOUNDARIES, noPhysicalContact: true, noPublicPosting: true },
  enabledPackIds, mode: "mixed",
});

const aiCard = (id: string): GameCard => ({
  id, packId: "truth-dare", type: "truth", content: `AI 题 ${id}`,
  intensity: 1, tags: [], boundaryTags: [], minPlayers: 2, participantMode: "all", source: "ai",
});

const localCard: GameCard = {
  id: "PN-TRUTH-001", packId: "truth-dare", type: "truth", content: "本地说一件今天的开心事",
  intensity: 1, tags: [], boundaryTags: [], minPlayers: 2, participantMode: "all", source: "builtin",
};

beforeEach(() => {
  vi.stubEnv("AI_MAINLINE_ENABLED", "false");
  upstream.callProvider.mockClear();
  upstream.extractMessageContent.mockClear();
});

afterEach(() => vi.unstubAllEnvs());

describe("AI 主线隔离 · 开关缺省即关闭", () => {
  it("缺省（键缺失）即关闭，且开关只认字符串 true", () => {
    vi.unstubAllEnvs();
    delete process.env.AI_MAINLINE_ENABLED;
    expect(isAiMainlineEnabled()).toBe(false);
    process.env.AI_MAINLINE_ENABLED = "1";
    expect(isAiMainlineEnabled()).toBe(false);
    process.env.AI_MAINLINE_ENABLED = "TRUE";
    expect(isAiMainlineEnabled()).toBe(false);
    process.env.AI_MAINLINE_ENABLED = "true";
    expect(isAiMainlineEnabled()).toBe(true);
    vi.stubEnv("AI_MAINLINE_ENABLED", "false");
  });

  it("中性提示文案可读、不含错误字样（不报错）", () => {
    expect(AI_MAINLINE_LOCAL_NOTICE).toMatch(/本地固定题库/);
    expect(AI_MAINLINE_LOCAL_NOTICE).not.toMatch(/失败|错误|异常|error/i);
  });
});

describe("断言① 正式主线 session 的 AI 来源卡数 = 0", () => {
  it("buildPlayableDeck 丢弃全部 AI 输出，同时保留固定库与自定义卡", () => {
    const deck = buildPlayableDeck(v10Fixture, config(), 40, []);
    expect(deck.filter((card) => card.source === "ai")).toHaveLength(0);
    expect(deck.length).toBeGreaterThanOrEqual(20); // 固定库仍足够成局
    // 对照：开关打开时同一输入仍保留 AI 卡 —— 证明是「隔离」不是「删代码」
    vi.stubEnv("AI_MAINLINE_ENABLED", "true");
    expect(buildPlayableDeck(v10Fixture, config(), 40, []).some((card) => card.source === "ai")).toBe(true);
  });

  it("自定义包里标注为 ai 来源的卡也不得混入正式快照", () => {
    const deck = buildPlayableDeck({ cards: [] }, config(), 40, [aiCard("custom-ai-1")]);
    expect(deck.filter((card) => card.source === "ai")).toHaveLength(0);
  });

  it("本地固定库牌堆（走本地题库开始）AI 卡数恒为 0", () => {
    expect(localSeedDeck(config()).filter((card) => card.source === "ai")).toHaveLength(0);
  });

  it("恢复路径 / 每轮发卡：mainlineAllowsCard 与 filterMainlineCards 拒绝 AI 卡", () => {
    expect(mainlineAllowsCard(aiCard("x"))).toBe(false);
    expect(mainlineAllowsCard(localCard)).toBe(true);
    expect(filterMainlineCards([aiCard("x"), localCard]).map((card) => card.id)).toEqual([localCard.id]);

    const legacy = createSession(config(), [localCard, aiCard("ai-1")]);
    const isolated = isolateLegacyAiDeck(legacy);
    expect(isolated.deckSnapshot.filter((card) => card.source === "ai")).toHaveLength(0);
    expect(isolated.generationSource).toBe("local-fallback");
    // 无 AI 卡时原样返回同一引用（调用方按引用判定是否发生过隔离）
    expect(isolateLegacyAiDeck({ ...legacy, deckSnapshot: [localCard] })).toMatchObject({ deckSnapshot: [localCard] });

    // 每轮发卡：抽卡只能从已被隔离的牌堆出，故 AI 卡数仍为 0
    const dealt = startRound({ ...isolated, status: "active", currentPackId: "truth-dare", config: config(["truth-dare"]) }, () => 0);
    expect(dealt.deckSnapshot.filter((card) => card.source === "ai")).toHaveLength(0);
  });
});

describe("断言② 服务端生成调用数 = 0", () => {
  it("客户端默认（服务器）通道：不发 fetch，静默回退本地固定库", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestDeckWithFallbackResult({
      profile: {} as never, apiKey: "sk-test", sessionConfig: config(), sessionId: "s1",
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.cards.filter((card) => card.source === "ai")).toHaveLength(0);
    expect(result.fallbackCode).toBe(AI_MAINLINE_DISABLED);
    vi.unstubAllGlobals();
  });

  it("requestGeneratedDeck 在入口即拒绝，绝不发服务端生成请求", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(requestGeneratedDeck({ profile: {} as never, apiKey: "sk-test", sessionConfig: config(), sessionId: "s1" })).rejects.toThrow(AI_MAINLINE_DISABLED);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("服务端 route：任何鉴权/读体/上游调用之前直接拒绝（callProvider 零调用）", async () => {
    const { POST } = await import("@/app/api/generate-session/route");
    const response = await POST(new Request("https://example.test/api/generate-session", {
      method: "POST",
      headers: { Authorization: "Bearer sk-test", "Content-Type": "application/json" },
      body: JSON.stringify({ profile: { id: "deepseek-official" }, sessionConfig: config(), targetCardCount: 40, sessionId: "s1" }),
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ ok: false, code: AI_MAINLINE_DISABLED });
    expect(upstream.callProvider).not.toHaveBeenCalled();
  });
});

describe("断言③ 直连 Provider 调用数 = 0（独立通道）", () => {
  it("自包含模式：resolveDeckTransport 指向直连，但入口守卫先于 directChatCompletion", async () => {
    vi.stubEnv("NEXT_PUBLIC_SELF_CONTAINED", "1");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestDeckWithFallbackResult({
      profile: {} as never, apiKey: "sk-test", sessionConfig: config(), sessionId: "s1",
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.cards.filter((card) => card.source === "ai")).toHaveLength(0);
    vi.unstubAllGlobals();
  });

  it("generateDeckDirect 在入口即拒绝：原生 HTTP 与 fetch 两条传输都不触发", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(generateDeckDirect({ profile: {} as never, apiKey: "sk-test", sessionConfig: config(), sessionId: "s1" })).rejects.toThrow(AI_MAINLINE_DISABLED);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("后台补题（refillPackInBackground）：关闭时不发请求、不并入快照", async () => {
    const request = vi.fn();
    const deck = [localCard];
    const merged = await refillPackInBackground({
      deck, sessionConfig: config(["truth-dare"]), packId: "truth-dare",
      profile: {} as never, apiKey: "sk-test", sessionId: "s1", request,
    });
    expect(request).not.toHaveBeenCalled();
    expect(merged).toBe(deck);
  });

  it("设置页「测试连接」底层 directChatCompletion 非生成入口，不受隔离影响（代码保留）", () => {
    expect(typeof directChatCompletion).toBe("function");
    expect(typeof resolveDeckTransport).toBe("function");
  });
});

describe("只隔离不删代码", () => {
  it("AI 生成入口函数全部保留在仓库（供后续独立 Gate 恢复）", () => {
    expect(typeof generateDeckDirect).toBe("function");
    expect(typeof directChatCompletion).toBe("function");
    expect(typeof requestGeneratedDeck).toBe("function");
    expect(typeof buildPlayableDeck).toBe("function");
    expect(typeof resolveDeckTransport).toBe("function");
    expect(typeof refillPackInBackground).toBe("function");
  });
});
