"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { challenges as normalChallenges } from "@/content/punishment/challenges";
import { challenges as coupleChallenges } from "@/content/punishment/couple";
import { challenges as oneManyChallenges } from "@/content/punishment/oneMany";
import { loadChallenges } from "@/lib/punishment/loadChallenges";
import { drawCard } from "@/lib/punishment/deck";
import { readPreferences } from "@/lib/punishment/preferences";
import { newSession, readSession, saveSession } from "@/lib/punishment/session";
import { idleTimer, startTimer, pauseTimer, resumeTimer, remaining, type Timer } from "@/lib/punishment/timer";
import { play, unlockAudio } from "@/lib/audio";
import { vibrate } from "@/lib/haptics";

export default function PunishmentPlay() {
  const router = useRouter();
  const { preferences, update, ready } = usePreferences();
  const cards = useMemo(() => loadChallenges(preferences.bank === "couple" ? coupleChallenges : preferences.bank === "oneMany" ? oneManyChallenges : normalChallenges), [preferences.bank]);
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
      let saved = readSession();
      if (!saved.currentCardId || !cards.some(card => card.id === saved.currentCardId)) {
        saved = drawCard(saved, cards, readPreferences().disabledTags);
      }
      setSession(saved);
      setLoaded(true);
    });
  }, [ready, cards]);

  useEffect(() => {
    if (loaded && ready) saveSession(session);
  }, [session, loaded, ready]);

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

  const card = cards.find(card => card.id === session.currentCardId);

  function clearFeedback() {
    setFinished(false);
    if (finishTimeout.current) clearTimeout(finishTimeout.current);
  }

  function next() {
    clearFeedback();
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
            <button aria-label="设置与盾牌" onClick={() => setSheet("settings")}><Icon name="settings" /></button>
            <button aria-label="切换到真心话" onClick={() => router.push("/truth/play")}><Icon name="swap" /></button>
          </div>
          <LevelDots level={session.selectedLevel} onChange={selectedLevel => setSession(session =>
            session.currentCardId ? { ...session, selectedLevel } : drawCard({ ...session, selectedLevel }, cards, preferences.disabledTags)
          )} />
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
