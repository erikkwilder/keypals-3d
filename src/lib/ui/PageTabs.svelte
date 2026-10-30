<script lang="ts">
  // The tabs of a page (Glimmers: My team | All 100; the Sticker book: Stickers | Medals | Rides): one row,
  // centred under the top bar, the same look on every page. A tab isn't a step: Back leaves the page.
  import { sfx } from '../audio/sound';
  type Tab = { id: string; label: string; small?: string };
  type Props = { tabs: Tab[]; value: string; label: string; onpick: (id: string) => void };
  let { tabs, value, label, onpick }: Props = $props();
</script>

<div class="ptabs" role="tablist" aria-label={label}>
  {#each tabs as t (t.id)}
    <button role="tab" aria-selected={value === t.id} class:on={value === t.id} onclick={() => { if (t.id !== value) { sfx.click(); onpick(t.id); } }}>{t.label}{#if t.small} <small>{t.small}</small>{/if}</button>
  {/each}
</div>

<style>
  .ptabs { flex: none; position: relative; z-index: 4; display: flex; justify-content: center; gap: 6px; padding: 8px 12px; background: rgba(255, 255, 255, .72); border-bottom: 1px solid #f0ebf8; }
  button { border: 0; cursor: pointer; padding: 8px 20px; border-radius: 999px; background: #f2eefa; font: 600 18px var(--font-ui); color: var(--ink2); white-space: nowrap; }
  button small { font: 700 13px var(--font-body); color: var(--muted); }
  button.on { background: var(--primary); color: #fff; box-shadow: 0 3px 0 var(--primary-edge); }
  button.on small { color: #ece6ff; }
  @media (max-width: 600px) { .ptabs { gap: 4px; padding: 6px 8px; } button { font-size: 15px; padding: 7px 12px; } }
</style>
