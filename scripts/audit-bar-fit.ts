/**
 * BAR-FIT 旧题审查（只读）— canonical 输入 + 逐卡对账 + forensic 标记（Human Step 6）
 *
 * 真源（两套口径共用同一 canonical 判定，不各拼字符串）：
 * - **冻结 SSOT 快照 390**（主线 350 + 扩圈 40）：`v2-content-adapter` 真源，历史冻结口径，
 *   产物集 `sets.frozenFixed390`（单测与 `reconciliation` 以它为准）；
 * - **冻结固定库全量**（SSOT 390 + 第一包正式内容 `PN-TRUTH-201~224` + R2 Truth H1 Bootstrap
 *   候选 `PN-TRUTH-225~231`）：`v2-card-bridge.mainlineSsotCards()` + `expansionSsotCards()`
 *   运行期唯一出口，当前 manifest 口径，产物集 `sets.frozenFixed414`（`reconciliation414` 以它为准）。
 *   ⚠️ `frozenFixed414` 只是**稳定集标识**（原 414 口径的历史键名），**不是数量**：
 *   该集的 `cardCount` / `label` 一律由冻结内容动态推导（当前见产物 `sets.frozenFixed414.cardCount`）。
 * - 内置种子 350：`lib/game-packs/built-in-seeds/index.ts` → BUILTIN_SEED_CARDS（seed-*）。
 * 计数一律由真源推导，不写死。
 *
 * ## Step 6 冻结口径（本产物的核心）
 * 唯一 canonical input = `lib/v2-content/bar-fit-input.ts#toBarFitRuntimeInput`：
 * **正文 + 玩家实际必须听到的 instruction 都计入**。本脚本与 manifest / CI / Human export 共用它，
 * 不各自拼字符串。
 *
 * 逐卡对账：manifest 产物 `tracks.legacyCompatibility.provenance[cardId].machineVerdict`
 * 与 audit 侧 canonical 重算值必须逐 cardId 一致，不一致即**非零退出**（fail-closed）。
 *
 * text-only（只扫正文、不含 instruction）只作 **forensic** 历史对照，产物带 `forensic: true`
 * 且 `admissionEligible: false`，**不参与 admission**（Step 6 原文）。
 *
 * 本脚本只读、只判定、只出审查产物：不改题面、不删题、不写 SSOT。
 * 判定逻辑全部来自 `lib/v2-content/bar-fit.ts`；脚本本身不含任何判定规则。
 *
 * 输出：
 * - `docs/qa/content-audit-v2/BAR-FIT-AUDIT.json`（机器可读，逐卡两字段 + 对账 + 口径标记）
 * - `docs/qa/content-audit-v2/BAR-FIT-AUDIT.md`（人读摘要，即 Human review export）
 *
 * 运行：`npx vite-node -c vitest.config.ts scripts/audit-bar-fit.ts`
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { BUILTIN_SEED_CARDS } from "@/lib/game-packs/built-in-seeds";
import { expansionSsotCards, mainlineSsotCards } from "@/lib/v2-content/v2-card-bridge";
import { getV2ContentAdapter } from "@/lib/v2-content/v2-content-adapter";
import {
  BAR_FIT_INPUT_CALIBER,
  BAR_FIT_INPUT_IMPLEMENTATION,
  toBarFitRuntimeInput,
  toBarFitTextOnlyForensicInput,
  type BarFitInputSource,
} from "@/lib/v2-content/bar-fit-input";
import {
  BAR_FIT_RULES,
  BAR_FIT_THRESHOLDS,
  judgeBarFit,
  type HumanBarFit,
  type MachineVerdict,
} from "@/lib/v2-content/bar-fit";
import {
  CANONICAL_SCAN_CALIBER,
  assertMachineVerdictsReconciled,
  mayEnterAdmission,
  reconcileCardsAgainstManifest,
  textOnlyForensicCaliber,
  type BarFitScanCaliber,
} from "@/lib/v2-content/bar-fit-reconcile";

const ROOT = process.cwd();
const OUT_DIR = `${ROOT}/docs/qa/content-audit-v2`;
const MANIFEST_PATH = `${ROOT}/lib/v2-content/generated/fixed-content-manifest.json`;
const BASELINE = "DEV_BASELINE=PRODUCT_PLAN_V2.2-FIXED-CONTENT-FIRST";
const ENUM_SOURCE = "docs/pm/PRODUCT_PLAN_V2.2-FIXED-CONTENT-FIRST.md §3";

const MACHINE_VERDICTS: MachineVerdict[] = ["PASS", "SUSPECT", "HARD_FAIL_PATTERN"];
const HUMAN_BAR_FITS: HumanBarFit[] = ["UNREVIEWED", "PASS", "BORDERLINE", "FAIL"];

const FORENSIC_REASON = "text-only 历史对照（不含 instruction）；Step 6：不参与 admission";

interface AuditRow {
  cardId: string;
  gameType: string;
  excerpt: string;
  /** 机器预筛结论（只分流，不是正式判据）。 */
  machineVerdict: MachineVerdict;
  /** 人工 BAR-FIT 定档（本批无人工审查，恒 UNREVIEWED）。 */
  humanBarFit: HumanBarFit;
  /** 命中 HF-*（hard-fail 候选）的规则 ID。 */
  hardFailPatternHits: string[];
  /** 命中 BR-* / CF-*（人工复核池）的规则 ID。 */
  suspectHits: string[];
  ruleHits: string[];
  reasons: string[];
  metrics: { charCount: number; readSeconds: number; startActions: number; instructionCharCount: number };
  /** 本行是否由 canonical input（含 instruction）判定。 */
  includesInstruction: boolean;
}

interface AuditSet {
  label: string;
  source: string;
  /** 本次扫描口径（含 instruction / forensic / 可否 admission）。 */
  caliber: BarFitScanCaliber;
  /** 冗余快照：是否 forensic（= caliber.forensic）。 */
  forensic: boolean;
  /** 冗余快照：是否可进入正式 admission（= caliber.admissionEligible）。 */
  admissionEligible: boolean;
  cardCount: number;
  machineVerdictDistribution: Record<MachineVerdict, number>;
  humanBarFitDistribution: Record<HumanBarFit, number>;
  /** hard-fail 候选数 = machineVerdict === "HARD_FAIL_PATTERN"。 */
  hardFailCandidateCount: number;
  /** 人工复核池数 = machineVerdict === "SUSPECT"（**不等于**「题目有问题」数）。 */
  reviewPoolCount: number;
  byGameType: Record<string, Record<MachineVerdict, number>>;
  rows: AuditRow[];
}

const excerpt = (text: string, limit = 48): string => (text.length > limit ? `${text.slice(0, limit)}…` : text);

const emptyMachineDistribution = (): Record<MachineVerdict, number> => ({
  PASS: 0,
  SUSPECT: 0,
  HARD_FAIL_PATTERN: 0,
});

const emptyHumanDistribution = (): Record<HumanBarFit, number> => ({
  UNREVIEWED: 0,
  PASS: 0,
  BORDERLINE: 0,
  FAIL: 0,
});

function summarize(label: string, source: string, caliber: BarFitScanCaliber, rows: AuditRow[]): AuditSet {
  const machineVerdictDistribution = emptyMachineDistribution();
  const humanBarFitDistribution = emptyHumanDistribution();
  const byGameType: Record<string, Record<MachineVerdict, number>> = {};
  for (const row of rows) {
    machineVerdictDistribution[row.machineVerdict] += 1;
    humanBarFitDistribution[row.humanBarFit] += 1;
    byGameType[row.gameType] ??= emptyMachineDistribution();
    byGameType[row.gameType][row.machineVerdict] += 1;
  }
  return {
    label,
    source,
    caliber,
    forensic: caliber.forensic,
    admissionEligible: caliber.admissionEligible,
    cardCount: rows.length,
    machineVerdictDistribution,
    humanBarFitDistribution,
    hardFailCandidateCount: machineVerdictDistribution.HARD_FAIL_PATTERN,
    reviewPoolCount: machineVerdictDistribution.SUSPECT,
    byGameType,
    rows,
  };
}

/**
 * 逐卡判定。`mode` 决定输入走 canonical（正文+instruction）还是 forensic（text-only）——
 * 两条路都从 `bar-fit-input.ts` 取输入，脚本不自行拼字符串、不自行决定 instruction。
 */
const toRow = (card: BarFitInputSource, gameType: string, mode: "canonical" | "forensic-text-only"): AuditRow => {
  const input = mode === "canonical" ? toBarFitRuntimeInput(card) : toBarFitTextOnlyForensicInput(card);
  const result = judgeBarFit({ cardId: input.cardId, text: input.text, instruction: input.instruction });
  return {
    cardId: input.cardId,
    gameType,
    excerpt: excerpt(input.text),
    machineVerdict: result.machineVerdict,
    humanBarFit: result.humanBarFit,
    hardFailPatternHits: result.hardFailPatternHits,
    suspectHits: result.suspectHits,
    ruleHits: result.ruleHits,
    reasons: result.reasons,
    metrics: {
      charCount: result.metrics.charCount,
      readSeconds: result.metrics.readSeconds,
      startActions: result.metrics.startActions,
      instructionCharCount: result.metrics.instructionCharCount,
    },
    includesInstruction: mode === "canonical",
  };
};

/* ---------- 冻结 SSOT 快照 390（主线 350 + 扩圈 40；历史冻结口径，测试与 frozenFixed390 对账以它为准） ---------- */
const adapter = getV2ContentAdapter();
const ssotFrozen = [...adapter.mainlineCards, ...adapter.expansionCards];
const ssotLabel = `冻结 SSOT 快照 ${ssotFrozen.length}（主线 ${adapter.mainlineCards.length} + 扩圈 ${adapter.expansionCards.length}）`;
/** 扩圈卡无 `gameType` 字段（`V13ExpansionCard`），按集合标注 `expansion`。 */
const ssotRows: AuditRow[] = [
  ...adapter.mainlineCards.map((card) => toRow(card, card.gameType, "canonical")),
  ...adapter.expansionCards.map((card) => toRow(card, "expansion", "canonical")),
];
/* 同批卡的 text-only forensic 对照（旧口径，仅历史证据）。 */
const ssotForensicRows: AuditRow[] = [
  ...adapter.mainlineCards.map((card) => toRow(card, card.gameType, "forensic-text-only")),
  ...adapter.expansionCards.map((card) => toRow(card, "expansion", "forensic-text-only")),
];

/* ---------- 冻结固定库全量（SSOT 390 + 第一包 24 + R2 Bootstrap 候选 7；当前 manifest 口径） ---------- */
// 集标识 `frozenFixed414` 保持稳定（历史键名，不随张数改名）；张数以 bridgeFrozen.length 动态推导。
const bridgeFrozen = [...mainlineSsotCards(), ...expansionSsotCards()];
const bridgeLabel = `冻结固定库 ${bridgeFrozen.length}（主线 ${mainlineSsotCards().length} + 扩圈 ${expansionSsotCards().length}）`;
const bridgeRows: AuditRow[] = bridgeFrozen.map((card) => toRow(card, card.type, "canonical"));

/* ---------------------- 内置种子（built-in-seeds） ---------------------- */
const seedsLabel = `内置种子 ${BUILTIN_SEED_CARDS.length}（built-in-seeds，非固定库快照内）`;
const seedRows: AuditRow[] = BUILTIN_SEED_CARDS.map((card) => toRow(card, card.type, "canonical"));

const frozen390Set = summarize(
  ssotLabel,
  "lib/v2-content/v2-content-adapter.ts → mainlineCards + expansionCards（冻结 SSOT 真源）",
  CANONICAL_SCAN_CALIBER,
  ssotRows,
);
const frozen414Set = summarize(
  bridgeLabel,
  `lib/v2-content/v2-card-bridge.ts → mainlineSsotCards()（${mainlineSsotCards().length} 张：SSOT 350 + 第一包 24 + R2 Bootstrap 候选 7）+ expansionSsotCards()（${expansionSsotCards().length} 张）`,
  CANONICAL_SCAN_CALIBER,
  bridgeRows,
);
const seedsSet = summarize(
  seedsLabel,
  "lib/game-packs/built-in-seeds/index.ts → BUILTIN_SEED_CARDS",
  {
    ...CANONICAL_SCAN_CALIBER,
    admissionEligible: false,
    reason: "旧 seed-* 库不在冻结固定库快照内（alien/legacy），仅参考，不参与正式 admission",
  },
  seedRows,
);
const forensicCaliber = textOnlyForensicCaliber(FORENSIC_REASON);
const forensicSet = summarize(
  `冻结 SSOT 快照 ${ssotFrozen.length}（text-only forensic 历史对照）`,
  `同上 ${ssotFrozen.length} 张，仅剔除 instruction`,
  forensicCaliber,
  ssotForensicRows,
);

/* ------------------------------ forensic 护栏自检 ------------------------------ */
if (mayEnterAdmission(forensicCaliber)) {
  throw new Error("forensic 护栏失效：text-only 口径被判为可进入 admission");
}
if (!mayEnterAdmission(CANONICAL_SCAN_CALIBER)) {
  throw new Error("canonical 口径未通过 admission 护栏自检");
}

/* ----------------------- 逐 cardId 对账：audit ↔ manifest ----------------------- */
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as {
  tracks: { legacyCompatibility: { provenance: Record<string, { machineVerdict: MachineVerdict }> } };
};
const provenance = manifest.tracks.legacyCompatibility.provenance;

/** 冻结 SSOT 快照 390 的 provenance 投影（只取两侧共有的 cardId，防「第一包 24 张」被误判为集合漂移）。 */
const ssotProvenance = Object.fromEntries(
  Object.entries(provenance).filter(([cardId]) => ssotFrozen.some((card) => card.cardId === cardId)),
) as Record<string, { machineVerdict: MachineVerdict }>;

/** 冻结 SSOT 快照 390 ↔ manifest（历史冻结口径；与 sets.frozenFixed390 同集合）。 */
const reconciliation = reconcileCardsAgainstManifest(ssotProvenance, ssotFrozen);
assertMachineVerdictsReconciled(reconciliation, "BAR-FIT audit↔manifest（冻结 SSOT 390）");

/** 冻结固定库全量 414 ↔ manifest（当前 manifest 口径：SSOT 390 + 第一包 24）。 */
const reconciliation414 = reconcileCardsAgainstManifest(provenance, bridgeFrozen);
assertMachineVerdictsReconciled(reconciliation414, "BAR-FIT audit↔manifest（冻结固定库 414）");

const payload = {
  baseline: BASELINE,
  enumSourceOfTruth: ENUM_SOURCE,
  barFitSource: "docs/pm/PRODUCT_PLAN_V2.2-FIXED-CONTENT-FIRST.md §2",
  judgeModule: "lib/v2-content/bar-fit.ts",
  note:
    "只判定不删除：本批不删任何题、不改任何题面。机器预筛结果需经双人模拟噪声计时复核（Plan §2）。" +
    "产物集键名 `frozenFixed414` 为稳定集标识（原 414 口径的历史键名），**不是张数**——" +
    `该集 cardCount 由冻结内容动态推导（当前 ${bridgeFrozen.length}）；对账口径见 reconciliation / reconciliation414。`,
  canonicalInput: {
    implementation: BAR_FIT_INPUT_IMPLEMENTATION,
    caliber: BAR_FIT_INPUT_CALIBER,
    sharedBy: {
      audit: "scripts/audit-bar-fit.ts",
      manifest: "lib/v2-content/fixed-content-manifest-build.ts（provenance.machineVerdict）",
      ci: "scripts/build-fixed-content-manifest.ts + tests/unit/bar-fit-canonical-input.test.ts",
      humanExport: "本产物 docs/qa/content-audit-v2/BAR-FIT-AUDIT.{json,md}；人工复核输入 BAR-FIT-HUMAN-REVIEW.json 按 cardId 对齐",
    },
  },
  reconciliation: {
    manifestSource: "lib/v2-content/generated/fixed-content-manifest.json → tracks.legacyCompatibility.provenance",
    auditSource: `本脚本 canonical input 重算（冻结 SSOT 快照 ${ssotFrozen.length} 张）`,
    compared: reconciliation.compared,
    consistent: reconciliation.consistent,
    inconsistent: reconciliation.mismatches.length,
    mismatches: reconciliation.mismatches,
    onlyInManifest: reconciliation.onlyInManifest,
    onlyInAudit: reconciliation.onlyInAudit,
    failClosed: true,
    ok: reconciliation.ok,
  },
  /** 冻结固定库全量 414 ↔ manifest（当前 manifest 口径，含第一包 24 张）。 */
  reconciliation414: {
    manifestSource: "lib/v2-content/generated/fixed-content-manifest.json → tracks.legacyCompatibility.provenance",
    auditSource: `本脚本 canonical input 重算（冻结固定库全量 ${bridgeFrozen.length} 张）`,
    compared: reconciliation414.compared,
    consistent: reconciliation414.consistent,
    inconsistent: reconciliation414.mismatches.length,
    mismatches: reconciliation414.mismatches,
    onlyInManifest: reconciliation414.onlyInManifest,
    onlyInAudit: reconciliation414.onlyInAudit,
    failClosed: true,
    ok: reconciliation414.ok,
  },
  forensicGuard: {
    rule: "text-only 扫描结果一律 forensic=true / admissionEligible=false，不参与 admission",
    canonicalAdmissionEligible: mayEnterAdmission(CANONICAL_SCAN_CALIBER),
    textOnlyAdmissionEligible: mayEnterAdmission(forensicCaliber),
    sets: { canonical: "frozenFixed390", canonicalFull: "frozenFixed414", textOnly: "textOnlyForensic" },
  },
  verdictSemantics: {
    machineVerdict: {
      field: "machineVerdict",
      values: MACHINE_VERDICTS,
      writer: "机器（lib/v2-content/bar-fit.ts judgeBarFit，输入来自 bar-fit-input.ts canonical input）",
      meaning:
        "PASS=无机器信号；SUSPECT=有疑似信号（含纯估算 CF-*），只进人工复核池；HARD_FAIL_PATTERN=命中 HF-* 硬失败类型，是 hard-fail 候选。均不是正式判据。",
    },
    humanBarFit: {
      field: "humanBarFit",
      values: HUMAN_BAR_FITS,
      writer: "人工双人模拟噪声计时 / 动作审查",
      meaning: "PASS / BORDERLINE / FAIL 为正式定档；机器预筛阶段恒为 UNREVIEWED。",
    },
    clarification:
      "SUSPECT 只表示「该题进入人工复核池」，**不表示题目有问题**。任何 machineVerdict 都不得直接当正式 FAIL/删除判据。",
  },
  thresholds: BAR_FIT_THRESHOLDS,
  rules: BAR_FIT_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    severity: rule.severity,
    description: rule.description,
  })),
  sets: {
    frozenFixed390: frozen390Set,
    frozenFixed414: frozen414Set,
    builtinSeeds350: seedsSet,
    textOnlyForensic: forensicSet,
  },
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(`${OUT_DIR}/BAR-FIT-AUDIT.json`, `${JSON.stringify(payload, null, 2)}\n`);

/* --------------------------------- MD 摘要 -------------------------------- */
const pct = (value: number, total: number): string => `${((value / total) * 100).toFixed(1)}%`;

const machineDistributionTable = (set: AuditSet): string => {
  const lines = [
    "| 机器结论 | 题数 | 占比 | 说明 |",
    "|---|---:|---:|---|",
    `| PASS | ${set.machineVerdictDistribution.PASS} | ${pct(set.machineVerdictDistribution.PASS, set.cardCount)} | 无任何机器信号 |`,
    `| SUSPECT | ${set.machineVerdictDistribution.SUSPECT} | ${pct(set.machineVerdictDistribution.SUSPECT, set.cardCount)} | **进入人工复核池**（不等于「题目有问题」） |`,
    `| HARD_FAIL_PATTERN | ${set.machineVerdictDistribution.HARD_FAIL_PATTERN} | ${pct(set.machineVerdictDistribution.HARD_FAIL_PATTERN, set.cardCount)} | 命中硬失败类型 → **hard-fail 候选**（待人工定档） |`,
    `| **合计** | **${set.cardCount}** | 100.0% | — |`,
  ];
  return lines.join("\n");
};

const humanDistributionTable = (set: AuditSet): string => {
  const lines = [
    "| 人工定档 | 题数 | 占比 |",
    "|---|---:|---:|",
    ...HUMAN_BAR_FITS.map(
      (level) => `| ${level} | ${set.humanBarFitDistribution[level]} | ${pct(set.humanBarFitDistribution[level], set.cardCount)} |`,
    ),
    `| **合计** | **${set.cardCount}** | 100.0% |`,
  ];
  return lines.join("\n");
};

const gameTypeTable = (set: AuditSet): string => {
  const lines = [
    "| 玩法 | 题数 | PASS | SUSPECT（复核池） | HARD_FAIL_PATTERN（硬失败候选） |",
    "|---|---:|---:|---:|---:|",
  ];
  for (const type of Object.keys(set.byGameType).sort()) {
    const d = set.byGameType[type];
    const total = d.PASS + d.SUSPECT + d.HARD_FAIL_PATTERN;
    lines.push(`| ${type} | ${total} | ${d.PASS} | ${d.SUSPECT} | ${d.HARD_FAIL_PATTERN} |`);
  }
  return lines.join("\n");
};

const rowList = (rows: AuditRow[], hitsOf: (row: AuditRow) => string[], limit: number, emptyText: string): string => {
  const picked = rows.slice(0, limit);
  if (picked.length === 0) return emptyText;
  const lines = ["| # | cardId | 玩法 | 题面摘要 | 命中规则 |", "|---:|---|---|---|---|"];
  picked.forEach((row, index) => {
    lines.push(
      `| ${index + 1} | ${row.cardId} | ${row.gameType} | ${row.excerpt.replace(/\|/g, "／")} | ${hitsOf(row).join(", ")} |`,
    );
  });
  return lines.join("\n");
};

const hardFailCandidates = (set: AuditSet, limit: number): string =>
  rowList(
    set.rows.filter((row) => row.machineVerdict === "HARD_FAIL_PATTERN"),
    (row) => row.hardFailPatternHits,
    limit,
    "（无 hard-fail 候选）",
  );

const reviewPoolSamples = (set: AuditSet, limit: number): string =>
  rowList(
    set.rows.filter((row) => row.machineVerdict === "SUSPECT"),
    (row) => row.suspectHits,
    limit,
    "（无人工复核池条目）",
  );

const ruleTable = (): string => {
  const lines = ["| 规则 ID | 机器分流 | 规则名 | 判据 |", "|---|---|---|---|"];
  for (const rule of BAR_FIT_RULES) lines.push(`| ${rule.id} | ${rule.severity} | ${rule.label} | ${rule.description} |`);
  lines.push("| CF-READ-TIME | SUSPECT | 朗读超时（估算） | 朗读时长估算 > 15s → 只进人工复核池 |");
  lines.push("| CF-READ-TIME-SOFT | SUSPECT | 朗读压线（估算） | 朗读时长估算落在 10–15s → 只进人工复核池 |");
  lines.push("| CF-START-ACTIONS | SUSPECT | 动作数超限（估算） | 开场动作数估算 > 3 → 只进人工复核池 |");
  lines.push("| CF-START-ACTIONS-SOFT | SUSPECT | 动作数压线（估算） | 开场动作数估算 = 3 → 只进人工复核池 |");
  lines.push(`| CF-LONG-INSTRUCTION | SUSPECT | 必需说明超长 | 必需说明 > ${BAR_FIT_THRESHOLDS.LONG_INSTRUCTION_CHARS} 字 → 只进人工复核池 |`);
  return lines.join("\n");
};

const md = `# BAR-FIT 旧题审查（canonical 口径 + 逐卡对账 + forensic 标记）

- 基准：\`${BASELINE}\`
- BAR-FIT 判据真源：\`docs/pm/PRODUCT_PLAN_V2.2-FIXED-CONTENT-FIRST.md\` §2
- 枚举真源（本文件用到的字段值）：同 Plan §3
- **唯一 canonical input**：\`${BAR_FIT_INPUT_IMPLEMENTATION}\`（${BAR_FIT_INPUT_CALIBER}）
- 判定模块：\`lib/v2-content/bar-fit.ts\`（机器预筛；Plan §2 明说机器不能替代双人模拟噪声计时）
- 运行：\`npx vite-node -c vitest.config.ts scripts/audit-bar-fit.ts\`
- **本批不删任何题、不改任何题面**；机器结论仅为分流，最终定档以人工噪声计时为准。

## 零、口径与对账（Step 6，先读这一节）

- canonical input 唯一实现：\`${BAR_FIT_INPUT_IMPLEMENTATION}\`，四类消费方共用：
  audit 本脚本 / manifest \`fixed-content-manifest-build.ts\` / CI \`build-fixed-content-manifest.ts\` + 单测 / Human export 本产物。
- **逐 cardId 对账（fail-closed）**（manifest provenance 与本脚本 canonical 重算）：
  - **冻结固定库全量 ${bridgeFrozen.length} ↔ manifest**：相比 **${reconciliation414.compared}** / 一致 **${reconciliation414.consistent}** / 不一致 **${reconciliation414.mismatches.length}**（当前 manifest 口径，含第一包 24 张）。
  - 冻结 SSOT 快照 ${ssotFrozen.length} ↔ manifest：相比 ${reconciliation.compared} / 一致 ${reconciliation.consistent} / 不一致 ${reconciliation.mismatches.length}（历史冻结口径，\`sets.frozenFixed390\` 同集合）。
- **text-only 只作 forensic**：\`textOnlyForensic\` 集 \`forensic: true\` / \`admissionEligible: false\`，
  **不参与 admission**。

## 一、总览（canonical 口径，分列 hard-fail 候选 / 人工复核池）

| 数据源 | 口径 | forensic | 题数 | PASS | SUSPECT＝复核池 | HARD_FAIL_PATTERN＝候选 |
|---|---|---|--:|---:|---:|---:|
| ${bridgeLabel}（\`PN-*\`） | canonical（正文+instruction） | 否 | ${frozen414Set.cardCount} | ${frozen414Set.machineVerdictDistribution.PASS} | ${frozen414Set.reviewPoolCount} | ${frozen414Set.hardFailCandidateCount} |
| ${ssotLabel}（\`PN-*\`） | canonical，历史冻结口径 | 否 | ${frozen390Set.cardCount} | ${frozen390Set.machineVerdictDistribution.PASS} | ${frozen390Set.reviewPoolCount} | ${frozen390Set.hardFailCandidateCount} |
| ${seedsLabel}（\`seed-*\`） | canonical，非快照内 | 否 | ${seedsSet.cardCount} | ${seedsSet.machineVerdictDistribution.PASS} | ${seedsSet.reviewPoolCount} | ${seedsSet.hardFailCandidateCount} |
| 冻结 SSOT 快照 ${ssotFrozen.length}（text-only） | **forensic，不参与 admission** | **是** | ${forensicSet.cardCount} | ${forensicSet.machineVerdictDistribution.PASS} | ${forensicSet.reviewPoolCount} | ${forensicSet.hardFailCandidateCount} |

> 冻结固定库全量 ${bridgeFrozen.length} 的 canonical 数字是**当前 manifest 口径**（与 manifest 逐卡对账一致）；
> 冻结 SSOT 快照 ${ssotFrozen.length} 为历史冻结口径，两者差集＝第一包正式内容 24 张（\`PN-TRUTH-201~224\`，全部机器 PASS）。
> text-only 行仅历史对照，**作废、不得用于 admission**。

## 二、逐卡对账（audit ↔ manifest）

- manifest 来源：\`lib/v2-content/generated/fixed-content-manifest.json → tracks.legacyCompatibility.provenance\`
- 冻结固定库全量 ${bridgeFrozen.length}：相比 ${reconciliation414.compared} / 一致 ${reconciliation414.consistent} / 不一致 ${reconciliation414.mismatches.length}
  - 仅 manifest 有 ${reconciliation414.onlyInManifest.length} / 仅 audit 有 ${reconciliation414.onlyInAudit.length}
- 冻结 SSOT 快照 ${ssotFrozen.length}：相比 ${reconciliation.compared} / 一致 ${reconciliation.consistent} / 不一致 ${reconciliation.mismatches.length}
  - 仅 manifest 有 ${reconciliation.onlyInManifest.length} / 仅 audit 有 ${reconciliation.onlyInAudit.length}
${reconciliation414.mismatches.length > 0 ? reconciliation414.mismatches.map((m) => `  - \`${m.cardId}\` audit=${m.audit} ≠ manifest=${m.manifest}`).join("\n") : "- 无差异"}

## 三、${bridgeLabel}（canonical，当前 manifest 口径）

来源：\`${frozen414Set.source}\`

### 3.1 机器结论分布

${machineDistributionTable(frozen414Set)}

### 3.2 人工定档分布（本批无人工审查）

${humanDistributionTable(frozen414Set)}

### 3.3 按玩法分布

${gameTypeTable(frozen414Set)}

### 3.4 hard-fail 候选（\`HARD_FAIL_PATTERN\`）全量

${hardFailCandidates(frozen414Set, 50)}

### 3.5 人工复核池前 20 条示例（\`SUSPECT\`）

${reviewPoolSamples(frozen414Set, 20)}

### 3.6 冻结 SSOT 快照 ${ssotFrozen.length}（历史冻结口径，\`PN-*\`）

来源：\`${frozen390Set.source}\`

${machineDistributionTable(frozen390Set)}

## 四、${seedsLabel}（\`seed-*\`，仅参考）

来源：\`${seedsSet.source}\`

### 4.1 机器结论分布

${machineDistributionTable(seedsSet)}

### 4.2 按玩法分布

${gameTypeTable(seedsSet)}

### 4.3 hard-fail 候选（\`HARD_FAIL_PATTERN\`）全量

${hardFailCandidates(seedsSet, 50)}

### 4.4 人工复核池前 20 条示例（\`SUSPECT\`）

${reviewPoolSamples(seedsSet, 20)}

## 五、forensic 历史对照（text-only，**不参与 admission**）

来源：\`${forensicSet.source}\`；口径：\`forensic: true\` / \`admissionEligible: false\`

| 机器结论 | 题数 | 占比 |
|---|---:|---:|
| PASS | ${forensicSet.machineVerdictDistribution.PASS} | ${pct(forensicSet.machineVerdictDistribution.PASS, forensicSet.cardCount)} |
| SUSPECT | ${forensicSet.machineVerdictDistribution.SUSPECT} | ${pct(forensicSet.machineVerdictDistribution.SUSPECT, forensicSet.cardCount)} |
| HARD_FAIL_PATTERN | ${forensicSet.machineVerdictDistribution.HARD_FAIL_PATTERN} | ${pct(forensicSet.machineVerdictDistribution.HARD_FAIL_PATTERN, forensicSet.cardCount)} |

## 六、规则表（按机器分流分列）

${ruleTable()}

## 七、复核提示

- 机器预筛只覆盖词面与长度/动作估算；语义歧义、同义重复、Consent 与尺度审查仍需人工。
- \`SUSPECT\`（含全部 \`CF-*\` 与 \`BR-*\`）只是**人工复核池**，人工复核后可下调或直接判 PASS。
- \`HARD_FAIL_PATTERN\`（\`HF-*\`）是 Plan §2 硬失败类型的 **hard-fail 候选**，按 Plan §2「不做润色改写」——
  **本批只记录候选，不执行删除**，最终由人工定档并写 \`humanBarFit\`。
- 本产物为纯函数 + 固定顺序序列化，**逐字节可复现**（同输入重跑结果完全一致，无时间戳/随机数）。
`;

writeFileSync(`${OUT_DIR}/BAR-FIT-AUDIT.md`, md);

console.log(`canonical input: ${BAR_FIT_INPUT_IMPLEMENTATION}`);
console.log(`frozenFixed390(${frozen390Set.cardCount}) machineVerdict: ${JSON.stringify(frozen390Set.machineVerdictDistribution)}`);
console.log(`frozenFixed414(${frozen414Set.cardCount}) machineVerdict: ${JSON.stringify(frozen414Set.machineVerdictDistribution)}`);
console.log(`  hard-fail 候选 ${frozen414Set.hardFailCandidateCount} / 人工复核池 ${frozen414Set.reviewPoolCount}`);
console.log(`builtinSeeds350(${seedsSet.cardCount}) machineVerdict: ${JSON.stringify(seedsSet.machineVerdictDistribution)}`);
console.log(`  hard-fail 候选 ${seedsSet.hardFailCandidateCount} / 人工复核池 ${seedsSet.reviewPoolCount}`);
console.log(`textOnlyForensic machineVerdict: ${JSON.stringify(forensicSet.machineVerdictDistribution)}（forensic=true，不参与 admission）`);
console.log(
  `对账 audit↔manifest: 全量 414 相比 ${reconciliation414.compared} / 一致 ${reconciliation414.consistent} / 不一致 ${reconciliation414.mismatches.length}；` +
    `SSOT 390 相比 ${reconciliation.compared} / 一致 ${reconciliation.consistent} / 不一致 ${reconciliation.mismatches.length}`,
);
console.log(`written: ${OUT_DIR}/BAR-FIT-AUDIT.json, ${OUT_DIR}/BAR-FIT-AUDIT.md`);
