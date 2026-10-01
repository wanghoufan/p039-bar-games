# 真实 Router 内容 Monte Carlo（Phase A.2）

> 真源：ROUTER-MONTE-CARLO.json + MC-TRACE.json（scripts/audit-a1-router-montecarlo.ts 产出）。
> 引擎：生产 D2 唯一 Router（createV2MainlineRouter）+ 生产编排器（drawV2SessionCard）+ 生产 Host 决策（applyV2HostDecision）+ 生产回合终态归约（eventForRoundTerminal）。本 harness 只提供局外输入（桌型 / 玩法选择 / 完成-跳过 / 互选成立），不复制任何过滤、排序、调度逻辑。
> 规模：4,000 局（4 桌型 × 1,000 局），每局目标 20 轮完成；再跑一遍 1,000 局/桌型的 MATCH-enabled 扫描。抽卡池为 6 个出主线卡的玩法。
> 已排除玩法：spin-bottle（转瓶子为 cardless 玩法，不在 V2_MAINLINE_PACK_IDS，createV2MainlineRouter 对它恒返回空集，即 Phase A bug 1）
> ⚠️（2026-09-28 neat-freak 加注，未改写生成内容）本报告全部运行时数字已由 2026-09-28 重跑取代，真源见 `docs/qa/content-audit/ROUTER-MONTE-CARLO.json`（4,000/4,000 跑满、dead-end 0、heatAtDraw 100% H1、matchesCreated 0）。
> ⚠️（2026-09-28 第二轮 neat-freak 补注，仍未改写生成内容）CONTENT-01 第一包 24 张 Formal Fixed 已入池后，连上面引用的 `ROUTER-MONTE-CARLO.json` 也只是**入池前（formal=0）快照**；含 Formal 卡的现行运行时真源＝`docs/qa/content-audit/FORMAL-TRUTH-MC.json` ＋ `docs/qa/content-audit/FORMAL-TRUTH-PRODUCTION-CHAIN.json`（单包 truth-dare 口径：ceiling=1 dead-end 67.2%、H3 2.6%、H4＝0、窗口 count≥12 不可达）。本文件不重算、不重写数字。
> ⚠️（2026-09-29 neat-freak 三注，仍未改写生成内容）第一包经「Truth H1 Bootstrap」后 Formal 由 **24 → 31**（第一包 24 ＋ Bootstrap 7），`heatMin=1` 的 Formal 由 3 → 11、Engine 口径冷启动已解除；上条「第一包 24 张 Formal」的现值已过期。含 Formal 卡的运行时真源仍为 `docs/qa/content-audit/FORMAL-TRUTH-MC.json` ＋ `docs/qa/content-audit/FORMAL-TRUTH-PRODUCTION-CHAIN.json`（在 `docs/qa/content-audit/`，**不在** `content-audit-v2/`）。本文件不重算、不重写数字。

## 0. 读这份报告前必须知道的四件事

1. **perTable 与 overallCompleted20 只统计跑满 20 轮的局**（占 58.5%），与「每局 20 轮」的原始设定对齐；overall 才是全部 4,000 局。
2. **跑不满的局不是 Router 抖动**：开放度上限 ≤2 的桌在 Heat 升到高段后 relationship-aware 主线整池零合法卡（卡面 intensity 与 heatMax 单调绑定），必然 dead-end——见第 4 节分档表。这里的 dead-end 准确含义是**关系主线发生结构性断粮**，**而不是 App 无法继续游戏**：App 已有「切换玩法」「结束本局」安全出口，neutral / expansion 玩法的完成轮同样计入 `sessionCompletedRounds`。
3. **Heat 有双口径**：主口径 heatAtDraw（抽卡时，与 Router Heat 门控同口径，**体验统计用它**）与副口径 heatAfterTerminal（回合终态归约后），见第 5 节；静态可用范围（第 6 节）是第三套口径，跨 Heat 卡不塞进单一 Heat。
4. **耗尽按生产 outcome.kind 分列**：PACK_EXHAUSTED / RELATIONSHIP_GLOBAL_EXHAUSTED 在生产不是 AWAITING（UI 只给「切换玩法 / 查看总结」，不提供洗牌），只有 AWAITING 才交 Host 二选一。见第 1 节。

## 1. 耗尽与切包（按生产 outcome.kind 分列，不再统一当 AWAITING 洗牌）

> 生产处置真源：lib/engine/session-engine.ts:100-102（三态说明）+ app/game/page.tsx:213-224（UI 分支）+ lib/v2-relationship/v2-session.ts:612-629（outcome.kind 产生点）。
> - **PACK_EXHAUSTED**：本玩法仍有硬合法卡（只是当前 Heat 档 / 去重窗口出不了）→ 生产给「切换其他有卡玩法」。
> - **RELATIONSHIP_GLOBAL_EXHAUSTED**：本玩法已无硬合法卡但全局仍有 → 生产给「收敛到仍有卡的关系玩法」。
> - **AWAITING_HOST_EXHAUSTION_DECISION**：三层皆空 → 生产弹 HostExhaustionSheet（结束本局 / 洗牌再玩）。
> harness 据此建模：前两者直接切包（**不调用** applyV2HostDecision，因为生产没有这一步）；AWAITING 先走生产 reshuffle，洗牌仍抽不出再按生产兜底（NO_RECOVERABLE_CARDS_GUIDANCE：换玩法）切包。

| 指标 | 跑满 20 轮子集 | 全部局（含低开放度 dead-end） |
|---|---:|---:|
| 耗尽次数/局 | 0.152 | 5.688 |
| 其中 PACK_EXHAUSTED/局 | 0.152 | 5.184 |
| 其中 RELATIONSHIP_GLOBAL_EXHAUSTED/局 | 0 | 0.504 |
| 其中 AWAITING_HOST/局 | 0 | 0 |
| 洗牌（AWAITING Host 决策）/局 | 0 | 0 |
| 切玩法次数/局 | 0.152 | 5.688 |
| guard 最大使用 | — | 38 / 上限 1,000 |
| 撞 guard 上限被截断的局 | — | 0 |
| dead-end 局 | — | 1,660（41.5%） |

结论：抖动没有被 guard 上限掩盖（截断 0 局）；耗尽几乎全部是 Pack / 全局耗尽（按生产切包处理），AWAITING 一次都没出现（0 次/局），因此洗牌次数为 0 次/局。**A.1 把三种耗尽统一当 AWAITING 记 reshuffle，属高估；本版本已按生产口径分列，不再伪造单一行为。**

### 1b. 终止原因分布（跑不满 20 轮的局必须写明原因）

| 终止原因 | 局数 | 含义 |
|---|---:|---|
| round_limit | 2,340 | 跑满目标完成轮数（正常结束） |
| pack_exhausted | 1,554 | 全池都被 PACK_EXHAUSTED 轮完仍无卡（生产：切换玩法无效） |
| global_exhausted | 106 | RELATIONSHIP_GLOBAL_EXHAUSTED 且无可切玩法 |
| awaiting_host | 0 | AWAITING 且洗牌 + 切包均抽不出（生产：Host 结束本局） |
| guard_limit | 0 | 撞 guard 上限被截断 |

> 逐局 trace（含 seed 与终止原因）落在 docs/qa/content-audit/MC-TRACE.json：每桌型前 2 局（MATCH 关闭）完整逐轮 trace，含 seed；所有 dead-end 局记录终止原因（round_limit / pack_exhausted / global_exhausted / awaiting_host / guard_limit）。

## 2. 跑满 20 轮的局：内容侧均值（与 Phase A 可比的 20 轮口径）

> 子集规模：2,340 局（占全部 4,000 局的 58.5%）。

| 指标 | 数值 |
|---|---:|
| 跑满 20 轮的局数 | 2340 |
| 占全部局比例 | 0.585 |
| 平均完成轮数 | 20 |
| 增量「高」题数/局 | 2.34 |
| 增量「中及以上」题数/局 | 7.49 |
| 人物信息主题覆盖类数/局 | 2.85 |
| 最长连续「低/0」连击均值（轮） | 9.12 |
| 现场评价/猜测 占完成轮比例 | 0.3703 |
| 社交能量「高」题数/局 | 8.96 |
| 关系推进「高」题数/局 | 9.89 |
| 切玩法次数/局 | 0.152 |
| 洗牌（AWAITING Host 决策）次数/局 | 0 |
| 耗尽次数/局 | 0.152 |

## 3. 各桌型（跑满 20 轮子集；曝光卡数逐桌列出）

| 桌型 | 局数(20轮) | high/局 | mid+/局 | 人物主题/局 | 最长低0连击均值 | 现场评价占比 | 洗牌/局 | 包耗尽/局 | 全局耗尽/局 | 切包/局 | 曝光卡数 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2男2女（2m2f） | 602 | 2.36 | 7.46 | 2.86 | 9.27 | 0.3825 | 0 | 0.15 | 0 | 0.15 | 312 |
| 1男3女（1m3f） | 588 | 2.34 | 7.54 | 2.87 | 8.74 | 0.3423 | 0 | 0.136 | 0 | 0.136 | 312 |
| 2男3女（2m3f） | 565 | 2.31 | 7.32 | 2.79 | 9.54 | 0.3963 | 0 | 0.156 | 0 | 0.156 | 312 |
| 1男4女（1m4f） | 585 | 2.35 | 7.64 | 2.9 | 8.92 | 0.3609 | 0 | 0.166 | 0 | 0.166 | 312 |

> 注：曝光卡数差异来自 minPlayers 门控与桌型人数，逐桌为 2男2女 312 张、1男3女 312 张、2男3女 312 张、1男4女 312 张（不取同类首个代表整类，避免把两个不同值写成一个数）。

## 4. 开放度分档（dead-end 的来源，必须披露）

| 开放度上限 | 局数 | dead-end 局 | dead-end 率 | 平均完成轮数 | high/局 |
|---:|---:|---:|---:|---:|---:|
| 1 | 850 | 850 | 100.0% | 8 | 0.18 |
| 2 | 810 | 810 | 100.0% | 13 | 1.17 |
| 3 | 761 | 0 | 0.0% | 20 | 3.19 |
| 4 | 797 | 0 | 0.0% | 20 | 1.89 |
| 5 | 782 | 0 | 0.0% | 20 | 1.96 |

这一档的数字全部由 SSOT 卡面属性决定：强度 1 的卡 heatMax 上限低于高 Heat，强度 2 的卡同理。也就是说**低开放度桌在 Heat 升段后，关系主线会出现整池零合法卡**——这是 Router 与卡面区间绑定的真实行为，不是模拟噪声。
> **口径校准（不得外推成「App 玩不下去」）**：intensityLimit=1/2 时，relationship-aware 主线到 H3/H4 会没有合法关系卡，证明的是**关系主线发生结构性断粮**，**而不是 App 无法继续游戏**——App 已有「切换玩法」「结束本局」安全出口，neutral / expansion 玩法的完成轮同样计入 `sessionCompletedRounds`。本表 41.5% 是「只按关系主线抽卡」的模拟口径，不等于真人无法把一局进行下去；Phase B 的首选修法是重做内容覆盖矩阵（方案 E），不是提高开放度或放宽 Heat 硬过滤。

## 5. Heat 运行时曝光（双口径；体验统计主口径 = heatAtDraw）

> **主口径 heatAtDraw = 抽卡时 state.relationship.heat**：卡片是在该 Heat 档被抽出的，与 Router bucket 的 Heat 门控条件（currentHeat ≥ heatMin 且 ≤ heatMax）是**同一取值**，内容曝光 / 体验统计一律用它。
> 副口径 heatAfterTerminal = 回合终态归约后的 heat：完成轮推进 effective count → Heat 可能升档，于是「触发升档的那张卡」被记进新档。两列之差就是该位移的量级。

| Heat | heatAtDraw 曝光（主口径） | 占比 | heatAfterTerminal 曝光（副口径） | 占比 |
|---|---:|---:|---:|---:|
| H1 | 18,909 | 25.0% | 14,909 | 19.7% |
| H2 | 18,851 | 25.0% | 18,851 | 25.0% |
| H3 | 18,518 | 24.5% | 19,368 | 25.7% |
| H4 | 19,228 | 25.5% | 22,378 | 29.6% |

> 主口径 heatAtDraw = 抽卡时 state.relationship.heat（与 Router 的 Heat 门控条件同一取值，体验统计用它）；副口径 heatExposureAfterTerminal = 回合终态归约后的 heat。两者差异即「触发升档的那张卡记在新档」的量级。与 staticHeatAvailability「静态可用范围」是另一套口径；跨 Heat 卡不塞进单一 Heat。

## 6. Heat 静态可用范围（第三套口径，按卡面 heatMin/heatMax）

| Heat | 可用题数 | 占比 | 其中增量高 | 其中中及以上 |
|---|---:|---:|---:|---:|
| H1 | 58 | 16.6% | 1 | 16 |
| H2 | 128 | 36.6% | 7 | 47 |
| H3 | 160 | 45.7% | 24 | 67 |
| H4 | 222 | 63.4% | 33 | 75 |

> 按 SSOT heatMin/heatMax 区间统计；跨 Heat 卡 218 张、单档卡 132 张，故四档 legalCount 之和大于 350。

## 7. 曝光分布：真实 Router 抽出来的内容构成

| 玩法 | 曝光次数 | 占全部曝光 | 曝光中判高 | 曝光中判中 | 曝光中判低 | 曝光中判0 |
|---|---:|---:|---:|---:|---:|---:|
| 二选一 | 13,893 | 18.4% | 4,297 | 8,421 | 1,175 | 0 |
| 我从来没有 | 13,114 | 17.4% | 365 | 3,301 | 9,448 | 0 |
| 默契测试 | 11,208 | 14.8% | 2,652 | 6,352 | 2,204 | 0 |
| 指人游戏 | 10,665 | 14.1% | 0 | 0 | 10,665 | 0 |
| 谁最可能 | 10,563 | 14.0% | 0 | 0 | 10,563 | 0 |
| 真心话 | 8,078 | 10.7% | 401 | 1,481 | 6,196 | 0 |
| 大冒险 | 7,985 | 10.6% | 0 | 1,782 | 3,333 | 2,870 |

### 曝光结构（P1#2 修复后：同强度组内不再由 cardId 字典序垄断）

抽卡池里 truth-dare、never-have、would-you-rather、compatibility-test、most-likely、pointing-game 的权重分别是 truth-dare 0.2045、never-have 0.1818、would-you-rather 0.1818、compatibility-test 0.1591、most-likely 0.1364、pointing-game 0.1364；真实曝光里「真心话 + 大冒险」合计 16,063 次（占 21.3%）。
逐玩法看：二选一 13,893 次（18.4%）、我从来没有 13,114 次（17.4%）、默契测试 11,208 次（14.8%）、指人游戏 10,665 次（14.1%）、谁最可能 10,563 次（14.0%）、真心话 8,078 次（10.7%）、大冒险 7,985 次（10.6%）。
P1#2 修复后，同一玩法内**同强度候选**由 seed 派生轮换决定起点（不再恒出 cardId 字典序最小者），且 seed 带 stable session salt：例如同一玩法包里「大冒险」（PN-DARE-*）曝光 7,985 次、「真心话」（PN-TRUTH-*）曝光 8,078 次，两者已回到同一量级（A.2 修复前实测 15,359 : 704 ≈ 21.8 : 1，属**已修缺陷**，此处仅作历史基线引用）。
跨玩法之间的曝光差异来自 pack 权重 + Heat/强度门控 + 各玩法卡数，属结构差异；**不再归因于「cardId 前缀靠后饿死」**（该缺陷已修）。
全库 350 张里，MATCH 关闭的真实模拟从未抽到过 38 张，其中 38 张带 matchRequired 标记（覆盖对比见第 9 节）。
从未曝光的玩法分布：默契测试 10 张、大冒险 10 张、二选一 8 张、真心话 10 张。

## 8. 曝光最高 / 最低的卡（各 5 张，真源 topExposed / leastExposed）

| 类型 | cardId | 曝光次数 | 增量 |
|---|---|---:|---|
| 曝光最高 | PN-EITHER-001 | 541 | 中 |
| 曝光最高 | PN-EITHER-003 | 539 | 高 |
| 曝光最高 | PN-EITHER-004 | 538 | 中 |
| 曝光最高 | PN-EITHER-002 | 534 | 中 |
| 曝光最高 | PN-EITHER-007 | 532 | 中 |
| 曝光最低 | PN-NHIE-035 | 100 | 低 |
| 曝光最低 | PN-NHIE-041 | 103 | 低 |
| 曝光最低 | PN-NHIE-046 | 103 | 低 |
| 曝光最低 | PN-MOST-050 | 104 | 低 |
| 曝光最低 | PN-MOST-039 | 106 | 低 |

## 9. MATCH-enabled simulation：38 张 matchRequired 卡的可见性变化

> 问题：matchRequired 卡（targetMode=match-pair，共 38 张，全部 intensity=5、heatMax=4）只有在目标 pair 已建立 MATCH 时才可出。MATCH 关闭的扫描里 matches 恒为空 → 这 38 张**结构性不可见**（曝光 0 次、覆盖 0/38）。
> 做法：harness 在互选检查点（9/14/19）用**生产**互选事件（mutualCheckFinalEvents → SYSTEM_MUTUAL_CHECK_COMPLETE）造 MATCH，经生产 reducer 的 mayCreateMatch 原子校验（D5：每人 ≤2）。**只造事件，不改生产 reducer / MATCH 逻辑。**
> 假设：上界口径：假设每个互选检查点（9/14/19）本桌全部合法 pair 都互选成立（受生产 D5 cap≤2/人 约束）

| 口径 | 建 MATCH 数 | 总曝光 | 曝光卡数/350 | 38 张中覆盖 | 38 张曝光合计 |
|---|---:|---:|---:|---:|---:|
| MATCH 关闭（主扫描） | 0 | 75,506 | 312 | 0 | 0 |
| MATCH 启用 | 9,434 | 75,506 | 350 | 38 | 3,018 |

**结论：38 张 matchRequired 的覆盖从 0/38 提升到 38/38**（MATCH-enabled 扫描规模 1,000 局/桌型 × 4 桌型 = 4,000 局）。

### 9b. MATCH 启用后仍未曝光的 matchRequired 卡（逐卡列出，不写成因果归因）

MATCH 启用后仍未曝光的 matchRequired 卡：0 张（无）。
说明：出卡顺序 = 强度降序 + 同强度组内 seed 派生轮换（P1#2 修复后），**不再存在「cardId 前缀靠后恒定被挤掉」的饥饿**；若日后出现未曝光卡，应逐卡核 minPlayers / Heat 档 / MATCH 门控，不得直接归因于前缀。

MATCH 启用后曝光 ≥1 的 matchRequired 卡：PN-EITHER-049（143 次）、PN-EITHER-048（141 次）、PN-EITHER-047（140 次）、PN-EITHER-043（136 次）、PN-EITHER-045（135 次）、PN-EITHER-046（134 次）、PN-EITHER-044（132 次）、PN-EITHER-050（129 次）、PN-CHEM-050（85 次）、PN-CHEM-049（84 次）、PN-CHEM-046（82 次）、PN-CHEM-044（82 次）、PN-CHEM-048（81 次）、PN-CHEM-041（80 次）、PN-CHEM-042（79 次）、PN-CHEM-043（78 次）、PN-CHEM-045（74 次）、PN-DARE-043（73 次）、PN-CHEM-047（71 次）、PN-DARE-049（67 次）、PN-DARE-045（64 次）、PN-DARE-046（62 次）、PN-TRUTH-049（62 次）、PN-DARE-047（61 次）、PN-TRUTH-042（59 次）、PN-DARE-041（57 次）、PN-TRUTH-044（57 次）、PN-DARE-044（55 次）、PN-TRUTH-045（55 次）、PN-DARE-050（55 次）、PN-DARE-042（55 次）、PN-TRUTH-050（54 次）、PN-TRUTH-043（51 次）、PN-TRUTH-048（50 次）、PN-TRUTH-046（50 次）、PN-TRUTH-047（49 次）、PN-DARE-048（48 次）、PN-TRUTH-041（48 次）。

## 10. uniform-baseline 对照（不同口径，不得混用）

| 口径 | 说明 | 高增量/局 | 中及以上/局 |
|---|---|---:|---:|
| uniform-baseline estimate | 假设等概率均匀抽题、忽略 Router 过滤与 Heat 门控 | 2.29 | 6.91 |
| 真实 Router Monte Carlo | 生产 Router + 生产编排器，只统计跑满 20 轮的局 | 2.34 | 7.49 |

对照读法：真实模拟的「中及以上」7.49 与均匀基线 6.91 的差距，来自曝光在不同增量档玩法之间的偏斜（见第 7 节）；「高」增量只有 2.34，低于均匀基线 2.29，说明高信息卡同样被抽得偏少。**均匀估算只能当对照，不能当 Router 模拟结果使用。**

## 11. 根因结论（固定表述）

**题库内容本身已足以构成体验 blocker**：350 题里增量「高」40 题、低/0 228 题（65.1%）；跑满 20 轮的真实局里，人物信息主题只覆盖 2.85/8 类，最长连续「低/0」连击均值 9.12 轮。
**Router 是否进一步放大该问题，以真实 Router Monte Carlo 结果判断**：本报告第 7 节给出可验证的曝光结构（玩法间曝光分布、同一玩法内同强度组内的 seed 派生轮换）；第 4 节给出一个与内容无关的真实行为——低开放度桌在 Heat 升段后**关系主线**整池零合法卡，属**结构性断粮**，不是 App 无法继续游戏。
因此不做单向断言：内容层是主要 blocker（证据在 CONTENT-STRUCTURE-REPORT.md 与 CONTENT-GAP-AND-NEXT.md），Router 层的曝光结构与低开放度关系主线断粮是真实存在的二次项（证据在本报告），两者的权重由 Human 拍板。
