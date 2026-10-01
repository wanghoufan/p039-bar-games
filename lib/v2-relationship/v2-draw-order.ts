/**
 * D2 / P1#2｜同优先级候选的确定性 tie-break 轮换（Router 出卡顺序）。
 *
 * 背景（冻结契约）：PRODUCT_PLAN_V2.0 §User Flow :62 冻结的 Router 管线最后一步是
 * `Coverage/Cooldown → drawBand → 随机选卡`。实现里 `sortCards`（强度降序 + cardId 升序）
 * 之后直接由编排器取首张，于是同强度候选的曝光恒等于「cardId 字典序最小者」——
 * 同一 `truth-dare` 包内 `PN-DARE-*` 恒排在 `PN-TRUTH-*` 之前，大冒险被系统性饿死
 * （Phase A.2 实测 dare 15,359 : truth 704 ≈ 21.8:1）。
 *
 * 本模块只回答一个问题：**优先级完全相同（同强度）的候选里先出哪一张**。
 * 边界（不得越界）：
 * - 不改任何过滤与优先级顺序（pack capability → Intensity 上限 → Heat 硬过滤 →
 *   target/pair 合法性 → card metadata/边界/同意 → Coverage/Cooldown → drawBand）；
 *   只在**同强度组内**做循环移位，组间仍按强度降序 —— 这是调用方排序后才会用到的最后一步。
 * - 不改候选集合：只重排，不增删（`bucket/pack/global` 的计数口径逐字不变）。
 * - 不改单次抽卡张数、`usedCardIds` / `recentCardIds` / cooldown 语义。
 *
 * 「可复现随机」为什么等价：seed 由 `relationship` 状态（Heat、两个计数器、
 * `exhaustionCycle`、`usedCardIds`、`recentCardIds`）+ **session salt** 派生，不读 `Date` /
 * `Math.random` / 隐藏可变状态。因此
 * - 同一 `(sessionId, 局面)` 重放 ⇒ 同一 seed ⇒ 同一顺序（逐字一致，跨进程/跨设备一致）；
 * - 局面每轮必变（出卡即写 `recentCardIds`，终态即写 `usedCardIds`，计数/Heat 单调推进）
 *   ⇒ seed 每轮不同 ⇒ 组内起点轮换，长期曝光不再被字典序垄断；
 * - **session salt**（`drawSessionSalt`，生产= `sessionId`）让「同配置重开一局」不再逐字复现旧局
 *   的整局序列：换一局 = 换 salt = 换 seed 序列；salt 缺省（`undefined`）时 key 与加盐前**逐字节一致**，
 *   旧调用方/旧测试行为不变。
 * 本文件不引入第二套随机源：不 import 旧 selector / 旧权重，也不用 `Math.random`。
 */

import type { RelationshipState } from "./v2-state";

/** 32 位字符串哈希（FNV-1a），纯函数、跨平台位运算一致。 */
function hash32(text: string): number {
  let hash = 0x811c9dc5 >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** 32 位整数混合（splitmix32 终混的简化式），把相邻 seed 打散到全值域。 */
function mix32(value: number): number {
  let mixed = (value + 0x9e3779b9) >>> 0;
  mixed = Math.imul(mixed ^ (mixed >>> 16), 0x21f0aaad) >>> 0;
  mixed = Math.imul(mixed ^ (mixed >>> 15), 0x735a2d97) >>> 0;
  return (mixed ^ (mixed >>> 15)) >>> 0;
}

/**
 * 由 `relationship` 状态 + 轮次（+ 可选 session salt）派生的确定性 draw seed。
 *
 * 取 Heat / `relationshipEffectiveCardCount` / `sessionCompletedRounds` /
 * `exhaustionCycle` / `usedCardIds` / `recentCardIds` 六个可序列化字段拼键后哈希：
 * 全部是 Session 恢复后仍然存在的状态，所以重放（刷新 / 崩溃恢复 / 同 seed 复算）
 * 一定得到同一 seed，而任何一次出卡或终态都会改动其中至少一项。
 *
 * `sessionSalt`（生产由编排器传 `sessionId`，见 `v2-session.ts#sessionRouterInput`）是
 * **稳定 salt**：同一 sessionId + 同一状态 → 逐字复现（崩溃/刷新恢复不破坏重放）；
 * 不同 sessionId + 同配置 → 序列不同（不再出现「同配置重开一局整局序列逐字重复」）。
 * **缺省 `undefined` 时 key 与加盐前逐字节一致**，因此旧调用方与既有测试的默认行为不变。
 */
export function drawSeedFor(relationship: RelationshipState, sessionSalt?: string): number {
  const base = [
    relationship.heat,
    relationship.relationshipEffectiveCardCount,
    relationship.sessionCompletedRounds,
    relationship.exhaustionCycle,
    relationship.usedCardIds.join(","),
    relationship.recentCardIds.join(","),
  ].join("|");
  const key = sessionSalt === undefined ? base : `${base}|${sessionSalt}`;
  return mix32(hash32(key));
}

/** 同强度组内的轮换偏移：同 seed + 同强度 ⇒ 同偏移（可复现）；不同局面 ⇒ 起点逐轮轮换。 */
function rotationOffset(seed: number, intensity: number, length: number): number {
  if (length <= 1) return 0;
  return mix32(seed ^ Math.imul(intensity + 1, 0x9e3779b9)) % length;
}

/**
 * 在**已按强度降序排定**的候选序列上，对每一段连续同强度组做确定性循环移位。
 *
 * - 组间顺序不变（强度降序这一既有优先级不动），只有组内起点由 seed 决定；
 * - 返回值长度与元素集合和入参完全一致（只重排）；
 * - 同一 `(sorted, intensityOf, seed)` 必得逐字一致的结果。
 */
export function orderByTieBreakRotation<T>(
  sorted: readonly T[],
  intensityOf: (card: T) => number,
  seed: number,
): T[] {
  const ordered: T[] = [];
  let start = 0;
  while (start < sorted.length) {
    const intensity = intensityOf(sorted[start]!);
    let end = start + 1;
    while (end < sorted.length && intensityOf(sorted[end]!) === intensity) end += 1;
    const group = sorted.slice(start, end);
    const offset = rotationOffset(seed, intensity, group.length);
    if (offset === 0) ordered.push(...group);
    else ordered.push(...group.slice(offset), ...group.slice(0, offset));
    start = end;
  }
  return ordered;
}
