# RG-01 新RC离线smoke（机器侧，2026-09-26，真机实测）

> **证据归属声明（neat-freak 2026-09-27 收口校准，务必先读）**
>
> - 本文件 §「结果10项」及文末 Key/直连各条**全部是上一个 RC（commit `cce4306`，已作废）的新构建证据**，构建时间 2026-09-26。
> - **不得**把这些结论当作 Change B 新构建的构建证据；Change B 改动已于 2026-09-27 落在 `49d6c75`（main 已 push），涉及 `route.ts`／`safety-filter.ts`／`generate-deck.ts`／`pack-switcher.ts`／`MutualCheckSheet.tsx`／`packMinPlayersFloor` 人数下限真源等，行为与旧包不同源。
> - 用户 V1.2 §十三与 `PRODUCT_PLAN_V2.0-CHANGE-B.md` §四均明确：旧 RC 的 Key persistence、AI 直连/原生传输、离线启动/恢复证据**不能代替**本轮新构建 smoke。
> - 本轮新构建 smoke 已回填（见下方「本轮（Change B）新构建 machine smoke」段，2026-09-27 02:38 实测）：机器侧已过；RG-01 的真人手点项仍未开始，不得据本文件宣称 RG-01 整项已过。

## 本轮（Change B）新构建 machine smoke｜2026-09-27 02:38 真机实测（编排者回填）

> 状态：**机器侧 PASS（7/10 项实机确认；⑥⑦⑧ 按旧 RC 口径留待用户上手）**。构建自 Change B 全链改动（该工作区内容已于 2026-09-27 02:49 落为 commit `49d6c75`，main 已 push），非旧包。

| 项 | 值（实测） |
|---|---|
| 构建 commit | `49d6c75`（feat(V2 Change B) 收口矩阵+Coverage+Single-Anchor+2人局收口+Mutual单候选，重冻 NEW RC；main 已 push）。时序：APK 产物 02:37、装包 `lastUpdateTime` 02:38:49，该提交落库 02:49 —— 构建早于提交，为同一工作区内容，其间只有本节证据文档落盘、无业务代码改动；RC 身份以 `49d6c75` 为准（`82cec01` 为其上的 Change A 追加；两者之上再叠启动白屏修复 `eeaebf3`＝当前 NEW RC，见文末《最终候选 RC 复录》） |
| web 资产 | `pnpm android:release` = `build:export`（静态导出 `out/`）＋ `CAPACITOR_TARGET=release cap sync`；无 `server.url`，origin = `https://localhost`（CDP 实测） |
| JDK | 本机原只有 openjdk@17（gradle 报「无效的源发行版：21」）；本轮经用户批准 `brew install openjdk@21`（21.0.12.1） |
| APK | release 产物 `app-release-unsigned.apk`（`android/app/build.gradle` 未配 `signingConfig`）；**装机用同源 release web 资产的 debug 签名包** `app/build/outputs/apk/debug/app-debug.apk`（同 appId `night.party.app`） |
| 装机结果 | `adb -s IN9LZTAYV4UGU4JF install -r` = **Success**；`lastUpdateTime=2026-09-27 02:38:49`、`firstInstallTime=2026-09-25 21:04:23`（数据保留） |
| 设备序列号 | `IN9LZTAYV4UGU4JF`（Redmi 22041216UC / xagapro，USB）。全程 `-s` 指定该机；12 Pro `indq5xfi6hovay4d` 未碰 |
| 离线条件 | 飞行模式开 `airplane_mode_on=1`（状态栏 ✈）；Mac `:3000` 无监听（`curl` 返回 000 超时），已停本仓库 dev server |
| ① 安装成功 | ✓ Success |
| ② Mac :3000 关闭 | ✓ `curl -m3 http://127.0.0.1:3000` = 000（无监听） |
| ③ 飞行模式 | ✓ `settings get global airplane_mode_on` = 1 |
| ④ App 启动、首页完整渲染 | ✓ 截图 `/tmp/rc-newrc-home.png`：Logo＋「今晚开局（AI 组局）」＋7 玩法卡＋四 Tab 全渲染；无空白/报错 |
| ⑤ 组局页可进（V2 setup 全套） | ✓ 截图 `/tmp/rc-newrc-setup.png` + CDP 读 DOM：人数 2／性别 男·女·不填×2／关系 6 档／氛围 6 档／尺度 3 档／「下一步：雷区设置 →」；**并实测「本局 AI 组局候选：5 个玩法」**——2 人局已自动排除 minPlayers=3 的「谁最可能」「指人游戏」，即 Change B B1 人数下限修复在真机生效 |
| ⑥ 本地题库出题／Router／Session 保存 | ⏸ 机器不代点开局（RG 红线：开局抽卡须真人手点） |
| ⑦ Router 正常 | ⏸ 页面级：组局关系流走 V2 Router 入口已渲染；调度行为由 unit 902 + 7 组 fixture×20 覆盖 |
| ⑧ Session 状态保存 | ⏸ CDP 只读 IndexedDB：`sessions` 45 行 / `sessionSummaries` 45 行 / `preferences` 1 行 / `gamePacks` 0 行（旧包历史数据仍在，未丢） |
| ⑨ 杀 App（force-stop）重启后首页恢复 | ✓ `am force-stop` → 重新拉起（新 pid 11227，重建 forward `tcp:9363 localabstract:webview_devtools_remote_11227`）→ 首页完整渲染，截图 `/tmp/rc-newrc-restart.png` |
| ⑩ Key 重启不消失 | ✓ 截图 `/tmp/rc-newrc-ai.png`＋CDP 读：设置/AI 页 `configured=true`（危险操作区显示「清空后需重新填写密钥才能继续使用此接口／清空 API 密钥」）、「使用 Web Crypto 加密后保存到本设备」勾选保持、Key 输入框按设计留空并显示掩码占位 `sk-••••••••••••`；IndexedDB `aiSecrets` 2 行（`ciphertext/iv/algorithm/cryptoVersion`）、`aiCryptoKeys` 1 行 → **install -r ＋ 杀进程重启后 Key 仍在** |
| 结论 | **机器侧 PASS**（①–⑤、⑨、⑩ 实机确认；⑥–⑧ 按旧 RC 口径留待用户上手连带验证） |

- 本轮新构建与旧 RC 的差异（不可混用）：旧包不含 pack 契约 minPlayers 下限收口、Single-Anchor Guard、Mutual 单候选 UI、混合池空池阻止；新包 ⑤ 项已实测到人数下限生效。
- 遗留（不阻断本 smoke）：`android/app/build.gradle` 的 release 仍未配 `signingConfig`，release 产物为 unsigned；正式分发前需补签名配置。
- 待用户上手（真人手点，机器不得代点）：开局抽卡～mutual/MATCH/隐私 8 项检查，按 RG-01 10 项判 PASS/FAIL。

## 以下为 2026-09-26 旧 RC（cce4306）构建的真机实测记录（历史证据，不顶替本轮）

- 设备：Redmi 22041216UC，Android 14，IN9LZTAYV4UGU4JF（USB adb）
- 包：自包含release APK（`pnpm android:release`：build:export静态导出out/ + CAPACITOR_TARGET=release sync，无server.url，同appId night.party.app，https localhost安全上下文），JDK21 BUILD SUCCESSFUL，install -r Success
- 离线条件：飞行模式开（airplane_mode_on=1，状态栏✈实拍），Mac :3000无进程（lsof空）
- 结果10项：
  1. 安装成功 ✓
  2. Mac :3000关闭 ✓（无进程）
  3. 飞行模式 ✓
  4. App启动，首页完整渲染（实拍/tmp/rg01-offline.png） ✓
  5. 组局页可进：人数/性别/关系/氛围全套V2 setup（实拍/tmp/rg01-offline3.png） ✓
  6. 本地题库出题／Router／Session保存：机器smoke未深入到开局抽卡（留待用户上手时连带验证），静态导出全页预渲染+单测/750覆盖
  7. Router正常（setup关系流为V2 Router入口） ✓（页面级）
  8. Session状态保存：同上，留待上手验证
  9. 杀App（force-stop）重启后首页恢复（实拍/tmp/rg01-offline4.png） ✓
  10. Key重启不消失：单测13例覆盖（persist重读/模拟重启/迁移不动/clear唯一删除）；真机Key配置待用户一次性输入后验证
- 旧LAN APK证据：已降级为历史PREP，不得拼入新RC结论
- 待用户上手：开局抽卡～mutual/MATCH/隐私8项检查，按RG-01 10项判PASS/FAIL
- Key在线验证（2026-09-26，用户上手实测PASS）：Note 11T Pro+（IN9LZTAYV4UGU4JF）Chrome生产站（VPN下可达），AI设置页Key显示sk-···已持久化，provider选中态保持，点“测试连接”=连接成功。注：adb代点按钮两次无状态反馈（用户手点一次即成功），机器触达与真人触达不等价，RG判定以真人手点为准；persist勾选框曾出现一次未解释的失勾（待观察，复现即开Change A）。
- Key App端持久化（2026-09-26，真机实测PASS）：同一台11T Pro+自包含App内用户填Key保存（配置已保存）→TM执行force-stop→重进→设置/AI页Key仍显示sk-···、持久化勾选保持。App杀进程重启不丢Key，关闭B-2真机验证环。
- 直连双通道（2026-09-26，用户手点PASS）：新包（原生传输+动态报错）install -r保留Key；OpenCode Go测试连接成功约3000ms（中转多一跳，正常），DeepSeek约700ms。CORS/原生通道成立。

## Change A「返回键退出确认」新构建真机验证（2026-09-27 04:09，编排者实测；对应 commit `82cec01`）

- 构建标识：**`82cec01`**（feat(Change A) 返回键退出确认；时序：debug APK 04:08、装包与实测 04:09，该提交落库 04:31 —— 构建早于提交，为同一工作区内容；本节测完时 NEW RC = `82cec01`，上一 RC `49d6c75` 作废）
  - 事实回填（neat-freak 2026-09-27 收口）：`82cec01` 已于同日 11:35 被启动白屏修复 RC **`eeaebf3`** 取代（`82cec01` 与 `49d6c75` 均作废，其间 `5f0745d` 为上一轮收口 docs 提交、非 RC）。本节 5 项证据绑定的是 `82cec01` 装机包，未被 `eeaebf3` 改动覆盖：`git diff --name-only 82cec01 eeaebf3 -- app lib android capacitor.config*.ts` 输出仅 18 个启动屏相关文件（11 个被删 `splash.png`、`res/drawable/pn_splash.xml`、`res/values/colors.xml`、`res/values/styles.xml`、`app/globals.css`、capacitor dev/release 两份配置），返回键实现零改动，故仍计入当前 RC 证据链。
- 设备：`IN9LZTAYV4UGU4JF`（Redmi 22041216UC / xagapro，USB，全程 `-s` 指定；12 Pro `indq5xfi6hovay4d` 未碰）
- 包：Change A 返工后重建（同自包含 release web 资产 + 新增 `@capacitor/app@7.1.2` 原生插件，debug 签名包装机；release 产物仍 unsigned，见下遗留），`install -r` = Success
- 离线条件：飞行模式 `airplane_mode_on=1`、Mac `:3000` 无监听（curl 000）
- 实测 5 项（截图 `/tmp/exitguard-back1.png` 为首页按返回后的确认框）：

| 项 | 操作 | 实测 |
|---|---|---|
| ① 冷启动首页按硬件返回 | `input keyevent KEYCODE_BACK` | 弹「要退出 Party Night 吗？」＋正文「不小心点到返回了？点「继续玩」就留在这里。」＋按钮 `["退出","继续玩"]`，App 未退出 ✓ |
| ② 点「继续玩」 | CDP 点击 | 确认框关闭、`url` 仍 `https://localhost/`、App 未退出 ✓ |
| ③ 确认框开着再按返回 | `KEYCODE_BACK` | 确认框关闭（`[role=dialog]` 计数 1→0）、App 仍在前台、未静默退出 ✓；`data-pn-exit-guard-armed=1` |
| ④ 有上一层时返回 | 组局 tab 进 `/setup/` → `KEYCODE_BACK` | 正常回退到首页 `https://localhost/`，**确认框计数 0**（不误弹、不多一次点击）✓ |
| ⑤ 点「退出」真退出 | 打开确认框 → 点 `退出` | `App.exitApp()` 生效：`mCurrentFocus` 切到 `com.miui.home/…Launcher`，App 退到桌面 ✓（`pidof` 仍返回 16852 属 Android 进程缓存，Activity 已 finish、用户视角已退出） |

- 设备状态已复原：飞行模式关闭（`airplane_mode_on=0`）。
- 结论：**Android 硬件返回 + 确认框 + 真退出，真机 PASS**。冷启动直达深路由（`/setup`）立刻返回这一项无法用 adb 直达（App 无 deep link 入口），已由 reviewer 与 QA 在**与真机同一份 `out/` 静态导出产物**上各独立实测 18/18 与 24/24 覆盖（armed=1、留站内、弹框，无 `about:blank`）。

## 启动画面白屏专项（2026-09-27 11:15~11:27，编排者真机录屏逐帧实测）

**问题**：用户报「启动画面是白色」。

**根因（两个，都靠证据定位，不是猜的）**
1. **原生启动屏是模板自带的纯白图**：`android/app/src/main/res/drawable/splash.png` 实测 480x320、98.8% 像素接近纯白、无任何图标，被 `AppTheme.NoActionBarLaunch` 的 `android:background` 引用；同时 Android 12+ 的 `windowSplashScreenBackground` / `windowSplashScreenAnimatedIcon` 从未设置。
2. **WebView 自身默认白底**：两份 capacitor 配置都没写 `backgroundColor`，Capacitor `Bridge` 的 `webView.setBackgroundColor` 分支从未执行。第一轮只修①后复测，录屏里**仍有约 0.7s 纯白且无图标**，才暴露出这一层。

**改法（配色与图标全部取自项目现有 theme，未另造）**
- 底色 `#080B1A` = `app/globals.css` 的 `--color-bg-night` = `app/layout.tsx` 的 themeColor（`res/values/colors.xml` 新增 `pn_splash_background`）
- 图标 = App 自己的启动图标 `@mipmap/ic_launcher`（`windowSplashScreenAnimatedIcon` + 窗口 layer-list 居中 `@mipmap/ic_launcher_foreground`）
- 删除模板自带的 11 个纯白 `splash.png`；`AppTheme.NoActionBar` 窗口底色由 `@null` 改为同一深色；`postSplashScreenTheme` 切回真实主题
- capacitor dev/release 两份配置加 `backgroundColor: '#080B1A'`；`globals.css` 的 `html, body` 补 `background: var(--color-bg-night)`（浅色主题自动跟随）

**逐帧验证（设备 11T Pro+ `IN9LZTAYV4UGU4JF`，Android 14 / MIUI，自包含 release web 资产 + debug 签名包装机，install -r Success）**

| 取证方式 | 改前 | 改后 |
|---|---|---|
| 录屏 30fps 逐帧（YAVG 亮度） | 第 22~69 帧纯白，峰值 230，无图标 | **白亮帧 0**（112 帧，亮度全程 27~74） |
| 录屏原生帧率统计 | 97 帧中 48 帧纯白（占 49.5%） | 112 帧中白亮帧 **0** |
| 快速连续 screencap（14 张） | — | 启动段全为深色主题底，无白帧 |
| 动画放慢 10 倍后录屏（325 帧） | — | 白亮帧 **0** |

**残留（如实记录）**：APK 内 `windowSplashScreenAnimatedIcon=@mipmap/ic_launcher` 已核实存在（aapt2 dump），但本机启动段中心区逐帧扫描**没有任何图标像素**——MIUI 的启动动画覆盖了系统启动屏，图标太快看不到。code-reviewer 与 qa 均判定不为此引入 `@capacitor/splash-screen` 挂起启动屏（会人为延长启动、伤手感），记 P2：若日后要让图标可见，再单独立项。

**最终候选 RC 复录（2026-09-27 11:33，commit `eeaebf3`）**：supervisor 要求重冻后对最终候选再录一次。
装机包应用代码与 `eeaebf3` 逐文件一致（`git diff --name-only eeaebf3 -- app lib android capacitor.config*.ts` 输出为空），重新 `install -r` Success 后录屏 128 帧：**白亮帧 0**，亮度范围 27~74，全程无白屏/白闪。结论 PASS。
