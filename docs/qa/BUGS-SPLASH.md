# QA 结论：启动白屏与 App 图标/主题色

- 日期：2026-09-27
- 阶段：Phase2 DEVELOP，Change A 终审
- 结论：**QA_RESULT=PASS（允许进入待重冻 RC；已并入重冻 RC `eeaebf3`，main 已 push）**
- 评审：`docs/review/CODE_REVIEW-SPLASH.md` 已给出 P0=0、blocking P1=0；本轮 QA 未发现新增 P0/P1。

## 验收清单

| 项目 | 结果 | 实测/核对 |
|---|---|---|
| `pnpm lint` | PASS | 0 errors，7 条 warning（已有项：`orca-decide.mjs` 4、`run-shadow.mjs` 2、`tests/phone/dump-state.ts` 1） |
| `npx tsc --noEmit` | PASS | exit 0，无输出 |
| `pnpm vitest run` | PASS | 102 files、927/927 tests |
| `pnpm test:e2e` | PASS | 105 passed、4 skipped（共 109） |
| `pnpm build` | PASS | Next.js production build 成功，静态路由生成完成 |
| `pnpm build:export` | PASS | 静态导出成功；脚本确认临时移出的 app/api 与 3 个单测文件均已放回 |
| 设备启动白屏 | PASS（证据由编排者采集，本 QA 未触碰设备） | 11T Pro+（IN9LZTAYV4UGU4JF，Android 14 / MIUI）；改后 112 帧录屏中 YAVG>150 白亮帧为 0，亮度全程 27–74；快速连续 screencap、动画放慢 10 倍复核也未见白帧。改前 97 帧中第 22–69 帧为纯白，峰值 YAVG=230，占录屏 49.5%。 |

## 独立核对

1. **白屏来源与旧 drawable 引用 — PASS。** 根因证据链：模板 `drawable/splash.png`（480×320，98.8% 近白）被 `AppTheme.NoActionBarLaunch` 的 `android:background` 引用；Android 12+ 的 `windowSplashScreenBackground` 与 `windowSplashScreenAnimatedIcon` 未配置；原生启动屏之后 WebView 默认白底又造成约 0.7 秒残余白屏。加入 Capacitor `backgroundColor` 后该白底分支消失。全仓检索 `@drawable/splash` 只命中 `styles.xml` 的说明注释与评审文档，没有有效资源引用；11 个模板 splash PNG 均已删除。
2. **主题色、浅色主题与图标 — PASS（图标帧可见性为待办）。** 原生 `#080B1A` 与 `app/globals.css` 的 `--color-bg-night: #080b1a`、`app/layout.tsx` 的 `themeColor: "#080B1A"` 大小写归一后相同。网页底色引用 CSS 变量，浅色主题将变量覆盖为 `#f7f5ff`，没有把网页浅色模式写死为深色。原生启动屏按品牌深色固定显示；浅色用户启动瞬间仍见深色，属于短暂品牌画面，建议保持，不为此增加原生主题持久化。图标使用项目 `@mipmap/ic_launcher` / `ic_launcher_foreground`，未另造图标。
3. **Capacitor 配置及同步产物 — PASS。** dev 与 release 均为 `backgroundColor: '#080B1A'`。diff 只增加该字段，没有改 `appId`、`appName`、`webDir` 或 `server.url`。忽略跟踪的 `android/app/src/main/assets/capacitor.config.json` 实读含有 `"backgroundColor": "#080B1A"`；其余 app 标识配置仍为 `night.party.app`。
4. **APK 资源编译 — PASS。** 对现有 `android/app/build/outputs/apk/debug/app-debug.apk` 用 `aapt2 dump resources` 只读检查，资源表包含 `style/AppTheme.NoActionBarLaunch` 的 `windowSplashScreenBackground=@color/pn_splash_background` 和 `windowSplashScreenAnimatedIcon=@mipmap/ic_launcher`；颜色资源解析为 `#ff080b1a`。本地现有 APK 已含本轮资源，不需要仅为此项重新出包。
5. **版本号 — PASS。** `package.json`、`public/version.json`、`public/sw.js` 的 `CACHE_VERSION` 均为 `1.5.0`；未 bump。
6. **安全/副作用与包体 — PASS（体积差值未验证）。** 新增 XML、颜色与 Capacitor 底色字段不含密钥、Token、网络上报或本机路径。改前 APK 不在可比较基线中，不能报告 APK 实测缩小值；debug APK 当前为 6,519,234 字节，release unsigned APK 为 5,059,785 字节（不同 variant/签名状态，不可当改前后比较）。删除的 11 张源 PNG 合计 109,443 字节，预期会减少打包资源，但压缩后实际 APK 净变化**未验证**。

## 回归充分性与遗留项

- 对「消除启动全程白屏」DoD，编排者的改前/改后逐帧数据、快速连续 screencap、慢放复核加本轮全量六项门禁，证据链足够；复测白亮帧为 0，与录屏结论一致。
- **建议补一条轻量自动化断言并记入 backlog，不阻塞本轮放行。** 同时断言 dev/release Capacitor `backgroundColor` 同值，并覆盖静态导出的 HTML/CSS 背景变量关系，可防止这次 WebView 默认白底回归和配置漂移。该断言本轮未新增，不能算作本次测试通过项。
- **已配置但本机录屏不可见的图标：P2 待办。** 编排者的启动片段中没有捕获到 App 图标像素，归因于 MIUI 启动动画覆盖/帧采样窗口限制；APK 资源表和配置证实图标已设置，因此不影响消白屏 DoD。建议保持现状，不引入 `@capacitor/splash-screen` 人为挂起启动屏；如需可见性证据，另择可控动画条件做一次性取证。
- 计数：**P0=0，P1=0；P2=2**（图标帧可见性取证、跨文件颜色/配置缺少漂移断言）；P3=4（详见代码评审）。

## RC 建议

**建议本改动并入待重冻 RC。** 重冻后应对最终候选构建再跑一次 Android 启动录屏，确认发布构建与当前已验证资源一致；本轮已提供充分验证，但不能替代候选 RC 本身的最终启动回归。编排者已完成的设备证据可归档引用，无需 QA 再碰设备。
  - 事实回填（neat-freak 2026-09-27 收口）：RC 已于 2026-09-27 11:35 重冻为 `eeaebf3`（main 已 push），上一 RC `82cec01`、`49d6c75` 作废；**上述「重冻后对最终候选再录一次」已于同日 11:33 由编排者执行**——重新 `install -r` 后录屏 128 帧、白亮帧 0、亮度 27~74，PASS，证据位置 `docs/qa/RG-01-NEWRC-SMOKE.md` 末节《最终候选 RC 复录》。装机包应用代码与 `eeaebf3` 逐文件一致（`git diff --name-only eeaebf3 HEAD -- app lib android capacitor.config*.ts` 为空）。

## 编排者回填项（已回填：2026-09-27 11:35，NEAT-FREAK 收口核对）

- 已回填①（本报告与代码评审结论纳入 HANDOFF/任务账本）：HANDOFF 顶层 Captured at / RC 状态 / 当前 Task 三处均已写明 `eeaebf3`；账本已随 `eeaebf3` 落本轮派工行（TASK-MODEL-LOG 96 行、DISPATCH-LOG 151 行，`node scripts/model/check-ledger.mjs` = LEDGER-OK）。
- 已回填②（候选版本/构建标识与最终启动录屏证据位置）：见上一节事实回填（`eeaebf3` ＋ RG-01-NEWRC-SMOKE 末节 128 帧 0 白帧）。
- 待办（不阻塞 Release Gate）：颜色/配置漂移断言仍未新增——本轮 P2-2（`#080B1A` 散在 5 处、dev/release 两份 capacitor `backgroundColor` 无同值守护）已登记在 HANDOFF 二节「当前 Task」与 `docs/pm/PRODUCT_PLAN_V2.0.md` §P2 backlog；P2-1（启动图标本机录屏不可见，MIUI 启动动画覆盖系统启动屏）同址登记，且已定「不为此引入 `@capacitor/splash-screen` 挂起」。两项均为 P2，不进 RG-01~07 的 7/7 门禁。
