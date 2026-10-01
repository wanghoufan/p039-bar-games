import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RETIRED_TRUTH_CARD_IDS } from "@/lib/v2-content/archive/retired-truth-pack-2026-09-29";
import { RETIRED_PACK1_R6_CARD_IDS } from "@/lib/v2-content/archive/retired-pack1-r6-2026-09-29";
import { RETIRED_PACK1_R7_CARD_IDS } from "@/lib/v2-content/archive/retired-pack1-r7-2026-09-29";
import { FORMAL_TRUTH_BOOTSTRAP_CARDS } from "@/lib/v2-content/formal-truth-bootstrap-pack";
import { FORMAL_TRUTH_CARDS } from "@/lib/v2-content/formal-truth-pack";
import { FIXED_CONTENT_MANIFEST, formalFixedIdSet } from "@/lib/v2-content/fixed-content-manifest";
import { PACK1_ADMISSION_CARD_IDS } from "@/lib/v2-content/pack1-admission";
import {
  FROZEN_REVIEW_HISTORY_SHA256,
  R3_APPEND_MARK,
  RETIRED_FROM_FORMAL_NOTE,
  RETIRED_FROM_FORMAL_R6_NOTE,
  RETIRED_FROM_FORMAL_R7_NOTE,
  TRUTH_BOOTSTRAP_GROUP,
  TRUTH_FIRST_PACK_GROUP,
  TRUTH_PACK1_ADMISSION_GROUP,
  checkReviewInput,
  reviewHistoryFingerprintInput,
  stripAppendedSuffix,
  tallyVerdicts,
  type ReviewEntry,
  type ReviewHistoryEntry,
  type ReviewInputPayload,
  type ReviewSelfCheckExpectation,
  type VerdictRow,
} from "@/lib/v2-content/bar-fit-review-input";

/**
 * A3/A9｜独立审查输入（`docs/qa/content-audit-v2/BAR-FIT-HUMAN-REVIEW.json`）结构自校验 + Formal 账目。
 *
 * 本文件锁死：
 * ① 逐卡条目数 = 候选总数；② cardId 唯一；③ 每条 `reviewed === (humanBarFit !== "UNREVIEWED")`；
 * ④ 各汇总组求和自洽（且**必须等于由逐卡数据重算的值**，防手填）；
 * ⑤ 历史留痕归档覆盖全部候选，且 `retirement.cardIds` == 活跃 `reviewed=false` 集合；
 * ⑥ **A9 账目**：52 张重构批活跃 `reviewed=true / humanBarFit=PASS`、`note` 载分批构成、
 *    `formalFixed.allowedCardIds` 恰为活跃 PASS 集合（KEEP 5 ＋ 重构批，逐 id 派生）、26 张退役一律不在 Formal。
 *
 * 反例是**构造性**的：篡改一份汇总 / 条目 / 退出登记使其不自洽，自校验必须报错（不报错即本测试变红）。
 */

const REVIEW_PATH = "docs/qa/content-audit-v2/BAR-FIT-HUMAN-REVIEW.json";
const AUDIT_PATH = "docs/qa/content-audit-v2/BAR-FIT-AUDIT.json";

const rawReview = readFileSync(join(process.cwd(), REVIEW_PATH), "utf8");
const review = JSON.parse(rawReview) as ReviewInputPayload;

const audit = JSON.parse(readFileSync(join(process.cwd(), AUDIT_PATH), "utf8")) as {
  sets: { frozenFixed414: { cardCount: number; forensic: boolean; admissionEligible: boolean; rows: VerdictRow[] } };
};
const verdictRows: readonly VerdictRow[] = audit.sets.frozenFixed414.rows;

/** 运行时保留卡（A9-R7 后：第一包 3 + Bootstrap 2 + 现役重构批 48 = 53）。 */
const RUNTIME_PACK_IDS = [
  ...FORMAL_TRUTH_CARDS.map((card) => card.cardId),
  ...FORMAL_TRUTH_BOOTSTRAP_CARDS.map((card) => card.cardId),
  ...PACK1_ADMISSION_CARD_IDS,
];
/**
 * 归档退役卡（逐字归档；不进运行时卡源，但仍是审查输入的账目候选集）：
 * A3 退役 26 ＋ A9-R6 内容裁决退役 3 ＋ A9-R7 内容返工退役 1 = 30。
 */
const ARCHIVED_IDS = [
  ...RETIRED_TRUTH_CARD_IDS,
  ...RETIRED_PACK1_R6_CARD_IDS,
  ...RETIRED_PACK1_R7_CARD_IDS,
].sort();
const RETIRED_R6_SET = new Set<string>(RETIRED_PACK1_R6_CARD_IDS);
const RETIRED_R7_SET = new Set<string>(RETIRED_PACK1_R7_CARD_IDS);
/** 账目候选集 = 运行时 53 ∪ 归档 30 = 83（`PN-TRUTH-201~283`）。 */
const ALL_TRUTH_2XX_IDS = [...RUNTIME_PACK_IDS, ...ARCHIVED_IDS].sort();
const CANDIDATE_IDS = ALL_TRUTH_2XX_IDS;

/** 三个分组（键在 `bar-fit-review-input.ts`）：第一包 3 / Bootstrap 2 / 现役重构批 48。 */
const FIRST_PACK_IDS = FORMAL_TRUTH_CARDS.map((card) => card.cardId);
const BOOTSTRAP_IDS = FORMAL_TRUTH_BOOTSTRAP_CARDS.map((card) => card.cardId);
const PACK1_IDS = PACK1_ADMISSION_CARD_IDS;

/** A3｜Human 冻结的 KEEP 5（保持 Formal）。 */
const KEEP_IDS = ["PN-TRUTH-203", "PN-TRUTH-205", "PN-TRUTH-209", "PN-TRUTH-227", "PN-TRUTH-229"] as const;
/** A9｜活跃 PASS = KEEP 5 ∪ 现役重构批（A9-R6 退役 3 ＋ A9-R7 退役 1 张后 = 53）。 */
const ACTIVE_PASS_IDS = [...KEEP_IDS, ...PACK1_IDS].sort();

const expectation: ReviewSelfCheckExpectation = {
  expectedCardIds: CANDIDATE_IDS,
  firstPackIds: FIRST_PACK_IDS,
  bootstrapIds: BOOTSTRAP_IDS,
  extraGroups: { [TRUTH_PACK1_ADMISSION_GROUP]: PACK1_IDS },
  libraryIds: verdictRows.map((row) => row.cardId),
  verdictRows,
};

const clone = (): ReviewInputPayload => JSON.parse(JSON.stringify(review)) as ReviewInputPayload;
const sha256 = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");

describe("A3/A9｜审查输入结构自校验六条（真产物）", () => {
  it("六条自校验全过（条目数 / cardId 唯一 / reviewed 自洽 / 汇总自洽 / 历史覆盖 / 分组 note 一致）", () => {
    const result = checkReviewInput(review, expectation, rawReview);
    expect(result.violations).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.items.map((item) => item.id)).toEqual([
      "entries-count",
      "card-id-unique",
      "reviewed-consistency",
      "summary-self-consistent",
      "history-coverage",
      "group-note-consistent",
    ]);
    for (const item of result.items) expect(item.ok, `${item.id}: ${item.detail}`).toBe(true);
  });

  it("① 逐卡条目数 = 候选总数；键集恰为「运行时 53 ∪ 归档 30」", () => {
    expect(Object.keys(review.entries)).toHaveLength(CANDIDATE_IDS.length);
    expect(Object.keys(review.entries).sort()).toEqual([...CANDIDATE_IDS].sort());
    // 数量从内容源派生，不写死：运行时（第一包 ＋ Bootstrap ＋ 现役重构批） + 归档（A3 ＋ R6 ＋ R7）= 候选总数。
    expect(CANDIDATE_IDS.length).toBe(RUNTIME_PACK_IDS.length + ARCHIVED_IDS.length);
    expect(RUNTIME_PACK_IDS).toHaveLength(
      FORMAL_TRUTH_CARDS.length + FORMAL_TRUTH_BOOTSTRAP_CARDS.length + PACK1_ADMISSION_CARD_IDS.length,
    );
    expect(ARCHIVED_IDS).toHaveLength(
      RETIRED_TRUTH_CARD_IDS.length + RETIRED_PACK1_R6_CARD_IDS.length + RETIRED_PACK1_R7_CARD_IDS.length,
    );
    expect(ARCHIVED_IDS).toHaveLength(30);
    expect(PACK1_IDS).toHaveLength(PACK1_ADMISSION_CARD_IDS.length);
  });

  it("② cardId 唯一：磁盘原文里每个候选 cardId 键出现且仅出现一次（历史归档用 cardId 字段，不重复占键）", () => {
    for (const id of CANDIDATE_IDS) {
      const pattern = new RegExp(`"${id}"\\s*:`, "g");
      expect(rawReview.match(pattern) ?? [], `${id} 键出现次数`).toHaveLength(1);
    }
    // 顺序：既有 201~231 保持原序，A9 重构批 232~283 按 cardId 升序追加在末尾。
    expect(Object.keys(review.entries)).toEqual(CANDIDATE_IDS);
  });

  it("③ 每条 reviewed === (humanBarFit !== \"UNREVIEWED\")", () => {
    for (const [cardId, entry] of Object.entries(review.entries)) {
      expect(entry.reviewed, cardId).toBe(entry.humanBarFit !== "UNREVIEWED");
    }
  });

  it("④ 各汇总组求和自洽，且数字 == 由逐卡机器档位重算（不是手填）", () => {
    const pack = review.packMachineVerdictSummary;
    for (const [key, group] of Object.entries(pack.groups)) {
      expect(group.total, key).toBe(group.PASS + group.SUSPECT + group.HARD_FAIL_PATTERN);
    }
    // 父级 = 各子组之和
    const sum = Object.values(pack.groups).reduce(
      (acc, group) => ({
        total: acc.total + group.total,
        PASS: acc.PASS + group.PASS,
        SUSPECT: acc.SUSPECT + group.SUSPECT,
        HARD_FAIL_PATTERN: acc.HARD_FAIL_PATTERN + group.HARD_FAIL_PATTERN,
      }),
      { total: 0, PASS: 0, SUSPECT: 0, HARD_FAIL_PATTERN: 0 },
    );
    expect({ total: pack.total, PASS: pack.PASS, SUSPECT: pack.SUSPECT, HARD_FAIL_PATTERN: pack.HARD_FAIL_PATTERN }).toEqual(sum);
    // 每组数字必须等于逐卡重算值（手填一个数字就会被这条抓住）
    for (const [key, ids] of [
      [TRUTH_FIRST_PACK_GROUP, FIRST_PACK_IDS],
      [TRUTH_BOOTSTRAP_GROUP, BOOTSTRAP_IDS],
      [TRUTH_PACK1_ADMISSION_GROUP, PACK1_IDS],
    ] as const) {
      expect(tallyVerdicts(verdictRows, ids), key).toEqual({
        total: pack.groups[key]!.total,
        PASS: pack.groups[key]!.PASS,
        SUSPECT: pack.groups[key]!.SUSPECT,
        HARD_FAIL_PATTERN: pack.groups[key]!.HARD_FAIL_PATTERN,
      });
    }
    // 三个分组键恰为固定集合（不多不少）
    expect(Object.keys(pack.groups).sort()).toEqual(
      [TRUTH_FIRST_PACK_GROUP, TRUTH_BOOTSTRAP_GROUP, TRUTH_PACK1_ADMISSION_GROUP].sort(),
    );
    // library 组 = 整库 canonical 全量，数字同样来自逐卡重算
    expect(review.libraryMachineVerdictSummary.total).toBe(verdictRows.length);
    expect(review.libraryMachineVerdictSummary.total).toBe(audit.sets.frozenFixed414.cardCount);
    expect(tallyVerdicts(verdictRows, expectation.libraryIds)).toEqual({
      total: review.libraryMachineVerdictSummary.total,
      PASS: review.libraryMachineVerdictSummary.PASS,
      SUSPECT: review.libraryMachineVerdictSummary.SUSPECT,
      HARD_FAIL_PATTERN: review.libraryMachineVerdictSummary.HARD_FAIL_PATTERN,
    });
    // 两个自洽对象（pack / library）各留一个独立 total，禁止拍平成一个求和对象
    expect(review.packMachineVerdictSummary.total).not.toBe(review.libraryMachineVerdictSummary.total);
  });
});

describe("A9｜活跃状态：KEEP 5 ＋ 现役重构批保持 Formal，退役（A3 26 ＋ A9-R6 3）退出", () => {
  it("active reviewed=true / humanBarFit=PASS 恰为 ACTIVE_PASS_IDS（KEEP 5 ＋ 现役重构批，逐张）", () => {
    const active = Object.entries(review.entries)
      .filter(([, entry]) => entry.reviewed)
      .map(([cardId]) => cardId)
      .sort();
    expect(active).toEqual(ACTIVE_PASS_IDS);
    for (const id of ACTIVE_PASS_IDS) {
      expect(review.entries[id]!.humanBarFit, id).toBe("PASS");
      expect(review.entries[id]!.reviewed, id).toBe(true);
    }
  });

  it("现役重构批 active entry 的 note 载内容主审轮次 / 审计来源 / 分批构成与 ID 清单", () => {
    const batches: ReadonlyArray<[string, readonly string[]]> = [
      ["Golden 12", PACK1_IDS.filter((id) => Number(id.slice("PN-TRUTH-".length)) <= 243)],
      ["REWRITE 7", PACK1_IDS.filter((id) => Number(id.slice("PN-TRUTH-".length)) >= 244 && Number(id.slice("PN-TRUTH-".length)) <= 250)],
      ["REPLACE 19", PACK1_IDS.filter((id) => Number(id.slice("PN-TRUTH-".length)) >= 251 && Number(id.slice("PN-TRUTH-".length)) <= 269)],
      ["补卡 14", PACK1_IDS.filter((id) => Number(id.slice("PN-TRUTH-".length)) >= 270)],
    ];
    for (const id of PACK1_IDS) {
      const note = review.entries[id]!.note;
      expect(note, `${id} 主审轮次`).toContain("Round-1");
      expect(note, `${id} 主审轮次`).toContain("Round-3");
      expect(note, `${id} 返工`).toContain("A4b~A8");
      expect(note, `${id} 审计来源`).toContain("temp/BAR-AUDIT-PACK1-31.md");
      expect(note, `${id} 202/225 改判`).toContain("202/225");
      for (const [label, ids] of batches) {
        expect(note, `${id} 分批标签 ${label}`).toContain(label);
        for (const batchId of ids) expect(note, `${id} 缺 ID ${batchId}`).toContain(batchId);
      }
    }
    // 抽样展示一张完整 note（编号 267，含 admission 待收字段落地说明的来源）
    expect(review.entries["PN-TRUTH-267"]!.note.length).toBeGreaterThan(200);
  });

  it("30 张（A3 26 ＋ A9-R6 3 ＋ A9-R7 1）一律 UNREVIEWED / reviewed=false，note 写明退出事实", () => {
    const retired = CANDIDATE_IDS.filter((id) => !ACTIVE_PASS_IDS.includes(id));
    expect(retired).toHaveLength(30);
    for (const id of retired) {
      const entry = review.entries[id]!;
      expect(entry.humanBarFit, id).toBe("UNREVIEWED");
      expect(entry.reviewed, id).toBe(false);
      // A9-R6/R7 退役卡用各自的专门退出说明；A3 退役 26 张用 A3 说明。
      expect(entry.note, id).toBe(
        RETIRED_R6_SET.has(id)
          ? RETIRED_FROM_FORMAL_R6_NOTE
          : RETIRED_R7_SET.has(id)
            ? RETIRED_FROM_FORMAL_R7_NOTE
            : RETIRED_FROM_FORMAL_NOTE,
      );
      expect(entry.note, id).toContain("已退出");
    }
    expect(retired.sort()).toEqual([...ARCHIVED_IDS].sort());
  });

  it("retirement 登记 == 活跃 reviewed=false 集合（派生核对，非手填）", () => {
    const retired = CANDIDATE_IDS.filter((id) => !ACTIVE_PASS_IDS.includes(id)).sort();
    expect([...review.retirement.cardIds].sort()).toEqual(retired);
    expect(review.retirement.retiredAt).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    expect(review.retirement.reason).toContain("KEEP 5");
  });

  it("reviewerKind 保持合法值 ai-role（身份如实，不冒充 human；不参与准入判定）", () => {
    expect(review.reviewerKind).toBe("ai-role");
    expect(review.source).toContain("A3 状态推进");
    expect(review.source).toContain("A9 admission");
    expect(review.source).toContain("Round-1/2/3");
    expect(review.reviewedAt).toContain("A9 追加");
    // 产物 buildInfo 也如实带身份，且与输入一致
    expect(FIXED_CONTENT_MANIFEST.buildInfo.reviewerKind).toBe("ai-role");
    expect(FIXED_CONTENT_MANIFEST.buildInfo.reviewerKind).toBe(review.reviewerKind);
    expect(FIXED_CONTENT_MANIFEST.buildInfo.humanReviewSource).toBe(review.source);
  });
});

describe("A3｜历史留痕未删除（归档 + 指纹锁定）", () => {
  it("history 恰好覆盖全部候选（每卡一条），cardId 不重复", () => {
    const ids = review.history.map((entry) => entry.cardId);
    expect(ids).toHaveLength(CANDIDATE_IDS.length);
    expect([...ids].sort()).toEqual([...CANDIDATE_IDS].sort());
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("31 张旧候选的历史留痕指纹 === 冻结常量（退出 Formal 只改活跃 entries，历史一字未改）", () => {
    const legacyIds = [...RETIRED_TRUTH_CARD_IDS, ...KEEP_IDS].sort();
    const fingerprint = sha256(reviewHistoryFingerprintInput(review.history, legacyIds));
    expect(fingerprint).toBe(FROZEN_REVIEW_HISTORY_SHA256);
  });

  it("归档卡（A3 26 ＋ A9-R6 3 ＋ A9-R7 1）的历史结论逐字保留（原独立审查 PASS 结论与 note 未删除）", () => {
    const byId = new Map<string, ReviewHistoryEntry>(review.history.map((entry) => [entry.cardId, entry]));
    for (const id of ARCHIVED_IDS) {
      const historical = byId.get(id)!;
      expect(historical.humanBarFit, `${id} 历史定档`).toBe("PASS");
      expect(historical.reviewed, `${id} 历史 reviewed`).toBe(true);
      expect(historical.note.length, `${id} 历史 note 必须保留`).toBeGreaterThan(20);
      // 活跃 note 已换成退出说明 ⇒ 历史结论只能从归档读到（证明确实「没删、只是迁走」）。
      expect(historical.note, id).not.toBe(RETIRED_FROM_FORMAL_NOTE);
      expect(historical.note, id).not.toBe(RETIRED_FROM_FORMAL_R6_NOTE);
      expect(historical.note, id).not.toBe(RETIRED_FROM_FORMAL_R7_NOTE);
    }
    expect(byId.get("PN-TRUTH-216")!.note).toContain("已标 ex-partner 雷区标签");
    expect(byId.get("PN-TRUTH-226")!.note).toContain("BORDERLINE 升 PASS");
    // A9-R6：236/263/277 的历史 note = 其 A9 admission 结论（未因退役被改写）。
    for (const id of RETIRED_PACK1_R6_CARD_IDS) {
      expect(byId.get(id)!.note, `${id} 历史 note`).toContain("A9 admission");
    }
    // A9-R7：249 的历史 note 同样 = 其 A9 admission 结论（未因退役被改写）。
    for (const id of RETIRED_PACK1_R7_CARD_IDS) {
      expect(byId.get(id)!.note, `${id} 历史 note`).toContain("A9 admission");
    }
  });

  it("KEEP 5：205/209/227/229 活跃 note === history 同卡 note；203 活跃 note 已按 A9-R8 随新题面重写（history 旧结论仍逐字保留）", () => {
    const byId = new Map<string, ReviewHistoryEntry>(review.history.map((entry) => [entry.cardId, entry]));
    // A9-R8 起仅 203 有 KEEP_NOTE_OVERRIDES 覆盖；其余 KEEP 4 张仍逐字保留。
    for (const id of KEEP_IDS) {
      if (id === "PN-TRUTH-203") continue;
      expect(review.entries[id]!.note, id).toBe(byId.get(id)!.note);
    }
    expect(byId.get("PN-TRUTH-209")!.note).toContain("说一个具体行为");
    // 203：活跃 note 与改写后新题面同源 + 如实说明改写历史与机器误报复核（两层说真话）。
    const active203 = review.entries["PN-TRUTH-203"]!;
    expect(active203.humanBarFit).toBe("PASS");
    expect(active203.note).toContain("睡前的最后半小时，你是刷手机，还是直接躺平？");
    expect(active203.note).toContain("封闭二选一");
    expect(active203.note).toContain("已退役");
    expect(active203.note).toContain("history 归档");
    expect(active203.note).toContain("误报");
    expect(active203.note).toContain("RESEARCH_REVIEW-PACK1-FINAL-53");
    // 203 的 history 归档仍是针对旧题面的原结论（未被改写，指纹锁覆盖）。
    expect(byId.get("PN-TRUTH-203")!.note).toContain("固定的一段安排");
  });

  it("R3/A9 追加语幂等：source / reviewedAt / note 里的标记各出现且仅出现一次（重跑不叠字）", () => {
    for (const [field, text] of [
      ["source", review.source],
      ["reviewedAt", review.reviewedAt],
      ["note", review.note],
    ] as const) {
      expect(text.split(R3_APPEND_MARK).length - 1, field).toBe(1);
      expect(stripAppendedSuffix(text), field).not.toContain(R3_APPEND_MARK);
    }
    const doubled = `${stripAppendedSuffix(review.source)} ｜ 【${R3_APPEND_MARK}】旧追加段 ｜ 【${R3_APPEND_MARK}】新追加段`;
    expect(stripAppendedSuffix(doubled)).toBe(stripAppendedSuffix(review.source));
    expect(stripAppendedSuffix(stripAppendedSuffix(doubled))).toBe(stripAppendedSuffix(review.source));
  });
});

describe("A9｜Formal Fixed 清单恰好 = KEEP 5 ＋ 现役重构批（由审查输入 + 内容源派生）", () => {
  it("formalFixed.allowedCardIds 逐张 == 活跃 PASS 集合（KEEP 5 ＋ 现役重构批，由审查输入 + 内容源派生）", () => {
    expect([...FIXED_CONTENT_MANIFEST.tracks.formalFixed.allowedCardIds].sort()).toEqual(ACTIVE_PASS_IDS);
    expect([...formalFixedIdSet()].sort()).toEqual(ACTIVE_PASS_IDS);
    // 张数由活跃 PASS 集合派生（不写死数字）。
    expect(FIXED_CONTENT_MANIFEST.tracks.formalFixed.counts.total).toBe(ACTIVE_PASS_IDS.length);
  });

  it("退役者（A3 26 ＋ A9-R6 3 ＋ A9-R7 1）一律不在 formalFixed.allowedCardIds（逐张）", () => {
    const formal = new Set(FIXED_CONTENT_MANIFEST.tracks.formalFixed.allowedCardIds);
    for (const id of ARCHIVED_IDS) expect(formal.has(id), `${id} 不得在 Formal 清单内`).toBe(false);
    // A9-R6 退判 3 张明确不在 Formal。
    for (const id of RETIRED_PACK1_R6_CARD_IDS) {
      expect(formal.has(id), `${id}（R6 退役）不得在 Formal 清单内`).toBe(false);
    }
    // A9-R7 退判 1 张（249）明确不在 Formal。
    for (const id of RETIRED_PACK1_R7_CARD_IDS) {
      expect(formal.has(id), `${id}（R7 退役）不得在 Formal 清单内`).toBe(false);
    }
  });
});

describe("A3/A9｜构造性反例：篡改使其不自洽 ⇒ 自校验必须变红", () => {
  it("篡改 library 汇总（total+1）⇒ summary-self-consistent 失败", () => {
    const tampered = clone();
    tampered.libraryMachineVerdictSummary = {
      ...tampered.libraryMachineVerdictSummary,
      total: tampered.libraryMachineVerdictSummary.total + 1,
    };
    const result = checkReviewInput(tampered, expectation, JSON.stringify(tampered));
    expect(result.ok).toBe(false);
    expect(result.violations.join("\n")).toContain("summary-self-consistent");
  });

  it("篡改某分组数字（truthBootstrap.SUSPECT+1，total 不变）⇒ 与逐卡重算不符", () => {
    const tampered = clone();
    const group = tampered.packMachineVerdictSummary.groups[TRUTH_BOOTSTRAP_GROUP]!;
    tampered.packMachineVerdictSummary.groups = {
      ...tampered.packMachineVerdictSummary.groups,
      [TRUTH_BOOTSTRAP_GROUP]: { ...group, PASS: group.PASS - 1, SUSPECT: group.SUSPECT + 1 },
    };
    const result = checkReviewInput(tampered, expectation, JSON.stringify(tampered));
    expect(result.ok).toBe(false);
    expect(result.violations.join("\n")).toContain("truthBootstrap");
  });

  it("篡改父级使其 ≠ 子组之和 ⇒ 父级求和失败", () => {
    const tampered = clone();
    tampered.packMachineVerdictSummary = { ...tampered.packMachineVerdictSummary, PASS: 999 };
    const result = checkReviewInput(tampered, expectation, JSON.stringify(tampered));
    expect(result.ok).toBe(false);
    expect(result.violations.join("\n")).toContain("summary-self-consistent");
  });

  it("篡改 truthFirstPack note 回「全部 PASS」（同组实测 SUSPECT=1）⇒ group-note-consistent 失败（A9-R8 防谎报回归）", () => {
    const tampered = clone();
    const group = tampered.packMachineVerdictSummary.groups[TRUTH_FIRST_PACK_GROUP]!;
    expect(group.SUSPECT).toBeGreaterThan(0); // 探针前提：本组确实存在非 PASS（当前 = 203）。
    tampered.packMachineVerdictSummary.groups = {
      ...tampered.packMachineVerdictSummary.groups,
      [TRUTH_FIRST_PACK_GROUP]: { ...group, note: "本组机器档位全部 PASS，与既有记录一致（与 humanBarFit 独立得出）。" },
    };
    const result = checkReviewInput(tampered, expectation, JSON.stringify(tampered));
    expect(result.ok).toBe(false);
    expect(result.violations.join("\n")).toContain("group-note-consistent");
    expect(result.violations.join("\n")).toContain("全部 PASS");
  });

  it("非 PASS 卡号未在 note 点名 ⇒ group-note-consistent 失败（计数说了、卡号不说也算矛盾）", () => {
    const tampered = clone();
    const group = tampered.packMachineVerdictSummary.groups[TRUTH_FIRST_PACK_GROUP]!;
    tampered.packMachineVerdictSummary.groups = {
      ...tampered.packMachineVerdictSummary.groups,
      [TRUTH_FIRST_PACK_GROUP]: { ...group, note: "机器档位 PASS 2/3，非 PASS 1 张（逐卡实读，卡号略）。" },
    };
    const result = checkReviewInput(tampered, expectation, JSON.stringify(tampered));
    expect(result.ok).toBe(false);
    expect(result.violations.join("\n")).toContain("group-note-consistent");
    expect(result.violations.join("\n")).toContain("未逐张点名");
  });

  it("真产物 truthFirstPack note 由实测派生：非 0 非 PASS 时点名卡号与档位、不写「全部 PASS」", () => {
    const group = review.packMachineVerdictSummary.groups[TRUTH_FIRST_PACK_GROUP]!;
    const nonPass = group.total - group.PASS;
    if (nonPass === 0) {
      expect(group.note).toContain("机器档位全部 PASS");
    } else {
      expect(group.note).not.toContain("全部 PASS");
      expect(group.note).toContain(`非 PASS ${nonPass} 张`);
      for (const row of verdictRows.filter((row) => FIRST_PACK_IDS.includes(row.cardId) && row.machineVerdict !== "PASS")) {
        expect(group.note, row.cardId).toContain(`${row.cardId}=${row.machineVerdict}`);
      }
    }
  });

  it("篡改某条 reviewed（UNREVIEWED 却 reviewed=true）⇒ reviewed-consistency 失败", () => {
    const tampered = clone();
    tampered.entries = { ...tampered.entries, [BOOTSTRAP_IDS[0]!]: { reviewed: true, humanBarFit: "UNREVIEWED", note: "篡改" } };
    const result = checkReviewInput(tampered, expectation, JSON.stringify(tampered));
    expect(result.ok).toBe(false);
    expect(result.violations.join("\n")).toContain("reviewed-consistency");
  });

  it("删掉一条 entries ⇒ entries-count 失败", () => {
    const tampered = clone();
    const dropped = BOOTSTRAP_IDS[BOOTSTRAP_IDS.length - 1]!;
    const rest: Record<string, ReviewEntry> = {};
    for (const [id, entry] of Object.entries(tampered.entries)) if (id !== dropped) rest[id] = entry;
    tampered.entries = rest;
    const result = checkReviewInput(tampered, expectation, JSON.stringify(tampered));
    expect(result.ok).toBe(false);
    expect(result.violations.join("\n")).toContain("entries-count");
  });

  it("把某张「退出」改回 PASS（退出登记与活跃状态脱节）⇒ history-coverage 失败", () => {
    const tampered = clone();
    tampered.entries = {
      ...tampered.entries,
      [ARCHIVED_IDS[0]!]: { reviewed: true, humanBarFit: "PASS", note: "偷偷放回" },
    };
    const result = checkReviewInput(tampered, expectation, JSON.stringify(tampered));
    expect(result.ok).toBe(false);
    expect(result.violations.join("\n")).toContain("history-coverage");
  });

  it("把 A9 某张撤回 UNREVIEWED（活跃 PASS 被人为抽走）⇒ history-coverage 失败", () => {
    const tampered = clone();
    tampered.entries = {
      ...tampered.entries,
      [PACK1_IDS[0]!]: { reviewed: false, humanBarFit: "UNREVIEWED", note: RETIRED_FROM_FORMAL_NOTE },
    };
    const result = checkReviewInput(tampered, expectation, JSON.stringify(tampered));
    expect(result.ok).toBe(false);
    expect(result.violations.join("\n")).toContain("history-coverage");
  });

  it("删掉一条历史归档 ⇒ history-coverage 失败（历史留痕不得残缺）", () => {
    const tampered = clone();
    tampered.history = tampered.history.filter((entry) => entry.cardId !== ARCHIVED_IDS[0]!);
    const result = checkReviewInput(tampered, expectation, JSON.stringify(tampered));
    expect(result.ok).toBe(false);
    expect(result.violations.join("\n")).toContain("history-coverage");
  });

  it("原文出现重复 cardId 键 ⇒ card-id-unique 失败（JSON.parse 会静默吞键）", () => {
    const dup = review.entries[BOOTSTRAP_IDS[0]!]!;
    const injected = rawReview.replace(
      `"${BOOTSTRAP_IDS[1]}": {`,
      `"${BOOTSTRAP_IDS[0]}": ${JSON.stringify(dup)},\n    "${BOOTSTRAP_IDS[1]}": {`,
    );
    expect(injected).not.toBe(rawReview);
    const result = checkReviewInput(JSON.parse(injected) as ReviewInputPayload, expectation, injected);
    expect(result.ok).toBe(false);
    expect(result.violations.join("\n")).toContain("card-id-unique");
  });

  it("对照：未篡改的真产物经同一条校验路径 ⇒ ok=true（证明上面抓的是篡改而非误报）", () => {
    expect(checkReviewInput(clone(), expectation, rawReview).ok).toBe(true);
  });
});
