# 第一包「Formal Fixed 真心话」单包 Router Monte Carlo + 最差 trace + 生产链验证（C1-8 / A5 双口径）

- 生成：`scripts/audit-formal-truth-report.ts`（统计值全部读自 JSON 产物，阈值读自 `v2-state`，报告侧不手写）
- 卡源：`mainlineSsotCardsByPack('truth-dare')（SSOT 主线 + 第一包正式内容）` —— pack 153 张（Formal 53 / legacy 100）
- Router：createV2MainlineRouter（审计 / MC 侧）— C1-8 起与生产 createDeckRouter 共享桥接卡源 mainlineRuntimeCards()
- 参数：4 桌型 × 1000 局/桌型 × 20 轮；guard 上限 1000；completed 概率 0.85；软去重窗口 5
- 单包 = 真心话（truth-dare）；不切包（任何耗尽判本局 dead-end，生产单玩局同口径）。

## 0｜口径声明（先读这一段，禁止混写）

- **口径 A｜Engine / explicit disclosure**：**假设本轮真的收到合法 `roundDisclosureSignal`**（`selfDisclosed + disclosedPlayerIds`，走同一条 `reduceV2SessionEvents` 归约）。数据源 = MC `modeB` ＋ 生产链「仅 Formal 53 张」情形。
- **口径 B｜Current real UI**：`app/game/page.tsx#roundDisclosureForCurrentRound()` **恒返回 `undefined`** ⇒ 无 effective information round ⇒ **Heat 恒 H1、中途 Mutual（`count≥12` 且 `Heat≥H3`）不可达**。数据源 = MC `modeA`（生产实况：不给任何披露信号）。
- ⛔ **禁止把 A 当 B**：本报告任何「Heat 可达 H2/H3/H4」都**只在口径 A 的静态桶/或 Heat 已在该档时成立**；**当前 UI（口径 B）Heat 恒 H1**，不存在「生产 Heat 已正常推进」这回事。
- 门槛真源：H2=4 / H3=8 / H4=13（有效信息轮数）；中途互选窗口 [12, 14]，最低 `MUTUAL_MIN_HEAT=H3`。
- 门槛推不动的三个档名、缺口数、可抽集合、最差 trace 全部由本脚本按产物现算；报告中出现的任何结论（含「缺 / 不缺」「能 / 不能离开某档」）都可由同份 JSON 复算，**不接受手写**。

## 1｜口径 A｜Engine / explicit disclosure（假设真的收到合法 roundDisclosureSignal）

### 1.1 静态每 Heat 桶 Formal 库存（**若 Heat 已在该档**；legacy 卡不受 Heat 硬过滤）

| Heat | 包内合法 | 其中 Formal | 其中 legacy |
|---|---|---|---|
| H1 | 114 | 14 | 100 |
| H2 | 131 | 31 | 100 |
| H3 | 147 | 47 | 100 |
| H4 | 133 | 33 | 100 |

> 四档 Formal 桶均**非空**：H1=14 / H2=31 / H3=47 / H4=33。这是「若 Heat 已在该档」的库存能力，**不等于从 H1 冷启能走到该档**（见 1.2）。

### 1.2 全包真链冷启可达性（全包真实牌堆，两 mode 各 4000 局，每 completed 轮给合法披露）

| 指标 | 口径 A（Engine / 显式 disclosure） |
|---|---|
| 局数 | 4000 |
| 跑满 20 轮 | 4000（100.0%） |
| dead-end | 0（0.0%），终止原因 {"round_limit":4000,"pack_exhausted":0,"global_exhausted":0,"awaiting_host":0,"guard_limit":0} |
| Formal 曝光占比 | 11.3%（10695/94253） |
| Formal 曝光卡数 | 31/53 —— `PN-TRUTH-203`、`PN-TRUTH-205`、`PN-TRUTH-209`、`PN-TRUTH-227`、`PN-TRUTH-229`、`PN-TRUTH-232`、`PN-TRUTH-233`、`PN-TRUTH-234`、`PN-TRUTH-235`、`PN-TRUTH-237`、`PN-TRUTH-244`、`PN-TRUTH-245`、`PN-TRUTH-246`、`PN-TRUTH-247`、`PN-TRUTH-248`、`PN-TRUTH-250`、`PN-TRUTH-252`、`PN-TRUTH-254`、`PN-TRUTH-255`、`PN-TRUTH-256`、`PN-TRUTH-259`、`PN-TRUTH-261`、`PN-TRUTH-262`、`PN-TRUTH-264`、`PN-TRUTH-265`、`PN-TRUTH-266`、`PN-TRUTH-270`、`PN-TRUTH-271`、`PN-TRUTH-272`、`PN-TRUTH-282`、`PN-TRUTH-283` |
| heatAtDraw | H1 85214 / H2 6769 / H3 2270 / H4 0 |
| 到达 H2 / H3 / H4 局数 | 883 / 604 / 3 |
| H2 到达率（到达 H2 的 seed 局比例） | 883/4000（22.1%） ⇒ **H2 reach > 0** |
| 有效信息轮/局 | 2.26 |
| 有效轮 gain 分布 | medium 9053 |
| 人物维度覆盖（全样本）/ 每局 | 7 / 1.04 |
| 最长低/0 信息连击（跑满局均值） | 15.02 |
| 到中途互选窗口（count≥12） | 14 |
| 局内重复抽卡次数 | 0 |
| 全程零有效轮局 | 2329 |

### 1.3 仅 Formal 53 张真实生产卡（口径 A 下的「牌堆只有可计数卡」上界情形）

- 牌堆：仅 Formal（manifest 轨）53 张（PN-TRUTH-203~283，真实生产卡）
- 结果：未触发耗尽，共 20 轮；最终 Heat **H4**、effective count **20**。
- 逐档首达轮次：{"H1":1,"H2":4,"H3":8,"H4":13}；已到达 H1/H2/H3/H4，未到达 无。
- 派生说明（由本轮运行结果现算，非手写）：仅 Formal（manifest 轨）53 张（PN-TRUTH-203~283，真实生产卡）：实际到达的档：H1（首达第 1 轮）、H2（首达第 4 轮）、H3（首达第 8 轮）、H4（首达第 13 轮）；未到达的档：无。最终 Heat=H4、有效信息轮=20。

### 1.4 ceiling 1~5（按 intensityLimit 分档，各档约 1/5 样本）

| 口径 | intensityLimit | 局数 | dead-end | dead-end 率 | Formal 曝光占比 | 有效轮/局 |
|---|---|---|---|---|---|---|
| B（当前 UI） | 1 | 771 | 6 | 0.8% | 38.2% | 0 |
| B（当前 UI） | 2 | 760 | 0 | 0.0% | 14.1% | 0 |
| B（当前 UI） | 3 | 780 | 0 | 0.0% | 1.0% | 0 |
| B（当前 UI） | 4 | 856 | 0 | 0.0% | 0.0% | 0 |
| B（当前 UI） | 5 | 833 | 0 | 0.0% | 0.0% | 0 |
| A（engine） | 1 | 771 | 0 | 0.0% | 43.5% | 8.69 |
| A（engine） | 2 | 760 | 0 | 0.0% | 14.6% | 2.89 |
| A（engine） | 3 | 780 | 0 | 0.0% | 1.0% | 0.2 |
| A（engine） | 4 | 856 | 0 | 0.0% | 0.0% | 0 |
| A（engine） | 5 | 833 | 0 | 0.0% | 0.0% | 0 |

### 1.5 最差 trace（口径 A：mode B，选 dead-end 优先）

- 挑选规则：dead-end 优先 → 有效信息轮最少 → 完成轮最少 → Formal 曝光最少 → 最长低/0 信息连击最大
- 命中：桌型 **2m2f**，seed **20373576**，intensityLimit **5**，mode B
- 结果：完成 20 轮后 `round_limit`（dead-end=false）；共抽 25 次；Formal 曝光 0；有效信息轮 0；最长低/0 信息连击 20；heatAtDraw H1 25 / H2 0 / H3 0 / H4 0

| 轮 | 卡 | 轨 | Heat@抽卡 | 终态 | informationGain | topic | 记有效轮 |
|---|---|---|---|---|---|---|---|
| 1 | PN-DARE-033 | legacy | H1 | completed | null | null | — |
| 2 | PN-DARE-037 | legacy | H1 | completed | null | null | — |
| 4 | PN-TRUTH-035 | legacy | H1 | completed | null | null | — |
| 5 | PN-TRUTH-037 | legacy | H1 | completed | null | null | — |
| 6 | PN-DARE-040 | legacy | H1 | completed | null | null | — |
| 8 | PN-TRUTH-033 | legacy | H1 | completed | null | null | — |
| 9 | PN-TRUTH-036 | legacy | H1 | completed | null | null | — |
| 10 | PN-TRUTH-032 | legacy | H1 | completed | null | null | — |
| 11 | PN-DARE-035 | legacy | H1 | completed | null | null | — |
| 12 | PN-DARE-032 | legacy | H1 | completed | null | null | — |
| 13 | PN-DARE-036 | legacy | H1 | completed | null | null | — |
| 14 | PN-TRUTH-040 | legacy | H1 | completed | null | null | — |
| 15 | PN-DARE-038 | legacy | H1 | completed | null | null | — |
| 17 | PN-TRUTH-034 | legacy | H1 | completed | null | null | — |
| 18 | PN-DARE-034 | legacy | H1 | completed | null | null | — |
| 19 | PN-TRUTH-039 | legacy | H1 | completed | null | null | — |
| 20 | PN-TRUTH-031 | legacy | H1 | completed | null | null | — |
| 22 | PN-DARE-020 | legacy | H1 | completed | null | null | — |
| 24 | PN-TRUTH-029 | legacy | H1 | completed | null | null | — |
| 25 | PN-DARE-019 | legacy | H1 | completed | null | null | — |

**文字归因**（逐条由数据派生）：
1. 它是 **dead-end**（round_limit，只完成 20/20 轮）：按 `round_limit` 终止。
2. 共抽 25 次里 Formal **0 张**，其中 completed 轮 **0 张**、skipped 轮 **0 张**（skipped 无 completed ⇒ 无披露）；completed 轮里 legacy 20 张 ⇒ sidecar 恒 null ⇒ 有效轮 **0**。
3. 有效轮 0 < 4（H2 门槛）⇒ **Heat 始终停在 H1**，认识证据与互选窗口都无从谈起。

## 2｜口径 B｜Current real UI（disclosure producer 未接入）

- **事实**：`app/game/page.tsx#roundDisclosureForCurrentRound()` 恒返回 `undefined`（Human 本批冻结：不新增披露 UI）⇒ `isEffectiveInformationRound` fail-closed 恒 false ⇒ `relationshipEffectiveCardCount` 恒 0 ⇒ **Heat 恒 H1**。
- **当前 UI 实际可抽到的 Formal 张数**：**14 张**（= 卡面 `heatMin=1` 且 H1 桶合法者）—— **`PN-TRUTH-203`、`PN-TRUTH-205`、`PN-TRUTH-227`、`PN-TRUTH-229`、`PN-TRUTH-232`、`PN-TRUTH-233`、`PN-TRUTH-234`、`PN-TRUTH-244`、`PN-TRUTH-245`、`PN-TRUTH-248`、`PN-TRUTH-250`、`PN-TRUTH-261`、`PN-TRUTH-262`、`PN-TRUTH-266`**。
- **当前 UI 实际抽到的 Formal**（4000 局实测）：distinct **14/53** —— `PN-TRUTH-203`、`PN-TRUTH-205`、`PN-TRUTH-227`、`PN-TRUTH-229`、`PN-TRUTH-232`、`PN-TRUTH-233`、`PN-TRUTH-234`、`PN-TRUTH-244`、`PN-TRUTH-245`、`PN-TRUTH-248`、`PN-TRUTH-250`、`PN-TRUTH-261`、`PN-TRUTH-262`、`PN-TRUTH-266`；曝光 10.2%（9649/94242）。
- effective count **恒 0**；跑满 20 轮 3994（99.9%）、dead-end 6（0.1%）；heatAtDraw H1 94242 / H2 0 / H3 0 / H4 0；到达 H2/H3/H4 = 0/0/0；中途互选窗口 **0 局**。
- 对照口径 A（同样 4000 局、仅多一个合法披露信号）：effective **2.26**/局、Formal distinct **31/53**、到达 H2/H3/H4 = 883/604/3。
> ⛔ **当前 UI 不能产生 effective information round ⇒ Heat 恒 H1 ⇒ mid Mutual 不可达**。这不是「生产 Heat 已正常推进」。

## 3｜结构性缺口与代价（**逐条由产物现算**；缺就如实写缺口，不缺就如实写已解除，禁止反向压 Heat 来消除）

- **当前 UI（口径 B）下「更深档 Formal 不可抽」**：H1 桶只收 14 张 `heatMin=1` 的 Formal；其余 39 张 `heatMin≥2` 在 Heat 恒 H1 时被硬过滤（静态桶 H2=31 / H3=47 / H4=33 张，实践抽不到）。
- **H1→H2 冷启门：库存侧已解除**：H1 桶内可计数 Formal **14 张 ≥ H2 门槛 4（余量 10 张）⇒ 只要每轮给合法披露，Heat 可离开 H1**；4000 局口径 A 实测到达 H2 883 局（22.1%）。
- **H2→H3 冷启门（库存侧已够）**：`heatMin≤2` 的 Formal 累计 31 张 ≥ H3 门槛 8；实测口径 A 到达 H3 604 局（15.1%）。
- **H3→H4 可达**：`heatMin≤3` 累计 47 张 ≥ H4 门槛 13；实测口径 A 到达 H4 3 局。
- **ceiling=1 断粮**：intensityLimit=1 的局 dead-end 率 **0.0%**（口径 A），终止原因分布 {"round_limit":771,"pack_exhausted":0,"global_exhausted":0,"awaiting_host":0,"guard_limit":0}；单包 truth-dare 在 I1 上限下 20 轮**可持续**（由该率现判）。
- **中途互选窗口 [12, 14]**：口径 A 下 count≥12 的局 14/4000（已达窗口）。

## 4｜补卡建议（一律靠补内容，不靠放宽门槛；**建议随产物里的实际缺口现判**，不缺的档不再提）

1. **H1→H2 冷启门在库存侧已解除，不再提「补 H1」**：当前 truth-dare `heatMin=1` 的 Formal 已有 14 张 ≥ H2 门槛 4（口径 A 实测到达 H2 883 局）⇒ 库存侧已无下一道门（更深的门来自牌堆耗尽／intensity 过滤／曝光，非冷启库存）：`heatMin≤2` 累计 31（H3 门槛 8，已够）、`heatMin≤3` 累计 47（H4 门槛 13，已够）。
2. **H1 卡强度构成已非全 I1，不再提「全为 I1」**：当前 14 张 H1 Formal 的 intensity 分布 {"1":11,"2":3}（口径 A 曝光 11.3%）；如继续提曝光，可优先补 `heatMin=1` 的 I3~I5 浅关系卡（仍禁止为曝光做不自然高尺度）。
3. **heatMax 覆盖（H4 层）**：当前 heatMax 分布 {"3":20,"4":33}；建议每玩法 ≥8 张 `heatMax=4`，避免 Heat 升高后 Formal 库存反而变薄（H1→H4 Formal 合法数 H1 14 → H2 31 → H3 47 → H4 33）。
4. **topic 覆盖（摊平）**：当前覆盖 8 个人物维度，其中仅 1 张的维度 `恋爱观`；建议每玩法 Formal 覆盖 ≥5 个 topic，并补齐 A.1 零维度（`吃醋·占有`/`异性朋友边界`/`前任态度`/`底线·雷区`/`人生目标·理想生活`）。
5. **跨玩法分摊**：当前 53 张全在 truth-dare；把审计 metadata 补到全部其他玩法的固定卡上，而非只堆 truth-dare。
6. **不要动的旋钮**：认识阈值、窗口 [12, 14]、`MUTUAL_MIN_HEAT=H3`、Heat 硬过滤、`isEffectiveInformationRound` fail-closed、±18% 阈值、样本量一律不动。

## 5｜真实生产链验证（§十八 第一段）

- 链路：startRound（唯一出题入口 → drawDeckCard → createDeckRouter 生产 Router 三层计数） → resolveRoundAndReduce(session,'complete',roundDisclosureSignal({selfDisclosed, disclosedPlayerIds})) → eventForRoundTerminal（卡侧 metadata 由 metadataForCard 读生产 sidecar；轮侧披露由正式信号提供） → reduceV2SessionEvents → relationshipEffectiveCardCount / heatForEffectiveCount
- 纪律：本文件与 integration 测试均不注入 metadata override；Formal 53 张（其中含 A3 KEEP 保留的 5 张）与已退出 Formal 的 26 张旧卡的 informationGain/topic 都来自生产 sidecar 真实投影；无 §7.2 metadata 的 SSOT 旧卡 sidecar 恒 null（fail-closed 不计有效轮）。

| 情形 | 牌堆 | 轮数 | 终态 Heat | 最终 effective count | Heat 逐档首达（轮次） |
|---|---|---|---|---|---|
| 全包（真实生产牌堆） | mainlineSsotCardsByPack('truth-dare')（153 张，含 Formal 53 + legacy 100） | 20 | H1 | 0 | {"H1":1,"H2":null,"H3":null,"H4":null} |
| 仅 Formal 53 张 | 仅 Formal（manifest 轨）53 张（PN-TRUTH-203~283，真实生产卡） | 20 | H4 | 20 | {"H1":1,"H2":4,"H3":8,"H4":13} |
| 仅 Bootstrap 7 张（其中仅 227/229 属 Formal） | 仅 Bootstrap 2 张（PN-TRUTH-227~229；其中仅 227/229 属 Formal，其余 5 张已退出 Formal） | 2 | H1 | 2 | {"H1":1,"H2":null,"H3":null,"H4":null} |
| 仅 legacy（负向对照） | 仅 legacy 卡（100 张，无 Formal） | 20 | H1 | 0 | {"H1":1,"H2":null,"H3":null,"H4":null} |

- 全包（seed=1，**给了合法披露信号**）：Formal 卡被抽到 **0 张**；有效计数 0、Heat H1；未触发耗尽，共 20 轮。
- 仅 Formal 53 张（seed=1，**给了合法披露信号**）：共 20 轮，抽到 `PN-TRUTH-227`、`PN-TRUTH-229`、`PN-TRUTH-235`、`PN-TRUTH-237`、`PN-TRUTH-239`、`PN-TRUTH-241`、`PN-TRUTH-242`、`PN-TRUTH-243`、`PN-TRUTH-246`、`PN-TRUTH-247`、`PN-TRUTH-248`、`PN-TRUTH-253`、`PN-TRUTH-259`、`PN-TRUTH-260`、`PN-TRUTH-262`、`PN-TRUTH-264`、`PN-TRUTH-267`、`PN-TRUTH-268`、`PN-TRUTH-269`、`PN-TRUTH-278`（含 H1 桶合法集合以外的卡），effective 20 / H2 门槛 4（已跨过 H2 门槛）⇒ 实测终态 Heat **H4**（逐档首达见上表）；未触发耗尽，共 20 轮。
- 仅 Bootstrap 7 张（seed=1，**给了合法披露信号**；其中仅 227/229 属 Formal）：共 2 轮，该子集 2 张都带 §7.2 metadata ⇒ 每轮计有效轮（Formal 归属只影响曝光统计、不影响计数口径），effective 2 ⇒ 首达 {"H1":1,"H2":null,"H3":null,"H4":null}；完成 2 轮后，第 3 轮不再给出题卡（`AWAITING_HOST_EXHAUSTION_DECISION`）（该子集 < 下一档门槛，属真实缺口）。
- 全包 200 seed 扫描（不挑 seed，**同一固定桌型/固定配置的窄口径**，与 §1.2 的 4000 局多桌型聚合口径并列阅读、不互相替代）：到达 H2 0 局、H3 0 局、H4 0 局；终态 Heat 分布 {"H1":200}；有效轮/局 0。
- legacy 负向对照：sidecar 恒 null ⇒ effective 恒 0、Heat 恒 H1（fail-closed 成立）。

- 四情形 **派生 note**（由各自运行结果现算，不允许手写结论）：
  - 全包：mainlineSsotCardsByPack('truth-dare')（153 张，含 Formal 53 + legacy 100）：实际到达的档：H1（首达第 1 轮）；未到达的档：H2、H3、H4。最终 Heat=H1、有效信息轮=0。未到达原因：H2 —— 非「库存不足」：H1 及以下档可计数卡 14 张 ≥ H2 门槛 4，但本次仅累计有效轮 0（共 20 轮）⇒ 未达门槛来自牌堆耗尽／intensity 过滤／软去重／抽卡排序，而非冷启库存；H3 —— 受上游 H2 门所限（H2 未解锁 ⇒ 恒不可达）；H4 —— 受上游 H2 门所限（H2 未解锁 ⇒ 恒不可达）。
  - 仅 Formal：仅 Formal（manifest 轨）53 张（PN-TRUTH-203~283，真实生产卡）：实际到达的档：H1（首达第 1 轮）、H2（首达第 4 轮）、H3（首达第 8 轮）、H4（首达第 13 轮）；未到达的档：无。最终 Heat=H4、有效信息轮=20。
  - 仅 Formal 子集 Bootstrap：仅 Bootstrap 2 张（PN-TRUTH-227~229；其中仅 227/229 属 Formal，其余 5 张已退出 Formal）：实际到达的档：H1（首达第 1 轮）；未到达的档：H2、H3、H4。最终 Heat=H1、有效信息轮=2。未到达原因：H2 —— 冷启门库存不足：H1 及以下档可计数卡 2 张 < H2 门槛 4（缺口 2 张）⇒ 即便把这些卡全部抽满，最多也只累积有效轮 2，结构上到不了 H2（更高档的卡因 Heat 未升档被硬过滤，牌堆因此提前耗尽）；本次实测累计有效轮 2／共 2 轮；H3 —— 受上游 H2 门所限（H2 未解锁 ⇒ 恒不可达）；H4 —— 受上游 H2 门所限（H2 未解锁 ⇒ 恒不可达）。
  - 仅 legacy：仅 legacy 卡（100 张，无 Formal）：实际到达的档：H1（首达第 1 轮）；未到达的档：H2、H3、H4。最终 Heat=H1、有效信息轮=0。未到达原因：H2 —— 牌堆内可计数卡 0 张（无 §7.2 metadata ⇒ isEffectiveInformationRound fail-closed 恒不计有效轮）；H3 —— 受上游 H2 门所限（H2 未解锁 ⇒ 恒不可达）；H4 —— 受上游 H2 门所限（H2 未解锁 ⇒ 恒不可达）。

## 6｜复跑命令

```bash
npx vite-node -c vitest.config.ts scripts/audit-formal-truth-montecarlo.ts
npx vite-node -c vitest.config.ts scripts/audit-formal-truth-production-chain.ts
npx vite-node -c vitest.config.ts scripts/audit-formal-truth-report.ts
```

