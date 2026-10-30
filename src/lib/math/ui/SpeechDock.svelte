<script lang="ts">
  // The words being said in a Learn episode, in one fixed place at the top of the screen (they never move
  // with the 3D buddy, so they can be read while it talks): the story's words, or the buddy's own words
  // with its face and name. The episode keeps this band clear of the 3D work (DOCK_H).
  import { FRIEND, type FriendId } from '../../art/cast';
  import FracText from './FracText.svelte';

  type Props = { text: string; buddy?: FriendId | null; mood?: 'oops' | 'good' | null; narrow?: boolean };
  let { text, buddy = null, mood = null, narrow = false }: Props = $props();
  const base = import.meta.env.BASE_URL;
</script>

{#if text}
  <div class="dock" class:narrow>
    {#key text}
      <div class="say" class:buddy={!!buddy} class:oops={mood === 'oops'} class:good={mood === 'good'}>
        {#if buddy}<img class="face" src="{base}portraits/{buddy}-head.png" alt="" />{/if}
        <p>{#if buddy}<b>{FRIEND[buddy].name}</b>{/if}<FracText {text} size={narrow ? 15 : 21} inline /></p>
      </div>
    {/key}
  </div>
{/if}

<style>
  .dock { position: absolute; left: 0; right: 0; top: 70px; z-index: 3; display: flex; justify-content: center; padding: 0 18px; pointer-events: none; }
  .say { position: relative; display: flex; align-items: center; gap: 12px; max-width: min(780px, 100%); background: #fff; border-radius: 24px; padding: 10px 22px 12px; box-shadow: 0 0 0 3px #fff, 0 12px 26px -10px rgba(40, 20, 80, .55); animation: bub .3s cubic-bezier(.3, 1.4, .5, 1) both; }
  .say p { margin: 0; font: 600 22px/1.3 var(--font-ui); color: var(--ink); text-align: center; }
  .say.buddy { padding-left: 10px; text-align: left; }
  .say.buddy p { text-align: left; }
  .say b { display: block; font: 800 11px var(--font-body); letter-spacing: .08em; text-transform: uppercase; color: var(--sc, #7a5af5); }
  .face { width: 54px; height: 54px; flex: none; object-fit: contain; border-radius: 50%; background: radial-gradient(circle at 50% 40%, #fff7e6, #ffe2b0); box-shadow: inset 0 0 0 3px #ffd75e; }
  .say.oops { box-shadow: 0 0 0 4px #ffc2d6, 0 12px 26px -10px rgba(40, 20, 80, .55); }
  .say.good { box-shadow: 0 0 0 4px #9be7c4, 0 12px 26px -10px rgba(40, 20, 80, .55); }
  @keyframes bub { from { opacity: 0; scale: .96; } }
  .narrow { top: 52px; padding: 0 10px; }
  .narrow .say { gap: 8px; padding: 7px 14px 8px; border-radius: 18px; }
  .narrow .say.buddy { padding-left: 7px; }
  .narrow .say p { font-size: 15px; }
  .narrow .face { width: 38px; height: 38px; }
</style>
