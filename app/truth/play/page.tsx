"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { NeonBackground } from "@/components/brand/NeonBackground";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { LevelDots } from "@/components/punishment/LevelDots";
import { ChallengeCard } from "@/components/punishment/ChallengeCard";
import { ActionBar } from "@/components/punishment/ActionBar";
import { LanguageChoices } from "@/components/punishment/LanguageSheet";
import { useTruthPreferences } from "@/components/truth/useTruthPreferences";
import { truthPair } from "@/content/truth/pair";
import { truthNormal } from "@/content/truth/normal";
import { loadChallenges } from "@/lib/punishment/loadChallenges";
import { drawCard } from "@/lib/punishment/deck";
import { newTruthSession, readTruthSession, saveTruthSession } from "@/lib/truth/storage";
import { play } from "@/lib/audio";
import { vibrate } from "@/lib/haptics";

export default function TruthPlay() {
  const router = useRouter();
  const { preferences, update, ready } = useTruthPreferences();
  const cards = useMemo(() => loadChallenges(preferences.bank === "normal" ? truthNormal : truthPair), [preferences.bank]);
  const [session, setSession] = useState(newTruthSession);
  const [loaded, setLoaded] = useState(false);
  const [sheet, setSheet] = useState<"language" | null>(null);

  useEffect(() => {
    if (!ready) return;
    Promise.resolve().then(() => {
      let saved = readTruthSession();
      if (!saved.currentCardId || !cards.some(card => card.id === saved.currentCardId)) {
        saved = drawCard(saved, cards, []);
      }
      setSession(saved);
      setLoaded(true);
    });
  }, [ready, cards]);

  useEffect(() => {
    if (loaded && ready) saveTruthSession(session);
  }, [session, loaded, ready]);

  const card = cards.find(c => c.id === session.currentCardId);

  function next() {
    play("deal");
    void vibrate();
    setSession(session => drawCard(session, cards, []));
  }

  function pickLevel(selectedLevel: typeof session.selectedLevel) {
    play("tap");
    void vibrate();
    setSession(session => session.currentCardId ? { ...session, selectedLevel } : drawCard({ ...session, selectedLevel }, cards, []));
  }

  if (!ready || !loaded) {
    return <NeonBackground><main className="punishment-screen" aria-busy="true" /></NeonBackground>;
  }

  return (
    <NeonBackground className="punishment-bg">
      <main className="punishment-screen">
        <header className="punishment-header">
          <button aria-label="返回设置" onClick={() => router.push("/truth")}><Icon name="back" /></button>
          <LevelDots level={session.selectedLevel} onChange={pickLevel} />
          <button aria-label="切换语言" onClick={() => setSheet("language")}><span>Aa</span></button>
        </header>

        {card ? (
          <ChallengeCard card={card} language={preferences.language} timing={false} />
        ) : (
          <section className="punishment-card punishment-empty">
            <h1>普通题库即将上线</h1>
            <p>「普通（多男多女）」内容还在整理，先玩「一男一女」吧。</p>
            <div><Button onClick={() => router.push("/truth")}>返回设置</Button></div>
          </section>
        )}

        {card && (
          <ActionBar seconds={null} status="idle" onNext={next} onStart={() => {}} onPause={() => {}} onResume={() => {}} onEnd={() => {}} />
        )}

        <Modal open={sheet === "language"} title="语言" onClose={() => setSheet(null)}>
          <div className="punishment-sheet">
            <LanguageChoices value={preferences.language} onChange={language => update({ ...preferences, language })} />
            <Button onClick={() => setSheet(null)}>完成</Button>
          </div>
        </Modal>
      </main>
    </NeonBackground>
  );
}