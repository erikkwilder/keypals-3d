<script lang="ts">
  // The blocks in My Sky Island's catalogue: the pieces (a block, a half block, a ramp, stairs, an arch, a
  // pillar, a fence, a window, a door, glass), drawn in the paint you picked, and the paint box (colours,
  // wood, stone, brick, hedge, roof tiles, and the special paints a secret or a few shells unlock).
  // Basic blocks are free: the special paints show how to get them. The building itself is in
  // screens/SkyIsland.svelte, the rules in island/blocks.ts.
  import { PAINTS, SHAPES, type ShapeId } from './blocks';
  import { SECRET, type SecretId } from './secrets';

  type Props = {
    shape: ShapeId; paint: number; mats: number[]; thumbs: Record<string, string>; narrow: boolean;
    onshape: (s: ShapeId) => void; onpaint: (p: number) => void; onlocked: (p: number) => void;
  };
  let { shape, paint, mats, thumbs, narrow, onshape, onpaint, onlocked }: Props = $props();
  const base = import.meta.env.BASE_URL;
  const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
</script>

<div class="blocks">
  <div class="pieces">
    {#each SHAPES as s (s.id)}
      <button class="piece" class:on={shape === s.id} onclick={() => onshape(s.id)} title={s.blurb}>
        <span class="pic">{#if thumbs[`block:${s.id}:${paint}`]}<img src={thumbs[`block:${s.id}:${paint}`]} alt="" />{:else}<i class="wait"></i>{/if}</span>
        <span class="nm">{s.name}</span>
      </button>
    {/each}
  </div>
  <div class="paints">
    {#each PAINTS as p (p.id)}
      {@const locked = !!p.special && !mats.includes(p.id)}
      <button class="sw" class:on={paint === p.id} class:locked class:tex={p.kind !== 'plain'} title={locked ? `${p.name}: ${SECRET[p.special!.secret as SecretId].name.toLowerCase()} brings it, or ${p.special!.price} shells` : p.name}
        onclick={() => (locked ? onlocked(p.id) : onpaint(p.id))}>
        {#if p.kind === 'plain'}<span class="dot" style:--c={hex(p.color)}></span>
        {:else if thumbs[`block:cube:${p.id}`]}<img src={thumbs[`block:cube:${p.id}`]} alt="" />
        {:else}<i class="wait"></i>{/if}
        {#if locked}<img class="lock" src="{base}icons/lock.webp" alt="" />{/if}
      </button>
    {/each}
  </div>
</div>

<style>
  .blocks { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .pieces { display: flex; gap: 8px; overflow-x: auto; padding: 2px 2px 4px; scrollbar-width: thin; }
  .piece { flex: none; width: 92px; display: flex; flex-direction: column; align-items: center; gap: 1px; border: 0; background: #fff; border-radius: 18px; padding: 4px 4px 6px; cursor: pointer; box-shadow: inset 0 0 0 2px #efe7da, 0 4px 10px -6px rgba(80, 50, 30, .35); transition: transform .12s; }
  .piece:hover { transform: translateY(-2px); }
  .piece.on { box-shadow: inset 0 0 0 3px #ffb733, 0 6px 14px -6px rgba(200, 120, 0, .5); background: #fff8e6; }
  .pic { width: 100%; height: 64px; display: grid; place-items: center; background: radial-gradient(ellipse at 50% 80%, #e9f6dc 0%, #f7fbef 55%, #fff 75%); border-radius: 13px; }
  .pic img { width: 70px; height: 70px; object-fit: contain; }
  .nm { font: 600 13px/1.1 var(--font-ui); color: var(--ink); text-align: center; white-space: nowrap; }
  .wait { width: 26px; height: 26px; border-radius: 50%; background: #efe7da; animation: pulse 1s ease-in-out infinite; }
  @keyframes pulse { 50% { opacity: .4; } }
  .paints { display: flex; gap: 6px; align-items: center; overflow-x: auto; padding: 3px 2px 4px; scrollbar-width: thin; }
  .sw { position: relative; flex: none; width: 42px; height: 42px; border: 0; border-radius: 50%; background: #fff; display: grid; place-items: center; cursor: pointer; padding: 0; box-shadow: 0 0 0 2px #efe7da; }
  .sw.on { box-shadow: 0 0 0 3px #ffb733, 0 0 0 6px #fff3cf; transform: scale(1.08); }
  .sw .dot { width: 34px; height: 34px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--c) 45%, white) 0 18%, var(--c) 55%, color-mix(in srgb, var(--c) 72%, #3a2a1a) 100%); box-shadow: inset 0 -2px 3px rgba(0, 0, 0, .15); }
  .sw.tex { border-radius: 12px; }
  .sw img { width: 40px; height: 40px; object-fit: contain; }
  .sw.locked > img:not(.lock) { filter: saturate(.4) brightness(1.05); opacity: .7; }
  .sw .lock { position: absolute; right: -4px; bottom: -4px; width: 20px; height: 20px; }
  @media (max-height: 800px) {
    .piece { width: 82px; }
    .pic { height: 52px; }
    .pic img { width: 58px; height: 58px; }
    .sw { width: 38px; height: 38px; }
    .sw .dot { width: 30px; height: 30px; }
  }
</style>
