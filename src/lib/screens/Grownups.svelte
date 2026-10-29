<script lang="ts">
  import { game } from '../state/game.svelte';
  import { outfitOf } from '../engine/profile';
  import { ALL_LESSONS } from '../engine/course';
  import { dayKey, migrate, totalStars, type Profile } from '../engine/profile';
  import { mastery } from '../engine/mastery';
  import { LAYOUTS } from '../engine/layouts';
  import { RIDES } from '../engine/rides';
  import { GAME_NAME, SOURCE_PUBLIC, SOURCE_URL, STUDIO, STUDIO_URL } from '../config';
  import { openExternal, saveTextFile } from '../state/platform';
  import { addTester } from '../state/dev';
  import { advOf, advView, PLAY_RULES, type AdvSettings, type PlayRule } from '../adventure/state';
  import Header from '../ui/Header.svelte';
  import Critter from '../ui/Critter.svelte';
  import { cloud, makeCode, forgetCode, signIn, signOut, deleteAccount, openCode } from '../state/cloud.svelte';

  let saveMsg = $state<string | null>(null);
  async function act(fn: () => Promise<unknown>, done?: string) {
    saveMsg = null; cloud.busy = true;
    try { await fn(); if (done) saveMsg = done; } catch (e) { saveMsg = (e as Error).message; } finally { cloud.busy = false; }
  }
  const here = $derived(new Set(game.save.profiles.map(x => x.cloud?.code).filter(Boolean)));
  let confirmDelete = $state(false);

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
  const adv = $derived(p ? advView(p) : null);
  const practiceToday = $derived(p ? (p.days[dayKey(Date.now())]?.ms ?? 0) : 0);
  function setAdv(patch: Partial<AdvSettings>) {
    game.save.profiles.forEach(x => { if (x.id === selected) { const a = advOf(x); a.settings = { ...a.settings, ...patch }; } });
    game.persist();
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
  <Header title="Grown-ups" back={() => game.go(game.profile ? game.home : 'players')} />
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
        <div class="card tryall">
          <div><h3>Try every level</h3><p class="muted">Adds a player called Tester with every typing lesson, math trip and playground level open, every buddy on the team, and every outfit and dance. Your own players aren't changed.</p></div>
          <button class="btn btn-primary" onclick={() => { addTester(); game.go('hub'); }}>Open Tester</button>
        </div>
        <div class="card pane advset">
          <h3>Adventure: play time</h3>
          <p class="muted small">Adventure is the battle mode. Every move in a battle is still a math answer or a typed word, and practice is where the eggs hatch. Choose how play time works for {p.name}.</p>
          <div class="rules">
            {#each Object.entries(PLAY_RULES) as [id, r]}
              <button class="rule" class:on={adv?.settings.rule === id} onclick={() => setAdv({ rule: id as PlayRule })}><b>{r.name}</b><span>{r.text}</span></button>
            {/each}
          </div>
          <div class="opts">
            {#if adv?.settings.rule === 'balanced'}
              <label>Play minutes per practice minute
                <select value={adv.settings.ratio} onchange={(e) => setAdv({ ratio: Number((e.currentTarget as HTMLSelectElement).value) })}>{#each [0.5, 1, 1.5, 2] as r}<option value={r}>{r === 0.5 ? '1 for every 2' : r === 1 ? '1 for 1' : r === 1.5 ? '3 for every 2' : '2 for 1'}</option>{/each}</select></label>
              <label>Free minutes each day
                <select value={adv.settings.freeMin} onchange={(e) => setAdv({ freeMin: Number((e.currentTarget as HTMLSelectElement).value) })}>{#each [0, 5, 10, 15, 20] as m}<option value={m}>{m} min</option>{/each}</select></label>
            {/if}
            <label>Most Adventure a day
              <select value={adv?.settings.capMin ?? 0} onchange={(e) => setAdv({ capMin: Number((e.currentTarget as HTMLSelectElement).value) })}>{#each [0, 15, 20, 30, 45, 60] as m}<option value={m}>{m ? `${m} min` : 'No limit'}</option>{/each}</select></label>
            <label>Battles use
              <select value={adv?.settings.focus ?? 'all'} onchange={(e) => setAdv({ focus: (e.currentTarget as HTMLSelectElement).value as AdvSettings['focus'] })}><option value="all">All the math met so far</option><option value="+">Adding only</option><option value="-">Taking away only</option><option value="x">Times only</option><option value="/">Sharing only</option></select></label>
          </div>
          <p class="playline">Today: <b>{fmtMin(practiceToday)}</b> practice{#if adv?.day.key === dayKey(Date.now())}, <b>{fmtMin(adv.day.ms)}</b> Adventure: <b>{adv.day.answers}</b> answers in battles, <b>{adv.day.answers ? Math.round((adv.day.right / adv.day.answers) * 100) : 0}%</b> right{:else}, no Adventure yet{/if}.</p>
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
          <h3>Saving</h3>
          {#if !cloud.online}
            <p class="muted small">Progress is kept on this computer. Saving online works on fancyant.com/keypals.</p>
          {:else if p}
            {#if p.cloud}
              <p class="small"><b>{p.name}'s save code:</b> <span class="code">{p.cloud.code.toLowerCase().replaceAll('-', ' ')}</span></p>
              <p class="muted small">Type it on any computer (the "save code" button on the player screen) to bring {p.name}'s progress over. It keeps saving as {p.name} plays.</p>
              <div class="row"><button class="btn" disabled={cloud.busy} onclick={() => act(() => forgetCode(p.id), 'Stopped saving online. Progress stays on this computer.')}>Stop saving {p.name} online</button></div>
            {:else}
              <p class="muted small">Get a save code to play as {p.name} on another computer too. It holds only the nickname and game progress.</p>
              <div class="row"><button class="btn btn-primary" disabled={cloud.busy} onclick={() => act(() => makeCode(p.id))}>Make a save code for {p.name}</button></div>
            {/if}
          {/if}
          {#if cloud.online && (cloud.google || cloud.microsoft || cloud.account)}
            <h4>Parents and teachers</h4>
            {#if cloud.account}
              <p class="small">Signed in as <b>{cloud.account.name ?? cloud.account.email}</b>{#if cloud.account.email && cloud.account.name} ({cloud.account.email}){/if}. Players on this computer are kept in your account.</p>
              {#if cloud.players.some(cp => !here.has(cp.code))}
                <p class="muted small">In your account, not on this computer yet:</p>
                <div class="row">{#each cloud.players.filter(cp => !here.has(cp.code)) as cp (cp.code)}<button class="btn" disabled={cloud.busy} onclick={() => act(() => openCode(cp.code), `${cp.name} is on this computer now.`)}>Add {cp.name}</button>{/each}</div>
              {/if}
              <div class="row">
                <button class="btn" onclick={() => act(signOut)}>Sign out</button>
                {#if !confirmDelete}<button class="btn" onclick={() => (confirmDelete = true)}>Delete my account</button>
                {:else}
                  <button class="btn" onclick={() => act(() => deleteAccount(false), 'Account deleted. Players keep their save codes.')}>Delete account, keep players' codes</button>
                  <button class="btn" onclick={() => act(() => deleteAccount(true), 'Account and saved players deleted.')}>Delete account and saved players</button>
                {/if}
              </div>
            {:else}
              <p class="muted small">Sign in to keep all your players together and find them on any computer. Children don't sign in or give an email.</p>
              <div class="row">
                {#if cloud.google}<button class="btn" onclick={() => signIn('google')}>Sign in with Google</button>{/if}
                {#if cloud.microsoft}<button class="btn" onclick={() => signIn('microsoft')}>Sign in with Microsoft</button>{/if}
              </div>
            {/if}
          {/if}
          {#if saveMsg}<p class="small msg">{saveMsg}</p>{/if}
          <p class="muted small"><a href="privacy" target="_blank" rel="noopener">How we look after your information</a></p>
          <h4>Progress file</h4>
          <p class="muted small">Or keep a copy yourself: save a file, and load it on another computer.</p>
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
          {#if SOURCE_PUBLIC}<button class="btn" onclick={() => openExternal(SOURCE_URL)}>Source code</button>{/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .tryall { display: flex; align-items: center; gap: 16px; padding: 14px 18px; margin: 12px 0; }
  .tryall h3 { margin: 0 0 2px; }
  .tryall p { margin: 0; font: 600 14px/1.4 var(--font-body); }
  @media (max-width: 600px) { .tryall { flex-direction: column; align-items: stretch; } }
  .code { font: 700 18px var(--font-ui); letter-spacing: .02em; background: #f3edff; padding: 2px 10px; border-radius: 10px; color: var(--primary); }
  h4 { margin: 14px 0 4px; font-size: 16px; }
  .msg { color: var(--primary); font-weight: 700; }
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
  .advset { margin-bottom: 12px; }
  .rules { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 8px 0; }
  .rule { display: flex; flex-direction: column; gap: 3px; text-align: left; border: 3px solid #ece6f6; background: #fff; border-radius: 16px; padding: 10px 12px; cursor: pointer; }
  .rule b { font: 600 18px var(--font-ui); color: var(--ink); }
  .rule span { font: 600 13px/1.35 var(--font-body); color: var(--muted); }
  .rule.on { border-color: var(--primary-hi); background: #f6f2ff; }
  .opts { display: flex; flex-wrap: wrap; gap: 10px 18px; }
  .opts label { display: flex; flex-direction: column; gap: 4px; font: 700 13px var(--font-body); color: var(--ink2); }
  .opts select { font: 600 15px var(--font-body); padding: 6px 10px; border-radius: 10px; border: 2px solid #e6dff5; }
  .playline { margin: 10px 0 0; font: 600 14px var(--font-body); color: var(--ink2); }
  @media (max-width: 600px) { .rules { grid-template-columns: 1fr; } }
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
