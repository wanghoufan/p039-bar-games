# BUGS｜QA-7 第二包前置整改 + Truth H1 Bootstrap 全链门禁与专项实测

- 日期：2026-09-29
- 基线：`HEAD=c61f7d4`；开始时工作树已有 builder/reviewer 未提交改动，本报告针对该工作树实测。
- 范围：只读核验与测试；本报告是本次唯一新建交付文件。
- 总判定：**PASS**（P0=0、blocking P1=0、红线破坏=0）。已知冻结状态“当前 UI 不推进 Heat”按任务说明不判 FAIL。

> ⚠️（2026-09-29 neat-freak 收尾注，未改写本 QA 结论）本 QA 针对的工作树改动已随 `730c025`（Truth H1 Bootstrap）提交并 push `main`；原文「无 commit/push；HEAD 仍 c61f7d4」（:4 / :59）为该时点事实，保留留痕。

## 门禁结果

| 门禁 | 复现命令 | 实际结果 |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | exit 0，无诊断输出。 |
| Lint | `pnpm lint` | exit 0，0 errors、11 warnings；warning 仅位于未改动文件：`scripts/audit-aggregate-v2-350.ts`×2、`scripts/audit-report-v2-350.ts`×2、`scripts/decision/orca-decide.mjs`×4、`scripts/decision/run-shadow.mjs`×2、`tests/phone/dump-state.ts`×1。本轮改动文件无 lint warning。 |
| Vitest | `npx vitest run --testTimeout=30000` | `Test Files 125 passed (125)`；`Tests 1254 passed (1254)`；exit 0。 |
| Playwright | `npx playwright test` | `106 passed`、`6 skipped`，exit 0。运行前 `lsof -nP -iTCP:3000 -sTCP:LISTEN` 显示 PID 63779 正在监听；未 kill，Playwright 按配置复用现有 server。skip 逐条如下。 |
| Next build | `pnpm build` | Next.js 16.3.3 webpack build 成功；TypeScript、21 个静态页生成与 trace 完成，exit 0。 |
| Fixed manifest | `pnpm build:fixed-manifest` | `legacy=421`；`audited=31 / reviewed=31 / formal=31`；`reviewerKind=ai-role`；固定库快照外 ID=0；逐卡对账 421/421、一致 421、不一致 0；hash 两次构建一致（legacy=true、formal=true）。 |
| Ledger | `node scripts/model/check-ledger.mjs` | `LEDGER-OK`，exit 0。 |

### Playwright 跳过用例（均未计作 PASS）

| 用例名 | 原因 |
|---|---|
| `已访问的当前 Session 可在完全离线后重载恢复` | 仅 production build 执行；本次是 dev server，需真实 Service Worker。 |
| `PWA cache：版本化 cache + 旧 cache 清理 + 规则库离线 + AI 接口与密钥不进缓存` | 仅 production build 执行；需要真实 Service Worker。 |
| `旧 cache + 新 bundle：版本错位后 Session 仍能恢复` | 仅 production build 执行；需要真实 Service Worker。 |
| `V2正向：audited metadata → 弹 Mutual → 双选成 MATCH（DEFERRED_BY_HUMAN，本批不做）` | Human 冻结本批 deferred；源码注明不得写成 PASS。 |
| `PWA reload：Service Worker 接管后，切新玩法并转瓶子，落点与当前玩法一并恢复` | 仅 production build 执行；本轮未启动 production PWA smoke。 |
| `二选一：AI 启用但断网时回退本地 seed，出题与换题都不卡` | 仅 `AI_MAINLINE_ENABLED=true` 专测；默认关闭状态下按用例门控跳过。 |

## 专项实测

### 审查输入与产物

- Bootstrap 7 条逐条对照审查输入 `docs/qa/content-audit-v2/BAR-FIT-HUMAN-REVIEW.json` 与 reviewer 落盘件 `temp/REVIEW-BOOTSTRAP-7.md`、`temp/REVIEW-BOOTSTRAP-7-RECHECK.md`：225/227/229/231 为第一轮 PASS 且复判维持；226/228/230 为第二轮由 BORDERLINE 升 PASS。7 条均 `reviewed=true`、`humanBarFit=PASS`。逐条 note 要点对应审查件：225 爱好与上头瞬间具体钩子；226 补“为什么”及目标一致；227 topic 改合法枚举“兴趣爱好”；228 补“你认吗”并将 heatMax 4→3；229 具体试过的经历；230 改为具体规矩及来历并将 heatMax 3→2；231 日常仪式的具体追问且保留唯一诚实的 heatMax=4。审查输入汇总明确写明机器档位仅作分流参考，未作为 humanBarFit 依据；构建产物 `reviewerKind=ai-role`。
- 第一包 24 条 `(id, reviewed, humanBarFit, note)` 指纹独立复算：`git show HEAD:docs/qa/content-audit-v2/BAR-FIT-HUMAN-REVIEW.json` 与当前审查输入均为 `84846ed120f3fadd8257dd9d071b406527b714e13b764125fff4772f9d17e202`，与冻结指纹相同。复现：
  `git show HEAD:docs/qa/content-audit-v2/BAR-FIT-HUMAN-REVIEW.json > /tmp/qa-bootstrap-old-review.json`，再按 `bar-fit-review-input.ts#reviewEntriesFingerprintInput` 对 201–224 条目排序后 sha256；结果 HEAD 与当前相同。
- 空输入探针：临时将 review 输入置为合法空 `entries:{}`，执行 `pnpm build:fixed-manifest`，真实输出 `reviewed=true: 0`、`formal fixed: 0 张`、`固定库快照外 ID 数: 0`、对账 421/421 且不一致 0、`hash 可复现: 是`。随后恢复 review 输入和 manifest 原文件。
- 机器 `machineVerdict` 未被当成 `humanBarFit`：输入汇总逐字说明独立定档依据来自 reviewer；build 输出注明“机器阶段恒 UNREVIEWED，非 FAIL”，并将“独立审查输入”作为 reviewed 唯一来源；空输入探针得到 formal=0。

### Heat 冷启动与真实性

- `PN-TRUTH-205` 实际 metadata 为 `heatMin=1 / heatMax=3`，与 `temp/HEAT-REVIEW-205.md` 建议 2→1、2→3 一致；reviewer 指明本轮仅改 Heat 字段，题面措辞建议未执行。
- Bootstrap 225–231 的 `heatMin` 全为 1；`heatMax` 分布：2 张为 H2（226、230），4 张为 H3（225、227、228、229），1 张为 H4（231），并非全 4。与 reviewer 复判逐卡分布一致。
- 从 MC 产物 `h1Formal` 读得 Formal H1 清单共 11 张：`201, 202, 203, 205, 225, 226, 227, 228, 229, 230, 231`。H2 门槛为 4，余量 7。
- 冷启动归因按两部分分别核算：205 单独把第一包 H1 从 3 补至 4，刚好门槛、余量 0；Bootstrap 新增 7 张后（不计 205）是 3+7=10，余量 6；合并为 11，余量 7。因此主力来自 7 张新卡，未发现为了 MC 压低 heatMin 的证据。旧 350 题 SSOT `text`：`git diff -- lib/v2-content/generated/v2-ssot.generated.json` 为空（exit 0）。

### 报告真实性与双口径

- `FORMAL-TRUTH-PRODUCTION-CHAIN.json` 当前 Formal-only 实测：20 轮，首达 H1/H2/H3/H4 = 1/4/8/13，终态 H4、effective=20；Bootstrap-only：7 轮、终态 H2、effective=7。其 note 均与 `rounds`、库存、阈值、`firstReachRoundByHeat` 相符。
- 篡改探针：备份后给 `scenarioFormalOnly.note` 追加 `QA_TAMPER_PROBE`，运行 `pnpm exec vitest run --testTimeout=30000 tests/unit/formal-truth-production-chain-note.test.ts`，结果 `7 tests | 1 failed`，失败点为“④复算闸门”，报“note 与按实测数据复算的结果不一致（疑似手写/手改）”。恢复后文件 SHA-256 前后相同：`bfeeb0d5c157681cb16099436abd08e1723ee0636c7a5d4a5ac41020f26ad1fd`。
- 已检索当前生产链/MC 报告，没有旧的“Formal 24 / H1=3 / H1→H2 缺口 1”结论。MC 的 Bootstrap-only 子集确实仍记录“H3 缺口 1”（7 张 < H3 门槛 8），这是该 7 张子集实测的更高档缺口，不是冷启动 H1→H2 的旧数据；不可删改成假数据。
- 双口径严格分离（MC 文件内部称 modeB=显式 disclosure、modeA=当前无披露 UI）：显式 disclosure 的 Engine 口径 H2 reach 为 1011/4000（25.3%），effective/session=2.04；Current UI 口径 effective/session=0、Heat H1=93443 次、H2/H3/H4 抽取 0、mid Mutual=0。已知 UI 尚不推进 Heat，按本任务约定不判 FAIL。

### 红线

- `package.json`、`public/sw.js`、`public/version.json` 三处版本均为 `1.5.0`；AI_MAINLINE_ENABLED 在当前进程环境未设置，`.env.local` 无该键；源码只认精确值 `true` 才开启。
- 关系门槛涉及文件相对 HEAD 无 diff：认识阈值仍为 medium+ 5 轮、high 1 轮、人物主题 3、披露候选 2；窗口 `[12,14]`；中途 `MUTUAL_MIN_HEAT=H3`；六项中途互选门仍包含窗口/剩余轮数/单局一次/最小间隔/Heat≥H3/未放弃。`isEffectiveInformationRound` 仍 fail-closed（必须 completed、自披露、非 zero/low、有 topic、有 disclosedPlayerIds）；`roundDisclosureForCurrentRound()` 仍恒 `undefined`。`git diff --quiet -- lib/engine lib/v2-relationship app/game/page.tsx` exit 0。
- 无 commit/push；HEAD 仍 `c61f7d4`。
- E2E 后 `next-env.d.ts` 曾被 Next 自动改写为 `.next/dev/types` 引用；随后 `pnpm build` 又由 Next 自动改回 HEAD 中的 `.next/types` 引用。未手动回滚；最终 `git diff -- next-env.d.ts` 为空、`git status --short next-env.d.ts` 无输出。

## 缺陷与观察项

| Bug ID | Priority | Stage P0 Blocking? | Repro | Status | Current Task | 备注（截图/日志一句） |
|---|---|---:|---|---|---|---|
| OBS-QA7-01 | P3 | 否 | `pnpm lint` | 已知观察 | 保持 lint warning 可见，不扩展本次范围 | exit 0、0 errors、11 warnings；全部位于本轮未改文件。 |

- 期望 vs 实际：期望本轮无新增 lint warning；实际 11 条均在未改文件，未发现本轮新增 warning。
- 影响面：既有维护噪音，不影响本任务准入或测试结果。
- 建议归属：后续触及对应脚本/测试时由 builder 清理；本轮不改代码。
