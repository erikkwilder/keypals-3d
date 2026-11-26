# Brief for one lesson's builder

The lead fills the blanks and gives this to the builder of one lesson. Everything in `____` is a blank. Keep it this short: the guide holds the how.

---

You build one Keypals Learn lesson in the new form (a "beat lesson"): **____ (title)**, id `____`, grade ____.

## Read, in this order, and nothing else first

1. `docs/lesson-authoring.md`: the guide. All of it, once.
2. `docs/lesson-template/`: the five files you copy and replace.
3. Your lesson's row of the plan, below.
4. Only when the guide's checklist leaves a doubt: the full rule in `docs/lesson-rules.md`.

Do not read the player (`BeatEpisode.svelte`), `episodeScene.ts` or a finished lesson from end to end. Search for the one name you need.

## The lesson (its row of the plan)

- **The one idea**, in a sentence, and its standard: ____
- **Path lessons it serves** (it is written for the youngest): ____
- **What the child already knows** (assume nothing else): ____
- **The need in the story** (or: it's a puzzle, and says so): ____
- **The thing on the table, and what the child's hands do to it**: ____
- **What a wrong answer looks like on the thing**: ____
- **Two wrong ideas children really have**, with where each comes from: the buddy's ____ ; the Glimmer's ____
- **How the child gets one right alone**: ____
- **The written form that comes last** (sum, name, symbol), if any: ____
- **The room and its Glimmer** (`set`, `star`), and the old lesson's card picture: ____
- **Below grade 6?** Then the idea is shown once before the child tries: ____ (yes / no)
- **The old lesson** to replace (its steps and questions are in `____`); it stays reachable at `#learn=____~old`.

## The world

- Kit: ____ (reuse `____Kit.ts` as it is / reuse it and add ____ / a new small kit `____Kit.ts`, which these later lessons will reuse: ____ , so give it ____ ).
- Short word for the files and the voice key (`<x>`): ____

## Yours alone (share none of these with anyone)

- Worktree `____`, branch `____`, made from `____`; link `node_modules` from the main checkout.
- Dev server port: ____
- Heavy-job slot name: `____`
- Evidence folder: `____`
- Hand-off note: `____`
- Commit message file: `____`

## House rules (all binding)

1. Work only in your worktree. Never touch the main checkout or another worktree. Do not change the player or another lesson; if you must change a shared kit, keep it small, run that kit's own lesson's tests, and say so in the note.
2. A heavy job (making clips, word times, a play-through, the whole suite) starts only after `~/bin/heavy-job take "<your slot name>: <what>"` has answered "Slot taken", read in an earlier step: `take && job`, never `take ; job`. Release it after, also on failure. If both slots are busy, a background loop that asks every two minutes and runs the job itself. Put the "Slot taken" lines in your note.
3. Never sit waiting on a long job. Run it in the background, chained so it carries on by itself, and write down what to read when it ends.
4. Stop only processes you started, by their number. Stop every server you start.
5. Commit on your branch in Erik's name only: no other name or credit line anywhere. Message in your own file, `git commit -F`. Style (see `git log -5`): what a child now sees, how it was seen, ending "Held by tests in <files>".
6. Do not push, merge or publish. Never print secrets.
7. Stop after about ____ steps, finished or not, and write the note. Commit only what is whole and passing; list the rest.

## Done

The guide's section 12, every point, or say exactly which is missing and why.

## The note (the guide's section 13), and a short report back

Report: what a child now does in the lesson, in three lines; the two wrong ideas as built; the kit (reused, changed, new); minutes for the child who is right and the child who is wrong; what passed; what is left or still running; the commit; the note's path.
