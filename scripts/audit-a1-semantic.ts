/**
 * Phase A.2｜语义复核（semanticHits）落地（只读输入 → 机械产出）
 *
 * 输入（只读）：
 *   docs/qa/content-audit/_semantic/input.jsonl   350 题题面（两名 reviewer 拿到的同一份输入）
 *   docs/qa/content-audit/_semantic/s1.jsonl      reviewer#1 命中（只记命中，未命中不落行）
 *   docs/qa/content-audit/_semantic/s2.jsonl      reviewer#2 命中
 *   docs/qa/content-audit/_semantic/adjudication.jsonl  第三方独立仲裁（由 opencode 产出）
 *   docs/qa/content-audit/_semantic/independent-scan.CREDENTIAL.json  独立扫描机器凭证（判定「扫描完成」的唯一依据）
 *   docs/qa/content-audit/GAP-LITERAL.json        词面命中真源（literalHits）
 *
 * 产出：
 *   docs/qa/content-audit/_semantic/adjudication-input.jsonl   待仲裁样本（本脚本生成）
 *   docs/qa/content-audit/GAP-SEMANTIC.json                    语义命中终版（报告统一引用此文件）
 *
 * 硬性纪律：
 *  - 所有数字由本脚本从磁盘入力机械计算，**不手写**；
 *  - 两个 reviewer 一致（集合相同、同一 card 的 level 相同）才算一致；
 *  - 一方命中 / 一方未命中，或同一 card level 不同 → 必须进仲裁，未仲裁不得下结论；
 *  - semanticHits==0 只有在「两名 reviewer 全库扫下来都是 0 且无待仲裁分歧」时才允许写「语义空白」；
 *  - 任何情况下都不允许把「词面 0 命中」单独当成主题空白的证据（report 侧再校验一次）；
 *  - **「第三方独立扫描已完成」只能由非空机器凭证证明，禁止用载荷文件是否存在判定**
 *    （_semantic/independent-scan.jsonl 在 0 命中时就是 0 字节，误删后重新 touch 与「扫描完成」无法区分）；
 *    凭证与当前 SSOT / 查询集任一不符 → fail-closed 抛错、非 0 退出，不回退成 existsSync。
 *
 * 用法：
 *   npx tsx scripts/audit-a1-semantic.ts            （默认）算一致性 + 写 adjudication-input + 汇总终版（并 fail-closed 校验扫描凭证）
 *   npx tsx scripts/audit-a1-semantic.ts --emit-scan-credential
 *                                                   仅在**真的完成一次新扫描**后用：按当前 SSOT/查询集/载荷重算并（重）签凭证
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { cohenKappa } from "./audit-a1-kappa";
import {
  emitScanCredential,
  normalizedQuerySet,
  verifyScanCredential,
  type ScanCredential,
  type SsotCard,
} from "./audit-a1-scan-credential";

const ROOT = process.cwd();
const DIR = `${ROOT}/docs/qa/content-audit`;
const SEM = `${DIR}/_semantic`;

/** A.2：命令行。默认校验；--emit-scan-credential 显式重签凭证（不得作为常规运行路径）。 */
const ARGV = process.argv.slice(2);
const EMIT_SCAN_CREDENTIAL = ARGV.includes("--emit-scan-credential");
for (const a of ARGV) {
  if (a !== "--emit-scan-credential") throw new Error(`未知参数：${a}（只接受 --emit-scan-credential）`);
}

interface Hit { cardId: string; theme: string; level: "explicit" | "implicit"; evidence: string; }
interface Row { cardId: string; gameType: string; text: string; }
interface GapTheme { theme: string; literalHits: number; cardIds: string[]; matchedPatterns: { label: string; count: number }[]; }

const readJsonl = <T>(p: string): T[] =>
  readFileSync(p, "utf8").split("\n").filter((l) => l.trim().length > 0).map((l) => JSON.parse(l) as T);

const input = readJsonl<Row>(`${SEM}/input.jsonl`);
const byId = new Map(input.map((r) => [r.cardId, r]));
const N = input.length;

/** theme 名归一：s1/s2 写「亲密 / 性观念」，GAP-LITERAL 写「亲密/性观念」，去空格统一。 */
const norm = (s: string) => s.replace(/\s+/g, "");
const s1 = readJsonl<Hit>(`${SEM}/s1.jsonl`).map((h) => ({ ...h, theme: norm(h.theme) }));
const s2 = readJsonl<Hit>(`${SEM}/s2.jsonl`).map((h) => ({ ...h, theme: norm(h.theme) }));
const gap = JSON.parse(readFileSync(`${DIR}/GAP-LITERAL.json`, "utf8")) as { themes: GapTheme[]; cardCount: number };
const THEMES = gap.themes.map((t) => norm(t.theme));

const setOf = (hits: Hit[], theme: string) => new Set(hits.filter((h) => h.theme === theme).map((h) => h.cardId));
const levelOf = (hits: Hit[], theme: string, cardId: string) =>
  hits.find((h) => h.theme === theme && h.cardId === cardId)?.level ?? null;

/* ------------------------------------------------------------------ */
/* 1. 一致性：per-theme raw agreement / Jaccard / Cohen κ（二值：命中与否） */
/* ------------------------------------------------------------------ */
interface ThemeAgreement {
  theme: string;
  s1Hits: number; s2Hits: number;
  intersection: number; union: number;
  jaccard: number;               // 0/0 时约定记 1（两个 reviewer 都判 0 命中）
  rawAgreement: number;          // 350 题逐题二值一致率（含“都没命中”也算一致）
  cohenKappa: number;            // 350 题二值 Cohen κ；Pe>=1 时记 1
  levelDisagreements: string[];  // 同 card 两侧 level 不同
  onlyS1: string[]; onlyS2: string[];
  disagreedCards: string[];      // 进入仲裁的 card（并集去重）
}
const agreement: ThemeAgreement[] = THEMES.map((theme) => {
  const a = setOf(s1, theme);
  const b = setOf(s2, theme);
  const inter = [...a].filter((c) => b.has(c));
  const onlyS1 = [...a].filter((c) => !b.has(c));
  const onlyS2 = [...b].filter((c) => !a.has(c));
  const levelDisagreements = inter.filter((c) => levelOf(s1, theme, c) !== levelOf(s2, theme, c));
  const union = inter.length + onlyS1.length + onlyS2.length;
  /* 二值 Cohen κ：把 350 题都当样本，命中=YES，未命中=NO。 */
  const yesNo = (hits: Set<string>, cardId: string) => (hits.has(cardId) ? "命中" : "未命中");
  const pairs: [string, string][] = input.map((r) => [yesNo(a, r.cardId), yesNo(b, r.cardId)]);
  const c = cohenKappa(pairs);
  const bothYes = inter.length;
  const bothNo = N - union;
  const disagreedCards = [...new Set([...onlyS1, ...onlyS2, ...levelDisagreements])].sort();
  return {
    theme,
    s1Hits: a.size, s2Hits: b.size,
    intersection: inter.length, union,
    jaccard: union === 0 ? 1 : +(inter.length / union).toFixed(4),
    rawAgreement: +((bothYes + bothNo) / N).toFixed(4),
    cohenKappa: c.value,
    levelDisagreements: [...levelDisagreements].sort(),
    onlyS1: [...onlyS1].sort(), onlyS2: [...onlyS2].sort(),
    disagreedCards,
  };
});

/* ------------------------------------------------------------------ */
/* 2. 待仲裁样本（分歧 + 需核实是否元话的命中）                            */
/* ------------------------------------------------------------------ */
interface AdjInput { cardId: string; theme: string; text: string; reason: string; question: string; }
const adjInput: AdjInput[] = [];
for (const a of agreement) {
  for (const cid of a.disagreedCards) {
    const in1 = a.onlyS1.includes(cid) || a.levelDisagreements.includes(cid);
    const why = in1
      ? "两名 reviewer 对同一 (cardId, theme) 判定不同：一方命中一方未命中，或 level(explicit/implicit) 不一致"
      : "两名 reviewer 对同一 (cardId, theme) 判定不同：一方命中一方未命中";
    adjInput.push({
      cardId: cid,
      theme: a.theme,
      text: byId.get(cid)?.text ?? "（题面缺失）",
      reason: why,
      question: `题面是否承载「${a.theme}」这一主题？请判 HIT_EXPLICIT / HIT_IMPLICIT / NO_HIT。`,
    });
  }
}
/* 已一致命中、但按 A.2 要求须核实「是否只是元话」的主题（具体兴趣爱好）。 */
const META_CHECK_THEMES = ["具体兴趣爱好"];
for (const a of agreement) {
  if (!META_CHECK_THEMES.includes(a.theme)) continue;
  const agreedHitCards = [...new Set([...setOf(s1, a.theme), ...setOf(s2, a.theme)])].sort();
  for (const cid of agreedHitCards) {
    adjInput.push({
      cardId: cid,
      theme: a.theme,
      text: byId.get(cid)?.text ?? "（题面缺失）",
      reason: "两名 reviewer 都判命中，但 A.2 要求核实是否只是「共同兴趣」这类元话（只指人/只说要问，不落到具体爱好内容）",
      question: "这张题面是**真的在问具体兴趣爱好**（要求答出具体的爱好/活动/偏好内容），还是只是「共同兴趣」这类**元话**（只指人、或只说“想问他什么”，本身不落到具体爱好内容）？请额外给出 realTopic: true/false 与一句理由。",
    });
  }
}
/* 去重：同一 (cardId, theme) 只进一条（分歧与元话核实可能命中同一张）。 */
const seenKey = new Set<string>();
const adjInputDedup = adjInput.filter((a) => {
  const k = `${a.cardId}::${a.theme}`;
  if (seenKey.has(k)) return false;
  seenKey.add(k);
  return true;
});
writeFileSync(`${SEM}/adjudication-input.jsonl`, adjInputDedup.map((a) => JSON.stringify(a)).join("\n") + "\n");

/* ------------------------------------------------------------------ */
/* 3b. 主题再拆分（「亲密/性观念」→ 互动动作 vs 边界/性观念）                 */
/* ------------------------------------------------------------------ */
/**
 * 为什么拆：主题名「亲密/性观念」把**身体互动动作**与**亲密边界/性观念态度**混成一个数字，
 * 会误导 Human 拍板（用户 NEW CODE 反馈点名缺的恰是「亲密/**性观念**」）。A.2 收口用独立第三方
 * （opencode，只看题面）对「该主题的 semanticHits ∪ literalHits」逐题二分，重新统计。
 *
 * 硬性纪律：分类结果**不得由本脚本臆造**——只有真源 `_semantic/theme-split.jsonl` 存在、
 * 且 cardId 集合与预期（语义命中 ∪ 词面命中）逐字一致时才写入 subthemes；否则记 `splitPending`
 * （fail-closed，不静默给 0 / 不给结论）。
 */
const THEME_SPLIT_PATH = `${SEM}/theme-split.jsonl`;
const SPLIT_TARGET = "亲密/性观念";
const SPLIT_CATEGORIES = ["亲密互动/肢体动作", "亲密边界/性观念"] as const;
interface SplitRow { cardId: string; category: string; reason?: string; }
const splitRows: SplitRow[] | null = existsSync(THEME_SPLIT_PATH)
  ? readJsonl<SplitRow>(THEME_SPLIT_PATH).map((r) => ({ ...r }))
  : null;

/* ------------------------------------------------------------------ */
/* 4. 读仲裁结果（若有），汇总 semanticHits                                */
/* ------------------------------------------------------------------ */
interface AdjOut { cardId: string; theme: string; verdict: "HIT_EXPLICIT" | "HIT_IMPLICIT" | "NO_HIT"; realTopic?: boolean; reason?: string; }
const ADJ_PATH = `${SEM}/adjudication.jsonl`;
const adjudication: AdjOut[] = existsSync(ADJ_PATH)
  ? readJsonl<AdjOut>(ADJ_PATH).map((a) => ({ ...a, theme: norm(a.theme) }))
  : [];
const adjByKey = new Map(adjudication.map((a) => [`${a.cardId}::${a.theme}`, a]));

/**
 * 第三方独立全库扫描（只对 5 个零命中主题做额外佐证；0 行 = 0 命中）。
 *
 * **判定「扫描完成」只认机器凭证，不认「载荷文件存在」**：
 * 0 命中时载荷 `independent-scan.jsonl` 本身就是 0 字节（历史证据，必须保留），
 * 文件存在/被 touch 与「扫描完成且 0 命中」无法区分，故一律以
 * `independent-scan.CREDENTIAL.json`（非空 + completed + sourceHash + querySetHash 全部可复算）为准。
 * 任一不符 → 抛错（非 0 退出），**不回退成 existsSync 判定**。
 */
const SSOT_PATH = `${ROOT}/lib/v2-content/generated/v2-ssot.generated.json`;
const SCAN_PATH = `${SEM}/independent-scan.jsonl`;
const SCAN_CREDENTIAL_PATH = `${SEM}/independent-scan.CREDENTIAL.json`;
const ssotCards = (JSON.parse(readFileSync(SSOT_PATH, "utf8")) as { mainlineCards: SsotCard[] }).mainlineCards;
/* 查询集口径 = 当前 GAP-LITERAL 中 literalHits===0 的主题（与独立扫描所问的 5 个主题一致）。 */
const zeroHitThemes = gap.themes.filter((t) => t.literalHits === 0).map((t) => t.theme);
const scanInputs = { ssotCards, zeroHitThemes };
if (EMIT_SCAN_CREDENTIAL) {
  const c = emitScanCredential(SCAN_CREDENTIAL_PATH, SCAN_PATH, scanInputs);
  console.log(`[scan-credential] 已重签：sourceHash=${c.sourceHash} querySetHash=${c.querySetHash} resultCount=${c.resultCount}`);
}
const scanEvidence = verifyScanCredential(SCAN_CREDENTIAL_PATH, SCAN_PATH, scanInputs);
const scanCredential: ScanCredential = scanEvidence.credential;
const independentScan: Hit[] = readJsonl<Hit>(SCAN_PATH).map((h) => ({ ...h, theme: norm(h.theme) }));
const scanHitsOf = (theme: string): number => setOf(independentScan, theme).size;

/** 终版 semanticHits：以「三方合一」为准——两人一致且命中 → 命中；有分歧 → 取仲裁终判。 */
interface ThemeFinal {
  theme: string;
  literalHits: number;
  literalCardIds: string[];
  semanticHits: number;
  semanticCardIds: string[];
  adjudicatedCount: number;
  adjudicationPending: number;
  independentScanHits: number | null;
  semanticSource: "both-reviewers-agree" | "adjudicated" | "mixed" | "pending-adjudication";
  wording: string;
  /**
   * 主题再拆分（仅「亲密/性观念」）：semanticHits ∪ literalHits 的并集按第三方独立判定二分。
   * 真源 `_semantic/theme-split.jsonl`；分类不由本脚本臆造——集合不符即记 pending/mismatch，不给结论。
   */
  subthemes?: { category: string; count: number; cardIds: string[] }[];
  subthemeSplit?: {
    state: "ok" | "pending" | "mismatch";
    judgedTotal: number;
    expectedTotal: number;
    cardIdsMatch: boolean;
    categories: string[];
    note: string;
  };
}
const finals: ThemeFinal[] = THEMES.map((theme) => {
  const a = agreement.find((x) => x.theme === theme)!;
  const gt = gap.themes.find((t) => norm(t.theme) === theme)!;
  const agreed = [...new Set([...setOf(s1, theme)].filter((c) => setOf(s2, theme).has(c)))].sort();
  const pending: string[] = [];
  const resolved = new Set<string>(agreed);
  let adjudicatedCount = 0;
  /* (a) 分歧样本：以仲裁终判决定是否命中。 */
  for (const cid of a.disagreedCards) {
    const adj = adjByKey.get(`${cid}::${theme}`);
    if (!adj) { pending.push(cid); continue; }
    adjudicatedCount += 1;
    if (adj.verdict !== "NO_HIT") resolved.add(cid); else resolved.delete(cid);
  }
  /* (b) 已一致命中、但需核实元话的样本（如「具体兴趣爱好」）：仲裁判元话则剔除。 */
  for (const cid of agreed) {
    const adj = adjByKey.get(`${cid}::${theme}`);
    if (!adj) continue;
    adjudicatedCount += 1;
    if (META_CHECK_THEMES.includes(theme) && adj.realTopic === false) resolved.delete(cid);
    else if (adj.verdict === "NO_HIT") resolved.delete(cid);
  }
  const semanticCardIds = [...resolved].sort();
  const semanticHits = semanticCardIds.length;
  const literalHits = gt.literalHits;
  const allAgreedEmpty = a.s1Hits === 0 && a.s2Hits === 0 && a.disagreedCards.length === 0;
  const scanHits = scanHitsOf(theme);
  let wording: string;
  let source: ThemeFinal["semanticSource"];
  if (pending.length > 0) {
    source = "pending-adjudication";
    wording = `仍有 ${pending.length} 张待第三方仲裁，**不得下结论**`;
  } else if (semanticHits === 0 && literalHits === 0 && allAgreedEmpty) {
    source = "both-reviewers-agree";
    /* scanHits 由**凭证背书**的独立扫描算出（不再是「载荷文件存在即可」的 null/数字二值）；
       措辞与报告 md 逐字一致，凭证信息只在 method/scanCredential 字段留痕。 */
    wording = scanHits === 0
      ? "语义空白（两名独立 reviewer 的 350 题语义复核 + 第三方独立全库扫描 均为 0 命中，且无待仲裁分歧）"
      : `语义空白（两名独立 reviewer 均为 0 命中；第三方独立扫描 ${scanHits} 命中）`;
  } else if (semanticHits === 0 && literalHits > 0) {
    source = "adjudicated";
    wording = `词面命中 ${literalHits} 题，语义复核终判 0 题`;
  } else if (semanticHits > 0 && literalHits === 0) {
    source = "mixed";
    wording = `词面 0 命中但语义存在 ${semanticHits} 题`;
  } else {
    source = adjudicatedCount > 0 ? "mixed" : "both-reviewers-agree";
    wording = `词面命中 ${literalHits} 题、语义命中 ${semanticHits} 题`;
  }
  return {
    theme, literalHits, literalCardIds: gt.cardIds ?? [],
    semanticHits, semanticCardIds, adjudicatedCount,
    adjudicationPending: pending.length, independentScanHits: scanHits, semanticSource: source, wording,
  };
});

/* ------------------------------------------------------------------ */
/* 5. 主题拆分：把「亲密/性观念」按第三方独立判定分成两类并重新统计            */
/* ------------------------------------------------------------------ */
const SPLIT_NOTE =
  "「亲密/性观念」把身体互动动作与亲密边界/性观念态度混成一个数字，会误导拍板；本拆分由独立第三方" +
  "（opencode / muse-spark-1.3-contributor-free，只看题面、不看任何既有标签）对该主题的 semanticHits ∪ literalHits " +
  "逐题二分，真源 _semantic/theme-split.jsonl。分类不由脚本臆造：cardId 集合与预期不符即记 mismatch，不给结论。";
const splitThemeNorm = norm(SPLIT_TARGET);
const splitTargetFinal = finals.find((t) => t.theme === splitThemeNorm);
if (splitTargetFinal) {
  const expected = [...new Set([...splitTargetFinal.semanticCardIds, ...splitTargetFinal.literalCardIds])].sort();
  const legalCats = new Set<string>(SPLIT_CATEGORIES);
  let state: "ok" | "pending" | "mismatch" = "pending";
  let subthemes: { category: string; count: number; cardIds: string[] }[] = [];
  let judgedTotal = 0;
  let cardIdsMatch = false;
  if (splitRows !== null) {
    judgedTotal = splitRows.length;
    const judged = splitRows.map((r) => r.cardId).sort();
    const distinct = new Set(judged);
    const catsOk = splitRows.every((r) => legalCats.has(r.category));
    cardIdsMatch =
      distinct.size === judged.length &&
      judged.length === expected.length &&
      judged.every((id, i) => id === expected[i]);
    if (cardIdsMatch && catsOk) {
      state = "ok";
      subthemes = SPLIT_CATEGORIES.map((category) => {
        const cardIds = splitRows.filter((r) => r.category === category).map((r) => r.cardId).sort();
        return { category, count: cardIds.length, cardIds };
      });
    } else {
      state = "mismatch";
    }
  }
  splitTargetFinal.subthemes = subthemes;
  splitTargetFinal.subthemeSplit = {
    state,
    judgedTotal,
    expectedTotal: expected.length,
    cardIdsMatch,
    categories: [...SPLIT_CATEGORIES],
    note: SPLIT_NOTE,
  };
}

const out = {
  generator: "scripts/audit-a1-semantic.ts",
  cardCount: N,
  themeCount: THEMES.length,
  sourceFiles: {
    input: "_semantic/input.jsonl",
    reviewer1: "_semantic/s1.jsonl",
    reviewer2: "_semantic/s2.jsonl",
    adjudication: existsSync(ADJ_PATH) ? "_semantic/adjudication.jsonl" : null,
    independentScan: "_semantic/independent-scan.jsonl",
    independentScanCredential: "_semantic/independent-scan.CREDENTIAL.json",
    literal: "GAP-LITERAL.json",
    themeSplit: existsSync(THEME_SPLIT_PATH) ? "_semantic/theme-split.jsonl" : null,
  },
  method: {
    unit: "(cardId, theme) 二元判定；level ∈ {explicit, implicit}",
    agreement: "per-theme raw agreement（350 题二值逐题一致率）+ Jaccard（命中卡集合）+ Cohen κ（350 题二值）",
    adjudication: "凡一方命中一方未命中，或同一 card 的 level 不同，一律抽入 _semantic/adjudication-input.jsonl 交第三方独立仲裁；仲裁者只看题面，不看 s1/s2 结论",
    adjudicationCount: adjudication.length,
    independentScan: "第三方独立全库扫描（opencode / muse-spark-1.3-contributor-free，只看题面）对 5 个零命中主题额外佐证；输出 0 行 = 五主题各 0 命中",
    independentScanCompletion: "「扫描已完成」只由 _semantic/independent-scan.CREDENTIAL.json（非空机器凭证）证明，禁止用载荷文件是否存在判定；凭证与当前 SSOT sourceHash / 零命中主题 querySetHash / resultCount 任一不符即 fail-closed（非 0 退出）",
    themeSplit: SPLIT_NOTE,
    note: "semanticHits==0 只有在两名 reviewer 全库扫下来都是 0 且无待仲裁分歧时才写「语义空白」；词面 0 命中永不单独作为主题空白的证据",
  },
  scanCredential: {
    path: "_semantic/independent-scan.CREDENTIAL.json",
    completed: scanCredential.completed,
    resultCount: scanCredential.resultCount,
    querySetHash: scanCredential.querySetHash,
    sourceHash: scanCredential.sourceHash,
    generatedAt: scanCredential.generatedAt,
    algorithm: scanCredential.algorithm,
    payload: scanCredential.payload,
    payloadLines: scanEvidence.payloadLines,
    payloadBytes: scanEvidence.payloadBytes,
    zeroHitThemes: normalizedQuerySet(zeroHitThemes),
    verified: true,
  },
  agreement,
  themes: finals,
  totals: {
    literalHitsSum: finals.reduce((s, t) => s + t.literalHits, 0),
    semanticHitsSum: finals.reduce((s, t) => s + t.semanticHits, 0),
    adjudicatedSum: finals.reduce((s, t) => s + t.adjudicatedCount, 0),
    semanticBlankThemes: finals.filter((t) => t.wording.startsWith("语义空白")).map((t) => t.theme),
    semanticOnlyThemes: finals.filter((t) => t.semanticHits > 0).map((t) => t.theme),
    themeSplitTarget: SPLIT_TARGET,
    themeSplitState: splitTargetFinal?.subthemeSplit?.state ?? "pending",
  },
  adjudicationInputCount: adjInputDedup.length,
  adjudicationResolved: adjudication.length,
};
writeFileSync(`${DIR}/GAP-SEMANTIC.json`, JSON.stringify(out, null, 2));

console.log(`语义复核｜题面 ${N} 题 × ${THEMES.length} 主题`);
for (const a of agreement) {
  console.log(`  ${a.theme.padEnd(14)} s1=${a.s1Hits} s2=${a.s2Hits} 交集=${a.intersection} raw=${(a.rawAgreement * 100).toFixed(1)}% Jaccard=${a.jaccard} κ=${a.cohenKappa} 待仲裁=${a.disagreedCards.length}`);
}
console.log(`待仲裁样本（含元话核实）：${adjInputDedup.length} 条 → _semantic/adjudication-input.jsonl`);
console.log(`已仲裁：${adjudication.length} 条`);
console.log(
  `独立扫描凭证｜ completed=${scanCredential.completed} resultCount=${scanEvidence.payloadLines}（载荷 ${scanEvidence.payloadBytes} 字节）`
  + ` sourceHash=${scanEvidence.sourceHash} querySetHash=${scanEvidence.querySetHash}（零命中主题 ${normalizedQuerySet(zeroHitThemes).length} 个）`,
);
for (const t of finals) console.log(`  ${t.theme.padEnd(14)} literal=${t.literalHits} semantic=${t.semanticHits} 仲裁=${t.adjudicatedCount} 待仲裁=${t.adjudicationPending} 第三方扫描=${t.independentScanHits ?? "未执行"}｜${t.wording}`);
if (splitTargetFinal?.subthemeSplit) {
  const s = splitTargetFinal.subthemeSplit;
  console.log(`主题拆分｜${SPLIT_TARGET}：【${s.state}】判定 ${s.judgedTotal}/${s.expectedTotal}，cardId 集合一致=${s.cardIdsMatch}`);
  for (const st of splitTargetFinal.subthemes ?? []) console.log(`  ${st.category.padEnd(12)} ${st.count} 张：${st.cardIds.join("、")}`);
}
if (finals.some((t) => t.adjudicationPending > 0)) {
  console.log("\n[PENDING] 仍有待仲裁样本，先在 _semantic/adjudication.jsonl 落第三方结论后重跑本脚本。");
}
if (splitTargetFinal?.subthemeSplit?.state === "mismatch") {
  console.log("\n[PENDING] theme-split.jsonl 的 cardId 集合或 category 取值不合法（fail-closed），subthemes 不给结论。");
}

