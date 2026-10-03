# 导入说明

## 给开发智能体

正式入库文件：

`truth-bank.json`

建议开发时：

1. 先用 `truth-bank.schema.json` 做结构校验。
2. 读取 `cards`。
3. 按 `level` 建立 5 个互相隔离的题池。
4. 语言模式：
   - 中文：显示 `zh`
   - English：显示 `en`
   - 双语：同时显示 `zh` + `en`
5. `timerSec` 在本真心话题库中全部为 `null`，不要显示计时按钮。
6. 不要重新生成、改写或二次审核 Human 已确认的题面。
7. `truth-bank-review.csv` 只用于人工查看，不作为运行时真源。
8. 运行时唯一题库真源应为 `truth-bank.json`。

## 数据字段

- `id`：唯一 ID
- `type`：固定 `truth`
- `audience`：固定 `one_male_one_female`
- `level`：1~5，严格隔离
- `zh`：中文题面
- `en`：英文题面
- `timerSec`：本包全部 null
- `tags`：描述性标签
- `source.originalRefs`：原始题号/来源线索

## 重要

如果未来要修改题目，请修改 JSON 真源后重新生成 review 文件，避免 JSON 与人工审核表漂移。
