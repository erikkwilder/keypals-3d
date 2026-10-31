# Lesson rules

Every Learn lesson follows these. `src/lib/math/beats/rules.ts` checks the ones a test can.

The root problem they guard against: a writer who already knows the idea writes the conclusion and leaves the thinking out. The child gets words with nothing to attach them to, which doesn't just fail to teach, it causes stress in a learner who is already nervous.

## A. Every line must make sense to a child who has seen only what came before it

1. No line leans on an idea the child hasn't been given. For each line ask what a child would need to already know. Each answer must already have been shown or said.
2. A claim comes with its reason.
3. Cut the clever line. If a line is there to sound interesting, or adds a stake the story never set up, use the real reason instead.
4. Plain and whole, not clipped and not long: one to three ordinary sentences. No word limits on a script: limits produce slogans.
5. A nervous child is the reader. When in doubt, say it more simply.

## B. Say what's happening around every action

6. Before something happens, say what it is.
7. Say whose idea it is, every turn: "Let's see your guess." "Now Prism's idea."
8. After something happens, say what it showed, tied to whose try it was. Never a bare "That wasn't enough."
9. Announce every change of gear, kindly, so the child doesn't feel they ran out of chances: "This one is tricky, so let's work it out together."
   A partly right answer gets credit for the right part, and the next hint starts from there.

## C. The right answer

10. The right answer is worked out step by step, each step with its reason, on the object. Tie each number in the sum to what it did.
11. It stays until the child moves on. Anything the child has to understand waits behind a button, never on a timer.
12. A right guess still gets the why.
   Every child gets one right on their own before the lesson ends, even after being helped, and gets the credit for it.

   Questions must be fair: never show an answer before asking for it, including a running count on screen, and a hint must ask for the same thing the answer box wants.
   Words mean one thing, in a child's sense: "sum" means adding to a child. Pick the plain word and keep it.

## D. The picture and the child's hands

13. Never ask about an empty scene. Give what the child needs to answer.
14. Show it in the space: numbers stand on the object, and colours tie the sum to the edges.
15. The child commits first. Their answer is acted out, right or wrong.
16. Hand steps must be able to go wrong, and must show the movement expected: a finger and an arrow from where to press to where to let go.
17. The formula comes last, from what the child's hands just did.
18. Each lesson ends in its own way. No shared closing lines, no praise for nothing.
19. Words and picture work together. Don't remove words to look clever, and don't let words replace showing.
20. Nothing passes through anything, and the camera holds still when a question opens.

   One voice: the narrator. The buddy and the Glimmer don't speak; they act and use thought bubbles.
   No two word cards overlap, at any size. `src/dev/labelOverlap.ts` measures this while a lesson plays.
   What's shown must really happen: if a character eats something, it goes into its mouth.

## E. Before anyone sees a lesson

21. Cold read: someone with no context reads the script in playing order and flags every line that needs knowledge not yet given. `COLD_READ=/path/out.txt npx vitest run src/lib/math/beats` prints it.
22. Run the checks in `rules.ts`.
23. Play every wrong path, with a child who is wrong all the way through.
24. Check it from a direct link with a real tap, with sound, and on an old browser.
