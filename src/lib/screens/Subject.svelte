<script lang="ts">
  // A subject's page (Math, Typing): the one top bar (← Home | Math); your next step on this subject's
  // path with one Continue; the topics as one grid of picture tiles (math grouped by grade band, typing's
  // islands in order, a locked one says what opens it); and one small row: the Fact Garden and every
  // Learn lesson (My path is on the next-step card). A topic opens its own page (screens/Topic.svelte) with its four ways.
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { SUBJECT } from '../subjects';
  import { openWay, topicGroups } from '../nav';
  import Bar from '../ui/Bar.svelte';
  import TodayCard from '../path/TodayCard.svelte';
  import Icon from '../ui/Icon.svelte';

  const base = import.meta.env.BASE_URL;
  const p = $derived(game.profile!);
  const sid = $derived(SUBJECT[game.subject] ? game.subject : 'math');
  const S = $derived(SUBJECT[sid]);
  const groups = $derived(topicGroups(sid, p));
  let sw = $state(1280);
  // (My path sits on the next-step card, so the More row doesn't repeat it)
  const more = $derived([
    ...(sid === 'math' ? [{ id: 'garden', name: 'Review garden', icon: 'icons/garden.webp', go: () => game.visit('garden') }] : []),
    { id: 'learn', name: sid === 'typing' ? 'All new-key lessons' : 'All Learn lessons', icon: 'icons/book.webp', go: () => openWay(sid, null, 'learn') },
  ]);
</script>

<div class="screen subjectpage" bind:clientWidth={sw} style:--tone={S.color}>
  <Bar />
  <div class="body scroll">
    <TodayCard subject={sid} step compact={sw < 600} />

    {#each groups as g (g.name)}
      <section class="grp">
        {#if g.name}<h2>{g.name}</h2>{:else}<h2>{sid === 'typing' ? 'The islands, in order' : 'Topics'}</h2>{/if}
        <div class="topics">
          {#each g.tiles as t (t.id)}
            <button class="topic" class:locked={!!t.locked} style:--tc={t.color} onclick={t.go}>
              <span class="pic" style:background-image="url({base}{t.art})">{#if t.locked}<span class="lk"><Icon name="lock" size={30} /></span>{/if}</span>
              <span class="tx">
                <b>{t.name}</b>
                <small>{t.line}</small>
                {#if t.of && !t.locked}<i class="bar2"><em style:width="{(t.done / t.of) * 100}%"></em></i>{/if}
              </span>
            </button>
          {/each}
        </div>
      </section>
    {/each}

    <nav class="more" aria-label="More">
      <span>More</span>
      {#each more as m (m.id)}
        <button class="mlink" onclick={() => { sfx.click(); m.go(); }}><img src="{base}{m.icon}" alt="" />{m.name}</button>
      {/each}
    </nav>
  </div>
</div>

<style>
  .subjectpage { display: flex; flex-direction: column; background: linear-gradient(#f4efff, #fbf9ff 40%, #f6fbff); }
  .body { flex: 1; min-height: 0; padding: 14px 24px 28px; display: flex; flex-direction: column; align-items: center; gap: 14px; }
  .body > * { width: min(1240px, 100%); }
  .grp { display: flex; flex-direction: column; gap: 8px; }
  .grp h2 { margin: 0; font: 600 19px var(--font-ui); color: var(--ink2); }
  .topics { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
  .topic { display: flex; flex-direction: column; border: 0; padding: 0; cursor: pointer; text-align: left; border-radius: 20px; overflow: hidden; background: #fff; box-shadow: 0 10px 24px -18px rgba(60, 40, 110, .6), 0 0 0 3px #fff; transition: transform .15s; }
  .topic:hover, .topic:focus-visible { transform: translateY(-3px); box-shadow: 0 14px 28px -18px rgba(60, 40, 110, .7), 0 0 0 3px var(--tc); }
  .pic { position: relative; height: 96px; background: #eef0f8 center / cover no-repeat; }
  .lk { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(255, 255, 255, .55); }
  .locked .pic { filter: grayscale(.7); }
  .tx { display: flex; flex-direction: column; gap: 3px; padding: 8px 12px 12px; }
  .tx b { font: 600 19px/1.15 var(--font-ui); color: var(--ink); }
  .tx small { font: 700 13px/1.25 var(--font-body); color: var(--muted); }
  .bar2 { display: block; height: 6px; border-radius: 999px; background: #f0ecf7; overflow: hidden; margin-top: 3px; }
  .bar2 em { display: block; height: 100%; background: var(--tc); border-radius: 999px; }
  .more { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding-top: 6px; border-top: 2px dashed #e8e1f4; }
  .more > span { font: 700 14px var(--font-body); color: var(--muted); margin-right: 4px; }
  .mlink { display: inline-flex; align-items: center; gap: 6px; border: 0; cursor: pointer; padding: 4px 14px 4px 5px; border-radius: 999px; background: #fff; box-shadow: inset 0 0 0 2px #e6def5; font: 600 16px var(--font-ui); color: var(--ink); }
  .mlink img { width: 30px; height: 30px; object-fit: contain; }
  .mlink:hover { box-shadow: inset 0 0 0 2px #c9b8ff; }
  @media (max-height: 760px) and (min-width: 600px) { .pic { height: 78px; } .body { gap: 10px; padding-top: 10px; } }
  @media (max-width: 600px) {
    .body { padding: 10px 12px 20px; gap: 10px; }
    .topics { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .pic { height: 70px; }
    .tx b { font-size: 16px; }
    .tx small { font-size: 12px; }
    .mlink { font-size: 14px; }
  }
</style>
