/**
 * C1-3｜CONTENT-01 第一包正式内容接入运行时管线（桥接 + 质量侧车 + manifest）。
 *
 * 锁死四件事（对应派工单「必须补的测试」）：
 * ① **桥接追加**：运行时正式内容源（KEEP 5 ＋ A9 重构批 52，`PN-TRUTH-203/205/209/227/229` ＋ `232~283`）
 *    进入 `mainlineSsotCards()` 的**末尾**，首卡与既有 SSOT
 *    相对顺序逐字不变（`[0]` 稳定 ⇒ 既有取卡顺序语义不变）；
 * ② **质量字段真正到达**：8 项必填质量字段（+ `secondaryTopics`）逐张逐项可读，
 *    且值与内容源 `formal-truth-pack.ts` **逐字一致**；§7.2 质量侧车对新卡给出真实档位；
 * ③ **fail-closed 守住**：缺必填质量字段的新卡不得计入 `audited`（缺全部 = legacy 降级；
 *    半填 = 构建直接抛错，更强），不得产生 `informationGain` / `topic`，不得被标 `reviewed`；
 * ④ **真实生产链**：第一包卡**不注入任何 override**，走 `startRound → resolveRoundAndReduce`
 *    也能成为「有效信息轮」（证明新卡真正进入出卡与质量判定，不是只写进文件）。
 *
 * 纪律：本文件只读真源 + 走生产链，不改任何 SSOT / 生成产物 / 认识阈值 / 窗口 / Heat 契约；
 * 不对 `relationshipState` / `recognitionEvidence` / count 直接赋值。
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { DEFAULT_BOUNDARIES } from "@/lib/domain/constants";
import type { GameCard, Player, SessionConfig } from "@/lib/domain/schemas";
import { createSession, resolveRoundAndReduce, roundDisclosureSignal, startRound } from "@/lib/engine/session-engine";
import { relationshipOf } from "@/lib/engine/v2-deal";
import { FIXED_CONTENT_MANIFEST, type FixedHumanBarFit } from "@/lib/v2-content/fixed-content-manifest";
import {
  EMPTY_HUMAN_FIXED_REVIEW,
  buildFixedContentTracks,
  type BuildFixedContentManifestOptions,
} from "@/lib/v2-content/fixed-content-manifest-build";
import { FORMAL_TRUTH_BOOTSTRAP_CARDS } from "@/lib/v2-content/formal-truth-bootstrap-pack";
import { FORMAL_TRUTH_CARDS } from "@/lib/v2-content/formal-truth-pack";
import { PACK1_ADMISSION_CARD_IDS } from "@/lib/v2-content/pack1-admission";
import { mainlineSsotCards, mainlineSsotCardsByPack } from "@/lib/v2-content/v2-card-bridge";
import { validateFixedCardMetadataStrict } from "@/lib/v2-content/v2-card-metadata";
import { metadataForCard, qualityIndexSize } from "@/lib/v2-content/v2-card-quality-index";
import { getV2ContentAdapter } from "@/lib/v2-content/v2-content-adapter";

const FORMAL_IDS = FORMAL_TRUTH_CARDS.map((card) => card.cardId);
/** R2｜Truth H1 Bootstrap（同样追加在末尾）；**已过两轮独立审查并入库 ⇒ 已是 Formal**。 */
const BOOTSTRAP_IDS = FORMAL_TRUTH_BOOTSTRAP_CARDS.map((card) => card.cardId);
/** A9｜第一包重构批 52 张（`PN-TRUTH-232~283`，经准入后同为 Formal），同样追加在末尾。 */
const PACK1_IDS = PACK1_ADMISSION_CARD_IDS;

/**
 * 独立审查输入真源（只读）：`reviewed` / `humanBarFit` 的唯一合法来源，与构建脚本同源。
 * 本文件只用它**派生期望值**，绝不修改它。
 */
const HUMAN_REVIEW_PATH = "docs/qa/content-audit-v2/BAR-FIT-HUMAN-REVIEW.json";
interface HumanReviewFile {
  source: string;
  reviewedAt: string;
  /** 独立 reviewer 身份（Change C）：真人 `human` / AI 角色 `ai-role`。 */
  reviewerKind: string;
  entries: Record<string, { reviewed: boolean; humanBarFit: FixedHumanBarFit }>;
}
const loadHumanReviewFile = (): HumanReviewFile =>
  JSON.parse(readFileSync(join(process.cwd(), HUMAN_REVIEW_PATH), "utf8")) as HumanReviewFile;

/** 转发到运行期 `GameCard` 侧车的字段（Plan §3：8 项必填 + 可选 `secondaryTopics`）。 */
const QUALITY_FIELDS = [
  "topic",
  "barFit",
  "informationGain",
  "informationGoal",
  "socialEnergy",
  "relationshipProgression",
  "intimacyClass",
  "informationGoalType",
  "secondaryTopics",
] as const;

const asRecord = (value: object): Record<string, unknown> =>
  value as unknown as Record<string, unknown>;

/* ------------------------------------------------------------------ */
/* ① 桥接追加（[0] 稳定，不改既有顺序）                                     */
/* ------------------------------------------------------------------ */

describe("C1-3① 桥接追加：第一包卡进主线池，既有取卡顺序不变", () => {
  it("mainlineSsotCards 末尾按序追加运行时正式内容源（第一包 ＋ Bootstrap ＋ A9 重构批）；首卡与既有 SSOT 顺序逐字不变", () => {
    const ssotIds = getV2ContentAdapter().mainlineCards.map((card) => card.cardId);
    const cards = mainlineSsotCards();

    expect(cards).toHaveLength(ssotIds.length + FORMAL_IDS.length + BOOTSTRAP_IDS.length + PACK1_IDS.length);
    // ① 前 350 张＝SSOT 原序（不前置、不重排）。
    expect(cards.slice(0, ssotIds.length).map((card) => card.id)).toEqual(ssotIds);
    // ② 末段＝第一包 ＋ R2 Bootstrap ＋ A9 重构批（三段各自原序）。
    expect(cards.slice(ssotIds.length).map((card) => card.id)).toEqual([
      ...FORMAL_IDS,
      ...BOOTSTRAP_IDS,
      ...PACK1_IDS,
    ]);

    // ③ `[0]` 稳定：既有 E2E / 快照轨断言依赖的「首卡」不变。
    expect(cards[0]!.id).toBe("PN-TRUTH-001");
    expect(mainlineSsotCardsByPack("truth-dare")[0]!.id).toBe("PN-TRUTH-001");
    // A4a：运行时只有 KEEP 5；退役卡（如 201）不在任何运行时卡池/manifest 轨内。
    expect(FIXED_CONTENT_MANIFEST.tracks.legacyCompatibility.allowedCardIds).toContain("PN-TRUTH-203");
    expect(FIXED_CONTENT_MANIFEST.tracks.legacyCompatibility.allowedCardIds).not.toContain("PN-TRUTH-201");
  });
});

/* ------------------------------------------------------------------ */
/* ② 质量字段逐项到达 GameCard 侧车 + §7.2 侧车                            */
/* ------------------------------------------------------------------ */

describe("C1-3② 质量字段逐项可读（值与内容文件一致）", () => {
  it("8 项必填 + secondaryTopics 逐张逐项 === 内容源", () => {
    const byId = new Map(mainlineSsotCards().map((card) => [card.id, asRecord(card)]));
    for (const source of FORMAL_TRUTH_CARDS) {
      const card = byId.get(source.cardId);
      expect(card, source.cardId).toBeDefined();
      for (const field of QUALITY_FIELDS) {
        expect(card![field], `${source.cardId}.${field}`).toEqual(asRecord(source)[field]);
      }
      // 题面与卡面说明也经同一条桥接路径到运行期。
      expect(card!["content"]).toBe(source.text);
      expect(card!["instruction"]).toBe("不愿意可无惩罚跳过");
    }
  });

  it("§7.2 质量侧车：新卡给出真实档位；旧 SSOT 卡仍为未补标（双 null）", () => {
    for (const source of FORMAL_TRUTH_CARDS) {
      expect(metadataForCard(source.cardId), source.cardId).toEqual({
        informationGain: source.informationGain,
        topic: source.topic,
      });
    }
    expect(qualityIndexSize()).toBeGreaterThanOrEqual(FORMAL_TRUTH_CARDS.length);
    // 未补标的旧卡 / 未知卡恒定 fail-closed（不给默认档）。
    expect(metadataForCard("PN-TRUTH-001")).toEqual({ informationGain: null, topic: null });
    expect(metadataForCard("NOT-IN-INDEX")).toEqual({ informationGain: null, topic: null });
  });
});

/* ------------------------------------------------------------------ */
/* ③ fail-closed：缺字段不得计入 audited / 不得产生档位 / 不得标 reviewed      */
/* ------------------------------------------------------------------ */

describe("C1-3③ fail-closed 守住", () => {
  const adapter = getV2ContentAdapter();
  const options: BuildFixedContentManifestOptions = {
    batchId: "V1.3-frozen-fixed-content",
    contentVersion: `content-v${adapter.provenance.mainline.schemaVersion}`,
    generatedBy: "tests/unit/formal-truth-pipeline.test.ts",
    source: adapter.provenance.mainline.memberPath,
    ssotMainlineSha256: adapter.provenance.mainline.sha256,
    ssotExpansionSha256: adapter.provenance.expansion.sha256,
    ssotSchemaVersion: adapter.provenance.mainline.schemaVersion,
  };

  /** 无任何质量字段的裸 builtin 卡。 */
  const bareCard = (id: string): GameCard => ({
    id,
    packId: "truth-dare",
    type: "truth",
    content: "说一件今天的小事",
    intensity: 1,
    tags: [],
    boundaryTags: [],
    minPlayers: 2,
    participantMode: "all",
    source: "builtin",
  });

  it("带齐 8 项 → audited（但无独立审查仍进不了 Formal）；缺全部 → legacy；半填 → 构建抛错", () => {
    // ① 真正带齐质量字段的 KEEP 卡（203）≡ audited。
    const auditedCard = mainlineSsotCards().find((card) => card.id === "PN-TRUTH-203")!;
    expect(validateFixedCardMetadataStrict(auditedCard).ok).toBe(true);
    const auditedBuild = buildFixedContentTracks([auditedCard], options);
    expect(auditedBuild.manifest.tracks.legacyCompatibility.provenance["PN-TRUTH-203"]).toMatchObject({
      metadataStatus: "audited",
      reviewed: false,
      humanBarFit: "UNREVIEWED",
    });
    // 补了 metadata 也不进 Formal（Formal 准入四条含独立审查）。
    expect(auditedBuild.formalCount).toBe(0);

    // ② 完全缺质量字段 → legacy 降级（旧卡兼容读取），不进 audited。
    const legacyBuild = buildFixedContentTracks([bareCard("PN-TRUTH-901")], options);
    expect(legacyBuild.manifest.tracks.legacyCompatibility.provenance["PN-TRUTH-901"]).toMatchObject({
      metadataStatus: "legacy",
      reviewed: false,
      humanBarFit: "UNREVIEWED",
    });
    expect(legacyBuild.auditedCount).toBe(0);

    // ③ 半填（缺任一必填）→ **构建直接抛错**，比 legacy 降级更强：绝不让半成品 metadata 静默混入。
    const partial = asRecord({ ...bareCard("PN-TRUTH-902"), topic: "恋爱观" }) as GameCard;
    expect(validateFixedCardMetadataStrict(partial).ok).toBe(false);
    expect(() => buildFixedContentTracks([partial], options)).toThrow(/入库门禁失败/);
  });

  it("缺字段的卡不产生 informationGain / topic；metadata 齐全本身不产生 reviewed（空独立审查重建 + 产物⇄独立审查双向对账）", () => {
    // 侧车：无档位可言 ⇒ 双 null（fail-closed 的输入侧表达）。
    expect(metadataForCard("PN-TRUTH-901")).toEqual({ informationGain: null, topic: null });
    // 真实产物：旧卡（未补标）legacyMetadata；运行时正式内容源（第一包 ＋ Bootstrap ＋ A9 重构批）audited——两数按内容源派生，不写死。
    const legacy = FIXED_CONTENT_MANIFEST.tracks.legacyCompatibility;
    const formalSourceCount = FORMAL_TRUTH_CARDS.length + FORMAL_TRUTH_BOOTSTRAP_CARDS.length + PACK1_IDS.length;
    expect(legacy.counts.auditedMetadata).toBe(formalSourceCount);
    expect(legacy.counts.legacyMetadata).toBe(legacy.counts.total - formalSourceCount);
    // 旧卡无独立审查 ⇒ reviewed 必须为 false。
    expect(legacy.provenance["PN-TRUTH-001"]!.reviewed).toBe(false);

    // 关键 fail-closed①：**metadata 齐全本身不产生 reviewed**——用空人工输入重建带齐质量字段的
    // PN-TRUTH-203，仍必须 reviewed=false / humanBarFit=UNREVIEWED，且 formalCount=0。
    const auditedCard = mainlineSsotCards().find((card) => card.id === "PN-TRUTH-203")!;
    const rebuilt = buildFixedContentTracks([auditedCard], options, EMPTY_HUMAN_FIXED_REVIEW);
    expect(rebuilt.manifest.tracks.legacyCompatibility.provenance["PN-TRUTH-203"]).toMatchObject({
      metadataStatus: "audited",
      reviewed: false,
      humanBarFit: "UNREVIEWED",
    });
    expect(rebuilt.formalCount).toBe(0);

    // 关键 fail-closed②：产物 `reviewed=true` ⇄ 独立审查输入「有 entry 且 humanBarFit≠UNREVIEWED」，
    // **双向**成立。期望值由独立审查输入派生后与产物逐项比对（非 UNREVIEWED 集合为空时也不空转）。
    const review = loadHumanReviewFile();
    const reviewedInArtifact = legacy.allowedCardIds.filter((id) => legacy.provenance[id]!.reviewed);
    const expectedReviewed = legacy.allowedCardIds.filter((id) => {
      const entry = review.entries[id];
      return entry !== undefined && entry.humanBarFit !== "UNREVIEWED";
    });
    expect(reviewedInArtifact).toEqual(expectedReviewed);
    // 正向逐卡复核：产物 reviewed=true 的卡，独立审查输入里必有 entry 且非 UNREVIEWED。
    for (const id of reviewedInArtifact) {
      const entry = review.entries[id];
      expect(entry, `${id} reviewed=true 但独立审查输入无 entry`).toBeDefined();
      expect(entry!.humanBarFit, id).not.toBe("UNREVIEWED");
    }
    // 反向逐卡复核：产物 reviewed=false 的卡，独立审查输入里不得把它标成非 UNREVIEWED。
    for (const id of legacy.allowedCardIds) {
      if (legacy.provenance[id]!.reviewed) continue;
      const entry = review.entries[id];
      if (entry) expect(entry.humanBarFit, `${id} 独立审查有定档但产物 reviewed=false`).toBe("UNREVIEWED");
    }
  });
});

/* ------------------------------------------------------------------ */
/* ④ 真实生产链：不注入 override，第一包卡也能成为有效信息轮                 */
/* ------------------------------------------------------------------ */

describe("C1-3④ 第一包卡走真实生产链成为有效信息轮", () => {
  it("出卡 → completed + 本人揭晓 → effective count=1，证据档位与卡面一致", () => {
    const card = mainlineSsotCards().find((item) => item.id === "PN-TRUTH-203")!;
    const players: Player[] = ["a", "b"].map((id) => ({
      id,
      displayName: `玩家${id}`,
      active: true,
      createdAt: "x",
      lastUsedAt: "x",
    }));
    const config: SessionConfig = {
      players,
      relationship: "friends",
      vibes: ["funny"],
      intensity: 5,
      boundaries: DEFAULT_BOUNDARIES,
      enabledPackIds: ["truth-dare"],
      mode: "single",
    };
    const participants = [
      { playerId: "a", active: true, pairGender: "male" as const },
      { playerId: "b", active: true, pairGender: "female" as const },
    ];

    const session = createSession(config, [card], participants);
    const drawn = startRound(session, () => 0);
    expect(drawn.currentRound?.cardId).toBe("PN-TRUTH-203");

    const done = resolveRoundAndReduce(
      drawn,
      "complete",
      roundDisclosureSignal({ selfDisclosed: true, disclosedPlayerIds: ["a"] }),
    );
    const relationship = relationshipOf(done);
    // 未注入任何 override：档位完全来自内容文件 → 新卡真正进入了质量判定。
    expect(relationship.relationshipEffectiveCardCount).toBe(1);
    expect(relationship.recognitionEvidence?.[0]).toMatchObject({
      informationGain: "medium",
      topic: "生活方式",
    });
  });
});
