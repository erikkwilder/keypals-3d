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
  import { AREAS } from '../math/skills/registry';
  import Header from '../ui/Header.svelte';
  import Critter from '../ui/Critter.svelte';
  import { cloud, makeCode, forgetCode, signIn, signOut, deleteAccount, addFromAccount, addAllFromAccount, grownupOpen, showCode } from '../state/cloud.svelte';
  import { notHereCodes } from '../state/sync';
  import { onOldAddress } from '../state/move';
  import { moveToOrg } from '../state/cloud.svelte';
  import { browserSaysNo, countingOff, setCountingOff } from '../state/privacy';
  let noCount = $state(countingOff());
  /** on fancyant.com/keypals: offer moving the players to keypals.org */
  const oldAddress = onOldAddress(location.pathname);
  import GrownupGate from '../ui/GrownupGate.svelte';
  import CodeCard from '../ui/CodeCard.svelte';
  import AdminPanel from '../ui/AdminPanel.svelte';
  import ClassGrownups from '../ui/ClassGrownups.svelte';

  let saveMsg = $state<string | null>(null);
  async function act(fn: () => Promise<unknown>, done?: string) {
    saveMsg = null; cloud.busy = true;
    try { await fn(); if (done) saveMsg = done; } catch (e) { saveMsg = (e as Error).message; } finally { cloud.busy = false; }
  }
  const here = $derived(new Set(game.save.profiles.map(x => x.cloud?.code).filter(Boolean)));
  let confirmDelete = $state(false);

  // the grown-up check (press and hold, then a number in words); open for ten minutes once passed
  // back from the skills report: still open, on the same player
  const backFrom = game.skillsFor; game.skillsFor = null;
  let unlocked = $state(grownupOpen() || !!backFrom);
  // opened from a save chip or the menu: go straight to "Saving online" once the grown-up check is passed
  let acctEl: HTMLDivElement | undefined = $state();
  let flashAcct = $state(false);
  const wantAcct = cloud.focusAccount; cloud.focusAccount = false;
  $effect(() => {
    if (!wantAcct || !unlocked || !acctEl) return;
    const el = acctEl;
    requestAnimationFrame(() => { el.scrollIntoView({ block: 'start', behavior: 'smooth' }); flashAcct = true; setTimeout(() => (flashAcct = false), 1600); });
  });
  /** players in the signed-in grown-up's account that aren't on this computer yet */
  const waiting = $derived(cloud.players.filter(cp => !here.has(cp.code)));
  /** removed from this computer only ("just this computer"): they stay in the account */
  const removedHere = $derived.by(() => { void game.save.profiles.length; return new Set(notHereCodes()); });
  /** the player whose save code card is being printed */
  let printing = $state<Profile | null>(null);

  let selected = $state(backFrom ?? game.profile?.id ?? game.save.profiles[0]?.id ?? '');
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
  /** change the player picked here (the one playing, or another on this computer) */
  function setFor(fn: (x: Profile) => void) {
    if (selected === game.save.activeId) { game.update(fn); return; }
    const x = game.save.profiles.find(pr => pr.id === selected);
    if (!x) return;
    fn(x); x.updatedAt = Date.now();
    game.persist(); game.onProfileChange?.();
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
    <GrownupGate onpass={() => (unlocked = true)} />
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
        <!-- first on the page: where progress is kept, signing in, save codes (the save chips open straight here) -->
        <div class="card pane acct" bind:this={acctEl} class:flash={flashAcct}>
          <h3>Saving online</h3>
          {#if !cloud.online}
            <p class="muted small">Progress is kept on this computer. Saving online works on keypals.org.</p>
          {:else if p}
            {#if p.cloud}
              <p class="small"><b>{p.name}'s save code:</b> <span class="code">{showCode(p.cloud.code)}</span></p>
              <p class="muted small">Type it on any computer ("Already play on another computer?" on the player screen) to bring {p.name}'s progress over. It keeps saving as {p.name} plays. If two computers both play, their progress is combined, so nothing is lost.</p>
              <div class="row">
                <button class="btn btn-primary" onclick={() => (printing = p ?? null)}>Print a code card</button>
                <button class="btn" disabled={cloud.busy} onclick={() => act(() => forgetCode(p.id), 'Stopped saving online. Progress stays on this computer.')}>Stop saving {p.name} online</button>
              </div>
            {:else}
              <p class="muted small">Turn on saving online so {p.name}'s progress is safe if this browser is cleared or the device is lost, and to play on another computer too. It saves only the nickname and game progress.</p>
              <div class="row"><button class="btn btn-primary" disabled={cloud.busy} onclick={() => act(() => makeCode(p.id), `${p.name} is saved online. Print the code card to keep it safe.`)}>Save {p.name} online</button></div>
            {/if}
          {/if}
          {#if cloud.online && (cloud.google || cloud.microsoft || cloud.account)}
            <h4>Parents and teachers</h4>
            {#if cloud.account}
              <p class="small">Signed in as <b>{cloud.account.name ?? cloud.account.email}</b>{#if cloud.account.email && cloud.account.name}{' '}({cloud.account.email}){/if}. Players on this computer are kept in your account and saved online. Every computer you sign in on shows the same players, and a player deleted everywhere goes from all of them.</p>
              {#if waiting.length}
                <p class="muted small">In your account, not on this computer: {waiting.map(cp => cp.name).join(', ')}{waiting.some(cp => removedHere.has(cp.code)) ? ' (removed from this computer only)' : ''}.</p>
                <div class="row">
                  <button class="btn btn-primary" disabled={cloud.busy} onclick={() => act(async () => { const n = await addAllFromAccount(); return n; }, `Added ${waiting.length === 1 ? waiting[0].name : `all ${waiting.length} players`} to this computer.`)}>{waiting.length === 1 ? `Add ${waiting[0].name} here` : 'Add them all here'}</button>
                  {#if waiting.length > 1}{#each waiting as cp (cp.code)}<button class="btn" disabled={cloud.busy} onclick={() => act(() => addFromAccount(cp.code), `${cp.name} is on this computer now.`)}>Add {cp.name}</button>{/each}{/if}
                </div>
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
              <p class="muted small">Sign in to keep all your players together and bring them to any computer in one go, with no codes to remember. Children don't sign in or give an email.</p>
              <div class="row">
                {#if cloud.google}<button class="btn" onclick={() => signIn('google')}>Sign in with Google</button>{/if}
                {#if cloud.microsoft}<button class="btn" onclick={() => signIn('microsoft')}>Sign in with Microsoft</button>{/if}
              </div>
            {/if}
          {/if}
          {#if cloud.online && oldAddress && game.save.profiles.some(x => !x.allBuddies)}
            <h4>Keypals has a new address: keypals.org</h4>
            <p class="muted small">Progress is kept separately at each address, so bring your players over once: each gets a save code if it hasn't one, and keypals.org opens with them. Both copies keep saving to the same place, so nothing is lost.</p>
            <div class="row"><button class="btn btn-primary" disabled={cloud.busy} onclick={() => act(moveToOrg)}>Move my players to keypals.org</button></div>
          {/if}
          {#if saveMsg}<p class="small msg">{saveMsg}</p>{/if}
          <p class="muted small"><a href="privacy" target="_blank" rel="noopener">How we look after your information</a></p>
          <h4>Counting visits</h4>
          <p class="muted small">So we know how many people play and what they play, the game counts visits without knowing who anyone is: how many players came today, which screens and games were opened, how long games lasted, the kind of device and the country. No names, save codes, addresses or ids, and no outside trackers. <a href="privacy#counting" target="_blank" rel="noopener">What we count</a></p>
          {#if browserSaysNo()}
            <p class="muted small"><b>This browser asks sites not to track it, so visits from this computer are never counted.</b></p>
          {:else}
            <label class="sw"><input type="checkbox" checked={noCount} onchange={(e) => { noCount = e.currentTarget.checked; setCountingOff(noCount); }} /> Don't count my visits (this computer; it also stops automatic problem reports)</label>
          {/if}
          <h4>Progress file</h4>
          <p class="muted small">Or keep a copy yourself: save a file, and load it on another computer.</p>
          <div class="row">
            <button class="btn" onclick={exportSave}>Save progress to a file</button>
            <button class="btn" onclick={() => fileInput?.click()}>Load progress from a file</button>
            <input type="file" accept="application/json,.json" bind:this={fileInput} onchange={importSave} hidden />
          </div>
        </div>
        <div class="cards">
          <div class="stat card"><b>{fmtMin(p.totals.ms)}</b><span>practiced</span></div>
          <div class="stat card"><b>{passedCount}/{ALL_LESSONS.length}</b><span>lessons passed</span></div>
          <div class="stat card"><b>{totalStars(p)}</b><span>stars</span></div>
          <div class="stat card"><b>{Math.round(avgWpm)}</b><span>words a minute (last 30)</span></div>
          <div class="stat card"><b>{Math.round(avgAcc * 100)}%</b><span>accuracy (last 30)</span></div>
          <div class="stat card"><b>{RIDES[p.rideBest].name}</b><span>best ride</span></div>
        </div>
        <div class="card tryall">
          <img class="ti" src="{import.meta.env.BASE_URL}icons/bulb.webp" alt="" />
          <div><h3>Ideas and help</h3><p class="muted">Suggest a new game or something to make better, vote on other families' ideas, or tell us about a problem.</p></div>
          <button class="btn btn-primary" onclick={() => game.openIdeas()}>Ideas and help</button>
        </div>
        <div class="card tryall">
          <div><h3>Math skills by grade</h3><p class="muted">Every math skill from kindergarten to 8th grade, with its school standard and where {p.name} is on each: not started, growing or solid.</p></div>
          <button class="btn btn-primary" onclick={() => { game.skillsFor = p!.id; game.go('skills'); }}>See skills</button>
        </div>
        <ClassGrownups {p} /><!-- classes: teachers, linking to a class, world boards -->
        <!-- time and goals (moved here from Settings: the grown-ups choose them, the player just plays) -->
        <div class="card pane goals">
          <h3>Time and goals for {p.name}</h3>
          <div class="grow">
            <span class="gl"><b>Daily goal</b><small>Minutes of lessons, trips, Learn and games a day. The minutes in the top bar fill up toward it.</small></span>
            <div class="seg">{#each [5, 10, 15, 20, 30] as m (m)}<button class:on={p.settings.dailyGoalMin === m} onclick={() => setFor(x => { x.settings.dailyGoalMin = m; })}>{m} min</button>{/each}</div>
          </div>
          <label class="grow">
            <span class="gl"><b>Grown-up mode</b><small>For a grown-up playing: higher goal scores, longer lessons and faster rides.</small></span>
            <input type="checkbox" checked={p.settings.grown} onchange={(e) => { const v = e.currentTarget.checked; setFor(x => { x.settings.grown = v; }); }} />
          </label>
          {#if !p.settings.grown}
            <label class="grow">
              <span class="gl"><b>Easy mode</b><small>Typing stars need two thirds of the usual score. Good for younger typists.</small></span>
              <input type="checkbox" checked={!!p.settings.easy} onchange={(e) => { const v = e.currentTarget.checked; setFor(x => { x.settings.easy = v; }); }} />
            </label>
          {/if}
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
            <label>Family Duel and Rival Ghosts
              <select value={adv?.settings.versus === false ? 'off' : 'on'} onchange={(e) => setAdv({ versus: (e.currentTarget as HTMLSelectElement).value === 'on' })}><option value="on">On (players on this device only)</option><option value="off">Off</option></select></label>
            <label>Battles use
              <select value={adv?.settings.focus ?? 'all'} onchange={(e) => setAdv({ focus: (e.currentTarget as HTMLSelectElement).value as AdvSettings['focus'] })}><option value="all">All the math met so far</option><option value="+">Adding only</option><option value="-">Taking away only</option><option value="x">Times only</option><option value="/">Sharing only</option>{#each AREAS.filter(a => a.live && !a.op) as a (a.id)}<option value={a.id}>{a.name} only</option>{/each}</select></label>
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
      {/if}
      {#if printing?.cloud}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="pbg" onclick={() => (printing = null)}>
          <div class="pmodal card" onclick={(e) => e.stopPropagation()}>
            <h3>{printing.name}'s save code card</h3>
            <div class="kp-print"><CodeCard name={printing.name} buddy={printing.buddy} code={printing.cloud.code} /></div>
            <div class="row end"><button class="btn" onclick={() => (printing = null)}>Close</button><button class="btn btn-primary" onclick={() => window.print()}>Print</button></div>
          </div>
        </div>
      {/if}
      {#if cloud.account?.admin}
        <div class="card pane adminpane">
          <h3>Admin</h3>
          <p class="muted small">Only you see this ({cloud.account.email}).</p>
          <div class="tryall inadmin">
            <div><h3>Try every level</h3><p class="muted">Adds a player called Tester with every typing lesson, math trip and playground level open, every buddy on the team, and every outfit and dance. Your own players aren't changed.</p></div>
            <button class="btn btn-primary" onclick={() => { addTester(); game.go('hub'); }}>Open Tester</button>
          </div>
          <AdminPanel />
        </div>
      {/if}
      <div class="card pane about">
        <h3>About {GAME_NAME}</h3>
        <p>Free, made by {STUDIO}. No ads, no tracking. The code is source-available (PolyForm Strict 1.0.0: read it, run it, help improve it); the art, characters, voices and music are all rights reserved.</p>
        <div class="row">
          <button class="btn btn-primary" onclick={() => game.openAbout()}>About Keypals</button>
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
  .tryall .ti { width: 52px; height: 52px; object-fit: contain; flex: none; }
  @media (max-width: 600px) { .tryall .ti { display: none; } }
  .adminpane { border: 3px solid #ffcf8a; }
  .tryall.inadmin { margin: 6px 0 14px; padding: 12px 14px; border-radius: 16px; background: #fff8ec; }
  .goals { display: flex; flex-direction: column; gap: 4px; }
  .grow { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 8px 0; border-bottom: 1px solid var(--line); }
  .grow:last-child { border-bottom: 0; }
  .gl { display: flex; flex-direction: column; min-width: 0; }
  .gl b { font: 600 17px var(--font-ui); color: var(--ink); }
  .gl small { font: 600 13px/1.35 var(--font-body); color: var(--muted); }
  .grow input[type='checkbox'] { width: 22px; height: 22px; accent-color: var(--primary); flex: none; }
  .seg { display: flex; gap: 4px; background: var(--bg2); padding: 4px; border-radius: 14px; flex: none; }
  .seg button { border: 0; background: none; padding: 7px 10px; border-radius: 10px; font: 700 13px var(--font-body); color: var(--muted); cursor: pointer; }
  .seg button.on { background: #fff; color: var(--ink); box-shadow: var(--shadow-sm); }
  @media (max-width: 600px) { .grow { flex-wrap: wrap; } }
  .sw { display: flex; align-items: center; gap: 8px; font: 700 14px var(--font-body); color: var(--ink2); margin: 4px 0 10px; }
  .sw input { width: 20px; height: 20px; accent-color: var(--primary); flex: none; }
  .tryall p { margin: 0; font: 600 14px/1.4 var(--font-body); }
  @media (max-width: 600px) { .tryall { flex-direction: column; align-items: stretch; } }
  .code { font: 700 18px var(--font-ui); letter-spacing: .02em; background: #f3edff; padding: 2px 10px; border-radius: 10px; color: var(--primary); }
  h4 { margin: 14px 0 4px; font-size: 16px; }
  .msg { color: var(--primary); font-weight: 700; }
  .gu { display: flex; flex-direction: column; background: var(--bg); }
  .pbg { position: fixed; inset: 0; z-index: 50; background: rgba(40, 28, 70, .4); display: grid; grid-template-columns: minmax(0, 1fr); place-items: center; padding: 16px; overflow: auto; }
  .pmodal { padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; align-items: center; width: min(700px, 100%); }
  .pmodal .kp-print { width: 100%; display: flex; justify-content: center; }
  .pmodal h3 { margin: 0; }
  .row.end { justify-content: flex-end; align-self: stretch; }
  .row + .row { margin-top: 10px; }
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
  .acct { scroll-margin-top: 12px; transition: box-shadow .4s; }
  .acct.flash { box-shadow: 0 0 0 4px #7fd6a6, 0 0 30px rgba(80, 200, 140, .5); }
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
  /* phones: the six numbers in two rows of three, charts one under the other, smaller keys */
  @media (max-width: 760px) {
    .body { padding: 14px 12px 40px; }
    .cards { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .stat { padding: 10px; } .stat b { font-size: 20px; }
    .two { grid-template-columns: 1fr; }
    .hrow { gap: 3px; } .hrow span { width: 25px; height: 30px; font-size: 13px; border-radius: 7px; }
  }
</style>
