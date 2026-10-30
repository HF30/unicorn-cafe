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
