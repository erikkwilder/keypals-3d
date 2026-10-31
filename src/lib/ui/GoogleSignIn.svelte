<script lang="ts">
  // "Sign in with Google", plain to see on the very first screens (the title, a new player, the player
  // list), so a family on a new phone gets their players back without going through the teachers' page.
  // Behind the grown-up check, like everything grown-up. Not shown where signing in isn't set up, or once
  // someone is signed in.
  import { onDestroy } from 'svelte';
  import { game } from '../state/game.svelte';
  import { cloud, signIn } from '../state/cloud.svelte';
  import { sfx } from '../audio/sound';
  import GrownupGate from './GrownupGate.svelte';

  let gate = $state(false);
  function show(on: boolean) { gate = on; game.gateOpen = on; }
  function onKey(e: KeyboardEvent) { if (gate && e.key === 'Escape') { e.preventDefault(); show(false); } }
  onDestroy(() => { if (gate) game.gateOpen = false; });
</script>

<svelte:window onkeydown={onKey} />

{#if cloud.online && cloud.google && !cloud.account}
  <div class="gs">
    <button class="gbtn" onclick={() => { sfx.click(); show(true); }}>
      <svg viewBox="0 0 48 48" width="22" height="22" aria-hidden="true">
        <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.7 17.7 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 7l7.2 5.6c4.2-3.9 7.1-9.7 7.1-17.1z" />
        <path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C1 16.5 0 20.1 0 24s1 7.5 2.6 10.8l7.9-6.2z" />
        <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.2-5.6c-2 1.3-4.6 2.2-8.7 2.2-6.3 0-11.6-4.2-13.5-9.9l-7.9 6.2C6.5 42.6 14.6 48 24 48z" />
      </svg>
      Sign in with Google
    </button>
    <small>For grown-ups: your players on every phone and computer</small>
  </div>
{/if}
{#if gate}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="gbg" onclick={() => show(false)}>
    <div class="gcard card" onclick={(e) => e.stopPropagation()}>
      <GrownupGate title="Grown-ups: sign in" note="Sign in to bring every player in your account to this phone or computer." onpass={() => { show(false); signIn('google'); }} />
      <button class="btn btn-ghost" onclick={() => show(false)}>Not now</button>
    </div>
  </div>
{/if}

<style>
  .gs { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .gbtn { display: inline-flex; align-items: center; gap: 10px; min-height: 46px; padding: 8px 18px 8px 14px; border-radius: 999px; border: 1.5px solid #dadce0; background: #fff; color: #3c4043; font: 700 16px var(--font-body); cursor: pointer; box-shadow: 0 2px 6px rgba(60, 64, 67, .18); }
  .gbtn:hover { background: #f8f9fa; }
  .gbtn:focus-visible { outline: 3px solid var(--primary-hi); outline-offset: 3px; }
  .gs small { max-width: 300px; padding: 2px 10px; border-radius: 999px; background: rgba(255, 255, 255, .75); font: 700 12.5px/1.25 var(--font-body); color: var(--ink2); text-align: center; }
  .gbg { position: fixed; inset: 0; z-index: 90; background: rgba(40, 28, 70, .45); display: grid; place-items: center; padding: 16px; }
  .gcard { display: flex; flex-direction: column; align-items: center; padding: 8px 16px 16px; width: min(520px, 100%); }
</style>
