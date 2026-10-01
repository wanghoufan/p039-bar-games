# CODE REVIEW｜Mutual 面板「每人只点一次」改造（MUTUAL-1TAP）

- 审查人：code-reviewer（codebuddy / glm-5.3-flash）
- 日期：2026-09-27
- 审查对象（仅此 4 个文件，与 Phase A.2 内容审查无关）：
  - `components/game/MutualCheckSheet.tsx`
  - `lib/v2-relationship/v2-mutual-check.ts`
  - `tests/e2e/v2-mutual-flow.spec.ts`
  - `tests/unit/mutual-check-sheet.test.tsx`
- 改造动机：RG-01（2026-09-27 真人试玩）——每人只点一次、单候选标题必须点名对方。
- 状态机：7 step（HANDOFF→IDENTITY→READY→SELECT→SUBMITTED→MASKED→NEXT/MISMATCH）收敛为 3 step（SELECT→HANDOFF_MASK→RESULTS）。

## Result：PASS

改造语义正确、D5 隐私语义完整保留、无 P0、无 blocking P1。门禁全绿（tsc / lint / unit 944 / E2E 互选流程）。发现 1 个非阻塞 P1（真机走局脚本未跟上新流程）与 2 个 P2 边角，均可后续处理，不阻断本次提交。

---

## 一、D5 隐私语义逐条核验（任务重点 1）

| # | 要求 | 结论 | 证据 |
|---|---|---|---|
| 1 | 仅双方互选才形成 MATCH；单向绝不公开 | PASS | `v2-private.ts:54-59` `mutualResult` 要求同 run 双方写同一非空值；`v2-mutual-check.ts:213-227` `finalizeMutualCheckRun` 只收 `mutualResult(pairRun).match === true` 的 pair；单向/跳过只返回中性 `{ matches: [] }`，返回类型 `MutualCheckPublicResult` 不含任何单向明细。 |
| 2 | 每位玩家 active MATCH ≤ 2 | PASS | 双重把关：`v2-mutual-check.ts:222` finalize 预检 `mayCreateMatch`（`v2-reducer.ts:120-130`，上限 `MAX_ACTIVE_MATCHES_PER_PLAYER = 2`，`v2-state.ts:157`）；落盘时 reducer `SYSTEM_MUTUAL_CHECK_COMPLETE` 分支原子复检（`v2-reducer.ts:375`），达上限中性 no-action。 |
| 3 | 单向选择只活在内存 run，不落盘/不写 localStorage/不进 URL/不打日志 | PASS | ① 组件 import 清单仅 react/portal/Button/Icon/v2-mutual-check/v2-state 类型，无任何持久化模块；② `v2-mutual-check.ts` 仅 import create-id / v2-private / v2-participants / v2-reducer / v2-state，`v2-private.ts` 头注明示「本模块不 import 任何 storage / DB」；③ 对 3 个源文件 grep `localStorage|sessionStorage|indexedDB|fetch(|console.|document.cookie|history.` 零命中；④ 归约事件 `mutualCheckFinalEvents`（v2-mutual-check.ts:244-266）只含 pairKey/playerIds 公开字段。 |
| 4 | 不提供「上一步」；离开 SELECT 后 draft/选中态/快照必须为空 | PASS | 组件无任何返回/上一步按钮；`completePerson`（MutualCheckSheet.tsx:151-161）提交前先 `setCandidates([])` 清快照再提交，随后进零按钮遮罩；下一位由定时器重新 `setCandidates(mutualPartnerIds(next.id, …))` 全新生成；unit 断言 `document.querySelector(".mutual-choice--on")` 为 null（旧选中态类名已不存在）。 |
| 5 | 候选快照 + 提交前用最新 participants 复验边合法性；目标失效拒绝提交、留原屏给可读提示 | PASS | `submitChoice`（MutualCheckSheet.tsx:167-173）用 `legalCandidates(current.id)`（实时走 `participantsRef` → `eligiblePairKeys`）复验，失效则 `MUTUAL_STALE_TARGET_NOTICE` 且不进遮罩；`submitMutualChoice` 二次校验目标 ∈ run.playerIds 且非本人（v2-mutual-check.ts:186-188），非法目标按跳过处理。unit「唯一候选在提交前失效」用 rerender 暂离复现并断言留原屏、最终空结果。 |
| 6 | `tests/unit/v2-privacy-regression.test.ts` 仍通过 | PASS | 实测 9/9 通过（见门禁输出）。 |

## 二、1.35s 交接遮罩是否引入隐私窗口（任务重点 2）

**结论：无隐私窗口。**

- 遮罩渲染内容只有「已收起。」＋交接对象昵称（MutualCheckSheet.tsx:264-273），无题面、无所选对象、无跳过/选择痕迹；unit 断言遮罩零按钮（`queryAllByRole("button")` 为 0）且 `queryByText("小D")`（上一位所选对象）为 null。
- 进遮罩前已 `setCandidates([])`、`setStaleNotice("")`，遮罩期间与自动切换后都不存在可回显数据。
- 下一位 SELECT 出现时其快照由 `participantsRef` 当场重算（MutualCheckSheet.tsx:126），不复用上一位任何状态。
- **定时器清理**：effect 依赖 `[step, cursor]`，返回 `window.clearTimeout` 清理函数（MutualCheckSheet.tsx:116-130）；卸载即清，unit「关闭/卸载即清掉交接定时器」实测通过。组件用 ref 读 players/participants，父级重渲染不会重置定时器。
- 残留一个小契约隐患见 P3-1（`open=false` 未卸载时定时器仍在走），无隐私影响。

## 三、删除「身份不符」出口后的风险评估（任务重点 3)

**结论：可接受，不构成不可接受状态。**

- SELECT 屏（有候选的单/多候选两个变体）均保留「取消本轮」→ `onCancelled` → 父组件 `setMutualCheckpoint(null)` 不产生结果、不计数、不公开任何人（unit 已覆盖）。
- 唯一缺口：零候选 SELECT 屏只有「跳过」没有「取消本轮」（代码如此，unit 反而断言了它不存在）。该屏玩家只能跳过前进，但流程永不卡死，最终必达 RESULTS/「继续游戏」。见 P2-1。
- HANDOFF_MASK 1.35s 窗口内无法取消——时长极短且自动推进，可接受。
- 主持人兜底链路完整：任何 SELECT 屏可取消本轮；错误手机在他人手上最多造成一次误选/误跳过，且单向数据不公开、不落盘，危害有界。

## 四、文案常量与注释（任务重点 4）

**已更新到位，无误导残留。**

- `MUTUAL_SINGLE_CANDIDATE_PROMPT` 旧注释「用户 V1.2 §七原文，不许改写、不许拼接姓名」已删除，新注释说明 {name} 占位符模板、RG-01 改动缘由、「判定/编排逻辑与该文案完全无关，改文案不改行为」（v2-mutual-check.ts:116-121）；渲染函数 `mutualSingleCandidatePrompt` 只做 `{name}` 替换、无其他拼接。
- 组件头注同步改写为 RG-01 三态机与隐私约束清单，与实现一致。
- 全仓 grep 已删步骤文案（已交给 TA/是，继续/我准备好了/已遮好/答案已隐藏）：生产代码零残留；仅 `tests/phone/party-run.ts` 仍在用旧流程驱动（见 P1-1），unit 中的出现均为「断言不存在」的反向断言。

## 五、测试是否被弱化（任务重点 5）

**结论：核心断言未弱化；删除的用例全部是被删步骤自身的测试，属合理随删。**

新测试对五项要求的覆盖：

1. **每人一次点击**：单候选/多候选用例断言无「提交」按钮、点一下直接进遮罩、无「已提交」「答案已隐藏」中间页（unit :78-84、:98-105）；E2E `playOnePerson` 每人点一次即返回。
2. **不回显答案**：unit 选「小D」后断言遮罩不含「小D」字样（:111-117）；遮罩零按钮。
3. **下一位从自己 SELECT 重新起步**：unit 断言下一位交接提示＋全新候选按钮＋无 `.mutual-choice--on`（:119-124）；末位「交还主持人」→自动进 RESULTS 亦有专测（:138-152）。
4. **提交前复验**：R-CB9 用例 rerender 令候选暂离，点「愿意」被拒、留原屏、走完后 matches 为空（:272-295）。
5. **只公布互选**：「全部完成后只公布双方互选的结果」「无人互选中性文案」两用例保留（:154-186），onFinished payload 逐字段断言。

E2E 保留 9 轮→检查点→MATCH 落盘→`matches` 长度与成员断言，并保留「p3/p4 跳过、单向一律不落盘」注释语义（落盘断言 `toHaveLength(1)` + p1/p2 隐含单向不公开）。

唯一覆盖回退：旧用例「Yes/No 分支不列名单」断言单候选屏不出现其他玩家按钮（小丽/小雅），新版未保留该反向断言，见 P3-2。

## 六、门禁实测输出（任务重点 6）

```
$ pnpm typecheck        → tsc --noEmit，exit 0，无输出
$ pnpm lint             → 0 errors, 11 warnings（全部为既有 warning，集中于 tests/phone 等无关文件）
$ pnpm vitest run       → Test Files 103 passed (103) / Tests 944 passed (944)
    其中 tests/unit/mutual-check-sheet.test.tsx (13 tests) ✓
        tests/unit/v2-privacy-regression.test.ts (9 tests) ✓
$ pnpm playwright test tests/e2e/v2-mutual-flow.spec.ts
    ✓ 1 [mobile-chromium] V2私密互选全流程：9轮→检查点→互选成MATCH→继续游戏 (8.9s) — 1 passed (14.7s)
```

## 七、与 A.2 的边界确认（特别注意项）

- 本轮 4 文件的 diff 均为 RG-01 改造：`v2-mutual-check.ts` 仅改文案常量区（±16 行），组件为状态机重写，两测试文件为驱动方式改写。**未触碰** `lib/v2-content/`、`lib/game-packs/built-in-seeds`、SSOT、题库。
- 工作区存在其他未提交改动，**归属另一条工作流**（P1#2 出卡公平曝光，draw-order）：`lib/v2-relationship/v2-draw-order.ts`（新文件）、`v2-router.ts`、`v2-session.ts`、`lib/engine/v2-deal.ts`、`session-engine.ts`、`tests/unit/v2-b8-game-mainline.test.ts`、`tests/unit/v2-router-fair-exposure.test.ts`。其 diff 内容全部围绕 `drawSeedFor / orderByTieBreakRotation` 的 seed 派生轮换，与互选无关，不在本次审查范围内，但**提交时建议两条工作流分开 commit**，避免混合归因。

---

## 问题清单

### P0
无。

### P1（均非 blocking）

**P1-1｜真机走局脚本 `tests/phone/party-run.ts` 仍驱动旧 7 步流程，互选环节必挂**
- 现象：`party-run.ts:370-401` 仍在找「已交给 TA / 是，继续 / 我准备好了 / 已遮好」按钮，这些按钮已随状态机收敛删除。
- 复现：真机走局跑到互选检查点（9/14/19 张有效卡后），脚本停在互选 dialog 上找不到任何已知按钮，直到超时。
- 影响：QA 真机通道下一次跑互选即断；生产语义不受影响。
- 建议修法：改写 `party-run.ts` 的互选驱动为：读 SELECT 屏小字「请把手机交给 X，其他人别看屏幕」认人 → 点对方昵称（多候选）或「愿意」（单候选）或「暂时没有/跳过」→ 等待约 1.35s 遮罩自动过 → 轮到下一位。可参考 `tests/e2e/v2-mutual-flow.spec.ts` 的 `playOnePerson`。

### P2（非 blocking）

**P2-1｜零候选 SELECT 屏没有「取消本轮」出口**
- 现象：`MutualCheckSheet.tsx:209-218` 零候选分支只有「跳过」；unit :210 反而断言了「取消本轮」不存在。
- 复现：run 中途对面性别全部暂离（或构造全同性别 participants），轮到某人时零候选，该屏无取消入口。
- 影响：流程不卡死（可跳过收场），但主持人在「后续全员零候选」场景失去中途取消入口，只能逐人跳过。属于用户要求删身份出口后留下的收窄，判定可接受，但建议补一个与其它分支一致的「取消本轮」按钮（一行 Button，无状态机改动）。

**P2-2｜run 中途 roster 变化时，`submitMutualChoice` 可能静默丢弃选择**
- 现象：run 由第一位提交时 `beginMutualCheckRun(participantsRef.current)` 定格（`pairRuns` 按当时的 `eligiblePairKeys` 建）。若此后 participants 变化新增了合法 pair，该新 pair 的玩家在 UI 上有候选（`mutualPartnerIds` 实时重算）、能点击提交，但 `submitMutualChoice` 遍历 `run.pairRuns` 找不到包含他的 pair（v2-mutual-check.ts:189-194），选择被静默丢弃，UI 却照常进遮罩显示「已收起」。
- 复现：2 人（1m1f）先提交一位建立 run → 第三人加入并激活，形成新 pair → 该 pair 双方各自提交 → 最终 matches 为空，但两人都看到「已收起」，无任何报错。
- 影响：正确性问题（选择丢失）而非隐私问题；触发条件苛刻（run 只存活数秒内 roster 发生变化），实际概率极低。
- 建议修法：`submitChoice` 复验时同时校验「目标 pair 存在于 run.pairRuns」，不存在则按失效目标处理（复用 `MUTUAL_STALE_TARGET_NOTICE` 留原屏）；或在 `ensureRun` 检测参与者集与 run 建立时不一致时重建 run。

### P3

- **P3-1｜`open=false` 但组件未卸载时，HANDOFF_MASK 定时器继续推进状态**：timer effect（MutualCheckSheet.tsx:116-130）不检查 `open`，隐藏期间 `step/cursor` 会照常前进。当前父组件以 `mutualCheckpoint !== null &&` 条件渲染，open 恒为 true 且关闭即卸载，故线上无实际影响；属 prop 契约隐患。建议 timer effect 加 `if (!open) return;`（并把 `open` 加进依赖）。
- **P3-2｜单候选屏补回「不列名单」反向断言**：旧用例断言单候选屏不出现其他玩家按钮（小丽/小雅），新版未保留。建议在 unit 单候选用例补 `expect(screen.queryByRole("button", { name: "小丽" })).toBeNull()` 一类断言，防止将来把全名单误渲染进 Yes/No 分支。

---

## 心跳

- 目标：复审 Mutual「每人只点一次」改造，产出本评审文档。
- 剩 P0：0。
- 下一步：按 P1-1 修 `tests/phone/party-run.ts` 真机驱动；P2-1/P2-2/P3 由编排者决定是否随本迭代处理。审查过程未改任何代码、未 commit/push。
