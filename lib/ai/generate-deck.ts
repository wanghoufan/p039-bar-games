import { aiDeckResponseSchema } from "./card-schema";
import { directErrorCode, generateDeckDirect, isSelfContained, type DeckBatchProgress } from "./direct-provider";
import { AI_MAINLINE_DISABLED, filterMainlineCards, isAiMainlineEnabled } from "./mainline-flag";
import { filterCards } from "./safety-filter";
import { dedupeCards } from "./normalize";
import type { AIProviderProfile } from "./provider";
import type { GameCard, SessionConfig } from "@/lib/domain/schemas";
import { mainlineSsotCards, mainlineSsotCardsByPack } from "@/lib/v2-content/v2-card-bridge";
import { fixedContentCards, refillAllowsCard, type FixedContentManifest } from "@/lib/v2-content/fixed-content-manifest";

/**
 * 运行期本地内容真源（D1）：V1.3 Frozen SSOT 生成物（350 张 PN-*）。
 * 旧 `seed-*` 种子（lib/game-packs/built-in-seeds）从此只作 history-only 兼容：
 * 旧 Session 已落库的 seed 卡照旧可读可展示，但新牌堆与新补位一律从 SSOT 取卡，
 * 不再产出 seed-* id（迁移 policy：自动等价 ID 映射 = NONE）。
 */
const localMainlineCards = (): readonly GameCard[] => mainlineSsotCards();

/** 每个玩法在局内要保住的可玩卡下限；低于它就立即用 seed 补位，保证现场不卡。 */
export const PACK_PLAYABLE_THRESHOLD = 3;

export interface GeneratedDeckRequest {
  profile: AIProviderProfile;
  apiKey: string;
  sessionConfig: SessionConfig;
  sessionId: string;
  targetCardCount?: number;
  /**
   * 主持人已启用的自定义题卡。**只在 Custom self-mode（本局只请求自定义玩法、无任何内置/AI 卡）
   * 时才会进堆**；正式 / Local / Fixed 路径一律不并入（Plan A，见 `buildPlayableDeck`）。
   */
  customCards?: GameCard[];
  /** 分块进度回调（仅自包含直连链使用；服务器 /api 模式忽略）。 */
  onProgress?: (progress: DeckBatchProgress) => void;
}

const safetyContext = (config: SessionConfig) => ({
  boundaries: config.boundaries,
  intensity: config.intensity,
  playerCount: config.players.filter((player) => player.active).length,
});

const playable = (cards: GameCard[], config: SessionConfig) => filterCards(cards, safetyContext(config));

export function buildPlayableDeck(raw: unknown, config: SessionConfig, targetCount = 40, customCards: GameCard[] = []): GameCard[] {
  const parsed = aiDeckResponseSchema.safeParse(raw);
  const aiCards = parsed.success ? parsed.data.cards : [];
  // 正式主线 AI 隔离（Plan §13）：开关关闭时 AI 输出一律不并入；AI 卡也不能经自定义包混入正式快照。
  const allowedAI = isAiMainlineEnabled() ? playable(aiCards.filter((card) => config.enabledPackIds.includes(card.packId)), config) : [];
  // 固定库池唯一入口（Plan §13「快照创建」）：只收 ID 属于当前冻结快照的 builtin 卡。
  // SSOT 桥本身只产出 PN-*，这里的 manifest 过滤是硬门禁——将来任何一条给本地池塞卡的路径
  // 都无法只凭「不是 AI」把快照外 ID 混进正式快照。
  const local = playable(fixedContentCards(localMainlineCards()).filter((card) => config.enabledPackIds.includes(card.packId)), config);
  const allowedCustom = playable(customCards.filter((card) => config.enabledPackIds.includes(card.packId)), config);
  // Plan A（Human 2026-09-28 已定）：自定义包是**独立玩法**，不得与正式 snapshot（及 AI）同堆混装。
  // 先判定本局是不是「只请求自定义玩法」（Custom self-mode）：启用集合非空且**全部**是自定义包。
  // 不看 `mode`——自定义单玩 / 随机启动器落到自定义包时可能是 single，历史落库数据也可能是 mixed。
  const customPackIds = new Set(customCards.map((card) => card.packId));
  const customSelfMode = config.enabledPackIds.length > 0
    && config.enabledPackIds.every((id) => customPackIds.has(id));
  // 两条轨各自成池，建堆**二选一**，绝不并堆：
  // - `builtinPool`：内置固定库快照 + 允许的 AI —— 正式 / Local / Fixed 路径唯一的取卡池；
  // - `customPool`：只认 `source === "custom"`（AI 卡即便混进 customCards 也不认，Plan §13）；
  // - Custom self-mode ⇒ 只取 `customPool`：不自动混入 PN-* / snapshot / AI；
  // - 其余（正式 / Local / Fixed 路径）⇒ 只取 `builtinPool`：customCards 一张不进。
  const builtinPool = filterMainlineCards(dedupeCards([...allowedAI, ...local]));
  const customPool = filterMainlineCards(dedupeCards(allowedCustom)).filter((card) => card.source === "custom");
  const pool = customSelfMode ? customPool : builtinPool;
  // 按启用玩法 round-robin 轮流取牌：每轮每个玩法各取一张，先保证 7 个玩法都有份，再轮到第二轮；
  // 避免单玩法（或 AI 一整包）把 targetCount 填满、其余玩法一张都进不来。总量仍为 targetCount。
  const byPack = new Map<string, GameCard[]>();
  for (const card of pool) byPack.set(card.packId, [...(byPack.get(card.packId) ?? []), card]);
  const packOrder = config.enabledPackIds.filter((packId) => byPack.has(packId));
  const deck: GameCard[] = [];
  for (let round = 0; deck.length < targetCount; round += 1) {
    let took = false;
    for (const packId of packOrder) {
      const card = byPack.get(packId)?.[round];
      if (!card) continue;
      deck.push(card); took = true;
      if (deck.length >= targetCount) break;
    }
    if (!took) break;
  }
  return deck;
}

export async function requestGeneratedDeck(input: GeneratedDeckRequest): Promise<GameCard[]> {
  // 正式主线 AI 隔离（Plan §13）：关闭时在入口直接停住，绝不发服务端生成请求。
  if (!isAiMainlineEnabled()) throw new Error(AI_MAINLINE_DISABLED);
  const targetCardCount = input.targetCardCount ?? 40;
  const response = await fetch("/api/generate-session", {
    method: "POST", cache: "no-store",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${input.apiKey}` },
    body: JSON.stringify({ profile: input.profile, sessionConfig: input.sessionConfig, targetCardCount, sessionId: input.sessionId }),
  });
  if (!response.ok) throw new Error((await response.json() as { code?: string }).code ?? "GENERATION_FAILED");
  const deck = buildPlayableDeck(await response.json(), input.sessionConfig, targetCardCount, input.customCards);
  if (deck.length < 10) throw new Error("INSUFFICIENT_CARDS");
  return deck;
}

/**
 * 自包含版没有 /api 代理：改由前端直连 Provider（`lib/ai/direct-provider`）分块生成
 * （4 批 × 10 张，任一批成功即并入），拿到的合并响应仍走同一套 buildPlayableDeck 过滤与
 * 本地兜底，保证服务器/直连两种来源口径一致。
 */
async function requestDeckDirect(input: GeneratedDeckRequest): Promise<GameCard[]> {
  // 正式主线 AI 隔离（Plan §13）：自包含直连是绕过服务端的独立通道，同样必须在入口停住，绝不直连 Provider。
  if (!isAiMainlineEnabled()) throw new Error(AI_MAINLINE_DISABLED);
  const targetCardCount = input.targetCardCount ?? 40;
  const { data } = await generateDeckDirect({
    profile: input.profile, apiKey: input.apiKey, sessionConfig: input.sessionConfig, sessionId: input.sessionId, targetCardCount, onProgress: input.onProgress,
  });
  const deck = buildPlayableDeck(data, input.sessionConfig, targetCardCount, input.customCards);
  if (deck.length < 10) throw new Error("INSUFFICIENT_CARDS");
  return deck;
}

/**
 * 牌堆传输选择唯一入口（Change B 补充）：整局生成与后台补题共用，禁各写一份分支。
 * 设置页「测试连接」不走本函数，但同样落在 `lib/ai/direct-provider` 的同一底层实现上——
 * transport / 鉴权 / URL 校验 / 错误分类只在 direct-provider 定义一份。
 * - 测试注入的 request（非默认值）原样使用，离线单测不起网络；
 * - 自包含版（无 /api 代理）走前端直连 `requestDeckDirect` → `direct-provider`；
 * - 服务器模式维持原样：只走 `/api/generate-session`，不发起直连。
 * 两条默认通道都各自在入口做 `AI_MAINLINE_ENABLED` 守卫（见 requestGeneratedDeck / requestDeckDirect），
 * 关闭时本函数即使被直接调用也只会回落到本地固定库，不发任何生成请求。
 */
export function resolveDeckTransport(request?: typeof requestGeneratedDeck): typeof requestGeneratedDeck {
  if (request && request !== requestGeneratedDeck) return request;
  return isSelfContained() ? requestDeckDirect : requestGeneratedDeck;
}

/**
 * Provider 生成失败（断网/鉴权/上游异常）时回退到本地题库：新增 AI 玩法断网也能开局。
 * 自包含版先试前端直连，失败再落本地；服务器模式维持原样（仅走 /api，不发起直连）。
 */
export async function requestDeckWithFallback(input: GeneratedDeckRequest, request: typeof requestGeneratedDeck = requestGeneratedDeck): Promise<GameCard[]> {
  return (await requestDeckWithFallbackResult(input, request)).cards;
}

export interface DeckWithFallbackResult {
  cards: GameCard[];
  /** 全部批次失败回退本地时填归一化后的错误码（走 `providerErrorMessage` 即可得一句用户文案）；成功时为 undefined。 */
  fallbackCode?: string;
  /** 部分批次失败但其余成功并入时的失败原因码：牌堆仍含 AI 卡（generationSource 仍为 ai），失败原因仅作记录。 */
  partialCode?: string;
}

/**
 * 自包含直连失败抛的是 `provider-*` 内部标记（见 direct-provider），需按同一张表归一；
 * 服务器模式抛出的已是 ProviderErrorCode，原样透传，避免被误判成 REQUEST_FAILED。
 */
export function normalizeFallbackCode(message: string): string {
  return message.startsWith("provider-") ? directErrorCode(message) : message;
}

/**
 * `requestDeckWithFallback` 的结果版：额外带回失败原因码（Change A 小改，供局内一次性提示用），
 * Change C 再补 `partialCode`：分块生成部分批次失败、其余成功并入时，失败原因也经此带出
 * （由 onProgress 通道捕获，供 generationFallback 记录），回退语义与文案口径不变，禁各写一份。
 */
export async function requestDeckWithFallbackResult(input: GeneratedDeckRequest, request: typeof requestGeneratedDeck = requestGeneratedDeck): Promise<DeckWithFallbackResult> {
  try {
    let partialCode: string | undefined;
    const onProgress: GeneratedDeckRequest["onProgress"] = input.onProgress
      ? (progress) => {
        if (progress.lastError) partialCode = normalizeFallbackCode(progress.lastError);
        input.onProgress?.(progress);
      }
      : undefined;
    const cards = await resolveDeckTransport(request)({ ...input, ...(onProgress ? { onProgress } : {}) });
    return { cards, ...(partialCode ? { partialCode } : {}) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return { cards: localSeedDeck(input.sessionConfig, input.customCards ?? []), fallbackCode: normalizeFallbackCode(message) };
  }
}

export function localSeedDeck(config: SessionConfig, customCards: GameCard[] = []): GameCard[] {
  return buildPlayableDeck({ cards: [] }, config, 40, customCards);
}

/** 目标玩法还剩多少张可玩卡：属于该玩法、未被用过、且过安全/尺度/人数过滤。 */
export function countPlayablePackCards(deck: GameCard[], config: SessionConfig, packId: string, usedCardIds: string[] = []): number {
  return playable(deck.filter((card) => card.packId === packId && !usedCardIds.includes(card.id)), config).length;
}

/** pack-specific 本地补位（历史函数名，内容源已切到 V2 SSOT）：同步、离线可用；按 id/题面去重，只补目标玩法。 */
export function refillPackFromSeeds(deck: GameCard[], config: SessionConfig, packId: string, manifest?: FixedContentManifest): GameCard[] {
  // 补位同样只从当前冻结固定库取卡（Plan §13「每轮发卡」），并过 Human Step 5 的跨轨补卡闸：
  // 纯旧 seed 局不得被偷偷补进快照内 PN-*，正式轨不得补进任何非 Formal 卡（判定真源见 fixed-content-manifest）。
  const local = playable(fixedContentCards(mainlineSsotCardsByPack(packId)), config)
    .filter((card) => refillAllowsCard(deck, card, manifest));
  return dedupeCards([...deck, ...local]);
}

/**
 * 目标玩法可用卡低于阈值时立即用 seed 补位，保证不卡现场；已达阈值则原样返回（added 为 0）。
 * 网络 refill 只是增强，见 refillPackInBackground。
 */
export function ensurePackPlayable(
  deck: GameCard[], config: SessionConfig, packId: string, usedCardIds: string[] = [], threshold = PACK_PLAYABLE_THRESHOLD,
  manifest?: FixedContentManifest,
): { deck: GameCard[]; added: number } {
  if (countPlayablePackCards(deck, config, packId, usedCardIds) >= threshold) return { deck, added: 0 };
  const refilled = refillPackFromSeeds(deck, config, packId, manifest);
  return { deck: refilled, added: refilled.length - deck.length };
}

export interface BackgroundRefillInput extends Omit<GeneratedDeckRequest, "targetCardCount"> {
  deck: GameCard[];
  packId: string;
  targetCardCount?: number;
  /** 测试注入；默认走 `resolveDeckTransport`（自包含版＝前端直连，服务器模式＝/api）。 */
  request?: typeof requestGeneratedDeck;
  /** 测试/未来显式注入的固定库 manifest；缺省＝运行期冻结 manifest。 */
  manifest?: FixedContentManifest;
}

/**
 * 后台 refill：尽力而为、永不抛错；断网或 Provider 失败就原样返回，绝不影响现场。
 * 走与整局生成同一条传输链（`resolveDeckTransport`）：自包含版直接请求 Provider，不再静默撞 /api。
 */
export async function refillPackInBackground(input: BackgroundRefillInput): Promise<GameCard[]> {
  // 正式主线 AI 隔离（Plan §13）：关闭时后台补题不得发任何生成请求（含经 resolveDeckTransport 的直连），也不并入快照。
  if (!isAiMainlineEnabled()) return input.deck;
  try {
    const request = resolveDeckTransport(input.request);
    const incoming = await request({ profile: input.profile, apiKey: input.apiKey, sessionConfig: input.sessionConfig, sessionId: input.sessionId, targetCardCount: input.targetCardCount ?? 20, customCards: input.customCards });
    // Human Step 5 跨轨补卡闸：后台补题是恢复/补位路径之一，同样只能补进与这一局同轨的卡——
    // 纯旧 seed 局不收 PN-*，正式轨只收 Formal，避免「偷偷跨轨」。
    const local = playable(incoming.filter((card) => card.packId === input.packId), input.sessionConfig)
      .filter((card) => refillAllowsCard(input.deck, card, input.manifest));
    return dedupeCards([...input.deck, ...local]);
  } catch { return input.deck; }
}
