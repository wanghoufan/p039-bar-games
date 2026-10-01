import { describe, expect, it } from "vitest";
import {
  EXIT_GUARD_ARMED_ATTR,
  EXIT_GUARD_EARLY_GLOBAL,
  EXIT_GUARD_INIT_SCRIPT,
  EXIT_GUARD_SENTINEL_DEPTH,
  EXIT_GUARD_STATE_KEY,
  readEntryDepth,
  type ExitGuardEarly,
} from "@/lib/system/exit-guard";

/**
 * Change A 返工（EXIT-GUARD-001）：head 内联脚本的幂等性与交接行为。
 *
 * 用 `new Function` 跑**仓库里真正装箱的那段脚本源码**（不是复刻品），宿主是手写的最小
 * window/history/document 桩，这样「脚本跑两次会不会压出两条哨兵」「没交接前连按会不会出站」
 * 都能被断言，而不是只能靠浏览器行为间接观察。
 */

type EntryState = Record<string, unknown> | null;
type Entry = { state: EntryState; url: string };
type PopListener = (event: { state: EntryState }) => void;

function createHost(options: { storageThrows?: boolean; initialState?: EntryState } = {}) {
  const stack: Entry[] = [{ state: options.initialState ?? { __NA: true }, url: "http://127.0.0.1:3000/setup/" }];
  let index = 0;
  let pushed = 0;
  let replaced = 0;
  const listeners = new Map<string, PopListener[]>();
  const attributes = new Map<string, string>();

  const history = {
    get state(): EntryState { return stack[index].state; },
    get length(): number { return stack.length; },
    pushState(state: EntryState, _title: string, url?: string) {
      pushed += 1;
      stack.splice(index + 1);
      stack.push({ state, url: url ?? stack[index].url });
      index = stack.length - 1;
    },
    replaceState(state: EntryState, _title: string, url?: string) {
      replaced += 1;
      stack[index] = { state, url: url ?? stack[index].url };
    },
  };

  const win = {
    history,
    location: { href: stack[0].url },
    addEventListener(type: string, fn: PopListener) {
      listeners.set(type, [...(listeners.get(type) ?? []), fn]);
    },
    removeEventListener(type: string, fn: PopListener) {
      listeners.set(type, (listeners.get(type) ?? []).filter((item) => item !== fn));
    },
    localStorage: {
      setItem() {
        if (options.storageThrows) throw new Error("storage disabled");
      },
    },
  } as unknown as Record<string, unknown>;

  const documentStub = {
    documentElement: {
      getAttribute: (name: string) => attributes.get(name) ?? null,
      setAttribute: (name: string, value: string) => { attributes.set(name, value); },
    },
  };

  const run = () => new Function("window", "document", EXIT_GUARD_INIT_SCRIPT)(win, documentStub);

  return {
    run,
    get pushed() { return pushed; },
    get replaced() { return replaced; },
    get historyLength() { return stack.length; },
    get currentDepth() { return readEntryDepth(history.state); },
    entryDepth(i: number) { return readEntryDepth(stack[i].state); },
    entryState(i: number) { return stack[i].state; },
    get armed() { return attributes.get(EXIT_GUARD_ARMED_ATTR); },
    early: () => win[EXIT_GUARD_EARLY_GLOBAL] as ExitGuardEarly | undefined,
    /** 模拟一次浏览器返回：退到上一条历史条目并派发 popstate。 */
    back() {
      if (index === 0) return false;
      index -= 1;
      for (const fn of listeners.get("popstate") ?? []) fn({ state: stack[index].state });
      return true;
    },
  };
}

describe("head 内联脚本：压哨兵 + 打标记", () => {
  it("跑一次：入口条目深度 0、哨兵深度 1，并打上 armed 标记（保留宿主自己的 state 键）", () => {
    const host = createHost();
    host.run();

    expect(host.replaced).toBe(1);
    expect(host.pushed).toBe(1);
    expect(host.historyLength).toBe(2);
    expect(host.entryDepth(0)).toBe(0);
    expect(host.entryDepth(1)).toBe(EXIT_GUARD_SENTINEL_DEPTH);
    expect(host.entryState(0)).toMatchObject({ __NA: true, [EXIT_GUARD_STATE_KEY]: 0 });
    expect(host.armed).toBe("1");
    expect(host.early()?.depth).toBe(EXIT_GUARD_SENTINEL_DEPTH);
  });

  it("全新导航（state 为 null）：入口条目补上 __NA，否则 Next 的 popstate 会整页 reload", () => {
    const host = createHost({ initialState: null });
    host.run();

    expect(host.entryState(0)).toMatchObject({ __NA: true, [EXIT_GUARD_STATE_KEY]: 0 });
    // 哨兵同样带 __NA：它才是「从子页返回顶页」的落点
    expect(host.entryState(1)).toMatchObject({ __NA: true, [EXIT_GUARD_STATE_KEY]: EXIT_GUARD_SENTINEL_DEPTH });
  });

  it("同一文档里跑两次：不再压第二条哨兵、也不再重打标（幂等）", () => {
    const host = createHost();
    host.run();
    host.run();

    expect(host.replaced).toBe(1);
    expect(host.pushed).toBe(1);
    expect(host.historyLength).toBe(2);
    expect(host.currentDepth).toBe(EXIT_GUARD_SENTINEL_DEPTH);
  });

  it("存储不可用（隐私模式）：扔异常也不白屏，哨兵与标记照样装好", () => {
    const host = createHost({ storageThrows: true });
    expect(() => host.run()).not.toThrow();
    expect(host.armed).toBe("1");
    expect(host.pushed).toBe(1);
    expect(host.entryDepth(1)).toBe(EXIT_GUARD_SENTINEL_DEPTH);
  });
});

describe("head 内联脚本：React 接管前的临时保护", () => {
  it("接管前按返回：落在站内入口条目上，脚本立刻把哨兵补回去（到不了 about:blank）", () => {
    const host = createHost();
    host.run();
    const pushedBefore = host.pushed;

    expect(host.back()).toBe(true);
    expect(host.entryDepth(1)).toBe(EXIT_GUARD_SENTINEL_DEPTH);
    expect(host.currentDepth).toBe(EXIT_GUARD_SENTINEL_DEPTH);
    expect(host.historyLength).toBe(2);
    expect(host.pushed).toBe(pushedBefore + 1);
    expect(host.early()?.pending).toBe(true);

    // 连按第二下：依然被兜在站内
    expect(host.back()).toBe(true);
    expect(host.currentDepth).toBe(EXIT_GUARD_SENTINEL_DEPTH);
    expect(host.historyLength).toBe(2);
  });

  it("React 接管后（taken）：脚本不再插手，也不再多压哨兵", () => {
    const host = createHost();
    host.run();
    const early = host.early()!;
    early.taken = true;
    const pushedBefore = host.pushed;

    host.back();
    expect(host.pushed).toBe(pushedBefore);
    expect(early.pending).toBe(false);
  });

  it("detach 后监听摘掉：返回不再被脚本接管（判定权完整交给 React）", () => {
    const host = createHost();
    host.run();
    const early = host.early()!;
    early.detach?.();

    host.back();
    expect(early.pending).toBe(false);
    expect(host.pushed).toBe(1);
  });
});
