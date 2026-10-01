/**
 * A5｜第一包 REPLACE 19 张换向新卡（`PN-TRUTH-251 ~ 269`，**新 ID**；planning-only，先不进 Formal）。
 *
 * ## 这是什么
 * Human 2026-09-29 冻结的酒吧新内容基线逐卡审计（`temp/BAR-AUDIT-PACK1-31.md`）把第一包
 * `PN-TRUTH-201~231` 判为 KEEP 5 / REWRITE 7 / REPLACE 19。本文件是其中 **REPLACE 19 张**
 * （旧 `204 206 207 208 210 211 212 213 214 215 216 217 218 219 220 221 222 223 224`）的换向产物。
 *
 * ## 为什么换向 + 为什么新开 ID
 * 这 19 张旧卡的**方向本身不适合酒吧主线**：前任深聊（退出类 B）、长期伴侣规则（A）、
 * 复杂人生规划（C）、心理咨询式自我剖析（D）、抽象比例与开放论证。旧方向救不了，
 * 按审计与 HANDOFF 的 ID 规则**新开 ID**（旧卡逐字归档在
 * `lib/v2-content/archive/retired-truth-pack-2026-09-29.ts`，**禁止照搬题面 / 沿用旧问法骨架**）。
 * 只允许**主题邻接**：旧卡问「前任」，新卡可问「暧昧节奏」；旧卡问「关系比例」，新卡问「可判定的现场选择」。
 *
 * ## 逐卡对应（新 ID ← 旧 ID，档位；题面写法全部重写，只保方向邻接）
 * ```
 * 251←204(H3) 252←206(H2) 253←207(H3) 254←208(H2) 255←210(H2) 256←211(H2) 257←212(H3)
 * 258←213(H3) 259←214(H2) 260←215(H3) 261←216(H1) 262←217(H1) 263←218(H2) 264←219(H2)
 * 265←220(H2) 266←221(H1) 267←222(H4) 268←223(H4) 269←224(H4)
 * ```
 * ⚠️ A9-R6（2026-09-29 内容裁决）：`263` 因与 `278` 去重**已退役**（移出运行时，逐字归档在
 * `lib/v2-content/archive/retired-pack1-r6-2026-09-29.ts`），上表保留的是退役前的 ID 血缘；
 * 本批现为 **18 张**（号段 251~269 内缺 263），张数一律由 `PACK1_REPLACE_CARD_IDS.length` 派生。
 * 卡源按 `cardId` 升序排列（与 Golden 12 / 第一包 REWRITE 同约定），故档位在文件内交错出现。
 *
 * ## 本批承担的结构指标（A5 派工单 Part 2；覆盖口径见 `pack1-replace-matrix.ts`）
 * - `heatMin` 分布 **H1×3 / H2×8 / H3×5 / H4×3**（目标 H3≥4、H4≥3 —— 当前正式库存 H3/H4 ＝ 0，
 *   这两档是补库存主目标；⛔ 不为凑数抬 Heat，每张的档位都由题面真实深度决定）。
 * - 类别覆盖 `quick_know≥1 / attraction≥4 / flirt≥5 / body_preference≥3 / follow_up_hook≥12`。
 * - 与 `PN-TRUTH-244~250`（第一包 REWRITE 批）互补：`flirt` 与 `body_preference` 的覆盖
 *   **由本批独力承担**（REWRITE 批按 1:1 旧方向落 H1/H2，天然不含这两类）。
 *
 * ## 风格与安全（硬红线）
 * - 风格锚 = `lib/v2-content/golden12/` 的 Golden 12；硬风格 `≤30 中文字`、一口气念完、
 *   一题一个核心、最多两小句、无多层条件；优先 `binary/ternary/one_word/short_phrase`。
 * - 逐条遵守 `temp/GOLDEN12-REVIEW-2.md` §5.3 的 5 条模板使用约束：
 *   ①同档不同轴（见 `PACK1_REPLACE_AXES`）；②**禁「外观 A vs 外观 B」二元对照**；
 *   ③`followUpHook` **当场可兑现**（见 `PACK1_REPLACE_HOOK_REDEEM_LINES`）；
 *   ④H4 统一 I3、禁价值倒挂；⑤元数据随题面同源（`topic`/`intimacyClass`/`category`/`followUpHook` 自洽）。
 * - 全部卡 `consentMode="skip-anytime"`（不愿意可无惩罚跳过）。涉及**身体 / 亲密偏好**的卡
 *   （`category="body_preference"`，本批 267/268/269）在卡面注释写明
 *   「**偏好 ≠ 授权，后续动作需独立同意**」；`followUpHook` **≠ 身体接触授权**。
 * - 不露骨、不强迫、不盘问性经历、不把「偏好」写成「接触授权」；不引入前任回忆 / 长期关系规则 /
 *   人生规划 / 心理咨询式自我剖析（Human 冻结的四类退出项）。
 *
 * ## 与运行时 / 正式 schema 的关系（**本轮不改任何 schema**）
 * 本文件与 Golden 12 / 第一包 REWRITE 一样，只是**一个 planning-only 内容模块**，一个字节都不碰
 * `lib/v2-content/v2-types.ts` / `lib/domain/schemas.ts` / `v2-card-metadata.ts` / `v2-card-bridge.ts`。
 * `category` / `followUpHook` / `expectedAnswerShape` 是**设计期分类**，不进 Runtime / 正式 `GameCard`
 * schema（锁在 `tests/unit/pack1-replaces.test.ts`）。本单**不 admission、不进 Formal**。
 *
 * ## ID
 * 号段由 `scripts/audit-card-id-space.ts` 复算得出（上一单落地后全库最大 = 第一包 REWRITE 的 250，
 * 安全起点 = 251），**禁止自己猜号段**。
 *
 * ## A6 修正（2026-09-29，内容主审 `temp/PACK1-NEW26-REVIEW-1.md` 第 1 轮）
 * 主审判本批 `267 FAIL`、`255 / 258 / 259 / 262 / 263 BORDERLINE`、并独立查出 `257 vs 238`、
 * `258 vs 237`、`260 vs 245` 三对重复。A6 按主审 §7 逐张改（**只改题面 / 元数据，不动 ID / `heatMin` /
 * `heatMax`，唯一例外＝`263` 的 `intensity` 1→2 以修「档位高于强度」**）：
 * - `255` 绑现场＋指名（这桌谁最不能惹）；`257` 换「主动」骨架以断开与 Golden 238 的同骨架＋同逃逸口；
 * - `258` 换掉与 Golden 237 同源的选项族；`259` 修 `topic` 同源（改合法枚举 `相处规则`，
 *   并把「异性朋友」放回 `secondaryTopics`）；`260` 换轴换骨架以断开与 Golden 245 的同构；
 * - `262` 改「电影 vs 一句人话」；`263` 改「快散场留下聊完还是先走」；`267` 三项换当下可执行动作
 *   （脱离长期伴侣语汇）；`256 / 264 / 266 / 268 / 269` 修 `topic` / `secondaryTopics` 同源。
 * 兑现句（`PACK1_REPLACE_HOOK_REDEEM_LINES`）与轴（`PACK1_REPLACE_AXES`）随题面同步改。
 *
 * ## A7 修正（2026-09-29，内容主审 `temp/PACK1-ROUND2-REVIEW.md`）
 * Round-2 判 `267 FAIL` 已由 A6 修掉（本轮 PASS 候选）；剩 5 处按主审 §A/§F 整改
 * （**只改题面 / planning-only 字段，不动 ID / `heatMin` / `heatMax` / `intensity`**）：
 * - `256`：`category` `attraction` → `quick_know`（题面问**排斥偏好**，非吸引）。
 * - `258`：题面把「先夸」格让给 `283`，只留「自曝」轴（先自曝今晚干嘛 / 先抛个问题）。
 * - `262` / `264`：`followUpHook` `attraction` → `social_style`（哭点 / 玩笑雷点不是吸引钩）。
 * - `269`：与 `267` **撞「亲密节奏」轴** ⇒ 换轴到**主动权**（主动 / 等对方先），hook → `initiative`。
 * - `267` / `259`：**题面不动**，仅登记 **admission 时**要收的 `responseMode` / `boundaryTags` 取值
 *   （Part 4「只准备、不 admission、不改准入逻辑」）。
 */

import { type GoldenTruthCard } from "../golden12/golden-12-cards";
import { V2_SSOT_SCHEMA_VERSION } from "../v2-types";

/** 冻结 SSOT schema 版本；与既有内容源同源（不新造版本号）。 */
const SCHEMA = V2_SSOT_SCHEMA_VERSION;

/**
 * 涉及身体 / 亲密偏好时卡面必须写明的 consent 注释文案（与 Golden 12 同口径）。
 * 本批 `category="body_preference"` 的卡恰 3 张（267 / 268 / 269），故卡面恰三条该注释；
 * `tests/unit/pack1-replaces.test.ts` 按出现次数核验（删注释即红）。
 */
export const PACK1_REPLACE_CONSENT_NOTE =
  "偏好 ≠ 授权：本卡只收集偏好，任何后续身体/亲密动作需独立同意（consentMode=skip-anytime 可随时跳过）。";

/**
 * 第一包 REPLACE 换向新卡（`PN-TRUTH-251 ~ 269`，按 `cardId` 升序）。
 *
 * 以 `heatMin` 为档的结构：H1×3 / H2×8 / H3×5 / H4×3 —— 分布由内容自然决定，不机械均分
 * （逐卡档位见文件头对应表；理由见矩阵模块与 A5 报告）。
 */
export const PACK1_REPLACE_CARDS: readonly GoldenTruthCard[] = [
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-251",
    gameType: "truth",
    number: 251,
    text: "这桌上，你第一眼先注意到的是谁？",
    intensity: 2,
    heatMin: 3,
    heatMax: 4,
    relationStage: "signal",
    targetMode: "choose-opposite-sex",
    responseMode: "public",
    interactionType: "expression",
    consentMode: "skip-anytime",
    matchRequired: false,
    boundaryTags: [],
    fallbackPolicy: "skip-card",
    signalEffects: [],
    postAction: "none",
    // H3｜旧 204（有人对你抱有期待 / 当时怎么决定）→ 换向：把「人生决策复盘」换成对**眼前这张桌**的一问。
    topic: "live_chemistry",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道他在这一桌上第一眼先注意到谁",
    socialEnergy: "high",
    relationshipProgression: "deepen",
    intimacyClass: "none",
    informationGoalType: "live_observation",
    secondaryTopics: ["择偶偏好"],
    category: "flirt",
    followUpHook: "flirt_target",
    expectedAnswerShape: "short_phrase",
  },
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-252",
    gameType: "truth",
    number: 252,
    // A9-R7（2026-09-29 内容返工，RESEARCH_REVIEW-PACK1-FINAL-54 §1 252 行）：旧 C 选项
    // 「气氛一起来」与题干同义反复（何时放得开 → 气氛起来时）＝凑数选项 ⇒ C 改**具体场景**，
    // 三个选项统一到**同一个轴：局的熟悉度**（全是熟人 / 半熟不熟 / 谁也不认识），答案可比。
    text: "哪种局你会比平时放得开：全是熟人、半熟不熟，还是谁也不认识？",
    intensity: 2,
    heatMin: 2,
    heatMax: 4,
    relationStage: "know",
    targetMode: "choose-opposite-sex",
    responseMode: "public",
    interactionType: "disclosure",
    consentMode: "skip-anytime",
    matchRequired: false,
    boundaryTags: [],
    fallbackPolicy: "skip-card",
    signalEffects: [],
    postAction: "none",
    // H2｜旧 206（什么状态下会变得不像平时的自己）→ 换向：把「内在状态剖析」外化成「哪种场合」三选一。
    topic: "性格·习惯·小癖好",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道他在哪种熟悉度的局里会比平时更放得开",
    socialEnergy: "medium",
    relationshipProgression: "open",
    intimacyClass: "none",
    informationGoalType: "self_preference",
    secondaryTopics: ["生活方式"],
    category: "quick_know",
    followUpHook: "social_style",
    expectedAnswerShape: "ternary",
  },
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-253",
    gameType: "truth",
    number: 253,
    text: "有人当场要加你微信，你会直接给、先聊聊，还是推掉？",
    intensity: 3,
    heatMin: 3,
    heatMax: 4,
    relationStage: "signal",
    targetMode: "choose-opposite-sex",
    responseMode: "public",
    interactionType: "expression",
    consentMode: "skip-anytime",
    matchRequired: false,
    // 题面真实谈「加微信」⇒ 命中精确开关 `social-account`（社交账号交换），按 Plan §3.1「题面真实命中才写」标注。
    boundaryTags: ["social-account"],
    fallbackPolicy: "skip-card",
    signalEffects: [],
    postAction: "none",
    // H3｜旧 207（伴侣半天没回消息你一般做什么 = 长期关系里的等待行为）→ 换向：改成对**当场邀约**的即时反应。
    topic: "live_chemistry",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道有人当场要加他微信时他会直接给、先聊聊还是推掉",
    socialEnergy: "high",
    relationshipProgression: "deepen",
    intimacyClass: "none",
    informationGoalType: "live_observation",
    secondaryTopics: ["择偶偏好"],
    category: "flirt",
    followUpHook: "contact_preference",
    expectedAnswerShape: "ternary",
  },
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-254",
    gameType: "truth",
    number: 254,
    text: "你更容易对哪种人上头：让你心跳的，还是让你安心的？",
    intensity: 2,
    heatMin: 2,
    heatMax: 4,
    relationStage: "know",
    targetMode: "choose-opposite-sex",
    responseMode: "public",
    interactionType: "preference",
    consentMode: "skip-anytime",
    matchRequired: false,
    boundaryTags: [],
    fallbackPolicy: "skip-card",
    signalEffects: [],
    postAction: "none",
    // H2｜旧 208（喜欢和合适各占几成 + 说说为什么）→ 换向：把「抽象比例」压成可判定的二选一（心跳 / 安心）。
    // ⛔ 不得改回「外表 A vs 外观 B」型对照（GOLDEN12-REVIEW-2 约束②）。
    topic: "择偶偏好",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道他更容易对让他心跳的人还是让他安心的人上头",
    socialEnergy: "medium",
    relationshipProgression: "open",
    intimacyClass: "none",
    informationGoalType: "self_preference",
    secondaryTopics: ["恋爱观"],
    category: "attraction",
    followUpHook: "attraction",
    expectedAnswerShape: "binary",
  },
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-255",
    gameType: "truth",
    number: 255,
    text: "这桌谁最不能惹，他惹到你，你是当场说开还是先冷一冷？",
    intensity: 2,
    heatMin: 2,
    heatMax: 3,
    relationStage: "know",
    targetMode: "choose-opposite-sex",
    responseMode: "public",
    interactionType: "disclosure",
    consentMode: "skip-anytime",
    matchRequired: false,
    boundaryTags: [],
    fallbackPolicy: "skip-card",
    signalEffects: [],
    postAction: "none",
    // H2｜旧 210（闹别扭时你希望对方怎么做 = 关系谈判）→ 换向：对象改成朋友之间的小摩擦，删掉「希望对方」。
    // A6（主审 §7.2）：旧题面「闹别扭」是泛场景、无画面 ⇒ 绑现场＋指名（这桌谁最不能惹），
    // 保留旧 210「当场 vs 先冷」内核但换成现场冲突可起哄；轴改为「当下摩擦的容忍阈值」。
    topic: "相处规则",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道这桌他最不能惹谁、被惹到时是当场说开还是先冷",
    socialEnergy: "high",
    relationshipProgression: "open",
    intimacyClass: "none",
    informationGoalType: "relationship_rule",
    secondaryTopics: ["性格·习惯·小癖好"],
    category: "quick_know",
    followUpHook: "social_style",
    expectedAnswerShape: "binary",
  },
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-256",
    gameType: "truth",
    number: 256,
    text: "哪种搭讪最容易让你没兴趣：太油、太急，还是一本正经？",
    intensity: 2,
    heatMin: 2,
    heatMax: 4,
    relationStage: "know",
    targetMode: "choose-opposite-sex",
    responseMode: "public",
    interactionType: "preference",
    consentMode: "skip-anytime",
    matchRequired: false,
    boundaryTags: [],
    fallbackPolicy: "skip-card",
    signalEffects: [],
    postAction: "none",
    // H2｜旧 211（关系里绝对不能接受的相处方式 = 长期底线表态）→ 换向：降级成「搭讪方式」的减分点三选一。
    // 三个选项都是**风格**不是外观（约束②），且当场就能拿眼前人对照。
    // A6（主审 §4 约束⑤ 轻度）：题面问的是「搭讪方式」的减分点，属**社交互动**不属择偶 ⇒
    // `topic` 由 `择偶偏好` 改 `相处规则`（`secondaryTopics` 同步由 恋爱观 改 性格·习惯·小癖好）。
    // A7（Part 2，主审 §A/§F）：题面问的是**排斥偏好**（「哪种搭讪最容易让你没兴趣」），
    // `category:"attraction"`（吸引）与题面**不同源** ⇒ 如实改 `quick_know`（相处雷区速览，与 248 同桶）。
    // 代价（主审已核）：全批次 `attraction` 真值 9→8，仍 ≥4。
    // A8（Part 1，主审 Round-3 §1/§5.3）：同一处漏标补齐 —— 题面问「让你**没兴趣**」（排斥），
    // `followUpHook:"attraction"` 与题面**不同源** ⇒ 如实改 `social_style`。代价零：
    // `attraction` 真值走 `category`（现 8），改 hook 不动任何门槛。
    topic: "相处规则",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道哪种搭讪方式最容易让他没兴趣",
    socialEnergy: "high",
    relationshipProgression: "open",
    intimacyClass: "none",
    informationGoalType: "self_preference",
    secondaryTopics: ["性格·习惯·小癖好"],
    category: "quick_know",
    followUpHook: "social_style",
    expectedAnswerShape: "ternary",
  },
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-257",
    gameType: "truth",
    number: 257,
    text: "你想不想凑近谁，说句悄悄话？",
    intensity: 2,
    heatMin: 3,
    heatMax: 4,
    relationStage: "signal",
    targetMode: "choose-opposite-sex",
    responseMode: "public",
    interactionType: "expression",
    consentMode: "skip-anytime",
    matchRequired: false,
    boundaryTags: [],
    fallbackPolicy: "skip-card",
    signalEffects: [],
    postAction: "none",
    // H3｜旧 212（你会在什么情况下吃醋 / 说一件真发生过的）→ 换向：保留「占有那点小心思」的现场轻量版，
    // A6（主审 §5.2＋§7.3-3 去重）：旧题面「贴耳说话，你会多看一眼还是装没看见」与 Golden 238
    // 「对方一直看你，你会回看还是装没看到」**同骨架 ＋ 逃逸口同源**（中度真重复）⇒ 换成**主动**骨架
    // （自己的意愿：想不想凑近谁说悄悄话），与 238 的「对方动作 → 你反应」完全不同；轴亦换为
    // 「凑近说悄悄话的意愿」；`secondaryTopics` 由 吃醋·占有 改 择偶偏好（本张不再谈吃醋）。
    topic: "live_chemistry",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道他想不想凑近谁说句悄悄话",
    socialEnergy: "medium",
    relationshipProgression: "deepen",
    intimacyClass: "none",
    informationGoalType: "live_observation",
    secondaryTopics: ["择偶偏好"],
    category: "flirt",
    followUpHook: "flirt_target",
    expectedAnswerShape: "yes_no",
  },
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-258",
    gameType: "truth",
    number: 258,
    text: "你搭话一般怎么开：先自曝今晚干嘛，还是先抛个问题？",
    intensity: 2,
    heatMin: 3,
    heatMax: 4,
    relationStage: "signal",
    targetMode: "choose-opposite-sex",
    responseMode: "public",
    interactionType: "expression",
    consentMode: "skip-anytime",
    matchRequired: false,
    boundaryTags: [],
    fallbackPolicy: "skip-card",
    signalEffects: [],
    postAction: "none",
    // H3｜旧 213（另一半和异性单独吃饭你能接受到哪一步 / 说出分界）→ 换向：改成现场主动搭话。
    // A6（主审 §5.2＋§7.2 去重）：旧题面选项族（最会说的/最安静的）与 Golden 237（话多/安静）
    // **同源**，且与 251 同场景同构 ⇒ 选项族整体换掉（先夸一句 / 先自曝今晚干嘛），
    // 轴由「主动搭话的对象类型」改「搭话的开场策略」，与 251 / 237 / 245 / 260 四张全错开。
    // A7（Part 3 换题面，主审 §A）：把「先夸」这一格**让给 283**（283 已按 Part 1 换到角色位轴，不再用「夸」），
    // 本张只留「自曝」轴（先自曝今晚干嘛 / 先抛个问题），两卡彻底错开且各自选项族独立。
    topic: "live_chemistry",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道他搭话一般是先自曝今晚干嘛还是先抛个问题",
    socialEnergy: "high",
    relationshipProgression: "deepen",
    intimacyClass: "none",
    informationGoalType: "live_observation",
    secondaryTopics: ["择偶偏好"],
    category: "flirt",
    followUpHook: "flirt_target",
    expectedAnswerShape: "binary",
  },
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-259",
    gameType: "truth",
    number: 259,
    text: "异性朋友半夜发消息，你多久回：马上、隔一会儿，还是第二天？",
    intensity: 2,
    heatMin: 2,
    heatMax: 3,
    relationStage: "know",
    targetMode: "choose-opposite-sex",
    responseMode: "public",
    interactionType: "disclosure",
    consentMode: "skip-anytime",
    matchRequired: false,
    boundaryTags: [],
    fallbackPolicy: "skip-card",
    signalEffects: [],
    postAction: "none",
    // H2｜旧 214（有关系很好的异性朋友吗 / 聊到什么深度）→ 换向：把「深度刻度」换成可答的当场社交动作。
    // A6（主审 §4 约束⑤ 明确违反 ＋ §7.2）：旧题面问「聊天内容」却标 `topic=异性朋友边界` ⇒ **同源修复**。
    // 主审建议 topic → `异性朋友`，但 `V2_TOPICS` 枚举**没有** 该值（仅有 `异性朋友边界`），新增枚举
    // 属 Plan 级 schema 变更（builder 不得自改）⇒ 改用题面同源的合法枚举 `相处规则`（回复消息的规矩），
    // 并把「异性朋友」这一真实语境放回 `secondaryTopics`，题面亦明确写「异性朋友」，回归旧 214 的
    // 「异性/亲密关系里的即时反应」方向。轴改为「异性朋友消息的回复节奏」。
    // A7（Part 4，**只准备不 admission**）：主审 §A 指出本卡 `responseMode:"public"` 公开问
    // 「异性朋友」可能在有伴侣同桌的场合引发道德质问 ⇒ **admission 时**拟给 `boundaryTags` 加
    // `relationship-sensitive`（泛安全元数据，供运行时过滤）。**本单不写入 Formal 流程、不改准入逻辑**，
    // 故此处**保持现值 `boundaryTags: []` 不变**，仅登记 admission 取值。
    topic: "相处规则",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道异性朋友半夜发消息时他多久回",
    socialEnergy: "medium",
    relationshipProgression: "open",
    intimacyClass: "none",
    informationGoalType: "self_preference",
    secondaryTopics: ["异性朋友边界"],
    category: "quick_know",
    followUpHook: "social_style",
    expectedAnswerShape: "ternary",
  },
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-260",
    gameType: "truth",
    number: 260,
    text: "看到喜欢的人在跟别人聊，你会过去，还是忍着？",
    intensity: 2,
    heatMin: 3,
    heatMax: 4,
    relationStage: "signal",
    targetMode: "choose-opposite-sex",
    responseMode: "public",
    interactionType: "expression",
    consentMode: "skip-anytime",
    matchRequired: false,
    boundaryTags: [],
    fallbackPolicy: "skip-card",
    signalEffects: [],
    postAction: "none",
    // H3｜旧 215（伴侣要你少和某异性朋友来往，你会怎么办 / 说实话）→ 换向：把「被迫取舍」换成现场即时行动。
    // A6（主审 §5.2＋§7.2 去重）：旧题面「有人来搭话，你会立刻接上还是先客气」与 Golden 245
    // 「先开口还是等人来聊」**中度同构**（都在问主动性 / 接话快慢）⇒ 换轴换骨架为「吃醋时的行动」
    // （看到喜欢的人跟别人聊，过去还是忍着）：与 245、258、251 全错开；hook 由 `initiative` 改
    // `flirt_target`；`secondaryTopics` 由 择偶偏好 改 吃醋·占有；轴改为「看到喜欢的人跟别人聊时的行动」。
    topic: "live_chemistry",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道看到喜欢的人跟别人聊时他会过去还是忍着",
    socialEnergy: "high",
    relationshipProgression: "deepen",
    intimacyClass: "none",
    informationGoalType: "live_observation",
    secondaryTopics: ["吃醋·占有"],
    category: "flirt",
    followUpHook: "flirt_target",
    expectedAnswerShape: "binary",
  },
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-261",
    gameType: "truth",
    number: 261,
    text: "现在是单身，还是已经有主了？",
    intensity: 1,
    heatMin: 1,
    heatMax: 3,
    relationStage: "notice",
    targetMode: "choose-opposite-sex",
    responseMode: "public",
    interactionType: "disclosure",
    consentMode: "skip-anytime",
    matchRequired: false,
    boundaryTags: [],
    fallbackPolicy: "skip-card",
    signalEffects: [],
    postAction: "none",
    // H1｜旧 216（上一段关系花最久才想通什么）→ 换向：只留「当前状态」的极轻表达，不碰前任回忆。
    topic: "恋爱观",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道他现在的感情状态是单身还是已有伴侣",
    socialEnergy: "medium",
    relationshipProgression: "open",
    intimacyClass: "none",
    informationGoalType: "self_preference",
    secondaryTopics: ["生活方式"],
    category: "quick_know",
    followUpHook: "flirt_target",
    expectedAnswerShape: "binary",
  },
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-262",
    gameType: "truth",
    number: 262,
    // A9-R7（2026-09-29 内容返工，RESEARCH_REVIEW-PACK1-FINAL-54 §1 262 行）：旧题面
    // 「哪句话会让你突然安静：一句当众的夸奖，还是一句没说出口的话？」偏走心抽象，
    //「没说出口的话」3 秒理解吃力、H1 出走心情题偏沉，且兑现句与题面耦合脆
    // ⇒ 按审查处方**改具体、去掉抽象选项**（保住 H1 轻量破冰定位）；`followUpHook=social_style`
    // 按既有裁决**保留**（⛔ 不改回 attraction）；兑现句随新题面同步，⛔ 无任何「哭点 / 气 / attraction」残留。
    text: "被人夸的时候，你更吃哪种：夸到点上，还是夸得夸张？",
    intensity: 1,
    heatMin: 1,
    heatMax: 3,
    relationStage: "notice",
    targetMode: "choose-opposite-sex",
    responseMode: "public",
    interactionType: "disclosure",
    consentMode: "skip-anytime",
    matchRequired: false,
    boundaryTags: [],
    fallbackPolicy: "skip-card",
    signalEffects: [],
    postAction: "none",
    // A9-R7：题面换轴到「被夸的偏好（夸到点上 / 夸得夸张）」；topic 仍 性格·习惯·小癖好。
    topic: "性格·习惯·小癖好",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道他被人夸的时候更吃夸到点上的还是夸得夸张的",
    socialEnergy: "medium",
    relationshipProgression: "open",
    intimacyClass: "none",
    informationGoalType: "self_preference",
    secondaryTopics: ["生活方式"],
    category: "quick_know",
    followUpHook: "social_style",
    expectedAnswerShape: "binary",
  },
  // A9-R6（2026-09-29 内容裁决）：原 `PN-TRUTH-263`（快散场了，你会留下来把最想聊的人聊完，还是先走？）
  // 与 `PN-TRUTH-278` 玩家感受层高度接近（同为「散场时走 / 留 / 等某个人」）⇒ 退役，
  // 逐字归档在 `lib/v2-content/archive/retired-pack1-r6-2026-09-29.ts`，**不再回运行时卡源**。
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-264",
    gameType: "truth",
    number: 264,
    text: "拿你哪一点开玩笑最容易翻车：记性、口味，还是脾气？",
    intensity: 2,
    heatMin: 2,
    heatMax: 3,
    relationStage: "know",
    targetMode: "choose-opposite-sex",
    responseMode: "public",
    interactionType: "disclosure",
    consentMode: "skip-anytime",
    matchRequired: false,
    boundaryTags: [],
    fallbackPolicy: "skip-card",
    signalEffects: [],
    postAction: "none",
    // H2｜旧 219（身上哪一点希望对方永远别拿来开玩笑 = 长期相处禁区）→ 换向：改成当场可试的三选一雷点。
    // 选项全部是**习惯 / 性格**，不落外观（约束②），也不要求现场表演（避 BAR-FIT 表演类硬失败）。
    // A6（主审 §4 约束⑤ 轻度）：`secondaryTopics` 由 生活方式 改 相处规则（开玩笑的雷点＝相处方式）；
    // ⚠️ A6 当时 hook 仍写 `attraction`；**A7 已如实改 `social_style`**（见下），以 A7 为准。
    // A7（Part 2，主审 §A/§F）：`followUpHook:"attraction"` 与题面（玩笑雷点）**不同源** ——
    // 「玩笑雷点」不是吸引钩 ⇒ 如实改 `social_style`（B3 批的 `attraction` **重叠口径**不再是放行依据，
    // A7 已把 `attraction` 放行口径收紧为**卡面 `category` 真值** ≥4，本卡的 `category` 仍是 `quick_know`，
    // 故不再需要靠本卡 hook 撑 `attraction` 重叠数）。兑现句随之换成当场反问「那我拿这点逗你，会翻车吗？」。
    topic: "性格·习惯·小癖好",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道拿他哪一点开玩笑最容易翻车",
    socialEnergy: "high",
    relationshipProgression: "open",
    intimacyClass: "none",
    informationGoalType: "self_preference",
    secondaryTopics: ["相处规则"],
    category: "quick_know",
    followUpHook: "social_style",
    expectedAnswerShape: "ternary",
  },
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-265",
    gameType: "truth",
    number: 265,
    text: "今晚剩下的时间，你最想怎么用：再换一家、找人聊，还是回家睡？",
    intensity: 1,
    heatMin: 2,
    heatMax: 4,
    relationStage: "know",
    targetMode: "choose-opposite-sex",
    responseMode: "public",
    interactionType: "disclosure",
    consentMode: "skip-anytime",
    matchRequired: false,
    boundaryTags: [],
    fallbackPolicy: "skip-card",
    signalEffects: [],
    postAction: "none",
    // H2｜旧 220（五年后理想的一天要保住哪三段）→ 换向：从「五年规划」拉到「今晚剩下的时间怎么用」。
    // 答案本身就是可立即执行的下一步 ⇒ A6 曾归 `follow_up_hook` 类（重点⑤）。
    // A8（Part 1，主审 Round-3 §1/§5.2/§6）：它是全批 10 张 `follow_up_hook` 里**唯一不点名对象**的一张
    // （三格里只有「找人聊」有动作词，另两格「换一家 / 回家睡」推不出任何后续互动）⇒
    // 按主审零成本处方**如实降级**：`category` → `quick_know`、`followUpHook` → `social_style`。
    // 代价（主审已核）：全批次 `follow_up_hook` 真值 10 → 9，**仍 = 阈值 9（余量 0）**；本单已如实登记。
    // 题面不动（主审明确不推荐换题面点名对象：会与 272/273 再撞）。
    topic: "生活方式",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道今晚剩下的时间他最想怎么用",
    socialEnergy: "medium",
    relationshipProgression: "open",
    intimacyClass: "none",
    informationGoalType: "self_preference",
    secondaryTopics: ["性格·习惯·小癖好"],
    category: "quick_know",
    followUpHook: "social_style",
    expectedAnswerShape: "ternary",
  },
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-266",
    gameType: "truth",
    number: 266,
    // A9-R7（2026-09-29 内容返工，RESEARCH_REVIEW-PACK1-FINAL-54 §1 266 行）：旧三选项
    // 「收拾（家务）/ 剪头（形象）/ 约人（社交）」＝**拼盘**、轴不统一 ⇒ 改**同轴三选一**：
    // 三个选项统一到「抽空想做的休闲小事」（补觉 / 散步 / 看剧），答案可比。
    text: "你最近一直想抽空做的，是补觉、散步，还是看剧？",
    intensity: 1,
    heatMin: 1,
    heatMax: 3,
    relationStage: "notice",
    targetMode: "choose-opposite-sex",
    responseMode: "public",
    interactionType: "disclosure",
    consentMode: "skip-anytime",
    matchRequired: false,
    boundaryTags: [],
    fallbackPolicy: "skip-card",
    signalEffects: [],
    postAction: "none",
    // H1｜旧 221（人生最想完成的一件事 + 举证追问）→ 换向：降到低门槛的「想做还没做的小事」三选一。
    // A9-R7：三选项换成同轴的休闲小事；`secondaryTopics` 仍 性格·习惯·小癖好（个人待办习惯）。
    topic: "生活方式",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道他最近一直想抽空做的是补觉、散步还是看剧",
    socialEnergy: "medium",
    relationshipProgression: "open",
    intimacyClass: "none",
    informationGoalType: "self_preference",
    secondaryTopics: ["性格·习惯·小癖好"],
    category: "quick_know",
    followUpHook: "social_style",
    expectedAnswerShape: "ternary",
  },
  // H4（3 张，统一 I3）。
  // 偏好 ≠ 授权：本卡只收集偏好，任何后续身体/亲密动作需独立同意（consentMode=skip-anytime 可随时跳过）。
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-267",
    gameType: "truth",
    number: 267,
    text: "亲密里哪样最加分：先问一句、慢一点，还是抱久一点？",
    intensity: 3,
    heatMin: 4,
    heatMax: 4,
    relationStage: "flirt",
    targetMode: "choose-opposite-sex",
    responseMode: "public",
    interactionType: "preference",
    consentMode: "skip-anytime",
    matchRequired: false,
    boundaryTags: [],
    fallbackPolicy: "skip-card",
    signalEffects: [],
    postAction: "none",
    // 旧 222（亲密关系里哪件事希望对方一定先问过你 = 同意规范条款）→ 换向：把「规范」换成轻量的加分项。
    // 保留「先问一句」这个同意意识，但不写成条款式说教；偏好 ≠ 授权（卡面注释见上）。
    // A6（主审 §7.1 FAIL）：旧选项「有分寸 / 够懂你」是**伴侣相处语汇**（⑧ 长期关系属性 MEDIUM，
    // 违反内部 PASS 四要件）⇒ 三项全换成**当下可执行动作**（先问一句 / 慢一点 / 抱久一点），
    // 保留同意意识、脱离长期伴侣规则；`secondaryTopics` 由 性观念·亲密态度 改 相处规则。
    // A7（Part 4，**只准备不 admission**）：主审 §A 建议**不改题面、改投放条件** —— admission 时把
    // `responseMode` 由 `public` 收为**私答**（Reviewer 原文写 `private-choice`，但合法 `responseMode`
    // 枚举为 `private-individual`；`private-choice` 是合法 `targetMode` —— 以合法枚举为准），
    // 或给 `boundaryTags` 加 `proximity`。**本单不写入 Formal 流程、不改准入逻辑**，
    // 故此处**保持现值 `responseMode:"public"` / `boundaryTags:[]` 不变**，仅登记 admission 取值。
    // A8（Part 1）：主审 Round-3 维持此判（「残留是投放条件不是内容缺陷」）；本单把待收的
    // admission 取值**机器可读地登记**到 `PACK1_PENDING_ADMISSION_OVERRIDES`（内容侧准备，仍**不落地**、
    // 不改准入逻辑）。⚠ 主审另注：同属 H4 亲密档的 `269` 应**与 267 一起**收，不宜只收 267（已一并登记）。
    topic: "亲密边界",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道亲密里他最看重先问一句、慢一点还是抱久一点",
    socialEnergy: "medium",
    relationshipProgression: "deepen",
    intimacyClass: "attitude",
    informationGoalType: "self_preference",
    secondaryTopics: ["相处规则"],
    category: "body_preference",
    followUpHook: "body_preference",
    expectedAnswerShape: "ternary",
  },
  // 偏好 ≠ 授权：本卡只收集偏好，任何后续身体/亲密动作需独立同意（consentMode=skip-anytime 可随时跳过）。
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-268",
    gameType: "truth",
    number: 268,
    text: "喜欢的人碰你哪一下最心动：手、肩，还是头发？",
    intensity: 3,
    heatMin: 4,
    heatMax: 4,
    relationStage: "flirt",
    targetMode: "choose-opposite-sex",
    responseMode: "public",
    interactionType: "preference",
    consentMode: "skip-anytime",
    matchRequired: false,
    boundaryTags: [],
    fallbackPolicy: "skip-card",
    signalEffects: [],
    postAction: "none",
    // 旧 223（亲密里对方主动和自己留空间各占几成）→ 换向：把「抽象比例」换成具体接触部位三选一。
    // 与 Golden 242（第一眼注意哪里）/ 243（拥抱还是牵手）错开：本张问**被碰**的偏好，选项为手 / 肩 / 头发。
    // A6（主审 §4 约束⑤）：题面是触觉部位偏好、无性观念 ⇒ `secondaryTopics` 由 性观念·亲密态度 改 择偶偏好。
    topic: "亲密边界",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道喜欢的人碰到他哪里最让他心动",
    socialEnergy: "medium",
    relationshipProgression: "deepen",
    intimacyClass: "attitude",
    informationGoalType: "self_preference",
    secondaryTopics: ["择偶偏好"],
    category: "body_preference",
    followUpHook: "body_preference",
    expectedAnswerShape: "ternary",
  },
  // 偏好 ≠ 授权：本卡只收集偏好，任何后续身体/亲密动作需独立同意（consentMode=skip-anytime 可随时跳过）。
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-269",
    gameType: "truth",
    number: 269,
    text: "亲密里你更想当主动的那个，还是等对方先？",
    intensity: 3,
    heatMin: 4,
    heatMax: 4,
    relationStage: "flirt",
    targetMode: "choose-opposite-sex",
    responseMode: "public",
    interactionType: "preference",
    consentMode: "skip-anytime",
    matchRequired: false,
    boundaryTags: [],
    fallbackPolicy: "skip-card",
    signalEffects: [],
    postAction: "none",
    // 旧 224（亲密节奏不一致你会怎么开口谈 / 说一句）→ 换向：删掉话术演练，直接问节奏偏好二选一。
    // A6（主审 §4 约束⑤）：题面是节奏偏好、无性观念 ⇒ `secondaryTopics` 由 性观念·亲密态度 改 性格·习惯·小癖好。
    // A7（Part 2 换轴，主审 §F）：旧题面「慢慢来还是直球」与 `267`（选项含「慢一点」）**撞同一「亲密节奏」轴**，
    // H4 三张里两张同轴 ⇒ 换成**主动权**轴（「更想当主动的那个，还是等对方先？」）：
    // 与 242（注视部位）/ 243（接触形式）/ 267（加分点）/ 268（触碰部位）全不同轴。
    // hook 由 `contact_preference` 改 `initiative`（主动权）以随题面同源。
    topic: "亲密边界",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道亲密里他更想当主动的那个还是等对方先",
    socialEnergy: "medium",
    relationshipProgression: "deepen",
    intimacyClass: "attitude",
    informationGoalType: "self_preference",
    secondaryTopics: ["性格·习惯·小癖好"],
    category: "body_preference",
    followUpHook: "initiative",
    expectedAnswerShape: "binary",
  },
];

/** 卡 ID 列表（升序，派生自卡源，不手写）。 */
export const PACK1_REPLACE_CARD_IDS: readonly string[] = PACK1_REPLACE_CARDS.map((card) => card.cardId);

/** 涉及身体 / 亲密偏好（`category="body_preference"`）的卡 ID（派生；consent 断言据此收敛）。 */
export const PACK1_REPLACE_BODY_INTIMACY_CARD_IDS: readonly string[] = PACK1_REPLACE_CARDS.filter(
  (card) => card.category === "body_preference",
).map((card) => card.cardId);
