<script lang="ts">
  // A fraction written the school way: the top number over a bar over the bottom number. A missing
  // number is a box (with what's been typed into it, and a ring when it's the one being typed).
  // `drop`: the boxes take numbers dragged from the pad (data-drop 'n' and 'd', or both one slot such as
  // 'num' when this fraction's gap is a single number); `onpick`: tap a box to type in it. `bad`: a wrong
  // answer in the top, the bottom or both, red for a moment.
  type Props = { n: number | null | string; d: number | null | string; size?: number; focus?: 'n' | 'd' | null;
    drop?: { n?: string; d?: string } | null; onpick?: ((w: 'n' | 'd') => void) | null; bad?: 'n' | 'd' | 'both' | null };
  let { n, d, size = 48, focus = null, drop = null, onpick = null, bad = null }: Props = $props();
  const blank = (v: unknown) => v === null || v === '';
</script>

<span class="frac" style:--fs="{size}px">
  <span class="num" class:box2={blank(n) || focus === 'n' || bad === 'n' || bad === 'both'} class:focus={focus === 'n'} class:bad={bad === 'n' || bad === 'both'} class:pick={!!onpick && !!drop?.n} data-drop={drop?.n}
    onpointerdown={(e) => { if (onpick && drop?.n) { e.preventDefault(); onpick('n'); } }} role={onpick && drop?.n ? 'button' : undefined} aria-label={onpick && drop?.n ? 'Top number' : undefined}>{blank(n) ? '' : n}</span>
  <span class="bar"></span>
  <span class="num" class:box2={blank(d) || focus === 'd' || bad === 'd' || bad === 'both'} class:focus={focus === 'd'} class:bad={bad === 'd' || bad === 'both'} class:pick={!!onpick && !!drop?.d} data-drop={drop?.d}
    onpointerdown={(e) => { if (onpick && drop?.d) { e.preventDefault(); onpick('d'); } }} role={onpick && drop?.d ? 'button' : undefined} aria-label={onpick && drop?.d ? 'Bottom number' : undefined}>{blank(d) ? '' : d}</span>
</span>

<style>
  .frac { display: inline-flex; flex-direction: column; align-items: center; vertical-align: middle; font: 600 var(--fs)/1 var(--font-ui); color: var(--ink); gap: calc(var(--fs) * .06); }
  .num { min-width: calc(var(--fs) * .7); text-align: center; padding: 0 calc(var(--fs) * .08); }
  .bar { align-self: stretch; height: calc(var(--fs) * .09); min-width: calc(var(--fs) * .8); border-radius: 99px; background: var(--ink); }
  .box2 { min-width: calc(var(--fs) * .95); min-height: calc(var(--fs) * 1.05); border-radius: calc(var(--fs) * .24); background: #fff; box-shadow: inset 0 0 0 3px #d7ccef; display: grid; place-items: center; }
  .box2.focus { box-shadow: inset 0 0 0 4px #a98cff, 0 0 0 5px #efe9ff; }
  .box2.bad { color: #d6335c; background: #fff0f3; box-shadow: inset 0 0 0 4px #ff8aa5, 0 0 0 5px #ffe0e8; animation: nope .4s ease; }
  @keyframes nope { 20%, 60% { transform: translateX(-5px); } 40%, 80% { transform: translateX(5px); } }
  .pick { cursor: pointer; touch-action: none; }
  .pick:not(.focus):hover { box-shadow: inset 0 0 0 3px #c4b3f2; }
</style>
