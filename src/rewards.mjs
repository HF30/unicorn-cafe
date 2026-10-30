// Stickers are a surprise, never pay (SPEC §14 RW3): at most one a day, with probability `chance` on a day that has none yet. Pure.
export const surpriseSticker = (day, givenDays, rng = Math.random, chance = 0.34) => !(givenDays || []).includes(day) && rng() < chance;
