import {
  createEmptyPlayerCoverage,
  heatForEffectiveCount,
  isHeatAtLeast,
  BASE_SESSION_COMPLETED_ROUND_LIMIT,
  DEFAULT_COVERAGE_LOW_PARTICIPATION_SKIP_THRESHOLD,
  LIVE_CHEMISTRY_BUFFER_TOPIC,
  MAX_ACTIVE_MATCHES_PER_PLAYER,
  MAX_REGULAR_MUTUAL_RUNS,
  MAX_SESSION_COMPLETED_ROUNDS,
  MINIMUM_EFFECTIVE_CARDS_BETWEEN_RUNS,
  MINIMUM_REMAINING_SESSION_ROUNDS_FOR_REGULAR_MUTUAL,
  MUTUAL_CHECK_COUNTS,
  MUTUAL_CHECK_WINDOW_MAX,
  MUTUAL_MIN_HEAT,
  RECOGNITION_HIGH_MIN_ROUNDS,
  RECOGNITION_MEDIUM_PLUS_MIN_ROUNDS,
  RECOGNITION_MIN_DISCLOSED_CANDIDATES,
  RECOGNITION_MIN_PERSON_TOPICS,
  SESSION_COMPLETED_ROUND_EVENT_TYPES,
  RELATIONSHIP_EFFECTIVE_CARD_EVENT_TYPES,
  type Heat,
  type InformationGainBand,
  type PairFiveGuarantee,
  type RecognitionEvidenceEntry,
  type RelationshipEventType,
  type RelationshipState,
  type TerminalInteractionState,
} from "./v2-state";

/* ------------------------------------------------------------------ */
/* 事件体外壳（R3；engine 落盘前经 zod 校验，此处假设已合规）                 */
/* ------------------------------------------------------------------ */

export interface RelationshipEvent {
  eventId: string;
  type: RelationshipEventType;
  /** interactionId：终态互斥键。计数/跳过/交换类事件必须携带。 */
  ref?: string;
  /** REL_CARD_COMPLETED 消耗的卡 id。 */
  cardId?: string;
  /** 定向覆盖归属玩家（REL_CARD completed/skipped/swapped 用）。 */
  playerId?: string;
  /** mutual check 目标 pair。 */
  pairKey?: string;
  /** mutual check 当事人双方。 */
  playerIds?: readonly [string, string];
  /** match 成型是否需要双方同意（COMPLETE/FINAL 用）。 */
  consented?: boolean;
  /** SYSTEM_MUTUAL_CHECK_DUE 显式目标计数。 */
  dueCount?: number;
  /** NEUTRAL/EXPANSION 组合事件的明确终态。 */
  terminal?: TerminalInteractionState;
  /**
   * P1-1｜§7.2：本卡 metadata 信息增量档（`zero/low/medium/high`）。
   * **fail-closed**：缺省（未补标 / 旧调用方）= 判为「非有效信息轮」，不计 `relationshipEffectiveCardCount`、
   * 不记认识证据、不推 Heat、不减 cooldown。绝不沿用任何默认档位。
   */
  informationGain?: InformationGainBand;
  /**
   * P1-1｜§7.2：本卡主主题（§4 人物维度之一，或缓冲主题 `live_chemistry`）。
   * **fail-closed**：缺省（未补标）= 判为「非有效信息轮」（无人物维度可归）。
   */
  topic?: string;
  /**
   * P1-1｜§7.2：本轮是否发生「**本人实际揭晓/披露**」。
   * **fail-closed**：只有显式 `true` 才算本人揭晓；缺省 / `false`（纯猜测未获本人揭晓）一律不计有效信息轮。
   * 采集渠道见 `roundHistorySchema.result` 的可选逐轮信号；**禁止**按 `interactionType` 猜。
   */
  selfDisclosed?: boolean;
  /**
   * P1-1｜§7.2：本轮实际披露者。**fail-closed**：非数组（未采集）一律不计有效信息轮；
   * 为空数组时虽可计有效轮，但不产生「本次本人披露」证据。
   */
  disclosedPlayerIds?: readonly string[];
  timestamp?: string;
}

/* ------------------------------------------------------------------ */
/* delta                                                               */
/* ------------------------------------------------------------------ */

export type ReduceDeltaReason =
  | "session_completed"
  | "relationship_effective_advanced"
  | "mid_mutual_abandoned"
  | "extension_activated"
  | "heat_changed"
  | "terminal_recorded"
  | "mutual_due"
  | "match_created"
  | "cooldown_set"
  | "cooldown_ticked"
  | "session_limit_reached"
  | "terminal_conflict"
  | "replay_ignored";

export interface ReduceDelta {
  applied: boolean;
  replayed: boolean;
  reasons: ReduceDeltaReason[];
  fromEffectiveCount: number;
  toEffectiveCount: number;
  fromHeat: Heat;
  toHeat: Heat;
}

/* ------------------------------------------------------------------ */
/* 内部工具                                                              */
/* ------------------------------------------------------------------ */

function terminalOf(ev: RelationshipEvent): TerminalInteractionState | null {
  switch (ev.type) {
    case "REL_CARD_COMPLETED":
    case "NEUTRAL_CARD_COMPLETED":
    case "EXPANSION_CARD_COMPLETED":
    case "LEGACY_CURRENT_COMPLETED":
      return "completed";
    case "REL_CARD_SKIPPED":
    case "LEGACY_CURRENT_SKIPPED":
      return "skipped";
    case "REL_CARD_SWAPPED":
      return "swapped";
    case "NEUTRAL_CARD_SKIPPED_OR_SWAPPED":
    case "EXPANSION_CARD_SKIPPED_OR_SWAPPED":
      return ev.terminal ?? null;
    default:
      return null;
  }
}

const isCompletedType = (t: RelationshipEventType): boolean =>
  SESSION_COMPLETED_ROUND_EVENT_TYPES.includes(t);

const isEffectiveAdvancingType = (t: RelationshipEventType): boolean =>
  RELATIONSHIP_EFFECTIVE_CARD_EVENT_TYPES.includes(t);

/**
 * P1-1｜§7.2「有效信息轮」判定——**唯一**允许令 `relationshipEffectiveCardCount +1` 的谓词。
 *
 * 只有「已完成、且实际产生 §4 可复述人物信息」的合法关系主线卡才算。判定是 **fail-closed**：
 * 任何一项**未补标 / 未采集**都判为「不是有效信息轮」，绝不用默认值补位。
 * 明确排除（每一条都对应一次「未补标就静默计数」的漏洞封堵）：
 * - 非 REL completed（skip / swap / neutral / expansion / legacy 只落终态，一律 +0）；
 * - `selfDisclosed` 缺失或 `false`：未采集到「本人揭晓」事实，或纯猜测轮未获本人揭晓；
 * - `informationGain` 缺失（含 `undefined`）：卡未补标 → 不给档，不计数；
 * - `topic` 缺失（含 `undefined`）：卡未补标 → 无人物维度，不计数；
 * - `disclosedPlayerIds` 非数组：披露结果未采集 → 不算「实际产生人物信息」；
 * - `informationGain` 为 `zero` / `low`：无信息 / 纯 buffer（低信息但高现场能量）。
 *
 * 为什么必须有这张卡侧的 `informationGain`/`topic` 而不是只看轮侧信号：
 * §7.2 要的是「中及以上信息轮」与「人物维度」，这两项只能由卡 metadata 提供；
 * 缺它就无从判定「这一轮到底产出了什么人物信息」，故一律不计。
 *
 * ⚠️ 历史版本曾在字段缺省时「沿用 R3 冻结默认（计入）」——那正是被 Human 判为
 * 「最关键的改动」的漏洞：未审内容会靠默认值推进 Heat 与互选窗口。本版本已改为 fail-closed。
 */
export function isEffectiveInformationRound(event: RelationshipEvent): boolean {
  if (!isEffectiveAdvancingType(event.type) || terminalOf(event) !== "completed") return false;
  if (event.selfDisclosed !== true) return false;
  if (event.informationGain === undefined) return false;
  if (event.informationGain === "zero" || event.informationGain === "low") return false;
  if (event.topic === undefined) return false;
  if (!Array.isArray(event.disclosedPlayerIds)) return false;
  return true;
}

/** 本轮实际披露者：显式 `disclosedPlayerIds` 优先；否则 `selfDisclosed===true` 回退到单点名的 `playerId`。 */
function disclosedPlayerIdsOf(event: RelationshipEvent): string[] {
  if (event.disclosedPlayerIds !== undefined) return [...event.disclosedPlayerIds];
  if (event.selfDisclosed === true && event.playerId !== undefined) return [event.playerId];
  return [];
}

/* ------------------------------------------------------------------ */
/* P1-1｜§7.2 认识证据汇总与阈值（reducer 与 mutual 触发共用的唯一口径）      */
/* ------------------------------------------------------------------ */

export interface RecognitionEvidenceSummary {
  /** 已记录的有效信息轮总数（= 每次 +1 一条证据）。 */
  informationRounds: number;
  /** 其中 metadata 档位为 `medium` 或 `high` 的轮数。 */
  mediumPlusRounds: number;
  /** 其中 metadata 档位为 `high` 的轮数。 */
  highRounds: number;
  /** 出现过的**人物维度**（去重、升序；缓冲主题不计）。 */
  topics: string[];
  /** 每位玩家「本人披露过多少次」。 */
  selfDisclosureByCandidate: Record<string, number>;
  /** 有过本人披露的玩家（去重、升序）。 */
  disclosedCandidates: string[];
}

/** 从 `recognitionEvidence` 汇总认识证据（旧 Session 缺字段按空数组，不补算）。 */
export function recognitionEvidenceSummary(state: RelationshipState): RecognitionEvidenceSummary {
  const evidence = state.recognitionEvidence ?? [];
  const selfDisclosureByCandidate: Record<string, number> = {};
  const personTopics = new Set<string>();
  let mediumPlusRounds = 0;
  let highRounds = 0;

  for (const entry of evidence) {
    if (entry.informationGain === "medium" || entry.informationGain === "high") mediumPlusRounds += 1;
    if (entry.informationGain === "high") highRounds += 1;
    if (entry.topic !== null && entry.topic !== LIVE_CHEMISTRY_BUFFER_TOPIC) personTopics.add(entry.topic);
    for (const playerId of entry.disclosedPlayerIds) {
      selfDisclosureByCandidate[playerId] = (selfDisclosureByCandidate[playerId] ?? 0) + 1;
    }
  }

  const disclosedCandidates = Object.keys(selfDisclosureByCandidate).sort();
  return {
    informationRounds: evidence.length,
    mediumPlusRounds,
    highRounds,
    topics: [...personTopics].sort(),
    selfDisclosureByCandidate,
    disclosedCandidates,
  };
}

/**
 * P1-1｜§7.2 候选「认识阈值」是否已达（四项全满足）：
 * 中及以上信息轮≥5、其中高≥1、人物维度≥3、**至少两名实际候选各有本人披露**。
 *
 * 传入 `candidateIds`（此刻合法候选）时，「两名」必须是**此刻合法**的候选——
 * 单锚桌型只有一名合法候选、或第二名从未披露，一律不满足（不用锚点一人的披露冒充两人）。
 */
export function recognitionThresholdMet(
  state: RelationshipState,
  candidateIds?: readonly string[],
): boolean {
  const summary = recognitionEvidenceSummary(state);
  if (summary.mediumPlusRounds < RECOGNITION_MEDIUM_PLUS_MIN_ROUNDS) return false;
  if (summary.highRounds < RECOGNITION_HIGH_MIN_ROUNDS) return false;
  if (summary.topics.length < RECOGNITION_MIN_PERSON_TOPICS) return false;
  const eligibleDisclosers =
    candidateIds === undefined
      ? summary.disclosedCandidates
      : summary.disclosedCandidates.filter((playerId) => candidateIds.includes(playerId));
  return eligibleDisclosers.length >= RECOGNITION_MIN_DISCLOSED_CANDIDATES;
}

/** D5：统计某玩家当前 active MATCH 数（matches 无撤销建模，存量即 active）。 */
export function countActiveMatches(
  matches: RelationshipState["matches"],
  playerId: string,
): number {
  let count = 0;
  for (const match of Object.values(matches)) {
    if (match.playerIds[0] === playerId || match.playerIds[1] === playerId) {
      count += 1;
    }
  }
  return count;
}

/** D5：新建 MATCH 前的原子 cap 校验（已达上限的双方任一超限都不建；已存在的 pair 不重复建）。 */
export function mayCreateMatch(
  matches: RelationshipState["matches"],
  playerIds: readonly [string, string],
  pairKey: string,
): boolean {
  if (matches[pairKey] !== undefined) return true;
  return (
    countActiveMatches(matches, playerIds[0]) < MAX_ACTIVE_MATCHES_PER_PLAYER &&
    countActiveMatches(matches, playerIds[1]) < MAX_ACTIVE_MATCHES_PER_PLAYER
  );
}

/* ------------------------------------------------------------------ */
/* R4 §4.3 / §4.4：玩家退出（终止）与暂离（暂停）                          */
/* ------------------------------------------------------------------ */

/** pairKey（`a::b`，升序）是否含该玩家。 */
const pairHasPlayer = (key: string, playerId: string): boolean => key.split("::").includes(playerId);

/** 移除所有含该玩家的边键（pairKey 即边 id；不含该玩家的边原样保留）。 */
function withoutPlayerEdges<T>(record: Record<string, T>, playerId: string): Record<string, T> {
  const next: Record<string, T> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!pairHasPlayer(key, playerId)) next[key] = value;
  }
  return next;
}

/** 保障进终态 expired（offered/expired 已是终态，不回写、不降级）。 */
function expireGuarantee(guarantee: PairFiveGuarantee, terminalReason: string): PairFiveGuarantee {
  const tracker = guarantee.tracker;
  if (tracker === null || tracker.status === "offered" || tracker.status === "expired") return guarantee;
  return { ...guarantee, tracker: { ...tracker, status: "expired", terminalReason } };
}

/** 保障暂停（只暂停 pending；已 paused 保留原计数，已是终态不动）。 */
function pauseGuarantee(guarantee: PairFiveGuarantee, pauseReason: string): PairFiveGuarantee {
  const tracker = guarantee.tracker;
  if (tracker === null || tracker.status !== "pending") return guarantee;
  return { ...guarantee, tracker: { ...tracker, status: "paused", pauseReason } };
}

/**
 * R4 §4.3 中途退出 `PLAYER_EXITED`：退出是终止语义。
 * 原子处理：删除所有含该 `playerId` 的边——`pairState`（signal）、`cooldowns`、`matches`（MATCH）
 * ——相关 5 档保障进终态 `expired` + `terminalReason="expired-player-exit"`。
 * 删 MATCH 即释放该玩家的 D5 名额（`countActiveMatches` 立即下降，新 MATCH 可再建）；
 * 不含该玩家的边原样保留。把该玩家设为非 active 由参与者投影负责（v2-participants），
 * 本函数只处理关系态边，不碰计数（退出不计 effective count、不推进 Heat/mutual）。
 */
export function applyPlayerExit(state: RelationshipState, playerId: string): RelationshipState {
  const fiveGuarantees: Record<string, PairFiveGuarantee> = {};
  for (const [key, guarantee] of Object.entries(state.fiveGuarantees)) {
    fiveGuarantees[key] = pairHasPlayer(key, playerId)
      ? expireGuarantee(guarantee, "expired-player-exit")
      : guarantee;
  }
  return {
    ...state,
    pairState: withoutPlayerEdges(state.pairState, playerId),
    cooldowns: withoutPlayerEdges(state.cooldowns, playerId),
    matches: withoutPlayerEdges(state.matches, playerId),
    fiveGuarantees,
  };
}

/**
 * R4 §4.4 暂离 `PLAYER_TEMPORARILY_AWAY`：暂离是暂停语义，不删任何边。
 * 含该玩家的边从可调度 pool 排除（由参与者 `active=false` 完成），signal / cooldown / MATCH
 * 全部保留 → D5 名额不释放（第三人不得顶上）；相关 5 档保障标记 `paused` +
 * `pauseReason="player-away"`，已累计的合格机会计数不清零。
 * 暂离不计 effective count、不推进 Heat/mutual，返回后从暂停点继续（不补算）。
 */
export function applyPlayerTemporarilyAway(state: RelationshipState, playerId: string): RelationshipState {
  const fiveGuarantees: Record<string, PairFiveGuarantee> = {};
  for (const [key, guarantee] of Object.entries(state.fiveGuarantees)) {
    fiveGuarantees[key] = pairHasPlayer(key, playerId)
      ? pauseGuarantee(guarantee, "player-away")
      : guarantee;
  }
  return { ...state, fiveGuarantees };
}

/**
 * §7.2 中途互选「硬门」（**不含**认识阈值）：中途常规互选必须逐条满足——
 * ①dueCount ∈ MUTUAL_CHECK_COUNTS（中途互选窗口 12/13/14）；
 * ②target - sessionCompletedRounds >= 2（target = extensionActivated ? 25 : 20）；
 * ③regularMutualCheckRuns < MAX_REGULAR_MUTUAL_RUNS(1)，即一局中途最多一次；
 * ④lastMutualCheckAtEffectiveCount 为 null 或 dueCount - last >= 5；
 * ⑤本局中途互选尚未永久跳过（`midMutualCheckAbandoned !== true`）；
 * ⑥Heat ≥ MUTUAL_MIN_HEAT(H3)。
 *
 * 只约束「中途常规互选」；结束的最终互选走 SYSTEM_MUTUAL_CHECK_FINAL，不过本门、不计次数。
 */
export function mutualMidWindowGates(state: RelationshipState, dueCount: number): boolean {
  if (state.midMutualCheckAbandoned === true) return false;
  if (!isHeatAtLeast(state.heat, MUTUAL_MIN_HEAT)) return false;
  const targetSessionCompletedRounds = state.extensionActivated
    ? MAX_SESSION_COMPLETED_ROUNDS
    : BASE_SESSION_COMPLETED_ROUND_LIMIT;
  const hasEligibleDueCount = (MUTUAL_CHECK_COUNTS as readonly number[]).includes(dueCount);
  const hasRemainingRounds =
    targetSessionCompletedRounds - state.sessionCompletedRounds >=
    MINIMUM_REMAINING_SESSION_ROUNDS_FOR_REGULAR_MUTUAL;
  const isUnderRunCap = state.regularMutualCheckRuns < MAX_REGULAR_MUTUAL_RUNS;
  const hasEnoughGap =
    state.lastMutualCheckAtEffectiveCount === null ||
    dueCount - state.lastMutualCheckAtEffectiveCount >= MINIMUM_EFFECTIVE_CARDS_BETWEEN_RUNS;
  return hasEligibleDueCount && hasRemainingRounds && isUnderRunCap && hasEnoughGap;
}

/**
 * P1-1｜中途互选唯一总门：硬门（窗口/剩余轮次/一局一次/间隔/未放弃/Heat≥H3）**且**认识阈值已达。
 * reducer 的 `SYSTEM_MUTUAL_CHECK_DUE` 与 `v2-mutual-check` 的触发判定共用本函数，不另写第二套。
 * `candidateIds` 传入「此刻合法候选」时，认识阈值里的「两名候选」收窄为此刻合法者（单锚桌型口径）。
 */
export function mutualDueGates(
  state: RelationshipState,
  dueCount: number,
  candidateIds?: readonly string[],
): boolean {
  return mutualMidWindowGates(state, dueCount) && recognitionThresholdMet(state, candidateIds);
}

/**
 * §7.2 第 6a 步「此刻合法候选」的来源：**显式参数**，沿真实 reduce 调用链（
 * `reduceRoundRecord` / `reduceV2SessionEvents`）由入口层按当前 `participants` 算出后传入，
 * 与 `v2-mutual-check` 触发点共用同一份实现（`v2-participants.mutualCandidateIds`）。
 *
 * 为什么不是 injectable 单例 resolver：模块级可变状态是跨局/跨测试的隐式全局，
 * 谁忘了设置就静默退回「全部披露者」口径（曾导致 6a 与触发点口径不一致、窗口上界不置
 * `midMutualCheckAbandoned`）。显式参数让「没传 = 不收窄」在调用点可见、可测、无副作用。
 *
 * `undefined` = 不收窄（等价于「用全部披露者」）；传入（含空数组）= 按此刻合法候选收窄
 * ——空候选时「两名候选各有披露」必然不达，等价于「无合法 pair → 放弃」。
 */

/* ------------------------------------------------------------------ */
/* reducer                                                             */
/* ------------------------------------------------------------------ */

/**
 * 把一条 R3 事件归约到 RelationshipState（纯函数，不动原 state）。
 * 语义：eventId 幂等 → 终态互斥 → completed 消耗轮次（上限 25）
 * → REL completed 推进 effective 计数 → Heat 重算 → 扩展激活 → mutual/MATCH。
 *
 * `candidateIds`（可选）：**此刻合法候选**，由入口层（`reduceV2SessionEvents` /
 * `reduceRoundRecord`）按当前 `participants` 用 `v2-participants.mutualCandidateIds` 算出后传入，
 * 与触发点同源；6a 的「窗口上界是否仍可行」与第 9 步的 `SYSTEM_MUTUAL_CHECK_DUE` 复核都用它收窄
 * 「两名候选各有披露」。缺省 `undefined` = 不收窄（低层直接调用维持旧行为）。
 */
export function reduceRelationshipEvent(
  state: RelationshipState,
  event: RelationshipEvent,
  candidateIds?: readonly string[],
): { state: RelationshipState; delta: ReduceDelta } {
  const baseDelta: ReduceDelta = {
    applied: false,
    replayed: false,
    reasons: [],
    fromEffectiveCount: state.relationshipEffectiveCardCount,
    toEffectiveCount: state.relationshipEffectiveCardCount,
    fromHeat: state.heat,
    toHeat: state.heat,
  };

  /* 1) eventId 幂等：处理过的一律丢弃 */
  if (state.processedEventIds.includes(event.eventId)) {
    return {
      state,
      delta: { ...baseDelta, replayed: true, reasons: ["replay_ignored"] },
    };
  }

  /* 2) 终态互斥：ref 已有终态 → 一律视为重复 */
  if (event.ref && state.terminalExclusivity[event.ref] !== undefined) {
    return {
      state,
      delta: { ...baseDelta, reasons: ["terminal_conflict"] },
    };
  }

  const next = { ...state };
  const reasons: ReduceDeltaReason[] = [];
  const terminal = terminalOf(event);

  /* 3) 记录 eventId（幂等集合） */
  next.processedEventIds = [...state.processedEventIds, event.eventId];

  /* 4) 记录终态互斥 */
  if (event.ref && terminal) {
    next.terminalExclusivity = { ...next.terminalExclusivity, [event.ref]: terminal };
    reasons.push("terminal_recorded");
  }

  /* 5) completed 类：消耗 Session 轮次（未加玩封顶 20，Host 加玩后 25） */
  if (terminal === "completed" && isCompletedType(event.type)) {
    const completedLimit = next.extensionActivated
      ? MAX_SESSION_COMPLETED_ROUNDS
      : BASE_SESSION_COMPLETED_ROUND_LIMIT;
    if (next.sessionCompletedRounds >= completedLimit) {
      return {
        state,
        delta: { ...baseDelta, reasons: [...reasons, "session_limit_reached"] },
      };
    }
    next.sessionCompletedRounds = next.sessionCompletedRounds + 1;
    reasons.push("session_completed");
  }

  /* 6) REL completed 且为「有效信息轮」：推进 relationshipEffectiveCardCount（唯一来源）
        ＋记 usedCardIds ＋追写认识证据（卡 ID + 实际披露结果，供 MC 复算）。
        buffer / 纯猜测未揭晓 / zero-low / 非 completed 一律不进本分支（见 isEffectiveInformationRound）。 */
  if (isEffectiveInformationRound(event)) {
    const before = next.relationshipEffectiveCardCount;
    next.relationshipEffectiveCardCount = before + 1;
    reasons.push("relationship_effective_advanced");
    if (event.cardId) next.usedCardIds = [...next.usedCardIds, event.cardId];
    const evidence: RecognitionEvidenceEntry = {
      cardId: event.cardId ?? "",
      informationGain: event.informationGain ?? null,
      topic: event.topic ?? null,
      disclosedPlayerIds: disclosedPlayerIdsOf(event),
    };
    next.recognitionEvidence = [...(next.recognitionEvidence ?? []), evidence];
  }

  /* 6a) 中途互选「本局永久跳过」的唯一判定（P0：必须覆盖**全部**缺失条件，不能只看认识阈值）。

        触发条件（三条全成立）：
        ① 尚未放弃，且从未问过常规互选（`regularMutualCheckRuns === 0`）、无更晚一次记录
           （`lastMutualCheckAtEffectiveCount === null`）——问过就不再改判，避免把已发生的互选抹掉；
        ② 有效卡计数**已越过窗口上界 14**（任何原因错过窗口）→ 直接放弃；
        ③ 或恰好**到 14**（窗口上界）时，§7.2 的中途互选前置条件仍**未全部满足**。

        第 ③ 条的「前置条件」不是只看认识阈值（二轮复审点名的缺口），而是与真正触发点
        （`mutualCheckTrigger` / `mutualDueGates`）**同源**地逐条复核：
        - `mutualMidWindowGates`：窗口计数、剩余轮次、一局一次、最小间隔、Heat≥H3、未放弃；
        - `recognitionThresholdMet`：认识阈值（中及以上≥5 / 高≥1 / 人物维度≥3 / 两名合法候选各有披露）。
        另外还要求「此刻存在合法候选 pair」——由 `recognitionThresholdMet` 的 `candidateIds`
        收窄共同保证（候选为空时「两名候选」必然不达，等价于无合法 pair → 放弃）。

        reducer 自证不了的两项（「已有私聊在跑」「耗尽/等待态」是 UI 运行态而非 relationshipState
        字段）不在此硬判：它们属于「此刻不能弹、但语义上并未放弃」，若在此判死会把
        「条件其实够、只是暂时被挡」的本局中途互选误标为永久放弃。这两项由触发点实时复核。 */
  const windowReached = next.relationshipEffectiveCardCount >= MUTUAL_CHECK_WINDOW_MAX;
  const midMutualStillViableAtWindowEnd =
    !windowReached ||
    (mutualMidWindowGates(next, MUTUAL_CHECK_WINDOW_MAX) &&
      recognitionThresholdMet(next, candidateIds));
  if (
    next.midMutualCheckAbandoned !== true &&
    next.regularMutualCheckRuns === 0 &&
    next.lastMutualCheckAtEffectiveCount === null &&
    !midMutualStillViableAtWindowEnd
  ) {
    next.midMutualCheckAbandoned = true;
    reasons.push("mid_mutual_abandoned");
  }

  /* 6b) skip/swap 的 cardId 也进 used，防止立即重现 */
  if (
    (event.type === "REL_CARD_SKIPPED" || event.type === "REL_CARD_SWAPPED") &&
    event.cardId
  ) {
    next.usedCardIds = [...next.usedCardIds, event.cardId];
  }

  /* 6c) Coverage：仅 REL 定向 completed/skipped 记 offered（R3 冻结表口径）；
       swapped 只写 usedCardIds，不动 coverage（offered/completed 均 +0）。
       completed：completed+1、连续跳过清零、低参与解除；
       skipped：连续跳过+1，达阈值（2）标低参与。 */
  if (
    event.playerId &&
    (event.type === "REL_CARD_COMPLETED" || event.type === "REL_CARD_SKIPPED")
  ) {
    const prev = next.playerCoverage[event.playerId] ?? createEmptyPlayerCoverage();
    const coverage = { ...prev, offeredTargeted: prev.offeredTargeted + 1 };
    if (event.type === "REL_CARD_COMPLETED") {
      coverage.completedTargeted = prev.completedTargeted + 1;
      coverage.consecutiveTargetedSkips = 0;
      coverage.lowParticipation = false;
    } else if (event.type === "REL_CARD_SKIPPED") {
      const skips = prev.consecutiveTargetedSkips + 1;
      coverage.consecutiveTargetedSkips = skips;
      coverage.lowParticipation = skips >= DEFAULT_COVERAGE_LOW_PARTICIPATION_SKIP_THRESHOLD;
    }
    next.playerCoverage = { ...next.playerCoverage, [event.playerId]: coverage };
  }

  /* 7) Heat 重算（只看 relationshipEffectiveCardCount） */
  next.heat = heatForEffectiveCount(next.relationshipEffectiveCardCount);
  if (next.heat !== state.heat) reasons.push("heat_changed");

  /* 7b) cooldown 递减与「有效信息轮」**同源**（P0：同一谓词，不再各写一套）。
       只有真正推进了 relationshipEffectiveCardCount 的那一轮才让所有 cooldown 值 -1（下限 0，不清键，
       0 即无冷却）。于是「低信息 / 未揭晓 / 未补标的 completed」与 neutral/expansion/legacy 一样**不递减**——
       cooldown 的推进速率与有效卡计数严格一致，不会出现「计数不动、冷却照减」的错位。 */
  if (isEffectiveInformationRound(event)) {
    const pairs = Object.entries(next.cooldowns);
    if (pairs.length > 0) {
      const ticked: Record<string, number> = {};
      let changed = false;
      for (const [key, value] of pairs) {
        const nextValue = Math.max(0, value - 1);
        ticked[key] = nextValue;
        if (nextValue !== value) changed = true;
      }
      next.cooldowns = ticked;
      if (changed) reasons.push("cooldown_ticked");
    }
  }

  /* 8) 加玩激活：仅 Host 在结算点显式选择，整局最多一次（R3 §三.3） */
  if (event.type === "EXTENSION_ACTIVATED_BY_HOST" && !next.extensionActivated) {
    next.extensionActivated = true;
    reasons.push("extension_activated");
  }

  /* 9) mutual due：硬门（窗口/剩余轮次/一局一次/间隔/未放弃/Heat≥H3）＋认识阈值全满足
       才标记并累计一轮 regular run；任一不满足直接返回（不 push mutual_due，不标记）。
       口径见 mutualDueGates（reducer 与 v2-mutual-check 共用唯一总门）。 */
  if (event.type === "SYSTEM_MUTUAL_CHECK_DUE") {
    const dueCount = event.dueCount ?? next.relationshipEffectiveCardCount;
    if (mutualDueGates(next, dueCount, candidateIds)) {
      next.lastMutualCheckAtEffectiveCount = dueCount;
      next.regularMutualCheckRuns = next.regularMutualCheckRuns + 1;
      reasons.push("mutual_due");
    }
  }

  /* 10) MATCH 成型：COMPLETE/FINAL 且双方同意 → 建 match + 设 cooldown
       D5：建新 MATCH 前原子校验双方 active MATCH 数均 <2，达上限中性 no-action。 */
  const matchSignal =
    event.type === "SYSTEM_MUTUAL_CHECK_COMPLETE" ||
    event.type === "SYSTEM_MUTUAL_CHECK_FINAL";
  if (matchSignal && event.consented === true && event.pairKey && event.playerIds) {
    const alreadyMatched = next.matches[event.pairKey] !== undefined;
    if (mayCreateMatch(next.matches, event.playerIds, event.pairKey)) {
      if (!alreadyMatched) {
        next.matches = {
          ...next.matches,
          [event.pairKey]: {
            pairKey: event.pairKey,
            matchedAt: event.timestamp ?? "1970-01-01T00:00:00.000Z",
            playerIds: event.playerIds,
          },
        };
        reasons.push("match_created");
      }
      const curCooldown = next.cooldowns[event.pairKey] ?? 0;
      const upCooldown = Math.max(curCooldown, MINIMUM_EFFECTIVE_CARDS_BETWEEN_RUNS);
      if (upCooldown !== curCooldown) {
        next.cooldowns = { ...next.cooldowns, [event.pairKey]: upCooldown };
        reasons.push("cooldown_set");
      }
    }
  }

  return {
    state: next,
    delta: {
      ...baseDelta,
      applied: true,
      reasons,
      fromEffectiveCount: state.relationshipEffectiveCardCount,
      toEffectiveCount: next.relationshipEffectiveCardCount,
      fromHeat: state.heat,
      toHeat: next.heat,
    },
  };
}

export { createInitialRelationshipState } from "./v2-state";