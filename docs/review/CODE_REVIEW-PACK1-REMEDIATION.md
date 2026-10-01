# CODE REVIEW

- Task: CR-4｜第一包整改四单复检（A1 reviewerKind 接入 / A1b 骨架脚本 / A3 Heat 重标 / A5 MC 双口径 + A4 HANDOFF）
- Commit: `614a3ea`（本轮 23 项改动未 commit，按工作区 diff 复核）
- Reviewer: code-reviewer（codebuddy/glm-5.3-flash）
- Result: **PASS**

> 复核方式：逐 diff 通读全部 23 项改动；`temp/HEAT-REVIEW-PACK1.md`（编排者更正版）与测试逐卡对照；全仓 grep 复查措辞；独立复跑 5 个关键测试文件（60/60 绿）。

> ⚠️（2026-09-29 neat-freak 收尾注，未改写本评审结论）本单复核的 23 项工作区改动已随 `c61f7d4`（第一包整改）提交并 push `main`；原文「未 commit / 未 push」（:4 / :65）为该时点事实，保留留痕。

## 十问逐答

### 1. Human 本轮四项冻结是否零偷改 —— ✅ 是
- ① `reviewed=true` 语义已改为「有一个独立 reviewer 已逐卡审查并给出明确结论」，不再等于真人（`lib/v2-content/fixed-content-manifest.ts:164-172`、`fixed-content-manifest-build.ts` 接口注释同步）。
- ② `reviewerKind` 被构建器真实读取：`HumanFixedReview.reviewerKind` 必填 → `assertHumanReviewConsistent` 校验 → `buildFixedContentTracks` 写入 `buildInfo.reviewerKind`（`fixed-content-manifest-build.ts:330-420`），产物实测 `ai-role`。
- ③ `humanBarFit` 未 rename，仅在 `bar-fit.ts:49-52`、`fixed-content-manifest.ts:73-76` 加「历史兼容字段名」警示，全仓字段名零变更。
- ④ `FORMAL_FIXED_PURPOSE` 已改为动态描述（`fixed-content-manifest-build.ts`，产物同步 5+/4-）；三处「当前 0 张 / 第一包后」过期动态事实改动态描述；Human Step 4 冻结原文保留并标注「**历史冻结时状态，原样保留**」（`fixed-content-manifest.ts:26`）。

### 2. 身份是否只是「JSON 里一个被忽略的键」 —— ✅ 否，是真校验
- `assertHumanReviewConsistent` 新增第一道校验：`!isValidReviewerKind(review.reviewerKind)` 即抛错（`fixed-content-manifest-build.ts:248-253`），缺失 / 非法（测试用 `"robot"`）均 fail-closed，**不默认 `human`、不默认放行**（有专门测试锁死）。
- 构建脚本 `loadHumanReview` 双重校验（`scripts/build-fixed-content-manifest.ts:66-89`）。
- 产物 `buildInfo.reviewerKind` 来自 `humanReview.reviewerKind`（输入），非硬编码；测试用同一 entries 分别以 `ai-role` / `human` 构建，准入集合逐字相同（身份对称性锁死）。
- `EMPTY_HUMAN_FIXED_REVIEW.reviewerKind="ai-role"`：entries 为空的占位，注释明确「不得默认 human」——诚实取值，可接受。

### 3. AI 是否仍被写成「真人」 —— ✅ 已清零
全仓 grep `真实人工审查|真人审查|真实人工|人工审查完成`（lib/scripts/tests/app）仅剩 2 处命中，均为合法：
- `audit-bar-fit-human-review-skeleton.ts`：「真人审查重跑时显式传 `--reviewer-kind=human`」——是给未来真人审查的指引；
- `fixed-content-manifest.ts`：Human Step 4 冻结原文引用，已带「历史冻结时状态」标注。
其余文案（准入表、requirements、被拒计数注释、构建日志、报告脚本）已全部中性化为「独立审查」。

### 4. Formal admission 有没有被放宽 —— ✅ 一条未松
- `satisfiesFormalAdmission` 四条件（strict metadata ∧ `humanBarFit==="PASS"` ∧ `reviewed===true` ∧ hash 完整）**零改动**；`reviewerKind` 完全不参与准入判定（构建函数里只进 `buildInfo`）。
- 空输入 ⇒ formal=0 的 fail-closed 测试保留且通过（`EMPTY_HUMAN_FIXED_REVIEW` 重建 → `formalCount=0`）。
- 身份对称性测试反向锁死：`human` 与 `ai-role` 的 `formalCount` 必须相等——身份既不放宽也不收紧。

### 5. Heat 是否逐字来自 reviewer —— ✅ 24/24 一致
- `tests/unit/formal-truth-heat-labels.test.ts` 的 `REVIEWER_HEAT` 24 行与 `temp/HEAT-REVIEW-PACK1.md` 逐卡行（编排者更正版）**逐字核对一致**：`PN-TRUTH-205` = **2/2**（采纳逐卡行，编排者裁决正确——原汇总段把 205 同时列 H2/H3 属笔误，且 205 改 3/3 会超「只改两字段」授权）。
- 分布 H1=3/H2=9/H3=10/H4=2（min）、H2=1/H3=4/H4=19（max）、`heatMin<=heatMax` 24/24，均与更正后汇总一致。
- **builder 无擅自调 Heat 或改题面**：非 Heat 字段 sha256 指纹测试（24/24 命中落地前快照）+ 指纹口径自证测试（改 text/intensity 必变红）双保险；`git diff` 实测 `formal-truth-pack.ts` 仅 heatMin/heatMax 数值与注释变化。

### 6. A3 更新的 4 处既有断言：必要修正，非放宽 —— ✅
| 文件 | 判定 | 理由 |
|---|---|---|
| `v2-router-card-source-consistency.test.ts` | 必要修正 | 旧断言 `FORMAL_IDS.every(在H1桶)` 锁的正是已作废的「24/24 heatMin=1」口径。新断言更有约束力：H1 桶 Formal 集合必须与卡源派生集合**逐字相同**（不空、不全、21 张确实不在桶内），另保留 legacy 豁免回归检查 |
| `v2-router-fair-exposure.test.ts` | 必要修正 | TIE_FIXTURE 桶构成 102→83、top 档 22→20 是诚实标注的**数学后果**，不是调参：intensityLimit=4、±18%、样本量、tie-break 语义全部未动；确定性序列按新候选集重算仍逐字钉死（注释给了原值→新值→原因） |
| `formal-truth-heat-labels.test.ts`（新） | 加强 | 逐卡值 + 分布 + sha256 指纹 + 双口径四层锁死 |
| `production-chain.test.ts` | 必要修正 + 加强 | 旧「H1→H4 逐档可达」依赖作废口径；新断言（0 张 Formal / 3 轮后 PACK_EXHAUSTED / effective=0）比旧的**更苛刻**地反映了当前真实生产行为，且新增情形④口径 B 门禁 |

新断言全部有实质约束（非空转），fail-closed 语义（空审查⇒formal=0、PASS 全入/非 PASS 不入、reviewed 双向对账）保留并加码。

### 7. 双口径是否真的分开 —— ✅ 是
- 报告脚本强制分章：`## 0｜口径声明` + `## 1｜口径 A` + `## 2｜口径 B`，`ENGINE=mc.modeB`（显式 disclosure）/ `UI=mc.modeA`（生产实况），变量级防混写，并写「⛔ 禁止把 A 当 B」。
- `FORMAL-TRUTH-MC.md` 实测：口径 B 恒 H1、可抽 3 张（201/202/203）；口径 A 数据全部标注在 A 章下；无一处把 A 的「可达 H2/H3/H4」写进 B。
- 口径 B 门禁**有效**：情形④①源码扫描断言 `roundDisclosureForCurrentRound` 函数体必须含 `return undefined;` 且不得含 `return roundDisclosureSignal` / `selfDisclosed`——有人塞值立即变红；②行为级断言（Formal 卡真被抽出、sidecar 有 metadata、effective 仍恒 0、Heat 恒 H1）独立复跑通过。

### 8. A5 诚实缺口登记 —— ✅ 如实登记，未反向压 heatMin
- 「口径 B 当前 UI 可抽 3 张（201/202/203）」与「口径 A 也断在 H1→H2 冷启门（H1 桶可计数 Formal 3 < H2 门槛 4，缺口 1 张，4000 局 0 局到达 H2）」均写进 MC 报告 §2 与 HANDOFF（含「CONTENT-01 想解决的问题重新变为 inert」这一不利事实）。
- 修复方向全部是「**新增真实浅关系题 / 补 heatMin=1 且强度偏高的卡**」，并明写「**不得用压低 heatMin 解决**」——没有任何建议或代码反向压低 heatMin。`audit-formal-truth-selfcheck.ts` 还新增了「heatMax 全为 H4 即报错」的反向护栏。

### 9. 红线 —— ✅ 全部守住
- 旧 350 题 `text` 零修改（唯一内容 diff 是 `formal-truth-pack.ts` 的 heatMin/heatMax + 注释；指纹测试锁死）；generated 产物 diff 恰为 5+/4-（purpose/requirements/buildInfo），provenance/hash 零扰动。
- 三处版本 `1.5.0`（package.json / sw.js CACHE_VERSION / version.json）一致且本轮未动。
- `AI_MAINLINE_ENABLED` 关闭（.env.local 无该键，入口守卫代码未动）。
- 认识阈值、窗口 `[12,14]`、`MUTUAL_MIN_HEAT=H3`、D6、`isEffectiveInformationRound` fail-closed：`lib/engine`、`lib/v2-relationship` **零文件改动**。
- 无新增 Host disclosure UI（`app/` 零改动；测试反而锁死 producer 恒 undefined）。
- 未 commit / 未 push（工作区 23 项改动 + 1 新文件在盘）。

### 10. A5 是否为让指标好看而放宽 —— ✅ 否
- MC 脚本 diff 仅三处：`formalLegalIds` / `formalExposedIds` 新增明细字段（可解释性增强）、ceiling 分档从 `[1,2]` 扩到 `[1,5]`（**覆盖扩展**，只多不少）、无任何阈值/样本/超时改动。
- ±18% 阈值、4000 局样本、TARGET_ROUNDS、超时全部原样（diff 未触及）；报告脚本明写「±18% 阈值、样本量一律不动」。
- 指标方向是**变难看**：全包局 0 张 Formal、有效轮 0、Heat 恒 H1 全部如实入报告与测试——与「让指标好看」相反，正是诚实化。

## P0 / P1 Findings

- 无 P0；无 blocking P1；无非 blocking P1。

## P2 / P3 Backlog Findings

- **P3｜`scripts/audit-formal-truth-montecarlo.ts` ceiling 分档 `[1,2]→[1,5]`**：属报告覆盖扩展（每档约 1/5 样本，I4/I5 档样本量较小），非放宽；建议后续在报告标注各档样本量以便读数。
- **P3｜`EMPTY_HUMAN_FIXED_REVIEW.reviewerKind="ai-role"`**：为无审查产物时的占位身份，entries 为空不参与准入，注释已说明「不得默认 human」；若未来引入 `"(none)"` 类第三态更整洁，非本轮义务。
- **P3｜production-chain 情形④的 UI 驱动为测试内复刻**（`resolveRoundAndReduce(dealt, "complete")` 不传第三参），与 `app/game/page.tsx` 行为靠源码扫描锚定；若未来 applyRoundSignal 结构变化，源码扫描断言会先行变红，可接受。
- **P3｜`PN-TRUTH-205` 题面措辞**（「熟人相处久了才会发现」与 Heat 重标后的 2/2 自洽，但 reviewer 已登记题面本身措辞可再打磨）：已在 reviewer 表登记为后续 backlog，本轮按「只改 metadata 不改题面」授权正确未动。

## 总判定

**PASS** —— 四单（A1 / A1b / A3 / A5 + A4）全部按冻结口径落地，零偷改、零放宽、零越界；诚实缺口（口径 B 只可抽 3 张、口径 A 断在 H1→H2 冷启门）已如实登记且未被用来反向压低 heatMin。可进入 QA/supervisor 环节。
