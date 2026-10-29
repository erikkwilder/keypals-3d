<script lang="ts">
  // The end of an Arcade round, over the game's world (the buddy celebrating behind): the score counting
  // up, the stars, your best, today's challenge, and what the round earned as practice (the treasure,
  // shells, friendship, medals and stickers), then Play again, the Arcade or Home.
  import { onDestroy, onMount } from 'svelte';
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { TREASURES } from '../../engine/rewards';
  import { FRIEND } from '../../art/cast';
  import { sfx } from '../../audio/sound';
  import { dailyGoal, type Answered, type ArcadeGame, type ArcadeOutcome } from '../arcade';
  import Stars from '../../ui/Stars.svelte';
  import NavTile from '../../ui/NavTile.svelte';
  import Confetti from '../../ui/Confetti.svelte';
  import Icon from '../../ui/Icon.svelte';

  type Props = { outcome: ArcadeOutcome; game: ArcadeGame; daily: boolean; answered: Answered[]; bestCombo: number; compact: boolean; onagain: () => void; onarcade: () => void; onhome: () => void };
  let { outcome: o, game: G, daily, answered, bestCombo, compact, onagain, onarcade, onhome }: Props = $props();

  const right = $derived(answered.filter(a => a.ok).length);
  const title = $derived(o.newBest ? 'New best!' : o.stars === 3 ? 'Three stars!' : o.stars === 2 ? 'Great run!' : o.stars === 1 ? 'Nice one!' : 'Good practice!');
  const nextStar = $derived(G.stars.find(s => s > o.score));
  const shells = $derived(o.shells + o.dailyShells);
  const fmt = (n: number) => n.toLocaleString('en-US');
  // a few facts to practise: the ones missed this round, with their answers
  const missed = $derived([...new Map(answered.filter(a => !a.ok).map(a => [`${a.f.a}${a.f.op ?? 'x'}${a.f.b}`, a.f])).values()].slice(0, 4));
  const opOf = (f: Answered['f']) => ({ x: '×', '+': '+', '-': '−', '/': '÷' })[f.op ?? 'x'];
  const ansOf = (f: Answered['f']) => { const op = f.op ?? 'x'; return op === 'x' ? f.a * f.b : op === '+' ? f.a + f.b : op === '-' ? f.a - f.b : f.a / f.b; };

  const shown = new Tween(0, { duration: 1100, easing: cubicOut });
  let starsShown = $state(0);
  let step = $state(0);
  let burst = $state(0);
  let timers: ReturnType<typeof setTimeout>[] = [];
  const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

  function onKey(e: KeyboardEvent) {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onagain(); }
    else if (e.key === 'Escape') onarcade();
  }
  onMount(() => {
    at(200, () => (shown.target = o.score));
    for (let i = 0; i < 3; i++) at(1100 + i * 330, () => { starsShown = i + 1; if (i < o.stars) sfx.star(i); });
    at(2200, () => { step = 1; if (o.stars || o.newBest) burst++; });
    at(2600, () => { step = 2; if (o.treasure >= 0) sfx.treasure(o.treasure); });
    at(3000, () => (step = 3));
    window.addEventListener('keydown', onKey);
  });
  onDestroy(() => { timers.forEach(clearTimeout); window.removeEventListener('keydown', onKey); });
</script>

<div class="res" class:compact>
  <div class="card">
    <div class="head">
      <img class="cab" src="{import.meta.env.BASE_URL}{G.art}" alt="" />
      <div class="ttl">
        <div class="where">{daily ? "Today's challenge" : 'Arcade'} · {G.name}</div>
        <h1 class:best={o.newBest}>{title}</h1>
        <div class="score">{fmt(Math.round(shown.current))}</div>
        <div class="stars"><Stars n={Math.min(starsShown, o.stars)} of={3} size={compact ? 34 : 44} /></div>
      </div>
    </div>

    <div class="chips" class:on={step >= 1}>
      <div class="chip"><Icon name="trophy" size={26} /><b>{fmt(o.best)}</b><span>best{#if o.newBest}<em>New!</em>{/if}</span></div>
      <div class="chip"><Icon name="check" size={26} /><b>{right}<small>/{answered.length}</small></b><span>right</span></div>
      <div class="chip"><img src="{import.meta.env.BASE_URL}game/icon-star.webp" alt="" /><b>{bestCombo}</b><span>in a row</span></div>
    </div>
    {#if daily}
      <div class="daily" class:won={o.dailyBeat} class:on={step >= 1}>
        <img src="{import.meta.env.BASE_URL}icons/daily.webp" alt="" />
        {#if o.dailyBeat}<span><b>Today's challenge beaten!</b> +{o.dailyShells} bonus shells</span>
        {:else if o.score >= dailyGoal(G.id)}<span><b>Challenge done today.</b> Come back tomorrow for a new one.</span>
        {:else}<span>Today's goal: <b>{fmt(dailyGoal(G.id))}</b>. {fmt(dailyGoal(G.id) - o.score)} to go: have another go!</span>{/if}
      </div>
    {/if}

    <div class="earned" class:on={step >= 2}>
      {#if o.treasure >= 0}
        <div class="prize" title={TREASURES[o.treasure].desc}>
          <img src="{import.meta.env.BASE_URL}treasures/{TREASURES[o.treasure].id}.webp" alt="" />
          <span><small>{o.newBestTreasure ? 'New best treasure!' : 'Found'}</small><b>{TREASURES[o.treasure].name}</b></span>
        </div>
      {/if}
      {#if shells}<div class="got"><img src="{import.meta.env.BASE_URL}game/icon-shell.webp" alt="" /><b>+{shells}</b><span>shells</span></div>{/if}
      <div class="got"><Icon name="heart" size={30} /><b>+{o.xp.gained}</b><span>friendship{#if o.xp.after.level > o.xp.before.level}<em>Level {o.xp.after.level}!</em>{/if}</span></div>
    </div>
    {#if step >= 3 && (o.medals.length || o.stickers.length || o.buddies.length || o.eggsReady.length)}
      <div class="news">
        {#each o.medals as m (m.id)}<span class="new medal"><Icon name="medal" size={20} />{m.name}</span>{/each}
        {#each o.stickers as s (s.id)}<span class="new sticker"><Icon name="sticker" size={20} />{s.name}</span>{/each}
        {#each o.buddies as b (b)}<span class="new buddy"><Icon name="heart" size={20} />{FRIEND[b].name} joined the team!</span>{/each}
        {#if o.eggsReady.length}<span class="new egg"><Icon name="gift" size={20} />An egg is ready to hatch!</span>{/if}
      </div>
    {/if}
    {#if step >= 3 && missed.length}
      <div class="practise"><b>Practise</b>{#each missed as f}<span>{f.a} {opOf(f)} {f.b} = <b>{ansOf(f)}</b></span>{/each}</div>
    {/if}
    <p class="next">{nextStar ? `Next star at ${fmt(nextStar)}. Every answer here counts as practice for your Fact Garden.` : 'All three stars! Every answer here counts as practice for your Fact Garden.'}</p>

    <div class="tiles">
      <NavTile size={compact ? 'md' : 'lg'} tone="mint" kind="redo" label="Play again" hotkey={compact ? undefined : 'space'} onclick={onagain} />
      <NavTile size={compact ? 'md' : 'lg'} tone="lilac" label="Arcade" onclick={onarcade}>
        {#snippet art()}<img class="tileart" src="{import.meta.env.BASE_URL}icons/arcade.webp" alt="" style:height={compact ? '52px' : '80px'} />{/snippet}
      </NavTile>
      <NavTile size={compact ? 'md' : 'lg'} tone="sky" kind="home" label="Home" onclick={onhome} />
    </div>
  </div>
  <Confetti {burst} x={50} y={30} />
</div>

<style>
  .res { position: absolute; inset: 0; z-index: 25; display: grid; place-items: center; padding: 16px; background: linear-gradient(90deg, rgba(40, 28, 70, 0) 0%, rgba(40, 28, 70, .25) 100%); overflow: auto; animation: fade-up .3s ease; }
  .card { width: min(640px, 100%); margin-left: auto; margin-right: 4%; padding: 20px 26px 18px; background: rgba(255, 255, 255, .97); border-radius: 30px; box-shadow: 0 30px 60px -24px rgba(40, 28, 70, .6), 0 0 0 4px rgba(255, 255, 255, .7); animation: pop-in .4s cubic-bezier(.3, .8, .4, 1.3); }
  .head { display: flex; align-items: center; gap: 18px; }
  .cab { width: 112px; flex: none; filter: drop-shadow(0 10px 12px rgba(40, 30, 90, .25)); transform: rotate(-4deg); }
  .ttl { flex: 1; min-width: 0; }
  .where { font: 800 12px/1 var(--font-body); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
  h1 { font-size: clamp(30px, 5vh, 42px); margin: 4px 0 0; }
  h1.best { color: #c25a00; text-shadow: 0 2px 0 #ffe7a8; }
  .score { font: 700 clamp(48px, 8vh, 72px)/1 var(--font-ui); color: var(--primary-edge); font-variant-numeric: tabular-nums; margin: 4px 0 2px; }
  .stars { min-height: 44px; }
  .chips { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 14px 0 0; opacity: 0; transform: translateY(8px); transition: all .35s; }
  .chip { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 6px; border-radius: 18px; background: var(--bg2); }
  .chip img { width: 26px; height: 26px; object-fit: contain; }
  .chip b { font: 600 26px/1 var(--font-ui); color: var(--ink); }
  .chip b small { font-size: 16px; color: var(--muted); }
  .chip span { font: 700 13px var(--font-body); color: var(--muted); display: flex; gap: 6px; align-items: center; }
  em { font-style: normal; font: 800 11px var(--font-body); color: #fff; background: #e0752a; padding: 2px 7px; border-radius: 999px; }
  .daily { display: flex; align-items: center; gap: 10px; margin-top: 10px; padding: 6px 14px 6px 6px; border-radius: 16px; background: #f6f1ff; box-shadow: inset 0 0 0 2px #e2d8ff; font: 700 14.5px/1.3 var(--font-body); color: var(--ink2); opacity: 0; transition: opacity .35s; }
  .daily.won { background: #fff6d8; box-shadow: inset 0 0 0 2px #ffd36b; color: #6b4300; }
  .daily img { width: 38px; height: 38px; object-fit: contain; flex: none; }
  .earned { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 12px; opacity: 0; transform: translateY(8px); transition: all .35s; }
  .on { opacity: 1 !important; transform: none !important; }
  .prize { display: flex; align-items: center; gap: 10px; padding: 4px 14px 4px 4px; border-radius: 18px; background: linear-gradient(#fffaf0, #ffefc6); box-shadow: 0 0 0 3px #ffd36b; }
  .prize img { width: 58px; height: 58px; object-fit: contain; filter: drop-shadow(0 4px 6px rgba(120, 80, 0, .3)); animation: pop-in .5s cubic-bezier(.3, .8, .4, 1.6); }
  .prize small { display: block; font: 800 11px var(--font-body); color: #a86a00; letter-spacing: .04em; text-transform: uppercase; }
  .prize b { font: 600 19px var(--font-ui); color: #6b4300; }
  .got { display: flex; align-items: center; gap: 6px; }
  .got img { width: 32px; height: 32px; object-fit: contain; }
  .got b { font: 600 24px var(--font-ui); color: var(--ink); }
  .got span { font: 700 13.5px var(--font-body); color: var(--muted); display: flex; gap: 6px; align-items: center; }
  .news { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .new { display: inline-flex; align-items: center; gap: 5px; padding: 4px 12px 4px 6px; border-radius: 999px; font: 700 13.5px var(--font-body); background: #efe9ff; color: #4a2ea8; animation: pop-in .35s cubic-bezier(.3, .8, .4, 1.5); }
  .new.sticker { background: #ffeaf2; color: #8a1f4a; }
  .new.buddy, .new.egg { background: #e2f7ee; color: #0f5a3c; }
  .practise { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 10px; font: 700 14px var(--font-body); }
  .practise > b { font: 600 17px var(--font-ui); margin-right: 2px; }
  .practise span { background: #fff7d6; border-radius: 10px; padding: 2px 8px; }
  .practise span b { font: 600 17px var(--font-ui); color: var(--primary-edge); }
  .next { margin: 10px 0 0; font: 600 13.5px/1.35 var(--font-body); color: var(--muted); }
  .tiles { display: flex; justify-content: center; align-items: flex-end; gap: 14px; margin-top: 14px; flex-wrap: wrap; }
  .tileart { width: auto; object-fit: contain; filter: drop-shadow(0 3px 3px rgba(60, 40, 10, .25)); }

  .compact { place-items: end center; padding: 10px; background: linear-gradient(rgba(40, 28, 70, 0) 30%, rgba(40, 28, 70, .3)); }
  .compact .card { margin: 0; padding: 14px 16px 14px; border-radius: 24px; }
  .compact .cab { width: 64px; }
  .compact .head { gap: 10px; }
  .compact .chips { gap: 6px; margin-top: 10px; }
  .compact .chip b { font-size: 20px; }
  .compact .chip span { font-size: 11.5px; }
  .compact .tiles { gap: 8px; margin-top: 10px; }
  .compact .next { font-size: 12.5px; }
</style>
