/**
 * Phase A.1 / A.2｜跨 Reviewer 交叉校准统计
 * 对比三方：原 reviewer（按玩法各审 50）vs 盲审 r1 vs 盲审 r2，全部在 70 题校准样本上。
 *
 * A.2 口径收口：
 *  - 每轴同时报 **raw agreement**（逐轴完全一致率）与 **一致性系数 κ**；
 *  - 有序轴（infoGain / socialEnergy / relationshipProgression，另含 promotesUnderstanding）
 *    用 **线性权重 weighted κ**（w_ij = |i-j|/(K-1)）；
 *  - 分类轴（semanticType / topic）用 **Cohen's κ**；
 *  - 「六轴全一致率」降级为参考项（不再是 Gate 主指标）；
 *  - 5 vs 23 两个**不同定义**的集合分列：
 *      autoHighDisagreement = 自动判据筛出的高分歧题（infoGain 极差≥2 或 semanticType/socialEnergy 三方全不同）
 *      adjudicationSet      = 实际进入仲裁的题（含人工另挑样本），数量取自 _calib/adjudication.jsonl 行数
 *    两者不是同一统计的两个值，禁止互相校验。
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
/* 一致性系数（有序轴线性权重 κ / 分类轴 Cohen κ）唯一实现，见 scripts/audit-a1-kappa.ts。 */
import { agreementCoefficient, axisKind, COEFFICIENT_SPEC } from "./audit-a1-kappa";

const ROOT = process.cwd();
const DIR = `${ROOT}/docs/qa/content-audit`;

interface Judgement { cardId: string; gameType: string; text: string; semanticType: string; topic: string; infoGain: string; promotesUnderstanding: string; socialEnergy: string; relationshipProgression: string; learned?: string; }
const load = (p: string): Map<string, Judgement> => {
  const m = new Map<string, Judgement>();
  for (const line of readFileSync(p, "utf8").split("\n").filter(Boolean)) {
    const r = JSON.parse(line) as Judgement;
    m.set(r.cardId, r);
  }
  return m;
};

const sample = load(`${DIR}/_calib/blind-input.jsonl`);
const orig = load(`${DIR}/_calib/original.jsonl`);
const r1 = load(`${DIR}/_calib/r1.jsonl`);
const r2 = load(`${DIR}/_calib/r2.jsonl`);

const GAIN_RANK: Record<string, number> = { "高": 3, "中": 2, "低": 1, "0": 0 };
const AXES = ["semanticType", "topic", "infoGain", "promotesUnderstanding", "socialEnergy", "relationshipProgression"] as const;

interface Row { cardId: string; gameType: string; text: string; o: Judgement; a: Judgement; b: Judgement; }
const rows: Row[] = [];
for (const [cardId, s] of sample) {
  const o = orig.get(cardId); const a = r1.get(cardId); const b = r2.get(cardId);
  if (!o || !a || !b) { console.log(`跳过（缺判定）：${cardId} orig=${!!o} r1=${!!a} r2=${!!b}`); continue; }
  rows.push({ cardId, gameType: s.gameType, text: s.text, o, a, b });
}

const pct = (n: number, d: number) => (d === 0 ? "0.0%" : `${((n / d) * 100).toFixed(1)}%`);

/* ------------------------------------------------------------------ */
/* 一致性系数：有序轴线性权重 κ / 分类轴 Cohen κ                          */
/* 实现已抽到 scripts/audit-a1-kappa.ts（本文件与 drift-stable 共用同一份） */
/* ------------------------------------------------------------------ */

/* 三方两两一致 */
function pairStats(x: Judgement, y: Judgement) {
  const out: Record<string, boolean> = {} as Record<string, boolean>;
  for (const ax of AXES) out[ax] = x[ax] === y[ax];
  return out;
}
const pairs: { name: string; x: (r: Row) => Judgement; y: (r: Row) => Judgement }[] = [
  { name: "orig↔r1", x: (r) => r.o, y: (r) => r.a },
  { name: "orig↔r2", x: (r) => r.o, y: (r) => r.b },
  { name: "r1↔r2", x: (r) => r.a, y: (r) => r.b },
];

const pairResults = pairs.map((p) => {
  const perAxis: Record<string, { agree: number; total: number }> = {};
  for (const ax of AXES) perAxis[ax] = { agree: 0, total: 0 };
  const axisPairs: Record<string, [string, string][]> = {};
  for (const ax of AXES) axisPairs[ax] = [];
  let gainGap2Plus = 0;
  let allSixAgree = 0;
  for (const r of rows) {
    const x = p.x(r);
    const y = p.y(r);
    const s = pairStats(x, y);
    for (const ax of AXES) {
      perAxis[ax]!.total += 1;
      if (s[ax]) perAxis[ax]!.agree += 1;
      axisPairs[ax]!.push([x[ax], y[ax]]);
    }
    if (Object.values(s).every(Boolean)) allSixAgree += 1;
    const gap = Math.abs(GAIN_RANK[x.infoGain]! - GAIN_RANK[y.infoGain]!);
    if (gap >= 2) gainGap2Plus += 1;
  }
  const perAxisCoefficient = Object.fromEntries(
    AXES.map((ax) => {
      const c = agreementCoefficient(ax, axisPairs[ax]!);
      return [ax, {
        kind: axisKind(ax),
        metric: axisKind(ax) === "ordered" ? "linear weighted kappa" : "cohen kappa",
        value: c.value,
        po: c.po,
        pe: c.pe,
        n: c.n,
      }];
    }),
  );
  return {
    pair: p.name,
    n: rows.length,
    allSixAgree,
    allSixAgreeRate: pct(allSixAgree, rows.length),
    allSixAgreeNote: "参考项（不再是 Gate 主指标）；口径敏感，不得当作标签准确率",
    perAxisRate: Object.fromEntries(AXES.map((ax) => [ax, { agree: perAxis[ax]!.agree, total: perAxis[ax]!.total, rate: pct(perAxis[ax]!.agree, perAxis[ax]!.total) }])),
    perAxisCoefficient,
    infoGainGap2Plus: gainGap2Plus,
    infoGainGap2PlusRate: pct(gainGap2Plus, rows.length),
  };
});

/* 三方多数票（majority of 3）作为准绳 */
function majority<T extends string>(vals: T[]): T {
  const m = new Map<T, number>();
  for (const v of vals) m.set(v, (m.get(v) ?? 0) + 1);
  let best = vals[0]!; let bestN = 0;
  for (const [k, n] of m) if (n > bestN) { best = k; bestN = n; }
  return best;
}
const maj = rows.map((r) => ({
  cardId: r.cardId, gameType: r.gameType,
  semanticType: majority([r.o.semanticType, r.a.semanticType, r.b.semanticType]),
  topic: majority([r.o.topic, r.a.topic, r.b.topic]),
  infoGain: majority([r.o.infoGain, r.a.infoGain, r.b.infoGain]),
  socialEnergy: majority([r.o.socialEnergy, r.a.socialEnergy, r.b.socialEnergy]),
  relationshipProgression: majority([r.o.relationshipProgression, r.a.relationshipProgression, r.b.relationshipProgression]),
}));

/* 每个 reviewer 与多数票的偏差 → 系统性偏松/偏紧 */
const SOCIAL_RANK = (v: string) => (v === "高" ? 2 : v === "中" ? 1 : 0);
const PROG_RANK = SOCIAL_RANK;
const lean: Record<string, Record<string, number>> = {};
for (const [name, get] of [["orig", (r: Row) => r.o], ["r1", (r: Row) => r.a], ["r2", (r: Row) => r.b]] as const) {
  const d: Record<string, number> = { gainUp: 0, gainDown: 0, gainSame: 0, socialUp: 0, socialDown: 0, progUp: 0, progDown: 0 };
  rows.forEach((r, i) => {
    const g = get(r);
    const m = maj[i]!;
    const dr = GAIN_RANK[g.infoGain]! - GAIN_RANK[m.infoGain]!;
    if (dr > 0) d.gainUp += 1; else if (dr < 0) d.gainDown += 1; else d.gainSame += 1;
    const ds = SOCIAL_RANK(g.socialEnergy) - SOCIAL_RANK(m.socialEnergy);
    if (ds > 0) d.socialUp += 1; else if (ds < 0) d.socialDown += 1;
    const dp = PROG_RANK(g.relationshipProgression) - PROG_RANK(m.relationshipProgression);
    if (dp > 0) d.progUp += 1; else if (dp < 0) d.progDown += 1;
  });
  lean[name] = d;
}

/* 玩法维度漂移 */
const byType: Record<string, { n: number; semanticAgree: number; gainAgree: number; gainGap2: number; gainRanks: Record<string, number> }> = {};
for (const [i, r] of rows.entries()) {
  const t = byType[r.gameType] ?? (byType[r.gameType] = { n: 0, semanticAgree: 0, gainAgree: 0, gainGap2: 0, gainRanks: {} });
  t.n += 1;
  const agree = [r.o, r.a, r.b];
  if (agree.every((g) => g.semanticType === maj[i]!.semanticType)) t.semanticAgree += 1;
  if (agree.every((g) => g.infoGain === maj[i]!.infoGain)) t.gainAgree += 1;
  if (GAIN_RANK[r.o.infoGain]! - GAIN_RANK[maj[i]!.infoGain]! !== 0) t.gainGap2 += 1;
  for (const g of agree) t.gainRanks[g.infoGain] = (t.gainRanks[g.infoGain] ?? 0) + 1;
}
const drift = Object.entries(byType).map(([gameType, s]) => ({
  gameType, n: s.n,
  semanticConsensusRate: pct(s.semanticAgree, s.n),
  gainConsensusRate: pct(s.gainAgree, s.n),
  origGainDeviations: s.gainGap2,
  origDeviationRate: pct(s.gainGap2, s.n),
  gainSpread: s.gainRanks,
})).sort((a, b) => Number(a.origDeviationRate.replace("%", "")) - Number(b.origDeviationRate.replace("%", "")));

/* 高分歧样本（供 adjudication）：三方任一轴全不同，或 infoGain 极差 >= 2 */
const highDisagreement = rows.map((r) => {
  const spread = Math.max(...[r.o, r.a, r.b].map((g) => GAIN_RANK[g.infoGain]!)) - Math.min(...[r.o, r.a, r.b].map((g) => GAIN_RANK[g.infoGain]!));
  const semAllDiff = new Set([r.o.semanticType, r.a.semanticType, r.b.semanticType]).size === 3;
  const socAllDiff = new Set([r.o.socialEnergy, r.a.socialEnergy, r.b.socialEnergy]).size === 3;
  const reasons: string[] = [];
  if (spread >= 2) reasons.push(`infoGain 极差 ${spread} 档`);
  if (semAllDiff) reasons.push("semanticType 三方全不同");
  if (socAllDiff) reasons.push("socialEnergy 三方全不同");
  return { cardId: r.cardId, gameType: r.gameType, text: r.text, spread, reasons, o: r.o, a: r.a, b: r.b };
}).filter((x) => x.reasons.length > 0).sort((a, b) => b.spread - a.spread);

writeFileSync(`${DIR}/_calib/adjudication-input.jsonl`, highDisagreement.map((h) => JSON.stringify({ cardId: h.cardId, gameType: h.gameType, text: h.text, reasons: h.reasons })).join("\n") + "\n");

/* ------------------------------------------------------------------ */
/* A.2｜5 与 23 是两个不同定义的集合，分列、不互相校验                       */
/* ------------------------------------------------------------------ */
/** autoHighDisagreement：自动判据（infoGain 极差≥2 / semanticType 或 socialEnergy 三方全不同）筛出。 */
const autoHighDisagreement = highDisagreement.map((h) => h.cardId);
/** adjudicationSet：实际进入仲裁的题（人工在自动集之外另挑样本），取自磁盘真源行数。 */
const adjPath = `${DIR}/_calib/adjudication.jsonl`;
const adjudicationSet = existsSync(adjPath)
  ? readFileSync(adjPath, "utf8").split("\n").filter((l) => l.trim().length > 0).map((l) => JSON.parse(l) as { cardId: string; finalInfoGain: string })
  : [];
const adjudicationGainDist: Record<string, number> = {};
for (const a of adjudicationSet) adjudicationGainDist[a.finalInfoGain] = (adjudicationGainDist[a.finalInfoGain] ?? 0) + 1;
const overlapCount = autoHighDisagreement.filter((id) => adjudicationSet.some((a) => a.cardId === id)).length;

const out = {
  sampleSize: rows.length,
  coefficientSpec: COEFFICIENT_SPEC,
  pairResults,
  lean,
  drift,
  disagreementSets: {
    autoHighDisagreement: {
      count: autoHighDisagreement.length,
      definition: "自动判据筛出：infoGain 极差≥2 档，或 semanticType 三方全不同，或 socialEnergy 三方全不同",
      cardIds: autoHighDisagreement,
    },
    adjudicationSet: {
      count: adjudicationSet.length,
      definition: "实际进入仲裁的题（_calib/adjudication.jsonl 行数；含人工在自动集之外另挑的样本）",
      cardIds: adjudicationSet.map((a) => a.cardId),
    },
    overlapCount,
    note: "两个集合定义不同（自动规则 vs 实际仲裁样本），不是同一统计的两个值，禁止互相校验或暗示二者矛盾。",
  },
  adjudicationGainDist,
  /* 兼容字段：highDisagreementCount == autoHighDisagreement.count（历史名保留，勿再暗示与 adjudicationSet 矛盾）。 */
  highDisagreementCount: autoHighDisagreement.length,
  autoHighDisagreementCount: autoHighDisagreement.length,
  adjudicationSetSize: adjudicationSet.length,
  highDisagreement: highDisagreement.map((h) => ({ cardId: h.cardId, gameType: h.gameType, reasons: h.reasons, o: { semanticType: h.o.semanticType, infoGain: h.o.infoGain, socialEnergy: h.o.socialEnergy, relationshipProgression: h.o.relationshipProgression }, a: { semanticType: h.a.semanticType, infoGain: h.a.infoGain, socialEnergy: h.a.socialEnergy, relationshipProgression: h.a.relationshipProgression }, b: { semanticType: h.b.semanticType, infoGain: h.b.infoGain, socialEnergy: h.b.socialEnergy, relationshipProgression: h.b.relationshipProgression } })),
};
writeFileSync(`${DIR}/CALIBRATION-STATS.json`, JSON.stringify(out, null, 2));

console.log(`校准样本 ${rows.length} 题`);
for (const p of pairResults) console.log(`  ${p.pair}: 六轴全一致 ${p.allSixAgree}/${p.n} (${p.allSixAgreeRate}，参考项)｜infoGain 极差≥2档 ${p.infoGainGap2Plus} (${p.infoGainGap2PlusRate})`);
console.log("\n各轴 raw agreement + κ（orig↔r1）:");
for (const ax of AXES) {
  const r = pairResults[0]!.perAxisRate[ax]!;
  const c = pairResults[0]!.perAxisCoefficient[ax]!;
  console.log(`  ${ax.padEnd(24)} raw ${r.rate}  ${c.metric} ${c.value}`);
}
console.log("\n系统性偏离（相对多数票）:", JSON.stringify(lean));
console.log("\n玩法漂移（原 reviewer 偏离多数票率，升序=最稳）:");
for (const d of drift) console.log(`  ${d.gameType.padEnd(14)} n=${d.n} semantic一致 ${d.semanticConsensusRate} gain一致 ${d.gainConsensusRate} 原偏离率 ${d.origDeviationRate}`);
console.log(`\n高分歧样本 autoHighDisagreement ${autoHighDisagreement.length} 题（自动判据）；adjudicationSet ${adjudicationSet.length} 题（实际仲裁，含人工另挑）；两集重叠 ${overlapCount} 题`);

