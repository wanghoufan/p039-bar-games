/**
 * CONTENT-01｜第一包「独立内容审查输入」**空骨架**生成器（C1-4，只读判定产物 + 只写骨架）。
 *
 * ## 只做一件事
 * 产出 `docs/qa/content-audit-v2/BAR-FIT-HUMAN-REVIEW.json`：形态严格满足
 * `HumanFixedReview`（`{ source, reviewedAt, reviewerKind, entries }`，见
 * `lib/v2-content/fixed-content-manifest-build.ts`），`entries` 逐卡给出
 * `{ reviewed, humanBarFit, note }`（`humanBarFit` 为**历史兼容字段名**，不代表 reviewer 必然是 Human）。
 *
 * ## 红线（本脚本的核心约束）
 * **绝不代写审查结论**：本脚本产出的每条 entry 一律
 * `humanBarFit="UNREVIEWED"` / `reviewed=false`。独立定档 `PASS / BORDERLINE / FAIL`
 * 只能由 review 类角色（product-reviewer / code-reviewer）逐卡填写——机器预筛的
 * `machineVerdict` **不是** `humanBarFit`（Human 明令），本脚本只把机器档位写进
 * `note` 供审查者参考，**不写进 `humanBarFit`**。
 *
 * `reviewerKind` 只声明**审查者身份**（`"human" | "ai-role"`），**不等于**已给出逐卡结论：
 * 身份已声明 / 结论待独立 reviewer 填写。默认 `ai-role`（本项目当前审查由 AI 角色执行；
 * Human 决策 1 明确允许 `ai-role + reviewed` 进入开发阶段 Formal）；真人审查重跑时显式传
 * `--reviewer-kind=human`。非法值直接报错退出（fail-closed，见 `assertHumanReviewConsistent`）。
 *
 * 双重保险：
 * 1. 生成时逐条断言 `humanBarFit === "UNREVIEWED" ∧ reviewed === false`，任一不成立即 `exit 1`；
 * 2. 覆盖前若发现磁盘上已有「独立 reviewer 已填」的骨架（任一 entry `humanBarFit !== "UNREVIEWED"`
 *    或 `reviewed === true`），**拒绝覆盖**并 `exit 1`——防止把审查者的真实结论冲掉。
 *
 * ## 数据来源（全只读，不自建第二套判定）
 * - 机器档位：`docs/qa/content-audit-v2/BAR-FIT-AUDIT.json` 的 canonical 集
 *   （`sets.frozenFixed414`，含第一包 24 张；唯一 canonical 口径，`reconciliation414` 逐卡对账 fail-closed）；
 * - 待审卡清单：`lib/v2-content/formal-truth-pack.ts` 的 `FORMAL_TRUTH_CARDS`（第一包 24 张）。
 *
 * 运行：`npx vite-node -c vitest.config.ts scripts/audit-bar-fit-human-review-skeleton.ts`
 * 参数：`--reviewer-kind=<human|ai-role>`（默认 `ai-role`）、`--out=<path>`（默认真实产物路径；
 *        干跑请显式给临时路径，避免覆盖真实审查产物）。未知参数即报错退出。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { FORMAL_TRUTH_CARDS } from "@/lib/v2-content/formal-truth-pack";
import { isValidReviewerKind, type ReviewerKind } from "@/lib/v2-content/fixed-content-manifest-build";

const ROOT = process.cwd();
const AUDIT_PATH = `${ROOT}/docs/qa/content-audit-v2/BAR-FIT-AUDIT.json`;
const DEFAULT_OUT_PATH = `${ROOT}/docs/qa/content-audit-v2/BAR-FIT-HUMAN-REVIEW.json`;
const GENERATED_BY = "scripts/audit-bar-fit-human-review-skeleton.ts";

type MachineVerdict = "PASS" | "SUSPECT" | "HARD_FAIL_PATTERN";
type FixedHumanBarFit = "UNREVIEWED" | "PASS" | "BORDERLINE" | "FAIL";

interface AuditRow {
  cardId: string;
  machineVerdict: MachineVerdict;
}

function fail(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

/* ---------------------------- 命令行参数（fail-closed） ---------------------------- */
/**
 * `--reviewer-kind=<human|ai-role>`：声明审查者身份（写入 `reviewerKind`）。默认 `ai-role`。
 * `--out=<path>`：输出路径（默认真实产物路径；相对路径按仓库根解析）。干跑给临时路径即可，不覆盖真实产物。
 * 未知参数 / 非法身份值一律 `exit 1`（不得默默忽略、不得默认放行）。
 */
const ARGV = process.argv.slice(2);
let outPath = DEFAULT_OUT_PATH;
let reviewerKind: ReviewerKind = "ai-role";
for (const arg of ARGV) {
  if (arg.startsWith("--reviewer-kind=")) {
    const value = arg.slice("--reviewer-kind=".length);
    if (!isValidReviewerKind(value)) {
      fail(`--reviewer-kind 非法：${JSON.stringify(value)}（只接受 "human" | "ai-role"；fail-closed）`);
    }
    reviewerKind = value;
  } else if (arg.startsWith("--out=")) {
    const value = arg.slice("--out=".length);
    if (value.length === 0) fail("--out 不能为空（须给一个输出文件路径）");
    outPath = value.startsWith("/") ? value : `${ROOT}/${value}`;
  } else {
    fail(`未知参数：${arg}（只接受 --reviewer-kind=<human|ai-role> / --out=<path>）`);
  }
}

/* ---------------------------- 读机器档位（只读） ---------------------------- */
if (!existsSync(AUDIT_PATH)) fail(`缺少 canonical 审计产物：${AUDIT_PATH}（先跑 scripts/audit-bar-fit.ts）`);
const audit = JSON.parse(readFileSync(AUDIT_PATH, "utf8")) as {
  sets?: { frozenFixed414?: { cardCount: number; forensic: boolean; admissionEligible: boolean; rows: AuditRow[] } };
};
const canonical = audit.sets?.frozenFixed414;
if (!canonical) fail(`审计产物缺少 canonical 集 sets.frozenFixed414：${AUDIT_PATH}`);
if (canonical.forensic !== false || canonical.admissionEligible !== true) {
  fail("审计产物的 canonical 集口径非法（必须 forensic=false 且 admissionEligible=true）");
}
const verdictById = new Map(canonical.rows.map((row) => [row.cardId, row.machineVerdict]));

/* ---------------------------- 覆盖保护（防冲掉既有审查结论） ---------------------------- */
if (existsSync(outPath)) {
  const existing = JSON.parse(readFileSync(outPath, "utf8")) as {
    entries?: Record<string, { reviewed?: boolean; humanBarFit?: string }>;
  };
  const filled = Object.entries(existing.entries ?? {}).filter(
    ([, entry]) => entry?.humanBarFit !== undefined && entry.humanBarFit !== "UNREVIEWED",
  );
  const reviewedTrue = Object.entries(existing.entries ?? {}).filter(([, entry]) => entry?.reviewed === true);
  if (filled.length > 0 || reviewedTrue.length > 0) {
    fail(
      `已存在独立 reviewer 填写的审查输入（humanBarFit≠UNREVIEWED ${filled.length} 条 / reviewed=true ${reviewedTrue.length} 条），` +
        `拒绝覆盖：${outPath}。如需重生成空骨架，请审查者先另存结论。`,
    );
  }
}

/* ---------------------------- 生成空骨架 ---------------------------- */
const entries: Record<string, { reviewed: boolean; humanBarFit: FixedHumanBarFit; note: string }> = {};
for (const card of FORMAL_TRUTH_CARDS) {
  const machineVerdict = verdictById.get(card.cardId);
  if (!machineVerdict) fail(`canonical 审计产物未覆盖待审卡：${card.cardId}`);
  entries[card.cardId] = {
    reviewed: false,
    humanBarFit: "UNREVIEWED",
    note: `机器档位 ${machineVerdict}（仅机器预筛，非独立定档；SUSPECT 仅表示进入独立复核池）`,
  };
}

/* ---------------------------- 红线自检（任一不成立即失败） ---------------------------- */
// 身份双保险：参数解析已挡非法值，这里再断言一次——`reviewerKind` 必须落到合法枚举，
// 否则重建 manifest 会被 `assertHumanReviewConsistent` fail-closed 抛错（本单要修的就是这个）。
if (!isValidReviewerKind(reviewerKind)) fail(`reviewerKind=${JSON.stringify(reviewerKind)} 非法（只接受 "human" | "ai-role"）`);
for (const [cardId, entry] of Object.entries(entries)) {
  if (entry.humanBarFit !== "UNREVIEWED") fail(`${cardId}: humanBarFit=${entry.humanBarFit} ≠ UNREVIEWED（本脚本不得写审查结论）`);
  if (entry.reviewed !== false) fail(`${cardId}: reviewed=${entry.reviewed} ≠ false（本脚本不得标已审）`);
  // 自洽约束：reviewed === (humanBarFit !== "UNREVIEWED")。
  if (entry.reviewed !== (entry.humanBarFit !== "UNREVIEWED")) fail(`${cardId}: reviewed 与 humanBarFit 不自洽`);
}

const machineVerdictSummary: Record<MachineVerdict | "total", number> = {
  total: FORMAL_TRUTH_CARDS.length,
  PASS: 0,
  SUSPECT: 0,
  HARD_FAIL_PATTERN: 0,
};
for (const entry of Object.values(entries)) {
  const verdict = /机器档位 (\w+)/u.exec(entry.note)?.[1] as MachineVerdict | undefined;
  if (verdict) machineVerdictSummary[verdict] += 1;
}

const payload = {
  source: `(空骨架：reviewerKind=${reviewerKind} 身份已声明；逐卡结论待独立 reviewer 填写)`,
  reviewedAt: "(pending-independent-reviewer)",
  /** 审查者身份：`human`（真人）或 `ai-role`（审查角色）；变更须 Human 批准（C1-1 §6）。 */
  reviewerKind,
  note:
    "本文件为 C1-4 生成的**空骨架**：entries 全部 humanBarFit=UNREVIEWED / reviewed=false，未写任何审查结论。" +
    `reviewerKind=${reviewerKind} 只声明审查者身份，**不等于**已给出逐卡结论。` +
    "独立定档（PASS/BORDERLINE/FAIL）须由 review 类角色（product-reviewer / code-reviewer）逐卡填写，并同步替换 " +
    "source / reviewedAt（审查身份若变化再改 reviewerKind）。机器档位（machineVerdict）只作参考，**不得**当作 humanBarFit。" +
    "注：humanBarFit 为历史兼容字段名，不代表 reviewer 必然是 Human。",
  entries,
  machineVerdictSummary: {
    ...machineVerdictSummary,
    source: "docs/qa/content-audit-v2/BAR-FIT-AUDIT.json#sets.frozenFixed414",
  },
  generatedBy: GENERATED_BY,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

const distribution: Record<FixedHumanBarFit, number> = { UNREVIEWED: 0, PASS: 0, BORDERLINE: 0, FAIL: 0 };
let reviewedTrueTotal = 0;
for (const entry of Object.values(entries)) {
  distribution[entry.humanBarFit] += 1;
  if (entry.reviewed) reviewedTrueTotal += 1;
}
console.log(`✓ 独立内容审查空骨架已生成：${outPath}`);
console.log(`  reviewerKind       : ${reviewerKind}（审查者身份；结论待独立 reviewer 填写）`);
console.log(`  entries            : ${Object.keys(entries).length}（第一包 PN-TRUTH-201~224）`);
console.log(`  humanBarFit 分布    : ${JSON.stringify(distribution)}`);
console.log(`  reviewed=true      : ${reviewedTrueTotal}（必须为 0）`);
console.log(`  机器档位汇总（参考）: ${JSON.stringify(machineVerdictSummary)}`);
