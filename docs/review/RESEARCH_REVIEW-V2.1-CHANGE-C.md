# RESEARCH_REVIEW｜V2.1 Phase B Change C 独立复审

- Plan Version（评的是哪版 PRODUCT_PLAN）：`PRODUCT_PLAN_V2.1-CHANGE-C`（DRAFT，`PLAN_REOPEN_REQUIRED`，`PLAN_GATE=IN_PROGRESS`）
- Review Round：第 1 轮（Phase B Change C Plan 独立复审）
- Result：**FAIL —— 暂不进 WAITING_HUMAN_APPROVAL，回 Planner 做 4 处纯文档修订后再交 Human Gate（详见 Required Fixes 与 §H）**
- P0 / P1 / P2：
  - P0：0 个
  - blocking P1：0 个
  - 非 blocking P1：4 个（P1-1～P1-4，均为 Planner 纯文档可修，不碰代码/题库/SSOT）
  - P2：2 个；P3：1 个
- 被审对象状态确认：本稿自声明"设计与验收契约，不是已完成的内容或模拟结果"（§0/§15），`DEV_BASELINE` 仍为 V2.0，未伪造 Readiness≥90。这一诚实声明成立，本报告按"契约完整性"评审，不因"内容尚未生成"本身扣分之后再重复扣分；扣分只针对契约缺口。

## P0（0 个）

无。

## blocking P1（0 个）

两条 HANDOFF blocking P1（Mutual privacy reveal、严格 D8）的设计方向均成立，无静默破坏 D1～D8（见 §A、§C）。未发现须立即阻断的契约错误。

## 非 blocking P1（4 个，Planner 必须修，修完可进 Human Gate）

### P1-1｜Mutual 崩溃/后台恢复的进入态未写死， builder 可选错默认方向

- 复现/推导：Plan §2 只写"关闭/卸载/后台恢复默认不自动揭屏，恢复若不能证明仍在本人页面则回遮罩或安全取消"。独立核验现状代码：`MutualCheckSheet.tsx` 的 run 全活在 `runRef` 纯内存 + `useEffect` 卸载清理（106–114 行），crash 后内存丢失是天然安全方向；但 Plan 给了恢复路径两个可选项（回遮罩 vs 安全取消），未规定：① 以哪个为默认；② "不能证明仍在本人页面"的判定条件是什么（进程重建后 cursor/players 是否可信）；③ 恢复后落在第几位的 HANDOFF_MASK 还是整轮取消。
- 风险：两个选项都是安全方向，但"回某一位的遮罩"若 cursor 错位会让错的人揭屏（退化为现场误操作类风险）；"整轮取消"则丢失整轮进度。Builder 二选一时无契约可依，QA 无法断言。
- 修法：§2 补一句：恢复默认 = 安全取消整轮（内存 run 已丢，cursor 不可信，不重建）；仅当 Session 持久化了可验证的 `(runId, cursor, playerId)` 三元且调用方能证明仍在本人 SELECT 页时，才允许回遮罩。对应测试断言 entry-state 写进 §10 真机 Mutual 行。

### P1-2｜"亲密互动动作不得算性观念"无机器可校验字段，仍是人工判断

- 复现/推导：Plan §5 写了分类规则（对视/靠近/拥抱/牵手/合照只按动作统计），§10 静态检查写了"亲密动作不得算性观念"。但 §4 求解程序步骤①列出的候选卡元数据字段为 `(cardId, pack, gameType, heatMin/max, intensity, targetMode, matchRequired, minPlayers, boundaryTags, informationGoal)` —— 其中没有显式的动作/态度二分字段。`boundaryTags` 是雷区枚举（见 `prompt-builder.ts:29`），`informationGoal` 是自由文本目标，均不能承担"动作 vs 性观念问答"的互斥分类。A.2 的教训正是"亲密/性观念"30 张里 24 张是动作（`CONTENT-GAP-AND-NEXT.md` §1.2b）；没有字段位，映射复核仍靠人工逐题判断，会重复 A.2 的口径漂移问题（κ≈0.079 级别的不稳）。
- 修法：§4 步骤①元数据加显式字段（如 `intimacyClass: action | attitude | none`，互斥、必填），§10 静态检查加断言"`intimacyClass=action` 的卡不得同时主信息目标为性观念自我披露；旧 350 映射时 24 张动作卡的该字段必须全量回填并由脚本校验分布"。字段是否进运行时卡 schema 由 Builder 定（sidecar 剥离亦可，§7 已有此机制），但分类位本身必须存在。

### P1-3｜七个玩法"本人揭晓"缺 asker 与拒绝路径，Chemistry/Most Likely/Pointing 的揭晓是半句口号

- 复现/推导：Plan §6 表格中，Never Have I Ever 有完整三态（命中可选 reveal / 不愿 reveal 直接继续 / 无惩罚）；但 Chemistry（"先互猜，再由本人揭晓"）、Most Likely/Pointing（"被选中本人揭晓真实情况"）只写了揭晓动作，未写：① 谁来问（Host 按固定话术问，还是被选人自己说）；② 被选人答不出来/不想答时的显式出口（NHIE 有，猜人类没有）；③ "未揭晓只算热场"的计数含义（是否影响 §8 信息密度统计口径——§8 写了"未揭晓的猜人题不算高信息"，但未写算不算 social buffer 轮）。
- 修法：§6 对 Chemistry/Most Likely/Pointing 三行各补：asker（Host 用固定中性话术邀请被选人揭晓，被选人可跳过）、拒绝出口（跳过无惩罚、直接继续）、计数归属（未揭晓轮计入 social buffer，不计信息轮）。Truth/Either Or/Dare/NHIE 四行验收落点已可执行，不用动。

### P1-4｜D8"不显示/禁用洗牌再玩"二选一未定，awaiting 下 cardless 优先级缺一句话

- 复现/推导：Plan §3 写"不显示/禁用「洗牌再玩」"——隐藏与禁用是两种可测行为，QA 断言写法不同。另，Plan §3 写"UI 从持久化 `awaitingHostDecision(session)` 单一投影渲染，优先级高于 cardless 和普通空牌页"，但现状 `app/game/page.tsx` 的 cardless 短路（`packIsCardless` 时无 currentRound 照常进主局）与 awaiting 分支的交互顺序未在 Plan 中给出明确的渲染优先级表；Builder 自行排序可能把 cardless 页盖在 awaiting 上（即 HANDOFF 指出的模糊态换个位置复活）。
- 修法：§3 补：① 无效洗牌按钮取"不显示"（隐藏，连同其占位，避免 Host 误以为功能缺失——配文案"当前条件下没有可继续的关系题"已在 Plan 中）；② 给出三行渲染优先级表：`awaitingHostDecision > cardless/normal-empty > PACK_EXHAUSTED/GLOBAL_EXHAUSTED`，并要求 `startRound` 的 cardless 早返（`session-engine.ts:109`）在 awaiting 下不得先于 awaiting 分支。

## P2（2 个，建议修，不阻 Human Gate）

- P2-1｜§8 "H1→H4 有明显深入感"的盲排协议缺样本与通过线。Plan 写了"逐 Heat 题面盲排"，但未写：盲排人是谁（与出题人独立？）、样本量（每档几题）、通过线（几人一致算过）。Monte Carlo 部分口径完整，此条是体验指标中唯一不可复算项。建议补：每 Heat 档随机抽 20 题面、3 名独立盲排者按深入感排序，与 heatMin 排序的 Spearman≥0.6 为通过候选线（最终线仍由 Human 校准）。
- P2-2｜Plan 未正面给出"350 题够不够"的 reviewer 级测算， solver 会给出答案但 Human Gate 讨论时需要数量级直觉。独立测算（见 §B.3）：H4×I1 全库现为 0 张，按 25 轮下界需 ≥12 张 unique；单包模式下每个允许单玩的包需自备 H4×I1 库存，当前每包 I1 仅 8–10 张且全在 H1–H2。结论：几乎必然扩容（新增 H4×I1/I2 为主），"复用为主"不成立。建议 §5 或 §14 补一句数量级预期（"以新增 H4 低尺度卡为主，预计总库显著大于 350，具体数由求解器定"），避免 Human 误以为 350 改写即够。

## P3（1 个， polish）

- P3-1｜§10 Monte Carlo 行"用随机状态序列/属性测试证明 awaiting 的抽卡和切包守卫对所有 packId 不变"——属性测试的 packId 全集（含自定义/未知 packId）与 runner 未指定。建议补：packId 全集 = 内置 7+1（含 cardless spin-bottle）+ 2 个合成未知 id，断言 `switchPack`/`switchPackAndDeal` 在 awaiting 下恒等返回（引用相等）。

## §A 核验结论

### A.1 Mutual privacy reveal：设计满足"遮罩不得再自动消失"，4 种情形 + Host 揭结果逐项结论

独立核验现状（`MutualCheckSheet.tsx:47–48,116–131`）：`HANDOFF_MASK_MS=1350` + timer effect 是唯一的自动推进源。Plan §2 要求删除该常量与 effect、禁把定时器移到父页（点名 `app/game/page.tsx`），并给出无限等待 + 本人主动揭屏。逐情形推演：

1. 上一位长期持有手机（不交）：PASS。无限等待下无任何自动转移；timer 删除后不存在超时回调，下一位题面不可能出现。Plan 预计改动文件正确指出了唯一的计时器位置（116–131 行）。
2. 上一位在揭屏瞬间抢回：结论 = 机制上成立 residual，Plan 已诚实披露。揭屏按钮无身份鉴别能力，持机者点即进 SELECT。Plan §2 末段明确"错误的人主动点按钮属于现场误操作，UI 明示身份、不得宣称软件已识别本人"——这是正确的诚实设计（不承诺做不到的身份验证），配合"一次作答 + 一次揭屏"的 Human 决策（HANDOFF 决策 3）。不记 blocking，但真机 QA 必须保留误触提示文案检查（Plan §10 已列）。
3. 下一位误触/连点"我已拿到手机"：PASS（幂等）+ residual 同上。Plan 要求"揭屏重复点只产生一次状态转移，提交重复点只受理一次；按钮忙时禁用"——单调状态机 + busy 守卫覆盖连点跳过交接的风险（连点只能重复进入同一人的 SELECT，不能跳过本人作答，因为作答是独立的第二次点击）。
4. 揭屏后崩溃恢复：部分缺口 → P1-1。Plan 要求"恢复默认不自动揭屏"，方向正确；但"回遮罩或安全取消"二选一未定（见 P1-1）。现状内存 run 丢失天然偏向安全取消，Plan 应把这一默认写死。
5. Host 主动揭结果：无新隐私问题。RESULTS 只含双向 MATCH（公开设计），单向不落盘/不进日志（§2 保留 D5 语义 ✓）；无 MATCH 文案不泄露谁选了谁（有明确要求 ✓）；最后一位提交后停留在遮罩、由 Host 主动揭（无自动转移 ✓）。Host 看结果时他人在旁 = 公开揭晓环节的固有形态，非漏洞。

### A.2 严格 D8：代码事实描述准确；三项漏检均已覆盖或补为 P1-4

独立读码验证 Plan §3 的事实前提：

- `drawV2SessionCard` 在 `awaitingHostDecision=true` 时恒返 AWAITING（`v2-session.ts:506–509` 的 `toAwaitingOutcome` 早返）——准确。
- `switchPack`（`session-engine.ts:179–204`）与 `switchPackAndDeal`（`pack-switcher.ts:126–136`）均无清 awaiting 的逻辑 ——准确，"UI 可以切、状态机仍认为 awaiting" 的模糊态描述成立。另确认现状 `app/game/page.tsx:217–219` 在 awaiting + 洗牌无救时仍提供"切换玩法"按钮——正是 Plan 要关掉的绕过口，Plan §3 已点名。
- reshuffle 逐级放宽后仍无卡的收敛：Plan §3 写了"停在明确的无卡退出态供 Host 结束，不自动反复洗牌或切包"——已覆盖。机制上 `applyV2HostDecision(reshuffle)` 清 used/cycle+1 后 `startRound` 再抽仍空会回到新 AWAITING（cycle 已进一位，幂等键不漂移），配合 `reshuffleWouldRevealCard` 预检（`v2-deal.ts:499–510`，按当前玩法 + single/mixed 作用域试抽，与生产出卡链同口径） gating 按钮——收敛路径完整。
- "禁用洗牌再玩"实现：Plan 用预检 gating + "不显示/禁用"——方向对，但隐藏/禁用未二选一 → P1-4。
- 其它可达路径：`switchPackAndDeal` 是切换 + 出卡的唯一编排入口（含随机启动器解析）；`startRound` 本身不切换 pack；UI 唯一调用点是 `page.tsx:148–155 switchTo`。Plan §3 实施入口列了 `session-engine.ts:switchPack`、`pack-switcher.ts:switchPackAndDeal`、`page.tsx switchTo`/awaiting 分支/cardless 优先级——路径枚举完整，无遗漏。`updateIntensity` 等其它入口不碰 pack，不构成绕过。

## §B 核验结论

### B.1 对角绑定判断：准确，与独立复算完全一致

从 `v2-ssot.generated.json`（350 张）独立复算：I1=58 张全为 heat 1–2；I2=70 张全为 heat 2–3；I3=90 张全为 heat 3–4；I4=92 + I5=40 全为 heat 4–4。lim×Heat 合法表：lim1: H1 58/H2 58/H3 0/H4 0；lim2: H4 0 —— 与 Plan §1.3 及 `DEADEND-CHANGE-C-IMPACT.md` §1.1 逐数一致。最有力的补充数字（Plan 未写，建议 Planner 引用）：**H4×I1 全库 0 张、H4×(I1∪I2) 全库 0 张；每包 I1 仅 8–10 张且全在 H1–H2**——这是方案 E 必要性的最硬证据。

### B.2 库存推导：4/4/5/12 下界是真推导；全格最小值诚实待求，推导链无暗缺但有一处待校准项悬空

- 4/4/5/12 是真推导：D3 阈值 H1 0–3（4 张）、H2 4–7（4 张）、H3 8–12（5 张）、H4 13+（20 轮需 7 张、25 轮需 12 张）。Plan §4 明确写了"由 D3 阈值精确推出的消耗下界"，可复算，成立。
- 约束使用情况：20/25 轮 ✓（表内两行）；软去重 ✓（"下一抽还要有至少一张不在 recent 中的硬合法未用卡" + 整段模拟要求）；Pair gating ✓（`N(h,i,p,g,m,b)` 切片 + Single-Anchor 非定向库存单列）；MATCH ✓（`matchRequired` 不得充数）；Single-Anchor ✓（强制非定向轮仍有卡）；7 玩法库存 ✓（七类切片 + truth/dare 分开曝光回归）。**推导链无缺环**——缺的是求解结果本身，Plan 明确宣布"最终每格库存值与通过率为待求结果，不得填造"（§4 末段），这是诚实的。
- 唯一悬空：`s_h`（skip/swap 额外消耗）的"压力分布由真实互动观察/扰动仿真校准"——校准数据源不存在（无历史 skip/swap 分布数据），Plan 未给扰动仿真缺省参数（如每轮 skip 概率先验）。Builder 开工即卡。修法极小：在 §4 求解程序步骤③末补一句缺省先验（如 uniform skip 5%/swap 5% 起步做敏感性扫描，待真人小样后替换），不升级为 P1（P2-2 的 solver 范畴内可定），此处仅记录。

### B.3 总卡数变化：Plan 诚实待求；独立判断几乎必然扩容，"350 改写即够"不成立

Plan 未填总数（§14.6 "不要求 Human 猜数字"），回避了数字但给出了程序（映射四态 + solver + snapshot 证据），属诚实的回避而非偷懒。但 §5"内容蓝图需人工小样实玩后再扩库，避免整批 350 机械改写"一句可能让读者误以为总量仍在 350 量级。独立测算：仅 H4×I1 下界 12 张 + 单包自备约束（7 包各自需 H4×I1，若单包 20 轮成立则每包数张）+ I2 独立覆盖，现有 I1 全在 H1–H2（58 张中 H4-capable 为 0），**新增量级大概率超出现有 350 的改写空间**。→ P2-2（补数量级预期一句话）。

### B.4 方案 E 无 Heat 引擎改动：成立，无偷渡

全文检索 §4/§13：显式禁令"不提升 intensity、不回退 Heat、不放宽硬过滤"（§0）、"零自动提强度、零跨 Heat"（§10 MC 行）、"不把方案 B 偷偷实现"（§13）。§4 的联合档/min() 等 A/B/C 机制词汇零出现；solver 只增卡不改过滤。Heat 硬过滤（`v2-router` + `v2-deal.ts:74–79 heatEligible`）在 Plan 中无任何改动点。PASS。

## §C 核验结论（D1～D8 逐条，无静默破坏）

- D1 真源/迁移：未动。§5 映射四态 + §11 snapshot/hash/回滚，"历史 ID 策略"保留。✓
- D2 单一 Router：未动。§4 求解"驱动生产 createV2MainlineRouter→draw→reduce→apply"，"而不复制 Router"；§13 "不重做已关闭的随机系统"。✓
- D3 档位/计数：未动。§1.1 复述阈值 0–3/4–7/8–12/13+ 与 V2.0 一字不差；4/4/5/12 下界由其推出，无改动。✓
- D4 pair 口径：未动。§2 stale pair 拦截沿用 `mutualPairRunExists`，§6 未碰性别/anchor 语义。✓
- D5 MATCH 上限/非排他：未动。§2 保留 cap≤2 原子检查、无上一步、取消可用；Mutual 主动揭屏是 D5 **隐私交互的显式修订**（Plan §0 自声明"须经 Human Gate"），属公开 delta，非静默破坏。独立判断：同意其定性（交互时序变更，不碰 cap/排他/落盘语义）。✓
- D6 neutral/expansion 不推进：未动，且被加强（§4 "禁止以 neutral/expansion completed 续命"，§8 关系主线专项 20 轮全为 relationship-aware）。✓
- D7 五档保障：未动。§4 "先保留 D7 的 pair opportunity 最小合法集"；§6 "如影响 signal/Coverage 计数须显式 delta"。✓
- D8 耗尽状态机：严格 D8 是对已冻结 D8=A+（V2.0 §H，二选一 + 5→0 放宽）的**实现纠偏**，不是语义修改。独立判断：V2.0 §H.3 允许切换玩法的是 `PACK_EXHAUSTED` 层（"本玩法本局已玩完，允许切换其他有卡玩法"），awaiting 层从未允许切包；现状 UI 的 awaiting 下切包按钮是实现越界。严格 A 把领域入口与 UI 收敛到冻结语义，未改任何冻结条款。✓
- 结论：**无静默破坏，blocking P1 不增加**。Plan §0 的"凡开发发现必须改变任何 D1～D8 先列 delta 停 Human Gate" + §9 门禁是有效的防静默机制。

## §D 核验结论

- D.1 分玩法机制可验收性：Truth/Either Or/Never/Dare 可执行（问题结构 + 拒绝/跳过 + 不记录口头答案均有判据）；Chemistry/Most Likely/Pointing 的"本人揭晓"缺 asker 与拒绝出口 → P1-3。
- D.2 动作/性观念隔离：规则正确（与 `CONTENT-GAP-AND-NEXT.md` §1.2b 的 24/6 拆分一致），但无机器可校验字段位 → P1-2。
- D.3 AI content contract 行号：逐行核对 `lib/ai/prompt-builder.ts`（全文件 43 行）：9–13 = STRUCTURED_PACK_HINTS ✓；21–26 = 批目标/玩家/玩法行 ✓；27–31 = 雷区/安全行 ✓；32 = schema 样例 ✓；34–40 = 结构化提示拼装 ✓；"V1.0 无新玩法时逐字一致"注释在第 7 行，Plan §7 正确指出其与新契约冲突、需显式更新 fixture（不是默改）。行号引用准确。另 `card-schema.ts`/`normalize.ts`/`direct-provider.ts`/`generate-deck.ts` 四处同步点列举完整（均为真实存在的文件，`ls` 已验）。

## §E 核验结论

- 可复算性：成立。指标单位（前 20 个 `sessionCompletedRounds`，关系主线专项全为 relationship-aware）+ 记录字段（抽卡时 Heat/ceiling/玩法/主题/信息等级/buffer/reveal/人物维度/最长连击）+ 同一生产链（create→draw→reduce→apply）+ seed/snapshot-hash 固定——Router Monte Carlo 可真实复算。建议的桌型/局数/口径：沿用 §4 基本集（`2m2f/1m3f/2m3f/1m4f` + 增补 `1f3m/1m5f`；ceiling 1–5；MATCH 未建/已建；20/25 轮；每格≥1000 seed 共≥120,000 局）+ 七类单包压力集各≥1000 seed + skip/swap 扰动集；统计口径按桌型×ceiling×MATCH×20/25 分层报均值/P10/P50/P90 + 失败 trace；通过线待真人校准后冻结（Plan §8 已如此要求，同意）。
- buffer 20%–30% vs 166 张（47.4%）：Plan 已解释，非回避。§5 定性 166 为候选池非配额（"绝非施工配额"），§8 定量 buffer 为运行时轮占比（"仅按运行时低信息高现场能量轮算"），`CONTENT-GAP-AND-NEXT.md` §4.2 论证了全库比例≠运行时构成。两者关系：166 是旧库现状描述，20%–30% 是新库运行时目标，中间由 solver + MC 连接。解释链完整。
- 不可测项：P2-1（深入感盲排缺协议）。"I1/2/3/4/5 完整玩满" fires reachable（MC 各档曝光可数，可测 ✓）。其余经双盲校准后可测。无"测了也没用"的指标（连击/维度/密度均直接对应 CONTENT-01 定义）。

## §F 核验结论

- 覆盖：7 问覆盖两类改动。Mutual：Q3（慢一步=持机不交）、Q4（错的人点揭屏）、Q5（双击/离开/后台）、Q6（崩溃恢复）直接命中；D8：Q1（删了切包出口保护）、Q6（crash 后 cycle/幂等）、Q7（正确实现但 Host 体验受限的副作用）命中。Q2（新增假设：现场实际交接 / Host 诚实zac）与 Q7 兜底。覆盖完整。
- 硬度：措辞够硬。"每一项…变更，Builder 提交前写 delta；Reviewer 逐项回答以下七问，缺一项或只写'无风险'无证据即不得进 QA"——是准入口禁（进 QA 的必要条件），不是建议。另"Reviewer 同时核实际作者角色→文件归属"呼应 HANDOFF 治理 incident，有针对性。同意。
- 模板可用性：可直接套用。示例（套 Plan §2 Mutual 主动揭屏）：

```text
Change ID / 受影响 D1–D8 条款 / 文件与状态迁移：
  MUTUAL-REVEAL-01 / D5（隐私交互时序修订，cap/落盘语义不动）/
  MutualCheckSheet.tsx（删 HANDOFF_MASK_MS 与 116–131 timer effect；
  SELECT→HANDOFF_MASK(无限等)→SELECT/RESULTS）+
  tests/unit/mutual-check-sheet.test.tsx + tests/e2e/v2-mutual-flow.spec.ts
旧保护→新保护及证据：
  旧：1.35s 自动推进（零点击交接）→ 新：无限等待 + 下一位本人揭屏；
  证据：timer effect 删除 diff + 假时钟长期遮罩测试 + 真机"上一位持机题面不出现"
新增假设及失效条件：
  假设 A：现场实际完成手机交接（按钮不能验证身份）；失效=上一位代点→下一位题面暴露，
  缓解=UI 明示"拿到手机后再查看" + 不宣称身份识别（Plan 已写）
Q1 删除的保护：零点击交接的便利性。结论：有意删除，以隐私为先；Human 决策 3 覆盖
Q2 新假设：见假设 A；反例=锁屏/切后台后持机者仍在 SELECT 页（由 Q5/Q6 覆盖）
Q3 慢一步：状态停 HANDOFF_MASK；UI 仅显示交给谁+提示+揭屏按钮；隐私结果=下一位题面不出现；
  验证=假时钟 + 真机长期持有
Q4 错的人操作：状态进入错误人的 SELECT；UI 显示其题面；隐私结果=题面暴露给持机者（现场误操作类）；
  验证=E2E 误触路径 + 文案不断言身份
Q5 双击、离开、后台：状态单调一次转移（busy 禁用）；取消清 run 内存；验证=双击/卸载/候选失效单测
Q6 崩溃恢复：内存 run 丢失；默认可见状态必须为遮罩或取消（P1-1 要求写死其一）；验证=E2E 恢复用例
Q7 设计副作用：最危险反例=最后一位提交后 Host 久不揭结果，他人在旁看到 RESULTS 公开 MATCH；
  处置=RESULTS 仅含双向结果 + 无 MATCH 文案不泄露（Plan 已有）；验证=RESULTS 文案审查
Verdict：PASS（条件：P1-1 恢复默认写死后）/ BLOCK 项无
```

## §G 核验结论

- 完整性：§14 共 6 项，覆盖 HANDOFF 5 项人工决策（push / 批准 Change C / Mutual 一次作答+一次揭屏 / D8 A / 体验目标数字）逐项映射，外加第 6 项（内容样本与库存求解后的措辞上限 + "不要求 Human 猜数字"）。HANDOFF 5 项无遗漏；第 6 项是新增的必要前瞻（亲密态度题上限确实须 Human 拍板）。完整。
- 代决检查：第 3 项"建议接受"、第 4 项"确认严格 A"、第 5 项"保留开放"——均为建议口吻 + 理由 disclosed，最终批准留给 Human（§1.8 "本稿仅对设计提出建议，不代 Human 作最终批准"）。未发现替 Human 决定的条款。唯一可挑剔：第 3 项把"按钮文字可由真人小样校准"写进建议，实为执行细节下放，无害。

## §H Readiness 评分与结论

按 `PRODUCT_PLAN.template.md` 七维评分：

| 维度（满分） | 得分 | 依据 |
|---|---:|---|
| 产品目标与用户需求（20） | 18 | CONTENT-01 根因→方案 E 链条完整，20 轮目标承接试玩反馈；扣 2 分：P2-2 的数量级预期未写 |
| 核心方案完整性（20） | 13 | Mutual/D8 设计完整可实施；扣 7 分：P1-2 字段位缺失、P1-3 三行揭晓半句口号、P1-1 恢复默认未定（各约 2–3 分） |
| 外部事实与竞品验证（20） | 10 | 内部事实扎实（SSOT 复算/MC/三层语义复核）；外部验证为 0（无竞品桌面研究、无酒吧现场数据——V2.0 遗留缺口仍在，Plan §8 靠未来真人小样补） |
| 技术可行性（15） | 14 | 求解程序驱动生产链、文件行号级改动点、回退路径完整；扣 1 分：`s_h` 校准先验悬空（§B.2） |
| 风险与异常场景（10） | 8 | §12 回退 + §9 七问门禁；扣 2 分：恢复态（P1-1）与 cardless 优先级（P1-4）未封口 |
| 开发范围与 DoD（10） | 8 | §10 六层验证矩阵 + §11 关闭条件 + §13 不做清单清晰；扣 2 分：P1-2/P1-3 的验收断言尚未落进 §10 |
| 未决问题（5） | 3 | §14 六项完整诚实；扣 2 分：4 个 P1 缺口本应在 Plan 内闭环而非留给 Builder |
| **合计** | **74** | **Gate 要求 ≥90；P0=0 ✓；blocking P1=0 ✓；但关键事实（新库存在性）未验证、核心假设（各格最小库存可达）未合理验证** |

Plan 自述"未评分、不继承 83、不伪造≥90"——独立判断：**该自述成立且正确，本报告给出 74 分**。

## 能否交 Human Gate：明确回答

**不能直接进 `WAITING_HUMAN_APPROVAL`。必须先由 Planner 修完 P1-1～P1-4（纯文档修订， working days 级，不涉及代码/题库/SSOT/MC），复验通过后再进。**

理由：Gate 条件为 `Readiness≥90 AND P0=0 AND blocking P1=0 AND 关键事实已验证 AND 核心假设已合理验证`。本稿 P0/blocking 均为 0，但 74<90，且"内容尚未生成、库存未求解、新库 MC 未跑"三项缺失中，后两项（求解、MC）是 Builder 阶段交付物、Plan 阶段本就不该有——**不能以此为由无限阻挡**。真正的放行逻辑应为：P1-1～P1-4 是 Plan 阶段就该写完的契约缺口（修完预计 +12～16 分 → 86～90），修完后即满足"作为设计契约"的放行标准；届时可参照 V2.0 先例（83 + Human 例外有条件批准）由 Human 决定是否以"契约批准、CONTENT-01 仍 OPEN、阈值待校准"为条件放行，RLS 剩余分数转 Phase B 的 solver/MC/真人小样证据（Plan §11 关闭条件已如此设计）。是否给例外，是 Human 的权力，本报告不代决。

## Key Assumptions（逐条＋是否成立）

1. 对角绑定是建模错误、Heat×Intensity 应正交（Human 已决）：成立。独立复算确认对角（§B.1），H4×I1 全库 0 张是硬证据。
2. 方案 E（只改内容、不动引擎）能解决 lim1/lim2 断粮：合理但未验证。成立条件 = solver 找到各格最小库存 + MC 证明 20/25 轮不断粮；当前两者皆无。属核心假设待验证（扣分项，非缺陷）。
3. 每人"一次作答 + 一次揭屏"可被现场接受：未验证，需真人小样（Plan 已列为开放问题 3，诚实）。
4. 严格 D8 的 Host 体验（无效洗牌只剩结束）可接受：未验证，需真人小样 + RG-07；回退路径（安全结束单出口）已备。
5. A.2 标签只用于定位候选：成立。Plan §5 明确"绝非施工配额"，与 QA 限制（交叉一致率 20%–31.4%）一致。

## Verified Facts（已验证事实＋证据）

1. 对角分布与 lim 真空表：`v2-ssot.generated.json` 独立复算，I1:58/I2:70/I3:90/I4:92/I5:40，全对角；lim1 H3/H4=0、lim2 H4=0。（`python3` 复算脚本输出见 §B.1；与 `DEADEND-CHANGE-C-IMPACT.md` §1.1 一致）
2. Mutual 自动揭屏是唯一自动推进源：`MutualCheckSheet.tsx:48`（`HANDOFF_MASK_MS=1350`）+ `:116–131` timer effect；Plan 点名位置准确。
3. D8 awaiting 语义：`v2-session.ts:506–509` 早返 AWAITING；`switchPack`/`switchPackAndDeal` 无清等待逻辑；`page.tsx:217–219` 现状在 awaiting 下仍给切包按钮（待关口）。
4. prompt-builder 行号：全文件 43 行，Plan 引用的 9–13/21–26/27–31/32/34–40 逐段命中，V1.0 逐字一致注释在第 7 行。
5. D3 阈值复述准确：Plan §1.1 的 H1 0–3/H2 4–7/H3 8–12/H4 13+ 与 V2.0 R3 事件表一致；4/4/5/12 下界可由其复算。
6. 亲密 24/6 拆分：`CONTENT-GAP-AND-NEXT.md` §1.2b（24 动作 / 6 态度，性观念自我披露仍空白）——Plan §5 引用正确。

## External Sources / Competitor Findings

- 本轮无外部验证项（无竞品现状/API/官方规则/技术能力/市场数据依赖——本 Plan 是纯内部 brownfield 内容 + 状态机契约，无外部 API 引入）。按角色卡要求如实声明：未做 Web Search（无可查的外部事实会改变 Heat×Intensity 正交或 D8 状态机判断）；外部缺口（竞品聚会游戏的 20 轮节奏数据、酒吧现场传手机耗时）计入 Readiness 外部维度扣分（10/20），待真人小样补。
- Counter-evidence（成功的相反做法）：① 定时自动揭屏（现状 1.35s）是"便利优先于隐私"的相反做法，已被证明泄露下一位题面，不可取；② 修法 B/C（放宽 Heat 硬过滤解断粮）是"改引擎迁就内容"的相反做法，`DEADEND-CHANGE-C-IMPACT.md` §3 已证其触碰冻结条款，不可取。Plan 拒绝两者，正确。

## Unverified Items（未验证项＋验证方法）

1. 各格最小库存 `N(h,i,p,g,m,b)`：方法 = §4 solver + ≥120k MC（Builder 交付，Reviewer 复核删一测试）。
2. §8 阈值最终数字：方法 = 双盲样本校准 + 真人小样 + MC 分层报告后 Human 冻结。
3. 现场可接受性（揭屏多一次点击 / 无效洗牌只剩结束 / 亲密态度措辞上限）：方法 = RG-02/03/04/07 真人局（CONTENT-01 关闭前 RG-02 HOLD，Plan §11 已正确处理）。
4. AI 新合同的 parser 不丢字段：方法 = §7 同步四文件 + 内容质量抽检（Builder 期）。

## Required Fixes（Planner 必须改项）

P1-1（恢复默认写死）、P1-2（`intimacyClass` 显式字段 + §10 断言）、P1-3（三行揭晓补 asker/拒绝/计数归属）、P1-4（隐藏 vs 禁用二选一 + 三行渲染优先级表）。均为 Plan 纯文档修订；修完本报告预测 Readiness 86–90，可进 Human Gate（是否给 V2.0 式例外由 Human 定）。P2-1/P2-2 建议同批带上。

## Human-only Decisions（只需人类拍板项）

沿用 HANDOFF 5 项 + §14 第 6 项（本报告无新增）：① 是否 push 已审查提交；② 是否批准 Change C Phase B 范围；③ 是否接受"一次作答 + 一次揭屏"及 Host 揭结果；④ D8 严格 A 确认（B 仅备选）；⑤ §8 候选数字是否校准后冻结；⑥ 内容样本与库存求解后的亲密措辞上限。请 Human 注意 P2-2 的数量级预期（总库大概率显著大于 350）后再批 ②。

## Next Action

**回 Planner 修订**（P1-1～P1-4，纯文档，不碰代码/题库/SSOT/账本/HANDOFF，不 commit/push）：修订后 Research Reviewer 复验（只验四项 + 重算 Readiness），通过则 `PLAN_GATE=READY_FOR_HUMAN_REVIEW` 进 WAITING_HUMAN_APPROVAL 找人；Human 未明确说"第二阶段，开发"前不得进 DEVELOP。

---
## 复评（2026-09-27，第 2 轮）

- Result: **FAIL（数值门 86<90；但 4 个必修 P1 已 4/4 关闭，残差均为 Plan-phase 结构性不可填项，例外路径见末段）**
- P0: 0
- blocking P1: 0（HANDOFF 两条 blocking 设计方向仍成立，本轮修复未引入新的 blocking；新增检查见下，无死角/无冲突）
- 非 blocking P1: 4/4 已关闭（P1-1～P1-4，下详）；P2: 2 个仍开；P3: 1 个仍开
- 核验方法说明：Plan 与本报告均为 untracked 新文件（`git status` 已确认，无已提交基线可 diff）；逐条对照上轮 Required Fixes 重读 Plan 原文验证（§2/§3/§4/§5/§6/§8/§10/§15），未采信 Planner 自述（§15 的"预期 90–94"仅当预测处理）。

### P1-1～P1-4 逐条复验结论（改前 → 改后 → 是否真修好 → 依据）

- **P1-1（恢复进入态）→ 真修好，CLOSED**。改前：§2"回遮罩或安全取消"二选一、判定条件缺失。改后：§2 已写死"**恢复进入态固定为安全取消整轮**"；"不能证明仍在本人页面"给了五项可断言判定（`runId` 不匹配、`cursor` 越界、`playerId` 与游标所指不一致、参与者列表/顺序无法与可信快照核对、已离开本人 `SELECT`，任一成立即取消）；唯一例外收窄为"Session 已持久化可验证 `(runId, cursor, playerId)` 三元 + 全证据齐 + 仍在该本人 `SELECT`"才允许回**对应 `HANDOFF_MASK`**，且永不直回 `SELECT`/自动揭屏，并自声明"本期不为现有内存 run 虚构持久化能力"；§10 单测/真机行同步断言 entry-state=整轮已取消、结果/计数/公开选择均为 0。无二选一余地。残留（非缺口）：例外路径本期不可测，QA 仅断言默认取消路径——Plan 已诚实声明。
- **P1-2（`intimacyClass` 字段位）→ 真修好，CLOSED**。改前：§4 元数据无动作/态度二分字段。改后：§4 步骤①加 `intimacyClass: action | attitude | none`（**互斥、必填**）+ `informationGoalType`（必填受控码，至少区分 `sexual_attitude_self_disclosure` 与 `other`，每卡仅一个主信息目标，`action × 性观念披露` 组合非法）；§5 要求旧 350 逐题映射 **350/350 全量填写**两字段、已判定的 24 张动作卡按原 cardId **24/24 回填 `action`**（脚本按 ID 集合校验 24/24 命中、缺失 0、非法组合 0，输出全库与 30 张子集分布；余 6 张禁自动归 `attitude`）；运行时 schema 可校验后 sidecar 剥离；§7 AI 候选卡同断言；§10 静态行断言非法组合 0、24/24、350/350。机器可校验成立，非人工判断。
- **P1-3（揭晓三行 asker/拒绝/计数）→ 真修好，CLOSED**。改前：Chemistry/Most Likely/Pointing 只有"本人揭晓"半句。改后：三行各补 `asker=Host` + 可用固定中性话术（非占位，逐行具体引文已给）+ 拒绝出口（可跳过、无惩罚、Host 直接下一轮、禁追问起哄）+ 计数归属（未揭晓轮计 social buffer、不计信息轮）；§8 新增"计数归属固定"段（`socialBuffer=true`、`informationRound=false`，揭晓后仍按实际内容独立评分）。Truth/Either Or/Dare/NHIE 未动，符合要求。
- **P1-4（D8 二选一 + 优先级）→ 真修好，CLOSED**。改前："不显示/禁用"未定、无优先级表。改后：定死取"**不显示**「洗牌再玩」按钮**及其占位**"（配固定文案"当前条件下没有可继续的关系题"、只留"结束本局"，§3＋§10 一致）；三行渲染优先级表已给（`awaitingHostDecision=true` > 非 awaiting cardless/normal-empty > 非 awaiting PACK/GLOBAL_EXHAUSTED，**自上而下首次命中、后项不得覆盖前项**）；`startRound` cardless 早返（`session-engine.ts:109` 附近）在 awaiting 时不得先于 awaiting guard、`page.tsx` cardless 短路不得盖 awaiting 面板——约束已写清；§10 Exhaustion 行断言占位不存在、面板优先、抽卡与切包均被守卫阻断。可测成立。

### P2 / P3

- P2-1（盲排协议）：§8 仍仅"逐 Heat 题面盲排"，无样本量/盲排者独立性/通过线 → **仍开**。
- P2-2（数量级预期）：§5/§14 仍无"总库显著大于 350"一句话 → **仍开**。两者均为建议级，不阻门。
- P3-1（属性测试 packId 全集）：§10 MC 行仍未指定合成未知 id → **仍开**。

### §8 social buffer 20%–30% vs A.2 166 张（47.4%）

- §8 已有明确段落：166 = 旧库静态候选池数量；20%–30% = 新库经真实 Router 出牌后前 20 completed 轮中低信息高现场能量轮的运行时占比目标（约 4–6 轮）；两者分母/时间点/统计对象不同，由映射 + solver + MC 连接，禁直接对比当达标证据 → **已写清，CLOSED**。

### 新增检查（修复是否引入新问题）

- §2↔§10 自洽 ✓；恢复默认"取消整轮"与 D5"取消不产生结果、不计一次"无冲突（§2 逐字保留"不产生结果、不计一次常规互选、不公开任何人的选择"）✓；"不显示洗牌"有明确出口（结束本局），§12 回退到安全结束单出口，Host 无死角 ✓；§4↔§5↔§7↔§10 字段链一致 ✓；§6↔§8 计数一致 ✓；§3↔§10 优先级一致 ✓。**未引入新问题**。一点提醒（非问题）：§2 例外依赖尚不存在的 Session 持久化三元——Plan 已自声明不虚构，QA 以默认取消路径为准。

### Readiness 实际评分：86/100（七维独立重评）

| 维度（满分） | 得分 | 依据（相对上轮 74 的变化） |
|---|---:|---|
| 产品目标与用户需求（20） | 18 | 与上轮同；P2-2 仍缺，扣 2 |
| 核心方案完整性（20） | 19 | P1-1～P1-4 全闭环（+6）；扣 1：§2 例外路径本期不可测（已诚实声明） |
| 外部事实与竞品验证（20） | 10 | 与上轮同；无新增外部证据，结构性待真人小样 |
| 技术可行性（15） | 14 | 与上轮同；`s_h` 先验仍悬空，扣 1 |
| 风险与异常场景（10） | 10 | P1-1/P1-4 封口（+2） |
| 开发范围与 DoD（10） | 10 | §10 四处断言全落位（+2） |
| 未决问题（5） | 5 | 4 个 P1 已在 Plan 内闭环（+2）；P2-1/P2-2 仍开但定义不阻门 |
| **合计** | **86** | 上轮 74，+12（落在上轮预测区间 86–90 的下沿；Planner"预期 90–94"未达成，差值全在结构性项） |

### Readiness Gate 逐条打勾

- P0 = 0？ ✓（0 个）
- blocking P1 = 0？ ✓（0 个）
- 关键事实已验证？ ✗（新库存在性、各格最小库存、MC 证据均为 Builder 阶段交付物，Plan 已诚实待求——与上轮同，结构性）
- 核心假设已合理验证？ ✗（各格最小库存可达待 solver + MC——与上轮同，结构性）
- 模板 Gate 全条件？ ✗（86 < 90）

### 明确回答：能否进 WAITING_HUMAN_APPROVAL / 交 Human Gate

- 按字面 Gate 条件：**不得自动进 `WAITING_HUMAN_APPROVAL`**，名义仍留 `PLAN_REOPEN_REQUIRED / PLAN_GATE=IN_PROGRESS`。
- 但 4 个 Plan-phase 必修项已清零，残差（外部证据、solver/MC、真人小样）均为 Builder 阶段交付物、Plan 阶段结构上无法填满——与 V2.0（83 + Human 例外有条件批准）同构。请 TM 将本复评呈 Human 定是否以"契约批准、CONTENT-01 仍 OPEN、阈值待校准"为例外放行；是否给例外是 Human 的权力，本报告不代决。另注：若 Human 坚持满 90 才放，Planner 能补的也只有 P2-1/P2-2 两句（约 +2～3 → 88–89，仍不满 90），第三轮纯文档返工无意义，特此说明。
- Human 未明确说"第二阶段，开发"前不得进 DEVELOP（沿用上轮结论）。
