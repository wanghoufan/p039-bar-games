/**
 * A6｜第一包覆盖率补卡批（`PN-TRUTH-270 ~ 283`，**新 ID**；planning-only，先不进 Formal）。
 *
 * ## 这是什么、为什么补
 * `temp/PACK1-NEW26-REVIEW-1.md` §6-⑥/⑦ 用**卡面 `category` 真值**逐卡 re-count 后发现：
 * 26 张新卡里 `follow_up_hook` 只有 **1** 张，而矩阵里的 `follow_up_hook` 计数走的是
 * 「`followUpHook !== "none"`」的**重叠口径**（把「带钩子的卡」当成「归这一类的卡」）。
 * 主审据此判定 `attraction≥4` 与 `follow_up_hook≥12` 在**真值口径下未达标**，须补真卡。
 *
 * ## A7 修正（2026-09-29，编排者裁决 + `temp/PACK1-ROUND2-REVIEW.md`）
 * Round-2 主审判本批**内容层面不通过**，并点名 4 处硬伤。A7 按裁决逐项整改：
 * 1. **`follow_up_hook` 定义收紧**（Plan 级口径修正，属本项目内部标准）：该 `category`
 *    **只允许**用于「题面本身点名对象或动作、能当场产生后续互动」的卡；「今晚想接着玩还是先歇」
 *    这类**风格偏好**不得标此 category。据此 `270 / 271 / 277` **如实重标**为 `quick_know`
 *    （`272` 经 Part 1 改为**点名两人**后仍成立 `follow_up_hook`）。阈值随之 **12 → 9**。
 * 2. **必改 3 张**：`278`（与 `273` 真重复 → 换轴「先溜 / 等某人一起溜」）、
 *    `272`（与既有 `263` 同族 → 换轴到**点名两人**）、`283`（与 `258` 重复 → 换轴到**角色位**「逗别人 / 被逗」）。
 * 3. **换题面 5 张**（本批）：`270 / 275 / 279 / 281`（`273` 经核对 §F / §C-2 明示「本张保留」，
 *    **本单不改题面**，理由见 A7 报告「Part 3」节）。
 * ⛔ **禁止**用重叠口径充数、**禁止**为凑数改既有卡的 `category` 标签：
 * `category` 必须如实反映题面（本批逐张说明见卡上注释）。
 *
 * ## A8 修正（2026-09-29，`temp/PACK1-ROUND3-REVIEW.md` 主审点名 ＋ 编排者裁决）
 * - `270`：与 `278` 撞「今晚走还是留」轴（跨档 H2×H3）⇒ 换轴到**饮品方式**（接着干杯 / 改喝点软的）。
 * - `275`：与 `274` 撞「分组玩＋跟谁」轴（答案必然同一人）⇒ 动作帧由**组队**换成 **1v1 单挑**
 *   （跟谁比一局飞镖）。**这是本单 Part 2 的由来**：旧 `PACK1_SUPPLEMENT_SHOTS` 靠字符串不同放行，
 *   掩盖了语义重复；A8 新增语义签名判据（`pack1-semantic-axes.ts`）把 `SHOTS` 降级为审计辅助。
 * - `277`：主审 §8 判**不必须改题面** ⇒ 题面不动，把 `boundaryTags:["location-sensitive"]` 登记到
 *   `PACK1_PENDING_ADMISSION_OVERRIDES`（只准备不落地）；同时如实登记其**内容弱**问题未解决。
 * - `267`（属 REPLACE 批，不在本文件）同步登记 admission 取值，见 `pack1-admission-prep.ts`。
 *
 * ## A9-R6（2026-09-29 内容裁决）
 * - `277`：A8 登记的内容弱问题在 A9-R6 裁决为**退役** ⇒ 题面逐字归档在
 *   `lib/v2-content/archive/retired-pack1-r6-2026-09-29.ts`，移出运行时卡源；A8 的
 *   `location-sensitive` 登记随卡作废（⛔ 不用泛标签给它续命）。
 * - 本批现为 **13 张**（号段 270~283 内缺 277），`heatMin` 分布 **H2×5 + H3×8**（`H1/H4 = 0`）；
 *   张数一律由 `PACK1_SUPPLEMENT_CARD_IDS.length` 派生。
 *
 * ## 与既有批的关系
 * - 与 Golden 12（`232~243`）、第一包 REWRITE（`244~250`）、第一包 REPLACE（`251~269`）
 *   的题面/ID **两两双向整句包含 0 命中**（去标点口径，见 `tests/unit/pack1-supplements.test.ts`）。
 * - 风格锚 = Golden 12；硬约束 = `temp/GOLDEN12-REVIEW-2.md` §5.3 的 5 条模板使用约束：
 *   ①同档不同轴（**A8 起真判据＝`pack1-semantic-axes.ts` 的语义签名 `{referent,answerSpace,axis}`**；
 *   `PACK1_SUPPLEMENT_AXES` / `PACK1_SUPPLEMENT_SHOTS` 两表**降级为审计辅助**，不得再充当达成证据）；
 *   ②**禁「外观 A vs 外观 B」二元对照**；③`followUpHook` **当场可兑现**（见
 *   `PACK1_SUPPLEMENT_HOOK_REDEEM_LINES`）；④H4 统一 I3、禁价值倒挂；⑤元数据随题面同源。
 * - 本批 `heatMin` 只落 **H2×5 + H3×8**（`H1/H4 = 0`，A9-R6 退役 277 后）：这两类补卡是**后续互动钩子/吸引偏好**，
 *   不是身体/亲密偏好题，**不硬抬到 H4**（抬了就是约束④ 的价值倒挂）。H3/H4 库存余量见矩阵派生。
 *   A7 后 `277` 的 `heatMin` 由 3 降为 2（消除约束④ 的 H3×I1 倒挂）；A9-R6 后 277 退役。
 *
 * ## 安全与 consent（硬红线）
 * - 全部卡 `consentMode="skip-anytime"`（不愿意可无惩罚跳过）；本批**无**身体/亲密偏好卡
 *   （`category="body_preference"` 计 0），故卡面**不写**「偏好 ≠ 授权」注释。
 *   `followUpHook` **≠ 身体接触授权**。
 * - 不露骨、不强迫、不盘问性经历、不把「偏好」写成「接触授权」；不引入前任回忆 / 长期伴侣规则 /
 *   人生规划 / 心理咨询式自我剖析（Human 冻结的四类退出项）。
 *
 * ## 与运行时 / 正式 schema 的关系（**本轮不改任何 schema**）
 * 本文件与 Golden 12 / REWRITE / REPLACE 批一样，只是**一个 planning-only 内容模块**，
 * 一个字节都不碰 `lib/v2-content/v2-types.ts` / `lib/domain/schemas.ts` / `v2-card-metadata.ts` /
 * `v2-card-bridge.ts`。`category` / `followUpHook` / `expectedAnswerShape` 是**设计期分类**，
 * 不进 Runtime / 正式 `GameCard` schema（锁在 `tests/unit/pack1-supplements.test.ts`）。
 * 本单**不 admission、不进 Formal**。
 *
 * ## A7｜admission 预留（只准备，不落 Formal）
 * - `PN-TRUTH-279` 题面真实谈「把微信当场要过来」⇒ 按 Plan §3.1「题面真实命中才写」
 *   挂精确开关 `boundaryTags:["social-account"]`（与 Golden `239` / REPLACE `253` 同口径）。
 *
 * ## ID
 * 号段由 `scripts/audit-card-id-space.ts` 复算得出（上一单落地后全库最大 = 第一包 REPLACE 的 269，
 * 安全起点 = 270），**禁止自己猜号段**。
 */

import { type GoldenTruthCard } from "../golden12/golden-12-cards";
import { V2_SSOT_SCHEMA_VERSION } from "../v2-types";

/** 冻结 SSOT schema 版本；与既有内容源同源（不新造版本号）。 */
const SCHEMA = V2_SSOT_SCHEMA_VERSION;

/**
 * A6 覆盖率补卡（`PN-TRUTH-270 ~ 283`，按 `cardId` 升序）。
 *
 * 以 `heatMin` 为档：**H2×5 / H3×8**（`H1/H4 = 0` —— 由内容自然决定，不硬抬；A9-R6 退役 277）。
 */
export const PACK1_SUPPLEMENT_CARDS: readonly GoldenTruthCard[] = [
  /* ─────────────── H2：轻量「今晚接下来怎么过」 ─────────────── */
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-270",
    gameType: "truth",
    number: 270,
    text: "今晚你更想接着干杯，还是改喝点软的？",
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
    // A7（Part 3 换题面）：旧题面「接着玩还是先歇」轴薄、只能推出「再一轮／散场」。
    // 改成「再战一轮 / 趁没醉先撤」补上现场取舍（「趁没醉」自带梗）。
    // A7（编排者裁决 1）：题面是**风格偏好**（继续玩还是撤），不点名对象/动作 ⇒ **如实降为 `quick_know`**。
    // A8（Part 1，主审 Round-3 §1/§3.2-E/§4 约束①）：A7 版「再战一轮 / 趁没醉先撤」与 `278`
    // （先溜 / 等某人一起溜）撞**同一个「今晚走还是留」轴**（跨档 H2×H3，旧同档断言看不见）⇒
    // 按主审处方**换轴到饮品方式**（接着干杯 / 改喝点软的），与 `271`(场所)、`265`(去向)、`263/278`(去留) 全错开；
    // `category`/`hook` 不动。infoGoal 与兑现句同步。
    topic: "生活方式",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道他今晚更想接着干杯还是改喝点软的",
    socialEnergy: "medium",
    relationshipProgression: "open",
    intimacyClass: "none",
    informationGoalType: "self_preference",
    secondaryTopics: ["性格·习惯·小癖好"],
    category: "quick_know",
    followUpHook: "social_style",
    expectedAnswerShape: "binary",
  },
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-271",
    gameType: "truth",
    number: 271,
    text: "今晚要是换个地方，你想去安静的，还是更吵的？",
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
    // A7（编排者裁决 1）：题面是**场所口味**（风格偏好），不点名对象/动作 ⇒ **如实降为 `quick_know`**。
    // 与 265（今晚剩下的时间怎么用：换一家 / 找人聊 / 回家睡）错开：265 问**去向**，本张问**场所口味**。
    topic: "生活方式",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道换个地方时他更想去安静的还是更吵的",
    socialEnergy: "medium",
    relationshipProgression: "open",
    intimacyClass: "none",
    informationGoalType: "self_preference",
    secondaryTopics: ["择偶偏好"],
    category: "quick_know",
    followUpHook: "social_style",
    expectedAnswerShape: "binary",
  },
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-272",
    gameType: "truth",
    number: 272,
    text: "下一轮你想接着聊的，是刚坐过来的那位，还是你原本就在聊的那位？",
    intensity: 1,
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
    // A7（Part 1 P0，主审 §F）：旧题面「接着聊还是自己待会儿」与既有 263 同族（散场时留不留人、
    // 同为二选一），且不点名任何人 ⇒ 换成**点名两人**（刚坐过来的那位 / 原本在聊的那位），
    // 现场立刻可起哄，并给下一轮一个明确输入；轴换成「下一轮续聊对象」。
    // 题面点名对象 ⇒ 收紧口径下 `follow_up_hook` 仍成立（不属扩义）。
    topic: "live_chemistry",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道下一轮他想接着聊的是刚坐过来的那位还是原本就在聊的那位",
    socialEnergy: "medium",
    relationshipProgression: "open",
    intimacyClass: "none",
    informationGoalType: "live_observation",
    secondaryTopics: ["择偶偏好"],
    category: "follow_up_hook",
    followUpHook: "flirt_target",
    expectedAnswerShape: "binary",
  },

  /* ──────────── H3：现场「跟谁接着玩 / 跟谁走」（follow_up_hook） ──────────── */
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-273",
    gameType: "truth",
    number: 273,
    text: "这桌散了，你最想跟谁一起走？",
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
    // 补卡｜category=follow_up_hook：答案点名下一步同行人（现场可起哄、可当场兑现）。
    // A7：主审 §C-2 明示本张是「跟谁」簇里**最好的一张**（场景锚最实、兑现句最顺），`本张保留`，
    // 由 `278` 换轴来断开真重复 —— 故本单**不改本张题面**（§F 无 273 字面量）。
    // 与 251（第一眼先注意到谁，问**此刻注意**）/ 258（搭话怎么开，问**开场策略**）错开：本张问**散场同行**。
    topic: "live_chemistry",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道这桌散了他最想跟谁一起走",
    socialEnergy: "high",
    relationshipProgression: "deepen",
    intimacyClass: "none",
    informationGoalType: "live_observation",
    secondaryTopics: ["择偶偏好"],
    category: "follow_up_hook",
    followUpHook: "flirt_target",
    expectedAnswerShape: "short_phrase",
  },
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-274",
    gameType: "truth",
    number: 274,
    text: "要是分两组玩，你想跟谁一队？",
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
    // 补卡｜category=follow_up_hook：答案直接决定下一轮的**组队**（后续玩法钩子）。
    topic: "live_chemistry",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道分两组玩时他想跟谁一队",
    socialEnergy: "high",
    relationshipProgression: "deepen",
    intimacyClass: "none",
    informationGoalType: "live_observation",
    secondaryTopics: ["择偶偏好"],
    category: "follow_up_hook",
    followUpHook: "initiative",
    expectedAnswerShape: "short_phrase",
  },
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-275",
    gameType: "truth",
    number: 275,
    text: "下一轮你最想跟谁比一局飞镖？",
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
    // A7（Part 3 换题面，主审 §F）：旧题面「下一轮最想听谁说话」与 280（点歌给谁）共享「谁＋听/给」模态、
    // 且与 281 的「下一轮／最后一轮＋跟谁」同框 ⇒ 换成**玩法轴**（跟谁玩一局狼人杀）。
    // A8（Part 1，主审 Round-3 §3.2-A/§6）：A7 的「跟谁**玩一局狼人杀**」是**无效处方** ——
    // 一局桌游＝一次组队、答案必然同一个人，与 `274`（分两组跟谁一队）仍是同轴；
    // 旧 `PACK1_SUPPLEMENT_SHOTS` 靠「组队 vs 玩法·狼人杀」字符串不同把它放过（正是本单 Part 2 要堵的洞）。
    // 本单按主审处方把动作帧从**分组**换成**1v1 单挑**（跟谁比一局飞镖）：社交结构不同（队 vs 对手），
    // 与 `274` 不再同签名。hook 保持 `flirt_target`（仍点名对象 ⇒ 收紧口径下 `follow_up_hook` 成立）。
    topic: "live_chemistry",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道下一轮他最想跟谁比一局飞镖",
    socialEnergy: "medium",
    relationshipProgression: "deepen",
    intimacyClass: "none",
    informationGoalType: "live_observation",
    secondaryTopics: ["择偶偏好"],
    category: "follow_up_hook",
    followUpHook: "flirt_target",
    expectedAnswerShape: "short_phrase",
  },
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-276",
    gameType: "truth",
    number: 276,
    text: "你想拉谁陪你出去透口气？",
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
    // 补卡｜category=follow_up_hook：答案是一个可立刻执行的邀约（出去两分钟）。
    topic: "live_chemistry",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道他想拉谁陪他出去透口气",
    socialEnergy: "high",
    relationshipProgression: "deepen",
    intimacyClass: "none",
    informationGoalType: "live_observation",
    secondaryTopics: ["择偶偏好"],
    category: "follow_up_hook",
    followUpHook: "flirt_target",
    expectedAnswerShape: "short_phrase",
  },
  // A9-R6（2026-09-29 内容裁决）：原 `PN-TRUTH-277`（散场后你打算怎么回：打车、地铁，还是走路？）
  // 内容本身不好玩（几乎无吸引 / 人物信息 / 后续玩法价值）⇒ 退役，逐字归档在
  // `lib/v2-content/archive/retired-pack1-r6-2026-09-29.ts`，**不再回运行时卡源**；
  // A8 曾登记的 `location-sensitive` 泛安全标签随本卡一并作废（不为续命加治理复杂度）。
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-278",
    gameType: "truth",
    number: 278,
    text: "最后一圈，你想先溜的是自己，还是等某个人一起溜？",
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
    // A7（Part 1 P0 FAIL，主审 §F）：旧题面「今晚最后一段，你想让谁陪你走」与 273 **真重复**
    // （场景 / 动作 / 轴 / 兑现句四项全同）⇒ 换轴到**「留局」的对立面**（自己先溜 / 等某个人一起溜）：
    // 与 273（问「跟谁」）形成「第一人称 vs 点名对象」的轴差，与 273 / 281 全错开。
    // 题面点名动作（先溜 / 一起溜）⇒ 收紧口径下 `follow_up_hook` 仍成立。
    topic: "live_chemistry",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道他最后一圈会自己先溜还是等某个人一起溜",
    socialEnergy: "high",
    relationshipProgression: "deepen",
    intimacyClass: "none",
    informationGoalType: "self_preference",
    secondaryTopics: ["择偶偏好"],
    category: "follow_up_hook",
    followUpHook: "flirt_target",
    expectedAnswerShape: "binary",
  },
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-279",
    gameType: "truth",
    number: 279,
    text: "散场之前，你想把哪个微信当场要过来？",
    intensity: 2,
    heatMin: 3,
    heatMax: 4,
    relationStage: "signal",
    targetMode: "choose-opposite-sex",
    responseMode: "public",
    interactionType: "expression",
    consentMode: "skip-anytime",
    matchRequired: false,
    // 题面真实谈「把微信当场要过来」⇒ 命中精确开关 `social-account`（社交账号交换），
    // 按 Plan §3.1「题面真实命中才写」标注（与 Golden 239 / REPLACE 253 同口径）；本轮不进运行时。
    boundaryTags: ["social-account"],
    fallbackPolicy: "skip-card",
    signalEffects: [],
    postAction: "none",
    // A7（Part 3 换题面，主审 §F）：旧题面「散场之后还想再见谁一面」只有 12 字、无场景锚，
    // 且与 273 共享「散场之后」开场 ⇒ 去掉散场锚、改成**当场可兑现的改约**（把哪个微信当场要过来）；
    // 与 253（有人当场要你微信）构成**主被动对照**（不是重复，是一张卡的两端）。
    topic: "live_chemistry",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道散场前他想把哪个微信当场要过来",
    socialEnergy: "medium",
    relationshipProgression: "deepen",
    intimacyClass: "none",
    informationGoalType: "live_observation",
    secondaryTopics: ["择偶偏好"],
    category: "follow_up_hook",
    followUpHook: "contact_preference",
    expectedAnswerShape: "short_phrase",
  },
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-280",
    gameType: "truth",
    number: 280,
    text: "最后一首歌，你想点给谁听？",
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
    // 补卡｜category=follow_up_hook：点歌对象＝一个可当场兑现的小动作（点给谁）。
    topic: "择偶偏好",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道最后一首歌他想点给谁听",
    socialEnergy: "medium",
    relationshipProgression: "deepen",
    intimacyClass: "none",
    informationGoalType: "live_observation",
    secondaryTopics: ["兴趣爱好"],
    category: "follow_up_hook",
    followUpHook: "flirt_target",
    expectedAnswerShape: "short_phrase",
  },
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-281",
    gameType: "truth",
    number: 281,
    text: "最后一段，你想跟谁把这杯喝完？",
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
    // A7（Part 3 换题面，主审 §F）：旧题面「最后一轮最想跟谁接着聊」与 278 共享「最后X＋跟谁」同一镜头、
    // 与 275 的「下一轮」构成同一「轮次」轴 ⇒ 把「轮次」空框架换成**物理动作**（跟谁把这杯喝完）：
    // 与 273（走）/ 274（组队）/ 276（透气）/ 280（点歌）全错开。
    topic: "live_chemistry",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道最后一段他想跟谁把这杯喝完",
    socialEnergy: "high",
    relationshipProgression: "deepen",
    intimacyClass: "none",
    informationGoalType: "live_observation",
    secondaryTopics: ["择偶偏好"],
    category: "follow_up_hook",
    followUpHook: "flirt_target",
    expectedAnswerShape: "short_phrase",
  },

  /* ───────────────────── H2：吸引偏好（attraction，留余量） ───────────────────── */
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-282",
    gameType: "truth",
    number: 282,
    text: "撒娇和嘴硬，你更扛不住哪个？",
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
    // 补卡｜category=attraction：问的是「哪种性格特质更容易打动你」（吸引偏好）。
    // 与 Golden 235/236（外观/谈吐）、237（话多 / 安静）、254（心跳 / 安心）、246（像自己 / 反差）不同轴。
    topic: "择偶偏好",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道撒娇和嘴硬哪种更让他扛不住",
    socialEnergy: "medium",
    relationshipProgression: "open",
    intimacyClass: "none",
    informationGoalType: "self_preference",
    secondaryTopics: ["性格·习惯·小癖好"],
    category: "attraction",
    followUpHook: "attraction",
    expectedAnswerShape: "binary",
  },
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-283",
    gameType: "truth",
    number: 283,
    text: "你想当逗别人玩的那个，还是被别人逗的那个？",
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
    // A7（Part 1 P0）：旧题面「先夸你还是先怼你」与 258（搭话怎么开：先夸一句 / 先自曝）**真重复**
    // （两卡都在问「对方开场先做哪一步」，且直接复用了 258 已有的「先夸」格）⇒ 换成**角色位轴**
    // （主动逗 / 被逗）：与 256（开场减分）、258（开场策略）、282（撒娇嘴硬＝风格偏好）全错开，
    // 答案当场可演。
    // category 仍为 `attraction`：答案揭示「逗他/被他逗」哪种互动方式更打动他（吸引偏好）。
    topic: "择偶偏好",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道他想当逗别人玩的那个还是被别人逗的那个",
    socialEnergy: "medium",
    relationshipProgression: "open",
    intimacyClass: "none",
    informationGoalType: "self_preference",
    secondaryTopics: ["性格·习惯·小癖好"],
    category: "attraction",
    followUpHook: "attraction",
    expectedAnswerShape: "binary",
  },
];

/** 卡 ID 列表（升序，派生自卡源，不手写）。 */
export const PACK1_SUPPLEMENT_CARD_IDS: readonly string[] = PACK1_SUPPLEMENT_CARDS.map((card) => card.cardId);

/**
 * 涉及身体 / 亲密偏好（`category="body_preference"`）的卡 ID（派生；consent 断言据此收敛）。
 * 本批恒为**空数组**（补卡全是 follow_up_hook / quick_know / attraction，无身体卡）：
 * 单测据此断言「本批无身体卡 ⇒ 卡面无 consent 注释」。
 */
export const PACK1_SUPPLEMENT_BODY_INTIMACY_CARD_IDS: readonly string[] = PACK1_SUPPLEMENT_CARDS.filter(
  (card) => card.category === "body_preference",
).map((card) => card.cardId);
