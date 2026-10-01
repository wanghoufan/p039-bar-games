import { deckGenerationSource } from "@/lib/domain/generation-source";
import type { GameCard, GameSession } from "@/lib/domain/schemas";
import {
  classifyMainlineCard,
  isFixedMainlineCard,
  type FixedContentManifest,
  type MainlineCardClass,
} from "@/lib/v2-content/fixed-content-manifest";

/**
 * Phase B Fixed Content First｜正式主线准入门 + AI 隔离开关（PRODUCT_PLAN_V2.2 §13）。
 *
 * ## 两层判定，别再退回「只要不是 AI 就放行」
 * 上一版这里只有一句 `isAiMainlineEnabled() || card.source !== "ai"`，于是 AI 关掉之后
 * `custom`、旧 `seed-*`、任何未知 builtin ID 都能进正式主线（第三方审查判 FAIL）。
 * 现在拆成两层，职责不重叠：
 *
 * 1. **AI 隔离开关** `isAiMainlineEnabled()`——单一运行时配置，**缺省即关闭**：只有显式
 *    `AI_MAINLINE_ENABLED=true` 才允许 AI 生成装载。关闭时只隔离入口、不删任何 AI 代码
 *    （恢复走独立 Human Gate）；所有生成入口都必须经本键判定，且不得借设置页 / 本地缓存 /
 *    恢复路径绕过。读取口径：浏览器侧（自包含直连）读同一键——Next 只在构建期内联
 *    `NEXT_PUBLIC_*`，故浏览器端缺省同样读不到值，一律按关闭处理；这里刻意只认字符串 `"true"`。
 *
 * 2. **固定库准入门** `mainlineAllowsCard()`——正向允许清单，卡必须可追溯到当前冻结固定库：
 *    - `fixed`（`source="builtin"` ∧ ID ∈ `FIXED_CONTENT_MANIFEST.tracks.legacyCompatibility.allowedCardIds`）→ 放行；
 *    - `custom` → 放行，但它是**第二条路**（Host 主动导入的私人内容），见
 *      `lib/v2-content/fixed-content-manifest.ts` 的「custom 包策略」；
 *    - `ai` → 拒绝；
 *    - `alien`（`builtin` 但 ID ∉ 当前冻结快照：旧 `seed-*`、未知/混合旧缓存）→ **拒绝**。
 *
 * 分类与清单真源都在 `lib/v2-content/fixed-content-manifest.ts`（唯一一份），这里不再各写一份。
 */

export function isAiMainlineEnabled(): boolean {
  return process.env.AI_MAINLINE_ENABLED === "true";
}

/** 开关关闭时的内部标记（不是用户可见错误码；调用方据此静默回退本地固定库）。 */
export const AI_MAINLINE_DISABLED = "AI_MAINLINE_DISABLED";

/**
 * 生成入口被隔离时的中性提示：可读、不报错、不白屏、不卡在 generating。
 * 三个入口（组局页 / 服务端 / 直连）共用同一句，禁各写一份。
 */
export const AI_MAINLINE_LOCAL_NOTICE = "本次使用本地固定题库，组局继续";

/** 旧缓存 / 离线恢复时剔除 AI 卡后的中性提示（不谎报生成失败）。 */
export const AI_MAINLINE_LEGACY_NOTICE = "本局已切换为本地固定题库，组局继续";

/**
 * 快照创建、Router 候选装载、每轮发卡的**单卡**准入口径（Plan §13 正向允许清单）。
 * 返回 false 表示这张卡不得进入正式主线。
 */
export function mainlineAllowsCard(
  card: GameCard,
  manifest?: FixedContentManifest,
): boolean {
  if (isAiMainlineEnabled()) return true;
  const klass = manifest ? classifyMainlineCard(card, manifest) : classifyMainlineCard(card);
  return klass === "fixed" || klass === "custom";
}

/** 正式主线快照过滤器：AI 关闭时剔除 AI 卡与快照外 builtin 卡，保留固定库卡与自定义卡。 */
export function filterMainlineCards(cards: readonly GameCard[], manifest?: FixedContentManifest): GameCard[] {
  return cards.filter((card) => mainlineAllowsCard(card, manifest));
}

/** 卡分类的薄封装（对外只暴露一个真源函数名，避免调用方各自 import 分类器）。 */
export function mainlineCardClass(card: GameCard): MainlineCardClass {
  return classifyMainlineCard(card);
}

export interface MainlineRecoveryReport {
  session: GameSession;
  /** 被剔除的卡 ID：AI 卡 + 混合旧缓存里的快照外卡。 */
  removedCardIds: string[];
  /** 是否发生过受控迁移；false＝原样返回同一引用（调用方可据此判「是否需要回写」）。 */
  migrated: boolean;
  /**
   * 被**保留**的快照外 builtin 卡 ID（纯旧局历史兼容）。
   * 只有整副牌堆都是旧内容、未与固定库内容混装时才非空——见 `reconcileMainlineSession` 头注。
   */
  grandfatheredAlienIds: string[];
  /** `currentRound` 指向被剔卡时同步清掉的旧 cardId（恢复一致性：不留悬空轮次）。 */
  droppedCurrentRoundCardId?: string;
}

/**
 * 旧缓存 / 离线恢复的**受控迁移**（Plan §13「离线恢复…校验可追溯来源…未知来源、AI 来源或
 * 混合旧缓存一律拒绝进入正式主线，不静默回退为中性卡」）。
 *
 * 规则（逐条可复核）：
 * 1. **AI 卡一律剔除**（无论是否混装）——正式主线验收期间 AI 来源卡数必须为 0；
 * 2. **快照外 builtin 卡（`alien`）只在「混合旧缓存」时剔除**：整副牌堆若同时含
 *    `fixed`/`custom` 内容与 `alien`/`ai` 卡，就是 Plan 点名的「混合旧缓存」→ 剔除 alien；
 * 3. **纯旧局**（整副牌堆的 builtin 卡全部在快照外，且不含 fixed/custom）**保留**：
 *    旧 Session 已落库的 `seed-*` 卡按既有 policy「history-only 兼容」照旧可读可展示，
 *    不能因为一次部署就把用户进行中的旧局清空（否则 `seed-*` 全量旧局被静默摧毁）。
 *    这类卡 ID 记入 `grandfatheredAlienIds` 留痕；它们**永远不进新牌堆**
 *    （新牌堆唯一入口 `buildPlayableDeck` 只收 `fixed`/`custom`），也**不计入固定库 manifest**。
 * 4. **`currentRound` 同步迁移**：若 `currentRound.cardId` 指向已被剔除的卡，
 *    同步清掉 `currentRound`（不删 `rounds` 历史），让下一次 `startRound` 重新出卡，
 *    不留「牌堆里没有、UI 还在显示」的悬空轮次；
 * 5. 剔除后重算整局 `generationSource`（同一纯函数口径）；牌堆清空时不写中性卡顶替，
 *    交给既有空牌堆出口（不白屏）。
 */
export function reconcileMainlineSession(
  session: GameSession,
  manifest?: FixedContentManifest,
): MainlineRecoveryReport {
  const deck = session.deckSnapshot;
  const classes = deck.map((card) => (manifest ? classifyMainlineCard(card, manifest) : classifyMainlineCard(card)));
  const hasDeclaredTrack = classes.some((klass) => klass === "fixed" || klass === "custom");

  const removedCardIds: string[] = [];
  const grandfatheredAlienIds: string[] = [];
  const kept: GameCard[] = [];

  deck.forEach((card, index) => {
    const klass = classes[index]!;
    if (klass === "ai") { removedCardIds.push(card.id); return; }
    if (klass === "alien" && hasDeclaredTrack) { removedCardIds.push(card.id); return; }
    if (klass === "alien") { grandfatheredAlienIds.push(card.id); kept.push(card); return; }
    kept.push(card);
  });

  if (removedCardIds.length === 0) {
    return { session, removedCardIds, migrated: false, grandfatheredAlienIds };
  }

  const keptIds = new Set(kept.map((card) => card.id));
  const danglingRound = session.currentRound && !keptIds.has(session.currentRound.cardId)
    ? session.currentRound
    : undefined;

  const next: GameSession = {
    ...session,
    deckSnapshot: kept,
    generationSource: deckGenerationSource(kept),
    ...(danglingRound ? { currentRound: undefined } : {}),
  };

  return {
    session: next,
    removedCardIds,
    migrated: true,
    grandfatheredAlienIds,
    ...(danglingRound ? { droppedCurrentRoundCardId: danglingRound.cardId } : {}),
  };
}

/**
 * `reconcileMainlineSession` 的会话态入口（历史函数名保留：旧调用方按引用判断是否发生过隔离）。
 * 无卡被剔除时原样返回同一引用。
 */
export function isolateLegacyAiDeck(session: GameSession, manifest?: FixedContentManifest): GameSession {
  return reconcileMainlineSession(session, manifest).session;
}

/** 供调用方自查：这张卡是否属于当前冻结固定库（`custom`/`ai` 都为 false）。 */
export { isFixedMainlineCard };
