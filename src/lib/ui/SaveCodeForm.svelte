<script lang="ts">
  // "Played on another computer?": type a save code to bring that player here. Shown only where
  // online saving works (fancyant.com/keypals).
  import { game } from '../state/game.svelte';
  import { cloud, openCode } from '../state/cloud.svelte';
  import { sfx } from '../audio/sound';

  let open = $state(false);
  let code = $state('');
  let msg = $state<string | null>(null);
  let busy = $state(false);
  async function bring() {
    msg = null; busy = true;
    try { await openCode(code); sfx.complete(); game.go('hub'); }
    catch (e) { msg = (e as Error).message; sfx.miss(); }
    finally { busy = false; }
  }
</script>

{#if cloud.online}
  {#if open}
    <form class="opencode card" onsubmit={(e) => { e.preventDefault(); bring(); }}>
      <label for="savecode">Type your save code</label>
      <!-- svelte-ignore a11y_autofocus -->
      <input id="savecode" class="txt" bind:value={code} placeholder="tiger moon rain 42" autocomplete="off" spellcheck="false" autofocus />
      <button class="btn btn-primary" disabled={busy || code.trim().length < 6}>Bring my player</button>
      {#if msg}<p class="err">{msg}</p>{/if}
    </form>
  {:else}
    <button class="btn btn-ghost codebtn" onclick={() => (open = true)}>Played on another computer? Use your save code</button>
  {/if}
{/if}

<style>
  .codebtn { margin-top: 18px; }
  .opencode { margin-top: 18px; padding: 14px 18px; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; justify-content: center; max-width: 640px; }
  .opencode label { font: 600 18px var(--font-ui); }
  .opencode .txt { font: 600 20px var(--font-ui); padding: 8px 12px; border-radius: 12px; border: 2px solid #e4dcf2; min-width: 240px; text-transform: lowercase; }
  .opencode .err { flex-basis: 100%; text-align: center; margin: 0; color: #c0396b; font-weight: 700; }
</style>
