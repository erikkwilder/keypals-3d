<script lang="ts">
  // On "Who's playing?": a big "I'm in a class" for students logging in at school, and a small "For
  // teachers" link to the teacher area.
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { cloud } from '../state/cloud.svelte';
  import { openTeach } from '../teach/teacher.svelte';
</script>

{#if cloud.online}
  <div class="ce">
    <button class="btn btn-mint cls" onclick={() => { sfx.click(); game.go('classLogin'); }}><img src="{import.meta.env.BASE_URL}icons/book.webp" alt="" />I'm in a class</button>
    <button class="tlink" onclick={() => openTeach('players')}>For teachers</button>
  </div>
{/if}

<style>
  .ce { display: flex; flex-direction: column; align-items: center; gap: 6px; margin-top: 18px; }
  .cls { display: inline-flex; align-items: center; gap: 8px; font-size: 20px; }
  .cls img { width: 34px; height: 34px; object-fit: contain; margin: -6px 0; }
  .tlink { background: none; border: 0; font: 700 14px var(--font-body); color: var(--muted); text-decoration: underline; cursor: pointer; padding: 4px; }
  .tlink:hover { color: var(--primary); }
</style>
