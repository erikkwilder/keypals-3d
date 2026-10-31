<script lang="ts">
  // A small star, the same star on every Look card in Settings, drawn the way that Look draws things
  // (three/looks.ts): Soft Squish smooth and glowing with no edge; Ink Sticker a thick dark outline with a
  // shine; Paper Craft flat colour with a cream cut edge, lying on the page; Geo Pop flat facets with a
  // thin crease in a deeper shade of its own colour.
  import type { Look } from '../art/cast';
  let { look }: { look: Look } = $props();

  const C = 50, M = 53, R = 40;
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? R * 0.52 : R;
    return [C + r * Math.cos(a), M + r * Math.sin(a)] as const;
  });
  const at = (p: readonly [number, number]) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
  const star = `M${pts.map(at).join('L')}Z`;
  // a facet from the middle to each edge: the two sides of each point light and dark, brighter to the upper left
  const FLAT = ['#ffd2b0', '#ffb07e', '#ff8f57', '#ec6d38', '#c9522a'];
  const facets = pts.map((p, i) => {
    const q = pts[(i + 1) % 10], a = -Math.PI / 2 + ((i + 0.5) * Math.PI) / 5;
    const lit = -0.6 * Math.cos(a) - 0.8 * Math.sin(a);
    return { d: `M${C} ${M}L${at(p)}L${at(q)}Z`, fill: FLAT[Math.max(0, Math.min(4, Math.round(2 - lit * 1.5 + (i % 2 ? 0.8 : -0.8))))] };
  });
</script>

<svg class="emblem" viewBox="0 0 100 100" aria-hidden="true">
  {#if look === 'soft'}
    <defs>
      <radialGradient id="le-soft" cx="38%" cy="32%" r="80%"><stop offset="0" stop-color="#ffe2cd" /><stop offset=".5" stop-color="#ffa876" /><stop offset="1" stop-color="#ff7a4d" /></radialGradient>
      <filter id="le-blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5" /></filter>
    </defs>
    <path d={star} fill="#fff" stroke="#fff" stroke-width="16" stroke-linejoin="round" opacity=".85" filter="url(#le-blur)" />
    <path d={star} fill="url(#le-soft)" stroke="url(#le-soft)" stroke-width="11" stroke-linejoin="round" />
  {:else if look === 'ink'}
    <path d={star} fill="#ff8f57" stroke="#2a1b3d" stroke-width="9" stroke-linejoin="round" />
    <path d="M38 40q3-9 10-13" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".9" />
  {:else if look === 'paper'}
    <path d={star} transform="translate(3 5)" fill="#5a3c1e" stroke="#5a3c1e" stroke-width="11" stroke-linejoin="miter" stroke-miterlimit="8" opacity=".3" />
    <path d={star} fill="#fff3dc" stroke="#fff3dc" stroke-width="11" stroke-linejoin="miter" stroke-miterlimit="8" />
    <path d={star} fill="#ff8f57" />
  {:else}
    {#each facets as f (f.d)}<path d={f.d} fill={f.fill} stroke={f.fill} stroke-width=".4" />{/each}
    <path d={star} fill="none" stroke="#a83e1a" stroke-width="2.4" stroke-linejoin="miter" stroke-miterlimit="8" />
  {/if}
</svg>

<style>
  .emblem { display: block; width: 100%; height: 100%; }
</style>
