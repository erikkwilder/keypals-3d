<script lang="ts">
  // Shape Builder: a calm Playground toy. A wooden geoboard on the crystal workshop's table: tap pegs to
  // stretch a glowing band from peg to peg, tap the first peg again to close it, and the game names what
  // you made (a right triangle, a trapezoid, a hexagon), its sides, corners and angles, its lines of
  // symmetry and its area. Twelve builds to try ("Build a rhombus"), each one done for good once made. No
  // clock, no score; a build you've met as a skill counts in its memory.
  import PauseButton from '../ui/PauseButton.svelte';
  import { onDestroy, onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { sfx, musicEnergy } from '../audio/sound';
  import { stage } from '../three/stage';
  import { GeoboardScene } from '../three/geoboardScene';
  import { angleKind, clean, factsOf, selfCrosses, type P } from '../math/shapes/geo';
  import { BUILDS, buildNamed, builderOf, noteBuild, shapeWords } from '../math/shapes/builder';
  import { ruleOk, ruleShort } from '../math/shapes/rules';
  import { FRIEND } from '../art/cast';
  import Icon from '../ui/Icon.svelte';
  import Confetti from '../ui/Confetti.svelte';

  const base = import.meta.env.BASE_URL;
  const p = $derived(game.profile!);
  const buddy = $derived(p.buddy);
  let canvas: HTMLCanvasElement | undefined = $state();
  let scene: GeoboardScene | null = null;
  let pts = $state<P[]>([]);
  let closed = $state(false);
  let burst = $state(0);
  let bubble = $state('Tap the pegs to stretch a band. Tap the first peg again to close your shape!');
  let target = $state(0);
  let labels = $state<{ x: number; y: number; text: string; k: string }[]>([]);
  let disposed = false;
  let raf = 0;
  const tints = ['teal', 'violet', 'rose', 'gold', 'sky', 'mint'] as const;
  let tintI = 0;

  const done = $derived(new Set(builderOf(p).done ?? []));
  const facts = $derived(closed && pts.length >= 3 && !selfCrosses(clean(pts)) ? factsOf(pts) : null);

  onMount(() => {
    stage.use(null);
    musicEnergy(0.3);
    if (canvas) GeoboardScene.create(canvas).then(s => {
      if (disposed) { s.dispose(); return; }
      scene = s;
      if (import.meta.env.DEV) (window as unknown as { __geo: GeoboardScene }).__geo = s;
      raf = requestAnimationFrame(tick);
    });
    target = Math.max(0, BUILDS.findIndex(b => !done.has(b.id)));
    addEventListener('resize', onResize);
  });
  onDestroy(() => { disposed = true; cancelAnimationFrame(raf); removeEventListener('resize', onResize); scene?.dispose(); scene = null; musicEnergy(0.5); });
  function onResize() { scene?.resize(); }
  /** the angle words pinned at each corner follow the board on screen */
  function tick() {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    if (!scene || !facts) { if (labels.length) labels = []; return; }
    const ps = clean(pts);
    labels = ps.map((q, i) => { const s = scene!.pegScreen(q); const a = facts.angles[i]; return { x: s.x, y: s.y - 30, text: `${Math.round(a)}°`, k: angleKind(a) }; });
  }

  function tap(e: PointerEvent) {
    if (!scene) return;
    const q = scene.pegNear(e.clientX, e.clientY);
    if (!q) return;
    const same = (a: P, b: P) => a[0] === b[0] && a[1] === b[1];
    if (closed) { closed = false; pts = []; }
    if (pts.length >= 3 && same(q, pts[0])) { close(); return; }
    if (pts.length && same(q, pts[pts.length - 1])) { pts = pts.slice(0, -1); sfx.click(); scene.setBand(pts, false); return; }
    if (pts.some(x => same(x, q))) { sfx.nope(); bubble = 'That peg is in your band already. Tap the first peg to close the shape!'; return; }
    pts = [...pts, q];
    sfx.pop(); scene.pop(q);
    scene.setBand(pts, false);
    if (pts.length === 1) bubble = 'Now another peg!';
    else if (pts.length === 3) bubble = 'Tap the first peg (it\'s blinking) to close your shape. Or keep going!';
  }
  function close() {
    if (!scene || pts.length < 3) return;
    const c = clean(pts);
    if (c.length < 3 || selfCrosses(c)) { sfx.nope(); bubble = 'The band crosses itself, so it isn\'t a shape. Take a peg back and try again!'; return; }
    closed = true;
    scene.setBand(pts, true);
    sfx.twinkle();
    const f = factsOf(pts);
    // a build done? (the one asked for, or any other still to do)
    const made = BUILDS.filter(b => !done.has(b.id) && ruleOk(b.rule, pts));
    if (made.length) {
      const first = made.find(b => b.id === BUILDS[target]?.id) ?? made[0];
      game.update(pp => { for (const b of made) noteBuild(pp, b.id, true); });
      burst++; sfx.complete(); scene.celebrate(pts);
      bubble = `You built ${buildNamed(first)}! ${shapeWords(f)}`;
      target = Math.max(0, BUILDS.findIndex(b => !builderOf(game.profile!).done?.includes(b.id)));
    } else {
      bubble = `That's ${f.name === 'quadrilateral' ? 'a quadrilateral' : f.name.match(/^[aeiou]/) ? `an ${f.name}` : `a ${f.name}`}! ${shapeWords(f)}`;
    }
  }
  function undo() { if (!scene) return; sfx.click(); if (closed) { closed = false; scene.setBand(pts, false); return; } pts = pts.slice(0, -1); scene.setBand(pts, false); }
  function clearAll() { if (!scene) return; sfx.whoosh(); closed = false; pts = []; scene.setBand([], false); bubble = 'A fresh board! Tap a peg to start.'; }
  function newColour() { if (!scene) return; tintI = (tintI + 1) % tints.length; scene.tint = tints[tintI]; scene.setBand(pts, closed); sfx.click(); }
  function back() { sfx.click(); game.leaveActivity(); }
  function onKey(e: KeyboardEvent) {
    if (game.modalOpen) return;
    
    else if (e.key === 'Backspace') { e.preventDefault(); undo(); }
    else if (e.key === 'Enter') { e.preventDefault(); close(); }
  }
  const doneCount = $derived(BUILDS.filter(b => done.has(b.id)).length);
  const nameWord = $derived(facts ? facts.name.charAt(0).toUpperCase() + facts.name.slice(1) : '');
</script>

<svelte:window onkeydown={onKey} />

<div class="screen sb" style:background-image="url({base}learn/ep/set-peaks.webp)">
  <canvas class="three" bind:this={canvas} onpointerdown={tap}></canvas>
  {#each labels as l, i (i)}<span class="ang a-{l.k}" style:left="{l.x}px" style:top="{l.y}px">{l.text}</span>{/each}

  <PauseButton />
  <div class="top">
    <div class="title"><img src="{base}math/shapes/tile.webp" alt="" /><b>Shape Builder</b><small>{doneCount} of {BUILDS.length} builds</small></div>
  </div>

  <div class="pal">
    <img src="{base}portraits/{buddy}-head.png" alt="" />
    {#key bubble}<p class="bub"><b>{FRIEND[buddy].name}</b>{bubble}</p>{/key}
  </div>

  <aside class="side">
    {#if facts}
      <div class="named">
        <small>You made</small>
        <h2>{nameWord}</h2>
        <ul>
          <li><b>{facts.sides}</b> sides · <b>{facts.corners}</b> corners</li>
          <li>{#each [[facts.right, 'right'], [facts.acute, 'acute'], [facts.obtuse, 'obtuse'], [facts.reflex, 'pointing in']].filter(x => x[0]) as [n, w], i (w)}{i ? ' · ' : ''}<b>{n}</b> {w}{/each} {facts.right + facts.acute + facts.obtuse + facts.reflex === 1 ? 'angle' : 'angles'}</li>
          <li><b>{facts.symmetry}</b> {facts.symmetry === 1 ? 'line' : 'lines'} of symmetry</li>
          <li>Area <b>{facts.area % 1 ? `${Math.floor(facts.area)}½` : facts.area}</b> squares</li>
          {#if facts.family.length > 2}<li class="fam">Also: {facts.family.filter(f => f !== facts.name && f !== 'polygon').join(', ')}</li>{/if}
        </ul>
      </div>
    {/if}
    <div class="builds">
      <h3>Builds <small>{doneCount} of {BUILDS.length}</small></h3>
      <div class="list">
        {#each BUILDS as b, i (b.id)}
          <button class="bt" class:on={i === target} class:done={done.has(b.id)} onclick={() => { target = i; sfx.click(); bubble = `Build ${buildNamed(b)}! ${b.tip}`; }}>
            {#if done.has(b.id)}<Icon name="check" size={16} />{:else}<span class="dot"></span>{/if}{ruleShort(b.rule)}
          </button>
        {/each}
      </div>
    </div>
    <div class="tools">
      <button class="tb" onclick={undo} disabled={!pts.length} aria-label="Take back a peg"><Icon name="replay" size={20} /></button>
      <button class="tb" onclick={clearAll} disabled={!pts.length} aria-label="Clear the board"><Icon name="erase" size={20} /></button>
      <button class="tb" onclick={newColour} aria-label="Another colour"><span class="sw sw-{tints[tintI]}"></span></button>
      <button class="btn btn-primary" onclick={close} disabled={pts.length < 3 || closed}>Close shape <span class="kbd">enter</span></button>
    </div>
  </aside>
  <Confetti {burst} count={60} x={40} y={40} spread={1.2} />
</div>

<style>
  .sb { background-size: cover; background-position: center 30%; background-color: #f3d9b0; user-select: none; -webkit-user-select: none; }
  .three { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: manipulation; cursor: pointer; }
  .top { position: absolute; left: 0; right: 0; top: 0; display: flex; align-items: center; gap: 12px; padding: 10px 14px; z-index: 5; pointer-events: none; }
  .top > * { pointer-events: auto; }
  .back { width: 46px; height: 46px; border-radius: 50%; border: 0; background: #fff; box-shadow: var(--shadow-sm); display: grid; place-items: center; cursor: pointer; }
  .title { display: flex; align-items: center; gap: 8px; background: rgba(255, 255, 255, .94); border-radius: 999px; padding: 4px 18px 4px 4px; box-shadow: var(--shadow-sm); }
  .title img { width: 40px; height: 40px; object-fit: contain; }
  .title b { font: 600 22px var(--font-ui); color: #1f7a6c; }
  .title small { font: 700 14px var(--font-body); color: var(--muted); }
  .pal { position: absolute; left: 14px; top: 76px; z-index: 4; display: flex; align-items: flex-start; gap: 8px; max-width: min(430px, 46vw); pointer-events: none; }
  .pal img { width: 120px; height: 120px; object-fit: contain; filter: drop-shadow(0 6px 10px rgba(80, 40, 10, .3)); }
  .bub { margin: 8px 0 0; background: #fff; border-radius: 22px; padding: 10px 16px; font: 600 17px/1.35 var(--font-body); color: var(--ink); box-shadow: 0 8px 22px rgba(80, 40, 10, .22); animation: pop .3s cubic-bezier(.3, .8, .4, 1.4); }
  .bub b { display: block; font: 700 11px var(--font-body); color: #1f9c8c; text-transform: uppercase; letter-spacing: .06em; }
  @keyframes pop { from { transform: scale(.85); opacity: 0; } }
  .ang { position: absolute; z-index: 3; transform: translate(-50%, -100%); font: 600 18px var(--font-ui); padding: 2px 8px; border-radius: 10px; background: #fff; box-shadow: 0 3px 8px rgba(60, 30, 10, .25); pointer-events: none; color: var(--ink); }
  .a-right { background: #fff6c8; color: #9b6200; box-shadow: 0 0 0 2px #ffc93d, 0 3px 8px rgba(60, 30, 10, .25); }
  .a-acute { color: #1f7a6c; } .a-obtuse { color: #b5306a; }
  .side { position: absolute; right: 14px; top: 76px; max-height: calc(100% - 90px); z-index: 4; width: min(330px, 34vw); display: flex; flex-direction: column; gap: 10px; }
  .named { background: rgba(255, 255, 255, .96); border-radius: 22px; padding: 12px 16px; box-shadow: var(--shadow-sm); animation: pop .3s cubic-bezier(.3, .8, .4, 1.4); }
  .named small { font: 800 11px var(--font-body); color: #1f9c8c; text-transform: uppercase; letter-spacing: .08em; }
  .named h2 { margin: 0 0 4px; font: 600 28px var(--font-ui); color: #4a2eb5; }
  .named ul { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 3px; font: 600 15px var(--font-body); color: var(--ink2); }
  .named b { color: var(--ink); font-family: var(--font-ui); }
  .fam { font-size: 13px; color: var(--muted); }
  .builds { background: rgba(255, 255, 255, .94); border-radius: 22px; padding: 10px 12px; box-shadow: var(--shadow-sm); overflow: auto; min-height: 0; flex: 0 1 auto; }
  .builds h3 { margin: 0 0 6px; font: 600 18px var(--font-ui); color: var(--ink); display: flex; justify-content: space-between; align-items: baseline; }
  .builds h3 small { font: 700 13px var(--font-body); color: var(--muted); }
  .list { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .bt { display: flex; align-items: center; gap: 6px; border: 2px solid #ece4fb; background: #fbf9ff; border-radius: 12px; padding: 6px 8px; font: 700 13px var(--font-body); color: var(--ink2); cursor: pointer; text-align: left; }
  .bt.on { border-color: #8b62f5; background: #f1ebff; color: #4a2eb5; box-shadow: 0 0 0 3px rgba(139, 98, 245, .2); }
  .bt.done { border-color: #9fe0bf; background: #ecfaf2; color: #1f7a44; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: #d9cff0; flex: none; }
  .tools { display: flex; align-items: center; gap: 8px; background: rgba(255, 255, 255, .94); border-radius: 22px; padding: 8px; box-shadow: var(--shadow-sm); }
  .tb { width: 42px; height: 42px; border-radius: 50%; border: 0; background: #f3eeff; display: grid; place-items: center; cursor: pointer; color: var(--ink); flex: none; }
  .tb:disabled { opacity: .45; cursor: default; }
  .tools .btn { flex: 1; font-size: 17px; padding: 10px 12px; }
  .sw { width: 22px; height: 22px; border-radius: 50%; box-shadow: inset 0 -3px 0 rgba(0, 0, 0, .15); }
  .sw-teal { background: #14b8a2; } .sw-violet { background: #8b62f5; } .sw-rose { background: #f2558f; } .sw-gold { background: #ffb21e; } .sw-sky { background: #3d9cf0; } .sw-mint { background: #3fc779; }

  @media (max-width: 760px) {
    .title b { font-size: 18px; } .title small { font-size: 12px; }
    .pal { top: 66px; max-width: calc(100vw - 28px); } .pal img { width: 64px; height: 64px; } .bub { font-size: 14px; padding: 8px 12px; }
    .side { top: auto; left: 10px; right: 10px; bottom: 10px; width: auto; max-height: 40vh; }
    .named { padding: 8px 12px; } .named h2 { font-size: 22px; } .named ul { font-size: 13px; }
    .builds { flex: none; max-height: 18vh; }
    .list { grid-template-columns: 1fr 1fr 1fr; }
    .bt { font-size: 11px; padding: 4px 6px; }
  }
  /* the one Pause button sits top left on every activity: the title chip starts after it */
  .top { padding-left: 76px; }
  @media (max-width: 600px) { .top { padding-left: 62px; } }
</style>
