# PRODUCT_PLAN｜V2.1 Phase B Change C 草案

- Plan Version：`PRODUCT_PLAN_V2.1-CHANGE-C`；状态：`PLAN_REOPEN_REQUIRED / DRAFT`；`PLAN_GATE=IN_PROGRESS`。本稿须经 Research Reviewer、Readiness Gate 与 Human Gate；未获批准前 `DEV_BASELINE=PRODUCT_PLAN_V2.0` 不变。
- Product Goal：让 20 轮关系主线在所有用户开放度下持续提供有信息量的认识与关系推进，同时关闭 Mutual 自动揭屏和 D8 等待态切包两条隐私/状态机漏洞。
- Target Users：沿用 V2.0 的成年人单设备 4～5 人桌；验证覆盖 2 人可玩包及 1:N Single-Anchor 桌。仍按 local-first、离线可玩、无需账号或云端关系图实施。
- 本稿是**设计与验收契约，不是已完成的内容或模拟结果**。D1～D8 原语义保留；其中 Mutual 主动揭屏是 D5 隐私交互的显式修订，须经 Human Gate。D8 采用严格 A，是对已冻结二选一契约的实现纠偏。凡开发发现必须改变任何 D1～D8 条款，先列精确 delta，停在 Human Gate，不能在实现中静默改。

## §0 一句话目标与边界

在不提升 intensity、不回退 Heat、不放宽硬过滤、不重做 Router 随机系统的前提下，用主动揭屏、严格 D8、Heat×Intensity 正交的新内容基线和运行时 20 轮质量门禁关闭 Phase B blocker。本轮仅写 Plan；不改既有文件、代码、SSOT、题库或发布候选。

## §1 Human 已确认事实

1. 现行基线 `PRODUCT_PLAN_V2.0`：D1 内容真源与历史迁移；D2 单一 V2 Router；D3 双计数器、20+5、Heat H1=`0–3`/H2=`4–7`/H3=`8–12`/H4=`13+`；D4 当局男女合法 pair、无 pair 普通玩法降级；D5 active MATCH 每人≤2；D6 neutral/expansion 的 completed 只计 Session 轮、不推进关系；D7 合格 pair opportunity 两次内展示合法 5 档、展示即 offered；D8 同 Heat 软去重 `5→0`、Host `finish/reshuffle`、不回旧 Router。mutual `9/14/19`、final 资格及单向隐私生命周期也沿用 V2.0。
2. `CONTENT-01=OPEN`：真人试玩认为 20 轮无聊，人物与男女关系认知不足。旧 350 题审计中高信息 40、中 82、低/0 228；真实 Router 已跑 4 桌型×1000 局、目标 20 completed 轮，完整局 2340/4000；完整局均值中+ 7.49、高 2.34、人物维度 2.85/8、最长低/0 连击 9.12。A.2 标签校准不稳（either_or infoGain κ≈0.079、chemistry socialEnergy κ=0），只用于定位候选，不能自动裁定逐题去留。
3. **blocking P1#1：低开放度关系主线断粮。** 旧矩阵 I1 仅 H1–H2、I2 仅 H2–H3、I3 仅 H3–H4、I4/I5 仅 H4；lim1 的 850/850 在第 8 个 relationship completed 后断粮，lim2 的 810/810 在第 13 个后断粮。这里指 relationship-aware 主线，不能说整个 App 无法继续。首选方案 E：改内容覆盖，不动 Heat/Router 硬契约。
4. **P1#2 Router 曝光饥饿已 CLOSED。** 同强度组 seed 轮换后 truth:dare 实测 8078:7985。Phase B 仅做曝光回归，不再设计随机系统。
5. **blocking P1-MUTUAL-PRIVACY。** 生产为 `SELECT 提交 → HANDOFF_MASK →约 1.35s 自动→下一位 SELECT`；上一位久持手机会看到或代答下一位题面。Human 已定主动揭屏、无限等待；“一次点击”指每人一次**作答**点击，允许一次隐私揭屏。
6. **blocking P1-D8-AWAITING-EXIT。** `drawV2SessionCard()` 在 `awaitingHostDecision=true` 持续返回 AWAITING；`switchPack`/`switchPackAndDeal` 不清等待。Human 指定方案 A：等待时禁止切玩法，只留结束/有效洗牌；方案 B 第三 Host 决策只可作为 Human Gate 备选。
7. Heat＝关系推进深度；Intensity＝用户接受的开放度上限，两者近似正交。低尺度 H4 应有恋爱观、人生选择、安全感、异性朋友边界、前任态度、冲突方式、理想生活、关系节奏、亲密边界等深入但不越界的内容；不能自动提高 ceiling。H1–H4 各须有足量 I1，且 ceiling2 各须有足量 I1/I2。
8. HANDOFF 所列五项 Human 决策原样保留：是否 push 已审查提交；是否批准进入 Phase B Change C；Mutual 主动揭屏；D8 A/B；20 轮体验目标最终数字。本稿仅对设计提出建议，不代 Human 作最终批准。RC 当前需后续重冻，本轮不重冻、不 bump、不执行 RG-02。

## §2 Mutual privacy reveal 设计

### 交互与状态

- 初次交接先显示无题面的 `HANDOFF_MASK`（指向第一位），以免 Host 尚未交机就露题。每位本人拿到手机后点**「我已拿到手机，查看我的题目」**，才进入其 `SELECT`；页面提示**「拿到手机后再查看，其他人请不要看屏幕。」** 面板不声称按钮能验证身份，现场仍靠实际交接；大按钮一次轻点即可，不加密码、生物识别或长按。
- `SELECT` 一位只需一次作答点击：单候选点愿意/暂时没有，多候选点昵称/暂时没有；合法提交立即清本位选中态与候选快照，进入下一位的 `HANDOFF_MASK`，**无限等待**。遮罩只显示交给谁、上述提示、揭屏按钮、次要的「取消本轮」；不显示上一位答案或下一位题面。没有上一步。
- 最后一位提交后也留在遮罩，提示交还 Host，由 Host 主动点**「我已拿回手机，查看结果」**才出现 `RESULTS`。无 MATCH 的文案不泄露谁选了谁。揭屏重复点只产生一次状态转移，提交重复点只受理一次；按钮忙时禁用。
- 候选暂离或 pair 在 run 快照中已失效：**提交前**保留现有 `mutualPairRunExists` + 最新合法候选双检查；留在本人 `SELECT`，提示候选已变化，刷新候选或点「暂时没有」，不把非法目标悄悄转为选择。无遮罩自动重试。取消任一步均清空 run 内存、关闭本轮、不记 due/MATCH、不显示部分结果。
- **恢复进入态固定为安全取消整轮**：关闭/卸载、进程重建或切后台后恢复时，只要无法证明交接身份与游标，立即清空本轮、退出 Mutual，不重建 run、不显示任何 `SELECT`/`RESULTS`，也不落到猜测的某位 `HANDOFF_MASK`；不产生结果、不计一次常规互选、不公开任何人的选择。现状 run 仅在内存 `runRef`，进程重建后内存丢失，旧 UI 的 `cursor`、`players` 或单独的 Session 游标均不得当作可信恢复证据；`runId` 不匹配、`cursor` 越界、`playerId` 与游标所指参与者不一致、参与者列表/顺序无法与该 run 的可信快照核对、页面已离开该本人 `SELECT`，任一项成立均判定为“不能证明仍在本人页面”，执行安全取消。后台返回若 run 仍在内存，也须按同一证据规则判定，不能凭组件尚未卸载就自动揭屏。
- **唯一允许恢复到遮罩的例外**：Session 已持久化可验证的 `(runId, cursor, playerId)` 三元，能与同一 run 的完整参与者顺序和当前本人 `SELECT` 页面状态核对，且调用方证明恢复前仍在该 `playerId` 本人的 `SELECT`；满足全部条件才可进入**该 `cursor/playerId` 对应的 `HANDOFF_MASK`**，由本人再次主动揭屏。任一证据缺失或验证失败都安全取消整轮。即使满足例外，也不得直接恢复到 `SELECT`、自动揭屏或沿用未持久化的部分选择；若无法安全恢复本轮完整状态则仍取消。此例外仅定义准入条件，本期不为现有内存 run 虚构持久化能力。
- 只公布双向 MATCH，单向选择不落盘、不进日志/URL/AI；D5 cap≤2 原子检查、无上一步、取消可用、stale pair 拦截与 Consent 均保留。

**预计改动文件（实施阶段）**：`components/game/MutualCheckSheet.tsx`（删除 `HANDOFF_MASK_MS` 与 116–131 行 timer effect；揭屏事件、初始/最终遮罩、文案、幂等和取消），`tests/unit/mutual-check-sheet.test.tsx`（假时钟长期遮罩、重复点、取消/卸载/候选失效），`tests/e2e/v2-mutual-flow.spec.ts`（跨人交机、后台/恢复、双向/单向）。`lib/v2-relationship/v2-mutual-check.ts` 的 `mutualPairRunExists` 和提交契约原则上不改；若实现发现必须改，按 D5 delta 复审。`app/game/page.tsx` 仅在挂载/恢复必须保持遮罩时调整调用，不能把揭屏定时器移到父页。真机必测：上一位长期持有手机（含锁屏、切后台、重新打开）时下一位题面**永远不会自动出现**；错误的人主动点按钮属于现场误操作，UI 明示身份、不得宣称软件已识别本人。

## §3 严格 D8 设计

`AWAITING_HOST_EXHAUSTION_DECISION` 是全局互斥状态，不因当前 pack 为 cardless/neutral 而绕过。进入等待后，所有用户可见切包入口关闭；`switchPack()` 与 `switchPackAndDeal()` 的领域入口再做同一 guard：等待时原样返回、不改 pack/currentSegmentId/round/used/关系态。`startRound`/`drawV2SessionCard` 继续拒抽。只有带当前 cycle 幂等键的 `applyV2HostDecision(finish|reshuffle)` 可离开等待；finish 去结算，reshuffle 保留 Heat/recent/Coverage/Signal/MATCH/5 档状态并由统一 Router 再抽。

UI 从持久化 `awaitingHostDecision(session)` 单一投影渲染；不能仅用隐藏按钮代替领域 guard。渲染按下表自上而下首次命中，后续分支不得覆盖前项：

| 优先级 | 条件 | 唯一可见状态 |
|---|---|---|
| 1 | `awaitingHostDecision(session)=true`，不论当前包是否 cardless、是否有当前卡 | Host 决策面板；只允许结束或通过预检的洗牌 |
| 2 | 非 awaiting 且 cardless/normal-empty | 对应 cardless 或普通空牌页，不冒充 Host 等待态 |
| 3 | 非 awaiting 且 `PACK_EXHAUSTED`/`GLOBAL_EXHAUSTED` | 原耗尽出口，按冻结的非等待态语义处理 |

`lib/engine/session-engine.ts:109` 附近 `startRound` 的 cardless 早返在 awaiting 时**不得先于 awaiting guard**；`app/game/page.tsx` 的 cardless 渲染短路也不得盖过 awaiting 面板。`reshuffleWouldRevealCard()` 必须按生产**当前玩法**出卡条件做**无副作用**预检，包含当前人数、ceiling、Heat、边界、pair/MATCH、硬过滤；不得因“其他玩法有卡”而误判当前玩法的洗牌有效。若为 false，面板只说**「当前条件下没有可继续的关系题」**并提供「结束本局」，**不显示「洗牌再玩」按钮及其占位**，也不显示切玩法/回首页绕过决策。若为 true，显示「结束本局 / 洗牌再玩」。洗牌与结束点击都需 busy/幂等守卫；洗牌后若状态变化导致抽卡仍失败，停在明确的无卡退出态供 Host 结束，不自动反复洗牌或切包。

实施入口：`lib/engine/session-engine.ts:switchPack`、`lib/engine/pack-switcher.ts:switchPackAndDeal`、`app/game/page.tsx` 的 `switchTo`、awaiting 分支与 cardless 优先级、`components/game/HostExhaustionSheet.tsx`、`lib/engine/v2-deal.ts:awaitingHostDecision/reshuffleWouldRevealCard/NO_RECOVERABLE_CARDS_GUIDANCE`；核 `lib/v2-relationship/v2-session.ts:drawV2SessionCard/applyV2HostDecision` 仍保持唯一解锁路径。非 AWAITING 的 `PACK_EXHAUSTED` 等状态依现有语义处理，但必须用状态表防止同一 Session UI 与编排器分歧。方案 B（正式新增“切包继续”第三 Host 决策）只列 §14 供 Human Gate 备选，**不实施**。

## §4 Heat×Intensity 正交内容矩阵与库存反推

### 定义与计数单位

每卡用 `heatMin/heatMax` 说明在哪个关系阶段有意义，用 `intensity` 说明表达/行动尺度；H4 的 I1/I2 内容须问更深的观点或边界，不能把露骨程度当深度。计算单位不是“全库有多少张”，而是某桌型、某 Heat、某 ceiling、某玩法、某 pair/MATCH/边界组合下**尚未 used 且可路由**的不同卡。跨 Heat 卡在各档静态可用表可分别计入，整个 Session unique 库存只计一次；`matchRequired` 不能充当无 MATCH 库存，pair 定向题不能充当 Single-Anchor 强制非定向轮库存。I1 属于 ceiling2 可用，但 I2 仍需独立审查其覆盖和体验，不能靠 I1 填满后宣称 I2 充分。

| 20/25 completed relationship 轮、全程主线的必要消耗下界 | H1 | H2 | H3 | H4 | 全程 unique |
|---|---:|---:|---:|---:|---:|
| 20 轮，无 skip/swap/neutral | 4 | 4 | 5 | 7 | 20 |
| 25 轮，无 skip/swap/neutral | 4 | 4 | 5 | 12 | 25 |

这是由 D3 阈值精确推出的**消耗下界，不是每格最终库存**；skip/swap 会消耗已展示卡却不推进计数，软去重、pack 选择、pair/MATCH、边界与人数门槛会提高所需库存。若计划允许每局额外 `s_h` 张在 Heat h 被 skip/swap 的卡，则该 Heat 的 unique 消耗下界由表中数字增加到 `r_h+s_h`；`s_h` 的压力分布由真实互动观察/扰动仿真校准，不能预设成 0。最近 5 张软去重意味着下一抽还要有至少一张不在 recent 中的硬合法未用卡；used 跨 Heat 去重，须模拟整段序列而非四格分别相加。单玩法模式要求每个允许单玩的包自己承受相应 Heat 消耗；`truth-dare` 是一个路由包但 Truth/Dare 两类都须可见，另五包分别校验。以“全库合计够 25 张”替代逐包与可达性验证无效。

| 七类玩法库存压力切片 | 路由单包/类型关系 | 必测压力 |
|---|---|---|
| Truth、Dare | 同属 `truth-dare`，不能以合计充足掩盖某类长期不曝光 | 单包 20/25 轮、truth/dare 曝光回归；若入口允许只要 Truth 或只要 Dare，再分别独立跑 20/25 |
| Never Have I Ever | `never-have` | 单包 20/25；命中不 reveal 与自愿 reveal 两条体验序列 |
| Either Or | `would-you-rather` | 单包 20/25；追问可跳过，主体选择仍有信息 |
| Chemistry | `compatibility-test` | 单包 20/25；MATCH 前后与本人揭晓 |
| Most Likely | `most-likely`，至少 3 人 | 合法人数单包 20/25；本人揭晓不能被纯猜题取代 |
| Pointing | `pointing-game`，至少 3 人 | 合法人数单包 20/25；Single-Anchor 强制非定向轮仍有卡 |

| 需求格 | 初始硬门槛 | 库存变量与求解方式 | 可接受证据 |
|---|---|---|---|
| H1×I1、H2×I1、H3×I1、H4×I1 | 各档存在合法 I1；lim1 25 轮无零池 | `N(h,1,p,g,m,b)` 为在桌型 g、MATCH 状态 m、边界 b 下玩法 p 可用 unique I1；逐格从 4/4/5/12 消耗下界起搜索，加入软去重最近 5、used、Single-Anchor 非定向与真实 pair 过滤 | lim1 单包及混合 20/25 轮真实 Router，无关系主线结构断粮 |
| H1×I2、H2×I2、H3×I2、H4×I2 | 各档有独立 I2 内容；ceiling2 可用 I1∪I2 | 对 `N(h,≤2,p,g,m,b)` 同法求最小值，并审查每档 I2 曝光；不得从 I1+I2 总量反推 I2 单独已足 | lim2 单包及混合 20/25 轮；各 Heat 真实曝光到 I2 且不越 ceiling |
| H1–H4×I3/I4/I5 | 不退化旧对角绑定；I5 仍按 D7 合法 MATCH 与 Consent | 先保留 D7 的 pair opportunity 最小合法集，再以同一求解器计算常规卡；I4/5 不挤占低尺度必需库存 | lim3/4/5 25 轮完整、5 档窗口与安全门禁通过 |

**求解程序（Phase B Builder 交付、Reviewer 复核）**：① 从新蓝图生成候选卡元数据和内容质量标签，标出 `(cardId, pack, gameType, heatMin/max, intensity, targetMode, matchRequired, minPlayers, boundaryTags, informationGoal, informationGoalType, intimacyClass)`；`intimacyClass` 为**互斥且必填**的 `action | attitude | none`：`action` 是对视/靠近/拥抱/牵手/合照等身体动作指令，`attitude` 是对亲密态度/边界/同意规则的问答，`none` 是与亲密无关；`informationGoalType` 为必填的受控主信息目标代码，至少区分 `sexual_attitude_self_disclosure`（本人性观念/亲密态度自我披露）与 `other`，不能仅靠自由文本 `informationGoal` 做互斥校验。每卡只能有一个主信息目标，`intimacyClass=action` 与 `informationGoalType=sexual_attitude_self_disclosure` 的组合非法；② 在 4/4/5/12 必要下界上，对每个格及约束切片做单调增量搜索，候选卡必须经同一 SSOT adapter；③ 驱动生产 `createV2MainlineRouter → drawV2SessionCard → reduceV2SessionEvents → applyV2HostDecision`，每次记录 `heatAtDraw`、可用硬合法集、used/recent、pack、pair/MATCH、Guard、Consent、终止原因；④ 逐次增加造成失败的**具体约束切片**中的差异化卡，重新跑所有切片，直到 20/25 的接受标准通过；⑤ 从每个通过格反向删一张或一组再测，记录首先失败的证据，得到可复算的经验最小库存，而不是拍一个总量。抽卡 seed 与内容 snapshot hash 固定，供重复运行；若两种约束互相竞争，以所有桌型/玩法的最大要求取上包络，不将跨 Heat 重复计为 unique。

Monte Carlo 扩展 `scripts/audit-a1-router-montecarlo.ts`（实施时由 Builder 写）而不复制 Router：桌型至少 `2m2f/1m3f/2m3f/1m4f`，增补 `1f3m/1m5f`；ceiling 1–5；MATCH 未建/已建；20/25 轮；每基本格≥1000 个固定 seed（6×5×2×2＝120 格，共≥120,000 局），另对七类玩法的单包压力集逐一跑≥1000 seed、边界开启/无合法 pair/暂离与 skip/swap 扰动定向测。**关系主线专测禁止以 neutral/expansion completed 续命，禁止自动切玩法越过 AWAITING；** 合法的关系玩法切包作为单独场景统计，单包场景本身须过。正式验收为 lim1/2 在上述基本格 20 轮结构断粮 `0`、25 轮无结构断粮（若 Host 主动结束另记）、无违法过滤/自动提强度；如果样本出现 0/1000 失败，只能说该样本通过，不能宣称数学上绝无失败。用更多 seed 和定向最坏路径继续压测。**当前尚无新内容 snapshot，故最终每格库存值与通过率均为待求结果，不得在本 Plan 中填造。**

## §5 内容蓝图与旧 350 题映射

先做主题×Heat×Intensity×玩法×信息目标蓝图，再人工把旧 `PN-*` 350 逐题映射为**复用 / 改写 / 仅作热场 / 淘汰**，每题写可复述的“答完知道谁的什么”、有效答案示例、Consent/边界与重复簇；Review 后才决定新旧 ID 和受控 SSOT snapshot。A.2 五分类及 40/82/166/60/2 只用于找候选，绝非施工配额。优先补经独立语义核实的前任、吃醋、异性朋友、底线、人生目标等空白，再覆盖低尺度深关系、具体兴趣与生活日常。

| 独立主题（不得合并统计） | 核心可复述信息与阶段示例 |
|---|---|
| 兴趣爱好 | 常做什么、投入原因、最近一次具体经历；H1–H2 可低尺度 |
| 生活方式 | 作息、休息日、消费/独处/社交节奏；H1–H3 |
| 小癖好 | 小习惯、触发场景、别人如何理解；H1–H3 |
| 择偶标准 | 长期重视的品质及真实取舍；H2–H4 |
| 恋爱观 | 确认关系、承诺、沟通方式；H2–H4 允许 I1 |
| 吃醋/占有 | 情绪处理与尊重对方空间；H3–H4 允许 I1 |
| 异性朋友 | 自己认同的相处边界及原因；H3–H4 允许 I1 |
| 前任 | 过去关系的态度/学到的规则；允许不披露私人细节；H3–H4 |
| 底线/雷区 | 自己的关系底线与冲突修复规则；H3–H4 |
| 人生目标/未来 | 理想生活、城市/工作/家庭选择；H3–H4 允许 I1 |
| 亲密边界 | 节奏、同意方式、可接受/不可接受的边界；H3–H4，I1/I2 可讨论原则 |
| 性观念/亲密态度 | 成年人对亲密关系的态度和价值判断，自愿作答、不得索取实践细节；单列边界与安全审查 |
| 现场化学反应 | 当前互动的观察与热场，可作 social buffer，不能冒充稳定人物认知 |

**独立分类规则**：对视、靠近、拥抱、牵手、合照等是“亲密互动动作”，只按动作/Consent 统计，**不得**再记成“性观念/亲密态度”。旧报告所谓“亲密/性观念”30 张中有 24 张动作；旧 350 题的逐题映射须**350/350 全量填写** §4 的 `intimacyClass` 与 `informationGoalType`，把已判定的这 24 张按原 cardId 清单**24/24 回填为 `action`**，由脚本按 ID 集合校验 24/24 命中、缺失 0、非法组合 0，并输出 `action/attitude/none` 分布及 30 张子集分布；余 6 张不得自动归 `attitude` 或宣称覆盖性观念自我披露，仍需逐题复核。映射时允许一题有次级标签，但主信息目标只能有一个，重复簇按回答内容去重，不能仅靠换玩法包装同一句问题。分类位必须存在于受控映射/候选元数据；运行时卡 schema 可保留两字段或在通过生成批与静态校验后以可追溯 sidecar 剥离，不能在校验前丢字段。内容蓝图需人工小样实玩后再扩库，避免整批 350 机械改写。

## §6 分玩法信息产生机制

| 玩法 | 新题结构与验收落点 |
|---|---|
| Truth | 问本人偏好、经历、关系规则、边界、小癖好、价值观；回答应给具体自我信息，不大量问“你怎么看 TA”。 |
| Either Or | 保留二选一易上手骨架，选完可问“为什么 / 一个具体例子 / 真遇到时怎么选”；不强迫说隐私。 |
| Never Have I Ever | 举手只是开场；命中者**可选**一句经历、原因或最印象深刻的一次；不愿 reveal 可直接继续，不能用惩罚诱导。 |
| Chemistry | 先互猜；**asker=Host** 用固定中性话术邀请本人：“刚才大家猜了你的选择，你愿意说说自己的真实选择吗？可以跳过。”本人可揭晓真实偏好/选择，也可直接跳过；跳过无惩罚，Host 直接进入下一轮，其他人不得追问或起哄逼迫。未揭晓轮计入 social buffer、不计信息轮；只有猜测不得冒充本人信息。 |
| Most Likely | **保留此包**。全桌猜人后，**asker=Host** 对被选中本人说：“大家选了你，你愿意说说实际情况吗？可以跳过。”本人可揭晓并可选一句原因，也可直接跳过；跳过无惩罚，Host 直接进入下一轮，其他人不得追问或起哄逼迫。未揭晓轮计入 social buffer、不计信息轮。 |
| Pointing | **保留此包**。全桌指人后，**asker=Host** 对被指本人说：“大家指了你，你愿意说说实际情况吗？可以跳过。”本人可揭晓并可选一句原因，也可直接跳过；跳过无惩罚，Host 直接进入下一轮，其他人不得追问或起哄逼迫。未揭晓轮计入 social buffer、不计信息轮。 |
| Dare | 行动须产生信息、关系推进或高现场能量；少做无意义动作。身体/亲密行动每次实时 Consent，拒绝/跳过无惩罚；不把动作计作性观念问答。 |

这些 reveal/追问默认为**口头可选提示**，不把一次作答拆成强制多次屏幕点击，也不记录个人口头答案。七类玩法维持合法人数、边界和目标模式；玩法机制变更如影响 signal/Coverage 计数须显式 D1～D8 delta Review。

## §7 AI 动态题 content contract

AI 每批请求需带**按本批可玩包和当前桌型算出的**主题配额、Heat×Intensity 合法格、信息目标（答后可复述谁的什么）、`socialEnergy`、`relationshipProgression`、Consent/边界与跨批语义去重约束；避免过量“第一印象 / 谁更吸引 / 谁最可能 / 谁想继续聊 / 泛化猜 TA”。配额先由蓝图和局级剩余缺口决定，不在 prompt 固定某个全库数量；批失败或过滤后应按缺口补齐，不能用热场题静默填满。生成卡继续过现有 schema/`safety-filter`、minPlayers、边界与强度过滤，并加内容质量抽检：逐批抽样看信息目标是否真实达成、揭晓是否存在、低尺度 H4 是否自然、重复是否过密；不合格重生/丢弃，不能把 AI 输出直接并入本地 SSOT。

`lib/ai/prompt-builder.ts` 的具体修改位：`9–13` 为结构化玩法提示补“本人揭晓/可选原因”与人数约束；`21–26` 在批目标、玩家/强度、玩法后插入主题/Heat×Intensity 配额及正交定义；`27–31` 在雷区与安全行补动作级 Consent、拒绝无惩罚、亲密态度与动作分开；`32` schema 样例及 `34–40` 结构化提示加入可验证的信息目标元数据或使用受控内部 sidecar。新增字段须同步 `lib/ai/card-schema.ts`、`lib/ai/normalize.ts`、`lib/ai/direct-provider.ts` 的批生成/解析及 `lib/ai/generate-deck.ts` 过滤链审查，避免 prompt 要求的字段被 parser 丢掉；若 UI 卡 schema 不应扩展，则质量 metadata 只在生成批 sidecar 中验证后剥离。现有 V1.0 “无新玩法时 prompt 逐字一致”注释/fixture 与新全局内容契约冲突，需显式更新测试，不能默改后声称兼容。禁止把真实姓名、单向秘密或 MATCH 细节发给 AI。

AI 候选卡也必须先具备 §4 的 `intimacyClass` 与 `informationGoalType`，通过同一互斥断言和抽样语义复核后才能进入后续过滤；若使用 §7 sidecar，剥离只发生在校验之后，并以 cardId/批次关联留痕，运行时卡 schema 无须为分类位扩展。

## §8 20 轮体验验收指标与校准

以下是**待 Research Reviewer 与 Human 校准的候选目标，不是冻结放行数字**。单位为实际 Session 的前 20 个 `sessionCompletedRounds`；关系主线专项另要求这 20 个均为 relationship-aware completed，不用 neutral 补数。逐局记录抽卡时 Heat、ceiling、玩法、主题、信息等级、social buffer、reveal 是否完成、人物维度以及最长连续低/0；内容评分先做双盲样本校准、分歧仲裁，不能直接沿用 A.2 逐题标签。

**计数归属固定**：Chemistry、Most Likely、Pointing 只要本人未揭晓（包括明确跳过），该 completed 轮标记 `socialBuffer=true`、`informationRound=false`，不计中/高信息轮；揭晓后仍按实际披露内容独立评分，不能因“已揭晓”自动给中/高。A.2 的 166 张（旧 350 的 47.4%）是**旧库候选池的静态分类数量**，不是本轮施工配额或 20 轮出牌比例；20%–30% 是**新库经真实 Router 出牌后**前 20 completed 轮中低信息高现场能量轮的运行时占比目标（约 4–6 轮）。两者分母、时间点和统计对象不同，须由内容映射、库存求解与 MC 实际出牌序列连接，不能把 166/350 直接与 4–6/20 对比当作达标证据。

| 候选指标 | 暂拟目标 | 校准方法 |
|---|---|---|
| 人物维度覆盖 | ≥5 个独立维度/20 轮 | 用 §5 独立主题，现场化学反应不算人物维度；按局分布与最差桌型看分位数 |
| 信息密度 | 中及以上 ≥8 轮，高信息目标 ≥3 轮 | 两人独立评“答后知道谁的什么”，仲裁分歧；未揭晓的猜人题不算高信息 |
| 低/0 连击 | 最长 ≤3 轮 | 对实际出题序列计算，不用全库比例替代 |
| 热闹缓冲 | 约 20%–30%（20 轮约 4–6 轮） | 仅按运行时低信息高现场能量轮算；现场评价/猜测不能成为主导 |
| 阶段与可玩性 | H1→H4 有明显深入感；I1/2/3/4/5 完整玩满 | 逐 Heat 题面盲排、4/5 人真人复盘与真实 Router 20/25 轮 MC，记录各档 Heat 曝光/结构断粮 |

校准用 §4 同一生产 Router MC 基本集≥120,000 局，按桌型×ceiling×MATCH×20/25 分层报告均值、P10/P50/P90 与失败 trace，单包、Single-Anchor、skip/swap/边界压力集单列；先用真人样本对“高/中/热场”标注口径与 H1→H4 深入感校准，再决定逐局通过率及最终阈值。不能把模拟 120,000 局说成真人体验通过；RG-02/03 仍需现场完成。

## §9 强制 Design Delta / Misuse Review 准入门禁

Phase B **每一项**涉及状态机、自动推进、隐私、Consent、默认行为、权限或数据生命周期的变更，Builder 提交前写 delta；Reviewer 逐项回答以下七问，缺一项或只写“无风险”无证据即不得进 QA：

1. 删除了什么旧保护？
2. 新设计新增了什么假设？
3. 用户慢一步会怎样？
4. 错的人操作会怎样？
5. 重复点击、离开或切后台会怎样？
6. 崩溃恢复后会怎样？
7. 是否出现“需求实现正确，但设计副作用危险”？

**Reviewer 输出模板（每个变更独立一份）**：

```text
Change ID / 受影响 D1–D8 条款 / 文件与状态迁移：
旧保护→新保护及证据：
新增假设及失效条件：
Q1 删除的保护：结论 / 代码或测试证据
Q2 新假设：结论 / 反例
Q3 慢一步：状态 / UI / 隐私结果 / 验证
Q4 错的人操作：状态 / UI / 隐私结果 / 验证
Q5 双击、离开、后台：状态 / 幂等与清理 / 验证
Q6 崩溃恢复：持久化与默认可见状态 / 验证
Q7 设计副作用：最危险反例 / 处置 / 验证
Verdict：PASS 或 BLOCK（blocking 条目、负责人、复验条件）
```

理由：Phase A.1 已出现“编排者越界写脚本而监督未识别”，Mutual 已出现“测试全绿而自动揭屏泄露下一位”。Reviewer 同时核**实际作者角色→文件归属**，并用慢操作、误操作和恢复 trace 审设计，不只审 happy path。

## §10 验证矩阵

| 层级 | 必测断言与证据 |
|---|---|
| 静态/内容 | 新 SSOT 逐卡 schema、hash/provenance、ID 唯一、Heat×Intensity 四档低尺度非空且合规；候选/旧题映射 `intimacyClass` 与 `informationGoalType` 均必填，`intimacyClass=action` 的卡不得同时以 `sexual_attitude_self_disclosure` 为主信息目标（非法组合 0）；旧 350 映射 350/350 有分类，已判定 24 张动作卡按原 ID 24/24 为 `action`、缺失 0，脚本输出全库与 30 张子集分布并由人工复核；AI 批配额/安全/去重抽检；D1–D8 delta 清单。 |
| Unit/Integration | Mutual 遮罩无 timer、无限等待、最后结果也需主动揭屏、stale pair 提交前拦截、取消/双击/卸载清理；内存 run 丢失或恢复三元/本人页面证明失败时整轮安全取消、结果/常规互选计数/公开选择均为 0，仅完整可验证三元可回对应本人 `HANDOFF_MASK` 且仍需主动揭屏。D8 awaiting 下 `switchPack`/`switchPackAndDeal` 原样返回，`startRound` 不得被 cardless 早返绕过、`drawV2SessionCard` 恒 AWAITING，所有 packId 均无法抽卡和切包；仅 finish/有效 reshuffle 解锁，cardless/neutral 不例外，reshuffle 预检与实际抽卡一致；P1#2 truth/dare 曝光回归不改排序。 |
| Monte Carlo | 使用真实 Router/编排器/reducer，按 §4、§8 的 seed、桌型、强度、MATCH、玩法、20/25、Single-Anchor/软去重/边界/skip 执行；零自动提强度、零跨 Heat、零以 neutral 续主线；逐局保存终止原因及失败 trace。另用随机状态序列/属性测试证明 awaiting 时 `startRound/drawV2SessionCard` 无法出卡、`switchPack/switchPackAndDeal` 对所有 packId 原样返回，cardless 与普通包同样成立。 |
| 真机 Mutual | 目标 11T Pro+ 实机：上一位持机长期等待（含锁屏/后台）下一位题面不自动出现；崩溃/进程重建或后台恢复后默认 entry-state 为**整轮已安全取消**，不得自动揭屏、不得出现任一人的 `SELECT`/`RESULTS`、结果/常规互选计数/公开选择均为 0；只有 §2 完整可验证三元及本人页面证明同时成立，才可落在同一 `cursor/playerId` 的 `HANDOFF_MASK`，仍须本人主动揭屏。另验本人揭屏一次、作答一次；错误人误触风险提示、最后 Host 揭结果、单向不留痕、无 MATCH 与多 MATCH cap、取消。先能力预检，再正式 QA。 |
| Exhaustion/恢复 | 人数/雷区/ceiling 导致 reshuffle 无合法卡时只见结束与固定文案，「洗牌再玩」按钮及占位均不存在；有效洗牌保留关系态，双击和 crash 后 cycle 不重复；awaiting 下 UI 决策面板优先于 cardless/normal-empty 及两类 exhausted，抽卡与切包均被守卫阻断；切包 UI、领域入口、cardless 路径同态；离线可操作。 |
| 全门禁 | typecheck/lint/unit/integration/E2E/build 与 Research Reviewer→Code Reviewer→QA→Supervisor 对应回执；Release 仍以 RG-01～RG-07 现场证据为准。 |

## §11 Release Gate、CONTENT-01 关闭条件

`CONTENT-01` 只有在以下**全部**满足后才可关闭：新内容 snapshot 经独立内容复审并可追溯；§4 的 lim1/2 关系主线 20/25 轮与逐包/压力场景没有结构性断粮；§8 经 Review/Human 冻结后的运行时体验阈值经真实 Router MC 达标且真人小样确认“认识到具体的人”；AI 动态题同合同并过安全/质量抽检；两条 blocking P1 的 Reviewer/QA/真机/状态机验收通过。任何一项未完成仍 OPEN，不能用静态全库比例或 A.2 配额代替。

`RG-01～RG-07` 保持 V2.0 原编号与 7/7 Release 门禁：RG-01 覆盖新 RC 真机离线/恢复/隐私；RG-02 是 4 人弱光完整真人局，**CONTENT-01 未关闭前 HOLD，不执行或宣称 PASS**；RG-03 验 5 人 20+5 节奏；RG-04 重点验主动揭屏、传手机与拒绝；RG-05 验 pair 降级/MATCH≤2；RG-06 验正常状态下 neutral/expansion 与拒绝 fallback，另在 awaiting 验禁止切包；RG-07 验 5 档/Consent/耗尽严格二选一。旧 `eeaebf3` 仅是历史 RC 证据，Phase B 修改生产内容、Mutual 或 D8 后必须重建重冻并重跑受影响 Gate。**不新增 CONTENT-02 或 RG-08**：两条新 P1 是 CONTENT-01 关闭和 RG-04/RG-07 的前置阻断项，单列新编号会重复统计；若 Reviewer 发现独立于内容且无法由现有 Gate 覆盖的新发布风险，再提 Human Gate 决定。

## §12 风险与回退

| 改动 | 主要风险 | 回退路径与 RC 影响 |
|---|---|---|
| Mutual 主动揭屏 | 增加一次操作；错误的人可主动点揭屏 | 保留无自动揭屏的安全遮罩并优化提示/按钮；**不得**回退 1.35s 自动揭屏。若仍不能现场保证隐私，阻断 Release。任何生产改动需新 RC、RG-01/04 重测。 |
| D8 严格 A | 无效洗牌后只剩结束，Host 体验受限 | 回退到“安全结束本局”单出口，不能恢复 awaiting 切包；若需 B，必须 Human 改 D8、新基线与 RC。改生产状态机需新 RC、RG-07/06 回归。 |
| 新内容矩阵/题面 | 语义重复、低尺度假深入、旧 Session/history 引用漂移 | 受控 snapshot + hash + 映射回滚；回退到上个已批准内容快照且保持历史 ID 策略，回退后 CONTENT-01 重新 OPEN，不能发布旧断粮矩阵。内容/SSOT/生成物变化需新 RC、全部内容与 RG-02/03 重验。 |
| 分玩法 reveal 机制 | 玩家被逼披露或口头规则难执行 | 恢复可选 reveal/安全跳过和旧玩法形态中的非侵入文案；涉及 signal/Coverage/D3–D7 时先 Human delta。生产玩法变更需新 RC、现场节奏复测。 |
| AI content contract | parser 丢字段、批失败、生成题同质化 | 在安全过滤通过的受控本地题继续离线开局；暂停 AI 新合同批次并修复，不以旧无配额 prompt 偷偷补题。若生产 prompt/parser/过滤链改动需新 RC、AI Matrix 与离线门禁复测。 |
| 体验阈值 | 标签可靠性不足、为达数字把游戏做僵 | 回到候选阈值、双盲重标及真人小样校准；不得靠改 Router 随机或放宽硬约束追数字。阈值文档本身不触发 RC，生产内容/路由调整会触发。 |

## §13 明确不做的事

不启动 Phase A.3/A.4；本轮不批量改 350 题、不重签 SSOT、不动业务代码、不重冻 RC、不 bump 版本、不执行 RG-02、不 commit/push。开发期也不自动提高用户 intensity、不回退 Heat、不绕过 Heat/人数/pair/MATCH/边界/Consent 硬过滤、不靠 neutral 凑关系主线 20 轮、不重做 P1#2 已关闭的随机系统、不用 A.2 五分类机械决定旧题去留、不把亲密动作算性观念、不自动猜测手机已交接、不加密码/生物识别、不把方案 B 偷偷实现。

## §14 Human Gate 开放问题清单

1. HANDOFF 原决策 1：当前已审查的 Mutual/A.2/收尾提交是否 push？本 Plan 不执行推送，待 Human 明确授权。
2. HANDOFF 原决策 2：是否批准本 Change C 的 Phase B 新内容基线与开发范围？本稿先经 Research Reviewer，Human 未批准前不得开 Builder。
3. HANDOFF 原决策 3：是否接受每人“**一次作答 + 一次本人揭屏**”，以及最后 Host 主动揭结果？建议接受，以隐私为先；按钮文字和初次遮罩可由真人小样校准。
4. HANDOFF 原决策 4：确认 D8 采用严格 A；方案 B 若要增“切包继续”作为第三决策，须单独定义 awaiting/cycle/used/Heat 的保持或清理并明确批准，不能在本稿 A 实施中夹带。
5. HANDOFF 原决策 5：§8 候选的 ≥5 维度、≥8 中+、≥3 高、最长≤3、buffer 20%–30% 是否经校准后冻结？Review/真人小样/MC 之前保留开放。
6. 待内容样本与库存求解后：七玩法的可选口头 reveal 和成年人亲密态度题的措辞上限是否符合现场舒适度？若改变已有 Consent、D4 pair 范围或 D7 保障，需要在此列出逐条语义 delta 再表决。**每格库存数由求解与证据产生，不要求 Human 猜数字。**

## §15 DEV_BASELINE 建议

Human Gate 批准并纳入 Research Reviewer 复审结论后，建议 `DEV_BASELINE=PRODUCT_PLAN_V2.1-CHANGE-C`，以本稿批准版及随后受控新内容 snapshot/hash 为 Phase B 唯一开发基线；旧 `PRODUCT_PLAN_V2.0` 留作冻结历史参照。当前 `PLAN_READINESS_SCORE` **未评分**，原因是新内容 snapshot、库存搜索、真实新库 MC 与真人校准尚未产生；不能继承 V2.0 的 83 分或伪造 ≥90。修完本轮 4 个纯文档 P1 后，**预期独立复评区间为 90–94/100，此为待核预测而非已获评分**；进入 `WAITING_HUMAN_APPROVAL` 必须由 Research Reviewer 按 `PRODUCT_PLAN.template.md` 七维重新给出实际 `PLAN_READINESS_SCORE≥90`，并确认 P0=0、blocking P1=0、关键事实已验证、核心假设已合理验证及模板 Gate 全条件成立。任一条件未过仍留 `PLAN_REOPEN_REQUIRED / PLAN_GATE=IN_PROGRESS`，不得仅凭预测分数转 Gate；Human 未明确说“第二阶段，开发”不进入 DEVELOP。
