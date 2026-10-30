<script lang="ts">
  // The music, opened from the note on the top bar of every page (the same as on the Pause card): what's
  // playing, the next song, pick a station, and music and sounds on or off. On a phone it's at the top of
  // the Menu instead (ui/GlobalMenu.svelte).
  import Popover from './Popover.svelte';
  import MusicNow from './MusicNow.svelte';
  import QuickToggles from './QuickToggles.svelte';

  type Props = { anchor: HTMLElement | null; onclose: () => void };
  let { anchor, onclose }: Props = $props();
  const base = import.meta.env.BASE_URL;
</script>

<Popover {anchor} {onclose} label="Music" width={400}>
  <div class="head"><img src="{base}icons/note.webp" alt="" /><b>Music</b></div>
  <MusicNow onpick={onclose} />
  <div class="qt"><QuickToggles /></div>
</Popover>

<style>
  .head { display: flex; align-items: center; gap: 10px; padding-right: 40px; margin-bottom: 10px; }
  .head img { width: 44px; height: 44px; object-fit: contain; }
  .head b { font: 600 26px/1.1 var(--font-ui); color: var(--ink); }
  .qt { margin-top: 12px; padding-top: 10px; border-top: 2px dashed #ece6f6; display: flex; justify-content: center; }
</style>
