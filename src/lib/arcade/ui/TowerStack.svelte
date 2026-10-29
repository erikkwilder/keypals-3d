<script lang="ts">
  // Tower Stack: a block hangs on its rope with a sum on its front. Type the answer and it drops. Quick
  // and right lands it straight on top (Perfect!); the longer the thinking, the wider it swings, so it
  // lands off to the side; a wrong answer slips off into the clouds and the answer shows. Lean the tower
  // too far and its top topples: three topples end the round early. Points for every block, more for
  // perfect ones and for right ones in a row, and a bonus for the height at the end.
  import { onDestroy, onMount } from 'svelte';
  import { game } from '../../state/game.svelte';
  import { stage } from '../../three/stage';
  import { TowerScene, type Landed } from '../../three/arcade/tower';
  import { answerOf, opSign, type Fact } from '../../math/facts';
  import { factText } from '../arcade';
  import { sfx, unlockAudio } from '../../audio/sound';
  import NumPad from '../../math/ui/NumPad.svelte';
  import { mult, type GameProps } from './hud';

  let { deck, buddy, fastMs, phase, compact, hud, onready }: GameProps = $props();

  let scene: TowerScene | null = null;
  let ready = $state(false);
  let fact = $state<Fact | null>(null);
  let typed = $state('');
  let feedback = $state<'right' | 'wrong' | null>(null);
  let reveal = $state<{ text: string; n: number } | null>(null);
  let topples = $state(0);
  let height = $state(0);
  let lit = $state<string | null>(null);
  let combo = 0;
  let shownAt = 0;
  let busy = false;
  let started = false, ended = false;
  let padEl: HTMLDivElement | undefined = $state();
  let timers: ReturnType<typeof setTimeout>[] = [];
  const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
  const digits = $derived(fact ? String(answerOf(fact)).length : 0);

  function nextBlock() {
    if (!scene || phase !== 'play') return;
    const f = deck.next(fact ? (x => factText(x) === factText(fact!)) : undefined);
    fact = f; typed = ''; feedback = null;
    scene.hang(factText(f));
    shownAt = performance.now();
    busy = false;
  }
  function digit(d: string) {
    if (!fact || busy || phase !== 'play') return;
    unlockAudio();
    lit = d; setTimeout(() => { if (lit === d) lit = null; }, 120);
    typed += d;
    sfx.click();
    if (typed.length >= digits) check();
  }
  function back() { if (!busy) typed = typed.slice(0, -1); }
  function check() {
    if (!fact || !scene) return;
    busy = true;
    const ans = answerOf(fact), ok = Number(typed) === ans, think = performance.now() - shownAt;
    hud.answer(fact, ok, think);
    feedback = ok ? 'right' : 'wrong';
    if (!ok) {
      combo = 0; hud.combo(0);
      sfx.miss();
      reveal = { text: `${fact.a} ${opSign(fact)} ${fact.b} = ${ans}`, n: (reveal?.n ?? 0) + 1 };
      later(2200, () => (reveal = null));
    }
    scene.release(ok, String(ans));
  }
  function onLanded(r: Landed) {
    if (!scene) return;
    height = r.height;
    const at = { x: 0.5, y: compact ? 0.3 : 0.36 };
    if (r.slipped) {
      sfx.whoosh();
      scene.react('oops');
    } else {
      combo++; hud.combo(combo);
      sfx.thunk(r.height);
      const pts = Math.round((r.perfect ? 200 : Math.max(60, 120 - Math.abs(r.offset) * 90)) * mult(combo));
      if (r.perfect) { sfx.sparkle(); scene.react('perfect'); } else if (combo % 3 === 0) scene.react('good');
      sfx.ding(combo);
      hud.score(pts, at, r.perfect ? 'Perfect!' : combo >= 3 && combo % 3 === 0 ? `${combo} in a row!` : '');
    }
    if (r.toppled) {
      topples++;
      sfx.topple();
      scene.react('topple');
      hud.score(0, { x: 0.5, y: at.y + 0.08 }, topples >= 3 ? 'Third topple!' : 'Whoa! It toppled');
      if (topples >= 3) { later(1200, () => hud.end()); return; }
    }
    later(r.slipped ? 700 : 380, nextBlock);
  }

  function keyDigit(e: KeyboardEvent) {
    if (/^[0-9]$/.test(e.key)) return e.key;
    const m = /^(?:Digit|Numpad)([0-9])$/.exec(e.code);
    return m ? m[1] : null;
  }
  function onKey(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey || game.modalOpen || phase !== 'play' || e.repeat) return;
    if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); back(); return; }
    if (e.key === 'Enter' && typed) { e.preventDefault(); check(); return; }
    const d = keyDigit(e);
    if (d !== null) { e.preventDefault(); digit(d); }
  }

  /** The tower uses the part of the screen between the card and the number pad. */
  function updateView() {
    if (!scene) return;
    const padTop = padEl ? padEl.getBoundingClientRect().top / innerHeight : 0.78;
    scene.view = { top: compact ? 0.24 : 0.2, bottom: Math.max(0.5, padTop - 0.02) };
  }

  $effect(() => {
    const ph = phase;
    if (!ready || !scene) return;
    scene.paused = ph === 'paused';
    if (ph === 'play' && !started) { started = true; nextBlock(); }
    if ((ph === 'ending' || ph === 'done') && !ended) {
      ended = true; fact = null;
      // the height bonus: every block still standing
      const h = scene.height;
      if (h) later(300, () => hud.score(h * 60, { x: 0.5, y: 0.36 }, `Tower of ${h}!`));
      scene.react('done');
    }
  });
  $effect(() => { void compact; requestAnimationFrame(updateView); });

  onMount(() => {
    TowerScene.create({ buddy }).then(sc => {
      scene = sc;
      sc.fastMs = fastMs;
      sc.onLanded = onLanded;
      stage.use(sc);
      updateView();
      ready = true;
      onready();
    });
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', updateView);
  });
  onDestroy(() => {
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', updateView);
    timers.forEach(clearTimeout);
    stage.use(null);
  });
</script>

<div class="tower" class:compact>
  {#if fact && (phase === 'play' || phase === 'paused')}
    {#key fact}
      <div class="card" class:right={feedback === 'right'} class:wrong={feedback === 'wrong'}>
        <span class="f">{fact.a}</span><span class="op">{opSign(fact)}</span><span class="f">{fact.b}</span><span class="op">=</span>
        <span class="boxes">{#each Array(digits) as _, i}<span class="box" class:cur={i === typed.length && !feedback} class:filled={i < typed.length}>{typed[i] ?? ''}</span>{/each}</span>
      </div>
    {/key}
  {/if}
  {#if reveal}{#key reveal.n}<div class="reveal">{reveal.text}</div>{/key}{/if}

  <div class="side">
    <div class="height"><b>{height}</b><span>blocks</span></div>
    <div class="lives" title="Three topples and the round ends">
      {#each Array(3) as _, i}<img class:gone={i < topples} src="{import.meta.env.BASE_URL}arcade/block.webp" alt="" />{/each}
    </div>
  </div>

  <div class="padwrap" bind:this={padEl}>
    {#if !compact}<div class="hint">Type the answer to drop the block. Quick and right lands it straight!</div>{/if}
    <NumPad ondigit={digit} onback={back} disabled={phase !== 'play'} {lit} {compact} />
  </div>
</div>

<style>
  .tower { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: flex-end; pointer-events: none; }
  .tower > * { pointer-events: auto; }
  .card { position: absolute; left: 50%; top: 14px; transform: translateX(-50%); display: flex; align-items: center; gap: clamp(8px, 1.4vw, 18px); padding: 8px 28px 10px; border-radius: 30px; z-index: 4; pointer-events: none;
    background: #fff; box-shadow: 0 0 0 4px rgba(255, 255, 255, .85), 0 14px 30px -12px rgba(60, 40, 110, .5); font: 600 clamp(50px, 8.5vh, 92px)/1 var(--font-ui); color: var(--ink); animation: pop-in .3s cubic-bezier(.3, .8, .4, 1.4); }
  .card .op { color: var(--primary); font-size: .8em; }
  .card.right { box-shadow: 0 0 0 6px var(--mint), 0 0 30px rgba(79, 207, 152, .6); }
  .card.wrong { box-shadow: 0 0 0 6px #f7c6d9; animation: wiggle .35s ease; }
  .boxes { display: flex; gap: 8px; }
  .box { width: .78em; height: 1.06em; display: grid; place-items: center; border-radius: 16px; border: 4px solid #e2daf3; background: #faf8fd; color: var(--primary-edge); }
  .box.cur { border-color: var(--primary); box-shadow: 0 0 0 5px #e7defe; }
  .box.filled { border-color: #cfc3ee; background: #fff; }
  .card.right .box { border-color: var(--mint); color: #0f6a48; }
  .reveal { position: absolute; left: 50%; top: calc(14px + clamp(50px, 8.5vh, 92px) + 40px); transform: translateX(-50%); z-index: 4; padding: 6px 18px; border-radius: 999px; background: #fff; color: #8a1f4a;
    font: 600 26px var(--font-ui); box-shadow: 0 0 0 4px #f7c6d9, var(--shadow-sm); animation: pop-in .3s cubic-bezier(.3, .8, .4, 1.5); white-space: nowrap; pointer-events: none; }
  .side { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 12px 12px 10px; border-radius: 22px; background: rgba(255, 255, 255, .9); box-shadow: var(--shadow-sm); pointer-events: none; }
  .height b { display: block; font: 600 40px/1 var(--font-ui); color: #e0752a; text-align: center; }
  .height span { font: 800 12px var(--font-body); letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
  .lives { display: flex; flex-direction: column; gap: 4px; }
  .lives img { width: 30px; height: 30px; border-radius: 8px; object-fit: cover; box-shadow: 0 2px 0 rgba(120, 80, 30, .35); background: #ffc93d; }
  .lives img.gone { opacity: .25; filter: grayscale(1); }
  .padwrap { position: relative; z-index: 6; padding: 10px 18px 16px; background: linear-gradient(rgba(255, 255, 255, .9), rgba(246, 241, 255, .96)); border-top: var(--panel-border); box-shadow: 0 -10px 30px -20px rgba(60, 40, 110, .3); }
  .hint { text-align: center; margin: -2px 0 8px; font: 700 13px var(--font-body); color: var(--muted); }

  .compact .card { top: 66px; padding: 6px 16px 8px; gap: 8px; font-size: 44px; border-radius: 24px; }
  .compact .box { border-radius: 12px; border-width: 3px; }
  .compact .reveal { top: 136px; font-size: 21px; }
  .compact .side { left: 8px; top: 150px; transform: none; padding: 8px 8px 6px; gap: 6px; }
  .compact .height b { font-size: 28px; }
  .compact .lives img { width: 22px; height: 22px; }
  .compact .padwrap { padding: 8px 10px 10px; }
</style>
