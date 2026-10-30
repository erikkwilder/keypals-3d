<script lang="ts">
  // The Shop's Island and Care sections (Wear is the try-on page, screens/Closet.svelte): the things on
  // the left of the screen big, with what it is, how many you have and Buy; the shelves and the things on
  // the right. Island things go into the island's storage, to put out on My Sky Island (its build tray sells
  // the very same things at the very same prices); special paints are for its blocks. Care has the eggs and
  // the treats. Every purchase goes in "What I earned" (as shells spent, with what they bought).
  import { onDestroy, onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { advView, teamOf } from '../adventure/state';
  import { GLIMMER } from '../adventure/glimmers';
  import { GROUP_NAME, buyShop, groupsOf, haveOf, many, onIslandOf, paintColour, sectionOf, type Group, type Section, type ShopEntry } from './shop';
  import { shopThumbs } from '../three/islandThumbs';
  import Confetti from '../ui/Confetti.svelte';
  import Icon from '../ui/Icon.svelte';

  let { section }: { section: Exclude<Section, 'wear'> } = $props();
  const base = import.meta.env.BASE_URL;
  const p = $derived(game.profile!);
  const shells = $derived(advView(p).shells);
  const fmt = (n: number) => n.toLocaleString('en-US');
  const all = $derived(sectionOf(section));
  const groups = $derived(groupsOf(section));
  let group = $state<Group | 'all'>('all');
  const list = $derived(all.filter(e => group === 'all' || e.group === group));
  let sel = $state<ShopEntry | null>(null);
  let burst = $state(0);
  let thumbs = $state<Record<string, string>>({});
  let alive = true;
  const firstGlimmer = $derived(teamOf(advView(p))[0]?.id ?? null);

  // (a new section: nothing picked, every shelf)
  let was: Section | null = null;
  $effect(() => { const s = section; if (s !== was) { was = s; sel = null; group = 'all'; drawPics(); } });
  function drawPics() {
    const ids = sectionOf(section).map(e => e.thumb).filter((x): x is string => !!x);
    if (ids.length) void shopThumbs(ids, (id, url) => { thumbs[id] = url; }, () => alive);
  }
  onMount(() => { alive = true; });
  onDestroy(() => { alive = false; });

  const picOf = (e: ShopEntry) => (e.pic ? `${base}${e.pic}` : e.thumb ? thumbs[e.thumb] ?? null : null);
  function pick(e: ShopEntry) { sel = e; sfx.pop(); }
  function setGroup(g: Group | 'all') { group = g; sfx.click(); }

  /** what it says under the thing: what you have of it */
  function haveLine(e: ShopEntry): string {
    const n = haveOf(p, e.key);
    if (e.group === 'paint') return n ? 'Yours! Build with them in Blocks on My Sky Island.' : 'Once you have them, they are yours for every block you build.';
    if (e.section === 'island') {
      if (!n) return 'What you buy waits in your storage on My Sky Island.';
      const on = onIslandOf(p, e.key);
      return `You have ${n}: ${on} on your island, ${n - on} in storage.`;
    }
    if (e.id === 'island-treats') return `You have ${n} ${n === 1 ? 'treat' : 'treats'} for your Glimmers.`;
    if (e.id === 'treat') return firstGlimmer ? `For ${GLIMMER[firstGlimmer].name}, the first Glimmer on your team.` : 'Meet a Glimmer in Adventure first.';
    return 'It goes in your nest, and hatches as you practise.';
  }
  const owned = (e: ShopEntry) => !many(e) && haveOf(p, e.key) > 0;
  const blocked = (e: ShopEntry) => e.id === 'treat' && !firstGlimmer;

  function buy(e: ShopEntry) {
    let r: ReturnType<typeof buyShop> = { ok: false };
    game.update(pp => { r = buyShop(pp, e.key); }, { bought: [e.key] });
    const res = r as ReturnType<typeof buyShop>;
    if (!res.ok) { sfx.nope(); game.say(res.why ?? 'Not now.'); return; }
    sfx.buy(); burst++;
    if (e.group === 'paint') game.say(`${e.name} are yours! Build with them on My Sky Island.`, 3600);
    else if (e.section === 'island') game.say(`The ${e.name} is in your storage. Put it on My Sky Island!`, 3600);
    else if (e.id === 'island-treats') game.say('Three treats! Give them to your Glimmers on My Sky Island.', 3600);
    else if (e.id === 'treat') game.say(`${firstGlimmer ? GLIMMER[firstGlimmer].name : 'Your Glimmer'} grew a level!`, 3600);
    else game.say(`Your new egg is ${res.where === 'nest' ? 'waiting in the nest' : 'in the incubator: practise to hatch it'}.`, 3600);
  }
  /** to the island (back to it, when that's where the Shop was opened from), the thing ready to put out */
  function toIsland(e: ShopEntry | null) {
    sfx.click();
    game.islandPlace = e && e.section === 'island' && e.group !== 'paint' ? e.id : null;
    if (game.backTo()?.screen === 'island') game.back(); else game.visit('island');
  }
  function toEggs() { sfx.click(); if (game.backTo()?.screen === 'eggs') game.back(); else game.visit('eggs'); }
</script>

<div class="shelf" class:care={section === 'care'}>
  <Confetti {burst} count={40} x={28} y={45} />
  <div class="look card" class:on={!!sel}>
    {#if sel}
      {@const e = sel}
      {@const pic = picOf(e)}
      {@const n = haveOf(p, e.key)}
      <div class="lpic" class:dream={e.dream}>
        {#if e.group === 'paint'}<span class="swatch" style:--pc="#{(paintColour(e) ?? 0xffffff).toString(16).padStart(6, '0')}"></span>{/if}
        {#if pic}<img src={pic} alt="" />{:else}<i class="wait"></i>{/if}
      </div>
      <div class="ltext">
        <small>{GROUP_NAME[e.group]}{e.dream ? ' · worth saving up for' : ''}</small>
        <h3>{e.name}</h3>
        <p class="blurb">{e.blurb}</p>
        <p class="have" class:yes={n > 0}>{#if n > 0}<Icon name="check" size={15} />{/if}{haveLine(e)}</p>
      </div>
      <div class="lact">
        {#if owned(e)}
          <em class="yours"><Icon name="check" size={16} /> Yours</em>
        {:else}
          <button class="btn btn-primary buy" disabled={shells < (e.price ?? 0) || blocked(e)} onclick={() => buy(e)}>
            <img src="{base}game/icon-shell.webp" alt="" />{shells < (e.price ?? 0) ? `${fmt((e.price ?? 0) - shells)} more shells` : `Buy: ${fmt(e.price ?? 0)}`}
          </button>
        {/if}
        {#if section === 'island' && n > 0}
          <button class="btn" onclick={() => toIsland(e)}><img src="{base}island/tile.webp" alt="" />{e.group === 'paint' ? 'Build on my island' : 'Put it on my island'}</button>
        {:else if e.group === 'eggs'}
          <button class="btn" onclick={toEggs}><img src="{base}game/egg-common.webp" alt="" />See my eggs</button>
        {/if}
        <button class="x" onclick={() => { sel = null; sfx.pop(); }} aria-label="Close"><Icon name="close" size={18} /></button>
      </div>
    {:else}
      <div class="intro">
        <img src="{base}{section === 'island' ? 'island/card.webp' : 'game/egg-rare.webp'}" alt="" />
        <p>{section === 'island' ? 'Things for My Sky Island. Tap one to see it. What you buy waits in your storage until you put it on your island.' : 'Eggs hatch into new Glimmers as you practise. Treats make your Glimmers happy.'}</p>
        {#if section === 'island'}<button class="btn" onclick={() => toIsland(null)}><img src="{base}island/tile.webp" alt="" />Go to My Sky Island</button>{/if}
      </div>
    {/if}
  </div>

  <div class="side">
    {#if groups.length > 2}
      <div class="chips" role="tablist" aria-label="Shelves">
        <button role="tab" aria-selected={group === 'all'} class:on={group === 'all'} onclick={() => setGroup('all')}>Everything</button>
        {#each groups as g (g)}<button role="tab" aria-selected={group === g} class:on={group === g} onclick={() => setGroup(g)}>{GROUP_NAME[g]}</button>{/each}
      </div>
    {/if}
    <div class="sgrid scroll">
      {#each list as e (e.key)}
        {@const pic = picOf(e)}
        {@const n = haveOf(p, e.key)}
        <button class="it" class:sel={sel?.key === e.key} class:dream={e.dream} class:short={!owned(e) && shells < (e.price ?? 0)} onclick={() => pick(e)}>
          {#if n > 0 && many(e)}<span class="hasn" title="You have {n}">{n}</span>{/if}
          <span class="pic">
            {#if e.group === 'paint'}<span class="swatch" style:--pc="#{(paintColour(e) ?? 0xffffff).toString(16).padStart(6, '0')}"></span>{/if}
            {#if pic}<img src={pic} alt="" loading="lazy" />{:else}<i class="wait"></i>{/if}
          </span>
          <b>{e.name}</b>
          {#if owned(e)}<em class="yours"><Icon name="check" size={13} /> Yours</em>
          {:else}<em class="price"><img src="{base}game/icon-shell.webp" alt="" />{fmt(e.price ?? 0)}</em>{/if}
        </button>
      {/each}
    </div>
    <p class="foot">Shells come from practice and battles. Nothing here costs real money.</p>
  </div>
</div>

<style>
  .shelf { position: relative; flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, .8fr) minmax(400px, 1.2fr); gap: 18px; padding: 10px 20px 14px; }
  .look { align-self: start; display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 18px 18px 16px; text-align: center; }
  .lpic { position: relative; width: min(260px, 70%); aspect-ratio: 1; display: flex; align-items: center; justify-content: center; border-radius: 28px; background: radial-gradient(circle at 50% 42%, #fff, #f3eefb 70%); box-shadow: inset 0 0 0 3px #ece5f8; }
  .lpic.dream { box-shadow: inset 0 0 0 3px #ffd36b, 0 0 24px rgba(255, 200, 80, .35); }
  .lpic img { max-width: 88%; max-height: 88%; object-fit: contain; filter: drop-shadow(0 10px 12px rgba(40, 20, 80, .2)); }
  .ltext { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .ltext small { font: 800 12px var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
  .ltext h3 { margin: 0; font: 600 28px/1.1 var(--font-ui); color: var(--ink); }
  .blurb { margin: 0; font: 600 16px/1.35 var(--font-body); color: var(--ink2); }
  .have { margin: 2px 0 0; display: inline-flex; align-items: center; gap: 5px; font: 700 14px/1.3 var(--font-body); color: var(--muted); }
  .have.yes { color: #1f8f55; }
  .lact { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 8px; }
  .lact .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; font-size: 17px; }
  .lact .btn img { width: 24px; height: 24px; object-fit: contain; }
  .buy img { width: 22px !important; height: 22px !important; }
  .yours { display: inline-flex; align-items: center; gap: 4px; font: 800 14px var(--font-body); font-style: normal; color: #fff; background: #2fbf73; padding: 5px 14px; border-radius: 999px; }
  .x { border: 0; background: #f2eef8; width: 36px; height: 36px; border-radius: 50%; display: none; place-items: center; cursor: pointer; flex: none; }
  .intro { display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .intro img { width: min(220px, 60%); aspect-ratio: 1; object-fit: contain; }
  .intro p { margin: 0; font: 600 17px/1.4 var(--font-body); color: var(--ink2); max-width: 34ch; }
  .intro .btn { display: inline-flex; align-items: center; gap: 6px; font-size: 16px; padding: 7px 16px; }
  .intro .btn img { width: 26px; height: 26px; aspect-ratio: auto; }
  .side { min-height: 0; min-width: 0; display: flex; flex-direction: column; gap: 10px; }
  .chips { display: flex; gap: 6px; flex-wrap: wrap; flex: none; }
  .chips button { border: 0; cursor: pointer; font: 700 14px var(--font-body); color: var(--ink2); background: rgba(255, 255, 255, .9); padding: 5px 12px; border-radius: 999px; box-shadow: inset 0 0 0 2px #e4ddf3; white-space: nowrap; }
  .chips button.on { background: var(--primary); color: #fff; box-shadow: none; }
  .sgrid { flex: 1; min-height: 0; overflow: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 10px; align-content: start; padding: 4px 2px 8px; }
  .care .sgrid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
  .it { position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 6px 8px; border-radius: 20px; border: 3px solid #fff; background: linear-gradient(180deg, #fff, #faf7ff); cursor: pointer; box-shadow: 0 0 0 2px #e4ddf3, var(--shadow-sm); font: inherit; text-align: center; transition: transform .15s; }
  .it:hover { transform: translateY(-3px); }
  .it.sel { box-shadow: 0 0 0 4px var(--primary-hi), 0 0 18px rgba(124, 92, 245, .35); }
  .it.dream { background: linear-gradient(180deg, #fffdf3, #fff4d6); box-shadow: 0 0 0 2px #ffd36b, var(--shadow-sm); }
  .it.dream.sel { box-shadow: 0 0 0 4px var(--primary-hi), 0 0 18px rgba(124, 92, 245, .35); }
  .it.short .pic img { opacity: .6; }
  .pic { position: relative; width: 84px; height: 84px; display: flex; align-items: center; justify-content: center; flex: none; }
  .pic img { max-width: 100%; max-height: 100%; object-fit: contain; filter: drop-shadow(0 6px 8px rgba(40, 20, 80, .2)); }
  .swatch { position: absolute; right: 2px; bottom: 4px; width: 22px; height: 22px; border-radius: 50%; background: var(--pc); box-shadow: 0 0 0 2px #fff, 0 2px 6px rgba(0, 0, 0, .25); z-index: 1; }
  .lpic .swatch { width: 34px; height: 34px; right: 12px; bottom: 12px; }
  .wait { width: 56%; height: 56%; border-radius: 50%; background: #efe9f8; animation: pulse 1.2s ease-in-out infinite; }
  @keyframes pulse { 50% { opacity: .45; } }
  .it b { font: 600 15px/1.1 var(--font-ui); color: var(--ink); }
  .it em { margin-top: 4px; font: 800 12px var(--font-body); font-style: normal; padding: 3px 10px; border-radius: 999px; display: inline-flex; align-items: center; gap: 4px; }
  .price { background: #fff3d6; color: #7a5300; }
  .price img { width: 16px; height: 16px; object-fit: contain; }
  .it .yours { font-size: 12px; padding: 3px 10px; }
  .hasn { position: absolute; top: 6px; right: 6px; min-width: 24px; height: 24px; padding: 0 6px; border-radius: 999px; display: grid; place-items: center; font: 800 12px var(--font-body); color: #fff; background: #2fbf73; box-shadow: 0 0 0 2px #fff; }
  /* (on its own chip: readable over the 3D scene) */
  .foot { margin: 0; align-self: center; flex: none; font: 600 13px/1.3 var(--font-body); color: var(--ink2); text-align: center; background: rgba(255, 255, 255, .94); padding: 4px 14px; border-radius: 999px; box-shadow: var(--shadow-sm); }
  @media (max-height: 820px) and (min-width: 761px) {
    .lpic { width: min(200px, 60%); }
    .ltext h3 { font-size: 24px; }
    .blurb { font-size: 15px; }
    .pic { width: 66px; height: 66px; }
    .sgrid { gap: 8px; grid-template-columns: repeat(auto-fill, minmax(108px, 1fr)); }
    .foot { display: none; }
  }
  @media (max-width: 1100px) and (min-width: 761px) { .shelf { grid-template-columns: minmax(0, .8fr) minmax(360px, 1.2fr); } }
  /* phones: the things fill the screen; a thing tapped opens its card along the bottom */
  @media (max-width: 760px) {
    .shelf { grid-template-columns: minmax(0, 1fr); padding: 6px 10px 10px; gap: 8px; overflow-y: auto; }
    .look { display: none; }
    .look.on { display: grid; position: fixed; left: 8px; right: 8px; bottom: 8px; z-index: 20; grid-template-columns: 72px 1fr; gap: 4px 12px; align-items: center; text-align: left; padding: 10px 12px; box-shadow: 0 0 0 3px var(--primary-hi), var(--shadow); }
    .look.on .lpic { width: 72px; grid-row: span 2; border-radius: 18px; }
    .look.on .lpic .swatch { width: 20px; height: 20px; right: 4px; bottom: 4px; }
    .look.on .ltext { align-items: flex-start; gap: 1px; }
    .look.on .ltext h3 { font-size: 19px; }
    .look.on .blurb { font-size: 13px; }
    .look.on .have { font-size: 12px; }
    .look.on .ltext small { font-size: 10px; }
    .lact { grid-column: 1 / -1; justify-content: flex-end; }
    .lact .btn { font-size: 15px; padding: 6px 12px; }
    .x { display: grid; }
    .side { overflow: visible; padding-bottom: 170px; }
    .sgrid { flex: none; overflow: visible; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
    .care .sgrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .pic { width: 60px; height: 60px; }
    .it b { font-size: 13px; }
    .chips button { font-size: 13px; padding: 4px 10px; }
  }
</style>
