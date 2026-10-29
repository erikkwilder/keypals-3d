<script lang="ts">
  // A save code card to print and keep (on the fridge, in a school folder): the player's buddy on a
  // painted island, the code in big friendly letters, and how to use it. Light and mostly white, so it
  // prints well on any printer; a dashed edge to cut along.
  import { showCode } from '../state/cloud.svelte';
  import { FRIEND, type FriendId } from '../art/cast';

  type Props = { name: string; buddy: FriendId; code: string };
  let { name, buddy, code }: Props = $props();
  const base = import.meta.env.BASE_URL;
  const words = $derived(showCode(code).split(' '));
  // (absolute addresses: relative url() in an inline style breaks on the built site)
  const sky = new URL(`${base}regions/village.webp`, document.baseURI).href;
</script>

<div class="codecard">
  <div class="art" style:background-image="url({sky})">
    <img class="buddy" src="{base}portraits/{buddy}.png" alt={FRIEND[buddy]?.name ?? ''} />
  </div>
  <div class="txt">
    <p class="kp">Keypals</p>
    <h2>{name}’s save code</h2>
    <div class="code">{#each words as w, i (i)}<span class:num={/^\d+$/.test(w)}>{w}</span>{/each}</div>
    <ol>
      <li>Go to <b>fancyant.com/keypals</b></li>
      <li>Tap <b>Already play on another computer?</b></li>
      <li>Type the words and the number</li>
    </ol>
    <p class="keep">Keep it safe, like a library card: anyone who has it can open {name}’s progress.</p>
  </div>
</div>

<style>
  .codecard { position: relative; width: 640px; max-width: 100%; display: grid; grid-template-columns: 220px 1fr; background: #fff; border: 3px dashed #cbbfe6; border-radius: 22px; overflow: hidden; color: #2b2140; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .art { background-size: cover; background-position: center; display: flex; align-items: flex-end; justify-content: center; min-height: 260px; }
  .buddy { width: 86%; max-height: 240px; object-fit: contain; filter: drop-shadow(0 6px 10px rgba(40, 20, 80, .25)); }
  .txt { padding: 18px 22px; display: flex; flex-direction: column; gap: 8px; }
  .kp { margin: 0; font: 800 13px var(--font-body); letter-spacing: .14em; text-transform: uppercase; color: #8a6fe0; }
  h2 { margin: 0; font: 600 26px/1.15 var(--font-ui); }
  .code { display: flex; flex-wrap: wrap; gap: 6px; }
  .code span { font: 600 26px var(--font-ui); background: #f4efff; border: 2px solid #ddd0fb; border-radius: 12px; padding: 2px 12px; }
  .code span.num { background: #fff4cf; border-color: #f2d88a; }
  ol { margin: 4px 0 0; padding-left: 20px; font: 600 15px/1.5 var(--font-body); color: #4d4466; }
  .keep { margin: 0; font: 600 13px/1.4 var(--font-body); color: #7a7290; }
  @media (max-width: 560px) {
    .codecard { grid-template-columns: 1fr; }
    .art { min-height: 170px; }
    .buddy { max-height: 160px; }
    .code span { font-size: 22px; }
  }
  /* printing: only the card, at the top of a white page */
  @media print {
    :global(html), :global(body) { background: #fff !important; }
    :global(body *) { visibility: hidden !important; }
    :global(.kp-print), :global(.kp-print *) { visibility: visible !important; }
    :global(.kp-print) { position: fixed !important; left: 0; top: 0; width: 100% !important; display: flex !important; justify-content: center; padding: 8mm 0 0 !important; background: #fff !important; box-shadow: none !important; }
    .codecard { grid-template-columns: 220px 1fr; }
  }
</style>
