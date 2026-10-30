<script lang="ts">
  // The class trophy: a cup that fills up as the class's right answers this week climb toward the goal,
  // bronze, then silver, then gold with sparkles when the goal is reached.
  import { trophy } from '../boards';
  type Props = { right: number; goal: number; size?: number };
  let { right, goal, size = 90 }: Props = $props();
  const t = $derived(trophy(right, goal));
  const metal = $derived(['#ecd3b4', '#d08a4e', '#b9c3cf', '#f2c230'][t.stage]);
  const deep = $derived(['#b8936a', '#a0602c', '#8794a3', '#c9950c'][t.stage]);
  // the cup's inside runs from y=58 (empty) up to y=14 (full)
  const level = $derived(58 - 44 * t.fill);
  const uid = `cup${Math.random().toString(36).slice(2, 8)}`;
</script>

<svg class="trophy" width={size} height={size * 1.1} viewBox="0 0 100 110" role="img" aria-label="Class trophy: {Math.round(t.fill * 100)}% of this week's goal">
  <defs>
    <clipPath id={uid}><path d="M26 12h48v22c0 15-11 26-24 26S26 49 26 34z" /></clipPath>
  </defs>
  <path d="M26 18H12c0 16 8 24 18 24M74 18h14c0 16-8 24-18 24" fill="none" stroke={deep} stroke-width="5" stroke-linecap="round" />
  <path d="M26 12h48v22c0 15-11 26-24 26S26 49 26 34z" fill="#fff" stroke={deep} stroke-width="3" />
  <g clip-path="url(#{uid})">
    <rect x="20" y={level} width="60" height="60" fill={metal} />
    <rect x="20" y={level} width="60" height="4" fill="#fff" opacity=".45" />
  </g>
  <path d="M26 12h48v22c0 15-11 26-24 26S26 49 26 34z" fill="none" stroke={deep} stroke-width="3" />
  <rect x="44" y="60" width="12" height="18" fill={deep} />
  <rect x="30" y="78" width="40" height="10" rx="3" fill={metal} stroke={deep} stroke-width="2.5" />
  <rect x="24" y="88" width="52" height="12" rx="4" fill={deep} />
  {#if t.stage === 3}
    <g fill="#ffd83a" stroke="#c9950c" stroke-width="1">
      <path d="M10 6l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" /><path d="M88 52l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z" /><path d="M86 2l1.2 3 3 1.2-3 1.2-1.2 3-1.2-3-3-1.2 3-1.2z" />
    </g>
  {/if}
</svg>

<style>
  .trophy { display: block; flex: none; }
</style>
