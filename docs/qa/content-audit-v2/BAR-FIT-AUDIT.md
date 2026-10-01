# BAR-FIT 旧题审查（canonical 口径 + 逐卡对账 + forensic 标记）

- 基准：`DEV_BASELINE=PRODUCT_PLAN_V2.2-FIXED-CONTENT-FIRST`
- BAR-FIT 判据真源：`docs/pm/PRODUCT_PLAN_V2.2-FIXED-CONTENT-FIRST.md` §2
- 枚举真源（本文件用到的字段值）：同 Plan §3
- **唯一 canonical input**：`lib/v2-content/bar-fit-input.ts#toBarFitRuntimeInput`（正文（题面 text/content） + 玩家实际必须听到的 instruction（consentMode 渲染））
- 判定模块：`lib/v2-content/bar-fit.ts`（机器预筛；Plan §2 明说机器不能替代双人模拟噪声计时）
- 运行：`npx vite-node -c vitest.config.ts scripts/audit-bar-fit.ts`
- **本批不删任何题、不改任何题面**；机器结论仅为分流，最终定档以人工噪声计时为准。

## 零、口径与对账（Step 6，先读这一节）

- canonical input 唯一实现：`lib/v2-content/bar-fit-input.ts#toBarFitRuntimeInput`，四类消费方共用：
  audit 本脚本 / manifest `fixed-content-manifest-build.ts` / CI `build-fixed-content-manifest.ts` + 单测 / Human export 本产物。
- **逐 cardId 对账（fail-closed）**（manifest provenance 与本脚本 canonical 重算）：
  - **冻结固定库全量 443 ↔ manifest**：相比 **443** / 一致 **443** / 不一致 **0**（当前 manifest 口径，含第一包 24 张）。
  - 冻结 SSOT 快照 390 ↔ manifest：相比 390 / 一致 390 / 不一致 0（历史冻结口径，`sets.frozenFixed390` 同集合）。
- **text-only 只作 forensic**：`textOnlyForensic` 集 `forensic: true` / `admissionEligible: false`，
  **不参与 admission**。

## 一、总览（canonical 口径，分列 hard-fail 候选 / 人工复核池）

| 数据源 | 口径 | forensic | 题数 | PASS | SUSPECT＝复核池 | HARD_FAIL_PATTERN＝候选 |
|---|---|---|--:|---:|---:|---:|
| 冻结固定库 443（主线 403 + 扩圈 40）（`PN-*`） | canonical（正文+instruction） | 否 | 443 | 216 | 223 | 4 |
| 冻结 SSOT 快照 390（主线 350 + 扩圈 40）（`PN-*`） | canonical，历史冻结口径 | 否 | 390 | 164 | 222 | 4 |
| 内置种子 350（built-in-seeds，非固定库快照内）（`seed-*`） | canonical，非快照内 | 否 | 350 | 146 | 194 | 10 |
| 冻结 SSOT 快照 390（text-only） | **forensic，不参与 admission** | **是** | 390 | 271 | 115 | 4 |

> 冻结固定库全量 443 的 canonical 数字是**当前 manifest 口径**（与 manifest 逐卡对账一致）；
> 冻结 SSOT 快照 390 为历史冻结口径，两者差集＝第一包正式内容 24 张（`PN-TRUTH-201~224`，全部机器 PASS）。
> text-only 行仅历史对照，**作废、不得用于 admission**。

## 二、逐卡对账（audit ↔ manifest）

- manifest 来源：`lib/v2-content/generated/fixed-content-manifest.json → tracks.legacyCompatibility.provenance`
- 冻结固定库全量 443：相比 443 / 一致 443 / 不一致 0
  - 仅 manifest 有 0 / 仅 audit 有 0
- 冻结 SSOT 快照 390：相比 390 / 一致 390 / 不一致 0
  - 仅 manifest 有 0 / 仅 audit 有 0
- 无差异

## 三、冻结固定库 443（主线 403 + 扩圈 40）（canonical，当前 manifest 口径）

来源：`lib/v2-content/v2-card-bridge.ts → mainlineSsotCards()（403 张：SSOT 350 + 第一包 24 + R2 Bootstrap 候选 7）+ expansionSsotCards()（40 张）`

### 3.1 机器结论分布

| 机器结论 | 题数 | 占比 | 说明 |
|---|---:|---:|---|
| PASS | 216 | 48.8% | 无任何机器信号 |
| SUSPECT | 223 | 50.3% | **进入人工复核池**（不等于「题目有问题」） |
| HARD_FAIL_PATTERN | 4 | 0.9% | 命中硬失败类型 → **hard-fail 候选**（待人工定档） |
| **合计** | **443** | 100.0% | — |

### 3.2 人工定档分布（本批无人工审查）

| 人工定档 | 题数 | 占比 |
|---|---:|---:|
| UNREVIEWED | 443 | 100.0% |
| PASS | 0 | 0.0% |
| BORDERLINE | 0 | 0.0% |
| FAIL | 0 | 0.0% |
| **合计** | **443** | 100.0% |

### 3.3 按玩法分布

| 玩法 | 题数 | PASS | SUSPECT（复核池） | HARD_FAIL_PATTERN（硬失败候选） |
|---|---:|---:|---:|---:|
| compatibility | 50 | 5 | 45 | 0 |
| dare | 50 | 6 | 41 | 3 |
| expansion | 40 | 1 | 38 | 1 |
| pointing | 50 | 41 | 9 | 0 |
| statement | 50 | 34 | 16 | 0 |
| truth | 103 | 68 | 35 | 0 |
| vote | 50 | 34 | 16 | 0 |
| would-you-rather | 50 | 27 | 23 | 0 |

### 3.4 hard-fail 候选（`HARD_FAIL_PATTERN`）全量

| # | cardId | 玩法 | 题面摘要 | 命中规则 |
|---:|---|---|---|---|
| 1 | PN-DARE-005 | dare | 一个人在空中画一个简单图形，另一个人10秒内猜出来。 | HF-DRAW-GUESS |
| 2 | PN-DARE-016 | dare | 交换位置坐一轮，模仿一下刚才对方最典型的动作。 | HF-PERFORM-RECALL |
| 3 | PN-DARE-027 | dare | 两个人面对面站好，各自模仿一次对方今晚最有代表性的动作。 | HF-PERFORM-RECALL |
| 4 | PN-EXPAND-036 | expansion | 请一位愿意参与的人画一个简单图形或用手比一个形状，本桌一名自愿玩家来猜。 | HF-DRAW-GUESS |

### 3.5 人工复核池前 20 条示例（`SUSPECT`）

| # | cardId | 玩法 | 题面摘要 | 命中规则 |
|---:|---|---|---|---|
| 1 | PN-TRUTH-001 | truth | 看着系统指定的这位异性，说出你今晚最先注意到 TA 的一个细节。 | CF-READ-TIME-SOFT |
| 2 | PN-TRUTH-006 | truth | 如果只根据今晚的表现，你觉得这位异性属于主动型还是慢热型？让 TA 公布答案。 | CF-READ-TIME-SOFT |
| 3 | PN-TRUTH-009 | truth | 如果今晚第一次认识 TA，你觉得 TA 最容易给人留下什么第一印象？ | CF-READ-TIME-SOFT |
| 4 | PN-TRUTH-010 | truth | 说一个你现在有点好奇、但还不知道的关于 TA 的小问题，然后直接问。 | CF-READ-TIME-SOFT |
| 5 | PN-TRUTH-012 | truth | 你觉得这位异性在熟人面前和现在会有什么不一样？让 TA 自己揭晓。 | CF-READ-TIME-SOFT |
| 6 | PN-TRUTH-015 | truth | 你觉得这位异性属于“越认识越有意思”还是“第一眼就很有存在感”？为什么？ | CF-READ-TIME-SOFT |
| 7 | PN-TRUTH-017 | truth | 猜猜这位异性在喜欢的人面前会更主动还是更害羞，让 TA 自己回答。 | CF-READ-TIME-SOFT |
| 8 | PN-TRUTH-021 | truth | 在场异性里，谁是你觉得越聊越有意思的人？说出哪一段对话让你开始改观。 | CF-READ-TIME-SOFT |
| 9 | PN-TRUTH-022 | truth | 如果现在只能选择一位异性继续聊十分钟，你会选谁？你觉得你们还有什么没聊完？ | CF-READ-TIME-SOFT |
| 10 | PN-TRUTH-023 | truth | 在场哪位异性的聊天方式最容易让你继续想聊下去？说出 TA 哪一种回应方式最让你加分。 | CF-READ-TIME-SOFT |
| 11 | PN-TRUTH-024 | truth | 在场异性里，谁和你的第一印象相比“加分最多”？说出改变你判断的那个具体瞬间。 | CF-READ-TIME-SOFT |
| 12 | PN-TRUTH-025 | truth | 如果下一轮必须和一位异性组成二人队，你最想选谁？你觉得你们会在哪一点配合得最好？ | CF-READ-TIME-SOFT |
| 13 | PN-TRUTH-026 | truth | 哪位异性今晚有一个瞬间让你突然觉得“这个人挺有意思”？说出那个瞬间。 | CF-READ-TIME-SOFT |
| 14 | PN-TRUTH-027 | truth | 在场异性里，你最想知道谁对你的第一印象？先猜一句 TA 当时可能会怎么评价你。 | CF-READ-TIME-SOFT |
| 15 | PN-TRUTH-028 | truth | 如果今晚有一位异性主动来找你继续聊天，你最希望是谁？如果 TA 现在过来，你最想先聊什么？ | CF-READ-TIME-SOFT |
| 16 | PN-TRUTH-030 | truth | 在场异性里，谁最符合你喜欢的“聊天节奏”？具体说说这个节奏是什么感觉。 | CF-READ-TIME-SOFT |
| 17 | PN-TRUTH-031 | truth | 如果今晚结束后只有一位异性约你改天喝咖啡，你最希望是谁？说出一个让你愿意赴约的原因。 | CF-READ-TIME-SOFT |
| 18 | PN-TRUTH-032 | truth | 在场异性里，谁坐到你旁边继续玩，你会最开心？说出 TA 哪一点让你相处起来比较舒服。 | CF-READ-TIME-SOFT |
| 19 | PN-TRUTH-033 | truth | 今晚有没有一位异性让你怀疑过：“TA刚才是不是也在注意我？”如果有，是谁？ | CF-READ-TIME-SOFT |
| 20 | PN-TRUTH-034 | truth | 在场异性里，你现在最想知道谁到底是怎么看你的？先说一句你最担心 TA 误会你的地方。 | CF-READ-TIME-SOFT |

### 3.6 冻结 SSOT 快照 390（历史冻结口径，`PN-*`）

来源：`lib/v2-content/v2-content-adapter.ts → mainlineCards + expansionCards（冻结 SSOT 真源）`

| 机器结论 | 题数 | 占比 | 说明 |
|---|---:|---:|---|
| PASS | 164 | 42.1% | 无任何机器信号 |
| SUSPECT | 222 | 56.9% | **进入人工复核池**（不等于「题目有问题」） |
| HARD_FAIL_PATTERN | 4 | 1.0% | 命中硬失败类型 → **hard-fail 候选**（待人工定档） |
| **合计** | **390** | 100.0% | — |

## 四、内置种子 350（built-in-seeds，非固定库快照内）（`seed-*`，仅参考）

来源：`lib/game-packs/built-in-seeds/index.ts → BUILTIN_SEED_CARDS`

### 4.1 机器结论分布

| 机器结论 | 题数 | 占比 | 说明 |
|---|---:|---:|---|
| PASS | 146 | 41.7% | 无任何机器信号 |
| SUSPECT | 194 | 55.4% | **进入人工复核池**（不等于「题目有问题」） |
| HARD_FAIL_PATTERN | 10 | 2.9% | 命中硬失败类型 → **hard-fail 候选**（待人工定档） |
| **合计** | **350** | 100.0% | — |

### 4.2 按玩法分布

| 玩法 | 题数 | PASS | SUSPECT（复核池） | HARD_FAIL_PATTERN（硬失败候选） |
|---|---:|---:|---:|---:|
| compatibility | 50 | 20 | 30 | 0 |
| dare | 50 | 16 | 29 | 5 |
| pointing | 50 | 13 | 35 | 2 |
| statement | 50 | 25 | 25 | 0 |
| truth | 50 | 30 | 19 | 1 |
| vote | 50 | 26 | 22 | 2 |
| would-you-rather | 50 | 16 | 34 | 0 |

### 4.3 hard-fail 候选（`HARD_FAIL_PATTERN`）全量

| # | cardId | 玩法 | 题面摘要 | 命中规则 |
|---:|---|---|---|---|
| 1 | seed-truth-dare-truth-45 | truth | 点名在场一个人，说出你希望他/她今晚记住的一句话 | HF-HARD-MEMORY |
| 2 | seed-truth-dare-dare-5 | dare | 和一位玩家都同意后牵住对方的手十秒，十秒内谁先说话谁先笑 | HF-QUIET-DEPENDENT |
| 3 | seed-truth-dare-dare-9 | dare | 把手机交给在场一位玩家，让他/她替你选一首歌，你唱一句给对方听 | HF-EXTERNAL-DEVICE |
| 4 | seed-truth-dare-dare-16 | dare | 点名一位玩家，复述他/她今晚说过的一句话，越准越好 | HF-HARD-MEMORY |
| 5 | seed-truth-dare-dare-30 | dare | 选一位玩家，用他/她的名字即兴编一句押韵的口号，喊给他/她听 | HF-LIVE-CREATE |
| 6 | seed-truth-dare-dare-36 | dare | 让在场一个人出题，你现场演，由他/她猜是什么 | HF-THEATER-PERFORM |
| 7 | seed-most-likely-vote-7 | vote | 全场投票：在座谁最会把别人的小事记在心上？得票者当场复述在场每个人杯子里装的是什么 | HF-HARD-MEMORY |
| 8 | seed-most-likely-vote-21 | vote | 谁最可能心里最有数却不说？得票者现在说一句话，全场三秒不许出声 | HF-QUIET-DEPENDENT |
| 9 | seed-pointing-game-pointing-9 | pointing | 指一个你最想送对方一句话的人。说出那句话，由对方复述一遍 | HF-HARD-MEMORY |
| 10 | seed-pointing-game-pointing-34 | pointing | 全场一起选出在座最值得被更多人认识的那位，由本人用一句话介绍自己，全场跟着复述一遍 | HF-HARD-MEMORY |

### 4.4 人工复核池前 20 条示例（`SUSPECT`）

| # | cardId | 玩法 | 题面摘要 | 命中规则 |
|---:|---|---|---|---|
| 1 | seed-truth-dare-truth-1 | truth | 看着在场一个人的眼睛，说出你今晚最想让他/她知道的一句话 | CF-READ-TIME-SOFT |
| 2 | seed-truth-dare-truth-2 | truth | 选在场一个人，说出你第一眼看到他/她时闪过的真实想法 | CF-READ-TIME-SOFT |
| 3 | seed-truth-dare-truth-5 | truth | 当场对在场一个人说一句你一直没来得及说出口的感谢 | CF-READ-TIME-SOFT |
| 4 | seed-truth-dare-truth-6 | truth | 点名在场一个人，说出你今晚想多了解他/她的哪一件事，并当场问出口 | CF-READ-TIME-SOFT |
| 5 | seed-truth-dare-truth-8 | truth | 对在场一个人说一件你很少主动提起的、关于自己的事 | CF-READ-TIME-SOFT |
| 6 | seed-truth-dare-truth-9 | truth | 选在场一个人，说出你们之间最像的一处和最不像的一处 | CF-READ-TIME-SOFT |
| 7 | seed-truth-dare-truth-11 | truth | 在场谁给你的第一印象和现在差别最大？各说一件具体的事 | CF-READ-TIME-SOFT |
| 8 | seed-truth-dare-truth-17 | truth | 在场谁最容易让你放下手机？说出你注意到的具体表现 | BR-DEVICE-STEP |
| 9 | seed-truth-dare-truth-19 | truth | 给今晚这场聚会起个群名，灵感必须来自在场某个人，并点出是谁 | BR-LIVE-NAMING |
| 10 | seed-truth-dare-truth-20 | truth | 选在场一个人，同时说出对方今晚最好看的一个瞬间 | CF-READ-TIME-SOFT |
| 11 | seed-truth-dare-truth-21 | truth | 对在场一个人说出你对他/她的一句真心话，说完看着对方三秒 | CF-READ-TIME-SOFT |
| 12 | seed-truth-dare-truth-26 | truth | 对在场一个人说一句你今晚才想明白的话 | CF-READ-TIME-SOFT |
| 13 | seed-truth-dare-truth-28 | truth | 对在场一位原本不认识的人提一个低门槛问题，先问对方愿不愿意回答 | CF-READ-TIME, CF-LONG-INSTRUCTION |
| 14 | seed-truth-dare-truth-33 | truth | 选在场一个人，说出你在他/她身上看到、但从没告诉过他/她的一个优点 | CF-READ-TIME-SOFT |
| 15 | seed-truth-dare-truth-34 | truth | 当场向在场一个人提一个你一直想问的问题 | CF-READ-TIME-SOFT |
| 16 | seed-truth-dare-truth-35 | truth | 和在场一个人同时说出：对方今晚最需要的一句话 | CF-READ-TIME-SOFT |
| 17 | seed-truth-dare-truth-42 | truth | 请一位不认识的人在本桌定一个规则，先问对方愿不愿意 | CF-READ-TIME, CF-LONG-INSTRUCTION |
| 18 | seed-truth-dare-truth-43 | truth | 选在场一个人，说出你最想和他/她一起去做的一件小事 | CF-READ-TIME-SOFT |
| 19 | seed-truth-dare-truth-50 | truth | 你收到过最难忘的一句夸奖是什么？把这句话送给在场一个人，并说明为什么他/她值得 | CF-READ-TIME-SOFT |
| 20 | seed-truth-dare-dare-1 | dare | 选一位玩家，先问出口，得到同意后给对方一个公主抱，数三个数再轻轻放下 | CF-READ-TIME, CF-START-ACTIONS-SOFT, CF-LONG-INSTRUCTION |

## 五、forensic 历史对照（text-only，**不参与 admission**）

来源：`同上 390 张，仅剔除 instruction`；口径：`forensic: true` / `admissionEligible: false`

| 机器结论 | 题数 | 占比 |
|---|---:|---:|
| PASS | 271 | 69.5% |
| SUSPECT | 115 | 29.5% |
| HARD_FAIL_PATTERN | 4 | 1.0% |

## 六、规则表（按机器分流分列）

| 规则 ID | 机器分流 | 规则名 | 判据 |
|---|---|---|---|
| HF-THEATER-PERFORM | HARD_FAIL_PATTERN | 剧场式表演（偶像剧／小品／方言／恋综名场面／现场演） | 要求现场当众演戏、演短剧、模仿名场面或方言表演；酒吧噪声下无法完成。 |
| HF-PERFORM-GUESS | HARD_FAIL_PATTERN | 先演后猜（你演我猜） | 由一人现场表演、他人猜测，属你画我猜同型；依赖安静观察与表演时间。 |
| HF-DRAW-GUESS | HARD_FAIL_PATTERN | 画／比划再猜（你画我猜） | 现场绘画、空中画图或比划后由他人猜；Plan §2 明列 PN-DARE-005 为此类 FAIL。 |
| HF-AD-PITCH | HARD_FAIL_PATTERN | 推销／编广告词 | 推销空气／椅子／不存在产品，或现场编广告词、带货；属剧场式创作表演。 |
| HF-LIVE-CREATE | HARD_FAIL_PATTERN | 现场创作（编词／押韵／写段子） | 现场编歌编词、押韵口号、顺口溜、写诗写段子；需要安静构思与创作时间。 |
| HF-HARD-MEMORY | HARD_FAIL_PATTERN | 复杂记忆／复述 | 复述他人原话、背诵、记住整桌信息（杯中内容／生日／顺序）；Plan §2 明列两例 FAIL。 |
| HF-QUIET-DEPENDENT | HARD_FAIL_PATTERN | 依赖「大家安静下来听」 | 要求全场安静、不许出声、比谁先说话、保持沉默；酒吧环境天然不满足。 |
| HF-LONG-PERFORM | HARD_FAIL_PATTERN | 长时间表演（整首／整段） | 唱整首、跳整段、完整表演一段；占用时间长且属复杂表演。 |
| HF-EXTERNAL-DEVICE | HARD_FAIL_PATTERN | 交出设备由他人操作 | 把手机交出去让别人替你选歌／点东西；外部操作叠加表演，Plan §2 明列 seed dare-9 为 FAIL。 |
| HF-PERFORM-RECALL | HARD_FAIL_PATTERN | 需要回忆的模仿／表演 | 模仿「对方刚才／今晚最典型的动作」，先回忆再表演，属复杂表演＋记忆。 |
| BR-SIMPLE-PERFORM | SUSPECT | 简单即时动作／模仿（疑似，进复核池） | 单个即时手势、跟着做、同步动作；机制仍简单，但动作门槛需人工复测。 |
| BR-MEMORY-SIMPLE | SUSPECT | 需要回忆／默记（疑似，进复核池） | 记住、记得、回忆、想起、复盘；非复述级记忆，但候选池仍需人工确认是否构成负担。 |
| BR-COUNT-RECALL | SUSPECT | 需要心算／清点（疑似，进复核池） | 心算、算账、数数；需要低头专注，与酒吧「马上能玩」冲突。 |
| BR-MULTI-STEP-FLOW | SUSPECT | 多步流程（疑似，进复核池） | 先…再…然后、第一步/第二步；显式三步以上流程会拉长上手时间。 |
| BR-LIVE-NAMING | SUSPECT | 现场命名（轻创作，疑似，进复核池） | 起个名字、取名字；轻量创作，不需要长时间构思但仍属临场生成。 |
| BR-DEVICE-STEP | SUSPECT | 需要动手机／设备（疑似，进复核池） | 打开手机、翻相册、看聊天记录；多一步外部操作，可能打断节奏。 |
| CF-READ-TIME | SUSPECT | 朗读超时（估算） | 朗读时长估算 > 15s → 只进人工复核池 |
| CF-READ-TIME-SOFT | SUSPECT | 朗读压线（估算） | 朗读时长估算落在 10–15s → 只进人工复核池 |
| CF-START-ACTIONS | SUSPECT | 动作数超限（估算） | 开场动作数估算 > 3 → 只进人工复核池 |
| CF-START-ACTIONS-SOFT | SUSPECT | 动作数压线（估算） | 开场动作数估算 = 3 → 只进人工复核池 |
| CF-LONG-INSTRUCTION | SUSPECT | 必需说明超长 | 必需说明 > 40 字 → 只进人工复核池 |

## 七、复核提示

- 机器预筛只覆盖词面与长度/动作估算；语义歧义、同义重复、Consent 与尺度审查仍需人工。
- `SUSPECT`（含全部 `CF-*` 与 `BR-*`）只是**人工复核池**，人工复核后可下调或直接判 PASS。
- `HARD_FAIL_PATTERN`（`HF-*`）是 Plan §2 硬失败类型的 **hard-fail 候选**，按 Plan §2「不做润色改写」——
  **本批只记录候选，不执行删除**，最终由人工定档并写 `humanBarFit`。
- 本产物为纯函数 + 固定顺序序列化，**逐字节可复现**（同输入重跑结果完全一致，无时间戳/随机数）。
