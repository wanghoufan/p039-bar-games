/**
 * A8｜「同档不同轴」的**语义级可执行判据**（planning-only 审计模块，先不进 Formal）。
 *
 * ## 为什么要有这个文件（A8 派工单 Part 2，本单最重要的工程产出）
 * A6/A7 用两道**自证表**当约束①（同档不同轴）的证据：
 * - `PACK1_SUPPLEMENT_AXES`（内容轴名）与 `PACK1_SUPPLEMENT_SHOTS`（动作帧名）——
 *   两表都是**逐卡手写的自由字符串**，14 张卡就有 14 个互不相同的标签，
 *   「唯一」是**因为作者给每张卡都编了一个新名字**，不是因为它证明了两张卡语义不同。
 * 后果（第三轮主审定性）：
 * - `274`（分两组跟谁一队）vs `275`（跟谁玩一局狼人杀）：`SHOTS` 里一个是 `组队`、
 *   一个是 `玩法·狼人杀`，字符串不同 ⇒ 旧断言直接放行；但**一局桌游就是一次组队、答案必然同一个人**。
 * - `270`（再战一轮 / 趁没醉先撤）vs `278`（先溜 / 等某人一起溜）：`SHOTS` 里 `再战 / 先撤`
 *   与 `走 / 留` 字符串不同，且**跨档的两张根本不会被同档断言放在一起比**；但两者是**同一个「今晚走还是留」轴**。
 * 结论（编排者裁决）：`SHOTS` 一类自证表**只能当审计辅助，不能当约束①的达成证据**。
 *
 * ## 本模块的做法（从「字符串唯一」升级为「语义签名唯一」）
 * 给每张卡算一个**三元语义签名** `{ referent, answerSpace, axis }`：
 * - `referent`（**答案指向谁**）：`person`（题面要求说出一个人）／`self`（问自己的偏好、倾向、反应）。
 * - `answerSpace`（**答案空间/粒度**）：由卡上**既有** planning 字段 `expectedAnswerShape`
 *   机械映射（binary / ternary / yes_no / one_word / short_phrase）。
 * - `axis`（**互动轴**）：由**题面 token 规则表**派生（`PACK1_SEMANTIC_AXIS_RULES`），
 *   不是逐卡手写标签 —— 因此**两张真正问同一件事的卡会被规则映射到同一个轴**，
 *   作者无法靠「给这张卡另编一个轴名」蒙混过关。
 *
 * **判重规则**（可执行断言）：**同一 `heatMin` 档内**，若两张卡的**三元签名完全相同** ⇒ 判**语义重复**。
 * 跨档但签名相同的对，登记为**邻接**（只报不判，供人工裁决 —— 因为 `270 vs 278` 这类是**跨档**撞轴）。
 *
 * ## 非空壳证据（`tests/unit/pack1-semantic-axes.test.ts`）
 * 1. **敏感性实测**：把**整改前的历史题面**喂进判据，必须判真重复 ——
 *    `274-old`（跟谁一队）vs `275-old`（跟谁玩一局狼人杀）→ 同签名；
 *    `270-A7`（再战 / 先撤）vs `278-A7`（先溜 / 等某人）→ 同签名。
 *    整改后的 `274/275-new`、`270-new/278` 必须**不再同签名**。
 * 2. **三维合取**：`axis` 相同时仍要 `referent` 与 `answerSpace` 也相同才判重复 ——
 *    所以 H3「跟谁」簇里 7 张（`273/274/275/276/279/280/281` ＋ `278`）虽然都问「跟谁」，
 *    但动作轴不同（同行·走／组队／单挑／透气／要微信／点歌／喝完这杯／走留），不会被一刀切误杀。
 * 3. **`axis` 是**规则派生**、不是**逐卡手写**：`PACK1_SEMANTIC_AXIS_RULES` 是 (轴, token) 列表，
 *    单测断言**每张卡都能被规则命中**（无 `unclassified`），且轴值来自**闭集**。
 *
 * ## A9-R6（2026-09-29 内容裁决）
 * 退役 `236`（消解残留 `235 vs 236`）与 `263`（消解邻接 `263 vs 278`）后，本判据对现役批次
 * 实测**同档重复 0 对 / 跨档邻接 0 对**；故 `PACK1_SEMANTIC_RESIDUALS` 与
 * `PACK1_SEMANTIC_ADJACENCY_REGISTRY` 均为空表（判据结果必须与登记表逐项相等）。
 *
 * ## A9-R7（2026-09-29 内容返工）
 * 退役 `249`（`holiday_day` 轴唯一使用者）＋ `262` 换轴（`emotion_trigger` 轴唯一使用者）
 * ⇒ 两条轴随卡删除；`241` 由「被人夸」改为**亲密距离偏好** ⇒ 新增 `intimacy_distance` 轴
 * （`compliment_point` 轴改由 262 承载）；`266` 换三选项后 `todo_small` 轴 token 补 `抽空做`。
 * 现役批次（48 张）实测仍为**同档重复 0 对 / 跨档邻接 0 对**。
 *
 * ## 边界的诚实声明（**这是必要条件，不是充分证明**）
 * 规则派生仍是**词面/词法近似**：它能抓住「同对象 + 同答案空间 + 同动作轴」的**结构性重复**，
 * 但抓不住纯语义换词（例：把「跟谁一队」改写成「你想拉谁入伙」而 token 表没覆盖）。
 * 因此 `SHOTS`（动作帧）**保留为审计辅助**，与 `AXES` 一起只做「提醒审计员逐张看」，
 * **两者都不得再单独充当约束①的达成证据**（见 `pack1-supplement-matrix.ts` 文件头与单测注释）。
 * 边缘样本由人工裁决；模块顶层导出 `PACK1_SEMANTIC_PREREQUISITE_NOTE` 供报告引用。
 */

import { type GoldenTruthCard } from "../golden12/golden-12-cards";
import { PACK1_UNION_CARDS } from "../pack1-supplements/pack1-supplement-matrix";

/** 语义签名三元组的维度枚举（闭集；新增取值须有对应 token 规则）。 */
export type SemanticReferent = "person" | "self";

/** 答案空间：直接取卡上既有 `expectedAnswerShape`（不做第二份手写映射）。 */
export type SemanticAnswerSpace = "binary" | "ternary" | "yes_no" | "one_word" | "short_phrase";

/** 互动轴（闭集）。轴是本模块的**语义分类**，由 token 规则派生，**不是卡字段、不进 Runtime**。 */
export type SemanticAxis =
  | "newcomer_intro"
  | "drunk_state"
  | "arrival_source"
  | "invite_next_round"
  | "social_initiative"
  | "newcomer_tolerance"
  | "energy_release"
  | "relationship_status"
  | "todo_small"
  | "first_look"
  | "talk_amount"
  | "similar_vs_contrast"
  | "heartbeat_speed"
  | "scene_openness"
  | "heartbeat_vs_calm"
  | "table_friction"
  | "opener_flaw"
  | "reply_rhythm"
  | "leave_or_stay"
  | "joke_limit"
  | "remaining_time"
  | "drink_style"
  | "venue_taste"
  | "continue_chat"
  | "flirt_style"
  | "role_play"
  | "gaze_response"
  | "contact_willingness"
  | "sit_beside"
  | "first_notice_person"
  | "contact_response"
  | "whisper"
  | "opener_strategy"
  | "rival_present"
  | "group_play"
  | "duel"
  | "private_air"
  | "contact_on_spot"
  | "point_song"
  | "finish_drink"
  | "compliment_point"
  | "body_notice"
  | "hug_or_hand"
  | "intimacy_bonus"
  | "touch_part"
  | "intimacy_initiative"
  | "intimacy_distance";

/** 轴值闭集（单测据此断言无 `unclassified`、无表外值）。 */
export const PACK1_SEMANTIC_AXIS_IDS: readonly SemanticAxis[] = [
  "newcomer_intro", "drunk_state", "arrival_source", "invite_next_round", "social_initiative",
  "newcomer_tolerance", "energy_release", "relationship_status",
  "todo_small", "first_look", "talk_amount", "similar_vs_contrast", "heartbeat_speed",
  "scene_openness", "heartbeat_vs_calm", "table_friction", "opener_flaw", "reply_rhythm",
  "leave_or_stay", "joke_limit", "remaining_time", "drink_style", "venue_taste",
  "continue_chat", "flirt_style", "role_play", "gaze_response",
  "contact_willingness", "sit_beside", "first_notice_person", "contact_response", "whisper",
  "opener_strategy", "rival_present", "group_play", "duel", "private_air",
  "contact_on_spot", "point_song", "finish_drink", "compliment_point", "body_notice",
  "hug_or_hand", "intimacy_bonus", "touch_part", "intimacy_initiative", "intimacy_distance",
];

/**
 * 轴派生规则（**有序**，首个命中的 token 决定轴）。
 * ⛔ 规则必须表达**语义族**（同一件事的多种说法落同一轴），不得为某张单卡单开规则凑唯一。
 */
export const PACK1_SEMANTIC_AXIS_RULES: ReadonlyArray<readonly [SemanticAxis, readonly string[]]> = [
  ["newcomer_intro", ["认识新人"]],
  ["drunk_state", ["微醺"]],
  ["arrival_source", ["自己来的", "被人拉来"]],
  ["invite_next_round", ["下一场"]],
  ["social_initiative", ["先开口"]],
  ["newcomer_tolerance", ["查户口", "爱答不理"]],
  // A9-R7：原 `holiday_day`（在放假）轴随 249 退役删去（唯一使用者）。
  ["energy_release", ["攒"]],
  ["relationship_status", ["单身", "有主"]],
  // A9-R7：原 `emotion_trigger`（弄哭 / 突然安静）轴随 262 换轴删去（唯一使用者）。
  ["todo_small", ["还没做", "抽空做"]],
  // 「第一眼先注意到的是谁」是**点名对象**，先于通用「第一眼」类。
  ["first_notice_person", ["第一眼先注意"]],
  ["first_look", ["穿着", "气质", "谈吐", "打扮"]],
  ["talk_amount", ["话多"]],
  ["similar_vs_contrast", ["像你的", "完全不一样"]],
  ["heartbeat_speed", ["越聊越有", "看一眼就来"]],
  ["scene_openness", ["放得开"]],
  ["heartbeat_vs_calm", ["心跳", "安心"]],
  ["table_friction", ["不能惹"]],
  ["opener_flaw", ["搭讪"]],
  ["reply_rhythm", ["发消息", "多久回"]],
  ["joke_limit", ["开玩笑", "翻车"]],
  ["remaining_time", ["剩下的时间"]],
  ["drink_style", ["干杯", "喝软的"]],
  ["finish_drink", ["把这杯喝完", "喝完"]],
  ["venue_taste", ["换个地方"]],
  ["continue_chat", ["接着聊", "原本就在聊"]],
  // A9-R6：原 `go_home_way`（回程方式）轴随 277 退役删去（唯一使用者）。
  ["flirt_style", ["撒娇", "嘴硬"]],
  ["role_play", ["逗别人", "被别人逗"]],
  ["gaze_response", ["回看"]],
  ["contact_willingness", ["主动要联系方式"]],
  ["sit_beside", ["坐你旁边"]],
  ["contact_response", ["要加你微信"]],
  ["whisper", ["凑近"]],
  ["opener_strategy", ["搭话"]],
  ["rival_present", ["跟别人聊"]],
  // 组队/团体游戏（一局桌游＝一次组队）与 1v1 竞技单挑是**不同**的社交结构。
  ["duel", ["比一局", "单挑"]],
  ["group_play", ["一队", "玩一局", "狼人杀"]],
  ["private_air", ["透口气"]],
  ["contact_on_spot", ["当场要过来", "当场要加"]],
  ["point_song", ["点给谁听"]],
  ["compliment_point", ["被人夸"]],
  ["body_notice", ["异性的哪里"]],
  ["hug_or_hand", ["拥抱", "牵手"]],
  ["intimacy_bonus", ["最加分"]],
  ["touch_part", ["碰你哪一下"]],
  ["intimacy_initiative", ["更想当主动"]],
  // A9-R7：241 由「被人夸」自夸向改为**亲密距离偏好**（越靠越近 / 越坐越远）⇒ 新增本轴；
  // 同批「被人夸」轴（`compliment_point`）改由 262 承载（262 换轴到「被夸的偏好」）。
  ["intimacy_distance", ["越靠越近", "越坐越远"]],
  // 去留/离场族**刻意不细分**：`270-A7`（再战 / 先撤）、`278-A7`（先溜 / 等某人一起溜）、
  // `273`（散了跟谁走）都落这里；它们靠 `referent`/`answerSpace` 或（`273` 的）同轴不同答案空间区分
  // —— 而 `270-A7` vs `278-A7` 签名完全相同 ⇒ 必须判重复。
  // A9-R6：原落本轴的 `263`（留下聊完还是先走）已退役，故现无在册卡纯靠本轴。
  ["leave_or_stay", ["先走", "留下来", "先溜", "先撤", "散了"]],
];

/**
 * 题面「点名一个人」的 token（决定 `referent=person`）。
 * 口径＝**答案槽本身是一个真人身份**，不是「句子里出现了人」：
 * - 计入：`跟谁 / 拉谁 / 点给谁 / 哪个微信 / 谁一队 / 谁最不能惹 / 第一眼先注意到的是谁 / 凑近谁 / 那位`；
 * - **不计**：`等某个人`（`278` 是「自己先溜 vs 等某人」的**二选一决策**，答案不是人名），
 *   `哪个`（`282` 的「更扛不住哪个」答案是风格不是人）。
 */
export const PACK1_SEMANTIC_PERSON_TOKENS: readonly string[] = [
  "跟谁", "拉谁", "点给谁", "哪个微信", "谁一队", "谁最不能惹",
  "注意到的是谁", "凑近谁", "那位",
];

/** 判据定位的诚实声明（报告引用，防止把「必要条件」当「充分证明」）。 */
export const PACK1_SEMANTIC_PREREQUISITE_NOTE =
  "本判据是「同档同（提问对象＋答案空间＋互动轴）」的**必要条件**筛选，非语义不同的充分证明；" +
  "它抓结构性重复，抓不住纯换词改写。边缘样本由人工裁决；SHOTS/AXES 只作审计辅助。";

/** 单卡语义签名。 */
export interface Pack1SemanticSignature {
  readonly cardId: string;
  readonly heatMin: number;
  readonly referent: SemanticReferent;
  readonly answerSpace: SemanticAnswerSpace;
  readonly axis: SemanticAxis | "unclassified";
  readonly text: string;
}

/** 由题面 token 规则派生互动轴；无命中返回 `unclassified`（单测断言本批为 0）。 */
export function deriveSemanticAxis(text: string): SemanticAxis | "unclassified" {
  for (const [axis, tokens] of PACK1_SEMANTIC_AXIS_RULES) {
    if (tokens.some((token) => text.includes(token))) return axis;
  }
  return "unclassified";
}

/** 由题面 token 判定答案是否**指向一个真人**。 */
export function deriveSemanticReferent(text: string): SemanticReferent {
  return PACK1_SEMANTIC_PERSON_TOKENS.some((token) => text.includes(token)) ? "person" : "self";
}

/** 由卡上既有 `expectedAnswerShape` 机械映射答案空间（不做第二份手写映射）。 */
export function deriveSemanticAnswerSpace(card: GoldenTruthCard): SemanticAnswerSpace {
  return card.expectedAnswerShape;
}

/** 逐卡派生语义签名（升序，与卡源同序）。 */
export function deriveSemanticSignature(card: GoldenTruthCard, text: string = card.text): Pack1SemanticSignature {
  return {
    cardId: card.cardId,
    heatMin: card.heatMin,
    referent: deriveSemanticReferent(text),
    answerSpace: deriveSemanticAnswerSpace(card),
    axis: deriveSemanticAxis(text),
    text,
  };
}

/** 全批次（Golden 12 ＋ REWRITE ＋ REPLACE ＋ 补卡，A9-R6 退役 236/263/277 后现 49 张）的语义签名。 */
export const PACK1_SEMANTIC_SIGNATURES: readonly Pack1SemanticSignature[] = PACK1_UNION_CARDS.map((card) =>
  deriveSemanticSignature(card),
);

/** 签名三元组的字符串键（便于分组/对账）。 */
export function semanticSignatureKey(sig: Pack1SemanticSignature): string {
  return `${sig.referent}|${sig.answerSpace}|${sig.axis}`;
}

/**
 * 同档语义重复的**残留登记**（只允许**冻结批**内的既存对；⛔ 不得登记本单/新批次）。
 *
 * A9-R6（2026-09-29 内容裁决）：原唯一残留 `235 vs 236`（`self|binary|first_look`）随 `236`
 * 退役而消解 ⇒ 当前**残留为空**（`pack1SemanticDuplicatePairs()` 实测 0 对）。判据结果必须与本表
 * **逐项相等**（见单测），因此「多一对」或「少一对」都会红。
 */
export interface Pack1SemanticResidual {
  readonly a: string;
  readonly b: string;
  readonly heatMin: number;
  readonly signature: string;
  readonly batch: "golden12";
  readonly verdict: "pre_existing_mild_overlap" | "pre_existing_false_positive";
  readonly note: string;
}

export const PACK1_SEMANTIC_RESIDUALS: readonly Pack1SemanticResidual[] = [];

/**
 * 跨档邻接登记（**只报不判**，供人工裁决）：签名完全相同但不同档。
 *
 * A9-R6（2026-09-29 内容裁决）：原唯一邻接 `263 vs 278`（同为「散场走还是留」的自我决策）
 * 随 `263` 退役而消解 ⇒ 当前**邻接为空**（`pack1SemanticAdjacentPairs()` 实测 0 对）。
 */
export const PACK1_SEMANTIC_ADJACENCY_REGISTRY: ReadonlyArray<readonly [string, string]> = [];

export interface SemanticDuplicatePair {
  readonly a: string;
  readonly b: string;
  readonly heatMin: number;
  readonly signature: string;
}

/**
 * **同档语义重复对**（约束①的可执行判据）：
 * 同一 `heatMin` 档内，两张卡三元签名完全相同 ⇒ 判重复。
 * 跨档不计（见 `pack1SemanticAdjacentPairs`）。
 */
export function pack1SemanticDuplicatePairs(
  signatures: readonly Pack1SemanticSignature[] = PACK1_SEMANTIC_SIGNATURES,
): SemanticDuplicatePair[] {
  const byTier = new Map<string, Pack1SemanticSignature[]>();
  for (const sig of signatures) {
    const key = `${sig.heatMin}:${semanticSignatureKey(sig)}`;
    (byTier.get(key) ?? byTier.set(key, []).get(key)!).push(sig);
  }
  const pairs: SemanticDuplicatePair[] = [];
  for (const group of byTier.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        pairs.push({
          a: group[i]!.cardId,
          b: group[j]!.cardId,
          heatMin: group[i]!.heatMin,
          signature: semanticSignatureKey(group[i]!),
        });
      }
    }
  }
  return pairs.sort((x, y) => (x.a === y.a ? x.b.localeCompare(y.b) : x.a.localeCompare(y.a)));
}

/**
 * **跨档邻接对**：签名完全相同、但 `heatMin` 档不同的对。
 * 这类对**不判重复**（不同档可同轴），但必须登记 —— `270 vs 278` 正是这种「跨档撞轴」。
 */
export function pack1SemanticAdjacentPairs(
  signatures: readonly Pack1SemanticSignature[] = PACK1_SEMANTIC_SIGNATURES,
): SemanticDuplicatePair[] {
  const bySig = new Map<string, Pack1SemanticSignature[]>();
  for (const sig of signatures) {
    const key = semanticSignatureKey(sig);
    (bySig.get(key) ?? bySig.set(key, []).get(key)!).push(sig);
  }
  const pairs: SemanticDuplicatePair[] = [];
  for (const group of bySig.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        if (group[i]!.heatMin === group[j]!.heatMin) continue; // 同档已在 duplicate 里
        pairs.push({
          a: group[i]!.cardId,
          b: group[j]!.cardId,
          heatMin: Math.min(group[i]!.heatMin, group[j]!.heatMin),
          signature: semanticSignatureKey(group[i]!),
        });
      }
    }
  }
  return pairs.sort((x, y) => (x.a === y.a ? x.b.localeCompare(y.b) : x.a.localeCompare(y.a)));
}

/**
 * 非空壳**敏感性探针**：把整改前的历史题面喂进判据，必须判出真重复。
 * （文本逐字取第三轮主审报告引用的 pre-fix 原句；仅作回归夹具，不参与任何产物。）
 */
export const PACK1_SEMANTIC_HISTORICAL_DUPLICATE_PROBES: ReadonlyArray<{
  readonly label: string;
  readonly aId: string;
  readonly bId: string;
  readonly aText: string;
  readonly bText: string;
  readonly shape: SemanticAnswerSpace;
  readonly heatMin: number;
}> = [
  {
    // 第三轮 §3.2-A：一局桌游＝一次组队、答案必然同一个人（字符串不同即被旧 SHOTS 放行）。
    label: "274-old(跟谁一队) vs 275-old(跟谁玩一局狼人杀)",
    aId: "PN-TRUTH-274-PRE",
    bId: "PN-TRUTH-275-PRE",
    aText: "要是分两组玩，你想跟谁一队？",
    bText: "下一轮你最想跟谁玩一局狼人杀？",
    shape: "short_phrase",
    heatMin: 3,
  },
  {
    // 第三轮 §3.2-E：同一个「今晚走还是留」轴（跨档，旧同档断言看不见）。
    label: "270-A7(再战/先撤) vs 278-A7(先溜/等某人一起溜)",
    aId: "PN-TRUTH-270-PRE",
    bId: "PN-TRUTH-278-PRE",
    aText: "今晚你更想再战一轮，还是趁没醉先撤？",
    bText: "最后一圈，你想先溜的是自己，还是等某个人一起溜？",
    shape: "binary",
    heatMin: 2,
  },
];

/** 用固定 `answerSpace`/`heatMin` 构造探针签名（题面走真实派生，仅补上 shape/tier）。 */
export function probeSignatures(
  probe: (typeof PACK1_SEMANTIC_HISTORICAL_DUPLICATE_PROBES)[number],
): [Pack1SemanticSignature, Pack1SemanticSignature] {
  const make = (cardId: string, text: string): Pack1SemanticSignature => ({
    cardId,
    heatMin: probe.heatMin,
    referent: deriveSemanticReferent(text),
    answerSpace: probe.shape,
    axis: deriveSemanticAxis(text),
    text,
  });
  return [make(probe.aId, probe.aText), make(probe.bId, probe.bText)];
}
