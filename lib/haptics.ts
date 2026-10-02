/**
 * 完成提醒震动唯一入口。
 *
 * Android WebView 里 `navigator.vibrate()` 会返回 true 但不驱动马达（平台限制）；
 * 原生（Capacitor）环境走自建原生插件 `AlertVibrate`（以 USAGE_ALARM 触发，不受系统
 * 「触感反馈」总开关影响）；浏览器 / 非原生环境降级回 navigator.vibrate，保持网页端行为可观测。
 */
export async function vibrate() {
  try {
    const { Capacitor, registerPlugin } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const AlertVibrate = registerPlugin<{ vibrate(): Promise<void> }>("AlertVibrate");
      await AlertVibrate.vibrate();
      return;
    }
  } catch {
    /* 原生插件不可用时降级到网页震动 */
  }
  if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([120, 60, 120]);
}