<script lang="ts">
  // Settings: the player's own things, the ones a child picks. The Look (how the 3D buddy is drawn
  // everywhere, with a picture of each on its card), typing help (keyboard layout, hints, finger demos, the
  // keyboard and hands, the ghost racer), sound and music, comfort (font, less motion, graphics) and the
  // player's name. Grown-up choices (the daily goal, grown-up and easy mode, play time, saving online,
  // privacy) are in Grown-ups, behind the grown-up check; deleting a player stays here behind that check.
  import { game } from '../state/game.svelte';
  import { buddyPicture } from '../three/buddyPic';
  import { dressOf } from '../adventure/wardrobe';
  import { outfitOf } from '../engine/profile';
  import type { Look } from '../art/cast';
  import { LAYOUT_LIST } from '../engine/layouts';
  import { TUNES, sfx, melodyNote, resetMelody } from '../audio/sound';
  import { STATION } from '../audio/stations';
  import type { Settings } from '../engine/profile';
  import Header from '../ui/Header.svelte';
  import Critter from '../ui/Critter.svelte';
  import FingerCoach from '../ui/FingerCoach.svelte';
  import FancyAntButton from '../ui/FancyAntButton.svelte';
  import { LAYOUTS } from '../engine/layouts';
  import { homeDemo } from '../engine/demos';
  import { stage, graphicsPref, type GraphicsPref } from '../three/stage';
  import GrownupGate from '../ui/GrownupGate.svelte';
  import { cloud, inAccount, deleteEverywhere, deleteHereOnly } from '../state/cloud.svelte';

  let { overlay = false }: { overlay?: boolean } = $props();
  const p = $derived(game.profile!);
  const s = $derived(p.settings);
  let confirmDelete = $state(false);
  let showHome = $state(false);
  // graphics belong to this computer, not the player
  let gpref = $state<GraphicsPref>(graphicsPref());
  let smoothNow = $state(stage.smooth);
  function setGraphics(p: GraphicsPref) { stage.setPref(p); gpref = p; smoothNow = stage.smooth; sfx.click(); }
  let newName = $state(game.profile?.name ?? '');

  function set<K extends keyof Settings>(k: K, v: Settings[K]) {
    game.update(pp => { pp.settings[k] = v; });
    sfx.click();
  }
  // the Looks: how the 3D buddy is drawn everywhere (three/looks.ts), each card with a picture of your buddy in it
  const LOOKS: { id: Look; name: string; desc: string }[] = [
    { id: 'soft', name: 'Soft Squish', desc: 'Soft and glowy, just as made' },
    { id: 'ink', name: 'Ink Sticker', desc: 'A bold outline, like a sticker' },
    { id: 'paper', name: 'Paper Craft', desc: 'Matte paper with a cut edge' },
    { id: 'geo', name: 'Geo Pop', desc: 'Folded shapes, bright edges' },
  ];
  let lookPics = $state<Partial<Record<Look, string>>>({});
  $effect(() => {
    const id = p.buddy, dress = JSON.parse(JSON.stringify(dressOf(p)));
    let gone = false;
    for (const l of LOOKS) void buddyPicture(id, { dress, look: l.id, size: 264, frame: 'bust' }).then(u => { if (!gone && u) lookPics = { ...lookPics, [l.id]: u }; });
    return () => { gone = true; };
  });
  const FONTS: { id: Settings['font']; name: string; family: string }[] = [
    { id: 'fredoka', name: 'Bubbly', family: 'Fredoka' },
    { id: 'atkinson', name: 'Extra clear', family: 'Atkinson Hyperlegible' },
    { id: 'lexend', name: 'Easy reading', family: 'Lexend' },
    { id: 'opendyslexic', name: 'Dyslexia friendly', family: 'OpenDyslexic' },
  ];
  function rename() {
    const n = newName.trim().slice(0, 16);
    if (n) game.update(pp => { pp.name = n; });
    game.say('Name saved');
  }
  // deleting a player: behind the grown-up check; a player kept in the signed-in grown-up's account can go
  // everywhere (every computer) or from this computer only
  let gate = $state(false);
  let delBusy = $state(false);
  let delMsg = $state<string | null>(null);
  const everywhereAsk = $derived(!!cloud.account && inAccount(p));
  function leave() {
    game.closeSettings();
    game.go(game.save.profiles.length ? 'players' : 'newPlayer');
  }
  function remove() {
    // (a player with a save code is remembered as "not on this computer", so signing in later doesn't
    // bring it back here; it can be added again on the Grown-ups screen)
    deleteHereOnly(p.id);
    leave();
  }
  function removeHereOnly() { deleteHereOnly(p.id); leave(); }
  async function removeEverywhere() {
    delBusy = true; delMsg = null;
    try { const name = p.name; await deleteEverywhere(p.id); leave(); game.say(`${name} was deleted from your account and every computer.`, 5000); }
    catch (e) { delMsg = (e as Error).message; }
    finally { delBusy = false; }
  }
</script>

<div class="screen settings" class:overlay>
  <Header title="Settings" {overlay} back={overlay ? () => game.closeSettings() : undefined} />
  <div class="body scroll">
    <section>
      <h2>Look</h2>
      <p class="hint lookhint">How your buddy is drawn, everywhere in the game.</p>
      <div class="looks">
        {#each LOOKS as l}
          <button class="look card" class:on={s.look === l.id} data-look={l.id} aria-pressed={s.look === l.id} onclick={() => set('look', l.id)}>
            <span class="lpic">{#if lookPics[l.id]}<img src={lookPics[l.id]} alt="" />{:else}<span class="lwait"><Critter friend={p.buddy} look={l.id} accessory={outfitOf(p)} size={110} /></span>{/if}</span>
            <b>{l.name}</b><span>{l.desc}</span>
            {#if s.look === l.id}<em class="lon">Your look</em>{/if}
          </button>
        {/each}
      </div>
    </section>

    <section class="cols">
      <div>
        <h2>Typing</h2>
        <label class="row">Keyboard layout
          <select value={s.layout} onchange={(e) => set('layout', (e.currentTarget as HTMLSelectElement).value as Settings['layout'])}>
            {#each LAYOUT_LIST as l}<option value={l.id}>{l.name}</option>{/each}
          </select>
        </label>
        <div class="row">Hints
          <div class="seg">
            <button class:on={s.hints === 'auto'} onclick={() => set('hints', 'auto')}>Fade as I learn</button>
            <button class:on={s.hints === 'always'} onclick={() => set('hints', 'always')}>Always</button>
            <button class:on={s.hints === 'off'} onclick={() => set('hints', 'off')}>Off</button>
          </div>
        </div>
        <div class="row">Finger demos
          <div class="seg">
            <button class:on={(s.demos ?? 'auto') === 'auto'} onclick={() => set('demos', 'auto')}>New keys</button>
            <button class:on={s.demos === 'always'} onclick={() => set('demos', 'always')}>Every lesson</button>
            <button class:on={s.demos === 'off'} onclick={() => set('demos', 'off')}>Off</button>
          </div>
        </div>
        <p class="hint">The coach shows where each finger goes before lessons with new keys. You can always skip, or press "Watch how" to see it again.</p>
        <label class="row">Show the keyboard <input type="checkbox" checked={s.keyboard} onchange={(e) => set('keyboard', e.currentTarget.checked)} /></label>
        <label class="row">Show the hands <input type="checkbox" checked={s.hands} onchange={(e) => set('hands', e.currentTarget.checked)} /></label>
        <label class="row">Ghost racer <input type="checkbox" checked={s.ghost !== false} onchange={(e) => set('ghost', e.currentTarget.checked)} /></label>
        <p class="hint">A see-through friend runs at three-star pace (or your best). Try to stay ahead!</p>
        <div class="row grownrow"><span>Daily goal ({s.dailyGoalMin} min){s.grown ? ', grown-up mode' : s.easy ? ', easy mode' : ''}<small>A grown-up sets these in Grown-ups.</small></span><button class="btn" onclick={() => { game.closeSettings(); game.openGrownups('time'); }}><img src="{import.meta.env.BASE_URL}icons/grownups.webp" alt="" />Grown-ups</button></div>
      </div>
      <div>
        <h2>Sound</h2>
        <label class="row">Sound effects <input type="checkbox" checked={s.sound} onchange={(e) => set('sound', e.currentTarget.checked)} /></label>
        <label class="row">Coach voice <input type="checkbox" checked={s.voice !== false} onchange={(e) => set('voice', e.currentTarget.checked)} /></label>
        <label class="row">Music <input type="checkbox" checked={s.music} onchange={(e) => set('music', e.currentTarget.checked)} /></label>
        {#if s.music}
          <div class="row">Music
            <button class="musicpick" onclick={() => { sfx.click(); game.openMusic(); }}><img src="{import.meta.env.BASE_URL}icons/music/{s.musicStation && s.musicStation !== 'auto' ? s.musicStation : 'happy'}.webp" alt="" /><span>{s.musicStation && s.musicStation !== 'auto' ? STATION[s.musicStation].name : 'Auto'}</span><b>Pick your music</b></button>
          </div>
          <p class="hint">Calm, happy, adventure, rock, electronic, retro and more, or Keypals Originals. You can switch any time with the music button.</p>
        {/if}
        <label class="row">Volume <input type="range" min="0" max="1" step="0.05" value={s.volume} oninput={(e) => game.update(pp => { pp.settings.volume = +e.currentTarget.value; })} /></label>
        <label class="row">Melody keys <input type="checkbox" checked={s.melody} onchange={(e) => set('melody', e.currentTarget.checked)} /></label>
        <p class="hint">Every right key plays the next note of a song.</p>
        {#if s.melody}
          <div class="row">Song
            <div class="seg wrap">
              {#each Object.entries(TUNES) as [id, t]}<button class:on={s.tune === id} onclick={() => { set('tune', id); resetMelody(id); for (let i = 0; i < 4; i++) setTimeout(melodyNote, i * 260); }}>{t.name}</button>{/each}
            </div>
          </div>
        {/if}
        <h2>Comfort</h2>
        <div class="fonts">
          {#each FONTS as f}
            <button class="font" class:on={s.font === f.id} style:font-family={f.family} onclick={() => set('font', f.id)}><b>Aa</b><span>{f.name}</span></button>
          {/each}
        </div>
        <div class="row">Home row lesson <button class="btn" onclick={() => (showHome = true)}>Watch again</button></div>
        <label class="row">Less motion <input type="checkbox" checked={s.reducedMotion} onchange={(e) => set('reducedMotion', e.currentTarget.checked)} /></label>
        <div class="row">Graphics
          <div class="seg">
            <button class:on={gpref === 'auto'} onclick={() => setGraphics('auto')}>Auto</button>
            <button class:on={gpref === 'full'} onclick={() => setGraphics('full')}>Full</button>
            <button class:on={gpref === 'smooth'} onclick={() => setGraphics('smooth')}>Smooth</button>
          </div>
        </div>
        <p class="hint">Smooth mode keeps the game running well on older computers: fewer details and a steadier picture. Auto switches to it by itself when this computer needs it.{#if gpref === 'auto'} (Now: {smoothNow ? 'smooth' : 'full'}.){/if}</p>
      </div>
    </section>

    <section>
      <h2>Player</h2>
      <div class="row">Name <input class="txt" bind:value={newName} maxlength="16" /> <button class="btn" onclick={rename}>Save</button></div>
      {#if !confirmDelete}
        <button class="btn danger" onclick={() => (gate = true)}>Delete this player</button>
      {:else if everywhereAsk}
        <div class="warn ask">
          <p><b>Delete {p.name} everywhere, or just from this computer?</b></p>
          <p class="hint">Everywhere: {p.name} and all their stars and stickers are deleted from your account and from every computer it's on. Just this computer: {p.name} stays in your account and won't come back here unless you add them again on the Grown-ups screen.</p>
          <div class="btns">
            <button class="btn" onclick={() => (confirmDelete = false)}>Keep</button>
            <button class="btn" disabled={delBusy} onclick={removeHereOnly}>Just this computer</button>
            <button class="btn danger" disabled={delBusy} onclick={removeEverywhere}>Delete everywhere</button>
          </div>
          {#if delMsg}<p class="hint">{delMsg}</p>{/if}
        </div>
      {:else}
        <div class="row warn">Delete {p.name} and all their stars and stickers? <button class="btn" onclick={() => (confirmDelete = false)}>Keep</button><button class="btn danger" onclick={remove}>Yes, delete</button></div>
      {/if}
      {#if gate}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="gbg" onclick={() => (gate = false)}>
          <div class="gcard card" onclick={(e) => e.stopPropagation()}>
            <GrownupGate title="Deleting a player" note="A quick check that you're a grown-up." onpass={() => { gate = false; confirmDelete = true; }} />
            <button class="btn btn-ghost" onclick={() => (gate = false)}>Not now</button>
          </div>
        </div>
      {/if}
    </section>
    <section class="about">
      <img src="brand/ant.png" alt="The FancyAnt ant" width="74" height="112" />
      <div>
        <h2>Made by FancyAnt Games</h2>
        <p class="hint">Keypals is free, with no ads and no tracking. What it is, how it's made and how to reach us:</p>
        <div class="abtns"><button class="btn btn-primary" onclick={() => { game.closeSettings(); game.openAbout(); }}>About Keypals</button><FancyAntButton /></div>
      </div>
    </section>
  </div>
</div>
{#if showHome}<FingerCoach steps={homeDemo(LAYOUTS[s.layout])} title="Home row" layout={LAYOUTS[s.layout]} look={s.look} onDone={() => (showHome = false)} />{/if}

<style>
  .settings { display: flex; flex-direction: column; background: var(--bg); }
  .body { flex: 1; min-height: 0; padding: 20px 26px 50px; }
  section { margin-bottom: 28px; }
  .about { display: flex; align-items: center; gap: 18px; padding: 16px 20px; border-radius: 22px; background: linear-gradient(135deg, #f2f9ff, #f6f1ff); }
  .about img { flex: none; width: 74px; height: auto; }
  .about p { margin: 4px 0 10px; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 34px; }
  h2 { font-size: 24px; margin: 0 0 12px; }
  .looks { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
  .look { position: relative; display: flex; flex-direction: column; align-items: center; padding: 10px 10px 12px; cursor: pointer; border: 3px solid transparent; font: inherit; color: inherit; transition: transform .12s; }
  .lpic { display: grid; place-items: end center; width: 132px; height: 132px; border-radius: 20px; background: radial-gradient(circle at 50% 40%, #fff, #eef3fb); margin-bottom: 6px; overflow: hidden; }
  .lpic img { width: 132px; height: 132px; object-fit: contain; object-position: bottom; }
  .lwait { opacity: .35; }
  .lon { position: absolute; top: 8px; right: 8px; font: 800 11px var(--font-body); font-style: normal; color: #fff; background: var(--primary); padding: 2px 8px; border-radius: 999px; }
  .lookhint { margin: -8px 0 10px; }
  .grownrow span { display: flex; flex-direction: column; }
  .grownrow small { font: 600 13px var(--font-body); color: var(--muted); }
  .grownrow .btn { display: inline-flex; align-items: center; gap: 6px; flex: none; }
  .grownrow img { width: 26px; height: 26px; object-fit: contain; }
  .abtns { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
  .look:hover { transform: translateY(-2px); }
  .look.on { border-color: var(--primary-hi); }
  .look b { font: 600 19px var(--font-ui); }
  .look span { font-size: 13px; color: var(--muted); }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--line); font: 700 16px var(--font-body); }
  .row input[type='checkbox'] { width: 22px; height: 22px; accent-color: var(--primary); }
  .row input[type='range'] { width: 180px; accent-color: var(--primary); }
  select, .txt { padding: 8px 12px; border-radius: 12px; border: 2px solid var(--line); background: #fff; font: 600 16px var(--font-body); }
  .txt { flex: 1; max-width: 260px; }
  .seg { display: flex; gap: 4px; background: var(--bg2); padding: 4px; border-radius: 14px; }
  .seg.wrap { flex-wrap: wrap; justify-content: flex-end; }
  .seg button { border: 0; background: none; padding: 7px 10px; border-radius: 10px; font: 700 13px var(--font-body); color: var(--muted); cursor: pointer; }
  .seg button.on { background: #fff; color: var(--ink); box-shadow: var(--shadow-sm); }
  .hint { margin: 6px 0 4px; font-size: 13px; color: var(--muted); }
  .fonts { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 8px; }
  .font { display: flex; flex-direction: column; align-items: center; padding: 10px 6px; background: #fff; border: 3px solid transparent; border-radius: 14px; cursor: pointer; box-shadow: var(--shadow-sm); }
  .font.on { border-color: var(--primary-hi); }
  .font b { font-size: 28px; font-weight: 700; }
  .font span { font-size: 12px; color: var(--muted); font-family: var(--font-body); }
  .danger { color: #c0396f; }
  .warn { color: #c0396f; }
  .ask { padding: 12px 14px; border-radius: 16px; background: #fff3f6; box-shadow: inset 0 0 0 2px #ffd3df; }
  .ask p { margin: 0 0 6px; }
  .ask .btns { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
  .gbg { position: fixed; inset: 0; z-index: 90; background: rgba(40, 28, 70, .45); display: grid; place-items: center; padding: 16px; }
  .gcard { width: min(520px, 100%); padding: 10px 16px 16px; display: flex; flex-direction: column; align-items: center; }
  .musicpick { display: inline-flex; align-items: center; gap: 8px; border: 0; border-radius: 999px; padding: 4px 14px 4px 4px; background: #f4efff; cursor: pointer; font: 700 15px var(--font-body); color: var(--ink2); box-shadow: inset 0 0 0 2px #e2d8ff; }
  .musicpick img { width: 34px; height: 34px; object-fit: contain; }
  .musicpick b { color: var(--primary); }
  /* phones: one column, the Looks two by two */
  @media (max-width: 760px) {
    .body { padding: 14px 12px 40px; }
    .cols { grid-template-columns: 1fr; gap: 10px; }
    .looks { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .lpic, .lpic img { width: 112px; height: 112px; }
    .look b { font-size: 17px; } .look span { font-size: 12px; text-align: center; }
    .fonts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .row { flex-wrap: wrap; }
  }
</style>
