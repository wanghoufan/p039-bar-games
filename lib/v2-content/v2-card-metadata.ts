/**
 * V2 固定题 metadata schema（PRODUCT_PLAN_V2.2 §3）与精确雷区过滤（§3.1）。
 *
 * 本模块是**新增件**，不修改既有 SSOT：
 * - 真源文件 `v2-types.ts` / `v2-validation.ts` / `generated/v2-ssot.generated.json` 原样不动；
 * - 本模块零依赖（不 import node 内置、不 import 业务层），可被构建脚本与测试安全引用。
 *
 * ## 两层校验器：兼容读取 ≠ 正式入库门禁（P1-2）
 * 旧设计把「旧卡兼容读取」和「新固定库正式入库」合成了一套 fail-open 校验器
 * （`ok: issues.length === 0`，`missing` 收集但不计入 `ok`），导致**空对象也能通过**，
 * 无法满足 Plan 的正式入库口径。现拆成两层，职责边界互不重叠：
 *
 * 1. `validateLegacyCardQualityMetadata()` —— **兼容读取**用（fail-open）。
 *    旧 SSOT 卡（schema 2.3，18 字段）在逐题补标完成前必须仍能加载，允许新字段缺失：
 *    缺失记入 `missing` 并继续，`ok = issues.length === 0`。
 *    若把新字段设为必填并塞进 `v2-validation.ts`，generated 快照（350+40）会立刻全红，
 *    `v2-ssot-gate` / `v2-content-adapter` 等既有单测全部失败，违反本批
 *    「不得破坏现有 SSOT 卡与既有单测」的硬约束。
 *    ⚠️ 这是**兼容**，不是合规；**不得**用于正式 fixed snapshot / manifest / 新题冻结的入库门禁。
 *
 * 2. `validateFixedCardMetadataStrict()` —— **新固定库正式入库门禁**。
 *    Plan §3 表中「必填=是」且属本模块质量字段者一个都不能缺（见 `V2_REQUIRED_QUALITY_FIELDS`）；
 *    `missing ∩ 必填` 非空即 `ok=false`。另外，Plan §3:52 规定「正式快照只能 PASS」，
 *    §集中验收汇总 :197–:199 要求「FAIL/BORDERLINE 入快照数=0、逐卡必填字段完整、未审题=0」，
 *    §集中验收汇总 :196 要求「合同必填字段/枚举 schema 校验失败数=0」，
 *    故 strict 下 `barFit` 除非为 `PASS` 一律 FAIL（BORDERLINE/FAIL 属合法枚举值，但不是可入库值）。
 *
 * 结论：正式 fixed snapshot / manifest / 新题冻结**只允许走 strict**；legacy 仅服务既有卡加载。
 * 需要把某字段升为必填时，只改 `V2_REQUIRED_QUALITY_FIELDS` / strict 校验器，
 * 不改既有整卡 schema 校验，也不放宽 strict 以迁就旧卡。
 *
 * ## 枚举取值口径（真源）
 * 本文件所有枚举的**唯一真源**是
 * `docs/pm/PRODUCT_PLAN_V2.2-FIXED-CONTENT-FIRST.md` §3（题 metadata 合同表，:43–:60）。
 * 当前 `DEV_BASELINE=PRODUCT_PLAN_V2.2-FIXED-CONTENT-FIRST`，schema 必须与 Plan 逐字一致，
 * 否则验收、Monte Carlo 统计与内容审查都会对不上。
 *
 * ⚠️ A.2 审计产物（`docs/qa/content-audit/*.jsonl`）里出现的**中文枚举值（高/中/低/0）是历史留痕**，
 * 记录的是当时那轮内容审查的粗粒度口径，**不是 schema 真源**。两者禁止混用：
 * 旧产物只作历史证据阅读，任何新 schema/校验/统计必须用本文件的英文枚举。
 *
 * - `topic`：Plan §3 规定为「§4 中 13 个人物主题之一，或 `live_chemistry`」——主题名沿用 §4 表格
 *   的**中文名**（§4 未给英文 slug），但现场化学反应缓冲维度按 §3 写作英文 `live_chemistry`。
 * - `informationGain` / `socialEnergy` / `relationshipProgression` / `informationGoalType`：英文枚举，见下。
 * - `barFit`：Plan §3 原值即为 `PASS/BORDERLINE/FAIL`（英文），原样沿用。
 * - `intimacyClass`：Plan §3 写作 `none/action/attitude`（互斥）。
 * - `informationGoal`：Plan §3:54 为「一句可复述的目标陈述」，明示不可填泛化「促进了解」。
 * - `secondaryTopics`：Plan §3:60 为可选的主题枚举数组。
 *
 * ## P1-7：精确关闭标签 = 用户开关，语义标签 ≠ 用户开关
 * Plan §3.1:62–:79 的精确关闭标签**就是现有 App 的 10 个用户雷区开关**
 * （`lib/domain/constants.ts` 的 `BOUNDARIES` ↔ `lib/domain/schemas.ts` 的 `BoundaryTag`）。
 * 其余六项（`jealousy-possessiveness` / `opposite-sex-friends` / `bottom-line` /
 * `intimacy-attitude` / `intimate-interaction` / `late-night-topic`）**无直连用户开关**，
 * 只能作为**内容语义 / 风险元数据**（`V2_CONTENT_SEMANTIC_TAGS`）存在，
 * **不得**冒充用户可关闭项、不得进 `V2_PRECISE_BOUNDARY_TAGS` / `V2_BOUNDARY_TAG_CATALOG`。
 * 若将来要让某项变成用户开关，必须另走 Human/Plan 变更（新增 App 开关键），
 * 不能只把它塞回本模块的枚举。
 */

/* -------------------------------------------------------------------------- */
/* 字段枚举                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 内容主题（Plan §3:48：取自 §4 的 13 个人物主题之一，或 `live_chemistry`；单一主主题）。
 * 13 个人物主题名沿用 §4 表格原文（中文）；现场化学反应缓冲维度按 §3 用英文 `live_chemistry`。
 */
export const V2_TOPICS = [
  "兴趣爱好",
  "生活方式",
  "性格·习惯·小癖好",
  "择偶偏好",
  "恋爱观",
  "相处规则",
  "吃醋·占有",
  "异性朋友边界",
  "前任态度",
  "底线·雷区",
  "人生目标·理想生活",
  "亲密边界",
  "性观念·亲密态度",
  "live_chemistry",
] as const;

/** 酒吧适配硬门禁（Plan §3:52／§2）：正式快照只允许 `PASS`，`FAIL` 直接删除不润色。 */
export const V2_BAR_FIT = ["PASS", "BORDERLINE", "FAIL"] as const;

/** 信息增量（Plan §3:53：`zero/low/medium/high`）：`zero` = 本人作答后复述不出「谁的什么」；猜测未揭晓不算本人信息。 */
export const V2_INFORMATION_GAIN = ["zero", "low", "medium", "high"] as const;

/** 现场社交能量（Plan §3:55：`low/medium/high`）：评价 / 投票 / 指认带来的现场反应强度，与信息量分开计。 */
export const V2_SOCIAL_ENERGY = ["low", "medium", "high"] as const;

/** 关系推进（Plan §3:56：`none/open/deepen/clarify_boundary`）：是否帮助关系从认识→理解→规则/边界，不按尺度自动加档。 */
export const V2_RELATIONSHIP_PROGRESSION = ["none", "open", "deepen", "clarify_boundary"] as const;

/**
 * 亲密类别（Plan §3:57：`none/action/attitude`，三值互斥）：
 * - `action`   = 对视 / 靠近 / 拥抱 / 合照 / 整理衣领等**身体动作指令**；
 * - `attitude` = 对亲密的态度 / 边界 / 同意规则问答；
 * - `none`     = 与亲密无关。
 * `action` 只计动作与 Consent，不得计入亲密 / 性观念态度覆盖。
 */
export const V2_INTIMACY_CLASSES = ["none", "action", "attitude"] as const;

/**
 * 信息目标类型（Plan §3:58：`self_preference/experience/relationship_rule/boundary_attitude/`
 * `sexual_attitude_self_disclosure/live_observation/action_only/other`）：主目标只取一个。
 */
export const V2_INFORMATION_GOAL_TYPES = [
  "self_preference",
  "experience",
  "relationship_rule",
  "boundary_attitude",
  "sexual_attitude_self_disclosure",
  "live_observation",
  "action_only",
  "other",
] as const;

/** `intimacyClass=action` 时禁止同时以此为主题（Plan §3:57：action 不得计入 attitude/性观念）。 */
export const V2_INTIMACY_ACTION_FORBIDDEN_TOPIC = "性观念·亲密态度" as const;

/** `intimacyClass=action` 时禁止同时以此为信息目标类型（Plan §3:58：`action × sexual_attitude_self_disclosure` 非法）。 */
export const V2_ACTION_FORBIDDEN_GOAL_TYPE = "sexual_attitude_self_disclosure" as const;

/** Plan §3:54 点名的泛化目标占位串；`informationGoal` 正文字面等于它即非法。 */
export const V2_GENERIC_INFORMATION_GOAL = "促进了解" as const;

/* -------------------------------------------------------------------------- */
/* 精确雷区标签全集（V2.2 §3.1）                                               */
/* -------------------------------------------------------------------------- */

/**
 * 精确关闭标签全集（Plan §3.1:62–:79 的**恰好 10 项**）= 现有 App 的 10 个用户雷区开关。
 *
 * 与既有两套枚举的关系 —— **扩展，不替换**：
 * 1. **泛安全元数据** `V2_BOUNDARY_TAGS`（`v2-types.ts`，5 项：
 *    relationship-sensitive / proximity / physical-contact / photo-optional / external-participant）
 *    原样保留：它仍是 `v2-validation.ts` 校验 generated 快照的合法集合，本模块不碰、不改。
 * 2. **App 用户开关域** `BoundaryTag`（`lib/domain/schemas.ts`，10 项；`prompt-builder.ts`
 *    经 `BOUNDARIES`（`lib/domain/constants.ts`）把它注入 AI 出题提示词）原样保留：
 *    它仍是用户能勾 / 能关的那 10 项，本模块不碰、不改；本常量与其**逐项同名同义**。
 * 3. `V2_BOUNDARY_TAG_CATALOG`（全集 14 项）= 精确 10 项 ∪ 泛 4 项（physical-contact 已重合，去重）。
 *
 * P1-7 修正：本枚举此前混入了 6 项**无直连用户开关**的语义标签，等同让非开关项冒充用户可关闭项。
 * 现这 6 项已移出到 `V2_CONTENT_SEMANTIC_TAGS`（内容语义 / 风险元数据），
 * 不再出现在精确关闭标签与雷区全集内；过滤逻辑因此不会再把它们当作用户关闭项消费。
 *
 * **不会破坏现有卡合法性过滤**：全集 ⊇ 泛 5 项，所以只带泛标签的老卡在新校验器下依然合法；
 * 全集 ⊇ App 10 项，所以用户开关能产生的标签都在已知集合内，「命中任一关闭项即拒」的语义不变。
 * 过滤按 `cardPassesBoundaryFilter()` 单做集合交集判定，不设「每个雷区必须 30 题」的题量配额。
 *
 * 注：`physical-contact` 同时是泛标签与 App 开关标签（V2.2 §3.1 称「同名合并」），只登记一次。
 * App 标签在此按字面量登记而非 import 业务层，以保持本模块零依赖；
 * `tests/unit/v2-card-metadata.test.ts` 用等值断言兜底，App 枚举一旦增删会立刻测红。
 */
export const V2_PRECISE_BOUNDARY_TAGS = [
  "physical-contact", // 身体接触
  "alcohol", // 饮酒 / 罚酒 / 劝酒
  "ex-partner", // 前任 / 旧关系
  "sexual-history", // 性 / 两性经历
  "money", // 收入 / 财富
  "phone-privacy", // 手机隐私（相册 / 聊天）
  "public-posting", // 公开发布动态
  "stranger-contact", // 联系 / 邀请陌生人
  "photo-video", // 拍摄 / 录像 / 合照
  "social-account", // 社交账号交换 / 关注
] as const;

/**
 * 内容语义 / 风险元数据标签（P1-7）。**不是**用户可关闭项：
 * - 它们没有对应的 App 用户开关键，不属于 Plan §3.1 的精确关闭标签；
 * - 只能作内容语义（对齐 §4 主题）或风险提示元数据，**不得**进
 *   `V2_PRECISE_BOUNDARY_TAGS` / `V2_BOUNDARY_TAG_CATALOG`，也不参与 `cardPassesBoundaryFilter()`；
 * - 若将来某项要成为用户开关，必须另走 Human/Plan 变更（在 App 侧新增开关键 + 更新 `BoundaryTag`），
 *   而不是把它挪回本模块的边界标签枚举。
 *
 * 与 Plan §4（:85–:100）主题的语义对应：
 */
export const V2_CONTENT_SEMANTIC_TAGS = [
  "jealousy-possessiveness", // 吃醋·占有
  "opposite-sex-friends", // 异性朋友边界
  "bottom-line", // 底线·雷区
  "intimacy-attitude", // 性观念·亲密态度
  "intimate-interaction", // 亲密互动（落在亲密边界语义内的动作，非关闭项）
  "late-night-topic", // 深夜话题（无直连 §4 主题，作内容风险提示）
] as const;

/**
 * 泛安全元数据标签（既有 SSOT 5 项中除 physical-contact 外的 4 项 ＋ A9 新增 1 项，避免重复登记）。
 *
 * `location-sensitive`（A9，2026-09-29 新增）：回程 / 距离量级类风险提示 —— 题面公开作答可能
 * 暴露「住得远不远、大致方向」。与 `relationship-sensitive` / `proximity` 同规：**不是** App
 * 用户可关闭项，只作泛安全元数据（`SSOT_BOUNDARY_TAG_MAP` 映为 `null`，不产出过滤标签）。
 * 来源：`temp/PACK1-ROUND3-REVIEW.md` §8 判「`277` 不必改题面」⇒ admission 阶段按
 * `lib/v2-content/pack1-supplements/pack1-admission-prep.ts` 登记落地。
 */
export const V2_GENERIC_BOUNDARY_TAGS = [
  "relationship-sensitive",
  "proximity",
  "photo-optional",
  "external-participant",
  "location-sensitive",
] as const;

/**
 * 精确雷区标签全集（14 项，无重复）：精确 10 项 ∪ 泛 4 项。
 * 构建期「未知 tag 拒收」与本批过滤都以此集合为已知边界。
 * （P1-7 后不再包含 6 项语义标签；语义标签见 `V2_CONTENT_SEMANTIC_TAGS`。）
 */
export const V2_BOUNDARY_TAG_CATALOG = [
  ...V2_PRECISE_BOUNDARY_TAGS,
  ...V2_GENERIC_BOUNDARY_TAGS,
] as const;

/* -------------------------------------------------------------------------- */
/* 类型                                                                        */
/* -------------------------------------------------------------------------- */

export type V2Topic = (typeof V2_TOPICS)[number];
export type V2BarFit = (typeof V2_BAR_FIT)[number];
export type V2InformationGain = (typeof V2_INFORMATION_GAIN)[number];
export type V2SocialEnergy = (typeof V2_SOCIAL_ENERGY)[number];
export type V2RelationshipProgression = (typeof V2_RELATIONSHIP_PROGRESSION)[number];
export type V2IntimacyClass = (typeof V2_INTIMACY_CLASSES)[number];
export type V2InformationGoalType = (typeof V2_INFORMATION_GOAL_TYPES)[number];
export type V2BoundaryTagName = (typeof V2_BOUNDARY_TAG_CATALOG)[number];
export type V2ContentSemanticTag = (typeof V2_CONTENT_SEMANTIC_TAGS)[number];

/** 追加到既有 `V13MainlineCard` / `V13ExpansionCard` 的**可选**质量字段（老卡可缺）。 */
export interface V2CardQualityMetadata {
  topic?: V2Topic;
  barFit?: V2BarFit;
  informationGain?: V2InformationGain;
  /** Plan §3:54 一句可复述的目标陈述；不可填泛化「促进了解」。 */
  informationGoal?: string;
  socialEnergy?: V2SocialEnergy;
  relationshipProgression?: V2RelationshipProgression;
  intimacyClass?: V2IntimacyClass;
  /** Plan §3:58 主目标类型，只取一个。 */
  informationGoalType?: V2InformationGoalType;
  /** Plan §3:60 可选次主题数组，不计主要主题配额。 */
  secondaryTopics?: readonly V2Topic[];
}

/**
 * `isEffectiveInformationRound`（§7.2「有效信息轮」唯一谓词）逐轮实际消费的**两个**元数据字段。
 *
 * 之所以单列一个窄接口而不是直接复用 `V2CardQualityMetadata`：
 * - 有效轮判定只关心「信息增量档 + 主主题」两项；其余质量字段（barFit / informationGoal / …）
 *   只服务内容审查与快照入库，不参与运行期计数，混进运行期接口会把无关耦合带进来；
 * - `null` 语义与 `RecognitionEvidenceEntry` 的 `informationGain: … | null` / `topic: string | null`
 *   对齐——「未补标 = null」，由判定侧统一按 fail-closed（不计有效轮）处理，
 *   而不是在这里偷偷给个默认档位。
 */
export interface V2RoundMetadataFields {
  informationGain: V2InformationGain | null;
  topic: string | null;
}

/* -------------------------------------------------------------------------- */
/* 两层校验器（legacy fail-open / strict fail-closed）                          */
/* -------------------------------------------------------------------------- */

export interface V2CardQualityMetadataResult {
  ok: boolean;
  /** 出现的字段里非法或跨字段冲突的说明；空数组 = 无非法值。 */
  issues: string[];
  /**
   * 缺失（未出现或 `undefined`）的字段名。
   * - legacy：纯降级信号，不影响 `ok`；
   * - strict：`missing ∩ V2_REQUIRED_QUALITY_FIELDS` 非空即 `ok=false`。
   */
  missing: string[];
  /** 实际出现且合法的字段名。 */
  present: string[];
}

/** 本模块覆盖的全部质量字段（Plan §3 表中属本模块者，含唯一可选字段 secondaryTopics）。 */
const QUALITY_FIELDS: readonly (keyof V2CardQualityMetadata)[] = [
  "topic",
  "barFit",
  "informationGain",
  "informationGoal",
  "socialEnergy",
  "relationshipProgression",
  "intimacyClass",
  "informationGoalType",
  "secondaryTopics",
];

/**
 * strict 合同的**必填**字段（Plan §3 表「必填=是」且属本模块质量字段者）；
 * `secondaryTopics` 按 Plan §3:60 为可选，不在其中。
 */
export const V2_REQUIRED_QUALITY_FIELDS: readonly (keyof V2CardQualityMetadata)[] = QUALITY_FIELDS.filter(
  (field) => field !== "secondaryTopics",
);

const REQUIRED_FIELD_SET: ReadonlySet<string> = new Set<string>(V2_REQUIRED_QUALITY_FIELDS);

/** 枚举字段：出现即必须是合法枚举字符串；否则计入 issues。 */
function enumIssue(field: string, value: unknown, allowed: readonly string[]): string | null {
  if (typeof value !== "string" || !allowed.includes(value)) {
    return `${field} 非法枚举值：${String(value)}`;
  }
  return null;
}

/** 单字段校验：返回 null = 合法；返回字符串 = 非法说明（计入 issues）。缺失/undefined 由调用方处理。 */
function validateQualityField(field: keyof V2CardQualityMetadata, value: unknown): string | null {
  switch (field) {
    case "informationGoal": {
      if (typeof value !== "string") return `informationGoal 非法值：${String(value)}`;
      const goal = value.trim().replace(/[。.!！\s]+$/u, "");
      if (goal.length === 0) return "informationGoal 不可为空（Plan §3:54）";
      if (goal === V2_GENERIC_INFORMATION_GOAL) {
        return `informationGoal 不得填泛化目标「${V2_GENERIC_INFORMATION_GOAL}」（Plan §3:54）`;
      }
      return null;
    }
    case "secondaryTopics": {
      if (!Array.isArray(value)) return `secondaryTopics 非法值：${String(value)}`;
      for (const topic of value) {
        if (typeof topic !== "string" || !(V2_TOPICS as readonly string[]).includes(topic)) {
          return `secondaryTopics 非法枚举值：${String(topic)}`;
        }
      }
      return null;
    }
    case "topic":
      return enumIssue("topic", value, V2_TOPICS);
    case "barFit":
      return enumIssue("barFit", value, V2_BAR_FIT);
    case "informationGain":
      return enumIssue("informationGain", value, V2_INFORMATION_GAIN);
    case "socialEnergy":
      return enumIssue("socialEnergy", value, V2_SOCIAL_ENERGY);
    case "relationshipProgression":
      return enumIssue("relationshipProgression", value, V2_RELATIONSHIP_PROGRESSION);
    case "intimacyClass":
      return enumIssue("intimacyClass", value, V2_INTIMACY_CLASSES);
    case "informationGoalType":
      return enumIssue("informationGoalType", value, V2_INFORMATION_GOAL_TYPES);
    default:
      return null;
  }
}

interface CollectedQualityFields {
  issues: string[];
  missing: string[];
  present: string[];
}

/** 共享收集：枚举合法性 + 题面目标合法性 + 跨字段互斥；两层校验器共用，只有判定 `ok` 的规则不同。 */
function collectQualityFields(input: unknown): CollectedQualityFields | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return null;

  const record = input as Record<string, unknown>;
  const issues: string[] = [];
  const missing: string[] = [];
  const present: string[] = [];

  for (const field of QUALITY_FIELDS) {
    if (!(field in record) || record[field] === undefined) {
      missing.push(field);
      continue;
    }
    const issue = validateQualityField(field, record[field]);
    if (issue !== null) {
      issues.push(issue);
      continue;
    }
    present.push(field);
  }

  // 跨字段互斥（Plan §3:57–:58、:102）。
  if (record.intimacyClass === "action" && record.topic === V2_INTIMACY_ACTION_FORBIDDEN_TOPIC) {
    issues.push(
      `intimacyClass=action 不得同时以「${V2_INTIMACY_ACTION_FORBIDDEN_TOPIC}」为主题（action 只计动作/Consent）`,
    );
  }
  if (record.intimacyClass === "action" && record.informationGoalType === V2_ACTION_FORBIDDEN_GOAL_TYPE) {
    issues.push(
      `intimacyClass=action 不得同时 informationGoalType=${V2_ACTION_FORBIDDEN_GOAL_TYPE}（action 只计动作/Consent）`,
    );
  }

  return { issues, missing, present };
}

function nonObjectResult(): V2CardQualityMetadataResult {
  return {
    ok: false,
    issues: ["metadata 非对象"],
    missing: [...QUALITY_FIELDS],
    present: [],
  };
}

/**
 * **legacy／兼容读取**校验器（fail-open）。
 *
 * 用途：加载既有 SSOT 卡（旧 350+40，schema 2.3，缺新质量字段），
 * 只校验「实际出现的字段」是否合法 + 跨字段互斥；缺失字段记入 `missing` 但**不影响 `ok`**。
 *
 * ⚠️ 这是兼容，不是合规。**不得**用它做正式 fixed snapshot / manifest / 新题冻结的入库门禁，
 * 那些路径一律走 `validateFixedCardMetadataStrict()`。
 */
export function validateLegacyCardQualityMetadata(input: unknown): V2CardQualityMetadataResult {
  const collected = collectQualityFields(input);
  if (collected === null) return nonObjectResult();
  return { ok: collected.issues.length === 0, ...collected };
}

/**
 * **正式入库门禁**校验器（fail-closed）。
 *
 * 用途：新固定题库的 fixed snapshot / manifest / 新题冻结。判定规则：
 * 1. `missing ∩ V2_REQUIRED_QUALITY_FIELDS` 非空 → `ok=false`（Plan §3:43–:60 必填字段、
 *    §集中验收汇总 :196「合同必填字段/枚举 schema 校验失败数=0」、:198「逐卡必填字段完整、未审题=0」）；
 * 2. `issues` 非空 → `ok=false`（非法枚举 / 非法目标 / 跨字段互斥）；
 * 3. `barFit` 出现即必须为 `PASS`，`BORDERLINE`/`FAIL` → `ok=false`
 *    （Plan §3:52「正式快照只能 PASS」、§集中验收汇总 :197「FAIL/BORDERLINE 入快照数=0」）。
 *
 * 缺失字段仍记入 `missing`（含可选字段 `secondaryTopics`），但只有必填子集缺字段才判 FAIL。
 * 不允许为了让旧卡过门槛而放宽本函数——旧卡走 legacy。
 */
export function validateFixedCardMetadataStrict(input: unknown): V2CardQualityMetadataResult {
  const collected = collectQualityFields(input);
  if (collected === null) return nonObjectResult();

  const issues = [...collected.issues];

  // Plan §3:52 / §集中验收 :197：正式快照 barFit 只能 PASS。
  if (collected.present.includes("barFit")) {
    const barFit = (input as Record<string, unknown>).barFit;
    if (barFit !== "PASS") {
      issues.push(`barFit=${String(barFit)}：正式快照只允许 PASS（Plan §3:52 / §集中验收汇总 :197）`);
    }
  }

  const missingRequired = collected.missing.some((field) => REQUIRED_FIELD_SET.has(field));

  return {
    ok: issues.length === 0 && !missingRequired,
    issues,
    missing: collected.missing,
    present: collected.present,
  };
}

/* -------------------------------------------------------------------------- */
/* 精确雷区过滤（V2.2 §3.1）                                                   */
/* -------------------------------------------------------------------------- */

const CATALOG_SET: ReadonlySet<string> = new Set<string>(V2_BOUNDARY_TAG_CATALOG);

/**
 * 是否为已登记的**雷区标签**（全集内，精确 10 ∪ 泛 4）。
 * 注意：`V2_CONTENT_SEMANTIC_TAGS` 的 6 项语义标签**不在**此集合内（P1-7），
 * 它们不是用户可关闭项，传进来会被判为未知 tag。
 */
export function isKnownBoundaryTag(tag: string): boolean {
  return CATALOG_SET.has(tag);
}

/** 卡上未登记的雷区标签（构建期应拒收；空数组 = 全部已知）。 */
export function findUnknownBoundaryTags(tags: readonly string[]): string[] {
  return tags.filter((tag) => !CATALOG_SET.has(tag));
}

/**
 * 精确雷区过滤：给定一张卡的 `boundaryTags` 与「用户关闭的雷区集合」，
 * 返回该卡是否可出。规则（V2.2 §3.1:79）：**一题可多标签，命中任一关闭项即不可出**；
 * 关闭集合为空则全部可出。
 *
 * `disabledTags` 只应来自 App 的 10 个用户开关（`BOUNDARIES` 的 tag）；
 * P1-7 后 `V2_CONTENT_SEMANTIC_TAGS` 不参与本过滤，语义标签不会命中用户关闭集合。
 */
export function cardPassesBoundaryFilter(
  cardBoundaryTags: readonly string[],
  disabledTags: ReadonlySet<string>,
): boolean {
  for (const tag of cardBoundaryTags) if (disabledTags.has(tag)) return false;
  return true;
}

/** 批量版：返回在给定关闭集合下仍可出的卡（保持输入顺序）。 */
export function filterCardsByDisabledBoundaries<T extends { boundaryTags: readonly string[] }>(
  cards: readonly T[],
  disabledTags: ReadonlySet<string>,
): T[] {
  return cards.filter((card) => cardPassesBoundaryFilter(card.boundaryTags, disabledTags));
}
