import type { CapacitorConfig } from '@capacitor/cli';

/**
 * 开发/局域网调试配置（CAPACITOR_TARGET 未设为 release 时的默认）：
 * 手机直连 Mac 上的 Next 服务 —— 手机 DNS 污染 vercel.app，所以走局域网 IP；需要同一 WiFi。
 *
 * 注意：局域网 http 源不是安全上下文，WebView 里 `crypto.subtle` 不可用，
 * 因此在这个配置下 AI Key 只能做到「仅本次会话」；要真正加密落盘请用 release 配置（https://localhost）。
 */
export const devConfig: CapacitorConfig = {
  appId: 'night.party.app',
  appName: 'PartyNight',
  webDir: 'public',
  // WebView 底色（与 release 配置同值）：色值来源 = Web 主题真源 app/globals.css 的
  // --color-bg-night (#080b1a)，与 app/layout.tsx 的 viewport.themeColor "#080B1A"、
  // android res/values/colors.xml 的 pn_splash_background 同一值，不另造颜色。
  // 作用：Capacitor Bridge 启动时用 webView.setBackgroundColor 把 WebView 底色钉住，
  // 消掉「网页首帧渲染前」那段 WebView 默认白底空窗（原生启动屏是深色，白底会闪一下白）。
  backgroundColor: '#080B1A',
  server: {
    // 生产站 PWA 本体未动；恢复外网后可切回 https://party-night-v1-2.vercel.app/
    url: 'http://192.168.31.60:3000/',
    androidScheme: 'http',
    cleartext: true,
  },
};

export default devConfig;
