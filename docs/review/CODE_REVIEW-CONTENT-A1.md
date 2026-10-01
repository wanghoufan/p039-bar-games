# CODE REVIEW｜Phase A.1 内容质量审查校准与证据收口

- Task：复审 Phase A.1 整改轮（audit-a1-router-montecarlo.ts 修 3 bug + Heat 双口径；audit-a1-report.ts 新增 8 份报告生成器 + 315 项一致性自检；重新生成 docs/qa/content-audit/ 7 md + 2 数据）
- Commit：无（本轮产物全部未提交；工作区 HEAD 仍为 2527e9f）
- Reviewer：code-reviewer（codebuddy / glm-5.3-flash）
- Result：**PASS**（P0 = 0；blocking P1 = 0；非 blocking P1 = 1；P2 = 2；P3 = 5）

> 审查方式：全部结论独立复核，不采信 builder 自述。复跑了 Monte Carlo 与报告生成器，
> 用独立脚本从 SSOT 第一性原理复算了 Heat 绑定与 dead-end 归因，并对 315 项自检做了
> 篡改实验。所有临时验证文件已删除（temp/review-verify-a1.ts 已 rm）。

---

## 一、builder 自称的 3 个 bug + 种子撞车：逐项验证结论

### Bug 1｜spin-bottle 混入抽卡池 → **属实，修法有效**

- `SPIN_BOTTLE_PACK_ID = "spin-bottle"`（lib/game-packs/spin-bottle.ts）确为 cardless 玩法，不在 `V2_MAINLINE_PACK_IDS`（lib/v2-content/v2-card-bridge.ts）。
- 修后脚本 scripts/audit-a1-router-montecarlo.ts:100-109 用 `V2_MAINLINE_PACK_IDS` 做**双向断言**（不许混入非主线包 + 不许漏掉任何主线包），加载期即抛错。6 包权重重新归一化。
- 复跑输出确认抽卡池恰为 6 包、已排除 spin-bottle。

### Bug 2｜手改 orchestration 绕过生产 Host 决策 → **属实，修法有效**

- 生产真源核对：`usedCardIds` 唯一清空路径是 `applyV2HostDecision` 的 reshuffle 分支（lib/v2-relationship/v2-session.ts:applyV2HostDecision，幂等键 `sessionId::cycle+1`）；`drawV2SessionCard` 在 `awaitingHostDecision=true` 时重入直接返回同一等待态。builder 所述「手改 awaiting=false → usedCardIds 永不清空 → 同包永久耗尽」的机制与生产代码吻合。
- 修后脚本 grep 全文：**无任何 orchestration 字段直写**（仅注释提及）；耗尽路径一律 `applyV2HostDecision(outcome.state, { decision: "reshuffle", exhaustionCycle: outcome.state.relationship.exhaustionCycle })`，且 cycle 取自 AWAITING outcome 基线，符合 R5 §6.3 幂等口径。
- 复跑：跑满 20 轮子集耗尽 1.044 次/局（与自述一致）；截断 0 局、guard 最大 62/1000，抖动不是被上限掩盖的。
- 修前「162 次/局」无法复核（旧代码已不存在），属不可复现的历史测量值（见 P2-2）。

### Bug 3｜`HEAT_ORDER[heat]` 字符串索引恒 undefined → **属实，修法有效**

- 真源核对：`HEAT_ORDER = ["H1","H2","H3","H4"]`（lib/v2-relationship/v2-state.ts），用 Heat 字符串做下标确实恒 undefined，兜底成 "H1" 的机制成立。
- 修后 scripts/audit-a1-router-montecarlo.ts:222-223 在事件归约后直接读 `state.relationship.heat`；Heat 只由 `REL_CARD_COMPLETED` 推进 `relationshipEffectiveCardCount`（v2-state.ts 唯一计数事件表），阈值 0-3/4-7/8-12/13+ 已核对。
- 复跑逐字复现：H1 14,882 / H2 18,834 / H3 19,378 / H4 22,389（合计 75,483 = totalExposure，自洽）。分布形态与我的独立计数器模拟一致（见下）。

### 种子撞车（tableKey.length）→ **修法有效**

- 修后 seed = `20260927 + i*7919 + (tableIndex+1)*104729`。104729 为素数且 mod 7919 ≠ 0，i∈[0,999] 内四桌 seed 无重叠，逐字撞车不可能复现。复跑结果四桌型数字各异（118/117/273/273 张曝光等），非逐字相同。

## 二、重点挑战项的独立验证

### 1. Heat 修复是否真的对 → **对，但有一处口径位移（已披露，记 P3-1）**

- 未采信报告数字，另写独立脚本（已删）从 SSOT 直接复算：热档推进纯由完成轮数决定，与 Router 无关，故用纯 Bernoulli(0.85) 计数器独立模拟 40,000 局（与审计脚本零共享代码）：得 H1 24.6% / H2 24.6% / H3 24.8% / H4 25.9%（**抽卡时**口径）。
- 审计报告 19.7/25.0/25.7/29.7 是**归约后**采样：触发升档的那张卡被记入新档，H1 被低估、H4 被高估。方向与幅度和两口径之差吻合，证实「不再是恒 H1」且数字可信；但两套口径的差异报告未明说（P3-1）。

### 2. 315 项一致性自检 → **fail-closed，但为运行内循环验证，篡改实验实证抓不到磁盘漂移（P1-1）**

- 「抽不到就默认通过」**不存在**：`sectionRows` 缺章节、`rowByLabel` 缺行、`toNum` 非有限数字一律 throw；三处正则兜底 `?? "NaN"` 也会经 `toNum` 的 `Number.isFinite` 检查 throw。缺数字 = 非 0 退出，方向正确。
- 但**篡改实验**：把 ROUTER-CONTENT-MONTE-CARLO.md 的 H1 曝光改为 9,999、CONTENT-STRUCTURE-REPORT.md 的高增量改为 4 题后重跑生成器 → **PASS（315/315）**。原因：脚本先 `writeFileSync` 重写全部 7 份 md（:368/:405/:432/:482/:566/:630/:779）再读回比对（:791+），磁盘上的篡改根本没被读回来。该自检只能抓「生成与抽取表达式不一致」这一类 bug，抓不了 (a) 磁盘漂移 (b) 「错误但一致生成」的数字。
- 覆盖缺口：0/14/15 节散文数字（highN/lowZeroN/judgeN 复述）、开放度分档均值、perTable 的 reshuffles/switches/曝光卡数、Heat 占比、静态表 high/midPlus、曝光的增量拆分、top/least 曝光表、校准 lean 表与分轴一致率、uniform-baseline——均未对账。这些位置若出现手写错误，315 项自检不会报。
- **当前磁盘交付物本身核对无误**（见下），故 P1-1 定级非 blocking。
- 还原确认：篡改后重跑生成器，三份 md 的 SHA256 与篡改前逐字一致（`diff /tmp/a1-md-before.txt /tmp/a1-md-after.txt` 为空，grep 9,999/是 4 题 0 命中）——顺带证明生成链确定性。临时备份 /tmp 下，不入仓库。

### 3. Monte Carlo 是否真用生产 Router → **是**

- import 并调用 `createV2MainlineRouter` / `drawV2SessionCard` / `applyV2HostDecision` / `reduceV2SessionEvents` / `eventForRoundTerminal`（scripts/audit-a1-router-montecarlo.ts:31-44、:204、:217、:251、:263）。
- 无第二套过滤/排序/调度：排序真源在 v2-router.ts:90-92（强度降序＋cardId 升序），取卡真源在 v2-session.ts（`effectiveCandidates[0]`），harness 只提供桌型/玩法权重/85% 完成率三个局外输入。
- grep 无 orchestration 直写残留（仅注释）。

### 4. 41.5% dead-end 归因（SSOT intensity↔Heat 绑定）→ **成立**

- 独立读 SSOT 生成物（lib/v2-content/generated/v2-ssot.generated.json，350 张）：intensity=1 全部 heatMax=2（58 张）、intensity=2 全部 heatMax=3（70 张）、I3/4/5 全部 heatMax=4——单调绑定逐字成立。
- 整池真空静态复算：L=1 在 H3/H4 合法卡 0 张；L=2 在 H4 合法卡 0 张；L=3 起四档均非空。
- 与分档表（lim1 850/850、lim2 810/810、lim3-5 全 0）完全一致；我的独立计数器模拟（忽略软去重/切包续命，偏保守）得 dead-end 39.8%，与 41.5% 同量级。归因不是「Router 抖动」的说法成立。
- 口径校准（A.2 收口）：41.5% 是「只按关系主线抽卡」的模拟口径，证明的是**关系主线在 lim1/lim2 到 H3/H4 发生结构性断粮**，不是「App 无法继续游戏」——App 已有「切换玩法 / 结束本局」安全出口，neutral/expansion 完成轮同样计入 `sessionCompletedRounds`；不得外推成真人 41.5% 玩不下去。

### 5. Router 曝光偏斜（大冒险 7041 vs 真心话 315）→ **机制与数据均证实**

- 机制：`sortCards` = `b.intensity - a.intensity || (a.cardId < b.cardId ? -1 : 1)`（v2-router.ts:90-92）＋编排器固定取 `effectiveCandidates[0]`（v2-session.ts）。
- 数据：从 ROUTER-MONTE-CARLO-exposure.csv 独立汇总 gameType=truth 合计 **315**、dare 合计 **7041**，逐字吻合。
- 未曝光统计独立复核：350 − 278 = 72 张从未曝光，其中 matchRequired 38 张，与报告第 7 节一致。

### 6. 硬编码统计数字 → **仅残留 2 处，均为「修前」历史值（P2-2）**

- scripts/audit-a1-report.ts:682 `int(162)`（修前耗尽/局）——自产统计值写死，无法从任何 JSON 复算。
- :767 「96/350 × 20 ≈ 5.5」——Phase A 旧估算的历史引用，可接受但建议加来源标注。
- 其余全部数字均机械生成；grep 复核无其他动态统计值硬编码。

### 7. Phase A 六项错误是否都改了 → **全部已改**

| Phase A 错误 | 本轮验证 |
|---|---|
| TOP20 LOW 排序（高排最前） | 已修：md 实文 1-13 条全「0」、14 起才「低」，自检含 first-high-index 与逐行 GAIN_RANK 比对（:912-930） |
| 报告三处硬编码矛盾（10/6/11） | 已修：全部数字单源机械生成；但见 P1-1 覆盖缺口 |
| 重复簇口径（taggedGroupRate 当重复率） | 已修：双口径分列且如实标注「tagged 323 = actual 323，区分度弱」（DUPLICATE-TOP10.md §0） |
| Heat 强塞单档 | 已修：运行时曝光 + 静态可用范围双口径，跨 Heat 卡 218/单档 132 如实披露 |
| 关键词 0 命中写成「语义完全不存在」 | 已修：全文改为「显式词面命中 0 ≠ 语义不存在」，semanticHits 记 UNREVIEWED（与仲裁文件缺 topic 字段的事实一致） |
| Q5 均匀估算当 Router 模拟 | 已修：uniform-baseline 明确标注「只能当对照，不能当 Router 模拟结果」，Q5 以真实 MC 为准 |

### 8. 红线 → **全部守住（一处需澄清）**

- SSOT 生成物、350 题题面、HANDOFF.md：git status 无改动 ✓。
- 版本号：package.json / public/sw.js CACHE_VERSION / public/version.json 三处均 1.5.0 且未动 ✓。
- 无 commit / push：HEAD 仍为 2527e9f，本轮产物全部 untracked ✓。
- **4 个 Mutual 文件有未提交改动**（MutualCheckSheet.tsx / v2-mutual-check.ts / e2e spec / 单测）：经 mtime（15:06/15:09，早于 A.1 脚本 16:48+）与内容（RG-01「每人只点一次」流程收敛，标注 2026-09-27 真机实测）判断，为**本轮之前的 RG-01 遗留工作区改动，非 A.1 所为**。builder「未动」的自述在本轮窗口内成立，但这 4 个文件处于未提交状态本身应尽快收口，避免与后续轮次混淆。
- 临时验证脚本 temp/review-verify-a1.ts 已删除；篡改实验改动已还原（SHA256 逐字一致）。

---

## Findings

### P0

- 无。

### P1（blocking = 0）

- **P1-1（非 blocking）｜315 项一致性自检是运行内循环验证，防不住磁盘漂移与散文节手写错**。
  - 复现：① 备份 `docs/qa/content-audit/ROUTER-CONTENT-MONTE-CARLO.md`；② `sed` 把 `| H1 | 14,882 | 19.7% |` 改为 `| H1 | 9,999 | 1.3% |`；③ `npx tsx scripts/audit-a1-report.ts` → 输出 `PASS：共 315 项`。原因：脚本先重写 7 份 md 再读回比对（audit-a1-report.ts:368-779 先写、:791 起才读），磁盘改动被覆盖，从未进入比对。0/14/15 节散文数字、cohort 均值、perTable 洗牌/切包/曝光卡数等约 40 个显示值完全不在对账范围。
  - 建议修法：拆成两步——生成模式与校验模式分离（`--verify-only` 只读回磁盘上的现存 md 与 JSON 比对，不重写），CI/收尾跑 verify-only；同时把上述未覆盖数字补进 checks。
  - 缓解现状：当前磁盘交付物已由审查独立抽验无误（Heat 表、truth/dare、72/38、TOP20 排序、双口径重复率、结构报告 headline 均与 JSON/SSOT 一致），故不 blocking。

### P2

- **P2-1｜桌型注里「4 人桌曝光 118 张」以 `[0]` 取值，1m3f 实为 117**。
  - 复现：`python3` 读 ROUTER-MONTE-CARLO.json perTable → 2m2f=118、1m3f=117；报告 ROUTER-CONTENT-MONTE-CARLO.md §3 注（audit-a1-report.ts:711）用 `perTable.filter(t=>t.players===4)[0]` 只取到 118，把两桌写成一个数。
  - 建议修法：注改为逐桌列出（118/117），或改述为「4 人桌 117–118 张 vs 5 人桌 273 张」。
- **P2-2｜生成器残留硬编码历史统计值 162**（audit-a1-report.ts:682「修前耗尽 162 次/局」）。
  - 复现：`grep -n "int(162)" scripts/audit-a1-report.ts`。该值无 JSON 真源、旧代码已删无法复算。
  - 建议修法：改为引用 Phase A 报告原文出处（文档坐标），或标注「Phase A 实测、本轮不可复现」；「96/350 × 20 ≈ 5.5」同类，建议加同一标注。

### P3

- **P3-1｜Heat 运行时曝光按归约后采样，触发升档的卡记入新档**（audit-a1-router-montecarlo.ts:222-223）：H1 19.7% 是归约后口径，抽卡时口径约 24.6%（独立计数器模拟）。已在报告披露口径但未说明两者差异的方向与量级，建议加一句。
- **P3-2｜harness 对 PACK_EXHAUSTED / RELATIONSHIP_GLOBAL_EXHAUSTED 也一律 reshuffle**（audit-a1-router-montecarlo.ts:245-275 不区分 outcome.kind）：生产中这两态并非 AWAITING，此策略轻微抬高 reshuffles/exhausted 计数。建议按 outcome.kind 区分「洗牌」与「直接切包」。
- **P3-3｜自检未覆盖数字清单**（详见 P1-1）：0/14/15 节散文、cohort 均值、perTable reshuffles/switches/distinct、Heat 占比、静态 high/midPlus、曝光增益拆分、top/least 表、lean 表、uniform-baseline。
- **P3-4｜MC_LABELS 对账循环静默跳过缺失键**（audit-a1-report.ts:702 `if (v === undefined) continue`）：JSON 键改名时该项直接不比对而不是报错，建议改为显式断言键存在。
- **P3-5｜audit-a1-calibration.ts 为未跟踪新文件，「仅补 interface 两字段」无 git 基线可佐证**；本轮只核了 interface 现状（AXES 六轴 + `learned?` 可选字段），无异常。建议下轮起审计脚本先入 baseline 再改。

---

## 三行心跳

- 目标：Phase A.1 整改轮复审 → 完成，报告落 docs/review/CODE_REVIEW-CONTENT-A1.md。
- 剩 P0：0；blocking P1：0（非 blocking P1-1 一项 + P2×2 + P3×5 已列）。
- 下一步：TM 收口——P1-1/P2-1/P2-2 可作为 A.1 收尾小改（走跳步记录），4 个 Mutual 文件的 RG-01 遗留改动需单独安排提交。
