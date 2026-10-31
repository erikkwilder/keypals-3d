<script lang="ts">
  // Which player an episode plays in. Most Learn episodes are the classic kind (EpisodeClassic.svelte:
  // steps, the buddy's mistake, two turns, a card). A rebuilt one is a beat lesson (math/beats): a little
  // silent film that waits for the child's answers and acts each one out. `<id>~old` plays the classic
  // version of a rebuilt lesson, to compare the two.
  import EpisodeClassic from './EpisodeClassic.svelte';
  import BeatEpisode from '../beats/BeatEpisode.svelte';
  import { BEAT_LESSON } from '../beats/lessons';

  type Props = { id: string; embedded?: boolean; check?: boolean; onclose: () => void; onpractice?: () => void; onwatch?: () => void };
  let { id, embedded = false, check = false, onclose, onpractice, onwatch }: Props = $props();
  const beat = $derived(BEAT_LESSON[id]);
  const plain = $derived(id.replace(/~old$/, ''));
</script>

{#if beat}
  <BeatEpisode lesson={beat} {embedded} {check} {onclose} {onpractice} {onwatch} />
{:else}
  <EpisodeClassic id={plain} {embedded} {check} {onclose} {onpractice} {onwatch} />
{/if}
