import type { CapacitorConfig } from '@capacitor/cli';

/**
 * 自包含 Release 配置（B-1）：不设 server.url，WebView 只加载打进 APK 的本地静态导出产物。
 *
 *   pnpm android:release
 *   → pnpm build:export（Next 静态导出到 out/）
 *   → cap sync android（CAPACITOR_TARGET=release，把 out/ 拷进 android 资产）
 *
 * 不设 androidScheme：默认 https，源是 https://localhost —— 安全上下文，`crypto.subtle` 可用，
 * AI Key 的 AES-GCM 加密落盘才真正可行。
 *
 * appId / appName 与开发配置保持一致：换 appId 等于换一个应用，会丢掉手机上的 IndexedDB（含已保存的 AI Key）。
 */
export const releaseConfig: CapacitorConfig = {
  appId: 'night.party.app',
  appName: 'PartyNight',
  webDir: 'out',
  // WebView 底色（与 dev 配置同值）：色值来源 = Web 主题真源 app/globals.css 的
  // --color-bg-night (#080b1a)，与 app/layout.tsx 的 viewport.themeColor "#080B1A"、
  // android res/values/colors.xml 的 pn_splash_background 同一值，不另造颜色。
  // 作用：Capacitor Bridge 启动时用 webView.setBackgroundColor 把 WebView 底色钉住，
  // 消掉「网页首帧渲染前」那段 WebView 默认白底空窗（原生启动屏是深色，白底会闪一下白）。
  backgroundColor: '#080B1A',
};

export default releaseConfig;
