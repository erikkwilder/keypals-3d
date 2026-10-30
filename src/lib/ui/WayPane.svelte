<script lang="ts">
  // One way to play a subject (Learn, Games or Adventure; Practice is the subject's own map) as a page
  // of picture cards, grouped by part when "All" is picked. Learn cards play an episode (math) or a
  // lesson that brings new keys with the finger coach (typing); Games cards start the game; Adventure
  // cards open the Adventure map on that world. A way with nothing yet is one soft "Coming soon" card.
  import { game } from '../state/game.svelte';
  import { WAY, chipNames, thingsIn, type Subject, type Thing, type WayId } from '../subjects';
  import { openThing, statusOf } from '../nav';
  import { LESSON as TYPING_LESSON, lessonTitle } from '../engine/course';
  import { isUnlocked } from '../engine/profile';
  import { mathOf, nextMathLesson } from '../math/progress';
  import { checkDueId, nextToLearn } from '../math/learn';
  import { epLesson, isEpisode } from '../math/episodes';
  import { sfx } from '../audio/sound';
  import Icon from './Icon.svelte';

  type Props = { subject: Subject; way: WayId; chip: string };
  let { subject, way, chip }: Props = $props();
  const base = import.meta.env.BASE_URL;
  const p = $derived(game.profile!);
  const W = $derived(WAY[way]);
  const content = $derived(subject.ways[way]);
  const shown = $derived(thingsIn(subject, way, chip));
  const live = $derived(shown.filter(t => !t.soon));
  const soon = $derived(shown.filter(t => t.soon));
  // with "All": one group per part (things that go with several parts make their own group)
  const groups = $derived.by(() => {
    if (chip !== 'all' || way === 'adventure') return [{ key: chip, name: '', art: '', things: live }];
    const out: { key: string; name: string; art: string; things: Thing[] }[] = [];
    for (const t of live) {
      const key = t.areas.join(',');
      let g = out.find(x => x.key === key);
      if (!g) { const c = t.areas.length === 1 ? subject.chips.find(x => x.id === t.areas[0]) : null; g = { key, name: c?.name ?? chipNames(subject, t), art: c?.art ?? '', things: [] }; out.push(g); }
      g.things.push(t);
    }
    return out;
  });

  // math's Learn: a trick due its quick check, and the next one to learn, on top
  const m = $derived(mathOf(p));
  const dueId = $derived(subject.id === 'math' && way === 'learn' ? checkDueId(m, isEpisode) : null);
  const due = $derived(dueId ? epLesson(dueId) : null);
  const hero = $derived(subject.id === 'math' && way === 'learn' ? nextToLearn(m, nextMathLesson(m)) : null);
  const heroThing = $derived(hero ? live.find(t => t.id === hero.id) ?? null : null);
  /** the lesson that comes closest while a way has nothing yet (typing's Speed Sprint) */
  function tryIt(id: string) {
    const l = TYPING_LESSON[id];
    if (!l) return;
    if (!isUnlocked(p, l)) { sfx.nope(); game.say('Keep going on the typing map to open this one!'); return; }
    sfx.click(); game.setHome('typing'); game.startLesson(id);
  }
  function quickCheck(id: string) { sfx.click(); game.learnCheck = true; game.openLearn(id); }

  const verb = (t: Thing, done?: boolean, locked?: boolean) => locked ? (way === 'adventure' ? 'Open it' : 'Locked') : way === 'learn' ? (subject.id === 'typing' ? (done ? 'Again' : 'Try it') : done ? 'Watch again' : 'Watch') : way === 'games' ? 'Play' : 'Go';
  const keysOf = (t: Thing) => { const l = TYPING_LESSON[t.id]; return l ? lessonTitle(l, game.layout).split(' and ') : []; };
</script>

<div class="wp" style:--wc={W.color} style:--wd={W.dark} style:--wt={W.tint}>
  {#if !content.things.length}
    <section class="soonbig">
      <img src="{base}{W.icon}" alt="" />
      <div><b>{W.name}: coming soon</b><p>{content.soon ?? `${subject.name} ${W.name.toLowerCase()} is on the way.`}</p>
        {#if content.tryIt}<button class="btn btn-primary tryit" onclick={() => tryIt(content.tryIt!.lesson)}><Icon name="play" size={22} /> {content.tryIt.label}</button>{/if}
      </div>
    </section>
  {:else}
    {#if due}
      <section class="due">
        <img src="{base}icons/bulb.webp" alt="" />
        <div class="dtx"><small>Quick check</small><b>Do you remember {due.title}?</b><span>One question, and the trick is yours for good.</span></div>
        <button class="btn btn-primary" onclick={() => quickCheck(due.id)}>Check it</button>
      </section>
    {/if}
    {#if heroThing && (chip === 'all' || heroThing.areas.includes(chip))}
      <section class="hero">
        <button class="hpic" style:background-image="url({base}{heroThing.art})" onclick={() => openThing(subject, way, heroThing!)} aria-label="Watch {heroThing.name}">
          {#if heroThing.face}<img class="face" src="{base}{heroThing.face}" alt="" />{/if}
          <span class="playdot"><img src="{base}icons/play.webp" alt="" /></span>
        </button>
        <div class="htx">
          <small>Next to learn</small>
          <h2>{heroThing.name}</h2>
          <p>{heroThing.line}</p>
          <button class="btn btn-primary btn-big go" onclick={() => openThing(subject, way, heroThing!)}><Icon name="play" size={26} /> Watch: {heroThing.name}</button>
        </div>
      </section>
    {/if}
    {#if !live.length}
      <section class="soonbig small"><img src="{base}{W.icon}" alt="" /><div><b>Nothing here yet</b><p>Try another part, or All.</p></div></section>
    {/if}
    {#each groups as g (g.key)}
      <section class="grp">
        {#if g.name}<h3>{#if g.art}<img src="{base}{g.art}" alt="" />{/if}{g.name}<small>{g.things.length}</small></h3>{/if}
        <div class="grid">
          {#each g.things as t (t.id)}
            {@const st = statusOf(subject, way, t, p)}
            <article class="tc" class:done={st.done} class:locked={st.locked}>
              <button class="tpic" class:contain={t.kind === 'arcade'} class:keysart={t.kind === 'keys'} style:background-image="url({base}{t.art})" onclick={() => openThing(subject, way, t)} aria-label="{verb(t, st.done, st.locked)}: {t.name}">
                {#if t.face}<img class="face" src="{base}{t.face}" alt="" />{/if}
                {#if t.kind === 'keys'}<span class="keys">{#each keysOf(t) as k (k)}<kbd>{k}</kbd>{/each}</span>{/if}
                {#if way === 'learn'}<span class="playdot sm"><img src="{base}icons/play.webp" alt="" /></span>{/if}
                {#if st.locked}<span class="lock"><Icon name="lock" size={30} /></span>{/if}
              </button>
              <div class="tx">
                <b>{t.kind === 'keys' ? `New keys: ${keysOf(t).join(' and ')}` : t.name}</b>
                <span class="ln">{t.line}</span>
                {#if chip === 'all' && way === 'adventure'}<span class="parts">{chipNames(subject, t)}</span>{/if}
                <div class="row">
                  {#if st.tag}<span class="tag" class:ok={st.done}>{#if st.done}<Icon name="check" size={14} />{/if}{st.tag}</span>{/if}
                  <button class="btn small" class:btn-primary={!st.locked} onclick={() => openThing(subject, way, t)}>{verb(t, st.done, st.locked)}</button>
                </div>
              </div>
            </article>
          {/each}
        </div>
      </section>
    {/each}
    {#if soon.length}
      <section class="soonrow">
        <b>Coming soon</b>
        {#each soon as t (t.id)}<span class="soonchip"><img src="{base}{t.art}" alt="" />{t.name}<small>{chipNames(subject, t)}</small></span>{/each}
      </section>
    {/if}
  {/if}
</div>

<style>
  .wp { display: flex; flex-direction: column; gap: 18px; width: 100%; max-width: 1400px; margin: 0 auto; }
  .soonbig { display: flex; align-items: center; gap: 18px; padding: 22px 26px; border-radius: 28px; background: rgba(255, 255, 255, .85); box-shadow: inset 0 0 0 3px var(--wt), 0 16px 34px -24px rgba(60, 40, 110, .5); max-width: 760px; margin: 10px auto; }
  .soonbig img { width: 96px; height: 96px; object-fit: contain; filter: grayscale(.25) drop-shadow(0 6px 6px rgba(60, 30, 90, .2)); }
  .soonbig b { font: 600 26px var(--font-ui); color: var(--wd); }
  .soonbig p { margin: 4px 0 0; font: 600 17px/1.4 var(--font-body); color: var(--ink2); }
  .soonbig.small { padding: 14px 18px; } .soonbig.small img { width: 60px; height: 60px; } .soonbig.small b { font-size: 20px; }

  .due { display: flex; align-items: center; gap: 14px; background: linear-gradient(100deg, #fff7dc, #fff); border-radius: 24px; padding: 10px 16px; box-shadow: 0 0 0 3px #ffd75e, 0 18px 36px -26px rgba(40, 20, 80, .55); }
  .due img { width: 56px; height: 56px; object-fit: contain; }
  .dtx { flex: 1; display: flex; flex-direction: column; }
  .dtx small { font: 800 12px var(--font-body); letter-spacing: .08em; text-transform: uppercase; color: #b07a10; }
  .dtx b { font: 600 21px var(--font-ui); }
  .dtx span { font: 600 14px var(--font-body); color: var(--muted); }

  .hero { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 20px; align-items: center; background: rgba(255, 255, 255, .95); border-radius: 30px; padding: 14px 18px; box-shadow: 0 0 0 4px var(--wt), 0 24px 44px -26px rgba(40, 20, 80, .6); }
  .hpic { position: relative; aspect-ratio: 16 / 8; border: 0; padding: 0; cursor: pointer; border-radius: 22px; overflow: hidden; background: #e8e2f2 center 30% / cover; box-shadow: inset 0 0 0 3px rgba(255, 255, 255, .6); transition: transform .15s; }
  .hpic:hover { transform: translateY(-3px); }
  .htx small { font: 800 12px var(--font-body); letter-spacing: .08em; text-transform: uppercase; color: var(--wd); }
  .htx h2 { margin: 2px 0 4px; font-size: clamp(28px, 3vw, 40px); }
  .htx p { margin: 0 0 10px; font: 600 16px/1.35 var(--font-body); color: var(--ink2); }
  .go { background: linear-gradient(color-mix(in srgb, var(--wc) 70%, #fff), var(--wc)); box-shadow: 0 5px 0 var(--wd); display: inline-flex; align-items: center; gap: 8px; max-width: 100%; }

  .grp h3 { margin: 0 0 10px; display: flex; align-items: center; gap: 10px; font-size: 22px; }
  .grp h3 img { width: 58px; height: 36px; object-fit: cover; border-radius: 10px; box-shadow: 0 0 0 3px #fff, 0 3px 8px rgba(40, 20, 80, .2); }
  .grp h3 small { font: 700 14px var(--font-body); color: var(--muted); background: rgba(255, 255, 255, .8); padding: 1px 9px; border-radius: 999px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 14px; }
  .tc { display: flex; flex-direction: column; background: #fff; border-radius: 24px; overflow: hidden; box-shadow: 0 14px 30px -20px rgba(60, 40, 110, .55), 0 0 0 3px #fff; transition: transform .15s; }
  .tc:hover { transform: translateY(-3px); }
  .tc.done { box-shadow: 0 14px 30px -20px rgba(60, 40, 110, .55), 0 0 0 3px #b8edd5; }
  .tpic { position: relative; aspect-ratio: 16 / 9; border: 0; padding: 0; cursor: pointer; background: #dfe9f5 center / cover no-repeat; }
  .tpic::after { content: ''; position: absolute; inset: 0; background: linear-gradient(rgba(0, 0, 0, 0) 60%, rgba(40, 20, 10, .3)); pointer-events: none; }
  .tpic.contain { background-size: contain; background-position: center bottom; background-color: color-mix(in srgb, var(--wc) 16%, #fff); background-origin: content-box; padding-top: 6px; }
  .tc.locked .tpic { filter: grayscale(.6) brightness(1.04); }
  .face { position: absolute; right: 5%; bottom: 7%; width: 26%; aspect-ratio: 1; object-fit: cover; border-radius: 50%; z-index: 1; background: #fff; box-shadow: 0 0 0 4px #fff, 0 6px 12px rgba(0, 0, 0, .3); }
  .hpic .face { width: 22%; }
  .tryit { margin-top: 10px; display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(color-mix(in srgb, var(--wc) 70%, #fff), var(--wc)); box-shadow: 0 5px 0 var(--wd); }
  .playdot { position: absolute; left: 50%; top: 46%; translate: -50% -50%; z-index: 1; display: grid; place-items: center; width: 70px; height: 70px; border-radius: 50%; background: rgba(255, 255, 255, .92); box-shadow: 0 0 0 5px rgba(255, 255, 255, .45), 0 8px 18px rgba(0, 0, 0, .3); }
  .playdot img { width: 44px; height: 44px; object-fit: contain; margin-left: 4px; }
  .playdot.sm { left: 14%; top: 18%; width: 44px; height: 44px; }
  .playdot.sm img { width: 28px; height: 28px; margin-left: 2px; }
  .lock { position: absolute; inset: 0; z-index: 2; display: grid; place-items: center; }
  .keys { position: absolute; inset: 0; z-index: 1; display: flex; align-items: center; justify-content: center; gap: 12px; }
  kbd { min-width: 64px; height: 64px; padding: 0 12px; display: grid; place-items: center; border-radius: 16px; font: 600 34px var(--font-ui); color: var(--ink); background: linear-gradient(#fff, #efe9fb); box-shadow: 0 6px 0 #c9bdea, 0 12px 18px -6px rgba(40, 20, 80, .45); }
  .tx { flex: 1; display: flex; flex-direction: column; gap: 3px; padding: 10px 14px 12px; }
  .tx b { font: 600 19px/1.15 var(--font-ui); }
  .ln { font: 600 13.5px/1.3 var(--font-body); color: var(--muted); display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .parts { align-self: flex-start; font: 800 11.5px var(--font-body); color: var(--wd); background: var(--wt); padding: 2px 8px; border-radius: 999px; }
  .row { margin-top: auto; padding-top: 6px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .tag { display: inline-flex; align-items: center; gap: 3px; font: 800 12px var(--font-body); padding: 3px 10px; border-radius: 999px; background: var(--wt); color: var(--wd); white-space: nowrap; }
  .tag.ok { background: #d9f7e8; color: #1f7a54; }
  .btn.small { padding: 7px 16px; font-size: 16px; }
  .tc .btn-primary { background: linear-gradient(color-mix(in srgb, var(--wc) 70%, #fff), var(--wc)); box-shadow: 0 4px 0 var(--wd); }
  .soonrow { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .soonrow > b { font: 600 18px var(--font-ui); color: var(--ink2); margin-right: 4px; }
  .soonchip { display: inline-flex; align-items: center; gap: 6px; padding: 3px 12px 3px 3px; border-radius: 999px; background: rgba(255, 255, 255, .85); font: 600 15px var(--font-ui); color: var(--ink2); }
  .soonchip img { width: 44px; height: 28px; object-fit: cover; border-radius: 999px; filter: grayscale(.5); }
  .soonchip small { font: 700 11.5px var(--font-body); color: var(--muted); }
  @media (max-width: 759px) {
    .wp { gap: 12px; }
    .hero { grid-template-columns: 1fr; padding: 10px; gap: 8px; }
    .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .tx { padding: 7px 9px 9px; }
    .tx b { font-size: 15.5px; }
    .ln { display: none; }
    .row { flex-direction: column; align-items: stretch; gap: 5px; }
    .tag { justify-content: center; }
    kbd { min-width: 40px; height: 40px; font-size: 22px; border-radius: 10px; padding: 0 8px; }
    .playdot.sm { width: 34px; height: 34px; } .playdot.sm img { width: 22px; height: 22px; }
    .soonbig { flex-direction: column; text-align: center; padding: 16px; }
    .grp h3 { font-size: 18px; }
  }
</style>
