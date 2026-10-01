/**
 * B7 / D2｜生产 V2 Router（relationship-aware 主线的唯一出卡实现）。
 *
 * 本模块实现 `V2RouterPort`（v2-session.ts 的编排契约），内容来自桥接模块（`v2-card-bridge.ts`）
 * 的**主线运行期卡源** `mainlineRuntimeCards()` = V1.3 Frozen SSOT 主线 350 张 + 第一包正式内容
 * 24 张（`PN-TRUTH-201~224`）；扩圈 40 不进本路由。它取代 V1.6 的固定 40 张 future deck、
 * `16:8:4:2:1` 指数权重与 `lib/engine/card-selector`：
 * 本文件不 import、也不调用任何旧 selector；耗尽、放宽软去重窗口、洗牌后兜底
 * 全部回到本端口的 bucket/pack/global —— 旧 Router 在 V2 主线不可达。
 *
 * 三层计数口径（与 v2-session.ts 顶部注释、PRODUCT_PLAN_V2.0 §H 一致）：
 * - 硬合法（hardEligible）：强度上限、合法 5 档强制、参与者人数下限、pair 目标 gating、
 *   `usedCardIds` 全部通过。
 * - `bucket`：**当前玩法内** ∩ 硬合法 ∩ **Formal 卡**的当前 Heat 档 ∩ 不在最近 `softDedupWindow` 张软去重窗口内。
 *   （桶必须限定在当前玩法：跨玩法填桶会让 pack 耗尽永不可见，主链也会抽到 currentPackId 之外的卡。
 *   Heat 档硬过滤只对 Formal Fixed 轨的卡生效，非 Formal 卡不受约束，见 `heatEligibleForCard`。）
 * - `pack`：当前玩法的硬合法集（不套软去重、不套 Heat 档：本玩法还有材料，只是当前桶出不了）。
 * - `global`：全部 relationship-aware 玩法的硬合法集（同上，不套软去重与 Heat 档）。
 *
 * Pair 目标 gating（R4 / D4）：
 * - `targetPairKey === null`（中性 / 无合法男女 pair 的普通玩法降级）：只出 `all-players` 卡，
 *   pair/MATCH/私密互选类卡一律不可出 —— 降级局不跑 Pair Routing、MATCH 与 5 档专属。
 * - `requireNonTargetedOpportunity === true`（R-CB6 Single-Anchor Guard 的非定向轮）：同样只出
 *   `all-players` 卡（与上一行的判断同一 targetMode 口径，不新增卡类型体系）。
 * - `targetPairKey !== null`：额外开放定向 pair 卡；`match-pair`（matchRequired）卡
 *   只在 relationship.matches 里已有该 pair 的 MATCH 时才可出。
 */

import {
  HEAT_ORDER,
  type Heat,
  type RelationshipState,
} from "./v2-state";
import { drawSeedFor, orderByTieBreakRotation } from "./v2-draw-order";
import { formalFixedIdSet } from "@/lib/v2-content/fixed-content-manifest";
import { getGamePack } from "@/lib/game-packs/registry";
import {
  mainlineRuntimeCards,
  V2_MAINLINE_PACK_BY_GAME_TYPE,
  type MainlineRuntimeCard,
} from "@/lib/v2-content/v2-card-bridge";
import type { V13MainlineCard } from "@/lib/v2-content/v2-types";
import type { V2RouterCard, V2RouterInput, V2RouterPort } from "./v2-session";

/** 只认「全桌」目标模式的卡：无合法 pair 的降级局只能出这类卡。 */
const ALL_PLAYERS_TARGET_MODE = "all-players";
/** 需要先有 MATCH 才能出的目标模式（R4：MatchRequired 卡不得在未 MATCH 的 pair 上出）。 */
const MATCH_TARGET_MODE = "match-pair";

const heatRank = (heat: Heat): number => HEAT_ORDER.indexOf(heat) + 1;

/** 正式 Formal Fixed 轨的卡 ID 集合（B3-2 谓词真源；C1-5/6/7 后第一包 24 张已入轨）。 */
const formalFixedIds = formalFixedIdSet();

/**
 * Heat 档硬过滤是否适用于该卡 —— 与生产 Router `lib/engine/v2-deal.ts` 的 `heatEligible`
 * **同一口径**（B3-1 §2.1）。
 *
 * Heat 档是 **Formal Fixed 轨**的规则：只有能进入 Formal 轨的卡才受它约束。非 Formal 卡
 * （冻结快照内 390 张旧 `PN-*` 仍为 `legacy` / 扩圈 40 张）既不推进 Heat 与有效计数
 * （`v2-reducer.ts` fail-closed），就不该被 Heat 档卡死可玩库存，故直接放行。
 * 第一包 24 张 `PN-TRUTH-201~224` 已是 Formal（`heatMin` 全 1），故它们**受** Heat 档约束。
 *
 * 判定复用 `fixed-content-manifest` 的 `formalFixedIdSet`（**不在此复制实现**）：主线卡
 * 在数据上恒为 `source === "builtin"`，故 `formalFixedIds.has(cardId)` 与
 * `isFormalFixedCard(card)` 等价。**禁止**改用 `classifyMainlineCard === "fixed"`
 * —— 那只是「在冻结快照内」（当前 414 张全部满足），不是 Formal。
 */
function heatEligibleForCard(card: MainlineRuntimeCard, currentHeat: number): boolean {
  if (!formalFixedIds.has(card.cardId)) return true;
  return currentHeat >= card.heatMin && currentHeat <= card.heatMax;
}

/** SSOT 卡 → 它所属的主线玩法 id（不在主线映射里的卡不属于本路由）。只读视图也可传入。 */
export function packIdForMainlineCard(card: { gameType: V13MainlineCard["gameType"] }): string | undefined {
  return V2_MAINLINE_PACK_BY_GAME_TYPE[card.gameType]?.packId;
}

/** 软去重窗口：最近 `window` 张已展示卡不再出。 */
function recentWindow(relationship: RelationshipState, window: number): Set<string> {
  if (window <= 0) return new Set();
  return new Set(relationship.recentCardIds.slice(-window));
}

/** 该卡在当前输入下是否「硬合法」（不含 Heat 档与软去重窗口）。 */
function isHardEligible(card: MainlineRuntimeCard, input: V2RouterInput): boolean {
  if (card.intensity > input.intensityLimit) return false;
  if (input.requireFiveTierForPair !== null && card.intensity !== 5) return false;
  if (input.relationship.usedCardIds.includes(card.cardId)) return false;

  const activeCount = input.participants.filter((participant) => participant.active).length;
  if (activeCount < 2) return false;
  const minPlayers = minPlayersForCard(card);
  if (activeCount < minPlayers) return false;

  return isTargetEligible(card, input);
}

/** 玩法人数下限与 pack 定义同源（不建第二套 runtime 常量）。 */
function minPlayersForCard(card: MainlineRuntimeCard): number {
  const packId = packIdForMainlineCard(card);
  if (!packId) return Number.POSITIVE_INFINITY;
  return getGamePack(packId)?.minPlayers ?? 2;
}

/** pair / 全桌目标 gating（D4 降级：无合法 pair 只出全桌卡）。 */
function isTargetEligible(card: MainlineRuntimeCard, input: V2RouterInput): boolean {
  if (card.targetMode === ALL_PLAYERS_TARGET_MODE) return true;
  // R-CB6｜Single-Anchor Guard 的非定向轮：只许 all-players，定向 pair 卡一律不出（沿用同一 targetMode 口径，不另立类型）。
  if (input.requireNonTargetedOpportunity === true) return false;
  if (input.targetPairKey === null) return false;
  if (card.targetMode === MATCH_TARGET_MODE) {
    return input.relationship.matches[input.targetPairKey] !== undefined;
  }
  return true;
}

/**
 * 确定性排序：强度降序、cardId 升序。
 *
 * 只作为**组间优先级**的排定手段（强度降序 = drawBand 之前既有口径）；
 * 同强度组内的「谁先出」不再交给 cardId 字典序，见 `orderForDraw`。
 */
function sortCards(cards: MainlineRuntimeCard[]): MainlineRuntimeCard[] {
  return [...cards].sort((a, b) => b.intensity - a.intensity || (a.cardId < b.cardId ? -1 : 1));
}

/**
 * 出卡顺序 = 确定性排序（强度降序，优先级不动）+ **同强度组内**的 seed 派生轮换。
 *
 * 这是冻结管线 `… → drawBand → 随机选卡` 的最后一步：编排器仍取首张，但首张不再恒等于
 * 同强度组里 cardId 字典序最小者（P1#2：`PN-DARE-*` 恒小于 `PN-TRUTH-*` 导致大冒险饥饿）。
 * seed 缺省由 relationship 状态派生（`drawSeedFor`），同一局面重放逐字一致。
 */
function orderForDraw(cards: MainlineRuntimeCard[], seed: number): MainlineRuntimeCard[] {
  return orderByTieBreakRotation(sortCards(cards), (card) => card.intensity, seed);
}

const toRouterCard = (card: MainlineRuntimeCard): V2RouterCard => ({
  cardId: card.cardId,
  fiveTier: card.intensity === 5,
});

export interface V2MainlineRouterOptions {
  /** 当前 relationship-aware 玩法（pack）id；pack() 只在这个玩法内计数。 */
  packId: string;
}

export interface V2MainlineRouter extends V2RouterPort {
  /** 当前玩法 id（只读，便于编排器/测试核对路由范围）。 */
  readonly packId: string;
}

/**
 * 生产 Router：SSOT 主线卡的唯一出卡实现。
 * 同一份输入永远得到同一份结果（无随机、无隐藏状态），便于逐轮复现与审计。
 */
export function createV2MainlineRouter(options: V2MainlineRouterOptions): V2MainlineRouter {
  const { packId } = options;

  const mainline = mainlineRuntimeCards();

  const hardEligible = (input: V2RouterInput): MainlineRuntimeCard[] =>
    mainline.filter((card) => isHardEligible(card, input));

  /** 出卡 seed：显式注入优先（测试/复算），否则由 relationship 状态 + 轮次 + session salt 派生。 */
  const drawSeed = (input: V2RouterInput): number =>
    input.drawSeed ?? drawSeedFor(input.relationship, input.drawSessionSalt);

  return {
    packId,
    bucket(input) {
      const currentHeat = heatRank(input.relationship.heat);
      const excluded = recentWindow(input.relationship, input.softDedupWindow);
      return orderForDraw(
        hardEligible(input).filter(
          (card) =>
            packIdForMainlineCard(card) === packId &&
            heatEligibleForCard(card, currentHeat) &&
            !excluded.has(card.cardId),
        ),
        drawSeed(input),
      ).map(toRouterCard);
    },
    pack(input) {
      return orderForDraw(
        hardEligible(input).filter((card) => packIdForMainlineCard(card) === packId),
        drawSeed(input),
      ).map(toRouterCard);
    },
    global(input) {
      return orderForDraw(hardEligible(input), drawSeed(input)).map(toRouterCard);
    },
  };
}
