<script lang="ts">
  // An algebra expression written out ("3n + 2", "2(x + 4)", "y = 3x − 1"): numbers and signs as they are,
  // the letters in italics and the area's violet, a box (□) for a missing number. Used in questions,
  // choices and the Learn episodes.
  type Props = { s: string; size?: number };
  let { s, size }: Props = $props();
  /** the expression in runs: letters, boxes, and everything else */
  const runs = $derived(s.split(/([a-zA-Z]|□)/).filter(Boolean).map(t => ({ t, k: t === '□' ? 'box' : /^[a-zA-Z]$/.test(t) ? 'v' : 'n' })));
</script>

<span class="ex" style:font-size={size ? `${size}px` : null}>{#each runs as r, i (i)}{#if r.k === 'v'}<i>{r.t}</i>{:else if r.k === 'box'}<b class="bx"></b>{:else}{r.t}{/if}{/each}</span>

<style>
  .ex { display: inline-block; white-space: nowrap; font-family: var(--font-ui); font-weight: 600; letter-spacing: .01em; }
  i { font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-weight: 700; color: #6c4fd8; padding: 0 .04em; }
  .bx { display: inline-block; width: .78em; height: .78em; margin: 0 .06em; vertical-align: -.06em; border-radius: .14em; background: linear-gradient(#a98cff, #6c4fd8); box-shadow: inset 0 -.08em 0 rgba(40, 10, 110, .35), 0 .06em .12em rgba(60, 30, 140, .3); }
</style>
