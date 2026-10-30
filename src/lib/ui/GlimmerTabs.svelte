<script lang="ts">
  // Glimmers is one collection seen two ways, picked with two big picture buttons under the top bar (so
  // even a six-year-old sees there are two): My Glimmers (the ones you have, and the team of two that
  // comes into battles) and All 100 (the Glimmer Book: every Glimmer and how each one comes), each with
  // its count. Switching isn't a step: Back leaves Glimmers.
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { advView, owns } from '../adventure/state';
  import { GLIMMER_TOTAL, type GlimmerId } from '../adventure/glimmers';

  const base = import.meta.env.BASE_URL;
  const p = $derived(game.profile!);
  const a = $derived(advView(p));
  const met = $derived(Object.keys(a.glimmers).length);
  const team = $derived(a.team.filter((t): t is GlimmerId => !!t && owns(a, t)));
  // the team first, then the newest ones met
  const faces = $derived([...team, ...(Object.keys(a.glimmers) as GlimmerId[]).filter(id => !team.includes(id)).reverse()].slice(0, 3));
  const face = (id: GlimmerId) => `${base}game/glimmers/face/${id}${a.glimmers[id]?.evolved ? '-evo' : ''}.webp`;
  const tab = $derived(game.glimmerTab === 'all' ? 'all' : 'team');
  function pick(t: 'team' | 'all') { if (t === tab) return; sfx.click(); game.glimmerTab = t; }
</script>

<div class="gsw" role="tablist" aria-label="Glimmers">
  <button role="tab" class="t" class:on={tab === 'team'} aria-selected={tab === 'team'} onclick={() => pick('team')}>
    <span class="art faces">
      {#each faces as id, i (id)}<img src={face(id)} alt="" style:--i={i} />{:else}<img class="egg" src="{base}game/egg-common.webp" alt="" />{/each}
    </span>
    <span class="tx"><b>My Glimmers</b><small><span class="long">{met} found · {team.length} on my team</span><span class="short">{met} found</span></small></span>
    {#if tab !== 'team'}<img class="go" src="{base}icons/right.webp" alt="" />{/if}
  </button>
  <button role="tab" class="t all" class:on={tab === 'all'} aria-selected={tab === 'all'} onclick={() => pick('all')}>
    <span class="art book" style:background-image="url({base}game/book-hero.webp)"></span>
    <span class="tx"><b>All {GLIMMER_TOTAL} Glimmers</b><small><span class="long">{met} met · {Math.max(0, GLIMMER_TOTAL - met)} still to find</span><span class="short">{met} of {GLIMMER_TOTAL} met</span></small></span>
    {#if tab !== 'all'}<img class="go" src="{base}icons/right.webp" alt="" />{/if}
  </button>
</div>

<style>
  .gsw { flex: none; position: relative; z-index: 4; display: flex; justify-content: center; gap: 12px; padding: 8px 16px; background: rgba(255, 255, 255, .78); border-bottom: 1px solid #f0ebf8; }
  .t { flex: 1 1 0; max-width: 440px; min-width: 0; display: flex; align-items: center; gap: 12px; padding: 5px 14px 5px 5px; border-radius: 22px; border: 3px solid #e6def5; background: #fff; cursor: pointer; text-align: left; box-shadow: 0 4px 0 #e6def5; transition: transform .14s; }
  .t:hover { transform: translateY(-2px); }
  .t.on { border-color: var(--primary); background: #f4efff; box-shadow: 0 4px 0 var(--primary-edge); cursor: default; }
  .t.on:hover { transform: none; }
  .art { flex: none; position: relative; width: 86px; height: 54px; border-radius: 16px; overflow: hidden; background: linear-gradient(135deg, #eaf6ff, #f6edff); }
  .faces img { position: absolute; top: 5px; left: calc(4px + var(--i) * 26px); width: 44px; height: 44px; border-radius: 50%; object-fit: cover; background: #fff; box-shadow: 0 0 0 2px #fff, 0 3px 6px -2px rgba(40, 20, 80, .4); }
  .faces img.egg { left: 21px; width: 44px; border-radius: 0; object-fit: contain; background: none; box-shadow: none; }
  .book { background-size: cover; background-position: 62% 55%; }
  .tx { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .tx b { font: 600 22px/1.1 var(--font-ui); color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tx small { font: 700 14px/1.25 var(--font-body); color: var(--ink2); }
  .on .tx b { color: #4b2bb8; }
  .go { flex: none; width: 30px; height: 30px; object-fit: contain; }
  .short { display: none; }
  @media (max-height: 760px) and (min-width: 600px) {
    .gsw { padding: 6px 16px; }
    .art { height: 46px; } .faces img { width: 38px; height: 38px; top: 4px; left: calc(4px + var(--i) * 24px); }
    .tx b { font-size: 20px; }
  }
  @media (max-width: 600px) {
    .gsw { gap: 8px; padding: 6px 8px; }
    .t { gap: 6px; padding: 4px 8px 4px 4px; border-radius: 18px; }
    .art { width: 50px; height: 44px; border-radius: 12px; }
    .faces img { width: 34px; height: 34px; top: 5px; left: calc(2px + var(--i) * 8px); }
    .faces img.egg { left: 8px; }
    .tx b { font-size: 16px; white-space: normal; }
    .tx small { font-size: 12px; }
    .go { display: none; }
    .long { display: none; } .short { display: inline; }
  }
</style>
