# BUGS｜CONTENT-01 第一包（24 张 Formal Fixed 真心话）QA

- 日期：2026-09-28
- QA 对象：CONTENT-01 / PACK-1（PN-TRUTH-201~224）
- 范围：本地工作区构建、自动化门禁、Formal admission、生产链 integration、MC 产物
- 总判定：**PASS**（P0=0 / blocking P1=0；红线未破）
- 说明：PASS 仅表示本次 QA 门禁及第一包准入通过；不表示 CONTENT-01 已 CLOSED，也不表示 RC 可发布。

> ⚠️（2026-09-28 收尾补注，neat-freak；未改写原结论）本 QA 期间 30 项工作区改动**未 commit**；该批已随 `e49ee45` 提交并 push `main`。原文「未 commit、未 push」（:118）为该时点事实，保留留痕。

## 门禁总览

| 项目 | 复现命令 | 结果 | 实际输出/证据 |
|---|---|---|---|
| TypeScript | `npx tsc --noEmit` | PASS | 退出码 0，无输出。 |
| Lint | `pnpm lint` | PASS（有既有 warning） | `$ eslint .`；`✖ 11 problems (0 errors, 11 warnings)`，退出码 0。Warning 在 `scripts/audit-aggregate-v2-350.ts`（2）、`scripts/audit-report-v2-350.ts`（2）、`scripts/decision/orca-decide.mjs`（3）、`scripts/decision/run-shadow.mjs`（2）、`tests/phone/dump-state.ts`（1）；均不在本包新增文件，未见新增 warning。 |
| Vitest | `npx vitest run --testTimeout=30000` | PASS | `Test Files 120 passed (120)`；`Tests 1172 passed (1172)`；Duration 11.49s；退出码 0。 |
| Playwright | 先查 `lsof -nP -iTCP:3000 -sTCP:LISTEN`，再 `npx playwright test` | PASS（106 passed，6 skipped） | 端口检查无 LISTEN 输出，未遇端口冲突；Playwright `6 skipped`、`106 passed (46.1s)`，退出码 0。E2E 后 `git diff --quiet -- next-env.d.ts` 退出码 0，文件未被自动改写。 |
| Next build | `pnpm build` | PASS | Next.js 16.3.3 webpack；`Compiled successfully`、TypeScript 完成、21/21 static pages；退出码 0。 |
| Fixed manifest | `pnpm build:fixed-manifest` | PASS | legacy allowed **414**；audited **24**；reviewed **24**；formal fixed **24**；逐卡对账 **414:414，0 mismatch**；hash 可复现 `legacy=true formal=true`；详见下节真实摘要。 |
| 账本 | `node scripts/model/check-ledger.mjs` | PASS | `LEDGER-OK`，退出码 0。只读检查，未改账本。 |

## Playwright skipped 用例（不得计为 PASS）

以下 6 项为 Playwright 原始输出中的 skip：

1. `tests/e2e/production-offline.spec.ts:6` — 已访问的当前 Session 可在完全离线后重载恢复。原因：仅针对 production build 运行；本次命令启动 dev server，`PARTY_NIGHT_PRODUCTION_SMOKE` 未启用。
2. `tests/e2e/pwa-cache-regression.spec.ts:23` — PWA cache：版本化 cache + 旧 cache 清理 + 规则库离线 + AI 接口与密钥不进缓存。原因同上：需 production build / 真实 Service Worker。
3. `tests/e2e/pwa-schema-upgrade.spec.ts:82` — 旧 cache + 新 bundle：版本错位后 Session 仍能恢复。原因同上：仅 production build（真实 Service Worker）运行。
4. `tests/e2e/v2-mutual-flow.spec.ts:185` — V2 正向：audited metadata → 弹 Mutual → 双选成 MATCH。原因：`DEFERRED_BY_HUMAN`，Human 冻结本批不做正向 UI E2E；不得写成 PASS。正向生产链由 integration 覆盖。
5. `tests/e2e/v1-1-recovery.spec.ts:208` — PWA reload：Service Worker 接管后，切新玩法并转瓶子，落点与当前玩法一并恢复。原因：dev 下没有注册 Service Worker，仅 production build 有意义。
6. `tests/e2e/would-you-rather.spec.ts:156` — 二选一：AI 启用但断网时回退本地 seed，出题与换题都不卡。原因：仅 `AI_MAINLINE_ENABLED=true` 单独运行；正式 AI 主线保持关闭。

## 准入真实性与红线

### 逐卡 Formal 四条件与 ID

复现：

```bash
npx vite-node -c vitest.config.ts scripts/audit-formal-truth-selfcheck.ts
node -e 'const m=require("./lib/v2-content/generated/fixed-content-manifest.json"); const l=m.tracks.legacyCompatibility; const f=m.tracks.formalFixed; const ids=f.allowedCardIds; const good=ids.filter(id=>{const p=l.provenance[id];return p.metadataStatus==="audited"&&p.reviewed===true&&p.humanBarFit==="PASS"&&/^[a-f0-9]{64}$/.test(p.payloadHash)}); const old=l.allowedCardIds.filter(id=>!/^PN-TRUTH-20[1-9]$|^PN-TRUTH-21\\d$|^PN-TRUTH-22[0-4]$/.test(id)); console.log("FORMAL_CONDITION_COUNT",good.length,"LEGACY_NOT_FORMAL",old.length,"REJECT_COUNT",f.rejectedFromFormal.total)'
```

真实输出摘录：

```text
=== C1-2 第一包真心话静态自检（24 张） ===
ID 唯一：24/24；与既有 390 张冲突：0；编号段重叠：0
既有 PN-TRUTH 编号范围：1~50；本包：201~224
枚举非法：0
strict 必填字段缺失数：0
精确重复（逐字）：0；精确重复（去标点）：0
最高相似度：0.143（PN-TRUTH-219 ↔ PN-TRUTH-014，阈值 0.5）
近似清单（bigram Jaccard ≥ 0.5）：0 条
machineVerdict | PASS:24  SUSPECT:0  HARD_FAIL_PATTERN:0
全部合规：24 张；精确重复 0；枚举非法 0；strict 必填缺失 0
FORMAL_CONDITION_COUNT 24 LEGACY_NOT_FORMAL 390 REJECT_COUNT 390
```

逐卡 manifest 检查：正式 24 张每张均为 `metadataStatus="audited"`、`reviewed=true`、`humanBarFit="PASS"`、`payloadHash` 为 64 位小写十六进制 SHA-256。24 个 ID 完整连续为 `PN-TRUTH-201~224`。与既有 350 题的 ID/文本重复均为 0；旧 PN-TRUTH 编号段为 1~50，本包编号不重叠。旧 390 张（legacy allowed 414 减本包 24）均未进入 Formal；manifest 拒绝旧卡 390 张。拒绝原因是并列分类计数（`missingStrictMetadata=390`、`humanBarFitNotPass=390`、`notHumanReviewed=390`），不是三批不同卡，不能相加。

### reviewed 暗门检查

复现：

```bash
npx vitest run tests/unit/formal-truth-pipeline.test.ts tests/unit/fixed-content-manifest.test.ts --testTimeout=30000
```

真实输出：

```text
✓ tests/unit/fixed-content-manifest.test.ts (20 tests)
✓ tests/unit/formal-truth-pipeline.test.ts (6 tests)
Test Files 2 passed (2)
Tests 26 passed (26)
```

`formal-truth-pipeline.test.ts` 的测试明确以 `EMPTY_HUMAN_FIXED_REVIEW` 重建 metadata 完整的 `PN-TRUTH-201`：断言 `reviewed=false`、`humanBarFit=UNREVIEWED` 且 `formalCount=0`。完整 manifest 测试另有“metadata 完整 + 空人审输入 → formal 不准入”用例。结论：没有 metadata 自动生成 reviewed 的暗门。

### 红线核对

| 核对项 | 真实检查结果 |
|---|---|
| 旧 350 题 SSOT text | `git diff --quiet -- lib/v2-content/generated/v2-ssot.generated.json` → `SSOT_DIFF_EXIT=0`（空 diff）。 |
| 三处版本 | `package.json`、`public/version.json` 均为 `1.5.0`；`public/sw.js:7` 为 `const CACHE_VERSION = "1.5.0";`。 |
| AI 主线 | `AI_MAINLINE_ENABLED` 环境变量无值；HANDOFF 当前红线记录为正式 AI 主线关闭。 |
| RC 与 CONTENT-01 | `docs/handoff/HANDOFF.md` 当前明确 `RC_NEEDS_REFREEZE`、`CONTENT-01=OPEN`，本包入库不等于 CONTENT-01 CLOSED。 |
| Host disclosure UI | `app/game/page.tsx:52` `roundDisclosureForCurrentRound()` 恒 `return undefined`；调用仍只在 complete 分支使用。 |
| 认识阈值、窗口、H3 | `lib/v2-relationship/v2-state.ts` 保留原阈值段、`MUTUAL_CHECK_COUNTS=[12,13,14]`（窗口 `[12,14]`）、`MUTUAL_MIN_HEAT="H3"`。 |
| Next 自动文件 | E2E 后 `git diff --quiet -- next-env.d.ts` → `NEXT_ENV_DIFF_EXIT=0`，未改写。 |

## 生产链与回归

生产链证据来自 `tests/integration/v2-formal-truth-production-chain.test.ts` 与既有 `docs/qa/content-audit/FORMAL-TRUTH-PRODUCTION-CHAIN.json`；全量 Vitest 中该 integration 3/3 通过。测试不手搓 relationship state、effective count 或 Heat，不注入 metadata override；使用真实牌堆、`startRound`、真实 `resolveRoundAndReduce` 和正式 `roundDisclosureSignal`，再由 reducer 派生计数与 Heat。

- 全包真实牌堆 seed=1：20 轮；抽到 Formal `PN-TRUTH-222/224/223/217`；sidecar metadata 进入 event；effective 最终 4；Heat 第 19 轮由 H1 进入 H2。
- 仅 Formal 真实卡子集：完成 15 轮；effective 1→15；Heat 首达 H2/H3/H4 分别为第 4/8/13 轮。
- 仅 legacy 负向对照：20 轮；metadata 为 null；effective 恒 0；Heat 恒 H1；`v2-legacy-seven-modes-20-rounds.test.ts` 七种玩法 20 轮覆盖全绿，日志均为 `effective=0 heat=H1 ... matches=0`。负向 E2E `V2负向：legacy 局走满 20 轮、计数全冻结、不弹中途互选、不产生 MATCH` 通过；would-you-rather E2E 通过。

## MC 产物与已知缺口（不构成本批阻断）

`FORMAL-TRUTH-MC.json` 是统计真源；运行 `npx vite-node -c vitest.config.ts scripts/audit-formal-truth-report.ts` 重新生成 `FORMAL-TRUTH-MC.md`，报告统计由 JSON 读取。报告的缺口数字与 JSON 对应：Mode B 到 H3 为 106/4000（2.6%）、H4 为 0/4000；有效信息轮均值 3.93；count≥12 窗口为 0 局；ceiling=1 dead-end 为 518/771（67.2%），`global_exhausted`；ceiling=2 dead-end 为 0%。必须如实留档：**ceiling=1 dead-end、H3/H4 稀疏、窗口 count≥12 当前不可达**。MC 不是本轮全量重跑，按用户范围做 JSON→报告脚本复算和数据对应检查。

## 问题记录

本轮未发现 P0、blocking P1 或红线破坏。已知限制按级别记录如下：

| Bug ID | Priority | Stage P0 Blocking? | Repro 命令 + 真实输出 | 期望 vs 实际 | 影响面 | 建议归属角色 | Status |
|---|---|---:|---|---|---|---|---|
| QA-C01-PACK1-P2-01 | P2 | 否 | `pnpm build:fixed-manifest` → `formal fixed : 24 张`；MC 报告显示 ceiling=1 `dead-end 518/771 (67.2%)`，全部 `global_exhausted`。 | 期望：低强度上限下单玩法仍能持续供卡；实际：当前 Formal I1 库存不足，I1 局有 67.2% 耗尽。 | ceiling=1 的 truth-dare 单玩法体验；本批不改变强度或 Heat 准入规则。 | builder（后续内容批次补 I1 Formal 密度） | OPEN / 已知内容覆盖缺口 |
| QA-C01-PACK1-P2-02 | P2 | 否 | `npx vite-node -c vitest.config.ts scripts/audit-formal-truth-report.ts` → 报告由 JSON 生成；真实指标：H3 `106/4000 (2.6%)`、H4 `0/4000`、`count≥12 = 0`、有效信息轮均值 `3.93`。 | 期望：足够局数到达 H3/H4，并有机会进入 `[12,14]` 窗口；实际：H3 稀疏、H4 与窗口不可达。 | 当前 24 张仅占 truth-dare 124 张 Formal；整局关系热度和中途 Mutual 可达性。 | builder（补充跨玩法已审内容与 metadata）；不改阈值或 disclosure gate | OPEN / 已知计数密度缺口 |
| QA-C01-PACK1-P3-01 | P3 | 否 | `pnpm lint` → `✖ 11 problems (0 errors, 11 warnings)`。文件及数量见门禁总览。 | 期望：无 lint warnings；实际：11 条未阻断 warning，本轮没有新增。 | lint 输出噪声，不影响编译或测试通过。 | 对应文件 owner（维护旧 audit / decision / phone 测试文件） | OPEN / 既有 warning |
| QA-C01-PACK1-P3-02 | P3 | 否 | `npx playwright test` → `6 skipped, 106 passed (46.1s)`；逐条用例、跳过原因见上节。 | 期望：目标 E2E 被执行；实际：5 项需 production build/Service Worker 或 AI 开关，1 项正向 UI E2E 由 Human 明确延期。 | production PWA 离线恢复及正向 Mutual UI 路径本轮未由 Playwright 验证；正向生产 integration 已覆盖，不能替代 UI E2E。 | QA（production smoke 后续专测）；Human 决定的延期项依现有 Gate | DEFERRED / NOT VERIFIED |

## 执行边界

- 仅本报告和 `docs/qa/content-audit/FORMAL-TRUTH-MC.md`（由指定复算脚本重生成）在 QA 目录内写入；没有修改业务代码、handoff、pm、review、账本。
- 未构建 APK、未部署、未 bump 版本、未用真机、未 commit、未 push。
- 本 QA 报告创建前的工作区已有多项未提交内容；本轮不清理或回滚它们。
