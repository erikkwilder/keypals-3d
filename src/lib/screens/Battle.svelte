<script lang="ts">
  // The Cheer Duel. Spark over your buddy, Grump over the Grumble, three power cards at the bottom. Pick a
  // card, answer it, and the number you make cheers the Grumble up (land exactly on zero for a Perfect
  // Cheer). Then block its mischief with a quick one. Five right in a row lights the Finale. When it's
  // cheered right up, the cloud bursts and the Glimmer inside is revealed, with its rarity.
  import { onDestroy, onMount } from 'svelte';
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { game } from '../state/game.svelte';
  import { stage } from '../three/stage';
  import { BattleScene } from '../three/battleScene';
  import { sfx } from '../audio/sound';
  import { buddyPal, danceOf, outfitOf } from '../engine/profile';
  import { levelFromXp } from '../engine/stickers';
  import { FRIEND } from '../art/cast';
  import { answerOf, opSign, type Fact } from '../math/facts';
  import { trickOf } from '../math/course';
  import { BUDDY_ROLE, ELEMENT, GEAR, GLIMMER, RARITY, ROLE, rarityRank, type Element } from '../adventure/glimmers';
  import { newBattle, play, block as doBlock, finale as doFinale, swap as doSwap, openFact, sparkFor, useGlow, FINALE_AT, type Battle, type BEvent, type Card } from '../adventure/battle';
  import { advOf, advView, applyBattle, foeFor, ISLAND, markSeen, mathPool, NODE, teamOf, typingPool, type BattleOutcome } from '../adventure/state';
  import Coach from '../ui/Coach.svelte';
  import NumPad from '../math/ui/NumPad.svelte';
  import Critter from '../ui/Critter.svelte';
  import GlimmerCard from '../ui/GlimmerCard.svelte';
  import Confetti from '../ui/Confetti.svelte';

  const base = import.meta.env.BASE_URL;
  const p0 = game.profile!;
  const node = NODE[game.battleNode ?? 'meadow-0'];
  const island = ISLAND[node.island];
  const adv = advOf(p0);
  const subject = adv.subject;
  const pool = subject === 'math' ? mathPool(p0) : typingPool(p0);
  const seed = (Date.now() % 1e9) | 0;
  const foe = foeFor(p0, node, pool, seed);
  const team = teamOf(adv);
  const role = BUDDY_ROLE[p0.buddy] ?? 'heart';
  const outfit = outfitOf(p0);
  const gear = GEAR[outfit] ?? null;
  const level = levelFromXp(buddyPal(p0).xp).level;
  const b: Battle = newBattle({ pool, seed, sparkMax: sparkFor(level, role), role, gear: gear?.kind ?? null, team, foe, fastMs: p0.math?.fastMs });
  const t0 = performance.now();
  const champion = node.kind === 'champion';

  let scene: BattleScene | null = null;
  let disposed = false;
  let ui = $state<'loading' | 'intro' | 'pick' | 'answer' | 'busy' | 'block' | 'won' | 'lost'>('loading');
  let cards = $state<Card[]>([]);
  let finaleN = $state(0);
  let streak = $state(0);
  const spark = new Tween(b.spark, { duration: 500, easing: cubicOut });
  const grump = new Tween(b.foe.grump, { duration: 650, easing: cubicOut });
  let sparkNow = $state(b.spark);
  let grumpNow = $state(b.foe.grump);
  let swapOk = $state(role === 'trick');
  let glowOk = $state(team.some(m => GLIMMER[m.id].power.kind === 'glow'));
  let glowText = $state('');

  // answering
  let sel = $state<Card | null>(null);
  let choice = $state<number | null>(null);
  let typed = $state('');
  let wordPos = $state(0); let wordErr = $state(0); let shakeKey = $state(0);
  let shownAt = 0;
  // blocking
  let blk = $state<{ name: string; fact?: Fact; word?: string; limitMs: number } | null>(null);
  let blockAt = 0; let blockLeft = $state(1); let blockTimer = 0;

  // floating numbers and messages
  type Float = { id: number; x: number; y: number; text: string; kind: string };
  let floats = $state<Float[]>([]); let fid = 0;
  let toast = $state<{ text: string; kind: string; key: number } | null>(null);
  let bigBanner = $state<{ text: string; sub?: string; kind: string; key: number } | null>(null);
  let burst = $state(0);
  let budPos = $state({ x: 0.27, y: 0.2 }); let foePos = $state({ x: 0.7, y: 0.18 });
  let narrow = $state(innerWidth < 760);
  let stageEl: HTMLDivElement | undefined = $state();
  let raf = 0;

  // tips for a first-time player (shown once each)
  const seen = new Set(advView(p0).seen ?? []);
  const firstBattle = !seen.has('battle1');
  let coach = $state<{ text: string; at: string | null; button?: string; id: string } | null>(null);
  let help = $state(false);
  function tip(id: string, text: string, at: string | null, button?: string) {
    if (seen.has(id)) return;
    seen.add(id); coach = { id, text, at, button };
  }
  function closeTip(id?: string) { if (!id || coach?.id === id) coach = null; }
  const foeName = GLIMMER[foe.glimmer].name;
  const canPerfect = $derived(subject === 'math' ? cards.some(c => c.fact && answerOf(c.fact) === grumpNow) : cards.some(c => c.word?.length === grumpNow));

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
      const sc = await BattleScene.create({ buddy: p0.buddy, outfit, dance: danceOf(p0), region: island.region, team: team.map(t => t.id), foe: { glimmer: foe.glimmer, rarity: foe.rarity, champion }, view: viewOf() });
      if (disposed) { sc.dispose(); return; }
      scene = sc; stage.use(sc);
      requestAnimationFrame(onResize);
      const tick = () => { if (scene && !narrow) { budPos = scene.screenOf('buddy', 0.35); foePos = scene.screenOf('foe', 0.25); } raf = requestAnimationFrame(tick); };
      tick();
    } catch (e) { console.error(e); }
    ui = 'intro';
    sfx.grumble();
    bigBanner = { text: `${foeName} is grumpy!`, sub: champion ? `The Champion of ${island.name}. Cheer it up and it joins your team!` : 'Answer cards to cheer it up. Then it joins your team!', kind: champion ? 'champ' : 'intro', key: Date.now() };
    setTimeout(() => {
      bigBanner = null; sync(); ui = 'pick';
      if (firstBattle) tip('t-cards', 'Tap a card, then type the answer. Every right answer cheers it up, and bigger answers cheer more!', '.cards');
    }, champion ? 2800 : 2300);
  });
  onDestroy(() => { disposed = true; cancelAnimationFrame(raf); clearInterval(blockTimer); removeEventListener('resize', onResize); if (scene && stage.current() === scene) stage.use(null); });

  function sync() {
    cards = b.cards.slice(); finaleN = b.finale; streak = b.streak;
    sparkNow = b.spark; grumpNow = b.foe.grump;
    spark.target = b.spark; grump.target = b.foe.grump;
    scene?.setGrump(b.foe.grump / b.foe.max);
  }
  function float(which: 'buddy' | 'foe' | 'team0' | 'team1', text: string, kind: string) {
    const pos = scene?.screenOf(which, 0.2) ?? { x: which === 'buddy' ? 0.3 : 0.7, y: 0.3 };
    const f = { id: fid++, x: pos.x + (Math.random() - 0.5) * 0.03, y: pos.y, text, kind };
    floats = [...floats, f];
    setTimeout(() => (floats = floats.filter(x => x.id !== f.id)), 1500);
  }
  function say(text: string, kind = 'info') { toast = { text, kind, key: Date.now() }; setTimeout(() => { if (toast?.text === text) toast = null; }, 2200); }

  // ---------- picking and answering ----------
  function pick(c: Card) {
    if (ui !== 'pick') return;
    closeTip('t-cards'); closeTip('strong');
    sel = c; choice = null; typed = ''; wordPos = 0; wordErr = 0; glowText = '';
    ui = 'answer'; sfx.click();
    shownAt = performance.now();
  }
  function back() { if (ui === 'answer') { sel = null; ui = 'pick'; } }
  function choose(n: number) { if (!sel?.open) return; choice = n; typed = ''; shownAt = performance.now(); sfx.pop(); }
  function digit(d: string) {
    if (ui === 'block') { blockTyped += d; if (blk?.fact && blockTyped.length >= String(answerOf(blk.fact)).length) submitBlock(); return; }
    if (ui !== 'answer' || !sel || subject !== 'math') return;
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
    const ev = subject === 'math'
      ? play(b, c.id, { ok: !!f && Number(typed) === answerOf(f), value: Number(typed), thinkMs: think, fact: f ?? undefined })
      : play(b, c.id, { ok: true, value: Math.max(1, (c.word?.length ?? 1) - wordErr), thinkMs: think });
    if (ev.length === 1 && ev[0].k === 'retry') { say(`${GEAR[outfit]?.name ?? 'Second Chance'}: have another go!`, 'good'); typed = ''; wordPos = 0; wordErr = 0; ui = 'answer'; shakeKey++; return; }
    sel = null; typed = '';
    await run(ev);
  }

  // typing cards and typing blocks
  function onKey(e: KeyboardEvent) {
    if (ui === 'won' || ui === 'lost') { if (e.key === 'Enter') { e.preventDefault(); toMap(); } return; }
    if (subject === 'math') {
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
    else { wordErr++; shakeKey++; sfx.miss(); }
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
    const f = fact(sel);
    if (!useGlow(b) || !f) return;
    glowOk = false;
    glowText = subject === 'math' ? trickOf(f).say : '';
    sfx.heal();
  }

  // ---------- playing the events ----------
  async function run(ev: BEvent[], fromFinale = false) {
    for (const e of ev) {
      if (disposed) return;
      if (e.k === 'cast') {
        sfx.cast(e.card.element);
        await scene?.cast(e.card.element, e.value, { perfect: e.perfect, super: e.super, ok: e.ok, big: e.value / Math.max(1, b.foe.max) * 2.2 });
        if (e.ok) {
          sfx.hit(Math.min(1, e.value / Math.max(1, b.foe.max) * 3));
          float('foe', `−${e.value}`, e.card.element);
          if (e.perfect) { sfx.perfect(); bigBanner = { text: 'Perfect Cheer!', sub: `Exactly ${e.value}!`, kind: 'perfect', key: Date.now() }; burst++; }
          else if (e.super) say(`⚡ Strong! ${ELEMENT[e.card.element].name} beats ${ELEMENT[b.foe.element].name}.`, 'super');
        } else { sfx.miss(); say(subject === 'math' && e.card.fact ? `Not quite: ${factText(e.card.fact)} = ${answerOf(e.card.fact)}` : 'Not quite!', 'miss'); }
        sync();
      } else if (e.k === 'extra') {
        const slot = e.id ? team.findIndex(m => m.id === e.id) : -1;
        await scene?.extra(slot, e.id ? GLIMMER[e.id].element : 'sun');
        sfx.pop(); float(slot === 1 ? 'team1' : slot === 0 ? 'team0' : 'buddy', `${e.id ? GLIMMER[e.id].name : e.what} helps!`, 'extra');
        float('foe', `−${e.value}`, 'extra');
        sync();
      } else if (e.k === 'heal') {
        const slot = e.id ? team.findIndex(m => m.id === e.id) : -1;
        scene?.heal(slot); sfx.heal();
        float('buddy', `+${e.value} energy`, 'heal'); sync();
        await sleep(300);
      } else if (e.k === 'freeze') { scene?.freeze(team.findIndex(m => m.id === e.id)); sfx.freeze(); say(`${GLIMMER[e.id].name} froze the Grumble!`, 'super'); await sleep(400); }
      else if (e.k === 'dazzle') { scene?.dazzle(); }
      else if (e.k === 'streakKept') { say(`${GLIMMER[e.id].name} kept your row going!`, 'good'); }
      else if (e.k === 'aurora') { scene?.aurora(); sfx.reveal(3); say('Aurora! Your Finale is ready.', 'super'); await sleep(600); }
      else if (e.k === 'finaleReady') { sfx.badge(); }
      else if (e.k === 'finale') { sfx.hit(1); float('foe', `−${e.value}`, 'finale'); sync(); }
      else if (e.k === 'mischief') {
        if (e.result === 'skip') {
          say(e.why === 'frozen' ? `Frozen! ${foeName} can't send anything.` : e.why === 'Hover' ? 'Hover! You floated right over it.' : `${e.why} blocked it for you!`, 'good');
          await scene?.mischief(e.kind, 'skip', e.why);
        } else {
          if (e.kind === 'zap') sfx.zap(); else sfx.whoosh();
          await scene?.mischief(e.kind, e.result);
          if (e.damage === 0) { sfx.shield(true); float('buddy', 'Blocked!', 'block'); }
          else { if (e.result === 'half') sfx.shield(false); sfx.ouch(); float('buddy', `−${e.damage}`, 'hurt'); }
          sync();
        }
      } else if (e.k === 'secondwind') { scene?.heal(team.findIndex(m => GLIMMER[m.id].power.kind === 'secondwind')); sfx.heal(); say('Sky Whale gives you energy back!', 'super'); float('buddy', `+${e.value} energy`, 'heal'); sync(); }
      else if (e.k === 'won') { await won(e.perfect); return; }
      else if (e.k === 'lost') { lost(); return; }
    }
    sync();
    if (b.phase === 'block') startBlock();
    else if (b.phase === 'pick') {
      ui = 'pick'; swapOk = role === 'trick' && !b.used.swap;
      if (firstBattle && b.stats.right >= 1) tip('t-grumpy', 'See its Grumpy bar go down? Get it all the way to 0 and it will be happy again.', '.bar.grump', 'Got it');
      if (firstBattle && b.stats.blocks >= 1 && seen.has('t-grumpy') && coach === null) tip('t-energy', 'This is your energy. Rain and zaps take some when you don\'t block them. If it runs out, you can try again.', '.bar.spark', 'Got it');
      if (b.finale >= FINALE_AT) tip('t-finale', 'Five right in a row! Tap Finale for your buddy\'s big move. It cheers up a lot!', '.finalebig');
      else if (coach === null && cards.some(c => c.super)) tip('strong', 'Cards with ⚡ are extra strong against this Glimmer: they also calm its next rain and fill a Finale star.', '.card.super', 'Got it');
      else if (coach === null && canPerfect && b.stats.right >= 2) tip('perfect', `Bonus: answer exactly ${grumpNow} for a Perfect Cheer! You get extra shells and an egg.`, '.bar.grump', 'Got it');
    }
    void fromFinale;
  }

  function startBlock() {
    const bl = b.block!;
    blk = { name: bl.name, fact: bl.fact, word: bl.word, limitMs: bl.limitMs };
    if (firstBattle) tip('t-block', `Uh oh, ${bl.name.toLowerCase()}! Answer this one before the timer runs out to block it.`, '.blockbox');
    blockTyped = ''; wordPos = 0; wordErr = 0;
    ui = 'block'; blockAt = performance.now(); blockLeft = 1;
    scene?.windup(); sfx.grumble();
    clearInterval(blockTimer);
    blockTimer = window.setInterval(() => {
      const k = (performance.now() - blockAt) / bl.limitMs;
      blockLeft = Math.max(0, 1 - k);
      // out of time: it lands
      if (k >= 1) submitBlock(true);
    }, 50);
  }
  async function submitBlock(timeout = false) {
    if (ui !== 'block' || !blk) return;
    clearInterval(blockTimer);
    const ms = performance.now() - blockAt;
    const ok = !timeout && (subject === 'math' ? !!blk.fact && Number(blockTyped) === answerOf(blk.fact) : wordErr === 0);
    if (subject === 'math' && blk.fact && !ok) say(timeout ? `Too slow! ${factText(blk.fact)} = ${answerOf(blk.fact)}` : `${factText(blk.fact)} = ${answerOf(blk.fact)}`, 'miss');
    closeTip('t-block');
    blk = null; ui = 'busy';
    await run(doBlock(b, ok, ms));
  }

  // ---------- the end ----------
  async function won(perfect: boolean) {
    ui = 'busy';
    sync();
    let o: BattleOutcome | null = null;
    game.update(pp => {
      o = applyBattle(pp, { node: node.id, subject, won: true, perfect, foe, ms: performance.now() - t0, answers: b.stats.answers + b.stats.blocks, right: b.stats.right, answered: b.answered, team: team.map(t => t.id), crystal: team.some(m => GLIMMER[m.id].power.kind === 'crystal'), treasureNose: gear?.kind === 'treasure', at: Date.now(), seed });
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
    ui = 'lost'; coach = null;
    game.update(pp => markSeen(pp, 'battle1', ...seen));
    scene?.lose();
    game.update(pp => { out = applyBattle(pp, { node: node.id, subject, won: false, perfect: false, foe, ms: performance.now() - t0, answers: b.stats.answers + b.stats.blocks, right: b.stats.right, answered: b.answered, team: team.map(t => t.id), crystal: false, treasureNose: false, at: Date.now(), seed }); });
  }
  function toMap() { game.go('adventure'); }
  function again() { game.battleKey++; }
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
  const RARE_WORDS: Record<string, string> = { common: 'Easy to find', uncommon: 'A bit harder to find', rare: 'Hard to find!', epic: 'Very hard to find!', legendary: 'One of a kind!', mythic: 'The rarest of all!' };
  const grumpPct = $derived((grump.current / Math.max(1, b.foe.max)) * 100);
  const sparkPct = $derived((spark.current / Math.max(1, b.sparkMax)) * 100);
  const strongEl = $derived(Object.entries(ELEMENT).find(([, v]) => v.beats === b.foe.element)?.[0] as Element);
</script>

<svelte:window onkeydown={onKey} />

<div class="battle" class:narrow>
  <div class="top">
    <button class="leave" onclick={toMap} aria-label="Leave the battle">‹</button>
    <div class="where"><small>{island.name}</small><b>{champion ? 'Champion battle' : `Battle ${node.n + 1}`}</b></div>
    <button class="helpbtn" onclick={() => { help = true; sfx.pop(); }} aria-label="How to play">?</button>
  </div>

  <!-- your energy over your buddy, its grumpy bar over it (on phones both sit at the top) -->
  <div class="bar spark" style:left={narrow ? '10px' : `${budPos.x * 100}%`} style:top={narrow ? '62px' : `${budPos.y * 100}%`}>
    <img class="bi" src="{base}game/icon-spark.webp" alt="" />
    <div class="bt"><span class="lab">Your energy</span><div class="track"><div class="fill" style:width="{sparkPct}%"></div></div><span class="num"><b>{sparkNow}</b> / {b.sparkMax}</span></div>
  </div>
  <div class="bar grump" class:champ={champion} style:left={narrow ? 'auto' : `${foePos.x * 100}%`} style:right={narrow ? '10px' : 'auto'} style:top={narrow ? '62px' : `${foePos.y * 100}%`}>
    <img class="bi" src="{base}game/icon-grump.webp" alt="" />
    <div class="bt"><span class="lab">{foeName} is grumpy</span><div class="track"><div class="fill" style:width="{grumpPct}%"></div></div><span class="num"><b>{grumpNow}</b> grumps left</span></div>
  </div>

  <div class="teamrow">
    <span class="bud" title={ROLE[role].text}><Critter friend={p0.buddy} size={narrow ? 34 : 44} round /><em><b>{FRIEND[p0.buddy].name}</b>{ROLE[role].name}</em></span>
    {#each team as m (m.id)}<span class="mate" title={GLIMMER[m.id].power.text(m.level)}><img src="{base}game/glimmers/{m.id}.webp" alt="" /><em><b>{GLIMMER[m.id].name}</b>{GLIMMER[m.id].power.name}</em></span>{/each}
  </div>

  <div class="stage" bind:this={stageEl}></div>

  {#each floats as f (f.id)}<div class="float {f.kind}" style:left="{f.x * 100}%" style:top="{f.y * 100}%">{f.text}</div>{/each}
  {#if toast}{#key toast.key}<div class="toast {toast.kind}">{toast.text}</div>{/key}{/if}
  {#if bigBanner}{#key bigBanner.key}<div class="big {bigBanner.kind}"><b>{bigBanner.text}</b>{#if bigBanner.sub}<small>{bigBanner.sub}</small>{/if}</div>{/key}{/if}

  <div class="bottom">
    {#if finaleN >= FINALE_AT && ui === 'pick'}
      <button class="finalebig" onclick={doTheFinale}><img src="{base}game/icon-finale.webp" alt="" /><span><b>Finale!</b><small>Tap for {FRIEND[p0.buddy].name}'s big move</small></span></button>
    {:else}
      <div class="meter" title="Five right in a row unlocks the Finale">
        <span class="ml">Finale</span>
        {#each Array(FINALE_AT) as _, i}<img class:on={i < finaleN} src="{base}game/icon-star.webp" alt="" />{/each}
      </div>
    {/if}

    {#if ui === 'pick' || ui === 'intro' || ui === 'loading'}
      <div class="cards" class:dim={ui !== 'pick'}>
        {#each cards as c, i (c.id)}
          <button class="card el-{c.element}" class:super={c.super} class:bloom={c.bloom} style:--d="{i * 0.08}s" onclick={() => pick(c)} disabled={ui !== 'pick'}>
            <img class="ci" src="{base}game/icon-{c.element}.webp" alt={ELEMENT[c.element].name} />
            <span class="ct"><b>{#if c.fact}{factText(c.fact)}{:else}{c.word}{/if}</b>
              {#if c.super}<em>⚡ Strong</em>{:else if c.bloom}<em class="bl">You know this one</em>{/if}</span>
          </button>
        {/each}
      </div>
      <div class="actions">
        <p class="hint">{ui === 'pick' ? (subject === 'math' ? 'Tap a card and answer it to cheer up ' + foeName + '!' : 'Type a word to cheer up ' + foeName + '!') : ''}</p>
        {#if swapOk && ui === 'pick'}<button class="swap" onclick={swapCards}>🔀 New cards</button>{/if}
      </div>
    {:else if ui === 'answer' && sel}
      <div class="answer el-{sel.element}">
        {#if subject === 'math'}
          {@const f = fact(sel)!}
          {#key shakeKey}<div class="eq" class:shake={shakeKey > 0}><span>{factText(f)} =</span><span class="box">{typed || ' '}</span></div>{/key}
          {#if glowOk && !glowText}<button class="glowbtn" onclick={askGlow}>💡 Hint from Spark Moth</button>{/if}
          {#if glowText}<p class="glow">💡 {glowText}</p>{/if}
          <NumPad ondigit={digit} onback={backspace} compact={narrow} />
        {:else}
          {#key shakeKey}<div class="word" class:shake={shakeKey > 0}>{#each sel.word!.split('') as ch, i}<span class:done={i < wordPos} class:next={i === wordPos}>{ch}</span>{/each}</div>{/key}
          <p class="ask">Type it! {wordErr ? `${wordErr} slip${wordErr === 1 ? '' : 's'}` : 'No slips so far'}</p>
        {/if}
        <button class="backbtn" onclick={back}>Pick a different card</button>
      </div>
    {:else if ui === 'block' && blk}
      <div class="blockbox">
        <div class="ring" style:--k={blockLeft}><span>{Math.max(0, Math.ceil(blockLeft * blk.limitMs / 1000))}</span></div>
        <div class="bq">
          <p><b>{blk.name}!</b> Answer fast to block it:</p>
          {#if blk.fact}<div class="eq small"><span>{factText(blk.fact)} =</span><span class="box">{blockTyped || ' '}</span></div>
          {:else}<div class="word small">{#each blk.word!.split('') as ch, i}<span class:done={i < wordPos} class:next={i === wordPos}>{ch}</span>{/each}</div>{/if}
        </div>
        {#if subject === 'math'}<NumPad ondigit={digit} onback={backspace} compact={narrow} />{/if}
      </div>
    {/if}
  </div>

  {#if ui === 'won' && out?.met}
    {@const m = out.met}
    <div class="reveal r-{m.rarity}">
      <div class="rays"></div>
      <div class="rtitle"><small>{GLIMMER[m.id].name} is happy again!</small><b>{RARITY[m.rarity].name}</b><em>{RARE_WORDS[m.rarity]}</em></div>
      <div class="rcard"><GlimmerCard id={m.id} width={narrow ? 160 : 210} level={m.level} shine /></div>
      <div class="rinfo" class:in={step >= 1}>
        {#if m.isNew}
          <h2>{GLIMMER[m.id].name} joined your team!</h2>
          <p class="pw"><b>In battles it helps you:</b> {GLIMMER[m.id].power.text(1)}</p>
        {:else}
          <h2>You already have {GLIMMER[m.id].name}</h2>
          <p class="pw">So yours got stronger{m.ups ? `: now level ${m.level}` : ''}! Find a new kind by playing other battles, or hatch an egg.</p>
        {/if}
      </div>
      <div class="rewards" class:in={step >= 2}>
        <span class="rw" title="Spend shells in the shop"><img src="{base}game/icon-shell.webp" alt="" />+{out.shells} shells</span>
        <span class="rw"><Critter friend={p0.buddy} size={30} round />+{out.xp.gained} friendship with {FRIEND[p0.buddy].name}</span>
        {#if out.egg}<span class="rw egg"><img src="{base}game/egg-{out.egg.rarity}.webp" alt="" />An egg! Practice to hatch it</span>{/if}
        {#each out.rewards as r}<span class="rw"><img src="{base}outfits/{r.id}.webp" alt="" onerror={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')} />New: {r.name}</span>{/each}
        {#each out.teamUps as u}<span class="rw">{GLIMMER[u.id].name} is now level {u.level}</span>{/each}
      </div>
      {#if out.islandDone}<div class="island-done">🌈 {island.name} is free of storms! The next island is open.</div>{/if}
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
      <h2>Out of energy!</h2>
      <p>{foeName} is still grumpy. Tip: when rain or a zap is coming, answer the quick one fast to block it.</p>
      <div class="rbtns in"><button class="btn" onclick={toMap}>Back to the map</button><button class="btn btn-primary" onclick={again}>Try again</button></div>
    </div>
  {/if}

  {#if coach}<Coach text={coach.text} at={coach.at} button={coach.button} onok={() => (coach = null)} />{/if}

  {#if help}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="helpbg" onclick={() => (help = false)}>
      <div class="helpcard card" onclick={(e) => e.stopPropagation()}>
        <h2>How to play</h2>
        <ul>
          <li><b>🎯 The goal:</b> cheer up {foeName}. When its grumpy bar reaches 0, it's happy again and joins your team.</li>
          <li><b>🃏 Cards:</b> tap one and answer it. Right answers cheer it up. Bigger answers cheer more.</li>
          <li><b>🌧️ Blocking:</b> when it sends rain or a zap, answer the quick one before the timer runs out.</li>
          <li><b>❤️ Energy:</b> you lose some when you don't block. If it runs out, you can try again.</li>
          <li><b>⭐ Finale:</b> five right in a row unlocks your buddy's big move.</li>
          <li><b>⚡ Strong cards</b> also calm its next rain and fill a Finale star.</li>
          <li><b>✨ Perfect Cheer:</b> answer exactly its grumpy number to finish: extra shells and an egg.</li>
        </ul>
        {#if team.length}<h3>Your team helps</h3><ul>{#each team as m}<li><b>{GLIMMER[m.id].name}:</b> {GLIMMER[m.id].power.text(m.level)}</li>{/each}</ul>{/if}
        <p class="muted small"><b>{FRIEND[p0.buddy].name} ({ROLE[role].name}):</b> {ROLE[role].text}{#if gear} <b>Outfit ({gear.name}):</b> {gear.text}{/if}</p>
        <button class="btn btn-primary" onclick={() => (help = false)}>Got it</button>
      </div>
    </div>
  {/if}
  <Confetti {burst} count={80} x={60} y={35} spread={1.6} />
</div>

<style>
  .battle { position: fixed; inset: 0; display: flex; flex-direction: column; pointer-events: none; font-family: var(--font-body); }
  .battle > * { pointer-events: auto; }
  .stage { flex: 1; min-height: 0; pointer-events: none; }
  .top { display: flex; align-items: center; gap: 10px; padding: 12px 16px 0; }
  .leave { width: 46px; height: 46px; border-radius: 50%; border: 0; background: rgba(255, 255, 255, .92); font: 600 30px/1 var(--font-ui); color: var(--ink2); cursor: pointer; box-shadow: var(--shadow-sm); }
  .where { display: flex; flex-direction: column; background: rgba(255, 255, 255, .9); border-radius: 16px; padding: 4px 14px; box-shadow: var(--shadow-sm); }
  .where small { font: 800 11px var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
  .where b { font: 600 18px var(--font-ui); color: var(--ink); }
  .helpbtn { margin-left: auto; width: 46px; height: 46px; border-radius: 50%; border: 0; background: #fff; font: 600 26px/1 var(--font-ui); color: var(--primary); cursor: pointer; box-shadow: 0 0 0 3px #ffd36b, var(--shadow-sm); }

  .bar { position: absolute; transform: translate(-50%, -100%); display: flex; align-items: center; gap: 6px; padding: 6px 14px 6px 6px; border-radius: 999px; background: linear-gradient(#ffffff, #eef2ff); box-shadow: 0 0 0 3px rgba(255, 255, 255, .9), 0 10px 24px -10px rgba(30, 20, 70, .55); min-width: 210px; z-index: 5; transition: left .1s linear, top .1s linear; }
  .narrow .bar { transform: none; min-width: 0; width: calc(50% - 18px); transition: none; }
  .bar .bi { width: 40px; height: 40px; flex: none; object-fit: contain; filter: drop-shadow(0 2px 3px rgba(0, 0, 0, .2)); }
  .bt { flex: 1; display: flex; flex-direction: column; gap: 3px; }
  .bt .lab { font: 600 15px var(--font-ui); color: var(--ink); line-height: 1; white-space: nowrap; }
  .bt .num { font: 700 12px var(--font-body); color: var(--muted); line-height: 1; }
  .bt .num b { font: 600 17px var(--font-ui); color: var(--ink); }
  .track { height: 12px; border-radius: 999px; background: #e6e2f2; overflow: hidden; box-shadow: inset 0 2px 3px rgba(40, 20, 80, .18); }
  .fill { height: 100%; border-radius: 999px; }
  .spark .fill { background: linear-gradient(90deg, #ff5e3a, #ffb52e, #ffe066); box-shadow: 0 0 10px #ffb52e; }
  .grump .fill { background: linear-gradient(90deg, #7a5cf5, #a98cff, #c9b8ff); box-shadow: 0 0 10px #a98cff; }
  .grump.champ { background: linear-gradient(#fff8e0, #ffeec2); box-shadow: 0 0 0 3px #ffd36b, 0 10px 24px -10px rgba(120, 80, 0, .5); }

  .teamrow { position: absolute; left: 16px; top: 70px; display: flex; flex-direction: column; gap: 8px; z-index: 4; }
  .narrow .teamrow { top: 128px; left: 10px; gap: 5px; }
  .teamrow > span { display: flex; align-items: center; gap: 8px; background: rgba(255, 255, 255, .9); border-radius: 999px; padding: 3px 14px 3px 3px; box-shadow: var(--shadow-sm); font: 700 12px var(--font-body); color: var(--muted); cursor: help; }
  .teamrow em { display: flex; flex-direction: column; line-height: 1.15; }
  .teamrow em b { font: 600 14px var(--font-ui); color: var(--ink); }
  .teamrow img { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; object-position: center 35%; background: #eef; }
  .narrow .teamrow img { width: 32px; height: 32px; }
  .teamrow em { font-style: normal; }
  .narrow .teamrow em { display: none; }
  .teamrow .gear img { object-fit: contain; background: #fff; }

  .float { position: absolute; transform: translate(-50%, -50%); font: 600 34px var(--font-ui); color: #fff; z-index: 8; pointer-events: none; animation: rise 1.5s cubic-bezier(.2, .8, .3, 1) forwards; -webkit-text-stroke: 1px rgba(40, 20, 80, .25); text-shadow: 0 3px 0 rgba(40, 20, 80, .35), 0 0 18px currentColor; white-space: nowrap; }
  .float.sun { color: #ffbf2e; } .float.tide { color: #3fa2ff; } .float.frost { color: #7fd6ff; } .float.leaf { color: #4fd17a; } .float.stone { color: #d6a46a; }
  .float.extra { font-size: 20px; color: #ffd166; } .float.heal { font-size: 22px; color: #5be38d; } .float.hurt { color: #ff5f6d; font-size: 32px; } .float.block { color: #7fe0ff; font-size: 26px; }
  .float.finale { font-size: 52px; color: #ff7ab8; }
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
  .swap { font: 700 14px var(--font-body); border: 0; border-radius: 999px; padding: 8px 14px; background: #fff; color: var(--ink2); cursor: pointer; box-shadow: var(--shadow-sm); }
  .actions { display: flex; align-items: center; gap: 12px; justify-content: center; }

  .cards { display: flex; gap: 16px; justify-content: center; width: min(1100px, 100%); }
  .cards.dim { opacity: .6; }
  .card { position: relative; flex: 1; max-width: 330px; display: flex; align-items: center; gap: 10px; padding: 12px 18px 12px 12px; border-radius: 30px; border: 4px solid #fff; cursor: pointer; box-shadow: 0 12px 24px -12px rgba(30, 20, 70, .6), inset 0 -8px 16px rgba(0, 0, 0, .08), inset 0 6px 10px rgba(255, 255, 255, .7); animation: cardin .5s var(--d) cubic-bezier(.2, 1.3, .4, 1) both, bob 3s calc(var(--d) * 4) ease-in-out infinite; transition: transform .15s; text-align: left; }
  .card:hover:not(:disabled) { transform: translateY(-6px) scale(1.03); }
  .card .ci { width: 70px; height: 70px; flex: none; object-fit: contain; filter: drop-shadow(0 4px 4px rgba(0, 0, 0, .18)); }
  .ct { display: flex; flex-direction: column; min-width: 0; }
  .ct em { align-self: flex-start; margin-top: 4px; font: 800 12px var(--font-body); font-style: normal; background: #fff; color: #d16a00; padding: 3px 9px; border-radius: 999px; }
  .ct em.bl { color: #c2348a; }
  .ct b { font: 600 clamp(28px, 3.4vw, 42px)/1.05 var(--font-ui); color: #2a1f45; white-space: nowrap; }
  .el-sun.card { background: linear-gradient(160deg, #fff6c4, #ffd36b); }
  .el-tide.card { background: linear-gradient(160deg, #e2f4ff, #8fd0ff); }
  .el-frost.card { background: linear-gradient(160deg, #f6f0ff, #c8b8ff); }
  .el-leaf.card { background: linear-gradient(160deg, #eaffe6, #9ee8a6); }
  .el-stone.card { background: linear-gradient(160deg, #fbf3e8, #e2c7a2); }
  .card.super { box-shadow: 0 0 0 3px #ffd36b, 0 0 22px #ffd36b, 0 12px 24px -12px rgba(30, 20, 70, .6); }
  .card.bloom::after { content: ''; position: absolute; inset: -4px; border-radius: 30px; box-shadow: 0 0 0 3px #ff9ad5, 0 0 18px #ff9ad5; pointer-events: none; }
  @keyframes cardin { from { opacity: 0; transform: translateY(60px) scale(.8); } }
  @keyframes bob { 50% { translate: 0 -4px; } }
  .hint { margin: 0; min-height: 22px; font: 600 19px var(--font-ui); color: #fff; text-shadow: 0 2px 6px rgba(20, 10, 50, .8); text-align: center; }

  .answer, .blockbox { width: min(1000px, 100%); display: flex; flex-direction: column; align-items: center; gap: 10px; background: rgba(255, 255, 255, .9); border-radius: 28px; padding: 14px 16px; box-shadow: 0 16px 40px -18px rgba(30, 20, 70, .6); animation: cardin .35s cubic-bezier(.2, 1.3, .4, 1) both; }
  .eq { display: flex; align-items: center; gap: 14px; font: 600 clamp(40px, 6vw, 64px)/1 var(--font-ui); color: var(--ink); }
  .eq.small { font-size: clamp(32px, 4.5vw, 48px); }
  .box { min-width: 1.6em; padding: 4px 14px; border-radius: 18px; background: #fff; box-shadow: inset 0 0 0 4px #a98cff, 0 0 0 6px #efe9ff; text-align: center; }
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
  .glowbtn { border: 0; border-radius: 999px; padding: 6px 14px; background: linear-gradient(90deg, #fff4c2, #ffe066); font: 700 14px var(--font-body); color: #7a5200; cursor: pointer; }
  .glow { margin: 0; max-width: 640px; text-align: center; font: 700 16px/1.35 var(--font-body); color: #7a5200; background: #fff8dc; border-radius: 14px; padding: 8px 14px; }
  .blockbox { flex-direction: row; flex-wrap: wrap; justify-content: center; background: linear-gradient(#fff5f6, #ffffff); box-shadow: 0 0 0 4px #ff9aa8, 0 16px 40px -18px rgba(120, 20, 50, .6); }
  .ring { width: 74px; height: 74px; border-radius: 50%; background: conic-gradient(#ff5f6d calc(var(--k) * 360deg), #f1e6ea 0); display: grid; place-items: center; flex: none; }
  .ring span { width: 56px; height: 56px; border-radius: 50%; background: #fff; display: grid; place-items: center; font: 600 28px var(--font-ui); color: #c22b48; }
  .bq { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .bq p { margin: 0; font: 600 20px var(--font-ui); color: #8a1f38; }
  .blockbox :global(.pad) { flex-basis: 100%; }

  .reveal { position: absolute; inset: 0; z-index: 20; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 20px; background: radial-gradient(circle at 50% 42%, rgba(255, 255, 255, .25), rgba(30, 20, 60, .55) 70%); }
  .rays { position: absolute; left: 50%; top: 40%; width: 1400px; height: 1400px; margin: -700px 0 0 -700px; background: repeating-conic-gradient(from 0deg, rgba(255, 255, 255, .22) 0 8deg, transparent 8deg 22deg); animation: spin 18s linear infinite; mask: radial-gradient(circle, #000 20%, transparent 60%); -webkit-mask: radial-gradient(circle, #000 20%, transparent 60%); pointer-events: none; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .rtitle { position: relative; text-align: center; animation: bigin .7s cubic-bezier(.2, 1.4, .4, 1) both; }
  .rtitle small { display: block; font: 600 24px var(--font-ui); color: #fff; text-shadow: 0 2px 8px rgba(0, 0, 0, .5); }
  .rtitle em { display: inline-block; margin-top: 6px; font: 700 15px var(--font-body); font-style: normal; color: var(--ink); background: #fff; padding: 3px 12px; border-radius: 999px; }
  .rtitle b { display: block; font: 600 clamp(52px, 9vw, 96px)/1 var(--font-ui); color: var(--rc, #fff); -webkit-text-stroke: 3px #fff; paint-order: stroke; text-shadow: 0 6px 0 rgba(0, 0, 0, .25), 0 0 50px var(--rc, #fff); }
  .r-common { --rc: #7d8494; } .r-uncommon { --rc: #3fbf73; } .r-rare { --rc: #2f8ef0; } .r-epic { --rc: #a061f0; } .r-legendary { --rc: #f0b21f; }
  .r-mythic { --rc: #ff5fb0; } .r-mythic .rtitle b { background: linear-gradient(90deg, #ff6fa8, #ffb44d, #ffe066, #6fe3a0, #5bb6ff, #a98cff); -webkit-background-clip: text; color: transparent; }
  .rcard { position: relative; animation: flipin .9s .3s cubic-bezier(.2, 1.2, .4, 1) both; }
  @keyframes flipin { 0% { opacity: 0; transform: perspective(800px) rotateY(180deg) scale(.4); } 100% { opacity: 1; transform: perspective(800px) rotateY(0) scale(1); } }
  .rinfo, .rewards, .rbtns { position: relative; opacity: 0; transform: translateY(14px); transition: opacity .4s, transform .4s; text-align: center; }
  .rinfo.in, .rewards.in, .rbtns.in { opacity: 1; transform: none; }
  .rinfo { background: rgba(255, 255, 255, .94); border-radius: 22px; padding: 10px 20px; max-width: 560px; }
  .rinfo h2 { margin: 0; font-size: 26px; }
  .pw { margin: 4px 0 0; font: 600 16px/1.35 var(--font-body); color: var(--ink2); }
  .qk { margin: 4px 0 0; font: 600 14px var(--font-body); color: var(--muted); font-style: italic; }
  .rewards { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; max-width: 720px; }
  .rw { display: flex; align-items: center; gap: 6px; background: #fff; border-radius: 999px; padding: 4px 14px 4px 4px; font: 700 15px var(--font-body); color: var(--ink); box-shadow: var(--shadow-sm); }
  .rw img { width: 34px; height: 34px; object-fit: contain; }
  .helpbg { position: absolute; inset: 0; z-index: 30; background: rgba(40, 28, 70, .4); display: grid; place-items: center; }
  .helpcard { width: min(560px, 92vw); max-height: 88vh; overflow: auto; padding: 18px 24px; display: flex; flex-direction: column; gap: 8px; }
  .helpcard h2 { margin: 0; } .helpcard h3 { margin: 6px 0 0; font-size: 20px; }
  .helpcard ul { margin: 0; padding-left: 4px; list-style: none; display: flex; flex-direction: column; gap: 6px; }
  .helpcard li { font: 600 15px/1.4 var(--font-body); color: var(--ink2); }
  .helpcard .btn { align-self: flex-end; }
  .small { font-size: 13px !important; }
  .rw.egg img { animation: eggbounce 1s ease-in-out infinite; }
  @keyframes eggbounce { 50% { transform: translateY(-4px) rotate(6deg); } }
  .island-done { position: relative; font: 600 22px var(--font-ui); color: #fff; background: linear-gradient(90deg, #ff7ab8, #ffb44d, #4fd17a, #3fa2ff); padding: 8px 20px; border-radius: 999px; box-shadow: 0 0 0 3px #fff; }
  .rbtns { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
  .lostbox { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 20; padding: 22px 26px; text-align: center; max-width: 92vw; width: 460px; }
  .lostbox h2 { margin: 0 0 6px; } .lostbox p { margin: 0 0 14px; font-weight: 600; color: var(--ink2); }

  .narrow .top { padding: 8px 10px 0; }
  .narrow .where b { font-size: 15px; }
  .narrow .weak span { display: none; }
  .narrow .bar { padding: 4px 8px 4px 4px; }
  .narrow .bar .bi { width: 30px; height: 30px; }
  .narrow .bt span { font-size: 13px; } .narrow .bt span b { font-size: 16px; }
  .narrow .bottom { padding: 4px 8px 10px; }
  .narrow .cards { gap: 6px; }
  .narrow .card { flex-direction: column; gap: 2px; padding: 8px 4px; border-radius: 22px; text-align: center; }
  .narrow .card .ci { width: 44px; height: 44px; }
  .narrow .ct em { align-self: center; font-size: 10px; padding: 2px 6px; }
  .narrow .teamrow em { display: none; }
  .narrow .bt .lab { font-size: 12px; } .narrow .bt .num { font-size: 10px; } .narrow .bt .num b { font-size: 14px; }
  .narrow .finalebig b { font-size: 22px; } .narrow .finalebig img { width: 40px; height: 40px; }
  .narrow .hint { font-size: 14px; }
  .narrow .ct b { font-size: 24px; }
  .narrow .meter img { width: 26px; height: 26px; }
  .narrow .finale { font-size: 16px; }
  .narrow .answer, .narrow .blockbox { padding: 10px; border-radius: 22px; }
  .narrow .chips button { width: 46px; height: 46px; font-size: 22px; }
  .narrow .hint { font-size: 12px; }
</style>
