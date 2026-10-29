// Music stations: pick the kind of music you like, and it plays everywhere, through lessons, trips and
// battles, until you pick another. "Keypals Originals" is the music the game makes as you play (the
// island tunes, in a style you choose); every other station plays recorded tracks one after another.
// "Auto" picks for you: calm while you practise, happy on the menus, an adventure in Adventure.
//
// The recordings are licensed from Envato Elements for Keypals and are NOT in this (public) repository:
// they live in a private folder (~/Documents/keypals-private/music; public/music is a git-ignored link
// to it for the dev server, and deploy/site/deploy.sh copies it into the published site) and are served
// from music/<file>.mp3 next to the game. Only the titles and artists are written here.

export type StationId = 'originals' | 'calm' | 'happy' | 'pop' | 'dance' | 'storybook' | 'snow' | 'adventure' | 'rock' | 'electronic' | 'retro' | 'beats' | 'funk' | 'hiphop' | 'world';
export type Track = { file: string; title: string; artist: string };
export type Station = { id: StationId; name: string; blurb: string; tracks: Track[] };

const T = (file: string, title: string, artist: string): Track => ({ file, title, artist });

export const STATIONS: Station[] = [
  { id: 'originals', name: 'Keypals Originals', blurb: 'The island tunes, made as you play', tracks: [] },
  { id: 'calm', name: 'Calm', blurb: 'Soft and quiet, for thinking', tracks: [
    T('lofi-bookworm-scorewizards', 'Lofi Bookworm', 'SCOREWIZARDS'),
    T('ambient-kalimba-lucafrancini', 'Ambient Kalimba', 'lucafrancini'),
    T('drifting-for-dreamland-phillarson', 'Drifting for Dreamland', 'PhilLarson'),
    T('soft-marimba-sunrise-music2noise', 'Soft Marimba Sunrise', 'music2noise'),
    T('peaceful-morning-russell-frederick', 'Peaceful Morning', 'Russell_Frederick'),
    T('underwater-lullaby-elevateaudio', 'Underwater Lullaby', 'ElevateAudio'),
    T('calm-piano-mdfactory', 'Calm Piano', 'MDFactory'),
    T('calm-piano-ambient-luckyblackcat', 'Calm Piano Ambient', 'LuckyBlackCat'),
    T('ambient-piano-enrize', 'Ambient Piano', 'Enrize'),
    T('calm-piano-florewsmusic', 'Calm Piano', 'FlorewsMusic'),
  ] },
  { id: 'happy', name: 'Happy', blurb: 'Whistles, ukuleles and sunshine', tracks: [
    T('happy-whistle-peacockmusic', 'Happy Whistle', 'PeacockMusic'),
    T('carefree-whistle-scorewizards', 'Carefree Whistle', 'SCOREWIZARDS'),
    T('joyful-children-music-audiocoffee', 'Joyful Children Music', 'AudioCoffee'),
    T('acoustic-calm-and-happy-ukulele-joel-loopez', 'Acoustic Calm and Happy Ukulele', 'Joel_Loopez'),
    T('strolling-along-brownhousemedia', 'Strolling Along', 'BrownHouseMedia'),
    T('jazzy-stroll-through-the-park-sunchannelmusic', 'Jazzy Stroll Through the Park', 'SunChannelMusic'),
    T('sun-kissed-pizzicato-scorewizards', 'Sun Kissed Pizzicato', 'SCOREWIZARDS'),
    T('marimba-nefritovec', 'Marimba', 'Nefritovec'),
    T('storytelling-marimba-premiumbeat', 'Storytelling Marimba', 'PremiumBeat'),
    T('happy-ukulele-fatbunny', 'Happy Ukulele', 'fatbunny'),
  ] },
  { id: 'pop', name: 'Pop', blurb: 'Bright, catchy and bouncy', tracks: [
    T('positive-onaldin', 'Positive', 'ONALDIN'),
    T('real-life-venus-premiumbeat', 'Real Life Venus', 'PremiumBeat'),
    T('upbeat-pop-stocksounds', 'Upbeat Pop', 'StockSounds'),
    T('positive-pop-alexgrohl', 'Positive Pop', 'AlexGrohl'),
    T('upbeat-fun-pop-rock-kornevmusic', 'Upbeat Fun Pop Rock', 'kornevmusic'),
    T('indie-pop-alexgrohl', 'Indie Pop', 'AlexGrohl'),
    T('happy-moments-audiocoffee', 'Happy Moments', 'AudioCoffee'),
    T('summer-pop-blacktrendmusic', 'Summer Pop', 'BlackTrendMusic'),
    T('kids-silvertigerstudios', 'Kids', 'SilverTigerStudios'),
    T('positive-summer-pop-musicalsmile', 'Positive Summer Pop', 'MusicalSmile'),
    T('upbeat-indie-pop-rock-dmitriysimf', 'Upbeat Indie Pop Rock', 'DmitriySimf'),
  ] },
  { id: 'storybook', name: 'Storybook', blurb: 'Fairy tales, forests and sneaky tiptoes', tracks: [
    T('a-fairy-tale-story-gentlejammers', 'A Fairy Tale Story', 'GentleJammers'),
    T('sun-dappled-wood-scorewizards', 'Sun Dappled Wood', 'SCOREWIZARDS'),
    T('fairy-tale-adventure-ereymusic', 'Fairy Tale Adventure', 'ereymusic'),
    T('adventure-begins-kakaducreation', 'Adventure Begins', 'KakaduCreation'),
    T('sneaky-pizzicato-danyvin', 'Sneaky Pizzicato', 'danyvin'),
    T('chasing-trouble-kakaducreation', 'Chasing Trouble', 'KakaduCreation'),
    T('magical-mysterious-clockwork-scorewizards', 'Magical Mysterious Clockwork', 'SCOREWIZARDS'),
    T('magical-wildkittytunes', 'Magical', 'WildKittyTunes'),
    T('fairy-tale-studiokolomna', 'Fairy Tale', 'StudioKolomna'),
    T('fairy-tale-orchestralis', 'Fairy Tale', 'Orchestralis'),
  ] },
  { id: 'snow', name: 'Snow Day', blurb: 'Sleigh bells and snowflakes', tracks: [
    T('winter-studiokolomna', 'Winter', 'StudioKolomna'),
    T('winter-wonderland-background-crazytunes', 'Winter Wonderland Background', 'CrazyTunes'),
    T('kids-album-snow-studioetude', 'Kids Album Snow', 'StudioEtude'),
    T('winter-magic-dspromusic', 'Winter Magic', 'DSProMusic'),
    T('magical-winter-wonderland-crazytunes', 'Magical Winter Wonderland', 'CrazyTunes'),
    T('winter-wildkittytunes', 'Winter', 'WildKittyTunes'),
    T('happy-winter-positive-sound', 'Happy Winter', 'Positive_Sound'),
    T('sleigh-bells-eliveta', 'Sleigh Bells', 'Eliveta'),
    T('winter-journey-glebator', 'Winter Journey', 'Glebator'),
    T('jingle-bells-ii-victoryaudio', 'Jingle Bells ii', 'VictoryAudio'),
  ] },
  { id: 'adventure', name: 'Adventure', blurb: 'Big brave orchestras', tracks: [
    T('epic-adventure-nicolas-t', 'Epic Adventure', 'Nicolas_T'),
    T('adventure-epic-awesome-music', 'Adventure Epic', 'Awesome_Music'),
    T('adventure-island-premiumbeat', 'Adventure Island', 'PremiumBeat'),
    T('pirates-in-epic-adventure-orchestralis', 'Pirates in Epic Adventure', 'Orchestralis'),
    T('heroic-moodmode', 'Heroic', 'MoodMode'),
    T('emotional-cinematic-adventure-glebator', 'Emotional Cinematic Adventure', 'Glebator'),
    T('pirate-alexshulgin', 'Pirate', 'alexshulgin'),
    T('pirate-adventures-sergmaru', 'Pirate Adventures', 'SERGMARU'),
    T('cinematic-adventure-alexshulgin', 'Cinematic Adventure', 'alexshulgin'),
    T('heroic-adventure-studiokolomna', 'Heroic Adventure', 'StudioKolomna'),
  ] },
  { id: 'rock', name: 'Rock', blurb: 'Guitars and drums, turned up', tracks: [
    T('classic-rock-and-roll-mrorangeaudio', 'Classic Rock and Roll', 'MrOrangeAudio'),
    T('country-rock-and-roll-audiocoffee', 'Country Rock And Roll', 'AudioCoffee'),
    T('upbeat-fun-rock-and-roll-vladimir82', 'Upbeat Fun Rock and Roll', 'Vladimir82'),
    T('red-rock-and-roll-loopslab', 'Red Rock and Roll', 'LoopsLab'),
    T('rock-and-roll-positive-sound', 'Rock and Roll', 'Positive_Sound'),
    T('punk-party-premiumbeat', 'Punk Party', 'PremiumBeat'),
    T('indie-rock-lover-pablikmm01', 'Indie Rock Lover', 'PaBlikMM01'),
    T('upbeat-rock-luckyblackcat', 'Upbeat Rock', 'LuckyBlackCat'),
    T('upbeat-rock-mrclaps', 'Upbeat Rock', 'MrClaps'),
    T('pop-punk-mdfactory', 'Pop-Punk', 'MDFactory'),
  ] },
  { id: 'electronic', name: 'Electronic', blurb: 'Bouncy beats and synths', tracks: [
    T('travel-edm-magmasounds', 'Travel EDM', 'MagmaSounds'),
    T('upbeat-music-moonlight-sounds', 'Upbeat Music', 'moonlight_sounds'),
    T('summer-edm-olexandrignatov', 'Summer EDM', 'OlexandrIgnatov'),
    T('fashion-edm-mehilovesound', 'Fashion EDM', 'MehiloveSound'),
    T('upbeat-synth-pop-beroolmusic', 'Upbeat Synth Pop', 'BeroolMusic'),
    T('upbeat-electronic-carvine', 'Upbeat Electronic', 'Carvine'),
    T('chill-electronic-mehilovesound', 'Chill Electronic', 'MehiloveSound'),
    T('bright-electronic-rvstudio', 'Bright Electronic', 'RVStudio'),
    T('synthwave-soundthelimit', 'Synthwave', 'SoundTheLimit'),
    T('positive-development-dopestuff', 'Positive Development', 'dopestuff'),
    T('synthwave-watermello', 'Synthwave', 'Watermello'),
  ] },
  { id: 'dance', name: 'Dance party', blurb: 'Big beats to dance to', tracks: [
    T('90s-eurodance-instrumental-frontmusic', '90s Eurodance Instrumental', 'Frontmusic'),
    T('electro-house-jackson-frost', 'Electro House', 'Jackson_Frost'),
    T('edm-florewsmusic', 'Edm', 'FlorewsMusic'),
    T('edm-florews', 'EDM', 'florews'),
    T('tropical-house-kinkyhurts', 'Tropical House', 'Kinkyhurts'),
    T('tropical-house-thestockmusic', 'Tropical House', 'TheStockMusic'),
    T('upbeat-future-bass-modern-fassounds', 'Upbeat Future Bass Modern', 'FASSounds'),
    T('uplifting-pop-ihsandincer', 'Uplifting Pop', 'ihsandincer'),
    T('tropical-summer-ultra-music', 'Tropical Summer', 'Ultra_Music'),
    T('energetic-pop-dance-micrah', 'Energetic Pop Dance', 'Micrah'),
  ] },
  { id: 'retro', name: 'Retro 8-bit', blurb: 'Old-school video game bleeps', tracks: [
    T('konami-code-premiumbeat', 'Konami Code', 'PremiumBeat'),
    T('8-bit-chiptune-stepanbel', '8-bit Chiptune', 'StepanBel'),
    T('8bit-chiptune-petruality', '8bit Chiptune', 'PetRUalitY'),
    T('chiptune-chill-scorewizards', 'Chiptune Chill', 'SCOREWIZARDS'),
    T('jumping-jack-premiumbeat', 'Jumping Jack', 'PremiumBeat'),
    T('8bit-funny-positive-game-tomasz-redman', '8bit Funny Positive Game', 'Tomasz_Redman'),
    T('retro-game-fatbunny', 'Retro Game', 'fatbunny'),
    T('for-8-bit-raspberrymusic', 'For 8 Bit', 'raspberrymusic'),
    T('8-bit-airportmusic', '8-Bit', 'AirportMusic'),
    T('8-bit-game-alexshulgin', '8-Bit Game', 'alexshulgin'),
  ] },
  { id: 'beats', name: 'Chill Beats', blurb: 'Laid-back lo-fi grooves', tracks: [
    T('lofi-hip-hop-alexshulgin', 'Lofi Hip Hop', 'alexshulgin'),
    T('lofi-hip-hop-mdfactory', 'Lofi hip-hop', 'MDFactory'),
    T('lofi-hip-hop-newsense', 'Lofi Hip Hop', 'newsense'),
    T('lofi-hip-hop-soundthelimit', 'Lofi Hip Hop', 'SoundTheLimit'),
    T('chillhop-florewsmusic', 'Chillhop', 'FlorewsMusic'),
    T('lofi-chill-fatbunny', 'Lofi Chill', 'fatbunny'),
    T('lofi-beat-watermello', 'LoFi Beat', 'Watermello'),
    T('lofi-chill-stereo-color', 'Lofi Chill', 'Stereo_Color'),
    T('lofi-beats-stepanbel', 'Lofi Beats', 'StepanBel'),
    T('lofi-beats-alexshulgin', 'Lofi Beats', 'alexshulgin'),
  ] },
  { id: 'funk', name: 'Funk and Jazz', blurb: 'Saxophones and swing', tracks: [
    T('happy-funk-fatbunny', 'Happy Funk', 'fatbunny'),
    T('this-funk-groove-liosound', 'This Funk Groove', 'liosound'),
    T('funky-viy-music', 'Funky', 'viy_music'),
    T('spring-swing-jazz-music-trove', 'Spring Swing Jazz', 'Music-Trove'),
    T('swing-big-band-jazz-magicmood', 'Swing Big Band Jazz', 'MagicMood'),
    T('bossa-nueva-premiumbeat', 'Bossa Nueva', 'PremiumBeat'),
    T('upbeat-funk-mrclaps', 'Upbeat Funk', 'MrClaps'),
  ] },
  { id: 'hiphop', name: 'Hip-hop', blurb: 'Head-nodding beats, no words', tracks: [
    T('optimistic-hip-hop-instrumental-micrah', 'Optimistic Hip-Hop Instrumental', 'Micrah'),
    T('happy-upbeat-hip-hop-steelsound', 'Happy Upbeat Hip Hop', 'SteelSound'),
    T('hip-hop-chill-dopecat', 'Hip-Hop Chill', 'DopeCat'),
    T('boom-bap-alexgrohl', 'Boom Bap', 'AlexGrohl'),
    T('hip-hop-it-yuriysheff', 'Hip Hop It', 'yuriysheff'),
    T('funky-hip-hop-urbangodzilla', 'Funky Hip Hop', 'UrbanGodzilla'),
    T('happy-beat-newsense', 'Happy Beat', 'newsense'),
    T('boom-bap-redlionproduction', 'Boom Bap', 'RedLionProduction'),
    T('hip-hop-moodmode', 'Hip Hop', 'MoodMode'),
    T('funky-soundthelimit', 'Funky', 'SoundTheLimit'),
  ] },
  { id: 'world', name: 'World', blurb: 'Steel drums, maracas and more', tracks: [
    T('happy-upbeat-latin-dance-kornevmusic', 'Happy Upbeat Latin Dance', 'kornevmusic'),
    T('latin-spanish-feel-simonleng', 'Latin Spanish Feel', 'simonleng'),
    T('reggae-heartdrummachine', 'Reggae', 'HeartDrumMachine'),
    T('steel-drums-premiumbeat', 'Steel Drums', 'PremiumBeat'),
    T('mama-africa-gentlejammers', 'Mama Africa', 'GentleJammers'),
    T('caribbean-travel-gentlejammers', 'Caribbean Travel', 'GentleJammers'),
    T('the-butterfly-celtic-premiumbeat', 'The Butterfly Celtic', 'PremiumBeat'),
    T('african-upbeat-nuclearmetal', 'African Upbeat', 'Nuclearmetal'),
    T('reggae-mdfactory', 'Reggae', 'MDFactory'),
    T('reggae-progressence', 'Reggae', 'Progressence'),
    T('celtic-happy-alexshulgin', 'Celtic Happy', 'alexshulgin'),
  ] },
];
export const STATION: Record<StationId, Station> = Object.fromEntries(STATIONS.map(s => [s.id, s])) as Record<StationId, Station>;

/** What's going on, for Auto: practising, the menus, or Adventure. */
export type MusicPlace = 'focus' | 'menu' | 'adventure';
/** What Auto plays in each place. */
export const AUTO: Record<MusicPlace, StationId> = { focus: 'calm', menu: 'happy', adventure: 'adventure' };
/** A station's choice: 'auto' or a station. */
export type StationChoice = StationId | 'auto';
