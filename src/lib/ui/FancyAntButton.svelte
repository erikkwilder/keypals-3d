<script lang="ts">
  // Who made this, and where to find our other games. Opens fancyant.com in the browser.
  import { STUDIO_URL } from '../config';
  import { openExternal } from '../state/platform';
  import { sfx } from '../audio/sound';
  type Props = { variant?: 'pill' | 'round' };
  let { variant = 'pill' }: Props = $props();
  const go = () => { sfx.click(); openExternal(`${STUDIO_URL}/?ref=keypals`); };
</script>

{#if variant === 'round'}
  <button class="round" onclick={go} title="More games from FancyAnt" aria-label="More games from FancyAnt">
    <img src="brand/ant-mark.png" alt="" width="40" height="40" />
  </button>
{:else}
  <button class="pill" onclick={go} aria-label="Made by FancyAnt Games. More games at fancyant.com">
    <img src="brand/ant-mark.png" alt="" width="34" height="34" />
    <span class="by">Made by <b>FancyAnt Games</b></span>
    <span class="more">More games ›</span>
  </button>
{/if}

<style>
  button { cursor: pointer; font: inherit; color: var(--ink); }
  img { display: block; border-radius: 50%; transition: transform .25s cubic-bezier(.3, .8, .4, 1.6); }
  button:hover img { transform: translateY(-3px) rotate(-8deg) scale(1.06); }
  .round { display: grid; place-items: center; padding: 3px; border-radius: 50%; border: 3px solid #c9e6fb; background: #f2f9ff; box-shadow: 0 4px 0 #c9e6fb; }
  .round img { width: 40px; height: 40px; }
  .round:active { transform: translateY(3px); box-shadow: 0 1px 0 #c9e6fb; }
  .pill { display: inline-flex; align-items: center; gap: 10px; padding: 5px 8px 5px 5px; border-radius: 999px; border: 2px solid rgba(255, 255, 255, .9); background: rgba(255, 255, 255, .82); box-shadow: 0 6px 18px -8px rgba(60, 40, 110, .35); }
  .pill img { width: 34px; height: 34px; }
  .by { font: 600 14px var(--font-body); color: var(--ink2); }
  .by b { font-weight: 800; color: var(--ink); }
  .more { font: 800 13px var(--font-body); color: #fff; background: linear-gradient(135deg, #58b4f0, var(--primary)); padding: 6px 12px; border-radius: 999px; }
  .pill:hover .more { filter: brightness(1.08); }
</style>
