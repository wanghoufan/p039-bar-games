/**
 * Phase A｜内容质量专项审查 — 机械导出（只读）
 *
 * 真源：lib/v2-content/generated/v2-ssot.generated.json → mainlineCards → 350 张 PN-* 卡
 * 本脚本只读真源，输出：BASE-EXPORT.jsonl（带全部 metadata 列）＋ 7 个按玩法切片的批次文件。
 * 不修改 SSOT、不改题面、不生成新题。
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const ROOT = process.cwd();
const OUT_DIR = `${ROOT}/docs/qa/content-audit`;
const SLICE_DIR = `${OUT_DIR}/_slices`;
mkdirSync(SLICE_DIR, { recursive: true });

const ssot = JSON.parse(readFileSync(`${ROOT}/lib/v2-content/generated/v2-ssot.generated.json`, "utf8"));
const cards = ssot.mainlineCards as Record<string, unknown>[];

const FIELDS = [
  "cardId", "gameType", "number", "text", "intensity", "heatMin", "heatMax",
  "relationStage", "targetMode", "responseMode", "interactionType",
  "consentMode", "matchRequired", "boundaryTags",
] as const;

const rows = cards.map((card) => {
  const row: Record<string, unknown> = {};
  for (const field of FIELDS) row[field] = card[field];
  return row;
});

writeFileSync(`${OUT_DIR}/BASE-EXPORT.jsonl`, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");

// CSV（全部字段加引号，中文逗号安全）
const csvCell = (value: unknown) => `"${String(Array.isArray(value) ? value.join("|") : value).replace(/"/g, '""')}"`;
const csv = [FIELDS.join(",")]
  .concat(rows.map((r) => FIELDS.map((f) => csvCell(r[f])).join(",")))
  .join("\n");
writeFileSync(`${OUT_DIR}/BASE-EXPORT.csv`, csv + "\n");

// 按 gameType 切 7 片，每片 50 张
const byType = new Map<string, Record<string, unknown>[]>();
for (const row of rows) {
  const type = String(row.gameType);
  if (!byType.has(type)) byType.set(type, []);
  byType.get(type)!.push(row);
}
const manifest: Record<string, number> = {};
for (const [type, list] of byType) {
  writeFileSync(`${SLICE_DIR}/${type}.jsonl`, list.map((r) => JSON.stringify(r)).join("\n") + "\n");
  manifest[type] = list.length;
}

console.log(`导出 ${rows.length} 张 → ${OUT_DIR}`);
console.log(`切片：${JSON.stringify(manifest)}`);
