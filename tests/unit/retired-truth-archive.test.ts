/**
 * A4a｜退役 Truth 卡归档（`lib/v2-content/archive/retired-truth-pack-2026-09-29.ts`）的**机器门禁**。
 *
 * 本单把 26 张不合格旧版本从运行时内容源移出（保留历史、不删审证据），本文件锁死四件事：
 * ① **归档完整性**：26 张齐全、字段完整（显式退役标注 + 原卡逐字快照 + 审查结论指针）；
 * ② **运行时隔离**：归档卡不在任何运行时卡池（bridge / 质量侧车 / manifest 两轨），
 *    且 `lib/**`（除归档目录）、`app/**` 与 MC 生产链脚本**都不 import 归档**；
 * ③ **KEEP 5 仍在运行时且仍在 Formal**（退役只动 26 张，不动 KEEP）；
 * ④ **旧 350 题 SSOT 零改动**（文件字节 sha256 === 冻结常量）。
 *
 * 只读真源；不改 SSOT / 生成产物 / 阈值 / 卡源。
 */

import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { getV2ContentAdapter } from "@/lib/v2-content/v2-content-adapter";
import { FIXED_CONTENT_MANIFEST, formalFixedIdSet } from "@/lib/v2-content/fixed-content-manifest";
import { FORMAL_TRUTH_BOOTSTRAP_CARDS } from "@/lib/v2-content/formal-truth-bootstrap-pack";
import { FORMAL_TRUTH_CARDS } from "@/lib/v2-content/formal-truth-pack";
import { PACK1_ADMISSION_CARD_IDS } from "@/lib/v2-content/pack1-admission";
import {
  RETIRED_TRUTH_AT,
  RETIRED_TRUTH_AUDIT_SOURCE,
  RETIRED_TRUTH_CARDS,
  RETIRED_TRUTH_CARD_IDS,
  RETIRED_TRUTH_REASON,
} from "@/lib/v2-content/archive/retired-truth-pack-2026-09-29";
import {
  mainlineRuntimeCards,
  mainlineSsotCards,
} from "@/lib/v2-content/v2-card-bridge";
import { metadataForCard } from "@/lib/v2-content/v2-card-quality-index";
import { validateFixedCardMetadataStrict } from "@/lib/v2-content/v2-card-metadata";
import {
  V2_SSOT_EXPANSION_SHA256,
  V2_SSOT_MAINLINE_SHA256,
} from "@/lib/v2-content/v2-types";

/** A4a 冻结的 26 张退役卡（逐字，Human 基线审计 KEEP/REWRITE/REPLACE 分类）。 */
const RETIRED_IDS = [
  "PN-TRUTH-201", "PN-TRUTH-202", "PN-TRUTH-204", "PN-TRUTH-206", "PN-TRUTH-207", "PN-TRUTH-208",
  "PN-TRUTH-210", "PN-TRUTH-211", "PN-TRUTH-212", "PN-TRUTH-213", "PN-TRUTH-214", "PN-TRUTH-215",
  "PN-TRUTH-216", "PN-TRUTH-217", "PN-TRUTH-218", "PN-TRUTH-219", "PN-TRUTH-220", "PN-TRUTH-221",
  "PN-TRUTH-222", "PN-TRUTH-223", "PN-TRUTH-224", "PN-TRUTH-225", "PN-TRUTH-226", "PN-TRUTH-228",
  "PN-TRUTH-230", "PN-TRUTH-231",
].sort();

/** A3/A4a KEEP 5（保持 Formal 的全体）。 */
const KEEP_IDS = ["PN-TRUTH-203", "PN-TRUTH-205", "PN-TRUTH-209", "PN-TRUTH-227", "PN-TRUTH-229"].sort();

const REVIEW_PATH = "docs/qa/content-audit-v2/BAR-FIT-HUMAN-REVIEW.json";
const ARCHIVE_MODULE_BASENAME = "retired-truth-pack-2026-09-29";

/* ------------------------------------------------------------------ */
/* ① 归档完整性                                                        */
/* ------------------------------------------------------------------ */

describe("A4a① 归档完整性：26 张齐全 + 显式退役标注 + 原卡逐字快照", () => {
  it("归档恰含 26 张（无缺无多），cardId 唯一且与冻结清单逐字一致（升序）", () => {
    expect(RETIRED_TRUTH_CARDS).toHaveLength(26);
    expect(RETIRED_TRUTH_CARD_IDS).toHaveLength(26);
    expect([...RETIRED_TRUTH_CARD_IDS]).toEqual(RETIRED_IDS);
    expect(new Set(RETIRED_TRUTH_CARD_IDS).size).toBe(26);
    // 归档以 cardId 升序排列（可读 + 确定性）。
    const sorted = [...RETIRED_TRUTH_CARD_IDS].sort();
    expect([...RETIRED_TRUTH_CARD_IDS]).toEqual(sorted);
  });

  it("逐卡显式退役标注完整：retiredAt / retireReason / auditSource / 审查结论指针 / 原结论", () => {
    for (const entry of RETIRED_TRUTH_CARDS) {
      expect(entry.retiredAt, entry.cardId).toBe(RETIRED_TRUTH_AT);
      expect(entry.retiredAt).toBe("2026-09-29");
      expect(entry.retireReason, entry.cardId).toBe(RETIRED_TRUTH_REASON);
      expect(entry.retireReason, entry.cardId).toContain("酒吧新内容基线");
      expect(entry.auditSource, entry.cardId).toBe(RETIRED_TRUTH_AUDIT_SOURCE);
      expect(entry.auditSource).toBe("temp/BAR-AUDIT-PACK1-31.md");
      expect(["REWRITE", "REPLACE"], entry.cardId).toContain(entry.auditClassification);
      // 审查结论指针指向唯一真源（不复制结论），且带本卡 cardId。
      expect(entry.reviewConclusionPointer, entry.cardId).toContain(REVIEW_PATH);
      expect(entry.reviewConclusionPointer, entry.cardId).toContain(`cardId=${entry.cardId}`);
      expect(entry.reviewHistoryOutcome, entry.cardId).toBe("PASS");
    }
  });

  it("逐卡原卡逐字快照字段完整：cardId 对应、strict 8 项必填零缺失、枚举合法", () => {
    for (const entry of RETIRED_TRUTH_CARDS) {
      const card = entry.card;
      expect(card.cardId, entry.cardId).toBe(entry.cardId);
      expect(card.gameType, entry.cardId).toBe("truth");
      expect(card.number, entry.cardId).toBe(Number(entry.cardId.slice("PN-TRUTH-".length)));
      const strict = validateFixedCardMetadataStrict(card);
      expect(strict.ok, `${entry.cardId} strict：${strict.issues.join("；")}`).toBe(true);
      expect(strict.issues, entry.cardId).toEqual([]);
      // 题面非空（防止「空壳归档」）。
      expect(card.text.length, entry.cardId).toBeGreaterThan(0);
    }
  });

  it("归档卡与运行时 KEEP 5 无交集；KEEP 5 不在归档里", () => {
    const archived = new Set(RETIRED_TRUTH_CARD_IDS);
    for (const id of KEEP_IDS) expect(archived.has(id), `${id} 不得在归档里`).toBe(false);
    const kept = new Set([...FORMAL_TRUTH_CARDS, ...FORMAL_TRUTH_BOOTSTRAP_CARDS].map((card) => card.cardId));
    for (const id of RETIRED_TRUTH_CARD_IDS) expect(kept.has(id), `${id} 不得在运行时内容源`).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* ② 运行时隔离                                                        */
/* ------------------------------------------------------------------ */

describe("A4a② 运行时隔离：退役卡不在任何运行时卡池", () => {
  const runtimeGameIds = new Set(mainlineSsotCards().map((card) => card.id));
  const runtimeV13Ids = new Set(mainlineRuntimeCards().map((card) => card.cardId));

  it("bridge：26 张既不在 mainlineSsotCards() 也不在 mainlineRuntimeCards()", () => {
    for (const id of RETIRED_TRUTH_CARD_IDS) {
      expect(runtimeGameIds.has(id), `${id} 出现在 mainlineSsotCards()`).toBe(false);
      expect(runtimeV13Ids.has(id), `${id} 出现在 mainlineRuntimeCards()`).toBe(false);
    }
  });

  it("质量侧车：26 张给出 fail-closed 双 null（未补标，不进有效轮）", () => {
    for (const id of RETIRED_TRUTH_CARD_IDS) {
      expect(metadataForCard(id), id).toEqual({ informationGain: null, topic: null });
    }
  });

  it("manifest：26 张不在 Legacy 允许清单、不在 Formal 清单，也无 provenance", () => {
    const legacy = FIXED_CONTENT_MANIFEST.tracks.legacyCompatibility;
    const formal = FIXED_CONTENT_MANIFEST.tracks.formalFixed;
    const legacyAllowed = new Set(legacy.allowedCardIds);
    const formalAllowed = new Set(formal.allowedCardIds);
    for (const id of RETIRED_TRUTH_CARD_IDS) {
      expect(legacyAllowed.has(id), `${id} 在 Legacy 允许清单`).toBe(false);
      expect(formalAllowed.has(id), `${id} 在 Formal 清单`).toBe(false);
      expect(legacy.provenance[id], `${id} 有 provenance`).toBeUndefined();
    }
  });

  it("源码扫描：lib/**（除归档目录）、app/**、MC 生产链脚本都不 import 归档", () => {
    const violations: string[] = [];
    const scanTargets: string[] = [];
    // 归档目录本身不算违规（唯一合法归属；其合法消费者是测试、只读扫描脚本与审计/裁决脚本，运行时路径禁 import）。
    const archiveDir = join("lib", "v2-content", "archive");

    const walk = (dir: string): void => {
      for (const dirent of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, dirent.name);
        if (full === archiveDir) continue;
        if (dirent.isDirectory()) {
          walk(full);
        } else if (/\.(ts|tsx|mts|js|mjs)$/u.test(dirent.name)) {
          scanTargets.push(full);
        }
      }
    };

    for (const root of ["lib", "app"]) {
      walk(root);
    }
    // MC / 生产链脚本（audit-formal-truth-*）必须与归档绝缘。
    for (const name of readdirSync("scripts")) {
      if (/^audit-formal-truth-.*\.ts$/u.test(name)) scanTargets.push(join("scripts", name));
    }

    // 只认真正的 import / require 语句（头注释里提到归档路径不算违规——那是文档，不是依赖）。
    const importSpecifier = /(?:from\s*|import\s*\(\s*|require\s*\(\s*)["'][^"']*v2-content\/archive[^"']*["']/u;
    const relativeSpecifier = /(?:from\s*|import\s*\(\s*|require\s*\(\s*)["'][^"']*retired-truth-pack[^"']*["']/u;
    for (const file of scanTargets) {
      const source = readFileSync(file, "utf8");
      if (importSpecifier.test(source) || relativeSpecifier.test(source)) {
        violations.push(file);
      }
    }
    expect(violations, `以下文件不得 import 归档：${violations.join(", ")}`).toEqual([]);
    // 防空断言：确实扫到了文件（否则上面的 violations=[] 毫无意义）。
    expect(scanTargets.length).toBeGreaterThan(50);
  });

  it("归档文件本身存在且被显式标注为只读历史（头注释含「不得被任何运行时路径 import」）", () => {
    const source = readFileSync(join("lib", "v2-content", "archive", `${ARCHIVE_MODULE_BASENAME}.ts`), "utf8");
    expect(source).toContain("不得被任何运行时路径 import");
    expect(source).toContain("RetiredTruthCard");
    expect(source).toContain(RETIRED_TRUTH_AT);
  });
});

/* ------------------------------------------------------------------ */
/* ③ KEEP 5 仍在运行时且仍在 Formal                                        */
/* ------------------------------------------------------------------ */

describe("A4a③ KEEP 5 仍在运行时卡源、仍在 Formal，且全部满足四条件准入", () => {
  it("KEEP 5 全在 mainlineSsotCards()（运行时）", () => {
    const runtimeGameIds = new Set(mainlineSsotCards().map((card) => card.id));
    for (const id of KEEP_IDS) expect(runtimeGameIds.has(id), `${id} 不在运行时卡源`).toBe(true);
  });

  it("KEEP 5 仍在 Formal；manifest FormalFixed 清单 === 内容源派生的正式集（逐 id，不写死）", () => {
    const legacy = FIXED_CONTENT_MANIFEST.tracks.legacyCompatibility;
    // A9（2026-09-29）：Formal = 第一包 3 ＋ Bootstrap 2 ＋ 重构批 52，逐 id 由内容源派生。
    const formalFromContent = [
      ...FORMAL_TRUTH_CARDS.map((card) => card.cardId),
      ...FORMAL_TRUTH_BOOTSTRAP_CARDS.map((card) => card.cardId),
      ...PACK1_ADMISSION_CARD_IDS,
    ].sort();
    expect([...FIXED_CONTENT_MANIFEST.tracks.formalFixed.allowedCardIds].sort()).toEqual(formalFromContent);
    expect([...formalFixedIdSet()].sort()).toEqual(formalFromContent);
    for (const id of KEEP_IDS) {
      expect(formalFromContent, `${id}（KEEP）应仍在 Formal`).toContain(id);
      const provenance = legacy.provenance[id];
      expect(provenance, `${id} 缺 provenance`).toBeDefined();
      expect(provenance!.reviewed, id).toBe(true);
      expect(provenance!.humanBarFit, id).toBe("PASS");
      expect(provenance!.metadataStatus, id).toBe("audited");
    }
  });
});

/* ------------------------------------------------------------------ */
/* ④ 旧 350 题 SSOT 零改动                                                */
/* ------------------------------------------------------------------ */

describe("A4a④ 旧 350 题 SSOT 零改动", () => {
  const adapter = getV2ContentAdapter();
  const sha256File = (path: string): string =>
    createHash("sha256").update(readFileSync(path)).digest("hex");

  /**
   * 冻结 SSOT 生成物的**字节级**指纹（2026-09-29 记录）。本单不改这份生成物，
   * 任何字节改动（含重排/空格）都会让本断言变红——这就是「旧 350 题 SSOT 零改动」的可执行门禁。
   */
  const FROZEN_SSOT_BYTES_SHA256 = "46f68e862a06041d932e425d28d595808554487abea2aa72936be9f0387af687";

  it("冻结 SSOT 生成物字节 sha256 逐字未变（主线 350 + 扩圈 40）", () => {
    const path = join(process.cwd(), "lib", "v2-content", "generated", "v2-ssot.generated.json");
    expect(sha256File(path)).toBe(FROZEN_SSOT_BYTES_SHA256);
    // 声明 provenance 与冻结常量、冻结卡数一致。
    expect(adapter.provenance.mainline.sha256).toBe(V2_SSOT_MAINLINE_SHA256);
    expect(adapter.provenance.expansion.sha256).toBe(V2_SSOT_EXPANSION_SHA256);
    expect(adapter.mainlineCardCount).toBe(350);
    expect(adapter.expansionCardCount).toBe(40);
  });

  it("归档 26 张的 cardId 不在 SSOT（旧 350 题）里——退役只动本包卡，不碰 SSOT", () => {
    const ssotIds = new Set(
      [...adapter.mainlineCards, ...adapter.expansionCards].map((card) => card.cardId),
    );
    for (const id of RETIRED_TRUTH_CARD_IDS) {
      expect(ssotIds.has(id), `${id} 出现在 SSOT`).toBe(false);
    }
  });
});
