/**
 * §14｜Formal 全池「同 answer-shape cluster」骨架审计（**只出诊断，不改内容**）。
 *
 * ## 为什么要有这份审计
 * 只看 `semantic axis`（语义轴）会把「技术上不同轴、真人玩起来却像一直在答同一道题」的卡放过去。
 * 典型：`273 274 275 276 280 281` 的语义轴确实不同（一起走 / 组队 / 1v1 飞镖 / 透气 / 点歌 /
 * 把一杯喝完），但**全部用「你想跟谁……」同一骨架**。本脚本对**当前 Formal 全池**统计
 * `question skeleton / answer target cluster`，把这类同骨架聚集显形。
 *
 * ## 骨架判定规则（**全部写在代码里、可复算、可审计**；⛔ 不用任何黑箱相似度）
 * 每个 cluster 是一个**显式正则 / 显式字段判据**的纯函数，逐卡各自独立判定（**允许一卡同时落多类**）：
 *
 * | cluster | 判据 | 说明 |
 * |---|---|---|
 * | `selectWho`（选谁／点名对象） | `/谁\|哪位\|哪一位\|哪个人\|哪个微信/` **且不命中** `/谁都/` | 答案必须**点名一个具体对象**（含「跟谁／给谁／拉谁／要谁的什么／等谁」等变体）；`谁都` 为**任指**（如 `233`「看谁都顺眼」）不算；「哪种人／哪一类」属**类型**选择，不含指人目标词，也不算。 |
 * | `selectWhoSameFrame`（「想…谁」同骨架，`selectWho` 的子集） | `/(想\|要\|打算)(跟\|和\|给\|拉\|陪\|点给\|等)[^，。？!！]{0,6}谁/` | 与「你想跟谁……」「想拉谁……」「想点给谁……」**同一句式骨架**：连接词（跟/和/给/拉/陪/点给/等）**必须显式出现**（这排除了 `257`「想不想凑近谁」这类 yes/no 意愿问句）。 |
 * | `abChoice`（A/B 类＝封闭选项骨架） | `/还是/` | 题面把答案构造成「A 还是 B（／C）」的**封闭选项**骨架（含两选一与三选一）。 |
 * | `bodyPart`（身体部位／身体接触） | 题面命中身体词表 `/手\|肩\|头发\|腰\|颈\|耳\|唇\|胸\|背\|腿\|臂\|掌\|腕\|膝\|脚\|抱\|碰\|牵\|吻\|亲\|贴/` **或** planning `category === "body_preference"` | 词表**刻意排除**「头／眼／脸／嘴／身」等高频歧义词（如「第一眼」「单身」「嘴硬」会误命中）；`category` 侧兜住「注意异性的哪里」这类不提部位名的身体题。 |
 * | `yesNo`（yes/no 类） | planning `expectedAnswerShape === "yes_no"` **或** 题面命中 `/吗？\|吗?\|想不想\|有没有\|会不会\|是不是/` | 答案期望是/否（可含「想不想」式意愿问句）。 |
 *
 * > 规则是**必要条件式的显式判据**：命中即入类，不命中的卡不做反向断言。判据只读**题面**
 * > 与既有 planning 字段，**不引入任何未登记的相似度模型**，逐卡可与本表逐条对账。
 *
 * ## 只读 / 不改内容（本单红线）
 * - 本脚本**只读** Formal 卡源与 planning 元数据；⛔ 不改任何卡、不改准入、不改阈值、不改测试。
 * - 「选谁」类多 **不构成** 推翻这些卡的理由；本报告只出诊断，内容裁决属后续单。
 *
 * ## 口径
 * 「当前 Formal 全池」= `mainlineSsotCardsByPack("truth-dare")` ∩ manifest 真源 `formalFixedIdSet()`
 * （不按 `PN-TRUTH-2*` 前缀推断），与生产牌堆同一卡源。
 *
 * ## 确定性（可 `shasum` 自证）
 * 产物**不含时间戳 / 随机量**；同输入两次运行字节一致。`sourceFingerprint` 为「卡片 id＋题面」
 * 规范序列化的 sha256，用作输入指纹与漂移检测。
 *
 * 运行：`npx vite-node -c vitest.config.ts scripts/audit-formal-truth-skeleton-cluster.ts`
 * 产物：`docs/qa/content-audit/PACK1-SKELETON-CLUSTER.json`（机器真源）
 *       ＋ `docs/qa/content-audit/PACK1-SKELETON-CLUSTER.md`（人读报告，本文件为 json 的渲染）
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

import { formalFixedIdSet } from "@/lib/v2-content/fixed-content-manifest";
import { PACK1_ADMISSION_CARD_BY_ID } from "@/lib/v2-content/pack1-admission";
import { mainlineCardMetaById, mainlineSsotCardsByPack } from "@/lib/v2-content/v2-card-bridge";

const ROOT = process.cwd();
const PACK_ID = "truth-dare";
const JSON_PATH = `${ROOT}/docs/qa/content-audit/PACK1-SKELETON-CLUSTER.json`;
const MD_PATH = `${ROOT}/docs/qa/content-audit/PACK1-SKELETON-CLUSTER.md`;
const GENERATED_BY = "scripts/audit-formal-truth-skeleton-cluster.ts";

/** cluster 判据（唯一真源；与文件头表格逐条对应，改判据只改这里）。 */
const RULES = {
  selectWho: {
    label: "「选谁」／点名对象",
    pattern: "谁|哪位|哪一位|哪个人|哪个微信",
    note: "答案必须点名一个具体对象；`谁都` 为任指（如 233「看谁都顺眼」）不算；「哪种人／哪一类」属类型选择，不算。",
  },
  selectWhoSameFrame: {
    label: "「想…谁」同骨架（selectWho 子集）",
    pattern: "(想|要|打算)(跟|和|给|拉|陪|点给|等)[^，。？!！]{0,6}谁",
    note: "与「你想跟谁……／想拉谁……／想点给谁……」同一句式骨架；连接词（跟/和/给/拉/陪/点给/等）必须显式出现。",
  },
  abChoice: {
    label: "A/B 类（封闭选项骨架）",
    pattern: "还是",
    note: "题面把答案构造成「A 还是 B（／C）」的封闭选项（含两选一与三选一）。",
  },
  bodyPart: {
    label: "身体部位／身体接触",
    pattern: "手|肩|头发|腰|颈|耳|唇|胸|背|腿|臂|掌|腕|膝|脚|抱|碰|牵|吻|亲|贴",
    note: "词表刻意排除「头／眼／脸／嘴／身」等高频歧义词；category=body_preference 亦计入。",
  },
  yesNo: {
    label: "yes/no 类",
    pattern: "吗？|吗\\?|想不想|有没有|会不会|是不是",
    note: "expectedAnswerShape=yes_no 亦计入。",
  },
} as const;

type ClusterKey = keyof typeof RULES;

const RE_SELECT_WHO = new RegExp(RULES.selectWho.pattern, "u");
const RE_SELECT_WHO_SAME_FRAME = new RegExp(RULES.selectWhoSameFrame.pattern, "u");
/** 任指「谁都」排除项（如 233「看谁都顺眼」不是点名对象）。 */
const RE_SELECT_WHO_ANY = /谁都/u;
const RE_AB_CHOICE = new RegExp(RULES.abChoice.pattern, "u");
const RE_BODY_PART = new RegExp(RULES.bodyPart.pattern, "u");
const RE_YES_NO = new RegExp(RULES.yesNo.pattern, "u");

/** 逐卡判 cluster（显式、纯函数；命中即入，允许一卡多类）。 */
function clustersFor(card: {
  text: string;
  category: string | null;
  expectedAnswerShape: string | null;
}): ClusterKey[] {
  const hits: ClusterKey[] = [];
  if (RE_SELECT_WHO.test(card.text) && !RE_SELECT_WHO_ANY.test(card.text)) hits.push("selectWho");
  if (RE_SELECT_WHO_SAME_FRAME.test(card.text)) hits.push("selectWhoSameFrame");
  if (RE_AB_CHOICE.test(card.text)) hits.push("abChoice");
  if (RE_BODY_PART.test(card.text) || card.category === "body_preference") hits.push("bodyPart");
  if (card.expectedAnswerShape === "yes_no" || RE_YES_NO.test(card.text)) hits.push("yesNo");
  return hits;
}

/* ------------------------------ 读当前 Formal 全池 ------------------------------ */

const formalIdSet = formalFixedIdSet();
const pool = mainlineSsotCardsByPack(PACK_ID)
  .filter((card) => formalIdSet.has(card.id))
  .map((card) => {
    const admission = PACK1_ADMISSION_CARD_BY_ID.get(card.id) as Record<string, unknown> | undefined;
    const meta = mainlineCardMetaById(card.id) as Record<string, unknown> | undefined;
    const category = (admission?.category as string | undefined) ?? null;
    const expectedAnswerShape = (admission?.expectedAnswerShape as string | undefined) ?? null;
    const followUpHook = (admission?.followUpHook as string | undefined) ?? null;
    return {
      cardId: card.id,
      text: card.content,
      heatMin: (meta?.heatMin as number | undefined) ?? null,
      category,
      expectedAnswerShape,
      followUpHook,
    };
  });

if (pool.length === 0) {
  console.error("✗ Formal 全池为空：formalFixedIdSet() ∩ 生产牌堆无交集，拒绝产出空报告。");
  process.exit(1);
}

interface Row {
  readonly cardId: string;
  readonly text: string;
  readonly heatMin: number | null;
  readonly category: string | null;
  readonly expectedAnswerShape: string | null;
  readonly clusters: readonly ClusterKey[];
}

const rows: Row[] = pool.map((card) => ({
  cardId: card.cardId,
  text: card.text,
  heatMin: card.heatMin,
  category: card.category,
  expectedAnswerShape: card.expectedAnswerShape,
  clusters: clustersFor(card),
}));

/* --------------------------------- 汇总（派生） --------------------------------- */

const clusterCounts = Object.fromEntries(
  (Object.keys(RULES) as ClusterKey[]).map((key) => [
    key,
    rows.filter((row) => row.clusters.includes(key)).map((row) => row.cardId),
  ]),
) as Record<ClusterKey, string[]>;

const total = rows.length;
const count = (key: ClusterKey): number => clusterCounts[key].length;
const pct = (key: ClusterKey): number => Math.round((count(key) / total) * 1000) / 10;
/** 卡号显示：去掉 `PN-TRUTH-` 前缀，便于对账。 */
const shortIds = (ids: readonly string[]): string => ids.map((id) => id.replace(/^PN-TRUTH-/u, "")).join(" / ");

// 结论文字**由实测派生**（数字插值），不允许硬编码与数据打架的结论。
const note =
  `对当前 Formal 全池 ${total} 张统计：「选谁／点名对象」${count("selectWho")} 张（${pct("selectWho")}%），` +
  `其中「想…谁」同骨架 ${count("selectWhoSameFrame")} 张；A/B 类（封闭选项）${count("abChoice")} 张（${pct("abChoice")}%）；` +
  `身体部位／身体接触 ${count("bodyPart")} 张（${pct("bodyPart")}%）；yes/no ${count("yesNo")} 张（${pct("yesNo")}%）。` +
  `同骨架「选谁」类占 Formal 全池 ${pct("selectWho")}%，已构成可感知的题面同质化风险。`;

const POLICY_LINE = "第二包禁止继续大量堆「选谁」（同骨架点名对象类）——需要新的答案骨架分流。";
const DIAGNOSIS_ONLY_LINE =
  "本报告只出诊断：⛔ 不因「选谁」多而推翻这些卡，也不改任何卡片内容 / 准入 / 阈值（内容裁决属后续单）。";

/**
 * P2 登记：**「选谁」骨架的收敛风险**（`RESEARCH_REVIEW-PACK1-FINAL-54.md` §专项 2）。
 *
 * ⚠️ 组成：本字段里的**收敛子集（7 张）**是产品主审的**人读判定**（登记事实）；
 * 报告里各项 cluster 的**张数 / 卡号一律由本脚本现算**（`clusters` / `counts` / `rows`），
 * ⛔ 不得手填数字，也⛔不得把本段当作机检判据。
 */
const P2_SELECT_WHO_REGISTRATION = {
  source: "docs/review/RESEARCH_REVIEW-PACK1-FINAL-54.md §专项 2（选谁骨架 cluster）",
  verdict: "不退卡（9 张 hook 真值 ＋ 单卡质量均过线；弱卡不保送 ≠ 强行退卡凑数）",
  /** 审查登记的收敛子集（7 张，人读判定：真人游玩高度收敛于同一暧昧对象）。 */
  reviewerRegisteredSubset: ["PN-TRUTH-251", "PN-TRUTH-257", "PN-TRUTH-273", "PN-TRUTH-276", "PN-TRUTH-279", "PN-TRUTH-280", "PN-TRUTH-281"],
  mostCertainPairs: [
    "280 vs 281（点歌 vs 共饮，几乎必同人）",
    "273 vs 281（一起走 vs 一起喝完，极大概率同人）",
    "279 vs 251（要微信 vs 第一眼注意，高概率同人）",
  ],
  /** 分流项（审查认定为真异轴 / 可分流，不计入收敛子集）。 */
  divertingCards: ["PN-TRUTH-274（队友）", "PN-TRUTH-275（对手）", "PN-TRUTH-255（反向选择，答案天然不同）"],
  limitSuggestion:
    "第二包禁止继续大量堆「选谁」；建议后续单局内选谁类限流（如单局 ≤2 张）或 280 / 281 / 273 三选一轮换 —— 交编排者裁决，本报告不执行。",
} as const;

const sourceFingerprint = createHash("sha256")
  .update(JSON.stringify(rows.map((row) => [row.cardId, row.text])))
  .digest("hex");

/* ----------------------------------- 产物 ----------------------------------- */

const payload = {
  source: `${PACK_ID} 生产牌堆 ∩ manifest formalFixedIdSet()（当前 Formal 全池）`,
  scope: "current-formal-fixed-pool",
  totalFormal: total,
  sourceFingerprint,
  rules: RULES,
  clusters: clusterCounts,
  counts: Object.fromEntries((Object.keys(RULES) as ClusterKey[]).map((key) => [key, count(key)])),
  rows,
  note,
  conclusionPolicy: POLICY_LINE,
  diagnosisOnly: DIAGNOSIS_ONLY_LINE,
  p2SelectWhoConvergence: P2_SELECT_WHO_REGISTRATION,
  generatedBy: GENERATED_BY,
};

writeFileSync(JSON_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

const md: string[] = [];
md.push("# PACK1-SKELETON-CLUSTER｜Formal 全池「同 answer-shape cluster」骨架审计");
md.push("");
md.push(`> 由 \`${GENERATED_BY}\` 生成（确定性：无时间戳 / 无随机量）；本文件是 \`PACK1-SKELETON-CLUSTER.json\` 的渲染。`);
md.push(`> Formal 全池 \`${total}\` 张｜输入指纹 \`${sourceFingerprint.slice(0, 16)}…\`（sha256 of cardId+题面）。`);
md.push("");
md.push("## 0. 结论（由实测派生）");
md.push("");
md.push(note);
md.push("");
md.push(`- ${POLICY_LINE}`);
md.push(`- ${DIAGNOSIS_ONLY_LINE}`);
md.push("");
md.push("## 0.1 P2 登记：「选谁」骨架的收敛风险（审查登记事实 ＋ 机检计数分列）");
md.push("");
md.push(`> 来源：${P2_SELECT_WHO_REGISTRATION.source}。`);
md.push("");
md.push(
  `- **机检计数（本脚本现算）**：「选谁／点名对象」\`selectWho\` 共 **${count("selectWho")} 张**` +
    `（${shortIds(clusterCounts.selectWho)}），其中同骨架子集 ${count("selectWhoSameFrame")} 张。`,
);
md.push(
  `- **审查登记的收敛子集（人读判定，7 张）**：` +
    `${shortIds(P2_SELECT_WHO_REGISTRATION.reviewerRegisteredSubset)} —— 真人游玩高度收敛于**同一暧昧对象**。`,
);
md.push(`- **最必然对**：${P2_SELECT_WHO_REGISTRATION.mostCertainPairs.join("；")}。`);
md.push(`- **分流项（不计入收敛子集）**：${P2_SELECT_WHO_REGISTRATION.divertingCards.join("；")}。`);
md.push(`- **结论**：${P2_SELECT_WHO_REGISTRATION.verdict}。`);
md.push(`- **限流建议（登记，不在本报告执行）**：${P2_SELECT_WHO_REGISTRATION.limitSuggestion}`);
md.push("");
md.push("## 1. 骨架判定规则（可复算、可审计）");
md.push("");
md.push("| cluster | 判据（正则 / 字段） | 说明 |");
md.push("|---|---|---|");
for (const key of Object.keys(RULES) as ClusterKey[]) {
  const rule = RULES[key];
  const extra =
    key === "bodyPart"
      ? ', 或 planning 字段 `category === "body_preference"`'
      : key === "yesNo"
        ? ', 或 planning 字段 `expectedAnswerShape === "yes_no"`'
        : "";
  md.push(`| \`${key}\`（${rule.label}） | \`${rule.pattern.replace(/\|/gu, "\\|")}\`${extra} | ${rule.note} |`);
}
md.push("");
md.push("> 规则只读**题面**与既有 planning 字段；⛔ 不引入未登记的相似度模型。逐卡可与 §3 表逐条对账。");
md.push("");
md.push("## 2. 各类张数与卡号（派生）");
md.push("");
md.push("| cluster | 张数 | 占比 | 卡号 |");
md.push("|---|---|---|---|");
for (const key of Object.keys(RULES) as ClusterKey[]) {
  md.push(`| ${RULES[key].label}（\`${key}\`） | ${count(key)} | ${pct(key)}% | ${shortIds(clusterCounts[key])} |`);
}
md.push("");
md.push(`> 「（\`selectWhoSameFrame\`）」是「选谁」的子集，**不重复计入总数**：它单独列出的是与「你想跟谁……」同一句式骨架的那批。`);
md.push("");
md.push("### 2.1 A/B 类按答案形状细分（派生）");
md.push("");
{
  const abRows = rows.filter((row) => row.clusters.includes("abChoice"));
  const byShape = new Map<string, string[]>();
  for (const row of abRows) {
    const key = row.expectedAnswerShape ?? "（未登记）";
    const bucket = byShape.get(key);
    if (bucket) bucket.push(row.cardId);
    else byShape.set(key, [row.cardId]);
  }
  md.push("| expectedAnswerShape | 张数 | 卡号 |");
  md.push("|---|---|---|");
  for (const [shape, ids] of [...byShape.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    md.push(`| ${shape} | ${ids.length} | ${shortIds(ids)} |`);
  }
  md.push("");
  md.push(
    `> A/B 类共 ${abRows.length} 张（含两选一与三选一）；上表按 planning \`expectedAnswerShape\` 细分，便于后续单判「二选一是否过多」。`,
  );
  const abNearMiss = rows.filter(
    (row) => row.expectedAnswerShape === "binary" && !row.clusters.includes("abChoice"),
  );
  md.push(
    `> 近似命中（planning \`expectedAnswerShape=binary\` 但未用「还是」、故**未计入** A/B 类）${abNearMiss.length} 张：` +
      `${shortIds(abNearMiss.map((row) => row.cardId)) || "—"}。`,
  );
  md.push("");
}
md.push("## 3. 逐卡明细（全 Formal 池）");
md.push("");
md.push("| cardId | 档位 | category | shape | 命中 cluster | 题面 |");
md.push("|---|---|---|---|---|---|");
for (const row of rows) {
  md.push(
    `| ${row.cardId.replace(/^PN-TRUTH-/u, "")} | ${row.heatMin === null ? "—" : `H${row.heatMin}`} | ${row.category ?? "—"} | ${row.expectedAnswerShape ?? "—"} | ${row.clusters.join(", ") || "—"} | ${row.text.replace(/\|/gu, "\\|")} |`,
  );
}
md.push("");
md.push("## 4. 口径与边界");
md.push("");
md.push("- 「当前 Formal 全池」= 生产牌堆 ∩ manifest `formalFixedIdSet()`（不按 `PN-TRUTH-2*` 前缀推断）。");
md.push("- 一卡可同时命中多个 cluster（如既有 A/B 又有身体词）；本表**不做互斥切分**，按命中即入。");
md.push("- 逐卡 `text` / `category` / `expectedAnswerShape` 均来自只读内容源与 planning 元数据，未改动任何卡。");
md.push("");
md.push(`*本报告只出诊断，不改内容；产物可重复运行且字节稳定（\`shasum -a 256\` 自证）。*`);
md.push("");

writeFileSync(MD_PATH, md.join("\n"), "utf8");

console.log(`✓ 骨架聚类审计已生成：`);
console.log(`  json: ${JSON_PATH}`);
console.log(`  md  : ${MD_PATH}`);
console.log(`  Formal 全池: ${total}`);
for (const key of Object.keys(RULES) as ClusterKey[]) {
  console.log(`  ${key.padEnd(20)}: ${count(key)}（${pct(key)}%）→ ${shortIds(clusterCounts[key]) || "—"}`);
}
console.log(`  sourceFingerprint: ${sourceFingerprint}`);
