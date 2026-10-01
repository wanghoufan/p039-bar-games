# CODE REVIEW｜CR-3 复检 CONTENT-01 第一包（24 张 Formal Fixed 真心话）全链路

- Task：CONTENT-01 / C1-1~C1-8 第一包全链路复检（code-reviewer，独立上下文）
- Commit：HEAD `48850a4`（本轮 30 项工作区改动**未 commit**，本复检基于工作区实态）
- Reviewer：code-reviewer（codebuddy/glm-5.3-flash）
- Result：**PASS**（P0 = 0 ／ blocking P1 = 0 ／ 非 blocking P1 = 2 ／ P2 = 2 ／ P3 = 3）

> ⚠️（2026-09-28 收尾补注，neat-freak；未改写原结论）本复检当时 30 项工作区改动**未 commit**；该批已随 `e49ee45` 提交并 push `main`，工作树 clean。原文「未 commit / 未 push」为该时点事实，保留留痕。另：P1-1（HANDOFF 未登记第一包）已由 TM 随 `e49ee45` 补齐 HANDOFF 第一包段落＋门禁新值，本项闭合。

> 复检方法：全部结论基于实读与实测（`git diff`、`node` 逐卡复算 manifest、源码逐行核对），
> 编排者门禁数字（tsc 0 / lint 0e11w / vitest 120 文件 1172 用例 0F / playwright 106P0F6S /
> build / build:fixed-manifest 414:414 / LEDGER-OK）采信并抽查复核，未整体重跑。

## 逐条回答（对应派工单 10 问）

1. **红线**：✅ 全守住。`git diff lib/v2-content/generated/v2-ssot.generated.json` 为空；版本三处同值 `1.5.0`（package.json / sw.js CACHE_VERSION / version.json）；冻结文件 `v2-state.ts` / `v2-reducer.ts` / `v2-mutual-check.ts` / `lib/ai/mainline-flag.ts` / `app/game/page.tsx` diff **全部为空**——认识阈值、窗口 `[12,14]`（v2-state.ts:43）、中途 `MUTUAL_MIN_HEAT=H3`（v2-state.ts:85）、D6 与 `isEffectiveInformationRound`（v2-reducer.ts:158，fail-closed）一字未动。
2. **无伪装 Formal**：✅ 用 node 实算产物：formal 轨 `allowedCardIds` 24 张全为 `PN-TRUTH-201~224`；这 24 张在 legacy 轨 provenance 中逐卡满足四条件（`metadataStatus=audited ∧ reviewed=true ∧ humanBarFit=PASS ∧ payloadHash 64位`）0 失败；`rejectedFromFormal` 390 张逐项被四道闸各自拦下（missingStrictMetadata/notHumanReviewed/humanBarFitNotPass 均 390）；`allowLegacyMetadata` 全仓 grep **0 命中**。
3. **reviewed 真实性与透明度**：无「machine PASS 当 Human PASS」暗门——manifest 构建只读 `BAR-FIT-HUMAN-REVIEW.json`，`humanReviewSource` 如实标注「product-reviewer(Research Reviewer, AI 角色)…三轮」；机器档位与人审分歧 4 张（204/207/220/223）即直接证据。**但字面冲突属实**：`FORMAL_FIXED_ADMISSION_REQUIREMENTS[2]`（fixed-content-manifest.ts:218）、`buildInfo.formalAdmission`、`assertHumanReviewConsistent` 报错文案仍写「真实人工审查」，与「审查者=AI 角色」在字面上冲突 → 见 P1-2，须 Human 拍板。
4. **内容质量**：✅ 抽检 8 张（201/204/212/213/216/222/223/224）+ 全 24 张脚本扫描：题面全为本人自述、无现场评价/猜测/指认（既有 50 张缺陷未复现）；A.1 两个零维度及 Plan §4 缺失维度已补齐；223 三轮重写后与 208 同款量化手法自洽；`informationGain` 无 low/0。轻微同质化见 P3-1。
5. **安全红线**：✅ 24 张 `consentMode` 全 `skip-anytime`；intensity 分布 I1:4/I2:9/I3:7/I4:2/I5:2 与声明一致；脚本扫描 I1~I3 零亲密/性内容（「异性」字样属关系边界题，非亲密内容）；触亲密的仅 222(I5)/223(I4)/224(I5) 且全为态度/边界类，无露骨、无强迫惩罚灌酒、无隐私脱衣非自愿。
6. **Heat 豁免未被本包打回**：✅ C1-1 预警已规避——24 张 `heatMin` 全 1（实读源文件逐卡确认）；`isFormalFixedCard` 的 Heat 硬过滤对这 24 张**实际生效**（v2-deal.ts:91-95、v2-router.ts:71，formal 卡受 `heatMin/heatMax` 约束、legacy 豁免）；生产 Heat 恒 H1 下 24 张**可被抽到**——MC Mode A（生产实况）：heatAtDraw 100% H1、Formal 曝光 **24/24 张全被抽到**、占比 19.9%、dead-end 归因 global_exhausted 而非 H1 桶耗尽（pack_exhausted=0）。
7. **双 Router 与口径漂移**：✅ C1-8 把审计 Router 与生产 `createDeckRouter` 的卡源统一到 `mainlineRuntimeCards()` / `mainlineCardMetaById()`（v2-router.ts、v2-deal.ts diff 实读确认），同源成立。`v2-router-fair-exposure.test.ts` 的夹具 `intensityLimit 5→4` 是**必要口径修正而非放宽**：第一包新增 2 张非 match-pair 的 I5 truth 卡（222/224）破坏了「I5 全为 match-pair ⇒ 顶档=I4 对称组」的夹具前提；上限 5→4 实为收紧，±18% 阈值、样本量、30s timeout 均未动。TIE_FIXTURE 20→22（+2 张 I4 truth：217/223）数学自洽。`v2-b7-router-single` 卡源同源修正，语义未放宽。
8. **测试改动逐条判定**：✅ 全部为「锁死已作废旧态的必要修正」，且多数比原断言更强——
   - `fixed-content-manifest.test.ts`：formal 0/390 硬编码 → 按人审输入派生，新增①24 张 entry 必须存在（防空转）②派生集合与产物**逐项**比对③双向 fail-closed（PASS 者全入、≠PASS 者不入）④snapshotHash 由真 hash 复算⑤rejection 五项逐项对账；旧 390 张「不得被推高」断言**保留**。
   - 「按人审输入派生」空转风险已堵死：`readFileSync` 读不到即 throw；24 张 entry 缺失即红；`legacy 轨 auditedIds=24` 断言兜底「桥接未接新包则 manifest 里无 audited」的情形。
   - `bar-fit.test.ts` / `bar-fit-canonical-input.test.ts`：口径从桥接合并视图（374）改回 SSOT adapter 390，与磁盘 `BAR-FIT-AUDIT.json#frozenFixed390` 对齐——对账集合未缩、逐卡 fail-closed 未变。
   - `pack-refill.test.ts`：用例显式取 snapshot 轨卡匹配自身前提，并加「非空 ∧ 全为 snapshot」断言——收紧。
   - `v2-b7-content-switch.test.ts`：新增「追加不前置、首卡与 350 张相对顺序不变」稳定性断言与精确 10 项直映断言——收紧。
9. **MC 数字可信**：✅ `audit-formal-truth-montecarlo.ts` 实读：4 桌型 × 1000 局/桌 × 20 轮、guard 1000、completed 0.85、软去重窗口 5——与 A.1 同口径，**无降样本、无关超时、无放宽门槛**。结论成立：ceiling=1 dead-end 67.2%（518/771，全 global_exhausted）；H4 到达 0 局（有效轮均值 3.93 ≪ 13）；中途互选窗口 count≥12 结构性不可达；补卡建议明示「一律靠补内容，不靠放宽过滤门槛」（FORMAL-TRUTH-MC.md:118）。
10. **未闭环项登记**：MC 报告 §6 完整登记 H4 断粮 / 窗口不可达 / ceiling=1 断粮并给补卡建议；A.1 旧 MC 产物 stale 已在 HANDOFF:49 登记；单包结论不可跨玩法外推已在报告口径（「单包 = 真心话…不切包」）写明。**缺口：HANDOFF.md 尚无本轮 C1-1~C1-8 段落**（顶部仍停在 B2.2 批次，:41「当前 formal=0 ⇒ 全库豁免」已过期）→ 见 P1-1。

## P0 / P1 Findings

**P0：无。**

**blocking P1：无。**

- **P1-1（非 blocking，owner=task-manager）**：`docs/handoff/HANDOFF.md` 未登记本轮 C1-1~C1-8：顶部 Captured at 仍为「B2.2 Step 1~6」，门禁数字为旧值（116 文件/1142 用例、legacy 390/formal 0），:41「当前 formal=0 ⇒ 全库豁免」在 formal=24 后已不成立（24 张现受 Heat 档约束）。影响：下个 session 按 HANDOFF 恢复会拿到过期事实。修复：收尾时由 TM 补第一包段落＋门禁新值＋「豁免→受约束」状态变化。
- **P1-2（非 blocking，须 Human 拍板，不可由 builder 自行改文案）**：`reviewed=true` 与代码文案「真实人工审查完成」的字面冲突（fixed-content-manifest.ts:218、buildInfo.formalAdmission、assertHumanReviewConsistent 报错文案）。`source`/`humanReviewSource` 已如实标注 AI 角色，无欺骗性，但严格读文案则本包 24 张「字面不合格」。修复选项（Research Reviewer 已列）：Human 拍板「审查者身份以产物 source 为准」或走 Change C 改文案/加 `reviewerKind` 字段。本复检倾向后者（改文案＋显式 `reviewerKind` 字段），但这是 Human 冻结域，不代决。

## P2 / P3 Backlog Findings

- **P2-1**：boundary tag 映射语义变化（v2-card-bridge.ts）：`proximity` 不再映 `physical-contact`、`relationship-sensitive` 不再映 `ex-partner`（改 `null`）。这是 Plan §3.1 明文要求（泛标签不冒充精确开关），且 fail-closed 反而加了一道（未登记/无取值均抛错），**不是放宽审查纪律**——但实际效果是勾选「身体接触」「前任相关」的用户可见题面变宽，属可感知行为变化。建议在 HANDOFF/发布说明显式记录一句，避免后续被当回归误报。
- **P2-2**：`formal-truth-pack.ts` 24 张全为 `targetMode=system-opposite-sex` 的**自述题**却挂 `truth-dare` 包（含 dare），生产轮次会以「真心话」呈现，无碍；但 `responseMode` 全 `public` + 222/223/224 亲密态度题在公开场合的尴尬度依赖现场主持节奏，RG-02 真人局值得重点观察这三张。
- **P3-1**：「各占几成＋为什么这么分」量化句式在 208/223 复用 2 张，包内有轻微模式化倾向；第二包建议换 2~3 种信息索取结构。
- **P3-2**：`formal-truth-pack.ts` 文件头第 6 行「本文件不被任何文件 import」已过时（C1-3 起 `v2-card-bridge.ts` 已 import），下轮顺手更正，避免误导。
- **P3-3**：`PN-TRUTH-207` 新题面「伴侣半天没回你消息」隐含「有伴侣」假设（Research Reviewer 二轮已记录），`skip-anytime` 兜底可接受；后续包注意对象泛化措辞。

## 总判定

**PASS** —— P0=0、blocking P1=0。24 张 Formal Fixed 的准入无伪装、Heat 豁免机制未被本包打回、双 Router 同口径、测试改动全部为锁死新态的必要修正且强于原断言、MC 未放宽、缺口如实登记。P1-1（HANDOFF 补登记）与 P1-2（reviewed 文案冲突，Human 拍板）上报编排者，均不阻断本包。

## 纪律与自检

- 本单只新增 `docs/review/CODE_REVIEW-CONTENT-01-PACK-1.md` 一个文件；未改业务代码、`docs/qa/**`、`docs/handoff/**`、`docs/pm/**`、两本账本；未 commit / 未 push。
- 实测清单：`git status/diff`（SSOT 与 5 个冻结文件零 diff）、三处版本 grep、`allowLegacyMetadata` 全仓 grep、manifest 产物 node 逐卡复算（24 张四条件 + 390 张被拒对账）、24 张题面/强度脚本扫描、MC 脚本参数实读、生产链测试实读。
