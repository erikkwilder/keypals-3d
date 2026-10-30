// The QR maker against a reference encoder (python-qrcode, level M, bytes): the same modules, version by
// version and mask by mask. (qr.fixture.json was made with it; see the comment in qr.ts.)
import { describe, expect, it } from 'vitest';
import { qrMatrix, qrPath, qrVersionFor } from './qr';
import ref from './qr.fixture.json';

const rows = (m: boolean[][]) => m.map(r => r.map(c => (c ? '1' : '0')).join(''));

describe('QR codes', () => {
  for (const c of ref as { text: string; version: number; mask: number | null; rows: string[] }[]) {
    it(`matches the reference: version ${c.version}, ${c.mask === null ? 'its own mask' : `mask ${c.mask}`}`, () => {
      if (c.mask !== null) expect(rows(qrMatrix(c.text, { version: c.version, mask: c.mask }))).toEqual(c.rows);
      else {
        // the reference picked its own mask: one of ours must be exactly it
        const ours = Array.from({ length: 8 }, (_, m) => rows(qrMatrix(c.text, { version: c.version, mask: m })).join('\n'));
        expect(ours).toContain(c.rows.join('\n'));
        expect(qrVersionFor(new TextEncoder().encode(c.text).length)).toBe(c.version);
      }
    });
  }
  it('a class link fits a small code, and draws as a path', () => {
    const m = qrMatrix('https://keypals.org/#class=WHALE-MOTH-17');
    expect(m.length).toBe(29);
    expect(qrPath(m)).toMatch(/^M4 4h1v1h-1z/);
  });
  it('too long is an error, not a broken code', () => {
    expect(() => qrMatrix('q'.repeat(400))).toThrow();
  });
});
