# CODE REVIEW

- Task: CR-2｜复检本轮收尾两单（B3-16 Custom 分轨 + B3-17 final Mutual 两尾巴）与 docs/pm 恢复
- Commit: 工作区未提交改动，HEAD = `2fffafe`（本评审未产生任何新 commit）
- Reviewer: code-reviewer（glm-5.3-flash）
- Result: **过（PASS）** — P0 = 0，blocking P1 = 0；非 blocking P1 = 0；P2 × 0；P3 × 3

> ⚠️（2026-09-28 收尾补注，neat-freak；未改写原结论）本评审当时「工作区未提交改动」（HEAD `2fffafe`）；收尾两单已随 `48850a4` 提交并 push `main`。原文「未 commit / 未 push」（:4 / :81）为该时点事实，保留留痕。

> Dispatch / Evidence ID 系字段 2.0 已废弃，不填。

## 评审输入与复跑证据

- 判据一：`temp/B3-16-dispatch.md`（Human 方案 A 原文）＋ `temp/B3-17-dispatch.md`（Human 7.1/7.2 原文）。
- 判据二：`docs/review/CODE_REVIEW-PHASEB-B2.2.md`（上一轮 PASS 基线，其 P2-1/P2-4/P3-1 正是本轮两单的关闭对象）。
- 复跑门禁（本评审独立执行，非采信编排者）：
  - `npx tsc --noEmit` → 0 error（TSC-OK）；
  - `npx vitest run --testTimeout=30000` → **117 文件 / 1158 用例 / 0 failed**；
  - `npx playwright test tests/e2e/pack-min-players.spec.ts tests/e2e/pack-toggle-scope.spec.ts`（本轮两处改动的 E2E）→ **12 passed**；
  - `pnpm build:fixed-manifest` → 快照外 ID 0 / legacy 390 / **formal 0**（被拒 390：missingStrictMetadata 390 / humanBarFit≠PASS 390 / 未人工审 390）/ BAR-FIT 逐卡对账 390:390 一致 / hash 两次构建可复现；产物回读 `tracks.legacyCompatibility=390 / tracks.formalFixed=0`。
  - 全量 playwright（106 passed / 6 skipped）与 `pnpm build` 未重跑，采信编排者同日实测。

## 评审问题逐条结论（派工 10 问）

### Q1｜Custom 是否真的退出正式 Mixed — **是，PASS**
- 建堆唯一入口仍是 `buildPlayableDeck`（`lib/ai/generate-deck.ts:45-86`）：拆 `builtinPool`（`:66`）与 `customPool`（`:67`，追加 `.filter(source === "custom")`），`pool` 二选一（`:68`）。custom 卡进堆的唯一通道是 `customSelfMode === true`。
- 逐条排除第二条建堆路径：
  - `requestDeckWithFallbackResult` 回退落 `localSeedDeck`（`generate-deck.ts:177`）→ 同一 `buildPlayableDeck`（`:181-183`），无第二实现；
  - `localSeedDeck` 两个生产调用点（`app/generating/page.tsx:67,98,106`）都把 customCards 全量传入，由同一判定收口；服务端 `/api/generate-session` 只产候选卡，终局组堆仍在客户端 `buildPlayableDeck`（请求体不含 customCards，`generate-deck.ts:95`）；
  - `refillPackFromSeeds` / `ensurePackPlayable` / `refillPackInBackground` 全部过跨轨闸 `refillAllowsCard`（`fixed-content-manifest.ts:444-457`），custom-only 牌堆拒收 snapshot 卡（B3-14 收紧后的 ④ 同轨才放行），实测断言 `tests/unit/custom-track-separation.test.ts:186`；
  - `switchPackAndDeal` 的切包补位走同一 `ensurePackPlayable` 闸（`pack-switcher.ts:143`）；
  - custom snapshot 回放：`reconcileMainlineSession` 只剔 AI/alien（`mainline-flag.ts:119-125`），不重建牌堆、不写 Formal。
- Mixed 入口源头封堵：`mixedCandidatePackIds` 剔除 `source === "custom"`（`pack-switcher.ts:40`），setup 落库的 `config.enabledPackIds` 只含内置（`app/setup/page.tsx:62,80`）——新建 Mixed Session 从源头就不含 custom 包 id，双保险（`buildPlayableDeck:54` 还有 enabledPackIds 过滤兜一层）。

### Q2｜customSelfMode 派生判定稳健性 — **PASS（当前入口无可伪造面）**
- 判定（`generate-deck.ts:58-60`）：`enabledPackIds` 非空且全为 `customCards` 覆盖的包 id。逐向量排查：
  - **历史 mixed 落库**：config 恢复后 enabledPackIds 含内置 id，而 customCards 只来自启用的自定义包（`app/generating/page.tsx:60,90`），内置 id 不在 `customPackIds` → 判 false → builtinPool，不误判（`custom-track-separation.test.ts:98-105` 直测该形态）；
  - **custom 包 id 形态**：自定义包 id 恒为 `custom-${createId()}` 前缀（`components/packs/PackEditor.tsx:14`），与内置 id（`truth-dare` 等）无碰撞面；即便出现 id 形同内置的异径数据，后果也只是「把该包当 custom 单玩」，仍是同堆纯 custom，不产生混装；
  - **AI 卡伪装**：`aiGameCardSchema` 强制 `source: z.literal("ai")`（`lib/ai/card-schema.ts:5-6`），AI 卡无法自称 builtin/custom；且 customPool 再挂一道 `.filter(source === "custom")`（`:67`），实测 `custom-track-separation.test.ts:60-66`（AI 卡冒充 custom 包也不进堆）。
- 误判方向分析：派生只可能 false-negative（该 self-mode 而未判出 → 落 builtinPool → 启用集合无内置卡 → 空堆走既有耗尽出口），**不存在** false-positive 导致混轨的方向——fail-safe。

### Q3｜fallback / recovery 是否跨轨 — **不跨，PASS**
- AI-off：`requestGeneratedDeck` / `requestDeckDirect` 入口即抛 `AI_MAINLINE_DISABLED`（`:90,110`），回退 `localSeedDeck` 走同一 self-mode 判定——self-mode 回退仍纯 custom，普通局回退仍纯 builtin，均不发请求。实测 `custom-track-separation.test.ts:114-131`（fetchMock 0 调用 + 回退牌堆 every builtin）。
- 历史混装恢复：`reconcileMainlineSession`（`mainline-flag.ts:107-150`）——snapshot+custom 混装原样保留（`migrated=false`、同引用，`custom-track-separation.test.ts:160-170`）；混合旧缓存只剔 seed/AI、custom 与 snapshot 保留（`:172-179`）；纯旧局 grandfather 保留。全程无「静默重写成 Formal」——Session 本就无轨字段，不新写任何轨标记。

### Q4｜是否造成新死局 — **无，PASS**
- custom-only 局切内置玩法：`switchPackAndDeal` 补位被跨轨闸拒绝（custom-only 不收 PN-*，`fixed-content-manifest.ts:456`）→ 无卡可出 → 落既有 `AWAITING_HOST_EXHAUSTION_DECISION`（`custom-track-separation.test.ts:86-94`：awaiting truthy + `reshuffleWouldRevealCard=false`）。UI 沿用 D8=A 冻结出口：洗牌救不回时给中性说明＋「结束本局」，不渲染切包面板（B2.2 复检 Q6 已锁死，`session-current-pack-recovery.spec.ts` 仍在跑且全绿）。
- 这不是新死局：是 Human Plan A「自定义包＝独立玩法」的必然结果，且出口（结束本局）始终存在；dispatch 预期即「落 AWAITING 出口」。见 P3-1 观察项。

### Q5｜final Mutual 两尾巴是否只做技术能力 — **是，PASS**
- `mutualFinalCheckTrigger` 新增 `awaitingHostDecision === true → {due:false, reason:"awaiting-host-decision"}`（`v2-mutual-check.ts:174-177`），与中途同一 reason 字面量；判定顺序与中途一致（pairMode → awaiting → sessionStatus，注释 `:172-173`）。
- **纯判定**：不写任何 abandoned / MATCH / 状态（测试 ③ 断言判定前后 `relationshipOf` 深相等、abandoned false、matches 空，`tests/integration/v2-mid-mutual-abandoned.test.ts:562-575`）。
- **未接 App**：全仓 grep `mutualFinalCheckTrigger` 在 `app/`/`components/` **0 命中**（仅 `lib/v2-relationship/v2-mutual-check.ts` 定义与注释）——无新增结束流程触发点。
- **HEAT/TIMING 仍留空**：`v2-mutual-check.ts:181` 占位注释原样，无任何取值；`MUTUAL_MIN_HEAT` 值仍 `"H3"` 且最终判定不读它。

### Q6｜中途 Mutual 未被误伤 — **PASS**
- `MUTUAL_MIN_HEAT` 值 `"H3"` 未动（`v2-state.ts:85`），中途门在（`mutualCheckTrigger` 判定链未改）；`midMutualCheckAbandoned` 相关 reducer 一行未动（不在本轮 diff）；认识阈值与窗口 `[12,14]` 零改动（不在 diff）。
- 回归测试 ④ 用真实 AWAITING 态断言中途阻断行为与 reason 不变（`v2-mid-mutual-abandoned.test.ts:578-590`），并断言中途/最终 reason 字面量相同。

### Q7｜UI 文案合规 — **PASS**
- 用户侧新增/改动文案全部自然语言：「自定义玩法是独立玩法：单独开一局，不混进 AI 组局。」（`app/packs/page.tsx:56`，样式 `.pack-section-note` 已有，`globals.css:554`）；「创建本地游戏包，之后可作为独立玩法单独开一局。」（`:55`）；setup 候选行不再出现自定义计数（`app/setup/page.tsx:117`）。
- 全仓用户可见字符串 grep Formal/Legacy/snapshot/admission/manifest：0 命中（仅 `layout.tsx:14` 的 PWA manifest 属性，无关）。`boundaries/page.tsx` 与 `generate-deck.ts` 的对应改动均为代码注释，用户不可见。

### Q8｜既有测试改动逐判 — **6 处全部是「必要口径修正」，无放宽**
| 文件 | 判定 | 理由 |
|---|---|---|
| `pack-min-players.spec.ts:63` | 保留 | 仅注释更新，断言值 `5 个玩法` 一字未动。 |
| `pack-toggle-scope.spec.ts:106-118` | 保留 | `7（含自定义 1 个）`→`6 个玩法`：Plan A 下自定义退出 AI 候选的必然新值，Human 方案 A 即依据；断言仍用 `toHaveText` 精确匹配，未放宽。 |
| `fixed-mainline-admission.test.ts:167-176` | 保留（实为收紧） | 原断言「custom 卡进 truth-dare 牌堆」锁的正是被 Plan A 废止的旧行为；新断言改为双向：self-mode 纯 custom（禁 builtin）＋内置局拒 custom（every builtin）。原「第二条路」断言系 Human 明令关闭的对象，非掩盖。 |
| `pack-enablement.test.ts:56-62` | 保留 | `toContain("custom-on")` → `toEqual(realBuiltinIds)`：候选集合收窄是 Plan A 语义本身，且由 `toContain`（存在性）改为 `toEqual`（全等），更严。 |
| `pack-enablement.test.ts:88-104,113-120`（强制留一） | 保留 | 留一守卫的计数域从「内置+自定义」收窄为「仅内置」——自定义退出 AI 组局后，它不再能为混合候选「续命」，守卫语义必须跟着真源走；同时新增「自定义自己可关」的覆盖，覆盖面净增。 |
| `pack-switcher.test.ts:69-72,116-121` | 保留 | 候选断言改全等＋新增「custom 仍可被主局切换选中」的反向断言（独立可玩集合不缩），恰好锁死 Plan A 的「退出组局但保留入口」双边。 |
| `random-launcher.test.ts:39-44` | 保留 | 随机池含 custom 不变（独立玩法入口），mixed 候选剔 custom——与 Q1 源头封堵一致。 |

无删断言、无加 sleep、无放宽匹配语义；新增 12 例（`custom-track-separation.test.ts`）+ 4 例（`v2-mid-mutual-abandoned.test.ts` B3-17 节）。

### Q9｜红线 — **全部 PASS**
- SSOT 350 题：`git diff HEAD -- lib/v2-content/generated/v2-ssot.generated.json` = 0 行。
- 版本三处 `1.5.0`：`package.json:3` / `public/sw.js:7` / `public/version.json:1`。
- `AI_MAINLINE_ENABLED` 缺省关闭：`isAiMainlineEnabled()` 仍是 `=== "true"`（`mainline-flag.ts:34-36`），无 .env 注入改动。
- `formal=0` 为如实结果：本评审独立重建 manifest，formal 0 / 被拒 390（三因各 390）/ hash 可复现。
- 无新增 Host disclosure UI：`app/game/page.tsx`、`MutualCheckSheet` 均不在本轮 diff。
- 未 commit / 未 push：HEAD 仍 `2fffafe`，全部改动在工作区。

### Q10｜docs/pm 恢复是否干净 — **是，PASS**
- `git status --short -- docs/pm/` 空；`git diff HEAD -- docs/pm/` = 0 行——两份越权文件已与 HEAD（Human 批准的 locked baseline）逐字一致。
- 本轮零新增 Plan 改动；`docs/pm` 不在本轮 15 项工作区改动中，本轮也无任何新 commit（HEAD 未动），故不存在「docs/pm 进提交」的情形。

## P0 / P1 Findings

- 无。

## P2 / P3 Backlog Findings

- **P3-1**｜custom-only 局切内置玩法必落 AWAITING 且洗牌不可救，Host 唯一出口是「结束本局」。行为符合 D8=A 严格方案与 Plan A（测试已锁），但「切玩法」点进去立刻拿到中性提示的体验略突兀；建议 Phase B 内容重构时顺带评估是否在切换面板对 custom-only 局做预期管理（如按钮旁一句说明），不在本轮范围。
- **P3-2**｜`customSelfMode` 派生的理论盲区：若自定义包 id 与内置 id 同形（当前 `PackEditor.tsx:14` 恒 `custom-` 前缀，不可达），该包会被当 custom 处理；后果仍是纯 custom 同堆，无混轨方向。仅作记录，不要求处理。
- **P3-3**｜评审执行 playwright/vitest 后，工作区出现 `next-env.d.ts` 自动改写（`.next/types` ↔ `.next/dev/types`，Next 工具链噪声，非 builder 改动；同史例见 BUGS-EXIT-GUARD §G）。编排者 commit 前需 `git checkout next-env.d.ts` 或确认目标变体，避免工具噪声混入业务提交。

## 总判定

**PASS**（P0 = 0 / blocking P1 = 0）。B3-16 把 custom 卡的进堆通道收窄为唯一的 `customSelfMode` 派生判定，且与既有跨轨闸（`refillAllowsCard`/`cardContentTrack`）同源、未新写第二套；建堆、fallback、恢复、切包四条路径逐一排除混轨可能，历史混装兼容读取不破坏存档。B3-17 严格停在「实时阻断 + 注释订正」技术能力内，未接 App、未置 abandoned、未偷定 HEAT/TIMING。6 处既有测试改动均为锁死 Plan A 新口径的必要修正，多处实为收紧。上一轮遗留的 P2-1/P2-4/P3-1（buildPlayableDeck 混装 / final awaiting 阻断 / MUTUAL_MIN_HEAT JSDoc）在本轮全部关闭。可交 QA → supervisor。
