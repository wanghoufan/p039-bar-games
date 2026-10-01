# PACK1-A2-ADJUDICATION｜第一包 A2 审计逐卡裁决**最终执行视图**

> 本文件是 `PN-TRUTH-201~231` 逐卡审计**最终处置的唯一真源**（review trace / ID lineage / replacement justification 以本表为准）。
> 由 `scripts/audit-pack1-a2-adjudication.ts` 从**只读真源**（归档 `retired-truth-pack-2026-09-29.ts` 的 `auditClassification` ＋ 显式改判集 ＋ REWRITE/REPLACE 卡源）派生；**所有汇总数字由逐卡行计算，无手填**。
> ⛔ 不改历史原件：`temp/BAR-AUDIT-PACK1-31.md` 逐字保留 A2 原始审计，本附录只登记其后的最终执行口径。

## 0. 口径一句话

**A2 原始分类不是最终分类。** A2 原件写 **KEEP 5 / REWRITE 7 / REPLACE 19**；实际执行口径为 **KEEP 5 / REWRITE 5 / REPLACE 21**。

后续脚本 / 测试如需知道某张旧卡的**最终处置**，**读本附录的最终执行视图**，⛔ 不得继续假定 A2 原始分类即最终分类。

### 0.1 算式（可复算）

```text
KEEP    5 = A2 KEEP 5 + 改判 0
REWRITE 5 = A2 REWRITE 7 − 改判 2
REPLACE 21 = A2 REPLACE 19 + 改判 2
合计    31 = 5 + 5 + 21
```

复算命令（脚本内置 fail-closed 断言，任一对不上即 `exit 1`）：

```bash
npx vite-node -c vitest.config.ts scripts/audit-pack1-a2-adjudication.ts
```

## 1. 改判逐条（A2 → 最终）

| 旧 ID | A2 原判 | 最终 | 改判原因 | reviewer | date |
|---|---|---|---|---|---|
| 202 | REWRITE | REPLACE | A2 判 REWRITE（原题面「有没有一个爱好你坚持了很多年？说说它现在还在给你什么。」），实测 AI 腔 5 / 现场反应 2（HANDOFF §4.1 逐字），与新酒吧基线（3 秒理解 / 10 秒能答 / 优先封闭半封闭）冲突，按最终口径改判 REPLACE（同条 HANDOFF：批次口径 REWRITE 7 ＋ REPLACE 19 → REWRITE 5 ＋ REPLACE 21）。 | 编排者（task-manager）口径改判（HANDOFF §4「需要 Human／审查拍板的口径」，本节自述「本轮我改了口径」） | 2026-09-29 |
| 225 | REWRITE | REPLACE | A2 判 REWRITE（原题面「最近才开始的爱好是什么？说说让你上头的第一个瞬间。」），实测 AI 腔 5 / 现场反应 2（HANDOFF §4.1 逐字），与新酒吧基线冲突，按最终口径改判 REPLACE（同条 HANDOFF；与 `202` 同批改判）。 | 编排者（task-manager）口径改判（HANDOFF §4「需要 Human／审查拍板的口径」，本节自述「本轮我改了口径」） | 2026-09-29 |

> 改判来源：docs/handoff/HANDOFF.md#大交接3-2026-09-29-收尾 §4.1；A2 原件（只读）：`temp/BAR-AUDIT-PACK1-31.md`。两条改判卡的**旧 ID 处置**均为「退出 Formal，逐字归档」，**新 ID 映射**见 §2 表内「新 ID」列。
> ⚠️ HANDOFF §4 标题为「需要 Human／审查拍板的口径」⇒ 该改判属**已登记待拍板**事项；本附录只照实登记最终执行视图，**不代替拍板**。

## 2. 全 31 张最终三分类表（由脚本从实际处置派生）

| 旧 ID | A2 原判 | **最终分类** | 档位 | 旧 ID 处置 | 新 ID | 备注 |
|---|---|---|---|---|---|---|
| 201 | REWRITE | **REWRITE** | H1 | 退出 Formal，逐字归档于 lib/v2-content/archive/retired-truth-pack-2026-09-29.ts | PN-TRUTH-244（1:1 方向承接） | A2 判 REWRITE / 最终仍 REWRITE：同方向重写，旧 ID 退出 Formal、新开 ID。 |
| 202 | REWRITE | **REPLACE** | H1 | 退出 Formal，逐字归档于 lib/v2-content/archive/retired-truth-pack-2026-09-29.ts | 无 1:1 新 ID（原槽位 PN-TRUTH-246 保留新方向，不承接） | A2 判 REWRITE **改判 REPLACE**：旧卡按 REPLACE 处理（退出 Formal / 归档）；其原 REWRITE 槽位 PN-TRUTH-246 保留新方向「你更吃哪种人：像你的，还是跟你完全不一样的？（吸引对象类型）」，**不 1:1 承接**本卡信息目标（不补 1:1 卡）。 |
| 203 | KEEP | **KEEP** | — | 保留 Formal（题面逐字不动） | —（沿用原 ID） | A2 判 KEEP / 最终仍 KEEP。 |
| 204 | REPLACE | **REPLACE** | H2 | 退出 Formal，逐字归档于 lib/v2-content/archive/retired-truth-pack-2026-09-29.ts | PN-TRUTH-251（换向新卡） | A2 判 REPLACE / 最终仍 REPLACE：方向本身不适合酒吧主线，换向并新开 ID。 |
| 205 | KEEP | **KEEP** | — | 保留 Formal（题面逐字不动） | —（沿用原 ID） | A2 判 KEEP / 最终仍 KEEP。 |
| 206 | REPLACE | **REPLACE** | H2 | 退出 Formal，逐字归档于 lib/v2-content/archive/retired-truth-pack-2026-09-29.ts | PN-TRUTH-252（换向新卡） | A2 判 REPLACE / 最终仍 REPLACE：方向本身不适合酒吧主线，换向并新开 ID。 |
| 207 | REPLACE | **REPLACE** | H2 | 退出 Formal，逐字归档于 lib/v2-content/archive/retired-truth-pack-2026-09-29.ts | PN-TRUTH-253（换向新卡） | A2 判 REPLACE / 最终仍 REPLACE：方向本身不适合酒吧主线，换向并新开 ID。 |
| 208 | REPLACE | **REPLACE** | H2 | 退出 Formal，逐字归档于 lib/v2-content/archive/retired-truth-pack-2026-09-29.ts | PN-TRUTH-254（换向新卡） | A2 判 REPLACE / 最终仍 REPLACE：方向本身不适合酒吧主线，换向并新开 ID。 |
| 209 | KEEP | **KEEP** | — | 保留 Formal（题面逐字不动） | —（沿用原 ID） | A2 判 KEEP / 最终仍 KEEP。 |
| 210 | REPLACE | **REPLACE** | H2 | 退出 Formal，逐字归档于 lib/v2-content/archive/retired-truth-pack-2026-09-29.ts | PN-TRUTH-255（换向新卡） | A2 判 REPLACE / 最终仍 REPLACE：方向本身不适合酒吧主线，换向并新开 ID。 |
| 211 | REPLACE | **REPLACE** | H3 | 退出 Formal，逐字归档于 lib/v2-content/archive/retired-truth-pack-2026-09-29.ts | PN-TRUTH-256（换向新卡） | A2 判 REPLACE / 最终仍 REPLACE：方向本身不适合酒吧主线，换向并新开 ID。 |
| 212 | REPLACE | **REPLACE** | H3 | 退出 Formal，逐字归档于 lib/v2-content/archive/retired-truth-pack-2026-09-29.ts | PN-TRUTH-257（换向新卡） | A2 判 REPLACE / 最终仍 REPLACE：方向本身不适合酒吧主线，换向并新开 ID。 |
| 213 | REPLACE | **REPLACE** | H3 | 退出 Formal，逐字归档于 lib/v2-content/archive/retired-truth-pack-2026-09-29.ts | PN-TRUTH-258（换向新卡） | A2 判 REPLACE / 最终仍 REPLACE：方向本身不适合酒吧主线，换向并新开 ID。 |
| 214 | REPLACE | **REPLACE** | H3 | 退出 Formal，逐字归档于 lib/v2-content/archive/retired-truth-pack-2026-09-29.ts | PN-TRUTH-259（换向新卡） | A2 判 REPLACE / 最终仍 REPLACE：方向本身不适合酒吧主线，换向并新开 ID。 |
| 215 | REPLACE | **REPLACE** | H3 | 退出 Formal，逐字归档于 lib/v2-content/archive/retired-truth-pack-2026-09-29.ts | PN-TRUTH-260（换向新卡） | A2 判 REPLACE / 最终仍 REPLACE：方向本身不适合酒吧主线，换向并新开 ID。 |
| 216 | REPLACE | **REPLACE** | H3 | 退出 Formal，逐字归档于 lib/v2-content/archive/retired-truth-pack-2026-09-29.ts | PN-TRUTH-261（换向新卡） | A2 判 REPLACE / 最终仍 REPLACE：方向本身不适合酒吧主线，换向并新开 ID。 |
| 217 | REPLACE | **REPLACE** | H3 | 退出 Formal，逐字归档于 lib/v2-content/archive/retired-truth-pack-2026-09-29.ts | PN-TRUTH-262（换向新卡） | A2 判 REPLACE / 最终仍 REPLACE：方向本身不适合酒吧主线，换向并新开 ID。 |
| 218 | REPLACE | **REPLACE** | H3 | 退出 Formal，逐字归档于 lib/v2-content/archive/retired-truth-pack-2026-09-29.ts | PN-TRUTH-263（换向新卡）（该新卡已由 A9-R6 内容裁决退役，逐字归档于 lib/v2-content/archive/retired-pack1-r6-2026-09-29.ts） | A2 判 REPLACE / 最终仍 REPLACE：方向本身不适合酒吧主线，换向并新开 ID。 |
| 219 | REPLACE | **REPLACE** | H3 | 退出 Formal，逐字归档于 lib/v2-content/archive/retired-truth-pack-2026-09-29.ts | PN-TRUTH-264（换向新卡） | A2 判 REPLACE / 最终仍 REPLACE：方向本身不适合酒吧主线，换向并新开 ID。 |
| 220 | REPLACE | **REPLACE** | H2 | 退出 Formal，逐字归档于 lib/v2-content/archive/retired-truth-pack-2026-09-29.ts | PN-TRUTH-265（换向新卡） | A2 判 REPLACE / 最终仍 REPLACE：方向本身不适合酒吧主线，换向并新开 ID。 |
| 221 | REPLACE | **REPLACE** | H2 | 退出 Formal，逐字归档于 lib/v2-content/archive/retired-truth-pack-2026-09-29.ts | PN-TRUTH-266（换向新卡） | A2 判 REPLACE / 最终仍 REPLACE：方向本身不适合酒吧主线，换向并新开 ID。 |
| 222 | REPLACE | **REPLACE** | H3 | 退出 Formal，逐字归档于 lib/v2-content/archive/retired-truth-pack-2026-09-29.ts | PN-TRUTH-267（换向新卡） | A2 判 REPLACE / 最终仍 REPLACE：方向本身不适合酒吧主线，换向并新开 ID。 |
| 223 | REPLACE | **REPLACE** | H4 | 退出 Formal，逐字归档于 lib/v2-content/archive/retired-truth-pack-2026-09-29.ts | PN-TRUTH-268（换向新卡） | A2 判 REPLACE / 最终仍 REPLACE：方向本身不适合酒吧主线，换向并新开 ID。 |
| 224 | REPLACE | **REPLACE** | H4 | 退出 Formal，逐字归档于 lib/v2-content/archive/retired-truth-pack-2026-09-29.ts | PN-TRUTH-269（换向新卡） | A2 判 REPLACE / 最终仍 REPLACE：方向本身不适合酒吧主线，换向并新开 ID。 |
| 225 | REWRITE | **REPLACE** | H1 | 退出 Formal，逐字归档于 lib/v2-content/archive/retired-truth-pack-2026-09-29.ts | 无 1:1 新 ID（原槽位 PN-TRUTH-247 保留新方向，不承接） | A2 判 REWRITE **改判 REPLACE**：旧卡按 REPLACE 处理（退出 Formal / 归档）；其原 REWRITE 槽位 PN-TRUTH-247 保留新方向「你的心动是看一眼就来，还是越聊越有？（心动触发速度）」，**不 1:1 承接**本卡信息目标（不补 1:1 卡）。 |
| 226 | REWRITE | **REWRITE** | H1 | 退出 Formal，逐字归档于 lib/v2-content/archive/retired-truth-pack-2026-09-29.ts | PN-TRUTH-250（1:1 方向承接） | A2 判 REWRITE / 最终仍 REWRITE：同方向重写，旧 ID 退出 Formal、新开 ID。 |
| 227 | KEEP | **KEEP** | — | 保留 Formal（题面逐字不动） | —（沿用原 ID） | A2 判 KEEP / 最终仍 KEEP。 |
| 228 | REWRITE | **REWRITE** | H1 | 退出 Formal，逐字归档于 lib/v2-content/archive/retired-truth-pack-2026-09-29.ts | PN-TRUTH-245（1:1 方向承接） | A2 判 REWRITE / 最终仍 REWRITE：同方向重写，旧 ID 退出 Formal、新开 ID。 |
| 229 | KEEP | **KEEP** | — | 保留 Formal（题面逐字不动） | —（沿用原 ID） | A2 判 KEEP / 最终仍 KEEP。 |
| 230 | REWRITE | **REWRITE** | H1 | 退出 Formal，逐字归档于 lib/v2-content/archive/retired-truth-pack-2026-09-29.ts | PN-TRUTH-248（1:1 方向承接） | A2 判 REWRITE / 最终仍 REWRITE：同方向重写，旧 ID 退出 Formal、新开 ID。 |
| 231 | REWRITE | **REWRITE** | H1 | 退出 Formal，逐字归档于 lib/v2-content/archive/retired-truth-pack-2026-09-29.ts | PN-TRUTH-249（1:1 方向承接）（该新卡已由 A9-R7 内容返工退役，逐字归档于 lib/v2-content/archive/retired-pack1-r7-2026-09-29.ts） | A2 判 REWRITE / 最终仍 REWRITE：同方向重写，旧 ID 退出 Formal、新开 ID。新卡随后经 A9-R7 内容返工裁决退役（与 250 同轴），血缘保留、退出运行时。 |

### 2.1 最终分类清单（派生）

- **KEEP 5**：203 / 205 / 209 / 227 / 229
- **REWRITE 5**：201 / 226 / 228 / 230 / 231
- **REPLACE 21**：202 / 204 / 206 / 207 / 208 / 210 / 211 / 212 / 213 / 214 / 215 / 216 / 217 / 218 / 219 / 220 / 221 / 222 / 223 / 224 / 225

### 2.2 改判卡的新 ID 映射（`202` / `225`）

| 旧 ID | 最终分类 | 旧 ID 处置 | 新 ID 映射 |
|---|---|---|---|
| 202 | REPLACE | 退出 Formal，逐字归档于 lib/v2-content/archive/retired-truth-pack-2026-09-29.ts | 无 1:1 新 ID（原槽位 PN-TRUTH-246 保留新方向，不承接） |
| 225 | REPLACE | 退出 Formal，逐字归档于 lib/v2-content/archive/retired-truth-pack-2026-09-29.ts | 无 1:1 新 ID（原槽位 PN-TRUTH-247 保留新方向，不承接） |

> ⚠️ 已知陈旧描述：`lib/v2-content/pack1-rewrites/pack1-rewrite-cards.ts` 文件头仍写「承接旧 202 / 225 方向」（改判前注释）。
> 最终口径以本附录为准：`246` / `247` 保留的是**新方向**，**不 1:1 承接** `202` / `225` 的信息目标（HANDOFF「大交接 3」§4.1：「246/247 保留新方向，不补 1:1 卡」）。

## 3. 只读真源（可追溯）

- A2 原始逐卡审计（**只读，未改**）：`temp/BAR-AUDIT-PACK1-31.md`（product-reviewer / Research Reviewer）
- 口径改判记录：`docs/handoff/HANDOFF.md#大交接3-2026-09-29-收尾 §4.1`
- A2 原判载体：`lib/v2-content/archive/retired-truth-pack-2026-09-29.ts` 的 `auditClassification`
- REWRITE 新 ID 来源：`lib/v2-content/pack1-rewrites/pack1-rewrite-cards.ts`
- REPLACE 新 ID 来源：`lib/v2-content/pack1-replaces/pack1-replace-cards.ts`
- KEEP 载体：`lib/v2-content/formal-truth-pack.ts` / `lib/v2-content/formal-truth-bootstrap-pack.ts`

*本附录由 `scripts/audit-pack1-a2-adjudication.ts` 生成（确定性：无时间戳 / 无随机量）；表单张数与分类计数均自逐卡行派生。*
