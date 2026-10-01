# Party Night 大冒险惩罚工具｜PLAN V1.1

- 文档角色：Technical Implementation Plan（how）
- 拟落盘路径：`specs/001-dare-punishment/plan.md`
- 输入：Constitution V1.1 + SPEC V1.1
- 实施策略：**复制现有 Party Night，增量新增独立惩罚模式；旧功能不删**

## 0. 技术结论（大白话）

不要重做 App，也不要把旧 Party Night 清空。Human 复制一份原项目，我们就在复制版里**加一个新的“大冒险惩罚页面”**。视觉组件、深浅色、PWA/Android、测试都尽量沿用；旧真心话、Heat、Mutual、AI 等先原样留着。新模式自己维护题库、五档、盾牌、语言和计时，不依赖旧复杂引擎。

用户层面它属于“大冒险”；工程层面独立，避免改一处牵动整套旧状态机。

---

## 1. 当前仓库事实基线

已读取当前 Party Night：
- Next.js 16.3.3
- React 19.2
- TypeScript 5.9
- Tailwind 4
- Capacitor Android 7.x
- Zod 4
- Vitest 3
- Playwright 1.55
- IndexedDB/local storage 能力已存在

现有 `app/game/page.tsx` 已深度接入 Session、Heat/relationship、Mutual、AI 补题、pack switch、转瓶子、默契测试等逻辑；当前 `truth-dare` pack 同时支持 truth+dare。

**结论**：新惩罚模式不应直接塞进现有 `app/game/page.tsx` 和旧 `truth-dare` 引擎，否则会为了一个简单工具继续继承旧复杂度。

当前原仓工作区检查还存在未提交/未跟踪内容（例如 `.gitignore`、`.arts/`、题库收集目录）。复制前必须由 Human/开发者确认哪些要进入新副本基线；不得 `reset --hard` 或随手删除。

---

## 2. Constitution Check（设计前）

| 约束 | 结果 | 设计响应 |
|---|---|---|
| 旧功能保留 | PASS | 新路由/新模块，不删除旧功能 |
| 新模式与旧复杂引擎隔离 | PASS | 不复用旧关系推进/AI session engine |
| 五档 exact-level | PASS | 新模式自有 deck manager |
| 运行时 AI=0（新模式） | PASS | 本地题库 + 本地翻译文案 |
| 题面主视觉 | PASS | 独立 PunishmentPlay 页面按冻结原型布局 |
| 计时无 321 | PASS | 300～500ms 进入 running |
| 盾牌只做内容过滤 | PASS | contentTags + disabledTags |
| 主题复用 | PASS | 复用旧 Party Night token/component |
| 离线 | PASS | 核心路径无 fetch |

---

## 3. 入口策略：产品放“大冒险”，代码做独立模块

### 3.1 推荐用户入口

本轮**不新增更高一级类别**。在首页/玩法区增加一个新入口：
- 用户端显示名固定建议为：`大冒险`；
- 一键进入新模式；
- 现有 `真心话大冒险` 旧入口先保留。

为什么不直接改旧 truth-dare：旧包目前与玩家、Session、关系/AI/Pack engine 强耦合；新模式本质不需要这些。

### 3.2 推荐路由

```text
/punishment              # 新模式启动/偏好入口
/punishment/play         # 新模式主游戏页
```

可选：如果后续需要更贴合 URL，可改成 `/dare` / `/dare/play`，但模块边界不变。

### 3.3 首页接入

最小修改优先：
- 在现有首页玩法区增加一个**专用 shortcut** 指向 `/punishment`；
- 不把它注册成旧 `truth-dare` 的 card type；
- 不要求走 `/setup?pack=truth-dare`；
- 不要求录玩家姓名或创建旧 GameSession。

这样旧玩法保持原样，新模式一键进入。

---

## 4. 代码结构

推荐在复制项目中新增：

```text
app/
├── punishment/
│   ├── page.tsx                 # 启动/首次偏好
│   └── play/
│       └── page.tsx             # 主游戏页

components/
├── punishment/
│   ├── LevelDots.tsx
│   ├── ChallengeCard.tsx
│   ├── ActionBar.tsx
│   ├── TimerOverlay.tsx
│   ├── ShieldSheet.tsx
│   ├── LanguageSheet.tsx
│   ├── PunishmentSettingsSheet.tsx
│   └── EmptyPoolState.tsx

lib/
├── punishment/
│   ├── schema.ts
│   ├── deck.ts
│   ├── filter.ts
│   ├── session.ts
│   ├── preferences.ts
│   └── timer.ts

content/
└── punishment/
    └── challenges.ts            # 先样本，后替换为 Human 正式题库

tests/
├── unit/punishment-*.test.ts
├── component/punishment-*.test.tsx
└── e2e/punishment-*.spec.ts
```

现有 `components/ui/`, `components/brand/`, `app/globals.css`, `lib/audio` 等优先复用；旧 `app/game/page.tsx` 不作为新模式主战场。

---

## 5. Data Model（PLAN 内技术定义）

### 5.1 ChallengeCard

```ts
type ChallengeCard = {
  id: string;
  level: 1 | 2 | 3 | 4 | 5;
  zh: string;
  en: string;
  contentTags: string[];
  timerSeconds: number | null;
};
```

规则：
- `id` 唯一；
- level 单值 exact-level；
- zh/en 正式发布均非空；
- timerSeconds 为正整数或 null；
- 不加入 riskLevel；
- 不需要运行时 AI 字段；
- 题目文本不由前端改写。

### 5.2 Runtime Session

```ts
type PunishmentSession = {
  selectedLevel: 1 | 2 | 3 | 4 | 5;
  currentCardId: string | null;
  usedCardIdsByLevel: Record<1|2|3|4|5, string[]>;
  orderByLevel: Record<1|2|3|4|5, string[]>;
};
```

### 5.3 Preferences

```ts
type PunishmentPreferences = {
  language: 'zh' | 'bilingual' | 'en';
  disabledTags: string[];
  theme: 'system' | 'dark' | 'light';
  sound: boolean;
  vibration: boolean;
};
```

Preferences 长期本地保存；session 只保存本局。

---

## 6. 抽题算法

```text
selectedLevel
  → exact-level cards
  → filter out any card whose contentTags intersects disabledTags
  → exclude used IDs in current cycle
  → take next from pre-shuffled local order
```

规则：
1. 绝不向下混档；
2. 每档独立牌堆和进度；
3. 切回原档继续；
4. 过滤改变后仅影响后续题；
5. 当前题保持；
6. 当前档无题返回 empty state，不突破盾牌；
7. 用尽后重新洗牌并做短期防紧邻重复。

---

## 7. UI 实施基线

### 7.1 视觉复用

直接复用旧 Party Night：
- NeonBackground / 霓虹粉紫色系；
- Button、Icon、圆角、阴影、玻璃/渐变卡片；
- 已有深浅色主题 token；
- 音效工具。

**不要重新做品牌设计。**

### 7.2 主页面布局（冻结）

```text
┌────────────────────────────┐
│  设置     ● ○ ○ ○ ○     语言 │  ← 窄顶部
│                            │
│  ┌──────────────────────┐  │
│  │                      │  │
│  │     中文超大题面       │  │
│  │                      │  │
│  │     English 大题面    │  │  ← 绝大部分屏幕
│  │                      │  │
│  └──────────────────────┘  │
│ [下一个] [换一个] [开始15秒] │  ← 一排，约≤10%屏高
└────────────────────────────┘
```

硬规则：
- 不放大 Party Night Logo；
- 不显示玩法标签；
- 5 dots 无数字；
- 英文不能比中文小到不可读；
- 三按钮必须同排；
- 360/390/430 宽度都不换成两行按钮。

### 7.3 计时 UI

idle：同上。

running：
- 同一题卡内显示题目 + 大倒计时圆环；
- 300～500ms 直接进入；无 321；
- 底栏 `暂停 | 结束`；
- `下一个/换一个`可在 running 时禁用，避免半计时换题造成歧义。

paused：`继续 | 结束`。

finish/manual end：
- 短暂 `时间到！`（自然结束）；
- 然后回同题 idle；
- 重新出现 `下一个 | 换一个 | 开始XX秒`；
- 无“再来一次”。

---

## 8. Timer 技术设计

状态：
```text
idle → running ↔ paused
running → finished
running/paused → idle (manual end)
finished → idle (same card)
```

实现：
- 使用 `endAt - now` 计算剩余时间，避免 `setInterval` 累积漂移；
- UI 可 100～250ms 刷新，显示整数秒；
- 页面进后台后恢复时按真实时间重算；
- paused 不消耗时间；
- natural finish 触发本地 sound/vibration 后回 idle。

---

## 9. 本地存储

- 偏好：localStorage（language, disabledTags, theme, sound, vibration）。
- 本局：sessionStorage（selectedLevel/currentCard/order/used IDs）。
- 不创建账号；不上传玩家/题目执行历史。
- 若已有通用 repository 封装很轻，可复用；否则新模式保持简单。

---

## 10. 旧功能兼容策略

### MUST NOT
- 删除旧 Truth/Heat/Mutual/MATCH/AI 文件；
- 为新模式重写旧 session-engine；
- 把旧 `truth-dare` 题库迁移作为本轮前置；
- 因为新模式不需要玩家，就修改旧玩法的玩家要求。

### MAY
- 复用通用 Button/Icon/NeonBackground/audio/theme；
- 首页新增一个快捷入口；
- 未来单独 Change 把新模式设为默认“大冒险”。

### 回归要求
- 新功能引入后，旧核心 E2E/Unit 不应新增 P0/P1 失败；
- 若旧测试本身有已登记 flaky，需区分既有问题与新增回归。

---

## 11. 安全边界实现

- 始终有 `换一个`；
- 计时中始终有 `结束`；
- 盾牌关闭项 fail-closed；
- 不做风险分数和运行时软化；
- Human 正式入库前排除明显违法/高危动作；
- 新模式不采集玩家个人资料；
- 不使用远程 AI/翻译 API。

---

## 12. 测试计划

### Unit
1. exact-level isolation；
2. five independent decks；
3. filter any-match exclusion；
4. no-repeat cycle；
5. empty pool；
6. timer no-321 state machine；
7. pause/resume/end/finish same-card；
8. preference/session persistence；
9. schema fail-fast。

### Component
1. LevelDots 无数字、低调选中；
2. bilingual large typography；
3. untimed two buttons same row；
4. timed three buttons same row；
5. running/paused controls；
6. empty state exact copy。

### E2E
1. new entry → setup → play；
2. old Party Night entry still works；
3. 1→4→2 exact-level；
4. shield filter；
5. language switch same card；
6. timed card start ≤500ms and no 321；
7. pause/resume/manual end；
8. natural finish → same card idle；
9. offline；
10. dark/light/system parity；
11. 360/390/430 layout no overflow。

---

## 13. 开发顺序

### Phase 0｜复制基线
- Human/开发者先复制原项目到新目录/新仓库；
- 确认当前 dirty/untracked 内容是否要带入；
- 建立可回退的 baseline commit；
- 当前原仓未发现 `.specify/`。若复制版要正式启用 Spec Kit，应按 Existing Project 官方指南在可审查基线上初始化；不要在 dirty tree 上盲目 `--force`。

### Phase 1｜增量骨架
- 新 `/punishment` 路由；
- 新独立 state/content modules；
- 首页入口；
- 旧功能不动。

### Phase 2｜本地题库与五档引擎
- schema / deck / filter / session。

### Phase 3｜冻结主 UI
- dots / card / action bar / empty state；
- 对照最终深色原型。

### Phase 4｜语言 / 盾牌 / 主题

### Phase 5｜Timer

### Phase 6｜正式题库替换
- Human 提供正式审核题库时替换 `content/punishment/challenges.ts`；
- 不改变引擎。

### Phase 7｜回归与实机
- unit/component/e2e/build；
- Android/PWA smoke；
- 旧功能回归。

---

## 14. Spec Kit 官方流程适配

当前官方流程强调：Constitution 每项目一次；feature 走 specify → plan → tasks → implement → converge。Existing project 指南要求从可审查基线开始，并让新 feature 复用既有架构而不是重建整个系统。

本次四件套是 Human 要求的交付核心。若正式在仓库运行 Spec Kit：
1. 先 `/speckit.clarify`（若仍有未决行为）；
2. `/speckit.analyze` 检查 spec/plan/tasks 一致性；
3. `/speckit.implement`；
4. `/speckit.converge`；
5. converge 若追加任务，重复 3～4，直到 Converged。

`research.md / data-model.md / quickstart.md / contracts/` 若工具按 plan 阶段生成，可作为辅助产物，但不得覆盖本文已冻结的产品规则。

---

## 15. Constitution Check（设计后复核）

- 旧功能保留：PASS
- 新模式独立：PASS
- exact-level：PASS
- 新模式 runtime AI=0：PASS
- UI 与最终确认深色原型一致：PASS（文字规则为真源）
- 计时无321、同题返回：PASS
- 三按钮同排：PASS
- 盾牌 fail-closed：PASS
- 离线核心：PASS
- 安全边界不污染题面：PASS


## 本轮执行验收条目（2026-10-01）

发布类型：新副本首次发布；最终 Human Gate 待用户体验签收。单开发者承担实现、自检与技术 QA，不宣称独立审查。

| AC | 关键 | 可观察行为 | 覆盖 |
|---|---|---|---|
| AC-01 | 是 | 首页“大冒险”直接进入偏好与游戏，旧玩法可用 | US1 / FR023–026 |
| AC-02 | 是 | 五无数字圆点低调切换；当前题不变，后续精确同档 | US2 / FR001–002、011 |
| AC-03 | 是 | next/replace ≤500ms，各档独立不重复，用尽避免紧邻重复 | US3 / FR005–006、027 |
| AC-04 | 是 | 任一关闭标签排除后续题；当前题保持；空池两动作恢复 | US4 / FR003–004 |
| AC-05 | 是 | 中文、英文、双语均可切换，题和进度保持；双语大字 | US5 / FR007–010、013 |
| AC-06 | 是 | 360/390/430 与桌面题卡主导；普通2按钮、计时3按钮同排；无大Logo | FR012、014–015 |
| AC-07 | 是 | timerSeconds 决定时长；≤500ms直接正式计时，无准备321 | FR017–018 |
| AC-08 | 是 | 暂停/继续/结束；自然和手动结束同题恢复，无再来一次 | FR019–021 |
| AC-09 | 是 | 自然结束本地音效、支持时震动；均可关闭 | FR022 |
| AC-10 | 是 | dark/light/system只换主题，计时与题库状态保持 | US7 / FR016 |
| AC-11 | 是 | 离线出题、设置、计时与PWA重载；无新模式AI/远端题库 | US8 / FR028–029 |
| AC-12 | 是 | 偏好与本局单独持久化，新局不重置旧玩法数据 | US1、US8 |

关键 AC 集合：AC-01～AC-12。证据见 `docs/qa/punishment/验收报告.md`。
Android 真机为外部设备条件；正式审核题库由 Human 后续提供，示范题独立且可整体移除。
