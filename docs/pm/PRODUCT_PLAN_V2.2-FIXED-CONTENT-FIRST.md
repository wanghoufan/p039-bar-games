# PRODUCT_PLAN V2.2｜Fixed Content First（Phase B Change C 重开规划）

## 0. 版本定位与治理

- `PLAN_VERSION=PRODUCT_PLAN_V2.2-FIXED-CONTENT-FIRST`；建议经 Research Reviewer 与 Human Gate 批准后以 `DEV_BASELINE=PRODUCT_PLAN_V2.2-FIXED-CONTENT-FIRST` 开发。V2.2 **取代** V2.1 Change C 的 Phase B 施工方向；V2.1 仅保留历史证据，不能与 V2.2 并列作为开发指令。V2.0 的 D1–D8 未被本稿明确变更的安全语义继续约束实现。
- 当前 `PROJECT_PHASE=PLAN_REOPEN_REQUIRED`、`PLAN_GATE=IN_PROGRESS`。本稿是设计草案，不能自评过 Readiness 或代 Human 发出「第二阶段，开发」。`CONTENT-01=OPEN`、`RG-02=HOLD_BY_CONTENT_01`、`RC_NEEDS_REFREEZE`。HANDOFF 里 ~~P1-MUTUAL-PRIVACY~~ 的「下一位主动揭屏」方案已被 Human 作废；保留 D5 核心隐私语义。另一 blocking P1 为 `P1-D8-AWAITING-EXIT`：严格方案 A，awaiting 时不得切包；无合法洗牌卡时隐藏「洗牌再玩」按钮与占位，只留结束本局。本稿不施工 D8。
- 目标用户：典型 4–5 人酒吧社交桌，主持人持机、逐人递手机。第一目标是**拿出一套在真实酒吧里真的有人愿意继续玩的题**，不是凑齐 350 题。

## 1. 根因与方向

真人试玩已证明：**当前题库即使 Router 完全正确，也只是更精准地把差题送给用户**。旧 350 题审查中低/0 信息 228（65.1%）、现场评价/猜测 132（37.7%），5 个主题经双人语义复核及第三方扫描均为 0；信息增量六轴交叉全一致仅 20.0%–31.4%，标签口径不稳，不能把 A.2 的 `40/82/166/60/2` 当施工配额。独立 Reviewer 复算旧库 `H4×I1=0`。真实 Router 4,000 局中 1,660 局（41.5%）关系主线断粮：lim1 全停在 H3 起点 8、lim2 全停在 H4 起点 13，属内容矩阵结构真空；41.5% 只适用于该 harness 的关系主线候选池，不能宣称 App 整体同概率无法继续。P1#2 Router 曝光偏斜已修，内容仍是 blocker。故先定内容规范、逐玩法做固定库，再用真实 Router 检验。

**正式主线验收期间 AI 动态出题暂停**：Phase B 以默认关闭、可回退的单一 `AI_MAINLINE_ENABLED=false` 运行时配置隔离，配置缺失亦视为关闭；`app/api/generate-session/route.ts` 在服务端拒绝生成请求，`app/generating/page.tsx`（组局页进入 `generating` 阶段的跳转也须覆盖）在进入前守卫并退回固定内容流程，`lib/ai/generate-deck.ts` 在出题函数入口再守卫，禁止任何绕过 UI 的调用装载 AI 候选。自包含版的 `lib/ai/direct-provider.ts` 中整局生成直连 `generateDeckDirect`（经 `directChatCompletion` 发往 Provider，绕过服务端），以及 `lib/ai/generate-deck.ts` 中经 `resolveDeckTransport` 进入同一直连链的 `refillPackInBackground` 后台补题，也必须受同一 `AI_MAINLINE_ENABLED` 键守卫，关闭时不得发出生成请求或把补题并入正式快照。`app/settings/ai/page.tsx` 若仍可设置 AI，不得借该设置覆盖正式主线开关。正式 session 的快照创建、离线恢复、Router 候选装载和每轮发卡均校验可追溯来源为已冻结固定库且 ID 属于同一快照；未知来源、AI 来源或混合旧缓存一律拒绝进入正式主线，不静默回退为中性卡。构建/CI 用固定库 manifest 对快照和 MC 输入作断言；线上与离线 E2E 分别尝试直调 API、打开 generating、恢复旧缓存及正常 20/25 轮，逐卡断言 `AI 来源卡数=0`、固定库快照外 ID 数=0，并分别断言服务端生成调用数=0、直连 Provider 生成调用数=0（覆盖自包含整局生成和后台补题，包含原生 HTTP 与 fetch 传输）；任一失败即阻断 CONTENT-01/RC。入口守卫和快照来源断言均须经 Design Delta 七问审查。AI 代码留存，不混入固定题库验收、Monte Carlo 固定库样本或真人局。固定题库成熟且 `CONTENT-01` 可关闭后，另立 AI 恢复设计；本轮**不设计、不生成、不扩写 AI 题**。恢复门槛：固定库各玩法冻结、雷区/Consent 与 BAR-FIT 全量过审、20/25 轮真实 Router 与真人局达标、Human 单独批准；AI 后续必须遵守同一 BAR-FIT、主题配额、Heat×Intensity 合法格、可复述信息目标、Consent/boundary 与跨批语义去重。验证须隔离批次做 schema/机器过滤、双人盲审、与固定库及跨批重复检查、分层 MC 和独立真人小样，失败不得进入正式候选池。

### 1.1 外部事实与竞品对照（2026-09-27，公开资料范围）

| 同类产品与可核事实 | 题目信息增量与低尺度深聊 | 雷区处理的公开证据 | 本项目据此采取的差异 |
|---|---|---|---|
| [We're Not Really Strangers 核心版](https://www.werenotreallystrangers.com/pages/how-to-play-core-game)、[产品页](https://www.werenotreallystrangers.com/collections/homepage-featured-products/products/not-really-strangers-card-deck) | 官方规则按 Perception→Connection→Reflection 三层提问，产品页有 Dig Deeper 卡引导多说；说明关系深入可靠自我披露和追问，而非增加肢体或露骨尺度。 | 所查官方玩法/产品页未说明逐题精确雷区标签或个人关闭后不出题；不能据此断言产品没有该机制。 | §4 给每题可复述的人物信息目标，§6 把 Heat 与 Intensity 分开求解，H4 仍要求 I1/I2 合法深题；不用“更敢玩”冒充“更了解”。 |
| [TableTopics 场景题组与示例](https://tabletopics.com/pages/sample-questions?limit=20) | 官方示例按聚会、约会、家庭等场景给开放式问句；有些题能引出经历/取舍，但公开页未给出逐题信息增量评分或“本人揭晓”计数。 | 所查页面展示题组/场景选择，未查到“精确标签＋用户关闭即不出”的运行过滤证据。 | §3 对卡标 `informationGoalType`，§8 仅把真实自述/揭晓计入人物维度，场景热闹题只作 buffer；不用题组主题名替代逐题信息审查。 |
| [Jackbox Quiplash 3](https://www.jackboxgames.com/games/the-jackbox-party-pack-7/quiplash-3)、[官方安全说明](https://support.jackboxgames.com/hc/en-us/articles/15794785491351-Are-your-games-family-friendly-What-are-they-rated) | 玩家为幽默提示写答案、全桌投票，偏现场表达与互动；官方资料未把获得人物自述作为验收目标，故不能拿投票热度代理信息增量。 | 官方列 Family Friendly 设置；Quiplash 3 还支持展示前审核、过滤粗话与仇恨言论。它过滤的是内容类别/玩家输入，公开资料不支持“每位玩家关闭某精确关系雷区后该题必不出”的结论。 | §3.1 仍用题面精确标签、任一关闭即禁、Consent 实时门禁；§2 的 BAR-FIT 单独控制酒吧噪声和行动负担，不把安全只交给现场主持人审核。 |

以上是官方公开规则/产品页的**功能对照，不是效果实验**；未实测竞品在酒吧噪声、低 ceiling 与多雷区组合下的完成率，也未验证它们的内部标签实现。对“精确标签＋关闭即不出”的外部缺口，Human Gate 可要求补一轮真实产品/规则实测；本稿只把它作为本项目的可验收设计，不声称市场独有。对应的 Plan 修改是 §3.1 精确过滤、§4 信息判据、§6 低尺度深题库存与 §8 真实回答口径，竞品资料不替代本项目真人小样。

## 2. BAR-FIT 酒吧适配硬门禁（第一份交付物）

环境基线：DJ/音乐吵、典型 4–5 人、有人微醺且情绪较高、不愿听长规则，不适合安静思考、复杂表演或现场创作。逐题问：**「在一个很吵的酒吧里，这道题能不能 10 秒内听懂并马上开始？」** 计时从 Host 朗读开始到玩家知道第一个动作；阅读正文和必需说明均计入，不能藏在 instruction 中。记录双审计员在模拟噪声下的理解秒数 `t`、开场动作数 `a`、是否依赖安静/回忆/创作/表演、争议理由。

| 值 | 可复核规则 | 处置 |
|---|---|---|
| PASS | 两名评审均 `t≤10s`、`a≤2`（听题后选择/作答算 1；必要同意确认可算第 2 步）、无需安静/工作记忆/现场创作/复杂表演；单句能解释如何开始 | 可进入该玩法的内容与安全复核；PASS 不等于自动放行 |
| BORDERLINE | 任一评审 `t=10–15s` 或 `a=3`，或噪声下有歧义但机制仍简单；无下列硬失败类型 | 暂不入正式库；删减说明或缩小动作后**重测整题**，Human 抽看后才可转 PASS |
| FAIL | `t>15s`、`a>3`、依赖安静/记忆/现场创作/复杂表演，或命中硬失败类型；任一严重安全/Consent 问题另按安全失败处理 | **BAR-FIT FAIL 直接删除，不做润色改写**；若将来提出新题，必须按新 ID、新机制独立入库，不把 FAIL 原题换词复活 |

机器抽检：按断句长度、动词链、`先…再…然后`、表演/创作/猜画/复述等词列疑似清单，逐卡校验 `barFit`、`t/a` 审查证据与 FAIL 不得进入 snapshot；机器不能替代双人模拟噪声计时。`≤10s`、动作数阈值是本稿候选，Human Gate 可调；类型硬失败不可用阈值豁免。

**首批已判定的旧题型 FAIL 清单（只读题面判定，非 350 张全量终判）**：`lib/game-packs/built-in-seeds/index.ts` 中 seed ID 由 `seed-${packId}-${type}-${index+1}` 派生，不能按完整 ID 字面 grep；按 `(packId, type, 1-based index)` 定位：`seed-truth-dare-dare-9`（`truth-dare,dare,9`；交手机选歌再唱，外部操作+表演）、`seed-truth-dare-dare-16`（`truth-dare,dare,16`；复述别人说过的话，依赖记忆）、`seed-truth-dare-dare-30`（`truth-dare,dare,30`；即兴押韵口号，现场创作）、`seed-truth-dare-dare-36`（`truth-dare,dare,36`；别人出题、现场演、再猜）、`seed-most-likely-vote-7`（`most-likely,vote,7`；复述每人杯中内容，记忆任务）；SSOT `PN-DARE-005`（空中画图+10 秒猜，画猜任务）、`PN-DARE-016`/`027`（模仿对方动作，表演任务）。`PN-DARE-002` 简单同步手势可作 BORDERLINE 复测，不能因“模仿”一词机械删除。凡偶像剧表演、即兴小品、推销空气/椅子/不存在产品、编广告词、方言表演、恋综名场面模仿、你画我猜、长时间表演、需要安静/记忆/复杂规则/现场创作的题型均直接 FAIL；旧库出现同型时按 ID 补删题清单和原文证据，不能仅以关键词一刀切无关题。

## 3. 固定题的 metadata 合同、雷区与质量判据

每题用稳定 `cardId` 关联题面、审计记录与受控快照；以下是**新固定题库的目标合同**，不是声称当前 V1.3 schema 已有这些字段。可以在构建前 sidecar 保存质量字段，但校验和追溯完成前不得剥离。字段变更须同步解析、校验、运行过滤、hash/provenance 与迁移；不直接挪用 AI `prompt-builder.ts` 的较窄合同。

| 字段 | 类型/枚举 | 必填 | 机器校验与人工判据 |
|---|---|---|---|
| `cardId` | 稳定唯一字符串 | 是 | 全库唯一；改语义开新 ID，旧 ID 映射留痕 |
| `gameType` | `truth/either_or/never_have_i/chemistry/most_likely/pointing/dare` | 是 | 合法玩法、人数和 targetMode 对应 |
| `text` | 非空中文字符串 | 是 | 长度/禁语抽检；独立审 BAR-FIT 与同义重复 |
| `topic` | §4 中 13 个人物主题之一，或 `live_chemistry`；单一主主题 | 是 | 枚举校验；可另存次主题但不得重复计主覆盖 |
| `heatMin/heatMax`（Heat） | 整数 1–4，`min≤max` | 是 | 只在合法 Heat 出卡；深度由问答内容而非露骨度判定 |
| `intensity`（Intensity） | 整数 1–5 | 是 | `intensity≤userCeiling`；尺度与 Heat 正交 |
| `boundaryTags` | 去重数组，§3.1 精确枚举，可多值 | 是，空数组合法 | 未知 tag 拒收；语义双审；命中任一关闭项即过滤 |
| `barFit` | `PASS/BORDERLINE/FAIL` | 是 | 正式快照只能 PASS；附 `readSeconds/startActions/noiseNotes` 审查证据 |
| `informationGain` | `zero/low/medium/high` | 是 | 以本人真实作答后能复述“谁的什么”评分；猜测未揭晓不算本人信息 |
| `informationGoal` | 一句可复述的目标陈述 | 是 | 不可填泛化“促进了解”；盲审与现场答案核对 |
| `socialEnergy` | `low/medium/high` | 是 | 评价、投票、指认的现场反应，和信息量分开 |
| `relationshipProgression` | `none/open/deepen/clarify_boundary` | 是 | 是否帮助关系从认识→理解→规则/边界，不能按尺度自动加档 |
| `intimacyClass` | `none/action/attitude` | 是 | 互斥。`action` 不可计入亲密/性观念态度覆盖 |
| `informationGoalType` | `self_preference/experience/relationship_rule/boundary_attitude/sexual_attitude_self_disclosure/live_observation/action_only/other` | 是 | 主目标只取一个；`action × sexual_attitude_self_disclosure` 非法 |
| `consentMode/targetMode/minPlayers/matchRequired` | 沿用受控 SSOT 合法枚举/布尔/整数 | 是 | 复用现有合法性、pair/MATCH/人数门禁，动作每次实时同意 |
| `secondaryTopics` | 主题枚举数组 | 否 | 不计主要主题配额；不得以次标签把动作计作性观念 |

### 3.1 雷区全集与运行过滤

用户开关沿用现有 `lib/domain/constants.ts` 的 10 个键及 `lib/domain/schemas.ts` 的 `BoundaryTag` 枚举，**扩展 V2 固定题的 `boundaryTags` 合同而不替换开关语义**。V2 现有 5 类 `relationship-sensitive/proximity/physical-contact/photo-optional/external-participant` 是泛安全元数据，其中与新 10 项重合的 `physical-contact` 同名合并；其余 4 项保留作风险/能力标签，不能代替精确开关标签。构建时可保留泛标签并允许精确标签并存；旧 V2 题需逐题补标，未审完不得进新正式库。精确全集：

| 标签 | 关闭项 | 语义 |
|---|---|---|
| `physical-contact` | `noPhysicalContact` | 要求或邀请身体接触；单纯谈边界不自动算接触 |
| `alcohol` | `noAlcoholPenalty` | 喝酒任务、罚酒、以酒量诱导，不应设计惩罚型题 |
| `ex-partner` | `noExPartners` | 前任/旧关系的经历、态度、比较；即使未索取细节也要标 |
| `sexual-history` | `noSexualHistory` | 性或两性经历、实践史；原则性的亲密边界不自动归此，但需审尺度 |
| `money` | `noMoneyIncome` | 收入、资产、财富与具体金钱披露 |
| `phone-privacy` | `noPhonePrivacy` | 查看/展示手机相册、聊天或其他私密内容 |
| `public-posting` | `noPublicPosting` | 发公开动态或对外公开内容 |
| `stranger-contact` | `noStrangerContact` | 联系/邀请非本桌陌生人 |
| `photo-video` | `noPhotoVideo` | 拍摄、录像、合照；仅摆姿势不拍照不自动标此，但可标 proximity |
| `social-account` | `noSocialAccounts` | 要求交换、关注、公开社交账号 |

伪代码：`validateKnownTags(card); if card.barFit !== PASS reject; if card.intensity > ceiling reject; if !(card.heatMin<=heat<=card.heatMax) reject; if any(card.boundaryTags ∩ enabledBlockedTagSet) reject; then apply existing minPlayers/targetMode/pair/MATCH/Consent/used/cooldown guards`。例：`ex-partner` 题在 `noExPartners=true` 时 **全部禁止出现**；一题可同时标 `ex-partner`、`sexual-history`，任一命中即禁。标签全集是语义类型，不设每个雷区 30 题配额；数量由高质量题实际决定。自定义雷区仍需人工审查/保守挡题，不伪称精确标签能自动理解自由文本。

## 4. 内容目标与 A.2 映射

用户所列是 **13 个人物内容维度 + 1 个现场化学反应缓冲维度**，共 14 行；不把现场评价当第 14 个人物认知维度。表中“正/反”是**主题判定短例**，不代表已过 BAR-FIT 或可直接入题库。A.2 的「显式 0」只在三层语义证据同为 0 的五类称“语义空白”；其它按候选/未独立证实标记。

| 主主题 | 内容定义；正例×2；反例×2 | A.2 映射 |
|---|---|---|
| 兴趣爱好 | 常投入的具体活动与原因；正「最近坚持什么爱好」「为什么爱摄影」；反「谁看起来会摄影」「今晚想和谁玩」 | 具体兴趣语义 2，严重不足；旧题多问别人而非本人 |
| 生活方式 | 作息、休息日、消费/社交节奏；正「理想周末怎么过」「忙完怎么恢复」；反「今晚谁最晚走」「猜 TA 熬夜做什么」 | 11 类缺口中单列，不能用现场猜测代替 |
| 性格·习惯·小癖好 | 本人的稳定行为倾向及触发场景；正「压力大时先做什么」「不自觉的小习惯」；反「谁笑得最多」「别人眼中的你最像谁」 | 旧现场观察多；本人稳定自述需新审 |
| 择偶偏好 | 关系选择标准与取舍；正「长期最看重哪种品质」「两种优点冲突选哪个」；反「今晚谁好看」「现在选谁」 | 11 类中的择偶标准，旧 A.2 不足 |
| 恋爱观 | 对承诺、确认关系、沟通的原则；正「怎样算开始认真交往」「意见不合先怎么谈」；反「今晚想和谁约会」「谁更会撩」 | 11 类恋爱规则拆出的价值观部分 |
| 相处规则 | 日常相处的具体协商办法；正「吵架后要多久冷静」「独处时间怎么约定」；反「谁最会安慰人」「现在对 TA 说我在」 | 11 类恋爱规则的可执行行为部分 |
| 吃醋·占有 | 嫉妒感受及尊重空间的处理；正「吃醋时会怎么说」「怎样处理不安全感」；反「谁最会吃醋」「故意让人吃醋」 | 三层语义复核 0，语义空白 |
| 异性朋友边界 | 与异性朋友相处的可接受边界；正「单独见异性朋友先沟通吗」「深夜倾诉怎么划线」；反「谁异性朋友多」「给陌生人发消息」 | 三层语义复核 0，语义空白 |
| 前任态度 | 对旧关系的原则与学习，不索取身份细节；正「会从旧关系带走什么经验」「如何看待与前任联系」；反「报前任姓名」「给前任打电话」 | 三层语义复核 0；所有相关题标 `ex-partner` |
| 底线·雷区 | 不可接受行为及冲突修复底线；正「撒谎到什么程度不能接受」「越界后怎样重建信任」；反「谁最危险」「揭别人秘密」 | 三层语义复核 0，语义空白 |
| 人生目标·理想生活 | 未来生活、城市、工作与选择取舍；正「五年后想在哪生活」「理想普通一天怎样过」；反「今晚谁最先走」「谁像成功人士」 | 三层语义复核 0，语义空白 |
| 亲密边界 | 舒适节奏、明确同意、停止规则的自述；正「靠近前希望怎么询问」「什么时候会说慢一点」；反「现在拥抱三秒」「强迫对视十秒」 | A.2 旧 30 中动作 24，动作不能抵边界态度 |
| 性观念·亲密态度 | 成年人对亲密与性的原则、价值和沟通态度；正「亲密节奏应如何协商」「怎样看待先谈边界」；反「现在牵手」「讲述具体性经历」 | A.2 旧 30 中余 6 也仅暧昧偏好/边界，**性观念自我披露仍空白**；不能自动把余 6 算覆盖 |
| 现场男女化学反应 | 当下互动、猜测与热场，仅缓冲；正「此刻谁最会接话」「猜谁最先破冰」；反「长期择偶标准是什么」「未来住哪座城」 | 旧现场评价/猜测 132；可保留少量，不计人物维度 |

`intimacyClass=action`（对视、靠近、拥抱、合照、整理衣领等）只计动作/Consent，不得归 `attitude` 或计入性观念；旧 A.2 的 24:6 拆分是复核起点，不是新库配额。新库按 ID 全量填 `intimacyClass` 与 `informationGoalType`，脚本断言非法组合 0，并双人盲审分歧样本。

Builder 在接入旧 V2 卡时须逐题复核 `lib/v2-content/v2-card-bridge.ts`的泛标签映射：`proximity` 不自动等于 `physical-contact`，`relationship-sensitive` 不自动等于 `ex-partner`；只有题面真实命中精确开关才写对应过滤标签。泛标签仅作风险/能力提示，逐题补标未审完不得入正式快照；用“仅贴近/对视、不接触”及“仅关系敏感、不涉及前任”反例断言关闭相应精确开关时不会误过滤。

## 5. 逐玩法审查、真人小样与冻结

**固定顺序**：真心话 → 二选一 → 我从来没有 → 默契测试 → 谁最可能 → 指人游戏 → 大冒险。每类独立经过 **审查 → Human 抽看 → 修正 → 冻结**，未冻结不得推进下一类；对该类新题单独出清单、BAR-FIT 证据、边界标签、信息目标、重复簇、Heat×Intensity 预库存。**宁可题少但能玩，不要为凑每类 50 题硬凑垃圾**。题量由高质量内容和 §6 求解决定，不预设 50；若独立可玩性不足则保持未冻结、补新的高质量机制题，不放宽门槛。

| 顺序/玩法 | 内容模板：怎样问出信息 | 题量建议及冻结判据 | 真人小样与依赖 |
|---|---|---|---|
| 1 真心话 | “你本人在具体场景会怎么选/为何/最近一次”，让本人自述兴趣→规则→价值；避免全问对 TA 评价 | 先做少量跨 H1–H4、I1/I2 样本，求解后扩；全部 PASS、主信息目标能由真实回答验证、雷区和重复复核完成 | 2 桌各 4–5 人、每桌 8–10 题口头试玩；记录听懂秒数、愿否继续；为后续玩法提供人物信息基线 |
| 2 二选一 | 两个真实、可区分的生活/关系取舍；选完可选一句原因，不强制追加点击 | 只留能区分偏好且不靠“猜别人”的题；冻结时两选项无伪差异、4 Heat 低尺度可用 | 2 桌各 6–8 题；与真心话查语义重述；用于多玩法 Heat 库存互补 |
| 3 我从来没有 | 可安全自述的经历/习惯；举手仅开场，本人可选一句经历或原因，拒绝无罚 | 冻结时“仅举手”不自动计中信息；实际披露能区分人物；避开酒罚/隐私诱导 | 2 桌各 6–8 题，记录自愿揭晓率与拒绝压力；低 ceiling 内容不可依赖性经历 |
| 4 默契测试（chemistry） | 先互猜一项本人偏好，Host 用固定中性话术邀请本人揭晓：“愿意说自己的真实选择吗？可以跳过。” | 冻结时只有猜测的题计 buffer、不计信息；揭晓题按实际内容评分，无强迫追问 | 2 桌各 6–8 题，记本人揭晓/跳过；检查 target/pair 合法性、MATCH 状态；与前三包信息题交替 |
| 5 谁最可能 | 全桌短投票后 Host 问被选本人实际情况，允许跳过，禁起哄逼答 | 冻结时不能只有人设猜测；本人未揭晓=buffer；场评不占主线多数 | 2 桌各 6–8 题；查被选者意愿与人数门槛，需已有足够人物认知才能问有根据的判断 |
| 6 指人游戏 | 一句具体场景指人，Host 邀被指本人确认/纠正；可跳过 | 冻结时不重复“谁最可能”的同一问法；未确认=buffer | 2 桌各 6–8 题；查指认压力、pair 与人数，需从前五包获得判断依据 |
| 7 大冒险 | 一步可立即开始的轻动作或双方同意的短互动；动作后可选一句真实感受，拒绝无罚 | 冻结时所有动作实时 Consent、BAR-FIT PASS；动作不能冒充亲密/性观念问答；禁表演创作型旧题 | 2 桌各 6–8 题；记录拒绝/尴尬与场地安全；MATCH/接触/拍摄依赖合法 pair 和对应雷区 |

小样数是**每玩法最低发现问题量**而非体验通过率的统计保证；每桌至少一名独立观察者，分开记录 Host/参与者耗时、信息可复述性、是否愿再玩、噪声影响。任一 FAIL、Consent 事故或明显逼答回到本类审查；BORDERLINE 修正后重新试玩。冻结需 Human 抽看该类 PASS/删题/争议清单与真实小样、Reviewer 复核、版本化快照；后续发现跨包重复或矩阵断粮可受控解冻该类，说明影响与复测范围。

首包冻结时把 BAR-FIT 主观边界沉淀为随快照版本化的正/反例库，至少覆盖“复杂表演”和“单句能解释如何开始”：正例是一句即可开始的本人取舍问答或简单同步手势，反例是即兴小品、连续模仿并让全桌猜、复述他人话；每例附题面、计时/动作证据、双审结论和 Human 争议处置，后续包按同一例库判定。

## 6. Heat × Intensity 正交与库存求解

Heat=关系聊得多深，Intensity=玩家愿接受的尺度上限。H4 必须有**大量高质量 I1/I2 题**，例如理想生活、冲突修复、异性朋友边界；不能用更露骨的题代替更深入的题。ceiling=1 的 H1/H2/H3/H4 各需足量 I1；ceiling=2 的 H1–H4 各需足量 I1/I2。不得自动提升用户开放度、降 Heat、跳过硬过滤或用 neutral 轮凑关系主线。

最小库存不是拍数。令 `x[p,h,i,t,b,m]` 为玩法 p、Heat h 可用、强度 i、主主题 t、雷区标签组合 b、pair/MATCH 条件 m 下的**唯一 PASS 卡数**；跨 Heat 一卡只占一张实体，运行时在一局最多消耗一次。对每个场景 `s=(20/25轮,桌型4/5人,ceiling1..5,开关组合,pair状态,MATCH 0..2,单包/混合,Single-Anchor,skip/swap)`，在生产 Router/编排器/reducer 中求前缀每步合法未用候选 `A_s(r;x)`。硬约束：所有目标场景的每个必需关系主线轮 `|A_s(r;x)|≥1`；BAR-FIT FAIL=0；雷区命中=0；ceiling/Heat/pair/MATCH/人数违规=0；不以中性卡代填。稳健约束：对种子/扰动分布，`P(完成目标关系轮数)≥q`、P10 候选余量≥`u`、内容体验指标达 §8 待冻阈值；`q/u` 经真人校准再由 Human 冻结。目标函数：最小化 `Σ实体卡 x`，同时惩罚重复簇、单主题/单包集中和过多 buffer；先求可行解，再做质量审查，不能为了最小数牺牲 BAR-FIT。

推导程序：① 只纳入逐玩法冻结 PASS 卡，记录 Heat 区间/Intensity/玩法/标签/目标模式；② 固定快照 hash 与 seed，枚举上述场景及边界最紧组合；③ 跑真实生产 Router MC 取每 Heat×ceiling×玩法的最大/分位消耗 `D`，加 skip/swap、软去重、pair gating、MATCH、Single-Anchor 的消耗余量 `S`；④ 求最低满足 `N_eligible(h,c,p,b,m) ≥ D(h,c,p,b,m)+S(h,c,p,b,m)` 且每步 `A≠∅` 的整数解，跨 Heat 共用 ID 用逐局去重约束而非重复相加；⑤ 扩卡后重跑，直到最差 trace、20/25 轮与体验约束均过。无历史扰动率时先作 skip/swap 各 0/5/10% 敏感性扫描，真人小样后替换先验。每格数字待求解，不继承旧 350 的分布。

| Heat | I1 唯一数 | I2 唯一数 | I3 | I4 | I5 | ceiling1 合法余量/最差 trace | ceiling2 合法余量/最差 trace | 单包与 MATCH/边界压力结论 |
|---|---:|---:|---:|---:|---:|---|---|---|
| H1 | 待解 | 待解 | 待解 | 待解 | 待解 | 待 MC | 待 MC | 待验 |
| H2 | 待解 | 待解 | 待解 | 待解 | 待解 | 待 MC | 待 MC | 待验 |
| H3 | 待解 | 待解 | 待解 | 待解 | 待解 | 待 MC | 待 MC | 待验 |
| H4 | 待解（旧库 0） | 待解 | 待解 | 待解 | 待解 | 待 MC | 待 MC | 待验 |

## 7. Mutual 交接与节奏（Human 新决定）

### 7.1 一次作答与最小实现差异

真实流程：Host 持机并逐人递交；本人看屏后**只作一次作答点击**。多候选直接点真实姓名，单候选标题明确真实姓名（现有 `今晚到现在，你愿意继续了解 {name} 吗？`），无含糊 TA。点击即提交、立即收起答案，只有中性完成态，不回显所选对象；Host 接回手机也看不到刚才选了谁；约 1 秒自动准备下一位。**不新增**“我拿到手机/确认身份/提交/已遮好”或主动揭屏步骤。

只读代码核验：`components/game/MutualCheckSheet.tsx` 现为一次点击即提交→`HANDOFF_MASK`，单候选实名、多候选实名按钮，遮罩不回显；`HANDOFF_MASK_MS=1350` 与 timer effect 是时长差。Phase B 最小开发与迁移清单：① 同步 `MutualCheckSheet.tsx` 的 `HANDOFF_MASK_MS` 至约 `1000ms`、timer/fake timer 与 `checkpoint` prop 注释或类型；旧 `9/14/19` prop 语义必须删除或重定义为新检查点，不得只改文案。② 同步 `app/game/page.tsx` 的 `checkpoint` 传入点、常规互选触发常量/唯一真源、due/consumed 状态及其持久化/恢复版本；读取旧存档时清除旧常规互选 due，已 consumed 不得转成新检查点待触发，迁移后最多一次中途互选，旧 session 不补触发旧频率。③ 同步 `lib/v2-relationship/v2-mutual-check.ts` 等互选领域函数、组局与游戏运行配置、`tests/e2e/v2-mutual-flow.spec.ts`、`tests/unit/v2-mutual-check.test.ts` 及单元/计时/持久化回归，覆盖新有效轮计数、旧存档、取消/恢复与最多 1+1 次。④ 同步新触发规则所依赖的常量、生成配置、文档/验收真源；对仓库全量搜索 `9/14/19`、`checkpoint`、`due`、`consumed`，逐命中登记为废止历史文字或新规则实现，不允许执行路径再引用旧检查点；更新 HANDOFF 中相关验收说明须由 TM 按文件归属完成。保留现有提交前 `mutualPairRunExists`+实时合法候选拦截、清除 draft/候选、卸载清理、取消本轮和末位结果路径。若实际现场发现 Host 不能稳定控制交接，停线回 Human 评估，不暗加揭屏。

真机判据逐条对应 Human 最新决定：Host 全程持机、只把手机递给当前作答者；本人只点击一次即提交并进入中性遮罩，Host 接回看不到所选姓名/答案；约 1 秒后下一位题面可自动出现，仅在 Host 已收回手机且再递给下一位时继续为 PASS。若上一位仍持机而下一位题面出现，记录交接流程事故并中止本轮互选，不把该场景写成“题面永不自动出现”的软件 PASS 判据。双击不得生成第二份答案或越过遮罩；切后台/卸载后不得回显或恢复单向选择；超慢交接必须由 Host 收回并中止本轮，不能让上一位继续观看下一位题面。HANDOFF 旧“上一位长期持有手机时，下一位题面永远不能自动出现”验收与新决定冲突，TM 必须在 Builder 开工前标作废并改为以上判据，QA 按新判据现场复验。D5：无上一步；单向选择只在内存且不落盘/不公开；双向才 MATCH，active MATCH≤2；取消本轮可用；stale pair 在提交前拒绝；崩溃丢失内存 run 时整轮安全取消，不重建单向选择。

### 7.2 先了解，再询问兴趣

旧 9→14→19→final 频率废止。唯一触发计数器为 `relationshipEffectiveCardCount`：仅已完成且实际产生 §4 可复述人物信息的合法关系主线卡使其 +1；发出但跳过、仅猜测未获本人揭晓、纯 buffer、neutral、无有效披露的 completed round 均不加。`completedRoundCount` 与界面 round 序号只计进度和 20/25 轮完局，不参与中途互选检查点；记录每次 +1 对应的卡 ID/实际披露结果供 MC 复算。20 轮基础局**中途最多一次**秘密互选：仅当 `relationshipEffectiveCardCount ∈ [12,14]`，且人物认识阈值已达、Heat≥H3、有合法候选 pair、无正在进行的互选/耗尽时触发；首次达到 12 后可在 13、14 重查，但到 `relationshipEffectiveCardCount=14` 仍未全满足就跳过本局中途互选，不在后续 completed round 补问。若收局时 `relationshipEffectiveCardCount<12` 则无中途互选。结束时最多一次最终互选，仅在认识阈值满足且候选合法时可提出；最终轮次和 Heat 资格由 MC 及 Human Gate 冻结，不能按旧 final 默认值偷跑。旧常规互选 due/consumed 逻辑按 §7.1 受控迁移，旧存档不得补触发旧检查点。

候选“认识阈值”：首次互选前累计**中及以上信息轮≥5、其中高≥1、人物维度≥3、至少两名实际候选各有本人披露**；全部是待校准目标，不宣称已实现。单锚桌型也须至少两名不同的、此刻合法的实际候选各有本人披露；若该桌型只有一名合法候选或第二名从未披露，就跳过中途互选，并仅在最终互选资格满足时再检查，不用锚点一人的披露冒充两人。每次 MC 用真实出牌和实际揭晓/跳过记录，在首次互选前截取 `informationRounds`, `topics`, `selfDisclosureByCandidate`, `heat`, `relationshipEffectiveCardCount`, `completedRoundCount`；按桌型、ceiling、pair/MATCH 与跳过压力报 P10/P50、阈值满足率、互选缺席率、20 轮完成率及中断耗时。MC 逐局断言触发点有效卡计数在 12–14 内，且所有前置条件均真；`completedRoundCount=12–14` 本身不得触发。若 MC 显示有效卡 12–14 时认识不足，就优先修固定内容/出牌构成，调整最终触发点须 Human Gate；不能频繁追问“喜欢谁”。最终互选不为达次数而强制出现。

## 8. 20 轮体验验收与校准

单位为一局前 20 个 completed rounds；关系主线专项另要求 20 个均为 relationship-aware，不能以 neutral 填数。先用双人独立标注、分歧仲裁与 4/5 人真人小样校准，再由 Human 冻结以下候选数值。逐局记录实际回答/揭晓（不存个人隐私原文）、Heat、ceiling、玩法、主题、BAR-FIT、信息量、buffer、延时和跳过。

| 指标 | 候选目标（未冻结） | 校准/统计口径 |
|---|---|---|
| 人物维度覆盖 | ≥5/20 轮 | 只计 §4 的 13 人物维度，每主题一局最多计一次；化学反应不算 |
| 中及以上/高信息 | ≥8 / ≥3 轮 | 答完能复述“谁的什么”；猜测未由本人确认不计；双盲评分后与真人复盘比对 |
| 最长连续低/0 | ≤3 轮 | 按真实出牌顺序及实际作答计算，不拿静态库占比替代 |
| 社交缓冲 | 约 20%–30%（约 4–6/20） | 低信息但高现场能量轮；未揭晓的猜测轮计 buffer；现场评价/猜测不成为主导 |
| Heat 深入感 | H1→H4 可辨 | 每档随机抽题，3 名不参与写题者盲排，候选 Spearman≥0.6，再问真人是否感觉关系推进；最终线 Human 定 |
| ceiling 可玩性 | I1/2/3/4/5 均可 20 轮；另验 25 轮 | 分层 MC + 真人覆盖，不自动升档、不跳 Heat；报完成率及失败 trace |
| BAR-FIT | **正式主线 FAIL 出现 0**，BORDERLINE 0 | snapshot 静态门禁 + 真实 Router 日志逐卡核对；真人计时 PASS 是否仍 ≤10 秒 |
| 愿意继续 | 每桌结束询问，候选多数人愿再玩 | 4/5 人不同熟悉度桌型分别记录；此项不能被 MC 替代 |

MC 至少覆盖 `2男2女/1男3女/2男3女/1女3男`，补充单锚桌型；ceiling 1–5、MATCH 未建/已建、20/25、七单包和混合、雷区组合、skip/swap，各分层固定 seed，报告局数、均值、P10/P50/P90、失败 trace 与快照 hash。可参考每基本格≥1000 seed，但实际局数由置信区间和稀有场景失败率决定。真人校准至少 4 桌 20 轮（4/5 人、陌生/熟悉、低/高 ceiling 分开），缺样本则保持候选指标，不假报达标。

## 9. 带门禁的执行顺序与回退

下表的 11 行是任务书 9 阶段速记的展开：把“完整固定库”从逐玩法冻结中拆出，把“AI 恢复设计”从正式主线验收后拆出；其余阶段顺序与门禁不变。

| 阶段 | 输入 → 产出 | 退出条件/责任 | 失败回退 |
|---|---|---|---|
| 1 固定内容规范 | 本稿、真人反馈→字段/信息判据与盲审表 | Planner 定合同，Research Reviewer 核，Human 批 | 回本稿修合同，不动旧库 |
| 2 BAR-FIT 规范 | 酒吧环境与旧题→rubric、首批 FAIL 清单 | Human 确认阈值；Reviewer 审边界；FAIL 清单有 ID/理由 | 争议题 HOLD，不能放行 |
| 3 第一类固定题 | 真心话样本→受控候选和小样 | 审查→Human 抽看→修正→冻结；BAR-FIT/信息/Consent 全过 | 退回真心话重选新题，不启动下一包 |
| 4 逐玩法冻结 | 前一包冻结→下一包，严格 §5 顺序 | 每包同一四步，Reviewer 与 Human 回执、独立小样 | 解冻当前包及受影响交叉包，保留版本差异 |
| 5 完整固定库 | 七包冻结快照→可追溯题库 | 所有题 PASS、去重、字段完整，Human 批快照 | 回对应玩法，不以垃圾题填洞 |
| 6 雷区复核 | 快照→多标签及关闭项矩阵 | 全卡双审、任一关闭标签 0 泄漏 | 回标签/题面审查并重签快照 |
| 7 Heat×Intensity 库存 | 冻结库→§6 求解表与最差 trace | ceiling1/2 全 Heat 有足量合法卡、20/25 约束可行 | 回对应玩法补优质低尺度深题，不改 Heat/ceiling |
| 8 Router MC | 快照+生产 Router→分层 20/25 报告 | BAR-FIT/边界违规 0、不断粮、体验候选经校准达标 | 定位内容/分布缺口，受控解冻内容；改 Router 须另走 Change C |
| 9 Mutual 节奏 | 出牌轨迹→首次互选前认知与打断报告 | 先了解后问达到 Human 冻结线、最多 1+1 次 | 回内容/时点方案，别恢复旧频率 |
| 10 真人局 | MC 合格快照→4/5 人弱光/噪声 20 轮小样 | 玩家愿继续、主持交接/Consent 安全、量化与访谈一致；`CONTENT-01` 关闭须 Reviewer/QA/Human 回执 | 回触发问题的玩法/标签/时点，重新 MC 与小样；RG-02 仍 HOLD |
| 11 AI 恢复设计 | 固定库通过→单独 AI 方案 | Human 新 Gate 才能启动，按 §1 同合同 | 保持 AI 隔离 |

### §集中验收汇总

供 Human Gate 逐行勾选；与上表同一退出条件，按任务书 9 阶段口径合并展开阶段 4＋5、10＋11，后两者内部仍各有独立门禁。下列“断言”是 Builder/QA 待实现或出具的机器验收口径，除明确写出的现有命令外，不冒称已有脚本。

| 阶段 | 产出物 | 退出条件 | 负责角色 | 失败回退 | 机器可验的验收命令或断言 |
|---|---|---|---|---|---|
| ☐ 1 固定内容规范 | 字段合同、信息判据、盲审表 | Planner 定稿、Research Reviewer 核、Human 批；旧库保持只读 | Planner／Research Reviewer／Human | 回本稿修合同 | 合同必填字段/枚举 schema 校验失败数=0；旧库证据对账 1,112 项通过（合同校验待实现） |
| ☐ 2 BAR-FIT 规范 | rubric、带 ID/理由的 FAIL 清单、正反例 | Human 冻结阈值，Reviewer 复核硬失败边界；争议题 HOLD | Planner／Research Reviewer／Human | 争议题 HOLD，不放行 | 每张入库卡 `barFit=PASS` 且 `t/a` 证据齐；FAIL/BORDERLINE 入快照数=0（待实现） |
| ☐ 3 第一类固定题 | 真心话候选、双桌小样、冻结快照 | 审查→Human 抽看→修正→冻结；BAR-FIT/信息/Consent 均 PASS | Builder／Research Reviewer／QA／Human | 回真心话补新题，不启动下一包 | 快照中逐卡必填字段/来源/边界合法，FAIL=0、未审题=0；双桌小样回执齐（待实现） |
| ☐ 4 逐玩法冻结＋完整固定库（原 4＋5） | 严格 §5 顺序的七包审查/小样、去重后的版本快照 | 每包先 Reviewer 与 Human 回执再进入下一包；七包全 PASS、去重和字段完整，Human 批完整快照 | Builder／Research Reviewer／QA／Human | 解冻当前及受影响交叉包，回对应玩法补新题 | 冻结顺序/七包回执齐、重复簇冲突=0、未知字段/未审题=0、固定库 manifest hash 可复算（待实现） |
| ☐ 5 雷区复核 | 全卡多标签、关闭项组合矩阵 | 双人复核；任一关闭的精确标签不得出题，Consent 不被宽松标签覆盖 | Builder／Research Reviewer／QA | 回标签/题面审查并重签快照 | 对每个关闭标签及组合断言 `selectedCard.boundaryTags ∩ disabledTags = ∅`；泄漏数=0（待实现） |
| ☐ 6 Heat×Intensity 库存 | §6 求解表、最差 trace、合法格库存 | ceiling1/2 全 Heat 足量合法卡；七单包与混合 20/25 轮约束可行 | Builder／Research Reviewer／QA | 回对应玩法补优质低尺度深题，不改 Heat/ceiling | 求解器逐必需轮合法候选数≥1、H4×I1/I2 可用，FAIL/雷区/越限/neutral 代填均=0（待实现） |
| ☐ 7 Router MC | 固定 seed 分层 20/25 轮报告、失败 trace | BAR-FIT/边界违规=0、不断粮；§8 候选指标经小样校准后达到 Human 冻结线 | Builder／Code Reviewer／QA／Supervisor | 定位内容缺口并受控解冻；若要改 Router 则另走 Change C | 分层覆盖 §8 的桌型/ceiling/MATCH/单包混合/skip-swap，逐 seed 无断粮与违规，报告快照 hash、P10/P50/P90（待实现） |
| ☐ 8 Mutual 节奏 | 认知/打断报告、迁移与真机回执 | 首次互选前认识阈值达到 Human 冻结线，中途≤1＋最终≤1，§7.1 Host 交接/隐私判据 PASS | Builder／Code Reviewer／QA／Supervisor／Human | 回固定内容或时点方案，禁止恢复 9/14/19 | `npm test -- --run tests/unit/v2-mutual-check.test.ts` 与 `npm run test:e2e -- tests/e2e/v2-mutual-flow.spec.ts`（实现更新后）；逐局断言有效卡触发点 12–14、旧 due 不补触发、重复提交=0 |
| ☐ 9 真人局＋独立 AI 恢复门（原 10＋11） | 4/5 人弱光/噪声真人 20 轮小样及 `CONTENT-01` 回执；另行 AI 恢复方案 | 真人愿继续、交接/Consent 安全、量化与访谈一致，Reviewer/QA/Human 同意关闭 `CONTENT-01`；AI 仍暂停，只有另一次 Human Gate 才能启动恢复 | Builder／Research Reviewer／QA／Supervisor／Human | 回触发问题的包/标签/时点，重跑 MC＋小样；AI 保持隔离、RG-02 保持 HOLD | 真人记录逐卡来源、跳过与计时并对 §8 冻结线复算；正式主线 AI 来源卡数=0、服务端及直连 Provider 生成调用数各=0；AI 恢复批准前 `AI_MAINLINE_ENABLED=false`（待实现） |

`mutual_due` 事件的 `dueCount` 新旧语义映射及取消/恢复路径幂等键沿用，移交 Builder 在阶段 8 任务书逐字段写清并纳入对应回归，不另立 Plan 项。

角色遵循 AGENTS：Planner 写本 Plan；后续内容/实现由 Builder，Research Reviewer 审产品，Code Reviewer 审实现，QA 测，Supervisor 复核，TM 统筹/Human Gate。任何开发需先经 Human 批准新版基线；本稿不派工。D8 blocking P1 另按严格 A 实施与验收，不因固定库计划而消失。

**H-TM 开工前阻断项（TM 文件归属）**：现有 `docs/handoff/HANDOFF.md` 同时有旧“遮罩不得自动消失/允许增加隐私揭屏”与 Human 新定“Host 持机、一次作答、不回显、约 1 秒自动推进”。TM 必须在 Builder 读 HANDOFF 派工前，按 §7.1 把旧修复原则及“上一位长期持有手机时下一位题面永不自动出现”的旧验收明确标为已作废留档，写入新真机判据；Supervisor 对照 Human 新决定确认两处旧句不再是有效指令。Planner 不修改 HANDOFF；未完成消歧则不派 Builder，不能把冲突留给 Builder 自行判断。

## 10. Design Delta / Misuse Review 准入口禁

凡涉及状态机、自动推进、隐私、Consent、默认行为、权限、数据生命周期的改动，Builder 提交差异，Reviewer **逐项回答 7 问并附反例和验证证据**；漏答或只写“无风险”即 BLOCK，不进 QA/Release。理由：已有两次“测试全绿但设计本身有漏洞”：编排者越界写脚本未被识别，以及 Mutual 定时推进的隐私副作用。Reviewer 还要核实际作者角色→文件归属。

```text
Change ID / 受影响 D1–D8 / 文件与状态迁移：
旧保护 → 新保护；新增假设与失效条件：
1 删除了什么旧保护？证据：
2 新设计新增了什么假设？反例：
3 用户慢一步会怎样？UI/隐私/计数验证：
4 错的人操作会怎样？验证：
5 重复点击、离开、切后台会怎样？幂等/清理验证：
6 崩溃恢复后会怎样？持久化与默认可见态验证：
7 是否出现“需求实现正确，但设计副作用危险”？最坏反例与处置：
实际作者角色→文件归属核对：
Verdict = PASS / BLOCK；阻断项、负责人、复验条件：
```

Mutual 1 秒自动推进虽是现状最小差异，也须明确验证 Host 持机假设、慢交接与误操作；D8 awaiting 的 UI/领域守卫、cardless 优先级、无效洗牌出口也须走七问。设计正确性与测试通过各自独立判定。

## 11. 风险、RC 与本轮明确不做

| 风险 | 应对与回退 |
|---|---|
| 题少导致单包/低 ceiling 断粮 | 不以 50 题凑数；按 §6 最差格补高质新题，冻结包受控重开、重新 MC |
| BAR-FIT 误杀/漏放 | FAIL 原题不润色；争议 HOLD、双审及 Human 抽看；漏放即从候选快照撤除并复跑受影响局 |
| 标签漏标导致雷区泄漏 | 快照下线或回滚到上个合规快照，重审多标签，边界矩阵重跑 |
| Mutual 1 秒交接失手 | 保留中性遮罩与内存清理；真人验证 Host 掌机。若不安全，停止此交互变更并回 Human，不偷加主动揭屏 |
| 新库重复/低信息 | 回对应玩法内容模板；重新盲审，不用调 Router 掩盖 |
| 旧 session/ID 漂移 | 快照/hash、ID 映射和迁移测试；失败时不混用新旧题库 |

**再次要求 RC 重冻**：生产题库/SSOT/生成物、运行过滤/Router、Mutual 定时与状态机、D8/UI、AI 主线隔离入口任一变更后均需新 RC 与受影响 RG 回归；仅本 Plan 文档编辑不触发。旧 `eeaebf3` 是历史技术证据，现状已 `RC_NEEDS_REFREEZE`，不能作为新内容发布候选。Phase B 最终完成前不得 bump 或宣称 Release。

**本轮明确不做**：不启动 Phase A.3/A.4，不批量改旧 350 题，不重冻 RC、不 bump、不执行 RG-02；当前不开始 AI 扩题；不改业务代码、题库、SSOT、账本、HANDOFF、V2.1 文档；不 commit/push；不自动提升开放度、不用露骨替代深度、不把亲密动作算性观念；不实施作废的主动揭屏，不恢复 9/14/19，也不以 A.2 的 40/82/166/60/2 为施工依据。

## 12. Human Gate 开放问题

1. 是否接受**每玩法宁少勿滥**、以质量和真实库存求解决定题量，不预设每类 50？建议接受；单包无法满足 20/25 时该包保持未冻结。
2. BAR-FIT 的 `≤10s`、开场 `≤2` 动作及 BORDERLINE 的 10–15s/3 动作阈值是否批准？硬失败类型一律删除是本稿安全门槛。
3. Mutual 中途仅一次（候选 12–14 有效轮，认识阈值不足则跳过）、结束最多一次及约 1 秒交接是否批准？最终互选轮次/Heat 资格须依据 MC 与现场证据再定。
4. AI 恢复门槛是否认可为固定库全门禁通过 + 单独 Human Gate；本轮保持暂停？
5. 20 轮候选指标（≥5 维、≥8 中+、≥3 高、低/0 连击≤3、buffer 20%–30%、各 ceiling 完局）校准后以什么数值冻结？
6. 是否批准 `DEV_BASELINE=PRODUCT_PLAN_V2.2-FIXED-CONTENT-FIRST`，并在 Research Reviewer 复审后由 Human 明确发出「第二阶段，开发」？本稿不自行跨 Gate。
