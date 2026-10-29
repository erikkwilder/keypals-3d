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
  import { advOf, applyBattle, foeFor, ISLAND, mathPool, NODE, teamOf, typingPool, type BattleOutcome } from '../adventure/state';
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
    bigBanner = { text: champion ? `Champion of ${island.name}!` : 'A Grumble!', sub: champion ? 'A huge storm cloud with a Legendary Glimmer inside.' : 'Something is glowing inside. Cheer it up to find out what!', kind: champion ? 'champ' : 'intro', key: Date.now() };
    setTimeout(() => { bigBanner = null; sync(); ui = 'pick'; }, champion ? 2600 : 2000);
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
          else if (e.super) say(`Super! ${ELEMENT[e.card.element].name} ${ELEMENT[e.card.element].verb} ${ELEMENT[b.foe.element].name}.`, 'super');
        } else { sfx.miss(); say(subject === 'math' && e.card.fact ? `Not quite: ${factText(e.card.fact)} = ${answerOf(e.card.fact)}` : 'Not quite!', 'miss'); }
        sync();
      } else if (e.k === 'extra') {
        const slot = e.id ? team.findIndex(m => m.id === e.id) : -1;
        await scene?.extra(slot, e.id ? GLIMMER[e.id].element : 'sun');
        sfx.pop(); float(slot === 1 ? 'team1' : slot === 0 ? 'team0' : 'buddy', `${e.what} −${e.value}`, 'extra');
        float('foe', `−${e.value}`, 'extra');
        sync();
      } else if (e.k === 'heal') {
        const slot = e.id ? team.findIndex(m => m.id === e.id) : -1;
        scene?.heal(slot); sfx.heal();
        float('buddy', `+${e.value} ${e.what}`, 'heal'); sync();
        await sleep(300);
      } else if (e.k === 'freeze') { scene?.freeze(team.findIndex(m => m.id === e.id)); sfx.freeze(); say(`${GLIMMER[e.id].name} froze the Grumble!`, 'super'); await sleep(400); }
      else if (e.k === 'dazzle') { scene?.dazzle(); }
      else if (e.k === 'streakKept') { say(`${GLIMMER[e.id].name} kept your streak going!`, 'good'); }
      else if (e.k === 'aurora') { scene?.aurora(); sfx.reveal(3); say('Aurora! Your Finale is ready.', 'super'); await sleep(600); }
      else if (e.k === 'finaleReady') { sfx.badge(); say('Finale ready! Tap it when you like.', 'good'); }
      else if (e.k === 'finale') { sfx.hit(1); float('foe', `−${e.value}`, 'finale'); sync(); }
      else if (e.k === 'mischief') {
        if (e.result === 'skip') {
          say(e.why === 'frozen' ? 'Frozen! The Grumble can\'t move.' : e.why === 'Hover' ? 'Hover! You floated right over it.' : `${e.why} bounced it off!`, 'good');
          await scene?.mischief(e.kind, 'skip', e.why);
        } else {
          if (e.kind === 'zap') sfx.zap(); else sfx.whoosh();
          await scene?.mischief(e.kind, e.result);
          if (e.damage === 0) { sfx.shield(true); float('buddy', 'Blocked!', 'block'); }
          else { if (e.result === 'half') sfx.shield(false); sfx.ouch(); float('buddy', `−${e.damage}`, 'hurt'); }
          sync();
        }
      } else if (e.k === 'secondwind') { scene?.heal(team.findIndex(m => GLIMMER[m.id].power.kind === 'secondwind')); sfx.heal(); say('Sky Whale sings your Spark back up!', 'super'); float('buddy', `+${e.value}`, 'heal'); sync(); }
      else if (e.k === 'won') { await won(e.perfect); return; }
      else if (e.k === 'lost') { lost(); return; }
    }
    sync();
    if (b.phase === 'block') startBlock();
    else if (b.phase === 'pick') { ui = 'pick'; swapOk = role === 'trick' && !b.used.swap; }
    void fromFinale;
  }

  function startBlock() {
    const bl = b.block!;
    blk = { name: bl.name, fact: bl.fact, word: bl.word, limitMs: bl.limitMs };
    blockTyped = ''; wordPos = 0; wordErr = 0;
    ui = 'block'; blockAt = performance.now(); blockLeft = 1;
    scene?.windup(); sfx.grumble();
    clearInterval(blockTimer);
    blockTimer = window.setInterval(() => {
      const k = (performance.now() - blockAt) / bl.limitMs;
      blockLeft = Math.max(0, 1 - k);
      // if nothing comes at all, the mischief lands after a while
      if (k > 3) submitBlock(true);
    }, 50);
  }
  async function submitBlock(timeout = false) {
    if (ui !== 'block' || !blk) return;
    clearInterval(blockTimer);
    const ms = performance.now() - blockAt;
    const ok = !timeout && (subject === 'math' ? !!blk.fact && Number(blockTyped) === answerOf(blk.fact) : wordErr === 0);
    if (subject === 'math' && blk.fact && !ok && !timeout) say(`${factText(blk.fact)} = ${answerOf(blk.fact)}`, 'miss');
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
    bigBanner = null; toast = null;
    await scene?.cheerUp(res.met.id, res.met.rarity);
    sfx.reveal(rarityRank(res.met.rarity));
    burst++;
    out = res; step = 0; ui = 'won';
    setTimeout(() => (step = 1), 1400);
    setTimeout(() => (step = 2), 2600);
  }
  function lost() {
    ui = 'lost';
    scene?.lose();
    game.update(pp => { out = applyBattle(pp, { node: node.id, subject, won: false, perfect: false, foe, ms: performance.now() - t0, answers: b.stats.answers + b.stats.blocks, right: b.stats.right, answered: b.answered, team: team.map(t => t.id), crystal: false, treasureNose: false, at: Date.now(), seed }); });
  }
  function toMap() { game.go('adventure'); }
  function again() { game.battleKey++; }
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
  const grumpPct = $derived((grump.current / Math.max(1, b.foe.max)) * 100);
  const sparkPct = $derived((spark.current / Math.max(1, b.sparkMax)) * 100);
  const strongEl = $derived(Object.entries(ELEMENT).find(([, v]) => v.beats === b.foe.element)?.[0] as Element);
</script>

<svelte:window onkeydown={onKey} />

<div class="battle" class:narrow>
  <div class="top">
    <button class="leave" onclick={toMap} aria-label="Leave the battle">‹</button>
    <div class="where"><small>{island.name}</small><b>{champion ? 'Champion' : `Battle ${node.n + 1}`}</b></div>
    <div class="weak" title="Strong against this Grumble"><span>Weak to</span><img src="{base}game/icon-{strongEl}.webp" alt={ELEMENT[strongEl].name} /></div>
  </div>

  <!-- the two bars float over the buddy and the Grumble (on phones they sit at the top) -->
  <div class="bar spark" style:left={narrow ? '12px' : `${budPos.x * 100}%`} style:top={narrow ? '64px' : `${budPos.y * 100}%`}>
    <img class="bi" src="{base}game/icon-spark.webp" alt="" />
    <div class="bt"><span>Spark <b>{sparkNow}</b><i>/{b.sparkMax}</i></span><div class="track"><div class="fill" style:width="{sparkPct}%"></div></div></div>
  </div>
  <div class="bar grump" class:champ={champion} style:left={narrow ? 'auto' : `${foePos.x * 100}%`} style:right={narrow ? '12px' : 'auto'} style:top={narrow ? '64px' : `${foePos.y * 100}%`}>
    <img class="bi" src="{base}game/icon-grump.webp" alt="" />
    <div class="bt"><span>Grump <b>{grumpNow}</b></span><div class="track"><div class="fill" style:width="{grumpPct}%"></div></div></div>
  </div>

  <div class="teamrow">
    <span class="bud"><Critter friend={p0.buddy} size={narrow ? 38 : 50} round /><em title={ROLE[role].text}>{ROLE[role].name}</em></span>
    {#each team as m (m.id)}<span class="mate" title="{GLIMMER[m.id].name}: {GLIMMER[m.id].power.text(m.level)}"><img src="{base}game/glimmers/{m.id}.webp" alt="" /><em>{GLIMMER[m.id].power.name}</em></span>{/each}
    {#if gear}<span class="gear" title={gear.text}><img src="{base}outfits/{outfit}.webp" alt="" /><em>{gear.name}</em></span>{/if}
  </div>

  <div class="stage" bind:this={stageEl}></div>

  {#each floats as f (f.id)}<div class="float {f.kind}" style:left="{f.x * 100}%" style:top="{f.y * 100}%">{f.text}</div>{/each}
  {#if toast}{#key toast.key}<div class="toast {toast.kind}">{toast.text}</div>{/key}{/if}
  {#if bigBanner}{#key bigBanner.key}<div class="big {bigBanner.kind}"><b>{bigBanner.text}</b>{#if bigBanner.sub}<small>{bigBanner.sub}</small>{/if}</div>{/key}{/if}

  <div class="bottom">
    <!-- the Finale meter and buttons -->
    <div class="meter" class:full={finaleN >= FINALE_AT}>
      {#each Array(FINALE_AT) as _, i}<img class:on={i < finaleN} src="{base}game/icon-star.webp" alt="" />{/each}
      {#if finaleN >= FINALE_AT && ui === 'pick'}<button class="finale" onclick={doTheFinale}><img src="{base}game/icon-finale.webp" alt="" />Finale!</button>{/if}
      {#if swapOk && ui === 'pick'}<button class="swap" onclick={swapCards}>Swap cards</button>{/if}
    </div>

    {#if ui === 'pick' || ui === 'intro' || ui === 'loading'}
      <div class="cards" class:dim={ui !== 'pick'}>
        {#each cards as c, i (c.id)}
          <button class="card el-{c.element}" class:super={c.super} class:bloom={c.bloom} style:--d="{i * 0.08}s" onclick={() => pick(c)} disabled={ui !== 'pick'}>
            <img class="ci" src="{base}game/icon-{c.element}.webp" alt="" />
            <span class="ct"><small>{c.name}{#if c.super}<em>Super!</em>{/if}{#if c.bloom}<em class="bl">In bloom</em>{/if}</small>
              <b>{#if c.fact}{factText(c.fact)}{:else if c.open}{c.open.a} {opSign(c.open.op)} ?{:else}{c.word}{/if}</b></span>
          </button>
        {/each}
      </div>
      <p class="hint">{ui === 'pick' ? (subject === 'math' ? 'Pick a power. The number you make cheers it up: land on exactly 0 for a Perfect Cheer!' : 'Type a word to cast it. Its letters cheer it up: match the Grump exactly for a Perfect Cheer!') : ''}</p>
    {:else if ui === 'answer' && sel}
      <div class="answer el-{sel.element}">
        {#if sel.open && choice === null}
          <p class="ask">Grump is <b>{grumpNow}</b>. Pick the number: <b>{sel.open.a} {opSign(sel.open.op)} ?</b></p>
          <div class="chips">{#each Array.from({ length: sel.open.max + 1 }, (_, k) => k).filter(k => sel!.open!.op !== 'x' || k > 0) as k}<button class:hit={(sel.open.op === 'x' ? sel.open.a * k : sel.open.a + k) === grumpNow} onclick={() => choose(k)}>{k}</button>{/each}</div>
        {:else if subject === 'math'}
          {@const f = fact(sel)!}
          {#key shakeKey}<div class="eq" class:shake={shakeKey > 0}><span>{factText(f)} =</span><span class="box">{typed || ' '}</span></div>{/key}
          {#if glowOk && !glowText}<button class="glowbtn" onclick={askGlow}>✨ Ask Spark Moth</button>{/if}
          {#if glowText}<p class="glow">✨ {glowText}</p>{/if}
          <NumPad ondigit={digit} onback={backspace} compact={narrow} />
        {:else}
          {#key shakeKey}<div class="word" class:shake={shakeKey > 0}>{#each sel.word!.split('') as ch, i}<span class:done={i < wordPos} class:next={i === wordPos}>{ch}</span>{/each}</div>{/key}
          <p class="ask">Type it! {wordErr ? `${wordErr} slip${wordErr === 1 ? '' : 's'}` : 'No slips so far'}</p>
        {/if}
        <button class="backbtn" onclick={back}>Pick another card</button>
      </div>
    {:else if ui === 'block' && blk}
      <div class="blockbox">
        <div class="ring" style:--k={blockLeft}><span>{Math.ceil(blockLeft * blk.limitMs / 1000)}</span></div>
        <div class="bq">
          <p><b>{blk.name}!</b> Block it, quick:</p>
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
      <div class="rtitle"><small>{m.shimmered ? 'It shimmered into' : 'You cheered up'}</small><b>{RARITY[m.rarity].name}{m.shimmered ? '!' : ''}</b></div>
      <div class="rcard" class:in={step >= 0}><GlimmerCard id={m.id} width={narrow ? 170 : 230} level={m.level} shine /></div>
      <div class="rinfo" class:in={step >= 1}>
        <h2>{GLIMMER[m.id].name}{m.isNew ? ' joined your team!' : ''}</h2>
        {#if m.isNew}<p class="pw"><b>{GLIMMER[m.id].power.name}:</b> {GLIMMER[m.id].power.text(1)}</p><p class="qk">{GLIMMER[m.id].quirk}</p>
        {:else}<p class="pw">You have one already: it turned into stardust{m.ups ? `, and ${GLIMMER[m.id].name} grew to level ${m.level}` : ''}!</p>{/if}
      </div>
      <div class="rewards" class:in={step >= 2}>
        <span class="rw"><img src="{base}game/icon-shell.webp" alt="" />+{out.shells} shells</span>
        <span class="rw"><Critter friend={p0.buddy} size={32} round />+{out.xp.gained} friendship</span>
        {#if out.egg}<span class="rw egg"><img src="{base}game/egg-{out.egg.rarity}.webp" alt="" />{RARITY[out.egg.rarity].name} egg{out.eggWhere === 'nest' ? ' (in the nest)' : ''}</span>{/if}
        {#each out.rewards as r}<span class="rw"><img src="{base}outfits/{r.id}.webp" alt="" onerror={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')} />{r.name} unlocked</span>{/each}
        {#each out.teamUps as u}<span class="rw">{GLIMMER[u.id].name} reached level {u.level}</span>{/each}
      </div>
      {#if out.islandDone}<div class="island-done">🌈 {island.name} is free of storms!</div>{/if}
      <div class="rbtns" class:in={step >= 2}>
        <button class="btn" onclick={again}>Battle again</button>
        <button class="btn btn-primary" onclick={toMap}>Back to the map <span class="kbd">enter</span></button>
      </div>
    </div>
  {:else if ui === 'won'}
    <div class="reveal"><div class="rbtns in"><button class="btn btn-primary" onclick={toMap}>Back to the map</button></div></div>
  {/if}
  {#if ui === 'lost'}
    <div class="lostbox card">
      <h2>The Grumble drifted away…</h2>
      <p>{FRIEND[p0.buddy].name} needs a rest. Blocking saves Spark: answer the quick ones fast!</p>
      <div class="rbtns in"><button class="btn" onclick={toMap}>Back to the map</button><button class="btn btn-primary" onclick={again}>Try again</button></div>
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
  .weak { margin-left: auto; display: flex; align-items: center; gap: 6px; background: rgba(255, 255, 255, .9); border-radius: 999px; padding: 4px 6px 4px 12px; box-shadow: var(--shadow-sm); font: 800 12px var(--font-body); color: var(--ink2); }
  .weak img { width: 30px; height: 30px; }

  .bar { position: absolute; transform: translate(-50%, -100%); display: flex; align-items: center; gap: 6px; padding: 6px 14px 6px 6px; border-radius: 999px; background: linear-gradient(#ffffff, #eef2ff); box-shadow: 0 0 0 3px rgba(255, 255, 255, .9), 0 10px 24px -10px rgba(30, 20, 70, .55); min-width: 210px; z-index: 5; transition: left .1s linear, top .1s linear; }
  .narrow .bar { transform: none; min-width: 0; width: calc(50% - 18px); transition: none; }
  .bar .bi { width: 40px; height: 40px; flex: none; filter: drop-shadow(0 2px 3px rgba(0, 0, 0, .2)); }
  .bt { flex: 1; display: flex; flex-direction: column; gap: 3px; }
  .bt span { font: 600 17px var(--font-ui); color: var(--ink); line-height: 1; }
  .bt span b { font-size: 21px; } .bt span i { font-style: normal; font-size: 13px; color: var(--muted); }
  .track { height: 12px; border-radius: 999px; background: #e6e2f2; overflow: hidden; box-shadow: inset 0 2px 3px rgba(40, 20, 80, .18); }
  .fill { height: 100%; border-radius: 999px; }
  .spark .fill { background: linear-gradient(90deg, #ff5e3a, #ffb52e, #ffe066); box-shadow: 0 0 10px #ffb52e; }
  .grump .fill { background: linear-gradient(90deg, #7a5cf5, #a98cff, #c9b8ff); box-shadow: 0 0 10px #a98cff; }
  .grump.champ { background: linear-gradient(#fff8e0, #ffeec2); box-shadow: 0 0 0 3px #ffd36b, 0 10px 24px -10px rgba(120, 80, 0, .5); }

  .teamrow { position: absolute; left: 16px; top: 70px; display: flex; flex-direction: column; gap: 8px; z-index: 4; }
  .narrow .teamrow { top: 128px; left: 10px; gap: 5px; }
  .teamrow > span { display: flex; align-items: center; gap: 6px; background: rgba(255, 255, 255, .88); border-radius: 999px; padding: 3px 12px 3px 3px; box-shadow: var(--shadow-sm); font: 700 12px var(--font-body); color: var(--ink2); }
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
  .meter img { width: 34px; height: 34px; filter: grayscale(1) brightness(.55); transition: filter .3s, transform .3s; }
  .meter img.on { filter: none; transform: scale(1.08); }
  .meter.full { animation: pulse 1s ease-in-out infinite; }
  @keyframes pulse { 50% { box-shadow: 0 0 0 3px #fff, 0 0 30px #ff7ab8; } }
  .finale { margin-left: 8px; display: flex; align-items: center; gap: 6px; font: 600 20px var(--font-ui); color: #fff; border: 0; border-radius: 999px; padding: 6px 16px 6px 8px; background: linear-gradient(135deg, #ff6fb8, #b46bff); box-shadow: 0 0 0 3px #fff; cursor: pointer; animation: wob .8s ease-in-out infinite; }
  .finale img { width: 34px; height: 34px; }
  @keyframes wob { 50% { transform: scale(1.07) rotate(-2deg); } }
  .swap { margin-left: 8px; font: 700 13px var(--font-body); border: 0; border-radius: 999px; padding: 7px 12px; background: #fff; color: var(--ink2); cursor: pointer; }

  .cards { display: flex; gap: 16px; justify-content: center; width: min(1100px, 100%); }
  .cards.dim { opacity: .6; }
  .card { position: relative; flex: 1; max-width: 330px; display: flex; align-items: center; gap: 10px; padding: 12px 18px 12px 12px; border-radius: 30px; border: 4px solid #fff; cursor: pointer; box-shadow: 0 12px 24px -12px rgba(30, 20, 70, .6), inset 0 -8px 16px rgba(0, 0, 0, .08), inset 0 6px 10px rgba(255, 255, 255, .7); animation: cardin .5s var(--d) cubic-bezier(.2, 1.3, .4, 1) both, bob 3s calc(var(--d) * 4) ease-in-out infinite; transition: transform .15s; text-align: left; }
  .card:hover:not(:disabled) { transform: translateY(-6px) scale(1.03); }
  .card .ci { width: 74px; height: 74px; flex: none; filter: drop-shadow(0 4px 4px rgba(0, 0, 0, .18)); }
  .ct { display: flex; flex-direction: column; min-width: 0; }
  .ct small { font: 600 18px var(--font-ui); color: rgba(40, 25, 70, .75); display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .ct small em { font: 800 11px var(--font-body); font-style: normal; background: #fff; color: #d16a00; padding: 2px 7px; border-radius: 999px; }
  .ct small em.bl { color: #c2348a; }
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
  .hint { margin: 0; min-height: 20px; font: 700 14px var(--font-body); color: #fff; text-shadow: 0 1px 4px rgba(20, 10, 50, .7); text-align: center; }

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
  .rtitle small { display: block; font: 600 22px var(--font-ui); color: #fff; text-shadow: 0 2px 8px rgba(0, 0, 0, .5); }
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
  .narrow .ct small { font-size: 12px; justify-content: center; }
  .narrow .ct small em { display: none; }
  .narrow .ct b { font-size: 24px; }
  .narrow .meter img { width: 26px; height: 26px; }
  .narrow .finale { font-size: 16px; }
  .narrow .answer, .narrow .blockbox { padding: 10px; border-radius: 22px; }
  .narrow .chips button { width: 46px; height: 46px; font-size: 22px; }
  .narrow .hint { font-size: 12px; }
</style>
