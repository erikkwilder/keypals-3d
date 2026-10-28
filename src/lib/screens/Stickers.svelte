<script lang="ts">
  import { onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { BUDDIES, FRIEND, type FriendId } from '../art/cast';
  import { MEDALS } from '../engine/achievements';
  import { RIDES, RIDE_SCORE } from '../engine/rides';
  import { STICKERS, MEDAL_TIERS, levelFromXp, medalTier, type StickerDef } from '../engine/stickers';
  import { palOf, teamOf } from '../engine/profile';
  import { renderSticker, renderMedal, TIER_LOOK } from '../art/stickerArt';
  import { sfx } from '../audio/sound';
  import Header from '../ui/Header.svelte';
  import Critter from '../ui/Critter.svelte';
  import StickerCard from '../ui/StickerCard.svelte';
  import { rideIcon } from '../art/vehicles';

  const p = $derived(game.profile!);
  const look = $derived(p.settings.look);
  let who = $state<FriendId>(game.profile!.buddy);
  let tab = $state<'stickers' | 'medals' | 'rides'>(game.stickerTab);
  let open = $state<StickerDef | null>(null);
  let tilt = $state({ x: 0, y: 0 });
  const pal = $derived(palOf(p, who));
  const th = $derived(p.settings.grown ? RIDE_SCORE.grown : RIDE_SCORE.kids);
  const SECTIONS: [string, (s: StickerDef) => boolean][] = [
    ['Journeys', s => s.id.startsWith('trip-')],
    ['Rides', s => s.id.startsWith('ride-')],
    ['Stars', s => s.id.startsWith('three-')],
    ['Clean typing', s => s.id.startsWith('clean') || s.id.startsWith('sharp')],
    ['Streaks', s => s.id.startsWith('streak-')],
    ['Speed', s => s.id.startsWith('speed-')],
    ['Friendship', s => s.id.startsWith('runs-') || s.id.startsWith('level-')],
    ['Words and keys', s => s.id.startsWith('chars-') || s.id.startsWith('own-') || s.id === 'fanclub'],
    ['Extras', s => s.id.startsWith('goal-') || s.id.startsWith('medals-') || s.id.startsWith('comeback') || s.id === 'sleepy'],
  ];
  const count = (id: FriendId) => Object.keys(palOf(p, id).stickers).length;
  let seenNow = $state<Set<string>>(new Set());
  onMount(() => markSeen());
  function markSeen() {
    const pp = palOf(p, who);
    seenNow = new Set(pp.seen.filter(s => s.startsWith('sticker:')).map(s => s.slice(8)));
    if (seenNow.size) game.update(x => { const q = teamOf(x); q.seen = q.seen.filter(s => !s.startsWith('sticker:')); });
  }
  function pickFriend(id: FriendId) { who = id; sfx.click(); markSeen(); }
  function view(s: StickerDef) { open = s; sfx.pop(); }
  function onTilt(e: PointerEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    tilt = { x: ((e.clientY - r.top) / r.height - 0.5) * -24, y: ((e.clientX - r.left) / r.width - 0.5) * 24 };
  }
  const fmt = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
</script>

<div class="screen book">
  <Header title="Sticker Book" sub="{FRIEND[who].name}: {Object.keys(pal.stickers).length} of {STICKERS.length}">
    {#snippet right()}
      <div class="tabs">
        <button class:on={tab === 'stickers'} onclick={() => (tab = 'stickers')}>Stickers</button>
        <button class:on={tab === 'medals'} onclick={() => (tab = 'medals')}>Medals</button>
        <button class:on={tab === 'rides'} onclick={() => (tab = 'rides')}>Rides</button>
      </div>
    {/snippet}
  </Header>

  <div class="crew">
    {#each BUDDIES as f (f.id)}
      {@const pp = palOf(p, f.id)}
      <button class="mate" class:on={who === f.id} onclick={() => pickFriend(f.id)}>
        <Critter friend={f.id} {look} accessory={pp.outfit} size={64} round />
        <span class="nm">{f.name}</span>
        <span class="ct">{count(f.id)}/{STICKERS.length}</span>
        <span class="lv" title="Friendship level">♥ {levelFromXp(pp.xp).level}</span>
      </button>
    {/each}
  </div>

  <div class="body scroll">
    {#if tab === 'stickers'}
      {#each SECTIONS as [title, test]}
        {@const list = STICKERS.filter(test)}
        <section>
          <h2>{title} <span class="muted">{list.filter(s => pal.stickers[s.id]).length}/{list.length}</span></h2>
          <div class="grid">
            {#each list as s (who + s.id)}
              <div class="slot">
                <StickerCard def={s} friend={who} {look} locked={!pal.stickers[s.id]} outfit={pal.outfit} isNew={seenNow.has(s.id)} onpick={() => view(s)} />
                <div class="cap" class:got={!!pal.stickers[s.id]}>{pal.stickers[s.id] ? s.name : s.desc}</div>
              </div>
            {/each}
          </div>
        </section>
      {/each}
    {:else if tab === 'medals'}
      <p class="intro">Medals level up as you win them again: Rose, Silver at 5, Gold at 15, Rainbow at 40. Your whole team shares them.</p>
      {#each [{ id: 'any', name: 'Every game', sub: 'won in typing or math' }, { id: 'typing', name: 'Typing', sub: 'from typing lessons' }, { id: 'math', name: 'Math', sub: 'from math trips' }] as grp (grp.id)}
        <h3 class="mgroup">{grp.name} <span>{grp.sub}</span></h3>
        <div class="medals">
        {#each MEDALS.filter(x => (x.game ?? 'typing') === grp.id) as m (who + m.id)}
          {@const n = pal.medals[m.id] ?? 0}
          {@const t = medalTier(n)}
          {@const next = MEDAL_TIERS[t + 1]}
          {@const tl = TIER_LOOK[Math.max(0, t)]}
          <div class="medal" class:got={n > 0}>
            <div class="art">{@html renderMedal(m, t, { locked: n === 0 })}</div>
            <b>{m.name}</b>
            <span class="tier" class:dark={n > 0 && tl.ink !== '#fff'} class:none={n === 0} style:background={n ? tl.pill : null}>{n ? `${tl.name} ×${n}` : 'Not yet'}</span>
            <span class="ds">{next ? (n ? `${next.at - n} more for ${TIER_LOOK[t + 1].name}` : m.desc) : 'Top tier!'}</span>
          </div>
        {/each}
      </div>
      {/each}
    {:else}
      <p class="intro">Type fast <b>and</b> clean and your ride gets an upgrade mid-lesson. {FRIEND[who].name}'s best: <b>{RIDES[pal.rideBest].name}</b>.</p>
      <div class="rides">
        {#each RIDES as r, i (who + r.id)}
          {@const unlocked = i <= pal.rideBest}
          <div class="ride card" class:open={unlocked}>
            <div class="rart"><svg viewBox="0 0 48 48">{@html rideIcon(i, unlocked ? '#7c5cf5' : '#d9d2e8')}</svg></div>
            <div class="rn">{r.name}</div>
            <div class="rd">{i === 0 ? 'Everyone starts here.' : unlocked ? 'Unlocked!' : `Reach a live score of about ${th[i]}. Clean streaks help!`}</div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  {#if open}
    {@const won = pal.stickers[open.id]}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal" onclick={() => (open = null)}>
      <div class="big" onpointermove={onTilt} onpointerleave={() => (tilt = { x: 0, y: 0 })} style:transform="perspective(700px) rotateX({tilt.x}deg) rotateY({tilt.y}deg)" onclick={(e) => e.stopPropagation()}>
        {@html renderSticker(open, who, look, { locked: !won, outfit: pal.outfit })}
        <div class="glare" style:background="radial-gradient(circle at {50 + tilt.y * 2}% {50 - tilt.x * 2}%, rgba(255,255,255,.45), transparent 50%)"></div>
      </div>
      <div class="info card" onclick={(e) => e.stopPropagation()}>
        <span class="rar {open.rarity}">{open.rarity}</span>
        <h3>{won ? open.name : 'Still to find'}</h3>
        <p>{open.desc}</p>
        {#if won}<p class="muted">Won {fmt(won)} with {FRIEND[who].name}</p>{/if}
        <button class="btn" onclick={() => (open = null)}>Close</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .book { display: flex; flex-direction: column; background: radial-gradient(circle at 10% 0%, #ffe6f2 0, transparent 35%), radial-gradient(circle at 90% 10%, #dff1ff 0, transparent 35%), var(--bg); }
  .tabs { display: flex; gap: 4px; background: var(--bg2); padding: 4px; border-radius: 999px; }
  .tabs button { border: 0; background: none; padding: 8px 16px; border-radius: 999px; font: 600 16px var(--font-ui); color: var(--muted); cursor: pointer; }
  .tabs button.on { background: #fff; color: var(--ink); box-shadow: var(--shadow-sm); }
  .crew { display: flex; gap: 8px; padding: 10px 20px; overflow-x: auto; background: rgba(255, 255, 255, .6); border-bottom: var(--panel-border); flex: none; }
  .mate { position: relative; flex: none; display: flex; flex-direction: column; align-items: center; width: 92px; padding: 4px 4px 8px; border-radius: 18px; border: 3px solid transparent; background: #fff; cursor: pointer; box-shadow: var(--shadow-sm); }
  .mate.on { border-color: var(--primary-hi); }
  .mate .nm { font: 600 14px var(--font-ui); }
  .mate .ct { font: 700 11px var(--font-body); color: var(--muted); }
  .mate .lv { position: absolute; top: 4px; left: 4px; font: 800 10px var(--font-body); background: var(--primary); color: #fff; padding: 2px 6px; border-radius: 999px; }
  .body { flex: 1; min-height: 0; padding: 14px 24px 40px; }
  section { margin-bottom: 18px; }
  h2 { font-size: 22px; margin: 8px 0 10px; }
  h2 .muted { font: 700 14px var(--font-body); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(138px, 1fr)); gap: 12px; }
  .slot { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; }
  .cap { font: 700 12px/1.25 var(--font-body); color: var(--muted); max-width: 140px; }
  .cap.got { color: var(--ink); font-size: 13px; }
  .intro { font: 600 16px var(--font-body); color: var(--ink2); margin: 4px 0 16px; }
  .mgroup { font-size: 22px; margin: 18px 0 8px; }
  .mgroup:first-of-type { margin-top: 4px; }
  .mgroup span { font: 700 14px var(--font-body); color: var(--muted); margin-left: 6px; }
  .medals { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; }
  .medal { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 4px; background: rgba(255, 255, 255, .6); border-radius: 20px; padding: 10px; }
  .medal.got { background: #fff; box-shadow: var(--shadow-sm); }
  .medal .art { width: 106px; height: 122px; transform-origin: 50% 0; }
  .medal.got .art { animation: swing 3.6s ease-in-out infinite; }
  @keyframes swing { 0%, 100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg); } }
  .medal .art :global(svg) { width: 100%; height: 100%; }
  .medal b { font: 600 16px var(--font-ui); }
  .tier { font: 800 11px var(--font-body); color: #fff; padding: 3px 9px; border-radius: 999px; text-shadow: 0 1px 0 rgba(0, 0, 0, .2); }
  .tier.dark { color: #3b2b4f; text-shadow: 0 1px 0 rgba(255, 255, 255, .5); }
  .tier.none { background: #e9e4f2; color: #8f84a6; text-shadow: none; }
  .ds { font-size: 12px; color: var(--muted); }
  .rides { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 16px; }
  .ride { padding: 8px 12px 14px; text-align: center; }
  .rart { height: 150px; display: grid; place-items: center; }
  .rart svg { width: 110px; height: 110px; }
  .ride:not(.open) .rart { filter: grayscale(1) brightness(1.15); opacity: .45; }
  .rn { font: 600 22px var(--font-ui); }
  .rd { font-size: 13px; color: var(--muted); }
  .modal { position: fixed; inset: 0; z-index: 50; background: rgba(40, 28, 70, .45); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; gap: 30px; animation: fade-up .2s ease; }
  .big { position: relative; width: min(380px, 44vw); height: min(380px, 44vw); transition: transform .08s linear; animation: pop-in .4s cubic-bezier(.3, .8, .4, 1.4); }
  .big :global(svg) { width: 100%; height: 100%; overflow: visible; }
  .glare { position: absolute; inset: 6%; border-radius: 30%; pointer-events: none; mix-blend-mode: overlay; }
  .info { width: 300px; padding: 22px; display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
  .info h3 { font-size: 28px; }
  .info p { margin: 0; color: var(--ink2); }
  .rar { font: 800 11px var(--font-body); text-transform: uppercase; letter-spacing: .1em; padding: 4px 10px; border-radius: 999px; color: #fff; }
  .rar.common { background: #a99fc4; } .rar.rare { background: #4f9fe0; } .rar.epic { background: linear-gradient(90deg, #b26cf0, #ff7fb8); } .rar.legendary { background: linear-gradient(90deg, #f5b800, #ff8fbf, #8f6cf5); }
</style>
