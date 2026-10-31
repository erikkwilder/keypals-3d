<script lang="ts">
  // Where this player's progress is kept and who's signed in, in a few words, and a tap to keep it safe:
  // "Signed in as Erik: saved online", "Saved online with a save code", or "Only on this computer". Small,
  // on Home and in the Menu. Tapping it opens the grown-ups' "Saving online" (behind the grown-up check).
  import { game } from '../state/game.svelte';
  import { cloud, goSaveOnline, saveStatus } from '../state/cloud.svelte';
  import { sfx } from '../audio/sound';
  type Props = { compact?: boolean };
  let { compact = false }: Props = $props();
  const st = $derived(saveStatus(game.profile));
</script>

{#if game.profile && cloud.online}
  <button class="chip {st.kind}" onclick={() => { sfx.click(); game.closeMenu(); goSaveOnline(); }} title={st.kind === 'local' ? 'A grown-up can save this player online, so nothing is lost' : 'Saving online: tap to see or change it'}>
    <img src="{import.meta.env.BASE_URL}icons/cloud-save.webp" alt="" />
    <span>{compact ? st.short : st.text}</span>
    {#if st.kind === 'local'}<b class="go">Save it</b>{/if}
  </button>
{/if}

<style>
  .chip { display: inline-flex; align-items: center; gap: 5px; border: 0; cursor: pointer; border-radius: 999px; padding: 2px 10px 2px 3px; font: 700 13px var(--font-body); white-space: nowrap; max-width: 100%; }
  .chip img { width: 24px; height: 24px; object-fit: contain; flex: none; }
  .chip span { overflow: hidden; text-overflow: ellipsis; }
  .account, .code, .class { background: #eafff3; color: #0f6a48; box-shadow: inset 0 0 0 2px #b8ebcf; }
  .local { background: #fff4e0; color: #8a4a00; box-shadow: inset 0 0 0 2px #ffd59a; }
  .local img { filter: grayscale(.8) opacity(.75); }
  .go { font: 800 12px var(--font-body); background: #ff9f1a; color: #fff; padding: 2px 9px; border-radius: 999px; margin-left: 2px; }
  .chip:hover { filter: brightness(1.03); transform: translateY(-1px); }
</style>
