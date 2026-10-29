<script lang="ts" module>
  import { danceIconUrl, gameIconUrl, iconUrl } from '../art/icons';
  import { DANCES } from '../engine/rewards';
  const DANCE_IDS = new Set(DANCES.map(d => d.id));
  // every small icon is a painted picture (public/icons/, the home set in public/game/)
  const SRC = {
    back: iconUrl('back'), next: iconUrl('play'), play: iconUrl('play'), replay: iconUrl('redo'), close: iconUrl('close'), check: iconUrl('check'),
    home: gameIconUrl('home'), gear: gameIconUrl('settings'), sticker: gameIconUrl('stickers'), medal: gameIconUrl('medals'), dance: gameIconUrl('dances'),
    keyboard: gameIconUrl('typing'), star: gameIconUrl('star'), water: gameIconUrl('tide'), shell: gameIconUrl('shell'),
    lock: iconUrl('lock'), flag: iconUrl('flag'), book: iconUrl('book'), bulb: iconUrl('bulb'), target: iconUrl('target'), clock: iconUrl('clock'),
    pencil: iconUrl('pencil'), trophy: iconUrl('trophy'), map: iconUrl('map'), music: iconUrl('note'), sound: iconUrl('sfx'), hand: iconUrl('demo'),
    user: iconUrl('players'), hanger: iconUrl('outfits'), cap: iconUrl('coach'), heart: iconUrl('heart'), gift: iconUrl('gift'), ghost: iconUrl('ghost'),
    finish: iconUrl('finish'), bolt: iconUrl('bolt'), swap: iconUrl('swap'), gem: iconUrl('gem'), bloom: iconUrl('bloom'), popper: iconUrl('popper'),
    sparkle: iconUrl('sparkle'), scroll: iconUrl('scroll'), shield: iconUrl('shield'), pause: iconUrl('pause'), erase: iconUrl('erase'),
    can: iconUrl('can'), mail: iconUrl('mail'), chart: iconUrl('chart'), garden: iconUrl('garden'), line: iconUrl('line'),
    bubbles: iconUrl('bubbles'), blocks: iconUrl('blocks'), players: iconUrl('players'), help: iconUrl('help'),
    // the Move it pad
    up: iconUrl('up'), down: iconUrl('down'), left: iconUrl('left'), right: iconUrl('right'), closer: iconUrl('closer'), further: iconUrl('further'),
    bigger: iconUrl('bigger'), smaller: iconUrl('smaller'), turnleft: iconUrl('turnleft'), turnright: iconUrl('turnright'), reset: iconUrl('reset'),
    run: iconUrl('ride-run-1'), climb: iconUrl('ride-climb-1'), slide: iconUrl('ride-slide-2'), swim: iconUrl('ride-swim-2'),
  } as const;
  export type IconName = keyof typeof SRC;
</script>

<script lang="ts">
  /** `dance`: with name "dance", that dance's own picture instead of the disco ball */
  type Props = { name: IconName; size?: number; dance?: string };
  let { name, size = 22, dance }: Props = $props();
</script>

<img class="ico" src={name === 'dance' && dance && DANCE_IDS.has(dance) ? danceIconUrl(dance) : SRC[name]} width={size} height={size} alt="" aria-hidden="true" draggable="false" />

<style>
  .ico { flex: none; display: inline-block; vertical-align: middle; object-fit: contain; user-select: none; }
</style>
