"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  EXIT_GUARD_ARMED_ATTR,
  EXIT_GUARD_EARLY_GLOBAL,
  EXIT_GUARD_ENTRY_DEPTH,
  EXIT_GUARD_SENTINEL_DEPTH,
  planExitGuardTakeover,
  readEntryDepth,
  reduceExitGuard,
  stampDepth,
  type ExitGuardEarly,
  type ExitGuardEvent,
  type ExitGuardState,
} from "@/lib/system/exit-guard";

/**
 * 返回键退出确认（Change A）。
 *
 * 只在「再往回就离开 App」的那一层拦：
 * - Web/PWA：history 哨兵 + popstate。哨兵由 head 的 beforeInteractive 内联脚本在首屏解析时
 *   就压好（冷启动直开深路由也一样），这里只**接管**这条已存在的哨兵：按它的真实深度起算，
 *   绝不重复压第二条、也绝不把哨兵当成入口条目。之后 Next 的每次导航都经我们打过标的
 *   pushState/replaceState，条目自带深度。
 *   返回落在深度 ≥1 ＝ App 内正常回上一页（不弹框）；落在入口/界外才弹确认。
 * - Android（Capacitor）：官方 @capacitor/app 的 backButton。canGoBack 就走 history.back()
 *   （即上面的同一套判定），退无可退才弹确认；「退出」调 App.exitApp() —— 唯一可靠的真退出。
 *
 * 判据与状态机都在 lib/system/exit-guard.ts，这里只负责装配与渲染。
 */

/** Web 环境没有「关标签页」权限，退出的可测口径是离开本站（真实离开当前页）。 */
const WEB_EXIT_URL = "about:blank";

// 守门只需装一次（根布局常驻；StrictMode 双跑/HMR 都靠这两个开关兜住，免得压两条哨兵、挂两个返回键监听）。
let installed = false;
let nativeAttached = false;
let currentDepth = EXIT_GUARD_ENTRY_DEPTH;
let notifyBack: ((landedDepth: number | null) => void) | null = null;

async function isNativeApp(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** 真退出：原生走 exitApp；Web 只能离开本站，绝不假装（不靠 history 层层回退蒙混）。 */
async function performExit(): Promise<void> {
  if (await isNativeApp()) {
    try {
      const { App } = await import("@capacitor/app");
      await App.exitApp();
      return;
    } catch {
      /* 插件不可用也退一步走 Web 口径，不让「退出」变成点了没反应 */
    }
  }
  window.location.replace(WEB_EXIT_URL);
}

/** 补一条哨兵：让它替当前条目挡住浏览器的默认离开，返回动作才能落回我们手里。 */
function armSentinel(landedDepth: number | null): void {
  currentDepth = landedDepth ?? EXIT_GUARD_ENTRY_DEPTH;
  window.history.pushState(window.history.state, "", window.location.href);
}

/** 读内联脚本留在 window 上的交接对象（没跑成或环境受限时没有）。 */
function readEarlyGuard(): ExitGuardEarly | null {
  const value = (window as unknown as Record<string, unknown>)[EXIT_GUARD_EARLY_GLOBAL];
  return value && typeof value === "object" ? (value as ExitGuardEarly) : null;
}

function installExitGuard(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const { history } = window;
  const root = document.documentElement;
  const rawPush = history.pushState.bind(history);
  const rawReplace = history.replaceState.bind(history);

  const early = readEarlyGuard();
  const plan = planExitGuardTakeover({
    armedByInitScript: early !== null || root.getAttribute(EXIT_GUARD_ARMED_ATTR) === "1",
    earlyDepth: early && typeof early.depth === "number" ? early.depth : null,
    stateDepth: readEntryDepth(history.state),
  });
  currentDepth = plan.currentDepth;

  if (plan.needsSentinel) {
    // 兜底：内联脚本没跑成（环境受限/脚本被剥）时自建入口标记 + 哨兵，行为与上一版一致。
    rawReplace(stampDepth(history.state, EXIT_GUARD_ENTRY_DEPTH), "", window.location.href);
    currentDepth = EXIT_GUARD_SENTINEL_DEPTH;
    rawPush(stampDepth(history.state, currentDepth), "", window.location.href);
  } else {
    // 接管内联脚本已压好的哨兵：把当前条目按它的真实深度重打一次标（幂等），绝不新增条目。
    rawReplace(stampDepth(history.state, currentDepth), "", window.location.href);
  }
  root.setAttribute(EXIT_GUARD_ARMED_ATTR, "1");

  // Next 的导航全走这两个方法（已实测），套一层即可让 App 内每条条目自带深度。
  history.pushState = (state, title, url) => {
    currentDepth += 1;
    rawPush(stampDepth(state, currentDepth), title, url ?? window.location.href);
  };
  history.replaceState = (state, title, url) => {
    rawReplace(stampDepth(state, currentDepth), title, url ?? window.location.href);
  };

  // 交班：卸掉内联脚本的临时 popstate 监听并按 taken 上锁，之后返回判定只由下面这一个监听器负责。
  if (early) {
    early.taken = true;
    early.detach?.();
  }

  window.addEventListener("popstate", (event) => {
    const landedDepth = readEntryDepth(event.state);
    if (landedDepth !== null) currentDepth = landedDepth;
    // 落到入口/界外先把哨兵补回去：确认框不管开还是关，下一次返回都还落在界内（连点不会直接退出）。
    if (landedDepth === null || landedDepth <= EXIT_GUARD_ENTRY_DEPTH) armSentinel(landedDepth);
    notifyBack?.(landedDepth);
  });

  // 首屏到 hydration 之间发生过返回（内联脚本已把哨兵补回去了）：装好就把那一下的确认框补上，
  // 否则用户按过的那次返回会「没反应」。
  if (early?.pending) {
    early.pending = false;
    notifyBack?.(EXIT_GUARD_ENTRY_DEPTH);
  }
}

/** Android 硬件返回键/手势返回。 */
async function attachNativeBackButton(): Promise<void> {
  if (nativeAttached || !(await isNativeApp())) return;
  nativeAttached = true;
  try {
    const { App } = await import("@capacitor/app");
    await App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
        return;
      }
      notifyBack?.(null);
    });
  } catch {
    nativeAttached = false;
  }
}

export function ExitConfirmGuard() {
  const [guard, setGuard] = useState<ExitGuardState>({ dialogOpen: false });
  const guardRef = useRef(guard);

  const dispatch = useCallback((event: ExitGuardEvent) => {
    const next = reduceExitGuard(guardRef.current, event);
    guardRef.current = next.state;
    setGuard(next.state);
    if (next.effect === "exit") void performExit();
  }, []);

  useEffect(() => {
    notifyBack = (landedDepth) => dispatch({ kind: "back", landedDepth });
    installExitGuard();
    void attachNativeBackButton();
  }, [dispatch]);

  const cancel = useCallback(() => dispatch({ kind: "cancel" }), [dispatch]);

  return (
    <Modal open={guard.dialogOpen} title="要退出 Party Night 吗？" onClose={cancel}>
      <p className="exit-confirm__text">不小心点到返回了？点「继续玩」就留在这里。</p>
      <div className="modal-actions">
        <Button variant="danger" type="button" onClick={() => dispatch({ kind: "confirm" })}>退出</Button>
        <Button variant="ghost" type="button" onClick={cancel}>继续玩</Button>
      </div>
    </Modal>
  );
}
