import { sessionSchema, type Session } from "./schema";
export const SESSION_KEY = "party-night-punishment-session-v1";
export function newSession(): Session { return { selectedLevel: 1, currentCardId: null, usedCardIdsByLevel: { 1: [], 2: [], 3: [], 4: [], 5: [] }, orderByLevel: { 1: [], 2: [], 3: [], 4: [], 5: [] } }; }
export function readSession(): Session { try {
    return sessionSchema.parse(JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null"));
}
catch {
    return newSession();
} }
export function saveSession(session: Session) { try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}
catch { /* Storage denied: keep playing in memory. */ } }
