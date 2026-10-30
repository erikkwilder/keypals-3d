// A feedback line in an area game ("371 is three hundreds, seven tens, one one!") is about the question it
// was said for. When the next question shows, the line goes, so it never sits under a question it has
// nothing to do with. A line said just before the new question stays up a moment longer (so it can be
// read), then goes. A line said for the new question itself (a tip) replaces it and stays.
type Line = { key: number } | null;

/** how long any line stays up, at least, before a new question clears it */
export const LINE_MIN_MS = 1200;

/** Call as a new question shows: clears the line now, or once it has been up LINE_MIN_MS. `key` is
 *  the Date.now() the line was said at (every game's `say` stamps it). */
export function clearOldLine(get: () => Line, clear: () => void, minMs = LINE_MIN_MS) {
  const m = get();
  if (!m) return;
  const wait = m.key + minMs - Date.now();
  if (wait <= 0) { clear(); return; }
  // the same line still up (a newer one replaces the object)
  setTimeout(() => { if (get() === m) clear(); }, wait);
}
