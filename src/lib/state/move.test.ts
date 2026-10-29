import { describe, expect, it } from 'vitest';
import { movedCodes, moveUrl, onOldAddress } from './move';

describe('moving players to keypals.org', () => {
  it('opens keypals.org with the save codes after the #', () => {
    expect(moveUrl(['TIGER-MOON-RAIN-42', 'otter-lake-kite-17'])).toBe('https://keypals.org/#move=TIGER-MOON-RAIN-42,OTTER-LAKE-KITE-17');
  });
  it('keypals.org reads them back, ignoring anything that is not a save code', () => {
    expect(movedCodes('#move=TIGER-MOON-RAIN-42,OTTER-LAKE-KITE-17')).toEqual(['TIGER-MOON-RAIN-42', 'OTTER-LAKE-KITE-17']);
    expect(movedCodes('#move=TIGER-MOON-RAIN-42,<script>,TIGER-MOON-RAIN-42')).toEqual(['TIGER-MOON-RAIN-42']);
    expect(movedCodes('#signin=ok')).toEqual([]);
    expect(movedCodes('')).toEqual([]);
  });
  it('is offered only on the old address', () => {
    expect(onOldAddress('/keypals/')).toBe(true);
    expect(onOldAddress('/keypals')).toBe(true);
    expect(onOldAddress('/')).toBe(false);
    expect(onOldAddress('/keypals1/')).toBe(false);
  });
});
