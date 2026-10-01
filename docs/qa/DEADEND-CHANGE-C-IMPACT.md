# P1#1｜低开放度 dead-end 影响分析与 Change C 提案

- 文档性质：**影响分析 + 提案，不含任何实施**（本轮明确禁止实施）
- 产出者：builder（codebuddy / deepseek-v4.1-flash 主通道）
- 日期：2026-09-27
- 冻结基线：`PRODUCT_PLAN_V2.0`（`DEV_BASELINE=PRODUCT_PLAN_V2.0`，`PLAN_GATE=APPROVED`）
- 数据出处：`docs/qa/content-audit/ROUTER-MONTE-CARLO.json`（`scripts/audit-a1-router-montecarlo.ts` 机械产出，4,000 局 × 20 轮；本文件所有统计值均由脚本产出，不手写）

> ## ⚠️ 作废标注（2026-09-28，neat-freak 新增，未改写原结论）
>
> - **本文的「运行时 Router Monte Carlo」结论已作废**，范围：§1.2 的死局分档表（lim1 850/850、lim2 810/810、合计 1,660/4,000＝41.5%）、§1.2 的「lim1 止于 8 / lim2 止于 13」归因、§4.2 决策点 1/2/7 中所有引用这些运行时数字的表述。
> - **作废原因**：这些数字基于「Heat 硬过滤对全部卡生效」的**旧生产语义**；Phase B B2.2 引入 `isFormalFixedCard` / `formalFixedIdSet` 后，Heat 硬过滤改为**只对 Formal Fixed 卡生效**（当前 formal=0），旧运行时断粮已消失。
> - **新真源**：`docs/qa/content-audit/ROUTER-MONTE-CARLO.json`（2026-09-28 重跑）—— 4,000/4,000 跑满 20 轮、dead-end **0**、`heatAtDraw` **100% H1**、`matchesCreated` **0**。
> - **作废范围仅限运行时数字**：§1.1 的**静态** SSOT intensity×Heat 对角分区与真空表（H1 58 / H2 128 / H3 160 / H4 222、H4×I1＝0）**不经 Router，仍有效**；方案 E（重做内容覆盖矩阵）的产品判断不受本次作废影响。
> - **补注（2026-09-28 第二轮 neat-freak）**：CONTENT-01 第一包 24 张 Formal Fixed 入池（formal 0→24）后，连 `ROUTER-MONTE-CARLO.json` 亦属入池前（formal=0）快照；含 Formal 卡的现行运行时真源＝`docs/qa/content-audit/FORMAL-TRUTH-MC.json` / `FORMAL-TRUTH-PRODUCTION-CHAIN.json`（单包口径，ceiling=1 dead-end 67.2%、H3 2.6%、H4＝0）。
> - 本节为**标注**，不重算、不重写原文结论；重算/改写属 builder/QA，需另行派工。

## 0. 为什么写在 `docs/qa/` 而不是 `docs/pm/`

任务书给的默认路径是 `docs/pm/CHANGE-C-DEADEND-IMPACT.md`，但 `AGENTS.md`「谁写哪（写错地方打回）」把 `docs/pm/` 明确划给 planner（Phase1 写 PRODUCT_PLAN、Phase2 写 PLAN）。本轮的角色是 builder，本文也不是计划变更（`Change C` 一旦批准必须由 Sol Planner 出**新 Plan 版本**）。按任务书给出的备选路径写在 `docs/qa/`，理由是避免用 builder 身份污染 planner 的文档位；内容与格式仍按任务书要求给全。

---

## 1. 事实

### 1.1 SSOT 的 intensity × Heat 是严格对角分区（实测）

读 `getV2ContentAdapter().mainlineCards`（350 张，逻辑来自 `lib/v2-content/v2-adapter` → `lib/v2-relationship/v2-router.ts:46-48` 的 pack 映射），逐卡统计 `intensity` 与 `heatMin/heatMax` 的联合分布：

| intensity | 出现的 Heat 区间（`heatMin-heatMax`） | 卡数 |
|---|---|---:|
| I1 | 仅 `1-2` | 58 |
| I2 | 仅 `2-3` | 70 |
| I3 | 仅 `3-4` | 90 |
| I4 | 仅 `4-4` | 92 |
| I5 | 仅 `4-4` | 40 |
| **合计** | | **350** |

即：**每张卡的 Heat 区间只落在一个 intensity 上，五档 intensity 的 Heat 区间两两不重叠**，卡池在 (Heat, intensity) 平面上是一条对角带。

由此得到「合法卡数 = Heat × intensity ceiling」的真空表（`heatMin<=rank<=heatMax && intensity<=limit`）：

| | lim1 | lim2 | lim3 | lim4 | lim5 |
|---|---:|---:|---:|---:|---:|
| H1 | 58 | 58 | 58 | 58 | 58 |
| H2 | 58 | 128 | 128 | 128 | 128 |
| H3 | **0** | 70 | 160 | 160 | 160 |
| H4 | **0** | **0** | 90 | 182 | 222 |

结论（与任务书一致）：
- `intensityLimit=1` 时，H3/H4 的合法卡 **= 0**；
- `intensityLimit=2` 时，H4 的合法卡 **= 0**。

### 1.2 Monte Carlo 实测（4,000 局，`ROUTER-MONTE-CARLO.json`）

| intensityLimit | 局数 | dead-end 局数 | dead-end 率 | 完成轮均值 |
|---|---:|---:|---:|---:|
| 1 | 850 | 850 | 1.00 | **8.00** |
| 2 | 810 | 810 | 1.00 | **13.00** |
| 3 | 761 | 0 | 0.00 | 20.00 |
| 4 | 797 | 0 | 0.00 | 20.00 |
| 5 | 782 | 0 | 0.00 | 20.00 |
| 合计 | 4,000 | 1,660 | **0.415** | — |

**corroborating 证据**：lim1 的完成轮均值恰好停在 **8**，lim2 恰好停在 **13** —— 正是 `HEAT_THRESHOLDS`（`lib/v2-relationship/v2-state.ts:32-37`）里 H3 的起点 `8` 与 H4 的起点 `13`。也就是说 dead-end 不是随机抖动，而是「Heat 一升到无卡档就当场断粮」：`relationshipEffectiveCardCount` 到 8 ⇒ Heat=H3 ⇒ 该 ceiling 下合法卡归零 ⇒ `BUCKET_EMPTY → PACK_EXHAUSTED → RELATIONSHIP_GLOBAL_EXHAUSTED`（`lib/v2-relationship/v2-exhaustion.ts:37-44`），Session 无法跑满 20 个 `sessionCompletedRounds`。

**口径边界（必须一起披露，避免过度外推）**：本 harness 的抽卡池只含 6 个 relationship-aware 玩法（`PACK_WEIGHTS` 显式排除 cardless 的 `spin-bottle`），因此 41.5% 对应的是「本局可出的只有关系主线玩法」的场景（`mode=single`，或 mixed 局里 Host 关掉了 neutral/AI/自定义玩法）。若 mixed 局同时启用了 neutral/expansion 玩法，neutral 的 completed 轮**同样计入 `sessionCompletedRounds`**（Plan `:117`、`:119`），真实 dead-end 面会小于 41.5%。但**关系主线本身在 lim1/lim2 下升到 H3/H4 后确实一张卡都出不了**，这一条与 harness 配置无关。

### 1.3 触发的代码位置（只读核对）

| 环节 | 位置 |
|---|---|
| Heat ← counter 的唯一写入点 | `lib/v2-relationship/v2-reducer.ts:331` → `lib/v2-relationship/v2-state.ts:63-69` |
| Heat 阈值表 | `lib/v2-relationship/v2-state.ts:32-37` |
| Router 的 Heat 硬过滤（SSOT 主线） | `lib/v2-relationship/v2-router.ts:145`、`:151-152` |
| Router 的 Heat 硬过滤（`/game` 生产适配器） | `lib/engine/v2-deal.ts:68-72`（调用点 `:182`） |
| 耗尽分层判定 | `lib/v2-relationship/v2-exhaustion.ts:37-44` |
| 耗尽出口 UI | `app/game/page.tsx:213-224`、`lib/v2-relationship/v2-session.ts:320-322`、`lib/engine/v2-deal.ts:459-460` |

---

## 2. 候选修法（≥3，含文件与行号）

> 共同红线：**任何一条都不得提高用户开放度/intensity ceiling**（本轮明令），也不得越过 boundary / consent / minPlayers / matchRequired / D7。

### 修法 A｜Heat 停档：Heat 上升时，若目标档在该 ceiling 下无任何合法卡，则 Heat 停在该 ceiling 可满足的最高档

- 语义：`relationship.heat` 不再无条件等于 `heatForEffectiveCount(counter)`，而是取「冻结阈值映射」与「ceiling 可达的最高档」的较小者（例：lim1 桌 counter 到 8 时，Heat 停在 H2 而不是 H3）。
- 需要改的位置（两条实现路线，代价不同）：
  - **A-1（改 reducer / state，root fix）**
    - `lib/v2-relationship/v2-state.ts:63-69`（`heatForEffectiveCount` 或新增 clamp 函数）；
    - `lib/v2-relationship/v2-reducer.ts:331`（改写入值）；
    - intensity ceiling 目前**不在** `RelationshipState` 里（`lib/v2-relationship/v2-state.ts:200-239`），必须新增字段 + 同步 `relationshipStateSchema`（`lib/v2-relationship/v2-state.ts:345-367`）+ `createInitialRelationshipState`（`:241-263`）+ 旧 Session 迁移默认值（`lib/storage/session-migration.ts`）+ 调用链传参（`lib/engine/v2-deal.ts:389-409`、`lib/engine/session-engine.ts:104`）。
  - **A-2（只在 Session 层事后 clamp）**
    - 只在 `lib/engine/v2-deal.ts:389-409`（`reduceResolvedRound`）里对归约结果 clamp；
    - 代价：**纯 reducer 路径拿不到**（`lib/v2-relationship/v2-session.ts` 的 `reduceV2SessionEvents` 与审计 harness 走的是纯 reducer），会造成「App 一条口径、引擎另一条口径」的第二套 Heat —— 风险高于 A-1，不建议。
- 影响面：所有消费 `relationship.heat` 的地方（Router 过滤、`heatExposure` 统计、UI、mutual/final 的 `Heat>=H3` 资格 `:166`）都会变；`sessionCompletedRounds` 与 9/14/19 调度仍走 counter，不变。

### 修法 B｜Router 空则回落：当前 Heat 硬过滤后为空时，回落到 ceiling 可满足的最高 Heat 档

- 语义：`relationship.heat` 字段**不动**（仍按冻结公式单调不降），只在 **Router 出卡那一刻**：若 `currentHeat` 下过滤结果为空，则用 `min(currentHeat, ceiling 可达最高档)` 重新过滤一次。
- 需要改的位置：
  - `lib/v2-relationship/v2-router.ts:143-160`（`bucket` 的 Heat 过滤：`:145` 取 `currentHeat`、`:151-152` 的 `heatMin/heatMax` 比较；空则按回落档重算）；
  - `lib/engine/v2-deal.ts:68-72`（`heatEligible`，调用点 `:182`）——否则 `/game` 生产链与 SSOT 主线链行为不一致；
  - 若要求耗尽判定与出卡口径一致，还要核 `lib/v2-relationship/v2-exhaustion.ts:37-44`（回落生效后 `bucket>0`，`PACK_EXHAUSTED` 不再触发）。
- 影响面：H3/H4 的 lim1 桌会开始出 H1/H2 区间（intensity 1/2）的卡 —— **出卡内容变了**：等同「Heat 滤网在低开放度桌被放宽」。

### 修法 C｜联合档（intensity-ceiling-aware Heat band）：Router 的 Heat 硬过滤始终取「当前 Heat ∩ ceiling 可达 Heat」的联合档

- 语义：`effectiveHeatRank = min(heatRank(relationship.heat), maxHeatRankUnderCeiling(intensityLimit))`，**只在过滤时使用**（默认不回写 `relationship.heat`）。
- 与 B 的差别：B 是「先按 H4 过滤，空了才回落」（补救式，前若干轮仍按 H4 语义、且中途换档会有抖动）；C 是**从第一轮起就按联合档过滤**（预防式，整局口径一致）。C 的 H4 桌在 lim2 下等价于整个 Session 都按 H3 过滤。
- 需要改的位置：与 B 同两处（`lib/v2-relationship/v2-router.ts:145-152`、`lib/engine/v2-deal.ts:68-72`）；差异只在判定条件（B 加 `if empty`，C 直接取 min）。
- 若选择把联合档**写回** `relationship.heat` 并持久化，则退化为修法 A，另需改 `lib/v2-relationship/v2-reducer.ts:331`。
- 可选叠加项（不单独构成修法）：Host 可见的中性提示（「当前开放度下没有更高档的题卡，已按你的开放度上限出题」），改 `app/game/page.tsx:213-224`。

### 修法 D｜不动 Heat 与 Router：把 dead-end 的出口引到 neutral / expansion 玩法（Host 引导）

- 语义：承认「lim1/lim2 桌在 H3/H4 无关系主线卡」是内容事实，不改 Heat 也不放宽 Heat 过滤；只改耗尽出口的**去向与提示**，引导 Host 切到 neutral（转瓶子 / AI 即兴 / 自定义）或 expansion 玩法把这一局跑完（neutral/expansion 的 completed 轮计入 `sessionCompletedRounds`，不推进 Heat/Signal —— Plan `:117`/`:119`/`:93`）。
- 需要改的位置：
  - `app/game/page.tsx:213-224`（`PACK_EXHAUSTED` / `RELATIONSHIP_GLOBAL_EXHAUSTED` 面板的出口按钮与文案）；
  - `lib/v2-relationship/v2-session.ts:320-322`（`PACK_EXHAUSTED_GUIDANCE` / `RELATIONSHIP_GLOBAL_EXHAUSTED_GUIDANCE` 文案）；
  - `lib/engine/v2-deal.ts:459-460`（`NO_RECOVERABLE_CARDS_GUIDANCE`）；
  - 若要在 `single` 模式下也能切换，还要看 `lib/engine/session-engine.ts:104-115` 的 `single` 分支（`enabledPackIds = [currentPackId]`）。
- 影响面：**不改任何出卡内容与 Heat 语义**；但关系主线在低开放度桌到 H3/H4 后确实不再出卡（该局后半段变成 neutral 局）。这是"让 Session 跑得完"，不是"让关系主线继续跑"。

### 首选方案 E｜保持 Heat / Router 契约，重做内容覆盖矩阵（Phase B 设计约束；本轮只记录，不实施）

- 语义：**引擎一行不改**——H1→H4 单调 Heat、Heat 硬过滤、用户 intensity ceiling、D8 耗尽状态机全部保持冻结；改的是**新内容基线**：要求每个 Heat 档都存在足量的低强度卡，消除 §1.1 的对角真空。
- 覆盖矩阵硬要求：
  - `intensity ceiling=1` 时，H1/H2/H3/H4 **都必须有合法 I1 内容**；
  - `intensity ceiling=2` 时，H1/H2/H3/H4 **都必须有合法 I1/I2 内容**；
  - 不允许再出现「低强度 = 只存在低 Heat」的严格对角矩阵（§1.1 真空表即反例）。
- 需要改的位置：只动 SSOT 内容基线（新受控快照 + 重签 SHA256 + Research Reviewer 复核，Plan `:530`）；`lib/` 下与 Heat 映射 / Router 过滤 / 耗尽相关的文件**一行不改**。
- 为什么是首选：相比修法 A（Heat 停档）、B/C（放宽 Heat 硬过滤）以及任何「自动提高开放度 / Heat 停档 / 跨 Heat 回退 / 临时绕过硬过滤」的路线，方案 E 不触碰 Plan `:42`/`:62`/`:431`/`:69` 的任何冻结语义——**最少破坏冻结引擎语义**；开放度上限是用户自己选的尺度，断粮是内容侧欠账，应该在内容侧还账，而不是反向改引擎去迁就内容缺口。
- Change C 判定：**仍属 Change C**（SSOT 内容基线变更，Plan `:530`），但变更对象是内容而非引擎语义：走 Change C Controlled Reopen + Human Approval + 新内容基线后回 DEVELOP，不全量重跑。
- **本轮状态：只作为 Phase B 的首选方案与设计约束记录于此与 `CONTENT-GAP-AND-NEXT.md` §6.2；不实施任何 Heat 改动、不改 Plan、不新增 SSOT 内容。**

---

## 3. 每个修法触碰的冻结条款（逐条引用 Plan 原文行号）

| 冻结条款（Plan 行号 + 原文要点） | A | B | C | D |
|---|:--:|:--:|:--:|:--:|
| `:42` 「Heat 锁定为 `0–3 / 4–7 / 8–12 / 13+` 且**单调不降**……不回退 Heat」 | ❌ 直接改「锁定」映射 | ✅ 不回退 Heat 值 | ✅ 不回退 Heat 值 | ✅ 不触碰 |
| `:147-154` 「Heat 只由 `REL_CARD_COMPLETED` 后的 `relationshipEffectiveCardCount` 决定」＋ H1 0–3 / H2 4–7 / H3 8–12 / H4 13+ 表 | ❌ Heat 不再等于该表 | ✅ 表仍成立（只改过滤） | ✅ 表仍成立 | ✅ 不触碰 |
| `:156-159` 「Intensity 1～5 仅是用户允许的内容上限，**不等于 Heat**」「加玩不回退 Heat」「未计数事件不得改变 Heat」 | ❌ 让 ceiling 反向决定 Heat | ✅ | ✅ | ✅ |
| `:62` Router 管线「pack capability → Intensity 上限 → **Heat 硬过滤** → target/pair → metadata/边界/同意 → Coverage/Cooldown → drawBand → 随机选卡」 | ✅ 管线不变 | ❌ **Heat 硬过滤被放宽**（H3/H4 会出 H1/H2 的卡） | ❌ 同上（且整局口径都放宽） | ✅ 管线不变 |
| `:431` 「`BUCKET_EMPTY`：只允许在**同 Heat 下**向较低且仍合法档位搜索」（`:430` D8=A+ 耗尽策略） | ❌ 同上一行的连带效果 | ❌ 实际跨到更低 Heat 档出卡 | ❌ 同上 | ✅ 不改耗尽语义（只改出口去向） |
| `:69` 「候选池耗尽时严格走已批准的耗尽策略，不回退旧 selector、**不越权放高档**」 | ✅ 不越权放高档（反而降档） | ✅ 不越权放高档（反而降档） | ✅ 同上 | ✅ |
| `:166` final mutual 资格含「Heat≥H3」 | ⚠️ 低开放度桌 Heat 停档后可能永不满足 → final mutual 更少 | ✅ 不变 | ✅ 不变 | ✅ 不变 |
| `:9` / `:640` D1～D8 已冻结为 `DEV_BASELINE=PRODUCT_PLAN_V2.0` | ❌ | ❌ | ❌ | ✅ 不改 D1–D8 |

> 方案 E 不在上表：A/B/C/D 对冻结条款的触碰**不适用于 E**——E 不改任何引擎语义，唯一触碰的是 SSOT 内容基线（Plan `:530`），仍需 Change C（见方案 E 节的 Change C 判定）。

### Change C 判定

按 `AGENTS.md` 的 Change Request 分类：`A=开发内小改`、`B=局部功能变化更新局部 Requirement/DoD`、`C=产品/架构变更，进 PLAN_REOPEN_REQUIRED（局部暂停＋Sol Planner＋Research Reviewer＋Human Approval＋新 Plan 版本＋新 `DEV_BASELINE` 回 DEVELOP）`。

- **修法 A → 必须 Change C**。它改的是 Plan `:42`/`:147-154` 冻结的「Heat 锁定映射」本身（Heat 不再等于 counter 映射值），并连带影响 `:166` 的 final mutual 资格；这是产品语义变更，不是开发内小改。
- **修法 B → 必须 Change C**。`relationship.heat` 没回退，但 Plan `:62` 的「Heat 硬过滤」是本版冻结管线的**硬步骤**，B 让它在低开放度桌失效；同时与 `:431`「只允许同 Heat 下向较低**档位**搜索」冲突（B 实际是跨 Heat 档出卡）。行为面变化足够大，属 C。
- **修法 C → 必须 Change C**。触碰条款与 B 相同（`:62`、`:431`）；即便不回写 `relationship.heat`，从第一轮起就按联合档过滤已经是新的路由架构，必须由 Planner 重写 EnterPlanMode 级别的管线定义。
- **修法 D → 不需要 Change C**（最多 `Change B`）。它只改耗尽出口的引导去向与文案，没有动 `:42`/`:62`/`:431`/D1–D8；且「切到 neutral/expansion 继续玩、completed 计入 `sessionCompletedRounds` 但不推进 Heat」在 `:93`/`:117`/`:119` 已经是冻结行为，D 只是补执行缺口（把"能切"变成"引导切"）。

---

## 4. 结论

### 4.1 P1#1 是否必须升级 Change C

- **若选择修法 A / B / C：必须 `Change C`。** 三条都在动 Plan 明文冻结的 Heat 语义或 Router 的「Heat 硬过滤」步骤，超出 builder 权限（`AGENTS.md`：Plan 变更只走 Change C Controlled Reopen）。
- **若接受"低开放度桌在 H3/H4 不再出关系主线卡"这一产品事实，只要求 Session 能跑完 20 轮：走修法 D 即可，不需要 Change C**（最多记 `Change B`，更新耗尽出口的局部 Requirement/DoD）。
- 三条 A/B/C 里，**代价从小到大**：C（两处过滤，口径一致）→ B（两处过滤 + 空判定）→ A（跨 state/schema/reducer/迁移/调用链，且会牵动 final mutual 资格）。**若 Human 批准放宽 Heat 过滤，建议走 C 而不是 B**：B 的"前几轮按 H4、空了才回落"会产生出卡内容的中途换挡，且同一 Session 内出现两套 Heat 语义，更难审计。
- **本轮不推荐 A**：`intensityLimit` 目前不在 `RelationshipState` 里，A 必须扩 schema + 迁移 + 改调用链，blast radius 最大，而收益与 C 基本重合。

### 4.2 需要 Human 批准的具体决策点

1. **是否允许 `relationship.heat` 不再严格等于 `heatForEffectiveCardCount` 映射值？**（即低开放度桌 Heat 停档；这是修法 A 的前提，直接改 Plan `:42`/`:147-154`。）
2. **是否允许 Router 的 Heat 硬过滤在"当前 Heat 无任何合法卡"时放宽到 `ceiling` 可达的最高 Heat 档？**（Heat 值不变、但出卡可以来自更低 Heat 档；这是修法 B/C 的前提，改 Plan `:62`，并与 `:431` 冲突需一并修订。）
3. **放宽的适用范围**：只放宽 `bucket`（当前桶），还是同时放宽 `pack`/`global` 计数？（后者会改变 `PACK_EXHAUSTED` / `RELATIONSHIP_GLOBAL_EXHAUSTED` 的可见时机与 Host 决策入口，属可观测行为变化。）
4. **是否需要在放宽时给 Host 一句中性提示**（例："当前开放度下没有更高档的题卡，已按你的开放度上限出题"），还是静默降档？（静默会改变 `heatExposure` 的统计口径，影响后续调参。）
5. **`final mutual` 的 `Heat>=H3` 资格**（Plan `:166`）：若 Heat 停档，低开放度桌可能永远够不到 final mutual —— 是接受、还是把资格也改成"联合档"？
6. **`sessionCompletedRounds` 20/25 与 9/14/19 mutual 调度**是否仍严格只跟计数器走、不受 Heat 停档/联合档影响？（本提案建议：保持只跟计数器走，Heat 只用于出卡过滤与 final 资格。）
7. **是否接受"低开放度桌关系主线在 H3/H4 无卡"是设计事实**，从而只做修法 D（neutral/expansion 出口）而不碰 Heat 与 Router？（若选这条，需确认 `single` 模式下 Host 能否切到 neutral 包——现 `lib/engine/session-engine.ts:104-115` 的 `single` 分支把 `enabledPackIds` 锁成 `[currentPackId]`，可能要一起改。）
8. **是否按首选方案 E 重做内容覆盖矩阵**（原「第 5 条候选」已升格为本文件 §2 的**首选方案 E**，且已写入 `CONTENT-GAP-AND-NEXT.md` §6.2 作为 Phase B 设计约束）：为 H1–H4 每档补足与各 ceiling 匹配的低强度卡，消除对角真空 —— 属 SSOT 内容变更（新受控快照 + 重签 SHA256 + Research Reviewer 复核，Plan `:530`），**必须 Change C 且另开内容基线**；本轮只记录、不实施。

### 4.3 未做与不做

- 本文**没有实施任何修法**，`lib/` 下与 dead-end 相关的文件（Heat 映射、Router 过滤、耗尽出口）**一行未改**。
- 本文的 4 个候选修法都**没有**提高用户开放度或 intensity ceiling。

---

## 附：复现命令

```bash
# 1) 事实：SSOT intensity × Heat 对角分区 + 合法卡真空表
npx tsx -e "…逐卡统计 intensity/heatMin/heatMax…"   # 见 §1.1（本机已跑，输出与表格一致）

# 2) 事实：Monte Carlo dead-end 分档（lim1 850/850、lim2 810/810、lim3-5 0）
npx tsx scripts/audit-a1-router-montecarlo.ts
node -e "const d=require('./docs/qa/content-audit/ROUTER-MONTE-CARLO.json');console.log(d.cohortByIntensityLimit)"
```
