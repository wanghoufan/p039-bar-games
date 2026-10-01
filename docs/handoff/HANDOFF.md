# 小交接｜2026-10-01（Asia/Shanghai）｜开发暂停，恢复先读本段

> Human 最新要求：开发先到这里，暂时结束。当前暂停；不要自动恢复开发。本文件是当前唯一恢复入口。旧交接已移到 `archive/`，仅供追溯；日常恢复开发不读取归档。旧交接中的“adb 无设备”“未部署”“1.5.0”和旧多角色流程均不能覆盖本文件的当前状态。

## 1. 当前工作进度

- 本轮单开发者完成独立大冒险模式：`/punishment` 准备页、`/punishment/play` 题卡页；旧功能保留。入口为主页“大冒险”。没有接入旧 Heat、Mutual、关系算法或实时 AI。
- 实现五档独立题池、低调小圆点切档、盾牌过滤、空状态、下一题/换题、周期内防重复、中/英/双语、深浅主题、题目字段计时、无 3/2/1、暂停/继续/结束、结束恢复同题、声音及浏览器支持时震动。当前仅 20 条开发示范题（每档 4 条），正式题库待 Human 提供。
- 新模式主文件：`app/punishment/`、`components/punishment/`、`lib/punishment/`、`content/punishment/challenges.ts`；视觉样式在 `app/globals.css`。沿用原基础组件和配色。
- 应用版本三处均为 1.6.0：`package.json`、`public/sw.js`、`public/version.json`。SW 增加新模式离线入口。静态导出脚本补齐遗漏测试文件的暂存/恢复。
- 独立新生产站已 CLI 发布：https://p039-bar-games.vercel.app/punishment 。旧 https://party-night-v1-2.vercel.app/ 不属于本轮新副本发布目标，不要覆盖。Vercel 发布 Ready（dpl_7D5B3poDMNwk1iT4sRBXqVToBxoD）。
- Spec Kit 等价文档已落 `.specify/memory/constitution.md`、`specs/001-dare-punishment/`；没有执行不可用的 slash command/init，也没有宣称工具级 Converged。
- 技术测试（增加 Expo 壳前的主项目基线）：typecheck、build、static export 通过；unit 139 文件/1463 用例通过；完整 E2E 116 通过/7 条条件跳过；新增 12 项通过；本地生产离线 2 项通过；线上 13 项通过；lint 0 error/11 既有 warning。跳过项不是 PASS。Android release 资源同步通过，未生成或安装正式新 APK。
- 证据与 AC 矩阵：`docs/qa/punishment/验收报告.md`，同目录保存日志和真实截图。首次发布最终 Human 体验签收尚未明确完成，不得称已正式完工。

## 2. 本轮后续手机预览与修复（最新状态）

- Human 要求 Expo Go 直接送到已连接手机，已创建独立 `mobile-preview/` WebView 预览壳（不是将主项目迁移为原生 React Native）。该目录已加入 `.gitignore` 和 `.vercelignore`，源码、package-lock、二维码都仅本机保留；后续搬机器时需要单独保留或重建。
- Expo SDK 57.0.26，React 19.2.3，RN 0.86.3，WebView 13.16.1，safe-area-context ~5.7.0。Android/iOS export 均已通过；安卓返回键修改后再次 Android export 通过。
- ADB 实际发现唯一设备 `indq5xfi6hovay4d`（系统型号 22101316C/ruby，Human 称 Note 11T Pro）；已安装 Expo Go。不要仅凭 Human 称呼更换设备目标，多设备时先重新查 `adb devices -l`。
- 手机访问 Vercel 页面发生 `ERR_CONNECTION_TIMED_OUT`，因此预览壳现在打开 `http://127.0.0.1:3320/punishment`，通过 `adb reverse` 走 USB 本机生产服务；Expo Go 也以 `exp://127.0.0.1:8083` 打开。当前手机预览依赖数据线及本机两个服务，不能把原 LAN 二维码描述为独立可用的线上预览。
- 修复安卓返回键直接退出 Expo Go：`mobile-preview/App.js` 接入 BackHandler；弹窗先 Escape 关闭；游戏返回准备页；准备页返回主页；主页保留系统退出行为。真机实际验证了“题卡 → 按返回 → 准备页 → 再按返回 → 主页”，没有退出。证据 `docs/qa/punishment/返回键游戏.png`、`返回键准备页.png`、`返回键主页.png`。弹窗返回逻辑已实现，本轮没有单独保存实测证据，不得扩大测试结论。
- 此修复仅作用于 Expo Go 预览壳；正式 Capacitor APK 返回行为不能据此判定通过。声音/震动在该真机 WebView 尚未做完整体验验收。

## 3. 下一步任务（收到 Human 恢复指令后才执行）

1. 先恢复手机预览并检查实际运行状态，承接 Human 的 UI/现场操作反馈；当前最新反馈“安卓返回直接退出”已修复，不要重复从头开发。
2. 对用户提出的后续问题做最小修复并真机验证，尤其计时声音/震动、弹窗返回、后台返回、深浅主题、双语可读性；主项目变更仍跑适用 typecheck/lint/unit/E2E/build 并保留证据。
3. Human 提供正式人工审核题库后，按新五档 schema 做必要校验/入库/回归；不自行扩写正式题，不使用旧 Heat 题库治理链套新模式。
4. 根据 Human 明确需求决定是否制作正式 APK；Expo 壳验证不等于正式 Android 包验证。不得未经要求执行 expo prebuild 或清理重建原生目录。
5. 获明确授权后再整理本副本 Git 基线、commit/push。当前大量 app/docs/android 等为复制后未跟踪文件，不能盲目 git add .，不能 reset/clean/stash 现有工作。
6. 最终 Human Gate 用于 UI、产品体验和现场操作签收；不要新增角色、治理流程或新 Gate。

## 4. 快速恢复命令与当前服务

暂停时检查：Next 开发 3210（PID 99919），Next 生产 3320（PID 31322），Expo Metro 8083（PID 35624）仍监听。PID 仅为此次快照，恢复必须重新查；本轮未关闭服务，便于手机继续查看。3000、8081、8082 曾有其他服务占用，不得擅自关闭。

```sh
# 在项目根目录，先只读检查
 git -c core.quotepath=false status --short
 lsof -nP -iTCP:3320 -iTCP:8083 -sTCP:LISTEN
 adb devices -l
# 服务已在则复用；不在且端口空闲才启动
 pnpm start --port 3320
# 另一个终端
 cd mobile-preview
 npm start
# 项目根目录/任意终端：仅当设备序列号仍与实际一致
 adb -s indq5xfi6hovay4d reverse tcp:3320 tcp:3320
 adb -s indq5xfi6hovay4d reverse tcp:8083 tcp:8083
 adb -s indq5xfi6hovay4d shell am start -a android.intent.action.VIEW -d exp://127.0.0.1:8083 -p host.exp.exponent
```

若改端口，必须同步 WebView 地址和 adb reverse。主项目新 build 会使正在运行的生产服务资源失配，构建后应重启自己启动的服务并验证，不能杀其他项目服务。当前 Expo URL 固定 USB 回环地址；无需让 Human 扫码或手动投屏。

## 5. 注意事项与相关规矩

- 优先级：Human 最新明确要求 > 本次 SDD V1.1 > 当前代码/复制来的历史规则。用户明确要求单开发者连续执行，不派新 Agent，不伪装独立 Reviewer；本次暂停是 Human 明确要求。
- 源 SDD 和参考图在 `docs/plan/2026-10-01 丨 Mac Mini 丨 ChatGPT 丨 Party Night 大冒险惩罚工具-SDD四件套-交接上下文 丨 V1.1/`。恢复读取 Constitution → SPEC → PLAN → TASK → UI 图 → 当前代码及 Git。`docs/ui/punishment-mode/reference.png` 为已保存参考图。
- 产品锁定：五个小圆点 1～5 档；五档不向下包含；大题卡/大英文；无大 Logo 挤占题卡；底部一排；普通题下一个/换一个；计时题加开始 XX 秒；0.3～0.5 秒内直接倒计时、无321；暂停/继续/结束；结束回同题且不加再来一次；深浅只变主题；三种语言；游戏内盾牌可修改；主持人切档无明显升级提示。
- 中文沟通；改代码后测试；AC 与真实浏览器/真机证据落 `docs/qa/`。首次发布未经 Human 明确签收不能写完工。
- 不改原旧版封存，不删除旧功能；不读/打印/提交 `.env*`、Token、密钥或隐私；`.vercel/` 与 `.env.local` 是部署生成的本地忽略内容。
- 未获 Human 明确指令不执行 git commit/push。当前 main HEAD `018a368 chore: bootstrap 酒吧游戏 (P039)`；`.gitignore`、README.md 为 tracked 修改，大量源码未跟踪；本轮没有 commit/push，CLI 部署与 Git HEAD 不能混淆。
- Android 操作先读 `~/.agents/rules/android.md` 与 `android-machine-profile.md`，查实际设备；不卸载应用、不改签名、不做 prebuild --clean。本轮 ADB 需要沙箱外授权，由工具 auto-review 正常批准；不存在遗留拒绝。
- root lint/typecheck 的上述基线在 Expo 壳创建前取得；若恢复后根工具扫描嵌套 mobile-preview 产生干扰，应按独立预览目录处理，不能掩盖真实主项目错误。
- 旧任务/派工实绩账本没有重写；schema 检查曾 LEDGER-OK（既有 warnings）。不要把单开发者自检冒充旧多角色链审批。



## 交接整理记录

2026-10-01 经 Human 授权，将旧项目及本轮早期交接原样移至 `archive/2026-10-01 丨 旧项目及本轮早期交接 丨 已失效.md`。HANDOFF.md 只保留最新小交接；归档不作为恢复入口。未删除历史内容，未改业务代码，未 commit/push。
