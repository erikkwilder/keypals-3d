// Music stations: pick the kind of music you like, and it plays everywhere, through lessons, trips and
// battles, until you pick another. "Keypals Originals" is the music the game makes as you play (the
// island tunes, in a style you choose); every other station plays recorded tracks one after another.
// "Auto" picks for you: calm while you practise, happy on the menus, an adventure in Adventure.
//
// The recordings are licensed from Envato Elements for Keypals and are NOT in this (public) repository:
// they live in a private folder (~/Documents/keypals-private/music; public/music is a git-ignored link
// to it for the dev server, and deploy/site/deploy.sh copies it into the published site) and are served
// from music/<file>.mp3 next to the game. Only the titles and artists are written here.

export type StationId = 'originals' | 'calm' | 'happy' | 'storybook' | 'snow' | 'adventure' | 'rock' | 'electronic' | 'retro' | 'beats' | 'funk' | 'hiphop' | 'world';
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
  ] },
  { id: 'storybook', name: 'Storybook', blurb: 'Fairy tales, forests and sneaky tiptoes', tracks: [
    T('a-fairy-tale-story-gentlejammers', 'A Fairy Tale Story', 'GentleJammers'),
    T('sun-dappled-wood-scorewizards', 'Sun Dappled Wood', 'SCOREWIZARDS'),
    T('fairy-tale-adventure-ereymusic', 'Fairy Tale Adventure', 'ereymusic'),
    T('adventure-begins-kakaducreation', 'Adventure Begins', 'KakaduCreation'),
    T('sneaky-pizzicato-danyvin', 'Sneaky Pizzicato', 'danyvin'),
    T('chasing-trouble-kakaducreation', 'Chasing Trouble', 'KakaduCreation'),
  ] },
  { id: 'snow', name: 'Snow Day', blurb: 'Sleigh bells and snowflakes', tracks: [
    T('winter-studiokolomna', 'Winter', 'StudioKolomna'),
    T('winter-wonderland-background-crazytunes', 'Winter Wonderland Background', 'CrazyTunes'),
    T('kids-album-snow-studioetude', 'Kids Album Snow', 'StudioEtude'),
  ] },
  { id: 'adventure', name: 'Adventure', blurb: 'Big brave orchestras', tracks: [
    T('epic-adventure-nicolas-t', 'Epic Adventure', 'Nicolas_T'),
    T('adventure-epic-awesome-music', 'Adventure Epic', 'Awesome_Music'),
    T('adventure-island-premiumbeat', 'Adventure Island', 'PremiumBeat'),
    T('pirates-in-epic-adventure-orchestralis', 'Pirates in Epic Adventure', 'Orchestralis'),
  ] },
  { id: 'rock', name: 'Rock', blurb: 'Guitars and drums, turned up', tracks: [
    T('classic-rock-and-roll-mrorangeaudio', 'Classic Rock and Roll', 'MrOrangeAudio'),
    T('country-rock-and-roll-audiocoffee', 'Country Rock And Roll', 'AudioCoffee'),
    T('upbeat-fun-rock-and-roll-vladimir82', 'Upbeat Fun Rock and Roll', 'Vladimir82'),
    T('red-rock-and-roll-loopslab', 'Red Rock and Roll', 'LoopsLab'),
    T('rock-and-roll-positive-sound', 'Rock and Roll', 'Positive_Sound'),
  ] },
  { id: 'electronic', name: 'Electronic', blurb: 'Bouncy beats and synths', tracks: [
    T('travel-edm-magmasounds', 'Travel EDM', 'MagmaSounds'),
    T('upbeat-music-moonlight-sounds', 'Upbeat Music', 'moonlight_sounds'),
    T('summer-edm-olexandrignatov', 'Summer EDM', 'OlexandrIgnatov'),
    T('fashion-edm-mehilovesound', 'Fashion EDM', 'MehiloveSound'),
  ] },
  { id: 'retro', name: 'Retro 8-bit', blurb: 'Old-school video game bleeps', tracks: [
    T('konami-code-premiumbeat', 'Konami Code', 'PremiumBeat'),
    T('8-bit-chiptune-stepanbel', '8-bit Chiptune', 'StepanBel'),
    T('8bit-chiptune-petruality', '8bit Chiptune', 'PetRUalitY'),
    T('chiptune-chill-scorewizards', 'Chiptune Chill', 'SCOREWIZARDS'),
  ] },
  { id: 'beats', name: 'Chill Beats', blurb: 'Laid-back lo-fi grooves', tracks: [
    T('lofi-hip-hop-alexshulgin', 'Lofi Hip Hop', 'alexshulgin'),
    T('lofi-hip-hop-mdfactory', 'Lofi hip-hop', 'MDFactory'),
    T('lofi-hip-hop-newsense', 'Lofi Hip Hop', 'newsense'),
    T('lofi-hip-hop-soundthelimit', 'Lofi Hip Hop', 'SoundTheLimit'),
  ] },
  { id: 'funk', name: 'Funk and Jazz', blurb: 'Saxophones and swing', tracks: [
    T('happy-funk-fatbunny', 'Happy Funk', 'fatbunny'),
    T('this-funk-groove-liosound', 'This Funk Groove', 'liosound'),
    T('funky-viy-music', 'Funky', 'viy_music'),
    T('spring-swing-jazz-music-trove', 'Spring Swing Jazz', 'Music-Trove'),
    T('swing-big-band-jazz-magicmood', 'Swing Big Band Jazz', 'MagicMood'),
  ] },
  { id: 'hiphop', name: 'Hip-hop', blurb: 'Head-nodding beats, no words', tracks: [
    T('optimistic-hip-hop-instrumental-micrah', 'Optimistic Hip-Hop Instrumental', 'Micrah'),
    T('happy-upbeat-hip-hop-steelsound', 'Happy Upbeat Hip Hop', 'SteelSound'),
    T('hip-hop-chill-dopecat', 'Hip-Hop Chill', 'DopeCat'),
  ] },
  { id: 'world', name: 'World', blurb: 'Steel drums, maracas and more', tracks: [
    T('happy-upbeat-latin-dance-kornevmusic', 'Happy Upbeat Latin Dance', 'kornevmusic'),
    T('latin-spanish-feel-simonleng', 'Latin Spanish Feel', 'simonleng'),
    T('reggae-heartdrummachine', 'Reggae', 'HeartDrumMachine'),
    T('steel-drums-premiumbeat', 'Steel Drums', 'PremiumBeat'),
    T('mama-africa-gentlejammers', 'Mama Africa', 'GentleJammers'),
    T('caribbean-travel-gentlejammers', 'Caribbean Travel', 'GentleJammers'),
  ] },
];
export const STATION: Record<StationId, Station> = Object.fromEntries(STATIONS.map(s => [s.id, s])) as Record<StationId, Station>;

/** What's going on, for Auto: practising, the menus, or Adventure. */
export type MusicPlace = 'focus' | 'menu' | 'adventure';
/** What Auto plays in each place. */
export const AUTO: Record<MusicPlace, StationId> = { focus: 'calm', menu: 'happy', adventure: 'adventure' };
/** A station's choice: 'auto' or a station. */
export type StationChoice = StationId | 'auto';
