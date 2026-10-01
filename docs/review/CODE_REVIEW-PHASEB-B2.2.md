# CODE REVIEW

- Task: CR-1｜Phase B B2.2 全部代码改动复检（含 8 单 builder 产物 B3-2 ~ B3-14）
- Commit: 工作区未提交改动，HEAD = `57f5be3`（本评审未产生任何新 commit）
- Reviewer: code-reviewer（glm-5.3-flash）
- Result: **过（PASS）** — P0 = 0，blocking P1 = 0；非 blocking P1 = 0；P2 × 4；P3 × 2

> ⚠️（2026-09-28 收尾补注，neat-freak；未改写原结论）本评审当时「工作区未提交改动」（HEAD `57f5be3`）；B2.2 批次已随 `8bcef40` 提交并 push `main`。原文为该时点事实，保留留痕。

> Dispatch / Evidence ID 系字段 2.0 已废弃，不填。

## 评审输入与复跑证据

- 判据一：`temp/B2.2批次提示词-V1.1.md`（Human Step 1~7 冻结原文，逐条对照）。
- 判据二：`docs/pm/PRODUCT_PLAN_V2.2-FIXED-CONTENT-FIRST.md` §13（经 Plan 模板引用）。
- 复跑门禁（本评审独立执行，非采信编排者）：
  - `npx tsc --noEmit` → 0 error；
  - `pnpm lint` → 0 error / 11 warning（既有）；
  - `npx vitest run --testTimeout=30000` → **115 文件 / 1134 用例 / 0 failed**；
  - `npx playwright test tests/e2e/v2-mutual-flow.spec.ts tests/e2e/session-current-pack-recovery.spec.ts` → 6 passed / 1 skipped（正向 UI E2E = DEFERRED_BY_HUMAN 显式 skip）；
  - `pnpm build:fixed-manifest` → legacy 390 / **formal 0** / 逐卡对账 390/390 一致 / hash 两次构建可复现；
  - 全量 playwright（106 passed）未重跑，采信编排者同日实测（关键负向 E2E 已单独复跑通过）。

## 评审问题逐条结论（Human 冻结 12 问）

### Q1｜Heat 豁免是否放松 fail-closed — **未放松，PASS**
- ① `isEffectiveInformationRound`（`lib/v2-relationship/v2-reducer.ts:158-166`）保持 fail-closed 五项判定一字未松：`selfDisclosed !== true` / `informationGain === undefined` / `zero|low` / `topic === undefined` / `disclosedPlayerIds` 非数组，任一命中即「非有效信息轮」。无任何默认值回退。
- ② legacy 轨全冻结链路成立：卡侧 metadata 唯一出口 `metadataForCard`（`lib/v2-content/v2-card-quality-index.ts:131-134`）对未补标恒返回 `{informationGain:null, topic:null}`（`:52-55`）；事件侧 `eventForRoundTerminal`（`lib/engine/v2-deal.ts:427-436`）只在 REL completed 且显式提供披露信号时写字段，生产调用 `roundDisclosureForCurrentRound()` 恒 `undefined`（`app/game/page.tsx:52-57`）。于是 effective count / `recognitionEvidence`（`v2-reducer.ts:472-484`）/ Heat（`:550`）/ cooldown 递减（`:557`）/ mutual 门（`mutualDueGates:375-381`）对 legacy 轨全部不推进；负向 E2E 实测 20 轮后 count=0 / evidence=0 / Heat=H1 / matches=0（`tests/e2e/v2-mutual-flow.spec.ts` 断言③⑤⑥）。
- ③ 无暗门：`projectFromSsot` 非法/缺失枚举一律 null（`v2-card-quality-index.ts:85-95`）；覆盖层 `setCardQualityIndexOverrides` 注释明示「生产代码不得调用」且生产无调用点（全仓 grep 仅 tests）。
- 备注：Heat 硬过滤只对 Formal 卡生效（`lib/engine/v2-deal.ts:77-88`、`lib/v2-relationship/v2-router.ts:64-67`），而 `formalFixedIdSet` 当前为空 ⇒ 该豁免**当前无可观察行为差异**（legacy 卡本就不推进 Heat），是面向 Formal 轨的前瞻口径，不构成放松。

### Q2｜「legacy 默认 metadata」绕道 — **无，PASS**
全仓搜 `informationGain`/`topic` 写入点：SSOT 未补标（SSOT 三件套 diff 为空）；sidecar 投影只产 null；唯一非 null 写入路径是测试 override（`tests/integration/*` 的 `setCardQualityIndexOverrides`）与 `roundDisclosureSignal` 的显式调用方参数；生产路径 fail-closed。

### Q3｜两 Router 同口径 — **等价，PASS**
`v2-deal.ts` 的 `heatEligible` 用 `isFormalFixedCard(card)`（含 `source==="builtin"` 前置，`fixed-content-manifest.ts:351-357`）；`v2-router.ts` 用 `formalFixedIds.has(card.cardId)`（`:49,:65`）——其输入域恒为 SSOT builtin 卡，二者等价。两者都只在 `bucket()` 生效、`pack()`/`global()` 不套 Heat 档，口径一致。`tests/unit/v2-single-anchor.test.ts:933-970` 双 Router 对照断言保留并通过。

### Q4｜production-chain integration 是否走正式入口 — **是，PASS**
- `tests/integration/v2-production-chain-recognition-mutual.test.ts`：轮终态一律 `resolveRoundAndReduce` + `roundDisclosureSignal`（`:162-167`），文件头纪律声明与实查一致：无手搓 `RelationshipEvent`、无直写 `relationshipState`/`recognitionEvidence`/count；Mutual 收束走页面同款 `finalizeMutual`（`:199-222`）。
- `tests/integration/v2-mid-mutual-abandoned.test.ts` 同手法，11 个用例覆盖 count=14 全部前置条件（含⑩候选口径一致性反例）。
- sidecar override 均 `afterEach` 清 override+懒缓存，且各有「清理自证」用例（B3-7 ⑥ `:455-467`、B3-8 ⑪ `:502-511`）——清理失效会立刻红。
- 备注：unit 层既有 harness（`v2-single-anchor`/`v2-b10`）仍手拼事件，属 reducer 单测既有模式，不在「E2E 禁止绕过生产链」禁令范围内。

### Q5｜D1 修复同源且无残留 — **PASS**
- 候选唯一实现 `mutualCandidateIds` 只在 `v2-participants.ts:142-150`；`v2-mutual-check.ts:44` 原样转出，不再有第二套。
- 模块级可变 resolver 已删（`v2-reducer.ts:383-394` 注释留档「为什么不是 injectable 单例」）；`reduceV2SessionEvents` 缺省按 `state.participants` 现算并沿 `reduceRelationshipEvent` 传入 6a 与 `SYSTEM_MUTUAL_CHECK_DUE`（`v2-session.ts` diff、`v2-reducer.ts:504-517,:581-588`）。
- 生产调用链覆盖真实入口：`app/game/page.tsx` `applyRoundSignal` → `resolveRoundAndReduce`（engine 级原子 resolve+reduce，`session-engine.ts` 新增），转瓶子链内终态仍走 `reduceResolvedRound`（无 result → fail-closed）。

### Q6｜D2 awaiting 语义 — **PASS，且 D8 严格方案 A 完整落地**
- `mutualCheckTrigger` 把 `awaitingHostDecision===true` 判为实时阻断 reason=`awaiting-host-decision`，**不写** `midMutualCheckAbandoned`（`v2-mutual-check.ts:132-134` + 判定顺序注释 `:107-117`）；reducer 6a 有意不判「私聊在跑/等待态」这两项运行态，注释明确「暂时被挡 ≠ 永久放弃」（`v2-reducer.ts:501-503`）。B3-8 ⑧ 用同一局面正反对照证明阻断确实来自 awaiting。
- D8 冻结未破坏：`startRound`（`session-engine.ts:109-112`）与 `switchPack`（`:275-279`）awaiting 早返，UI awaiting 分支先于 cardless/空题库渲染且不渲染切包面板（`app/game/page.tsx:248-258`），`hostDecision` 仅 `"finish" | "reshuffle"`（`:206`）；洗牌救不回时只给中性说明+结束本局（`AWAITING_NO_RECOVERABLE_GUIDANCE`，`v2-deal.ts:581`）。E2E `session-current-pack-recovery.spec.ts` 已锁死「切换玩法/查看总结/返回首页 均不可见」。

### Q7｜Step 3 留空 — **PASS**
`mutualFinalCheckTrigger`（`v2-mutual-check.ts:162-177`）只剩 `HEAT / TIMING` 注释占位，无 Heat/时点取值；全仓 grep 确认 `app/` 无任何调用点（未接 App 结束流程）。中途互选 `MUTUAL_MIN_HEAT=H3` 保留（`v2-state.ts:82`、`v2-reducer.ts:355`）且 B3-8 ⑤ 做了契约断言。

### Q8｜Step 4 两轨 + 无折让 — **PASS**
- `allowLegacyMetadata` 代码区（lib/app/components/scripts/tests）**0 命中**。
- Formal 准入唯一判定 `satisfiesFormalAdmission` 四条全中（`fixed-content-manifest.ts:301-309`），构建期与运行期共用；`reviewed` 只来自构建期人工审查输入 `HumanFixedReview`，且强制与 `humanBarFit` 自洽（半填即抛错，`fixed-content-manifest-build.ts:195-205,:276-278`）；机器预筛只写 `machineVerdict`。
- 实测 `build:fixed-manifest`：formal=0、被拒 390（missingStrictMetadata 390 / humanBarFit≠PASS 390 / 未人工审 390）、legacy+formal hash 均可复现 —— formal=0 是如实结果。

### Q9｜Step 5/6 是否越界 — **未越界，PASS**
- 跨轨闸 `refillAllowsCard`（`fixed-content-manifest.ts:444-457`）四档口径；`tests/unit/content-track-gate.test.ts` 覆盖 Human 四条要求场景 + 不误伤：空牌堆建局补 PN-*、快照轨续补、custom+snapshot 混装两轨各自续补、AI 关闭时后台补题早返不发请求。AI 断网回退走 `buildPlayableDeck` 不经本闸（注释留档 `:442`）。
- BAR-FIT canonical input 唯一实现 `toBarFitRuntimeInput`（`bar-fit-input.ts:92-101`），四类消费方共用：audit 脚本、manifest 构建（`judgeCanonicalBarFit`）、CI 对账（`assertMachineVerdictsReconciled` fail-closed）、Human export（audit MD）；`v2-card-bridge` 复用同一份 `CONSENT_INSTRUCTION`（diff 确认唯一归属迁移）。text-only 路径强制 `forensic:true`/`admissionEligible:false`（`bar-fit-reconcile.ts:128-140`）。实测逐卡对账 390/390 一致。

### Q10｜测试改动逐判 — **均为「锁死新口径的必要修正」，无「为过而放宽」**
| 文件 | 判定 | 理由 |
|---|---|---|
| `v2-b7-router-single.test.ts` | 保留 | Heat 档断言改为「bucket 出现 heatMin>1 卡」，锁定 B3-2 已批准的 Formal-only Heat 口径；其余硬过滤断言未减。 |
| `v2-router-fair-exposure.test.ts` | 保留 | TIE_FIXTURE 数字按新口径重算（80 桶/20 张强度 4）；MC 两用例仅显式 30s timeout，样本量与 ±18% 公平阈值未动；固定期望序列随 top 档重算。 |
| `v2-single-anchor.test.ts` | 保留 | harness 补 disclosure 字段是 fail-closed 下的必要适配（completed 轮不带合格信号本就 +0）；定向归属仍由原逻辑派生。 |
| `pack-refill`/`pack-switcher`/`random-launcher`/`spin-bottle-chain` fixtures | 保留 | 把「AI 卡当整副牌堆」改为「AI+快照卡」，与被验证语义（补位不删已有牌、同轨闸）一致；AI 卡保留断言仍在。 |
| `v2-privacy-regression.test.ts`（9→12） | 保留 | 检查点窗口 9/14/19 → 12/13/14 的必要同步。 |
| `session-current-pack-recovery.spec.ts` | 保留 | 断言收紧（awaiting 下三个出口按钮全部不可见），是加强不是放宽。 |
| `would-you-rather.spec.ts` | 保留（见 P2-2） | 拆成「AI 缺省关闭」新契约测试 + 「AI 启用断网」env 门控 skip（附单独跑法注释）。 |

### Q11｜红线核查 — **全部 PASS**
- SSOT 350 题真源：`git diff HEAD -- *ssot* v2-seeds* docs/content` 为空；`built-in-seeds` 无改动。
- 版本三处同值 `1.5.0`（package.json:3 / public/sw.js:7 / public/version.json）。
- `AI_MAINLINE_ENABLED` 未在任何 .env 注入；`isAiMainlineEnabled()` 缺省 false；E2E（不注入 env）按关闭跑并有专门契约测试。
- 未新增 Host 披露 UI：`roundDisclosureForCurrentRound` 恒 undefined、无新控件、无主持人确认步骤。
- 无 commit/push：HEAD 仍 `57f5be3`，全部改动在工作区。

### Q12｜已知缺口如实标注 — **均已如实暴露，无隐瞒（P2/P3 留办）**
1. `buildPlayableDeck` 混装（新建牌堆 custom+snapshot 同装）：B3-14 派工单明记「停下汇报」，builder 判 C 类停线未改 —— 已标注，待 Human Gate（P2-1）。
2. MC 旧数字作废：B3-13 重跑后新 `ROUTER-MONTE-CARLO.json` 在位；「受牵连手写报告清单」按派工归编排者/QA/neat-freak 更新，本评审范围内未见已落盘清单 —— 留办（P2-3）。
3. `MUTUAL_MIN_HEAT` JSDoc 残留：`v2-state.ts:76-78` 仍写「中途/**最终**互选的最低 Heat」，而最终互选已不用它 —— 一行文档残留在（P3-1）。
4. `mutualFinalCheckTrigger` 未加 awaiting 阻断：确认无此检查（`v2-mutual-check.ts:162-177`），代码内亦无「已知缺口」标注；当前未接生产故无实际影响，但接入前必须补（P2-4）。

## P0 / P1 Findings

- 无。

## P2 / P3 Backlog Findings

- **P2-1**｜`buildPlayableDeck` 混装缺口停线中：新建牌堆仍把 custom 与快照内旧题装进同一副牌堆。当前 formal=0 且该形态是「第二条路」既有行为，无现实违反；但 Formal 轨启用前必须先走 Human Gate 定方案（分轨存放 or 单轨建堆）。`lib/ai/generate-deck.ts:44-58`。
- **P2-2**｜`tests/setup.ts:9` 把单测环境 `AI_MAINLINE_ENABLED` 缺省置 `"true"`，与生产缺省（关）相反。已有双向缓解（`ai-mainline-isolation.test.ts` 显式关；Playwright 不注入按关跑），但该分叉须长期写在 setup 注释里防失效——任何「只在关闭态成立」的新生产行为都不能只靠全量单测兜住。
- **P2-3**｜B3-13 的「受 MC 旧数字作废牵连的手写报告清单」尚未见落盘产物（`docs/qa/content-audit-v2/` 仅 BAR-FIT 两件）；归编排者/QA 收口，防旧数字与新数并列。
- **P2-4**｜`mutualFinalCheckTrigger` 缺 `awaitingHostDecision` 阻断且代码内未标注该已知缺口；建议现在补一行注释占位（不接生产、不改行为），防未来接入时带病上线。
- **P3-1**｜`v2-state.ts:76-78` `MUTUAL_MIN_HEAT` JSDoc「中途/最终互选」表述过期（最终互选已解绑 Heat），一行订正。
- **P3-2**｜生产侧「本人揭晓」采集通道未落地（`roundDisclosureForCurrentRound` 恒 undefined ⇒ 生产中途互选在 metadata 补标前也不可达）。代码注释称 Human 已接受该代价，建议编排者在 HANDOFF 显式记一句，避免下轮被当成新回归误报。

## 总判定

**PASS**（P0 = 0 / blocking P1 = 0）。B2.2 七个 Step 的代码实现与 Human 冻结原文逐条对得上；fail-closed 链路（metadata → 事件 → 归约 → Mutual）无默认值暗门；测试改动全部是锁死已批准新口径的必要修正；四项已知缺口均如实暴露、无一被测试掩盖或代码藏匿。可交 QA → supervisor。
