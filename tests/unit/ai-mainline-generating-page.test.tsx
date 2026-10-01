import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * 入口② app/generating/page.tsx：AI 隔离期间进入 generating 阶段必须给中性提示，
 * 不读 Provider/Key、不发任何生成请求（服务端 / 直连都不发），不白屏、不卡在加载态。
 * 组局页也是「旧缓存 / 恢复路径」的落点（resume / summary 重开 / 重试一次都经 generate()）。
 */

const mocks = vi.hoisted(() => ({
  get: vi.fn(), save: vi.fn(), list: vi.fn(),
  ensurePresets: vi.fn(), getSecret: vi.fn(), preferencesGet: vi.fn(),
  replace: vi.fn(), push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, push: mocks.push }),
  useSearchParams: () => new URLSearchParams("session=s1"),
}));
vi.mock("@/lib/storage/session-repository", () => ({ sessionRepository: { get: mocks.get, save: mocks.save } }));
vi.mock("@/lib/storage/game-pack-repository", () => ({ gamePackRepository: { list: mocks.list } }));
vi.mock("@/lib/storage/ai-provider-repository", () => ({
  aiProviderRepository: { ensurePresets: mocks.ensurePresets, getSecret: mocks.getSecret, listProfiles: vi.fn(async () => []) },
}));
vi.mock("@/lib/storage/preferences-repository", () => ({ preferencesRepository: { get: mocks.preferencesGet, save: vi.fn() } }));

import GeneratingPage from "@/app/generating/page";

const session = {
  id: "s1", status: "generating", mode: "mixed",
  config: { players: [{ id: "a", displayName: "A", active: true }, { id: "b", displayName: "B", active: true }] },
  deckSnapshot: [], usedCardIds: [], rounds: [], currentPackId: "truth-dare", currentSegmentId: "seg", currentPackState: {}, recentRejectedFingerprints: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AI_MAINLINE_ENABLED", "false");
  mocks.get.mockResolvedValue(session);
  mocks.save.mockResolvedValue(undefined);
  mocks.list.mockResolvedValue([]);
});

afterEach(() => vi.unstubAllEnvs());

describe("generating 入口 AI 隔离", () => {
  it("开关关闭：给中性提示并可一步走本地题库，不发任何生成请求、不卡在加载态", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<GeneratingPage />);

    expect(await screen.findByRole("heading", { name: "本次使用本地固定题库" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "使用本地题库开始" })).toBeInTheDocument();
    // 不卡在 generating 加载态、不引导去配置 AI
    expect(screen.queryByText(/AI 正在为你准备/)).toBeNull();
    expect(screen.queryByRole("link", { name: "去配置 AI 接口" })).toBeNull();
    expect(screen.queryByRole("button", { name: "重试一次" })).toBeNull();
    // 未读 Provider/Key、未发服务端或直连请求
    expect(mocks.ensurePresets).not.toHaveBeenCalled();
    expect(mocks.getSecret).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
