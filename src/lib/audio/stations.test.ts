import { describe, expect, it } from 'vitest';
import { AUTO, STATION, STATIONS } from './stations';

describe('music stations', () => {
  it('every station but the live-made one has recordings, and no song is on two stations', () => {
    const files = STATIONS.flatMap(s => s.tracks.map(t => t.file));
    expect(new Set(files).size).toBe(files.length);
    for (const s of STATIONS) {
      if (s.id === 'originals') expect(s.tracks).toHaveLength(0);
      else expect(s.tracks.length, s.id).toBeGreaterThanOrEqual(7);
      for (const t of s.tracks) { expect(t.file).toMatch(/^[a-z0-9-]+$/); expect(t.title.length).toBeGreaterThan(0); expect(t.artist.length).toBeGreaterThan(0); }
    }
  });
  it('Auto plays a real station in every place', () => {
    for (const id of Object.values(AUTO)) expect(STATION[id]).toBeTruthy();
    expect(AUTO.focus).toBe('calm');
    expect(AUTO.adventure).toBe('adventure');
  });
});
