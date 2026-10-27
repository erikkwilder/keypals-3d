// Speed, accuracy, rhythm and stars for a finished run.

import type { Lesson } from './course';
import type { Session } from './session';

export type KeyRun = { hits: number; misses: number; ms: number; timed: number };

export type RunStats = {
  chars: number; // characters completed
  words: number;
  wpm: number;
  /** time saved by clean typing: each correct key in a streak earns back part of its time */
  bonusMs: number;
  /** speed with the clean-typing bonus: what the player sees as the score (speed + accuracy bonus) */
  score: number;
  acc: number; // 0..1
  errors: number;
  durationMs: number;
  maxStreak: number;
  finalStreak: number;
  rhythmCV: number; // lower is steadier
  steady: boolean;
  perKey: Record<string, KeyRun>;
  semis: number;
  spaces: number;
};

/**
 * The clean-typing time bonus, modelled on Animal Typing (measured in its kids lessons, October 2026):
 * once a clean streak passes ten keys, every correct key earns back part of its time, quickly rising
 * to 30%. A slip resets the streak, so short streaks between slips earn nothing, as there. Clean
 * typing ends up scoring about 1.25 to 1.4 times the raw speed. Grown-ups get less back.
 */
export const BONUS = { kids: { after: 10, ramp: 0.05, cap: 0.3 }, grown: { after: 12, ramp: 0.03, cap: 0.2 } };
export const bonusFraction = (streak: number, grown = false) => {
  const b = grown ? BONUS.grown : BONUS.kids;
  return streak < b.after ? 0 : Math.min(b.cap, b.ramp * (streak - b.after + 1));
};

export function computeStats(s: Session, opts: { grown?: boolean } = {}): RunStats {
  const chars = s.pos;
  const durationMs = Math.max(1000, (s.endT ?? s.strokes.at(-1)?.t ?? 0) - (s.startT ?? 0));
  // the first key starts the clock, so it is not counted against the time
  const wpm = chars > 1 ? ((chars - 1) / 5) / (durationMs / 60000) : 0;
  const acc = chars + s.errors > 0 ? chars / (chars + s.errors) : 1;

  const perKey: Record<string, KeyRun> = {};
  const intervals: number[] = [];
  let prevT: number | null = null;
  let prevOkT: number | null = null;
  let streak = 0, bonusMs = 0;
  for (const st of s.strokes) {
    const k = (perKey[st.expected] ??= { hits: 0, misses: 0, ms: 0, timed: 0 });
    if (st.ok) {
      if (prevT !== null) bonusMs += Math.min(2500, st.t - prevT) * bonusFraction(streak, opts.grown);
      streak++;
      k.hits++;
      if (prevT !== null) {
        const dt = st.t - prevT;
        if (dt < 3000) { k.ms += dt; k.timed++; }
      }
      if (prevOkT !== null) {
        const dt = st.t - prevOkT;
        if (dt > 0 && dt < 2500) intervals.push(dt);
      }
      prevOkT = st.t;
    } else {
      k.misses++;
      streak = 0;
    }
    prevT = st.t;
  }
  let rhythmCV = 1;
  if (intervals.length >= 8) {
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const sd = Math.sqrt(intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / intervals.length);
    rhythmCV = mean > 0 ? sd / mean : 1;
  }
  const typed = s.text.slice(0, chars);
  bonusMs = Math.min(bonusMs, durationMs * 0.6);
  const score = chars > 1 ? Math.round(((chars - 1) / 5) / ((durationMs - bonusMs) / 60000)) : 0;
  return {
    chars,
    words: typed.split(' ').filter(Boolean).length,
    wpm: Math.round(wpm * 10) / 10,
    bonusMs: Math.round(bonusMs),
    score,
    acc,
    errors: s.errors,
    durationMs,
    maxStreak: s.maxStreak,
    finalStreak: s.streak,
    rhythmCV,
    steady: intervals.length >= 15 && rhythmCV < 0.5,
    perKey,
    semis: [...typed].filter(c => c === ';').length,
    spaces: [...typed].filter(c => c === ' ').length,
  };
}

/**
 * The score that earns three stars on a lesson. Animal Typing's first kids lessons ask for 25 and 28;
 * ours climb from there with the lesson's difficulty. Grown-ups aim higher; easy mode asks for two
 * thirds, as Animal Typing's does.
 */
export function lessonGoal(lesson: Lesson, grown: boolean, easy = false): number {
  const base = 16 + lesson.speed * 1.4;
  return Math.round(base * (grown ? 1.6 : 1) * (easy && !grown ? 2 / 3 : 1));
}

/** The graduation test's targets: words a minute and accuracy (easy mode asks two thirds of the speed). */
export const FINAL_TARGET = { kids: { wpm: 15, acc: 0.93 }, grown: { wpm: 30, acc: 0.95 } };
export function finalTarget(grown: boolean, easy = false) {
  const t = grown ? FINAL_TARGET.grown : FINAL_TARGET.kids;
  return { wpm: Math.round(t.wpm * (easy && !grown ? 2 / 3 : 1)), acc: t.acc - (easy && !grown ? 0.03 : 0) };
}

/**
 * Stars are a share of the goal score: 30% one star, 60% two, the goal itself three. A lesson is only
 * passed with enough keys right (its `pass` share), so speed alone can't carry sloppy typing through.
 * The graduation test passes at its target speed and accuracy; a third and two thirds faster add stars.
 */
export function starsFor(stats: RunStats, lesson: Lesson, grown: boolean, finished: boolean, easy = false): 0 | 1 | 2 | 3 {
  if (lesson.kind === 'final') {
    const t = finalTarget(grown, easy);
    if (stats.chars < 20 || stats.acc < t.acc) return 0;
    return stats.wpm >= t.wpm * 1.66 ? 3 : stats.wpm >= t.wpm * 1.33 ? 2 : stats.wpm >= t.wpm ? 1 : 0;
  }
  if (!finished && lesson.kind !== 'sprint') return 0;
  if (stats.chars < 5) return 0;
  if (stats.acc < lesson.pass - (easy ? 0.05 : 0)) return 0;
  const r = stats.score / lessonGoal(lesson, grown, easy);
  const stars = r >= 1 ? 3 : r >= 0.6 ? 2 : r >= 0.3 ? 1 : 0;
  // precision over speed: very sloppy typing (under 85% correct) can't earn the third star
  return stars === 3 && stats.acc < 0.85 ? 2 : stars;
}

export const starScores = (goal: number) => [Math.ceil(goal * 0.3), Math.ceil(goal * 0.6), goal];

/** A rare extra above three stars, like Animal Typing's platinum medal (about three times the goal). */
export const platinumScore = (goal: number) => Math.round(goal * 2.9);

/** The words under the score, in the spirit of Animal Typing's end-of-lesson messages. */
export function endMessage(stars: number, opts: { record?: boolean; improved?: boolean; sloppy?: boolean; platinum?: boolean }): string {
  if (opts.platinum) return 'Platinum!';
  if (opts.record && stars === 3) return "It's a new record!";
  if (opts.sloppy) return 'Take your time, avoid typos…';
  if (stars === 3) return opts.improved ? "It's a new record!" : 'Excellent!';
  if (stars === 2) return opts.improved ? "Good job, you're almost there!" : 'Good, now go for 3 stars!';
  if (stars === 1) return opts.improved ? "Nice, you're getting faster!" : 'Keep going, you can do this!';
  return opts.improved ? "You're getting better!" : "Nice effort, you've got this!";
}

/**
 * The big title on the results card. It says what really happened: "Perfect run!" only for three
 * stars with no mistakes at all (it used to mean any three stars, which a run with slips can earn);
 * "No mistakes!" for a clean but slower run; otherwise the stars won.
 */
export function runTitle(r: { stars: number; errors: number; finished: boolean; passed: boolean; sprint: boolean; final?: boolean }): string {
  if (r.final) return r.passed ? 'You graduated!' : 'Not quite yet!';
  if (r.sprint) return r.errors === 0 ? 'Sprint done, no slips!' : 'Sprint done!';
  if (!r.passed) return r.finished ? 'So close!' : "Time's up!";
  if (r.errors === 0) return r.stars === 3 ? 'Perfect run!' : 'No mistakes!';
  return r.stars === 3 ? 'Three stars!' : r.stars === 2 ? 'Great job!' : 'Lesson passed!';
}

/** What to say about the race against the ghost. */
export function ghostWords(g: { beat: boolean; by: number; finished: boolean }) {
  const secs = Math.round(g.by), n = `${secs} ${secs === 1 ? 'second' : 'seconds'}`;
  if (!g.finished) return g.beat ? 'You got further than your ghost!' : 'Your ghost got further this time.';
  if (g.beat) return g.by < 0.5 ? 'You beat your ghost by a whisker!' : `You beat your ghost by ${n}!`;
  return g.by < 0.5 ? 'So close! Your ghost won by a whisker.' : `Your ghost won by ${n}. Catch it next time!`;
}
