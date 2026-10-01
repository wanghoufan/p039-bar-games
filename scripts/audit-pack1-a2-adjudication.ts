/**
 * R5｜第一包 A2 逐卡审计的**最终裁决附录**生成器（只读派生 + 只写附录）。
 *
 * ## 为什么存在（本单要消灭的「双真源」）
 * A2 的逐卡审计（`temp/BAR-AUDIT-PACK1-31.md`，**历史原件只读**）把
 * `PN-TRUTH-201~231` 判为 **KEEP 5 / REWRITE 7 / REPLACE 19**；但落地执行时
 * `202` / `225` 实测与新酒吧基线冲突，被**改判 REPLACE**，批次口径实际变成
 * **KEEP 5 / REWRITE 5 / REPLACE 21**（见 `docs/handoff/HANDOFF.md`「大交接 3」§4.1）。
 * 此前只有 HANDOFF 一句话解释，导致 `review trace / ID lineage / replacement justification`
 * 出现**两份可漂移的真源**（A2 原件 vs 实际执行）。本脚本把**最终执行视图**固化为附录
 * `docs/qa/content-audit/PACK1-A2-ADJUDICATION.md`，**不改历史原件**。
 *
 * ## 派生口径（全部只读，不手填汇总）
 * - **A2 原始分类**：26 张不合格卡逐字归档在
 *   `lib/v2-content/archive/retired-truth-pack-2026-09-29.ts`，其 `auditClassification`
 *   字段即 A2 原判（`REWRITE` / `REPLACE`）；其余 5 张（KEEP）仍留在运行时内容源。
 * - **最终执行分类** = A2 原始分类 **再叠加显式改判集** `FINAL_ADJUDICATIONS`
 *   （本单唯一的人工输入：`202` / `225` 由 REWRITE 改判 REPLACE，附 reason / reviewer / date）。
 *   ⛔ 汇总数字（KEEP / REWRITE / REPLACE 各几张）一律由逐卡行 `reduce` 得出，**不得手填**。
 * - **新旧 ID 映射**：REWRITE / REPLACE 批的卡源文件头逐字登记了新 ID ← 旧 ID；本脚本把它登记为
 *   结构化数据并与实际卡源（`PACK1_REWRITE_CARDS` / `PACK1_REPLACE_CARDS`）**逐 id 对账**，
 *   对不上即 `exit 1`（防止附录与卡源漂移）。
 *
 * ## 硬约束（任一不成立即 `exit 1`，不产半份产物）
 * 1. 旧 ID 全集恰为 `PN-TRUTH-201 ~ 231`（31 张，唯一）；
 * 2. 运行时 KEEP 集恰等于旧 ID 全集里的 5 张（`203 205 209 227 229`）；
 * 3. 归档 26 张 + KEEP 5 张 = 31 张，互不相交；
 * 4. 改判集只许包含归档里 A2 原判为 `REWRITE` 的卡（本单恰为 `202` / `225`）；
 * 5. REWRITE / REPLACE 映射的旧 ID 覆盖全部 26 张归档卡，且新 ID 与卡源逐 id 一致；
 * 6. 最终三分类计数 == 逐卡派生值（脚本内断言，非注释）。
 *
 * ## 确定性
 * 产物**不含时间戳 / 随机量**（时间事实只来自被引用的历史记录），故同输入两次运行字节一致；
 * `shasum -a 256` 可自证。历史原件 `temp/BAR-AUDIT-PACK1-31.md` 全程只读、不改。
 *
 * 运行：`npx vite-node -c vitest.config.ts scripts/audit-pack1-a2-adjudication.ts`
 * 产物：`docs/qa/content-audit/PACK1-A2-ADJUDICATION.md`
 */
import { writeFileSync } from "node:fs";

import { RETIRED_TRUTH_CARDS } from "@/lib/v2-content/archive/retired-truth-pack-2026-09-29";
import { RETIRED_PACK1_R6_CARD_IDS } from "@/lib/v2-content/archive/retired-pack1-r6-2026-09-29";
import { RETIRED_PACK1_R7_CARD_IDS } from "@/lib/v2-content/archive/retired-pack1-r7-2026-09-29";
import { FORMAL_TRUTH_BOOTSTRAP_CARDS } from "@/lib/v2-content/formal-truth-bootstrap-pack";
import { FORMAL_TRUTH_CARDS } from "@/lib/v2-content/formal-truth-pack";
import { PACK1_REPLACE_CARDS } from "@/lib/v2-content/pack1-replaces/pack1-replace-cards";
import { PACK1_REWRITE_CARDS } from "@/lib/v2-content/pack1-rewrites/pack1-rewrite-cards";

const ROOT = process.cwd();
const OUT_PATH = `${ROOT}/docs/qa/content-audit/PACK1-A2-ADJUDICATION.md`;
const GENERATED_BY = "scripts/audit-pack1-a2-adjudication.ts";

/** 第一包被审计的旧 ID 全集（A2 覆盖 100%）。 */
const OLD_IDS: readonly string[] = Array.from(
  { length: 31 },
  (_, index) => `PN-TRUTH-${201 + index}`,
);

/** A2 原始逐卡审计原件（**只读**，本脚本不改它）。 */
const A2_SOURCE = "temp/BAR-AUDIT-PACK1-31.md";
/** 最终口径改判的裁定记录（人读真源）。 */
const ADJUDICATION_SOURCE = "docs/handoff/HANDOFF.md#大交接3-2026-09-29-收尾 §4.1";

type FinalClass = "KEEP" | "REWRITE" | "REPLACE";

/**
 * **本单唯一的人工输入**：对 A2 原始分类的显式改判。
 *
 * 只登记「改了哪张、改成什么、为什么、谁定的、哪天定的」，其余一律从归档与卡源派生。
 * 每一条都必须能被 `HANDOFF §4.1` 逐字追溯到；不带任何推测。
 */
interface FinalAdjudication {
  readonly cardId: string;
  readonly a2: FinalClass;
  readonly final: FinalClass;
  readonly reason: string;
  readonly reviewer: string;
  readonly date: string;
}

const FINAL_ADJUDICATIONS: readonly FinalAdjudication[] = [
  {
    cardId: "PN-TRUTH-202",
    a2: "REWRITE",
    final: "REPLACE",
    reason:
      "A2 判 REWRITE（原题面「有没有一个爱好你坚持了很多年？说说它现在还在给你什么。」），" +
      "实测 AI 腔 5 / 现场反应 2（HANDOFF §4.1 逐字），与新酒吧基线（3 秒理解 / 10 秒能答 / 优先封闭半封闭）冲突，" +
      "按最终口径改判 REPLACE（同条 HANDOFF：批次口径 REWRITE 7 ＋ REPLACE 19 → REWRITE 5 ＋ REPLACE 21）。",
    reviewer:
      "编排者（task-manager）口径改判（HANDOFF §4「需要 Human／审查拍板的口径」，本节自述「本轮我改了口径」）",
    date: "2026-09-29",
  },
  {
    cardId: "PN-TRUTH-225",
    a2: "REWRITE",
    final: "REPLACE",
    reason:
      "A2 判 REWRITE（原题面「最近才开始的爱好是什么？说说让你上头的第一个瞬间。」），" +
      "实测 AI 腔 5 / 现场反应 2（HANDOFF §4.1 逐字），与新酒吧基线冲突，按最终口径改判 REPLACE" +
      "（同条 HANDOFF；与 `202` 同批改判）。",
    reviewer:
      "编排者（task-manager）口径改判（HANDOFF §4「需要 Human／审查拍板的口径」，本节自述「本轮我改了口径」）",
    date: "2026-09-29",
  },
];

/**
 * REWRITE 批的**最终** 1:1 方向承接（新 ID ← 旧 ID）。
 *
 * 逐条来自 `lib/v2-content/pack1-rewrites/pack1-rewrite-cards.ts` 文件头「逐卡对应」登记；
 * 与卡源逐 id 对账（见自检）。
 */
const REWRITE_LINEAGE: ReadonlyArray<readonly [newId: string, oldId: string]> = [
  ["PN-TRUTH-244", "PN-TRUTH-201"],
  ["PN-TRUTH-245", "PN-TRUTH-228"],
  ["PN-TRUTH-248", "PN-TRUTH-230"],
  ["PN-TRUTH-249", "PN-TRUTH-231"],
  ["PN-TRUTH-250", "PN-TRUTH-226"],
];

/**
 * REWRITE 批里**保留新方向、不 1:1 承接旧卡**的两个槽位。
 *
 * `202` / `225` 改判 REPLACE 后，其原 REWRITE 槽位 `246` / `247` 未被删除、也未被换成 1:1 新卡：
 * 它们保留的是**新方向**（吸引对象类型 / 心动触发速度），与旧卡信息目标无关
 * （HANDOFF「大交接 3」§4.1：「246/247 保留新方向，不补 1:1 卡」）。
 * 卡源文件头仍写着「承接旧 202 / 225 方向」是**改判前的旧注释**，属已知陈旧描述；
 * 最终口径以本附录为准。
 */
const REWRITE_SLOTS_KEPT_NEW_DIRECTION: ReadonlyArray<
  readonly [newId: string, formerOldId: string, newDirection: string]
> = [
  ["PN-TRUTH-246", "PN-TRUTH-202", "你更吃哪种人：像你的，还是跟你完全不一样的？（吸引对象类型）"],
  ["PN-TRUTH-247", "PN-TRUTH-225", "你的心动是看一眼就来，还是越聊越有？（心动触发速度）"],
];

/** REPLACE 批的 1:1 换向承接（新 ID ← 旧 ID），逐条来自 replace 卡源文件头登记。 */
const REPLACE_LINEAGE: ReadonlyArray<readonly [newId: string, oldId: string]> = [
  ["PN-TRUTH-251", "PN-TRUTH-204"],
  ["PN-TRUTH-252", "PN-TRUTH-206"],
  ["PN-TRUTH-253", "PN-TRUTH-207"],
  ["PN-TRUTH-254", "PN-TRUTH-208"],
  ["PN-TRUTH-255", "PN-TRUTH-210"],
  ["PN-TRUTH-256", "PN-TRUTH-211"],
  ["PN-TRUTH-257", "PN-TRUTH-212"],
  ["PN-TRUTH-258", "PN-TRUTH-213"],
  ["PN-TRUTH-259", "PN-TRUTH-214"],
  ["PN-TRUTH-260", "PN-TRUTH-215"],
  ["PN-TRUTH-261", "PN-TRUTH-216"],
  ["PN-TRUTH-262", "PN-TRUTH-217"],
  ["PN-TRUTH-263", "PN-TRUTH-218"],
  ["PN-TRUTH-264", "PN-TRUTH-219"],
  ["PN-TRUTH-265", "PN-TRUTH-220"],
  ["PN-TRUTH-266", "PN-TRUTH-221"],
  ["PN-TRUTH-267", "PN-TRUTH-222"],
  ["PN-TRUTH-268", "PN-TRUTH-223"],
  ["PN-TRUTH-269", "PN-TRUTH-224"],
];

function fail(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

/* ------------------------------- 读只读真源 ------------------------------- */

const archivedById = new Map(RETIRED_TRUTH_CARDS.map((entry) => [entry.cardId, entry]));
const runtimeKeepIds = new Set<string>([
  ...FORMAL_TRUTH_CARDS.map((card) => card.cardId),
  ...FORMAL_TRUTH_BOOTSTRAP_CARDS.map((card) => card.cardId),
]);
const rewriteCardIds = new Set(PACK1_REWRITE_CARDS.map((card) => card.cardId));
const replaceCardIds = new Set(PACK1_REPLACE_CARDS.map((card) => card.cardId));
/**
 * A9-R6（2026-09-29 内容裁决）退役的新 ID（如 `263`）：其 1:1 换向承接因退役而不再在卡源，
 * 改指归档 `lib/v2-content/archive/retired-pack1-r6-2026-09-29.ts`（血缘仍在，只是退出运行时）。
 */
const r6RetiredNewIds = new Set<string>(RETIRED_PACK1_R6_CARD_IDS);
/**
 * A9-R7（2026-09-29 内容返工）退役的新 ID（`249`，1:1 承接旧 `231`）：同上，血缘仍在，
 * 逐字归档在 `lib/v2-content/archive/retired-pack1-r7-2026-09-29.ts`。
 */
const r7RetiredNewIds = new Set<string>(RETIRED_PACK1_R7_CARD_IDS);

/* --------------------------------- 自检 --------------------------------- */

// ① 旧 ID 全集唯一且等于 201~231。
if (new Set(OLD_IDS).size !== OLD_IDS.length || OLD_IDS.length !== 31) {
  fail(`旧 ID 全集不是 31 张唯一值：${OLD_IDS.length}`);
}

// ② 运行时 KEEP 集（限定在旧 ID 内）恰 5 张。
const keepIds = OLD_IDS.filter((id) => runtimeKeepIds.has(id));
const KEEP_EXPECTED = ["PN-TRUTH-203", "PN-TRUTH-205", "PN-TRUTH-209", "PN-TRUTH-227", "PN-TRUTH-229"];
if (JSON.stringify(keepIds) !== JSON.stringify(KEEP_EXPECTED)) {
  fail(`运行时 KEEP 集与预期不符：${JSON.stringify(keepIds)}`);
}
const keepSet = new Set(keepIds);

// ③ 归档 26 张 + KEEP 5 = 31，互不相交。
const archivedOldIds = OLD_IDS.filter((id) => archivedById.has(id));
if (archivedOldIds.length !== 26) fail(`归档卡数 ≠ 26：${archivedOldIds.length}`);
for (const id of archivedOldIds) if (keepSet.has(id)) fail(`归档与 KEEP 相交：${id}`);
if (new Set([...archivedOldIds, ...keepIds]).size !== 31) fail("归档 ∪ KEEP ≠ 31");

// ④ 改判集合法性。
const judgedById = new Map(FINAL_ADJUDICATIONS.map((entry) => [entry.cardId, entry]));
for (const entry of FINAL_ADJUDICATIONS) {
  const archived = archivedById.get(entry.cardId);
  if (!archived) fail(`改判卡不在归档里：${entry.cardId}`);
  if (archived.auditClassification !== entry.a2) {
    fail(`${entry.cardId} 改判登记 a2=${entry.a2} 与归档原判 ${archived.auditClassification} 不符`);
  }
  if (entry.a2 === entry.final) fail(`${entry.cardId} 改判前后同类（无意义登记）`);
}

// ⑤ REWRITE / REPLACE 映射覆盖全部归档卡，且不与 KEEP 相交。
const rewriteOldByNew = new Map(REWRITE_LINEAGE.map(([n, o]) => [n, o]));
const replaceOldByNew = new Map(REPLACE_LINEAGE.map(([n, o]) => [n, o]));
for (const [newId, oldId] of [...rewriteOldByNew, ...replaceOldByNew]) {
  if (keepSet.has(oldId)) fail(`映射命中 KEEP 卡：${oldId}`);
  if (!archivedById.has(oldId)) fail(`映射的旧卡不在归档里：${oldId}`);
  if (!rewriteCardIds.has(newId) && !replaceCardIds.has(newId) && !r6RetiredNewIds.has(newId) && !r7RetiredNewIds.has(newId)) {
    fail(`映射的新 ID 不在 REWRITE/REPLACE 卡源里（也不在 A9-R6 / A9-R7 退役归档里）：${newId}`);
  }
}
// 归档里 A2 判 REPLACE 的卡必须全部有 REPLACE 映射；A2 判 REWRITE 的卡要么在 REWRITE 映射、
// 要么在保留新方向的槽位、要么被改判 REPLACE。
for (const id of archivedOldIds) {
  const a2 = archivedById.get(id)!.auditClassification;
  const inRewrite = [...rewriteOldByNew.values()].includes(id);
  const inReplace = [...replaceOldByNew.values()].includes(id);
  const slot = REWRITE_SLOTS_KEPT_NEW_DIRECTION.some(([, former]) => former === id);
  const judged = judgedById.has(id);
  if (a2 === "REPLACE" && !inReplace) fail(`A2 REPLACE 卡缺 REPLACE 映射：${id}`);
  if (a2 === "REWRITE" && !inRewrite && !slot && !judged) {
    fail(`A2 REWRITE 卡既无 1:1 承接、也无保留槽位、也未被改判：${id}`);
  }
}
// REWRITE 槽位里保留新方向的 `formerOldId` 必须是改判卡。
for (const [newId, formerOldId] of REWRITE_SLOTS_KEPT_NEW_DIRECTION) {
  if (!rewriteCardIds.has(newId)) fail(`保留槽位的新 ID 不在 REWRITE 卡源里：${newId}`);
  if (!judgedById.has(formerOldId)) fail(`保留槽位登记的原卡不是改判卡：${oldIdText(formerOldId)}`);
}

function oldIdText(id: string): string {
  return id.replace(/^PN-TRUTH-/, "");
}

/* ------------------------------- 逐卡派生 ------------------------------- */

interface Row {
  readonly oldId: string;
  readonly a2: FinalClass;
  readonly final: FinalClass;
  readonly heat: number | null;
  readonly disposition: string;
  readonly newId: string;
  readonly note: string;
}

const rows: Row[] = OLD_IDS.map((oldId) => {
  const archived = archivedById.get(oldId);
  const a2: FinalClass = archived ? (archived.auditClassification as FinalClass) : "KEEP";
  const judged = judgedById.get(oldId);
  const final: FinalClass = judged ? judged.final : a2;

  if (final === "KEEP") {
    return {
      oldId,
      a2,
      final,
      heat: null,
      disposition: "保留 Formal（题面逐字不动）",
      newId: "—（沿用原 ID）",
      note: "A2 判 KEEP / 最终仍 KEEP。",
    };
  }

  const archivedCard = archived!;
  const heat = archivedCard.card.heatMin;
  const disposition = "退出 Formal，逐字归档于 lib/v2-content/archive/retired-truth-pack-2026-09-29.ts";

  const rewriteNew = REWRITE_LINEAGE.find(([, o]) => o === oldId)?.[0];
  const replaceNew = REPLACE_LINEAGE.find(([, o]) => o === oldId)?.[0];
  const slot = REWRITE_SLOTS_KEPT_NEW_DIRECTION.find(([, former]) => former === oldId);

  if (final === "REWRITE") {
    if (!rewriteNew) fail(`最终 REWRITE 卡缺 1:1 新 ID：${oldId}`);
    const retiredNote = r7RetiredNewIds.has(rewriteNew)
      ? "（该新卡已由 A9-R7 内容返工退役，逐字归档于 lib/v2-content/archive/retired-pack1-r7-2026-09-29.ts）"
      : "";
    return {
      oldId,
      a2,
      final,
      heat,
      disposition,
      newId: `${rewriteNew}（1:1 方向承接）${retiredNote}`,
      note:
        "A2 判 REWRITE / 最终仍 REWRITE：同方向重写，旧 ID 退出 Formal、新开 ID。" +
        (retiredNote === "" ? "" : "新卡随后经 A9-R7 内容返工裁决退役（与 250 同轴），血缘保留、退出运行时。"),
    };
  }

  // 最终 REPLACE
  if (replaceNew) {
    const retiredNote = r6RetiredNewIds.has(replaceNew)
      ? "（该新卡已由 A9-R6 内容裁决退役，逐字归档于 lib/v2-content/archive/retired-pack1-r6-2026-09-29.ts）"
      : "";
    return {
      oldId,
      a2,
      final,
      heat,
      disposition,
      newId: `${replaceNew}（换向新卡）${retiredNote}`,
      note: "A2 判 REPLACE / 最终仍 REPLACE：方向本身不适合酒吧主线，换向并新开 ID。",
    };
  }
  if (slot) {
    const [newId, , newDirection] = slot;
    return {
      oldId,
      a2,
      final,
      heat,
      disposition,
      newId: `无 1:1 新 ID（原槽位 ${newId} 保留新方向，不承接）`,
      note:
        `A2 判 REWRITE **改判 REPLACE**：旧卡按 REPLACE 处理（退出 Formal / 归档）；` +
        `其原 REWRITE 槽位 ${newId} 保留新方向「${newDirection}」，**不 1:1 承接**本卡信息目标（不补 1:1 卡）。`,
    };
  }
  return fail(`最终 REPLACE 卡无映射也无槽位：${oldId}`);
});

/* ------------------------------- 汇总派生 ------------------------------- */

const counts = rows.reduce<Record<FinalClass, number>>(
  (acc, row) => {
    acc[row.final] += 1;
    return acc;
  },
  { KEEP: 0, REWRITE: 0, REPLACE: 0 },
);
const a2Counts = rows.reduce<Record<FinalClass, number>>(
  (acc, row) => {
    acc[row.a2] += 1;
    return acc;
  },
  { KEEP: 0, REWRITE: 0, REPLACE: 0 },
);
const total = rows.length;
if (counts.KEEP + counts.REWRITE + counts.REPLACE !== total) fail("最终三分类之和 ≠ 31");
if (JSON.stringify(a2Counts) !== JSON.stringify({ KEEP: 5, REWRITE: 7, REPLACE: 19 })) {
  fail(`A2 原始分类计数与历史记录不符：${JSON.stringify(a2Counts)}`);
}
if (JSON.stringify(counts) !== JSON.stringify({ KEEP: 5, REWRITE: 5, REPLACE: 21 })) {
  fail(`最终三分类计数与预期不符：${JSON.stringify(counts)}`);
}

const idsOf = (cls: FinalClass): string => rows.filter((r) => r.final === cls).map((r) => oldIdText(r.oldId)).join(" / ");

/* ------------------------------- 渲染附录 ------------------------------- */

const md: string[] = [];
md.push("# PACK1-A2-ADJUDICATION｜第一包 A2 审计逐卡裁决**最终执行视图**");
md.push("");
md.push(
  "> 本文件是 `PN-TRUTH-201~231` 逐卡审计**最终处置的唯一真源**（review trace / ID lineage / replacement justification 以本表为准）。",
);
md.push(
  `> 由 \`${GENERATED_BY}\` 从**只读真源**（归档 \`retired-truth-pack-2026-09-29.ts\` 的 \`auditClassification\` ＋ 显式改判集 ＋ REWRITE/REPLACE 卡源）派生；**所有汇总数字由逐卡行计算，无手填**。`,
);
md.push("> ⛔ 不改历史原件：`temp/BAR-AUDIT-PACK1-31.md` 逐字保留 A2 原始审计，本附录只登记其后的最终执行口径。");
md.push("");
md.push("## 0. 口径一句话");
md.push("");
md.push(
  `**A2 原始分类不是最终分类。** A2 原件写 **KEEP ${a2Counts.KEEP} / REWRITE ${a2Counts.REWRITE} / REPLACE ${a2Counts.REPLACE}**；` +
    `实际执行口径为 **KEEP ${counts.KEEP} / REWRITE ${counts.REWRITE} / REPLACE ${counts.REPLACE}**。`,
);
md.push("");
md.push("后续脚本 / 测试如需知道某张旧卡的**最终处置**，**读本附录的最终执行视图**，⛔ 不得继续假定 A2 原始分类即最终分类。");
md.push("");
md.push("### 0.1 算式（可复算）");
md.push("");
md.push("```text");
md.push(`KEEP    ${counts.KEEP} = A2 KEEP ${a2Counts.KEEP} + 改判 ${counts.KEEP - a2Counts.KEEP}`);
md.push(`REWRITE ${counts.REWRITE} = A2 REWRITE ${a2Counts.REWRITE} − 改判 ${a2Counts.REWRITE - counts.REWRITE}`);
md.push(`REPLACE ${counts.REPLACE} = A2 REPLACE ${a2Counts.REPLACE} + 改判 ${counts.REPLACE - a2Counts.REPLACE}`);
md.push(`合计    ${total} = ${counts.KEEP} + ${counts.REWRITE} + ${counts.REPLACE}`);
md.push("```");
md.push("");
md.push("复算命令（脚本内置 fail-closed 断言，任一对不上即 `exit 1`）：");
md.push("");
md.push("```bash");
md.push(`npx vite-node -c vitest.config.ts ${GENERATED_BY}`);
md.push("```");
md.push("");
md.push("## 1. 改判逐条（A2 → 最终）");
md.push("");
md.push("| 旧 ID | A2 原判 | 最终 | 改判原因 | reviewer | date |");
md.push("|---|---|---|---|---|---|");
for (const entry of FINAL_ADJUDICATIONS) {
  md.push(
    `| ${oldIdText(entry.cardId)} | ${entry.a2} | ${entry.final} | ${entry.reason.replace(/\|/gu, "\\|")} | ${entry.reviewer.replace(/\|/gu, "\\|")} | ${entry.date} |`,
  );
}
md.push("");
md.push(
  `> 改判来源：${ADJUDICATION_SOURCE}；A2 原件（只读）：\`${A2_SOURCE}\`。两条改判卡的**旧 ID 处置**均为「退出 Formal，逐字归档」，**新 ID 映射**见 §2 表内「新 ID」列。`,
);
md.push(
  "> ⚠️ HANDOFF §4 标题为「需要 Human／审查拍板的口径」⇒ 该改判属**已登记待拍板**事项；本附录只照实登记最终执行视图，**不代替拍板**。",
);
md.push("");
md.push("## 2. 全 31 张最终三分类表（由脚本从实际处置派生）");
md.push("");
md.push("| 旧 ID | A2 原判 | **最终分类** | 档位 | 旧 ID 处置 | 新 ID | 备注 |");
md.push("|---|---|---|---|---|---|---|");
for (const row of rows) {
  const heat = row.heat === null ? "—" : `H${row.heat}`;
  md.push(
    `| ${oldIdText(row.oldId)} | ${row.a2} | **${row.final}** | ${heat} | ${row.disposition.replace(/\|/gu, "\\|")} | ${row.newId.replace(/\|/gu, "\\|")} | ${row.note.replace(/\|/gu, "\\|")} |`,
  );
}
md.push("");
md.push("### 2.1 最终分类清单（派生）");
md.push("");
md.push(`- **KEEP ${counts.KEEP}**：${idsOf("KEEP")}`);
md.push(`- **REWRITE ${counts.REWRITE}**：${idsOf("REWRITE")}`);
md.push(`- **REPLACE ${counts.REPLACE}**：${idsOf("REPLACE")}`);
md.push("");
md.push("### 2.2 改判卡的新 ID 映射（`202` / `225`）");
md.push("");
md.push(
  "| 旧 ID | 最终分类 | 旧 ID 处置 | 新 ID 映射 |",
);
md.push("|---|---|---|---|");
for (const entry of FINAL_ADJUDICATIONS) {
  const row = rows.find((r) => r.oldId === entry.cardId)!;
  md.push(`| ${oldIdText(row.oldId)} | ${row.final} | ${row.disposition} | ${row.newId} |`);
}
md.push("");
md.push("> ⚠️ 已知陈旧描述：`lib/v2-content/pack1-rewrites/pack1-rewrite-cards.ts` 文件头仍写「承接旧 202 / 225 方向」（改判前注释）。");
md.push(
  "> 最终口径以本附录为准：`246` / `247` 保留的是**新方向**，**不 1:1 承接** `202` / `225` 的信息目标（HANDOFF「大交接 3」§4.1：「246/247 保留新方向，不补 1:1 卡」）。",
);
md.push("");
md.push("## 3. 只读真源（可追溯）");
md.push("");
md.push(`- A2 原始逐卡审计（**只读，未改**）：\`${A2_SOURCE}\`（product-reviewer / Research Reviewer）`);
md.push(`- 口径改判记录：\`${ADJUDICATION_SOURCE}\``);
md.push("- A2 原判载体：`lib/v2-content/archive/retired-truth-pack-2026-09-29.ts` 的 `auditClassification`");
md.push("- REWRITE 新 ID 来源：`lib/v2-content/pack1-rewrites/pack1-rewrite-cards.ts`");
md.push("- REPLACE 新 ID 来源：`lib/v2-content/pack1-replaces/pack1-replace-cards.ts`");
md.push("- KEEP 载体：`lib/v2-content/formal-truth-pack.ts` / `lib/v2-content/formal-truth-bootstrap-pack.ts`");
md.push("");
md.push(
  `*本附录由 \`${GENERATED_BY}\` 生成（确定性：无时间戳 / 无随机量）；表单张数与分类计数均自逐卡行派生。*`,
);
md.push("");

writeFileSync(OUT_PATH, md.join("\n"), "utf8");

console.log(`✓ A2 裁决附录已生成：${OUT_PATH}`);
console.log(`  A2 原始分类 : KEEP ${a2Counts.KEEP} / REWRITE ${a2Counts.REWRITE} / REPLACE ${a2Counts.REPLACE}`);
console.log(`  最终执行分类: KEEP ${counts.KEEP} / REWRITE ${counts.REWRITE} / REPLACE ${counts.REPLACE}`);
console.log(`  改判        : ${FINAL_ADJUDICATIONS.map((e) => `${oldIdText(e.cardId)}:${e.a2}→${e.final}`).join("、")}`);
console.log(`  逐卡行      : ${rows.length}`);
