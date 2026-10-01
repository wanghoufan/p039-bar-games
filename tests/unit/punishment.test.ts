import { describe, it, expect } from "vitest";
import { challenges } from "@/content/punishment/challenges";
import { loadChallenges } from "@/lib/punishment/loadChallenges";
import { levels, tags } from "@/lib/punishment/schema";
import { newSession, readSession, saveSession } from "@/lib/punishment/session";
import { readPreferences, savePreferences, defaults } from "@/lib/punishment/preferences";
import { drawCard } from "@/lib/punishment/deck";
import { eligibleCards } from "@/lib/punishment/filter";
import { startTimer, pauseTimer, resumeTimer, remaining } from "@/lib/punishment/timer";
describe("punishment independent core", () => {
    it("rejects duplicates, invalid data and missing translations", () => { expect(() => loadChallenges([...challenges, challenges[0]])).toThrow(); for (const field of [{ level: 6 }, { zh: "" }, { en: "" }, { timerSeconds: 0 }, { contentTags: ["unknown"] }, { riskLevel: 1 }])
        expect(() => loadChallenges([{ ...challenges[0], ...field }])).toThrow(); expect(loadChallenges(challenges)).toHaveLength(20);
        expect(loadChallenges([{...challenges[0],zh:"  原始文案  "}])[0].zh).toBe("  原始文案  "); });
    it("isolates every level over repeated cycles and avoids adjacent repeats", () => { for (const level of levels) {
        let s = { ...newSession(), selectedLevel: level };
        const ids = new Set<string>();
        let previous: string | null = null;
        for (let i = 0; i < 40; i++) {
            s = drawCard(s, challenges, []);
            const c = challenges.find(c => c.id === s.currentCardId)!;
            expect(c.level).toBe(level);
            expect(c.id).not.toBe(previous);
            if (i < 4)
                ids.add(c.id);
            previous = c.id;
        }
        expect(ids.size).toBe(4);
    } });
    it("continues previous level independently", () => { let s = drawCard({ ...newSession(), selectedLevel: 2 }, challenges, []); const first = s.currentCardId; s = drawCard({ ...s, selectedLevel: 4 }, challenges, []); s = drawCard({ ...s, selectedLevel: 2 }, challenges, []); expect(s.currentCardId).not.toBe(first); expect(s.usedCardIdsByLevel[2]).toHaveLength(2); expect(s.usedCardIdsByLevel[4]).toHaveLength(1); });
    it("never leaks any disabled tag in all 128 shield combinations", () => { const keys = Object.keys(tags); for (let mask = 0; mask < 128; mask++) {
        const disabled = keys.filter((_, i) => mask & (1 << i));
        for (const level of levels) {
            let s = { ...newSession(), selectedLevel: level };
            for (let i = 0; i < 8; i++) {
                s = drawCard(s, challenges, disabled);
                const c = challenges.find(c => c.id === s.currentCardId);
                if (c)
                    expect(c.contentTags.some(t => disabled.includes(t))).toBe(false);
                else
                    expect(eligibleCards(challenges, level, disabled)).toHaveLength(0);
            }
        }
    } });
    it("handles a single eligible card and a completely empty pool", () => { const pool = [challenges[0]]; let s = drawCard(newSession(), pool, []); expect(drawCard(s, pool, []).currentCardId).toBe(pool[0].id); s = drawCard(s, pool, ["performance"]); expect(s.currentCardId).toBeNull(); });
    it("honors absolute time, paused time and background jumps", () => { let t = startTimer(15, 1000); expect(t.status).toBe("running"); expect(remaining(t, 2000)).toBe(14000); t = pauseTimer(t, 2000); expect(remaining(t, 999000)).toBe(14000); t = resumeTimer(t, 999000); expect(remaining(t, 1000000)).toBe(13000); expect(remaining(t, 2000000)).toBe(0); });
    it("persists only separate preference/session keys and tolerates corrupt storage", () => { localStorage.clear(); sessionStorage.clear(); savePreferences({ ...defaults, language: "en", disabledTags: ["kiss"] }); expect(readPreferences().language).toBe("en"); const s = drawCard(newSession(), challenges, []); saveSession(s); expect(readSession()).toEqual(s); sessionStorage.setItem("party-night-punishment-session-v1", "bad"); expect(readSession()).toEqual(newSession()); });
});
