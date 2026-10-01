# BUGS｜A9 收尾独立验收

- 日期：2026-09-30
- 对象：酒吧主线内容重构 A2~A9
- QA_RESULT：**FAIL**（产品验收关键 AC 未测；负向探针 2~6 未实测；E2E 有 6 条 skip）
- 结论分栏：**技术门禁：通过项见下，E2E 为 106 passed / 0 failed / 6 skipped，不按全通过放行。产品验收：未通过/未完成。整体不得 PASS。**

## BUGS

| Bug ID | Priority | Stage P0 Blocking? | Repro | Status | Current Task | 备注（截图/日志一句） |
|---|---|---:|---|---|---|---|
| QA-A9-01 | P0 | Yes | 查 `docs/model/GOVERNANCE-STATE.json`，`product_acceptance_ac_added=false`；本单无计划 AC 可逐条对账 | OPEN | A9 closeout | 关键 AC 未测且产品验收证据缺失，依母版红线不得报完工 |
| QA-A9-02 | P1 | Yes | 按 §4.3 运行六项负向探针 | OPEN | A9 closeout | 仅探针 1 实测变红；探针 2~6 未完成实测，不能据既有断言代替探针证据 |
| QA-A9-03 | P1 | Yes | 执行 E2E 报告中的六条 skip | OPEN | A9 closeout | E2E 有 6 条 skip；不计 PASS |

## 七条门禁

证据日志位于仓内忽略目录 `temp/qa-a9/`，此目录仅存本次原始命令输出。

| 门禁 | 实测结果 | 判定 |
|---|---|---|
| `npx tsc --noEmit` | exit 0，0 error | 通过 |
| `pnpm lint` | exit 0，0 error / 12 warnings（与既有基线 12 相同） | 通过 |
| `npx vitest run --testTimeout=30000` | exit 0，137 files / 1453 tests passed / 0 failed | 通过 |
| `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173 npx playwright test` | exit 0，106 passed / 0 failed / 6 skipped；端口 4173 跑前无监听；测试后服务已退出 | 有 skip，不计全通过 |
| `pnpm build` | exit 0；Next 编译、TS、21/21 静态页生成成功 | 通过 |
| `pnpm build:fixed-manifest` | exit 0；legacy 443，audited/reviewed/formal = 53/53/53；逐卡 443 一致、0 mismatch；双次构建 hash 一致；快照外固定 ID 0；BAR-FIT 逐卡一致；fail-closed 门禁通过 | 通过 |
| `node scripts/model/check-ledger.mjs` | exit 0，`LEDGER-OK (含 WARN)`；记录 5 条 WARN：3 条 model 白名单/精确 ID、2 条 PASS 与未闭环 note 提醒 | Schema 通过，WARN 如实保留 |

manifest hash：legacy `e4fffc31af0633b5ba48265147e66a116598c2ccac460754623c02c2fa8a5701`；formal `d911d0b8239c7de29a9d5b14a8a4915472415375845bf845d4b64ffcc1832115`。版本三处 `1.5.0`。旧 350 SSOT 生成物未见 diff。

### E2E skipped 明细（6 条全不计 PASS）

- `production-offline.spec.ts`：生产离线 smoke，仅 production 模式运行。
- `pwa-cache-regression.spec.ts`：真实 Service Worker / production build 专项。
- `pwa-schema-upgrade.spec.ts`：真实 Service Worker / production build 专项。
- `v2-mutual-flow.spec.ts`：`DEFERRED_BY_HUMAN`，本批明确延期。
- `v1-1-recovery.spec.ts`：PWA reload 专项，仅 production build 注册 Service Worker。
- `would-you-rather.spec.ts`：AI 启用断网回退专项，要求 `AI_MAINLINE_ENABLED=true`；当前主线关闭。

端口事实：3000 有其他项目 node 进程监听（PID 63779），未停止或干扰；4173 跑前 `lsof -nP -iTCP:4173 -sTCP:LISTEN` 无输出。E2E 使用 4173。

## 专项检查

| 项目 | 实测结论 |
|---|---|
| old 350 text diff | 0；SSOT 生成文件无 diff，retired archive 专项断言覆盖冻结哈希 |
| 三处版本 | `package.json` / `public/version.json` / `public/sw.js CACHE_VERSION` 均 `1.5.0` |
| AI mainline | 关闭；AI 启用专测因此 skip（不算通过） |
| 退役卡运行时 / Formal | 历史退役 26 张与本轮退役 PN-TRUTH-236/249/263/277 有归档/运行时隔离和 Formal 集合断言；manifest Formal=53。独立重跑 Vitest 全过 |
| reviewerKind fail-closed / 空 review input Formal=0 | `scripts/build-fixed-content-manifest.ts` 有明确缺失/非法拒绝与空输入分支；未单独构造坏输入做破坏性探针 |
| Current UI disclosure | 页面函数当前 `return undefined`；源码门禁见 integration 测试。探针 1 实测，篡改为返回 signal 后该集成测试 1 failed / 4 passed |
| 认识阈值、窗口 `[12,14]`、中途 `MUTUAL_MIN_HEAT=H3`、`HEAT_THRESHOLDS` | 代码与常量专项测试存在；Vitest 全集通过，阈值没有改动证据 |
| `isEffectiveInformationRound` fail-closed 四项 | 当前保留 `selfDisclosed===true`、informationGain 存在且非 zero/low、topic 存在、disclosedPlayerIds 为数组；全集通过 |
| `PLANNING_ONLY_FIELDS` 不进 GameCard / 桥接投影 | 对应 schema 与桥接测试通过 |
| 256 topic | `相处规则` 精确断言存在（不是 union） |
| 262 / 264 followUpHook | 精确断言为 `social_style` |
| exact physical-contact | 专项测试 5 项通过；偏好提问不误挂接触标签 |

## 负向探针

| # | 篡改方式 | 期望 | 实测 |
|---|---|---|---|
| 1 | 临时将 `roundDisclosureForCurrentRound()` 改为返回真实 `roundDisclosureSignal({selfDisclosed:true, disclosedPlayerIds:["a"]})`，跑 `npx vitest run tests/integration/v2-formal-truth-production-chain.test.ts`，随后从 `temp/qa-a9/probe-backup/game-page.tsx` 原样恢复 | UI disclosure 源码门禁变红 | **变红**：1 failed / 4 passed，失败断言要求生产函数恒返回 undefined |
| 2 | 让退役卡回到运行时内容源 | 退役卡 runtime/legacy 豁免漏洞门禁变红 | **未执行**：未构造运行时回注变异，不报通过 |
| 3 | 将 `reviewerKind` 改非法值及删除 review input，分别运行 manifest 构建 | 均 fail-closed | **未执行**：未构造破坏性输入，不报通过 |
| 4 | 篡改 `packMachineVerdictSummary` 分组 note 与机器计数矛盾，运行输入自校验 | `group-note-consistent` 变红 | **未执行**：未构造变异，不报通过 |
| 5 | 修改旧 350 任一条 `text` 后跑冻结门禁 | 旧 350 字节哈希门禁变红 | **未执行**：SSOT 保持未改；不为探针改写受保护题库 |
| 6 | 在 E2E spec 临时写入 `127.0.0.1:3000` 后运行端口守护测试 | 端口守护测试变红 | **未执行**：任务明令禁止修改任何 spec，本单遵守该约束；现有守护测试随 Vitest 全集通过 |

探针 1 的临时源码已恢复。未执行的探针不得据现有正向测试推定为通过。

## 产品验收追踪矩阵

存量 Plan 未补视觉与交互 AC、关键 AC 集合、发布类型；`product_acceptance_ac_added=false`。因此无 AC 编号可核对，关键 AC 集合为空/缺失。本 QA 不自行发明 AC，也不替计划降级。

| AC 编号 | 关键 AC | 用户任务 | 前置数据/边界样本 | 设备/视口 | 操作步骤 | 预期结果 | 实际结果 | 状态 | 证据位置（截图/浏览器日志/路由） | 关联缺陷 ID |
|---|---|---|---|---|---|---|---|---|---|---|
| 缺失（Plan 未定义） | 未知 | A2~A9 计划中的关键用户任务无法对账 | 未定义 | 未定义 | 未测 | 未定义 | 无 AC 编号、无计划验收证据 | 未测 | `docs/model/GOVERNANCE-STATE.json` | QA-A9-01 |

关键 AC **未测**；产品验收证据**缺失**。依母版红线不得报完工。E2E 实际点过的用户可见流程涵盖首页可访问、设置与主题切换、无账号组局及边界开关、真心话/二选一/指人/转瓶子玩法、结束总结、规则列表进入详情、部分刷新恢复与响应式视口。真实点击细目可从 `temp/qa-a9/e2e.log` 中各条 passed 用例核对。未走通的 V2 正向 Mutual 与六条 skip 均不视作 PASS。没有独立留存的真实浏览器截图证据；E2E 视觉 spec 产出的截图不是本单产品 AC 证据。

## 建议改法

1. 由计划责任人先为本项目补齐编号 AC、关键 AC 集合和发布类型，再按 AC 在桌面/窄屏逐条操作并留真实浏览器截图与状态证据。
2. 后续 QA 补完负向探针 2~5；探针 6 需用独立临时工作副本或安全隔离办法验证，不改本仓 spec。
3. 将六条 skip 的适用环境/延期项明确纳入后续测试安排，尤其 production Service Worker 与 V2 正向 Mutual。

## 真机 QA 会话能力预检结果

- 日期/任务名：2026-09-30 / A9 收尾 Web QA
- session ID：不适用（Playwright 自动化；未执行真机 CUA）
- 模型精确 ID：不适用
- Runtime：本机 Playwright / Chromium
- 原生 CUA 注入：本单未使用
- 可用工具精确名称：Playwright Chromium
- CLI 备用入口：`npx playwright test`
- Orca Runtime / 权限 / 真机读屏截图点击输入滚动：未执行
- 最终结论：`NOT_VERIFIED`（真机 QA 未执行；本次不声称真机通过）
- 是否允许进入正式真机 QA：NO

## Fix Attempt Fingerprint

- Task ID: A9-CLOSEOUT-QA
- Root Cause Hypothesis: 现阶段主阻塞来自 Plan 缺少可追踪 AC；部分负向探针未形成实测证据。
- Approach: 独立重跑七门禁；E2E 使用配置端口；只运行一个安全可还原的负向探针。
- Files Changed: 新增本报告；探针临时变异已还原。未改业务代码、测试/spec 或断言。
- Verification: 七门禁原始日志见 `temp/qa-a9/`；仓内临时源码已还原；E2E 服务退出。
- Failure Reason: 关键 AC 未测、产品证据缺失；5 项负向探针未实测；6 条 E2E skip 不可计 PASS。
- Difference From Previous Attempt: 独立重新运行，不采信交接中的历史自报数字。

## 第二轮复验（2026-09-30）

> 本节补测上一轮未执行的技术负向探针，并复核已过门禁。所有探针以 `temp/qa-a9-round2/` 中的仓内副本备份为还原源；门禁日志也保存在该目录。没有改业务逻辑或测试断言，没有 commit/push。

### 负向探针（本轮实测）

| # | 怎么篡改（备份→变异→门禁） | 期望红 | 实测 | 还原证据 |
|---|---|---|---|---|
| 2 | 备份 `lib/v2-content/v2-card-bridge.ts`；临时将 `retired-truth-pack-2026-09-29.ts` 的归档卡 spread 进 `mainlineRuntimeCards()`；运行 `npx vitest run tests/unit/retired-truth-archive.test.ts --testTimeout=30000`。覆盖 A3 26 张归档卡及其运行时隔离断言（同一断言覆盖退役卡集合）。 | 退役卡回到 runtime 时运行时隔离门禁变红 | **变红**：13 项中 2 failed / 11 passed；失败为 bridge runtime 池隔离及生产源码禁止 import archive。首个使用动态 `require` 的探测尝试仅触发模块解析错误，作废；改用静态导入后得到本行有效断言失败。 | 回拷 `temp/qa-a9-round2/probe2-v2-card-bridge.ts.txt`；前后 SHA-256 均为 `0ab83d376d7748c432f0bbf596f7b5837fcf5a71d8bd183213322363f966bf`（完整日志 `probe2.log`）。 |
| 3a | 备份 `docs/qa/content-audit-v2/BAR-FIT-HUMAN-REVIEW.json`；仅将 `reviewerKind` 改为 `robot`；运行 `pnpm build:fixed-manifest`。 | 非法身份 fail-closed | **变红**：exit 1，明确报 reviewerKind 只接受 `human` 或 `ai-role`。 | 从 `probe3-review.json` 回拷；前后 SHA-256 均为 `730a1ae20192a691d40772ba58e0037c16731c92f20709c356c85bd355db5a2d`（`probe3-invalid-kind.log`）。 |
| 3b | 同一 JSON 备份；将 review input 清空为零字节；运行 `pnpm build:fixed-manifest`。 | 空输入 fail-closed | **变红**：exit 1，报 JSON 输入无法解析（Unexpected end of JSON input）。 | 同上回拷；SHA-256 前后相同（`probe3-empty-input.log`）。 |
| 4 | 备份同一审查 JSON；把含 1 张 SUSPECT 的 `truthFirstPack` note 改为“机器档位全部 PASS（3/3）”；运行 `npx vitest run tests/unit/bar-fit-review-input.test.ts --testTimeout=30000`。 | `group-note-consistent` 报 note 与机器计数矛盾 | **变红**：30 项中 3 failed / 27 passed；真产物完整性与 note 派生断言失败，诊断点名 `PN-TRUTH-203`，其中构造性反例断言确认抓到矛盾。 | 从 `probe4-review.json` 回拷；前后 SHA-256 均为 `730a1ae20192a691d40772ba58e0037c16731c92f20709c356c85bd355db5a2d`（`probe4.log`）。 |
| 5 | 备份 `lib/v2-content/generated/v2-ssot.generated.json`；将首条旧 350 卡的 `text` 末尾加“（探针）”；运行 `npx vitest run tests/unit/retired-truth-archive.test.ts --testTimeout=30000`。 | 冻结旧 350 SSOT 字节哈希门禁变红 | **变红**：13 项中仅 1 failed / 12 passed；失败项为冻结 SSOT 生成物字节 SHA-256 不变断言。 | 从 `probe5-v2-ssot.json` 回拷；前后 SHA-256 均为 `46f68e862a06041d932e425d28d595808554487abea2aa72936be9f0387af687`（`probe5.log`）。 |
| 6 | 备份 `tests/e2e/exit-confirm.spec.ts`；临时追加 `http://127.0.0.1:3000` 硬编码；运行 `npx vitest run tests/unit/e2e-port-config.test.ts --testTimeout=30000`。 | E2E 端口守护测试变红 | **变红**：5 项中 1 failed / 4 passed；失败项报告 `exit-confirm.spec.ts` 命中 `127.0.0.1` 与 `:3000`。 | 从 `probe6-exit-confirm.spec.ts.txt` 回拷；前后 SHA-256 均为 `ee55cf16444ab6d612116520293375e70ec8531056994be68930feaa663611c2`（`probe6.log`）。 |

所有探针文件均已按仓内 `temp/` 备份回写。探针后恢复态全量 Vitest 通过；`git -c core.quotepath=false status --short` 未出现本轮被探测目标的变更（原工作树已有的修改继续保留）。

### E2E skipped（逐条列原因；均非本轮新增）

本轮按要求未重跑 E2E 全量；与上一轮 106 passed / 0 failed / 6 skipped 的原始 `temp/qa-a9/e2e.log` 及 A8 交接基线对照，6 条仍为既有条件 skip。探针没有改动这些 skip 条件，也没有新增 skip：

| 测试 | skip 原因 | 本轮新增 |
|---|---|---|
| `production-offline.spec.ts` | 生产离线 smoke，仅 production 模式运行 | 否 |
| `pwa-cache-regression.spec.ts` | 需 production build 与真实 Service Worker | 否 |
| `pwa-schema-upgrade.spec.ts` | 需 production build 与真实 Service Worker | 否 |
| `v2-mutual-flow.spec.ts` 正向用例 | `DEFERRED_BY_HUMAN`，本批明确延期 | 否 |
| `v1-1-recovery.spec.ts` PWA reload 用例 | 需 production build 注册 Service Worker | 否 |
| `would-you-rather.spec.ts` AI 断网回退用例 | 需 `AI_MAINLINE_ENABLED=true`；当前主线关闭 | 否 |

### 恢复态门禁复核

| 门禁 | 本轮复测结果 |
|---|---|
| `npx vitest run --testTimeout=30000` | **137 files / 1453 passed / 0 failed** |
| `npx tsc --noEmit` | **exit 0，0 error**。探针备份 `.ts` 首次被 TypeScript glob 纳入并产生临时路径解析错误；调整备份扩展名后按原命令重跑通过，之后已恢复备份名。 |
| `pnpm lint` | **exit 0，0 error / 12 warning**；与上一轮 12 warnings 基线一致。 |
| `pnpm build:fixed-manifest` | **443/443** 逐卡一致，0 mismatch；两次 hash 一致；快照外 ID 0；Formal **53**，legacy 443 / audited 53 / reviewed 53 / formal 53。构建生成文件 SHA-256 与构建前一致。 |
| `node scripts/model/check-ledger.mjs` | **`LEDGER-OK`（含既有 WARN）** |
| Formal Heat 档 | **H1 14 / H2 17 / H3 16 / H4 6**；总计 53。 |

运行日志：`temp/qa-a9-round2/`。旧版备份 `*.旧版-2026-09-29` 本轮未触碰。

### 本轮结论（与首轮结论分栏）

| 结论类别 | 档位 / 判断 |
|---|---|
| **技术门禁结论** | **PASS_WITH_ISSUES**：6 项破坏性负向探针均触发指定门禁并完成还原；恢复态 Vitest、TypeScript、lint、manifest 与 ledger 校验通过。保留既有 6 条 E2E 条件 skip（非新增、非 PASS），故技术结果注明 issues。 |
| **产品验收结论** | **维持上一轮阻断结论，不变**：关键 AC 未测、验收证据缺失；`docs/model/GOVERNANCE-STATE.json` 的 `product_acceptance_ac_added` 仍为 `false`，本仓实绩 Plan 缺“视觉与交互验收标准（AC 编号）＋关键 AC 集合＋发布类型”。依母版红线，该项未闭环前整体不得报完工；是否走 Change C 由编排者上呈人类拍板。 |

## 同文件更新指纹

- 上一轮报告 SHA-256：`a1aab0f384006f209066c72dbda416d4cde68c08909141a092211fe01b1c8292`
- 第二轮追加后 SHA-256：见交付自证；文件为同一份 `docs/qa/BUGS-A9-CLOSEOUT.md`。

## 第三轮复核（2026-09-30｜V2.3 AC 最小验收）

> 本轮按 `PRODUCT_PLAN_V2.3-AC-ITERATION` 的 AC-01～AC-13 逐条复核，关键集合 AC-01～AC-11。仅追加本节；未改业务代码、测试/spec、内容源、Plan、generated JSON，未 commit/push/deploy。完整矩阵、NC、红线与原始证据说明见 `temp/QA-AC-RECHECK-V23.md`，命令日志在 `temp/qa-v23/`。

### 产品验收追踪矩阵

| AC 编号 | 用户可见要求 | 关键 AC? | 证据文件 + 用例名/命令 | 证据层级 | 本轮实测值 | 结论 | 备注 |
|---|---|---:|---|---|---|---|---|
| AC-01 | 首页进入本地局，真心话作答后继续 | 是 | `tests/e2e/spin-bottle.spec.ts` 首页空牌堆与 Alex 真心话续局用例；`game-flow.spec.ts` 本地整局 | L1 | 106 passed / 0 failed / 6 skipped；对应项通过 | 通过 | 三个 E2E 测试名均独立 grep 到真实定义。 |
| AC-02 | 结束本局；退出确认继续/退出产生相应页面变化 | 是 | `game-flow.spec.ts`；`exit-confirm.spec.ts` 继续玩留原地、退出导航离站 | L1 | 对应 E2E 通过；全套 106/0/6 | 通过 | 实际点击并断言状态/导航。 |
| AC-03 | 同局切换玩法后保留身份与配置 | 是 | `tests/e2e/pack-switching.spec.ts` 同局切换与已有局切换用例 | L1 | 对应 E2E 通过；全套 106/0/6 | 通过 | Session ID / 配置 / 尺度断言通过。 |
| AC-04 | 固定内容已审合格可追溯，退役 30 卡不回流 | 是 | `bar-fit-review-input.test.ts`；`retired-truth-archive.test.ts`；两次 `pnpm build:fixed-manifest` | L1 | 相关定点套件通过；Formal 53；快照外固定 ID 0；443/443、0 mismatch | 通过 | 真实文件、用例存在并复跑。 |
| AC-05 | 旧 350 原文和版本不变；AI 主线关闭时不发生成请求 | 是 | `retired-truth-archive.test.ts`；`content-track-gate.test.ts` 关闭不请求用例；AI isolation 定点测试 | L1 | SSOT diff=0；三处版本 1.5.0；AI 定点 31/31 | 通过 | 全量 Vitest 中 AI 页面测试另有 1 个失败，归技术门禁 FAIL；该测试孤立定点通过。 |
| AC-06 | Heat/Mutual/无效披露不误推进，冻结阈值保持 | 是 | `v2-mutual-check.test.ts` [12,14] 边界；`v2-formal-truth-production-chain.test.ts` disclosure 恒 undefined | L1 | 对应定点通过；H3；相关路径 diff=0 | 通过 | final Mutual HEAT/TIMING 仍是未决项。 |
| AC-07 | 未审、坏审查输入与 legacy 不绕过 Formal 准入 | 是 | `fixed-content-manifest.test.ts` 四条件/空输入/非法身份；manifest build | L1 | 定点 184/184；Formal 53；快照外 ID 0 | 通过 | 另有既有坏输入探针结果，前两轮报告留痕。 |
| AC-08 | 精确标签使题意和过滤口径一致 | 是 | `pack1-replaces.test.ts`；`pack1-physical-contact-scope.test.ts`；Supervisor A9 报告 | L1 | 定点套件全绿；接触专项 5 项通过 | 通过 | 256 topic 精确、262/264 hook 静态对照。 |
| AC-09 | 规划字段不进 Runtime；Host disclosure 未授权不生效 | 是 | `pack1-replaces.test.ts` schema/桥接；production-chain disclosure；路径 diff | L1 | 对应定点通过；函数返回 undefined；UI/Router/Engine diff=0 | 通过 | 静态与执行证据一致。 |
| AC-10 | 非 3000 端口可运行 E2E，退出行为正确 | 是 | `e2e-port-config.test.ts`；`PLAYWRIGHT_BASE_URL=http://127.0.0.1:3210 npx playwright test` | L1 | 守护测试 5/5；E2E 106/0/6；3210 测后释放 | 通过 | 3000 PID 63779 未触碰，spec 未改。 |
| AC-11 | 固定输入可重复生成相同卡源和审计结果 | 是 | 连续两次 `pnpm build:fixed-manifest`；manifest 重建/乱序用例 | L1 | 两次 Formal snapshotHash=`d911d0b8239c7de29a9d5b14a8a4915472415375845bf845d4b64ffcc1832115`；hash 可复现 true | 通过 | legacy/formal 两轨 hash 均一致，443/443。 |
| AC-12 | 机器 SUSPECT 与人工 PASS 分层；A2 分类对账 | 否 | `bar-fit-review-input.test.ts` note 派生断言；`PACK1-A2-ADJUDICATION.md` | L2 | 文件/断言存在；KEEP 5 / REWRITE 5 / REPLACE 21；ledger LEDGER-OK | 通过 | 静态复核，按要求不重跑。 |
| AC-13 | 验收与技术/内容审查一致，不虚报发布完成 | 否 | FINAL-53 主审、A9 Code Review、Supervisor、QA 报告、账本校验 | L2 | 主审 53/0/0；Code Review PASS_WITH_NOTES、P0/P1=0；本轮技术 FAIL 与 6 skip 如实列明；LEDGER-OK | 通过 | 结论分栏，未声称发布完成。 |

**AC 汇总：** AC-01～AC-13 全部有结论；L1 11 条、L2 2 条。关键 AC 11/11 有证据支撑且通过：**是**。

### 本版不覆盖

| 编号 | 不覆盖范围与理由 | 本轮登记 |
|---|---|---|
| NC-01 | 桌面与窄屏全视觉边界走查；A9 UI 零改动，计划将完整桌面/边界样本留给 UI 变更版本 | 本轮只覆盖 Pixel 7 390×844；桌面与完整边界视觉走查未做。 |
| NC-02 | 真人局与 RG-01～RG-07 / Release | `RG-02=HOLD_BY_CONTENT_01`、`RC=RC_NEEDS_REFREEZE`；不 Release、不部署，原 7/7 gate 未执行。 |
| NC-03 | BAR-FIT v2 | 尚未实现，不计交付。 |
| NC-04 | 229 咨询句式瑕疵 | 主审判 PASS 可容忍，登记不修。 |
| NC-05 | `follow_up_hook=9` 余量 0 与“选谁”骨架收敛风险 | 主审登记项；未退卡、未加门槛。 |
| NC-06 | 父版其他待兑现 DoD | 完整玩法冻结、20/25 轮 MC、最终 Mutual HEAT/TIMING 冻结继续留原 Gate，不包装成已验收。 |

### 红线逐项核对

| 红线 | 结论 | 证据 |
|---|---|---|
| 旧 350 题 text diff=0 | 通过 | 冻结 SSOT `git diff --quiet 0a879ed..013939b` exit 0，专测通过。 |
| 三处版本均 1.5.0 | 通过 | package.json / version.json / sw.js CACHE_VERSION 读值均为 1.5.0。 |
| AI_MAINLINE_ENABLED=off | 通过 | 当前未注入 true；关闭分支隔离测试定点通过；AI 启用断网 E2E 条件 skip。 |
| Mutual 窗口 [12,14] 未改 | 通过 | 常量/边界用例通过，Router/Engine diff=0。 |
| MUTUAL_MIN_HEAT=H3 未改 | 通过 | state 常量与集成断言均为 H3。 |
| HEAT_THRESHOLDS 未改 | 通过 | 对应测试通过、相关路径无变更。 |
| Host disclosure UI 未新增/未改 | 通过 | `roundDisclosureForCurrentRound()` 仍恒 `undefined`；对应 integration 通过。 |
| final Mutual HEAT/TIMING 仍留空 | 通过（保持未决） | V2.3/父版原文仍为未冻结，本轮未变更。 |
| RC 未重冻 | 通过 | `RC_NEEDS_REFREEZE`，未触发重冻。 |
| 未部署 | 通过 | 本轮无部署动作，HANDOFF/Plan 记录未部署。 |
| 题库机制未改 | 通过 | 准入四条件、有效轮 fail-closed、legacy 豁免相关测试本轮通过。 |
| 零 UI、零 Router/Engine 变更 | 通过 | `app/ components/ styles/ lib/v2-relationship/ lib/engine/` 相对 A9 基线 diff=0。 |

### 门禁实测与 E2E skip

- E2E：`PLAYWRIGHT_BASE_URL=http://127.0.0.1:3210 npx playwright test` → **106 passed / 0 failed / 6 skipped**。六条 skip 均不计 PASS：`production-offline`（production 模式）；`pwa-cache-regression`（production build/真实 SW）；`pwa-schema-upgrade`（production build/真实 SW）；`v2-mutual-flow` 正向 Mutual（`DEFERRED_BY_HUMAN`）；`would-you-rather` AI 断网回退（需 `AI_MAINLINE_ENABLED=true`）；`v1-1-recovery` PWA reload（production build/SW）。
- Vitest 全量：**137 文件中 136 passed、1 failed；1452 passed / 1 failed / 1453**。失败为 `ai-mainline-generating-page.test.tsx` 的关闭开关页面标题断言，并有 `profiles.find` 未处理错误。该文件与 `ai-mainline-isolation`、`content-track-gate` 定点运行 **31/31 通过**；全量仍为失败，不掩盖。
- AC 定点组：9 文件 / **184 passed / 0 failed**；端口守护测试包含其中 5 项。ledger：`LEDGER-OK (含 WARN)`。
- Manifest 连跑：Formal 53；legacy/audited/reviewed/formal = 443/53/53/53；两次 formal snapshotHash 均为 `d911d0b8239c7de29a9d5b14a8a4915472415375845bf845d4b64ffcc1832115`；443/443 一致、0 mismatch、快照外固定 ID 0。
- E2E 将 `next-env.d.ts` 改写；已用 `temp/qa-v23/next-env.d.ts.baseline` 回写。当前与 HEAD hash 均为 `1862ac4bbbc5192d4bf562161df66ea547ed3e67173100656ab606ae9797db2b`。3000 的 PID 63779 未停止；3210 测试结束后无监听。

### 分栏结论

| 结论类别 | 本轮结论 |
|---|---|
| **技术门禁结论** | **FAIL**：全量 Vitest 有 1 failed；E2E 有 6 条条件 skip（不计 PASS）。其他已列定点与 manifest、ledger 检查通过。 |
| **产品验收结论** | **PASS**：AC-01～AC-13 有逐条结论；关键 AC 11/11 有本轮证据并通过。此结论不覆盖 NC 项，也不表示 Release/部署完成。 |

## 同文件更新指纹（第三轮）

- 第一轮追加后 SHA-256：`a1aab0f384006f209066c72dbda416d4cde68c08909141a092211fe01b1c8292`。
- 第二轮追加后（本轮更新前）SHA-256：`22e076dfe436c4e138208a04a9190d49c13edbaf9dccfb31b20fecdec83dbab0`。
- 本轮在同一文件末尾追加第三轮章节；第一、二轮原文未改。
- 更新后 SHA-256 与 `ls -l` 实测值见本轮交付回执。
