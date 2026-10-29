<script lang="ts">
  // A Glimmer's card: its painting inside a frame made for its rarity (silver, bronze, sapphire, amethyst,
  // gold, opal), its name on the plate, and on the back of the info its element, power and level. A Glimmer
  // you haven't met shows as a dark shape with a question mark. An evolved one shows its grown-up painting
  // and name with a gold star; one that's ready to evolve glows and says so.
  import { ELEMENT, GLIMMER, RARITY, glimmerName, type GlimmerId } from '../adventure/glimmers';
  type Props = { id: GlimmerId; width?: number; level?: number; locked?: boolean; shine?: boolean; fresh?: boolean; evolved?: boolean; ready?: boolean };
  let { id, width = 180, level, locked = false, shine = false, fresh = false, evolved = false, ready = false }: Props = $props();
  const g = $derived(GLIMMER[id]);
  const name = $derived(glimmerName(id, evolved));
  // each frame's picture window (measured from the frame art's see-through middle): left inset, top, bottom
  // of the window, the frame's width (out of 600 tall), and the right inset: the frames are a little
  // narrower on the right, so using the left inset there left a gap between the painting and the frame
  const BOX: Record<string, [number, number, number, number, number]> = {
    common: [7.9, 6.8, 83.0, 394, 4.3], uncommon: [8.8, 9.8, 84.7, 400, 4.5], rare: [7.7, 7.7, 84.0, 388, 4.1],
    epic: [10.4, 9.5, 82.7, 396, 6.6], legendary: [10.1, 13.7, 81.5, 396, 5.8], mythic: [12.7, 13.2, 83.7, 409, 9.0],
  };
  const box = $derived(BOX[g.rarity]);
  // the name fits its plate: smaller letters for small cards and long names
  const nameFs = $derived(Math.round(Math.min(17, width * 0.11, (width * 0.7 * 1.9) / Math.max(6, (locked ? 3 : name.length))) * 10) / 10);
  const base = import.meta.env.BASE_URL;
</script>

<div class="gc r-{g.rarity}" class:locked class:shine class:evolved class:ready style:width="{width}px" style:--glow={RARITY[g.rarity].color} style:aspect-ratio="{box[3]} / 600"
  style:--l="{box[0] - 1}%" style:--r="{box[4] - 1}%" style:--t="{box[1] - 1}%" style:--b="{100 - box[2] - 1}%">
  <div class="art" style:background-image="url({base}game/glimmers/{id}{evolved ? '-evo' : ''}.webp)"></div>
  <img class="frame" src="{base}game/frame-{g.rarity}.webp" alt="" draggable="false" />
  <img class="el" src="{base}game/icon-{g.element}.webp" alt={ELEMENT[g.element].name} title={ELEMENT[g.element].name} draggable="false" />
  {#if level && !locked}<span class="lv">Lv {level}</span>{/if}
  {#if fresh}<span class="new">New!</span>{/if}
  {#if evolved && !locked}<img class="evo" src="{base}game/icon-star.webp" alt="Evolved" title="Evolved" draggable="false" />{/if}
  {#if ready && !evolved && !locked}<span class="ready-tag" style:font-size="{Math.max(10, Math.min(15, width * 0.085))}px">Ready to evolve!</span>{/if}
  <div class="plate"><b style:font-size="{nameFs}px">{locked ? '???' : name}</b></div>
  {#if locked}<div class="q">?</div>{/if}
</div>

<style>
  .gc { position: relative; flex: none; filter: drop-shadow(0 10px 18px rgba(40, 20, 80, .28)); transition: transform .2s; }
  .art { position: absolute; left: var(--l); right: var(--r); top: var(--t); bottom: var(--b); border-radius: 6% / 4%; background-size: cover; background-position: center 40%; background-color: #e8eef8; }
  .frame { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; user-select: none; }
  .el { position: absolute; top: calc(var(--t) + 2%); left: calc(var(--l) + 2%); width: 20%; filter: drop-shadow(0 2px 3px rgba(0, 0, 0, .35)); }
  .lv { position: absolute; top: calc(var(--t) + 2.5%); right: calc(var(--r) + 2%); font: 700 clamp(10px, calc(var(--w, 180px) * 0.07), 15px) var(--font-ui); color: #fff; background: rgba(30, 20, 60, .7); padding: 2px 8px; border-radius: 999px; }
  .new { position: absolute; top: -4%; right: -4%; font: 800 12px var(--font-body); background: var(--pink, #ef6fa6); color: #fff; padding: 3px 9px; border-radius: 999px; box-shadow: 0 0 0 3px #fff; transform: rotate(8deg); }
  .plate { position: absolute; left: 14%; right: 14%; bottom: 5.5%; height: 9.5%; display: grid; place-items: center; }
  .plate b { font: 600 15px/1 var(--font-ui); color: #fff; text-shadow: 0 1px 2px rgba(0, 0, 0, .55); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  /* grown up: a gold star on the corner and a warm glow round the painting */
  .evo { position: absolute; left: -6%; top: -4%; width: 26%; filter: drop-shadow(0 2px 4px rgba(120, 70, 0, .45)); pointer-events: none; }
  .evolved .art { box-shadow: inset 0 0 0 2px rgba(255, 224, 120, .8), inset 0 0 18px rgba(255, 210, 90, .55); }
  /* ready to evolve: a gold pulse and a tag over the top of the frame */
  .ready { animation: readyglow 1.4s ease-in-out infinite; }
  @keyframes readyglow { 50% { filter: drop-shadow(0 0 14px #ffd36b) drop-shadow(0 10px 18px rgba(40, 20, 80, .28)); } }
  .ready-tag { position: absolute; left: 50%; top: -5%; transform: translateX(-50%); white-space: nowrap; font: 800 13px var(--font-body); color: #6a4300; background: linear-gradient(#ffe68a, #ffc93d); padding: 3px 10px; border-radius: 999px; box-shadow: 0 0 0 2px #fff, 0 4px 10px -4px rgba(120, 70, 0, .6); pointer-events: none; }
  .locked .art { filter: brightness(0) saturate(0) opacity(.55); }
  .locked .el { filter: grayscale(1) opacity(.5); }
  .q { position: absolute; left: 0; right: 0; top: 30%; text-align: center; font: 600 clamp(28px, 5vw, 56px) var(--font-ui); color: rgba(255, 255, 255, .85); text-shadow: 0 2px 8px rgba(0, 0, 0, .5); }
  .shine::after { content: ''; position: absolute; left: var(--l); right: var(--r); top: var(--t); bottom: var(--b); border-radius: 6% / 4%; background: linear-gradient(115deg, transparent 30%, rgba(255, 255, 255, .55) 45%, transparent 60%); background-size: 250% 100%; animation: sweep 2.2s ease-in-out infinite; mix-blend-mode: screen; pointer-events: none; }
  .r-mythic.shine .art { animation: hue 4s linear infinite; }
  @keyframes sweep { from { background-position: 120% 0; } to { background-position: -120% 0; } }
  @keyframes hue { 50% { filter: saturate(1.3) brightness(1.08); } }
</style>
