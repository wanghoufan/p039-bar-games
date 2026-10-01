import type { Challenge, Level } from "./schema";
export function eligibleCards(cards: Challenge[], level: Level, disabled: string[]) {
    return cards.filter(card => card.level === level && !card.contentTags.some(tag => disabled.includes(tag)));
}
