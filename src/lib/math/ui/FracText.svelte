<script lang="ts">
  // Words with fractions in them, the fractions written the school way (3/8 as a 3 over an 8). A mixed
  // number ("2 1/4") keeps its whole number beside the fraction. `size` is the fractions' size; the words
  // keep the size of the text round them. `inline` runs it in with the words round it (a speech bubble).
  import Frac from '../skills/ui/Frac.svelte';
  type Props = { text: string; size?: number; inline?: boolean };
  let { text, size = 30, inline = false }: Props = $props();
  type Part = { frac: true; n: string; d: string } | { frac: false; t: string };
  const parts = $derived(text.split(/([\d?]+\/\d+)/).filter(Boolean).map((t): Part => { const m = t.match(/^([\d?]+)\/(\d+)$/); return m ? { frac: true, n: m[1], d: m[2] } : { frac: false, t }; }));
</script>

<span class="ft" class:inline>{#each parts as p}{#if p.frac}<Frac n={p.n} d={p.d} {size} />{:else}<span>{p.t}</span>{/if}{/each}</span>

<style>
  .ft { display: inline-flex; align-items: center; gap: .18em; flex-wrap: wrap; justify-content: center; }
  .ft > span { white-space: pre-wrap; }
  .ft.inline { display: inline; }
  .ft.inline > span { white-space: normal; }
  .ft.inline > :global(.frac) { margin: 0 .12em; }
</style>
