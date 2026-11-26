// The rules a test can hold a lesson to. The whole list, and why each rule exists, is in docs/lesson-rules.md.
// A lesson's test plays its script with a pretend child and passes the record here. A script that breaks a
// rule fails with the rule's number, so the same mistakes can't come back in the next lesson.
import type { Line } from '../../content/voice';

/** What happened in a run, in order: a spoken line, something acted out, an answer shown, a wait for the child;
 *  and 'show': a picture that goes with a line, acted out while it is said (Teller.sayWith). A line said with its
 *  pictures is a 'say' with `shown`. */
export type Step = { k: 'say' | 'act' | 'answer' | 'go' | 'ask' | 'show'; v: string; shown?: boolean };
export type Script = {
  steps: Step[];
  /** the lines that say what's about to be tried, and whose try it is */
  announces: RegExp;
};

export function scriptProblems({ steps: all, announces }: Script): string[] {
  const bad: string[] = [];
  // (a picture that goes with a line is part of saying it: it isn't something tried, so rules 6 to 11 pass over it)
  const steps = all.filter(s => s.k !== 'show');
  steps.forEach((s, i) => {
    if (s.k === 'act') {
      // rules 6 and 7: said first, and whose it is
      const before = steps[i - 1];
      if (before?.k !== 'say' || !announces.test(before.v)) bad.push(`rule 6: ${s.v} is acted out without saying what it is and whose (after ${before?.v ?? 'nothing'})`);
      // rule 8: then what it showed, before anything else is tried or asked
      const next = steps.slice(i + 1).find(x => x.k !== 'answer');
      if (next?.k !== 'say') bad.push(`rule 8: ${s.v} is acted out and nothing says what it showed (next: ${next?.v ?? 'the end'})`);
    }
    if (s.k === 'answer') {
      // rules 10 and 11: the working is said, and it stays until the child moves on
      const after = steps.slice(i + 1), go = after.findIndex(x => x.k === 'go'), other = after.findIndex(x => x.k === 'act' || x.k === 'ask');
      if (!after.some((x, j) => x.k === 'say' && (go < 0 || j < go))) bad.push(`rule 10: the answer ${s.v} is shown with nothing said about it`);
      if (go < 0 || (other >= 0 && other < go)) bad.push(`rule 11: the answer ${s.v} doesn't wait for the child`);
    }
  });
  return bad;
}

const CLOSERS = [/explaining is the best way to learn/i, /you won the/i, /^thank you/i];

/** Rules that can be read off the words alone, for every line of every beat lesson. */
export function lineProblems(lines: Line[]): string[] {
  const bad: string[] = [];
  for (const l of lines) {
    const words = l.text.split(/\s+/).length;
    // rule 4: a line this short is a slogan: it can't carry a reason
    if (words < 6) bad.push(`rule 4: "${l.text}" is too short to explain anything (${l.id})`);
    if (words > 40) bad.push(`rule 4: "${l.text.slice(0, 40)}..." is a paragraph (${l.id})`);
    // rule 18: no shared closing lines
    if (CLOSERS.some(c => c.test(l.text))) bad.push(`rule 18: "${l.text}" is a stock closing line (${l.id})`);
    // the words on screen and the words said are the same line
    if (l.said && /\{[nmk]\}/.test(l.said)) bad.push(`rule 7: the voice can't say {n}, {m} or {k} (${l.id})`);
  }
  return bad;
}

/** Rule 37: during any longer narration, something on screen shows what is being said. Erik, 2026-11-25: "We want
 *  the talking, but you're just kind of sitting there." A run of lines with nothing happening on screen (no picture
 *  with a line, nothing acted out, no question, no button) of `limit` words or more is a problem. `words`: how many
 *  words a line has, by its id. A line said with its pictures (Teller.sayWith) is never part of a still run. */
export function stillStretches(steps: Step[], words: (id: string) => number, limit = 35): string[] {
  const bad: string[] = [];
  let run: string[] = [], n = 0;
  const end = () => { if (n >= limit) bad.push(`rule 37: ${n} words with nothing new on screen (${run.join(', ')})`); run = []; n = 0; };
  for (const s of steps) {
    if (s.k === 'show') continue;
    if (s.k === 'say' && !s.shown) { run.push(s.v); n += words(s.v); } else end();
  }
  end();
  return bad;
}
