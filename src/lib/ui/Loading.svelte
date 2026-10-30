<script lang="ts">
  // While a screen's code is still on its way (ui/lazy.svelte.ts): nothing for a moment (most screens
  // arrive in a blink), then a gentle "Loading..." card; if the download fails, a way to try again.
  import { onDestroy, onMount } from 'svelte';
  type Props = { failed?: boolean; retry?: () => void };
  let { failed = false, retry }: Props = $props();
  let shown = $state(false);
  let tries = 0;
  let t: ReturnType<typeof setTimeout> | undefined;
  onMount(() => { t = setTimeout(() => (shown = true), 350); });
  onDestroy(() => clearTimeout(t));
  // a second failure usually means the game was updated while this page was open: a fresh page fixes it
  function again() { if (++tries > 1) location.reload(); else retry?.(); }
</script>

{#if shown || failed}
  <div class="ld" role="status" aria-live="polite">
    <div class="card">
      {#if failed}
        <b>This part didn't load</b>
        <p>Check the internet, then try again.</p>
        <button class="btn btn-primary" onclick={again}>Try again</button>
      {:else}
        <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <b>Loading...</b>
      {/if}
    </div>
  </div>
{/if}

<style>
  .ld { position: fixed; inset: 0; z-index: 3; display: grid; place-items: center; pointer-events: none; animation: fade-up .3s ease; }
  .card { pointer-events: auto; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 18px 28px; border-radius: 24px; background: rgba(255, 255, 255, .94); box-shadow: var(--shadow); text-align: center; }
  b { font: 600 22px var(--font-ui); color: var(--ink); }
  p { margin: 0; font: 600 15px var(--font-body); color: var(--ink2); }
  .dots { display: flex; gap: 6px; }
  .dots i { width: 12px; height: 12px; border-radius: 50%; background: var(--primary-hi, #9b7cf6); animation: hop 1s ease-in-out infinite; }
  .dots i:nth-child(2) { animation-delay: .15s; } .dots i:nth-child(3) { animation-delay: .3s; }
  @keyframes hop { 50% { transform: translateY(-8px); opacity: .6; } }
</style>
