import {SILENT,said} from './silent.mjs';
import cfg from '../config.json' with {type:'json'};
import assets from '../content/assets.json' with {type:'json'};
import glyphs from '../content/glyphs.json' with {type:'json'};
import cur from '../content/curriculum.json' with {type:'json'};
import prompts from '../content/prompts.json' with {type:'json'};
import {scoreTrace,scoreFree,strokeArrows} from './trace.mjs';
import {sessionPhase} from './session.mjs';
import {maxLevel,guideFor,phrasesFor,followNotes} from './curriculum.mjs';
import {mathTask,shapeTask,coinWays,payOk,numChoices} from './maths.mjs';
import {pickItem,recordItem,masteryLevel,nextGuide,dayKey,levelItems} from './mastery.mjs';
import {surpriseSticker} from './rewards.mjs';
import {readTask,pictureArt,decodable,decodableFoods,cumulativeGpcs} from './reading.mjs';
import words from '../content/words.json' with {type:'json'};
import {ticketQueue,afterReward} from './flow.mjs';
import {wordQueue,orderFood,recipeTier,pickRecipe,traceSteps,shopArt} from './kitchen.mjs';
import recipes from '../content/recipes.json' with {type:'json'};
import {freshProgress,startOver} from './progress.mjs';
import {armUnlock} from './unlock.mjs';
import {createCopyMe,createFollow,noteId,beatTimes,rhythmTimes,scoreTaps,beatPass,keyRange} from './music.mjs';
import {mountPiano} from './piano.mjs';
import {initPianoAudio,pianoContext,warmPiano,playNote,setPianoMusic} from './piano-audio.mjs';
import {imgHtml,armArt,panFrames,frames,status as artStatus,STICKERS} from './art.mjs';
import {createStage} from './stage.mjs';
import * as sound from './audio.mjs';
import {bounce,flyTo,coinDrop,sparkleBurst,popIn} from './fx.mjs';
import {speakSeq,unlockVoice,repeatLast} from './voice.mjs';
import * as L from './lines.mjs';
// The scene is PRE-RENDERED art (app/art/*.png, see _briefs/art-contract.md) drawn by stage.mjs; the old three.js scene (app/scene3d) is retired from this path.
const SKINS=['unicorn','princess','kitty','unicorn'];
const root=document.querySelector('#game');
armArt(document);
const stage=createStage(root);
const ui=document.createElement('div');ui.id='ui';root.append(ui);
const jump=new URLSearchParams(location.search).get('screen'); // ?screen=<name> = a testing jump: it NEVER writes the saved profile (SPEC MA10)
let saved;try{saved=JSON.parse(localStorage.getItem('unicorn-cafe')||'null');}catch{}
// Q8: a saved profile with no `items` key is kitchen-v2 or older: its read/trace levels meant something else, so they restart at 1 with an empty ledger and no guide steps; maths, music, stickers and settings are kept.
const migrated=!!saved&&typeof saved==='object'&&!Array.isArray(saved)&&!('items' in saved);
if(migrated)saved={...saved,read:1,trace:1,items:{},guide:{},readHistory:[],traceHistory:[],taskCount:{read:0,trace:0}};
const progress={...freshProgress(cfg),...saved}; // SPEC SO1: the day-1 profile lives in progress.mjs (Start over uses the same one)
progress.settings={music:true,limit:cfg.sessionLimitMinutes,read:0,trace:0,math:0,musicLevel:0,...progress.settings};
for(const k of ['readHistory','traceHistory','mathHistory'])if(!Array.isArray(progress[k]))progress[k]=[];
if(!(progress.read>=1))progress.read=1;if(!progress.items||typeof progress.items!=='object')progress.items={};if(!progress.guide||typeof progress.guide!=='object')progress.guide={};progress.taskCount={read:0,trace:0,music:0,math:0,shapes:0,...progress.taskCount};if(!Array.isArray(progress.shapesHistory))progress.shapesHistory=[];if(!(progress.shapes>=1))progress.shapes=1;if(!Array.isArray(progress.served))progress.served=[];if(!Array.isArray(progress.stickerDays))progress.stickerDays=[];
if(!Array.isArray(progress.musicHistory))progress.musicHistory=[];if(!(progress.music>=1))progress.music=1;if(!Array.isArray(progress.recipeBook))progress.recipeBook=[];
if(!Array.isArray(progress.stickerIds))progress.stickerIds=[];
progress.stickers=progress.stickerIds.length;
if(migrated&&!jump)try{localStorage.setItem('unicorn-cafe',JSON.stringify(progress));}catch{}
let demoShelf=null,surpriseOff=false; // ?screen= jumps only: a demo shelf and no random sticker, so a screenshot route never changes the saved profile
let kit={recipe:null,ings:[],reps:[],pot:[],cur:0},pianoUI=null,newRecipe=false;
let stage_='welcome',started=0,customer=0,order,traceQueue=[],traceAt=0,traceNext,misses=0,demonstrated=false,amount=0,paid=0,winddown=false,closed=false,gateTimer,viewToken=0,adultOpen=false,lastBg=null;
let clockCfg={limitMinutes:progress.settings.limit,windDownMinutes:cfg.windDownMinutes};
// ?today=YYYY-MM-DD overrides the day a pass is recorded on (testing the two-day mastery rule); otherwise the local date.
const today=()=>{const t=new URLSearchParams(location.search).get('today');return /^\d{4}-\d{2}-\d{2}$/.test(t||'')?t:dayKey(new Date());};
const save=()=>{if(jump)return;try{localStorage.setItem('unicorn-cafe',JSON.stringify(progress));}catch{}};
sound.setMusic(progress.settings.music!==false);setPianoMusic(progress.settings.music!==false);
// Speech goes through voice.mjs speak(lineId,text); every line is built in lines.mjs so it has a stable id (and is exported to audio/voice/lines.json).
function say(...lines){if(buddyPending){lines=[buddyPending,...lines];buddyPending=null;}speakSeq(lines);}
function speak(id){say(L.P(id));}
const art=(name,cls='')=>imgHtml(name,cls);
const item=(food,cls='')=>imgHtml('item_'+food,cls);
const legacy=(key,cls='')=>`<img class="${cls}" src="${assets[key]}" alt="" draggable="false">`;
const button=(id,content,label,cls='')=>`<button id="${id}" class="${cls}" aria-label="${label}">${content}</button>`;
const bind=(id,fn)=>{const el=document.getElementById(id);if(el)el.onclick=fn;};
const pad=n=>String(n).padStart(2,'0');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const snap=el=>{const r=el.getBoundingClientRect();return {getBoundingClientRect:()=>r};};
const idx=()=>stage_==='cafe'||stage_==='welcome'?customer:Math.max(0,customer-1);
const skin=()=>SKINS[idx()%SKINS.length];
const coinRow=(n,cls='')=>`<span class="coinrow ${cls}">${Array.from({length:n},()=>art('coin_s')).join('')}</span>`;
const priceOf=i=>order.budget?.items[i]?.price??1;
// Every food picture on the market and till is one of her recipe's ingredient arts (SPEC §17 MK1-MK3): the i-th picture of a group is shopArt(recipe, i).
const sa=i=>order&&order.recipe?shopArt(order.recipe,i):'item_'+(order&&order.food);
const shopImg=(i,cls='')=>art(sa(i),cls);
const priced=i=>`<span class="priced">${shopImg(i)}${coinRow(priceOf(i))}</span>`;
// The coin purse is always on screen at the market and the till: coin icon, a big numeral, and the real coins (tappable at the till).
function purse(total,left,tappable,bump){const slots=Array.from({length:total},(_,i)=>i<left?(tappable?button('coin'+i,art('coin_s'),'Pay one coin','pc'):art('coin_s','pc')):'<span class="slot"></span>').join('');return `<div class="purse" id="purse" aria-label="Coin purse"><span class="purse-icon">${art('coin_s')}</span><span class="num${bump?' bump':''}" id="purse-num">${left}</span><div class="heap">${slots}</div></div>`;}
const LEVELKEY={read:'read',trace:'trace',math:'math',music:'musicLevel'}; // settings.music is the music ON/OFF toggle, so music's parent override lives in settings.musicLevel
const level=skill=>Math.max(1,Math.min(maxLevel(cur,skill),progress.settings[LEVELKEY[skill]]||progress[skill]||1));

// ---- actors: where the sprites stand on each stage (percent of the 2360x1640 background; y = feet line, h = height) ----
// x,y = where the FEET stand (percent of the stage); s = size on the shared world scale (stage.mjs UNIT, manifest px_per_unit + ground_px).
// The girl's default spot is BEHIND the café counter (the 'counter' foreground occluder hides her feet); close-up scenes override it.
const girl=(o={})=>({id:'girl',char:'girl',anim:'idle',x:31,y:80,s:1,back:true,...o});
const cust=(o={})=>({id:'cust-'+idx(),char:skin(),anim:'idle',x:76,y:93,s:1,...o});
// ---- Buddy, the family dog: naps on the floor; wakes + wags when she gets something right; a tap makes him wag + woof. Every dog_* frame is optional (hidden if missing). ----
let buddyAnim='sleep',buddyWins=0,buddyPending=null,buddyNapped=false,buddyTimer,dogOK=false;
frames('dog','sleep').then(r=>{dogOK=r.real;}).catch(()=>{});
const BUDDY_LINES=['buddy_happy','buddy_woof','buddy_good','buddy_cooking'];
const toWag=()=>{buddyAnim='wag';stage.actor('buddy')?.play('dog','wag');};
const buddy=(o={})=>({id:'buddy',char:'dog',anim:buddyAnim,loop:buddyAnim!=='wake',then:buddyAnim==='wake'?toWag:undefined,x:40,y:98.5,s:1,hit:{id:'buddy',label:'Pet Buddy',quiet:true},...o});
const dogHere=()=>{const a=stage.actor('buddy');return !!(a&&a.real);};
function wakeBuddy(){const a=stage.actor('buddy');if(!a||!a.real)return false;buddyAnim='wake';a.play('dog','wake',{loop:false,then:toWag});clearTimeout(buddyTimer);buddyTimer=setTimeout(()=>{buddyAnim='sleep';stage.actor('buddy')?.play('dog','sleep');},3400);return true;}
// She got something right: Buddy wakes + wags; every ~3rd success he also says a line (queued onto the next thing the game says, so it never cuts it off).
function cheerBuddy(){if(!wakeBuddy())return;buddyWins++;if(buddyWins%3===0)buddyPending=L.F(BUDDY_LINES[(buddyWins/3-1)%BUDDY_LINES.length]);}
function petBuddy(){if(!wakeBuddy())return;say(L.F('buddy_woof'));}
// First time he is seen asleep in a session: "a little nap" / "shh, sleeping" (once).
function napLine(){if(buddyNapped||!dogOK)return [];buddyNapped=true;return [Math.random()<.5?L.F('buddy_nap'):L.F('buddy_shh')];}
function frame(background,index,actors=[],fg=null){if(pianoUI){pianoUI.destroy();pianoUI=null;}const same=lastBg===background;lastBg=background;viewToken++;
 stage.scene(background,actors.map(a=>({...a,keepPos:same&&a.keepPos!==false})),fg);bind('buddy',petBuddy);
 const on=progress.settings.music!==false;
 ui.className=same?'':'enter';
 ui.innerHTML=`<header>${button('parent',art('ui_settings'),'Parent controls','artbtn')}<div class="route" aria-hidden="true">${[0,1,2,3,4,5].map(i=>`<span class="${i<=index?'active':''}"></span>`).join('')}</div><div class="hright">${button('repeat','&#128266;','Hear again','glyph')}${button('music',art(on?'ui_music':'ui_music_off'),'Music on or off','artbtn')}</div></header><section class="scene" id="scene"></section>`;
 bind('repeat',repeatLast);
 bind('music',()=>{progress.settings.music=!(progress.settings.music!==false);save();sound.setMusic(progress.settings.music);setPianoMusic(progress.settings.music);document.getElementById('music').innerHTML=art(progress.settings.music?'ui_music':'ui_music_off');});
 const parent=document.getElementById('parent');parent.onpointerdown=e=>{parent.setPointerCapture(e.pointerId);gateTimer=setTimeout(adultGate,cfg.adultGate.holdMs);};for(const event of ['pointerup','pointercancel','lostpointercapture'])parent.addEventListener(event,()=>clearTimeout(gateTimer));return document.getElementById('scene');}
const earnedRow=(max=6,cls='')=>`<div class="stickers ${cls}">${progress.stickerIds.slice(-max).map(id=>art('sticker_'+pad(id%STICKERS),'sticker-s')).join('')}</div>`;

function welcome(){stage_='welcome';const scene=frame('bg_cafe',-1,[girl({anim:'wave'}),cust({hit:{id:'open',label:'Tap unicorn to open café'}}),buddy()],'counter');bind('open',()=>{sound.unlock();sound.sfx('sparkle');stage.actor('girl')?.bounce();unlockVoice();started=Date.now();navigator.storage?.persist?.().catch(()=>{});say(L.P('welcome'),...napLine());cafe();});document.getElementById('open')?.classList.add('hint');return scene;}
function phase(){return sessionPhase(Date.now()-started,clockCfg,{taskInProgress:!['cafe','reward','wait','book','closed','piano_free'].includes(stage_)});}
function cafe(){if(checkClock())return;stage_='cafe';const id='cust-'+idx();const fresh=!stage.actor(id);
 const scene=frame('bg_cafe',0,[girl({anim:'idle'}),cust({anim:fresh?'walk':'idle',x:fresh?125:76,hit:{id:'customer',label:'Hear customer order'}}),buddy()],'counter');
 scene.insertAdjacentHTML('beforeend',button('book',art('sticker_'+pad(progress.stickerIds.at(-1)??0),'bookimg'),'Open sticker book','artbtn bookbtn')+button('pianoFree','&#127929;','Play the piano','glyph pianobtn')+earnedRow()+shelfHtml());
 if(fresh){const a=stage.actor(id);const walkSound=setInterval(()=>sound.sfx('plop',{rate:1.4}),500);a?.moveTo(76,2600,()=>{clearInterval(walkSound);a.play(skin(),'idle');});setTimeout(()=>clearInterval(walkSound),3000);}
 document.getElementById('customer')?.classList.add('hint');
 bind('book',stickerBook);bind('pianoFree',pianoFree);bind('customer',()=>newOrder());}
function stickerBook(){stage_='book';const scene=frame('bg_cafe',5,[girl({anim:'idle'})],'counter');scene.innerHTML=`<div class="panel book">${Array.from({length:STICKERS},(_,i)=>`<span class="slotcell">${art('sticker_'+pad(i),'sticker-b'+(progress.stickerIds.includes(i)?'':' locked'))}</span>`).join('')}${progress.recipeBook.length?`<div class="recipes">${progress.recipeBook.map(id=>recipes.recipes.find(r=>r.id===id)).filter(Boolean).map(r=>recipeCard(r,'small')).join('')}</div>`:''}${button('back',art('ui_back'),'Back to café','artbtn')}</div>`;say(L.F('sticker_book_v2'));bind('back',()=>{sound.sfx('back');cafe();});}
// The recipe card (SPEC §16 RC7): one ring per ingredient, in order, each holding `qty` pictures of its art (pictures only: the word is for tracing).
const recipeCard=(r,cls='')=>`<div class="recipe-card ${cls}" data-recipe="${r.id}" aria-label="Recipe: ${r.name}"><div class="rc-name">${r.name}</div><div class="rc-rings">${r.ingredients.map(i=>`<span class="ring">${Array.from({length:i.qty},()=>art(i.art,'rc-img')).join('')}</span>`).join('')}</div></div>`;
function newOrder(){if(checkClock())return;if(afterReward(customer)==='closing'){goodbye(true);return;}customer++;const tw=foodList();pending=chooseRead();const food=orderFood(tw,pending.t,Math.random);mpend=chooseMath();const mk=mpend.market;
 const rcp=pickRecipe(recipes,recipeTier(recipes,level('read'),level('trace')),pending.t,Math.random); // the recipe never contains the read task's answer word (RC5)
 const kIng=new Set(rcp.ingredients.map(i=>i.word)).size; // every ingredient of her recipe is bought at least once: count = max(maths n, distinct ingredients) (SPEC §17 MK1; D-2026-10-30-dg-v32-polish)
 if(mk&&mk.t.mechanic==='market'&&mk.t.answer<kIng){const t2=mathTask(cur,'count:'+kIng,Math.random);mpend.market=t2.mechanic==='market'?{...mk,t:t2}:{...mk,t:{...mk.t,n:kIng,answer:kIng,choices:numChoices(kIng,1,Math.max(mk.t.tenframe?10:5,kIng+1),Math.random)}};} // a count below the recipe size picks the recipe-compatible count task; the range is never exceeded (market levels reach 5+, recipes have 4 at most)
 const mk2=mpend.market;
 order={food,word:food,recipe:rcp};order.n=Math.max(mk2&&mk2.t.mechanic==='market'?mk2.t.answer:1+Math.floor(Math.random()*5),kIng);newRecipe=false;showOrder();}
function showOrder(){stage_='order';const rcp=order.recipe;
 const talk=cust({anim:'order',keepPos:true});const scene=frame('bg_cafe',0,[girl({anim:'idle'}),talk,buddy()],'counter');
 scene.innerHTML=`<div class="panel orderpanel">${recipeCard(rcp)}${button('ticket','&#128221;','Read the note','primary')}</div>`;
 const token=viewToken;setTimeout(()=>{if(viewToken===token)stage.actor(talk.id)?.play(skin(),'idle');},5200);
 say(L.recipeLine(rcp),L.F('read_note'));bind('ticket',()=>startRead());}
// ---- the read step (screen `read`): ONE read task chosen by pickItem between the order and the ticket (SPEC §13 E1-E5) ----
let task=null,readState=null,traceReview=false,traceWorst='first',traceKey='',traceIcon='jam',studyHold=0;
const lastKey={read:undefined,trace:undefined},outcomes=[];
// Which pic_<word> files have art yet (the art agent's manifest): a distractor card without art is re-rolled when another choice has some; a missing manifest just means "unknown".
let PICS=null;try{PICS=new Set((await import('../art/pictures.manifest.json',{with:{type:'json'}})).default.files.map(f=>f.file.replace(/\.png$/,'')));}catch{}
const hasArt=w=>{const n=pictureArt(cur,w);return !n.startsWith('pic_')||!PICS||PICS.has(n);};
const FOODS=words.map(w=>typeof w==='string'?w:w.word);
// The foods she can read at her read level (when there are at least two), else every food.
const foodList=()=>{const d=decodableFoods(cur,level('read'),FOODS);return d.length>=2?d:FOODS;};
const RANK={first:0,retry:1,demo:2},worst=(a,b)=>RANK[b]>RANK[a]?b:a;
const outcomeNow=()=>demonstrated?'demo':misses?'retry':'first';
// One task counter per skill (progress.taskCount): every 3rd task from level 2 up is review, the rest are the current level's least-practised item.
function pickKey(skill){const n=progress.taskCount[skill]|0,p=pickItem(cur,skill,level(skill),progress.items,n,Math.random,{last:lastKey[skill],guides:progress.guide,readLevel:level('read')});progress.taskCount[skill]=n+1;if(!p.review)lastKey[skill]=p.key;save();return p;}
// What she hears. Nothing here says the answer word before the right pick (E3): rhyme says the prompt word, blend/read play pure sounds only.
const promptLines=t=>t.kind==='rhyme'?[L.C('c_rhymes'),L.sayWord(t.word)]:t.kind==='blend'?[...t.sounds.map(g=>L.pureSound(g)),L.F('blend_q')]:t.kind==='gpc'?[L.C('c_tapletter'),L.pureSound(t.gpc)]:t.kind==='tricky'?[L.C('c_tapword'),L.sayWord(t.word)]:[L.F('read_pick')];
const introLines=t=>t.kind==='read'?[L.F('read_note'),L.F('read_tap_dots')]:promptLines(t);
const answerLines=t=>t.kind==='gpc'?[L.pureSound(t.gpc)]:[L.sayWord(t.choices[t.answer])];
const cardHtml=(t,c)=>t.kind==='gpc'?`<span class="ttext">${c.replace('-','_')}</span>`:t.kind==='tricky'?`<span class="ttext word">${c}</span>`:art(pictureArt(cur,c),'pic');
function noteHtml(t){
 if(t.kind==='read')return `<div class="wordrow">${t.buttons.map(b=>`<button class="sound-btn ${b.g.length>1?'bar':'dot'}" data-g="${b.g}" aria-label="Sound">${b.g.replace('-','_')}</button>`).join('')}</div>${button('blend','&#9654;&#9654;','Blend the sounds','blendbtn')}`;
 return `${t.kind==='rhyme'&&hasArt(t.word)?art(pictureArt(cur,t.word),'pic prompt'):''}${button('hear','&#128266;','Hear it again','hearbtn')}`;}
// The read task is chosen when the order is taken (so the order's food can avoid its answer word, E3); `pending` carries it to the read screen.
let pending=null;
function chooseRead(force){const p=force?{key:force,review:false}:pickKey('read');let t=readTask(cur,p.key,Math.random);for(let k=0;k<40&&['rhyme','blend','read'].includes(t.kind)&&!t.choices.every(hasArt);k++)t=readTask(cur,p.key,Math.random);return {p,t};}
function startRead(force){stage_='read';misses=0;demonstrated=false;const {p,t}=force||!pending?chooseRead(force):pending;pending=null;
 readState={t,picks:[],done:false};task={skill:'read',kind:t.kind,item:t.item,review:p.review,answer:t.answer,choices:t.choices,guide:null,screen:'read',orderFood:order&&order.food};drawRead();say(...introLines(t));}
// The choices are the three cards #pick0 #pick1 #pick2 (pictures, letter tiles or printed words by task kind).
function drawRead(){const t=readState.t,scene=frame('bg_ticket',1,[girl({anim:'think',x:12,y:108,s:.9,back:false}),cust({anim:'idle',x:88,y:106,s:.8})]);
 scene.innerHTML=`<div class="panel read-panel"><div class="note ${t.kind}">${noteHtml(t)}</div><div class="picks">${t.choices.map((c,i)=>button('pick'+i,cardHtml(t,c),'Choice '+(i+1),'pickcard')).join('')}</div></div>`;
 scene.querySelectorAll('.sound-btn').forEach(b=>{b.onclick=()=>say(L.pureSound(b.dataset.g));});
 bind('blend',()=>say(L.F('read_blend'),...t.buttons.map(b=>L.pureSound(b.g)),L.F('read_pick')));
 bind('hear',()=>say(...promptLines(t)));
 t.choices.forEach((_,i)=>bind('pick'+i,()=>onPick(i)));}
function onPick(i){const st=readState,t=st&&st.t;if(!st||st.done)return;st.picks.push(i);const card=document.getElementById('pick'+i);
 if(i===t.answer){st.done=true;const o=outcomeNow(),token=viewToken;
  progress.items=recordItem(progress.items,t.item,o,today());progress.readHistory=[...progress.readHistory,o].slice(-50);
  progress.read=masteryLevel(cur,'read',progress.read,progress.items,progress.readHistory,{});outcomes.push({skill:'read',item:t.item,outcome:o});save();
  card?.classList.add('right');sound.sfx('sparkle');if(card)sparkleBurst(card,{n:12});cheerBuddy();
  const pr=o==='first'?(t.kind==='rhyme'?'praise_rhyme':t.kind==='gpc'||t.kind==='tricky'?'praise_sound':'praise_blend'):o==='retry'?'praise_try':null;say(...answerLines(t),L.F(t.kind==='gpc'?'lovely':'read_got'),...(pr?[L.F(pr)]:[]));setTimeout(()=>{if(viewToken===token)startTrace();},pr?4800:2400);}
 else{misses++;card?.classList.add('dim');
  if(misses>=cfg.retry.maxBeforeDemo){demonstrated=true;document.getElementById('pick'+t.answer)?.classList.add('demo');say(...answerLines(t));}
  else say(L.F('read_listen'),...promptLines(t));}}

// ---- the ticket: she writes the trace item pickItem chose, each glyph at its own guide step (g1 demo+dotted+arrows ... g5 from memory) ----
const GLYPH_MARK={stroke_down:'\u2193',stroke_across:'\u2192',circle_ccw:'\u25CB',cross:'+',diag_right:'/',diag_left:'\\',square:'\u25A1',x_cross:'\u00D7',triangle:'\u25B3'};
const markOf=c=>GLYPH_MARK[c]||c;
const guideLines=g=>g>=5?[L.F('trace_study')]:g===4?[L.F('trace_copy')]:[L.P('trace_intro')];
// The model glyph beside the pad (g4) or the study glyph with numbered arrows (g5); an inline SVG so it never needs art.
function modelHtml(glyph,numbered){const P=v=>(10+v*80).toFixed(1);
 const lines=glyph.strokes.map(s=>`<polyline points="${s.map(([x,y])=>P(x)+','+P(y)).join(' ')}" fill="none" stroke="#7d57b3" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
 const nums=numbered?strokeArrows(glyph).map(a=>{const ux=Math.cos(a.angle),uy=Math.sin(a.angle),x=10+a.x*80,y=10+a.y*80,bx=x-ux*10,by=y-uy*10,tx=x+ux*20,ty=y+uy*20;
  return `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="7" fill="#3fae6a"/><text x="${bx.toFixed(1)}" y="${(by+2.6).toFixed(1)}" font-size="9" font-weight="900" text-anchor="middle" fill="#fff">${a.n}</text><polygon points="${tx.toFixed(1)},${ty.toFixed(1)} ${(x+ux*9-uy*5).toFixed(1)},${(y+uy*9+ux*5).toFixed(1)} ${(x+ux*9+uy*5).toFixed(1)},${(y+uy*9-ux*5).toFixed(1)}" fill="#3fae6a"/>`;}).join(''):'';
 return `<svg class="trace-model" viewBox="0 0 100 100" aria-label="Model">${lines}${nums}</svg>`;}
function startTrace(force){stage_='ticket';const p=force?{key:force,review:false}:pickKey('trace');traceKey=p.key;traceReview=p.review;traceQueue=ticketQueue(p.key);traceAt=0;traceNext=market;traceIcon=order.food;traceWorst='first';misses=0;demonstrated=false;
 if(!traceQueue.length||!traceQueue.every(c=>glyphs[c])){market();return;}
 const r=traceScreen();say(L.F('ticket_start'),...r.lines);}
// E4: every letter she writes on a kitchen tile is a trace outcome `trace:<letter>`: ledger, guide step, history and the level rule.
function glyphDone(name,o,kt){progress.guide[name]=nextGuide(progress.guide[name],o);traceWorst=worst(traceWorst,o);misses=0;demonstrated=false;
 if(kt){progress.items=recordItem(progress.items,'trace:'+name,o,today());progress.traceHistory=[...progress.traceHistory,o].slice(-50);progress.trace=masteryLevel(cur,'trace',progress.trace,progress.items,progress.traceHistory,{guides:progress.guide,readLevel:level('read')});outcomes.push({skill:'trace',item:'trace:'+name,outcome:o,kitchen:true});}save();}
// Trace level moves ONLY by masteryLevel (never nextLevel): the whole item's outcome goes to the ledger, the history and the level rule.
function finishTraceItem(){const o=traceWorst;progress.items=recordItem(progress.items,traceKey,o,today());progress.traceHistory=[...progress.traceHistory,o].slice(-50);
 progress.trace=masteryLevel(cur,'trace',progress.trace,progress.items,progress.traceHistory,{guides:progress.guide,readLevel:level('read')});outcomes.push({skill:'trace',item:traceKey,outcome:o});save();}
function traceScreen(){const kt=stage_==='kitchen_trace',name=traceQueue[traceAt],glyph=glyphs[name],gs0=progress.guide[name]||{g:1,run:0,demos:0},gs=!kt&&/^(word|caption):/.test(traceKey)?{...gs0,g:5}:gs0,gd=guideFor(cur,gs.g)||{},free=gd.scorer==='free',arrows=strokeArrows(glyph);
 task={skill:'trace',kind:kt?'word':'trace',item:traceKey,glyph:name,glyphs:traceQueue,guide:gs.g,review:kt?false:traceReview,answer:null,screen:stage_,...(kt?{word:traceIcon,rep:stepNow().rep,qty:stepNow().qty}:{})};
 const scene=frame(kt?'bg_kitchen_nopan':'bg_ticket',kt?4:1,[girl({anim:'think',x:12,y:108,s:.9,back:false}),...(kt?[]:[cust({anim:'idle',x:88,y:106,s:.8})])]);
 const modelH=gd.model?modelHtml(glyph,gd.model==='memory'&&gd.studyArrows):'',padH=`<div class="trace-wrap"><canvas id="trace" width="600" height="600" aria-label="Finger tracing board"></canvas></div>`,btnH=`<div class="row">${button('erase',art('ui_undo'),'Clear trace','artbtn')}${button('done',art('ui_check'),'Check trace','artbtn')}</div>`;
 // kitchen (SPEC §16 KT2): the WHOLE word #kword stays up the whole task, one .kletter per letter, the one being traced is .current; the pot with its "rep of qty" count sits beside the pad
 scene.innerHTML=kt?`<div class="panel trace-panel ktrace"><div class="krow">${art(kit.ings[kit.cur].art,'kicon')}<div id="kword" class="kword" data-rep="${stepNow().rep}" data-qty="${stepNow().qty}" aria-label="The word to trace">${traceQueue.map((c,k)=>`<span class="kletter${k===traceAt?' current':''}${k<traceAt?' done':''}">${c}</span>`).join('')}</div></div><div class="kbody"><div class="kmodel">${modelH}</div>${padH}${kPotHtml()}</div>${btnH}</div>`
  :`<div class="panel trace-panel">${modelH}<div class="row">${traceQueue.map((c,k)=>`<span class="trace-target${k===traceAt?'':' dim'}" data-glyph="${c}">${markOf(c)}</span>`).join('')}${item(traceIcon,'mini')}</div>${padH}${btnH}</div>`;
 const canvas=document.getElementById('trace'),ctx=canvas.getContext('2d');let strokes=[],active=null,busy=gd.model==='memory';const token=viewToken;
 const X=v=>60+v*480;
 const path=(s,color,width)=>{if(!s.length)return;ctx.beginPath();s.forEach(([x,y],i)=>i?ctx.lineTo(X(x),X(y)):ctx.moveTo(X(x),X(y)));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap=ctx.lineJoin='round';ctx.stroke();};
 let lift=performance.now();
 const along=(s,f)=>{const c=[0];for(let i=1;i<s.length;i++)c.push(c[i-1]+Math.hypot(s[i][0]-s[i-1][0],s[i][1]-s[i-1][1]));const d=Math.max(0,Math.min(1,f))*c.at(-1);let i=1;while(i<s.length-1&&c[i]<d)i++;const k=c[i]>c[i-1]?Math.min(1,(d-c[i-1])/(c[i]-c[i-1])):0;return [s[i-1][0]+(s[i][0]-s[i-1][0])*k,s[i-1][1]+(s[i][1]-s[i-1][1])*k];};
 const star=(x,y,r,rot)=>{ctx.beginPath();for(let i=0;i<8;i++){const a=rot+i*Math.PI/4,q=i%2?r*.55:r;ctx.lineTo(x+Math.cos(a)*q,y+Math.sin(a)*q);}ctx.closePath();};
 // g1/g2: for each stroke its number (fillText) in a badge before the start and an arrowhead along the first segment (strokeArrows).
 const drawArrows=()=>{ctx.save();ctx.font='900 30px ui-rounded,system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  for(const a of arrows){const ux=Math.cos(a.angle),uy=Math.sin(a.angle),bx=X(a.x)-ux*60,by=X(a.y)-uy*60,tx=X(a.x)+ux*58,ty=X(a.y)+uy*58;
   ctx.beginPath();ctx.arc(bx,by,22,0,Math.PI*2);ctx.fillStyle='#7d57b3';ctx.fill();ctx.fillStyle='#fff';ctx.fillText(String(a.n),bx,by+1);
   ctx.beginPath();ctx.moveTo(tx+ux*22,ty+uy*22);ctx.lineTo(tx-uy*14,ty+ux*14);ctx.lineTo(tx+uy*14,ty-ux*14);ctx.closePath();ctx.fillStyle='#7d57b3';ctx.fill();}
  ctx.restore();};
 const paint=(now=performance.now())=>{ctx.clearRect(0,0,600,600);if(gd.faintLetter)glyph.strokes.forEach(s=>path(s,'#e6d8f3',74));
  if(gd.dotted){ctx.save();ctx.setLineDash([1,24]);ctx.shadowColor='#d8b4ff';ctx.shadowBlur=16;glyph.strokes.forEach(s=>path(s,'#7d57b3',10));ctx.restore();}
  strokes.forEach(s=>path(s,'#8ba5cf',18));
  if(gd.numberedArrows)drawArrows();
  if(free)return;
  const done=strokes.filter(s=>s.length>3).length,over=done>=glyph.strokes.length&&active===null,ci=Math.min(done,glyph.strokes.length-1),mine=glyph.strokes[ci];
  glyph.strokes.forEach((s,i)=>{if(i===ci&&!over)return;ctx.beginPath();ctx.arc(X(s[0][0]),X(s[0][1]),10,0,Math.PI*2);ctx.fillStyle='#a9d3b9';ctx.fill();});
  if(over)return;
  const pulse=Math.sin(now/260),[sx,sy]=mine[0];
  ctx.beginPath();ctx.arc(X(sx),X(sy),46+pulse*6,0,Math.PI*2);ctx.fillStyle='#3fae6a33';ctx.fill();
  ctx.beginPath();ctx.arc(X(sx),X(sy),33,0,Math.PI*2);ctx.fillStyle='#3fae6a';ctx.fill();ctx.lineWidth=8;ctx.strokeStyle='#fff';ctx.stroke();
  if(gd.endpointsOnly){const [ex,ey]=mine.at(-1);ctx.beginPath();ctx.arc(X(ex),X(ey),26,0,Math.PI*2);ctx.fillStyle='#f59a23';ctx.fill();ctx.lineWidth=8;ctx.strokeStyle='#fff';ctx.stroke();}
  if(active!==null||gs.g!==1)return; // the animated demo only at g1
  const idle=now-lift,sit=done>0&&idle<1400;let f=0;if(!sit){const t=(idle-(done>0?1400:0))%2700;f=Math.min(1,t/1900);}
  for(let k=9;k>=1;k--){const g=Math.max(0,f-k*.035),[tx,ty]=along(mine,g);ctx.beginPath();ctx.arc(X(tx),X(ty),28-k*2.4,0,Math.PI*2);ctx.fillStyle=`rgba(255,205,77,${.62-k*.055})`;ctx.fill();}
  const [px,py]=along(mine,f),fade=f>=1?Math.max(0,1-((now-lift-(done>0?1400:0))%2700-1900)/500):1,r=(sit?58+pulse*6:54)*(.6+.4*fade);
  ctx.save();ctx.globalAlpha=fade;ctx.shadowColor='#ffcf4d';ctx.shadowBlur=46;star(X(px),X(py),r,now/900);ctx.fillStyle='#ffd24d';ctx.fill();ctx.lineWidth=4;ctx.strokeStyle='#fff';ctx.stroke();star(X(px),X(py),r*.45,-now/700);ctx.fillStyle='#fffbe0';ctx.fill();ctx.restore();};
 const tick=now=>{if(viewToken!==token||!canvas.isConnected)return;paint(now);requestAnimationFrame(tick);};
 const point=e=>{const r=canvas.getBoundingClientRect();return [((e.clientX-r.left)/r.width*600-60)/480,((e.clientY-r.top)/r.height*600-60)/480];};
 canvas.onpointerdown=e=>{if(active!==null||busy)return;e.preventDefault();canvas.setPointerCapture(e.pointerId);active=e.pointerId;strokes.push([point(e)]);paint();};canvas.onpointermove=e=>{if(e.pointerId!==active)return;e.preventDefault();strokes.at(-1).push(point(e));paint();};const end=e=>{if(e.pointerId===active){active=null;lift=performance.now();}};canvas.onpointerup=end;canvas.onpointercancel=end;
 bind('erase',()=>{if(!busy){strokes=[];lift=performance.now();paint();}});
 bind('done',()=>{if(active!==null||busy)return;const res=free?scoreFree(glyph,strokes,cfg.trace.free):scoreTrace(glyph,strokes,cfg.trace);
  if(res.pass){busy=true;const o=outcomeNow(),last=traceAt+1>=traceQueue.length;glyphDone(name,o,kt);if(gd.model==='memory'){const tg=document.querySelector('.trace-target:not(.dim)');if(tg)tg.textContent=markOf(name);}if(last&&!kt)finishTraceItem();
   const pr=last&&!kt?(traceWorst==='first'?(gs.g>=4?'praise_memory':'praise_path'):traceWorst==='retry'?'praise_try':null):null;
   sound.sfx('sparkle');sparkleBurst(canvas,{n:14});stage.actor('girl')?.play('girl','cheer',{loop:false,then:()=>stage.actor('girl')?.play('girl','think')});const tl=L.tracedLine(name);say(...(kt?[...tl.slice(0,1),...(last?[L.sayWord(traceIcon)]:[])]:[...tl,...(pr?[L.F(pr)]:[])]));if(kt)document.querySelectorAll('.kletter')[traceAt]?.classList.add('done');traceAt++;
   if(!last)setTimeout(()=>{if(viewToken===token){const r=traceScreen();if(r.model)say(...r.lines);}},700);else{const next=traceNext;setTimeout(()=>{if(viewToken===token)next();},kt?900:pr?5200:1800);}}
  else{misses++;if(misses>=cfg.retry.maxBeforeDemo){demonstrated=true;busy=true;speak('demo');const template=glyph.strokes.flatMap((s,i)=>s.map((p,j)=>({p,i,j})));let at=0;strokes=glyph.strokes.map(()=>[]);const animate=()=>{if(viewToken!==token)return;if(at<template.length){const {p,i}=template[at++];strokes[i].push(p);paint();setTimeout(animate,200);}else{const final=glyph.strokes.at(-1);strokes[strokes.length-1]=[final[0]];busy=false;paint();say(L.F('your_turn'));}};animate();}else speak('trace_hint');}});
 // g5: the model with numbered arrows stays for studyMs, then goes (removed from the page) before she writes.
 if(gd.model==='memory')setTimeout(()=>{if(viewToken!==token)return;document.querySelector('.trace-model')?.remove();document.querySelectorAll('.trace-target').forEach(el=>{if(el.dataset.glyph!==name)return;el.style.display='inline-block';el.style.minWidth=Math.max(24,el.getBoundingClientRect().width)+'px';el.textContent='';});busy=false;lift=performance.now();say(L.F('trace_memory'));},studyHold||gd.studyMs||3000);
 tick(performance.now());return {lines:guideLines(gs.g),model:!!gd.model};}
// ---- maths (SPEC §15 MA7-MA10): the market hosts the graded maths task of the level's mechanic; from M12 the till hosts it (real Canadian coins, spoken in cents) ----
// chooseMath() runs when the order is taken: 1 task in 6 is a shapes task (taskIndex % 6 === 5, drawn from shape levels 1..progress.shapes); maths moves by masteryLevel only.
let mpend=null,mstate=null;
const TILL_MECHS=['till','till_change'];
function chooseMath(){const n=progress.taskCount.math|0,lv=level('math'),due=n%6===5;let sh=null,gm=null;
 if(due){const p=pickKey('shapes');sh={t:shapeTask(cur,p.key,Math.random),skill:'shapes',review:p.review};if(lv<12){progress.taskCount.math=n+1;save();}}
 if(!due||lv>=12){const p=pickKey('math');gm={t:mathTask(cur,p.key,Math.random),skill:'math',review:p.review};}
 // Every task is drawn on the screen of ITS OWN mechanic: only till / till_change go to the till, so a count (market) review at M12-M14 goes to the market, never to an empty till panel (SPEC MA7).
 const atTill=!!gm&&TILL_MECHS.includes(gm.t.mechanic);
 return {market:sh||(gm&&!atTill?gm:null),till:atTill?gm:null};}
const shopFn=i=>sa(i);
const fr=(n,f,cls='',off=0)=>Array.from({length:Math.max(0,n)},(_,i)=>art(typeof f==='function'?f(i+off):f,'fruit '+cls)).join('');
const plateHtml=(n,f,ghost=0)=>`<div class="plate-wrap">${art('plate','plate-img')}<div class="onplate${n+ghost>6?' dense':''}">${fr(n,f)}${fr(ghost,f,'ghost',n)}</div></div>`;
const crateHtml=(cells,cls='')=>`<div class="crate ${cls}">${art('tenframe_crate','crate-img')}<div class="crate-cells">${Array.from({length:10},(_,i)=>`<span class="cell">${cells[i]||''}</span>`).join('')}</div></div>`;
const cells=(f,idxs)=>{const o=[];idxs.forEach((i,k)=>{o[i]=art(typeof f==='function'?f(k):f,'counter');});return o;};
const ttext=c=>`<span class="ttext">${c}</span>`;
const COIN_ART={5:'coin_5c',10:'coin_10c',25:'coin_25c'};
const coinImg=(v,cls='')=>art(COIN_ART[v],cls);
const coinLab=v=>coinImg(v); // the coin art carries NO value label (SPEC MA8): she learns the coin by its look, and hears the value when she taps it
const cardsHtml=(t,fmt)=>`<div class="picks mpicks">${t.choices.map((c,i)=>button('pick'+i,fmt(c),'Choice '+(i+1),'pickcard')).join('')}</div>`;
// compose:square — two pic_sandwich triangles are tapped (or dragged) into a square outline; the second one completes the square.
const composeHtml=m=>{const n=m.placed|0;return `<div class="compose"><div class="outline" id="outline" aria-label="Square outline">${Array.from({length:n},(_,k)=>art('pic_sandwich','half h'+k)).join('')}</div><div class="tris">${Array.from({length:2-n},(_,k)=>k).map(k=>button('tri'+k,art('pic_sandwich','pic'),'Triangle '+(k+1),'tri')).join('')}</div>${hearBtn()}</div>`;};
const hearBtn=()=>button('mhear','&#128266;','Hear it again','hearbtn');
const sumOf=a=>a.reduce((x,y)=>x+y,0);
const ansLines=t=>t.mechanic==='shapes'?(t.kind==='shape'||t.kind==='compose'?[L.F(`shape_${t.shape}`)]:[]):t.mechanic==='compare'?[]:t.mechanic==='till'&&t.item.startsWith('skip')?[L.centsLine(t.answer)]:t.mechanic==='till'?[L.centCoin(t.value)]:[L.num(t.answer)];
// What she hears for the task (the prompt); `again` is a hint: the prompt once more, after "Listen again."
function mathPrompt(){const m=mstate,t=m.t;
 if(t.mechanic==='flash')return [L.F('flash_q')];
 if(t.mechanic==='compare')return [L.F(t.ask==='fewer'?'cmp_fewer':'cmp_more'),L.F('cmp_same')];
 if(t.mechanic==='path')return [m.rolled?L.F('path_where'):L.F('path_roll')];
 if(t.mechanic==='hide')return [L.weNeed(t.whole),L.F('hide_q')];
 if(t.mechanic==='kitchen')return t.item.startsWith('add')?[L.addIntro(t.a,t.b)]:t.item.startsWith('take')?[L.num(t.a),L.F('buddy_ate'),L.F('how_many')]:[L.weNeed(t.c),L.C('c_youhave'),L.num(t.a),L.F('how_many')];
 if(t.mechanic==='tenframe')return [L.F(t.item.startsWith('make10')?'tf_make10':t.item.startsWith('double')?'tf_double':'tf_teen')];
 if(t.mechanic==='till')return t.item.startsWith('coin')?[L.F('coin_tap'),L.centCoin(t.value)]:t.item.startsWith('skip')?[L.F('how_many'),L.C('c_cents')]:m.way?[L.F('another_way')]:[L.centsLine(t.price),L.F('pay_cents')];
 if(t.mechanic==='till_change')return [L.centsLine(t.price),L.F('give_change')];
 if(t.mechanic==='shapes')return t.kind==='pattern'?[L.F('pattern_q')]:t.kind==='compose'?[L.F('compose_q')]:[L.F('shape_q'),L.F(`shape_${t.shape}`)];
 return [];}
const mathSay=(again,pre=[])=>say(...pre,...(again?[L.F('read_listen')]:[]),...mathPrompt());
// ---- starting a graded task on the market or till screen ----
function mathStart(host,pend){const sk=pend.skill==='shapes'?'shapes':'math',t=pend.t;
 mstate={...pend,host,picks:[],done:false,rolled:false,way:0,first:null,coins:[],follow:false,fruit:shopFn};misses=0;demonstrated=false;
 task={skill:pend.skill,mechanic:t.mechanic,kind:t.mechanic,item:t.item,review:!!pend.review,answer:t.answer,choices:t.choices&&[...t.choices],level:level(sk),guide:null,screen:host,outcome:null};
 mathDraw();if(t.mechanic==='kitchen'&&t.item.startsWith('take'))eatRun();mathSay();}
// Buddy eats b of the a things on the plate: they fade, only the rest stay solid.
function eatRun(){const m=mstate,tok=viewToken,op=document.querySelector('.onplate'),t=m.t;if(!op)return;op.innerHTML=fr(t.a,m.fruit);setTimeout(()=>{if(viewToken!==tok||m.done)return;op.innerHTML=fr(t.a-t.b,m.fruit)+fr(t.b,m.fruit,'ghost',t.a-t.b);},1300);}
function mathDraw(){const m=mstate,t=m.t,mech=t.mechanic,till=m.host==='till',f=m.fruit;
 const actors=[girl({anim:'idle',x:till?12:20.5,y:till?108:99,s:.95,back:false})];if(mech==='kitchen'&&t.item.startsWith('take'))actors.push(buddy({x:88,y:99,anim:'wag',loop:true}));
 const scene=frame(till?'bg_till':'bg_market',3,actors);let body='',wide=false,fmt=ttext;
 if(mech==='flash'){body=`${plateHtml(t.n,f)}<div id="mslot" class="mslot">${cardsHtml(t,ttext)}</div>${hearBtn()}`;}
 else if(mech==='compare'){wide=true;body=`<div class="cmprow"><div class="side">${art('unicorn_idle_00','cface')}${button('pick0',plateHtml(t.a,f),'Left plate','plate-btn')}</div>${button('pick2','=','The same','same-btn')}<div class="side">${art('kitty_idle_00','cface')}${button('pick1',plateHtml(t.b,f),'Right plate','plate-btn')}</div></div>${hearBtn()}`;}
 else if(mech==='path'){wide=true;const dieFace=m.rolled?(t.step<0?`<span class="back">&#8630;</span><b>1</b>`:Array.from({length:t.step},()=>'<i class="pip"></i>').join('')):'<b>?</b>',at=m.at||t.from;
  body=`<div class="path" id="path">${Array.from({length:10},(_,k)=>button('sq'+(k+1),`<b>${k+1}</b>${at===k+1?art('sticker_02','token'):''}`,'Square '+(k+1),'path-square'+(m.hop&&k+1>Math.min(t.from,t.answer)&&k+1<=Math.max(t.from,t.answer)?' hop':'')+(m.demoSq===k+1?' demo':''))).join('')}</div><div class="row">${button('die',dieFace,'Roll the dice','die'+(m.rolled?' rolled':' pulse')+(t.step<0?' minus':''))}${hearBtn()}</div>`;}
 else if(mech==='hide'){body=`<div class="hidewrap"><span class="bignum">${t.whole}</span>${plateHtml(t.shown,f)}<div class="bagwrap">${art('pic_bag','bag')}<div class="reveal">${m.done?fr(t.answer,f):''}</div></div></div>${cardsHtml(t,ttext)}${hearBtn()}`;}
 else if(mech==='kitchen'){const a=t.item.startsWith('add'),tk=t.item.startsWith('take');wide=a;
  body=a?`<div class="story">${plateHtml(t.a,f)}<span class="bignum">+</span>${plateHtml(t.b,f)}</div>`:tk?`${plateHtml(t.a,f)}`:`<div class="story"><span class="bignum">${t.a}</span>${plateHtml(t.a,f)}<span class="bignum">+ ? = ${t.c}</span></div>`;body+=cardsHtml(t,ttext)+hearBtn();}
 else if(mech==='tenframe'){wide=t.item.startsWith('teen');
  const idx=n=>Array.from({length:n},(_,i)=>i);
  body=t.item.startsWith('make10')?crateHtml(cells(shopFn,idx(t.k))):t.item.startsWith('double')?crateHtml(cells(shopFn,[...idx(t.k),...idx(t.k).map(i=>i+5)])):`<div class="story">${crateHtml(cells(shopFn,idx(10)))}${crateHtml(cells(shopFn,idx(t.n-10)))}</div>`;body+=cardsHtml(t,ttext)+hearBtn();}
 else if(mech==='till'&&t.item.startsWith('coin')){fmt=v=>coinImg(v,'pic');body=`<div class="coinprompt">${hearBtn()}</div>${cardsHtml(t,fmt)}`;}
 else if(mech==='till'&&t.item.startsWith('skip')){body=`<div class="coinrow2">${Array.from({length:t.count},(_,i)=>button('sc'+i,coinLab(t.step),'Coin '+(i+1),'skipcoin')).join('')}</div>${cardsHtml(t,v=>ttext(v+'&cent;'))}${hearBtn()}`;}
 else if(mech==='till'||mech==='till_change'){wide=true;const pr=mech==='till',tot=sumOf(m.coins),opts=pr?t.coins:t.coins.filter(c=>c<=t.answer);
  body=`<div class="changerow">${shopImg(0)}<span class="pricetag">${t.price}&cent;</span>${pr?'':`<span class="pays">${coinImg(t.pay)}</span>`}</div><div class="paidrow" id="paid">${m.coins.map((c,i)=>button('paid'+i,coinLab(c),'Take back the '+c+' cent coin','paidcoin')).join('')}<span class="total">${tot}&cent;</span></div><div class="coinbtns">${opts.map(c=>button('c'+c,coinLab(c),'Add the '+c+' cent coin','coinbtn')).join('')}${button('till',art('ui_check'),'Check payment','artbtn')}${hearBtn()}</div>`;}
 else if(mech==='shapes'){const k=t.kind;wide=k!=='shape';fmt=c=>art(c,'pic');
  body=k==='pattern'?`<div class="patrow">${t.seq.map(p=>art(p,'patpiece')).join('')}<span class="patq">?</span></div>${cardsHtml(t,fmt)}${hearBtn()}`:k==='compose'?composeHtml(m):`${cardsHtml(t,fmt)}${hearBtn()}`;}
 scene.innerHTML=`<div class="panel mathpanel mm-${mech}${wide?' wide':''}">${body}</div>`;
 bind('mhear',()=>mathSay());
 if(mech==='shapes'&&t.kind==='compose')for(const k of[0,1])bind('tri'+k,()=>mathCompose(k));
 (t.choices||[]).forEach((_,i)=>bind('pick'+i,()=>mathPick(i)));
 if(mech==='path'){bind('die',mathRoll);for(let k=1;k<=10;k++)bind('sq'+k,()=>mathSquare(k));}
 if(mech==='till'&&t.item.startsWith('skip'))for(let i=0;i<t.count;i++)bind('sc'+i,()=>{sound.coin();say(COIN_ART[t.step]?L.centCoin(t.step):L.centsLine(t.step));});
 if(mech==='till_change'||(mech==='till'&&t.item.startsWith('price'))){for(const c of(mech==='till'?t.coins:t.coins.filter(c=>c<=t.answer)))bind('c'+c,()=>mathCoin(c));m.coins.forEach((_,i)=>bind('paid'+i,()=>{m.coins.splice(i,1);sound.sfx('back');mathDraw();}));bind('till',mathCheckPay);}}
// ---- answering ----
function mathPick(i){const m=mstate;if(!m||m.done)return;const t=m.t,c=t.choices[i],card=document.getElementById('pick'+i);m.picks.push(i);
 if(c===t.answer){card?.classList.add('right');sound.sfx('sparkle');if(card)sparkleBurst(card,{n:12});mathFinish(ansLines(t));return;}
 misses++;card?.classList.add('dim');
 if(misses>=cfg.retry.maxBeforeDemo){demonstrated=true;if(t.mechanic==='kitchen'&&t.item.startsWith('take')){const op=document.querySelector('.onplate');if(op)op.innerHTML=fr(t.a-t.b,m.fruit)+fr(t.b,m.fruit,'ghost',t.a-t.b);}document.getElementById('pick'+t.choices.indexOf(t.answer))?.classList.add('demo');say(L.F('watch_me'),...ansLines(t));}
 else{if(t.mechanic==='kitchen'&&t.item.startsWith('take'))eatRun();mathSay(true,t.mechanic==='till'&&t.item.startsWith('coin')?[L.centCoin(c)]:[]);}}
function mathCompose(k){const m=mstate;if(!m||m.done)return;m.placed=(m.placed|0)+1;sound.sfx('plop');mathDraw();
 if(m.placed>=2){sound.sfx('sparkle');const o=document.getElementById('outline');if(o)sparkleBurst(o,{n:12});mathFinish(ansLines(m.t));}}
function mathRoll(){const m=mstate;if(!m||m.done||m.rolled)return;m.rolled=true;sound.sfx('plop');mathDraw();say(L.F('path_where'));}
function mathSquare(k){const m=mstate;if(!m||m.done)return;const t=m.t;if(!m.rolled){say(L.F('path_roll'));return;}
 if(k===t.answer){m.at=k;sound.sfx('sparkle');mathDraw();mathFinish([L.num(k)]);return;}
 misses++;
 if(misses>=cfg.retry.maxBeforeDemo){demonstrated=true;m.hop=true;m.at=t.answer;m.demoSq=t.answer;mathDraw();say(L.F('watch_me'),L.num(t.answer));}
 else{m.hop=true;mathDraw();say(L.F('read_listen'),L.F('path_where'));}}
function mathCoin(c){const m=mstate;if(!m||m.done||m.coins.length>=12)return;m.coins.push(c);sound.coin();mathDraw();const s=sumOf(m.coins);if(s<=50)say(L.centsLine(s));}
function mathCheckPay(){const m=mstate;if(!m||m.done)return;const t=m.t,want=t.mechanic==='till_change'?t.answer:t.price;
 if(payOk(m.coins,want)){
  if(t.mechanic==='till'){const key=[...m.coins].sort((a,b)=>a-b).join('+');
   if(!m.way){m.first=key;m.way=1;m.coins=[];sound.sfx('sparkle');mathDraw();say(L.F('another_way'));return;}
   if(key===m.first){misses++;m.coins=[];mathDraw();say(L.F('another_way'));return;}}
  sound.coin();mathFinish([L.centsLine(want)]);return;}
 misses++;
 if(misses>=cfg.retry.maxBeforeDemo){demonstrated=true;const all=t.mechanic==='till_change'?coinWays(t.answer,t.coins.filter(c=>c<=t.answer)):coinWays(t.price,t.coins),w=(m.way?all.find(x=>x.join('+')!==m.first):all[0])||all[0];m.coins=[...w].sort((a,c)=>c-a);mathDraw();say(L.F('watch_me'),L.centsLine(sumOf(m.coins)));}
 else{m.coins=[];mathDraw();say(L.F('read_listen'),...mathPrompt());}}
// M2: after the basket is counted she says how many (a follow-up with three numerals).
function mathFollow(){const m=mstate,t=m.t;m.follow=true;const p=document.querySelector('.panel');if(!p)return;
 p.innerHTML=`${art(order.n>0?'basket_full':'basket','basket followbasket')}${cardsHtml(t,ttext)}${hearBtn()}`;t.choices.forEach((_,i)=>bind('pick'+i,()=>mathFollowPick(i)));bind('mhear',()=>say(L.F('how_many')));say(L.F('how_many'));}
function mathFollowPick(i){const m=mstate;if(!m||m.done)return;const t=m.t,c=t.choices[i],card=document.getElementById('pick'+i);
 if(c===t.answer){card?.classList.add('right');sound.sfx('sparkle');if(card)sparkleBurst(card,{n:12});mathFinish([L.num(t.answer)]);return;}
 misses++;card?.classList.add('dim');if(misses>=cfg.retry.maxBeforeDemo){demonstrated=true;document.getElementById('pick'+t.choices.indexOf(t.answer))?.classList.add('demo');say(L.F('watch_me'),L.num(t.answer));}else say(L.F('read_listen'),L.F('how_many'));}
// She got it: record the item (ledger, history, masteryLevel — never nextLevel), praise what she did, then on to the till (market) or the kitchen (till).
function mathFinish(sayLines){const m=mstate,t=m.t,sk=m.skill==='shapes'?'shapes':'math',o=outcomeNow(),H=sk+'History',host=m.host;m.done=true;
 progress.items=recordItem(progress.items,t.item,o,today());progress[H]=[...progress[H],o].slice(-50);progress[sk]=masteryLevel(cur,sk,progress[sk],progress.items,progress[H],{});
 outcomes.push({skill:m.skill,item:t.item,outcome:o,level:task.level});if(task)task.outcome=o;save();
 cheerBuddy();sound.sfx('sparkle');const pr=o==='first'?(t.mechanic==='flash'||t.mechanic==='market'||t.mechanic==='tenframe'?'praise_count':null):o==='retry'?'praise_try':null;
 if(t.mechanic==='hide')document.querySelector('.reveal')?.insertAdjacentHTML('beforeend',fr(t.answer,m.fruit));
 say(...sayLines,...(pr?[L.F(pr)]:[]));const tok=viewToken;
 setTimeout(()=>{if(viewToken!==tok)return;host==='till'?kitchen():till();},pr?3200:1800);}
let marketDog=false;
function market(){stage_='market';amount=0;misses=0;demonstrated=false;marketDog=false;mstate=null;task=null;const g=mpend&&mpend.market;
 if(g&&g.t.mechanic!=='market'){mathStart('market',g);return;}
 if(g){const t=g.t;mstate={...g,host:'market',picks:[],done:false,follow:false,fruit:shopFn,coins:[],way:0};task={skill:'math',mechanic:'market',kind:'market',item:t.item,review:!!g.review,answer:t.answer,choices:[...t.choices],level:level('math'),guide:null,screen:'market',outcome:null};}
 drawMarket();if(dogOK)buddyPending=L.F('buddy_follow');say(L.weNeed(order.n),L.P('count_intro'));}
async function landLast(sel,fly){const els=document.querySelectorAll(sel),last=els[els.length-1];if(!last)return;last.style.visibility='hidden';await fly(last);last.style.visibility='';}
function drawMarket(from){const budget=order.n,tf=!!(mstate&&mstate.t.tenframe),noCoins=level('math')>=12; // M12-M14: the market shows no coins (SPEC MA8)
 const scene=frame('bg_market',3,[girl({anim:'idle',x:20.5,y:99,s:.95,back:false}),buddy(marketDog?{x:34,y:98,anim:buddyAnim==='sleep'?'wag':buddyAnim,loop:buddyAnim!=='wake'}:{x:118,y:98,anim:'walk',loop:true})]);
 if(!marketDog){marketDog=true;const d=stage.actor('buddy');d?.moveTo(34,2200,()=>{buddyAnim='wag';d.play('dog','wag');});}scene.innerHTML=`<div class="panel moneypanel">${tf?`<span class="bignum need">${order.n}</span>`:noCoins?`<span class="bignum need">${order.n}</span><div class="tray">${Array.from({length:order.n},(_,i)=>shopImg(i)).join('')}</div>`:`${purse(budget,budget,false,false)}<div class="tray">${Array.from({length:order.n},(_,i)=>priced(i)).join('')}</div>`}<div class="row">${button('food',shopImg(amount),'Add one '+order.food,'foodbtn'+(demonstrated?' demo':''))}${tf?button('basket',crateHtml(Array.from({length:Math.min(amount,10)},(_,i)=>shopImg(i,'counter'))),'Check the crate','cratebtn'):button('basket',art(amount>=order.n&&amount>0?'basket_full':'basket'),'Check basket','basket artbtn')}${button('remove',art('ui_undo'),'Put one back','artbtn')}</div>${tf?'':`<div class="tray">${Array.from({length:amount},(_,i)=>button('bitem'+i,shopImg(i),'Put one back','bitem')).join('')}</div>`}</div>`;
 if(from)landLast('.bitem',el=>flyTo(from.food,el,from.src,{size:80}));
 for(let i=0;i<amount;i++)bind('bitem'+i,()=>{amount--;sound.sfx('plop',{rate:1.2});drawMarket();say(L.num(amount));});
 bind('food',()=>{if(amount<(tf?10:12)){const src=document.querySelector('#food img').currentSrc,f=snap(document.getElementById('food'));amount++;sound.sfx('plop');drawMarket({food:f,src});say(L.num(amount));}});
 bind('remove',()=>{amount=Math.max(0,amount-1);sound.sfx('back');drawMarket();say(L.num(amount));});
 bind('basket',()=>{if(amount===order.n){sound.sfx('sparkle');sparkleBurst(document.getElementById('basket'));stage.actor('girl')?.play('girl','cheer',{loop:false,then:()=>stage.actor('girl')?.play('girl','idle')});if(!mstate){cheerBuddy();setTimeout(till,900);}else if(mstate.t.tenframe)mathFinish([L.num(order.n)]);else mathFollow();}else{misses++;if(misses>=cfg.retry.maxBeforeDemo){demonstrated=true;amount=order.n-1;drawMarket();say(L.F('watch_count'),...(amount?[L.countTo(amount)]:[]),L.F('add_one_more'));}else say(L.weNeed(order.n),L.P('hint_count'));}});}
function till(){stage_='till';buddyAnim='sleep';clearTimeout(buddyTimer);paid=0;misses=0;demonstrated=false;mstate=null;task=null;const g=mpend&&mpend.till;
 if(g){mathStart('till',g);return;}
 drawTill();say(L.foodCosts(order.n),L.P('pay_intro'));}
function drawTill(anim=''){const budget=order.n;const scene=frame('bg_till',3,[girl({anim:'idle',x:12,y:108,s:.95,back:false})]);scene.innerHTML=`<div class="panel moneypanel${budget>6?' dense':''}">${purse(budget,budget-paid,true,!!anim)}<div class="tray">${Array.from({length:order.n},(_,i)=>priced(i)).join('')}</div><div class="row coins" id="paid">${Array.from({length:paid},(_,i)=>button('paid'+i,art('coin_s'),'Take one coin back','paidcoin')).join('')}</div>${button('till',art('ui_check'),'Check payment','artbtn')}</div>`;
 if(anim==='pay')landLast('#paid button',el=>coinDrop(el,document.querySelector('#paid img').currentSrc));
 for(let i=0;i<budget-paid;i++)bind('coin'+i,()=>{paid++;sound.coin();drawTill('pay');say(L.num(paid));});for(let i=0;i<paid;i++)bind('paid'+i,()=>{paid--;sound.sfx('back');drawTill('back');say(L.num(paid));});bind('till',()=>{if(paid===order.n){sound.coin();sound.sfx('sparkle',{delay:200});sparkleBurst(document.getElementById('till'));setTimeout(kitchen,900);}else{misses++;if(misses>=cfg.retry.maxBeforeDemo){demonstrated=true;paid=order.n-1;drawTill('pay');say(L.F('watch_me'),...(paid?[L.countTo(paid)]:[]),L.F('pay_one_more'));}else say(L.itCosts(order.n),L.P('hint_pay'));}});}
// A recipe (SPEC §16): one LOCKED tile per ingredient. Tap a tile -> stage kitchen_trace: the whole word stays up, she traces each letter on the pad, one picture of the
// ingredient flies into the pot ("1 of 2" with dots); qty 2 = trace it again. Every tile done -> the piano cooks the dish. No maths in the kitchen (KT4).
// kit.steps = traceSteps(recipe): one {word, rep, qty} per trace, in order; kit.first[i] = where ingredient i's steps start, kit.reps[i] = how many of them are done.
const mkKit=(r,reps)=>{const first=[];let n=0;for(const g of r.ingredients){first.push(n);n+=g.qty;}return {recipe:r,steps:traceSteps(r),first,ings:r.ingredients,reps:reps||r.ingredients.map(()=>0),pot:[],cur:0};};
const stepNow=()=>kit.steps[kit.first[kit.cur]+kit.reps[kit.cur]]||{word:kit.ings[kit.cur].word,rep:kit.reps[kit.cur]+1,qty:kit.ings[kit.cur].qty};
function kitchen(){stage_='kitchen';kit=mkKit(order.recipe);drawKitchen();say(L.F('kitchen_tap'));}
const kitDone=()=>kit.ings.every((g,i)=>kit.reps[i]>=g.qty);
// Cycle the pan_cooking frames on <img> `el` at ~12 fps while this view is current.
async function cookPan(el,token){const fr=await panFrames();if(!fr||!el)return;let i=0;const t=setInterval(()=>{if(viewToken!==token||!el.isConnected){clearInterval(t);return;}i=(i+1)%fr.length;el.src=fr[i];},1000/12);el.src=fr[0];el.classList.remove('fb');}
const potDots=(rep,qty)=>Array.from({length:qty},(_,k)=>`<span class="potdot${k<rep?' on':''}"></span>`).join('');
// The pot beside the pad: the pictures already in it, "rep of qty" in words and qty dots (rep of them lit).
function kPotHtml(){const g=kit.ings[kit.cur],done=kit.reps[kit.cur];return `<div class="kpot" id="kpot"><div class="kpan">${art(kit.pot.length?'pan_cooking_00':'pan','panimg')}<div class="inpan">${kit.pot.map(a=>art(a,'mini')).join('')}</div></div><div id="potCount" class="potcount">${done?`${done} of ${g.qty}`:''}</div><div class="potdots">${potDots(done,g.qty)}</div></div>`;}
function drawKitchen(){const scene=frame('bg_kitchen_nopan',4,[girl({anim:'idle',x:12,y:106,s:1,back:false,loop:true}),buddy({x:80,y:99})]);const first=kit.ings.findIndex((g,i)=>kit.reps[i]<g.qty);
 scene.innerHTML=`<div class="kitchenpanel"><div id="pan" class="pan-zone">${art(kit.pot.length?'pan_cooking_00':'pan','panimg')}<div class="inpan">${kit.pot.map(a=>art(a,'mini')).join('')}</div></div><div class="row ingrow">${kit.ings.map((g,i)=>{const done=kit.reps[i]>=g.qty;return `<button id="tile${i}" class="tile ${done?'done':'locked'}${i===first?' hint':''}" aria-label="${done?'In the pot':'Locked ingredient'}">${art(g.art)}<span class="qtydots">${potDots(done?g.qty:0,g.qty)}</span><span class="lock">${done?'&#10003;':'&#128274;'}</span></button>`;}).join('')}</div></div>`;
 if(kit.pot.length)cookPan(document.querySelector('.panimg'),viewToken);
 kit.ings.forEach((g,i)=>bind('tile'+i,()=>{if(kit.reps[i]<g.qty)openIngredient(i);}));}
function openIngredient(i){kit.cur=i;const g=kit.ings[i];stage_='kitchen_trace';traceIcon=g.word;traceKey='word:'+g.word;traceReview=false;traceQueue=wordQueue(g.word);traceAt=0;traceNext=()=>wordDone(i);misses=0;demonstrated=false;
 const r=traceScreen();say(L.F('trace_to_add'),...r.lines);}
// The word is complete: one picture of the ingredient flies from the word into the pot, the count reads "rep of qty". More reps -> the pad clears for another go; the last rep -> back to the tiles.
async function wordDone(i){const g=kit.ings[i],token=viewToken,src=document.querySelector('.kicon')?.currentSrc;
 await flyTo(document.getElementById('kword'),document.getElementById('kpot'),src,{size:96});if(viewToken!==token)return;
 kit.reps[i]++;kit.pot.push(g.art);const rep=kit.reps[i],last=rep>=g.qty;
 document.querySelector('.kpot .inpan')?.insertAdjacentHTML('beforeend',art(g.art,'mini'));const pc=document.getElementById('potCount');if(pc)pc.textContent=`${rep} of ${g.qty}`;
 document.querySelectorAll('.potdot').forEach((d,k)=>d.classList.toggle('on',k<rep));
 sound.sfx('plop');sound.sfx('sizzle',{delay:150});const kp=document.querySelector('.kpan');if(kp){sparkleBurst(kp,{n:10,radius:90});bounce(kp,1.1);}cheerBuddy();
 if(!last){say(L.F('trace_again'));setTimeout(()=>{if(viewToken===token){traceQueue=wordQueue(g.word);traceAt=0;misses=0;demonstrated=false;const r=traceScreen();say(...r.lines);}},1600);return;}
 setTimeout(()=>{if(viewToken!==token)return;stage_='kitchen';drawKitchen();const pan=document.getElementById('pan');if(pan){pan.insertAdjacentHTML('beforeend','<span class="splashring"></span>');sparkleBurst(pan,{n:12,radius:110});bounce(pan,1.1);}const t2=viewToken;
  if(kitDone())setTimeout(()=>{if(viewToken===t2)pianoCook();},1500);else say(L.F('kitchen_tap'));},1500);}
// ---- the piano step (replaces stirring), SPEC §6 + §14: one music task per dish. pickItem chooses the item; the item's level decides the mechanic ----
//   beat (U1): the unicorn plays hot_cross_buns on the beat, she taps the pot lid #lid · rhythm (U2): the unicorn plays a pattern on C4, she taps it back · highlow (U3): the cat (C4) or the chick (C5)
//   copy (U4-U12): copy-me phrase by phrase, with `recall` no key is lit before her first miss, U12 has a metronome · card (U13): play the notes on #notecard, the keys are .faded · free (U14): black keys, the unicorn answers.
// Music moves by masteryLevel only (never nextLevel); the outcome goes to recordItem + musicHistory.
const NOTE_SAY={C:L.F('note_c'),D:L.F('note_d'),E:L.F('note_e'),F:L.F('note_f'),G:L.F('note_g'),A:L.F('note_a'),B:L.F('note_b')};
const musicEntry=l=>cur.music[l-1]||{};
const itemLevel=key=>{for(let l=1;l<=maxLevel(cur,'music');l++)if(levelItems(cur,'music',l).includes(key))return l;return level('music');};
const flatSong=id=>((cur.songs||{})[id]||[]).filter(n=>n!=='-').map(noteId);
function musicTask(forceKey,forceLevel){
 const lv=level('music');let p;
 if(forceKey)p={key:forceKey,review:false};
 else if(musicEntry(lv).mechanic==='free'&&(progress.taskCount.music|0)%3!==2){progress.taskCount.music=(progress.taskCount.music|0)+1;save();p={key:'free',review:false};}
 else p=pickKey('music');
 const key=p.key||'free',kind=key.split(':')[0],arg=key.slice(kind.length+1),il=forceLevel||(key==='free'?lv:itemLevel(key)),e=musicEntry(il);
 const T={key,review:p.review,level:il,recall:!!e.recall,bpm:null,tol:null,targets:[],notes:[],mechanic:'copy',card:false,pent:(e.notes||[]).map(noteId)};
 if(key==='free')T.mechanic='free';
 else if(kind==='follow'){T.mechanic='follow';T.notes=followNotes(cur,il);T.low=e.low;T.high=e.high;}
 else if(kind==='beat'){T.mechanic='beat';T.bpm=Number(arg);const n=e.beats||8;T.tol=e.toleranceMs||200;T.notes=flatSong(e.song||'hot_cross_buns').slice(0,n);T.targets=beatTimes(T.bpm,n);}
 else if(kind==='rhythm'){T.mechanic='rhythm';T.bpm=e.bpm||90;T.tol=150;T.targets=rhythmTimes(arg,T.bpm);T.notes=T.targets.map(()=>'C4');}
 else if(kind==='hl'){T.mechanic='highlow';T.notes=[noteId(arg)];}
 else if(kind==='penta'){const n=Number(arg);let ph=[];for(let k=0;k<30&&!ph.length;k++)ph=phrasesFor(cur,il,Math.random).map(x=>x.map(noteId)).filter(x=>x.length===n);T.notes=ph[Math.floor(Math.random()*ph.length)]||T.pent.slice(0,n);}
 else if(kind==='time'){T.bpm=e.bpm||80;T.tol=250;T.time=true;T.notes=flatSong(arg);T.phrases=[];let c=[];for(const n of (cur.songs||{})[arg]||[]){if(n==='-'){if(c.length)T.phrases.push(c);c=[];}else c.push(noteId(n));}if(c.length)T.phrases.push(c);if(!T.phrases.length)T.phrases=[T.notes];T.targets=beatTimes(T.bpm,T.phrases[0].length);}
 else{T.notes=arg.split(',').map(noteId);if(e.mechanic==='card'){T.mechanic='card';T.card=true;}}
 return T;}
function pianoCook(){showPiano(false);}
function pianoFree(){showPiano(true);}
function showPiano(free,forceKey,forceLevel){stage_=free?'piano_free':'piano';frame('bg_kitchen_nopan',4,[]);initPianoAudio();warmPiano();const token=viewToken;
 if(free){freePiano();return;}
 musicPlay(token,musicTask(forceKey,forceLevel));}
// Free play: all 25 keys C3..C5, no task.
function freePiano(){let lastSpoken=0;
 const ctl=mountPiano(ui,{keys:cur.keys,low:48,high:72,girl:'girl_idle_00',customer:skin()+'_idle_00',ingredients:[],onPress:note=>{playNote(note);ctl.sparkle(note);const k=cur.keys.find(x=>x.note===note);if(k?.white&&Date.now()-lastSpoken>700){lastSpoken=Date.now();say(NOTE_SAY[k.letter]);}}});pianoUI=ctl;
 ctl.root.insertAdjacentHTML('beforeend',button('back',art('ui_back'),'Back to café','artbtn pback'));bind('back',()=>{sound.sfx('back');cafe();});}
function musicPlay(token,T){
 const range=T.mechanic==='follow'?{low:T.low,high:T.high}:keyRange(T.notes),M=T.mechanic;let ctl,over=false,attempt=1,tapsRel=[],tickTimer=null,idleTimer=null,missed=false,mine=0,timeHandler=null;
 const live=()=>viewToken===token&&pianoUI===ctl;
 task={skill:'music',kind:M,mechanic:M,item:T.key,notes:T.time?T.phrases[0]:T.notes,targets:T.targets,t0:null,turn:false,seq:0,review:T.review,recall:T.recall,guide:null,answer:null,screen:'piano',hits:null,outcome:null};
 ctl=mountPiano(ui,{keys:cur.keys,low:range.low,high:range.high,girl:'girl_idle_00',customer:skin()+'_idle_00',ingredients:kit.pot,lid:M==='beat',card:T.card,faded:T.card,onPress:note=>press(note),onLid:t=>lidTap(t)});pianoUI=ctl;
 const listen=(notes,cb,gap=640)=>{let i=0;const step=()=>{if(!live())return;if(i>=notes.length){cb();return;}const n=notes[i++];playNote(n);ctl.flash(n,460);setTimeout(step,gap);};step();};
 const lit=cp=>ctl.setNext((T.recall||M==='highlow')&&!missed?null:cp.next()); // recall: nothing is lit before her first miss; high/low never lights the answer
 // the outcome: ledger + history + the mastery level (never nextLevel); then the unicorn plays the phrase back, praise, and the dish goes to serve
 function finish(o,hits){if(over)return;over=true;task.turn=false;task.outcome=o;task.hits=hits;clearInterval(tickTimer);clearTimeout(idleTimer);ctl.setLocked(true);ctl.setNext(null);
  if(T.key!=='free')progress.items=recordItem(progress.items,T.key,o,today());
  progress.musicHistory=[...progress.musicHistory,o].slice(-50);progress.music=masteryLevel(cur,'music',progress.music,progress.items,progress.musicHistory,{});
  outcomes.push({skill:'music',item:T.key,outcome:o});save();cheerBuddy();ctl.bubble();sound.sfx('sparkle',{rate:1.3});
  const praise=M==='beat'?(o==='first'?'praise_beat':o==='retry'?'praise_try':null):M==='follow'?(o==='retry'?'praise_try':null):M==='free'?null:o==='first'?'praise_listen':o==='retry'?'praise_try':null;
  const bye=()=>{if(!live())return;ctl.cheer();say(L.F('piano_done'),...(praise?[L.F(praise)]:[]));sound.cheer();setTimeout(()=>{if(live())serve();},praise?4800:2200);};
  if(M==='follow')setTimeout(()=>{if(!live())return;listen(T.notes,bye,560);},700); // her own tune plays back, each note lit, as the reward (FL5)
  else if((M==='copy'||M==='card')&&T.notes.length&&T.notes.length<=16)setTimeout(()=>{if(!live())return;if(T.level>=10)say(L.F('sing_along'));listen(T.notes,bye);},700);else setTimeout(bye,700);}
 // a miss: a soft boop, the phrase plays again, the hint lights (errorless: 2 misses = the key pulses)
 const missThen=(r,notes)=>{missed=true;ctl.setLocked(true);task.turn=false;ctl.setNext(null);sound.sfx('back',{rate:.6});setTimeout(()=>listen(notes,()=>{if(!live())return;ctl.setLocked(false);ctl.setNext(r.hint,{pulse:r.demo});task.turn=true;say(L.F('piano_turn'));}),550);};
 // ---- U1 beat ----
 function lidTap(t){if(over||!task.turn||task.t0==null)return;tapsRel.push(t-task.t0);ctl.lidHit();sound.sfx('plop',{rate:1.5});}
 function runBeat(){if(!live())return;tapsRel=[];const lead=1200;task.t0=performance.now()+lead;task.turn=true;ctl.setLocked(false);
  T.notes.forEach((n,i)=>setTimeout(()=>{if(live()){playNote(n);ctl.bubble();}},lead+T.targets[i]));
  setTimeout(()=>{if(!live()||over)return;task.turn=false;const r=scoreTaps(T.targets,tapsRel,Math.min(200,.25*60000/T.bpm));task.hits=r.hits;
   if(beatPass(T.bpm,tapsRel))finish(attempt===1?'first':'retry',r.hits);else if(attempt===1){attempt++;say(L.F('read_listen'));setTimeout(runBeat,1800);}else finish('demo',r.hits);},lead+T.targets[T.targets.length-1]+900);}
 // ---- U2 rhythm ----
 function runRhythm(){if(!live())return;tapsRel=[];ctl.setLocked(true);task.turn=false;ctl.setNext('C4');const lead=900;task.t0=performance.now()+lead;
  T.targets.forEach(t=>setTimeout(()=>{if(live()){playNote('C4');ctl.flash('C4',300);}},lead+t));
  setTimeout(()=>{if(!live()||over)return;ctl.setLocked(false);task.turn=true;say(L.F('piano_turn'));},lead+T.targets[T.targets.length-1]+700);}
 function rhythmScore(){clearTimeout(idleTimer);if(over||!tapsRel.length)return;task.turn=false;const base=tapsRel[0],r=scoreTaps(T.targets.map(t=>t-T.targets[0]),tapsRel.map(t=>t-base),T.tol);task.hits=r.hits;
  if(r.hits===T.targets.length&&r.extra===0)finish(attempt===1?'first':'retry',r.hits);else if(attempt===1){attempt++;ctl.setLocked(true);say(L.F('read_listen'));setTimeout(runRhythm,1800);}else finish('demo',r.hits);}
 // ---- U3 high or low, U4-U12 copy-me, U13 card ----
 const cp=M==='highlow'||M==='copy'||M==='card'?createCopyMe(T.notes,{maxBeforeDemo:cfg.retry.maxBeforeDemo,octaveFree:M==='card'}):null,fo=M==='follow'?createFollow(T.notes):null;
 // ---- follow the light (L1-L4): one key glows; she plays it and hears it; the next one glows. A wrong key is a soft nudge: the glowing key pulses and stays lit. ----
 function followPress(note){playNote(note);const r=fo.press(note);
  if(r.result==='nudge'){ctl.setNext(r.expect,{pulse:true});return;}
  ctl.sparkle(note);if(r.result==='correct'){ctl.bubble();sound.sfx('sparkle',{rate:1.3});ctl.setNext(fo.next());return;}
  task.hits=T.notes.length;finish(fo.outcome(),task.hits);}
 const turn=()=>{if(!live())return;ctl.setLocked(false);lit(cp);task.turn=true;say(L.F('piano_turn'));};
 function press(note){if(over||!task.turn)return;
  if(M==='follow'){followPress(note);return;}
  if(timeHandler){timeHandler(note);return;}
  if(M==='rhythm'){playNote('C4');tapsRel.push(performance.now());ctl.sparkle('C4');clearTimeout(idleTimer);if(tapsRel.length>=T.targets.length)rhythmScore();else idleTimer=setTimeout(rhythmScore,3000);return;}
  if(M==='free'){playNote(note);ctl.sparkle(note);mine++;if(mine>=12){finish('first',12);return;}
   if(mine%3===0){ctl.setLocked(true);task.turn=false;const ans=Array.from({length:3},()=>T.pent[Math.floor(Math.random()*T.pent.length)]);setTimeout(()=>listen(ans,()=>{if(!live())return;ctl.setLocked(false);task.turn=true;}),600);}return;}
  playNote(note);const r=cp.press(note);
  if(r.result==='correct'||r.result==='done'){if(T.bpm&&T.targets.length)tapsRel.push(performance.now()-task.t0);ctl.sparkle(note);if(r.result==='correct'){ctl.bubble();sound.sfx('sparkle',{rate:1.3});lit(cp);return;}
   let o=cp.outcome();if(T.bpm&&T.targets.length){const h=scoreTaps(T.targets,tapsRel,T.tol).hits;task.hits=h;if(o==='first'&&h<Math.ceil(T.targets.length*.8))o='retry';}finish(o,task.hits);}
  else if(M==='highlow'){ctl.setLocked(true);task.turn=false;sound.sfx('back',{rate:.6});setTimeout(()=>{if(!live())return;playNote(T.notes[0]);ctl.flash(T.notes[0],460);setTimeout(()=>{if(!live())return;ctl.setLocked(false);ctl.setNext(r.hint,{pulse:r.demo});task.turn=true;},700);},550);}
  else missThen(r,T.notes);}
 // ---- U12 play in time, phrase by phrase: the unicorn plays the phrase with the metronome, 4 count-in ticks, then she plays it on the beat (recall). A phrase out of time or order is replayed once with the metronome stopped, then her timing restarts. ----
 function runTime(){if(!live())return;
  const beat=60000/T.bpm,phs=T.phrases,need=n=>Math.ceil(n*.8);let pi=0,tries=0,worst='first',hits=0,tm=[],taps=[],cp2=null;
  const later=(f,ms)=>{tm.push(setTimeout(()=>{if(live()&&!over)f();},ms));};
  const stopAll=()=>{tm.forEach(clearTimeout);tm=[];};
  const tick=()=>sound.sfx('tap',{rate:1.7});
  const attempt=()=>{const ph=phs[pi];tries++;taps=[];cp2=createCopyMe(ph,{maxBeforeDemo:cfg.retry.maxBeforeDemo});ctl.setLocked(true);ctl.setNext(null);task.turn=false;task.notes=ph;task.targets=beatTimes(T.bpm,ph.length);
   const metro=tries===1,gap=metro?beat:640; // the first play has the metronome; the replay after a miss has none
   ph.forEach((n,i)=>later(()=>{if(metro)tick();playNote(n);ctl.flash(n,Math.min(460,gap-40));},i*gap));
   const at=ph.length*gap;
   for(let k=0;k<4;k++)later(tick,at+k*beat); // four count-in ticks
   const onset=performance.now()+at+4*beat;task.t0=onset; // her first expected onset
   later(()=>{ctl.setLocked(false);ctl.setNext(tries>=3?cp2.next():null);task.seq++;task.turn=true;say(L.F('piano_turn'));},at+4*beat-300);
   for(let k=0;k<ph.length;k++)later(tick,at+(4+k)*beat);
   later(()=>fail(),at+(4+ph.length)*beat+2500);};
  const fail=()=>{stopAll();task.turn=false;ctl.setLocked(true);ctl.setNext(null);missed=true;sound.sfx('back',{rate:.6});later(attempt,700);};
  timeHandler=note=>{if(over||!task.turn)return;playNote(note);const r=cp2.press(note);
   if(r.result==='wrong'){if(tries>=3){ctl.setNext(r.hint,{pulse:true});return;}fail();return;}
   taps.push(performance.now()-task.t0);ctl.sparkle(note);
   if(r.result==='correct'){ctl.bubble();sound.sfx('sparkle',{rate:1.3});if(tries>=3)ctl.setNext(cp2.next());return;}
   const h=scoreTaps(task.targets,taps,T.tol).hits;
   if(tries<3&&h<need(phs[pi].length)){fail();return;}
   stopAll();task.turn=false;ctl.setLocked(true);ctl.setNext(null);hits+=h;task.hits=hits;
   if(tries>=3)worst='demo';else if(tries>1&&worst==='first')worst='retry';
   pi++;if(pi>=phs.length){finish(worst,hits);return;}
   ctl.bubble();sound.sfx('sparkle',{rate:1.3});tries=0;later(attempt,1100);};
  attempt();}
 ctl.setLocked(true);
 if(M==='beat'){say(L.F('beat_intro'));setTimeout(runBeat,2300);}
 else if(M==='rhythm'){ctl.only(n=>n==='C4');ctl.setNext('C4');say(L.F('rhythm_intro'));setTimeout(runRhythm,2300);}
 else if(M==='highlow'){ctl.only(n=>n==='C4'||n==='C5');say(L.F('highlow_q'));setTimeout(()=>{if(!live())return;playNote(T.notes[0]);ctl.flash(T.notes[0],460);setTimeout(turn,900);},2800);}
 else if(M==='free'){ctl.only(n=>cur.keys.find(k=>k.note===n)?.white===false);say(L.F('free_intro'));setTimeout(()=>{if(!live())return;ctl.setLocked(false);task.turn=true;},2200);}
 else if(M==='card'){ctl.setCard(T.notes.map(n=>n[0]).join(' '));say(L.F('card_intro'));setTimeout(turn,2600);}
 else if(M==='follow'){say(L.F('follow_intro'));ctl.setLocked(false);task.turn=true;ctl.setNext(fo.next());}
 else if(T.time){say(L.F('piano_listen'));setTimeout(runTime,2600);}
 else{say(L.F('piano_listen'));setTimeout(()=>listen(T.notes,turn),2600);}}
// The finished dish (SPEC §17 SV2): the recipe's `dish`; a saved entry that is a recipe id draws that recipe's dish, an older one is dish_<food>.
const dishOf=o=>(o&&o.recipe&&o.recipe.dish)||'dish_'+(o&&o.food);
const shelfDish=e=>{const r=recipes.recipes.find(x=>x.id===e);return r&&r.dish?r.dish:'dish_'+e;};
function serve(){stage_='serve';const scene=frame('bg_serve',5,[girl({anim:'idle',x:11,y:104,s:.95,back:false}),cust({anim:'idle',x:84,y:104,s:.9})]);scene.innerHTML=`<div class="servewrap">${button('serve',art(dishOf(order),'dish'),'Give plate to customer','hero-button')}</div>`;say(L.F('serve_plate'));bind('serve',async()=>{const b=document.getElementById('serve');if(!b||b.dataset.done)return;b.dataset.done='1';const a=stage.actor(cust().id);sound.sfx('plop');await flyTo(snap(b),{getBoundingClientRect:()=>{const r=document.getElementById('stage').getBoundingClientRect(),w=r.width,h=r.height;return new DOMRect(r.left+w*.8-10,r.top+h*.7-10,20,20);}},b.querySelector('img').currentSrc,{size:140,ms:600});b.style.visibility='hidden';a?.play(skin(),'happy');sound.cheer();sparkleBurst({x:innerWidth*.8,y:innerHeight*.6},{n:22,radius:200});stage.actor('girl')?.play('girl','cheer');progress.sparkles++;progress.served=[...progress.served,(order.recipe&&order.recipe.id)||order.food].slice(-60);const rid=order.recipe&&order.recipe.id;if(rid&&!progress.recipeBook.includes(rid)){progress.recipeBook=[...progress.recipeBook,rid];newRecipe=true;}save();setTimeout(reward,2200);});}
function nextSticker(){const have=new Set(progress.stickerIds),pool=[...Array(STICKERS).keys()].filter(i=>!have.has(i));const id=pool.length?pool[Math.floor(Math.random()*pool.length)]:Math.floor(Math.random()*STICKERS);progress.stickerIds.push(id);progress.stickerIds=progress.stickerIds.slice(-200);progress.stickers=progress.stickerIds.length;save();return id;}
function reward(){stage_='reward';const scene=frame('bg_cafe',5,[girl({anim:'cheer'}),cust({anim:'happy',keepPos:false,x:76}),buddy()],'counter');const rt=viewToken;setTimeout(()=>{if(viewToken===rt)cheerBuddy();},450);scene.innerHTML=`<div class="rewardwrap"><div class="glow"></div>${button('reward',art(dishOf(order),'bigsticker'),'Put your dish on the café shelf','hero-button')}${earnedRow(8,'row-bottom')}</div>${shelfHtml()}`;say(L.P('serve_thanks'),...(newRecipe?[L.F('recipe_new')]:[]),L.F('shelf_line'));const b=document.getElementById('reward');popIn(b,800);sound.cheer();setTimeout(()=>sparkleBurst({x:innerWidth/2,y:innerHeight/2},{n:26,radius:260}),250);bind('reward',()=>{sound.sfx('sparkle');sparkleBurst(b,{n:10,radius:120});if(checkClock())return;setTimeout(()=>{if(afterReward(customer)==='closing')goodbye(true);else cafe();},350);});}
// The café grows: the last <= 12 dishes served stand on the shelf (progress.served, newest last), as dish_<food> pictures.
function shelfHtml(){return `<div class="cafe-shelf" aria-hidden="true">${(demoShelf||progress.served).slice(-12).map(e=>art(shelfDish(e),'shelfdish')).join('')}</div>`;}
function waiting(){stage_='wait';const scene=frame('bg_cafe',5,[girl({anim:'wave'}),cust({anim:'idle'}),buddy()],'counter');const n=Math.min(progress.stickerIds.length,8);scene.innerHTML=`<div class="stars waitstars">${progress.stickerIds.slice(-n).map((id,i)=>button('star'+i,art('sticker_'+pad(id%STICKERS),'sticker-s'),'Make decoration sparkle','sticker-btn')).join('')}</div>${button('pianoFree','&#127929;','Play the piano','glyph pianobtn')}`;bind('pianoFree',pianoFree);for(let i=0;i<n;i++)bind('star'+i,()=>{const el=document.getElementById('star'+i);bounce(el,1.3);sparkleBurst(el,{n:10,radius:110});sound.sfx('sparkle');say(L.F('sparkle_deco'));});speak('wait');}
function goodbye(dayEnd=false){if(closed&&!dayEnd)return;closed=true;stage_='closed';const day=today(),surprise=!surpriseOff&&surpriseSticker(day,progress.stickerDays,Math.random,cfg.rewards.stickerChancePerDay);let gift=null;if(surprise){progress.stickerDays=[...progress.stickerDays,day].slice(-400);gift=nextSticker();}const scene=frame('bg_closing',5,[girl({anim:'cheer'}),{id:'bye-u',char:'unicorn',anim:'happy',x:55,y:95,s:.72},{id:'bye-p',char:'princess',anim:'idle',x:72,y:95,s:.72},{id:'bye-k',char:'kitty',anim:'happy',x:89,y:95,s:.72},buddy({x:36,y:98.5})],'counter');root.classList.add('closed');scene.innerHTML=earnedRow(6,'row-top')+(gift!==null?`<div class="surprise" id="surprise">${art('sticker_'+pad(gift%STICKERS),'bigsticker')}</div>`:'')+(dayEnd?button('openAgain','&#9728;&#65039;','Open the café again','sunbtn'):'');if(gift!==null){const sp=document.getElementById('surprise');popIn(sp,900);setTimeout(()=>sparkleBurst(sp,{n:24,radius:200}),300);}say(L.P('session_goodbye'),...(gift!==null?[L.F('sticker_surprise')]:[]),...(dogOK?[L.F('buddy_night')]:[]),...(dayEnd?[L.F('new_day')]:[]));bind('openAgain',newDay);sound.sfx('bell');setTimeout(()=>sparkleBurst({x:innerWidth/2,y:innerHeight*.4},{n:20,radius:240}),400);}
// A new café day: reset the customers and the clock and open the café again (never a hard stop).
function newDay(){sound.sfx('sparkle');closed=false;started=Date.now();customer=0;winddown=false;root.classList.remove('closed');cafe();}
function checkClock(){if(!started||closed)return closed;const current=phase();if(current==='end'){adultOpen=false;goodbye();return true;}if(current==='winddown'&&!winddown){winddown=true;speak('session_winddown');}return false;}
function adultGate(){if(adultOpen)return;adultOpen=true;const panel=document.createElement('section');panel.className='adult';panel.innerHTML=`${button('closeParent','×','Close parent controls','exit')}<h1>Grown-ups</h1><label>7 + 8 = <input id="answer" inputmode="numeric" autocomplete="off" aria-label="Answer to written sum"></label>${button('unlock','Continue','Continue')}`;root.append(panel);bind('closeParent',()=>{panel.remove();adultOpen=false;});bind('unlock',()=>{if(document.getElementById('answer').value.trim()==='15')settings(panel);else document.getElementById('answer').value='';});}
function settings(panel){const mx=skill=>maxLevel(cur,skill),opts=cfg.sessionLimitOptions;
 panel.innerHTML=`${button('closeParent','×','Close parent controls','exit')}<h1>Parent settings</h1><div class="startover-box"><button id="startOver" class="startover" aria-label="Start over"><span class="so-fill"></span><span class="so-text">Start over</span></button><p>Hold the button for ${Math.round(cfg.startOver.holdMs/1000)} seconds to put everything back to day 1: levels, stickers, recipe book and progress. The session limit and the other settings stay.</p></div><p>Progress stays on this iPad. ${progress.sparkles} sparkles · ${progress.stickers} stickers. Reading level ${progress.read}/${mx('read')} · Tracing level ${progress.trace}/${mx('trace')} · Maths level ${progress.math}/${mx('math')} · Music level ${progress.music}/${mx('music')}.</p><label>Session limit<select id="limit">${opts.map(n=>`<option value="${n}" ${progress.settings.limit===n?'selected':''}>${n===0?'Off':n+' minutes'}</option>`).join('')}</select></label><label>Reading difficulty<select id="readLevel"><option value="0">Adaptive</option>${Array.from({length:mx('read')},(_,i)=>`<option value="${i+1}" ${progress.settings.read===i+1?'selected':''}>${i+1}</option>`).join('')}</select></label>${[['trace','Tracing difficulty','traceLevel','trace'],['math','Maths difficulty','mathLevel','math'],['music','Music difficulty','musicLevel','musicLevel']].map(([skill,name,id,key])=>`<label>${name}<select id="${id}"><option value="0">Adaptive</option>${Array.from({length:mx(skill)},(_,i)=>`<option value="${i+1}" ${progress.settings[key]===i+1?'selected':''}>${i+1}</option>`).join('')}</select></label>`).join('')}<p>Reading attempts: ${progress.readHistory.join(', ')||'None yet'}.<br>Tracing attempts: ${progress.traceHistory.join(', ')||'None yet'}.<br>Maths attempts: ${progress.mathHistory.join(', ')||'None yet'}.<br>Music attempts: ${progress.musicHistory.join(', ')||'None yet'}.</p><p>Setup: open in Safari and use Share → Add to Home Screen. Guided Access is optional when a grown-up is nearby. Install while online, wait for the app to finish caching, then test in airplane mode. Voices are recorded and ship with the game; the iPad’s own English voice (iPad Settings → Accessibility → Spoken Content → Voices) is only the fallback for a line with no recording. There is no session limit unless you pick one above: with a limit set, the café winds down near the end and closes after the current task, never in the middle of one.</p>${button('newSession','Start new café day','Start new café day')}`;
 const update=()=>{progress.settings={...progress.settings,limit:Number(document.getElementById('limit').value),read:Number(document.getElementById('readLevel').value),trace:Number(document.getElementById('traceLevel').value),math:Number(document.getElementById('mathLevel').value),musicLevel:Number(document.getElementById('musicLevel').value)};clockCfg={limitMinutes:progress.settings.limit,windDownMinutes:cfg.windDownMinutes};save();};for(const id of ['limit','readLevel','traceLevel','mathLevel','musicLevel'])document.getElementById(id).onchange=update;bind('closeParent',()=>{panel.remove();adultOpen=false;});bind('newSession',()=>{update();closed=false;started=0;customer=0;winddown=false;adultOpen=false;root.classList.remove('closed');welcome();});
 const so=document.getElementById('startOver');let soTimer=null;
 const soStop=()=>{clearTimeout(soTimer);so.classList.remove('holding');};
 so.addEventListener('pointerdown',e=>{e.preventDefault();try{so.setPointerCapture(e.pointerId);}catch{}so.style.setProperty('--hold',cfg.startOver.holdMs+'ms');so.classList.add('holding');clearTimeout(soTimer);soTimer=setTimeout(()=>{soStop();doStartOver(panel);},cfg.startOver.holdMs);});
 for(const ev of ['pointerup','pointercancel','lostpointercapture'])so.addEventListener(ev,soStop);}
// Start over (SPEC §16 SO2): everything back to day 1 (startOver keeps the grown-up's settings), saved, and the café opens at the welcome screen with customer 0.
function doStartOver(panel){const fresh=startOver(progress,cfg);for(const k of Object.keys(progress))delete progress[k];Object.assign(progress,fresh);
 clockCfg={limitMinutes:progress.settings.limit,windDownMinutes:cfg.windDownMinutes};lastKey.read=lastKey.trace=lastKey.math=lastKey.music=lastKey.shapes=undefined;task=null;readState=null;pending=null;mpend=null;mstate=null;order=null;demoShelf=null;newRecipe=false;
 save();panel.remove();adultOpen=false;closed=false;started=0;customer=0;winddown=false;root.classList.remove('closed');welcome();}
// Every button press: a soft tap sound + a scale-bounce. First touch anywhere unlocks audio (iOS needs a gesture).
// SPEC §16 AU2: the first touch wakes BOTH audio contexts (the piano's is created inside the gesture) and starts the piano samples loading; it stops listening once everything runs.
const unlockArm=armUnlock(document,()=>{try{if(navigator.audioSession)navigator.audioSession.type='playback';}catch{} /* iOS: the ring/silent switch must not mute the piano (AU4) */ sound.unlock();const cs=[pianoContext(),sound.context()];warmPiano();return cs;});
document.addEventListener('click',e=>{const b=e.target.closest?.('button');if(!b)return;if(!b.matches('#ticket,#basket,#till,#reward,#serve,#food,[id^=coin],#scoop,#tick,[id^=tile]'))sound.sfx('tap');bounce(b.classList.contains('hit')?b.parentElement:b);},true);
setInterval(checkClock,1000);
// Testing hook (read-only for the screens-check tool): which art files rendered as real art, fallback or placeholder.
if(SILENT)console.log('dg-silent-on');
window.__dg={silent:SILENT,said,task:()=>task&&{...task,choices:task.choices&&[...task.choices]},outcomes,art:artStatus,stage:()=>({bg:stage.bg,actors:[...stage.actors.keys()]}),screen:()=>stage_,order:()=>order&&{n:order.n,food:order.food,recipe:order.recipe&&order.recipe.id},unlock:()=>({fired:unlockArm.fired(),armed:unlockArm.armed()}),kitchenArts:()=>kit.ings.map(g=>g.art),kitchen:()=>({recipe:kit.recipe&&kit.recipe.id,tier:kit.recipe&&kit.recipe.tier,ings:kit.ings.map(g=>g.word),ingredients:kit.ings.map(g=>({word:g.word,qty:g.qty}))})};
// ?screen=<name> jumps straight to a screen (testing only). Names: welcome cafe order read_rhyme read_blend read_gpc read_word read_tricky trace trace_copy trace_memory market till kitchen kitchen_trace kitchen_qty kitchen2 recipe_card recipe_book piano_follow piano piano_beat piano_rhythm piano_highlow piano_recall piano_card piano_free serve reward book wait closing settings
// A maths jump screen: one graded task of that item on the market (or the till), for screenshots; it never answers anything.
function jumpMath(key,host,skill='math'){const t=skill==='shapes'?shapeTask(cur,key,Math.random):mathTask(cur,key,Math.random),g={t,skill,review:false};mpend={market:host==='market'?g:null,till:host==='till'?g:null};stage_=host;mathStart(host,g);}
const jumpKit=(id,doneFirst=0)=>{const r=recipes.recipes.find(x=>x.id===id)||recipes.recipes[0];kit=mkKit(r,r.ingredients.map((g,i)=>i<doneFirst?g.qty:0));return r;}; // the first `doneFirst` ingredients already in the pot
function jumpTo(name){started=Date.now();customer=1;const jr=jumpKit('popcorn');order={food:'jam',word:'jam',n:3,recipe:jr};
 switch(name){
  case 'welcome':welcome();break;
  case 'cafe':customer=0;demoShelf=['popcorn','jam_toast','pizza'];cafe();break;
  case 'order':customer=0;newOrder();break;
  case 'read_rhyme':startRead('rhyme:cat');break;
  case 'read_blend':startRead('blend:pan');break;
  case 'read_gpc':startRead('gpc:s');break;
  case 'read_word':startRead('read:pot');break;
  case 'read_tricky':startRead('tricky:the');break;
  case 'trace':case 'ticket':startTrace('trace:stroke_down');break;
  case 'trace_copy':progress.guide.circle_ccw={g:4,run:0,demos:0};startTrace('trace:circle_ccw');break;
  case 'trace_memory':progress.guide.cross={g:5,run:0,demos:0};studyHold=new URLSearchParams(location.search).get('hold')==='1'?600000:0;startTrace('trace:cross');break;
  case 'market':market();amount=1;drawMarket();break;
  case 'till':paid=1;till();paid=1;drawTill('pay');break;
  case 'kitchen':drawKitchen();break;
  case 'kitchen_trace':openIngredient(1);traceAt=1;traceScreen();break;
  case 'kitchen_qty':jumpKit('butter');kit.reps[0]=1;kit.pot=['pic_cream'];openIngredient(0);break; // a qty-2 word after its first rep: "1 of 2"
  case 'kitchen2':jumpKit('popcorn',3);kit.pot=kit.ings.flatMap(g=>Array(g.qty).fill(g.art));drawKitchen();break;
  case 'recipe_card':showOrder();break;
  case 'recipe_book':progress.recipeBook=['popcorn','jam_toast','pancakes','soup'];progress.stickerIds=[0,1,2,5,7,9];stickerBook();break;
  case 'piano_follow':jumpKit('popcorn',3);kit.pot=kit.ings.flatMap(g=>Array(g.qty).fill(g.art));showPiano(false,'follow:hot_cross_buns',1);break;
  case 'piano':{jumpKit('popcorn',3);kit.pot=kit.ings.flatMap(g=>Array(g.qty).fill(g.art));const lv=level('music'),its=levelItems(cur,'music',lv); // a probe plays an item of her own level, never a review of an older one
   showPiano(false,its.length?its[Math.floor(Math.random()*its.length)]:undefined,its.length?lv:undefined);break;}
  case 'piano_beat':jumpKit('popcorn',3);kit.pot=kit.ings.map(g=>g.art);showPiano(false,'beat:96',5);break;
  case 'piano_rhythm':jumpKit('popcorn',3);kit.pot=kit.ings.map(g=>g.art);showPiano(false,'rhythm:'+cur.music[5].patterns[0],6);break;
  case 'piano_highlow':jumpKit('popcorn',3);kit.pot=kit.ings.map(g=>g.art);showPiano(false,'hl:C4',7);break;
  case 'piano_recall':jumpKit('popcorn',3);kit.pot=kit.ings.map(g=>g.art);showPiano(false,'phrase:'+phrasesFor(cur,12)[0].join(','),12);break;
  case 'piano_card':jumpKit('popcorn',3);kit.pot=kit.ings.map(g=>g.art);showPiano(false,'phrase:'+cur.music[16].phrases[0].join(','),17);break;
  case 'piano_free':pianoFree();break;
  case 'math_crate':mpend={market:{t:mathTask(cur,'count:8',Math.random),skill:'math',review:false},till:null};order.n=8;market();amount=5;drawMarket();break; // M4: the basket is the ten-frame crate (not in screens-check; device-test names it)
  case 'math_flash':jumpMath('sub:4','market');break;
  case 'math_compare':jumpMath('cmp:more','market');break;
  case 'math_path':jumpMath('path:+2','market');break;
  case 'math_hide':jumpMath('bond:5:2','market');break;
  case 'math_story':jumpMath('take:5','market');break;
  case 'math_tenframe':jumpMath('make10:4','market');break;
  case 'math_coins':jumpMath('price:35','till');mstate.coins=[10,5];mathDraw();break;
  case 'math_change':jumpMath('change:15','till');mstate.coins=[5];mathDraw();break;
  case 'math_shapes':jumpMath('pattern:AAB','market','shapes');break;
  case 'math_compose':jumpMath('compose:square','market','shapes');break;
  case 'serve':serve();break;
  case 'reward':progress.stickerIds=[0,5,7];demoShelf=['popcorn','jam_toast','butter','soup','cookies'];reward();break;
  case 'book':progress.stickerIds=[0,1,2,5,7,9];stickerBook();break;
  case 'wait':progress.stickerIds=[0,5,7,2];customer=4;waiting();break;
  case 'closing':case 'goodbye':progress.stickerIds=[0,5,7,2];surpriseOff=true;goodbye(true);break;
  case 'settings':welcome();adultGate();settings(document.querySelector('.adult'));break;
  default:welcome();}}
if(jump)jumpTo(jump);else welcome();
