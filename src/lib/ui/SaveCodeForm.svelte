<script lang="ts">
  // "Already play on another computer?": type a save code to bring that player here, or a grown-up signs
  // in to bring every player in their account. Shown only where online saving works
  // (keypals.org and fancyant.com/keypals).
  import { game } from '../state/game.svelte';
  import { cloud, openCode, signIn } from '../state/cloud.svelte';
  import { sfx } from '../audio/sound';
  import GrownupGate from './GrownupGate.svelte';

  let open = $state(false);
  let code = $state('');
  let msg = $state<string | null>(null);
  let busy = $state(false);
  let gate = $state(false);
  async function bring() {
    msg = null; busy = true;
    try { await openCode(code); sfx.complete(); game.go('hub'); }
    catch (e) { msg = (e as Error).message; sfx.nope(); }
    finally { busy = false; }
  }
</script>

{#if cloud.online}
  {#if open}
    <div class="elsewhere card">
      <form class="opencode" onsubmit={(e) => { e.preventDefault(); bring(); }}>
        <label for="savecode">Type your save code</label>
        <!-- svelte-ignore a11y_autofocus -->
        <input id="savecode" class="txt" bind:value={code} placeholder="tiger moon rain 42" autocomplete="off" spellcheck="false" autofocus />
        <button class="btn btn-primary" disabled={busy || code.trim().length < 6}>Bring my player</button>
        {#if msg}<p class="err">{msg}</p>{/if}
      </form>
      {#if cloud.google || cloud.microsoft}
        <div class="or"><span>or</span></div>
        <div class="gu">
          <p>A grown-up can sign in to bring <b>all</b> your players at once.</p>
          <button class="btn" onclick={() => (gate = true)}>Grown-ups: sign in</button>
        </div>
      {/if}
    </div>
  {:else}
    <button class="btn btn-ghost codebtn" onclick={() => (open = true)}>Already play on another computer?</button>
  {/if}
  {#if gate}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="gbg" onclick={() => (gate = false)}>
      <div class="gcard card" onclick={(e) => e.stopPropagation()}>
        <GrownupGate title="Grown-ups: sign in" note="Sign in to bring every player in your account to this computer." onpass={() => { gate = false; signIn(cloud.google ? 'google' : 'microsoft'); }} />
        <button class="btn btn-ghost" onclick={() => (gate = false)}>Not now</button>
      </div>
    </div>
  {/if}
{/if}

<style>
  .codebtn { margin-top: 18px; }
  .elsewhere { margin-top: 18px; padding: 14px 18px; display: flex; flex-direction: column; align-items: center; gap: 10px; max-width: 640px; width: 100%; }
  .opencode { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; justify-content: center; }
  .opencode label { font: 600 18px var(--font-ui); }
  .opencode .txt { font: 600 20px var(--font-ui); padding: 8px 12px; border-radius: 12px; border: 2px solid #e4dcf2; min-width: 240px; max-width: 100%; text-transform: lowercase; }
  .opencode .err { flex-basis: 100%; text-align: center; margin: 0; color: #c0396b; font-weight: 700; }
  .or { display: flex; align-items: center; gap: 10px; width: 100%; color: var(--muted); font: 700 13px var(--font-body); }
  .or::before, .or::after { content: ''; flex: 1; height: 2px; background: #eee8f7; }
  .gu { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 10px; text-align: center; }
  .gu p { margin: 0; font: 600 15px var(--font-body); color: var(--ink2); }
  .gbg { position: fixed; inset: 0; z-index: 60; background: rgba(40, 28, 70, .45); display: grid; place-items: center; padding: 16px; }
  .gcard { display: flex; flex-direction: column; align-items: center; padding: 8px 16px 16px; width: min(520px, 100%); }
</style>
