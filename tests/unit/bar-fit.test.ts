import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  BAR_FIT_RULES,
  BAR_FIT_THRESHOLDS,
  COMPUTED_RULE_IDS,
  estimateStartActions,
  judgeBarFit,
} from "@/lib/v2-content/bar-fit";
import { judgeCanonicalBarFit } from "@/lib/v2-content/bar-fit-input";
import { FIXED_CONTENT_MANIFEST } from "@/lib/v2-content/fixed-content-manifest";
import { getV2ContentAdapter } from "@/lib/v2-content/v2-content-adapter";

/**
 * BAR-FIT 规则夹具：每条规则一个正例（必须命中）＋一个反例（不得命中）。
 * 规则表新增规则却没补夹具时，下面的「夹具完整性」测试会立刻测红。
 */
const RULE_FIXTURES: Record<string, { positive: string; negative: string; instruction?: string; negativeInstruction?: string }> = {
  "HF-THEATER-PERFORM": { positive: "即兴小品：演一段偶像剧", negative: "说出你最近一次看的电影" },
  "HF-PERFORM-GUESS": {
    positive: "现场表演一段让大家猜是什么",
    negative: "说出你今晚最想和谁说一句话",
  },
  "HF-DRAW-GUESS": { positive: "你画我猜", negative: "说出你最近一次玩的游戏" },
  "HF-AD-PITCH": { positive: "给一款不存在的产品编一句广告词", negative: "说出你最拿手的一道家常菜" },
  "HF-LIVE-CREATE": { positive: "现场创作一首歌", negative: "说出你最近单曲循环的一首歌" },
  "HF-HARD-MEMORY": {
    positive: "点名一位玩家，复述他/她今晚说过的一句话",
    negative: "说出你最喜欢的一本书",
  },
  "HF-QUIET-DEPENDENT": {
    positive: "得票者现在说一句话，全场三秒不许出声",
    negative: "大声说出你今晚最开心的一件事",
  },
  "HF-LONG-PERFORM": { positive: "现在给大家跳一支完整的舞", negative: "说出你最拿手的一道家常菜" },
  "HF-EXTERNAL-DEVICE": {
    positive: "把手机交给一位玩家，让他/她替你选一首歌",
    negative: "说出你今晚最想说的一句话",
  },
  "HF-PERFORM-RECALL": {
    positive: "交换位置坐一轮，模仿一下刚才对方最典型的动作",
    negative: "做一个简单手势，你立刻模仿；然后交换一次",
  },
  "BR-SIMPLE-PERFORM": { positive: "TA 做一个简单手势，你立刻模仿；然后交换一次", negative: "说出你最近一次玩的游戏" },
  "BR-MEMORY-SIMPLE": { positive: "现在回忆一次你最早的旅行", negative: "说出你最近一次玩的游戏" },
  "BR-COUNT-RECALL": { positive: "得票者现在心算一下今晚一共花了多少", negative: "说出你最近一次玩的游戏" },
  "BR-MULTI-STEP-FLOW": {
    positive: "先出题再答题然后再交换一次",
    negative: "说出你最近一次玩的游戏",
  },
  "BR-LIVE-NAMING": { positive: "给今晚这场聚会起个群名", negative: "说出你最近一次玩的游戏" },
  "BR-DEVICE-STEP": { positive: "打开手机相册，给旁边的人看一张照片", negative: "说出你最近一次玩的游戏" },
  "CF-READ-TIME": {
    positive: "请每个人轮流说一说最近一次出门旅行时在路上遇到的一件小事。".repeat(3),
    negative: "说出你最近一次玩的游戏",
  },
  "CF-READ-TIME-SOFT": {
    positive: "在场每个人轮流说说自己最近一次独自出门旅行时最喜欢的一个瞬间，说完由下一位接着补充自己的版本。",
    negative: "说出你最近一次玩的游戏",
  },
  "CF-START-ACTIONS": {
    positive: "选一位玩家，请一位不认识的人指定一个姿势，你和他碰一次杯后再模仿一遍",
    negative: "说出你最近一次玩的游戏",
  },
  "CF-START-ACTIONS-SOFT": { positive: "选一位玩家，然后互相击掌一次", negative: "说出你最近一次玩的游戏" },
  "CF-LONG-INSTRUCTION": {
    positive: "向一位同桌以外的人提一个简单问题",
    instruction: "开口前先问对方愿不愿意，对方拒绝后本轮不得有任何后续，本桌有就近替代版本；邀请方也可以直接跳过",
    negative: "说出你最近一次玩的游戏",
    negativeInstruction: "不愿意可无惩罚跳过",
  },
};

/** CF-* 纯估算规则：只进人工复核池，**永不**产生正式 FAIL（P1-4）。 */
const COMPUTED_RULE_ID_LIST: readonly string[] = COMPUTED_RULE_IDS;

const ALL_RULE_IDS = [...BAR_FIT_RULES.map((rule) => rule.id), ...COMPUTED_RULE_IDS];

/** 夹具正例必须命中的规则，是否属于 HF-* 硬失败候选（决定期望的 machineVerdict）。 */
const isHardFailRule = (ruleId: string): boolean => ruleId.startsWith("HF-");

describe("BAR-FIT 规则表：每条规则至少一正例一负例", () => {
  it("夹具完整性：表里每条规则（含计算型）都有正例/反例夹具", () => {
    for (const id of ALL_RULE_IDS) {
      expect(RULE_FIXTURES[id], `规则 ${id} 缺夹具`).toBeDefined();
    }
    expect(Object.keys(RULE_FIXTURES).sort()).toEqual([...ALL_RULE_IDS].sort());
  });

  it.each(ALL_RULE_IDS)("规则 %s：正例命中、反例不命中", (ruleId) => {
    const fixture = RULE_FIXTURES[ruleId];
    const positive = judgeBarFit({ text: fixture.positive, instruction: fixture.instruction });
    const negative = judgeBarFit({ text: fixture.negative, instruction: fixture.negativeInstruction });

    expect(positive.ruleHits, `正例应命中 ${ruleId}`).toContain(ruleId);
    expect(negative.ruleHits, `反例不应命中 ${ruleId}`).not.toContain(ruleId);
  });

  it("规则表结构合法：id 唯一、severity 只分 hard-fail 候选/复核池、pattern 非空、理由非空", () => {
    const ids = BAR_FIT_RULES.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const rule of BAR_FIT_RULES) {
      expect(rule.severity === "HARD_FAIL_PATTERN" || rule.severity === "SUSPECT").toBe(true);
      // 规则 ID 前缀与机器分流必须一致：HF-* = 硬失败候选，其余 = 复核池。
      expect(rule.severity).toBe(isHardFailRule(rule.id) ? "HARD_FAIL_PATTERN" : "SUSPECT");
      expect(rule.patterns.length).toBeGreaterThan(0);
      expect(rule.reason.length).toBeGreaterThan(0);
      expect(rule.description.length).toBeGreaterThan(0);
    }
  });
});

describe("P1-4｜机器预筛与人工定档分层（CF-* 永不产生正式 FAIL）", () => {
  it("CF-* 纯估算规则只进复核池：命中即 SUSPECT，绝不 FAIL，humanBarFit 恒 UNREVIEWED", () => {
    for (const ruleId of COMPUTED_RULE_ID_LIST) {
      const result = judgeBarFit({ text: RULE_FIXTURES[ruleId]!.positive, instruction: RULE_FIXTURES[ruleId]!.instruction });
      expect(result.ruleHits, ruleId).toContain(ruleId);
      expect(result.suspectHits, ruleId).toContain(ruleId);
      expect(result.machineVerdict, ruleId).toBe("SUSPECT");
      expect(result.humanBarFit, ruleId).toBe("UNREVIEWED");
    }
  });

  it("HF-* 只产出 hard-fail 候选（HARD_FAIL_PATTERN），不写死正式定档", () => {
    for (const rule of BAR_FIT_RULES.filter((item) => item.severity === "HARD_FAIL_PATTERN")) {
      const result = judgeBarFit({ text: RULE_FIXTURES[rule.id]!.positive, instruction: RULE_FIXTURES[rule.id]!.instruction });
      expect(result.machineVerdict, rule.id).toBe("HARD_FAIL_PATTERN");
      expect(result.hardFailPatternHits, rule.id).toContain(rule.id);
      expect(result.humanBarFit, rule.id).toBe("UNREVIEWED");
    }
  });

  it("hardFailPatternHits ∩ suspectHits = ∅，且二者并集 = ruleHits", () => {
    const result = judgeBarFit({ text: "选一位玩家，用他/她的名字即兴编一句押韵的口号" });
    expect(result.hardFailPatternHits.length).toBeGreaterThan(0);
    expect(result.suspectHits.length).toBeGreaterThan(0);
    for (const id of result.hardFailPatternHits) expect(result.suspectHits).not.toContain(id);
    expect([...result.hardFailPatternHits, ...result.suspectHits]).toEqual(result.ruleHits);
  });

  it("judgeBarFit 不导出「正式 FAIL」直出字段（只有两字段，level 已移除）", () => {
    const result = judgeBarFit({ text: "你画我猜" });
    expect("level" in result).toBe(false);
    expect(Object.keys(result).sort()).toEqual(
      ["hardFailPatternHits", "humanBarFit", "machineVerdict", "metrics", "reasons", "ruleHits", "suspectHits"].sort(),
    );
  });
});

describe("BAR-FIT 典型判定（Plan §2 硬失败类型 + 工单样例）", () => {
  it("典型 hard-fail 候选：「你画我猜」→ HARD_FAIL_PATTERN", () => {
    const result = judgeBarFit({ text: "你画我猜" });
    expect(result.machineVerdict).toBe("HARD_FAIL_PATTERN");
    expect(result.ruleHits).toContain("HF-DRAW-GUESS");
  });

  it("典型 hard-fail 候选：「即兴小品：演一段偶像剧」→ HARD_FAIL_PATTERN", () => {
    const result = judgeBarFit({ text: "即兴小品：演一段偶像剧" });
    expect(result.machineVerdict).toBe("HARD_FAIL_PATTERN");
    expect(result.ruleHits).toContain("HF-THEATER-PERFORM");
  });

  it("典型 PASS：「说出你最近一次玩的游戏」判 PASS（无命中、无压线）", () => {
    const result = judgeBarFit({ text: "说出你最近一次玩的游戏" });
    expect(result.machineVerdict).toBe("PASS");
    expect(result.ruleHits).toEqual([]);
    expect(result.reasons).toEqual([]);
  });

  it("Plan §2 预先判定的旧题硬失败清单逐条复现为 hard-fail 候选", () => {
    const expected: Array<[string, string, string?]> = [
      // SSOT：空中画图 / 模仿对方动作（表演任务）
      ["PN-DARE-005", "一个人在空中画一个简单图形，另一个人10秒内猜出来。"],
      ["PN-DARE-016", "交换位置坐一轮，模仿一下刚才对方最典型的动作。"],
      ["PN-DARE-027", "两个人面对面站好，各自模仿一次对方今晚最有代表性的动作。"],
      // built-in-seeds：交手机选歌再唱 / 复述别人说过的话 / 即兴押韵口号 / 现场演再猜 / 复述杯中内容
      ["seed-truth-dare-dare-9", "把手机交给在场一位玩家，让他/她替你选一首歌，你唱一句给对方听", "只唱一句，唱完由对方打分"],
      ["seed-truth-dare-dare-16", "点名一位玩家，复述他/她今晚说过的一句话，越准越好", "由本人确认或纠正"],
      ["seed-truth-dare-dare-30", "选一位玩家，用他/她的名字即兴编一句押韵的口号，喊给他/她听", "喊完由本人打分"],
      ["seed-truth-dare-dare-36", "让在场一个人出题，你现场演，由他/她猜是什么", "猜不中也能过，各说一句感受"],
      [
        "seed-most-likely-vote-7",
        "全场投票：在座谁最会把别人的小事记在心上？得票者当场复述在场每个人杯子里装的是什么",
        "说错也没关系，由本人纠正",
      ],
    ];
    for (const [cardId, text, instruction] of expected) {
      expect(judgeBarFit({ cardId, text, instruction }).machineVerdict, cardId).toBe("HARD_FAIL_PATTERN");
    }
  });

  it("Plan §2 点名「简单同步手势」不判硬失败（只进复核池，不得机械按词删）", () => {
    const result = judgeBarFit({ text: "TA 做一个简单手势，你立刻模仿；然后交换一次。" });
    expect(result.machineVerdict).toBe("SUSPECT");
    expect(result.ruleHits).not.toContain("HF-PERFORM-RECALL");
    expect(result.ruleHits).toContain("BR-SIMPLE-PERFORM");
  });
});

describe("BAR-FIT 可解释性与确定性", () => {
  it("ruleHits 与 reasons 一一对应（命中几条就解释几条）", () => {
    const result = judgeBarFit({
      text: "全场投票：在座谁最会把别人的小事记在心上？得票者当场复述在场每个人杯子里装的是什么",
      instruction: "说错也没关系，由本人纠正",
    });
    expect(result.ruleHits.length).toBeGreaterThan(0);
    expect(result.reasons).toHaveLength(result.ruleHits.length);
    for (const reason of result.reasons) expect(reason.length).toBeGreaterThan(0);
  });

  it("同输入多次调用结果完全一致（确定性）", () => {
    const card = {
      text: "现场创作一首押韵的口号，喊给全场听",
      instruction: "开口前先问对方愿不愿意，对方拒绝后本轮不得有任何后续，本桌有就近替代版本；邀请方也可以直接跳过",
    };
    const first = JSON.stringify(judgeBarFit(card));
    for (let i = 0; i < 5; i += 1) expect(JSON.stringify(judgeBarFit(card))).toBe(first);
  });

  it("机器结论取最严重值：hard-fail 候选压过复核池，无命中才是 PASS", () => {
    // HF-* 词法 + CF-* 估算同时命中 → HARD_FAIL_PATTERN
    const mixed = judgeBarFit({ text: "选一位玩家，然后现场创作一首歌" });
    expect(mixed.machineVerdict).toBe("HARD_FAIL_PATTERN");
    // 只有 CF-*/BR-* → SUSPECT（复核池）
    expect(judgeBarFit({ text: "选一位玩家，然后互相击掌一次" }).machineVerdict).toBe("SUSPECT");
    // 无命中 → PASS
    expect(judgeBarFit({ text: "说出你最近一次玩的游戏" }).machineVerdict).toBe("PASS");
  });

  it("metrics 可解释：动作数构成与估算值自洽，阈值与常量一致", () => {
    const result = judgeBarFit({ text: "选一位玩家，两人都同意后互相整理一下对方的衣领或袖口" });
    expect(result.metrics.actionBreakdown).toHaveLength(result.metrics.startActions);
    expect(result.metrics.readSeconds).toBe(
      Math.round((result.metrics.charCount / BAR_FIT_THRESHOLDS.READ_CHARS_PER_SECOND) * 10) / 10,
    );
    const { actions, breakdown } = estimateStartActions("说出你最近一次玩的游戏", "");
    expect(actions).toBe(1);
    expect(breakdown).toHaveLength(1);
  });

  it("空/缺字段输入不抛错，按最短文本判 PASS", () => {
    expect(judgeBarFit({}).machineVerdict).toBe("PASS");
    expect(judgeBarFit({ text: "" }).metrics.charCount).toBe(0);
    // content 作为 text 的别名同样生效
    expect(judgeBarFit({ content: "你画我猜" }).machineVerdict).toBe("HARD_FAIL_PATTERN");
  });
});

describe("BAR-FIT 旧题审查产物与判定引擎一致", () => {
  const root = process.cwd();

  interface AuditRowShape {
    cardId: string;
    machineVerdict: string;
    humanBarFit: string;
    hardFailPatternHits: string[];
    suspectHits: string[];
    includesInstruction: boolean;
  }

  interface AuditSetShape {
    cardCount: number;
    machineVerdictDistribution: Record<string, number>;
    humanBarFitDistribution: Record<string, number>;
    hardFailCandidateCount: number;
    reviewPoolCount: number;
    forensic: boolean;
    admissionEligible: boolean;
    rows: AuditRowShape[];
  }

  const audit = JSON.parse(readFileSync(path.join(root, "docs/qa/content-audit-v2/BAR-FIT-AUDIT.json"), "utf8")) as {
    canonicalInput: { implementation: string; caliber: string };
    reconciliation: {
      compared: number;
      consistent: number;
      inconsistent: number;
      mismatches: unknown[];
      ok: boolean;
    };
    forensicGuard: { canonicalAdmissionEligible: boolean; textOnlyAdmissionEligible: boolean };
    verdictSemantics: { machineVerdict: { field: string }; humanBarFit: { field: string } };
    sets: { frozenFixed390: AuditSetShape; builtinSeeds350: AuditSetShape; textOnlyForensic: AuditSetShape };
  };

  it("冻结固定库 390 全量在册，且产物 machineVerdict 与 canonical 引擎重算一致", () => {
    // 口径＝**冻结 SSOT 快照 390**（主线 350 + 扩圈 40），与磁盘 BAR-FIT-AUDIT.json 的
    // `sets.frozenFixed390` 同集合。第一包正式内容（PN-TRUTH-201~224）走 sidecar，**不进**这份冻结快照
    // （其 BAR-FIT 审查属 C1-6 的独立审查脚本），故这里从 SSOT adapter 真源取卡，不用桥接合并视图。
    const adapter = getV2ContentAdapter();
    const frozen = [...adapter.mainlineCards, ...adapter.expansionCards];
    expect(audit.sets.frozenFixed390.cardCount).toBe(390);
    expect(audit.sets.frozenFixed390.rows).toHaveLength(390);
    expect(frozen).toHaveLength(390);

    for (const card of frozen) {
      const row = audit.sets.frozenFixed390.rows.find((entry) => entry.cardId === card.cardId);
      expect(row, card.cardId).toBeDefined();
      // 唯一 canonical input（正文 + instruction）重算，逐卡一致。
      expect(row?.machineVerdict, card.cardId).toBe(judgeCanonicalBarFit(card).machineVerdict);
      expect(row?.includesInstruction, card.cardId).toBe(true);
    }
  });

  it("audit ↔ manifest 逐 cardId 对账：390 一致、0 不一致、ok=true", () => {
    expect(audit.canonicalInput.implementation).toContain("bar-fit-input.ts");
    expect(audit.reconciliation.ok).toBe(true);
    expect(audit.reconciliation.compared).toBe(390);
    expect(audit.reconciliation.consistent).toBe(390);
    expect(audit.reconciliation.inconsistent).toBe(0);
    expect(audit.reconciliation.mismatches).toEqual([]);
    // 与 manifest 产物里记录的值逐卡相等。
    const provenance = FIXED_CONTENT_MANIFEST.tracks.legacyCompatibility.provenance;
    for (const row of audit.sets.frozenFixed390.rows) {
      expect(provenance[row.cardId]?.machineVerdict, row.cardId).toBe(row.machineVerdict);
    }
  });

  it("产物三档之和 = 题数；人工定档全 UNREVIEWED", () => {
    for (const set of [audit.sets.frozenFixed390, audit.sets.builtinSeeds350, audit.sets.textOnlyForensic]) {
      const d = set.machineVerdictDistribution;
      expect(d.PASS + d.SUSPECT + d.HARD_FAIL_PATTERN).toBe(set.cardCount);
      expect(set.humanBarFitDistribution.UNREVIEWED).toBe(set.cardCount);
      expect(set.humanBarFitDistribution.FAIL).toBe(0);
      for (const row of set.rows) expect(row.humanBarFit).toBe("UNREVIEWED");
    }
    expect(audit.sets.frozenFixed390.cardCount).toBe(390);
    expect(audit.sets.builtinSeeds350.cardCount).toBe(350);
  });

  it("统计分列自洽：hard-fail 候选数 = HARD_FAIL_PATTERN，复核池数 = SUSPECT", () => {
    for (const set of [audit.sets.frozenFixed390, audit.sets.builtinSeeds350, audit.sets.textOnlyForensic]) {
      expect(set.hardFailCandidateCount).toBe(set.machineVerdictDistribution.HARD_FAIL_PATTERN);
      expect(set.reviewPoolCount).toBe(set.machineVerdictDistribution.SUSPECT);
      expect(set.hardFailCandidateCount + set.reviewPoolCount).toBeLessThanOrEqual(set.cardCount);
    }
  });

  it("Step 6 口径分层：canonical 集可 admission，text-only 集 forensic 且不参与 admission", () => {
    const canonical = audit.sets.frozenFixed390;
    const forensic = audit.sets.textOnlyForensic;
    expect(canonical.forensic).toBe(false);
    expect(canonical.admissionEligible).toBe(true);
    expect(forensic.forensic).toBe(true);
    expect(forensic.admissionEligible).toBe(false);
    for (const row of forensic.rows) expect(row.includesInstruction).toBe(false);
    expect(audit.forensicGuard.canonicalAdmissionEligible).toBe(true);
    expect(audit.forensicGuard.textOnlyAdmissionEligible).toBe(false);
  });

  it("P1-4 回归：纯 CF-READ-TIME 估算题只进复核池，不得是 hard-fail 候选", () => {
    const rows = audit.sets.frozenFixed390.rows;
    for (const cardId of ["PN-CHEM-031", "PN-CHEM-034", "PN-CHEM-048"]) {
      const row = rows.find((entry) => entry.cardId === cardId);
      expect(row, cardId).toBeDefined();
      expect(row!.machineVerdict, cardId).toBe("SUSPECT");
      expect(row!.hardFailPatternHits, cardId).toEqual([]);
      expect(row!.suspectHits, cardId).toContain("CF-READ-TIME");
    }
    // canonical 口径下冻结库 hard-fail 候选 = 4（PN-DARE-005/016/027 + 扩圈 PN-EXPAND-036）
    expect(audit.sets.frozenFixed390.hardFailCandidateCount).toBe(4);
  });

  it("产物自带两层口径声明（字段名 + 语义）", () => {
    expect(audit.verdictSemantics.machineVerdict.field).toBe("machineVerdict");
    expect(audit.verdictSemantics.humanBarFit.field).toBe("humanBarFit");
  });
});
