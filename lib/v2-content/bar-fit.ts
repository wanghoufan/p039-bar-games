/**
 * BAR-FIT 酒吧适配机制（真源：`docs/pm/PRODUCT_PLAN_V2.2-FIXED-CONTENT-FIRST.md` §2）。
 *
 * 环境基线（Plan §2）：DJ/音乐吵、典型 4–5 人、有人微醺且情绪较高、不愿听长规则，
 * 不适合安静思考、复杂表演或现场创作。硬判据唯一一句话：
 * **「在一个很吵的酒吧里，这道题能不能 10 秒内听懂并马上开始？」**
 *
 * ## 本模块只做机器预筛，且**机器结论与人工定档分层**（P1-4）
 *
 * Plan §2 明说「机器抽检不能替代双人模拟噪声计时」。因此本模块输出**两个互不替代**的字段：
 *
 * | 字段 | 取值 | 谁写 | 含义 |
 * |---|---|---|---|
 * | `machineVerdict` | `PASS` / `SUSPECT` / `HARD_FAIL_PATTERN` | 本模块（机器） | 机器**预筛**结论，只用于分流，**不是**正式判定 |
 * | `humanBarFit` | `UNREVIEWED` / `PASS` / `BORDERLINE` / `FAIL` | 人工双人噪声计时/动作审查 | **正式**定档；机器阶段恒为 `UNREVIEWED` |
 *
 * 分流规则（本模块的核心约束）：
 * - 命中 `HF-*`（Human 点名的硬失败**类型**：偶像剧/小品/你画我猜/推销广告/现场创作/
 *   复杂复述/依赖安静/长表演/交设备/回忆式模仿）→ `machineVerdict = HARD_FAIL_PATTERN`
 *   —— 这是 **hard-fail 候选**，仍待人工确认，机器**不执行删除**、不改题面。
 * - 命中 `CF-*`（纯估算：朗读秒数、开场动作数、必需说明长度）或 `BR-*`（词面疑似）
 *   → `machineVerdict = SUSPECT`，**只进人工复核池**。
 * - 无任何命中 → `PASS`。
 *
 * ⚠️ **`SUSPECT` 不得被读成「这题有问题」**：它只表示「该题应被人工复核」。
 * 例如种子库 `SUSPECT 49.1%` 的正确解释是「49.1% 的题进入人工复核池」，
 * **不是**「49.1% 的题有 BAR-FIT 问题」。
 *
 * ⚠️ **`CF-*` 永不产生正式 FAIL**：`READ_CHARS_PER_SECOND = 4` 与动作桶计数都是**估算**，
 * 不是实测值；按 Plan §2 只能作疑似清单，正式 t/a 由双人模拟噪声计时给出。
 * 本模块不导出任何 `level = FAIL` 直出字段，避免下游自动化把「机器疑似」当正式删除判据。
 *
 * ## 设计原则
 * 1. **数据驱动**：所有词法判据写成可维护的规则表 `BAR_FIT_RULES`，不散落成 if-else；
 *    新增/调整判据只改表，不动判定函数。
 * 2. **可解释**：每次判定返回命中的 `ruleHits`（规则 ID）、按分流拆开的
 *    `hardFailPatternHits` / `suspectHits`，以及 `reasons`（人读理由），
 *    并附带 `metrics`（朗读秒数估算、开场动作数估算）供审计对账。
 * 3. **确定性**：纯函数、无随机、无时间依赖；同输入多次调用结果完全一致。
 * 4. **保守优先**：命中硬失败类型即标 `HARD_FAIL_PATTERN`（候选），不靠阈值豁免（Plan §2）。
 *
 * 注：本模块零依赖（不 import 业务层），可被测试与只读审计脚本安全引用。
 */

/** 机器预筛结论（本模块直出；**不是**正式判定，不得当删除判据）。 */
export type MachineVerdict = "PASS" | "SUSPECT" | "HARD_FAIL_PATTERN";

/**
 * 独立审查的 BAR-FIT 定档（双人模拟噪声计时 / 动作审查结论）。
 * 机器预筛阶段一律为 `UNREVIEWED`，只有独立审查后才写正式值。
 * ⚠️ `humanBarFit` / `HumanBarFit` 为**历史兼容字段/类型名**，不代表 reviewer 必然是 Human
 * （身份见 `FixedContentManifest.buildInfo.reviewerKind`）。
 */
export type HumanBarFit = "UNREVIEWED" | "PASS" | "BORDERLINE" | "FAIL";

/** 判定口径常量（Plan §2 候选阈值，Human Gate 可调）。 */
export const BAR_FIT_THRESHOLDS = {
  /** 很吵的酒吧里主持人放慢朗读的估算速度（字/秒）。 */
  READ_CHARS_PER_SECOND: 4,
  /** PASS 上限：t ≤ 10s。 */
  PASS_MAX_READ_SECONDS: 10,
  /** BORDERLINE 上限：t ≤ 15s。 */
  BORDERLINE_MAX_READ_SECONDS: 15,
  /** PASS 上限：a ≤ 2（听题后选择/作答算 1；必要同意确认可算第 2 步）。 */
  PASS_MAX_START_ACTIONS: 2,
  /** BORDERLINE 上限：a ≤ 3。 */
  BORDERLINE_MAX_START_ACTIONS: 3,
  /** 单条必需说明超过这个字数，视为「需要长规则说明」。 */
  LONG_INSTRUCTION_CHARS: 40,
} as const;

/** 判定输入：题面正文 + 必需说明（Plan §2：阅读正文和必需说明均计入，不能藏在 instruction 中）。 */
export interface BarFitCard {
  cardId?: string;
  gameType?: string;
  /** SSOT 卡用 `text`。 */
  text?: string;
  /** 内置种子卡用 `content`；与 `text` 二选一。 */
  content?: string;
  /** 卡面必需说明（同意/可跳过/流程说明等）。 */
  instruction?: string;
}

export interface BarFitMetrics {
  /** 计入朗读的总字数（正文 + 必需说明）。 */
  charCount: number;
  /** 必需说明单独的字数。 */
  instructionCharCount: number;
  /** 朗读秒数估算 = charCount / READ_CHARS_PER_SECOND，保留 1 位小数（估算，非实测）。 */
  readSeconds: number;
  /** 开场动作数估算：从听到题到知道第一个动作，需要几类动作（估算，非实测）。 */
  startActions: number;
  /** 开场动作数估算的构成说明（每个 +1 的来源）。 */
  actionBreakdown: string[];
}

export interface BarFitResult {
  /** 机器预筛结论。只做分流，**不得**当正式 FAIL。 */
  machineVerdict: MachineVerdict;
  /** 独立审查定档（`humanBarFit` 为历史兼容字段名）；机器预筛阶段恒为 `UNREVIEWED`。 */
  humanBarFit: HumanBarFit;
  /** 人读理由，顺序与 `ruleHits` 一一对应（硬失败候选在前，其次复核池）。 */
  reasons: string[];
  /** 命中的规则 ID（stable，供统计与复核）。 */
  ruleHits: string[];
  /** 命中 `HF-*`（hard-fail 候选）的规则 ID；是 `ruleHits` 的子集。 */
  hardFailPatternHits: string[];
  /** 命中 `BR-*` / `CF-*`（人工复核池）的规则 ID；是 `ruleHits` 的子集。 */
  suspectHits: string[];
  metrics: BarFitMetrics;
}

/* -------------------------------------------------------------------------- */
/* 规则表（数据驱动）                                                          */
/* -------------------------------------------------------------------------- */

export interface BarFitRule {
  /** 稳定规则 ID，出现在 `ruleHits` 里。 */
  id: string;
  /** 人读规则名。 */
  label: string;
  /** 命中后的机器结论分流（只可能是 `HARD_FAIL_PATTERN` 或 `SUSPECT`）。 */
  severity: Exclude<MachineVerdict, "PASS">;
  /** 判据说明：这条规则在防什么。 */
  description: string;
  /** 命中即触发（任一 pattern 命中）。 */
  patterns: RegExp[];
  /** 命中后写入 reasons 的理由模板。 */
  reason: string;
}

/**
 * BAR-FIT 规则表（词法侧）。
 *
 * `HARD_FAIL_PATTERN`（原 FAIL）对应 Plan §2 的硬失败**类型**清单：
 * 偶像剧表演 / 即兴小品 / 推销空气·椅子·不存在产品 / 编广告词 / 方言表演 /
 * 恋综名场面模仿 / 你画我猜 / 长时间表演 / 复杂记忆 / 现场创作 / 依赖安静。
 * 每一条都**不做润色复活**（Plan §2）——但机器只标「hard-fail 候选」，删除由人工定档后执行。
 *
 * `SUSPECT`（原 BORDERLINE）是「噪声下有歧义但机制仍简单」或「纯长度/动作估算」的疑似信号：
 * 机器只负责列**人工复核池**，最终由双人模拟噪声计时与人工复核定档。
 */
export const BAR_FIT_RULES: readonly BarFitRule[] = [
  /* ----------------------------- 硬失败候选：表演类 ----------------------------- */
  {
    id: "HF-THEATER-PERFORM",
    label: "剧场式表演（偶像剧／小品／方言／恋综名场面／现场演）",
    severity: "HARD_FAIL_PATTERN",
    description: "要求现场当众演戏、演短剧、模仿名场面或方言表演；酒吧噪声下无法完成。",
    patterns: [
      /偶像剧|恋综|名场面|方言|小品|话剧|情景剧|舞台剧|短剧/,
      /演戏|现场演|即兴表演|即兴剧|演一出|演一场|演一段|演一[下个]|演给|照着演/,
    ],
    reason: "命中硬失败类型「剧场式表演／即兴小品／名场面模仿／方言表演」，酒吧噪声下不可完成 → hard-fail 候选，待人工噪声计时定档（机器不执行删除）。",
  },
  {
    id: "HF-PERFORM-GUESS",
    label: "先演后猜（你演我猜）",
    severity: "HARD_FAIL_PATTERN",
    description: "由一人现场表演、他人猜测，属你画我猜同型；依赖安静观察与表演时间。",
    patterns: [/演[^。；，]*猜/, /猜[^。；，]*演/, /模仿[^。；，]*猜/],
    reason: "命中硬失败类型「你演我猜」（与「你画我猜」同型），依赖表演与安静观察 → hard-fail 候选，待人工定档。",
  },
  {
    id: "HF-DRAW-GUESS",
    label: "画／比划再猜（你画我猜）",
    severity: "HARD_FAIL_PATTERN",
    description: "现场绘画、空中画图或比划后由他人猜；Plan §2 明列 PN-DARE-005 为此类 FAIL。",
    patterns: [
      /你画我猜|画图|画画|画一[张个幅]|空中画|画下来|画出来|涂鸦/,
      /比划[^。；，]*猜|猜[^。；，]*比划|画[^。；，]*猜|猜[^。；，]*画/,
    ],
    reason: "命中硬失败类型「你画我猜」：现场作画／比划再猜，酒吧噪声下不可完成 → hard-fail 候选，待人工定档。",
  },
  {
    id: "HF-AD-PITCH",
    label: "推销／编广告词",
    severity: "HARD_FAIL_PATTERN",
    description: "推销空气／椅子／不存在产品，或现场编广告词、带货；属剧场式创作表演。",
    patterns: [
      /推销|广告词|广告语|带货|打广告|促销|卖空气|卖椅子/,
      /不存在的(产品|商品|东西)|虚假(产品|广告)|编[^。；，]*广告/,
    ],
    reason: "命中硬失败类型「推销不存在产品／编广告词」，属现场创作型表演 → hard-fail 候选，待人工定档。",
  },
  /* ----------------------------- 硬失败候选：创作类 ----------------------------- */
  {
    id: "HF-LIVE-CREATE",
    label: "现场创作（编词／押韵／写段子）",
    severity: "HARD_FAIL_PATTERN",
    description: "现场编歌编词、押韵口号、顺口溜、写诗写段子；需要安静构思与创作时间。",
    patterns: [
      /现场创作|即兴创作|即兴编|当场编|现场编/,
      /编一首|写一首|创作一首|编一段|编一句|编个|写词|编词|编歌/,
      /押韵|顺口溜|原创[^。；，]*(歌|诗|段子)|现场[^。；，]*(写|编|创作|作词|作曲)/,
    ],
    reason: "命中硬失败类型「现场创作」（编词／押韵／写段子），需要安静构思 → hard-fail 候选，待人工定档。",
  },
  /* ----------------------------- 硬失败候选：记忆类 ----------------------------- */
  {
    id: "HF-HARD-MEMORY",
    label: "复杂记忆／复述",
    severity: "HARD_FAIL_PATTERN",
    description: "复述他人原话、背诵、记住整桌信息（杯中内容／生日／顺序）；Plan §2 明列两例 FAIL。",
    patterns: [
      /复述|背诵|背出|倒背|一字不差|凭记忆|默写/,
      /(你|自己|得票者|现在|当场|每人|轮流)[^。；，]*记住[^。；，]*(全部|所有|每一|每个人|几个|多少|顺序|内容|名字|生日)/,
      /说出[^。；，]*(每个人|所有人)[^。；，]*(杯|名字|生日|内容)/,
      /(杯里|杯中|杯子)[^。；，]*(装|是)什么/,
    ],
    reason: "命中硬失败类型「复杂记忆／复述」：依赖工作记忆，微醺＋噪声下不可靠 → hard-fail 候选，待人工定档。",
  },
  /* --------------------------- 硬失败候选：安静依赖 ---------------------------- */
  {
    id: "HF-QUIET-DEPENDENT",
    label: "依赖「大家安静下来听」",
    severity: "HARD_FAIL_PATTERN",
    description: "要求全场安静、不许出声、比谁先说话、保持沉默；酒吧环境天然不满足。",
    patterns: [
      /安静下来|保持安静|全场安静|大家安静|需要安静|静下来/,
      /不要出声|不能出声|不许出声|别出声|保持沉默|静默/,
      /谁先说话|先说话[^。；，]*(输|罚|做|算)/,
    ],
    reason: "命中硬失败类型「依赖安静」：需要大家安静下来／不许出声才能完成，酒吧噪声下不可行 → hard-fail 候选，待人工定档。",
  },
  /* ------------------------ 硬失败候选：长时间表演／设备 ------------------------ */
  {
    id: "HF-LONG-PERFORM",
    label: "长时间表演（整首／整段）",
    severity: "HARD_FAIL_PATTERN",
    description: "唱整首、跳整段、完整表演一段；占用时间长且属复杂表演。",
    patterns: [
      /舞蹈|跳舞|跳一[段支]/,
      /整首歌|唱整首|唱完整|完整[^。；，]*(歌|舞|表演|唱)/,
      /表演[^。；，]*(十秒|半分钟|一分钟|两分钟|三分钟|以上|一段)/,
    ],
    reason: "命中硬失败类型「长时间表演」，超出 10 秒上手门槛 → hard-fail 候选，待人工定档。",
  },
  {
    id: "HF-EXTERNAL-DEVICE",
    label: "交出设备由他人操作",
    severity: "HARD_FAIL_PATTERN",
    description: "把手机交出去让别人替你选歌／点东西；外部操作叠加表演，Plan §2 明列 seed dare-9 为 FAIL。",
    patterns: [/把手机交|手机交[给到]|交出手机|递手机/, /让他\/她替你|替你选|让他\/她替你选/],
    reason: "命中硬失败类型「外部设备操作」（交手机让他人替你选），流程被拉长且夹表演 → hard-fail 候选，待人工定档。",
  },
  {
    id: "HF-PERFORM-RECALL",
    label: "需要回忆的模仿／表演",
    severity: "HARD_FAIL_PATTERN",
    description: "模仿「对方刚才／今晚最典型的动作」，先回忆再表演，属复杂表演＋记忆。",
    patterns: [
      /模仿[^。；，]*(刚才|之前|今晚|最典型|最有代表性|最有名|上一次|曾经)/,
      /(刚才|今晚|之前)[^。；，]*(最典型|最有代表性|最有名)[^。；，]*动作/,
    ],
    reason: "命中硬失败类型「需要回忆的模仿」：先回忆他人过往动作再现场表演 → hard-fail 候选，待人工定档（简单即时同步手势不在此列，见 BR-SIMPLE-PERFORM）。",
  },

  /* --------------------------- 人工复核池（SUSPECT） --------------------------- */
  {
    id: "BR-SIMPLE-PERFORM",
    label: "简单即时动作／模仿（疑似，进复核池）",
    severity: "SUSPECT",
    description: "单个即时手势、跟着做、同步动作；机制仍简单，但动作门槛需人工复测。",
    patterns: [
      /模仿|学[^。；，]*(动作|样子)|跟着[^。；，]*(做|说)|同步[^。；，]*动作/,
      /比划|做一个[^。；，]*动作|口技/,
    ],
    reason: "疑似「简单动作／模仿」：单次即时动作机制仍简单，但需双人模拟噪声复测动作门槛 → 只进人工复核池，非正式判据。",
  },
  {
    id: "BR-MEMORY-SIMPLE",
    label: "需要回忆／默记（疑似，进复核池）",
    severity: "SUSPECT",
    description: "记住、记得、回忆、想起、复盘；非复述级记忆，但候选池仍需人工确认是否构成负担。",
    patterns: [
      /(你|自己|得票者|现在|当场|每人|轮流|两人)[^。；，]*(记住|记得|默记|回忆|想起|复盘)/,
      /记得[^。；，]*(一次|一件|什么|哪|当时)/,
      /回忆[^。；，]*(一次|一件|什么)|想不起来|默记/,
    ],
    reason: "疑似「轻量记忆／回忆」：机制未到复述级，但微醺下可能需要额外时间 → 只进人工复核池，非正式判据。",
  },
  {
    id: "BR-COUNT-RECALL",
    label: "需要心算／清点（疑似，进复核池）",
    severity: "SUSPECT",
    description: "心算、算账、数数；需要低头专注，与酒吧「马上能玩」冲突。",
    patterns: [/心算|算一[算遍下]|数一[数遍下]|数出|数清|数[一不]?(遍|下)/],
    reason: "疑似「心算／清点」：需要短时专注，噪声下可能卡壳 → 只进人工复核池，非正式判据。",
  },
  {
    id: "BR-MULTI-STEP-FLOW",
    label: "多步流程（疑似，进复核池）",
    severity: "SUSPECT",
    description: "先…再…然后、第一步/第二步；显式三步以上流程会拉长上手时间。",
    patterns: [/先[^。；，]*再[^。；，]*然后/, /第一步|第二步|第三步|接着[^。；，]*最后/],
    reason: "疑似「多步流程」：显式三步以上，10 秒上手风险上升 → 只进人工复核池，非正式判据。",
  },
  {
    id: "BR-LIVE-NAMING",
    label: "现场命名（轻创作，疑似，进复核池）",
    severity: "SUSPECT",
    description: "起个名字、取名字；轻量创作，不需要长时间构思但仍属临场生成。",
    patterns: [/起个名字|取个名字|起一个名|取名|起名|定一个名字|想一个名|起个群名/],
    reason: "疑似「现场命名」：属轻量临场创作 → 只进人工复核池，非正式判据。",
  },
  {
    id: "BR-DEVICE-STEP",
    label: "需要动手机／设备（疑似，进复核池）",
    severity: "SUSPECT",
    description: "打开手机、翻相册、看聊天记录；多一步外部操作，可能打断节奏。",
    patterns: [/手机|相册|聊天记录|翻看.*记录/],
    reason: "疑似「需要动手机／设备」：多一步外部操作可能打断节奏 → 只进人工复核池，非正式判据。",
  },
];

/* -------------------------------------------------------------------------- */
/* 开场动作数估算（计算型规则）                                                */
/* -------------------------------------------------------------------------- */

/** 每类动作桶命中即 +1；桶之间互不重复计数。 */
const ACTION_BUCKETS: ReadonlyArray<{ label: string; patterns: RegExp[] }> = [
  {
    label: "选择／点名对象",
    patterns: [/选(一位|一个|一名|在场|在座|个)/, /点[名到]/, /指名/, /挑[选一]/, /指[一个位]/],
  },
  {
    label: "身体动作／移动／物品交换",
    patterns: [
      /碰杯|击掌|拥抱|牵手|对视|靠近|面对面|站起来|走到|拿起|举起|递|交换|换位置/,
      /坐下|坐[到在]|搭肩|拍|摸|整理|公主抱|牵[住手]|碰[一了]/,
    ],
  },
  {
    label: "表演／创作／现场制作",
    patterns: [
      /模仿|表演|演戏|现场演|演一[出段场个]|演给/,
      /唱一[句首段]|唱整|唱完|唱歌|跳舞|舞蹈/,
      /姿势|定格|押韵|即兴创作|现场创作/,
      /画一[张个幅]|画图|画画|画下|画出|写一[句首段]|写下|写出|编一[句首段个]|编词|编歌/,
    ],
  },
  {
    label: "引入桌外人／设备／全场同步",
    patterns: [/不认识的人|陌生人|手机|请一位/],
  },
];

const matchesAny = (text: string, patterns: readonly RegExp[]): boolean => patterns.some((pattern) => pattern.test(text));

const countConnectors = (text: string): number => {
  const matches = text.match(/再|然后|接着|最后|之后/g);
  return matches ? matches.length : 0;
};

/**
 * 估算开场动作数 `a`（Plan §2：听题后选择/作答算 1；必要同意确认可算第 2 步）。
 *
 * 这是**估算**不是实测：基础 1 = 听题并做出第一个反应（选择或作答），
 * 再按动作桶逐类 +1；显式出现两组以上步骤连接词时再 +1（多步流程）。
 * 结果与构成一并返回，供审计对账与人工复核。
 */
export function estimateStartActions(text: string, instruction: string): { actions: number; breakdown: string[] } {
  const hay = `${text}\n${instruction}`;
  const breakdown: string[] = ["听题并做出第一个反应（选择或作答）"];
  let actions = 1;

  for (const bucket of ACTION_BUCKETS) {
    if (matchesAny(hay, bucket.patterns)) {
      actions += 1;
      breakdown.push(`+1 ${bucket.label}`);
    }
  }

  if (countConnectors(hay) >= 2) {
    actions += 1;
    breakdown.push("+1 显式多步流程（先…再…然后）");
  }

  return { actions, breakdown };
}

/** 朗读秒数估算：正文与必需说明均计入（Plan §2）。估算值，非实测。 */
export function estimateReadSeconds(charCount: number): number {
  const seconds = charCount / BAR_FIT_THRESHOLDS.READ_CHARS_PER_SECOND;
  return Math.round(seconds * 10) / 10;
}

/* -------------------------------------------------------------------------- */
/* 判定                                                                        */
/* -------------------------------------------------------------------------- */

const normalizeText = (value: string | undefined): string => (typeof value === "string" ? value : "");

/** 计算型规则 ID（纯估算）：这些 ID 只可能进人工复核池，永不产生正式 FAIL。 */
export const COMPUTED_RULE_IDS = [
  "CF-READ-TIME",
  "CF-READ-TIME-SOFT",
  "CF-START-ACTIONS",
  "CF-START-ACTIONS-SOFT",
  "CF-LONG-INSTRUCTION",
] as const;

/**
 * 判定一张卡的机器预筛结论。
 *
 * 判定顺序（可解释、确定性）：
 * 1. 词法规则表 `BAR_FIT_RULES` 逐条匹配 → 按 `severity` 分流写进
 *    `hardFailPatternHits`（HF-*）/ `suspectHits`（BR-*），并同步进 `ruleHits` / `reasons`；
 * 2. 计算型规则（朗读秒数、开场动作数、长规则说明）→ 一律进 `suspectHits`（复核池）；
 * 3. `machineVerdict` 取最严重值：任一 HF-* 命中 → `HARD_FAIL_PATTERN`；
 *    否则任一疑似命中 → `SUSPECT`；否则 `PASS`。
 *
 * `humanBarFit` 恒为 `UNREVIEWED`：正式定档只能由独立审查给出，
 * 机器不得代写（Plan §2）。
 */
export function judgeBarFit(card: BarFitCard): BarFitResult {
  const text = normalizeText(card.text) || normalizeText(card.content);
  const instruction = normalizeText(card.instruction);
  const hay = `${text}\n${instruction}`;

  const hardFailPatternHits: string[] = [];
  const hardFailReasons: string[] = [];
  const suspectHits: string[] = [];
  const suspectReasons: string[] = [];

  for (const rule of BAR_FIT_RULES) {
    if (!matchesAny(hay, rule.patterns)) continue;
    if (rule.severity === "HARD_FAIL_PATTERN") {
      hardFailPatternHits.push(rule.id);
      hardFailReasons.push(rule.reason);
    } else {
      suspectHits.push(rule.id);
      suspectReasons.push(rule.reason);
    }
  }

  const charCount = `${text}${instruction}`.length;
  const instructionCharCount = instruction.length;
  const readSeconds = estimateReadSeconds(charCount);
  const { actions: startActions, breakdown } = estimateStartActions(text, instruction);

  // 计算型疑似：全部进人工复核池，**不产生正式 FAIL**（纯估算，Plan §2）。
  if (readSeconds > BAR_FIT_THRESHOLDS.BORDERLINE_MAX_READ_SECONDS) {
    suspectHits.push("CF-READ-TIME");
    suspectReasons.push(
      `朗读时长**估算** ${readSeconds}s > ${BAR_FIT_THRESHOLDS.BORDERLINE_MAX_READ_SECONDS}s（估算，非双人实测）；超出 10 秒上手门槛疑似 → 只进人工复核池，非正式 FAIL。`,
    );
  } else if (readSeconds > BAR_FIT_THRESHOLDS.PASS_MAX_READ_SECONDS) {
    suspectHits.push("CF-READ-TIME-SOFT");
    suspectReasons.push(
      `朗读时长**估算** ${readSeconds}s 落在 ${BAR_FIT_THRESHOLDS.PASS_MAX_READ_SECONDS}–${BAR_FIT_THRESHOLDS.BORDERLINE_MAX_READ_SECONDS}s 压线 → 只进人工复核池，非正式判据。`,
    );
  }
  if (startActions > BAR_FIT_THRESHOLDS.BORDERLINE_MAX_START_ACTIONS) {
    suspectHits.push("CF-START-ACTIONS");
    suspectReasons.push(
      `开场动作数**估算** ${startActions} > ${BAR_FIT_THRESHOLDS.BORDERLINE_MAX_START_ACTIONS}（估算，非实测）；需多类动作才能开始疑似 → 只进人工复核池，非正式 FAIL。`,
    );
  } else if (startActions === BAR_FIT_THRESHOLDS.BORDERLINE_MAX_START_ACTIONS) {
    suspectHits.push("CF-START-ACTIONS-SOFT");
    suspectReasons.push(
      `开场动作数**估算** ${startActions} = ${BAR_FIT_THRESHOLDS.BORDERLINE_MAX_START_ACTIONS}（PASS 上限 ${BAR_FIT_THRESHOLDS.PASS_MAX_START_ACTIONS}）压线 → 只进人工复核池，非正式判据。`,
    );
  }
  if (instructionCharCount > BAR_FIT_THRESHOLDS.LONG_INSTRUCTION_CHARS) {
    suspectHits.push("CF-LONG-INSTRUCTION");
    suspectReasons.push(
      `必需说明 ${instructionCharCount} 字 > ${BAR_FIT_THRESHOLDS.LONG_INSTRUCTION_CHARS} 字，属「需要长规则说明」疑似 → 只进人工复核池，非正式判据。`,
    );
  }

  const ruleHits = [...hardFailPatternHits, ...suspectHits];
  const reasons = [...hardFailReasons, ...suspectReasons];

  const machineVerdict: MachineVerdict =
    hardFailPatternHits.length > 0 ? "HARD_FAIL_PATTERN" : suspectHits.length > 0 ? "SUSPECT" : "PASS";

  return {
    machineVerdict,
    humanBarFit: "UNREVIEWED",
    reasons,
    ruleHits,
    hardFailPatternHits,
    suspectHits,
    metrics: { charCount, instructionCharCount, readSeconds, startActions, actionBreakdown: breakdown },
  };
}
