import { challengeSchema } from "./schema";
export function loadChallenges(input: unknown[]) {
    const cards = input.map(card => challengeSchema.parse(card));
    if (new Set(cards.map(card => card.id)).size !== cards.length)
        throw new Error("Duplicate challenge ID");
    return cards;
}
