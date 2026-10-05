# 小交接｜2026-10-02（Asia/Shanghai）｜开发暂停，恢复先读本段

> Human 最新要求：开发先到这里，暂时结束。当前暂停；不要自动恢复开发。本文件是当前唯一恢复入口。旧交接已移到 `docs/handoff/archive/`，仅供追溯；日常恢复不读归档。归档中「20 条开发示范题」「Android 真机未测」「HEAD 018a368」等说法均已被本轮覆盖，不得再用。

## 1. 当前工作进展（截至 2026-10-02）

- **单开发者执行**：Human 明确要求单开发者连续执行，不派新 Agent、不伪装独立 Reviewer、不新增角色/治理流程/Gate。
- **大冒险双题库已正式入库**：
  - 普通题库 108 题 → `content/punishment/challenges.ts`（id 前缀 `DA-L{n}-xxx`）。
  - 「一男一女」题库 108 题 → `content/punishment/couple.ts`（id 前缀 `DA-DUO-L{n}-xxx`）。
  - 按 Human 决策：**两库 `contentTags` 全为空数组**（本轮不设盾牌标签；`phone`、`external_message`、`public_post`、`photo_video`、`stranger_interaction` 五类不映射）。
  - 正式题库 JSON 不含 `source` 字段（App schema 为 `.strict()`，多余字段会报错）；追溯信息另存。
- **Android 真机链路打通（Capacitor）**：
  - 自定义原生震动插件 `android/app/src/main/java/night/party/app/AlertVibratePlugin.java`，用 `VibrationAttributes.USAGE_ALARM`（`navigator.vibrate` 在 WebView 不驱动马达；`@capacitor/haptics` 的 TOUCH 用法被系统触感开关拦截）。波形 `{0,120,60,120}`。
  - `MainActivity.java` 已 `registerPlugin(AlertVibratePlugin.class)`；`AndroidManifest.xml` 已加 `VIBRATE` 权限。
  - `lib/haptics.ts`：原生走 `registerPlugin("AlertVibrate")`，非原生降级 `navigator.vibrate([120,60,120])`；`/punishment/play` 的声音/震动入口接它。
  - 真机实测：`dumpsys vibrator_manager` 出现 `opPkg=night.party.app`、`status: running`（触感反馈关=0 也真震）；声音走真实应用内导航，`AudioContext` 振荡器计数=3。
  - Debug APK 已构建并安装到 Note 11T Pro+（`IN9LZTAYV4UGU4JF`）。**2026-10-02 10:38 经 WiFi adb 设备 `192.168.31.63:5555`（型号 `22041216UC`）重新出包并安装**（release 静态导出 → `./gradlew assembleDebug` → `adb install -r`）。恢复前一律先 `adb devices -l` 查实际设备。
- **首页「今晚开局（AI 组局）」按钮已按 Human 指令移除（2026-10-02）**：只删 `app/page.tsx` 那一个 `<Link href="/setup">今晚开局（AI 组局）</Link>`（连同其无用的 `play` import）；**8 个玩法卡片、底部导航、`/setup` 路由与引擎全部保留**。因该按钮是自测主入口，同步改了 7 个 e2e（`helpers.ts` 的 `startLocalGame` 改为直达 `/setup`；`smoke/visual/setup-flow/accessibility/exit-confirm/v1-1-recovery` 改为点底部「组局」或断言「大冒险」）。曾误将其它功能整体物理删除，已用 `git checkout HEAD -- .` 全量恢复，未提交。
- **首页按钮重叠已修复**：`app/globals.css` 增加 `.home-primary + .home-primary { margin-top: .9rem; }`；390×844 实测两按钮间隙 14.4px。产品冻结样式未改动。（移除上按钮后此规则对单个 `.home-primary` 无害。）
- **过时文案已删**：`app/punishment/page.tsx` 去掉「开发示范题库 · 正式题目待人工审核」；`components/punishment/PunishmentSettingsSheet.tsx` 去掉「当前为开发示范题库，正式题库等待人工审核。」，保留「仅在本机保存偏好与本局进度，不采集玩家信息。」（E2E 断言仍满足）。
- **测试全绿（本轮末次）**：unit 139 文件 / 1463 用例通过；E2E 118 passed / 7 skipped / 0 failed；`typecheck` 0 错误；`lint` 0 error / 11 既有 warning。skip 不计 PASS。
- **版本三处同值 1.6.0**：`package.json`、`public/sw.js`(`CACHE_VERSION`)、`public/version.json`。Android `versionName="1.0"` 是原生壳版本，与 web 版本独立。
- **Git 状态**：`main` HEAD `e0f7b06 feat(android): 接入原生震动插件，修复首页按钮重叠并收尾交接`（截至 2026-10-02 实测；旧文写的 `bb58bb9` 已过期）。当前「移除首页 AI 组局按钮」的改动**尚未 commit/push（未获授权）**，见第 6 节。
- **首次发布 Human 签收尚未完成**：不得称已正式完工；签收属 Human Gate。

## 2. 运行态与服务

- 生产站（旧副本，CLI 发布）：https://p039-bar-games.vercel.app/punishment 。旧 https://party-night-v1-2.vercel.app/ 不属于本轮发布目标，不要覆盖。
- 暂停时存在服务：Next 开发 3210（PID 99919，本仓库热更新用）；Next 生产 3320；Expo Metro 8083。PID 仅为快照，恢复必须重新查，不得擅杀其他项目服务（3000 为 `vercel dev`，非本仓库）。
- 本仓库自包含 release 构建用 `out/` 静态导出（`trailingSlash: true`）。Capacitor 深链接在本地服务会回退首页，应用内客户端导航不受影响。

## 3. 下一步任务（收到 Human 恢复指令后才执行）

1. 先 `adb devices -l` 查实际设备：Note 11T Pro+（`IN9LZTAYV4UGU4JF`）当前已断开；Redmi Note 12 Pro（`indq5xfi6hovay4d`，系统型号 22101316C/ruby）此前未连接、未推送。设备称呼以实测为准，多设备先重查。
2. 如需重新出包：`pnpm build:export` → `pnpm android:sync`（或 `pnpm android:release`）→ 安装到目标机；真机回归声音/震动/返回键/计时/切档。
3. 承接 Human 后续 UI/现场反馈做最小修复并真机验证；主项目变更跑适用 `typecheck`/`lint`/`test`/`test:e2e`/`build` 并留证据到 `docs/qa/`。
4. 待 Human 决定：盾牌设置页「关闭的内容不会出现在后续题目中」在空标签下不准确，是否改写。
5. 首次发布 Human 体验签收（UI/产品/现场操作）；不要新增角色或 Gate。

## 4. 快速恢复命令

```sh
# 项目根目录，先只读检查
git -c core.quotepath=false status --short
lsof -nP -iTCP:3210 -iTCP:3320 -iTCP:8083 -sTCP:LISTEN
adb devices -l
# 真机联调（设备序列号以实测为准）
adb -s <serial> reverse tcp:3320 tcp:3320
# 出包（JDK 21）
export JAVA_HOME=$HOME/android-toolchain/jdk-21.0.12.1+1/Contents/Home
pnpm build:export && pnpm android:sync
cd android && ./gradlew assembleDebug
```

## 5. 注意事项与相关规矩

- **优先级**：Human 最新明确要求 > AGENTS.md 治理母版 > 复制来的历史规则。单开发者连续执行，不派 Agent。
- **产品锁定（不得破坏）**：五个小圆点 1～5 档；五档不向下包含；大题卡/大英文；无大 Logo 挤占题卡；底部按钮一排；普通题「下一个/换一个」；计时题「开始 XX 秒」；0.3～0.5s 直接倒计时、无 3/2/1；暂停/继续/结束；结束回同题且不加「再来一次」；深浅只变主题；三语言；游戏内盾牌可改；切档无升级提示。
- **版本联动**：改 `package.json` version 必须同步 `public/sw.js` 的 `CACHE_VERSION` 与 `public/version.json`，三处同值（test 会卡）。
- **红线**：未获 Human 明确指令不 commit/push；不 `git clean/reset/stash`；不读/打印/提交 `.env*`、Token、密钥、隐私（`.vercel/`、`.env.local` 为本地忽略）。不 push 到 main 之外未授权分支。
- **Android**：先读 `docs/sop/android.md` 与 `docs/sop/android-machine-profile.md`；查实际设备；不卸载应用、不改签名、不做 `prebuild --clean`。ADB 需沙箱外授权。
- **不覆盖旧版封存**：`docs/handoff/archive/` 只追溯；`mobile-preview/`（Expo 预览壳，gitignored）为早期产物，非正式包，验证不代表正式 Android。
- **证据**：AC 与真实浏览器/真机截图落 `docs/qa/punishment/`（验收报告与追踪矩阵 `docs/qa/punishment/验收报告.md`）。

## 6. 提交状态（2026-10-05 更新）

- （已在 HEAD）移除首页「今晚开局（AI 组局）」按钮（2026-10-02 改动，随 `d204b30`/`24e6ead` 进入 main）：`app/page.tsx` + 7 个 e2e（`helpers.ts`、`smoke`、`visual`、`setup-flow`、`accessibility`、`exit-confirm`、`v1-1-recovery`）。**本地 HEAD 首页无该按钮，入口＝底部「组局」tab / 玩法卡片**。
- （已在 HEAD）2026-10-02 震动插件批次：`AndroidManifest.xml`、`MainActivity.java`、`app/globals.css`、`app/punishment/*`、`PunishmentSettingsSheet.tsx`、`tests/*`、`AlertVibratePlugin.java`、`lib/haptics.ts`。
- （已在 HEAD）2026-10-05：README 中英（首页截图限宽 300、在线试玩链接、修掉不存在的 `.env.example` 命令、入口改「组局」）+ ORCA 母版同步（AGENTS 增量、roles、账本校验脚本、`detect-client.sh` / `check-channel-preflight.sh` / `docs/sop/background-services.md` 新增）+ GitHub About（简介 67 字、8 个 topics）。
- **运行态差异（遗留一句）**：生产站 `party-night-v1-2.vercel.app` 与 `p039-bar-games.vercel.app` 首页仍有「今晚开局（AI 组局）」大按钮（旧构建），与 HEAD 不一致；待下次发布同步，本轮未覆盖发布。

## 交接整理记录

- 2026-10-01 经 Human 授权，将旧项目及本轮早期交接原样移至 `docs/handoff/archive/2026-10-01 丨 旧项目及本轮早期交接 丨 已失效.md`。未删除历史内容。
- 2026-10-02 经 Human 授权（【大交接 2】）做 neat-freak 收尾：重写本 HANDOFF 为当前唯一权威恢复入口（覆盖 20 条示范题/Android 未测/HEAD 018a368 等旧说法）；修复首页按钮重叠；commit + push（main）。
- 2026-10-02 按 Human 指令只移除首页「今晚开局（AI 组局）」按钮（其余功能全留），同步改 7 个 e2e；重出 release 包装到 `192.168.31.63:5555`。曾误删全部旧引擎，已 git 全量恢复；该批改动其后已随 `d204b30`/`24e6ead` 进入 main（原「本轮未 commit」已过期）。
- 2026-10-05 按 Human 指令（【jcp】洁癖＋授权自决清理）：README 维护收口（修 `.env.example` 死命令、入口改「组局」、在线试玩链接、首页截图限宽）；GitHub About 写入（简介 67 字＋8 topics）；删除 8 份无引用 `*.旧版-*` 备份与 `temp/`，还原 `.trae` 文档纯格式重排；账本 `LEDGER-OK`、README `DOCUMENTATION_READY`；commit + push（main）。