/**
 * A4a｜全库 Truth ID 号段扫描 + collision 校验（`lib/v2-content/card-id-space.ts`）。
 *
 * 给后续批次（Golden 12 / REWRITE / REPLACE / H3·H4 补卡）提供**可复算**的安全新号段：
 * - 扫描范围 = 冻结 SSOT（主线 + 扩圈）+ 运行时内容源（KEEP 5）+ 归档退役卡（26）
 *   + 已落地的新内容批（Golden 12 `232~243` + 第一包 REWRITE `244~250` + 第一包 REPLACE `251~269`）；
 * - 重点断言：**只扫运行时会算出错误起点**（会与归档 ID 撞号），必须把归档算进来。
 *
 * ⚠️ A4c/A5 修正：新内容批落地后，「全库最大」不再是 231 / 250；漏掉新批会打印过期起点（假话）。
 *
 * 只读真源；不改 SSOT / 生成产物 / 卡源。
 */

import { describe, expect, it } from "vitest";

import {
  analyzeTruthIdSpace,
  formatTruthCardId,
  parseTruthCardNumber,
  suggestTruthCardIds,
  TRUTH_CARD_ID_PREFIX,
} from "@/lib/v2-content/card-id-space";
import { getV2ContentAdapter } from "@/lib/v2-content/v2-content-adapter";
import { RETIRED_TRUTH_CARD_IDS } from "@/lib/v2-content/archive/retired-truth-pack-2026-09-29";
import { RETIRED_PACK1_R6_CARD_IDS } from "@/lib/v2-content/archive/retired-pack1-r6-2026-09-29";
import { RETIRED_PACK1_R7_CARD_IDS } from "@/lib/v2-content/archive/retired-pack1-r7-2026-09-29";
import { GOLDEN_12_CARD_IDS } from "@/lib/v2-content/golden12/golden-12-cards";
import { PACK1_REWRITE_CARD_IDS } from "@/lib/v2-content/pack1-rewrites/pack1-rewrite-cards";
import { PACK1_REPLACE_CARD_IDS } from "@/lib/v2-content/pack1-replaces/pack1-replace-cards";
import { PACK1_SUPPLEMENT_CARD_IDS } from "@/lib/v2-content/pack1-supplements/pack1-supplement-cards";
import { FORMAL_TRUTH_BOOTSTRAP_CARDS } from "@/lib/v2-content/formal-truth-bootstrap-pack";
import { FORMAL_TRUTH_CARDS } from "@/lib/v2-content/formal-truth-pack";

const adapter = getV2ContentAdapter();

/** 冻结 SSOT 全量 ID（主线 350 + 扩圈 40）。 */
const SSOT_IDS = [...adapter.mainlineCards, ...adapter.expansionCards].map((card) => card.cardId);
/** 运行时内容源 ID（KEEP 5）。 */
const RUNTIME_PACK_IDS = [
  ...FORMAL_TRUTH_CARDS.map((card) => card.cardId),
  ...FORMAL_TRUTH_BOOTSTRAP_CARDS.map((card) => card.cardId),
];
/** 已落地的新内容批 ID（Golden 12 + REWRITE + REPLACE + A6 补卡；先不进 Formal，但**占号段**）。 */
const NEW_BATCH_IDS = [
  ...GOLDEN_12_CARD_IDS,
  ...PACK1_REWRITE_CARD_IDS,
  ...PACK1_REPLACE_CARD_IDS,
  ...PACK1_SUPPLEMENT_CARD_IDS,
];
/** 全库 ID（含 A3 归档 26 ＋ A9-R6 退役 3 ＋ A9-R7 退役 1；退役 ID 永不复用 ⇒ 必须计入 collision 域）。 */
const LIBRARY_IDS = [
  ...SSOT_IDS,
  ...RUNTIME_PACK_IDS,
  ...RETIRED_TRUTH_CARD_IDS,
  ...RETIRED_PACK1_R6_CARD_IDS,
  ...RETIRED_PACK1_R7_CARD_IDS,
  ...NEW_BATCH_IDS,
];

describe("A4a｜全库 Truth ID 号段扫描（可复算）", () => {
  it("全库 ID 无 collision、无 malformed；Truth 编号 === 1~50 ∪ 201~283", () => {
    const report = analyzeTruthIdSpace(LIBRARY_IDS);
    expect(report.collisions).toEqual([]);
    expect(report.malformed).toEqual([]);
    const expectedNumbers = [
      ...Array.from({ length: 50 }, (_, index) => index + 1),
      ...Array.from({ length: 83 }, (_, index) => index + 201),
    ];
    expect([...report.truthNumbers]).toEqual(expectedNumbers);
  });

  it("全库最大 Truth 编号 = 283；安全新号段起点 = 284", () => {
    const report = analyzeTruthIdSpace(LIBRARY_IDS);
    expect(report.maxTruthNumber).toBe(283);
    expect(report.suggestedNextTruthStart).toBe(284);
    expect(suggestTruthCardIds(report, 3)).toEqual(["PN-TRUTH-284", "PN-TRUTH-285", "PN-TRUTH-286"]);
  });

  it("⚠️ 只扫运行时（漏掉归档）会算错起点：运行时最大 = 229 ⇒ 误推 230，与归档的 230/231 撞号", () => {
    const runtimeOnly = analyzeTruthIdSpace([...SSOT_IDS, ...RUNTIME_PACK_IDS]);
    expect(runtimeOnly.maxTruthNumber).toBe(229);
    expect(runtimeOnly.suggestedNextTruthStart).toBe(230);
    // 230 / 231 已被归档占用 —— 这正是「扫描必须含归档」的判据。
    expect(RETIRED_TRUTH_CARD_IDS).toContain("PN-TRUTH-230");
    expect(RETIRED_TRUTH_CARD_IDS).toContain("PN-TRUTH-231");
    // 全库口径给出正确且安全的 284（新内容批已占满 232~283）。
    expect(analyzeTruthIdSpace(LIBRARY_IDS).suggestedNextTruthStart).toBe(284);
  });

  it("可复算：同输入两次/乱序输入 ⇒ 同一报告", () => {
    const a = analyzeTruthIdSpace(LIBRARY_IDS);
    const b = analyzeTruthIdSpace([...LIBRARY_IDS].reverse());
    expect(b.truthNumbers).toEqual(a.truthNumbers);
    expect(b.maxTruthNumber).toBe(a.maxTruthNumber);
    expect(b.suggestedNextTruthStart).toBe(a.suggestedNextTruthStart);
    expect(b.collisions).toEqual(a.collisions);
  });

  it("collision 检测可用：重复 ID 会被抓出（构造性反例）", () => {
    const report = analyzeTruthIdSpace(["PN-TRUTH-232", "PN-TRUTH-232", "PN-DARE-001"]);
    expect(report.collisions).toEqual(["PN-TRUTH-232"]);
    // 跨族同号不算碰撞（各族号段独立）。
    const crossFamily = analyzeTruthIdSpace(["PN-TRUTH-203", "PN-DARE-203"]);
    expect(crossFamily.collisions).toEqual([]);
    expect(crossFamily.truthNumbers).toEqual([203]);
  });

  it("family 辅助函数：format / parse 往返一致，非本族/非法输入回 null", () => {
    expect(formatTruthCardId(7)).toBe("PN-TRUTH-007");
    expect(formatTruthCardId(232)).toBe("PN-TRUTH-232");
    expect(parseTruthCardNumber("PN-TRUTH-232")).toBe(232);
    expect(parseTruthCardNumber("PN-TRUTH-007")).toBe(7);
    expect(parseTruthCardNumber("PN-DARE-001")).toBeNull();
    expect(parseTruthCardNumber("PN-TRUTH-abc")).toBeNull();
    expect(TRUTH_CARD_ID_PREFIX).toBe("PN-TRUTH-");
    const malformed = analyzeTruthIdSpace(["PN-TRUTH-abc", "PN-TRUTH-"]);
    expect(malformed.malformed).toEqual(["PN-TRUTH-", "PN-TRUTH-abc"]);
  });
});
