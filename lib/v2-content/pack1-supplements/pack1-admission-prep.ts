/**
 * A8｜**admission 待收条件登记**（内容侧登记真源；A9 起被准入聚合模块消费落地）。
 *
 * ## 这是什么
 * 主审（`temp/PACK1-ROUND3-REVIEW.md` §1/§8，承接 Round-2 §F）判定：若干卡的**题面本身没有问题**，
 * 卡点在于「投放条件」—— 即 **admission 阶段**应把 `responseMode` 收成私答、或给 `boundaryTags`
 * 挂一个**泛安全元数据**（供运行时过滤）。A8 把「到时候该收什么」**机器可读地登记**在这里；
 * **A9 已按本表落地**（见 `lib/v2-content/pack1-admission.ts`），避免靠记忆/散文。
 *
 * ## ⛔ 边界（A9 后更新：本表**已被准入消费**）
 * 1. **本表是登记真源**：A9 由 `lib/v2-content/pack1-admission.ts` **import 本表并逐条落地**
 *    （`PACK1_ADMISSION_CARDS` 的 `responseMode` / `boundaryTags`），**单一真源、不抄第二份**。
 * 2. **卡源字面量不动**：各 planning 内容模块（golden12 / rewrites / replaces / supplements）
 *    的卡面**原样保留** `responseMode:"public"`、`boundaryTags` 不含登记值；落地只发生在聚合视图。
 * 3. **不改准入逻辑**：Formal 与否仍**只**由 manifest 独立审查输入（`bar-fit-review-input.ts`
 *    → `fixed-content-manifest-build.ts` 四条件）决定；本表不参与任何准入判定。
 * 4. **标签是「泛安全元数据」**，不是精确雷区枚举（Plan §3.1「题面真实命中才写」的精确项另有其表）。
 *
 * ## 登记来源（逐条可追溯）
 * | 卡 | 待收条件 | 来源 |
 * |---|---|---|
 * | `267` | `responseMode: private-individual` ＋ `boundaryTags: ["proximity"]` | Round-3 §1/§4 约束①（A7 已判、A8 维持） |
 * | `269` | 同 `267`（H4 亲密档两张一起收，不宜只收 267） | Round-3 §1 `269` 行 |
 * | `259` | `boundaryTags: ["relationship-sensitive"]` | Round-2 §F（A7 沿用登记，A8 一并归档） |
 *
 * ⚠️ A9-R6（2026-09-29 内容裁决）：原 `277` 的 `location-sensitive` 登记**随该卡退役一并作废**——
 * 裁决理由为「内容本身不好玩」，⛔ 不得用泛安全标签给它续命；277 题面归档在
 * `lib/v2-content/archive/retired-pack1-r6-2026-09-29.ts`。`location-sensitive` 仍保留在
 * 泛安全元数据闭集里（供后续批次按需登记），但当前**无卡使用**。
 */

/** 允许登记的泛安全元数据标签（闭集；新增须经主审批准）。 */
export const PACK1_PENDING_ADMISSION_BOUNDARY_TAGS = [
  "proximity",
  "location-sensitive",
  "relationship-sensitive",
] as const;

export type Pack1PendingAdmissionBoundaryTag = (typeof PACK1_PENDING_ADMISSION_BOUNDARY_TAGS)[number];

/** 登记原因（闭集，便于机器对账）。 */
export type Pack1PendingAdmissionReason = "private_response_mode" | "boundary_tag";

export interface Pack1PendingAdmissionOverride {
  readonly cardId: string;
  /** admission 时要收成的 `responseMode`（合法枚举值；**不上卡片**）。 */
  readonly admissionResponseMode?: "private-individual";
  /** admission 时要补的 `boundaryTags`（**不上卡片**）。 */
  readonly admissionBoundaryTags?: readonly Pack1PendingAdmissionBoundaryTag[];
  readonly reasons: readonly Pack1PendingAdmissionReason[];
  /** 首次登记该条件的批次（可追溯）。 */
  readonly registeredIn: readonly ("A7" | "A8" | "Round2")[];
  readonly note: string;
}

/** 待收条件登记表（升序）。**只准备不落地** —— 卡面现值不变。 */
export const PACK1_PENDING_ADMISSION_OVERRIDES: readonly Pack1PendingAdmissionOverride[] = [
  {
    cardId: "PN-TRUTH-259",
    admissionBoundaryTags: ["relationship-sensitive"],
    reasons: ["boundary_tag"],
    registeredIn: ["Round2", "A8"],
    note: "公开问「异性朋友」可能在有伴侣同桌时引发道德质问；Round-2 §F 起登记，A8 一并归档（题面不动）。",
  },
  {
    cardId: "PN-TRUTH-267",
    admissionResponseMode: "private-individual",
    admissionBoundaryTags: ["proximity"],
    reasons: ["private_response_mode", "boundary_tag"],
    registeredIn: ["A7", "A8"],
    note: "公开场问「亲密里哪样最加分」偏重；Round-3 §1 维持「改投放条件不改题面」，A8 维持并机器化登记。",
  },
  {
    cardId: "PN-TRUTH-269",
    admissionResponseMode: "private-individual",
    admissionBoundaryTags: ["proximity"],
    reasons: ["private_response_mode", "boundary_tag"],
    registeredIn: ["A8"],
    note: "与 267 同属 H4 亲密档，主审要求两张一起收；A8 一并登记（题面/字段均不动）。",
  },
  // A9-R6（2026-09-29 内容裁决）：原 `PN-TRUTH-277` 的 `location-sensitive` 登记随该卡**退役**一并作废
  // （⛔ 不得用泛安全标签给它续命）；277 的题面逐字归档在
  // `lib/v2-content/archive/retired-pack1-r6-2026-09-29.ts`。
];

/** 待收条件的卡 ID 清单（升序，派生自登记表，不手写）。 */
export const PACK1_PENDING_ADMISSION_CARD_IDS: readonly string[] = PACK1_PENDING_ADMISSION_OVERRIDES.map(
  (entry) => entry.cardId,
);
