<script lang="ts">
  import { game } from '../state/game.svelte';
  import { outfitOf } from '../engine/profile';
  import type { Look } from '../art/cast';
  import { LAYOUT_LIST } from '../engine/layouts';
  import { TUNES, MUSIC_STYLES, sfx, melodyNote, resetMelody, type MusicStyleId } from '../audio/sound';
  import type { Settings } from '../engine/profile';
  import Header from '../ui/Header.svelte';
  import Critter from '../ui/Critter.svelte';
  import FingerCoach from '../ui/FingerCoach.svelte';
  import FancyAntButton from '../ui/FancyAntButton.svelte';
  import { LAYOUTS } from '../engine/layouts';
  import { homeDemo } from '../engine/demos';
  import { stage, graphicsPref, type GraphicsPref } from '../three/stage';

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
  const LOOKS: { id: Look; name: string; desc: string }[] = [
    { id: 'soft', name: 'Soft Squish', desc: 'Squishy and glowy' },
    { id: 'ink', name: 'Ink Sticker', desc: 'Bold outlines, candy colors' },
    { id: 'paper', name: 'Paper Craft', desc: 'Cut paper, storybook calm' },
    { id: 'geo', name: 'Geo Pop', desc: 'Clean shapes, bright pops' },
  ];
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
  function remove() {
    game.removePlayer(p.id);
    game.closeSettings();
    game.go(game.save.profiles.length ? 'players' : 'newPlayer');
  }
</script>

<div class="screen settings" class:overlay>
  <Header title="Settings" gear={false} sub="for {p.name}" {overlay} back={overlay ? () => game.closeSettings() : undefined} />
  <div class="body scroll">
    <section>
      <h2>Look</h2>
      <div class="looks">
        {#each LOOKS as l}
          <button class="look card" class:on={s.look === l.id} data-look={l.id} onclick={() => set('look', l.id)}>
            <Critter friend={p.buddy} look={l.id} accessory={outfitOf(p)} size={110} />
            <b>{l.name}</b><span>{l.desc}</span>
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
        <label class="row">Grown-up mode <input type="checkbox" checked={s.grown} onchange={(e) => set('grown', e.currentTarget.checked)} /></label>
        <p class="hint">Grown-up mode sets higher goal scores, longer lessons and higher ride speeds.</p>
        <label class="row">Ghost racer <input type="checkbox" checked={s.ghost !== false} onchange={(e) => set('ghost', e.currentTarget.checked)} /></label>
        <p class="hint">A see-through friend runs at three-star pace (or your best). Try to stay ahead!</p>
        {#if !s.grown}
          <label class="row">Easy mode <input type="checkbox" checked={!!s.easy} onchange={(e) => set('easy', e.currentTarget.checked)} /></label>
          <p class="hint">Stars need two thirds of the usual score. Good for younger typists.</p>
        {/if}
        <div class="row">Daily goal
          <div class="seg">
            {#each [5, 10, 15, 20, 30] as m}<button class:on={s.dailyGoalMin === m} onclick={() => set('dailyGoalMin', m)}>{m} min</button>{/each}
          </div>
        </div>
      </div>
      <div>
        <h2>Sound</h2>
        <label class="row">Sound effects <input type="checkbox" checked={s.sound} onchange={(e) => set('sound', e.currentTarget.checked)} /></label>
        <label class="row">Coach voice <input type="checkbox" checked={s.voice !== false} onchange={(e) => set('voice', e.currentTarget.checked)} /></label>
        <label class="row">Music <input type="checkbox" checked={s.music} onchange={(e) => set('music', e.currentTarget.checked)} /></label>
        {#if s.music}
          <div class="row">Music style
            <div class="seg wrap">
              {#each Object.entries(MUSIC_STYLES) as [id, st]}<button class:on={(s.musicStyle ?? 'sunny') === id} onclick={() => set('musicStyle', id as MusicStyleId)}>{st.name}</button>{/each}
              <button class:on={s.musicStyle === 'mix'} onclick={() => set('musicStyle', 'mix')}>Mix</button>
            </div>
          </div>
          <p class="hint">Tap a style to hear it now. Mix plays a different style in each lesson.</p>
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
        <button class="btn danger" onclick={() => (confirmDelete = true)}>Delete this player</button>
      {:else}
        <div class="row warn">Delete {p.name} and all their stars and stickers? <button class="btn" onclick={() => (confirmDelete = false)}>Keep</button><button class="btn danger" onclick={remove}>Yes, delete</button></div>
      {/if}
    </section>
    <section class="about">
      <img src="brand/ant.png" alt="The FancyAnt ant" width="74" height="112" />
      <div>
        <h2>Made by FancyAnt Games</h2>
        <p class="hint">Keypals is free, has no ads and is open source. We make other small, friendly games too.</p>
        <FancyAntButton />
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
  .look { display: flex; flex-direction: column; align-items: center; padding: 14px 10px; cursor: pointer; border: 3px solid transparent; font: inherit; color: inherit; transition: transform .12s; }
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
</style>
