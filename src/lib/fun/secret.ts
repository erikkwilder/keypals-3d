// The secret word ("keypals", typed on a map): the first time, it puts the Secret Word sticker in the
// player's sticker book (FunLayer shows a card saying so); after that it's just a party.
import { bookOf, type Profile } from '../engine/profile';

export const SECRET_STICKER = 'secret-word';

/** Put the Secret Word sticker in the book (call inside game.update). False if it's already there. */
export function giveSecretSticker(p: Profile, at = Date.now()): boolean {
  const book = bookOf(p);
  if (book.stickers[SECRET_STICKER]) return false;
  book.stickers[SECRET_STICKER] = { at, by: p.buddy };
  if (!book.fresh.includes(SECRET_STICKER)) book.fresh.push(SECRET_STICKER);
  return true;
}
