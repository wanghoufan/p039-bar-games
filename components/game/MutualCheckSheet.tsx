"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import {
  beginMutualCheckRun,
  clearMutualCheckRun,
  finalizeMutualCheckRun,
  mutualPartnerIds,
  mutualPairRunExists,
  submitMutualChoice,
  mutualSingleCandidatePrompt,
  MUTUAL_MULTI_CANDIDATE_PROMPT,
  MUTUAL_SINGLE_CANDIDATE_NO,
  MUTUAL_SINGLE_CANDIDATE_YES,
  MUTUAL_STALE_TARGET_NOTICE,
  type MutualCheckPublicResult,
  type MutualCheckRun,
} from "@/lib/v2-relationship/v2-mutual-check";
import type { RelationshipState, SessionParticipant } from "@/lib/v2-relationship/v2-state";

/**
 * B9 / D5｜SYSTEM_MUTUAL_CHECK 私密互选面板（单设备传手机）。
 *
 * RG-01（2026-09-27 真机实测）：每人只点一次。状态机收敛为
 * `SELECT → HANDOFF_MASK →（下一位 SELECT | RESULTS）`，无上一步。
 * 唯一一次点击发生在 SELECT（点「愿意」或直接点对方昵称＝确认兴趣度并立即提交），
 * 交接遮罩零按钮、定时自动进入下一位，不设身份确认/准备/提交/遮好等任何中间确认页。
 *
 * 隐私约束（逐条对应 R4 §5.1 / §7.2）：
 * - 不提供上一步；离开 SELECT 即清空当次 draft、选中态与候选快照，
 *   下一位必须从自己的 SELECT 重新起步，绝不复用上一位的选中态。
 * - 提交先清快照再进遮罩：遮罩与自动切换后都不回显答案、所选对象、是否跳过。
 * - 全程只有「双方互选」的结果才公开；跳过、单向、被 D5 上限拦下一律不显示、不留痕。
 * - 单向秘密只活在 `v2-mutual-check`（纯内存）里，本组件不 import 任何持久化模块，
 *   不写入浏览器本地存储、离线库、URL 或日志。
 */

/** RG-01 收敛后的状态机：无上一步、无中间确认页。 */
type Step =
  | "SELECT"
  | "HANDOFF_MASK"
  | "RESULTS";

/** 交接遮罩自动进入下一位的等待时长（毫秒）：零点击交接，约 1 秒准备下一位。 */
const HANDOFF_MASK_MS = 1000;

export interface MutualCheckPlayer {
  id: string;
  displayName: string;
}

export interface MutualCheckSheetProps {
  open: boolean;
  /** 候选人（点名顺序），由调用方按 `mutualCandidateIds` 生成。 */
  players: readonly MutualCheckPlayer[];
  /** 当局参与者投影（用于按 eligiblePair 建 run）。 */
  participants: readonly SessionParticipant[];
  /**
   * 命中的中途互选检查点（`relationshipEffectiveCardCount ∈ [12, 14]`，见 v2-state 的
   * `MUTUAL_CHECK_COUNTS`）。只作为 dueCount 落进 `SYSTEM_MUTUAL_CHECK_DUE`，不驱动任何 UI 分支。
   */
  checkpoint: number;
  /** 现有关系态：finalize 时做 D5 上限 2 校验。 */
  relationship: RelationshipState;
  /** 流程收束（结果已公布之后）；入参只含公开结果。 */
  onFinished: (result: { runId: string; checkpoint: number; matches: MutualCheckPublicResult["matches"] }) => void;
  /** Host 取消收场：不产生结果、不计一次常规互选、不公开任何人。 */
  onCancelled: () => void;
}

export function MutualCheckSheet({
  open,
  players,
  participants,
  checkpoint,
  relationship,
  onFinished,
  onCancelled,
}: MutualCheckSheetProps) {
  const runRef = useRef<MutualCheckRun | null>(null);
  // participants / relationship 每次渲染都可能换引用：run 建立时读最新值。
  const participantsRef = useRef(participants);
  const relationshipRef = useRef(relationship);
  // timer 回调里读 players 用 ref（初值即首次渲染的 players），避免把 players 放进 effect 依赖导致定时器被父级渲染反复重置。
  const playersRef = useRef(players);
  const [step, setStep] = useState<Step>("SELECT");
  const [cursor, setCursor] = useState(0);
  const [result, setResult] = useState<MutualCheckPublicResult | null>(null);
  /**
   * 当前玩家进入选择页时定格的合法候选快照（R-CB9）。
   * 定格只为了让位给「单一候选 → Yes/No」这一个稳定视图；提交前仍会用最新参与者再校验一次边合法性，
   * 所以快照过期不会造成非法选择落盘。
   */
  const [candidates, setCandidates] = useState<readonly string[]>(() =>
    players.length > 0 ? mutualPartnerIds(players[0]!.id, participants) : [],
  );
  const [staleNotice, setStaleNotice] = useState("");

  useEffect(() => {
    participantsRef.current = participants;
    relationshipRef.current = relationship;
    playersRef.current = players;
  }, [participants, relationship, players]);

  // 关闭 / 卸载即清空内存里的单向数据（只动 ref，不触发渲染）：本面板每次 run 由调用方重新挂载。
  useEffect(() => {
    if (!open) return;
    return () => {
      if (runRef.current) {
        clearMutualCheckRun(runRef.current);
        runRef.current = null;
      }
    };
  }, [open]);

  // 交接遮罩：零点击，定时自动进入下一位的 SELECT（或最后一位后进 RESULTS）。
  useEffect(() => {
    if (step !== "HANDOFF_MASK") return;
    const timer = window.setTimeout(() => {
      if (cursor >= playersRef.current.length - 1) {
        setStep("RESULTS");
        return;
      }
      const next = playersRef.current[cursor + 1]!;
      setCursor(cursor + 1);
      setStaleNotice("");
      setCandidates(mutualPartnerIds(next.id, participantsRef.current));
      setStep("SELECT");
    }, HANDOFF_MASK_MS);
    return () => window.clearTimeout(timer);
  }, [step, cursor]);

  if (!open || typeof document === "undefined" || players.length === 0) return null;

  const current = players[Math.min(cursor, players.length - 1)]!;
  const last = cursor >= players.length - 1;
  const nameOf = (playerId: string) => players.find((player) => player.id === playerId)?.displayName ?? playerId;

  /** run 懒建立：直到第一位真正提交前，内存里不存在任何单向数据。 */
  function ensureRun(): MutualCheckRun {
    runRef.current ??= beginMutualCheckRun(participantsRef.current);
    return runRef.current;
  }

  /** 某玩家此刻的合法异性候选（从真实 eligible pair 池派生，与 Guard 阈值无关）。 */
  const legalCandidates = (playerId: string): string[] => mutualPartnerIds(playerId, participantsRef.current);

  /**
   * 收一位参与者的选择（每人唯一一次点击的落点）：
   * 先清空当次 draft、选中态与候选快照，再提交并进入零点击交接遮罩（不回显任何答案）。
   */
  function completePerson(targetPlayerId: string | null) {
    const run = ensureRun();
    setStaleNotice("");
    setCandidates([]);
    submitMutualChoice(run, current.id, targetPlayerId);
    if (last) {
      // 最后一位提交即 mutual final：先算公开结果，随即清空全部单向数据（R4 §6.2）。
      setResult(finalizeMutualCheckRun(run, relationshipRef.current));
    }
    setStep("HANDOFF_MASK");
  }

  /**
   * 提交前边合法校验（R-CB9 已知风险）：作答期间候选可能暂离/变化，快照里的目标可能已经失效。
   * 失效则拒绝提交、只给可读提示，绝不把非法目标送进 `submitMutualChoice`。
   * R-CB10：还要校验目标 pair 在建 run 时的快照里存在——roster 中途变化产生的新 pair
   * 不在 run.pairRuns 里，直接提交会被 `submitMutualChoice` 静默降级为跳过，必须拦在原屏。
   */
  function submitChoice(targetPlayerId: string | null) {
    if (targetPlayerId !== null) {
      const inRun = mutualPairRunExists(ensureRun(), current.id, targetPlayerId);
      if (!inRun || !legalCandidates(current.id).includes(targetPlayerId)) {
        setStaleNotice(MUTUAL_STALE_TARGET_NOTICE);
        return;
      }
    }
    completePerson(targetPlayerId);
  }

  function cancel() {
    const run = runRef.current;
    if (run) clearMutualCheckRun(run);
    runRef.current = null;
    onCancelled();
  }

  function finish() {
    const run = runRef.current;
    if (!run) {
      onCancelled();
      return;
    }
    const matches = result?.matches ?? [];
    runRef.current = null;
    onFinished({ runId: run.runId, checkpoint, matches });
  }

  const panel = (label: string, children: ReactNode) => (
    <section className="mutual-mask" role="dialog" aria-modal="true" aria-label={label}>
      <p className="mutual-mask__eyebrow"><Icon name="eye" /> 男女秘密互选 · 手机传阅</p>
      {children}
    </section>
  );

  const maskNote = <p className="mutual-mask__note">请勿截屏、转发或让旁人旁观。</p>;

  const stepView = (): ReactNode => {
    switch (step) {
      case "SELECT": {
        const handoffHint = (
          <p className="mutual-mask__note">请把手机交给 {current.displayName}，其他人别看屏幕。</p>
        );
        // R-CB9：分支只看「本人当前合法异性候选数」，与 Single-Anchor Guard 阈值解耦。
        if (candidates.length === 0) {
          return panel("选择你想进一步认识的人", <>
            <h2>暂时没有可选的人</h2>
            {handoffHint}
            <p className="mutual-mask__body">{MUTUAL_STALE_TARGET_NOTICE}</p>
            {maskNote}
            <div className="mutual-mask__actions">
              <Button variant="ghost" type="button" onClick={() => completePerson(null)}>跳过</Button>
            </div>
            <div className="mutual-mask__actions">
              <Button variant="ghost" type="button" onClick={cancel}>取消本轮</Button>
            </div>
          </>);
        }
        if (candidates.length === 1) {
          // 唯一合法候选：Yes/No 两选项，点一下即提交；标题点名对方昵称（RG-01）。
          const partnerId = candidates[0]!;
          return panel("选择你想进一步认识的人", <>
            <h2>{mutualSingleCandidatePrompt(nameOf(partnerId))}</h2>
            {handoffHint}
            <p className="mutual-mask__body">只有你们互相愿意才会公布结果；暂时没有不影响游戏，也不会有任何惩罚。</p>
            {staleNotice && <p className="mutual-mask__note" role="alert">{staleNotice}</p>}
            {maskNote}
            <div className="mutual-mask__actions">
              <Button variant="ghost" type="button" onClick={() => submitChoice(null)}>{MUTUAL_SINGLE_CANDIDATE_NO}</Button>
              <Button type="button" onClick={() => submitChoice(partnerId)}>{MUTUAL_SINGLE_CANDIDATE_YES}</Button>
            </div>
            <div className="mutual-mask__actions">
              <Button variant="ghost" type="button" onClick={cancel}>取消本轮</Button>
            </div>
          </>);
        }
        // 多候选：昵称即按钮，点谁即选谁并立即提交（RG-01）；「暂时没有」＝跳过。
        return panel("选择你想进一步认识的人", <>
          <h2>{MUTUAL_MULTI_CANDIDATE_PROMPT}</h2>
          {handoffHint}
          <div className="mutual-choice-list">
            {candidates.map((playerId) => (
              <button
                key={playerId}
                type="button"
                className="mutual-choice"
                onClick={() => submitChoice(playerId)}
              >
                {nameOf(playerId)}
              </button>
            ))}
          </div>
          {staleNotice && <p className="mutual-mask__note" role="alert">{staleNotice}</p>}
          <div className="mutual-mask__actions">
            <Button variant="ghost" type="button" onClick={() => submitChoice(null)}>{MUTUAL_SINGLE_CANDIDATE_NO}</Button>
          </div>
          <div className="mutual-mask__actions">
            <Button variant="ghost" type="button" onClick={cancel}>取消本轮</Button>
          </div>
          <p className="mutual-mask__note">只有你们互相选中彼此才会公布结果；其余情况不会显示，也不影响游戏。</p>
        </>);
      }
      case "HANDOFF_MASK": {
        // 中性交接遮罩：无按钮、不回显答案；最后一位交还主持人。
        const next = last ? undefined : players[cursor + 1];
        return panel("交接遮罩", <>
          <h2>已收起。</h2>
          <p className="mutual-mask__body">
            {next ? `请把手机交给 ${next.displayName}` : "请把手机交还主持人"}
          </p>
        </>);
      }
      case "RESULTS":
        return panel("互选结果", <>
          {result && result.matches.length > 0 ? (
            <>
              <h2>互选成功</h2>
              <ul className="mutual-result">
                {result.matches.map((match) => (
                  <li key={match.pairKey}>{nameOf(match.playerIds[0])} × {nameOf(match.playerIds[1])}</li>
                ))}
              </ul>
            </>
          ) : (
            <h2>本轮已完成，继续游戏</h2>
          )}
          <p className="mutual-mask__note">只有双方互相选中才会公布；其余情况不显示、不影响游戏，跳过也一样。</p>
          <div className="mutual-mask__actions">
            <Button type="button" onClick={finish}>继续游戏</Button>
          </div>
        </>);
    }
  };

  return createPortal(
    <div className="mutual-backdrop" role="presentation">{stepView()}</div>,
    document.body,
  );
}
