# BUGS｜PHASE B Custom 分轨 + final Mutual 收尾 QA

| Bug ID | Priority | Stage P0 Blocking? | Repro | Status | Current Task | 备注（截图/日志一句） |
|---|---|---:|---|---|---|---|
| QA-4-P3-1 | P3 | 否 | `npx vitest run tests/unit/custom-track-separation.test.ts --testTimeout=30000` | 已知体验观察 | Custom-only 局切内置玩法 | 跨轨闸阻止混入内置卡后落入 awaiting 出口；可以结束本局，现有提示略突兀，详见下文。 |
| QA-4-P3-2 | P3 | 否 | `git diff -- next-env.d.ts` | 已自动恢复为 HEAD | Next.js 类型引用 | QA 开始前文件已 modified；E2E 后检查仍显示 `.next/dev/types` 引用。随后 `pnpm build` 后 status 不再显示该文件；QA 未手工回滚。 |

## QA 摘要

- 日期/任务名：2026-09-28 / QA-4 收尾两单全量门禁 + 专项场景
- QA_RESULT：**PASS**
- HEAD：`2fffafe`（未 commit / 未 push）

> ⚠️（2026-09-28 收尾补注，neat-freak；未改写原结论）本 QA 当时 HEAD `2fffafe` 未 commit；收尾两单已随 `48850a4` 提交并 push `main`。原文「未 commit / 未 push」（:12 / :71 / :97）为该时点事实，保留留痕。
- P0：0；blocking P1：0；发现新增 P0/P1：无
- 七项门禁：通过；Playwright 106 passed、6 skipped（逐条见下文，不计作通过）
- 真机 QA：本任务明确不使用真机、不构建 APK；未执行真机预检，未宣称真机通过。

## 七项门禁（实际执行输出）

1. `npx tsc --noEmit`
   - exit 0；无输出。
2. `pnpm lint`
   - exit 0；`✖ 11 problems (0 errors, 11 warnings)`。
   - 11 条 warning 均来自未修改的 `scripts/audit-aggregate-v2-350.ts`、`scripts/audit-report-v2-350.ts`、`scripts/decision/orca-decide.mjs`、`scripts/decision/run-shadow.mjs`、`tests/phone/dump-state.ts`；本轮无新增 warning 的文件证据：这些 warning 文件均不在 QA 工作区改动中。
3. `npx vitest run --testTimeout=30000`
   - `Test Files 117 passed (117)`；`Tests 1158 passed (1158)`；`Duration 13.71s`。
   - 专项相关真实输出：`tests/unit/custom-track-separation.test.ts (12 tests)`；`tests/integration/v2-mid-mutual-abandoned.test.ts (15 tests)`；`tests/unit/v2-mutual-check.test.ts (50 tests)`；均 ✓。
4. `npx playwright test`
   - 执行前 `lsof -nP -iTCP:3000 -sTCP:LISTEN`：exit 1、无输出，3000 未被监听；未改端口。
   - 真实汇总：`6 skipped`；`106 passed (52.2s)`。
   - 6 个 skip 用例（均不计 PASS）：
     1. `tests/e2e/production-offline.spec.ts`「已访问的当前 Session 可在完全离线后重载恢复」——原因：`PARTY_NIGHT_PRODUCTION_SMOKE` 未设为 `true`，此用例只针对 production build。
     2. `tests/e2e/pwa-cache-regression.spec.ts`「PWA cache：版本化 cache + 旧 cache 清理 + 规则库离线 + AI 接口与密钥不进缓存」——原因：同上，需要真实 Service Worker 的 production build。
     3. `tests/e2e/pwa-schema-upgrade.spec.ts`「旧 cache + 新 bundle：版本错位后 Session 仍能恢复」——原因：production smoke 环境变量未开启；该用例依赖真实 Service Worker。
     4. `tests/e2e/v2-mutual-flow.spec.ts`「V2正向：audited metadata → 弹 Mutual → 双选成 MATCH（DEFERRED_BY_HUMAN，本批不做）」——原因：源码显式 `test.skip(true, ...)`，Human 冻结本批不做正向 UI E2E；正向 production-chain 由 unit/integration 覆盖。
     5. `tests/e2e/v1-1-recovery.spec.ts`「PWA reload：Service Worker 接管后，切新玩法并转瓶子，落点与当前玩法一并恢复」——原因：`PARTY_NIGHT_PRODUCTION_SMOKE` 未设为 `true`，需要 production Service Worker。
     6. `tests/e2e/would-you-rather.spec.ts`「二选一：AI 启用但断网时回退本地 seed，出题与换题都不卡」——原因：全量运行未设 `AI_MAINLINE_ENABLED=true`；用例显式要求单独打开 AI 主线并隔离网络。
   - 真实输出中其他代表性通过项：自定义游戏包 CRUD（`custom-pack-regression.spec.ts`）、混合候选排除自定义包（`pack-toggle-scope.spec.ts`）、自定义计数不进入 mixed 候选（同文件）、刷新恢复和无可玩卡时出口（`session-current-pack-recovery.spec.ts`）、中途 Mutual legacy 负向 20 轮（`v2-mutual-flow.spec.ts`）。
   - `next-env.d.ts`：QA 开始时 `git status --short` 已显示 `M next-env.d.ts`；E2E 后检查时差异为 `./.next/types/...` → `./.next/dev/types/...`。随后运行 `pnpm build`，最终 `git status --short` 不再列出该文件、`git diff -- next-env.d.ts` 为空。QA 没有手工回滚；E2E 开始前文件已 modified，因此不能归因 E2E 是最初改写者。构建后它自动回到 HEAD 内容。
5. `pnpm build`
   - exit 0；`✓ Compiled successfully`、`Finished TypeScript`、`Generating static pages (21/21)`；Next.js 16.3.3 (webpack)。
6. `pnpm build:fixed-manifest`
   - exit 0；`legacy allowed: 390`；`formal fixed: 0 张`；快照外 ID `0`；legacy `seed-*` 快照外 `350/350`；BAR-FIT 逐卡对账 `相比 390 / 一致 390 / 不一致 0`；既有产物对账 `相比 390 / 不一致 0`；`hash 可复现：是（两次构建一致：legacy=true formal=true；复算一致）`。
   - Formal 拒绝统计：`missingStrictMetadata 390 / humanBarFit≠PASS 390 / 未人工审 390 / hash 不全 0`。formal=0 如实保留，未伪装成正式题库。
7. `node scripts/model/check-ledger.mjs`
   - exit 0；真实输出：`LEDGER-OK`。

## 专项场景实测

### Custom 分轨

1. **Custom self-mode 仅含 custom**：全量 Vitest 中 `custom-track-separation.test.ts` 的 12 项通过；评审复核 `buildPlayableDeck` 使用 `customSelfMode ? customPool : builtinPool`，并再次按 `source === "custom"` 过滤。正常 E2E 的 custom 建包流程通过。**限制**：本轮 Playwright 没有专门的 custom-only 开局 UI 用例，因此该组合由 unit 覆盖，不冒称有 UI E2E。
2. **普通本地组局不含 custom**：`custom-track-separation.test.ts` 覆盖普通 fallback only builtin；`fixed-mainline-admission.test.ts` 通过。评审复核正常局走 `builtinPool`。全量 E2E 的普通本地游戏流程与 AI-off 本地题库流程均通过。
3. **AI-off 不发网络、fallback 不混 custom**：unit 用例「AI_MAINLINE_ENABLED=false ⇒ 不发 fetch，回退牌堆不含 custom」通过，测试断言 fetch mock 调用数为 0、fallback 卡均为 builtin。E2E 的 AI-off 本地题库用例通过；AI-on 断网用例因需显式启用而跳过（见 Skip 6），不将 skip 算通过。
4. **新建 Mixed 不含 custom+snapshot**：`mixedCandidatePackIds 把自定义包排除在 AI 组局候选之外`、`setup 显示最终 mixed 候选 N（自定义玩法退出 AI 组局，不计入 N）` 均通过；UI 实际计数为 6 个内置候选（禁用 1 个），新自定义包不进入候选。
5. **历史已混装 snapshot Session 恢复兼容**：`custom-track-separation.test.ts` 中「恢复混装 snapshot Session 不静默改写为 Formal」及混合旧缓存剔除 AI/alien、保留 custom/snapshot 的用例通过；Playwright `mainline-recovery.spec.ts` 的「混合旧缓存恢复：剔除 AI 与快照外卡、同步 currentRound、不白屏也不继续未知卡」通过。自定义 snapshot fixture 保持原内容/引用语义，不改写为 Formal。
6. **custom-only 开局、换题、切内置有出口**：unit 覆盖 self-mode 纯 custom，以及切换内置玩法后跨轨闸拒收内置补位并进入 `AWAITING_HOST_EXHAUSTION_DECISION`；`reshuffleWouldRevealCard=false` 时宿主可结束本局。Playwright `session-current-pack-recovery.spec.ts` 对空牌堆耗尽出口通过。未发现死循环或空白页；切换后提示略突兀，列为 P3-1。
7. **混合局未受影响；首页与设置文案**：全量 Playwright 中首页 7 个真实玩法 + 随机入口、4 个 Tab、mixed 开关作用域与候选计数相关用例通过；首页可见 8 个入口（含随机）。游戏包页文案使用「自定义玩法是独立玩法」等自然语言；本轮 grep/评审未发现向用户展示 Formal、snapshot、manifest 等开发术语。

### final Mutual

8. **awaiting=false 且资格满足仍 due**：`tests/integration/v2-mid-mutual-abandoned.test.ts` 的 final trigger 满足资格断言通过；输出 `✓ tests/integration/v2-mid-mutual-abandoned.test.ts (15 tests)`。最终判定只做技术能力，HEAT/TIMING 留空。
9. **awaiting=true 阻断且不产生 abandoned**：同集成测试断言 `due=false`、reason=`awaiting-host-decision`，判定前后 relationship 深相等，`midMutualCheckAbandoned=false`、matches 为空；该文件 15 项全绿。最终及中途互选共用该阻断 reason。
10. **中途 Mutual 未受影响**：全量 Vitest 的 `v2-mutual-check.test.ts` 50 项通过；`MUTUAL_MIN_HEAT` 仍 H3、窗口 `[12,14]` 由状态常量及集成测试断言保持；Playwright 负向 E2E「legacy 局走满 20 轮、计数全冻结、不弹中途互选、不产生 MATCH」通过。正向 Mutual UI E2E 是显式 Human deferred skip，不作通过声称。

### 红线与治理

11. **SSOT 350 题文本零修改**：`git diff -- lib/v2-content/generated/v2-ssot.generated.json` 无输出。
12. **版本/开关/固定库/RC**：命令实读 `package.json=1.5.0`、`public/sw.js CACHE_VERSION=1.5.0`、`public/version.json.version=1.5.0`；`printenv AI_MAINLINE_ENABLED` 无值，exit 1（生产守卫仅严格等于 `"true"` 才开启）；fixed manifest 为 formal 0；HANDOFF 标记 `RC_NEEDS_REFREEZE`。
13. **两份 docs/pm 与 HEAD 一致，未随新提交进入**：`git status --short -- docs/pm/PRODUCT_PLAN_V2.1-CHANGE-C.md docs/pm/PRODUCT_PLAN_V2.2-FIXED-CONTENT-FIRST.md` 无输出；`git diff HEAD --` 两文件无输出；本轮未产生提交，HEAD 仍 `2fffafe`，故本轮无 Plan 改动、无新提交携入两文件。（全历史中既有文档提交不属于本轮。）
14. **无新增 Host disclosure UI**：`app/game/page.tsx` 的 `roundDisclosureForCurrentRound()` 实际 `return undefined;`；未新增 UI 控件。
15. **未 commit / 未 push**：`git rev-parse --short HEAD` 输出 `2fffafe`；QA 未执行 commit 或 push。

## 问题明细

### QA-4-P3-1｜Custom-only 局切入内置玩法时提示偏突兀

- 级别：P3（非阻塞）
- 复现命令：`npx vitest run tests/unit/custom-track-separation.test.ts --testTimeout=30000`
- 真实输出：`✓ tests/unit/custom-track-separation.test.ts (12 tests)`；「custom-only 局切内置玩法后不跨轨补位」断言落入 awaiting，且无可恢复洗牌卡。E2E `session-current-pack-recovery.spec.ts` 的「空牌堆耗尽态的出口有效：结束本局直接进结算，不再空转」通过。
- 期望：切换动作有清楚反馈，用户知道独立 custom 局不提供内置牌补位，并可明确结束。
- 实际：业务安全出口存在，切入内置玩法后很快落到耗尽决策提示，体验略突兀；无静默死局/白屏/无限循环。
- 影响面：仅 custom-only Session 切换到内置玩法且无可用同轨卡时。
- 建议归属角色：builder（如后续 Human 纳入体验改进）；本轮不阻断。

### QA-4-P3-2｜`next-env.d.ts` 工具链曾产生工作区差异，构建后自动恢复

- 级别：P3（工作区卫生）
- 复现命令：`git diff -- next-env.d.ts`
- 真实输出：HEAD 引用 `./.next/types/routes.d.ts` 与 `./.next/types/root-params.d.ts`；工作区引用 `./.next/dev/types/routes.d.ts` 与 `./.next/dev/types/root-params.d.ts`。QA 开始前 status 已显示文件修改，E2E 后仍为此内容。
- 期望：生成类型路径与目标 Next 工具链状态一致，避免无关差异混入后续提交。
- 实际：E2E 后检查时有上述差异；`pnpm build` 后文件自动恢复到 HEAD，最终无差异。QA 没有手工回滚。
- 影响面：仅类型引用文件的瞬时工作区差异；不影响本轮 tsc/build 通过。
- 建议归属角色：task-manager 记录工具链行为；本轮无需额外处理。

## 总判定

**PASS**（P0=0、blocking P1=0、无红线破坏）。七项要求门禁均完成；Playwright 的 6 个 skip 均按原因单列，没有冒记 PASS。专项 unit/integration 与适用 E2E 支持 Custom 分轨、恢复兼容、Custom-only 安全出口、final Mutual awaiting 阻断及中途负向回归。Formal fixed 仍为 0，RC 仍需 refreeze；这些是当前已知治理状态，不是本轮验收失败。未 commit、未 push、未部署、未 bump、未构建 APK、未用真机。`next-env.d.ts` 在 QA 开始时已 modified，E2E 后检查仍有差异；随后 `pnpm build` 使其自动恢复到 HEAD，QA 未手工回滚。
