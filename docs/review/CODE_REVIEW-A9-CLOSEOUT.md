# CODE REVIEW｜A9 收尾（A2~A9 酒吧主线内容重构三链复检·Reviewer 环节）

- Task: A9 admission 收口 ＋ R6/R7 内容裁决 ＋ R8 记录层修正 ＋ E2E 端口治本 —— 收尾代码审查（只审不改）
- Commit: 工作树未提交改动（HEAD `0a879ed`；审查对象为本轮 67 项工作树改动 ＋ 14 份新增未跟踪文件）
  （2026-09-30 收尾注：该审查对象为提交前 71 项内容改动，现已落于 `6cac2a2` / `013939b` 并 push main。）
- Reviewer: code-reviewer（codebuddy/glm-5.3-flash，独立 Session）
- Result: **PASS_WITH_NOTES**（P0=0 / P1=0 / P2=1 / P3=3；无阻塞项）

> Dispatch / Evidence ID 系字段 2.0 已废弃，不填。
> 审查纪律自证：本单未改任何业务代码、未改任何测试断言、未 commit / push；审查过程中重跑过
> `build:fixed-manifest`（2 次）与 3 个审计脚本，见 §6「审查者动作披露」。
> （2026-09-30 收尾注：提交动作由编排者执行，本句记录的是本单执行当时的纪律；成果现已于 2026-09-30 提交。）

## P0 / P1 Findings

- **无 P0、无 P1。**

### 4.1 26 红测分类真实性（最高优先）—— 判定成立

- 逐条核对 `temp/A9-FAIL-CLASSIFICATION.md`：25 条 STALE 判定均有「A9 合法新真源」证据（manifest 443/53、
  运行时 403＋桥接、审查输入 active PASS ⇄ Formal 逐 id 相等），且与现行代码实况一致；未发现
  「真回归被误判 stale」。
- **唯一 REAL_REGRESSION（R1）复核属实**：改前 `v2-card-quality-index.ts` 的 `ssotRawCards()` 只并
  `mainline + expansion + FORMAL_TRUTH_CARDS + BOOTSTRAP`，漏 A9 的 52 张 ⇒ 生产链唯一取 meta 处
  `lib/engine/v2-deal.ts:436` 对新 Formal 卡读双 `null` ⇒ 永不计有效轮。**修法验证**：现版
  `lib/v2-content/v2-card-quality-index.ts:47,117-128` 并入 `PACK1_ADMISSION_RUNTIME_CARDS`，与桥接
  `v2-card-bridge.ts:33,256,286,331` 用**同一份运行期投影**（同一 import 源，非第二份卡源/真源）；
  旧 SSOT 卡仍走 `projectFromSsot()` 投影双 `null`（`v2-card-quality-index.ts:91-101`），「未补标＝不计数」
  的 fail-closed 语义未破坏。ID 各号段不重叠、Map 按 cardId 去重无覆盖风险。
- 无「FAIL 一律当 stale」痕迹：分类表对 REAL_REGRESSION 各子类（retired 回流 / unreviewed 进 Formal /
  审查身份漂移 / ID 冲突 / 旧 350 / fail-closed 削弱）逐项给了排查结论，本审查抽验其中
  retired 回流（归档零 lib import）、fail-closed（`lib/engine` diff=0 行）、旧 350（SSOT json 零改动）均属实。

### 4.2 派生断言（非换一套硬编码）—— 成立

- 全量 vitest 实测 **137 文件 / 1453 用例 / 0 failed**（本审查亲跑，非转抄）；对 8 个重点改动测试文件
  grep `57/53/443/407/84/95` 数字字面量：除 TIE_FIXTURE 结构性桶容量（见 P2-1）外**零命中**。
- 抽验派生实现：`formal-truth-heat-labels.test.ts:265-281` `H1_REACHABLE_FORMAL` 由内容源
  `heatMin<=1<=heatMax` 派生；`formal-truth-mc-report-derivation.test.ts:210-220` 终态档位由
  `firstReachRoundByHeat` 派生（非写死 H4/20）；`fixed-content-manifest.test.ts` 的
  `FORMAL_SOURCE_IDS`/`expectedPass` 与审查输入逐 id 双向 fail-closed；`pack1-admission-prep.test.ts:114-123`
  import 锁收紧为「仅 `pack1-admission.ts` 一处」。「换一个真源数字会自动跟随」标准成立。
- 唯一写死数字 `TIE_FIXTURE.expectedBucketSize=94` 属结构性桶容量，内联注释给出探针实算依据
  （SSOT I1–I4 80 ＋ KEEP 5 ＋ Bootstrap ＋ 重构批 I≤4，两 Router 同值）——符合「写死必须有算式」口径，
  但同文件长注释段仍写旧值 95，见 P2-1。

### 4.3 负向门禁（红线）—— 全部在位，未削弱

- 旧 350 题 text 零修改：`git diff -- lib/v2-content/v2-ssot.generated.json` 为空；SSOT 字节 sha256 断言绿。
- 退役卡（A3 26 张 ＋ R6 `236/263/277` ＋ R7 `249`）不回运行时卡源：4 个卡源文件正文仅注释留痕、无卡定义；
  `grep -rn "import .*archive" lib/` **零命中**（归档不被任何 lib 运行时 import）；重跑 manifest 构建后
  两轨 `allowedCardIds` 均无 4 张（`total 443/53`、逐卡 provenance 同步移除）。
- 空 review input ⇒ Formal=0、`reviewed` 不由 metadata 自动产生、`reviewerKind` fail-closed：
  `fixed-content-manifest.test.ts`（:507-536 双身份重建互校）绿。
- manifest card set ⇄ runtime 内容源一致：`fixed-content-manifest.ts:61` 运行期直接 import 产物 JSON，
  等值断言全绿（这也是 4.6 可复现性的强门）。
- Heat metadata 诚实 / `isEffectiveInformationRound` 四项 / `[12,14]` / `MUTUAL_MIN_HEAT=H3` /
  `HEAT_THRESHOLDS`：`git diff lib/engine` **0 行改动**。
- ⛔ **特别查（golden-12 / pack1 从「不进 Formal」改「已进 Formal」）**：负向 planning-only 锁**未删未弱、反而加强**
  ——`golden-12.test.ts:362-391` 三用例锁 `gameCardSchema.shape` / `V2_REQUIRED_QUALITY_FIELDS` /
  桥接两个运行时投影（对**全部**卡逐卡 `not.toHaveProperty`，自动覆盖新进 Formal 的整批卡）；
  `pack1-admission.ts:105-120` `PACK1_PLANNING_ONLY_FIELDS` 在运行期投影里显式剥除。
  `PLANNING_ONLY_FIELDS` 未进 Runtime/GameCard 正式 schema 与桥接投影 ✓。

### 4.4 内容裁决代码正确性 —— 成立

- 退役 4 张真实移出运行时内容源（非只改 review input）；归档 `retired-pack1-r6/r7-2026-09-29.ts` 逐字快照
  含 planning 三字段与全部 metadata，`payloadHash` / `retiredAt` / `retireReason` / `adjudicationSource` /
  `reviewConclusionPointer`（指向 review input history，不复制结论）齐全；原审查结论 PASS 冻结在
  `reviewHistoryOutcome`。审查输入侧活跃 entry 置 UNREVIEWED/reviewed=false，history 逐字保留。
- `scripts/audit-card-id-space.ts:47-52` 号段口径已跟上：R6 3 张 ＋ R7 1 张并入退役段（与 A3 26 张同列
  collision 域），并 fail-closed 锁「退役卡不在运行时源、不在 Formal」。
- 5 张改写（`203/241/252/262/266`）metadata 与新题面同源：`RESEARCH_REVIEW-PACK1-FINAL-53.md` §1 逐卡
  「metadata 同源」列全部 ✓；指纹冻结表对 `241/252/262/266` 同步更新（`pack1-admission.ts:185-192` 例外条款
  记录在案）；`203` 活跃 note 已随新题面重写（history 旧结论未删），manifest provenance 的 payloadHash 与
  machineVerdict（PASS→SUSPECT）随重刷同步。无旧题面残留（262 兑现句 `not.toContain("哭")` 有断言）。
- `256` topic **精确** `toBe("相处规则")`（`pack1-replaces.test.ts:831-835`，⛔ 注释明写「不用 union 放宽」）✓。
- `262/264` `followUpHook=social_style` 锁住：卡源 `pack1-replace-cards.ts:536,579`（264 实读
  `category=quick_know / followUpHook=social_style`），源码注释明写「⛔ 不改回 attraction」，无「哭点/气」残留 ✓。
- exact `physical-contact`：新增 `tests/unit/pack1-physical-contact-scope.test.ts` **正反两面锁**——
  ①5 张偏好卡（242/243/267/268/269）在 planning 聚合视图与运行时 App 投影两处都不得挂 exact 标签；
  ②动作型注册表（现为空）正向锁「动作卡必须挂」；③桥接映射正向（`physical-contact` 映 App 开关、
  `proximity` 映 null）。`241` 改写后未滑向「要求接触」（题面零动作要求＋skip-anytime＋FINAL-53 专项 2 确认）。
  `267/269` 的 `private-individual`＋`proximity` override 在 `pack1-admission.ts:87-100` 落地并有专测 ✓。

### 4.5 口径类纪律 —— 成立

- `follow_up_hook` 9＝诊断基线非放行门：`pack1-supplements.test.ts:681-703` 显式断言
  `"follow_up_hook" in PACK1_UNION_CATEGORY_REQUIREMENTS === false`（退出 requirement 表），
  真值 9 只作诊断输出；`PACK1-SKELETON-CLUSTER.md` 明写「只出诊断：⛔ 不因『选谁』多而推翻这些卡」。
  未发现「余量为 0 所以 PASS」式追现状结论。
- 覆盖率只按 `category` 真值：同文件 :705-720 独立 re-count 对账 ＋「真值之和＝卡数」反证 ＋
  「重叠口径与真值口径必须不同」断言；「category 或 hook」重叠口径仅存于防回归注释，无现役使用。
- `203` 双层分记：机器 `SUSPECT`（`BR-DEVICE-STEP`）如实入账（`BAR-FIT-AUDIT.json` rows 可查、
  `packMachineVerdictSummary` SUSPECT=1），人工 `humanBarFit=PASS` 独立维持，FINAL-53 专项 3 明确判误报
  并说明「机器档位未当人工结论用、人工结论也未掩盖机器命中」。
- `group-note-consistent` 真能红：`bar-fit-review-input.test.ts:396-419` 两个篡改探针
  （①改「全部 PASS」掩盖 SUSPECT=1；②非 PASS 卡号不点名）均实测断言 violations 命中 `group-note-consistent`；
  产物 note 由 `deriveMachineVerdictNoteFragment()` 从逐卡实测派生（`bar-fit-review-input.ts:189-196`）。
- 双口径分章：`FORMAL-TRUTH-MC.md:11-13,106-117` 口径 A（Engine/显式 disclosure）与口径 B
  （当前真实 UI `roundDisclosureForCurrentRound()` 恒 undefined ⇒ effective=0、Heat 恒 H1、mid Mutual 不可达）
  分章＋显式「⛔ 禁止把 A 当 B」条款；未发现「生产 Heat 已正常推进」表述。
- 旧口径数字无现役残留：MC/production-chain 产物 `formalTotal=53`；「（A3 KEEP 5）」仅作括注说明而非现役值
  （见 P3-2 措辞建议）；`395/355/407/Formal 57` 未作为现役值出现在三份新报告。

### 4.6 产物可复现性 —— 成立（本审查实跑复现）

- `pnpm build:fixed-manifest` 重跑 **2 次，sha256 完全一致**（`e4b5d4c21e3f9b6b6…`），输出与构建前工作树
  状态同源（运行期 `fixed-content-manifest.ts:61` 直接 import 该 JSON，全部等值门禁在其上通过）；
  对账 0 mismatch、快照外 ID 0（脚本内置 fail-closed）。
- 3 份新审计产物重跑复现：`audit-pack1-a2-adjudication.ts` / `audit-formal-truth-skeleton-cluster.ts` /
  `audit-formal-truth-structure.ts` 各自重跑 exit 0、产物 hash 前后一致
  （`af262951…` / `5668c7ae…` / `bbbf8983…`）。
- `PACK1-A2-ADJUDICATION.md` 汇总由脚本 `rows.reduce` 逐卡算出（脚本 :339-375 明写「⛔ 不得手填」＋
  内置 fail-closed 断言），复跑输出 `KEEP 5 / REWRITE 5 / REPLACE 21 ＝ 31` 与文内算式一致；
  无「同一张卡进两档」笔误（改判集 `202/225` 显式、逐卡行 31 行）。
- A2 原件 `temp/BAR-AUDIT-PACK1-31.md` 在盘（50,769 字节，2026-09-29 13:57），未改写；
  裁决附录只引用不改原件。
- `PACK1-SKELETON-CLUSTER` 判定规则**可复算可审计**：全部是显式正则词表/planning 字段判据
  （§1 规则表逐条列出，含「谁都＝任指不算」「词表刻意排除高频歧义词」等边界说明），
  ⛔ 无黑箱相似度；报告注明「确定性：无时间戳/无随机量」。
- MC 产物可复现性由 `formal-truth-mc-report-derivation.test.ts` 独立复算对账（绿）兜底。

### 4.7 E2E 端口治本 —— 成立（本审查实跑验证）

- `playwright.config.ts:10-15`：无 `PLAYWRIGHT_BASE_URL` 时默认 `http://127.0.0.1:3000`（行为不变）；
  设置后 `use.baseURL` / `webServer.url` / `next dev -p <port>` 三处由同一变量派生（单一真源）；
  缺显式端口 fail-fast（不静默回落）。
- `tests/e2e/helpers/exit-guard-shared.ts` 的 `expectAtHomeRoot()`：`^origin/$` **两端全锚定**，
  严格强于旧的后缀锚定正则 `/127\.0\.0\.1:3000\/$/`（旧写法「任意前缀＋正确结尾」也匹配）；
  错误 origin（含换端口后）与错误 path 均会红——断言强度等价偏强，未弱化。
- 守护单测 `tests/unit/e2e-port-config.test.ts` 真能红：锁默认 3000、三处同源、端口真传 `-p`、
  fail-fast，及「tests/e2e/** 全目录禁硬编码 127.0.0.1 / localhost / :3000」扫描。
- **本审查在 3217 端口实跑 E2E：106 passed / 0 failed / 6 skipped**（与报称完全一致）。
- `playwright-report/`、`test-results/` 已在 `.gitignore`（第 7-8 行）；E2E 实跑后 `git status` 无新增
  未跟踪垃圾；未改 `.gitignore`。

### 4.8 治理与纪律 —— 成立

- 14 份 `*.旧版-2026-09-29` 预存备份：`git -c core.quotepath=false status --short` 自证全部 `??`（未跟踪），
  无 `A`/`M` 状态、未被删改；无新增误入库。
- `temp/` 仍被 `.gitignore` 覆盖（第 25 行）。
- `229` 的「说说…那次」咨询句式瑕疵：`temp/A9-R7-FIX-REPORT.md` §3 明写「已知瑕疵登记（不修）」，
  题面未被静默改掉——如实登记 ✓。
- 报告/MC note/summary 派生化：见 4.5；未发现硬编码结论。

## P2 / P3 Backlog Findings

- **P2-1｜`tests/unit/v2-router-fair-exposure.test.ts` 夹具长注释与常量值自相矛盾（95 vs 94）**
  - 位置：`tests/unit/v2-router-fair-exposure.test.ts:97-104`（长注释段）vs `:112` 附近常量。
  - 问题：注释段仍写「桶容量实算 …＝ **95 张**」「写死 **95** 时以上面探针实算为准」，而常量
    `expectedBucketSize: 94` 的内联注释已按 A9-R6/R7 退役更正为 94（R6/R7 各退 1 张 H1·I≤4 真心话卡）。
    同一文件两处数字矛盾，正是本项目「note 与实测矛盾」纪律所禁的形态（虽仅注释、不影响断言与门禁）。
  - 建议改法：把注释段的「95」改为 94 并补一句「A9-R6/R7 退役后由探针复算 95→94」（或直接让注释段
    引用常量值），下一单顺手改，不阻塞本单。
- **P3-1｜归档文件头「唯一合法消费者」清单与实际不符（偏严）**
  - 位置：`lib/v2-content/archive/retired-pack1-r6-2026-09-29.ts:17-18`（r7 同）。
  - 问题：文头写「唯一合法消费者是测试与只读号段扫描脚本」，但 `scripts/audit-bar-fit-human-review-extend.ts`
    与 `scripts/audit-pack1-a2-adjudication.ts`（均为**写产物**的审计/裁决脚本）也 import 了
    `RETIRED_PACK1_R6/R7_CARD_IDS`（仅 ID 常量，作 note 文案与号段域，不含卡内容进运行时）。
    硬约束本体（⛔ 运行时路径：lib/**、app/**、MC/生产链）未被违反。
  - 建议改法：把文头合法消费者清单补上「审计/裁决脚本（仅 import ID 常量）」，或在两脚本改从
    `audit-card-id-space` 取退役段，消除文面与实际的偏差。
- **P3-2｜`FORMAL-TRUTH-MC.md:136` 等处「Formal 53 张（A3 KEEP 5）」括注易误读**
  - 问题：括注「（A3 KEEP 5）」紧跟「Formal 53 张」，快速阅读可能误读为「Formal＝KEEP 5」（旧口径）。
    `readingGuide` 有澄清，不构成事实错误。
  - 建议改法：下一单重刷时把括注改为「（其中含 A3 KEEP 5）」一类无歧义表述。
- **P3-3｜`FROZEN-FINGERPRINTS` 冻结表已不含退役 4 张，但表内无退役留痕指针**
  - 位置：`lib/v2-content/pack1-admission.ts:193-244`。
  - 问题：236/263/277/249 条目已删（正确），留痕在表外 `:185-191` 例外注释与归档文件里；将来读表者
    若不看注释，无法从表本身看出「曾有 4 张被删」。
  - 建议改法（可选）：在 `FROZEN-FINGERPRINTS:BEGIN/END` 边界外加一行注释列出 4 个退役 ID 与归档指针。
    纯文档性，不影响指纹校验。

## 审查者动作披露（本单对工作树的影响）

1. 重跑 `pnpm build:fixed-manifest` 2 次：输出 sha256 两次一致（`e4b5d4c2…`），与重跑前工作树内容同源
   （该 JSON 被运行期 import 且全部等值门禁依赖它，重跑前必为 443/53 新版）；未引入内容变化。
2. 重跑 3 个审计脚本（A2 裁决 / 骨架簇 / 结构）：产物 hash 前后一致，零内容变化。
3. 以 `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3217` 实跑 E2E（106 passed），产物目录均已被 gitignore。
4. 未改任何业务代码 / 测试断言 / 阈值 / docs 原文；未 commit / push；临时文件仅 `temp/`（实际未新增）。
   （2026-09-30 收尾注：提交动作由编排者执行，本句记录的是本单执行当时的纪律；成果现已于 2026-09-30 提交。）

## 结论

**PASS_WITH_NOTES**：A9 收口的 26 红测分类真实（唯一真回归修法正确且单源）、派生断言到位、
负向门禁全在位且 planning-only 锁加强、内容裁决（退役 4＋改写 5）代码与记录层一致、口径纪律
（hook 9 诊断基线 / category 真值 / 双层分记 / A·B 双口径）成立、generated 产物实测可复现
（2 次构建同 hash）、E2E 端口治本实测通过（3217 端口 106 passed）。遗留 1 条 P2（注释旧数字 95）
＋3 条 P3（文档措辞），均不阻塞，交编排者安排下一单顺手处理。
