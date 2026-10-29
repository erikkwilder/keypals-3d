<script lang="ts">
  // A Family Duel or a Rival Ghosts game, on the arena. Two players (or a player and a ghost) take turns
  // to cheer up one grumpy Glimmer. Each has their own cheer bar along the top (the same size for both:
  // every right answer fills +10 whatever the question), their own Finale stars and their own Glimmers.
  // The cards lie face down until you pick one, so nobody hunts for the easy one. Three right in a row
  // sends a little rain cloud across; the other side blocks it with a quick one at the start of their
  // turn. The first to fill their bar wins the Glimmer (the other gets a last turn to tie). Everything at
  // the top can be tapped to see what it is.
  import { onDestroy, onMount } from 'svelte';
  import { Tween } from 'svelte/motion';
  import { fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { game } from '../state/game.svelte';
  import { stage } from '../three/stage';
  import { DuelScene, type Spot } from '../three/duelScene';
  import { sfx } from '../audio/sound';
  import { FRIEND } from '../art/cast';
  import { answerOf, opSign, type Fact } from '../math/facts';
  import { ELEMENT, GLIMMER, ROLE, glimmerName, rarityRank, type GlimmerId } from '../adventure/glimmers';
  import { FINALE_AT, type Card } from '../adventure/battle';
  import { newDuel, duelPlay, duelFinale, duelRain, ghostMove, ghostRain, cur, progress, DUEL_CARD, type DEvent, type Duel, type SideSetup } from '../adventure/duel';
  import { applyVersus, tellGhostOwner, type VersusOutcome } from '../adventure/versus';
  import { LEAGUES, type Rival } from '../adventure/ghosts';
  import { startPerks } from '../adventure/gear';
  import { advView, markSeen } from '../adventure/state';
  import Coach from '../ui/Coach.svelte';
  import NumPad from '../math/ui/NumPad.svelte';
  import Critter from '../ui/Critter.svelte';
  import GlimmerCard from '../ui/GlimmerCard.svelte';

  type Props = { sides: [SideSetup, SideSetup]; glimmer: GlimmerId; mode: 'duel' | 'rival'; rival?: Rival | null; first?: 0 | 1; onagain: () => void; onexit: () => void };
  let { sides, glimmer, mode, rival = null, first = 0, onagain, onexit }: Props = $props();

  const base = import.meta.env.BASE_URL;
  // (an absolute address: a relative url() in an inline style breaks on the built site)
  const coverArt = new URL(`${base}game/intro-${mode === 'rival' ? 'rivals' : 'duel'}.webp`, document.baseURI).href;
  const seed = (Date.now() % 1e9) | 0;
  // svelte-ignore state_referenced_locally
  const d: Duel = newDuel(sides[0], sides[1], glimmer, seed, first);
  const g = GLIMMER[glimmer];
  const gName = g.name;
  const t0 = performance.now();
  const SIDE = ['#3d9cf0', '#f0675a'];

  let scene: DuelScene | null = null;
  let disposed = false;
  let ui = $state<'loading' | 'intro' | 'pick' | 'answer' | 'busy' | 'rain' | 'finale' | 'ghost' | 'won'>('loading');
  let turn = $state<0 | 1>(0);
  let cards = $state<Card[]>([]);
  let finales = $state([0, 0]);
  const bars = [new Tween(0, { duration: 600, easing: cubicOut }), new Tween(0, { duration: 600, easing: cubicOut })];
  let ghosting = $state(false);

  // answering
  let sel = $state<Card | null>(null);
  let typed = $state('');
  let wordPos = $state(0); let wordErr = $state(0); let shakeKey = $state(0);
  let shownAt = 0;
  // a rain cloud's quick one
  let rain = $state<{ fact?: Fact; word?: string; limitMs: number; from: string } | null>(null);
  let rainAt = 0; let rainLeft = $state(1); let rainTimer = 0; let rainTyped = $state('');

  type Float = { id: number; x: number; y: number; text: string; kind: string; img?: string; color?: string };
  let floats = $state<Float[]>([]); let fid = 0;
  let toast = $state<{ text: string; kind: string; key: number } | null>(null);
  let bigBanner = $state<{ text: string; sub?: string; kind: string; key: number; color?: string } | null>(null);
  let narrow = $state(innerWidth < 760);
  let vh = $state(innerHeight);
  let stageEl: HTMLDivElement | undefined = $state();

  // first-time tips, kept on the player who's holding the device
  const me = game.profile!;
  const seen = new Set(advView(me).seen ?? []);
  let coach = $state<{ text: string; at: string | null; button?: string; id: string } | null>(null);
  let help = $state(false);
  function tip(id: string, text: string, at: string | null, button = 'Got it') { if (seen.has(id) || coach) return; seen.add(id); coach = { id, text, at, button }; }
  function closeTip(id?: string) { if (!id || coach?.id === id) coach = null; }

  // the end
  let outcomes = $state<(VersusOutcome | null)[]>([null, null]);
  let winner = $state<0 | 1 | null>(null);
  let tie = $state(false);
  let step = $state(0);

  const nameOf = (i: number) => d.sides[i].name;
  const fact = (c: Card | null) => c?.fact ?? null;
  const ansLen = $derived.by(() => { const f = fact(sel); return f ? String(answerOf(f)).length : 0; });
  const factText = (f: Fact) => `${f.a} ${opSign(f)} ${f.b}`;
  const curSide = $derived(d.sides[turn]);
  const subject = $derived(curSide.subject);
  const revealW = $derived(Math.round(Math.max(120, Math.min(narrow ? 140 : 190, (vh - (narrow ? 600 : 640)) * 0.62))));
  const levelText = (s: SideSetup) => {
    if (s.pool.subject === 'typing') { const avg = s.pool.words.reduce((a, w) => a + w.length, 0) / Math.max(1, s.pool.words.length); return avg <= 4 ? 'short words' : avg <= 6 ? 'medium words' : 'long words'; }
    const ops = new Set(s.pool.facts.map(x => x.f.op ?? 'x')), big = Math.max(...s.pool.facts.map(x => answerOf(x.f)));
    return ops.has('x') ? (big > 100 ? 'big times tables' : 'times tables') : ops.has('-') ? 'adding and taking away' : big > 10 ? 'adding up to 20' : 'adding small numbers';
  };

  /** Bars and stars follow the game; whose turn it is (and their cards) changes only when the turn
   *  passes on screen, after the last answer's moves have played out. */
  function sync() {
    finales = d.sides.map(s => s.b.finale);
    d.sides.forEach((s, i) => (bars[i].target = progress(s) * 100));
    scene?.setMood(1 - Math.max(progress(d.sides[0]), progress(d.sides[1])) * 0.85);
  }
  function viewOf() {
    const r = stageEl?.getBoundingClientRect();
    return r ? { top: r.top / innerHeight, bottom: r.bottom / innerHeight, left: r.left / innerWidth, right: r.right / innerWidth } : { top: 0.15, bottom: 0.62, left: 0, right: 1 };
  }
  function onResize() { narrow = innerWidth < 760; if (scene) scene.view = viewOf(); }
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  onMount(async () => {
    addEventListener('resize', onResize);
    try {
      const sc = await DuelScene.create({ region: 'treetops', glimmer, view: viewOf(), sides: d.sides.map(s => ({ buddy: s.buddy, outfit: s.outfit, dance: s.dance, team: s.team.map(t => ({ id: t.id, evolved: t.evolved })), ghost: s.kind === 'ghost', worn: s.worn })) as never });
      if (disposed) { sc.dispose(); return; }
      scene = sc; stage.use(sc);
      requestAnimationFrame(onResize);
      // let the arena draw a couple of frames under the cover, so it never flashes up half-built
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    } catch (e) { console.error(e); }
    if (disposed) return;
    ui = 'intro';
    sfx.battleStart();
    bigBanner = { text: `${gName} is grumpy!`, sub: mode === 'duel' ? 'Take turns. Fill your bar first to win it!' : `Race ${d.sides[1].name}${d.sides[1].kind === 'ghost' ? "'s ghost" : ''}: fill your bar first!`, kind: 'intro', key: Date.now() };
    setTimeout(() => {
      bigBanner = null; sync(); scene?.setTurn(0);
      // gear that does something from the start (energy doesn't count in a duel, so Spring Shoes stay quiet)
      d.sides.forEach((s, i) => startPerks(s.kit ?? []).filter(g => g.item !== 'spring_shoes').forEach((g, k) => setTimeout(() => { if (!disposed) { sfx.helper(); helped(i as 0 | 1, undefined, g.what, g.did, `${base}gear/${g.item}.webp`); } }, 300 + i * 900 + k * 700)));
      if (mode === 'rival') tip('r-ghost', `This is ${d.sides[1].name}'s ghost. It plays the way they really play: just as careful and just as quick!`, '.pl.p1');
      else tip('d-turns', `Take turns! Pick a card and it flips over. Every right answer fills +${DUEL_CARD}, little sums or big times tables, so it's fair for everyone.`, '.hud');
      beginTurn(true);
    }, 2300);
    if (first === 1) setTimeout(() => { if (!disposed) say(`${d.sides[1].name} goes first this time`, 'good'); }, 2500);
  });
  onDestroy(() => { disposed = true; clearInterval(rainTimer); removeEventListener('resize', onResize); if (scene && stage.current() === scene) stage.use(null); });

  function float(at: Spot, text: string, kind: string, img?: string, color?: string) {
    const pos = scene?.screenOf(at, 0.2) ?? { x: at.startsWith('p1') ? 0.75 : at === 'glimmer' ? 0.5 : 0.25, y: 0.35 };
    const edge = Math.min(0.4, 105 / Math.max(1, innerWidth));
    const x = kind === 'helper' ? Math.min(1 - edge, Math.max(edge, pos.x)) : pos.x + (Math.random() - 0.5) * 0.03;
    const f = { id: fid++, x, y: kind === 'helper' ? Math.max(0.22, pos.y) : pos.y, text, kind, img, color };
    floats = [...floats, f];
    setTimeout(() => (floats = floats.filter(x => x.id !== f.id)), kind === 'helper' ? 2200 : 1500);
  }
  /** a team Glimmer's picture and name: its grown-up look once it has evolved */
  const evo = (side: number, id: string) => !!d.sides[side].team.find(m => m.id === id)?.evolved;
  const artOf = (side: number, id: GlimmerId) => `${base}game/glimmers/face/${id}${evo(side, id) ? '-evo' : ''}.webp`;
  function helped(side: 0 | 1, id: string | undefined, what: string, did: string, pic?: string) {
    const slot = id ? d.sides[side].team.findIndex(m => m.id === id) : -1;
    const at = (slot === 0 ? `p${side}t0` : slot === 1 ? `p${side}t1` : `p${side}`) as Spot;
    const img = pic ?? (id ? artOf(side, id as GlimmerId) : `${base}portraits/${d.sides[side].buddy}-head.png`);
    float(at, `${what}: ${did}`, 'helper', img);
  }
  function say(text: string, kind = 'info') { toast = { text, kind, key: Date.now() }; setTimeout(() => { if (toast?.text === text) toast = null; }, 2200); }

  // tap anything at the top to see what it is
  type Info = { kind: 'player'; side: 0 | 1 } | { kind: 'glimmer' | 'finale' | 'rain' | 'shells' | 'friendship' | 'points' } | { kind: 'mate'; id: GlimmerId; side: 0 | 1 };
  let info = $state<Info | null>(null);
  function show(i: Info) { info = i; sfx.pop(); }

  // ---------- turns ----------
  function beginTurn(first = false) {
    if (disposed || d.phase === 'won') return;
    sync();
    turn = d.turn; cards = cur(d).b.cards.slice();
    if (d.phase === 'rain') { startRain(); return; }
    if (d.phase === 'finale') { startFinale(); return; }
    if (cur(d).kind === 'ghost') { void ghostTurn(); return; }
    ui = 'pick';
    if (!first && d.turns === 1 && mode === 'duel') tip('d-bar', `Every right answer fills your bar. Fill it first to win ${gName}!`, '.pl.p0');
  }
  function pick(c: Card) {
    if (ui !== 'pick') return;
    closeTip('d-turns'); closeTip('r-ghost');
    sel = c; typed = ''; wordPos = 0; wordErr = 0;
    ui = 'answer'; sfx.click();
    shownAt = performance.now();
  }
  // (no going back once a card is turned over: that would be peeking)
  function digit(dg: string) {
    if (ghosting) return;
    if (ui === 'rain') { rainTyped += dg; if (rain?.fact && rainTyped.length >= String(answerOf(rain.fact)).length) submitRain(); return; }
    if (ui !== 'answer' || !sel || subject !== 'math') return;
    typed += dg; sfx.click();
    if (typed.length >= ansLen) submit();
  }
  function backspace() { if (ghosting) return; if (ui === 'rain') rainTyped = rainTyped.slice(0, -1); else typed = typed.slice(0, -1); }

  async function submit() {
    const c = sel; if (!c) return;
    const f = fact(c);
    const think = performance.now() - shownAt;
    ui = 'busy';
    const side = d.turn;
    const ev = subject === 'math'
      ? duelPlay(d, c.id, { ok: !!f && Number(typed) === answerOf(f), value: Number(typed), thinkMs: think, fact: f ?? undefined })
      : duelPlay(d, c.id, { ok: true, value: Math.max(1, (c.word?.length ?? 1) - wordErr), thinkMs: think });
    if (ev.length === 1 && ev[0].k === 'retry') { sfx.miss(); say('Second Chance: have another go!', 'good'); typed = ''; wordPos = 0; wordErr = 0; ui = 'answer'; shakeKey++; return; }
    sel = null; typed = '';
    await run(ev, side);
  }
  /** A ghost's turn: it thinks (at its player's pace, shortened), picks a card and answers it. */
  async function ghostTurn() {
    const mv = ghostMove(d);
    if (!mv) return;
    ghosting = true; ui = 'ghost';
    await sleep(Math.min(2200, Math.max(900, mv.thinkMs * 0.35)));
    if (disposed) return;
    sel = cards.find(c => c.id === mv.cardId) ?? null; typed = ''; wordPos = 0; wordErr = 0;
    ui = 'answer';
    for (const ch of mv.typed) { await sleep(sel?.word ? 160 : 300); if (disposed) return; typed += ch; if (sel?.word) wordPos++; sfx.click(); }
    await sleep(420);
    ui = 'busy'; ghosting = false;
    const side = d.turn;
    const ev = duelPlay(d, mv.cardId, mv.answer);
    sel = null; typed = '';
    await run(ev, side);
  }

  // typing cards and typing blocks
  function onKey(e: KeyboardEvent) {
    if (ui === 'won') { if (e.key === 'Enter') { e.preventDefault(); onexit(); } return; }
    if (ghosting || help || info) return;
    if (ui === 'finale' && (e.key === 'f' || e.key === 'F' || e.key === 'Enter')) { e.preventDefault(); doFinale(); return; }
    if (ui === 'pick') { pickKey(e); return; }
    if (subject === 'math') {
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); digit(e.key); }
      else if (e.key === 'Backspace') { e.preventDefault(); backspace(); }
      return;
    }
    if (e.key.length !== 1) return;
    if (ui === 'answer' || ui === 'rain') { e.preventDefault(); typeChar(e.key); }
  }
  /** 1, 2, 3 (or 4) turns over that card */
  function pickKey(e: KeyboardEvent) {
    const n = Number(e.key);
    if (n >= 1 && n <= cards.length) { e.preventDefault(); pick(cards[n - 1]); }
  }
  function typeChar(ch: string) {
    const word = ui === 'rain' ? rain?.word : sel?.word;
    if (!word) return;
    if (ch === word[wordPos]) { wordPos++; sfx.click(); if (wordPos >= word.length) { if (ui === 'rain') submitRain(); else submit(); } }
    else { wordErr++; shakeKey++; sfx.slip(); }
  }

  // ---------- the Finale ----------
  function startFinale() {
    if (cur(d).kind === 'ghost') { ui = 'busy'; setTimeout(doFinale, 800); return; }
    ui = 'finale';
    tip('d-finale', `Five right in a row! Tap Finale for ${FRIEND[curSide.buddy].name}'s big move.`, '.finalebig');
  }
  async function doFinale() {
    if (d.phase !== 'finale') return;
    closeTip('d-finale');
    ui = 'busy'; sfx.finale();
    bigBanner = { text: 'Finale!', sub: `${curSide.name}: ${FRIEND[curSide.buddy].name} takes the stage`, kind: 'finale', key: Date.now() };
    setTimeout(() => (bigBanner = null), 1600);
    const side = d.turn;
    const ev = duelFinale(d);
    await scene?.finale(side);
    await run(ev, side);
  }

  // ---------- rain clouds ----------
  function startRain() {
    const r = d.rain!;
    const from = nameOf(1 - d.turn);
    rain = { fact: r.fact, word: r.word, limitMs: r.limitMs, from };
    rainTyped = ''; wordPos = 0; wordErr = 0;
    ui = 'rain'; rainAt = performance.now(); rainLeft = 1;
    sfx.rainComing();
    clearInterval(rainTimer);
    if (cur(d).kind === 'ghost') {
      const gr = ghostRain(d);
      const wait = Math.min(gr.ms, r.limitMs + 200, 2600);
      ghosting = true;
      rainTimer = window.setInterval(() => { rainLeft = Math.max(0, 1 - (performance.now() - rainAt) / r.limitMs); }, 50);
      setTimeout(() => { if (r.fact) rainTyped = gr.ok ? String(answerOf(r.fact)) : String(answerOf(r.fact) + 1); else wordPos = gr.ok ? r.word!.length : 1; setTimeout(() => { ghosting = false; void submitRain(false, gr.ok && gr.ms <= r.limitMs); }, 350); }, wait);
      return;
    }
    tip('d-block', `${from} sent a rain cloud! Answer this one before the timer runs out to block it.`, '.blockbox');
    rainTimer = window.setInterval(() => {
      const k = (performance.now() - rainAt) / r.limitMs;
      rainLeft = Math.max(0, 1 - k);
      if (k >= 1) submitRain(true);
    }, 50);
  }
  async function submitRain(timeout = false, ghostOk?: boolean) {
    if (ui !== 'rain' || !rain) return;
    clearInterval(rainTimer);
    const ms = performance.now() - rainAt;
    const r = rain;
    const ok = ghostOk ?? (!timeout && (r.fact ? Number(rainTyped) === answerOf(r.fact) : wordErr === 0));
    if (r.fact && !ok && ghostOk === undefined) say(timeout ? `Too slow! ${factText(r.fact)} = ${answerOf(r.fact)}` : `${factText(r.fact)} = ${answerOf(r.fact)}`, 'miss');
    closeTip('d-block');
    rain = null; ui = 'busy';
    await run(duelRain(d, ok, ghostOk === undefined ? ms : ok ? 0 : 99999));
  }

  // ---------- playing the events ----------
  async function run(ev: DEvent[], who: 0 | 1 = d.turn) {
    let side = who;
    for (const e of ev) {
      if (disposed) return;
      if (e.k === 'cast') {
        if (e.ok) sfx.cast(e.card.element); else if (d.sides[side].kind === 'ghost') sfx.fizzle(); else sfx.miss();
        await scene?.cast(side, e.card.element, { perfect: e.perfect, super: e.super, ok: e.ok, big: e.value / Math.max(1, d.sides[side].b.foe.max) * 2.2 });
        if (e.ok) {
          sfx.hit(Math.min(1, e.value / Math.max(1, d.sides[side].b.foe.max) * 3));
          float('glimmer', `+${e.value}`, 'cheer', undefined, SIDE[side]);
          if (e.perfect) { sfx.perfect(); bigBanner = { text: 'Perfect Cheer!', sub: `${nameOf(side)} landed it exactly!`, kind: 'perfect', key: Date.now() }; }
          else if (e.super) say(`⚡ Strong! ${ELEMENT[e.card.element].name} beats ${ELEMENT[g.element].name}.`, 'super');
        } else { say(e.card.fact ? `Not quite: ${factText(e.card.fact)} = ${answerOf(e.card.fact)}` : 'Not quite!', 'miss'); }
        sync();
      } else if (e.k === 'extra') {
        const slot = e.id ? d.sides[side].team.findIndex(m => m.id === e.id) : -1;
        sfx.helper();
        helped(side, e.id, e.what, `+${e.value} cheer`, e.item ? `${base}gear/${e.item}.webp` : undefined);
        await scene?.extra(side, slot, e.id ? GLIMMER[e.id].element : 'sun');
        float('glimmer', `+${e.value}`, 'extra', undefined, SIDE[side]);
        sync();
      } else if (e.k === 'freeze') {
        scene?.freeze(side, d.sides[side].team.findIndex(m => m.id === e.id)); sfx.freeze();
        helped(side, e.id, 'Frost Owl', 'the next rain cloud is frozen'); await sleep(500);
      } else if (e.k === 'gear') { sfx.helper(); helped(side, undefined, e.what, e.did, `${base}gear/${e.item}.webp`); if (e.item === 'bubble_wand') sfx.shield(true); await sleep(350); }
      else if (e.k === 'dazzle') scene?.dazzle();
      else if (e.k === 'streakKept') say(`${glimmerName(e.id, evo(side, e.id))} kept ${nameOf(side)}'s row going!`, 'good');
      else if (e.k === 'aurora') { scene?.aurora(); sfx.aurora(); say('Aurora! The Finale is ready.', 'super'); await sleep(600); }
      else if (e.k === 'finaleReady') sfx.finaleReady();
      else if (e.k === 'finale') { sfx.hit(1); float('glimmer', `+${e.value}`, 'finale', undefined, SIDE[side]); sync(); }
      else if (e.k === 'sendRain') {
        sfx.rainSend();
        say(`${nameOf(side)} sent a rain cloud to ${nameOf(e.to)}!`, 'super');
        await scene?.sendRain(side, e.to);
        tip('d-rain', 'Three right in a row sends a rain cloud over to the other side!', null);
      } else if (e.k === 'turn') {
        side = e.side; sync(); scene?.setTurn(e.side); sfx.turn(e.side);
        turn = e.side; cards = d.sides[e.side].b.cards.slice();
        bigBanner = { text: d.filled !== null ? `${nameOf(e.side)}: last turn!` : `${nameOf(e.side)}'s turn!`, kind: `turn`, color: SIDE[e.side], key: Date.now() };
        setTimeout(() => { if (bigBanner?.kind === 'turn') bigBanner = null; }, 1100);
        await sleep(mode === 'duel' ? 900 : 650);
      } else if (e.k === 'rainBlocked') {
        if (e.by) { helped(side, e.id, e.by, 'blocked the rain cloud'); }
        sfx.shield(true);
        await scene?.rainResult(side, true, e.by === 'Frost Owl' ? 0xbff0ff : e.by === 'Pebble Shell' ? 0xd6b48a : 0x7fe0ff);
        float(`p${side}` as Spot, 'Blocked!', 'block');
      } else if (e.k === 'rainHit') {
        sfx.rainHit();
        await scene?.rainResult(side, false);
        float(`p${side}` as Spot, `−${e.value} cheer`, 'hurt');
        sync();
      } else if (e.k === 'lastTurn') {
        sfx.lastTurn();
        bigBanner = { text: 'Last turn!', sub: `${nameOf(1 - e.side)} filled their bar. ${nameOf(e.side)} can still tie it!`, kind: 'turn', color: SIDE[e.side], key: Date.now() };
        await sleep(1700);
      } else if (e.k === 'won') { await finish(e.perfect); return; }
    }
    sync();
    beginTurn();
  }

  // ---------- the end ----------
  async function finish(perfect: boolean) {
    ui = 'busy'; sync();
    const w = d.winner!;
    winner = w; tie = d.tie;
    const at = Date.now(), ms = performance.now() - t0;
    // a tie: both cheered it up, so it's a win for both
    const won = (i: number) => w === i || d.tie;
    const runOf = (i: number) => {
      const s = d.sides[i];
      return { mode, won: won(i), perfect: won(i) && s.b.stats.right === s.b.stats.answers, glimmer, rarity: g.rarity, answers: s.b.stats.answers, right: s.b.stats.right, thinkMs: s.thinkMs, big: 0, picks: 0, answered: s.b.answered, ms, at, rival: rival ?? undefined, subject: s.subject };
    };
    const outs: (VersusOutcome | null)[] = [null, null];
    d.sides.forEach((s, i) => {
      if (s.kind !== 'player' || !s.profileId) return;
      if (s.profileId === game.profile?.id) game.update(pp => { outs[i] = applyVersus(pp, runOf(i)); markSeen(pp, ...seen); });
      else { const p = game.save.profiles.find(x => x.id === s.profileId); if (p) { outs[i] = applyVersus(p, runOf(i)); game.persist(); } }
    });
    // a family ghost's player hears how their ghost did
    if (rival?.kind === 'family' && rival.profileId) { const owner = game.save.profiles.find(x => x.id === rival.profileId); if (owner) { tellGhostOwner(owner, me.name, me.buddy, won(1)); game.persist(); } }
    outcomes = outs;
    bigBanner = null; toast = null; coach = null;
    sfx.cheeredUp(0.4); await scene?.win(w, d.tie);
    sfx.reveal(rarityRank(g.rarity));
    ui = 'won'; step = 0;
    setTimeout(() => (step = 1), 1200);
    setTimeout(() => (step = 2), 2300);
  }
  const winSide = $derived(winner === null ? null : d.sides[winner]);
  const winOut = $derived(winner === null ? null : outcomes[winner]);
  const players = $derived(d.sides.map((s, i) => ({ s, i, o: outcomes[i] })).filter(x => x.o));
</script>

<svelte:window onkeydown={onKey} bind:innerHeight={vh} />

<div class="duel" class:narrow class:won={ui === 'won'}>
  <div class="top">
    <button class="leave" onclick={onexit} aria-label="Leave">‹</button>
    <div class="where"><small>{mode === 'duel' ? 'Family Duel' : 'Rival Ghosts'}</small><b>Who cheers up {gName}?</b></div>
    <button class="helpbtn" onclick={() => { help = true; sfx.pop(); }} aria-label="How to play">?</button>
  </div>

  <!-- each side's cheer bar, Finale stars and Glimmers -->
  <div class="hud">
    {#each d.sides as s, i (i)}
      <div class="pl p{i}" class:on={turn === i && ui !== 'won'} class:ghost={s.kind === 'ghost'} style:--sc={SIDE[i]}>
        <button class="face" onclick={() => show({ kind: 'player', side: i as 0 | 1 })} aria-label="About {s.name}"><Critter friend={s.buddy} size={narrow ? 38 : 54} round /></button>
        <div class="pb">
          <button class="nm" onclick={() => show({ kind: 'player', side: i as 0 | 1 })}>{s.name}{#if s.kind === 'ghost'}<em class="gtag">ghost</em>{/if}</button>
          <button class="track" onclick={() => show({ kind: 'player', side: i as 0 | 1 })} aria-label="{s.name}'s cheer"><span class="fill" style:width="{bars[i].current}%"></span></button>
          <div class="row">
            <button class="stars" onclick={() => show({ kind: 'finale' })} aria-label="Finale stars">{#each Array(FINALE_AT) as _, k}<img class:on={k < finales[i]} src="{base}game/icon-star.webp" alt="" />{/each}</button>
            {#each s.team as m (m.id)}<button class="tm" onclick={() => show({ kind: 'mate', id: m.id, side: i as 0 | 1 })} aria-label={glimmerName(m.id, m.evolved)}><img src={artOf(i, m.id)} alt="" /></button>{/each}
          </div>
        </div>
      </div>
    {/each}
  </div>
  {#if ui !== 'won' && ui !== 'loading' && ui !== 'intro'}
    <button class="turnpill" style:--sc={SIDE[turn]} onclick={() => show({ kind: 'glimmer' })}>{turn === 0 ? '◀ ' : ''}{curSide.name}'s turn{turn === 1 ? ' ▶' : ''}</button>
  {/if}

  <div class="stage" bind:this={stageEl}></div>

  {#each floats as f (f.id)}<div class="float {f.kind}" style:left="{f.x * 100}%" style:top="{f.y * 100}%" style:color={f.color}>{#if f.img}<img src={f.img} alt="" />{/if}{f.text}</div>{/each}
  {#if toast}{#key toast.key}<div class="toast {toast.kind}">{toast.text}</div>{/key}{/if}
  {#if bigBanner}{#key bigBanner.key}<div class="big {bigBanner.kind}" style:--sc={bigBanner.color}><b>{bigBanner.text}</b>{#if bigBanner.sub}<small>{bigBanner.sub}</small>{/if}</div>{/key}{/if}

  <div class="bottom" style:--sc={SIDE[turn]}>
    {#if ui === 'finale'}
      <button class="finalebig" onclick={doFinale}><img src="{base}game/icon-finale.webp" alt="" /><span><b>Finale!</b><small>Tap for {FRIEND[curSide.buddy].name}'s big move</small></span></button>
    {:else if ui === 'pick' || ui === 'ghost' || ui === 'intro' || ui === 'loading' || ui === 'busy'}
      <!-- face down until picked: the question shows once you've chosen, so nobody hunts for the easy one -->
      <div class="cards" class:dim={ui !== 'pick'}>
        {#each cards as c, i (c.id)}
          <button class="card down el-{c.element}" class:super={c.super} style:--d="{i * 0.08}s" onclick={() => pick(c)} disabled={ui !== 'pick'} aria-label="{ELEMENT[c.element].name} card{c.super ? ', strong' : ''}">
            {#if !narrow}<span class="key">{i + 1}</span>{/if}
            <img class="ci" src="{base}game/icon-{c.element}.webp" alt="" />
            <span class="ct"><b>?</b><small>{ELEMENT[c.element].name}</small>{#if c.super}<em>⚡ Strong</em>{/if}</span>
          </button>
        {/each}
      </div>
      {#if ui === 'ghost' || ui === 'pick'}
        <p class="hint" style:--sc={SIDE[turn]}><span class="nmchip">{curSide.name}{ui === 'ghost' ? "'s ghost" : ''}</span>{#if ui === 'ghost'}<span class="think">is thinking<i>.</i><i>.</i><i>.</i></span>{:else}<span>Pick a card and it flips over!</span>{/if}</p>
      {/if}
    {:else if ui === 'answer' && sel}
      <div class="answer el-{sel.element}" class:ghostly={ghosting}>
        <p class="who"><span class="nmchip">{curSide.name}{ghosting ? "'s ghost" : ''}</span>{ghosting ? 'is answering' : 'your question:'}</p>
        {#if sel.fact}
          {#key shakeKey}<div class="eq" class:shake={shakeKey > 0}><span>{factText(sel.fact)} =</span><span class="box">{typed || ' '}</span></div>{/key}
          {#if !ghosting}<NumPad ondigit={digit} onback={backspace} compact={narrow} />{/if}
        {:else}
          {#key shakeKey}<div class="word" class:shake={shakeKey > 0}>{#each sel.word!.split('') as ch, i}<span class:done={i < wordPos} class:next={i === wordPos}>{ch}</span>{/each}</div>{/key}
          {#if !ghosting}<p class="ask">Type it! {wordErr ? `${wordErr} slip${wordErr === 1 ? '' : 's'}` : 'No slips so far'}</p>{/if}
        {/if}
      </div>
    {:else if ui === 'rain' && rain}
      <div class="blockbox">
        <div class="ring" style:--k={rainLeft}><span>{Math.max(0, Math.ceil(rainLeft * rain.limitMs / 1000))}</span></div>
        <div class="bq">
          <p><b>{rain.from} sent a rain cloud!</b> {ghosting ? 'The ghost tries to block it:' : 'Answer fast to block it:'}</p>
          {#if rain.fact}<div class="eq blockeq"><span>{factText(rain.fact)} =</span><span class="box">{rainTyped || ' '}</span></div>
          {:else}<div class="word blockeq">{#each rain.word!.split('') as ch, i}<span class:done={i < wordPos} class:next={i === wordPos}>{ch}</span>{/each}</div>{/if}
        </div>
        {#if rain.fact && !ghosting}<NumPad ondigit={digit} onback={backspace} compact={narrow} />{/if}
      </div>
    {/if}
  </div>

  {#if ui === 'won' && winSide}
    <div class="reveal r-{g.rarity}">
      <div class="rayclip"><div class="rays"></div></div>
      {#if tie}
        <div class="rtitle"><small>You both cheered up {gName} in the same number of turns!</small><b class="tiet">It's a tie!</b><em>Good game, everyone!</em></div>
      {:else}
        <div class="rtitle"><small>{winSide.name}{winSide.kind === 'ghost' ? "'s ghost" : ''} cheered up {gName}!</small><b style:color={SIDE[winner ?? 0]}>{winSide.kind === 'ghost' ? 'Ghost wins!' : `${winSide.name} wins!`}</b><em>Good game, everyone!</em></div>
      {/if}
      <div class="rcard"><GlimmerCard id={glimmer} width={revealW} shine /></div>
      <div class="rinfo" class:in={step >= 1}>
        {#if tie}
          {@const got = players.filter(x => x.o?.met).map(x => x.s.name)}
          <h2>{gName} likes you both!</h2>
          <p class="pw">{got.length ? `It joins ${got.join(' and ')}'s team${got.length > 1 ? 's' : ''}.` : `${gName} goes home happy.`} One slip is all it takes to win next time!</p>
        {:else if winOut?.met?.isNew}
          <h2>{gName} joined {winSide.name}'s team!</h2>
          <p class="pw"><b>In battles it helps:</b> {g.power.text(1)}</p>
          {#if winSide.profileId === game.profile?.id && !advView(game.profile!).team.includes(glimmer)}<button class="btn teambtn" onclick={() => { game.glimmerSel = glimmer; game.go('glimmers'); }}>Put {gName} on your team</button>{/if}
        {:else if winOut?.met}
          <h2>{winSide.name}'s {gName} got stronger!</h2>
          <p class="pw">{winSide.name} already had one{winOut.met.ups ? `, so it's now level ${winOut.met.level}` : ''}.</p>
        {:else if winSide.kind === 'ghost'}
          <h2>{winSide.name}{winSide.kind === 'ghost' ? "'s ghost" : ''} was quicker this time</h2>
          <p class="pw">You still get a point for playing. Try again, or pick another rival!</p>
        {:else}
          <h2>{gName} hops over to say thank you!</h2>
          <p class="pw">{winSide.name} is a guest, so {gName} goes home happy.</p>
        {/if}
      </div>
      <div class="rewards" class:in={step >= 2}>
        {#each players as x (x.i)}
          <div class="who" style:--sc={SIDE[x.i]}>
            <span class="wn"><Critter friend={x.s.buddy} size={28} round />{x.s.name}</span>
            <div class="pz">
              <button class="prize" onclick={() => show({ kind: 'shells' })}><img src="{base}game/icon-shell.webp" alt="" /><b>+{x.o!.shells}</b><small>shells</small></button>
              <button class="prize" onclick={() => show({ kind: 'friendship' })}><span class="heart">♥</span><b>+{x.o!.xp.gained}</b><small>friendship</small></button>
              {#if mode === 'rival'}<button class="prize" onclick={() => show({ kind: 'points' })}><img src="{base}game/league-{x.o!.league}.webp" alt="" /><b>+{x.o!.points}</b><small>points</small></button>{/if}
              {#each x.o!.rewards as r (r.id)}<div class="prize">{#if r.kind === 'outfit'}<img src="{base}outfits/{r.id}.webp" alt="" />{:else}<span class="heart">♪</span>{/if}<b>New</b><small>{r.kind === 'outfit' ? 'outfit' : 'dance'}</small></div>{/each}
              {#each x.o!.stickers ?? [] as st (st.id)}<div class="prize" title={st.desc}><img src="{base}game/icon-stickers.webp" alt="" /><b>Sticker</b><small>{st.name}</small></div>{/each}
            </div>
          </div>
        {/each}
      </div>
      <div class="rbtns" class:in={step >= 2}>
        <button class="btn" onclick={onagain}>{mode === 'duel' ? 'Play again' : 'Try again'}</button>
        <button class="btn btn-primary" onclick={onexit}>{mode === 'duel' ? 'Back to the map' : 'Back to rivals'} <span class="kbd">enter</span></button>
      </div>
    </div>
  {/if}

  {#if ui === 'loading'}
    <div class="loadcover" out:fade={{ duration: 450 }} style:background-image="url({coverArt})">
      <div class="lc card">
        <div class="vs">
          <span class="lp" style:--sc={SIDE[0]}><Critter friend={d.sides[0].buddy} size={narrow ? 72 : 96} /><b>{d.sides[0].name}</b></span>
          <i>vs</i>
          <span class="lp" class:ghost={d.sides[1].kind === 'ghost'} style:--sc={SIDE[1]}><Critter friend={d.sides[1].buddy} size={narrow ? 72 : 96} /><b>{d.sides[1].name}{d.sides[1].kind === 'ghost' ? "'s ghost" : ''}</b></span>
        </div>
        <p>Getting the arena ready<span class="think"><i>.</i><i>.</i><i>.</i></span></p>
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
          <div class="hr"><div class="mini"><span class="mturn"><Critter friend={d.sides[0].buddy} size={34} round /><i>⇄</i><Critter friend={d.sides[1].buddy} size={34} round /></span></div><p><b>Take turns</b> Pick a card. It flips over: answer it!</p></div>
          <div class="hr"><div class="mini"><span class="mbar"><i><em style:width="65%"></em></i></span></div><p><b>Fill your bar first</b> and {gName} joins you.</p></div>
          <div class="hr"><div class="mini"><span class="mcards"><span class="mcard el-sun">3 + 2</span><span class="mcard el-tide">12 × 8</span></span></div><p><b>Fair for everyone</b> Your own questions, and every right answer is +{DUEL_CARD}.</p></div>
          <div class="hr"><div class="mini"><img class="mstorm" src="{base}game/storm1.webp" alt="" /></div><p><b>3 right in a row</b> sends a rain cloud to the other side.</p></div>
          <div class="hr"><div class="mini"><span class="mblock"><span class="mring">4</span>2 + 2 =</span></div><p><b>Rain coming?</b> Answer fast to block it.</p></div>
          <div class="hr"><div class="mini"><span class="mstars">{#each Array(5) as _}<img src="{base}game/icon-star.webp" alt="" />{/each}</span></div><p><b>5 right in a row</b> = your buddy's Finale.</p></div>
          <div class="hr"><div class="mini"><span class="mteam">{#each d.sides[0].team.length ? d.sides[0].team : [{ id: 'puddlepup' as GlimmerId, level: 1 }] as m (m.id)}<img src={artOf(0, m.id)} alt="" />{/each}</span></div><p><b>Your team helps</b> Glimmers and gear add extra cheer.</p></div>
          <div class="hr"><div class="mini"><span class="mturn"><b class="mlast">Last turn!</b></span></div><p><b>Same turns each</b> Fill it first and the other player still gets their turn. Both full? A tie!</p></div>
        </div>
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
        {#if i.kind === 'player'}
          {@const s = d.sides[i.side]}
          <Critter friend={s.buddy} size={120} />
          <div>
            <h3>{s.name}{s.kind === 'ghost' ? "'s ghost" : ''}</h3>
            <p>{s.kind === 'ghost' ? `A ghost plays the way ${s.name} really plays.` : `${s.name}'s buddy is ${FRIEND[s.buddy].name}: ${ROLE[s.role].text}`}</p>
            <p><b>Questions:</b> {levelText(s)}. Every right answer fills +{DUEL_CARD}, the same for everyone, so it's a fair race.</p>
            <p><b>Cheer so far:</b> {Math.round(progress(s) * 100)}% of the way.</p>
          </div>
        {:else if i.kind === 'mate'}
          {@const m = d.sides[i.side].team.find(t => t.id === i.id)}
          <GlimmerCard id={i.id} width={130} level={m?.level} evolved={m?.evolved} />
          <div><h3>{glimmerName(i.id, m?.evolved)}</h3><p><b>Helps {d.sides[i.side].name}:</b> {GLIMMER[i.id].power.text((m?.level ?? 1) + (m?.evolved ? 4 : 0))}</p></div>
        {:else if i.kind === 'glimmer'}
          <GlimmerCard id={glimmer} width={130} />
          <div><h3>{gName} is grumpy</h3><p>Whoever fills their bar first cheers it up, and it joins their team!</p></div>
        {:else if i.kind === 'finale'}
          <img class="ibig" src="{base}game/icon-finale.webp" alt="" />
          <div><h3>The Finale</h3><p>Five right in a row fills your stars. Then your buddy dances, and that's a big cheer!</p></div>
        {:else if i.kind === 'shells'}
          <img class="ibig" src="{base}game/icon-shell.webp" alt="" />
          <div><h3>Shells</h3><p>Adventure money! Spend them on eggs, treats and gear in the Island Shop.</p></div>
        {:else if i.kind === 'friendship'}
          <img class="ibig" src="{base}game/icon-star.webp" alt="" />
          <div><h3>Friendship</h3><p>It grows every time you play together. More friendship opens new outfits and dances.</p></div>
        {:else if i.kind === 'points'}
          <img class="ibig" src="{base}game/league-0.webp" alt="" />
          <div><h3>League points</h3><p>A win is 3 points (once for each rival a week), playing is 1. Get {12} points in a week to move up a league.</p></div>
        {/if}
        <button class="btn btn-primary" onclick={() => (info = null)}>OK</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .duel { position: fixed; inset: 0; display: flex; flex-direction: column; pointer-events: none; font-family: var(--font-body); overflow: hidden; }
  .duel > * { pointer-events: auto; }
  .stage { flex: 1; min-height: 0; pointer-events: none; }
  .top { display: flex; align-items: center; gap: 10px; padding: 12px 16px 0; }
  .leave { width: 46px; height: 46px; border-radius: 50%; border: 0; background: rgba(255, 255, 255, .92); font: 600 30px/1 var(--font-ui); color: var(--ink2); cursor: pointer; box-shadow: var(--shadow-sm); }
  .where { display: flex; flex-direction: column; background: rgba(255, 255, 255, .9); border-radius: 16px; padding: 4px 14px; box-shadow: var(--shadow-sm); }
  .where small { font: 800 11px var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
  .where b { font: 600 18px var(--font-ui); color: var(--ink); }
  .helpbtn { margin-left: auto; width: 46px; height: 46px; border-radius: 50%; border: 0; background: #fff; font: 600 26px/1 var(--font-ui); color: var(--primary); cursor: pointer; box-shadow: 0 0 0 3px #ffd36b, var(--shadow-sm); }
  .won .top, .won .hud, .won .bottom { visibility: hidden; }

  /* the two players along the top */
  .hud { display: flex; justify-content: space-between; gap: 16px; padding: 10px 16px 0; }
  .pl { display: flex; align-items: center; gap: 10px; width: min(380px, 42vw); padding: 8px 14px 8px 8px; border-radius: 26px; background: linear-gradient(#ffffff, #f2f4ff); box-shadow: 0 0 0 3px rgba(255, 255, 255, .9), 0 10px 24px -10px rgba(30, 20, 70, .5); transition: box-shadow .3s, transform .3s; }
  .pl.p1 { flex-direction: row-reverse; padding: 8px 8px 8px 14px; }
  .pl.on { box-shadow: 0 0 0 4px var(--sc), 0 0 26px var(--sc), 0 10px 24px -10px rgba(30, 20, 70, .5); transform: translateY(2px) scale(1.02); }
  .pl.ghost { background: linear-gradient(#f2f9ff, #dcefff); }
  .pl button { border: 0; background: none; padding: 0; font: inherit; cursor: pointer; }
  .face { flex: none; border-radius: 50%; box-shadow: 0 0 0 3px var(--sc); }
  .pl.ghost .face { filter: grayscale(1) brightness(1.2) sepia(1) hue-rotate(165deg) saturate(2.4); opacity: .9; }
  .pb { flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .p1 .pb { align-items: flex-end; }
  .nm { display: flex; align-items: center; gap: 6px; font: 600 18px/1 var(--font-ui) !important; color: var(--ink); white-space: nowrap; }
  .gtag { font: 800 11px var(--font-body); font-style: normal; color: #fff; background: #5aa9f0; padding: 2px 7px; border-radius: 999px; }
  .track { width: 100%; height: 16px; border-radius: 999px; background: #e6e2f2; overflow: hidden; box-shadow: inset 0 2px 3px rgba(40, 20, 80, .18); display: flex; }
  .p1 .track { justify-content: flex-end; }
  .fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, color-mix(in srgb, var(--sc) 60%, #fff), var(--sc)); box-shadow: 0 0 10px var(--sc); }
  .row { display: flex; align-items: center; gap: 6px; }
  .p1 .row { flex-direction: row-reverse; }
  .stars { display: flex; gap: 1px; background: rgba(30, 22, 60, .78) !important; padding: 3px 6px !important; border-radius: 999px; line-height: 0; }
  .stars img { width: 18px; height: 18px; object-fit: contain; filter: grayscale(1) brightness(.55); transition: filter .3s; }
  .stars img.on { filter: none; }
  .tm img { width: 30px; height: 30px; border-radius: 50%; object-fit: cover; object-position: center 35%; box-shadow: 0 0 0 2px #fff; display: block; }
  .ghost .tm img { filter: saturate(.5) hue-rotate(160deg) brightness(1.1); opacity: .85; }
  .turnpill { align-self: center; margin-top: 8px; border: 0; cursor: pointer; font: 600 20px var(--font-ui); color: #fff; background: var(--sc); padding: 6px 20px; border-radius: 999px; box-shadow: 0 0 0 3px #fff, 0 8px 20px -8px rgba(30, 20, 70, .6); }

  .float { position: absolute; transform: translate(-50%, -50%); font: 600 34px var(--font-ui); color: #fff; z-index: 8; pointer-events: none; animation: rise 1.5s cubic-bezier(.2, .8, .3, 1) forwards; -webkit-text-stroke: 1px rgba(40, 20, 80, .25); text-shadow: 0 3px 0 rgba(40, 20, 80, .35), 0 0 18px currentColor; white-space: nowrap; }
  .float.extra { font-size: 22px; }
  .float.block { font-size: 24px; color: #7fe0ff; }
  .float.hurt { font-size: 22px; color: #ff8a9a; }
  .float.finale { font-size: 52px; }
  .float.helper { display: flex; align-items: center; gap: 8px; font: 600 18px var(--font-ui); color: var(--ink); -webkit-text-stroke: 0; text-shadow: none; background: #fff; padding: 4px 14px 4px 4px; border-radius: 999px; box-shadow: 0 0 0 3px #ffd36b, 0 10px 24px -10px rgba(40, 20, 80, .6); animation: badge 2.2s cubic-bezier(.2, .8, .3, 1) forwards; }
  .float.helper img { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; object-position: center 35%; }
  @keyframes badge { 0% { opacity: 0; transform: translate(-50%, -30%) scale(.6); } 12% { opacity: 1; transform: translate(-50%, -110%) scale(1.05); } 20% { transform: translate(-50%, -110%) scale(1); } 85% { opacity: 1; transform: translate(-50%, -125%); } 100% { opacity: 0; transform: translate(-50%, -140%); } }
  @keyframes rise { 0% { opacity: 0; transform: translate(-50%, -20%) scale(.6); } 15% { opacity: 1; transform: translate(-50%, -60%) scale(1.15); } 30% { transform: translate(-50%, -70%) scale(1); } 100% { opacity: 0; transform: translate(-50%, -190%) scale(.95); } }
  .toast { position: absolute; left: 50%; top: 30%; transform: translateX(-50%); z-index: 9; background: rgba(255, 255, 255, .95); color: var(--ink); font: 600 19px var(--font-ui); padding: 10px 20px; border-radius: 999px; box-shadow: 0 10px 30px -12px rgba(40, 20, 80, .6); animation: drop .35s cubic-bezier(.3, .8, .4, 1.4); white-space: nowrap; }
  .toast.super { background: linear-gradient(90deg, #fff4c2, #ffffff); box-shadow: 0 0 0 3px #ffd36b, 0 10px 30px -12px rgba(120, 80, 0, .6); }
  .toast.miss { background: #fff0f2; color: #b02a48; } .toast.good { background: #eafff3; color: #0f6a48; }
  @keyframes drop { from { opacity: 0; transform: translate(-50%, -16px) scale(.9); } }
  .big { position: absolute; left: 50%; top: 38%; transform: translate(-50%, -50%); z-index: 10; text-align: center; pointer-events: none; animation: bigin .6s cubic-bezier(.2, 1.4, .4, 1) both; }
  .big b { display: block; font: 600 clamp(40px, 7vw, 84px)/1 var(--font-ui); color: #fff; -webkit-text-stroke: 3px #6d3fd6; paint-order: stroke; text-shadow: 0 6px 0 #4a23a8, 0 0 40px rgba(255, 255, 255, .9); white-space: nowrap; }
  .big small { display: block; margin-top: 10px; font: 600 clamp(15px, 2vw, 22px) var(--font-ui); color: #fff; text-shadow: 0 2px 8px rgba(30, 10, 60, .7); }
  .big.turn b { -webkit-text-stroke-color: var(--sc); text-shadow: 0 6px 0 color-mix(in srgb, var(--sc) 60%, #000), 0 0 40px #fff; }
  .big.perfect b { -webkit-text-stroke-color: #e07b00; text-shadow: 0 6px 0 #b35a00, 0 0 50px #ffe066; }
  .big.finale b { -webkit-text-stroke-color: #d6338a; text-shadow: 0 6px 0 #9c1d63, 0 0 50px #ff9ad5; }
  @keyframes bigin { 0% { opacity: 0; transform: translate(-50%, -50%) scale(.4) rotate(-6deg); } 100% { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(0); } }

  .bottom { flex: none; padding: 6px 16px 16px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .finalebig { display: flex; align-items: center; gap: 10px; border: 0; border-radius: 999px; padding: 8px 26px 8px 10px; background: linear-gradient(135deg, #ff6fb8, #b46bff); box-shadow: 0 0 0 4px #fff, 0 0 30px #ff7ab8; cursor: pointer; animation: wob .9s ease-in-out infinite; color: #fff; text-align: left; }
  .finalebig img { width: 56px; height: 56px; object-fit: contain; }
  .finalebig b { display: block; font: 600 30px/1 var(--font-ui); }
  .finalebig small { font: 700 13px var(--font-body); opacity: .95; }
  @keyframes wob { 50% { transform: scale(1.07) rotate(-2deg); } }
  .cards { display: flex; gap: 16px; justify-content: center; width: min(1100px, 100%); }
  .cards.dim { opacity: .65; }
  .cards .card { position: relative; flex: 1; max-width: 330px; display: flex; align-items: center; gap: 10px; padding: 12px 18px 12px 12px; border-radius: 30px; border: 4px solid #fff; cursor: pointer; box-shadow: 0 0 0 3px var(--sc), 0 12px 24px -12px rgba(30, 20, 70, .6), inset 0 -8px 16px rgba(0, 0, 0, .08); transition: transform .15s; animation: cardin .45s var(--d) cubic-bezier(.2, 1.3, .4, 1) both; }
  .cards .card:hover:not(:disabled) { transform: translateY(-6px) scale(1.03); }
  .cards .card .ci { width: 70px; height: 70px; flex: none; object-fit: contain; filter: drop-shadow(0 4px 4px rgba(0, 0, 0, .18)); }
  .ct { display: flex; flex-direction: column; min-width: 0; }
  .ct em { align-self: flex-start; margin-top: 4px; font: 800 12px var(--font-body); font-style: normal; background: #fff; color: #d16a00; padding: 3px 9px; border-radius: 999px; }
  .ct b { font: 600 clamp(28px, 3.4vw, 42px)/1.05 var(--font-ui); color: #2a1f45; white-space: nowrap; }
  .cards .el-sun.card { background: linear-gradient(160deg, #fff6c4, #ffd36b); }
  .cards .el-tide.card { background: linear-gradient(160deg, #e2f4ff, #8fd0ff); }
  .cards .el-frost.card { background: linear-gradient(160deg, #f6f0ff, #c8b8ff); }
  .cards .el-leaf.card { background: linear-gradient(160deg, #eaffe6, #9ee8a6); }
  .cards .el-stone.card { background: linear-gradient(160deg, #fbf3e8, #e2c7a2); }
  .cards .card.super { box-shadow: 0 0 0 3px #ffd36b, 0 0 22px #ffd36b, 0 12px 24px -12px rgba(30, 20, 70, .6); }
  /* a face-down card: its element and a big question mark */
  .cards .card.down { justify-content: center; }
  .cards .card.down .ct { align-items: flex-start; }
  .cards .card.down .ct b { font-size: clamp(36px, 4vw, 50px); color: color-mix(in srgb, #2a1f45 75%, transparent); }
  .cards .card.down .ct small { font: 800 13px var(--font-body); color: color-mix(in srgb, #2a1f45 70%, transparent); text-transform: uppercase; letter-spacing: .06em; }
  .key { position: absolute; top: 8px; left: 10px; width: 22px; height: 22px; border-radius: 7px; background: rgba(255, 255, 255, .85); font: 700 13px/22px var(--font-body); color: var(--muted); text-align: center; box-shadow: 0 2px 0 rgba(0, 0, 0, .12); }
  @keyframes cardin { from { opacity: 0; transform: translateY(60px) scale(.8); } }
  /* whose go it is: their name on a chip in their colour, on a white pill that reads over any scene */
  .hint { margin: 0; display: flex; align-items: center; gap: 8px; font: 600 18px var(--font-ui); color: var(--ink); background: rgba(255, 255, 255, .95); padding: 4px 16px 4px 4px; border-radius: 999px; box-shadow: 0 8px 20px -10px rgba(30, 20, 70, .6); }
  .nmchip { display: inline-block; font: 600 17px/1.2 var(--font-ui); color: #fff; background: var(--sc); padding: 3px 12px; border-radius: 999px; white-space: nowrap; }
  .think i { animation: blink 1.2s infinite; font-style: normal; } .think i:nth-child(2) { animation-delay: .2s; } .think i:nth-child(3) { animation-delay: .4s; }
  @keyframes blink { 50% { opacity: .2; } }

  .answer, .blockbox { width: min(1000px, 100%); display: flex; flex-direction: column; align-items: center; gap: 10px; background: rgba(255, 255, 255, .92); border-radius: 28px; padding: 14px 16px; box-shadow: 0 0 0 3px var(--sc), 0 16px 40px -18px rgba(30, 20, 70, .6); animation: cardin .35s cubic-bezier(.2, 1.3, .4, 1) both; }
  .answer.ghostly { background: rgba(232, 244, 255, .94); }
  .who { margin: 0; display: flex; align-items: center; gap: 8px; font: 600 18px var(--font-ui); color: var(--ink2); }
  .answer { animation: flip .45s cubic-bezier(.2, 1.2, .4, 1) both; }
  @keyframes flip { 0% { opacity: 0; transform: perspective(900px) rotateX(70deg) scale(.85); } 100% { opacity: 1; transform: none; } }
  .eq { display: flex; align-items: center; gap: 14px; font: 600 clamp(40px, 6vw, 64px)/1 var(--font-ui); color: var(--ink); }
  .eq.blockeq, .word.blockeq { font-size: clamp(54px, 8vw, 92px); }
  .box { min-width: 1.6em; padding: 4px 14px; border-radius: 18px; background: #fff; box-shadow: inset 0 0 0 4px #a98cff, 0 0 0 6px #efe9ff; text-align: center; }
  .shake { animation: shake .35s; }
  @keyframes shake { 20% { transform: translateX(-10px); } 40% { transform: translateX(10px); } 60% { transform: translateX(-6px); } 80% { transform: translateX(6px); } }
  .ask { margin: 0; font: 600 20px var(--font-ui); color: var(--ink2); text-align: center; }
  .word { display: flex; gap: 4px; font: 600 clamp(44px, 7vw, 72px)/1 var(--font-ui); letter-spacing: .02em; }
  .word span { color: #b8b0cc; padding: 0 2px; border-bottom: 5px solid transparent; }
  .word span.done { color: var(--ink); }
  .word span.next { color: var(--primary); border-bottom-color: var(--primary); }
  .backbtn { border: 0; background: none; font: 700 14px var(--font-body); color: var(--muted); cursor: pointer; text-decoration: underline; }
  .blockbox { flex-direction: row; flex-wrap: wrap; justify-content: center; background: linear-gradient(#f2f8ff, #ffffff); box-shadow: 0 0 0 4px #8fc8ff, 0 16px 40px -18px rgba(20, 60, 120, .6); }
  .ring { width: 74px; height: 74px; border-radius: 50%; background: conic-gradient(#3d9cf0 calc(var(--k) * 360deg), #e3eef8 0); display: grid; place-items: center; flex: none; }
  .ring span { width: 56px; height: 56px; border-radius: 50%; background: #fff; display: grid; place-items: center; font: 600 28px var(--font-ui); color: #1f6fb8; }
  .bq { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .bq p { margin: 0; font: 600 20px var(--font-ui); color: #1f4f80; text-align: center; }
  .blockbox :global(.pad) { flex-basis: 100%; }

  .reveal { position: absolute; inset: 0; z-index: 20; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 16px; background: radial-gradient(circle at 50% 42%, rgba(255, 255, 255, .25), rgba(30, 20, 60, .55) 70%); overflow: hidden auto; }
  .tiet { color: #ffb02e; }
  /* the spinning rays sit in a box of their own that clips them, so they never make the page scroll */
  .rayclip { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
  .rays { position: absolute; left: 50%; top: 40%; width: 1400px; height: 1400px; margin: -700px 0 0 -700px; background: repeating-conic-gradient(from 0deg, rgba(255, 255, 255, .22) 0 8deg, transparent 8deg 22deg); animation: spin 18s linear infinite; mask: radial-gradient(circle, #000 20%, transparent 60%); -webkit-mask: radial-gradient(circle, #000 20%, transparent 60%); pointer-events: none; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .rtitle { position: relative; text-align: center; animation: titlein .7s cubic-bezier(.2, 1.4, .4, 1) both; }
  @keyframes titlein { 0% { opacity: 0; transform: scale(.4) rotate(-6deg); } 100% { opacity: 1; transform: none; } }
  .rtitle small { display: block; font: 600 20px var(--font-ui); color: #fff; text-shadow: 0 2px 8px rgba(0, 0, 0, .5); }
  .rtitle em { display: inline-block; margin-top: 6px; font: 700 15px var(--font-body); font-style: normal; color: var(--ink); background: #fff; padding: 3px 12px; border-radius: 999px; }
  .rtitle b { display: block; font: 600 clamp(40px, min(8vw, 8vh), 84px)/1 var(--font-ui); -webkit-text-stroke: 3px #fff; paint-order: stroke; text-shadow: 0 6px 0 rgba(0, 0, 0, .25), 0 0 40px #fff; white-space: nowrap; }
  .rcard { position: relative; animation: flipin .9s .3s cubic-bezier(.2, 1.2, .4, 1) both; }
  @keyframes flipin { 0% { opacity: 0; transform: perspective(800px) rotateY(180deg) scale(.4); } 100% { opacity: 1; transform: perspective(800px) rotateY(0) scale(1); } }
  .rinfo, .rewards, .rbtns { position: relative; opacity: 0; transform: translateY(14px); transition: opacity .4s, transform .4s; text-align: center; }
  .rinfo.in, .rewards.in, .rbtns.in { opacity: 1; transform: none; }
  .rinfo { background: rgba(255, 255, 255, .94); border-radius: 22px; padding: 10px 20px; max-width: 560px; }
  .rinfo h2 { margin: 0; font-size: 24px; }
  .pw { margin: 4px 0 0; font: 600 16px/1.35 var(--font-body); color: var(--ink2); }
  .teambtn { margin-top: 8px; }
  .rewards { display: flex; flex-wrap: wrap; gap: 14px; justify-content: center; max-width: 900px; }
  .rewards .who { display: flex; flex-direction: column; align-items: center; gap: 6px; background: rgba(255, 255, 255, .5); border-radius: 24px; padding: 8px 10px 10px; box-shadow: 0 0 0 3px var(--sc); }
  .wn { display: flex; align-items: center; gap: 6px; font: 600 17px var(--font-ui); color: var(--ink); background: #fff; padding: 2px 12px 2px 2px; border-radius: 999px; }
  .pz { display: flex; gap: 8px; }
  .prize { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 90px; height: 98px; gap: 2px; border: 0; border-radius: 22px; background: #fff; cursor: pointer; box-shadow: 0 0 0 3px #ffe9a8, var(--shadow-sm); transition: transform .15s; }
  .prize:hover { transform: translateY(-3px); }
  .prize img { width: 44px; height: 44px; object-fit: contain; }
  .prize .heart { font: 600 36px/44px var(--font-ui); color: #ef5f9a; height: 44px; }
  .prize b { font: 600 21px/1 var(--font-ui); color: var(--ink); }
  .prize small { font: 700 12px var(--font-body); color: var(--muted); max-width: 84px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rbtns { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }

  .helpbg { position: absolute; inset: 0; z-index: 30; background: rgba(40, 28, 70, .4); display: grid; place-items: center; }
  .infobox { width: min(540px, 92vw); padding: 18px 20px; display: grid; grid-template-columns: auto 1fr; gap: 16px; align-items: center; }
  .infobox h3 { margin: 0 0 4px; font-size: 22px; }
  .infobox p { margin: 0 0 6px; font: 600 16px/1.4 var(--font-body); color: var(--ink2); }
  .infobox > .btn { grid-column: 1 / -1; justify-self: end; }
  .ibig { width: 96px; height: 96px; object-fit: contain; }
  .helpcard { width: min(680px, 94vw); max-height: 88vh; overflow: auto; padding: 18px 24px; display: flex; flex-direction: column; gap: 8px; }
  .helpcard h2 { margin: 0; }
  .helpcard .btn { align-self: flex-end; }
  .hrows { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .hr { display: flex; flex-direction: column; gap: 8px; align-items: center; text-align: center; background: #faf8fe; border-radius: 16px; padding: 12px 10px; }
  .hr p { margin: 0; font: 600 15px/1.35 var(--font-body); color: var(--ink2); }
  .hr p b { display: block; color: var(--ink); font-size: 16px; }
  .mini { flex: none; width: 100%; height: 64px; display: grid; place-items: center; }
  .mturn { display: flex; align-items: center; gap: 6px; } .mturn i { font: 600 22px var(--font-ui); color: var(--primary); font-style: normal; }
  .mbar { display: flex; align-items: center; background: #fff; border-radius: 999px; padding: 4px; box-shadow: var(--shadow-sm); }
  .mbar i { display: block; width: 110px; height: 12px; border-radius: 999px; background: #e6e2f2; overflow: hidden; }
  .mbar em { display: block; height: 100%; background: linear-gradient(90deg, #8cc8ff, #3d9cf0); }
  .mcards { display: flex; gap: 6px; }
  .mcard { font: 600 20px var(--font-ui); color: #2a1f45; padding: 6px 10px; border-radius: 14px; border: 3px solid #fff; box-shadow: var(--shadow-sm); white-space: nowrap; }
  .mcard.el-sun { background: linear-gradient(160deg, #fff6c4, #ffd36b); } .mcard.el-tide { background: linear-gradient(160deg, #e2f4ff, #8fd0ff); }
  .mstorm { width: 96px; height: 56px; object-fit: contain; }
  .mteam { display: flex; gap: 4px; } .mteam img { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; object-position: center 35%; box-shadow: 0 0 0 2px #fff, var(--shadow-sm); }
  .mlast { font: 600 20px var(--font-ui); color: #fff; background: #f0675a; padding: 4px 12px; border-radius: 999px; }
  .loadcover { position: absolute; inset: 0; z-index: 40; display: grid; place-items: center; background-size: cover; background-position: center; }
  .loadcover::before { content: ''; position: absolute; inset: 0; backdrop-filter: blur(10px); background: rgba(255, 250, 255, .3); }
  .lc { position: relative; padding: 22px 30px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .lc p { margin: 0; font: 600 18px var(--font-ui); color: var(--ink2); }
  .vs { display: flex; align-items: center; gap: 18px; }
  .vs > i { font: 600 30px var(--font-ui); font-style: normal; color: var(--primary); }
  .lp { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .lp b { font: 600 17px var(--font-ui); color: #fff; background: var(--sc); padding: 2px 12px; border-radius: 999px; }
  .lp.ghost :global(img) { filter: grayscale(1) brightness(1.2) sepia(1) hue-rotate(165deg) saturate(2.4); opacity: .9; }
  .mblock { display: flex; align-items: center; gap: 6px; font: 600 22px var(--font-ui); background: #f2f8ff; border-radius: 14px; padding: 4px 10px 4px 4px; box-shadow: 0 0 0 2px #8fc8ff; }
  .mring { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; font-size: 15px; color: #1f6fb8; background: #fff; box-shadow: 0 0 0 3px #3d9cf0; }
  .mstars { display: flex; gap: 1px; background: rgba(30, 22, 60, .78); padding: 4px 6px; border-radius: 999px; }
  .mstars img { width: 22px; height: 22px; object-fit: contain; }

  .narrow .top { padding: 8px 10px 0; }
  .narrow .where b { font-size: 14px; }
  .narrow .hud { gap: 6px; padding: 8px 8px 0; }
  .narrow .pl { width: calc(50% - 3px); gap: 6px; padding: 5px 8px 5px 5px; border-radius: 20px; }
  .narrow .pl.p1 { padding: 5px 5px 5px 8px; }
  .narrow .nm { font-size: 14px !important; }
  .narrow .track { height: 12px; }
  .narrow .stars img { width: 13px; height: 13px; }
  .narrow .tm img { width: 22px; height: 22px; }
  .narrow .turnpill { font-size: 16px; padding: 4px 14px; margin-top: 6px; }
  .narrow .bottom { padding: 4px 8px 10px; }
  .narrow .cards { gap: 6px; }
  .narrow .cards .card { flex-direction: column; gap: 2px; padding: 8px 4px; border-radius: 22px; text-align: center; }
  .narrow .cards .card .ci { width: 44px; height: 44px; }
  .narrow .ct em { align-self: center; font-size: 10px; padding: 2px 6px; }
  .narrow .ct b { font-size: 24px; }
  .narrow .hint { font-size: 14px; } .narrow .nmchip { font-size: 14px; }
  .narrow .cards .card.down .ct { align-items: center; }
  .narrow .cards .card.down .ct b { font-size: 30px; } .narrow .cards .card.down .ct small { font-size: 10px; }
  .narrow .finalebig b { font-size: 22px; } .narrow .finalebig img { width: 40px; height: 40px; }
  .narrow .answer, .narrow .blockbox { padding: 10px; border-radius: 22px; }
  .narrow .hrows { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .narrow .hr p { font-size: 13px; } .narrow .hr p b { font-size: 14px; }
  .narrow .mini { zoom: .8; }
  .narrow .infobox { grid-template-columns: 1fr; justify-items: center; text-align: center; }
  .narrow .prize { width: 70px; height: 84px; } .narrow .prize img { width: 32px; height: 32px; }
  .narrow .pz { gap: 5px; }
  .narrow .rinfo h2 { font-size: 20px; }
  .narrow .toast { top: 27%; font-size: 16px; white-space: normal; width: max-content; max-width: 92vw; text-align: center; }
  .narrow .big { top: 37%; }
</style>
