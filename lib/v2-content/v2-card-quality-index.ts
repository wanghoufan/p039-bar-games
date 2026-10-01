/**
 * V2CardQualityIndex｜§3 metadata 的**运行期侧车索引**（卡片质量元数据的唯一运行期出口）。
 *
 * ## 为什么需要它
 * §7.2 的「有效信息轮」判定（`isEffectiveInformationRound`）必须逐轮拿到两样东西：
 * 本卡的 `informationGain`（信息增量档）与 `topic`（主主题）。但这两个字段**不属于** SSOT 冻结
 * schema 2.3，也不属于运行期 `GameCard`（`lib/domain/schemas.ts`）——Plan §3:41 明确说它们是
 * 「**新固定题库的目标合同**，不是声称当前 V1.3 schema 已有这些字段」。
 *
 * SSOT 三件套（`generated/v2-ssot.generated.json` 及其哈希）本批**零改动**是硬约束，
 * 于是质量字段既不能塞进 SSOT 真源、也不能改 `GameCard`。做法是**侧车**：
 * 用稳定 `cardId` 把「题面」（SSOT）与「质量元数据」（本索引）关联起来，两者各走各的生命周期，
 * 校验与追溯完成前仍可分离保存（Plan §3:41「可以在构建前 sidecar 保存质量字段」）。
 *
 * ## fail-closed：未补标 = `null`，不是默认档
 * `metadataForCard()` 对「不在索引里」「索引里是 `null`」「枚举非法」一律返回
 * `{ informationGain: null, topic: null }`。**不猜、不默认 `medium`、不按题型硬编码**
 * （按 `interactionType` 猜「本人揭晓」是被明令禁止的捷径）。
 * 判定侧的 `isEffectiveInformationRound` 再把 `null` 解释为「不计有效轮」——
 * 于是「没补标的卡」不可能靠默认值推进 Heat、凑出认识证据或打开互选窗口。
 *
 * ## 与 `fixed-content-manifest.json` 的关系
 * 两者是**两件事**，互不替代：
 * - manifest 是**准入门**：卡能不能进正式固定主线（正向允许清单 + 快照 hash 可复算）；
 *   两轨各有自己的 hash：Legacy Compatibility 轨（`tracks.legacyCompatibility.snapshotHash`）与
 *   Formal Fixed 轨（`tracks.formalFixed.snapshotHash`，当前 0 张）；
 * - 本索引是**运行期元数据**：这张卡本轮到底算不算有效信息轮。
 * 索引不进 manifest 的 `snapshotHash`：hash 的口径是「冻结快照内容可复算」，
 * 而 metadata 回填是**分批推进**的独立过程（CONTENT-01 逐题补标），
 * 把它并进 hash 会让每补一张卡都必须重冻快照、重跑受影响 RG。快照 hash 的门禁边界不动。
 * 代价是「补标后的 metadata 不进快照 hash」——由本模块的 `qualityIndexSize()` 与
 * manifest 的 `tracks.legacyCompatibility.counts.auditedMetadata` 两处统计交叉核对来兜底。
 *
 * ## 零依赖约束
 * 运行期（浏览器 + 服务端）会 import 本模块，因此这里**不 import `node:*`、不 import 业务层**，
 * 只依赖同目录的纯模块 `v2-card-metadata`（枚举真源）、`v2-types`（SSOT 卡类型）
 * 与 `v2-content-adapter`（SSOT 唯一读取出口）。
 */

import {
  V2_INFORMATION_GAIN,
  V2_TOPICS,
  type V2RoundMetadataFields,
} from "./v2-card-metadata";
import { FORMAL_TRUTH_BOOTSTRAP_CARDS } from "./formal-truth-bootstrap-pack";
import { FORMAL_TRUTH_CARDS, type FormalTruthCard } from "./formal-truth-pack";
import { PACK1_ADMISSION_RUNTIME_CARDS } from "./pack1-admission";
import type { V13ExpansionCard, V13MainlineCard } from "./v2-types";
import { getV2ContentAdapter } from "./v2-content-adapter";

const INFORMATION_GAIN_SET: ReadonlySet<string> = new Set<string>(V2_INFORMATION_GAIN);
const TOPIC_SET: ReadonlySet<string> = new Set<string>(V2_TOPICS);

/** 未补标 / 索引未命中时的统一回执：两项皆 `null`（fail-closed 的输入侧表达）。 */
export const UNAUDITED_ROUND_METADATA: V2RoundMetadataFields = Object.freeze({
  informationGain: null,
  topic: null,
});

/** 侧车索引：`cardId → §7.2 元数据`。只含**已在索引里**的卡（未命中的卡不进表）。 */
export type V2CardQualityIndex = ReadonlyMap<string, V2RoundMetadataFields>;

/**
 * 运行期覆盖层（**测试 / CI 专用**）：`cardId → §7.2 元数据`。
 *
 * 生产恒为空；只有测试/CI 在需要「已补标卡」时用
 * `resetCardQualityIndexCache()` + `setCardQualityIndexOverrides()` 临时注入。
 *
 * 为什么不直接在测试里改 SSOT：SSOT 三件套（generated json + SHA256）本批**零改动**是硬约束，
 * 且「补标」按 Plan 是逐题分批推进的独立过程。覆盖层让测试能在不碰真源的前提下
 * 驱动「已审卡 → 有效信息轮 → 认识证据 → Mutual due」这条**真实生产链**，
 * 同时生产侧行为完全不变（未注入即恒为 SSOT 投影）。
 */
let overrides: ReadonlyMap<string, V2RoundMetadataFields> = new Map();

/**
 * 从一张**冻结 SSOT 卡**投影出侧车行（只取 §7.2 需要的两项）。
 *
 * 刻意不做「缺字段就补默认档」的兜底：当前 V1.3 冻结 SSOT 一张都没有这两个字段，
 * 于是全部投影为 `null`——这正是想要的诚实结果（未补标就是不计数），
 * 而不是「静默按 medium 计入」把未审内容混进有效轮。
 *
 * 枚举非法（非 `zero/low/medium/high` 或非 §4 主题）同样按**未补标**处理：
 * 运行期计数通道宁可判为未补标，也不放行非法值。
 * （内容审查/入库侧另有 `validateFixedCardMetadataStrict` 的 fail-closed 门禁，
 * 职责是「该不该入库」，与本模块「本轮算不算有效轮」互不替代。）
 */
/** 侧车索引的卡来源：SSOT 主线 + 扩圈 + 第一包正式内容（质量字段同一条读取路径）。 */
type QualityIndexSourceCard = V13MainlineCard | V13ExpansionCard | FormalTruthCard;

function projectFromSsot(card: QualityIndexSourceCard): V2RoundMetadataFields {
  const record = card as unknown as Record<string, unknown>;
  const rawGain = record.informationGain;
  const rawTopic = record.topic;
  const informationGain =
    typeof rawGain === "string" && INFORMATION_GAIN_SET.has(rawGain)
      ? (rawGain as V2RoundMetadataFields["informationGain"])
      : null;
  const topic = typeof rawTopic === "string" && TOPIC_SET.has(rawTopic) ? rawTopic : null;
  return Object.freeze({ informationGain, topic });
}

/**
 * 内容卡（主线 + 扩圈 + 第一包正式内容 + Truth H1 Bootstrap + **A9 第一包重构批**）——
 * 与 `v2-card-bridge` 同一个单例 adapter 出口 + 同一份内容源，不另开第二条真源。
 * 自带 `topic` / `informationGain` 的卡其侧车行**非 null**，运行期 §7.2 有效轮判定对新卡真正生效；
 * 旧 SSOT 卡仍投影为双 `null`（未补标 = 不计数）。
 *
 * ⚠️ A9（2026-09-29）：第一包重构批（`PN-TRUTH-232~283` 号段）经准入后已是 Formal，
 * 桥接（`mainlineSsotCards()` / `mainlineRuntimeCards()`）会把它们放进生产牌堆；
 * 若本侧车不收它们，生产链 `eventForRoundTerminal()`（唯一取 meta 处）对这批卡读到双 `null`
 * ⇒ 新 Formal 卡永远计不了有效信息轮、Heat 推不动（「出卡卡源」与「计数 metadata 卡源」漂移）。
 * 故这里并入**与桥接同一份运行期投影** `PACK1_ADMISSION_RUNTIME_CARDS`（含已落地的待收字段、
 * 且已剥掉 planning-only 三字段），保证两处卡源逐 id 一致。
 * A9-R6（2026-09-29 内容裁决）：该批退役 236/263/277 ⇒ 现役张数由卡源派生。
 */
function ssotRawCards(): readonly QualityIndexSourceCard[] {
  const adapter = getV2ContentAdapter();
  return [
    ...(adapter.mainlineCards as readonly V13MainlineCard[]),
    ...(adapter.expansionCards as readonly V13ExpansionCard[]),
    ...(FORMAL_TRUTH_CARDS as readonly FormalTruthCard[]),
    // R2/R3｜Truth H1 Bootstrap：自带质量字段 ⇒ 侧车有档位（是否入 Formal 由 manifest 准入决定，与此无关）。
    ...(FORMAL_TRUTH_BOOTSTRAP_CARDS as readonly FormalTruthCard[]),
    // A9｜第一包重构批（现役）：与桥接同源，保证有效轮计数通道看得到这批 Formal 卡（A9-R6 退 236/263/277）。
    ...(PACK1_ADMISSION_RUNTIME_CARDS as readonly FormalTruthCard[]),
  ];
}

let cache: V2CardQualityIndex | null = null;

/**
 * 当前运行期质量索引（懒构建一次，冻结复用）。
 *
 * 逐题补标落地时，**只改冻结卡上的 `topic` / `informationGain` 两个可选字段**，
 * 本索引与运行期判定自动跟随，不需要改 reducer、不需要改事件契约、不需要动 SSOT。
 */
export function v2CardQualityIndex(): V2CardQualityIndex {
  if (cache) return cache;
  const index = new Map<string, V2RoundMetadataFields>();
  for (const card of ssotRawCards()) {
    // 覆盖层优先（测试/CI 注入的「已补标」事实）；生产无覆盖，等价于纯 SSOT 投影。
    index.set(card.cardId, overrides.get(card.cardId) ?? projectFromSsot(card));
  }
  cache = index;
  return index;
}

/**
 * 取某张卡的 §7.2 元数据；**未补标一律 `{ informationGain: null, topic: null }`**（fail-closed）。
 *
 * 调用方（`eventForRoundTerminal`）拿到 `null` 后照实写进事件，
 * 由 `isEffectiveInformationRound` 判为「非有效信息轮」——判定口径唯一在 reducer，不在本模块。
 */
export function metadataForCard(cardId: string | undefined): V2RoundMetadataFields {
  if (!cardId) return UNAUDITED_ROUND_METADATA;
  return v2CardQualityIndex().get(cardId) ?? UNAUDITED_ROUND_METADATA;
}

/**
 * 索引里**真正带了信息增量档**的卡数（运行期可用档位统计）。
 * 与 manifest 的 `counts.auditedMetadata` 口径不同、互为交叉核对：
 * 后者统计「卡是否带齐 Plan §3 全部必填字段」（入库口径），前者统计「§7.2 判定能否用上档位」。
 */
export function qualityIndexSize(): number {
  let count = 0;
  for (const row of v2CardQualityIndex().values()) {
    if (row.informationGain !== null) count += 1;
  }
  return count;
}

/** 测试 / 复算专用：清空懒缓存（生产路径不需要）。 */
export function resetCardQualityIndexCache(): void {
  cache = null;
}

/**
 * 测试 / CI 专用：注入「已补标」覆盖层（`cardId → { informationGain, topic }`）。
 * 传空 Map 即还原为纯 SSOT 投影。**生产代码不得调用**。
 */
export function setCardQualityIndexOverrides(
  next: ReadonlyMap<string, V2RoundMetadataFields> | Record<string, V2RoundMetadataFields>,
): void {
  overrides = next instanceof Map ? next : new Map(Object.entries(next));
  cache = null;
}
