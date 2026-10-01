# RESEARCH_REVIEW｜V2.2 Fixed Content First（独立复审）

- Plan Version（评的是哪版 PRODUCT_PLAN）：`PRODUCT_PLAN_V2.2-FIXED-CONTENT-FIRST`（`docs/pm/PRODUCT_PLAN_V2.2-FIXED-CONTENT-FIRST.md`，216 行）
- Review Round（第几轮）：第 1 轮
- Result：**FAIL** —— P0=0，但 blocking P1=1（AI 暂停无代码落点，修法成本一句话），Readiness 80/100 < 90。回 Planner 修订后复评，不进 WAITING_HUMAN_APPROVAL。
- 最重要结论先行：**Plan 是真转向，不是旧骨架换皮**。V2.1 的五大执行支柱（Mutual 主动揭屏实施、D8 严格 A 实施、拍数式库存表、旧 350 逐题复用/改写/淘汰映射、AI content contract）在 V2.2 执行路径里全部消失或被明确作废项取代；残留字符串只出现在「废止声明 / 明确不做」章节。旧骨架复活风险：0。

- P0 / P1 / P2：
  - P0：0。
  - blocking P1：1（A-AI-ISO，见 Required Fixes）。
  - 非 blocking P1：4（E-MIG、E-ACC、M-CNT、H-TM）。
  - P2：5。P3：1。

## P0（0 条）

无。方向、Consent 安全底线、雷区硬过滤均无根本性错误。

## blocking P1（1 条）

### A-AI-ISO｜「AI 暂停正式主线」有判据无落点，Builder 可各自解读

- 推导/复现：Plan §13 给了排除规则（入口/候选池必须排除 AI 生成卡）＋机制类（"Phase B 实施时用可回退的配置/入口门禁隔离"）＋验证（线上及离线零 AI 卡）。但三类代码落点均未点名，而落点真实存在：`app/api/generate-session/route.ts`、`app/generating/page.tsx`、`lib/ai/generate-deck.ts`、`app/settings/ai/page.tsx`。三问（build 期排除？运行时不装载？人工保证？）Plan 一问都没答，"实施时"三字把 Human 最核心的方向句推迟到 Builder 自由裁量。若 Builder 只关 generating 页而漏掉 API 路由或离线缓存，§2/§6/§8/§10 全部验收即被污染，且事后无法区分。
- 建议修法：Planner 在 §13 补一句点名拦截位与形态，例如："以配置键（新建）为唯一开关，`generate-deck` 候选池装载处 + `generating` 入口 + `generate-session` 路由三处同键守卫，任一 AI 卡进入固定快照即构建失败；开关变更走 Design Delta 7 问"。成本一句话，不动骨架。

## 非 blocking P1（4 条）

### E-MIG｜Mutual 迁移要求写了，文件清单没写全（9/14/19  wiring 仍在代码里）

- 推导：Plan §7.2 要求"旧常规互选 due/consumed 逻辑需受控迁移，不能让旧存档补触发 9/14/19"，但 §7.1 最小改动清单只列了时长 `1350→1000ms`＋测试同步。实测代码里 `MutualCheckSheet.tsx:62` 的 `checkpoint` prop 注释仍是"命中的常规互选检查点（9/14/19）"，调用方（`app/game/page.tsx` 侧传入）与 due/consumed 存量逻辑无人点名。旧频率的"尸体代码"留着就是复活向量。
- 修法：§7.1 清单追加：`checkpoint` prop 去留（删或重定义为新检查点）、调用方传入点、due/consumed 存量迁移策略、E2E `tests/e2e/v2-mutual-flow.spec.ts` 对应更新。要求，不阻 Gate。

### E-ACC｜Mutual 真机判据与 1 秒自动设计未对齐，HANDOFF 旧验收无人处置

- 推导：HANDOFF 既有验收"上一位长期持有手机时，下一位题面永远不能自动出现"与 §7.1 的 1 秒自动推进天然互斥（自动设计下该测试必挂）。Plan §131 把它降为"现场流程风险，必须在真人小样验证"，但没写替代判据：Host 持机模型下真机到底验什么（持机交接成功标准？误留手机算事故还是算挂？）。QA 到时会无判据可执行。
- 修法：§7.1 补真机验收三行：Host 持机正常交接 PASS 标准；误留手机的预期行为（题面出现即记流程事故、中止本轮互选）；后台/双击/超慢交接的通过条件。同步明确 HANDOFF 旧验收条改写还是作废（交 TM 落 HANDOFF）。

### M-CNT｜互选触发计数口径混用（有效轮 vs 第 N 轮）

- 推导：§135 前半"完成约第 12–14 个关系主线有效轮"（`relationshipEffectiveCardCount` 口径），后半"若到第 14 轮仍未达认识阈值则不补问"（未注明是有效轮还是 `completed round`），"局不足 12 轮"同理。同段虽声明"两者分开记"，触发句自己没分开。实现时会各写各的。
- 修法：三处统一写成"当 `relationshipEffectiveCardCount ∈ [12,14]` 仍未达阈值则跳过；`relationshipEffectiveCardCount < 12` 即收局则无中途互选"。一句话。

### H-TM｜HANDOFF 自相矛盾，Builder 可能误读（owner 是 TM，不是 Planner）

- 推导：HANDOFF 第 42–49 行同时保留两份冲突指令：P1-MUTUAL-PRIVACY"已作废，保持每人一次作答点击"（line 42/73）与"修复原则：遮罩不得再自动消失，允许增加一次隐私揭屏"（line 45，旧 Human 定调文字残留）。Plan 按后者之作废执行（§129 不新增揭屏步骤）是对的，但 Builder 若读到 HANDOFF line 45 会反向施工。
- 修法：TM 在 HANDOFF line 45 段首加"已由 line 73 作废，留档备查"一句。不动 Plan，不阻 Gate，但必须在 Builder 开工前清掉。

## P2（5 条）

- P2-1｜FAIL 清单 seed ID 是派生 ID，grep 不到字面。`seed-truth-dare-dare-9/-16/-30/-36`、`seed-most-likely-vote-7`在 `index.ts` 中由模板 `seed-${packId}-${type}-${index+1}`（:19–23）构造，经序号换算与题面逐条相符（交手机选歌 / 复述他人话 / 押韵口号 / 现场演猜 / 复述杯中物），判断成立；但 Builder 按字面 grep 会扑空。修法：清单 ID 后补 `(pack,index)` 定位注。
- P2-2｜`v2-card-bridge.ts:75-79` 现有映射（proximity→physical-contact、relationship-sensitive→ex-partner）与 Plan §54"其余 4 项保留作风险/能力标签，不能代替精确开关标签"存在语义差：若新卡泛/精确标签并存而 bridge 照旧 collapsing，会对 `noPhysicalContact` 用户过过滤掉纯贴近/对视题。Plan 方向正确（旧 V2 题逐题补标、未审完不得入库），但需在 Builder 任务书点名复核 bridge 文件。
- P2-3｜逐玩法冻结（stage 3–4）先于 Heat×Intensity 库存实证（stage 7），返工敞口真实存在。Plan 已用三件套对冲（首包跨 Heat 样本＋求解后扩、每包 Heat×Intensity 预库存、跨包断粮受控解冻 §108），评估为"已识别、有回退、残留返工概率"，观察项，不阻 Gate。
- P2-4｜BAR-FIT 残余主观项："复杂表演"与"单句能解释如何开始"（§21）无例库。双审＋HOLD＋Human 抽看已兜底；建议首包冻结时沉淀正/反例库，本轮不阻。
- P2-5｜Single-Anchor 桌的互选行为未拼：§135 触发含"有合法候选 pair"兜底（无则不触发），MC 覆盖含单锚桌型（§154），但单锚桌"至少两名实际候选各有本人披露"如何解释未写。边角，Builder 阶段补一句即可。

## P3（1 条）

- P3-1｜Plan §9 是 11 阶段，与任务书"9 个阶段"速记口径编号不同但覆盖全（多了"完整固定库"与"AI 恢复设计"两个显式阶段）。建议 Planner 在 §9 表首加一句与 9-phase 速记的映射，免 Human 对着任务书数数。

## §A 方向是否真转向：PASS（真转，无旧骨架残留）

- A1 残留检查：执行路径（§9 stage 1–11）为规范→BAR-FIT→逐玩法冻结→完整库→雷区→库存求解→Router MC（验证专用，"改 Router 须另走 Change C"）→Mutual→真人局→AI 恢复（独立 Gate）。"先调 Router / AI 生成补题 / 旧 350 批量修补"三骨架在执行路径中 0 出现；命中字符串（§135 废止声明、§207 明确不做）全部位于非执行章节，按任务口径不算残留。V2.1 §5 式旧题映射流程整段消失。
- A2 AI 暂停可执行性：**不通过**，见 blocking P1（A-AI-ISO）。规则＋验证齐，落点缺。
- A3 AI 恢复门槛：PASS。全门禁通过＋单独 Human Gate＋同合同（BAR-FIT/配额/合法格/信息目标/Consent/去重）＋隔离批次五件验证（schema/机器过滤、双盲、重复检查、分层 MC、独立真人小样）＋失败不得入池，每项都可验收。
- A4 根因数字独立复算：**全部成立**。H4×I1=0/350（独立跑 SSOT，分布与 DEADEND §1.1 真空表一致）；228=166+60+2=65.1%；132/350=37.7%（与 HANDOFF semDist 一致）；六轴全一致 20.0%–31.4%、40/82/166/60/2（采信 A.2，Plan 明确不作施工配额 ✓）；1660/4000=41.5%，lim1 止于 8（H3 起点）、lim2 止于 13（H4 起点），与 DEADEND 实测吻合；41.5% 口径边界（仅 harness 关系主线候选池）Plan 已声明，不夸大。结论"先修题库"有证据支撑，且未把 Router 单方面定罪（P1#2 已修＋MC 双口径并列）。

## §B BAR-FIT 门禁：PASS（附 P2-1；B.4/B.5 无漏洞）

- B1 rubric 可复核：PASS。三档枚举＋t/a 双阈值＋双审计员模拟噪声＋证据字段（`readSeconds/startActions/noiseNotes`）＋三档处置差异（PASS 可进复核 / BORDERLINE 暂禁＋重测＋Human 抽看 / FAIL 直接删＋新 ID 新机制才可入库）齐全。
- B2 阈值可判定：PASS。计时起点（Host 朗读起到知道第一个动作）、动作计数规则（作答=1，同意确认可算第 2）、硬失败类型表（§27）明确；阈值候选权交 Human Gate（§25），未偷拍板。
- B3 FAIL 清单抽 10 条：**9/10 判断成立，第 10 条反证清单机制有效**。8 个清单 ID 经序号换算与题面逐条相符（seed dare-9/-16/-30/-36、likely-vote-7、PN-DARE-005/016/027 均命中记忆/创作/表演/画猜硬类型）；PN-DARE-002 作 BORDERLINE（简单同步手势，不因"模仿"一词机械删除）合理；第 10 条自采 `PN-DARE-014`（表情演＋猜，表演＋猜硬类型）属 FAIL 型但不在清单——清单自声明"非 350 张全量终判"＋"旧库出现同型按 ID 补删题清单"，机制自洽。唯一瑕疵见 P2-1（派生 ID grep 不到）。
- B4 FAIL 删除硬规则：PASS。执行路径无"改写候选"旁路（V2.1 §5 整段删除）；§207＋§23 双锁（FAIL 不润色、新题新 ID、换词复活禁止）；stage 回退只允许"补优质新题"（§167），无复活通道。
- B5 第二保留理由漏洞：PASS。BORDERLINE 转 PASS 需删减＋重测整题＋Human 抽看，且 BORDERLINE 定义要求"无硬失败类型"，FAIL 题无法经 BORDERLINE 洗白。

## §C 逐玩法冻结：PASS（附 P2-3 观察项）

- C1 顺序：PASS，与 Human 指定逐字一致（真心话→二选一→我从来没有→默契测试→谁最可能→指人游戏→大冒险）。
- C2 冻结判据：PASS。每类有行为判据（两选项无伪差异、未揭晓=buffer、动作实时 Consent 等）＋过程判据（全 PASS、雷区/重复复核、Human 抽看＋版本快照）；"质量达标"式空话 0 出现。
- C3 题量：PASS，无自相矛盾。全文"50"出现 4 处，全部是拒绝句（§7 不凑 350、§96 不预设 50、§198/§211 不以 50 凑数）；"8–10/6–8 题"全部是单包真人小样最低发现量，且 §108 明示"非统计保证"；§6 求解输出数字（待解）与"不预设"自洽——求解是输出，预设是输入，无矛盾。
- C4 全局库存依赖：有考虑＋有回退（§101–106 包间互补/判断依据、§108 受控解冻、§114 单包/混合全场景硬约束），残留返工风险见 P2-3。

## §D metadata 与雷区：PASS（附 P2-2）

- D1 字段契约：PASS。15 个必填行（任务书称 11，实际更多）每行均有类型/枚举/必填/机器校验＋人工判据；`secondaryTopics` 唯一可选且明示不计配额。
- D2 过滤判据：PASS。伪代码达可执行级（已知 tag 校验→barFit→ceiling→Heat→任一关闭标签即禁→既有门禁），`ex-partner` 全禁例＋多标签任一即禁例齐全。
- D3 雷区配额：PASS。"不设每个雷区 30 题配额"明示（§69）；全文无隐含配额数字；H×I 待解表（§118）是库存格非雷区格。
- D4 枚举关系：PASS。点名 `constants.ts` 10 开关＋`schemas.ts` BoundaryTag 枚举（实测枚举即该 10 项）；V2 5 类泛标签（`v2-types.ts:33` 实测存在）处理为"同名合并 1 项＋其余保留非过滤标签＋旧题逐题补标＋未审完不得入库"，扩展不替换开关语义成立；bridge 语义差见 P2-2。

## §E Mutual：条件 PASS（E.1/E.2 通过，E.3/E.4 各一 P1）

- E1 主动揭屏作废：PASS。"主动揭屏/我拿到手机/确认身份"在 §129、§131、§201、§207 四处均为禁止句，执行路径 0 残留；"9/14/19"两次出现均为废止/不做句（§135、§207），按任务口径不算残留。
- E2 现状核实结论：**Plan 全对**。独立读码确认：单候选实名模板（`v2-mutual-check.ts:122`，TA 残留仅剩 stale 提示语非候选题面）、多候选点名即提交（tsx :252–261）、点完清快照进中性遮罩不回显（`completePerson`＋HANDOFF_MASK :273–281）、`HANDOFF_MASK_MS=1350`（:48）、timer effect（:116–131）。"时长差"定性准确。
- E3 最小清单完整性：**不全**，见 E-MIG＋E-ACC（缺 checkpoint/due-consumed 调用方清单、缺 E2E 点名、缺对齐后的真机判据）。
- E4 频率重设计：触发规则可实现（计数器与 Heat 门槛均系既有态）；"不足 12 轮"已答（无中途互选＋最终互选附条件）；MC 判据可复算（截取字段＋P10/P50/满足率/缺席率/完成率/耗时）；但计数口径混用见 M-CNT。

## §F Heat×Intensity：PASS

- F1 求解式：PASS。变量 `x[p,h,i,t,b,m]`、场景笛卡尔、硬约束（每必需轮 `|A|≥1`、四零：FAIL/雷区/越限/中性代填禁）、稳健约束（q/u）、目标函数（最小实体＋三惩罚）、五步程序齐全；q/u 未校准属 Plan 阶段正常态（有校准路径＋Human 冻结句），非"待定"式逃避。
- F2 露骨替代：PASS。§112＋§207 双禁＋metadata 行"深度由问答内容判定"，动机口子 0。
- F3 H4×I1=0：PASS，当作前置非 P2。§118 表格显式标注"待解（旧库 0）"、§112 要求 H4 大量 I1/I2、§167 stage 7 退出门（ceiling1/2 全 Heat 足量合法卡）三重锁定。

## §G 阶段门禁与 Design Delta：PASS

- G1：PASS。11 阶段每行输入→产出 / 退出条件＋责任 / 失败回退三列齐全（责任列以 Planner/Reviewer/Human 为主，Builder 侧分工由 §172 按 AGENTS 句收敛，可接受）。
- G2：PASS。7 问准入口禁（漏答/"无风险"即 BLOCK，不进 QA/Release）＋可复制模板＋作者角色核对（针对两次历史失效），可用。
- G3 真人局：PASS。每包独立小样在前（stage 3–4），完整 20 轮真人局在 MC 之后、CONTENT-01 关闭之前（stage 10），"前面全错"风险已被包级小样对冲。

## §H 20 轮指标：PASS

- 可测性：8 指标均有校准/统计口径；最软的"愿意继续"诚实标注"不能被 MC 替代"；"H1→H4 可辨"有盲排 Spearman≥0.6 候选线＋真人复核双轨。
- BAR-FIT 硬指标：PASS。"FAIL 出现 0（BORDERLINE 亦 0）"可机器验（snapshot 静态门禁＋Router 日志逐卡核对＋真人计时复核）。
- buffer vs 少量优先：无冲突。buffer 是运行时轮占比（4–6/20），"少量"是题库冻结策略，分母不同；三包未揭晓自动计 buffer 的上漂风险由 §137（实际揭晓/跳过记录进 MC）对冲，机制存在。

## §I 越权审查：PASS（无偷拍板）

- Human Gate 6 问 vs HANDOFF 5 项：无漏项。push  decision 属本轮禁区（§207 已禁，不重复问）；D8 严格 A 系 Human 已决（HANDOFF line 53），Plan 只执行不重问，正确；其余 Q2/Q3/Q5 与 HANDOFF 一一对应。
- 偷拍板排查：BAR-FIT 阈值交 Human（§25）✓；12–14＋认识阈值标"待校准"＋"调整须 Human Gate"（§135–137），默认值进 Q3 问批，属"带默认值的请示"非偷决 ✓；q/u、库存格、20 轮数值全部待冻 ✓；顺序/宁少勿滥系 Human 原话执行 ✓。唯一建议见 P3-1（AI 拦截位确认可并入 Q4 修完自然消失）。

- Key Assumptions（逐条列＋是否成立）：
  1. Host 持机逐人递交，1 秒窗口内手机在主持人手上 —— 成立（Human 2026-09-27 已决，HANDOFF line 73）；但 HANDOFF line 45 旧修复原则文字残留矛盾，见 H-TM。
  2. 双人模拟噪声 BAR-FIT 计时可操作 —— 合理待验，首包小样即验证（§100 记录听懂秒数）。
  3. q/u、认识阈值、20 轮数值可经真人小样校准后冻结 —— 合理，程序已定（§114/§137/§141）。
  4. 旧 350 题 0 改动基线（只读判定） —— 成立（§207＋A.2 只读结论）。
- Verified Facts（已验证事实＋证据）：
  1. H4×I1=0/350，强度×Heat 分布 {(4,4,4):92,(3,3,4):90,(2,2,3):70,(1,1,2):58,(5,4,4):40}（独立跑 `v2-ssot.generated.json`）。
  2. 228=166+60+2（65.1%）、132/350=37.7%、40/82/166/60/2（与 A.2/HANDOFF 一致；Plan 不作施工配额）。
  3. 1660/4000=41.5%，lim1 止 8、lim2 止 13（与 DEADEND §1.2 一致；口径边界 Plan 已声明）。
  4. 5 主题三层语义空白（与 CONTENT-GAP-AND-NEXT §1.3 一致）；亲密 30 中 24 动作＋性观念自我披露空白（§1.2b），Plan §88–89 引用准确未夸大。
  5. Mutual 现状六点全对（证据见 §E；`HANDOFF_MASK_MS=1350` tsx:48；实名模板 lib:122；点名即提交 tsx:252–261）。
  6. `checkpoint` prop 仍引 9/14/19（tsx:62）、V2 泛标签存在（`v2-types.ts:33`）、bridge 映射存在（`v2-card-bridge.ts:75-79`）、10 开关＋枚举存在（constants.ts:34–43、schemas.ts:37–40）、AI 三落点存在（route/generating/generate-deck）——以上为 P1/P2 依据。
  7. Seed FAIL ID 派生机制（index.ts:19–23）＋序号换算题面相符；PN-DARE-002/005/016/027/014 题面已读。
- External Sources（外部来源）：本次未用。全部结论来自仓库内证独立复算（SSOT、代码、HANDOFF、A.2 证据链），无外部断言需要佐证。
- Competitor Findings（竞品现状＋启示）：Plan 无竞品/外部研究节 —— 同类酒吧社交破冰产品的横向对照缺失，是外部维度的系统性扣分项（见 Readiness），非 blocking。
- Counter-evidence（反对证据）：HANDOFF line 45（遮罩不得自动消失旧定调）vs line 73（已决作废）——前者若成立则 Plan §7.1 整节不成立；本复审采信 line 73（任务书 E.1 同口径＋用户最新指令优先），并立 H-TM 要求 TM 消歧。
- Unverified Items（未验证项＋验证方法）：各格最小库存数（§6 solver＋MC，Builder 产出）；q/u（真人小样校准）；20 轮冻结值（§8 校准＋Human 冻）；首包 BAR-FIT 双人计时实测。以上 Plan 阶段结构上不可填（与 V2.1 R2 同构），由 stage 退出门承接，不扣 blocking。
- Required Fixes（Planner 必须改项）：blocking A-AI-ISO（一句话点名拦截位＋形态）；非 blocking E-MIG（补迁移文件清单）、E-ACC（补真机判据＋处置旧验收）、M-CNT（统一计数口径）；TM 侧 H-TM（一句话消歧）。P2/P3 随 Builder 任务书消化。
- Plan Readiness Score（口径以 PRODUCT_PLAN.template.md 为准）：
  - 产品目标与用户需求（20）：18 —— 目标/场景/成功标准清晰，扣 2（单锚桌互选行为未拼，P2-5）。
  - 核心方案完整性（20）：16 —— 全链条闭环，扣 4（AI 落点、迁移清单、计数口径、真机判据四处可修）。
  - 外部事实与竞品验证（20）：14 —— 内部事实全复算成立，扣 6（竞品/外部研究整节缺失）。
  - 技术可行性（15）：12 —— 求解/MC/伪代码具体，扣 3（AI 隔离形态未定；q/u 待校准属正常不另扣）。
  - 风险与异常场景（10）：8 —— 风险表＋回退＋RC 重冻齐，扣 2（HANDOFF 矛盾外溢＋bridge 语义差未点名）。
  - 开发范围与 DoD（10）：7 —— 不做清单＋阶段退出条件清晰，扣 3（DoD 分散各行、无集中验收汇总句）。
  - 未决问题（5）：4 —— 6 问明确，扣 1（AI 拦截位未进问清单，修 blocking 时 사실상 一并解决）。
  - 合计：**79/100**。
  - Gate（进 Human Review 条件）：Readiness ≥ 90 ✗（79）｜P0=0 ✓｜blocking P1=0 ✗（1）｜关键事实已验证 ✓｜核心假设已合理验证 △（Host 模型已决；i q/u 与 reveal 率待 Builder 证据，结构性残差同 V2.1）。
- Human-only Decisions（只需人类拍板项）：即 Plan §12 六问（宁少勿滥、BAR-FIT 阈值、1+1 互选＋1 秒交接、AI 恢复门槛、20 轮冻结值、DEV_BASELINE 批准＋"第二阶段，开发"口令），本复审无增删；其中 Q3 建议 Human 重点看（默认值 12–14＋认识阈值将先行约束 Builder）。
- Next Action：**回 Planner 修订**（blocking×1＋非 blocking E-MIG/E-ACC/M-CNT，TM 并行清 H-TM），复评确认后由 TM 转 WAITING_HUMAN_APPROVAL。**本轮不进 Human Gate**——blocking 修法成本为一句话，无例外放行的必要；结构性残差（竞品节、Builder 阶段证据）届时请 Human 比照 V2.0（83＋例外批准）定夺。

---
## 复评（第 2 轮，2026-09-27）
- Result: **FAIL** —— P0=0，blocking P1=0（A-AI-ISO 已 CLOSED），4 个非 blocking P1 全部 CLOSED，但 Readiness 实际 **87/100 < 90** 数值门不过。**不得进 WAITING_HUMAN_APPROVAL**。残差均为 Planner 可补的文档项（新非 blocking P1×1＋竞品短节＋集中验收汇总句），预计一轮短修订即可达标，无需 Human 例外。
- P0 / blocking P1 / 非 blocking P1 / P2 / P3：
  - P0：0（维持）。
  - blocking P1：0。A-AI-ISO → CLOSED（见下）。
  - 非 blocking P1：4/4 CLOSED（E-MIG、E-ACC、M-CNT、H-TM，见下）。
  - 新增非 blocking P1×1：A-AI-DIRECT（直连/后台补题路径未点名，见“修订新问题”）。
  - P2：P2-1/P2-2/P2-4/P2-5 → CLOSED；P2-3 仍为观察项（by design，不阻 Gate）。
  - P3：P3-1 → CLOSED。
- A-AI-ISO 复验结论：**CLOSED**。实读代码位置与判断：
  1. `app/api/generate-session/route.ts`（实读全 104 行）：确为服务端生成入口（`callProvider`＋`filterCards`＋返回 `generationSource`），今日无任何开关守卫。Plan §13 点名“服务端拒绝生成请求”——吻合。
  2. `app/generating/page.tsx`（实读全 106 行）：组局 generating 阶段唯一入口，`generate()`→`requestGeneratedDeck`（服务器模式）/`generateSelfContained()`→`requestDeckWithFallbackResult`（自包含直连），今日无守卫。Plan 点名“进入前守卫并退回固定内容流程”——吻合。
  3. `lib/ai/generate-deck.ts`（实读全 197 行）：`buildPlayableDeck` 把 AI＋custom＋本地 SSOT 混装（:45），`resolveDeckTransport` 分流 /api vs 直连，今日无守卫。Plan 点名“出题函数入口再守卫，禁止绕过 UI 的调用装载 AI 候选”——吻合。
  4. `app/settings/ai/page.tsx` 存在（`ls` 确认）；Plan 明确“不得借该设置覆盖正式主线开关”——覆盖了设置旁路。
  5. 开关形态：单一运行时配置 `AI_MAINLINE_ENABLED=false`，缺失视为关闭；`grep` 确认该键今日在代码中 0 命中＝新建键，Builder 实现，无历史包袱。与“AI 代码保留”自洽（门禁只关装载，不删代码；恢复走 stage 11 独立 Gate），不会永久废掉 AI。
  6. 「正式 session 的 AI 来源卡数为 0」**可机器执行**：`lib/domain/generation-source.ts:13-15`（`deckGenerationSource`：任一 `card.source==="ai"` 即 ai，否则 local-fallback）＋`schemas.ts:21`（`generationSourceSchema` 枚举 `ai|local-fallback`）＋既有单测 `tests/unit/generation-source.test.ts` 与 matrix 判定复用同一函数。E2E 可逐卡断言 `source==="ai"` 卡数=0、快照外 ID 数=0；服务端调用数=0 可经 route mock/日志计数。所需证据：固定库 manifest、快照 hash、逐卡来源断言日志——Plan §13 已全部点名。
- 4 个非 blocking P1 逐条结论：
  - E-MIG → **CLOSED**。Plan §7.1 现为 4 点迁移清单：`MutualCheckSheet.tsx` 的 `HANDOFF_MASK_MS`/timer/`checkpoint` prop、旧 9/14/19 prop 语义删除或重定义、`app/game/page.tsx` 传入点＋触发常量唯一真源＋due/consumed 持久化/恢复版本（旧存档清 due、已 consumed 不转新检查点、最多一次中途互选、旧 session 不补触发）、`v2-mutual-check.ts`＋配置＋`tests/e2e/v2-mutual-flow.spec.ts`＋`tests/unit/v2-mutual-check.test.ts`、仓库全量搜索 `9/14/19/checkpoint/due/consumed` 逐命中登记。实测 wiring 存在（`v2-state.ts:42` 9/14/19 due 口径、`v2-mutual-check.ts:44-45/72`、`v2-reducer.ts:205-214` 四道门、`MutualCheckSheet.tsx:48/62`、`tests/phone/party-run.ts:37-38/109-124`），清单与代码一一对应，可断言。
  - E-ACC → **CLOSED**。Plan §7.1（line 137）现按 Host 持机新决定逐条给判据：持机交接 PASS 标准、上一位仍持机而题面出现记流程事故并中止（不写成软件“永不自动出现”PASS）、双击/切后台/超慢交接预期行为；并要求 TM 在 Builder 开工前把 HANDOFF 旧验收标作废、QA 按新判据现场复验。可执行。
  - M-CNT → **CLOSED**。Plan §7.2 三处已统一为 `relationshipEffectiveCardCount ∈ [12,14]`（line 141–142），`completedRoundCount` 明示只计进度不参与检查点，MC 逐局断言“`completedRoundCount=12–14` 本身不得触发”（line 143）。混用已消除。
  - H-TM → **CLOSED（Plan 侧；TM 动作待开工前完成）**。Plan §182 现为“H-TM 开工前阻断项（TM 文件归属）”：TM 在 Builder 读 HANDOFF 派工前标旧句作废并写入新判据，Supervisor 对照确认，未完成不派 Builder，Planner 不改 HANDOFF。符合“标为 TM 开工前阻断项”要求；HANDOFF 本体今日仍待 TM 消歧（属 TM 职责，非 Plan 扣分项）。
- 修订是否引入新问题：
  1. **A-AI-DIRECT（新增非 blocking P1）**：Plan 点名的三处未覆盖 `lib/ai/direct-provider.ts`（自包含前端直连 Provider，不经过 route）与 `refillPackInBackground`（后台补题同一传输链）。Plan 通用句“禁止任何绕过 UI 的调用装载 AI 候选”方向对，但 E2E 只写了“服务端生成调用数=0”，直连 AI 调用 bypass 服务端会计数逃逸。修法（一句话）：§13 追加点名 `direct-provider`＋后台补题同键守卫，E2E 加断言直连 AI 调用数=0。不阻 Gate。
  2. AI 开关与代码保留自洽，无永久废 AI 风险（见上 5）。
  3. M-CNT 低开放度局可能永远到不了有效卡 12 → 无中途互选：属“先了解再问”语义的 by design（Plan 明示 `<12` 无中途互选＋最终互选附条件＋MC 报缺席率＋内容优先修复），非新缺陷，观察项。
  4. E-MIG 事件兼容残差：`mutual_due` 事件 `dueCount` 语义与新检查点映射、幂等键在取消/恢复路径的沿用，Plan 只写到“持久化/恢复版本＋回归覆盖”，未逐字段点名。随 Builder 任务书消化，不单独立项（风险维扣 1 分）。
  5. 修订无旧骨架回潮：`git status` 确认 Plan/复审为未入库新文件（无旧分支 diff 可比，逐段原文核对）；执行路径仍 11 阶段固定库优先，V2.1 三骨架 0 重现。
- Readiness 实际评分 **87/100**（七维分解，独立打分，Planner 预测未采信）：
  - 产品目标与用户需求（20）：19 —— P2-5 单锚桌已拼，扣 1（20 轮冻结值/认识阈值待校准，结构性）。
  - 核心方案完整性（20）：19 —— AI 落点/迁移清单/计数口径/真机判据全补，扣 1（A-AI-DIRECT 直连路径未点名）。
  - 外部事实与竞品验证（20）：14 —— 内部事实维持全复算成立，扣 6（竞品/外部研究仍整节缺失，与上轮同）。
  - 技术可行性（15）：14 —— 单一运行时键＋三处守卫＋快照断言形态已定，扣 1（直连路径＋每轮发卡校验成本未量化）。
  - 风险与异常场景（10）：9 —— H-TM 开工前阻断＋bridge 点名，扣 1（事件类型兼容未逐字段）。
  - 开发范围与 DoD（10）：7 —— DoD 仍分散各阶段行，无集中验收汇总句（与上轮同）。
  - 未决问题（5）：5 —— 六问明确，Q4 覆盖 AI 暂停＋恢复门槛，P3-1 映射已加。
  - 合计 19+19+14+14+9+7+5 = **87**。
- Gate 逐条打勾：
  - P0=0 ✓｜blocking P1=0 ✓｜非 blocking P1 4/4 CLOSED ✓｜关键事实已验证 ✓（§A 根因数字维持成立，未 rewarm 必要）｜核心假设已合理验证 △（Host 持机已决；i q/u 与 reveal 率待 Builder 证据，结构性残差同 V2.1/V2.0）｜模板 Gate 全条件 ✗（分数门不过）｜分数≥90 ✗（87）。
- 明确回答：**能否交 Human Gate——不能（数值门差 3 分），但无需例外放行**。补齐路径（Planner 短修订，预计一轮）：① §13 加 A-AI-DIRECT 一句话（direct-provider＋后台补题同键守卫＋E2E 直连调用数断言）；② 补竞品/外部研究短节（同类酒吧社交破冰产品横向对照＋启示，外部维最大扣分项）；③ §9 或 §12 前加集中验收汇总句（各阶段 DoD 一览）。三项均为文档句，不动骨架，补后请复评第 3 轮确认；i q/u、reveal 率、各格库存数等 Builder 阶段证据届时仍留 Human 比照 V2.0（83＋例外批准）定夺。

---
## 复评（第 3 轮，2026-09-27）
- Result: **PASS** —— P0=0，blocking P1=0，第 2 轮遗留的三条补齐路径已全部落实（A-AI-DIRECT 实读代码属实；竞品节零编造；汇总表 9×6 齐且映射无损），Readiness 实际 **94/100 ≥ 90**。**可以交 Human Gate**（残差均为 Builder 阶段证据，stage 退出门承接，与 V2.0/V2.1 同构，无需例外）。
- P0 / blocking P1 / 非 blocking P1 / P2 / P3：
  - P0：0（维持）。
  - blocking P1：0（维持）。
  - 非 blocking P1：A-AI-DIRECT → **CLOSED**（见下）；无新增。
  - P2：P2-3 仍为观察项（by design，不阻 Gate）；其余维持 CLOSED。
  - P3：0（维持）。
- A-AI-DIRECT 复验（实读代码结论，调用链属实）：
  1. `requestDeckDirect（lib/ai/generate-deck.ts:83）→ generateDeckDirect（lib/ai/direct-provider.ts:309）→ directChatCompletion（同文件:218，经:328 调用）`——自包含直连旁路，绕过 `/api/generate-session`，**属实**。direct-provider 文件头注释（:15–18）自述三处调用方共用 `directChatCompletion`，与代码一致，Planner 未记错。
  2. `refillPackInBackground（generate-deck.ts:191）→ resolveDeckTransport（:193）→ 自包含模式下 requestDeckDirect`——**属实但附条件**：只在自包含模式进直连，服务器模式走 `/api`。Planner“两者都绕过服务端”措辞略 overstated（后台补题在服务器模式不绕服务端），但 Plan §13（line 13）守卫写的是“同一 `AI_MAINLINE_ENABLED` 键守卫两种模式＋关闭时不得发生成请求或并入快照”，覆盖无遗漏，措辞瑕疵不影响隔离效力，记观察项不扣分。
  3. Plan §13 E2E 现要求“服务端生成调用数=0、直连 Provider 生成调用数=0（覆盖自包含整局生成和后台补题，包含原生 HTTP 与 fetch 传输）”——直连计数逃逸口已堵（含 `CapacitorHttp` 原生传输与 fetch 回退两条传输）。
  4. 自想的新旁路试探：`testDirectConnection（direct-provider.ts:385）→ directChatCompletion`——设置页连通性探测，返回 ok/latency，不产出卡、不进 `buildPlayableDeck`、不进快照，**不是牌堆旁路**，无需守卫（AI 关闭时允许连通性探测无内容风险）。其余卡源（customCards 系用户自备非 AI；`localSeedDeck` 走 SSOT；`prompt-builder` 只组装提示词）均无 AI 装载能力。结论：**A-AI-ISO＋A-AI-DIRECT 合起来，AI 隔离已无牌堆旁路** → CLOSED。
- 竞品节复验（有无编造；维度改善是否实质）：
  1. 相关性：WNRS（Perception→Connection→Reflection 三层自我披露）**高度相关**；TableTopics（场景开放式问句）**中度相关**；Jackbox Quiplash（现场表达＋投票热度）**弱相关但被诚实征用**——Plan 明确写“不能拿投票热度代理信息增量”，是反例式使用，不是硬凑。三者均落在「社交破冰＋信息增量」论域内，判**非硬凑**。
  2. 编造检查：全节**零具体产品能力断言、零数据编造**。三处雷区列均写“未查到…证据”“不能据此断言”，line 23 明示“功能对照，不是效果实验”“不声称市场独有”。文本级 grep 无竞品数字/能力断言可证伪——本节唯一关键判据**通过**。
  3. 维度改善：外部维从“整节缺失”到“有来源链接的诚实功能对照＋明确未验证边界＋差异回指 §3.1/§4/§6/§8”，属**实质但有限**改善（仍缺效果实验、酒吧噪声完成率、竞品内部标签实测；Jackbox 相关性弱）。外部维 14→16（＋2），如实说：够交 Gate，不够满分。
- 集中验收汇总表复验（抽查 3 行的机器可验收列）：
  - 表结构：9 行 × 6 列（阶段/产出物/退出条件/负责角色/失败回退/机器可验收命令或断言）齐全；line 174 与 line 192 双处明示 11→9 合并口径（原 4＋5、原 10＋11，后两者内部仍各有独立门禁）。
  - 抽查 row 1（固定内容规范）：“合同必填字段/枚举 schema 校验失败数=0；旧库证据对账 1,112 项通过（合同校验待实现）”——是**可判定断言（失败数=0/通过数）**，非人话；“1,112”非编造，`TASK-MODEL-LOG.jsonl:122` 有源（自检 1105→1112，审计基建 P2 fail-closed 凭证变更）；“待实现”诚实标注。注：HANDOFF 仍写 1,105（TM 文件 stale，非 Plan 缺陷，观察项）。
  - 抽查 row 5（雷区复核）：“对每个关闭标签及组合断言 `selectedCard.boundaryTags ∩ disabledTags = ∅`；泄漏数=0（待实现）”——可执行谓词，非人话；待实现诚实标注。
  - 抽查 row 8（Mutual 节奏）：`npm test -- --run tests/unit/v2-mutual-check.test.ts` 与 `npm run test:e2e -- tests/e2e/v2-mutual-flow.spec.ts`（实现更新后）＋逐局断言（有效卡触发 12–14、旧 due 不补触发、重复提交=0）——两测试文件实测**均存在**，为全表最强一行；“实现更新后” caveat 诚实。微瑕：`npm test -- --run` 混用 vitest flag 形态，Builder/QA 落实时敲定 runner，观察项。
  - 合并信息损耗：逐行对照原 11 阶段执行表——原 4（逐玩法冻结四步＋Reviewer/Human 回执）与原 5（七包全 PASS＋去重＋Human 批快照）均进入新 row 4 退出条件；原 10（真人局＋CONTENT-01 关闭三方回执）与原 11（AI 保持隔离＋另立 Gate）均进入新 row 9。**无漏阶段、无矛盾**。
- 修订是否引入新问题（含 AI 隔离是否已无旁路）：
  1. 汇总表与原表自洽 ✓（见上）；row 7 退出条件“§8 候选指标经小样校准后达到 Human 冻结线”与 §8“候选未冻结、Human 冻”一致，**无冻结线冲突**。
  2. AI 隔离已无牌堆旁路 ✓（见 A-AI-DIRECT 第 4 点；唯一措辞瑕疵与测试探测非问题均已说明）。
  3. `mutual_due` 事件 `dueCount` 映射 line 206 已移交 Builder 阶段 8 任务书逐字段写清＋回归——第 2 轮风险维扣分项关闭跟踪。
  4. 修订无旧骨架回潮：Plan 仍为未入库新文件（`git status` 确认 ??），执行路径固定库优先，V2.1 三骨架 0 重现。
- Readiness 实际评分 **94/100**（七维分解，独立打分）：
  - 产品目标与用户需求（20）：19 —— 冻结值/认识阈值待校准（结构性，stage 门承接），扣 1。
  - 核心方案完整性（20）：20 —— A-AI-DIRECT 点名＋同键守卫＋双传输断言全补（＋1；“两者都绕过”措辞瑕疵不影响效力，不扣）。
  - 外部事实与竞品验证（20）：16 —— 有源链接的诚实功能对照＋未验证边界＋差异回指（＋2；仍缺效果实验与竞品内部实现实测，扣 4）。
  - 技术可行性（15）：15 —— 四点守卫＋双传输调用数断言形态已定（＋1；每轮发卡校验为快照内集合判定，成本可忽略）。
  - 风险与异常场景（10）：10 —— 事件映射移交 Builder 任务书＋回归（＋1）。
  - 开发范围与 DoD（10）：9 —— 集中汇总表 9×6 齐＋合并映射显式（＋2；7/9 行机器断言待实现且已诚实标注，扣 1）。
  - 未决问题（5）：5 —— 六问明确，Q4 覆盖 AI 暂停＋恢复。
  - 合计 19+20+16+15+10+9+5 = **94**。
- Gate 逐条打勾：
  - P0=0 ✓｜blocking P1=0 ✓｜关键事实已验证 ✓（根因数字维持成立，未 rewarm 必要；1,112 有账本源）｜核心假设已合理验证 ✓（Host 持机已决；q/u、reveal 率、各格库存待 Builder 证据——Plan 阶段结构性不可填，由 stage 退出门承接，与 V2.0/V2.1 同构）｜模板 Gate 全条件 ✓｜分数≥90 ✓（94）。
- 明确回答：能否交 Human Gate——**能，无需例外**。交接后 Builder 阶段证据（q/u 校准、reveal 率、各格最小库存、BAR-FIT 双人计时）仍按 stage 退出门交付，Human Gate 重点看 §12 六问（尤 Q3 互选默认值与 Q4 AI 门槛）。
