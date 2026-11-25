// What a browser keeps of a pupil's sign-in with Google (googleTrip.ts), with a stand-in for its storage:
// the class code while she's at Google, and that she's waiting for her teacher's yes.
import { describe, expect, it } from 'vitest';
import { backToWaiting, codeBackFromGoogle, forgetWaiting, keepCodeForGoogle, noteWaiting, showingWaiting, waitingHere, waitingIn, type Store } from './googleTrip';

function store(): Store & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => { data.set(k, String(v)); }, removeItem: k => { data.delete(k); } };
}
const no = () => { throw new Error('blocked'); };
const broken: Store = { getItem: no, setItem: no, removeItem: no };

describe("waiting for the teacher's yes, on this computer", () => {
  it('keeps the class code and the first name only, by class, once each', () => {
    const l = store();
    noteWaiting('snow dot 95', 'Zoe', l);
    noteWaiting('SNOW-DOT-95', 'Zoe ', l); // the same pupil again
    noteWaiting('fox pear 42', 'Ava', l);
    expect(waitingIn('snow dot 95', l)).toEqual([{ code: 'SNOW-DOT-95', name: 'Zoe' }]);
    expect(JSON.parse(l.data.get('kp-class-waiting')!)).toEqual([{ code: 'SNOW-DOT-95', name: 'Zoe' }, { code: 'FOX-PEAR-42', name: 'Ava' }]);
    noteWaiting('', 'Zoe', l); noteWaiting('fox pear 42', ' ', l); // nothing to keep
    expect(waitingHere(l).length).toBe(2);
  });
  it('forgets her when she gets in or the server says she is not waiting: by name, in that class or in any', () => {
    const l = store();
    noteWaiting('snow dot 95', 'Zoe', l); noteWaiting('fox pear 42', 'Zoe', l); noteWaiting('snow dot 95', 'Ava', l);
    forgetWaiting(['zoe'], 'fox pear 42', l);
    expect(waitingHere(l)).toEqual([{ code: 'SNOW-DOT-95', name: 'Zoe' }, { code: 'SNOW-DOT-95', name: 'Ava' }]);
    forgetWaiting([null, 'ZOE'], null, l);
    expect(waitingHere(l)).toEqual([{ code: 'SNOW-DOT-95', name: 'Ava' }]);
    forgetWaiting([null, undefined, ''], null, l); // no name: nothing forgotten
    expect(waitingHere(l).length).toBe(1);
    forgetWaiting(['Ava'], null, l);
    expect(l.data.has('kp-class-waiting')).toBe(false);
  });
  it('a reload goes back to the class only while someone there is still waiting', () => {
    const s = store(), l = store();
    expect(backToWaiting(s, l)).toBeNull();
    noteWaiting('snow dot 95', 'Zoe', l); showingWaiting('snow dot 95', s);
    expect(backToWaiting(s, l)).toBe('SNOW-DOT-95');
    forgetWaiting(['Zoe'], null, l);
    expect(backToWaiting(s, l)).toBeNull();
    noteWaiting('snow dot 95', 'Zoe', l); showingWaiting(null, s); // she left the class login
    expect(backToWaiting(s, l)).toBeNull();
  });
  it('a browser that keeps nothing (a private window) is no trouble', () => {
    expect(() => { noteWaiting('snow dot 95', 'Zoe', broken); forgetWaiting(['Zoe'], null, broken); showingWaiting('snow dot 95', broken); }).not.toThrow();
    expect([waitingHere(broken), backToWaiting(broken, broken)]).toEqual([[], null]);
  });
});

describe("the class code, while she's at Google", () => {
  const t0 = 1_800_000_000_000;
  it('is kept in this tab for the trip and given back once', () => {
    const s = store();
    keepCodeForGoogle('snow dot 95', s, t0);
    expect(codeBackFromGoogle(s, t0 + 60000)).toBe('SNOW-DOT-95');
    expect(codeBackFromGoogle(s, t0 + 61000)).toBeNull();
    expect([...s.data.keys()]).toEqual([]);
  });
  it('not once a sign-in could have run out, and nothing when the box was empty', () => {
    const s = store();
    keepCodeForGoogle('snow dot 95', s, t0);
    expect(codeBackFromGoogle(s, t0 + 15 * 60000)).toBeNull();
    keepCodeForGoogle('snow dot 95', s, t0); keepCodeForGoogle('  ', s, t0); // the box emptied: the old code goes too
    expect(codeBackFromGoogle(s, t0 + 1000)).toBeNull();
  });
  it('a browser that keeps nothing (a private window) is no trouble', () => {
    expect(() => keepCodeForGoogle('snow dot 95', broken, t0)).not.toThrow();
    expect(codeBackFromGoogle(broken, t0)).toBeNull();
  });
});
