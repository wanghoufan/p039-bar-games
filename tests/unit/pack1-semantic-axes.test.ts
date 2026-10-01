/**
 * A8｜「同档不同轴」**语义级判据**的机器门禁（`lib/v2-content/pack1-supplements/pack1-semantic-axes.ts`）。
 *
 * ## 本文件锁死什么（对照派工单 Part 2）
 * ① **签名可派生**：现役全批次全部被 token 规则命中（无 `unclassified`），`axis` 取自闭集；
 * ② **判据可执行且给真数**：`pack1SemanticDuplicatePairs()`（同档同签名）对现役批次的**真实结果**
 *    ＝ **0 对**（A9-R6 退役 `236` 后原残留 `235 vs 236` 消解）⇒ 与 `PACK1_SEMANTIC_RESIDUALS`（空表）**逐项相等**；
 * ③ **非空壳（敏感性）**：把**整改前的历史题面**喂进判据，必须判出真重复 ——
 *    `274-old(跟谁一队)/275-old(跟谁玩一局狼人杀)`、`270-A7(再战/先撤)/278-A7(先溜/等某人)`；
 * ④ **非空壳（特异性）**：整改后的 `274/275-new`、`270-new/278` **不再同签名**；
 * ⑤ **`SHOTS` 降级**：约束①的达成证据**只能是本判据**；`SHOTS`/`AXES` 在 `pack1-supplements` 侧
 *    已标「审计辅助」，不得再当唯一证据（见该测试文件同名断言）；
 * ⑥ **跨档邻接登记**：A9-R6 退役 `263` 后邻接为空（原 `263 vs 278` 消解）。
 */

import { describe, expect, it } from "vitest";

import {
  PACK1_SEMANTIC_AXIS_IDS,
  PACK1_SEMANTIC_AXIS_RULES,
  PACK1_SEMANTIC_HISTORICAL_DUPLICATE_PROBES,
  PACK1_SEMANTIC_PREREQUISITE_NOTE,
  PACK1_SEMANTIC_RESIDUALS,
  PACK1_SEMANTIC_SIGNATURES,
  PACK1_SEMANTIC_ADJACENCY_REGISTRY,
  deriveSemanticAxis,
  deriveSemanticSignature,
  pack1SemanticAdjacentPairs,
  pack1SemanticDuplicatePairs,
  probeSignatures,
  semanticSignatureKey,
} from "@/lib/v2-content/pack1-supplements/pack1-semantic-axes";
import { PACK1_UNION_CARDS } from "@/lib/v2-content/pack1-supplements/pack1-supplement-matrix";

/* ------------------------------------------------------------------ */
/* ① 签名可派生 + 闭集                                                 */
/* ------------------------------------------------------------------ */

describe("A8① 语义签名可派生：全批次全部命中、轴取自闭集", () => {
  it("全批次（现役）签名数量与卡源一致、cardId 一一对应（张数由卡源派生，不写死）", () => {
    expect(PACK1_SEMANTIC_SIGNATURES).toHaveLength(PACK1_UNION_CARDS.length);
    expect(PACK1_SEMANTIC_SIGNATURES.map((sig) => sig.cardId)).toEqual(
      PACK1_UNION_CARDS.map((card) => card.cardId),
    );
  });

  it("无 `unclassified`：每张卡都能被 token 规则命中（判据对全库有效，不是空壳）", () => {
    const unclassified = PACK1_SEMANTIC_SIGNATURES
      .filter((sig) => sig.axis === "unclassified")
      .map((sig) => sig.cardId);
    expect(unclassified, `未分类卡：${unclassified.join(" / ")}`).toEqual([]);
  });

  it("轴值必须落在闭集内、规则表非空且 (轴, token) 结构合法", () => {
    const allowed = new Set<string>(PACK1_SEMANTIC_AXIS_IDS);
    for (const sig of PACK1_SEMANTIC_SIGNATURES) {
      expect(allowed.has(sig.axis), `${sig.cardId} 轴 ${sig.axis} 不在闭集`).toBe(true);
    }
    expect(PACK1_SEMANTIC_AXIS_RULES.length).toBeGreaterThan(0);
    // 泛词黑名单：防止有人往规则里塞「想/喜欢/玩」这类会把任意卡都吸进来的词（防扩义凑数）。
    const GENERIC = new Set(["想", "喜欢", "玩", "要", "来", "去", "会", "你", "我", "他", "谁"]);
    for (const [axis, tokens] of PACK1_SEMANTIC_AXIS_RULES) {
      expect(allowed.has(axis), `规则轴 ${axis} 不在闭集`).toBe(true);
      expect(tokens.length, `轴 ${axis} 没有 token`).toBeGreaterThan(0);
      for (const token of tokens) {
        expect(token.length, `轴 ${axis} 的 token「${token}」为空`).toBeGreaterThanOrEqual(1);
        expect(GENERIC.has(token), `轴 ${axis} 的 token「${token}」是泛词`).toBe(false);
      }
    }
  });

  it("轴是**题面派生的函数**（改题面即改签名）—— 输入敏感，非逐卡手写常表", () => {
    // 同一句话换词即影响轴；证明签名由 `text` 现算，不是卡 ID 查表。
    expect(deriveSemanticAxis("跟谁一队？")).toBe("group_play");
    expect(deriveSemanticAxis("跟谁比一局？")).toBe("duel");
    expect(deriveSemanticAxis("这件事完全没提过的词")).toBe("unclassified");
    // 规则数显著少于卡数（闭集分类，靠复用收敛，不是一卡一标签）。
    expect(PACK1_SEMANTIC_AXIS_RULES.length).toBeLessThan(PACK1_UNION_CARDS.length);
  });
});

/* ------------------------------------------------------------------ */
/* ②③④ 判据的真实结果 + 敏感性 / 特异性                                 */
/* ------------------------------------------------------------------ */

describe("A8②③④ 同档语义重复判据：真实结果 + 非空壳（敏感性/特异性）", () => {
  it("② 现有全批次真实判定结果：同档同签名 **0 对**（A9-R6 退役 236 后残留消解）", () => {
    const pairs = pack1SemanticDuplicatePairs();
    // A9-R6（2026-09-29 内容裁决）：原唯一同档残留 `235 vs 236` 随 236 退役消解 ⇒ 现役批次 0 对。
    expect(pairs).toEqual([]);
  });

  it("②' 判据结果与 PACK1_SEMANTIC_RESIDUALS 逐项相等（残留只能显式登记，不能默默放过）", () => {
    const derived = pack1SemanticDuplicatePairs().map((p) => `${p.a}|${p.b}|${p.heatMin}|${p.signature}`);
    const registered = PACK1_SEMANTIC_RESIDUALS.map((r) => `${r.a}|${r.b}|${r.heatMin}|${r.signature}`);
    expect(derived).toEqual(registered);
    expect(PACK1_SEMANTIC_RESIDUALS).toEqual([]);
  });

  it("②'' 残留只允许落在**冻结批（Golden 12, 232~243）**内 —— 本单批次/新卡不得塞进残留", () => {
    for (const residual of PACK1_SEMANTIC_RESIDUALS) {
      expect(residual.batch).toBe("golden12");
      for (const id of [residual.a, residual.b]) {
        const number = Number(id.replace("PN-TRUTH-", ""));
        expect(number, `${id} 不在 Golden 12 号段（残留只准登记冻结批）`).toBeGreaterThanOrEqual(232);
        expect(number, `${id} 不在 Golden 12 号段（残留只准登记冻结批）`).toBeLessThanOrEqual(243);
      }
    }
    // A9-R6 后残留为空（236 退役）；本断言锁「不会有人偷偷把新批次塞进残留」。
    expect(PACK1_SEMANTIC_RESIDUALS).toEqual([]);
  });

  it("③ 敏感性：整改前历史题面必须判真重复（否则判据是空壳）", () => {
    for (const probe of PACK1_SEMANTIC_HISTORICAL_DUPLICATE_PROBES) {
      const [a, b] = probeSignatures(probe);
      expect(semanticSignatureKey(a), `${probe.label} 未判重复`).toBe(semanticSignatureKey(b));
    }
    // 覆盖第三轮主审点名的两类真重复：同档（274/275）与跨档（270/278）。
    expect(PACK1_SEMANTIC_HISTORICAL_DUPLICATE_PROBES.length).toBe(2);
  });

  it("④ 特异性：整改后不得再同签名（消解到位，不是靠放宽判据过）", () => {
    const sigOf = (id: string) => {
      const sig = PACK1_SEMANTIC_SIGNATURES.find((s) => s.cardId === id);
      expect(sig, id).toBeTruthy();
      return semanticSignatureKey(sig!);
    };
    // 274（组队）vs 275（1v1 单挑）——本单换的动作帧。
    expect(sigOf("PN-TRUTH-274")).not.toBe(sigOf("PN-TRUTH-275"));
    // 270（喝法）vs 278（走留）——本单换的轴。
    expect(sigOf("PN-TRUTH-270")).not.toBe(sigOf("PN-TRUTH-278"));
    // 250（攒劲怎么放）vs 270（喝法）/278（走留）——派工单点名要自查的跨批邻接。
    expect(sigOf("PN-TRUTH-250")).not.toBe(sigOf("PN-TRUTH-270"));
    expect(sigOf("PN-TRUTH-250")).not.toBe(sigOf("PN-TRUTH-278"));
    // 256（搭讪减分）vs 265（剩余时间）——同档同 shape 但轴不同。
    expect(sigOf("PN-TRUTH-256")).not.toBe(sigOf("PN-TRUTH-265"));
    // A9-R6：263（走留）已退役 ⇒ 不再参与现役签名集（其与 278 的邻接随之消解，见 ⑥）。
  });

  it("④' 三维合取：H3「跟谁」簇不会因都问对象被一刀切误杀", () => {
    // 273/274/275/276/279/280/281 都含「跟谁/哪个」，但动作轴不同 ⇒ 两两不同签名。
    const cluster = ["273", "274", "275", "276", "279", "280", "281"].map((n) => `PN-TRUTH-${n}`);
    const keys = cluster.map((id) => semanticSignatureKey(
      PACK1_SEMANTIC_SIGNATURES.find((s) => s.cardId === id)!,
    ));
    expect(new Set(keys).size, `H3 簇签名撞车：${keys.join(" / ")}`).toBe(cluster.length);
  });

  it("⑥ 跨档邻接（只报不判）：A9-R6 退役 263 后为空（派生 == 登记集）", () => {
    const adj = pack1SemanticAdjacentPairs().map((p) => `${p.a}|${p.b}`);
    expect(adj).toEqual(PACK1_SEMANTIC_ADJACENCY_REGISTRY.map(([a, b]) => `${a}|${b}`));
    // A9-R6：原唯一邻接 263 vs 278 随 263 退役消解 ⇒ 现役批次 0 对。
    expect(adj).toEqual([]);
  });

  it("豁免说明：判据是**必要条件**，不是语义不同的充分证明（诚实声明存在且非空）", () => {
    expect(PACK1_SEMANTIC_PREREQUISITE_NOTE.length).toBeGreaterThan(20);
    expect(PACK1_SEMANTIC_PREREQUISITE_NOTE).toContain("必要条件");
    // 派生入口可复算（同样输入恒得同样输出）。
    const a = deriveSemanticSignature(PACK1_UNION_CARDS[0]!);
    const b = deriveSemanticSignature(PACK1_UNION_CARDS[0]!);
    expect(a).toEqual(b);
  });
});
