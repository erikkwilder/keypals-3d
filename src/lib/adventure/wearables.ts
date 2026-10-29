// The wearables library: things to wear on the head, face, neck, back, in hand and on the feet, bought
// with shells in the Shop and put on in the Wardrobe. Practical and cool, cosy, fancy, sporty, magic and
// plain goofy, each with a line of its own. Each 3D piece (public/wear/<id>.glb) was painted first
// (gpt-image-2.5, in the game's style) and made into a full 3D model from the painting with Meshy, then
// tidied (about 12k triangles, a 1024 texture, origin at the attach point; glasses keep no arms, so they sit
// on the face). Feet are painted tiles that wrap the buddy's own feet. The wardrobe places each piece by its
// own box (wardrobe.ts, three/gear3d.ts).
export type WearSlot = 'head' | 'face' | 'neck' | 'back' | 'hand' | 'feet';
export type Wearable = {
  id: string; name: string; slot: WearSlot; rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  /** shells */
  price: number;
  /** one fun line with personality */
  text: string;
  vibe: 'cool' | 'cosy' | 'goofy' | 'fancy' | 'sporty' | 'magic';
  /** 'wear/<id>.glb' for head, face, neck, back, hand (Y up; the painted outside is +Z: a back piece is turned round to face out behind) */
  model?: string;
  /** feet: 'wear/tile-<id>.webp', a painted tile for the shoe shell */
  shoeTile?: string;
  /** head: width as a share of the head's; face: of the face's; neck: of the shoulders'; back: of the back's; hand: height as a share of the buddy's */
  size: number;
  /** head: how far it slides down over the head, as a share of its own height */
  sink?: number;
  /** 'wear/<id>.webp' */
  icon: string;
};

export const WEARABLES: Wearable[] = [
  // ---------- head ----------
  { id: 'pizza_hat', name: 'Pizza Slice Hat', slot: 'head', rarity: 'uncommon', price: 140, vibe: 'goofy', size: 1.15, sink: 0.25,
    model: 'wear/pizza_hat.glb', icon: 'wear/pizza_hat.webp', text: 'Extra cheese. Extra floppy. Smells a tiny bit like Friday.' },
  { id: 'jellyfish_hat', name: 'Jellyfish Hat', slot: 'head', rarity: 'rare', price: 260, vibe: 'magic', size: 1.2, sink: 0.35,
    model: 'wear/jellyfish_hat.glb', icon: 'wear/jellyfish_hat.webp', text: 'Glows a little. Wiggles a lot. Does not sting, promise.' },
  { id: 'croissant_crown', name: 'Croissant Crown', slot: 'head', rarity: 'rare', price: 240, vibe: 'fancy', size: 1.0, sink: 0.2,
    model: 'wear/croissant_crown.glb', icon: 'wear/croissant_crown.webp', text: 'Flaky, buttery and very royal. Try not to nibble it.' },
  { id: 'cactus_beanie', name: 'Cactus Beanie', slot: 'head', rarity: 'common', price: 70, vibe: 'cosy', size: 1.05, sink: 0.4,
    model: 'wear/cactus_beanie.glb', icon: 'wear/cactus_beanie.webp', text: 'Soft and fuzzy on the inside. Spiky-looking on the outside.' },
  { id: 'fishbowl_helmet', name: 'Fishbowl Helmet', slot: 'head', rarity: 'epic', price: 420, vibe: 'goofy', size: 1.2, sink: 0.25,
    model: 'wear/fishbowl_helmet.glb', icon: 'wear/fishbowl_helmet.webp', text: 'Meet Gerald. Gerald lives on your head now.' },
  { id: 'frog_bucket', name: 'Froggy Bucket Hat', slot: 'head', rarity: 'common', price: 60, vibe: 'cosy', size: 1.25, sink: 0.3,
    model: 'wear/frog_bucket.glb', icon: 'wear/frog_bucket.webp', text: 'Two googly frog eyes keep watch while you type.' },
  { id: 'shark_fin_cap', name: 'Shark Fin Cap', slot: 'head', rarity: 'uncommon', price: 150, vibe: 'cool', size: 1.3, sink: 0.1,
    model: 'wear/shark_fin_cap.glb', icon: 'wear/shark_fin_cap.webp', text: 'Dun-dun. Dun-dun. Dun-dun-dun-dun...' },
  { id: 'cupcake_hat', name: 'Cupcake Hat', slot: 'head', rarity: 'common', price: 80, vibe: 'cosy', size: 1.0, sink: 0.3,
    model: 'wear/cupcake_hat.glb', icon: 'wear/cupcake_hat.webp', text: 'Frosting on top, sprinkles everywhere, cherry on the very top.' },
  { id: 'robot_antennae', name: 'Robot Antennae', slot: 'head', rarity: 'uncommon', price: 120, vibe: 'cool', size: 1.0, sink: 0.15,
    model: 'wear/robot_antennae.glb', icon: 'wear/robot_antennae.webp', text: 'Beep boop. Picks up cartoons from three planets away.' },
  { id: 'unicorn_horn', name: 'Unicorn Horn', slot: 'head', rarity: 'rare', price: 280, vibe: 'magic', size: 0.55, sink: 0.1,
    model: 'wear/unicorn_horn.glb', icon: 'wear/unicorn_horn.webp', text: 'Sparkles every time you get one right. Maybe even more.' },
  { id: 'duck_toque', name: 'Chef Hat with a Duck', slot: 'head', rarity: 'uncommon', price: 130, vibe: 'goofy', size: 1.0, sink: 0.25,
    model: 'wear/duck_toque.glb', icon: 'wear/duck_toque.webp', text: 'The duck is the real chef. You are just the hat stand.' },
  { id: 'toadstool_cap', name: 'Toadstool Cap', slot: 'head', rarity: 'common', price: 50, vibe: 'cosy', size: 1.3, sink: 0.3,
    model: 'wear/toadstool_cap.glb', icon: 'wear/toadstool_cap.webp', text: 'Forest fashion. Snails think you are a very nice house.' },
  { id: 'moon_nightcap', name: 'Sleepy Moon Nightcap', slot: 'head', rarity: 'common', price: 60, vibe: 'cosy', size: 1.05, sink: 0.35,
    model: 'wear/moon_nightcap.glb', icon: 'wear/moon_nightcap.webp', text: 'For practising in your dreams. Snores sold separately.' },
  { id: 'traffic_cone', name: 'Traffic Cone Hat', slot: 'head', rarity: 'common', price: 40, vibe: 'goofy', size: 0.95, sink: 0.2,
    model: 'wear/traffic_cone.glb', icon: 'wear/traffic_cone.webp', text: 'Warning: extremely good at typing ahead.' },
  { id: 'sushi_hat', name: 'Sushi Hat', slot: 'head', rarity: 'uncommon', price: 110, vibe: 'goofy', size: 1.25, sink: 0.3,
    model: 'wear/sushi_hat.glb', icon: 'wear/sushi_hat.webp', text: 'A salmon nigiri so big it needed its own head.' },
  { id: 'dragon_crown', name: 'Dragon Hatchling Crown', slot: 'head', rarity: 'legendary', price: 600, vibe: 'magic', size: 1.25, sink: 0.2,
    model: 'wear/dragon_crown.glb', icon: 'wear/dragon_crown.webp', text: 'A real baby dragon naps on your head. It snores sparkles.' },
  // ---------- face ----------
  { id: 'star_shades', name: 'Star Shades', slot: 'face', rarity: 'common', price: 60, vibe: 'cool', size: 0.95,
    model: 'wear/star_shades.glb', icon: 'wear/star_shades.webp', text: 'Too cool for school. But still very cool at school.' },
  { id: 'googly_glasses', name: 'Googly-Eye Glasses', slot: 'face', rarity: 'common', price: 50, vibe: 'goofy', size: 0.95,
    model: 'wear/googly_glasses.glb', icon: 'wear/googly_glasses.webp', text: 'The eyes wobble when you jump. And when you think hard.' },
  { id: 'heart_specs', name: 'Heart Specs', slot: 'face', rarity: 'common', price: 60, vibe: 'cosy', size: 0.9,
    model: 'wear/heart_specs.glb', icon: 'wear/heart_specs.webp', text: 'Everything looks a little more lovely. Even broccoli.' },
  { id: 'pixel_shades', name: 'Pixel Shades', slot: 'face', rarity: 'uncommon', price: 150, vibe: 'cool', size: 1.0,
    model: 'wear/pixel_shades.glb', icon: 'wear/pixel_shades.webp', text: 'Deal with it. In 8-bit.' },
  { id: 'nose_glasses', name: 'Silly Disguise', slot: 'face', rarity: 'uncommon', price: 120, vibe: 'goofy', size: 0.9,
    model: 'wear/nose_glasses.glb', icon: 'wear/nose_glasses.webp', text: 'Nobody will ever know it is you. Nobody.' },
  { id: 'monocle_stache', name: 'Fancy Monocle', slot: 'face', rarity: 'rare', price: 240, vibe: 'fancy', size: 0.85,
    model: 'wear/monocle_stache.glb', icon: 'wear/monocle_stache.webp', text: 'Splendid. Simply splendid, old bean.' },
  { id: 'snorkel_mask', name: 'Snorkel Mask', slot: 'face', rarity: 'uncommon', price: 130, vibe: 'sporty', size: 1.0,
    model: 'wear/snorkel_mask.glb', icon: 'wear/snorkel_mask.webp', text: 'Ready for the Bay. Bubbles not included. Okay, a few.' },
  { id: 'robot_visor', name: 'Robot Visor', slot: 'face', rarity: 'rare', price: 260, vibe: 'cool', size: 1.0,
    model: 'wear/robot_visor.glb', icon: 'wear/robot_visor.webp', text: 'Scanning... scanning... you are 100 percent awesome.' },
  { id: 'retro_3d', name: '3D Glasses', slot: 'face', rarity: 'common', price: 60, vibe: 'goofy', size: 0.95,
    model: 'wear/retro_3d.glb', icon: 'wear/retro_3d.webp', text: 'Everything jumps out at you. Even the toast.' },
  { id: 'ski_goggles', name: 'Rainbow Ski Goggles', slot: 'face', rarity: 'uncommon', price: 150, vibe: 'sporty', size: 1.05,
    model: 'wear/ski_goggles.glb', icon: 'wear/ski_goggles.webp', text: 'Ready for the snowy slope. And for looking amazing.' },
  { id: 'xray_specs', name: 'X-Ray Specs', slot: 'face', rarity: 'uncommon', price: 130, vibe: 'magic', size: 0.95,
    model: 'wear/xray_specs.glb', icon: 'wear/xray_specs.webp', text: 'See through walls! (You cannot. But the swirls are cool.)' },
  { id: 'binocular_specs', name: 'Binocular Specs', slot: 'face', rarity: 'rare', price: 220, vibe: 'goofy', size: 0.95,
    model: 'wear/binocular_specs.glb', icon: 'wear/binocular_specs.webp', text: 'Spot a Glimmer from the other side of the island.' },
  // ---------- neck ----------
  { id: 'cloud_scarf', name: 'Puffy Cloud Scarf', slot: 'neck', rarity: 'common', price: 70, vibe: 'cosy', size: 1.0,
    model: 'wear/cloud_scarf.glb', icon: 'wear/cloud_scarf.webp', text: 'Made from an actual cloud. Very soft. Slightly damp.' },
  { id: 'gold_medal', name: 'Big Gold Medal', slot: 'neck', rarity: 'uncommon', price: 160, vibe: 'sporty', size: 0.55,
    model: 'wear/gold_medal.glb', icon: 'wear/gold_medal.webp', text: 'For being awesome at being you.' },
  { id: 'polka_bowtie', name: 'Polka-Dot Bow Tie', slot: 'neck', rarity: 'common', price: 50, vibe: 'fancy', size: 0.95,
    model: 'wear/polka_bowtie.glb', icon: 'wear/polka_bowtie.webp', text: 'Instantly 100 percent more fancy. Science.' },
  { id: 'flower_lei', name: 'Flower Lei', slot: 'neck', rarity: 'common', price: 60, vibe: 'cosy', size: 0.95,
    model: 'wear/flower_lei.glb', icon: 'wear/flower_lei.webp', text: 'Smells like a beach holiday. Says aloha to everyone.' },
  { id: 'candy_necklace', name: 'Candy Necklace', slot: 'neck', rarity: 'common', price: 40, vibe: 'goofy', size: 0.85,
    model: 'wear/candy_necklace.glb', icon: 'wear/candy_necklace.webp', text: 'Snack and style. It is both.' },
  { id: 'banana_chain', name: 'Banana Bling', slot: 'neck', rarity: 'rare', price: 260, vibe: 'goofy', size: 0.85,
    model: 'wear/banana_chain.glb', icon: 'wear/banana_chain.webp', text: 'A gold chain. With a banana. Because why not.' },
  // ---------- back ----------
  { id: 'toaster_pack', name: 'Toaster Backpack', slot: 'back', rarity: 'rare', price: 300, vibe: 'goofy', size: 1.7,
    model: 'wear/toaster_pack.glb', icon: 'wear/toaster_pack.webp', text: 'Pops out warm toast when you finish a lesson. Butter not included.' },
  { id: 'turtle_pack', name: 'Turtle Shell Pack', slot: 'back', rarity: 'uncommon', price: 150, vibe: 'cosy', size: 1.75,
    model: 'wear/turtle_pack.glb', icon: 'wear/turtle_pack.webp', text: 'Slow and steady wins the lesson. Also it is comfy.' },
  { id: 'dragon_wings', name: 'Dragon Wings', slot: 'back', rarity: 'epic', price: 450, vibe: 'magic', size: 3.2,
    model: 'wear/dragon_wings.glb', icon: 'wear/dragon_wings.webp', text: 'Flap flap. You can almost take off. Almost.' },
  { id: 'soda_jetpack', name: 'Soda Jetpack', slot: 'back', rarity: 'epic', price: 400, vibe: 'goofy', size: 1.8,
    model: 'wear/soda_jetpack.glb', icon: 'wear/soda_jetpack.webp', text: 'Two fizzy bottles. One big whoosh. Please shake responsibly.' },
  { id: 'teddy_pack', name: 'Hug Bear Backpack', slot: 'back', rarity: 'common', price: 90, vibe: 'cosy', size: 1.6,
    model: 'wear/teddy_pack.glb', icon: 'wear/teddy_pack.webp', text: 'A teddy that hugs you all day long. Best friend energy.' },
  { id: 'rock_guitar', name: 'Rock Star Guitar', slot: 'back', rarity: 'rare', price: 320, vibe: 'cool', size: 1.2,
    model: 'wear/rock_guitar.glb', icon: 'wear/rock_guitar.webp', text: 'One chord. Huge crowd. You are ready.' },
  { id: 'snail_shell', name: 'Snail Shell', slot: 'back', rarity: 'uncommon', price: 120, vibe: 'goofy', size: 1.7,
    model: 'wear/snail_shell.glb', icon: 'wear/snail_shell.webp', text: 'Your very own tiny house. Very slow delivery.' },
  // ---------- hand ----------
  { id: 'rubber_chicken', name: 'Rubber Chicken', slot: 'hand', rarity: 'common', price: 50, vibe: 'goofy', size: 0.45,
    model: 'wear/rubber_chicken.glb', icon: 'wear/rubber_chicken.webp', text: 'Squeaks when you are happy. And when you are not.' },
  { id: 'banana_phone', name: 'Banana Phone', slot: 'hand', rarity: 'uncommon', price: 110, vibe: 'goofy', size: 0.4,
    model: 'wear/banana_phone.glb', icon: 'wear/banana_phone.webp', text: 'Ring ring ring ring ring. Banana phone.' },
  { id: 'giant_lollipop', name: 'Giant Swirl Lollipop', slot: 'hand', rarity: 'common', price: 60, vibe: 'cosy', size: 0.55,
    model: 'wear/giant_lollipop.glb', icon: 'wear/giant_lollipop.webp', text: 'Bigger than your head. Sweeter than your Glimmers.' },
  { id: 'triple_cone', name: 'Triple Scoop Cone', slot: 'hand', rarity: 'uncommon', price: 120, vibe: 'goofy', size: 0.42,
    model: 'wear/triple_cone.glb', icon: 'wear/triple_cone.webp', text: 'Strawberry, mint and mystery. Nobody knows what mystery is.' },
  { id: 'foam_finger', name: 'Number One Foam Finger', slot: 'hand', rarity: 'common', price: 70, vibe: 'sporty', size: 0.42,
    model: 'wear/foam_finger.glb', icon: 'wear/foam_finger.webp', text: 'Go team! Which team? Your team!' },
  { id: 'baguette_sword', name: 'Baguette Sword', slot: 'hand', rarity: 'uncommon', price: 100, vibe: 'goofy', size: 0.6,
    model: 'wear/baguette_sword.glb', icon: 'wear/baguette_sword.webp', text: 'The crunchiest sword in all the islands. Very French.' },
  { id: 'butterfly_net', name: 'Butterfly Net', slot: 'hand', rarity: 'common', price: 80, vibe: 'sporty', size: 0.6,
    model: 'wear/butterfly_net.glb', icon: 'wear/butterfly_net.webp', text: 'For catching butterflies, bubbles and bright ideas.' },
  { id: 'cloud_umbrella', name: 'Raincloud Umbrella', slot: 'hand', rarity: 'rare', price: 280, vibe: 'magic', size: 0.65,
    model: 'wear/cloud_umbrella.glb', icon: 'wear/cloud_umbrella.webp', text: 'Comes with its own tiny cloud. It rains sprinkles.' },
  { id: 'bubble_blaster', name: 'Bubble Blaster', slot: 'hand', rarity: 'rare', price: 280, vibe: 'goofy', size: 0.42,
    model: 'wear/bubble_blaster.glb', icon: 'wear/bubble_blaster.webp', text: 'Pew pew! Only bubbles. Very serious bubbles.' },
  { id: 'ufo_string', name: 'Tiny UFO on a String', slot: 'hand', rarity: 'epic', price: 420, vibe: 'magic', size: 0.6,
    model: 'wear/ufo_string.glb', icon: 'wear/ufo_string.webp', text: 'A real tiny alien. It waves. You wave back. Best friends.' },
  { id: 'toot_trumpet', name: 'Toot-Toot Trumpet', slot: 'hand', rarity: 'uncommon', price: 160, vibe: 'fancy', size: 0.5,
    model: 'wear/toot_trumpet.glb', icon: 'wear/toot_trumpet.webp', text: 'Plays one note. It is a very good note.' },
  { id: 'magic_8ball', name: 'Magic 8-Ball', slot: 'hand', rarity: 'rare', price: 240, vibe: 'magic', size: 0.3,
    model: 'wear/magic_8ball.glb', icon: 'wear/magic_8ball.webp', text: 'Ask it anything. It always says ask again after lunch.' },
  { id: 'fish_rod', name: 'Surprise Fishing Rod', slot: 'hand', rarity: 'uncommon', price: 150, vibe: 'goofy', size: 0.65,
    model: 'wear/fish_rod.glb', icon: 'wear/fish_rod.webp', text: 'You caught a fish! The fish is just as surprised as you.' },
  { id: 'balloon_sword', name: 'Balloon Dog Sword', slot: 'hand', rarity: 'common', price: 70, vibe: 'goofy', size: 0.6,
    model: 'wear/balloon_sword.glb', icon: 'wear/balloon_sword.webp', text: 'Squeak squeak. The bravest, bounciest sword there is.' },
  { id: 'firefly_lantern', name: 'Firefly Lantern', slot: 'hand', rarity: 'rare', price: 260, vibe: 'cosy', size: 0.4,
    model: 'wear/firefly_lantern.glb', icon: 'wear/firefly_lantern.webp', text: 'Full of friendly fireflies. They blink hello.' },
  { id: 'walkie_talkie', name: 'Walkie-Talkie', slot: 'hand', rarity: 'common', price: 90, vibe: 'cool', size: 0.38,
    model: 'wear/walkie_talkie.glb', icon: 'wear/walkie_talkie.webp', text: 'Come in, base! Over. Do you copy? Over. Snack time? Over.' },
  { id: 'giant_pencil', name: 'Giant Pencil', slot: 'hand', rarity: 'common', price: 60, vibe: 'goofy', size: 0.6,
    model: 'wear/giant_pencil.glb', icon: 'wear/giant_pencil.webp', text: 'For writing really big words. Like WOW.' },
  { id: 'star_mic', name: 'Superstar Microphone', slot: 'hand', rarity: 'rare', price: 300, vibe: 'fancy', size: 0.42,
    model: 'wear/star_mic.glb', icon: 'wear/star_mic.webp', text: 'Testing, testing. Wow, you sound amazing.' },
  { id: 'flame_board', name: 'Mini Flame Skateboard', slot: 'hand', rarity: 'uncommon', price: 180, vibe: 'cool', size: 0.55,
    model: 'wear/flame_board.glb', icon: 'wear/flame_board.webp', text: 'Kickflips not included. Coolness included.' },
  // ---------- feet: a painted tile wraps the buddy's own feet ----------
  { id: 'galaxy_kicks', name: 'Galaxy Kicks', slot: 'feet', rarity: 'rare', price: 260, vibe: 'cool', size: 1,
    shoeTile: 'wear/tile-galaxy_kicks.webp', icon: 'wear/galaxy_kicks.webp', text: 'Every step is a tiny space walk.' },
  { id: 'lava_boots', name: 'Lava Lamp Boots', slot: 'feet', rarity: 'epic', price: 380, vibe: 'magic', size: 1,
    shoeTile: 'wear/tile-lava_boots.webp', icon: 'wear/lava_boots.webp', text: 'Bloop. Bloop. Bloop. Your feet are now a lava lamp.' },
  { id: 'watermelon_slippers', name: 'Watermelon Slippers', slot: 'feet', rarity: 'common', price: 70, vibe: 'goofy', size: 1,
    shoeTile: 'wear/tile-watermelon_slippers.webp', icon: 'wear/watermelon_slippers.webp', text: 'Juicy. Comfy. Do not spit the seeds.' },
  { id: 'glow_kicks', name: 'Glow Kicks', slot: 'feet', rarity: 'uncommon', price: 160, vibe: 'sporty', size: 1,
    shoeTile: 'wear/tile-glow_kicks.webp', icon: 'wear/glow_kicks.webp', text: 'Light up with every step. Run in the dark like a firefly.' },
  { id: 'bubblewrap_boots', name: 'Bubble Wrap Boots', slot: 'feet', rarity: 'uncommon', price: 120, vibe: 'goofy', size: 1,
    shoeTile: 'wear/tile-bubblewrap_boots.webp', icon: 'wear/bubblewrap_boots.webp', text: 'Pop pop pop. The most satisfying boots ever made.' },
  { id: 'mossy_boots', name: 'Mossy Forest Boots', slot: 'feet', rarity: 'uncommon', price: 140, vibe: 'cosy', size: 1,
    shoeTile: 'wear/tile-mossy_boots.webp', icon: 'wear/mossy_boots.webp', text: 'Tiny mushrooms grow on them. They are friends now.' },
  { id: 'disco_shoes', name: 'Disco Ball Shoes', slot: 'feet', rarity: 'legendary', price: 550, vibe: 'fancy', size: 1,
    shoeTile: 'wear/tile-disco_shoes.webp', icon: 'wear/disco_shoes.webp', text: 'Saturday night fever, every day of the week.' },
];
