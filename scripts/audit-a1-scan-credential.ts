/**
 * Phase A.2｜第三方独立全库扫描「机器凭证」（fail-closed，唯一实现）
 *
 * 背景：`_semantic/independent-scan.jsonl` 是「5 个零命中主题在 350 题里各 0 命中」的
 * **载荷**。历史上该文件就是 0 字节，而 0 字节文件**无法自证「扫描跑过」**——文件被误删后
 * 由任何流程重新 `touch` 出一个空文件，与「扫描完成且 0 命中」在磁盘上完全一样。
 * 用 `existsSync(独立扫描文件)` 判「扫描已完成」，就等于把「未扫描」误判成「0 命中」。
 *
 * 因此判定权从「文件存在」移交给本凭证：非空、可复算、且与 SSOT / 查询集强绑定。
 * 判据（任一不满足 → 抛错，调用方非 0 退出，**禁止回退成 existsSync 判定**）：
 *   1. 凭证文件存在、**非 0 字节**、且是合法 JSON；
 *   2. `completed === true`；
 *   3. 载荷文件仍存在（历史证据不得丢），且 `resultCount` === 载荷实际行数；
 *   4. `sourceHash` === 当前 SSOT 350 题的稳定哈希（内容换了 → 旧凭证作废）；
 *   5. `querySetHash` === 当前零命中主题集合的稳定哈希（查询集变了 → 旧凭证作废）。
 *
 * 本模块只做**纯计算** + 一次显式写入（`emitScanCredential`，仅在真的完成一次新扫描后调用），
 * 不产生其它副作用；被 `audit-a1-semantic.ts`（生成/校验）与 `audit-a1-report.ts`（--verify-only 对账）共用，
 * 确保两处口径绝不漂移。
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";

/** SSOT 主线卡的最小投影（与 reviewer 输入 `_semantic/input.jsonl` 同构）。 */
export interface SsotCard { cardId: string; gameType: string; text: string; }

/** 归一主题名：去掉所有空白字符（与 `audit-a1-semantic.ts` 的口径一致）。 */
const normTheme = (s: string): string => s.replace(/\s+/g, "");

const sha256Hex = (s: string): string => createHash("sha256").update(s, "utf8").digest("hex");

/** 稳定序列化：`cardId\tgameType\ttext` 逐行，保持 SSOT 原序，非空时末尾补换行。 */
export const canonicalSourceText = (cards: SsotCard[]): string =>
  cards.map((c) => `${c.cardId}\t${c.gameType}\t${c.text}`).join("\n") + (cards.length > 0 ? "\n" : "");

/** 350 题输入（SSOT 主线卡投影）的稳定哈希，sha256 hex，可复算。 */
export const computeSourceHash = (cards: SsotCard[]): string => sha256Hex(canonicalSourceText(cards));

/** 查询集（零命中主题集合）的稳定哈希：归一 → 去重 → 字典序升序 → 逐行拼接 → sha256，可复算。 */
export const computeQuerySetHash = (themes: string[]): string =>
  sha256Hex([...new Set(themes.map(normTheme))].sort().join("\n") + "\n");

/** 归一后的查询集（升序去重），写入凭证时与哈希一并留痕，便于人工核对。 */
export const normalizedQuerySet = (themes: string[]): string[] =>
  [...new Set(themes.map(normTheme))].sort();

/** 凭证 schema（前 6 个为门禁判据，其余为可复算留痕）。 */
export interface ScanCredential {
  completed: boolean;
  resultCount: number;
  querySetHash: string;
  sourceHash: string;
  generatedAt: string;
  note: string;
  algorithm: "sha256";
  payload: string;
  payloadBytes: number;
  queryThemes: string[];
  sourceCanonicalization: string;
  querySetCanonicalization: string;
}

/** 校验所需的当前事实（由调用方从磁盘读出，本模块不猜）。 */
export interface ScanInputs {
  /** 当前 SSOT 主线卡（350 题）。 */
  ssotCards: SsotCard[];
  /** 当前零命中主题集合（来自 GAP-LITERAL.json 中 literalHits === 0 的主题）。 */
  zeroHitThemes: string[];
}

export interface ScanVerification {
  credential: ScanCredential;
  /** 载荷实际行数（非空行）。 */
  payloadLines: number;
  /** 载荷实际字节数（历史 0 命中时为 0）。 */
  payloadBytes: number;
  /** 当前 SSOT 350 题重算哈希。 */
  sourceHash: string;
  /** 当前查询集重算哈希。 */
  querySetHash: string;
}

const SOURCE_CANONICALIZATION =
  "sha256( 每张卡 `cardId\\tgameType\\ttext` 逐行拼接（保持 SSOT mainlineCards 原序，末尾补 \\n) )，UTF-8";
const QUERY_SET_CANONICALIZATION =
  "sha256( 主题名去空白 → 去重 → 字典序升序 → 每行一个 \\n 拼接 )，UTF-8";

const payloadLinesOf = (raw: string): number => raw.split("\n").filter((l) => l.trim().length > 0).length;

/**
 * 校验凭证与载荷是否与「当前 SSOT + 当前查询集」一致。
 * fail-closed：任一条不满足即抛 Error（调用方不得吞掉，应非 0 退出）。
 */
export function verifyScanCredential(
  credentialPath: string,
  payloadPath: string,
  inputs: ScanInputs,
): ScanVerification {
  if (!existsSync(credentialPath)) {
    throw new Error(
      `独立扫描凭证缺失：${credentialPath}。`
      + "「扫描完成且 0 命中」只能由该非空凭证证明，禁止用载荷文件是否存在判定。",
    );
  }
  const credBytes = statSync(credentialPath).size;
  if (credBytes === 0) {
    throw new Error(`独立扫描凭证为 0 字节：${credentialPath}（凭证必须非空且字段完整）。`);
  }
  let credential: ScanCredential;
  try {
    credential = JSON.parse(readFileSync(credentialPath, "utf8")) as ScanCredential;
  } catch (e) {
    throw new Error(`独立扫描凭证不是合法 JSON：${credentialPath}（${(e as Error).message}）。`);
  }
  if (credential.completed !== true) {
    throw new Error(`独立扫描凭证 completed !== true（实际 ${JSON.stringify(credential.completed)}）：${credentialPath}。`);
  }

  if (!existsSync(payloadPath)) {
    throw new Error(`独立扫描载荷缺失：${payloadPath}（历史证据不得删除，凭证与载荷必须成对存在）。`);
  }
  const payloadRaw = readFileSync(payloadPath, "utf8");
  const payloadBytes = statSync(payloadPath).size;
  const payloadLines = payloadLinesOf(payloadRaw);
  if (credential.resultCount !== payloadLines) {
    throw new Error(
      `独立扫描 resultCount 与载荷行数不一致：凭证 ${credential.resultCount} vs 载荷 ${payloadLines} 行（${payloadPath}）。`,
    );
  }
  if (typeof credential.payloadBytes === "number" && credential.payloadBytes !== payloadBytes) {
    throw new Error(
      `独立扫描 payloadBytes 与载荷实际字节数不一致：凭证 ${credential.payloadBytes} vs 实际 ${payloadBytes}（${payloadPath}）。`,
    );
  }

  const sourceHash = computeSourceHash(inputs.ssotCards);
  if (credential.sourceHash !== sourceHash) {
    throw new Error(
      `独立扫描凭证 sourceHash 与当前 SSOT 不符：凭证 ${credential.sourceHash} vs 当前 ${sourceHash}`
      + `（${inputs.ssotCards.length} 张，口径 ${SOURCE_CANONICALIZATION}）——内容已变，须重跑扫描并重签凭证。`,
    );
  }

  const querySetHash = computeQuerySetHash(inputs.zeroHitThemes);
  if (credential.querySetHash !== querySetHash) {
    throw new Error(
      `独立扫描凭证 querySetHash 与当前零命中主题集合不符：凭证 ${credential.querySetHash} vs 当前 ${querySetHash}`
      + `（当前集合：${normalizedQuerySet(inputs.zeroHitThemes).join("、") || "（空）"}）——查询集已变，须重跑扫描并重签凭证。`,
    );
  }

  return { credential, payloadLines, payloadBytes, sourceHash, querySetHash };
}

/**
 * 写入凭证（仅在**真的完成一次新扫描后**调用；本函数不做任何扫描）。
 * 用当前 SSOT / 查询集重算哈希，resultCount 取载荷实际行数——不由调用方手写数字。
 */
export function emitScanCredential(
  credentialPath: string,
  payloadPath: string,
  inputs: ScanInputs,
  generatedAt: string = new Date().toISOString(),
): ScanCredential {
  if (!existsSync(payloadPath)) throw new Error(`无法签发凭证：载荷不存在 ${payloadPath}。`);
  const payloadBytes = statSync(payloadPath).size;
  const resultCount = payloadLinesOf(readFileSync(payloadPath, "utf8"));
  const credential: ScanCredential = {
    completed: true,
    resultCount,
    querySetHash: computeQuerySetHash(inputs.zeroHitThemes),
    sourceHash: computeSourceHash(inputs.ssotCards),
    generatedAt,
    note:
      "第三方独立全库扫描的「机器凭证」：证明本次扫描已完成，且绑定当时的 350 题 SSOT 与 5 个零命中主题查询集。"
      + "配套证据是同目录 independent-scan.jsonl（0 命中时为 0 字节的载荷凭证）——"
      + "载荷文件的「存在」不构成扫描完成的证明，判定权在本凭证（非空 + completed + sourceHash + querySetHash 全部可复算）。",
    algorithm: "sha256",
    payload: "_semantic/independent-scan.jsonl",
    payloadBytes,
    queryThemes: normalizedQuerySet(inputs.zeroHitThemes),
    sourceCanonicalization: SOURCE_CANONICALIZATION,
    querySetCanonicalization: QUERY_SET_CANONICALIZATION,
  };
  writeFileSync(credentialPath, `${JSON.stringify(credential, null, 2)}\n`);
  return credential;
}
