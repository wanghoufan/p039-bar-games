# QA｜Phase A.2 最终独立验证

- QA：codex / gpt-6-luna
- 日期：2026-09-27
- 范围：Phase A.2 产出最终 QA；只验证与记录。
- QA_RESULT：**FAIL（存在收口前必须处理的产物/交接/账本残留）**
- 变更边界：本次只新增本 QA 文件。sessionId 临时测试已删除；篡改报告逐字节还原。未改业务代码、脚本、题库、SSOT、报告或账本；未 commit/push。

## 1. P1#2 曝光饥饿与 sessionId 盐

### 1.1 Monte Carlo CSV 独立汇总 — PASS

实际执行 `npx tsx scripts/audit-a1-router-montecarlo.ts`，命令完成，输出节选：

```text
真实 Router Monte Carlo 完成（复用生产 Router + 生产 Host 决策，未造第二套）
总局数: 4000 ｜每桌型局数: 1000 ｜每局目标完成轮: 20
曝光卡数: 312 / 350 ｜总曝光: 75506
终止原因: {"round_limit":2340,"pack_exhausted":1554,"global_exhausted":106,"awaiting_host":0,"guard_limit":0}
trace: 8 局（每桌型 2 局）→ docs/qa/content-audit/MC-TRACE.json
```

脚本未打印 truth/dare 合计；以下在本 QA 中直接读 `ROUTER-MONTE-CARLO-exposure.csv`，按 CSV `gameType, exposureCount` 汇总：

```text
truth=8078
dare=7985
total=16063
truthToDare=1.0116
relativeDelta=0.005790
```

命令：`node` 逐 CSV 行累加 truth/dare 的 `exposureCount`；结果约 1.01:1，符合约 1:1 预期。**注意：** Monte Carlo harness 自身总曝光 75,506 与 exposure CSV 的 truth+dare 16,063 统计口径不同；truth/dare 比值仅按 CSV 的两类行计算。

### 1.2 独立临时 sessionId 实验 — PASS

使用临时 `tests/unit/tmp-session-salt-qa.test.ts`，通过生产 `createV2SessionState`、`drawV2SessionCard`、`reduceV2SessionEvents` 和 `createV2MainlineRouter` 验证。实际命令和输出：

```text
npx vitest run tests/unit/tmp-session-salt-qa.test.ts
✓ tests/unit/tmp-session-salt-qa.test.ts (2 tests)
  ✓ same session/state repeats byte-for-byte; other session differs
  ✓ 60 session exposure is within ±18%
stdout: {"counts":{"truth":714,"dare":715},"total":1429,"delta":0.0006997900629811056}
Tests 2 passed (2)
```

- 同 sessionId + 同状态：顺序逐字相同。
- 不同 sessionId + 同配置：顺序不同。
- 60 个 session：truth=714、dare=715，绝对差占比 0.07%，在 ±18% 内。
- 临时文件删除确认：`apply_patch Delete File` 成功；后续 `git status --short` 未出现 `tmp-session-salt-qa.test.ts`。

### 1.3 优先级及过滤语义 — PASS

实际命令：`git diff --unified=0 -- lib/v2-relationship/v2-router.ts lib/engine/v2-deal.ts tests/unit/v2-b8-game-mainline.test.ts`。

- `v2-router.ts` 的 `isHardEligible`、`isTargetEligible` 函数体没有 diff；强度上限、五档要求、usedCardIds、人数下限、目标模式/MATCH 谓词保持原实现。
- `v2-deal.ts` 的 `hardEligible`、`targetEligible`、`heatEligible`、`deferred` 函数体没有 diff；pack/cardType/强度/五档/已用卡/人数/MATCH、Heat 与拒绝指纹的过滤位置未变。三层只将排序接入 `orderForDraw`。
- 两处 `sortCards` 仍先按强度降序；`orderByTieBreakRotation` 按连续相同强度切组，循环移位仅在组内进行，因此组间强度优先级保留。
- `v2-session.ts` 的编排器仍取 `effectiveCandidates[0]`（`rg -n 'effectiveCandidates\\[0\\]' lib/v2-relationship/v2-session.ts` 命中原行）。

### 1.4 B8 三条巧合断言 — PASS

同一 diff 显示 `FIXED_DRAW_SEED = 20260927` 明确注入 `startRound` / `drawDeckCard`。原断言意图仍在：出卡写回 `usedCardIds`、`recentCardIds` 与 relationship 状态；两张卡按多轮抽出且不重复；第三次进入耗尽状态并验证 Host 决策。具体卡序断言随固定 seed 从 local-1/local-2 调整，没有删除或放宽上述状态断言。

### 1.5 指定回归测试 — PASS

```text
npx vitest run tests/unit/v2-router-fair-exposure.test.ts
✓ tests/unit/v2-router-fair-exposure.test.ts (19 tests)
Tests 19 passed (19)
```

## 2. 措辞修正

### 2.1 亲密主题拆分与性观念空白 — PASS

独立读取 `docs/qa/content-audit/GAP-SEMANTIC.json`：主题拆分状态 `ok`，30 张语义命中分为「亲密互动/肢体动作」24 张、「亲密边界/性观念」6 张。 `CONTENT-GAP-AND-NEXT.md` 明确写出「性观念/亲密态度问答仍是内容空白」，并说明亲密互动动作不能替代该类问答。全库搜索 `性观念已覆盖` 未命中。

### 2.2 “已稳定版 / STABLE_MAJORITY / 稳定版” — FAIL

执行：`rg -n "已稳定版|STABLE_MAJORITY|稳定版" --glob '!docs/review/CODE_REVIEW-CONTENT-A2.md' --glob '!node_modules/**' --glob '!\\.next/**' .`。

报告输出仍命中以下非豁免位置：

```text
docs/model/TASK-MODEL-LOG.jsonl:105  A2 builder批3 verdict五分类+semanticHits+稳定版标签
docs/model/DISPATCH-LOG.jsonl:160  五分类+SOCIAL_BUFFER_POOL+稳定版标签
docs/qa/content-audit/_stable/ARBITRATION-NOTE.md:1  # 稳定版标签
docs/qa/content-audit/_stable/ARBITRATION-NOTE.md:11  可复算稳定版标签
scripts/audit-a1-kappa.ts:11  漂移/稳定版标签
scripts/audit-a1-drift-stable.ts:282  “已稳定版”措辞的注释
scripts/audit-a1-report.ts:213, 1655, 1872, 1877  稳定版标签注释/摘要
```

`CODE_REVIEW-CONTENT-A2.md` 的历史引用按用户要求豁免；上列文件未获豁免。即使部分是脚本注释/归档仲裁说明，字面全库清零条件仍未满足。

### 2.3 61 张仅为参考、Phase B 控运行时构成 — PASS

`CONTENT-GAP-AND-NEXT.md §4.2` 明确写明「参考推导、非产品规则、非硬配额」，并写明 Phase B 应控制「运行时 20 轮的内容构成」，不是全库数量比例。

### 2.4 41.5% 口径 — PASS

检查 `CONTENT-STRUCTURE-REPORT.md` 和 `ROUTER-CONTENT-MONTE-CARLO.md`：文字为「关系主线发生结构性断粮」，并明确指出不等于 App 无法继续游戏。搜索 `App 玩不下去` 仅出现在报告/生成脚本的禁止外推提示句中，没有作为结论表述。

## 3. verify-only 篡改实验

脚本：`npx tsx scripts/audit-a1-report.ts --verify-only`。按要求先基线、再改报告数字、再恢复，以下为实际输出：

```text
--- 基线 exit=0 ---
一致性自检：共 1,105 项
PASS：磁盘报告中的数字（表格行 + 散文节）与 JSON 真源逐项一致（容差 0.000001）

--- 数字篡改 exit=1 ---
一致性自检：共 1,105 项
FAIL：1 项不一致/缺项
✗ struct:0:highN @ S#0｜报告值 47｜JSON 值 40｜差值 7.000000

RESTORE_BYTE_IDENTICAL=true
--- 还原后 exit=0 ---
一致性自检：共 1,105 项
PASS：磁盘报告中的数字（表格行 + 散文节）与 JSON 真源逐项一致（容差 0.000001）
```

篡改文件为 `CONTENT-STRUCTURE-REPORT.md` 首段“高 40 题（11.4%）”，临时改为 47 题（13.4%）。用内存备份原始字节并恢复，确认 `RESTORE_BYTE_IDENTICAL=true`。

**无“抽不到就默认通过”路径 — PASS：**直接读 `scripts/audit-a1-report.ts` 的对账实现。表格缺章/缺行/解析失败转 `NaN`；散文正则未命中转 `NaN`；比较结果记录 mismatch 并非零退出；`MC_LABELS` 有键而 JSON 缺键会增加显式 `MISSING_KEY` 失败项。没有将未命中静默当作通过的路径。

## 4. 门禁

| 命令 | 结果 | 实际输出摘要 |
|---|---|---|
| `npx tsc --noEmit` | PASS | exit 0，无输出 |
| `pnpm lint` | PASS（有 warning） | exit 0；0 errors，11 warnings |
| `pnpm test` | PASS | 103 files passed；947 tests passed |
| `pnpm build` | PASS | Next.js 16.3.3 编译/类型检查/静态页生成成功 |
| `pnpm build:export` | PASS | 静态导出完成：`out/`，临时移出项目文件后已放回 |
| `npx playwright test` | PASS（含 skip） | 109 tests；105 passed，4 skipped，0 failed |

## 5. 红线与串线

### 5.1 SSOT、题面、版本及 Plan — PASS

实际核查 `git diff --quiet -- lib/v2-content/generated/v2-ssot.generated.json` 输出 `SSOT_DIFF=0`。`git diff --name-only -- docs/content docs/pm/PRODUCT_PLAN_V2.0.md` 无输出；SSOT 350 题面所在文件无改动。版本命令实测：`package=1.5.0 version.json=1.5.0 sw-cache=1.5.0`。

### 5.2 P1#1 未实施 — PASS

`docs/qa/DEADEND-CHANGE-C-IMPACT.md` 保持影响分析/提案性质，并明确共同红线禁止提高开放度；报告建议 Phase B 处理内容矩阵。生产 diff 未触及 reducer、Heat 阈值、exhaustion 或入口 UI。搜索生产代码的 `intensityLimit` 周围，没有自动提升/改写用户开放度的实现；其在 router/deal 中仍作候选上限过滤。死局比例仍为报告所述 1,660/4,000=41.5%（关系主线抽卡口径）。

### 5.3 D1~D8、Mutual commit 隔离、剩余工作区 — PARTIAL / FAIL

- PRODUCT_PLAN 与 SSOT 无 diff，D1~D8 未改 — PASS。
- `git show --stat --oneline 987da2d` 输出 8 个 Mutual 专属文件，未含 A.2 文件 — PASS。Mutual 1TAP 的 Builder/Reviewer/QA/Supervisor 行可在两本账找到；`node scripts/model/check-ledger.mjs` 输出 `LEDGER-OK`。
- A.2 builder 批次 1–4、code-reviewer 与 product-reviewer 派工记录均已在账本；**本次 A.2 QA 最终验收和 supervisor 终检尚无对应账本行**。两链账本具备 Mutual 记录，但 A.2 尚未覆盖最终 QA/supervisor 收口动作 — FAIL（待收尾记账）。
- 起始 `git status --short` 中已存在 `next-env.d.ts` 修改（Next 自动生成路径从 `.next/types` 指向 `.next/dev/types`），本次未编辑/还原。当前状态还包含 A.1 命名的 `BUGS-CONTENT-A1.md`、`CODE_REVIEW-CONTENT-A1.md` 与 `scripts/*v2-350.ts`；它们是否应归入 A.2 交付批次，按文件命名/来源看无法确认属于 A.2。故“剩余改动应全属 A.2”不能判 PASS。当前其他核心未提交文件与 A.2 范围一致。

## 6. 账本与 HANDOFF

### 6.1 账本校验 — PASS / 部分覆盖

```text
node scripts/model/check-ledger.mjs
LEDGER-OK
```

Mutual 1TAP 的 review、builder、QA、supervisor 任务均有记录。A.2 存在 builder 多批、code-reviewer、product-reviewer 记录；最终 QA 和 supervisor 两行缺失，故整条 A.2 链覆盖不完整（见 §5.3）。

### 6.2 HANDOFF 状态 — PASS / 发现历史残留

- `RC_NEEDS_REFREEZE`：HANDOFF 明确标为当前状态，并说明 Router 已改、旧条件式口径作废 — PASS。
- `CONTENT-01=OPEN`、`RG-02=HOLD_BY_CONTENT_01`：均明确写出 — PASS。
- “如果改 Router 才需要重冻”只出现在说明“旧表述作废”的历史引文中，没有作为当前条件规则 — PASS。
- HANDOFF 同一文件仍保留 Phase A.1 的旧待决问题“低开放度桌……是否自动提开放度？”以及旧曝光数字 7,041:315 / “当前授权明确禁止”，与 A.2 已修 P1#2 后的现状不一致。它没有证明生产逻辑偷偷提升开放度，但交接文档存在过期信息 — FAIL（需在允许的后续文档整合阶段更新）。

## 7. 临时改动与证据清理

- 临时测试：`tests/unit/tmp-session-salt-qa.test.ts` 已删除，git status 无残留。
- verify-only 篡改：`CONTENT-STRUCTURE-REPORT.md` 已按原始字节恢复，`RESTORE_BYTE_IDENTICAL=true`；还原后 verify-only exit 0。
- 其余工作区修改在任务开始时已存在；未尝试还原他人/前序阶段改动。E2E/build 产生的测试输出或构建目录未纳入提交，未改 SSOT/题库。

## 总体结论

技术 P1#2 验证通过，核心过滤与优先级保持；全部指定自动化门禁通过。**本轮 QA 不放行 A.2 收口**：全库仍有非豁免“稳定版”旧称，HANDOFF 留有过期的自动提开放度待决及旧曝光数字，且账本缺 A.2 QA/supervisor 收口记录；工作区也有归属不明/前序命名的残留文件。

**Phase A.2 能否收口并进入 PLAN_REOPEN_REQUIRED？不能。**先在授权范围内清理上述报告/交接/账本与工作区归属问题，再复审；按任务约定不重冻 RC。

遗留清单：

1. 清除全库非豁免“已稳定版 / STABLE_MAJORITY / 稳定版”残留，并重新跑 grep 与 verify-only。
2. 更新 HANDOFF 过期 Phase A.1 自动提开放度问题、旧 Router 曝光数字及授权说明，确认保留的引用标为历史事实。
3. 补齐 A.2 QA 与 supervisor 收口账本记录，重新执行 `check-ledger.mjs`。
4. 明确 `next-env.d.ts`、A1 命名 QA/review 与 `audit-*v2-350.ts` 的归属；确认非 A.2 的残留不混入 A.2 收口。

目标：Phase A.2 最终独立验证并记录全部收口证据。
剩 P0：QA FAIL（稳定版术语残留、HANDOFF 过期信息、A.2 QA/supervisor 账本缺行、工作区归属未清）。
下一步：清除遗留并复审后，再判断是否进入 PLAN_REOPEN_REQUIRED；不重冻 RC。


## 收口结论（2026-09-27）

本节是追加的收口回执，前文 FAIL 判定为当时事实、予以保留；未改写或删除前文任何判定。

### 四项遗留复验

1. **全库「稳定版 / STABLE_MAJORITY」旧称残留**：原判为全库有非豁免残留；复验结果为**按要求的严格 grep 条件仍有一处残留，未完全闭环**。命令 `rg -n '稳定版|STABLE_MAJORITY' --glob '!node_modules/**' --glob '!docs/review/CODE_REVIEW*' --glob '!docs/qa/BUGS-CONTENT-A2.md' --glob '!docs/model/TASK-MODEL-LOG.jsonl' --glob '!docs/model/DISPATCH-LOG.jsonl' .` 实测命中 4 行：`scripts/audit-a1-report.ts` 第 218、1681、1682 行（降级锁探针及注释），以及 `docs/handoff/HANDOFF.md:35`（历史描述“稳定版术语残留”）。因此不满足“豁免文件之外只剩 audit 脚本”的字面验收条件；该 HANDOFF 命中是在记录旧 FAIL 的历史事实，但本次按限制未改 HANDOFF。
2. **HANDOFF Phase A.1 过期内容**：原判为旧问法与曝光数字残留；`rg -n '7,041:315' docs/handoff/HANDOFF.md` 实测无命中；`rg -n '是否自动提开放度|自动提开放度' docs/handoff/HANDOFF.md` 实测仅命中第 59 行一处，原文明确标记该旧问法“作废”，并写明自动提高开放度是本轮明令禁止项。按历史问法已作废处理，旧数字已清除。
3. **账本缺 A.2 QA / supervisor 收口记录**：原判为两行缺失；`rg -n 'A2.*(QA|验收)|QA.*A2|A\.2.*(QA|验收)|supervisor.*A\.2|A\.2.*supervisor' docs/model/TASK-MODEL-LOG.jsonl` 实测 A.2 QA 最终验收 `FAIL` 行在第 112 行，A.2 supervisor 终检 `PASS` 行在第 114 行；`node scripts/model/check-ledger.mjs` 输出 `LEDGER-OK`。缺行问题已闭环，历史 QA FAIL 行保留。
4. **工作区归属不明**：原判 `next-env.d.ts` 有修改且 A.1 命名文件归属不明；`git status --short -- next-env.d.ts` 实测无输出，即该文件当前无工作区改动。Git HEAD 为 `92943e7`（A.2）且其上一提交为 `987da2d`（Mutual）。此前对 A.1 命名 QA/review 与 `scripts/*v2-350.ts` 的归属判断，当前工作区文件名仍显示其为 A.1 命名；本 QA 本轮未改动这些文件，也未重新核定其归属。因此不能把原来关于这批文件的“归属不明”描述写成已由本次复验消除。

### 最终判定

`npx tsx scripts/audit-a1-report.ts --verify-only` 实测 exit 0，输出 `一致性自检：共 1,105 项`、`PASS：磁盘报告中的数字……逐项一致`；`node scripts/model/check-ledger.mjs` 输出 `LEDGER-OK`；`npx tsc --noEmit` exit 0、无输出。账本记录的 supervisor 终检为 `PASS，P0=0、blocking P1=0`，且明确放行 A.2 并进入 `PLAN_REOPEN_REQUIRED`、不重冻 RC。

综合既有 supervisor 放行与本轮复验，**Phase A.2 可以按 supervisor 结论收口并进入 `PLAN_REOPEN_REQUIRED`**。QA 复验同时保留两项证据边界：严格旧称 grep 仍命中 HANDOFF 的历史记录；A.1 命名文件的归属未由本轮独立核定。进入下一阶段前，不能将这两点描述成已由本轮复验彻底消除。
