# BUGS｜Phase B B2.2 QA

| Bug ID | Priority | Stage P0 Blocking? | Repro | Status | Current Task | 备注（截图/日志一句） |
|---|---|---:|---|---|---|---|
| QA-COV-01 | P2 | 否 | `npx playwright test` | NOT VERIFIED | 七种 Legacy 单玩法 20 轮 | 真实 UI E2E 只覆盖 `truth-dare`，其余 6 种没有逐玩法 20 轮证据；未添加 harness。 |
| B2.2-P2-1 | P2 | 否 | `nl -ba lib/ai/generate-deck.ts \| sed -n '48,55p'` | 已知缺口仍在；按冻结不计本批 FAIL | buildPlayableDeck 新建牌堆混轨 | 实现将 custom 与 local snapshot 放进同一 `pool`；本轮未作侵入式运行时复现。 |
| B2.2-P2-2 | P2 | 否 | `sed -n '1,12p' tests/setup.ts` | 已知留办 | Vitest AI 开关 fixture | 单测缺省置 `AI_MAINLINE_ENABLED=true`；生产缺省关闭，Playwright 未注入时按关闭运行。 |
| B2.2-P2-3 | P2 | 否 | `rg -l '2,340\|2340\|58\.5%\|2\.34\|7\.49\|2\.85\|9\.12\|75,506\|75,483' docs --glob '*.md'` | 发现旧口径引用，未修改 | Heat 豁免后的 Router MC 数字 | 当前 JSON 为全部 4000 局完成、Heat 全部 H1；手写文档仍有 8 份引用旧运行时统计。 |
| B2.2-P2-4 | P2 | 否 | `sed -n '163,180p' lib/v2-relationship/v2-mutual-check.ts` | 已知留办 | final mutual awaiting 阻断 | 最终互选 trigger 未检查 `awaitingHostDecision`；当前未接 App 结束流程。 |
| B2.2-P3-1 | P3 | 否 | `rg -n -C 1 'MUTUAL_MIN_HEAT' lib/v2-relationship/v2-state.ts` | 已知留办 | 过期 JSDoc | 注释仍将最终互选与 Heat 关联，实际 final trigger 已移除 Heat gate。 |
| B2.2-P3-2 | P3 | 否 | `rg -n -C 1 'roundDisclosureForCurrentRound' app/game/page.tsx` | 已知限制，Human 已接受 | 生产 disclosure 采集通道 | 生产函数恒返回 `undefined`；集成正向由显式 disclosure fixture 验证，不等同生产 UI 正向可达。 |

## QA 范围与运行环境

- 日期：2026-09-28；本轮仅运行自动化门禁及既有用例，不做真机、构建 APK、部署、版本升级、commit 或 push。
- 端口预检：`lsof -nP -iTCP:3000 -sTCP:LISTEN` → 无输出，exit 1（3000 无监听）。`playwright.config.ts` 配置 `reuseExistingServer: !process.env.CI`，因此未改端口或配置；E2E 自启 `pnpm dev --hostname 127.0.0.1`。
- 工作区原已存在大量未提交改动；HEAD 为 `57f5be3`，`git rev-list --left-right --count '@{u}...HEAD'` 输出 `0 0`。本轮未执行 Git 写操作。

> ⚠️（2026-09-28 收尾补注，neat-freak；未改写原结论）B2.2 批次已随 `8bcef40` 提交并 push `main`；原文「未提交 / 未 commit/push」（:17 / :145 / :153）为该 QA 时点事实，保留留痕。另：上表部分遗留项已在收尾两单处理——P2-1（custom/snapshot 混轨，方案 A 分轨）、P2-4（final mutual awaiting 阻断）、P3-1（`MUTUAL_MIN_HEAT` JSDoc）详见 `docs/qa/BUGS-PHASEB-CUSTOM-AND-FINAL-MUTUAL.md`。
- 本轮仅新增本报告。`pnpm build:fixed-manifest` 按命令生成 `lib/v2-content/generated/fixed-content-manifest.json`（当前显示为 untracked）；未手工编辑或清理它，以免覆盖原工作区状态。

## 门禁实跑

1. **TypeScript** — `npx tsc --noEmit`：exit 0，stdout/stderr 均为空。
2. **Lint** — `pnpm lint`：exit 0；真实输出为 `✖ 11 problems (0 errors, 11 warnings)`。警告分布于 audit 脚本、decision 脚本及 `tests/phone/dump-state.ts`，不是本轮新增确认的阻断错误。
3. **Vitest** — `npx vitest run --testTimeout=30000`：真实汇总 `Test Files 115 passed (115)`、`Tests 1134 passed (1134)`、exit 0。
4. **Playwright** — `npx playwright test`：真实汇总 `6 skipped`、`106 passed (1.2m)`、无 failed（112 tests）。
   - `production-offline.spec.ts`「已访问的当前 Session 可在完全离线后重载恢复」：`PARTY_NIGHT_PRODUCTION_SMOKE !== "true"`；仅 production build 运行。
   - `pwa-cache-regression.spec.ts`「PWA cache：版本化 cache + 旧 cache 清理 + 规则库离线 + AI 接口与密钥不进缓存」：同一环境门控；需要真实 Service Worker。
   - `pwa-schema-upgrade.spec.ts`「旧 cache + 新 bundle：版本错位后 Session 仍能恢复」：同一环境门控；仅 production build。
   - `v1-1-recovery.spec.ts`「PWA reload：Service Worker 接管后，切新玩法并转瓶子，落点与当前玩法一并恢复」：同一环境门控；dev 不注册 Service Worker。
   - `v2-mutual-flow.spec.ts`「V2正向：audited metadata → 弹 Mutual → 双选成 MATCH（DEFERRED_BY_HUMAN，本批不做）」：源码显式 `test.skip(true, "DEFERRED_BY_HUMAN…")`；不得计作 PASS。
   - `would-you-rather.spec.ts`「二选一：AI 启用但断网时回退本地 seed，出题与换题都不卡」：要求 `AI_MAINLINE_ENABLED=true`，全量 E2E 未注入此变量，按源码原因跳过。
5. **Next build** — `pnpm build`：exit 0；真实输出包含 `✓ Compiled successfully`、`Finished TypeScript`、`Generating static pages (21/21)`。
6. **Fixed manifest** — `pnpm build:fixed-manifest` 连跑两次，两个命令均 exit 0，hash 一致：
   - legacy 390；`snapshotHash=f0c43814872b7f03f9d2752b3cd995c385b792a883c428dda7936c9f6d4281a3`。
   - formal 0；`snapshotHash=4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`。
   - BAR-FIT 逐卡：390 compared / 390 consistent / 0 mismatches；既有产物对账 390 compared / 0 mismatches。
   - 快照外 ID 数 0；旧 seed-* 快照外 350/350；拒入 formal：missingStrictMetadata 390、humanBarFit≠PASS 390、未人工审 390、hash 不全 0。
   - 人工审查：已定档 0 / 未审 390；reviewed=true 为 0。机器预筛 PASS 164 / SUSPECT 222 / HARD_FAIL_PATTERN 4。
7. **Ledger** — `node scripts/model/check-ledger.mjs`：真实输出 `LEDGER-OK`。按职责只核对，未改任一账本。

## 重点场景复测

1. **七种 Legacy 单玩法 20 轮：部分未验证。** 全量 E2E 中唯一直接覆盖完整 20 轮 Legacy 的现成用例为 `tests/e2e/v2-mutual-flow.spec.ts`：「V2负向：legacy 局走满 20 轮、计数全冻结、不弹中途互选、不产生 MATCH」，实际是 `truth-dare`，输出 `✓ …v2-mutual-flow.spec.ts:94…`。没有现成用例对另外六种玩法各跑 20 轮；按本轮非侵入范围未加临时 harness，因此不把单玩法证据外推到七种玩法。
2. **would-you-rather 10 轮：PASS。** `npx playwright test` 实际输出 `✓ …would-you-rather.spec.ts:85… 二选一：连续 10 轮不重题、全部 completed，Session 尺度与配置原样继承 (9.0s)`。
3. **Mutual Legacy 负向：PASS。** 同一现成 E2E `v2-mutual-flow.spec.ts:94` 实际通过。用例对真实落盘 20 轮及第 21 轮出牌、无空牌堆页/无 Mutual、effective count=0、recognitionEvidence=0、Heat=H1、MATCH=0 作断言；测试不手工写 relationshipState。
4. **Production integration：已覆盖的链 PASS；UI 正向不在本批范围。** 全量 Vitest 实际输出 `✓ tests/integration/v2-production-chain-recognition-mutual.test.ts (4 tests) 51ms` 与 `✓ tests/integration/v2-mid-mutual-abandoned.test.ts (11 tests) 45ms`。前者覆盖真实 `resolveRoundAndReduce → eventForRoundTerminal → reducer`、effective count/evidence/Heat、trigger due、MATCH 形成及 cooldown；反例包括 metadata 缺失/zero/low、topic 缺失、未本人揭晓、swap/skip。UI 正向 Playwright 明确被 Human 标成 DEFERRED，按第 4 项列为 skip，不宣称 E2E PASS。
5. **count=14 abandoned 前置：PASS（既有集成用例）。** `v2-mid-mutual-abandoned.test.ts` 的 11 项均在全量 Vitest 实跑通过；用例覆盖候选披露不足、无 eligible pair、regular mutual 已发生、private flow、awaiting、count>14、reducer/trigger 候选同源一致。结果按冻结语义区分暂时阻断与永久 abandoned。
6. **跨轨：既有闸门测试 PASS；Formal 实际牌组及已知新建混装缺口不完整验证。** `tests/unit/content-track-gate.test.ts`（16 tests）在全量 Vitest 通过，含 session refill、switch pack、后台补题、Legacy 不注入 Formal、Formal/custom/AI 接收边界；`tests/e2e/mainline-recovery.spec.ts` 通过，覆盖恢复时剔除 AI/快照外卡；spin-chain 对应既有 E2E 通过。Formal manifest 当前为 0，故没有真实已准入 Formal 卡可供线上式混轨验证。明确的已知 `buildPlayableDeck` 缺口仍在：`nl -ba lib/ai/generate-deck.ts | sed -n '48,55p'` 的实际输出第 51 行为 `const pool = filterMainlineCards(dedupeCards([...allowedAI, ...allowedCustom, ...local]));`。既有 `custom-pack-snapshot.test.ts` 只测已开始 Session 的 snapshot 不随卡片编辑变化，不是此建堆路径的运行时复现；未新增 fixture/harness。该待裁决缺口依 Human 指示不计本批 FAIL。
7. **红线：核查通过。** `git diff -- lib/v2-content/generated/v2-ssot.generated.json` 无输出；三处版本实测 `package=1.5.0 sw=1.5.0 versionJson=1.5.0`；当前环境 `printenv AI_MAINLINE_ENABLED` 无值且退出 1，`isAiMainlineEnabled()` 仅在值严格等于 `"true"` 时启用；`roundDisclosureForCurrentRound()` 恒 `return undefined`。HEAD 未前进于 `origin/main`（左右计数 `0 0`），本轮无 commit/push。
8. **旧 Monte Carlo 数字：JSON 已重跑，手写文档仍有旧引用。** 当前 `docs/qa/content-audit/ROUTER-MONTE-CARLO.json` 的真实数据：4000/4000 局完成 20 轮、high 1.73/局、mid+ 6.92/局、人物主题 1.70/局、最长低/0 连击 10.16、总曝光 94,252、deadEnd 0、Heat H1=94,252（H2/H3/H4=0）。与旧文档的 2340/4000、2.34、7.49、2.85、9.12、75,506 不同。`rg -l` 实际列出以下 8 份 Markdown，交编排者/对应文档责任角色更新；本 QA 不修改：
   - `docs/handoff/HANDOFF.md`（当前摘要第 21 行是旧值；第 175 行是历史变更记录，保留其历史语义）。
   - `docs/pm/PRODUCT_PLAN_V2.1-CHANGE-C.md`（第 22 行）。
   - `docs/qa/BUGS-CONTENT-A1.md`（第 41、105 行）。
   - `docs/qa/BUGS-CONTENT-A2.md`（第 19、33 行）。
   - `docs/qa/content-audit/CONTENT-STRUCTURE-REPORT.md`（第 267–268 行等）。
   - `docs/qa/content-audit/ROUTER-CONTENT-MONTE-CARLO.md`（第 10、41、51、55、58–61、74、162–163、179–185 行等）。
   - `docs/qa/content-audit/TOP20-HIGH-INFO.md`（第 36 行）。
   - `docs/review/CODE_REVIEW-CONTENT-A1.md`（第 33 行）。

## 问题明细

### QA-COV-01｜P2｜七种单玩法 20 轮只实测一种

- 复现命令：`npx playwright test`。
- 真实输出：`106 passed`；其中 `v2-mutual-flow.spec.ts:94` 的 Legacy 20 轮用例通过，按 `tests/e2e/v2-mutual-flow.spec.ts` 断言，玩法固定为 `truth-dare`。未发现其他六种玩法逐个跑 20 轮的既有 E2E。
- 期望：七种玩法各自跑满 20 个 completed，无 PACK_EXHAUSTED、Mutual、MATCH。
- 实际：只有 `truth-dare` 有直接 20 轮 UI 证据；其余六种未验证。
- 影响面：无法将该 Legacy 20 轮验收结论覆盖到所有玩法。
- 建议归属：builder 补可复用的既有 E2E 覆盖，QA 再跑全矩阵；本轮不创建 harness。

### B2.2-P2-1｜P2｜buildPlayableDeck 新建牌堆混合 custom 与 snapshot（已知待 Human 裁决）

- 复现检查命令：`nl -ba lib/ai/generate-deck.ts | sed -n '48,55p'`。
- 真实输出：第 51 行 `const pool = filterMainlineCards(dedupeCards([...allowedAI, ...allowedCustom, ...local]));`，同一个建堆候选池含 `allowedCustom` 与 `local`。
- 期望：Custom 与 Formal/snapshot 轨隔离或明确拒绝混装。
- 实际：实现仍允许候选池混装；本轮未新增 fixture 或运行时 probe，故动态复现 NOT VERIFIED。
- 影响面：新建牌堆可能混合 Custom 与 snapshot 卡；Formal 当前 0 张，现实 Formal 准入尚不可达。
- 建议归属：builder 等待 Human 对轨道方案裁决后处理。依冻结要求，本项不计本批 FAIL。

### B2.2-P2-2｜P2｜Vitest 的 AI 默认环境与生产缺省相反

- 复现命令：`sed -n '1,12p' tests/setup.ts`。
- 真实输出：`process.env.AI_MAINLINE_ENABLED = process.env.AI_MAINLINE_ENABLED ?? "true";`；同文件注释写明生产缺省关闭。当前 Playwright 未注入变量，AI-off E2E 通过；Vitest 专项隔离用例也在全量 1134 tests 中通过。
- 期望：测试配置与生产缺省一致，或显式隔离“AI 留存代码测试”与默认正式主线行为。
- 实际：全量 Vitest 默认打开变量；生产代码只对严格值 `true` 启用。既有隔离测试缓解差异，但不能把全量单测视为关闭态覆盖。
- 影响面：只依赖默认 Vitest 环境的主线关闭态断言可能被误导。
- 建议归属：builder；保持已存在的显式关闭专项测试，并在涉及关闭态行为时运行关闭态验证。

### B2.2-P2-3｜P2｜Router Monte Carlo 旧数字未从手写报告中清理

- 复现命令：`rg -l '2,340|2340|58\.5%|2\.34|7\.49|2\.85|9\.12|75,506|75,483' docs --glob '*.md'`。
- 真实输出：命中 8 文件：`HANDOFF.md`、`PRODUCT_PLAN_V2.1-CHANGE-C.md`、`BUGS-CONTENT-A1.md`、`BUGS-CONTENT-A2.md`、`CONTENT-STRUCTURE-REPORT.md`、`ROUTER-CONTENT-MONTE-CARLO.md`、`TOP20-HIGH-INFO.md`、`CODE_REVIEW-CONTENT-A1.md`。当前 JSON 重跑后 4000/4000 完成、high 1.73、mid+ 6.92、人物主题 1.70、longest low/zero 10.16、曝光 94,252、Heat 全 H1。
- 期望：所有当前结论指向新的 JSON 数字；明确标为历史的数据保留历史标签，避免被当作当前结果。
- 实际：多个当前叙述仍引用旧运行时数据；`HANDOFF.md` 当前摘要明确过期。历史记录不由 QA 擅改。
- 影响面：可能把已作废旧数字继续用于计划/评审/内容决策。
- 建议归属：task-manager 更新 HANDOFF；planner 更新 Plan；原报告责任角色更新其 QA/review 报告。

### B2.2-P2-4｜P2｜final mutual trigger 未阻断 awaiting

- 复现检查命令：`sed -n '163,180p' lib/v2-relationship/v2-mutual-check.ts`。
- 真实输出：函数检查 `pairMode`、`sessionStatus`、`privateFlowRunning` 与 recognition threshold；该区间没有 `awaitingHostDecision` 判断。全量测试中的 awaiting 覆盖是中途 `midMutualCheckTrigger` 语义，不等价于 final trigger。
- 期望：若未来接入最终互选，awaiting 状态不得允许并行触发。
- 实际：final trigger 当前缺该 gate；当前函数未接 App 结束流程、不是本轮实际用户流程。
- 影响面：未来接入时存在状态竞争风险；当前无已证实生产影响。
- 建议归属：builder；接入 final mutual 前补门禁并增加回归测试。

### B2.2-P3-1｜P3｜MUTUAL_MIN_HEAT 文档注释残留

- 复现检查命令：`rg -n -C 1 'MUTUAL_MIN_HEAT' lib/v2-relationship/v2-state.ts`。
- 真实输出：源码注释仍称其覆盖“中途/最终互选”，而本轮 final trigger 源码注释明确 Heat 不参与最终互选。
- 期望：注释描述与当前实现一致。
- 实际：仅文档残留，运行时逻辑不受影响。
- 影响面：后续维护者可能误读产品语义。
- 建议归属：builder。

### B2.2-P3-2｜P3｜生产 UI disclosure 通道仍恒 undefined

- 复现命令：`rg -n -C 1 'roundDisclosureForCurrentRound' app/game/page.tsx`。
- 真实输出：`return undefined;`；`applyRoundSignal` 将 completed round 的该结果传给 `resolveRoundAndReduce`。
- 期望：当 Human 冻结披露采集产品语义后，生产 round 能提交明确 disclosure signal。
- 实际：本轮生产 UI 没有披露采集；正向 production-chain 由 integration fixture 显式输入 disclosure 验证。按 code review/Human 已接受为后续代价，本批不视为新回归。
- 影响面：真实 UI 当前无法生成有效认识证据，因而不能从 UI 达到中途 Mutual；Formal 仍为 0。
- 建议归属：planner 定产品口径后由 builder 实施；未经 Human 冻结不得自行加 Host UI。

## 总判定

**FAIL（验收覆盖不完整；不是发现 P0/blocking P1/红线破坏）。** 本轮 tsc、lint、Vitest、Playwright 全量、build、manifest 与账本命令均实跑；没有发现 P0、blocking P1 或用户列明红线破坏。因七种玩法 Legacy 20 轮只验证 `truth-dare`，其余六种未验证，不能把整个指定场景矩阵报 PASS。`buildPlayableDeck` custom+snapshot 已知待裁决缺口不计本批 FAIL；这里的 FAIL 由 QA-COV-01 覆盖缺口触发。

## 摘要回复（供编排者，≤30 行）

- tsc：0 error，exit 0。
- lint：0 error / 11 warnings，exit 0。
- Vitest：115 files / 1134 tests passed，0 failed。
- Playwright：106 passed / 0 failed / 6 skipped；已逐项记录 skip 原因。
- build：PASS。
- fixed-manifest：legacy 390 / formal 0；两次 hash 一致；BAR-FIT 390/390、0 mismatch；快照外 ID 0。
- ledger：LEDGER-OK。
- 总判定：**FAIL（QA-COV-01：7 种 Legacy 20 轮只实测 1 种）**；P0=0、blocking P1=0、红线破坏=0。
- 问题计数：QA 覆盖 P2=1；Code Review 留办 P2=4、P3=2；无新增确认的 P0/blocking P1。
- 已知缺口：`buildPlayableDeck` 新建牌堆 custom+snapshot 混装仍存在；按 Human 冻结不计本批 FAIL，动态复现未做。
- MC JSON 已是新数字（4000/4000 完成、Heat 全 H1）；8 份手写 Markdown 仍引用旧值，已列清单交编排者处理。

## 复验（QA-COV-01 关闭）

- 日期：2026-09-28。此节为 QA-3 复验追加记录；上方 QA-2 首判与历史摘要原样保留。本次仅更新本 QA 文件，未改业务代码、HANDOFF、PM/Review 文档或账本；未 commit/push。
- 七玩法真源核对：`lib/v2-content/v2-types.ts:26` 的 `V2_GAME_TYPES` 为 `truth / dare / most_likely / never_have_i / either_or / pointing / chemistry`；测试以 `describe.each([...V2_GAME_TYPES])` 生成玩法用例，并以同一枚举校验列表，7/7 对齐。
- 测试可采信性：走生产 `startRound → drawDeckCard → drawV2SessionCard` 出卡及 `resolveRoundAndReduce` 终态链；seed 牌堆由生产 `BUILTIN_SEED_CARDS` 按映射筛选。测试无 `relationshipState` 赋值、无手工注入 `recognitionEvidence`/count/heat/metadata；只读生产派生状态并断言。库存前置要求 `deckSize >= 21`，卡量不足将直接失败；没有缩小断言迁就结果。
- 七玩法真实输出：命令 `npx vitest run tests/integration/v2-legacy-seven-modes-20-rounds.test.ts --testTimeout=30000`，`1` 文件、`8` 用例通过；每项牌堆 50、出卡 20：`truth` 完成 20/20，effective=0、heat=H1、evidence=0、midDue=false、finalDue=false、matches=0、awaiting=false、lastLevel=BUCKET_OK；`dare` 同值；`most_likely` 同值；`never_have_i` 同值；`either_or` 同值；`pointing` 同值；`chemistry` 同值。共 7/7 玩法通过，输出轨为 seed，未耗尽。
- Vitest：`npx vitest run --testTimeout=30000`，exit 0；`Test Files 116 passed (116)`、`Tests 1142 passed (1142)`，含上述新增集成测试。
- Playwright：跑前 `lsof -nP -iTCP:3000 -sTCP:LISTEN` 无输出，exit 1（端口未监听）；未 kill 进程/改端口。`npx playwright test` 按配置启用 `reuseExistingServer: !process.env.CI`，本次启动 `next dev --hostname 127.0.0.1`；exit 0，`106 passed (55.2s)`、`6 skipped`、无失败。
- TypeScript：`npx tsc --noEmit`，exit 0，`tsc_exit=0`，无诊断输出。
- 上轮其它复验项复核：Mutual legacy 负向 Playwright 用例仍通过；production integration 正向链 Vitest 已通过（UI 正向仍按 Human 决策 DEFERRED，不记 PASS）；count=14 abandoned 前置集成用例 11/11 通过；跨轨既有 gate 16/16 通过且主线恢复 E2E 通过。Formal manifest 仍为 0，真实 Formal 牌组未覆盖。
- 红线复查：沿用上轮已记录的 SSOT 无 diff、三处版本号同为 1.5.0、AI 开关缺省关闭及无 commit/push 结论；本轮无业务文件写入。工作区其它预存改动未处理。
- `next-env.d.ts`：开始本轮门禁前未出现在 `git status --short`；Playwright 后显示为已修改，引用从 `.next/types/routes.d.ts`、`.next/types/root-params.d.ts` 改为 `.next/dev/types/routes.d.ts`、`.next/dev/types/root-params.d.ts`。判定为本轮 Playwright/Next dev 运行后出现的改动，按任务要求未回滚，交编排者处理。
- 已知缺口：`buildPlayableDeck` custom+snapshot 混装仍是待 Human 裁决的 C 类缺口；依冻结要求不计本次 FAIL。

### 复验总判定

**PASS（QA-COV-01 关闭）。** 七玩法 20 轮矩阵均有真实集成实测输出，三项指定门禁均 exit 0；已知 `buildPlayableDeck` custom+snapshot 混装不计 FAIL。Playwright 的 6 个既有 skip 及真实生产 UI Mutual 正向尚 deferred，仍按原范围说明，不视为本次失败。
