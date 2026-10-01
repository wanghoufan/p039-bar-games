/**
 * A8｜admission 待收条件登记（`lib/v2-content/pack1-supplements/pack1-admission-prep.ts`）的机器门禁。
 *
 * 锁死三件事：
 * ① **登记合法**：cardId 唯一、reason 取闭集、boundaryTag 取闭集；
 * ② **只准备不落地（卡源字面量）**：被登记卡的**planning 卡源**卡面 `responseMode` 仍 `public`、
 *    `boundaryTags` **不含**登记值（落地只发生在聚合视图，见
 *    `lib/v2-content/pack1-admission.ts`，卡源字面量保持原样、同一事实不两处存放）；
 * ③ **planning-only**：本登记模块只被聚合模块 `pack1-admission.ts` **一处** import；
 *    语义签名模块 `pack1-semantic-axes` 不被任何 `lib/**` 运行时 import。
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  PACK1_PENDING_ADMISSION_BOUNDARY_TAGS,
  PACK1_PENDING_ADMISSION_CARD_IDS,
  PACK1_PENDING_ADMISSION_OVERRIDES,
} from "@/lib/v2-content/pack1-supplements/pack1-admission-prep";
import { PACK1_ADMISSION_CARD_BY_ID } from "@/lib/v2-content/pack1-admission";
import { RETIRED_PACK1_R6_CARD_IDS } from "@/lib/v2-content/archive/retired-pack1-r6-2026-09-29";
import { PACK1_REPLACE_CARDS } from "@/lib/v2-content/pack1-replaces/pack1-replace-cards";
import { PACK1_SUPPLEMENT_CARDS } from "@/lib/v2-content/pack1-supplements/pack1-supplement-cards";
import { FIXED_CONTENT_MANIFEST } from "@/lib/v2-content/fixed-content-manifest";
import { FORMAL_TRUTH_CARDS } from "@/lib/v2-content/formal-truth-pack";
import { FORMAL_TRUTH_BOOTSTRAP_CARDS } from "@/lib/v2-content/formal-truth-bootstrap-pack";
import { mainlineRuntimeCards } from "@/lib/v2-content/v2-card-bridge";

const ALL_CARDS = [...PACK1_REPLACE_CARDS, ...PACK1_SUPPLEMENT_CARDS];
const cardById = new Map(ALL_CARDS.map((card) => [card.cardId, card]));

/** 递归收集 `lib/` 下的 `.ts` 源文件路径。 */
function collectLibSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collectLibSources(full));
    else if (full.endsWith(".ts")) out.push(full);
  }
  return out;
}

describe("A8｜admission 待收条件登记：合法 / 不落地 / planning-only", () => {
  it("① 登记合法：cardId 唯一升序、reason 闭集、boundaryTag 闭集、registeredIn 非空", () => {
    const ids = PACK1_PENDING_ADMISSION_CARD_IDS;
    expect(ids).toHaveLength(PACK1_PENDING_ADMISSION_OVERRIDES.length);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(ids);
    const allowedTags = new Set<string>(PACK1_PENDING_ADMISSION_BOUNDARY_TAGS);
    const allowedReasons = new Set(["private_response_mode", "boundary_tag"]);
    for (const entry of PACK1_PENDING_ADMISSION_OVERRIDES) {
      expect(entry.reasons.length, entry.cardId).toBeGreaterThan(0);
      for (const reason of entry.reasons) expect(allowedReasons.has(reason), `${entry.cardId} reason`).toBe(true);
      for (const tag of entry.admissionBoundaryTags ?? []) {
        expect(allowedTags.has(tag), `${entry.cardId} tag ${tag}`).toBe(true);
      }
      expect(entry.registeredIn.length, entry.cardId).toBeGreaterThan(0);
      if (entry.admissionResponseMode !== undefined) {
        expect(entry.admissionResponseMode).toBe("private-individual");
      }
    }
  });

  it("② 本单点名的 267（＋269 / 259）已登记；267/269 待私答或 proximity；277 已退役（登记作废）", () => {
    expect(PACK1_PENDING_ADMISSION_CARD_IDS).toContain("PN-TRUTH-267");
    // A9-R6（2026-09-29 内容裁决）：277 已退役 ⇒ 其 location-sensitive 登记随卡作废，
    // 不得再用泛安全标签给弱卡续命。
    expect(RETIRED_PACK1_R6_CARD_IDS).toContain("PN-TRUTH-277");
    expect(PACK1_PENDING_ADMISSION_CARD_IDS).not.toContain("PN-TRUTH-277");
    const by267 = PACK1_PENDING_ADMISSION_OVERRIDES.find((e) => e.cardId === "PN-TRUTH-267")!;
    expect(by267.admissionResponseMode).toBe("private-individual");
    expect(by267.admissionBoundaryTags).toContain("proximity");
    expect(PACK1_PENDING_ADMISSION_OVERRIDES.find((e) => e.cardId === "PN-TRUTH-277")).toBeUndefined();
  });

  it("②' 只准备不落地：被登记卡卡面 responseMode 仍 public、boundaryTags 不含登记值", () => {
    for (const entry of PACK1_PENDING_ADMISSION_OVERRIDES) {
      const card = cardById.get(entry.cardId);
      expect(card, `${entry.cardId} 不在 planning 卡源（登记表与卡源对不上）`).toBeTruthy();
      expect(card!.responseMode, `${entry.cardId} 已把 responseMode 落地（本单不得落地）`).toBe("public");
      for (const tag of entry.admissionBoundaryTags ?? []) {
        expect(card!.boundaryTags, `${entry.cardId} 已把 ${tag} 落到卡面`).not.toContain(tag);
      }
    }
  });

  it("②'' 被登记卡已在 A9 落地：manifest 两轨 + 运行时卡源都收，且待收字段确实落在聚合视图上", () => {
    const formal = new Set(FIXED_CONTENT_MANIFEST.tracks.formalFixed.allowedCardIds);
    const legacy = new Set(FIXED_CONTENT_MANIFEST.tracks.legacyCompatibility.allowedCardIds);
    const runtimeIds = new Set(mainlineRuntimeCards().map((card) => card.cardId));
    for (const id of PACK1_PENDING_ADMISSION_CARD_IDS) {
      expect(formal.has(id), `${id} 应在 formalFixed`).toBe(true);
      expect(legacy.has(id), `${id} 应在 legacyCompatibility`).toBe(true);
      expect(runtimeIds.has(id), `${id} 应已在运行时卡源`).toBe(true);
    }
    // 落地证据（与「只准备不落地」的卡源字面量相对）：聚合视图（桥接取卡来源）上字段已按登记值落位。
    for (const entry of PACK1_PENDING_ADMISSION_OVERRIDES) {
      const landed = PACK1_ADMISSION_CARD_BY_ID.get(entry.cardId);
      expect(landed, `${entry.cardId} 不在聚合视图`).toBeDefined();
      if (entry.admissionResponseMode !== undefined) {
        expect(landed!.responseMode, `${entry.cardId} responseMode 未落地`).toBe(entry.admissionResponseMode);
      }
      for (const tag of entry.admissionBoundaryTags ?? []) {
        expect(landed!.boundaryTags, `${entry.cardId} 未落地 ${tag}`).toContain(tag);
      }
    }
    // KEEP 5（不属于本登记表）仍在既有运行时包内，不受影响。
    const keepIds = new Set([...FORMAL_TRUTH_CARDS, ...FORMAL_TRUTH_BOOTSTRAP_CARDS].map((c) => c.cardId));
    for (const id of PACK1_PENDING_ADMISSION_CARD_IDS) expect(keepIds.has(id), id).toBe(false);
  });

  it("③ planning-only：本登记模块只被聚合模块 pack1-admission.ts 一处 import；语义模块不被任何 lib/** 运行时 import", () => {
    const moduleFile = join("lib", "v2-content", "pack1-supplements", "pack1-admission-prep.ts");
    const sources = collectLibSources(join(process.cwd(), "lib")).filter(
      (file) => !file.endsWith("pack1-admission-prep.ts"),
    );
    expect(sources.length).toBeGreaterThan(50);
    // 只看**真实 import 语句**（`from "..."` / `import("...")`）；注释里提到文件名不算（本单在卡注释里引用过）。
    const importRe = (mod: string) => new RegExp(`(?:from\\s*|import\\s*\\(\\s*)["'][^"']*${mod}["']`);
    const imported = sources.filter((file) => importRe("pack1-admission-prep").test(readFileSync(file, "utf8")));
    // A9（2026-09-29）：唯一合法落地点 = 聚合模块 `pack1-admission.ts`（读表落地，单一真源不抄第二份）。
    const repoRoot = `${process.cwd()}/`;
    expect(
      imported.map((file) => file.replace(repoRoot, "")).sort(),
      `被运行时 import：${imported.join(" / ")}`,
    ).toEqual(["lib/v2-content/pack1-admission.ts"]);
    // 同理，语义签名模块仍不得被任何运行时 import（同为 planning-only 审计视图）。
    const semanticImported = sources.filter(
      (file) => !file.endsWith("pack1-semantic-axes.ts") && importRe("pack1-semantic-axes").test(readFileSync(file, "utf8")),
    );
    expect(semanticImported, `语义模块被运行时 import：${semanticImported.join(" / ")}`).toEqual([]);
    // 自证：本文件路径真实存在（防路径写错导致 test 空转）。
    expect(statSync(join(process.cwd(), moduleFile)).isFile()).toBe(true);
  });
});
