# QA｜Mutual「每人一次点击」返工独立验证

- 日期：2026-09-27
- 验证方式：独立静态审查 + 本地门禁；未连接真机。
- 范围：MutualCheckSheet、v2-mutual-check、互选 E2E/unit，以及本轮返工后的 `tests/phone/party-run.ts`。工作树中其他未提交改动保持原状。

## 门禁

| 项目 | 结论 | 实际输出 |
|---|---|---|
| `npx tsc --noEmit` | PASS | exit 0；无输出。 |
| `pnpm lint` | PASS | `$ eslint .`；`✖ 11 problems (0 errors, 11 warnings)`，均为 warning；命令 exit 0。warning 文件为 `scripts/audit-aggregate-v2-350.ts`、`scripts/audit-report-v2-350.ts`、`scripts/decision/orca-decide.mjs`、`scripts/decision/run-shadow.mjs`、`tests/phone/dump-state.ts`。 |
| `pnpm test` | PASS | `Test Files 103 passed (103)`；`Tests 947 passed (947)`；exit 0。其中 `tests/unit/v2-privacy-regression.test.ts` 9/9、`tests/unit/mutual-check-sheet.test.tsx` 15 项、`tests/unit/v2-mutual-check.test.ts` 34 项通过。 |
| `npx playwright test tests/e2e/v2-mutual-flow.spec.ts` | PASS | `✓ ... V2私密互选全流程：9轮→检查点→互选成MATCH→继续游戏`；`1 passed (14.0s)`；exit 0。 |

## 隐私红线

| 检查项 | 结论 | 证据 / 说明 |
|---|---|---|
| 仅双向互选才 MATCH，单向不公开 | PASS | `finalizeMutualCheckRun` 只将 `mutualResult(pairRun).match === true` 的 pair 放入公开 matches；单向选择不进入公开结果。Unit 保留「只公布双方互选」及「无人互选不公开参与者」断言；E2E 断言落盘仅一条预期 MATCH。 |
| active MATCH ≤ 2 | PASS | finalize 前调用 `mayCreateMatch`；实际 reducer 对完成事件再检查上限。符合 D5 双层约束。 |
| 单向选择纯内存，无持久化/URL/日志出口 | PASS | 组件 import 仅 React、Portal、Button、Icon、`v2-mutual-check` 及关系类型；逐项 grep `localStorage/sessionStorage/indexedDB/console./fetch(/document.cookie/history./URL(` 无命中。互选控制模块仅依赖内存关系逻辑及 `createId`，无存储模块。 |
| 无「上一步」；离开 SELECT 后状态清空 | PASS | 组件无上一步控件。`completePerson` 先清空候选快照，再提交并转交接遮罩；下一位由参与者最新引用重新生成候选。遮罩零按钮，unit 检查无旧选中 class、答案不回显。 |
| 提交前使用最新 participants 复验合法边 | PASS | `submitChoice` 先用 `mutualPairRunExists` 检查 pair 在 run 快照中，再由 `legalCandidates` 基于最新 `participantsRef.current` 验边；失败停留原屏并显示提示。 |
| 隐式静默降级的选择不会送进 `submitMutualChoice` | PASS | 新 pair 若不存在于 run 建立时的 `pairRuns`，`mutualPairRunExists` 返回 false；UI 直接提示并 return。`tests/unit/v2-mutual-check.test.ts` 覆盖快照已有 pair、方向互换、新增 pair 和自选；组件测试覆盖目标在提交前失效。 |
| `tests/unit/v2-privacy-regression.test.ts` | PASS | 全量 `pnpm test` 输出该文件 9/9 通过。 |

## 真机 harness 静态验证

| 检查项 | 结论 | 证据 / 说明 |
|---|---|---|
| 不再查找/点击旧 7 步按钮 | PASS（静态） | `party-run.ts` 的互选驱动函数内没有以「已交给 TA」「是，继续」「我准备好了」「已遮好」作为 selector 或 click 的语句。四个短语只出现在说明旧流程已移除的注释中；若按全文字面 grep 会命中该注释，不是驱动行为。 |
| 判定顺序与每人一次点击 | PASS（静态） | `playMutualRound` 等待 dialog，再按 SELECT 提示行 `handoffNote(name)` 从剩余名单认出当前玩家；`playOnePerson` 验证提示后分流：有目标先识别单候选「愿意」并校验标题姓名，否则点目标昵称；无目标点「暂时没有」或零候选「跳过」。点击后立即返回，不额外驱动确认步骤。 |
| onSelect / onAfterPick 截图钩子不阻塞状态流 | PASS（静态） | `onSelect` 仅在选择控件可见时点击前 await；`onAfterPick` 仅在成功选择后 await 截交接遮罩，然后返回。钩子没有额外按钮交互或等待下一位的循环依赖；下一位由外层轮询等待自动推进。 |
| 真机实际运行 | NOT RUN | 本次无法连接真机。不得将静态检查描述为真机通过；需要下次 RG-01 真机走局验证。 |

## 回归真实性与边界

| 检查项 | 结论 | 证据 / 说明 |
|---|---|---|
| 每人一次点击 | PASS | unit 单/多候选点一次即进遮罩，无「提交」按钮；E2E 与 harness helper 点选后立即 return。 |
| 不回显答案 | PASS | Unit 点选「小D」后断言遮罩不显示「小D」且零按钮；E2E 检查公开结果而不显示单向答案。 |
| 下一位从自己的 SELECT 起步 | PASS | Unit 推进定时器后断言下一位提示及其全新合法候选，无上一位选中态；phone harness 按提示识人。 |
| 提交前复验 | PASS | Unit 覆盖目标暂离后的拒绝；单测覆盖 run 快照中没有新 pair 的拒绝条件。 |
| 只公布互选 | PASS | Unit 覆盖成功互选、无人互选及 payload；互选控制器仅生成双向 match。 |
| 删除断言是否削弱回归 | PASS | `git diff` 中删除的旧 UI 用例围绕已删除的点名/身份确认/准备/提交/遮罩确认步骤；新的测试以单次点击、自动遮罩、隐私和最终公开结果覆盖新状态机。未发现为过测删除互选或隐私结果断言。 |
| SSOT、题面、版本 | PASS（范围检查） | 本轮 5 个目标文件 diff/status 未涉及 SSOT 或题库文件；可见版本三处均为 `1.5.0`：`package.json`、`public/sw.js` 的 `CACHE_VERSION`、`public/version.json`。工作树里另有独立的 content-audit 产物，属于本任务排除范围，未审改。 |
| Phase A.2 排除文件 | PASS（Mutual 变更边界） | 互选目标文件差异不涉及 `v2-router`、`v2-session`、`v2-deal`、`session-engine`。当前工作树这些文件确有其他未提交改动；本 QA 未读取、验证或修改其内容，不能把全工作树描述为“未触碰”。 |
| 临时改动 / commit / push | PASS | QA 未做临时代码改动，无需还原；未执行 commit 或 push。 |

## 总体结论

Mutual「每人一次点击」改造及 code-review 指出的真机 harness 返工，通过本地静态验证、TypeScript、lint、全量单测和指定 E2E。隐私红线与本轮 P1 修复的 pair-run 快照门禁通过。真机流程尚未实测，保留到下次 RG-01；不得将其记为真机 PASS。

### 遗留清单

1. 下次 RG-01 连接真机，实际跑互选检查点并确认交接遮罩自动推进、两类截图钩子完成、结果与预期一致。
2. lint 目前有 11 个 warning、0 error；均不在本次 Mutual 目标代码中。
3. 工作树含其他未提交改动（包含任务明确排除的文件），提交前应由编排者按各自工作流拆分核对。

**这 4 个 Mutual 代码/测试文件是否可以单独 commit 收口：可以，基于本次验证结论可以单独收口；`tests/phone/party-run.ts` 返工也已纳入验证，但仍需后续真机 RG-01 验证。** 本次没有执行 commit。

## 每轮末三行心跳

- 目标：独立验证 Mutual 每人一次点击改造及 harness 返工，写本 QA 报告。
- 剩 P0：0。
- 下一步：下次 RG-01 完成真机走局验证；本轮报告已写，未改代码、未 commit/push。
