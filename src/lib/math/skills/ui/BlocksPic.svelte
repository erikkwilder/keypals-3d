<script lang="ts">
  // A number as painted base-ten blocks, the way a place value mat shows it: hundreds flats, then tens
  // rods standing up, then ones cubes in columns of five (thousands cubes first, when there are any). The
  // pictures are made from one painted block face, so every rod really has ten cubes and every flat ten
  // by ten. Lots of flats overlap like a fanned stack so a big number still fits.
  import type { Blocks } from '../types';
  type Props = { b: Blocks; size?: number };
  let { b, size = 150 }: Props = $props();
  const src = (k: string) => `${import.meta.env.BASE_URL}math/place/${k}.webp`;
  // the pictures' own proportions (block plus its painted side): a rod is 1 x 10 cubes, a flat 10 x 10
  const H = $derived(size);
  // (ten.webp is 84 x 660, hundred.webp and thousand.webp square, one.webp a cube with its side)
  const flatW = $derived(H);
  const cubeW = $derived(H * 0.112);
  const fan = (n: number) => (n > 2 ? 0.26 : 0.9);
  const label = $derived([b.th ? `${b.th} thousands` : '', b.h ? `${b.h} hundreds` : '', b.t ? `${b.t} tens` : '', b.o ? `${b.o} ones` : ''].filter(Boolean).join(', '));
  const cols = $derived(Array.from({ length: Math.ceil(b.o / 5) }, (_, c) => Math.min(5, b.o - c * 5)));
</script>

<span class="bp" style:--h="{H}px" role="img" aria-label={label}>
  {#if b.th}
    <span class="grp fan" style:width="{flatW * (1 + fan(b.th) * (b.th - 1))}px">
      {#each Array(b.th) as _, i (i)}<img src={src('thousand')} alt="" style:left="{i * flatW * fan(b.th)}px" style:width="{flatW}px" />{/each}
    </span>
  {/if}
  {#if b.h}
    <span class="grp fan" style:width="{flatW * (1 + fan(b.h) * (b.h - 1))}px">
      {#each Array(b.h) as _, i (i)}<img src={src('hundred')} alt="" style:left="{i * flatW * fan(b.h)}px" style:width="{flatW}px" />{/each}
    </span>
  {/if}
  {#if b.t}
    <span class="grp rods">{#each Array(b.t) as _, i (i)}<img src={src('ten')} alt="" />{/each}</span>
  {/if}
  {#if b.o}
    <span class="grp ones">
      {#each cols as n, c (c)}<span class="col">{#each Array(n) as _, i (i)}<img src={src('one')} alt="" style:width="{cubeW}px" />{/each}</span>{/each}
    </span>
  {/if}
</span>

<style>
  .bp { display: inline-flex; align-items: flex-end; gap: calc(var(--h) * .09); height: var(--h); }
  .grp { display: inline-flex; align-items: flex-end; height: 100%; }
  .grp img { display: block; user-select: none; -webkit-user-drag: none; }
  .fan { position: relative; }
  .fan img { position: absolute; bottom: 0; }
  .rods { gap: calc(var(--h) * .025); }
  .rods img { height: 100%; width: auto; object-fit: contain; }
  .ones { gap: calc(var(--h) * .02); }
  .col { display: flex; flex-direction: column-reverse; gap: calc(var(--h) * .012); }
</style>
