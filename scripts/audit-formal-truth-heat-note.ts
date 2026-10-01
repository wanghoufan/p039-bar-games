/**
 * C1-8 / R0-2｜「Heat 逐档可达性」说明文字（note）的**纯派生器**。
 *
 * 背景：`FORMAL-TRUTH-PRODUCTION-CHAIN.json` 原先在 scenarioFormalOnly 里硬编码了一句
 * 「Heat 逐档 H1→H2→H3→H4，逐档首次到达计数 = min+1（4/8/13）」——那是 A3「诚实重标 Heat」
 * 之前的口径残留。实测数据是：只走 3 轮、finalEffective=3、finalHeat=H1、
 * `firstReachRoundByHeat = { H1:1, H2:null, H3:null, H4:null }`。
 * 数据说「根本没到 H2」，note 却说「逐档到 H4」⇒ 同一份 JSON 自相矛盾。
 *
 * 本模块把 note 变成**运行结果的函数**：档位是否到达、未到达的原因与缺口数，全部由传入的
 * `rounds` / `finalHeat` / `finalEffective` / 阈值 / 牌堆可计数库存现算，**不接受任何写死的结论**。
 *
 * 纯函数、无副作用、不 import 任何业务运行时（除类型）：产物落盘脚本与单测共用同一份实现，
 * 单测因此可以用「已到达某档」的受控 fixture 构造反例，验证 note 不会漏报/谎报档位。
 *
 * ⚠️ 本模块只**描述**结果，不参与判定：阈值来源仍是 `v2-state` 的 `HEAT_THRESHOLDS`，
 * Heat 硬过滤 / `isEffectiveInformationRound` fail-closed 一个字不改。
 */

/** 阈值档（与 `v2-state.HEAT_THRESHOLDS` 结构兼容，只读不做拷贝）。 */
export interface HeatBand {
  readonly heat: string;
  readonly min: number;
  readonly max: number;
}

/** 单轮观测（只读关心的三个字段；其余字段不影响本派生）。 */
export interface HeatReachRound {
  readonly heat: string;
  readonly effectiveCount?: number;
}

/**
 * 「卡侧可形成有效信息轮」的卡：`informationGain` 非 null 且非 zero/low、`topic` 非 null
 * （即 `isEffectiveInformationRound` 的卡侧前置条件），并带上它的 Heat 合法区间。
 */
export interface CountableCard {
  readonly cardId: string;
  readonly heatMin: number;
  readonly heatMax: number;
}

export interface HeatReachNoteInput {
  /** 情形的可读标签（写进 note 开头，仅用于人读）。 */
  readonly label: string;
  /** 逐轮观测序列（按轮次升序）。 */
  readonly rounds: readonly HeatReachRound[];
  readonly finalHeat: string;
  readonly finalEffective: number;
  /** Heat 阈值真源（一般传 `HEAT_THRESHOLDS`）。 */
  readonly thresholds: readonly HeatBand[];
  /** 牌堆内可计数卡；缺省 = 无法判定库存（note 会如实写「未知」）。 */
  readonly countableCards?: readonly CountableCard[];
}

/** 「冷启门」：第一个未到达的档，及其缺口。 */
export interface HeatBootstrapGate {
  readonly band: string;
  readonly prevBand: string;
  /** 进入该档所需的有效信息轮门槛（`thresholds[band].min`）。 */
  readonly threshold: number;
  /** 该档以下（含）全部 Heat 档里可计数的卡数——冷启能累积的有效轮上限。 */
  readonly availableBelow: number;
  /** 结构性缺口 = 门槛 − 可计数库存（>0 表示冷启就走不到）。 */
  readonly shortfall: number;
}

export interface HeatReachNote {
  /** 由输入现算的说明文字。 */
  readonly note: string;
  /** 实际到达的档（按阈值顺序）。 */
  readonly reachedBands: readonly string[];
  /** 实际未到达的档（按阈值顺序）。 */
  readonly unreachedBands: readonly string[];
  /** 逐档首达轮次（1 基；未到达为 null）。与 note 同源，不可能互相矛盾。 */
  readonly firstReachRoundByHeat: Readonly<Record<string, number | null>>;
  /** 第一个未到达档的冷启门；全部到达时为 null。 */
  readonly bootstrapGate: HeatBootstrapGate | null;
}

const bandRank = (order: readonly string[], heat: string): number => order.indexOf(heat) + 1;

const reasonForGate = (input: HeatReachNoteInput, order: readonly string[], gateIndex: number,
  availableBelow: number, threshold: number, observedEffective: number): string => {
  const band = order[gateIndex]!;
  const prevBand = order[gateIndex - 1]!;
  if (availableBelow === 0) {
    return `${band} —— 牌堆内可计数卡 0 张（无 §7.2 metadata ⇒ isEffectiveInformationRound fail-closed 恒不计有效轮）`;
  }
  if (threshold - availableBelow > 0) {
    const shortfall = threshold - availableBelow;
    return `${band} —— 冷启门库存不足：${prevBand} 及以下档可计数卡 ${availableBelow} 张 < ${band} 门槛 ${threshold}`
      + `（缺口 ${shortfall} 张）⇒ 即便把这些卡全部抽满，最多也只累积有效轮 ${availableBelow}，结构上到不了 ${band}`
      + `（更高档的卡因 Heat 未升档被硬过滤，牌堆因此提前耗尽）；本次实测累计有效轮 ${observedEffective}／共 ${input.rounds.length} 轮`;
  }
  return `${band} —— 非「库存不足」：${prevBand} 及以下档可计数卡 ${availableBelow} 张 ≥ ${band} 门槛 ${threshold}，`
    + `但本次仅累计有效轮 ${observedEffective}（共 ${input.rounds.length} 轮）`
    + `⇒ 未达门槛来自牌堆耗尽／intensity 过滤／软去重／抽卡排序，而非冷启库存`;
};

/**
 * 由实际运行结果派生「Heat 逐档可达性」note。
 *
 * 规则（全部由数据推出，无写死结论）：
 * - 到达的档 = `rounds` 里出现过的档（记首达轮次）；未到达的档 = 其余；
 * - 第一个未到达的档 → 算「冷启门」：该档以下可计数卡数 vs 该档门槛，给出缺口数；
 *   - 库存为 0 → 如实说「无可计数卡」；
 *   - 库存 < 门槛 → 「库存不足」+ 缺口数；
 *   - 库存 ≥ 门槛但实测没到 → 明确写「非库存不足」，并把可观测的其它原因列出来；
 * - 更上游的未到达档 → 如实说是「受上游门所限」。
 */
export function deriveHeatReachNote(input: HeatReachNoteInput): HeatReachNote {
  const order = input.thresholds.map((band) => band.heat);

  const firstReachRoundByHeat: Record<string, number | null> = {};
  for (const heat of order) {
    const index = input.rounds.findIndex((round) => round.heat === heat);
    firstReachRoundByHeat[heat] = index === -1 ? null : index + 1;
  }

  const reachedBands = order.filter((heat) => firstReachRoundByHeat[heat] !== null);
  const unreachedBands = order.filter((heat) => firstReachRoundByHeat[heat] === null);

  const observedEffective = input.rounds.reduce(
    (max, round) => Math.max(max, round.effectiveCount ?? 0),
    0,
  );
  const effectiveForNote = Math.max(input.finalEffective, observedEffective);

  const firstUnreachedIndex = order.findIndex((heat) => firstReachRoundByHeat[heat] === null);

  let bootstrapGate: HeatBootstrapGate | null = null;
  const reasons: string[] = [];
  if (firstUnreachedIndex !== -1) {
    const gateBand = order[firstUnreachedIndex]!;
    const threshold = input.thresholds[firstUnreachedIndex]!.min;
    if (firstUnreachedIndex === 0 || !input.countableCards) {
      // 连最低档都没到：要么牌堆一张都没出，要么调用方没给库存事实。
      reasons.push(
        firstUnreachedIndex === 0
          ? `${gateBand} —— 开局档未解锁（无更低档可累积有效轮，共观测 ${input.rounds.length} 轮）`
          : `${gateBand} —— 库存未知（未提供 countableCards，无法判定冷启缺口）`,
      );
    } else {
      const prevBand = order[firstUnreachedIndex - 1]!;
      const prevRank = bandRank(order, prevBand);
      const availableBelow = input.countableCards.filter((card) => card.heatMin <= prevRank).length;
      bootstrapGate = {
        band: gateBand,
        prevBand,
        threshold,
        availableBelow,
        shortfall: threshold - availableBelow,
      };
      reasons.push(reasonForGate(input, order, firstUnreachedIndex, availableBelow, threshold, effectiveForNote));
    }
    for (let i = firstUnreachedIndex + 1; i < order.length; i += 1) {
      reasons.push(`${order[i]} —— 受上游 ${gateBand} 门所限（${gateBand} 未解锁 ⇒ 恒不可达）`);
    }
  }

  const reachedText = reachedBands.length === 0
    ? "无"
    : reachedBands.map((heat) => `${heat}（首达第 ${firstReachRoundByHeat[heat]} 轮）`).join("、");
  const unreachedText = unreachedBands.length === 0 ? "无" : unreachedBands.join("、");

  const head = `${input.label}：实际到达的档：${reachedText}；未到达的档：${unreachedText}。`
    + `最终 Heat=${input.finalHeat}、有效信息轮=${input.finalEffective}。`;
  const tail = reasons.length === 0 ? "" : `未到达原因：${reasons.join("；")}。`;

  return {
    note: head + tail,
    reachedBands,
    unreachedBands,
    firstReachRoundByHeat,
    bootstrapGate,
  };
}
