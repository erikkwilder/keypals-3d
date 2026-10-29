<script lang="ts">
  // Sky Slalom: the sum on the card, three ice arches ahead with a number over each. Steer (arrow keys,
  // A and D, a swipe, a tap on either side, or the big arrow buttons) through the arch with the answer.
  // Right ones in a row build the combo and the speed, and add time to the clock, so the run goes on as
  // long as you keep it going; a wrong arch is a soft spin-out in the snow and the answer shows. Golden
  // rings between the gates give a burst of speed. Right ones also fill the turbo: fire it yourself (space
  // or the big button) for a rush of speed and double points. Points grow with the speed.
  import { onDestroy, onMount } from 'svelte';
  import { game } from '../../state/game.svelte';
  import { stage } from '../../three/stage';
  import { SlalomScene, SPEED_MAX, type GateSpec } from '../../three/arcade/slalom';
  import { answerOf, opSign, type Fact } from '../../math/facts';
  import { shuffle } from '../../engine/rng';
  import { distractors, factText } from '../arcade';
  import { sfx, unlockAudio } from '../../audio/sound';
  import { mult, type GameProps } from './hud';

  let { deck, rng, buddy, fastMs, phase, elapsed, compact, hud, onready }: GameProps = $props();

  type Q = { f: Fact; spec: GateSpec; d: number };
  let scene: SlalomScene | null = null;
  let ready = $state(false);
  let cur = $state<Q | null>(null);
  let next: Q | null = null;
  let reveal = $state<{ text: string; n: number } | null>(null);
  let speed = $state(0);
  let pulse = $state(0);
  let combo = 0;
  /** the turbo: it fills with right answers (quick ones more), fire it when it's full */
  let charge = $state(0);
  let turboOn = $state(false);
  let shownAt = 0, steerAt = 0, steered = false;
  let started = false, ended = false;
  let metres = 0;
  let raf = 0;
  let revealTimer: ReturnType<typeof setTimeout> | undefined;

  function make(d: number): Q {
    const f = deck.next(cur ? (x => factText(x) === factText(cur!.f)) : undefined);
    const ans = answerOf(f);
    const vals = shuffle(rng, [ans, ...distractors(f, 2, rng)]) as [number, number, number];
    return { f, spec: { values: vals, right: vals.indexOf(ans) as 0 | 1 | 2 }, d };
  }
  /** Metres to the next gate: about four seconds of thinking at first, under two late in a long run. */
  const gap = () => Math.max(30, Math.max(9, scene?.speed ?? 9) * Math.max(1.8, 4.2 - elapsed * 0.013));
  /** Points grow with the speed: twice as many at about 80 km/h, four times at 160. */
  const speedMult = () => 1 + Math.max(0, (scene?.speed ?? 9) - 9) / 12;
  /** Seconds a right answer adds to the clock: a lot early on, less as the run goes. */
  const timeBack = () => Math.max(0.8, 1.8 - elapsed * 0.007);

  function start() {
    if (!scene) return;
    cur = make(48); scene.addGate(cur.d, cur.spec); scene.showGate(cur.d);
    next = make(cur.d + gap()); scene.addGate(next.d, next.spec);
    maybeRing(cur.d, next.d);
    shownAt = performance.now(); steered = false;
    scene.running = true;
    sfx.whoosh();
  }

  function onGate(lane: 0 | 1 | 2, spec: GateSpec, near: boolean) {
    if (!cur || !scene) return;
    const q = cur, ok = lane === spec.right, now = performance.now();
    // the thinking time is until the last steer; staying put in the right lane counts as the whole way
    const think = ok && steered ? steerAt - shownAt : now - shownAt;
    hud.answer(q.f, ok, Math.max(250, think));
    const at = scene.screenAt();
    if (ok) {
      combo++;
      const quick = think <= fastMs;
      const turbo = scene.turbo > 0 ? 2 : 1;
      const pts = Math.round(((100 + (quick ? 50 : 0)) * mult(combo) * speedMult() + (near ? 50 : 0)) * turbo);
      hud.score(pts, at, near ? 'Close one!' : turbo > 1 ? 'Turbo x2!' : combo >= 3 && combo % 3 === 0 ? `${combo} in a row!` : quick ? 'Quick!' : '');
      hud.addTime(timeBack());
      sfx.ding(combo);
      if (near) sfx.nearMiss();
      scene.cheer(lane, combo);
      pulse++;
      const wasFull = charge >= 1;
      charge = Math.min(1, charge + (quick ? 0.34 : 0.25));
      if (charge >= 1 && !wasFull) sfx.turboReady();
    } else {
      combo = 0;
      charge = 0;
      scene.turbo = 0;
      sfx.crash();
      scene.shatter(lane);
      scene.crash();
      reveal = { text: `${q.f.a} ${opSign(q.f)} ${q.f.b} = ${answerOf(q.f)}`, n: (reveal?.n ?? 0) + 1 };
      clearTimeout(revealTimer);
      revealTimer = setTimeout(() => (reveal = null), 2200);
    }
    hud.combo(combo);
    scene.streak = combo;
    // on to the next gate
    if (next) { cur = next; scene.showGate(cur.d); }
    shownAt = now; steered = false;
    const from = cur?.d ?? scene.dist;
    next = make(from + gap());
    scene.addGate(next.d, next.spec);
    maybeRing(from, next.d);
  }
  /** Now and then a golden boost ring between two gates, in any lane (worth a detour if there's time). */
  function maybeRing(a: number, b: number) {
    if (!scene || rng() > 0.55 || b - a < 26) return;
    scene.addRing(a + (b - a) * (0.45 + rng() * 0.15), Math.floor(rng() * 3));
  }
  function onRing(hit: boolean) {
    if (!hit || !scene) return;
    const pts = Math.round(150 * speedMult() * (scene.turbo > 0 ? 2 : 1));
    hud.score(pts, scene.screenAt(), 'Boost!');
    hud.addTime(timeBack() + 0.5);
    sfx.ringPass();
  }
  function fire() {
    if (!scene || charge < 1 || phase !== 'play') return;
    charge = 0;
    scene.fireTurbo();
    sfx.turbo();
    pulse++;
  }

  function steer(dir: -1 | 1) {
    if (!scene || phase !== 'play') return;
    const was = scene.lane;
    scene.steer(dir);
    if (scene.lane !== was) { steered = true; steerAt = performance.now(); sfx.carve(); }
  }

  // ---------- touch: swipe, or tap a side ----------
  let down: { x: number; y: number; moved: boolean } | null = null;
  function pdown(e: PointerEvent) { unlockAudio(); down = { x: e.clientX, y: e.clientY, moved: false }; }
  function pmove(e: PointerEvent) {
    if (!down) return;
    const dx = e.clientX - down.x;
    if (Math.abs(dx) > 36) { steer(dx < 0 ? -1 : 1); down.x = e.clientX; down.moved = true; }
  }
  function pup(e: PointerEvent) {
    if (down && !down.moved) steer(e.clientX < innerWidth / 2 ? -1 : 1);
    down = null;
  }
  function onKey(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey || game.modalOpen || phase !== 'play') return;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { e.preventDefault(); steer(-1); }
    else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { e.preventDefault(); steer(1); }
    else if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { e.preventDefault(); fire(); }
  }

  function frame() {
    raf = requestAnimationFrame(frame);
    if (!scene) return;
    speed = scene.speed;
    turboOn = scene.turbo > 0;
    // a point every metre of snow
    if (phase === 'play') {
      const m = Math.floor(scene.dist / 5);
      if (m > metres) { hud.score((m - metres) * 5, null); metres = m; }
    }
  }

  $effect(() => {
    const ph = phase;
    if (!ready || !scene) return;
    scene.paused = ph === 'paused';
    if (ph === 'play' && !started) { started = true; start(); }
    if ((ph === 'ending' || ph === 'done') && !ended) { ended = true; scene.finish(); cur = null; }
  });

  onMount(() => {
    SlalomScene.create({ buddy, seed: Math.floor(rng() * 1e9) }).then(sc => {
      scene = sc;
      sc.onGate = onGate;
      sc.onRing = onRing;
      stage.use(sc);
      ready = true;
      onready();
    });
    window.addEventListener('keydown', onKey);
    raf = requestAnimationFrame(frame);
  });
  onDestroy(() => {
    window.removeEventListener('keydown', onKey);
    cancelAnimationFrame(raf);
    clearTimeout(revealTimer);
    stage.use(null);
  });

  const SPEED_TOP = SPEED_MAX;
  const needle = $derived(-110 + Math.min(1, speed / SPEED_TOP) * 220);
  /** how much the speed lines show: from about 70 km/h up */
  const rush = $derived(Math.max(0, Math.min(1, (speed - 19) / 22)));
</script>

<div class="slalom" class:compact>
  <!-- the whole snow field steers: swipe, or tap a side -->
  <div class="touch" role="presentation" onpointerdown={pdown} onpointermove={pmove} onpointerup={pup} onpointercancel={() => (down = null)}></div>

  {#if cur && (phase === 'play' || phase === 'paused')}
    {#key cur.d}
      <div class="card">
        <img class="st s1" src="{import.meta.env.BASE_URL}game/icon-star.webp" alt="" />
        <span class="sum"><b>{cur.f.a}</b><i>{opSign(cur.f)}</i><b>{cur.f.b}</b></span>
        <img class="st s2" src="{import.meta.env.BASE_URL}game/icon-star.webp" alt="" />
      </div>
    {/key}
  {/if}
  {#if reveal}{#key reveal.n}<div class="reveal">{reveal.text}</div>{/key}{/if}

  <div class="gauge" class:gone={phase === 'done' || phase === 'intro' || phase === 'loading'} aria-hidden="true">
    <svg viewBox="0 0 120 76">
      <defs><linearGradient id="sg" x1="0" x2="1"><stop offset="0" stop-color="#7fd0ff" /><stop offset=".6" stop-color="#3d7ff0" /><stop offset="1" stop-color="#7c5cf5" /></linearGradient></defs>
      <path d="M14 66 A46 46 0 0 1 106 66" fill="none" stroke="#e6eefb" stroke-width="12" stroke-linecap="round" />
      <path d="M14 66 A46 46 0 0 1 106 66" fill="none" stroke="url(#sg)" stroke-width="12" stroke-linecap="round" pathLength="100" stroke-dasharray="{Math.min(1, speed / SPEED_TOP) * 100} 100" />
      <g transform="rotate({needle} 60 66)"><path d="M57 66 L60 26 L63 66 Z" fill="#2a1f45" /><circle cx="60" cy="66" r="6" fill="#2a1f45" /></g>
    </svg>
    <span>{Math.round(speed * 3.6)}<small>km/h</small></span>
  </div>

  {#if phase === 'play' || phase === 'paused'}
    <button class="arrow left" aria-label="Steer left" onpointerdown={(e) => { e.stopPropagation(); unlockAudio(); steer(-1); }}><img src="{import.meta.env.BASE_URL}icons/left.webp" alt="" /></button>
    <button class="arrow right" aria-label="Steer right" onpointerdown={(e) => { e.stopPropagation(); unlockAudio(); steer(1); }}><img src="{import.meta.env.BASE_URL}icons/right.webp" alt="" /></button>
    {#if !compact}<div class="keys">Steer with <span class="kbd">←</span> <span class="kbd">→</span> · turbo with <span class="kbd">space</span></div>{/if}
  {/if}
  {#key pulse}{#if pulse}<div class="flash"></div>{/if}{/key}
  <!-- speed lines from about 70 km/h, and a blue rush with the turbo on -->
  {#if rush > 0 && (phase === 'play' || phase === 'ending')}<div class="lines" class:turbo={turboOn} style:opacity={Math.min(1, rush * 0.9 + (turboOn ? 0.3 : 0))}></div>{/if}

  {#if phase === 'play' || phase === 'paused'}
    <button class="turbo" class:full={charge >= 1} class:on={turboOn} aria-label="Turbo" disabled={charge < 1 || turboOn} onpointerdown={(e) => { e.stopPropagation(); unlockAudio(); fire(); }}>
      <span class="meter" style:--k={turboOn ? 1 : charge}></span>
      <b>{turboOn ? 'TURBO!' : charge >= 1 ? 'TURBO' : 'Turbo'}</b>
      {#if !compact}<small>{turboOn ? 'Double points!' : charge >= 1 ? 'Press space!' : 'Right ones fill it'}</small>{/if}
    </button>
  {/if}
</div>

<style>
  .slalom { position: absolute; inset: 0; }
  .touch { position: absolute; inset: 0; touch-action: none; }
  .card { position: absolute; left: 50%; top: 14px; transform: translateX(-50%); display: flex; align-items: center; gap: 14px; padding: 8px 34px 10px; border-radius: 30px;
    background: linear-gradient(#fffef9, #fff6e6); box-shadow: 0 0 0 4px rgba(255, 255, 255, .85), 0 14px 30px -12px rgba(30, 50, 110, .55); pointer-events: none; animation: card-in .35s cubic-bezier(.3, .8, .4, 1.4); z-index: 4; }
  .sum { display: flex; align-items: center; gap: .28em; font: 600 clamp(54px, 9vh, 96px)/1 var(--font-ui); color: #1f2550; letter-spacing: .01em; }
  .sum i { font-style: normal; font-size: .8em; color: #3d5bd8; }
  .st { width: 34px; height: 34px; object-fit: contain; filter: drop-shadow(0 2px 2px rgba(120, 80, 0, .3)); }
  .st.s1 { margin-top: 26px; transform: rotate(-14deg); }
  .st.s2 { margin-bottom: 26px; transform: rotate(12deg); width: 40px; height: 40px; }
  @keyframes card-in { 0% { transform: translateX(-50%) scale(.6) rotate(-3deg); opacity: 0; } 100% { transform: translateX(-50%) scale(1); opacity: 1; } }
  .reveal { position: absolute; left: 50%; top: calc(14px + clamp(54px, 9vh, 96px) + 34px); translate: -50% 0; z-index: 4; padding: 6px 18px; border-radius: 999px; background: #fff; color: #8a1f4a;
    font: 600 26px var(--font-ui); box-shadow: 0 0 0 4px #f7c6d9, var(--shadow-sm); animation: pop-in .3s cubic-bezier(.3, .8, .4, 1.5); white-space: nowrap; pointer-events: none; }
  .gauge { position: absolute; right: 16px; bottom: 16px; width: 150px; padding: 8px 10px 6px; border-radius: 22px; background: rgba(255, 255, 255, .92); box-shadow: 0 10px 24px -12px rgba(30, 50, 110, .5); text-align: center; pointer-events: none; z-index: 3; }
  .gauge.gone { display: none; }
  .gauge svg { display: block; width: 100%; }
  .gauge span { display: block; margin-top: -10px; font: 600 22px/1 var(--font-ui); color: #1f2550; }
  .gauge small { font: 800 11px var(--font-body); color: var(--muted); margin-left: 3px; }
  .arrow { position: absolute; bottom: 18px; width: 92px; height: 92px; border-radius: 50%; border: 0; background: rgba(255, 255, 255, .72); box-shadow: 0 6px 0 rgba(150, 170, 210, .6), 0 12px 24px -10px rgba(30, 50, 110, .5);
    display: grid; place-items: center; cursor: pointer; z-index: 3; touch-action: none; -webkit-tap-highlight-color: transparent; }
  .arrow:active { transform: translateY(4px); box-shadow: 0 2px 0 rgba(150, 170, 210, .6); }
  .arrow img { width: 54px; height: 54px; object-fit: contain; }
  .arrow.left { left: 18px; }
  .arrow.right { right: 186px; }
  .keys { position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%); font: 700 14px var(--font-body); color: #fff; text-shadow: 0 1px 4px rgba(20, 40, 90, .6); pointer-events: none; z-index: 3; }
  .flash { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse at 50% 60%, rgba(255, 230, 120, 0) 40%, rgba(255, 220, 90, .28) 100%); animation: flash .5s ease-out forwards; z-index: 2; }
  @keyframes flash { 0% { opacity: 1; } 100% { opacity: 0; } }

  .lines { position: absolute; inset: 0; pointer-events: none; z-index: 2;
    background: repeating-conic-gradient(from 0deg at 50% 46%, rgba(255, 255, 255, 0) 0deg 5deg, rgba(255, 255, 255, .55) 5deg 5.6deg, rgba(255, 255, 255, 0) 5.6deg 13deg);
    mask: radial-gradient(ellipse at 50% 46%, transparent 32%, #000 72%); -webkit-mask: radial-gradient(ellipse at 50% 46%, transparent 32%, #000 72%); animation: lines .25s linear infinite; }
  .lines.turbo { background: repeating-conic-gradient(from 0deg at 50% 46%, rgba(120, 220, 255, 0) 0deg 4deg, rgba(160, 235, 255, .75) 4deg 5deg, rgba(120, 220, 255, 0) 5deg 10deg); animation-duration: .16s; }
  @keyframes lines { 0% { transform: scale(1); } 100% { transform: scale(1.06) rotate(1.5deg); } }
  .turbo { position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%); z-index: 4; width: 210px; padding: 10px 14px 9px; border: 0; border-radius: 22px; cursor: pointer;
    background: rgba(255, 255, 255, .85); box-shadow: 0 6px 0 rgba(150, 170, 210, .6), 0 12px 24px -10px rgba(30, 50, 110, .5); display: flex; flex-direction: column; align-items: center; gap: 2px; overflow: hidden; touch-action: none; -webkit-tap-highlight-color: transparent; }
  .turbo .meter { position: absolute; left: 0; top: 0; bottom: 0; width: calc(var(--k) * 100%); background: linear-gradient(90deg, #8fe0ff, #3d9cf0); opacity: .45; transition: width .25s; }
  .turbo b { position: relative; font: 700 24px/1 var(--font-ui); color: #1f4f9a; letter-spacing: .04em; }
  .turbo small { position: relative; font: 700 12px var(--font-body); color: var(--muted); }
  .turbo.full { background: linear-gradient(135deg, #5fd0ff, #3d7ff0); box-shadow: 0 6px 0 #2a5fc2, 0 0 30px rgba(90, 190, 255, .9); animation: ready .8s ease-in-out infinite; }
  .turbo.full b, .turbo.full small, .turbo.on b, .turbo.on small { color: #fff; }
  .turbo.full .meter { display: none; }
  .turbo.on { background: linear-gradient(135deg, #ffd34a, #ff8a1f); box-shadow: 0 6px 0 #c4600a, 0 0 34px rgba(255, 190, 60, .9); }
  .turbo.on .meter { display: none; }
  .turbo:active:not(:disabled) { transform: translateX(-50%) translateY(4px); }
  @keyframes ready { 50% { transform: translateX(-50%) scale(1.06); } }
  .keys { bottom: 96px; }

  .compact .card { top: 100px; padding: 6px 22px 8px; gap: 8px; }
  .compact .turbo { width: auto; min-width: 104px; bottom: 112px; padding: 8px 14px; border-radius: 18px; }
  .compact .turbo b { font-size: 18px; }
  .compact .sum { font-size: 52px; }
  .compact .st { width: 24px; height: 24px; }
  .compact .st.s2 { width: 28px; height: 28px; }
  .compact .reveal { top: 176px; font-size: 21px; }
  .compact .gauge { width: 104px; right: 50%; transform: translateX(50%); bottom: 14px; padding: 6px 8px 4px; border-radius: 18px; }
  .compact .gauge span { font-size: 17px; margin-top: -8px; }
  .compact .arrow { width: 84px; height: 84px; bottom: 14px; }
  .compact .arrow.left { left: 14px; }
  .compact .arrow.right { right: 14px; }
</style>
