// The cast: the buddies who run the trails with you. Each is a 3D character (public/models/<id>.glb)
// made from Erik's designs. Fingers keep their own colours for the keyboard and the hand guide.

export type Look = 'soft' | 'ink' | 'paper' | 'geo';
export type FingerFamily = 'pinky' | 'ring' | 'middle' | 'index' | 'thumb';
export type Finger = 'LP' | 'LR' | 'LM' | 'LI' | 'TH' | 'RI' | 'RM' | 'RR' | 'RP';

export type FriendId = 'dino' | 'cheetah' | 'monkey' | 'koala' | 'box' | 'turtle';

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
