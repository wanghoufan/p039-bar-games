/**
 * BAR-FIT 独立审查输入（`docs/qa/content-audit-v2/BAR-FIT-HUMAN-REVIEW.json`）的
 * **按包分组机器档位汇总** ＋ **结构自校验**（R3）。
 *
 * ## 为什么要有这个模块
 * 审查输入里有两类数字，过去是**手写**的，出过一次「求和不自洽」的扁平结构
 * （本包 24 张 + 整库 4 个 hard-fail 被写进同一对象，被误读成四项同属一个集合）。
 * 本模块把两件事变成**可由逐卡数据复算**的纯函数：
 * 1. `tallyVerdicts()`：从逐卡 `machineVerdict` 行算出某组的 `total/PASS/SUSPECT/HARD_FAIL_PATTERN`；
 * 2. `checkReviewInput()`：六条自校验（条目数 = 候选总数 / cardId 唯一 / `reviewed` 与
 *    `humanBarFit` 自洽 / 各组求和自洽 / 历史覆盖 / 分组 note 与计数不矛盾）。
 *
 * 生成脚本与单测**共用同一份实现**，避免「脚本算一遍、测试另写一遍」的口径漂移。
 *
 * ## 红线（本模块刻意不做的事）
 * - **不产出任何审查结论**：`PASS / BORDERLINE / FAIL` 只能由 review 类角色逐卡填写；
 *   本模块只做「结构对不对、数字自不自洽」，**不碰** `humanBarFit` 的取值。
 * - **汇总不得手填**：所有数字都必须经 `tallyVerdicts()` 从逐卡行计算（缺行即抛错）。
 * - 零依赖（不 import node 内置 / 业务层），可被脚本、测试、CI 安全引用；
 *   需要 sha256 的调用方自行用 `node:crypto` 对 `reviewEntriesFingerprintInput()` 的结果取哈希。
 */

/** 机器预筛档位（唯一枚举真源在 `lib/v2-content/bar-fit.ts`，此处按结构登记以保持零依赖）。 */
export type MachineVerdict = "PASS" | "SUSPECT" | "HARD_FAIL_PATTERN";

/** 独立审查定档（`humanBarFit` 为历史兼容字段名，不代表 reviewer 必然是 Human）。 */
export type FixedHumanBarFit = "UNREVIEWED" | "PASS" | "BORDERLINE" | "FAIL";

export const MACHINE_VERDICTS: readonly MachineVerdict[] = ["PASS", "SUSPECT", "HARD_FAIL_PATTERN"];
export const FIXED_HUMAN_BAR_FITS: readonly FixedHumanBarFit[] = ["UNREVIEWED", "PASS", "BORDERLINE", "FAIL"];

/** 逐卡机器档位行（唯一来源：`BAR-FIT-AUDIT.json` canonical 全量集的 `rows`）。 */
export interface VerdictRow {
  cardId: string;
  machineVerdict: MachineVerdict;
}

/** 逐卡审查条目（结构镜像审查输入的 `entries[cardId]`）。 */
export interface ReviewEntry {
  reviewed: boolean;
  humanBarFit: FixedHumanBarFit;
  note: string;
}

/**
 * 历史留痕条目（A3 退出 Formal 时对**原独立审查结论**的归档）。
 *
 * 用数组（键为 `cardId` 字段）而不是 `Record<cardId, …>`：审查输入的活跃 `entries` 已经用
 * cardId 作键，若历史归档也用 cardId 作键，磁盘原文里同一个 `"PN-TRUTH-xxx":` 会出现两次，
 * 触发 `card-id-unique` 自校验。归档**逐字保留**当时的 `reviewed` / `humanBarFit` / `note`，
 * 只增不改——退出 Formal 只改活跃 `entries`，不抹历史。
 */
export interface ReviewHistoryEntry {
  cardId: string;
  reviewed: boolean;
  humanBarFit: FixedHumanBarFit;
  note: string;
}

/**
 * 一次「退出 Formal」批次的登记（只看事实与流程状态，不做质量评价）。
 *
 * `cardIds` 必须**等于**活跃 `entries` 里 `reviewed=false` 的候选集合——由
 * `checkReviewInput()` 的 `history-coverage` 项派生核对，防手填与活跃状态脱节。
 */
export interface ReviewRetirement {
  /** 归档时刻（ISO 8601）。 */
  retiredAt: string;
  /** 本次退出 Formal 的 cardId。 */
  cardIds: readonly string[];
  /** 一句话原因（事实/流程口径）。 */
  reason: string;
}

/** 退出 Formal 的卡在活跃 `entries` 里的统一 note（只记事实与流程状态，不做质量评价）。 */
export const RETIRED_FROM_FORMAL_NOTE =
  "Human 新酒吧基线判定不合格，已退出 Formal，待重构后重新审查（原独立审查结论见本文件 history 归档，未删除）。";

/**
 * A9-R6（2026-09-29 内容裁决）退出 Formal 的卡在活跃 `entries` 里的统一 note。
 *
 * 与 A3 的 `RETIRED_FROM_FORMAL_NOTE` 分开：本批是**内容裁决**（弱卡退役 / 重复卡去重），
 * 不是「方向不适合酒吧主线待重构」，理由与去向都不同（逐字归档见
 * `lib/v2-content/archive/retired-pack1-r6-2026-09-29.ts`）。
 */
export const RETIRED_FROM_FORMAL_R6_NOTE =
  "A9-R6 内容裁决判定不合格（内容弱 或 与既有卡重复），已退出本轮 Formal 并移出运行时卡源；原独立审查结论见本文件 history 归档，未删除。";

/**
 * A9-R7（2026-09-29 内容返工）退出 Formal 的卡在活跃 `entries` 里的统一 note。
 *
 * 与 R6 分开：本批是**内容主审 BORDERLINE 返工**（`249` 与 `250` 同轴，二选一留 250），
 * 不是「内容弱 / 与既有卡重复」的裁决去重；逐字归档见
 * `lib/v2-content/archive/retired-pack1-r7-2026-09-29.ts`。其余 5 张为**题面改写**（仍在 Formal）。
 */
export const RETIRED_FROM_FORMAL_R7_NOTE =
  "A9-R7 内容返工判定不合格（与既有卡同轴，二选一保留另一张），已退出本轮 Formal 并移出运行时卡源；原独立审查结论见本文件 history 归档，未删除。";

/** 一组机器档位的计数（`total` 必须等于三项之和）。 */
export interface VerdictTally {
  total: number;
  PASS: number;
  SUSPECT: number;
  HARD_FAIL_PATTERN: number;
}

/** 带人读留痕的一组汇总（写进审查输入）。 */
export interface VerdictGroupSummary extends VerdictTally {
  scope: string;
  source: string;
  note: string;
}

/** `packMachineVerdictSummary`：父级自洽 ＋ `groups` 各组自洽。 */
export interface PackVerdictSummary extends VerdictTally {
  scope: string;
  source: string;
  note: string;
  groups: Readonly<Record<string, VerdictGroupSummary>>;
}

/** 审查输入的完整形态（`entries` ＋ 历史归档 ＋ 两个机器档位汇总对象）。 */
export interface ReviewInputPayload {
  source: string;
  reviewedAt: string;
  reviewerKind: string;
  note: string;
  entries: Readonly<Record<string, ReviewEntry>>;
  /** A3：退出 Formal 的卡的原独立审查结论（只增不改的历史留痕）。 */
  history: readonly ReviewHistoryEntry[];
  /** A3：本次退出 Formal 的批次登记。 */
  retirement: ReviewRetirement;
  packMachineVerdictSummary: PackVerdictSummary;
  libraryMachineVerdictSummary: VerdictGroupSummary;
  generatedBy: string;
}

/** TRUTH 内容包的两个固定分组键（`packMachineVerdictSummary.groups` 的固定键）。 */
export const TRUTH_FIRST_PACK_GROUP = "truthFirstPack";
export const TRUTH_BOOTSTRAP_GROUP = "truthBootstrap";
/**
 * A9 新增分组键：第一包重构批（Golden 12 + REWRITE 7 + REPLACE 19 + 补卡 14 = 52 张，
 * `PN-TRUTH-232~283`）。分组键是稳定标识，**不是数量**；张数一律由逐卡行派生。
 */
export const TRUTH_PACK1_ADMISSION_GROUP = "truthPack1Admission";

/**
 * 扩展脚本追加语里的人类可读标记（幂等锚点）。
 *
 * 追加类脚本必须**幂等**：反复重跑不得把「R3 追加」这段话叠成两遍
 * （旧版每跑一次 `reviewedAt` 就多一截）。追加前先 `stripAppendedSuffix()` 砍掉旧追加段。
 */
export const R3_APPEND_MARK = "R3 追加";

/**
 * 砍掉上一次追加的 R3 段落，回到「人写的原文」。没有该标记时原样返回。
 * 只按**首次**出现位置切分：即使历史上被叠了多遍，也能一次清干净。
 */
export function stripAppendedSuffix(text: string): string {
  const index = text.indexOf(R3_APPEND_MARK);
  if (index === -1) return text;
  return text.slice(0, index).replace(/[｜\s（(【]+$/u, "").trimEnd();
}

/**
 * 从逐卡机器档位行算出某组计数（**汇总的唯一算法**）。
 *
 * `ids` 里任一 cardId 在 `rows` 里缺行即抛错——这是「汇总必须来自逐卡数据、禁止手填」的
 * fail-closed 落点：没有逐卡证据就不许出现数字。
 */
export function tallyVerdicts(rows: readonly VerdictRow[], ids: readonly string[]): VerdictTally {
  const byId = new Map(rows.map((row) => [row.cardId, row.machineVerdict]));
  const tally: VerdictTally = { total: ids.length, PASS: 0, SUSPECT: 0, HARD_FAIL_PATTERN: 0 };
  for (const id of ids) {
    const verdict = byId.get(id);
    if (!verdict) throw new Error(`机器档位逐卡数据缺 ${id}：汇总必须从逐卡数据计算，禁止手填`);
    if (!MACHINE_VERDICTS.includes(verdict)) throw new Error(`${id}: 非法 machineVerdict ${JSON.stringify(verdict)}`);
    tally[verdict] += 1;
  }
  return tally;
}

/** 一组计数是否自洽：`total === PASS + SUSPECT + HARD_FAIL_PATTERN`。 */
export function isTallySelfConsistent(tally: VerdictTally): boolean {
  return tally.total === tally.PASS + tally.SUSPECT + tally.HARD_FAIL_PATTERN;
}

/**
 * 由逐卡机器档位**派生**分组 note 的事实片段（A9-R8）。
 *
 * 背景：truthFirstPack 曾手写「本组机器档位全部 PASS」，而同组实测 `SUSPECT=1`（203），
 * 构成自相矛盾谎报。本函数把「是否全部 PASS / 非 PASS 有哪几张」变成由逐卡数据算出：
 * - 全部 PASS 时才允许出现「全部 PASS」字样（并带 実测计数）；
 * - 有非 PASS 时必须逐张点名卡号与档位。
 *
 * 防回归：`checkReviewInput()` 的 `group-note-consistent` 项按同一口径校验产物 note
 * （写「全部 PASS」而非 0 非 PASS、或非 PASS 未点名卡号，均判不自洽）。
 */
export function deriveMachineVerdictNoteFragment(
  rows: readonly VerdictRow[],
  ids: readonly string[],
): string {
  const byId = new Map(rows.map((row) => [row.cardId, row.machineVerdict]));
  const tally = tallyVerdicts(rows, ids);
  const flagged = ids
    .filter((id) => byId.get(id) !== "PASS")
    .map((id) => `${id}=${byId.get(id)}`);
  if (flagged.length === 0) {
    return `机器档位全部 PASS（${tally.PASS}/${tally.total}，逐卡实读）`;
  }
  return `机器档位 PASS ${tally.PASS}/${tally.total}，非 PASS ${flagged.length} 张（${flagged.join("、")}，逐卡实读）`;
}

/** 构造一组汇总（数字一律来自 `tallyVerdicts`）。 */
export function buildGroupSummary(
  scope: string,
  source: string,
  note: string,
  rows: readonly VerdictRow[],
  ids: readonly string[],
): VerdictGroupSummary {
  return { scope, ...tallyVerdicts(rows, ids), source, note };
}

/**
 * 构造 `packMachineVerdictSummary`：父级数字 = 各子组逐项之和（父级**不单独手填**）。
 * 父级 `scope` / `note` 由调用方给，数字由 `groups` 汇总而来。
 */
export function buildPackSummary(
  scope: string,
  source: string,
  note: string,
  groups: Readonly<Record<string, VerdictGroupSummary>>,
): PackVerdictSummary {
  const tally: VerdictTally = { total: 0, PASS: 0, SUSPECT: 0, HARD_FAIL_PATTERN: 0 };
  for (const group of Object.values(groups)) {
    tally.total += group.total;
    tally.PASS += group.PASS;
    tally.SUSPECT += group.SUSPECT;
    tally.HARD_FAIL_PATTERN += group.HARD_FAIL_PATTERN;
  }
  return { scope, ...tally, source, note, groups };
}

/**
 * 逐卡条目指纹的**输入串**（稳定序列化，与对象字面量 key 顺序无关）。
 * 调用方对返回值取 sha256 即得「既有结论未被改动」的指纹。
 */
export function reviewEntriesFingerprintInput(
  entries: Readonly<Record<string, ReviewEntry>>,
  ids: readonly string[],
): string {
  const sorted = [...ids].sort();
  return JSON.stringify(
    sorted.map((id) => {
      const entry = entries[id];
      if (!entry) throw new Error(`指纹输入缺 entry：${id}`);
      return [id, entry.reviewed, entry.humanBarFit, entry.note];
    }),
  );
}

/**
 * 历史留痕指纹的**输入串**：把归档数组按 cardId 归一成记录，再走
 * `reviewEntriesFingerprintInput()` 的同一序列化（与对象字面量 key 顺序无关）。
 * 调用方对返回值取 sha256 即得「历史结论未被改动」的指纹。
 */
export function reviewHistoryFingerprintInput(
  history: readonly ReviewHistoryEntry[],
  ids: readonly string[],
): string {
  const byId = new Map(history.map((entry) => [entry.cardId, entry]));
  const record: Record<string, ReviewEntry> = {};
  for (const id of ids) {
    const entry = byId.get(id);
    if (!entry) throw new Error(`历史留痕缺 entry：${id}`);
    record[id] = { reviewed: entry.reviewed, humanBarFit: entry.humanBarFit, note: entry.note };
  }
  return reviewEntriesFingerprintInput(record, ids);
}

/**
 * 全部候选（第一包 24 + Bootstrap 7 = 31）独立审查结论的**冻结历史指纹**
 * （sha256 of `reviewHistoryFingerprintInput(history, ALL_CANDIDATE_IDS)`）。
 *
 * 生成脚本与单测都拿它做「退出 Formal 只改活跃 entries、历史一字未改」的锁：
 * 对不上即拒绝写盘 / 测试变红。
 *
 * 变更流程：只有 review 角色重审并**改写历史结论**时才允许连同本常量一起更新
 * （同时须记 HANDOFF）——单纯推进活跃状态（如退出 Formal）不得改本常量。
 */
export const FROZEN_REVIEW_HISTORY_SHA256 =
  "dc4b3c993fe2c728c57e79ab6568e749c130f55a7acf0994cd545226d08a7d7a";

/** 自校验期待值：候选卡清单（分组）＋整库卡清单＋逐卡机器档位行。 */
export interface ReviewSelfCheckExpectation {
  /** 审查输入应覆盖的全部候选卡（当前 = 第一包 24 + Bootstrap 7 = 31）。 */
  expectedCardIds: readonly string[];
  /** TRUTH 第一包分组（`TRUTH_FIRST_PACK_GROUP`）。 */
  firstPackIds: readonly string[];
  /** TRUTH Bootstrap 候选分组（`TRUTH_BOOTSTRAP_GROUP`）。 */
  bootstrapIds: readonly string[];
  /** 整库（`libraryMachineVerdictSummary` 的集合，当前 421）。 */
  libraryIds: readonly string[];
  /**
   * 可选追加分组（键 → 该组候选 ID）。A9 起用于「第一包重构批」等**后续批次**，
   * 使 `packMachineVerdictSummary.groups` 不必回改前两组的固定键即可扩展。
   * 未提供时行为与旧版逐字一致（只有 `truthFirstPack` / `truthBootstrap` 两组）。
   */
  extraGroups?: Readonly<Record<string, readonly string[]>>;
  /** 机器档位逐卡行（canonical 口径，整库覆盖）。 */
  verdictRows: readonly VerdictRow[];
}

export interface ReviewSelfCheckItem {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface ReviewSelfCheckResult {
  ok: boolean;
  items: ReviewSelfCheckItem[];
  violations: string[];
}

/** 统计每个 cardId 作为 `entries` 键出现的次数（用于抓 JSON 重复键——`JSON.parse` 会静默吞掉重复键）。 */
export function countEntryKeyOccurrences(rawJson: string, ids: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of ids) {
    const pattern = new RegExp(`"${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s*:`, "g");
    counts[id] = (rawJson.match(pattern) ?? []).length;
  }
  return counts;
}

const sortedIds = (ids: readonly string[]): string[] => [...ids].sort();

/**
 * 审查输入结构自校验（六条；任一条不成立即 `ok=false`，脚本据此非零退出）。
 *
 * 1. `entries-count`：逐卡条目数 = 候选总数（且键集恰为候选集，不多不少）。
 * 2. `card-id-unique`：cardId 唯一（给了 `rawJson` 时按磁盘原文数键出现次数，抓 JSON 重复键）。
 * 3. `reviewed-consistency`：每条 `reviewed === (humanBarFit !== "UNREVIEWED")`，且定档在枚举内。
 * 4. `summary-self-consistent`：各组 `total = PASS + SUSPECT + HARD_FAIL_PATTERN`；
 *    各组数字 == 由逐卡行重算的值；`packMachineVerdictSummary` 父级 == 各子组之和。
 * 5. `history-coverage`：历史归档恰好覆盖全部候选（每卡一条）；`retirement.cardIds` == 活跃
 *    `reviewed=false` 集合；退出 + 存活互补覆盖全部候选（退出 Formal 只改活跃 entries，不抹历史）。
 * 6. `group-note-consistent`：`packMachineVerdictSummary` 各分组的 note 与机器档位计数不得矛盾——
 *    note 写「全部 PASS」时该组实测非 PASS 必须为 0；实测非 PASS > 0 时 note 必须逐张点名卡号
 *    （A9-R8：防「全部 PASS」与 `SUSPECT=1` 并存的谎报）。
 *    （历史指纹的 sha256 比对在拥有 `node:crypto` 的调用方：生成脚本 + 单测。）
 */
export function checkReviewInput(
  payload: ReviewInputPayload,
  expectation: ReviewSelfCheckExpectation,
  rawJson?: string,
): ReviewSelfCheckResult {
  const items: ReviewSelfCheckItem[] = [];
  const entries = payload.entries;
  const entryIds = Object.keys(entries);
  const expected = sortedIds(expectation.expectedCardIds);

  /* ① 逐卡条目数 = 候选总数（键集也必须恰好相等，防「数量对但换了卡」） */
  {
    const actual = sortedIds(entryIds);
    const sameSet = actual.length === expected.length && actual.every((id, index) => id === expected[index]);
    const ok = entryIds.length === expected.length && sameSet;
    items.push({
      id: "entries-count",
      label: "逐卡条目数 = 候选总数",
      ok,
      detail: ok
        ? `entries ${entryIds.length} / 候选 ${expected.length}（键集一致）`
        : `entries ${entryIds.length} / 候选 ${expected.length}；仅 entries 有 ${actual.filter((id) => !expected.includes(id)).join(",") || "—"}；仅候选有 ${expected.filter((id) => !actual.includes(id)).join(",") || "—"}`,
    });
  }

  /* ② cardId 唯一 */
  {
    const duplicates: string[] = [];
    if (rawJson !== undefined) {
      const counts = countEntryKeyOccurrences(rawJson, expected);
      for (const id of expected) if (counts[id] !== 1) duplicates.push(`${id}×${counts[id]}`);
    }
    const uniqueOk = new Set(entryIds).size === entryIds.length;
    const ok = duplicates.length === 0 && uniqueOk;
    items.push({
      id: "card-id-unique",
      label: "cardId 唯一",
      ok,
      detail: ok
        ? rawJson === undefined
          ? `entries 键 ${entryIds.length} 个，无重复`
          : `磁盘原文里 ${expected.length} 个候选 cardId 键各出现 1 次`
        : `重复/异常：${duplicates.join(",") || "无（原文）"}；内存键重复=${!uniqueOk}`,
    });
  }

  /* ③ reviewed 与 humanBarFit 自洽 */
  {
    const bad: string[] = [];
    for (const [cardId, entry] of Object.entries(entries)) {
      if (entry.reviewed !== (entry.humanBarFit !== "UNREVIEWED")) bad.push(`${cardId}(reviewed=${entry.reviewed},humanBarFit=${entry.humanBarFit})`);
      if (!FIXED_HUMAN_BAR_FITS.includes(entry.humanBarFit)) bad.push(`${cardId}(非法定档 ${JSON.stringify(entry.humanBarFit)})`);
    }
    items.push({
      id: "reviewed-consistency",
      label: "每条 reviewed === (humanBarFit !== \"UNREVIEWED\")",
      ok: bad.length === 0,
      detail: bad.length === 0 ? `${Object.keys(entries).length} 条全部自洽` : bad.join("；"),
    });
  }

  /* ④ 各汇总组求和自洽（数字必须等于逐卡行重算值） */
  {
    const bad: string[] = [];
    const { firstPackIds, bootstrapIds, libraryIds } = expectation;
    const expectedGroups: Record<string, readonly string[]> = {
      [TRUTH_FIRST_PACK_GROUP]: firstPackIds,
      [TRUTH_BOOTSTRAP_GROUP]: bootstrapIds,
      ...(expectation.extraGroups ?? {}),
    };
    const pack = payload.packMachineVerdictSummary;
    const groupKeys = Object.keys(pack.groups ?? {});
    for (const key of Object.keys(expectedGroups)) {
      if (!groupKeys.includes(key)) bad.push(`缺分组 ${key}`);
    }
    for (const key of groupKeys) {
      const group = pack.groups[key]!;
      const ids = expectedGroups[key];
      if (!ids) {
        bad.push(`多余分组 ${key}`);
        continue;
      }
      if (!isTallySelfConsistent(group)) bad.push(`${key} 求和不自洽：${group.total} ≠ ${group.PASS}+${group.SUSPECT}+${group.HARD_FAIL_PATTERN}`);
      const recomputed = tallyVerdicts(expectation.verdictRows, ids);
      if (JSON.stringify(recomputed) !== JSON.stringify({ total: group.total, PASS: group.PASS, SUSPECT: group.SUSPECT, HARD_FAIL_PATTERN: group.HARD_FAIL_PATTERN })) {
        bad.push(`${key} 与逐卡重算不符：产物 ${JSON.stringify(group)} ≠ 重算 ${JSON.stringify(recomputed)}`);
      }
    }
    // 父级 = 各子组之和
    const sum = Object.values(pack.groups ?? {}).reduce(
      (acc, group) => ({
        total: acc.total + group.total,
        PASS: acc.PASS + group.PASS,
        SUSPECT: acc.SUSPECT + group.SUSPECT,
        HARD_FAIL_PATTERN: acc.HARD_FAIL_PATTERN + group.HARD_FAIL_PATTERN,
      }),
      { total: 0, PASS: 0, SUSPECT: 0, HARD_FAIL_PATTERN: 0 },
    );
    if (JSON.stringify(sum) !== JSON.stringify({ total: pack.total, PASS: pack.PASS, SUSPECT: pack.SUSPECT, HARD_FAIL_PATTERN: pack.HARD_FAIL_PATTERN })) {
      bad.push(`packMachineVerdictSummary 父级 ≠ 各子组之和：产物 ${JSON.stringify({ total: pack.total, PASS: pack.PASS, SUSPECT: pack.SUSPECT, HARD_FAIL_PATTERN: pack.HARD_FAIL_PATTERN })} ≠ 求和 ${JSON.stringify(sum)}`);
    }
    if (!isTallySelfConsistent(pack)) bad.push(`packMachineVerdictSummary 求和不自洽：${pack.total} ≠ ${pack.PASS}+${pack.SUSPECT}+${pack.HARD_FAIL_PATTERN}`);
    // library 组
    const library = payload.libraryMachineVerdictSummary;
    if (!isTallySelfConsistent(library)) bad.push(`library 求和不自洽：${library.total} ≠ ${library.PASS}+${library.SUSPECT}+${library.HARD_FAIL_PATTERN}`);
    const recomputedLibrary = tallyVerdicts(expectation.verdictRows, libraryIds);
    if (JSON.stringify(recomputedLibrary) !== JSON.stringify({ total: library.total, PASS: library.PASS, SUSPECT: library.SUSPECT, HARD_FAIL_PATTERN: library.HARD_FAIL_PATTERN })) {
      bad.push(`library 与逐卡重算不符：产物 ${JSON.stringify(library)} ≠ 重算 ${JSON.stringify(recomputedLibrary)}`);
    }
    items.push({
      id: "summary-self-consistent",
      label: "各汇总组求和自洽（且 == 逐卡重算）",
      ok: bad.length === 0,
      detail: bad.length === 0
        ? `pack 父级 ${pack.total} = ${Object.keys(pack.groups ?? {}).join(" + ")} 之和；library ${library.total}；均与逐卡重算一致`
        : bad.join("；"),
    });
  }

  /* ⑤ 历史归档覆盖 + 退出登记与活跃状态一致（A3：退出 Formal 不得抹历史、不得与活跃状态脱节） */
  {
    const bad: string[] = [];
    const history = payload.history ?? [];
    const byId = new Map<string, ReviewHistoryEntry>();
    for (const entry of history) {
      if (byId.has(entry.cardId)) bad.push(`history 重复 cardId ${entry.cardId}`);
      byId.set(entry.cardId, entry);
    }
    for (const id of expected) if (!byId.has(id)) bad.push(`history 缺 ${id}`);
    for (const entry of history) if (!expected.includes(entry.cardId)) bad.push(`history 多余 ${entry.cardId}`);

    // 退出登记 cardIds 必须派生自活跃状态：恰为 `reviewed=false` 的候选集合。
    const activeRetired = expected.filter((id) => entries[id]?.reviewed === false).sort();
    const declaredRetired = [...(payload.retirement?.cardIds ?? [])].sort();
    const sameSet =
      declaredRetired.length === activeRetired.length &&
      declaredRetired.every((id, index) => id === activeRetired[index]);
    if (!sameSet) {
      bad.push(
        `retirement.cardIds 与活跃 reviewed=false 集合不一致：登记 ${declaredRetired.join(",") || "—"} ≠ 活跃 ${activeRetired.join(",") || "—"}`,
      );
    }
    // 退出 + 存活的并集必须恰好覆盖全部候选（无遗漏、无重复）。
    const activeReviewed = expected.filter((id) => entries[id]?.reviewed === true).sort();
    if (activeReviewed.length + activeRetired.length !== expected.length) {
      bad.push(`退出 ${activeRetired.length} + 存活 ${activeReviewed.length} ≠ 候选 ${expected.length}`);
    }
    items.push({
      id: "history-coverage",
      label: "历史归档覆盖全部候选，且退出登记 == 活跃 reviewed=false 集合",
      ok: bad.length === 0,
      detail:
        bad.length === 0
          ? `history ${history.length} 条覆盖 ${expected.length} 候选；退出 ${declaredRetired.length} / 存活 ${activeReviewed.length}`
          : bad.join("；"),
    });
  }

  /* ⑥ 分组 note 与机器档位计数不得矛盾（A9-R8：非 0 非 PASS 不许写「全部 PASS」；非 PASS 必须点名卡号） */
  {
    const bad: string[] = [];
    const expectedGroups: Record<string, readonly string[]> = {
      [TRUTH_FIRST_PACK_GROUP]: expectation.firstPackIds,
      [TRUTH_BOOTSTRAP_GROUP]: expectation.bootstrapIds,
      ...(expectation.extraGroups ?? {}),
    };
    const byId = new Map(expectation.verdictRows.map((row) => [row.cardId, row.machineVerdict]));
    for (const [key, group] of Object.entries(payload.packMachineVerdictSummary?.groups ?? {})) {
      const ids = expectedGroups[key];
      if (!ids) continue; // 多余分组已由 ④ 报过，这里不重复计。
      const nonPass = ids.filter((id) => byId.get(id) !== "PASS");
      const note = group.note ?? "";
      if (nonPass.length === 0) continue; // 全 PASS 组无此约束（写不写「全部 PASS」均不算矛盾）。
      if (note.includes("全部 PASS")) {
        bad.push(`${key} note 写「全部 PASS」但机器档位实测非 PASS ${nonPass.length} 张（${nonPass.join(",")}）`);
      }
      const unnamed = nonPass.filter((id) => !note.includes(id));
      if (unnamed.length > 0) {
        bad.push(`${key} note 未逐张点名非 PASS 卡号：${unnamed.join(",")}`);
      }
    }
    items.push({
      id: "group-note-consistent",
      label: "分组 note 与机器档位计数不矛盾（非 0 不许写「全部 PASS」；非 PASS 必须点名卡号）",
      ok: bad.length === 0,
      detail: bad.length === 0 ? `pack ${Object.keys(payload.packMachineVerdictSummary?.groups ?? {}).length} 组 note 与逐卡实测一致` : bad.join("；"),
    });
  }

  const violations = items.filter((item) => !item.ok).map((item) => `[${item.id}] ${item.label} → ${item.detail}`);
  return { ok: violations.length === 0, items, violations };
}
