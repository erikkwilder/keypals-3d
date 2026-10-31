// Rule 20b of docs/lesson-rules.md: no two word cards on a Learn page overlap. A check for the running game:
// call it while a lesson plays and it lists the cards that cover each other right now, by their words.
const CARDS = ['.pin > *:not(.hand)', '.mybet', '.dock', '.bottom .ask', '.bottom .pill', '.bottom .choices'];

type Card = { text: string; r: DOMRect };
export function labelOverlaps(root: ParentNode = document): string[] {
  const cards: Card[] = [];
  for (const sel of CARDS) for (const el of root.querySelectorAll<HTMLElement>(sel)) {
    const r = el.getBoundingClientRect(), text = (el.textContent ?? '').trim();
    if (!text || r.width < 4 || r.height < 4 || getComputedStyle(el).visibility === 'hidden') continue;
    if (!cards.some(c => c.text === text && c.r.x === r.x && c.r.y === r.y)) cards.push({ text: text.slice(0, 40), r });
  }
  const out: string[] = [];
  for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) {
    const a = cards[i].r, b = cards[j].r;
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (w > 3 && h > 3) out.push(`"${cards[i].text}" over "${cards[j].text}" (${Math.round(w)}×${Math.round(h)})`);
  }
  return out;
}
