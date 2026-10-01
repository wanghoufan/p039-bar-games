# CODE REVIEW｜Phase A.2 全轮（审查可靠性收口 + 生产 P1#2 Router 曝光饥饿 + P1#1 dead-end 影响分析）

- Task：复审 Phase A.2 全轮。范围：生产代码 4 文件（v2-draw-order.ts 新增、v2-router.ts、v2-session.ts、v2-deal.ts）＋ fair-exposure 新增 12 条测试＋ audit 脚本 3 新 5 改＋ docs/qa/content-audit/ 全套产物＋ DEADEND-CHANGE-C-IMPACT.md。
- Commit：无（工作区未提交；HEAD `2527e9f`、技术 RC `eeaebf3` 未动）
- Reviewer：code-reviewer（codebuddy / glm-5.3-flash）
- Result：**PASS（P0=0，blocking P1=0，非 blocking P1=2，P2×4，P3×4）**

> 审查方式声明：本报告全部结论基于独立核验（自跑测试、自跑 verify-only 篡改实验、自抽样题面、自算 JSON 分布、mtime 分组、账本 diff），未采信 builder/HANDOFF 自述数字。临时验证均在 /tmp 或用后即删（`tests/unit/tmp-review-cross-session.test.ts` 已删除还原，报告篡改实验已逐字节还原并 diff 验证）。

## 一、独立核验记录（证据，非自述）

### A. 生产改动 P1#2（Router 曝光饥饿）

1. **优先级顺序逐层核对：语义等价成立。**
   - `v2-router.ts`：`isHardEligible`（强度上限→5 档强制→used→人数下限→target gating）与 `isTargetEligible`（all-players 直通→非定向轮硬过滤→无 pair 降级→match-pair 需 MATCH）逐行读，过滤谓词零改动（diff 仅排序与 seed 注入）；`bucket/pack/global` 三层的 pack 归属、Heat 档、软去重窗口过滤口径逐字不变。
   - `v2-deal.ts`：`hardEligible/heatEligible/targetEligible/deferred`（rejected 指纹回避）全部未动；三层调用只把 `sortCards(...)` 换成 `orderForDraw(sortCards(...), seed)`，deferred 仍在排序前、位置不变。
   - `orderByTieBreakRotation` 只在**连续同强度组内**做循环移位（非「按 seed 全局重排」），组间强度降序不动。测试④锁了非升序、首张=最高强度、集合/长度不变。
2. **可复现随机：三条性质均独立验证成立。**
   - 同 seed+同输入→同输出（测试②，两个 Router 实例×三层）；不同 seed→首张 >4 种且 truth/dare 都出现（测试③）；纯函数无 `Date`/`Math.random`/隐藏状态（逐行读 `v2-draw-order.ts`，FNV-1a+splitmix32 混合，同强度组用 `seed ^ imul(intensity+1, 0x9e3779b9)` 独立定起点——不同强度组之间不联动，好设计）。
3. **跨局规律性（独立实验发现，见 P2-4）**：`drawSeedFor` 的 key 含 `recentCardIds`，局内每轮状态必变、seed 必变——挑战点「同 used 集合必同 seed」的前提在局内不成立；但**跨局重置后两局序列逐字重复**：我在 /tmp 独立跑同配置 2 局×20 轮（全部 completed），首 5 张同为 `PN-DARE-007,PN-TRUTH-008,PN-TRUTH-010,PN-DARE-003,PN-TRUTH-013`，20 张逐字相同。修复前同样如此（全系统本就无随机源、可复现是冻结设计），非回归，但真人可感知。
4. **曝光公平性实测**：60 局×20 轮 ±18% 容差、单局 20 轮双类型可见，12 条新测试全过；阈值推导（sd≈0.0144、12σ）合理不拍脑袋。
5. **全量回归**：`pnpm vitest run` = **103 文件 / 937 全绿**（含新增 12 条）；`tsc --noEmit` 0 error；`eslint` 0 error（11 warnings，既有）。Coverage / Single-Anchor Guard / D7 五档 / D8 耗尽语义相关用例全部在跑、全绿；`v2-exhaustion.ts`、reducer、Heat 映射零改动（diff 无）。
6. **B8 3 条断言（:62/:95/:273）**：核了 fixture——`local-1/local-2` 同为 intensity 1（2 张 tie 组），初始 relationship 固定 → seed 固定 → `rotationOffset(seed,1,2)` 恰为 0，「现在绿是确定性巧合」**属实**。判定 P2（不本轮修）：这三条验证的是写回/耗尽语义而非顺序语义，顺序已由 fair-exposure 锁死；建议后续显式注入 `drawSeed` 钉死意图（P2-2）。

### B. 审计基建 --verify-only（篡改实验，亲跑）

1. 基线：`vite-node scripts/audit-a1-report.ts --verify-only` = 1,070 项、PASS、exit 0。
2. **散文节篡改被抓**：把 CONTENT-STRUCTURE-REPORT.md §0「高 40 题（11.4%）」改为「47 题（13.4%）」→ `FAIL：1 项｜struct:0:highN @ S#0｜报告值 47｜JSON 值 40｜差值 7.000000`，**exit 1**。
3. **MC 表格篡改被抓**（上一轮 P1-1 的同位置复测）：把 ROUTER-CONTENT-MONTE-CARLO.md §5 H1 行改为 9,999/9.9% → `FAIL：2 项`（含占比列差值），**exit 1**。
4. 还原后 exit 0，两份文件 diff 字节一致。全部临时改动已还原。
5. **无「抽不到就默认通过」路径**：`probe` 正则未命中→NaN→`actual=null`→FAIL（fail-closed）；`cellOf` 缺行→NaN→FAIL；`probeText` 未命中→actual=0→FAIL；MC_LABELS 键缺失单独 fail-closed。逐行核过实现。
6. 1070 项覆盖散文节：§0/§2/§7.2-7.4/§12/§13/§14(Q1–Q5)/§15、TOP20 双榜、缺口报告双列+缓冲池+仲裁分布、校准逐轴 κ+drift、MC §1–§11 全表。范围外 8 类**均显式列出**；逐条评估后无一属于「应能对账却没做」的 blocking 缺口（P3-1 记两条弱项）。

### C. verdict 五分类

1. **282 残留 grep**：命中 4 处，全部合规——GAP-AND-NEXT:118 是「作废声明」本身；STRUCTURE-REPORT:76 是口径变更说明；STRUCTURE-REPORT:110 是「旧 verdict→新五分类」映射表的输入维度（合法向后兼容展示）；BUGS-CONTENT-A1.md:19 是 A.1 历史 QA 文档未修订（不属本轮报告）。**无一处把 282 当结论使用。**
2. **缓冲池 61 张推导成立**：骨架 S=122（40+82），约束 B<S，建议 B≤S/2=61；`B≤S/2 ⟺ B/(S+B)≤1/3` 数学正确；且明示「本轮不执行、Human 定」。规则机械实现核过（aggregate.ts:59-80，判定顺序 DELETE 先于 REWRITE，与规则原文一致，报告直接引用同一份常量）。
3. **KEEP_CANDIDATE 放行量（独立计算）**：infoGain=中 共 82 张，**100% 进 KEEP_CANDIDATE**——「中但两轴低→REWRITE」保护分支 350 题零命中（轴间口径耦合的证据）。见 P2-3。

### D. semanticHits（独立抽样）

1. **5 主题语义空白判定成立**：我以固定随机种子抽 20 张题面独立判读——前任/吃醋/底线/人生目标 0 命中；「异性」字面出现 3 张（PN-MOST-011/030、PN-POINT-004）但均为搭话/互动/指人问爱好语义，**不属于**「异性朋友/异性友谊边界」主题。与三层证据（双 reviewer 350 题逐题二值 κ=1 + 第三方独立全库扫描 0 行 + 无待仲裁分歧）交叉一致。
2. **亲密/性观念 30 张**：抽读 PN-DARE-020/028/035/041/047、PN-EITHER-033——全部是肢体亲密/暧昧互动（对视、距离、合照姿势、整理衣领），两名 reviewer 逐题一致（Jaccard=1）。**作为「亲密」维度命中成立；但 30 张里没有一张是「性观念」问答**——记 P2-1（标签颗粒度会误导 Human 拍板，本轮产物恰是 Human 决策输入）。
3. **具体兴趣爱好 semanticHits=2 成立**：PN-POINT-004/018 题面分别嵌「你平时最喜欢做什么」「你平时休息日都怎么过」，属隐式命中（指人卡不改变「该话题存在」的事实）；s1=2/s2=3 的 1 张分歧（PN-POINT-015）走了仲裁、仲裁后 2，流程干净。「更严读法可判 0」是保守备注（第三方独立扫描该主题也是 0），JSON 有记但报告正文未披露该冲突——P3-2。

### E. κ 与「稳定版标签」

1. **κ 数据核实**：either_or infoGain κ=0.0793、dare 5 轴中 4 轴<0.40（0.3109/0.3737/0.2235/0.3525，仅 relationshipProgression 0.4103 过线）、chemistry socialEnergy 弱轴——与挑战点一致，JSON 与报告表格对得上。
2. **门槛 0.40 合理**：Landis & Koch 惯例（<0.40 fair/poor），且 `gates.note` 声明「跑数前固定」、`usageLimit` 显式声明「κ<0.4 轴只能用于候选排序，不得自动决定保留/删除」、weakAxisSummary 逐轴 usableForDecision=false。
3. **「已稳定版标签」名实**：报告 §7.2 与 STABLE-LABELS.statement **两处显式声明**「已稳定版只表示按流程定版，不等于轴已可靠，仍受 κ 门槛约束」。但 dare meanKappa=0.3342、双评审全轴一致率 4.0%、50 题中 44 张靠单一第三方仲裁定版——「稳定」一词与数据的张力真实存在，被限用声明兜住（P3-4 建议改术语）。**【已采纳，本轮收口执行：该术语已全部替换，见 P3-4 的执行记录】**。
4. **三方票源核实（亲验）**：`_calib/original.jsonl`（70 行=每玩法 10 题）前 20 张与 `_reviews-a1/{truth,dare}.jsonl` **逐字段相同**——orig ≡ A.1 原评审（同一来源）属实；r1/r2 各 70 行、每玩法恰 10 题；50 题全量链为 orig+BLIND 双源。**builder 已在报告 §7 头部（:98-99）如实披露**「全部题 50 张为双源；校准样本内 10 题/玩法另有 r1/r2，共 4 源」，未糊弄。挑战点属实且已披露。
5. **结论「审查可靠性不足以支撑逐题自动施工」成立**：κ 数据 + usageLimit + never_have_i「A.1 单源」降级处理（4 个玩法明确标单源、不得消费）自洽。

### F. P1#1 dead-end 的 Change C 判定

1. **Plan 条款逐条核真**：:42 Heat 锁定映射、:62 Router 管线（Heat 硬过滤为第 3 步）、:93/:117/:119 neutral/expansion completed 计入 sessionCompletedRounds 不推进 Heat、:430-431 D8=A+「BUCKET_EMPTY 只允许同 Heat 下向较低且仍合法档位搜索」、:166 final mutual Heat≥H3——全部在 PRODUCT_PLAN_V2.0.md 原文核实无误。
2. **修法 A/B/C → Change C：判定正确**。A 改「Heat 锁定映射」本身（:42/:147-154）并连带 :166；B/C 让 :62 的 Heat 硬过滤在低开放度桌失效、且实际跨 Heat 档出卡与 :431「同 Heat 下」限定冲突。分析文档对 B vs C 的取舍论证（B 中途换挡、同局两套 Heat 语义）成立。
3. **修法 D → 有瑕疵，见 P1-2**：D 的核心（出口引导文案）不碰 Heat/Router/耗尽搜索语义，判「不需要 Change C」大体成立；但 :45 明文冻结 AWAITING Host 出口为「结束 / 洗牌再玩」二选一，而 D 要改「出口按钮与文案」（§2-D :111）——若实现为新增切 neutral 按钮/出口选项，即触碰 D8 冻结出口选项集，文档未点破这一冲突。
4. **没有遗漏的第 5 条免 Change C 修法**：提前结算已有（Host 结束本局）；内容侧补 H3/H4 的 I1/I2 卡已列备选且正确判为 Change C+新内容基线（:530 SSOT 重签流程）；自动/默认提升开放度被明令禁止。
5. **文档位置（docs/qa 而非 docs/pm）**：builder 写 docs/pm/ 违反「谁写哪」（planner 位），§0 自辩成立；但 builder 的影响分析放 docs/qa/ 严格说也占了 QA 文档位（AGENTS 表中 builder 行=「业务仓库本身」）。可接受（qa 位含分析类产物的先例已在 A.1 建立），记 P3-3。

### G. 红线与治理

1. **SSOT 零改动**：`git diff lib/v2-content/generated/v2-ssot.generated.json` = 0 行；mainlineCards=350。✓
2. **版本号三处**：package.json=1.5.0、version.json=1.5.0、sw.js CACHE_VERSION=1.5.0，同值未 bump。✓
3. **无 commit/push**：HEAD 仍 `2527e9f`，工作区改动未提交。✓
4. **Mutual 4 文件未混入本轮**：mtime 分组——Mutual 4 文件为 15:06–15:10（上轮遗留未提交批），本轮全部产出在 18:22 之后，本轮未触碰。✓（注意：这 4 文件相对 HEAD 有未提交 diff，属 HANDOFF 已知的上轮遗留，须与内容审查分离提交——与 HANDOFF 既有要求一致。）
5. **P1#1 未被偷偷实施**：diff 中无 Heat 映射、reducer、exhaustion、耗尽出口 UI 改动；无任何「自动提升开放度」逻辑；DEADEND 文档自身也无实施。✓
6. **D1~D8 未动**：生产 diff 仅 tie-break 顺序与可选 drawSeed 字段，不触碰 D2 选择权归属（仍是 V2 编排器唯一出卡）、D4/D7/D8 语义。✓
7. **作者归属（本轮治理重点）——无法独立证实，见 P1-1**：A.2 全部产出（4 生产文件+3 新 audit 脚本+5 改脚本+测试+报告+DEADEND 文档）在 TASK-MODEL-LOG / DISPATCH-LOG **零记录**（本轮账本新增行全部是 A.1 收口补记）。无 builder 归属的反证（代码风格与 A.1 builder 产出一致、无编排者署名痕迹），但也无账本证据。这正是 A.1 治理事故的同型风险点，整改⑤（supervisor 显式检查「changed file → 作者 → 允许目录」）尚无执行证据。

## 二、P0 / P1 Findings

**P0：无。**

**blocking P1：无。**

**P1（非 blocking）×2：**

- **P1-1｜Phase A.2 产出在两本账零记录，作者归属证据链缺失（治理）**
  - 现象：`git diff docs/model/DISPATCH-LOG.jsonl docs/model/TASK-MODEL-LOG.jsonl` 的新增行全部标注 Phase A.1；A.2 的 4 个生产文件、8 个 audit 脚本改动、12 条测试、全套报告与 DEADEND 文档，在逐派记录与任务账本中无任何一行。按 AGENTS「逐派记录：每次派工收工编排者往 DISPATCH-LOG 记一行」与「与派工显式两行互验」，这是硬缺口。
  - 为什么非 blocking：不指向代码质量问题（本轮技术核验全部通过）；A.1 事故的教训是「检测失效」，本轮复审已补上独立检测；收口前可补记。
  - 复现：`git diff docs/model/DISPATCH-LOG.jsonl | grep PhaseA.2`（空）。
  - 建议修法：①收口前 TM 按 A.2 实际派工逐行补记两本账（builder/code-reviewer/qa/supervisor 各行），supervisor 抽查实派==表；②supervisor 终检执行整改⑤的显式检查并留检查记录（changed file → 作者角色 → AGENTS 允许目录），作为 A.1 事故整改闭环的证据。
- **P1-2｜修法 D 的「不需要 Change C」判定低估了 Plan :45 的冻结冲突（分析文档缺陷）**
  - 现象：DEADEND-CHANGE-C-IMPACT.md §3 把修法 D 标为对全部冻结条款 ✅，但 PRODUCT_PLAN_V2.0.md :45 明文「全局硬合法集仍空时才由 Host 选**『结束 / 洗牌再玩』**」，:430 同句重申——AWAITING_HOST_EXHAUSTION_DECISION 的出口选项集是 D8=A+ 冻结内容。而 §2-D (:111) 要改「耗尽面板的出口按钮与文案」引导切 neutral/expansion：若实现为**新增出口选项/按钮**，即触碰 :45/:430；只有「不改按钮集、仅在非阻塞位置加提示文案」的弱形式可争辩为 Change B。
  - 复现：对读 DEADEND §2-D 与 Plan :45、:430。
  - 建议修法：在 DEADEND 文档 §3 修法 D 行补一条「⚠️ :45 Host 出口二选一为 D8 冻结项；『新增切包出口按钮』升级 Change C，『仅加引导文案』为 Change B」，并把「实现形式」列入 §4.2 Human 决策点。

## 三、P2 / P3 Backlog Findings

**P2 ×4：**

- **P2-1｜「亲密/性观念」semanticHits=30 的主题颗粒度会误导 Human 拍板**。30 张命中全部是肢体亲密/暧昧互动卡（对视/距离/合照姿势/整理衣领），「性观念」问答实际 0 张；而用户 NEW RC 反馈点名缺的恰是「亲密/**性观念**」话题。建议在 CONTENT-GAP-AND-NEXT §1.2 该主题段加一句：「30 张均为肢体亲密互动（行动互动类），性观念类自我披露问答仍为 0——该子维度缺口真实存在」。不改数字，只防误读。
- **P2-2｜B8 3 条断言（:62/:95/:273）依赖初始 seed 恰好 offset=0 的确定性巧合**（builder 自报属实）。建议后续显式传 `drawSeed` 钉死意图或加注释声明依赖，防未来改 fixture/初始状态时无声变红。
- **P2-3｜五分类「中但两轴低→REWRITE」分支零命中**：infoGain=中 82 张 100% 进 KEEP_CANDIDATE（我独立算得），纸面保护分支未实际过滤任何题——说明「中」与两轴强相关（口径耦合）。不改本轮结论（KEEP_CANDIDATE 本就是候选、需 Human 审），但建议 Phase B 复审时对 82 张中值题按更严口径二次过筛。
- **P2-4｜跨局序列逐字重复**：同配置重开局整局抽卡序列相同（我实测 2 局 20 张逐字一致，开局首张恒 PN-DARE-007）。修复前亦如此（全系统无随机源是冻结设计），非回归；但同配置连玩两局的真人会感知规律。建议后续把 sessionId 纳入 seed 派生（重放时 sessionId 不变、不破坏可复现契约），需连同两个调用方一起改，属独立小改。

**P3 ×4：**

- **P3-1**｜verify-only 范围外两项弱化：GAP-SEMANTIC 命中清单/STABLE-LABELS 逐卡标签的文本不与 JSON 逐字对账（md 清单被篡改抓不到）；MC-TRACE 只验存在+终止原因集合。均已显式列出，风险低。
- **P3-2**｜「具体兴趣爱好」第三方独立扫描=0 与双评审=2 的冲突只在 JSON（independentScanHits=0），报告正文未披露；建议 §1.2 补一句。
- **P3-3**｜builder 影响分析文档落 docs/qa/ 属于占 QA 文档位（§0 自辩成立但仍非 builder 正位）；建议以后此类文档位置由任务书直接指定中性位置或由 TM 明确授权。
- **P3-4**｜「已稳定版标签」术语与 dare meanKappa=0.3342/全轴一致率 4.0%/44 张靠单一仲裁定版的数据张力大（两处限用声明已兜底）；建议改术语为「已定版（仲裁收敛）标签」。**【已采纳，本轮收口执行】**：全部「已稳定版 / STABLE_MAJORITY」类措辞已替换为统一口径——「已完成双源复审与分歧仲裁，可用于主题/候选定位；低可靠轴不得作为单题自动保留/删除依据」（STABLE-LABELS.json#labelStatusNote、CALIBRATION-REPORT.md §7.1–7.2 已同步重生成）。

## 四、挑战点逐条结论速查

| 挑战点 | 结论 |
|---|---|
| A1 优先级顺序 | 语义等价成立，逐层核过 |
| A2 可复现随机 | 三性质成立，非「按 seed 排序」 |
| A3 used 派生 seed 规律性 | 局内 seed 每轮变（recent 也在 key）；跨局序列逐字重复→P2-4 |
| A4 937 测试是否足够 | 103 文件/937 全绿亲跑，Coverage/Anchor/D7 用例在内；足够 |
| A5 B8 3 断言 | 属实，判 P2-2 |
| B1 verify-only 篡改实验 | 亲跑：散文/MC 两处篡改均 exit 1 并报差值，还原后 0 |
| B2 1070 覆盖散文节 | 覆盖；fail-closed 无默认通过路径 |
| B3 8 类范围外 | 逐条评估，无 blocking 缺口，P3-1 记弱项 |
| C1 282 残留 | 无残留（4 处命中全合规） |
| C2 61 张推导 | 数学成立且明示不执行 |
| C3 中值规则放行 | 82 张 100% 进 KEEP，保护分支零命中→P2-3 |
| D1 5 主题语义空白 | 抽 20 张独立验证成立 |
| D2 亲密/性观念 30 | 数字成立但全是肢体互动→P2-1 |
| D3 兴趣爱好 semantic=2 | 成立（隐式+仲裁流程干净） |
| E1 κ 门槛/名实 | 0.40 合理、跑前固定；「稳定版」有兜底声明但术语有张力→P3-4 |
| E2 三方票源 | orig≡A.1 亲验属实；builder 已如实披露双源 |
| E3 不能自动施工结论 | 成立 |
| F1 Change C 判定 | A/B/C 正确；D 有 :45 冲突遗漏→P1-2 |
| F2 修法 D | 核心成立，实现形式需决策点 |
| F3 docs/qa 位置 | 可接受，P3-3 |
| G 红线 | SSOT/350/版本三处/无 commit/P1#1 未实施/D1-D8 未动/Mutual 未混入，全过 |
| G 作者归属 | 账本零记录，无法独立证实→P1-1 |

## 五、可回滚性

生产改动集中在 4 个文件的可选路径（`drawSeed` 缺省路径），回滚 = 还原 4 文件 diff 即恢复修复前行为；`v2-session.ts` 的 `drawSeed?` 为可选字段，旧 Session 数据兼容（无 schema 迁移需求）。audit 脚本与报告不进生产 bundle。可回滚性：良。
