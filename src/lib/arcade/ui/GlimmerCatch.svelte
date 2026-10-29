<script lang="ts">
  // Glimmer Catch: a number on the card ("Make 24"), Glimmers floating down with sums on their signs.
  // Run the buddy under the ones that make the number and catch them in the net; the others boink off.
  // Four caught and the number changes. Now and then a golden Glimmer floats down: worth a lot.
  // Move with the arrow keys (or A and D), by dragging or tapping where to run, or the arrow buttons.
  import { onDestroy, onMount } from 'svelte';
  import { game } from '../../state/game.svelte';
  import { stage } from '../../three/stage';
  import { CatchScene, type Drop } from '../../three/arcade/catch';
  import { answerOf, factId, type Fact, type Op } from '../../math/facts';
  import { factText } from '../arcade';
  import { sfx, unlockAudio } from '../../audio/sound';
  import { mult, type GameProps } from './hud';

  let { deck, rng, buddy, phase, progress, compact, hud, onready }: GameProps = $props();

  let scene: CatchScene | null = null;
  let ready = $state(false);
  let target = $state<number | null>(null);
  let caught = $state(0);
  let flip = $state(0);
  let bump = $state(0);
  const PER = 4;
  let combo = 0;
  let started = false, ended = false;
  let rights: Fact[] = [], wrongs: Fact[] = [];
  let spawnIn = 0, sinceRight = 0, targetAge = 0;
  let lastX = 0;
  let raf = 0, last = 0;

  const swap = (f: Fact): Fact | null => ((f.op ?? 'x') === 'x' || f.op === '+') && f.a !== f.b ? { ...f, a: f.b, b: f.a } : null;
  /** A new number to make: one of the player's facts' answers (the shaky ones more often), the facts
   *  that make it, and believable ones that don't. */
  function newTarget() {
    const f = deck.next(target != null ? (x => answerOf(x) === target) : undefined);
    const t = answerOf(f), seen = new Set<string>();
    rights = [];
    for (const x of [...deck.facts.map(p => p.f), swap(f)].filter((x): x is Fact => !!x)) {
      if (answerOf(x) !== t || seen.has(factId(x))) continue;
      seen.add(factId(x)); rights.push(x);
      const s = swap(x); if (s && !seen.has(factId(s))) { seen.add(factId(s)); rights.push(s); }
    }
    // near misses: the player's facts with answers close by, then made-up neighbours of the fact
    const near = deck.facts.map(p => p.f).filter(x => answerOf(x) !== t).sort((a, b) => Math.abs(answerOf(a) - t) - Math.abs(answerOf(b) - t)).slice(0, 10);
    const op: Op = f.op ?? 'x';
    const made: Fact[] = [];
    for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1]] as const) {
      const g: Fact = { ...f, a: f.a + da, b: f.b + db };
      if (g.a < 0 || g.b < 0 || (op === '/' && (g.b === 0 || g.a % g.b !== 0)) || (op === '-' && g.a < g.b)) continue;
      if (answerOf(g) !== t) made.push(g);
    }
    wrongs = [...near, ...made];
    target = t; caught = 0; targetAge = 0; sinceRight = 0; flip++;
  }
  function spawn() {
    if (!scene) return;
    // right about two in five, and never three wrong in a row
    const right = sinceRight >= 2 || rng() < 0.42;
    const f = right ? rights[Math.floor(rng() * rights.length)] : wrongs[Math.floor(rng() * wrongs.length)];
    if (!f) return;
    const gold = right && rng() < 0.08;
    let x = rng() * 1.8 - 0.9;
    if (Math.abs(x - lastX) < 0.4) x = x > 0 ? x - 0.7 : x + 0.7;
    lastX = x;
    const secs = 5.4 - 1.9 * progress + (gold ? 0.6 : 0);
    if (scene.drop({ f, right, gold, x, secs })) sinceRight = right ? 0 : sinceRight + 1;
  }

  function onCatch(d: Drop, at: { x: number; y: number }, age: number) {
    if (!scene) return;
    if (d.right) {
      combo++;
      const pts = Math.round((d.gold ? 500 : 100) * mult(combo));
      // how long it was falling is the nearest thing to thinking time a catch has
      hud.answer(d.f, true, Math.max(400, Math.min(9000, age * 1000)));
      hud.score(pts, at, d.gold ? 'Golden Glimmer!' : combo >= 3 && combo % 3 === 0 ? `${combo} in a row!` : '');
      if (d.gold) { sfx.golden(); scene.react('gold'); } else sfx.catchPop(combo);
      sfx.ding(combo);
      caught++; bump++;
      if (caught >= PER) setTimeout(() => { if (phase === 'play') { scene?.clear(); newTarget(); sfx.whoosh(); } }, 450);
    } else {
      combo = 0;
      hud.answer(d.f, false, 3000);
      hud.score(0, at, `${factText(d.f)} = ${answerOf(d.f)}`);
      sfx.boink();
      scene.react('wrong');
    }
    hud.combo(combo);
  }

  function frame(t: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
    if (!scene || phase !== 'play') return;
    targetAge += dt;
    spawnIn -= dt;
    if (spawnIn <= 0) { spawn(); spawnIn = 1.35 - 0.5 * progress + rng() * 0.3; }
    // a number nobody can finish changes after a while
    if (targetAge > 16 && caught < PER) { scene.clear(); newTarget(); }
  }

  // ---------- moving ----------
  let dragging = false;
  function pdown(e: PointerEvent) { unlockAudio(); dragging = true; aim(e); }
  function pmove(e: PointerEvent) { if (dragging) aim(e); }
  function aim(e: PointerEvent) { if (!scene || phase !== 'play') return; const x = scene.fieldX(e.clientX / innerWidth); scene.goal = Math.max(-scene.field.half + 0.4, Math.min(scene.field.half - 0.4, x)); }
  function onKey(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey || game.modalOpen || !scene) return;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { e.preventDefault(); if (phase === 'play') scene.hold(-1); }
    else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { e.preventDefault(); if (phase === 'play') scene.hold(1); }
  }
  function onKeyUp(e: KeyboardEvent) {
    if (!scene) return;
    if (['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D'].includes(e.key)) scene.hold(0);
  }

  $effect(() => {
    const ph = phase;
    if (!ready || !scene) return;
    scene.paused = ph === 'paused';
    scene.running = ph === 'play';
    if (ph !== 'play') scene.hold(0);
    if (ph === 'play' && !started) { started = true; newTarget(); spawnIn = 0.3; sfx.whoosh(); }
    if ((ph === 'ending' || ph === 'done') && !ended) { ended = true; scene.clear(); scene.react('done'); target = null; }
  });

  onMount(() => {
    CatchScene.create({ buddy }).then(sc => {
      scene = sc;
      sc.onCatch = onCatch;
      stage.use(sc);
      ready = true;
      onready();
    });
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    raf = requestAnimationFrame(frame);
  });
  onDestroy(() => {
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKeyUp);
    cancelAnimationFrame(raf);
    stage.use(null);
  });
</script>

<div class="catch" class:compact>
  <div class="touch" role="presentation" onpointerdown={pdown} onpointermove={pmove} onpointerup={() => (dragging = false)} onpointercancel={() => (dragging = false)}></div>

  {#if target != null && (phase === 'play' || phase === 'paused')}
    {#key flip}
      <div class="card">
        <span class="make">Make</span>
        <b>{target}</b>
        <span class="dots">{#each Array(PER) as _, i}<i class:on={i < caught}></i>{/each}</span>
      </div>
    {/key}
  {/if}

  {#if phase === 'play' || phase === 'paused'}
    <button class="arrow left" aria-label="Run left" onpointerdown={(e) => { e.stopPropagation(); unlockAudio(); scene?.hold(-1); }} onpointerup={() => scene?.hold(0)} onpointerleave={() => scene?.hold(0)} onpointercancel={() => scene?.hold(0)}><img src="{import.meta.env.BASE_URL}icons/left.webp" alt="" /></button>
    <button class="arrow right" aria-label="Run right" onpointerdown={(e) => { e.stopPropagation(); unlockAudio(); scene?.hold(1); }} onpointerup={() => scene?.hold(0)} onpointerleave={() => scene?.hold(0)} onpointercancel={() => scene?.hold(0)}><img src="{import.meta.env.BASE_URL}icons/right.webp" alt="" /></button>
    {#if !compact}<div class="keys">Run with <span class="kbd">←</span> <span class="kbd">→</span> or drag</div>{/if}
  {/if}
  {#key bump}{#if bump}<div class="glow"></div>{/if}{/key}
</div>

<style>
  .catch { position: absolute; inset: 0; }
  .touch { position: absolute; inset: 0; touch-action: none; }
  .card { position: absolute; left: 50%; top: 14px; transform: translateX(-50%); display: flex; align-items: center; gap: 14px; padding: 8px 26px 10px; border-radius: 30px; z-index: 4; pointer-events: none;
    background: linear-gradient(#fffef9, #fff3dc); box-shadow: 0 0 0 4px rgba(255, 255, 255, .85), 0 14px 30px -12px rgba(110, 60, 20, .5); animation: card-in .4s cubic-bezier(.3, .8, .4, 1.4); }
  .make { font: 600 30px var(--font-ui); color: #6a4a1a; }
  .card b { font: 600 clamp(56px, 9vh, 96px)/1 var(--font-ui); color: #2a1f45; min-width: 1.3ch; text-align: center; }
  .dots { display: grid; grid-template-columns: repeat(2, 16px); gap: 6px; }
  .dots i { width: 16px; height: 16px; border-radius: 50%; background: #efe3c8; box-shadow: inset 0 2px 2px rgba(110, 70, 10, .2); }
  .dots i.on { background: radial-gradient(circle at 35% 30%, #fff8c8, #ffc93d 60%, #f0a20c); box-shadow: 0 0 10px rgba(255, 190, 40, .8); animation: pop-in .3s cubic-bezier(.3, .8, .4, 1.6); }
  @keyframes card-in { 0% { transform: translateX(-50%) rotateX(80deg); opacity: 0; } 100% { transform: translateX(-50%) rotateX(0); opacity: 1; } }
  .arrow { position: absolute; bottom: 18px; width: 92px; height: 92px; border-radius: 50%; border: 0; background: rgba(255, 255, 255, .72); box-shadow: 0 6px 0 rgba(170, 150, 110, .55), 0 12px 24px -10px rgba(80, 50, 10, .45);
    display: grid; place-items: center; cursor: pointer; z-index: 3; touch-action: none; -webkit-tap-highlight-color: transparent; }
  .arrow:active { transform: translateY(4px); box-shadow: 0 2px 0 rgba(170, 150, 110, .55); }
  .arrow img { width: 54px; height: 54px; object-fit: contain; }
  .arrow.left { left: 18px; }
  .arrow.right { right: 18px; }
  .keys { position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%); font: 700 14px var(--font-body); color: #fff; text-shadow: 0 1px 4px rgba(60, 40, 10, .7); pointer-events: none; z-index: 3; }
  .glow { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse at 50% 80%, rgba(255, 240, 160, .35), rgba(255, 240, 160, 0) 60%); animation: fade .6s ease-out forwards; z-index: 2; }
  @keyframes fade { 0% { opacity: 1; } 100% { opacity: 0; } }

  .compact .card { top: 66px; padding: 6px 18px 8px; gap: 10px; }
  .compact .make { font-size: 22px; }
  .compact .card b { font-size: 54px; }
  .compact .arrow { width: 76px; height: 76px; bottom: 12px; }
  .compact .arrow img { width: 46px; height: 46px; }
  .compact .arrow.left { left: 12px; }
  .compact .arrow.right { right: 12px; }
</style>
