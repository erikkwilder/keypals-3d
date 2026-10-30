// Moving players from fancyant.com/keypals to keypals.org. A child's progress lives in each address's own
// browser storage, so the same browser sees no players at the new address. On fancyant.com/keypals a
// grown-up taps "Move my players to keypals.org" (Grown-ups screen): every player gets a save code if it
// hasn't one, and keypals.org opens with the codes after a # in the address (the part after # is never
// sent to any server). keypals.org adds them (combining with a copy that's already there) and clears the
// address straight away. Both copies keep saving to the same saved player, so nothing is lost either way.

/** the new home of the game */
export const ORG_URL = 'https://keypals.org/';

/** On the old address (fancyant.com/keypals, or a local copy of it): offer the move. */
export const onOldAddress = (path: string) => /^\/keypals(\/|$)/.test(path);

const CODE = /^[A-Z]+-[A-Z]+-[A-Z]+-\d{2}$/;

/** keypals.org with these save codes for it to add. */
export function moveUrl(codes: string[], target = ORG_URL): string {
  const ok = codes.map(c => c.toUpperCase()).filter(c => CODE.test(c));
  return `${target}#move=${ok.join(',')}`;
}

/** The save codes in an address's #move=..., or none. */
export function movedCodes(hash: string): string[] {
  const m = hash.match(/(?:^#?|[#&])move=([A-Z0-9,-]*)/i);
  if (!m) return [];
  return [...new Set(m[1].split(',').map(c => c.toUpperCase()).filter(c => CODE.test(c)))].slice(0, 20);
}
