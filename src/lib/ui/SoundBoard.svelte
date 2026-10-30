<script lang="ts">
  // Every sound in the game, in plain words, with a Play button: open the game with #sounds on the
  // address. The same moment makes the same sound everywhere; docs/sound-map.md says why each one sounds
  // the way it does.
  import { preloadSfx, sfx, unlockAudio } from '../audio/sound';
  import { game } from '../state/game.svelte';

  type Item = { say: string; like: string; play: () => void };
  type Group = { name: string; blurb: string; items: Item[] };
  const later = (ms: number, f: () => void) => setTimeout(f, ms);
  // the recorded ones (eggshell cracks, splashes, wooden blocks) load ahead so the first Play isn't late
  preloadSfx('egg-crack-1', 'egg-crack-2', 'egg-crack-3', 'egg-crack-4', 'splash-1', 'splash-2', 'block-1', 'block-2');

  const GROUPS: Group[] = [
    {
      name: 'Answers and typing', blurb: 'Only your own wrong answer ever sounds "wrong", and softly.',
      items: [
        { say: 'A right key', like: 'a little note for the finger you used', play: () => sfx.key('LI') },
        { say: 'Your answer wasn\'t right', like: 'a soft "boo-op", two notes down', play: () => sfx.miss() },
        { say: 'A wrong key while typing', like: 'a tiny muted tap', play: () => sfx.slip() },
        { say: 'A hint lights up', like: '"bing!"', play: () => sfx.hint() },
      ],
    },
    {
      name: 'Buttons and screens', blurb: 'Quiet and quick.',
      items: [
        { say: 'Tap a button', like: 'a click', play: () => sfx.click() },
        { say: 'Open a card, pick a tab', like: 'a bubbly pop', play: () => sfx.pop() },
        { say: 'Off we go (a lesson, a trip, a game)', like: 'an airy whoosh that swells up into a bright two-note chime', play: () => sfx.whoosh() },
        { say: 'Locked, or not enough shells', like: 'two soft knocks ("not yet")', play: () => sfx.nope() },
      ],
    },
    {
      name: 'Battles', blurb: 'The grumpy Glimmer grumbles like a cartoon, never like a buzzer. Watch-out sounds go up.',
      items: [
        { say: 'A battle starts', like: 'two drum hits, a rising "here we go" and a bright chord with a sparkle (no grumpy "hmph" on the end)', play: () => sfx.battleStart() },
        { say: 'The grumpy Glimmer, on its own', like: 'a wobbly cartoon "hmph-hmph"', play: () => sfx.grumble() },
        { say: 'A power flies (sun, tide, frost, leaf, stone)', like: 'each element has its own swoosh', play: () => { (['sun', 'tide', 'frost', 'leaf', 'stone'] as const).forEach((el, i) => later(i * 650, () => sfx.cast(el))); } },
        { say: 'The cheer lands (small, then big)', like: 'a soft thump and notes going up', play: () => { sfx.hit(0.2); later(650, () => sfx.hit(1)); } },
        { say: 'Perfect Cheer', like: 'a bright fanfare', play: () => sfx.perfect() },
        { say: 'A team Glimmer or gear helps', like: 'a bright chime', play: () => sfx.helper() },
        { say: 'Energy back', like: 'three soft rising notes', play: () => sfx.heal() },
        { say: 'Frozen!', like: 'icy sparkles', play: () => sfx.freeze() },
        { say: 'Rain (or a zap) is coming', like: 'far-off thunder and a rising "dee-DEE!"', play: () => sfx.rainComing() },
        { say: 'The zap flies', like: 'a cartoon crackle', play: () => sfx.zap() },
        { say: 'You blocked it', like: 'a glassy chime', play: () => sfx.shield(true) },
        { say: 'You blocked half of it', like: 'the chime with a crack', play: () => sfx.shield(false) },
        { say: 'It landed on you', like: 'a splash and pitter-patter drops', play: () => sfx.rainHit() },
        { say: 'The Finale stars are full', like: '"ding, ding, DING!"', play: () => sfx.finaleReady() },
        { say: 'Finale!', like: 'a drum roll and a big chord', play: () => sfx.finale() },
        { say: 'Aurora (the Finale is ready all at once)', like: 'a shimmering wash', play: () => sfx.aurora() },
        { say: 'You cheered it up!', like: 'a swish, a POP, a happy run up', play: () => sfx.cheeredUp() },
        { say: 'Out of energy', like: 'a soft "aww", then a little lift (next time!)', play: () => sfx.tryAgain() },
      ],
    },
    {
      name: 'Family Duel and Rival Ghosts', blurb: 'Someone else\'s turn or miss never sounds like your mistake.',
      items: [
        { say: 'Player 1\'s turn', like: 'a friendly doorbell', play: () => sfx.turn(0) },
        { say: 'Player 2\'s turn', like: 'the doorbell, a little lower', play: () => sfx.turn(1) },
        { say: 'You send a rain cloud over', like: 'a cheeky "fwoosh", a boing up and a "ding-ding!" (it\'s good for you)', play: () => sfx.rainSend() },
        { say: 'A ghost\'s power didn\'t land', like: 'a soft puff', play: () => sfx.fizzle() },
        { say: 'Last turn!', like: 'a drum and two notes going up', play: () => sfx.lastTurn() },
      ],
    },
    {
      name: 'Prizes', blurb: 'Good things go up; bigger prizes get longer fanfares.',
      items: [
        { say: 'Stars on the results (1, 2, 3)', like: 'three notes, each higher', play: () => [0, 1, 2].forEach(i => later(i * 330, () => sfx.star(i))) },
        { say: 'Finished! (a lesson, a trip, a practice stop)', like: 'a four-note fanfare', play: () => sfx.complete() },
        { say: 'A medal', like: 'two bright notes and a sparkle', play: () => sfx.medal() },
        { say: 'Something new is yours (outfit, dance, buddy, egg)', like: 'a twinkle and a bell', play: () => sfx.unlock() },
        { say: 'Bought with shells', like: 'shells clink, then a bell', play: () => sfx.buy() },
        { say: 'Put it on (an outfit, gear, a team Glimmer)', like: '"fwip" and a ding', play: () => sfx.equip() },
        { say: 'Friendship goes up a level', like: 'a rising run and a shimmer', play: () => sfx.levelUp(3) },
        { say: 'Treasure (a small one, then a big one)', like: 'a rising run, longer for better treasure', play: () => { sfx.treasure(1); later(1500, () => sfx.treasure(8)); } },
        { say: 'An egg hatches', like: 'three real eggshell cracks, each bigger, then the shell bursting open', play: () => { [1, 2, 3].forEach(i => later((i - 1) * 650, () => sfx.crack(i))); later(2050, () => sfx.crack(4)); later(2150, () => sfx.reveal(2)); } },
        { say: 'A Glimmer appears (common, then legendary)', like: 'a run up, grander for rarer ones', play: () => { sfx.reveal(0); later(1900, () => sfx.reveal(4)); } },
        { say: 'A Glimmer evolves', like: 'a hum that climbs, then a sweep into its reveal', play: () => { [0, 1, 2, 3].forEach(i => later(i * 700, () => sfx.evolveCharge(i))); later(2800, () => sfx.evolve(3)); } },
        { say: 'A little "yay" (the hands cheer in a finger lesson)', like: 'three quick notes up', play: () => sfx.cheer() },
      ],
    },
    {
      name: 'Games', blurb: 'The Arcade, Pizza Rush and Glimmer Drop: whooshes swell in and go up.',
      items: [
        { say: 'Cut the pizza', like: 'a crisp "shhk" and a tick', play: () => sfx.slice() },
        { say: 'Steering the sled', like: 'a soft "shff" of snow', play: () => sfx.carve() },
        { say: 'Squeaking past a gate', like: 'a swell and a bright note', play: () => sfx.nearMiss() },
        { say: 'An egg drops into the jar', like: 'a little rising "fwip"', play: () => sfx.dropEgg() },
        { say: 'A gust of wind', like: 'a breathy swell and a whistle up', play: () => sfx.gust() },
        { say: 'Sky Slalom: the wind as you speed up', like: 'soft air that swells and brightens with the speed, then fades', play: () => { let v = 0.15; const id = setInterval(() => { v = Math.min(1, v + 0.012); sfx.wind(v); }, 30); later(2600, () => clearInterval(id)); } },
        { say: 'Through a boost ring', like: 'an airy swell and "ting-ting-ting!" going up', play: () => sfx.ringPass() },
        { say: 'Turbo is ready', like: 'a bright "ding-DING!" with a shimmer', play: () => sfx.turboReady() },
        { say: 'Turbo!', like: 'a rocket "vwoooom" that climbs, then a bright chord', play: () => sfx.turbo() },
        { say: 'Tower Stack: the crane brings a block', like: 'three soft wooden ticks', play: () => sfx.creak() },
        { say: 'A block drops', like: 'a soft whoosh that falls away', play: () => sfx.blockDrop() },
        { say: 'A block lands (low, then high on the tower)', like: 'a real wooden "tok"', play: () => { sfx.thunk(0); later(500, () => sfx.thunk(20)); } },
        { say: 'A perfect landing', like: 'the "tok", a sparkle and a ding', play: () => { sfx.thunk(4); sfx.sparkle(); sfx.ding(3); } },
        { say: 'A block misses the top', like: 'a soft puff and a cartoon "boing"', play: () => sfx.blockSlip() },
        { say: 'Pizza Rush: the next customer', like: 'a friendly shop bell, "ding-dong" going up', play: () => sfx.nextUp() },
      ],
    },
    {
      name: 'Little surprises', blurb: 'The Easter eggs (docs/easter-eggs.md): rare, and never about right or wrong.',
      items: [
        { say: 'A shooting star at the finish', like: 'a soft high sparkle falling away', play: () => sfx.twinkle() },
        { say: 'A flying saucer', like: 'a wobbly cartoon "wooo-OOO"', play: () => sfx.ufo() },
        { say: 'A fish leaps, Puddle Pup splashes', like: 'a real little splash and "plop"', play: () => sfx.splashSmall() },
        { say: 'Your buddy giggles (tickled on Home)', like: 'quick little rising squeaks', play: () => sfx.giggle() },
        { say: 'A sneeze (a tickled buddy, a grumpy Glimmer)', like: '"ah... ah... ACHOO!"', play: () => sfx.sneeze() },
        { say: 'A golden letter typed', like: 'a bright bell with a shimmer', play: () => sfx.golden() },
        { say: 'A secret word found', like: 'a little magic run up and back', play: () => sfx.secret() },
      ],
    },
  ];

  /** A whole battle, start to finish, so the sounds can be heard in order. */
  function wholeBattle() {
    const steps: [number, () => void][] = [
      [0, () => sfx.battleStart()],
      [2600, () => sfx.click()],
      [3300, () => sfx.cast('tide')], [3800, () => sfx.hit(0.4)],
      [5000, () => sfx.rainComing()],
      [6400, () => sfx.shield(true)],
      [7400, () => sfx.click()], [7900, () => sfx.miss()],
      [9000, () => sfx.cast('sun')], [9500, () => sfx.hit(0.6)], [9800, () => sfx.finaleReady()],
      [11000, () => sfx.finale()],
      [13600, () => sfx.hit(1)],
      [14400, () => sfx.cheeredUp()],
      [15300, () => sfx.reveal(2)],
    ];
    steps.forEach(([ms, f]) => later(ms, f));
  }

  let open = $state(true);
  const off = $derived(game.settings.sound === false);
  function close() { open = false; history.replaceState(null, '', location.pathname + location.search); }
  function play(f: () => void) { unlockAudio(); f(); }
</script>

{#if open}
  <div class="board" role="dialog" aria-label="Every sound in the game">
    <header>
      <div>
        <h1>Every sound in Keypals</h1>
        <p>Tap Play to hear each one. The same moment makes the same sound in battles, duels, trips and lessons.</p>
        {#if off}<p class="warn">Sound is off in Settings for this player, so these will be silent.</p>{/if}
      </div>
      <div class="top">
        <button class="btn btn-primary" onclick={() => play(wholeBattle)}>▶ Hear a whole battle</button>
        <button class="btn" onclick={close}>Close</button>
      </div>
    </header>
    {#each GROUPS as g (g.name)}
      <section>
        <h2>{g.name}</h2>
        <p class="blurb">{g.blurb}</p>
        <ul>
          {#each g.items as it (it.say)}
            <li>
              <button class="play" onclick={() => play(it.play)} aria-label="Play: {it.say}">▶</button>
              <div><b>{it.say}</b><span>{it.like}</span></div>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>
{/if}

<style>
  .board { position: fixed; inset: 0; z-index: 9999; overflow: auto; background: #fbfaff; color: var(--ink); padding: 20px 16px 40px; font-family: var(--font-body); }
  header { max-width: 900px; margin: 0 auto 8px; display: flex; gap: 16px; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; }
  h1 { margin: 0 0 4px; font: 600 30px var(--font-ui); }
  header p { margin: 0; font-size: 16px; color: var(--ink2); max-width: 560px; }
  .warn { margin-top: 6px !important; color: #b02a48 !important; font-weight: 700; }
  .top { display: flex; gap: 8px; flex-wrap: wrap; }
  section { max-width: 900px; margin: 18px auto 0; background: #fff; border-radius: 20px; padding: 14px 16px; box-shadow: var(--shadow-sm); }
  h2 { margin: 0; font: 600 22px var(--font-ui); }
  .blurb { margin: 2px 0 10px; color: var(--muted); font-size: 15px; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr)); gap: 8px; }
  li { display: flex; gap: 12px; align-items: center; background: #f6f3fd; border-radius: 14px; padding: 8px 10px; }
  li b { display: block; font: 700 16px/1.25 var(--font-body); }
  li span { display: block; font-size: 14px; color: var(--muted); }
  .play { flex: none; width: 44px; height: 44px; border-radius: 50%; border: 0; cursor: pointer; background: linear-gradient(160deg, #7bd88f, #3fb26a); color: #fff; font-size: 18px; box-shadow: 0 3px 0 #2e8a51; }
  .play:active { transform: translateY(2px); box-shadow: 0 1px 0 #2e8a51; }
</style>
