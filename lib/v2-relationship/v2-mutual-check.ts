/**
 * B9 / D5｜SYSTEM_MUTUAL_CHECK 私密互选运行控制器（纯内存，UI 无关）。
 *
 * 职责边界：
 * - 触发判定：按 v2-state 口径（`MUTUAL_CHECK_COUNTS` = 中途互选窗口 12/13/14）＋ §7.2 硬门
 *   ＋ §7.2 认识阈值（先了解再询问兴趣），判「现在该不该弹」，且必须 `pairMode=ACTIVE`
 *   （D4=A 无合法 pair 一律不弹、不空转）。一局中途最多一次；到 14 仍未全满足即永久跳过。
 *   结束时最多一次最终互选（`SYSTEM_MUTUAL_CHECK_FINAL`）是独立机制，走 `mutualFinalCheckTrigger`。
 * - run 编排：每位参与者一份 `v2-private` 纯内存 run（按 pairKey），单向选择只写进这些内存对象；
 *   本模块不 import 任何 storage / DB / 日志，单向秘密没有落盘入口。
 * - final（R4 §6.2）：先在内存里算出「允许公开的互选结果」，再清空全部单向数据；
 *   被 D5 上限 2 拦下的 pair 既不建 MATCH、也不以任何形式出现在结果里。
 *
 * 与 reducer 的单一口径：due 四道门与 D5 cap 校验都直接复用 v2-reducer 导出的
 * `mutualDueGates` / `mayCreateMatch`，本模块不复制第二套规则。
 */

import { createId } from "@/lib/utils/create-id";
import {
  beginPrivateRun,
  clearPrivateRun,
  mutualResult,
  submitPrivateChoice,
  type PrivateMutualRun,
} from "./v2-private";
import { eligiblePairKeys, mutualCandidateIds, pairModeFor, type PairMode } from "./v2-participants";
import {
  mayCreateMatch,
  mutualDueGates,
  mutualMidWindowGates,
  recognitionThresholdMet,
  type RelationshipEvent,
} from "./v2-reducer";
import {
  MUTUAL_CHECK_COUNTS,
  type RelationshipState,
  type SessionParticipant,
} from "./v2-state";

/**
 * 互选候选人投影（唯一真源在 `v2-participants`）：本模块与 `v2-session` 归约入口共用同一实现。
 * 这里原样转出，保持既有 `@/lib/v2-relationship/v2-mutual-check` 导入路径不变。
 */
export { mutualCandidateIds } from "./v2-participants";

/** 一位参与者对某条 pair 的「我选 TA」标记：同 run 双方写同值才构成互选。 */
const MUTUAL_PICK = "mutual-pick";

/* ------------------------------------------------------------------ */
/* 触发判定                                                              */
/* ------------------------------------------------------------------ */

export type MutualCheckTriggerReason =
  /** 该弹。 */
  | "ok"
  /** D4=A：无合法男女 pair（含人数不足/全未选/单目标性别）→ 不创建 run、不空转。 */
  | "no-eligible-pair"
  /** 当前 relationshipEffectiveCardCount 不在中途互选窗口 12/13/14 内（含已越过 14 后的所有计数，不补问）。 */
  | "not-at-checkpoint"
  /** 到了检查点但 §7.2 硬门未过（剩余轮次/整局次数/最小间隔/Heat<H3）。 */
  | "gates-not-passed"
  /**
   * P1-1｜§7.2：硬门已过但**认识阈值未达**（中及以上信息轮<5 / 高<1 / 人物维度<3 /
   * 不足两名此刻合法候选各有本人披露）→ 先了解再询问兴趣：不弹。
   */
  | "recognition-threshold-not-met"
  /**
   * P1-1｜§7.2：本局中途互选已**永久跳过**（有效卡计数越过 14 仍未全满足）→ 后续不补问。
   */
  | "mid-mutual-abandoned"
  /**
   * D8=A+｜Host 耗尽决策等待态（`AWAITING_HOST_EXHAUSTION_DECISION`）：实时阻断，不弹。
   * 语义是「暂时被挡」而非「永久放弃」——因此**不**置 `midMutualCheckAbandoned`，
   * 解除等待后若仍在窗口内可再次弹（详见 `mutualCheckTrigger` 判定顺序）。
   */
  | "awaiting-host-decision"
  /** 本局已暂停/结束：私密流程不开始。 */
  | "session-not-running";

export interface MutualCheckTriggerInput {
  relationship: RelationshipState;
  participants: readonly SessionParticipant[];
  /** Session 状态；只有 `active` 视为 RUNNING（R4 §7.1）。 */
  sessionStatus: "generating" | "active" | "paused" | "finished";
  /** 是否已有别的私密流程在跑（本流程自身运行时为 true）。 */
  privateFlowRunning?: boolean;
  /**
   * D8=A+｜是否处于 Host 耗尽决策等待态（`v2Orchestration.awaitingHostDecision`）。
   * true = 实时阻断本次弹窗（不弹、不空转）；属「暂时被挡」，不写永久放弃标志。
   * 中途（`mutualCheckTrigger`）与最终（`mutualFinalCheckTrigger`）**共用本输入与同一 reason**
   * （`awaiting-host-decision`），两者都为 true 时实时阻断。
   * 缺省 `undefined` = 与加该输入前逐条一致（非等待态）。
   */
  awaitingHostDecision?: boolean;
}

export interface MutualCheckTrigger {
  due: boolean;
  /** 命中的中途互选检查点（窗口 12/13/14 内当前值）；未命中为 null。 */
  checkpoint: number | null;
  pairMode: PairMode;
  reason: MutualCheckTriggerReason;
}

/**
 * 该不该弹私密互选（P1-1「先了解，再询问兴趣」）：v2-state 口径 + 合法 pair + Session RUNNING +
 * 无并行私密流程 + §7.2 认识阈值。
 *
 * 判定顺序（口径唯一，复用 v2-reducer 的 `mutualMidWindowGates` / `recognitionThresholdMet`，
 * 总门 = `mutualDueGates`，不另写第二套）：
 * ①本局中途互选已永久跳过 → `mid-mutual-abandoned`；
 * ②无合法男女 pair → `no-eligible-pair`；
 * ③有效卡计数不在窗口 12/13/14 → `not-at-checkpoint`（15+ 不补问）；
 * ④Host 耗尽等待态 → `awaiting-host-decision`（实时阻断；不写永久放弃）；
 * ⑤非 RUNNING / 已有私密流程 → `session-not-running`；
 * ⑥§7.2 硬门未过（剩余轮次/一局一次/最小间隔/Heat<H3）→ `gates-not-passed`；
 * ⑦认识阈值未达（且「两名候选」收窄为**此刻合法候选**）→ `recognition-threshold-not-met`；
 * ⑧否则 `ok`。
 */
export function mutualCheckTrigger(input: MutualCheckTriggerInput): MutualCheckTrigger {
  const pairMode = pairModeFor(input.participants);
  const count = input.relationship.relationshipEffectiveCardCount;
  const checkpoint = (MUTUAL_CHECK_COUNTS as readonly number[]).includes(count) ? count : null;

  if (input.relationship.midMutualCheckAbandoned === true) {
    return { due: false, checkpoint, pairMode, reason: "mid-mutual-abandoned" };
  }
  if (pairMode !== "ACTIVE") {
    return { due: false, checkpoint, pairMode, reason: "no-eligible-pair" };
  }
  if (checkpoint === null) {
    return { due: false, checkpoint: null, pairMode, reason: "not-at-checkpoint" };
  }
  if (input.awaitingHostDecision === true) {
    return { due: false, checkpoint, pairMode, reason: "awaiting-host-decision" };
  }
  if (input.sessionStatus !== "active" || input.privateFlowRunning === true) {
    return { due: false, checkpoint, pairMode, reason: "session-not-running" };
  }
  const candidateIds = mutualCandidateIds(input.participants);
  if (!mutualDueGates(input.relationship, checkpoint, candidateIds)) {
    // 唯一总门未过：只为给出可读 reason 再分解一次（规则本身不重复）。
    const reason: MutualCheckTriggerReason = mutualMidWindowGates(input.relationship, checkpoint)
      ? "recognition-threshold-not-met"
      : "gates-not-passed";
    return { due: false, checkpoint, pairMode, reason };
  }
  return { due: true, checkpoint, pairMode, reason: "ok" };
}

/**
 * P1-1｜§7.2 结束时的**最终互选**资格：只在认识阈值满足且候选合法时可提出。
 *
 * 与中途互选解耦：不受窗口 12/13/14 / 一局一次 / 最小间隔约束（这些只约束中途常规互选），
 * 但同样要求 Session RUNNING、有合法候选 pair，且认识阈值已达
 * （「至少两名实际候选各有本人披露」按**此刻合法候选**判定）。
 *
 * D8=A+｜与中途互选同一口径：`awaitingHostDecision === true` 时实时阻断（`due=false`，
 * reason=`awaiting-host-decision`），属「暂时被挡」而非永久放弃——本函数是纯判定，
 * 不写任何 abandoned 标志。
 *
 * Step 3（2026-09-28 Human 决策）：最终互选当前**只做技术能力**，不替 Human 冻结 Heat。
 * - 原写死的 `Heat>=H3`（`MUTUAL_MIN_HEAT`）已**移除**，Heat **不参与**最终互选判定；
 * - 最终互选 Heat / 最终时点**继续留空**，等后续 Monte Carlo + Human Gate 冻结
 *   （留空位置见函数内 `HEAT / TIMING` 占位）；
 * - 本函数**未接入 App 结束流程**（Human 明令不接），只暴露「可判断」能力，不强制执行。
 */
export function mutualFinalCheckTrigger(input: MutualCheckTriggerInput): MutualCheckTrigger {
  const pairMode = pairModeFor(input.participants);
  if (pairMode !== "ACTIVE") {
    return { due: false, checkpoint: null, pairMode, reason: "no-eligible-pair" };
  }
  /* D8=A+｜Host 耗尽决策等待态 → 实时阻断（与中途互选同 reason；纯判定，不写 abandoned）。
   * 顺序与 `mutualCheckTrigger` 一致：awaiting 先于 sessionStatus，pairMode 先于两者。 */
  if (input.awaitingHostDecision === true) {
    return { due: false, checkpoint: null, pairMode, reason: "awaiting-host-decision" };
  }
  if (input.sessionStatus !== "active" || input.privateFlowRunning === true) {
    return { due: false, checkpoint: null, pairMode, reason: "session-not-running" };
  }
  /* HEAT / TIMING（留空占位，不参与判定）：
   * 最终互选的最低 Heat 与触发时点**尚未冻结**——此处禁止写死 `Heat>=H3` 等产品规则，
   * 也禁止借该门接 App 结束流程强制触发。待 MC 复算 + Human Gate 冻结后，才可在此补入真实条件。 */
  if (!recognitionThresholdMet(input.relationship, mutualCandidateIds(input.participants))) {
    return { due: false, checkpoint: null, pairMode, reason: "recognition-threshold-not-met" };
  }
  return { due: true, checkpoint: null, pairMode, reason: "ok" };
}

/* ------------------------------------------------------------------ */
/* run（纯内存）                                                          */
/* ------------------------------------------------------------------ */

export interface MutualCheckRun {
  runId: string;
  /** 本 run 的候选人（点名顺序 = participants 顺序，且至少属于一条合法边）。 */
  playerIds: readonly string[];
  /** pairKey → 该 pair 的纯内存私密 run；离开本 run 即整体丢弃。 */
  pairRuns: Record<string, PrivateMutualRun>;
}

/** 候选人 = 至少属于一条合法 eligible 边的参与者（R4 §7.1 mutualCandidateCount 口径）。 */
/* `mutualCandidateIds` 的唯一实现已上移到 `v2-participants`（与归约入口同源），此处 import 复用。 */

/* ------------------------------------------------------------------ */
/* R-CB9｜Mutual UI 按「当前合法异性候选数」分支（与 Guard 阈值解耦）          */
/* ------------------------------------------------------------------ */

/**
 * 仅剩一个合法候选时的固定问句模板（UI 用对方昵称替换 {name} 占位符）。
 * 用户 2026-09-27 真人实测（RG-01）后要求点名对方昵称：原「TA」无指向，看不出是在问谁。
 * 判定/编排逻辑与该文案完全无关，改文案不改行为。
 */
export const MUTUAL_SINGLE_CANDIDATE_PROMPT = "今晚到现在，你愿意继续了解 {name} 吗？";

/** 把模板渲染成实际问句：只替换 {name} 占位符，不做其他拼接。 */
export function mutualSingleCandidatePrompt(name: string): string {
  return MUTUAL_SINGLE_CANDIDATE_PROMPT.replace("{name}", name);
}

/** 多候选分支问句：候选人昵称直接列成按钮，点谁即选谁并立即提交。 */
export const MUTUAL_MULTI_CANDIDATE_PROMPT = "今晚到现在，你最想继续了解谁？";
/** 唯一候选分支的两个选项：「愿意」→ 该唯一候选；「暂时没有」→ null。 */
export const MUTUAL_SINGLE_CANDIDATE_YES = "愿意";
export const MUTUAL_SINGLE_CANDIDATE_NO = "暂时没有";
/**
 * 候选在作答期间暂离/失效时的可读提示：拒绝提交、不产生非法 MATCH。
 * 不写字面「TA」：互选全流程（问句标题 / 提示）统一不用含糊代词，避免看不出在说谁。
 */
export const MUTUAL_STALE_TARGET_NOTICE = "对方现在不在可选范围内，先跳过吧。";

/**
 * 某玩家在**当前合法 pair 池**里的合法异性候选（去重、升序）。
 *
 * 与 `mutualCandidateIds` / `beginMutualCheckRun` 同源（都从 `eligiblePairKeys` 取），
 * 是 Mutual 单候选 UI 分支（R-CB9）与提交前边合法校验的唯一真源：
 * - 只看真实存在的 eligible 边，不引入第二套判定、不看 Single-Anchor Guard 阈值；
 * - 暂离（`active=false`）/ 性别未录入的参与者天然不在结果里，因此失效目标既选不到、也提交不了。
 */
export function mutualPartnerIds(
  playerId: string,
  participants: readonly SessionParticipant[],
  pairKeys: readonly string[] = eligiblePairKeys(participants),
): string[] {
  const partners = new Set<string>();
  for (const key of pairKeys) {
    const [first, second] = key.split("::") as [string | undefined, string | undefined];
    if (!first || !second) continue;
    if (first === playerId && second !== playerId) partners.add(second);
    else if (second === playerId && first !== playerId) partners.add(first);
  }
  return [...partners].sort();
}

/** 建立一次 mutual run：无合法 pair 时 pairRuns/candidates 为空（调用方不得弹）。 */
export function beginMutualCheckRun(participants: readonly SessionParticipant[]): MutualCheckRun {
  const pairKeys = eligiblePairKeys(participants);
  const pairRuns: Record<string, PrivateMutualRun> = {};
  for (const key of pairKeys) {
    const [first, second] = key.split("::") as [string, string];
    pairRuns[key] = beginPrivateRun(key, [first, second]);
  }
  return {
    runId: createId(),
    playerIds: mutualCandidateIds(participants, pairKeys),
    pairRuns,
  };
}

/**
 * 提交前校验：目标 pair 必须在建 run 时已存在。
 *
 * R-CB10：run 中途 roster 变化可能产生新的合法边（如补录性别后新增 pair），
 * 但 run.pairRuns 是 beginMutualCheckRun 时的快照——新 pair 不在其中，
 * `submitMutualChoice` 会把它静默降级为跳过。调用方（UI）必须在提交前用本函数
 * 拦下这种情况：不存在则按可读提示拒绝提交、留在原屏，绝不静默丢弃。
 */
export function mutualPairRunExists(
  run: MutualCheckRun,
  playerId: string,
  targetPlayerId: string,
): boolean {
  if (playerId === targetPlayerId) return false;
  return Object.keys(run.pairRuns).some((key) => {
    const [first, second] = key.split("::") as [string, string];
    return (first === playerId && second === targetPlayerId)
      || (first === targetPlayerId && second === playerId);
  });
}

/**
 * 记一位参与者的单向选择：只选一人或跳过（null）。
 *
 * 只写内存：涉及的每条 pair run 里，本人一侧记为「我选 TA」（选中的那条 pair）或 null（其余）。
 * 非法目标（选自己 / 不在候选人里）一律按跳过处理，不抛错、不写任何痕迹。
 */
export function submitMutualChoice(
  run: MutualCheckRun,
  playerId: string,
  targetPlayerId: string | null,
): MutualCheckRun {
  if (!run.playerIds.includes(playerId)) return run;
  const target = targetPlayerId !== null && run.playerIds.includes(targetPlayerId) && targetPlayerId !== playerId
    ? targetPlayerId
    : null;
  for (const [key, pairRun] of Object.entries(run.pairRuns)) {
    const [first, second] = key.split("::") as [string, string];
    if (playerId !== first && playerId !== second) continue;
    const partner = playerId === first ? second : first;
    submitPrivateChoice(pairRun, playerId, target === partner ? MUTUAL_PICK : null);
  }
  return run;
}

/** 只允许公开的互选结果：仅「双方互选且未被 D5 上限拦下」的 pair。 */
export interface MutualCheckPublicResult {
  matches: { pairKey: string; playerIds: [string, string] }[];
}

/**
 * 收束一次 mutual run（R4 §6.2 `FINALIZED / mutual-final`）：
 * 1. 先在内存里算出允许公开的结果集（双方互选 ∩ 本次新成立 ∩ D5 cap 校验通过）；
 * 2. 立即清空所有单向数据（含未选中的一侧、draft 痕迹、遮罩态）。
 * 被上限拦下或单向未成的 pair 一律不进结果，返回值不含任何单向明细。
 *
 * 「本次新成立」：`relationship.matches[pairKey]` 已是 MATCH 的 pair 不再作为本次新互选公布
 * （否则同一对会被当成「又互选成功」重复公布、重复建 COMPLETE 事件）。原 MATCH 原样保留；
 * reducer 侧 `mayCreateMatch` 对已存在 pair 的幂等语义不变，这里只收窄「公开面」。
 */
export function finalizeMutualCheckRun(
  run: MutualCheckRun,
  relationship: RelationshipState,
): MutualCheckPublicResult {
  const matches: MutualCheckPublicResult["matches"] = [];
  for (const [key, pairRun] of Object.entries(run.pairRuns).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    if (!mutualResult(pairRun).match) continue;
    if (relationship.matches[key] !== undefined) continue;
    const [first, second] = key.split("::") as [string, string];
    if (!mayCreateMatch(relationship.matches, [first, second], key)) continue;
    matches.push({ pairKey: key, playerIds: [first, second] });
  }
  clearMutualCheckRun(run);
  return { matches };
}

/** 清空一次 run 的全部单向痕迹并关闭遮罩；调用方随后丢弃引用即可（无落盘入口）。 */
export function clearMutualCheckRun(run: MutualCheckRun): void {
  for (const pairRun of Object.values(run.pairRuns)) clearPrivateRun(pairRun);
}

/* ------------------------------------------------------------------ */
/* 落盘事件计划（只含公开结果与 due 标记，不含任何单向数据）                   */
/* ------------------------------------------------------------------ */

/**
 * finalize 后要归约的 R3 事件：
 * - 一条 `SYSTEM_MUTUAL_CHECK_DUE`：把本次常规互选记为已完成（四道门在 reducer 内复核，重放安全）；
 * - 每个新 MATCH 一条 `SYSTEM_MUTUAL_CHECK_COMPLETE`（`consented=true`），由 reducer 原子建 MATCH + cooldown。
 * 事件里只有 pairKey / playerIds 等公开信息，绝不携带「谁选了什么 / 谁跳过了」。
 */
export function mutualCheckFinalEvents(
  runId: string,
  checkpoint: number,
  result: MutualCheckPublicResult,
  timestamp: string,
): RelationshipEvent[] {
  return [
    {
      eventId: `${runId}::due`,
      type: "SYSTEM_MUTUAL_CHECK_DUE",
      dueCount: checkpoint,
      timestamp,
    },
    ...result.matches.map((match) => ({
      eventId: `${runId}::match::${match.pairKey}`,
      type: "SYSTEM_MUTUAL_CHECK_COMPLETE" as const,
      pairKey: match.pairKey,
      playerIds: match.playerIds,
      consented: true,
      timestamp,
    })),
  ];
}
