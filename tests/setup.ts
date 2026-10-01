import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";

// 正式主线 AI 隔离开关（lib/ai/mainline-flag）在生产**缺省即关闭**（Plan §13）。
// 全量单测需要继续覆盖保留的 AI 代码（fixture 解析、直连分块、后台补题等），故这里默认显式开启；
// 关闭路径由两项独立证据覆盖：① 专项用例 tests/unit/ai-mainline-isolation.test.ts（显式 stubEnv 关闭）；
// ② 真实 E2E（Playwright 起 dev server，不注入 AI_MAINLINE_ENABLED → 按关闭跑）。
// 允许外部用 `AI_MAINLINE_ENABLED=false vitest run` 让整包单测走关闭路径。
process.env.AI_MAINLINE_ENABLED = process.env.AI_MAINLINE_ENABLED ?? "true";
