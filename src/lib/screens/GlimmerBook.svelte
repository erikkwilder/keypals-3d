<script lang="ts">
  // The Glimmer Book (the 100-Glimmer ladder, adventure/ladder.ts): all 100 places, in groups (Everywhere,
  // Worlds, Milestones, Collections, Seasons, Secrets, Legends), "34 of 100" at the top and the goals
  // nearest to done. A Glimmer you've met shows its painting; one you haven't, its dark outline with what
  // brings it and how far along you are ("Comes to players who play 100 days: 37 so far"); a secret shows
  // only "A secret" and a tiny hint; one still being made says "On its way". Tap any card for more.
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { ELEMENT, EVOLVED, GLIMMER, RARITY, glimmerName, type GlimmerId } from '../adventure/glimmers';
  import { bookOf, SOURCES, type BookGroup, type BookPlace, type Standing } from '../adventure/ladder';
  import { advView } from '../adventure/state';
  import Header from '../ui/Header.svelte';
  import GlimmerTabs from '../ui/GlimmerTabs.svelte';
  import Icon from '../ui/Icon.svelte';

  const base = import.meta.env.BASE_URL;
  const p = $derived(game.profile!);
  const a = $derived(advView(p));
  const book = $derived(bookOf(p));
  /** each group's emblem: its special egg */
  const EMBLEM: Record<string, string> = { roll: 'egg-rare', native: 'egg-native', milestone: 'egg-milestone', collection: 'egg-collection', season: 'egg-season', secret: 'egg-secret', apex: 'egg-apex' };
  const places = (g: BookGroup) => g.parts.flatMap(pt => pt.places);
  const metIn = (g: BookGroup) => places(g).filter(pl => pl.kind === 'glimmer' && pl.s.state === 'met').length;
  const evo = (id: GlimmerId) => !!a.glimmers[id]?.evolved;
  const pct = (s: Standing) => Math.round((100 * Math.min(s.have, s.need)) / Math.max(1, s.need));
  /** what a card's line says: the hint (or its short form on a phone) */
  function line(s: Standing): { long: string; short: string } {
    if (s.state === 'egg') return { long: 'Its egg is waiting for you! Hatch it in Eggs.', short: 'Its egg is here!' };
    if (s.pending && s.reached) return { long: 'Goal reached! Its egg comes as soon as it\'s ready.', short: 'Goal reached!' };
    return { long: s.source === 'native' ? s.short : s.hint, short: s.secret ? 'A secret' : s.short };
  }
  const bar = (s: Standing) => s.source !== 'roll' && !s.secret && s.state === 'open';

  // the card opened for a closer look
  let sel = $state<{ s: Standing } | { world: string } | null>(null);
  function pick(pl: BookPlace) { sfx.pop(); sel = pl.kind === 'glimmer' ? { s: pl.s } : { world: pl.world }; }
  let scroller: HTMLDivElement | undefined = $state();
  function jump(id: string) { sfx.click(); scroller?.querySelector(`#grp-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  function team(id: GlimmerId) { game.glimmerSel = id; game.glimmerTab = 'team'; }
</script>

{#snippet pic(s: Standing, big = false)}
  {@const g = GLIMMER[s.id]}
  <div class="pic" class:big style:--el={ELEMENT[g.element].color}>
    {#if s.state === 'met'}<img class="paint" src="{base}game/glimmers/{s.id}{evo(s.id) ? '-evo' : ''}.webp" alt={glimmerName(s.id, evo(s.id))} loading="lazy" />
    {:else if s.state === 'egg'}<img class="egg" src="{base}game/egg-{s.source}.webp" alt="A special egg" loading="lazy" />
    {:else if s.secret}<img class="egg hush" src="{base}game/egg-secret.webp" alt="A secret" loading="lazy" />
    {:else}<img class="shape" src="{base}game/glimmers/shape/{s.id}.webp" alt="Not met yet" loading="lazy" />{/if}
    {#if !s.secret || s.state === 'met'}<img class="el" src="{base}game/icon-{g.element}.webp" alt={ELEMENT[g.element].name} />{/if}
    {#if s.state === 'met'}<span class="tick"><Icon name="check" size={big ? 26 : 18} /></span>{/if}
    {#if s.pending && s.state !== 'met'}<span class="way">On its way</span>{/if}
  </div>
{/snippet}

{#snippet card(pl: BookPlace)}
  {#if pl.kind === 'slot'}
    <button class="cd slot" onclick={() => pick(pl)}>
      <div class="pic"><img class="egg hush" src="{base}game/egg-native.webp" alt="" loading="lazy" /><span class="way">On its way</span></div>
      <b class="nm">???</b>
      <small class="ln"><span class="long">Lives in {pl.world}. Coming soon!</span><span class="short">{pl.world}</span></small>
    </button>
  {:else}
    {@const s = pl.s}
    {@const g = GLIMMER[s.id]}
    {@const l = line(s)}
    <button class="cd" class:met={s.state === 'met'} class:hot={s.state === 'egg' || (s.reached && s.state === 'open')} style:--rc={RARITY[g.rarity].color} style:--rg={RARITY[g.rarity].glow} onclick={() => pick(pl)}>
      {@render pic(s)}
      <b class="nm">{s.state === 'met' ? glimmerName(s.id, evo(s.id)) : s.secret ? 'A secret' : '???'}</b>
      {#if s.state === 'met'}<small class="ln rar" style:color={RARITY[g.rarity].color}>{RARITY[g.rarity].name}</small>
      {:else}
        <small class="ln"><span class="long">{l.long}</span><span class="short">{l.short}</span></small>
        {#if bar(s)}<div class="bar"><i style:width="{pct(s)}%"></i></div>{/if}
      {/if}
    </button>
  {/if}
{/snippet}

<div class="screen gb">
  <Header />
  <GlimmerTabs />
  <div class="body scroll" bind:this={scroller}>
    <section class="hero" style:background-image="url({base}game/book-hero.webp)">
      <div class="score">
        <div class="big"><b>{book.met}</b><span>of {book.total}</span></div>
        <small>Glimmers met</small>
        <div class="bar huge"><i style:width="{book.met}%"></i></div>
        <p>Some come from battles and eggs. The rest come from goals you can work toward, and some take years!</p>
      </div>
      {#if book.next.length}
        <div class="next">
          <h3>Almost there</h3>
          {#each book.next as s (s.id)}
            <button class="nx" onclick={() => pick({ kind: 'glimmer', s })}>
              <img src="{base}game/glimmers/shape/{s.id}.webp" alt="" />
              <span><b>{s.short}</b><span class="bar"><i style:width="{pct(s)}%"></i></span></span>
            </button>
          {/each}
        </div>
      {/if}
    </section>

    <nav class="jumps" aria-label="Groups">
      {#each book.groups as g (g.id)}
        <button onclick={() => jump(g.id)}><img src="{base}game/{EMBLEM[g.id]}.webp" alt="" /><span>{g.name}</span><small>{metIn(g)}/{places(g).length}</small></button>
      {/each}
    </nav>

    {#each book.groups as g (g.id)}
      <section class="grp" id="grp-{g.id}">
        <header class="gh">
          <img src="{base}game/{EMBLEM[g.id]}.webp" alt="" />
          <div><h2>{g.name} <small>{metIn(g)} of {places(g).length}</small></h2><p>{g.blurb}</p></div>
        </header>
        <div class="parts" class:many={g.parts.length > 1}>
          {#each g.parts as pt (pt.name)}
            <div class="pt">
              {#if pt.name}<h3 class="part">{pt.name}{#if pt.note}<small>{pt.note}</small>{/if}</h3>{/if}
              <div class="cards">{#each pt.places as pl, i (pl.kind === 'glimmer' ? pl.s.id : `${pl.world}-${i}`)}{@render card(pl)}{/each}</div>
            </div>
          {/each}
        </div>
      </section>
    {/each}
    <p class="foot">A day counts when you play 10 minutes. Seasons come back every year.</p>
  </div>

  {#if sel}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="sheetbg" onclick={() => (sel = null)}>
      <div class="sheet card" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
        {#if 'world' in sel}
          <div class="pic big"><img class="egg hush" src="{base}game/egg-native.webp" alt="" /><span class="way">On its way</span></div>
          <div class="txt">
            <small class="kick">Worlds</small>
            <h2>???</h2>
            <p>Lives in <b>{sel.world}</b>, a math world that's coming soon. Its Glimmers come to players who win battles there.</p>
          </div>
        {:else}
          {@const s = sel.s}
          {@const g = GLIMMER[s.id]}
          {@const own = a.glimmers[s.id]}
          {@render pic(s, true)}
          <div class="txt">
            <small class="kick" style:color={RARITY[g.rarity].color}>{SOURCES[s.source].group} · {RARITY[g.rarity].name}{s.secret && s.state !== 'met' ? '' : ` · ${ELEMENT[g.element].name}`}</small>
            <h2>{s.state === 'met' ? glimmerName(s.id, evo(s.id)) : s.secret ? 'A secret' : '???'}</h2>
            {#if s.state === 'met' && own}
              <p><b>In battles it helps you:</b> {g.power.text(own.level)}</p>
              {#if own.evolved}<p><b>Grown-up power:</b> {EVOLVED[s.id].perk}</p>{/if}
              <p class="qk">{g.quirk}</p>
              <button class="btn btn-primary" onclick={() => team(s.id)}>See it on your team</button>
            {:else}
              <p class="hint">{s.hint}</p>
              {#if bar(s)}<div class="bar huge"><i style:width="{pct(s)}%"></i></div><small class="sh">{s.short}</small>{/if}
              {#if s.state === 'egg'}<button class="btn btn-primary" onclick={() => game.go('eggs')}>Go to your eggs</button>{/if}
              {#if s.pending}<p class="note"><b>On its way!</b> This Glimmer is still being made. {s.reached ? 'You reached its goal, so its egg comes to you as soon as it\'s ready.' : 'If you reach its goal first, its egg comes as soon as it\'s ready.'}</p>{/if}
            {/if}
          </div>
        {/if}
        <button class="btn close" onclick={() => (sel = null)}>Close</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .gb { display: flex; flex-direction: column; background: radial-gradient(circle at 8% 0%, #ffe9f4 0, transparent 32%), radial-gradient(circle at 92% 8%, #e2f2ff 0, transparent 34%), radial-gradient(circle at 50% 100%, #fff4d6 0, transparent 40%), var(--bg); }
  .body { flex: 1; min-height: 0; overflow-x: hidden; padding: 16px 22px 28px; display: flex; flex-direction: column; gap: 16px; }
  /* the top: a painted banner, the count and the nearest goals */
  .hero { position: relative; flex: none; border-radius: 26px; overflow: hidden; background-size: cover; background-position: center 60%; min-height: 190px; display: flex; align-items: stretch; gap: 16px; padding: 16px; box-shadow: var(--shadow); }
  .hero::before { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, rgba(255, 255, 255, .9) 0%, rgba(255, 255, 255, .72) 38%, rgba(255, 255, 255, 0) 70%); pointer-events: none; }
  .score { position: relative; display: flex; flex-direction: column; justify-content: center; gap: 4px; width: min(380px, 50%); }
  .score .big { display: flex; align-items: baseline; gap: 8px; }
  .score .big b { font: 600 64px/1 var(--font-ui); color: #6a45e0; text-shadow: 0 3px 0 #fff, 0 6px 16px rgba(106, 69, 224, .3); }
  .score .big span { font: 600 26px var(--font-ui); color: var(--ink2); }
  .score small { font: 800 14px var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .06em; }
  .score p { margin: 6px 0 0; font: 700 15px/1.4 var(--font-body); color: var(--ink2); }
  .next { position: relative; margin-left: auto; align-self: center; display: flex; flex-direction: column; gap: 6px; width: min(300px, 40%); background: rgba(255, 255, 255, .86); border-radius: 20px; padding: 10px 12px; box-shadow: var(--shadow-sm); backdrop-filter: blur(4px); }
  .next h3 { margin: 0; font-size: 17px; color: var(--ink); }
  .nx { display: flex; align-items: center; gap: 10px; border: 0; background: none; padding: 2px; cursor: pointer; text-align: left; }
  .nx img { width: 34px; height: 50px; object-fit: contain; flex: none; opacity: .85; }
  .nx > span { flex: 1; display: flex; flex-direction: column; gap: 4px; }
  .nx b { font: 700 14px var(--font-body); color: var(--ink2); }
  .bar { position: relative; display: block; height: 9px; border-radius: 999px; background: #ece6f7; overflow: hidden; box-shadow: inset 0 1px 2px rgba(60, 40, 110, .18); }
  .bar i { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, #ffb52e, #ff7ab8, #a77cff); box-shadow: inset 0 2px 0 rgba(255, 255, 255, .45); }
  .bar.huge { height: 14px; }
  /* jump to a group */
  .jumps { flex: none; display: flex; gap: 8px; flex-wrap: wrap; }
  .jumps button { display: flex; align-items: center; gap: 6px; border: 0; cursor: pointer; background: #fff; border-radius: 999px; padding: 5px 14px 5px 6px; box-shadow: var(--shadow-sm); font: 600 16px var(--font-ui); color: var(--ink); }
  .jumps img { width: 26px; height: 32px; object-fit: contain; }
  .jumps small { font: 800 13px var(--font-body); color: var(--muted); }
  /* a group */
  .grp { flex: none; scroll-margin-top: 8px; display: flex; flex-direction: column; gap: 10px; }
  .gh { display: flex; align-items: center; gap: 12px; }
  .gh img { width: 46px; height: 58px; object-fit: contain; filter: drop-shadow(0 4px 6px rgba(60, 40, 110, .25)); }
  .gh h2 { margin: 0; font-size: 28px; color: var(--ink); }
  .gh h2 small { font: 800 15px var(--font-body); color: var(--muted); margin-left: 6px; }
  .gh p { margin: 0; font: 600 15px/1.35 var(--font-body); color: var(--ink2); }
  .parts.many { display: flex; flex-wrap: wrap; gap: 14px 26px; }
  .parts.many .pt { flex: 1 1 560px; display: flex; flex-direction: column; gap: 8px; padding: 10px 12px 12px; border-radius: 24px; background: rgba(255, 255, 255, .55); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .8); }
  .part { margin: 0; font-size: 19px; color: var(--ink); display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .part small { font: 700 13px var(--font-body); color: var(--muted); }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; }
  .cd { min-width: 0; }
  /* a card */
  .cd { position: relative; display: flex; flex-direction: column; align-items: stretch; gap: 5px; border: 0; cursor: pointer; text-align: left; padding: 8px 8px 10px; border-radius: 22px;
    background: linear-gradient(#fff, #fbf8ff); box-shadow: 0 0 0 2px color-mix(in srgb, var(--rc, #cfc6e6) 30%, transparent), 0 10px 22px -14px rgba(60, 40, 110, .45); transition: transform .15s, box-shadow .15s; }
  .cd:hover { transform: translateY(-3px); }
  .cd:focus-visible { outline: 3px solid var(--primary-hi); outline-offset: 3px; }
  .cd.met { box-shadow: 0 0 0 3px var(--rc), 0 0 18px -4px var(--rc), 0 10px 22px -14px rgba(60, 40, 110, .45); }
  .cd.hot { animation: hot 1.6s ease-in-out infinite; }
  @keyframes hot { 50% { box-shadow: 0 0 0 3px #ffd36b, 0 0 22px #ffd36b, 0 10px 22px -14px rgba(60, 40, 110, .45); } }
  .pic { position: relative; aspect-ratio: 4 / 5; border-radius: 16px; overflow: hidden; display: grid; place-items: center;
    background: radial-gradient(circle at 50% 38%, #fff 0%, color-mix(in srgb, var(--el, #c9b8f0) 22%, #fff) 55%, color-mix(in srgb, var(--el, #c9b8f0) 42%, #f4efff) 100%); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .7), inset 0 -10px 18px -10px rgba(60, 40, 110, .25); }
  .pic .paint { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center 45%; }
  .pic .shape { width: 92%; height: 92%; object-fit: contain; opacity: .82; filter: drop-shadow(0 2px 0 rgba(255, 255, 255, .7)); }
  .pic .egg { position: absolute; left: 15%; top: 10%; width: 70%; height: 76%; object-fit: contain; filter: drop-shadow(0 6px 8px rgba(60, 40, 110, .35)); animation: wob 2.4s ease-in-out infinite; transform-origin: 50% 90%; }
  .pic .egg.hush { filter: drop-shadow(0 6px 8px rgba(60, 40, 110, .3)) saturate(.55) brightness(.92); animation: none; }
  @keyframes wob { 0%, 70%, 100% { transform: rotate(0); } 78% { transform: rotate(-6deg); } 86% { transform: rotate(6deg); } 94% { transform: rotate(-3deg); } }
  .pic .el { position: absolute; top: 6px; left: 6px; width: 26px; filter: drop-shadow(0 2px 3px rgba(0, 0, 0, .3)); }
  .pic .tick { position: absolute; top: 6px; right: 6px; display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; background: #fff; box-shadow: 0 2px 6px rgba(0, 0, 0, .2); }
  .pic .way { position: absolute; left: 50%; bottom: 8px; transform: translateX(-50%); white-space: nowrap; font: 800 12px var(--font-body); color: #6a4300; background: linear-gradient(#ffeaa0, #ffcf55); padding: 3px 10px; border-radius: 999px; box-shadow: 0 0 0 2px #fff, 0 3px 8px -3px rgba(120, 70, 0, .5); }
  .nm { font: 600 16px/1.15 var(--font-ui); color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ln { font: 700 12.5px/1.3 var(--font-body); color: var(--ink2); }
  .ln.rar { text-transform: uppercase; letter-spacing: .05em; font-size: 11.5px; }
  .ln .short { display: none; }
  .slot { opacity: .9; }
  .slot .pic { background: repeating-linear-gradient(135deg, #f6f1ff 0 12px, #efe8fd 12px 24px); }
  .foot { margin: 6px 0 0; text-align: center; font: 700 14px var(--font-body); color: var(--muted); }
  /* the closer look */
  .sheetbg { position: fixed; inset: 0; z-index: 40; display: grid; place-items: center; padding: 16px; background: rgba(40, 28, 70, .45); }
  .sheet { position: relative; width: min(620px, 94vw); max-height: 92vh; overflow-y: auto; padding: 18px; display: grid; grid-template-columns: 220px 1fr; gap: 18px; align-items: start; border-radius: 28px; }
  .sheet .txt { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  .sheet .kick { font: 800 13px var(--font-body); text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
  .sheet h2 { margin: 0; font-size: 30px; color: var(--ink); }
  .sheet p { margin: 0; font: 600 16px/1.45 var(--font-body); color: var(--ink2); }
  .sheet .hint { font-size: 18px; color: var(--ink); }
  .sheet .qk { font-style: italic; color: var(--muted); }
  .sheet .sh { font: 800 14px var(--font-body); color: var(--muted); }
  .sheet .note { background: #fff7dc; border-radius: 14px; padding: 8px 12px; font-size: 15px; }
  .sheet .btn { align-self: flex-start; }
  .sheet .close { position: absolute; right: 14px; bottom: 14px; }
  .sheet .pic.big { width: 220px; }
  .sheet .txt { padding-bottom: 50px; }
  @media (max-width: 700px) {
    .body { padding: 12px 12px 22px; gap: 12px; }
    /* the painting as a strip across the top, the count under it */
    .hero { flex-direction: column; min-height: 0; padding: 136px 14px 14px; background-color: #fff; background-size: auto 150px; background-repeat: no-repeat; background-position: 64% 0; }
    .hero::before { background: linear-gradient(180deg, transparent 0, transparent 104px, rgba(255, 255, 255, .96) 140px); }
    .score { width: 100%; }
    .score .big b { font-size: 52px; }
    .score p { font-size: 14px; }
    .next { width: 100%; margin: 0; }
    .jumps { flex-wrap: nowrap; overflow-x: auto; margin: 0 -12px; padding: 2px 12px 6px; }
    .jumps button { flex: none; font-size: 15px; }
    .gh h2 { font-size: 23px; } .gh img { width: 38px; height: 48px; }
    .gh p { font-size: 14px; }
    .cards { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 9px; }
    .parts.many { gap: 10px; } .parts.many .pt { padding: 8px; flex-basis: 100%; }
    .cd { padding: 5px 5px 8px; border-radius: 16px; gap: 3px; }
    .pic { border-radius: 12px; }
    .pic .el { width: 20px; top: 4px; left: 4px; }
    .pic .tick { width: 22px; height: 22px; top: 4px; right: 4px; }
    .pic .way { font-size: 10px; padding: 2px 6px; bottom: 5px; }
    .nm { font-size: 13px; }
    .ln { font-size: 11px; }
    .ln .long { display: none; } .ln .short { display: inline; }
    .sheet { grid-template-columns: 1fr; justify-items: center; padding: 14px; }
    .sheet .pic.big { width: min(200px, 60vw); }
    .sheet .txt { width: 100%; }
    .sheet h2 { font-size: 26px; }
  }
</style>
