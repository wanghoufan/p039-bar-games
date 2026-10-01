# 跨 Reviewer 交叉校准报告（Phase A.2：逐轴 κ 为主指标）

> 真源：CALIBRATION-STATS.json（audit-a1-calibration.ts 产出）+ _calib/adjudication.jsonl。校准样本 70 题。
> 参与方：原 reviewer（逐玩法审完 350 题）vs 盲审 r1 vs 盲审 r2，三方在同一批校准样本上独立判定。

## 0. 一致性指标口径声明（A.2 收口）

- **有序轴**（infoGain / promotesUnderstanding / socialEnergy / relationshipProgression）用 **linear weighted kappa**：κ_w = 1 − Σ_ij w_ij·O_ij / Σ_ij w_ij·E_ij，w_ij = |i−j|/(K−1)（K=该轴类别数）
  - 排列（rank）真源：infoGain = 0(0) < 低(1) < 中(2) < 高(3)；promotesUnderstanding = 否(0) < 弱(1) < 是(2)；socialEnergy = 低(0) < 中(1) < 高(2)；relationshipProgression = 低(0) < 中(1) < 高(2)
- **分类轴**（semanticType / topic）用 **Cohen's kappa**：κ = (Po − Pe)/(1 − Pe)
- **六轴全一致率降级为参考项**，不再是 Gate 主指标（原口径把「六轴同时命中」当稳定度，会与逐轴可操作性混淆）。

## 1. 每轴 raw agreement 与一致性系数 κ（主指标）

| 对比 | 轴 | 类型 | 系数口径 | raw agreement | κ |
|---|---|---|---|---:|---:|
| orig↔r1 | semanticType | categorical | cohen kappa | 77.1% | 0.6964 |
| orig↔r1 | topic | categorical | cohen kappa | 74.3% | 0.6161 |
| orig↔r1 | infoGain | ordered | linear weighted kappa | 72.9% | 0.6324 |
| orig↔r1 | promotesUnderstanding | ordered | linear weighted kappa | 60.0% | 0.3813 |
| orig↔r1 | socialEnergy | ordered | linear weighted kappa | 65.7% | 0.3243 |
| orig↔r1 | relationshipProgression | ordered | linear weighted kappa | 67.1% | 0.4048 |
| orig↔r2 | semanticType | categorical | cohen kappa | 74.3% | 0.6605 |
| orig↔r2 | topic | categorical | cohen kappa | 78.6% | 0.6863 |
| orig↔r2 | infoGain | ordered | linear weighted kappa | 80.0% | 0.6964 |
| orig↔r2 | promotesUnderstanding | ordered | linear weighted kappa | 85.7% | 0.6316 |
| orig↔r2 | socialEnergy | ordered | linear weighted kappa | 61.4% | 0.2432 |
| orig↔r2 | relationshipProgression | ordered | linear weighted kappa | 61.4% | 0.3675 |
| r1↔r2 | semanticType | categorical | cohen kappa | 97.1% | 0.9600 |
| r1↔r2 | topic | categorical | cohen kappa | 87.1% | 0.8127 |
| r1↔r2 | infoGain | ordered | linear weighted kappa | 80.0% | 0.7963 |
| r1↔r2 | promotesUnderstanding | ordered | linear weighted kappa | 68.6% | 0.5250 |
| r1↔r2 | socialEnergy | ordered | linear weighted kappa | 72.9% | 0.4509 |
| r1↔r2 | relationshipProgression | ordered | linear weighted kappa | 84.3% | 0.7600 |

读法：最难对齐的轴是 socialEnergy（orig↔r2 κ=0.2432）。三对 reviewers 逐轴 κ 均值：semanticType 0.7723、topic 0.7050、infoGain 0.7084、promotesUnderstanding 0.5126、socialEnergy 0.3395、relationshipProgression 0.5108。κ 越低说明该轴的可操作定义越不稳，不能被全六轴一致率掩盖。

## 2. 六轴全一致率（参考项，不再是 Gate 主指标）

| 对比 | 样本 | 六轴全一致 | 全一致率 | infoGain 极差≥2 档 | 极差率 |
|---|---:|---:|---:|---:|---:|
| orig↔r1 | 70 | 14 | 20.0% | 5 | 7.1% |
| orig↔r2 | 70 | 22 | 31.4% | 4 | 5.7% |
| r1↔r2 | 70 | 21 | 30.0% | 0 | 0.0% |

> 参考项（不再是 Gate 主指标）；口径敏感，不得当作标签准确率

## 3. 系统性偏松 / 偏紧（相对三方多数票）

| Reviewer | 增量判高 | 增量判低 | 增量一致 | 社交判高 | 社交判低 | 推进判高 | 推进判低 |
|---|---:|---:|---:|---:|---:|---:|---:|
| orig | 8 | 1 | 61 | 9 | 7 | 17 | 2 |
| r1 | 8 | 2 | 60 | 5 | 3 | 2 | 2 |
| r2 | 3 | 2 | 65 | 0 | 11 | 0 | 8 |

增量轴偏离最大的 reviewer 是 orig（判高 8 vs 判低 1），方向为偏松（更多判高）。关系推进轴整体判高多于判低（合计 19 vs 12），说明「推进」这一轴的定义还偏宽。

## 4. 玩法维度漂移（原 reviewer 相对多数票的偏离率，升序=最稳）

| 玩法 | 样本 | semanticType 三方共识率 | infoGain 三方共识率 | 原 reviewer 偏离样本数 | 原 reviewer 偏离率 | 增量判定分布（三方合计） |
|---|---:|---:|---:|---:|---:|---|
| 真心话 | 10 | 90.0% | 100.0% | 0 | 0.0% | 高 6 / 低 24 |
| 谁最可能 | 10 | 100.0% | 100.0% | 0 | 0.0% | 低 30 |
| 指人游戏 | 10 | 90.0% | 100.0% | 0 | 0.0% | 低 30 |
| 默契测试 | 10 | 90.0% | 50.0% | 0 | 0.0% | 高 14 / 中 9 / 低 7 |
| 我从来没有 | 10 | 60.0% | 70.0% | 1 | 10.0% | 中 11 / 低 19 |
| 二选一 | 10 | 60.0% | 20.0% | 1 | 10.0% | 高 14 / 中 13 / 低 3 |
| 大冒险 | 10 | 30.0% | 30.0% | 7 | 70.0% | 中 4 / 低 3 / 0 23 |

漂移最大的玩法是 大冒险（偏离率 70.0%），最稳的是 真心话（0.0%）。

## 5. 两个**不同定义**的分歧集合：autoHighDisagreement vs adjudicationSet

> Phase A.1 曾把这两个数量并列成「同一统计不一致」，这是错的。它们是**两个不同定义的集合**，必须分别定义、分别计数，禁止互相校验、禁止暗示二者矛盾。

| 集合 | 定义 | 数量 |
|---|---|---:|
| autoHighDisagreement | 自动判据筛出：infoGain 极差≥2 档，或 semanticType 三方全不同，或 socialEnergy 三方全不同 | 5 |
| adjudicationSet | 实际进入仲裁的题（_calib/adjudication.jsonl 行数；含人工在自动集之外另挑的样本） | 23 |

两集重叠 5 题；adjudicationSet 在 autoHighDisagreement 之外还含人工另挑的样本，因此两者数量不同是定义差异，不是统计矛盾。
> 两个集合定义不同（自动规则 vs 实际仲裁样本），不是同一统计的两个值，禁止互相校验或暗示二者矛盾。

autoHighDisagreement 的卡（自动判据）：PN-DARE-032、PN-DARE-038、PN-DARE-043、PN-DARE-024、PN-CHEM-037
adjudicationSet 共 23 题；其终判增量分布：高 7 题、中 7 题、低 2 题、0 7 题。

仲裁终判与 A1 全量审查在该批样本上的 infoGain 一致率 26.1%（一致 6 / 共 23，差 1 档 13 题、差 2 档 4 题）。

## 6. 校准结论与使用限制

1. 逐轴 κ 才是主指标：最低的是 socialEnergy（κ=0.2432），最高一轴 κ 也没有到「高度一致」区间，任何单轴结论都应注明「口径敏感」。
2. 六轴全一致率 20.0% / 31.4% / 30.0% 只作参考项；它混合了轴定义可操作性与审查方式差异，不能当标签准确率。
3. 增量轴是最脆弱的轴之一：三方全一致率最低的对是 orig↔r1（20.0%），且仍有 9 人次出现极差 ≥2 档。
4. 本报告只描述一致性，不覆盖全库 350 题——校准样本 70 题，覆盖全库 20.0%，所以结构性结论（主题空白、玩法级低信息）以全量审查为准，一致性以本报告为准。

## 7. 玩法漂移度量与复审标签（A.2 收口；真源 STABLE-LABELS.json）

> 参与方：原 reviewer（_reviews-a1，按玩法各 50）vs 盲审（_recheck/BLIND-*，未见任何已有标签，各 50）；校准样本内的 10 题/玩法另有 r1、r2 两个盲审来源。一致性系数与第 1 节**共用同一份实现**（scripts/audit-a1-kappa.ts），不另写第二套。
> 全部题 50 张为双源（orig + BLIND）；校准样本内的 10 张/玩法另有 r1、r2 两个盲审来源，共 4 源。复审标签按各卡**实际可用来源数**取严格多数票。

| 玩法 | 样本 | 轴 | 类型 | 系数口径 | raw agreement | κ | κ<0.4 |
|---|---:|---|---|---|---:|---:|---|
| 大冒险 | 50 | infoGain | ordered | linear weighted kappa | 48.0% | 0.3109 | ⚠ 是 |
| 大冒险 | 50 | semanticType | categorical | cohen kappa | 52.0% | 0.3737 | ⚠ 是 |
| 大冒险 | 50 | topic | categorical | cohen kappa | 44.0% | 0.2235 | ⚠ 是 |
| 大冒险 | 50 | socialEnergy | ordered | linear weighted kappa | 64.0% | 0.3525 | ⚠ 是 |
| 大冒险 | 50 | relationshipProgression | ordered | linear weighted kappa | 48.0% | 0.4103 | 否 |
| 二选一 | 50 | infoGain | ordered | linear weighted kappa | 32.0% | 0.0793 | ⚠ 是 |
| 二选一 | 50 | semanticType | categorical | cohen kappa | 66.0% | 0.32 | ⚠ 是 |
| 二选一 | 50 | topic | categorical | cohen kappa | 70.0% | 0.6175 | 否 |
| 二选一 | 50 | socialEnergy | ordered | linear weighted kappa | 70.0% | 0.2021 | ⚠ 是 |
| 二选一 | 50 | relationshipProgression | ordered | linear weighted kappa | 78.0% | 0.6191 | 否 |
| 默契测试 | 50 | infoGain | ordered | linear weighted kappa | 84.0% | 0.8138 | 否 |
| 默契测试 | 50 | semanticType | categorical | cohen kappa | 100.0% | 1 | 否 |
| 默契测试 | 50 | topic | categorical | cohen kappa | 92.0% | 0.8998 | 否 |
| 默契测试 | 50 | socialEnergy | ordered | linear weighted kappa | 70.0% | 0 | ⚠ 是 |
| 默契测试 | 50 | relationshipProgression | ordered | linear weighted kappa | 80.0% | 0.664 | 否 |

全轴一致率（5 轴同时命中）：大冒险 4.0%、二选一 12.0%、默契测试 38.0%；逐轴 κ 均值：大冒险 0.3342、二选一 0.3676、默契测试 0.6755。
> κ 门槛口径：Landis & Koch 区间：<0.40 为 fair/poor，0.41–0.60 为 moderate；本轮取 κ < 0.4 判「明显不足」。

### 7.1 复审标签怎么来的

- 复审标签 = 各**独立来源**按轴取**严格多数票**（票数 > 来源数/2）；无多数 → 交**第三方独立仲裁**（仲裁者只看题面，不携带任何既有标签）。
- 本轮共 111 张卡至少有一轴无多数票（占 150 张的 74.0%），全部送仲裁；已仲裁 111 张。
- 可复审的轴：infoGain、semanticType、topic、socialEnergy、relationshipProgression；**未**复审：promotesUnderstanding、verdict、duplicateCluster（原因：盲审 BLIND-*.jsonl 未判这些字段，无第二个独立来源可交叉，故不做稳定化；仍为 A.1 单源。）。

### 7.2 哪些玩法的标签已完成双源复审与分歧仲裁

| 玩法 | 卡数 | 标签状态 | 本批仲裁卡数 | κ<0.4 的轴 |
|---|---:|---|---:|---|
| 大冒险（dare） | 50 | **已完成双源复审与分歧仲裁**（多数票 + 仲裁；可用于主题/候选定位，低可靠轴不得作为单题自动保留/删除依据） | 44 | infoGain、semanticType、topic、socialEnergy |
| 二选一（either_or） | 50 | **已完成双源复审与分歧仲裁**（多数票 + 仲裁；可用于主题/候选定位，低可靠轴不得作为单题自动保留/删除依据） | 40 | infoGain、semanticType、socialEnergy |
| 默契测试（chemistry） | 50 | **已完成双源复审与分歧仲裁**（多数票 + 仲裁；可用于主题/候选定位，低可靠轴不得作为单题自动保留/删除依据） | 27 | socialEnergy |
| 真心话（truth） | — | A.1 单源、可靠性较低 | — | 未测 |
| 谁最可能（most_likely） | — | A.1 单源、可靠性较低 | — | 未测 |
| 我从来没有（never_have_i） | — | A.1 单源、可靠性较低 | — | 未测 |
| 指人游戏（pointing） | — | A.1 单源、可靠性较低 | — | 未测 |

> dare / either_or / chemistry 的标签——已完成双源复审与分歧仲裁，可用于主题/候选定位；低可靠轴不得作为单题自动保留/删除依据。truth / most_likely / never_have_i / pointing 仍为「A.1 单源、可靠性较低」。

### 7.3 never_have_i 是否需要全量复审（门槛先定后判）

门槛（显式声明，跑数前固定）：**原 reviewer 偏离多数票率 < 30%** 且 **infoGain 三方共识率 ≥ 70%**，两条都满足才算「未达升级门槛」。

| 玩法 | A.1 原 reviewer 偏离率 | A.1 infoGain 共识率 | A.1 semanticType 共识率 | 偏离门槛 | 共识门槛 | 结论 |
|---|---:|---:|---:|---|---|---|
| 真心话 | 0.0% | 100.0% | 90.0% | 过 | 过 | 未达升级门槛，不复审 |
| 谁最可能 | 0.0% | 100.0% | 100.0% | 过 | 过 | 未达升级门槛，不复审 |
| 指人游戏 | 0.0% | 100.0% | 90.0% | 过 | 过 | 未达升级门槛，不复审 |
| 默契测试 | 0.0% | 50.0% | 90.0% | 过 | 不过 | 达门槛，应复审 |
| 我从来没有 | 10.0% | 70.0% | 60.0% | 过 | 过 | 未达升级门槛，不复审 |
| 二选一 | 10.0% | 20.0% | 60.0% | 过 | 不过 | 达门槛，应复审 |
| 大冒险 | 70.0% | 30.0% | 30.0% | 不过 | 不过 | 达门槛，应复审 |

**never_have_i 终判**：未达升级门槛，不复审：A.1 实测值同时满足两条门槛（原 reviewer 偏离率 < 30% 且 infoGain 共识率 ≥ 70%）。依据：偏离率 10.0%（门槛 <30%）、共识率 70.0%（门槛 ≥70%）——两项均达标，故本轮**不派盲审做全量 50 题复审**。
> 门槛只用来判「要不要额外派盲审」。dare / either_or / chemistry 已经在 §7 完成了盲审 + 仲裁（表中显示「达门槛，应复审」＝该玩法确实需要盲审，且本轮已完成）；本节真正待决的只有 never_have_i。
> 说明：never_have_i 没有盲审样本，无法直接算 κ；上表用的是 A.1 实测漂移值做**前置筛查**。因此它的标签仍归入「A.1 单源、可靠性较低」，与已完成双源复审与分歧仲裁的 dare / either_or / chemistry 不同。

### 7.4 使用限制（硬约束）

若某轴 κ 仍明显不足（κ < 0.4），该轴**只能用于候选排序，不得自动决定保留/删除**。当前不达标的轴见 weakAxisSummary（usableForDecision=false 的行）。

> 标签状态统一口径：dare / either_or / chemistry：已完成双源复审与分歧仲裁，可用于主题/候选定位；低可靠轴不得作为单题自动保留/删除依据。

本轮 κ 仍低于 0.4 的轴（只可用于候选排序）：infoGain（最差 κ=0.0793）、semanticType（最差 κ=0.32）、topic（最差 κ=0.2235）、socialEnergy（最差 κ=0）。
