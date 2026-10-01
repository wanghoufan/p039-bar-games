/**
 * Phase A.1｜审查结果机械校验（只读）
 * 12 字段版：新增 socialEnergy / relationshipProgression / duplicateCluster。
 * 逐行验：JSON 合法 / cardId 与顺序对齐真源 / text 逐字一致 / 枚举合法 / 唯一 / 覆盖 350。
 */
import { readFileSync } from "node:fs";

const ROOT = process.cwd();
const TYPES = ["truth", "dare", "most_likely", "never_have_i", "either_or", "pointing", "chemistry"];

const ssot = JSON.parse(readFileSync(`${ROOT}/lib/v2-content/generated/v2-ssot.generated.json`, "utf8"));
const truth = new Map<string, { text: string; gameType: string }>(
  (ssot.mainlineCards as Record<string, unknown>[]).map((c) => [String(c.cardId), { text: String(c.text), gameType: String(c.gameType) }]),
);

const ENUMS: Record<string, ReadonlySet<string>> = {
  semanticType: new Set(["自我披露", "相互了解", "现场评价/猜测", "行动互动", "暧昧推进", "纯看戏/低信息"]),
  topic: new Set([
    "兴趣爱好", "生活方式", "性格/习惯/小癖好", "择偶偏好/吸引力", "恋爱观", "亲密/性观念",
    "边界/吃醋/异性朋友/前任", "人生价值/未来", "现场化学反应", "无明确人物信息增量",
  ]),
  infoGain: new Set(["高", "中", "低", "0"]),
  promotesUnderstanding: new Set(["是", "弱", "否"]),
  socialEnergy: new Set(["高", "中", "低"]),
  relationshipProgression: new Set(["高", "中", "低"]),
  verdict: new Set(["保留", "改写候选", "删除候选"]),
};
const REQ = [
  "cardId", "gameType", "text", "semanticType", "topic", "infoGain", "learned",
  "promotesUnderstanding", "socialEnergy", "relationshipProgression", "duplicateCluster", "verdict",
];

const errors: string[] = [];
const seen = new Set<string>();
let total = 0;

for (const type of TYPES) {
  const lines = readFileSync(`${ROOT}/docs/qa/content-audit/_reviews-a1/${type}.jsonl`, "utf8")
    .split("\n").filter((l) => l.trim().length > 0);
  const slice = readFileSync(`${ROOT}/docs/qa/content-audit/_slices/${type}.jsonl`, "utf8")
    .split("\n").filter((l) => l.trim().length > 0).map((l) => JSON.parse(l) as { cardId: string });

  if (lines.length !== slice.length) errors.push(`${type}: 行数 ${lines.length} ≠ 输入 ${slice.length}`);

  lines.forEach((line, i) => {
    total += 1;
    let row: Record<string, unknown>;
    try { row = JSON.parse(line) as Record<string, unknown>; }
    catch { errors.push(`${type}#${i + 1}: JSON 非法`); return; }

    const expect = slice[i];
    if (!expect) { errors.push(`${type}#${i + 1}: 输入已越界`); return; }
    if (row.cardId !== expect.cardId) errors.push(`${type}#${i + 1}: cardId ${row.cardId} ≠ 输入 ${expect.cardId}`);
    if (seen.has(String(row.cardId))) errors.push(`${type}#${i + 1}: cardId 重复 ${row.cardId}`);
    seen.add(String(row.cardId));

    const t = truth.get(String(row.cardId));
    if (!t) { errors.push(`${type}#${i + 1}: cardId 不在真源`); return; }
    if (row.text !== t.text) errors.push(`${type}#${i + 1} ${row.cardId}: text 与真源不一致`);
    if (row.gameType !== t.gameType) errors.push(`${type}#${i + 1} ${row.cardId}: gameType 不一致`);

    for (const f of REQ) if (!(f in row)) errors.push(`${type}#${i + 1} ${row.cardId}: 缺字段 ${f}`);
    for (const [field, allowed] of Object.entries(ENUMS)) {
      if (!(field in row)) continue;
      if (!allowed.has(String(row[field]))) errors.push(`${type}#${i + 1} ${row.cardId}: ${field} 非法「${row[field]}」`);
    }
    if (typeof row.learned !== "string" || !String(row.learned).trim()) errors.push(`${type}#${i + 1} ${row.cardId}: learned 为空`);
    if (typeof row.duplicateCluster !== "string") errors.push(`${type}#${i + 1} ${row.cardId}: duplicateCluster 非字符串`);
  });
}

console.log(`A1 校验 ${total} 行，去重后 ${seen.size} 张`);
if (seen.size !== 350) errors.push(`覆盖 ${seen.size} 张 ≠ 350`);
if (errors.length) {
  console.log(`\n不合规 ${errors.length} 条：`);
  for (const e of errors.slice(0, 60)) console.log("  - " + e);
  process.exit(1);
}
console.log("A1 全部合规：cardId/顺序/text/12字段/枚举/唯一性 均通过");
