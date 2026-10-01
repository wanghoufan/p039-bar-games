/**
 * FixedContentManifest｜两轨分离（Human Step 4）。
 *
 * 真源要求：`docs/pm/PRODUCT_PLAN_V2.2-FIXED-CONTENT-FIRST.md` §13
 * ——「正式 session 的快照创建、离线恢复、Router 候选装载和每轮发卡均校验可追溯来源为
 * 已冻结固定库且 ID 属于同一快照；未知来源、AI 来源或混合旧缓存一律拒绝进入正式主线，
 * 不静默回退为中性卡。构建/CI 用固定库 manifest 对快照和 MC 输入作断言。」
 *
 * ## 本单（B3-11 / Human Step 4）的核心：两轨必须在代码与产物结构上真正分开
 *
 * | 轨 | 内容 | 用途 | 准入 |
 * |---|---|---|---|
 * | **Legacy Compatibility**（`tracks.legacyCompatibility`） | 冻结快照的全部 builtin 卡（数量由冻结快照决定，**不是写死值**） | **只**用于旧局读取 / 恢复 / 迁移 | 可缺 Plan §3 新 metadata；**明确不是正式 Fixed Content** |
 * | **Formal Fixed**（`tracks.formalFixed`） | 同时满足严格准入的卡（数量由**当前独立审查输入**与 strict admission 动态决定，**不是写死值**） | 正式主线准入唯一允许清单 | strict metadata 全字段 ∧ `humanBarFit=PASS` ∧ `reviewed=true`（独立审查；reviewer 身份见 `buildInfo.reviewerKind`）∧ provenance/hash 完整 |
 *
 * Human Step 4 冻结原文（**历史冻结时状态，原样保留**）：**「正式 manifest 当前可以是 0 张。不要为了
 * 数字好看，把 390 张未审旧题伪装成正式固定库。删除 formal admission 里那个「旧冻结直通」
 * 折让开关的语义。`formal fixed cards = 0` 是正确状态。同时修：`reviewed=true` 必须表示真实
 * 人工审查完成，不能只因为 metadata 字段齐全就设 true。」**
 * —— 这段冻结的是**口径**（不许放宽准入、不许把未审旧题伪装成 Formal），**不是永久数量**：
 * Formal 张数由当前独立审查输入动态决定；**当前值见产物**
 * `lib/v2-content/generated/fixed-content-manifest.json` 的 `tracks.formalFixed.counts.total`。
 *
 * 因此本模块**没有任何宽松开关**：`formalFixedIdSet` 只认四条件齐全（见 `satisfiesFormalAdmission`），
 * 未审内容、机器预筛结论、以及「只补齐了 metadata 字段」的卡一律不入 Formal。
 *
 * ## 准入是正向允许清单（不是「非 AI 即放行」）
 * 上一版只有 `card.source !== "ai"` 一条否定式判定（`lib/ai/mainline-flag.ts`），
 * 于是「不是 AI」＝「可以进正式主线」，`custom`、旧 `seed-*`、任何未知 builtin ID 都能蒙混过关。
 * 本模块把口径翻成正向允许清单：
 *
 * | 卡 | 分类 | 正式固定主线放行？ |
 * |---|---|---|
 * | `source === "builtin"` 且 ID ∈ 当前冻结快照 | `fixed` | ✅ 放行（Legacy Compatibility 轨） |
 * | `source === "custom"` | `custom` | ✅ 放行（Host 主动导入的私人内容，见下） |
 * | `source === "ai"` | `ai` | ❌ 隔离（除非 `AI_MAINLINE_ENABLED=true`） |
 * | `source === "builtin"` 但 ID ∉ 当前冻结快照 | `alien` | ❌ 快照外 ID，拒入正式主线 |
 *
 * > **`source` 的真实枚举**（`lib/domain/schemas.ts:78`）只有 `"builtin" | "ai" | "custom"`，
 * > **没有** `"fixed"` 这个取值。「固定库」在数据上就是 `source === "builtin"` 的那一支，
 * > 由本 manifest 的 `allowedCardIds` 进一步收窄到「当前这一批已冻结快照」。
 *
 * ## custom 包策略（本单的判断，理由随代码留档）
 * 自定义包是**主持人主动导入的私人内容**，走的是与「正式固定题库主线」并列的第二条路：
 * - 它不假装自己是固定库内容：`source === "custom"`，**永远不进 `allowedCardIds`**，
 *   因此不会被任何「固定库快照」统计、CI 断言或 MC 样本计入；
 * - 但它也不是「未知来源」：来源是 Host 明确导入的包，可追溯到 `customGamePack` 记录，
 *   所以**不按 `alien` 拒绝**，否则等于把自定义包功能整体打死（`custom-pack.spec.ts` /
 *   `custom-pack-regression.spec.ts` / `tests/unit/custom-pack-snapshot.test.ts` 都要求它活着）。
 * - 结论：放行 `custom`，但它**不改变「本局是固定库主线」这一事实之外的任何东西**，
 *   也不参与固定库 manifest hash。
 *
 * ## 本模块的零依赖约束
 * 运行期（浏览器 + 服务端）会 import 本模块，因此这里**不 import `node:crypto`、不 import 业务层**。
 * `snapshotHash` 与逐卡 `payloadHash` 由构建期脚本用真实 SHA-256 算好后写进
 * `./generated/fixed-content-manifest.json`（见 `fixed-content-manifest-build.ts` 与
 * `scripts/build-fixed-content-manifest.ts`）；运行期只读这份已冻结产物。
 */

import type { GameCard } from "@/lib/domain/schemas";
import generatedManifest from "./generated/fixed-content-manifest.json";

/**
 * 机器 BAR-FIT 预筛结论（与 `lib/v2-content/bar-fit.ts` 的 `MachineVerdict` 同字面量）。
 * **不是**正式判据：只表示「机器怎么分流」。
 */
export type FixedMachineVerdict = "PASS" | "SUSPECT" | "HARD_FAIL_PATTERN";

/**
 * 独立审查的 BAR-FIT 定档（与 `lib/v2-content/bar-fit.ts` 的 `HumanBarFit` 同字面量）。
 * 正式值只由独立审查写入；机器阶段恒为 `UNREVIEWED`。
 *
 * ⚠️ **`humanBarFit` 为历史兼容字段名，不代表 reviewer 必然是 Human**（字段名本轮不做全仓 rename）：
 * reviewer 的真实身份见 `FixedContentManifest.buildInfo.reviewerKind`（`"human" | "ai-role"`）。
 */
export type FixedHumanBarFit = "UNREVIEWED" | "PASS" | "BORDERLINE" | "FAIL";

/**
 * 独立 reviewer 的身份类别（Change C 语义冻结）。**定义在运行期模块**，由构建期
 * `fixed-content-manifest-build.ts` 再导出，供构建器与产物共同使用。
 *
 * - `human`：真人 reviewer 逐卡审查；
 * - `ai-role`：AI 审查角色（如 product-reviewer / Research Reviewer）。
 *
 * `reviewed=true` 只表示「**有一个独立 reviewer 已逐卡审查并给出明确结论**」，
 * **不再自动等价于「真人已逐卡审查」**；身份由本字段如实表达，AI 角色不得在文案上冒称 Human。
 * 批次级值写入产物 `buildInfo.reviewerKind`（见 `fixed-content-manifest-build.ts`）。
 */
export type ReviewerKind = "human" | "ai-role";

/** 固定库 metadata 完整度：`audited`＝已带 Plan §3 新质量字段并通过 strict；`legacy`＝V1.3 旧冻结（字段未回填）。 */
export type FixedCardMetadataStatus = "legacy" | "audited";

/** 卡在固定库里的归属集合：主线（`mainline`）/ 扩圈（`expansion`）；两者数量由冻结快照决定。 */
export type FixedCardSet = "mainline" | "expansion";

/**
 * 逐卡来源可追溯信息（Plan §3:41「每题用稳定 cardId 关联题面、审计记录与受控快照」）。
 *
 * 只放**逐卡各不相同**的字段：批次 / 内容版本 / 审查阶段 / BAR-FIT 判定来源都是整批同一值，
 * 统一放 `buildInfo`，避免逐卡重复同一串来源字符串把产物撑大（会进客户端包）。
 *
 * BAR-FIT 走**两层口径**（P1-4），本记录两条都留、互不替代：
 * - `machineVerdict`：机器预筛结论（`judgeBarFit` 直出），只做分流，**不是**正式判据；
 * - `humanBarFit`：独立审查后的**正式** BAR-FIT 定档（字段名为历史兼容名，不代表 reviewer 必然是
 *   Human，身份见 `buildInfo.reviewerKind`）；无审查输入时恒为 `UNREVIEWED`——本字段如实记录
 *   「审没审过」，不虚报已审。
 */
export interface FixedCardProvenance {
  cardId: string;
  cardSet: FixedCardSet;
  /**
   * 是否已由**一个独立 reviewer 逐卡审查并给出明确结论**（Change C 语义冻结：
   * `reviewed=true` **不再自动等价于「真人已逐卡审查」**；reviewer 身份见 `buildInfo.reviewerKind`）。
   * **不得**因为 metadata 字段齐全或机器 `machineVerdict` 好看就置 true。
   * 唯一合法来源是构建期注入的独立审查输入（见 `fixed-content-manifest-build.ts` 的 `HumanFixedReview`）。
   */
  reviewed: boolean;
  /** 机器 BAR-FIT 预筛结论；判定来源见 `buildInfo.barFitSource`。 */
  machineVerdict: FixedMachineVerdict;
  /** 独立审查的 BAR-FIT 定档（`humanBarFit` 为历史兼容字段名）；机器预筛阶段恒为 `UNREVIEWED`。 */
  humanBarFit: FixedHumanBarFit;
  /** metadata 完整度（见 `FixedCardMetadataStatus`）。 */
  metadataStatus: FixedCardMetadataStatus;
  /** 逐卡稳定内容 hash（sha256 十六进制），用于快照 hash 可复算。 */
  payloadHash: string;
}

/** 一轨的计数（两轨各一份；供 CI/报告断言）。 */
export interface FixedCardTrackCounts {
  total: number;
  mainline: number;
  expansion: number;
  /** metadata 仍为 V1.3 旧冻结（未回填 Plan §3 新字段）的卡数。 */
  legacyMetadata: number;
  /** 已带 Plan §3 新质量字段的卡数（不代表已过独立审查）。 */
  auditedMetadata: number;
}

/**
 * Legacy Compatibility 轨（Human Step 4 A）：
 * 当前冻结快照的旧卡，**只用于旧局读取 / 恢复 / 迁移**，可缺 Plan §3 新 metadata，
 * **明确不是正式 Fixed Content**。
 */
export interface LegacyCompatibilityTrack {
  track: "legacyCompatibility";
  isFormalFixedContent: false;
  purpose: string;
  /** 该轨的准入口径（与 Formal 的 strict 准入对照阅读）。 */
  admission: "legacy-compatibility";
  /** 该轨整份内容的稳定 hash。 */
  snapshotHash: string;
  /** 该轨允许的卡 ID（升序，稳定）。 */
  allowedCardIds: readonly string[];
  /** 逐卡来源可追溯信息，键为 cardId。 */
  provenance: Readonly<Record<string, FixedCardProvenance>>;
  counts: FixedCardTrackCounts;
}

/** Formal Fixed 轨被拒卡的按原因分布（供报告如实显示「哪些卡为什么没进 Formal」）。 */
export interface FormalRejectionCounts {
  /** 被拒卡总数（= legacy 轨 total − formal 轨 total）。 */
  total: number;
  /** 缺 Plan §3 必填新字段或 strict 不过。 */
  missingStrictMetadata: number;
  /** `humanBarFit !== "PASS"`（含 `UNREVIEWED`）。 */
  humanBarFitNotPass: number;
  /** `reviewed !== true`（未过独立审查）。 */
  notHumanReviewed: number;
  /** provenance / payloadHash 不完整。 */
  provenanceIncomplete: number;
}

/**
 * Formal Fixed 轨（Human Step 4 B）：正式主线准入的**唯一**允许清单。
 *
 * 张数由**当前独立审查输入**与 strict admission 动态决定（不是写死值）：空输入 ⇒ 0 张；
 * 随独立审查结论变化。**不许**为了数字好看补默认 metadata、放宽准入或
 * 直接置 `reviewed=true`（Human Step 4 冻结口径）；当前值见产物 `tracks.formalFixed.counts.total`。
 */
export interface FormalFixedTrack {
  track: "formalFixed";
  isFormalFixedContent: true;
  purpose: string;
  /** 该轨的准入口径：strict，**无任何宽松开关**。 */
  admission: "strict";
  /** 逐条列出的准入条件（与 `FORMAL_FIXED_ADMISSION_REQUIREMENTS` 同源）。 */
  requirements: readonly string[];
  snapshotHash: string;
  allowedCardIds: readonly string[];
  counts: FixedCardTrackCounts;
  /** 本批被 Formal 拒收的卡按原因分布（数量随 Formal 张数动态变化，不是写死值）。 */
  rejectedFromFormal: FormalRejectionCounts;
}

/** 两轨容器（Human Step 4：Legacy Compatibility 与 Formal Fixed 结构上分开）。 */
export interface FixedContentTracks {
  legacyCompatibility: LegacyCompatibilityTrack;
  formalFixed: FormalFixedTrack;
}

/** 固定库 manifest：Legacy Compatibility 与 Formal Fixed 两轨的唯一真源。 */
export interface FixedContentManifest {
  /** 冻结快照版本（`fixed-snapshot@<contentVersion>`）。 */
  snapshotVersion: string;
  /** 两轨（结构与计数各自独立，禁止互相代读）。 */
  tracks: FixedContentTracks;
  /** 构建期口径声明（不参与 snapshotHash 计算）。 */
  buildInfo: {
    generatedBy: string;
    source: string;
    /** 冻结批次 id（「哪批冻结」；整批同一值）。 */
    batchId: string;
    /** 内容版本，取自冻结 SSOT 的 schemaVersion（不另造版本号；整批同一值）。 */
    contentVersion: string;
    /** 未过独立审查时的阶段标记（整批同一值）。 */
    legacyReviewStage: string;
    /** BAR-FIT 判定来源（人读，便于复核）。 */
    barFitSource: string;
    /** `reviewed` 的唯一合法来源：构建期注入的独立审查输入（空输入 ⇒ formal 恒 0）。 */
    humanReviewSource: string;
    /** 独立审查输入日期（`YYYY-MM-DD`；空输入记 `(none)`）。 */
    humanReviewedAt: string;
    /**
     * 本批独立审查的 reviewer 身份（Change C 冻结；批次级记录，逐卡同值；不参与 snapshotHash）。
     * `reviewed=true` 只表示「有一个独立 reviewer 已逐卡审查并给出明确结论」，身份靠本字段如实表达，
     * AI 角色不得在文案上冒称 Human。
     */
    reviewerKind: ReviewerKind;
    /** Formal 准入口径声明（人读）。 */
    formalAdmission: string;
    /** 冻结 SSOT 的 archive sha256（与 `v2-ssot.generated.json` provenance 一致）。 */
    ssotMainlineSha256: string;
    ssotExpansionSha256: string;
    ssotSchemaVersion: string;
  };
}

/**
 * Formal Fixed 准入四条（Human Step 4 冻结；与 `satisfiesFormalAdmission` 逐条对应）。
 * 写进产物供报告/CI 直接引用，避免「口径藏在代码里」。
 */
export const FORMAL_FIXED_ADMISSION_REQUIREMENTS = [
  "strict metadata 全字段通过（Plan §3 必填字段完整、枚举合法、卡面 barFit=PASS）",
  "humanBarFit = PASS（独立审查的 BAR-FIT 定档；字段名为历史兼容名，不代表 reviewer 必然是 Human）",
  "reviewed = true（独立审查完成：有一个独立 reviewer 已逐卡审查并给出明确结论，身份见 buildInfo.reviewerKind；不得由 metadata 齐全或 machineVerdict 推高）",
  "provenance / payloadHash 完整（ID 在快照内且 hash 为 64 位 sha256；无宽松开关）",
] as const;

/** 逐卡 payloadHash 的合法形态（64 位小写十六进制 sha256）。 */
export const FIXED_PAYLOAD_HASH_PATTERN = /^[0-9a-f]{64}$/;

/** 运行期冻结 manifest（构建期产物，见 `lib/v2-content/generated/fixed-content-manifest.json`）。 */
export const FIXED_CONTENT_MANIFEST: FixedContentManifest = generatedManifest as FixedContentManifest;

/** Legacy Compatibility 轨（只读访问器；避免调用方硬编码路径）。 */
export function legacyCompatibilityTrack(
  manifest: FixedContentManifest = FIXED_CONTENT_MANIFEST,
): LegacyCompatibilityTrack {
  return manifest.tracks.legacyCompatibility;
}

/** Formal Fixed 轨（只读访问器；避免调用方硬编码路径）。 */
export function formalFixedTrack(manifest: FixedContentManifest = FIXED_CONTENT_MANIFEST): FormalFixedTrack {
  return manifest.tracks.formalFixed;
}

const memoizedIdSets = new WeakMap<LegacyCompatibilityTrack, ReadonlySet<string>>();

/** **Legacy Compatibility 轨**的允许 ID 集合（O(1) 查询；按轨实例记忆化）。 */
export function fixedManifestIdSet(manifest: FixedContentManifest = FIXED_CONTENT_MANIFEST): ReadonlySet<string> {
  const track = legacyCompatibilityTrack(manifest);
  const cached = memoizedIdSets.get(track);
  if (cached) return cached;
  const set: ReadonlySet<string> = new Set<string>(track.allowedCardIds);
  memoizedIdSets.set(track, set);
  return set;
}

/**
 * 正式主线的卡分类（`lib/domain/schemas.ts:78` 的真实枚举）：
 * - `fixed`：`builtin` 且 ID ∈ 当前冻结快照 —— 正式的固定库内容；
 * - `custom`：Host 主动导入的私人内容（第二条路，不属固定库，也不是未知来源）；
 * - `ai`：AI 生成，正式主线验收期间一律隔离；
 * - `alien`：`builtin` 但 ID ∉ 当前冻结快照 —— 旧 `seed-*`、未知/混合旧缓存；
 *   也被 Plan §13 称为「快照外 ID」。
 */
export type MainlineCardClass = "fixed" | "custom" | "ai" | "alien";

export function classifyMainlineCard(
  card: Pick<GameCard, "id" | "source">,
  manifest: FixedContentManifest = FIXED_CONTENT_MANIFEST,
): MainlineCardClass {
  if (card.source === "ai") return "ai";
  if (card.source === "custom") return "custom";
  if (card.source === "builtin") return fixedManifestIdSet(manifest).has(card.id) ? "fixed" : "alien";
  return "alien";
}

/**
 * 这张卡是否**属于当前冻结固定库**（Plan §13 的正向允许清单：`source ∈ {fixed, builtin}`
 * 在真实枚举下就是 `source === "builtin"` ∧ `cardId ∈ Legacy Compatibility 轨 allowedCardIds`，
 * 且逐卡 provenance 存在——即「同一快照」的来源可追溯）。
 *
 * ⚠️ `custom` 一律为 `false`：它是第二条路，不是固定库内容（`mainlineAllowsCard` 另按
 * 「私人内容轨」放行它）。
 */
export function isFixedMainlineCard(
  card: Pick<GameCard, "id" | "source">,
  manifest: FixedContentManifest = FIXED_CONTENT_MANIFEST,
): boolean {
  if (card.source !== "builtin") return false;
  const provenance = legacyCompatibilityTrack(manifest).provenance[card.id];
  if (!provenance) return false;
  return fixedManifestIdSet(manifest).has(card.id);
}

const memoizedFormalIdSets = new WeakMap<LegacyCompatibilityTrack, ReadonlySet<string>>();

/**
 * **Formal Fixed 轨**的逐卡准入门（Human Step 4 B 四条全中；唯一判定函数，构建期与运行期共用）。
 *
 * 四条缺一即 `false`：`metadataStatus === "audited"` ∧ `reviewed === true` ∧
 * `humanBarFit === "PASS"` ∧ `payloadHash` 为完整 64 位 sha256。
 *
 * 任何一条都不允许被「宽松开关」绕过：本模块不导出、也不接受任何「旧冻结直通」折让参数
 * （该折让开关已按 Human Step 4 从代码与产物中删除，见 Step 4 报告）。
 */
export function satisfiesFormalAdmission(provenance: FixedCardProvenance | undefined): boolean {
  if (!provenance) return false;
  return (
    provenance.metadataStatus === "audited" &&
    provenance.reviewed === true &&
    provenance.humanBarFit === "PASS" &&
    FIXED_PAYLOAD_HASH_PATTERN.test(provenance.payloadHash)
  );
}

/**
 * **正式 Formal Fixed 轨**的卡 ID 集合（Human Step 4 严格口径；按 legacy 轨实例记忆化）。
 *
 * 入集四项**全部**满足：`metadataStatus === "audited"` ∧ `reviewed === true` ∧
 * `humanBarFit === "PASS"` ∧ 逐卡 provenance 存在且 `payloadHash` 完整（ID ∈ 快照内）。
 * 任何一项不满足都不入集 —— 未审内容、机器预筛结论、以及「只补齐了 metadata 字段」的卡
 * 都不算 Formal（Human Step 4 B 口径更新：`reviewed=true` 表示「有一个独立 reviewer 已逐卡审查并给出明确结论」）。
 *
 * 集合大小**完全由当前独立审查输入决定**，不是写死值：空输入（无独立审查）⇒ 集合为空；
 * 第一包入库后随快照的实际 `counts.auditedMetadata` / `reviewed` / `humanBarFit` 取值变化。
 * 当前值见产物 `lib/v2-content/generated/fixed-content-manifest.json` 的
 * `tracks.formalFixed.counts.total`。
 */
export function formalFixedIdSet(
  manifest: FixedContentManifest = FIXED_CONTENT_MANIFEST,
): ReadonlySet<string> {
  const track = legacyCompatibilityTrack(manifest);
  const cached = memoizedFormalIdSets.get(track);
  if (cached) return cached;
  const ids = new Set<string>();
  for (const id of track.allowedCardIds) {
    if (satisfiesFormalAdmission(track.provenance[id])) ids.add(id);
  }
  memoizedFormalIdSets.set(track, ids);
  return ids;
}

/**
 * 这张卡是否属于**正式 Formal Fixed 轨**（严格口径，见 `formalFixedIdSet`）。
 *
 * ⚠️ **禁止与 `classifyMainlineCard` 的 `"fixed"` 混用**：
 * `"fixed"` 只表示「`builtin` 且 ID ∈ 当前冻结快照」，即**在快照内**这层语义；
 * 快照内的卡一律是 `"fixed"`，但**只有过了四条严格准入的才是 Formal**（快照内既有已入
 * Formal 的 audited 卡，也有仍未审的 legacy 卡，具体分布见产物 `tracks.*.counts`）。
 * 把 `"fixed"` 当作 Formal 判据 ⇒ 谓词恒 true ⇒ 豁免完全不生效。
 *
 * ⚠️ **只能从 manifest 读**：SSOT（`v2-ssot.generated.json`）里没有 `metadataStatus` /
 * `reviewed` / `humanBarFit`，从 SSOT 读会静默 fail-open（把未审卡当 Formal）。
 *
 * 用途：Heat 档硬过滤是 Formal Fixed 轨的规则，只有能进入 Formal 轨的卡才受它约束
 * （见 `lib/engine/v2-deal.ts` 的 `heatEligible`）。Legacy / seed / custom / ai 卡
 * 既不被 Heat 档约束，也不推进 Heat / 有效计数（后者由 `v2-reducer.ts` fail-closed 保证）。
 */
export function isFormalFixedCard(
  card: Pick<GameCard, "id" | "source">,
  manifest: FixedContentManifest = FIXED_CONTENT_MANIFEST,
): boolean {
  if (card.source !== "builtin") return false;
  return formalFixedIdSet(manifest).has(card.id);
}

/**
 * 快照外 ID 计数（Plan §13「固定库快照外 ID 数=0」的机器判据）。
 *
 * Human Step 5 末句冻结：**「快照外 ID=0」的统计不能只数 alien builtin**。
 * 旧实现只数 `builtin ∧ ∉ allowedCardIds`，于是 `custom` / `ai` 全都不进分母，
 * 混进正式快照也统计不出来。现在改成「凡是不满足冻结固定库准入（`isFixedMainlineCard`）
 * 的来源一律计入」——builtin 快照外、custom、ai、未知来源一个不落。
 * 既有调用方口径不变：冻结 SSOT 自身仍为 0，旧 seed-* 库仍整库计入。
 */
export function countCardsOutsideManifest(
  cards: readonly Pick<GameCard, "id" | "source">[],
  manifest: FixedContentManifest = FIXED_CONTENT_MANIFEST,
): number {
  return cards.filter((card) => !isFixedMainlineCard(card, manifest)).length;
}

/** 列出快照外 ID（诊断用；CI 报错时能指名道姓）。口径同 `countCardsOutsideManifest`。 */
export function cardsOutsideManifest(
  cards: readonly Pick<GameCard, "id" | "source">[],
  manifest: FixedContentManifest = FIXED_CONTENT_MANIFEST,
): string[] {
  return cards.filter((card) => !isFixedMainlineCard(card, manifest)).map((card) => card.id);
}

/**
 * **正式 Formal Fixed 轨**的越轨计数（Human Step 5：「正式 Fixed session 只能包含当前
 * formal manifest ID」）。与 `countCardsOutsideManifest` 的区别：后者只回答「在不在冻结快照里」，
 * 这里把「在快照内、但未过独立审查的 legacy」也一并算作越轨——正式轨里 legacy / seed /
 * custom / AI / 快照外一个都不许有。
 */
export function countCardsOutsideFormalTrack(
  cards: readonly Pick<GameCard, "id" | "source">[],
  manifest: FixedContentManifest = FIXED_CONTENT_MANIFEST,
): number {
  return cards.filter((card) => !isFormalFixedCard(card, manifest)).length;
}

/**
 * 卡级内容轨（Human Step 5：Formal Fixed / Legacy Compatibility / Custom 三轨必须独立）。
 *
 * 与 `classifyMainlineCard` / `isFormalFixedCard` 同一份 manifest 真源，**不新写第二套判定**：
 * - `formal`：`builtin` ∧ 已在正式 Formal 轨（见 `formalFixedIdSet`，集合大小由独立审查输入决定）；
 * - `snapshot`：`builtin` ∧ ID ∈ Legacy Compatibility 轨（即当前冻结快照内的 builtin 卡，
 *   数量由冻结快照决定；它们「在快照内」但不等于 Formal——这两个概念不能混）；
 * - `seed`：`builtin` ∧ ID ∉ 当前冻结快照（旧 `seed-*` / 未知 / 混合旧缓存）；
 * - `custom` / `ai`：`source` 直接决定。
 */
export type ContentTrack = "formal" | "snapshot" | "seed" | "custom" | "ai";

export function cardContentTrack(
  card: Pick<GameCard, "id" | "source">,
  manifest: FixedContentManifest = FIXED_CONTENT_MANIFEST,
): ContentTrack {
  if (card.source === "ai") return "ai";
  if (card.source === "custom") return "custom";
  if (card.source === "builtin") {
    if (isFormalFixedCard(card, manifest)) return "formal";
    return isFixedMainlineCard(card, manifest) ? "snapshot" : "seed";
  }
  return "seed"; // 未知来源按「快照外」保守处理（与 classifyMainlineCard 的 alien 同口径）
}

/**
 * **跨轨补卡闸**（Human Step 5）：这张候选卡能否补进「当前这一局」。
 *
 * 派生判定，不新增 Session 顶层轨字段（B3-1 §2.1：字段会与真实牌堆脱钩，派生永远一致）。
 * 四档口径，逐条对应 Human Step 5 的冻结句：
 * ① 局内已有 Formal 卡 ⇒ 本局是正式 Fixed session ⇒ **只收 Formal**；
 *    快照内 legacy / seed / custom / AI / 快照外全部拒绝。
 * ② 反之，非 Formal 卡也不得升进 Formal 轨（legacy 轨不得注入 Formal 卡）。
 * ③ 纯旧 seed 局（builtin 卡全在快照外，且不掺 custom/AI）⇒ **始终 legacy-only**：
 *    旧 seed session 不得因 `ensurePackPlayable` / `switchPack` / `spin-chain refill`
 *    偷偷补进 PN-*；要么整局继续 legacy，要么走明确的一次性迁移 / 新开 fixed session。
 * ④ 其余：**候选必须与牌堆里已有的轨同轨**（B3-14 收紧）。空牌堆没有已定轨，才按默认快照轨补给。
 *
 * ## ④ 为什么要收紧（B3-14，Human Step 5「Custom 走独立 custom mode / track，不能与正式 snapshot 混装」）
 * 上一版末尾带 `|| candidateTrack === "snapshot"`，等于「快照内旧题对任何牌堆都是默认补位」，
 * 于是 **custom-only / AI-only 的牌堆也会被塞进 PN-* 快照卡**——这正是 Human 禁止的混装方向
 * （旧口径只堵住了 seed→PN-* 与 formal↔其余两个方向）。收紧后：custom/AI 牌堆只收同轨卡。
 * 不受影响、必须保持的既有行为：
 * - 空牌堆（转瓶子建局）仍按默认快照轨补 PN-*（`deckTracks.size === 0` 分支）；
 * - 快照轨牌堆仍补 PN-*（`deckTracks.has("snapshot")`）；
 * - custom + snapshot 的**混装牌堆**（既有「第二条路」）两轨都仍可各自续补，不被这条闸打死；
 * - AI 断网回退本地 seed 走的是 `buildPlayableDeck`（整局建堆），完全不经过本闸。
 */
export function refillAllowsCard(
  deck: readonly Pick<GameCard, "id" | "source">[],
  candidate: Pick<GameCard, "id" | "source">,
  manifest: FixedContentManifest = FIXED_CONTENT_MANIFEST,
): boolean {
  const candidateTrack = cardContentTrack(candidate, manifest);
  const deckTracks = new Set(deck.map((card) => cardContentTrack(card, manifest)));
  if (deckTracks.has("formal")) return candidateTrack === "formal"; // ①
  if (candidateTrack === "formal") return false; // ②
  const seedOnly = deckTracks.has("seed") && !deckTracks.has("snapshot") && !deckTracks.has("custom") && !deckTracks.has("ai");
  if (seedOnly) return candidateTrack === "seed"; // ③
  if (deckTracks.size === 0) return true; // ④ 空牌堆：未定轨，按默认快照轨补给
  return deckTracks.has(candidateTrack); // ④ 同轨才放行（custom/AI 牌堆不再收 snapshot 卡）
}

/** 只保留「当前冻结固定库」的卡（新牌堆的固定库池唯一入口）。 */
export function fixedContentCards<T extends Pick<GameCard, "id" | "source">>(
  cards: readonly T[],
  manifest: FixedContentManifest = FIXED_CONTENT_MANIFEST,
): T[] {
  return cards.filter((card) => isFixedMainlineCard(card, manifest));
}
