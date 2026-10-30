<script lang="ts">
  // Home: the first thing you see, and the place every game comes back to. Under the top bar (your
  // buddy, shells, Keypals, the Shop, stickers and the compass): the Subjects, one card each (Typing,
  // Math; from subjects.ts, so a new subject just appears), each with its four ways to play (Learn,
  // Practice, Games, Adventure) and one big Keep going button; then "Play anywhere", the places that
  // take every subject (the Arcade, Adventure, Glimmer Drop, Family Duel and Rival Ghosts); then how it
  // all fits together as a little loop of pictures. Where your progress is saved shows by the hello,
  // and if a grown-up's sign-in ran out, a banner says so.
  import { game } from '../state/game.svelte';
  import { ALL_LESSONS, REGION } from '../engine/course';
  import { outfitOf, passed, todayMs, totalStars } from '../engine/profile';
  import { sfx } from '../audio/sound';
  import { STRAND, MATH_REGION, worldOf } from '../math/course';
  import { mathOf, mathStarsTotal, nextMathLesson } from '../math/progress';
  import { isLearned } from '../math/learn';
  import { advView, markSeen, playLeft } from '../adventure/state';
  import { ARCADE, dailyGame } from '../arcade/arcade';
  import { dropOf } from '../drop/save';
  import { seasonView } from '../adventure/versus';
  import { LEAGUES } from '../adventure/ghosts';
  import { GLIMMERS } from '../adventure/glimmers';
  import { WORLD_PIN, lastWorld } from '../adventure/worlds';
  import { nextLesson } from '../engine/profile';
  import { cloud, goSaveOnline, staySignedOut } from '../state/cloud.svelte';
  import { ANYWHERE, SUBJECTS, WAYS, wayCount, type Subject, type WayId } from '../subjects';
  import { keepGoing, openAnywhere, openSubject } from '../nav';
  import SaveChip from '../ui/SaveChip.svelte';
  import TopBar from '../ui/TopBar.svelte';
  import Critter from '../ui/Critter.svelte';
  import Icon from '../ui/Icon.svelte';
  import ClassWorkCard from '../ui/ClassWorkCard.svelte';

  const base = import.meta.env.BASE_URL;
  const p = $derived(game.profile!);
  const look = $derived(p.settings.look);
  const goalMs = $derived(p.settings.dailyGoalMin * 60000);
  const today = $derived(todayMs(p));
  let sw = $state(1280);
  const m = $derived(mathOf(p));
  const adv = $derived(advView(p));
  // how it all fits together: shown once, and from the "How it works" button
  let guide = $state(!(advView(game.profile!).seen ?? []).includes('guide'));
  function closeGuide() { guide = false; game.update(pp => markSeen(pp, 'guide')); }
  const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

  // each subject's card: where you are, its stars, and a short line under each way
  const drills = ALL_LESSONS.filter(l => l.kind === 'drill');
  const course = ALL_LESSONS.filter(l => !l.practice);
  function where(s: Subject): { place: string; stars: number; done: number; of: number; region: string } {
    if (s.id === 'typing') { const l = nextLesson(p); return { place: REGION[l.region].name, stars: totalStars(p), done: course.filter(x => passed(p, x.id)).length, of: course.length, region: `regions/${l.region}.webp` }; }
    const l = nextMathLesson(m);
    const place = `${STRAND[l.op].name}${l.region === 'start' ? '' : ' · ' + MATH_REGION[l.region].name}`;
    return { place, stars: mathStarsTotal(m), done: Object.values(m.lessons).filter(r => r.stars > 0).length, of: wayCount(s, 'practice'), region: `regions/${worldOf(l)}.webp` };
  }
  function wayLine(s: Subject, w: WayId, stars: number): string {
    const n = wayCount(s, w);
    if (!n) return 'Coming soon';
    if (w === 'learn') return s.id === 'typing' ? `${drills.filter(l => passed(p, l.id)).length}/${n} done` : `${s.ways.learn.things.filter(t => isLearned(m, t.id)).length}/${n} learned`;
    if (w === 'practice') return `${fmt(stars)} stars`;
    return `${n} ${n === 1 ? s.ways[w].unit.replace(/s$/, '') : s.ways[w].unit}`;
  }

  // Play anywhere: a line of what's going on in each place
  const today0 = dailyGame();
  const worldName = $derived(WORLD_PIN[lastWorld.id]?.name ?? 'Sky Islands');
  const advReady = $derived(adv.incubator.filter(e => e && e.have >= e.need).length);
  const found = $derived(Object.keys(adv.glimmers).length);
  const versus = $derived(adv.settings.versus !== false);
  const play = $derived(playLeft(p));
  const anywhere = $derived(ANYWHERE.filter(a => !a.versus || versus));
  function anyLine(id: string): string {
    if (id === 'arcade') return `Today's challenge: ${ARCADE[today0].name}`;
    if (id === 'adventure') return advReady ? `${advReady} egg${advReady === 1 ? '' : 's'} ready to hatch!` : `${worldName} · ${found}/${GLIMMERS.length} Glimmers`;
    if (id === 'drop') { const b = dropOf(p).best; return !play.open ? 'Play time is used up today' : b ? `Best ${fmt(b)} · uses play time` : 'Just for fun · uses play time'; }
    if (id === 'duel') { const d = adv.duels ?? { played: 0, won: 0 }; return d.played ? `${d.won} won of ${d.played}` : 'Two players, one screen'; }
    return LEAGUES[seasonView(p).league]?.name ?? LEAGUES[0].name;
  }

  function onKey(e: KeyboardEvent) {
    if (game.modalOpen || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 't' || k === '1') { e.preventDefault(); keepGoing('typing', p).go(); }
    if (k === 'm' || k === '2') { e.preventDefault(); keepGoing('math', p).go(); }
    if (k === 'g' || k === '3') { e.preventDefault(); openAnywhere('arcade'); }
    if (k === 'a' || k === '4') { e.preventDefault(); openAnywhere('adventure'); }
    if (e.key === 'Enter') { e.preventDefault(); keepGoing(game.homeGame, p).go(); }
    if (e.key === 'Escape') game.go('players');
  }
  const hello = $derived(today === 0 ? `Hi ${p.name}! What shall we play today?` : today >= goalMs ? `Goal done for today, ${p.name}! Want to keep going?` : `Welcome back, ${p.name}! Pick a game.`);
  const HOTKEY: Record<string, string> = { typing: 'T', math: 'M' };
</script>

<svelte:window onkeydown={onKey} />

<div class="screen hub" bind:clientWidth={sw}>
  <TopBar home />

  <div class="body scroll">
    <div class="hello">
      <div class="bud"><Critter friend={p.buddy} {look} accessory={outfitOf(p)} size={sw < 760 ? 64 : 88} mood="idle" /></div>
      <p>{hello}</p>
      {#if sw >= 860}<span class="hsave"><SaveChip /></span>{/if}
    </div>
    {#if sw < 860}<div class="hsave sm"><SaveChip compact={sw < 600} /></div>{/if}

    <!-- a grown-up's sign-in ran out on this computer: say so, so nobody thinks they're still saving -->
    {#if cloud.signedOut}
      <div class="signedout">
        <img src="{base}icons/cloud-save.webp" alt="" />
        <p><b>You were signed out.</b> Sign in again to keep saving online{cloud.signedOut.name ? ` as ${cloud.signedOut.name.split(' ')[0]}` : ''}. Progress is still kept on this computer.</p>
        <button class="btn btn-primary" onclick={() => { sfx.click(); goSaveOnline(); }}>Sign in again</button>
        <button class="btn ghost" onclick={() => { sfx.click(); staySignedOut(); }}>Stay signed out</button>
      </div>
    {/if}

    <ClassWorkCard compact={sw < 600} /><!-- classes: class work for a player in a class -->

    <!-- the subjects: each with the same four ways to play, and the next thing to do -->
    <h2 class="rowh">Subjects</h2>
    <div class="subjects">
      {#each SUBJECTS as s (s.id)}
        {@const wh = where(s)}
        {@const kg = keepGoing(s.id, p)}
        <section class="subj" style:--tone={s.color} style:--shade={s.shade}>
          <!-- the picture as an inline style: a relative url() inside a custom property resolves against the stylesheet's folder, not the page -->
          <button class="banner" style:background-image="url({base}{wh.region})" onclick={() => openSubject(s.id, 'practice')} aria-label="Open {s.name}">
            <span class="sign"><img src="{base}{s.icon}" alt="" /></span>
            <span class="name">{s.name}</span>
            <span class="tag">{s.tag}</span>
          </button>
          <div class="info">
            <div class="ways" role="group" aria-label="Ways to play {s.name}">
              {#each WAYS as w (w.id)}
                {@const n = wayCount(s, w.id)}
                <button class="way" class:soon={!n} style:--wc={w.color} style:--wd={w.dark} style:--wt={w.tint} onclick={() => { sfx.click(); openSubject(s.id, w.id); }} title="{s.name}: {w.name}, {w.line.toLowerCase()}">
                  <img src="{base}{w.icon}" alt="" />
                  <b>{w.name}</b>
                  <small>{wayLine(s, w.id, wh.stars)}</small>
                </button>
              {/each}
            </div>
            <button class="btn btn-primary keep" onclick={kg.go}>
              <span class="kt"><small>{kg.fresh ? `Start ${s.name.toLowerCase()}` : `Keep going · ${wh.place}`}</small><b>{kg.label}</b></span>
              {#if HOTKEY[s.id]}<span class="kbd">{HOTKEY[s.id]}</span>{/if}
            </button>
            <div class="bar2" title="{wh.done} of {wh.of}"><i style:width="{(wh.done / Math.max(1, wh.of)) * 100}%"></i></div>
          </div>
        </section>
      {/each}
    </div>

    <!-- the places that take every subject -->
    <h2 class="rowh">Play anywhere</h2>
    <div class="anywhere">
      {#each anywhere as a (a.id)}
        <button class="any" class:hot={a.id === 'adventure' && advReady > 0} onclick={() => openAnywhere(a.id)}>
          <span class="apic" class:contain={a.contain} style:background-image="url({base}{a.art})"><img class="aicon" src="{base}{a.icon}" alt="" /></span>
          <span class="atx"><b>{a.name}{#if a.id === 'arcade'} <span class="kbd">G</span>{:else if a.id === 'adventure'} <span class="kbd">A</span>{/if}</b><small>{anyLine(a.id)}</small>{#if a.fun}<em>Just for fun</em>{/if}</span>
        </button>
      {/each}
    </div>

    <!-- how it all fits together, as a loop: learn, practise, earn, then spend it playing -->
    <section class="loop" aria-label="How Keypals works">
      <h2 class="rowh">How Keypals works</h2>
      <div class="steps">
        <div class="st"><img src="{base}icons/book.webp" alt="" /><b>Learn</b><small>Your buddy shows you a trick</small></div>
        <span class="arr"><Icon name="right" size={30} /></span>
        <div class="st"><img src="{base}icons/map.webp" alt="" /><b>Practice</b><small>Trips and lessons on the map</small></div>
        <span class="arr"><Icon name="right" size={30} /></span>
        <div class="st"><span class="trio"><img src="{base}game/icon-star.webp" alt="" /><img src="{base}game/icon-shell.webp" alt="" /><img src="{base}game/egg-common.webp" alt="" /></span><b>Earn</b><small>Stars, shells and eggs</small></div>
        <span class="arr"><Icon name="right" size={30} /></span>
        <div class="st"><span class="trio"><img src="{base}game/icon-grump.webp" alt="" /><img src="{base}icons/arcade.webp" alt="" /><img src="{base}icons/gift.webp" alt="" /></span><b>Play</b><small>Adventure, Games and the Shop</small></div>
        <button class="btn more" onclick={() => { guide = true; sfx.pop(); }}><img src="{base}icons/help.webp" alt="" />How it works</button>
      </div>
    </section>
  </div>

  {#if guide}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="guidebg" onclick={closeGuide}>
      <div class="guide card" onclick={(e) => e.stopPropagation()}>
        <h2>How Keypals works</h2>
        <div class="gsteps">
          <div class="gs"><div class="gpic" style:background-image="url({base}game/intro-practice.webp)"></div><b>1. Learn and practice</b><p>Watch your buddy show a trick, then practise it: typing lessons, math trips and games. They earn stars that open new lessons, friendship with your buddy, and shells. Every right answer makes your eggs grow.</p></div>
          <div class="gs"><div class="gpic" style:background-image="url({base}game/intro-keypals.webp)"></div><b>2. Your Keypals</b><p>Friendship with each buddy opens new outfits and dances. New buddies join as you play. Outfits and dances help in Adventure too.</p></div>
          <div class="gs"><div class="gpic" style:background-image="url({base}game/intro-story.webp)"></div><b>3. Adventure</b><p>Cheer up grumpy Glimmers with your answers, and they join your team. Duel your family, race Rival Ghosts, and help your Glimmers grow up!</p></div>
          <div class="gs"><div class="gpic" style:background-image="url({base}game/intro-stickers.webp)"></div><b>4. Stickers and medals</b><p>Medals are for great things you can do again and again: three stars, no slips, quick answers. Stickers are for firsts. Both earn shells.</p></div>
        </div>
        <!-- everything there is to earn, one line each: the same in every game -->
        <h3 class="gh">What you earn</h3>
        <div class="earn">
          <div class="ei"><img src="{base}game/icon-star.webp" alt="" /><p><b>Stars</b> How well a lesson, trip or round went. They open the next one, and new Keypals join as you collect them.</p></div>
          <div class="ei"><span class="eh"><Icon name="heart" size={40} /></span><p><b>Friendship</b> Grows every time you play with your buddy, in practice or Adventure. It opens outfits and dances.</p></div>
          <div class="ei"><img src="{base}treasures/ruby.webp" alt="" /><p><b>Treasure</b> The better your score, the better the treasure you find, from a Shiny Pebble up to a Rainbow Star. Each one is worth shells.</p></div>
          <div class="ei"><img src="{base}game/icon-shell.webp" alt="" /><p><b>Shells</b> Earned by playing. Spend them in the Shop on things to wear, eggs and treats.</p></div>
          <div class="ei"><img src="{base}game/egg-common.webp" alt="" /><p><b>Eggs and Glimmers</b> Right answers in practice hatch eggs; battles bring Glimmers too. They level up and help in battles.</p></div>
          <div class="ei"><img src="{base}game/icon-medals.webp" alt="" /><p><b>Medals and stickers</b> For the great things you do, with any buddy. They all go in your one book.</p></div>
          <div class="ei"><img src="{base}game/league-0.webp" alt="" /><p><b>Leagues</b> Only in Rival Ghosts: win points this week to move up a league.</p></div>
        </div>
        <button class="btn btn-primary" onclick={closeGuide}>Let's play!</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .hub { display: flex; flex-direction: column; background: linear-gradient(#cfe9fa, #eaf6ff 55%, #f6f2ff); }
  .body { flex: 1; min-height: 0; padding: 10px 24px 28px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .body > * { width: min(1500px, 100%); }
  .hello { display: flex; align-items: center; gap: 14px; justify-content: center; }
  .hello p { margin: 0; font: 600 24px var(--font-ui); color: var(--ink); background: #fff; padding: 10px 20px; border-radius: 22px; box-shadow: var(--shadow-sm); position: relative; }
  .hello p::before { content: ''; position: absolute; left: -10px; top: 50%; margin-top: -10px; border: 10px solid transparent; border-right-color: #fff; border-left: 0; }
  .bud { animation: bob 2.8s ease-in-out infinite; margin: -14px 0 -10px; }
  @keyframes bob { 50% { transform: translateY(-6px); } }
  .hsave { margin-left: 8px; }
  .hsave.sm { margin: -4px 0 0; align-self: center; width: auto; max-width: 100%; }
  .signedout { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 10px 14px; border-radius: 20px; background: #fff4e0; box-shadow: inset 0 0 0 3px #ffcf7a; }
  .signedout img { width: 44px; height: 44px; object-fit: contain; filter: grayscale(.6); }
  .signedout p { flex: 1; min-width: 220px; margin: 0; font: 600 16px/1.35 var(--font-body); color: #6b3d00; }
  .signedout b { font: 600 18px var(--font-ui); color: #5a3000; }
  .ghost { background: var(--bg2); color: var(--ink); box-shadow: none; }
  .rowh { margin: 6px 0 -2px; font: 600 22px var(--font-ui); color: var(--ink2); }

  /* the subject cards */
  .subjects { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 520px), 1fr)); gap: 18px; }
  .subj { border-radius: 30px; overflow: hidden; background: #fff; box-shadow: 0 18px 40px -22px rgba(60, 40, 110, .55), 0 0 0 4px #fff; display: flex; flex-direction: column; }
  .banner { position: relative; height: clamp(96px, 14vh, 150px); border: 0; cursor: pointer; background: #cfe2f5 center / cover no-repeat; display: flex; flex-direction: column; justify-content: flex-end; align-items: flex-start; padding: 12px 20px; text-align: left; color: #fff; }
  .banner::before { content: ''; position: absolute; inset: 0; background: linear-gradient(transparent 10%, var(--shade) 95%); }
  .banner > * { position: relative; }
  .sign { position: absolute; top: 10px; right: 14px; width: 62px; height: 62px; border-radius: 20px; display: grid; place-items: center; background: linear-gradient(#fff, #f6f2ff); box-shadow: 0 0 0 4px var(--tone), 0 8px 18px -6px rgba(30, 10, 60, .45); transition: transform .2s cubic-bezier(.3, .8, .4, 1.5); }
  .sign img { width: 52px; height: 52px; object-fit: contain; }
  .banner:hover .sign { transform: scale(1.06) rotate(4deg); }
  .name { font: 600 clamp(34px, 5vh, 50px)/1 var(--font-ui); text-shadow: 0 3px 12px rgba(0, 0, 0, .25); }
  .tag { font: 700 15px var(--font-body); opacity: .95; }
  .info { padding: 12px 16px 14px; display: flex; flex-direction: column; gap: 10px; }
  .ways { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
  .way { display: flex; flex-direction: column; align-items: center; gap: 1px; min-width: 0; border: 0; cursor: pointer; padding: 6px 4px 7px; border-radius: 18px; background: var(--wt); box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--wc) 30%, #fff), 0 4px 0 color-mix(in srgb, var(--wc) 40%, #fff); font: inherit; transition: transform .12s; }
  .way:hover { transform: translateY(-3px); }
  .way:hover img { transform: scale(1.08) rotate(-4deg); }
  .way img { width: 50px; height: 50px; object-fit: contain; filter: drop-shadow(0 3px 3px rgba(60, 30, 90, .2)); transition: transform .2s; }
  .way b { font: 600 18px/1.1 var(--font-ui); color: var(--wd); }
  .way small { font: 700 12px/1.2 var(--font-body); color: var(--ink2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .way.soon { opacity: .7; }
  .way.soon img { filter: grayscale(.4); }
  .keep { display: flex; align-items: center; gap: 10px; justify-content: space-between; text-align: left; padding: 9px 18px; background: linear-gradient(color-mix(in srgb, var(--tone) 70%, #fff), var(--tone)); box-shadow: 0 5px 0 color-mix(in srgb, var(--tone) 70%, #000); }
  .kt { display: flex; flex-direction: column; min-width: 0; }
  .kt small { font: 700 13px var(--font-body); opacity: .92; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .kt b { font: 600 23px/1.15 var(--font-ui); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .keep .kbd { background: rgba(255, 255, 255, .25); border-color: rgba(255, 255, 255, .4); color: inherit; font-size: 12px; height: 22px; flex: none; }
  .bar2 { height: 8px; border-radius: 999px; background: #efeaf6; overflow: hidden; }
  .bar2 i { display: block; height: 100%; border-radius: 999px; background: var(--tone); }

  /* Play anywhere */
  .anywhere { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 14px; }
  .any { display: flex; flex-direction: column; border: 0; padding: 0; cursor: pointer; text-align: left; background: #fff; border-radius: 22px; overflow: hidden; box-shadow: 0 14px 30px -20px rgba(60, 40, 110, .55), 0 0 0 3px #fff; font: inherit; transition: transform .15s; }
  .any:hover { transform: translateY(-3px); }
  .apic { position: relative; height: clamp(70px, 10vh, 100px); background: #e8e2f2 center / cover no-repeat; }
  .apic.contain { background-size: contain; background-position: center bottom; background-color: #f1eaff; }
  .aicon { position: absolute; left: 10px; bottom: -18px; width: 52px; height: 52px; object-fit: contain; padding: 4px; border-radius: 16px; background: #fff; box-shadow: 0 4px 10px -4px rgba(40, 20, 80, .45); }
  .atx { display: flex; flex-direction: column; gap: 1px; padding: 22px 12px 10px; }
  .atx b { display: flex; align-items: center; gap: 6px; font: 600 19px var(--font-ui); color: var(--ink); }
  .atx b .kbd { font-size: 11px; height: 20px; }
  .atx small { font: 700 13px/1.25 var(--font-body); color: var(--muted); }
  .atx em { align-self: flex-start; margin-top: 3px; font: 800 11px var(--font-body); font-style: normal; color: #6a3fc4; background: #f1eaff; padding: 1px 8px; border-radius: 999px; }
  .any.hot .atx small { color: #c2348a; }
  .any.hot .aicon { animation: bob 1.4s ease-in-out infinite; }

  /* the loop */
  .loop { display: flex; flex-direction: column; gap: 8px; padding-bottom: 6px; }
  .steps { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; background: rgba(255, 255, 255, .75); border-radius: 24px; padding: 10px 14px; }
  .st { flex: 1 1 140px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 1px; }
  .st > img { width: 52px; height: 52px; object-fit: contain; }
  .trio { display: flex; height: 52px; align-items: center; }
  .trio img { width: 40px; height: 40px; object-fit: contain; margin: 0 -3px; }
  .st b { font: 600 18px var(--font-ui); }
  .st small { font: 700 12.5px var(--font-body); color: var(--muted); }
  .arr { flex: none; opacity: .7; }
  .more { flex: none; display: inline-flex; align-items: center; gap: 6px; background: #fff; box-shadow: 0 0 0 3px #ffd36b, 0 4px 0 #e8b94a; color: var(--ink); padding: 8px 16px 8px 8px; font-size: 17px; }
  .more img { width: 32px; height: 32px; object-fit: contain; }

  /* the How it works sheet */
  .guidebg { position: fixed; inset: 0; z-index: 40; background: rgba(30, 20, 60, .5); display: grid; place-items: center; padding: 16px; }
  .guide { width: min(1080px, 96vw); max-height: calc(100dvh - 32px); overflow: auto; padding: 20px 24px; display: flex; flex-direction: column; gap: 14px; }
  .guide h2 { margin: 0; font-size: 32px; }
  .gsteps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
  .gs { display: flex; flex-direction: column; gap: 6px; }
  .gs b { font: 600 20px var(--font-ui); }
  .gs p { margin: 0; font: 600 14px/1.45 var(--font-body); color: var(--ink2); }
  .gpic { aspect-ratio: 4 / 3; border-radius: 18px; background-size: cover; background-position: center; position: relative; box-shadow: var(--shadow-sm); }
  .guide > .btn { align-self: flex-end; font-size: 20px; padding: 10px 22px; }
  .gh { margin: 4px 0 -4px; font-size: 22px; }
  .earn { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; }
  .ei { display: flex; gap: 10px; align-items: flex-start; background: #faf8fe; border-radius: 16px; padding: 10px 12px; }
  .ei img, .ei .eh { width: 44px; height: 44px; flex: none; object-fit: contain; }
  .ei .eh { display: grid; place-items: center; }
  .ei p { margin: 0; font: 600 13.5px/1.4 var(--font-body); color: var(--ink2); }
  .ei p b { display: block; font: 600 16px var(--font-ui); color: var(--ink); }

  /* short laptop screens: a little tighter, so the subjects show without scrolling */
  @media (max-height: 800px) and (min-width: 760px) {
    .body { padding-top: 6px; gap: 8px; }
    .hello p { font-size: 20px; padding: 7px 16px; }
    .bud { margin: -18px 0 -14px; }
    .rowh { font-size: 19px; margin-top: 2px; }
    .way img { width: 40px; height: 40px; }
    .way b { font-size: 16.5px; }
    .info { gap: 8px; padding: 10px 14px 12px; }
    .kt b { font-size: 20px; }
  }
  @media (max-width: 760px) {
    .earn { grid-template-columns: 1fr; } .gsteps { grid-template-columns: repeat(2, minmax(0, 1fr)); } .guide h2 { font-size: 24px; } .gs b { font-size: 16px; } .gs p { font-size: 12.5px; }
    .body { padding: 8px 10px 20px; gap: 8px; }
    .hello { justify-content: flex-start; gap: 8px; }
    .hello p { font-size: 17px; padding: 8px 12px; }
    .bud { margin: -10px 0 -6px; }
    .rowh { font-size: 18px; }
    .subjects { gap: 12px; }
    .banner { height: 88px; padding: 8px 14px; }
    .sign { width: 48px; height: 48px; top: 8px; right: 10px; border-radius: 14px; box-shadow: 0 0 0 3px var(--tone); }
    .sign img { width: 40px; height: 40px; }
    .name { font-size: 32px; }
    .tag { font-size: 12.5px; }
    .info { padding: 8px 10px 10px; gap: 8px; }
    .ways { gap: 5px; }
    .way { padding: 4px 2px 5px; border-radius: 14px; }
    .way img { width: 36px; height: 36px; }
    .way b { font-size: 14.5px; }
    .way small { font-size: 10.5px; }
    .keep { padding: 8px 14px; }
    .kt b { font-size: 19px; }
    .keep .kbd { display: none; }
    .anywhere { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .apic { height: 64px; }
    .aicon { width: 42px; height: 42px; bottom: -14px; }
    .atx { padding: 16px 9px 8px; }
    .atx b { font-size: 16px; }
    .atx b .kbd { display: none; }
    .atx small { font-size: 11.5px; }
    .steps { gap: 4px; padding: 8px; }
    .st { flex: 1 1 40%; }
    .arr { display: none; }
    .more { width: 100%; justify-content: center; }
  }
</style>
