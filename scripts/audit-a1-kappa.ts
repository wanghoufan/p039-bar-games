/**
 * Phase A.2｜一致性系数共用模块（唯一实现，禁止再写第二套）
 *
 * 口径（与 Phase A.2 收口一致）：
 *  - 有序轴（infoGain / promotesUnderstanding / socialEnergy / relationshipProgression）
 *    用 **线性权重 weighted κ**，w_ij = |i−j|/(K−1)；
 *  - 分类轴（semanticType / topic）用 **Cohen's κ**；
 *  - 「六轴全一致率」不在本模块内，它已在报告里降级为参考项。
 *
 * 本文件只做**纯计算**，不读盘、不写盘、无副作用。
 * audit-a1-calibration.ts（70 题三方校准）与 audit-a1-drift-stable.ts（玩法漂移/复审标签）
 * 都从这里 import，确保两处口径绝不漂移。
 */

/** 有序轴清单（决定用线性权重 κ 还是 Cohen κ）。 */
export const ORDERED_AXES = ["infoGain", "promotesUnderstanding", "socialEnergy", "relationshipProgression"] as const;

/** 有序轴的口径顺序（决定线性权重与相邻距离；枚举顺序，不是统计数字）。 */
export const ORDERED_RANK: Record<string, Record<string, number>> = {
  infoGain: { "0": 0, "低": 1, "中": 2, "高": 3 },
  promotesUnderstanding: { "否": 0, "弱": 1, "是": 2 },
  socialEnergy: { "低": 0, "中": 1, "高": 2 },
  relationshipProgression: { "低": 0, "中": 1, "高": 2 },
};

export const axisKind = (ax: string): "ordered" | "categorical" =>
  (ORDERED_AXES as readonly string[]).includes(ax) ? "ordered" : "categorical";

export interface KappaResult { value: number; po: number; pe: number | null; n: number; }

/** 分类轴：Cohen's κ = (Po − Pe) / (1 − Pe)。分母为 0（两方全部同值）时记 1。 */
export function cohenKappa(pairs: [string, string][]): KappaResult {
  const n = pairs.length;
  if (n === 0) return { value: 0, po: 0, pe: null, n };
  const labels = [...new Set(pairs.flat())];
  const idx = new Map(labels.map((l, i) => [l, i]));
  const o = labels.map(() => labels.map(() => 0));
  for (const [a, b] of pairs) o[idx.get(a)!]![idx.get(b)!]! += 1;
  let diag = 0;
  for (let i = 0; i < labels.length; i += 1) diag += o[i]![i]!;
  const po = diag / n;
  const rowSum = o.map((r) => r.reduce((s, v) => s + v, 0));
  const colSum = labels.map((_, j) => o.reduce((s, r) => s + r[j]!, 0));
  let pe = 0;
  for (let i = 0; i < labels.length; i += 1) pe += rowSum[i]! * colSum[i]!;
  pe /= n * n;
  const value = pe >= 1 ? 1 : (po - pe) / (1 - pe);
  return { value: +value.toFixed(4), po: +po.toFixed(4), pe: +pe.toFixed(4), n };
}

/** 有序轴：线性权重 weighted κ，w_ij = |i−j|/(K−1)；κ_w = 1 − Σw·O / Σw·E。 */
export function linearWeightedKappa(pairs: [string, string][], order: string[]): KappaResult {
  const n = pairs.length;
  const K = order.length;
  if (n === 0 || K <= 1) return { value: 0, po: 0, pe: null, n };
  const idx = new Map(order.map((l, i) => [l, i]));
  const o = order.map(() => order.map(() => 0));
  for (const [a, b] of pairs) {
    const ia = idx.get(a);
    const ib = idx.get(b);
    if (ia === undefined || ib === undefined) continue; // 未在口径顺序内的枚举值不参与（防御）
    o[ia]![ib]! += 1;
  }
  const rowSum = o.map((r) => r.reduce((s, v) => s + v, 0));
  const colSum = order.map((_, j) => o.reduce((s, r) => s + r[j]!, 0));
  const w = (i: number, j: number) => Math.abs(i - j) / (K - 1);
  let oW = 0;
  let eW = 0;
  let diag = 0;
  for (let i = 0; i < K; i += 1) {
    for (let j = 0; j < K; j += 1) {
      oW += w(i, j) * o[i]![j]!;
      eW += w(i, j) * ((rowSum[i]! * colSum[j]!) / n);
    }
    diag += o[i]![i]!;
  }
  const po = diag / n;
  const value = eW === 0 ? 1 : 1 - oW / eW;
  return { value: +value.toFixed(4), po: +po.toFixed(4), pe: null, n };
}

/** 某条 pair 在某轴上的 κ（按轴类型自动选公式）。有序轴把 rank 表转成按序标签数组。 */
export function agreementCoefficient(ax: string, pairs: [string, string][]): KappaResult {
  if (axisKind(ax) === "ordered") {
    const order = Object.entries(ORDERED_RANK[ax] ?? {}).sort((a, b) => a[1] - b[1]).map(([label]) => label);
    return linearWeightedKappa(pairs, order);
  }
  return cohenKappa(pairs);
}

export const COEFFICIENT_SPEC = {
  orderedAxes: [...ORDERED_AXES],
  orderedMetric: "linear weighted kappa",
  orderedFormula: "κ_w = 1 − Σ_ij w_ij·O_ij / Σ_ij w_ij·E_ij，w_ij = |i−j|/(K−1)（K=该轴类别数）",
  orderedRanks: ORDERED_RANK,
  categoricalAxes: ["semanticType", "topic"],
  categoricalMetric: "Cohen's kappa",
  categoricalFormula: "κ = (Po − Pe)/(1 − Pe)",
};
