<script lang="ts">
  // Grown-ups (behind the grown-up check): one family's children. Four rows, each its own page (← Grown-ups |
  // Time and rules): Sign-in and saving (who's signed in first), Players (add, rename, delete, link to a class,
  // My Words, boards), Time and rules, Reports; and Admin for the admin. Pick a child once at the top of a
  // page. Back from a section comes back to the list. Ideas and About are in the Menu.
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { outfitOf } from '../engine/profile';
  import { ALL_LESSONS } from '../engine/course';
  import { dayKey, MAX_PROFILES, migrate, type Profile } from '../engine/profile';
  import { allStars } from '../engine/team';
  import { mathOf } from '../math/progress';
  import { AREAS, skillsOf } from '../math/skills/registry';
  import { skillStatus } from '../math/skills/progress';
  import { mastery } from '../engine/mastery';
  import { LAYOUTS } from '../engine/layouts';
  import { RIDES } from '../engine/rides';
  import { GAME_NAME, SOURCE_PUBLIC, SOURCE_URL, STUDIO, STUDIO_URL } from '../config';
  import { openExternal, saveTextFile } from '../state/platform';
  import { addTester } from '../state/dev';
  import { advOf, advView, type AdvSettings } from '../adventure/state';
  // My path's rules for a home player: things a day, keep to the path, where the math path starts, and
  // play time, on the card a teacher's Class rules uses too (path/rules.ts, path/RulesCard.svelte)
  import { DEFAULT_GOAL, RULE_WORDS, homeRules, ruleDiffs, setHomeRules, usedMs, type FreePlace, type Keep, type Limit, type PlayChoice } from '../path/rules';
  import { ruledBy } from '../path/player.svelte';
  import RulesCard from '../path/RulesCard.svelte';
  import { classesOf, loadClasses } from '../teach/student.svelte';
  import { dueText, goalText, progressOf } from '../teach/assignments';
  import { gradeName } from '../path/units';
  import { GU_NAME } from '../nav';
  import Header from '../ui/Header.svelte';
  import Critter from '../ui/Critter.svelte';
  import { cloud, makeCode, forgetCode, signIn, signOut, deleteAccount, deleteEverywhere, deleteHereOnly, inAccount, addFromAccount, addAllFromAccount, grownupOpen, showCode, call } from '../state/cloud.svelte';
  import { isClassLogin } from '../state/classHere';
  import { notHereCodes } from '../state/sync';
  import { onOldAddress } from '../state/move';
  import { moveToOrg } from '../state/cloud.svelte';
  import { browserSaysNo, countingOff, setCountingOff } from '../state/privacy';
  import { clashes, clashText, loadInto, type Clash } from '../state/progressFile';
  import { loadMe, teach } from '../teach/teacher.svelte';
  let noCount = $state(countingOff());
  /** on fancyant.com/keypals: offer moving the players to keypals.org */
  const oldAddress = onOldAddress(location.pathname);
  import GrownupGate from '../ui/GrownupGate.svelte';
  import CodeCard from '../ui/CodeCard.svelte';
  import AdminPanel from '../ui/AdminPanel.svelte';
  import ClassGrownups from '../ui/ClassGrownups.svelte';

  // the sections: each its own page (game.guSection; null: the list)
  const sec = $derived(game.guSection);
  type Sec = { id: string; name: string; line: string; icon: string };
  /** Admin: teachers waiting for a yes */
  let waitingTeachers = $state(0);
  $effect(() => { if (cloud.account?.admin) void call<{ teachers: { status: string }[] }>('/admin/teachers').then(r => { waitingTeachers = r.teachers.filter(t => t.status === 'pending').length; }).catch(() => null); });
  const SECTIONS = $derived<Sec[]>([
    { id: 'saving', name: GU_NAME.saving, line: cloud.account ? `Signed in as ${cloud.account.name?.split(' ')[0] ?? cloud.account.email}. Saving online, save codes and more` : 'Sign in with Google, saving online, save codes and more', icon: 'icons/cloud-save.webp' },
    { id: 'players', name: GU_NAME.players, line: 'Add, rename or delete a player, link to a class, My Words, boards', icon: 'icons/grownups.webp' },
    { id: 'time', name: GU_NAME.time, line: 'Daily goal, the path, and play time for the fun places', icon: 'icons/clock.webp' },
    { id: 'progress', name: GU_NAME.progress, line: 'Math, typing, class work and minutes for each child', icon: 'icons/chart.webp' },
    ...(cloud.account?.admin ? [{ id: 'admin', name: GU_NAME.admin, line: waitingTeachers ? `${waitingTeachers} teacher${waitingTeachers === 1 ? '' : 's'} waiting` : 'Only you see this', icon: 'icons/gem.webp' }] : []),
  ]);
  function openSec(x: Sec) { sfx.click(); game.guSection = x.id; game.go('grownups'); }

  let saveMsg = $state<string | null>(null);
  async function act(fn: () => Promise<unknown>, done?: string) {
    saveMsg = null; cloud.busy = true;
    try { await fn(); if (done) saveMsg = done; } catch (e) { saveMsg = (e as Error).message; } finally { cloud.busy = false; }
  }
  const here = $derived(new Set(game.save.profiles.map(x => x.cloud?.code).filter(Boolean)));
  let confirmDelete = $state(false);
  /** the player "Stop saving online" is asking about (it deletes the online copy, so it asks first) */
  let confirmStop = $state<string | null>(null);

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
  // (the first player to come to this device, from the account or a new one)
  $effect(() => { if (!p && game.save.profiles[0]) selected = game.save.profiles[0].id; });
  let words = $state(game.save.profiles.find(x => x.id === selected)?.customText ?? '');
  $effect(() => { words = p?.customText ?? ''; });

  const passedCount = $derived(p ? ALL_LESSONS.filter(l => (p!.lessons[l.id]?.stars ?? 0) > 0).length : 0);
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
  const hr = $derived(p ? homeRules(p) : {} as ReturnType<typeof homeRules>);
  function setAdv(patch: Partial<AdvSettings>) {
    setFor(x => { const a = advOf(x); a.settings = { ...a.settings, ...patch }; });
  }
  function setRules(patch: { keep?: Keep; goal?: number; limits?: Partial<Record<FreePlace, Limit>>; play?: PlayChoice }) {
    const { play, ...rest } = patch;
    if (play) setAdv(play);
    if (Object.keys(rest).length) setFor(x => setHomeRules(x, rest));
  }
  // the classes around this child: the ones whose rules hold, and the family's own player linked to one
  $effect(() => { if (p) void loadClasses(p); });
  const ruling = $derived(ruledBy(p ?? null));
  const linked = $derived(classesOf(p ?? null).filter(c => c.home));
  /** a player a class made: the teacher looks after their name and their online copy */
  const classKid = $derived(!!p && (isClassLogin(p) || ruling.length > 0));
  /** the line under each rule where the class and this family disagree */
  const notes = $derived.by(() => {
    const out: Record<string, string> = {};
    if (p) for (const c of ruling) for (const d of ruleDiffs(p, c.settings ?? {})) out[d.key] = d.counts === 'class' ? `${c.name} says ${d.cls}, so that counts.` : `${c.name} says ${d.cls}. Yours is stricter, so yours counts.`;
    return out;
  });
  // the report: every subject
  const playedMs = $derived(p ? Object.values(p.days).reduce((t, d) => t + (d?.ms ?? 0), 0) : 0);
  const mathDone = $derived(p ? Object.values(mathOf(p).lessons).filter(l => (l?.stars ?? 0) > 0).length : 0);
  const skillsSolid = $derived(p ? AREAS.filter(a => a.live).flatMap(a => skillsOf(a.id)).filter(s => !s.facts && skillStatus(mathOf(p!), s.id) === 'solid').length : 0);
  // renaming and deleting a player, any child: a player kept in the signed-in grown-up's account can go
  // everywhere (every computer) or from this computer only; a class player only leaves this computer
  let newName = $state('');
  $effect(() => { newName = p?.name ?? ''; });
  function rename() {
    const n = newName.trim().slice(0, 16);
    if (n) setFor(x => { x.name = n; });
    game.say('Name saved');
  }
  let askDel = $state<string | null>(null);
  let delBusy = $state(false);
  let delMsg = $state<string | null>(null);
  const everywhereAsk = $derived(!!cloud.account && inAccount(p));
  function removeHereOnly() {
    if (!p) return;
    const name = p.name; askDel = null;
    deleteHereOnly(p.id);
    game.say(`${name} is off this computer.`);
    if (!game.save.profiles.length) game.go('newPlayer');
  }
  async function removeEverywhere() {
    if (!p) return;
    const name = p.name, id = p.id;
    delBusy = true; delMsg = null;
    try { await deleteEverywhere(id); askDel = null; game.say(`${name} was deleted from your account and every computer.`, 5000); if (!game.save.profiles.length) game.go('newPlayer'); }
    catch (e) { delMsg = (e as Error).message; }
    finally { delBusy = false; }
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
  /** a file picked that would replace someone here: it asks first */
  let loadAsk = $state<{ file: Profile[]; clash: Clash[] } | null>(null);
  async function importSave(e: Event) {
    const input = e.currentTarget as HTMLInputElement, f = input.files?.[0];
    input.value = ''; // (the same file can be picked again)
    if (!f) return;
    try {
      const data = migrate(JSON.parse(await f.text()));
      if (!data.profiles.length) throw new Error('empty');
      const clash = clashes(game.save.profiles, data.profiles);
      if (clash.length) loadAsk = { file: data.profiles, clash }; else finishLoad(data.profiles);
    } catch {
      game.say('That file did not look like saved progress.');
    }
  }
  function finishLoad(file: Profile[]) {
    loadAsk = null;
    game.save.profiles = loadInto(game.save.profiles, file);
    game.persist();
    game.say(`Loaded ${file.length === 1 ? file[0].name : `${file.length} players`} from the file.`);
  }
  /** Delete my account: a teacher's classes aren't deleted with it, so they're named first */
  let myClasses = $state<{ name: string }[]>([]);
  async function askDelete() {
    confirmDelete = true;
    await loadMe().catch(() => null);
    myClasses = teach.me?.teacher ? teach.classes.filter(c => !c.archived) : [];
  }
  const fmtMin = (ms: number) => (ms < 3600000 ? `${Math.round(ms / 60000)} min` : `${(ms / 3600000).toFixed(1)} h`);
</script>

{#snippet whoRow()}
  <div class="who">
    {#each game.save.profiles as pr (pr.id)}
      <button class="pp" class:on={pr.id === selected} aria-pressed={pr.id === selected} onclick={() => (selected = pr.id)}>
        <Critter friend={pr.buddy} look={pr.settings.look} accessory={outfitOf(pr)} size={52} round /><span>{pr.name}</span>
      </button>
    {/each}
  </div>
{/snippet}

<div class="screen gu">
  <Header back={game.profile ? undefined : () => game.go('players')} />
  {#if !unlocked}
    <GrownupGate onpass={() => (unlocked = true)} />
  {:else}
    <div class="body scroll">
      {#if !sec}
        <nav class="seclist" aria-label="Grown-ups">
          {#each SECTIONS as x (x.id)}
            <button class="secrow" onclick={() => openSec(x)}>
              <img src="{import.meta.env.BASE_URL}{x.icon}" alt="" />
              <span><b>{x.name}</b><small>{x.line}</small></span>
              <img class="chev" src="{import.meta.env.BASE_URL}icons/right.webp" alt="" />
            </button>
          {/each}
        </nav>
      {/if}

      {#if sec === 'saving'}
        <!-- first of all: who's signed in. It works with no player on this device too (a new phone, just signed in) -->
        {#if saveMsg}<p class="small msg">{saveMsg}</p>{/if}
        <div class="card pane acct" bind:this={acctEl} class:flash={flashAcct}>
          <h3>{cloud.account ? 'Signed in' : 'Sign in'}</h3>
          {#if !cloud.online}
            <p class="muted small">Progress is kept on this computer. Signing in and saving online work on keypals.org.</p>
          {:else if cloud.account}
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
              {#if !confirmDelete}<button class="btn" onclick={askDelete}>Delete my account</button>{/if}
            </div>
            {#if confirmDelete}
              <div class="stopask" role="alertdialog" aria-label="Delete your account?">
                <p class="small"><b>Delete your account?</b> You'll be signed out for good. Players on this computer stay on this computer. Pick what happens to the {cloud.players.length === 1 ? 'player' : `${cloud.players.length} players`} saved in your account:</p>
                <ul class="small">
                  <li><b>Keep players' codes:</b> they stay saved online and their save codes keep working.</li>
                  <li><b>Delete saved players:</b> their online copies are deleted and their save codes stop working. This can't be undone.</li>
                </ul>
                {#if myClasses.length}
                  <p class="small"><b>You teach {myClasses.length === 1 ? 'a class' : `${myClasses.length} classes`}: {myClasses.map(c => c.name).join(', ')}.</b> Deleting your account does not delete {myClasses.length === 1 ? 'it' : 'them'}. Students can still log in and play, but nobody can change {myClasses.length === 1 ? 'that class' : 'those classes'} or see {myClasses.length === 1 ? 'its' : 'their'} reports any more. To remove a class and its class players, delete it in For teachers first.</p>
                {/if}
                <div class="row">
                  <button class="btn" onclick={() => (confirmDelete = false)}>Keep my account</button>
                  {#if myClasses.length}<button class="btn" onclick={() => game.visit('teach')}>Open For teachers</button>{/if}
                  <button class="btn" onclick={() => act(() => deleteAccount(false), 'Account deleted. Players keep their save codes.')}>Delete account, keep players' codes</button>
                  <button class="btn" onclick={() => act(() => deleteAccount(true), 'Account and saved players deleted.')}>Delete account and saved players</button>
                </div>
              </div>
            {/if}
          {:else if cloud.google || cloud.microsoft}
            <p class="muted small">Sign in to keep all your players together and bring them to any computer in one go, with no codes to remember. Children don't sign in or give an email.</p>
            <div class="row">
              {#if cloud.google}<button class="btn btn-primary" onclick={() => signIn('google')}>Sign in with Google</button>{/if}
              {#if cloud.microsoft}<button class="btn" onclick={() => signIn('microsoft')}>Sign in with Microsoft</button>{/if}
            </div>
          {:else}
            <p class="muted small">Signing in isn't set up on this copy of Keypals. Save codes still work.</p>
          {/if}
        </div>

        <div class="card pane">
          <h3>Saving online</h3>
          {#if !p}
            <p class="muted small">There are no players on this device yet. Make one, or sign in above to bring the players in your account.</p>
            <div class="row"><button class="btn" class:btn-primary={!!cloud.account} onclick={() => game.go('newPlayer')}>New player</button></div>
          {:else}
            {@render whoRow()}
            {#if !cloud.online}
              <p class="muted small">Saving online works on keypals.org.</p>
            {:else if p.cloud}
              <p class="small"><b>{p.name}'s save code:</b> <span class="code">{showCode(p.cloud.code)}</span></p>
              <p class="muted small">Type it on any computer ("Already play on another computer?" on the player screen) to bring {p.name}'s progress over. It keeps saving as {p.name} plays. If two computers both play, their progress is combined, so nothing is lost.</p>
              <div class="row">
                <button class="btn" onclick={() => (printing = p ?? null)}>Print a code card</button>
                <!-- (a class player belongs to their class: it's not for a grown-up here to stop) -->
                {#if !classKid && confirmStop !== p.id}<button class="btn" disabled={cloud.busy} onclick={() => (confirmStop = p.id)}>Stop saving {p.name} online</button>{/if}
              </div>
              {#if classKid}<p class="muted small">{p.name} belongs to a class: the teacher looks after this online copy.</p>{/if}
              {#if !classKid && confirmStop === p.id}
                <div class="stopask" role="alertdialog" aria-label="Stop saving {p.name} online?">
                  <p class="small"><b>Stop saving {p.name} online?</b> This deletes the online copy of {p.name}'s progress and the save code stops working. Progress stays on this computer only: other computers won't get it, and if this browser is cleared it's gone.</p>
                  <div class="row">
                    <button class="btn" onclick={() => (confirmStop = null)}>Keep saving online</button>
                    <button class="btn" disabled={cloud.busy} onclick={() => { confirmStop = null; void act(() => forgetCode(p.id), 'Stopped saving online. Progress stays on this computer.'); }}>Yes, delete the online copy</button>
                  </div>
                </div>
              {/if}
            {:else}
              <p class="muted small">Turn on saving online so {p.name}'s progress is safe if this browser is cleared or the device is lost, and to play on another computer too. It saves only the nickname and game progress.</p>
              <div class="row"><button class="btn" class:btn-primary={!!cloud.account} disabled={cloud.busy} onclick={() => act(() => makeCode(p.id), `${p.name} is saved online. Print the code card to keep it safe.`)}>Save {p.name} online</button></div>
            {/if}
          {/if}
        </div>

        <div class="card pane more">
          <h3>More</h3>
          {#if cloud.online && oldAddress && game.save.profiles.some(x => !x.allBuddies)}
            <h4>Keypals has a new address: keypals.org</h4>
            <p class="muted small">Progress is kept separately at each address, so bring your players over once: each gets a save code if it hasn't one, and keypals.org opens with them. Both copies keep saving to the same place, so nothing is lost.</p>
            <div class="row"><button class="btn" disabled={cloud.busy} onclick={() => act(moveToOrg)}>Move my players to keypals.org</button></div>
          {/if}
          <h4>A copy you keep yourself</h4>
          <p class="muted small">Save a file, and load it on another computer.</p>
          <div class="row">
            <button class="btn" onclick={exportSave}>Save progress to a file</button>
            <button class="btn" onclick={() => fileInput?.click()}>Load progress from a file</button>
            <input type="file" accept="application/json,.json" bind:this={fileInput} onchange={importSave} hidden />
          </div>
          {#if loadAsk}
            <div class="stopask" role="alertdialog" aria-label="Replace players with the file's copy?">
              <p class="small"><b>Replace {loadAsk.clash.length === 1 ? loadAsk.clash[0].name : `${loadAsk.clash.length} players`} with the file's copy?</b> {clashText(loadAsk.clash)} Anything done here since then is lost.</p>
              <div class="row">
                <button class="btn" onclick={() => (loadAsk = null)}>Keep what's here</button>
                <button class="btn" onclick={() => finishLoad(loadAsk!.file)}>Yes, load the file</button>
              </div>
            </div>
          {/if}
          <h4>Counting visits</h4>
          <p class="muted small">So we know how many people play and what they play, the game counts visits without knowing who anyone is: how many players came today, which screens and games were opened, how long games lasted, the kind of device and the country. No names, save codes, addresses or ids, and no outside trackers. <a href="privacy#counting" target="_blank" rel="noopener">What we count</a></p>
          {#if browserSaysNo()}
            <p class="muted small"><b>This browser asks sites not to track it, so visits from this computer are never counted.</b></p>
          {:else}
            <label class="sw"><input type="checkbox" checked={noCount} onchange={(e) => { noCount = e.currentTarget.checked; setCountingOff(noCount); }} /> Don't count my visits (this computer; it also stops automatic problem reports)</label>
          {/if}
          <p class="muted small"><a href="privacy" target="_blank" rel="noopener">How we look after your information</a></p>
        </div>
      {/if}

      {#if !p && sec && sec !== 'admin' && sec !== 'saving'}
        <div class="card pane">
          <h3>No players on this device yet</h3>
          <p class="muted small">This page is about a player. Make one, or sign in under Sign-in and saving to bring yours here.</p>
          <div class="row"><button class="btn btn-primary" onclick={() => game.go('newPlayer')}>New player</button></div>
        </div>
      {/if}

      {#if p && sec === 'players'}
        <div class="whoadd">
          {@render whoRow()}
          {#if game.save.profiles.length < MAX_PROFILES}<button class="btn addp" onclick={() => { sfx.click(); game.visit('newPlayer'); }}>+ New player</button>{/if}
        </div>
        <div class="card pane">
          <h3>Name</h3>
          {#if classKid}
            <p class="muted small">{p.name} belongs to a class, so the teacher looks after this name.</p>
          {:else}
            <form class="row" onsubmit={(e) => { e.preventDefault(); rename(); }}>
              <input class="txt" bind:value={newName} maxlength="16" aria-label="{p.name}'s name" />
              <button class="btn" disabled={!newName.trim() || newName.trim() === p.name}>Save</button>
            </form>
          {/if}
        </div>
        <ClassGrownups {p} /><!-- linking to a class, world boards -->
        <div class="card pane">
          <h3>My Words</h3>
          <p class="muted small">Paste a spelling list or any text. It becomes the "My Words" lesson on the Open Road (opens after Bottom Row Burrows).</p>
          {#each classesOf(p).filter(c => c.settings?.words?.trim()) as c (c.id)}<p class="small said">{c.name} added a spelling list too: it's in the lesson with yours.</p>{/each}
          <textarea bind:value={words} rows="5" placeholder="because, friend, beautiful, enough..."></textarea>
          <button class="btn" onclick={saveWords}>Save word list</button>
        </div>
        <div class="card pane">
          <h3>Delete {p.name}</h3>
          {#if askDel !== p.id}
            <p class="muted small">{classKid ? `Takes ${p.name} off this computer. ${p.name} stays in the class.` : p.cloud ? `Takes ${p.name} off this computer, or deletes ${p.name} for good.` : `Deletes ${p.name} and all their stars and stickers from this computer.`}</p>
            <button class="btn danger" onclick={() => (askDel = p.id)}>{classKid ? `Take ${p.name} off this computer` : `Delete ${p.name}`}</button>
          {:else if classKid}
            <div class="stopask" role="alertdialog" aria-label="Take {p.name} off this computer?">
              <p class="small"><b>Take {p.name} off this computer?</b> {p.name} stays in the class with all their progress, and can log in again with the class code. Only the teacher can remove {p.name} from the class.</p>
              <div class="row"><button class="btn" onclick={() => (askDel = null)}>Keep</button><button class="btn danger" onclick={removeHereOnly}>Take {p.name} off this computer</button></div>
            </div>
          {:else if everywhereAsk}
            <div class="stopask" role="alertdialog" aria-label="Delete {p.name}?">
              <p class="small"><b>Delete {p.name} everywhere, or just from this computer?</b> Everywhere: {p.name} and all their stars and stickers are deleted from your account and from every computer they're on. Just this computer: {p.name} stays in your account and can be added again under Sign-in and saving.</p>
              <div class="row">
                <button class="btn" onclick={() => (askDel = null)}>Keep</button>
                <button class="btn" disabled={delBusy} onclick={removeHereOnly}>Just this computer</button>
                <button class="btn danger" disabled={delBusy} onclick={removeEverywhere}>Delete everywhere</button>
              </div>
              {#if delMsg}<p class="small">{delMsg}</p>{/if}
            </div>
          {:else if p.cloud}
            <div class="stopask" role="alertdialog" aria-label="Take {p.name} off this computer?">
              <p class="small"><b>Take {p.name} off this computer?</b> The online copy stays, and the save code <span class="code">{showCode(p.cloud.code)}</span> brings {p.name} back. To delete the online copy too, stop saving online first (in Sign-in and saving).</p>
              <div class="row"><button class="btn" onclick={() => (askDel = null)}>Keep</button><button class="btn danger" onclick={removeHereOnly}>Take {p.name} off this computer</button></div>
            </div>
          {:else}
            <div class="stopask" role="alertdialog" aria-label="Delete {p.name}?">
              <p class="small"><b>Delete {p.name} and all their stars and stickers?</b> {p.name} isn't saved online, so this can't be undone.</p>
              <div class="row"><button class="btn" onclick={() => (askDel = null)}>Keep</button><button class="btn danger" onclick={removeHereOnly}>Yes, delete {p.name}</button></div>
            </div>
          {/if}
        </div>
      {/if}

      {#if p && sec === 'time'}
        {@render whoRow()}
        {#if linked.length}<p class="small said wide">{p.name} is linked to {linked.map(c => c.name).join(' and ')}. A family's own player keeps the family's rules at home and at school, so yours are the ones that count.</p>{/if}
        <div class="card pane goals">
          <h3>Goals for {p.name}</h3>
          <div class="grow">
            <span class="gl"><b>Daily goal</b><small>Minutes of lessons, trips, Learn and games a day. Home shows how far along today is.</small></span>
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
          <label class="grow">
            <span class="gl"><b>{RULE_WORDS.grade}</b><small>The units before it stay open, but the path begins here.</small>{#if ruling[0]}<small class="said">{ruling[0].name} is {gradeName(ruling[0].grade)}, so the path starts there.</small>{/if}</span>
            <select class="gsel" value={hr.grade ?? -1} onchange={(e) => { const v = Number((e.currentTarget as HTMLSelectElement).value); setFor(x => setHomeRules(x, { grade: v < 0 ? null : v })); }}>
              <option value={-1}>The beginning</option>{#each [0, 1, 2, 3, 4, 5, 6, 7, 8] as g (g)}<option value={g}>{gradeName(g)}</option>{/each}
            </select>
          </label>
        </div>
        <RulesCard who={p.name} keep={hr.keep ?? 'off'} goal={hr.goal ?? DEFAULT_GOAL} limits={hr.limits ?? {}} play={adv!.settings} set={setRules} note={k => notes[k]} used={pl => Math.round(usedMs(p!, pl) / 60000)}>
          {#snippet today()}
            <p class="playline">Today: <b>{fmtMin(practiceToday)}</b> practice{#if adv?.day.key === dayKey(Date.now())}, <b>{fmtMin(adv.day.ms)}</b> Adventure: <b>{adv.day.answers}</b> answers in battles, <b>{adv.day.answers ? Math.round((adv.day.right / adv.day.answers) * 100) : 0}%</b> right{:else}, no Adventure yet{/if}.</p>
          {/snippet}
        </RulesCard>
      {/if}

      {#if p && sec === 'progress'}
        {@render whoRow()}
        <div class="cards">
          <div class="stat card"><b>{fmtMin(playedMs)}</b><span>played, all subjects</span></div>
          <div class="stat card"><b>{allStars(p)}</b><span>stars, all games</span></div>
          <div class="stat card"><b>{mathDone}</b><span>math trips passed</span></div>
          <div class="stat card"><b>{skillsSolid}</b><span>math skills solid</span></div>
          <div class="stat card"><b>{passedCount}/{ALL_LESSONS.length}</b><span>typing lessons passed</span></div>
          <div class="stat card"><b>{Math.round(avgWpm)}</b><span>words a minute (last 30)</span></div>
          <div class="stat card"><b>{Math.round(avgAcc * 100)}%</b><span>typing accuracy (last 30)</span></div>
          <div class="stat card"><b>{RIDES[p.rideBest].name}</b><span>best ride</span></div>
        </div>
        <div class="card tryall">
          <div><h3>Math skills by grade</h3><p class="muted">Every math skill from kindergarten to 8th grade, with its school standard and where {p.name} is on each: not started, growing or solid.</p></div>
          <button class="btn btn-primary" onclick={() => { game.skillsFor = p!.id; game.go('skills'); }}>See skills</button>
        </div>
        {#if classesOf(p).length}
          <div class="card pane">
            <h3>Class work</h3>
            {#each classesOf(p) as c (c.id)}
              <p class="small"><b>{c.name}</b> ({c.teacher})</p>
              {#if c.assignments.length}
                <ul class="work">
                  {#each c.assignments as a (a.id)}
                    {@const pr = progressOf(p, a)}
                    <li><span><b>{a.title}</b><small>{goalText(a)}{a.due ? ` · due ${dueText(a.due)}` : ''}</small></span><span class="wbar"><i style:width="{Math.min(100, pr.done * 100)}%"></i></span><em>{pr.done >= 1 ? 'Done' : pr.status === 'not started' ? 'Not started' : pr.status === 'late' ? 'Late' : `${Math.round(pr.done * 100)}%`}</em></li>
                  {/each}
                </ul>
              {:else}<p class="muted small">No class work right now.</p>{/if}
            {/each}
          </div>
        {/if}
        <!-- the page the child sees: what's going well, what's growing, time, and everything earned with when -->
        <div class="card tryall">
          <div><h3>{p.name}'s My progress</h3><p class="muted">The page {p.name} sees in My stuff: what's going well, what's still growing, minutes each day and week, and every star, shell, egg, medal, sticker and Glimmer earned, with when and from what.</p></div>
          <button class="btn" onclick={() => { game.progressFor = p!.id; game.visit('progress'); }}>Open My progress</button>
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
            <h3>Typing speed, last {hist.length} runs</h3>
            {#if sparkPts}
              <svg viewBox="0 0 300 100" class="spark"><polyline points={sparkPts} fill="none" stroke="var(--primary)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" /></svg>
            {:else}<p class="muted">A few more typing runs and a chart shows up here.</p>{/if}
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
      {#if cloud.account?.admin && sec === 'admin'}
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
    </div>
  {/if}
</div>

<style>
  /* the list of sections */
  .seclist { display: flex; flex-direction: column; gap: 10px; max-width: 760px; width: 100%; margin: 0 auto; }
  .secrow { display: flex; align-items: center; gap: 14px; border: 0; cursor: pointer; text-align: left; padding: 12px 16px; border-radius: 20px; background: #fff; box-shadow: 0 0 0 2px #ece6f6, 0 8px 18px -14px rgba(60, 40, 110, .5); font: inherit; }
  .secrow:hover { box-shadow: 0 0 0 2px #c9b8ff, 0 8px 18px -14px rgba(60, 40, 110, .5); }
  .secrow > img { width: 46px; height: 46px; object-fit: contain; flex: none; }
  .secrow span { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .secrow b { font: 600 20px var(--font-ui); color: var(--ink); }
  .secrow small { font: 700 14px/1.3 var(--font-body); color: var(--muted); }
  .secrow .chev { width: 26px; height: 26px; opacity: .6; }
  .whoadd { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .addp { flex: none; }
  .txt { flex: 1 1 200px; max-width: 280px; min-width: 0; padding: 8px 12px; border-radius: 12px; border: 2px solid var(--line); background: #fff; font: 600 16px var(--font-body); }
  .danger { color: #c0396f; }
  .said { font: 700 13px/1.35 var(--font-body); color: #8a4a00; background: #fff4e0; padding: 4px 10px; border-radius: 10px; }
  .gl .said { display: block; margin-top: 4px; padding: 2px 8px; }
  .said.wide { margin: 0; }
  .work { list-style: none; margin: 0 0 10px; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .work li { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-top: 1px solid var(--line); flex-wrap: wrap; }
  .work span:first-child { flex: 1 1 200px; min-width: 0; display: flex; flex-direction: column; }
  .work b { font: 700 15px var(--font-body); color: var(--ink); }
  .work small { font: 600 13px var(--font-body); color: var(--muted); }
  .wbar { width: 110px; height: 10px; border-radius: 99px; background: #efedf3; overflow: hidden; flex: none; }
  .wbar i { display: block; height: 100%; background: #4fcf9f; }
  .work em { font: 700 13px var(--font-body); font-style: normal; color: var(--ink2); min-width: 72px; text-align: right; }
  .tryall { display: flex; align-items: center; gap: 16px; padding: 14px 18px; margin: 12px 0; }
  .tryall h3 { margin: 0 0 2px; }
  .tryall > .btn { flex: none; white-space: nowrap; }
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
  .gsel { font: 600 15px var(--font-body); padding: 6px 10px; border-radius: 10px; border: 2px solid #e6dff5; flex: none; }
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
  .cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  .stat { padding: 14px; display: flex; flex-direction: column; }
  .stat b { font: 600 28px var(--font-ui); }
  .stat span { font-size: 13px; color: var(--muted); font-weight: 700; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  .pane { padding: 18px 20px; }
  .acct { scroll-margin-top: 12px; transition: box-shadow .4s; }
  .acct.flash { box-shadow: 0 0 0 4px #7fd6a6, 0 0 30px rgba(80, 200, 140, .5); }
  .playline { margin: 10px 0 0; font: 600 14px var(--font-body); color: var(--ink2); }
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
  /* phones: the numbers two by two, charts one under the other, smaller keys */
  @media (max-width: 760px) {
    .body { padding: 14px 12px 40px; }
    .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .stat { padding: 10px; } .stat b { font-size: 20px; }
    .two { grid-template-columns: 1fr; }
    .hrow { gap: 3px; } .hrow span { width: 25px; height: 30px; font-size: 13px; border-radius: 7px; }
  }
  .stopask { margin-top: 10px; padding: 10px 14px; border-radius: 14px; background: #fff4e0; box-shadow: inset 0 0 0 2px #ffd59a; }
  .stopask p { margin: 0 0 8px; }
</style>
