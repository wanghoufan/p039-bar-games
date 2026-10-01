# docs/qa/content-audit/｜现役状态指针

> **本目录的 MC / 结构产物不是现役答案。**
> 唯一现役状态见 `docs/handoff/HANDOFF.md` 的「大交接 4（2026-09-30 A9 收口）」段。

## 当前口径（2026-09-29 A9-R7 内容返工后）
- `FORMAL-TRUTH-MC.json` / `FORMAL-TRUTH-MC.md` / `FORMAL-TRUTH-MC-WORST-TRACE.json` / `FORMAL-TRUTH-PRODUCTION-CHAIN.json` 已随 A9-R6 重刷（当时 `formalTotal = 54`），并已随 A9-R7（退役 `PN-TRUTH-249`）**再次重刷**，现 `formalTotal = 53`（与代码侧 `formalFixed` 一致）。
- 代码侧 `formalFixed` 实际 = **53**（H1 14 / H2 17 / H3 16 / H4 6；A9-R6 退役 277/263/236、A9-R7 退役 249 后）；`FORMAL-TRUTH-STRUCTURE.*` 与 `PACK1-SKELETON-CLUSTER.*` 亦已随 R7 重刷（`totalFormal = 53`）；`PACK1-A2-ADJUDICATION.md`（脚本派生：KEEP 5 / REWRITE 5 / REPLACE 21）同为现役口径产物。
- 重刷前**不得**引用这些文件里的 `note` / `summary` 做任何结论；也**不得**为了对账去改代码里的准入或阈值。

## 历史产物（留痕，不改）
`CONTENT-AUDIT-350.*`、`CONTENT-STRUCTURE-REPORT.md`、`ROUTER-MONTE-CARLO.*`、`MC-TRACE.json`、`STABLE-LABELS.json`、`GAP-*`、`TOP20-*`、`_calib/ _ranks.json _recheck/ _reviews/ _slices/ _stable/ _semantic/` 均为**旧 350 题与旧 Formal 口径**下的历史证据，只作留痕。

## 纪律
- 报告/MC 的 `note` / `summary` **必须由实测派生**；篡改产物会被可复算护栏判红（本项目已因此踩坑）。
- 报告口径必须**双章分开**：`A｜Engine/显式披露` 与 `B｜当前真实 UI`（后者 `roundDisclosureForCurrentRound()` 恒 `undefined` ⇒ `effective=0 / Heat=H1 / mid Mutual 不可达`）；⛔ 禁止写「生产 Heat 已正常推进」。
- `Heat` 纪律：`heatMin` 逐卡来自 reviewer；⛔ 不得为让 MC 好看压低 `heatMin` 或改门槛；诚实的深题暂时抽不到是**正确结果**。
