/**
 * 返回键退出确认：纯逻辑层（不碰 window / React，可单测）。
 *
 * 深度模型——每条 history 条目上记一个「App 内深度」：
 *   0   = 本次文档启动时所在的那一条（App 入口，再往回就离开 App）
 *   1+  = 启动之后在 App 内新建的条目（含守门用的哨兵条目）
 * 返回落到 1+ → 有上一级，照旧回上一页；落到 0 或没有标记（App 之外）→ 这才谈退出确认。
 *
 * 这样判「该不该拦」只看真实历史位置，不猜路由层级：组局页退首页、局内子页退上一页
 * 永远是 1+，绝不会多弹一次确认。
 *
 * 时序——哨兵必须在「用户可能按返回」之前就压好。等 React effect 装配会留一段
 * 「首屏已可见、哨兵还没压」的空窗（冷启动直开深路由时按返回会静默离站），
 * 所以压哨兵 + 打标记挪到 head 的 beforeInteractive 内联脚本（EXIT_GUARD_INIT_SCRIPT）；
 * React 守门只接管这条已存在的哨兵，负责判定、弹框、连点状态机与退出。
 */

export const EXIT_GUARD_STATE_KEY = "__partyNightExitGuardDepth";
/**
 * 守门装好（哨兵已压）时打到 <html> 上的标记。
 * 由 head 的 beforeInteractive 内联脚本（EXIT_GUARD_INIT_SCRIPT）在首屏解析阶段就设置，
 * 不再等 React hydration——标记出现即代表哨兵已生效；测试/真机排查用它等到「已生效」再按返回。
 */
export const EXIT_GUARD_ARMED_ATTR = "data-pn-exit-guard-armed";
/** App 入口条目深度：落到这里说明再往回就离开 App。 */
export const EXIT_GUARD_ENTRY_DEPTH = 0;
/** 哨兵条目：把「返回」的落点从浏览器默认动作（离开）里抢过来，好让顶层也能被我们看见。 */
export const EXIT_GUARD_SENTINEL_DEPTH = 1;
/** 内联脚本留在 window 上的交接对象名：React 侧据此认定「哨兵已存在」并接管，不重复压。 */
export const EXIT_GUARD_EARLY_GLOBAL = "__partyNightExitGuardEarly";
/** localStorage 兜底痕迹（仅供真机/排查确认首屏脚本跑过；不参与判定，避免跨会话误判「哨兵已存在」）。 */
export const EXIT_GUARD_STORAGE_KEY = "party-night-exit-guard-armed";

/**
 * head 里那段内联脚本的源码（layout.tsx 用普通 <script> 注入，解析到就执行）。
 * 只做三件幂等的事：给当前条目打入口标（深度 0）、压一条哨兵（深度 1）、打 armed 标记；
 * 另外挂一个临时 popstate 监听，在 React 接管前把哨兵补回去（hydration 前连按也出不了站）。
 * 全程不进 React 渲染的 DOM 结构，因此不会造成 hydration mismatch。
 *
 * 为什么不用 next/script 的 beforeInteractive：App Router 里它被降级成 `self.__next_s.push(...)`，
 * 由 Next 运行时（要等 chunk）接着执行，落在首屏之后；真实场景要的是「解析到 head 就压哨兵」，
 * 所以这里用普通内联脚本，比 beforeInteractive 更早且不依赖任何运行时。
 *
 * 为什么必须自带宽严标记 `__NA`：Next 的 popstate（dist/client/components/app-router.js 的 onPopState）对
 * 「有 state 但没有 __NA」的条目会直接 window.location.reload()。本脚本写 state 的时机早于 hydration，
 * Next 还没来得及把 __NA/内部树写进来，所以这里显式声明 __NA——条目本来就是 App Router 的条目，
 * 只是缺内部树；缺树是安全的，Next 的 restoreReducer 对此有显式兜底（沿用当前 tree，不进入非法状态）。
 *
 * 全部包在 try/catch 里：history/存储不可用（隐私模式、受限 WebView）时静默跳过，绝不白屏；
 * React 侧发现没有 armed 标记会自己补建，功能不受影响。
 */
export const EXIT_GUARD_INIT_SCRIPT = `(function(){try{
var ARMED="${EXIT_GUARD_ARMED_ATTR}",KEY="${EXIT_GUARD_STATE_KEY}",G="${EXIT_GUARD_EARLY_GLOBAL}";
var root=document.documentElement;
if(!root||root.getAttribute(ARMED)==="1"||window[G])return;
var h=window.history,loc=window.location.href;
var copy=function(s){var o={},k;if(s&&typeof s==="object"){for(k in s){if(Object.prototype.hasOwnProperty.call(s,k))o[k]=s[k]}}return o};
var stamp=function(s,d){var o=copy(s);o[KEY]=d;return o};
var read=function(s){return s&&typeof s==="object"&&typeof s[KEY]==="number"?s[KEY]:null};
var early={pending:false,depth:1,taken:false,detach:null};
var rawPush=h.pushState.bind(h),rawReplace=h.replaceState.bind(h);
var sentinel=function(){rawPush(stamp(h.state,1),"",loc);early.depth=1};
var base=copy(h.state);
base.__NA=true;
rawReplace(stamp(base,0),"",loc);
sentinel();
var onPop=function(e){
if(early.taken)return;
var d=read(e.state);
if(d===null||d<=0)sentinel();
early.pending=true;
};
early.detach=function(){window.removeEventListener("popstate",onPop)};
window.addEventListener("popstate",onPop);
root.setAttribute(ARMED,"1");
window[G]=early;
try{window.localStorage.setItem("${EXIT_GUARD_STORAGE_KEY}","1")}catch(e){}
}catch(e){}})();`;

/** 内联脚本交接给 React 的对象形状。 */
export type ExitGuardEarly = {
  /** React 接管前是否已经发生过返回（装好即补弹一次确认，不让那一下静默）。 */
  pending: boolean;
  /** 内联脚本视角下当前条目的深度（哨兵=1）。 */
  depth: number;
  /** React 接管后置真：临时监听即便没卸干净也不再处理事件。 */
  taken: boolean;
  detach: (() => void) | null;
};

export type ExitGuardTakeover = {
  /** 接管后的当前条目深度，作为 React 侧计数的起点。 */
  currentDepth: number;
  /** true=没有已存在的哨兵（内联脚本没跑成），React 需自建入口标记 + 哨兵。 */
  needsSentinel: boolean;
};

/**
 * 装配决策：内联脚本已经把哨兵压好了吗？当前条目是哨兵还是入口？
 *
 * - 没有 armed 标记 → 内联脚本没跑成（极端环境），沿用上一版做法自建哨兵；
 * - 有 armed 标记 → 当前条目就是内联脚本压的那条哨兵，**绝不把它当入口条目**（当入口会把
 *   深度记成 0，下一次返回就再一次弹框，等于多一次点击），也绝不重复压第二条。
 *   深度以交接对象为准（history.state 可能在 hydration 中被宿主重写），取不到才退到哨兵深度。
 */
export function planExitGuardTakeover(input: {
  armedByInitScript: boolean;
  earlyDepth: number | null;
  stateDepth: number | null;
}): ExitGuardTakeover {
  if (!input.armedByInitScript) return { currentDepth: EXIT_GUARD_ENTRY_DEPTH, needsSentinel: true };
  for (const candidate of [input.earlyDepth, input.stateDepth]) {
    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate >= EXIT_GUARD_SENTINEL_DEPTH) {
      return { currentDepth: candidate, needsSentinel: false };
    }
  }
  return { currentDepth: EXIT_GUARD_SENTINEL_DEPTH, needsSentinel: false };
}

export type ExitGuardState = { dialogOpen: boolean };
/** 一次返回该干什么：allow=照旧回上一页；confirm=弹退出确认；dismiss=只关框。 */
export type ExitGuardAction = "allow" | "confirm" | "dismiss";
export type ExitGuardEffect = "none" | "open" | "close" | "exit";
export type ExitGuardEvent =
  | { kind: "back"; landedDepth: number | null }
  | { kind: "cancel" }
  | { kind: "confirm" };

/** 读条目上的深度；不是本 App 打的标（外部页面/浏览器初始条目）则返回 null。 */
export function readEntryDepth(state: unknown): number | null {
  if (!state || typeof state !== "object") return null;
  const value = (state as Record<string, unknown>)[EXIT_GUARD_STATE_KEY];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** 把深度并进 history 条目状态：保留宿主（Next）自己的键，只加标。 */
export function stampDepth(state: unknown, depth: number): Record<string, unknown> {
  const base = state && typeof state === "object" ? (state as Record<string, unknown>) : {};
  return { ...base, [EXIT_GUARD_STATE_KEY]: depth };
}

/** 单次返回的判定：弹框优先（防连点误退），其次看落点是不是还在 App 内。 */
export function decideExitGuardAction(input: { dialogOpen: boolean; landedDepth: number | null }): ExitGuardAction {
  if (input.dialogOpen) return "dismiss";
  if (input.landedDepth !== null && input.landedDepth >= EXIT_GUARD_SENTINEL_DEPTH) return "allow";
  return "confirm";
}

/** 弹框状态机：给事件、还状态与副作用，UI 只负责照着做。 */
export function reduceExitGuard(state: ExitGuardState, event: ExitGuardEvent): { state: ExitGuardState; effect: ExitGuardEffect } {
  if (event.kind === "cancel") return { state: { dialogOpen: false }, effect: state.dialogOpen ? "close" : "none" };
  if (event.kind === "confirm") return { state: { dialogOpen: false }, effect: state.dialogOpen ? "exit" : "none" };
  const action = decideExitGuardAction({ dialogOpen: state.dialogOpen, landedDepth: event.landedDepth });
  if (action === "allow") return { state, effect: "none" };
  if (action === "confirm") return { state: { dialogOpen: true }, effect: "open" };
  return { state: { dialogOpen: false }, effect: "close" };
}
