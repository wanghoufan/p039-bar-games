/**
 * BAR-FIT canonical 对账 + forensic 护栏（Human Step 6）。
 *
 * 两件事：
 * 1. **逐 cardId 对账**：manifest 产物里的每张卡 `machineVerdict` 必须与 audit 侧
 *    同口径（canonical input）计算结果**逐卡一致**；任何不一致即 `ok=false`，
 *    由 `assertMachineVerdictsReconciled()` fail-closed 报出可复算差异清单。
 * 2. **forensic 护栏**：text-only（不含 instruction）扫描一律带 `forensic: true` /
 *    `admissionEligible: false`，`mayEnterAdmission()` 对任何 forensic 口径恒 false。
 *
 * 本模块零依赖（不 import node 内置、不 import 业务层），供脚本与测试共用。
 */

import type { BarFitInputSource, CanonicalVerdictRow } from "./bar-fit-input";
import { canonicalVerdicts } from "./bar-fit-input";
import type { MachineVerdict } from "./bar-fit";

/** 单卡对账差异。 */
export interface ReconciliationMismatch {
  cardId: string;
  /** audit 侧 canonical 重算值。 */
  audit: MachineVerdict;
  /** manifest 产物里记录的值。 */
  manifest: MachineVerdict;
}

/** 逐卡对账结果（`ok=false` 即构建必须失败）。 */
export interface ReconciliationResult {
  /** 参与对账的卡数（两侧 cardId 交集）。 */
  compared: number;
  /** 逐卡一致数。 */
  consistent: number;
  /** 逐卡不一致清单（可复算差异）。 */
  mismatches: ReconciliationMismatch[];
  /** 只在 manifest 里、audit 未覆盖的 cardId（排序）。 */
  onlyInManifest: string[];
  /** 只在 audit 里、manifest 未覆盖的 cardId（排序）。 */
  onlyInAudit: string[];
  ok: boolean;
}

/**
 * 逐 cardId 对账：`manifest` provenance 的 machineVerdict 必须与 `audit` 侧 canonical
 * 重算值逐卡一致。仅比对两侧都有的 cardId；仅一侧存在的 cardId 记入
 * `onlyInManifest` / `onlyInAudit`（非空即 `ok=false`，防止集合漂移被静默放过）。
 */
export function reconcileMachineVerdicts(
  manifest: Readonly<Record<string, { machineVerdict: MachineVerdict }>>,
  audit: readonly CanonicalVerdictRow[],
): ReconciliationResult {
  const mismatches: ReconciliationMismatch[] = [];
  let compared = 0;
  let consistent = 0;

  const manifestIds = new Set(Object.keys(manifest));
  const auditIds = new Set(audit.map((row) => row.cardId));

  for (const row of audit) {
    const stored = manifest[row.cardId];
    if (!stored) continue;
    compared += 1;
    if (stored.machineVerdict === row.machineVerdict) {
      consistent += 1;
    } else {
      mismatches.push({ cardId: row.cardId, audit: row.machineVerdict, manifest: stored.machineVerdict });
    }
  }

  const onlyInManifest = [...manifestIds].filter((id) => !auditIds.has(id)).sort();
  const onlyInAudit = [...auditIds].filter((id) => !manifestIds.has(id)).sort();

  return {
    compared,
    consistent,
    mismatches,
    onlyInManifest,
    onlyInAudit,
    ok: mismatches.length === 0 && onlyInManifest.length === 0 && onlyInAudit.length === 0,
  };
}

/** 便捷封装：直接用卡计算 audit 侧 canonical verdict 再对账。 */
export function reconcileCardsAgainstManifest(
  manifest: Readonly<Record<string, { machineVerdict: MachineVerdict }>>,
  cards: readonly BarFitInputSource[],
): ReconciliationResult {
  return reconcileMachineVerdicts(manifest, canonicalVerdicts(cards));
}

/** 把对账结果渲染成可复算的差异清单（脚本报错 / 报告直接引用）。 */
export function describeReconciliation(result: ReconciliationResult): string {
  const lines = [`相比 ${result.compared} 张，一致 ${result.consistent}，不一致 ${result.mismatches.length}`];
  for (const item of result.mismatches) lines.push(`  - ${item.cardId}: audit=${item.audit} ≠ manifest=${item.manifest}`);
  for (const id of result.onlyInManifest) lines.push(`  - ${id}: 只在 manifest，audit 未覆盖`);
  for (const id of result.onlyInAudit) lines.push(`  - ${id}: 只在 audit，manifest 未覆盖`);
  return lines.join("\n");
}

/** 对账不合格即抛错（构建/CI fail-closed 的唯一入口）。 */
export function assertMachineVerdictsReconciled(result: ReconciliationResult, label = "BAR-FIT"): void {
  if (result.ok) return;
  throw new Error(`${label} 逐卡对账失败（fail-closed）：\n${describeReconciliation(result)}`);
}

/* -------------------------------------------------------------------------- */
/* forensic 护栏                                                                */
/* -------------------------------------------------------------------------- */

/** 一次扫描的口径标记。 */
export interface BarFitScanCaliber {
  /** 是否把 instruction 计入（canonical 为 true；text-only 为 false）。 */
  includesInstruction: boolean;
  /** text-only 历史对照路径必须为 true。 */
  forensic: boolean;
  /** 是否可作为正式 admission 数据。canonical=true；text-only=false。 */
  admissionEligible: boolean;
  reason?: string;
}

/** canonical 正式口径：正文 + instruction，可参与 admission。 */
export const CANONICAL_SCAN_CALIBER: BarFitScanCaliber = {
  includesInstruction: true,
  forensic: false,
  admissionEligible: true,
  reason: "Step 6 canonical：正文 + 玩家实际必须听到的 instruction",
};

/** text-only 历史对照口径：**forensic，不参与 admission**。 */
export function textOnlyForensicCaliber(reason: string): BarFitScanCaliber {
  return { includesInstruction: false, forensic: true, admissionEligible: false, reason };
}

/**
 * 该口径能否进入正式 admission。
 * 护栏：**只有**「含 instruction ∧ 非 forensic ∧ admissionEligible=true」才为 true。
 * 任何 text-only 结果（`forensic: true` 或 `admissionEligible: false`）一律 false。
 */
export function mayEnterAdmission(caliber: BarFitScanCaliber): boolean {
  return caliber.forensic === false && caliber.admissionEligible === true && caliber.includesInstruction === true;
}
