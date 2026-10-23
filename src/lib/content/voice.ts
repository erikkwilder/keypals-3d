// Every spoken line in the game. Audio files live in public/voice/<id>.mp3 (made by
// scripts/voice/generate.mjs). If a file is missing the game shows the caption and uses the
// browser's own speech voice instead.

export type VoiceId = 'coach' | 'dino' | 'cheetah' | 'monkey' | 'koala';
export type Line = { id: string; voice: VoiceId; text: string };

const coach = (id: string, text: string): Line => ({ id, voice: 'coach', text });

// The home-row tutorial, played before the very first lesson (and any time from the intro card).
export const HOME_TUTORIAL: Line[] = [
  coach('coach.home.1', "Hi! I'm your typing coach. Let's get your fingers ready for an adventure."),
  coach('coach.home.2', 'Sit up tall, put your feet flat, and let your wrists float just above the keyboard.'),
  coach('coach.home.3', 'Find the F key. Feel the little bump? That is home for your left pointer finger.'),
  coach('coach.home.4', 'Now find J. It has a bump too. That is home for your right pointer finger.'),
  coach('coach.home.5', 'Let the other fingers rest next to them. A, S, D, F on the left. J, K, L, and semicolon on the right.'),
  coach('coach.home.6', 'Your thumbs rest on the space bar.'),
  coach('coach.home.7', 'This is the home row. Your fingers always come back here after every key.'),
  coach('coach.home.8', 'Every finger has its own colour. When a key lights up, use the finger of the same colour.'),
  coach('coach.home.9', 'Try not to peek at your hands. Your fingers will learn the way.'),
  coach('coach.home.10', "Ready? Let's go!"),
];

// One coaching line per lesson, written for the QWERTY layout.
export const LESSON_LINES: Line[] = [
  coach('lesson.village-1', 'F and J are home base. Pointer fingers on the bumps, and bounce your thumb on the space bar.'),
  coach('lesson.village-2', 'D and K belong to your middle fingers, right next door to F and J.'),
  coach('lesson.village-3', 'S and L are for your ring fingers. Keep your pointers on their bumps!'),
  coach('lesson.village-4', 'A and semicolon go to your pinkies. Small fingers, big jobs!'),
  coach('lesson.village-5', 'Now all eight fingers work together. Stay on the home row.'),
  coach('lesson.village-6', 'Your pointer fingers stretch in to reach G and H, then hop right back home.'),
  coach('lesson.village-7', 'Real words now! Smooth and steady wins.'),
  coach('lesson.village-8', 'The Village Parade! Show everyone what you have learned.'),
  coach('lesson.treetops-1', 'Up into the treetops! Middle fingers reach up to E and I, then come back home.'),
  coach('lesson.treetops-2', 'Pointer fingers reach up to R and U.'),
  coach('lesson.treetops-3', 'Pointer fingers stretch up and in for T and Y.'),
  coach('lesson.treetops-4', 'Ring fingers reach up for W and O.'),
  coach('lesson.treetops-5', 'Pinkies reach up for Q and P. Keep the other fingers resting at home.'),
  coach('lesson.treetops-6', 'Treetop words! Reach up, then come back home every time.'),
  coach('lesson.treetops-7', 'Sentences in the branches. Thumbs on the space bar between words.'),
  coach('lesson.treetops-8', 'More leafy words. Try to keep a nice even rhythm.'),
  coach('lesson.treetops-9', 'The Canopy Run! Every key from the top two rows.'),
  coach('lesson.burrows-1', 'Down into the burrows! Middle fingers reach down to C and comma.'),
  coach('lesson.burrows-2', 'Pointer fingers reach down for V and M.'),
  coach('lesson.burrows-3', 'Pointer fingers stretch down and in for B and N.'),
  coach('lesson.burrows-4', 'Ring fingers reach down for X and period.'),
  coach('lesson.burrows-5', 'Pinkies reach down for Z and slash.'),
  coach('lesson.burrows-6', 'Every letter in the alphabet! You know them all now.'),
  coach('lesson.burrows-7', 'Tunnel talk. Commas and periods help sentences breathe.'),
  coach('lesson.burrows-8', 'The Lantern Run! Light up every key.'),
  coach('lesson.cliffs-1', 'Big letters! Hold Shift with your left pinky, then type the letter with your right hand.'),
  coach('lesson.cliffs-2', 'Now hold the right Shift with your right pinky for letters on the left side.'),
  coach('lesson.cliffs-3', 'Names and places start with a big letter. Shift with the other hand!'),
  coach('lesson.cliffs-4', 'Sentences start with a capital and end with a period.'),
  coach('lesson.cliffs-5', 'The apostrophe lives right next to semicolon. Your right pinky reaches over.'),
  coach('lesson.cliffs-6', 'The Summit Run! Capitals all the way to the top.'),
  coach('lesson.ridge-1', 'Numbers live on the top row. Pointer fingers reach way up for 4, 5, 6, and 7.'),
  coach('lesson.ridge-2', 'Middle fingers reach up for 3 and 8.'),
  coach('lesson.ridge-3', 'Ring fingers reach for 2 and 9.'),
  coach('lesson.ridge-4', 'Pinkies reach for 1 and 0.'),
  coach('lesson.ridge-5', 'Counting sentences. Reach up for the numbers, then come back home.'),
  coach('lesson.ridge-6', 'The Peak Run! Numbers and letters together.'),
  coach('lesson.shores-1', 'Question marks and exclamation points need Shift. Hold it with the other hand.'),
  coach('lesson.shores-2', 'Quotes are Shift and the apostrophe key. The dash is up next to zero.'),
  coach('lesson.shores-3', 'Brackets are Shift with 9 and 0. The colon is Shift with semicolon.'),
  coach('lesson.shores-4', 'At, number, and, and percent are Shift with 2, 3, 7, and 5.'),
  coach('lesson.shores-5', 'Shell sentences, full of symbols. Take your time.'),
  coach('lesson.shores-6', 'The Lighthouse Run! Everything you know, all at once.'),
  coach('lesson.road-1', 'Story time! Type a little adventure.'),
  coach('lesson.road-2', 'Fun facts! Type something amazing.'),
  coach('lesson.road-3', 'Tricky keys! This one is made just for you, from the keys that trip you up.'),
  coach('lesson.road-4', 'Speed sprint! One minute. How far can you ride?'),
  coach('lesson.road-5', 'Your own words! Type them nice and clean.'),
];

// For other keyboard layouts: the same moves, without naming letters.
const F_NAMES: [string, string][] = [
  ['LP', 'left pinky'], ['LR', 'left ring finger'], ['LM', 'left middle finger'], ['LI', 'left pointer finger'],
  ['RI', 'right pointer finger'], ['RM', 'right middle finger'], ['RR', 'right ring finger'], ['RP', 'right pinky'],
];
export const FINGER_LINES: Line[] = F_NAMES.flatMap(([f, name]) => [
  coach(`finger.${f}.home`, `Your ${name} rests right here on the home row.`),
  coach(`finger.${f}.up`, `Your ${name} reaches up, then comes back home.`),
  coach(`finger.${f}.down`, `Your ${name} reaches down, then comes back home.`),
  coach(`finger.${f}.num`, `Your ${name} reaches way up to the number row.`),
]).concat([
  coach('finger.LI.in', 'Your left pointer finger stretches in toward the middle, then hops back home.'),
  coach('finger.RI.in', 'Your right pointer finger stretches in toward the middle, then hops back home.'),
  coach('finger.shift', 'Hold Shift with the pinky on the other side, then type the key.'),
]);

export const REGION_LINES: Line[] = [
  coach('region.village', 'Welcome to Home Row Island, where every finger lives!'),
  coach('region.treetops', 'Welcome to Top Row Treetops! Time to reach up into the leaves.'),
  coach('region.burrows', 'Welcome to Bottom Row Burrows! Let’s dig down into the cozy tunnels.'),
  coach('region.cliffs', 'Welcome to Capital Cliffs! Big letters need the Shift key.'),
  coach('region.ridge', 'Welcome to Number Ridge! Climb up the number row.'),
  coach('region.shores', 'Welcome to Symbol Shores! Question marks, quotes, and seashells.'),
  coach('region.road', 'Welcome to the Open Road! Stories, sprints, and your own words.'),
];

export const COACH_BARKS: Line[] = [
  coach('coach.nice', 'Nice!'),
  coach('coach.great', 'Great job!'),
  coach('coach.perfect', 'Perfect run!'),
  coach('coach.close', 'So close! Fewer slips and you will pass.'),
  coach('coach.passed', 'Lesson passed!'),
  coach('coach.sticker', 'New sticker!'),
  coach('coach.outfit', 'Ooh, a new outfit!'),
  coach('coach.medal', 'You won a medal!'),
  coach('coach.palup', 'Your Keypal leveled up!'),
  coach('coach.clean', 'Keep it clean to go higher!'),
  coach('coach.slow', 'Whoa, steady now.'),
  coach('coach.regiondone', 'You finished the whole region! A new place is open.'),
];

// Short lines in each friend's own voice.
const F = (voice: VoiceId, lines: Record<string, string>): Line[] => Object.entries(lines).map(([k, text]) => ({ id: `${voice}.${k}`, voice, text }));
export const FRIEND_LINES: Line[] = [
  ...F('dino', { hello: "I'm Dino! Let's run, ride, and maybe go to space!", yay: 'Roar! That was awesome!', oops: 'Oops! My tail tripped me. Again!', ride: 'Faster, faster!', done: 'We made it! High five!', pick: "Let's go!" }),
  ...F('cheetah', { hello: "Hi, I'm Chee! Ready, set... type!", yay: 'Zoom! So quick!', oops: 'Whoops! Even fast cats slip.', ride: 'Feel the wind!', done: 'First place! Well, every place, together!', pick: 'Ready when you are!' }),
  ...F('monkey', { hello: "Momo here! I'm all fingers. Let's go!", yay: 'Ooh ooh! Nailed it!', oops: 'Banana slip! Try again!', ride: 'Wheee!', done: 'Banana party! We did it!', pick: 'Swing time!' }),
  ...F('koala', { hello: "I'm Kiki! Take it slow, take it steady, and we'll get there.", yay: 'Lovely, lovely!', oops: 'No rush. Try that one again.', ride: 'Whoa, so fast!', done: 'Cozy hug! We did it!', pick: "Let's go, nice and steady." }),
];

export const ALL_LINES: Line[] = [...HOME_TUTORIAL, ...LESSON_LINES, ...FINGER_LINES, ...REGION_LINES, ...COACH_BARKS, ...FRIEND_LINES];
