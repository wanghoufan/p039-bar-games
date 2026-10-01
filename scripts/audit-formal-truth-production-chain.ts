/**
 * C1-8｜§十八 第一段｜Formal Truth 真实生产链落盘证据。
 *
 * 与 `tests/integration/v2-formal-truth-production-chain.test.ts` 同一条链、同一批断言对象，
 * 差别只在本文件把逐轮证据落成 JSON 产物（测试是门禁，本文件是证据）。
 *
 * 链：`startRound`（唯一出题入口 → createDeckRouter 生产 Router）→
 *     `resolveRoundAndReduce(session,'complete',roundDisclosureSignal(...))` →
 *     `eventForRoundTerminal`（卡侧 metadata 走生产 sidecar）→ `reduceV2SessionEvents`
 *     → `relationshipEffectiveCardCount` / `Heat`。
 *
 * R0-2：四种情形的 `note` 与 `firstReachRoundByHeat` **一律由实际运行结果派生**
 * （`deriveHeatReachNote`，见 `scripts/audit-formal-truth-heat-note.ts`），
 * 不再出现「数据说没到 H2、note 却说逐档 H1→H4」这类自相矛盾。派生器纯函数、单测可构造反例。
 *
 * 产物：`docs/qa/content-audit/FORMAL-TRUTH-PRODUCTION-CHAIN.json`
 */
import { writeFileSync } from "node:fs";

import { DEFAULT_BOUNDARIES } from "@/lib/domain/constants";
import type { GameCard, GameSession, Player, SessionConfig } from "@/lib/domain/schemas";
import {
  createSession,
  resolveRoundAndReduce,
  roundDisclosureSignal,
  startRound,
} from "@/lib/engine/session-engine";
import { drawDeckCard, relationshipOf } from "@/lib/engine/v2-deal";
import { formalFixedIdSet } from "@/lib/v2-content/fixed-content-manifest";
import { FORMAL_TRUTH_BOOTSTRAP_CARDS } from "@/lib/v2-content/formal-truth-bootstrap-pack";
import { mainlineCardMetaById, mainlineSsotCardsByPack } from "@/lib/v2-content/v2-card-bridge";
import { metadataForCard } from "@/lib/v2-content/v2-card-quality-index";
import { HEAT_THRESHOLDS } from "@/lib/v2-relationship/v2-state";

import { deriveHeatReachNote, type CountableCard } from "./audit-formal-truth-heat-note";

const ROOT = process.cwd();
const PACK_ID = "truth-dare";
const FIXED_DRAW_SEED = 1;

const players = (): Player[] =>
  ["a", "b", "c", "d"].map((id) => ({ id, displayName: `玩家${id}`, active: true, createdAt: "x", lastUsedAt: "x" }));
const participants = () => [
  { playerId: "a", active: true, pairGender: "male" as const },
  { playerId: "b", active: true, pairGender: "female" as const },
  { playerId: "c", active: true, pairGender: "male" as const },
  { playerId: "d", active: true, pairGender: "female" as const },
];
const config = (): SessionConfig => ({
  players: players(), relationship: "friends", vibes: ["funny"], intensity: 5,
  boundaries: DEFAULT_BOUNDARIES, enabledPackIds: [PACK_ID], mode: "single",
});

const PACK_CARDS = mainlineSsotCardsByPack(PACK_ID);
/**
 * 「Formal」用 manifest 真源 `formalFixedIdSet()` 判定，不用 `PN-TRUTH-2*` 前缀推断。
 *
 * B5/A3 口径（2026-09-29）：Bootstrap 7 张（`PN-TRUTH-225~231`）过独立审查后，**A3 又按 Human
 * 冻结的新内容基线逐卡审计**，其中只有 `PN-TRUTH-227/229` 保持 Formal，其余 5 张已退出 Formal。
 * 本脚本保留「仅 Bootstrap 7 张」这一**子集**情形（看该子集单独能走到哪一档），其 Formal 归属
 * 逐张按 `formalFixedIdSet()` 判，**不得**整批当成 Formal。
 */
const FORMAL_ID_SET = formalFixedIdSet();
const FORMAL_CARDS = PACK_CARDS.filter((card) => FORMAL_ID_SET.has(card.id));
const BOOTSTRAP_ID_SET = new Set(FORMAL_TRUTH_BOOTSTRAP_CARDS.map((card) => card.cardId));
const BOOTSTRAP_CARDS = PACK_CARDS.filter((card) => BOOTSTRAP_ID_SET.has(card.id));
const LEGACY_CARDS = PACK_CARDS.filter((card) => !card.id.startsWith("PN-TRUTH-2"));

interface ChainRound {
  round: number;
  cardId: string;
  formal: boolean;
  informationGain: string | null;
  topic: string | null;
  effectiveCount: number;
  heat: string;
}

/** 终止观测：跑满上限 ⇒ `outcome=null`；否则为耗尽分类（只读复算，不写回 session）。 */
interface ChainTerminal {
  afterRound: number;
  outcome: string | null;
}

const drive = (deck: readonly GameCard[], drawSeed: number, maxRounds = 20) => {
  let session: GameSession = createSession(config(), [...deck], participants());
  const rounds: ChainRound[] = [];
  let terminal: ChainTerminal = { afterRound: maxRounds, outcome: null };
  for (let i = 0; i < maxRounds; i += 1) {
    const dealt = startRound(session, () => 0, { drawSeed });
    if (!dealt.currentRound) {
      // 只读探测：与 `startRound` 的 single 模式入参同形复算一次抽卡结果，拿到耗尽分类。
      // 纯读（不写回 session、不改链路），只为把「第几轮为什么不再出卡」变成可落盘的数据。
      const probe = drawDeckCard({
        session: dealt,
        preferredPackIds: [dealt.currentPackId],
        enabledPackIds: [dealt.currentPackId],
        drawSeed,
      });
      terminal = { afterRound: i, outcome: probe.outcome.kind };
      break;
    }
    const cardId = dealt.currentRound.cardId;
    const meta = metadataForCard(cardId);
    session = resolveRoundAndReduce(
      dealt, "complete",
      roundDisclosureSignal({ selfDisclosed: true, disclosedPlayerIds: [["a", "b"][i % 2]!] }),
    );
    const rel = relationshipOf(session);
    rounds.push({
      round: i + 1, cardId, formal: FORMAL_ID_SET.has(cardId),
      informationGain: meta.informationGain, topic: meta.topic,
      effectiveCount: rel.relationshipEffectiveCardCount, heat: rel.heat,
    });
  }
  const rel = relationshipOf(session);
  return {
    rounds,
    finalHeat: rel.heat,
    finalEffective: rel.relationshipEffectiveCardCount,
    terminal,
  };
};

/**
 * 牌堆里**卡侧可形成有效信息轮**的卡（`isEffectiveInformationRound` 的卡侧前置条件：
 * `informationGain` 非 null 且非 zero/low、`topic` 非 null），带上其 Heat 合法区间。
 * 供 note 现算「某档以下到底有多少张卡能累积有效轮」——不允许写死张数。
 */
const countableCardsOf = (deck: readonly GameCard[]): CountableCard[] => {
  const out: CountableCard[] = [];
  for (const card of deck) {
    const meta = metadataForCard(card.id);
    if (meta.informationGain === null || meta.informationGain === "zero" || meta.informationGain === "low") continue;
    if (meta.topic === null) continue;
    const cardMeta = mainlineCardMetaById(card.id);
    if (!cardMeta || !("heatMin" in cardMeta)) continue;
    out.push({ cardId: card.id, heatMin: cardMeta.heatMin, heatMax: cardMeta.heatMax });
  }
  return out;
};

/* 情形 1：全包真实牌堆（seed=1）——Formal / legacy 混堆；本 seed 实测结果以 note 为准。 */
const fullPack = drive(PACK_CARDS, FIXED_DRAW_SEED);
/* 情形 2：仅 Formal ${FORMAL_CARDS.length} 张（真实生产卡子集）——H1 桶抽满后 Heat 是否升档以 note 为准。 */
const formalOnly = drive(FORMAL_CARDS, FIXED_DRAW_SEED);
/* 情形 2b：仅 Bootstrap 7 张（其中仅 227/229 属 Formal，其余 5 张已退出；单独驱动看子集天花板）。 */
const bootstrapOnly = drive(BOOTSTRAP_CARDS, FIXED_DRAW_SEED);
/* 情形 3：负向对照（仅 legacy）——sidecar 恒 null ⇒ 有效计数 0 / Heat 恒 H1。 */
const legacyOnly = drive(LEGACY_CARDS, FIXED_DRAW_SEED);

/* 牌堆描述与 note 标签共用同一常量：note 的开头因此可从产物反推，便于「复算 note」校验。 */
const rangeOf = (cards: readonly { id: string }[]): string => {
  const numbers = cards
    .map((card) => Number(/^PN-TRUTH-(\d+)$/u.exec(card.id)?.[1] ?? NaN))
    .filter((n) => Number.isFinite(n));
  return numbers.length === 0 ? "（无）" : `PN-TRUTH-${Math.min(...numbers)}~${Math.max(...numbers)}`;
};
const FULL_PACK_DECK = `mainlineSsotCardsByPack('${PACK_ID}')（${PACK_CARDS.length} 张，含 Formal ${FORMAL_CARDS.length} + legacy ${LEGACY_CARDS.length}）`;
const FORMAL_ONLY_DECK = `仅 Formal（manifest 轨）${FORMAL_CARDS.length} 张（${rangeOf(FORMAL_CARDS)}，真实生产卡）`;
const BOOTSTRAP_ONLY_DECK = `仅 Bootstrap ${BOOTSTRAP_CARDS.length} 张（${rangeOf(BOOTSTRAP_CARDS)}；其中仅 227/229 属 Formal，其余 5 张已退出 Formal）`;
const LEGACY_ONLY_DECK = `仅 legacy 卡（${LEGACY_CARDS.length} 张，无 Formal）`;

/* note 一律由运行结果现算（含未到达档的原因与缺口数），四种情形同源同口径。 */
const fullPackNote = deriveHeatReachNote({
  label: FULL_PACK_DECK,
  rounds: fullPack.rounds,
  finalHeat: fullPack.finalHeat,
  finalEffective: fullPack.finalEffective,
  thresholds: HEAT_THRESHOLDS,
  countableCards: countableCardsOf(PACK_CARDS),
});
const formalOnlyNote = deriveHeatReachNote({
  label: FORMAL_ONLY_DECK,
  rounds: formalOnly.rounds,
  finalHeat: formalOnly.finalHeat,
  finalEffective: formalOnly.finalEffective,
  thresholds: HEAT_THRESHOLDS,
  countableCards: countableCardsOf(FORMAL_CARDS),
});
const bootstrapOnlyNote = deriveHeatReachNote({
  label: BOOTSTRAP_ONLY_DECK,
  rounds: bootstrapOnly.rounds,
  finalHeat: bootstrapOnly.finalHeat,
  finalEffective: bootstrapOnly.finalEffective,
  thresholds: HEAT_THRESHOLDS,
  countableCards: countableCardsOf(BOOTSTRAP_CARDS),
});
const legacyOnlyNote = deriveHeatReachNote({
  label: LEGACY_ONLY_DECK,
  rounds: legacyOnly.rounds,
  finalHeat: legacyOnly.finalHeat,
  finalEffective: legacyOnly.finalEffective,
  thresholds: HEAT_THRESHOLDS,
  countableCards: countableCardsOf(LEGACY_CARDS),
});

/* 全包 200 seed 扫描：生产实况的 Heat 到达率（诚实口径，不挑 seed） */
const SWEEP = 200;
const sweep = { sessions: SWEEP, reachedH2: 0, reachedH3: 0, reachedH4: 0, effectiveSum: 0, heatDistribution: {} as Record<string, number> };
for (let seed = 1; seed <= SWEEP; seed += 1) {
  const res = drive(PACK_CARDS, seed);
  sweep.effectiveSum += res.finalEffective;
  sweep.heatDistribution[res.finalHeat] = (sweep.heatDistribution[res.finalHeat] ?? 0) + 1;
  const order = ["H1", "H2", "H3", "H4"];
  if (order.indexOf(res.finalHeat) >= 1) sweep.reachedH2 += 1;
  if (order.indexOf(res.finalHeat) >= 2) sweep.reachedH3 += 1;
  if (order.indexOf(res.finalHeat) >= 3) sweep.reachedH4 += 1;
}

const out = {
  generator: "scripts/audit-formal-truth-production-chain.ts",
  requirement: "§十八：Formal Truth → Router 可出 → metadata 进入 production event → effective count 推进 → （待验证：Heat 能否逐档 H1→H2→H3→H4；实测结果如实见各 scenario 的 firstReachRoundByHeat / finalHeat / note，本字段不是结论）",
  chain: [
    "startRound（唯一出题入口 → drawDeckCard → createDeckRouter 生产 Router 三层计数）",
    "resolveRoundAndReduce(session,'complete',roundDisclosureSignal({selfDisclosed, disclosedPlayerIds}))",
    "eventForRoundTerminal（卡侧 metadata 由 metadataForCard 读生产 sidecar；轮侧披露由正式信号提供）",
    "reduceV2SessionEvents → relationshipEffectiveCardCount / heatForEffectiveCount",
  ],
  disclosure: `本文件与 integration 测试均不注入 metadata override；Formal ${FORMAL_CARDS.length} 张（其中含 A3 KEEP 保留的 5 张）与已退出 Formal 的 26 张旧卡的 informationGain/topic 都来自生产 sidecar 真实投影；无 §7.2 metadata 的 SSOT 旧卡 sidecar 恒 null（fail-closed 不计有效轮）。`,
  seed: FIXED_DRAW_SEED,
  table: "2男2女（a男/b女/c男/d女，合法 pair 全程可用）",
  scenarioFullPack: {
    deck: FULL_PACK_DECK,
    rounds: fullPack.rounds,
    finalHeat: fullPack.finalHeat,
    finalEffective: fullPack.finalEffective,
    terminal: fullPack.terminal,
    firstReachRoundByHeat: fullPackNote.firstReachRoundByHeat,
    note: fullPackNote.note,
  },
  scenarioFormalOnly: {
    deck: FORMAL_ONLY_DECK,
    rounds: formalOnly.rounds,
    finalHeat: formalOnly.finalHeat,
    finalEffective: formalOnly.finalEffective,
    terminal: formalOnly.terminal,
    firstReachRoundByHeat: formalOnlyNote.firstReachRoundByHeat,
    note: formalOnlyNote.note,
  },
  scenarioBootstrapOnly: {
    deck: BOOTSTRAP_ONLY_DECK,
    rounds: bootstrapOnly.rounds,
    finalHeat: bootstrapOnly.finalHeat,
    finalEffective: bootstrapOnly.finalEffective,
    terminal: bootstrapOnly.terminal,
    firstReachRoundByHeat: bootstrapOnlyNote.firstReachRoundByHeat,
    note: bootstrapOnlyNote.note,
  },
  scenarioLegacyOnly: {
    deck: LEGACY_ONLY_DECK,
    rounds: legacyOnly.rounds,
    finalHeat: legacyOnly.finalHeat,
    finalEffective: legacyOnly.finalEffective,
    terminal: legacyOnly.terminal,
    firstReachRoundByHeat: legacyOnlyNote.firstReachRoundByHeat,
    note: legacyOnlyNote.note,
  },
  fullPackSeedSweep: { ...sweep, effectiveMean: +(sweep.effectiveSum / SWEEP).toFixed(2) },
};

writeFileSync(`${ROOT}/docs/qa/content-audit/FORMAL-TRUTH-PRODUCTION-CHAIN.json`, JSON.stringify(out, null, 2));

console.log("Formal Truth 真实生产链证据已落盘");
console.log("全包 seed=1：轮", fullPack.rounds.length, "｜effective", fullPack.finalEffective, "｜Heat", fullPack.finalHeat,
  "｜终止", JSON.stringify(fullPack.terminal), "｜首达", JSON.stringify(out.scenarioFullPack.firstReachRoundByHeat));
console.log("仅 Formal seed=1：轮", formalOnly.rounds.length, "｜effective", formalOnly.finalEffective, "｜Heat", formalOnly.finalHeat,
  "｜终止", JSON.stringify(formalOnly.terminal), "｜首达", JSON.stringify(out.scenarioFormalOnly.firstReachRoundByHeat));
console.log("仅 Bootstrap 7 张 seed=1：轮", bootstrapOnly.rounds.length, "｜effective", bootstrapOnly.finalEffective, "｜Heat", bootstrapOnly.finalHeat,
  "｜终止", JSON.stringify(bootstrapOnly.terminal), "｜首达", JSON.stringify(out.scenarioBootstrapOnly.firstReachRoundByHeat));
console.log("仅 legacy seed=1：轮", legacyOnly.rounds.length, "｜effective", legacyOnly.finalEffective, "｜Heat", legacyOnly.finalHeat,
  "｜终止", JSON.stringify(legacyOnly.terminal));
console.log("NOTE[formal]", out.scenarioFormalOnly.note);
console.log("NOTE[bootstrap]", out.scenarioBootstrapOnly.note);
console.log("NOTE[legacy]", out.scenarioLegacyOnly.note);
console.log("全包 200 seed：", JSON.stringify(out.fullPackSeedSweep));
