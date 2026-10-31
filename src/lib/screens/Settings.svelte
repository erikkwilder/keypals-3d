<script lang="ts">
  // Settings: how the game feels for the child playing. The Look (how the 3D buddy is drawn everywhere,
  // with a small drawn star on each card to show the difference), typing help (keyboard layout, hints,
  // finger demos, the keyboard and hands, the ghost racer), sound and music, and comfort (font, less motion,
  // graphics). No grown-up check, so the test for what stays here is: it can't lose anything and it can't
  // change a rule. Anything that fails that (names, deleting a player, goals, play time, saving) is in
  // Grown-ups. A class's sound-off greys the sound switches here.
  import { game } from '../state/game.svelte';
  import LookEmblem from '../ui/LookEmblem.svelte';
  import type { Look } from '../art/cast';
  import { LAYOUT_LIST } from '../engine/layouts';
  import { TUNES, sfx, melodyNote, resetMelody } from '../audio/sound';
  import { STATION } from '../audio/stations';
  import type { Settings } from '../engine/profile';
  import Header from '../ui/Header.svelte';
  import FingerCoach from '../ui/FingerCoach.svelte';
  import { LAYOUTS } from '../engine/layouts';
  import { homeDemo } from '../engine/demos';
  import { stage, graphicsPref, type GraphicsPref } from '../three/stage';

  let { overlay = false }: { overlay?: boolean } = $props();
  const p = $derived(game.profile!);
  const s = $derived(game.settings);
  /** a class turned sound off */
  const quiet = $derived(game.quiet);
  let showHome = $state(false);
  // graphics belong to this computer, not the player
  let gpref = $state<GraphicsPref>(graphicsPref());
  let smoothNow = $state(stage.smooth);
  function setGraphics(p: GraphicsPref) { stage.setPref(p); gpref = p; smoothNow = stage.smooth; sfx.click(); }

  function set<K extends keyof Settings>(k: K, v: Settings[K]) {
    game.update(pp => { pp.settings[k] = v; });
    sfx.click();
  }
  // the Looks: how the 3D buddy is drawn everywhere (three/looks.ts): each card says what it does and shows
  // it on a small star (ui/LookEmblem.svelte), because the buddy itself changes too little to tell them apart
  const LOOKS: { id: Look; name: string; desc: string }[] = [
    { id: 'soft', name: 'Soft Squish', desc: 'Smooth and glowing, no outline' },
    { id: 'ink', name: 'Ink Sticker', desc: 'A thick dark outline, like a sticker' },
    { id: 'paper', name: 'Paper Craft', desc: 'Flat colour with a cream paper edge' },
    { id: 'geo', name: 'Geo Pop', desc: 'Flat facets and sharp folds' },
  ];
  const FONTS: { id: Settings['font']; name: string; family: string }[] = [
    { id: 'fredoka', name: 'Bubbly', family: 'Fredoka' },
    { id: 'atkinson', name: 'Extra clear', family: 'Atkinson Hyperlegible' },
    { id: 'lexend', name: 'Easy reading', family: 'Lexend' },
    { id: 'opendyslexic', name: 'Dyslexia friendly', family: 'OpenDyslexic' },
  ];
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
            <span class="lpic"><LookEmblem look={l.id} /></span>
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
        <div class="row">Home row lesson <button class="btn" onclick={() => (showHome = true)}>Watch again</button></div>
      </div>
      <div>
        <h2>Sound</h2>
        {#if quiet}<p class="hint told">Your teacher turned this off.</p>{/if}
        <label class="row" class:grey={quiet}>Sound effects <input type="checkbox" disabled={quiet} checked={s.sound} onchange={(e) => set('sound', e.currentTarget.checked)} /></label>
        <label class="row" class:grey={quiet}>Coach voice <input type="checkbox" disabled={quiet} checked={s.voice !== false} onchange={(e) => set('voice', e.currentTarget.checked)} /></label>
        <label class="row" class:grey={quiet}>Music <input type="checkbox" disabled={quiet} checked={s.music} onchange={(e) => set('music', e.currentTarget.checked)} /></label>
        {#if s.music}
          <div class="row">Music
            <button class="musicpick" onclick={() => { sfx.click(); game.openMusic(); }}><img src="{import.meta.env.BASE_URL}icons/music/{s.musicStation && s.musicStation !== 'auto' ? s.musicStation : 'happy'}.webp" alt="" /><span>{s.musicStation && s.musicStation !== 'auto' ? STATION[s.musicStation].name : 'Auto'}</span><b>Pick your music</b></button>
          </div>
          <p class="hint">Calm, happy, adventure, rock, electronic, retro and more, or Keypals Originals. You can switch any time from the Menu.</p>
        {/if}
        <label class="row" class:grey={quiet}>Volume <input type="range" min="0" max="1" step="0.05" disabled={quiet} value={s.volume} oninput={(e) => game.update(pp => { pp.settings.volume = +e.currentTarget.value; })} /></label>
        <label class="row" class:grey={quiet}>Melody keys <input type="checkbox" disabled={quiet} checked={s.melody} onchange={(e) => set('melody', e.currentTarget.checked)} /></label>
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
        <label class="row">Less motion <input type="checkbox" checked={s.reducedMotion} onchange={(e) => set('reducedMotion', e.currentTarget.checked)} /></label>
        <div class="row">Graphics
          <div class="seg">
            <button class:on={gpref === 'auto'} onclick={() => setGraphics('auto')}>Auto</button>
            <button class:on={gpref === 'full'} onclick={() => setGraphics('full')}>Full</button>
            <button class:on={gpref === 'smooth'} onclick={() => setGraphics('smooth')}>Smooth</button>
          </div>
        </div>
        <p class="hint">Smooth mode keeps the game running well on older computers: fewer details and a steadier picture. Auto switches to it by itself when this computer needs it. This changes it for every player on this computer.{#if gpref === 'auto'} (Now: {smoothNow ? 'smooth' : 'full'}.){/if}</p>
      </div>
    </section>

  </div>
</div>
{#if showHome}<FingerCoach steps={homeDemo(LAYOUTS[s.layout])} title="Home row" layout={LAYOUTS[s.layout]} look={s.look} onDone={() => (showHome = false)} />{/if}

<style>
  .settings { display: flex; flex-direction: column; background: var(--bg); }
  .body { flex: 1; min-height: 0; padding: 20px 26px 50px; }
  section { margin-bottom: 28px; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 34px; }
  h2 { font-size: 24px; margin: 0 0 12px; }
  .looks { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
  .look { position: relative; display: flex; flex-direction: column; align-items: center; padding: 10px 10px 12px; cursor: pointer; border: 3px solid transparent; font: inherit; color: inherit; transition: transform .12s; }
  .lpic { display: block; width: 104px; height: 104px; padding: 6px; box-sizing: border-box; border-radius: 20px; background: #bfe0fb; margin-bottom: 6px; }
  .lon { position: absolute; top: 8px; right: 8px; font: 800 11px var(--font-body); font-style: normal; color: #fff; background: var(--primary); padding: 2px 8px; border-radius: 999px; }
  .lookhint { margin: -8px 0 10px; }
  .look:hover { transform: translateY(-2px); }
  .look.on { border-color: var(--primary-hi); }
  .look b { font: 600 19px var(--font-ui); }
  .look span { font-size: 13px; color: var(--muted); }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--line); font: 700 16px var(--font-body); }
  .row input[type='checkbox'] { width: 22px; height: 22px; accent-color: var(--primary); }
  .row input[type='range'] { width: 180px; accent-color: var(--primary); }
  select { padding: 8px 12px; border-radius: 12px; border: 2px solid var(--line); background: #fff; font: 600 16px var(--font-body); }
  .seg { display: flex; gap: 4px; background: var(--bg2); padding: 4px; border-radius: 14px; }
  .seg.wrap { flex-wrap: wrap; justify-content: flex-end; }
  .seg button { border: 0; background: none; padding: 7px 10px; border-radius: 10px; font: 700 13px var(--font-body); color: var(--muted); cursor: pointer; }
  .seg button.on { background: #fff; color: var(--ink); box-shadow: var(--shadow-sm); }
  .hint { margin: 6px 0 4px; font-size: 13px; color: var(--muted); }
  .told { color: #8a4a00; font-weight: 700; }
  .grey { color: var(--muted); }
  .fonts { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 8px; }
  .font { display: flex; flex-direction: column; align-items: center; padding: 10px 6px; background: #fff; border: 3px solid transparent; border-radius: 14px; cursor: pointer; box-shadow: var(--shadow-sm); }
  .font.on { border-color: var(--primary-hi); }
  .font b { font-size: 28px; font-weight: 700; }
  .font span { font-size: 12px; color: var(--muted); font-family: var(--font-body); }
  .musicpick { display: inline-flex; align-items: center; gap: 8px; border: 0; border-radius: 999px; padding: 4px 14px 4px 4px; background: #f4efff; cursor: pointer; font: 700 15px var(--font-body); color: var(--ink2); box-shadow: inset 0 0 0 2px #e2d8ff; }
  .musicpick img { width: 34px; height: 34px; object-fit: contain; }
  .musicpick b { color: var(--primary); }
  /* phones: one column, the Looks two by two */
  @media (max-width: 760px) {
    .body { padding: 14px 12px 40px; }
    .cols { grid-template-columns: 1fr; gap: 10px; }
    .looks { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .lpic { width: 88px; height: 88px; }
    .look b { font-size: 17px; } .look span { font-size: 12px; text-align: center; }
    .fonts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .row { flex-wrap: wrap; }
  }
</style>
