/**
 * B6｜第一包 MC / 报告的**可复算护栏**（沿用 `formal-truth-production-chain-note.test.ts` 的思路，
 * 把「note 必须由实测派生」这条纪律扩展到 MC 产物与 `FORMAL-TRUTH-MC.md` 的 summary/结论）。
 *
 * 背景：A3（2026-09-29）后 26 张旧版本退出 Formal，Formal 曾由 31 → 5（KEEP 5）；
 * A9（2026-09-29）第一包重构批 52 张经准入后 Formal 扩容（52 ＋ KEEP 5）。
 * 本文件的期望值一律由**内容源 / manifest 真源 / 重刷后的 MC 产物**派生 —— 张数与档位不写死，
 * 只把「报告与产物不得自相矛盾」编成红灯会亮的门禁，五组断言：
 *
 * 1. **口径 B（当前真实 UI）不变式**：无披露 ⇒ effective 恒 0、Heat 恒 H1、互选窗口 0；
 * 2. **口径 A（Engine）**：H2 reach > 0、effective > 0——证明「A 离开 H1」且**不把 A 当 B**；
 * 3. **A/B 关键数值不混用**：报告两个口径章节的数字分别等于 MC 的 modeB / modeA；
 * 4. **heatMin=1 的 Formal 集合**（= H1 桶可抽）与产物、报告逐字一致（防报告引用过期数字）；
 * 5. **报告没有与实测矛盾的硬编码结论**（扫描旧口径字符串 + 按数据现判「缺 / 不缺」）。
 *
 * 只读产物与真源：不写盘、不跑模拟、不改任何判定 / 阈值 / 卡内容。
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { formalFixedIdSet } from "@/lib/v2-content/fixed-content-manifest";
import { FORMAL_TRUTH_BOOTSTRAP_CARDS } from "@/lib/v2-content/formal-truth-bootstrap-pack";
import { FORMAL_TRUTH_CARDS } from "@/lib/v2-content/formal-truth-pack";
import { PACK1_ADMISSION_CARDS } from "@/lib/v2-content/pack1-admission";
import { mainlineRuntimeCards } from "@/lib/v2-content/v2-card-bridge";
import { HEAT_THRESHOLDS } from "@/lib/v2-relationship/v2-state";

const DIR = join(process.cwd(), "docs/qa/content-audit");
const mc = JSON.parse(readFileSync(join(DIR, "FORMAL-TRUTH-MC.json"), "utf8")) as McArtifact;
const chain = JSON.parse(readFileSync(join(DIR, "FORMAL-TRUTH-PRODUCTION-CHAIN.json"), "utf8")) as Record<string, unknown>;
const REPORT = readFileSync(join(DIR, "FORMAL-TRUTH-MC.md"), "utf8");

interface ModeSummary {
  sessions: number;
  sessionsCompleted20: number;
  sessionRate: number;
  deadEndSessions: number;
  deadEndRate: number;
  totalDraws: number;
  effectivePerSession: number;
  heatAtDraw: Record<string, number>;
  sessionsReachingH2: number;
  sessionsReachingH3: number;
  sessionsReachingH4: number;
  mutualWindowReached: number;
  longestLowZeroRunMean: number;
  formalExposedIds: string[];
}
interface McArtifact {
  cardSource: { packTotal: number; formalTotal: number; legacyTotal: number };
  staticHeatAvailability: { heat: string; legalCount: number; formalLegal: number; formalLegalIds: string[] }[];
  h1Formal: { count: number; ids: string[]; byIntensity: Record<string, number> };
  formalCountableUpTo: { heatMinLe1: number; heatMinLe2: number; heatMinLe3: number; heatMinLe4: number };
  modeA: ModeSummary;
  modeB: ModeSummary;
  readingGuide?: string;
}

const thresholdOf = (heat: string): number => HEAT_THRESHOLDS.find((band) => band.heat === heat)!.min;
const HEAT_ORDER = HEAT_THRESHOLDS.map((band) => band.heat);
const H2_MIN = thresholdOf("H2");
const ENGINE = mc.modeB;
const UI = mc.modeA;

const H1_BAND = mc.staticHeatAvailability.find((band) => band.heat === "H1")!;
const H1_FORMAL_IDS_MC = [...H1_BAND.formalLegalIds].sort();
const H1_FORMAL_IDS_H1FIELD = [...mc.h1Formal.ids].sort();
const H1_FORMAL_COUNT = H1_FORMAL_IDS_MC.length;

/** 独立复算：heatMin=1 且 H1 合法的 Formal（用 manifest 真源 ∩ 生产桥接卡源，不复用 MC 产物）。 */
const independentlyDerived = ((): string[] => {
  const formal = formalFixedIdSet();
  return mainlineRuntimeCards()
    .filter((card) => formal.has(card.cardId) && card.heatMin <= 1 && 1 <= card.heatMax)
    .map((card) => card.cardId)
    .sort();
})();

const sumHeat = (m: Record<string, number>): number => Object.values(m).reduce((a, b) => a + b, 0);

/** 报告第 2 章「当前 UI 实际可抽到的 Formal」那一行。 */
const uiLine = ((): string => {
  const line = REPORT.split("\n").find((row) => row.includes("当前 UI 实际可抽到的 Formal 张数"));
  expect(line, "报告缺少「当前 UI 实际可抽到的 Formal 张数」一行").toBeDefined();
  return line!;
})();
const reportIdsUIIndex = uiLine.indexOf("——");
const reportClaimedCount = Number(/当前 UI 实际可抽到的 Formal 张数\*\*：\*\*(\d+) 张\*\*/u.exec(uiLine)?.[1]);
const reportClaimedIds = (uiLine.slice(reportIdsUIIndex).match(/PN-TRUTH-\d+/gu) ?? []).sort();

/**
 * 内容源派生的 heatMin=1 Formal 集合（与 manifest / MC 产物无关的**独立**一路）：
 * 第一包 ＋ Bootstrap ＋ A9 重构批里 `heatMin <= 1 <= heatMax` 的卡（不写死张数）。
 */
const h1Expected = [
  ...FORMAL_TRUTH_CARDS,
  ...FORMAL_TRUTH_BOOTSTRAP_CARDS,
  ...PACK1_ADMISSION_CARDS,
]
  .filter((card) => card.heatMin <= 1 && 1 <= card.heatMax)
  .map((card) => card.cardId)
  .sort();
/** A3/A4a 的 KEEP 浅题（203/205/227/229）必须仍在这个集合里（防「集合换了一批卡还照样绿」）。 */
const H1_KEEP_IDS = ["PN-TRUTH-203", "PN-TRUTH-205", "PN-TRUTH-227", "PN-TRUTH-229"];

describe("B6① 口径 B（当前真实 UI）不变式：无披露 ⇒ effective 恒 0 / Heat 恒 H1 / 互选窗口 0", () => {
  it("modeA 的 heatAtDraw 全部落在 H1，H2/H3/H4 均为 0", () => {
    expect(UI.heatAtDraw.H1).toBe(UI.totalDraws);
    expect(UI.heatAtDraw.H2 ?? 0).toBe(0);
    expect(UI.heatAtDraw.H3 ?? 0).toBe(0);
    expect(UI.heatAtDraw.H4 ?? 0).toBe(0);
  });

  it("modeA：effective 恒 0、到达 H2/H3/H4 = 0/0/0、互选窗口 0（口径 B 的硬事实）", () => {
    expect(UI.effectivePerSession).toBe(0);
    expect(UI.sessionsReachingH2).toBe(0);
    expect(UI.sessionsReachingH3).toBe(0);
    expect(UI.sessionsReachingH4).toBe(0);
    expect(UI.mutualWindowReached).toBe(0);
  });

  it("口径 B 抽到的 Formal 是 H1 集合的子集（恒 H1 ⇒ 抽不到 heatMin≥2 的卡）", () => {
    expect(UI.formalExposedIds.length).toBeGreaterThan(0);
    for (const id of UI.formalExposedIds) {
      expect(H1_FORMAL_IDS_MC, `口径 B 不应抽到 H1 集合以外的 ${id}`).toContain(id);
    }
  });
});

describe("B6② 口径 A（Engine / 显式 disclosure）：H2 reach > 0 且 effective > 0（不把 A 当 B）", () => {
  it("modeB：到达 H2 的局 > 0，effective/局 > 0（H1 可计数 Formal ≥ H2 门槛，冷启门在 Engine 侧跨得过）", () => {
    expect(ENGINE.sessionsReachingH2).toBeGreaterThan(0);
    expect(ENGINE.effectivePerSession).toBeGreaterThan(0);
  });

  it("modeB 的 heatAtDraw 覆盖多档（确认披露信号真的在推进 Heat，而非恒 H1）", () => {
    const nonH1 = (ENGINE.heatAtDraw.H2 ?? 0) + (ENGINE.heatAtDraw.H3 ?? 0) + (ENGINE.heatAtDraw.H4 ?? 0);
    expect(nonH1).toBeGreaterThan(0);
    expect(sumHeat(ENGINE.heatAtDraw)).toBe(ENGINE.totalDraws);
  });
});

describe("B6③ A/B 关键数值不混用：报告两章数字分别等于 MC 的 modeB / modeA", () => {
  it("口径 A 章（§1.2）出现 modeB 的 H2 到达率", () => {
    expect(REPORT).toContain(`| H2 到达率（到达 H2 的 seed 局比例） | ${ENGINE.sessionsReachingH2}/${ENGINE.sessions}`);
    expect(REPORT).toContain(`| 跑满 20 轮 | ${ENGINE.sessionsCompleted20}（`);
    expect(REPORT).toContain(`| 到达 H2 / H3 / H4 局数 | ${ENGINE.sessionsReachingH2} / ${ENGINE.sessionsReachingH3} / ${ENGINE.sessionsReachingH4} |`);
  });

  it("口径 B 章（§2）锁定 effective 恒 0、heatAtDraw 恒 H1、到达 0/0/0", () => {
    expect(REPORT).toContain(`- effective count **恒 ${UI.effectivePerSession}**`);
    expect(REPORT).toContain(`heatAtDraw H1 ${UI.totalDraws} / H2 0 / H3 0 / H4 0`);
    expect(REPORT).toContain(`到达 H2/H3/H4 = ${UI.sessionsReachingH2}/${UI.sessionsReachingH3}/${UI.sessionsReachingH4}`);
    // 口径 B 的 wording 必须仍是「恒 H1 / amount 0」，不得写成 A 的推进结论
    expect(REPORT).toMatch(/Heat 恒 H1/);
  });
});

describe("B6④ heatMin=1 的 Formal（H1 桶可抽）集合与产物、报告逐字一致", () => {
  it("独立复算 === MC.staticHeatAvailability.H1.formalLegalIds === MC.h1Formal.ids", () => {
    expect(independentlyDerived).toEqual(H1_FORMAL_IDS_MC);
    expect(H1_FORMAL_IDS_H1FIELD).toEqual(H1_FORMAL_IDS_MC);
    expect(mc.h1Formal.count).toBe(H1_FORMAL_COUNT);
  });

  it("该集合 === Formal 里 heatMin=1<=heatMax 的卡（逐 id 由内容源派生）——与内容侧护栏同源", () => {
    expect(H1_FORMAL_IDS_MC).toEqual(h1Expected);
    expect(H1_FORMAL_IDS_MC.length).toBeGreaterThan(0);
    for (const id of H1_KEEP_IDS) expect(H1_FORMAL_IDS_MC, `${id}（KEEP 浅题）应仍在 H1 集合里`).toContain(id);
    expect(mc.formalCountableUpTo.heatMinLe1).toBe(H1_FORMAL_COUNT);
    // 该集合由 manifest 真源 ∩ 卡源 heatMin/heatMax 派生（不写死张数）。
    for (const id of H1_FORMAL_IDS_MC) expect(formalFixedIdSet().has(id), `${id} 应为 Formal`).toBe(true);
  });

  it("报告印出的张数与清单 === 产物（防报告引用过期数字）", () => {
    expect(reportClaimedCount).toBe(H1_FORMAL_COUNT);
    expect(reportClaimedIds).toEqual(H1_FORMAL_IDS_MC);
  });
});

describe("B6⑤ 报告不得含与实测数据矛盾的硬编码结论（旧口径字符串 + 缺/不缺现判）", () => {
  it("清除旧口径字符串：不再出现「仅 Formal 24 张 / 仅 Formal 31 张 / 缺口 - / 库存 = 0（实践不可抽）」", () => {
    expect(REPORT).not.toContain("仅 Formal 24 张");
    expect(REPORT).not.toContain("仅 Formal 31 张");
    expect(REPORT).not.toMatch(/缺口\s*-\d+/);
    expect(REPORT).not.toContain("库存 = 0（实践不可抽）");
  });

  it("H1 可计数 ≥ H2 门槛 ⇒ 不得再声称「Heat 也离不开 H1」（库存门结论须与数据一致）", () => {
    if (H1_FORMAL_COUNT >= H2_MIN) {
      expect(REPORT).not.toContain("Heat **也离不开 H1**");
      expect(REPORT).toContain("H1→H2 冷启门：库存侧已解除");
    }
  });

  it("H1 卡强度构成非全 I1 时，不得再声称「全为 intensity=1」", () => {
    const keys = Object.keys(mc.h1Formal.byIntensity);
    const allI1 = keys.length === 1 && keys[0] === "1";
    if (!allI1) {
      expect(REPORT).not.toContain("张 H1 Formal 全为");
      expect(REPORT).toContain("强度构成已非全 I1");
    }
  });

  it("报告的生产链表「仅 Formal」行张数 === MC 的 formalTotal，且终态 Heat === 链产物实测", () => {
    const fo = chain.scenarioFormalOnly as {
      finalHeat: string;
      finalEffective: number;
      firstReachRoundByHeat: Record<string, number | null>;
    };
    expect(REPORT).toContain(`| 仅 Formal ${mc.cardSource.formalTotal} 张 |`);
    // 终态行的 Heat / effective 两格必须与链产物实测逐字一致。
    expect(REPORT).toContain(`| ${fo.finalHeat} | ${fo.finalEffective} |`);
    // 终态 Heat 一律由实测的逐档首达派生（不写死档位：A3 中间态到 H2，A9 准入后可达更高档）。
    const reached = HEAT_ORDER.filter((heat) => (fo.firstReachRoundByHeat[heat] ?? null) !== null);
    expect(reached.length, "formalOnly 至少到达 H1").toBeGreaterThan(0);
    expect(fo.finalHeat).toBe(reached.at(-1));
    expect(fo.finalEffective).toBeGreaterThan(0);
  });

  it("MC 产物自身的说明文字也不含过期卡段（readingGuide 不得再写 PN-TRUTH-201~224）", () => {
    expect(String(mc.readingGuide)).not.toContain("201~224");
  });
});
