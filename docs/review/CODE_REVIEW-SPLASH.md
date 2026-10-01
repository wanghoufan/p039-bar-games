# CODE REVIEW

- Task: Change A 复评｜修白屏启动画面 + 换成 App 自己的图标与主题色（用户 2026-09-27 需求）
- Commit: **`eeaebf3`**（fix(Change A) 消掉启动白屏，main 已 push，2026-09-27 11:37；其后的 docs 回填提交为 `446dc5c`）
  - 事实回填（neat-freak 2026-09-27 收口）：评审当时的「未提交工作区改动（16 文件：11 删 + 5 改 + 2 新增）」即该提交内容；**文件数订正为 18**（11＋5＋2＝18，原「16」与自身分项矛盾）。业务文件逐项：删 11 个模板 `splash.png`；改 `res/values/styles.xml`、`app/globals.css`、`capacitor.config.dev.ts`、`capacitor.config.release.ts`、`next-env.d.ts`；新增 `res/values/colors.xml`、`res/drawable/pn_splash.xml`。同批另落 `docs/review/CODE_REVIEW-SPLASH.md`、`docs/qa/BUGS-SPLASH.md`、`docs/qa/RG-01-NEWRC-SMOKE.md` 与两本账本（不计入业务文件数）。NEW RC = `eeaebf3`。
- Reviewer: code-reviewer（codebuddy/glm-5.3-flash）
- Result: **过**（P0=0，blocking P1=0；2 条 P2 backlog + 4 条 P3 记录，均不阻塞收工）
  - 事实回填（neat-freak 2026-09-27 收口）：本结论已并入重冻 RC `eeaebf3`（`docs/qa/BUGS-SPLASH.md` = PASS/建议并入，HANDOFF RC 状态 = `eeaebf3`），三处口径一致。

> Dispatch / Evidence ID 系字段 2.0 已废弃，不填。

## 七查

1. **DEV_BASELINE 一致**：HANDOFF.md:10-11 = PRODUCT_PLAN_V2.0 / CHANGE_REQUEST A，本次改动在 A 范围内（启动屏视觉小改），无 Plan 语义变更。✔
2. **Requirement 覆盖**：需求两半——「查清白屏来源」已由编排者举证（模板 splash.png 98.8% 近白 + windowSplashScreen* 从未设置 + WebView 默认白底三层根因，均已修）；「换成 App 图标与主题色」配置已落地（见下逐条）。✔
3. **DoD 达成**：录屏逐帧两轮复测，改后全程 0 个白亮帧；真机验证由编排者完成。图标可见性取证受限（见 P2-1），不构成白屏 DoD 失败。✔（带一条 P2 记录）
4. **Diff 越界**：无。appId/appName/webDir/server.url 未动；无业务逻辑、测试、依赖、版本号改动；styles.xml 之外的 res 文件只增不删（删除的 11 个 splash.png 全部是模板资源）。✔
5. **回归影响**：html/body 补 background 走 var()，浅色主题跟随覆盖（globals.css:650-652），不写死；AppTheme.NoActionBar 窗口底色只影响 MainActivity 空窗期，对话框/Toast 走各自主题不受影响。✔
6. **P0-P2 分级**：P0=0；P1=0；P2=2（图标可见性取证、跨文件色值同步无守护）；P3=4。
7. **可回滚性**：全部改动为独立资源/配置，`git checkout -- <files>` + 恢复 11 个 png 即可整体回滚，无数据/结构迁移。✔

## 逐条清单结论（10 条）

1. **颜色真源**：`pn_splash_background`=#080B1A（colors.xml:8）== globals.css `--color-bg-night` #080b1a（app/globals.css:9）== layout.tsx themeColor（app/layout.tsx:21）。三处同值，无另造色。未复用 ic_launcher_background #0C1025 是对的——那是图标底色，混用会让「启动屏→网页」出现色差（colors.xml:6-7 注释已说明）。Web 侧走 var()，浅色主题下 html/body 会变 #f7f5ff，不写死深色（globals.css:47-58）。**PASS**
2. **图标真源**：windowSplashScreenAnimatedIcon=@mipmap/ic_launcher（styles.xml:32，自适应图标 anydpi-v26 真源），layer-list 用 @mipmap/ic_launcher_foreground（pn_splash.xml:9），无新画图无外部图。API 23~25：ic_launcher_foreground.png 在 6 个密度桶齐全（mipmap-mdpi~xxxhdpi 均有实体 PNG），可解析。尺寸：前景 PNG 是 108dp 画布（xxxhdpi 432px/mdpi 108px，已实测），自适应图标只裁 72dp 圆 + 66% 安全区；直用居中时图标绘制区是 108dp 画布、主体约占 66%≈71dp——与桌面图标观感接近、不会被裁（主体在安全区内），只是略偏小。**PASS**（观感微调记 P3-2）
3. **postSplashScreenTheme / 主主题 background**：postSplashScreenTheme→AppTheme.NoActionBar（styles.xml:35）与 Capacitor BridgeActivity onCreate 的 setTheme 目标一致，正确。AppTheme.NoActionBar 的 android:background 由 @null→实色（styles.xml:19）只作用于 MainActivity 窗口背景空窗期；HTML 弹层（modal/sheet）在 WebView 内，与主题无关；状态栏/下拉/Toast 用系统与 AppTheme 基础主题，不受影响。core-splashscreen 依赖已存在（android/app/build.gradle:38，variables.gradle:10 = 1.0.1），属性不带 android: 前缀的写法对 v31+/pre-31 双区间生效，注释解释正确。**PASS**
4. **删除彻底性**：`grep -rn "@drawable/splash"` 全仓仅剩 styles.xml:36 一条**注释**（非资源引用）；11 个 splash.png 全部在 git status 为 D；AndroidManifest.xml:16 引用的 AppTheme.NoActionBarLaunch 仍存在。**PASS**
5. **capacitor 配置**：dev（capacitor.config.dev.ts:19）与 release（capacitor.config.release.ts:22）同值 #080B1A，appId/appName/webDir/server.url 未动（diff 仅新增行）。`android/app/src/main/assets/capacitor.config.json`（android/.gitignore:99 忽略）已含 backgroundColor，说明 sync 已跑、装机产物是新的。**忘 sync 风险在本仓不成立**：release 装机走 `pnpm android:release` → scripts/build-android-release.mjs:31 自动 `cap sync android`，人工漏不掉。**PASS**
6. **globals.css**：background: var(--color-bg-night) 跟随浅色主题覆盖（globals.css:650-652），不冲突——body 原本就有同值 background（globals.css:58），html 层是兜底重复，无害。更早生效的位置其实是 Capacitor backgroundColor（原生钉底）+ 渲染阻塞的样式表，本条是第三层保险；注释里「不必等 link 样式表生效」措辞不准（它本身就是样式表），记 P3-3，不改行为。**PASS**
7. **无人工延迟**：未引入 @capacitor/splash-screen 挂起、无 sleep/动画延时，启动路径零新增阻塞。深色写死：原生启动屏无法读 localStorage 主题，用户选浅色时启动屏仍深色——**可接受**：启动屏 <1s、是品牌瞬间而非内容页，为它引入原生主题持久化得不偿失。**PASS**（记 P3-4）
8. **越界与红线**：appId `night.party.app` 三处（两份 ts 配置 + 已 sync 的 assets json）不变，手机 IndexedDB 与 AI Key 不受影响；版本号 1.5.0 三处同值未动（package.json:3、public/sw.js:7、public/version.json）；无依赖变更。**PASS**
9. **next-env.d.ts**：**应提交**。这是 build:export 生产构建的自动重写（.next/dev/types → .next/types），当前 `.next/dev/types` 已不存在，回退会令 tsc 直接报错（import 指向缺失文件）；AGENTS.md 也注明提交它可保工作树干净。
10. **测试充分性**：自测全绿——tsc --noEmit PASS、lint 0 errors（7 条既有 warning）、vitest 927/927（102 文件，与基线持平）、gradle :app:processDebugResources RC=0。「录屏逐帧 + 既有门禁」对原生资源改动**足够**，补自动化属过度工程；跨文件色值同值关系记 P2-2 backlog。

## P0 / P1 Findings

- 无。

## P2 / P3 Backlog Findings

**P2**
- **P2-1 启动图标可见性无法帧级取证**：windowSplashScreenAnimatedIcon 已配置且 APK 内已核实，但本机冷启动快于录屏帧间隔，逐帧扫描抓不到任何一帧图标彩色像素。**判定：不构成「需求未达成」**——图标已换成 App 自己的（配置与资源双证据），白屏 DoD（全程无白亮帧）已达成；不可见是取证手段极限而非实现缺陷。**建议：保持现状，不引入 @capacitor/splash-screen 挂起启动屏**（会人为延长启动屏、伤启动手感，与用户在意的手感冲突）。可选补证：开发者选项调慢动画/关掉后台进程后录一次屏抓图标帧，作为一次性证据，之后记 backlog。
- **P2-2 色值三处同值无守护**：#080B1A 散在 colors.xml、两份 capacitor 配置、globals.css/layout.tsx，改任一处无测试报错。backlog：可在 CI/unit 里加一条 3 行的静态断言（读文件比对同值），本轮不强制。
**P3**
- **P3-1** styles.xml 末行缺换行符（\ No newline at end of file）。
- **P3-2** layer-list 直用 foreground 使图标主体略小于桌面图标观感；若在意可在 layer-list 里给 item 加 android:width/height 或 inset 收紧到 ~72dp。
- **P3-3** globals.css 新注释「不必等 <link> 样式表完全生效」措辞不准（该 background 本身就在样式表里）；顺手改不改均可。
- **P3-4** 浅色主题用户启动屏仍是深色：判定可接受（理由见清单 7），如未来要做，走原生 Preferences 持久化主题 + 启动前选色，单独立项。
