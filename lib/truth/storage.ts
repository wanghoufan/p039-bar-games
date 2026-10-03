import { z } from "zod";
import { sessionSchema, type Session } from "@/lib/punishment/schema";

// 真心话独立存储：与大冒险分开 key，避免两套玩法的偏好/进度互相覆盖。
export const TRUTH_PREFERENCES_KEY = "party-night-truth-preferences-v1";
export const TRUTH_SESSION_KEY = "party-night-truth-session-v1";

export const truthBankSchema = z.enum(["pair", "normal"]);
export type TruthBank = z.infer<typeof truthBankSchema>;

export const truthPreferencesSchema = z.object({
  language: z.enum(["zh", "bilingual", "en"]),
  bank: truthBankSchema,
});
export type TruthPreferences = z.infer<typeof truthPreferencesSchema>;

export const truthDefaults: TruthPreferences = { language: "bilingual", bank: "pair" };

export function readTruthPreferences(): TruthPreferences {
  try {
    return truthPreferencesSchema.parse(JSON.parse(localStorage.getItem(TRUTH_PREFERENCES_KEY) ?? "null"));
  } catch {
    return { ...truthDefaults };
  }
}

export function saveTruthPreferences(p: TruthPreferences) {
  try {
    localStorage.setItem(TRUTH_PREFERENCES_KEY, JSON.stringify(p));
  } catch { /* In-memory fallback. */ }
}

export function newTruthSession(): Session {
  return { selectedLevel: 1, currentCardId: null, usedCardIdsByLevel: { 1: [], 2: [], 3: [], 4: [], 5: [] }, orderByLevel: { 1: [], 2: [], 3: [], 4: [], 5: [] } };
}

export function readTruthSession(): Session {
  try {
    return sessionSchema.parse(JSON.parse(sessionStorage.getItem(TRUTH_SESSION_KEY) ?? "null"));
  } catch {
    return newTruthSession();
  }
}

export function saveTruthSession(session: Session) {
  try {
    sessionStorage.setItem(TRUTH_SESSION_KEY, JSON.stringify(session));
  } catch { /* Storage denied: keep playing in memory. */ }
}