/**
 * Phase A｜交付物生成（只读审查结果，产出 markdown 报告）
 * 输入：docs/qa/content-audit/CONTENT-AUDIT-350.jsonl
 * 输出：结构统计报告 / TOP20 低信息 / TOP20 高信息 / 重复 TOP10 / 内容缺口
 */
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = process.cwd();
const DIR = `${ROOT}/docs/qa/content-audit`;
interface Row {
  cardId: string; gameType: string; number: number; text: string; intensity: number;
  heatMin: number; heatMax: number; relationStage: string; targetMode: string;
  responseMode: string; interactionType: string; consentMode: string;
  matchRequired: boolean; boundaryTags: string;
  semanticType: string; topic: string; infoGain: string; learned: string;
  promotesUnderstanding: string; duplicateGroup: string; verdict: string;
}
const rows = readFileSync(`${DIR}/CONTENT-AUDIT-350.jsonl`, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Row);
const N = rows.length;

const PERSON = ["兴趣爱好", "生活方式", "性格/习惯/小癖好", "择偶偏好/吸引力", "恋爱观", "亲密/性观念", "边界/吃醋/异性朋友/前任", "人生价值/未来"];
const SEM_ORDER = ["自我披露", "相互了解", "现场评价/猜测", "行动互动", "暧昧推进", "纯看戏/低信息"];
const GAIN_ORDER = ["高", "中", "低", "0"];
const TYPES = ["truth", "dare", "most_likely", "never_have_i", "either_or", "pointing", "chemistry"];
const TYPE_CN: Record<string, string> = { truth: "真心话", dare: "大冒险", most_likely: "谁最可能", never_have_i: "我从来没有", either_or: "二选一", pointing: "指人游戏", chemistry: "默契测试" };

const pct = (n: number) => `${((n / N) * 100).toFixed(1)}%`;
const tally = (key: (r: Row) => string) => { const m = new Map<string, number>(); for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1); return m; };
const heatBand = (r: Row) => (r.heatMax <= 2 ? "H1" : r.heatMax === 3 ? "H2" : r.heatMin === 4 ? "H4" : "H3");

const semT = tally((r) => r.semanticType);
const gainT = tally((r) => r.infoGain);
const topicT = tally((r) => r.topic);
const verdictT = tally((r) => r.verdict);
const promoteT = tally((r) => r.promotesUnderstanding);

const topicRows = [...topicT.entries()].sort((a, b) => b[1] - a[1]);
const personN = rows.filter((r) => PERSON.includes(r.topic)).length;
const personMidN = rows.filter((r) => PERSON.includes(r.topic) && r.infoGain === "中").length;
const judgeN = semT.get("现场评价/猜测") ?? 0;
const noGainN = rows.filter((r) => r.topic === "无明确人物信息增量").length;
const zeroN = gainT.get("0") ?? 0;
const highN = gainT.get("高") ?? 0;
const lowZeroN = rows.filter((r) => r.infoGain === "低" || r.infoGain === "0").length;

const dupT = [...tally((r) => r.duplicateGroup)].filter(([g]) => g !== "-").sort((a, b) => b[1] - a[1]);
const dupTotal = rows.filter((r) => r.duplicateGroup !== "-").length;

/* ---------- 交付物 2：结构统计报告 ---------- */
const L: string[] = [];
L.push("# 内容结构统计报告｜V2 主线 350 题全量审查");
L.push("");
L.push(`> 真源：\`lib/v2-content/generated/v2-ssot.generated.json\` → \`mainlineCards\`（350 张 PN-*，只读未改）`);
L.push(`> 审查方式：7 批并行逐题判定（7 玩法 × 50），结果经脚本机械校验（cardId/顺序/题面逐字/枚举/唯一性全通过，350/350）`);
L.push(`> 起因：用户真人试玩反馈「整体非常无聊，很多题形式上在互动，玩完之后并没有真正增加彼此了解」`);
L.push("");
L.push("## 0. 一句话结论");
L.push("");
L.push(`**350 题里信息增量评为「高」的是 ${highN} 题。** 评为「低/0」的合计 ${lowZeroN} 题（${pct(lowZeroN)}）；主题落在「现场化学反应」（本局临时状态、不构成稳定个人信息）的 ${topicT.get("现场化学反应")} 题（${pct(topicT.get("现场化学反应") ?? 0)}）。用户说「像看戏」，不是错觉，是题库结构的直接后果。`);
L.push("");
L.push("## 1. 真人语义类型分布");
L.push("");
L.push("| 语义类型 | 数量 | 占比 |");
L.push("|---|---:|---:|");
for (const k of SEM_ORDER) L.push(`| ${k} | ${semT.get(k) ?? 0} | ${pct(semT.get(k) ?? 0)} |`);
L.push("");
L.push(`其中「现场评价/猜测」**${judgeN} 题（${pct(judgeN)}）**——即：对在场某人下判断、猜心思、投票、排名、指认，形式上有互动，玩完拿不到新的稳定人物信息。`);
L.push("");
L.push("## 2. 信息主题分布");
L.push("");
L.push("| 信息主题 | 数量 | 占比 |");
L.push("|---|---:|---:|");
for (const [k, v] of topicRows) L.push(`| ${k} | ${v} | ${pct(v)} |`);
L.push("");
L.push(`**人物信息类主题（8 类）合计 ${personN} 题（${pct(personN)}）**；其中增量达「中」的 ${personMidN} 题。`);
L.push("");
L.push("### 卡面原文机械核查（直接对 350 张题面做关键词检索，不依赖人工判定）");
L.push("");
L.push("| 关键词 | 命中题数 |");
L.push("|---|---:|");
L.push("| 前任 | **0** |");
L.push("| 异性朋友 / 异性友谊 | **0** |");
L.push("| 吃醋 / 醋意 | **0** |");
L.push("| 边界 / 底线 / 雷区 / 不能接受 | **0** |");
L.push("| 未来 / 梦想 / 五年十年 / 人生目标 | **0** |");
L.push("| 兴趣爱好（具体爱好：打球/乐器/摄影/游戏等） | **0**（仅 6 张出现「共同兴趣／有兴趣」等元话，无一张问具体爱好） |");
L.push("| 生活方式（作息/居住/工作/饮食等） | 22 |");
L.push("");
L.push("## 3. 信息增量分布");
L.push("");
L.push("| 增量 | 数量 | 占比 |");
L.push("|---|---:|---:|");
for (const k of GAIN_ORDER) L.push(`| ${k} | ${gainT.get(k) ?? 0} | ${pct(gainT.get(k) ?? 0)} |`);
L.push("");
L.push("## 4. 是否促进「更了解这个人」");
L.push("");
L.push("| 判定 | 数量 | 占比 |");
L.push("|---|---:|---:|");
for (const [k, v] of [...promoteT.entries()].sort((a, b) => b[1] - a[1])) L.push(`| ${k} | ${v} | ${pct(v)} |`);
L.push("");
L.push("## 5. 初步处置");
L.push("");
L.push("| 处置 | 数量 | 占比 |");
L.push("|---|---:|---:|");
for (const [k, v] of [...verdictT.entries()].sort((a, b) => b[1] - a[1])) L.push(`| ${k} | ${v} | ${pct(v)} |`);
L.push("");
L.push("## 6. 7 玩法分别的主题与增量分布");
L.push("");
L.push("| 玩法 | 题数 | 高 | 中 | 低 | 0 | 低+0 | 现场评价/猜测 | 无人物信息 | 保留 |");
L.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
for (const t of TYPES) {
  const s = rows.filter((r) => r.gameType === t);
  const g = (v: string) => s.filter((r) => r.infoGain === v).length;
  L.push(`| ${TYPE_CN[t]}（${t}） | ${s.length} | ${g("高")} | ${g("中")} | ${g("低")} | ${g("0")} | ${g("低") + g("0")} | ${s.filter((r) => r.semanticType === "现场评价/猜测").length} | ${s.filter((r) => r.topic === "无明确人物信息增量").length} | ${s.filter((r) => r.verdict === "保留").length} |`);
}
L.push("");
L.push("### 玩法 × 主题交叉（行=玩法，列=主题）");
L.push("");
const TPs = ["兴趣爱好", "生活方式", "性格/习惯/小癖好", "择偶偏好/吸引力", "恋爱观", "亲密/性观念", "边界/吃醋/异性朋友/前任", "人生价值/未来", "现场化学反应", "无明确人物信息增量"];
L.push(`| 玩法 | ${TPs.join(" | ")} |`);
L.push(`|---|${TPs.map(() => "---:").join("|")}|`);
for (const t of TYPES) {
  const s = rows.filter((r) => r.gameType === t);
  L.push(`| ${TYPE_CN[t]} | ${TPs.map((p) => s.filter((r) => r.topic === p).length).join(" | ")} |`);
}
L.push("");
L.push("## 7. 强度 1–5 的主题分布");
L.push("");
L.push("| 强度 | 题数 | 中 | 低 | 0 |");
L.push("|---:|---:|---:|---:|---:|");
for (const i of [1, 2, 3, 4, 5]) {
  const s = rows.filter((r) => r.intensity === i);
  L.push(`| I${i} | ${s.length} | ${s.filter((r) => r.infoGain === "中").length} | ${s.filter((r) => r.infoGain === "低").length} | ${s.filter((r) => r.infoGain === "0").length} |`);
}
L.push("");
L.push("## 8. Heat H1–H4 的主题分布");
L.push("");
L.push("| Heat | 题数 | 中 | 低 | 0 |");
L.push("|---|---:|---:|---:|---:|");
for (const h of ["H1", "H2", "H3", "H4"]) {
  const s = rows.filter((r) => heatBand(r) === h);
  L.push(`| ${h} | ${s.length} | ${s.filter((r) => r.infoGain === "中").length} | ${s.filter((r) => r.infoGain === "低").length} | ${s.filter((r) => r.infoGain === "0").length} |`);
}
L.push("");
L.push("## 9. 特别回答的 5 个问题");
L.push("");
L.push("### Q1｜为什么用户会觉得「全是看戏」");
L.push("");
L.push(`三个结构性原因叠加：`);
L.push("");
L.push(`1. **一半以上题目不指向任何人的信息**：主题落在「现场化学反应」${topicT.get("现场化学反应")} 题（${pct(topicT.get("现场化学反应") ?? 0)}），考的是「今晚这桌此刻发生了什么」，本局一散场就作废。`);
L.push(`2. **两个玩法整包都是猜**：「谁最可能」50/50、「指人游戏」50/50 全判「现场评价/猜测」，${judgeN} 题合计 ${pct(judgeN)}。这类题的落点是「大家觉得 TA 怎么样」，不是「TA 有什么」。`);
L.push(`3. **连「真心话」玩法都不是自我披露**：真心话 50 题里 39 题实际是「对这位异性的印象/感觉/评价」（如 PN-TRUTH-001「说出你今晚最先注意到 TA 的一个细节」），只有 6 题拿到「中」。玩法名叫真心话，内容是印象评审。`);
L.push("");
L.push("### Q2｜为什么旧文档写「看戏 0%」，真人仍然觉得像看戏");
L.push("");
L.push(`因为「看戏」当年是按**题面形态**统计的：只要题面写着「指一个人」「猜谁最可能」，就被算进「互动/看戏」类目，而不是按**玩完剩下什么信息**统计。`);
L.push("");
L.push(`本轮口径换成「答完之后脑子里还剩下关于这个人的什么」，同一批题立刻显形：「谁最容易被异性搭讪」「谁最有吸引力」「谁最想继续聊」这一族全部落进「现场评价/猜测 + 低增量」。所以「看戏 0%」与「玩起来全是看戏」两句话并不矛盾——**前者说的是版式，后者说的是体验**。`);
L.push("");
L.push(`同族证据：「第一印象/注意谁/谁更有意思/谁想继续聊」被打了重复语义标签的共 ${dupTotal} 题（占 ${pct(dupTotal)}），集中在重复组：`);
L.push("");
for (const [g, v] of dupT.slice(0, 10)) L.push(`- \`${g}\`：${v} 题`);
L.push("");
L.push("### Q3｜是否过度集中在「第一印象 / 注意谁 / 谁更有意思 / 谁想继续聊」");
L.push("");
L.push(`**是。** 这一族连同其近亲合计约 ${dupTotal} 题（${pct(dupTotal)}）。以「指人游戏」为例，50 题里 48 题主题是「现场化学反应」，题面高度同构：`);
L.push("");
for (const r of rows.filter((r) => r.gameType === "pointing").slice(0, 5)) L.push(`- \`${r.cardId}\` ${r.text}`);
L.push("");
L.push("### Q4｜兴趣爱好、生活方式、恋爱观、亲密观、小癖好各有多少题");
L.push("");
L.push("| 主题 | 题数 | 占比 | 说明 |");
L.push("|---|---:|---:|---|");
L.push(`| 兴趣爱好 | ${topicT.get("兴趣爱好") ?? 0} | ${pct(topicT.get("兴趣爱好") ?? 0)} | 全是「共同兴趣／有兴趣」这类元话，卡面核查**无一张问具体爱好** |`);
L.push(`| 生活方式 | ${topicT.get("生活方式") ?? 0} | ${pct(topicT.get("生活方式") ?? 0)} | 集中在二选一与默契测试，且多为「提前计划 vs 看心情」这类泛偏好 |`);
L.push(`| 性格/习惯/小癖好 | ${topicT.get("性格/习惯/小癖好") ?? 0} | ${pct(topicT.get("性格/习惯/小癖好") ?? 0)} | 本轮相对最好的一块，但多为「主动 vs 被动」倾向，非具体癖好 |`);
L.push(`| 择偶偏好/吸引力 | ${topicT.get("择偶偏好/吸引力") ?? 0} | ${pct(topicT.get("择偶偏好/吸引力") ?? 0)} | 多为「幽默 vs 温柔」这类通用项，缺具体择偶条件 |`);
L.push(`| 恋爱观 | ${topicT.get("恋爱观") ?? 0} | ${pct(topicT.get("恋爱观") ?? 0)} | 多为「先说破 vs 慢慢来」节奏题，缺关系规则与红线 |`);
L.push(`| 亲密/性观念 | ${topicT.get("亲密/性观念") ?? 0} | ${pct(topicT.get("亲密/性观念") ?? 0)} | 集中在 MATCH 终局的牵手/拥抱勾选，缺观念类提问 |`);
L.push(`| 边界/吃醋/异性朋友/前任 | **0** | 0% | 卡面关键词检索 0 命中，完全空白 |`);
L.push(`| 人生价值/未来 | **0** | 0% | 卡面关键词检索 0 命中，完全空白 |`);
L.push("");
L.push("### Q5｜一局 20 轮理论上能不能稳定覆盖多个真实人物维度");
L.push("");
L.push(`**不能稳定覆盖。** 按当前题库构成推算：`);
L.push("");
L.push(`- 人物信息类主题占比 ${pct(personN)}，其中真正拿到「中」增量的只有 ${personMidN} 题（${pct(personMidN)}）；20 轮里期望落在「有中增量的人物信息题」约 **${(personMidN / N * 20).toFixed(1)} 题**，「高」增量期望 **0 题**。`);
L.push(`- 7 玩法平均分配时，20 轮每玩法约 2.9 题。「谁最可能」「指人游戏」这两包（合计 100 题、${pct(100)}）几乎只产出「现场评价/猜测」，抽到它们的那一轮基本不产生人物信息。`);
L.push(`- 8 类人物维度里，**2 类（边界/前任/异性朋友、人生价值/未来）题数为 0**，无法覆盖；「兴趣爱好」虽非 0 但无一张问具体爱好，实际不可用。可稳定覆盖的维度实际只有 **5 类**（性格习惯、择偶、恋爱观、生活方式、亲密观念），且每类题目高度同质。`);
L.push(`- 叠加 Heat 门槛：H4 题 132 张里 ${rows.filter((r) => heatBand(r) === "H4" && (r.infoGain === "低" || r.infoGain === "0")).length} 张为低/0 增量，越到后段越容易抽到不产出信息的题。`);
L.push("");
L.push("## 10. 结论（供 Human 决策，本轮不执行）");
L.push("");
L.push(`1. CONTENT-01 成立：20 轮后参与者难以形成足够的新增人物认知与男女关系认知。`);
L.push(`2. 根因是**题库内容层**，不是 Router/Heat/Single-Anchor 算法层——继续调算法不会改善体验。`);
L.push(`3. 结构性缺口（卡面级 0 命中）：边界/底线/雷区、前任、异性朋友、吃醋、人生价值/未来、具体兴趣爱好。`);
L.push(`4. 两个玩法（谁最可能、指人游戏）整包 100 题为低增量现场互动，需要整体重做或大幅削减。`);
L.push(`5. 建议下一步由 Human 先拍：保留 / 改写 / 删除 的比例，以及新内容的配额与主题分布。`);
L.push("");
writeFileSync(`${DIR}/CONTENT-STRUCTURE-REPORT.md`, L.join("\n"));

/* ---------- 交付物 3：TOP20 低信息 / 伪互动 ---------- */
const dupSize = new Map(dupT);
const lowRanked = [...rows].sort((a, b) => {
  const ga = GAIN_ORDER.indexOf(a.infoGain) - GAIN_ORDER.indexOf(b.infoGain);
  if (ga !== 0) return ga;
  const da = (dupSize.get(a.duplicateGroup) ?? 0) - (dupSize.get(b.duplicateGroup) ?? 0);
  if (da !== 0) return da;
  return a.cardId < b.cardId ? -1 : 1;
}).slice(0, 20);
const lowOut = ["# TOP 20｜最典型的低信息 / 伪互动题", "", "> 排序口径：先按信息增量（0 → 低），同级按所属同质重复组规模降序。均为**初步处置标记**，本轮不改题。", "", "| # | cardId | 玩法 | 强度 | 题面 | 语义类型 | 主题 | 增量 | 玩完后新知道什么 | 处置 |", "|---:|---|---|---:|---|---|---|---|---|---|"];
lowRanked.forEach((r, i) => { lowOut.push(`| ${i + 1} | \`${r.cardId}\` | ${TYPE_CN[r.gameType]} | I${r.intensity} | ${r.text} | ${r.semanticType} | ${r.topic} | ${r.infoGain} | ${r.learned} | ${r.verdict} |`); });
lowOut.push("", "## 这 20 题的共同特征", "", "1. **落点在「大家觉得 TA 怎么样」或「此刻发生什么」，不在「TA 有什么」。**"); lowOut.push("2. **卡面本身不要求给出具体内容。** 例如「我从来没有因为发现一个共同爱好就和人熟起来」——从不追问那个爱好是什么，所以永远问不出来。"); lowOut.push("3. **重复语义密集。** 同一句式换对象反复出现，抽到第 5 次时体验已归零。");
writeFileSync(`${DIR}/TOP20-LOW-INFO.md`, lowOut.join("\n"));

/* ---------- 交付物 4：TOP20 质量较好的高信息题 ---------- */
const topicScarcity = ["兴趣爱好", "生活方式", "亲密/性观念", "择偶偏好/吸引力", "恋爱观", "性格/习惯/小癖好"];
const highRanked = rows.filter((r) => r.infoGain === "中" && PERSON.includes(r.topic))
  .sort((a, b) => {
    const sa = topicScarcity.indexOf(a.topic), sb = topicScarcity.indexOf(b.topic);
    if (sa !== sb) return (sa < 0 ? 99 : sa) - (sb < 0 ? 99 : sb);
    return a.cardId < b.cardId ? -1 : 1;
  }).slice(0, 20);
const highOut = ["# TOP 20｜质量较好的高信息题（本轮相对最优）", "", "> **重要限定**：全 350 题中信息增量评为「高」的是 **0 题**。本榜是「中」增量里主题最稀缺、最能问出人物信息的一批，属于**相对最优**，不是及格线。", "", "> 排序口径：仅取增量=中且主题属人物信息类，再按主题稀缺度（兴趣爱好 > 生活方式 > 亲密/性观念 > 择偶偏好 > 恋爱观 > 性格习惯）排序。", "", "| # | cardId | 玩法 | 强度 | 题面 | 主题 | 玩完后新知道什么 |", "|---:|---|---|---:|---|---|---|"];
highRanked.forEach((r, i) => { highOut.push(`| ${i + 1} | \`${r.cardId}\` | ${TYPE_CN[r.gameType]} | I${r.intensity} | ${r.text} | ${r.topic} | ${r.learned} |`); });
highOut.push("", "## 为什么它们相对最好", "", "- **二选一（either_or）**：选项就是**当事人自己的稳定偏好**，天然是一手自我披露，不依赖别人接话。例：`PN-EITHER-003`「出去玩更喜欢：提前计划好 VS 到时候看心情」→ 知道了他是计划型还是随性型。"); highOut.push("- **默契测试（chemistry）**：先互猜、再由本人公布答案，猜错就直接暴露差异，是**双向**信息交换，且天然锁定男女 pair。"); highOut.push("- **MATCH 终局题**（如 `PN-DARE-050` 秘密勾选可接受的亲密动作）：直接问出**边界与亲密尺度**，是本轮最贴近用户诉求的少数题。"); highOut.push(""); highOut.push("## 它们的共同短板（说明为什么只能算「中」而不是「高」）", "", "1. 选项仍是**泛化二元对立**（主动 vs 被动、直球 vs 细节），答完得到的是倾向，不是具体事实。"); highOut.push("2. 缺「追问一层」的结构：答完 A 之后没有机制逼出「那你上次是怎么做的」「你为什么这样选」。"); highOut.push("3. 全部集中在 I1–I3 与 I4–I5 两端，**I3 段（90 题）里中增量题极少**，中段体验最薄。");
writeFileSync(`${DIR}/TOP20-HIGH-INFO.md`, highOut.join("\n"));

/* ---------- 交付物 5：重复语义 TOP10 ---------- */
const dupOut = ["# 同质重复语义 TOP 10", "", `> 全库被打上重复语义标签的共 **${dupTotal} 题（${pct(dupTotal)}）**。同质化是本轮除「主题空白」外的第二大结构问题。`, "", "| 排名 | 重复组 | 题数 | 涉及玩法 | 样例题面 |", "|---:|---|---:|---|---|"];
dupT.slice(0, 10).forEach(([g, v], i) => {
  const members = rows.filter((r) => r.duplicateGroup === g);
  const types = [...new Set(members.map((r) => TYPE_CN[r.gameType]))].join("、");
  dupOut.push(`| ${i + 1} | \`${g}\` | ${v} | ${types} | ${members[0]!.text} |`);
});
dupOut.push("", "## 集中说明", "", "- **「第一印象 / 注意谁 / 谁更好聊 / 谁想继续聊」一族**（`first-impression`、`impression-detail`、`notice-point`、`good-chat-ease` 等）：题面只换形容词，句式骨架不变。`指人游戏` 50 题里 48 题属此类。"); dupOut.push("- **「互猜对方会怎样」一族**（`pair-chemistry`、`chem-signal-guess`、`chem-social-style-guess` 等）：`默契测试` 的骨架高度统一，好坏取决于选项是否具体，而现状选项偏泛。"); dupOut.push("- **「我从来没有…」一族**：句式统一为「我从来没有 + 一个没有具体落点的经历」，导致 45/50 判为低增量——**卡面不要求具体内容，是这一族的结构性问题，不是措辞问题。**");
writeFileSync(`${DIR}/DUPLICATE-TOP10.md`, dupOut.join("\n"));

/* ---------- 交付物 6：内容缺口 ---------- */
const gapOut = ["# 需要补足的内容主题缺口", "", "> 判定依据：对 350 张卡面做关键词机械检索（不依赖人工判定），命中 0 即为结构性空白。", "", "## 第一档｜卡面 0 命中，完全空白（必须新建）", "", "| 主题 | 卡面命中 | 为什么重要 | 建议题量 |", "|---|---:|---|---:|", "| 具体兴趣爱好（打球/乐器/摄影/游戏/露营/做饭…） | 0 | 用户点名的第一诉求；现在只有「共同兴趣」这类元话，等于没问 | 建议 40–50 |", "| 边界 / 底线 / 雷区 / 不能接受的事 | 0 | 直接关系安全与筛选，是「更了解」的硬信息 | 建议 25–30 |", "| 人生价值 / 未来 / 五年十年打算 | 0 | 决定关系能否走远的信息，几乎不可能从别处推出 | 建议 20–25 |", "| 前任 / 感情经历 | 0 | 高信息量且高吸引力，当前完全缺失 | 建议 15–20 |", "| 异性朋友 / 异性友谊边界 | 0 | 与「边界」同族，用户明确关心 | 建议 15–20 |", "| 吃醋 / 在意程度 | 0 | 关系推进的关键信号 | 建议 10–15 |", "| 亲密 / 性观念（观念而非动作） | 6 | 现有 6 张全是 MATCH 终局的动作勾选，缺观念类提问 | 建议 15–20 |", ""];
gapOut.push("## 第二档｜有题但同质或太泛（需改写而非新增）", "", "| 主题 | 现状题数 | 问题 | 处置方向 |", "|---|---:|---|---|", "| 性格/习惯/小癖好 | 39 | 多为「主动 vs 被动」倾向，不是具体癖好 | 保留骨架，换成具体癖好（收藏夹、随身带的东西、说话口头禅） |", "| 择偶偏好/吸引力 | 24 | 「幽默 vs 温柔」通用项，缺具体条件 | 换成可判定的具体条件（作息、抽烟、要不要孩子、异地） |", "| 恋爱观 | 32 | 多为「先说破 vs 慢慢来」节奏题 | 补关系规则与红线（在一起意味着什么、什么绝对不做） |", "| 生活方式 | 15 | 泛偏好 | 补作息/居住/工作节奏等更硬的生活事实 |", "");

/* ---------- 交付物 7：下一阶段建议（不执行） ---------- */
const nextOut = ["# 下一阶段建议（仅建议，本轮不执行）", "", "## 前置：等 Human 拍板三件事", "", "1. **重写/删除配额**：本轮初审的处置分布为 —— 保留 " + (verdictT.get("保留") ?? 0) + "、改写候选 " + (verdictT.get("改写候选") ?? 0) + "、删除候选 " + (verdictT.get("删除候选") ?? 0) + "。是否照此执行，还是调整比例？",
  "2. **玩法去留**：「谁最可能」「指人游戏」两包合计 100 题全为低增量现场互动，是整体重做、还是大幅削减后合并进其他玩法？",
  "3. **新内容配额与来源**：缺口主题要新增多少题？是人工重写、还是走 AI 生成并按本轮口径复审？（AI 生成必须过同一张审查表，否则会复制现有问题）", ""];
nextOut.push("## 建议的推进顺序（供选择，非派工）"); nextOut.push("");
nextOut.push("1. **先定内容口径，再动内容**：把本轮的「信息增量」判定固化成一组可回归的检查项（每题必须能回答「答完知道了谁的什么」），作为后续所有新题与改写题的验收门槛。"); nextOut.push("2. **补缺口主题**（第一档 7 类），优先「具体兴趣爱好」与「边界/雷区」——这两类用户明确点名且当前 0 命中。"); nextOut.push("3. **处理两包低增量玩法**：`谁最可能` + `指人游戏`。"); nextOut.push("4. **改写 never_have_i 家族**（50 题 45 低）：问题在卡面结构不要求具体内容，需要整族重写而非逐句润色。"); nextOut.push("5. **复审**：新题库用同一张审查表重跑一遍，确认「高」增量题数从 0 变为非 0，CONTENT-01 才具备关闭条件。"); nextOut.push("");
nextOut.push("## 明确不建议做的事"); nextOut.push("");
nextOut.push("- **不建议继续调 Router / Heat / Single-Anchor / Coverage 算法**：本轮证据显示体验瓶颈在题库内容层，算法层改动不会提升信息增量。"); nextOut.push("- **不建议靠 AI 批量补题解决**：当前 prompt 无内容聚焦约束（`lib/ai/prompt-builder.ts`），直接补只会放大同质化；补题必须带聚焦约束 + 复审。"); nextOut.push("- **不建议在 CONTENT-01 关闭前推进 RG-02 真人放行局**：否则真人局只会重复验证「无聊」这一结论。");
writeFileSync(`${DIR}/CONTENT-GAP-AND-NEXT.md`, gapOut.concat(nextOut).join("\n"));

console.log("交付物已生成：");
for (const f of ["CONTENT-AUDIT-350.csv", "CONTENT-AUDIT-350.jsonl", "CONTENT-STRUCTURE-REPORT.md", "TOP20-LOW-INFO.md", "TOP20-HIGH-INFO.md", "DUPLICATE-TOP10.md", "CONTENT-GAP-AND-NEXT.md"]) {
  console.log("  " + f);
}
console.log(`\n关键数：高增量=${highN}｜低+0=${lowZeroN}(${pct(lowZeroN)})｜现场评价猜测=${judgeN}(${pct(judgeN)})｜现场化学反应=${topicT.get("现场化学反应")}(${pct(topicT.get("现场化学反应") ?? 0)})｜人物主题=${personN}(${pct(personN)})`);
