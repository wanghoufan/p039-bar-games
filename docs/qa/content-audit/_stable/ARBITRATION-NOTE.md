# 复审标签｜第三方独立仲裁留痕（dare / either_or / chemistry）

- 日期：2026-09-27
- 通道/模型：`opencode run -m opencode/muse-spark-1.3-contributor-free`
- 触发条件：某张卡在任一轴上**没有严格多数票**（票数 > 来源数/2）。来源 = 原 reviewer（`_reviews-a1/*`）+ 盲审（`_recheck/BLIND-*`），校准样本内的 10 张/玩法另加 `_calib/r1.jsonl`、`_calib/r2.jsonl`，即每张卡 2 源或 4 源。
- 仲裁样本：`_stable/arbitration-input.jsonl`（**111 张**）。输入只含 `cardId` / `gameType` / `text` / `axes` / `question`——**不含任何既有标签**，仲裁者也看不到 orig / BLIND / r1 / r2 的结论。
- 判定口径：`docs/qa/content-audit/_RUBRIC-A1.md` 的 5 个轴（infoGain / semanticType / topic / socialEnergy / relationshipProgression），prompt 里逐轴复述了取值与判据。
- 分批：14 张/批，共 8 批；每批原始输出留在 `_stable/_batches/batch-NN.out.txt`（含模型逐张判定），输入留在 `_stable/_batches/batch-NN.jsonl`。
- 解析校验：逐行 JSONL 必须 `cardId` 齐全且 5 轴取值落在合法枚举内，否则丢弃该行（fail-closed）。
- 结果：`_stable/arbitration.jsonl`，**111/111 张全部回齐**，无缺卡。
- 组装说明：批次原始输出由一次性运维脚本（`/tmp/dispatch-stable-arb.py`，非项目交付物）合并；`_stable/arbitration.jsonl` 一旦落盘即为其唯一真源，`scripts/audit-a1-drift-stable.ts` 只读消费、可复算复审标签——已完成双源复审与分歧仲裁，可用于主题/候选定位；低可靠轴不得作为单题自动保留/删除依据。

## 复算方式

```bash
npx tsx scripts/audit-a1-drift-stable.ts      # 读 _stable/arbitration.jsonl → STABLE-LABELS.json
npx tsx scripts/audit-a1-report.ts --generate # 渲染 CALIBRATION-REPORT.md §7
npx tsx scripts/audit-a1-report.ts --verify-only
```
