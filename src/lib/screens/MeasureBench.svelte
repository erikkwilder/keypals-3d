<script lang="ts">
  // The Measuring Bench: a calm toy in the Clockmaker's Workshop (no questions, no clock). Your buddy and
  // a Glimmer stand at the bench with a wooden ruler, a pencil and a crayon to slide along it, a kitchen
  // scale with a sack of carrots to lift on and off, and a glass jug to fill and empty. Slide a thing's
  // end to 0 and your buddy reads its length; put the sack on the pan and the needle swings; drag the
  // water up and down. "Something new" brings other lengths and another sack. The 3D things are the Learn
  // episodes' own (three/measureKit.ts) on the same table (three/episodeScene.ts).
  import { onDestroy, onMount } from 'svelte';
  import type { Vector3 } from 'three';
  import { stage, type Controller } from '../three/stage';
  import { EpisodeScene, type View } from '../three/episodeScene';
  import { MeasureKit } from '../three/measureKit';
  import { game } from '../state/game.svelte';
  import { AREA } from '../math/skills/registry';
  import { sfx } from '../audio/sound';
  import { advView, teamOf } from '../adventure/state';
  import { FRIEND } from '../art/cast';
  import type { GlimmerId } from '../adventure/glimmers';
  import type { Board } from '../math/learn';
  import { mSfx } from '../math/measure/sounds';
  import Icon from '../ui/Icon.svelte';

  const base = import.meta.env.BASE_URL;
  const buddy = game.profile!.buddy;
  const team = teamOf(advView(game.profile!));
  const star: GlimmerId = team[0]?.id ?? 'sunsnail';
  const CLEAR: Board = { cell: 48, dots: [], frames: [], plates: [], line: null, tags: [] };
  const NAMES = ['pencil', 'crayon'];

  let sc = $state<EpisodeScene | null>(null);
  let kit = $state<MeasureKit | null>(null);
  let ctl: Controller | null = null, before: Controller | null = null;
  let gone = false;
  let read = $state<{ items: { from: number; to: number; len: number }[]; weight: number; water: number }>({ items: [], weight: 0, water: 0 });
  let bubble = $state("Let's measure! Slide the pencil to 0 on the ruler.");
  let w = $state(1280), h = $state(800);
  const narrow = $derived(w < 760);
  let lastSaid = '';

  function talk(text: string) { if (text === lastSaid) return; lastSaid = text; bubble = text; sc?.talk(1.8); }
  /** the buddy says what was just measured */
  function noticed(prev: typeof read, now: typeof read) {
    now.items.forEach((it, i) => { if (it.from === 0 && prev.items[i]?.from !== 0) { talk(`The ${NAMES[i]} starts at 0 and ends at ${it.to}. It's ${it.len} centimetres long!`); sc?.cheer(); mSfx.chime(); } });
    if (now.weight && !prev.weight) { talk(`The needle stops at ${now.weight}. The sack weighs ${now.weight} grams!`); sc?.nod(); }
    if (!now.weight && prev.weight) talk('Off it comes. The needle goes back to 0.');
    if (now.water !== prev.water && Math.abs(now.water - prev.water) >= 100) talk(`The water is up to the ${now.water} line: ${now.water} millilitres.`);
  }
  function somethingNew() {
    if (!kit) return;
    sfx.whoosh(); mSfx.gears();
    const a = 4 + Math.floor(Math.random() * 6), b = 3 + Math.floor(Math.random() * 7);
    const wgt = 100 * (2 + Math.floor(Math.random() * 8));
    kit.restock([b, a], wgt);
    talk(`Something new! How long is the crayon now? Slide it to 0 and see.`);
    sc?.wave();
  }
  function fill(full: boolean) {
    if (!kit?.state.jug) return;
    sfx.click(); if (full) mSfx.pour(); else mSfx.tick();
    kit.set({ ...kit.state, jug: { ...kit.state.jug, value: full ? kit.state.jug.max - 100 : 0 } });
  }
  function leave() { sfx.click(); game.mathArea = 'measure'; game.mathOp = null; game.setHome('math'); game.go('map'); }

  function down(e: PointerEvent) { if (!kit?.pointer('down', e.clientX, e.clientY)) return; e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }
  function move(e: PointerEvent) { if (kit?.pointer('move', e.clientX, e.clientY)) e.preventDefault(); }
  function up(e: PointerEvent) { kit?.pointer('up', e.clientX, e.clientY); }
  function pin(node: HTMLElement, at: () => Vector3 | null) { sc?.pin(node, at); return { update(n: () => Vector3 | null) { sc?.pin(node, n); }, destroy() { sc?.unpin(node); } }; }
  function viewFor(): View { const H = h || 1; return { top: (narrow ? 58 : 72) / H, bottom: 1 - (narrow ? 130 : 110) / H, left: 0.01, right: 0.99 }; }
  $effect(() => { void w; void h; void narrow; sc?.setView(viewFor()); });
  function onKey(e: KeyboardEvent) { if (e.key === 'Escape') { e.preventDefault(); leave(); } }

  onMount(() => {
    stage.use(null);
    addEventListener('keydown', onKey);
    const own = advView(game.profile!).glimmers[star];
    void EpisodeScene.create({ setId: 'clockshop', buddy, star, evolved: !!own?.evolved }).then(async s => {
      if (gone) { s.dispose(); return; }
      const kt = new MeasureKit(s);
      kt.bench = true; kt.free = 'bench';
      await kt.load();
      if (gone) { s.dispose(); return; }
      ctl = { fps: 60, update: (dt, t) => { s.update(dt, t); kt.update(dt, t); }, focus: () => s.focus(), dispose: () => {} };
      before = stage.swap(ctl); s.enter();
      s.show(CLEAR, true); s.fit({ x: 50, y: 60, w: 500, h: 260 }); kt.refit();
      kt.set({
        ruler: { unit: 'cm', len: 15, items: [{ thing: 'pencil', from: 3, to: 12 }, { thing: 'crayon', from: 5, to: 11 }] },
        scale: { max: 1000, step: 100, label: 200, value: 700, unit: 'g', load: false },
        jug: { max: 1000, step: 100, label: 200, value: 300, unit: 'mL' },
      });
      kt.onChange = () => { const now = kt.readings(); noticed(read, now); read = now; };
      read = kt.readings();
      s.setView(viewFor());
      s.shot('wide'); s.wave(); s.palDo('happy');
      sc = s; kit = kt;
    }).catch(e => console.error(e));
  });
  onDestroy(() => {
    gone = true;
    removeEventListener('keydown', onKey);
    if (sc) { const s = sc; sc = null; kit?.dispose(); kit = null; if (stage.current() === ctl) stage.swap(before); s.dispose(); }
  });
</script>

<svelte:window bind:innerWidth={w} bind:innerHeight={h} />
<div class="bench" class:narrow style:--bg="url({base}learn/ep/set-clockshop.webp)">
  <div class="hit" onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} role="presentation"></div>
  <div class="vignette"></div>
  {#if !sc}<div class="loading"><div class="lcard"><small>The Clockmaker's Workshop</small><b>The Measuring Bench</b></div></div>{/if}
  {#if sc && kit}
    {#each read.items as it, i (i)}
      <div class="pin" use:pin={() => kit!.itemPoint(i)}><span class="tag on" class:gold={it.from === 0}>{it.from === 0 ? `${it.len} cm` : `${it.from} to ${it.to}`}</span></div>
    {/each}
    {#if read.weight}<div class="pin" use:pin={() => kit!.dialPoint()}><span class="tag gold">{read.weight} g</span></div>{/if}
    <div class="pin" use:pin={() => kit!.waterPoint()}><span class="tag water">{read.water} mL</span></div>
    {#key bubble}<div class="pin" use:pin={() => sc!.bubbleAt()}><div class="say"><b>{FRIEND[buddy].name}</b>{bubble}</div></div>{/key}
  {/if}
  <div class="top">
    <button class="back" onclick={leave} aria-label="Back to {AREA.measure.name}"><Icon name="back" size={26} /></button>
    <div class="title"><img src="{base}math/play-bench.webp" alt="" /><span><small>A toy · no clock</small><b>The Measuring Bench</b></span></div>
  </div>
  <div class="bottom">
    <button class="btn" onclick={() => fill(false)}>Empty the jug</button>
    <button class="btn" onclick={() => fill(true)}>Fill the jug</button>
    <button class="btn btn-primary btn-big" onclick={somethingNew}><Icon name="sparkle" size={22} /> Something new</button>
  </div>
</div>

<style>
  .bench { position: fixed; inset: 0; z-index: 2; overflow: hidden; user-select: none; -webkit-user-select: none; }
  .hit { position: absolute; inset: 0; touch-action: none; }
  .vignette { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse 85% 75% at 50% 45%, rgba(0, 0, 0, 0) 60%, rgba(60, 30, 10, .26) 100%); }
  .loading { position: absolute; inset: 0; display: grid; place-items: center; background: var(--bg) center / cover; }
  .lcard { display: flex; flex-direction: column; align-items: center; gap: 4px; background: rgba(255, 255, 255, .94); border-radius: 26px; padding: 18px 30px; box-shadow: var(--shadow); }
  .lcard small { font: 800 12px var(--font-body); letter-spacing: .1em; text-transform: uppercase; color: #8a6bd6; }
  .lcard b { font: 600 28px var(--font-ui); color: var(--ink); }
  .pin { position: absolute; left: 0; top: 0; width: 0; height: 0; pointer-events: none; z-index: 2; }
  .pin > * { position: absolute; left: 0; top: 0; transform: translate(-50%, -100%); white-space: nowrap; }
  .tag { font: 600 18px var(--font-ui); color: #4a2f00; background: rgba(255, 252, 240, .92); padding: 2px 10px; border-radius: 12px; box-shadow: 0 4px 10px rgba(80, 40, 0, .25); }
  .tag.gold { font-size: 24px; background: linear-gradient(#fffaf0, #ffe9a8); box-shadow: 0 0 0 3px #ffd75e, 0 6px 14px rgba(120, 70, 0, .3); }
  /* a thing's label sits on the thing itself, so it never covers the ruler */
  .pin > .tag.on { transform: translate(-50%, -50%); }
  .tag.water { color: #1b4a78; box-shadow: 0 0 0 3px #9fd0ff, 0 6px 14px rgba(20, 60, 120, .25); }
  .say { transform: translate(18px, -60%); white-space: normal; width: max-content; max-width: min(380px, 34vw); background: #fff; border-radius: 26px; padding: 10px 18px 12px; font: 600 20px/1.3 var(--font-ui); text-align: center; color: var(--ink); box-shadow: 0 0 0 3px #fff, 0 12px 26px -10px rgba(40, 20, 80, .55); animation: bub .35s cubic-bezier(.3, 1.4, .5, 1) both; }
  .say b { display: block; font: 800 11px var(--font-body); letter-spacing: .08em; text-transform: uppercase; color: #8a6bd6; }
  .say::before { content: ''; position: absolute; left: -12px; top: 50%; margin-top: -10px; border: 10px solid transparent; border-right-color: #fff; border-left: 0; }
  @keyframes bub { from { opacity: 0; scale: .9; } }
  .top { position: absolute; left: 0; right: 0; top: 0; display: flex; align-items: center; gap: 12px; padding: 12px 18px; z-index: 3; pointer-events: none; }
  .top > * { pointer-events: auto; }
  .back { width: 46px; height: 46px; border-radius: 50%; border: 0; background: #fff; box-shadow: var(--shadow-sm); display: grid; place-items: center; cursor: pointer; }
  .title { display: flex; align-items: center; gap: 10px; background: rgba(255, 255, 255, .92); border-radius: 18px; padding: 4px 16px 4px 4px; box-shadow: var(--shadow-sm); }
  .title img { width: 64px; height: 40px; object-fit: cover; border-radius: 12px; }
  .title small { display: block; font: 800 10px var(--font-body); letter-spacing: .08em; text-transform: uppercase; color: #8a6bd6; }
  .title b { font: 600 19px/1.1 var(--font-ui); color: var(--ink); }
  .bottom { position: absolute; left: 0; right: 0; bottom: 0; padding: 0 16px 18px; z-index: 3; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
  .narrow .say { font-size: 15px; max-width: 58vw; padding: 8px 12px 10px; transform: translate(10px, -40%); }
  .narrow .tag { font-size: 14px; } .narrow .tag.gold { font-size: 18px; }
  /* on a phone the pencil and crayon are small: their labels too, so they don't cover them */
  .narrow .tag.on { font-size: 11px; padding: 1px 6px; border-radius: 8px; } .narrow .tag.on.gold { font-size: 13px; box-shadow: 0 0 0 2px #ffd75e, 0 3px 8px rgba(120, 70, 0, .3); }
  .narrow .title b { font-size: 16px; } .narrow .title img { display: none; }
  .narrow .bottom .btn { font-size: 15px; padding: 10px 14px; }
  .narrow .bottom .btn-big { font-size: 17px; }
</style>
