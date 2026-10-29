<script lang="ts">
  // A fraction written the school way: the top number over a bar over the bottom number. A missing
  // number is a box (with what's been typed into it, and a ring when it's the one being typed).
  type Props = { n: number | null | string; d: number | null | string; size?: number; focus?: 'n' | 'd' | null };
  let { n, d, size = 48, focus = null }: Props = $props();
  const blank = (v: unknown) => v === null || v === '';
</script>

<span class="frac" style:--fs="{size}px">
  <span class="num" class:box={blank(n) || focus === 'n'} class:focus={focus === 'n'}>{blank(n) ? '' : n}</span>
  <span class="bar"></span>
  <span class="num" class:box={blank(d) || focus === 'd'} class:focus={focus === 'd'}>{blank(d) ? '' : d}</span>
</span>

<style>
  .frac { display: inline-flex; flex-direction: column; align-items: center; vertical-align: middle; font: 600 var(--fs)/1 var(--font-ui); color: var(--ink); gap: calc(var(--fs) * .06); }
  .num { min-width: calc(var(--fs) * .7); text-align: center; padding: 0 calc(var(--fs) * .08); }
  .bar { align-self: stretch; height: calc(var(--fs) * .09); min-width: calc(var(--fs) * .8); border-radius: 99px; background: var(--ink); }
  .box { min-width: calc(var(--fs) * .95); min-height: calc(var(--fs) * 1.05); border-radius: calc(var(--fs) * .24); background: #fff; box-shadow: inset 0 0 0 3px #d7ccef; display: grid; place-items: center; }
  .box.focus { box-shadow: inset 0 0 0 4px #a98cff, 0 0 0 5px #efe9ff; }
</style>
