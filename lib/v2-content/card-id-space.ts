/**
 * 卡 ID 号段扫描（**纯函数，零依赖**；可被单测与只读脚本复用）。
 *
 * ## 为什么需要
 * 新内容批次（Golden 12 / REPLACE 批次等）必须**新开 ID**，且全库唯一。
 * 「当前最大 `PN-TRUTH-*` 号是多少、安全新号段从哪起」不能靠猜——要靠可复算的扫描，
 * 且候选集必须包含**运行时卡源 + 归档退役卡**（退役 ID 永不复用）。
 *
 * ## 口径
 * - Truth 家族识别：`^PN-TRUTH-(\d+)$`（其余前缀如 `PN-EXPAND-*` / `PN-DARE-*` 不计入本族）。
 * - **collision** 只看「同一 ID 字符串出现多次」（全库唯一性）；跨族同号（如 `PN-TRUTH-203`
 *   与 `PN-DARE-203`）不算碰撞——各族的号段彼此独立。
 * - 安全新号段起点 = 本族最大号 + 1（无任何本族卡时为 1）。
 *
 * ⚠️ 本模块**不 import 任何内容源**（含归档）：调用方把要扫描的 ID 列表传进来即可。
 * 运行时与归档由此保持解耦——本模块可被运行期安全引用。
 */

/** Truth 家族 ID 前缀（与 `formal-truth-pack.ts` / `formal-truth-bootstrap-pack.ts` 同源）。 */
export const TRUTH_CARD_ID_PREFIX = "PN-TRUTH-";

/** 号段补零位数（与既有 `PN-TRUTH-001` 风格一致）。 */
export const TRUTH_CARD_ID_DIGITS = 3;

/** 按号段格式生成 Truth 卡 ID（不判重；判重是调用方/扫描的事）。 */
export function formatTruthCardId(serial: number): string {
  if (!Number.isInteger(serial) || serial < 0) {
    throw new Error(`非法 Truth 序号：${serial}`);
  }
  return `${TRUTH_CARD_ID_PREFIX}${String(serial).padStart(TRUTH_CARD_ID_DIGITS, "0")}`;
}

/** 解析 Truth 卡 ID 的序号；非本族或非法数字返回 `null`。 */
export function parseTruthCardNumber(cardId: string): number | null {
  const match = /^PN-TRUTH-(\d+)$/u.exec(cardId);
  return match ? Number(match[1]) : null;
}

export interface TruthIdSpaceReport {
  /** 输入里的全部 ID（原序、去重）。 */
  readonly uniqueIds: readonly string[];
  /** 出现多次的 ID（collision；升序）。 */
  readonly collisions: readonly string[];
  /** Truth 家族编号（升序、去重）。 */
  readonly truthNumbers: readonly number[];
  /** 全库最大 Truth 编号（无本族卡则 `null`）。 */
  readonly maxTruthNumber: number | null;
  /** 安全新号段起点（= 最大号 + 1；无本族卡则 1）。 */
  readonly suggestedNextTruthStart: number;
  /** 输入里前缀像本族但数字非法的 ID（升序）。 */
  readonly malformed: readonly string[];
}

/**
 * 扫描一份 ID 列表，给出 Truth 号段占用报告。
 * 纯函数：同样输入恒得同样输出，可复算。
 */
export function analyzeTruthIdSpace(ids: readonly string[]): TruthIdSpaceReport {
  const seen = new Set<string>();
  const collisions = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) collisions.add(id);
    else seen.add(id);
  }

  const truthNumbers = new Set<number>();
  const malformed = new Set<string>();
  for (const id of seen) {
    if (!id.startsWith(TRUTH_CARD_ID_PREFIX)) continue;
    const serial = parseTruthCardNumber(id);
    if (serial === null) malformed.add(id);
    else truthNumbers.add(serial);
  }

  const sortedNumbers = [...truthNumbers].sort((a, b) => a - b);
  const maxTruthNumber = sortedNumbers.length > 0 ? sortedNumbers[sortedNumbers.length - 1]! : null;

  return {
    uniqueIds: [...seen],
    collisions: [...collisions].sort(),
    truthNumbers: sortedNumbers,
    maxTruthNumber,
    suggestedNextTruthStart: maxTruthNumber === null ? 1 : maxTruthNumber + 1,
    malformed: [...malformed].sort(),
  };
}

/** 从 `report.suggestedNextTruthStart` 起，连续取 `count` 个候选新 ID（供批次规划）。 */
export function suggestTruthCardIds(report: TruthIdSpaceReport, count: number): readonly string[] {
  return Array.from({ length: count }, (_, index) => formatTruthCardId(report.suggestedNextTruthStart + index));
}
