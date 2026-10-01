/**
 * A9｜第一包重构批（Golden 12 ＋ REWRITE 7 ＋ REPLACE 19 ＋ 补卡 14，`PN-TRUTH-232 ~ 283` 号段）
 * 的**准入聚合视图**（唯一出口，供运行时卡源与准入测试共用）。
 *
 * ## 这是什么 / 不是什么
 * - **是**：把四个 planning-only 内容模块**聚合成一条**、并**按 A8 登记落地待收字段**的
 *   内容侧模块。桥接（`v2-card-bridge.ts`）从本模块取卡，因此本批与 KEEP 5 同形地进入
 *   运行时卡源（`mainlineSsotCards()` / `mainlineRuntimeCards()`），再经**同一条既有准入路径**
 *   （`bar-fit-review-input.ts` 的独立审查输入 → `fixed-content-manifest-build.ts` 的四条件）
 *   决定是否进 Formal。**本模块不产出任何准入结论、不碰准入条款。**
 * - **不是**第二条准入路径：Formal 与否仍**只**由 manifest 独立审查输入决定。
 *
 * ## A9-R6（2026-09-29 内容裁决）
 * `PN-TRUTH-236 / 263 / 277` 已裁决退役 ⇒ 移出各 planning 卡源、逐字归档在
 * `lib/v2-content/archive/retired-pack1-r6-2026-09-29.ts`。故本聚合视图现为 **48 张**
 * （张数一律由 `PACK1_ADMISSION_CARD_IDS.length` 派生，⛔ 不写死 48/52）。
 *
 * ## A9-R7（2026-09-29 内容返工）
 * `PN-TRUTH-249`（与 250 同轴）经内容返工裁决退役 ⇒ 移出 REWRITE 卡源、逐字归档在
 * `lib/v2-content/archive/retired-pack1-r7-2026-09-29.ts`；另 5 张（`203 / 241 / 252 / 262 / 266`）
 * 按 `docs/review/RESEARCH_REVIEW-PACK1-FINAL-54.md` 返工题面（`203` 属 KEEP 包，不在本批）。
 *
 * ## 待收字段落地（A8 登记 → A9 执行）
 * A8（`pack1-supplements/pack1-admission-prep.ts`）把「题面没问题、卡点是投放条件」的卡登记为
 * `PACK1_PENDING_ADMISSION_OVERRIDES`。A9 在本模块里**读该表并逐条落地**（单一真源，不抄第二份）：
 * - `267` / `269`：`responseMode: "private-individual"` ＋ `boundaryTags: ["proximity"]`；
 * - `259`：`boundaryTags: ["relationship-sensitive"]`。
 *   （原 `277` 的 `location-sensitive` 登记随该卡退役作废。）
 * 落地只作用于**本聚合视图**（`PACK1_ADMISSION_CARDS`）；各 planning 卡源的**字面量保持原样**
 * （`pack1-admission-prep.ts` 的「只准备不落地」语义对卡源仍成立），避免同一事实两处存放。
 *
 * ## planning-only 锁
 * `category` / `followUpHook` / `expectedAnswerShape` 仍**不进** Runtime / 正式 `GameCard` schema；
 * 本模块只在 planning 侧聚合（桥接会按超集原样 spread，桥接不读这三个字段）。
 *
 * ## 内容指纹（防「偷偷改题面绕过主审」）
 * `pack1AdmissionFingerprintInput()` 给出逐卡**稳定序列化**（与对象 key 顺序无关），
 * 调用方（测试 / 脚本）对它取 sha256 即得内容指纹；`PACK1_ADMISSION_CONTENT_FINGERPRINTS`
 * 是**冻结快照**。任何题面 / heat / intensity / category / hook / shape / topic 改动都会让指纹失配。
 * 本模块**只产指纹输入串，不 import node:crypto**（可被浏览器包安全引用）。
 */

import { GOLDEN_12_CARDS, GOLDEN_12_CARD_IDS, type GoldenTruthCard } from "./golden12/golden-12-cards";
import { PACK1_REPLACE_CARDS, PACK1_REPLACE_CARD_IDS } from "./pack1-replaces/pack1-replace-cards";
import { PACK1_REWRITE_CARDS, PACK1_REWRITE_CARD_IDS } from "./pack1-rewrites/pack1-rewrite-cards";
import type { FormalTruthCard } from "./formal-truth-pack";
import {
  PACK1_PENDING_ADMISSION_OVERRIDES,
  type Pack1PendingAdmissionBoundaryTag,
} from "./pack1-supplements/pack1-admission-prep";
import { PACK1_SUPPLEMENT_CARDS, PACK1_SUPPLEMENT_CARD_IDS } from "./pack1-supplements/pack1-supplement-cards";
import type { V2BoundaryTagName } from "./v2-card-metadata";

/**
 * 现役本批按批次分组（ID 一律**从卡源派生**，不手抄；键名是稳定标识，不是数量）。
 * 批次口径见 `temp/PACK1-ROUND3-REVIEW.md` §9.6（Golden 232~243 / REWRITE 244~250 /
 * REPLACE 251~269 / 补卡 270~283）。
 */
export const PACK1_ADMISSION_BATCHES: Readonly<Record<string, readonly string[]>> = {
  golden12: GOLDEN_12_CARD_IDS,
  rewrite: PACK1_REWRITE_CARD_IDS,
  replace: PACK1_REPLACE_CARD_IDS,
  supplement: PACK1_SUPPLEMENT_CARD_IDS,
} as const;

/** 逐批人类可读标签（报告与测试共用，避免手抄批次名）。 */
export const PACK1_ADMISSION_BATCH_LABELS: Readonly<Record<string, string>> = {
  golden12: "Golden 12 样板卡",
  rewrite: "REWRITE 7 重写批（旧 201/202/225/226/228/230/231 方向）",
  replace: "REPLACE 19 新 ID 批（旧 204/206~224 方向）",
  supplement: "补卡 14（H1/H2/H3 库存补位）",
} as const;

/** 四个 planning 卡源合并后的**原始**现役卡（未落地待收字段；升序由各源自身保证，见断言）。 */
export const PACK1_ADMISSION_RAW_CARDS: readonly GoldenTruthCard[] = [
  ...GOLDEN_12_CARDS,
  ...PACK1_REWRITE_CARDS,
  ...PACK1_REPLACE_CARDS,
  ...PACK1_SUPPLEMENT_CARDS,
];

/**
 * 落地 A8 待收字段后的**有效卡**（桥接与本模块对外视图都以它为准）：
 * 按 `PACK1_PENDING_ADMISSION_OVERRIDES` 逐条合并 `responseMode` / `boundaryTags`。
 * 未登记的卡原样返回（**不造默认值**）。
 */
export const PACK1_ADMISSION_CARDS: readonly GoldenTruthCard[] = PACK1_ADMISSION_RAW_CARDS.map((card) => {
  const override = PACK1_PENDING_ADMISSION_OVERRIDES.find((entry) => entry.cardId === card.cardId);
  if (!override) return card;
  const next: GoldenTruthCard = { ...card };
  if (override.admissionResponseMode !== undefined) next.responseMode = override.admissionResponseMode;
  if (override.admissionBoundaryTags && override.admissionBoundaryTags.length > 0) {
    const merged = new Set<V2BoundaryTagName>(card.boundaryTags as readonly V2BoundaryTagName[]);
    for (const tag of override.admissionBoundaryTags as readonly Pack1PendingAdmissionBoundaryTag[]) {
      merged.add(tag as V2BoundaryTagName);
    }
    next.boundaryTags = [...merged];
  }
  return next;
});

/** 现役本批 ID（升序，派生自有效卡；不得手写）。 */
export const PACK1_ADMISSION_CARD_IDS: readonly string[] = PACK1_ADMISSION_CARDS.map((card) => card.cardId);

/** planning-only 三字段：**不得**进 Runtime / 正式 `GameCard` schema（见 `tests/unit/golden-12.test.ts`）。 */
export const PACK1_PLANNING_ONLY_FIELDS = ["category", "followUpHook", "expectedAnswerShape"] as const;

/**
 * 运行期投影：剥掉 planning-only 三字段后的 `FormalTruthCard`（与 KEEP 5 **完全同形**）。
 * 桥接的 `mainlineRuntimeCards()` / `mainlineCardMetaById()` 用这一份，保证设计字段不泄漏到运行时；
 * 指纹与内容审计用 `PACK1_ADMISSION_CARDS`（含三字段）。
 */
export const PACK1_ADMISSION_RUNTIME_CARDS: readonly FormalTruthCard[] = PACK1_ADMISSION_CARDS.map((card) => {
  const out: Record<string, unknown> = {};
  const planningOnly: readonly string[] = PACK1_PLANNING_ONLY_FIELDS;
  for (const [key, value] of Object.entries(card)) {
    if (!planningOnly.includes(key)) out[key] = value;
  }
  return out as unknown as FormalTruthCard;
});

/** ID → 有效卡（含已落地的待收字段）。 */
export const PACK1_ADMISSION_CARD_BY_ID: ReadonlyMap<string, GoldenTruthCard> = new Map(
  PACK1_ADMISSION_CARDS.map((card) => [card.cardId, card]),
);

/** 指纹覆盖的字段（`题面 + Heat + intensity + category/hook/shape + topic + 其余质量与安全字段`）。 */
const FINGERPRINT_FIELDS = [
  "cardId",
  "text",
  "heatMin",
  "heatMax",
  "intensity",
  "category",
  "followUpHook",
  "expectedAnswerShape",
  "topic",
  "informationGain",
  "informationGoal",
  "socialEnergy",
  "relationshipProgression",
  "intimacyClass",
  "informationGoalType",
  "secondaryTopics",
  "boundaryTags",
  "responseMode",
  "consentMode",
  "relationStage",
  "targetMode",
  "interactionType",
  "matchRequired",
  "fallbackPolicy",
  "signalEffects",
  "postAction",
  "barFit",
] as const;

/** 稳定 JSON：对象 key 升序、数组保持原序（数组语义由内容源负责稳定）。 */
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
}

/**
 * 逐卡内容指纹的**输入串**（稳定序列化）。调用方取 sha256 即得内容指纹；
 * 改了任一被覆盖字段（尤其题面 `text`）都会得到不同的串 ⇒ 指纹失配。
 */
export function pack1AdmissionFingerprintInput(card: GoldenTruthCard): string {
  const source = card as unknown as Record<string, unknown>;
  const picked: Record<string, unknown> = {};
  for (const field of FINGERPRINT_FIELDS) picked[field] = source[field];
  return canonicalize(picked);
}

/**
 * 本批现役卡的**内容指纹冻结快照**（sha256 of `pack1AdmissionFingerprintInput(card)`）。
 *
 * 变更流程：只有内容主审重审并**改写题面/字段**时才允许连同本表一起更新（同时须记 HANDOFF）；
 * 单纯推进准入状态（进 / 出 Formal）**不得**改本表。
 * ⚠️ 例外（A9-R6，2026-09-29）：`236 / 263 / 277` 经**内容裁决退役**（移出卡源），
 * 本表对应条目随之删除（其退役前 payloadHash 逐字冻结在
 * `lib/v2-content/archive/retired-pack1-r6-2026-09-29.ts`）。
 * ⚠️ 例外（A9-R7，2026-09-29）：`249` 经**内容返工裁决退役**（与 250 同轴，移出卡源），
 * 本表条目随之删除（退役前 payloadHash 冻结在
 * `lib/v2-content/archive/retired-pack1-r7-2026-09-29.ts`）；`241 / 252 / 262 / 266` 因题面返工
 * 指纹同步更新（内容主审返工，非单纯推进准入状态）。
 */
export const PACK1_ADMISSION_CONTENT_FINGERPRINTS: Readonly<Record<string, string>> = {
  /* FROZEN-FINGERPRINTS:BEGIN */
  "PN-TRUTH-232": "448764ce6485325c065566708b5d969847644ab6099c8a8a78933ce64f6f1782",
  "PN-TRUTH-233": "4bcb16a862f022bf003c2b0eeaec71fa502311462b3b158a5d6d5e4a2eeee96d",
  "PN-TRUTH-234": "c8c4d6fcab7d0b9a34605ebbf6aff41cd12f00f43a9a4fa6cc9e543eb7a2b533",
  "PN-TRUTH-235": "d13e253aa7016ae85ef2333960303602dc6bbe29adaaeecb36952844a89f62ef",
  "PN-TRUTH-237": "bde08f2b21d1ea960dd35e7646e61ba6c4ecbe32a43ec9d5beca02b07122bed9",
  "PN-TRUTH-238": "6c2c75a2b3d3d480745826bdd1a56d1a1b81902c6f6e67a9967fa8b1a5d72f24",
  "PN-TRUTH-239": "0a4ab1f4e817e2f0065edf4a50626f74f60998db48d42807d9ae330f618684cc",
  "PN-TRUTH-240": "397ec1a7ddffbcedb855021d0af51ab64b40e4b2b7eea0612be1426755fa4d44",
  "PN-TRUTH-241": "7c1cd24585ad02f61e66e364c410576142a9df4a83cc4c4dccc793becc5e1a73",
  "PN-TRUTH-242": "c7e12245b01fad5a0c59107ddb4af5e99fefe3aef41f383b923fd8a4d35161ef",
  "PN-TRUTH-243": "54a2558eb5991375aeb0b6f3bc75bd005b45b758ce7e6534596b0cfafbb31cd7",
  "PN-TRUTH-244": "577dbafae48e5823e57e72f816cf2e4e32cbf33ef01cac43026d7216a3c7d3ac",
  "PN-TRUTH-245": "83135ab4c169a407844dcc603da710770df047511ff1d3406181390e28913b81",
  "PN-TRUTH-246": "85183314712c5ecf3d9bc85485e8a145e37e0c0f3137538032e3bff475628d2d",
  "PN-TRUTH-247": "3020ab3e466aaf98b2aef442693b13a791091ac098eb86b04dbfe33fbdd6bf50",
  "PN-TRUTH-248": "349658c586d96f1ce53f999ce1c04834917f2d7c73e0aa9b6b47691c8d45f6bd",
  "PN-TRUTH-250": "c3ca737b78f8e63135274187d921299b8faa63a60a88c967a471a5302833d91f",
  "PN-TRUTH-251": "7989df3892c0a423e1d17b4af2b9499cd726bbed28f744f975fc02d09f46dec0",
  "PN-TRUTH-252": "9b475e64bc3aa2d71882ab68215c9c395b2ca96b18c3bc116349884173dd96a6",
  "PN-TRUTH-253": "bfa1422ae487f260939dd663194f763333d865181e4e5b0b89e31011a83a0cff",
  "PN-TRUTH-254": "506857966c622ea040a3014911beee23a1651bc96c38fff634e34d28fd4ff9f9",
  "PN-TRUTH-255": "7a742425467d628bc2a49a5335c7b352e827e62cd6908a2d8770982e4594ee64",
  "PN-TRUTH-256": "9be3297a702d375d3ffce904de0386f40703ef110288fa62ffaf63fa559e2f7f",
  "PN-TRUTH-257": "98e9f107d047827a83f37454cda23f951f2b7eb631191301115215b3d3d6c76a",
  "PN-TRUTH-258": "46b506bc5d51b9f08f6db0ee31beffe225fd2abe2c02232a2f4dd5e08009c2d4",
  "PN-TRUTH-259": "38909bd40b648a94c7d716033263b2f7e78e83b7009e3bdb3c2ceabcccad1213",
  "PN-TRUTH-260": "a99962f98d030fe13385bd9a4ad3a90fe2df895fb02ba575a079a88ec9acf208",
  "PN-TRUTH-261": "f54cad9bdc505325e002c9cd4af8424441f58935f1bae0b863463786deec9fe6",
  "PN-TRUTH-262": "8a5d1f02b89a0f328bd73e2c0975ea64b46a891207caa530130ecb4518893ae0",
  "PN-TRUTH-264": "61a61a4ccb5c2ce1700f79064346fe8184d6aaa7b33b5b5fc1b832d22266aad3",
  "PN-TRUTH-265": "2ce0f8a04962d697dbdfc1e4db469c304d6c5e52fe7b4af8d27a5241dae0abde",
  "PN-TRUTH-266": "e250bcec7ab3c249664dec49e11f2ed906a1bb3a63f4778122f4e40d1c7b197b",
  "PN-TRUTH-267": "9c32e61c598d56c8c7b03329dffeb23d7b41dd48e2c4d0750be84a5ce9e85101",
  "PN-TRUTH-268": "234eb7e2675a21647d59f26f21048c67da9c4be8c3d9aaeefd51abd7a79dfa95",
  "PN-TRUTH-269": "2a552d081de948530fd452dc6eed78d38d4ea071bb921d8c03d582e806f489e1",
  "PN-TRUTH-270": "37da7c3d9b412f38b5fefed934e192d1864e20d5346867274cdf2733aa01ef77",
  "PN-TRUTH-271": "47f97665d48d6731120024973725f9238e5775069815f7b456f90fb6173dd8c6",
  "PN-TRUTH-272": "40fa3381fd8bd003832bb44adc1cd4b8b71ed9b31e83f6414e4dc389f5f24dcf",
  "PN-TRUTH-273": "c523fbb5dcf28128bfdd055aa58d56e961c55a36dc7d78e9ff86990ef0e54465",
  "PN-TRUTH-274": "e4e656318244fc310c516e5a374165d8de47fdfc0bfc7da17527e712f3678147",
  "PN-TRUTH-275": "dfcaafd745c0edfe3693fe0a36f3a92edf401d3d88761283416b44ba1fbacb0f",
  "PN-TRUTH-276": "ee4683ae4d46c44fcb49130231a17aea95133817d6d192f94f661f67d699a687",
  "PN-TRUTH-278": "99185221f9896e1696681805cf9fe3e80686331ce87ea5da5cbf3957f19e79da",
  "PN-TRUTH-279": "374a340a02e9185447a24c086e53ec850c0994a8fdf628bef4c39c8441f9b8bf",
  "PN-TRUTH-280": "3b5628477e7045d87e940a17642f2eba7e5b894b7ec940a5e7108c7867a624ee",
  "PN-TRUTH-281": "fb4b5831fa6eba01d02f07d0b66a24018cfd8aa41da21a6374130de43319d940",
  "PN-TRUTH-282": "98d1e788de1650afe6c4ff325bcb237b56d5acd126109591490995199cba3da3",
  "PN-TRUTH-283": "e317b6d52624a3b8533a7404a7f5994f9ff21ce60763129d246274bcafbc3ae5",
  /* FROZEN-FINGERPRINTS:END */
  /* 退役留痕（2026-09-29，非指纹表内容，仅供追溯）：曾有 4 张卡的条目在本表内、后被内容裁决删除——
   * A9-R6：PN-TRUTH-236 / 263 / 277（退役前 payloadHash 逐字冻结于
   *   lib/v2-content/archive/retired-pack1-r6-2026-09-29.ts）；
   * A9-R7：PN-TRUTH-249（lib/v2-content/archive/retired-pack1-r7-2026-09-29.ts）。
   * 详见本常量上方「⚠️ 例外」注释；本注释在 BEGIN/END 边界之外，不影响指纹表本体。 */
};
