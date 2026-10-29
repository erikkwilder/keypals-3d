<script lang="ts">
  // The typing course's certificate: shown when the Graduation Test is passed, and printable (only the
  // certificate prints; the game behind it doesn't).
  import { FRIEND, type FriendId } from '../art/cast';
  import Critter from './Critter.svelte';
  import Icon from './Icon.svelte';

  type Props = { name: string; buddy: FriendId; wpm: number; acc: number; at: number; onclose: () => void };
  let { name, buddy, wpm, acc, at, onclose }: Props = $props();
  const date = new Date(at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="veil" onclick={onclose}>
  <div class="wrap" onclick={(e) => e.stopPropagation()}>
    <div class="cert" role="document" aria-label="Typing certificate">
      <div class="frame">
        <div class="ribbon">Keypals Typing</div>
        <h2>Certificate of Graduation</h2>
        <p class="this">This certifies that</p>
        <p class="who">{name}</p>
        <p class="did">finished the Keypals typing course, every key from the home row to the symbols, and passed the Graduation Test</p>
        <div class="nums">
          <span><b>{Math.round(wpm)}</b>words a minute</span>
          <span><b>{Math.round(acc * 100)}%</b>accuracy</span>
        </div>
        <div class="foot">
          <span class="date">{date}</span>
          <span class="bud"><Critter friend={buddy} size={96} /><small>with {FRIEND[buddy].name}</small></span>
          <span class="seal"><Icon name="star" size={40} /></span>
        </div>
      </div>
    </div>
    <div class="acts">
      <button class="btn btn-primary" onclick={() => window.print()}>Print it</button>
      <button class="btn" onclick={onclose}>Close</button>
    </div>
  </div>
</div>

<style>
  .veil { position: absolute; inset: 0; z-index: 40; display: grid; place-items: center; background: rgba(40, 28, 70, .45); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); padding: 12px; }
  .wrap { display: flex; flex-direction: column; align-items: center; gap: 12px; animation: pop-in .4s cubic-bezier(.3, .8, .4, 1.4); }
  .cert { width: min(760px, 94vw); aspect-ratio: 1.414; background: #fffdf6; border-radius: 10px; box-shadow: 0 20px 60px -20px rgba(0, 0, 0, .5); padding: 18px; }
  .frame { height: 100%; border: 3px solid #c9a227; outline: 1px solid #c9a227; outline-offset: -9px; border-radius: 4px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 18px 28px; gap: 4px; }
  .ribbon { font: 800 13px var(--font-body); letter-spacing: .2em; text-transform: uppercase; color: #fff; background: linear-gradient(135deg, #7c5cf5, #ef6fa6); padding: 5px 16px; border-radius: 999px; }
  h2 { margin: 8px 0 2px; font: 600 clamp(24px, 4.4vw, 40px) var(--font-ui); color: #3b2d55; }
  .this { margin: 4px 0 0; font: 600 15px var(--font-body); color: #6b5f80; }
  .who { margin: 0; font: 600 clamp(30px, 6vw, 54px)/1.1 var(--font-ui); color: #7c5cf5; border-bottom: 2px solid #e6dcc0; padding: 0 24px 4px; }
  .did { margin: 8px 0; max-width: 520px; font: 600 clamp(12px, 1.8vw, 16px)/1.4 var(--font-body); color: #4a405c; }
  .nums { display: flex; gap: 18px; }
  .nums span { display: flex; flex-direction: column; align-items: center; font: 700 12px var(--font-body); color: #6b5f80; }
  .nums b { font: 600 clamp(22px, 4vw, 34px)/1 var(--font-ui); color: #3b2d55; }
  .foot { width: 100%; display: flex; align-items: flex-end; justify-content: space-between; margin-top: 6px; }
  .date { font: 700 14px var(--font-body); color: #6b5f80; border-top: 1px solid #c9b98a; padding-top: 4px; min-width: 140px; }
  .bud { display: flex; flex-direction: column; align-items: center; }
  .bud small { font: 700 12px var(--font-body); color: #6b5f80; }
  .seal { width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; font-size: 30px; color: #fff; background: radial-gradient(circle at 35% 30%, #f7d774, #c9a227); box-shadow: 0 0 0 4px #fff3c4, 0 4px 10px rgba(0, 0, 0, .2); }
  .acts { display: flex; gap: 10px; }
  @media (max-width: 560px) { .cert { padding: 8px; } .frame { padding: 10px 12px; } .bud :global(.critter-host) { width: 56px !important; height: 56px !important; } .seal { width: 42px; height: 42px; font-size: 20px; } }
  @media print {
    :global(body *) { visibility: hidden !important; }
    .cert, .cert * { visibility: visible !important; }
    .veil { position: fixed; inset: 0; background: none; backdrop-filter: none; }
    .cert { position: fixed; left: 0; top: 0; width: 100vw; box-shadow: none; }
    .acts { display: none; }
  }
</style>
