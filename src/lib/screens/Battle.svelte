<script lang="ts">
  // The Cheer Duel. Spark over your buddy, Grump over the Grumble, three power cards at the bottom. Pick a
  // card, answer it, and the number you make cheers the Grumble up (land exactly on zero for a Perfect
  // Cheer). Then it hits back: answer a quick one before the ring runs out to put your shield up and block
  // it. Each one that gets through takes energy (and the next is bigger), and at zero your buddy needs a
  // rest. Five right in a row lights the Finale. When it's cheered right up, the cloud bursts and the
  // Glimmer inside is revealed, with its rarity.
  import MusicButton from '../ui/MusicButton.svelte';
  import { onDestroy, onMount } from 'svelte';
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { fade } from 'svelte/transition';
  import { game } from '../state/game.svelte';
  import { stage } from '../three/stage';
  import { BattleScene } from '../three/battleScene';
  import { sfx } from '../audio/sound';
  import { funEvent } from '../fun/bus';
  import { buddyPal, danceOf, outfitOf } from '../engine/profile';
  import { levelFromXp } from '../engine/stickers';
  import { FRIEND } from '../art/cast';
  import { answerOf, opSign, type Fact } from '../math/facts';
  import { trickOf } from '../math/course';
  import { BUDDY_ROLE, ELEMENT, EVOLVE_BOOST, EVOLVED, GEAR, GLIMMER, RARITY, ROLE, glimmerName, rarityRank, type Element, type GlimmerId } from '../adventure/glimmers';
  import { canEvolve } from '../adventure/evolve';
  import { newBattle, play, block as doBlock, finale as doFinale, swap as doSwap, openFact, sparkFor, hitFor, useGlow, glowLeft, FINALE_AT, type Battle, type BEvent, type Card, type Foe } from '../adventure/battle';
  import { advOf, advView, applyBattle, foeFor, ISLAND, markSeen, mathPool, NODE, teamOf, typingPool, type BattleOutcome } from '../adventure/state';
  import { learnedTrick } from '../math/learn';
  import { ITEM, SLOT_NAME, SLOTS, battleWornOf, kitOf, startPerks } from '../adventure/gear';
  import { mathOf as mathOfLearn } from '../math/progress';
  import { answerText } from '../math/skills/text';
  import type { Answer as SkillAnswer } from '../math/skills/types';
  import SkillPrompt from '../math/skills/ui/SkillPrompt.svelte';
  import SkillInput from '../math/skills/ui/SkillInput.svelte';
  import Coach from '../ui/Coach.svelte';
  import NumPad from '../math/ui/NumPad.svelte';
  import Critter from '../ui/Critter.svelte';
  import GlimmerCard from '../ui/GlimmerCard.svelte';
  import Confetti from '../ui/Confetti.svelte';
  import Icon from '../ui/Icon.svelte';
  import { dropHeld, holdAnswer, letGo } from '../ui/holdAnswer';

  const base = import.meta.env.BASE_URL;
  const p0 = game.profile!;
  const node = NODE[game.battleNode ?? 'meadow-0'];
  const island = ISLAND[node.island];
  const adv = advOf(p0);
  // a math world (Fraction Falls) is always math, every card from its area
  const subject = island.area ? 'math' : adv.subject;
  const pool = subject === 'math' ? mathPool(p0, island.area) : typingPool(p0);
  const seed = (Date.now() % 1e9) | 0;
  const team = teamOf(adv);
  const role = BUDDY_ROLE[p0.buddy] ?? 'heart';
  const outfit = outfitOf(p0);
  const gear = GEAR[outfit] ?? null;
  const level = levelFromXp(buddyPal(p0).xp).level;
  // hand, back and shoe gear: its powers (and any set bonus) and the pieces for the 3D buddy
  const kit = kitOf(adv, p0.buddy), worn = battleWornOf(adv, p0.buddy);
  // the Grumble here, and how hard its counterattacks bite: a share of the energy the buddy starts with
  const foe: Foe = { ...foeFor(p0, node, pool, seed), hit: hitFor({ champion: node.kind === 'champion', tier: island.tier, level, subject }) };
  const b: Battle = newBattle({ pool, seed, sparkMax: sparkFor(level, role), role, gear: gear?.kind ?? null, team, foe, fastMs: p0.math?.fastMs, kit });
  const t0 = performance.now();
  const champion = node.kind === 'champion';

  let scene: BattleScene | null = null;
  let disposed = false;
  let ui = $state<'loading' | 'intro' | 'pick' | 'answer' | 'busy' | 'block' | 'won' | 'lost'>('loading');
  let cards = $state<Card[]>([]);
  let finaleN = $state(b.finale);
  let streak = $state(0);
  const spark = new Tween(b.spark, { duration: 500, easing: cubicOut });
  // the energy just lost stays on the bar a moment (a lighter strip) before it drains away
  const sparkLag = new Tween(b.spark, { duration: 800, delay: 450, easing: cubicOut });
  let barHurt = $state(false);
  const grump = new Tween(b.foe.grump, { duration: 650, easing: cubicOut });
  let sparkNow = $state(b.spark);
  let grumpNow = $state(b.foe.grump);
  let swapOk = $state(role === 'trick');
  let glowOk = $state(team.some(m => GLIMMER[m.id].power.kind === 'glow'));
  let glowText = $state('');
  /** the card whose learned trick is showing */
  let trickOpen = $state<number | null>(null);

  // answering
  let sel = $state<Card | null>(null);
  let choice = $state<number | null>(null);
  let typed = $state('');
  let wordPos = $state(0); let wordErr = $state(0); let shakeKey = $state(0);
  let shownAt = 0;
  /** a skill card's answer as it's typed (shown in the question's gap) */
  let skFill = $state<{ kind: 'number'; text: string } | { kind: 'fraction'; n: string; d: string; focus: 'n' | 'd' | null } | null>(null);
  // blocking
  let blk = $state<{ name: string; fact?: Fact; word?: string; limitMs: number; hit: number; bold: boolean } | null>(null);
  let blockAt = 0; let blockLeft = $state(1); let blockTimer = 0;

  // floating numbers and messages
  type Float = { id: number; x: number; y: number; text: string; kind: string; img?: string };
  let floats = $state<Float[]>([]); let fid = 0;
  let toast = $state<{ text: string; kind: string; key: number } | null>(null);
  let bigBanner = $state<{ text: string; sub?: string; kind: string; key: number } | null>(null);
  let burst = $state(0);
  let budPos = $state({ x: 0.27, y: 0.2 }); let foePos = $state({ x: 0.7, y: 0.18 });
  let narrow = $state(innerWidth < 760);
  let vh = $state(innerHeight);
  // the joined card shrinks on short screens so the title, card, prizes and buttons all fit
  const revealW = $derived(Math.round(Math.max(130, Math.min(narrow ? 160 : 210, (vh - (narrow ? 560 : 620)) * 0.62))));
  let stageEl: HTMLDivElement | undefined = $state();
  /** the answer lines (held on screen a moment after the last digit) */
  let eqEl: HTMLDivElement | undefined = $state(); let blockEqEl: HTMLDivElement | undefined = $state();
  let raf = 0;

  // tips for a first-time player (shown once each)
  const seen = new Set(advView(p0).seen ?? []);
  const firstBattle = !seen.has('battle1');
  let coach = $state<{ text: string; at: string | null; button?: string; id: string } | null>(null);
  let help = $state(false);
  function tip(id: string, text: string, at: string | null, button?: string): boolean {
    if (seen.has(id)) return false;
    seen.add(id); coach = { id, text, at, button };
    return true;
  }
  function closeTip(id?: string) { if (!id || coach?.id === id) coach = null; }
  const foeName = glimmerName(foe.glimmer, foe.evolved);
  // your own Glimmers: grown-up name and painting once evolved
  const evolvedIds = new Set(team.filter(m => m.evolved).map(m => m.id));
  const myName = (id: GlimmerId) => glimmerName(id, evolvedIds.has(id));
  const myArt = (id: GlimmerId) => `${base}game/glimmers/face/${id}${evolvedIds.has(id) ? '-evo' : ''}.webp`;
  const canPerfect = $derived(subject === 'math' ? cards.some(c => (c.item ? c.value : c.fact ? answerOf(c.fact) : -1) === grumpNow) : cards.some(c => c.word?.length === grumpNow));

  // the end
  let out = $state<BattleOutcome | null>(null);
  let step = $state(0);

  const fact = (c: Card | null) => (c?.fact ?? (c?.open && choice !== null ? openFact(c.open, choice) : null));
  const ansLen = $derived.by(() => { const f = fact(sel); return f ? String(answerOf(f)).length : 0; });
  const factText = (f: Fact) => `${f.a} ${opSign(f)} ${f.b}`;

  function viewOf() {
    const r = stageEl?.getBoundingClientRect();
    return r ? { top: r.top / innerHeight, bottom: r.bottom / innerHeight, left: r.left / innerWidth, right: r.right / innerWidth } : { top: 0.12, bottom: 0.62, left: 0, right: 1 };
  }
  function onResize() { narrow = innerWidth < 760; if (scene) scene.view = viewOf(); }

  onMount(async () => {
    addEventListener('resize', onResize);
    try {
      const sc = await BattleScene.create({ buddy: p0.buddy, outfit, dance: danceOf(p0), region: island.region, team: team.map(t => t.id), teamEvolved: team.map(t => !!t.evolved), foe: { glimmer: foe.glimmer, rarity: foe.rarity, champion, evolved: foe.evolved }, view: viewOf(), kit: worn });
      if (disposed) { sc.dispose(); return; }
      scene = sc; stage.use(sc);
      requestAnimationFrame(onResize);
      const tick = () => { if (scene && !narrow) { budPos = scene.screenOf('buddy', 0.35); foePos = scene.screenOf('foe', 0.25); } raf = requestAnimationFrame(tick); };
      tick();
    } catch (e) { console.error(e); }
    ui = 'intro';
    sfx.battleStart();
    funEvent('battleStart'); // (once in a while the grumpy Glimmer sneezes: src/lib/fun)
    bigBanner = { text: `${foeName} is grumpy!`, sub: champion ? `The Champion of ${island.name}. Cheer it up and it joins your team!` : 'Answer cards to cheer it up. Then it joins your team!', kind: champion ? 'champ' : 'intro', key: Date.now() };
    setTimeout(() => {
      bigBanner = null; sync(); ui = 'pick';
      // gear that works from the start says so
      startPerks(kit).forEach((g, i) => setTimeout(() => { if (!disposed) { sfx.helper(); helped(undefined, g.what, g.did, `${base}gear/${g.item}.webp`); } }, 300 + i * 700));
      if (firstBattle) tip('t-cards', b.cards.some(c => c.item) ? 'Tap a card and answer it. Every right answer cheers it up, and harder cards cheer more (see the number on each)!' : 'Tap a card, then type the answer. Every right answer cheers it up, and bigger answers cheer more!', '.cards');
    }, champion ? 2800 : 2300);
  });
  onDestroy(() => { disposed = true; dropHeld(); cancelAnimationFrame(raf); clearInterval(blockTimer); removeEventListener('resize', onResize); if (scene && stage.current() === scene) stage.use(null); });

  function sync() {
    cards = b.cards.slice(); finaleN = b.finale; streak = b.streak;
    sparkNow = b.spark; grumpNow = b.foe.grump;
    spark.target = b.spark; sparkLag.target = b.spark; grump.target = b.foe.grump;
    scene?.setGrump(b.foe.grump / b.foe.max);
  }
  function float(which: 'buddy' | 'foe' | 'team0' | 'team1' | 'shield', text: string, kind: string, img?: string) {
    const pos = scene?.screenOf(which, 0.2) ?? { x: which === 'buddy' ? 0.3 : 0.7, y: 0.3 };
    // a helper's badge stays on screen even when its Glimmer stands at the very edge
    const edge = Math.min(0.4, 105 / Math.max(1, innerWidth));
    const x = kind === 'helper' ? Math.min(1 - edge, Math.max(edge, pos.x)) : pos.x + (Math.random() - 0.5) * 0.03;
    // badges that come together (a Glimmer and a piece of gear) stack instead of covering each other
    const stack = kind === 'helper' ? floats.filter(q => q.kind === 'helper').length : 0;
    const f = { id: fid++, x, y: kind === 'helper' ? Math.max(0.2, pos.y) + stack * 0.075 : pos.y, text, kind, img };
    floats = [...floats, f];
    setTimeout(() => (floats = floats.filter(x => x.id !== f.id)), kind === 'helper' ? 2200 : kind === 'blocked' ? 1400 : 1500);
  }
  /** A helper's badge: who helped, with what, and what it did. */
  function helped(id: string | undefined, what: string, did: string, pic?: string) {
    const slot = id ? team.findIndex(m => m.id === id) : -1;
    const who = slot === 0 ? 'team0' : slot === 1 ? 'team1' : 'buddy';
    const img = pic ?? (id ? myArt(id as GlimmerId) : `${base}portraits/${p0.buddy}-head.png`);
    float(who, `${what}: ${did}`, 'helper', img);
  }
  // tap anything (a team member, a bar, the Finale stars) to see what it is
  let info = $state<{ kind: 'glimmer'; id: string } | { kind: 'buddy' | 'grumpy' | 'energy' | 'finale' | 'shells' | 'friendship' | 'egg' | 'reward' | 'gear'; id?: string } | null>(null);
  function show(i: NonNullable<typeof info>) { info = i; sfx.pop(); }
  function say(text: string, kind = 'info') { toast = { text, kind, key: Date.now() }; setTimeout(() => { if (toast?.text === text) toast = null; }, 2200); }

  // ---------- picking and answering ----------
  function pick(c: Card) {
    if (ui !== 'pick') return;
    closeTip('t-cards'); closeTip('strong');
    sel = c; choice = null; typed = ''; wordPos = 0; wordErr = 0; glowText = '';
    ui = 'answer'; sfx.click(); letGo();
    shownAt = performance.now();
  }
  function back() { if (ui === 'answer') { sel = null; ui = 'pick'; } }
  function choose(n: number) { if (!sel?.open) return; choice = n; typed = ''; shownAt = performance.now(); sfx.pop(); }
  function digit(d: string) {
    if (ui === 'block') { blockTyped += d; if (blk?.fact && blockTyped.length >= String(answerOf(blk.fact)).length) submitBlock(); return; }
    if (ui !== 'answer' || !sel || subject !== 'math' || sel.item) return;
    if (sel.open && choice === null) { const n = Number(d); if (n <= sel.open.max) choose(n === 0 && sel.open.op === 'x' ? 10 : n); return; }
    typed += d; sfx.click();
    if (typed.length >= ansLen) submit();
  }
  function backspace() { if (ui === 'block') blockTyped = blockTyped.slice(0, -1); else typed = typed.slice(0, -1); }
  let blockTyped = $state('');

  async function submit() {
    const c = sel; if (!c) return;
    const f = fact(c);
    const think = performance.now() - shownAt;
    ui = 'busy';
    const right = subject === 'math' ? !!f && Number(typed) === answerOf(f) : true;
    // the whole answer, last digit too, stays where it was for a moment (the game moves on as usual)
    holdAnswer(eqEl, { text: typed, ok: right });
    const ev = subject === 'math'
      ? play(b, c.id, { ok: right, value: Number(typed), thinkMs: think, fact: f ?? undefined })
      : play(b, c.id, { ok: true, value: Math.max(1, (c.word?.length ?? 1) - wordErr), thinkMs: think });
    if (ev.length === 1 && ev[0].k === 'retry') { letGo(); sfx.miss(); say(`${GEAR[outfit]?.name ?? 'Second Chance'}: have another go!`, 'good'); typed = ''; wordPos = 0; wordErr = 0; ui = 'answer'; shakeKey++; return; }
    sel = null; typed = '';
    await run(ev);
  }
  /** A skill card (a fraction to name, two to compare...): its own input checks in, the engine marks it. */
  // (for checking a battle from the console: the card's question, and answering it)
  if (import.meta.env.DEV) (window as unknown as { __battle: object }).__battle = { ui: () => ui, item: () => sel?.item ?? null, block: () => (blk?.fact ? String(answerOf(blk.fact)) : blk?.word ?? null), cards: () => cards.length, pick: (i: number) => { const c = cards[i]; if (c) pick(c); }, answer: (a: SkillAnswer) => submitItem(a) };
  async function submitItem(given: SkillAnswer) {
    const c = sel; if (!c?.item || ui !== 'answer') return;
    const think = performance.now() - shownAt;
    ui = 'busy';
    const ev = play(b, c.id, { ok: true, value: 0, thinkMs: think, given });
    if (ev.length === 1 && ev[0].k === 'retry') { sfx.miss(); say(`${GEAR[outfit]?.name ?? 'Second Chance'}: have another go!`, 'good'); skFill = null; ui = 'answer'; shakeKey++; return; }
    sel = null; skFill = null;
    await run(ev);
  }

  // typing cards and typing blocks
  function onKey(e: KeyboardEvent) {
    if (ui === 'won' || ui === 'lost') { if (e.key === 'Enter') { e.preventDefault(); toMap(); } return; }
    if (subject === 'math') {
      // a skill card's own input takes the keys
      if (ui === 'answer' && sel?.item) { if (e.key === 'Escape') back(); return; }
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); digit(e.key); }
      else if (e.key === 'Backspace') { e.preventDefault(); backspace(); }
      else if (e.key === 'Escape') back();
      else if ((e.key === 'f' || e.key === 'F') && finaleN >= FINALE_AT && ui === 'pick') doTheFinale();
      else if (ui === 'pick' && ['1', '2', '3', '4'].includes(e.key)) { /* digits handled above */ }
      return;
    }
    if (e.key.length !== 1) { if (e.key === 'Escape') back(); return; }
    if (ui === 'pick') {
      // start typing a card's word straight away: the card whose word starts with that letter
      const c = cards.find(x => x.word?.startsWith(e.key));
      if (c) { pick(c); typeChar(e.key); }
      return;
    }
    if (ui === 'answer' || ui === 'block') { e.preventDefault(); typeChar(e.key); }
  }
  function typeChar(ch: string) {
    const word = ui === 'block' ? blk?.word : sel?.word;
    if (!word) return;
    if (ch === word[wordPos]) { wordPos++; sfx.click(); if (wordPos >= word.length) { if (ui === 'block') submitBlock(); else submit(); } }
    else { wordErr++; shakeKey++; sfx.slip(); }
  }

  async function doTheFinale() {
    if (ui !== 'pick' || b.finale < FINALE_AT) return;
    closeTip('t-finale');
    ui = 'busy'; sfx.finale();
    bigBanner = { text: 'Finale!', sub: `${FRIEND[p0.buddy].name} takes the stage`, kind: 'finale', key: Date.now() };
    setTimeout(() => (bigBanner = null), 1600);
    const ev = doFinale(b);
    await scene?.finale();
    await run(ev, true);
  }
  function swapCards() { if (doSwap(b)) { swapOk = false; cards = b.cards.slice(); sfx.whoosh(); say('Trickster: new cards!'); } }
  function askGlow() {
    const f = fact(sel), it = sel?.item;
    if ((!f && !it) || !useGlow(b)) return;
    glowOk = glowLeft(b);
    glowText = it ? it.trick?.say ?? it.explain : subject === 'math' && f ? trickOf(f).say : '';
    sfx.hint();
  }

  // ---------- playing the events ----------
  async function run(ev: BEvent[], fromFinale = false) {
    for (const e of ev) {
      if (disposed) return;
      if (e.k === 'cast') {
        if (e.ok) sfx.cast(e.card.element); else sfx.miss();
        await scene?.cast(e.card.element, e.value, { perfect: e.perfect, super: e.super, ok: e.ok, big: e.value / Math.max(1, b.foe.max) * 2.2 });
        if (e.ok) {
          sfx.hit(Math.min(1, e.value / Math.max(1, b.foe.max) * 3));
          float('foe', `−${e.value}`, e.card.element);
          if (e.perfect) { sfx.perfect(); bigBanner = { text: 'Perfect Cheer!', sub: `Exactly ${e.value}!`, kind: 'perfect', key: Date.now() }; burst++; }
          else if (e.super) say(`⚡ Strong! ${ELEMENT[e.card.element].name} beats ${ELEMENT[b.foe.element].name}.`, 'super');
        } else { say(e.card.item ? `Not quite: it's ${answerText(e.card.item)}` : subject === 'math' && e.card.fact ? `Not quite: ${factText(e.card.fact)} = ${answerOf(e.card.fact)}` : 'Not quite!', 'miss'); }
        sync();
      } else if (e.k === 'extra') {
        const slot = e.id ? team.findIndex(m => m.id === e.id) : -1;
        sfx.helper();
        helped(e.id, e.what, `+${e.value} cheer`, e.item ? `${base}gear/${e.item}.webp` : undefined);
        await scene?.extra(slot, e.id ? GLIMMER[e.id].element : 'sun');
        float('foe', `−${e.value}`, 'extra');
        sync();
      } else if (e.k === 'heal') {
        const slot = e.id ? team.findIndex(m => m.id === e.id) : -1;
        scene?.heal(slot); sfx.heal();
        helped(e.id, e.what, `+${e.value} energy`, e.item ? `${base}gear/${e.item}.webp` : undefined); sync();
        await sleep(300);
      } else if (e.k === 'freeze') { scene?.freeze(team.findIndex(m => m.id === e.id)); sfx.freeze(); helped(e.id, GLIMMER[e.id].power.name, `${foeName} is frozen!`); await sleep(400); }
      else if (e.k === 'bubble') { sfx.shield(true); helped(e.id, e.what, 'a shield for the next rain or zap!'); await sleep(350); }
      else if (e.k === 'gear') {
        // a piece of gear did its thing: its own badge, with its picture
        sfx.helper(); helped(undefined, e.what, e.did, `${base}gear/${e.item}.webp`);
        if (e.item === 'bubble_wand') sfx.shield(true);
        sync(); await sleep(350);
      }
      else if (e.k === 'dazzle') { scene?.dazzle(); }
      else if (e.k === 'streakKept') { say(`${myName(e.id)} kept your row going!`, 'good'); }
      else if (e.k === 'aurora') { scene?.aurora(); sfx.aurora(); say('Aurora! Your Finale is ready.', 'super'); await sleep(600); }
      else if (e.k === 'finaleReady') { sfx.finaleReady(); }
      else if (e.k === 'finale') { sfx.hit(1); float('foe', `−${e.value}`, 'finale'); sync(); }
      else if (e.k === 'mischief') {
        if (e.result === 'skip') {
          say(e.why === 'frozen' ? `Frozen! ${foeName} can't send anything.` : e.why === 'Hover' ? 'Hover! You floated right over it.' : `${e.why} blocked it for you!`, 'good');
          await scene?.mischief(e.kind, 'skip', e.why);
        } else {
          if (e.kind === 'zap') sfx.zap(); else sfx.whoosh();
          await scene?.mischief(e.kind, e.result);
          if (e.damage === 0) {
            // it bangs into the shield (a clang), then boings back at the Grumble
            sfx.thunk(14); sfx.shield(true); setTimeout(() => { if (!disposed) sfx.boink(); }, 160);
            float('shield', 'Blocked!', 'blocked');
          } else {
            if (e.result === 'half') sfx.shield(false);
            sfx.rainHit(); float('buddy', `−${e.damage}`, 'hurt');
            barHurt = false; requestAnimationFrame(() => (barHurt = true)); setTimeout(() => (barHurt = false), 900);
          }
          sync();
        }
      } else if (e.k === 'secondwind') { scene?.heal(team.findIndex(m => GLIMMER[m.id].power.kind === 'secondwind')); sfx.heal(); say('Sky Whale gives you energy back!', 'super'); float('buddy', `+${e.value} energy`, 'heal'); sync(); }
      else if (e.k === 'won') { await won(e.perfect); return; }
      else if (e.k === 'lost') { lost(); return; }
    }
    sync();
    if (b.phase === 'block') startBlock();
    else if (b.phase === 'pick') {
      ui = 'pick'; swapOk = role === 'trick' && !b.used.swap; letGo();
      if (firstBattle && b.stats.right >= 1) tip('t-grumpy', 'See its Grumpy bar go down? Get it all the way to 0 and it will be happy again.', '.bar.grump', 'Got it');
      if (b.stats.blocks >= 1 && seen.has('t-grumpy') && coach === null) tip('t-energy2', 'This is your energy. Rain and zaps you don\'t block take some, and each one in a row hits harder. If it runs out, your buddy needs a rest.', '.bar.spark', 'Got it');
      if (b.finale >= FINALE_AT) tip('t-finale', 'Five right in a row! Tap Finale for your buddy\'s big move. It cheers up a lot!', '.finalebig');
      else if (coach === null && cards.some(c => c.super)) tip('strong', 'Cards marked Strong are extra strong against this Glimmer: they also calm its next rain and fill a Finale star.', '.card.super', 'Got it');
      else if (coach === null && canPerfect && b.stats.right >= 2) tip('perfect', `Bonus: answer exactly ${grumpNow} for a Perfect Cheer! You get extra shells and an egg.`, '.bar.grump', 'Got it');
    }
    void fromFinale;
  }

  function startBlock() {
    const bl = b.block!;
    blk = { name: bl.name, fact: bl.fact, word: bl.word, limitMs: bl.limitMs, hit: kit.includes('cape') && !bl.half ? Math.ceil(bl.hit / 2) : bl.hit, bold: b.bold > 0 };
    letGo();
    // the very first one a player meets says what a miss costs, and the ring waits while they read it
    const told = tip('t-counter', 'Miss it and you lose energy. Answer before the ring runs out!', '.blockbox');
    blockTyped = ''; wordPos = 0; wordErr = 0;
    ui = 'block'; blockAt = performance.now() + (told ? 2500 : 0); blockLeft = 1;
    scene?.windup(); sfx.rainComing();
    clearInterval(blockTimer);
    blockTimer = window.setInterval(() => {
      const k = Math.max(0, performance.now() - blockAt) / bl.limitMs;
      blockLeft = Math.max(0, 1 - k);
      // out of time: it lands
      if (k >= 1) submitBlock(true);
    }, 50);
  }
  async function submitBlock(timeout = false) {
    if (ui !== 'block' || !blk) return;
    clearInterval(blockTimer);
    const ms = Math.max(0, performance.now() - blockAt);
    const ok = !timeout && (subject === 'math' ? !!blk.fact && Number(blockTyped) === answerOf(blk.fact) : wordErr === 0);
    if (!timeout) holdAnswer(blockEqEl, { text: blockTyped, ok });
    if (subject === 'math' && blk.fact && !ok) say(timeout ? `Too slow! ${factText(blk.fact)} = ${answerOf(blk.fact)}` : `${factText(blk.fact)} = ${answerOf(blk.fact)}`, 'miss');
    closeTip('t-counter');
    blk = null; ui = 'busy';
    await run(doBlock(b, ok, ms));
  }

  // ---------- the end ----------
  async function won(perfect: boolean) {
    ui = 'busy';
    sync(); if (!perfect) sfx.cheeredUp(0.5); // (a Perfect Cheer already played its fanfare)
    let o: BattleOutcome | null = null;
    game.update(pp => {
      o = applyBattle(pp, { node: node.id, subject, won: true, perfect, foe, ms: performance.now() - t0, answers: b.stats.answers + b.stats.blocks, right: b.stats.right, answered: b.answered, skillAnswers: b.skillAnswers, team: team.map(t => t.id), crystal: team.some(m => GLIMMER[m.id].power.kind === 'crystal'), treasureNose: gear?.kind === 'treasure', at: Date.now(), seed });
    });
    const res = o as BattleOutcome | null;
    if (!res?.met) { out = res; ui = 'won'; return; }
    bigBanner = null; toast = null; coach = null;
    game.update(pp => markSeen(pp, 'battle1', ...seen));
    await scene?.cheerUp(res.met.id, res.met.rarity);
    sfx.reveal(rarityRank(res.met.rarity));
    burst++;
    out = res; step = 0; ui = 'won';
    setTimeout(() => (step = 1), 1400);
    setTimeout(() => (step = 2), 2600);
  }
  function lost() {
    ui = 'lost'; coach = null; letGo();
    game.update(pp => markSeen(pp, 'battle1', ...seen));
    scene?.lose(); sfx.tryAgain();
    game.update(pp => { out = applyBattle(pp, { node: node.id, subject, won: false, perfect: false, foe, ms: performance.now() - t0, answers: b.stats.answers + b.stats.blocks, right: b.stats.right, answered: b.answered, skillAnswers: b.skillAnswers, team: team.map(t => t.id), crystal: false, treasureNose: false, at: Date.now(), seed }); });
  }
  function toMap() { game.go('adventure'); }
  function again() { game.battleKey++; }
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
  // after a win: your own Glimmers by their grown-up names, and any that just reached the level to evolve
  const ownName = (id: GlimmerId) => glimmerName(id, !!advView(game.profile!).glimmers[id]?.evolved);
  const readyNow = $derived(out ? [...new Set([...out.teamUps.map(t => t.id), ...(out.met?.ups ? [out.met.id] : [])])].filter(id => canEvolve(advView(game.profile!), id)) : []);
  const RARE_WORDS: Record<string, string> = { common: 'Easy to find', uncommon: 'A bit harder to find', rare: 'Hard to find!', epic: 'Very hard to find!', legendary: 'One of a kind!', mythic: 'The rarest of all!' };
  const grumpPct = $derived((grump.current / Math.max(1, b.foe.max)) * 100);
  const sparkPct = $derived((spark.current / Math.max(1, b.sparkMax)) * 100);
  const sparkLagPct = $derived((Math.max(spark.current, sparkLag.current) / Math.max(1, b.sparkMax)) * 100);
  // under a third: the bar pulses red (it can really run out now)
  const lowSpark = $derived(sparkNow > 0 && sparkNow / Math.max(1, b.sparkMax) < 0.3 && ui !== 'won');
  const strongEl = $derived(Object.entries(ELEMENT).find(([, v]) => v.beats === b.foe.element)?.[0] as Element);
</script>

<svelte:window onkeydown={onKey} bind:innerHeight={vh} />

<div class="battle" class:narrow class:won={ui === 'won'}>
  <div class="top">
    <button class="leave" onclick={toMap} aria-label="Leave the battle"><Icon name="back" size={28} /></button>
    <div class="where"><small>{island.name}</small><b>{champion ? 'Champion battle' : `Battle ${node.n + 1}`}</b></div>
    <button class="helpbtn" onclick={() => { help = true; sfx.pop(); }} aria-label="How to play"><Icon name="help" size={30} /></button>
    <MusicButton size={32} plain />
  </div>

  <!-- your energy over your buddy, its grumpy bar over it (on phones both sit at the top) -->
  <button class="bar spark" class:low={lowSpark} class:hurt={barHurt} style:left={narrow ? '10px' : `${budPos.x * 100}%`} style:top={narrow ? '62px' : `${budPos.y * 100}%`} onclick={() => show({ kind: 'energy' })}>
    <img class="bi" src="{base}game/icon-spark.webp" alt="" />
    <div class="bt"><span class="lab">{lowSpark ? 'Low energy!' : 'Your energy'}</span><div class="track"><div class="fill lag" style:width="{sparkLagPct}%"></div><div class="fill" style:width="{sparkPct}%"></div></div><span class="num"><b>{sparkNow}</b> / {b.sparkMax}</span></div>
  </button>
  <button class="bar grump" class:champ={champion} style:left={narrow ? 'auto' : `${foePos.x * 100}%`} style:right={narrow ? '10px' : 'auto'} style:top={narrow ? '62px' : `${Math.max(0.2, foePos.y) * 100}%`} onclick={() => show({ kind: 'grumpy' })}>
    <img class="bi" src="{base}game/icon-grump.webp" alt="" />
    <div class="bt"><span class="lab">{foeName} is grumpy</span><div class="track"><div class="fill" style:width="{grumpPct}%"></div></div><span class="num"><b>{grumpNow}</b> grumps left</span></div>
  </button>

  <div class="teamrow">
    <button class="bud" onclick={() => show({ kind: 'buddy' })}><Critter friend={p0.buddy} size={narrow ? 34 : 44} round /><em><b>{FRIEND[p0.buddy].name}</b>{ROLE[role].name}</em>{#if SLOTS.some(sl => worn[sl])}<span class="kit">{#each SLOTS as sl}{#if worn[sl]}<img src="{base}gear/{worn[sl]}.webp" alt={ITEM[worn[sl]!].name} />{/if}{/each}</span>{/if}</button>
    {#each team as m (m.id)}<button class="mate" onclick={() => show({ kind: 'glimmer', id: m.id })}><img src={myArt(m.id)} alt="" /><em><b>{myName(m.id)}</b>{GLIMMER[m.id].power.name}</em></button>{/each}
  </div>

  <div class="stage" bind:this={stageEl}></div>

  {#each floats as f (f.id)}<div class="float {f.kind}" style:left="{f.x * 100}%" style:top="{f.y * 100}%">{#if f.img}<img src={f.img} alt="" />{/if}{f.text}</div>{/each}
  {#if toast}{#key toast.key}<div class="toast {toast.kind}">{toast.text}</div>{/key}{/if}
  {#if bigBanner}{#key bigBanner.key}<div class="big {bigBanner.kind}"><b>{bigBanner.text}</b>{#if bigBanner.sub}<small>{bigBanner.sub}</small>{/if}</div>{/key}{/if}

  <div class="bottom">
    {#if finaleN >= FINALE_AT && ui === 'pick'}
      <button class="finalebig" onclick={doTheFinale}><img src="{base}game/icon-finale.webp" alt="" /><span><b>Finale!</b><small>Tap for {FRIEND[p0.buddy].name}'s big move</small></span></button>
    {:else}
      <button class="meter" onclick={() => show({ kind: 'finale' })}>
        <span class="ml">Finale</span>
        {#each Array(FINALE_AT) as _, i}<img class:on={i < finaleN} src="{base}game/icon-star.webp" alt="" />{/each}
      </button>
    {/if}

    {#if ui === 'pick' || ui === 'intro' || ui === 'loading'}
      <div class="cards" class:dim={ui !== 'pick'}>
        {#each cards as c, i (c.id)}
          <button class="card el-{c.element}" class:super={c.super} class:bloom={c.bloom} style:--d="{i * 0.08}s" onclick={() => pick(c)} disabled={ui !== 'pick'}>
            <img class="ci" src="{base}game/icon-{c.element}.webp" alt={ELEMENT[c.element].name} />
            <span class="ct">{#if c.item}<b class="it"><SkillPrompt parts={c.item.prompt} size={narrow ? 17 : 26} picSize={narrow ? 44 : 62} done /></b><em class="cv">+{c.value} cheer</em>{:else}<b>{#if c.fact}{factText(c.fact)}{:else}{c.word}{/if}</b>{/if}
              {#if c.again}<em class="ag">Have another go!</em>{:else if c.super}<em><Icon name="bolt" size={14} /> Strong</em>{:else if c.bloom}<em class="bl">You know this one</em>{/if}</span>
          </button>
        {/each}
      </div>
      <div class="actions">
        <p class="hint">{ui === 'pick' ? (subject === 'math' ? 'Tap a card and answer it to cheer up ' + foeName + '!' : 'Type a word to cheer up ' + foeName + '!') : ''}</p>
        {#if swapOk && ui === 'pick'}<button class="swap" onclick={swapCards}><Icon name="swap" size={20} /> New cards</button>{/if}
      </div>
    {:else if ui === 'answer' && sel}
      <div class="answer el-{sel.element}">
        {#if sel.item}
          {@const it = sel.item}
          <p class="ask">{it.ask} <b>+{sel.value} cheer</b></p>
          {#key shakeKey}<div class="iq" class:shake={shakeKey > 0}><SkillPrompt parts={it.prompt} fill={skFill} size={narrow ? 34 : 46} picSize={narrow ? 96 : 130} onpick={(w) => { if (skFill?.kind === 'fraction') skFill = { ...skFill, focus: w }; }} /></div>{/key}
          {#if glowOk && !glowText}<button class="glowbtn" onclick={askGlow}><Icon name="bulb" size={20} /> Hint from {myName('sparkmoth')}</button>{/if}
          {#if glowText}<p class="glow"><Icon name="bulb" size={20} /> {glowText}</p>{/if}
          {#key `${sel.id}-${shakeKey}`}<SkillInput item={it} compact={narrow} bind:fill={skFill} onanswer={submitItem} />{/key}
        {:else if subject === 'math'}
          {@const f = fact(sel)!}
          {@const tk = learnedTrick(mathOfLearn(game.profile!), f)}
          {#key shakeKey}<div class="eq" class:shake={shakeKey > 0} bind:this={eqEl}><span>{factText(f)} =</span><span class="box">{typed || ' '}</span></div>{/key}
          {#if glowOk && !glowText}<button class="glowbtn" onclick={askGlow}><Icon name="bulb" size={20} /> Hint from {myName('sparkmoth')}</button>{/if}
          {#if glowText}<p class="glow"><Icon name="bulb" size={20} /> {glowText}</p>{/if}
          <!-- a trick learned in a Learn lesson: a hint in its own words, the answer left for you -->
          {#if tk && !glowText}{#if trickOpen === sel.id}<p class="glow"><Icon name="bulb" size={20} /> {tk.say}</p>{:else}<button class="glowbtn" onclick={() => { trickOpen = sel!.id; sfx.pop(); }}><Icon name="bulb" size={20} /> Trick: {tk.name}</button>{/if}{/if}
          <NumPad ondigit={digit} onback={backspace} compact={narrow} />
        {:else}
          {#key shakeKey}<div class="word" class:shake={shakeKey > 0} bind:this={eqEl}>{#each sel.word!.split('') as ch, i}<span class:done={i < wordPos} class:next={i === wordPos}>{ch}</span>{/each}</div>{/key}
          <p class="ask">Type it! {wordErr ? `${wordErr} slip${wordErr === 1 ? '' : 's'}` : 'No slips so far'}</p>
        {/if}
        <button class="backbtn" onclick={back}>Pick a different card</button>
      </div>
    {:else if ui === 'block' && blk}
      <!-- it hits back: the shield, with the time left drawn as a ring round it, and the quick one to answer -->
      <div class="blockbox" class:bold={blk.bold}>
        <div class="bhead">
          <div class="shieldring" class:hurry={blockLeft < 0.34} style:--k={blockLeft}><img src="{base}icons/shield.webp" alt="" /></div>
          <div class="btxt"><small>{blk.name}!</small><b>Block it!</b><span>Answer quick to put your shield up</span></div>
        </div>
        <div class="bq">
          {#if blk.fact}<div class="eq blockeq" bind:this={blockEqEl}><span>{factText(blk.fact)} =</span><span class="box">{blockTyped || ' '}</span></div>
          {:else}<div class="word blockeq" bind:this={blockEqEl}>{#each blk.word!.split('') as ch, i}<span class:done={i < wordPos} class:next={i === wordPos}>{ch}</span>{/each}</div>{/if}
          <p class="stake"><img src="{base}game/icon-spark.webp" alt="" />{blk.bold ? 'It\'s getting stronger! ' : ''}Miss it and lose {blk.hit} energy</p>
        </div>
        {#if subject === 'math'}<NumPad ondigit={digit} onback={backspace} compact={narrow} />{/if}
      </div>
    {/if}
  </div>

  {#if ui === 'won' && out?.met}
    {@const m = out.met}
    <div class="reveal r-{m.rarity}">
      <div class="rays"></div>
      <div class="rtitle"><small>{foeName} is happy again!</small><b>{RARITY[m.rarity].name}</b><em>{RARE_WORDS[m.rarity]}</em></div>
      <div class="rcard"><GlimmerCard id={m.id} width={revealW} level={m.level} shine evolved={!!advView(game.profile!).glimmers[m.id]?.evolved} /></div>
      <div class="rinfo" class:in={step >= 1}>
        {#if m.isNew}
          <h2>{ownName(m.id)} joined you!</h2>
          <p class="pw"><b>In battles it helps you:</b> {GLIMMER[m.id].power.text(1 + (advView(game.profile!).glimmers[m.id]?.evolved ? EVOLVE_BOOST : 0))}</p>
          {#if advView(game.profile!).glimmers[m.id]?.evolved}<p class="pw"><b>Grown-up power:</b> {EVOLVED[m.id].perk}</p>{/if}
          {#if !advView(game.profile!).team.includes(m.id)}<button class="btn teambtn" onclick={() => { game.glimmerSel = m.id; game.go('glimmers'); }}>Put {ownName(m.id)} on your team</button>{/if}
        {:else}
          <h2>You already have {ownName(m.id)}</h2>
          <p class="pw">So yours got stronger{m.ups ? `: now level ${m.level}` : ''}! Find a new kind by playing other battles, or hatch an egg.</p>
        {/if}
        {#each readyNow as id (id)}<div class="evoready"><img src="{base}game/glimmers/face/{id}.webp" alt="" /><b>{ownName(id)} is ready to evolve!</b><button class="btn evobtn" onclick={() => { game.glimmerSel = id; game.go('glimmers'); }}>Evolve it</button></div>{/each}
      </div>
      <div class="rewards" class:in={step >= 2}>
        <button class="prize" onclick={() => show({ kind: 'shells' })}><img src="{base}game/icon-shell.webp" alt="" /><b>+{out.shells}</b><small>shells</small></button>
        <button class="prize" onclick={() => show({ kind: 'friendship' })}><span class="heart"><Icon name="heart" size={40} /></span><b>+{out.xp.gained}</b><small>friendship</small></button>
        {#if out.gear}<button class="prize gearprize" onclick={() => show({ kind: 'gear', id: out!.gear!.id })}><img src="{base}gear/{out.gear.id}.webp" alt="" /><b>Gear!</b><small>{out.gear.name}</small></button>{/if}
        {#if out.egg}<button class="prize egg" onclick={() => show({ kind: 'egg', id: out!.egg!.rarity })}><img src="{base}game/egg-{out.egg.rarity}.webp" alt="" /><b>Egg!</b><small>new</small></button>{/if}
        {#each out.rewards as r}<button class="prize" onclick={() => show({ kind: 'reward', id: r.id })}>{#if r.kind === 'outfit'}<img src="{base}outfits/{r.id}.webp" alt="" />{:else}<span class="heart"><Icon name="dance" dance={r.id} size={42} /></span>{/if}<b>New</b><small>{r.kind === 'outfit' ? 'outfit' : 'dance'}</small></button>{/each}
        {#each out.stickers ?? [] as st (st.id)}<div class="prize" title={st.desc}><img src="{base}game/icon-stickers.webp" alt="" /><b>Sticker</b><small>{st.name}</small></div>{/each}
      </div>
      <p class="tapnote" class:in={step >= 2}>Tap a prize to see what it's for</p>
      {#if out.islandDone}<div class="island-done"><Icon name="sparkle" size={26} /> {island.name} is free of storms!{island.world === 'sky' && island.id !== 'bay' ? ' The next island is open.' : ''}</div>{/if}
      <div class="rbtns" class:in={step >= 2}>
        <button class="btn" onclick={again}>Play again</button>
        <button class="btn btn-primary" onclick={toMap}>Back to the map <span class="kbd">enter</span></button>
      </div>
    </div>
  {:else if ui === 'won'}
    <div class="reveal"><div class="rbtns in"><button class="btn btn-primary" onclick={toMap}>Back to the map</button></div></div>
  {/if}
  {#if ui === 'lost'}
    <div class="lostbox card">
      <Critter friend={p0.buddy} size={narrow ? 84 : 110} mood="sleep" />
      <h2>{FRIEND[p0.buddy].name} needs a rest</h2>
      <p>Try again! When it hits back, answer the quick one fast to put your shield up. You keep everything you've won.</p>
      <div class="rbtns in"><button class="btn" onclick={toMap}>Back to the map</button><button class="btn btn-primary" onclick={again}>Try again</button></div>
    </div>
  {/if}

  <!-- while the arena loads: a painted cover (buddy vs the grumpy Glimmer), never a blank screen -->
  {#if ui === 'loading'}
    <div class="loadcover" out:fade={{ duration: 450 }} style:background-image="url({new URL(`${base}regions/${island.region}.webp`, document.baseURI).href})">
      <div class="lc card">
        <small>{island.name}</small>
        <div class="vs">
          <span class="lp"><Critter friend={p0.buddy} accessory={outfitOf(p0)} size={narrow ? 84 : 128} /><b>{FRIEND[p0.buddy].name}</b></span>
          <i>vs</i>
          <span class="lp foe"><img src="{base}game/glimmers/face/{foe.glimmer}{foe.evolved ? '-evo' : ''}.webp" alt="" /><b>{foeName}</b></span>
        </div>
        <p>Getting the arena ready<span class="dots"><i>.</i><i>.</i><i>.</i></span></p>
      </div>
    </div>
  {/if}

  {#if coach}<Coach text={coach.text} at={coach.at} button={coach.button} onok={() => (coach = null)} />{/if}

  {#if help}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="helpbg" onclick={() => (help = false)}>
      <div class="helpcard card" onclick={(e) => e.stopPropagation()}>
        <h2>How to play</h2>
        <div class="hrows">
          <div class="hr"><div class="mini"><span class="mbar"><img src="{base}game/icon-grump.webp" alt="" /><i><em style:width="35%"></em></i></span></div><p><b>Cheer it up!</b> Get its grumps to 0 and it joins you.</p></div>
          <div class="hr"><div class="mini"><span class="mcard el-sun"><img src="{base}game/icon-sun.webp" alt="" />3 + 4</span></div><p><b>Tap a card</b> and type the answer. Bigger answers cheer more.</p></div>
          <div class="hr"><div class="mini"><span class="mblock"><span class="mring"><img src="{base}icons/shield.webp" alt="" /></span>2 + 2 =</span></div><p><b>Block it!</b> When it hits back, answer the quick one before the ring runs out.</p></div>
          <div class="hr"><div class="mini"><span class="mbar"><img src="{base}game/icon-spark.webp" alt="" /><i><em class="en" style:width="70%"></em></i></span></div><p><b>Your energy:</b> each one you don't block takes some. Don't run out!</p></div>
          <div class="hr"><div class="mini"><span class="mstars">{#each Array(5) as _}<img src="{base}game/icon-star.webp" alt="" />{/each}</span></div><p><b>5 right in a row</b> = your buddy's Finale.</p></div>
          <div class="hr"><div class="mini"><span class="mcard el-tide"><img src="{base}game/icon-tide.webp" alt="" />6 + 2<em><Icon name="bolt" size={11} /> Strong</em></span></div><p><b>Strong cards</b> also calm its next rain.</p></div>
        </div>
        {#if team.length}<div class="hteam">{#each team as m}<span><img src={myArt(m.id)} alt="" /><p><b>{myName(m.id)}:</b> {GLIMMER[m.id].power.text(m.level + (m.evolved ? EVOLVE_BOOST : 0))}{#if m.evolved} {EVOLVED[m.id].perk}{/if}</p></span>{/each}</div>{/if}
        <button class="btn btn-primary" onclick={() => (help = false)}>Got it</button>
      </div>
    </div>
  {/if}

  {#if info}
    {@const i = info}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="helpbg" onclick={() => (info = null)}>
      <div class="infobox card" onclick={(e) => e.stopPropagation()}>
        {#if i.kind === 'glimmer'}
          {@const g = GLIMMER[i.id as keyof typeof GLIMMER]}
          {@const tm = team.find(m => m.id === g.id)}
          <GlimmerCard id={g.id} width={150} level={tm?.level} evolved={!!tm?.evolved} />
          <div><h3>{myName(g.id)}</h3><p><b>In battles it helps you:</b> {g.power.text((tm?.level ?? 1) + (tm?.evolved ? EVOLVE_BOOST : 0))}</p>{#if tm?.evolved}<p><b>Grown-up power:</b> {EVOLVED[g.id].perk}</p>{/if}<p class="muted">{g.quirk}</p></div>
        {:else if i.kind === 'gear' && i.id && ITEM[i.id]}
          {@const it = ITEM[i.id]}
          <img class="ibig" src="{base}gear/{it.id}.webp" alt="" />
          <div><h3>New gear: {it.name}</h3><p>The Champion's prize: yours to keep, and any buddy can wear it. {FRIEND[p0.buddy].name} has it on already ({SLOT_NAME[it.slot].toLowerCase()}).</p><p><b>In battles:</b> {it.text}</p><p class="muted">Change what you wear in the Wardrobe (the Keypals screen).</p></div>
        {:else if i.kind === 'buddy'}
          <Critter friend={p0.buddy} size={130} />
          <div><h3>{FRIEND[p0.buddy].name}: {ROLE[role].name}</h3><p>{ROLE[role].text}</p>{#if gear}<p><b>Outfit power ({gear.name}):</b> {gear.text}</p>{/if}
            {#each SLOTS as sl}{#if worn[sl]}<p class="kitline"><img src="{base}gear/{worn[sl]}.webp" alt="" /><span><b>{ITEM[worn[sl]!].name}:</b> {ITEM[worn[sl]!].text}</span></p>{/if}{/each}</div>
        {:else if i.kind === 'grumpy'}
          <GlimmerCard id={foe.glimmer} width={130} evolved={!!foe.evolved} />
          <div><h3>{foeName} is grumpy</h3><p>Every right answer takes some grumps away. At 0 it's happy again and joins you!</p></div>
        {:else if i.kind === 'energy'}
          <img class="ibig" src="{base}game/icon-spark.webp" alt="" />
          <div><h3>Your energy</h3><p>Rain and zaps you don't block take some away, and each one in a row hits harder. Block one and it calms down. Shields from helpers and gear stop 2 a battle at most. If it runs out, your buddy needs a rest and you can try again.</p></div>
        {:else if i.kind === 'finale'}
          <img class="ibig" src="{base}game/icon-finale.webp" alt="" />
          <div><h3>The Finale</h3><p>Get 5 right in a row to fill the stars. Then tap Finale for {FRIEND[p0.buddy].name}'s big dance. It takes away lots of grumps!</p></div>
        {:else if i.kind === 'shells'}
          <img class="ibig" src="{base}game/icon-shell.webp" alt="" />
          <div><h3>Shells</h3><p>Adventure money! Spend them on eggs and treats in the Island Shop. You get them from battles and from practice.</p></div>
        {:else if i.kind === 'friendship'}
          <Critter friend={p0.buddy} size={120} />
          <div><h3>Friendship with {FRIEND[p0.buddy].name}</h3><p>It grows every time you play. More friendship opens new outfits and dances for {FRIEND[p0.buddy].name}.</p></div>
        {:else if i.kind === 'egg'}
          <img class="ibig" src="{base}game/egg-{i.id}.webp" alt="" />
          <div><h3>A new egg!</h3><p>Every right answer in practice (math, typing or the playground) makes it grow. When its bar is full, it hatches into a new Glimmer.</p></div>
        {:else if i.kind === 'reward'}
          {@const r = out?.rewards.find(x => x.id === i.id)}
          {#if r?.kind === 'outfit'}<img class="ibig" src="{base}outfits/{r.id}.webp" alt="" />{:else}<span class="ibig note"><Icon name="dance" dance={r?.id} size={72} /></span>{/if}
          <div><h3>New {r?.kind === 'outfit' ? 'outfit' : 'dance'}: {r?.name}</h3><p>{r?.kind === 'outfit' ? `Dress ${FRIEND[p0.buddy].name} up on the Keypals screen.${GEAR[r.id] ? ` In battles: ${GEAR[r.id].text}` : ''}` : `Pick it as ${FRIEND[p0.buddy].name}'s finish dance on the Keypals screen. It's the Finale move in battles too.`}</p></div>
        {/if}
        <button class="btn btn-primary" onclick={() => (info = null)}>OK</button>
      </div>
    </div>
  {/if}
  <Confetti {burst} count={80} x={60} y={35} spread={1.6} />
</div>

<style>
  .loadcover { position: absolute; inset: 0; z-index: 40; display: grid; place-items: center; background-size: cover; background-position: center; }
  .loadcover::before { content: ''; position: absolute; inset: 0; backdrop-filter: blur(8px); background: rgba(255, 250, 255, .25); }
  .lc { position: relative; padding: 22px 40px 24px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .lc small { font: 800 12px var(--font-body); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
  .lc p { margin: 0; font: 600 22px var(--font-ui); color: var(--ink2); }
  .vs { display: flex; align-items: center; gap: 22px; }
  .vs > i { font: 600 36px var(--font-ui); font-style: normal; color: var(--primary); }
  .lp { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .lp b { font: 600 17px var(--font-ui); color: #fff; background: #7c5cf5; padding: 2px 12px; border-radius: 999px; white-space: nowrap; }
  .lp.foe b { background: #5d6a86; }
  .lp.foe img { width: 128px; height: 128px; border-radius: 50%; object-fit: cover; box-shadow: 0 0 0 4px #fff, 0 6px 16px -6px rgba(30, 20, 60, .5); filter: saturate(.55) brightness(.92); }
  .narrow .lp.foe img { width: 84px; height: 84px; }
  .dots i { font-style: normal; animation: dot 1.2s infinite; } .dots i:nth-child(2) { animation-delay: .2s; } .dots i:nth-child(3) { animation-delay: .4s; }
  @keyframes dot { 50% { opacity: .2; } }
  .battle { position: fixed; inset: 0; display: flex; flex-direction: column; pointer-events: none; font-family: var(--font-body); }
  .battle > * { pointer-events: auto; }
  .stage { flex: 1; min-height: 0; pointer-events: none; }
  .top { display: flex; align-items: center; gap: 10px; padding: 12px 16px 0; }
  .leave { display: grid; place-items: center; padding: 0; width: 46px; height: 46px; border-radius: 50%; border: 0; background: rgba(255, 255, 255, .92); font: 600 30px/1 var(--font-ui); color: var(--ink2); cursor: pointer; box-shadow: var(--shadow-sm); }
  .where { display: flex; flex-direction: column; background: rgba(255, 255, 255, .9); border-radius: 16px; padding: 4px 14px; box-shadow: var(--shadow-sm); }
  .where small { font: 800 11px var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
  .where b { font: 600 18px var(--font-ui); color: var(--ink); }
  .helpbtn { display: grid; place-items: center; padding: 0; margin-left: auto; width: 46px; height: 46px; border-radius: 50%; border: 0; background: #fff; font: 600 26px/1 var(--font-ui); color: var(--primary); cursor: pointer; box-shadow: 0 0 0 3px #ffd36b, var(--shadow-sm); }

  .bar { font: inherit; text-align: left; border: 0; cursor: pointer; }
  .won .bar { display: none; } .won .bottom, .won .top, .won .teamrow { visibility: hidden; }
  .bar { position: absolute; transform: translate(-50%, -100%); display: flex; align-items: center; gap: 6px; padding: 6px 14px 6px 6px; border-radius: 999px; background: linear-gradient(#ffffff, #eef2ff); box-shadow: 0 0 0 3px rgba(255, 255, 255, .9), 0 10px 24px -10px rgba(30, 20, 70, .55); min-width: 210px; z-index: 5; transition: left .1s linear, top .1s linear; }
  .narrow .bar { transform: none; min-width: 0; width: calc(50% - 18px); transition: none; }
  .bar .bi { width: 40px; height: 40px; flex: none; object-fit: contain; filter: drop-shadow(0 2px 3px rgba(0, 0, 0, .2)); }
  .bt { flex: 1; display: flex; flex-direction: column; gap: 3px; }
  .bt .lab { font: 600 15px var(--font-ui); color: var(--ink); line-height: 1; white-space: nowrap; }
  .bt .num { font: 700 12px var(--font-body); color: var(--muted); line-height: 1; }
  .bt .num b { font: 600 17px var(--font-ui); color: var(--ink); }
  .track { position: relative; height: 12px; border-radius: 999px; background: #e6e2f2; overflow: hidden; box-shadow: inset 0 2px 3px rgba(40, 20, 80, .18); }
  .fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 999px; }
  .spark .fill { background: linear-gradient(90deg, #ff5e3a, #ffb52e, #ffe066); box-shadow: 0 0 10px #ffb52e; }
  /* the energy just lost, a lighter strip that drains a moment later */
  .spark .fill.lag { background: #ff9aa6; box-shadow: none; }
  /* low energy: the bar pulses red */
  .bar.spark.low { animation: lowpulse 1s ease-in-out infinite; }
  .bar.spark.low .fill:not(.lag) { background: linear-gradient(90deg, #e8243c, #ff6b6b); box-shadow: 0 0 10px #ff6b6b; }
  .bar.spark.low .lab { color: #c22b48; }
  @keyframes lowpulse { 50% { box-shadow: 0 0 0 4px #ff5f6d, 0 0 28px #ff5f6d, 0 10px 24px -10px rgba(30, 20, 70, .55); } }
  /* a hit just landed: the bar shakes */
  .bar.spark.hurt { animation: barhit .5s; } .bar.spark.low.hurt { animation: barhit .5s, lowpulse 1s ease-in-out infinite; }
  @keyframes barhit { 15% { translate: -7px 0; background: #ffe3e6; } 35% { translate: 7px 0; } 55% { translate: -5px 0; } 75% { translate: 3px 0; } }
  .grump .fill { background: linear-gradient(90deg, #7a5cf5, #a98cff, #c9b8ff); box-shadow: 0 0 10px #a98cff; }
  .grump.champ { background: linear-gradient(#fff8e0, #ffeec2); box-shadow: 0 0 0 3px #ffd36b, 0 10px 24px -10px rgba(120, 80, 0, .5); }

  .teamrow { position: absolute; left: 16px; top: 70px; display: flex; flex-direction: column; gap: 8px; z-index: 4; }
  .narrow .teamrow { top: 128px; left: 10px; gap: 5px; }
  .teamrow > button { border: 0; font: inherit; text-align: left; }
  .teamrow > button { display: flex; align-items: center; gap: 8px; background: rgba(255, 255, 255, .9); border-radius: 999px; padding: 3px 14px 3px 3px; box-shadow: var(--shadow-sm); font: 700 12px var(--font-body); color: var(--muted); cursor: pointer; }
  .teamrow em { display: flex; flex-direction: column; line-height: 1.15; }
  .teamrow em b { font: 600 14px var(--font-ui); color: var(--ink); }
  .teamrow img { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; object-position: center 35%; background: #eef; }
  .narrow .teamrow img { width: 32px; height: 32px; }
  .teamrow em { font-style: normal; }
  .narrow .teamrow em { display: none; }
  .teamrow .gear img { object-fit: contain; background: #fff; }
  /* the buddy's gear, small, after its name (tap the buddy for what each piece does) */
  .teamrow .kit { display: flex; gap: 1px; margin-left: 2px; }
  .teamrow .kit img { width: 24px; height: 24px; border-radius: 0; object-fit: contain; background: none; }
  .narrow .teamrow .kit { display: none; }
  .kitline { display: flex; align-items: center; gap: 8px; }
  .kitline img { width: 34px; height: 34px; object-fit: contain; flex: none; }
  .prize.gearprize img { width: 52px; height: 52px; }

  .float { position: absolute; transform: translate(-50%, -50%); font: 600 34px var(--font-ui); color: #fff; z-index: 8; pointer-events: none; animation: rise 1.5s cubic-bezier(.2, .8, .3, 1) forwards; -webkit-text-stroke: 1px rgba(40, 20, 80, .25); text-shadow: 0 3px 0 rgba(40, 20, 80, .35), 0 0 18px currentColor; white-space: nowrap; }
  .float.sun { color: #ffbf2e; } .float.tide { color: #3fa2ff; } .float.frost { color: #7fd6ff; } .float.leaf { color: #4fd17a; } .float.stone { color: #d6a46a; }
  .float.extra { font-size: 20px; color: #ffd166; }
  .float.helper { display: flex; align-items: center; gap: 8px; font: 600 18px var(--font-ui); color: var(--ink); -webkit-text-stroke: 0; text-shadow: none; background: #fff; padding: 4px 14px 4px 4px; border-radius: 999px; box-shadow: 0 0 0 3px #ffd36b, 0 10px 24px -10px rgba(40, 20, 80, .6); animation: badge 2.2s cubic-bezier(.2, .8, .3, 1) forwards; }
  .float.helper img { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; object-position: center 35%; }
  @keyframes badge { 0% { opacity: 0; transform: translate(-50%, -30%) scale(.6); } 12% { opacity: 1; transform: translate(-50%, -110%) scale(1.05); } 20% { transform: translate(-50%, -110%) scale(1); } 85% { opacity: 1; transform: translate(-50%, -125%); } 100% { opacity: 0; transform: translate(-50%, -140%); } } .float.heal { font-size: 22px; color: #5be38d; } .float.hurt { color: #ff5f6d; font-size: 32px; } .float.block { color: #7fe0ff; font-size: 26px; }
  .float.finale { font-size: 52px; color: #ff7ab8; }
  .float.blocked { font-size: 50px; color: #fff; -webkit-text-stroke: 3px #2f7fe0; paint-order: stroke; text-shadow: 0 5px 0 #1c4fa8, 0 0 26px #9fe6ff; animation: blockedpop 1.4s cubic-bezier(.2, 1.3, .4, 1) forwards; }
  .narrow .float.blocked { font-size: 36px; }
  @keyframes blockedpop { 0% { opacity: 0; transform: translate(-50%, -50%) scale(.3) rotate(-8deg); } 14% { opacity: 1; transform: translate(-50%, -80%) scale(1.15) rotate(3deg); } 26% { transform: translate(-50%, -80%) scale(1) rotate(0); } 80% { opacity: 1; transform: translate(-50%, -95%); } 100% { opacity: 0; transform: translate(-50%, -120%); } }
  @keyframes rise { 0% { opacity: 0; transform: translate(-50%, -20%) scale(.6); } 15% { opacity: 1; transform: translate(-50%, -60%) scale(1.15); } 30% { transform: translate(-50%, -70%) scale(1); } 100% { opacity: 0; transform: translate(-50%, -190%) scale(.95); } }
  .toast { position: absolute; left: 50%; top: 18%; transform: translateX(-50%); z-index: 9; background: rgba(255, 255, 255, .95); color: var(--ink); font: 600 19px var(--font-ui); padding: 10px 20px; border-radius: 999px; box-shadow: 0 10px 30px -12px rgba(40, 20, 80, .6); animation: drop .35s cubic-bezier(.3, .8, .4, 1.4); white-space: nowrap; max-width: 92vw; overflow: hidden; text-overflow: ellipsis; }
  .toast.super { background: linear-gradient(90deg, #fff4c2, #ffffff); box-shadow: 0 0 0 3px #ffd36b, 0 10px 30px -12px rgba(120, 80, 0, .6); }
  .toast.miss { background: #fff0f2; color: #b02a48; } .toast.good { background: #eafff3; color: #0f6a48; }
  @keyframes drop { from { opacity: 0; transform: translate(-50%, -16px) scale(.9); } }
  .big { position: absolute; left: 50%; top: 24%; transform: translate(-50%, -50%); z-index: 10; text-align: center; pointer-events: none; animation: bigin .6s cubic-bezier(.2, 1.4, .4, 1) both; }
  .big b { display: block; font: 600 clamp(44px, 8vw, 92px)/1 var(--font-ui); color: #fff; -webkit-text-stroke: 3px #6d3fd6; paint-order: stroke; text-shadow: 0 6px 0 #4a23a8, 0 0 40px rgba(255, 255, 255, .9); white-space: nowrap; }
  .big small { display: block; margin-top: 10px; font: 600 clamp(15px, 2vw, 22px) var(--font-ui); color: #fff; text-shadow: 0 2px 8px rgba(30, 10, 60, .7); }
  .big.perfect b { -webkit-text-stroke-color: #e07b00; text-shadow: 0 6px 0 #b35a00, 0 0 50px #ffe066; background: linear-gradient(#fff6b8, #ffb52e); -webkit-background-clip: text; color: transparent; }
  .big.champ b { -webkit-text-stroke-color: #b37a00; text-shadow: 0 6px 0 #7a5200, 0 0 50px #ffd36b; }
  .big.finale b { -webkit-text-stroke-color: #d6338a; text-shadow: 0 6px 0 #9c1d63, 0 0 50px #ff9ad5; }
  @keyframes bigin { 0% { opacity: 0; transform: translate(-50%, -50%) scale(.4) rotate(-6deg); } 100% { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(0); } }

  .bottom { flex: none; padding: 6px 16px 16px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .meter { border: 0; cursor: pointer; font: inherit; line-height: 0; }
  .meter img { display: block; }
  .meter { display: flex; align-items: center; gap: 4px; background: rgba(30, 22, 60, .78); padding: 5px 10px; border-radius: 999px; box-shadow: 0 0 0 3px rgba(255, 255, 255, .5); }
  .meter img { width: 32px; height: 32px; object-fit: contain; filter: grayscale(1) brightness(.55); transition: filter .3s, transform .3s; }
  .meter .ml { font: 600 15px var(--font-ui); color: #fff; margin: 0 6px 0 4px; }
  .meter img.on { filter: none; transform: scale(1.08); }
  .meter.full { animation: pulse 1s ease-in-out infinite; }
  @keyframes pulse { 50% { box-shadow: 0 0 0 3px #fff, 0 0 30px #ff7ab8; } }
  .finalebig { display: flex; align-items: center; gap: 10px; border: 0; border-radius: 999px; padding: 8px 26px 8px 10px; background: linear-gradient(135deg, #ff6fb8, #b46bff); box-shadow: 0 0 0 4px #fff, 0 0 30px #ff7ab8; cursor: pointer; animation: wob .9s ease-in-out infinite; color: #fff; text-align: left; }
  .finalebig img { width: 56px; height: 56px; object-fit: contain; }
  .finalebig b { display: block; font: 600 30px/1 var(--font-ui); }
  .finalebig small { font: 700 13px var(--font-body); opacity: .95; }
  @keyframes wob { 50% { transform: scale(1.07) rotate(-2deg); } }
  .swap { display: inline-flex; align-items: center; gap: 5px; font: 700 14px var(--font-body); border: 0; border-radius: 999px; padding: 8px 14px; background: #fff; color: var(--ink2); cursor: pointer; box-shadow: var(--shadow-sm); }
  .actions { display: flex; align-items: center; gap: 12px; justify-content: center; }

  .cards { display: flex; gap: 16px; justify-content: center; width: min(1100px, 100%); }
  .cards.dim { opacity: .6; }
  .cards .card { position: relative; flex: 1; max-width: 330px; display: flex; align-items: center; gap: 10px; padding: 12px 18px 12px 12px; border-radius: 30px; border: 4px solid #fff; cursor: pointer; box-shadow: 0 12px 24px -12px rgba(30, 20, 70, .6), inset 0 -8px 16px rgba(0, 0, 0, .08), inset 0 6px 10px rgba(255, 255, 255, .7); animation: cardin .5s var(--d) cubic-bezier(.2, 1.3, .4, 1) both, bob 3s calc(var(--d) * 4) ease-in-out infinite; transition: transform .15s; text-align: left; }
  .cards .card:hover:not(:disabled) { transform: translateY(-6px) scale(1.03); }
  .cards .card .ci { width: 70px; height: 70px; flex: none; object-fit: contain; filter: drop-shadow(0 4px 4px rgba(0, 0, 0, .18)); }
  .ct { display: flex; flex-direction: column; min-width: 0; }
  .ct em { display: inline-flex; align-items: center; gap: 3px; align-self: flex-start; margin-top: 4px; font: 800 12px var(--font-body); font-style: normal; background: #fff; color: #d16a00; padding: 3px 9px; border-radius: 999px; }
  .ct em.bl { color: #c2348a; }
  .ct em.ag { color: #1f6fb8; }
  .ct b { font: 600 clamp(28px, 3.4vw, 42px)/1.05 var(--font-ui); color: #2a1f45; white-space: nowrap; }
  .ct b.it { white-space: normal; }
  .ct em.cv { color: #2f8a52; }
  .iq { display: flex; justify-content: center; }
  .cards .el-sun.card { background: linear-gradient(160deg, #fff6c4, #ffd36b); }
  .cards .el-tide.card { background: linear-gradient(160deg, #e2f4ff, #8fd0ff); }
  .cards .el-frost.card { background: linear-gradient(160deg, #f6f0ff, #c8b8ff); }
  .cards .el-leaf.card { background: linear-gradient(160deg, #eaffe6, #9ee8a6); }
  .cards .el-stone.card { background: linear-gradient(160deg, #fbf3e8, #e2c7a2); }
  .cards .card.super { box-shadow: 0 0 0 3px #ffd36b, 0 0 22px #ffd36b, 0 12px 24px -12px rgba(30, 20, 70, .6); }
  .cards .card.bloom::after { content: ''; position: absolute; inset: -4px; border-radius: 30px; box-shadow: 0 0 0 3px #ff9ad5, 0 0 18px #ff9ad5; pointer-events: none; }
  @keyframes cardin { from { opacity: 0; transform: translateY(60px) scale(.8); } }
  @keyframes bob { 50% { translate: 0 -4px; } }
  .hint { margin: 0; min-height: 22px; font: 600 19px var(--font-ui); color: #fff; text-shadow: 0 2px 6px rgba(20, 10, 50, .8); text-align: center; }

  .answer, .blockbox { width: min(1000px, 100%); display: flex; flex-direction: column; align-items: center; gap: 10px; background: rgba(255, 255, 255, .9); border-radius: 28px; padding: 14px 16px; box-shadow: 0 16px 40px -18px rgba(30, 20, 70, .6); animation: cardin .35s cubic-bezier(.2, 1.3, .4, 1) both; }
  .eq { display: flex; align-items: center; gap: 14px; font: 600 clamp(40px, 6vw, 64px)/1 var(--font-ui); color: var(--ink); }
  .eq.blockeq, .word.blockeq { font-size: clamp(54px, 8vw, 92px); }
  .box { min-width: 1.6em; min-height: 1.1em; padding: 4px 14px; border-radius: 18px; background: #fff; box-shadow: inset 0 0 0 4px #a98cff, 0 0 0 6px #efe9ff; text-align: center; }
  .shake { animation: shake .35s; }
  @keyframes shake { 20% { transform: translateX(-10px); } 40% { transform: translateX(10px); } 60% { transform: translateX(-6px); } 80% { transform: translateX(6px); } }
  .ask { margin: 0; font: 600 20px var(--font-ui); color: var(--ink2); text-align: center; }
  .ask b { color: var(--primary); }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
  .chips button { width: 58px; height: 58px; border-radius: 18px; border: 3px solid #ece6f6; background: linear-gradient(#fff, #f1ecfb); box-shadow: 0 5px 0 #d9cff0; font: 600 28px var(--font-ui); color: var(--ink); cursor: pointer; }
  .chips button:active { transform: translateY(4px); box-shadow: 0 1px 0 #d9cff0; }
  .word { display: flex; gap: 4px; font: 600 clamp(44px, 7vw, 72px)/1 var(--font-ui); letter-spacing: .02em; }
  .word.small { font-size: clamp(32px, 5vw, 48px); }
  .word span { color: #b8b0cc; padding: 0 2px; border-bottom: 5px solid transparent; }
  .word span.done { color: var(--ink); }
  .word span.next { color: var(--primary); border-bottom-color: var(--primary); }
  .backbtn { border: 0; background: none; font: 700 14px var(--font-body); color: var(--muted); cursor: pointer; text-decoration: underline; }
  .glowbtn { display: inline-flex; align-items: center; gap: 5px; border: 0; border-radius: 999px; padding: 6px 14px; background: linear-gradient(90deg, #fff4c2, #ffe066); font: 700 14px var(--font-body); color: #7a5200; cursor: pointer; }
  .glow { margin: 0; max-width: 640px; text-align: center; font: 700 16px/1.35 var(--font-body); color: #7a5200; background: #fff8dc; border-radius: 14px; padding: 8px 14px; }
  /* the counterattack: a blue "Block it!" banner with the shield, its ring the time left */
  .blockbox { flex-direction: row; flex-wrap: wrap; justify-content: center; align-items: center; column-gap: 26px; row-gap: 8px; background: linear-gradient(#eef7ff, #ffffff 70%); box-shadow: 0 0 0 4px #7cc4ff, 0 16px 40px -18px rgba(20, 60, 140, .6); }
  .blockbox.bold { box-shadow: 0 0 0 4px #ff9aa8, 0 16px 40px -18px rgba(120, 20, 50, .6); }
  .bhead { display: flex; align-items: center; gap: 12px; }
  .shieldring { --rc: #3f9cff; width: 96px; height: 96px; flex: none; border-radius: 50%; display: grid; place-items: center; background: conic-gradient(var(--rc) calc(var(--k) * 360deg), #dfe8f4 0); box-shadow: 0 6px 14px -6px rgba(20, 60, 140, .5); animation: shieldin .45s cubic-bezier(.2, 1.5, .4, 1) both; }
  .shieldring.hurry { --rc: #ff5f6d; }
  .shieldring img { width: 78px; height: 78px; padding: 4px; border-radius: 50%; background: #fff; object-fit: contain; }
  @keyframes shieldin { from { transform: scale(.3) rotate(-25deg); opacity: 0; } }
  .btxt { display: flex; flex-direction: column; line-height: 1.05; }
  .btxt small { font: 800 13px var(--font-body); letter-spacing: .04em; text-transform: uppercase; color: #5b6b8a; }
  .btxt b { font: 600 clamp(34px, 4.4vw, 46px)/1 var(--font-ui); color: #1f5fc8; }
  .btxt span { font: 600 18px/1.2 var(--font-ui); color: #2a3a5c; }
  .bq { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .stake { display: flex; align-items: center; gap: 4px; margin: 0; font: 700 15px var(--font-body); color: #8a1f38; background: #fff0f2; border-radius: 999px; padding: 3px 12px 3px 4px; }
  .stake img { width: 22px; height: 22px; object-fit: contain; }
  .blockbox :global(.pad) { flex-basis: 100%; }

  .reveal { position: absolute; inset: 0; z-index: 20; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 20px; background: radial-gradient(circle at 50% 42%, rgba(255, 255, 255, .25), rgba(30, 20, 60, .55) 70%); }
  .rays { position: absolute; left: 50%; top: 40%; width: 1400px; height: 1400px; margin: -700px 0 0 -700px; background: repeating-conic-gradient(from 0deg, rgba(255, 255, 255, .22) 0 8deg, transparent 8deg 22deg); animation: spin 18s linear infinite; mask: radial-gradient(circle, #000 20%, transparent 60%); -webkit-mask: radial-gradient(circle, #000 20%, transparent 60%); pointer-events: none; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .rtitle { position: relative; text-align: center; animation: titlein .7s cubic-bezier(.2, 1.4, .4, 1) both; }
  @keyframes titlein { 0% { opacity: 0; transform: scale(.4) rotate(-6deg); } 100% { opacity: 1; transform: none; } }
  .rtitle small { display: block; font: 600 22px var(--font-ui); color: #fff; text-shadow: 0 2px 8px rgba(0, 0, 0, .5); }
  .rtitle em { display: inline-block; margin-top: 6px; font: 700 15px var(--font-body); font-style: normal; color: var(--ink); background: #fff; padding: 3px 12px; border-radius: 999px; }
  .rtitle b { display: block; font: 600 clamp(44px, min(9vw, 9vh), 96px)/1 var(--font-ui); color: var(--rc, #fff); -webkit-text-stroke: 3px #fff; paint-order: stroke; text-shadow: 0 6px 0 rgba(0, 0, 0, .25), 0 0 50px var(--rc, #fff); }
  .r-common { --rc: #7d8494; } .r-uncommon { --rc: #3fbf73; } .r-rare { --rc: #2f8ef0; } .r-epic { --rc: #a061f0; } .r-legendary { --rc: #f0b21f; }
  .r-mythic { --rc: #ff5fb0; } .r-mythic .rtitle b { background: linear-gradient(90deg, #ff6fa8, #ffb44d, #ffe066, #6fe3a0, #5bb6ff, #a98cff); -webkit-background-clip: text; color: transparent; }
  .rcard { position: relative; animation: flipin .9s .3s cubic-bezier(.2, 1.2, .4, 1) both; }
  @keyframes flipin { 0% { opacity: 0; transform: perspective(800px) rotateY(180deg) scale(.4); } 100% { opacity: 1; transform: perspective(800px) rotateY(0) scale(1); } }
  .rinfo, .rewards, .rbtns { position: relative; opacity: 0; transform: translateY(14px); transition: opacity .4s, transform .4s; text-align: center; }
  .rinfo.in, .rewards.in, .rbtns.in { opacity: 1; transform: none; }
  .rinfo { background: rgba(255, 255, 255, .94); border-radius: 22px; padding: 10px 20px; max-width: 560px; }
  .rinfo h2 { margin: 0; font-size: 26px; }
  .evoready { display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 8px; padding: 6px 8px 6px 6px; border-radius: 999px; background: linear-gradient(#fff6d6, #ffe7a3); box-shadow: 0 0 0 2px #ffd36b; }
  .evoready img { width: 38px; height: 38px; border-radius: 50%; object-fit: cover; object-position: center 35%; }
  .evoready b { font: 600 17px var(--font-ui); color: #6a4300; }
  .evobtn { padding: 6px 14px; font-size: 15px; background: linear-gradient(#ffe68a, #ffc93d); color: #5a3900; }
  .pw { margin: 4px 0 0; font: 600 16px/1.35 var(--font-body); color: var(--ink2); }
  .qk { margin: 4px 0 0; font: 600 14px var(--font-body); color: var(--muted); font-style: italic; }
  .rewards { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; max-width: 720px; }
  .prize { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 96px; height: 104px; gap: 2px; border: 0; border-radius: 22px; background: #fff; cursor: pointer; box-shadow: 0 0 0 3px #ffe9a8, var(--shadow-sm); transition: transform .15s; }
  .prize:hover { transform: translateY(-3px); }
  .prize img { width: 46px; height: 46px; object-fit: contain; }
  .prize .heart { display: grid; place-items: center; height: 46px; }
  .prize b { font: 600 22px/1 var(--font-ui); color: var(--ink); }
  .prize small { font: 700 12px var(--font-body); color: var(--muted); max-width: 84px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .prize.egg img { animation: eggbounce 1s ease-in-out infinite; }
  .tapnote { position: relative; margin: 0; font: 700 14px var(--font-body); color: #fff; text-shadow: 0 1px 4px rgba(0, 0, 0, .6); opacity: 0; transition: opacity .4s; }
  .tapnote.in { opacity: 1; }
  .teambtn { margin-top: 8px; }
  .infobox { width: min(520px, 92vw); padding: 18px 20px; display: grid; grid-template-columns: auto 1fr; gap: 16px; align-items: center; }
  .infobox h3 { margin: 0 0 4px; font-size: 22px; }
  .infobox p { margin: 0 0 6px; font: 600 16px/1.4 var(--font-body); color: var(--ink2); }
  .infobox > .btn { grid-column: 1 / -1; justify-self: end; }
  .ibig { width: 96px; height: 96px; object-fit: contain; }
  .ibig.note { display: grid; place-items: center; background: #f1eaff; border-radius: 50%; }
  /* picture tiles: the little picture on top, a short caption under it */
  .hrows { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .hr { display: flex; flex-direction: column; gap: 8px; align-items: center; text-align: center; background: #faf8fe; border-radius: 16px; padding: 12px 10px; }
  .hr p { margin: 0; font: 600 15px/1.35 var(--font-body); color: var(--ink2); }
  .hr p b { display: block; color: var(--ink); font-size: 16px; }
  .mini { flex: none; width: 100%; height: 64px; display: grid; place-items: center; }
  .mbar { display: flex; align-items: center; gap: 4px; background: #fff; border-radius: 999px; padding: 3px 8px 3px 3px; box-shadow: var(--shadow-sm); }
  .mbar img { width: 26px; height: 26px; object-fit: contain; }
  .mbar i { display: block; width: 90px; height: 9px; border-radius: 999px; background: #e6e2f2; overflow: hidden; }
  .mbar em { display: block; height: 100%; background: linear-gradient(90deg, #7a5cf5, #c9b8ff); }
  .mbar em.en { background: linear-gradient(90deg, #ff5e3a, #ffe066); }
  .mcard { position: relative; display: flex; align-items: center; gap: 6px; font: 600 24px var(--font-ui); color: #2a1f45; padding: 6px 12px 6px 6px; border-radius: 16px; border: 3px solid #fff; box-shadow: var(--shadow-sm); }
  .mcard img { width: 34px; height: 34px; object-fit: contain; }
  .mcard em { display: inline-flex; align-items: center; gap: 2px; position: absolute; right: -6px; top: -10px; font: 800 9px var(--font-body); font-style: normal; background: #fff; color: #d16a00; padding: 2px 5px; border-radius: 999px; box-shadow: var(--shadow-sm); }
  .mcard.el-sun { background: linear-gradient(160deg, #fff6c4, #ffd36b); } .mcard.el-tide { background: linear-gradient(160deg, #e2f4ff, #8fd0ff); }
  .mblock { display: flex; align-items: center; gap: 6px; font: 600 22px var(--font-ui); background: #eef7ff; border-radius: 14px; padding: 4px 10px 4px 4px; box-shadow: 0 0 0 2px #7cc4ff; }
  .mring { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: #fff; box-shadow: 0 0 0 3px #3f9cff; }
  .mring img { width: 26px; height: 26px; object-fit: contain; }
  .mstars { display: flex; gap: 1px; background: rgba(30, 22, 60, .78); padding: 4px 6px; border-radius: 999px; }
  .mstars img { width: 22px; height: 22px; object-fit: contain; }
  .hteam { display: flex; flex-direction: column; gap: 6px; }
  .hteam span { display: flex; align-items: center; gap: 10px; }
  .hteam p { margin: 0; font: 600 15px/1.35 var(--font-body); color: var(--ink2); }
  .hteam img { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; object-position: center 35%; flex: none; }
  .rw { display: flex; align-items: center; gap: 6px; background: #fff; border-radius: 999px; padding: 4px 14px 4px 4px; font: 700 15px var(--font-body); color: var(--ink); box-shadow: var(--shadow-sm); }
  .rw img { width: 34px; height: 34px; object-fit: contain; }
  .helpbg { position: absolute; inset: 0; z-index: 30; background: rgba(40, 28, 70, .4); display: grid; place-items: center; }
  .helpcard { width: min(680px, 94vw); max-height: 88vh; overflow: auto; padding: 18px 24px; display: flex; flex-direction: column; gap: 8px; }
  .helpcard h2 { margin: 0; } .helpcard h3 { margin: 6px 0 0; font-size: 20px; }
  .helpcard ul { margin: 0; padding-left: 4px; list-style: none; display: flex; flex-direction: column; gap: 6px; }
  .helpcard li { font: 600 15px/1.4 var(--font-body); color: var(--ink2); }
  .helpcard .btn { align-self: flex-end; }
  .small { font-size: 13px !important; }
  .rw.egg img { animation: eggbounce 1s ease-in-out infinite; }
  @keyframes eggbounce { 50% { transform: translateY(-4px) rotate(6deg); } }
  .island-done { display: flex; align-items: center; gap: 8px; position: relative; font: 600 22px var(--font-ui); color: #fff; background: linear-gradient(90deg, #ff7ab8, #ffb44d, #4fd17a, #3fa2ff); padding: 8px 20px; border-radius: 999px; box-shadow: 0 0 0 3px #fff; }
  .rbtns { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
  .lostbox { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 20; padding: 22px 26px; text-align: center; max-width: 92vw; width: 460px; }
  .lostbox { display: flex; flex-direction: column; align-items: center; }
  .lostbox h2 { margin: 4px 0 6px; } .lostbox p { margin: 0 0 14px; font-weight: 600; color: var(--ink2); }

  .narrow .top { padding: 8px 10px 0; }
  .narrow .where b { font-size: 15px; }
  .narrow .weak span { display: none; }
  .narrow .bar { padding: 4px 8px 4px 4px; }
  .narrow .bar .bi { width: 30px; height: 30px; }
  .narrow .bt span { font-size: 13px; } .narrow .bt span b { font-size: 16px; }
  .narrow .bottom { padding: 4px 8px 10px; }
  .narrow .cards { gap: 6px; }
  .narrow .cards .card { flex-direction: column; gap: 2px; padding: 8px 4px; border-radius: 22px; text-align: center; }
  .narrow .cards .card .ci { width: 44px; height: 44px; }
  .narrow .ct em { align-self: center; font-size: 10px; padding: 2px 6px; }
  .narrow .teamrow em { display: none; }
  .narrow .bt .lab { font-size: 12px; } .narrow .bt .num { font-size: 10px; } .narrow .bt .num b { font-size: 14px; }
  .narrow .finalebig b { font-size: 22px; } .narrow .finalebig img { width: 40px; height: 40px; }
  .narrow .hint { font-size: 14px; }
  .narrow .hrows { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .narrow .hr { padding: 10px 6px; }
  .narrow .hr p { font-size: 13px; } .narrow .hr p b { font-size: 14px; }
  .narrow .mini { zoom: .8; }
  .narrow .prize { width: 76px; height: 88px; } .narrow .prize img { width: 36px; height: 36px; }
  .narrow .infobox { grid-template-columns: 1fr; justify-items: center; text-align: center; }
  .narrow .ct b { font-size: 24px; }
  .narrow .meter img { width: 26px; height: 26px; }
  .narrow .finale { font-size: 16px; }
  .narrow .answer, .narrow .blockbox { padding: 10px; border-radius: 22px; }
  .narrow .shieldring { width: 70px; height: 70px; } .narrow .shieldring img { width: 56px; height: 56px; }
  .narrow .btxt span { font-size: 14px; } .narrow .btxt b { font-size: 30px; }
  .narrow .blockbox { column-gap: 12px; }
  .narrow .stake { font-size: 13px; }
  .narrow .chips button { width: 46px; height: 46px; font-size: 22px; }
  .narrow .hint { font-size: 12px; }
</style>
