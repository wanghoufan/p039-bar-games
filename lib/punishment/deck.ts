import type { Challenge, Session } from "./schema";
import { eligibleCards } from "./filter";
function shuffle(ids: string[], random: () => number) { const result = [...ids]; for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
} return result; }
export function drawCard(session: Session, cards: Challenge[], disabled: string[], random = Math.random): Session {
    const level = session.selectedLevel;
    const pool = eligibleCards(cards, level, disabled);
    if (!pool.length)
        return { ...session, currentCardId: null };
    let used = [...session.usedCardIdsByLevel[level]];
    let order = session.orderByLevel[level];
    const allIds = cards.filter(c => c.level === level).map(c => c.id);
    if (order.length !== allIds.length || allIds.some(id => !order.includes(id)))
        order = shuffle(allIds, random);
    let available = pool.filter(c => !used.includes(c.id));
    if (!available.length) {
        used = [];
        order = shuffle(allIds, random);
        available = pool;
    }
    // At a cycle boundary avoid the immediately previous card whenever possible.
    const alternatives = available.filter(c => c.id !== session.currentCardId);
    if (alternatives.length)
        available = alternatives;
    const allowed = new Set(available.map(c => c.id));
    const id = order.find(id => allowed.has(id))!;
    return { ...session, currentCardId: id, usedCardIdsByLevel: { ...session.usedCardIdsByLevel, [level]: [...used, id] }, orderByLevel: { ...session.orderByLevel, [level]: order } };
}
