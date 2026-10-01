/**
 * B8 / D2｜`/game` 主链出卡适配器：Session 预生成牌堆 ↔ V2 编排器（唯一出卡入口）。
 *
 * 为什么是「适配器」而不是第二套 Router：D2 冻结的是**选择权**归 V2 —— 出哪张卡一律由
 * `drawV2SessionCard`（V2 编排器）在 `V2RouterPort` 三层计数（bucket/pack/global）上决定，
 * 耗尽、软去重放宽、洗牌后兜底全部回到该端口。本模块只把 Session 里已有的牌堆、参与者、
 * 关系态喂给编排器，并把结果写回 Session：
 * - `bucket/pack/global` 三层全部从**本局牌堆**（SSOT 主线 + AI/自定义补位卡）算，保证抽到的卡
 *   一定能在 `deckSnapshot` 里渲染（离线可玩、AI/自定义卡不被丢弃）。
 * - 卡面的 Heat 档 / Pair 目标 gating 来自主线卡运行期元数据
 *   （`v2-card-bridge.ts` 的 `mainlineCardMetaById`：SSOT adapter 优先，第一包正式内容兜底）；
 *   非主线卡（旧 seed / AI / 自定义）没有 Heat 与 Pair 元数据，不做这两项 gating。
 * - 这里不 import、也不调用 `lib/engine/card-selector`（旧加权 selector）——V1.6 出卡路径生产不可达。
 */

import type { GameCard, GameSession, Player, RoundDisclosureSignal, RoundHistory } from "@/lib/domain/schemas";
import { ROUND_DISCLOSURE_RESULT_KEY, roundDisclosureSignalSchema } from "@/lib/domain/schemas";
import { isFormalFixedCard } from "@/lib/v2-content/fixed-content-manifest";
import { EXPANSION_PACK_ID, isV2MainlinePack, mainlineCardMetaById } from "@/lib/v2-content/v2-card-bridge";
import { metadataForCard } from "@/lib/v2-content/v2-card-quality-index";
import { isRecentlyRejected } from "./card-eligibility";
import { diffPlayerRoster, normalizeParticipants } from "@/lib/v2-relationship/v2-participants";
import { drawSeedFor, orderByTieBreakRotation } from "@/lib/v2-relationship/v2-draw-order";
import { singleAnchorPlayerId } from "@/lib/v2-relationship/v2-routing";
import { applyPlayerExit, applyPlayerTemporarilyAway, type RelationshipEvent } from "@/lib/v2-relationship/v2-reducer";
import {
  createInitialRelationshipState,
  HEAT_ORDER,
  SOFT_DEDUP_WINDOW,
  type RelationshipEventType,
  type RelationshipState,
  type TerminalInteractionState,
  type V2HostDecision,
  type V2OrchestrationState,
} from "@/lib/v2-relationship/v2-state";
import {
  applyV2HostDecision,
  drawV2SessionCard,
  hostDecisionKey,
  reduceV2SessionEvents,
  type V2AwaitingHostOutcome,
  type V2DrawOutcome,
  type V2RouterCard,
  type V2RouterInput,
  type V2RouterPort,
  type V2SessionState,
} from "@/lib/v2-relationship/v2-session";

export interface DeckRouterOptions {
  deck: readonly GameCard[];
  /** 首选玩法（outcome 的 pack 层级与 bucket 都先看这里）；抽不到时回落到 `enabledPackIds`，不空转。 */
  preferredPackIds: readonly string[];
  /** 本局启用玩法（global 层级）。 */
  enabledPackIds: readonly string[];
  /** 只在指定题卡类型里出（转瓶子链入真心话/大冒险）。 */
  cardTypes?: readonly string[];
  /** 最近「换一个」拒绝的题面指纹：软去重之外再避开近似题面。 */
  rejectedFingerprints?: readonly string[];
  /**
   * 复算 / 单测专用：显式钉死 draw seed（**可选覆写**，不是新随机源）。
   * 缺省 `undefined` = 由 relationship 状态 + 轮次 + session salt 派生（见 `v2-draw-order.ts`）；
   * 只决定「同强度组内先出哪一张」，不参与任何过滤与优先级判定。
   */
  drawSeed?: number;
}

const heatRank = (heat: RelationshipState["heat"]): number => HEAT_ORDER.indexOf(heat) + 1;

/** 只认「全桌」目标模式的卡：Guard 的非定向轮与无合法 pair 的降级局都只出这类卡。 */
const ALL_PLAYERS_TARGET_MODE = "all-players";

/**
 * 主线卡的 Heat 档 / Pair 目标元数据；非主线卡（旧 seed / AI / 自定义）返回 undefined
 * （不做这两项 gating）。
 *
 * 取数走 `mainlineCardMetaById`（桥接内容真源出口）：SSOT adapter 优先，第一包正式内容
 * （`formal-truth-pack`，走 sidecar 不进冻结 SSOT）兜底 —— 保证第一包卡的 `targetMode` /
 * `matchRequired` / `heatMin` 与 SSOT 卡**同口径生效**，Single-Anchor Guard 的非定向轮
 * 不会因为 adapter 查不到而漏放行定向卡。
 */
function ssotMeta(cardId: string) {
  return mainlineCardMetaById(cardId);
}

function heatEligible(card: GameCard, input: V2RouterInput): boolean {
  // Heat 档硬过滤是 **Formal Fixed 轨**的规则：只有能进入 Formal 轨的卡才受它约束（B3-1 §2.1）。
  // 非 Formal 卡（当前快照内 390 张 `PN-*` 全为 legacy / 旧 `seed-*` / custom / ai）直接放行：
  // 它们既不推进 Heat 与有效计数（`v2-reducer.ts` fail-closed），就不该被 Heat 档卡死可玩库存。
  // 判定必须走 `isFormalFixedCard`（读 manifest 的 audited/reviewed/humanBarFit），
  // 不得用 `classifyMainlineCard === "fixed"` 代替——那只是「在冻结快照内」，不是 Formal。
  if (!isFormalFixedCard(card)) return true;
  const meta = ssotMeta(card.id);
  if (!meta || !("heatMin" in meta)) return true;
  const rank = heatRank(input.relationship.heat);
  return rank >= meta.heatMin && rank <= meta.heatMax;
}

/**
 * Pair 目标 gating（D4）。
 *
 * - 只有真正需要 MATCH 才能出的卡（`match-pair` / `matchRequired`）受约束：该 pair 没有 MATCH 就不出，
 *   不空转、不猜人。
 * - 其余 pair 定向卡在 `NO_ELIGIBLE_PAIR` 时**照常按普通玩法出**（R4 §4.1「保留普通抽卡」「进入普通玩法」）：
 *   参与者走既有 `selectParticipants`，不读、不展示任何 pairGender 字段，也就不存在猜性别问题。
 *   （V2 关系主线 API 的 SSOT Router 另有更严的读法，见 B7；本适配器只在 App 普通玩法降级时放宽。）
 * - R-CB6｜`requireNonTargetedOpportunity === true`（Single-Anchor Guard 的非定向轮）：只出
 *   `all-players` 卡 —— 与上面那条「降级照常出」是两回事，这是 Guard 显式要求的**硬过滤**，
 *   此处不放宽。非 SSOT 卡（AI / 自定义 / 旧 seed）没有 `targetMode` 元数据、不具备定向 pair
 *   语义，按非定向候选处理。
 */
function targetEligible(card: GameCard, input: V2RouterInput): boolean {
  const meta = ssotMeta(card.id);
  if (input.requireNonTargetedOpportunity === true) {
    return !meta || !("targetMode" in meta) || meta.targetMode === ALL_PLAYERS_TARGET_MODE;
  }
  if (!meta || !("targetMode" in meta)) return true;
  if (meta.targetMode === "match-pair" || meta.matchRequired === true) {
    return (
      input.targetPairKey !== null &&
      input.relationship.matches[input.targetPairKey] !== undefined
    );
  }
  return true;
}

/** 硬合法：不含 Heat 档与软去重窗口（与 v2-router 的三层计数口径一致）。 */
function hardEligible(card: GameCard, input: V2RouterInput, options: DeckRouterOptions): boolean {
  if (!options.enabledPackIds.includes(card.packId)) return false;
  if (options.cardTypes?.length && !options.cardTypes.includes(card.type)) return false;
  if (card.intensity > input.intensityLimit) return false;
  if (input.requireFiveTierForPair !== null && card.intensity !== 5) return false;
  if (input.relationship.usedCardIds.includes(card.id)) return false;
  const activeCount = input.participants.filter((participant) => participant.active).length;
  if (activeCount < 2) return false;
  if (activeCount < card.minPlayers) return false;
  if (card.maxPlayers && card.maxPlayers < activeCount) return false;
  return targetEligible(card, input);
}

/**
 * 确定性排序：强度降序、cardId 升序。只排定**组间优先级**（强度降序），
 * 同强度组内的先后由 `orderForDraw` 的 seed 派生轮换决定（P1#2）。
 */
function sortCards(cards: GameCard[]): GameCard[] {
  return [...cards].sort(
    (a, b) => b.intensity - a.intensity || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

/**
 * 出卡顺序 = 确定性排序 + **同强度组内** seed 派生轮换（与 `v2-router` 同一套规则，
 * 见 `lib/v2-relationship/v2-draw-order.ts`）。App 主线与 SSOT 主线行为一致，
 * 不再出现「同强度下 cardId 字典序最小者长期垄断」。
 */
function orderForDraw(cards: GameCard[], seed: number): GameCard[] {
  return orderByTieBreakRotation(sortCards(cards), (card) => card.intensity, seed);
}

const toRouterCard = (card: GameCard): V2RouterCard => ({
  cardId: card.id,
  fiveTier: card.intensity === 5,
});

/**
 * 生产出卡端口：三层计数全部在**本局牌堆**上算。
 * - `bucket`：当前作用域玩法 ∩ 硬合法 ∩ 当前 Heat 档 ∩ 不在软去重窗口内（含「换一个」近似题面回避）。
 * - `pack`：当前作用域玩法的硬合法集（不套 Heat 档与软去重：本玩法还有材料，只是当前桶出不了）。
 * - `global`：本局启用玩法的硬合法集（同上）。
 * 作用域玩法优先取 `preferredPackIds`，其中无卡时回落到 `enabledPackIds`（与 V1.6 的偏好回落同口径）。
 */
export function createDeckRouter(options: DeckRouterOptions): V2RouterPort {
  const rejected = options.rejectedFingerprints ?? [];
  const deferred = rejected.length
    ? (cards: GameCard[]) => {
        const fresh = cards.filter((card) => !isRecentlyRejected(card, [...rejected]));
        return fresh.length ? fresh : cards;
      }
    : (cards: GameCard[]) => cards;

  const scopeOf = (input: V2RouterInput): readonly string[] => {
    if (!options.preferredPackIds.length) return options.enabledPackIds;
    const scopeHasCards = options.deck.some(
      (card) => options.preferredPackIds.includes(card.packId) && hardEligible(card, input, options),
    );
    return scopeHasCards ? options.preferredPackIds : options.enabledPackIds;
  };

  const recentWindow = (input: V2RouterInput): Set<string> => {
    if (input.softDedupWindow <= 0) return new Set();
    return new Set(input.relationship.recentCardIds.slice(-input.softDedupWindow));
  };

  /** 出卡 seed：显式注入优先（测试/复算），否则由 relationship 状态 + 轮次 + session salt 派生。 */
  const drawSeed = (input: V2RouterInput): number =>
    options.drawSeed ?? input.drawSeed ?? drawSeedFor(input.relationship, input.drawSessionSalt);

  return {
    bucket(input) {
      const scope = scopeOf(input);
      const excluded = recentWindow(input);
      const cards = options.deck.filter(
        (card) =>
          scope.includes(card.packId) &&
          hardEligible(card, input, options) &&
          heatEligible(card, input) &&
          !excluded.has(card.id),
      );
      return orderForDraw(deferred(cards), drawSeed(input)).map(toRouterCard);
    },
    pack(input) {
      const scope = scopeOf(input);
      return orderForDraw(
        options.deck.filter((card) => scope.includes(card.packId) && hardEligible(card, input, options)),
        drawSeed(input),
      ).map(toRouterCard);
    },
    global(input) {
      return orderForDraw(
        options.deck.filter((card) => hardEligible(card, input, options)),
        drawSeed(input),
      ).map(toRouterCard);
    },
  };
}

/* ------------------------------------------------------------------ */
/* 编排态读写                                                            */
/* ------------------------------------------------------------------ */

export const createInitialOrchestration = (): V2OrchestrationState => ({
  softDedupWindow: SOFT_DEDUP_WINDOW,
  awaitingHostDecision: false,
  lastExhaustionLevel: "BUCKET_OK",
  finished: false,
  hostDecisions: {},
  // R-CB6：尚未出卡 = 无定向曝光事实。
  lastTargetedPairKey: null,
});

/**
 * 从 Session 组装 V2 编排态（缺失即初始档：旧 Session 原样可玩）。
 * R-CB6：旧 Session 的 `v2Orchestration` 没有 `lastTargetedPairKey` 字段，
 * 这里显式规范化为 `null`（无曝光），不迁移、不崩、不猜。
 */
export function orchestrationOf(session: GameSession): V2OrchestrationState {
  const orchestration = session.v2Orchestration;
  if (!orchestration) return createInitialOrchestration();
  return { ...orchestration, lastTargetedPairKey: orchestration.lastTargetedPairKey ?? null };
}

/**
 * 从 Session 组装关系态：`usedCardIds` 以 Session 的 used 账为准（转瓶子 L1 洗牌会直接改它，
 * 必须以 Session 为准才不会把洗回来的卡又当成已用）；其余字段（recent/Heat/MATCH/5 档）沿用持久化值。
 */
export function relationshipOf(session: GameSession): RelationshipState {
  const base = session.relationshipState ?? createInitialRelationshipState();
  return { ...base, usedCardIds: [...session.usedCardIds] };
}

export interface DrawDeckInput {
  session: GameSession;
  /** single 模式只在本玩法内抽；mixed 模式用阶段偏好（抽不到回落到 enabled）。 */
  preferredPackIds: readonly string[];
  enabledPackIds: readonly string[];
  cardTypes?: readonly string[];
  /** 复算 / 单测专用：显式钉死出卡 tie-break seed（可选覆写；缺省按 session salt 派生）。 */
  drawSeed?: number;
}

export interface DrawDeckResult {
  outcome: V2DrawOutcome;
  /** 抽中卡（CARD 时一定能在 `session.deckSnapshot` 里找到）。 */
  card: GameCard | undefined;
}

/** 主链抽一张：唯一出卡入口 `drawV2SessionCard`（V2 Router 三层计数 + 耗尽控制器）。 */
export function drawDeckCard(input: DrawDeckInput): DrawDeckResult {
  const { session } = input;
  const state: V2SessionState = {
    sessionId: session.id,
    relationship: relationshipOf(session),
    // 旧 Session 可能没有 participants：按 config.players 幂等补齐（pairGender=null），不阻止出卡。
    participants: normalizeParticipants(session.participants, session.config.players),
    orchestration: orchestrationOf(session),
  };
  const router = createDeckRouter({
    deck: session.deckSnapshot,
    preferredPackIds: input.preferredPackIds,
    enabledPackIds: input.enabledPackIds,
    cardTypes: input.cardTypes,
    rejectedFingerprints: session.recentRejectedFingerprints ?? [],
    ...(input.drawSeed === undefined ? {} : { drawSeed: input.drawSeed }),
  });
  const outcome = drawV2SessionCard(state, router, {
    intensityLimit: session.config.intensity,
  });
  const card =
    outcome.kind === "CARD"
      ? session.deckSnapshot.find((item) => item.id === outcome.cardId)
      : undefined;
  return { outcome, card };
}

/** 把编排结果写回 Session（used 账本 + 关系态 + 编排态；不碰牌堆与轮次）。 */
export function withV2State(session: GameSession, state: V2SessionState): GameSession {
  return {
    ...session,
    // used 的唯一真源是 relationship.usedCardIds（洗牌时两者一起清），这里保持同值。
    usedCardIds: [...state.relationship.usedCardIds],
    relationshipState: state.relationship,
    participants: state.participants,
    v2Orchestration: state.orchestration,
  };
}

/* ------------------------------------------------------------------ */
/* R4 §4.3 / §4.4 名册变更：退出（终止）/ 暂离（暂停）/ 回席                */
/* ------------------------------------------------------------------ */

/**
 * 局中玩家名册变更的**唯一落盘入口**（R4 §4.3/§4.4）。
 *
 * 按 `diffPlayerRoster` 的三分语义处理关系边，绝不把 `active=false` 一刀切：
 * - 真离开（从名册移除）→ `applyPlayerExit`：删含该玩家的 pairState/cooldowns/matches，
 *   相关 5 档保障进终态 `expired`（`expired-player-exit`），D5 名额立即释放；
 * - 暂离（仍在名册、`active` 转 false）→ `applyPlayerTemporarilyAway`：不删任何边，
 *   MATCH/cooldown/signal 全保留（D5 名额不释放），相关保障 `paused`（`player-away`），计数不清零；
 * - 回席（`active` 转 true）→ 不需要额外归约：资格由参与者投影重算，保障在下次出卡时
 *   沿 `advanceGuarantee(resume)` 从暂停点继续，不补算离席期机会。
 *
 * 参与者投影同事务更新（`active` 以新名册为准；离开者随名册消失而退出 pair pool），
 * 旧名册之外新增的玩家按新参与者处理（无历史边可迁移）。计数（effective/Heat/轮次）一律不动。
 */
export function applyPlayerRosterChange(session: GameSession, players: readonly Player[]): GameSession {
  const transitions = diffPlayerRoster(session.config.players, players);
  let relationship = relationshipOf(session);
  for (const playerId of transitions.exited) relationship = applyPlayerExit(relationship, playerId);
  for (const playerId of transitions.away) relationship = applyPlayerTemporarilyAway(relationship, playerId);

  const activeById = new Map(players.map((player) => [player.id, player.active]));
  const participants = normalizeParticipants(session.participants, players).map((participant) => ({
    ...participant,
    active: activeById.get(participant.playerId) === true,
  }));

  return withV2State(
    { ...session, config: { ...session.config, players: [...players] } },
    {
      sessionId: session.id,
      relationship,
      participants,
      orchestration: orchestrationOf(session),
    },
  );
}

/* ------------------------------------------------------------------ */
/* R3 事件归约：每轮终态 → 有效卡计数 / Heat（V2-B10）                      */
/* ------------------------------------------------------------------ */

/** 轮次终态（R3 `terminalEventExclusivity` 的三种合法值）。 */
export type V2RoundTerminal = TerminalInteractionState;

/** R3 事件族：只由本轮 `packId` 判定，不按交互文案或页面动作推导。 */
export type V2CardEventFamily = "REL" | "NEUTRAL" | "EXPANSION";

/**
 * 本轮所属 R3 事件族（唯一口径）：
 * - `expansion` 包 → EXPANSION（扩圈原版/table-only，不推进 Heat/Pair）；
 * - 关系主线玩法（`isV2MainlinePack`）→ REL（relationship-aware 普通卡）；
 * - 其余玩法（转瓶子等）→ NEUTRAL。
 */
export function cardEventFamilyForPack(packId: string): V2CardEventFamily {
  if (packId === EXPANSION_PACK_ID) return "EXPANSION";
  return isV2MainlinePack(packId) ? "REL" : "NEUTRAL";
}

const ROUND_EVENT_TYPE: Record<V2CardEventFamily, Record<V2RoundTerminal, RelationshipEventType>> = {
  REL: {
    completed: "REL_CARD_COMPLETED",
    skipped: "REL_CARD_SKIPPED",
    swapped: "REL_CARD_SWAPPED",
  },
  NEUTRAL: {
    completed: "NEUTRAL_CARD_COMPLETED",
    skipped: "NEUTRAL_CARD_SKIPPED_OR_SWAPPED",
    swapped: "NEUTRAL_CARD_SKIPPED_OR_SWAPPED",
  },
  EXPANSION: {
    completed: "EXPANSION_CARD_COMPLETED",
    skipped: "EXPANSION_CARD_SKIPPED_OR_SWAPPED",
    swapped: "EXPANSION_CARD_SKIPPED_OR_SWAPPED",
  },
};

/**
 * 轮次终态 → 唯一 R3 事件：
 * - `ref` = 轮次 id（interactionId，终态互斥键）；`eventId` = `轮次id::终态`（同轮重放幂等）；
 * - `cardId` 随事件走（R3：completed/skipped/swapped 均记 used）；
 * - `playerId` 只在单点名单轮（`participantIds` 恰 1 人）记定向归属；pair 回合没有单一
 *   「定向归属玩家」，不猜、也不按两人各记一遍；
 * - NEUTRAL / EXPANSION 的跳过/换题必须显式带 `terminal`，否则终态无法落盘。
 *
 * §7.2 生产链（P0）：本函数是「有效信息轮」两路元数据的**唯一生产写入口**——
 * - **卡侧**（`informationGain` / `topic`）：由 `metadataForCard(cardId)` 从 SSOT 侧车索引读；
 *   未补标一律写 `null`（fail-closed），**绝不给默认档**；
 * - **轮侧**（`selfDisclosed` / `disclosedPlayerIds`）：由调用方经正式轮次结算 API
 *   （`session-engine.resolveRoundAndReduce(session, "complete", roundDisclosureSignal({...}))`
 *   → `roundHistory.result`）提供；未提供即按「不是本人揭晓」写 `false` / `[]`。
 *
 * 两路都**只在这里**进事件，reducer 侧不再二次推断；`isEffectiveInformationRound` 只做判定，
 * 不回头补数据。**禁止**按 `interactionType` 猜「本人揭晓」——这是 Human 明令封死的捷径。
 */
export function eventForRoundTerminal(
  round: NonNullable<GameSession["currentRound"]>,
  terminal: V2RoundTerminal,
  timestamp: string,
  disclosure?: RoundDisclosureSignal,
): RelationshipEvent {
  const family = cardEventFamilyForPack(round.packId);
  const event: RelationshipEvent = {
    eventId: `${round.id}::${terminal}`,
    type: ROUND_EVENT_TYPE[family][terminal],
    ref: round.id,
    cardId: round.cardId,
    timestamp,
  };
  if (family === "REL" && round.participantIds.length === 1) {
    event.playerId = round.participantIds[0];
  }
  if (family !== "REL" && terminal !== "completed") {
    event.terminal = terminal;
  }
  // §7.2 卡侧元数据：只对可能成为「有效信息轮」的 REL completed 附档；未补标 = null。
  if (family === "REL" && terminal === "completed") {
    const meta = metadataForCard(round.cardId);
    event.informationGain = meta.informationGain ?? undefined;
    event.topic = meta.topic ?? undefined;
  }
  // §7.2 轮侧信号：显式提供才写；缺省即「未判定」（selfDisclosed=false / 空数组）。
  if (disclosure) {
    event.selfDisclosed = disclosure.selfDisclosed;
    event.disclosedPlayerIds = disclosure.disclosedPlayerIds;
  }
  return event;
}

/**
 * 从**已 resolved 的轮次记录**里读回本轮的可选揭晓信号（`roundHistory.result.disclosure`）。
 *
 * 口径与 `roundDisclosureSignal()` 写入端对称：读不到 / 解析失败 / 缺 `selfDisclosed`
 * 一律返回 `undefined`（= 未判定，不是 `selfDisclosed=false` 的显式事实），
 * 由 `eventForRoundTerminal` 决定怎么表达。解析用同一份 zod schema，杜绝两边字段漂移。
 */
export function roundDisclosureFromResult(
  result: Record<string, unknown> | undefined,
): RoundDisclosureSignal | undefined {
  if (!result) return undefined;
  const parsed = roundDisclosureSignalSchema.safeParse(result[ROUND_DISCLOSURE_RESULT_KEY]);
  return parsed.success ? parsed.data : undefined;
}

/**
 * 归约内核接受的「本轮 round record」形状：
 * - 出题中的 `currentRound`（`ActiveRound`，无 `result`）；
 * - 已落盘的 `rounds[i]`（`RoundHistory`，带 `status` / `result`）。
 * 两者都是**同一轮的自有数据**；归约只认传入的这一条，不去别处猜。
 */
export type RoundRecordForReduction = NonNullable<GameSession["currentRound"]> & {
  status?: RoundHistory["status"];
  endedAt?: string;
  result?: Record<string, unknown>;
};

/**
 * 归约内核（唯一计数入口）：吃**一条明确的 round record**，按 R3 事件表归约出 GameSession。
 *
 * - `REL_CARD_COMPLETED` 且为「有效信息轮」→ 推进 `relationshipEffectiveCardCount`，Heat 由此重算，
 *   落进 12–14 窗口 mutual 才可达；
 * - skipped / swapped / NEUTRAL / EXPANSION 一律 +0：不消耗 20/25 限额、不推进 Heat 或 mutual 间隔。
 *
 * 与旧实现的关键差别：披露信号只从**传入的这条 round record 自己的 `result`** 读
 * （`disclosure` 参数优先，其次 `round.result`）。
 * 旧实现在这里回查**轮次历史列表的最后一条**的 `result` —— 而调用方当时是
 * 「先归约 → 再 completeRound 落盘」，那最后一条其实是**上一轮**，于是上一轮的披露被静默挂到
 * 本轮事件上（串轮），本轮披露永远进不来。该回查已删除：本轮披露只有在**本轮 record 自己**身上才认。
 *
 * 只动 `relationshipState`（+ `v2Orchestration`）与 used 账；`currentRound` / `rounds` 由调用方
 * （`session-engine.resolveRound`）负责，本函数不落盘、不 resolve。
 * 出牌时（`startRound`）本轮 `cardId` 已进 used 账，本函数归约后按首现去重，
 * 保证同一张卡不因「出牌 + 终态」两条路径记两次。
 *
 * §7.2 的两路输入都在 `eventForRoundTerminal` 里进事件：
 * - 卡侧 metadata 由正式 sidecar（`metadataForCard`）读，未补标写 `null` → fail-closed；
 * - 轮侧披露由本函数从该轮 `result` 解出后传入。
 */
export function reduceRoundRecord(
  session: GameSession,
  round: RoundRecordForReduction,
  terminal: V2RoundTerminal,
  timestamp: string,
  disclosure?: RoundDisclosureSignal,
): GameSession {
  const roundDisclosure = disclosure ?? roundDisclosureFromResult(round.result);
  const state: V2SessionState = {
    sessionId: session.id,
    relationship: relationshipOf(session),
    participants: normalizeParticipants(session.participants, session.config.players),
    orchestration: orchestrationOf(session),
  };
  const reduced = reduceV2SessionEvents(state, [eventForRoundTerminal(round, terminal, timestamp, roundDisclosure)]).state;
  const relationship: RelationshipState = {
    ...reduced.relationship,
    usedCardIds: [...new Set(reduced.relationship.usedCardIds)],
  };
  return withV2State(session, { ...reduced, relationship });
}

/**
 * 兼容既有 `currentRound` 调用点（转瓶子链内终态归约）的薄封装：
 * 内部取 `session.currentRound` 当作本轮 round record，转交 `reduceRoundRecord`。
 *
 * **不读轮次历史列表的最后一条**：`currentRound` 本身没有 `result` 时披露即「未判定」，
 * 由 `isEffectiveInformationRound` fail-closed（不计有效轮）。
 * 「先 resolve 再归约」的旧用法已由 `session-engine.resolveRoundAndReduce` 取代。
 */
export function reduceResolvedRound(
  session: GameSession,
  terminal: V2RoundTerminal,
  timestamp: string = new Date().toISOString(),
): GameSession {
  const round = session.currentRound;
  if (!round) return session;
  return reduceRoundRecord(session, round, terminal, timestamp);
}

/* ------------------------------------------------------------------ */
/* 耗尽 Host 决策（D8=A+，幂等）                                          */
/* ------------------------------------------------------------------ */

/** 处于 AWAITING_HOST_EXHAUSTION_DECISION 时的决策请求基线；非等待态返回 undefined。 */
export function awaitingHostDecision(session: GameSession): V2AwaitingHostOutcome | undefined {
  const orchestration = session.v2Orchestration;
  if (!orchestration?.awaitingHostDecision) return undefined;
  const relationship = relationshipOf(session);
  const participants = normalizeParticipants(session.participants, session.config.players);
  // R-CB6：恢复路径只组装决策请求，未发生调度 → Guard 决策恒为「未生效」，
  // 但仍如实回传本局是否 Single-Anchor 桌（anchor 由当前名册现算，不落盘性别/身份）。
  const anchorPlayerId = singleAnchorPlayerId(participants);
  return {
    kind: "AWAITING_HOST_EXHAUSTION_DECISION",
    exhaustionCycle: relationship.exhaustionCycle,
    idempotencyKey: hostDecisionKey(session.id, relationship.exhaustionCycle + 1),
    guard: {
      singleAnchorTable: anchorPlayerId !== null,
      anchorPlayerId,
      applied: false,
      reason: null,
    },
    state: {
      sessionId: session.id,
      relationship,
      participants,
      orchestration,
    },
  };
}

/**
 * 应用 Host 显式决策（结束本局 / 洗牌再玩），并把结果写回 Session。
 * 幂等键 = `sessionId + exhaustionCycle + 1`，同键重放直接复用账本，不多清一次 used、不多加 cycle。
 */
export function applyHostDecisionToSession(
  session: GameSession,
  awaiting: V2AwaitingHostOutcome,
  decision: V2HostDecision,
): GameSession {
  const result = applyV2HostDecision(awaiting.state, {
    decision,
    exhaustionCycle: awaiting.exhaustionCycle,
  });
  return withV2State(session, result.state);
}

/**
 * D8 严格方案 A：`AWAITING_HOST_EXHAUSTION_DECISION` 下洗牌实测也救不回时的唯一说明。
 * 此时不得引导切换玩法（awaiting 禁止切包），只如实告知无合法题并允许结束本局。
 */
export const AWAITING_NO_RECOVERABLE_GUIDANCE = "当前条件下没有可继续的合法题，本局到此为止。";

/**
 * 「洗牌再玩」是否会真的补出题卡（纯函数，不改入参）。
 *
 * 耗尽等待态下先模拟一次 Host 洗牌（等价于 `/game` 的 `hostDecision("reshuffle")`：只清 used、cycle+1、
 * 解除 awaiting），再按同一条出卡链试抽一次；抽不到卡说明洗牌是空转（牌堆本身为空，或本局玩法在这个
 * 人数/尺度/雷区下没有任何硬合法卡），此时 UI 不得只给「洗牌再玩」——必须给结束本局/换玩法/回首页。
 */
export function reshuffleWouldRevealCard(session: GameSession): boolean {
  const awaiting = awaitingHostDecision(session);
  if (!awaiting) return false;
  const decided = applyHostDecisionToSession(session, awaiting, "reshuffle");
  const single = decided.config.mode === "single";
  const { outcome } = drawDeckCard({
    session: decided,
    preferredPackIds: [decided.currentPackId],
    enabledPackIds: single ? [decided.currentPackId] : decided.config.enabledPackIds,
  });
  return outcome.kind === "CARD";
}
