<script lang="ts">
  // The Bonus Round: a stop on a side trail of every Adventure island (once a day each). Five quick
  // questions in a treasure room, from the same questions a battle on this island would ask (the facts and
  // skills you've met, or words for a typist). Every right answer drops a coin into the chest; at the end
  // the chest opens: stars like a practice round (paid the same way, engine/settle.ts) and the chest's own
  // prize (adventure/finds.ts).
  import { onMount, untrack } from 'svelte';
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { advView, ISLAND, mathPool, typingPool, type IslandId } from '../adventure/state';
  import { deal, newBattle, type Card } from '../adventure/battle';
  import { applyBonus, BONUS_QUESTIONS, bonusStars, type BonusOutcome } from '../adventure/finds';
  import { answerOf, opSign, type Fact } from '../math/facts';
  import { SKILL } from '../math/skills/registry';
  import { answerText } from '../math/skills/text';
  import type { Answer as SkillAnswer } from '../math/skills/types';
  import SkillPrompt from '../math/skills/ui/SkillPrompt.svelte';
  import SkillInput from '../math/skills/ui/SkillInput.svelte';
  import NumPad from '../math/ui/NumPad.svelte';
  import CloseButton from './CloseButton.svelte';
  import Confetti from './Confetti.svelte';
  import Stars from './Stars.svelte';
  import Critter from './Critter.svelte';

  type Props = { island: IslandId; onclose: () => void };
  let { island, onclose }: Props = $props();
  const base = import.meta.env.BASE_URL;
  const p0 = game.profile!;
  const isl = ISLAND[untrack(() => island)];
  // like a battle here: a math world is always its own math; the Sky Islands follow the player's choice
  const subject = isl.area ? 'math' : advView(p0).subject;
  const pool = subject === 'math' ? mathPool(p0, isl.area) : typingPool(p0);
  const deck = newBattle({ pool, seed: (Date.now() % 1e9) | 0, sparkMax: 99, role: 'heart', gear: null, team: [], foe: { glimmer: 'puddlepup', rarity: 'common', champion: false, element: 'sun', grump: 999, max: 999, hit: 0 }, flat: 1 });

  let phase = $state<'ask' | 'play' | 'done'>('ask');
  let q = $state<Card | null>(null);
  let n = $state(0);
  let marks = $state<(boolean | null)[]>(Array(BONUS_QUESTIONS).fill(null));
  let typed = $state('');
  let wordPos = $state(0);
  let shake = $state(0);
  let showRight = $state<string | null>(null);
  let coin = $state(0);
  let skFill = $state<{ kind: 'number'; text: string } | { kind: 'fraction'; n: string; d: string; focus: 'n' | 'd' | null } | null>(null);
  let out = $state<BonusOutcome | null>(null);
  let burst = $state(0);
  let lock = false;
  const t0 = performance.now();
  let shownAt = 0;
  const answered: { f: Fact; ok: boolean; thinkMs: number }[] = [];
  const skillAnswers: { key: string; ok: boolean; thinkMs: number }[] = [];
  let narrow = $state(innerWidth < 760);

  function next() {
    if (n >= BONUS_QUESTIONS) { finish(); return; }
    deal(deck);
    // a fact, a skill question or a word (never an open card)
    q = deck.cards.find(c => c.fact || c.item || c.word) ?? deck.cards[0];
    typed = ''; wordPos = 0; skFill = null; showRight = null; lock = false;
    shownAt = performance.now();
  }
  function start() { phase = 'play'; sfx.battleStart(); next(); }
  const factText = (f: Fact) => `${f.a} ${opSign(f)} ${f.b}`;

  function mark(ok: boolean, right: string) {
    if (lock) return;
    lock = true;
    marks[n] = ok;
    if (ok) { sfx.coin(); coin++; } else { sfx.miss(); shake++; showRight = right; }
    n++;
    setTimeout(next, ok ? 650 : 1500);
  }
  function digit(dg: string) {
    if (phase !== 'play' || !q?.fact || lock) return;
    typed += dg; sfx.click();
    const f = q.fact, ans = answerOf(f);
    if (typed.length >= String(ans).length) {
      const ok = Number(typed) === ans;
      answered.push({ f, ok, thinkMs: performance.now() - shownAt });
      mark(ok, `${factText(f)} = ${ans}`);
    }
  }
  function backspace() { typed = typed.slice(0, -1); }
  function itemAnswer(given: SkillAnswer) {
    const it = q?.item;
    if (!it || lock) return;
    const ok = SKILL[it.skill]?.check(it, given) ?? false;
    skillAnswers.push({ key: it.key, ok, thinkMs: performance.now() - shownAt });
    mark(ok, `It's ${answerText(it)}`);
  }
  function onKey(e: KeyboardEvent) {
    if (phase === 'ask') { if (e.key === 'Enter') { e.preventDefault(); start(); } else if (e.key === 'Escape') onclose(); return; }
    if (phase === 'done') { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); onclose(); } return; }
    if (e.key === 'Escape') { onclose(); return; }
    if (!q || q.item) return;
    if (q.fact) {
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); digit(e.key); }
      else if (e.key === 'Backspace') { e.preventDefault(); backspace(); }
      return;
    }
    const w = q.word;
    if (!w || e.key.length !== 1 || lock) return;
    e.preventDefault();
    if (e.key === w[wordPos]) { wordPos++; sfx.click(); if (wordPos >= w.length) mark(true, w); }
    else { shake++; sfx.slip(); }
  }

  function finish() {
    q = null;
    const right = marks.filter(Boolean).length;
    let o: BonusOutcome | null = null;
    game.update(pp => { o = applyBonus(pp, { island, at: Date.now(), ms: performance.now() - t0, right, answers: BONUS_QUESTIONS, answered, skillAnswers }); });
    out = o;
    phase = 'done';
    setTimeout(() => { sfx.treasure(stars >= 3 ? 8 : 5); burst++; }, 350);
  }
  const stars = $derived(bonusStars(marks.filter(Boolean).length));
  onMount(() => { const r = () => (narrow = innerWidth < 760); addEventListener('resize', r); return () => removeEventListener('resize', r); });
</script>

<svelte:window onkeydown={onKey} />

<div class="bonus" class:narrow role="dialog" aria-label="Bonus Round" style:background-image="url({base}game/bonus-room.webp)">
  <div class="top">
    <div class="tt"><small>{isl.name}</small><h2>Bonus Round</h2></div>
    <div class="coins" aria-label="Your answers">{#each marks as m, i (i)}<span class:ok={m === true} class:miss={m === false} class:now={phase === 'play' && i === n}><img src="{base}treasures/gold.webp" alt="" /></span>{/each}</div>
    <span class="x"><CloseButton onclick={onclose} size={40} label="Back to the map" /></span>
  </div>

  <div class="room">
    {#if phase === 'ask'}
      <div class="card intro">
        <img class="chestbig" src="{base}game/chest.webp" alt="" />
        <h3>Fill the treasure chest!</h3>
        <p>Answer {BONUS_QUESTIONS} quick questions. Every right one drops a coin in the chest, and at the end it opens. One Bonus Round on each island a day.</p>
        <button class="btn btn-primary big" onclick={start}>Start!</button>
      </div>
    {:else if phase === 'play'}
      <div class="stagebox">
        <div class="buddy"><Critter friend={p0.buddy} size={narrow ? 110 : 170} mood={showRight ? 'idle' : 'joy'} /></div>
        <img class="chest" class:gulp={coin > 0} src="{base}game/chest.webp" alt="" />
        {#key coin}{#if coin}<img class="fly" src="{base}treasures/gold.webp" alt="" />{/if}{/key}
      </div>
      {#if q}
        {#key shake}
          <div class="card ask" class:shake={shake > 0}>
            {#if q.item}
              <p class="say">{q.item.ask}</p>
              <SkillPrompt parts={q.item.prompt} fill={skFill} size={narrow ? 32 : 44} picSize={narrow ? 90 : 120} onpick={(w) => { if (skFill?.kind === 'fraction') skFill = { ...skFill, focus: w }; }} />
            {:else if q.fact}
              <div class="eq"><span>{factText(q.fact)} =</span><span class="box">{typed || ' '}</span></div>
            {:else if q.word}
              <div class="word">{#each q.word.split('') as ch, i (i)}<span class:done={i < wordPos} class:next={i === wordPos}>{ch}</span>{/each}</div>
              <p class="say">Type it!</p>
            {/if}
            {#if showRight}<p class="right">{showRight}</p>{/if}
          </div>
        {/key}
        <div class="input">
          {#if q.item}{#key q.id}<SkillInput item={q.item} compact={narrow} bind:fill={skFill} onanswer={itemAnswer} disabled={!!showRight} />{/key}
          {:else if q.fact}<NumPad ondigit={digit} onback={backspace} compact={narrow} disabled={!!showRight} />{/if}
        </div>
      {/if}
    {:else}
      <div class="card result">
        <img class="chestbig open" src="{base}game/chest-open.webp" alt="" />
        <h3>{stars === 3 ? 'All five! A full chest!' : stars ? 'The chest opens!' : 'A few coins for you!'}</h3>
        <Stars n={stars} size={46} animate />
        {#if out}
          <p class="won">+{out.settled.shells + out.chest.shells} shells{out.chest.egg ? ' and an egg!' : ''}</p>
          {#if out.chest.egg}<img class="egg" src="{base}game/egg-{out.chest.egg.rarity}.webp" alt="" />{/if}
          {#if out.settled.eggsReady.length}<p class="small">An egg is ready to hatch!</p>{/if}
        {:else}<p class="won">You played this one today already.</p>{/if}
        <button class="btn btn-primary big" onclick={onclose}>Back to the map</button>
      </div>
    {/if}
  </div>
  <Confetti {burst} count={70} x={50} y={45} />
</div>

<style>
  .bonus { position: fixed; inset: 0; z-index: 40; display: flex; flex-direction: column; background: #3a2a1a center / cover no-repeat; animation: fade .25s; }
  @keyframes fade { from { opacity: 0; } }
  .top { display: flex; align-items: center; gap: 14px; padding: 10px 16px; background: linear-gradient(rgba(60, 35, 10, .55), rgba(60, 35, 10, 0)); }
  .tt small { font: 800 12px var(--font-body); letter-spacing: .06em; text-transform: uppercase; color: #ffe39a; }
  .tt h2 { margin: 0; font-size: 30px; color: #fff; text-shadow: 0 2px 8px rgba(60, 30, 0, .7); }
  .coins { display: flex; gap: 6px; margin-left: auto; }
  .coins span { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; background: rgba(255, 255, 255, .35); box-shadow: inset 0 0 0 3px rgba(255, 255, 255, .7); }
  .coins img { width: 34px; height: 34px; object-fit: contain; filter: grayscale(1) opacity(.35); transition: filter .3s, transform .3s; }
  .coins .ok img { filter: none; transform: scale(1.1); }
  .coins .miss { background: rgba(255, 140, 160, .35); }
  .coins .now { box-shadow: inset 0 0 0 3px #ffd36b, 0 0 12px #ffd36b; }
  .x { display: grid; }
  .room { flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 8px 12px 14px; }
  .card { background: rgba(255, 255, 255, .96); border-radius: 26px; box-shadow: 0 0 0 4px #ffd36b, 0 16px 40px -12px rgba(60, 30, 0, .6); }
  .intro, .result { width: min(480px, 94vw); padding: 18px 24px 22px; display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; animation: pop .35s cubic-bezier(.3, .8, .4, 1.4); }
  .intro h3, .result h3 { margin: 0; font-size: 26px; }
  .intro p { margin: 0; font: 600 16px/1.45 var(--font-body); color: var(--ink2); }
  .chestbig { width: 150px; height: 130px; object-fit: contain; filter: drop-shadow(0 8px 10px rgba(60, 30, 0, .35)); }
  .chestbig.open { width: 180px; height: 160px; animation: burstin .6s cubic-bezier(.3, .8, .4, 1.6); }
  @keyframes burstin { from { transform: scale(.4) rotate(-8deg); } }
  @keyframes pop { from { transform: scale(.9); opacity: 0; } }
  .won { margin: 0; font: 600 22px var(--font-ui); color: #a86a00; }
  .small { margin: 0; font: 700 14px var(--font-body); color: var(--ink2); }
  .egg { width: 60px; height: 72px; object-fit: contain; animation: burstin .6s .3s both cubic-bezier(.3, .8, .4, 1.6); }
  .big { font-size: 22px; padding: 12px 24px; }

  .stagebox { position: relative; display: flex; align-items: flex-end; gap: 10px; }
  .chest { width: 130px; height: 110px; object-fit: contain; filter: drop-shadow(0 10px 10px rgba(60, 30, 0, .4)); }
  .chest.gulp { animation: gulp .4s; }
  @keyframes gulp { 40% { transform: scale(1.08, .92); } }
  .fly { position: absolute; right: 40px; bottom: 60px; width: 44px; height: 44px; animation: drop .55s ease-in forwards; pointer-events: none; }
  @keyframes drop { 0% { transform: translate(0, -150px) scale(1.3); opacity: 1; } 85% { opacity: 1; } 100% { transform: translate(0, 10px) scale(.6); opacity: 0; } }
  .buddy { filter: drop-shadow(0 8px 6px rgba(40, 20, 10, .45)); }
  .ask { padding: 16px 26px; display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: min(420px, 92vw); max-width: 94vw; }
  .ask.shake { animation: shk .35s; }
  @keyframes shk { 25% { translate: -8px 0; } 75% { translate: 8px 0; } }
  .say { margin: 0; font: 700 16px var(--font-body); color: var(--ink2); }
  .right { margin: 0; font: 600 20px var(--font-ui); color: #b02a48; }
  .eq { display: flex; align-items: center; gap: 14px; font: 600 clamp(38px, 6vw, 60px)/1 var(--font-ui); color: var(--ink); }
  .box { min-width: 1.6em; padding: 4px 14px; border-radius: 18px; background: #fff; box-shadow: inset 0 0 0 4px #ffc93d, 0 0 0 6px #fff3c4; text-align: center; }
  .word { display: flex; gap: 4px; font: 600 clamp(40px, 7vw, 66px)/1 var(--font-ui); }
  .word span { color: #b8b0cc; padding: 0 2px; border-bottom: 5px solid transparent; }
  .word span.done { color: var(--ink); }
  .word span.next { color: var(--primary); border-bottom-color: var(--primary); }
  .input { background: rgba(255, 255, 255, .9); border-radius: 22px; padding: 8px 10px; box-shadow: 0 10px 24px -12px rgba(60, 30, 0, .5); max-width: 96vw; }
  .input:empty { display: none; }
  .narrow .top { padding: 8px 10px; gap: 8px; }
  .narrow .tt h2 { font-size: 22px; }
  .narrow .coins { gap: 3px; }
  .narrow .coins span { width: 30px; height: 30px; }
  .narrow .coins img { width: 25px; height: 25px; }
  .narrow .chest { width: 96px; height: 82px; }
</style>
