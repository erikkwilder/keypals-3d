<script lang="ts">
  // The top of a page: the one top bar (ui/Bar.svelte), with this page's title. Back goes up one level
  // (or back to where a cross-link came from); `back` is only for a page with something to finish first
  // (a move not saved yet) or for Settings opened over another screen.
  import Bar from './Bar.svelte';
  type Props = { title?: string; back?: () => void; overlay?: boolean };
  let { title, back, overlay = false }: Props = $props();
</script>

<Bar {title} {back} {overlay} />
