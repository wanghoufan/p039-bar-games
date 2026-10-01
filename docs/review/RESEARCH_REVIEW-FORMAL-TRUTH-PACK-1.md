# RESEARCH_REVIEW｜第一包 Formal Fixed 真心话（PN-TRUTH-201~224）逐卡人工级内容审查

- 角色：product-reviewer（显示名 Research Reviewer，**AI 角色，非真人物品审**）
- 日期：2026-09-28T12:35:50Z
- 被审内容源：`lib/v2-content/formal-truth-pack.ts`（24 张 `PN-TRUTH-201~224`，纯数据、零引用）
- 产出物：`docs/qa/content-audit-v2/BAR-FIT-HUMAN-REVIEW.json`（本单唯一被填写的人审输入）、本文件
- 分流参考（**不作为任何一条结论依据**）：`docs/qa/content-audit-v2/BAR-FIT-AUDIT.json#sets.frozenFixed414`

> ⚠️（2026-09-28 收尾补注，neat-freak；未改写原结论）本单三轮审查期间工作区改动**未 commit**；该批已随 `e49ee45` 提交并 push `main`。原文「未 commit / 未 push」为该时点事实，保留留痕。

---

## 0. 审查口径

逐卡判断三件事，**任一不成立即不得判 PASS**：

1. **安全红线（不可破）**：不得出现露骨性描写、强迫惩罚灌酒、隐私脱衣非自愿；涉及亲密/性观念必须可跳过、必须按 `intensity` 严格分档（I1 不得出现亲密/性相关内容；I4/I5 才可触及态度与边界）。
2. **BAR-FIT**：读起来别扭、像审讯、像道德评判、明显 AI 腔、或在酒吧里问出来会让气氛尴尬 ⇒ 不得 PASS。
3. **信息增量**：属「现场评价 / 猜测 / 空话 / 套话」的卡不得 PASS；须能问出具体生活细节、真实观念、真实边界。

另设 `BORDERLINE`（可读但入库前须重写或明确接受）：安全但尴尬感偏高 / 信息增量偏弱 / 与既有问题近似。

### 与机器档位的分工（Human 明令）

- 机器 `machineVerdict`（PASS/SUSPECT/HARD_FAIL_PATTERN）**只作分流参考**。本包 24 张机器档位实测 **全部 PASS**（`frozenFixed414` 中 `HARD_FAIL_PATTERN` 4 张为 `PN-DARE-005/016/027` 与 `PN-EXPAND-036`，均不属本包）。
- 「机器全 PASS」**不等于**人工 PASS。本单结论由逐条判读题面独立得出，与机器结果**不一致 4 张**（见 §2 汇总）。
- 机器预筛不产正式 `FAIL`（`bar-fit.ts` `CF-*` 规则为纯估算），本单亦未借机器结果替代任何判断。

### 审查者身份声明

- 本结论由 **AI 角色**（product-reviewer / Research Reviewer）产出，**非真人物品审**，已如实写入 `BAR-FIT-HUMAN-REVIEW.json` 的 `source`（`"product-reviewer(Research Reviewer, AI 角色) 第一包 24 张逐卡审查"`）、`reviewerKind: "ai-role"` 与 `note`。
- **⚠️ 未决口径冲突（不由本单自行放宽，留给编排者 / Human）**：C1-1 设计稿 §6 已指出，产物文案仍写「**真实人工审查**」——`FORMAL_FIXED_ADMISSION_REQUIREMENTS[2]`（`fixed-content-manifest.ts:218`）、`buildInfo.formalAdmission`（`build-fixed-content-manifest.ts:360-361`）、`assertHumanReviewConsistent` 报错文案（`fixed-content-manifest-build.ts:200-202`）。本单填 `reviewed=true` 会在**字面**上与「reviewed 必须表示真实人工审查完成」冲突。要么 Human 拍板接受「审查者身份以产物 `source` 如实标注（含 AI 角色）」，要么走 Change C 改文案 / 加 `reviewerKind` 字段。**本单不代决。**

---

## 1. 逐卡审查表

图例：`I` = `intensity`，`heatMax` = 关系 Heat 上限；机器档位取自 `BAR-FIT-AUDIT.json#sets.frozenFixed414`。

| cardId | 题面 | topic | I | heatMax | 机器 | **判定** | 理由（一句话） |
|---|---|---|---|---|---|---|---|
| PN-TRUTH-201 | 说一件你最近主动花时间去做的小事，具体到那件事本身。 | 兴趣爱好 | 1 | 1 | PASS | **PASS** | 口语自然、只要求一件具体小事，不评价不引导，能问出真实生活细节。 |
| PN-TRUTH-202 | 有没有一个爱好你坚持了很多年？说说它现在还在给你什么。 | 兴趣爱好 | 1 | 2 | PASS | **PASS** | 长期爱好＋它当下还在给自己什么，指向可复述的具体生活内容，非性格形容词。 |
| PN-TRUTH-203 | 下班或放学到睡前，你一个人最固定的一段安排是什么？ | 生活方式 | 1 | 4 | PASS | **PASS** | 答案必然是可核对的作息细节；I1 不涉亲密话题，分档正确。 |
| PN-TRUTH-204 | 你的活法里，哪些是自己选的、哪些是顺着别人期待？各说一件。 | 生活方式 | 2 | 3 | PASS | **BORDERLINE** | 安全且「各说一件」要求具体，但整体偏价值审视/人生访谈腔，酒吧现场易答成「我要做自己」式套话。 |
| PN-TRUTH-205 | 说一个小习惯，是熟人相处久了才会发现的。 | 性格·习惯·小癖好 | 1 | 1 | PASS | **PASS** | 限定为熟人相处久了才发现的小习惯，指向真实且不易套话的细节，现场自然不尴尬。 |
| PN-TRUTH-206 | 你在什么状态下会变得不像平时的自己？说一个最近发生的事。 | 性格·习惯·小癖好 | 2 | 2 | PASS | **PASS** | 「说一个最近发生的事」把抽象状态落成具体事件；有心理分析味但不构成说教或冒犯。 |
| PN-TRUTH-207 | 在关系里，什么事最容易让你没有安全感？说你自己的那一点。 | 恋爱观 | 2 | 3 | PASS | **BORDERLINE** | 安全感话题在 I2／近陌生人场景偏重、偏心理咨询腔；「说你自己的那一点」是冗余半句，且易得「怕被冷落」套话。 |
| PN-TRUTH-208 | 你觉得关系里喜欢和合适各占几成？说说你为什么这么分。 | 恋爱观 | 3 | 4 | PASS | **PASS** | 「各占几成＋为什么这么分」用可量化口吻逼出真实取舍与理由，不落空泛恋爱观口号。 |
| PN-TRUTH-209 | 你会被哪种人吸引？说一个具体行为，别只给形容词。 | 择偶偏好 | 2 | 2 | PASS | **PASS** | 「别只给形容词」直接封死套话，能落到看得见的具体行为。 |
| PN-TRUTH-210 | 闹别扭时你是当场说开还是先冷一冷？你希望对方怎么做？ | 相处规则 | 2 | 3 | PASS | **PASS** | 冲突处理方式＋对对方的具体期待，两问都指向可复述的行为模式，无审讯感。 |
| PN-TRUTH-211 | 关系里有没有你绝对不能接受的相处方式？说清一条。 | 相处规则 | 3 | 4 | PASS | **PASS** | 问本人硬边界而非评判他人；安全、无冒犯，信息增量实。 |
| PN-TRUTH-212 | 你会在什么情况下吃醋？说一件真发生过的，别用看情况带过。 | 吃醋·占有 | 2 | 3 | PASS | **PASS** | 明确排除猜测与套话，能问出真实吃醋触发点；无强迫、可跳过。 |
| PN-TRUTH-213 | 另一半和异性单独吃饭，你能接受到哪一步？说出你的分界。 | 吃醋·占有 | 3 | 4 | PASS | **PASS** | 要的是可执行边界而非态度；「异性朋友边界」属 Plan 明列缺失维度，价值高。 |
| PN-TRUTH-214 | 你有关系很好的异性朋友吗？你们会聊到什么深度？ | 异性朋友边界 | 2 | 3 | PASS | **PASS** | 能问出真实交往边界；「深度」略抽象但答得出来，不构成套话卡。 |
| PN-TRUTH-215 | 如果伴侣要你少和某个异性朋友来往，你会怎么办？说实话。 | 异性朋友边界 | 3 | 4 | PASS | **PASS** | 假设情境压出真实取舍（照做／拒绝／吵）；「说实话」略带压力但未构成强迫。 |
| PN-TRUTH-216 | 上一段关系结束时，你花最久才想通的是哪一点？ | 前任态度 | 3 | 4 | PASS | **PASS** | 问的是他自己总结出的那条结论，具体且不可套话；已标 `ex-partner`，符合 Plan §4。 |
| PN-TRUTH-217 | 什么时刻，上一段关系最容易又浮上来？说说那种时刻的样子。 | 前任态度 | 4 | 4 | PASS | **PASS** | 「说说那种时刻的样子」要画面而非态度；I4 与前任主题匹配，未越可谈边界。 |
| PN-TRUTH-218 | 关系里踩到哪条线，你会直接结束而不是再谈一次？说一条。 | 底线·雷区 | 2 | 3 | PASS | **PASS** | 问的是他愿意直接终止关系的那条硬线，答案具体、不评判他人。 |
| PN-TRUTH-219 | 你身上哪一点，是你希望对方永远不要拿来开玩笑的？ | 底线·雷区 | 3 | 4 | PASS | **PASS** | 自我敏感点＋明确边界，属真实可复述的本人信息；不涉他人隐私。 |
| PN-TRUTH-220 | 如果不考虑现实限制，五年后理想的一天你怎么过？从早到晚说。 | 人生目标·理想生活 | 2 | 4 | PASS | **BORDERLINE** | 内容安全且信息量大，但「从早到晚说」在酒吧现场要求长答案，易冷场或漂成理想生活作文。 |
| PN-TRUTH-221 | 你最想完成的一件事是什么？说说你已经为它做过的一步。 | 人生目标·理想生活 | 3 | 4 | PASS | **PASS** | 「已经为它做过的一步」把目标拉回可核对的行动，能问出是否真在动。 |
| PN-TRUTH-222 | 在亲密关系里，哪件事你希望对方一定先问过你？说一条。 | 亲密边界 | 5 | 4 | PASS | **PASS** | I5／`intimacyClass=attitude`，问的是要求对方先征得同意的边界；正是 Plan 缺失的亲密边界维度，可无惩罚跳过。 |
| PN-TRUTH-223 | 对你来说，亲密关系里最看重的是什么？说一个你的观念。 | 性观念·亲密态度 | 4 | 4 | PASS | **BORDERLINE** | 安全且属态度类，但「说一个你的观念」表述生硬（AI 腔），且「最看重什么」在 I4 高度易得「尊重／坦诚」式价值观套话。 |
| PN-TRUTH-224 | 如果你们对亲密的节奏不一致，你会怎么开口谈？说一句。 | 性观念·亲密态度 | 5 | 4 | PASS | **PASS** | 「说一句」要的是实际会说出的话，指向真实沟通习惯与边界表达；只触及态度与节奏分歧，不越红线。 |

---

## 2. 汇总

### 2.1 判定分布

| 判定 | 张数 | cardId |
|---|---|---|
| **PASS** | **20** | 201, 202, 203, 205, 206, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 221, 222, 224 |
| **BORDERLINE** | **4** | 204, 207, 220, 223 |
| **FAIL** | **0** | —— |
| 合计 | 24 | —— |

- **安全红线：24/24 全部无破**。无露骨性描写、无强迫惩罚灌酒、无隐私脱衣非自愿。
- **分档正确性**：I1（201/202/203/205）四张**均无**亲密/性相关表述，符合「I1 不得出现亲密/性相关内容」；触亲密/性观念的仅 222（I5，`attitude`）、223（I4，`attitude`）、224（I5，`attitude`），且 24 张 `consentMode` 全为 `skip-anytime`（卡面「不愿意可无惩罚跳过」），满足「必须可跳过」硬要求。
- **与机器档位不一致 4 张**（机器 PASS → 人工 BORDERLINE）：204 / 207 / 220 / 223。这是本单与 `machineVerdict` 唯一分歧点，也是「机器档位不得当人工结论」的直接证据。
- **A.1 零维度补齐情况**（对照 HANDOFF:21 的 8 类人物维度 2 类为 0）：`吃醋·占有` 2 张（212/213）、`异性朋友边界` 2 张（214/215）、`前任态度` 2 张（216/217）、`底线·雷区` 2 张（218/219）、`人生目标·理想生活` 2 张（220/221）——**已补齐**；另按 Plan §4 补 `亲密边界`（222）与 `性观念·亲密态度`（223/224），其中 223 判 BORDERLINE。
- **Heat 覆盖**（`heatMin` 全为 1，符合 disclosure 未落地前的规避约束）：H1 上限 2 张（201/205）／H2 上限 6 张／H3 上限 6 张／H4 上限 10 张。
- **与既有问题近似度**：24 张全部为「本人自述」句式，与既有 `PN-TRUTH-001~050`（全部为「看着/猜/选在场这位异性」的现场评价与指认句式）**无近似**。既有 50 张的 A.1 缺陷（现场评价/猜测 37.7%）在本包**未被复现**——本包 0 张现场评价、0 张猜测、0 张指认。
- **`boundaryTags` 抽查**：仅 216/217 标 `ex-partner`（Plan §4 要求前任题必标）；其余 22 张为空数组。本包无身体接触／饮酒／金额／手机相册／拍摄／陌生人／账号交换，与空标签一致，未见漏标。
- **⚠️ 上游已记录的未修缺口（不在本单职责，仅提示）**：`formal-truth-pack.ts:56-58` 交接说明 `SSOT_BOUNDARY_TAG_MAP` 目前只登记泛 5 项，C1-3 遇到 `ex-partner` 会 fail-closed 抛错。216/217 的准入依赖该映射被补齐。

### 2.2 我认为必须改题的 4 张

| cardId | 问题 | 建议改法（供 builder 参考，本单**未改任何代码/内容**） |
|---|---|---|
| **PN-TRUTH-204** | 偏价值审视/人生访谈腔；「哪些是自己选的、哪些是顺着别人期待」在酒吧现场极易答成「我要做自己」这类套话，与 A.1 判定的「空洞/说教」缺陷同类。 | 改为**具体事件锚定**、去掉二元评判框架：「最近一次有人对你的某个期待，你照做了还是没照？说说当时怎么决定的。」——保留 `informationGain=high` 与 `relationshipProgression=deepen`，但把答案从「立场」换成「一次具体决定」。 |
| **PN-TRUTH-207** | 「安全感」在 I2／近陌生人关系场景偏重且带心理咨询腔；尾句「说你自己的那一点」是冗余半句，读起来别扭（近 AI 腔）；易得「怕被冷落」套话。 | 删掉冗余尾句，并把抽象情绪换成**可观察的触发行为**：「伴侣半天没回你消息时，你一般会做什么？」（保留 `topic=恋爱观`、`deepen`）。若坚持问「安全感」，须至少降到同义更口语的说法并重估 I2 是否仍成立。 |
| **PN-TRUTH-220** | 「从早到晚说」在酒吧现场要求**长答案**，与本作 20 轮快节奏互斥；易冷场或漂成「理想生活作文」，即退回 A.1 判定的低增量形态。 | 保留「五年后理想的一天」这一好题眼，**把答案长度从一天压到三个节点**：「五年后理想的一天，从睁眼到睡前最想保住的是哪三段？」（`socialEnergy` 可由 `medium` 下调）。 |
| **PN-TRUTH-223** | 「说一个你的观念」表述生硬（明显 AI 腔，不像人说话）；「亲密关系里最看重什么」在 I4 高度易得「尊重／坦诚／信任」式价值观套话——属本单判定标准里明令不得 PASS 的「空话/套话」。 | 换成**具体取向 + 具体条件**，避免抽象价值观：「在亲密关系里，你会更受不了对方哪一点——是话少、还是各玩各的？」或「亲密关系里，你觉得必须先说清的是哪一件事？」前者是二选一具体化，后者是行为锚定。`intimacyClass` 保持 `attitude`、`informationGoalType` 保持 `sexual_attitude_self_disclosure` 不变。 |

> 以上 4 张若按建议重写并重新过一次人工审查，**预期可全部升为 PASS ⇒ formal fixed = 24**；本单不代改，须回 builder。

### 2.3 结论：`formal fixed > 0` 是否成立

**成立。**

- `reviewed = true` 的卡数：**24**（全部 24 张均已审查并给出非 `UNREVIEWED` 定档，`reviewed` 与 `humanBarFit` 严格自洽，已通过结构核对）。
- 其中 `humanBarFit = PASS`：**20**。
- 按 `satisfiesFormalAdmission`（`fixed-content-manifest.ts:301-309`）四条——`metadataStatus === "audited"`（本包 8 项必填质量字段逐卡齐全、strict 通过）＋ `reviewed === true` ＋ `humanBarFit === "PASS"` ＋ `payloadHash` 为 64 位 sha256——**预期 `formal fixed` = 20 张**。
- 4 张 BORDERLINE（204 / 207 / 220 / 223）预期被 `humanBarFitNotPass` 计入 `rejection`，**不入 Formal**。
- **FAIL = 0**，故不存在「因被判 FAIL 导致第一包无法全量入库」的情形：缺口是 4 张 BORDERLINE 造成的**部分入库**，不是全量失败。
- 机器档位全 PASS 与本单 PASS=20 的差异来源已查明：机器规则（朗读时长估算、动作数等）**看不见**「价值审视腔」「要求长答案」「AI 腔措辞」「套话风险」这四类问题——这四类只能由人工判读，故本单 4 张 BORDERLINE 全部落在机器覆盖不到的一侧。

**预期 `formal fixed` 会变成多少张：20（当前 `RC_NEEDS_REFREEZE` 口径下的 `formal = 0` 会变为 `formal = 20`）。**

### 2.4 未验证项（UNVERIFIED）与取证方法

1. **构建门禁未跑**：本单按任务书**未执行** `pnpm build:fixed-manifest`。`formal = 20` 是按 `satisfiesFormalAdmission` 逐条件推导的**预期值**，不是实测值。取证：由编排者跑 `pnpm build:fixed-manifest`，核对 `tracks.formalFixed.counts.total === 20`、`rejection.humanBarFitNotPass === 4`、`reconciliation` 逐卡一致 0 mismatch、两次构建 hash 一致。
2. **`reviewed=true` 的「真实人工审查」字面冲突未决**：见 §0 身份声明。取证：Human 拍板口径，或走 Change C 改 `FORMAL_FIXED_ADMISSION_REQUIREMENTS[2]` / `buildInfo.formalAdmission` / `assertHumanReviewConsistent` 文案、或新增 `reviewerKind` 字段。
3. **C1-3 桥接映射未验证**：`ex-partner` 目前不在 `SSOT_BOUNDARY_TAG_MAP`，216/217 的卡对象能否成功构造未验。取证：C1-3 落地后跑 `pnpm build:fixed-manifest`。
4. **人工结论的复现性**：本单为单次 AI 角色审查，无第二人交叉复核。A.1 已证明交叉校准一致率仅 20.0%~31.4%（`promotesUnderstanding` 轴最低 60.0%），故本单 PASS/BORDERLINE 界线**不宜当作已校准事实**。取证：另派一个 reviewer 角色独立复判同 24 张，比对两轮判定差异率（尤以 204/207/220/223 四张为焦点）。

---

## 3. 纪律与自检

- **本单只写两个文件**：`docs/qa/content-audit-v2/BAR-FIT-HUMAN-REVIEW.json`（就地填写 24 条）、本文件（`docs/review/RESEARCH_REVIEW-FORMAL-TRUTH-PACK-1.md`）。
- **零改动**：未修改 `lib/v2-content/formal-truth-pack.ts`、任何代码／脚本／SSOT／manifest 产物；未触碰 `docs/handoff/**`、`docs/pm/**`、`docs/model/TASK-MODEL-LOG.jsonl`、`docs/model/DISPATCH-LOG.jsonl`。
- **未 commit / 未 push**；未运行 `pnpm build:fixed-manifest`。
- **JSON 自检（`node -e` 实跑）**：`entries` 24 条 ✓；与 `formal-truth-pack.ts` 的 24 个 `cardId` **双向零差集**（无 missing / 无 extra）✓；每条 `reviewed` 为 boolean ✓；`humanBarFit` 均在 `PASS|BORDERLINE|FAIL` 枚举内 ✓；`reviewed === (humanBarFit !== "UNREVIEWED")` 全部成立（对齐 `assertHumanReviewConsistent`）✓；每条 `note` 非空 ✓；`PASS 20 / BORDERLINE 4` ✓；`reviewed=true` 计 24 ✓；`formal` 预期 20 ✓。
- **结构兼容**：`scripts/build-fixed-content-manifest.ts:59-71` 只读 `{ source, reviewedAt, entries }` 三个键并做最小形态校验，额外的 `reviewerKind` / `note` / `machineVerdictSummary` / `generatedBy` 字段**不参与构建、不影响校验**，可安全保留。

---

## 4. 第二轮复判（4 张重写卡）

- 复判角色：product-reviewer（Research Reviewer，AI 角色，同一审查口径）
- 复判时间：2026-09-28T12:48:29Z
- 触发：builder 按本报告 §2.2 的建议改法重写了 4 张的 `text` 与 `informationGoal`；`intensity` / `heatMax` / `topic` / `informationGain` / `relationshipProgression` / `intimacyClass` / `informationGoalType` / `boundaryTags` / `consentMode` 经核对**全部未变**（`formal-truth-pack.ts:211-238 / 298-325 / 675-702 / 762-789`）。
- 口径：仍为 §0 的同三条（①安全红线 ②BAR-FIT ③信息增量），**未因 builder 已采纳建议而放宽标准**；§1~§3 原内容一字未动，作为历史留痕。

### 4.1 复判结果总表

| cardId | I | 原题面（摘要） | 新题面（`formal-truth-pack.ts` 实读） | 原判 | **新判** |
|---|---|---|---|---|---|
| PN-TRUTH-204 | 2 | 你的活法里，哪些是自己选的、哪些是顺着别人期待？各说一件。 | 最近一次有人对你抱有期待，你照做了还是没照？当时怎么决定的。 | BORDERLINE | **PASS** ⬆ |
| PN-TRUTH-207 | 2 | 在关系里，什么事最容易让你没有安全感？说你自己的那一点。 | 伴侣半天没回你消息时，你一般会做什么？ | BORDERLINE | **PASS** ⬆ |
| PN-TRUTH-220 | 2 | 如果不考虑现实限制，五年后理想的一天你怎么过？从早到晚说。 | 五年后理想的一天，从睁眼到睡前，你最想保住的是哪三段？ | BORDERLINE | **PASS** ⬆ |
| PN-TRUTH-223 | 4 | 对你来说，亲密关系里最看重的是什么？说一个你的观念。 | 在亲密关系里，你更需要对方主动，还是更需要自己留点空间？ | BORDERLINE | **BORDERLINE** ⬅（维持） |

**复判后全包分布：PASS 23 / BORDERLINE 1 / FAIL 0。**

### 4.2 逐卡理由与对题面的具体意见

#### PN-TRUTH-204｜BORDERLINE → **PASS**

- **①安全红线**：无破。I2 不触亲密/性内容，非现场评价、非猜测、非指认。
- **②BAR-FIT**：通过。原判的最大问题「偏价值审视/人生访谈腔」已消除——新题面把「人生立场」换成「一次具体事件」，框架由「哪些是自己选的、哪些是顺着别人期待」这个二元价值评判改为「照做了还是没照」这个二值行为事实。读起来是普通人会说的话，无说教、无 AI 腔、现场不尴尬。
- **③信息增量**：通过。答案必然是一次可复述的真实决定（老板让加班／朋友让托事／家里让相亲／客户让返工……），「当时怎么决定的」进一步索要决策依据而不是立场。**原判「易答成『我要做自己』式套话」这一具体缺陷已不再成立。**`informationGain=high` / `relationshipProgression=deepen` 与新题面自洽。
- **对新题面的具体意见**（均不影响入库）：
  1. 「抱有期待」比「期待」书面一点，念出来略像转述文；口语替代：「最近一次有人让你做点什么，你照做了还是没照？」
  2. 末句「当时怎么决定的」用句号收尾而非问号，题面标点与全包其余卡不一致，建议统一成问号。
  3. 提问者可自然接「谁提的、他后来怎么看」把它延成两轮，但不必写进题面。

#### PN-TRUTH-207｜BORDERLINE → **PASS**

- **①安全红线**：无破。I2，只问行为不碰性内容；`consentMode=skip-anytime`。
- **②BAR-FIT**：通过。「安全感」这个抽象且带心理咨询腔的词被彻底移除，冗余半句「说你自己的那一点」也删干净了；「伴侣半天没回你消息时，你一般会做什么」是全包口语度最高的一句，像真人在问。尴尬度与说教感都明显下降，I2 档位现在匹配（比原题轻）。
- **③信息增量**：通过。答案只能落在可观察行为上——反复刷手机／追问／先睡／去喝酒／先忙自己的事／直接不管。行为可见、可复述，且不同的应对方式背后是截然不同的焦虑处理模式，**原判「易得『怕被冷落』套话」已不成立**。`informationGain=high` / `deepen` 成立。
- **对新题面的具体意见**（不影响入库，但建议记录）：
  1. 唯一残留风险是**隐含假设对方有伴侣**：单身、丧偶、或不愿谈前任的人会当场答不出，虽有 `skip-anytime` 兜底，但公开 `responseMode` 下连续跳过仍会扫兴。若要更稳，可把对象放宽为「重要的人」或「你等一条回复等半天的时候」。
  2. 「半天」是模糊量词，实际应答的人心里标准不一，可能各答不同的时长——这反而是好信息，不必量化。

#### PN-TRUTH-220｜BORDERLINE → **PASS**

- **①安全红线**：无破。I2，纯生活向。
- **②BAR-FIT**：通过。核心修复到位：**答案长度由「从早到晚说」压到「哪三段」**，原判指出的「酒吧现场要求长答案、易冷场、易漂成理想生活作文」这一具体缺陷已消除。「你最想保住的是哪三段」是取舍口径而非流水账罗列，量级与本作 20 轮快节奏匹配。
- **③信息增量**：通过。答出的三段即他真实的生活优先级排序，且「保住」暗示取舍，答不出真话的人会露馅。量化口吻（要三段）与已判 PASS 的 208（「喜欢和合适各占几成」）属同一手法，风格一致，不算突兀。
- **对新题面的具体意见**（不影响入库）：
  1. 硬指标「三段」在赶时间时可能只答一两句，答不满反而自然，不构成压迫，可接受。
  2. 「理想的一天」与「五年后」是题眼里最好用的部分，建议保留；`socialEnergy=medium` 在新题面下已属合理，**不需要**按上一轮建议下调为 `low`。

#### PN-TRUTH-223｜BORDERLINE → **BORDERLINE（维持）**

- **①安全红线**：无破。I4、`intimacyClass=attitude`、只触及需求取向不涉露骨，`consentMode=skip-anytime`，分档与可跳过要求都满足。
- **②BAR-FIT**：通过。原判的「说一个你的观念」这一明显 AI 腔已删除，新题面是自然口语，无尴尬、无线上教。
- **③信息增量**：**未通过——这是本卡维持 BORDERLINE 的唯一原因。**
  - 新题面是一道**封闭式二选一**：「更需要对方主动」vs「更需要自己留空间」。它既不要求理由、也不要求具体行为或具体场景，现场大概率只落回「要主动」或「要空间」**一个词**。听完以后，除标签外对这个人没有新增任何可复述的了解。
  - 缺陷形态被换掉了但没被消除：**从原版的「空洞套话（尊重／坦诚式价值观口号）」变成了「单薄标签作答」**。原判的「AI 腔」修好了，原判的「信息增量偏弱」没修好。
  - 旁证有二：其一，作者自己把本卡 `informationGain` 标为 `medium`，低于同主题 222/224 的 `high`；其二，`informationGoal` 写的就是「听到他在亲密里更需要对方主动，还是更需要自己的空间」——**目标本身自证它只需记下一个标签**。
  - 另有一层玩法风险：该二选一在逻辑上**不互斥**（想被主动并不排斥自己也要空间），现场容易从「答一句」滑成「两人辩论谁更黏」，把 `socialEnergy=low` 的自述题变成表态现场。
- **对新题面的具体意见**（第三轮建议，二选一即可）：
  1. **沿用本包已验证的 208 手法**：「亲密里，对方主动和自己留空间各占几成？说说你为什么这么分。」——量化后必然带出理由，直接解决「单薄」。
  2. 或锚定具体事件：「亲密里最近一次让你不舒服的是什么？发生过一次吗。」——把态度题换成事件题，与 212（吃醋）同款可靠。
  3. 若坚持保留现题面，**至少**追加一个追问条件（如「哪种情况下你会更想要对方主动」），并把 `informationGain` 由 `medium` 上调为 `high` 以自洽。

### 4.3 复判后结论：`formal fixed` 预期张数

- `reviewed = true`：**24**（24 张全为非 `UNREVIEWED` 定档，`reviewed` 与 `humanBarFit` 严格自洽）。
- `humanBarFit = PASS`：**23**（201~222、224；含本轮升入的 204/207/220）。
- 仍为 `BORDERLINE`：**1**（223）——预期被 `humanBarFitNotPass` 计入 `rejection`，不入 Formal。
- `FAIL`：**0**。

> **明确结论：按 `satisfiesFormalAdmission` 四条件推导，`formal fixed` 预期 = 23 张**（上一轮为 20 张，本轮 +3）。仍为**部分入库**而非全量失败，且只差 223 一张。此值为推导预期，**未实测**——`pnpm build:fixed-manifest` 由编排者执行，本单未跑。

### 4.4 复判纪律与自检

- **只改 2 个文件**：`docs/qa/content-audit-v2/BAR-FIT-HUMAN-REVIEW.json`（4 条 entries + 顶层 `source`/`reviewedAt`/`note`）、本文件（仅追加 §4，原 §0~§3 全部保留）。
- **零改动**：未修改 `lib/**`、`scripts/**`、`docs/handoff/**`、`docs/pm/**`、两本账本；未 commit / 未 push；未运行 `pnpm build:fixed-manifest`。
- **其余 20 条 entries 一条未动**。
- **JSON 自检（`node -e` 实跑）**：JSON 合法 ✓；`entries` 24 条 ✓；与 `formal-truth-pack.ts` 的 24 个 `cardId` 双向零差集 ✓；`reviewed === (humanBarFit !== "UNREVIEWED")` 24/24 成立 ✓；每条 `note` 非空 ✓；`PASS 23 / BORDERLINE 1 / FAIL 0` ✓。


---

## 5. 第三轮复判（223）

**时间**：2026-09-28T15:10:00Z ｜ **范围**：仅 `PN-TRUTH-223` 单张 ｜ **复判人**：product-reviewer（Research Reviewer）

### 5.1 本轮实际题面（实读 `lib/v2-content/formal-truth-pack.ts:766`）

> 亲密里，对方主动和自己留空间各占几成？说说你为什么这么分。

- `informationGoal`（同文件 `L783`）：听到他在亲密里给「对方主动」和「自己留空间」各分几成，以及他为什么这么分。
- 未变更字段（本轮逐项核对与二轮一致）：`intensity=I4`、`heatMin=1`、`heatMax=4`、`topic=性观念·亲密态度`、`informationGain=medium`、`relationshipProgression=open`、`intimacyClass=attitude`、`informationGoalType=sexual_attitude_self_disclosure`、`boundaryTags=[]`、`consentMode=skip-anytime`、`targetMode=system-opposite-sex`、`responseMode=public`、`fallbackPolicy=skip-card`。

### 5.2 三条标准独立复判

| 标准 | 二轮结论 | 三轮结论 | 依据 |
|---|---|---|---|
| ① 安全红线 | PASS | **PASS** | 只请对方陈述亲密节奏偏好与理由，不点名索取露骨细节、不引导具体行为复述；分档字段与二轮逐项相同，I4/attitude/skip-anytime 下无越档风险。 |
| ② BAR-FIT | PASS（腔调） | **PASS** | 「各占几成 + 为什么这么分」为开放量化题，无尴尬、无说教、无 AI 腔；量化要求给出配比而非站队，「对方主动 / 自己留空间」不再被压成互斥对立项，现场不会滑成辩论。 |
| ③ 信息增量 | **BORDERLINE** | **PASS** | 见 5.3。 |

### 5.3 第③条为何这次达标

- **二轮缺陷已消**：二轮判 BORDERLINE 的两条理由——「封闭式二选一不要求理由」「易滑成辩论」——在当前题面上均不成立。题面既强制给出**可比较的配比**，又强制给出**归因**。
- **现场可分辨的答案形态**：例如「三七开，对方主动我才确定他想要我」与「五五开，看当时状态」——两者在行为倾向与心理动因上明显不同，听完得到的是对方的**相处节奏与边界逻辑**，而不是「要主动 / 要空间」一个词。二轮点名的缺口（只有标签、没有理由）已被「为什么这么分」堵上。
- **与 208 同款手法**：208（已判 PASS）为「喜欢和合适各占几成，说说你为什么这么分」，本卡句式与信息结构一致，属已在同包内被验证过的量化题型。
- **信息增量档位自洽**：作者标 `informationGain=medium`（低于 208 的 high），与题面实际索取强度相称；`informationGoal` 已同步为「配比 + 理由」，题面与目标不再脱节（第二轮的脱节问题一并解决）。

### 5.4 判定与预期

- `PN-TRUTH-223`：**BORDERLINE → PASS**。
- 全包：**PASS 24 / BORDERLINE 0 / FAIL 0**（其余 23 条结论一字未动）。
- **明确结论：`formal fixed` 预期由 23 张变为 24 张**（本包 24 张全量入库，本单不再是「部分入库」，而是**全量 PASS**）。此为推导预期，**未实测**——`pnpm build:fixed-manifest` 由编排者执行，本单未跑。

### 5.5 复判纪律与自检

- **只改 2 个文件**：`docs/qa/content-audit-v2/BAR-FIT-HUMAN-REVIEW.json`（仅 223 的 `humanBarFit`/`note`，加顶层 `source`/`reviewedAt`/`note` 的第三轮句）、本文件（仅追加 §5，§0~§4 全部保留）。
- **零改动**：未修改 `lib/**`、`scripts/**`、`tests/**`、`docs/handoff/**`、`docs/pm/**`、两本账本；未 commit / 未 push；未运行 `pnpm build:fixed-manifest`。
- **JSON 自检（`node -e` 实跑）**：JSON 合法 ✓；`entries` 24 条 ✓；`reviewed === (humanBarFit !== "UNREVIEWED")` 24/24 成立 ✓；每条 `note` 非空 ✓；`PASS 24 / BORDERLINE 0 / FAIL 0` ✓。
