/**
 * P1#2｜Router 曝光饥饿修复的回归锁（冻结 Plan :62「… → drawBand → 随机选卡」）。
 *
 * 缺陷：`sortCards`（强度降序 + cardId 升序）后由编排器取首张 ⇒ 同强度候选的曝光
 * 恒等于 cardId 字典序最小者 ⇒ 同一 truth-dare 包内 `PN-DARE-*` 恒排在 `PN-TRUTH-*`
 * 之前，大冒险被系统性饿死（Phase A.2 实测 dare 15,359 : truth 704 ≈ 21.8:1）。
 *
 * 本文件只验证「同优先级（同强度）组内先出哪一张」已被 seed 派生轮换替换，
 * 并逐条回归：过滤口径、优先级顺序（强度降序）、单次一张、候选集合都不得变。
 */

import { describe, expect, it } from "vitest";

import { eventForRoundTerminal } from "@/lib/engine/v2-deal";
import { mainlineRuntimeCards } from "@/lib/v2-content/v2-card-bridge";
import type { V13MainlineCard } from "@/lib/v2-content/v2-types";
import {
  drawSeedFor,
  orderByTieBreakRotation,
} from "@/lib/v2-relationship/v2-draw-order";
import { createV2MainlineRouter, packIdForMainlineCard } from "@/lib/v2-relationship/v2-router";
import {
  createV2SessionState,
  drawV2SessionCard,
  reduceV2SessionEvents,
  type V2RouterInput,
} from "@/lib/v2-relationship/v2-session";
import {
  createInitialRelationshipState,
  pairKey,
  type RelationshipState,
  type SessionParticipant,
} from "@/lib/v2-relationship/v2-state";

/* ------------------------------------------------------------------ */
/* 装置 / fixture                                                        */
/* ------------------------------------------------------------------ */

/**
 * P1-5：Monte Carlo 用例的**显式** timeout。
 *
 * 两条大样本用例（60 局 × 20 轮 / 64 局 × 20 轮，各上千次抽卡 + 事件归约）实测约
 * 6.6s / 6.2s，超过 vitest 默认 `testTimeout=5000`，在慢机上会假红。
 * 仅给这两条用例单独放宽（第三参数），**不改**全局 `testTimeout`、
 * **不减**样本量、**不放宽** ±18% 公平阈值。
 */
const MONTE_CARLO_TIMEOUT_MS = 30_000;

/** 2 男 2 女（有合法男女 pair，跑真正的 pair runtime，不触发 D4 降级）。 */
const TABLE_2M2F: SessionParticipant[] = [
  { playerId: "m1", active: true, pairGender: "male" },
  { playerId: "m2", active: true, pairGender: "male" },
  { playerId: "f1", active: true, pairGender: "female" },
  { playerId: "f2", active: true, pairGender: "female" },
];

/**
 * 只认主线卡的元数据（扩圈 / 旧 seed 不在本 Router 值域，拿不到即测试自身出错）。
 *
 * C1-8：主线卡**唯一卡源**已统一到桥接的 `mainlineRuntimeCards()`（SSOT 主线 350 +
 * 第一包正式内容 24；审计 Router 与生产 `createDeckRouter` 同源），不再只认 adapter 的 350 张。
 */
const mainlineById = new Map<string, V13MainlineCard>(
  mainlineRuntimeCards().map((card) => [card.cardId, card as unknown as V13MainlineCard]),
);
const mainlineMeta = (cardId: string): V13MainlineCard => {
  const card = mainlineById.get(cardId);
  if (!card) throw new Error(`非主线卡：${cardId}`);
  return card;
};
const gameTypeOf = (cardId: string): string => mainlineMeta(cardId).gameType;
const intensityOf = (cardId: string): number => mainlineMeta(cardId).intensity;

/**
 * TIE_FIXTURE｜tie 场景夹具（本文件所有用例共用）。
 *
 * 选 `truth-dare` 包 + H1 + intensityLimit=4：SSOT 里该包共 100 张（truth 50 + dare 50），
 * 其中强度 5 的 20 张是 `match-pair`（未建立 MATCH 时不出）；强度 1–4 = 80 张。
 * 第一包原 24 张里强度 ≤4 的卡（含 217/223 等）已随 A4a 退役移出卡源，故当时运行时只剩 KEEP 5
 * （203/205/209/227/229，全 I1/I2，均 ≤4，全部进本夹具桶；A9 后另起重构批入池，见下方 A9 条）。
 *
 * ⚠️ C1-8 口径变更：原夹具用 `intensityLimit=5`，其「顶档 = I4」的前提是「I5 全为 match-pair 被排除」。
 * 第一包新增 2 张**非 match-pair 的 I5 truth 卡**后，该前提不再成立（I5 顶档只剩 2 张 truth，
 * 不再是对称 tie 组）。故夹具改为 `intensityLimit=4`，让顶档继续落在对称的 I4 组
 * （truth 10 : dare 10），±18% 阈值、样本量、tie-break 回归语义均未改。
 *
 * ⚠️ A3 口径变更（2026-09-28，Human 冻结「热标注必须诚实」）：第一包 24 张的 `heatMin` 不再一律 1
 * （现 H1 4 / H2 8 / H3 10 / H4 2）。
 * ⚠️ R2 口径变更（2026-09-29；**P3-1 更正**）：新增 Truth H1 Bootstrap 7 张（`PN-TRUTH-225~231`，全
 * `heatMin=1`、`intensity` ≤3）。
 * ⚠️ **A4a 口径变更（2026-09-29）**：26 张退役 `PN-TRUTH-2*` 已**移出运行时内容源**
 * （逐字归档于 `lib/v2-content/archive/`），当时运行时只剩 KEEP 5（203/205/209/227/229，全 I1/I2；
 * ——这是 A4a 时点口径，不是「现役 Formal＝KEEP 5」，A9 后另有重构批入池，见下条）。
 * ⚠️ **A9 口径变更（2026-09-29）**：52 张重构批（`PN-TRUTH-232~283`）经准入后进入运行时卡源；
 * 本夹具（H1 + 强度上限 4）里的 I≤4 真心话卡因此增加。
 *
 * 桶容量：**以下方 `expectedBucketSize` 常量为准，本注释不另手写数字**（防止注释与常量两处漂移）。
 * 实算探针：`temp/probe-bucket-size.ts`（`bucket(truth-dare, H1, intensityLimit=4).length`，
 * 审计 `createV2MainlineRouter` 与生产 `createDeckRouter` 两条 Router 同值）：
 *   = SSOT truth-dare 的 I1–I4（旧卡全 legacy ⇒ 不受 Heat 硬过滤）
 *   + 运行时正式内容源里 I≤4 的卡；
 *   顶强度档 = I4，张数见 `expectedTieTierSize`（SSOT truth 10 : dare 10，对称未被打破）。
 * 历史留痕：A9 准入前旧段落手写「95 张」；A9-R6/R7 各退役 1 张 H1·I≤4 真心话卡后探针复算更正，
 * 常量已随更正同步，旧「95」段落作废。
 * 张数变化是「A9 准入」与「A4a/A9-R6/A9-R7 退役」等内容事实的直接后果，不是 Router 回归；
 * ±18% 公平阈值、样本量、tie-break 回归语义均未改。
 *
 * 夹具常量属**结构性桶容量**（不是可随人审改动的 Formal 计数）：写死值以上面探针实算为准，
 * 内容源再变（下一单补 H3/H4 卡等）须重跑探针并同步常量。
 *
 * B3-4 之后 Heat 档只对 Formal Fixed 轨生效（冻结快照 390 张旧卡全为 legacy ⇒ 豁免），
 * ── 对**旧卡**而言 bucket 不按 Heat 收窄，故出卡集中在包的 top 强度档；
 * 「组内先出哪一张」完全由 tie-break 决定 —— 这正是 P1#2 的最小可复现局面。
 * 修复前 `bucket(...)[0]` 恒为同强度组里 cardId 字典序最小者；修复后随 seed 轮换。
 */
const TIE_FIXTURE = {
  packId: "truth-dare",
  intensityLimit: 4,
  /** 实测（A9 准入 + A4a/A9-R6/A9-R7 退役后）：H1 + 强度上限 4 = 94 张（探针实算，两 Router 同值）。 */
  expectedBucketSize: 94,
  /** 实测：top 强度档 = 强度 4。 */
  expectedTieTierMaxIntensity: 4,
  /** 实测：top 强度档 20 张（SSOT truth 10 : dare 10，对称）。 */
  expectedTieTierSize: 20,
  expectedGameTypes: ["truth", "dare"] as const,
} as const;

function input(overrides: Partial<V2RouterInput> = {}): V2RouterInput {
  const relationship = overrides.relationship ?? createInitialRelationshipState();
  return {
    relationship,
    participants: overrides.participants ?? TABLE_2M2F,
    targetPairKey: overrides.targetPairKey ?? pairKey("f1", "m1"),
    intensityLimit: overrides.intensityLimit ?? TIE_FIXTURE.intensityLimit,
    softDedupWindow: overrides.softDedupWindow ?? 5,
    requireFiveTierForPair: overrides.requireFiveTierForPair ?? null,
    ...(overrides.drawSeed === undefined ? {} : { drawSeed: overrides.drawSeed }),
    ...(overrides.drawSessionSalt === undefined ? {} : { drawSessionSalt: overrides.drawSessionSalt }),
  };
}

/** 确定性 PRNG（测试夹具专用：只用来决定本回合 completed/skipped，不参与出卡）。 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* 1. 同包同 gameType 不再长期饥饿                                        */
/* ------------------------------------------------------------------ */

describe("P1#2①｜truth-dare 包内 dare / truth 曝光不再由 cardId 字典序垄断", () => {
  /**
   * 阈值推导（不拍脑袋）：
   * - 修复后每次出卡在「包的 top 强度档」内均匀取一张（B3-4 后 Heat 档只对 Formal 卡生效、
   *   当前快照全 legacy ⇒ 不再按 Heat 收窄）。SSOT 实测该档（强度 4）truth 10 : dare 10
   *   ⇒ dare 的期望占比 ≈ 0.50（≈1:1）。
   * - 单次抽取是伯努利试验，M 次曝光中 dare 占比的标准差 = sqrt(p(1-p)/M)。
   *   本用例 60 局 × 约 20 轮 ≈ 1,200+ 次曝光，sd ≈ sqrt(0.25/1200) ≈ 0.0144。
   *   取 |dare-truth|/(dare+truth) ≤ 0.18（约 12σ）已经非常宽松，却能毫无歧义地否掉
   *   修复前 |15359-704|/16063 = 0.912 的饥饿态。
   */
  const FAIR_SHARE_TOLERANCE = 0.18;
  const SESSIONS = 60;
  const ROUNDS = 20;

  it("60 局 × 20 轮后两种 gameType 曝光收入同一量级（±18%）", () => {
    const counters: Record<string, number> = { truth: 0, dare: 0 };

    for (let session = 0; session < SESSIONS; session += 1) {
      const rnd = mulberry32(20260927 + session * 7919);
      let state = createV2SessionState({
        sessionId: `fair-${session}`,
        participants: TABLE_2M2F,
      });
      const router = createV2MainlineRouter({ packId: TIE_FIXTURE.packId });

      let completed = 0;
      let guard = 0;
      while (completed < ROUNDS && guard < 1000) {
        guard += 1;
        const outcome = drawV2SessionCard(state, router, { intensityLimit: TIE_FIXTURE.intensityLimit });
        if (outcome.kind !== "CARD") break;
        const type = gameTypeOf(outcome.cardId);
        if (type in counters) counters[type] += 1;

        const terminal = rnd() < 0.85 ? "completed" : "skipped";
        const event = eventForRoundTerminal(
          { id: `r${completed}-${guard}`, packId: TIE_FIXTURE.packId, cardId: outcome.cardId, participantIds: [] } as never,
          terminal as never,
          new Date(0).toISOString(),
        );
        state = reduceV2SessionEvents(state, [event]).state;
        if (terminal === "completed") completed += 1;
      }
    }

    const truth = counters.truth ?? 0;
    const dare = counters.dare ?? 0;
    const total = truth + dare;

    // 前提：样本够大，两个 gameType 都真的出过卡（否则下面的比例没有意义）
    expect(total).toBeGreaterThan(500);
    expect(truth).toBeGreaterThan(0);
    expect(dare).toBeGreaterThan(0);
    // 修复前该包在 4,000 局里是 15359:704；这里不允许再出现这种量级差
    expect(Math.abs(dare - truth) / total).toBeLessThanOrEqual(FAIR_SHARE_TOLERANCE);
  }, MONTE_CARLO_TIMEOUT_MS);

  it("单局 20 轮内也同时见到 truth 与 dare（不是靠跨局平均掩盖）", () => {
    const rnd = mulberry32(424242);
    let state = createV2SessionState({ sessionId: "fair-single", participants: TABLE_2M2F });
    const router = createV2MainlineRouter({ packId: TIE_FIXTURE.packId });
    const seen = new Set<string>();

    let completed = 0;
    let guard = 0;
    while (completed < 20 && guard < 1000) {
      guard += 1;
      const outcome = drawV2SessionCard(state, router, { intensityLimit: TIE_FIXTURE.intensityLimit });
      if (outcome.kind !== "CARD") break;
      seen.add(gameTypeOf(outcome.cardId));
      const terminal = rnd() < 0.85 ? "completed" : "skipped";
      const event = eventForRoundTerminal(
        { id: `s${completed}-${guard}`, packId: TIE_FIXTURE.packId, cardId: outcome.cardId, participantIds: [] } as never,
        terminal as never,
        new Date(0).toISOString(),
      );
      state = reduceV2SessionEvents(state, [event]).state;
      if (terminal === "completed") completed += 1;
    }

    expect([...seen].sort()).toEqual(["dare", "truth"]);
  });
});

/* ------------------------------------------------------------------ */
/* 2. seed 固定 → 结果可复现                                              */
/* ------------------------------------------------------------------ */

describe("P1#2②｜同一 seed 逐字复现（跨调用、跨 Router 实例）", () => {
  it("同 seed 两次调用、两个实例，bucket/pack/global 顺序逐字一致", () => {
    const seed = 20260927;
    const request = input({ drawSeed: seed });

    const a = createV2MainlineRouter({ packId: TIE_FIXTURE.packId });
    const b = createV2MainlineRouter({ packId: TIE_FIXTURE.packId });

    const ids = (cards: readonly { cardId: string }[]) => cards.map((card) => card.cardId);
    for (const tier of ["bucket", "pack", "global"] as const) {
      const first = ids(a[tier](request));
      const second = ids(a[tier](request));
      const third = ids(b[tier](request));
      expect(first.length).toBeGreaterThan(0);
      expect(second).toEqual(first);
      expect(third).toEqual(first);
    }
  });

  it("默认（不注入 seed）也复现：同一 relationship 状态两次构造必得同序", () => {
    const relationship: RelationshipState = {
      ...createInitialRelationshipState(),
      heat: "H2",
      relationshipEffectiveCardCount: 5,
      sessionCompletedRounds: 5,
      usedCardIds: ["PN-DARE-001", "PN-TRUTH-002"],
      recentCardIds: ["PN-DARE-001", "PN-TRUTH-002"],
    };
    const router = createV2MainlineRouter({ packId: TIE_FIXTURE.packId });
    const first = router.bucket(input({ relationship })).map((card) => card.cardId);
    const second = router.bucket(input({ relationship })).map((card) => card.cardId);
    expect(first.length).toBeGreaterThan(1);
    expect(second).toEqual(first);
    // 纯函数：不就地改入参、不依赖调用次数
    expect(relationship.usedCardIds).toEqual(["PN-DARE-001", "PN-TRUTH-002"]);
  });

  it("drawSeedFor 只由 relationship 派生：同状态同值、状态变化即变值", () => {
    const base = createInitialRelationshipState();
    expect(drawSeedFor(base)).toBe(drawSeedFor({ ...base }));
    const advanced: RelationshipState = {
      ...base,
      usedCardIds: ["PN-TRUTH-001"],
      recentCardIds: ["PN-TRUTH-001"],
    };
    expect(drawSeedFor(advanced)).not.toBe(drawSeedFor(base));
  });
});

/* ------------------------------------------------------------------ */
/* 3. 不同 seed → 结果不同（随机真的生效）                                 */
/* ------------------------------------------------------------------ */

describe("P1#2③｜不同 seed 给出不同首张（证明不是常量、也不是字典序）", () => {
  it("64 个 seed 下首张覆盖多个卡 id，且同时出现 truth / dare", () => {
    const router = createV2MainlineRouter({ packId: TIE_FIXTURE.packId });
    const firsts: string[] = [];
    for (let seed = 0; seed < 64; seed += 1) {
      const cards = router.bucket(input({ drawSeed: seed }));
      expect(cards.length).toBeGreaterThan(0);
      firsts.push(cards[0]!.cardId);
    }
    const distinct = new Set(firsts);
    // 修复前这里恒为 1（永远是 PN-DARE-001）
    expect(distinct.size).toBeGreaterThan(4);
    expect(new Set(firsts.map(gameTypeOf))).toEqual(new Set(["truth", "dare"]));
    // 字典序最小者不再是唯一首张
    expect(firsts.some((id) => id !== "PN-DARE-001")).toBe(true);
  });

  it("同一候选集合下，不同 seed 只换顺序、不换集合也不换长度", () => {
    const router = createV2MainlineRouter({ packId: TIE_FIXTURE.packId });
    const baseline = router.bucket(input({ drawSeed: 1 })).map((card) => card.cardId);
    for (const seed of [2, 7, 99, 123456]) {
      const other = router.bucket(input({ drawSeed: seed })).map((card) => card.cardId);
      expect(other).toHaveLength(baseline.length);
      expect([...other].sort()).toEqual([...baseline].sort());
    }
  });
});

/* ------------------------------------------------------------------ */
/* 4. 优先级顺序与过滤口径回归不变                                          */
/* ------------------------------------------------------------------ */

describe("P1#2④｜优先级顺序与硬过滤逐条不变（只动 tie 内起点）", () => {
  it("强度降序仍是组间优先级：首张恒为该局面最高强度，序列按强度非升序", () => {
    const router = createV2MainlineRouter({ packId: TIE_FIXTURE.packId });
    for (const heat of ["H1", "H2", "H3", "H4"] as const) {
      const relationship: RelationshipState = { ...createInitialRelationshipState(), heat };
      for (const seed of [0, 3, 17, 5000]) {
        const cards = router.bucket(input({ relationship, drawSeed: seed }));
        if (cards.length === 0) continue;
        const intensities = cards.map((card) => intensityOf(card.cardId));
        const max = Math.max(...intensities);
        expect(intensities[0], `${heat} seed=${seed}`).toBe(max);
        for (let index = 1; index < intensities.length; index += 1) {
          expect(intensities[index]! <= intensities[index - 1]!, `${heat} seed=${seed} 第${index}`).toBe(true);
        }
      }
    }
  });

  it("TIE_FIXTURE 局面的构成稳定：桶容量与 top 强度档张数由 TIE_FIXTURE 常量锁定、truth+dare 两种 gameType", () => {
    const router = createV2MainlineRouter({ packId: TIE_FIXTURE.packId });
    const cards = router.bucket(input({ drawSeed: 0 }));
    const topTier = cards.filter((card) => intensityOf(card.cardId) === TIE_FIXTURE.expectedTieTierMaxIntensity);

    expect(cards).toHaveLength(TIE_FIXTURE.expectedBucketSize);
    expect(topTier).toHaveLength(TIE_FIXTURE.expectedTieTierSize);
    expect(new Set(cards.map((card) => gameTypeOf(card.cardId)))).toEqual(
      new Set(TIE_FIXTURE.expectedGameTypes),
    );
  });

  it("硬过滤不变：换 seed 不影响包归属 / 强度上限 / used / 软去重窗口（Heat 档只对 Formal 卡生效）", () => {
    const router = createV2MainlineRouter({ packId: TIE_FIXTURE.packId });
    const relationship: RelationshipState = {
      ...createInitialRelationshipState(),
      heat: "H2",
      usedCardIds: ["PN-TRUTH-001", "PN-DARE-002"],
      recentCardIds: ["PN-TRUTH-002", "PN-DARE-003"],
    };
    const request = input({ relationship, intensityLimit: 3, softDedupWindow: 2 });

    for (const seed of [0, 11, 777]) {
      const cards = router.bucket({ ...request, drawSeed: seed }).map((card) => card.cardId);
      expect(cards.length).toBeGreaterThan(0);
      // B3-4｜Heat 豁免：H2 的桶里会出现 heatMin=3 的卡（旧 Heat 档口径只出 heatMin ≤ 2）
      expect(cards.some((cardId) => mainlineMeta(cardId).heatMin > 2)).toBe(true);
      for (const cardId of cards) {
        const meta = mainlineMeta(cardId);
        expect(packIdForMainlineCard(meta)).toBe(TIE_FIXTURE.packId);
        expect(meta.intensity).toBeLessThanOrEqual(3);
        expect(relationship.usedCardIds).not.toContain(cardId);
        expect(relationship.recentCardIds.slice(-2)).not.toContain(cardId);
      }
    }
  });

  it("orderByTieBreakRotation 是纯排列：集合/长度不变，且同强度组内顺序连续", () => {
    const items = [
      { id: "b", intensity: 3 },
      { id: "a", intensity: 3 },
      { id: "d", intensity: 2 },
      { id: "c", intensity: 2 },
      { id: "e", intensity: 1 },
    ];
    const rotated = orderByTieBreakRotation(items, (item) => item.intensity, 12345);
    expect(rotated).toHaveLength(items.length);
    expect([...rotated].sort((x, y) => (x.id < y.id ? -1 : 1))).toEqual(
      [...items].sort((x, y) => (x.id < y.id ? -1 : 1)),
    );
    const intensities = rotated.map((item) => item.intensity);
    for (let index = 1; index < intensities.length; index += 1) {
      expect(intensities[index]! <= intensities[index - 1]!).toBe(true);
    }
    // 组内成员集合未被改写（只换起点）
    expect(new Set(rotated.filter((item) => item.intensity === 3).map((item) => item.id))).toEqual(
      new Set(["a", "b"]),
    );
  });

  it("usedCardIds / recentCardIds / cooldown 语义不变：抽一张只写 recent，used 仍由 R3 终态推进", () => {
    const router = createV2MainlineRouter({ packId: TIE_FIXTURE.packId });
    const state = createV2SessionState({ sessionId: "fair-semantics", participants: TABLE_2M2F });
    const outcome = drawV2SessionCard(state, router, { intensityLimit: TIE_FIXTURE.intensityLimit });

    expect(outcome.kind).toBe("CARD");
    if (outcome.kind !== "CARD") return;
    expect(outcome.state.relationship.recentCardIds).toEqual([outcome.cardId]);
    expect(outcome.state.relationship.usedCardIds).toEqual([]);
    expect(state.relationship.recentCardIds).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* 5. P1#2（盐）：sessionId 作为稳定 draw salt                             */
/* ------------------------------------------------------------------ */

/**
 * 缺陷（P2-4）：`drawSeedFor` 只由 relationship 派生 ⇒ 同配置重开一局，整局抽卡序列逐字重复
 * （复盘实测：两局首 5 张与 20 张逐字一致）。真人连续玩几局会明显感知规律。
 *
 * 修法：把 `sessionId` 作为**稳定 salt** 纳入 seed。三条硬性质：
 * 1) 同 sessionId + 同状态 → 逐字复现（刷新/崩溃恢复不破坏重放）；
 * 2) 不同 sessionId + 同配置 → 顺序不同（候选集合与长度不变）；
 * 3) 仍只在**完全同优先级候选组内**改顺序（硬过滤/Coverage/Cooldown/D7/Signal/Heat/ceiling 一律不动）。
 */
describe("P1#2⑤｜sessionId 盐：同 session 复现、跨 session 不同", () => {
  it("同一 sessionId + 同一状态 → 逐字复现（同一 Router、两个实例、三层皆同）", () => {
    const request = input({ drawSessionSalt: "session-replay-fixed" });
    const a = createV2MainlineRouter({ packId: TIE_FIXTURE.packId });
    const b = createV2MainlineRouter({ packId: TIE_FIXTURE.packId });
    const ids = (cards: readonly { cardId: string }[]) => cards.map((card) => card.cardId);

    for (const tier of ["bucket", "pack", "global"] as const) {
      const first = ids(a[tier](request));
      expect(first.length).toBeGreaterThan(0);
      expect(ids(a[tier](request))).toEqual(first);
      expect(ids(b[tier](request))).toEqual(first);
    }
  });

  it("不同 sessionId + 同配置 → 顺序不同；候选集合与长度逐字不变", () => {
    const router = createV2MainlineRouter({ packId: TIE_FIXTURE.packId });
    const base = router.bucket(input({ drawSessionSalt: "session-A" })).map((card) => card.cardId);
    const other = router.bucket(input({ drawSessionSalt: "session-B" })).map((card) => card.cardId);

    expect(other).toHaveLength(base.length);
    expect([...other].sort()).toEqual([...base].sort()); // 只换顺序，不换集合
    expect(other).not.toEqual(base); // 顺序确实不同
  });

  it("64 个不同 sessionId → 首张覆盖多个卡 id（不再「同配置逐字重复」）", () => {
    const router = createV2MainlineRouter({ packId: TIE_FIXTURE.packId });
    const firsts: string[] = [];
    for (let i = 0; i < 64; i += 1) {
      const cards = router.bucket(input({ drawSessionSalt: `session-${i}` }));
      expect(cards.length).toBe(TIE_FIXTURE.expectedBucketSize);
      firsts.push(cards[0]!.cardId);
    }
    expect(new Set(firsts).size).toBeGreaterThan(4);
    expect(new Set(firsts.map(gameTypeOf))).toEqual(new Set(["truth", "dare"]));
  });

  it("dry-run 缺省不变：不传 salt 时 seed 与加盐前逐字节一致（旧调用方行为不变）", () => {
    const relationship = createInitialRelationshipState();
    // 未加盐的 key = 「六个状态字段 | 连接」；与历史实现逐字节相同 → 同值。
    expect(drawSeedFor(relationship)).toBe(2113212458);
    expect(drawSeedFor(relationship, "fixture")).toBe(2968762458);
    expect(drawSeedFor(relationship, "fixture")).not.toBe(drawSeedFor(relationship));
    expect(drawSeedFor(relationship, "fixture")).not.toBe(drawSeedFor(relationship, "fixture-2"));
  });

  it("固定 salt fixture 可复算：seed 与首 5 张逐字钉死", () => {
    const relationship = createInitialRelationshipState();
    const router = createV2MainlineRouter({ packId: TIE_FIXTURE.packId });
    const cards = router.bucket(input({ relationship, drawSessionSalt: "fixture" }));

    expect(drawSeedFor(relationship, "fixture")).toBe(2968762458);
    // A4a（2026-09-29）：26 张退役 `PN-TRUTH-2*` 已移出运行时卡源（含 I4 的 217/223），
    // 同 seed 的确定性序列按新候选集重算（仍是逐字钉死）；口径与 C1-8 的同类重算一致。
    expect(cards.map((card) => card.cardId).slice(0, 5)).toEqual([
      "PN-DARE-032",
      "PN-DARE-033",
      "PN-DARE-034",
      "PN-DARE-035",
      "PN-DARE-036",
    ]);
  });

  it("生产主链走 session salt：同 sessionId 的恢复态复现同一张，换 sessionId 序列不同", () => {
    const router = createV2MainlineRouter({ packId: TIE_FIXTURE.packId });
    const drawFirst = (sessionId: string) =>
      drawV2SessionCard(createV2SessionState({ sessionId, participants: TABLE_2M2F }), router, { intensityLimit: TIE_FIXTURE.intensityLimit });

    const a1 = drawFirst("prod-session-replay");
    const a2 = drawFirst("prod-session-replay");
    const b1 = drawFirst("prod-session-other");
    expect(a1.kind).toBe("CARD");
    expect(a2.kind).toBe("CARD");
    expect(b1.kind).toBe("CARD");
    if (a1.kind !== "CARD" || a2.kind !== "CARD" || b1.kind !== "CARD") return;
    expect(a1.cardId).toBe(a2.cardId); // 同 sessionId → 可复现
    expect(b1.cardId).not.toBe(a1.cardId); // 不同 sessionId → 序列不同
  });
});

/* ------------------------------------------------------------------ */
/* 6. 60+ 个不同 session 的曝光公平性（sessionId 盐生效后仍 ±18%）            */
/* ------------------------------------------------------------------ */

describe("P1#2⑥｜跨 session 曝光公平性（sessionId 盐生效后）", () => {
  it("64 局 × 20 轮：truth / dare 曝光收入同一量级（±18%，沿用既有阈值）", () => {
    const FAIR_SHARE_TOLERANCE = 0.18;
    const SESSIONS = 64;
    const ROUNDS = 20;
    const counters: Record<string, number> = { truth: 0, dare: 0 };

    for (let session = 0; session < SESSIONS; session += 1) {
      const rnd = mulberry32(20260927 + session * 7919);
      let state = createV2SessionState({ sessionId: `salt-fair-${session}`, participants: TABLE_2M2F });
      const router = createV2MainlineRouter({ packId: TIE_FIXTURE.packId });

      let completed = 0;
      let guard = 0;
      while (completed < ROUNDS && guard < 1000) {
        guard += 1;
        const outcome = drawV2SessionCard(state, router, { intensityLimit: TIE_FIXTURE.intensityLimit });
        if (outcome.kind !== "CARD") break;
        const type = gameTypeOf(outcome.cardId);
        if (type in counters) counters[type] += 1;

        const terminal = rnd() < 0.85 ? "completed" : "skipped";
        const event = eventForRoundTerminal(
          { id: `salt-${session}-${guard}`, packId: TIE_FIXTURE.packId, cardId: outcome.cardId, participantIds: [] } as never,
          terminal as never,
          new Date(0).toISOString(),
        );
        state = reduceV2SessionEvents(state, [event]).state;
        if (terminal === "completed") completed += 1;
      }
    }

    const truth = counters.truth ?? 0;
    const dare = counters.dare ?? 0;
    const total = truth + dare;
    expect(total).toBeGreaterThan(500);
    expect(truth).toBeGreaterThan(0);
    expect(dare).toBeGreaterThan(0);
    expect(Math.abs(dare - truth) / total).toBeLessThanOrEqual(FAIR_SHARE_TOLERANCE);
  }, MONTE_CARLO_TIMEOUT_MS);
});
