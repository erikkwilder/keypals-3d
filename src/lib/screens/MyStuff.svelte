<script lang="ts">
  // My stuff: everything that's yours, as one grid of sections with live counts. Each section is its own
  // page (← My stuff | Dances): Keypals (your buddies, friendship, who plays), Wardrobe, Shop, Dances, the
  // Sticker book (stickers and medals), Glimmers (My team and All 100), Eggs, the Fact Garden and My
  // progress. Opened from the top bar's chest on every screen; Back goes where it was opened from.
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { bookView, palOf, totalStars } from '../engine/profile';
  import { STICKERS, levelFromXp } from '../engine/stickers';
  import { MEDALS } from '../engine/achievements';
  import { DANCES, forBuddy } from '../engine/rewards';
  import { teamBuddies } from '../engine/team';
  import { GLIMMER_TOTAL } from '../adventure/glimmers';
  import { advView, teamOf } from '../adventure/state';
  import { CATALOG, ownsItem } from '../adventure/wardrobe';
  import { mathOf, mathStarsTotal, stageCounts, ALL_GARDEN_IDS } from '../math/progress';
  import { FRIEND } from '../art/cast';
  import Header from '../ui/Header.svelte';
  import { STUFF_GO } from '../nav';

  const base = import.meta.env.BASE_URL;
  const p = $derived(game.profile!);
  const a = $derived(advView(p));
  const m = $derived(mathOf(p));
  const lvl = $derived(levelFromXp(palOf(p).xp));
  const book = $derived(bookView(p));
  const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

  // ---------- what you've collected ----------
  const buddies = $derived(teamBuddies(p).length);
  const owned = $derived(CATALOG.filter(c => ownsItem(p, c.id)).length);
  const dances = $derived(forBuddy(DANCES, p.buddy).filter(d => d.level <= lvl.level).length);
  const stickers = $derived(STICKERS.filter(s => book.stickers[s.id]).length);
  const medals = $derived(MEDALS.filter(md => (book.medals[md.id] ?? 0) > 0).length);
  const found = $derived(Object.keys(a.glimmers).length);
  const team = $derived(teamOf(a));
  const eggsReady = $derived(a.incubator.filter(e => e && e.have >= e.need).length);
  const eggsAll = $derived(a.incubator.filter(e => e).length + a.nest.length);
  const blooms = $derived(stageCounts(m, ALL_GARDEN_IDS)[3]);
  const growing = $derived.by(() => { const c = stageCounts(m, ALL_GARDEN_IDS); return c[1] + c[2]; });

  // each section's own picture (public/game/cards/), plus a live badge where it tells you something: your
  // team's faces on Glimmers, and the egg you're warming on Eggs (it bounces when it's ready to hatch)
  type Tile = { id: string; name: string; count: string; line: string; pic: string; badge?: string; tone: string; hot?: boolean; go: () => void };
  const warming = $derived(a.incubator.find(e => e));
  const tiles = $derived<Tile[]>([
    { id: 'keypals', name: 'Keypals', count: `${buddies}`, line: `${buddies === 1 ? 'buddy' : 'buddies'} · Friendship ${lvl.level} with ${FRIEND[p.buddy].name}`, pic: 'keypals', tone: '#e2468f', go: STUFF_GO.keypals },
    { id: 'closet', name: 'Wardrobe', count: `${owned}`, line: 'things to wear', pic: 'wardrobe', tone: '#c2417f', go: STUFF_GO.closet },
    { id: 'shop', name: 'Shop', count: fmt(a.shells), line: 'shells to spend', pic: 'shop', tone: '#2e9e6e', go: STUFF_GO.shop },
    { id: 'dances', name: 'Dances', count: `${dances}`, line: `open for ${FRIEND[p.buddy].name}`, pic: 'dances', tone: '#7c5cf5', go: STUFF_GO.dances },
    { id: 'stickers', name: 'Sticker book', count: `${stickers}`, line: `stickers · ${medals} kinds of medal`, pic: 'stickers', tone: '#e6a817', go: STUFF_GO.stickers },
    { id: 'glimmers', name: 'Glimmers', count: `${found}`, line: `of ${GLIMMER_TOTAL} met${team.length ? ` · ${team.length} on your team` : ''}`, pic: 'glimmers', tone: '#2e9e6e', go: STUFF_GO.glimmers },
    { id: 'eggs', name: 'Eggs', count: `${eggsAll}`, line: eggsReady ? `${eggsReady} ready to hatch!` : eggsAll ? 'warming up' : 'practice hatches eggs', pic: 'eggs', badge: warming ? `game/egg-${warming.rarity}.webp` : undefined, tone: '#b4561a', hot: eggsReady > 0, go: STUFF_GO.eggs },
    { id: 'garden', name: 'Fact Garden', count: `${blooms}`, line: `in bloom · ${growing} growing`, pic: 'garden', tone: '#1f7a50', go: STUFF_GO.garden },
    { id: 'progress', name: 'My progress', count: fmt(totalStars(p) + mathStarsTotal(m)), line: "stars, what's going well, and what you earned", pic: 'progress', tone: '#5b3fd0', go: STUFF_GO.progress },
  ]);
  function go(f: () => void) { sfx.click(); f(); }
</script>

<div class="screen stuff">
  <Header />
  <div class="body scroll">
    <div class="tiles">
      {#each tiles as t (t.id)}
        <div class="tile" class:hot={t.hot} style:--tc={t.tone}>
          <button class="main" onclick={() => go(t.go)}>
            <span class="art" style:background-image="url({base}game/cards/{t.pic}.webp)">
              {#if t.id === 'glimmers' && team.length}<span class="faces">{#each team.map(g => `${g.id}${g.evolved ? '-evo' : ''}`) as f (f)}<img src="{base}game/glimmers/face/{f}.webp" alt="" />{/each}</span>
              {:else if t.badge}<span class="badge"><img src="{base}{t.badge}" alt="" /></span>{/if}
            </span>
            <span class="txt">
              <b>{t.name}</b>
              <span class="cnt">{#if t.count}<em>{t.count}</em>{/if}<small>{t.line}</small></span>
            </span>
          </button>
        </div>
      {/each}
    </div>

      </div>
</div>

<style>
  .stuff { display: flex; flex-direction: column; background: linear-gradient(#f3f9ff, #fbf8ff 40%); }
  .body { flex: 1; min-height: 0; padding: 18px 24px 50px; display: flex; flex-direction: column; gap: 18px; }
  .me { display: flex; align-items: center; gap: 14px; }
  .me h2 { margin: 0; font-size: 26px; }
  .me span { display: inline-flex; align-items: center; gap: 5px; font: 700 15px var(--font-body); color: var(--ink2); }
  .me span img { width: 22px; height: 22px; object-fit: contain; }
  .jump { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; }
  .jump img { width: 30px; height: 30px; object-fit: contain; }

  .tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
  .tile { --tc: #7c5cf5; position: relative; display: flex; flex-direction: column; border-radius: 26px; background: #fff; overflow: hidden; border: 0; padding: 0; cursor: pointer; text-align: left; font: inherit;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--tc) 22%, #fff), 0 6px 0 color-mix(in srgb, var(--tc) 28%, #fff), 0 18px 30px -18px rgba(40, 20, 80, .45); transition: transform .14s; }
  .tile:hover { transform: translateY(-3px); }
  .main { display: flex; flex-direction: column; border: 0; padding: 0; background: none; cursor: pointer; text-align: left; font: inherit; flex: 1; }
  /* the section's picture fills the top of the tile (the tone shows only while it loads); it keeps the
     pictures' own wide shape, so a big screen's wider tiles get taller pictures instead of cropped ones */
  .art { position: relative; display: block; aspect-ratio: 3.4; min-height: 120px; max-height: 200px; background: color-mix(in srgb, var(--tc) 16%, #fff) center / cover no-repeat; }
  .badge { position: absolute; left: 12px; bottom: 10px; display: grid; place-items: center; width: 62px; height: 62px; border-radius: 50%; background: #fff; box-shadow: 0 0 0 3px #fff, 0 4px 10px rgba(40, 20, 80, .35); transition: transform .2s; }
  .badge img { width: 78%; height: 78%; object-fit: contain; }
  .tile:hover .badge { transform: scale(1.06) rotate(-4deg); }
  .faces { position: absolute; left: 12px; bottom: 10px; display: flex; }
  .faces img { width: 62px; height: 62px; border-radius: 50%; object-fit: cover; object-position: center 35%; box-shadow: 0 0 0 3px #fff, 0 4px 10px rgba(40, 20, 80, .35); }
  .faces img + img { margin-left: -16px; }
  .txt { display: flex; flex-direction: column; gap: 2px; padding: 10px 14px 14px; }
  .txt b { font: 600 22px/1.1 var(--font-ui); color: var(--ink); }
  .cnt { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
  .cnt em { font: 600 26px/1 var(--font-ui); font-style: normal; color: var(--tc); }
  .cnt small { font: 700 14px/1.3 var(--font-body); color: var(--muted); }
  .extra { position: absolute; right: 12px; top: 12px; border: 0; cursor: pointer; padding: 6px 14px; border-radius: 999px; background: #fff; color: var(--tc); font: 600 15px var(--font-ui); box-shadow: 0 3px 0 color-mix(in srgb, var(--tc) 35%, #fff), 0 6px 14px -6px rgba(40, 20, 80, .45); }
  .extra:hover { transform: translateY(-1px); }
  .tile.hot .badge { animation: hot 1.4s ease-in-out infinite; }
  @keyframes hot { 50% { transform: scale(1.08) rotate(-4deg); } }

  .progress { scroll-margin-top: 10px; }
  .progress > h2 { margin: 6px 0 12px; font-size: 26px; }
  .subjects { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
  .subj { --sc: #7c5cf5; display: flex; flex-direction: column; gap: 8px; padding: 14px 16px 16px; border-radius: 24px; background: #fff; box-shadow: 0 0 0 3px color-mix(in srgb, var(--sc) 20%, #fff), 0 14px 26px -18px rgba(40, 20, 80, .45); }
  .subj header { display: flex; align-items: center; gap: 8px; }
  .subj header > img { width: 40px; height: 40px; object-fit: contain; }
  .subj h3 { margin: 0; font-size: 24px; color: color-mix(in srgb, var(--sc) 80%, #000); }
  .st { margin-left: auto; display: inline-flex; align-items: center; gap: 4px; font: 600 20px var(--font-ui); color: var(--ink); background: #fff8e6; padding: 2px 12px 2px 6px; border-radius: 999px; }
  .st img { width: 24px; height: 24px; }
  .words { margin: 0; font: 600 17px/1.35 var(--font-ui); color: var(--ink); }
  .bar { height: 10px; border-radius: 999px; background: #f1ecfb; overflow: hidden; }
  .bar i { display: block; height: 100%; border-radius: 999px; background: var(--sc); }
  .subj ul { margin: 0; padding: 0 0 0 18px; display: flex; flex-direction: column; gap: 3px; font: 600 14.5px/1.35 var(--font-body); color: var(--ink2); }
  .subj b { color: var(--ink); }
  .subj .btn { align-self: flex-start; margin-top: auto; }
  .days { display: flex; align-items: flex-end; gap: 6px; height: 96px; }
  .dcol { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 4px; }
  .dcol .b { width: 100%; border-radius: 8px 8px 4px 4px; background: var(--lilac); }
  .dcol .b.goal { background: var(--mint); }
  .dcol small { font: 700 12px var(--font-body); color: var(--muted); }
  .dcol.today small { color: var(--primary); }
  .note { margin: 0; font: 700 12.5px var(--font-body); color: var(--muted); }

  @media (max-width: 1100px) { .tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); } .subjects { grid-template-columns: 1fr 1fr; } .subj.week { grid-column: 1 / -1; } }
  /* short laptop screens: shorter pictures, so more fits before it scrolls */
  @media (max-height: 800px) and (min-width: 760px) { .art { aspect-ratio: auto; min-height: 0; height: 104px; } .badge, .faces img { width: 52px; height: 52px; } .tiles { gap: 12px; } }
  @media (max-width: 760px) {
    .body { padding: 12px 12px 40px; gap: 14px; }
    .me h2 { font-size: 20px; }
    .me :global(.critter-host) { width: 56px !important; height: 56px !important; }
    .jump { display: none; }
    .tiles { gap: 10px; }
    .art { aspect-ratio: auto; min-height: 0; height: 92px; }
    .badge { width: 38px; height: 38px; left: 6px; bottom: 6px; }
    .faces { left: 6px; bottom: 6px; }
    .faces img { width: 38px; height: 38px; }
    .faces img + img { margin-left: -10px; }
    .txt { padding: 8px 10px 10px; }
    .txt b { font-size: 17px; }
    .cnt em { font-size: 21px; }
    .cnt small { font-size: 12px; }
    .extra { right: 8px; top: 8px; padding: 4px 10px; font-size: 13px; }
    .subjects { grid-template-columns: 1fr; }
  }
</style>
