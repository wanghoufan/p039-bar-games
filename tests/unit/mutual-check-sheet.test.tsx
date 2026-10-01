import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { MutualCheckSheet, type MutualCheckPlayer } from "@/components/game/MutualCheckSheet";
import { singleAnchorPlayerId } from "@/lib/v2-relationship/v2-routing";
import { createInitialRelationshipState, type SessionParticipant } from "@/lib/v2-relationship/v2-state";

/* ------------------------------------------------------------------ */
/* 装置：4 人 2 男 2 女，合法边 p1::p2 / p1::p4 / p2::p3 / p3::p4          */
/* ------------------------------------------------------------------ */

const participants: SessionParticipant[] = [
  { playerId: "p1", active: true, pairGender: "male" },
  { playerId: "p2", active: true, pairGender: "female" },
  { playerId: "p3", active: true, pairGender: "male" },
  { playerId: "p4", active: true, pairGender: "female" },
];

const players: MutualCheckPlayer[] = [
  { id: "p1", displayName: "小A" },
  { id: "p2", displayName: "小B" },
  { id: "p3", displayName: "小C" },
  { id: "p4", displayName: "小D" },
];

const renderSheet = (table: SessionParticipant[], list: MutualCheckPlayer[]) => {
  const onFinished = vi.fn();
  const onCancelled = vi.fn();
  const view = (t: SessionParticipant[], l: MutualCheckPlayer[]) => (
    <MutualCheckSheet
      open
      players={l}
      participants={t}
      checkpoint={12}
      relationship={createInitialRelationshipState()}
      onFinished={onFinished}
      onCancelled={onCancelled}
    />
  );
  const { rerender, unmount } = render(view(table, list));
  return {
    onFinished,
    onCancelled,
    unmount,
    rerender: (t: SessionParticipant[], l: MutualCheckPlayer[] = list) => rerender(view(t, l)),
  };
};

const tap = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));

/** 交接遮罩零点击：推进定时器进入下一位 / 结果页。 */
const advanceMask = () => { act(() => { vi.advanceTimersByTime(1400); }); };

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe("MutualCheckSheet（RG-01 每人只点一次）", () => {
  it("单候选：标题点名对方昵称（不再有裸「TA」），点「愿意」一次即提交", () => {
    // 1男3女：f1（小美）先答，唯一候选 m1（阿豪）
    const table: SessionParticipant[] = [
      { playerId: "f1", active: true, pairGender: "female" },
      { playerId: "m1", active: true, pairGender: "male" },
      { playerId: "f2", active: true, pairGender: "female" },
      { playerId: "f3", active: true, pairGender: "female" },
    ];
    const names: MutualCheckPlayer[] = [
      { id: "f1", displayName: "小美" },
      { id: "m1", displayName: "阿豪" },
      { id: "f2", displayName: "小丽" },
      { id: "f3", displayName: "小雅" },
    ];
    renderSheet(table, names);

    expect(screen.getByText("今晚到现在，你愿意继续了解 阿豪 吗？")).toBeInTheDocument();
    expect(screen.queryByText(/愿意继续了解 TA/)).toBeNull();
    expect(screen.getByRole("button", { name: "愿意" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "暂时没有" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "提交" })).toBeNull();

    // 一次点击即提交：直接进交接遮罩，不出现「已提交」「答案已隐藏」中间页
    tap("愿意");
    expect(screen.getByText("已收起。")).toBeInTheDocument();
    expect(screen.queryByText("已提交")).toBeNull();
    expect(screen.queryByText("答案已隐藏")).toBeNull();

    advanceMask();
    // 下一位（阿豪）从自己的 SELECT 重新起步
    expect(screen.getByText("请把手机交给 阿豪，其他人别看屏幕。")).toBeInTheDocument();
    expect(screen.getByText("今晚到现在，你最想继续了解谁？")).toBeInTheDocument();
  });

  it("多候选：点昵称即提交，无「提交」按钮与「只选一个人，或跳过」旧文案", () => {
    renderSheet(participants, players);

    expect(screen.getByText("今晚到现在，你最想继续了解谁？")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "小B" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "小D" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "提交" })).toBeNull();
    expect(screen.queryByText("只选一个人，或跳过")).toBeNull();

    // 点昵称即选中并立即提交
    tap("小B");
    expect(screen.getByText("已收起。")).toBeInTheDocument();
    expect(screen.queryByText("已提交")).toBeNull();
    expect(screen.queryByText("答案已隐藏")).toBeNull();
  });

  it("交接遮罩无按钮、自动进下一位；下一位从自己的 SELECT 重新起步（不复用上一位选中态）", () => {
    renderSheet(participants, players);

    tap("小D"); // 小A 选小D（不是下一位小B，便于断言不回显答案）
    // 遮罩零按钮
    expect(screen.getByRole("dialog", { name: "交接遮罩" })).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    // 不回显所选对象：遮罩只写交接对象（下一位小B），不出现答案「小D」
    expect(screen.getByText("请把手机交给 小B")).toBeInTheDocument();
    expect(screen.queryByText("小D")).toBeNull();

    advanceMask();
    expect(screen.getByText("请把手机交给 小B，其他人别看屏幕。")).toBeInTheDocument();
    // 小B 的候选快照是全新的（小A/小C），不存在上一位的选中痕迹
    expect(screen.getByRole("button", { name: "小A" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "小C" })).toBeInTheDocument();
    expect(document.querySelector(".mutual-choice--on")).toBeNull();
  });

  it("关闭/卸载即清掉交接定时器：不会自动收束、不产生结果", () => {
    const { unmount, onFinished, onCancelled } = renderSheet(participants, players);
    tap("小B");
    expect(screen.getByText("已收起。")).toBeInTheDocument();

    unmount();
    expect(() => { act(() => { vi.advanceTimersByTime(10000); }); }).not.toThrow();
    expect(onFinished).not.toHaveBeenCalled();
    expect(onCancelled).not.toHaveBeenCalled();
  });

  it("最后一位提交后遮罩写「交还主持人」，随后自动进结果页", () => {
    renderSheet(participants, players);
    for (let index = 0; index < players.length; index += 1) {
      tap("暂时没有");
      if (index < players.length - 1) {
        advanceMask();
        expect(screen.getByText(new RegExp(`请把手机交给 (小[BCD])，其他人别看屏幕`))).toBeInTheDocument();
      }
    }
    // 最后一位：交还主持人，自动进 RESULTS
    expect(screen.getByText("请把手机交还主持人")).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    advanceMask();
    expect(screen.getByText("本轮已完成，继续游戏")).toBeInTheDocument();
  });

  it("全部完成后只公布双方互选的结果", () => {
    const { onFinished } = renderSheet(participants, players);
    tap("小B"); advanceMask(); // 小A → 小B
    tap("小A"); advanceMask(); // 小B → 小A
    tap("暂时没有"); advanceMask(); // 小C 跳过
    tap("暂时没有"); advanceMask(); // 小D 跳过（末位 → 交还主持人）

    expect(screen.getByText("互选成功")).toBeInTheDocument();
    expect(screen.getByText("小A × 小B")).toBeInTheDocument();
    expect(screen.queryByText("小C")).toBeNull();
    expect(screen.queryByText("小D")).toBeNull();

    tap("继续游戏");
    expect(onFinished).toHaveBeenCalledTimes(1);
    const payload = onFinished.mock.calls[0]![0];
    expect(payload.checkpoint).toBe(12);
    expect(payload.runId).toBeTruthy();
    expect(payload.matches).toEqual([{ pairKey: "p1::p2", playerIds: ["p1", "p2"] }]);
  });

  it("无人互选：只给中性文案，不公开任何参与者", () => {
    const { onFinished } = renderSheet(participants, players);
    for (let index = 0; index < players.length; index += 1) {
      tap("暂时没有");
      advanceMask();
    }

    expect(screen.getByText("本轮已完成，继续游戏")).toBeInTheDocument();
    for (const player of players) expect(screen.queryByText(player.displayName)).toBeNull();

    tap("继续游戏");
    expect(onFinished.mock.calls[0]![0].matches).toEqual([]);
  });

  it("取消本轮：不产生结果、不计一次常规互选", () => {
    const { onCancelled, onFinished } = renderSheet(participants, players);
    tap("取消本轮");
    expect(onCancelled).toHaveBeenCalledTimes(1);
    expect(onFinished).not.toHaveBeenCalled();
  });

  it("候选数 = 0：「跳过」+「取消本轮」两个按钮，点了进交接遮罩", () => {
    // 全男桌：无合法异性边，人人零候选
    const table: SessionParticipant[] = [
      { playerId: "m1", active: true, pairGender: "male" },
      { playerId: "m2", active: true, pairGender: "male" },
    ];
    const names: MutualCheckPlayer[] = [
      { id: "m1", displayName: "阿强" },
      { id: "m2", displayName: "阿伟" },
    ];
    renderSheet(table, names);

    expect(screen.getByText("暂时没有可选的人")).toBeInTheDocument();
    expect(screen.getByText("对方现在不在可选范围内，先跳过吧。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "跳过" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "取消本轮" })).toBeInTheDocument();

    tap("跳过");
    expect(screen.getByText("已收起。")).toBeInTheDocument();
    expect(screen.getByText("请把手机交给 阿伟")).toBeInTheDocument();
  });

  it("候选数 = 0：取消本轮同样收场，不产生结果", () => {
    const table: SessionParticipant[] = [
      { playerId: "m1", active: true, pairGender: "male" },
      { playerId: "m2", active: true, pairGender: "male" },
    ];
    const names: MutualCheckPlayer[] = [
      { id: "m1", displayName: "阿强" },
      { id: "m2", displayName: "阿伟" },
    ];
    const { onCancelled, onFinished } = renderSheet(table, names);
    tap("取消本轮");
    expect(onCancelled).toHaveBeenCalledTimes(1);
    expect(onFinished).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/* R-CB9｜Mutual UI 按「当前合法异性候选数」分支（与 Single-Anchor Guard 解耦）  */
/* ------------------------------------------------------------------ */

const male = (playerId: string, active = true): SessionParticipant => ({ playerId, active, pairGender: "male" });
const female = (playerId: string, active = true): SessionParticipant => ({ playerId, active, pairGender: "female" });
const named = (entries: readonly (readonly [string, string])[]): MutualCheckPlayer[] =>
  entries.map(([id, displayName]) => ({ id, displayName }));

/** 1男2女：3 人桌，Single-Anchor Guard 不触发（max=2 < 3）。 */
const SMALL_TABLE: SessionParticipant[] = [female("f1"), male("m1"), female("f2")];
const SMALL_NAMES = named([["f1", "小美"], ["m1", "阿豪"], ["f2", "小丽"]]);

describe("MutualCheckSheet｜R-CB9 单候选 Yes/No 与多人候选 UI 分支", () => {
  it("1男2女（Guard 不触发）多数方唯一候选 → 仍用 Yes/No，证明 UI 与 Guard 解耦", () => {
    expect(singleAnchorPlayerId(SMALL_TABLE)).toBeNull(); // Guard=false
    renderSheet(SMALL_TABLE, SMALL_NAMES);
    expect(screen.getByText("今晚到现在，你愿意继续了解 阿豪 吗？")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "愿意" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "暂时没有" })).toBeInTheDocument();
  });

  it("愿意 → 映射到唯一候选：双方愿意才成 MATCH", () => {
    const table = [female("f1"), male("m1")];
    const names = named([["f1", "小美"], ["m1", "阿豪"]]);
    const { onFinished } = renderSheet(table, names);

    tap("愿意");
    advanceMask();
    tap("愿意");
    advanceMask();

    expect(screen.getByText("互选成功")).toBeInTheDocument();
    expect(screen.getByText("小美 × 阿豪")).toBeInTheDocument();
    tap("继续游戏");
    expect(onFinished.mock.calls[0]![0].matches).toEqual([{ pairKey: "f1::m1", playerIds: ["f1", "m1"] }]);
  });

  it("暂时没有 → null：单向不成立、不公开任何结果", () => {
    const table = [female("f1"), male("m1")];
    const names = named([["f1", "小美"], ["m1", "阿豪"]]);
    const { onFinished } = renderSheet(table, names);

    tap("暂时没有");
    advanceMask();
    tap("愿意");
    advanceMask();

    expect(screen.getByText("本轮已完成，继续游戏")).toBeInTheDocument();
    expect(screen.queryByText("互选成功")).toBeNull();
    tap("继续游戏");
    expect(onFinished.mock.calls[0]![0].matches).toEqual([]);
  });

  it("唯一候选在提交前失效（暂离/候选变化）→ 拒绝提交并给可读提示，不产生非法 MATCH", () => {
    const table = [female("f1"), male("m1")];
    const names = named([["f1", "小美"], ["m1", "阿豪"]]);
    const { rerender, onFinished } = renderSheet(table, names);

    expect(screen.getByRole("button", { name: "愿意" })).toBeInTheDocument();

    // 作答期间 m1 暂离：真实合法边消失，快照里的唯一候选已失效
    rerender([female("f1"), male("m1", false)]);
    tap("愿意");

    expect(screen.getByText("对方现在不在可选范围内，先跳过吧。")).toBeInTheDocument();
    // 仍停在选择页：没有提交、没有公开结果
    expect(screen.getByRole("button", { name: "愿意" })).toBeInTheDocument();
    expect(screen.queryByText("已收起。")).toBeNull();

    // 走完流程：失效目标只能按「暂时没有」（= null）收场，最终空结果，不产生非法 MATCH
    tap("暂时没有");
    advanceMask();
    tap("跳过"); // m1 已暂离，零候选屏
    advanceMask();
    tap("继续游戏");
    expect(onFinished.mock.calls[0]![0].matches).toEqual([]);
  });

  it("R-CB10：run 中途 roster 变化产生的新 pair → 拒绝提交、给可读提示、留在原屏", () => {
    // 初始 1男1女在场（f2 未激活）：合法边只有 f1::m1
    const table: SessionParticipant[] = [female("f1"), male("m1"), female("f2", false)];
    const names: MutualCheckPlayer[] = [
      { id: "f1", displayName: "小美" },
      { id: "m1", displayName: "阿豪" },
      { id: "f2", displayName: "小丽" },
    ];
    const { rerender, onFinished } = renderSheet(table, names);

    // 小美（唯一候选阿豪）点「愿意」→ run 在此刻定格（pairRuns 只有 f1::m1）
    tap("愿意");

    // 阿豪的 SELECT 建立前 f2 激活：真实合法边多出 m1::f2，但不在 run 快照里
    // （rerender 必须在遮罩推进前生效——candidates 快照在推进瞬间按最新参与者定格）
    rerender([female("f1"), male("m1"), female("f2")]);
    advanceMask();

    expect(screen.getByRole("button", { name: "小丽" })).toBeInTheDocument();

    // 点新 pair 的对象（小丽）：提交前校验拦下，不给静默降级为跳过
    tap("小丽");
    expect(screen.getByText("对方现在不在可选范围内，先跳过吧。")).toBeInTheDocument();
    expect(screen.queryByText("已收起。")).toBeNull();
    expect(screen.getByRole("button", { name: "小丽" })).toBeInTheDocument();

    // 只能按「暂时没有」收场；最终不产生任何 MATCH
    tap("暂时没有");
    advanceMask();
    tap("暂时没有"); // 小丽的唯一候选是阿豪（单候选屏）
    advanceMask();
    tap("继续游戏");
    expect(onFinished.mock.calls[0]![0].matches).toEqual([]);
  });
});
