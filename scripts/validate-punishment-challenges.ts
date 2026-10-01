import { challenges } from "../content/punishment/challenges";
import { loadChallenges } from "../lib/punishment/loadChallenges";
import { eligibleCards } from "../lib/punishment/filter";
import { levels, tags } from "../lib/punishment/schema";
const cards = loadChallenges(challenges);
const keys = Object.keys(tags);
for (const level of levels) {
    let empty = 0;
    for (let mask = 0; mask < 2 ** keys.length; mask++) {
        const disabled = keys.filter((_, i) => mask & (1 << i));
        if (!eligibleCards(cards, level, disabled).length)
            empty++;
    }
    console.log(`Level ${level}: ${cards.filter(c => c.level === level).length} samples; ${empty}/128 shield combinations empty`);
}
console.log("VALID: development samples; formal Human bank pending");
