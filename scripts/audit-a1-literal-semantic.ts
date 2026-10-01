/**
 * Phase A.1｜主题缺口：literalHits（词面证据）与 semanticHits（语义证据）分离。
 *
 * 整改要求：Phase A 把「关键词 0 命中」直接写成「语义完全不存在」，属于过度结论。
 * 本脚本只负责**词面**证据；语义证据由独立语义复核（_reviews-semantic/）提供并单独统计。
 * 输出：GAP-LITERAL.json（机械可复算）——semanticHits 不在本脚本臆造，留空由复核脚本回填。
 */
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = process.cwd();
const DIR = `${ROOT}/docs/qa/content-audit`;
const cards = (
  JSON.parse(readFileSync(`${ROOT}/lib/v2-content/generated/v2-ssot.generated.json`, "utf8")) as {
    mainlineCards: { cardId: string; text: string }[];
  }
).mainlineCards;

/**
 * 每个主题一组「显式词面」正则。
 * 刻意只放**显式词**，不放近义表达——否则会把词面证据和语义证据混在一起，正是本轮要修的问题。
 */
const LITERAL_PROBES: { theme: string; note: string; patterns: { label: string; re: RegExp }[] }[] = [
  {
    theme: "前任/过去关系",
    note: "显式词面：前任、前男友、前女友、上一段、过去那段。词面为 0 不等于没有前任话题，语义复核见 semanticHits。",
    patterns: [
      { label: "前任", re: /前任/ },
      { label: "前男友/前女友", re: /前男友|前女友/ },
      { label: "上一段/过去那段感情", re: /上一段|过去那段/ },
    ],
  },
  {
    theme: "吃醋/占有",
    note: "显式词面：吃醋、醋意、在意别人看、占有欲。",
    patterns: [
      { label: "吃醋/醋意", re: /吃醋|醋意|吃飛醋/ },
      { label: "占有欲", re: /占有欲/ },
      { label: "在意别人怎么看/和谁来往", re: /在意.{0,4}(别人|他人).{0,6}(看|来往|社交)/ },
    ],
  },
  {
    theme: "异性朋友/异性友谊边界",
    note: "显式词面：异性朋友、男性朋友、女性朋友、闺蜜、好兄弟。",
    patterns: [
      { label: "异性朋友", re: /异性朋友|异性友谊/ },
      { label: "男性朋友/女性朋友", re: /男性朋友|女性朋友/ },
      { label: "闺蜜/好兄弟", re: /闺蜜|好兄弟/ },
    ],
  },
  {
    theme: "底线/雷区",
    note: "显式词面：底线、雷区、不能接受、碰不得、绝对不。",
    patterns: [
      { label: "底线", re: /底线/ },
      { label: "雷区", re: /雷区/ },
      { label: "不能接受/受不了", re: /不能接受|受不了/ },
      { label: "绝对不/绝不", re: /绝对不|绝不/ },
    ],
  },
  {
    theme: "人生目标/理想生活",
    note: "显式词面：未来、梦想、人生目标、五年、十年、以后想过。",
    patterns: [
      { label: "未来/以后", re: /未来|以后想/ },
      { label: "梦想/理想生活", re: /梦想|理想生活/ },
      { label: "人生目标", re: /人生目标|人生理想/ },
      { label: "五年/十年", re: /五年|十年/ },
    ],
  },
  {
    theme: "具体兴趣爱好",
    note: "显式词面：具体爱好项目（打球/乐器/摄影/露营/做饭/游戏等）。注意「共同兴趣」「有兴趣」属元话，不算具体爱好。",
    patterns: [
      { label: "球类运动", re: /篮球|足球|羽毛球|网球|排球|乒乓球|高尔夫/ },
      { label: "乐器", re: /吉他|钢琴|尤克里里|鼓|小提琴|大提琴/ },
      { label: "摄影/影像", re: /摄影|拍照|拍立得/ },
      { label: "户外/旅行", re: /露营|徒步|爬山|骑行|滑雪|冲浪|潜水/ },
      { label: "厨艺", re: /做饭|下厨|烘焙|厨艺/ },
      { label: "游戏", re: /打游戏|电子游戏|主机游戏|手游/ },
      { label: "其他具体爱好", re: /养(猫|狗|植物)|钓鱼|书法|手工|陶艺|骑马|瑜伽|滑板/ },
    ],
  },
  {
    theme: "亲密/性观念",
    note: "显式词面：亲密、暧昧、身体接触、以及具体尺度词。",
    patterns: [
      { label: "亲密", re: /亲密/ },
      { label: "暧昧", re: /暧昧/ },
      { label: "身体接触", re: /身体接触|牵手|拥抱|搂|抱住/ },
      { label: "具体尺度", re: /接吻|亲吻|开房|同居|婚前|性关系|性生活|上床|亲密尺度/ },
    ],
  },
];

const result = LITERAL_PROBES.map((probe) => {
  const patternHits = probe.patterns
    .map((p) => {
      const matched = cards.filter((c) => p.re.test(c.text));
      return { label: p.label, count: matched.length, cardIds: matched.map((c) => c.cardId) };
    })
    .filter((p) => p.count > 0);
  const unionIds = new Set(patternHits.flatMap((p) => p.cardIds));
  return {
    theme: probe.theme,
    note: probe.note,
    patternsProbed: probe.patterns.length,
    patternsWithHit: patternHits.length,
    literalHits: unionIds.size,
    literalHitRatio: +(unionIds.size / cards.length).toFixed(4),
    cardIds: [...unionIds].sort(),
    matchedPatterns: patternHits.map((p) => ({ label: p.label, count: p.count })),
  };
});

const out = {
  generator: "scripts/audit-a1-literal-semantic.ts",
  cardCount: cards.length,
  scope: "literalHits 仅统计显式词面命中；semanticHits 必须由独立语义复核回填，不得由本脚本臆造。",
  themes: result,
};

writeFileSync(`${DIR}/GAP-LITERAL.json`, JSON.stringify(out, null, 2));

console.log(`literal 词面证据（${cards.length} 张卡面）`);
for (const t of result) {
  console.log(`  ${String(t.literalHits).padStart(3)} 张  ${t.theme}  ${t.literalHits === 0 ? "← 词面 0 命中（≠ 语义不存在）" : ""}`);
}
