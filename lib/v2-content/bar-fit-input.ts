/**
 * BAR-FIT **唯一 canonical input**（Human Step 6）。
 *
 * ## 要解决的问题
 * 整改前同一张卡在两处被喂进不同输入：
 * - `scripts/audit-bar-fit.ts` 对主线 350 只传「题面正文」（`text`）；
 * - `fixed-content-manifest` 的 provenance 走 `v2-card-bridge`，按 Plan §2
 *   「正文与必需说明均计入」把 SSOT `consentMode` 渲染成卡面同意说明后再判定。
 * 于是两侧 `machineVerdict` 口径不同、数字无法逐卡对账。
 *
 * ## Step 6 冻结口径
 * Human：**「正文 + 玩家实际必须听到的 instruction 都计入。」**
 * 本模块是该口径的**唯一实现**：所有正式流程（audit / manifest / CI / Human export）
 * 必须经 `toBarFitRuntimeInput()`（或 `judgeCanonicalBarFit()`）取输入，
 * **不得各自拼字符串**、不得单独传 `text` 或单独传 `instruction`。
 *
 * ## 「玩家实际必须听到的 instruction」的唯一来源
 * 主线/扩圈的必需说明由 SSOT `consentMode` 渲染，唯一映射表是下面的
 * `CONSENT_INSTRUCTION`（`v2-card-bridge.ts` 复用同一份，不再自建第二份）。
 * 运行期 `GameCard.instruction` 与它同源，所以「canonical input」= 玩家真实会看到的
 * （正文, instruction）二元组，与 `v2-card-bridge` 给运行期的卡面完全一致。
 *
 * ## text-only 路径
 * 出于历史对照保留的「只扫正文、不含 instruction」路径**必须**显式标 forensic，
 * 用 `toBarFitTextOnlyForensicInput()` 生成，产物里带 `forensic: true`，
 * 且**不得**进入正式 admission。见 `lib/v2-content/bar-fit-reconcile.ts`。
 *
 * 本模块零业务依赖（不 import registry / adapter / node 内置），可被构建脚本、审计脚本与测试安全引用。
 */

import { judgeBarFit, type BarFitResult, type MachineVerdict } from "./bar-fit";
import type { V13MainlineCard } from "./v2-types";

/**
 * SSOT `consentMode` → 卡面必需说明（同意口径的确定渲染；不含任何新题面内容）。
 *
 * **唯一归属**：运行期 `v2-card-bridge.toMainlineGameCard/toExpansionGameCard` 与本模块的
 * canonical input 都从这里取，保证「玩家必须听到的 instruction」两侧逐字相同。
 */
export const CONSENT_INSTRUCTION: Record<V13MainlineCard["consentMode"], string> = {
  "skip-anytime": "不愿意可无惩罚跳过",
  "mutual-current-consent": "先问出口，双方当场都同意才做；不愿意可无惩罚跳过",
  "private-mutual-only": "仅两人私密互选成功后展示结果，单向不成局、无任何后续；不愿意可无惩罚跳过",
};

/** canonical input 的口径声明（写进产物，供人读与对账）。 */
export const BAR_FIT_INPUT_CALIBER = "正文（题面 text/content） + 玩家实际必须听到的 instruction（consentMode 渲染）";

/** canonical input 的唯一实现位置标识（写进产物，供四类消费方声明共用）。 */
export const BAR_FIT_INPUT_IMPLEMENTATION = "lib/v2-content/bar-fit-input.ts#toBarFitRuntimeInput";

/**
 * canonical input：喂给 `judgeBarFit` 的确定二元组。
 * - `text`：题面正文（SSOT `text` / 运行期 `GameCard.content`）；
 * - `instruction`：玩家实际必须听到的必需说明（consentMode 渲染 / `GameCard.instruction`）。
 */
export interface BarFitCanonicalInput {
  cardId: string;
  text: string;
  instruction: string;
}

/**
 * canonical input 的来源卡，两条路二选一：
 * - 运行期卡（`v2-card-bridge` 产出的 `GameCard`）：`id` + `content` + `instruction`；
 * - SSOT 原始卡：`cardId` + `text` + `consentMode`。
 *
 * 两条路在这里收敛成同一个 `(正文, instruction)`，避免消费者各自决定 instruction 从哪来。
 */
export interface BarFitRuntimeCardShape {
  id: string;
  content: string;
  instruction?: string;
}

export interface BarFitSsotCardShape {
  cardId: string;
  text: string;
  consentMode?: V13MainlineCard["consentMode"];
}

export type BarFitInputSource = BarFitRuntimeCardShape | BarFitSsotCardShape;

/**
 * **唯一 canonical input 实现**：把任意来源卡解析成 `(正文, instruction)`。
 *
 * 解析口径（确定、无分支歧义）：
 * - 运行期卡：`text ← content`，`instruction ← instruction ?? ""`；
 * - SSOT 卡：`text ← text`，`instruction ← consentMode 经 CONSENT_INSTRUCTION 渲染`（缺省空串）。
 *   绝不因消费者选的入口不同而丢 instruction。
 */
export function toBarFitRuntimeInput(card: BarFitInputSource): BarFitCanonicalInput {
  if ("cardId" in card) {
    return {
      cardId: card.cardId,
      text: card.text,
      instruction: card.consentMode ? CONSENT_INSTRUCTION[card.consentMode] : "",
    };
  }
  return { cardId: card.id, text: card.content, instruction: card.instruction ?? "" };
}

/** canonical 判定：先取 canonical input，再交给唯一判定引擎 `judgeBarFit`。 */
export function judgeCanonicalBarFit(card: BarFitInputSource): BarFitResult {
  const input = toBarFitRuntimeInput(card);
  return judgeBarFit({ cardId: input.cardId, text: input.text, instruction: input.instruction });
}

/**
 * canonical input 的稳定指纹（对账/留痕用，不参与 admission）。
 * 同一 canonical input 恒得同一串（`cardId + 正文 + instruction` 的确定拼接）。
 * 不含 hash，保持本模块零依赖；需要 sha256 的产物由 node-only 脚本另行计算。
 */
export function canonicalInputFingerprint(input: BarFitCanonicalInput): string {
  return `${input.cardId}\u0000${input.text}\u0000${input.instruction}`;
}

/** 逐卡 canonical 判定结果（对账用的最窄投影）。 */
export interface CanonicalVerdictRow {
  cardId: string;
  machineVerdict: MachineVerdict;
}

/**
 * 计算一批卡的 canonical `machineVerdict`（audit / manifest / CI 共用同一函数）。
 * 输出顺序与输入顺序一致，consumer 不得自行重排或重算。
 */
export function canonicalVerdicts(cards: readonly BarFitInputSource[]): CanonicalVerdictRow[] {
  return cards.map((card) => {
    const input = toBarFitRuntimeInput(card);
    return { cardId: input.cardId, machineVerdict: judgeCanonicalBarFit(card).machineVerdict };
  });
}

/**
 * **仅 forensic**：故意剔除 instruction 的 text-only 输入，供历史对照。
 *
 * 用途：保留整改前「只扫正文」的旧口径数字作证据。产物必须带 `forensic: true`，
 * **不得**作为正式 admission 数据（Step 6：「text-only 扫描结果要显式标为 forensic」）。
 */
export function toBarFitTextOnlyForensicInput(card: BarFitInputSource): BarFitCanonicalInput {
  const input = toBarFitRuntimeInput(card);
  return { ...input, instruction: "" };
}
