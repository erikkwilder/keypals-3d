<script lang="ts">
  import SaveCodeForm from '../ui/SaveCodeForm.svelte';
  import ClassEntry from '../ui/ClassEntry.svelte';
  import GoogleSignIn from '../ui/GoogleSignIn.svelte';
  import { onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { BUDDIES, type FriendId } from '../art/cast';
  import { STARTERS } from '../engine/team';
  import { LAYOUT_LIST, detectLayout, type LayoutId } from '../engine/layouts';
  import { sfx } from '../audio/sound';
  import Critter from '../ui/Critter.svelte';
  import Bar from '../ui/Bar.svelte';
  import { onButton } from '../ui/screenKeys';
  import { buddyFit } from './buddyFit';
  import { cloud } from '../state/cloud.svelte';

  let step = $state(1);
  let name = $state('');
  let buddy = $state<FriendId>('dino');
  let grown = $state(false);
  let layout = $state<LayoutId>('qwerty');
  let detected = $state<LayoutId | null>(null);
  let nameInput: HTMLInputElement | undefined = $state();
  const samples: { code: string; key: string }[] = [];
  let pulse = $state<{ kind: 'hop' | 'oops' | 'quirk'; n: number }>({ kind: 'hop', n: 0 });
  // the six buddies are sized to the screen's width, so their row fits it (buddyFit.ts)
  let vw = $state(1024), npW = $state(0);
  const fit = $derived(buddyFit(npW || vw, vw <= 440));

  onMount(() => nameInput?.focus());

  function onNameKey(e: KeyboardEvent) {
    if (e.key.length === 1) {
      samples.push({ code: e.code, key: e.key });
      const d = detectLayout(samples);
      if (d) { detected = d; layout = d; }
      sfx.key(null);
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (name.trim()) next();
    }
  }
  function next() {
    sfx.click();
    step++;
  }
  function chooseBuddy(id: FriendId) {
    buddy = id;
    pulse = { kind: 'quirk', n: pulse.n + 1 };
    sfx.pop();
  }
  function finish() {
    sfx.complete();
    game.addPlayer(name, buddy, grown, layout);
    game.go('hub');
  }
  function onKey(e: KeyboardEvent) {
    if (game.modalOpen) return;
    // Enter goes on, except on a button: that's the button's own ("I'm a grown-up", "That's my buddy!")
    const enter = e.key === 'Enter' && !onButton(e);
    if (step === 2) {
      const i = STARTERS.indexOf(buddy);
      if (e.key === 'ArrowRight') chooseBuddy(STARTERS[(i + 1) % STARTERS.length]);
      if (e.key === 'ArrowLeft') chooseBuddy(STARTERS[(i - 1 + STARTERS.length) % STARTERS.length]);
      if (enter) next();
    } else if (step === 3 && enter) finish();
  }
  const look = $derived(game.settings.look);
  // Google sign-in shows (GoogleSignIn.svelte): the other ways in sit side by side where they fit
  const pair = $derived(cloud.online && cloud.google && !cloud.account);
</script>

<svelte:window onkeydown={onKey} bind:innerWidth={vw} />

<div class="screen np" bind:clientWidth={npW}>
  <Bar title="New player" plain back={() => { if (game.backTo()?.screen === 'grownups') game.back(); else game.go(game.save.profiles.length ? 'players' : 'title'); }} />
  <div class="dots">{#each [1, 2, 3] as s}<i class:on={s <= step}></i>{/each}</div>

  {#if step === 1}
    <div class="step">
      <Critter friend="dino" {look} size={150} mood="dance" />
      <h1>Hi there! What's your name?</h1>
      <p class="muted">Type it in. That's your very first typing!</p>
      <input class="name" bind:this={nameInput} bind:value={name} maxlength="16" onkeydown={onNameKey} placeholder="Your name" aria-label="Your name" autocomplete="off" spellcheck="false" />
      <button class="btn btn-primary btn-big" disabled={!name.trim()} onclick={next}>Next</button>
      <div class="ways" class:pair>
        <GoogleSignIn /><!-- a family on a new phone: their players are one sign-in away -->
        <SaveCodeForm />
        <ClassEntry /><!-- classes: a fresh school computer starts here -->
      </div>
    </div>
  {:else if step === 2}
    <div class="step">
      <h1>Pick your buddy, {name.trim()}!</h1>
      <p class="muted">Your buddy rides along with you on every trail. Fifteen more Keypals join your team as you play. Each buddy earns their own friendship, outfits, stickers and medals.</p>
      <div class="buddies" style:--cols={fit.cols} style:--gap="{fit.gap}px" style:--bx="{fit.padX}px">
        {#each BUDDIES.filter(b => STARTERS.includes(b.id)) as f (f.id)}
          <button class="buddy" class:on={buddy === f.id} onclick={() => chooseBuddy(f.id)} aria-pressed={buddy === f.id}>
            <Critter friend={f.id} {look} size={fit.size} pulse={buddy === f.id ? pulse : null} quirkOnHover decorative />
            <span class="bname">{f.name}</span>
          </button>
        {/each}
      </div>
      <p class="quirk">{BUDDIES.find(c => c.id === buddy)?.quirk}</p>
      <div class="row"><button class="btn" onclick={() => (step = 1)}>Change my name</button><button class="btn btn-primary btn-big" onclick={next}>That's my buddy!</button></div>
    </div>
  {:else}
    <div class="step">
      <h1>Almost ready!</h1>
      <div class="choices">
        <button class="choice card" class:on={!grown} onclick={() => (grown = false)} aria-pressed={!grown}>
          <Critter friend={buddy} {look} size={100} mood="dance" decorative />
          <b>I'm a kid</b><span>Bright, bouncy and just right for ages 7 to 12.</span>
        </button>
        <button class="choice card" class:on={grown} onclick={() => (grown = true)} aria-pressed={grown}>
          <Critter friend={buddy} {look} size={100} accessory="detective" decorative />
          <b>I'm a grown-up</b><span>Faster goals and longer reading, same fun crew.</span>
        </button>
      </div>
      <label class="layout">
        Keyboard (for typing)
        <select bind:value={layout}>
          {#each LAYOUT_LIST as l}<option value={l.id}>{l.name}</option>{/each}
        </select>
        {#if detected}<span class="muted">(looks like {LAYOUT_LIST.find(l => l.id === detected)?.name})</span>{/if}
      </label>
      <div class="row"><button class="btn" onclick={() => (step = 2)}>Change my buddy</button><button class="btn btn-mint btn-big" onclick={finish}>Let's go!</button></div>
    </div>
  {/if}
</div>

<style>
  .np { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 30px; background: radial-gradient(circle at 15% 15%, #ffe6f2 0, transparent 40%), radial-gradient(circle at 85% 25%, #dff1ff 0, transparent 42%), radial-gradient(circle at 50% 100%, #e3fbef 0, transparent 50%), var(--bg); overflow-y: auto; }
  .dots { position: absolute; top: 22px; display: flex; gap: 8px; }
  .dots i { width: 12px; height: 12px; border-radius: 50%; background: var(--line); transition: background .2s, transform .2s; }
  .dots i.on { background: var(--primary); transform: scale(1.15); }
  .step { display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; animation: fade-up .35s ease; max-width: 1000px; }
  h1 { font-size: clamp(30px, 4.6vh, 44px); }
  .name { font: 600 40px/1 var(--font-type); text-align: center; padding: 14px 20px; width: min(420px, 90vw); border-radius: 22px; border: 3px solid var(--line); background: #fff; color: var(--ink); box-shadow: var(--shadow-sm); }
  .name:focus { border-color: var(--primary-hi); }
  /* the other ways in (Google sign-in, the save code, the class login): side by side where they fit, so the
     first screen fits a 1366x768 laptop (it was 43 px too tall with Google sign-in on), one above the other
     where they don't. With Google sign-in off, laid out as before. */
  .ways { display: contents; }
  .ways.pair { display: flex; flex-wrap: wrap; justify-content: center; align-items: flex-start; gap: 18px 24px; }
  .ways.pair :global(.codebtn), .ways.pair :global(.elsewhere), .ways.pair :global(.ce) { margin-top: 0; }
  .buddies { display: grid; grid-template-columns: repeat(var(--cols), 1fr); gap: var(--gap); }
  .buddy { display: flex; flex-direction: column; align-items: center; background: rgba(255, 255, 255, .7); border: 3px solid transparent; border-radius: 22px; padding: 10px var(--bx) 8px; cursor: pointer; transition: transform .15s, border-color .15s, background .15s; }
  .buddy:hover { transform: translateY(-3px); }
  .buddy.on { border-color: var(--primary-hi); background: #fff; box-shadow: var(--shadow); }
  .bname { font: 600 18px var(--font-ui); }
  .quirk { font: 600 17px var(--font-body); color: var(--ink2); min-height: 26px; }
  .row { display: flex; gap: 12px; align-items: center; margin-top: 6px; }
  .choices { display: flex; gap: 18px; flex-wrap: wrap; justify-content: center; }
  .choice { width: 280px; padding: 18px; display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer; border: 3px solid transparent; font: inherit; color: inherit; transition: transform .15s; }
  .choice.on { border-color: var(--primary-hi); transform: translateY(-3px); }
  .choice b { font: 600 22px var(--font-ui); }
  .choice span { font-size: 15px; color: var(--muted); }
  .layout { display: flex; align-items: center; gap: 10px; font: 700 16px var(--font-body); }
  select { padding: 8px 12px; border-radius: 12px; border: 2px solid var(--line); background: #fff; font: 600 16px var(--font-body); }
  /* a phone: less padding (the buddies' size, gap and padding at the sides come from buddyFit.ts) */
  @media (max-width: 440px) { .np { padding-left: 16px; padding-right: 16px; } .buddy { padding-top: 8px; padding-bottom: 6px; } }
  /* the one top row: Back and the title, across the top */
  .np { padding-top: 84px; }
  .np > :global(header.bar) { position: absolute; top: 0; left: 0; right: 0; }
</style>
