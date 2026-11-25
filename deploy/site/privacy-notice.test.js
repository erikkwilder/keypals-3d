// The privacy notice (public/privacy.html) says what Keypals keeps and for how long. These hold the notice to
// the server's own rules, so a change to one without the other fails here: one contact address; the weekly
// records for the boards and the world board's scores deleted after the days the notice states; and the
// backup listing what the weekly backup copies.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CLASS_TABLES } from './classes.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const notice = read('../../public/privacy.html');
const classes = read('./classes.js');
const text = notice.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
/** the days in the daily tidy-up's `DELETE FROM <table> WHERE <col> < ?` … `now - N * DAY` */
const tidyDays = (table) => Number(classes.match(new RegExp(`DELETE FROM ${table} WHERE \\w+ < \\?'\\)\\.bind\\(day\\(now - (\\d+) \\* DAY\\)\\)`))?.[1]);

describe('the privacy notice says what the server does', () => {
  it('gives one contact address, everywhere', () => {
    const mails = [...notice.matchAll(/mailto:([^"]+)"/g)].map((m) => m[1]);
    expect(mails.length).toBeGreaterThan(1);
    expect(new Set(mails)).toEqual(new Set(['hello@keypals.org']));
    expect(text).not.toContain('fancyant.com/privacy');
  });
  it("deletes a week's record for the boards after the days it says", () => {
    const days = tidyDays('player_week');
    expect(days).toBe(400);
    expect(text).toContain(`Each week's record is deleted after ${days} days, or when the player is deleted.`);
    expect(text).toContain(`A week's record for the boards is deleted after ${days} days`);
  });
  it("deletes a world board score after the days it says", () => {
    const days = tidyDays('world_scores');
    expect(days).toBe(30);
    expect(text).toContain(`Scores are deleted after ${days} days.`);
    expect(text).toContain(`a world board score after ${days} days`);
  });
  it('lists what the weekly backup copies', () => {
    const backups = text.match(/Backups\. ([^.]*)\./)?.[1] ?? '';
    expect(CLASS_TABLES).toHaveProperty('player_week');
    expect(backups).toContain('weekly records');
    expect(CLASS_TABLES).toHaveProperty('account_domains');
    expect(backups).toContain("school's web address");
  });
});
