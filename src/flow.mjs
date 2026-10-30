// The café day: steps, customers per day, the ticket queue. Pure (no DOM).
export const STEPS = ['order', 'read', 'ticket', 'market', 'till', 'kitchen', 'serve', 'reward'];
export const CUSTOMERS_PER_DAY = 4;
// The glyphs she writes for a trace item: trace:<glyph> -> [glyph]; word:<w> -> its letters; caption:<c> -> its letters (spaces and punctuation dropped).
export function ticketQueue(item) {
  const i = String(item).indexOf(':'), kind = String(item).slice(0, i), v = String(item).slice(i + 1);
  if (kind === 'trace') return [v];
  if (kind === 'word') return v.split('');
  if (kind === 'caption') return v.split('').filter(c => /[A-Za-z0-9]/.test(c));
  return [];
}
export const afterReward = customer => (customer >= CUSTOMERS_PER_DAY ? 'closing' : 'cafe');
