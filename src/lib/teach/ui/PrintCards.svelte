<script lang="ts">
  // Login cards for the whole class (or one student), two across, ready to print and cut out. On screen
  // it's a sheet over the class page; printing shows only the cards.
  import { teach } from '../teacher.svelte';
  import LoginCard from './LoginCard.svelte';

  const c = $derived(teach.current!);
  const who = $derived(c.students.filter(s => s.status === 'active'));
  const teacher = $derived(teach.me?.teacher?.display ?? 'Your teacher');
  function close() { teach.printing = false; }
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') close(); }} />
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="pbg" onclick={close}>
  <div class="sheet" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Login cards" tabindex="-1">
    <div class="bar">
      <div><b>Login cards: {c.class.name}</b><span>{who.length} cards, two across. Cut along the dashed lines.</span></div>
      <button class="btn" onclick={close}>Close</button>
      <button class="btn btn-primary" onclick={() => window.print()}>Print</button>
    </div>
    <div class="kp-cards">
      {#each who as s (s.id)}<LoginCard name={s.name} pics={s.pics} code={c.class.code} className={c.class.name} {teacher} />{/each}
    </div>
  </div>
</div>

<style>
  .pbg { position: fixed; inset: 0; z-index: 60; background: rgba(40, 28, 70, .45); display: flex; justify-content: center; padding: 20px; overflow: auto; }
  .sheet { background: #fff; border-radius: 16px; width: min(900px, 100%); height: max-content; padding: 16px 20px 24px; box-shadow: 0 20px 60px rgba(30, 20, 60, .35); }
  .bar { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; position: sticky; top: -20px; background: #fff; padding: 8px 0; z-index: 1; }
  .bar div { flex: 1; display: flex; flex-direction: column; }
  .bar b { font: 600 20px var(--font-ui); }
  .bar span { font: 700 13px var(--font-body); color: #7a7092; }
  .kp-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media (max-width: 640px) { .kp-cards { grid-template-columns: 1fr; } }
  /* printing: only the cards, two across, on white pages */
  @media print {
    :global(html), :global(body) { background: #fff !important; height: auto !important; overflow: visible !important; }
    :global(body *) { visibility: hidden !important; }
    :global(.app) { position: static !important; overflow: visible !important; }
    .pbg { position: absolute !important; inset: 0 auto auto 0 !important; background: none !important; padding: 0 !important; overflow: visible !important; display: block !important; width: 100%; }
    .sheet { box-shadow: none !important; padding: 0 !important; width: 100% !important; }
    .bar { display: none !important; }
    .kp-cards, .kp-cards :global(*) { visibility: visible !important; }
    .kp-cards { grid-template-columns: 1fr 1fr !important; gap: 6mm !important; }
    @page { margin: 10mm; }
  }
</style>
