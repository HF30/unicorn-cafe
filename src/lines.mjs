// Every line the game speaks, each with a STABLE lineId. main.mjs only ever speaks lines built here, so
// app/audio/voice/lines.json (written by `node tools/gen-lines.mjs`, shape [{id,text}]) is the complete script to record.
// A line is a pair [id, text]. Recorded files live at app/audio/voice/<id>.mp3 and are listed in app/audio/voice/manifest.json.
import prompts from '../content/prompts.json' with {type: 'json'};
import words from '../content/words.json' with {type: 'json'};
import cur from '../content/curriculum.json' with {type: 'json'};
import {soundButtons} from './reading.mjs';

// Pure sounds (curriculum-v1 P1 V1): one line ps_<grapheme> for every grapheme of the read ladder plus a-z. The text is what the TTS is asked to say;
// tools/gen-voice.mjs then clips a stop (b c d g j k p t ck) to its burst and stretches a long sound (f l m n r s v z ff ll ss zz sh th ng), so no text carries a trailing "uh".
export const PS_TEXT = {a: 'ah', b: 'bah', c: 'kah', d: 'dah', e: 'eh', f: 'fff', g: 'gah', h: 'hah', i: 'ih', j: 'jah', k: 'kah', l: 'lll', m: 'mmm', n: 'nnn', o: 'oh', p: 'pah', q: 'kwah', r: 'rrr', s: 'sss', t: 'tah', u: 'uh', v: 'vvv', w: 'wah', x: 'ks', y: 'yah', z: 'zzz',
  ck: 'kah', ff: 'fff', ll: 'lll', ss: 'sss', zz: 'zzz', qu: 'kwah', ch: 'chh', sh: 'shh', th: 'thh', ng: 'ng', wh: 'wah',
  ai: 'ay', ee: 'eee', igh: 'eye', oa: 'oh', oo: 'oo', ar: 'ahr', or: 'orr', ur: 'er', ow: 'ow', oi: 'oy', ear: 'eer', air: 'air', ure: 'yoor', er: 'er',
  ay: 'ay', ou: 'ow', ie: 'eye', ea: 'eee', oy: 'oy', ir: 'er', ue: 'oo', aw: 'aw', ew: 'oo', 'a-e': 'ay', 'i-e': 'eye', 'o-e': 'oh', 'u-e': 'yoo'};
export const GRAPHEMES = [...new Set([...cur.read.flatMap(r => r.gpcs || []), ...'abcdefghijklmnopqrstuvwxyz'])];
export const psId = g => 'ps_' + g.replace('-', '_');
export const pureSound = g => [psId(g), (PS_TEXT[g] || g) + '.'];
const NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const TENS = {30: 'thirty', 40: 'forty', 50: 'fifty'}; // the number clips beyond twenty (SPEC §15 MA11); 21-49 are a tens clip + a ones clip
const CLIPPED = n => n <= 20 || n in TENS;
const numParts = n => (CLIPPED(n) ? [`num_${n}`] : [`num_${Math.floor(n / 10) * 10}`, `num_${n % 10}`]);
const numWords = n => (n <= 20 ? NUM[n] : CLIPPED(n) ? TENS[n] : `${n >= 20 && n < 30 ? 'twenty' : TENS[Math.floor(n / 10) * 10]} ${NUM[n % 10]}`);
const MAXN = 10;           // largest order / count / budget
const MAXC = 12;           // largest number the child can count to on screen
export const FOODS = words.map(w => (typeof w === 'string' ? w : w.word));
const range = (a, b) => Array.from({length: b - a + 1}, (_, i) => a + i);
function range0(a, b, d) { const o = []; for (let v = a; v <= b; v += d) o.push(v); return o; }

// ---- fixed lines (id -> text). The prompts.json ids are included as they are. ----
export const FIXED = {
  ticket_start: 'Let’s write the order ticket.',
  ticket_pencil: 'Let’s write the order ticket. Tap the pencil.',
  lovely: 'Lovely tracing!',
  your_turn: 'Your turn. Finish the last path, then tap the tick.',
  watch_count: 'Watch me count.',
  watch_me: 'Watch me.',
  add_one_more: 'Add one more, then tap the basket.',
  pay_one_more: 'Pay one more coin, then tap the tick.',
  drag_pan: 'Drag the food into the pan.',
  drag_pan_first: 'Drag the food into the pan first.',
  stir_done: 'Delicious! Tap the plate to serve.',
  serve_plate: 'Tap the plate to give our customer their food.',
  sparkle_deco: 'Sparkle, sparkle! Thank you for caring for our café.',
  altogether: 'How many altogether?',
  // the café dog (wired by the integration pass; recorded now so the voice manifest is built once)
  buddy_nap: 'Buddy is having a little nap.',
  buddy_happy: 'Look, Buddy is so happy!',
  buddy_woof: 'Buddy says woof woof, great job!',
  buddy_follow: 'Buddy wants to come too!',
  buddy_shh: 'Shh, Buddy is sleeping.',
  buddy_good: 'Good boy, Buddy!',
  buddy_cooking: 'Buddy loves your cooking!',
  buddy_night: 'Night night, Buddy.',
  // kitchen v2 + the copy-me piano (D-2026-10-30-dg-kitchen-v2)
  kitchen_tap: 'Tap a food to open it.',
  kitchen_word: 'Trace the whole word.',
  scoop_that_many: 'Put in that many scoops.',
  scoop_tick: 'Now tap the tick.',
  new_day: 'Tap the sun for a new day!',
  // curriculum v1 P1 (D-2026-10-30-dg-curriculum-v1): the read step and the writing guides
  read_note: 'Read the note!', read_tap_dots: 'Tap each dot to hear the sounds.', read_blend: 'Now blend them together.', read_pick: 'Which picture is it?',
  read_got: 'You read the word!', read_listen: 'Listen again.', blend_q: 'What word is it?', trace_copy: 'Look, then copy it on your pad.',
  trace_study: 'Look closely and remember it.', trace_memory: 'Now write it from memory!', trace_hear_word: 'Listen, then write the word.',
  piano_listen: 'Listen to the unicorn, then play it back!',
  piano_turn: 'Your turn!',
  piano_done: 'Beautiful music!',
  note_c: 'C', note_d: 'D', note_e: 'E', note_f: 'F', note_g: 'G', note_a: 'A', note_b: 'B',
  animal_cat: 'cat', animal_duck: 'duck', animal_elephant: 'elephant', animal_frog: 'frog',
  animal_goat: 'goat', animal_alligator: 'alligator', animal_bear: 'bear', animal_chick: 'chick',
  // curriculum v1 P2 (SPEC §14 MU15 + PR1): the music ladder, the surprise sticker, the café shelf and process praise (it names what she did, never what she is).
  // sticker_book (the old "Every customer you serve earns a sticker" text) is retired: a changed text needs a new id (V6).
  beat_intro: 'Tap the lid with the music!', rhythm_intro: 'Listen, then tap it back!', highlow_q: 'High or low? Tap the one you heard!', card_intro: 'Play the notes on the card!',
  free_intro: 'Play anything on the black keys!', sing_along: 'Sing it with me!', sticker_surprise: 'A surprise! A sticker for your book!', shelf_line: 'Your dish goes on the café shelf!',
  sticker_book_v2: 'Your sticker book! Tap the curled arrow to visit the café.',
  praise_path: 'You started at the green dot and followed the whole path!', praise_listen: 'You listened and played it back!', praise_blend: 'You said each sound and blended the word!',
  praise_count: 'You counted every one!', praise_try: 'You kept trying until you got it!', praise_memory: 'You looked carefully and wrote it yourself!', praise_beat: 'You kept the beat!',
  praise_rhyme: 'You listened and found the rhyme!', praise_sound: 'You heard it and found it!',
  // curriculum v1 P3 (SPEC §15 MA11): maths M1-M14, shapes and Canadian coins
  flash_q: 'How many did you see?', how_many: 'How many?', cmp_more: 'Which plate has more?', cmp_fewer: 'Which plate has fewer?', cmp_same: 'Or are they the same?',
  path_roll: 'Roll the dice!', path_where: 'Where will you land?', hide_q: 'How many are hiding in the bag?', buddy_ate: 'Oh no, Buddy ate some!',
  tf_make10: 'How many more make ten?', tf_double: 'Double it!', tf_teen: 'Ten and some more. How many?', coin_tap: 'Tap the coin.', pay_cents: 'Pay with your coins.',
  another_way: 'Can you find another way?', give_change: 'Give the change.', shape_q: 'Tap the shape.', pattern_q: 'What comes next?', compose_q: 'Put the two triangles together!',
  shape_circle: 'circle', shape_square: 'square', shape_triangle: 'triangle', shape_rectangle: 'rectangle',
};
export const P = id => [id, prompts[id].say];          // a prompts.json line
export const F = id => [id, FIXED[id]];                 // a fixed line
export const num = n => [`num_${n}`, CLIPPED(n) ? numWords(n) : String(n)];
// money, in cents (SPEC §15 MA8): "thirty five cents" and "ten cent coin" are number clips + a carrier, nothing new recorded
export const centsLine = n => [`cents_${n}`, `${numWords(n)} cents`, [...numParts(n), 'c_cents']];
export const centCoin = v => [`centcoin_${v}`, `${numWords(v)} cent coin`, [...numParts(v), 'c_cent_coin']];
export const COIN_VALUES = [5, 10, 25], CENTS = range0(5, 50, 5);
// A line is [id, text, parts?]. `parts` (optional) = the short clip ids that, played back to back, say the line;
// without `parts` the line is its own clip (a full recorded sentence). Clips are recorded once each (tools/gen-voice.mjs).
const pl = (n, food) => (n === 1 ? food : food + 's');                         // "one bun" / "two buns"
const itemClip = (n, food) => (n === 1 ? `item_${food}` : `items_${food}`);
const coinClip = n => (n === 1 ? 'c_coin' : 'c_coins');
const coins = n => (n === 1 ? 'coin' : 'coins');
// carrier words/phrases recorded once and re-used by every combinatorial line
export const CARRIERS = {c_please: 'please', c_weneed: 'We need', c_and: 'and', c_more: 'more', c_itcosts: 'It costs', c_youhave: 'You have', c_foodcosts: 'The food costs', c_coin: 'coin', c_coins: 'coins', c_putin: 'Put in', c_scoop: 'scoop', c_scoops: 'scoops', c_use: 'use', c_rhymes: 'Which one rhymes with', c_tapletter: 'Tap the letter that says', c_tapword: 'Tap the word', c_cents: 'cents', c_cent_coin: 'cent coin'};
export const C = id => [id, CARRIERS[id]];                // a carrier phrase as a line
export const orderLine = (n, food) => [`order_${n}_${food}`, `${NUM[n]} ${pl(n, food)}, please.`, [`num_${n}`, itemClip(n, food), 'c_please']];
export const orderAdd = (a, b, food) => [`order_add_${a}_${b}_${food}`, `${NUM[a]} ${pl(a, food)}, and ${NUM[b]} more ${pl(b, food)}. How many altogether?`, [`num_${a}`, itemClip(a, food), 'c_and', `num_${b}`, 'c_more', itemClip(b, food), 'altogether']];
export const needLine = (n, food) => [`need_${n}_${food}`, `We need ${NUM[n]} ${pl(n, food)}.`, ['c_weneed', `num_${n}`, itemClip(n, food)]];
export const addIntro = (a, b) => [`add_${a}_${b}`, `${NUM[a]} and ${NUM[b]}. How many altogether?`, [`num_${a}`, 'c_and', `num_${b}`, 'altogether']];
export const weNeed = n => [`we_need_${n}`, `We need ${NUM[n]}.`, ['c_weneed', `num_${n}`]];
export const itCosts = n => [`it_costs_${n}`, `It costs ${NUM[n]} ${coins(n)}.`, ['c_itcosts', `num_${n}`, coinClip(n)]];
export const youHave = n => [`you_have_${n}`, `You have ${NUM[n]} ${coins(n)}.`, ['c_youhave', `num_${n}`, coinClip(n)]];
export const foodCosts = n => [`food_costs_${n}`, `The food costs ${NUM[n]} ${coins(n)}.`, ['c_foodcosts', `num_${n}`, coinClip(n)]];
export const scoopLine = n => [`scoop_${n}`, `Put in ${NUM[n]} ${n === 1 ? 'scoop' : 'scoops'}.`, ['c_putin', `num_${n}`, n === 1 ? 'c_scoop' : 'c_scoops']];
export const useLine = (have, use) => [`use_${have}_${use}`, `You have ${NUM[have]}. Use ${NUM[use]}.`, ['c_youhave', `num_${have}`, 'c_use', `num_${use}`]];
export const countTo = k => [`count_to_${k}`, range(1, k).map(i => NUM[i]).join(', ') + '.', range(1, k).map(i => `num_${i}`)];
// the sounds of a food word, then the food: "b, u, n, bun!" (sounds from the ps_ clips, the word from item_<w>)
const ALL_GPCS = cur.read.flatMap(r => r.gpcs || []);
export const wordSound = w => [`word_${w}`, `${w}.`, [...(soundButtons(w, ALL_GPCS) || [...w].map(c => ({g: c}))).map(b => psId(b.g)), `item_${w}`]];
// what she hears after a finished glyph: a letter's pure sound (or the digit) + praise; a stroke/form glyph has no sound
export const tracedLine = ch => [/^[a-z]$/i.test(ch) ? pureSound(ch.toLowerCase()) : /^\d$/.test(ch) ? num(Number(ch)) : null, F('lovely')].filter(Boolean);
// say_<w>: the word itself. A food reuses item_<w> (nothing new recorded); a few words reuse an existing clip.
const SAY_REUSE = {cat: 'animal_cat', duck: 'animal_duck', frog: 'animal_frog', goat: 'animal_goat', coin: 'c_coin'};
export const SAY_WORDS = [...new Set([...cur.read.flatMap(r => [...(r.pictures || []), ...(r.pairs || []).flat(), ...(r.tricky || [])])])];
export const sayWord = w => [`say_${w}`, w, FOODS.includes(w) ? [`item_${w}`] : SAY_REUSE[w] ? [SAY_REUSE[w]] : undefined];

// ---- the complete script ----
export function allLines() {
  const m = new Map();
  const add = ([id, text, parts]) => { if (m.has(id) && m.get(id)[0] !== text) throw new Error(`lineId clash: ${id}`); m.set(id, [text, parts]); };
  for (const id of Object.keys(prompts)) add(P(id));
  for (const id of Object.keys(FIXED)) add(F(id));
  for (const n of [...range(0, 20), 30, 40, 50]) add(num(n));
  for (const n of CENTS) add(centsLine(n));
  for (const v of COIN_VALUES) add(centCoin(v));
  for (const n of range(1, MAXN)) { add(weNeed(n)); add(itCosts(n)); add(youHave(n)); add(foodCosts(n)); }
  for (const k of range(1, MAXC - 1)) add(countTo(k));
  for (const n of range(1, MAXN)) add(scoopLine(n));
  for (let h = 2; h <= MAXN; h++) for (let u = 1; u < h; u++) add(useLine(h, u));
  for (const g of GRAPHEMES) add(pureSound(g));
  for (const w of SAY_WORDS) add(sayWord(w));
  for (const w of FOODS) add(wordSound(w));
  for (const food of FOODS) {
    for (const n of range(1, MAXN)) { add(orderLine(n, food)); add(needLine(n, food)); }
    for (let a = 1; a <= MAXN; a++) for (let b = 1; a + b <= MAXN; b++) add(orderAdd(a, b, food));
  }
  for (let a = 1; a <= MAXN; a++) for (let b = 1; a + b <= MAXN; b++) add(addIntro(a, b));
  return [...m].map(([id, [text, parts]]) => (parts ? {id, text, parts} : {id, text}));
}

// ---- the clips to record: a line with no `parts` is its own clip; the rest are built from carriers + items ----
export function allClips() {
  const clips = new Map();
  for (const l of allLines()) if (!l.parts) clips.set(l.id, l.text);
  for (const [id, t] of Object.entries(CARRIERS)) clips.set(id, t);
  for (const f of FOODS) { clips.set(`item_${f}`, f); clips.set(`items_${f}`, f + 's'); }
  return [...clips].map(([id, text]) => ({id, text}));
}
