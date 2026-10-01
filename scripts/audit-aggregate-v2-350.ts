/**
 * Phase A｜聚合：合并 metadata + 人工审查列，产出 350 题完整审查表与结构统计。
 * 只读，不改题库。
 */
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = process.cwd();
const DIR = `${ROOT}/docs/qa/content-audit`;
const TYPES = ["truth", "dare", "most_likely", "never_have_i", "either_or", "pointing", "chemistry"];

interface Meta { cardId: string; gameType: string; number: number; text: string; intensity: number; heatMin: number; heatMax: number; relationStage: string; targetMode: string; responseMode: string; interactionType: string; consentMode: string; matchRequired: boolean; boundaryTags: string[]; }
interface Rev { cardId: string; semanticType: string; topic: string; infoGain: string; learned: string; promotesUnderstanding: string; duplicateGroup: string; verdict: string; }

const meta = new Map<string, Meta>();
for (const t of TYPES) {
  for (const line of readFileSync(`${DIR}/_slices/${t}.jsonl`, "utf8").split("\n").filter(Boolean)) {
    const r = JSON.parse(line) as Meta;
    meta.set(r.cardId, r);
  }
}
const revs: Rev[] = [];
for (const t of TYPES) {
  for (const line of readFileSync(`${DIR}/_reviews/${t}.jsonl`, "utf8").split("\n").filter(Boolean)) {
    revs.push(JSON.parse(line) as Rev);
  }
}
const revById = new Map(revs.map((r) => [r.cardId, r]));

const COLS = ["cardId", "gameType", "number", "text", "intensity", "heatMin", "heatMax", "relationStage", "targetMode", "responseMode", "interactionType", "consentMode", "matchRequired", "boundaryTags",
  "semanticType", "topic", "infoGain", "learned", "promotesUnderstanding", "duplicateGroup", "verdict"] as const;

const rows = [...meta.values()].map((m) => {
  const r = revById.get(m.cardId)!;
  return { ...m, boundaryTags: m.boundaryTags.join("|"), ...r };
}).sort((a, b) => (a.cardId < b.cardId ? -1 : a.cardId > b.cardId ? 1 : 0));

// 完整审查表
writeFileSync(`${DIR}/CONTENT-AUDIT-350.jsonl`, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
const cell = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
const csvText = [COLS.join(",")].concat(rows.map((r) => COLS.map((c) => cell((r as Record<string, unknown>)[c])).join(","))).join("\n") + "\n";
writeFileSync(`${DIR}/CONTENT-AUDIT-350.csv`, csvText);

/* ---------------- 统计 ---------------- */
const N = rows.length;
const pct = (n: number) => `${n}（${(n / N * 100).toFixed(1)}%）`;
const countBy = <T extends string>(key: (r: typeof rows[0]) => T) => {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};
const crossBy = (key: (r: typeof rows[0]) => string) => {
  const m = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (!m.has(key(r))) m.set(key(r), new Map());
    const inner = m.get(key(r))!;
    inner.set(r.topic, (inner.get(r.topic) ?? 0) + 1);
  }
  return m;
};

const ORDER_SEM = ["自我披露", "相互了解", "现场评价/猜测", "行动互动", "暧昧推进", "纯看戏/低信息"];
const ORDER_GAIN = ["高", "中", "低", "0"];

const sem = countBy((r) => r.semanticType).sort((a, b) => ORDER_SEM.indexOf(a[0]) - ORDER_SEM.indexOf(b[0]));
const gain = countBy((r) => r.infoGain).sort((a, b) => ORDER_GAIN.indexOf(a[0]) - ORDER_GAIN.indexOf(b[0]));
const topic = countBy((r) => r.topic);
const verdict = countBy((r) => r.verdict);
const promotes = countBy((r) => r.promotesUnderstanding);

const typeRows = TYPES.map((t) => {
  const sub = rows.filter((r) => r.gameType === t);
  const g = (v: string) => sub.filter((r) => r.infoGain === v).length;
  return { t, n: sub.length, gHigh: g("高"), gMid: g("中"), gLow: g("低"), gZero: g("0"),
    lowZero: sub.filter((r) => r.infoGain === "低" || r.infoGain === "0").length,
    judge: sub.filter((r) => r.semanticType === "现场评价/猜测").length,
    noGain: sub.filter((r) => r.topic === "无明确人物信息增量").length,
    keep: sub.filter((r) => r.verdict === "保留").length };
});

const intRows = [1, 2, 3, 4, 5].map((i) => {
  const sub = rows.filter((r) => r.intensity === i);
  return { i, n: sub.length, high: sub.filter((r) => r.infoGain === "高").length, lowZero: sub.filter((r) => r.infoGain === "低" || r.infoGain === "0").length };
});
const heatBand = (r: typeof rows[0]) => (r.heatMax <= 2 ? "H1" : r.heatMax === 3 ? "H2" : r.heatMax === 4 ? (r.heatMin === 4 ? "H4" : "H3") : "?");
const heatRows = (["H1", "H2", "H3", "H4"] as const).map((h) => {
  const sub = rows.filter((r) => heatBand(r) === h);
  return { h, n: sub.length, high: sub.filter((r) => r.infoGain === "高").length, lowZero: sub.filter((r) => r.infoGain === "低" || r.infoGain === "0").length };
});

const dupGroups = countBy((r) => (r.duplicateGroup === "-" ? "-" : r.duplicateGroup)).filter(([g]) => g !== "-");

// 一局 20 轮模拟：按 targetMode 与 topic 抽，看能覆盖多少"人物信息主题"
const personTopics = new Set(["兴趣爱好", "生活方式", "性格/习惯/小癖好", "择偶偏好/吸引力", "恋爱观", "亲密/性观念", "边界/吃醋/异性朋友/前任", "人生价值/未来"]);
const personGain = rows.filter((r) => personTopics.has(r.topic) && (r.infoGain === "高" || r.infoGain === "中"));
console.log(JSON.stringify({ N, sem, gain, topic, verdict, promotes, typeRows, intRows, heatRows, dupGroups: dupGroups.slice(0, 15), personGainN: personGain.length }, null, 1));
