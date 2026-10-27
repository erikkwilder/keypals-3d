<script lang="ts">
  // The Fact Garden: the times table as a garden. Each fact is a patch of soil, a sprout, a bud or a
  // flower in bloom, on a tile coloured by its latest answer (green quick, yellow slow, pink missed).
  // Growth since the last visit pops in, the flowers sway, and tapping one says exactly where it stands
  // and why (asked, or growing from its turnaround, or waiting for its table). It's also the
  // grown-ups' view of what a child knows.
  import { onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { outfitOf } from '../engine/profile';
  import { sfx } from '../audio/sound';
  import { factId, partnerOf, isRuleFact, avgThink, isDue, STAGE_NAME, FAST_MS, BLOOM_DAYS, type Fact, type Stage } from '../math/facts';
  import { GARDEN_IDS, mathOf, stageCounts } from '../math/progress';
  import { MATH_REGIONS, TABLES } from '../math/course';
  import Flower from '../math/ui/Flower.svelte';
  import Critter from '../ui/Critter.svelte';
  import NavTile from '../ui/NavTile.svelte';

  const p = $derived(game.profile!);
  const m = $derived(mathOf(p));
  const counts = $derived(stageCounts(m, GARDEN_IDS));
  const ROWS = [0, 1, 2, 10, 5, 4, 3, 6, 7, 8, 9];
  const COLS = Array.from({ length: 11 }, (_, i) => i);
  const onTrail = new Set<number>(TABLES);
  const HUE: Record<number, number> = { 0: 210, 1: 190, 2: 320, 10: 270, 5: 200, 4: 160, 3: 40, 6: 350, 7: 230, 8: 290, 9: 140 };
  const stageOf = (a: number, b: number) => (m.facts[factId({ a, b })]?.stage ?? 0) as Stage;
  const due = $derived(GARDEN_IDS.filter(id => isDue(m.facts[id], Date.now())));
  const fastS = $derived(Math.round((m.fastMs ?? FAST_MS) / 1000));
  const regionOf = (t: number) => MATH_REGIONS.find(r => r.table === t);

  // growth since the last visit: those squares pop in, one after another
  const seenBefore = mathOf(game.profile!).gardenSeen;
  const grewIds = GARDEN_IDS.filter(id => (mathOf(game.profile!).facts[id]?.stage ?? 0) > (seenBefore?.[id] ?? 0));
  const grewAt = new Map(grewIds.map((id, i) => [id, i]));
  const firstVisit = !seenBefore;
  onMount(() => {
    const snap: Record<string, number> = {};
    for (const id of GARDEN_IDS) { const s = mathOf(game.profile!).facts[id]?.stage; if (s) snap[id] = s; }
    game.update(pp => { pp.math = { ...mathOf(pp), gardenSeen: snap }; });
    if (grewIds.length) setTimeout(() => sfx.star(2), 400);
  });

  // the beds: each table's row, how much of it is in bloom
  const beds = $derived([
    { label: '0 and 1', sub: 'the rules', rows: [0, 1], open: true },
    ...[2, 10, 5, 4].map(t => ({ label: `${t}s`, sub: regionOf(t)?.name ?? '', rows: [t], open: true })),
    { label: '3s, 6s, 7s, 8s, 9s', sub: 'coming soon', rows: [3, 6, 7, 8, 9], open: false },
  ].map(b => {
    const ids = b.rows.flatMap(r => COLS.map(a => factId({ a, b: r })));
    const st = ids.map(id => m.facts[id]?.stage ?? 0);
    return { ...b, total: ids.length, bloom: st.filter(s => s === 3).length, grow: st.filter(s => s > 0).length };
  }));

  let picked = $state<Fact | null>(null);
  const pickedStat = $derived(picked ? m.facts[factId(picked)] : undefined);
  const partner = $derived(picked && picked.a !== picked.b ? partnerOf(picked) : null);
  const partnerStat = $derived(partner ? m.facts[factId(partner)] : undefined);
  function pick(f: Fact) { picked = f; sfx.pop(); }

  /** Why a fact is where it is, in a child's words. */
  function story(f: Fact): string {
    const s = m.facts[factId(f)];
    const pf = partnerOf(f);
    if (s?.seen) {
      if (s.stage === 3) return 'In bloom: you knew it quickly on three different days.';
      if (s.stage === 2) return `A bud: you can answer it. Answer it quickly on ${BLOOM_DAYS} different days and it blooms.`;
      return 'A sprout: you have met it. Get it right and it grows a bud.';
    }
    if ((s?.stage ?? 0) > 0) return `Not asked yet, but it's growing already: you know ${pf.a} × ${pf.b}, its turnaround. Swap the numbers and the answer stays the same, so this one grows too.`;
    if (isRuleFact(f)) return `Not asked yet. It follows a rule: ${f.a === 0 || f.b === 0 ? 'anything times 0 is 0' : 'times 1 keeps the number the same'}. It comes up on the Zero and One trips and in reviews.`;
    if (onTrail.has(f.b)) return `Not asked yet. It comes up on the ${regionOf(f.b)?.name ?? ''} trips.`;
    if (onTrail.has(f.a)) return `Not asked yet. Learn ${pf.a} × ${pf.b} on the ${regionOf(f.a)?.name ?? ''} trips and this one grows with it.`;
    return `The ${f.b}s come later on the Times Trail. Learn ${pf.a} × ${pf.b} first and this one starts growing too.`;
  }

  function setFast(s: number) {
    game.update(pp => { pp.math = { ...mathOf(pp), fastMs: s * 1000 }; });
  }
  function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && !game.modalOpen) { picked ? (picked = null) : game.go(game.home); } }
  const bubble = grewIds.length && !firstVisit ? `${grewIds.length} ${grewIds.length === 1 ? 'fact grew' : 'facts grew'} since you last looked!`
    : counts[3] ? `${counts[3]} in bloom! Tap any flower to see how it's doing.`
    : counts[1] + counts[2] ? 'Your garden is growing. Quick answers on different days make flowers bloom.'
    : 'Every fact you learn grows here. Take a trip on the Times Trail to plant your first ones!';
</script>

<svelte:window onkeydown={onKey} />

<div class="screen garden">
  <header class="bar">
    <NavTile size="sm" tone="sky" kind="home" label="Home" onclick={() => game.go('hub')} />
    <h1>Fact Garden</h1>
    <div class="tally" aria-label="Garden totals">
      <span><Flower stage={3} size={30} hue={320} /><b>{counts[3]}</b><small>bloom</small></span>
      <span><Flower stage={2} size={30} hue={270} /><b>{counts[2]}</b><small>bud</small></span>
      <span><Flower stage={1} size={30} /><b>{counts[1]}</b><small>sprout</small></span>
    </div>
  </header>

  <div class="body scroll">
    <section class="top">
      <div class="buddy card">
        <div class="bpic"><Critter friend={p.buddy} look={p.settings.look} accessory={outfitOf(p)} size={86} round /></div>
        <p class="say">{bubble}</p>
        <svg class="can" viewBox="0 0 64 48" aria-hidden="true"><path d="M14 18h26v22a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4z" fill="#7fc4ef" stroke="#3f8fc4" stroke-width="2.5" /><path d="M40 24l16-10 3 4-17 12" fill="#7fc4ef" stroke="#3f8fc4" stroke-width="2.5" stroke-linejoin="round" /><path d="M18 18c0-8 18-8 18 0" fill="none" stroke="#3f8fc4" stroke-width="3" /><g class="drops" fill="#58b4f0"><circle cx="60" cy="24" r="2" /><circle cx="62" cy="31" r="2" /><circle cx="58" cy="36" r="2" /></g></svg>
      </div>
      <ol class="how card" aria-label="How a fact grows">
        <li><span class="st"><Flower stage={0} size={44} /></span><b>Seed</b><small>not asked yet</small></li>
        <li class="arrow" aria-hidden="true">›</li>
        <li><span class="st sway"><Flower stage={1} size={44} /></span><b>Sprout</b><small>you met it</small></li>
        <li class="arrow" aria-hidden="true">›</li>
        <li><span class="st sway"><Flower stage={2} size={44} hue={270} /></span><b>Bud</b><small>you got it right</small></li>
        <li class="arrow" aria-hidden="true">›</li>
        <li><span class="st sway bloom"><Flower stage={3} size={44} hue={320} /></span><b>Bloom</b><small>quick on {BLOOM_DAYS} different days</small></li>
        <li class="foot">A slip moves a fact back one step. Blooms get check-ups after 1, 3, 7, 14 and 30 days to stay fresh. Learn one fact and its turnaround grows too: 6 × 2 helps 2 × 6.</li>
      </ol>
    </section>

    <div class="main">
      <section class="bed card">
        <div class="tbl" role="grid" aria-label="Times table garden">
          <div class="corner">×</div>
          {#each COLS as a}<div class="ch">{a}</div>{/each}
          {#each ROWS as b, r}
            <div class="rh" class:soon={!onTrail.has(b) && b > 1}>{b}</div>
            {#each COLS as a}
              {@const id = factId({ a, b })}
              {@const s = m.facts[id]}
              {@const st = (s?.stage ?? 0) as Stage}
              {@const gi = grewAt.get(id)}
              <button class="cell {s?.seen ? s.latest : ''}" class:soon={!onTrail.has(b) && !onTrail.has(a) && b > 1 && a > 1 && !st} class:rule={isRuleFact({ a, b })}
                class:sel={picked?.a === a && picked?.b === b} class:grew={gi !== undefined} class:due={isDue(s, Date.now())}
                style:--i={r * 11 + a} style:--gd="{0.35 + (gi ?? 0) * 0.12}s"
                onclick={() => pick({ a, b })} title="{a} × {b} = {a * b}: {STAGE_NAME[st]}" aria-label="{a} times {b}, {STAGE_NAME[st]}">
                <span class="fl" class:bloom={st === 3}><Flower stage={st} size={26} hue={HUE[b]} /></span>
                {#if gi !== undefined}<i class="pop" aria-hidden="true"></i>{/if}
              </button>
            {/each}
          {/each}
        </div>
        <div class="key">
          <span><i class="fast"></i> last answer quick</span><span><i class="slow"></i> slow</span><span><i class="miss"></i> missed</span><span><i class="dueic">💧</i> due a check-up</span>
        </div>
      </section>

      <aside class="side">
        {#if picked}
          {@const st = (pickedStat?.stage ?? 0) as Stage}
          <div class="card detail" role="dialog" aria-label="{picked.a} times {picked.b}">
            <button class="x" onclick={() => (picked = null)} aria-label="Close">×</button>
            <div class="dhead">
              <span class="dflower" class:sway={st > 0}><Flower stage={st} size={64} hue={HUE[picked.b]} /></span>
              <div>
                <div class="dfact">{picked.a} × {picked.b} = <b>{picked.a * picked.b}</b></div>
                <div class="dstage s{st}">{STAGE_NAME[st]}</div>
              </div>
            </div>
            <p class="story">{story(picked)}</p>
            {#if pickedStat?.seen}
              <div class="stats">
                <span><b>{pickedStat.seen}</b> asked</span>
                <span><b>{pickedStat.right}</b> right</span>
                {#if avgThink(pickedStat) !== null}<span><b>{(avgThink(pickedStat)! / 1000).toFixed(1)}s</b> to start</span>{/if}
              </div>
              {#if st === 2}
                <div class="days" aria-label="Quick days">{#each Array(BLOOM_DAYS) as _, i}<i class:on={i < pickedStat.fastDays.length}></i>{/each}<span>quick on {pickedStat.fastDays.length} of {BLOOM_DAYS} days</span></div>
              {/if}
              {#if st === 3 && pickedStat.due}<p class="next">Next check-up: {new Date(pickedStat.due).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}.</p>{/if}
            {/if}
            {#if partner}
              <button class="turn" onclick={() => pick(partner!)}>
                <Flower stage={(partnerStat?.stage ?? 0) as Stage} size={30} hue={HUE[partner.b]} />
                <span>Turnaround: <b>{partner.a} × {partner.b}</b> · {STAGE_NAME[partnerStat?.stage ?? 0]}</span>
              </button>
            {/if}
          </div>
        {/if}

        <div class="card beds">
          <b class="h">Your beds</b>
          {#each beds as bd}
            <div class="brow" class:soon={!bd.open}>
              <span class="bl">{bd.label}<small>{bd.sub}</small></span>
              <span class="bar2"><i class="g" style:width="{(bd.grow / bd.total) * 100}%"></i><i class="b" style:width="{(bd.bloom / bd.total) * 100}%"></i></span>
              <span class="bn">{bd.bloom}<small>/{bd.total}</small></span>
            </div>
          {/each}
          <small class="bnote">Pink: in bloom. Green: growing.</small>
        </div>

        {#if due.length}<div class="card due"><span class="dueic big">💧</span><span><b>{due.length}</b> {due.length === 1 ? 'flower needs' : 'flowers need'} a check-up. They come up on your next trips.</span></div>{/if}

        <details class="card grown">
          <summary>For grown-ups</summary>
          <label>“Quick” means starting to answer within <select value={fastS} onchange={(e) => setFast(Number((e.currentTarget as HTMLSelectElement).value))}>{#each [2, 3, 4, 5, 6] as s}<option value={s}>{s} seconds</option>{/each}</select></label>
          <small>3 seconds is the usual line for knowing a fact by heart. Only thinking time counts, not typing. Rows are the tables; tap any square for its history.</small>
        </details>
      </aside>
    </div>
  </div>

  <svg class="fly f1" viewBox="0 0 40 30" aria-hidden="true"><g class="wing"><path d="M20 15C12 2 2 4 6 14c-4 8 6 12 14 1z" fill="#ff9ec7" /><path d="M20 15c8-13 18-11 14-1 4 8-6 12-14 1z" fill="#ffc46b" /></g><rect x="19" y="8" width="2" height="15" rx="1" fill="#4a3b6b" /></svg>
  <svg class="fly f2" viewBox="0 0 40 30" aria-hidden="true"><g class="wing"><path d="M20 15C12 2 2 4 6 14c-4 8 6 12 14 1z" fill="#9fd4ff" /><path d="M20 15c8-13 18-11 14-1 4 8-6 12-14 1z" fill="#c7a4ff" /></g><rect x="19" y="8" width="2" height="15" rx="1" fill="#4a3b6b" /></svg>
</div>

<style>
  .garden { display: flex; flex-direction: column; background: linear-gradient(#dff3ff 0, #ecf8ee 180px, #f3faef 60%, #f8fcf4); }
  .bar { flex: none; display: flex; align-items: center; gap: 14px; padding: 10px 18px; background: rgba(255, 255, 255, .92); border-bottom: var(--panel-border); position: relative; z-index: 3; }
  .bar h1 { font-size: 30px; margin: 0; }
  .tally { margin-left: auto; display: flex; gap: 8px; }
  .tally span { display: flex; align-items: center; gap: 2px; background: #f4fbf3; border-radius: 999px; padding: 2px 12px 2px 4px; box-shadow: inset 0 0 0 2px #e0f1df; }
  .tally b { font: 600 22px var(--font-ui); }
  .tally small { font: 700 12px var(--font-body); color: var(--muted); margin-left: 3px; }
  .body { flex: 1; min-height: 0; padding: 16px 18px 24px; display: flex; flex-direction: column; gap: 14px; }
  .top { display: flex; gap: 14px; align-items: stretch; }
  .buddy { position: relative; display: flex; align-items: center; gap: 12px; padding: 12px 52px 12px 16px; flex: 0 0 360px; }
  .bpic { flex: none; }
  .say { margin: 0; font: 600 16px/1.35 var(--font-body); color: var(--ink); background: #f6f2ff; padding: 10px 12px; border-radius: 16px; position: relative; }
  .say::before { content: ''; position: absolute; left: -8px; top: 22px; border: 8px solid transparent; border-right-color: #f6f2ff; border-left: 0; }
  .can { position: absolute; right: 8px; bottom: 6px; width: 46px; height: 34px; transform: rotate(-8deg); }
  .drops circle { animation: drip 1.4s ease-in infinite; }
  .drops circle:nth-child(2) { animation-delay: .45s; } .drops circle:nth-child(3) { animation-delay: .9s; }
  @keyframes drip { 0% { transform: translateY(-4px); opacity: 0; } 30% { opacity: 1; } 100% { transform: translateY(8px); opacity: 0; } }
  .how { flex: 1; margin: 0; list-style: none; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 4px 6px; padding: 12px 16px; }
  .how li { display: flex; flex-direction: column; align-items: center; min-width: 92px; text-align: center; }
  .how li b { font: 600 18px var(--font-ui); }
  .how li small { font: 700 12.5px/1.2 var(--font-body); color: var(--muted); max-width: 120px; }
  .how .arrow { min-width: 0; font: 600 34px var(--font-ui); color: #c6bde0; }
  .how .foot { flex-basis: 100%; min-width: 0; font: 600 13.5px/1.4 var(--font-body); color: var(--ink2); margin-top: 6px; background: #f7fbf2; border-radius: 12px; padding: 6px 10px; }
  .st { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 50%; background: radial-gradient(circle, #fffbea 40%, #f1ead9); }
  .st.bloom { background: radial-gradient(circle, #fff3f9 40%, #ffd9ea); box-shadow: 0 0 18px rgba(255, 150, 200, .5); }
  .sway :global(svg), .fl :global(svg) { transform-origin: 50% 92%; animation: sway 3.2s ease-in-out infinite; animation-delay: calc(var(--i, 0) * -0.137s); }
  @keyframes sway { 0%, 100% { transform: rotate(-5deg); } 50% { transform: rotate(5deg); } }

  .main { display: flex; gap: 16px; align-items: flex-start; }
  .bed { flex: 1 1 auto; min-width: 0; padding: 14px; background: linear-gradient(#fff, #fffdf6); }
  .tbl { display: grid; grid-template-columns: 28px repeat(11, minmax(0, 1fr)); gap: 4px; max-width: 700px; margin: 0 auto; padding: 10px; border-radius: 18px; background: #8a5a3b; box-shadow: inset 0 0 0 4px #a8744f, 0 6px 0 #6e452c; }
  .corner, .ch, .rh { display: grid; place-items: center; font: 600 17px var(--font-ui); color: #fff3e0; }
  .rh.soon { color: rgba(255, 243, 224, .5); }
  .cell { position: relative; aspect-ratio: 1; border: 0; border-radius: 10px; background: radial-gradient(circle at 50% 70%, #a2704f, #7c4f33); display: grid; place-items: center; cursor: pointer; padding: 0; transition: transform .12s, box-shadow .12s; overflow: visible; }
  .cell:hover { transform: translateY(-2px) scale(1.08); z-index: 2; }
  .cell.rule { background: radial-gradient(circle at 50% 70%, #ac7b58, #86583b); }
  .cell.fast { background: radial-gradient(circle at 50% 70%, #e2fbe9, #a7e6c3); }
  .cell.slow { background: radial-gradient(circle at 50% 70%, #fff8d4, #ffe38a); }
  .cell.miss { background: radial-gradient(circle at 50% 70%, #ffe6ef, #f7b6cd); }
  .cell.soon { opacity: .55; }
  .cell.sel { box-shadow: 0 0 0 3px #fff, 0 0 0 6px var(--primary); z-index: 3; }
  .cell.due::after { content: '💧'; position: absolute; right: -3px; top: -6px; font-size: 13px; animation: bob 1.6s ease-in-out infinite; }
  @keyframes bob { 50% { transform: translateY(-3px); } }
  .fl { display: grid; place-items: center; width: 84%; height: 84%; }
  .fl :global(svg) { width: 100%; height: 100%; }
  .fl.bloom :global(svg) { filter: drop-shadow(0 0 4px rgba(255, 255, 255, .9)); }
  /* growth since the last visit pops in, with a little burst */
  .cell.grew .fl { animation: grow .9s var(--gd) cubic-bezier(.3, .8, .4, 1.6) both; }
  @keyframes grow { 0% { transform: scale(0) translateY(40%); } 100% { transform: none; } }
  .pop { position: absolute; inset: -30%; border-radius: 50%; pointer-events: none; background: radial-gradient(circle, rgba(255, 240, 160, .95) 0 20%, rgba(255, 210, 120, 0) 62%); animation: burst .9s var(--gd) ease-out both; }
  @keyframes burst { 0% { transform: scale(.2); opacity: 0; } 30% { opacity: 1; } 100% { transform: scale(1.5); opacity: 0; } }
  .key { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 14px; margin-top: 12px; font: 700 13px var(--font-body); color: var(--muted); }
  .key span { display: flex; align-items: center; gap: 5px; }
  .key i { width: 14px; height: 14px; border-radius: 4px; display: inline-block; font-style: normal; }
  .key .fast { background: #a7e6c3; } .key .slow { background: #ffe38a; } .key .miss { background: #f7b6cd; }
  .key .dueic { width: auto; height: auto; font-size: 13px; }

  .side { flex: 0 0 330px; display: flex; flex-direction: column; gap: 12px; }
  .side .card { padding: 14px 16px; }
  .detail { position: relative; animation: pop-in .3s cubic-bezier(.3, .8, .4, 1.4); }
  .x { position: absolute; right: 8px; top: 6px; border: 0; background: none; font: 600 26px/1 var(--font-ui); color: var(--muted); cursor: pointer; }
  .dhead { display: flex; align-items: center; gap: 10px; }
  .dflower { display: grid; place-items: center; width: 74px; height: 74px; border-radius: 20px; background: radial-gradient(circle at 50% 70%, #a2704f, #7c4f33); flex: none; }
  .dfact { font: 600 30px var(--font-ui); }
  .dfact b { color: var(--primary-edge); }
  .dstage { display: inline-block; font: 800 12px var(--font-body); letter-spacing: .06em; text-transform: uppercase; padding: 3px 9px; border-radius: 999px; background: #efeaf8; color: var(--ink2); }
  .dstage.s1 { background: #e3f6e8; color: #2e7d4c; } .dstage.s2 { background: #efe6ff; color: #5b3fb8; } .dstage.s3 { background: #ffe3f0; color: #b02a68; }
  .story { margin: 10px 0 6px; font: 600 15px/1.4 var(--font-body); color: var(--ink2); }
  .stats { display: flex; gap: 8px; flex-wrap: wrap; }
  .stats span { font: 700 13px var(--font-body); color: var(--muted); background: var(--bg2); border-radius: 10px; padding: 4px 9px; }
  .stats b { font: 600 18px var(--font-ui); color: var(--ink); }
  .days { display: flex; align-items: center; gap: 5px; margin-top: 8px; font: 700 13px var(--font-body); color: var(--ink2); }
  .days i { width: 18px; height: 18px; border-radius: 50%; background: #efeaf8; box-shadow: inset 0 0 0 2px #ddd4ef; }
  .days i.on { background: #4fcf98; box-shadow: none; }
  .days span { margin-left: 4px; }
  .next { margin: 8px 0 0; font: 600 14px var(--font-body); color: var(--ink2); }
  .turn { margin-top: 10px; width: 100%; display: flex; align-items: center; gap: 8px; border: 0; border-radius: 12px; background: #f7fbf2; padding: 6px 10px; font: 600 14px var(--font-body); color: var(--ink2); cursor: pointer; text-align: left; }
  .turn:hover { background: #ecf7e4; }
  .beds .h, .grown summary { font: 600 18px var(--font-ui); display: block; margin-bottom: 6px; }
  .brow { display: grid; grid-template-columns: 112px 1fr 48px; align-items: center; gap: 8px; margin: 6px 0; }
  .brow.soon { opacity: .55; }
  .bl { font: 600 16px/1.05 var(--font-ui); display: flex; flex-direction: column; }
  .bl small { font: 700 11.5px var(--font-body); color: var(--muted); }
  .bar2 { position: relative; height: 12px; border-radius: 999px; background: #efe9e0; overflow: hidden; }
  .bar2 i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 999px; }
  .bar2 .g { background: #9fdcb5; } .bar2 .b { background: linear-gradient(90deg, #ff9ec7, #ff6fae); }
  .bn { font: 600 18px var(--font-ui); text-align: right; }
  .bn small { font: 700 12px var(--font-body); color: var(--muted); }
  .bnote { font: 700 12px var(--font-body); color: var(--muted); }
  .due { display: flex; align-items: center; gap: 10px; font: 600 14px/1.35 var(--font-body); color: var(--ink2); }
  .due b { font: 600 20px var(--font-ui); }
  .dueic.big { font-size: 28px; }
  .grown summary { cursor: pointer; margin: 0; }
  .grown[open] summary { margin-bottom: 8px; }
  .grown label { display: block; font: 600 14px/1.5 var(--font-body); color: var(--ink2); }
  .grown select { font: 700 14px var(--font-body); border-radius: 8px; border: 2px solid #e4dcf2; padding: 2px 6px; background: #fff; }
  .grown small { display: block; margin-top: 6px; font: 600 12.5px/1.35 var(--font-body); color: var(--muted); }

  /* two butterflies drift across the garden */
  .fly { position: absolute; width: 34px; height: 26px; pointer-events: none; z-index: 4; }
  .fly .wing { transform-origin: 50% 50%; animation: flap .28s ease-in-out infinite alternate; }
  .f1 { animation: drift1 26s linear infinite; }
  .f2 { animation: drift2 34s linear infinite; animation-delay: -12s; width: 28px; height: 22px; }
  @keyframes flap { to { transform: scaleX(.35); } }
  @keyframes drift1 { 0% { left: -40px; top: 22%; } 25% { top: 14%; } 50% { top: 30%; } 75% { top: 18%; } 100% { left: calc(100% + 40px); top: 26%; } }
  @keyframes drift2 { 0% { left: calc(100% + 40px); top: 62%; } 30% { top: 48%; } 60% { top: 70%; } 100% { left: -40px; top: 55%; } }
  @media (prefers-reduced-motion: reduce) { .sway :global(svg), .fl :global(svg), .fly, .fly .wing, .drops circle { animation: none !important; } }

  @media (max-width: 860px) {
    .bar { padding: 8px 10px; gap: 8px; }
    .bar h1 { font-size: 22px; }
    .tally { gap: 4px; }
    .tally span { padding: 0 8px 0 0; }
    .tally small { display: none; }
    .tally b { font-size: 18px; }
    .tally :global(svg) { width: 24px; height: 24px; }
    .body { padding: 10px 10px 20px; gap: 10px; }
    .top { flex-direction: column; }
    .buddy { flex: none; }
    .how { gap: 2px; padding: 10px 6px; }
    .how li { min-width: 64px; }
    .how li b { font-size: 15px; }
    .how li small { font-size: 11px; max-width: 74px; }
    .how .arrow { font-size: 22px; }
    .st { width: 44px; height: 44px; }
    .st :global(svg) { width: 36px; height: 36px; }
    .main { flex-direction: column; }
    .bed { width: 100%; padding: 6px; }
    .tbl { grid-template-columns: 18px repeat(11, minmax(0, 1fr)); gap: 2px; padding: 6px; border-radius: 12px; }
    .corner, .ch, .rh { font-size: 12px; }
    .cell { border-radius: 5px; }
    .cell.due::after { font-size: 9px; right: -2px; top: -4px; }
    .side { flex: none; width: 100%; }
    /* the chosen fact sits at the bottom of the screen, over the garden */
    .detail { position: fixed; left: 8px; right: 8px; bottom: 8px; z-index: 20; max-height: 60vh; overflow-y: auto; box-shadow: 0 -6px 30px rgba(40, 28, 70, .25); }
  }
</style>
