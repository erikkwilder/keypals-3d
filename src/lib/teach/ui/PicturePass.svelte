<script lang="ts">
  // A student's picture password: the two pictures in order, numbered, with their names.
  import { PICTURES, pictureSrc } from '../names';
  type Props = { pics: number[]; size?: number; names?: boolean };
  let { pics, size = 54, names = true }: Props = $props();
</script>

<span class="pp" style:--sz="{size}px">
  {#each pics.slice(0, 2) as n, i (i)}
    <span class="pic"><b>{i + 1}</b><img src={pictureSrc(n)} alt={PICTURES[n]?.name ?? ''} />{#if names}<small>{PICTURES[n]?.name}</small>{/if}</span>
  {/each}
</span>

<style>
  .pp { display: inline-flex; gap: 8px; align-items: flex-start; }
  .pic { position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .pic img { width: var(--sz); height: var(--sz); object-fit: contain; border-radius: 14px; background: #f6f2ff; border: 2px solid #e4dbfa; padding: 3px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .pic b { position: absolute; top: -6px; left: -6px; width: 20px; height: 20px; border-radius: 50%; background: #7c5cf5; color: #fff; font: 800 12px/20px var(--font-body); text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .pic small { font: 700 11px var(--font-body); color: #4a4061; }
</style>
