# QA 复验｜Change A：返回键退出确认

- 日期：2026-09-27
- 范围：EXIT-GUARD-001 返工复验；静态导出冷启动、退出确认行为、自动化回归与构建门禁
- QA_RESULT：**PASS**（Web/静态导出范围）
- P0：0
- P1：0（EXIT-GUARD-001 已 CLOSED）
- 放行建议：Web 与静态导出复验通过；NEW RC 重冻前仍须编排者完成本报告末尾 Android 真机项。真机项未回填前不应宣称 Android 硬件返回行为已验收。
  - 事实回填（neat-freak 2026-09-27 收口）：Android 真机项已于 2026-09-27 04:09 由编排者在 11T Pro+ 完成——**编排者自定的 5 项口径实测 5/5 PASS**（见 docs/qa/RG-01-NEWRC-SMOKE.md 末节），NEW RC 已重冻为 `82cec01`（main 已 push）。注意两处口径差别：① 那是编排者那套 5 项，与本报告 §H 的 5 项不是同一张单子，本报告第 2/4 项因 App 无 deep link 入口无法逐条在真机跑（§H 已逐项写明由同产物 18/18＋24/24 覆盖）；② 本 QA 的 `QA_RESULT=PASS` 范围口径不变——仍只覆盖 Web 与静态导出，Android 硬件返回与 `App.exitApp()` 由编排者真机记录背书，不并入本 QA 结论。

## A. EXIT-GUARD-001 冷启动复验

按上一轮“独立新 context，冷启动直开深路由；文档解析完成后立即回退”的口径，在 `out/` 静态导出 HTTP 服务（`127.0.0.1:4173`）上重复 8 次/路由。触发点为 `DOMContentLoaded` 后立即执行浏览器 `goBack()`。每次均记录 armed 标记、最终 URL、确认框数；无一次到达 `about:blank`。

| 路由 | 次数 | 每次结果（n=1…8） |
|---|---:|---|
| `/setup` | 8/8 PASS | 1 PASS：armed=1，留在 `/setup/`，确认框=1；2 PASS：armed=1，留在 `/setup/`，确认框=1；3 PASS：armed=1，留在 `/setup/`，确认框=1；4 PASS：armed=1，留在 `/setup/`，确认框=1；5 PASS：armed=1，留在 `/setup/`，确认框=1；6 PASS：armed=1，留在 `/setup/`，确认框=1；7 PASS：armed=1，留在 `/setup/`，确认框=1；8 PASS：armed=1，留在 `/setup/`，确认框=1。 |
| `/packs` | 8/8 PASS | 1 PASS：armed=1，留在 `/packs/`，确认框=1；2 PASS：armed=1，留在 `/packs/`，确认框=1；3 PASS：armed=1，留在 `/packs/`，确认框=1；4 PASS：armed=1，留在 `/packs/`，确认框=1；5 PASS：armed=1，留在 `/packs/`，确认框=1；6 PASS：armed=1，留在 `/packs/`，确认框=1；7 PASS：armed=1，留在 `/packs/`，确认框=1；8 PASS：armed=1，留在 `/packs/`，确认框=1。 |
| `/settings/ai` | 8/8 PASS | 1 PASS：armed=1，留在 `/settings/ai/`，确认框=1；2 PASS：armed=1，留在 `/settings/ai/`，确认框=1；3 PASS：armed=1，留在 `/settings/ai/`，确认框=1；4 PASS：armed=1，留在 `/settings/ai/`，确认框=1；5 PASS：armed=1，留在 `/settings/ai/`，确认框=1；6 PASS：armed=1，留在 `/settings/ai/`，确认框=1；7 PASS：armed=1，留在 `/settings/ai/`，确认框=1；8 PASS：armed=1，留在 `/settings/ai/`，确认框=1。 |

总计 24/24 PASS，about:blank=0，确认框数异常=0；EXIT-GUARD-001 **CLOSED**。此外新增冷启动 E2E 只列 `/setup` 与 `/settings/ai` 两条路由；`/packs` 的八次覆盖来自本轮独立 `/tmp` Playwright 复验。

## B. Builder 自述三项复核

| 项目 | 结果 |
|---|---|
| JS chunk 全断时返回仍留站内 | PASS：全断 `_next/static/**` 脚本后，head 内联初始化仍 armed；返回后仍停在 `/setup/`，不是 about:blank。React 不会运行，因此没有确认框；此项只证明空窗不离站。 |
| armed 后只有一条哨兵、只弹一个框 | PASS：history entry depth=1；回退弹出一个 dialog、URL 不变；再次回退只关框，仍留站内。 |
| 冷启动首页连按两次返回＝关框不退出 | PASS：第一次返回出现一个 dialog；第二次后 dialog=0、URL 仍为首页、没有 about:blank。 |

## C. 回归真实性与 E2E 口径

- `tests/unit/exit-guard-init.test.ts` 执行仓库实际 `EXIT_GUARD_INIT_SCRIPT` 源码，但宿主是手写 history/window/document 桩；它验证一次/重复初始化、`__NA`、储存异常与接管前 popstate 的预期。不是纯浏览器证明，也有脚本与被测实现共享源码的局限；本轮真实 Chromium 静态导出 24 次复验补足该部分证据。
- 新增 `tests/e2e/exit-confirm-cold-start.spec.ts` 使用 `goto(waitUntil: "commit")` 后等 `DOMContentLoaded` 才回退，并断言 armed、站内 URL 与 dialog；不是 commit 到首段 HTML 的最早时刻。该口径实际测的是“文档刚解析完成后”，本轮 24 次独立复验同样在此时触发。
- `git diff -- tests/e2e` 未显示已跟踪 E2E 文件改动。当前 `tests/e2e/exit-confirm.spec.ts`、`tests/e2e/exit-confirm-cold-start.spec.ts`、`tests/unit/exit-guard-init.test.ts` 均为未跟踪新文件；所以不能从 Git 历史确认 `exit-confirm.spec.ts`“仅第 9 行注释”，只能确认既有已跟踪 E2E spec 没有被改口径。
- 全量 E2E 第一次 104 passed、4 skipped、1 failed：`session-recovery.spec.ts` 在并发运行时等待首页“今晚开局”超时 30 秒。该用例单独重跑通过；随后全量重跑 105 passed、4 skipped。记录为一次未复现的并发波动，不是静默抹去首轮失败。
- BrowserOS neo MCP 工具本轮不可用。依照已告知的限制，本轮按用户要求用 Playwright/Chromium 做静态导出和 E2E 复验；这不是 BrowserOS neo 会话证据。

## D. `/packs/` 尾斜杠断言

- `pnpm exec playwright test tests/e2e/exit-confirm.spec.ts --grep '多层页面逐级返回'`（dev）通过；dev 的现有 E2E URL 断言 `/\/packs(\?|$)/` 成立。
- `out/` 静态导出实际回退 URL 为 `http://127.0.0.1:4173/packs/`，用户仍在正确的 packs 页面且没有确认框；旧断言 `/\/packs(\?|$)/` 对这个尾斜杠 URL 为 false。产品行为通过，差异来自静态导出 `trailingSlash: true` 与 dev URL 形式不同。
- 等级：**P3（测试口径兼容性）**，不是实现缺陷。建议修测试断言为兼容可选尾斜杠，例如 `/\/packs\/?(?:\?|$)/`；不要为满足断言改路由实现。当前 E2E 配置跑 dev，故现有全量 dev E2E 不受影响；若未来把同一断言用于 `out/` 会误报失败。

## E. 全门禁

| 命令 | 本轮结果 |
|---|---|
| `pnpm lint` | exit 0；0 errors、7 warnings（`scripts/decision/*`、`tests/phone/dump-state.ts`） |
| `npx tsc --noEmit` | exit 0；无输出 |
| `pnpm vitest run` | exit 0；102 files passed，927 passed，0 failed；17.74s |
| `pnpm test:e2e` | 首轮 104 passed/4 skipped/1 session-recovery 超时；该用例单跑通过；全量复跑 exit 0，105 passed/4 skipped，2.2m |
| `pnpm build` | exit 0；Next 16.3.3 production build 成功，静态/SSG 路由生成完成 |
| `pnpm build:export` | exit 0；`out/` 静态导出完成，包含 `/setup`、`/packs`、`/packs/new`、`/settings/ai` |

## F. 行为复核（`out/` 静态导出，独立 Playwright/Chromium）

| 场景 | 结果 |
|---|---|
| 有上一层的 `/setup` 返回 | PASS：回到首页，无确认框 |
| 有上一层的 `/packs` 返回 | PASS：回到首页，无确认框 |
| `/packs/new` 返回 | PASS：回到 `/packs/`，无确认框 |
| 有上一层的 `/settings/ai` 返回 | PASS：回到首页，无确认框 |
| 弹框开着再返回 | PASS：只关闭框，URL 仍为首页 |
| 继续玩按钮 | PASS：取消，停在首页 |
| ESC | PASS：取消，停在首页 |
| 点击遮罩 | PASS：取消，停在首页 |
| 点击「退出」 | PASS：离开本站至 `about:blank`（Web 可验证口径） |
| 刷新后守门、连续两次返回 | PASS：刷新后 armed=1；第一次开框，第二次关框，仍在首页 |

## G. 依赖、生成物、版本与隐私

- `@capacitor/app` 7.1.2 可解析：`node_modules/@capacitor/app/dist/plugin.cjs.js`；`@capacitor/core` 为 7.6.9。
- Android 生成物差异只有插件引用：`android/capacitor.settings.gradle` 增加 `:capacitor-app` 与相对 `../node_modules/@capacitor/app/android` 路径；`android/app/capacitor.build.gradle` 增加 `implementation project(':capacitor-app')`。没有机器绝对路径或密钥。
- 三处版本一致且未 bump：`package.json=1.5.0`、`public/version.json=1.5.0`、`public/sw.js CACHE_VERSION=1.5.0`。
- 退出守门改动仅在本地读写 history、localStorage 与事件；退出按钮调用 `App.exitApp()` / Web `location.replace()`。新增守门代码未见网络上报或遥测调用。
- `git diff --check` 通过。`next-env.d.ts` 由构建自动重写，随 `next dev`/`next build` 在 `.next/dev/types/…` 与 `.next/types/…` 两个变体间切换，本轮未把它当业务改动处理、也未人工固定其路径形态（`82cec01` 提交的是 `.next/dev/types/…` 变体；**2026-09-27 收口订正**：其后的启动白屏 RC `eeaebf3` 已把仓库内容改为 `.next/types/…` 变体，并随 `pnpm build:export` 自动落盘，不需要人工干预）；未改 app/lib/tests/scripts/android 中任何文件。

## H. 真机项（已回填：2026-09-27 04:09，编排者在 11T Pro+ 实测）

本 QA 未连接设备、未调用 adb；下列 5 项由编排者在 NEW RC 真机执行并记录，本节只做映射与背书，不改本 QA 的 `QA_RESULT` 范围（仍只覆盖 Web 与静态导出）。

| QA 项 | 真机实测 | 证据 |
|---|---|---|
| 1 冷启动首页按一次硬件返回出确认框；点「继续玩」仍留首页 | PASS | RG-01-NEWRC-SMOKE 末节 ① ②（`/tmp/exitguard-back1.png`） |
| 2 从首页进入 `/setup`、`/packs`、`/packs/new`、`/settings/ai` 逐级回退且不弹框 | **部分**：真机实测 `/setup`（组局 tab 进入）返回正常回退、确认框计数 0 ⇒ PASS；`/packs`、`/packs/new`、`/settings/ai` **无法用 adb 直达**（App 无 deep link 入口），未在真机跑过，由同一份 `out/` 静态导出产物上的独立复验覆盖：reviewer 18/18（A/B/C/D 四组）、本 QA 24/24（三条深路由各 8 次，无 `about:blank`） | RG-01-NEWRC-SMOKE 末节 ④ 与结论第 3 段；CODE_REVIEW-EXIT-GUARD 返工复核 A 组 10 轮无偶发 |
| 3 确认框开着再按返回只关框、快速连按无静默退出/无重复框 | PASS | RG-01-NEWRC-SMOKE 末节 ③（dialog 1→0、`data-pn-exit-guard-armed=1`） |
| 4 冷启动直达 `/setup` 后立刻触发硬件返回 | **真机不可达**（无 deep link 入口）；等价口径已覆盖：head 内联初始化脚本在 `DOMContentLoaded` 前必然执行，armed 必为 1（同产物 A 组 10 轮无偶发；`exit-confirm-cold-start.spec.ts` 5/5；`exit-confirm.spec.ts` dev 与 `out/` 两口径各 11 passed）；commit→head 解析间 54–119ms 的残余空窗按 P3 记账（CODE_REVIEW-EXIT-GUARD 返工复核 §1） | CODE_REVIEW-EXIT-GUARD 返工复核第 1 条与 P3「解析前空窗残余」 |
| 5 点确认框「退出」后由 `App.exitApp()` 实际退出 | PASS | RG-01-NEWRC-SMOKE 末节 ⑤（`mCurrentFocus` 切到 `com.miui.home/…Launcher`，Activity 已 finish） |

- 回填设备：Redmi 22041216UC / xagapro，序列号 `IN9LZTAYV4UGU4JF`（USB，全程 `-s` 指定；12 Pro `indq5xfi6hovay4d` 未碰）；安装包为 Change A 返工后重建的 debug 签名包（同源 release web 资产 ＋ `@capacitor/app@7.1.2`），`install -r` = Success，对应 commit `82cec01`；设备状态已复原（飞行模式 `airplane_mode_on=0`）。
- 结论：Android 硬件返回 ＋ 确认框 ＋ 真退出真机 PASS；NEW RC `82cec01` 已重冻。**RG-01 整项仍 NOT_STARTED**——开局抽卡～mutual/MATCH/隐私等真人手点项未开始，机器不得代点。
