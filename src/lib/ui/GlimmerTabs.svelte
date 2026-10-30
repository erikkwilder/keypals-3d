<script lang="ts">
  // Glimmers is one place with two tabs: My team (the ones you have, and who comes into battles) and All 100
  // (the Glimmer Book: every Glimmer and how each one comes). Switching tabs isn't a step: Back leaves Glimmers.
  import { game } from '../state/game.svelte';
  import { advView } from '../adventure/state';
  import { GLIMMER_TOTAL } from '../adventure/glimmers';
  import PageTabs from './PageTabs.svelte';
  const p = $derived(game.profile!);
  const met = $derived(Object.keys(advView(p).glimmers).length);
</script>

<PageTabs label="Glimmers" value={game.glimmerTab === 'all' ? 'all' : 'team'} onpick={(t) => (game.glimmerTab = t as 'team' | 'all')}
  tabs={[{ id: 'team', label: 'My team', small: `(${met})` }, { id: 'all', label: `All ${GLIMMER_TOTAL}`, small: `(${met} met)` }]} />
