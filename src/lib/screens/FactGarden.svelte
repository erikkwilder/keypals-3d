<script lang="ts">
  // The Fact Garden: the times table as a garden. Each fact is a patch of soil, a sprout, a bud or a
  // flower in bloom, on a tile coloured by its latest answer (green quick, yellow slow, pink missed).
  // It's also the grown-ups' view of what a child knows.
  import { game } from '../state/game.svelte';
  import { outfitOf } from '../engine/profile';
  import { sfx } from '../audio/sound';
  import { factId, avgThink, isDue, STAGE_NAME, FAST_MS, type Stage } from '../math/facts';
  import { GARDEN_IDS, mathOf, stageCounts } from '../math/progress';
  import { TABLES } from '../math/course';
  import Flower from '../math/ui/Flower.svelte';
  import Critter from '../ui/Critter.svelte';
  import NavTile from '../ui/NavTile.svelte';

  const p = $derived(game.profile!);
  const m = $derived(mathOf(p));
  const counts = $derived(stageCounts(m, GARDEN_IDS));
  const ROWS = [0, 1, 2, 10, 5, 4, 3, 6, 7, 8, 9];
  const COLS = Array.from({ length: 11 }, (_, i) => i);
  const open = new Set([0, 1, ...TABLES]);
  const HUE: Record<number, number> = { 0: 210, 1: 190, 2: 320, 10: 270, 5: 200, 4: 160, 3: 40, 6: 350, 7: 230, 8: 290, 9: 140 };
  const budding = $derived(GARDEN_IDS.filter(id => m.facts[id]?.stage === 2).slice(0, 8));
  const due = $derived(GARDEN_IDS.filter(id => isDue(m.facts[id], Date.now())).length);
  let picked = $state<{ a: number; b: number } | null>(null);
  const pickedStat = $derived(picked ? m.facts[factId(picked)] : undefined);
  const fastS = $derived(Math.round((m.fastMs ?? FAST_MS) / 1000));
  const nice = (id: string) => id.replace('x', ' × ');

  function setFast(s: number) {
    game.update(pp => { pp.math = { ...mathOf(pp), fastMs: s * 1000 }; });
  }
  function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && !game.modalOpen) { picked ? (picked = null) : game.go('map'); } }
</script>

<svelte:window onkeydown={onKey} />

<div class="screen garden">
  <header class="bar">
    <NavTile size="sm" tone="sky" kind="home" label="Home" onclick={() => game.go('map')} />
    <Critter friend={p.buddy} look={p.settings.look} accessory={outfitOf(p)} size={46} round />
    <h1>Fact Garden</h1>
  </header>

  <div class="body scroll">
    <section class="card grid">
      <p class="lead">Every fact you know by heart blooms. Quick on three different days makes a flower.</p>
      <div class="tbl" role="grid" aria-label="Times table garden">
        <div class="corner">×</div>
        {#each COLS as a}<div class="ch">{a}</div>{/each}
        {#each ROWS as b}
          <div class="rh" class:soon={!open.has(b)}>{b}</div>
          {#each COLS as a}
            {@const s = m.facts[factId({ a, b })]}
            <button class="cell {s?.seen ? s.latest : ''}" class:soon={!open.has(b) && !s?.stage} class:sel={picked?.a === a && picked?.b === b}
              onclick={() => { picked = { a, b }; sfx.pop(); }} title="{a} × {b} = {a * b}">
              <Flower stage={(s?.stage ?? 0) as Stage} size={26} hue={HUE[b]} />
            </button>
          {/each}
        {/each}
      </div>
      <p class="note">Rows are the tables. The 2s, 10s, 5s and 4s (and the 0 and 1 rules) are on the trail now; the faded rows fill in as partners grow: learn 6 × 2 and 2 × 6 starts growing too.</p>
    </section>

    <aside class="side">
      <div class="card big"><b>{counts[3]}</b><span>of 121 facts in bloom</span></div>
      {#if picked}
        <div class="card detail">
          <div class="dfact">{picked.a} × {picked.b} = <b>{picked.a * picked.b}</b></div>
          <div class="dstage"><Flower stage={(pickedStat?.stage ?? 0) as Stage} size={34} hue={HUE[picked.b]} /> {STAGE_NAME[pickedStat?.stage ?? 0]}</div>
          {#if pickedStat?.seen}
            <p>Asked {pickedStat.seen} {pickedStat.seen === 1 ? 'time' : 'times'}, right {pickedStat.right}{#if avgThink(pickedStat) !== null}, usually starts answering in {(avgThink(pickedStat)! / 1000).toFixed(1)} s{/if}.</p>
            {#if pickedStat.stage === 2}<p>Quick on {pickedStat.fastDays.length} of 3 days so far.</p>{/if}
            {#if pickedStat.stage === 3 && pickedStat.due}<p>Next check-up: {new Date(pickedStat.due).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}.</p>{/if}
          {:else}<p>Not asked yet.</p>{/if}
        </div>
      {/if}
      <div class="card legend">
        <div><Flower stage={3} size={28} /> Bloom: quick on three different days</div>
        <div><Flower stage={2} size={28} /> Bud: right, getting quicker</div>
        <div><Flower stage={1} size={28} /> Sprout: just met</div>
        <div><Flower stage={0} size={28} /> Not planted yet</div>
        <div class="sw"><i class="fast"></i> latest answer quick <i class="slow"></i> slow <i class="miss"></i> missed</div>
      </div>
      {#if budding.length}
        <div class="card bud"><b>Budding now</b><div class="chips">{#each budding as id}<span>{nice(id)}</span>{/each}</div></div>
      {/if}
      {#if due}<div class="card due"><b>{due}</b> {due === 1 ? 'flower is' : 'flowers are'} due a check-up. They'll come up on the next trips.</div>{/if}
      <div class="card grown">
        <b>For grown-ups</b>
        <label>“Quick” means starting to answer within <select value={fastS} onchange={(e) => setFast(Number((e.currentTarget as HTMLSelectElement).value))}>{#each [2, 3, 4, 5, 6] as s}<option value={s}>{s} seconds</option>{/each}</select></label>
        <small>3 seconds is the usual line for knowing a fact by heart. Only thinking time counts, not typing.</small>
      </div>
    </aside>
  </div>
</div>

<style>
  .garden { display: flex; flex-direction: column; background: linear-gradient(#e9f7ee, #f6fbf4 60%, #fbfdf8); }
  .bar { flex: none; display: flex; align-items: center; gap: 12px; padding: 10px 18px; background: rgba(255, 255, 255, .92); border-bottom: var(--panel-border); }
  .bar h1 { font-size: 30px; margin: 0; }
  .body { flex: 1; min-height: 0; display: flex; gap: 18px; padding: 18px; align-items: flex-start; }
  .grid { flex: 1 1 auto; padding: 16px; min-width: 0; }
  .lead { margin: 0 0 10px; font: 600 16px var(--font-body); color: var(--ink2); }
  .tbl { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 4px; max-width: 640px; }
  .corner, .ch, .rh { display: grid; place-items: center; font: 600 18px var(--font-ui); color: var(--muted); }
  .rh { color: var(--ink); }
  .rh.soon { color: #c4bcd6; }
  .cell { aspect-ratio: 1; border: 0; border-radius: 10px; background: #f6f2ea; display: grid; place-items: center; cursor: pointer; padding: 0; transition: transform .12s; }
  .cell:hover { transform: scale(1.08); }
  .cell.fast { background: #c9f1dd; } .cell.slow { background: #fff0b8; } .cell.miss { background: #fbd3e2; }
  .cell.soon { opacity: .45; }
  .cell.sel { box-shadow: 0 0 0 3px var(--primary); }
  .cell :global(svg) { width: 80%; height: 80%; }
  .note { margin: 12px 0 0; font: 600 13.5px/1.4 var(--font-body); color: var(--muted); max-width: 640px; }
  .side { flex: 0 0 320px; display: flex; flex-direction: column; gap: 12px; }
  .side .card { padding: 14px 16px; }
  .big { display: flex; align-items: baseline; gap: 10px; }
  .big b { font: 600 48px/1 var(--font-ui); }
  .big span { font: 700 15px var(--font-body); color: var(--muted); }
  .detail .dfact { font: 600 30px var(--font-ui); }
  .detail .dfact b { color: var(--primary-edge); }
  .dstage { display: flex; align-items: center; gap: 6px; font: 700 15px var(--font-body); color: var(--ink2); }
  .detail p { margin: 6px 0 0; font: 600 14px/1.35 var(--font-body); color: var(--ink2); }
  .legend { display: flex; flex-direction: column; gap: 4px; font: 600 14px var(--font-body); color: var(--ink2); }
  .legend > div { display: flex; align-items: center; gap: 6px; }
  .sw { flex-wrap: wrap; font-size: 12.5px; color: var(--muted); margin-top: 4px; }
  .sw i { width: 14px; height: 14px; border-radius: 4px; display: inline-block; }
  .sw .fast { background: #c9f1dd; } .sw .slow { background: #fff0b8; } .sw .miss { background: #fbd3e2; }
  .bud b, .grown b { font: 600 18px var(--font-ui); display: block; margin-bottom: 6px; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chips span { font: 700 15px var(--font-body); background: #eaf7ef; border-radius: 10px; padding: 3px 9px; }
  .due { font: 600 14px/1.35 var(--font-body); color: var(--ink2); }
  .due b { font: 600 20px var(--font-ui); }
  .grown label { display: block; font: 600 14px/1.5 var(--font-body); color: var(--ink2); }
  .grown select { font: 700 14px var(--font-body); border-radius: 8px; border: 2px solid #e4dcf2; padding: 2px 6px; background: #fff; }
  .grown small { display: block; margin-top: 6px; font: 600 12.5px/1.35 var(--font-body); color: var(--muted); }
  @media (max-width: 860px) {
    .body { flex-direction: column; padding: 10px; gap: 10px; }
    .side { flex: none; width: 100%; }
    .grid { width: 100%; padding: 10px; }
    .tbl { gap: 2px; }
    .corner, .ch, .rh { font-size: 13px; }
    .cell { border-radius: 6px; }
    .bar { padding: 8px 10px; }
    .bar h1 { font-size: 24px; }
  }
</style>
