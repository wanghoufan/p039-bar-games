/**
 * Phase A.1｜交叉校准样本构建（每玩法 10 题 = 70 题）
 * 用确定性伪随机抽样，可复算；同一抽样结果供多个 blind reviewer 使用。
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const ROOT = process.cwd();
const DIR = `${ROOT}/docs/qa/content-audit`;
mkdirSync(`${DIR}/_calib`, { recursive: true });

const TYPES = ["truth", "dare", "most_likely", "never_have_i", "either_or", "pointing", "chemistry"];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const picked: { cardId: string; gameType: string; text: string }[] = [];
for (const [ti, type] of TYPES.entries()) {
  const slice = readFileSync(`${DIR}/_slices/${type}.jsonl`, "utf8")
    .split("\n").filter(Boolean).map((l) => JSON.parse(l) as { cardId: string; text: string });
  const rnd = mulberry32(987654321 + ti * 31337);
  // Fisher-Yates 前 10
  const arr = [...slice];
  for (let i = 0; i < 10; i += 1) {
    const j = i + Math.floor(rnd() * (arr.length - i));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  for (const c of arr.slice(0, 10)) picked.push({ cardId: c.cardId, gameType: type, text: c.text });
}

writeFileSync(`${DIR}/_calib/sample.jsonl`, picked.map((p) => JSON.stringify(p)).join("\n") + "\n");

/** 盲审输入：只给题面，不给任何原判定，避免锚定。 */
writeFileSync(`${DIR}/_calib/blind-input.jsonl`,
  picked.map((p) => JSON.stringify({ cardId: p.cardId, gameType: p.gameType, text: p.text })).join("\n") + "\n");

const byType: Record<string, number> = {};
for (const p of picked) byType[p.gameType] = (byType[p.gameType] ?? 0) + 1;
console.log(`校准样本 ${picked.length} 题：`, JSON.stringify(byType));
console.log("盲审输入：docs/qa/content-audit/_calib/blind-input.jsonl（不含任何原判定）");
