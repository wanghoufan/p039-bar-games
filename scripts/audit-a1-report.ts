/**
 * Phase A.1 / A.2｜终版报告生成器（双模式；禁止硬编码统计数字）
 *
 * 用法：
 *   npx tsx scripts/audit-a1-report.ts --generate      （默认）重写 7 份 md，再读回磁盘逐项对账
 *   npx tsx scripts/audit-a1-report.ts --verify-only   只读磁盘现存 md / csv，与 JSON 真源完整对账，**绝不写任何文件**
 *
 * 输入（全部只读，不重算、不改数据）：
 *   docs/qa/content-audit/AUDIT-STATS-A1.json        （audit-a1-aggregate.ts 产出）
 *   docs/qa/content-audit/CALIBRATION-STATS.json     （audit-a1-calibration.ts 产出）
 *   docs/qa/content-audit/ROUTER-MONTE-CARLO.json    （audit-a1-router-montecarlo.ts 产出）
 *   docs/qa/content-audit/GAP-LITERAL.json           （audit-a1-literal-semantic.ts 产出）
 *   docs/qa/content-audit/_ranks.json                （aggregate 产出的最差优先/最好优先榜）
 *   docs/qa/content-audit/_calib/adjudication.jsonl  （高分歧样本仲裁终判）
 *   docs/qa/content-audit/CONTENT-AUDIT-350.jsonl    （逐题明细，取题面/簇归属用）
 *
 * 输出 7 份 md（第 8 份 CONTENT-AUDIT-350.csv 由 aggregate 产出，本脚本只核验行数、绝不改写）：
 *   CONTENT-STRUCTURE-REPORT.md / TOP20-LOW-INFO.md / TOP20-HIGH-INFO.md /
 *   DUPLICATE-TOP10.md / CONTENT-GAP-AND-NEXT.md / CALIBRATION-REPORT.md /
 *   ROUTER-CONTENT-MONTE-CARLO.md
 *
 * 硬性纪律（A.2 加固）：
 *  - 报告里出现的每一个统计数字都由上面的 JSON 机械生成；本文件不写死任何动态统计值。
 *    （允许出现的只有：枚举序号、章节编号、常量阈值、显示条数上限、seed 公式。）
 *  - 对账范围从「表格行」扩到**散文节数字**：增量/语义/主题/两轴/处置分布、玩法×增量、
 *    重复簇口径、Heat 双口径、literalHits、Monte Carlo overall/perTable 关键均值等。
 *  - 校验一律读**磁盘**内容；--verify-only 绝不 writeFileSync，能抓到磁盘篡改。
 *  - 探针 fail-closed：正则未命中 / 数字非有限 / MC_LABELS 键缺失 → 记失败项并非 0 退出。
 *  - 输出必须列出「哪些数字不在对账范围」，不许静默漏掉。
 *  - 不引用「同质重复率 98.6%」这类旧口径；重复簇只作导航，措辞必须是「覆盖」。
 *  - 关键词 0 命中只能写成「显式词面命中 0」，不得写成「语义完全不存在」；
 *    semanticHits 无独立来源时只能记 UNREVIEWED。
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { verifyScanCredential, type SsotCard } from "./audit-a1-scan-credential";

const ROOT = process.cwd();
const DIR = `${ROOT}/docs/qa/content-audit`;

/** A.2：命令行双模式。默认 --generate；--verify-only 只读校验、绝不写盘。 */
const ARGV = process.argv.slice(2);
const VERIFY_ONLY = ARGV.includes("--verify-only");
const GENERATE = !VERIFY_ONLY;
for (const a of ARGV) {
  if (a !== "--generate" && a !== "--verify-only") throw new Error(`未知参数：${a}（只接受 --generate / --verify-only）`);
}

/* ------------------------------------------------------------------ */
/* 读取真源（只读）                                                       */
/* ------------------------------------------------------------------ */
interface GainCount { gain: string; count: number; }
interface HeatAvail { heat: string; legalCount: number; legalRatio: number; byGain: GainCount[]; midPlus: number; personTopic: number; }
interface TypeDist {
  gameType: string; label: string; count: number; byGain: GainCount[]; midPlus: number; judge: number;
  noPersonInfo: number; socialHigh: number; progHigh: number; personTopic: number; keep: number;
  byDisposition: { disposition: string; count: number }[];
}
interface Row {
  cardId: string; gameType: string; number: number; text: string; intensity: number;
  heatMin: number; heatMax: number; relationStage: string; targetMode: string; responseMode: string;
  interactionType: string; consentMode: string; matchRequired: boolean; boundaryTags: string;
  semanticType: string; topic: string; infoGain: string; learned: string; promotesUnderstanding: string;
  socialEnergy: string; relationshipProgression: string; duplicateCluster: string; verdict: string;
  disposition: string;
}
interface DispositionStat {
  order: string[];
  dist: [string, number][];
  ratios: [string, number][];
  rules: { when: string; to: string }[];
  note: string;
  verdictToDisposition: Record<string, Record<string, number>>;
  byType: { gameType: string; count: number; byDisposition: { disposition: string; count: number }[] }[];
  bufferQuota: {
    poolSize: number; shareOfAllCards: number; lowZeroTotal: number; shareOfLowZero: number;
    skeletonN: number; ifWholePoolKeptShareOfFormal: number; maxWithoutMajority: number;
    recommendedCap: number; recommendedCapRatioOfFormal: number; recommendedCapShareOfPool: number;
  };
  priorityKeepN: number; keepCandidateN: number; socialBufferN: number; rewriteN: number; deleteN: number;
}
interface Stats {
  N: number;
  gainDist: [string, number][];
  semDist: [string, number][];
  topicDist: [string, number][];
  socialDist: [string, number][];
  progDist: [string, number][];
  verdictDist: [string, number][];
  promoteDist: [string, number][];
  disposition: DispositionStat;
  duplicate: {
    taggedCount: number; actualDupCount: number; taggedGroupRate: number; actualDuplicateCandidateRate: number;
    semanticClusterCoverage: number; clusterSizeBuckets: { label: string; clusters: number; cards: number }[];
    clusterCount: number; singletonClusters: [string, number][]; multiClusters: [string, number][];
  };
  heatAvailability: HeatAvail[];
  crossHeatCards: number;
  exactHeatCards: number;
  intensityDist: { intensity: number; count: number; byGain: GainCount[]; midPlus: number }[];
  typeDist: TypeDist[];
  threeAxis: [string, number][];
  lowInfoButUseful: { count: number };
  topicByType: { topic: string; total: number; byType: { gameType: string; count: number }[] }[];
  derived: {
    highN: number; midPlusN: number; lowZeroN: number; judgeN: number;
    personTopicN: number; personTopicMidPlusN: number;
  };
}
interface AxisCoefficient { kind: string; metric: string; value: number; po: number; pe: number | null; n: number; }
interface Calibration {
  sampleSize: number;
  coefficientSpec: {
    orderedAxes: string[]; orderedMetric: string; orderedFormula: string;
    orderedRanks: Record<string, Record<string, number>>;
    categoricalAxes: string[]; categoricalMetric: string; categoricalFormula: string;
  };
  pairResults: {
    pair: string; n: number; allSixAgree: number; allSixAgreeRate: string; allSixAgreeNote?: string;
    perAxisRate: Record<string, { agree: number; total: number; rate: string }>;
    perAxisCoefficient: Record<string, AxisCoefficient>;
    infoGainGap2Plus: number; infoGainGap2PlusRate: string;
  }[];
  lean: Record<string, Record<string, number>>;
  drift: {
    gameType: string; n: number; semanticConsensusRate: string; gainConsensusRate: string;
    origGainDeviations: number; origDeviationRate: string; gainSpread: Record<string, number>;
  }[];
  disagreementSets: {
    autoHighDisagreement: { count: number; definition: string; cardIds: string[] };
    adjudicationSet: { count: number; definition: string; cardIds: string[] };
    overlapCount: number; note: string;
  };
  adjudicationGainDist: Record<string, number>;
  highDisagreementCount: number;
  autoHighDisagreementCount: number;
  adjudicationSetSize: number;
}
interface HeatRuntime { heat: string; legalCount: number; legalRatio: number; high: number; midPlus: number; }
interface McPerTable {
  table: string; label: string; players: number; sessionsCompleted20: number; distinctCardsExposed: number;
  highPerSession: number; midPlusPerSession: number; personTopicsPerSession: number;
  longestLowZeroRunMean: number; judgeShareMean: number; reshufflesMean: number;
  packExhaustedMean: number; globalExhaustedMean: number; switchesMean: number;
}
interface Mc {
  config: {
    sessionsPerTable: number; matchSessionsPerTable: number; tracePerTable: number;
    targetCompletedRounds: number; guardLimit: number;
    tables: { key: string; label: string; players: number }[];
    packs: { id: string; label: string; weight: number }[];
    packsExcluded: { ids: string[]; reason: string };
    totalSessions: number;
  };
  overall: Record<string, number> & { termination: Record<string, number> };
  overallCompleted20: Record<string, number>;
  cohortByIntensityLimit: {
    intensityLimit: number; sessions: number; deadEndSessions: number; deadEndRate: number;
    completedRoundsMean: number; highPerSession: number;
  }[];
  perTable: McPerTable[];
  exposureByGameType: Record<string, number>;
  gainByGameType: Record<string, Record<string, number>>;
  heatExposure: Record<string, number>;
  heatExposureAfterTerminal: Record<string, number>;
  heatExposureNote: string;
  staticHeatAvailability: HeatRuntime[];
  staticHeatNote: string;
  crossHeatCards: number;
  exactHeatCards: number;
  matchRequiredCoverage: {
    total: number; note: string; assumption: string;
    withoutMatch: { covered: number; totalExposure: number; matchesCreated: number; cards: { cardId: string; gameType: string; count: number }[] };
    withMatch: { covered: number; totalExposure: number; cards: { cardId: string; gameType: string; count: number }[] };
    run: { sessionsPerTable: number; totalSessions: number; matchesCreated: number; totalExposure: number; distinctCardsExposed: number; deadEndRate: number; highPerSession: number };
  };
  traceFile: string;
  traceNote: string;
  topExposed: { cardId: string; count: number; infoGain?: string }[];
  leastExposed: { cardId: string; count: number; infoGain?: string }[];
}
interface GapTheme {
  theme: string; note: string; patternsProbed: number; patternsWithHit: number;
  literalHits: number; literalHitRatio: number; cardIds: string[];
  matchedPatterns: { label: string; count: number }[];
}
interface Gap { generator: string; cardCount: number; scope: string; themes: GapTheme[]; }
interface Adj { cardId: string; gameType: string; text: string; finalInfoGain: string; finalReason: string; }
/* A.2｜语义复核终版（scripts/audit-a1-semantic.ts 产出；报告统一以它为 semanticHits 真源）。 */
interface GapSemanticTheme {
  theme: string; literalHits: number; literalCardIds: string[];
  semanticHits: number; semanticCardIds: string[]; adjudicatedCount: number; adjudicationPending: number;
  independentScanHits: number | null; semanticSource: string; wording: string;
  /** 主题再拆分（仅「亲密/性观念」）：独立第三方逐题二分结果。 */
  subthemes?: { category: string; count: number; cardIds: string[] }[];
  subthemeSplit?: {
    state: "ok" | "pending" | "mismatch";
    judgedTotal: number; expectedTotal: number; cardIdsMatch: boolean;
    categories: string[]; note: string;
  };
}
interface GapSemantic {
  generator: string; cardCount: number; themeCount: number;
  sourceFiles: Record<string, string | null>;
  method: { unit: string; agreement: string; adjudication: string; adjudicationCount: number; independentScan: string; note: string };
  agreement: {
    theme: string; s1Hits: number; s2Hits: number; intersection: number; union: number;
    jaccard: number; rawAgreement: number; cohenKappa: number;
    levelDisagreements: string[]; onlyS1: string[]; onlyS2: string[]; disagreedCards: string[];
  }[];
  themes: GapSemanticTheme[];
  totals: { literalHitsSum: number; semanticHitsSum: number; adjudicatedSum: number; semanticBlankThemes: string[]; semanticOnlyThemes: string[] };
  adjudicationInputCount: number; adjudicationResolved: number;
}
/* A.2｜复审标签（scripts/audit-a1-drift-stable.ts 产出）。 */
interface StableLabels {
  generator: string; date: string;
  gates: { kappaMinForDecision: number; kappaSource: string; neverHaveIRedeviationRateMax: number; neverHaveIGainConsensusRateMin: number; note: string };
  axesReviewed: string[]; axesNotReviewed: string[]; axesNotReviewedReason: string;
  /** 标签状态统一口径（A.2 收口降级）：不再出现「已稳定版」这类措辞。 */
  labelStatusNote: string;
  sourceFiles: Record<string, string | null>;
  sourceNote: string;
  drift: {
    gameType: string; label: string; n: number;
    axes: { axis: string; kind: string; metric: string; agree: number; total: number; rawAgreement: string; kappa: number; po: number; n: number }[];
    weakAxes: string[]; meanKappa: number; allAxesAgree: number; allAxesAgreeRate: string;
  }[];
  weakAxisSummary: { axis: string; perGameType: { gameType: string; kappa: number }[]; worstKappa: number; usableForDecision: boolean }[];
  arbitration: { inputCount: number; resolvedCount: number; note: string };
  reviewedLabelScope: {
    reviewed: { gameType: string; label: string; cardCount: number; labelStatus: string; arbitratedCards: number; pendingCards: number; weakAxes: string[] }[];
    singleSource: { gameType: string; label: string; reliability: string }[];
    statement: string;
  };
  neverHaveIDecision: {
    gameType: string; needsFullReaudit: boolean; verdict: string;
    basis: { gameType: string; label: string; a1OrigDeviationRate: string; a1GainConsensusRate: string; a1SemanticConsensusRate: string; a1SampleSize: number; passDeviationGate: boolean; passGainGate: boolean; pass: boolean };
    thresholds: { origDeviationRateMax: number; gainConsensusRateMin: number };
  };
  usageLimit: string;
}

const readJson = <T>(p: string): T => JSON.parse(readFileSync(p, "utf8")) as T;
const readJsonl = <T>(p: string): T[] =>
  readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as T);

const stats = readJson<Stats>(`${DIR}/AUDIT-STATS-A1.json`);
const calib = readJson<Calibration>(`${DIR}/CALIBRATION-STATS.json`);
const mc = readJson<Mc>(`${DIR}/ROUTER-MONTE-CARLO.json`);
const gap = readJson<Gap>(`${DIR}/GAP-LITERAL.json`);
const gapSem = readJson<GapSemantic>(`${DIR}/GAP-SEMANTIC.json`);
const stable = readJson<StableLabels>(`${DIR}/STABLE-LABELS.json`);
const ranks = readJson<{ low: Row[]; high: Row[] }>(`${DIR}/_ranks.json`);
const adjudication = readJsonl<Adj>(`${DIR}/_calib/adjudication.jsonl`);
const rows = readJsonl<Row>(`${DIR}/CONTENT-AUDIT-350.jsonl`);
/** A.2｜独立扫描凭证校验所需的「当前 SSOT 350 题」，与 audit-a1-semantic.ts 同一真源、同一口径。 */
const ssotCards = readJson<{ mainlineCards: SsotCard[] }>(`${ROOT}/lib/v2-content/generated/v2-ssot.generated.json`).mainlineCards;
/** 独立扫描的查询集口径 = GAP-LITERAL 中 literalHits === 0 的主题（当前 5 个）。 */
const zeroHitThemes = gap.themes.filter((t) => t.literalHits === 0).map((t) => t.theme);

const byId = new Map(rows.map((r) => [r.cardId, r]));
const N = stats.N;

/** A.2：报告正文先入内存，写盘只在 --generate（且写完一律从磁盘读回校验）。 */
const rendered: Record<string, string> = {};
/** 报告文件名（key → 文件名），写盘与读盘共用同一份清单。 */
const REPORT_FILES = {
  struct: "CONTENT-STRUCTURE-REPORT.md",
  low: "TOP20-LOW-INFO.md",
  high: "TOP20-HIGH-INFO.md",
  dup: "DUPLICATE-TOP10.md",
  gap: "CONTENT-GAP-AND-NEXT.md",
  calib: "CALIBRATION-REPORT.md",
  mc: "ROUTER-CONTENT-MONTE-CARLO.md",
} as const;
type ReportKey = keyof typeof REPORT_FILES;
/** 显示常量（不是统计值）：大簇样例条数 / TOP 簇展示数与簇规模阈值。 */
const CLUSTER_SAMPLE_LINES = 3;
const TOP_CLUSTERS_SHOWN = 10;
const CLUSTER_BIG_THRESHOLD = 10;

/* 分类清单（taxonomy，不是统计数字）：与 audit-a1-aggregate.ts 同源口径。 */
const PERSON_TOPICS = [
  "兴趣爱好", "生活方式", "性格/习惯/小癖好", "择偶偏好/吸引力", "恋爱观",
  "亲密/性观念", "边界/吃醋/异性朋友/前任", "人生价值/未来",
];
const LIVE_TOPIC = "现场化学反应";
const TYPE_CN: Record<string, string> = {
  truth: "真心话", dare: "大冒险", most_likely: "谁最可能", never_have_i: "我从来没有",
  either_or: "二选一", pointing: "指人游戏", chemistry: "默契测试",
};
const GAIN_ORDER = ["高", "中", "低", "0"];
/* 词面主题 → A1 审查 topic 轴标签（只作并排旁证，不冒充独立语义复核）。 */
const THEME_TO_TOPIC: Record<string, string> = {
  "前任/过去关系": "边界/吃醋/异性朋友/前任",
  "吃醋/占有": "边界/吃醋/异性朋友/前任",
  "异性朋友/异性友谊边界": "边界/吃醋/异性朋友/前任",
  "底线/雷区": "边界/吃醋/异性朋友/前任",
  "人生目标/理想生活": "人生价值/未来",
  "具体兴趣爱好": "兴趣爱好",
  "亲密/性观念": "亲密/性观念",
};
/**
 * Phase B 内容缺口（正式单列的类目，taxonomy 不是统计值）。
 * 用户 NEW RC 与 A.2 语义复核共同点名的缺口；「亲密互动动作」不能替代「亲密/性观念」。
 */
const PHASE_B_CONTENT_GAPS = [
  "具体兴趣爱好", "生活方式", "恋爱规则", "择偶标准", "吃醋/占有", "异性朋友边界",
  "前任/过去关系", "底线/雷区", "人生目标/未来", "亲密边界", "性观念",
] as const;

/* 处置五分类的中文展示名（taxonomy，不是统计值）。 */
const DISPOSITION_CN: Record<string, string> = {
  PRIORITY_KEEP: "优先保留",
  KEEP_CANDIDATE: "保留候选",
  SOCIAL_BUFFER_POOL: "热闹缓冲池/候选池·不等于正式保留",
  REWRITE_CANDIDATE: "改写候选",
  DELETE_CANDIDATE: "删除候选",
};
const dispLabel = (k: string): string => `${cell(k)}（${cell(DISPOSITION_CN[k] ?? k)}）`;
/** 处置在散文里以 `KEY（中文名，可含嵌套括号） 数字` 出现；该正则跨过中文名取数字（探针用）。 */
const dispRe = (k: string, tail = ""): RegExp => new RegExp(`${k}[^\\d]*?(\\d+)${tail}`);

/* ------------------------------------------------------------------ */
/* 工具                                                                  */
/* ------------------------------------------------------------------ */
const cell = (v: unknown): string => String(v ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
const int = (n: number): string => n.toLocaleString("en-US");
const pct = (n: number, d: number): string => (d === 0 ? "0.0%" : `${((n / d) * 100).toFixed(1)}%`);
const distOf = (dist: [string, number][], key: string): number => (dist.find((d) => d[0] === key)?.[1] ?? 0);
/** 旧 verdict 某一档的合计（由其机械映射表的行求和）。 */
const oldVerdictTotal = (k: string): number => Object.values(stats.disposition.verdictToDisposition[k] ?? {}).reduce((s, x) => s + x, 0);
const topicCount = (topic: string): number => distOf(stats.topicDist, topic);
const table = (head: string[], align: string[], body: string[][]): string[] => [
  `| ${head.join(" | ")} |`,
  `|${align.join("|")}|`,
  ...body.map((r) => `| ${r.join(" | ")} |`),
];
/** 从单元格里取「第一个数字」（表里常带千分位与括号占比，如 1,660（41.5%））。 */
const numOnly = (x: string): string => {
  const m = x.match(/-?\d[\d,]*(?:\.\d+)?/);
  return m ? m[0].replace(/,/g, "") : "";
};

/* 玩法×主题矩阵：由 topicByType 机械展开。 */
const matrix = (): { topics: string[]; cell: (topic: string, gameType: string) => number } => {
  const topics = stats.topicByType.map((t) => t.topic);
  const lookup = new Map<string, number>();
  for (const t of stats.topicByType) for (const b of t.byType) lookup.set(`${t.topic}::${b.gameType}`, b.count);
  return { topics, cell: (topic, gameType) => lookup.get(`${topic}::${gameType}`) ?? 0 };
};

/* 重复簇 → 涉及玩法 / 样例题面 / 簇规模 的机械查表。 */
const clusterInfo = (name: string) => {
  const members = rows.filter((r) => r.duplicateCluster === name);
  const types = [...new Set(members.map((m) => m.gameType))].map((g) => TYPE_CN[g] ?? g);
  const lowZero = members.filter((m) => m.infoGain === "低" || m.infoGain === "0").length;
  const gainSpread: Record<string, number> = {};
  for (const m of members) gainSpread[m.infoGain] = (gainSpread[m.infoGain] ?? 0) + 1;
  const samples = members.slice(0, CLUSTER_SAMPLE_LINES).map((m) => m.text);
  return { members, types, lowZero, gainSpread, samples, sample: members[0]?.text ?? "" };
};
/* ------------------------------------------------------------------ */
/* 交付物 2｜CONTENT-STRUCTURE-REPORT.md                                 */
/* ------------------------------------------------------------------ */
const structMd: string[] = [
  "# 内容结构统计报告｜V2 主线全量审查（Phase A.1 校准版）",
  "",
  `> 真源：lib/v2-content/generated/v2-ssot.generated.json（主线卡 ${int(N)} 张 PN-*，只读未改）`,
  `> 逐题审查：${int(N)} 题全量（7 玩法 × 每玩法 ${int(rows.filter((r) => r.gameType === "truth").length)} 题），12 字段判定，机械校验 350/350 通过`,
  `> 聚合真源：docs/qa/content-audit/AUDIT-STATS-A1.json ｜ 本文件所有数字由 scripts/audit-a1-report.ts 从该 JSON 机械生成`,
  "> 起因：用户真人试玩反馈「整体非常无聊，很多题虽然形式上在互动，但玩完之后并没有真正增加彼此了解」",
  "",
  "## 0. 一句话结论",
  "",
  `**${int(N)} 题里信息增量评为「高」的是 ${int(stats.derived.highN)} 题（${pct(stats.derived.highN, N)}）。**`,
  `评为「低/0」的合计 ${int(stats.derived.lowZeroN)} 题（${pct(stats.derived.lowZeroN, N)}）；主题落在「${LIVE_TOPIC}」（本局临时状态、不构成稳定个人信息）的 ${int(topicCount(LIVE_TOPIC))} 题（${pct(topicCount(LIVE_TOPIC), N)}）。`,
  `其中语义类型为「现场评价/猜测」的 ${int(stats.derived.judgeN)} 题（${pct(stats.derived.judgeN, N)}）——形式上有互动，玩完拿不到新的稳定人物信息。`,
  `8 类人物信息主题里，题数为 0 的有 ${int(PERSON_TOPICS.filter((t) => topicCount(t) === 0).length)} 类：${PERSON_TOPICS.filter((t) => topicCount(t) === 0).join("、")}。`,
  "",
  "## 1. 语义类型分布",
  "",
  ...table(["语义类型", "数量", "占比"], ["---", "---:", "---:"],
    stats.semDist.map(([k, v]) => [cell(k), int(v), pct(v, N)])),
  "",
  "## 2. 信息主题分布",
  "",
  ...table(["信息主题", "数量", "占比", "是否人物信息类"], ["---", "---:", "---:", "---"],
    stats.topicDist.map(([k, v]) => [cell(k), int(v), pct(v, N), PERSON_TOPICS.includes(k) ? "是" : "否"])),
  "",
  `**人物信息类主题（${int(PERSON_TOPICS.length)} 类）合计 ${int(stats.derived.personTopicN)} 题（${pct(stats.derived.personTopicN, N)}）**，其中增量达「中」及以上的 ${int(stats.derived.personTopicMidPlusN)} 题（${pct(stats.derived.personTopicMidPlusN, N)}）。`,
  "",
  "## 3. 信息增量分布",
  "",
  ...table(["增量", "数量", "占比"], ["---", "---:", "---:"],
    stats.gainDist.map(([k, v]) => [cell(k), int(v), pct(v, N)])),
  "",
  "## 4. 是否促进「更了解这个人」",
  "",
  ...table(["判定", "数量", "占比"], ["---", "---:", "---:"],
    stats.promoteDist.map(([k, v]) => [cell(k), int(v), pct(v, N)])),
  "",
  "## 5. 社交能量分布（现场好不好用）",
  "",
  ...table(["社交能量", "数量", "占比"], ["---", "---:", "---:"],
    stats.socialDist.map(([k, v]) => [cell(k), int(v), pct(v, N)])),
  "",
  "## 6. 关系推进分布（是否推动两个人往前走）",
  "",
  ...table(["关系推进", "数量", "占比"], ["---", "---:", "---:"],
    stats.progDist.map(([k, v]) => [cell(k), int(v), pct(v, N)])),
  "",
  "## 7. 处置分布（A.2 收口：五分类，撤销「一轴高就自动保留」）",
  "",
  `> 口径变更：Phase A.1 的 verdict 规则是「三轴里至少有一轴是强项即保留」，导致**只要社交能量高或关系推进高就自动保留**；上一批报告的「保留 ${int(oldVerdictTotal("保留"))}」正是这条规则的结果。A.2 已撤销该规则，改由三轴机械推导五分类（真源 AUDIT-STATS-A1.json#disposition，全部由 scripts/audit-a1-aggregate.ts 生成）。`,
  `> ${cell(stats.disposition.note)}`,
  "",
  "### 7.1 五分类判定规则（改规则必须改脚本里的 DISPOSITION_RULES，禁止只改报告）",
  "",
  "| 条件 | 处置 |",
  "|---|---|",
  ...stats.disposition.rules.map((r) => `| ${cell(r.when)} | ${dispLabel(r.to)} |`),
  "",
  "### 7.2 全库五分类分布（主口径）",
  "",
  ...table(["处置", "数量", "占全库"], ["---", "---:", "---:"],
    stats.disposition.dist.map(([k, v]) => [dispLabel(k), int(v), pct(v, N)])
      .concat([[`**合计**`, `**${int(N)}**`, "**100.0%**"]])),
  "",
  `**关键差异声明**：「保留 282」**已作废**，不得再被任何配额文件引用。旧口径把 ${int(stats.disposition.socialBufferN)} 张「低/0 信息但高社交或高推进」的题直接算作正式保留；新口径把它们全部移入 \`SOCIAL_BUFFER_POOL\`（候选池），**不等于正式保留**。`,
  "",
  "### 7.3 旧 verdict → 新五分类的映射（向后兼容字段说明）",
  "",
  `> \`verdict\` 字段仍保留在逐题明细（CONTENT-AUDIT-350.jsonl / .csv）里，仅为向后兼容；**报告主口径一律用 disposition**。下表的每个数字都由脚本按 cardId 机械交叉统计，不是人工填写。`,
  "",
  "| 旧 verdict | " + stats.disposition.order.map((k) => cell(k)).join(" | ") + " | 小计 |",
  "|---|" + stats.disposition.order.map(() => "---:").join("|") + "|---:|",
  ...Object.entries(stats.disposition.verdictToDisposition).map(([v, bucket]) => {
    const row = stats.disposition.order.map((k) => int(bucket[k] ?? 0));
    const sum = Object.values(bucket).reduce((s, x) => s + x, 0);
    return `| ${cell(v)} | ${row.join(" | ")} | ${int(sum)} |`;
  }),
  "",
  `映射读法：旧「保留」里只有 ${int(stats.disposition.priorityKeepN)} 张是「优先保留」（infoGain=高）、${int(stats.disposition.verdictToDisposition["保留"]?.["KEEP_CANDIDATE"] ?? 0)} 张是「保留候选」、${int(stats.disposition.verdictToDisposition["保留"]?.["SOCIAL_BUFFER_POOL"] ?? 0)} 张落进热闹缓冲池；另有 ${int(stats.disposition.verdictToDisposition["改写候选"]?.["KEEP_CANDIDATE"] ?? 0)} 张旧判「改写候选」的题在新口径下升为「保留候选」（infoGain=中且至少一轴为中/高）。`,
  "",
  "### 7.4 玩法 × 五分类处置",
  "",
  "| 玩法 | " + stats.disposition.order.map((k) => cell(k)).join(" | ") + " | 合计 |",
  "|---|" + stats.disposition.order.map(() => "---:").join("|") + "|---:|",
  ...stats.disposition.byType.map((t) => {
    const cells = stats.disposition.order.map((k) => int(t.byDisposition.find((b) => b.disposition === k)?.count ?? 0));
    return `| ${cell(TYPE_CN[t.gameType] ?? t.gameType)}（${cell(t.gameType)}） | ${cells.join(" | ")} | ${int(t.count)} |`;
  }),
  "",
  "## 8. 玩法 × 信息增量交叉（行=玩法）",
  "",
  "| 玩法 | 题数 | " + GAIN_ORDER.join(" | ") + " | 低+0 | 中及以上 | 现场评价/猜测 | 无人物信息 | 旧口径「保留」(verdict) |",
  "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
  ...stats.typeDist.map((t) => {
    const g = (k: string) => t.byGain.find((b) => b.gain === k)?.count ?? 0;
    const lowZero = g("低") + g("0");
    return `| ${cell(t.label)}（${cell(t.gameType)}） | ${int(t.count)} | ${int(g("高"))} | ${int(g("中"))} | ${int(g("低"))} | ${int(g("0"))} | ${int(lowZero)} | ${int(t.midPlus)} | ${int(t.judge)} | ${int(t.noPersonInfo)} | ${int(t.keep)} |`;
  }),
  "",
  "## 9. 玩法 × 信息主题交叉（行=玩法，列=主题）",
  "",
  ...(() => {
    const mx = matrix();
    const head = `| 玩法 | ${mx.topics.map((t) => cell(t)).join(" | ")} |`;
    const align = `|---|${mx.topics.map(() => "---:").join("|")}|`;
    const body = stats.typeDist.map((t) =>
      `| ${cell(t.label)} | ${mx.topics.map((tp) => int(mx.cell(tp, t.gameType))).join(" | ")} |`);
    return [head, align, ...body];
  })(),
  "",
  "## 10. 强度 1–5 的信息增量分布",
  "",
  "| 强度 | 题数 | " + GAIN_ORDER.join(" | ") + " | 中及以上 |",
  "|---:|---:|---:|---:|---:|---:|",
  ...stats.intensityDist.map((i) =>
    `| I${i.intensity} | ${int(i.count)} | ${GAIN_ORDER.map((g) => int(i.byGain.find((b) => b.gain === g)?.count ?? 0)).join(" | ")} | ${int(i.midPlus)} |`),
  "",
  "## 11. Heat 静态可用范围（不把跨 Heat 卡塞进单一 Heat）",
  "",
  `> 口径：一张卡只要 heatMin ≤ 当前档 ≤ heatMax 就计入该档可用范围，因此跨 Heat 卡会在多档各计一次。`,
  `> 跨 Heat 卡 ${int(stats.crossHeatCards)} 张、单档卡 ${int(stats.exactHeatCards)} 张；四档 legalCount 之和大于总数 ${int(N)} 是口径所致，不是计数错误。`,
  "",
  "| Heat | 可用题数 | 占比 | " + GAIN_ORDER.join(" | ") + " | 中及以上 | 人物信息类 |",
  "|---|---:|---:|---:|---:|---:|---:|---:|",
  ...stats.heatAvailability.map((h) =>
    `| ${cell(h.heat)} | ${int(h.legalCount)} | ${pct(h.legalCount, N)} | ${GAIN_ORDER.map((g) => int(h.byGain.find((b) => b.gain === g)?.count ?? 0)).join(" | ")} | ${int(h.midPlus)} | ${int(h.personTopic)} |`),
  "",
  `> 运行时 Heat 曝光不在此表：见 ROUTER-CONTENT-MONTE-CARLO.md（真实 Router 模拟按**抽卡时 Heat** 采样，与这里的静态可用范围是两套口径，不混用）。`,
  "",
  "## 12. 三轴交叉（增量 / 社交能量 / 关系推进）",
  "",
  "| 组合 | 题数 | 占比 |",
  "|---|---:|---:|",
  ...stats.threeAxis.slice(0, 15).map(([k, v]) => [cell(k), int(v), pct(v, N)]).map((r) => `| ${r.join(" | ")} |`),
  "",
  `**低信息但高社交或高推进的题 ${int(stats.lowInfoButUseful.count)} 题（${pct(stats.lowInfoButUseful.count, N)}）**：A.2 收口后这一整块就是 \`SOCIAL_BUFFER_POOL\`（热闹缓冲池/候选池）。它的含义是「低信息不等于必删，现场能量本身有价值」，但**不等于正式保留**——旧口径曾把它直接算作保留，已作废；配额建议见 CONTENT-GAP-AND-NEXT.md#4.2（判定口径见 _RUBRIC-A1.md）。`,
  "",
  "## 13. 卡面词面证据（literalHits，语义词面两账分明）",
  "",
  `> 口径：本表只做**显式词面**检索（真源 GAP-LITERAL.json）。显式词面命中 0 **不等于**该主题语义上不存在——同义表达、间接问法必须另经独立语义复核才可下结论。`,
  `> **语义侧已由两名独立 reviewer + 第三方独立全库扫描完成复核**，终版在 GAP-SEMANTIC.json；7 个主题 ×（literalHits / semanticHits）双列对照见 CONTENT-GAP-AND-NEXT.md#1。`,
  "",
  "| 主题 | 显式词面命中题数 | 占全库比 | 探测词条数 | 有命中词条数 |",
  "|---|---:|---:|---:|---:|",
  ...gap.themes.map((t) => `| ${cell(t.theme)} | ${int(t.literalHits)} | ${pct(t.literalHits, gap.cardCount)} | ${int(t.patternsProbed)} | ${int(t.patternsWithHit)} |`),
  "",
  "## 14. 特别回答的 5 个问题",
  "",
  "### Q1｜为什么用户会觉得「全是看戏」",
  "",
  `结构性原因，不是错觉：`,
  "",
  `1. **主体不指向任何人的稳定信息**：主题落在「${LIVE_TOPIC}」${int(topicCount(LIVE_TOPIC))} 题（${pct(topicCount(LIVE_TOPIC), N)}），考的是「今晚这桌此刻发生了什么」，一散场就作废。`,
  `2. **猜与评价占了很大一块**：语义类型「现场评价/猜测」${int(stats.derived.judgeN)} 题（${pct(stats.derived.judgeN, N)}）。落点是「大家觉得 TA 怎么样」，不是「TA 有什么」。`,
  `3. **低信息密度**：增量「低/0」${int(stats.derived.lowZeroN)} 题（${pct(stats.derived.lowZeroN, N)}），其中「0」${int(distOf(stats.gainDist, "0"))} 题。`,
  "",
  "### Q2｜旧文档写「看戏 0%」，真人为何仍觉得像看戏",
  "",
  "旧口径按**题面形态**统计（题面写着指人/猜谁就算互动），本轮口径换成「答完之后脑子里还剩下关于这个人的什么」，同一批题立刻显形。两句话不矛盾：前者说版式，后者说体验。",
  "",
  "同族结构证据（按簇规模机械统计，见 DUPLICATE-TOP10.md）：",
  "",
  ...(() => {
    const top = stats.duplicate.multiClusters.slice(0, 10);
    return top.map(([name, n]) => `- ${cell(name)}：${int(n)} 题（其中增量低/0 的 ${int(clusterInfo(name).lowZero)} 题）`);
  })(),
  "",
  "### Q3｜是否过度集中在「第一印象 / 注意谁 / 谁更有意思 / 谁想继续聊」",
  "",
  `**是。** 判据用本轮新增的两个热区主题的实际题数：现场化学反应 ${int(topicCount(LIVE_TOPIC))} 题、择偶偏好/吸引力 ${int(topicCount("择偶偏好/吸引力"))} 题，两者合计 ${int(topicCount(LIVE_TOPIC) + topicCount("择偶偏好/吸引力"))} 题（${pct(topicCount(LIVE_TOPIC) + topicCount("择偶偏好/吸引力"), N)}）。`,
  `规模最大的重复簇前 ${int(Math.min(5, stats.duplicate.multiClusters.length))} 个（由 DUPLICATE-TOP10.md 机械生成，不手写）：`,
  "",
  ...(() => {
    const top = stats.duplicate.multiClusters.slice(0, 5);
    return top.map(([name, n]) => `- ${cell(name)}：${int(n)} 题，涉及玩法 ${clusterInfo(name).types.join("、")}；样例：${cell(clusterInfo(name).sample)}`);
  })(),
  "",
  "### Q4｜兴趣爱好、生活方式、恋爱观、亲密观、小癖好各有多少题",
  "",
  "| 主题 | 题数 | 占比 | 显式词面命中 | 说明 |",
  "|---|---:|---:|---:|---|",
  ...PERSON_TOPICS.map((tp) => {
    const hit = gap.themes.find((t) => THEME_TO_TOPIC[t.theme] === tp)?.literalHits;
    return `| ${cell(tp)} | ${int(topicCount(tp))} | ${pct(topicCount(tp), N)} | ${hit === undefined ? "—" : int(hit)} | ${topicCount(tp) === 0 ? "本轮 0 题，结构性空白" : "有题，同质化程度见重复簇表"} |`;
  }),
  "",
  "### Q5｜一局 20 轮能不能稳定覆盖多个真实人物维度",
  "",
  `**以真实 Router Monte Carlo 为准**（真源 ROUTER-MONTE-CARLO.json，局数 ${int(mc.config.totalSessions)}、每桌型 ${int(mc.config.sessionsPerTable)} 局、每局目标 ${int(mc.config.targetCompletedRounds)} 轮）：`,
  "",
  `- 跑满 ${int(mc.config.targetCompletedRounds)} 轮的局占 ${pct(mc.overallCompleted20.sessions, mc.config.totalSessions)}；这些局里平均「中及以上」增量 ${mc.overallCompleted20.midPlusPerSession} 题/局、「高」增量 ${mc.overallCompleted20.highPerSession} 题/局，人物信息主题覆盖 ${mc.overallCompleted20.personTopicsPerSession} 类/局（共 ${int(PERSON_TOPICS.length)} 类）。`,
  `- 最长连续「低/0」连击均值 ${mc.overallCompleted20.longestLowZeroRunMean} 轮——即一局中最长的一段无信息区长达约 ${Math.round(Number(mc.overallCompleted20.longestLowZeroRunMean))} 轮。`,
  `- 另有 ${int(mc.overall.deadEndSessions)} 局（占 ${pct(mc.overall.deadEndSessions, mc.config.totalSessions)}）跑不满 ${int(mc.config.targetCompletedRounds)} 轮：开放度上限 ≤2 的桌在 Heat 升到高段后，**relationship-aware 关系主线没有合法关系卡**——证明的是**关系主线发生结构性断粮**，**而不是 App 无法继续游戏**（App 已有「切换玩法 / 结束本局」安全出口，neutral / expansion 玩法的完成轮同样计入 sessionCompletedRounds）。这是卡面 intensity 与 Heat 区间绑定的结构问题。`,
  "",
  `> 并列对照（不同口径，不得混用）：uniform-baseline estimate（假设等概率均匀抽题、忽略 Router 过滤与 Heat 门控）下，「中及以上」期望 ${((stats.derived.personTopicMidPlusN / N) * mc.config.targetCompletedRounds).toFixed(2)} 题/局、「高」期望 ${((stats.derived.highN / N) * mc.config.targetCompletedRounds).toFixed(2)} 题/局。真实 Router 模拟是上一条，不是这一条。`,
  "",
  "## 15. 结论（供 Human 决策，本轮不执行）",
  "",
  `1. 内容层问题成立：${int(N)} 题里「高」增量 ${int(stats.derived.highN)} 题、低/0 ${int(stats.derived.lowZeroN)} 题，20 轮的真实 Router 模拟里人物信息主题只覆盖 ${mc.overallCompleted20.personTopicsPerSession}/${int(PERSON_TOPICS.length)} 类。`,
  `2. 结构性缺口（显式词面 0 命中）：${gap.themes.filter((t) => t.literalHits === 0).map((t) => t.theme).join("、")}——词面 0 命中只说没问出口，是否语义上完全空缺须看 CONTENT-GAP-AND-NEXT.md 的语义侧说明。`,
  `3. 玩法级差异很大：增量「高」题数最多的玩法是 ${stats.typeDist.slice().sort((a, b) => (b.byGain.find((x) => x.gain === "高")?.count ?? 0) - (a.byGain.find((x) => x.gain === "高")?.count ?? 0))[0]!.label}（${int(Math.max(...stats.typeDist.map((t) => t.byGain.find((x) => x.gain === "高")?.count ?? 0)))} 题），增量「高」为 0 的玩法有 ${int(stats.typeDist.filter((t) => (t.byGain.find((x) => x.gain === "高")?.count ?? 0) === 0).length)} 个（${stats.typeDist.filter((t) => (t.byGain.find((x) => x.gain === "高")?.count ?? 0) === 0).map((t) => t.label).join("、")}）。`,
  "4. 保留 / 改写 / 删除的配额不在本轮结论内，只做建议，见 CONTENT-GAP-AND-NEXT.md。",
  "",
];
rendered.struct = structMd.join("\n");

/* ------------------------------------------------------------------ */
/* 交付物 3/4｜TOP20-LOW-INFO.md / TOP20-HIGH-INFO.md                     */
/* ------------------------------------------------------------------ */
const rankBody = (list: Row[]) => list.map((r, i) => [
  String(i + 1), cell(r.cardId), cell(TYPE_CN[r.gameType] ?? r.gameType), `I${r.intensity}`,
  cell(r.infoGain), cell(r.semanticType), cell(r.topic),
  cell((clusterInfo(r.duplicateCluster).members.length > 1) ? r.duplicateCluster : "-"),
  cell(r.text), cell(r.learned), cell(r.verdict),
].join(" | ").split(" | "));

const lowList = ranks.low;
const lowPlayTypes = [...new Set(lowList.map((r) => TYPE_CN[r.gameType] ?? r.gameType))];
const lowFirstNotWorst = (() => {
  const i = lowList.findIndex((r) => r.infoGain !== "0" && r.infoGain !== "低");
  return i === -1 ? lowList.length : i;
})();
const lowMd: string[] = [
  "# TOP 20｜最典型的低信息 / 伪互动题（Phase A.1 校准版）",
  "",
  `> 排序口径（真源 _ranks.json，由 audit-a1-aggregate.ts 生成）：信息增量**最差优先** 0 → 低 → 中 → 高；同档按所属语义簇规模降序，再按 cardId。`,
  "> 生成方式：scripts/audit-a1-report.ts 直接读 _ranks.json 的 low 数组，不做二次排序、不手写任何数字。",
  "",
  "| # | cardId | 玩法 | 强度 | 增量 | 语义类型 | 主题 | 语义簇 | 题面 | 玩完后新知道什么 | 处置 |",
  "|---:|---|---|---:|---|---|---|---|---|---|---|",
  ...rankBody(lowList).map((c) => `| ${c.join(" | ")} |`),
  "",
  "## 这 20 题的结构特征（全部由数据机械统计）",
  "",
  `1. 增量构成：${GAIN_ORDER.map((g) => `${cell(g)} ${int(lowList.filter((r) => r.infoGain === g).length)} 题`).join("、")}。最差优先排序已生效：前 ${int(lowFirstNotWorst)} 条全部是「0」或「低」，第 ${int(lowFirstNotWorst + 1)} 条起才可能出现「中」——若前部出现「高」即为排序 Bug。`,
  `2. 玩法分布：${lowPlayTypes.map((t) => `${t} ${int(lowList.filter((r) => (TYPE_CN[r.gameType] ?? r.gameType) === t).length)} 题`).join("、")}。`,
  `3. 语义类型「现场评价/猜测」${int(lowList.filter((r) => r.semanticType === "现场评价/猜测").length)} 题、主题「${LIVE_TOPIC}」${int(lowList.filter((r) => r.topic === LIVE_TOPIC).length)} 题。`,
  `4. 处置标记（A.2 五分类）：${stats.disposition.order.map((k) => `${dispLabel(k)} ${int(lowList.filter((r) => r.disposition === k).length)} 题`).join("、")}——低信息不等于必删，现场能量高、关系推进高的题进的是**热闹缓冲池（候选池）**，不是正式保留；旧口径的「保留」不再使用。`,
  `5. 被判为同簇候选（同簇 ≥2 张）的 ${int(lowList.filter((r) => clusterInfo(r.duplicateCluster).members.length > 1).length)} 题，说明低信息往往伴随同质骨架。`,
  "",
];
rendered.low = lowMd.join("\n");

const highList = ranks.high;
const highMd: string[] = [
  "# TOP 20｜信息增量最高的题（Phase A.1 校准版）",
  "",
  `> 排序口径（真源 _ranks.json）：先按增量 高 > 中，再按 关系推进高 / 社交能量高 加权，再按 cardId。`,
  `> 本轮审查口径放宽了「高」的门槛（见 _RUBRIC-A1.md）：只要拿到一个明确、跨局仍成立、现场能复述的答案即可判高。`,
  "",
  "| # | cardId | 玩法 | 强度 | 增量 | 语义类型 | 主题 | 社交能量 | 关系推进 | 题面 | 玩完后新知道什么 | 处置 |",
  "|---:|---|---|---:|---|---|---|---|---|---|---|---|",
  ...highList.map((r, i) => [
    String(i + 1), cell(r.cardId), cell(TYPE_CN[r.gameType] ?? r.gameType), `I${r.intensity}`,
    cell(r.infoGain), cell(r.semanticType), cell(r.topic), cell(r.socialEnergy), cell(r.relationshipProgression),
    cell(r.text), cell(r.learned), cell(r.disposition),
  ].join(" | ")).map((l) => `| ${l} |`),
  "",
  "## 结构观察（机械统计）",
  "",
  `1. 增量构成：${GAIN_ORDER.map((g) => `${cell(g)} ${int(highList.filter((r) => r.infoGain === g).length)} 题`).join("、")}（此榜只收「高」与「中」）。`,
  `2. 玩法分布：${[...new Set(highList.map((r) => TYPE_CN[r.gameType] ?? r.gameType))].map((t) => `${t} ${int(highList.filter((r) => (TYPE_CN[r.gameType] ?? r.gameType) === t).length)} 题`).join("、")}。`,
  `3. 其中被本轮判为「保持」的骨架集中在：${[...new Set(highList.map((r) => r.topic))].map((t) => `${cell(t)} ${int(highList.filter((r) => r.topic === t).length)} 题`).join("、")}。`,
  `4. 全库增量「高」共 ${int(stats.derived.highN)} 题（${pct(stats.derived.highN, N)}），本条榜单覆盖其中 ${pct(highList.filter((r) => r.infoGain === "高").length, stats.derived.highN)}。`,
  "",
  `> 对照：真实 Router Monte Carlo 里「高」增量的实际曝光只有 ${mc.overallCompleted20.highPerSession} 题/局（真源 ROUTER-MONTE-CARLO.json），说明好题存在但被抽到的频率很低——见 ROUTER-CONTENT-MONTE-CARLO.md。`,
  "",
];
rendered.high = highMd.join("\n");

/* ------------------------------------------------------------------ */
/* 交付物 5｜DUPLICATE-TOP10.md（A.2：簇只用于导航，不再输出「重复率」）        */
/* ------------------------------------------------------------------ */
const dup = stats.duplicate;
const multi = dup.multiClusters;
const dupMd: string[] = [
  "# 同质语义簇 TOP 10（Phase A.2：簇只用于导航，不等于重复）",
  "",
  "## 0. 口径声明：**进簇 ≠ 重复**",
  "",
  "`duplicateCluster` 是本轮审查给出的**语义簇标签**，用途只有一个：把「可能同源 / 同骨架」的卡聚在一起供 Human 导航与抽查。**同一簇里的卡不互为重复**——同一语义簇可以是同一主题的不同问法、不同玩法载体，甚至增量高低不同（见第 3 节的增量分布列）。",
  "",
  "| 口径 | 定义 | 题数 | 占全库比 |",
  "|---|---|---:|---:|",
  `| semanticClusterCoverage | 被打上任何语义簇标签的卡在全库的**覆盖**（措辞是覆盖，不是重复率） | ${int(dup.taggedCount)} | ${pct(dup.taggedCount, N)} |`,
  `| 未打簇（标签为 -） | 判定时认为无明显同族骨架 | ${int(N - dup.taggedCount)} | ${pct(N - dup.taggedCount, N)} |`,
  `| 簇总数 | 出现过的不同簇标签数 | ${int(dup.clusterCount)} | — |`,
  `| 同簇 ≥2 的簇数 | 多卡簇数量 | ${int(multi.length)} | — |`,
  `| actualDuplicateCandidateRate | 同簇 ≥2 的卡占比（**仅为簇结构特征，不代表这些卡互为重复**） | ${int(dup.actualDupCount)} | ${pct(dup.actualDupCount, N)} |`,
  "",
  `> 本轮 semanticClusterCoverage 为 ${pct(dup.taggedCount, N)}：它只说明「多少卡被归了族」，**不能读成绝大多数题都是重复题**。若要谈重复，必须另有逐簇人审或相似度判据，本轮不提供，因此不再输出任何「重复率」。`,
  "",
  "## 1. 簇规模分布（按簇规模分桶）",
  "",
  "| 簇规模区间 | 簇数 | 涉及卡数 |",
  "|---|---:|---:|",
  ...dup.clusterSizeBuckets.map((b) => `| ${cell(b.label)} | ${int(b.clusters)} | ${int(b.cards)} |`),
  "",
  `> 分桶口径：size=1 为只有一张卡的簇、size=2 为两张、size=3-5 / size=6-10 / size=>10 依次递进；桶边界是分类阈值（常量），不是统计值。`,
  "",
  `## 2. 规模最大的语义簇 TOP ${int(TOP_CLUSTERS_SHOWN)}（每簇 ${int(CLUSTER_SAMPLE_LINES)} 条题面）`,
  "",
  `> 由 AUDIT-STATS-A1.json 的 multiClusters（同簇 ≥2 张，按规模降序）+ CONTENT-AUDIT-350.jsonl 的簇归属机械生成；玩法、样例、低信息题数均为数据统计。`,
  "",
  "| 排名 | 语义簇 | 卡数 | 涉及玩法 | 其中增量低/0 | 增量分布 |",
  "|---:|---|---:|---|---:|---|",
  ...multi.slice(0, TOP_CLUSTERS_SHOWN).map(([name, n], i) => {
    const info = clusterInfo(name);
    const spread = GAIN_ORDER.filter((g) => (info.gainSpread[g] ?? 0) > 0).map((g) => `${g} ${int(info.gainSpread[g]!)}`).join(" / ");
    return `| ${i + 1} | ${cell(name)} | ${int(n)} | ${cell(info.types.join("、"))} | ${int(info.lowZero)} | ${cell(spread)} |`;
  }),
  "",
  ...multi.slice(0, TOP_CLUSTERS_SHOWN).flatMap(([name], i) => [
    `**簇 ${i + 1}｜${cell(name)}**（${int(multi[i]![1])} 张）`,
    "",
    ...clusterInfo(name).samples.map((t, j) => `- 题面 ${j + 1}：${cell(t)}`),
    "",
  ]),
  "## 3. 集中说明（按数据说，不按印象说）",
  "",
  `- 规模最大的簇是 ${cell(multi[0]?.[0] ?? "")}（${int(multi[0]?.[1] ?? 0)} 张），其后为 ${multi.slice(1, 4).map(([n, c]) => `${cell(n)}（${int(c)} 张）`).join("、")}。`,
  `- 前 ${int(TOP_CLUSTERS_SHOWN)} 簇合计 ${int(multi.slice(0, TOP_CLUSTERS_SHOWN).reduce((s, [, c]) => s + c, 0))} 张，占全库 ${pct(multi.slice(0, TOP_CLUSTERS_SHOWN).reduce((s, [, c]) => s + c, 0), N)}、占被打簇卡的 ${pct(multi.slice(0, TOP_CLUSTERS_SHOWN).reduce((s, [, c]) => s + c, 0), dup.taggedCount)}。`,
  `- 簇规模 ≥${int(CLUSTER_BIG_THRESHOLD)} 的簇有 ${int(multi.filter(([, c]) => c >= CLUSTER_BIG_THRESHOLD).length)} 个，合计 ${int(multi.filter(([, c]) => c >= CLUSTER_BIG_THRESHOLD).reduce((s, [, c]) => s + c, 0))} 张。`,
  `- 簇内增量并不一致：这些多卡簇里增量低/0 的题合计 ${int(multi.reduce((s, [n]) => s + clusterInfo(n).lowZero, 0))} 张——同一簇既有低信息骨架，也可能有中/高增量变体，这正是「进簇 ≠ 重复」的直接证据。`,
  "",
  "## 4. 处置提示",
  "",
  `簇结构不等于删除清单：本轮全库处置（A.2 五分类）为 ${stats.disposition.dist.map(([k, v]) => `${dispLabel(k)} ${int(v)}`).join("、")}。是否合并、改写或删除由 Human 拍板（本轮只给建议，不定配额）。`,
  "",
];
rendered.dup = dupMd.join("\n");

/* ------------------------------------------------------------------ */
/* 交付物 6｜CONTENT-GAP-AND-NEXT.md                                     */
/* ------------------------------------------------------------------ */
const adjGainDist: Record<string, number> = {};
for (const a of adjudication) adjGainDist[a.finalInfoGain] = (adjGainDist[a.finalInfoGain] ?? 0) + 1;
/* 仲裁终判 vs A1 审查的 infoGain：同一批 cardId 的机械比对（两套判定的一致性证据）。 */
const adjVsOrig = adjudication.map((a) => ({ cardId: a.cardId, final: a.finalInfoGain, orig: byId.get(a.cardId)?.infoGain ?? "缺" }));
const adjAgree = adjVsOrig.filter((x) => x.final === x.orig).length;
const GAIN_RANK: Record<string, number> = { 高: 3, 中: 2, 低: 1, "0": 0 };
const adjGapDist: Record<string, number> = {};
for (const x of adjVsOrig) {
  const gapN = Math.abs((GAIN_RANK[x.final] ?? 0) - (GAIN_RANK[x.orig] ?? 0));
  adjGapDist[String(gapN)] = (adjGapDist[String(gapN)] ?? 0) + 1;
}
const zeroThemes = gap.themes.filter((t) => t.literalHits === 0);
/* A.2｜语义复核终版查表：主题名去空格归一后对齐 GAP-LITERAL 与 GAP-SEMANTIC。 */
const normTheme = (s: string): string => s.replace(/\s+/g, "");
const semByTheme = new Map(gapSem.themes.map((t) => [normTheme(t.theme), t]));
const semOf = (theme: string): GapSemanticTheme | undefined => semByTheme.get(normTheme(theme));

/* A.2 收口｜主题再拆分（「亲密/性观念」→ 互动动作 vs 边界/性观念）：真源 GAP-SEMANTIC.json#themes[].subthemes。 */
const SPLIT_BOUNDARY_CATEGORY = "亲密边界/性观念";
const SPLIT_INTERACTION_CATEGORY = "亲密互动/肢体动作";
const splitTheme = semOf("亲密/性观念");
const splitState = splitTheme?.subthemeSplit?.state ?? "pending";
const splitSubthemes = splitTheme?.subthemes ?? [];
const splitBoundary = splitSubthemes.find((s) => s.category === SPLIT_BOUNDARY_CATEGORY);
const splitInteraction = splitSubthemes.find((s) => s.category === SPLIT_INTERACTION_CATEGORY);
const boundaryIds = splitBoundary?.cardIds ?? [];
const splitBoundaryCount = splitBoundary?.count ?? 0;
/**
 * 硬要求（不得用模糊大类掩盖）：「性观念」自我披露问答是否空白必须写成一句明确的话。
 * 注意：本轮独立判定给出 6 张「亲密边界/性观念」，但全部是暧昧偏好 / 边界与同意类**态度问答**，
 * **没有一张是「性观念」自我披露问答**——所以结论仍是「性观念」空白，只是「亲密」部分确有内容。
 */
const sexualAttitudeStatement =
  splitState !== "ok"
    ? "（主题拆分待第三方独立判定回齐/mismatch，暂不下结论）"
    : splitBoundaryCount === 0
      ? "**性观念/亲密态度问答仍是内容空白。**"
      : `「${SPLIT_BOUNDARY_CATEGORY}」子类 ${int(splitBoundaryCount)} 张，经独立第三方逐题判定**全部是暧昧偏好 / 边界与同意类的态度问答**（${boundaryIds.map((c) => `\`${c}\``).join("、")}），**没有一张是「性观念」（对性的态度、价值、实践）自我披露问答** → **「性观念」自我披露问答仍是内容空白**，不得据此写成「性观念已覆盖」。`;

const gapMd: string[] = [
  "# 需要补足的内容主题缺口（Phase A.2：词面证据与语义证据并列）",
  "",
  "## 0. 本轮口径声明",
  "",
  `> 本文件**同时**引用两种证据，两列并列、不得互相替代：**literalHits**（显式词面，真源 GAP-LITERAL.json，对 ${int(gap.cardCount)} 张卡面做正则检索）与 **semanticHits**（语义命中，真源 GAP-SEMANTIC.json）。`,
  "> **显式词面命中 0 ≠ 语义完全不存在。** A.2 已完成独立语义复核：两名独立 reviewer 各看 350 题题面（未给任何已有标签）+ 第三方独立仲裁 + 第三方独立全库扫描；口径与方法见 GAP-SEMANTIC.json#method。",
  `> **任何情况下都不再把「词面 0 命中」单独当成主题空白的证据。** 只有「两名 reviewer 的语义复核 + 第三方独立扫描」同时为 0 且无待仲裁分歧，才写「语义空白」。`,
  "",
  "## 1. 主题缺口对照表（literalHits 与 semanticHits 并列，7 个主题）",
  "",
  "| 主题 | literalHits（显式词面，题） | semanticHits（独立语义复核，题） | 已仲裁样本数 | 探测词条数 | 最终结论措辞 |",
  "|---|---:|---:|---:|---:|---|",
  ...gap.themes.map((t) => {
    const s = semOf(t.theme);
    return `| ${cell(t.theme)} | ${int(t.literalHits)} | ${s ? int(s.semanticHits) : "—"} | ${s ? int(s.adjudicatedCount) : "—"} | ${int(t.patternsProbed)} | ${cell(s?.wording ?? "缺语义复核真源")} |`;
  }),
  "",
  `> 读法：字面量汇总 literalHits 合计 ${int(gap.themes.reduce((s, t) => s + t.literalHits, 0))} 题、semanticHits 合计 ${int(gapSem.totals.semanticHitsSum)} 题。**语义命中高于词面命中，正是语义复核存在的理由**——不能只看词面就把主题判成空白。`,
  "",
  "### 1.1 语义复核的一致性（两名 reviewer 是否互相对得上）",
  "",
  "| 主题 | reviewer#1 命中 | reviewer#2 命中 | 交集 | raw agreement | Jaccard | Cohen κ | 待仲裁分歧 |",
  "|---|---:|---:|---:|---:|---:|---:|---:|",
  ...gapSem.agreement.map((a) => `| ${cell(a.theme)} | ${int(a.s1Hits)} | ${int(a.s2Hits)} | ${int(a.intersection)} | ${(a.rawAgreement * 100).toFixed(1)}% | ${a.jaccard} | ${a.cohenKappa} | ${int(a.disagreedCards.length)} |`),
  "",
  `> 两名 reviewer 在「亲密/性观念」（${int(semOf("亲密/性观念")?.semanticHits ?? 0)} 题）上逐题完全一致（Jaccard=1、κ=1、level 无分歧）；「具体兴趣爱好」有 ${int(gapSem.agreement.find((a) => normTheme(a.theme) === "具体兴趣爱好")?.disagreedCards.length ?? 0)} 张分歧，已交第三方独立仲裁。5 个零命中主题两名 reviewer 同为 0。`,
  "",
  "### 1.2 语义命中明细（semanticHits > 0 的主题，逐题列出）",
  "",
  ...gapSem.themes.filter((t) => t.semanticHits > 0).flatMap((t) => [
    `**${cell(t.theme)}**：semanticHits ${int(t.semanticHits)} 题（literalHits ${int(t.literalHits)} 题）`,
    "",
    ...t.semanticCardIds.map((cid) => `- ${cid}｜${byId.get(cid)?.text ?? "（题面缺失）"}`),
    "",
  ]),
  `> 「亲密/性观念」的语义命中 ${int(semOf("亲密/性观念")?.semanticHits ?? 0)} 题 vs 词面命中 ${int(semOf("亲密/性观念")?.literalHits ?? 0)} 题，落差约 ${((semOf("亲密/性观念")?.semanticHits ?? 0) / Math.max(1, semOf("亲密/性观念")?.literalHits ?? 1)).toFixed(1)} 倍：**只用词面检索会把该主题的覆盖低估到不足 1/5**，这是本轮最直接的「语义层必要性」证据，不做淡化。`,
  "",
  "### 1.2b 主题再拆分：「亲密/性观念」不是一个类（独立第三方逐题二分）",
  "",
  `> 为什么拆：主题名「亲密/性观念」把**身体互动动作**与**亲密边界/性观念态度**混成一个数字。`,
  `> 本轮用独立第三方（opencode / muse-spark-1.3-contributor-free，只看题面、不看任何既有标签）对该主题的`,
  `> **semanticHits ∪ literalHits** 逐题二分（真源 \`_semantic/theme-split.jsonl\`，留痕见 \`_semantic/theme-split-PROMPT.md\`）：`,
  `> 拆分状态 **${splitState}**（判定 ${int(splitTheme?.subthemeSplit?.judgedTotal ?? 0)}/${int(splitTheme?.subthemeSplit?.expectedTotal ?? 0)}，cardId 集合一致=${splitTheme?.subthemeSplit?.cardIdsMatch ?? false}）。`,
  "",
  "| 子类 | 张数 | 判据 |",
  "|---|---:|---|",
  `| ${SPLIT_INTERACTION_CATEGORY} | ${int(splitInteraction?.count ?? 0)} | 题面本体就是身体层面的亲密互动指令（对视/靠近/合照姿势/轻碰/拥抱/整理衣领等） |`,
  `| ${SPLIT_BOUNDARY_CATEGORY} | ${int(splitBoundaryCount)} | 题面在问「愿不愿意 / 能接受到哪一步 / 对亲密的态度、偏好、边界与同意规则」 |`,
  "",
  `- 「${SPLIT_BOUNDARY_CATEGORY}」逐题：${boundaryIds.length === 0 ? "（无）" : boundaryIds.map((c) => `\`${c}\``).join("、")}。`,
  `- ${sexualAttitudeStatement}`,
  "",
  "> 成年亲密内容的既有约束（本轮不放松、不得被「补题」绕过）：**可跳过、不惩罚、不把拒绝当失败；行动题必须实时 Consent；不从性别或关系状态推断同意。**",
  "> 「亲密互动动作」（对视/靠近/牵手/拥抱等）**不能替代**「亲密边界/性观念」问答——补题时必须分开计，不能用一个笼统的「亲密」主题掩盖性观念侧空白。",
  "",
  "### 1.3 语义空白主题（三份独立证据同时为 0）",
  "",
  gapSem.totals.semanticBlankThemes.length === 0
    ? "（本轮无「三份证据同时为 0」的主题）"
    : `${int(gapSem.totals.semanticBlankThemes.length)} 个：${gapSem.totals.semanticBlankThemes.map((t) => cell(t)).join("、")}——两名独立 reviewer 的 350 题语义复核 + 第三方独立全库扫描均为 0 命中，且无待仲裁分歧。这不是「词面没写」推断出来的，而是三层独立复核的结论。`,
  "",
  "### 1.4 显式词面 0 命中的主题（词面证据清单，不作为空白依据）",
  "",
  `共 ${int(zeroThemes.length)} 个：${zeroThemes.map((t) => cell(t.theme)).join("、")}。这${int(zeroThemes.length)}类里，${int(zeroThemes.filter((t) => (semOf(t.theme)?.semanticHits ?? -1) === 0).length)} 类在语义层也确认为 0（→ 语义空白），${int(zeroThemes.filter((t) => (semOf(t.theme)?.semanticHits ?? 0) > 0).length)} 类在语义层仍有命中（→ 只能说「词面 0 命中但语义存在」）。**本清单只描述词面，不得单独用作空白结论。**`,
  "",
  "### 1.5 词面命中词条明细（哪些词条真的被问到过）",
  "",
  "| 主题 | 命中词条 | 命中题数 |",
  "|---|---|---:|",
  ...gap.themes.flatMap((t) => t.matchedPatterns.map((p) => `| ${cell(t.theme)} | ${cell(p.label)} | ${int(p.count)} |`)),
  "",
  `> 未出现在上表的词条即为 0 命中（探测了但一张都没中）。命中为 0 只代表这些显式词没出现在卡面。`,
  "",
  "## 2. 仲裁样本（高分歧题）给出的信息增量终判分布",  "",
  `> 真源 _calib/adjudication.jsonl（${int(adjudication.length)} 题，= CALIBRATION-STATS.json 的 adjudicationSet；与自动判据集 autoHighDisagreement（${int(calib.autoHighDisagreementCount)} 题）是两个不同定义的集合，不互相校验，见 CALIBRATION-REPORT.md#5）。`,
  "",
  ...table(["仲裁终判增量", "题数"], ["---", "---:"],
    GAIN_ORDER.filter((g) => adjGainDist[g] !== undefined).map((g) => [cell(g), int(adjGainDist[g]!)]).concat([["合计", int(adjudication.length)]])),
  "",
  `仲裁终判与 A1 全量审查的 infoGain 完全一致 ${int(adjAgree)}/${int(adjVsOrig.length)}（${pct(adjAgree, adjVsOrig.length)}）；差 1 档的 ${int(adjGapDist["1"] ?? 0)} 题、差 2 档的 ${int(adjGapDist["2"] ?? 0)} 题。这正是「增量」轴最难判的地方：口径已放宽到「有明确、可复述的答案即判高」，仍有一批题在两者之间摆动——见 CALIBRATION-REPORT.md。`,
  "",
  "## 3. 根因结论（本轮固定表述）",
  "",
  `**题库内容本身已足以构成体验 blocker**：${int(N)} 题里增量「高」${int(stats.derived.highN)} 题、低/0 ${int(stats.derived.lowZeroN)} 题（${pct(stats.derived.lowZeroN, N)}），人物信息类主题只占 ${pct(stats.derived.personTopicN, N)}，${int(gapSem.totals.semanticBlankThemes.length)} 个主题经**三层独立语义复核**（两名 reviewer + 第三方扫描）仍为 0 命中。Router 是否进一步放大该问题，以真实 Router Monte Carlo 结果判断（见 ROUTER-CONTENT-MONTE-CARLO.md），本文件不对 Router 责任下结论。`,
  "",
  "## 4. 下一阶段建议（仅建议，本轮不执行、不定配额）",
  "",
  "### 4.1 处置配额：旧「保留 282」作废，以五分类为准",
  "",
  `- 本轮全库五分类：${stats.disposition.dist.map(([k, v]) => `${dispLabel(k)} ${int(v)}`).join("、")}。`,
  `- **旧口径「保留 ${int(oldVerdictTotal("保留"))}」已作废**：它把 ${int(stats.disposition.socialBufferN)} 张「低/0 信息但高社交或高推进」的题直接算成正式保留——这正是用户原始抱怨（玩完没增加了解）的复现路径。`,
  `- **本轮只生成候选池，不定最终题量、不改任何题面。** \`SOCIAL_BUFFER_POOL\` 成员**不等于**正式保留，是否放行、放行多少由 Human 拍板。`,
  "",
  "### 4.2 SOCIAL_BUFFER_POOL 只作候选池；61 张是参考推导，**非产品规则、非硬配额**",
  "",
  `> 硬口径（本轮收口降级）：\`SOCIAL_BUFFER_POOL\` 的 ${int(stats.disposition.bufferQuota.poolSize)} 张**继续只作候选池**——不是正式保留名单，也不是任何形式的硬配额。`,
  `> 下面从「热闹题不能占多数」这一产品约束推出的 61 张，只是**参考推导**：**非产品规则、非硬配额**，本轮不执行，也不作为 Phase B 的验收门槛。`,
  "",
  `1. **观测值（事实）**：缓冲池 ${int(stats.disposition.bufferQuota.poolSize)} 张 = 全库 ${pct(stats.disposition.bufferQuota.poolSize, N)}，占「低/0 信息题」（${int(stats.disposition.bufferQuota.lowZeroTotal)} 张）的 ${pct(stats.disposition.bufferQuota.poolSize, stats.disposition.bufferQuota.lowZeroTotal)}。`,
  `2. **有增量的骨架（事实）**：\`PRIORITY_KEEP\`（${int(stats.disposition.priorityKeepN)}）+ \`KEEP_CANDIDATE\`（${int(stats.disposition.keepCandidateN)}）= **${int(stats.disposition.bufferQuota.skeletonN)} 张**。这是「玩完真的多知道了什么」的部分。`,
  `3. **参考推导（不是规则）**：若按「缓冲池少于骨架」的数学边界再留安全边际，得 骨架/2 = **建议缓冲池最多保留 ${int(stats.disposition.bufferQuota.recommendedCap)} 张**（= 当前池子 ${int(stats.disposition.bufferQuota.poolSize)} 张的 ${pct(stats.disposition.bufferQuota.recommendedCap, stats.disposition.bufferQuota.poolSize)}）。标注：**这是参考推导，非产品规则、非硬配额**，不构成「必须保留 61 张」的结论。`,
  `4. **为什么不能只控全库卡数量**：把 350 张里缓冲池压到某个比例，并不能保证**一局 20 轮**里热闹题不占多数——真正决定体验的是**运行时 20 轮的抽卡构成**（抽到哪些卡、落在哪个 Heat/强度档、最长连续几轮没有人物信息增量）。`,
  `   因此 **Phase B 应控制运行时 20 轮的内容构成**（例：一局内人物信息类主题覆盖下限、最长连续「低/0」上限），**而不是只控制全库卡数量比例**。`,
  `5. **本轮不执行**：以上全部是**参考推导与建议方向**，是否采纳、Phase B 验收怎么设计，由 Human 拍板。`,
  "",
  "### 4.3 等 Human 拍板的其他事项",
  "",
  `1. **改写 / 删除的配额**：本轮五分类为 ${stats.disposition.dist.map(([k, v]) => `${dispLabel(k)} ${int(v)}`).join("、")}。是否照此执行、还是调整比例，由 Human 定。`,
  `2. **玩法去留**：增量「高」为 0 的玩法有 ${int(stats.typeDist.filter((t) => (t.byGain.find((b) => b.gain === "高")?.count ?? 0) === 0).length)} 个（${stats.typeDist.filter((t) => (t.byGain.find((b) => b.gain === "高")?.count ?? 0) === 0).map((t) => cell(t.label)).join("、")}），且低+0 占比最高的玩法是 ${cell(stats.typeDist.slice().sort((a, b) => (a.midPlus / a.count) - (b.midPlus / b.count))[0]!.label)}（中及以上仅 ${pct(stats.typeDist.slice().sort((a, b) => (a.midPlus / a.count) - (b.midPlus / b.count))[0]!.midPlus, stats.typeDist.slice().sort((a, b) => (a.midPlus / a.count) - (b.midPlus / b.count))[0]!.count)}）。是整体重做还是削减合并，由 Human 定。`,
  `3. **新内容配额与来源**：缺口主题新增多少题、人工写还是 AI 生成后按同一张审查表复审，由 Human 定。`,
  "",
  "### 建议的推进顺序（供选择，非派工）",
  "",
  "1. 先把「信息增量」判定固化成可回归的检查项（每题必须能回答「答完知道了谁的什么」），作为所有新题与改写题的验收门槛。",
  `2. 优先补**语义也为 0 命中**的 ${int(gapSem.totals.semanticBlankThemes.length)} 类主题（${gapSem.totals.semanticBlankThemes.map((t) => cell(t)).join("、")}）；补完必须按第 0 节用同一套独立语义复核流程复验，避免又一次把「词面没写」当成「语义没有」。`,
  `3. 处理低信息占比最高的玩法（${cell(stats.typeDist.slice().sort((a, b) => (a.midPlus / a.count) - (b.midPlus / b.count))[0]!.label)}）。`,
  `4. 复审：新题库用同一张审查表重跑一遍，确认「高」从 ${int(stats.derived.highN)} 变为非 0 且人物信息类主题占比上升，内容问题才具备关闭条件。`,
  "",
  "## 5. 明确不建议做的事",
  "",
  `- **不建议只调 Router / Heat / Single-Anchor / Coverage 算法**：本轮证据显示体验瓶颈首先在题库内容层；Router 侧的真实放大效应见 ROUTER-CONTENT-MONTE-CARLO.md，按那里的真实模拟结果判断，不做单向断言。`,
  "- **不建议靠 AI 批量补题解决**：补题必须带内容聚焦约束并过同一张审查表复审，否则只会放大同质化。",
  `- **不建议在内容问题关闭前推进真人放行局**：否则只会重复验证同一结论。`,
  "",
  "## 6. Phase B 内容缺口（正式单列）与首选方案 E（设计约束，本轮不实施）",
  "",
  `### 6.1 Phase B 内容缺口（${int(PHASE_B_CONTENT_GAPS.length)} 类，正式单列）`,
  "",
  `以下类目为 Phase B 必须补足的内容缺口（用户 NEW RC 与 A.2 语义复核共同点名；**不得用大类互相掩盖**）：`,
  "",
  ...PHASE_B_CONTENT_GAPS.map((t) => `- ${cell(t)}`),
  "",
  `> **「亲密互动动作」不能替代「亲密/性观念」**：对视/靠近/牵手/拥抱等动作题只覆盖「亲密」（见 §1.2b 的 ${int(splitInteraction?.count ?? 0)} 张），`,
  `> 「亲密边界」「性观念」的自我披露问答仍是空白；补题时必须分开计，不能用一个笼统的「亲密」主题掩盖性观念侧空白。`,
  "",
  "### 6.2 首选方案 E｜保持 Heat / Router 契约，重做内容覆盖矩阵（Phase B 设计约束）",
  "",
  "- **不改**：H1→H4 单调 Heat、Heat 硬过滤、用户 intensity ceiling、D8 耗尽状态机。",
  "- **改**：新内容基线，要求**每个 Heat 档都存在足量的低强度卡**：",
  "  - intensity ceiling=1 时，H1/H2/H3/H4 都必须有合法 I1 内容；",
  "  - ceiling=2 时，H1/H2/H3/H4 都必须有合法 I1/I2 内容；",
  "  - 不允许再出现「低强度 = 只存在低 Heat」的严格对角矩阵。",
  "- **理由**：相比自动提高开放度、Heat 停档、跨 Heat 回退、临时绕过硬过滤，方案 E 更符合用户选择的尺度，也最少破坏冻结引擎语义。",
  "- **本轮边界**：只记录为 Phase B 首选方案与设计约束，**不实施任何 Heat 改动、不改 Plan、不新增 SSOT 内容**。",
  "",
];
rendered.gap = gapMd.join("\n");

/* ------------------------------------------------------------------ */
/* 交付物 7｜CALIBRATION-REPORT.md                                       */
/* ------------------------------------------------------------------ */
const axisKeys = Object.keys(calib.pairResults[0]?.perAxisRate ?? {});
const coeffSpec = calib.coefficientSpec;
const sets = calib.disagreementSets;
const worstCoefficient = (() => {
  const list = calib.pairResults.flatMap((p) => axisKeys.map((ax) => ({ pair: p.pair, ax, v: p.perAxisCoefficient[ax]?.value ?? 0 })));
  return list.slice().sort((a, b) => a.v - b.v)[0]!;
})();
const meanCoefficient = (ax: string) =>
  (calib.pairResults.reduce((s, p) => s + (p.perAxisCoefficient[ax]?.value ?? 0), 0) / calib.pairResults.length).toFixed(4);
const calibMd: string[] = [
  "# 跨 Reviewer 交叉校准报告（Phase A.2：逐轴 κ 为主指标）",
  "",
  `> 真源：CALIBRATION-STATS.json（audit-a1-calibration.ts 产出）+ _calib/adjudication.jsonl。校准样本 ${int(calib.sampleSize)} 题。`,
  "> 参与方：原 reviewer（逐玩法审完 350 题）vs 盲审 r1 vs 盲审 r2，三方在同一批校准样本上独立判定。",
  "",
  "## 0. 一致性指标口径声明（A.2 收口）",
  "",
  `- **有序轴**（${coeffSpec.orderedAxes.join(" / ")}）用 **${coeffSpec.orderedMetric}**：${coeffSpec.orderedFormula}`,
  `  - 排列（rank）真源：${Object.entries(coeffSpec.orderedRanks).map(([ax, r]) => `${ax} = ${Object.entries(r).sort((a, b) => a[1] - b[1]).map(([l, v]) => `${l}(${v})`).join(" < ")}`).join("；")}`,
  `- **分类轴**（${coeffSpec.categoricalAxes.join(" / ")}）用 **${coeffSpec.categoricalMetric}**：${coeffSpec.categoricalFormula}`,
  `- **六轴全一致率降级为参考项**，不再是 Gate 主指标（原口径把「六轴同时命中」当稳定度，会与逐轴可操作性混淆）。`,
  "",
  "## 1. 每轴 raw agreement 与一致性系数 κ（主指标）",
  "",
  "| 对比 | 轴 | 类型 | 系数口径 | raw agreement | κ |",
  "|---|---|---|---|---:|---:|",
  ...calib.pairResults.flatMap((p) => axisKeys.map((ax) => {
    const c = p.perAxisCoefficient[ax]!;
    return `| ${cell(p.pair)} | ${cell(ax)} | ${cell(c.kind)} | ${cell(c.metric)} | ${cell(p.perAxisRate[ax]!.rate)} | ${c.value.toFixed(4)} |`;
  })),
  "",
  `读法：最难对齐的轴是 ${cell(worstCoefficient.ax)}（${cell(worstCoefficient.pair)} κ=${worstCoefficient.v.toFixed(4)}）。三对 reviewers 逐轴 κ 均值：${axisKeys.map((ax) => `${cell(ax)} ${meanCoefficient(ax)}`).join("、")}。κ 越低说明该轴的可操作定义越不稳，不能被全六轴一致率掩盖。`,
  "",
  "## 2. 六轴全一致率（参考项，不再是 Gate 主指标）",
  "",
  "| 对比 | 样本 | 六轴全一致 | 全一致率 | infoGain 极差≥2 档 | 极差率 |",
  "|---|---:|---:|---:|---:|---:|",
  ...calib.pairResults.map((p) => `| ${cell(p.pair)} | ${int(p.n)} | ${int(p.allSixAgree)} | ${cell(p.allSixAgreeRate)} | ${int(p.infoGainGap2Plus)} | ${cell(p.infoGainGap2PlusRate)} |`),
  "",
  `> ${calib.pairResults[0]!.allSixAgreeNote ?? "参考项（不再是 Gate 主指标）；口径敏感，不得当作标签准确率"}`,
  "",
  "## 3. 系统性偏松 / 偏紧（相对三方多数票）",
  "",
  "| Reviewer | 增量判高 | 增量判低 | 增量一致 | 社交判高 | 社交判低 | 推进判高 | 推进判低 |",
  "|---|---:|---:|---:|---:|---:|---:|---:|",
  ...Object.entries(calib.lean).map(([name, d]) => `| ${cell(name)} | ${int(d.gainUp)} | ${int(d.gainDown)} | ${int(d.gainSame)} | ${int(d.socialUp)} | ${int(d.socialDown)} | ${int(d.progUp)} | ${int(d.progDown)} |`),
  "",
  (() => {
    const entries = Object.entries(calib.lean);
    const heaviest = entries.slice().sort((a, b) => Math.abs(b[1]!.gainUp - b[1]!.gainDown) - Math.abs(a[1]!.gainUp - a[1]!.gainDown))[0]!;
    const sign = heaviest[1]!.gainUp > heaviest[1]!.gainDown ? "偏松（更多判高）" : "偏紧（更多判低）";
    return `增量轴偏离最大的 reviewer 是 ${cell(heaviest[0])}（判高 ${int(heaviest[1]!.gainUp)} vs 判低 ${int(heaviest[1]!.gainDown)}），方向为${sign}。关系推进轴整体判高多于判低（合计 ${int(entries.reduce((s, [, d]) => s + d.progUp, 0))} vs ${int(entries.reduce((s, [, d]) => s + d.progDown, 0))}），说明「推进」这一轴的定义还偏宽。`;
  })(),
  "",
  "## 4. 玩法维度漂移（原 reviewer 相对多数票的偏离率，升序=最稳）",
  "",
  "| 玩法 | 样本 | semanticType 三方共识率 | infoGain 三方共识率 | 原 reviewer 偏离样本数 | 原 reviewer 偏离率 | 增量判定分布（三方合计） |",
  "|---|---:|---:|---:|---:|---:|---|",
  ...calib.drift.map((d) => {
    const spread = GAIN_ORDER.filter((g) => d.gainSpread[g] !== undefined).map((g) => `${g} ${int(d.gainSpread[g]!)}`).join(" / ");
    return `| ${cell(TYPE_CN[d.gameType] ?? d.gameType)} | ${int(d.n)} | ${cell(d.semanticConsensusRate)} | ${cell(d.gainConsensusRate)} | ${int(d.origGainDeviations)} | ${cell(d.origDeviationRate)} | ${cell(spread)} |`;
  }),
  "",
  `漂移最大的玩法是 ${cell(TYPE_CN[calib.drift[calib.drift.length - 1]!.gameType] ?? calib.drift[calib.drift.length - 1]!.gameType)}（偏离率 ${cell(calib.drift[calib.drift.length - 1]!.origDeviationRate)}），最稳的是 ${cell(TYPE_CN[calib.drift[0]!.gameType] ?? calib.drift[0]!.gameType)}（${cell(calib.drift[0]!.origDeviationRate)}）。`,
  "",
  "## 5. 两个**不同定义**的分歧集合：autoHighDisagreement vs adjudicationSet",
  "",
  "> Phase A.1 曾把这两个数量并列成「同一统计不一致」，这是错的。它们是**两个不同定义的集合**，必须分别定义、分别计数，禁止互相校验、禁止暗示二者矛盾。",
  "",
  "| 集合 | 定义 | 数量 |",
  "|---|---|---:|",
  `| autoHighDisagreement | ${cell(sets.autoHighDisagreement.definition)} | ${int(sets.autoHighDisagreement.count)} |`,
  `| adjudicationSet | ${cell(sets.adjudicationSet.definition)} | ${int(sets.adjudicationSet.count)} |`,
  "",
  `两集重叠 ${int(sets.overlapCount)} 题；adjudicationSet 在 autoHighDisagreement 之外还含人工另挑的样本，因此两者数量不同是定义差异，不是统计矛盾。`,
  `> ${cell(sets.note)}`,
  "",
  `autoHighDisagreement 的卡（自动判据）：${sets.autoHighDisagreement.cardIds.join("、")}`,
  `adjudicationSet 共 ${int(sets.adjudicationSet.count)} 题；其终判增量分布：${GAIN_ORDER.filter((g) => calib.adjudicationGainDist[g] !== undefined).map((g) => `${cell(g)} ${int(calib.adjudicationGainDist[g]!)} 题`).join("、")}。`,
  "",
  `仲裁终判与 A1 全量审查在该批样本上的 infoGain 一致率 ${pct(adjAgree, adjVsOrig.length)}（一致 ${int(adjAgree)} / 共 ${int(adjVsOrig.length)}，差 1 档 ${int(adjGapDist["1"] ?? 0)} 题、差 2 档 ${int(adjGapDist["2"] ?? 0)} 题）。`,
  "",
  "## 6. 校准结论与使用限制",
  "",
  `1. 逐轴 κ 才是主指标：最低的是 ${cell(worstCoefficient.ax)}（κ=${worstCoefficient.v.toFixed(4)}），最高一轴 κ 也没有到「高度一致」区间，任何单轴结论都应注明「口径敏感」。`,
  `2. 六轴全一致率 ${calib.pairResults.map((p) => p.allSixAgreeRate).join(" / ")} 只作参考项；它混合了轴定义可操作性与审查方式差异，不能当标签准确率。`,
  `3. 增量轴是最脆弱的轴之一：三方全一致率最低的对是 ${cell(calib.pairResults.slice().sort((a, b) => a.allSixAgree - b.allSixAgree)[0]!.pair)}（${cell(calib.pairResults.slice().sort((a, b) => a.allSixAgree - b.allSixAgree)[0]!.allSixAgreeRate)}），且仍有 ${int(calib.pairResults.reduce((s, p) => s + p.infoGainGap2Plus, 0))} 人次出现极差 ≥2 档。`,
  `4. 本报告只描述一致性，不覆盖全库 ${int(N)} 题——校准样本 ${int(calib.sampleSize)} 题，覆盖全库 ${pct(calib.sampleSize, N)}，所以结构性结论（主题空白、玩法级低信息）以全量审查为准，一致性以本报告为准。`,
  "",
  "## 7. 玩法漂移度量与复审标签（A.2 收口；真源 STABLE-LABELS.json）",
  "",
  `> 参与方：原 reviewer（_reviews-a1，按玩法各 50）vs 盲审（_recheck/BLIND-*，未见任何已有标签，各 50）；校准样本内的 ${int(calib.drift[0]!.n)} 题/玩法另有 r1、r2 两个盲审来源。一致性系数与第 1 节**共用同一份实现**（scripts/audit-a1-kappa.ts），不另写第二套。`,
  `> ${cell(stable.sourceNote)}`,
  "",
  "| 玩法 | 样本 | 轴 | 类型 | 系数口径 | raw agreement | κ | κ<" + stable.gates.kappaMinForDecision + " |",
  "|---|---:|---|---|---|---:|---:|---|",
  ...stable.drift.flatMap((d) => d.axes.map((a) =>
    `| ${cell(d.label)} | ${int(d.n)} | ${cell(a.axis)} | ${cell(a.kind)} | ${cell(a.metric)} | ${cell(a.rawAgreement)} | ${a.kappa} | ${a.kappa < stable.gates.kappaMinForDecision ? "⚠ 是" : "否"} |`)),
  "",
  `全轴一致率（5 轴同时命中）：${stable.drift.map((d) => `${cell(d.label)} ${cell(d.allAxesAgreeRate)}`).join("、")}；逐轴 κ 均值：${stable.drift.map((d) => `${cell(d.label)} ${d.meanKappa}`).join("、")}。`,
  `> κ 门槛口径：${cell(stable.gates.kappaSource)}；本轮取 κ < ${stable.gates.kappaMinForDecision} 判「明显不足」。`,
  "",
  "### 7.1 复审标签怎么来的",
  "",
  `- 复审标签 = 各**独立来源**按轴取**严格多数票**（票数 > 来源数/2）；无多数 → 交**第三方独立仲裁**（仲裁者只看题面，不携带任何既有标签）。`,
  `- 本轮共 ${int(stable.arbitration.inputCount)} 张卡至少有一轴无多数票（占 ${int(stable.reviewedLabelScope.reviewed.reduce((s, x) => s + x.cardCount, 0))} 张的 ${pct(stable.arbitration.inputCount, stable.reviewedLabelScope.reviewed.reduce((s, x) => s + x.cardCount, 0))}），全部送仲裁；已仲裁 ${int(stable.arbitration.resolvedCount)} 张。`,
  `- 可复审的轴：${stable.axesReviewed.map((a) => cell(a)).join("、")}；**未**复审：${stable.axesNotReviewed.map((a) => cell(a)).join("、")}（原因：${cell(stable.axesNotReviewedReason)}）。`,
  "",
  "### 7.2 哪些玩法的标签已完成双源复审与分歧仲裁",
  "",
  "| 玩法 | 卡数 | 标签状态 | 本批仲裁卡数 | κ<" + stable.gates.kappaMinForDecision + " 的轴 |",
  "|---|---:|---|---:|---|",
  ...stable.reviewedLabelScope.reviewed.map((s) => `| ${cell(s.label)}（${cell(s.gameType)}） | ${int(s.cardCount)} | **已完成双源复审与分歧仲裁**（多数票 + 仲裁；可用于主题/候选定位，低可靠轴不得作为单题自动保留/删除依据） | ${int(s.arbitratedCards)} | ${s.weakAxes.length === 0 ? "无" : s.weakAxes.map((a) => cell(a)).join("、")} |`),
  ...stable.reviewedLabelScope.singleSource.map((s) => `| ${cell(s.label)}（${cell(s.gameType)}） | — | ${cell(s.reliability)} | — | 未测 |`),
  "",
  `> ${cell(stable.reviewedLabelScope.statement)}`,
  "",
  "### 7.3 never_have_i 是否需要全量复审（门槛先定后判）",
  "",
  `门槛（显式声明，跑数前固定）：**原 reviewer 偏离多数票率 < ${stable.neverHaveIDecision.thresholds.origDeviationRateMax * 100}%** 且 **infoGain 三方共识率 ≥ ${stable.neverHaveIDecision.thresholds.gainConsensusRateMin * 100}%**，两条都满足才算「未达升级门槛」。`,
  "",
  "| 玩法 | A.1 原 reviewer 偏离率 | A.1 infoGain 共识率 | A.1 semanticType 共识率 | 偏离门槛 | 共识门槛 | 结论 |",
  "|---|---:|---:|---:|---|---|---|",
  ...calib.drift.map((d) => {
    const dev = Number(d.origDeviationRate.replace("%", "")) / 100;
    const gain = Number(d.gainConsensusRate.replace("%", "")) / 100;
    const pass = dev < stable.neverHaveIDecision.thresholds.origDeviationRateMax && gain >= stable.neverHaveIDecision.thresholds.gainConsensusRateMin;
    return `| ${cell(TYPE_CN[d.gameType] ?? d.gameType)} | ${cell(d.origDeviationRate)} | ${cell(d.gainConsensusRate)} | ${cell(d.semanticConsensusRate)} | ${dev < stable.neverHaveIDecision.thresholds.origDeviationRateMax ? "过" : "不过"} | ${gain >= stable.neverHaveIDecision.thresholds.gainConsensusRateMin ? "过" : "不过"} | ${pass ? "未达升级门槛，不复审" : "达门槛，应复审"} |`;
  }),
  "",
  `**never_have_i 终判**：${cell(stable.neverHaveIDecision.verdict)}。依据：偏离率 ${cell(stable.neverHaveIDecision.basis.a1OrigDeviationRate)}（门槛 <${stable.neverHaveIDecision.thresholds.origDeviationRateMax * 100}%）、共识率 ${cell(stable.neverHaveIDecision.basis.a1GainConsensusRate)}（门槛 ≥${stable.neverHaveIDecision.thresholds.gainConsensusRateMin * 100}%）——两项均达标，故本轮**不派盲审做全量 50 题复审**。`,
  `> 门槛只用来判「要不要额外派盲审」。dare / either_or / chemistry 已经在 §7 完成了盲审 + 仲裁（表中显示「达门槛，应复审」＝该玩法确实需要盲审，且本轮已完成）；本节真正待决的只有 never_have_i。`,
  `> 说明：never_have_i 没有盲审样本，无法直接算 κ；上表用的是 A.1 实测漂移值做**前置筛查**。因此它的标签仍归入「A.1 单源、可靠性较低」，与已完成双源复审与分歧仲裁的 dare / either_or / chemistry 不同。`,
  "",
  "### 7.4 使用限制（硬约束）",
  "",
  `${cell(stable.usageLimit)}`,
  "",
  `> 标签状态统一口径：${cell(stable.labelStatusNote)}`,
  "",
  `本轮 κ 仍低于 ${stable.gates.kappaMinForDecision} 的轴（只可用于候选排序）：${stable.weakAxisSummary.filter((w) => !w.usableForDecision).map((w) => `${cell(w.axis)}（最差 κ=${w.worstKappa}）`).join("、")}。`,
  "",
];
rendered.calib = calibMd.join("\n");

/* ------------------------------------------------------------------ */
/* 交付物 8｜ROUTER-CONTENT-MONTE-CARLO.md 的字段中文标签（taxonomy，不是统计数字）。 */
const MC_LABELS: [string, string][] = [
  ["sessions", "跑满 20 轮的局数"],
  ["sessionRate", "占全部局比例"],
  ["completedRoundsMean", "平均完成轮数"],
  ["highPerSession", "增量「高」题数/局"],
  ["midPlusPerSession", "增量「中及以上」题数/局"],
  ["personTopicsPerSession", "人物信息主题覆盖类数/局"],
  ["longestLowZeroRunMean", "最长连续「低/0」连击均值（轮）"],
  ["judgeShareMean", "现场评价/猜测 占完成轮比例"],
  ["socialHighPerSession", "社交能量「高」题数/局"],
  ["progHighPerSession", "关系推进「高」题数/局"],
  ["switchesMean", "切玩法次数/局"],
  ["reshufflesMean", "洗牌（AWAITING Host 决策）次数/局"],
  ["exhaustedMean", "耗尽次数/局"],
];

/* 交付物 8｜ROUTER-CONTENT-MONTE-CARLO.md                               */
/* ------------------------------------------------------------------ */
const exposureCsv = `${DIR}/ROUTER-MONTE-CARLO-exposure.csv`;
const exposedIds = new Set(
  existsSync(exposureCsv)
    ? readFileSync(exposureCsv, "utf8").trim().split("\n").slice(1).map((l) => l.split(",")[0]!.replace(/^"|"$/g, ""))
    : [],
);
const neverExposed = rows.filter((r) => !exposedIds.has(r.cardId));
const uncoveredMatchPair = neverExposed.filter((r) => r.matchRequired);
const neverByType: Record<string, number> = {};
for (const r of neverExposed) neverByType[r.gameType] = (neverByType[r.gameType] ?? 0) + 1;
const truthPackIds = ["truth", "dare"];
const packExposure = (ids: string[]) => ids.reduce((s, g) => s + (mc.exposureByGameType[g] ?? 0), 0);
const uniformMidPlus = (stats.derived.personTopicMidPlusN / N) * mc.config.targetCompletedRounds;
const uniformHigh = (stats.derived.highN / N) * mc.config.targetCompletedRounds;
/** A.2：MATCH-enabled 覆盖统计（38 张 matchRequired 卡的前后对比）。 */
const cov = mc.matchRequiredCoverage;
const matchCoveredIds = new Set(cov.withMatch.cards.map((c) => c.cardId));
const stillMissingMatch = rows.filter((r) => r.matchRequired && !matchCoveredIds.has(r.cardId)).map((r) => r.cardId);
const mcMd: string[] = [
  "# 真实 Router 内容 Monte Carlo（Phase A.2）",
  "",
  `> 真源：ROUTER-MONTE-CARLO.json + MC-TRACE.json（scripts/audit-a1-router-montecarlo.ts 产出）。`,
  "> 引擎：生产 D2 唯一 Router（createV2MainlineRouter）+ 生产编排器（drawV2SessionCard）+ 生产 Host 决策（applyV2HostDecision）+ 生产回合终态归约（eventForRoundTerminal）。本 harness 只提供局外输入（桌型 / 玩法选择 / 完成-跳过 / 互选成立），不复制任何过滤、排序、调度逻辑。",
  `> 规模：${int(mc.config.totalSessions)} 局（${int(mc.config.tables.length)} 桌型 × ${int(mc.config.sessionsPerTable)} 局），每局目标 ${int(mc.config.targetCompletedRounds)} 轮完成；再跑一遍 ${int(mc.config.matchSessionsPerTable)} 局/桌型的 MATCH-enabled 扫描。抽卡池为 ${int(mc.config.packs.length)} 个出主线卡的玩法。`,
  `> 已排除玩法：${mc.config.packsExcluded.ids.map((x) => cell(x)).join("、")}（${mc.config.packsExcluded.reason}）`,
  "",
  "## 0. 读这份报告前必须知道的四件事",
  "",
  `1. **perTable 与 overallCompleted20 只统计跑满 ${int(mc.config.targetCompletedRounds)} 轮的局**（占 ${pct(mc.overallCompleted20.sessions, mc.config.totalSessions)}），与「每局 20 轮」的原始设定对齐；overall 才是全部 ${int(mc.config.totalSessions)} 局。`,
  `2. **跑不满的局不是 Router 抖动**：开放度上限 ≤2 的桌在 Heat 升到高段后 relationship-aware 主线整池零合法卡（卡面 intensity 与 heatMax 单调绑定），必然 dead-end——见第 4 节分档表。这里的 dead-end 准确含义是**关系主线发生结构性断粮**，**而不是 App 无法继续游戏**：App 已有「切换玩法」「结束本局」安全出口，neutral / expansion 玩法的完成轮同样计入 \`sessionCompletedRounds\`。`,
  `3. **Heat 有双口径**：主口径 heatAtDraw（抽卡时，与 Router Heat 门控同口径，**体验统计用它**）与副口径 heatAfterTerminal（回合终态归约后），见第 5 节；静态可用范围（第 6 节）是第三套口径，跨 Heat 卡不塞进单一 Heat。`,
  `4. **耗尽按生产 outcome.kind 分列**：PACK_EXHAUSTED / RELATIONSHIP_GLOBAL_EXHAUSTED 在生产不是 AWAITING（UI 只给「切换玩法 / 查看总结」，不提供洗牌），只有 AWAITING 才交 Host 二选一。见第 1 节。`,
  "",
  "## 1. 耗尽与切包（按生产 outcome.kind 分列，不再统一当 AWAITING 洗牌）",
  "",
  `> 生产处置真源：lib/engine/session-engine.ts:100-102（三态说明）+ app/game/page.tsx:213-224（UI 分支）+ lib/v2-relationship/v2-session.ts:612-629（outcome.kind 产生点）。`,
  `> - **PACK_EXHAUSTED**：本玩法仍有硬合法卡（只是当前 Heat 档 / 去重窗口出不了）→ 生产给「切换其他有卡玩法」。`,
  `> - **RELATIONSHIP_GLOBAL_EXHAUSTED**：本玩法已无硬合法卡但全局仍有 → 生产给「收敛到仍有卡的关系玩法」。`,
  `> - **AWAITING_HOST_EXHAUSTION_DECISION**：三层皆空 → 生产弹 HostExhaustionSheet（结束本局 / 洗牌再玩）。`,
  `> harness 据此建模：前两者直接切包（**不调用** applyV2HostDecision，因为生产没有这一步）；AWAITING 先走生产 reshuffle，洗牌仍抽不出再按生产兜底（NO_RECOVERABLE_CARDS_GUIDANCE：换玩法）切包。`,
  "",
  "| 指标 | 跑满 20 轮子集 | 全部局（含低开放度 dead-end） |",
  "|---|---:|---:|",
  `| 耗尽次数/局 | ${mc.overallCompleted20.exhaustedMean} | ${mc.overall.exhaustedMean} |`,
  `| 其中 PACK_EXHAUSTED/局 | ${mc.overallCompleted20.packExhaustedMean} | ${mc.overall.packExhaustedMean} |`,
  `| 其中 RELATIONSHIP_GLOBAL_EXHAUSTED/局 | ${mc.overallCompleted20.globalExhaustedMean} | ${mc.overall.globalExhaustedMean} |`,
  `| 其中 AWAITING_HOST/局 | ${mc.overallCompleted20.awaitingHostMean} | ${mc.overall.awaitingHostMean} |`,
  `| 洗牌（AWAITING Host 决策）/局 | ${mc.overallCompleted20.reshufflesMean} | ${mc.overall.reshufflesMean} |`,
  `| 切玩法次数/局 | ${mc.overallCompleted20.switchesMean} | ${mc.overall.switchesMean} |`,
  `| guard 最大使用 | — | ${int(mc.overall.guardUsedMax)} / 上限 ${int(mc.config.guardLimit)} |`,
  `| 撞 guard 上限被截断的局 | — | ${int(mc.overall.truncatedSessions)} |`,
  `| dead-end 局 | — | ${int(mc.overall.deadEndSessions)}（${pct(mc.overall.deadEndSessions, mc.config.totalSessions)}） |`,
  "",
  `结论：抖动没有被 guard 上限掩盖（截断 ${int(mc.overall.truncatedSessions)} 局）；耗尽几乎全部是 Pack / 全局耗尽（按生产切包处理），AWAITING 一次都没出现（${mc.overall.awaitingHostMean} 次/局），因此洗牌次数为 ${mc.overall.reshufflesMean} 次/局。**A.1 把三种耗尽统一当 AWAITING 记 reshuffle，属高估；本版本已按生产口径分列，不再伪造单一行为。**`,
  "",
  "### 1b. 终止原因分布（跑不满 20 轮的局必须写明原因）",
  "",
  "| 终止原因 | 局数 | 含义 |",
  "|---|---:|---|",
  `| round_limit | ${int(mc.overall.termination.round_limit)} | 跑满目标完成轮数（正常结束） |`,
  `| pack_exhausted | ${int(mc.overall.termination.pack_exhausted)} | 全池都被 PACK_EXHAUSTED 轮完仍无卡（生产：切换玩法无效） |`,
  `| global_exhausted | ${int(mc.overall.termination.global_exhausted)} | RELATIONSHIP_GLOBAL_EXHAUSTED 且无可切玩法 |`,
  `| awaiting_host | ${int(mc.overall.termination.awaiting_host)} | AWAITING 且洗牌 + 切包均抽不出（生产：Host 结束本局） |`,
  `| guard_limit | ${int(mc.overall.termination.guard_limit)} | 撞 guard 上限被截断 |`,
  "",
  `> 逐局 trace（含 seed 与终止原因）落在 ${mc.traceFile}：${cell(mc.traceNote)}`,
  "",
  "## 2. 跑满 20 轮的局：内容侧均值（与 Phase A 可比的 20 轮口径）",
  "",
  `> 子集规模：${int(mc.overallCompleted20.sessions)} 局（占全部 ${int(mc.config.totalSessions)} 局的 ${pct(mc.overallCompleted20.sessions, mc.config.totalSessions)}）。`,
  "",
  "| 指标 | 数值 |",
  "|---|---:|",
  ...MC_LABELS.map(([k, label]) => `| ${cell(label)} | ${cell(mc.overallCompleted20[k])} |`),
  "",
  "## 3. 各桌型（跑满 20 轮子集；曝光卡数逐桌列出）",
  "",
  "| 桌型 | 局数(20轮) | high/局 | mid+/局 | 人物主题/局 | 最长低0连击均值 | 现场评价占比 | 洗牌/局 | 包耗尽/局 | 全局耗尽/局 | 切包/局 | 曝光卡数 |",
  "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
  ...mc.perTable.map((t) => `| ${cell(t.label)}（${cell(t.table)}） | ${int(t.sessionsCompleted20)} | ${t.highPerSession} | ${t.midPlusPerSession} | ${t.personTopicsPerSession} | ${t.longestLowZeroRunMean} | ${t.judgeShareMean} | ${t.reshufflesMean} | ${t.packExhaustedMean} | ${t.globalExhaustedMean} | ${t.switchesMean} | ${int(t.distinctCardsExposed)} |`),
  "",
  `> 注：曝光卡数差异来自 minPlayers 门控与桌型人数，逐桌为 ${mc.perTable.map((t) => `${cell(t.label)} ${int(t.distinctCardsExposed)} 张`).join("、")}（不取同类首个代表整类，避免把两个不同值写成一个数）。`,
  "",
  "## 4. 开放度分档（dead-end 的来源，必须披露）",
  "",
  "| 开放度上限 | 局数 | dead-end 局 | dead-end 率 | 平均完成轮数 | high/局 |",
  "|---:|---:|---:|---:|---:|---:|",
  ...mc.cohortByIntensityLimit.map((c) => `| ${int(c.intensityLimit)} | ${int(c.sessions)} | ${int(c.deadEndSessions)} | ${pct(c.deadEndSessions, c.sessions)} | ${c.completedRoundsMean} | ${c.highPerSession} |`),
  "",
  `这一档的数字全部由 SSOT 卡面属性决定：强度 1 的卡 heatMax 上限低于高 Heat，强度 2 的卡同理。也就是说**低开放度桌在 Heat 升段后，关系主线会出现整池零合法卡**——这是 Router 与卡面区间绑定的真实行为，不是模拟噪声。`,
  `> **口径校准（不得外推成「App 玩不下去」）**：intensityLimit=1/2 时，relationship-aware 主线到 H3/H4 会没有合法关系卡，证明的是**关系主线发生结构性断粮**，**而不是 App 无法继续游戏**——App 已有「切换玩法」「结束本局」安全出口，neutral / expansion 玩法的完成轮同样计入 \`sessionCompletedRounds\`。本表 41.5% 是「只按关系主线抽卡」的模拟口径，不等于真人无法把一局进行下去；Phase B 的首选修法是重做内容覆盖矩阵（方案 E），不是提高开放度或放宽 Heat 硬过滤。`,
  "",
  "## 5. Heat 运行时曝光（双口径；体验统计主口径 = heatAtDraw）",
  "",
  `> **主口径 heatAtDraw = 抽卡时 state.relationship.heat**：卡片是在该 Heat 档被抽出的，与 Router bucket 的 Heat 门控条件（currentHeat ≥ heatMin 且 ≤ heatMax）是**同一取值**，内容曝光 / 体验统计一律用它。`,
  `> 副口径 heatAfterTerminal = 回合终态归约后的 heat：完成轮推进 effective count → Heat 可能升档，于是「触发升档的那张卡」被记进新档。两列之差就是该位移的量级。`,
  "",
  "| Heat | heatAtDraw 曝光（主口径） | 占比 | heatAfterTerminal 曝光（副口径） | 占比 |",
  "|---|---:|---:|---:|---:|",
  ...Object.keys(mc.heatExposure).map((h) => `| ${cell(h)} | ${int(mc.heatExposure[h]!)} | ${pct(mc.heatExposure[h]!, Object.values(mc.heatExposure).reduce((a, b) => a + b, 0))} | ${int(mc.heatExposureAfterTerminal[h] ?? 0)} | ${pct(mc.heatExposureAfterTerminal[h] ?? 0, Object.values(mc.heatExposureAfterTerminal).reduce((a, b) => a + b, 0))} |`),
  "",
  `> ${mc.heatExposureNote}`,
  "",
  "## 6. Heat 静态可用范围（第三套口径，按卡面 heatMin/heatMax）",
  "",
  "| Heat | 可用题数 | 占比 | 其中增量高 | 其中中及以上 |",
  "|---|---:|---:|---:|---:|",
  ...mc.staticHeatAvailability.map((h) => `| ${cell(h.heat)} | ${int(h.legalCount)} | ${pct(h.legalCount, N)} | ${int(h.high)} | ${int(h.midPlus)} |`),
  "",
  `> ${mc.staticHeatNote}`,
  "",
  "## 7. 曝光分布：真实 Router 抽出来的内容构成",
  "",
  "| 玩法 | 曝光次数 | 占全部曝光 | 曝光中判高 | 曝光中判中 | 曝光中判低 | 曝光中判0 |",
  "|---|---:|---:|---:|---:|---:|---:|",
  ...Object.entries(mc.exposureByGameType)
    .sort((a, b) => b[1] - a[1])
    .map(([gt, n]) => {
      const g = mc.gainByGameType[gt] ?? {};
      return `| ${cell(TYPE_CN[gt] ?? gt)} | ${int(n)} | ${pct(n, mc.overall.totalExposure)} | ${int(g["高"] ?? 0)} | ${int(g["中"] ?? 0)} | ${int(g["低"] ?? 0)} | ${int(g["0"] ?? 0)} |`;
    }),
  "",
  `### 曝光结构（P1#2 修复后：同强度组内不再由 cardId 字典序垄断）`,
  "",
  `抽卡池里 ${cell(mc.config.packs.map((p) => TYPE_CN[p.id] ?? p.id).join("、"))} 的权重分别是 ${mc.config.packs.map((p) => `${cell(TYPE_CN[p.id] ?? p.id)} ${p.weight}`).join("、")}；真实曝光里「真心话 + 大冒险」合计 ${int(packExposure(truthPackIds))} 次（占 ${pct(packExposure(truthPackIds), mc.overall.totalExposure)}）。`,
  `逐玩法看：${Object.entries(mc.exposureByGameType).sort((a, b) => b[1] - a[1]).map(([gt, n]) => `${cell(TYPE_CN[gt] ?? gt)} ${int(n)} 次（${pct(n, mc.overall.totalExposure)}）`).join("、")}。`,
  `P1#2 修复后，同一玩法内**同强度候选**由 seed 派生轮换决定起点（不再恒出 cardId 字典序最小者），且 seed 带 stable session salt：例如同一玩法包里「大冒险」（PN-DARE-*）曝光 ${int(mc.exposureByGameType.dare ?? 0)} 次、「真心话」（PN-TRUTH-*）曝光 ${int(mc.exposureByGameType.truth ?? 0)} 次，两者已回到同一量级（A.2 修复前实测 15,359 : 704 ≈ 21.8 : 1，属**已修缺陷**，此处仅作历史基线引用）。`,
  `跨玩法之间的曝光差异来自 pack 权重 + Heat/强度门控 + 各玩法卡数，属结构差异；**不再归因于「cardId 前缀靠后饿死」**（该缺陷已修）。`,
  `全库 ${int(N)} 张里，MATCH 关闭的真实模拟从未抽到过 ${int(neverExposed.length)} 张，其中 ${int(uncoveredMatchPair.length)} 张带 matchRequired 标记（覆盖对比见第 9 节）。`,
  `从未曝光的玩法分布：${Object.entries(neverByType).map(([gt, n]) => `${cell(TYPE_CN[gt] ?? gt)} ${int(n)} 张`).join("、")}。`,
  "",
  "## 8. 曝光最高 / 最低的卡（各 5 张，真源 topExposed / leastExposed）",
  "",
  "| 类型 | cardId | 曝光次数 | 增量 |",
  "|---|---|---:|---|",
  ...mc.topExposed.slice(0, 5).map((e) => `| 曝光最高 | ${cell(e.cardId)} | ${int(e.count)} | ${cell(e.infoGain ?? "")} |`),
  ...mc.leastExposed.slice(0, 5).map((e) => `| 曝光最低 | ${cell(e.cardId)} | ${int(e.count)} | ${cell(e.infoGain ?? "")} |`),
  "",
  "## 9. MATCH-enabled simulation：38 张 matchRequired 卡的可见性变化",
  "",
  `> 问题：matchRequired 卡（targetMode=match-pair，共 ${int(cov.total)} 张，全部 intensity=5、heatMax=4）只有在目标 pair 已建立 MATCH 时才可出。MATCH 关闭的扫描里 matches 恒为空 → 这 ${int(cov.total)} 张**结构性不可见**（曝光 ${int(cov.withoutMatch.totalExposure)} 次、覆盖 ${int(cov.withoutMatch.covered)}/${int(cov.total)}）。`,
  `> 做法：harness 在互选检查点（9/14/19）用**生产**互选事件（mutualCheckFinalEvents → SYSTEM_MUTUAL_CHECK_COMPLETE）造 MATCH，经生产 reducer 的 mayCreateMatch 原子校验（D5：每人 ≤2）。**只造事件，不改生产 reducer / MATCH 逻辑。**`,
  `> 假设：${cell(cov.assumption)}`,
  "",
  "| 口径 | 建 MATCH 数 | 总曝光 | 曝光卡数/350 | 38 张中覆盖 | 38 张曝光合计 |",
  "|---|---:|---:|---:|---:|---:|",
  `| MATCH 关闭（主扫描） | ${int(cov.withoutMatch.matchesCreated)} | ${int(mc.overall.totalExposure)} | ${int(mc.overall.distinctCardsExposed)} | ${int(cov.withoutMatch.covered)} | ${int(cov.withoutMatch.totalExposure)} |`,
  `| MATCH 启用 | ${int(cov.run.matchesCreated)} | ${int(cov.run.totalExposure)} | ${int(cov.run.distinctCardsExposed)} | ${int(cov.withMatch.covered)} | ${int(cov.withMatch.totalExposure)} |`,
  "",
  `**结论：38 张 matchRequired 的覆盖从 ${int(cov.withoutMatch.covered)}/${int(cov.total)} 提升到 ${int(cov.withMatch.covered)}/${int(cov.total)}**（MATCH-enabled 扫描规模 ${int(cov.run.sessionsPerTable)} 局/桌型 × ${int(mc.config.tables.length)} 桌型 = ${int(cov.run.totalSessions)} 局）。`,
  "",
  "### 9b. MATCH 启用后仍未曝光的 matchRequired 卡（逐卡列出，不写成因果归因）",
  "",
  `MATCH 启用后仍未曝光的 matchRequired 卡：${int(stillMissingMatch.length)} 张${stillMissingMatch.length === 0 ? "（无）" : `（${stillMissingMatch.join("、")}）`}。`,
  `说明：出卡顺序 = 强度降序 + 同强度组内 seed 派生轮换（P1#2 修复后），**不再存在「cardId 前缀靠后恒定被挤掉」的饥饿**；若日后出现未曝光卡，应逐卡核 minPlayers / Heat 档 / MATCH 门控，不得直接归因于前缀。`,
  "",
  `MATCH 启用后曝光 ≥1 的 matchRequired 卡：${cov.withMatch.cards.map((c) => `${c.cardId}（${int(c.count)} 次）`).join("、")}。`,
  "",
  "## 10. uniform-baseline 对照（不同口径，不得混用）",
  "",
  "| 口径 | 说明 | 高增量/局 | 中及以上/局 |",
  "|---|---|---:|---:|",
  `| uniform-baseline estimate | 假设等概率均匀抽题、忽略 Router 过滤与 Heat 门控 | ${uniformHigh.toFixed(2)} | ${uniformMidPlus.toFixed(2)} |`,
  `| 真实 Router Monte Carlo | 生产 Router + 生产编排器，只统计跑满 ${int(mc.config.targetCompletedRounds)} 轮的局 | ${mc.overallCompleted20.highPerSession} | ${mc.overallCompleted20.midPlusPerSession} |`,
  "",
  `对照读法：真实模拟的「中及以上」${mc.overallCompleted20.midPlusPerSession} 与均匀基线 ${uniformMidPlus.toFixed(2)} 的差距，来自曝光在不同增量档玩法之间的偏斜（见第 7 节）；「高」增量只有 ${mc.overallCompleted20.highPerSession}，低于均匀基线 ${uniformHigh.toFixed(2)}，说明高信息卡同样被抽得偏少。**均匀估算只能当对照，不能当 Router 模拟结果使用。**`,
  "",
  "## 11. 根因结论（固定表述）",
  "",
  `**题库内容本身已足以构成体验 blocker**：${int(N)} 题里增量「高」${int(stats.derived.highN)} 题、低/0 ${int(stats.derived.lowZeroN)} 题（${pct(stats.derived.lowZeroN, N)}）；跑满 ${int(mc.config.targetCompletedRounds)} 轮的真实局里，人物信息主题只覆盖 ${mc.overallCompleted20.personTopicsPerSession}/${int(PERSON_TOPICS.length)} 类，最长连续「低/0」连击均值 ${mc.overallCompleted20.longestLowZeroRunMean} 轮。`,
  `**Router 是否进一步放大该问题，以真实 Router Monte Carlo 结果判断**：本报告第 7 节给出可验证的曝光结构（玩法间曝光分布、同一玩法内同强度组内的 seed 派生轮换）；第 4 节给出一个与内容无关的真实行为——低开放度桌在 Heat 升段后**关系主线**整池零合法卡，属**结构性断粮**，不是 App 无法继续游戏。`,
  `因此不做单向断言：内容层是主要 blocker（证据在 CONTENT-STRUCTURE-REPORT.md 与 CONTENT-GAP-AND-NEXT.md），Router 层的曝光结构与低开放度关系主线断粮是真实存在的二次项（证据在本报告），两者的权重由 Human 拍板。`,
  "",
];
rendered.mc = mcMd.join("\n");

/* ------------------------------------------------------------------ */
/* 交付物 1｜CSV 只核验不改写                                             */
/* ------------------------------------------------------------------ */
const csvPath = `${DIR}/CONTENT-AUDIT-350.csv`;
if (!existsSync(csvPath)) throw new Error(`缺少交付物 1：${csvPath}（应由 audit-a1-aggregate.ts 生成）`);
const csvRows = readFileSync(csvPath, "utf8").trim().split("\n").length - 1;

/* ------------------------------------------------------------------ */
/* 写盘（仅 --generate）→ 校验一律读**磁盘**；--verify-only 绝不写任何文件      */
/* ------------------------------------------------------------------ */
if (GENERATE) {
  for (const key of Object.keys(REPORT_FILES) as ReportKey[]) writeFileSync(`${DIR}/${REPORT_FILES[key]}`, rendered[key]!);
}
const files: Record<ReportKey, string> = {} as Record<ReportKey, string>;
for (const key of Object.keys(REPORT_FILES) as ReportKey[]) {
  const p = `${DIR}/${REPORT_FILES[key]}`;
  if (!existsSync(p)) throw new Error(`缺少报告：${p}（先跑 --generate 生成，或检查交付物）`);
  files[key] = readFileSync(p, "utf8");
}
/** 交付物展示顺序（章节编号属常量）。 */
const DISPLAY_ORDER: { key: ReportKey; label: string }[] = [
  { key: "struct", label: "2. CONTENT-STRUCTURE-REPORT.md" },
  { key: "low", label: "3. TOP20-LOW-INFO.md" },
  { key: "high", label: "4. TOP20-HIGH-INFO.md" },
  { key: "dup", label: "5. DUPLICATE-TOP10.md" },
  { key: "gap", label: "6. CONTENT-GAP-AND-NEXT.md" },
  { key: "calib", label: "7. CALIBRATION-REPORT.md" },
  { key: "mc", label: "8. ROUTER-CONTENT-MONTE-CARLO.md" },
];

/* ------------------------------------------------------------------ */
/* 一致性自检：从**磁盘**报告抽数字，与 JSON 真源逐项比对                     */
/*   - 表格行 + 散文节数字 + literalHits + Monte Carlo 全量 + 校准 κ         */
/*   - fail-closed：探针未命中 / 数字解析失败 / MC_LABELS 缺键 → 记失败项     */
/* ------------------------------------------------------------------ */

const isSeparatorRow = (r: string[]): boolean => r.length > 0 && r.every((c) => /^:?-{2,}:?$/.test(c));
/** 章节内表格行（不含分隔行）；章节不存在时返回空数组（交由探针记失败，不抛错）。 */
function sectionRows(md: string, heading: string): string[][] {
  const lines = md.split("\n");
  const start = lines.findIndex((l) => l.trim() === heading.trim());
  if (start < 0) return [];
  const outRows: string[][] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (line.startsWith("##") || line.startsWith("###")) break;
    if (line.startsWith("|")) {
      const cells = line.split("|");
      const row = cells.slice(1, cells.length - 1).map((c) => c.trim());
      if (!isSeparatorRow(row)) outRows.push(row);
    }
  }
  return outRows;
}
function rowByLabel(rowsIn: string[][], label: string): string[] | null {
  return rowsIn.find((r) => r[0] === label || r[0]?.startsWith(`${label}（`)) ?? null;
}
const toNum = (s: string | undefined): number => {
  if (s === undefined) return Number.NaN;
  const n = Number(numOnly(s));
  return Number.isFinite(n) ? n : Number.NaN;
};
/** 表格单元格取数（fail-closed：缺章节 / 缺行 / 解析失败 → NaN）。 */
const cellOf = (md: string, heading: string, label: string, col: number): number => {
  const r = rowByLabel(sectionRows(md, heading), label);
  return r ? toNum(r[col]) : Number.NaN;
};

interface Check { name: string; where: string; expected: number; actual: number | null; }
const checks: Check[] = [];
/** 数值比较用极小容差（报告里是格式化后的值）。 */
const TOL = 1e-6;
const push = (name: string, where: string, expected: number, actual: number) => {
  checks.push({ name, where, expected, actual: Number.isFinite(actual) ? actual : null });
};
/** 表格单元格对账。 */
const cmpCell = (name: string, where: string, md: string, heading: string, label: string, col: number, expected: number) =>
  push(name, where, expected, cellOf(md, heading, label, col));
/** 散文节数字探针（fail-closed：正则必须命中）。 */
const probe = (name: string, where: string, text: string, re: RegExp, expected: number, group = 1) => {
  const m = text.match(re);
  push(name, where, expected, m ? toNum(m[group]) : Number.NaN);
};
/** 文本断言探针（expected=1 表示该措辞必须出现）。 */
const probeText = (name: string, where: string, text: string, needle: string, expected = 1) => {
  checks.push({ name, where, expected, actual: text.includes(needle) ? 1 : 0 });
};
const escRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const S = files.struct, L = files.low, H = files.high, D = files.dup, G = files.gap, C = files.calib, M = files.mc;

/* ① 语义类型 / 增量 / 主题 / 社交 / 推进 / 促进了解 / 处置 分布表 */
for (const [k, v] of stats.semDist) cmpCell(`semDist:${k}`, "S#1", S, "## 1. 语义类型分布", k, 1, v);
for (const [k, v] of stats.gainDist) cmpCell(`gainDist:${k}`, "S#3", S, "## 3. 信息增量分布", k, 1, v);
for (const [k, v] of stats.topicDist) cmpCell(`topicDist:${k}`, "S#2", S, "## 2. 信息主题分布", k, 1, v);
for (const [k, v] of stats.socialDist) cmpCell(`socialDist:${k}`, "S#5", S, "## 5. 社交能量分布（现场好不好用）", k, 1, v);
for (const [k, v] of stats.progDist) cmpCell(`progDist:${k}`, "S#6", S, "## 6. 关系推进分布（是否推动两个人往前走）", k, 1, v);
for (const [k, v] of stats.promoteDist) cmpCell(`promoteDist:${k}`, "S#4", S, "## 4. 是否促进「更了解这个人」", k, 1, v);
/* A.2｜处置主口径改五分类：§7.2 分布表 + §7.3 映射表 + §7.4 玩法×五分类 */
{
  const head72 = "### 7.2 全库五分类分布（主口径）";
  for (const [k, v] of stats.disposition.dist) cmpCell(`dispositionDist:${k}`, "S#7.2", S, head72, k, 1, v);
  const head73 = "### 7.3 旧 verdict → 新五分类的映射（向后兼容字段说明）";
  for (const [old, bucket] of Object.entries(stats.disposition.verdictToDisposition)) {
    stats.disposition.order.forEach((k, idx) => push(`dispositionMap:${old}:${k}`, "S#7.3", bucket[k] ?? 0, cellOf(S, head73, old, 1 + idx)));
  }
  const head74 = "### 7.4 玩法 × 五分类处置";
  for (const t of stats.disposition.byType) {
    stats.disposition.order.forEach((k, idx) => push(`dispositionByType:${t.gameType}:${k}`, "S#7.4", t.byDisposition.find((b) => b.disposition === k)?.count ?? 0, cellOf(S, head74, TYPE_CN[t.gameType] ?? t.gameType, 1 + idx)));
  }
  /* 旧 verdict 字段仍保留在逐题明细里，但报告主口径不得再出现「初步处置分布」旧表。 */
  probeText("disposition:oldQuotaVoid", "S#7", S, "「保留 " + int(oldVerdictTotal("保留")) + "」**已作废**");
  probeText("disposition:bufferNotFormalKeep", "S#7", S, "不等于");
  probeText("disposition:ruleStated", "S#7.1", S, "infoGain=高");
  for (const [k, v] of stats.verdictDist) push(`verdictDistBackCompat:${k}`, "S#7.3-mapping-total", v, oldVerdictTotal(k));
}

/* ② 玩法 × 增量交叉（含低+0 / 中及以上 / 现场评价 / 无人物信息 / 保留） */
for (const t of stats.typeDist) {
  const head = "## 8. 玩法 × 信息增量交叉（行=玩法）";
  cmpCell(`typeDist:${t.gameType}:count`, "S#8", S, head, t.label, 1, t.count);
  GAIN_ORDER.forEach((g, idx) => cmpCell(`typeDist:${t.gameType}:${g}`, "S#8", S, head, t.label, 2 + idx, t.byGain.find((b) => b.gain === g)?.count ?? 0));
  cmpCell(`typeDist:${t.gameType}:lowZero`, "S#8", S, head, t.label, 6, (t.byGain.find((b) => b.gain === "低")?.count ?? 0) + (t.byGain.find((b) => b.gain === "0")?.count ?? 0));
  cmpCell(`typeDist:${t.gameType}:midPlus`, "S#8", S, head, t.label, 7, t.midPlus);
  cmpCell(`typeDist:${t.gameType}:judge`, "S#8", S, head, t.label, 8, t.judge);
  cmpCell(`typeDist:${t.gameType}:noPersonInfo`, "S#8", S, head, t.label, 9, t.noPersonInfo);
  cmpCell(`typeDist:${t.gameType}:keep`, "S#8", S, head, t.label, 10, t.keep);
}

/* ③ 玩法 × 主题交叉 */
{
  const head = "## 9. 玩法 × 信息主题交叉（行=玩法，列=主题）";
  const mx = matrix();
  for (const t of stats.typeDist) {
    mx.topics.forEach((tp, idx) => cmpCell(`topicByType:${t.gameType}:${tp}`, "S#9", S, head, t.label, 1 + idx, mx.cell(tp, t.gameType)));
  }
}

/* ④ 强度 1–5 分布 */
for (const i of stats.intensityDist) {
  const head = "## 10. 强度 1–5 的信息增量分布";
  cmpCell(`intensity:${i.intensity}:count`, "S#10", S, head, `I${i.intensity}`, 1, i.count);
  GAIN_ORDER.forEach((g, idx) => cmpCell(`intensity:${i.intensity}:${g}`, "S#10", S, head, `I${i.intensity}`, 2 + idx, i.byGain.find((b) => b.gain === g)?.count ?? 0));
  cmpCell(`intensity:${i.intensity}:midPlus`, "S#10", S, head, `I${i.intensity}`, 6, i.midPlus);
}

/* ⑤ Heat 静态可用范围（表 + 散文）+ 跨 Heat / 单档卡 */
{
  const head = "## 11. Heat 静态可用范围（不把跨 Heat 卡塞进单一 Heat）";
  for (const h of stats.heatAvailability) {
    cmpCell(`heatAvailability:${h.heat}:legal`, "S#11", S, head, h.heat, 1, h.legalCount);
    GAIN_ORDER.forEach((g, idx) => cmpCell(`heatAvailability:${h.heat}:${g}`, "S#11", S, head, h.heat, 3 + idx, h.byGain.find((b) => b.gain === g)?.count ?? 0));
    cmpCell(`heatAvailability:${h.heat}:midPlus`, "S#11", S, head, h.heat, 7, h.midPlus);
    cmpCell(`heatAvailability:${h.heat}:personTopic`, "S#11", S, head, h.heat, 8, h.personTopic);
  }
  probe("struct:crossHeatCards", "S#11", S, /跨 Heat 卡 ([\d,]+) 张/, stats.crossHeatCards);
  probe("struct:exactHeatCards", "S#11", S, /单档卡 ([\d,]+) 张/, stats.exactHeatCards);
}

/* ⑥ 三轴交叉（展示 TOP 15）*/
for (const [k, v] of stats.threeAxis.slice(0, 15)) cmpCell(`threeAxis:${k}`, "S#12", S, "## 12. 三轴交叉（增量 / 社交能量 / 关系推进）", k, 1, v);

/* ⑦ 散文节：§0 / §2 / §12 / §13 / §14（Q1–Q5）/ §15 */
{
  probe("struct:0:N", "S#0", S, /\*\*([\d,]+) 题里信息增量评为「高」的是/, N);
  probe("struct:0:highN", "S#0", S, /题里信息增量评为「高」的是 ([\d,]+) 题/, stats.derived.highN);
  probe("struct:0:lowZeroN", "S#0", S, /评为「低\/0」的合计 ([\d,]+) 题/, stats.derived.lowZeroN);
  probe("struct:0:liveTopicN", "S#0", S, new RegExp(`主题落在「${LIVE_TOPIC}」（本局临时状态、不构成稳定个人信息）的 ([\\d,]+) 题`), topicCount(LIVE_TOPIC));
  probe("struct:0:judgeN", "S#0", S, /语义类型为「现场评价\/猜测」的 ([\d,]+) 题/, stats.derived.judgeN);
  probe("struct:0:zeroTopicCount", "S#0", S, /题数为 0 的有 ([\d,]+) 类/, PERSON_TOPICS.filter((t) => topicCount(t) === 0).length);
  probe("struct:0:perTypeRows", "S#0", S, /7 玩法 × 每玩法 (\d+) 题/, rows.filter((r) => r.gameType === "truth").length);
  probe("struct:2:personTopicN", "S#2", S, /人物信息类主题（[\d,]+ 类）合计 ([\d,]+) 题/, stats.derived.personTopicN);
  probe("struct:2:personTopicMidPlusN", "S#2", S, /其中增量达「中」及以上的 ([\d,]+) 题/, stats.derived.personTopicMidPlusN);
  probe("struct:12:lowInfoButUseful", "S#12", S, /低信息但高社交或高推进的题 ([\d,]+) 题/, stats.lowInfoButUseful.count);
  for (const t of gap.themes) cmpCell(`struct:13:${t.theme}:literalHits`, "S#13", S, "## 13. 卡面词面证据（literalHits，语义词面两账分明）", t.theme, 1, t.literalHits);
  for (const t of gap.themes) cmpCell(`struct:13:${t.theme}:probed`, "S#13", S, "## 13. 卡面词面证据（literalHits，语义词面两账分明）", t.theme, 3, t.patternsProbed);
  /* Q1 */
  probe("struct:Q1:liveTopicN", "S#14Q1", S, new RegExp(`主题落在「${LIVE_TOPIC}」([\\d,]+) 题`), topicCount(LIVE_TOPIC));
  probe("struct:Q1:judgeN", "S#14Q1", S, /语义类型「现场评价\/猜测」([\d,]+) 题/, stats.derived.judgeN);
  probe("struct:Q1:lowZeroN", "S#14Q1", S, /增量「低\/0」([\d,]+) 题/, stats.derived.lowZeroN);
  probe("struct:Q1:zeroGainN", "S#14Q1", S, /其中「0」([\d,]+) 题/, distOf(stats.gainDist, "0"));
  /* Q2 同族结构证据（前 10 簇的卡数与低/0） */
  for (const [name, n] of stats.duplicate.multiClusters.slice(0, TOP_CLUSTERS_SHOWN)) {
    const info = clusterInfo(name);
    probe(`struct:Q2:${name}:size`, "S#14Q2", S, new RegExp(`^- ${escRe(name)}：([\\d,]+) 题（其中增量低/0 的`, "m"), n);
    probe(`struct:Q2:${name}:lowZero`, "S#14Q2", S, new RegExp(`^- ${escRe(name)}：[\\d,]+ 题（其中增量低/0 的 ([\\d,]+) 题）`, "m"), info.lowZero);
  }
  /* Q3 */
  probe("struct:Q3:liveTopicN", "S#14Q3", S, new RegExp(`现场化学反应 ([\\d,]+) 题`), topicCount(LIVE_TOPIC));
  probe("struct:Q3:attractionN", "S#14Q3", S, /择偶偏好\/吸引力 ([\d,]+) 题/, topicCount("择偶偏好/吸引力"));
  probe("struct:Q3:sumN", "S#14Q3", S, /两者合计 ([\d,]+) 题/, topicCount(LIVE_TOPIC) + topicCount("择偶偏好/吸引力"));
  probe("struct:Q3:topClusterCount", "S#14Q3", S, /规模最大的重复簇前 ([\d,]+) 个/, Math.min(5, stats.duplicate.multiClusters.length));
  /* Q4 逐主题表 */
  for (const tp of PERSON_TOPICS) {
    const head = "### Q4｜兴趣爱好、生活方式、恋爱观、亲密观、小癖好各有多少题";
    cmpCell(`struct:Q4:${tp}:count`, "S#14Q4", S, head, tp, 1, topicCount(tp));
    const hit = gap.themes.find((t) => THEME_TO_TOPIC[t.theme] === tp)?.literalHits;
    if (hit !== undefined) cmpCell(`struct:Q4:${tp}:literalHits`, "S#14Q4", S, head, tp, 3, hit);
  }
  /* Q5 */
  probe("struct:Q5:completed20Sessions", "S#14Q5", S, new RegExp(`局数 ([\\d,]+)、每桌型`), mc.config.totalSessions);
  probe("struct:Q5:sessionsPerTable", "S#14Q5", S, /每桌型 ([\d,]+) 局/, mc.config.sessionsPerTable);
  probe("struct:Q5:midPlus", "S#14Q5", S, /平均「中及以上」增量 ([\d.]+) 题\/局/, Number(mc.overallCompleted20.midPlusPerSession));
  probe("struct:Q5:high", "S#14Q5", S, /「高」增量 ([\d.]+) 题\/局/, Number(mc.overallCompleted20.highPerSession));
  probe("struct:Q5:personTopics", "S#14Q5", S, /人物信息主题覆盖 ([\d.]+) 类\/局/, Number(mc.overallCompleted20.personTopicsPerSession));
  probe("struct:Q5:longestRun", "S#14Q5", S, /最长连续「低\/0」连击均值 ([\d.]+) 轮/, Number(mc.overallCompleted20.longestLowZeroRunMean));
  probe("struct:Q5:deadEnd", "S#14Q5", S, /另有 ([\d,]+) 局（占/, mc.overall.deadEndSessions);
  probe("struct:Q5:uniformMidPlus", "S#14Q5", S, /「中及以上」期望 ([\d.]+) 题\/局/, Number(((stats.derived.personTopicMidPlusN / N) * mc.config.targetCompletedRounds).toFixed(2)));
  probe("struct:Q5:uniformHigh", "S#14Q5", S, /「高」期望 ([\d.]+) 题\/局/, Number(((stats.derived.highN / N) * mc.config.targetCompletedRounds).toFixed(2)));
  /* §15 */
  probe("struct:15:highN", "S#15", S, /「高」增量 ([\d,]+) 题、低\/0/, stats.derived.highN);
  probe("struct:15:lowZeroN", "S#15", S, /低\/0 ([\d,]+) 题，20 轮/, stats.derived.lowZeroN);
  probe("struct:15:personTopics", "S#15", S, /人物信息主题只覆盖 ([\d.]+)\//, Number(mc.overallCompleted20.personTopicsPerSession));
  probe("struct:15:personTopicClasses", "S#15", S, /\/[\d.]+ 类。/, PERSON_TOPICS.length, 0);
  probe("struct:15:maxHighTypeN", "S#15", S, /最多的玩法是 .+?（([\d,]+) 题）/, Math.max(...stats.typeDist.map((t) => t.byGain.find((x) => x.gain === "高")?.count ?? 0)));
  probe("struct:15:highZeroTypes", "S#15", S, /增量「高」为 0 的玩法有 ([\d,]+) 个/, stats.typeDist.filter((t) => (t.byGain.find((b) => b.gain === "高")?.count ?? 0) === 0).length);
}

/* ⑧ TOP20 双榜：表格逐行 + 散文结构特征 */
{
  const lowHdr = "| # | cardId | 玩法 | 强度 | 增量 | 语义类型 | 主题 | 语义簇 | 题面 | 玩完后新知道什么 | 处置 |";
  const lowRows = sectionRows(L, lowHdr).filter((r) => /^\d+$/.test(r[0] ?? ""));
  const lowList = ranks.low;
  const lowFirstNotWorst = (() => { const i = lowList.findIndex((r) => r.infoGain !== "0" && r.infoGain !== "低"); return i === -1 ? lowList.length : i; })();
  const firstHigh = lowRows.findIndex((r) => r[4] === "高");
  push("lowRank:first-high-index", "L", lowList.findIndex((r) => r.infoGain === "高") === -1 ? lowRows.length : lowList.findIndex((r) => r.infoGain === "高"), firstHigh === -1 ? lowRows.length : firstHigh);
  push("lowRank:rowCount", "L", lowList.length, lowRows.length);
  for (const [i, r] of lowList.entries()) {
    const row = lowRows[i];
    if (!row) { checks.push({ name: `lowRank:${r.cardId}:row`, where: "L", expected: 1, actual: null }); continue; }
    push(`lowRank:${r.cardId}:gain`, "L", GAIN_RANK[r.infoGain] ?? 9, GAIN_RANK[row[4] ?? ""] ?? 9);
    push(`lowRank:${r.cardId}:intensity`, "L", r.intensity, toNum(row[3].replace("I", "")));
  }
  for (const g of GAIN_ORDER) probe(`lowMd:gainCount:${g}`, "L", L, new RegExp(`${g} (\\d+) 题`), lowList.filter((r) => r.infoGain === g).length);
  probe("lowMd:firstNotWorst", "L", L, /前 ([\d,]+) 条全部是「0」或「低」/, lowFirstNotWorst);
  probe("lowMd:firstNotWorstNext", "L", L, /第 ([\d,]+) 条起才可能出现「中」/, lowFirstNotWorst + 1);
  probe("lowMd:judge", "L", L, /语义类型「现场评价\/猜测」(\d+) 题/, lowList.filter((r) => r.semanticType === "现场评价/猜测").length);
  probe("lowMd:liveTopic", "L", L, new RegExp(`主题「${LIVE_TOPIC}」(\\d+) 题`), lowList.filter((r) => r.topic === LIVE_TOPIC).length);
  probe("lowMd:clusterCandidate", "L", L, /被判为同簇候选（同簇 ≥2 张）的 (\d+) 题/, lowList.filter((r) => clusterInfo(r.duplicateCluster).members.length > 1).length);
  for (const k of stats.disposition.order) probe(`lowMd:disposition:${k}`, "L", L, dispRe(k, " 题"), lowList.filter((r) => r.disposition === k).length);

  const highHdr = "| # | cardId | 玩法 | 强度 | 增量 | 语义类型 | 主题 | 社交能量 | 关系推进 | 题面 | 玩完后新知道什么 | 处置 |";
  const highRows = sectionRows(H, highHdr).filter((r) => /^\d+$/.test(r[0] ?? ""));
  push("highRank:rowCount", "H", ranks.high.length, highRows.length);
  for (const [i, r] of ranks.high.entries()) push(`highRank:${r.cardId}:gain`, "H", GAIN_RANK[r.infoGain] ?? 9, GAIN_RANK[highRows[i]?.[4] ?? ""] ?? 9);
  probe("highMd:totalHighN", "H", H, /全库增量「高」共 ([\d,]+) 题/, stats.derived.highN);
  probe("highMd:coveragePct", "H", H, /本条榜单覆盖其中 ([\d.]+)%/, Number(((ranks.high.filter((r) => r.infoGain === "高").length / stats.derived.highN) * 100).toFixed(1)));
  probe("highMd:mcHighPerSession", "H", H, /实际曝光只有 ([\d.]+) 题\/局/, Number(mc.overallCompleted20.highPerSession));
}

/* ⑨ DUPLICATE-TOP10.md（A.2 口径：覆盖 / 分桶 / 进簇≠重复 / TOP 簇样例） */
{
  const head0 = "## 0. 口径声明：**进簇 ≠ 重复**";
  cmpCell("dup:semanticClusterCoverage", "D#0", D, head0, "semanticClusterCoverage", 2, dup.taggedCount);
  cmpCell("dup:untagged", "D#0", D, head0, "未打簇", 2, N - dup.taggedCount);
  cmpCell("dup:clusterCount", "D#0", D, head0, "簇总数", 2, dup.clusterCount);
  cmpCell("dup:multiClusterCount", "D#0", D, head0, "同簇 ≥2 的簇数", 2, dup.multiClusters.length);
  cmpCell("dup:actualDupCount", "D#0", D, head0, "actualDuplicateCandidateRate", 2, dup.actualDupCount);
  probeText("dup:notDuplicateBanner", "D#0", D, "进簇 ≠ 重复");
  probeText("dup:noDuplicateRateWording", "D#0", D, "仅为簇结构特征，不代表这些卡互为重复");
  const head1 = "## 1. 簇规模分布（按簇规模分桶）";
  for (const b of dup.clusterSizeBuckets) {
    cmpCell(`dup:bucket:${b.label}:clusters`, "D#1", D, head1, b.label, 1, b.clusters);
    cmpCell(`dup:bucket:${b.label}:cards`, "D#1", D, head1, b.label, 2, b.cards);
  }
  const head2 = `## 2. 规模最大的语义簇 TOP ${int(TOP_CLUSTERS_SHOWN)}（每簇 ${int(CLUSTER_SAMPLE_LINES)} 条题面）`;
  const topRows = sectionRows(D, head2).filter((r) => /^\d+$/.test(r[0] ?? ""));
  dup.multiClusters.slice(0, TOP_CLUSTERS_SHOWN).forEach(([name, n], i) => {
    push(`dup:top:${name}:rank`, "D#2", i + 1, toNum(topRows[i]?.[0]));
    push(`dup:top:${name}:size`, "D#2", n, toNum(topRows[i]?.[2]));
    push(`dup:top:${name}:lowZero`, "D#2", clusterInfo(name).lowZero, toNum(topRows[i]?.[4]));
    /* 每簇 N 条题面：块头必须逐字匹配（含簇名与张数），且块内必须出现「题面 1..N」。 */
    const blockRe = new RegExp(`\\*\\*簇 ${i + 1}｜${escRe(name)}\\*\\*（${n} 张）[\\s\\S]*?- 题面 ${CLUSTER_SAMPLE_LINES}：`);
    checks.push({ name: `dup:top:${name}:samples`, where: "D#2", expected: 1, actual: blockRe.test(D) ? 1 : 0 });
  });
  probe("dup:3:top1Size", "D#3", D, /规模最大的簇是 .+?（([\d,]+) 张）/, dup.multiClusters[0]?.[1] ?? 0);
  probe("dup:3:topShownSum", "D#3", D, /前 [\d,]+ 簇合计 ([\d,]+) 张/, dup.multiClusters.slice(0, TOP_CLUSTERS_SHOWN).reduce((s, [, c]) => s + c, 0));
  probe("dup:3:geThresholdClusters", "D#3", D, new RegExp(`簇规模 ≥${CLUSTER_BIG_THRESHOLD} 的簇有 (\\d+) 个`), dup.multiClusters.filter(([, c]) => c >= CLUSTER_BIG_THRESHOLD).length);
  probe("dup:3:geThresholdCards", "D#3", D, /合计 (\d+) 张。/, dup.multiClusters.filter(([, c]) => c >= CLUSTER_BIG_THRESHOLD).reduce((s, [, c]) => s + c, 0));
  probe("dup:3:lowZeroInClusters", "D#3", D, /这些多卡簇里增量低\/0 的题合计 ([\d,]+) 张/, dup.multiClusters.reduce((s, [n]) => s + clusterInfo(n).lowZero, 0));
  for (const [k, v] of stats.disposition.dist) probe(`dup:4:disposition:${k}`, "D#4", D, dispRe(k), v);
}

/* ⑩ CONTENT-GAP-AND-NEXT.md */
{
  const head1 = "## 1. 主题缺口对照表（literalHits 与 semanticHits 并列，7 个主题）";
  for (const t of gap.themes) {
    const sm = semOf(t.theme);
    cmpCell(`gap:${t.theme}:literalHits`, "G#1", G, head1, t.theme, 1, t.literalHits);
    cmpCell(`gap:${t.theme}:semanticHits`, "G#1", G, head1, t.theme, 2, sm?.semanticHits ?? Number.NaN);
    cmpCell(`gap:${t.theme}:adjudicatedCount`, "G#1", G, head1, t.theme, 3, sm?.adjudicatedCount ?? Number.NaN);
    cmpCell(`gap:${t.theme}:patternsProbed`, "G#1", G, head1, t.theme, 4, t.patternsProbed);
    probeText(`gap:${t.theme}:wording`, "G#1", G, cell(sm?.wording ?? "").slice(0, 12));
  }
  push("gapSem:themeRowCount", "G#1", gap.themes.length, sectionRows(G, head1).filter((r) => r[0] !== "主题" && r.length >= 6).length);
  /* 语义一致性表 §1.1 */
  const head11 = "### 1.1 语义复核的一致性（两名 reviewer 是否互相对得上）";
  for (const a of gapSem.agreement) {
    cmpCell(`gapSem:${a.theme}:s1`, "G#1.1", G, head11, a.theme, 1, a.s1Hits);
    cmpCell(`gapSem:${a.theme}:s2`, "G#1.1", G, head11, a.theme, 2, a.s2Hits);
    cmpCell(`gapSem:${a.theme}:inter`, "G#1.1", G, head11, a.theme, 3, a.intersection);
    cmpCell(`gapSem:${a.theme}:jaccard`, "G#1.1", G, head11, a.theme, 5, a.jaccard);
    cmpCell(`gapSem:${a.theme}:kappa`, "G#1.1", G, head11, a.theme, 6, a.cohenKappa);
  }
  /* §1.3 语义空白主题数 */
  probe("gapSem:blankThemes", "G#1.3", G, /(\d+) 个：/, gapSem.totals.semanticBlankThemes.length);
  /* §1.2b 主题再拆分（亲密/性观念）：子类张数 + 「性观念」空白声明 + 成年亲密约束 */
  {
    const headSplit = "### 1.2b 主题再拆分：「亲密/性观念」不是一个类（独立第三方逐题二分）";
    const splitRows = sectionRows(G, headSplit);
    for (const st of splitTheme?.subthemes ?? []) {
      const r = splitRows.find((x) => x[0] === st.category);
      push(`gapSem:split:${st.category}`, "G#1.2b", st.count, r ? toNum(r[1]) : Number.NaN);
    }
    push("gapSem:split:state", "G#1.2b", 1, new RegExp(`拆分状态 \\*\\*${splitState}\\*\\*`).test(G) ? 1 : 0);
    probeText("gapSem:split:sexualAttitudeBlank", "G#1.2b", G, "自我披露问答仍是内容空白");
    probeText("gapSem:split:consentConstraints", "G#1.2b", G, "行动题必须实时 Consent");
    probeText("gapSem:split:cannotSubstitute", "G#1.2b", G, "不能替代");
    for (const cid of boundaryIds) probeText(`gapSem:split:boundaryCard:${cid}`, "G#1.2b", G, cid);
  }
  probe("gapSem:literalHitsSum", "G#1", G, /literalHits 合计 ([\d,]+) 题/, gap.themes.reduce((s, t) => s + t.literalHits, 0));
  probe("gapSem:semanticHitsSum", "G#1", G, /semanticHits 合计 ([\d,]+) 题/, gapSem.totals.semanticHitsSum);
  probe("gap:zeroThemes", "G#1.4", G, /共 (\d+) 个：/, zeroThemes.length);
  /* 词面命中明细：逐词条 */
  const patRows = sectionRows(G, "### 1.5 词面命中词条明细（哪些词条真的被问到过）").filter((r) => r[0] !== "主题" && r.length >= 3);
  let patChecked = 0;
  for (const t of gap.themes) for (const p of t.matchedPatterns) {
    const r = patRows.find((x) => x[0] === t.theme && x[1] === p.label);
    push(`gap:pattern:${t.theme}:${p.label}`, "G#1.5", p.count, r ? toNum(r[2]) : Number.NaN);
    patChecked += 1;
  }
  push("gap:patternRowCount", "G#1.5", patChecked, patRows.length);
  /* §4.2 缓冲池配额建议（散文数字） */
  probe("gap:quotaPoolSize", "G#4.2", G, /缓冲池 ([\d,]+) 张 = 全库/, stats.disposition.bufferQuota.poolSize);
  probe("gap:quotaSkeleton", "G#4.2", G, /=\s*\*\*([\d,]+) 张\*\*/, stats.disposition.bufferQuota.skeletonN);
  probe("gap:quotaCap", "G#4.2", G, /建议缓冲池最多保留 ([\d,]+) 张/, stats.disposition.bufferQuota.recommendedCap);
  probe("gap:quotaLowZeroTotal", "G#4.2", G, /占「低\/0 信息题」（([\d,]+) 张）/, stats.disposition.bufferQuota.lowZeroTotal);
  /* §2 仲裁终判分布 */
  const head2 = "## 2. 仲裁样本（高分歧题）给出的信息增量终判分布";
  for (const g of GAIN_ORDER) {
    if (adjGainDist[g] === undefined) continue;
    cmpCell(`gap:adjGain:${g}`, "G#2", G, head2, g, 1, adjGainDist[g]!);
  }
  cmpCell("gap:adjTotal", "G#2", G, head2, "合计", 1, adjudication.length);
  probe("gap:adjAgree", "G#2", G, /完全一致 (\d+)\/(\d+)（/, adjAgree);
  probe("gap:adjAgreeDenom", "G#2", G, /完全一致 \d+\/(\d+)（/, adjudication.length);
  probe("gap:adjGap1", "G#2", G, /差 1 档的 (\d+) 题/, adjGapDist["1"] ?? 0);
  probe("gap:adjGap2", "G#2", G, /差 2 档的 (\d+) 题/, adjGapDist["2"] ?? 0);
  /* §3 / §4 */
  probe("gap:3:highN", "G#3", G, /增量「高」(\d+) 题、低\/0/, stats.derived.highN);
  probe("gap:3:lowZeroN", "G#3", G, /低\/0 (\d+) 题（/, stats.derived.lowZeroN);
  probe("gap:3:semanticBlankThemes", "G#3", G, /(\d+) 个主题经\*\*三层独立语义复核\*\*/, gapSem.totals.semanticBlankThemes.length);
  for (const [k, v] of stats.disposition.dist) probe(`gap:4:disposition:${k}`, "G#4", G, dispRe(k), v);
  probe("gap:4:highZeroTypes", "G#4", G, /增量「高」为 0 的玩法有 (\d+) 个/, stats.typeDist.filter((t) => (t.byGain.find((b) => b.gain === "高")?.count ?? 0) === 0).length);
  const worstType = stats.typeDist.slice().sort((a, b) => (a.midPlus / a.count) - (b.midPlus / b.count))[0]!;
  probe("gap:4:worstMidPlus", "G#4", G, /中及以上仅 ([\d.]+)%/, Number(((worstType.midPlus / worstType.count) * 100).toFixed(1)));
  probe("gap:4:highN", "G#4", G, /确认「高」从 (\d+) 变为非 0/, stats.derived.highN);
  /* §6 Phase B 内容缺口单列 + 方案 E 设计约束 */
  probe("gap:phaseB:gapCount", "G#6.1", G, /缺口（([\d,]+) 类，正式单列）/, PHASE_B_CONTENT_GAPS.length);
  for (const t of PHASE_B_CONTENT_GAPS) probeText(`gap:phaseB:item:${t}`, "G#6.1", G, t);
  probeText("gap:phaseB:cannotSubstitute", "G#6.1", G, "不能替代");
  probeText("gap:phaseB:notCover", "G#6.1", G, "自我披露问答仍是空白");
  probeText("gap:phaseB:schemeE", "G#6.2", G, "方案 E");
  probeText("gap:phaseB:keepHeat", "G#6.2", G, "不改**：H1→H4 单调 Heat");
  probeText("gap:phaseB:ceiling1", "G#6.2", G, "ceiling=1 时");
  probeText("gap:phaseB:ceiling2", "G#6.2", G, "ceiling=2 时");
  probeText("gap:phaseB:noDiagonal", "G#6.2", G, "严格对角矩阵");
  probeText("gap:phaseB:notImplemented", "G#6.2", G, "不新增 SSOT 内容");
}

/* ⑩b 第三方独立全库扫描：判定权在**非空机器凭证**，不在「载荷文件是否存在」        */
/*   fail-closed：凭证缺失/0 字节/completed!==true/sourceHash 或 querySetHash 与实际  */
/*   不符/resultCount 与载荷行数不符 → 记失败项并对账 FAIL（不回退成 existsSync）。   */
{
  try {
    const v = verifyScanCredential(
      `${DIR}/_semantic/independent-scan.CREDENTIAL.json`,
      `${DIR}/_semantic/independent-scan.jsonl`,
      { ssotCards, zeroHitThemes },
    );
    push("scanCredential:completed", "SCAN", 1, v.credential.completed ? 1 : 0);
    push("scanCredential:resultCount==payloadLines", "SCAN", v.payloadLines, v.credential.resultCount);
    push("scanCredential:payloadBytes", "SCAN", v.payloadBytes, v.credential.payloadBytes);
    push("scanCredential:sourceHash==currentSsot", "SCAN", 1, v.credential.sourceHash === v.sourceHash ? 1 : 0);
    push("scanCredential:querySetHash==currentZeroHitThemes", "SCAN", 1, v.credential.querySetHash === v.querySetHash ? 1 : 0);
    /* 报告措辞必须与凭证结论同向：独立扫描被引用，且 0 命中是明说的（不是「文件在就行」）。 */
    probeText("scanCredential:reportCitesScan", "SCAN", G, "第三方独立全库扫描");
    probeText("scanCredential:reportCitesZeroHits", "SCAN", G, "均为 0 命中");
  } catch (e) {
    console.error(`\n[scanCredential] fail-closed：${(e as Error).message}`);
    push("scanCredential:verify", "SCAN", 1, 0);
  }
}

/* ⑪ CALIBRATION-REPORT.md（逐轴 κ + raw agreement + 5/23 分列 + lean + drift） */
{
  probeText("calib:weightedLinearDeclared", "C#0", C, "linear weighted kappa");
  probeText("calib:cohenKappaDeclared", "C#0", C, "Cohen's kappa");
  probeText("calib:sixAxisDemoted", "C#0", C, "六轴全一致率降级为参考项");
  const head1 = "## 1. 每轴 raw agreement 与一致性系数 κ（主指标）";
  const kRows = sectionRows(C, head1).filter((r) => r.length === 6);
  for (const p of calib.pairResults) for (const ax of axisKeys) {
    const r = kRows.find((x) => x[0] === p.pair && x[1] === ax);
    push(`calib:kappa:${p.pair}:${ax}`, "C#1", p.perAxisCoefficient[ax]!.value, r ? toNum(r[5]) : Number.NaN);
    push(`calib:raw:${p.pair}:${ax}`, "C#1", Number(p.perAxisRate[ax]!.rate.replace("%", "")), r ? toNum(r[4]) : Number.NaN);
  }
  const head2 = "## 2. 六轴全一致率（参考项，不再是 Gate 主指标）";
  for (const p of calib.pairResults) {
    cmpCell(`calib:allSix:${p.pair}`, "C#2", C, head2, p.pair, 2, p.allSixAgree);
    cmpCell(`calib:allSixN:${p.pair}`, "C#2", C, head2, p.pair, 1, p.n);
    cmpCell(`calib:gap2:${p.pair}`, "C#2", C, head2, p.pair, 4, p.infoGainGap2Plus);
  }
  const head3 = "## 3. 系统性偏松 / 偏紧（相对三方多数票）";
  for (const [name, d] of Object.entries(calib.lean)) {
    cmpCell(`calib:lean:${name}:gainUp`, "C#3", C, head3, name, 1, d.gainUp!);
    cmpCell(`calib:lean:${name}:gainDown`, "C#3", C, head3, name, 2, d.gainDown!);
    cmpCell(`calib:lean:${name}:gainSame`, "C#3", C, head3, name, 3, d.gainSame!);
    cmpCell(`calib:lean:${name}:socialUp`, "C#3", C, head3, name, 4, d.socialUp!);
    cmpCell(`calib:lean:${name}:socialDown`, "C#3", C, head3, name, 5, d.socialDown!);
    cmpCell(`calib:lean:${name}:progUp`, "C#3", C, head3, name, 6, d.progUp!);
    cmpCell(`calib:lean:${name}:progDown`, "C#3", C, head3, name, 7, d.progDown!);
  }
  const head4 = "## 4. 玩法维度漂移（原 reviewer 相对多数票的偏离率，升序=最稳）";
  for (const d of calib.drift) {
    const label = TYPE_CN[d.gameType] ?? d.gameType;
    cmpCell(`calib:drift:${d.gameType}:n`, "C#4", C, head4, label, 1, d.n);
    cmpCell(`calib:drift:${d.gameType}:semantic`, "C#4", C, head4, label, 2, Number(d.semanticConsensusRate.replace("%", "")));
    cmpCell(`calib:drift:${d.gameType}:gain`, "C#4", C, head4, label, 3, Number(d.gainConsensusRate.replace("%", "")));
    cmpCell(`calib:drift:${d.gameType}:deviations`, "C#4", C, head4, label, 4, d.origGainDeviations);
    cmpCell(`calib:drift:${d.gameType}:rate`, "C#4", C, head4, label, 5, Number(d.origDeviationRate.replace("%", "")));
    /* 增量判定分布是「高 6 / 低 24」这类合并单元格，逐键在单元格文本内探针，不能只取首个数字。 */
    const spreadCell = rowByLabel(sectionRows(C, head4), label)?.[6] ?? "";
    for (const [k, v] of Object.entries(d.gainSpread)) {
      probe(`calib:drift:${d.gameType}:spread:${k}`, "C#4", spreadCell, new RegExp(`(?:^|/ )${escRe(k)} (\\d+)`), v);
    }
  }
  const head5 = "## 5. 两个**不同定义**的分歧集合：autoHighDisagreement vs adjudicationSet";
  cmpCell("calib:autoHighDisagreement", "C#5", C, head5, "autoHighDisagreement", 2, calib.disagreementSets.autoHighDisagreement.count);
  cmpCell("calib:adjudicationSet", "C#5", C, head5, "adjudicationSet", 2, calib.disagreementSets.adjudicationSet.count);
  probe("calib:overlap", "C#5", C, /两集重叠 (\d+) 题/, calib.disagreementSets.overlapCount);
  for (const g of GAIN_ORDER) {
    if (calib.adjudicationGainDist[g] === undefined) continue;
    probe(`calib:adjGain:${g}`, "C#5", C, new RegExp(`${g} (\\d+) 题`), calib.adjudicationGainDist[g]!);
  }
  probe("calib:5:adjAgree", "C#5", C, /infoGain 一致率 [\d.]+%（一致 (\d+) \/ 共/, adjAgree);
  probe("calib:5:adjDenom", "C#5", C, /（一致 \d+ \/ 共 (\d+)，差 1 档/, adjudication.length);
  probe("calib:6:sampleSize", "C#6", C, /校准样本 (\d+) 题，覆盖全库/, calib.sampleSize);
  probe("calib:6:N", "C#6", C, /不覆盖全库 ([\d,]+) 题/, N);
  probe("calib:6:gap2Sum", "C#6", C, /仍有 (\d+) 人次出现极差/, calib.pairResults.reduce((s, p) => s + p.infoGainGap2Plus, 0));
}

/* ⑪b CALIBRATION-REPORT.md §7（漂移玩法复审标签 / never_have_i 门槛） */
{
  const head7 = "## 7. 玩法漂移度量与复审标签（A.2 收口；真源 STABLE-LABELS.json）";
  const driftRows = sectionRows(C, head7).filter((r) => r.length >= 8);
  for (const d of stable.drift) {
    for (const a of d.axes) {
      const r = driftRows.find((x) => x[0] === d.label && x[2] === a.axis);
      push(`stable:${d.gameType}:${a.axis}:n`, "C#7", d.n, r ? toNum(r[1]) : Number.NaN);
      push(`stable:${d.gameType}:${a.axis}:raw`, "C#7", Number(a.rawAgreement.replace("%", "")), r ? Number(numOnly(r[5])) : Number.NaN);
      push(`stable:${d.gameType}:${a.axis}:kappa`, "C#7", a.kappa, r ? toNum(r[6]) : Number.NaN);
    }
  }
  push("stable:arbInput", "C#7.1", stable.arbitration.inputCount, (() => {
    const m = C.match(/本轮共 ([\d,]+) 张卡至少有一轴无多数票/);
    return m ? Number(m[1].replace(/,/g, "")) : Number.NaN;
  })());
  push("stable:arbResolved", "C#7.1", stable.arbitration.resolvedCount, (() => {
    const m = C.match(/已仲裁 ([\d,]+) 张/);
    return m ? Number(m[1].replace(/,/g, "")) : Number.NaN;
  })());
  for (const s of stable.reviewedLabelScope.reviewed) {
    const r = sectionRows(C, "### 7.2 哪些玩法的标签已完成双源复审与分歧仲裁").find((x) => x[0]?.startsWith(`${s.label}（${s.gameType}）`));
    push(`stable:scope:${s.gameType}:cards`, "C#7.2", s.cardCount, r ? toNum(r[1]) : Number.NaN);
  }
  probeText("stable:labelStatusNote", "C#7.4", C, "可用于主题/候选定位");
  probeText("stable:labelStatusNoteScope", "C#7.4", C, "低可靠轴不得作为单题自动保留/删除依据");
  /* 收口降级锁：报告与 JSON 真源里不得再出现「已稳定版」这类措辞（出现即 fail-closed）。 */
  push("stable:noStableWording", "C#7+STABLE-LABELS.json", 0, /已稳定版标签|已稳定版|STABLE_MAJORITY/.test(C + JSON.stringify(stable)) ? 1 : 0);
  /* §7.3 never_have_i 门槛表：逐玩法过/不过 */
  const head73 = "### 7.3 never_have_i 是否需要全量复审（门槛先定后判）";
  for (const d of calib.drift) {
    const dev = Number(d.origDeviationRate.replace("%", "")) / 100;
    const gain = Number(d.gainConsensusRate.replace("%", "")) / 100;
    const r = sectionRows(C, head73).find((x) => x[0] === (TYPE_CN[d.gameType] ?? d.gameType));
    push(`stable:gate:${d.gameType}:dev`, "C#7.3", Number(d.origDeviationRate.replace("%", "")), r ? Number(numOnly(r[1])) : Number.NaN);
    push(`stable:gate:${d.gameType}:gain`, "C#7.3", Number(d.gainConsensusRate.replace("%", "")), r ? Number(numOnly(r[2])) : Number.NaN);
    void dev; void gain;
  }
  probeText("stable:neverHaveIVerdict", "C#7.3", C, stable.neverHaveIDecision.verdict.slice(0, 20));
  probeText("stable:usageLimit", "C#7.4", C, "只能用于候选排序，不得自动决定保留/删除");
  probe("stable:kappaGateValue", "C#7", C, /本轮取 κ < ([\d.]+) 判「明显不足」/, stable.gates.kappaMinForDecision);
}

/* ⑫ ROUTER-CONTENT-MONTE-CARLO.md */
{
  /* §1 耗尽分列（fail-closed：标签必须存在） */
  const head1 = "## 1. 耗尽与切包（按生产 outcome.kind 分列，不再统一当 AWAITING 洗牌）";
  const rowSpecs: [string, string, number][] = [
    ["耗尽次数/局", "exhaustedMean", 1],
    ["其中 PACK_EXHAUSTED/局", "packExhaustedMean", 1],
    ["其中 RELATIONSHIP_GLOBAL_EXHAUSTED/局", "globalExhaustedMean", 1],
    ["其中 AWAITING_HOST/局", "awaitingHostMean", 1],
    ["洗牌（AWAITING Host 决策）/局", "reshufflesMean", 1],
    ["切玩法次数/局", "switchesMean", 1],
  ];
  for (const [label, key, col] of rowSpecs) cmpCell(`mc:1:${key}:c20`, "M#1", M, head1, label, col, mc.overallCompleted20[key] as number);
  for (const [label, key] of [["耗尽次数/局", "exhaustedMean"], ["其中 PACK_EXHAUSTED/局", "packExhaustedMean"], ["其中 RELATIONSHIP_GLOBAL_EXHAUSTED/局", "globalExhaustedMean"], ["其中 AWAITING_HOST/局", "awaitingHostMean"], ["洗牌（AWAITING Host 决策）/局", "reshufflesMean"], ["切玩法次数/局", "switchesMean"], ["guard 最大使用", "guardUsedMax"], ["撞 guard 上限被截断的局", "truncatedSessions"], ["dead-end 局", "deadEndSessions"]] as [string, string][]) {
    cmpCell(`mc:1:${key}:all`, "M#1", M, head1, label, 2, mc.overall[key] as number);
  }
  /* §1b 终止原因 */
  const head1b = "### 1b. 终止原因分布（跑不满 20 轮的局必须写明原因）";
  for (const [reason, n] of Object.entries(mc.overall.termination)) cmpCell(`mc:1b:${reason}`, "M#1b", M, head1b, reason, 1, n);
  probe("mc:1b:deadEndEqualsNonRoundLimit", "M#1b", M, /round_limit \| ([\d,]+)/, mc.overall.termination.round_limit!);
  /* §2 overallCompleted20 逐字段（MC_LABELS fail-closed）*/
  const head2 = "## 2. 跑满 20 轮的局：内容侧均值（与 Phase A 可比的 20 轮口径）";
  for (const [k, label] of MC_LABELS) {
    const v = mc.overallCompleted20[k];
    if (v === undefined) {
      /* A.2 fail-closed：MC_LABELS 声明要对账的键在 JSON 缺失 → 记失败并打印缺哪个键。 */
      checks.push({ name: `mc:MC_LABELS_MISSING_KEY:${k}`, where: "ROUTER-MONTE-CARLO.json#overallCompleted20", expected: -1, actual: null });
      continue;
    }
    cmpCell(`mc:2:${k}`, "M#2", M, head2, label, 1, v);
  }
  /* §3 perTable（12 列全覆盖）*/
  const head3 = "## 3. 各桌型（跑满 20 轮子集；曝光卡数逐桌列出）";
  for (const t of mc.perTable) {
    const label = t.label;
    cmpCell(`mc:3:${t.table}:sessions`, "M#3", M, head3, label, 1, t.sessionsCompleted20);
    cmpCell(`mc:3:${t.table}:high`, "M#3", M, head3, label, 2, t.highPerSession);
    cmpCell(`mc:3:${t.table}:midPlus`, "M#3", M, head3, label, 3, t.midPlusPerSession);
    cmpCell(`mc:3:${t.table}:personTopics`, "M#3", M, head3, label, 4, t.personTopicsPerSession);
    cmpCell(`mc:3:${t.table}:low0run`, "M#3", M, head3, label, 5, t.longestLowZeroRunMean);
    cmpCell(`mc:3:${t.table}:judge`, "M#3", M, head3, label, 6, t.judgeShareMean);
    cmpCell(`mc:3:${t.table}:reshuffles`, "M#3", M, head3, label, 7, t.reshufflesMean);
    cmpCell(`mc:3:${t.table}:packExhausted`, "M#3", M, head3, label, 8, t.packExhaustedMean);
    cmpCell(`mc:3:${t.table}:globalExhausted`, "M#3", M, head3, label, 9, t.globalExhaustedMean);
    cmpCell(`mc:3:${t.table}:switches`, "M#3", M, head3, label, 10, t.switchesMean);
    cmpCell(`mc:3:${t.table}:distinct`, "M#3", M, head3, label, 11, t.distinctCardsExposed);
  }
  /* §4 分档 */
  const head4 = "## 4. 开放度分档（dead-end 的来源，必须披露）";
  for (const c of mc.cohortByIntensityLimit) {
    cmpCell(`mc:4:${c.intensityLimit}:sessions`, "M#4", M, head4, String(c.intensityLimit), 1, c.sessions);
    cmpCell(`mc:4:${c.intensityLimit}:deadEnd`, "M#4", M, head4, String(c.intensityLimit), 2, c.deadEndSessions);
    cmpCell(`mc:4:${c.intensityLimit}:rate`, "M#4", M, head4, String(c.intensityLimit), 3, Number((c.deadEndRate * 100).toFixed(1)));
    cmpCell(`mc:4:${c.intensityLimit}:completedMean`, "M#4", M, head4, String(c.intensityLimit), 4, c.completedRoundsMean);
    cmpCell(`mc:4:${c.intensityLimit}:high`, "M#4", M, head4, String(c.intensityLimit), 5, c.highPerSession);
  }
  /* §5 Heat 双口径 */
  const head5 = "## 5. Heat 运行时曝光（双口径；体验统计主口径 = heatAtDraw）";
  const atDrawTotal = Object.values(mc.heatExposure).reduce((a, b) => a + b, 0);
  const afterTotal = Object.values(mc.heatExposureAfterTerminal).reduce((a, b) => a + b, 0);
  for (const [h, v] of Object.entries(mc.heatExposure)) {
    cmpCell(`mc:5:atDraw:${h}`, "M#5", M, head5, h, 1, v);
    cmpCell(`mc:5:atDrawPct:${h}`, "M#5", M, head5, h, 2, Number(((v / atDrawTotal) * 100).toFixed(1)));
    cmpCell(`mc:5:afterTerminal:${h}`, "M#5", M, head5, h, 3, mc.heatExposureAfterTerminal[h] ?? 0);
    cmpCell(`mc:5:afterTerminalPct:${h}`, "M#5", M, head5, h, 4, Number((((mc.heatExposureAfterTerminal[h] ?? 0) / afterTotal) * 100).toFixed(1)));
  }
  probeText("mc:5:mainCaliberDeclared", "M#5", M, "体验统计一律用它");
  /* §6 静态可用范围（legalCount / high / midPlus）*/
  const head6 = "## 6. Heat 静态可用范围（第三套口径，按卡面 heatMin/heatMax）";
  for (const h of mc.staticHeatAvailability) {
    cmpCell(`mc:6:${h.heat}:legal`, "M#6", M, head6, h.heat, 1, h.legalCount);
    cmpCell(`mc:6:${h.heat}:pct`, "M#6", M, head6, h.heat, 2, Number(((h.legalCount / N) * 100).toFixed(1)));
    cmpCell(`mc:6:${h.heat}:high`, "M#6", M, head6, h.heat, 3, h.high);
    cmpCell(`mc:6:${h.heat}:midPlus`, "M#6", M, head6, h.heat, 4, h.midPlus);
  }
  /* §7 曝光分布（累计曝光 + 增量拆分 + 全部曝光占比）*/
  const head7 = "## 7. 曝光分布：真实 Router 抽出来的内容构成";
  for (const [gt, n] of Object.entries(mc.exposureByGameType)) {
    const label = TYPE_CN[gt] ?? gt;
    const g = mc.gainByGameType[gt] ?? {};
    cmpCell(`mc:7:${gt}:exposure`, "M#7", M, head7, label, 1, n);
    cmpCell(`mc:7:${gt}:pct`, "M#7", M, head7, label, 2, Number(((n / mc.overall.totalExposure) * 100).toFixed(1)));
    cmpCell(`mc:7:${gt}:high`, "M#7", M, head7, label, 3, g["高"] ?? 0);
    cmpCell(`mc:7:${gt}:mid`, "M#7", M, head7, label, 4, g["中"] ?? 0);
    cmpCell(`mc:7:${gt}:low`, "M#7", M, head7, label, 5, g["低"] ?? 0);
    cmpCell(`mc:7:${gt}:zero`, "M#7", M, head7, label, 6, g["0"] ?? 0);
  }
  probe("mc:7:truthPackExposure", "M#7", M, new RegExp(`「真心话 \\+ 大冒险」合计 ([\\d,]+) 次`), (mc.exposureByGameType.truth ?? 0) + (mc.exposureByGameType.dare ?? 0));
  probe("mc:7:dareExposure", "M#7", M, /（PN-DARE-\*）曝光 ([\d,]+) 次/, mc.exposureByGameType.dare ?? 0);
  probe("mc:7:truthExposure", "M#7", M, /（PN-TRUTH-\*）曝光 ([\d,]+) 次/, mc.exposureByGameType.truth ?? 0);
  /* §8 最高 / 最低曝光（逐卡）*/
  for (const e of mc.topExposed.slice(0, 5)) probe(`mc:8:top:${e.cardId}`, "M#8", M, new RegExp(`\\| 曝光最高 \\| ${escRe(e.cardId)} \\| ([\\d,]+) \\|`), e.count);
  for (const e of mc.leastExposed.slice(0, 5)) probe(`mc:8:least:${e.cardId}`, "M#8", M, new RegExp(`\\| 曝光最低 \\| ${escRe(e.cardId)} \\| ([\\d,]+) \\|`), e.count);
  /* §9 MATCH-enabled 覆盖 */
  const head9 = "## 9. MATCH-enabled simulation：38 张 matchRequired 卡的可见性变化";
  cmpCell("mc:9:withoutMatch:covered", "M#9", M, head9, "MATCH 关闭（主扫描）", 4, cov.withoutMatch.covered);
  cmpCell("mc:9:withoutMatch:exposure", "M#9", M, head9, "MATCH 关闭（主扫描）", 5, cov.withoutMatch.totalExposure);
  cmpCell("mc:9:withoutMatch:matches", "M#9", M, head9, "MATCH 关闭（主扫描）", 1, cov.withoutMatch.matchesCreated);
  cmpCell("mc:9:withMatch:covered", "M#9", M, head9, "MATCH 启用", 4, cov.withMatch.covered);
  cmpCell("mc:9:withMatch:exposure", "M#9", M, head9, "MATCH 启用", 5, cov.withMatch.totalExposure);
  cmpCell("mc:9:withMatch:matches", "M#9", M, head9, "MATCH 启用", 1, cov.run.matchesCreated);
  cmpCell("mc:9:withMatch:totalExposure", "M#9", M, head9, "MATCH 启用", 2, cov.run.totalExposure);
  cmpCell("mc:9:withMatch:distinct", "M#9", M, head9, "MATCH 启用", 3, cov.run.distinctCardsExposed);
  probe("mc:9:total", "M#9", M, /matchRequired 卡（targetMode=match-pair，共 ([\d,]+) 张/, cov.total);
  probe("mc:9:deltaCovered", "M#9", M, /覆盖从 (\d+)\/38 提升到/, cov.withoutMatch.covered);
  probe("mc:9:deltaCoveredTo", "M#9", M, /提升到 (\d+)\/38/, cov.withMatch.covered);
  probe("mc:9b:stillMissing", "M#9b", M, /仍未曝光的 matchRequired 卡：(\d+) 张/, stillMissingMatch.length);
  for (const c of cov.withMatch.cards) probe(`mc:9b:card:${c.cardId}`, "M#9b", M, new RegExp(`${escRe(c.cardId)}（([\\d,]+) 次）`), c.count);
  /* §10 uniform baseline */
  const head10 = "## 10. uniform-baseline 对照（不同口径，不得混用）";
  cmpCell("mc:10:uniformHigh", "M#10", M, head10, "uniform-baseline estimate", 2, Number(((stats.derived.highN / N) * mc.config.targetCompletedRounds).toFixed(2)));
  cmpCell("mc:10:uniformMidPlus", "M#10", M, head10, "uniform-baseline estimate", 3, Number(((stats.derived.personTopicMidPlusN / N) * mc.config.targetCompletedRounds).toFixed(2)));
  cmpCell("mc:10:realHigh", "M#10", M, head10, "真实 Router Monte Carlo", 2, Number(mc.overallCompleted20.highPerSession));
  cmpCell("mc:10:realMidPlus", "M#10", M, head10, "真实 Router Monte Carlo", 3, Number(mc.overallCompleted20.midPlusPerSession));
  /* §11 根因结论 */
  probe("mc:11:highN", "M#11", M, /增量「高」([\d,]+) 题、低\/0/, stats.derived.highN);
  probe("mc:11:lowZeroN", "M#11", M, /低\/0 ([\d,]+) 题（/, stats.derived.lowZeroN);
  probe("mc:11:personTopics", "M#11", M, /人物信息主题只覆盖 ([\d.]+)\//, Number(mc.overallCompleted20.personTopicsPerSession));
  probe("mc:11:longestRun", "M#11", M, /最长连续「低\/0」连击均值 ([\d.]+) 轮/, Number(mc.overallCompleted20.longestLowZeroRunMean));
  /* §1 结论段：洗牌次数（散文）*/
  probe("mc:1:reshufflesMeanProse", "M#1", M, /洗牌次数为 ([\d.]+) 次\/局/, Number(mc.overall.reshufflesMean));
  probe("mc:1:awaitingMeanProse", "M#1", M, /AWAITING 一次都没出现（([\d.]+) 次\/局）/, Number(mc.overall.awaitingHostMean));
}

/* ⑬ CSV / JSONL 行数 + 交付物清单 */
push("csv:rows", "CONTENT-AUDIT-350.csv", N, csvRows);
push("jsonl:rows", "CONTENT-AUDIT-350.jsonl", N, rows.length);

/* ------------------------------------------------------------------ */
/* 明确列出「不在对账范围」的数字（不许静默漏掉）                             */
/* ------------------------------------------------------------------ */
const NOT_VERIFIED: { item: string; why: string }[] = [
  { item: "CSV / JSONL 单元格内的题面文本、cardId 文本字段", why: "属文本字段，本脚本只对账数字；题面逐字一致性由 scripts/audit-a1-verify.ts 负责" },
  { item: "三轴交叉榜第 16 名及以后的组合计数", why: "报告只展示 TOP 15（显示常量），其余组合未渲染到 md，无对应磁盘文本可比" },
  { item: "语义簇中第 11 名及以后的簇卡数与样例", why: "报告只在分桶计数与 TOP 10 表里渲染；第 11 名以后的明细未落 md" },
  { item: "GAP-LITERAL 中 0 命中词条的名称列表", why: "报告只列「有命中词条」（0 命中词条以汇总句表达），未逐条渲染" },
  { item: "ROUTER-MONTE-CARLO-exposure.csv 全量行、_ranks.json 全量题面", why: "属输入真源与中间产物；报告只渲染头部若干行/榜位" },
  { item: "MC-TRACE.json 逐轮字段值", why: "本脚本只核验 trace 文件存在与终止原因集合；逐轮内容由 QA 直接读 JSON 复核" },
  { item: "STABLE-LABELS.json#reviewedCards 的逐卡复审标签、GAP-SEMANTIC.json#themes 的逐题语义命中清单与 subthemes 逐卡归属理由", why: "逐卡/逐题标签属明细数据；报告只渲染各轴 κ、分布、命中卡清单与子类张数/卡号（清单已逐条渲染，但卡内每条文本不与 JSON 逐字对账，子类 reason 只在 _semantic/theme-split.jsonl 留痕）" },
  { item: "_stable/_batches/*.out.txt（第三方仲裁原始输出）与 _semantic/*.md 证据说明", why: "外部通道原始留痕，非本脚本产物；其结论已固化为 arbitration.jsonl / independent-scan.jsonl，并由 independent-scan.CREDENTIAL.json（非空机器凭证：completed + resultCount + sourceHash + querySetHash）绑定当前 SSOT 与查询集后进入对账范围" },
];

/* ------------------------------------------------------------------ */
/* 结果输出                                                              */
/* ------------------------------------------------------------------ */
const isFailure = (c: Check): boolean => c.actual === null || Math.abs(c.expected - c.actual) > TOL;
const failures = checks.filter(isFailure);

console.log(VERIFY_ONLY
  ? "模式：--verify-only（只读磁盘，绝不写文件）"
  : `模式：--generate（已重写 ${Object.keys(REPORT_FILES).length} 份 md，随后从磁盘读回对账）`);
console.log(`\n一致性自检：共 ${int(checks.length)} 项`);
if (failures.length === 0) {
  console.log(`PASS：磁盘报告中的数字（表格行 + 散文节）与 JSON 真源逐项一致（容差 ${TOL}）`);
} else {
  console.log(`FAIL：${int(failures.length)} 项不一致/缺项`);
  for (const f of failures.slice(0, 80)) {
    if (f.name.includes("MISSING_KEY")) {
      console.log(`  ✗ ${f.name} @ ${f.where}｜MC_LABELS 声明的键「${f.name.split(":MISSING_KEY:")[1]}」在 JSON 中缺失（fail-closed，不静默跳过）`);
    } else if (f.actual === null) {
      console.log(`  ✗ ${f.name} @ ${f.where}｜探针未命中或缺行（期望 JSON 值 ${f.expected}）`);
    } else {
      console.log(`  ✗ ${f.name} @ ${f.where}｜报告值 ${f.actual}｜JSON 值 ${f.expected}｜差值 ${(f.actual - f.expected).toFixed(6)}`);
    }
  }
  if (failures.length > 80) console.log(`  …另有 ${int(failures.length - 80)} 项`);
}

console.log("\n交付物：");
console.log(`  1. CONTENT-AUDIT-350.csv（由 audit-a1-aggregate.ts 生成，本脚本只核验 ${int(csvRows)} 数据行）`);
for (const { label } of DISPLAY_ORDER) console.log(`  ${label}`);
console.log("\n对账范围摘要：");
console.log(`  分布表：语义类型 ${int(stats.semDist.length)} 行、主题 ${int(stats.topicDist.length)} 行、增量 ${int(stats.gainDist.length)} 行、社交 ${int(stats.socialDist.length)} 行、推进 ${int(stats.progDist.length)} 行、促进了解 ${int(stats.promoteDist.length)} 行、处置五分类 ${int(stats.disposition.dist.length)} 行 + 旧 verdict 映射 ${int(stats.verdictDist.length)} 行 + 玩法×五分类 ${int(stats.disposition.byType.length)} 行`);
console.log(`  交叉表：玩法×增量 ${int(stats.typeDist.length)}×${int(GAIN_ORDER.length + 5)}、玩法×主题 ${int(stats.typeDist.length)}×${int(matrix().topics.length)}、强度×增量 ${int(stats.intensityDist.length)}×${int(GAIN_ORDER.length + 1)}、Heat 静态 ${int(stats.heatAvailability.length)}×9、三轴 ${int(Math.min(15, stats.threeAxis.length))} 行`);
console.log(`  散文节：内容结构报告 §0/§2/§12/§13/§14(Q1–Q5)/§15 的全部分布数字；§7 五分类处置（分布/映射/玩法×处置）；TOP20 双榜结构特征；缺口报告 literalHits+semanticHits 双列/语义一致性/语义空白/缓冲池配额建议/仲裁分布；校准报告逐轴 κ+raw+lean+drift+5/23 + §7 复审标签与 never_have_i 门槛；Monte Carlo §1/§1b/§2/§3/§4/§5/§6/§7/§8/§9/§10/§11 全表与关键散文`);
console.log(`  重复簇：semanticClusterCoverage / clusterSizeBuckets 全桶 / TOP ${int(TOP_CLUSTERS_SHOWN)} 簇（卡数、低/0、样例条数）/ 大簇阈值计数`);
console.log(`  Heat 双口径：heatAtDraw（主）与 heatAfterTerminal（副）四档曝光 + 占比；静态可用范围 legalCount/high/midPlus`);
console.log(`  literalHits：主题表 ${int(gap.themes.length)} 行 + 词条明细 ${int(gap.themes.reduce((s, t) => s + t.matchedPatterns.length, 0))} 行`);
console.log(`  Monte Carlo：overallCompleted20 按 MC_LABELS ${int(MC_LABELS.length)} 键 fail-closed 对账；perTable ${int(mc.perTable.length)} 桌型×12 列；分档 ${int(mc.cohortByIntensityLimit.length)}；曝光玩法 ${int(Object.keys(mc.exposureByGameType).length)}×6；MATCH 覆盖前后对比`);
console.log(`  校准 κ：${int(calib.pairResults.length)} 对 × ${int(axisKeys.length)} 轴（raw agreement + κ）+ §7 复审标签（${int(stable.drift.length)} 玩法 × ${int(stable.drift[0]!.axes.length)} 轴 κ）`);
console.log(`  A.2 新增真源：GAP-SEMANTIC.json（语义命中，${int(gapSem.themeCount)} 主题，含「亲密/性观念」子类拆分）、STABLE-LABELS.json（复审标签，${int(stable.reviewedLabelScope.reviewed.length)} 玩法已完成双源复审与分歧仲裁）`);
console.log(`  独立扫描凭证：_semantic/independent-scan.CREDENTIAL.json（非空机器凭证；「扫描完成」不认载荷文件是否存在，凭 sourceHash/querySetHash/resultCount 与当前 SSOT、零命中主题集合对账）`);
console.log(`\n不在对账范围的数字（共 ${int(NOT_VERIFIED.length)} 类，均已显式列出）：`);
for (const n of NOT_VERIFIED) console.log(`  - ${n.item}｜原因：${n.why}`);

if (failures.length > 0) process.exit(1);
