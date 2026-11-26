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

## F. Found in review, 23 November 2026

These came from playing the next three lessons (How Many Cookies?, Fair Shares, Mystery Bags) through as a child, not from a correction. Each is one of the rules above seen from a new side.

25. The picture must be able to answer the question (rule 13). Nothing the child is asked about may be hidden behind something else, and anything named by its colour or its place must really have it. The buddy's bar lay behind the child's standing pieces while the child was asked about its pieces.
26. A reason belongs to every child, most of all the one who was wrong (rule 2). Check each wrong path for a reason that only the right path says.
27. What a result showed is said with the child's own numbers (rule 8): "the smallest piece has 1 and the biggest has 4", not "the shortest has fewer than the longest". A line can carry two numbers, `{n}` and `{m}`.
28. Watching someone else go wrong is still watching (rule 16). When a friend makes a mistake, the child finds it: a tap that can be wrong.
29. If the only true reason for the set-up is that it's a puzzle, call it a puzzle (rule 3). A story that says a balance is "the only way" makes a child ask why nobody weighs one bag.
30. A line over 40 words is split into two lines, never shaved to fit (rule 4). One ceiling, in one place; shaving words to fit a cap is how explanations turn into slogans.
31. A young child hears the count: the count word is said as each thing is touched, by the narrator's count and by the child's own taps.
32. Every label can be read at every size (the note under rule 20): none runs off a phone's screen, no choice's words are cut by its button, and a label whose thing is off the page is hidden, not pulled back to the edge.
33. Room is kept for the number keys only in a lesson that asks for numbers. Otherwise half a phone's screen is bare table.
34. The story never runs ahead of the picture. A lesson's kit waits on the scene's clock (`src/lib/three/sceneWaits.ts`), never with setTimeout: under 20 frames a second the scene's clock falls behind the wall's, and a wait by the wall ends before the movement it waited for. A test holds every kit to this.
35. On a phone the number keys are two rows, and a long question wraps inside its box. A lesson that never asks for a number says so (`keys: false`), and a lesson with a short, wide picture centres it (`tallShare`).
36. **A cold read by a reader who did not write the script is not optional, and it reads both children.** On 23 November 2026 one found a maths error that two rounds of tests, an earlier cold read and a play-through had all missed: the buddy's 2-square piece of an 8-square bar really was one fourth while the narrator said it wasn't. Print both paths, the child who is right every time and the child who is wrong every time, with real numbers filled in.

## G. Erik on the three live lessons, 25 November 2026

37. **During any longer narration, something on screen shows what is being said.** Erik: "We want the talking, but you're just kind of sitting there... Something that shows or visualizes what it's speaking to." Keep the words (rule 19); add the picture of what they say. A long line over a still scene is a line to illustrate, not to shorten. `stillStretches` in `src/lib/math/beats/rules.ts` finds every run of lines of 35 words or more with nothing happening on screen.
38. **An object that is going to be cut starts whole.** Erik: "it should look more like one chocolate bar with lines on it, not separate pieces from the start... If we're cutting the bar up, it should actually look like one piece that we're cutting." One bar with the cut lines drawn on it; the pieces come apart only when the cut happens (what's shown must really happen).
39. **Pause stops the narrator at once, and Keep going carries on from the same point, mid-sentence.** Erik: "If I pause the lesson, I want it to actually pause right then. And then when I say keep going, to have it start talking again where it left off." It holds for every lesson, because it lives in the shared lesson player.
40. **Word cards settle and never shake** (the note under rule 20, from another side). Erik: "some of the word bubbles that are up towards the top get kind of jittery." A card that moves out of another's way moves once and stays.

## H. Found building the pictures, 26 November 2026

41. **A picture that goes with a line never answers a question the child hasn't been asked yet (rule 13 from the pictures' side).** Mystery Bags says "half of one side weighs as much as half of the other" just before asking how many weights go with one bag: the picture lights half of each pan's rim and leaves the 8 weights unsorted, because 4 and 4 lit would be the answer.
42. **A count said inside a line lights each thing as its number is said, and a picture never touches a thing the way a count does without its number being heard (rule 31 from the pictures' side).** How Many Cookies? went through a wrong child's count with a light that ran along the cookies by itself and had finished before the narrator said "one"; now the light goes to each cookie on its own number, by the clip's clock. And "Watch. I touch one cookie and say one number" gets no ring on a cookie: that cookie would be touched again when the count starts, one cookie touched twice, which is the slip this lesson teaches children to catch.
43. **What the narrator says is happening happens while it is said: not before the line, and not after it (rules 6 and 37 from the clock's side).** Fair Shares said "The pieces go back together into one whole bar" over pieces that stood still, and they moved only when the line was over; and "1/4" stood on every piece before the narrator had got to "it is called one fourth, and we write it like this". A thing the words announce for later ("Let's see your cut") still comes after its line: that is rule 6.
44. **A reason is said whole once; when the same thing happens again it is said shorter, with the child's new numbers and the reason still in it (rules 2, 4 and 8 from the second hearing's side).** Fair Shares said the same 35 words after every unfair cut, up to four times for a child who kept missing. Never the bare verdict: the numbers and the reason stay.

## I. Erik on How Many Cookies? with its pictures, 26 November 2026

45. **Movement begins while the narrator is still saying the line about it, and the two finish together.** Erik: "Right now, it's like the talking of the narrator has to completely stop before the thing, say, plates coming out into the screen, happens. But then when the plates are moving, there's no talking. Maybe that's best practice, and when it is, great, keep it. But maybe there's room for the plates... to start moving out, maybe even slowly, while the narrator is finishing talking about them moving out, so that it just feels more graceful and integrated." Talking and showing are one thing: a move starts at the words that name it (slowly if need be) and ends with the line. A full stop between the words and the movement is kept only where it is the better teaching: the child must look at one thing, or a question is waiting for an answer. In How Many Cookies? the stops kept are the narrator's own count and each friend's count (the numbers landing are the thing to follow, and the count words are heard), zero plates (nothing comes), the moment a child's own number of plates stands to be seen before the narrator says what it showed, and the plates leaving before the table is bumped (so the bump is the only thing that moves a cookie while it is said). A kit's move takes a length in seconds for this, on the scene's clock (rule 34), and is never quicker than usual; a move put inside a line must leave the table whole even if every picture of the line comes at once, as it does when a clip can't play.
46. **Every recorded line is checked for blips inside it, not only at its edges.** Erik: "there's 2 lines that have like a blip in the narration when they say every cookie." A short dropout or click inside a clip is looked for in every clip, old and new, and a clip that has one is recorded again or repaired.
