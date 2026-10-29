<script lang="ts">
  // The Fact Garden, in 3D: a garden island with four plots (plus, take away, times, share). Each fact
  // is a plant in a raised bed, one bed for each row of the table: a seed, a sprout, a bud, then a flower
  // in bloom. A glow at a plant's foot is its latest answer (green quick, gold slow, pink missed) and a
  // water drop floats over one due a check-up. Tap a plant to see exactly where it stands and why; tap a
  // bed's chip (or the arrows) to look at that bed up close. Plants that grew since the last visit pop
  // up one after another. It's also the grown-ups' view of what a child knows.
  import { onDestroy, onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { stage } from '../three/stage';
  import { GardenScene, type GPlot } from '../three/gardenScene';
  import { sfx } from '../audio/sound';
  import { factId, partnerOf, isRuleFact, avgThink, isDue, opSign, answerOf, FAST_MS, BLOOM_DAYS, type Fact, type Op, type Stage } from '../math/facts';
  import { ALL_GARDEN_IDS, GARDEN_BY_OP, mathOf, stageCounts } from '../math/progress';
  import { MATH_REGIONS, STRANDS, STRAND, groupFacts } from '../math/course';
  import { iconUrl } from '../art/icons';
  import CloseButton from '../ui/CloseButton.svelte';
  import Critter from '../ui/Critter.svelte';
  import NavTile from '../ui/NavTile.svelte';

  const base = import.meta.env.BASE_URL;
  const pic = (n: string) => `${base}garden/${n}.webp`;
  const STAGE_PIC = [pic('seed'), pic('sprout'), pic('bud'), iconUrl('bloom')];
  const STAGE_WORD = ['Seed', 'Sprout', 'Bud', 'Bloom'];
  const p = $derived(game.profile!);
  const m = $derived(mathOf(p));
  let op = $state<Op>(mathOf(game.profile!).strand ?? 'x');
  const R11 = Array.from({ length: 11 }, (_, i) => i);
  // each operation's garden: a bed for each row, a plant for each column
  const GRID: Record<Op, { rows: number[]; cols: number[]; fact: (r: number, c: number) => Fact; bedLabel: (r: number) => string; note: string }> = {
    x: { rows: [0, 1, 2, 10, 5, 4, 3, 6, 7, 8, 9], cols: R11, fact: (b, a) => ({ a, b }), bedLabel: b => `${b}s`, note: 'A bed for each times table: the plant numbered 6 in the 2s bed is 6 × 2. Learn 6 × 2 and its turnaround 2 × 6 grows too.' },
    '+': { rows: R11, cols: R11, fact: (b, a) => ({ a, b, op: '+' }), bedLabel: b => `+${b}`, note: 'Each bed adds its number: plant 6 in the +2 bed is 6 + 2. Its turnaround, 2 + 6, grows with it.' },
    '-': { rows: R11, cols: R11, fact: (b, d) => ({ a: b + d, b, op: '-' }), bedLabel: b => `−${b}`, note: 'Each bed takes its number away; the plant\'s number is what\'s left. 8 − 3 = 5 is plant 5 in the −3 bed. Its partner 8 − 5 grows with it.' },
    '/': { rows: R11.slice(1), cols: R11, fact: (b, q) => ({ a: b * q, b, op: '/' }), bedLabel: b => `÷${b}`, note: 'Each bed shares by its number; the plant\'s number is the answer. 42 ÷ 6 = 7 is plant 7 in the ÷6 bed. Blooming times facts start these growing.' },
  };
  const grid = $derived(GRID[op]);
  const ids = $derived(GARDEN_BY_OP[op]);
  const counts = $derived(stageCounts(m, ids));
  const plotOf = (o: Op) => STRANDS.findIndex(s => s.op === o);
  const due = $derived(ids.filter(id => isDue(m.facts[id], Date.now())));
  const fastS = $derived(Math.round((m.fastMs ?? FAST_MS) / 1000));
  // which region teaches each fact, for "it comes up on the ... trips"
  const REGION_OF = new Map<string, string>();
  for (const r of MATH_REGIONS) for (const g of r.groups) for (const f of groupFacts(g)) if (!REGION_OF.has(factId(f))) REGION_OF.set(factId(f), r.name);

  // growth since the last visit: those plants pop up, one after another
  const seenBefore = mathOf(game.profile!).gardenSeen;
  const grewIds = ALL_GARDEN_IDS.filter(id => (mathOf(game.profile!).facts[id]?.stage ?? 0) > (seenBefore?.[id] ?? 0));
  const firstVisit = !seenBefore;
  // where every fact grows: its plot, bed and column
  const WHERE = new Map<string, { op: Op; bed: number; col: number }>();
  for (const s of STRANDS) GRID[s.op].rows.forEach((rw, bed) => GRID[s.op].cols.forEach((c, col) => WHERE.set(factId(GRID[s.op].fact(rw, c)), { op: s.op, bed, col })));

  /** The four plots for the 3D garden, from the save. */
  function plots(): GPlot[] {
    const mm = mathOf(game.profile!), now = Date.now();
    // only plants in the plot that's open at first pop up (the others have already grown when you get there)
    const order = new Map(grewIds.filter(id => WHERE.get(id)?.op === op).map((id, i) => [id, i]));
    return STRANDS.map(s => ({
      op: s.op, title: s.name, sign: opSign(s.op), color: s.color,
      beds: GRID[s.op].rows.map((rw, j) => ({
        label: GRID[s.op].bedLabel(rw), color: j % 6,
        plants: GRID[s.op].cols.map(c => {
          const id = factId(GRID[s.op].fact(rw, c)), st = mm.facts[id];
          return { id, stage: (st?.stage ?? 0) as Stage, latest: st?.seen ? (st.latest ?? null) : null, due: isDue(st, now), grew: firstVisit ? -1 : order.get(id) ?? -1 };
        }),
      })),
    }));
  }

  // ---------- the 3D garden ----------
  let scene: GardenScene | null = null;
  let disposed = false;
  let loading = $state(true);
  let viewEl: HTMLDivElement | undefined = $state();
  let bed = $state<number | null>(null);
  let narrow = $state(innerWidth < 861);
  function viewOf() {
    const r = viewEl?.getBoundingClientRect();
    // frame the garden between the tabs along the top and the bed chips (and, on a phone, the key) along the bottom
    return r ? { top: (r.top + 54) / innerHeight, bottom: (r.bottom - (narrow ? 104 : 64)) / innerHeight, left: r.left / innerWidth, right: r.right / innerWidth } : { top: 0.12, bottom: 0.9, left: 0, right: 0.75 };
  }
  function onResize() { narrow = innerWidth < 861; if (scene) scene.view = viewOf(); }
  onMount(async () => {
    addEventListener('resize', onResize);
    const snap: Record<string, number> = {};
    for (const id of ALL_GARDEN_IDS) { const s = mathOf(game.profile!).facts[id]?.stage; if (s) snap[id] = s; }
    try {
      const sc = await GardenScene.create({ plots: plots(), buddy: game.profile!.buddy, view: viewOf(), plot: plotOf(op) });
      if (disposed) { sc.dispose(); return; }
      scene = sc; stage.use(sc);
      requestAnimationFrame(onResize);
    } catch (e) { console.error(e); }
    loading = false;
    game.update(pp => { pp.math = { ...mathOf(pp), gardenSeen: snap }; });
    if (grewIds.length && !firstVisit) setTimeout(() => sfx.star(2), 900);
    raf = requestAnimationFrame(follow);
  });
  onDestroy(() => { disposed = true; cancelAnimationFrame(raf); removeEventListener('resize', onResize); if (scene && stage.current() === scene) stage.use(null); });

  // the picked plant's little name tag follows it on screen
  let raf = 0;
  let tag = $state<{ x: number; y: number } | null>(null);
  function follow() {
    const at = picked && scene ? scene.screenOf(factId(picked)) : null, r = viewEl?.getBoundingClientRect();
    tag = at && r ? { x: at.x * innerWidth - r.left, y: at.y * innerHeight - r.top } : null;
    raf = requestAnimationFrame(follow);
  }

  function setOp(o: Op) { if (o === op) return; op = o; bed = null; picked = null; scene?.select(null); scene?.show(plotOf(o), null); sfx.click(); }
  function goBed(b: number | null) { bed = b; scene?.show(plotOf(op), b); sfx.click(); }
  function step(d: number) {
    const n = grid.rows.length;
    goBed(bed === null ? (d > 0 ? 0 : n - 1) : bed + d < 0 || bed + d >= n ? null : bed + d);
  }
  /** a tap on the garden: a plant opens its card, the buddy cheers */
  function tap(e: MouseEvent) {
    if (e.target !== viewEl || !scene) return;
    const h = scene.pickAt(e.clientX, e.clientY);
    if (h === 'buddy') { say = `${['Hi!', 'Water break!', 'Look how they grow!', 'Wheee!'][Math.floor(Math.random() * 4)]}`; sfx.pop(); return; }
    if (!h) return;
    const w = WHERE.get(h.id);
    if (w) pick(GRID[w.op].fact(GRID[w.op].rows[w.bed], GRID[w.op].cols[w.col]));
  }

  let picked = $state<Fact | null>(null);
  const pickedStat = $derived(picked ? m.facts[factId(picked)] : undefined);
  const partner = $derived(picked && factId(partnerOf(picked)) !== factId(picked) ? partnerOf(picked) : null);
  const partnerStat = $derived(partner ? m.facts[factId(partner)] : undefined);
  function pick(f: Fact) {
    const w = WHERE.get(factId(f));
    picked = f; sfx.pop();
    if (w) { if (w.op !== op) op = w.op; if (bed !== w.bed) { bed = w.bed; scene?.show(plotOf(w.op), w.bed); } }
    scene?.select(factId(f));
  }
  function unpick() { picked = null; scene?.select(null); }

  const show = (f: Fact) => `${f.a} ${opSign(f)} ${f.b}`;
  /** Why a fact is where it is, in a child's words. */
  function story(f: Fact): string {
    const s = m.facts[factId(f)];
    const pf = partnerOf(f), o = f.op ?? 'x';
    if (s?.seen) {
      if (s.stage === 3) return 'In bloom: you knew it quickly on three different days.';
      if (s.stage === 2) return `A bud: you can answer it. Answer it quickly on ${BLOOM_DAYS} different days and it blooms.`;
      return 'A sprout: you have met it. Get it right and it grows a bud.';
    }
    if ((s?.stage ?? 0) > 0) {
      if (o === '-' || o === '/') return `Not asked yet, but it's growing already: its family is coming along (${o === '-' ? 'adding' : 'times'} facts that bloom start these growing, and so does ${show(pf)}).`;
      return `Not asked yet, but it's growing already: you know ${show(pf)}, its turnaround. Swap the numbers and the answer stays the same, so this one grows too.`;
    }
    const where = REGION_OF.get(factId(f));
    if (isRuleFact(f)) {
      const rule = o === 'x' ? (f.a === 0 || f.b === 0 ? 'anything times 0 is 0' : 'times 1 keeps the number the same') : o === '+' ? 'adding 0 changes nothing' : o === '-' ? (f.b === 0 ? 'taking away 0 changes nothing' : 'a number take away itself is 0') : f.b === 1 ? 'sharing into one group keeps it all' : f.a === 0 ? 'nothing shared is nothing each' : 'a number shared by itself is 1 each';
      return `A seed, not asked yet. It follows a rule: ${rule}. It comes up ${o === 'x' ? 'on the Zero and One trips' : where ? `on the ${where} trips` : 'as an easy one'} and in reviews.`;
    }
    if (where) return `A seed, not asked yet. It comes up on the ${where} trips${o === 'x' || o === '+' ? `, and learning ${show(pf)} grows it too` : ''}.`;
    return `A seed, not asked yet. Learn ${show(pf)} and this one starts growing too.`;
  }

  // the beds: each row, how much of it is in bloom
  const beds = $derived(grid.rows.map((rw, j) => {
    const bid = grid.cols.map(c => factId(grid.fact(rw, c)));
    const st = bid.map(id => m.facts[id]?.stage ?? 0);
    return { j, label: grid.bedLabel(rw), total: bid.length, bloom: st.filter(s => s === 3).length, grow: st.filter(s => s > 0).length };
  }));

  function setFast(s: number) { game.update(pp => { pp.math = { ...mathOf(pp), fastMs: s * 1000 }; }); }
  let help = $state(false);
  function onKey(e: KeyboardEvent) {
    if (e.key !== 'Escape' || game.modalOpen) return;
    if (help) help = false; else if (picked) unpick(); else if (bed !== null) goBed(null); else game.go(game.home);
  }
  let say = $state(grewIds.length && !firstVisit ? `${grewIds.length} ${grewIds.length === 1 ? 'fact grew' : 'facts grew'} since you last looked!`
    : stageCounts(mathOf(game.profile!), ALL_GARDEN_IDS)[3] ? 'Tap any plant to see how it\'s doing!'
    : stageCounts(mathOf(game.profile!), ALL_GARDEN_IDS)[1] + stageCounts(mathOf(game.profile!), ALL_GARDEN_IDS)[2] ? 'Your garden is growing. Quick answers on different days make flowers bloom.'
    : 'Every fact you learn grows here. Take a trip on the Times Trail to plant your first ones!');
</script>

<svelte:window onkeydown={onKey} />

<div class="screen garden" class:narrow>
  <header class="bar">
    <NavTile size="sm" tone="sky" kind="home" label="Home" onclick={() => game.go('hub')} />
    <h1>Fact Garden</h1>
    <div class="tally" aria-label="Garden totals">
      <span title="In bloom"><img src={STAGE_PIC[3]} alt="" /><b>{counts[3]}</b><small>bloom</small></span>
      <span title="Buds"><img src={STAGE_PIC[2]} alt="" /><b>{counts[2]}</b><small>bud</small></span>
      <span title="Sprouts"><img src={STAGE_PIC[1]} alt="" /><b>{counts[1]}</b><small>sprout</small></span>
    </div>
    <button class="helpbtn" onclick={() => { help = !help; sfx.pop(); }} aria-label="How the garden works">?</button>
  </header>

  <div class="main">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="view" bind:this={viewEl} onclick={tap}>
      <div class="tabs" role="tablist" aria-label="Which garden">
        {#each STRANDS as st (st.op)}
          {@const n = stageCounts(m, GARDEN_BY_OP[st.op])[3]}
          <button role="tab" aria-selected={op === st.op} class:on={op === st.op} style:--sc={st.color} onclick={() => setOp(st.op)}>
            <img src="{base}{st.art}" alt="" /><span>{st.name}</span>{#if n}<em><img src={STAGE_PIC[3]} alt="" />{n}</em>{/if}
          </button>
        {/each}
      </div>

      <div class="say"><Critter friend={p.buddy} look={p.settings.look} size={narrow ? 40 : 52} round /><p>{say}</p></div>

      {#if loading}<div class="loadpill"><img src={STAGE_PIC[1]} alt="" />Planting your garden…</div>{/if}
      {#if picked && tag}<div class="tag" style:left="{tag.x}px" style:top="{tag.y}px">{show(picked)}</div>{/if}

      <div class="key" aria-label="What the glows mean">
        <span><img src={pic('quick')} alt="" />quick</span><span><img src={pic('slow')} alt="" />slow</span><span><img src={pic('missed')} alt="" />missed</span><span><img src={pic('due')} alt="" />check-up</span>
      </div>

      <nav class="bednav" aria-label="Beds">
        <button class="arrow" onclick={() => step(-1)} aria-label="Previous bed"><img src={iconUrl('back')} alt="" /></button>
        <div class="chips">
          <button class="chip whole" class:on={bed === null} onclick={() => goBed(null)}><img src={iconUrl('garden')} alt="" />Whole garden</button>
          {#each beds as b (b.j)}
            <button class="chip" class:on={bed === b.j} onclick={() => goBed(b.j)} title="{b.bloom} of {b.total} in bloom">
              <b>{b.label}</b><i class="mini"><i class="g" style:width="{(b.grow / b.total) * 100}%"></i><i class="b" style:width="{(b.bloom / b.total) * 100}%"></i></i>
            </button>
          {/each}
        </div>
        <button class="arrow next" onclick={() => step(1)} aria-label="Next bed"><img src={iconUrl('back')} alt="" /></button>
      </nav>
    </div>

    <aside class="side">
      {#if picked}
        {@const st = (pickedStat?.stage ?? 0) as Stage}
        <div class="card detail" role="dialog" aria-label={show(picked)}>
          <span class="x"><CloseButton onclick={unpick} size={36} /></span>
          <div class="dhead">
            <span class="dpic s{st}"><img src={STAGE_PIC[st]} alt="" /></span>
            <div>
              <div class="dfact">{show(picked)} = <b>{answerOf(picked)}</b></div>
              <div class="dstage s{st}">{STAGE_WORD[st]}</div>
            </div>
          </div>
          <p class="story">{story(picked)}</p>
          {#if pickedStat?.seen}
            <div class="stats">
              {#if pickedStat.latest}<span class="last"><img src={pic(pickedStat.latest === 'fast' ? 'quick' : pickedStat.latest === 'slow' ? 'slow' : 'missed')} alt="" />last time: <b>{pickedStat.latest === 'fast' ? 'quick' : pickedStat.latest === 'slow' ? 'slow' : 'missed'}</b></span>{/if}
              <span><b>{pickedStat.seen}</b> asked</span>
              <span><b>{pickedStat.right}</b> right</span>
              {#if avgThink(pickedStat) !== null}<span><b>{(avgThink(pickedStat)! / 1000).toFixed(1)}s</b> to start</span>{/if}
            </div>
            {#if st === 2}
              <div class="days" aria-label="Quick days">{#each Array(BLOOM_DAYS) as _, i}<img class:on={i < pickedStat.fastDays.length} src={pic('quick')} alt="" />{/each}<span>quick on {pickedStat.fastDays.length} of {BLOOM_DAYS} days</span></div>
            {/if}
            {#if st === 3 && pickedStat.due}<p class="next"><img src={pic('due')} alt="" />Next check-up: {new Date(pickedStat.due).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}.</p>{/if}
          {/if}
          {#if partner}
            <button class="turn" onclick={() => pick(partner!)}>
              <img src={STAGE_PIC[(partnerStat?.stage ?? 0) as Stage]} alt="" />
              <span>{picked.op === '-' || picked.op === '/' ? 'Family' : 'Turnaround'}: <b>{show(partner)}</b> · {STAGE_WORD[partnerStat?.stage ?? 0]}</span>
            </button>
          {/if}
        </div>
      {/if}

      {#if !narrow || help}
        <div class="card how" class:sheet={narrow}>
          {#if narrow}<span class="x"><CloseButton onclick={() => (help = false)} size={34} /></span>{/if}
          <b class="h">How a fact grows</b>
          <ol>
            {#each [0, 1, 2, 3] as s (s)}
              <li><img src={STAGE_PIC[s]} alt="" /><b>{STAGE_WORD[s]}</b><small>{['not asked yet', 'you met it', 'you got it right', `quick on ${BLOOM_DAYS} different days`][s]}</small></li>
            {/each}
          </ol>
          <p class="foot">A slip moves a fact back one step. Blooms get check-ups after 1, 3, 7, 14 and 30 days to stay fresh. {grid.note}</p>
          {#if due.length}<p class="duenote"><img src={pic('due')} alt="" /><span><b>{due.length}</b> {due.length === 1 ? 'plant needs' : 'plants need'} a check-up. They come up on your next trips.</span></p>{/if}
          <details class="grown">
            <summary>For grown-ups</summary>
            <label>“Quick” means starting to answer within <select value={fastS} onchange={(e) => setFast(Number((e.currentTarget as HTMLSelectElement).value))}>{#each [2, 3, 4, 5, 6] as s}<option value={s}>{s} seconds</option>{/each}</select></label>
            <small>3 seconds is the usual line for knowing a fact by heart. Only thinking time counts, not typing. Tap any plant for its history.</small>
          </details>
        </div>
      {/if}

      {#if !narrow}
        <div class="card bedlist">
          <b class="h">{STRAND[op].name} beds</b>
          {#each beds as b (b.j)}
            <button class="brow" class:on={bed === b.j} onclick={() => goBed(b.j)}>
              <span class="bl">{b.label}</span>
              <span class="bar2"><i class="g" style:width="{(b.grow / b.total) * 100}%"></i><i class="b" style:width="{(b.bloom / b.total) * 100}%"></i></span>
              <span class="bn">{b.bloom}<small>/{b.total}</small></span>
            </button>
          {/each}
          <small class="bnote">Pink: in bloom. Green: growing.</small>
        </div>
      {/if}
    </aside>
  </div>
</div>

<style>
  .garden { display: flex; flex-direction: column; background: none; pointer-events: none; }
  .garden > :global(*) { pointer-events: auto; }
  .bar { flex: none; display: flex; align-items: center; gap: 14px; padding: 8px 18px; background: rgba(255, 255, 255, .94); border-bottom: var(--panel-border); position: relative; z-index: 3; }
  .bar h1 { font-size: 30px; margin: 0; }
  .tally { margin-left: auto; display: flex; gap: 8px; }
  .tally span { display: flex; align-items: center; gap: 4px; background: #f4fbf3; border-radius: 999px; padding: 2px 12px 2px 4px; box-shadow: inset 0 0 0 2px #e0f1df; }
  .tally img { width: 34px; height: 34px; object-fit: contain; }
  .tally b { font: 600 22px var(--font-ui); }
  .tally small { font: 700 12px var(--font-body); color: var(--muted); }
  .helpbtn { width: 42px; height: 42px; border-radius: 50%; border: 0; background: #fff; font: 600 24px/1 var(--font-ui); color: var(--primary); cursor: pointer; box-shadow: 0 0 0 3px #ffd36b, var(--shadow-sm); display: none; }

  .main { flex: 1; min-height: 0; display: flex; pointer-events: none; }
  .main > * { pointer-events: auto; }
  /* the 3D garden shows through this box; things float over it */
  .view { position: relative; flex: 1; min-width: 0; cursor: pointer; }
  .view > :global(*) { cursor: default; }
  .tabs { position: absolute; top: 10px; left: 50%; transform: translateX(-50%); display: flex; gap: 6px; padding: 5px; border-radius: 999px; background: rgba(255, 255, 255, .9); box-shadow: 0 8px 22px -12px rgba(30, 40, 20, .5); white-space: nowrap; }
  .tabs button { display: flex; align-items: center; gap: 6px; border: 0; cursor: pointer; padding: 3px 12px 3px 3px; border-radius: 999px; background: transparent; font: 600 15px var(--font-ui); color: var(--ink2); }
  .tabs button img { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; box-shadow: 0 0 0 2px #fff; }
  .tabs button.on { background: var(--sc); color: #fff; }
  .tabs em { display: flex; align-items: center; gap: 1px; font: 800 12px var(--font-body); font-style: normal; background: #fff; color: #b02a68; border-radius: 999px; padding: 0 7px 0 2px; }
  .tabs em img { width: 18px; height: 18px; box-shadow: none; border-radius: 0; object-fit: contain; }
  .say { position: absolute; left: 12px; top: 64px; display: flex; align-items: center; gap: 8px; max-width: min(380px, 60%); }
  .say p { margin: 0; font: 600 15px/1.35 var(--font-body); color: var(--ink); background: rgba(255, 255, 255, .95); padding: 8px 12px; border-radius: 16px; box-shadow: 0 6px 18px -10px rgba(30, 40, 20, .5); }
  .loadpill { position: absolute; left: 50%; top: 45%; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 8px; background: #fff; padding: 6px 18px 6px 6px; border-radius: 999px; font: 600 18px var(--font-ui); color: var(--ink2); box-shadow: var(--shadow-sm); }
  .loadpill img { width: 40px; height: 40px; animation: bob 1s ease-in-out infinite; }
  @keyframes bob { 50% { transform: translateY(-4px) rotate(-6deg); } }
  .tag { position: absolute; transform: translate(-50%, -100%); pointer-events: none; font: 600 18px var(--font-ui); color: var(--ink); background: #fff; padding: 2px 12px; border-radius: 999px; box-shadow: 0 0 0 3px #ffd34d, 0 8px 18px -8px rgba(30, 20, 60, .5); white-space: nowrap; }
  .key { position: absolute; right: 12px; top: 64px; display: flex; flex-direction: column; gap: 2px; background: rgba(255, 255, 255, .92); border-radius: 16px; padding: 6px 12px 6px 6px; box-shadow: 0 6px 18px -10px rgba(30, 40, 20, .5); font: 700 13px var(--font-body); color: var(--ink2); }
  .key span { display: flex; align-items: center; gap: 6px; }
  .key img { width: 28px; height: 28px; object-fit: contain; }

  .bednav { position: absolute; left: 10px; right: 10px; bottom: 10px; display: flex; align-items: center; gap: 6px; }
  .arrow { flex: none; width: 46px; height: 46px; border: 0; border-radius: 50%; background: #fff; display: grid; place-items: center; cursor: pointer; box-shadow: var(--shadow-sm); padding: 0; }
  .arrow img { width: 34px; height: 34px; object-fit: contain; }
  .arrow.next img { transform: scaleX(-1); }
  .chips { flex: 1; min-width: 0; display: flex; gap: 5px; overflow-x: auto; padding: 4px; border-radius: 999px; background: rgba(255, 255, 255, .88); scrollbar-width: none; }
  .chips::-webkit-scrollbar { display: none; }
  .chip { flex: none; display: flex; flex-direction: column; align-items: center; gap: 3px; border: 0; cursor: pointer; padding: 5px 10px 6px; border-radius: 16px; background: #f4f0e8; font: 600 15px/1 var(--font-ui); color: var(--ink); }
  .chip.whole { flex-direction: row; gap: 5px; padding: 3px 12px 3px 4px; border-radius: 999px; font-size: 14px; }
  .chip.whole img { width: 30px; height: 30px; object-fit: contain; }
  .chip.on { background: var(--primary); color: #fff; }
  .mini { position: relative; display: block; width: 34px; height: 6px; border-radius: 999px; background: rgba(0, 0, 0, .1); overflow: hidden; }
  .mini i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 999px; }
  .mini .g { background: #6fd39a; } .mini .b { background: #ff6fae; }

  .side { flex: 0 0 340px; display: flex; flex-direction: column; gap: 10px; padding: 10px 12px 12px 0; overflow-y: auto; }
  .side .card { padding: 14px 16px; position: relative; }
  .x { position: absolute; right: 8px; top: 8px; display: grid; }
  .detail { animation: pop-in .3s cubic-bezier(.3, .8, .4, 1.4); box-shadow: 0 0 0 3px #ffd34d, var(--shadow-sm); }
  .dhead { display: flex; align-items: center; gap: 10px; padding-right: 36px; }
  .dpic { flex: none; width: 74px; height: 74px; display: grid; place-items: center; border-radius: 20px; background: radial-gradient(circle at 50% 65%, #f6efe2, #e6d6bc); }
  .dpic.s3 { background: radial-gradient(circle at 50% 60%, #fff4fa, #ffd6ea); }
  .dpic img { width: 64px; height: 64px; object-fit: contain; }
  .dfact { font: 600 30px var(--font-ui); }
  .dfact b { color: var(--primary-edge); }
  .dstage { display: inline-block; font: 800 12px var(--font-body); letter-spacing: .06em; text-transform: uppercase; padding: 3px 9px; border-radius: 999px; background: #efeaf8; color: var(--ink2); }
  .dstage.s1 { background: #e3f6e8; color: #2e7d4c; } .dstage.s2 { background: #efe6ff; color: #5b3fb8; } .dstage.s3 { background: #ffe3f0; color: #b02a68; }
  .story { margin: 10px 0 6px; font: 600 15px/1.4 var(--font-body); color: var(--ink2); }
  .stats { display: flex; gap: 6px; flex-wrap: wrap; }
  .stats span { display: flex; align-items: center; gap: 4px; font: 700 13px var(--font-body); color: var(--muted); background: var(--bg2); border-radius: 10px; padding: 4px 9px; }
  .stats b { font: 600 17px var(--font-ui); color: var(--ink); }
  .stats .last img { width: 22px; height: 22px; object-fit: contain; }
  .days { display: flex; align-items: center; gap: 3px; margin-top: 8px; font: 700 13px var(--font-body); color: var(--ink2); }
  .days img { width: 24px; height: 24px; object-fit: contain; filter: grayscale(1) opacity(.35); }
  .days img.on { filter: none; }
  .days span { margin-left: 4px; }
  .next { display: flex; align-items: center; gap: 6px; margin: 8px 0 0; font: 600 14px var(--font-body); color: var(--ink2); }
  .next img { width: 24px; height: 24px; }
  .turn { margin-top: 10px; width: 100%; display: flex; align-items: center; gap: 8px; border: 0; border-radius: 12px; background: #f7fbf2; padding: 6px 10px; font: 600 14px var(--font-body); color: var(--ink2); cursor: pointer; text-align: left; }
  .turn img { width: 34px; height: 34px; object-fit: contain; }
  .turn:hover { background: #ecf7e4; }

  .how .h, .bedlist .h, .grown summary { font: 600 18px var(--font-ui); display: block; margin-bottom: 6px; }
  .how ol { margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
  .how li { display: flex; flex-direction: column; align-items: center; text-align: center; }
  .how li img { width: 52px; height: 52px; object-fit: contain; }
  .how li b { font: 600 15px var(--font-ui); }
  .how li small { font: 700 11px/1.2 var(--font-body); color: var(--muted); }
  .foot { margin: 8px 0 0; font: 600 13px/1.4 var(--font-body); color: var(--ink2); background: #f7fbf2; border-radius: 12px; padding: 6px 10px; }
  .duenote { display: flex; align-items: center; gap: 8px; margin: 8px 0 0; font: 600 13.5px/1.35 var(--font-body); color: var(--ink2); }
  .duenote img { width: 30px; height: 30px; }
  .grown { margin-top: 8px; }
  .grown summary { cursor: pointer; margin: 0; font-size: 15px; }
  .grown label { display: block; margin-top: 6px; font: 600 14px/1.5 var(--font-body); color: var(--ink2); }
  .grown select { font: 700 14px var(--font-body); border-radius: 8px; border: 2px solid #e4dcf2; padding: 2px 6px; background: #fff; }
  .grown small { display: block; margin-top: 6px; font: 600 12.5px/1.35 var(--font-body); color: var(--muted); }
  .brow { width: 100%; display: grid; grid-template-columns: 52px 1fr 48px; align-items: center; gap: 8px; margin: 2px 0; padding: 3px 6px; border: 0; border-radius: 10px; background: none; cursor: pointer; text-align: left; }
  .brow:hover { background: #f6f2ea; }
  .brow.on { background: #efe8ff; }
  .bl { font: 600 16px var(--font-ui); color: var(--ink); }
  .bar2 { position: relative; height: 12px; border-radius: 999px; background: #efe9e0; overflow: hidden; }
  .bar2 i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 999px; }
  .bar2 .g { background: #9fdcb5; } .bar2 .b { background: linear-gradient(90deg, #ff9ec7, #ff6fae); }
  .bn { font: 600 18px var(--font-ui); text-align: right; color: var(--ink); }
  .bn small { font: 700 12px var(--font-body); color: var(--muted); }
  .bnote { font: 700 12px var(--font-body); color: var(--muted); }

  /* a phone: the garden fills the screen; the card and the how-to slide up from the bottom */
  .narrow .bar { padding: 6px 8px; gap: 6px; }
  .narrow .bar h1 { font-size: 20px; }
  .narrow .tally { gap: 3px; }
  .narrow .tally span { padding: 0 7px 0 0; }
  .narrow .tally small { display: none; }
  .narrow .tally img { width: 26px; height: 26px; }
  .narrow .tally b { font-size: 16px; }
  .narrow .helpbtn { display: block; flex: none; width: 36px; height: 36px; font-size: 20px; }
  @media (max-width: 480px) { .narrow .bar h1 { display: none; } .narrow .tally { margin-left: auto; } }
  .narrow .side { position: absolute; left: 0; right: 0; bottom: 0; padding: 0 8px 8px; overflow: visible; pointer-events: none; z-index: 20; }
  .narrow .side > :global(*) { pointer-events: auto; }
  .narrow .detail, .narrow .sheet { max-height: 62vh; overflow-y: auto; box-shadow: 0 -6px 30px rgba(40, 28, 70, .25), 0 0 0 3px #ffd34d; }
  .narrow .tabs { left: 8px; right: 8px; transform: none; overflow-x: auto; scrollbar-width: none; }
  .narrow .tabs button { padding: 2px 9px 2px 2px; font-size: 12.5px; }
  .narrow .tabs button img { width: 26px; height: 26px; }
  .narrow .tabs button:not(.on) span { display: none; }
  .narrow .say { top: 58px; left: 8px; max-width: 72%; }
  .narrow .say p { font-size: 13px; padding: 6px 10px; }
  .narrow .key { top: auto; bottom: 66px; right: 8px; flex-direction: row; gap: 6px; padding: 4px 8px 4px 4px; font-size: 11px; }
  .narrow .key img { width: 22px; height: 22px; }
  .narrow .key span { gap: 2px; }
  .narrow .bednav { left: 6px; right: 6px; bottom: 8px; }
  .narrow .arrow { width: 40px; height: 40px; }
  .narrow .chip.whole span { display: none; }
  .narrow .how ol { gap: 2px; }
  .narrow .how li img { width: 42px; height: 42px; }
</style>
