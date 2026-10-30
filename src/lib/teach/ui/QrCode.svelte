<script lang="ts">
  // A QR code as a crisp SVG (prints sharp at any size): black on white with the quiet border scanners need.
  import { qrMatrix, qrPath } from '../qr';
  type Props = { text: string; size?: number; label?: string };
  let { text, size = 120, label = 'QR code' }: Props = $props();
  const m = $derived(qrMatrix(text));
  const view = $derived(m.length + 8);
</script>

<svg class="qr" width={size} height={size} viewBox="0 0 {view} {view}" role="img" aria-label={label} shape-rendering="crispEdges">
  <rect width={view} height={view} fill="#fff" />
  <path d={qrPath(m)} fill="#000" />
</svg>

<style>
  .qr { display: block; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style>
