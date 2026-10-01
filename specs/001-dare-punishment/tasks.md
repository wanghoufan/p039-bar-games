# Party Night 大冒险惩罚工具｜TASK V1.1

- 文档角色：Implementation Tasks
- 拟落盘路径：`specs/001-dare-punishment/tasks.md`
- 输入：Constitution V1.1 / SPEC V1.1 / PLAN V1.1
- 任务格式：`- [ ] T### [P?] [US#] 描述 + 明确文件路径`
- 总策略：**复制原项目后连续开发；旧功能先保留；新模式独立增量实现**

## Phase 1｜Setup：确认复制基线，不破坏旧功能

- [x] T001 读取原 Party Night `git status`、最近稳定提交和当前未跟踪内容，列出复制基线；不得 reset/delete 未确认文件。
- [ ] T002 Human/开发者复制原项目到新的工作目录/仓库，并建立 baseline commit；保留原仓可回退。
- [x] T003 在复制项目中确认现有 `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm build` 基线结果并留档。
- [ ] T004 [P] 若复制版尚未初始化 Spec Kit：先确保基线可审查，再按官方 Existing Project 流程初始化；若已初始化则不重复强制初始化。然后建立 `specs/001-dare-punishment/`，落盘 V1.1 constitution/spec/plan/tasks；Constitution 放 `.specify/memory/constitution.md`。
- [x] T005 明确本轮兼容边界：旧 `app/game`、旧 game packs、Truth/Heat/Mutual/MATCH/AI 逻辑**不删除、不重写**。
- [x] T006 [P] 将已确认的深色主页面/计时三联图放入 `docs/ui/punishment-mode/` 作为视觉参考，并在 SPEC/PLAN 标注文字规则优先级。

**Checkpoint**：复制项目可正常启动；旧功能仍在；新 feature 文档就位。

---

## Phase 2｜Foundational：新模式独立骨架

- [x] T007 [P] 新建 `app/punishment/page.tsx`，作为新模式入口/首次偏好页。
- [x] T008 [P] 新建 `app/punishment/play/page.tsx`，作为新模式主游戏页；不得依赖旧 `GameSession` 才能进入。
- [x] T009 [P] 新建 `lib/punishment/schema.ts`，定义 `ChallengeCard`、Preferences、Session schema。
- [x] T010 [P] 新建 `content/punishment/challenges.ts`，先放最小 Human/测试样本，后续可整体替换正式题库。
- [x] T011 新建 `lib/punishment/loadChallenges.ts`，启动时校验唯一 ID、level、zh/en、timerSeconds。
- [x] T012 [P] 新建 `lib/punishment/preferences.ts`，保存 language/disabledTags/theme/sound/vibration。
- [x] T013 [P] 新建 `lib/punishment/session.ts`，保存 selectedLevel/currentCardId/order/used IDs。
- [x] T014 新建 `lib/punishment/filter.ts`，实现 any-disabled-tag 排除。
- [x] T015 新建 `lib/punishment/deck.ts`，实现五个 exact-level 独立牌堆、独立进度、洗牌、空池、短期防重复。
- [x] T016 [P] `tests/unit/punishment-schema.test.ts`：坏数据 fail-fast。
- [x] T017 [P] `tests/unit/punishment-deck.test.ts`：4 档永不出 1/2/3/5；切回 2 档继续进度。
- [x] T018 [P] `tests/unit/punishment-filter.test.ts`：多标签任一关闭即排除；空池不突破盾牌。

**Checkpoint**：不用 UI 也能完成 exact-level + shield + next-card。

---

## Phase 3｜US1：入口与首次设置（P1）

- [x] T019 [US1] 在现有首页新增一个直达 `/punishment` 的 `大冒险` 快捷入口；不要新增“惩罚库/惩罚模式”一级分类；旧 `真心话大冒险` 等卡片继续保留。
- [x] T020 [US1] `app/punishment/page.tsx` 实现语言选择：中文 / 中英双语 / English。
- [x] T021 [US1] `app/punishment/page.tsx` 实现盾牌内容开关；显示内容标签，不显示风险等级。
- [x] T022 [US1] 首次保存偏好进入 `/punishment/play`；后续开始可复用上次偏好。
- [x] T023 [P] [US1] `tests/e2e/punishment-entry.spec.ts`：新入口可进入，旧入口仍可进入旧功能。

---

## Phase 4｜US2 + US3：冻结主游戏 UI 与五档/出题（P1）

- [x] T024 [P] [US2] `components/punishment/LevelDots.tsx`：5 个无数字小圆点；当前点仅略亮；无 Toast/升级文字。
- [x] T025 [P] [US2] `components/punishment/ChallengeCard.tsx`：题卡占绝大部分空间；不显示 Logo、玩法标签、Heat、题号、risk metadata。
- [x] T026 [P] [US3] `components/punishment/ActionBar.tsx`：无计时题同排 `下一个 | 换一个`。
- [x] T027 [US2] `app/punishment/play/page.tsx`：点圆点只更新下一次抽题的 selectedLevel，当前题不换。
- [x] T028 [US3] `app/punishment/play/page.tsx`：next/replace 都从当前 exact-level + shield-filtered 本地牌堆取题。
- [x] T029 [US3] CSS/布局：题卡占主视觉，底栏目标≤约10%屏高；不得因按钮换行挤压题卡。
- [x] T030 [P] [US2] `tests/component/punishment-level-dots.test.tsx`：无数字、低调选中。
- [x] T031 [P] [US3] `tests/component/punishment-layout.test.tsx`：360/390/430px 下题卡优先、底栏不换行。
- [x] T032 [P] [US2] `tests/e2e/punishment-level-isolation.spec.ts`：2→4→2，后续严格对应当前档。
- [x] T033 [P] [US3] `tests/e2e/punishment-card-speed.spec.ts`：本地正常环境 next/replace ≤500ms。

---

## Phase 5｜US4：盾牌过滤（P1）

- [x] T034 [P] [US4] `components/punishment/ShieldSheet.tsx`：游戏中浮层修改内容类别，不离开主页面。
- [x] T035 [US4] setup 与 in-game 使用同一 disabledTags/preferences 真源。
- [x] T036 [US4] 修改盾牌不替换 currentCard；下一张开始应用。
- [x] T037 [P] [US4] `components/punishment/EmptyPoolState.tsx`：精确文案 `暂无可用`；动作 `切换其他`、`调整盾牌`。
- [x] T038 [P] [US4] `tests/e2e/punishment-shield.spec.ts`：过滤 0 泄漏、当前题保持、空池分支。

---

## Phase 6｜US5：多语言与大字号（P1）

- [x] T039 [P] [US5] `components/punishment/LanguageSheet.tsx`：中文 / 双语 / English。
- [x] T040 [US5] `ChallengeCard.tsx`：双语中英文视觉权重接近，英文不得脚注化。
- [x] T041 [US5] 仅使用有限字号 token 自适应；超过可读阈值时由题库内容审核处理，不无限缩小。
- [x] T042 [US5] 游戏中切语言只更新显示，不改变 currentCardId/selectedLevel/deck progress/timer。
- [x] T043 [P] [US5] `tests/component/punishment-language.test.tsx`：三语言模式大字号和结构。
- [x] T044 [P] [US5] `tests/e2e/punishment-language-switch.spec.ts`：切语言同题同进度。

---

## Phase 7｜US6：题目内计时（P1）

- [x] T045 [US6] 新建 `lib/punishment/timer.ts`，实现 `idle | running | paused` 与 start/pause/resume/end/finish。
- [x] T046 [US6] 使用 `endAt - now` 计算剩余时间，防累计漂移和后台切换误差。
- [x] T047 [P] [US6] `components/punishment/TimerOverlay.tsx`：同一题卡显示大倒计时圆环，题目仍可见。
- [x] T048 [US6] `ActionBar.tsx`：有计时题同排 `下一个 | 换一个 | 开始XX秒`。
- [x] T049 [US6] 点击开始后只允许 300～500ms 视觉过渡，**严禁任何 3→2→1 页面、数字序列或三秒准备态**。
- [x] T050 [US6] running：`暂停 | 结束`；paused：`继续 | 结束`。
- [x] T051 [US6] running/paused 时禁用或隐藏 next/replace，避免计时中换题造成状态歧义。
- [x] T052 [US6] manual end：立即回同一道题 idle，不自动 next。
- [x] T053 [US6] natural finish：本地短音效（若开启）+ 可用时震动 + 短暂 `时间到！`，随后回同题 idle。
- [x] T054 [US6] idle 恢复：`下一个 | 换一个 | 开始XX秒`；**不得新增“再来一次”**。
- [x] T055 [P] [US6] `tests/unit/punishment-timer.test.ts`：start/pause/resume/end/finish/background time jump。
- [x] T056 [P] [US6] `tests/component/punishment-timed-action-bar.test.tsx`：三按钮同排，秒数来自 card.timerSeconds。
- [x] T057 [P] [US6] `tests/e2e/punishment-timer.spec.ts`：DOM/流程不存在 321，start≤500ms，pause/resume/end/finish same-card。

---

## Phase 8｜US7：主题和视觉复用（P2）

- [x] T058 [US7] 复用现有 Party Night theme tokens / NeonBackground / Button / Icon，不重新定义品牌色。
- [x] T059 [US7] `components/punishment/PunishmentSettingsSheet.tsx`：语言、盾牌、音效、震动、system/dark/light、关于/隐私。
- [x] T060 [US7] 深浅色只切 token；不得改变控件数量、布局或状态机。
- [x] T061 [US7] 主游戏页确认无大 Logo；顶部只留设置 + 5 dots + 语言；题卡保持最大化。
- [x] T062 [P] [US7] `tests/e2e/punishment-theme-parity.spec.ts`：三主题同状态同交互。

---

## Phase 9｜US8：离线与本地状态（P2）

- [x] T063 [US8] 核心路径检查：题库、双语、音效资源均本地，不 fetch 远端。
- [x] T064 [US8] sessionStorage 保存本局 selectedLevel/currentCard/order/used IDs。
- [x] T065 [US8] localStorage 保存语言/盾牌/主题/音效/震动。
- [x] T066 [US8] 新局只重置新模式 session，不影响旧 Party Night session/history。
- [x] T067 [P] [US8] `tests/e2e/punishment-offline.spec.ts`：离线完成核心流程。

---

## Phase 10｜正式题库换入

- [ ] T068 Human 提供正式审核题库后替换 `content/punishment/challenges.ts`；不改引擎/API。
- [x] T069 [P] `scripts/validate-punishment-challenges.ts`：检查 ID 唯一、level 1..5、zh/en、timerSeconds、contentTags。
- [x] T070 题库校验不得新增 riskLevel，也不得自动改写 Human 文案。
- [x] T071 [P] 统计每档有效数量与盾牌组合的空池风险，只做报告，不自动混档补题。

---

## Phase 11｜Cross-check / QA / Spec Kit 收口

- [x] T072 运行 `/speckit.analyze` 或等价只读一致性检查；解决 Constitution/SPEC/PLAN/TASK 冲突后再继续。
- [x] T073 [P] 运行旧项目既有核心测试，确认新模式未引入新增 P0/P1 回归。
- [x] T074 运行 `pnpm typecheck`，0 error。
- [x] T075 运行 `pnpm lint`，不得新增 error。
- [x] T076 运行 `pnpm test`，新模式测试 0 failed；既有 flaky 单独登记不得包装成新通过。
- [x] T077 运行 `pnpm test:e2e`，新模式 P1/P2 核心流 0 failed。
- [x] T078 运行 `pnpm build` 成功。
- [ ] T079 如保留 Android 包装，运行 `pnpm android:sync` + Android 实机 smoke：音效、震动、离线、主题、按钮一排。
- [ ] T080 按当前 Spec Kit 官方流程执行 `/speckit.implement` 后 `/speckit.converge`；如 converge 追加任务，重复直到 Converged。
- [x] T081 最终 Constitution Check：旧功能保留、exact-level、无AI现场、无321、同题返回、无再来一次、三按钮同排、双语大字、盾牌 fail-closed、离线核心。

---

## Dependencies

```text
Phase 1 baseline
   ↓
Phase 2 independent foundation
   ↓
US1 entry/setup
   ↓
US2/US3 main UI + deck
   ├─→ US4 shield
   ├─→ US5 language
   └─→ US6 timer
          ↓
      US7 theme + US8 offline
          ↓
      formal bank swap
          ↓
      analyze / tests / implement-converge
```

## MVP First

最快酒吧实测版：
1. Phase 1～2；
2. US1；
3. US2/US3；
4. US4；
5. US5；
6. US6；
7. 本地样本题；
8. 核心 E2E + build。

旧功能不删；正式题库可后换；主题精修和更多设置不阻塞首次实测。

---

## V1.1 四文档交叉检查结论

已解决 V1.0 的关键冲突：
1. **“新仓库后立即删旧功能”冲突** → 改为复制原项目、旧功能保留、新模式独立增量。
2. **Constitution 把旧 AI/Heat 视为违规** → 改为只禁止新模式依赖它们；旧模块允许存在。
3. **SPEC 夹杂过多技术实现** → V1.1 将数据结构/目录/状态机技术细节移入 PLAN。
4. **UI 只有抽象文字、没有冻结原型约束** → 增加 UI 硬规则和主页面/计时三联图视觉基线。
5. **“大冒险”入口归属不清** → 用户心智归入“大冒险”，工程上独立路由；旧真心话大冒险保留。
6. **官方流程停在 tasks** → 补入 analyze 和 implement→converge 收口流程。
7. **安全边界可能重新引入风险标签/软化题目** → 明确安全放在 Human 入库审核 + 通用跳过/结束/盾牌，不建立风险评分、不改写正式题面。
8. **当前原仓 dirty 状态复制风险** → Phase 1 强制确认基线，不 reset/delete 未确认内容。

无剩余阻塞性文档矛盾；正式开发前唯一需 Human 持续提供的是最终题库内容与后续是否替代旧入口的决定。


## 执行状态与外部条件（2026-10-01）

- T002：用户已复制的新目录已确认；初始 Git 为 bootstrap `018a368`，全业务树未跟踪。未自行提交基线或 push，保留完整原树，Git 状态见验收证据。
- T004：四文档已原样落盘，UI 图已归档；未在 dirty tree 上执行会覆盖托管文件的 Spec Kit `init --force`。本轮用显式文档与等价一致性检查推进，工具初始化未完成。
- T068：开发样本共20题（每档4题），可直接整体替换，正式人工审核题库等待 Human 提供。
- T079：静态导出与 `CAPACITOR_TARGET=release pnpm android:sync` 已通过；`adb devices -l` 无设备，Android实机未测。
- T080：已执行等价 analyze→implement→gap check→修复→验证，并记录所有剩余外部条件；未伪称调用本会话不可用的 `/speckit.*` 指令或工具级 Converged。
- T030/031/043/056：组件验证合并在 `tests/component/punishment.test.tsx`；真实布局在浏览器E2E验证，避免以jsdom模拟像素。
- T032/033/038/044/057/062/067：用例合并在 `tests/e2e/punishment.spec.ts`，生产离线重载单列 `punishment-production.spec.ts`。
