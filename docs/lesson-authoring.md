# Building one beat lesson

For the builder of one Learn lesson in the form of Layers of Cubes and How Many Cookies?. Read this page, the five files in `docs/lesson-template/`, and your lesson's row of the plan. That is enough to start writing. You should not need to read the player (`BeatEpisode.svelte`), `episodeScene.ts` or another lesson from end to end: when you need one detail, search for its name.

The rules that bind every line and picture are in `docs/lesson-rules.md` (with Erik's own words; it is the authority). Section 14 here is the same list at one line a rule. Words used below: `<id>` is the lesson's id (the old lesson's id, kept), `<x>` a short word for its thing (crate, count, share), which is also its voice key.

## 1. What a beat lesson is

A short film in a 3D room that stops for the child. One narrator speaks. The child's buddy and the room's Glimmer act and think in bubbles and never speak. The script is a small program: it tells the world what to act out and asks the child, and whatever the child answers is acted out and decides what comes next.

Its parts, in order. Each is a "beat", a star at the top of the screen.

1. **The need.** Why the answer matters in this story, shown as it is told. If the only true reason is that it's a puzzle, call it a puzzle.
2. **Shown once** (below grade 6 only: young children learn more from being shown first). The narrator does one small case.
3. **The child's try.** The child answers from the picture. The line says whose try it is, the answer is acted out on the thing, right or wrong, and the next line says what it showed, with the child's own numbers.
4. **The working.** The right answer built step by step on the thing, each step with its reason. It stays until the child taps Next. The child who was right sees it too.
5. **The friends' wrong ideas.** Two mistakes children really make with this idea, one the buddy's, one the Glimmer's. Each is named, tried on the thing, and the child finds or judges what went wrong with a tap that can be wrong.
6. **The child alone.** Every child gets one right by themselves before the end. A child who hasn't yet gets one small new problem.
7. **The written form** (the sum, the name, the symbol) comes last, from what the hands did. Then this story's own ending.
8. **The next-day check** (`check`): one new problem, with what was kept from the first day.

Length with the voice: a child right every time at most 4 minutes (3.5 for Kindergarten to grade 2), a child wrong all the way at most 7.

## 2. The files of one lesson

| File | What it is |
|---|---|
| `src/lib/math/beats/<x>.ts` | The arithmetic with no pictures: what any answer means on the thing, and the wrong ideas as functions. |
| `src/lib/math/beats/<x>Lesson.ts` | The world's interface, the cue table `AT`, the script (`play`, `check`) and the lesson object. |
| `src/lib/math/beats/<x>Lesson.test.ts` | The pretend children, the rule checks, the cold-read printer. |
| `src/lib/three/<x>Kit.ts` | The world: what is on the table. Only when no existing kit fits. |
| `src/lib/content/voice.ts` | The lines, in `BEAT_LINES`, ids `ep.<x>.<name>`. |
| `public/voice/ep.<x>.*.mp3`, `src/lib/content/voice-manifest.json`, `scripts/voice/made.json` | Made by the voice generator. Commit them. |
| `lessons.ts`, `../episodes.ts`, `voiced.test.ts` | Where the lesson is registered (section 10). |

The template is a toy lesson, Enough Spoons, with one working example of each kind of step. Copy the five files, rename `spoon`, and replace everything. Do not copy lines from any finished lesson: port the rules, not the words.

## 3. The script: what `Teller` gives you

`play(t, w)` gets the teller `t` and its world `w`. Every call that takes time returns a promise: `await` it, so the story never runs ahead of the picture.

| Call | What the child gets | When |
|---|---|---|
| `await t.say(id, n?, m?, k?)` | The narrator says one line and its words stay on the card. `n`, `m`, `k` fill `{n}`, `{m}`, `{k}` in the words shown. | A short line with nothing to show, or a stop kept on purpose (section 5). |
| `await t.sayWith(id, cues, n?, m?, k?)` | The same, and each cue `[seconds, () => world step]` is acted out when the narrator reaches that second. Over when the line is said and every picture has finished. | Any line that names something that can be seen. Most lines. |
| `await t.num(prompt, line?, n?)` | The number keys (up to 4 digits). `prompt` stands over the keys; `line` is said as the question opens, and the child may answer over it. Returns the number. | The child's own number. |
| `await t.pick(prompt, choices, line?)` | Buttons, `{ id, text }` each. Returns the id. | Two or three real ideas. Keep each `text` short: a phone cuts long ones. |
| `await t.hands(words, job, showMe)` | `words` on a pill, a hand hint at `w.handPoint()`, an arrow along `w.dragPath()`. After 12 s with nothing done, a "Show me" button calls `showMe`. Over when `job()` resolves. | The child's hands do the work in the world. |
| `await t.go(label)` | One button (Enter and Space press it). | After a worked answer: it stays until the child moves on. |
| `await t.wait(ms)` | A wait on the lesson's clock. | Rarely. 700 ms at the very start, so the room has settled. |
| `t.buddy(move)` | wave, cheer, jump, gasp, oops, shrug, nod, clap, think, point, present, talk | The buddy reacts. Not awaited. |
| `t.pal(move)` | hop, happy, act, sad | The Glimmer reacts. |
| `t.thought(who, text)` | A bubble over `'buddy'` or `'pal'`; `null` takes it away. | A friend's idea as a number or a sum. |
| `t.myBet(text)` | A card "YOU 7" at the side; `null` takes it away. | While the child's number is being tried. |
| `t.beat(n)` | The stars at the top. | At the start of each part. |

The player does the rest for every lesson: the narrator's card, held until its clip ends (at most 2.5 s plus 95 ms a letter of the words shown: a longer clip is cut off); Pause, which stops clip, picture and cues at once and carries on mid-sentence; starting on a tap when opened from a link; word cards pushed apart so none covers another; the phone layout under 760 px wide; the end card with `card(notes)`, and the saving.

What `play` returns (`Notes`, numbers by name) is saved with the child and handed to `card` and to `check`. The first day's notes are the ones kept.

Three shapes to keep, all in the template:

- **A try** is one function: say whose it is (`ep.<x>.try.you`, the move inside the line), act it out, then say what it showed with the child's number (`right`, `few`, `over`). Silly numbers go through like any other: zero gets its own words, 9999 is acted out up to a cap with a word pin.
- **The working** is one function for both children: the right child hears why they are right; the wrong child is told kindly that we'll look together, and sees it worked on the thing. Then `t.go('Next')`. Never ask the same question again straight after showing its answer.
- **A friend's idea**: `t.thought`, a `try.buddy` line, the idea acted out, then a tap or a choice by the child, then the reason. When the child's own number equals a friend's, play it once for both.

## 4. The world

A world is what is on the table for one kind of lesson. The script only sees its interface (`export interface <X>World extends World` in the lesson file), so the test can play the script with a pretend world.

House style for the interface:

- One method for each thing that can be seen to happen, named for what a child would say happened (`trayIn`, `pour`, `cut`, `serve`), each with a one-line comment.
- A method that takes time returns a promise that resolves when the movement is over.
- A move that the narrator may talk over takes an optional length in seconds (`over`): it may go slower than usual, never quicker.
- A job for the child's hands returns a promise that resolves when the job is done (`tapCount(): Promise<void>`), or with what the child did (`tapSlip(): Promise<'yes' | 'no' | 'shown'>`).
- `finish()` does the rest of the hand's job by itself: it is what "Show me" calls.

Every world also has what the player needs (`World` in `types.ts`; the kit template has all of it), and if wanted `words` and `onWord` (short words heard as something happens: the count words) and `clearForCard()` (anything big leaves before the end card).

## 5. A line with its pictures

A child never sits watching a still screen while the narrator talks (rule 37). So most lines are said with `sayWith`:

```ts
await t.sayWith('ep.count.intro', [[AT.intro.cookies, () => w.trayIn(3)], [AT.intro.plate, () => w.plateFor()]]);
```

- A cue's second is where the narrator begins the words that name the picture. Read it off the clip (section 8, word times). Keep every second in one table, `AT`, at the top of the lesson file, with the words in a comment. A line recorded again needs its seconds read again.
- The picture acts out the words on the things already on the table: a thing moves, lights, is counted, is compared. It shows the reason the words carry. It does not decorate.
- A picture never answers a question the child hasn't been asked yet (rule 41). Light the halves, not the 4 and 4.
- A count said inside a line lights each thing as its number is said: one cue for each number (rule 42).
- What the narrator says is happening happens while it is said, not before the line and not after it (rule 43). A name comes onto the thing at the words that give the name.
- Something that is up for under a second is not seen. Let it stand into the next line.

**Movement begins in the line and ends with it (rule 45).** Look for two shapes in your script: `await t.say(X); await w.move()` and `await w.move(); await t.say(X)`. Both leave the child with talking and no movement, then movement and no talking. Write instead:

```ts
// "Let's get as many plates as you said, and put one cookie on each plate": from "get", 3.5 s
await t.sayWith('ep.count.try.you', [[AT.you[0], () => w.plates(n, AT.you[1])]], n);
```

1. Find the words of the line that name the move. Their second is `from`. The clip's length minus `from` is how long the move may take.
2. Keep `[from, takes]` in `AT`. Give the kit's move its optional length: stretch the gaps between things first, each thing's own slide a little (1.5 times at most).
3. Things that leave go at second 0 of the next line. A small leaving followed at once by a bigger one is dropped (the tray takes its plates with it).
4. The pictures of one line run side by side, and **all at once** when the clip can't play, the voice is off, or a line is hurried in testing. So two moves that depend on each other go in one cue (`async () => { await w.out(); await w.in(); }`), or the first lets go of its things at once.

**Stops worth keeping.** A full stop between words and movement stays only where it teaches better. Write each one down with its reason, in the script and in the test:

- a count heard number by number (a count word can't be said under another line);
- the child is told to watch and is then asked about what they watched;
- the child's own try: lay it during the line, mark its result after the line, and let it stand a moment before the narrator speaks of it;
- every question and every job for the hands;
- where another move in the same line would blur what caused what (plates leaving inside "bumps the table" would look like the bump's doing);
- nothing is coming (zero plates).

## 6. Choosing a world

Reuse a kit when the idea fits what it can already show. Adding a method or two to a kit is cheaper than a new kit: say so in your note, and run that kit's own lesson's tests.

| Kit (interface in) | On the table | Can show | Fits |
|---|---|---|---|
| `countKit.ts` (`countLesson.ts`) | A tray of up to 8 cookies in a row or mixed up, a row in front, plates | Counting by taps (moved to a row, or where they sit) with a number on each thing and the count word heard; the narrator's count; a friend's count with a slip, and a tap to find it; "?" cards; as many plates as a number says, one to a thing, with what is left over ringed; things pushed round with nothing added | Counting, one for each, more and fewer, the same number however it is arranged |
| `shareKit.ts` (`shareLesson.ts`) | One bar of squares, a plate for each friend, a knife | A whole bar cut by taps on its lines; pieces served and stood side by side with their lengths; pieces joined again; a name on every piece ("1/4"); someone else's bar beside it; one piece laid under another to compare; a piece given to another plate and stacked; a level line; eating | Equal shares, halves and fourths, unit fractions, comparing them, fractions with the same bottom number added, division as sharing |
| `balanceKit.ts` (`equationLesson.ts`) | A balance that tips by what is really on it, bags that all weigh the same, loose weights | A guess tried by putting that many weights in each bag's place; weights dragged off one side or both; a side shared into equal piles; lit parts and a level line; the equation written line by line; tags | A missing number, the meaning of "=", one-step and two-step equations, more and less by weight |
| `crateKit.ts` (`crateLesson.ts`) | A crate with clear or shut walls, unit cubes | Any number of cubes poured in, gaps and leftovers; a cube rolled along an edge leaving a line and its number; a row swept into a floor and a floor pulled up into a block, by drag; the sum in the lines' colours; tipping it and counting again; tapping a face | Volume, layers; with one layer, rows and columns (not tried) |
| `frameKit.ts` (`FrameWorld` in `tenLesson.ts`) | A ten frame (two rows of five places; `new FrameKit(sc, { frames: 2 })` gives two, side by side or one under the other on a phone, never yet drawn) and counters in the sum's two colours (buns with blue `.t-a` or pink `.t-b` icing in the kitchen) | `trayIn(n, over)` a frame slides in with n first-colour counters (the old one leaves); `fill(n, over)` n more of the first colour; `more(n, over, from)` n of the second colour into empty places, a counter with no place stopping in a row in front; `moreOff()`, `spareOff(over)` take the second colour or the place-less ones away; `light(what)` yellow rings on a row, every place, the empty places or one colour; `point(k)` the light and a number on the kth empty place (for a count said in a line, rule 42); `showLeft()` a red ring on what is left over; `tapFill()` the child taps each empty place, which gets a counter, the next number and its count word; `tapEmpty()` one tap on an empty place; `writeSum(a, b)` the sum over the frame in the two colours (it takes the count numbers away); `clear(over)` | Make Ten (the partner that makes 10); teen numbers as ten and some more (two frames); plus 10 and plus 9; any sum within 20 shown as filling a ten |

If nothing fits, write a small kit from `docs/lesson-template/spoonKit.ts.txt`. What every kit must do:

1. **Stand on the lesson's table.** `constructor(private sc: EpisodeScene)` adds its `root` to `sc.root`. Place things in board units with `sc.boardPoint(x, y)`: the board is 600 across with its middle at 300, and `y` grows toward the child. `bounds()` is the part of the board the camera frames: wrap your things closely, because empty board makes everything smaller. `refit()` reads the scale and makes geometry once.
2. **Keep the scene's clock.** Movements run from the `t` given to `update(dt, t)`, and every wait goes through `SceneWaits` (`this.waits.tick(t)` in `update`). Never `setTimeout`, `setInterval` or the wall clock: on a slow computer the narrator would say what the picture hasn't shown yet, and Pause would not hold the picture. `src/lib/three/sceneWaits.test.ts` finds every kit named in a `*Lesson.ts` and fails one that breaks this.
3. **Pins for every sign and number.** Words in the room are `Pin`s, drawn by the player as cards on a point: `{ id, text, at: () => Vector3, kind }`. Kinds: `tick` (a number on a thing; `big: true` for a numeral a young child must read), `edge` (a number on a line), `count` (a running count, hidden while a number question is open because it can be the answer), `word` (a short label), `sum` (the written sum, with `parts` in their lines' colours `a`, `b`, `c` and `under` words; the one kind still shown on the end card). "1/4" as a text is drawn as a stacked fraction. A "?", a tick, a cross, a tag are pins too. Do not model signs in 3D. Replace the `pins` array and call `onChange` on every change; take a thing's pins away when the thing leaves.
4. **Hands that can go wrong.** `pointer('down' | 'move' | 'up', x, y)` returns true when it used the touch. Find the thing touched in screen space with a wide reach (`Math.max(64, innerWidth * 0.05)` px). A wrong touch does something (a shake, a sound). `handPoint()` is where the hint hand shows, `dragPath()` the two screen points of a drag (null for taps), `tryPoint()` where a first touch should land. Keep the field name `job` and the method name `screenOf`: the play-through driver reads them.
5. **Fit a phone.** Choose the layout once from the screen's shape (`innerWidth < innerHeight * 0.9`). On a phone a long row wraps into lines of four, and things are made bigger. Something a child taps is at least 44 px across at 390 wide; a numeral on it at least 20 px. The camera's knobs on the scene: `sc.closeUp()`, `sc.workZoom`, `sc.widePitch`, `sc.tallPitch`, `sc.tallShare`, `sc.frameBox`; `sc.extraWork` tells the friends and props what to keep clear of. Put every knob back in `dispose()`.
6. Sounds are in `math/beats/sounds.ts` (`bSfx`). The friends are `sc.me` (the buddy) and `sc.pal` (the Glimmer).

The scene's own counters, ten frames, plates and number plank (`sc.show(board)`, `sc.arm(task, next)`, which the old lessons use) cannot be driven from a beat kit: their counters are private, their movements have fixed lengths, and there is no light on one counter and no point to pin a number to (read while building Make Ten). Use `frameKit.ts` for ten frames.

## 7. The lines

They live in `BEAT_LINES` in `src/lib/content/voice.ts`, one block for each lesson under a comment, written `ep('ep.<x>.<name>', text, said?)`.

- `text` is what is shown: digits and signs are fine, and `{n}`, `{m}`, `{k}` are filled by the script.
- `said` is what the voice reads: whole sentences; numbers and signs as words ("take away", "times", "makes"; "equals" only in algebra); fractions as words; no colons, brackets or slashes; no capitals for stress. The voice can't say `{n}`: say it another way ("as many plates as you said"), or write one line for each number (`b5.show`, `b7.show`). Leave `said` out when the shown words read well aloud as they are.
- Names: every line that says what is about to be tried, and whose try it is, has `.try.` in its id (`try.you`, `try.buddy`): the test finds them by that. Result lines are named for what happened.
- Six to 40 words, one to three plain sentences. A line over 40 words becomes two lines; it is never shaved by a word to fit.
- List every id the script can say in `<X>_LINES` in the lesson file. The test holds that list equal to what `BEAT_LINES` has for the lesson.

The rules that bind words are 1 to 9a, 13a to 13c, 18, 26, 27, 29, 30 and 44 (section 14). Read each line as a nervous child who has seen only what came before it.

## 8. Recording and checking the clips

Making clips loads a voice model: a heavy job. Take the slot first and read its answer before starting (see the brief's house rules).

```sh
node scripts/voice/generate.mjs --match '^ep\.<x>\.' --dry-run     # what it would make
node scripts/voice/generate.mjs --match '^ep\.<x>\.'               # about 8 s a line; narrator = voice B
node scripts/voice/check.mjs --match '^ep\.<x>\.'                  # run check.mjs: levels, the words heard, blips inside a clip
node ~/Documents/keypals-voice-2026-11/scripts/cap_check.mjs "$PWD" '^ep\.<x>\.'      # each clip against the time its line is held
python3 ~/Documents/keypals-voice-2026-11/scripts/edges.py public/voice '^ep\.<x>\.'  # both edges of each clip
npx vitest run src/lib/math/beats/voiced.test.ts                   # every line has a clip, none is cut off
```

- A take that comes out wrong: a new `seed` (or respelled words) for that line in `scripts/voice/line-overrides.json`, then `generate.mjs --only <id>`. About one line in a hundred needs it.
- A clip longer than its hold (2.5 s + 95 ms a letter shown) is cut off mid-sentence: split the line.
- Words that sound like other words when spoken ("buddy's way", "buddies weigh") are a fault in the wording, not the take.
- **Word times**, for the cues: `python3 ~/Documents/keypals-lessons-2026-11/fresh/pictures/share/whisper-word-times.py public/voice/ep.<x>.*.mp3 > word-times.txt`, in one process, under the slot. Each row is a clip, its length, and every word with the second it starts. Set `AT` from it and keep the file beside your note.

Until the clips exist, `voiced.test.ts` fails. So write the lines early, make the clips in the background while you write the test, and commit when both are there.

## 9. The test

Copy `spoonLesson.test.ts.txt`. Its parts:

- **`pretend(child)`**: a pretend teller and a pretend world that logs every call. The child is data: the numbers typed, the choices picked, what the taps do. It keeps a `log` (what the rules read), `said` (line ids) and `film` (the run as a reader follows it).
- **`stepsOf(log)`** turns the log into the steps the rules know: `say`, `act` (a real try: something whose result the child is told about), `answer` (the working shown), `ask` (a question or the hands at work), `go`, and `show` (a picture inside a line). You say which world calls are tries and which are the working.
- **`scriptProblems`** fails a try that isn't announced (rules 6, 7), a result nobody explains (8), an answer shown with nothing said or that doesn't wait for the child (10, 11). Run it for every kind of child: right every time, wrong every time, too many, too few, right then wrong, and a child who thinks like each friend.
- **`stillStretches`** fails 35 words or more in a row with nothing new on screen (37), for every child and the next-day check.
- **Rule 45**: one test lists every move made outside a line; it must equal exactly the stops you kept.
- **`lineProblems`** and the words tests: 6 to 40 words, no stock ending, no digit in a spoken form, no line the script can't say.
- **Your own**: every number is acted out, even a silly one; nothing said before a question gives its answer away; the wrong child gets the reason; a child wrong all the way still gets one right alone; the ring or mark that answers a question comes after the question.
- **The cold read** (rule 21, 36): `COLD_READ=/dir/out.txt npx vitest run src/lib/math/beats/<x>Lesson.test.ts` writes `/dir/out.<x>.txt`: both children, real numbers in the lines, each picture with its second. Give it and the rules to a reader who did not write the script. Fix or answer every flag.

Run `npx vitest run src/lib/math/beats`. Read the "Tests" line or the exit code; never pipe a test run into `head`.

## 10. Registering the lesson and switching it over

1. The lesson object (bottom of the lesson file): `id` is the old lesson's id, so everything that opened the old lesson opens the new one. `voice: '<x>'`: always give it; the old version's lines are `ep.<id>.*` and must stay apart. `set` is the room, `star` its Glimmer, `art` the old lesson's card picture, `beats` the number of stars, `keys: false` if it never asks for a number (the picture gets the room).
2. `src/lib/math/beats/lessons.ts`: import it and add it to `BEAT_LESSONS`. The page then plays any id found there in the beat player.
3. `src/lib/math/episodes.ts`, in `TRIMS`: `'<id>~old': { base: '<id>', steps: 99 }`, so the old version still opens at `#learn=<id>~old` for comparing.
4. `src/lib/math/beats/voiced.test.ts`: add `<x>` to the `LESSONS` pattern and to the list in its first test.
5. Open it: `npx vite --port <yours> --strictPort --host 127.0.0.1` in your worktree, then `http://127.0.0.1:<port>/#learn=<id>`. The next-day check is `#learn=<id>,check`. The address is read when the game starts: go to `about:blank` first.

## 11. Playing it through

The review tools are outside the repo, in `~/Documents/keypals-lessons-2026-11/fresh/` (F here). The driver `F/drive.mjs` plays a lesson with real taps as the child its config describes, saves a screenshot at every line, question, job and the card, and writes a timed log with every moment two cards overlapped. `F/old-browser/run128.sh '<json>' [seconds]` runs it in the old Chrome 128 with every `/api` call blocked, and adds the clips played and the page errors. It needs your dev server (its hooks exist only there). Playing is a heavy job.

The driver knows the lessons it was written for. For a new one, **make your own copy of the driver for each run** (as `F/pictures/count/overlap-driver-patch.py` does; `run128.sh` writes one shared `.drive128.mjs`, and two runs at once would collide). In the copy: add your id to `KEY`, make the folder `F/<x>/`, and write the hands' part for your kit. Number questions, choices and Next are already handled. A start for the hands (not yet run):

```js
async function handsMine() {   // whatever the kit's hint points at, until the job is done
  for (let k = 0; k < 40; k++) {
    const at = await page.evaluate(() => { const w = window.__beat.world; if (!w.job) return null; const d = w.dragPath(); if (d) return d; const p = w.tryPoint(); return p ? { a: w.screenOf(p) } : {}; });
    if (!at) break;
    if (at.b) await drag(at.a, at.b); else if (at.a) await page.mouse.click(at.a.x, at.a.y);
    await pause(450);
  }
}
```

A wrong child's hands need their own lines: read from the kit what a wrong touch is, as `handsCount` does for `finds`.

Config: `lesson` (add `,check` for the next day), `w`, `h`, `mobile`, `port`, `pfx` (the files' prefix), `nums` (answers to number questions, in order), `picks` (choice ids, in order), anything your hands need, `fast` (ms a line is held, for a quick look at layout; off for timing), and `save`, `active`, `saveOut` to start from a copy of a real saved game and write it back.

```sh
./run128.sh '{"lesson":"<id>","w":1440,"h":900,"port":5291,"nums":[5,7,7],"pfx":"r1440"}' 900 > F/<x>/r1440.out 2>&1
./run128.sh '{"lesson":"<id>","w":390,"h":844,"mobile":true,"port":5291,"nums":[4,8,6,3],"pfx":"w390"}' 900 > F/<x>/w390.out 2>&1
```

Play the child who is right and the child who is wrong all the way, each at 1440 by 900 and at 390 by 844, with the voice at normal speed; the next-day check once; and one run with `"save":"F/real-save/test-save.json","active":0,"saveOut":"F/<x>/after.json"` (full paths), then see the lesson marked done in the file written. In each `.out` read: `CARD` reached; every narrator line played (a question's line answered over doesn't reach its end: expected); page errors (a worktree's font 403s are not errors: look for any other); label overlaps (the longest run under 0.15 s); the total seconds.

Contact sheets: `python3 F/sheet.py <x> <pfx> [cols] [rows] [cell width] [lines|all]`. For a shot inside a line, at a picture's moment, give your driver copy `"pics": [["words of the line", ms, ms]]` as the patch script does. Look at every sheet at both widths: can the picture answer the question, can every label be read, is anything hidden or through anything.

## 12. Done

All of it, or say exactly what is missing.

1. `npx vitest run src/lib/math/beats`, the whole suite (`npx vitest run`, heavy) and `npx svelte-check --tsconfig ./tsconfig.json --output machine` (0 errors; about 300 warnings is normal).
2. The cold read of both children read by someone who did not write it; every flag fixed or answered.
3. Every clip made and checked (section 8). Cue seconds set from word times, none guessed.
4. Played to the end card in Chrome 128: both children, both widths, the next-day check, a real save. Every line played, no page error but the fonts, no overlap over 0.15 s, lengths within the limits.
5. Contact sheets at both widths, looked at.
6. The old version opens at `~old`.
7. Any new principle added to the rules, in the repo's `docs/lesson-rules.md` and the vault copy, as the next number, with why.
8. Committed on your branch. Not pushed, merged or published.

## 13. The hand-off note

For the lead, who reads it instead of your work: the state in its first lines (built, tested, seen, committed: which are true); branch, worktree, commit; the idea in one sentence and the two wrong ideas; the kit (reused, changed or new); each picture with its line and second; the stops kept, with reasons; each "done" point with the path of its proof; lengths for both children; the slot lines; what is left; anything for the lead's eye; anything still running and what to read when it ends.

## 14. The rules at one line each

The full text, with Erik's words and why each exists, is `docs/lesson-rules.md`.

**A. Every line makes sense to a child who has seen only what came before it**
- 1. No line leans on an idea the child hasn't been given.
- 2. A claim comes with its reason.
- 3. Cut the clever line; use the real reason.
- 4. Plain and whole: one to three ordinary sentences, not clipped and not long.
- 5. A nervous child is the reader: when in doubt, say it more simply.

**B. Say what's happening around every action**
- 6. Before something happens, say what it is.
- 7. Say whose idea it is, every turn; the child's number is on screen and in the words.
- 8. After it happens, say what it showed and why, tied to whose try it was.
- 9. Announce every change of gear, kindly; nobody "ran out of chances".
- 9a. A partly right answer gets credit for the right part.

**C. The right answer**
- 10. It is worked out, not flashed: step by step on the thing, each number tied to what it did.
- 11. It stays until the child moves on: a button, never a timer.
- 12. A right guess still gets the why.
- 12a. Every child gets one right on their own before the end, and the credit for it.
- 13a. Questions are fair: never show an answer before asking for it; a hint asks for what the box wants.
- 13b. Say only what's needed.
- 13c. A word means one thing, in a child's sense of it.

**D. The picture and the child's hands**
- 13. Never ask about an empty scene.
- 14. Show it in the space: numbers stand on the thing, lines are drawn, colours tie the sum to the edges.
- 15. The child commits first; their answer is acted out, right or wrong.
- 16. Hand steps can go wrong, and show the movement expected.
- 17. The formula comes last, from what the hands did.
- 18. Each lesson ends in its own way.
- 19. Words and picture work together: don't cut words to look clever, don't let words replace showing.
- 20. Nothing passes through anything; the camera is still when a question opens.
- 20a. One voice: the narrator. The friends act and think in bubbles.
- 20b. No two word cards overlap, at any size.
- 20c. What's shown really happens.

**E. Before anyone sees a lesson**
- 21. A cold read by a fresh reader, as a nervous child who gets everything wrong.
- 22. Run the checks in `rules.ts`.
- 23. Play every wrong path, reading each screen as that child.
- 24. Check it as Erik will see it: a direct link, a real tap, sound, the old Chrome 128.

**F. Found in review**
- 25. The picture can answer the question: nothing asked about is hidden; a colour or place named is really there.
- 26. The reason belongs to every child, most of all the one who was wrong.
- 27. What a result showed is said with the child's own numbers.
- 28. Watching a friend go wrong is still watching: the child finds the mistake with a tap that can be wrong.
- 29. If the only true reason is that it's a puzzle, call it a puzzle.
- 30. A line over 40 words is split, never shaved.
- 31. A young child hears the count: the word is said as each thing is touched.
- 32. Every label can be read at every size: on the screen, not cut, not piled at an edge.
- 33. Room for the number keys only in a lesson that asks for numbers.
- 34. The story never runs ahead of the picture: kits wait on the scene's clock.
- 35. On a phone: number keys in two rows, a long question wraps, a short wide picture sits in the middle.
- 36. A cold read by someone who did not write the script is not optional, and reads both children with real numbers.

**G. Erik on the live lessons**
- 37. During any longer narration, something on screen shows what is being said.
- 38. A thing that is going to be cut starts whole.
- 39. Pause stops the narrator at once; Keep going carries on mid-sentence (the player does this).
- 40. Word cards settle and never shake (the player does this).

**H. Found building the pictures**
- 41. A picture with a line never answers a question not yet asked.
- 42. A count said in a line lights each thing as its number is said; nothing is touched like a count without its number heard.
- 43. What the narrator says is happening happens while it is said, not before and not after.
- 44. A reason is said whole once; the next time shorter, with the new numbers and the reason still in it.

**I. Erik on How Many Cookies? with its pictures**
- 45. Movement begins while the line about it is being said, and the two finish together; a stop is kept only where it teaches better.
- 46. Every recorded line is checked for blips inside it, not only at its edges.

## 15. Traps others fell into

- **Font 403s are not page errors.** A worktree with `node_modules` linked from the main checkout can't serve the font files, so its dev server answers 403 for them and the cards use a fallback font. Overlaps are still right enough to check. A run was once stopped for "28 page errors" that were all fonts.
- **A picture that answers the question.** A ring on what is left over, a "2/3" beside a stack: each stood there before the child was asked. Put it in the line that gives the answer.
- **`mlx_whisper` given several clips on its command line writes one file.** Use the word-times script (one Python process, the clips as arguments).
- **Shared names.** Two builders must not share a heavy-job slot name (the second take relabels the first's slot, and a release frees it under the other), a driver copy, a port, or a commit message file.
- **Every cue at once.** A tray leaving and a tray coming, in two cues of one line, left half a table when the clip couldn't play.
- **A card that hides the picture on a phone.** A big number card stood exactly where the plates came. Look at 390 wide, not only 1440.
- **Zero.** "Your 0 plates weren't enough" is nonsense. Zero gets its own words.
- **Labels of things that left.** Pins whose things are off the page pile up at the screen's edge. Take them away with their things.
- **`take && job`, never `take ; job`.** Read the slot's answer in one step, start the job in the next, and run long jobs in the background. macOS has no `timeout` command. Stop only processes you started, by their number.
- **Timing in a slow browser.** A browser that draws slowly makes a run longer; the driver's last lines say how long it takes "on a computer that keeps up".

### Found building Make Ten (26 Nov 2026), the first lesson made from this guide

- **Names the guide didn't give.** Each room's Glimmer has a name the narrator uses ("Sprout Bunny" in the kitchen): take it from the room's existing lines (`grep "ep\.<room's lesson key>\." src/lib/content/voice.ts`). A sum's two parts are drawn in the pin colours `.t-a` (blue) and `.t-b` (pink), so the things on the table must be those two colours too.
- **No card picture.** Some old lessons drew their card from a board and have no painted picture: use the room's existing card as a stand-in and say so in the hand-off note.
- **The research behind a wrong idea.** Name where it comes from in the note; if it is from classroom experience, say that.
- **A number pinned above a front-row thing stands over the row behind it on a wide screen.** At 1440 a count put 2 to 5 on four blue buns. Pin a count's number onto the place itself.
- **On-screen sizes move from run to run** (a place measured 41 to 48 px at 390). Measure the floor (44 px) in more than one run, and leave room above it.
- **Count words need a full stop each in the spoken form** ("One. Two. Three."), or the voice runs them together and the lights fall off the words.
- **Never change a file under `src` while a play is running.** The dev server reloads the page.
- **`~/bin/heavy-job release` takes the slot's name alone**, not the whole "name: what" text.
- **The clips commit** carries `scripts/voice/raw/check.json` and `scripts/voice/raw/report.json` as well as the clips and `made.json`.
- **A driver patch for a new kind of hands** (a tap on a place, a tap on a thing): copy `~/Documents/keypals-lessons-2026-11/fresh/lessons/make-ten/drive-patch.py` and change its selectors.
- **The run output's "narrator clips" line can read 0** when clips play from the copies kept for a dropped connection. Count from "clips started" and "played" instead.
- **The first fix pass is part of the lesson.** The lead's cold read found two lines to change and the last look found a card hiding the pink buns on a phone; plan for one more short round after the first full play.
