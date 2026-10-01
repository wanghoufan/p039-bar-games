/**
 * Phase A.2｜玩法漂移度量 + 复审标签（只读输入 → 机械产出）
 *
 * 输入（只读）：
 *   docs/qa/content-audit/_reviews-a1/{dare,either_or,chemistry}.jsonl      原 reviewer（A.1）
 *   docs/qa/content-audit/_recheck/BLIND-{dare,either_or,chemistry}.jsonl   盲审（未见任何已有标签，各 50）
 *   docs/qa/content-audit/_calib/r1.jsonl / r2.jsonl                        另两名盲审（仅 70 题校准样本，含各玩法 10 题）
 *   docs/qa/content-audit/CALIBRATION-STATS.json                            A.1 漂移实测值（门槛对照用）
 *   docs/qa/content-audit/_stable/arbitration.jsonl                         第三方独立仲裁（由 opencode 产出）
 *
 * 产出：
 *   docs/qa/content-audit/_stable/arbitration-input.jsonl   无多数票的样本（本脚本生成）
 *   docs/qa/content-audit/STABLE-LABELS.json                复审标签 + 逐轴 κ + never_have_i 门槛判定
 *
 * 硬性纪律：
 *  - 一致性系数**复用** scripts/audit-a1-kappa.ts（与 audit-a1-calibration.ts 同一份实现，禁止第二套）；
 *  - 复审标签 = 各**独立来源**按轴取多数票（严格多数：票数 > 来源数/2）；无多数 → 交第三方仲裁；
 *  - 仲裁样本不得携带任何既有标签（本脚本只把 cardId/text 给仲裁者）；
 *  - 所有数字由脚本机械计算，不手写；
 *  - 门槛值必须显式声明（见 GATE 常量），不得事后挑。
 *
 * 用法：
 *   npx tsx scripts/audit-a1-drift-stable.ts              （默认）算 κ + 写仲裁输入 + 汇总复审标签
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { agreementCoefficient, axisKind, COEFFICIENT_SPEC } from "./audit-a1-kappa";

const ROOT = process.cwd();
const DIR = `${ROOT}/docs/qa/content-audit`;
const STABLE = `${DIR}/_stable`;

const REVIEWED_TYPES = ["dare", "either_or", "chemistry"] as const;
const SINGLE_SOURCE_TYPES = ["truth", "most_likely", "never_have_i", "pointing"] as const;
/** 可稳定化的轴（orig 与 BLIND 都有、且可两两比较）。promotesUnderstanding / verdict 盲审未判 → 不参与。 */
const AXES = ["infoGain", "semanticType", "topic", "socialEnergy", "relationshipProgression"] as const;
const TYPE_CN: Record<string, string> = {
  truth: "真心话", dare: "大冒险", most_likely: "谁最可能", never_have_i: "我从来没有",
  either_or: "二选一", pointing: "指人游戏", chemistry: "默契测试",
};

/* ---- 门槛（显式声明，先定后判，不得事后挑） -------------------------------
 * κ 门槛：κ < 0.40 判「明显不足」（Landis & Koch：<0.40 为 fair/poor），该轴只可用于候选排序。
 * never_have_i 复审门槛（用 A.1 实测漂移值做前置筛查，因该玩法尚无盲审样本、无法直接算 κ）：
 *   达标 =（原 reviewer 偏离多数票率 < 30%）且（infoGain 三方共识率 ≥ 70%）
 *   任一不达标 → 派盲审做全量 50 题复审；两条都达标 → 未达升级门槛，不复审。
 */
const GATE = {
  kappaMinForDecision: 0.4,
  kappaSource: "Landis & Koch 区间：<0.40 为 fair/poor，0.41–0.60 为 moderate",
  neverHaveIRedeviationRateMax: 0.3,
  neverHaveIGainConsensusRateMin: 0.7,
  note: "门槛在跑数前固定；never_have_i 无盲审样本，只能用 A.1 实测值做前置筛查。",
};

interface Judgement {
  cardId: string; gameType?: string; text?: string; semanticType: string; topic: string;
  infoGain: string; socialEnergy: string; relationshipProgression: string;
}
const readJsonl = <T>(p: string): T[] =>
  readFileSync(p, "utf8").split("\n").filter((l) => l.trim().length > 0).map((l) => JSON.parse(l) as T);
const load = (p: string): Map<string, Judgement> => {
  const m = new Map<string, Judgement>();
  for (const line of readFileSync(p, "utf8").split("\n").filter(Boolean)) {
    const r = JSON.parse(line) as Judgement;
    m.set(r.cardId, r);
  }
  return m;
};

const orig: Record<string, Map<string, Judgement>> = {};
const blind: Record<string, Map<string, Judgement>> = {};
for (const g of REVIEWED_TYPES) {
  orig[g] = load(`${DIR}/_reviews-a1/${g}.jsonl`);
  blind[g] = load(`${DIR}/_recheck/BLIND-${g}.jsonl`);
}
const calibR1 = load(`${DIR}/_calib/r1.jsonl`);
const calibR2 = load(`${DIR}/_calib/r2.jsonl`);
/* 题面真源（给仲裁者，只带 cardId/text，不带任何标签）：来自 _recheck/{g}.jsonl 盲审输入。 */
const textOf = new Map<string, string>();
for (const g of REVIEWED_TYPES) {
  for (const line of readFileSync(`${DIR}/_recheck/${g}.jsonl`, "utf8").split("\n").filter(Boolean)) {
    const r = JSON.parse(line) as { cardId: string; text: string };
    textOf.set(r.cardId, r.text);
  }
}

/* ------------------------------------------------------------------ */
/* 1. orig ↔ BLIND：逐轴 raw agreement + κ（复用共享实现）                 */
/* ------------------------------------------------------------------ */
const pct = (n: number, d: number) => (d === 0 ? "0.0%" : `${((n / d) * 100).toFixed(1)}%`);
interface AxisStat { axis: string; kind: string; metric: string; agree: number; total: number; rawAgreement: string; kappa: number; po: number; n: number; }
interface DriftResult {
  gameType: string; label: string; n: number;
  axes: AxisStat[];
  weakAxes: string[];
  meanKappa: number;
  allAxesAgree: number;
  allAxesAgreeRate: string;
}
const drift: DriftResult[] = REVIEWED_TYPES.map((g) => {
  const o = orig[g]!; const b = blind[g]!;
  const ids = [...o.keys()].filter((id) => b.has(id));
  const axes: AxisStat[] = AXES.map((ax) => {
    const pairs: [string, string][] = ids.map((id) => [o.get(id)![ax as keyof Judgement] as string, b.get(id)![ax as keyof Judgement] as string]);
    const agree = pairs.filter(([x, y]) => x === y).length;
    const c = agreementCoefficient(ax, pairs);
    return {
      axis: ax, kind: axisKind(ax),
      metric: axisKind(ax) === "ordered" ? "linear weighted kappa" : "cohen kappa",
      agree, total: pairs.length, rawAgreement: pct(agree, pairs.length),
      kappa: c.value, po: c.po, n: c.n,
    };
  });
  const allAxesAgree = ids.filter((id) => AXES.every((ax) => o.get(id)![ax as keyof Judgement] === b.get(id)![ax as keyof Judgement])).length;
  const weakAxes = axes.filter((a) => a.kappa < GATE.kappaMinForDecision).map((a) => a.axis);
  return {
    gameType: g, label: TYPE_CN[g]!, n: ids.length, axes,
    weakAxes,
    meanKappa: +(axes.reduce((s, a) => s + a.kappa, 0) / axes.length).toFixed(4),
    allAxesAgree, allAxesAgreeRate: pct(allAxesAgree, ids.length),
  };
});

/* ------------------------------------------------------------------ */
/* 2. 复审标签：各来源按轴多数票，无多数取仲裁                               */
/* ------------------------------------------------------------------ */
interface ArbOut { cardId: string; infoGain: string; semanticType: string; topic: string; socialEnergy: string; relationshipProgression: string; reason?: string; }
const ARB_PATH = `${STABLE}/arbitration.jsonl`;
const arbitration: ArbOut[] = existsSync(ARB_PATH) ? readJsonl<ArbOut>(ARB_PATH) : [];
const arbById = new Map(arbitration.map((a) => [a.cardId, a]));

interface ReviewedCard {
  cardId: string; gameType: string; sources: number; sourceNames: string[];
  values: Record<string, string>;              // 复审标签
  majority: Record<string, boolean>;           // 该轴是否由多数票决定
  arbitratedAxes: string[];
  pendingAxes: string[];
}
const reviewedCards: ReviewedCard[] = [];
const arbInput: { cardId: string; gameType: string; text: string; axes: string[]; question: string }[] = [];
for (const g of REVIEWED_TYPES) {
  const o = orig[g]!; const b = blind[g]!;
  for (const id of [...o.keys()].sort()) {
    const sources: { name: string; j: Judgement }[] = [
      { name: "orig", j: o.get(id)! },
      { name: "blind", j: b.get(id)! },
    ];
    if (calibR1.has(id)) sources.push({ name: "r1", j: calibR1.get(id)! });
    if (calibR2.has(id)) sources.push({ name: "r2", j: calibR2.get(id)! });
    const values: Record<string, string> = {};
    const majority: Record<string, boolean> = {};
    const arbitratedAxes: string[] = [];
    const pendingAxes: string[] = [];
    for (const ax of AXES) {
      const tally = new Map<string, number>();
      for (const s of sources) {
        const v = s.j[ax as keyof Judgement] as string;
        tally.set(v, (tally.get(v) ?? 0) + 1);
      }
      const [topVal, topN] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]!;
      if (topN * 2 > sources.length) {
        values[ax] = topVal; majority[ax] = true;
      } else {
        majority[ax] = false;
        const arb = arbById.get(id);
        if (arb) { values[ax] = arb[ax as keyof ArbOut] as string; arbitratedAxes.push(ax); }
        else { values[ax] = topVal; pendingAxes.push(ax); }
      }
    }
    reviewedCards.push({
      cardId: id, gameType: g, sources: sources.length, sourceNames: sources.map((s) => s.name),
      values, majority, arbitratedAxes, pendingAxes,
    });
  }
}
/* 「至少一轴无多数票」= 需要第三方仲裁的卡（整卡送，5 轴一次判完；仲裁者看不到任何既有标签）。
   该清单**可复现**：不论是否已有仲裁结果，写出的都是同一批需要仲裁的卡。 */
for (const c of reviewedCards) {
  const needs = AXES.filter((ax) => !c.majority[ax]);
  if (needs.length === 0) continue;
  arbInput.push({
    cardId: c.cardId,
    gameType: c.gameType,
    text: textOf.get(c.cardId) ?? "（题面缺失）",
    axes: [...needs],
    question: "请按题面独立判定下列轴（不参考任何既有标签）",
  });
}
writeFileSync(`${STABLE}/arbitration-input.jsonl`, arbInput.map((a) => JSON.stringify(a)).join("\n") + "\n");
const arbInputIds = new Set(arbInput.map((a) => a.cardId));
const pendingArb = [...arbInputIds].filter((id) => !arbById.has(id)).sort();

/* ------------------------------------------------------------------ */
/* 3. never_have_i 是否需全量复审（显式门槛对照 A.1 实测值）                 */
/* ------------------------------------------------------------------ */
const calib = JSON.parse(readFileSync(`${DIR}/CALIBRATION-STATS.json`, "utf8")) as {
  drift: { gameType: string; n: number; gainConsensusRate: string; origDeviationRate: string; semanticConsensusRate: string; origGainDeviations: number }[];
};
const a1Drift = new Map(calib.drift.map((d) => [d.gameType, d]));
const gateRows = [...REVIEWED_TYPES, "never_have_i"].map((g) => {
  const d = a1Drift.get(g);
  if (!d) throw new Error(`CALIBRATION-STATS.json 缺玩法漂移：${g}`);
  const devRate = Number(d.origDeviationRate.replace("%", "")) / 100;
  const gainRate = Number(d.gainConsensusRate.replace("%", "")) / 100;
  const passDev = devRate < GATE.neverHaveIRedeviationRateMax;
  const passGain = gainRate >= GATE.neverHaveIGainConsensusRateMin;
  return {
    gameType: g, label: TYPE_CN[g]!,
    a1OrigDeviationRate: d.origDeviationRate, a1GainConsensusRate: d.gainConsensusRate,
    a1SemanticConsensusRate: d.semanticConsensusRate, a1SampleSize: d.n,
    passDeviationGate: passDev, passGainGate: passGain, pass: passDev && passGain,
  };
});
const nhi = gateRows.find((r) => r.gameType === "never_have_i")!;
const neverHaveIDecision = {
  gameType: "never_have_i",
  needsFullReaudit: !nhi.pass,
  verdict: nhi.pass
    ? "未达升级门槛，不复审：A.1 实测值同时满足两条门槛（原 reviewer 偏离率 < 30% 且 infoGain 共识率 ≥ 70%）"
    : "达到升级门槛，应派盲审做全量 50 题复审",
  basis: nhi,
  thresholds: {
    origDeviationRateMax: GATE.neverHaveIRedeviationRateMax,
    gainConsensusRateMin: GATE.neverHaveIGainConsensusRateMin,
  },
};

/* ------------------------------------------------------------------ */
/* 4. 产出 STABLE-LABELS.json                                            */
/* ------------------------------------------------------------------ */
const byTypeReviewed = REVIEWED_TYPES.map((g) => {
  const cards = reviewedCards.filter((c) => c.gameType === g);
  return {
    gameType: g, label: TYPE_CN[g]!, cardCount: cards.length,
    // 值语义已降级：只表示「已完成双源复审与分歧仲裁」，不等于轴已可靠（见 labelStatusNote）。
    labelStatus: "REVIEWED_ADJUDICATED" as const,
    arbitratedCards: cards.filter((c) => c.arbitratedAxes.length > 0).length,
    pendingCards: cards.filter((c) => c.pendingAxes.length > 0).length,
    weakAxes: drift.find((d) => d.gameType === g)!.weakAxes,
  };
});
const weakAxisSummary = AXES.map((ax) => {
  const per = drift.map((d) => ({ gameType: d.gameType, kappa: d.axes.find((a) => a.axis === ax)!.kappa }));
  return {
    axis: ax,
    perGameType: per,
    worstKappa: Math.min(...per.map((p) => p.kappa)),
    usableForDecision: per.every((p) => p.kappa >= GATE.kappaMinForDecision),
  };
});

const out = {
  generator: "scripts/audit-a1-drift-stable.ts",
  date: "2026-09-27",
  coefficientSpec: COEFFICIENT_SPEC,
  gates: GATE,
  axesReviewed: [...AXES],
  axesNotReviewed: ["promotesUnderstanding", "verdict", "duplicateCluster"],
  axesNotReviewedReason: "盲审 BLIND-*.jsonl 未判这些字段，无第二个独立来源可交叉，故不做稳定化；仍为 A.1 单源。",
  sourceFiles: {
    orig: "_reviews-a1/{dare,either_or,chemistry}.jsonl（各 50）",
    blind: "_recheck/BLIND-{dare,either_or,chemistry}.jsonl（各 50，未见任何已有标签）",
    calibrationBlind: "_calib/r1.jsonl, _calib/r2.jsonl（仅 70 题校准样本，含每玩法 10 题）",
    arbitration: existsSync(ARB_PATH) ? "_stable/arbitration.jsonl（第三方独立仲裁）" : null,
  },
  sourceNote: "全部题 50 张为双源（orig + BLIND）；校准样本内的 10 张/玩法另有 r1、r2 两个盲审来源，共 4 源。复审标签按各卡**实际可用来源数**取严格多数票。",
  drift,
  weakAxisSummary,
  arbitration: {
    inputCount: arbInput.length,
    pendingCount: pendingArb.length,
    resolvedCount: arbitration.length,
    note: "凡某轴无严格多数票，即抽入 _stable/arbitration-input.jsonl 交第三方独立仲裁；仲裁者只看题面，不看 orig/BLIND/r1/r2 任何结论。",
  },
  reviewedLabelScope: {
    reviewed: byTypeReviewed,
    singleSource: SINGLE_SOURCE_TYPES.map((g) => ({ gameType: g, label: TYPE_CN[g]!, reliability: "A.1 单源、可靠性较低" })),
    statement: "dare / either_or / chemistry 的标签——已完成双源复审与分歧仲裁，可用于主题/候选定位；低可靠轴不得作为单题自动保留/删除依据。truth / most_likely / never_have_i / pointing 仍为「A.1 单源、可靠性较低」。",
  },
  neverHaveIDecision,
  /**
   * 标签状态的**统一口径**（A.2 收口降级）：不再出现会被读成「轴已可靠」的旧措辞（含「稳定」类字样）。
   * 低可靠轴（κ<0.4）只能用于候选排序 / 主题定位，不得作为单题自动保留/删除依据。
   */
  labelStatusNote:
    "dare / either_or / chemistry：已完成双源复审与分歧仲裁，可用于主题/候选定位；低可靠轴不得作为单题自动保留/删除依据。",
  usageLimit: `若某轴 κ 仍明显不足（κ < ${GATE.kappaMinForDecision}），该轴**只能用于候选排序，不得自动决定保留/删除**。当前不达标的轴见 weakAxisSummary（usableForDecision=false 的行）。`,
  reviewedCards,
};
writeFileSync(`${DIR}/STABLE-LABELS.json`, JSON.stringify(out, null, 2));

console.log(`漂移度量 + 复审标签｜玩法 ${REVIEWED_TYPES.length} 个 × ${[...REVIEWED_TYPES].reduce((s, g) => s + orig[g]!.size, 0)} 张`);
for (const d of drift) {
  const axs = d.axes.map((a) => `${a.axis}:raw ${a.rawAgreement}/κ ${a.kappa}`).join("  ");
  console.log(`\n  ${d.label}(${d.gameType}) n=${d.n} 全轴一致 ${d.allAxesAgreeRate} 均值κ ${d.meanKappa}`);
  for (const a of d.axes) console.log(`    ${a.axis.padEnd(26)} raw ${a.rawAgreement.padStart(6)}  ${a.metric} ${a.kappa}${a.kappa < GATE.kappaMinForDecision ? "  ⚠<0.40" : ""}`);
  void axs;
}
console.log(`\n待仲裁 ${arbInput.length} 张（无多数票）→ _stable/arbitration-input.jsonl；已仲裁 ${arbitration.length} 张，未回 ${pendingArb.length} 张`);
console.log(`never_have_i：${neverHaveIDecision.verdict}`);
console.log(`  依据：偏离率 ${nhi.a1OrigDeviationRate}（门槛 <${GATE.neverHaveIRedeviationRateMax * 100}%）｜共识率 ${nhi.a1GainConsensusRate}（门槛 ≥${GATE.neverHaveIGainConsensusRateMin * 100}%）`);
if (pendingArb.length > 0) {
  console.log(`\n[PENDING] 仍有 ${pendingArb.length} 张仲裁样本未回：${pendingArb.slice(0, 20).join("、")}`);
}
