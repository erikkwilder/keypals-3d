<script lang="ts">
  // A buddy's picture, rendered from the 3D character with a see-through background (src/dev/portraits.ts):
  // the full body, or head and shoulders when `round`. Screens that show a
  // buddy moving use the 3D stage instead; this is for lists, buttons and small spots. The props match
  // the old animated keypal so every screen keeps working; moods become gentle CSS motion.
  import { FRIEND, type FriendId } from '../art/cast';

  type Props = {
    friend: FriendId;
    look?: unknown;
    accessory?: string;
    size?: number | string;
    mood?: '' | 'joy' | 'sleep' | 'dance' | 'running' | 'idle';
    pulse?: { kind: string; n: number } | null;
    quirkOnHover?: boolean;
    title?: string;
    lite?: boolean;
    still?: boolean;
    followPointer?: boolean;
    expression?: unknown;
    sleepAfter?: number;
    feet?: boolean;
    round?: boolean;
  };
  let { friend, size = 120, mood = '', pulse = null, title, still = false, round = false }: Props = $props();
  const px = $derived(typeof size === 'number' ? `${size}px` : size);
  const src = $derived(`${import.meta.env.BASE_URL}portraits/${FRIEND[friend]?.id ?? 'dino'}${round ? '-head' : ''}.png`);
  let hop = $state(0);
  $effect(() => { if (pulse && pulse.n > 0) hop++; });
</script>

<div class="critter-host" class:round class:dance={mood === 'dance' && !still} class:sleep={mood === 'sleep'} class:run={mood === 'running' && !still} style:width={px} style:height={px} title={title ?? FRIEND[friend]?.name}>
  {#key hop}<img {src} alt={FRIEND[friend]?.name ?? ''} class:hop={hop > 0} draggable="false" />{/key}
</div>

<style>
  .critter-host { flex: none; position: relative; display: grid; place-items: end center; }
  .critter-host.round { border-radius: 50%; overflow: hidden; background: radial-gradient(circle at 50% 35%, #fff, #e3eefb); box-shadow: inset 0 0 0 2px rgba(255, 255, 255, .9); }
  .critter-host.round img { object-position: center; }
  img { width: 100%; height: 100%; object-fit: contain; object-position: bottom; user-select: none; }
  .dance img { animation: bob .6s ease-in-out infinite alternate; transform-origin: 50% 100%; }
  .run img { animation: bob .28s ease-in-out infinite alternate; transform-origin: 50% 100%; }
  .sleep img { filter: saturate(.7); transform: rotate(-6deg); }
  img.hop { animation: hop .45s cubic-bezier(.3, .8, .4, 1.4); }
  @keyframes bob { from { transform: translateY(0) rotate(-3deg); } to { transform: translateY(-6%) rotate(3deg); } }
  @keyframes hop { 0% { transform: translateY(0); } 40% { transform: translateY(-14%) scale(1.04); } 100% { transform: translateY(0); } }
</style>
