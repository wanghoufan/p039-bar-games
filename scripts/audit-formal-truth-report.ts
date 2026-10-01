/**
 * C1-8｜机械生成第一包 MC 报告。A5 起**强制双口径分写**（Human 2026-09-28 冻结）。
 *
 * 输入（按顺序先跑）：
 *   scripts/audit-formal-truth-montecarlo.ts     → FORMAL-TRUTH-MC.json / FORMAL-TRUTH-MC-WORST-TRACE.json
 *   scripts/audit-formal-truth-production-chain.ts → FORMAL-TRUTH-PRODUCTION-CHAIN.json
 * 输出：docs/qa/content-audit/FORMAL-TRUTH-MC.md
 *
 * 双口径（禁止混写，见 HANDOFF §1.4.0）：
 * - **口径 A｜Engine / explicit disclosure**：假设本轮真的收到合法 `roundDisclosureSignal`。
 *   数据源 = MC `modeB` + 生产链「仅 Formal（manifest 轨全部张数）」情形 + 静态每 Heat 桶库存。
 * - **口径 B｜Current real UI**：`app/game/page.tsx#roundDisclosureForCurrentRound()` 恒 `undefined`。
 *   数据源 = MC `modeA`（生产实况：不给任何披露信号）+ 静态 H1 桶可抽 Formal 清单。
 *
 * 所有统计值读自 JSON 产物，报告侧不手写；阈值/门槛从 `v2-state` 逐字读取（不硬编码）。
 * 报告中**任何**「缺口数 / 未到达档 / 能或不能离开某档 / 是否全 I1」都按产物现判（B6 起），
 * 只写数据支持的那一支，缺就如实写缺、不缺就如实写已解除——不允许与实测数据矛盾的硬编码结论。
 */
import { readFileSync, writeFileSync } from "node:fs";

import {
  HEAT_THRESHOLDS,
  MUTUAL_CHECK_COUNTS,
  MUTUAL_MIN_HEAT,
} from "@/lib/v2-relationship/v2-state";

const DIR = `${process.cwd()}/docs/qa/content-audit`;
const mc = JSON.parse(readFileSync(`${DIR}/FORMAL-TRUTH-MC.json`, "utf8"));
const worst = JSON.parse(readFileSync(`${DIR}/FORMAL-TRUTH-MC-WORST-TRACE.json`, "utf8"));
const chain = JSON.parse(readFileSync(`${DIR}/FORMAL-TRUTH-PRODUCTION-CHAIN.json`, "utf8"));

/** 口径 A = Engine / explicit disclosure（MC 的 modeB / 给了合法披露信号）。 */
const ENGINE = mc.modeB;
/** 口径 B = Current real UI（MC 的 modeA / 生产实况，无披露信号）。 */
const UI = mc.modeA;

const thresholdOf = (heat: string): number => HEAT_THRESHOLDS.find((b: { heat: string }) => b.heat === heat)!.min;
const H2_MIN = thresholdOf("H2");
const H3_MIN = thresholdOf("H3");
const H4_MIN = thresholdOf("H4");
const MUTUAL_MIN = MUTUAL_CHECK_COUNTS[0];
const MUTUAL_MAX = MUTUAL_CHECK_COUNTS[MUTUAL_CHECK_COUNTS.length - 1];
const band = (heat: string) => mc.staticHeatAvailability.find((h: { heat: string }) => h.heat === heat);
const H1_BAND = band("H1");
/** 第一包 Formal 总张数（全部由产物派生；报告中一律不得写死「24」「31」这类数字）。 */
const FORMAL_TOTAL = mc.cardSource.formalTotal;
/** 第一包 H1 桶可抽 Formal（heatMin=1）张数与清单（= 当前真实 UI 下唯一进得了桶的 Formal）。 */
const H1_FORMAL_IDS = H1_BAND.formalLegalIds as string[];
const H1_FORMAL_COUNT = H1_FORMAL_IDS.length;
if (H1_FORMAL_COUNT !== (mc.h1Formal.count as number)) {
  throw new Error(
    `MC 产物自相矛盾：staticHeatAvailability.H1.formalLegal=${H1_FORMAL_COUNT} ≠ h1Formal.count=${mc.h1Formal.count}`,
  );
}
/** `heatMin ≤ n` 的 Formal 卡累计数（冷启门结论唯一派生源）。 */
const CUMULATIVE = mc.formalCountableUpTo as { heatMinLe1: number; heatMinLe2: number; heatMinLe3: number; heatMinLe4: number };
/** 冷启门缺口（H2 档）：>0 表示 H1 可计数库存不足。由产物现算，不写死。 */
const H2_SHORTFALL = H2_MIN - H1_FORMAL_COUNT;
const pct2 = (part: number, whole: number) => `${((part / (whole || 1)) * 100).toFixed(1)}%`;

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const heatCells = (m: Record<string, number>) => Object.entries(m).map(([k, v]) => `${k} ${v}`).join(" / ");
const gainCells = (m: Record<string, number>) =>
  Object.keys(m).length === 0 ? "（无）" : Object.entries(m).map(([k, v]) => `${k} ${v}`).join(" / ");
const ids = (list: string[]) => `\`${list.join("`、`")}\``;

/** 生产链情形的终止观测（替代原先写死的「第 N+1 轮起判 PACK_EXHAUSTED」）。 */
interface ChainTerminal { afterRound: number; outcome: string | null }
interface ChainScenario {
  deck: string;
  rounds: { cardId: string; formal: boolean }[];
  finalHeat: string;
  finalEffective: number;
  firstReachRoundByHeat: Record<string, number | null>;
  terminal: ChainTerminal;
  note?: string;
}
const stopText = (scenario: ChainScenario): string =>
  scenario.terminal.outcome === null
    ? `未触发耗尽，共 ${scenario.terminal.afterRound} 轮`
    : `完成 ${scenario.terminal.afterRound} 轮后，第 ${scenario.terminal.afterRound + 1} 轮不再给出题卡（\`${scenario.terminal.outcome}\`）`;
/** 逐档首达 → 已到达 / 未到达的档位清单（全部由产物现算，不写死档名）。 */
const bandsBy = (firstReach: Record<string, number | null>, reached: boolean): string[] =>
  Object.keys(firstReach).filter((heat) => (firstReach[heat] !== null) === reached);
const bandList = (bands: string[]): string => (bands.length === 0 ? "无" : bands.join("/"));

const lines: string[] = [];
const p = (s = "") => lines.push(s);

/* ------------------------------------------------------------------ */
/* 头 + 口径声明                                                        */
/* ------------------------------------------------------------------ */
p("# 第一包「Formal Fixed 真心话」单包 Router Monte Carlo + 最差 trace + 生产链验证（C1-8 / A5 双口径）");
p();
p(`- 生成：\`scripts/audit-formal-truth-report.ts\`（统计值全部读自 JSON 产物，阈值读自 \`v2-state\`，报告侧不手写）`);
p(`- 卡源：\`${mc.cardSource.description}\` —— pack ${mc.cardSource.packTotal} 张（Formal ${mc.cardSource.formalTotal} / legacy ${mc.cardSource.legacyTotal}）`);
p(`- Router：${mc.router}`);
p(`- 参数：${mc.config.tables.length} 桌型 × ${mc.config.sessionsPerTable} 局/桌型 × ${mc.config.targetCompletedRounds} 轮；guard 上限 ${mc.config.guardLimit}；completed 概率 ${mc.config.completedProbability}；软去重窗口 ${mc.config.softDedupWindow}`);
p(`- 单包 = ${mc.packLabel}；不切包（任何耗尽判本局 dead-end，生产单玩局同口径）。`);
p();
p("## 0｜口径声明（先读这一段，禁止混写）");
p();
p("- **口径 A｜Engine / explicit disclosure**：**假设本轮真的收到合法 `roundDisclosureSignal`**（`selfDisclosed + disclosedPlayerIds`，走同一条 `reduceV2SessionEvents` 归约）。数据源 = MC `modeB` ＋ 生产链「仅 Formal " + FORMAL_TOTAL + " 张」情形。");
p("- **口径 B｜Current real UI**：`app/game/page.tsx#roundDisclosureForCurrentRound()` **恒返回 `undefined`** ⇒ 无 effective information round ⇒ **Heat 恒 H1、中途 Mutual（`count≥" + MUTUAL_MIN + "` 且 `Heat≥" + MUTUAL_MIN_HEAT + "`）不可达**。数据源 = MC `modeA`（生产实况：不给任何披露信号）。");
p("- ⛔ **禁止把 A 当 B**：本报告任何「Heat 可达 H2/H3/H4」都**只在口径 A 的静态桶/或 Heat 已在该档时成立**；**当前 UI（口径 B）Heat 恒 H1**，不存在「生产 Heat 已正常推进」这回事。");
p(`- 门槛真源：H2=${H2_MIN} / H3=${H3_MIN} / H4=${H4_MIN}（有效信息轮数）；中途互选窗口 [${MUTUAL_MIN}, ${MUTUAL_MAX}]，最低 ` + "`MUTUAL_MIN_HEAT=" + MUTUAL_MIN_HEAT + "`。");
p(`- 门槛推不动的三个档名、缺口数、可抽集合、最差 trace 全部由本脚本按产物现算；报告中出现的任何结论（含「缺 / 不缺」「能 / 不能离开某档」）都可由同份 JSON 复算，**不接受手写**。`);
p();

/* ------------------------------------------------------------------ */
/* 口径 A                                                              */
/* ------------------------------------------------------------------ */
p("## 1｜口径 A｜Engine / explicit disclosure（假设真的收到合法 roundDisclosureSignal）");
p();
p("### 1.1 静态每 Heat 桶 Formal 库存（**若 Heat 已在该档**；legacy 卡不受 Heat 硬过滤）");
p();
p("| Heat | 包内合法 | 其中 Formal | 其中 legacy |");
p("|---|---|---|---|");
for (const h of mc.staticHeatAvailability) p(`| ${h.heat} | ${h.legalCount} | ${h.formalLegal} | ${h.legacyLegal} |`);
p();
const emptyFormalBands = mc.staticHeatAvailability.filter((h: { formalLegal: number }) => h.formalLegal === 0).map((h: { heat: string }) => h.heat);
p(`> ${emptyFormalBands.length === 0 ? "四档 Formal 桶均**非空**" : `Formal 桶为空档：${emptyFormalBands.join("/")}`}：` + mc.staticHeatAvailability.map((h: { heat: string; formalLegal: number }) => `${h.heat}=${h.formalLegal}`).join(" / ") + "。这是「若 Heat 已在该档」的库存能力，**不等于从 H1 冷启能走到该档**（见 1.2）。");
p();
p("### 1.2 全包真链冷启可达性（全包真实牌堆，两 mode 各 4000 局，每 completed 轮给合法披露）");
p();
p("| 指标 | 口径 A（Engine / 显式 disclosure） |");
p("|---|---|");
p(`| 局数 | ${ENGINE.sessions} |`);
p(`| 跑满 20 轮 | ${ENGINE.sessionsCompleted20}（${pct(ENGINE.sessionRate)}） |`);
p(`| dead-end | ${ENGINE.deadEndSessions}（${pct(ENGINE.deadEndRate)}），终止原因 ${JSON.stringify(ENGINE.termination)} |`);
p(`| Formal 曝光占比 | ${pct(ENGINE.formalShare)}（${ENGINE.formalDraws}/${ENGINE.totalDraws}） |`);
p(`| Formal 曝光卡数 | ${ENGINE.formalExposedDistinct}/${ENGINE.formalTotal} —— ${ids(ENGINE.formalExposedIds)} |`);
p(`| heatAtDraw | ${heatCells(ENGINE.heatAtDraw)} |`);
p(`| 到达 H2 / H3 / H4 局数 | ${ENGINE.sessionsReachingH2} / ${ENGINE.sessionsReachingH3} / ${ENGINE.sessionsReachingH4} |`);
p(`| H2 到达率（到达 H2 的 seed 局比例） | ${ENGINE.sessionsReachingH2}/${ENGINE.sessions}（${pct2(ENGINE.sessionsReachingH2, ENGINE.sessions)}） ⇒ **H2 reach ${ENGINE.sessionsReachingH2 > 0 ? "> 0" : "= 0"}** |`);
p(`| 有效信息轮/局 | ${ENGINE.effectivePerSession} |`);
p(`| 有效轮 gain 分布 | ${gainCells(ENGINE.effectiveByGain)} |`);
p(`| 人物维度覆盖（全样本）/ 每局 | ${ENGINE.distinctTopicsCovered} / ${ENGINE.topicsPerSessionMean} |`);
p(`| 最长低/0 信息连击（跑满局均值） | ${ENGINE.longestLowZeroRunMean} |`);
p(`| 到中途互选窗口（count≥${MUTUAL_MIN}） | ${ENGINE.mutualWindowReached} |`);
p(`| 局内重复抽卡次数 | ${ENGINE.repeatedDraws} |`);
p(`| 全程零有效轮局 | ${ENGINE.sessionsZeroEffective} |`);
p();
p(`### 1.3 仅 Formal ${FORMAL_TOTAL} 张真实生产卡（口径 A 下的「牌堆只有可计数卡」上界情形）`);
p();
const fo: ChainScenario = chain.scenarioFormalOnly;
p(`- 牌堆：${fo.deck}`);
p(`- 结果：${stopText(fo)}；最终 Heat **${fo.finalHeat}**、effective count **${fo.finalEffective}**。`);
p(`- 逐档首达轮次：${JSON.stringify(fo.firstReachRoundByHeat)}；已到达 ${bandList(bandsBy(fo.firstReachRoundByHeat, true))}，未到达 ${bandList(bandsBy(fo.firstReachRoundByHeat, false))}。`);
p(`- 派生说明（由本轮运行结果现算，非手写）：${fo.note ?? "（无派生 note）"}`);
p();
p("### 1.4 ceiling 1~5（按 intensityLimit 分档，各档约 1/5 样本）");
p();
p("| 口径 | intensityLimit | 局数 | dead-end | dead-end 率 | Formal 曝光占比 | 有效轮/局 |");
p("|---|---|---|---|---|---|---|");
for (const c of mc.ceilingCohorts)
  p(`| ${c.mode === "B" ? "A（engine）" : "B（当前 UI）"} | ${c.intensityLimit} | ${c.sessions} | ${c.deadEndSessions} | ${pct(c.deadEndRate)} | ${pct(c.formalShare)} | ${c.effectivePerSession} |`);
p();
p("### 1.5 最差 trace（口径 A：mode B，选 dead-end 优先）");
p();
const ws = worst.worstStat;
const totalDrawsWorst = Object.values(ws.heatAtDraw as Record<string, number>).reduce((a, b) => a + b, 0);
p(`- 挑选规则：${worst.selectionRule}`);
p(`- 命中：桌型 **${worst.table}**，seed **${worst.seed}**，intensityLimit **${worst.intensityLimit}**，mode ${worst.mode}`);
p(`- 结果：完成 ${ws.completedRounds} 轮后 \`${ws.terminationReason}\`（dead-end=${ws.deadEnd}）；共抽 ${totalDrawsWorst} 次；Formal 曝光 ${ws.formalDraws}；有效信息轮 ${ws.effectiveRounds}；最长低/0 信息连击 ${ws.longestLowZeroRun}；heatAtDraw ${heatCells(ws.heatAtDraw)}`);
p();
p("| 轮 | 卡 | 轨 | Heat@抽卡 | 终态 | informationGain | topic | 记有效轮 |");
p("|---|---|---|---|---|---|---|---|");
for (const r of worst.rounds)
  p(`| ${r.round} | ${r.cardId} | ${r.formal ? "Formal" : "legacy"} | ${r.heatAtDraw} | ${r.terminal} | ${r.informationGain ?? "null"} | ${r.topic ?? "null"} | ${r.effective ? "✅" : "—"} |`);
p();
p("**文字归因**（逐条由数据派生）：");
const worstFormalDrawsByTerminal = worst.rounds.reduce(
  (acc: Record<string, number>, r: { formal: boolean; terminal: string }) => {
    if (r.formal) acc[r.terminal] = (acc[r.terminal] ?? 0) + 1;
    return acc;
  },
  {},
);
const formalCompletedRows = worstFormalDrawsByTerminal.completed ?? 0;
const legacyCompletedRows = worst.rounds.length - formalCompletedRows;
const drawBands = Object.keys(ws.heatAtDraw as Record<string, number>).filter((h) => (ws.heatAtDraw as Record<string, number>)[h] > 0);
const drawBandText = drawBands.length === 1 ? drawBands[0] : `${drawBands.join("/")}（多档）`;
p(`1. 它是 **dead-end**（${ws.terminationReason}，只完成 ${ws.completedRounds}/20 轮）：${ws.terminationReason === "pack_exhausted" ? `\`intensityLimit=${worst.intensityLimit}\` 的合法池先被抽干` : `按 \`${ws.terminationReason}\` 终止`}。`);
p(`2. 共抽 ${totalDrawsWorst} 次里 Formal **${ws.formalDraws} 张**，其中 completed 轮 **${formalCompletedRows} 张**、skipped 轮 **${ws.formalDraws - formalCompletedRows} 张**（skipped 无 completed ⇒ 无披露）；completed 轮里 legacy ${legacyCompletedRows} 张 ⇒ sidecar 恒 null ⇒ 有效轮 **${ws.effectiveRounds}**。`);
p(`3. 有效轮 ${ws.effectiveRounds} < ${H2_MIN}（H2 门槛）⇒ **Heat 始终停在 ${drawBandText}**，认识证据与互选窗口都无从谈起。`);
p();

/* ------------------------------------------------------------------ */
/* 口径 B                                                              */
/* ------------------------------------------------------------------ */
p("## 2｜口径 B｜Current real UI（disclosure producer 未接入）");
p();
p("- **事实**：`app/game/page.tsx#roundDisclosureForCurrentRound()` 恒返回 `undefined`（Human 本批冻结：不新增披露 UI）⇒ `isEffectiveInformationRound` fail-closed 恒 false ⇒ `relationshipEffectiveCardCount` 恒 0 ⇒ **Heat 恒 H1**。");
p(`- **当前 UI 实际可抽到的 Formal 张数**：**${H1_FORMAL_COUNT} 张**（= 卡面 \`heatMin=1\` 且 H1 桶合法者）—— **${ids(H1_FORMAL_IDS)}**。`);
p(`- **当前 UI 实际抽到的 Formal**（4000 局实测）：distinct **${UI.formalExposedDistinct}/${UI.formalTotal}** —— ${ids(UI.formalExposedIds)}；曝光 ${pct(UI.formalShare)}（${UI.formalDraws}/${UI.totalDraws}）。`);
p(`- effective count **恒 ${UI.effectivePerSession}**；跑满 20 轮 ${UI.sessionsCompleted20}（${pct(UI.sessionRate)}）、dead-end ${UI.deadEndSessions}（${pct(UI.deadEndRate)}）；heatAtDraw ${heatCells(UI.heatAtDraw)}；到达 H2/H3/H4 = ${UI.sessionsReachingH2}/${UI.sessionsReachingH3}/${UI.sessionsReachingH4}；中途互选窗口 **${UI.mutualWindowReached} 局**。`);
p(`- 对照口径 A（同样 4000 局、仅多一个合法披露信号）：effective **${ENGINE.effectivePerSession}**/局、Formal distinct **${ENGINE.formalExposedDistinct}/${ENGINE.formalTotal}**、到达 H2/H3/H4 = ${ENGINE.sessionsReachingH2}/${ENGINE.sessionsReachingH3}/${ENGINE.sessionsReachingH4}。`);
p("> ⛔ **当前 UI 不能产生 effective information round ⇒ Heat 恒 H1 ⇒ mid Mutual 不可达**。这不是「生产 Heat 已正常推进」。");
p();

/* ------------------------------------------------------------------ */
/* 结构性缺口（全部由产物现算，禁止写死「缺 / 不缺」）                     */
/* ------------------------------------------------------------------ */
const bootstrapShortfall = H2_SHORTFALL;
const h1GateOk = bootstrapShortfall <= 0;
const h3Shortfall = H3_MIN - CUMULATIVE.heatMinLe2;
const h4Shortfall = H4_MIN - CUMULATIVE.heatMinLe3;
const h1IntensityKeys = Object.keys(mc.h1Formal.byIntensity as Record<string, number>);
const h1AllI1 = h1IntensityKeys.length === 1 && h1IntensityKeys[0] === "1";
p("## 3｜结构性缺口与代价（**逐条由产物现算**；缺就如实写缺口，不缺就如实写已解除，禁止反向压 Heat 来消除）");
p();
p(`- **当前 UI（口径 B）下「更深档 Formal 不可抽」**：H1 桶只收 ${H1_FORMAL_COUNT} 张 \`heatMin=1\` 的 Formal；其余 ${FORMAL_TOTAL - H1_FORMAL_COUNT} 张 \`heatMin≥2\` 在 Heat 恒 H1 时被硬过滤（静态桶 H2=${band("H2").formalLegal} / H3=${band("H3").formalLegal} / H4=${band("H4").formalLegal} 张，实践抽不到）。`);
if (h1GateOk) {
  p(`- **H1→H2 冷启门：库存侧已解除**：H1 桶内可计数 Formal **${CUMULATIVE.heatMinLe1} 张 ≥ H2 门槛 ${H2_MIN}（余量 ${-bootstrapShortfall} 张）⇒ 只要每轮给合法披露，Heat 可离开 H1**；4000 局口径 A 实测到达 H2 ${ENGINE.sessionsReachingH2} 局（${pct2(ENGINE.sessionsReachingH2, ENGINE.sessions)}）。`);
} else {
  p(`- **H1→H2 冷启门（库存不足）**：H1 桶内可计数 Formal 仅 **${CUMULATIVE.heatMinLe1} 张 < H2 门槛 ${H2_MIN}（缺口 ${bootstrapShortfall} 张）⇒ 即便每轮都给合法披露，Heat 也离不开 H1**；4000 局口径 A 到达 H2 ${ENGINE.sessionsReachingH2} 局。`);
}
if (h3Shortfall > 0) {
  p(`- **H2→H3 冷启门仍缺库存**：\`heatMin≤2\` 的 Formal 累计 **${CUMULATIVE.heatMinLe2} 张 < H3 门槛 ${H3_MIN}（缺口 ${h3Shortfall} 张）**；实测口径 A 到达 H3 ${ENGINE.sessionsReachingH3} 局。`);
} else {
  p(`- **H2→H3 冷启门（库存侧已够）**：\`heatMin≤2\` 的 Formal 累计 ${CUMULATIVE.heatMinLe2} 张 ≥ H3 门槛 ${H3_MIN}；实测口径 A 到达 H3 ${ENGINE.sessionsReachingH3} 局（${pct2(ENGINE.sessionsReachingH3, ENGINE.sessions)}）。`);
}
if (h4Shortfall > 0) {
  p(`- **H3→H4 冷启门仍缺库存**：\`heatMin≤3\` 的 Formal 累计 **${CUMULATIVE.heatMinLe3} 张 < H4 门槛 ${H4_MIN}（缺口 ${h4Shortfall} 张）**；实测口径 A 到达 H4 ${ENGINE.sessionsReachingH4} 局 —— **该档 0 张属实且如实登记，不靠压低门槛消除**。`);
} else if (ENGINE.sessionsReachingH4 === 0) {
  p(`- **H3→H4 冷启门（库存侧够、实测仍未到）**：\`heatMin≤3\` 的 Formal 累计 ${CUMULATIVE.heatMinLe3} 张 ≥ H4 门槛 ${H4_MIN}，但 4000 局口径 A **到达 H4 = 0 局** ⇒ 未达门槛来自牌堆耗尽／intensity 过滤／软去重／抽卡排序，而非冷启库存（如实登记该 0）。`);
} else {
  p(`- **H3→H4 可达**：\`heatMin≤3\` 累计 ${CUMULATIVE.heatMinLe3} 张 ≥ H4 门槛 ${H4_MIN}；实测口径 A 到达 H4 ${ENGINE.sessionsReachingH4} 局。`);
}
const ceiling1 = mc.ceilingCohorts.find((c: { mode: string; intensityLimit: number }) => c.mode === "B" && c.intensityLimit === 1);
p(`- **ceiling=1 断粮**：intensityLimit=1 的局 dead-end 率 **${pct(ceiling1.deadEndRate)}**（口径 A），终止原因分布 ${JSON.stringify(ceiling1.termination)}；单包 truth-dare 在 I1 上限下 20 轮**${ceiling1.deadEndRate > 0 ? "不可持续" : "可持续"}**（由该率现判）。`);
if (ENGINE.mutualWindowReached > 0) {
  p(`- **中途互选窗口 [${MUTUAL_MIN}, ${MUTUAL_MAX}]**：口径 A 下 count≥${MUTUAL_MIN} 的局 ${ENGINE.mutualWindowReached}/4000（已达窗口）。`);
} else {
  p(`- **中途互选窗口 [${MUTUAL_MIN}, ${MUTUAL_MAX}] 结构性不可达**：口径 A 下 count≥${MUTUAL_MIN} 的局 **${ENGINE.mutualWindowReached}**/4000（到达 H3 仅 ${ENGINE.sessionsReachingH3} 局，且需同时满足 \`Heat≥${MUTUAL_MIN_HEAT}\`；属实、如实登记）。`);
}
p();

/* ------------------------------------------------------------------ */
/* 补卡建议                                                             */
/* ------------------------------------------------------------------ */
p("## 4｜补卡建议（一律靠补内容，不靠放宽门槛；**建议随产物里的实际缺口现判**，不缺的档不再提）");
p();
if (bootstrapShortfall > 0) {
  p(`1. **先补 H1→H2 冷启门（最高优先，最小可解）**：每玩法至少要 **≥${H2_MIN} 张 ` + "`heatMin=1`" + ` 的 Formal 卡**（当前 truth-dare ${CUMULATIVE.heatMinLe1} 张，缺口 ${bootstrapShortfall} 张），Heat 才可能离开 H1。**不得用压低 heatMin 解决**，要通过新增真实浅关系题。`);
} else {
  p(`1. **H1→H2 冷启门在库存侧已解除，不再提「补 H1」**：当前 truth-dare ` + "`heatMin=1`" + ` 的 Formal 已有 ${CUMULATIVE.heatMinLe1} 张 ≥ H2 门槛 ${H2_MIN}（口径 A 实测到达 H2 ${ENGINE.sessionsReachingH2} 局）⇒ 库存侧${h4Shortfall > 0 ? "下一道门在 H3→H4" : "已无下一道门（更深的门来自牌堆耗尽／intensity 过滤／曝光，非冷启库存）"}：` + "`heatMin≤2`" + ` 累计 ${CUMULATIVE.heatMinLe2}（H3 门槛 ${H3_MIN}，${h3Shortfall > 0 ? `缺口 ${h3Shortfall}` : "已够"}）、` + "`heatMin≤3`" + ` 累计 ${CUMULATIVE.heatMinLe3}（H4 门槛 ${H4_MIN}，${h4Shortfall > 0 ? `缺口 ${h4Shortfall}` : "已够"}）。`);
}
if (h1AllI1) {
  p(`2. **补「能真被抽到」的 H1 卡（intensity 维度）**：当前 ${H1_FORMAL_COUNT} 张 H1 Formal 全为 ` + "`intensity=1`" + `，在建堆里输给 legacy 高强度档（口径 A 曝光仅 ${pct(ENGINE.formalShare)}）。建议补 **` + "`heatMin=1`" + ` 且 ` + "`intensity`" + ` 偏高（I3~I5）** 的浅关系 Formal 卡，让它们能进入 top 强度档被实际抽出。`);
} else {
  p(`2. **H1 卡强度构成已非全 I1，不再提「全为 I1」**：当前 ${H1_FORMAL_COUNT} 张 H1 Formal 的 intensity 分布 ${JSON.stringify(mc.h1Formal.byIntensity)}（口径 A 曝光 ${pct(ENGINE.formalShare)}）；如继续提曝光，可优先补 ` + "`heatMin=1`" + ` 的 I3~I5 浅关系卡（仍禁止为曝光做不自然高尺度）。`);
}
p(`3. **heatMax 覆盖（H4 层）**：当前 heatMax 分布 ${JSON.stringify(mc.formalProfiles.byHeatMax)}；建议每玩法 ≥8 张 \`heatMax=4\`，避免 Heat 升高后 Formal 库存反而变薄（H1→H4 Formal 合法数 ${mc.staticHeatAvailability.map((h: { heat: string; formalLegal: number }) => `${h.heat} ${h.formalLegal}`).join(" → ")}）。`);
const oneCardTopics = Object.entries(mc.formalProfiles.byTopic as Record<string, number>)
  .filter(([, count]) => count === 1)
  .map(([topic]) => `\`${topic}\``);
p(`4. **topic 覆盖（摊平）**：当前覆盖 ${Object.keys(mc.formalProfiles.byTopic).length} 个人物维度，其中仅 1 张的维度${oneCardTopics.length === 0 ? "（无）" : ` ${oneCardTopics.join("/")}`}；建议每玩法 Formal 覆盖 ≥5 个 topic，并补齐 A.1 零维度（\`吃醋·占有\`/\`异性朋友边界\`/\`前任态度\`/\`底线·雷区\`/\`人生目标·理想生活\`）。`);
p(`5. **跨玩法分摊**：当前 ${FORMAL_TOTAL} 张全在 truth-dare；把审计 metadata 补到全部其他玩法的固定卡上，而非只堆 truth-dare。`);
p(`6. **不要动的旋钮**：认识阈值、窗口 [${MUTUAL_MIN}, ${MUTUAL_MAX}]、\`MUTUAL_MIN_HEAT=${MUTUAL_MIN_HEAT}\`、Heat 硬过滤、\`isEffectiveInformationRound\` fail-closed、±18% 阈值、样本量一律不动。`);
p();

/* ------------------------------------------------------------------ */
/* 生产链验证                                                           */
/* ------------------------------------------------------------------ */
p("## 5｜真实生产链验证（§十八 第一段）");
p();
const fp: ChainScenario = chain.scenarioFullPack;
const lo: ChainScenario = chain.scenarioLegacyOnly;
const bo: ChainScenario = chain.scenarioBootstrapOnly;
p(`- 链路：${chain.chain.join(" → ")}`);
p(`- 纪律：${chain.disclosure}`);
p();
p("| 情形 | 牌堆 | 轮数 | 终态 Heat | 最终 effective count | Heat 逐档首达（轮次） |");
p("|---|---|---|---|---|---|");
p(`| 全包（真实生产牌堆） | ${fp.deck} | ${fp.rounds.length} | ${fp.finalHeat} | ${fp.finalEffective} | ${JSON.stringify(fp.firstReachRoundByHeat)} |`);
p(`| 仅 Formal ${FORMAL_TOTAL} 张 | ${fo.deck} | ${fo.rounds.length} | ${fo.finalHeat} | ${fo.finalEffective} | ${JSON.stringify(fo.firstReachRoundByHeat)} |`);
p(`| 仅 Bootstrap 7 张（其中仅 227/229 属 Formal） | ${bo.deck} | ${bo.rounds.length} | ${bo.finalHeat} | ${bo.finalEffective} | ${JSON.stringify(bo.firstReachRoundByHeat)} |`);
p(`| 仅 legacy（负向对照） | ${lo.deck} | ${lo.rounds.length} | ${lo.finalHeat} | ${lo.finalEffective} | ${JSON.stringify(lo.firstReachRoundByHeat)} |`);
p();
const formalDrawnIds = [...new Set(fo.rounds.map((r) => r.cardId))].sort();
const formalDrawnAllInH1 = formalDrawnIds.every((id) => H1_FORMAL_IDS.includes(id));
p(`- 全包（seed=1，**给了合法披露信号**）：Formal 卡被抽到 **${fp.rounds.filter((r: { formal: boolean }) => r.formal).length} 张**；有效计数 ${fp.finalEffective}、Heat ${fp.finalHeat}；${stopText(fp)}。`);
const foGap = Math.max(0, H2_MIN - fo.finalEffective);
p(`- 仅 Formal ${FORMAL_TOTAL} 张（seed=1，**给了合法披露信号**）：共 ${fo.rounds.length} 轮，抽到 ${ids(formalDrawnIds)}（${formalDrawnAllInH1 ? `全部落在 H1 桶合法集合内——该集合共 ${H1_FORMAL_COUNT} 张 \`heatMin=1\`` : "含 H1 桶合法集合以外的卡"}），effective ${fo.finalEffective} / H2 门槛 ${H2_MIN}（${foGap === 0 ? "已跨过 H2 门槛" : `缺口 ${foGap}`}）⇒ 实测终态 Heat **${fo.finalHeat}**（逐档首达见上表）；${stopText(fo)}。`);
p(`- 仅 Bootstrap 7 张（seed=1，**给了合法披露信号**；其中仅 227/229 属 Formal）：共 ${bo.rounds.length} 轮，该子集 ${bo.rounds.length} 张都带 §7.2 metadata ⇒ 每轮计有效轮（Formal 归属只影响曝光统计、不影响计数口径），effective ${bo.finalEffective} ⇒ 首达 ${JSON.stringify(bo.firstReachRoundByHeat)}；${stopText(bo)}（该子集 < 下一档门槛，属真实缺口）。`);
p(`- 全包 ${chain.fullPackSeedSweep.sessions} seed 扫描（不挑 seed，**同一固定桌型/固定配置的窄口径**，与 §1.2 的 4000 局多桌型聚合口径并列阅读、不互相替代）：到达 H2 ${chain.fullPackSeedSweep.reachedH2} 局、H3 ${chain.fullPackSeedSweep.reachedH3} 局、H4 ${chain.fullPackSeedSweep.reachedH4} 局；终态 Heat 分布 ${JSON.stringify(chain.fullPackSeedSweep.heatDistribution)}；有效轮/局 ${chain.fullPackSeedSweep.effectiveMean}。`);
p(`- legacy 负向对照：sidecar 恒 null ⇒ effective 恒 ${lo.finalEffective}、Heat 恒 ${lo.finalHeat}（fail-closed 成立）。`);
p();
p("- 四情形 **派生 note**（由各自运行结果现算，不允许手写结论）：");
p(`  - 全包：${fp.note ?? "（无）"}`);
p(`  - 仅 Formal：${fo.note ?? "（无）"}`);
p(`  - 仅 Formal 子集 Bootstrap：${bo.note ?? "（无）"}`);
p(`  - 仅 legacy：${lo.note ?? "（无）"}`);
p();

/* ------------------------------------------------------------------ */
/* 复跑                                                                 */
/* ------------------------------------------------------------------ */
p("## 6｜复跑命令");
p();
p("```bash");
p("npx vite-node -c vitest.config.ts scripts/audit-formal-truth-montecarlo.ts");
p("npx vite-node -c vitest.config.ts scripts/audit-formal-truth-production-chain.ts");
p("npx vite-node -c vitest.config.ts scripts/audit-formal-truth-report.ts");
p("```");
p();

writeFileSync(`${DIR}/FORMAL-TRUTH-MC.md`, lines.join("\n") + "\n");
console.log("已生成 docs/qa/content-audit/FORMAL-TRUTH-MC.md（", lines.length, "行 ）");
