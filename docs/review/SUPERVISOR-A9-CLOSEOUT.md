# SUPERVISOR｜A9 收尾复检结论（致编排者）

- 落位说明：按派工书 §5 首选方案，新建本汇总文件留痕；**未改任何既有文件**（业务/测试/文档均未碰），未 commit/push。被检文件评论区未另写（QA 与 CR 报告均已冻结落盘，追加评论即改既有文件；本汇总为唯一新增）。
  （2026-09-30 收尾注：本句记录的是本单执行当时状态；成果现已于 2026-09-30 落于 `6cac2a2` / `013939b` 并 push main。）
- 复检身份：supervisor（opencode-go/muse-spark-1.3-contributor，opencode 通道）。只对编排者说话。
- 读盘顺序：AGENTS.md → docs/roles/supervisor.md → USER_MODEL_OVERRIDE.md → HANDOFF「大交接 3」§0~§5 → 经验一句话.md → BUGS-A9-CLOSEOUT.md（两轮） → CODE_REVIEW-A9-CLOSEOUT.md → RESEARCH_REVIEW-PACK1-FINAL-54/53 → 派工书 §4。
- 结论档位：**FAIL（治理性 FAIL：产品验收阻断；内容与技术面全绿）**。与 QA 首轮 FAIL 口径一致，不放水。
- 是否可进入 commit：**建议可以 commit，但必须由人类明确下指令（含分支名），且 commit message 如实注明「产品验收未闭环（product_acceptance_ac_added=false），整体不得报完工」**。commit ≠ 完工。

## 4.1 技术面：属实，全绿（亲跑证据）

- `0 failed` 属实：亲跑 `npx vitest run --testTimeout=30000` → **137 files / 1453 passed / 0 failed**（16s）。
- manifest 可复现：亲跑 `pnpm build:fixed-manifest` 两次 → 同 hash `e4b5d4c21e3f9b6b6f609a6bdc4d186c4892bd169647b6a5b4e74dcb661b5185`（与重跑前磁盘值逐字节一致，本人未引入变化；与 Code Reviewer 报告值一致）。门禁输出：相比 443 / 不一致 0 / 快照外 ID 0 / 两次构建一致。内 hash legacy `e4fffc31…` / formal `d911d0b8…` 与 QA 报告一致。
- 三者同一套（亲算，不信报告）：review input 活跃 `reviewed=true & humanBarFit=PASS` 53 张 **逐 id == manifest formalFixed 53 张**（双向差集均为空）；运行时等值由亲跑全绿 vitest 内 `card-source-consistency` + `fixed-content-manifest` 等值断言覆盖。Formal 53 ID 表亲读：无 236/249/263/277，无 A3 26 张。
- 退役卡隔离：A3 26 张 + 本轮 4 张（236/249/263/277）**均不在 formal、不在 legacy（443）、不在运行时卡源**；4 张在卡源仅注释残留、无卡定义；`lib/` 内 `import.*archive` 零命中。A4a 漏洞未复发。
- 绕行项重点查结论：**未掩盖真实漂移，但机制残留风险记 NOTE**。证据：①漂移（203 机器 PASS→SUSPECT）是批准漂移（FINAL-54 处方改写题面含"刷手机"字眼→规则字面命中）；②旧 manifest 备份在 `temp/A9-R7-manifest-stale-backup.json`（亲验存在：OLD 444/prov、formal 54、203=PASS）；③新 provenance 如实记 203=SUSPECT（非 PASS），249 已从 formal **和** provenance 双除；④本人重跑后门禁 `相比443/不一致0` 绿。残留风险：脚本"无既有产物跳过"路径仍在，后续复用须每次备份+裁决指针（本次已做到）。另 `tsc` 亲跑 exit 0；`pnpm lint` 亲跑 0 error / 12 warning（既有基线）；E2E 未亲跑（角色卡：抽查只看矩阵与证据不重跑QA；QA round1 `temp/qa-a9/e2e.log` + CR 3217 端口实跑双证据 106/0/6 一致）。

## 4.2 产品面：抽查成立（非只看测试绿）

- 酒吧基线未回退：题面亲 grep 退出词（五年后/长期关系/上一段关系/前任/分手/各占几成/哪三段/心理咨询/原生家庭）**题面零命中**；可疑卡（261 现状/259 边界/254 即时感觉/250 今晚决策）FINAL-54 已逐条语义裁决，抽查无异议。
- 弱卡未保送：277（四无后勤题）、249（与 250 同轴三弱）、236/263（重复）退役判据成立；专项复核"无复活理由"同意。
- 重复已清：235 留 / 236 退、278 留 / 263 退、250 留 / 249 退，三组判据成立。
- hook 不虚标：`category=follow_up_hook` 全库亲算 **9 处** = 272/273/274/275/276/278/279/280/281（逐卡归属亲验），与 FINAL-54 一致；239/253/257/264/270/271 维持保守（抽验 264 卡面 `social_style` ✓）；hook 已降诊断基线（`pack1-supplements.test.ts` 退出 requirement 断言在亲跑全绿内）。
- consent：242/243/267/268/269 无 exact `physical-contact`（全库仅 1 处注释提及）；267/269 的 `private-individual`+`proximity` override 在 `pack1-admission.ts:87-96` 落地（亲验），卡源字面量保持原样、单真源不两处存放。卡面"偏好 ≠ 授权"注释 + skip-anytime 三层俱全。
- 203 两层分记：provenance 机器 SUSPECT + review input 人工 PASS + 活跃 note 已随新题面重写（亲验），互不掩盖；FINAL-53 误报理由（答案选项内容、口头作答）成立。
- 256 topic 精确 `相处规则`（亲读卡面 :301）、262/264 `social_style`（亲读 :536/:579），注释署名链完整。

## 4.3 治理面：成立为主，3 个 NOTE（不打回）

- TM 未写业务代码：成立。TASK 账本 TM 行全为 HANDOFF/skill/同步/CORRECTION 类（TM 位置文件）；业务卡面注释署名均为 builder 通道工作痕迹（A6/A7/A8/A9-R6/R7/R8），生成产物由脚本重刷（R8 报告 + 两次 hash 存证）。
- 备用记账：两账互验一致。R7 返工/R8/端口治本三单 TASK 与 DISPATCH 均记 `model=备用glm / requested=deepseek-flash / 429至2026-09-30 21:58`，与事实一致。NOTE：DISPATCH `used=备用` 共 5 行（含历史 C1-4/R3 两行先例），按角色卡字面"used 恒填主"算偏离，但按"如实记账+历史惯例"算合规透明；**不打回、不许重写账本**，建议治理明确备用记法（透明优先）。
- 双真源闭环：A2 原件 `temp/BAR-AUDIT-PACK1-31.md` 在盘（50,769 字节，mtime 2026-09-29 13:57，未改写，temp 未入库）；ADJUDICATION 最终 KEEP 5 / REWRITE 5 / REPLACE 21（5+5+21=31 自洽；改判 202/225 明示；原 7/19 vs 执行 5/21 闭环）。
- `check-ledger` 亲跑 `LEDGER-OK（含 WARN）`；WARN 均为历史行（精确 ID/未闭环提醒），A9 新行无新增 WARN；TASK 第二道亲跑 bad=0。
- 14 份备份：`git -c core.quotepath=false status --short | grep 旧版` = 14 行全 `??`，`git ls-files` 零跟踪，未删未改 ✓。`temp/` 被 .gitignore 覆盖（:25），`git ls-files temp` 为空 ✓。
- 返工计数：**本 supervisor session 打回 0 次**（首检）；Code Reviewer 为 PASS_WITH_NOTES（P2×1/P3×3，notes 非打回）；A9 账本行 rework 全 0；HANDOFF 无 supervisor 打回记录。**无同一 Task 累计 2 次情形，无需升级 senior-expert。**
- P2/P3 清完亲验：P2-1 注释已订正（95 段作废/常量 94）、P3-1 归档头已补消费者清单、P3-2 括注已改"其中含 A3 KEEP 保留的 5 张"、P3-3 退役指针在 admission :14/:19/:185/:188。229 瑕疵题面亲验未动（bootstrap :96 仍"说说…那次"），登记不修属实。

## 4.4 未闭环项（如实登记，不淡化；另有本检新增 NOTE 3 条）

1. 产品验收阻断（维持）：`product_acceptance_ac_added` 仍 `false`（亲读）；实绩 Plan 缺 AC 编号+关键 AC 集合+发布类型；QA 判关键 AC 未测。依母版红线**不得报完工**，需人类拍板（是否 Change C），编排者已上呈。
2. 未 commit：工作树 **52 M + 33 ??（14 备份 + 19 新）= 85 项**，全部未提交。NOTE：编排者上呈"67 项"与实测 71 项内容改动（52M+19新）不符，请订正为 71（差 4 疑为 P2/P3 清完后新增，内容无问题，数字需改）。commit 需人类明确指令。
   （2026-09-30 收尾注：Supervisor 当时实测 71 项内容改动，编排者实测提交为 Commit A 71 files + Commit B 5 files，两个口径分属不同时点，不要混成一个数字；且现已 commit + push。）
3. E2E 6 skip 既有（production 离线/PWA×3/V2 Mutual 延期/AI 回退），非新增，不得计 PASS。
4. 229 瑕疵登记不修（亲验题面未动）。
5. 结构缺口登记不补：Golden H2 3→2（236 退）、REPLACE 轴（263 退）、supplement（277/249 退）。
6. （新增 NOTE）账本缺 3 类行：QA-A9 两轮、CODE_REVIEW-A9、P2/P3 cleanup 单——check 不报坏但行缺，请 TM 追加补记（不重写历史）。
7. （新增 NOTE）`GOVERNANCE-STATE.json` 的 `task_ledger_rows=202` 已过期（实测 TASK 215 行，无 _example 行），收尾请同步。
8. （新增 NOTE）种子壳跳过路径机制残留（见 §4.1），后续复用须备份+裁决指针。

## 心跳

- 目标：A9 收尾 supervisor 复检；剩 P0：产品验收（人类拍板）+ commit（人类指令）；下一步：编排者补账本 3 类行、订正 67→71、上呈人类拍板 commit 与 Change C。

（自证见终端 `ls -l` + `shasum -a 256`。）

---

# SUPERVISOR｜Change C 治理收尾复检结论（2026-09-30，致编排者）

- 复检身份：supervisor（opencode-go/muse-spark-1.3-contributor，opencode 通道）。只对编排者说话。
- 读盘：AGENTS.md → docs/roles/supervisor.md → USER_MODEL_OVERRIDE.md → HANDOFF「大交接 4」→ 经验一句话.md → PRODUCT_PLAN_V2.3-AC-ITERATION.md → BUGS-A9-CLOSEOUT.md（三轮）→ 本文件上一轮结论 → CODE_REVIEW-A9-CLOSEOUT.md → RESEARCH_REVIEW-PACK1-FINAL-53.md → 派工书 §4。
- 本单纪律：**未改任何业务/测试/内容源文件**；唯一写入是本文件本章节（派工书 §5 指定落位）。未 commit/push，未 checkout，未读写本仓外目录。临时文件无新增。
- HEAD 现为 `498ca58`（neat-freak 回填提交，已 push，`origin/main` 0 0）；工作树改动仅 `M BUGS-A9-CLOSEOUT.md`（QA 第三轮追加）＋ `M next-env.d.ts`（E2E 附带改写，见治理 NOTE）＋ `?? V2.3`（planner 新文件）＋ 14 份备份 `??`。

## 分面结论

| 面 | 档位 | 一句话 |
|---|---|---|
| 技术面 | **FAIL（非阻塞性已知 flaky，已登记，不抹记录）** | QA 第三轮全量 1 failed（`ai-mainline-generating-page.test.tsx`）真实发生过；本监督独立复跑全量 2 次 `137/1453/0 failed`＋该单文件 1 次通过。分类为既有负载型 flaky（§4.4），不构成阻止治理收尾的阻塞项，但 FAIL 记录保留。 |
| 产品面 | **PASS** | AC-01~AC-13 全部通过，关键 AC 11/11 均有真实证据（§4.1）。NC-01~06 诚实登记为未覆盖，未包装成通过（§4.3）。 |
| 治理面 | **PASS_WITH_NOTES** | V2.3＋QA 回填闭环成立，`product_acceptance_ac_added` 可置 `true`；NOTES：①next-env.d.ts 待恢复；②planner-V2.3 与 QA 第三轮两账本行待 TM 补记；③STATE 行数当前一致（220/277）。账本 `LEDGER-OK`。 |
| 阶段暂停口径 | **PASS** | V2.3 §4 已写明暂停＋恢复口径（§4.6）。 |

## §4.1 治理性 FAIL 可解除：是（纸面通过零发现）

- AC 可执行可对账：AC=13、关键=11（复算 `AC=13 key=11 pending=13`），关键集合非空；V2.3 表中 `pending`＝planner 侧“待 QA 回填”状态，QA 已在 BUGS 第三轮矩阵逐条回填，职责分离正确（planner 未碰 `docs/qa/**`）。
- 证据独立抽验（grep 真实定义，非只读表）：E2E 7 个用例名（spin-bottle×2、game-flow、exit-confirm×2、pack-switching×2）全部存在；unit 侧 `30张UNREVIEWED`（bar-fit:228）、`12–14之外不触发`＋`认识阈值全满足`（mutual:738/856）、`恒undefined`（production-chain:279）、`metadata≠reviewed`＋`formal=0`＋`robot抛错`（manifest:418/428/479）、`256精确相处规则`（replaces:831）、`gameCardSchema不含三字段`＋`桥接不转发`（replaces:661/670 等三文件）、`端口真传入dev server`＋`禁硬编码`（port-config:63/79）、`重复构建+乱序同hash`（manifest:542）、`note由实测派生`（bar-fit:423）、`关闭时不发请求`（content-track-gate:206）——**11 条关键 AC 引用的用例名全部真实存在**，与编排者抽验一致。
- QA 回填逐条对上 AC 编号：BUGS 第三轮矩阵 AC-01~AC-13 行、NC-01~06 行、红线 12 项行齐全；L1 11 条 / L2 2 条（AC-12/13 静态复核，符合“按要求不重跑”）；无“AC 表待回填、矩阵没填”的空洞。
- **判定：上一轮“治理性 FAIL：产品验收阻断”解除条件已满足。**

## §4.2 未借 Change C 扩大范围：成立

- 父版 `PRODUCT_PLAN_V2.2-FIXED-CONTENT-FIRST.md` 对 HEAD 零 diff（`git diff --name-only HEAD` 无命中），最后改动仍为 `57f5be3`。**一字未改** ✓。
- V2.3 §0 声明“唯一差异是版本号＋§AC 表达；未新增功能、未扩大范围、未改变任何产品要求”，§0.1 对 Heat/Mutual/[12,14]/H3/Router/准入四条件/UI/旧350/三处版本/AI开关/RC逐项声明未改并给出核对方式；正文无任何新功能、新阈值、新机制语句。**无夹带** ✓。
- `RELEASE_TYPE=ITERATION_UPDATE` 后果表述正确：不强制用户签收，但“关键 AC 未测／控件未实际点击／证据缺失仍不得报完工”保留 ✓。

## §4.3 NC 诚实：成立

- NC-01 依据成立：`git diff --name-only 0a879ed..013939b -- app/ components/ styles/` 输出为空（本监督亲跑），A9 UI 零改动；E2E 仅 Pixel 7 390×844，桌面未覆盖的登记属实。**未包装成已验收** ✓。
- NC-02~NC-06：RG/RC 未动、BAR-FIT v2 未实现、229 登记不修、hook 真值 9 诊断基线、父版其余 DoD 留原 Gate——均与 QA/CR/主审口径一致，无美化 ✓。

## §4.4 技术门禁 flaky 裁决（本单最关键判断）

- 现状（本监督亲跑）：全量第1次 `137 files / 1453 passed / 0 failed`（16.27s）；全量第2次 `1453 passed` 0 failed（16.18s）；单文件 `ai-mainline-generating-page.test.tsx` 1/1 通过。连同编排者 3 次全绿＋QA 定点 31/31，**6 次运行 5 绿 1 flaky 红**。
- 分类：**既有测试的负载型 flaky**。理由：①失败文件最后改动 `8bcef40`（本轮之前），`0a879ed..013939b` 与对 HEAD diff 均 0 命中，与本轮无关；②仅全量并发跑失败一次，单跑／定点／E2E 并发下均通过；③该文件 2 处 `findBy*`、**0 显式 timeout**（默认 1000ms），典型负载敏感异步断言；④失败断言（关闭开关页面标题）与本轮改动（docs/qa＋Plan）无代码路径关联。
- 是否阻塞治理收尾：**否**。Human 指令“只做治理收尾、不新增任务”——修既有 flaky（加 timeout／测试基建）属于新增工程，与指令冲突；但隐瞒不允许。
- 处置：**如实登记为已知 flaky，留待未来含 UI/测试基础设施变更的版本修；本轮不修**。登记内容：文件＋现象（全量并发下偶发 1 failed，`findByRole` 默认超时）＋证据（6 次 5 绿 1 红）＋QA 第三轮 FAIL 记录保留。**FAIL 记录不抹**。
- 另：QA 第三轮 E2E 6 skip 仍为既有条件 skip，不计 PASS，口径延续 ✓。

## §4.5 治理面

- STATE：`task_ledger_rows=220`／`dispatch_ledger_rows=277` 与两账本实测行数一致；`product_acceptance_ac_added=false` 仍为 false——**正确**（V2.3 §3 规定 QA 通过后由编排者置 true，本结论即为通过依据，TM 随后置 true）。
- `node scripts/model/check-ledger.mjs` 亲跑 **`LEDGER-OK`（含既有 WARN 4 条历史行）** ✓。
- TM 未写业务代码：成立。工作树 `M BUGS-A9`＝QA 职责、`?? V2.3`＝planner 职责；编排者仅 HANDOFF/账本/STATE（本次 STATE 的 true 位待写）。
- **NOTE①**：`M next-env.d.ts` 是 E2E 附带改写（`.next/types`→`.next/dev/types`，2 行自动生成 churn），QA 报告称已回拷但现仍 drift。非业务改动，但 **commit 前须由 TM 用 temp 备份回拷恢复（禁 `git checkout --`，见经验 2026-09-30 探针还原条）**。
- **NOTE②**：planner-V2.3 与 QA 第三轮的两账本行尚未落盘（TASK 尾行仍停在上一轮 supervisor 行，DISPATCH 同）——属正常流程（TM 待本结论后补记），列出以防遗漏，不算缺失。
- 14 份备份：`status` 14 行全 `??`、`git ls-files` 0 跟踪，未删未改 ✓；`PRODUCT_PLAN.template.md.旧版` 未入索引 ✓。
- 返工计数：**本监督本轮打回 0 次**；TASK 尾部 8 行 rework 全 0；历史 rework=2 行（ChangeB 终检等）均为旧任务已闭环。**本轮无累计 2 次情形，无需升 senior-expert。**

## §4.6 阶段暂停口径：已如实落 Plan（PASS）

- V2.3 §4（L71）：到此暂停、不扩题不改题不原创题、不启动第二包、不做新内容治理工程、等 Human 外部输入 ✓。
- V2.3 §4（L73）：外部题库默认视为 Human 已筛选可用内容、不走复杂二次生产流程、只做必要技术入库＋回归；仍守全部红线＋父版约束、逐卡过准入四条件＋fail-closed、回归 vitest＋E2E；入库≠自动重冻 RC/部署 ✓。

## 三选一裁决：② 治理性 FAIL 解除，但带 1 条登记项

- **治理性 FAIL（产品验收阻断）解除**；`product_acceptance_ac_added` 可置 `true`（由编排者执行）。
- **登记项（§4.4 flaky）**：`tests/unit/ai-mainline-generating-page.test.tsx` 全量并发下偶发 1 failed（`findByRole` 默认 1000ms、无显式 timeout；文件自 `8bcef40` 未动，与本轮无关）；6 次运行 5 绿 1 红；QA 第三轮技术门禁 FAIL 记录保留；修法（加显式 timeout／测试基建）留待未来含 UI/测试变更版本，本轮不修（Human 不新增任务指令）。
- 本阶段治理收尾可收尾；待办仅 NOTE①（next-env.d.ts 回拷）＋NOTE②（两账本补 2 类行＋STATE 置 true）＋ commit/push（需人类明确指令，含分支名）。

## 心跳

- 目标：Change C 治理收尾 supervisor 复检；剩 P0：无（治理阻断解除）；下一步：编排者回拷 next-env.d.ts→补账本→STATE 置 true→携本结论上呈人类要 commit 指令。

（自证见本单终端 `ls -l` + `shasum -a 256`。）
