<script lang="ts">
  import { game } from '../state/game.svelte';
  import { outfitOf } from '../engine/profile';
  import { ALL_LESSONS } from '../engine/course';
  import { dayKey, migrate, totalStars, type Profile } from '../engine/profile';
  import { mastery } from '../engine/mastery';
  import { LAYOUTS } from '../engine/layouts';
  import { RIDES } from '../engine/rides';
  import { GAME_NAME, SOURCE_URL, STUDIO, STUDIO_URL } from '../config';
  import { openExternal, saveTextFile } from '../state/platform';
  import Header from '../ui/Header.svelte';
  import Critter from '../ui/Critter.svelte';

  let unlocked = $state(false);
  let holding = $state(0);
  let holdTimer: ReturnType<typeof setInterval> | undefined;
  function startHold() {
    clearInterval(holdTimer);
    holding = 0;
    holdTimer = setInterval(() => {
      holding += 0.05;
      if (holding >= 1) { clearInterval(holdTimer); unlocked = true; }
    }, 100);
  }
  function stopHold() { clearInterval(holdTimer); if (!unlocked) holding = 0; }

  let selected = $state(game.profile?.id ?? game.save.profiles[0]?.id ?? '');
  const p = $derived<Profile | undefined>(game.save.profiles.find(x => x.id === selected));
  let words = $state(game.save.profiles.find(x => x.id === selected)?.customText ?? '');
  $effect(() => { words = p?.customText ?? ''; });

  const passedCount = $derived(p ? ALL_LESSONS.filter(l => (p.lessons[l.id]?.stars ?? 0) > 0).length : 0);
  const hist = $derived(p ? p.history.slice(-30) : []);
  const avgWpm = $derived(hist.length ? hist.reduce((a, h) => a + h.wpm, 0) / hist.length : 0);
  const avgAcc = $derived(hist.length ? hist.reduce((a, h) => a + h.acc, 0) / hist.length : 0);
  const days = $derived.by(() => {
    const out: { key: string; label: string; min: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const t = Date.now() - i * 86400000;
      const k = dayKey(t);
      out.push({ key: k, label: new Date(t).toLocaleDateString(undefined, { weekday: 'narrow' }), min: Math.round((p?.days[k]?.ms ?? 0) / 60000) });
    }
    return out;
  });
  const maxMin = $derived(Math.max(p?.settings.dailyGoalMin ?? 10, ...days.map(d => d.min)));
  const layout = $derived(LAYOUTS[p?.settings.layout ?? 'qwerty']);
  const sparkPts = $derived.by(() => {
    if (hist.length < 2) return '';
    const max = Math.max(...hist.map(h => h.wpm), 10);
    return hist.map((h, i) => `${(i / (hist.length - 1)) * 300},${90 - (h.wpm / max) * 80}`).join(' ');
  });
  function heat(ch: string) {
    if (!p) return '#f3f0f8';
    const k = p.keys[ch];
    if (!k || k.n < 4) return '#f3f0f8';
    const m = mastery(k, p.settings.grown);
    return `hsl(${Math.round(m * 140)} 70% ${78 - m * 8}%)`;
  }
  function saveWords() {
    game.save.profiles.forEach(x => { if (x.id === selected) x.customText = words.slice(0, 3000); });
    game.persist();
    game.say('Word list saved. It shows up as "My Words" on the Open Road.');
  }
  async function exportSave() {
    const ok = await saveTextFile(`${GAME_NAME.toLowerCase().replace(/\s+/g, '-')}-progress.json`, JSON.stringify($state.snapshot(game.save), null, 1));
    if (ok) game.say('Progress saved to a file.');
  }
  let fileInput: HTMLInputElement | undefined = $state();
  async function importSave(e: Event) {
    const f = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!f) return;
    try {
      const data = migrate(JSON.parse(await f.text()));
      if (!data.profiles.length) throw new Error('empty');
      const ids = new Set(game.save.profiles.map(x => x.id));
      for (const pr of data.profiles) { if (ids.has(pr.id)) game.save.profiles = game.save.profiles.map(x => (x.id === pr.id ? pr : x)); else game.save.profiles.push(pr); }
      game.persist();
      game.say(`Loaded ${data.profiles.length} player(s).`);
    } catch {
      game.say('That file did not look like saved progress.');
    }
  }
  const fmtMin = (ms: number) => (ms < 3600000 ? `${Math.round(ms / 60000)} min` : `${(ms / 3600000).toFixed(1)} h`);
</script>

<div class="screen gu">
  <Header title="Grown-ups" back={() => game.go(game.profile ? 'map' : 'players')} />
  {#if !unlocked}
    <div class="gate">
      <h2>For parents and teachers</h2>
      <p class="muted">Press and hold the button to open.</p>
      <button class="btn btn-primary btn-big hold" onpointerdown={startHold} onpointerup={stopHold} onpointerleave={stopHold} onkeydown={(e) => e.key === 'Enter' && startHold()} onkeyup={stopHold}>
        <span class="fill" style:width="{holding * 100}%"></span><span class="lbl">Hold to open</span>
      </button>
    </div>
  {:else}
    <div class="body scroll">
      <div class="who">
        {#each game.save.profiles as pr (pr.id)}
          <button class="pp" class:on={pr.id === selected} onclick={() => (selected = pr.id)}>
            <Critter friend={pr.buddy} look={pr.settings.look} accessory={outfitOf(pr)} size={52} round /><span>{pr.name}</span>
          </button>
        {/each}
      </div>
      {#if p}
        <div class="cards">
          <div class="stat card"><b>{fmtMin(p.totals.ms)}</b><span>practiced</span></div>
          <div class="stat card"><b>{passedCount}/{ALL_LESSONS.length}</b><span>lessons passed</span></div>
          <div class="stat card"><b>{totalStars(p)}</b><span>stars</span></div>
          <div class="stat card"><b>{Math.round(avgWpm)}</b><span>words a minute (last 30)</span></div>
          <div class="stat card"><b>{Math.round(avgAcc * 100)}%</b><span>accuracy (last 30)</span></div>
          <div class="stat card"><b>{RIDES[p.rideBest].name}</b><span>best ride</span></div>
        </div>
        <div class="two">
          <div class="card pane">
            <h3>Minutes per day</h3>
            <div class="bars">
              {#each days as d}
                <div class="bcol"><div class="b" class:goal={d.min >= (p.settings.dailyGoalMin)} style:height="{(d.min / maxMin) * 100}%"></div><span>{d.label}</span></div>
              {/each}
            </div>
            <p class="muted small">Daily goal: {p.settings.dailyGoalMin} min. Green bars hit it.</p>
          </div>
          <div class="card pane">
            <h3>Speed, last {hist.length} runs</h3>
            {#if sparkPts}
              <svg viewBox="0 0 300 100" class="spark"><polyline points={sparkPts} fill="none" stroke="var(--primary)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" /></svg>
            {:else}<p class="muted">A few more runs and a chart shows up here.</p>{/if}
          </div>
        </div>
        <div class="card pane">
          <h3>Key by key</h3>
          <p class="muted small">Green keys are mastered; warm keys need practice. "Tricky Keys" on the Open Road drills them.</p>
          <div class="heat">
            {#each layout.rows.slice(0, 4) as row}
              <div class="hrow">{#each row.filter(k => !k.special) as k}<span style:background={heat(k.base)}>{k.base}</span>{/each}</div>
            {/each}
          </div>
        </div>
        <div class="card pane">
          <h3>My Words</h3>
          <p class="muted small">Paste a spelling list or any text. It becomes the "My Words" lesson on the Open Road (opens after Bottom Row Burrows).</p>
          <textarea bind:value={words} rows="5" placeholder="because, friend, beautiful, enough..."></textarea>
          <button class="btn btn-primary" onclick={saveWords}>Save word list</button>
        </div>
        <div class="card pane">
          <h3>Progress file</h3>
          <p class="muted small">Everything stays on this device: no accounts, no tracking. Save a copy, or move progress to another computer.</p>
          <div class="row">
            <button class="btn" onclick={exportSave}>Save progress to a file</button>
            <button class="btn" onclick={() => fileInput?.click()}>Load progress from a file</button>
            <input type="file" accept="application/json,.json" bind:this={fileInput} onchange={importSave} hidden />
          </div>
        </div>
      {/if}
      <div class="card pane about">
        <h3>About {GAME_NAME}</h3>
        <p>Free, made by {STUDIO}. No ads, no tracking. The code is source-available (PolyForm Strict 1.0.0: read it, run it, help improve it); the art, characters, voices and music are all rights reserved.</p>
        <div class="row">
          <button class="btn" onclick={() => openExternal(STUDIO_URL)}>More games at fancyant.com</button>
          <button class="btn" onclick={() => openExternal(SOURCE_URL)}>Source code</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .gu { display: flex; flex-direction: column; background: var(--bg); }
  .gate { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; }
  .gate h2 { font-size: 32px; }
  .hold { position: relative; overflow: hidden; width: 280px; }
  .hold .fill { position: absolute; left: 0; top: 0; bottom: 0; background: rgba(255, 255, 255, .35); }
  .hold .lbl { position: relative; }
  .body { flex: 1; min-height: 0; padding: 20px 26px 50px; display: flex; flex-direction: column; gap: 18px; }
  .who { display: flex; gap: 10px; flex-wrap: wrap; }
  .pp { display: flex; align-items: center; gap: 6px; padding: 4px 14px 4px 4px; border-radius: 999px; background: #fff; border: 3px solid transparent; box-shadow: var(--shadow-sm); cursor: pointer; font: 600 17px var(--font-ui); color: var(--ink); }
  .pp.on { border-color: var(--primary-hi); }
  .cards { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; }
  .stat { padding: 14px; display: flex; flex-direction: column; }
  .stat b { font: 600 28px var(--font-ui); }
  .stat span { font-size: 13px; color: var(--muted); font-weight: 700; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  .pane { padding: 18px 20px; }
  h3 { font-size: 21px; margin-bottom: 8px; }
  .small { font-size: 13px; margin: 4px 0 10px; }
  .bars { display: flex; align-items: flex-end; gap: 6px; height: 120px; }
  .bcol { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 4px; }
  .b { width: 100%; min-height: 3px; background: var(--lilac); border-radius: 6px 6px 3px 3px; }
  .b.goal { background: var(--mint); }
  .bcol span { font-size: 11px; color: var(--muted); font-weight: 700; }
  .spark { width: 100%; height: 120px; }
  .heat { display: flex; flex-direction: column; gap: 5px; align-items: center; }
  .hrow { display: flex; gap: 5px; }
  .hrow span { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 9px; font: 600 16px var(--font-ui); color: var(--ink2); }
  textarea { width: 100%; padding: 12px; border-radius: 14px; border: 2px solid var(--line); font: 600 16px var(--font-body); margin-bottom: 10px; resize: vertical; }
  .row { display: flex; gap: 10px; flex-wrap: wrap; }
  .about p { color: var(--ink2); }
</style>
