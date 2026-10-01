# PACK1-SKELETON-CLUSTER｜Formal 全池「同 answer-shape cluster」骨架审计

> 由 `scripts/audit-formal-truth-skeleton-cluster.ts` 生成（确定性：无时间戳 / 无随机量）；本文件是 `PACK1-SKELETON-CLUSTER.json` 的渲染。
> Formal 全池 `53` 张｜输入指纹 `936cd4095358226c…`（sha256 of cardId+题面）。

## 0. 结论（由实测派生）

对当前 Formal 全池 53 张统计：「选谁／点名对象」11 张（20.8%），其中「想…谁」同骨架 6 张；A/B 类（封闭选项）37 张（69.8%）；身体部位／身体接触 7 张（13.2%）；yes/no 2 张（3.8%）。同骨架「选谁」类占 Formal 全池 20.8%，已构成可感知的题面同质化风险。

- 第二包禁止继续大量堆「选谁」（同骨架点名对象类）——需要新的答案骨架分流。
- 本报告只出诊断：⛔ 不因「选谁」多而推翻这些卡，也不改任何卡片内容 / 准入 / 阈值（内容裁决属后续单）。

## 0.1 P2 登记：「选谁」骨架的收敛风险（审查登记事实 ＋ 机检计数分列）

> 来源：docs/review/RESEARCH_REVIEW-PACK1-FINAL-54.md §专项 2（选谁骨架 cluster）。

- **机检计数（本脚本现算）**：「选谁／点名对象」`selectWho` 共 **11 张**（251 / 252 / 255 / 257 / 273 / 274 / 275 / 276 / 279 / 280 / 281），其中同骨架子集 6 张。
- **审查登记的收敛子集（人读判定，7 张）**：251 / 257 / 273 / 276 / 279 / 280 / 281 —— 真人游玩高度收敛于**同一暧昧对象**。
- **最必然对**：280 vs 281（点歌 vs 共饮，几乎必同人）；273 vs 281（一起走 vs 一起喝完，极大概率同人）；279 vs 251（要微信 vs 第一眼注意，高概率同人）。
- **分流项（不计入收敛子集）**：PN-TRUTH-274（队友）；PN-TRUTH-275（对手）；PN-TRUTH-255（反向选择，答案天然不同）。
- **结论**：不退卡（9 张 hook 真值 ＋ 单卡质量均过线；弱卡不保送 ≠ 强行退卡凑数）。
- **限流建议（登记，不在本报告执行）**：第二包禁止继续大量堆「选谁」；建议后续单局内选谁类限流（如单局 ≤2 张）或 280 / 281 / 273 三选一轮换 —— 交编排者裁决，本报告不执行。

## 1. 骨架判定规则（可复算、可审计）

| cluster | 判据（正则 / 字段） | 说明 |
|---|---|---|
| `selectWho`（「选谁」／点名对象） | `谁\|哪位\|哪一位\|哪个人\|哪个微信` | 答案必须点名一个具体对象；`谁都` 为任指（如 233「看谁都顺眼」）不算；「哪种人／哪一类」属类型选择，不算。 |
| `selectWhoSameFrame`（「想…谁」同骨架（selectWho 子集）） | `(想\|要\|打算)(跟\|和\|给\|拉\|陪\|点给\|等)[^，。？!！]{0,6}谁` | 与「你想跟谁……／想拉谁……／想点给谁……」同一句式骨架；连接词（跟/和/给/拉/陪/点给/等）必须显式出现。 |
| `abChoice`（A/B 类（封闭选项骨架）） | `还是` | 题面把答案构造成「A 还是 B（／C）」的封闭选项（含两选一与三选一）。 |
| `bodyPart`（身体部位／身体接触） | `手\|肩\|头发\|腰\|颈\|耳\|唇\|胸\|背\|腿\|臂\|掌\|腕\|膝\|脚\|抱\|碰\|牵\|吻\|亲\|贴`, 或 planning 字段 `category === "body_preference"` | 词表刻意排除「头／眼／脸／嘴／身」等高频歧义词；category=body_preference 亦计入。 |
| `yesNo`（yes/no 类） | `吗？\|吗\?\|想不想\|有没有\|会不会\|是不是`, 或 planning 字段 `expectedAnswerShape === "yes_no"` | expectedAnswerShape=yes_no 亦计入。 |

> 规则只读**题面**与既有 planning 字段；⛔ 不引入未登记的相似度模型。逐卡可与 §3 表逐条对账。

## 2. 各类张数与卡号（派生）

| cluster | 张数 | 占比 | 卡号 |
|---|---|---|---|
| 「选谁」／点名对象（`selectWho`） | 11 | 20.8% | 251 / 252 / 255 / 257 / 273 / 274 / 275 / 276 / 279 / 280 / 281 |
| 「想…谁」同骨架（selectWho 子集）（`selectWhoSameFrame`） | 6 | 11.3% | 273 / 274 / 275 / 276 / 280 / 281 |
| A/B 类（封闭选项骨架）（`abChoice`） | 37 | 69.8% | 203 / 232 / 233 / 234 / 235 / 237 / 238 / 240 / 241 / 243 / 244 / 245 / 246 / 247 / 248 / 250 / 252 / 253 / 254 / 255 / 256 / 258 / 259 / 260 / 261 / 262 / 264 / 265 / 266 / 267 / 268 / 269 / 270 / 271 / 272 / 278 / 283 |
| 身体部位／身体接触（`bodyPart`） | 7 | 13.2% | 203 / 241 / 242 / 243 / 267 / 268 / 269 |
| yes/no 类（`yesNo`） | 2 | 3.8% | 239 / 257 |

> 「（`selectWhoSameFrame`）」是「选谁」的子集，**不重复计入总数**：它单独列出的是与「你想跟谁……」同一句式骨架的那批。

### 2.1 A/B 类按答案形状细分（派生）

| expectedAnswerShape | 张数 | 卡号 |
|---|---|---|
| （未登记） | 1 | 203 |
| binary | 26 | 232 / 233 / 234 / 235 / 237 / 238 / 240 / 241 / 243 / 244 / 245 / 246 / 247 / 250 / 254 / 255 / 258 / 260 / 261 / 262 / 269 / 270 / 271 / 272 / 278 / 283 |
| ternary | 10 | 248 / 252 / 253 / 256 / 259 / 264 / 265 / 266 / 267 / 268 |

> A/B 类共 37 张（含两选一与三选一）；上表按 planning `expectedAnswerShape` 细分，便于后续单判「二选一是否过多」。
> 近似命中（planning `expectedAnswerShape=binary` 但未用「还是」、故**未计入** A/B 类）1 张：282。

## 3. 逐卡明细（全 Formal 池）

| cardId | 档位 | category | shape | 命中 cluster | 题面 |
|---|---|---|---|---|---|
| 203 | H1 | — | — | abChoice, bodyPart | 睡前的最后半小时，你是刷手机，还是直接躺平？ |
| 205 | H1 | — | — | — | 说一个小习惯，是熟人相处久了才会发现的。 |
| 209 | H2 | — | — | — | 你会被哪种人吸引？说一个具体行为，别只给形容词。 |
| 227 | H1 | — | — | — | 说一样你最近反复安利给朋友的东西，再用一句话说服我们。 |
| 229 | H1 | — | — | — | 哪一类电影或音乐你怎样都提不起兴趣？说说你试过的那次。 |
| 232 | H1 | quick_know | binary | abChoice | 今晚你更想认识新人，还是放松一下？ |
| 233 | H1 | quick_know | binary | abChoice | 微醺之后，你是看谁都顺眼，还是越来越挑？ |
| 234 | H1 | quick_know | binary | abChoice | 你今晚是自己来的，还是被人拉来的？ |
| 235 | H2 | attraction | binary | abChoice | 第一眼更容易抓到你的是穿着还是气质？ |
| 237 | H2 | attraction | binary | abChoice | 你更容易被话多的人吸引，还是安静的人？ |
| 238 | H3 | flirt | binary | abChoice | 对方一直看你，你会回看还是装没看到？ |
| 239 | H3 | flirt | yes_no | yesNo | 今晚遇到有感觉的人，你会主动要联系方式吗？ |
| 240 | H3 | flirt | binary | abChoice | 有人主动坐你旁边，你是加分还是有压力？ |
| 241 | H4 | body_preference | binary | abChoice, bodyPart | 跟喜欢的人独处，你是越靠越近，还是越坐越远？ |
| 242 | H4 | body_preference | one_word | bodyPart | 第一眼，你最容易注意异性的哪里？ |
| 243 | H4 | body_preference | binary | abChoice, bodyPart | 对有感觉的人，拥抱还是牵手更让你心动？ |
| 244 | H1 | quick_know | binary | abChoice | 今晚到现在，有人约你去下一场，你是当场答应，还是说再看？ |
| 245 | H1 | quick_know | binary | abChoice | 在场你更像哪种：先开口的，还是等人来聊的？ |
| 246 | H2 | attraction | binary | abChoice | 你更吃哪种人：像你的，还是跟你完全不一样的？ |
| 247 | H2 | attraction | binary | abChoice | 你的心动是看一眼就来，还是越聊越有？ |
| 248 | H1 | quick_know | ternary | abChoice | 刚认识的人，你最受不了哪种：查户口、太热情，还是爱答不理？ |
| 250 | H1 | quick_know | binary | abChoice | 这一周攒的劲，你打算今晚一次放完，还是留着明天再放？ |
| 251 | H3 | flirt | short_phrase | selectWho | 这桌上，你第一眼先注意到的是谁？ |
| 252 | H2 | quick_know | ternary | selectWho, abChoice | 哪种局你会比平时放得开：全是熟人、半熟不熟，还是谁也不认识？ |
| 253 | H3 | flirt | ternary | abChoice | 有人当场要加你微信，你会直接给、先聊聊，还是推掉？ |
| 254 | H2 | attraction | binary | abChoice | 你更容易对哪种人上头：让你心跳的，还是让你安心的？ |
| 255 | H2 | quick_know | binary | selectWho, abChoice | 这桌谁最不能惹，他惹到你，你是当场说开还是先冷一冷？ |
| 256 | H2 | quick_know | ternary | abChoice | 哪种搭讪最容易让你没兴趣：太油、太急，还是一本正经？ |
| 257 | H3 | flirt | yes_no | selectWho, yesNo | 你想不想凑近谁，说句悄悄话？ |
| 258 | H3 | flirt | binary | abChoice | 你搭话一般怎么开：先自曝今晚干嘛，还是先抛个问题？ |
| 259 | H2 | quick_know | ternary | abChoice | 异性朋友半夜发消息，你多久回：马上、隔一会儿，还是第二天？ |
| 260 | H3 | flirt | binary | abChoice | 看到喜欢的人在跟别人聊，你会过去，还是忍着？ |
| 261 | H1 | quick_know | binary | abChoice | 现在是单身，还是已经有主了？ |
| 262 | H1 | quick_know | binary | abChoice | 被人夸的时候，你更吃哪种：夸到点上，还是夸得夸张？ |
| 264 | H2 | quick_know | ternary | abChoice | 拿你哪一点开玩笑最容易翻车：记性、口味，还是脾气？ |
| 265 | H2 | quick_know | ternary | abChoice | 今晚剩下的时间，你最想怎么用：再换一家、找人聊，还是回家睡？ |
| 266 | H1 | quick_know | ternary | abChoice | 你最近一直想抽空做的，是补觉、散步，还是看剧？ |
| 267 | H4 | body_preference | ternary | abChoice, bodyPart | 亲密里哪样最加分：先问一句、慢一点，还是抱久一点？ |
| 268 | H4 | body_preference | ternary | abChoice, bodyPart | 喜欢的人碰你哪一下最心动：手、肩，还是头发？ |
| 269 | H4 | body_preference | binary | abChoice, bodyPart | 亲密里你更想当主动的那个，还是等对方先？ |
| 270 | H2 | quick_know | binary | abChoice | 今晚你更想接着干杯，还是改喝点软的？ |
| 271 | H2 | quick_know | binary | abChoice | 今晚要是换个地方，你想去安静的，还是更吵的？ |
| 272 | H2 | follow_up_hook | binary | abChoice | 下一轮你想接着聊的，是刚坐过来的那位，还是你原本就在聊的那位？ |
| 273 | H3 | follow_up_hook | short_phrase | selectWho, selectWhoSameFrame | 这桌散了，你最想跟谁一起走？ |
| 274 | H3 | follow_up_hook | short_phrase | selectWho, selectWhoSameFrame | 要是分两组玩，你想跟谁一队？ |
| 275 | H3 | follow_up_hook | short_phrase | selectWho, selectWhoSameFrame | 下一轮你最想跟谁比一局飞镖？ |
| 276 | H3 | follow_up_hook | short_phrase | selectWho, selectWhoSameFrame | 你想拉谁陪你出去透口气？ |
| 278 | H3 | follow_up_hook | binary | abChoice | 最后一圈，你想先溜的是自己，还是等某个人一起溜？ |
| 279 | H3 | follow_up_hook | short_phrase | selectWho | 散场之前，你想把哪个微信当场要过来？ |
| 280 | H3 | follow_up_hook | short_phrase | selectWho, selectWhoSameFrame | 最后一首歌，你想点给谁听？ |
| 281 | H3 | follow_up_hook | short_phrase | selectWho, selectWhoSameFrame | 最后一段，你想跟谁把这杯喝完？ |
| 282 | H2 | attraction | binary | — | 撒娇和嘴硬，你更扛不住哪个？ |
| 283 | H2 | attraction | binary | abChoice | 你想当逗别人玩的那个，还是被别人逗的那个？ |

## 4. 口径与边界

- 「当前 Formal 全池」= 生产牌堆 ∩ manifest `formalFixedIdSet()`（不按 `PN-TRUTH-2*` 前缀推断）。
- 一卡可同时命中多个 cluster（如既有 A/B 又有身体词）；本表**不做互斥切分**，按命中即入。
- 逐卡 `text` / `category` / `expectedAnswerShape` 均来自只读内容源与 planning 元数据，未改动任何卡。

*本报告只出诊断，不改内容；产物可重复运行且字节稳定（`shasum -a 256` 自证）。*
