import { describe, it, expect } from "vitest";
import { truthPair } from "@/content/truth/pair";
import { truthNormal } from "@/content/truth/normal";
import { loadChallenges } from "@/lib/punishment/loadChallenges";
import { levels } from "@/lib/punishment/schema";
import { drawCard } from "@/lib/punishment/deck";
import {
  newTruthSession, readTruthSession, saveTruthSession,
  readTruthPreferences, saveTruthPreferences, truthDefaults,
  TRUTH_PREFERENCES_KEY, TRUTH_SESSION_KEY,
} from "@/lib/truth/storage";

describe("truth independent core", () => {
  it("loads 118 curated cards with the reviewed level split and no timer", () => {
    const cards = loadChallenges(truthPair);
    expect(cards).toHaveLength(118);
    const count = Object.fromEntries(levels.map(l => [l, cards.filter(c => c.level === l).length]));
    expect(count).toEqual({ 1: 44, 2: 25, 3: 16, 4: 11, 5: 22 });
    expect(cards.every(c => c.timerSeconds === null)).toBe(true);
    expect(cards.every(c => c.contentTags.length === 0)).toBe(true);
    expect(cards.every(c => c.zh.trim().length > 0 && c.en.trim().length > 0)).toBe(true);
  });

  it("rejects duplicates and invalid data", () => {
    expect(() => loadChallenges([...truthPair, truthPair[0]])).toThrow();
    for (const field of [{ level: 6 }, { zh: "" }, { en: "" }, { timerSeconds: 0 }, { tags: ["x"] }])
      expect(() => loadChallenges([{ ...truthPair[0], ...field }])).toThrow();
  });

  it("keeps the empty 普通 bank as a placeholder", () => {
    expect(truthNormal).toHaveLength(0);
    expect(loadChallenges(truthNormal)).toHaveLength(0);
    expect(drawCard(newTruthSession(), loadChallenges(truthNormal), []).currentCardId).toBeNull();
  });

  it("isolates every level over repeated cycles and avoids adjacent repeats", () => {
    const cards = loadChallenges(truthPair);
    for (const level of levels) {
      let s = { ...newTruthSession(), selectedLevel: level };
      let previous: string | null = null;
      for (let i = 0; i < 30; i++) {
        s = drawCard(s, cards, []);
        const c = cards.find(c => c.id === s.currentCardId)!;
        expect(c.level).toBe(level);
        expect(c.id).not.toBe(previous);
        previous = c.id;
      }
    }
  });

  it("persists only separate truth keys and tolerates corrupt storage", () => {
    localStorage.clear(); sessionStorage.clear();
    saveTruthPreferences({ language: "en", bank: "pair" });
    expect(readTruthPreferences()).toEqual({ language: "en", bank: "pair" });
    expect(localStorage.getItem(TRUTH_PREFERENCES_KEY)).not.toBeNull();
    expect(localStorage.getItem("party-night-punishment-preferences-v1")).toBeNull();
    const s = drawCard(newTruthSession(), loadChallenges(truthPair), []);
    saveTruthSession(s);
    expect(readTruthSession()).toEqual(s);
    sessionStorage.setItem(TRUTH_SESSION_KEY, "bad");
    expect(readTruthSession()).toEqual(newTruthSession());
    localStorage.setItem(TRUTH_PREFERENCES_KEY, "bad");
    expect(readTruthPreferences()).toEqual(truthDefaults);
  });
});