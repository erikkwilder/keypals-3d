<script lang="ts">
  import SaveCodeForm from '../ui/SaveCodeForm.svelte';
  import { onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { BUDDIES, type FriendId } from '../art/cast';
  import { STARTERS } from '../engine/team';
  import { LAYOUT_LIST, detectLayout, type LayoutId } from '../engine/layouts';
  import { sfx } from '../audio/sound';
  import Critter from '../ui/Critter.svelte';
  import GearButton from '../ui/GearButton.svelte';

  let step = $state(1);
  let name = $state('');
  let buddy = $state<FriendId>('dino');
  let grown = $state(false);
  let layout = $state<LayoutId>('qwerty');
  let detected = $state<LayoutId | null>(null);
  let nameInput: HTMLInputElement | undefined = $state();
  const samples: { code: string; key: string }[] = [];
  let pulse = $state<{ kind: 'hop' | 'oops' | 'quirk'; n: number }>({ kind: 'hop', n: 0 });

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
    if (step === 2) {
      const i = STARTERS.indexOf(buddy);
      if (e.key === 'ArrowRight') chooseBuddy(STARTERS[(i + 1) % STARTERS.length]);
      if (e.key === 'ArrowLeft') chooseBuddy(STARTERS[(i - 1 + STARTERS.length) % STARTERS.length]);
      if (e.key === 'Enter') next();
    } else if (step === 3 && e.key === 'Enter') finish();
  }
  const look = $derived(game.settings.look);
</script>

<svelte:window onkeydown={onKey} />

<div class="screen np">
  {#if game.profile}<GearButton floating />{/if}
  <div class="dots">{#each [1, 2, 3] as s}<i class:on={s <= step}></i>{/each}</div>

  {#if step === 1}
    <div class="step">
      <Critter friend="dino" {look} size={150} mood="dance" />
      <h1>Hi there! What's your name?</h1>
      <p class="muted">Type it in. That's your very first typing!</p>
      <input class="name" bind:this={nameInput} bind:value={name} maxlength="16" onkeydown={onNameKey} placeholder="Your name" autocomplete="off" spellcheck="false" />
      <button class="btn btn-primary btn-big" disabled={!name.trim()} onclick={next}>Next</button>
      <SaveCodeForm />
    </div>
  {:else if step === 2}
    <div class="step">
      <h1>Pick your buddy, {name.trim()}!</h1>
      <p class="muted">Your buddy rides along with you on every trail. Fifteen more Keypals join your team as you play, and you can switch any time without losing a thing.</p>
      <div class="buddies">
        {#each BUDDIES.filter(b => STARTERS.includes(b.id)) as f (f.id)}
          <button class="buddy" class:on={buddy === f.id} onclick={() => chooseBuddy(f.id)} aria-pressed={buddy === f.id}>
            <Critter friend={f.id} {look} size={110} pulse={buddy === f.id ? pulse : null} quirkOnHover />
            <span class="bname">{f.name}</span>
          </button>
        {/each}
      </div>
      <p class="quirk">{BUDDIES.find(c => c.id === buddy)?.quirk}</p>
      <div class="row"><button class="btn" onclick={() => (step = 1)}>Back</button><button class="btn btn-primary btn-big" onclick={next}>That's my buddy!</button></div>
    </div>
  {:else}
    <div class="step">
      <h1>Almost ready!</h1>
      <div class="choices">
        <button class="choice card" class:on={!grown} onclick={() => (grown = false)}>
          <Critter friend={buddy} {look} size={100} mood="dance" />
          <b>I'm a kid</b><span>Bright, bouncy and just right for ages 7 to 12.</span>
        </button>
        <button class="choice card" class:on={grown} onclick={() => (grown = true)}>
          <Critter friend={buddy} {look} size={100} accessory="detective" />
          <b>I'm a grown-up</b><span>Faster goals and longer reading, same fun crew.</span>
        </button>
      </div>
      <label class="layout">
        Keyboard
        <select bind:value={layout}>
          {#each LAYOUT_LIST as l}<option value={l.id}>{l.name}</option>{/each}
        </select>
        {#if detected}<span class="muted">(looks like {LAYOUT_LIST.find(l => l.id === detected)?.name})</span>{/if}
      </label>
      <div class="row"><button class="btn" onclick={() => (step = 2)}>Back</button><button class="btn btn-mint btn-big" onclick={finish}>Let's go!</button></div>
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
  .name { font: 600 40px/1 var(--font-type); text-align: center; padding: 14px 20px; width: min(420px, 90vw); border-radius: 22px; border: 3px solid var(--line); background: #fff; color: var(--ink); outline: none; box-shadow: var(--shadow-sm); }
  .name:focus { border-color: var(--primary-hi); }
  .buddies { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; }
  .buddy { display: flex; flex-direction: column; align-items: center; background: rgba(255, 255, 255, .7); border: 3px solid transparent; border-radius: 22px; padding: 10px 8px 8px; cursor: pointer; transition: transform .15s, border-color .15s, background .15s; }
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
  @media (max-width: 760px) { .buddies { grid-template-columns: repeat(3, 1fr); } }
</style>
