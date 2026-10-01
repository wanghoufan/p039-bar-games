/**
 * A9-R7｜内容返工退役卡归档（`lib/v2-content/archive/retired-pack1-r7-2026-09-29.ts`）的**机器门禁**。
 *
 * 锁死四件事（口径与 `retired-pack1-archive.test.ts`（A9-R6）同构）：
 * ① **归档完整性**：1 张（249）字段完整（显式退役标注 + 原卡逐字快照 + 结论指针 +
 *    退役前 payloadHash）；
 * ② **运行时隔离**：归档卡不在任何运行时卡池（bridge / 质量侧车 / manifest 两轨），
 *    且 `lib/**`（除归档目录）、`app/**` 与 MC / 生产链脚本**都不 import 本归档**；
 * ③ **退役卡不回运行时内容源**：249 不在 REWRITE 卡源；
 * ④ 旧 350 题 SSOT 零改动（本批只动内容源与归档，不碰 SSOT）。
 *
 * 只读真源；不改 SSOT / 生成产物 / 阈值 / 卡源。
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { FIXED_CONTENT_MANIFEST, FIXED_PAYLOAD_HASH_PATTERN, formalFixedIdSet } from "@/lib/v2-content/fixed-content-manifest";
import { PACK1_REWRITE_CARD_IDS } from "@/lib/v2-content/pack1-rewrites/pack1-rewrite-cards";
import {
  RETIRED_PACK1_R7_AT,
  RETIRED_PACK1_R7_ADJUDICATION_SOURCE,
  RETIRED_PACK1_R7_CARDS,
  RETIRED_PACK1_R7_CARD_IDS,
  RETIRED_PACK1_R7_REASON,
} from "@/lib/v2-content/archive/retired-pack1-r7-2026-09-29";
import { mainlineRuntimeCards, mainlineSsotCards } from "@/lib/v2-content/v2-card-bridge";
import { metadataForCard } from "@/lib/v2-content/v2-card-quality-index";
import { validateFixedCardMetadataStrict } from "@/lib/v2-content/v2-card-metadata";
import { getV2ContentAdapter } from "@/lib/v2-content/v2-content-adapter";

/** A9-R7 冻结的 1 张退判卡（逐字）。 */
const RETIRED_IDS = ["PN-TRUTH-249"];

const REVIEW_PATH = "docs/qa/content-audit-v2/BAR-FIT-HUMAN-REVIEW.json";
const ARCHIVE_MODULE_BASENAME = "retired-pack1-r7-2026-09-29";

/* ------------------------------------------------------------------ */
/* ① 归档完整性                                                        */
/* ------------------------------------------------------------------ */

describe("A9-R7① 归档完整性：1 张齐全 + 显式退役标注 + 原卡逐字快照 + 退役前 payloadHash", () => {
  it("归档恰含 1 张（无缺无多），cardId 唯一且与冻结清单逐字一致", () => {
    expect(RETIRED_PACK1_R7_CARDS).toHaveLength(1);
    expect(RETIRED_PACK1_R7_CARD_IDS).toHaveLength(1);
    expect([...RETIRED_PACK1_R7_CARD_IDS]).toEqual(RETIRED_IDS);
    expect(new Set(RETIRED_PACK1_R7_CARD_IDS).size).toBe(1);
  });

  it("逐卡显式退役标注完整：retiredAt / retireReason / adjudicationSource / 结论指针 / 原结论 / payloadHash", () => {
    // 共享退役摘要常量（报告引用）。
    expect(RETIRED_PACK1_R7_REASON).toContain("A9-R7");
    expect(RETIRED_PACK1_R7_REASON).toContain("退出");
    for (const entry of RETIRED_PACK1_R7_CARDS) {
      expect(entry.retiredAt, entry.cardId).toBe(RETIRED_PACK1_R7_AT);
      expect(entry.retiredAt).toBe("2026-09-29");
      // 逐卡退役理由（对应「与 250 同轴、二选一留 250」裁决），非空且指出本卡处置。
      expect(entry.retireReason.length, entry.cardId).toBeGreaterThan(20);
      expect(entry.retireReason, entry.cardId).toContain("退出");
      expect(entry.adjudicationSource, entry.cardId).toBe(RETIRED_PACK1_R7_ADJUDICATION_SOURCE);
      expect(["PASS"], entry.cardId).toContain(entry.reviewHistoryOutcome);
      // 审查结论指针指向唯一真源（不复制结论），且带本卡 cardId。
      expect(entry.reviewConclusionPointer, entry.cardId).toContain(REVIEW_PATH);
      expect(entry.reviewConclusionPointer, entry.cardId).toContain(`cardId=${entry.cardId}`);
      // 退役前 payloadHash 逐字冻结（64 位 sha256）。
      expect(entry.payloadHash, entry.cardId).toMatch(FIXED_PAYLOAD_HASH_PATTERN);
    }
  });

  it("逐卡原卡逐字快照：cardId 对应、strict 8 项必填零缺失、枚举合法、含 planning-only 三字段", () => {
    for (const entry of RETIRED_PACK1_R7_CARDS) {
      const card = entry.card;
      expect(card.cardId, entry.cardId).toBe(entry.cardId);
      expect(card.gameType, entry.cardId).toBe("truth");
      expect(card.number, entry.cardId).toBe(Number(entry.cardId.slice("PN-TRUTH-".length)));
      const strict = validateFixedCardMetadataStrict(card);
      expect(strict.ok, `${entry.cardId} strict：${strict.issues.join("；")}`).toBe(true);
      expect(card.text.length, entry.cardId).toBeGreaterThan(0);
      // 退役快照保留 planning-only 三字段（原卡逐字）。
      for (const field of ["category", "followUpHook", "expectedAnswerShape"] as const) {
        expect(card, `${entry.cardId} 缺 ${field}`).toHaveProperty(field);
      }
    }
  });

  it("退役理由与裁决一一对应（249 原题面逐字为「本周放假」三元题）", () => {
    const byId = new Map(RETIRED_PACK1_R7_CARDS.map((entry) => [entry.cardId, entry]));
    expect(byId.get("PN-TRUTH-249")!.card.text).toBe(
      "你这周哪天最像在放假：工作日的晚上、周六，还是周一？",
    );
  });
});

/* ------------------------------------------------------------------ */
/* ② 运行时隔离                                                        */
/* ------------------------------------------------------------------ */

describe("A9-R7② 运行时隔离：退役卡不在任何运行时卡池", () => {
  const runtimeGameIds = new Set(mainlineSsotCards().map((card) => card.id));
  const runtimeV13Ids = new Set(mainlineRuntimeCards().map((card) => card.cardId));

  it("bridge：249 既不在 mainlineSsotCards() 也不在 mainlineRuntimeCards()", () => {
    for (const id of RETIRED_PACK1_R7_CARD_IDS) {
      expect(runtimeGameIds.has(id), `${id} 出现在 mainlineSsotCards()`).toBe(false);
      expect(runtimeV13Ids.has(id), `${id} 出现在 mainlineRuntimeCards()`).toBe(false);
    }
  });

  it("质量侧车：249 给出 fail-closed 双 null（未补标，不进有效轮）", () => {
    for (const id of RETIRED_PACK1_R7_CARD_IDS) {
      expect(metadataForCard(id), id).toEqual({ informationGain: null, topic: null });
    }
  });

  it("manifest：249 不在 Legacy 允许清单、不在 Formal 清单，也无 provenance", () => {
    const legacy = FIXED_CONTENT_MANIFEST.tracks.legacyCompatibility;
    const formalAllowed = new Set(FIXED_CONTENT_MANIFEST.tracks.formalFixed.allowedCardIds);
    const legacyAllowed = new Set(legacy.allowedCardIds);
    const formalSet = formalFixedIdSet();
    for (const id of RETIRED_PACK1_R7_CARD_IDS) {
      expect(legacyAllowed.has(id), `${id} 在 Legacy 允许清单`).toBe(false);
      expect(formalAllowed.has(id), `${id} 在 Formal 清单`).toBe(false);
      expect(formalSet.has(id), `${id} 在 formalFixedIdSet()`).toBe(false);
      expect(legacy.provenance[id], `${id} 有 provenance`).toBeUndefined();
    }
  });

  it("源码扫描：lib/**（除归档目录）、app/**、MC 生产链脚本都不 import 本归档", () => {
    const violations: string[] = [];
    const scanTargets: string[] = [];
    const archiveDir = join("lib", "v2-content", "archive");

    const walk = (dir: string): void => {
      for (const dirent of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, dirent.name);
        if (full === archiveDir) continue;
        if (dirent.isDirectory()) walk(full);
        else if (/\.(ts|tsx|mts|js|mjs)$/u.test(dirent.name)) scanTargets.push(full);
      }
    };
    for (const root of ["lib", "app"]) walk(root);
    for (const name of readdirSync("scripts")) {
      if (/^audit-formal-truth-.*\.ts$/u.test(name)) scanTargets.push(join("scripts", name));
    }

    const importSpecifier = /(?:from\s*|import\s*\(\s*|require\s*\(\s*)["'][^"']*v2-content\/archive[^"']*["']/u;
    const relativeSpecifier = /(?:from\s*|import\s*\(\s*|require\s*\(\s*)["'][^"']*retired-pack1-r7[^"']*["']/u;
    for (const file of scanTargets) {
      const source = readFileSync(file, "utf8");
      if (importSpecifier.test(source) || relativeSpecifier.test(source)) violations.push(file);
    }
    expect(violations, `以下文件不得 import 归档：${violations.join(", ")}`).toEqual([]);
    expect(scanTargets.length).toBeGreaterThan(50);
  });

  it("归档文件本身存在且被显式标注为只读历史", () => {
    const source = readFileSync(join("lib", "v2-content", "archive", `${ARCHIVE_MODULE_BASENAME}.ts`), "utf8");
    expect(source).toContain("不得被任何运行时路径 import");
    expect(source).toContain("RetiredPack1Card");
    expect(source).toContain(RETIRED_PACK1_R7_AT);
  });
});

/* ------------------------------------------------------------------ */
/* ③ 退役卡不回运行时内容源                                            */
/* ------------------------------------------------------------------ */

describe("A9-R7③ 退役卡不在各自 planning 卡源（不回运行时）", () => {
  it("249 不在 REWRITE 卡源", () => {
    expect(PACK1_REWRITE_CARD_IDS).not.toContain("PN-TRUTH-249");
  });

  it("归档卡与 SSOT（旧 350 题）无交集——退役只动本批卡，不碰 SSOT", () => {
    const adapter = getV2ContentAdapter();
    const ssotIds = new Set([...adapter.mainlineCards, ...adapter.expansionCards].map((card) => card.cardId));
    for (const id of RETIRED_PACK1_R7_CARD_IDS) expect(ssotIds.has(id), `${id} 出现在 SSOT`).toBe(false);
  });
});
