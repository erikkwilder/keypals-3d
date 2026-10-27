<script lang="ts">
  import { game } from '../state/game.svelte';
  import { outfitOf } from '../engine/profile';
  import { MAX_PROFILES, totalStars } from '../engine/profile';
  import { RIDES } from '../engine/rides';
  import { rideIcon } from '../art/vehicles';
  import { sfx } from '../audio/sound';
  import Critter from '../ui/Critter.svelte';
  import GearButton from '../ui/GearButton.svelte';
  import Logo from '../ui/Logo.svelte';
  import SaveCodeForm from '../ui/SaveCodeForm.svelte';

  function pick(id: string) {
    sfx.click();
    game.choose(id);
    game.go('map');
  }
</script>

<div class="screen players">
  {#if game.profile}<GearButton floating />{/if}
  <div class="top"><Logo size={40} animate={false} /></div>
  <h2>Who's typing today?</h2>
  <div class="grid">
    {#each game.save.profiles as p, i (p.id)}
      <button class="pcard card" style:animation-delay="{i * 60}ms" onclick={() => pick(p.id)}>
        <Critter friend={p.buddy} look={p.settings.look} accessory={outfitOf(p)} size={130} quirkOnHover />
        <div class="name">{p.name}</div>
        <div class="meta">
          <span class="star">★ {totalStars(p)}</span>
          <span class="ride" title="Best ride: {RIDES[p.rideBest].name}"><svg viewBox="0 0 48 48" width="20" height="20">{@html rideIcon(p.rideBest, 'var(--primary)')}</svg>{RIDES[p.rideBest].name}</span>
          {#if p.settings.grown}<span class="tag">grown-up</span>{/if}
        </div>
      </button>
    {/each}
    {#if game.save.profiles.length < MAX_PROFILES}
      <button class="pcard card add" onclick={() => game.go('newPlayer')}>
        <div class="plus">+</div>
        <div class="name">New player</div>
      </button>
    {/if}
  </div>
  <SaveCodeForm />
  <div class="foot">
    <button class="btn btn-ghost" onclick={() => game.go('title')}>Back</button>
    <button class="btn btn-ghost" onclick={() => game.go('grownups')}>Grown-ups</button>
  </div>
</div>

<style>
  .players { display: flex; flex-direction: column; align-items: center; padding: 30px 24px; background: radial-gradient(circle at 20% 10%, #ffe6f2 0, transparent 40%), radial-gradient(circle at 80% 20%, #dff1ff 0, transparent 42%), radial-gradient(circle at 50% 100%, #e3fbef 0, transparent 50%), var(--bg); overflow-y: auto; }
  .top { margin-bottom: 18px; }
  h2 { font-size: 38px; margin-bottom: 22px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px; width: min(1000px, 100%); }
  .pcard { display: flex; flex-direction: column; align-items: center; padding: 18px 14px 16px; cursor: pointer; transition: transform .15s; animation: fade-up .35s ease both; font: inherit; color: inherit; }
  .pcard:hover { transform: translateY(-4px) rotate(-1deg); }
  .pcard:focus-visible { outline: 3px solid var(--primary-hi); outline-offset: 3px; }
  .name { font: 600 24px/1.1 var(--font-ui); margin-top: 6px; }
  .meta { display: flex; gap: 10px; align-items: center; margin-top: 8px; font: 700 14px var(--font-body); color: var(--muted); flex-wrap: wrap; justify-content: center; }
  .star { color: var(--star-edge); }
  .ride { display: inline-flex; align-items: center; gap: 4px; }
  .tag { background: var(--bg2); padding: 2px 8px; border-radius: 999px; }
  .add { justify-content: center; border-style: dashed; background: rgba(255, 255, 255, .6); min-height: 230px; }
  .plus { width: 90px; height: 90px; border-radius: 50%; display: grid; place-items: center; font: 600 54px/1 var(--font-ui); background: var(--bg2); color: var(--primary); }
  .foot { margin-top: 26px; display: flex; gap: 12px; }
</style>
