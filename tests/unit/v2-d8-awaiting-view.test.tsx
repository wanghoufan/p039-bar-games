import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * D8 严格方案 A · /game 渲染优先级与洗牌按钮有效性（P1-D8-AWAITING-EXIT）。
 *
 * 断言：
 *  - awaiting 时看不到「洗牌再玩」按钮或占位（预检无卡时）；
 *  - 渲染优先级 awaitingHostDecision > cardless/normal-empty > PACK_EXHAUSTED / GLOBAL_EXHAUSTED：
 *    awaiting 时不显示 cardless 页、不显示切包入口（禁第三种 Host 状态迁移）。
 */

const mocks = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn(), list: vi.fn(), replace: vi.fn(), push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, push: mocks.push }),
  useSearchParams: () => new URLSearchParams("session=s1"),
}));
vi.mock("@/lib/storage/session-repository", () => ({
  sessionRepository: { get: mocks.get, save: mocks.save },
  createSessionAutosave: () => ({ save: mocks.save, flush: async () => undefined }),
}));
vi.mock("@/lib/storage/game-pack-repository", () => ({ gamePackRepository: { list: mocks.list } }));

import GamePage from "@/app/game/page";
import { DEFAULT_BOUNDARIES } from "@/lib/domain/constants";
import type { GameCard, SessionConfig } from "@/lib/domain/schemas";
import { completeRound, createSession, startRound } from "@/lib/engine/session-engine";

const config = (): SessionConfig => ({
  players: ["a", "b", "c"].map((id) => ({ id, displayName: `玩家${id}`, active: true, createdAt: "x", lastUsedAt: "x" })),
  relationship: "friends", vibes: ["funny"], intensity: 3,
  boundaries: DEFAULT_BOUNDARIES, enabledPackIds: ["truth-dare"], mode: "single",
});

const localCards: GameCard[] = [1, 2].map((n) => ({
  id: `local-${n}`, packId: "truth-dare", type: "truth", content: `本地题 ${n}`,
  intensity: 1, tags: [], boundaryTags: [], minPlayers: 2, participantMode: "all", source: "builtin",
}));

/** 出到 awaiting：牌堆有卡 → 洗牌有效；牌堆为空 → 洗牌无效。 */
function awaitingSession(deck: GameCard[]) {
  const created = deck.length ? createSession(config(), deck) : { ...createSession(config(), []), status: "active" as const };
  let session = startRound(created, () => 0);
  if (session.currentRound) session = completeRound(session);
  session = startRound(session, () => 0);
  if (session.currentRound) session = completeRound(session);
  return startRound(session, () => 0);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.save.mockResolvedValue(undefined);
  mocks.list.mockResolvedValue([]);
});

afterEach(() => vi.clearAllMocks());

describe("D8 严格 A · awaiting 渲染", () => {
  it("洗牌有效：只给「结束本局 / 洗牌再玩」二选一，不显示切包入口", async () => {
    mocks.get.mockResolvedValue(awaitingSession(localCards));
    render(<GamePage />);

    expect(await screen.findByRole("dialog", { name: "可玩的题都出完了" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "洗牌再玩" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "结束本局" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /切换玩法/ })).toBeNull();
    expect(document.querySelector(".pack-switch-entry")).toBeNull();
  });

  it("预检无卡：不显示无效的「洗牌再玩」按钮或占位，只给中性说明 + 结束本局", async () => {
    mocks.get.mockResolvedValue(awaitingSession([]));
    render(<GamePage />);

    expect(await screen.findByText("当前条件下没有可继续的合法题，本局到此为止。")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "洗牌再玩" })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "结束本局" })).toBeInTheDocument();
    // 严格 A：不提供「切换玩法」这第三条出口
    expect(screen.queryByRole("button", { name: /切换玩法/ })).toBeNull();
    expect(document.querySelector(".pack-switch-entry")).toBeNull();
  });

  it("渲染优先级：awaiting + cardless（转瓶子）时仍渲染 awaiting 分支，不显示 cardless 页与切包入口", async () => {
    mocks.get.mockResolvedValue({ ...awaitingSession([]), currentPackId: "spin-bottle" });
    const { container } = render(<GamePage />);

    expect(await screen.findByText("当前条件下没有可继续的合法题，本局到此为止。")).toBeInTheDocument();
    // cardless 玩法视图（转瓶子）没有被渲染
    expect(container.querySelector(".spin-bottle")).toBeNull();
    expect(screen.queryByText(/纯本地随机/)).toBeNull();
    expect(screen.queryByRole("button", { name: /切换玩法/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "洗牌再玩" })).toBeNull();
  });
});
