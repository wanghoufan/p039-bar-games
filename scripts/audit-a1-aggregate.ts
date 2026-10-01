/**
 * Phase A.1｜聚合（只读）
 * 合并 metadata + A1 审查（12 字段），产出修正版 CONTENT-AUDIT-350 与全量统计。
 *
 * 相对 Phase A 的整改点：
 *  1. 排序口径分离：GAIN_WORST_FIRST 供「低信息榜」，GAIN_DESC 供分布展示（修 Phase A 排序 bug）。
 *  2. 重复簇口径：taggedGroupRate（被打簇标签）≠ actualDuplicateCandidateRate（同簇 >=2 张）。
 *  3. Heat 口径：不再把跨 Heat 卡强塞单一 Heat，改为「静态可用范围」多档统计。
 *  4. 三轴并列：infoGain / socialEnergy / relationshipProgression，verdict 三轴合看。
 *  5. 所有计数由数据生成，本文件不手写任何动态统计数字。
 */
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = process.cwd();
const DIR = `${ROOT}/docs/qa/content-audit`;
const TYPES = ["truth", "dare", "most_likely", "never_have_i", "either_or", "pointing", "chemistry"];

interface Meta {
  cardId: string; gameType: string; number: number; text: string; intensity: number;
  heatMin: number; heatMax: number; relationStage: string; targetMode: string;
  responseMode: string; interactionType: string; consentMode: string;
  matchRequired: boolean; boundaryTags: string[];
}
interface Rev {
  cardId: string; semanticType: string; topic: string; infoGain: string; learned: string;
  promotesUnderstanding: string; socialEnergy: string; relationshipProgression: string;
  duplicateCluster: string; verdict: string;
}

const meta = new Map<string, Meta>();
for (const t of TYPES) {
  for (const line of readFileSync(`${DIR}/_slices/${t}.jsonl`, "utf8").split("\n").filter(Boolean)) {
    const r = JSON.parse(line) as Meta;
    meta.set(r.cardId, r);
  }
}
const revById = new Map<string, Rev>();
for (const t of TYPES) {
  for (const line of readFileSync(`${DIR}/_reviews-a1/${t}.jsonl`, "utf8").split("\n").filter(Boolean)) {
    const r = JSON.parse(line) as Rev;
    revById.set(r.cardId, r);
  }
}

/* 口径常量（枚举顺序，不是统计数字） */
const GAIN_DESC = ["高", "中", "低", "0"];              // 展示用：高→低
const GAIN_WORST_FIRST = ["0", "低", "中", "高"];        // 「最差优先」榜用：修 Phase A bug
const SOCIAL_ORDER = ["高", "中", "低"];
const PROG_ORDER = ["高", "中", "低"];
const PERSON_TOPICS = ["兴趣爱好", "生活方式", "性格/习惯/小癖好", "择偶偏好/吸引力", "恋爱观", "亲密/性观念", "边界/吃醋/异性朋友/前任", "人生价值/未来"];

/* ------------------------------------------------------------------ */
/* A.2 收口｜处置口径（撤销「一轴高就自动保留」）                          */
/* 五分类**全部由三轴机械推导**，任何人不得手写；verdict 字段仅作向后兼容保留。 */
/* ------------------------------------------------------------------ */
const DISPOSITION_ORDER = ["PRIORITY_KEEP", "KEEP_CANDIDATE", "SOCIAL_BUFFER_POOL", "REWRITE_CANDIDATE", "DELETE_CANDIDATE"] as const;
type Disposition = (typeof DISPOSITION_ORDER)[number];
/** 判定规则原文（报告直接引用，改规则必须同时改这里，禁止只改一处）。 */
const DISPOSITION_RULES: { when: string; to: Disposition }[] = [
  { when: "infoGain=高", to: "PRIORITY_KEEP" },
  { when: "infoGain=中 且（社交能量 或 关系推进 ∈ {中,高}）", to: "KEEP_CANDIDATE" },
  { when: "infoGain∈{低,0} 且（社交能量=高 或 关系推进=高）", to: "SOCIAL_BUFFER_POOL" },
  { when: "infoGain∈{低,0} 且 社交能量=低 且 关系推进=低", to: "DELETE_CANDIDATE" },
  { when: "infoGain∈{低,0} 且两轴都∈{中,低}（非全低）", to: "REWRITE_CANDIDATE" },
  { when: "infoGain=中 但两轴都为低", to: "REWRITE_CANDIDATE" },
];
const isMidPlus = (v: string) => v === "中" || v === "高";
const isLowZero = (v: string) => v === "低" || v === "0";
/** 三轴 → 五分类。判定顺序即 DISPOSITION_RULES 的顺序（DELETE 必须早于 REWRITE）。 */
function dispositionOf(r: { infoGain: string; socialEnergy: string; relationshipProgression: string }): Disposition {
  const { infoGain: g, socialEnergy: s, relationshipProgression: p } = r;
  if (g === "高") return "PRIORITY_KEEP";
  if (g === "中") return (isMidPlus(s) || isMidPlus(p)) ? "KEEP_CANDIDATE" : "REWRITE_CANDIDATE";
  if (isLowZero(g)) {
    if (s === "低" && p === "低") return "DELETE_CANDIDATE";
    if (s === "高" || p === "高") return "SOCIAL_BUFFER_POOL";
    return "REWRITE_CANDIDATE";
  }
  throw new Error(`未知 infoGain 取值：${g}`);
}

const rows = [...meta.values()].map((m) => {
  const r = revById.get(m.cardId);
  if (!r) throw new Error(`缺审查结果：${m.cardId}`);
  return { ...m, ...r, disposition: dispositionOf(r) };
}).sort((a, b) => (a.cardId < b.cardId ? -1 : a.cardId > b.cardId ? 1 : 0));

const N = rows.length;
const COLS = [
  "cardId", "gameType", "number", "text", "intensity", "heatMin", "heatMax", "relationStage",
  "targetMode", "responseMode", "interactionType", "consentMode", "matchRequired", "boundaryTags",
  "semanticType", "topic", "infoGain", "learned", "promotesUnderstanding",
  "socialEnergy", "relationshipProgression", "duplicateCluster", "verdict", "disposition",
] as const;

writeFileSync(`${DIR}/CONTENT-AUDIT-350.jsonl`, rows.map((r) => JSON.stringify({ ...r, boundaryTags: r.boundaryTags.join("|") })).join("\n") + "\n");
const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
writeFileSync(`${DIR}/CONTENT-AUDIT-350.csv`,
  [COLS.join(",")].concat(rows.map((r) => COLS.map((c) => cell((r as Record<string, unknown>)[c])).join(","))).join("\n") + "\n");

/* ---------------- 统计（全部由数据生成） ---------------- */
const countBy = (key: (r: (typeof rows)[0]) => string, order?: string[]) => {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
  const entries = [...m.entries()];
  return order
    ? order.filter((k) => m.has(k)).map((k) => [k, m.get(k)!] as [string, number])
    : entries.sort((a, b) => b[1] - a[1]);
};

const gainDist = countBy((r) => r.infoGain, GAIN_DESC);
const semDist = countBy((r) => r.semanticType);
const topicDist = countBy((r) => r.topic);
const socialDist = countBy((r) => r.socialEnergy, SOCIAL_ORDER);
const progDist = countBy((r) => r.relationshipProgression, PROG_ORDER);
const verdictDist = countBy((r) => r.verdict);
const promoteDist = countBy((r) => r.promotesUnderstanding, ["是", "弱", "否"]);
/* A.2 收口｜新五分类处置分布（报告主口径），以及旧 verdict → 新分类的机械映射表。 */
const dispositionDist = countBy((r) => r.disposition, [...DISPOSITION_ORDER]);
const dispositionRatios = DISPOSITION_ORDER.map((k) => [k, +((dispositionDist.find((d) => d[0] === k)?.[1] ?? 0) / N).toFixed(4)] as [string, number]);
const verdictToDisposition: Record<string, Record<string, number>> = {};
for (const r of rows) {
  const bucket = verdictToDisposition[r.verdict] ?? (verdictToDisposition[r.verdict] = {});
  bucket[r.disposition] = (bucket[r.disposition] ?? 0) + 1;
}
const dispositionByType = TYPES.map((t) => {
  const sub = rows.filter((r) => r.gameType === t);
  return {
    gameType: t,
    count: sub.length,
    byDisposition: DISPOSITION_ORDER.map((k) => ({ disposition: k, count: sub.filter((r) => r.disposition === k).length })),
  };
});
/* A.2 收口｜SOCIAL_BUFFER_POOL 配额观测（本轮只给候选池与建议，不定最终题量）。 */
const bufferPoolRows = rows.filter((r) => r.disposition === "SOCIAL_BUFFER_POOL");
const skeletonRows = rows.filter((r) => r.disposition === "PRIORITY_KEEP" || r.disposition === "KEEP_CANDIDATE");
const lowZeroRows = rows.filter((r) => isLowZero(r.infoGain));
const skeletonN = skeletonRows.length;
const bufferN = bufferPoolRows.length;
const bufferQuota = {
  poolSize: bufferN,
  shareOfAllCards: +(bufferN / N).toFixed(4),
  lowZeroTotal: lowZeroRows.length,
  shareOfLowZero: +(bufferN / lowZeroRows.length).toFixed(4),
  skeletonN,
  /* 若把整池都当正式保留：buffer /（骨架+buffer），用于检验「热闹题不能重新占多数」。 */
  ifWholePoolKeptShareOfFormal: +(bufferN / (skeletonN + bufferN)).toFixed(4),
  /* 纯约束上限：buffer < 骨架（否则热闹题数量压过有增量的题）。 */
  maxWithoutMajority: skeletonN,
  /* 自选更严上限：buffer ≤ 骨架/2 ⟺ buffer/(骨架+buffer) ≤ 1/3（留安全边际）。 */
  recommendedCap: Math.floor(skeletonN / 2),
  recommendedCapRatioOfFormal: +(1 / 3).toFixed(4),
  recommendedCapShareOfPool: +(Math.floor(skeletonN / 2) / bufferN).toFixed(4),
};

/* 重复簇口径整改 */
const clusterSizes = new Map<string, number>();
for (const r of rows) if (r.duplicateCluster && r.duplicateCluster !== "-") clusterSizes.set(r.duplicateCluster, (clusterSizes.get(r.duplicateCluster) ?? 0) + 1);
const taggedCount = rows.filter((r) => r.duplicateCluster && r.duplicateCluster !== "-").length;
const actualDupCount = rows.filter((r) => r.duplicateCluster && r.duplicateCluster !== "-" && (clusterSizes.get(r.duplicateCluster) ?? 0) >= 2).length;
const singletonClusters = [...clusterSizes.entries()].filter(([, n]) => n === 1);
const multiClusters = [...clusterSizes.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]);

/* A.2｜簇结构特征（只用于导航，不算「重复率」）：
   - semanticClusterCoverage = 被打簇的卡占全库比（措辞必须是「覆盖」）；
   - clusterSizeBuckets = 按簇规模分桶（size=1 / 2 / 3-5 / 6-10 / >10），各给簇数与卡数。
   bucket 边界是分类阈值（常量），不是统计数字。 */
const CLUSTER_BUCKETS = [
  { label: "size=1", min: 1, max: 1 },
  { label: "size=2", min: 2, max: 2 },
  { label: "size=3-5", min: 3, max: 5 },
  { label: "size=6-10", min: 6, max: 10 },
  { label: "size=>10", min: 11, max: Number.POSITIVE_INFINITY },
];
const clusterSizeBuckets = CLUSTER_BUCKETS.map((b) => {
  const hit = [...clusterSizes.entries()].filter(([, n]) => n >= b.min && n <= b.max);
  return { label: b.label, clusters: hit.length, cards: hit.reduce((s, [, n]) => s + n, 0) };
});
const semanticClusterCoverage = +(taggedCount / N).toFixed(4);

/* Heat：静态可用范围（多档，不再强塞单一档） */
const HEATS = ["H1", "H2", "H3", "H4"];
const heatAvailability = HEATS.map((h, idx) => {
  const rank = idx + 1;
  const legal = rows.filter((r) => r.heatMin <= rank && r.heatMax >= rank);
  return {
    heat: h,
    legalCount: legal.length,
    legalRatio: +(legal.length / N).toFixed(4),
    byGain: GAIN_DESC.map((g) => ({ gain: g, count: legal.filter((r) => r.infoGain === g).length })),
    midPlus: legal.filter((r) => r.infoGain === "高" || r.infoGain === "中").length,
    personTopic: legal.filter((r) => PERSON_TOPICS.includes(r.topic)).length,
  };
});
const crossHeatCards = rows.filter((r) => r.heatMax > r.heatMin).length;
const exactHeatCards = rows.filter((r) => r.heatMax === r.heatMin).length;

/* 强度分布 */
const intensityDist = [1, 2, 3, 4, 5].map((i) => {
  const sub = rows.filter((r) => r.intensity === i);
  return {
    intensity: i,
    count: sub.length,
    byGain: GAIN_DESC.map((g) => ({ gain: g, count: sub.filter((r) => r.infoGain === g).length })),
    midPlus: sub.filter((r) => r.infoGain === "高" || r.infoGain === "中").length,
  };
});

/* 玩法分布 */
const TYPE_CN: Record<string, string> = { truth: "真心话", dare: "大冒险", most_likely: "谁最可能", never_have_i: "我从来没有", either_or: "二选一", pointing: "指人游戏", chemistry: "默契测试" };
const typeDist = TYPES.map((t) => {
  const sub = rows.filter((r) => r.gameType === t);
  return {
    gameType: t, label: TYPE_CN[t], count: sub.length,
    byGain: GAIN_DESC.map((g) => ({ gain: g, count: sub.filter((r) => r.infoGain === g).length })),
    midPlus: sub.filter((r) => r.infoGain === "高" || r.infoGain === "中").length,
    judge: sub.filter((r) => r.semanticType === "现场评价/猜测").length,
    noPersonInfo: sub.filter((r) => r.topic === "无明确人物信息增量").length,
    socialHigh: sub.filter((r) => r.socialEnergy === "高").length,
    progHigh: sub.filter((r) => r.relationshipProgression === "高").length,
    personTopic: sub.filter((r) => PERSON_TOPICS.includes(r.topic)).length,
    keep: sub.filter((r) => r.verdict === "保留").length,
    byDisposition: DISPOSITION_ORDER.map((k) => ({ disposition: k, count: sub.filter((r) => r.disposition === k).length })),
  };
});

/* 三轴交叉 */
const threeAxis = (() => {
  const m: Record<string, number> = {};
  for (const r of rows) {
    const key = `${r.infoGain} / 社交${r.socialEnergy} / 推进${r.relationshipProgression}`;
    m[key] = (m[key] ?? 0) + 1;
  }
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
})();

/* 低信息但高社交/高推进（说明「低信息≠必删」） */
const lowInfoButUseful = rows.filter((r) => (r.infoGain === "低" || r.infoGain === "0")
  && (r.socialEnergy === "高" || r.relationshipProgression === "高"));

/* 主题 × 玩法 */
const topicsAll = [...new Set(rows.map((r) => r.topic))].sort((a, b) => rows.filter((r) => r.topic === b).length - rows.filter((r) => r.topic === a).length);
const topicByType = topicsAll.map((tp) => ({
  topic: tp,
  total: rows.filter((r) => r.topic === tp).length,
  byType: TYPES.map((t) => ({ gameType: t, count: rows.filter((r) => r.topic === tp && r.gameType === t).length })),
}));

const stats = {
  N,
  gainDist, semDist, topicDist, socialDist, progDist, verdictDist, promoteDist,
  disposition: {
    order: [...DISPOSITION_ORDER],
    dist: dispositionDist,
    ratios: dispositionRatios,
    rules: DISPOSITION_RULES,
    note: "处置口径已收紧：不再「任意一轴为高即保留」。SOCIAL_BUFFER_POOL 是候选池，不等于正式保留。",
    verdictToDisposition,
    byType: dispositionByType,
    bufferQuota,
    /* 便于报告直接引用，避免散落硬编码。 */
    priorityKeepN: dispositionDist.find((d) => d[0] === "PRIORITY_KEEP")?.[1] ?? 0,
    keepCandidateN: dispositionDist.find((d) => d[0] === "KEEP_CANDIDATE")?.[1] ?? 0,
    socialBufferN: bufferN,
    rewriteN: dispositionDist.find((d) => d[0] === "REWRITE_CANDIDATE")?.[1] ?? 0,
    deleteN: dispositionDist.find((d) => d[0] === "DELETE_CANDIDATE")?.[1] ?? 0,
  },
  duplicate: {
    taggedCount, actualDupCount,
    taggedGroupRate: +(taggedCount / N).toFixed(4),
    actualDuplicateCandidateRate: +(actualDupCount / N).toFixed(4),
    semanticClusterCoverage, clusterSizeBuckets,
    clusterCount: clusterSizes.size, singletonClusters, multiClusters,
  },
  heatAvailability, crossHeatCards, exactHeatCards,
  intensityDist, typeDist, threeAxis,
  lowInfoButUseful: { count: lowInfoButUseful.length, sample: lowInfoButUseful.slice(0, 15) },
  socialBufferSample: {
    cardIds: bufferPoolRows.slice(0, 20).map((r) => r.cardId),
    byGameType: (() => {
      const m = new Map<string, number>();
      for (const r of bufferPoolRows) m.set(r.gameType, (m.get(r.gameType) ?? 0) + 1);
      return [...m.entries()];
    })(),
  },
  topicByType,
  derived: {
    highN: rows.filter((r) => r.infoGain === "高").length,
    midPlusN: rows.filter((r) => r.infoGain === "高" || r.infoGain === "中").length,
    lowZeroN: rows.filter((r) => r.infoGain === "低" || r.infoGain === "0").length,
    judgeN: rows.filter((r) => r.semanticType === "现场评价/猜测").length,
    personTopicN: rows.filter((r) => PERSON_TOPICS.includes(r.topic)).length,
    personTopicMidPlusN: rows.filter((r) => PERSON_TOPICS.includes(r.topic) && (r.infoGain === "高" || r.infoGain === "中")).length,
  },
};

writeFileSync(`${DIR}/AUDIT-STATS-A1.json`, JSON.stringify(stats, null, 2));

/* 排序榜（修 bug：最差优先） */
const rankLow = [...rows]
  .sort((a, b) => {
    const d = GAIN_WORST_FIRST.indexOf(a.infoGain) - GAIN_WORST_FIRST.indexOf(b.infoGain);
    if (d !== 0) return d;
    const sa = clusterSizes.get(a.duplicateCluster) ?? 0;
    const sb = clusterSizes.get(b.duplicateCluster) ?? 0;
    if (sa !== sb) return sb - sa;
    return a.cardId < b.cardId ? -1 : 1;
  })
  .slice(0, 20);
const rankHigh = rows.filter((r) => r.infoGain === "高" || r.infoGain === "中")
  .sort((a, b) => {
    const score = (r: (typeof rows)[0]) => (r.infoGain === "高" ? 2 : 1) + (r.relationshipProgression === "高" ? 1 : 0) + (r.socialEnergy === "高" ? 0.5 : 0);
    const d = score(b) - score(a);
    if (d !== 0) return d;
    return a.cardId < b.cardId ? -1 : 1;
  })
  .slice(0, 20);
writeFileSync(`${DIR}/_ranks.json`, JSON.stringify({ low: rankLow, high: rankHigh }, null, 2));

console.log("A1 聚合完成");
console.log("增量分布:", JSON.stringify(gainDist));
console.log("社交能量:", JSON.stringify(socialDist), "｜关系推进:", JSON.stringify(progDist));
console.log("旧处置（向后兼容字段 verdict）:", JSON.stringify(verdictDist));
console.log("新处置五分类（报告主口径）:", JSON.stringify(dispositionDist));
console.log("SOCIAL_BUFFER_POOL 配额观测:", JSON.stringify(bufferQuota));
console.log("簇结构口径: semanticClusterCoverage", taggedCount, `(${(taggedCount / N * 100).toFixed(1)}%)`, "｜同簇≥2 的卡", actualDupCount, `(${(actualDupCount / N * 100).toFixed(1)}%)`, "（簇只用于导航，不代表这些卡互为重复）");
console.log("Heat 跨档卡:", crossHeatCards, "｜单档卡:", exactHeatCards);
console.log("低信息但高社交/高推进:", lowInfoButUseful.length);
console.log("低信息榜前 3 增量:", rankLow.slice(0, 3).map((r) => r.infoGain).join(","), "（应为 0/低 开头）");
console.log("高信息榜前 3 增量:", rankHigh.slice(0, 3).map((r) => r.infoGain).join(","));
