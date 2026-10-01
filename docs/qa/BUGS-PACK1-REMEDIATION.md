# BUGS｜第一包整改四单 QA（reviewerKind / 骨架脚本 / Heat 重标 / MC 双口径）

- 日期：2026-09-29
- 基线：`HEAD=614a3ea`（未 commit / 未 push）
- 范围：只验证工作区中 CR-4 PASS 的整改；本 QA 仅新增本报告。
- **QA_RESULT=PASS**（无 P0、无 blocking P1、无红线破坏）。

> ⚠️（2026-09-29 neat-freak 收尾注，未改写本 QA 结论）本 QA 针对的第一包整改已随 `c61f7d4` 提交并 push `main`；原文「未 commit / 未 push」（:4 / :58）为该时点事实，保留留痕。

## 门禁实测

| 项 | 复现命令 | 实际输出 | 判定 |
|---|---|---|---|
| TypeScript | `npx tsc --noEmit` | exit 0，无输出 | PASS |
| lint | `pnpm lint` | exit 0；`✖ 11 problems (0 errors, 11 warnings)`。11 条 warning 均位于未改动的旧文件，未见本轮新增 warning | PASS |
| Vitest | `npx vitest run --testTimeout=30000` | `Test Files 121 passed (121)`；`Tests 1186 passed (1186)`；exit 0 | PASS |
| Playwright | 先运行 `lsof -nP -iTCP:3000 -sTCP:LISTEN`，无输出、exit 1（无监听进程）；再运行 `npx playwright test` | `6 skipped`；`106 passed (1.1m)`；无失败 | PASS（skip 不计 PASS） |
| Production build | `pnpm build` | `✓ Compiled successfully`；静态页 `21/21` 生成；exit 0 | PASS |
| Fixed manifest | `pnpm build:fixed-manifest` | legacy 414（主线374+扩圈40）；audited 24 / legacy 390；reviewed=true 24；`reviewerKind=ai-role`；formal 24；canonical 对账 414、一致414、不一致0；快照外 ID 0；两次构建及复算 hash 一致 | PASS |
| Ledger | `node scripts/model/check-ledger.mjs` | `LEDGER-OK` | PASS |

### Playwright 跳过项（逐项列出）

| 用例 | 跳过原因（测试实际标注） |
|---|---|
| `已访问的当前 Session 可在完全离线后重载恢复`（`production-offline.spec.ts`） | 仅 production build 运行；本轮使用 `next dev`。 |
| `PWA cache：版本化 cache + 旧 cache 清理 + 规则库离线 + AI 接口与密钥不进缓存`（`pwa-cache-regression.spec.ts`） | 仅 production build，需真实 Service Worker。 |
| `旧 cache + 新 bundle：版本错位后 Session 仍能恢复`（`pwa-schema-upgrade.spec.ts`） | 仅 production build，需真实 Service Worker。 |
| `V2正向：audited metadata → 弹 Mutual → 双选成 MATCH（DEFERRED_BY_HUMAN，本批不做）`（`v2-mutual-flow.spec.ts`） | `DEFERRED_BY_HUMAN`：本批冻结不做正向 UI E2E。 |
| `PWA reload：Service Worker 接管后，切新玩法并转瓶子，落点与当前玩法一并恢复`（`v1-1-recovery.spec.ts`） | 仅 production build 运行，需真实 Service Worker。 |
| `二选一：AI 启用但断网时回退本地 seed，出题与换题都不卡`（`would-you-rather.spec.ts`） | 只在 `AI_MAINLINE_ENABLED=true` 时单独运行；本轮开关关闭。 |

## 专项实测

### reviewerKind 与骨架脚本

1. `pnpm build:fixed-manifest` 实际产物 `buildInfo.reviewerKind=ai-role`；审查输入 `docs/qa/content-audit-v2/BAR-FIT-HUMAN-REVIEW.json` 的 `reviewerKind` 也为 `ai-role`。输入文件 SHA-256 为 `ce9394d3d155f1b11be6c07ad46ec4aeceae2177872b4b21fea73c26bb6c6fb4`。生成值与输入一致，非硬编码。
2. 负向探针：临时删去输入 `reviewerKind`，运行 `pnpm build:fixed-manifest` 得 exit 1，输出：`独立审查输入缺少合法的 reviewerKind ... 得到 undefined ...（fail-closed：不得缺损、不得默认 human）`。再将值改为 `robot`，exit 1，输出同样拒绝非法值：`得到 "robot"，必须为 "human" 或 "ai-role"`。两次探针后均恢复输入及产物；输入/产物 SHA-256 分别恢复为 `ce9394d3d155f1b11be6c07ad46ec4aeceae2177872b4b21fea73c26bb6c6fb4` / `2a862c5396c0037eebcf38ad8693397f0245f43448656271bc796b19ed857f57`。
3. 空审查探针：临时将 `entries={}` 后重建，exit 0，真实输出 `reviewed=true: 0`、`reviewerKind=ai-role`、`formal fixed: 0 张`。随后恢复原输入与产物。
4. 骨架脚本隔离输出实测：`npx vite-node -c vitest.config.ts scripts/audit-bar-fit-human-review-skeleton.ts --out=<临时文件>`，exit 0；`entries=24`，`UNREVIEWED=24`、`PASS/BORDERLINE/FAIL=0`、`reviewed=true=0`，`reviewerKind=ai-role`；独立读取产物确认 24 条全部 `humanBarFit=UNREVIEWED && reviewed=false`。临时输出已删除，真实审查输入未覆盖。
5. 扫描 `真实人工审查|真人审查|真实人工|人工审查完成`：当前运行时代码中保留的命中是带“历史冻结时状态，原样保留”标注的冻结文本，以及骨架脚本里“真人审查重跑时显式传 `--reviewer-kind=human`”的未来操作指引。历史 review / handoff 文件另有旧状态原文，详见 P2-1；当前实现中的 `reviewed=true` 语义和 `reviewerKind` 已明确分开。

### Heat 逐卡真实性与内容不变性

6. `npx vitest run --testTimeout=30000 tests/unit/formal-truth-heat-labels.test.ts`（本轮全量 Vitest 中已包含）逐卡核验 24/24 对齐 `temp/HEAT-REVIEW-PACK1.md` 更正表；`PN-TRUTH-205=2/2`；`heatMin<=heatMax` 24/24。分布：min H1=3/H2=9/H3=10/H4=2；max H2=1/H3=4/H4=19。
7. 同测试以去掉 `heatMin` / `heatMax` 后的整卡 SHA-256 指纹核验 24/24，覆盖 `text` 及其余 metadata；并以“修改 text 或其它字段使指纹变化”的探针自证检测有效。`formal-truth-pack.ts` 相对整改前的变动中，卡数据字段变更仅为 Heat 值；其余变化为说明文档注释。Heat 表唯一来源是 reviewer 逐卡表及测试中逐卡转录的期望值。
8. 搜索 MC 与整改建议：报告明示“不得用压低 heatMin 解决”，提出新增真实浅关系题；没有将 MC 指标作为下调现有 Heat 的依据。`git diff --quiet -- lib/v2-content/generated/v2-ssot.generated.json` 返回 exit 0（`SSOT_DIFF_EXIT=0`），390 张 SSOT 零修改。

### 双口径及口径 B 探针

9. 报告 `FORMAL-TRUTH-MC.md` 分为口径 A（Engine / explicit disclosure）和口径 B（Current real UI）；`FORMAL-TRUTH-MC.json` 的 mode A/B 定义分开。UI 函数 `roundDisclosureForCurrentRound()` 当前恒 `return undefined`。
10. 口径 B 当前 UI 可抽 Formal 清单为 `PN-TRUTH-201/202/203`，与报告列出的三张一致；报告明确 Heat 恒 H1、中途 Mutual 不可达。
11. 口径 A 冷启缺口如实记录：H1 桶可计数 Formal 仅 3 张，小于 H2 阈值 4；因此从 H1 冷启无法到 H2，4000 局中 H2/H3/H4 到达数均为 0。此已知产品缺口按任务要求登记，不作为本 QA FAIL。
12. B 门禁篡改探针：临时把 `roundDisclosureForCurrentRound()` 改成 `return roundDisclosureSignal({ selfDisclosed: true, disclosedPlayerIds: ["probe-player"] });`，运行 `npx vitest run --testTimeout=30000 tests/integration/v2-formal-truth-production-chain.test.ts`，真实结果 `PROBE_EXIT=1`、`Tests 1 failed | 3 passed (4)`；失败断言为“当前 UI 的披露生产者必须恒返回 undefined”。探针前后 `app/game/page.tsx` SHA-256 均为 `4c5853d94930b3e476024b4f470fb664e2efefbb527b17fb909f4eda927fd20a`，源码已恢复。

### 红线及运行边界

13. `package.json`、`public/sw.js` 的 `CACHE_VERSION`、`public/version.json` 实测均为 `1.5.0`；三个文件相对 HEAD 无 diff。当前进程 `AI_MAINLINE_ENABLED=<unset>`，`enabled=false`。冻结运行时文件无 diff：认识阈值（中及以上≥5、高≥1、人物维度≥3、两名合法候选披露）、窗口 `[12,14]`、中途 `MUTUAL_MIN_HEAT=H3`、D6 与 `isEffectiveInformationRound` fail-closed 均未改；没有新增 Host disclosure UI，`app/game/page.tsx` 无 diff，披露函数仍恒 undefined。
14. E2E 收尾后检查时 `next-env.d.ts` 曾显示为修改状态；随后 `pnpm build` 执行后该文件对 HEAD 无 diff（`git diff --quiet HEAD -- next-env.d.ts` exit 0）。未手动回滚。
15. `git rev-parse --short HEAD` 输出 `614a3ea`；未 commit、未 push。

## Findings

| Bug ID | Priority | Stage P0 Blocking? | Repro | Status | Current Task | 备注 |
|---|---|---:|---|---|---|---|
| QA6-P2-1 | P2 | 否 | `rg -n '真实人工审查|真人审查|真实人工|人工审查完成' docs`；真实命中包含 `RESEARCH_REVIEW-FORMAL-TRUTH-PACK-1.md:32` 的“产物文案仍写真实人工审查”及 `HANDOFF.md:60` 的“reviewed=true 口径冲突” | OPEN | PACK1 QA | 命中位于历史 review / handoff 文档，记录当时的旧冲突和旧准入描述；文档整体有历史语境，但并非每个命中都就地标注为历史。期望：读者不会将旧口径当作当前规则；实际：全仓搜索仍命中。影响：治理资料理解成本。建议归属：task-manager / neat-freak 后续整理历史标注，不动本次边界内文件。 |
| QA6-P3-1 | P3 | 否 | `pnpm lint` | OPEN | PACK1 QA | 0 errors、11 warnings，全部来自本轮未改文件。期望无新增 warning；实际未发现本轮新增，仓库仍有 11 条存量 warning。影响 lint 噪声。建议归属：对应脚本/测试文件 owner 后续清理。 |
| QA6-P3-2 | P3 | 否 | `npx playwright test` | OPEN | PACK1 QA | 106 passed、6 skipped；6 项及原因见上表，均由当前环境（dev 非 production）或本批明确 deferred 条件触发。期望：生产专用 E2E 在 production smoke 任务补跑；实际：本次不运行这些场景。影响：production Service Worker 专项未由本次 E2E 覆盖。建议归属：后续 production smoke QA。 |

## 总判定

**PASS**。七项门禁全部通过；reviewerKind fail-closed、空输入 formal=0、骨架不代写结论、Heat 24/24 对表、非 Heat 字段指纹、MC 双口径以及口径 B 篡改探针均符合预期。发现项只有 P2/P3，未触发任务定义的 FAIL 条件。未构建 APK、未部署、未 bump、未用真机，未改业务代码或其它文档/账本。
