# PRODUCT_PLAN V2.3｜A9 产品验收表达补充（迭代更新）

## 0. 版本定位与受控重开

- `PLAN_VERSION=PRODUCT_PLAN_V2.3-AC-ITERATION`；`DEV_BASELINE=PRODUCT_PLAN_V2.3-AC-ITERATION`；`PROJECT_PHASE=DEVELOP`；`PLAN_GATE=APPROVED`。
- 父版本：`PRODUCT_PLAN_V2.2-FIXED-CONTENT-FIRST`。本版以规范性引用**完整继承父版本全文**的 Requirement、DoD、冻结数值、门禁、未决事项和安全约束；父版本原文件保持原样。父版本历史性的计划阶段表述，以本节经批准的新版本状态为准。本版与父版本的**唯一差异**是版本号与新增的「§产品验收标准（AC）」表达；未新增功能、未扩大范围、未改变任何产品要求。
- `CHANGE_REQUEST=C`：仅为补齐产品验收表达受控重开。Human Approval：2026-09-30 已明确批准，原话要点：「让 planner 按 Controlled Reopen / Change C，只补最小产品验收信息」。本次批准已具备，不重复等待 Human Gate；本版即新开发基线。
- `RELEASE_TYPE=ITERATION_UPDATE`（发布类型：迭代更新）。本次迭代不强制用户签收；**关键 AC 未测、控件未实际点击或证据缺失仍不得报完工**。本文件建立验收口径，QA 按 §3 回填产品验收追踪矩阵并复核后才可解除治理性阻断。`RC=RC_NEEDS_REFREEZE`、`CONTENT-01=OPEN`、`RG-02=HOLD_BY_CONTENT_01`；本版不 Release、不部署。

### 0.1 父版本红线逐项未改与核对方式

核对口径：A9 已提交的 `git diff --name-only 0a879ed..013939b` 显示 `app/`、`components/`、`styles/`、`lib/v2-relationship/`、`lib/engine/` 改动均为 0；本次仅新增本 Plan 文件。以下“未改”指本次 Change C 未改变规则或实现，不把父版本仍待完成的 DoD 声称为已完成。

| 冻结项 | 本版结论与核对方式 |
|---|---|
| Heat：`HEAT_THRESHOLDS`、`heatMin` 定档 | **未改**；对照上述差异路径，并查 `tests/unit/v2-mutual-check.test.ts`、`tests/unit/formal-truth-mc-report-derivation.test.ts` 的既有断言及 `docs/qa/BUGS-A9-CLOSEOUT.md` 红线表。 |
| Mutual：`[12,14]`、`MUTUAL_MIN_HEAT=H3`、最终 Mutual HEAT/TIMING 留空 | **未改**；对照 `lib/v2-relationship/` 差异为 0，`tests/unit/v2-mutual-check.test.ts` 的中途窗口用例，以及父版本 §7.2 对最终资格待冻结的原文；不把待冻结值写成已冻结。 |
| Router：`lib/v2-relationship/**` 与 `lib/engine/**` | **未改**；按上述 diff 路径核对。 |
| 题库准入四条件、有效轮 fail-closed 四项、legacy 豁免 | **未削弱**；`tests/unit/fixed-content-manifest.test.ts` 四条件/空输入/身份用例、`tests/integration/v2-formal-truth-production-chain.test.ts` 及 `docs/qa/BUGS-A9-CLOSEOUT.md` 逐项核对。 |
| UI 逻辑及 Host disclosure UI | **未改、未新增**；`app/`、`components/`、`styles/` 差异为 0；`tests/integration/v2-formal-truth-production-chain.test.ts` 的「④ 当前真实 UI 口径（A5）」断言 `roundDisclosureForCurrentRound()` 恒 `undefined`。 |
| 旧 350 题 `text` | **未改**；`docs/qa/BUGS-A9-CLOSEOUT.md` 记录 SSOT diff=0，`tests/unit/retired-truth-archive.test.ts` 冻结 SHA-256 负向探针变红后还原。 |
| 三处版本 `1.5.0` | **未改且同值**；`docs/qa/BUGS-A9-CLOSEOUT.md` 对 `package.json`、`public/version.json`、`public/sw.js` 的 `CACHE_VERSION` 逐项对账。 |
| `AI_MAINLINE_ENABLED=off` | **未改**；`docs/handoff/HANDOFF.md` 大交接 4 的现役状态及 `tests/unit/content-track-gate.test.ts` 的关闭时不发请求用例核对。 |
| RC 重冻与部署 | **均未进行**；`docs/handoff/HANDOFF.md` 大交接 4 的 `RC_NEEDS_REFREEZE`、未部署状态及本版无 Release 工作项核对。 |

## 1. 本版交付边界与证据基线

本版只为已完成的 A9 内容库收口、测试迁移、证据重刷、E2E 端口治本、记录层事实修正和文档治理对齐补验收表达。现役 Formal 53（H1 14 / H2 17 / H3 16 / H4 6）；legacy 443 / audited 53 / reviewed 53 / formal 53；30 张退役卡均不在运行时卡源和 Formal；`follow_up_hook=9` 是诊断基线，不是放行门；A2 最终 KEEP 5 / REWRITE 5 / REPLACE 21。`6cac2a2` 与 `013939b` 已提交并推送；前述 diff 路径的 UI 和 Router/Engine 改动数均为 0。

共用既有证据：`docs/qa/BUGS-A9-CLOSEOUT.md` 记录 `npx vitest run --testTimeout=30000` 为 137 文件 / 1453 用例 / 0 failed，`PLAYWRIGHT_BASE_URL=http://127.0.0.1:3210 npx playwright test` 在真实 Chromium 的 Pixel 7、390×844 视口为 **106 passed / 0 failed / 6 skipped**；6 条条件 skip 不计 PASS。`npx tsc --noEmit` 0 error，`pnpm lint` 0 error / 12 既有 warning，`pnpm build` 通过。下表引用的是现存文件和现存测试名，不要求重造既有证据。

## 2. 产品验收标准（AC）

`状态=已有证据、待 QA 回填` 表示证据已存在，**不代表本次治理性 QA Gate 已通过**。关键判据：核心用户路径、本版核心内容交付、红线保护、端口治本及产物复现。关联 User Flow 关键任务：UF-1 从首页开局并作答；UF-2 连续玩、结束或退出；UF-3 切换玩法；UF-4 安全取得固定库合格卡。表中每条均对应本版已交付或受本版保护的用户可见结果；记录层与构建项以玩家实际拿到的卡和可继续玩的结果观察。

| AC 编号 | 用户可见要求（一句话）/ 关联任务 | 验收方法（可观察/可测） | 关键 AC? | 现有证据（文件＋用例名/命令＋实测值） | 状态 |
|---|---|---|---|---|---|
| AC-01 | 从首页可进入本地局并抽到真心话、作答后继续下一题。UF-1/UF-2 | Chromium 实际点击开局、真心话、完成、继续；观察题卡及轮次变化。 | 是 | `tests/e2e/spin-bottle.spec.ts`「转瓶子：首页单开局（本地题库、牌堆为空）点真心话照样出题，不再原地无响应」及「转瓶子：固定 RNG 命中 Alex → 真心话链入现有 truth-dare（被指到的人作答）→ 完成 → 同一局继续」；`tests/e2e/game-flow.spec.ts`「本地整局可完成、换题、跳过并结束总结」；共用 E2E 106 passed / 0 failed / 6 skipped。 | 已有证据、待 QA 回填 |
| AC-02 | 玩家可以结束一局，退出确认的继续玩/退出选择会产生相应页面变化。UF-2 | 实际点击结束和退出确认，观察总结或导航；取消时仍留原页。 | 是 | `tests/e2e/game-flow.spec.ts`「本地整局可完成、换题、跳过并结束总结」；`tests/e2e/exit-confirm.spec.ts`「首页按浏览器返回：弹退出确认，点「继续玩」留在原地」及「确认框里点「退出」：真的离开当前页（Web 口径＝导航离开本站）」；E2E 106/0/6。 | 已有证据、待 QA 回填 |
| AC-03 | 玩家在同一局切换玩法后继续游玩，原局身份与配置保留。UF-3 | 实际点击切包控件并观察当前玩法、Session ID 与配置。 | 是 | `tests/e2e/pack-switching.spec.ts`「同一局连续切换玩法，Session ID / 配置 / 尺度不变」及「已有进行中的局，首页点另一个玩法直接切换并回到主局」；E2E 106/0/6。 | 已有证据、待 QA 回填 |
| AC-04 | 玩家拿到的是已审、合格且可追溯的固定内容；退役 30 卡不可被抽回。UF-4 | 对账 Formal 与运行时 ID 集合，抽查审查结论和退役隔离；应 Formal 53、退役命中 0。 | 是 | `docs/review/RESEARCH_REVIEW-PACK1-FINAL-53.md` 全池 PASS 53 / BORDERLINE 0 / FAIL 0；`tests/unit/bar-fit-review-input.test.ts`「30 张（A3 26 ＋ A9-R6 3 ＋ A9-R7 1）一律 UNREVIEWED / reviewed=false」；`tests/unit/retired-truth-archive.test.ts` 及 `docs/qa/BUGS-A9-CLOSEOUT.md` 退役回运行时探针 2 failed 后还原；`pnpm build:fixed-manifest` Formal 53、快照外 ID 0。 | 已有证据、待 QA 回填 |
| AC-05 | 旧 350 题原文和三处 `1.5.0` 保持原样，当前主线不请求 AI 题。UF-4 | 比对 SSOT 冻结哈希、三处版本，关闭开关下观察生成请求数。 | 是 | `docs/qa/BUGS-A9-CLOSEOUT.md` 红线表：旧 350 `text` diff=0、三处 `1.5.0`；`tests/unit/retired-truth-archive.test.ts` 冻结哈希探针变红后还原；`tests/unit/content-track-gate.test.ts`「AI_MAINLINE_ENABLED 关闭时 refillPackInBackground 仍早返原 deck、不发请求」；Vitest 1453/0。 | 已有证据、待 QA 回填 |
| AC-06 | 玩家不会因 Heat、Mutual 或无效披露误触发关系推进。UF-4 | 核对 `[12,14]`、`MUTUAL_MIN_HEAT=H3`、`HEAT_THRESHOLDS` 与有效轮四项 fail-closed；最终 Mutual HEAT/TIMING 保持待冻结。 | 是 | `tests/unit/v2-mutual-check.test.ts`「③ 12–14 之外不触发：11 与 15 都不是检查点，仅 12/13/14 可达」及「④ 认识阈值全满足且有效卡计数 ∈ [12,14] → 才 due」；`tests/integration/v2-formal-truth-production-chain.test.ts`「④ 当前真实 UI 口径（A5）：roundDisclosureForCurrentRound 恒 undefined ⇒ 无披露生产者，Formal 卡抽到也不计有效轮、Heat 恒 H1」；`docs/qa/BUGS-A9-CLOSEOUT.md` 红线表与 Vitest 1453/0；`lib/v2-relationship/`、`lib/engine/` diff 0。最终 Mutual 不在本次放行范围。 | 已有证据、待 QA 回填 |
| AC-07 | 未审、机器预筛或坏审查输入不能让卡进入正式库，legacy 也不能绕过准入。UF-4 | 分别输入空 review、非法 reviewerKind、仅 metadata 或机器 PASS；Formal 不增加或构建拒绝。 | 是 | `tests/unit/fixed-content-manifest.test.ts`「四条件全中才入 Formal（正例），且 Formal 清单 = 四条件筛选结果」「metadata 字段齐全 ≠ reviewed：已审 metadata ＋ 空人工输入 → reviewed=false、不进 Formal」「fail-closed：整库（含 5 张带齐 metadata 的 TRUTH 卡）＋空/缺审查输入 ⇒ formal = 0 张」「reviewerKind 非法值（\"robot\"）⇒ 构建抛错」；`docs/qa/BUGS-A9-CLOSEOUT.md` 非法身份与空 input 探针均 exit 1、已还原；Vitest 1453/0。 | 已有证据、待 QA 回填 |
| AC-08 | 卡片的精确语义标签使玩家看到的题意与过滤口径一致。UF-4 | 对照 `256` topic、`262/264` hook、亲密偏好与接触动作的标签。 | 是 | `tests/unit/pack1-replaces.test.ts`「§7.3：256 topic 精确 = 相处规则；254 topic 精确 = 择偶偏好（⛔ 不用 union 放宽）」及「逐卡锁值：题面 / Heat / intensity / planning 字段 / 全部必填质量字段与冻结表一致」；`tests/unit/pack1-physical-contact-scope.test.ts` 身体/亲密卡 5 项专项；`docs/review/SUPERVISOR-A9-CLOSEOUT.md` 亲读 `262/264` 为 `social_style`；Vitest 1453/0。 | 已有证据、待 QA 回填 |
| AC-09 | 规划字段不会混入玩家运行时卡，Host disclosure 仍不产生未获授权的有效披露。UF-4 | 检查 Runtime schema/桥接投影无三字段，真实 UI 披露函数仍恒 `undefined`。 | 是 | `tests/unit/pack1-replaces.test.ts`「gameCardSchema（GameCard 正式 schema）不含 category / followUpHook / expectedAnswerShape」「桥接运行时投影不转发三字段（负向锁保留）；本批卡已进运行时卡池 / manifest 两轨，且逐张满足准入四条件」；`tests/integration/v2-formal-truth-production-chain.test.ts`「④ 当前真实 UI 口径（A5）」；Vitest 1453/0；`app/`、`components/`、`styles/` diff 0。 | 已有证据、待 QA 回填 |
| AC-10 | 测试可在非 3000 端口运行，退出确认仍回到正确页面。UF-2 | 设置 `PLAYWRIGHT_BASE_URL`，检查 baseURL/webServer/dev 端口同源并实跑 E2E。 | 是 | commit `013939b`；`tests/unit/e2e-port-config.test.ts`「设置 PLAYWRIGHT_BASE_URL 后三处全部同源派生，端口真传入 dev server（非 3000 免改源码）」及「所有 e2e 源码文件（含 spec 与 helper）都不含写死的 127.0.0.1 / localhost / :3000」；`PLAYWRIGHT_BASE_URL=http://127.0.0.1:3210 npx playwright test` 106 passed / 0 failed / 6 skipped；硬编码篡改探针 1 failed 后还原。 | 已有证据、待 QA 回填 |
| AC-11 | 相同固定内容输入能重复生成相同的玩家卡源和审计结果。UF-4 | 连续构建比较哈希，并复核结构报告重刷结果。 | 是 | `docs/review/SUPERVISOR-A9-CLOSEOUT.md`：两次 `pnpm build:fixed-manifest` 同 SHA-256 `e4b5d4c21e3f9b6b6f609a6bdc4d186c4892bd169647b6a5b4e74dcb661b5185`；443/443、0 mismatch、快照外 ID 0；`docs/qa/content-audit/PACK1-SKELETON-CLUSTER.{md,json}`、`FORMAL-TRUTH-STRUCTURE.{md,json}` 与大交接 4 的两次重刷 hash 一致记录；`tests/unit/fixed-content-manifest.test.ts`「重复构建 + 输入乱序 → 两轨同一 snapshotHash；复算一致」。 | 已有证据、待 QA 回填 |
| AC-12 | 审查记录如实呈现机器 SUSPECT 与人工 PASS 的不同结论，A2 三分类可对账。UF-4 | 逐卡重算机器分组 note，并核 A2 分类总数。 | 否 | `tests/unit/bar-fit-review-input.test.ts`「真产物 truthFirstPack note 由实测派生：非 0 非 PASS 时点名卡号与档位、不写「全部 PASS」」；`docs/qa/BUGS-A9-CLOSEOUT.md` note 矛盾探针 3 failed 后还原；`docs/qa/content-audit/PACK1-A2-ADJUDICATION.md` KEEP 5 / REWRITE 5 / REPLACE 21。 | 已有证据、待 QA 回填 |
| AC-13 | 本版验收口径与技术、内容审查事实相符，用户不会收到虚假的发布完成结论。UF-1/UF-4 | 对照内容主审、Code Review、QA、Supervisor 结论及账本。 | 否 | `docs/review/RESEARCH_REVIEW-PACK1-FINAL-53.md` 53/0/0；`docs/review/CODE_REVIEW-A9-CLOSEOUT.md` `PASS_WITH_NOTES`、P0=0/P1=0；`docs/qa/BUGS-A9-CLOSEOUT.md` 技术 `PASS_WITH_ISSUES`、6 skipped；`docs/review/SUPERVISOR-A9-CLOSEOUT.md` 治理性 FAIL 唯一原因为本 AC 缺失；`node scripts/model/check-ledger.mjs` 为 `LEDGER-OK`。 | 已有证据、待 QA 回填 |

**关键 AC 集合**：`AC-01` 至 `AC-11`。表格行数与状态不得手填作放行值；复算命令（在仓根运行）：`awk '/^\| AC-[0-9][0-9] \|/{all++; if ($0 ~ /\| 是 \|/) key++; if ($0 ~ /已有证据、待 QA 回填/) pending++} END {printf "AC=%d key=%d pending=%d other=%d\n",all,key,pending,all-pending}' docs/pm/PRODUCT_PLAN_V2.3-AC-ITERATION.md`。本版关键集合非空，但 QA 未回填前不得把 `pending` 解释为已放行。

### 2.1 本版不覆盖

| 编号 | 不覆盖范围与理由 |
|---|---|
| NC-01 | 桌面视口与窄屏双端视觉走查：A9 `app/`、`components/`、`styles/` 零改动，视觉/交互呈现未变更；现有 E2E 覆盖 Pixel 7 的 390×844 移动视口，**桌面视口本版未覆盖**。桌面与窄屏完整视觉边界样本、真实截图留给未来含 UI 变更的版本；不把已有静态 spec 当本次走查。 |
| NC-02 | 真人局与 `RG-01～RG-07`：`RG-02=HOLD_BY_CONTENT_01`、`RC=RC_NEEDS_REFREEZE`，本版不 Release、不部署；原 Release Gate 7/7 不变。 |
| NC-03 | `BAR-FIT v2` 未实现；是既有登记项，不算本版交付。 |
| NC-04 | `229` 的「说说…那次」咨询句式瑕疵已由主审判 PASS 可容忍，登记不修。 |
| NC-05 | `follow_up_hook` 真值 9、余量 0，以及「选谁」骨架 `251→257→273→276→279→280→281` 收敛风险：均为主审登记项，本版不退卡、不设新门槛。 |
| NC-06 | 父版本尚待后续阶段兑现的其他 DoD（含完整玩法冻结、20/25 轮 MC 与最终 Mutual HEAT/TIMING 冻结）继续保持原 Gate；本次 AC 不把它们包装为已验收。 |

## 3. 产品验收追踪矩阵落位

本版 AC 的实测证据应落在 `docs/qa/BUGS-A9-CLOSEOUT.md` 的「产品验收追踪矩阵」节，沿用 `docs/qa/BUGS.template.md` 同名节格式，由 **QA 复核并回填** AC 编号、证据、状态及未覆盖项。Planner 只写本 Plan，不改 `docs/qa/**`。`docs/model/GOVERNANCE-STATE.json` 的 `product_acceptance_ac_added` 由编排者在 QA 通过后置 `true`；在此之前治理性 FAIL 保持，不报完工。

## 4. Human Gate 与后续恢复

Human 已于 2026-09-30 明确批准：「让 planner 按 Controlled Reopen / Change C，只补最小产品验收信息」。本版据此成为新 `DEV_BASELINE`，无需再次等 Human Gate。当前题库内容工作**到此暂停**：不扩题、不改题、不原创题、不启动第二包、不做新的内容治理工程；等待 Human 从外部搜集并筛选新题库。

**恢复前置条件与默认执行口径**：Human 提供已从外部搜集并筛选的新题库后，默认视为 Human 已筛选的可用内容，不再走复杂的二次内容生产流程；只做必要的技术入库与回归验证。技术入库仍须遵守本文件全部红线和父版约束，逐卡过 `pnpm build:fixed-manifest` 的准入四条件及 fail-closed 校验，随后回归 `npx vitest run --testTimeout=30000` 和 E2E。未提供外部题库前不启动任何内容施工；入库验证不等于自动重冻 RC 或部署。
