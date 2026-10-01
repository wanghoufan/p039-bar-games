/**
 * §4.8｜Formal 全池**正式内容结构报告**（**只出结构，不改内容**）。
 *
 * ## 为什么要有这份报告
 * `PACK1-SKELETON-CLUSTER` 只统计**答案骨架**（选谁 / A-B / 身体 / yes-no）；本报告补上
 * 「正式内容分布」这层：把当前 Formal 全池按 **9 个设计维度**（Human 冻结的 5 类主线重点 ＋ 4 类
 * **退出方向**）逐卡归类，显形「目标类是否够、退出类是否漏进来」。
 *
 * ## 9 个维度（口径全部写死在代码里、可复算、可审计）
 * | 维度 | 判据 |
 * |---|---|
 * | `quick_know` / `attraction` / `flirt` / `body_preference` / `follow_up_hook` | planning-only 字段 `category`（唯一真源 = 各卡源；KEEP 5 无 planning category，单列「无 planning category」桶） |
 * | `long_term_relationship`（长期关系规则） | 题面命中退出词表 `/长期关系\|长期伴侣\|结婚\|婚姻\|五年后\|以后的日子\|理想的一天/` |
 * | `ex_partner`（前任回忆） | 题面命中 `/前任\|上一段\|旧关系\|前男友\|前女友/` |
 * | `therapy_like`（心理咨询式自我剖析） | 题面命中 `/心理咨询\|原生家庭\|童年\|创伤\|抑郁\|焦虑\|自我剖析/` |
 * | `complex_open_question`（复杂人生规划开放题） | 题面命中 `/各占几成\|哪三段\|人生规划\|未来.*(打算\|计划)/` |
 *
 * > 退出四类用的是**必要条件式词面 screen**（命中即入），与 `PACK1-SKELETON-CLUSTER` 同一纪律：
 * > 只读题面 / 既有 planning 字段，⛔ 不引入未登记的相似度模型；漏网的纯换词改写由人工复核。
 *
 * ## 只出结构（红线）
 * - 只读 Formal 卡源与 planning 元数据；⛔ 不改卡、不改准入、不改阈值。
 * - 退出四类命中数 **0** 是当前期望；若 > 0 只**如实登记**（本报告不删卡，裁决属内容单）。
 *
 * ## 口径
 * 「当前 Formal 全池」= 生产牌堆 ∩ manifest `formalFixedIdSet()`（不按 `PN-TRUTH-2*` 前缀推断）。
 *
 * ## 确定性
 * 产物不含时间戳 / 随机量；同输入两次运行字节一致（`shasum -a 256` 自证）。
 *
 * 运行：`npx vite-node -c vitest.config.ts scripts/audit-formal-truth-structure.ts`
 * 产物：`docs/qa/content-audit/FORMAL-TRUTH-STRUCTURE.json`（机器真源）
 *       ＋ `docs/qa/content-audit/FORMAL-TRUTH-STRUCTURE.md`（人读报告，本文件为 json 的渲染）
 */
import { writeFileSync } from "node:fs";

import { formalFixedIdSet } from "@/lib/v2-content/fixed-content-manifest";
import { PACK1_ADMISSION_CARD_BY_ID } from "@/lib/v2-content/pack1-admission";
import { mainlineSsotCardsByPack } from "@/lib/v2-content/v2-card-bridge";

const ROOT = process.cwd();
const PACK_ID = "truth-dare";
const JSON_PATH = `${ROOT}/docs/qa/content-audit/FORMAL-TRUTH-STRUCTURE.json`;
const MD_PATH = `${ROOT}/docs/qa/content-audit/FORMAL-TRUTH-STRUCTURE.md`;
const GENERATED_BY = "scripts/audit-formal-truth-structure.ts";

/** 5 类主线重点（planning `category`）。 */
const TARGET_CATEGORIES = [
  "quick_know",
  "attraction",
  "flirt",
  "body_preference",
  "follow_up_hook",
] as const;
type TargetCategory = (typeof TARGET_CATEGORIES)[number];

/** 4 类退出方向（Human 冻结：前任回忆 / 长期关系规则 / 人生规划 / 心理咨询式自我剖析）。 */
const EXIT_DIMENSIONS = {
  long_term_relationship: { label: "长期关系规则", pattern: "长期关系|长期伴侣|结婚|婚姻|五年后|以后的日子|理想的一天" },
  ex_partner: { label: "前任回忆", pattern: "前任|上一段|旧关系|前男友|前女友" },
  therapy_like: { label: "心理咨询式自我剖析", pattern: "心理咨询|原生家庭|童年|创伤|抑郁|焦虑|自我剖析" },
  complex_open_question: { label: "复杂人生规划开放题", pattern: "各占几成|哪三段|人生规划|未来.*(打算|计划)" },
} as const;
type ExitDimension = keyof typeof EXIT_DIMENSIONS;

const RE_EXIT: Record<ExitDimension, RegExp> = {
  long_term_relationship: new RegExp(EXIT_DIMENSIONS.long_term_relationship.pattern, "u"),
  ex_partner: new RegExp(EXIT_DIMENSIONS.ex_partner.pattern, "u"),
  therapy_like: new RegExp(EXIT_DIMENSIONS.therapy_like.pattern, "u"),
  complex_open_question: new RegExp(EXIT_DIMENSIONS.complex_open_question.pattern, "u"),
};

/* ------------------------------ 读当前 Formal 全池 ------------------------------ */

const formalIdSet = formalFixedIdSet();
const pool = mainlineSsotCardsByPack(PACK_ID)
  .filter((card) => formalIdSet.has(card.id))
  .map((card) => {
    const admission = PACK1_ADMISSION_CARD_BY_ID.get(card.id) as Record<string, unknown> | undefined;
    const category = (admission?.category as string | undefined) ?? null;
    return { cardId: card.id, text: card.content, category };
  });

if (pool.length === 0) {
  console.error("✗ Formal 全池为空：formalFixedIdSet() ∩ 生产牌堆无交集，拒绝产出空报告。");
  process.exit(1);
}

/* --------------------------------- 派生 --------------------------------- */

const targetCounts: Record<TargetCategory, string[]> = {
  quick_know: [],
  attraction: [],
  flirt: [],
  body_preference: [],
  follow_up_hook: [],
};
const noPlanningCategory: string[] = [];
for (const card of pool) {
  if (card.category && (TARGET_CATEGORIES as readonly string[]).includes(card.category)) {
    targetCounts[card.category as TargetCategory].push(card.cardId);
  } else {
    noPlanningCategory.push(card.cardId);
  }
}

const exitCounts: Record<ExitDimension, string[]> = {
  long_term_relationship: [],
  ex_partner: [],
  therapy_like: [],
  complex_open_question: [],
};
for (const card of pool) {
  for (const dim of Object.keys(EXIT_DIMENSIONS) as ExitDimension[]) {
    if (RE_EXIT[dim].test(card.text)) exitCounts[dim].push(card.cardId);
  }
}

const total = pool.length;
const shortIds = (ids: readonly string[]): string => ids.map((id) => id.replace(/^PN-TRUTH-/u, "")).join(" / ");
const pct = (n: number): number => Math.round((n / total) * 1000) / 10;

/**
 * P2 登记（结构侧）：「选谁」骨架的收敛风险 —— 与 `PACK1-SKELETON-CLUSTER` 同一事实的**结构侧留痕**。
 * 来源 `RESEARCH_REVIEW-PACK1-FINAL-54.md` §专项 2；**收敛子集为人读登记事实**，
 * 本报告其余 9 维计数一律由卡源现算（⛔ 不手填）。
 */
const P2_SELECT_WHO_CONVERGENCE = {
  source: "docs/review/RESEARCH_REVIEW-PACK1-FINAL-54.md §专项 2",
  registeredSubset: ["PN-TRUTH-251", "PN-TRUTH-257", "PN-TRUTH-273", "PN-TRUTH-276", "PN-TRUTH-279", "PN-TRUTH-280", "PN-TRUTH-281"],
  verdict: "不退卡（单卡质量与 hook 真值均过线），登记风险",
  limitSuggestion: "第二包禁止继续大量堆「选谁」；后续单局限流（如单局 ≤2 张）或 280 / 281 / 273 轮换 —— 交编排者裁决。",
} as const;

/** hook 侧真实分布（结构侧可机检的「选谁」类规模），来自 planning 字段派生（不改卡）。 */
const followUpHookCount = pool.filter((card) => card.category === "follow_up_hook").length;

const exitHitTotal = (Object.keys(EXIT_DIMENSIONS) as ExitDimension[]).reduce(
  (sum, dim) => sum + exitCounts[dim].length,
  0,
);

const note =
  `当前 Formal 全池 ${total} 张按 9 维度归类：5 类主线重点（planning category 真值）` +
  (TARGET_CATEGORIES as readonly TargetCategory[]).map((c) => `${c} ${targetCounts[c].length}`).join(" / ") +
  `；另有 ${noPlanningCategory.length} 张无 planning category（KEEP 5 等，非本 5 类）。` +
  `4 类退出方向词面 screen 命中合计 ${exitHitTotal} 张` +
  (exitHitTotal === 0 ? "（0 —— 未发现退出方向漏入 Formal）" : `（> 0，如实登记待内容裁决）`) +
  `。`;

/* ----------------------------------- 产物 ----------------------------------- */

const payload = {
  source: `${PACK_ID} 生产牌堆 ∩ manifest formalFixedIdSet()（当前 Formal 全池）`,
  scope: "current-formal-fixed-structure",
  totalFormal: total,
  dimensions: {
    targets: Object.fromEntries(
      (TARGET_CATEGORIES as readonly TargetCategory[]).map((c) => [
        c,
        { label: c, count: targetCounts[c].length, pct: pct(targetCounts[c].length), cardIds: targetCounts[c] },
      ]),
    ),
    noPlanningCategory: { label: "无 planning category（KEEP 5 等）", count: noPlanningCategory.length, cardIds: noPlanningCategory },
    exits: Object.fromEntries(
      (Object.keys(EXIT_DIMENSIONS) as ExitDimension[]).map((dim) => [
        dim,
        {
          label: EXIT_DIMENSIONS[dim].label,
          pattern: EXIT_DIMENSIONS[dim].pattern,
          count: exitCounts[dim].length,
          cardIds: exitCounts[dim],
        },
      ]),
    ),
  },
  note,
  p2SelectWhoConvergence: {
    ...P2_SELECT_WHO_CONVERGENCE,
    followedUpHookCards: followUpHookCount,
  },
  generatedBy: GENERATED_BY,
};

writeFileSync(JSON_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

const md: string[] = [];
md.push("# FORMAL-TRUTH-STRUCTURE｜正式内容结构报告（9 维度）");
md.push("");
md.push(`> 由 \`${GENERATED_BY}\` 生成（确定性：无时间戳 / 无随机量）；本文件是 \`FORMAL-TRUTH-STRUCTURE.json\` 的渲染。`);
md.push(`> Formal 全池 \`${total}\` 张。`);
md.push("");
md.push("## 0. 一句话（由实测派生）");
md.push("");
md.push(note);
md.push("");
md.push("## 1. 口径");
md.push("");
md.push("- 「当前 Formal 全池」= 生产牌堆 ∩ manifest `formalFixedIdSet()`（不按 `PN-TRUTH-2*` 前缀推断）。");
md.push("- 5 类主线重点取 planning-only 字段 `category`（唯一真源 = 卡源；KEEP 5 无此字段，单列）。");
md.push("- 4 类退出方向用**必要条件式词面 screen**（命中即入）；⛔ 不引入未登记的相似度模型，漏网换词由人工复核。");
md.push("");
md.push("## 2. 5 类主线重点（planning `category` 真值，派生）");
md.push("");
md.push("| 维度 | 张数 | 占比 | 卡号 |");
md.push("|---|---:|---:|---|");
for (const c of TARGET_CATEGORIES as readonly TargetCategory[]) {
  md.push(`| ${c} | ${targetCounts[c].length} | ${pct(targetCounts[c].length)}% | ${shortIds(targetCounts[c]) || "—"} |`);
}
md.push(`| （无 planning category） | ${noPlanningCategory.length} | ${pct(noPlanningCategory.length)}% | ${shortIds(noPlanningCategory) || "—"} |`);
md.push("");
md.push("## 3. 4 类退出方向（词面 screen，命中即入）");
md.push("");
md.push("| 维度 | 判据（正则） | 张数 | 卡号 |");
md.push("|---|---|---:|---|");
for (const dim of Object.keys(EXIT_DIMENSIONS) as ExitDimension[]) {
  md.push(`| \`${dim}\`（${EXIT_DIMENSIONS[dim].label}） | \`${EXIT_DIMENSIONS[dim].pattern.replace(/\|/gu, "\\|")}\` | ${exitCounts[dim].length} | ${shortIds(exitCounts[dim]) || "—"} |`);
}
md.push("");
md.push(`> 退出方向命中合计 **${exitHitTotal}** 张${exitHitTotal === 0 ? "（0，未发现退出方向漏入 Formal）" : "（> 0，如实登记待内容裁决）"}。`);
md.push("");
md.push("## 4. P2 登记：「选谁」骨架的收敛风险（结构侧留痕）");
md.push("");
md.push(`> 来源：${P2_SELECT_WHO_CONVERGENCE.source}。机检计数（本脚本现算）：\`category=follow_up_hook\` 共 **${followUpHookCount} 张**。`);
md.push("");
md.push(`- **审查登记的收敛子集（人读判定，7 张）**：${shortIds(P2_SELECT_WHO_CONVERGENCE.registeredSubset)} —— 真人游玩高度收敛于同一暧昧对象。`);
md.push(`- **结论**：${P2_SELECT_WHO_CONVERGENCE.verdict}。`);
md.push(`- **限流建议（登记，不在本报告执行）**：${P2_SELECT_WHO_CONVERGENCE.limitSuggestion}`);
md.push("");
md.push("*本报告只出结构，不改内容；产物可重复运行且字节稳定（`shasum -a 256` 自证）。*");
md.push("");

writeFileSync(MD_PATH, md.join("\n"), "utf8");

console.log("✓ 正式内容结构报告已生成：");
console.log(`  json: ${JSON_PATH}`);
console.log(`  md  : ${MD_PATH}`);
console.log(`  Formal 全池: ${total}`);
for (const c of TARGET_CATEGORIES as readonly TargetCategory[]) console.log(`  ${c.padEnd(20)}: ${targetCounts[c].length}（${pct(targetCounts[c].length)}%）`);
console.log(`  ${"（无 category）".padEnd(20)}: ${noPlanningCategory.length}`);
for (const dim of Object.keys(EXIT_DIMENSIONS) as ExitDimension[]) console.log(`  ${dim.padEnd(22)}: ${exitCounts[dim].length}（退出方向 screen）`);
