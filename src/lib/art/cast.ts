// The cast: the buddies who run the trails with you. Each is a 3D character (public/models/<id>.glb)
// made from Erik's designs. Fingers keep their own colours for the keyboard and the hand guide.

export type Look = 'soft' | 'ink' | 'paper' | 'geo';
export type FingerFamily = 'pinky' | 'ring' | 'middle' | 'index' | 'thumb';
export type Finger = 'LP' | 'LR' | 'LM' | 'LI' | 'TH' | 'RI' | 'RM' | 'RR' | 'RP';

export type FriendId = 'dino' | 'cheetah' | 'monkey' | 'koala' | 'box' | 'turtle'
  | 'fish' | 'goggles' | 'straw' | 'antenna' | 'sweater' | 'rabbit' | 'sloth' | 'dog' | 'cat' | 'axolotl' | 'diver' | 'fluff' | 'terrier' | 'pinkbunny' | 'elf';

export type Friend = {
  id: FriendId;
  name: string;
  species: string;
  /** the buddy's colour in menus and charts */
  color: string;
  /** height in metres; the model is scaled to it */
  height: number;
  quirk: string;
  hello: string; // what they say when you pick them
  /** where hats sit: on the crown (the highest middle point), or on the flat top of a wide head with things sticking up from it (Bop's box and feathers) */
  hatOn?: 'crown' | 'flat';
};

export const BUDDIES: Friend[] = [
  { id: 'dino', name: 'Dino', species: 'dinosaur', color: '#3fa7e0', height: 1.2,
    quirk: 'Never takes off his red sneakers. Not even for bed.',
    hello: "I'm Dino! Let's run, ride, and maybe go to space!" },
  { id: 'cheetah', name: 'Chee', species: 'cheetah', color: '#e3b42a', height: 1.25,
    quirk: 'The fastest on the island, and the first to cheer for everyone else.',
    hello: "Hi, I'm Chee! Ready, set... type!" },
  { id: 'monkey', name: 'Momo', species: 'monkey', color: '#3b7fe0', height: 1.15,
    quirk: 'Keeps a banana in every pocket of his backpack, just in case.',
    hello: "Momo here! I'm all fingers. Let's go!" },
  { id: 'koala', name: 'Kiki', species: 'koala', color: '#ef6fa6', height: 1.1,
    quirk: 'Her ears hear every key you press. Every single one.',
    hello: "I'm Kiki! Take it slow, take it steady, and we'll get there." },
  { id: 'box', name: 'Bop', species: 'box head', color: '#f08a3c', height: 1.2, hatOn: 'flat',
    quirk: 'Hears a beat in every key you press. Watch the feathers bounce.',
    hello: "Bop here! Headphones on, fingers ready!" },
  { id: 'turtle', name: 'Tuck', species: 'turtle', color: '#2fa898', height: 1.2,
    quirk: 'Carries his house on his back, and still beats the bus.',
    hello: "Hi, I'm Tuck! Slow and steady? Let's try speedy and steady." },
  // the fifteen from Erik's pictures (27 Oct): names are placeholders until Erik names them
  { id: 'fish', name: 'Fizz', species: 'fish', color: '#35b6d6', height: 1.1, hatOn: 'flat',
    quirk: 'Blows a bubble every time a word comes out right.',
    hello: "Fizz here! Big eyes, quick fingers. Let's go!" },
  { id: 'goggles', name: 'Skye', species: 'explorer', color: '#2f8fa8', height: 1.2,
    quirk: 'Goggles up for typing, goggles down for racing.',
    hello: "I'm Skye! Goggles on. Where are we going first?" },
  { id: 'straw', name: 'Scruff', species: 'haystack', color: '#d9a92b', height: 1.1, hatOn: 'flat',
    quirk: 'Nobody has ever seen the face under all that straw. Just the eyes.',
    hello: "...Scruff. Hi. I'm ready when you are." },
  { id: 'antenna', name: 'Radar', species: 'helmet kid', color: '#e0782f', height: 1.2, hatOn: 'flat',
    quirk: 'The antenna picks up every key you press, even the quiet ones.',
    hello: "Radar here! Signal's strong. Let's play!" },
  { id: 'sweater', name: 'Blu', species: 'kid', color: '#5aa6e8', height: 1.25,
    quirk: 'Sees fine with one eye. Mostly.',
    hello: "Hey, I'm Blu. Let's keep it cool and quick." },
  { id: 'rabbit', name: 'Ink', species: 'rabbit', color: '#2b2b3a', height: 1.25,
    quirk: 'Never says a word. The ears say everything.',
    hello: '...! (Ink waves both ears. That means hello.)' },
  { id: 'sloth', name: 'Moss', species: 'sloth', color: '#e2603f', height: 1.15,
    quirk: 'Packs snacks for every trip, and a spare hat.',
    hello: "Hiii, I'm Moss. Let's take it nice and easy... then zoom." },
  { id: 'dog', name: 'Peach', species: 'puppy', color: '#ef7fb4', height: 1.2,
    quirk: 'Headphones on, tail going. Loves every song.',
    hello: "Peach here! Woof! I mean, let's go!" },
  { id: 'cat', name: 'Mochi', species: 'cat', color: '#e9b33c', height: 1.15,
    quirk: 'Looks bored. Is secretly having the best time.',
    hello: "Mochi. Fine. Let's go. (This is fun.)" },
  { id: 'axolotl', name: 'Axel', species: 'axolotl', color: '#86b49a', height: 1.2,
    quirk: 'Can grow back anything, even a lost streak.',
    hello: "I'm Axel! Lost a streak? We'll grow it back." },
  { id: 'diver', name: 'Glub', species: 'diver', color: '#e7a72f', height: 1.1,
    quirk: 'One big eye, one big helmet, one big heart.',
    hello: 'Glub glub! That means hi in diver.' },
  { id: 'fluff', name: 'Pip', species: 'fluffball', color: '#f2c53d', height: 1.1,
    quirk: 'The horns twitch when the next key is close.',
    hello: "Pip here! Let's get fluffy and fast!" },
  { id: 'terrier', name: 'Scout', species: 'terrier', color: '#4f7fc0', height: 1.1,
    quirk: 'Sniffs out every typo before it happens.',
    hello: 'Scout reporting! Goggles down, nose ready.' },
  { id: 'pinkbunny', name: 'Hop', species: 'bunny', color: '#f08aa6', height: 1.25,
    quirk: 'Hops one key at a time, then all at once.',
    hello: 'Hop here! Ready? Set? Hop!' },
  { id: 'elf', name: 'Ember', species: 'elf', color: '#d2453a', height: 1.2,
    quirk: 'Pointy ears, fast fingers, faster grin.',
    hello: "I'm Ember! Let's light up the trail." },
];

/** Older names some screens still use for the list of buddies. */
export const CREW = BUDDIES;

export const FRIEND: Record<FriendId, Friend> = Object.fromEntries(BUDDIES.map(f => [f.id, f])) as Record<FriendId, Friend>;

export const FINGER_ORDER: Finger[] = ['LP', 'LR', 'LM', 'LI', 'TH', 'RI', 'RM', 'RR', 'RP'];

/** Each finger's colour: the keys it presses on the on-screen keyboard and its fingertip in the hand guide. */
export const FINGER_COLOR: Record<Finger, string> = {
  LP: 'hsl(345 70% 72%)', LR: 'hsl(268 62% 74%)', LM: 'hsl(200 70% 66%)', LI: 'hsl(158 55% 62%)', TH: 'hsl(48 85% 64%)',
  RI: 'hsl(100 50% 62%)', RM: 'hsl(228 65% 72%)', RR: 'hsl(290 50% 72%)', RP: 'hsl(322 62% 72%)',
};

/** The same colours, lighter, for key faces. */
export const FINGER_LIGHT: Record<Finger, string> = Object.fromEntries(Object.entries(FINGER_COLOR).map(([f, c]) => {
  const m = c.match(/hsl\(([\d.]+) ([\d.]+)% ([\d.]+)%\)/)!;
  return [f, `hsl(${m[1]} ${Math.max(20, +m[2] - 6)}% ${Math.min(94, +m[3] + 12)}%)`];
})) as Record<Finger, string>;

export const FINGER_NAME: Record<Finger, string> = {
  LP: 'left pinky', LR: 'left ring finger', LM: 'left middle finger', LI: 'left pointer finger', TH: 'thumb',
  RI: 'right pointer finger', RM: 'right middle finger', RR: 'right ring finger', RP: 'right pinky',
};

export const FINGER_FAMILY: Record<Finger, FingerFamily> = {
  LP: 'pinky', LR: 'ring', LM: 'middle', LI: 'index', TH: 'thumb', RI: 'index', RM: 'middle', RR: 'ring', RP: 'pinky',
};
