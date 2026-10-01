import { describe, expect, it } from "vitest";
import {
  EXIT_GUARD_ENTRY_DEPTH,
  EXIT_GUARD_SENTINEL_DEPTH,
  EXIT_GUARD_STATE_KEY,
  decideExitGuardAction,
  planExitGuardTakeover,
  readEntryDepth,
  reduceExitGuard,
  stampDepth,
  type ExitGuardState,
} from "@/lib/system/exit-guard";

/**
 * Change A：返回键退出确认的判据与状态机（纯逻辑）。
 * 关键验收点是「有上一层就绝不拦」——本文件的 allow 这些用例就是它的证据。
 */

const closed: ExitGuardState = { dialogOpen: false };
const open: ExitGuardState = { dialogOpen: true };

describe("条目深度标记", () => {
  it("打标后读得回深度，且保留宿主（Next）自己的状态键", () => {
    const stamped = stampDepth({ __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: { tree: [] } }, 3);
    expect(readEntryDepth(stamped)).toBe(3);
    expect(stamped.__NA).toBe(true);
    expect(stamped.__PRIVATE_NEXTJS_INTERNALS_TREE).toEqual({ tree: [] });
  });

  it("没有本 App 标记的条目（界外/浏览器初始条目）读作 null", () => {
    expect(readEntryDepth(null)).toBeNull();
    expect(readEntryDepth(undefined)).toBeNull();
    expect(readEntryDepth({ __NA: true })).toBeNull();
    expect(readEntryDepth({ [EXIT_GUARD_STATE_KEY]: "0" })).toBeNull();
  });
});

describe("单次返回的判定", () => {
  it("顶层（落到 App 入口深度 0）→ 请求退出确认", () => {
    expect(decideExitGuardAction({ dialogOpen: false, landedDepth: EXIT_GUARD_ENTRY_DEPTH })).toBe("confirm");
  });

  it("落到 App 之外（无标记）→ 也算要离开，请求退出确认", () => {
    expect(decideExitGuardAction({ dialogOpen: false, landedDepth: null })).toBe("confirm");
  });

  it("有上一层（组局页→首页、局内子页→上一页）→ 不拦，照旧回退", () => {
    expect(decideExitGuardAction({ dialogOpen: false, landedDepth: 2 })).toBe("allow");
    expect(decideExitGuardAction({ dialogOpen: false, landedDepth: 9 })).toBe("allow");
  });

  it("落到哨兵条目（深度 1）也算 App 内 → 不拦", () => {
    expect(decideExitGuardAction({ dialogOpen: false, landedDepth: EXIT_GUARD_SENTINEL_DEPTH })).toBe("allow");
  });

  it("确认框已开时再按返回 → 只关框，不退出", () => {
    expect(decideExitGuardAction({ dialogOpen: true, landedDepth: EXIT_GUARD_ENTRY_DEPTH })).toBe("dismiss");
    expect(decideExitGuardAction({ dialogOpen: true, landedDepth: null })).toBe("dismiss");
  });
});

describe("装配决策：接管 head 内联脚本已压好的哨兵", () => {
  it("已 armed：不重复压哨兵，且当前条目按哨兵深度起算（不做成入口条目）", () => {
    expect(planExitGuardTakeover({ armedByInitScript: true, earlyDepth: EXIT_GUARD_SENTINEL_DEPTH, stateDepth: EXIT_GUARD_SENTINEL_DEPTH }))
      .toEqual({ currentDepth: EXIT_GUARD_SENTINEL_DEPTH, needsSentinel: false });
  });

  it("已 armed：条目上的深度更浅（宿主重写过 state）时仍以「当前是哨兵」为准，不许当成入口", () => {
    expect(planExitGuardTakeover({ armedByInitScript: true, earlyDepth: null, stateDepth: EXIT_GUARD_ENTRY_DEPTH }))
      .toEqual({ currentDepth: EXIT_GUARD_SENTINEL_DEPTH, needsSentinel: false });
    expect(planExitGuardTakeover({ armedByInitScript: true, earlyDepth: null, stateDepth: null }))
      .toEqual({ currentDepth: EXIT_GUARD_SENTINEL_DEPTH, needsSentinel: false });
  });

  it("已 armed：深度以交接对象为准（刷新落在更深的条目上时不把深度拉回 1）", () => {
    expect(planExitGuardTakeover({ armedByInitScript: true, earlyDepth: 3, stateDepth: null }))
      .toEqual({ currentDepth: 3, needsSentinel: false });
  });

  it("没 armed（内联脚本没跑成）：沿用上一版做法自建入口标记 + 哨兵", () => {
    expect(planExitGuardTakeover({ armedByInitScript: false, earlyDepth: null, stateDepth: null }))
      .toEqual({ currentDepth: EXIT_GUARD_ENTRY_DEPTH, needsSentinel: true });
    expect(planExitGuardTakeover({ armedByInitScript: false, earlyDepth: 5, stateDepth: 5 }).needsSentinel).toBe(true);
  });

  it("接管后的深度判定不偏：App 内上一页照旧回退，退到入口才弹框", () => {
    const { currentDepth, needsSentinel } = planExitGuardTakeover({ armedByInitScript: true, earlyDepth: 2, stateDepth: 2 });
    expect(currentDepth).toBe(2);
    expect(needsSentinel).toBe(false);
    // 从深度 2 退回 1：App 内正常回退，不弹框
    expect(decideExitGuardAction({ dialogOpen: false, landedDepth: currentDepth - 1 })).toBe("allow");
    // 退到入口（0）：这才弹框
    expect(decideExitGuardAction({ dialogOpen: false, landedDepth: EXIT_GUARD_ENTRY_DEPTH })).toBe("confirm");
  });
});

describe("弹框状态机", () => {
  it("顶层返回 → 打开确认框（effect=open）", () => {
    const result = reduceExitGuard(closed, { kind: "back", landedDepth: 0 });
    expect(result.state).toEqual({ dialogOpen: true });
    expect(result.effect).toBe("open");
  });

  it("有上一层的返回 → 状态与副作用都不动（不弹框、不多一次点击）", () => {
    const result = reduceExitGuard(closed, { kind: "back", landedDepth: 3 });
    expect(result.state).toBe(closed);
    expect(result.effect).toBe("none");
  });

  it("取消 → 关框且不退出（effect=close，绝不 exit）", () => {
    const result = reduceExitGuard(open, { kind: "cancel" });
    expect(result.state).toEqual({ dialogOpen: false });
    expect(result.effect).toBe("close");
  });

  it("点「退出」→ 只在框开着时触发一次 exit", () => {
    expect(reduceExitGuard(open, { kind: "confirm" })).toEqual({ state: { dialogOpen: false }, effect: "exit" });
    // 框已关时重复点（连点/重放）不再产生第二次退出
    expect(reduceExitGuard(closed, { kind: "confirm" })).toEqual({ state: { dialogOpen: false }, effect: "none" });
  });

  it("连点返回：只弹一次框，第二次是关框，全程不退出", () => {
    const first = reduceExitGuard(closed, { kind: "back", landedDepth: 0 });
    const second = reduceExitGuard(first.state, { kind: "back", landedDepth: 0 });
    expect(first.effect).toBe("open");
    expect(second.effect).toBe("close");
    expect(second.state).toEqual({ dialogOpen: false });
    expect([first.effect, second.effect]).not.toContain("exit");
  });

  it("连点后第三次返回 → 重新弹框（仍在顶层，不会变成静默退出）", () => {
    const first = reduceExitGuard(closed, { kind: "back", landedDepth: 0 });
    const second = reduceExitGuard(first.state, { kind: "back", landedDepth: 0 });
    const third = reduceExitGuard(second.state, { kind: "back", landedDepth: 0 });
    expect(third.effect).toBe("open");
  });
});
