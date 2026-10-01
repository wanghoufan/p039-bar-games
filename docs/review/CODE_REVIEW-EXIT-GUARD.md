# CODE REVIEW

- Task: Change A 小改复评——返回键退出确认（用户 2026-09-27：「现在点击返回就直接退出软件了，增加软件退出确认功能（用户可能不小心多点击了返回键）」）
- Commit: 未提交工作区（builder 产出；本次复核只读，未改任何仓库文件）
  - 事实回填（neat-freak 2026-09-27 收口）：本单改动已随 `82cec01` 提交并 push（main，2026-09-27 04:31）；复核当时的「未提交工作区」即该提交内容，其后无同范围改动。NEW RC = `82cec01`。
- Reviewer: code-reviewer（glm-5.3-flash，独立 session）
- Result: **过**

## P0 / P1 计数

- P0：0
- P1：0

## 自测证据（全部实际执行）

- `npx tsc --noEmit`：通过。
- `pnpm vitest run`：915 passed（101 文件，含新增 exit-guard 13 例），全绿。
- `pnpm lint`：0 error（7 warning 全为既有）。
- `pnpm test:e2e`：100 passed + 4 skipped（基线 94+6 新增，数字吻合）。
- 专项跑 `tests/e2e/exit-confirm.spec.ts`：6/6 过。
- 版本三处同值核对：package.json `1.5.0`＝public/sw.js:7 `CACHE_VERSION "1.5.0"`＝version.json，本轮未动。

## 七查

| 查 | 结论 |
|---|---|
| DEV_BASELINE 一致 | 一致。Change A 留在 DEVELOP 内小改，未触碰 Plan 边界 |
| Requirement 覆盖 | 覆盖。顶层返回弹确认、误触可取消、有上级照旧回退，均有实现＋单测＋E2E 证据 |
| DoD 达成 | 达成。单测/E2E/tsc/lint 全绿，无口径放水 |
| Diff 越界 | 无。diff 仅任务书所列文件，版本号三处未动，未碰 D1~D8/题库/safety-filter/route/矩阵 harness/AI 直连 |
| 回归影响 | 已核。既有 E2E spec 零改动（git status 仅新增文件，无一用 goBack）；reload 类用例因未加 beforeunload 不受影响；Next 自身 history patch 与本守门叠加关系已逐行核过（见清单 4） |
| P0-P2 分级 | P0=0、P1=0；P2×3、P3×2（见 backlog） |
| 可回滚性 | 好。改动集中（2 新文件＋layout 挂载 1 行＋CSS 2 行＋1 依赖），revert 即完全还原；android/ 两个 gradle 为 cap sync 生成物，可再生成 |

## 必查清单逐条结论

### 1. 是否真的只拦「退出会离开 App」那一层 —— 是 ✓
判定只看真实历史落点深度（lib/system/exit-guard.ts:47-51：depth≥1 → allow，0/null → confirm），不猜路由层级。/setup、/packs/new、局内子页、/settings/ai 均经 Link 或 router.push/router.replace（app/setup/page.tsx:88,103 等），全部走被套壳的 pushState/replaceState 打上 depth≥1，返回照旧回退、不弹框、不多一次点击。E2E 第 5 例证 /setup 返回直回首页无弹框，第 6 例证 /packs/new 两层逐级返回都不弹、退到顶层才弹。

### 2. 会不会把用户困住 —— 不会 ✓
连点返回＝弹框开/关切换、全程不退出（unit :86-100、E2E :56-71「第二次关框、第三次重新弹」）；弹框开着再返回只关框（exit-guard.ts:48 dialogOpen 优先 dismiss）；ESC 与点遮罩走 Modal onClose→cancel（components/ui/Modal.tsx:9,15）；刷新后随 hydration 重新装配（E2E 统一等 `data-pn-exit-guard-armed` 即证）；切后台不改 history、恢复后状态机不变。「守门装配前的返回」空窗核实：Web 冷启动首次进入时浏览器历史里没有上一条，返回无事可做、**不会静默退出**；Android 原生侧 listener 挂上前的返回仍是系统默认退出（与改动前行为一致，窗口为 hydration＋动态 import 的几百毫秒，记 P2）。

### 3. 状态机是否可能双弹或误退 —— 不会 ✓
最危险的双通道叠加已排除：Android 上注册 backButton listener 后 Capacitor 不再执行默认返回，原生路径只有 canGoBack→`history.back()`→popstate 这一条单行道（ExitConfirmGuard.tsx:103-109）；canGoBack=false 才 notifyBack(null)。Web 上只有 popstate 一条。`exit` 副作用只由确认框按钮的 confirm 事件触发，且框已关时 reduce 出 effect="none"（exit-guard.ts:56，unit :80-84 有防重放断言）；dispatch 经 guardRef 同步更新，popstate 与原生事件竞态也不会双开框。

### 4. 判定实现是否可靠 —— 可靠，但正确性建立在 Next 内部时序上（P2 记录）✓
逐行核了 Next 16.3.3 源码，结论：**套壳有效且不会被 Next 绕过**。
- Next 自己也 patch pushState/replaceState（node_modules/next/dist/client/components/app-router.js:252-278），但其 patch 的 useEffect 绑定「当时的 history.pushState」为 original（:234-235）；ExitConfirmGuard 是 AppRouter 的子组件、effect 先于父组件执行，故链序为：Next wrapper → 我们的 wrapper（打深度标）→ native。Next 自身导航的 state 带 `__NA`，走 ：255 快捷路径直调 original＝我们的 wrapper，**照样被打标**——Link/replace 无绕过路径。
- 哨兵条目带 `__NA`：Next 的 HistoryUpdater 在 Router 树中先于页面 content 渲染（app-router.js:427），其 effect 先用原生 replaceState 打上 `__NA`+tree（:56-66），我们随后装配时哨兵复制当前 state（含 `__NA`）。因此返回落在哨兵时，Next 的 popstate 处理器（:284-292，无 `__NA` 会 `location.reload()`）不会误触整页刷新。
- service worker 不改写 history，无影响；浏览器刷新后重新装配、以刷新页为新入口（语义正确）；冷启动 deep link 直开 /setup 时入口即 /setup，首次返回弹确认——正确（确实没有 App 内上一级）。
- P2：以上「HistoryUpdater 先于 content、子 effect 先于父 effect」是对 Next 内部实现顺序的依赖，Next 升级可能静默破坏（失效方向是到处弹确认/整页刷新等 fail-safe 行为，**不是静默退出**）。建议 backlog 加兜底：popstate 里 `event.state?.__NA && landedDepth === null` 时按 allow 处理，并给 Next 升级加一条返回键金丝雀断言。

### 5. Android 真退出 —— 是 ✓
唯一退出路径是官方 `App.exitApp()`（ExitConfirmGuard.tsx:48-59），插件不可用时兜底 Web 口径而非装死。android/ 侧仅两个 gradle 差异且均为 `cap sync` 生成物（capacitor.settings.gradle / capacitor.build.gradle 的 plugin 注册），无任何手改 Java/Kotlin。canGoBack 由 App 插件读同一 WebView 的 back/forward list，与 JS history 同源，无不一致风险。

### 6. 依赖变更合规 —— 合规，且无更轻方案 ✓
- @capacitor/app 7.1.2 的 peerDep 是 `>=7.0.0`（pnpm-lock.yaml:184-186），core 7.6.9 满足；官方插件本就与 core 独立版本序列，该组合是标准搭配，无已知不兼容。
- builder 跳过 beforeunload 的取舍**正确**：① Android 硬件返回根本不触发 beforeunload（退出发生在 Activity 层），拦不住需求场景；② 移动浏览器对 beforeunload 也基本忽略；③ 会挂掉既有约 15 处 `page.reload()` 的 E2E（grep 证据：session-recovery / v1-1-recovery / pwa-* 等）。不加是对的。
- 「更轻方案」不存在：纯 Web 哨兵拦不住 canGoBack=false 时的默认退出（无 JS 事件可挂），等价方案只有手写原生代码——比官方插件更重。依赖为必要。

### 7. 文案与隐私 —— 合格 ✓
弹框纯固定文案「要退出 Party Night 吗？/不小心点到返回了？点「继续玩」就留在这里。」（ExitConfirmGuard.tsx:135-140），无玩家名、Key、题面、局内信息；复用既有 Modal 与 Button、未另造弹层；danger=退出 / ghost=继续玩，危险/次要层级合适；中文语气与现有弹层一致；CSS 仅加一个 `.exit-confirm__text`（globals.css:227-228）。

### 8. 是否破坏既有行为 —— 无 ✓
- 既有 E2E spec 零改动：git status 显示 tests/ 下只有新增文件，无任何既有 spec 被改口径；E2E 94+4skip → 100+4skip 的 +6 全部来自新 spec，不是改松换来的。
- PWA/SW：未加 beforeunload，page.reload 类用例不受影响（全量绿即证）；VersionGuard、暂停/耗尽弹层、mutual 弹层、四 Tab 均未触碰。
- 单测 915 全绿（含 v2-mutual-check 中「源码不得用 history.pushState」的既有门，未被波及）。
- 备注：复核过程中一次带错参数的全量 E2E 调用退出码 1，为调用方式问题；干净重跑 100 passed + 4 skipped、退出码 0。

### 9. 越界 —— 无 ✓
版本号三处仍 1.5.0（本轮未动 package.json version / sw.js / version.json）；diff 仅任务书所列 11 个文件；未碰业务玩法、D1~D8、题库、safety-filter、route、矩阵 harness、AI 直连。

### 10. 测试可证伪性 —— 合格 ✓
- 单测全用字面深度（0/2/3/9），无「用被测实现自己算期望值」的自证循环；「连点三返回全程不 exit」（:86-100）、「框关时 confirm 不再 exit」（:83）这类断言在实现改弱（如 dismiss 误改 exit）时会立刻变红。
- E2E 的 armed 属性虽 import 自实现模块，但只作等待闩（等到装配完成再测），不是正确性断言，可接受；/setup 不弹框、多层逐级返回等断言均为真实行为断言。
- 「点退出→about:blank」口径：浏览器环境确实无权关标签页，以「真实离开当前页」为诚出口径可接受，不构成假通过；但它**证明不了真机 exitApp**——真机 QA 必测项见 backlog。

## P2 / P3 Backlog Findings

- **P2｜真机两项必测**：① backButton 手势/按键全链路（canGoBack 回退、退无可退弹框、退出真消失）；② 装配空窗：冷启动后立刻按返回仍是默认退出（与改动前一致，属已知残余风险；如要收窄，可把 backButton 监听提到更早的启动时机）。
- **P2｜Next 升级时序依赖**：判定正确性依赖「HistoryUpdater 先于 content 渲染、子 effect 先于父 effect」（见清单 4）。建议：① popstate 兜底 `event.state?.__NA && landedDepth === null` 按 allow；② Next 升级 checklist 加一条返回键金丝雀。
- **P2｜刷新后深度模型重置**：局内页刷新后该页成为新入口，此时按返回首次会误弹「要退出吗」（fail-safe 方向，可取消，不困人）。如在意，可在装配时向后探测上一条是否带本 App 标记再定入口深度。
- **P3｜Web「退出」可逆**：location.replace(about:blank) 后浏览器返回可回到 App（浏览器无权关标签，属平台限制；真机走 exitApp 不受影响）。
- **P3｜Modal 无焦点陷阱**：键盘用户 Tab 可绕到弹层后方控件（复用既有 Modal 的既有局限，非本次引入）。

---

## 返工复核（第 2 单：QA 打回 EXIT-GUARD-001 后，2026-09-27）

- Result: **过**
- P0：0　P1：0（EXIT-GUARD-001 判定闭环）
- 新增 P3×4（见文末），无新增 P2。

### 自测证据（全部实际执行）

- `npx tsc --noEmit`：通过。
- `pnpm vitest run`：102 文件 **927 passed** 全绿（基线 915＋新增 exit-guard-init 12 例，数字吻合）。
- `pnpm lint`：0 error（7 warning 全为既有）。
- `pnpm test:e2e tests/e2e/exit-confirm-cold-start.spec.ts`：**5/5 过**（dev server）。
- /tmp 独立 Playwright 脚本在 `out/` 静态导出（自建静态服务，端口避让未杀他人服务）**18/18 PASS**：
  - A 组×10（/setup、/settings/ai 各 5 轮，DCL 立即返回）：armed=1、URL 留站内、深度回落 1（哨兵已补回）、确认框出现，无偶发。
  - B 组×3（commit 后立即 goBack，QA 原口径）：仍落 about:blank——解析前空窗的表征实测，见下。
  - C 组×2（`_next/static` 脚本全断）：armed=1、返回留站内、无框（无 React 无框＝预期），不静默离站。
  - D 组×3：commit→armed 实测 **54–119ms**。

### 逐条结论

#### 1. QA P1 是否闭环 —— 闭环（以「用户可感知的首屏时刻」为口径）✓

- 规范保证而非运气：`<script id="party-night-exit-guard-init">` 是 head 内同步内联脚本（app/layout.tsx:40，导出 HTML 原样输出已实证），**必然先于 DOMContentLoaded 执行**，故「文档刚解析完」时 armed 必为 1——A 组 10/10、E2E 5/5 复现，无偶发。
- chunk 全断也不静默离开：C 组 2/2 留站内（哨兵由内联脚本压，不依赖 React）。
- 残余空窗表征：commit→head 解析之间（实测 54–119ms）任何页内手段原理上覆盖不到（那一刻没有任何一行本页代码执行过），B 组 3/3 仍 about:blank。该窗口内页面零渲染、无任何可点 UI，与改动前默认行为一致，builder 在 spec 注释中的口径说明成立（tests/e2e/exit-confirm-cold-start.spec.ts:10-15）。**记 P3 残余**，不阻并入；真机 QA 第 4 项（冷启动直达深路由立刻返回）保持必测。

#### 2a. 内联脚本写 __NA 是否安全 —— 安全，且实为必要 ✓

- 必要性复核 Next 16.3.3 源码：app-router.js:290-292 的 onPopState 对「有 state 无 __NA」条目 `location.reload()`；init 脚本给入口与哨兵都带 __NA（exit-guard.ts:64-66），消除了「hydration 前返回落到自家条目→整页 reload」这条路径。缺内部树安全：restoreReducer 对缺树有兜底（沿用当前 tree），且 Next hydration 时 HistoryUpdater 会用完整 __NA+tree 重写当前条目。
- 不会掩盖真实外来导航：copy/stamp 保留宿主自有键只加深度标（exit-guard.ts:57-58、stampDepth :137-140）；__NA 只打在本页条目上，外来条目（无标记）读深度为 null → 弹确认，语义正确。
- 链序复核（load-bearing，已再次确认）：子组件 effect 先于 AppRouter 的 patch effect；patch 捕获「当时的 history.pushState」为 original（app-router.js:252-278），即我们的 wrapper——Next 自身导航与 HistoryUpdater 的 replaceState 全部经我们的 wrapper 打深度标。E2E 多层逐级返回不弹框即此链序的行为学证据。
- 上一轮建议的 popstate 兜底（`__NA 且 landedDepth 为空则放行`）**未实现，判定为「不再需要」，不升 P1/P2**：该兜底的触发前提是「App 内条目缺深度标」，新架构下已被结构性消除——所有 App 内条目要么由 init 脚本打标（入口+哨兵），要么经 wrapper 打标（Next 导航/接管重打），故「landedDepth===null ⇒ 界外」在接管后恒真，弹确认才是正确语义。
- 残余 P3：接管后 popstate 兜底补哨兵 `armSentinel` 直接复制 `window.history.state`（ExitConfirmGuard.tsx:68-71），若真出现 null-state 条目会压出缺 __NA 的哨兵（popstate 落其上会被 Next reload）。当前架构下 null-state 条目不存在（init 脚本给初始条目打了标），属隐性依赖——建议 armSentinel 兜底补 `__NA:true`。

#### 2b. 双重哨兵 / 交接标记错乱 —— 无 ✓

- armed 时 `planExitGuardTakeover` 永不返回 needsSentinel=true（exit-guard.ts:111-117）：最坏情况（earlyDepth/stateDepth 都读不到）也按「当前是哨兵」起算，**绝不把哨兵当入口、绝不重复压**；双向都有断言钉住——「不做成入口多一次点击」（unit exit-guard.test.ts:63-78）、「hydration 后深度仍=1、出现 2 即重复压」（E2E cold-start :70-86）。
- StrictMode（next.config.ts reactStrictMode:true）双 effect：installExitGuard 由模块级 `installed` 挡（ExitConfirmGuard.tsx:39,80）；hydration 重跑：dispatch 引用稳定（useCallback []）effect 不重跑，即便重跑 installed+needsSentinel=false 双保险；SW 刷新＝新文档，init/takeover 各恰好一次；软导航＝根布局常驻不重挂。
- 「哨兵被当入口→顶层不弹框」与「多压一条→有层也弹框」两个错向分别被 takeover 单测与 E2E 深度断言覆盖，均证伪可行。
- dev-only P3：attachNativeBackButton 的 `nativeAttached` 在 await 之后置位（ExitConfirmGuard.tsx:140-141），StrictMode 双 effect 竞态可挂双 backButton listener；生产构建 React 不双调 effect，真机不受影响。

#### 2c. 幂等 / bfcache —— 合格 ✓

- 同一次文档解析只跑一次：head 同步内联脚本解析期执行、hydration 不重放 head 内联脚本；即便假设性重执行，armed attr＋`window[G]` 双闩使其成 no-op——该幂等性由**真源码**单测跑两次验证（exit-guard-init.test.ts:116-125：pushed/replaced 仍为 1、历史长度仍 2）。
- bfcache（pageshow persisted）不重新执行任何脚本、不重跑 hydration、`installed` 与状态机原样存活——不会重复压哨兵、返回不多按一次。
- 接管前的临时 popstate 监听以 `taken`＋detach 完整移交（exit-guard.ts:67-73、ExitConfirmGuard.tsx:117-120），交接后内联监听不再插手（unit :155-176 有断言）。

#### 2d. SSR/CSR 与安全 —— 合格 ✓

- 导出 HTML 原样输出该 `<script>`（out/setup/index.html 实证），静态导出 CSP meta `script-src 'self' 'unsafe-inline'` 随页下发 → 允许执行；服务器模式走 next.config headers，同一白名单。
- 无 XSS 面：脚本内容全部为编译期常量插值（ARMED/KEY/G 均为 lib/system/exit-guard.ts:18-32 的模块常量），无任何用户输入拼入；localStorage 只写固定字符串 "1"。
- layout.tsx 用 React 文本子节点渲染 `<script>`（app/layout.tsx:40），**不是** dangerouslySetInnerHTML，未绕过守卫测试（safe-content-rendering.test.tsx:76-82 扫 app/＋components/ 全部 ts/tsx，layout.tsx 在扫且不含该标识符，全量单测绿即证）。

#### 3. 回归真实性 —— 合格；/packs/ 尾斜杠判定为既有测试口径缺陷（P3，修测试不改实现）✓

- 12 条单测可证伪：字面深度常量、`new Function` 跑**仓库真源码**（非复刻品）、断言点在实现改弱时必红（跑两次不多压、stateDepth=0 仍按哨兵起算、连按三下全程无 exit）。
- 5 条 E2E 可证伪：断言可观察行为（URL 不落 about:blank、深度、dialog 可见性/数量）；armed 属性仅作等待闩非正确性断言；「JS chunk 全断仍留站」这条直接钉死了本轮修复的核心。
- /packs/ 尾斜杠失败归属：**既有测试口径缺陷，P3**。根因 next.config.ts:27 静态导出启用 `trailingSlash: true`（dev 无此项），新 spec 正则 `/\/packs(\?|$)/`（exit-confirm.spec.ts:93）沿用 dev 口径，直接加载导出站时 URL 为 `/packs/` 不匹配。属新 spec 未吸收「经验一句话」V2 已有教训（「URL 断言必须兼容 trailingSlash」），非本轮实现缺陷；不影响 QA 门禁（跑 dev）与真机行为（客户端导航深度模型与 URL 尾斜杠无关）。**该修测试**：正则放宽为 `/\/packs\/?(\?|$)/`。

### 顺带核对

- 既有 E2E spec 零改动：git status tests/ 下仅新增文件，无任何既有 spec 被改。
- 业务 diff 仅 layout 挂载（+2/-2 行）与 globals.css 2 行；未碰玩法/题库/safety-filter/route/矩阵 harness/AI 直连。
- 版本三处仍 1.5.0 未 bump（package.json＝sw.js CACHE_VERSION＝version.json，已实读核对）。
- 依赖沿用 @capacitor/app 7.1.2；android/ 仍仅两个 gradle 生成物差异。

### 返工复核新增 P3 Backlog

- **P3｜解析前空窗残余**：commit→head 解析间（实测 54–119ms）返回仍走浏览器默认（about:blank/原生退出）；零渲染、无页内手段可覆盖，与改动前一致。真机 QA 第 4 项必测兜住。
- **P3｜armSentinel 哨兵缺 __NA 的隐性依赖**：见 2a，建议兜底补 `__NA:true`（一行 hardening）。
- **P3｜/packs/ 尾斜杠测试口径**：见 3，修 exit-confirm.spec.ts:93 正则即可。
- **P3｜dev-only 双 backButton listener 竞态**：见 2b，StrictMode＋await 后置位；生产不受影响，如在意可把置位提到 await 前。

### 并入建议

**允许并入待重冻 RC**。P1 已闭环（用户可感知时刻 10/10＋5/5 实证），无新增 P1/P2；上列 P3 均不阻并入，随 backlog 处理。条件：真机 QA 第 4 项（冷启动直达深路由立刻返回）在重冻前必测并回填 BUGS 文档 G 节。

- 条件闭环回填（neat-freak 2026-09-27 收口，只记事实不改评审结论）：真机已由编排者于 2026-09-27 04:09 在 11T Pro+（`IN9LZTAYV4UGU4JF`）按**其自定的 5 项口径**实测 5/5 PASS（明细见 `docs/qa/RG-01-NEWRC-SMOKE.md` 末节，与 QA 报告 §H 的 5 项不是同一张单子），回填落位是 `docs/qa/BUGS-EXIT-GUARD.md` **§H 真机项**（本文原写「G 节」为笔误：§G 是依赖/生成物/版本节，真机项在 §H）。其中本条所列「条件」第 4 项（冷启动直达深路由立刻返回）因 App 无 deep link 入口无法用 adb 直达，按 P3 残余口径以同产物 18/18＋24/24 覆盖，未在真机跑过、不得据此宣称真机通过该项。NEW RC 已重冻为 `82cec01`。
