<script lang="ts">
  // The buttons on a math game's end card, the same on all of them. Started from the path, the big button is
  // the next thing there (path/next.ts), or back to the trail from a Journey stop. Play again and Today's
  // challenge stay beside it, unless a grown-up or teacher is keeping the child to the path or this was a stop
  // on the trail: there the one way on is the next stop.
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import type { Exits } from '../arcade/exits';
  import ExitButtons from '../arcade/ui/ExitButtons.svelte';
  import PathNextButton from './PathNextButton.svelte';
  import { mayRepeat, pathNext } from './next';

  type Props = { activity: string; exits: Exits; daily: boolean; onagain: (daily: boolean) => void; before?: () => void };
  let { activity, exits, daily, onagain, before }: Props = $props();
  const next = $derived(pathNext(game.profile, activity));
  const again = $derived(mayRepeat(game.profile, activity));
  /** (a phone has no Enter key to show) */
  const keys = innerWidth >= 700;
</script>

{#if next}<PathNextButton {next} compact wide hotkey={keys ? 'enter' : undefined} />{/if}
{#if !next?.trail}<ExitButtons {exits} {before} />{/if}
{#if again}
  {#if !daily}<button class="btn" onclick={() => onagain(true)}>Today's challenge</button>{/if}
  <button class="btn" class:btn-primary={!next} class:big={!next} onclick={() => { sfx.click(); onagain(daily); }}>Play again {#if !next}<span class="kbd">enter</span>{/if}</button>
{/if}

<style>
  .big { font-size: 22px; padding: 12px 26px; }
</style>
