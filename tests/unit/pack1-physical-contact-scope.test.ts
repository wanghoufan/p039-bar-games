/**
 * A9-R6 §13（Plan §3.1）｜身体 / 亲密卡的 `physical-contact`：**不扩大语义**（防误挂机检）。
 *
 * 规则（Human 冻结）：**问偏好 ≠ 要求接触**。
 * - 题面只是问「喜欢哪里被碰 / 拥抱还是牵手更心动 / 哪种亲密动作更加分」⇒ **不挂** exact
 *   `physical-contact`（保留精确规则「题面真实命中才写」）；
 * - 只有**明确要求玩家去抱 / 去摸 / 去亲（Dare/Task 动作题）**才必须挂 `physical-contact` 并允许跳过；
 * - `267` / `269` 的 admission override（`responseMode → private-individual`、`boundaryTags → proximity`
 *   泛安全标签）继续保留——比误挂 exact `physical-contact` 更符合现行 Plan。
 *
 * 本文件把这条规则锁成**正反两面**断言：
 * ① 反（真实卡）：5 张亲密**偏好**卡（242/243/267/268/269）**不得**挂 exact `physical-contact`
 *    （planning 聚合视图与运行时 App 投影两处都查）；
 * ② 正（注册表）：动作型题（明确要求接触）必须挂 `physical-contact`；当前 pack1 **无**此类卡，
 *    用显式空注册表把规则写死（有新动作卡必须登记并挂标签）；
 * ③ 映射正向：exact `physical-contact` 标签在桥接里**确实**映成 App 用户开关（该挂时挂得上）。
 *
 * 只读真源；不改卡、不改准入、不改阈值。
 */

import { describe, expect, it } from "vitest";

import { PACK1_ADMISSION_CARD_BY_ID } from "@/lib/v2-content/pack1-admission";
import { mainlineRuntimeCards, mapSsotBoundaryTags, SSOT_BOUNDARY_TAG_MAP } from "@/lib/v2-content/v2-card-bridge";

/** 亲密**偏好**卡（问偏好 ≠ 要求接触）：不得挂 exact `physical-contact`。 */
const INTIMATE_PREFERENCE_CARDS = [
  "PN-TRUTH-242", // 第一眼，你最容易注意异性的哪里？
  "PN-TRUTH-243", // 对有感觉的人，拥抱还是牵手更让你心动？
  "PN-TRUTH-267", // 亲密里哪样最加分：先问一句、慢一点，还是抱久一点？
  "PN-TRUTH-268", // 喜欢的人碰你哪一下最心动：手、肩，还是头发？
  "PN-TRUTH-269", // 亲密里你更想当主动的那个，还是等对方先？
] as const;

/**
 * 动作型题注册表（明确要求玩家去抱 / 去摸 / 去亲的 Dare/Task）⇒ **必须**挂 `physical-contact`。
 * pack1 现役批次**无**此类卡（全为 disclosure / preference / expression 自述题），故为空；
 * 新增动作卡必须登记在此并挂标签，否则下面的正向断言会红。
 */
const CONTACT_ACTION_CARDS: readonly string[] = [];

describe("A9-R6 §13｜身体/亲密卡 physical-contact：问偏好 ≠ 要求接触（不扩大语义）", () => {
  it("① 反（真实卡）：5 张亲密偏好卡不得挂 exact `physical-contact`（planning 聚合视图）", () => {
    for (const id of INTIMATE_PREFERENCE_CARDS) {
      const card = PACK1_ADMISSION_CARD_BY_ID.get(id);
      expect(card, `${id} 不在聚合视图`).toBeTruthy();
      expect(card!.boundaryTags, `${id} 误挂 exact physical-contact`).not.toContain("physical-contact");
    }
  });

  it("① 反（真实卡）：5 张亲密偏好卡的运行时 App 投影同样不含 `physical-contact`", () => {
    const runtime = new Map(mainlineRuntimeCards().map((card) => [card.cardId, card]));
    for (const id of INTIMATE_PREFERENCE_CARDS) {
      const card = runtime.get(id);
      expect(card, `${id} 不在运行时卡源`).toBeTruthy();
      // 运行时投影的 boundaryTags 已是 App `BoundaryTag[]`（若被误映会出现 physical-contact）。
      expect(card!.boundaryTags, `${id} 运行时误映 physical-contact`).not.toContain("physical-contact");
    }
  });

  it("② 正（注册表）：动作型题必须挂 `physical-contact`；偏好卡不得混入动作注册表", () => {
    for (const id of CONTACT_ACTION_CARDS) {
      const card = PACK1_ADMISSION_CARD_BY_ID.get(id);
      expect(card, `${id}（动作型）不在聚合视图`).toBeTruthy();
      expect(card!.boundaryTags, `${id} 动作型未挂 physical-contact`).toContain("physical-contact");
      // 动作型必须是 dare/task（不是 preference 自述题）。
      expect(["dare"], `${id} 动作型 gameType`).toContain(card!.gameType);
      expect(INTIMATE_PREFERENCE_CARDS, `${id} 同时被登记为偏好卡`).not.toContain(id);
    }
  });

  it("③ 映射正向：exact `physical-contact` 在桥接里确实映成 App 用户开关（该挂时挂得上）", () => {
    expect(SSOT_BOUNDARY_TAG_MAP["physical-contact"]).toBe("physical-contact");
    expect(mapSsotBoundaryTags(["physical-contact"])).toEqual(["physical-contact"]);
    // 泛标签 proximity 不自动等价 physical-contact（Plan §3.1 反例口径）。
    expect(SSOT_BOUNDARY_TAG_MAP.proximity).toBeNull();
    expect(mapSsotBoundaryTags(["proximity"])).toEqual([]);
  });

  it("267 / 269 的 admission override 仍为 private-individual / proximity（不改成 exact 接触标签）", () => {
    for (const id of ["PN-TRUTH-267", "PN-TRUTH-269"] as const) {
      const card = PACK1_ADMISSION_CARD_BY_ID.get(id)!;
      expect(card.responseMode, id).toBe("private-individual");
      expect(card.boundaryTags, id).toContain("proximity");
      expect(card.boundaryTags, id).not.toContain("physical-contact");
    }
  });
});
