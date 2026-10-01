/**
 * A4c｜第一包 REWRITE 重写批（`PN-TRUTH-244 ~ 250` 号段，**新 ID**；planning-only）。
 *
 * ## A9-R7（2026-09-29 内容返工）
 * 原 7 张中的 `PN-TRUTH-249` 经内容裁决**退役**（与 250 同轴「本周状态」，趣味/吸引/钩子三弱，
 * 审查建议二选一留 250）⇒ 逐字归档在 `lib/v2-content/archive/retired-pack1-r7-2026-09-29.ts`，
 * **移出运行时卡源**。故本批现为 **6 张**（号段 244~250 内缺 249）；张数一律由
 * `PACK1_REWRITE_CARDS.length` 派生，⛔ 不得写死 6/7。
 *
 * ## 这是什么
 * Human 2026-09-29 冻结的酒吧新内容基线逐卡审计（`temp/BAR-AUDIT-PACK1-31.md`）把第一包
 * `PN-TRUTH-201~231` 判为 KEEP 5 / REWRITE 7 / REPLACE 19。本文件是 **REWRITE 7 张**
 * （旧 `201 202 225 226 228 230 231`）的**同方向重写产物**，风格锚 = `lib/v2-content/golden12/`
 * 的 Golden 12，硬约束 = `temp/GOLDEN12-REVIEW-2.md` §5.3 的 5 条模板使用约束。
 *
 * ## 与旧卡的关系（禁止逐字/近似照搬）
 * 旧题面逐字归档在 `lib/v2-content/archive/retired-truth-pack-2026-09-29.ts`；本批**只取其方向**
 * （information goal 的语义族），写法全部重写，`cardId` 全部新开（`244~250`），与旧卡 ID 无交集。
 *
 * ## A5 修正（2026-09-29，编排者裁决）：REWRITE ＝「方向对、写法不行」＝ **必须 1:1 保留旧方向**
 * A4c 曾把 `248 / 249 / 250` 写成 H3/H4 热档题（`flirt` / `body_preference`）去凑「覆盖 H1~H4」，
 * 那是派工单指标写错导致的越界：旧 `230 / 231 / 226` 全是 **H1 生活 / 社交向**题，与该指标天然互斥。
 * A5 已把这三张**回退到各自的原始方向**（只重写写法，仍 ≤30 字、一问、封闭/半封闭、可起哄）：
 * - `248 ← 230`：与刚认识的人相处时最受不了对方哪一点（保留 `topic=相处规则` / `relationship_rule`）
 * - `249 ← 231`：一天里最自在的时段（保留 `topic=性格·习惯·小癖好` / `self_preference`）
 * - `250 ← 226`：工作日 / 休息日的生活节奏（保留 `topic=生活方式`；**换轴**以避开 `203`（下班到睡前）
 *   与 `233`（微醺状态）两条已占用的作息轴）
 * `244 245 246 247` 是 A4c 已 1:1 承接的 4 张，A5 **逐字不动**。
 * 代价（诚实接受，不抬 Heat 凑数）：本批 `heatMin` 自然只落 **H1×5 + H2×2**（`H3/H4 = 0`），
 * `flirt / body_preference` 覆盖在本批为 **0** —— 这两项**改由同单 19 张 REPLACE 新卡
 * （`lib/v2-content/pack1-replaces/`，`PN-TRUTH-251~269`）承担**；⛔ 不得为覆盖指标改 `heatMin`。
 *
 * ## A6 修正（2026-09-29，内容主审 `temp/PACK1-NEW26-REVIEW-1.md` 第 1 轮）
 * 主审判本批 `244 FAIL（无现场价值）`、`249 / 250 BORDERLINE（249 靠钩子救、250 换轴）`。
 * A6 按主审 §7 逐张改题面（**只改写法与元数据，不动 `heatMin` / `intensity` / ID**）：
 * - `244`：改「这周有谁约过你，你是都推了，还是都去了？」（绑人，保留旧 201 方向；hook → `initiative`）。
 * - `249`：改「你这周哪天最像在放假：工作日的晚上、周六，还是周一？」（换轴，解除与 250 同族）。
 * - `250`：改「你是攒着周末一次性放掉，还是平时每天留一点？」（换轴，与 249 全错开）。
 * 结构调整：本批仍 `H1×5 + H2×2`（A6 不抬 Heat）；`flirt / body_preference` 仍由 REPLACE 批承担。
 * 覆盖缺口（`follow_up_hook` 卡面真值）由同单补卡批 `lib/v2-content/pack1-supplements/` 承担。
 *
 * ## A7 修正（2026-09-29，内容主审 `temp/PACK1-ROUND2-REVIEW.md`）
 * Round-2 仍判 `244 / 250` 需再改（`244` 时间轴太泛、`250` 缺现场因果链）。A7 按主审 §A/§F
 * **只改题面与同源元数据，不动 `heatMin` / `intensity` / ID**：
 * - `244`：「这周有谁约过你」→「今晚到现在，有人约你去下一场」（把时间轴拉到**今晚**）。
 * - `250`：「你是攒着周末一次性放掉」→「上班攒下来的劲，你是留到周末一次放」（补上现场因果链）。
 * 结构调整：仍 `H1×5 + H2×2`（A7 不抬 Heat）。
 *
 * ## 与运行时 / 正式 schema 的关系（**本轮不改任何 schema**）
 * 本文件与 Golden 12 一样，只是**一个 planning-only 内容模块**，一个字节都不碰
 * `lib/v2-content/v2-types.ts` / `lib/domain/schemas.ts` / `v2-card-metadata.ts` /
 * `v2-card-bridge.ts`。`category` / `followUpHook` / `expectedAnswerShape` 是**设计期分类**，
 * 不进 Runtime / 正式 `GameCard` schema（锁在 `tests/unit/pack1-rewrites.test.ts`）。
 *
 * ## 安全与 consent（硬红线）
 * - 全部卡 `consentMode="skip-anytime"`（不愿意可无惩罚跳过）。
 * - 本批**无**身体 / 亲密偏好卡（`category=body_preference` 计 0 —— A5 后 250 已回退为生活方式题），
 *   故卡面**不写**「偏好 ≠ 授权」注释；该注释只挂在真正的 `body_preference` 卡上
 *   （Golden 12 与 `lib/v2-content/pack1-replaces/`）。`followUpHook` **≠ 身体接触授权**。
 * - 不露骨、不强迫、不盘问性经历、不把「偏好」写成「接触授权」，不引入前任回忆 / 长期伴侣规则 /
 *   人生规划 / 心理咨询式自我剖析（Human 冻结的四类退出项）。
 *
 * ## ID
 * 号段由 `scripts/audit-card-id-space.ts` 复算得出（A4c 落地时全库最大 = Golden 12 的 243，起点 = 244），
 * **禁止自己猜号段**；A5 后本批占 `244~250`（未动 ID）；A9-R7 退役 249 后现役 6 张占同号段。
 */

import { type GoldenTruthCard } from "../golden12/golden-12-cards";
import { V2_SSOT_SCHEMA_VERSION } from "../v2-types";

/** 冻结 SSOT schema 版本；与既有内容源同源（不新造版本号）。 */
const SCHEMA = V2_SSOT_SCHEMA_VERSION;

/**
 * 第一包 REWRITE 重写批（`PN-TRUTH-244 ~ 250`，按 `cardId` 升序）。
 *
 * 结构（以 `heatMin` 为档）：**H1×5 / H2×2**（`H3/H4 = 0`）—— 分布**由旧方向自然决定**，
 * 不机械均分、不为覆盖指标抬 Heat（旧 7 张全是 H1 生活 / 兴趣 / 社交向，见文件头 A5 修正）。
 */
export const PACK1_REWRITE_CARDS: readonly GoldenTruthCard[] = [
  /* ───────────── H1：轻破冰 / 快速了解（承接旧 201 / 228 方向） ───────────── */
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-244",
    gameType: "truth",
    number: 244,
    text: "今晚到现在，有人约你去下一场，你是当场答应，还是说再看？",
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
    // A6（PACK1-NEW26-REVIEW-1 §7.1 方案 A）：旧题面无现场价值（八维无一项达 3、与眼前人零关联），
    // 保留旧 201「他主动投入什么」的方向但**绑人**——改成「被约时推还是去」，「有谁约过你」当场可起哄。
    // topic 随题面同源换（生活方式），hook 由 social_style 换 `initiative`（约 = 主动性）。
    // A7（Part 3 换题面，主审 §F）：把时间轴从「这周」拉到**今晚**（「今晚到现在，有人约你去下一场」）——
    // 「当场答应 / 再看」自带起哄（「哟你这是有局啊」），且答案能立刻被对面拿来接下一轮。
    topic: "生活方式",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道他今晚有人约去下一场时是当场答应还是说再看",
    socialEnergy: "medium",
    relationshipProgression: "open",
    intimacyClass: "none",
    informationGoalType: "self_preference",
    secondaryTopics: ["相处规则"],
    category: "quick_know",
    followUpHook: "initiative",
    expectedAnswerShape: "binary",
  },
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-245",
    gameType: "truth",
    number: 245,
    text: "在场你更像哪种：先开口的，还是等人来聊的？",
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
    topic: "性格·习惯·小癖好",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道他在场上是先开口型还是等人来搭型",
    socialEnergy: "medium",
    relationshipProgression: "open",
    intimacyClass: "none",
    informationGoalType: "self_preference",
    secondaryTopics: ["相处规则"],
    category: "quick_know",
    followUpHook: "initiative",
    expectedAnswerShape: "binary",
  },

  /* ─────────────── H2：吸引与社交偏好（承接旧 202 / 225 方向） ─────────────── */
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-246",
    gameType: "truth",
    number: 246,
    text: "你更吃哪种人：像你的，还是跟你完全不一样的？",
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
    topic: "择偶偏好",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道他更容易被像自己的人还是反差型的人吸引",
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
    cardId: "PN-TRUTH-247",
    gameType: "truth",
    number: 247,
    text: "你的心动是看一眼就来，还是越聊越有？",
    intensity: 2,
    heatMin: 2,
    heatMax: 3,
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
    topic: "择偶偏好",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道他的心动是始于一眼还是始于相处",
    socialEnergy: "medium",
    relationshipProgression: "open",
    intimacyClass: "none",
    informationGoalType: "self_preference",
    secondaryTopics: ["恋爱观"],
    category: "attraction",
    followUpHook: "attraction",
    expectedAnswerShape: "binary",
  },

  /* ───── H1：轻破冰 / 快速了解（承接旧 230 / 231 / 226 三条生活·社交方向） ───── */
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-248",
    gameType: "truth",
    number: 248,
    text: "刚认识的人，你最受不了哪种：查户口、太热情，还是爱答不理？",
    intensity: 2,
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
    // A5：1:1 承接旧 230（`topic=相处规则` / `relationship_rule`），删掉旧的「说说它怎么来的」来历追问。
    topic: "相处规则",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道他跟刚认识的人相处时最受不了对方哪一点",
    socialEnergy: "medium",
    relationshipProgression: "open",
    intimacyClass: "none",
    informationGoalType: "relationship_rule",
    secondaryTopics: ["性格·习惯·小癖好"],
    category: "quick_know",
    followUpHook: "social_style",
    expectedAnswerShape: "ternary",
  },
  // A9-R7（2026-09-29 内容返工，按 RESEARCH_REVIEW-PACK1-FINAL-54 §1/§专项1 P1）：
  // 原 `PN-TRUTH-249`（你这周哪天最像在放假：工作日的晚上、周六，还是周一？）与 `PN-TRUTH-250`
  // 同轴（本周状态），且趣味/吸引/钩子三弱 —— 审查建议「与 250 二选一，留 250」，编排者裁决
  // **退出 Formal 并逐字归档**（⛔ 不许改写保留）。逐字快照见
  // `lib/v2-content/archive/retired-pack1-r7-2026-09-29.ts`，**不再回运行时卡源**。
  {
    schemaVersion: SCHEMA,
    cardId: "PN-TRUTH-250",
    gameType: "truth",
    number: 250,
    // A6（主审 §7.1）：旧题面「工作日 vs 休息日」信息增量仅 2、八维无一项 ≥3 ⇒ 换轴而非换写法。
    // 新轴＝「休息时间是攒到周末一次放掉还是平时每天留一点」，仍属旧 226「生活节奏」方向，
    // 但答案当场可对照（他今天就在场）；与 249 换轴后 249/250 同族自动解除。topic=生活方式 保留。
    // A7（Part 3 换题面，主审 §F）：补上**现场因果链**（「上班攒下来的劲」）。
    // A8（Part 3 换题面，主审 Round-3 §1/§10.2）：A7 版仍缺**现场时间锚**（「留到周末 / 每天下班」
    // 都是泛作息，不是此刻）⇒ 按主审原句把时间轴绑到**今晚**：「今晚一次放完 / 留着明天再放」，
    // 答案当场可对质（他今晚就是那次「放」）。infoGoal 与兑现句同步（不换语义族、不动 heatMin）。
    text: "这一周攒的劲，你打算今晚一次放完，还是留着明天再放？",
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
    topic: "生活方式",
    barFit: "PASS",
    informationGain: "medium",
    informationGoal: "知道他这一周攒的劲打算今晚一次放完还是留着明天再放",
    socialEnergy: "medium",
    relationshipProgression: "open",
    intimacyClass: "none",
    informationGoalType: "self_preference",
    secondaryTopics: ["性格·习惯·小癖好"],
    category: "quick_know",
    followUpHook: "social_style",
    expectedAnswerShape: "binary",
  },
];

/** 卡 ID 列表（升序，派生自卡源，不手写）。 */
export const PACK1_REWRITE_CARD_IDS: readonly string[] = PACK1_REWRITE_CARDS.map((card) => card.cardId);

/**
 * 涉及身体 / 亲密偏好（`category="body_preference"`）的卡 ID（派生；consent 断言据此收敛）。
 * A5 后本批恒为**空数组**（250 已回退为生活方式题）：单测据此断言「本批无身体卡 ⇒ 卡面无 consent 注释」。
 */
export const PACK1_REWRITE_BODY_INTIMACY_CARD_IDS: readonly string[] = PACK1_REWRITE_CARDS.filter(
  (card) => card.category === "body_preference",
).map((card) => card.cardId);
