<script lang="ts">
  // Make Ten Bubbles: bubbles bob gently in the water; tap two that add up to the number and they pop.
  // A wrong pair just wobbles. Eight pops a round, no clock. There's always a pair to find.
  import { onDestroy } from 'svelte';
  import { mulberry32 } from '../../engine/rng';
  import { sfx } from '../../audio/sound';
  import type { FriendId } from '../../art/cast';
  import type { PlayBuddy } from './buddy';
  import { bondPair, bondTarget, slipStars } from '../playground';

  type Props = { level: number; buddy: FriendId; ondone: (r: { stars: 1 | 2 | 3; ms: number }) => void; pal?: PlayBuddy };
  let { level, ondone, pal }: Props = $props();
  let corner: HTMLDivElement | undefined = $state();
  // the buddy about 100 pixels tall, whatever the corner's size
  $effect(() => { if (corner && pal) pal.area(corner, { span: Math.max(1.6, corner.getBoundingClientRect().width / 85), feetAt: 0.92 }); });
  const target = bondTarget(level);
  const rng = mulberry32(Date.now() % 1e9);
  const ROUND = 8, SLOTS = 12;
  const COLORS = ['#ff9ec7', '#9fd4ff', '#ffd27a', '#b9f0c8', '#d7c2ff', '#ffb38a'];
  type B = { id: number; n: number; slot: number; color: string; state: 'idle' | 'sel' | 'pop' | 'wrong'; delay: number };
  let bubbles = $state<B[]>([]);
  let nextId = 0, found = $state(0), slips = $state(0), cheer = $state(0);
  const t0 = performance.now();
  const timers: ReturnType<typeof setTimeout>[] = [];
  onDestroy(() => timers.forEach(clearTimeout));

  function freeSlots() { const used = new Set(bubbles.map(b => b.slot)); return Array.from({ length: SLOTS }, (_, k) => k).filter(k => !used.has(k)); }
  function add(n: number) {
    const free = freeSlots(); if (!free.length) return;
    const slot = free[Math.floor(rng() * free.length)];
    bubbles.push({ id: nextId++, n, slot, color: COLORS[Math.floor(rng() * COLORS.length)], state: 'idle', delay: rng() * 3 });
  }
  function addPair() { const [a, b] = bondPair(level, rng); add(a); add(b); }
  for (let k = 0; k < 4; k++) addPair();
  // every bubble keeps a partner on the field (a pop can mix two pairs)
  function topUp() {
    const left = ROUND - found;
    const live = bubbles.filter(b => b.state !== 'pop');
    for (const b of live) if (!live.some(o => o !== b && o.n + b.n === target) && freeSlots().length) add(target - b.n);
    while (bubbles.filter(b => b.state !== 'pop').length < Math.min(8, left * 2) && freeSlots().length >= 2) addPair();
  }
  function tap(b: B) {
    if (b.state === 'pop') return;
    const sel = bubbles.find(x => x.state === 'sel');
    if (!sel) { b.state = 'sel'; sfx.click(); return; }
    if (sel === b) { b.state = 'idle'; return; }
    if (sel.n + b.n === target) {
      sel.state = 'pop'; b.state = 'pop'; found++; cheer++; sfx.pop(); sfx.star(Math.min(2, found % 3)); pal?.cheer();
      const ids = [sel.id, b.id];
      timers.push(setTimeout(() => {
        bubbles = bubbles.filter(x => !ids.includes(x.id));
        if (found >= ROUND) { sfx.complete(); ondone({ stars: slipStars(slips), ms: performance.now() - t0 }); return; }
        topUp();
      }, 420));
    } else {
      slips++; sel.state = 'wrong'; b.state = 'wrong'; sfx.miss(); pal?.oops();
      timers.push(setTimeout(() => { for (const x of bubbles) if (x.state === 'wrong') x.state = 'idle'; }, 450));
    }
  }
  // full addresses: a relative url() inside a custom property resolves against the stylesheet's folder
  // (assets/) in the built site, so the pictures went missing there
  const art = (p: string) => new URL(import.meta.env.BASE_URL + p, document.baseURI).href;
  const pos = (slot: number) => ({ x: 8 + (slot % 4) * 24 + ((slot * 37) % 9) - 4, y: 10 + Math.floor(slot / 4) * 30 + ((slot * 53) % 9) - 4 });
</script>

<div class="bb">
  <div class="top">
    <span class="mk">Make <b>{target}</b></span>
    <span class="dots">{#each Array(ROUND) as _, k}<i class:done={k < found}></i>{/each}</span>
  </div>
  <div class="row">
  <div class="pond" role="group" aria-label="Bubbles" style:--pondart="url({art('math/pond.webp')})" style:--bubart="url({art('math/bubble.webp')})">
    {#each bubbles as b (b.id)}
      {@const p = pos(b.slot)}
      <button class="bub {b.state}" style:left="min({p.x}%, calc(100% - clamp(70px, 11vw, 104px) - 6px))" style:top="min({p.y}%, calc(100% - clamp(70px, 11vw, 104px) - 6px))" style:--c={b.color} style:--h="{(b.id * 67) % 360}deg" style:--d="{b.delay}s" onpointerdown={(e) => { e.preventDefault(); tap(b); }} aria-label={String(b.n)}>
        <span>{b.n}</span>
      </button>
    {/each}
  </div>
  <!-- your buddy stands here on the island, cheering every pop -->
  <div class="corner" bind:this={corner}></div>
  </div>
  <p class="tip">Tap two bubbles that make {target}.</p>
</div>

<style>
  .bb { width: min(980px, 100%); margin: 0 auto; display: flex; flex-direction: column; gap: 8px; }
  .top { display: flex; align-items: center; gap: 14px; }
  .top { background: rgba(255, 255, 255, .9); border-radius: 20px; padding: 4px 16px; box-shadow: var(--shadow-sm); }
  .mk { font: 600 clamp(28px, 4.6vw, 44px) var(--font-ui); color: var(--ink); }
  .mk b { color: #ef6fa6; font-size: 1.2em; }
  .dots { display: flex; gap: 5px; flex: 1; }
  .dots i { width: 14px; height: 14px; border-radius: 50%; background: #e6e0f2; transition: background .2s; }
  .dots i.done { background: #ef6fa6; }
  .cheer { display: block; animation: cheer .6s ease; }
  @keyframes cheer { 40% { transform: translateY(-14px) rotate(-6deg); } }
  .row { display: flex; gap: 12px; align-items: stretch; }
  .corner { flex: 0 0 clamp(150px, 20vw, 240px); }
  .pond { flex: 1; position: relative; height: clamp(320px, 52vh, 480px); border-radius: 28px; background: linear-gradient(rgba(190, 235, 250, .25), rgba(120, 200, 235, .35)), var(--pondart) center / cover; box-shadow: inset 0 0 0 4px #fff, 0 12px 30px -16px rgba(30, 90, 140, .5); overflow: hidden; touch-action: manipulation; }
  /* real soap bubbles: a see-through film with a rainbow rim (each one's colours turned a little), the
     number floating inside */
  .bub { position: absolute; width: clamp(70px, 11vw, 104px); aspect-ratio: 1; border: 0; padding: 0; border-radius: 50%; cursor: pointer; background: none; display: grid; place-items: center; animation: bob 3.6s var(--d) ease-in-out infinite, rise .5s ease-out both; transition: transform .15s, box-shadow .15s; -webkit-tap-highlight-color: transparent; }
  .bub::before { content: ''; position: absolute; inset: -4%; background: var(--bubart) center / contain no-repeat; filter: hue-rotate(var(--h)) drop-shadow(0 6px 8px rgba(20, 60, 90, .16)); pointer-events: none; }
  .bub span { position: relative; font: 600 clamp(26px, 4vw, 40px) var(--font-ui); color: #2a1f45; text-shadow: 0 0 8px #fff, 0 0 3px #fff, 0 1px 0 #fff; }
  .bub.sel { transform: scale(1.14); box-shadow: 0 0 0 4px rgba(255, 255, 255, .95), 0 0 0 8px #7c5cf5, 0 0 24px 8px rgba(255, 255, 255, .6); }
  .bub.wrong { animation: wobble .45s ease; }
  .bub.pop { animation: pop .42s ease-out forwards; pointer-events: none; }
  @keyframes bob { 0%, 100% { translate: 0 0; } 50% { translate: 0 -12px; } }
  @keyframes rise { from { opacity: 0; scale: .3; } to { opacity: 1; scale: 1; } }
  @keyframes wobble { 0%, 100% { rotate: 0deg; } 25% { rotate: -12deg; } 75% { rotate: 12deg; } }
  @keyframes pop { 0% { scale: 1.1; opacity: 1; } 35% { scale: 1.35; opacity: .9; } 100% { scale: 1.6; opacity: 0; filter: blur(3px); } }
  .tip { margin: 0; text-align: center; font: 700 15px var(--font-body); color: var(--muted); }
  .tip { background: rgba(255, 255, 255, .85); border-radius: 999px; padding: 3px 12px; align-self: center; }
  @media (max-width: 600px) { .row { flex-direction: column-reverse; } .corner { flex: 0 0 120px; } .pond { flex: none; height: 48vh; } }
</style>
