import { describe, expect, it } from 'vitest';
import { Reporter, browserName, problemPayload, trimStack } from './feedback';
import { browserSaysNo } from './privacy';

const where = { screen: 'hub', version: '2.0.0', browser: 'Chrome 141 on macOS', size: '1440x900' };
const stack = (n: number) => `TypeError: x is undefined\n    at boom (https://keypals.org/assets/index-abc.js:1:${n})\n    at go (https://keypals.org/assets/index-abc.js:2:3)`;

describe('problems the game reports by itself', () => {
  it('sends exactly these keys, and nothing about the players', () => {
    const body = problemPayload('TypeError: x is undefined', stack(10), where);
    expect(Object.keys(body).sort()).toEqual(['auto', 'browser', 'message', 'screen', 'size', 'stack', 'version']);
  });

  it('trims the stack to file names: an address (which could hold save codes after a #) never goes', () => {
    const s = trimStack('Error: x\n    at a (https://keypals.org/assets/index-abc.js?v=1#move=TIGER-MOON-RAIN-42:10:5)\n    at b (blob:https://keypals.org/1234-5678:1:2)');
    expect(s).not.toMatch(/keypals\.org|TIGER|https?:/);
    expect(s).toContain('index-abc.js:10:5');
    expect(trimStack('x\n'.repeat(50)).split('\n').length).toBe(12);
  });

  it('each error once per session, at most three a session, and not in a burst', () => {
    const sent: unknown[] = [];
    const r = new Reporter(b => sent.push(b), 3, 5000);
    expect(r.report('TypeError: x is undefined', stack(10), where, 0)).toBe(true);
    expect(r.report('TypeError: x is undefined', stack(10), where, 9000)).toBe(false); // the same again
    expect(r.report('TypeError: y', stack(20), where, 1000)).toBe(false); // too soon after the last one sent
    expect(r.report('TypeError: y', stack(20), where, 6000)).toBe(true);
    expect(r.report('TypeError: z', stack(30), where, 12000)).toBe(true);
    expect(r.report('TypeError: w', stack(40), where, 30000)).toBe(false); // three is the most
    expect(sent.length).toBe(3);
  });

  it('ignores errors that are not the game\'s', () => {
    const r = new Reporter(() => { throw new Error('should not send'); });
    expect(r.report('Script error.', '', where)).toBe(false);
    expect(r.report('ResizeObserver loop completed with undelivered notifications.', '', where)).toBe(false);
    expect(r.report('boom', 'at x (chrome-extension://abc/content.js:1:1)', where)).toBe(false);
  });

  it('names the browser in a few words, not the whole browser string', () => {
    expect(browserName('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36')).toBe('Chrome 141 on macOS');
    expect(browserName('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')).toBe('Safari 18 on iPhone');
    expect(browserName('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0')).toBe('Edge 141 on Windows');
  });

  it('Do Not Track and Global Privacy Control both count as "no"', () => {
    expect(browserSaysNo({ doNotTrack: '1' })).toBe(true);
    expect(browserSaysNo({ globalPrivacyControl: true })).toBe(true);
    expect(browserSaysNo({ doNotTrack: null })).toBe(false);
  });
});
