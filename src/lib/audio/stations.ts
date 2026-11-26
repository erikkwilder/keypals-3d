// Music stations: pick the kind of music you like, and it plays everywhere, through lessons, trips and
// battles, until you pick another. "Keypals Originals" is the music the game makes as you play (the
// island tunes, in a style you choose), and Auto plays it everywhere. A station of recordings plays them
// one after another (sound.ts), and a place can play its own station on Auto (sound.ts setPlaceStation).
//
// There are no stations of recordings for now. Until 26 Nov 2026 there were twelve, playing 140 tracks
// licensed from Envato Elements; they were taken out that day, because that licence holds only for a product
// finished while the subscription lasts, and Keypals is still being built (and each track could be downloaded
// from the site as a plain file). Recordings made for Keypals may come back as stations once their licence is
// clear; they would live in a private folder (~/Documents/keypals-private/music-made; public/music is a
// git-ignored link to it for the dev server), never in this public repository.

export type StationId = 'originals';
/** a recording: its file in music/, its name, who made it, and (for a loop) how many times it plays over
 *  before the station crossfades to the next one */
export type Track = { file: string; title: string; artist: string; loops?: number };
export type Station = { id: StationId; name: string; blurb: string; tracks: Track[] };

export const STATIONS: Station[] = [
  { id: 'originals', name: 'Keypals Originals', blurb: 'The island tunes, made as you play', tracks: [] },
];
export const STATION: Record<StationId, Station> = Object.fromEntries(STATIONS.map(s => [s.id, s])) as Record<StationId, Station>;

/** What's going on, for Auto: practising, the menus, or Adventure. */
export type MusicPlace = 'focus' | 'menu' | 'adventure';
/** What Auto plays in each place (a world or a game can play its own instead: sound.ts setPlaceStation). */
export const AUTO: Record<MusicPlace, StationId> = { focus: 'originals', menu: 'originals', adventure: 'originals' };
/** A station's choice: 'auto' or a station. */
export type StationChoice = StationId | 'auto';
/** A saved choice as it can be played now: a station that is gone (a player's save from before 26 Nov 2026
 *  can hold 'rock', 'calm' and the rest) is Auto. */
export function knownChoice(c: unknown): StationChoice {
  return typeof c === 'string' && (c === 'auto' || Object.prototype.hasOwnProperty.call(STATION, c)) ? (c as StationChoice) : 'auto';
}
