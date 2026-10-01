# Phase A.1 内容质量审查校准｜独立 QA

日期：2026-09-27
范围：验证可复算性、关键整改证据、审查判断的适用边界。此报告只验证内容审查产物，不评价产品功能。

## 1. 可复算性 — PASS（确定性），有限 PASS（全链覆盖）

按要求顺序执行，退出码均为 0：

```text
$ npx tsx scripts/audit-a1-verify.ts
A1 校验 350 行，去重后 350 张
A1 全部合规：cardId/顺序/text/12字段/枚举/唯一性 均通过

$ npx tsx scripts/audit-a1-aggregate.ts
A1 聚合完成
增量分布: [["高",40],["中",82],["低",215],["0",13]]
社交能量: [["高",153],["中",185],["低",12]] ｜关系推进: [["高",197],["中",139],["低",14]]
处置: [["保留",282],["改写候选",66],["删除候选",2]]
重复簇口径: tagged 323 (92.3%) ｜actualDuplicate(>=2) 323 (92.3%)
Heat 跨档卡: 218 ｜单档卡: 132
低信息但高社交/高推进: 166
低信息榜前 3 增量: 0,0,0 （应为 0/低 开头）
高信息榜前 3 增量: 高,高,高

$ npx tsx scripts/audit-a1-calibration.ts
校准样本 70 题
  orig↔r1: 六轴全一致 14/70 (20.0%)｜infoGain 极差≥2档 5 (7.1%)
  orig↔r2: 六轴全一致 22/70 (31.4%)｜infoGain 极差≥2档 4 (5.7%)
  r1↔r2: 六轴全一致 21/70 (30.0%)｜infoGain 极差≥2档 0 (0.0%)
各轴一致率（orig↔r1）: {"semanticType":"77.1%","topic":"74.3%","infoGain":"72.9%","promotesUnderstanding":"60.0%","socialEnergy":"65.7%","relationshipProgression":"67.1%"}
系统性偏离（相对多数票）: {"orig":{"gainUp":8,"gainDown":1,"gainSame":61,"socialUp":9,"socialDown":7,"progUp":17,"progDown":2},"r1":{"gainUp":8,"gainDown":2,"gainSame":60,"socialUp":5,"socialDown":3,"progUp":2,"progDown":2},"r2":{"gainUp":3,"gainDown":2,"gainSame":65,"socialUp":0,"socialDown":11,"progUp":0,"progDown":8}}
玩法漂移：truth 0.0%；most_likely 0.0%；pointing 0.0%；chemistry 0.0%；never_have_i 10.0%；either_or 10.0%；dare 70.0%
高分歧样本 5 题 → 需 adjudication

$ npx tsx scripts/audit-a1-router-montecarlo.ts
真实 Router Monte Carlo 完成（复用生产 Router + 生产 Host 决策，未造第二套）
总局数: 4000 ｜每桌型局数: 1000 ｜每局目标完成轮: 20
抽卡池: truth-dare(0.2045) never-have(0.1818) would-you-rather(0.1818) compatibility-test(0.1591) most-likely(0.1364) pointing-game(0.1364) ｜已排除: spin-bottle
整体：完成轮/局 16.03 ｜high/局 1.46 ｜mid+/局 6.68 ｜人物主题/局 2.18 ｜最长连续低0 run 均值 7.47 ｜现场评价占比 0.2895
跑满 20 轮子集：局数 2340 (58.5%) ｜high/局 1.89 ｜mid+/局 8.17 ｜人物主题/局 2.6
抖动：耗尽/局 11.977 ｜洗牌/局 11.977 ｜切包/局 5.819 ｜guard 最大使用 62 ｜被截断局 0 ｜dead-end 局 1660 (41.5%)
开放度分档: lim1:deadEnd 850/850 lim2:deadEnd 810/810 lim3:deadEnd 0/761 lim4:deadEnd 0/797 lim5:deadEnd 0/782
曝光卡数: 278 / 350 ｜总曝光: 75483
运行时 heatExposure: {"H1":14882,"H2":18834,"H3":19378,"H4":22389}
静态可用范围: H1=58 H2=128 H3=160 H4=222 ｜跨 Heat 卡 218 ｜单档卡 132

$ npx tsx scripts/audit-a1-report.ts
一致性自检：共 315 项
PASS：报告中的关键数字与 JSON 聚合值逐项一致（容差 0.000001）
交付物：8 项（CSV、内容结构、TOP20 双榜、重复、缺口、校准、Router Monte Carlo）
```

Monte Carlo JSON 两次运行前后的 SHA-256 均为 `878491f24288d5b22610f7fc2933c1c8af80ea5e314f8571383a0e3a0e5cf04a56c`。

> 注意：同 seed 字节级复算只证明该脚本 deterministic；不能证明抽样输入或内容判定正确。报告脚本的 315 项检查是运行时写后读，不是磁盘篡改保护。磁盘对账见第 4 项。

## 2. 350 行机械校验 — PASS

故障注入只改 `docs/qa/content-audit/_reviews-a1/truth.jsonl` 第 1 题 PN-TRUTH-001 的 `text`，在末尾加 `X`：

```text
$ npx tsx scripts/audit-a1-verify.ts
A1 校验 350 行，去重后 350 张
不合规 1 条：
  - truth#1 PN-TRUTH-001: text 与真源不一致
退出码：1
```

随后按 cardId 将这个 `X` 去掉并复跑：

```text
RESTORED PN-TRUTH-001
$ npx tsx scripts/audit-a1-verify.ts
A1 校验 350 行，去重后 350 张
A1 全部合规：cardId/顺序/text/12字段/枚举/唯一性 均通过
```

临时内容修改已还原，恢复校验 PASS。该实验验证了确实比较审查行 `text` 与 SSOT，而非只检查行数/格式。

## 3. TOP20 LOW 排序与报告 — PASS

独立检查 `_ranks.json` 的 low 榜前 20：

```text
python3 独立计数：Counter({'0': 13, '低': 7})
```

没有 `infoGain=高`；榜单从 0 档开始，符合 0→低→中→高的最差优先排序。对照 `TOP20-LOW-INFO.md` 表内 cardId、增量字段，抽查前 20 均与 JSON 同序同值；报告注明直接读取 low 数组且不二次排序。此处排序整改成立。

## 4. 报告数字与磁盘 JSON 对账 — PASS（抽样）

未调用 report 脚本自检作为证据。独立 Python 直接读 `CONTENT-AUDIT-350.jsonl`、SSOT、`AUDIT-STATS-A1.json`、`GAP-LITERAL.json` 与 Monte Carlo JSON，重算并对照 Markdown：

```text
infoGain: {'低': 215, '中': 82, '高': 40, '0': 13}
semanticType: {'相互了解': 44, '暧昧推进': 86, '自我披露': 74, '行动互动': 12, '现场评价/猜测': 132, '纯看戏/低信息': 2}
topic: {'现场化学反应': 182, '生活方式': 19, '性格/习惯/小癖好': 40, '兴趣爱好': 2, '择偶偏好/吸引力': 52, '恋爱观': 27, '无明确人物信息增量': 12, '亲密/性观念': 16}
socialEnergy: {'中': 185, '低': 12, '高': 153}
relationshipProgression: {'中': 139, '高': 197, '低': 14}
玩法×增量：chemistry 低12/中19/高19；dare 低21/0档13/中15/高1；either_or 中27/高14/低9；most_likely 低50；never_have_i 低37/中12/高1；pointing 低50；truth 低36/中9/高5
重复簇：tagged 323；actualDuplicate（簇计数≥2）323；重复簇数 78
Heat 区间逐卡重算：[58,128,160,222]；跨档 218；单档 132
literalHits：前任0、吃醋0、异性朋友0、底线0、人生目标0、具体兴趣2、亲密/性观念6
Monte Carlo JSON overall：completed 16.03；high 1.46；mid+ 6.68；deadEnd 1660/4000=41.5%；exposure 75,483；distinct 278
```

以上数字与对应报告表一致。`literalHits=0` 仅是显式词面未命中；报告已避免推导成语义上不存在，语义侧结论标注需独立复核。重复簇两口径都是 323，本样本无法靠总量区分口径实现是否正确，但独立按 cluster 计数后确实每条被标注的卡都落在 78 个至少两题的簇里。

## 5. 交叉校准与仲裁 — 部分 PASS，强结论 FAIL

### 样本和独立性 — PASS

直接比对 `_calib/r1.jsonl` 和 `r2.jsonl`：同序整行判定对象 0/70 完全相同；两者都按 7 个玩法各 10 题，合计 70。抽查字段可见两份内容判定差异，并非复制整段结果。

```text
r1/r2 exact assessment rows identical at same positions=0/70
r1: truth/dare/most_likely/never_have_i/either_or/pointing/chemistry 各 10
r2: truth/dare/most_likely/never_have_i/either_or/pointing/chemistry 各 10
```

限制：文件差异只能排除字面复制，不能证明审查者在盲态、时间上独立或没有共享提示词。应将“互相独立”表述为产物不同且未见整段雷同，不能称为经审计证明的盲法独立实验。

### adjudication 口径 — PASS（差异已显式披露）

```text
adjudication.jsonl rows=23
finalInfoGain={'0':7,'中':7,'高':7,'低':2}
CALIBRATION-STATS.highDisagreementCount=5
```

5 是按程序判据筛出的严重分歧（信息增量极差≥2，或语义/社交分布条件）；23 是人工仲裁文件总样本，包含另外挑选样本。二者不应当互相校验。报告已指出差异。仲裁样本与 A1 infoGain 仅 6/23 一致（26.1%），表明全量原审的可移植性很有限。

### 一致率解释 — FAIL（不支持六轴口径稳定）

20.0%–31.4% 的六轴全一致率可由原始逐题数据重算，数字本身可信；但不能解读为“总体判定可靠”。r1↔r2 各轴一致率明显不齐：semanticType 97.1%、topic 87.1%、infoGain 80.0%、relationshipProgression 84.3%，而 promotesUnderstanding 68.6%、socialEnergy 72.9%；原审与复审相比又存在方向性差异：原审推进判高偏离多数 17 次、r1/r2 各 2/0 次；r2 相对多数的社交/推进更偏低（11/8 次）。玩法偏差集中在 dare：原审偏离 7/10；其仲裁解释系统性把纯动作定为 0，而原审常定为暧昧推进并评中档增量。

所以低“六轴全一致”既混合了轴定义可操作性，也有审查方式系统差异，不能简单归咎某个审查者；更不能拿 20–31% 当内容本身真实标签的误差率。建议分别使用单轴一致率/仲裁条款与玩法分层证据，并对 dare、promotesUnderstanding、socialEnergy、relationshipProgression 的结论加“口径敏感”标记。70 题每玩法 10 题，仅是小样本校准，不是全库标签准确率估计。

## 6. 真实 Router Monte Carlo — 部分 PASS，观测归因有限

源码静态审阅确认脚本引用生产 `createV2MainlineRouter`、`drawV2SessionCard`、`reduceV2SessionEvents`、`applyV2HostDecision` 和 `eventForRoundTerminal`；耗尽时走 `applyV2HostDecision(...reshuffle)`。未发现对 `state.orchestration` 字段的赋值。局外输入包括桌型、随机选择玩法和完成/跳过；种子由 `20260927 + i*7919 + (tableIndex+1)*104729` 导出，且每桌 salt 不同。两次正式运行后的 JSON SHA-256 一致，输出摘要一致，确定性成立。

### 41.5% dead-end — 归因基本成立，但需限定为模拟配置

4000 局中开放度上限 1 有 850/850 dead-end、上限 2 有 810/810，上限 3–5 为 0；合计 1660/4000=41.5%。模拟设定中强度上限被随机赋 1–5，并在抽卡时固定；卡片 `heatMax` 又与强度范围关联，Heat 随有效终态逐步推进。这个 cohort 分布强烈支持“低开放度上限导致本模拟 dead-end”。它不是现实用户发生率：桌型组合、强度抽样均匀、完成概率 0.85、玩法选择权重是模拟假设。报告应将 41.5% 表述为此 harness 配置结果，不能外推线上。

口径校准（A.2 收口）：这 41.5% 证明的是**低开放度（intensityLimit=1/2）时 relationship-aware 主线到 H3/H4 会没有合法关系卡，即关系主线发生结构性断粮**，而不是「App 无法继续游戏」——App 已有「切换玩法」「结束本局」安全出口，neutral/expansion 玩法的完成轮同样计入 `sessionCompletedRounds`，mixed 局的真实中断面小于该数。Phase B 首选修法是重做内容覆盖矩阵（方案 E，见 DEADEND-CHANGE-C-IMPACT.md），不是提高开放度或放宽 Heat 硬过滤。

正式 Monte Carlo JSON 不保存逐局 trace。为完成抽查，我创建了临时脚本副本，在相同生产逻辑与相同 seed 下仅收集前 3 个桌型的 trace，输出写到 `/tmp`；副本已删除，正式脚本与产物未改。每行如下（`truth-dare` 包内 gameType 按卡号前缀核对）：

```text
2m2f seed 20365656
PN-NHIE-001 (never_have_i, H1, completed) | PN-NHIE-002 (never_have_i, H1, completed) | PN-NHIE-003 (never_have_i, H1, completed) | PN-NHIE-004 (never_have_i, H2, completed) | PN-NHIE-005 (never_have_i, H2, completed) | PN-NHIE-006 (never_have_i, H2, completed) | PN-NHIE-007 (never_have_i, H2, completed) | PN-NHIE-008 (never_have_i, H3, completed)
1m3f seed 20470385
PN-NHIE-001 (never_have_i, H1, completed) | PN-NHIE-002 (never_have_i, H1, completed) | PN-NHIE-003 (never_have_i, H1, completed) | PN-NHIE-004 (never_have_i, H2, completed) | PN-NHIE-009 (never_have_i, H2, completed) | PN-NHIE-010 (never_have_i, H2, completed) | PN-NHIE-011 (never_have_i, H2, completed) | PN-NHIE-012 (never_have_i, H3, completed) | PN-NHIE-013 (never_have_i, H3, skipped) | PN-NHIE-014 (never_have_i, H3, completed)
2m3f seed 20575114
PN-DARE-001 (dare, H1, completed) | PN-DARE-002 (dare, H1, completed) | PN-DARE-003 (dare, H1, completed) | PN-DARE-004 (dare, H2, completed) | PN-DARE-009 (dare, H2, completed) | PN-DARE-010 (dare, H2, completed) | PN-DARE-011 (dare, H2, skipped) | PN-DARE-012 (dare, H2, completed) | PN-DARE-013 (dare, H3, completed) | PN-DARE-014 (dare, H3, completed)
```

 Heat 按有效事件逐步上升，且 `skipped` 也由脚本映射为有效回合终态并归约 Heat；轨迹符合当前实现。此临时 trace 证明性限于所抽三局，不等价于逐局 trace 已纳入正式交付物。

### “72 张未曝光中 38 张 matchRequired” — 数量 PASS，因果表述部分 FAIL

由 SSOT 与完整 exposure CSV 独立做集合差：总未曝光 350−278=72，其中 `matchRequired` 为真 38。数量成立。但这只能说明这些卡符合该标记，不能单凭集合关系证明它们全是“被覆盖上限挡住”；其余 34 张也未曝光，路由、玩家数、Heat、随机路径和本次有限样本都可能影响曝光。应改为“38/72 张未曝光卡带 matchRequired 标记”，不要写成确定因果归因。

## 7. 红线与工作树 — PASS（指定核对项）

```text
$ git diff --stat -- lib/v2-content/generated/v2-ssot.generated.json
（空；SSOT 无 diff）

$ git status --short
 M components/game/MutualCheckSheet.tsx
 M lib/v2-relationship/v2-mutual-check.ts
 M tests/e2e/v2-mutual-flow.spec.ts
 M tests/unit/mutual-check-sheet.test.tsx
?? docs/qa/content-audit/
?? docs/review/CODE_REVIEW-CONTENT-A1.md
?? scripts/audit-a1-aggregate.ts
?? scripts/audit-a1-calibration.ts
?? scripts/audit-a1-router-montecarlo.ts
?? scripts/audit-a1-report.ts
?? scripts/audit-a1-verify.ts
...（另有本轮配套审查脚本）

$ git log -1 --oneline
2527e9f docs: RG-02 桌型不锁性别比例 + 启动图标保持现状（用户 2026-09-27 决定）

package.json version = 1.5.0
public/version.json version = 1.5.0
public/sw.js CACHE_VERSION = 1.5.0
```

逐条 SSOT text 比较：`350 cards; mismatches=0`。未发现题面更改。最新提交仍是 `2527e9f`，无本轮 commit/push。

四个 Mutual 文件确有未提交 diff，内容涉及 RG-01 手机传阅互选状态机和对应测试；与本轮内容审查无关，且状态中没有这四个文件的新增变更。仅凭当前 git 状态不能证明这些改动最初产生的时间，故“本轮之前已有”按任务给定背景接受为基线假设；本 QA 未修改它们。

## 8. 总结与遗留

### 能否作为 Phase B 题库改写输入？有条件可以

可以作为**候选定位和排序输入**：全量 350 题有 SSOT 逐字校验；脚本复跑确定；0→低→中→高排序正确；aggregate 数字与磁盘 JSON 的抽样对账通过；重复簇、Heat 双口径和 literalHits 没有发现原 Phase A 已知类型的硬编码/口径错误。题库改写应先参考明确的题面事实、低信息/重复候选以及玩法体验，再结合人工产品判断。

不能将 A1 单人审查标签当成已经校准的事实标签直接自动改写或删题。六轴全一致仅 20–31%、仲裁仅 6/23 与 A1 infoGain 一致，尤其大冒险、社交能量/关系推进与“是否促进了解”表现出判定口径不稳。结论的可用边界：

- **可用但注明判定口径**：题面原文、literalHits、实际结构字段、候选排序、生产 Router 下的模拟行为。
- **作为假设/优先级信号**：低信息比例、各玩法信息分布、重复簇语义、人物主题覆盖。用于挑出复核对象，不宜当精确测量值。
- **不可直接作确定结论**：语义主题“缺失”、某题真实信息增量、社交/关系推进价值、Monte Carlo 的现实 dead-end 发生率或 matchRequired 的确定因果解释。

遗留清单：

1. 为 Monte Carlo 增加可复核的逐局 trace 产物（至少能重放并打印 3 局 cardId、gameType、有效终态、归约后 heat），完成该要求后再将第 6 项整体转 PASS。
2. 将 38/72 改成标记数量描述；如要归因为覆盖上限，逐卡验证未曝光原因。
3. 对 Phase B 将采用的 rubric 先做定义澄清与针对性复审，优先处理 dare、promotesUnderstanding、socialEnergy、relationshipProgression；不能用全六轴一致率替代逐轴决策。
4. 70 题交叉样本按玩法等额抽取，可比较玩法但不能推估全库标签准确率；如需要总体可靠性，需另做按总体结构抽样且有预先定义仲裁规则的样本。
5. “Mutual 四文件修改在本轮之前已存在”目前只有工作树范围判断，无提交时间证据。
