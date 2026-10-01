/**
 * A4a / A9-R6｜全库 Truth ID 号段扫描（**只读** QA 工具，可反复复跑）。
 *
 * 用途：给后续内容批次（Golden 12 / REWRITE / REPLACE / H3·H4 补卡）算「安全新号段起点」，
 * 并做一次全库 collision 校验（退出码非 0 ⇒ CI/人工可卡）。
 *
 * ⚠️ 扫描范围**必须包含归档 / 退役段**：退役 ID 永不复用，漏掉归档会算出错误起点。
 * 退役段 = **A3**（26 张 `PN-TRUTH-201~231` 内的旧版本）＋ **A9-R6**（3 张内容裁决退役
 * `PN-TRUTH-236/263/277`）＋ **A9-R7**（1 张内容返工退役 `PN-TRUTH-249`）。本脚本同时 fail-closed
 * 锁死「R6/R7 退役卡**既不在运行时内容源、也不在 Formal**」。
 * 本脚本是归档的**唯一合法只读消费者之一**（另一个是测试）；归档不得被 `lib/**` 运行时
 * 或 MC 生产链脚本 import。
 *
 * ⚠️ 扫描范围也**必须包含已落地的新内容批**（A4c/A5/A6 修正）：Golden 12（232~243）、第一包 REWRITE
 * （244~250）、第一包 REPLACE（251~269）与 A6 覆盖率补卡（270~283）已占用号段，
 * 若漏掉它们，脚本会打印过期的起点——那是假话。
 *
 * 运行：`npx vite-node -c vitest.config.ts scripts/audit-card-id-space.ts`
 */

import { analyzeTruthIdSpace, formatTruthCardId, suggestTruthCardIds } from "@/lib/v2-content/card-id-space";
import { getV2ContentAdapter } from "@/lib/v2-content/v2-content-adapter";
import { RETIRED_TRUTH_CARD_IDS } from "@/lib/v2-content/archive/retired-truth-pack-2026-09-29";
import { RETIRED_PACK1_R6_CARD_IDS } from "@/lib/v2-content/archive/retired-pack1-r6-2026-09-29";
import { RETIRED_PACK1_R7_CARD_IDS } from "@/lib/v2-content/archive/retired-pack1-r7-2026-09-29";
import { GOLDEN_12_CARD_IDS } from "@/lib/v2-content/golden12/golden-12-cards";
import { PACK1_REWRITE_CARD_IDS } from "@/lib/v2-content/pack1-rewrites/pack1-rewrite-cards";
import { PACK1_REPLACE_CARD_IDS } from "@/lib/v2-content/pack1-replaces/pack1-replace-cards";
import { PACK1_SUPPLEMENT_CARD_IDS } from "@/lib/v2-content/pack1-supplements/pack1-supplement-cards";
import { PACK1_ADMISSION_CARD_IDS } from "@/lib/v2-content/pack1-admission";
import { formalFixedIdSet } from "@/lib/v2-content/fixed-content-manifest";
import { FORMAL_TRUTH_BOOTSTRAP_CARDS } from "@/lib/v2-content/formal-truth-bootstrap-pack";
import { FORMAL_TRUTH_CARDS } from "@/lib/v2-content/formal-truth-pack";

const adapter = getV2ContentAdapter();
const ssotIds = [...adapter.mainlineCards, ...adapter.expansionCards].map((card) => card.cardId);
const runtimePackIds = [
  ...FORMAL_TRUTH_CARDS.map((card) => card.cardId),
  ...FORMAL_TRUTH_BOOTSTRAP_CARDS.map((card) => card.cardId),
];
const newBatchIds = [
  ...GOLDEN_12_CARD_IDS,
  ...PACK1_REWRITE_CARD_IDS,
  ...PACK1_REPLACE_CARD_IDS,
  ...PACK1_SUPPLEMENT_CARD_IDS,
];
/** 归档 / 退役段（ID 永不复用，必须计入 collision 域）：A3 26 ＋ A9-R6 内容裁决 3 ＋ A9-R7 内容返工 1。 */
const retiredA3Ids = RETIRED_TRUTH_CARD_IDS;
const retiredR6Ids = RETIRED_PACK1_R6_CARD_IDS;
const retiredR7Ids = RETIRED_PACK1_R7_CARD_IDS;
const retiredPack1Ids = [...retiredR6Ids, ...retiredR7Ids];
const libraryIds = [...ssotIds, ...runtimePackIds, ...retiredA3Ids, ...retiredPack1Ids, ...newBatchIds];

const report = analyzeTruthIdSpace(libraryIds);
const runtimeOnly = analyzeTruthIdSpace([...ssotIds, ...runtimePackIds]);

console.log("\n=== A4a / A9-R6 全库 Truth ID 号段扫描 ===");
console.log(
  `扫描范围：SSOT ${ssotIds.length} + 运行时 KEEP ${runtimePackIds.length} + 归档退役 A3 ${retiredA3Ids.length} + A9-R6 退役 ${retiredR6Ids.length} + A9-R7 退役 ${retiredR7Ids.length} + 新内容批 ${newBatchIds.length} = ${libraryIds.length}（去重后 ${report.uniqueIds.length}）`,
);
console.log(`归档退役段：A3 26 张（201~231 内）｜A9-R6 内容裁决 ${retiredR6Ids.length} 张：${retiredR6Ids.join(" / ")}｜A9-R7 内容返工 ${retiredR7Ids.length} 张：${retiredR7Ids.join(" / ")}`);
console.log(`新内容批：Golden ${GOLDEN_12_CARD_IDS.length} 张（${GOLDEN_12_CARD_IDS[0]}..${GOLDEN_12_CARD_IDS.at(-1)}）+ 第一包 REWRITE ${PACK1_REWRITE_CARD_IDS.length} 张（${PACK1_REWRITE_CARD_IDS[0]}..${PACK1_REWRITE_CARD_IDS.at(-1)}）+ 第一包 REPLACE ${PACK1_REPLACE_CARD_IDS.length} 张（${PACK1_REPLACE_CARD_IDS[0]}..${PACK1_REPLACE_CARD_IDS.at(-1)}）+ A6 补卡 ${PACK1_SUPPLEMENT_CARD_IDS.length} 张（${PACK1_SUPPLEMENT_CARD_IDS[0]}..${PACK1_SUPPLEMENT_CARD_IDS.at(-1)}）`);
console.log(`Truth 家族编号：${report.truthNumbers.length} 个（${report.truthNumbers[0]}..${report.truthNumbers.at(-1)}）`);
console.log(`全库最大 Truth 编号：${report.maxTruthNumber}`);
console.log(`安全新号段起点   ：${report.suggestedNextTruthStart}（例：${suggestTruthCardIds(report, 3).join(" / ")}）`);
console.log(`对照｜只扫运行时：最大 ${runtimeOnly.maxTruthNumber} ⇒ 误推 ${runtimeOnly.suggestedNextTruthStart}（会与归档 ${formatTruthCardId(runtimeOnly.suggestedNextTruthStart)} 撞号）`);
console.log(`collision：${report.collisions.length === 0 ? "0（无重复）" : report.collisions.join(",")}`);
console.log(`非法本族 ID：${report.malformed.length === 0 ? "0" : report.malformed.join(",")}`);

/*
 * A9-R6/R7 §3｜退役卡口径锁死：退役卡**既不在运行时卡源、也不在 Formal**。
 * 这是「退役只改活跃状态、不回运行时」的 fail-closed 审计断言（任一不成立即 exit 1）。
 */
const errors: string[] = [];
if (report.collisions.length > 0) errors.push(`全库 ID collision：${report.collisions.join(",")}`);
if (report.malformed.length > 0) errors.push(`本族非法 ID：${report.malformed.join(",")}`);

const runtimeSourceIds = new Set<string>([
  ...runtimePackIds,
  ...newBatchIds,
  ...PACK1_ADMISSION_CARD_IDS,
]);
const formalIds = formalFixedIdSet();
for (const id of retiredPack1Ids) {
  if (runtimeSourceIds.has(id)) errors.push(`A9-R6/R7 退役卡仍在运行时内容源：${id}`);
  if (formalIds.has(id)) errors.push(`A9-R6/R7 退役卡仍在 Formal：${id}`);
}

console.log("\n=== 结论 ===");
if (errors.length > 0) {
  for (const error of errors) console.log(`  - ${error}`);
  process.exit(1);
}
console.log(
  `号段扫描通过：全库 ${libraryIds.length} 张 ID 无 collision；` +
    `最大 Truth 编号 ${report.maxTruthNumber}，安全新号段从 PN-TRUTH-${String(report.suggestedNextTruthStart).padStart(3, "0")} 起。`,
);
console.log(
  `退役口径锁死：A9-R6 ${retiredR6Ids.length} 张（${retiredR6Ids.join(" / ")}）＋ A9-R7 ${retiredR7Ids.length} 张（${retiredR7Ids.join(" / ")}）既不在运行时内容源、也不在 Formal。`,
);
