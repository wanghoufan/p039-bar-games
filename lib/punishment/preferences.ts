import { preferencesSchema, type Preferences } from "./schema";
export const PREFERENCES_KEY = "party-night-punishment-preferences-v1";
export const defaults: Preferences = { language: "bilingual", disabledTags: [], theme: "dark", sound: true, vibration: true, bank: "normal" };
export function readPreferences(): Preferences { try {
    return preferencesSchema.parse(JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? "null"));
}
catch {
    return { ...defaults, disabledTags: [] };
} }
export function savePreferences(p: Preferences) { try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(p));
}
catch { /* In-memory fallback. */ } }
