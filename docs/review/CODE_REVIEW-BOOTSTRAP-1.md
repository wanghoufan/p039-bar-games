# CODE REVIEW

- Task: CR-5｜「第二包前置整改 + Truth H1 Bootstrap」整条链复检（R0-1/R0-3 HANDOFF｜R0-2 note 派生｜R1 205 单卡复核｜R2 Bootstrap 7 张｜R3 审查输入扩展｜B4 重写｜B5 复判｜B5b 回填 formal 24→31｜B6 报告全派生）
- Commit: `c61f7d4`（本轮 32 项改动未 commit，按工作区 diff 复核）
- Reviewer: code-reviewer（codebuddy/glm-5.3-flash）
- Result: **PASS**（P0=0 / blocking P1=0；P2×1、P3×3，见文末）

> 复核方式：逐 diff 通读全部 32 项改动；独立复算第一包 24 条指纹（用 `git show HEAD:` 旧件重算 sha256，与冻结常量逐字比对）；独立复读 3 份 reviewer 落盘件（`temp/HEAT-REVIEW-205.md` / `temp/REVIEW-BOOTSTRAP-7.md` / `temp/REVIEW-BOOTSTRAP-7-RECHECK.md`）并逐卡对照落地值；实读 MC / 生产链 / 审计 / manifest 四份产物数字；独立复跑 extend `--check`（指纹相等=true，四条自校验全过）与 5 个关键测试文件（76/76 绿）；全仓 stale 字符串 grep 0 命中。

> ⚠️（2026-09-29 neat-freak 收尾注，未改写本评审结论）本单复核的 32 项工作区改动已随 `730c025`（Truth H1 Bootstrap，formal 24→31）提交并 push `main`；原文「未 commit / 未 push」（:4 / :53）为该时点事实，保留留痕。

## 十问逐答

### 1. Heat/审查纪律是否守住 —— ✅ 是
- `PN-TRUTH-205` = `1/3`：逐字来自 `temp/HEAT-REVIEW-205.md`（reviewer 独立单卡复核，含题面磁盘实读原文与 4 条理由）；落地 diff 实测只改 `heatMin`/`heatMax` 两字段 + 注释，题面逐字不动（`formal-truth-pack.ts:259-262`）。
- Bootstrap 7 张 `heatMin` 全 1：来自 `temp/REVIEW-BOOTSTRAP-7.md` §2.2（reviewer 原话「7 张确实都是 H1 浅关系题，无需为凑数量压低任何一张，我也没有一张建议上调」）+ RECHECK 复判确认。`heatMax` 逐卡诚实（228 4→3、230 3→2 均为 reviewer 建议值，B4 落地、B5 复判确认，包注释声明分布与实测逐张吻合）。
- **零改门槛**：`lib/engine`、`lib/v2-relationship`（`HEAT_THRESHOLDS`/`MUTUAL_MIN_HEAT`/窗口/认识阈值/D6）零文件改动；MC 脚本 diff 只新增 `h1Formal` 画像与 `formalCountableUpTo` 派生字段，阈值/样本/±18%/超时未触及。没有任何一处为 MC 好看反向压 `heatMin`（反向护栏反而新增了「Bootstrap heatMin≠1 即报错」「heatMax 全 4 即报错」）。

### 2. 205 降档是否被滥用 / 冷启动归因 —— ✅ 诚实修正；冷启动由 7 张新卡解决，不是 205
- **判定为诚实修正，非「为补 H1 而降档」**：①理由与 Heat 无关且可复算——「熟人相处久了才会发现」是答案类型说明非提问门槛、`relationStage=notice` 与 `heatMin=2` 卡内自相矛盾、`heatMax=2` 对低能耗自陈题属误杀；②同一次复核把 `heatMax` 2→**3**（放宽上限只会让卡在更多档可用，与「压库存造假」方向相反）；③reviewer 落盘在先（独立 session + shasum 自证）、builder 只照抄建议值；④题面措辞矛盾（reviewer 指出的残留）本轮**未**顺手改，守「只改两字段」授权。
- **冷启动归因（数据）**：改动前 `heatMin=1` Formal = 3（201/202/203）< 门槛 4。**只有 205**：4 = 门槛 4，余量 0，且 4 张全 I1，在全包建堆中被 legacy 高强度档压住（曝光侧无改善）。**只有 7 张 Bootstrap（无 205）**：3+7 = 10 ≥ 4，余量 6。**两者合并（现态）**：11 张，余量 7；生产链 `scenarioFormalOnly` 实测逐档首达 1/4/8/13、跑满 20 轮终态 H4；MC 口径 A 4000 局 reach H2 = 1011 局（25.3%）。⇒ **决定性库存来自 7 张新卡（余量 6→7），205 只贡献 +1 且单独存在时余量为 0**；`scenarioBootstrapOnly` 单独 7 张即可 H2@4（7 张后 AWAITING，note 如实写「H3 缺口 1」）。

### 3. reviewed / reviewerKind 纪律 —— ✅ 守住
- 7 条回填 note 与 reviewer 落盘件逐条对应（每条 note 注明依据 §1/§2/§3 原文，含 226/228/230「由 BORDERLINE 升 PASS」的复判依据，测试 `bar-fit-review-input.test.ts:154` 强制锁死该措辞）。
- `reviewerKind` 仍 `ai-role`（产物 `buildInfo` 实测），extend 脚本对非法身份 fail-closed；追加语与测试均明写「机器档位只是恰好同档，**不是**定档依据」（测试 `:165` 锁定）。机器 PASS 未被当成人工结论。

### 4. 既有 24 条是否一字未改 / 指纹可否绕过 —— ✅ 未改；机制有效，绕过仅剩「改常量」一条受控路径
- 独立复算：`git show HEAD:BAR-FIT-HUMAN-REVIEW.json` 的 24 条 `(id,reviewed,humanBarFit,note)` sha256 = `84846ed1…e202`，与冻结常量**逐字相等**；现盘 24 条同指纹；本轮 diff 实测 24 条区域零改动（只有追加）。
- 有效性：extend 脚本写盘前指纹不符即拒绝写盘（fail-closed）；`--check` 只读模式可作门禁探针（本审查实测通过）；测试 `:199` 独立锁同指纹。
- 绕过面：冻结常量在 lib 代码内，**同时**改常量+测试可绕过——但该路径被变更流程约束（须 reviewer 重审 + 记 HANDOFF），且绕过会留下明显的 diff 痕迹。属「防静默漂移/防脚本误改」级护栏，非密码学防篡改（见 P3-1）。另：指纹只覆盖第一包 24 条，Bootstrap 7 条本身无等价锁（靠 note 依据断言 + temp 证据链，见 P3-1 建议）。

### 5. stale 清理与护栏强度 —— ✅ 报告侧彻底；护栏可抓住手改
- 报告脚本（`audit-formal-truth-report.ts`）B6 后**全派生**：「仅 Formal 24 张」「缺口 1」「全为 intensity=1」「PACK_EXHAUSTED 第 N 轮」等结论式硬编码全部删除，改为按产物现判（`if/else` 双分支都写、缺就写缺）；`H2_SHORTFALL`/`h3Shortfall`/`h4Shortfall`/`h1AllI1` 全部由 `formalCountableUpTo`/`byIntensity` 现算；脚本启动即校验 `staticHeatAvailability.H1.formalLegal == h1Formal.count` 自相矛盾即抛错。
- 全仓 grep 旧口径字符串（缺口 1 / Formal 24 / H1=3 / 只够走 3 等）在 scripts+lib 0 命中。
- 护栏强度（评估，非只看绿）：①手改报告 md 数字 → `mc-report-derivation` B6③「两章数字分别 == modeB/modeA」+ B6④「报告印出张数/清单 == 产物」逐字反查会红；②手改链产物 note → `production-chain-note` ④复算闸门（note 必须能由 rounds+库存+阈值现算）+ ⑤⑥构造反例会红；③手改审查汇总 → `checkReviewInput` 篡改反例（total+1 / 分组失真 / 父级≠子组和）覆盖；④旧口径回潮 → B6⑤ 字符串扫描。结论：对「篡改产物/报告数字」类手改有实质拦截力，不是摆设。

### 6. 测试改动逐个判定 —— ✅ 全部「必要口径修正或收紧」，无一放宽
| 文件 | 判定 | 理由 |
|---|---|---|
| `formal-truth-heat-labels.test.ts` | 必要修正 + 收紧 | 205 期望值 2/2→1/3 是 reviewer 复核的落地（带作废原因）；桶过滤由 `startsWith("PN-TRUTH-2")` 收窄为 `FIRST_PACK_ID_SET`，防 Bootstrap 污染第一包断言——**更严** |
| `fixed-content-manifest.test.ts` | 收紧 | 硬编码 414/24 → 按冻结卡+人审输入派生；新增「auditedReviewed == 31 id 集、unreviewed 空」整集断言；`UNREVIEWED` 进 audited 枚举是配合「audited≠reviewed」两段口径且自洽断言保留——约束面变宽 |
| `formal-truth-pipeline.test.ts` / `v2-b7-content-switch` | 必要修正 | 24→31、末段顺序断言扩展；`[0]` 稳定断言保留 |
| `v2-router-card-source-consistency` | 必要修正 + 收紧 | 21→20 张不可达逐字列表；H1 桶集合 == 派生集合断言保留 |
| `v2-router-fair-exposure` | 必要修正 | 83→91 是候选集变化的数学后果；top 档 20 不变、±18%/样本/tie-break 未动、确定性序列按新候选集重算 |
| `v2-formal-truth-production-chain.test.ts` | 收紧 | 旧「3 轮 PACK_EXHAUSTED」换为「逐档首达 1/4/8/13、跑满 20 轮终态 H4」；新增 ②b Bootstrap 子集情形；Formal 判定改用 `formalFixedIdSet()`（manifest 真源，弃前缀猜测）——更严 |
| 新增 4 个测试文件 | 加强 | bootstrap-pack 26 例（逐卡锁值+反向护栏+全库不变量+双 Router 可达+四条件准入）；bar-fit-review-input（结构自校验+指纹+篡改反例）；production-chain-note / mc-report-derivation（派生闸门+A/B 不混用） |
- 「候选桶 → Formal 子集」「24→31 派生」未削弱约束：B5 后 Bootstrap 已过审，改用 manifest 真源判定正是诚实口径；`formalCountableUpTo` 派生断言（11/19/29/31）反而把冷启结论也锁进了测试。

### 7. 双口径与分层是否可信 —— ✅ 真分开
- 报告 §0 口径声明 + §1（A）/§2（B）强制分章；`modeA`/`modeB` 变量级分离；「H2 reach > 0（1011/4000, 25.3%）」只出现在 §1 口径 A 章；§2 实测 `effective 恒 0 / heatAtDraw H1 93443 次（H2/H3/H4 = 0）/ 到达 0/0/0 / 互选窗口 0 局`。无一处把 A 的「可达 H2/H3/H4」写进 B；B6③ 测试把两章数字分别钉死到 modeB/modeA，塞值即红。分层结论（全包/仅 Formal/仅 Bootstrap/仅 legacy 四情形）与 JSON 逐字段一致（本审查独立实读）。

### 8. 红线 —— ✅ 全部守住
- 旧 350 题 `v2-ssot.generated.json` 零改动（不在本轮改动列表）；唯一内容源改动 = `formal-truth-pack.ts` 两字段 + 新文件 bootstrap-pack。
- 三处版本 `1.5.0`（package.json / sw.js / version.json 实测同值，未 bump）；`AI_MAINLINE_ENABLED` 在 `.env.local` 无键（0 命中）；`app/`、`lib/engine`、`lib/v2-relationship` 零文件改动（认识阈值/窗口[12,14]/中途 H3/D6/fail-closed 四项未动）；无新增 Host disclosure UI。
- 未 commit / 未 push（32 项改动全在工作区，HEAD 仍 `c61f7d4`）。

### 9. 两处已知未闭环是否如实标注 —— ✅ 在册
- ①`docs/qa/content-audit/` 其它手写报告引旧数字：此前已登记于 HANDOFF 历史段（owner 归属已写明），本轮不涉、未隐瞒（本轮只重跑了 `FORMAL-TRUTH-MC*` 与 `FORMAL-TRUTH-PRODUCTION-CHAIN.json`）。
- ②`PN-TRUTH-205` 题面措辞 backlog：reviewer 件 §「措辞建议（仅建议，未改题）」在册（方案 A/B/C 三案），本轮只改 Heat 未改题，处置正确。

### 10. 本轮新增 P2/P3 有无隐藏 —— ✅ 无隐藏
- B4 曾因派工禁改 `docs/**` 无法重跑 `audit-bar-fit.ts` 一事，最终已闭环：`BAR-FIT-AUDIT.json/md` 已刷新（本审查实读 `cardCount=421 / rows=421 / 7 张 machineVerdict=PASS / 对账 421:421、inconsistent=0、ok=true / forensic=false ∧ admissionEligible=true`），无 excerpt 与实况打架的残留。

## P0 / P1 Findings

- 无 P0；无 blocking P1；无非 blocking P1。

## P2 / P3 Backlog Findings

- **P2｜HANDOFF「大交接 2」两处陈述在本轮 B5b 后已过期（编排者收口时必须更新后再 commit）**：
  ①R0-1 写入的「当前真实阻塞：24 张 Formal 中 heatMin=1 仅 3 张…卡在 H1 进不了 H2」——现态为 31 张 / 11 张 / 余量 7、库存侧已解除（本审查 §2 的数据）；
  ②「第二包状态 = PREP / `lib/v2-content` 目前仍只有 `formal-truth-pack.ts` 一个正式内容源」——现已有第二个内容源且 7 张已入 Formal。
  这两句是本轮开工时的快照，与本轮自己的「结论不得与实测打架」纪律不一致；不更新会误导下个 session 以为阻塞仍开着、Bootstrap 不存在。属 TM 位置文件，本审查不改，仅登记。
- **P3｜指纹护栏的边界**：①冻结常量与测试同在 lib/侧，同时改两者可绕过（有 reviewer 重审+HANDOFF 的流程约束兜底）；②指纹只锁第一包 24 条，Bootstrap 7 条结论靠 note 依据断言 + temp 证据链维持。建议后续把 31 条统一纳指纹（reviewer 重审时随结论一起更新），非本轮义务。
- **P3｜`v2-router-fair-exposure.test.ts` 注释残留 R2 旧口径**：「R2 Bootstrap 7 张…尚未过审查 ⇒ 非 Formal ⇒ 不受 Heat 硬过滤」——B5 后 7 张已是 Formal（因 heatMin=1 仍在 H1 桶，桶构成 91 不变），理由句过期、数字仍对；建议下次触该文件时顺手更正。
- **P3｜`audit-formal-truth-selfcheck.ts` 头注释仍称 Bootstrap 为「候选」**（R2 口径），B5 后已是 Formal；纯文案，护栏逻辑不受影响。

## 总判定

**PASS** —— Heat 逐张来自 reviewer（205 = 独立单卡复核，7 张 = 两轮独立审查），零压低、零改门槛；冷启动在库存侧由 7 张新卡解决（余量 6→7），205 是诚实修正且单独不足以解决；既有 24 条经独立指纹复算一字未改；报告全派生、双口径真分开、四情形分层与产物逐字段一致；新增测试全部为收紧或必要修正；红线全守住。P2 的 HANDOFF 两处过期陈述须编排者在收口 commit 前更新。可进入 QA/supervisor 环节。
