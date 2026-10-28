"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NeonBackground } from "@/components/brand/NeonBackground";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { LevelDots } from "@/components/punishment/LevelDots";
import { ChallengeCard } from "@/components/punishment/ChallengeCard";
import { TimerOverlay } from "@/components/punishment/TimerOverlay";
import { ActionBar } from "@/components/punishment/ActionBar";
import { EmptyPoolState } from "@/components/punishment/EmptyPoolState";
import { LanguageChoices } from "@/components/punishment/LanguageSheet";
import { ShieldChoices } from "@/components/punishment/ShieldSheet";
import { PunishmentSettings } from "@/components/punishment/PunishmentSettingsSheet";
import { usePreferences } from "@/components/punishment/usePreferences";
import type { Challenge } from "@/lib/punishment/schema";
import { drawCard } from "@/lib/punishment/deck";
import { readSession, saveSession, newSession } from "@/lib/punishment/session";
import { readPreferences } from "@/lib/punishment/preferences";
import { idleTimer, startTimer, pauseTimer, resumeTimer, remaining, type Timer } from "@/lib/punishment/timer";
import { play, unlockAudio } from "@/lib/audio";
import { vibrate } from "@/lib/haptics";

/**
 * 通用「卡牌玩家」界面（大冒险 / 谁最可能 / 我从来没有 共用）。
 * 只接收一个题库的卡牌与一个独立 session key；语言/盾牌/主题/声音沿用大冒险偏好（全局共享）。
 * backHref 传入才显示返回按钮（大冒险从设置页进入，不需要返回）。
 */
export function PunishmentPlayer({ cards, sessionKey, backHref, swap }: {
  cards: Challenge[];
  sessionKey: string;
  backHref?: string;
  swap: { label: string; href: string };
}) {
  const router = useRouter();
  const { preferences, update, ready } = usePreferences();
  const [session, setSession] = useState(newSession);
  const [loaded, setLoaded] = useState(false);
  const [sheet, setSheet] = useState<"settings" | "language" | "shield" | null>(null);
  const [timer, setTimer] = useState<Timer>(idleTimer);
  const [now, setNow] = useState(0);
  const [finished, setFinished] = useState(false);
  const finishTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!ready) return;
    Promise.resolve().then(() => {
      let saved = readSession(sessionKey);
      if (!saved.currentCardId || !cards.some(card => card.id === saved.currentCardId)) {
        saved = drawCard(saved, cards, readPreferences().disabledTags);
      }
      setSession(saved);
      setLoaded(true);
    });
  }, [ready, cards, sessionKey]);

  useEffect(() => {
    if (loaded && ready) saveSession(session, sessionKey);
  }, [session, loaded, ready, sessionKey]);

  useEffect(() => {
    if (timer.status !== "running") return;
    const tick = () => setNow(Date.now());
    const interval = setInterval(tick, 100);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [timer.status]);

  useEffect(() => {
    if (timer.status !== "running" || remaining(timer, now) > 0) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setTimer(idleTimer);
      setFinished(true);
      if (preferences.sound) play("finish-chord", { ignoreMute: true });
      if (preferences.vibration) void vibrate();
      finishTimeout.current = setTimeout(() => setFinished(false), 900);
    });
    return () => { cancelled = true; };
  }, [timer, now, preferences.sound, preferences.vibration]);

  useEffect(() => () => {
    if (finishTimeout.current) clearTimeout(finishTimeout.current);
  }, []);

  const card = cards.find(item => item.id === session.currentCardId);

  function clearFeedback() {
    setFinished(false);
    if (finishTimeout.current) clearTimeout(finishTimeout.current);
  }

  function next() {
    clearFeedback();
    if (preferences.sound) play("deal");
    void vibrate();
    setSession(session => drawCard(session, cards, preferences.disabledTags));
  }

  function start() {
    if (!card?.timerSeconds) return;
    unlockAudio();
    const time = Date.now();
    setNow(time);
    clearFeedback();
    setTimer(startTimer(card.timerSeconds, time));
  }

  function pause() {
    const time = Date.now();
    setNow(time);
    setTimer(timer => pauseTimer(timer, time));
  }

  function resume() {
    const time = Date.now();
    setNow(time);
    setTimer(timer => resumeTimer(timer, time));
  }

  if (!ready || !loaded) {
    return <NeonBackground><main className="punishment-screen" aria-busy="true" /></NeonBackground>;
  }

  return (
    <NeonBackground className="punishment-bg">
      <main className="punishment-screen">
        <header className="punishment-header">
          <div className="punishment-header-side">
            {backHref && <button aria-label="返回" onClick={() => { play("tap"); router.push(backHref); }}><Icon name="back" /></button>}
            <button aria-label="设置与盾牌" onClick={() => setSheet("settings")}><Icon name="settings" /></button>
            <button aria-label={swap.label} onClick={() => { play("pack-switch"); router.push(swap.href); }}><Icon name="swap" /></button>
          </div>
          <LevelDots level={session.selectedLevel} onChange={selectedLevel => { if (preferences.sound) play("tap"); void vibrate(); setSession(session =>
            session.currentCardId ? { ...session, selectedLevel } : drawCard({ ...session, selectedLevel }, cards, preferences.disabledTags)
          ); }} />
          <div className="punishment-header-side is-end">
            <button aria-label="切换语言" onClick={() => setSheet("language")}><span>Aa</span></button>
          </div>
        </header>

        {card ? (
          <ChallengeCard card={card} language={preferences.language} timing={timer.status !== "idle"}>
            {timer.status !== "idle" && (
              <TimerOverlay seconds={Math.ceil(remaining(timer, now) / 1000)} total={card.timerSeconds!} paused={timer.status === "paused"} />
            )}
            {finished && <div className="punishment-finished" role="status"><Icon name="check" />时间到！</div>}
          </ChallengeCard>
        ) : (
          <EmptyPoolState onSwitch={() => setSession(session => drawCard({
            ...session, selectedLevel: (session.selectedLevel % 5 + 1) as typeof session.selectedLevel
          }, cards, preferences.disabledTags))} onShield={() => setSheet("shield")} />
        )}

        {card && (
          <ActionBar seconds={card.timerSeconds} status={timer.status} onNext={next} onStart={start} onPause={pause} onResume={resume}
            onEnd={() => { setTimer(idleTimer); clearFeedback(); }} />
        )}

        <Modal open={sheet !== null} title={sheet === "language" ? "语言" : sheet === "shield" ? "盾牌" : "设置"} onClose={() => setSheet(null)}>
          <div className="punishment-sheet">
            {sheet === "language" ? (
              <LanguageChoices value={preferences.language} onChange={language => update({ ...preferences, language })} />
            ) : sheet === "shield" ? (
              <ShieldChoices disabled={preferences.disabledTags} onChange={disabledTags => update({ ...preferences, disabledTags })} />
            ) : <PunishmentSettings value={preferences} onChange={update} />}
            <Button onClick={() => setSheet(null)}>完成</Button>
          </div>
        </Modal>
      </main>
    </NeonBackground>
  );
}
