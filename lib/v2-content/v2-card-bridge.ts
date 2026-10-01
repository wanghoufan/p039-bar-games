/**
 * B7 / D1｜SSOT → 运行期 GameCard 桥（生产内容真源的唯一出口）。
 *
 * 真源：`lib/v2-content/generated/v2-ssot.generated.json`（V1.3 Frozen 350+40，schema 2.3），
 * 由 V2ContentAdapter 深冻结后只读访问。本模块只做「SSOT 字段 → GameCard 字段」的确定映射，
 * 不新增题面、不改强度/档位、不做任何 seed↔PN 等价换算（`migrationIdPolicy=NONE`）。
 *
 * 旧 `seed-*` 种子（lib/game-packs/built-in-seeds）只保留 history-only 兼容：
 * - 旧 Session 的 `deckSnapshot`/`rounds` 里已落库的 seed 卡照旧可读、可展示（历史事实不改写）；
 * - 运行期新牌堆（buildPlayableDeck / refillPackFromSeeds）不再从旧种子取卡，本模块也不产出 seed-* id。
 *
 * 映射口径（逐条可在 tests/unit/v2-b7-content-switch.test.ts 复核）：
 * - gameType → packId/cardType：接回既有 pack 与 renderer（pointing/binary-choice/compatibility）。
 * - targetMode → participantMode：谁是本题的参与者（全桌/单人/一对）。
 * - boundaryTags：内容标签 → App 既有 `BoundaryTag` 枚举。Plan §3.1 的**精确 10 项**与 App 用户
 *   开关同名同义，1:1 直映；泛安全元数据（`relationship-sensitive` / `proximity`）**不自动**
 *   冒充精确开关（映射为「无对应开关」），只有题面真实命中精确开关才产出过滤标签；
 *   未登记标签一律抛错（fail closed），防止真源漂移后静默放行。
 * - consentMode → instruction：把 SSOT 的同意口径渲染成卡面说明，不靠玩家脑补。
 *
 * ## 第一包正式内容（CONTENT-01 / C1-3）：与 SSOT 同一条路，不另开第二条
 * `mainlineSsotCards()` 在既有 350 张**之后追加** `FORMAL_TRUTH_CARDS`（`PN-TRUTH-201~224`），
 * 保 `[0]` 稳定、不改既有取卡顺序。第一包卡自带的 Plan §3 质量字段由 `toMainlineGameCard`
 * 一并转发到运行期 `GameCard` 侧车（`GameCard` 的冻结 schema 没有这些键，故作为额外属性挂上，
 * 与 manifest 构建 / 质量侧车同一条读取路径；旧 SSOT 卡没有这些键 ⇒ 行为逐字不变）。
 */

import type { BoundaryTag, GameCard, Intensity } from "@/lib/domain/schemas";
import { getGamePack } from "@/lib/game-packs/registry";
import { CONSENT_INSTRUCTION } from "./bar-fit-input";
import { FORMAL_TRUTH_BOOTSTRAP_CARDS } from "./formal-truth-bootstrap-pack";
import { FORMAL_TRUTH_CARDS, type FormalTruthCard } from "./formal-truth-pack";
import { PACK1_ADMISSION_RUNTIME_CARDS } from "./pack1-admission";
import { getV2ContentAdapter } from "./v2-content-adapter";
import { findUnknownBoundaryTags, type V2CardQualityMetadata } from "./v2-card-metadata";
import {
  V2_GAME_TYPES,
  type V13ExpansionCard,
  type V13MainlineCard,
} from "./v2-types";

/**
 * SSOT `consentMode` → 卡面说明的唯一归属已迁到 `lib/v2-content/bar-fit-input.ts`
 * （BAR-FIT canonical input 同源取用，保证「玩家实际必须听到的 instruction」两处逐字一致）。
 * 这里原样再导出，保持本模块既有公开面不变。
 */
export { CONSENT_INSTRUCTION };

/** 扩圈（10b）玩法 id：保留自身 deck，不参与 Pair Score / MATCH，也不接管 relationship-aware 路由。 */
export const EXPANSION_PACK_ID = "expansion" as const;
export const EXPANSION_CARD_TYPE = "expansion" as const;

/**
 * SSOT gameType → 现存 pack/cardType。
 * 7 类主线（truth/dare/most_likely/never_have_i/either_or/pointing/chemistry）落到 6 个玩法，
 * cardType 必须落在该 pack 的 supportedCardTypes 里，否则 renderer 会走错（测试断言）。
 */
export const V2_MAINLINE_PACK_BY_GAME_TYPE: Record<
  (typeof V2_GAME_TYPES)[number],
  { packId: string; cardType: string }
> = {
  truth: { packId: "truth-dare", cardType: "truth" },
  dare: { packId: "truth-dare", cardType: "dare" },
  most_likely: { packId: "most-likely", cardType: "vote" },
  never_have_i: { packId: "never-have", cardType: "statement" },
  either_or: { packId: "would-you-rather", cardType: "would-you-rather" },
  pointing: { packId: "pointing-game", cardType: "pointing" },
  chemistry: { packId: "compatibility-test", cardType: "compatibility" },
};

/** SSOT targetMode → 既有 participantMode（谁是本题参与者）。 */
export const PARTICIPANT_MODE_BY_TARGET_MODE: Record<
  V13MainlineCard["targetMode"],
  GameCard["participantMode"]
> = {
  "all-players": "all",
  "pair-vote": "all",
  "private-choice": "single",
  "system-opposite-sex": "single",
  "choose-opposite-sex": "single",
  "match-pair": "pair",
  "system-pair": "pair",
  "signal-pair": "pair",
};

/**
 * 内容边界标签 → App 既有雷区标签（`BoundaryTag`）。取值三态：
 * - `BoundaryTag`：产出该 App 雷区标签（命中即过滤）；
 * - `null`：**泛安全元数据**，没有对应的 App 用户开关，只作风险/能力提示，不产出过滤标签；
 * - 未登记（键不存在）：抛错（fail closed），防真源漂移后静默放行。
 *
 * 口径（Plan §3.1:79 明文）：
 * - **精确 10 项**就是现有 App 的 10 个用户雷区开关，**同名同义 1:1 直映**
 *   （`V2_PRECISE_BOUNDARY_TAGS` ↔ `lib/domain/schemas.ts` 的 `BoundaryTag`）；
 * - 泛标签 `proximity`（贴近/对视/坐旁边）**不自动**等于 `physical-contact`；
 *   `relationship-sensitive`（关系敏感）**不自动**等于 `ex-partner` —— 只有题面真实命中
 *   精确开关才写对应过滤标签（Plan §3.1 反例断言：仅贴近/对视不接触、仅关系敏感不涉及前任，
 *   关闭相应精确开关时都不得被误过滤）；
 * - `photo-optional` → `photo-video`、`external-participant` → `stranger-contact` 保留：
 *   这两项泛标签的语义本身就是「会拍摄」「会引入桌外参与者」，映射到相应用户开关是保守方向
 *   （缩圈卡整包依赖 `stranger-contact` 过滤，见 `tests/unit/v2-b7-content-switch.test.ts`）。
 */
export const SSOT_BOUNDARY_TAG_MAP: Record<string, BoundaryTag | null> = {
  // ── 精确 10 项（Plan §3.1，与 App BoundaryTag 同名同义）──────────────────
  "physical-contact": "physical-contact",
  alcohol: "alcohol",
  "ex-partner": "ex-partner",
  "sexual-history": "sexual-history",
  money: "money",
  "phone-privacy": "phone-privacy",
  "public-posting": "public-posting",
  "stranger-contact": "stranger-contact",
  "photo-video": "photo-video",
  "social-account": "social-account",
  // ── 泛安全元数据（无直连用户开关；不冒充精确开关）────────────────────────
  "relationship-sensitive": null,
  proximity: null,
  "location-sensitive": null,
  "photo-optional": "photo-video",
  "external-participant": "stranger-contact",
};

/**
 * 内容边界标签 → App 雷区标签数组。
 *
 * fail-closed 两道：
 * 1. `findUnknownBoundaryTags`（全集真源 = `V2_BOUNDARY_TAG_CATALOG`）检出未登记标签即抛错；
 * 2. 已登记但 `SSOT_BOUNDARY_TAG_MAP` 没给取值（真源漂移漏补）也抛错——不允许静默跳过。
 * `null` 取值是**显式的「无对应 App 开关」**，只跳过、不产出过滤标签，且去重并按输入序去重。
 */
export function mapSsotBoundaryTags(tags: readonly string[]): BoundaryTag[] {
  const unknown = findUnknownBoundaryTags(tags);
  if (unknown.length > 0) {
    throw new Error(`V2 边界标签未登记（fail closed）：${unknown.join(",")}`);
  }
  const mapped: BoundaryTag[] = [];
  for (const tag of tags) {
    if (!Object.prototype.hasOwnProperty.call(SSOT_BOUNDARY_TAG_MAP, tag)) {
      throw new Error(`V2 边界标签无映射（fail closed）：${tag}`);
    }
    const boundary = SSOT_BOUNDARY_TAG_MAP[tag];
    if (!boundary) continue; // 泛标签：无对应 App 用户开关，只作风险/能力提示
    if (!mapped.includes(boundary)) mapped.push(boundary);
  }
  return mapped;
}

const mainlineMinPlayers = (packId: string): number => {
  const pack = getGamePack(packId);
  if (!pack) throw new Error(`V2 主线 pack 未注册：${packId}`);
  return pack.minPlayers;
};

/**
 * 桥接输入的主线卡形状：SSOT 主线卡，或第一包正式卡（`FormalTruthCard`）。
 * 第一包的 `boundaryTags` 用的是 Plan §3.1 精确全集（比 SSOT 泛 5 项宽），
 * 且自带 Plan §3 质量字段；此处只**放宽输入类型**，两个真源文件一个字未动。
 */
type BridgeMainlineCard = Omit<V13MainlineCard, "boundaryTags"> & {
  readonly boundaryTags: readonly string[];
} & Partial<V2CardQualityMetadata>;

/**
 * Plan §3 质量字段（转发到运行期 `GameCard` 侧车的全部 9 项；`secondaryTopics` 可选，其余 8 项必填）。
 * `GameCard` 的冻结 schema（`lib/domain/schemas.ts`）不含这些键，故作为额外属性挂上——
 * manifest 构建（`hasAuditedMetadata` / `fixedCardPayload`）与质量侧车都按「卡上有没有这些键」读取，
 * **旧 SSOT 卡没有这些键 ⇒ 逐字不变**。
 */
const QUALITY_METADATA_FIELDS = [
  "topic",
  "barFit",
  "informationGain",
  "informationGoal",
  "socialEnergy",
  "relationshipProgression",
  "intimacyClass",
  "informationGoalType",
  "secondaryTopics",
] as const;

/** 把内容卡上**实际存在**的 Plan §3 质量字段原样挂到 `GameCard` 侧车（不造默认值）。 */
function withQualityMetadata(card: GameCard, source: Partial<V2CardQualityMetadata>): GameCard {
  const target = card as unknown as Record<string, unknown>;
  const record = source as Record<string, unknown>;
  for (const field of QUALITY_METADATA_FIELDS) {
    const value = record[field];
    if (value !== undefined) target[field] = value;
  }
  return card;
}

function toMainlineGameCard(card: BridgeMainlineCard): GameCard {
  const mapping = V2_MAINLINE_PACK_BY_GAME_TYPE[card.gameType];
  if (!mapping) throw new Error(`V2 SSOT gameType 无映射：${card.gameType}`);
  return withQualityMetadata(
    {
      // ID 命名空间唯一：PN-*（迁移 policy NONE —— 旧 seed-* 不做等价翻译）。
      id: card.cardId,
      packId: mapping.packId,
      type: mapping.cardType,
      content: card.text,
      instruction: CONSENT_INSTRUCTION[card.consentMode],
      intensity: card.intensity as Intensity,
      tags: [],
      boundaryTags: mapSsotBoundaryTags(card.boundaryTags),
      minPlayers: mainlineMinPlayers(mapping.packId),
      participantMode: PARTICIPANT_MODE_BY_TARGET_MODE[card.targetMode],
      source: "builtin",
    },
    card,
  );
}

function toExpansionGameCard(card: V13ExpansionCard): GameCard {
  return {
    id: card.cardId,
    packId: EXPANSION_PACK_ID,
    type: EXPANSION_CARD_TYPE,
    content: card.text,
    instruction: CONSENT_INSTRUCTION[card.consentMode],
    intensity: card.minIntensity as Intensity,
    tags: [],
    boundaryTags: mapSsotBoundaryTags(card.boundaryTags),
    minPlayers: 2,
    participantMode: "all",
    source: "builtin",
  };
}

let mainlineCache: readonly GameCard[] | null = null;
let expansionCache: readonly GameCard[] | null = null;

/**
 * 主线卡（冻结 SSOT 350 张 + 第一包正式内容 24 张 `PN-TRUTH-201~224`）；
 * 生产牌堆的唯一内容来源，也是 manifest 构建与质量侧车的共同入口。
 *
 * **追加、不前置、不改排序**：第一包卡一律排在既有 350 张之后，保 `[0]` 稳定，
 * 既有取卡顺序语义逐字不变（`mainlineSsotCardsByPack(...)[0]` 仍是 `PN-TRUTH-001`）。
 */
export function mainlineSsotCards(): readonly GameCard[] {
  if (!mainlineCache) {
    mainlineCache = [
      ...getV2ContentAdapter().mainlineCards.map((card) =>
        toMainlineGameCard(card as V13MainlineCard),
      ),
      ...FORMAL_TRUTH_CARDS.map((card: FormalTruthCard) => toMainlineGameCard(card)),
      // R2/R3｜Truth H1 Bootstrap（PN-TRUTH-225~231）：**追加在末尾**。
      // R3 已过两轮独立审查 ⇒ 已是 Formal（manifest `tracks.formalFixed` 收纳）；
      // 准入与否由 manifest 独立审查输入决定，这里只保证卡源与质量侧车同源。
      ...FORMAL_TRUTH_BOOTSTRAP_CARDS.map((card: FormalTruthCard) => toMainlineGameCard(card)),
      // A9｜第一包重构批（`PN-TRUTH-232~283` 号段，现役）：Golden 11 + REWRITE 7 + REPLACE 18 + 补卡 13，
      // （A9-R6 内容裁决退役 236/263/277 后张数由卡源派生，⛔ 不写死）
      // **追加在末尾**（保 `[0]` 稳定、既有取卡顺序逐字不变）。卡来自聚合模块 `pack1-admission.ts`
      // （已按 A8 登记落地待收 `responseMode` / `boundaryTags`）。是否进 Formal 由 manifest 独立
      // 审查输入决定，这里只保证卡源与质量侧车同源。
      ...PACK1_ADMISSION_RUNTIME_CARDS.map((card: FormalTruthCard) => toMainlineGameCard(card)),
    ];
  }
  return mainlineCache;
}

/** 扩圈 40 张（PN-EXPAND-*）：属于 expansion 包自己的 deck，不进 relationship-aware 路由。 */
export function expansionSsotCards(): readonly GameCard[] {
  if (!expansionCache) {
    expansionCache = getV2ContentAdapter().expansionCards.map((card) =>
      toExpansionGameCard(card as V13ExpansionCard),
    );
  }
  return expansionCache;
}

/** 某个玩法的主线卡（pack-specific 补位用）。 */
export function mainlineSsotCardsByPack(packId: string): readonly GameCard[] {
  return mainlineSsotCards().filter((card) => card.packId === packId);
}

/**
 * `cardId` → 主线卡运行期元数据（SSOT adapter 优先，第一包正式内容兜底）。
 *
 * 为什么需要：运行期 gating（`lib/engine/v2-deal.ts` 的 Heat 档 / Pair 目标 / MATCH 门）
 * 依 `cardId` 取卡元数据，而冻结 SSOT adapter 里**没有**第一包卡（第一包走 sidecar，不改 SSOT）。
 * 本函数是桥接模块（内容真源出口）的同一份视图：SSOT 卡返回 adapter 原值，第一包卡返回内容源原值，
 * 两条来源在此**合流为一条读取路径**，避免「新卡在 guard 下漏放行」这类静默缺口。
 */
const formalPackMetaById: ReadonlyMap<string, FormalTruthCard> = new Map(
  [...FORMAL_TRUTH_CARDS, ...FORMAL_TRUTH_BOOTSTRAP_CARDS, ...PACK1_ADMISSION_RUNTIME_CARDS].map((card) => [
    card.cardId,
    card,
  ]),
);

export function mainlineCardMetaById(
  cardId: string,
): V13MainlineCard | V13ExpansionCard | FormalTruthCard | undefined {
  const ssot = getV2ContentAdapter().cardById(cardId) as
    | V13MainlineCard
    | V13ExpansionCard
    | undefined;
  if (ssot) return ssot;
  return formalPackMetaById.get(cardId);
}

/**
 * 主线卡**运行期元数据视图**（V13 形状）：SSOT 冻结主线 350 张 + 第一包正式内容 24 张
 * （`PN-TRUTH-201~224`）。这是两个 Router 的**唯一共同卡源**：
 *
 * - 生产 `/game` 链：`createDeckRouter` 的牌堆来自 `mainlineSsotCards()`（GameCard 投影）；
 * - 审计 / MC 链：`createV2MainlineRouter`（`lib/v2-relationship/v2-router.ts`）直接消费本视图。
 *
 * 两者是**同一份内容**的两种投影（`GameCard` ↔ V13 卡），卡集逐 id 一致。
 * 追加、不前置、不改排序：`[0]` 恒为 SSOT 首卡，既有取卡顺序语义逐字不变。
 *
 * 为什么要统一到本视图（C1-8）：上一版 `createV2MainlineRouter` 直读 adapter ⇒ 看不到第一包
 * 24 张 Formal 卡 ⇒ 审计 / MC 的候选集小于生产牌堆，两 Router 卡源漂移。本视图把桥接模块
 * 的同一份内容源开放给审计 Router，Card 侧 `mainlineSsotCards()` 侧一个字不改。
 *
 * 形状说明：`FormalTruthCard.boundaryTags` 用的是 Plan §3.1 精确全集（比 SSOT 泛 5 项宽），
 * 故这里只放宽 `boundaryTags` 的读视图类型，**不改** `V13MainlineCard` 真源；Router 不读该字段。
 */
export type MainlineRuntimeCard = Omit<V13MainlineCard, "boundaryTags"> & {
  readonly boundaryTags: readonly string[];
};

export function mainlineRuntimeCards(): readonly MainlineRuntimeCard[] {
  return [
    ...(getV2ContentAdapter().mainlineCards as readonly V13MainlineCard[]),
    ...FORMAL_TRUTH_CARDS,
    ...FORMAL_TRUTH_BOOTSTRAP_CARDS,
    // A9｜第一包重构批（`PN-TRUTH-232~283` 号段，现役），追加在末尾，与 `mainlineSsotCards()` 同一份内容；
    // 用**剥掉 planning-only 三字段**的运行期投影，保证设计字段不泄漏到运行时。
    ...PACK1_ADMISSION_RUNTIME_CARDS,
  ];
}

/** 主线 pack id 集合（去重、稳定顺序）：relationship-aware 路由只认这些玩法。 */
export const V2_MAINLINE_PACK_IDS: readonly string[] = Array.from(
  new Set(V2_GAME_TYPES.map((gameType) => V2_MAINLINE_PACK_BY_GAME_TYPE[gameType].packId)),
);

export function isV2MainlinePack(packId: string): boolean {
  return V2_MAINLINE_PACK_IDS.includes(packId);
}
