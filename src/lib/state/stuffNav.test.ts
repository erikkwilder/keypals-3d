import { describe, expect, it } from 'vitest';
import { game } from './game.svelte';

// My stuff opens its places (stickers, the closet, Glimmers, the garden, the island...), and their Back
// returns to My stuff; My stuff's own Back still goes where My stuff was opened from.
describe('My stuff: drill in and back out', () => {
  it('a place opened from My stuff goes back to My stuff, and My stuff back to Home', () => {
    game.go('hub');
    game.go('mystuff');
    game.openStickers('stickers');
    expect(game.fromStuff).toBe(true);
    game.backFromStuff(() => game.go('hub'));
    expect(game.screen).toBe('mystuff');
    expect(game.stuffBack).toBe('hub');
    game.go('garden');
    expect(game.fromStuff).toBe(true);
    game.backFromStuff(() => game.go('hub'));
    expect(game.screen).toBe('mystuff');
  });
  it('nested places keep the way back (Glimmers, then the Glimmer Book)', () => {
    game.go('hub'); game.go('mystuff'); game.go('glimmers'); game.openBook();
    expect(game.fromStuff).toBe(true);
    game.go('glimmers');
    game.backFromStuff(() => game.go('adventure'));
    expect(game.screen).toBe('mystuff');
  });
  it('leaving for anywhere else forgets it', () => {
    game.go('hub'); game.go('mystuff'); game.openStickers('stickers');
    game.go('adventure');
    expect(game.fromStuff).toBe(false);
    game.go('eggs');
    game.backFromStuff(() => game.go('adventure'));
    expect(game.screen).toBe('adventure');
  });
});
