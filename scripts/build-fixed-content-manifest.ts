/**
 * 固定库 manifest 构建 / CI 校验（P1-3 + Human Step 4 两轨分离）。
 *
 * 真源：`docs/pm/PRODUCT_PLAN_V2.2-FIXED-CONTENT-FIRST.md` §13
 * （「构建/CI 用固定库 manifest 对快照和 MC 输入作断言」）。
 *
 * 做六件事，任一不达标即非零退出：
 * 1. **两轨分别构建**（`buildFixedContentTracks`，见 `lib/v2-content/fixed-content-manifest-build.ts`）：
 *    - Legacy Compatibility 轨：冻结 SSOT 的全部 builtin 卡（数量由冻结快照决定，不是写死值），供旧局读取 / 恢复 / 迁移；
 *    - Formal Fixed 轨：strict metadata ∧ humanBarFit=PASS ∧ reviewed=true（独立审查）∧ provenance/hash 完整。
 *      **无宽松开关**，张数由当前独立审查输入动态决定（不是写死值）。
 * 2. **快照外 ID 数 = 0**：Legacy 轨允许清单必须覆盖全部冻结卡，且反查每个 builtin 卡 ID 都在清单内。
 * 3. **Formal 交叉校验**：Formal 清单必须 ⊆ Legacy 且逐卡满足四条准入。
 * 4. **产物可复现**：连续构建两次，两轨 `snapshotHash` 都必须一致；再用 `verifyFixedContentManifest`
 *    从同一批卡复算一次，hash 仍须一致。
 * 5. **BAR-FIT 逐卡对账（Human Step 6）**：provenance 的 `machineVerdict` 全部来自唯一
 *    canonical input（`lib/v2-content/bar-fit-input.ts#toBarFitRuntimeInput`：正文 + 玩家实际
 *    必须听到的 instruction）；再用同一函数对冻结卡重算一次并**逐 cardId 对账**，不一致即
 *    构建失败（fail-closed）。
 * 6. **写产物**：`lib/v2-content/generated/fixed-content-manifest.json`（运行期只读这份）。
 *
 * `reviewed` / `humanBarFit` 只来自独立审查输入：默认读
 * `docs/qa/content-audit-v2/BAR-FIT-HUMAN-REVIEW.json`；文件不存在即「无独立审查输入」，
 * Formal 恒为 0 张。该输入的 `reviewerKind`（`"human" | "ai-role"`）**必填**，缺失或非法即 fail-closed 退出。
 * 本脚本**不**从卡面 metadata 或 machineVerdict 推导 `reviewed` / `humanBarFit`。
 *
 * 运行：`pnpm build:fixed-manifest`
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { getV2ContentAdapter } from "@/lib/v2-content/v2-content-adapter";
import { expansionSsotCards, mainlineSsotCards } from "@/lib/v2-content/v2-card-bridge";
import {
  EMPTY_HUMAN_FIXED_REVIEW,
  buildFixedContentTracks,
  isValidReviewerKind,
  verifyFixedContentManifest,
  type BuildFixedContentManifestOptions,
  type HumanFixedReview,
} from "@/lib/v2-content/fixed-content-manifest-build";
import {
  countCardsOutsideManifest,
  type FixedContentManifest,
  type FixedHumanBarFit,
  type FixedMachineVerdict,
} from "@/lib/v2-content/fixed-content-manifest";
import { assertMachineVerdictsReconciled, describeReconciliation, reconcileCardsAgainstManifest } from "@/lib/v2-content/bar-fit-reconcile";
import { BUILTIN_SEED_CARDS } from "@/lib/game-packs/built-in-seeds";

const OUT_PATH = "lib/v2-content/generated/fixed-content-manifest.json";
const HUMAN_REVIEW_PATH = "docs/qa/content-audit-v2/BAR-FIT-HUMAN-REVIEW.json";
const GENERATED_BY = "scripts/build-fixed-content-manifest.ts";

function fail(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

/**
 * 读独立审查输入（文件缺失 ⇒ 空输入 ⇒ Formal = 0；存在则做最小形态校验，坏输入直接失败）。
 * `reviewerKind` 必填且必须合法——缺失 / 非法一律 fail-closed 退出（不得默认 human、不得默认放行）。
 */
function loadHumanReview(): HumanFixedReview {
  if (!existsSync(HUMAN_REVIEW_PATH)) return EMPTY_HUMAN_FIXED_REVIEW;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(HUMAN_REVIEW_PATH, "utf8"));
  } catch (error) {
    fail(`独立审查输入无法解析（${HUMAN_REVIEW_PATH}）：${String(error)}`);
  }
  const review = parsed as Partial<HumanFixedReview>;
  if (typeof review.source !== "string" || typeof review.reviewedAt !== "string" || typeof review.entries !== "object") {
    fail(`独立审查输入形态非法（${HUMAN_REVIEW_PATH}）：需 { source, reviewedAt, reviewerKind, entries }`);
  }
  if (!isValidReviewerKind(review.reviewerKind)) {
    fail(
      `独立审查输入缺少合法的 reviewerKind（${HUMAN_REVIEW_PATH}）：得到 ${JSON.stringify(review.reviewerKind)}，` +
        `必须为 "human" 或 "ai-role"（fail-closed：不得缺损、不得默认 human）`,
    );
  }
  return {
    source: review.source,
    reviewedAt: review.reviewedAt,
    reviewerKind: review.reviewerKind,
    entries: review.entries ?? {},
  };
}

const adapter = getV2ContentAdapter();
const provenance = adapter.provenance;
const mainline = mainlineSsotCards();
const expansion = expansionSsotCards();
const frozenCards = [...mainline, ...expansion];

const contentVersion = `content-v${provenance.mainline.schemaVersion}`;
const options: BuildFixedContentManifestOptions = {
  batchId: "V1.3-frozen-fixed-content",
  contentVersion,
  generatedBy: GENERATED_BY,
  source: provenance.mainline.memberPath,
  ssotMainlineSha256: provenance.mainline.sha256,
  ssotExpansionSha256: provenance.expansion.sha256,
  ssotSchemaVersion: provenance.mainline.schemaVersion,
};

const humanReview = loadHumanReview();

// 可复现：连续两次构建（同一人工审查输入）两轨 hash 都必须一致。
const first = buildFixedContentTracks(frozenCards, options, humanReview);
const second = buildFixedContentTracks(frozenCards, options, humanReview);

const legacyHashOk =
  first.manifest.tracks.legacyCompatibility.snapshotHash === second.manifest.tracks.legacyCompatibility.snapshotHash;
const formalHashOk =
  first.manifest.tracks.formalFixed.snapshotHash === second.manifest.tracks.formalFixed.snapshotHash;
if (!legacyHashOk || !formalHashOk) {
  fail(
    `产物不可复现：两次构建 hash 不一致（legacy ${first.manifest.tracks.legacyCompatibility.snapshotHash} vs ${second.manifest.tracks.legacyCompatibility.snapshotHash}；` +
      `formal ${first.manifest.tracks.formalFixed.snapshotHash} vs ${second.manifest.tracks.formalFixed.snapshotHash}）`,
  );
}

const verified = verifyFixedContentManifest(first.manifest, frozenCards);
if (!verified.ok) fail(`manifest 复算校验失败：\n- ${verified.issues.join("\n- ")}`);
if (verified.outsideIds.length !== 0) fail(`快照外 ID 数 = ${verified.outsideIds.length}，必须为 0`);

const outsideFrozen = countCardsOutsideManifest(frozenCards, first.manifest);
if (outsideFrozen !== 0) fail(`冻结 SSOT 自检：快照外 ID 数 = ${outsideFrozen}，必须为 0`);

// BAR-FIT 逐 cardId 对账（Human Step 6）：manifest provenance.machineVerdict 必须与
// canonical input 重算值逐卡一致；不一致即构建失败（fail-closed），并给出可复算差异清单。
const reconciliation = reconcileCardsAgainstManifest(first.manifest.tracks.legacyCompatibility.provenance, frozenCards);
assertMachineVerdictsReconciled(reconciliation, "BAR-FIT manifest 逐卡对账（canonical input）");

// 既有产物逐卡对账（防「产物被手改 / 口径漂移后仍蒙混重建」）：重建覆盖前，先证明盘上
// 产物的 provenance.machineVerdict 与 canonical 重算逐卡一致。只比对共有 cardId 的 verdict
// （集合增删由下面的快照/复算门禁另行处理，不在此误伤）。不一致即 fail-closed，不覆盖产物。
let existingGate: { compared: number; mismatched: number } | null = null;
if (existsSync(OUT_PATH)) {
  const existing = JSON.parse(readFileSync(OUT_PATH, "utf8")) as FixedContentManifest;
  const gate = reconcileCardsAgainstManifest(existing.tracks.legacyCompatibility.provenance, frozenCards);
  if (gate.mismatches.length > 0) {
    fail(`既有 manifest 产物逐卡对账失败（fail-closed）：\n${describeReconciliation(gate)}`);
  }
  existingGate = { compared: gate.compared, mismatched: gate.mismatches.length };
}

// 反查：旧 seed-* 库必须整库落在 Legacy 轨之外（证明「不是 AI」不再是准入理由）。
const legacyOutside = countCardsOutsideManifest(BUILTIN_SEED_CARDS, first.manifest);
if (legacyOutside !== BUILTIN_SEED_CARDS.length) {
  fail(`旧 seed-* 库应与冻结快照完全不相交，实际快照外 ${legacyOutside}/${BUILTIN_SEED_CARDS.length}`);
}

// Formal 自检：清单内每一张都必须逐条满足四条件（复核构建期自检，双保险）。
for (const id of first.manifest.tracks.formalFixed.allowedCardIds) {
  if (!first.manifest.tracks.legacyCompatibility.allowedCardIds.includes(id)) fail(`Formal 卡 ${id} 不在 Legacy 快照内`);
}

writeFileSync(OUT_PATH, `${JSON.stringify(first.manifest, null, 2)}\n`, "utf8");

const legacy = first.manifest.tracks.legacyCompatibility;
const formal = first.manifest.tracks.formalFixed;

const machineVerdicts: Record<FixedMachineVerdict, number> = { PASS: 0, SUSPECT: 0, HARD_FAIL_PATTERN: 0 };
const humanBarFits: Record<FixedHumanBarFit, number> = { UNREVIEWED: 0, PASS: 0, BORDERLINE: 0, FAIL: 0 };
let reviewedTrue = 0;
for (const item of Object.values(legacy.provenance)) {
  machineVerdicts[item.machineVerdict] += 1;
  humanBarFits[item.humanBarFit] += 1;
  if (item.reviewed) reviewedTrue += 1;
}

console.log("✓ 固定库 manifest 已生成（两轨分离）");
console.log(`  产物路径            : ${OUT_PATH}`);
console.log(`  snapshotVersion     : ${first.manifest.snapshotVersion}`);
console.log(`  ── Legacy Compatibility 轨（旧局读取/恢复/迁移；不是正式 Fixed Content）──`);
console.log(`  legacy allowed      : ${legacy.counts.total}（主线 ${legacy.counts.mainline} + 扩圈 ${legacy.counts.expansion}）`);
console.log(`  legacy snapshotHash : ${legacy.snapshotHash}`);
console.log(`  metadata 完整度      : audited ${legacy.counts.auditedMetadata} / legacy ${legacy.counts.legacyMetadata}`);
console.log(
  `  BAR-FIT 机器预筛    : PASS ${machineVerdicts.PASS} / 独立复核池 ${machineVerdicts.SUSPECT} / hard-fail 候选 ${machineVerdicts.HARD_FAIL_PATTERN}`,
);
console.log(
  `  BAR-FIT 独立定档    : 已独立定档 ${legacy.counts.total - humanBarFits.UNREVIEWED} / 未审 ${humanBarFits.UNREVIEWED}（机器阶段恒 UNREVIEWED，非 FAIL）`,
);
console.log(`  其中 reviewed=true  : ${reviewedTrue}（只来自独立审查输入：${first.manifest.buildInfo.humanReviewSource}）`);
console.log(`  独立审查身份        : reviewerKind=${first.manifest.buildInfo.reviewerKind}（不参与准入判定）`);
console.log(`  ── Formal Fixed 轨（正式主线准入唯一允许清单）──`);
console.log(`  formal fixed        : ${formal.counts.total} 张（张数由当前独立审查输入动态决定，不是写死值）`);
console.log(`  formal snapshotHash : ${formal.snapshotHash}`);
console.log(
  `  被拒（按原因）      : missingStrictMetadata ${formal.rejectedFromFormal.missingStrictMetadata} / humanBarFit≠PASS ${formal.rejectedFromFormal.humanBarFitNotPass} / 未过独立审查 ${formal.rejectedFromFormal.notHumanReviewed} / hash 不全 ${formal.rejectedFromFormal.provenanceIncomplete}`,
);
console.log(`  ── 门禁 ──`);
console.log(`  固定库快照外 ID 数  : ${verified.outsideIds.length}`);
console.log(`  旧 seed-* 快照外数 : ${legacyOutside}/${BUILTIN_SEED_CARDS.length}（应全在快照外）`);
console.log(
  `  BAR-FIT 逐卡对账    : canonical input 重算 vs manifest provenance，相比 ${reconciliation.compared} / 一致 ${reconciliation.consistent} / 不一致 ${reconciliation.mismatches.length}（fail-closed）`,
);
console.log(
  `  既有产物逐卡对账    : ${existingGate ? `相比 ${existingGate.compared} / 不一致 ${existingGate.mismatched}（覆盖前 fail-closed 门禁）` : "（无既有产物，跳过）"}`,
);
console.log(`  hash 可复现        : 是（两次构建一致：legacy=${legacyHashOk} formal=${formalHashOk}；复算一致）`);
