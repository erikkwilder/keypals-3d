<script lang="ts">
  // The hatch moment, wherever a ready egg is tapped (the incubator, or a results screen's "Egg ready!"):
  // the egg rises into the light, a real 3D egg wearing its own painting (three/eggHatch.ts), and wobbles
  // harder and harder as it cracks (real eggshell cracks you can hear): with each crack the shell itself
  // comes apart a little more, warm light glowing through the gaps, a chip knocked out, and it bursts: the
  // top lifts off and tumbles away, the pieces below fall open, light and sparkles pour out, and the
  // Glimmer's card flips in. (A computer that can't draw it in 3D gets the flat painted egg with cracks
  // drawn on.) In the incubator (which lends its 3D scene,
  // `scene`) the Glimmer also pops up on its stone in a beam of light, its card beside it; anywhere else
  // the card comes in the middle, over the screen.
  import { onDestroy, onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { preloadSfx, sfx } from '../audio/sound';
  import type { GlimmerShow } from '../three/glimmerShow';
  import { GLIMMER, RARITY, rarityRank } from '../adventure/glimmers';
  import { advView, hatch, type Hatch, type Egg } from '../adventure/state';
  import GlimmerCard from './GlimmerCard.svelte';
  import { EggHatch } from '../three/eggHatch';
  import Confetti from './Confetti.svelte';

  type View = { top: number; bottom: number; left: number; right: number };
  type Props = {
    /** the incubator nest whose egg hatches */
    slot: number;
    /** the 3D scene on the stage to show the Glimmer in (the incubator's) */
    scene?: GlimmerShow | null;
    /** when the egg is gone and the card is up (the incubator moves its scene beside the card) */
    onhatched?: (h: Hatch | null) => void;
    onclose: () => void;
    /** buttons under the card ("See it in My stuff"); without, a tap anywhere closes it */
    see?: boolean;
  };
  let { slot, scene = null, onhatched, onclose, see = false }: Props = $props();

  const base = import.meta.env.BASE_URL;
  const p = $derived(game.profile!);
  let closed = false;
  let got = $state<Hatch | null>(null);
  let burst = $state(0);

  // the crack lines, in the egg's own box (0..1): a zigzag round the middle and a branch up and down from
  // its centre; the shell splits along exactly these lines
  const Z: [number, number][] = [[0, 0.55], [0.12, 0.48], [0.24, 0.58], [0.36, 0.47], [0.5, 0.57], [0.62, 0.46], [0.75, 0.56], [0.88, 0.47], [1, 0.54]];
  const UP: [number, number][] = [[0.5, 0.57], [0.44, 0.4], [0.53, 0.24], [0.47, 0]];
  const DOWN: [number, number][] = [[0.5, 0.57], [0.56, 0.72], [0.48, 0.86], [0.53, 1]];
  const LEFT = Z.slice(0, 5).reverse(), RIGHT = Z.slice(4);
  // little hairline cracks off the main ones (they don't split the shell; they just make it look real)
  const HAIRS: [number, number][][] = [[[0.24, 0.58], [0.19, 0.67], [0.21, 0.73]], [[0.75, 0.56], [0.81, 0.64]], [[0.36, 0.47], [0.31, 0.38], [0.33, 0.33]], [[0.62, 0.46], [0.68, 0.37]], [[0.53, 0.24], [0.6, 0.18]], [[0.56, 0.72], [0.64, 0.76]]];
  /** how much of each crack line shows at each step: [left, right, up, down, hairlines] */
  const REVEAL = [[0, 0, 0, 0, 0], [0.32, 0.3, 0, 0, 0], [0.75, 0.72, 0.55, 0, 0.5], [1, 1, 1, 0.8, 1]];
  const pct = (pts: [number, number][]) => pts.map(([x, y]) => `${(x * 100).toFixed(1)}% ${(y * 100).toFixed(1)}%`).join(', ');
  // the four shell pieces (polygons that follow the cracks), and where each one flies
  const PIECES: { poly: [number, number][]; vx: number; vy: number; w: number }[] = [
    { poly: [[0, 0], [0.47, 0], [0.53, 0.24], [0.44, 0.4], ...LEFT], vx: -0.9, vy: -1.9, w: -260 },
    { poly: [[0.47, 0], [1, 0], ...RIGHT.slice().reverse(), [0.44, 0.4], [0.53, 0.24]], vx: 1.0, vy: -2.1, w: 300 },
    { poly: [...Z.slice(0, 5), [0.56, 0.72], [0.48, 0.86], [0.53, 1], [0, 1]], vx: -0.55, vy: -0.6, w: -120 },
    { poly: [...Z.slice(4), [1, 1], [0.53, 1], [0.48, 0.86], [0.56, 0.72]], vx: 0.6, vy: -0.7, w: 140 },
  ];
  type Piece = { poly: string; x: number; y: number; vx: number; vy: number; r: number; w: number; o: number; cx: number; cy: number };
  type Spark = { id: number; dx: number; dy: number; s: number; d: number; star: boolean };
  let hm = $state<{ rarity: string; src: string; w: number; h: number; x: number; y: number } | null>(null);
  let step = $state(0);
  let rise = $state(0); let tilt = $state(0); let squash = $state(1); let glow = $state(0);
  let broken = $state(false); let flash = $state(false);
  let pieces = $state<Piece[]>([]); let sparks = $state<Spark[]>([]);
  let crackCanvas: HTMLCanvasElement | undefined = $state();
  // the 3D egg (null: the flat one), and its canvas over the screen
  let egg3: EggHatch | null = null;
  let eggCanvas: HTMLCanvasElement | undefined = $state();
  let is3d = $state(false);
  let eggImg: HTMLImageElement | null = null;
  let raf = 0;
  const RCOL: Record<string, string> = { common: '#fff3c4', uncommon: '#9dffb8', rare: '#9fd4ff', epic: '#e2b8ff', legendary: '#ffe08a', mythic: '#ffb8e2' };

  /** draw the cracks as far as they've grown: a dark split with light glowing through it, only on the egg */
  function drawCracks(f: number[]) {
    const cv = crackCanvas; if (!cv || !hm || !eggImg) return;
    const dpr = Math.min(2, devicePixelRatio || 1), W = hm.w, H = hm.h;
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const g = cv.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const lines = [LEFT, RIGHT, UP, DOWN];
    const path = (pts: [number, number][], k: number) => {
      if (k <= 0) return;
      const seg = pts.slice(1).map((q, i) => Math.hypot((q[0] - pts[i][0]) * W, (q[1] - pts[i][1]) * H));
      let left = seg.reduce((a, b) => a + b, 0) * k;
      g.moveTo(pts[0][0] * W, pts[0][1] * H);
      for (let i = 1; i < pts.length && left > 0; i++) {
        const t = Math.min(1, left / seg[i - 1]);
        g.lineTo((pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t) * W, (pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t) * H);
        left -= seg[i - 1];
      }
    };
    const col = RCOL[hm.rarity] ?? '#fff3c4';
    g.lineCap = 'round'; g.lineJoin = 'round';
    // light leaking out first (a soft wide glow that grows with every crack), then the dark split, then
    // the bright core; the hairlines are thinner and only dark
    const k = Math.max(f[0], f[1]);
    g.save(); g.shadowColor = col; g.shadowBlur = 16 + 18 * k; g.strokeStyle = col; g.globalAlpha = 0.55 + 0.35 * k; g.lineWidth = W * (0.035 + 0.045 * k);
    g.beginPath(); lines.forEach((l, i) => path(l, f[i])); g.stroke(); g.restore();
    g.strokeStyle = '#3a2412'; g.lineWidth = W * 0.024; g.beginPath(); lines.forEach((l, i) => path(l, f[i])); g.stroke();
    g.strokeStyle = 'rgba(58, 36, 18, .8)'; g.lineWidth = W * 0.009; g.beginPath(); HAIRS.forEach(h => path(h, f[4])); g.stroke();
    g.save(); g.shadowColor = '#fff'; g.shadowBlur = 10; g.strokeStyle = '#fffbe8'; g.lineWidth = W * 0.009;
    g.beginPath(); lines.forEach((l, i) => path(l, f[i])); g.stroke(); g.restore();
    // keep it on the shell (the painting's own outline)
    g.globalCompositeOperation = 'destination-in'; g.drawImage(eggImg, 0, 0, W, H); g.globalCompositeOperation = 'source-over';
  }
  let shown = [0, 0, 0, 0, 0];
  /** grow the cracks to a step, quickly */
  function growTo(k: number) {
    const from = shown.slice(), to = REVEAL[k], t0 = performance.now();
    const tick = () => {
      const e = Math.min(1, (performance.now() - t0) / 180);
      shown = from.map((v, i) => v + (to[i] - v) * e);
      drawCracks(shown);
      if (e < 1) requestAnimationFrame(tick);
    };
    tick();
  }
  /** the egg's wobble: gentle, then harder with every crack */
  function wobbleLoop() {
    const t0 = performance.now();
    const tick = (now: number) => {
      if (!hm || broken) return;
      const t = (now - t0) / 1000, amp = [3, 7, 12, 18][step] ?? 18, fr = [5, 8, 11, 15][step] ?? 15;
      tilt = Math.sin(t * fr) * amp * (step === 0 ? Math.max(0, Math.sin(t * 2.4)) : 1);
      if (egg3) { egg3.tilt = tilt; egg3.squash = squash; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }
  /** light and sparkles pouring out */
  function burstSparks() {
    if (!hm) return;
    const W = hm.w;
    let id = 0;
    sparks = Array.from({ length: 30 }, () => { const a = Math.random() * Math.PI * 2, d = W * (0.9 + Math.random() * 1.6); return { id: id++, dx: Math.cos(a) * d, dy: Math.sin(a) * d * 0.8 - W * 0.3, s: 8 + Math.random() * 18, d: Math.random() * 0.15, star: Math.random() < 0.55 }; });
  }
  /** the egg is gone: let the 3D one go too */
  function dropEgg() { hm = null; is3d = false; egg3?.dispose(); egg3 = null; }
  function burstShell() {
    if (!hm) return;
    const W = hm.w, H = hm.h;
    pieces = PIECES.map(p => {
      const cx = p.poly.reduce((a, q) => a + q[0], 0) / p.poly.length, cy = p.poly.reduce((a, q) => a + q[1], 0) / p.poly.length;
      return { poly: pct(p.poly), x: 0, y: 0, vx: p.vx * W * (0.9 + Math.random() * 0.3), vy: p.vy * H * (0.9 + Math.random() * 0.3), r: 0, w: p.w, o: 1, cx: cx * 100, cy: cy * 100 };
    });
    burstSparks();
    broken = true; flash = true;
    const t0 = performance.now(); let last = t0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000), age = (now - t0) / 1000; last = now;
      pieces = pieces.map(p => ({ ...p, x: p.x + p.vx * dt, y: p.y + p.vy * dt, vy: p.vy + H * 5.2 * dt, r: p.r + p.w * dt, o: Math.max(0, 1 - Math.max(0, age - 0.55) / 0.5) }));
      if (age < 1.2) requestAnimationFrame(tick); else pieces = [];
    };
    requestAnimationFrame(tick);
  }

  // while an egg hatches the whole screen is the stage: the egg rises to the middle and the Glimmer pops
  // up right there; then the card comes in beside it (below it on a phone)
  const narrowNow = () => innerWidth < 760;
  const HATCH_VIEW = (): View => (narrowNow() ? { top: 0.1, bottom: 0.6, left: 0, right: 1 } : { top: 0.1, bottom: 0.9, left: 0.18, right: 0.82 });
  const CARD_VIEW = (): View => (narrowNow() ? { top: 0.08, bottom: 0.46, left: 0, right: 1 } : { top: 0.08, bottom: 0.92, left: 0.04, right: 0.56 });
  function onResize() { if (scene) scene.view = hm ? HATCH_VIEW() : CARD_VIEW(); }
  const tick = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
  // a special egg (the 100-Glimmer ladder): its own painting
  const eggSrc = (e: Egg) => `${base}game/egg-${e.kind && e.glimmer ? e.kind : e.rarity}.webp`;

  async function run() {
    const egg = advView(p).incubator[slot];
    if (!egg) { onclose(); return; }
    // every hatch starts on a clean stage: the Glimmer from the last one and its light are gone
    scene?.clear();
    if (scene) scene.view = HATCH_VIEW();
    // the egg rises out of its nest into the light, over the stage where its Glimmer will stand
    const src = eggSrc(egg);
    eggImg = new Image(); eggImg.src = src;
    try { await eggImg.decode(); } catch { /* drawn when it arrives */ }
    const v = HATCH_VIEW();
    const W = narrowNow() ? 160 : Math.round(Math.min(250, innerHeight * 0.3)), H = Math.round(W * (eggImg.naturalHeight || 420) / (eggImg.naturalWidth || 328));
    hm = { rarity: egg.rarity, src, w: W, h: H, x: ((v.left + v.right) / 2) * innerWidth, y: ((v.top + v.bottom) / 2) * innerHeight };
    // the 3D egg, if this computer can draw it (each egg cracks its own way)
    is3d = true; await tick();
    egg3 = eggCanvas && eggImg?.naturalWidth ? await EggHatch.create(eggCanvas, eggImg, RCOL[egg.rarity] ?? '#fff3c4', Math.floor(Math.random() * 1e6)) : null;
    if (closed) { egg3?.dispose(); egg3 = null; return; }
    if (egg3) { egg3.place(hm.x, hm.y, H); egg3.start(); } else is3d = false;
    if (import.meta.env.DEV) (window as unknown as { __egg: EggHatch | null }).__egg = egg3;
    rise = 0; await tick(); rise = 1;
    sfx.pop();
    wobbleLoop();
    await wait(1100);
    // three cracks, each bigger, each with a squash and more light leaking out
    for (let i = 1; i <= 3; i++) {
      step = i; if (egg3) egg3.crack(i); else growTo(i); sfx.crack(i); glow = i / 3;
      squash = 0.93; setTimeout(() => (squash = 1), 110);
      await wait(i < 3 ? 650 : 750);
    }
    // it bursts: the shell flies apart, light and sparkles pour out
    let h: Hatch | null = null;
    game.update(pp => { h = hatch(pp, slot); });
    const res = h as Hatch | null;
    cancelAnimationFrame(raf);
    sfx.crack(4); if (egg3) { egg3.burst(); broken = true; flash = true; burstSparks(); } else burstShell();
    if (!res) { await wait(900); dropEgg(); onhatched?.(null); onclose(); return; }
    sfx.reveal(rarityRank(res.rarity)); burst++;
    scene?.show(res.id, true);
    // (the 3D shell takes a moment longer to fall away)
    await wait(scene ? 1500 : egg3 ? 1250 : 700);
    dropEgg();
    // the card flips in once the Glimmer has popped up on its stone (beside it, so it stays in view)
    got = res;
    if (scene) scene.view = CARD_VIEW();
    onhatched?.(res);
  }
  function close() { if (closed) return; closed = true; sfx.click(); onclose(); }
  function seeIt() { close(); game.glimmerTab = 'team'; game.visit('glimmers'); }

  // opened over a results screen, the moment has the keyboard to itself (Enter there means Next)
  function onKey(e: KeyboardEvent) {
    if (!see) return;
    e.stopImmediatePropagation();
    if (got && (e.key === 'Escape' || e.key === 'Enter')) { e.preventDefault(); close(); }
  }
  onMount(() => {
    addEventListener('keydown', onKey, true);
    addEventListener('resize', onResize);
    preloadSfx('egg-crack-1', 'egg-crack-2', 'egg-crack-3', 'egg-crack-4');
    void run();
  });
  onDestroy(() => { closed = true; cancelAnimationFrame(raf); egg3?.dispose(); egg3 = null; removeEventListener('keydown', onKey, true); removeEventListener('resize', onResize); });
</script>

<div class="hatchwrap" class:own={!scene}>
  {#if hm}
    {@const H = hm}
    <div class="hatchmoment" class:lit={rise > 0} style:--rc={RCOL[H.rarity]}>
      <div class="hdim"></div>
      <div class="hglow" style:left="{H.x}px" style:top="{H.y}px" style:opacity={broken ? 0 : 0.35 + glow * 0.65} style:--k={1 + glow * 0.6}></div>
      {#if broken}<div class="hrays" style:left="{H.x}px" style:top="{H.y}px"></div>{/if}
      {#if is3d}<canvas class="egg3d" bind:this={eggCanvas}></canvas>{/if}
      <div class="hegg" class:gone={is3d} style:left="{H.x}px" style:top="{H.y}px" style:width="{H.w}px" style:height="{H.h}px"
        style:transform="translate(-50%, {rise ? '-50%' : '40%'}) scale({rise ? 1 : 0.55})">
        {#if !broken}
          <div class="hwob" style:transform="rotate({tilt}deg) scaleY({squash})">
            <img src={H.src} alt="" draggable="false" />
            <canvas bind:this={crackCanvas} style:width="{H.w}px" style:height="{H.h}px"></canvas>
          </div>
        {/if}
      </div>
      {#each pieces as pc, k (k)}
        <img class="piece" src={H.src} alt="" draggable="false"
          style:left="{H.x - H.w / 2}px" style:top="{H.y - H.h / 2}px" style:width="{H.w}px" style:height="{H.h}px"
          style:clip-path="polygon({pc.poly})" style:transform-origin="{pc.cx}% {pc.cy}%" style:opacity={pc.o}
          style:transform="translate({pc.x}px, {pc.y}px) rotate({pc.r}deg)" />
      {/each}
      {#if flash}<div class="hflash" style:left="{H.x}px" style:top="{H.y}px"></div>{/if}
      {#each sparks as sp (sp.id)}
        {#if sp.star}<img class="spark" src="{base}game/icon-star.webp" alt="" style:left="{H.x}px" style:top="{H.y}px" style:width="{sp.s}px" style:--dx="{sp.dx}px" style:--dy="{sp.dy}px" style:animation-delay="{sp.d}s" />
        {:else}<i class="spark dot" style:left="{H.x}px" style:top="{H.y}px" style:width="{sp.s * 0.6}px" style:height="{sp.s * 0.6}px" style:--dx="{sp.dx}px" style:--dy="{sp.dy}px" style:animation-delay="{sp.d}s"></i>{/if}
      {/each}
    </div>
  {/if}

  {#if got}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="hatched r-{got.rarity}" class:mid={!scene} onclick={see ? undefined : close}>
      <div class="hcol">
        <div class="rt"><small>{got.special ? 'Something special hatched!' : 'It hatched!'}</small><b>{RARITY[got.rarity].name}</b></div>
        <div class="flip"><GlimmerCard id={got.id} width={innerWidth < 760 ? 120 : 190} level={got.level} shine /></div>
        <div class="msg card">
          <h2>{GLIMMER[got.id].name}{got.isNew ? ' joined your team!' : ''}</h2>
          <p>{got.isNew ? `${GLIMMER[got.id].power.name}: ${GLIMMER[got.id].power.text(1)}` : `You have one already: stardust! ${GLIMMER[got.id].name} is level ${got.level}.`}</p>
          {#if see}
            <div class="go">
              <button class="btn" onclick={close}>OK</button>
              <button class="btn btn-primary" onclick={seeIt}><img src="{base}game/icon-spark.webp" alt="" />See it in My stuff</button>
            </div>
          {:else}<small>Tap to close</small>{/if}
        </div>
      </div>
    </div>
  {/if}
  <Confetti {burst} count={90} x={50} y={30} spread={1.6} />
</div>

<style>
  /* anywhere but the incubator: over the whole screen, which steps back */
  .hatchwrap.own { position: fixed; inset: 0; z-index: 60; background: rgba(30, 20, 60, .3); -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px); animation: fade-up .25s ease; }
  .hatchmoment { position: fixed; inset: 0; z-index: 19; pointer-events: none; }
  .hdim { position: absolute; inset: 0; background: radial-gradient(circle at 50% 40%, transparent 20%, rgba(25, 15, 50, .45) 75%); opacity: 0; transition: opacity .5s; }
  .lit .hdim { opacity: 1; }
  .hglow { position: absolute; width: 360px; height: 360px; margin: -180px 0 0 -180px; border-radius: 50%; background: radial-gradient(circle, color-mix(in srgb, var(--rc) 80%, #fff) 0%, color-mix(in srgb, var(--rc) 45%, transparent) 35%, transparent 70%); transform: scale(var(--k)); transition: opacity .3s, transform .3s; filter: blur(4px); }
  .hrays { position: absolute; width: 900px; height: 900px; margin: -450px 0 0 -450px; background: repeating-conic-gradient(from 0deg, color-mix(in srgb, var(--rc) 70%, transparent) 0 7deg, transparent 7deg 20deg); mask: radial-gradient(circle, #000 10%, transparent 58%); -webkit-mask: radial-gradient(circle, #000 10%, transparent 58%); animation: rays 1.4s ease-out forwards; }
  @keyframes rays { 0% { opacity: 0; transform: scale(.2) rotate(0); } 25% { opacity: 1; } 100% { opacity: 0; transform: scale(1.1) rotate(40deg); } }
  .hegg { position: absolute; transition: transform .55s cubic-bezier(.2, 1.3, .4, 1); }
  .hegg.gone { visibility: hidden; }
  .egg3d { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
  .hwob { position: absolute; inset: 0; transform-origin: 50% 90%; }
  .hegg img, .hegg canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
  .hegg img { filter: drop-shadow(0 14px 18px rgba(0, 0, 0, .35)); }
  .piece { position: absolute; filter: drop-shadow(0 6px 8px rgba(0, 0, 0, .3)); will-change: transform; }
  .hflash { position: absolute; width: 520px; height: 520px; margin: -260px 0 0 -260px; border-radius: 50%; background: radial-gradient(circle, #fff 0%, color-mix(in srgb, var(--rc) 70%, #fff) 25%, transparent 62%); animation: hflash .9s ease-out forwards; }
  @keyframes hflash { 0% { opacity: 0; transform: scale(.2); } 15% { opacity: 1; } 100% { opacity: 0; transform: scale(1.3); } }
  .spark { position: absolute; transform: translate(-50%, -50%); animation: spark 1.1s cubic-bezier(.15, .8, .3, 1) both; filter: drop-shadow(0 0 6px #fff); }
  .spark.dot { border-radius: 50%; background: radial-gradient(circle, #fff, var(--rc) 60%, transparent 70%); }
  @keyframes spark { 0% { opacity: 0; transform: translate(-50%, -50%) scale(.3); } 12% { opacity: 1; } 100% { opacity: 0; transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1) rotate(160deg); } }
  .hatched { position: fixed; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: flex-end; padding: 0 5vw; background: linear-gradient(90deg, transparent 45%, rgba(30, 20, 60, .45)); cursor: pointer; }
  .hcol { width: min(440px, 40vw); display: flex; flex-direction: column; align-items: center; gap: 10px; }
  /* no 3D Glimmer beside it: the card in the middle, with light behind it */
  .hatched.mid { justify-content: center; background: radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--rc) 35%, transparent), transparent 55%); cursor: default; }
  .hatched.mid .hcol { width: min(460px, 92vw); }
  .rt { text-align: center; animation: pop .7s cubic-bezier(.2, 1.4, .4, 1) both; }
  .rt small { display: block; font: 600 22px var(--font-ui); color: #fff; text-shadow: 0 2px 8px rgba(0, 0, 0, .5); }
  .rt b { font: 600 clamp(46px, 8vw, 84px)/1 var(--font-ui); color: var(--rc); -webkit-text-stroke: 3px #fff; paint-order: stroke; text-shadow: 0 6px 0 rgba(0, 0, 0, .25), 0 0 40px var(--rc); }
  .r-common { --rc: #7d8494; } .r-uncommon { --rc: #3fbf73; } .r-rare { --rc: #2f8ef0; } .r-epic { --rc: #a061f0; } .r-legendary { --rc: #f0b21f; } .r-mythic { --rc: #ff5fb0; }
  .flip { animation: flip .9s .2s cubic-bezier(.2, 1.2, .4, 1) both; }
  @keyframes flip { from { opacity: 0; transform: perspective(800px) rotateY(180deg) scale(.5); } }
  @keyframes pop { from { opacity: 0; transform: scale(.4); } }
  .msg { padding: 10px 18px; text-align: center; max-width: 520px; cursor: default; }
  .msg h2 { margin: 0; font-size: 24px; } .msg p { margin: 4px 0; font-weight: 600; color: var(--ink2); } .msg small { color: var(--muted); font-weight: 700; }
  .go { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-top: 8px; }
  .go .btn { display: inline-flex; align-items: center; gap: 6px; }
  .go img { width: 26px; height: 26px; object-fit: contain; }
  @media (max-width: 760px) {
    .hatched { align-items: flex-end; justify-content: center; padding: 0 12px 4vh; background: linear-gradient(transparent 45%, rgba(30, 20, 60, .5)); }
    .hatched.mid { align-items: center; }
    .hcol { width: 100%; gap: 6px; }
    .rt b { font-size: 40px; } .rt small { font-size: 17px; }
    .msg { padding: 8px 12px; } .msg h2 { font-size: 19px; } .msg p { font-size: 14px; }
  }
</style>
