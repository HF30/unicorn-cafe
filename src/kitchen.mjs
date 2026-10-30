// Kitchen helpers (pure): which two ingredients a dish needs, and the letters she traces for a whole word.
const word = w => String(typeof w === 'string' ? w : (w && w.word) || '');
export function pickIngredients(food, words, rng = Math.random) {
  const others = words.map(word).filter(w => w && w !== food);
  return [food, others.length ? others[Math.floor(rng() * others.length) % others.length] : food];
}
export const wordQueue = w => word(w).toLowerCase().split('');
// The food the customer orders (SPEC §13 E3): chosen AFTER the read task so her order never says the task's answer word
// (rhyme: the partner and the prompt word; blend/read: the word). A gpc/tricky task leaves it free; a list with no other food returns what it has.
export function orderFood(foods, task, rng = Math.random) {
  const list = foods.map(word).filter(Boolean), kind = task && task.kind;
  const avoid = kind === 'rhyme' ? [task.word, task.choices && task.choices[task.answer]] : kind === 'blend' || kind === 'read' ? [task.word] : [];
  const ok = list.filter(w => !avoid.includes(w)), pool = ok.length ? ok : list;
  return pool[Math.floor(rng() * pool.length) % pool.length];
}
// ---- real recipes (SPEC §16 RC4-RC6), from app/content/recipes.json ----
// The highest recipe tier whose minRead/minTrace she has reached (the tier list is data; the lowest tier is the floor).
export function recipeTier(recipes, readLevel, traceLevel) {
  const tiers = (recipes && recipes.tiers) || [];
  let best = tiers.length ? tiers[0].tier : 1;
  for (const t of tiers) if (readLevel >= t.minRead && traceLevel >= t.minTrace && t.tier > best) best = t.tier;
  return best;
}
// The words a recipe "contains": each ingredient word and each piece of its id split at "_".
const recipeWords = r => [...(r.ingredients || []).map(i => i.word), ...String(r.id).split('_')];
// A recipe of `tier` (random). Never one that contains the read task's answer word (rhyme: the prompt word and the answer; blend / read: the word) while the tier has another.
export function pickRecipe(recipes, tier, task, rng = Math.random) {
  const all = (recipes && recipes.recipes) || [], pool = all.filter(r => r.tier === tier), base = pool.length ? pool : all;
  const kind = task && task.kind;
  const avoid = (kind === 'rhyme' ? [task.word, task.choices && task.choices[task.answer]] : kind === 'blend' || kind === 'read' ? [task.word] : []).filter(Boolean);
  const ok = base.filter(r => !recipeWords(r).some(w => avoid.includes(w))), from = ok.length ? ok : base;
  return from[Math.floor(rng() * from.length) % from.length];
}
// One step per trace: ingredients in order, rep 1..qty -> {word, rep, qty}.
export const traceSteps = recipe => (recipe.ingredients || []).flatMap(i => Array.from({length: i.qty}, (_, k) => ({word: i.word, rep: k + 1, qty: i.qty})));
