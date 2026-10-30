# Paint concept pictures for new Glimmers with gpt-image-2 (the gpt-image-gen skill on the Mac Mini: Erik's
# ChatGPT sign-in through hermes, no API key), two existing Glimmer paintings as style references each.
#   python3 scripts/glimmers/concepts.py <out-dir> [id ...]      (no ids: every one not painted yet)
# Three at a time; raw PNGs (1024 x 1536) land in <out-dir>/raw, then concepts-finish.py makes the game's
# webps (768 x 1152 painting + 192 x 192 face). The concepts are what the 3D models are made from later
# (hf-hunyuan.py), so each is one creature on a plain soft background.
import os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
GL = f'{REPO}/public/game/glimmers'
PY = os.path.expanduser('~/.hermes/hermes-agent/venv/bin/python')
GEN = os.path.expanduser('~/.claude/skills/gpt-image-gen/scripts/gen.py')

TINT = {'sun': 'pale warm peach-cream', 'frost': 'pale icy blue-white', 'tide': 'pale aqua-white', 'stone': 'pale warm sand-beige', 'leaf': 'pale mint-cream'}
GLOW = {
    'common': '', 'uncommon': '', 'rare': '', 'epic': ' A few tiny sparkles around it.',
    'legendary': ' It looks special and rare: a soft golden glow and a few sparkles around it.',
    'mythic': ' It looks magical and legendary: a soft rainbow shimmer, a gentle halo of light and sparkles around it.',
}

# id, element, rarity, what it looks like, two reference paintings (the most similar existing Glimmers)
G = [
    # ---- world natives: Fraction Falls, Counting Caves, Market Isle ----
    ('pieotter', 'tide', 'uncommon', 'a small sleek chocolate-brown river otter pup with a cream belly, wearing a tiny white baker\'s apron, proudly holding up a golden cherry pie already cut into perfectly equal slices, a few water droplets on its fur', 'puddlepup', 'rainbootfrog'),
    ('halfcrab', 'stone', 'rare', 'a round chubby little crab whose shell is split exactly down the middle into two colours, the left half coral pink and the right half sea blue, big friendly eyes on stalks, small claws raised in a wave, standing in a tiny shallow puddle', 'bubbleocto', 'pebbletort'),
    ('wheelbeaver', 'tide', 'epic', 'a chubby honey-brown beaver kit with a little wooden water wheel built onto its flat tail, water splashing off the wheel paddles, two big buck teeth, rosy cheeks', 'puddlepup', 'pinepango'),
    ('abacuspillar', 'leaf', 'uncommon', 'a plump caterpillar whose body is a row of shiny round abacus beads in rainbow colours strung on a thin golden wire, a cute round green head with two tiny antennae, little stubby feet, sitting on a small glowing purple crystal', 'mushmouse', 'sunsnail'),
    ('cartbeetle', 'stone', 'rare', 'a shiny cobalt-blue beetle whose back is a little wooden mine cart with iron bands, heaped with glowing pink and teal gems, tiny cart wheels at its back legs', 'geodemole', 'sparkmoth'),
    ('crystalbat', 'frost', 'epic', 'a fluffy round lilac baby bat with big soft ears and translucent faceted crystal wings that glow pale blue, hanging happily upside down from a purple amethyst crystal', 'frostowl', 'prismhorn'),
    ('crystalmammoth', 'stone', 'legendary', 'a fluffy baby woolly mammoth with curved tusks of glowing rose-pink crystal and clusters of purple geode crystals growing along its back, faint glowing golden veins in its warm brown fur, majestic but cuddly', 'prismhorn', 'mittenyeti'),
    ('pennypiglet', 'sun', 'uncommon', 'a round shiny pink porcelain piglet shaped like a piggy bank with a coin slot on its back, a few gold coins tumbling around it, a curly tail', 'popcornpuff', 'geodemole'),
    ('fruittoucan', 'sun', 'rare', 'a bright toucan chick with a huge rainbow-striped beak, balancing a tiny brass market scale on its beak with a mango on one pan and a little pineapple on the other', 'frostowl', 'sunsnail'),
    ('stripechameleon', 'leaf', 'epic', 'a chubby smiling chameleon striped like a market awning in red-and-cream and teal-and-cream stripes, a big curly tail, round swivelly eyes', 'rainbootfrog', 'cactuskit'),
    ('goldgriffin', 'sun', 'legendary', 'a fluffy griffin cub with a golden eagle head and wings whose feathers look like shiny gold coins, a lion-cub body and tail, a little leather coin pouch on a strap, proud and regal', 'lanternfox', 'phoenixchick'),
    # ---- milestones ----
    ('fireflyfawn', 'leaf', 'rare', 'a tiny spotted fawn whose white spots glow softly like fireflies, little glowing fireflies floating around it', 'fernfox', 'sparkmoth'),
    ('lighthousepuffin', 'tide', 'epic', 'a round puffin with a bright orange beak and orange feet, wearing a tiny red-and-white striped lighthouse as a hat whose lamp glows warm yellow', 'frostowl', 'snowseal'),
    ('meteorram', 'frost', 'epic', 'a fluffy cloud-white little ram with big curled horns made of glittering shooting-star trails, tiny stars twinkling in its wool, midnight-blue hooves', 'stormlamb', 'cometcat'),
    ('sunbursttiger', 'sun', 'legendary', 'a chubby tiger cub with glowing golden stripes and a fluffy ruff of sunburst rays around its face like a little sun', 'lanternfox', 'cometcat'),
    ('galaxynarwhal', 'tide', 'legendary', 'a round baby narwhal whose skin is a swirling purple-and-blue galaxy full of tiny stars, with a spiralled horn that ends in a glowing star, little flippers, floating', 'whalecalf', 'cometcat'),
    ('sunriserobin', 'sun', 'rare', 'a round fluffy robin with a sunrise-orange breast and a little crest feather shaped like a rising sun, singing happily with its beak open', 'frostowl', 'popcornpuff'),
    ('blossomhog', 'leaf', 'epic', 'a round little hedgehog whose spines are a hundred tiny pink and white flower buds, some of them blooming, a button nose', 'mushmouse', 'cactuskit'),
    ('snowpineelk', 'frost', 'epic', 'an elk calf with soft grey-white fur and antlers like snowy pine branches with tiny pinecones and frost sparkles', 'aurorastag', 'mittenyeti'),
    ('seasonstanuki', 'leaf', 'legendary', 'a round fluffy tanuki whose fur has four soft patches: pink spring blossoms, green summer leaves, red autumn maple leaves and white winter snow, a ringed fluffy tail', 'fernfox', 'pinepango'),
    ('eldertreeturtle', 'stone', 'mythic', 'a wise gentle old turtle with a mossy shell carrying a small leafy tree, a tiny round-door house among the tree roots with a glowing lantern, kind sleepy eyes', 'pebbletort', 'potgolem'),
    ('keycricket', 'leaf', 'rare', 'a little green cricket whose shiny wing cases are shaped like rounded blank keyboard keycaps with no letters, long antennae, a happy chirping face', 'sparkmoth', 'mushmouse'),
    ('zipbird', 'frost', 'epic', 'a tiny iridescent hummingbird in icy blue and emerald feathers, its wings a blur of speed, little streaks of sparkle trailing behind it', 'sparkmoth', 'frostowl'),
    ('rocketroadrunner', 'sun', 'legendary', 'a speedy roadrunner chick with flame-orange tail feathers streaming like a rocket trail, tiny aviator goggles on its head, speed streaks behind it', 'phoenixchick', 'teakettledrake'),
    ('balancepanda', 'stone', 'epic', 'a round panda cub standing on a little wooden seesaw, holding two round smooth stones of the same size, one in each paw, calm and proud', 'pebbletort', 'mittenyeti'),
    ('hydrahatchling', 'tide', 'epic', 'a cute baby hydra dragon with three little smiling heads on short necks from one round body, sea-green scales, tiny wings, each head with a slightly different happy face', 'teakettledrake', 'bubbleocto'),
    ('starsageowl', 'frost', 'legendary', 'a fluffy round owl wearing a little midnight-blue cape covered in glowing constellation patterns and small round spectacles', 'frostowl', 'cometcat'),
    # ---- collection ----
    ('gemmagpie', 'stone', 'rare', 'a black-and-white magpie with a blue sheen on its wings, carrying a tiny satchel overflowing with shiny gems and buttons', 'frostowl', 'geodemole'),
    ('treasurecrab', 'tide', 'epic', 'a hermit crab that lives in a tiny wooden treasure chest with gold trim instead of a shell, the lid open with pearls and gold coins inside', 'bubbleocto', 'rainbootfrog'),
    ('nestdragon', 'leaf', 'legendary', 'a sleepy little dragon with leaf-green scales curled around a round nest of glowing eggs in many colours, tiny wings, a gentle smile', 'bloomdrake', 'teakettledrake'),
    ('prismpeacock', 'frost', 'mythic', 'a peacock chick with a fanned-out tail of clear crystal prism feathers that split the light into little rainbows, an opal-white body', 'aurorastag', 'frostjelly'),
    ('acornsprite', 'leaf', 'epic', 'a tiny round acorn creature with an acorn-cap hat, big eyes, little leaf arms and a small oak seedling sprouting from the top of its cap', 'mushmouse', 'sproutbun'),
    # ---- seasons ----
    ('maplepanda', 'sun', 'rare', 'a fluffy red panda with russet fur, holding a big red maple leaf over its head like an umbrella, a few autumn leaves drifting, a ringed tail', 'fernfox', 'popcornpuff'),
    ('snowglobepenguin', 'frost', 'rare', 'a round penguin chick wearing a little glass snow globe dome over its head like a helmet with snowflakes swirling inside, a knitted red scarf', 'snowseal', 'mittenyeti'),
    ('petalduckling', 'tide', 'rare', 'a fluffy yellow duckling wearing a little raincoat made of pink cherry-blossom petals, splashing in a tiny spring puddle', 'rainbootfrog', 'puddlepup'),
    ('watermelonturtle', 'tide', 'rare', 'a small turtle whose shell is a slice of watermelon, green rind edge and pink with black seeds, wearing tiny sunglasses pushed up on its head', 'pebbletort', 'rainbootfrog'),
    ('fireworksquirrel', 'sun', 'epic', 'a squirrel whose fluffy tail bursts into colourful firework sparkles at the tip, holding a little sparkler, big excited eyes', 'popcornpuff', 'fernfox'),
    ('cupcakebear', 'sun', 'epic', 'a little honey-coloured teddy-bear cub wearing a pink frosted cupcake with sprinkles as a hat, one lit birthday candle on top', 'popcornpuff', 'mittenyeti'),
    # ---- secrets ----
    ('mistseahorse', 'tide', 'epic', 'a translucent misty-blue seahorse with fins like soft waterfall spray, tiny glowing bubbles around it, shy and curious', 'frostjelly', 'bubbleocto'),
    ('bookworm', 'leaf', 'rare', 'a cute little pale-green bookworm with round reading glasses, peeking out of a tiny old book, wearing a scarf made of a seed pod', 'mushmouse', 'sproutbun'),
    ('whisperparrot', 'leaf', 'epic', 'a bright parrot chick with rainbow feathers holding one wing up to its beak as if whispering a secret, a tiny sparkle at its beak', 'frostowl', 'cactuskit'),
    ('goldgecko', 'stone', 'epic', 'a shiny golden gecko with tiny gem freckles, curled on a little pile of gold coins, wide sticky toes', 'geodemole', 'rollodillo'),
    # ---- legends ----
    ('crownedlion', 'sun', 'mythic', 'a majestic lion cub with a fluffy golden mane wearing a small crown set with five glowing gems: gold, ice blue, sea blue, earth brown and leaf green', 'lanternfox', 'aurorastag'),
    ('moonrabbit', 'frost', 'mythic', 'a white rabbit with softly glowing silver fur sitting on a little crescent moon, long ears with moon-glow tips, a soft halo of stars', 'aurorastag', 'cometcat'),
    ('rainbowunicorn', 'stone', 'mythic', 'a fluffy baby unicorn with a pastel rainbow mane and tail, a shimmering crystal horn, glittery hooves', 'aurorastag', 'prismhorn'),
    ('dragonkoi', 'tide', 'mythic', 'a koi dragon: a koi fish body with shimmering rainbow scales, long flowing dragon whiskers, silky ribbon fins and two tiny antlers, swirling up through a little waterfall mist', 'whalecalf', 'skywhale'),
]
BY = {g[0]: g for g in G}


def prompt(el, rar, look):
    return ('In the exact painted style of the reference images: one cute glossy creature, full body, three-quarter view, '
            'on a plain soft light background, no text. '
            f'The creature: {look}. '
            f'Plain soft {TINT[el]} background with only a gentle soft shadow under it; nothing else in the picture, no scenery, no border. '
            'The same glossy, warm, painted 3D look as the reference creatures: big shiny expressive eyes, rosy cheeks, soft rim light, '
            'the whole creature in view and centred with space around it.' + GLOW[rar])


def paint(out_dir, gid):
    _, el, rar, look, r1, r2 = BY[gid]
    out = f'{out_dir}/raw/{gid}.png'
    last, err = '', ''
    for _ in range(2):
        r = subprocess.run([PY, GEN, prompt(el, rar, look), 'portrait', out, 'medium', f'{GL}/{r1}.webp', f'{GL}/{r2}.webp'], capture_output=True, text=True)
        last, err = (r.stdout.strip().splitlines() or [''])[-1], r.stderr[-300:]
        if r.returncode == 0 and os.path.exists(out):
            return f'{gid}: {last}'
    return f'{gid}: FAIL {last} {err}'


if __name__ == '__main__':
    out_dir = os.path.abspath(sys.argv[1])
    os.makedirs(f'{out_dir}/raw', exist_ok=True)
    ids = sys.argv[2:] or [g[0] for g in G if not os.path.exists(f'{out_dir}/raw/{g[0]}.png')]
    with ThreadPoolExecutor(3) as ex:
        for line in ex.map(lambda i: paint(out_dir, i), ids):
            print(line, flush=True)
