import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { judgeBarFit, type MachineVerdict } from "@/lib/v2-content/bar-fit";
import {
  BAR_FIT_INPUT_CALIBER,
  BAR_FIT_INPUT_IMPLEMENTATION,
  CONSENT_INSTRUCTION,
  judgeCanonicalBarFit,
  toBarFitRuntimeInput,
  toBarFitTextOnlyForensicInput,
} from "@/lib/v2-content/bar-fit-input";
import {
  CANONICAL_SCAN_CALIBER,
  assertMachineVerdictsReconciled,
  describeReconciliation,
  mayEnterAdmission,
  reconcileCardsAgainstManifest,
  reconcileMachineVerdicts,
  textOnlyForensicCaliber,
} from "@/lib/v2-content/bar-fit-reconcile";
import { mainlineSsotCards } from "@/lib/v2-content/v2-card-bridge";
import { getV2ContentAdapter } from "@/lib/v2-content/v2-content-adapter";

/**
 * Human Step 6｜唯一 canonical input（正文 + 玩家实际必须听到的 instruction）：
 * - canonical input 内容可复算（同一张卡「正文」vs「正文+instruction」）；
 * - `machineVerdict` 逐卡可复算；
 * - 逐 cardId 对账 fail-closed（人为制造不一致 → 校验失败）；
 * - text-only 路径带 forensic 标记且不参与 admission。
 */

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, "lib/v2-content/generated/fixed-content-manifest.json");

/**
 * 冻结 SSOT 快照 390（主线 350 + 扩圈 40）＝磁盘 BAR-FIT-AUDIT.json 的 `sets.frozenFixed390` 同集合。
 * 第一包正式内容（PN-TRUTH-201~224）走 sidecar，**不进**这份冻结快照（其审查属 C1-6 独立脚本），
 * 故这里取 SSOT adapter 真源而非桥接合并视图。
 */
const FROZEN = [...getV2ContentAdapter().mainlineCards, ...getV2ContentAdapter().expansionCards];
const FROZEN_IDS: ReadonlySet<string> = new Set(FROZEN.map((card) => card.cardId));

describe("canonical input：正文 vs 正文+instruction 都可复算", () => {
  it("运行期卡（content/instruction）与 SSOT 卡（text/consentMode）收敛成同一 canonical input", () => {
    const gameCardLike = toBarFitRuntimeInput({ id: "PN-X-001", content: "说出你今天最开心的小事", instruction: "不愿意可无惩罚跳过" });
    expect(gameCardLike).toEqual({ cardId: "PN-X-001", text: "说出你今天最开心的小事", instruction: "不愿意可无惩罚跳过" });

    const ssotLike = toBarFitRuntimeInput({ cardId: "PN-X-002", text: "说出你今天最开心的小事", consentMode: "mutual-current-consent" });
    expect(ssotLike).toEqual({
      cardId: "PN-X-002",
      text: "说出你今天最开心的小事",
      instruction: CONSENT_INSTRUCTION["mutual-current-consent"],
    });

    // 无 instruction、无 consentMode ⇒ 空说明（绝不因入口不同而丢正文）。
    expect(toBarFitRuntimeInput({ cardId: "PN-X-003", text: "正文" }).instruction).toBe("");
  });

  it("唯一 CONSENT_INSTRUCTION 来源：bridge 渲染的卡面说明 === canonical 输入里的 instruction", () => {
    const ssot = JSON.parse(readFileSync(path.join(ROOT, "lib/v2-content/generated/v2-ssot.generated.json"), "utf8")) as {
      mainlineCards: Array<{ cardId: string; consentMode: keyof typeof CONSENT_INSTRUCTION }>;
    };
    const byId = new Map(mainlineSsotCards().map((card) => [card.id, card]));
    for (const raw of ssot.mainlineCards.slice(0, 20)) {
      const card = byId.get(raw.cardId)!;
      expect(card.instruction, raw.cardId).toBe(CONSENT_INSTRUCTION[raw.consentMode]);
      expect(toBarFitRuntimeInput(card).instruction, raw.cardId).toBe(card.instruction);
    }
  });

  it("同一张卡：instruction 计入 → 内容与 machineVerdict 都可复算，且 instruction 会改变结论", () => {
    // 正文 11 字（≈2.8s，PASS）；补上 consent instruction（≈37 字）后升到复核池。
    const card = { cardId: "PN-X-004", text: "说出你最近一次玩的游戏", consentMode: "private-mutual-only" as const };
    const canonical = toBarFitRuntimeInput(card);
    const forensic = toBarFitTextOnlyForensicInput(card);

    expect(forensic.instruction).toBe("");
    expect(canonical.instruction).toBe(CONSENT_INSTRUCTION["private-mutual-only"]);
    expect(canonical.text).toBe(forensic.text);

    // 可复算：canonical 输入直接喂 judgeBarFit，结果与 judgeCanonicalBarFit 一致。
    const recomputed = judgeBarFit({ cardId: canonical.cardId, text: canonical.text, instruction: canonical.instruction });
    expect(judgeCanonicalBarFit(card)).toEqual(recomputed);
    expect(recomputed.metrics.charCount).toBe(forensic.text.length + canonical.instruction.length);
    expect(recomputed.metrics.instructionCharCount).toBe(canonical.instruction.length);

    // instruction 必须真的计入并改变结论（不含 instruction = PASS；含 = SUSPECT）。
    expect(judgeBarFit({ text: forensic.text }).machineVerdict).toBe("PASS");
    expect(recomputed.machineVerdict).toBe("SUSPECT");
  });
});

describe("逐 cardId 对账（audit ↔ manifest）fail-closed", () => {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as {
    tracks: { legacyCompatibility: { provenance: Record<string, { machineVerdict: MachineVerdict }> } };
  };
  const provenance = Object.fromEntries(
    Object.entries(manifest.tracks.legacyCompatibility.provenance).filter(([cardId]) =>
      FROZEN_IDS.has(cardId),
    ),
  ) as Record<string, { machineVerdict: MachineVerdict }>;

  it("真实产物：390 张 canonical 重算与 manifest provenance 逐卡一致", () => {
    const result = reconcileCardsAgainstManifest(provenance, FROZEN);
    expect(result.ok).toBe(true);
    expect(result.compared).toBe(390);
    expect(result.consistent).toBe(390);
    expect(result.mismatches).toEqual([]);
    expect(result.onlyInManifest).toEqual([]);
    expect(result.onlyInAudit).toEqual([]);
  });

  it("人为制造一张卡 verdict 不一致 → 对账失败且 assert 抛错（可复算差异清单）", () => {
    const target = FROZEN[0]!.cardId;
    const current = provenance[target]!.machineVerdict as MachineVerdict;
    const flipped: MachineVerdict = current === "PASS" ? "SUSPECT" : "PASS";
    const corrupted = { ...provenance, [target]: { ...provenance[target]!, machineVerdict: flipped } };

    const result = reconcileCardsAgainstManifest(corrupted, FROZEN);
    expect(result.ok).toBe(false);
    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0]!.cardId).toBe(target);
    expect(result.mismatches[0]!.manifest).toBe(flipped);
    expect(describeReconciliation(result)).toContain(target);
    expect(() => assertMachineVerdictsReconciled(result, "探针")).toThrow(/fail-closed/);

    // 探针只在内存副本上操作，真实产物未被触碰：sha256 前后一致（即「还原」）。
    const before = createHash("sha256").update(readFileSync(MANIFEST_PATH)).digest("hex");
    const after = createHash("sha256").update(readFileSync(MANIFEST_PATH)).digest("hex");
    expect(after).toBe(before);
    expect(createHash("sha256").update(JSON.stringify(provenance)).digest("hex")).not.toBe(
      createHash("sha256").update(JSON.stringify(corrupted)).digest("hex"),
    );
  });

  it("集合漂移（只在 manifest / 只在 audit）也判 fail-closed", () => {
    const extra = { ...provenance, "PN-GHOST-999": { machineVerdict: "PASS" as MachineVerdict } };
    const onlyManifest = reconcileCardsAgainstManifest(extra, FROZEN);
    expect(onlyManifest.ok).toBe(false);
    expect(onlyManifest.onlyInManifest).toContain("PN-GHOST-999");

    const dropped = { ...provenance };
    delete dropped[FROZEN[0]!.cardId];
    const onlyAudit = reconcileCardsAgainstManifest(dropped, FROZEN);
    expect(onlyAudit.ok).toBe(false);
    expect(onlyAudit.onlyInAudit).toContain(FROZEN[0]!.cardId);
  });

  it("纯内存对账辅助（reconcileMachineVerdicts）同样 fail-closed", () => {
    const result = reconcileMachineVerdicts({ a: { machineVerdict: "PASS" } }, [
      { cardId: "a", machineVerdict: "HARD_FAIL_PATTERN" },
    ]);
    expect(result.ok).toBe(false);
    expect(result.mismatches[0]).toMatchObject({ cardId: "a", audit: "HARD_FAIL_PATTERN", manifest: "PASS" });
  });
});

describe("forensic 护栏：text-only 不参与 admission", () => {
  it("canonical 口径可 admission；text-only 口径恒不可", () => {
    expect(BAR_FIT_INPUT_IMPLEMENTATION).toContain("bar-fit-input.ts");
    expect(BAR_FIT_INPUT_CALIBER).toContain("instruction");
    expect(mayEnterAdmission(CANONICAL_SCAN_CALIBER)).toBe(true);

    const forensic = textOnlyForensicCaliber("text-only 历史对照");
    expect(forensic.forensic).toBe(true);
    expect(forensic.admissionEligible).toBe(false);
    expect(forensic.includesInstruction).toBe(false);
    expect(mayEnterAdmission(forensic)).toBe(false);
    // 即使误标 admissionEligible=true，只要 forensic=true 也进不了 admission。
    expect(mayEnterAdmission({ ...CANONICAL_SCAN_CALIBER, forensic: true })).toBe(false);
    // 不含 instruction 的口径也进不了 admission。
    expect(mayEnterAdmission({ ...CANONICAL_SCAN_CALIBER, includesInstruction: false })).toBe(false);
  });

  it("audit 产物里 text-only 集带 forensic 标记，canonical 集不带", () => {
    const audit = JSON.parse(readFileSync(path.join(ROOT, "docs/qa/content-audit-v2/BAR-FIT-AUDIT.json"), "utf8")) as {
      sets: { frozenFixed390: { forensic: boolean; admissionEligible: boolean }; textOnlyForensic: { forensic: boolean; admissionEligible: boolean } };
      forensicGuard: { canonicalAdmissionEligible: boolean; textOnlyAdmissionEligible: boolean };
    };
    expect(audit.sets.textOnlyForensic.forensic).toBe(true);
    expect(audit.sets.textOnlyForensic.admissionEligible).toBe(false);
    expect(audit.sets.frozenFixed390.forensic).toBe(false);
    expect(audit.sets.frozenFixed390.admissionEligible).toBe(true);
    expect(audit.forensicGuard.canonicalAdmissionEligible).toBe(true);
    expect(audit.forensicGuard.textOnlyAdmissionEligible).toBe(false);
  });
});
