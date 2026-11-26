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
  it('says what a class against class challenge shows the other classes', () => {
    // challengeView: each class's name, how many students and the average; never a student, or another class's id
    expect(classes).toMatch(/\.map\(x => \(\{ id: x\.id, name: x\.name, students: x\.n, avg: /);
    expect(text).toContain("the other classes in it see that class's name, how many students it has and its average of right answers, never a student's name.");
  });
  it('says what anyone with a class code sees', () => {
    expect(classes).toContain("return h.json({ class: { name: c.name, grade: c.grade, teacher: c.display ?? 'Your teacher', google }, students: (st.results ?? []).map(s => ({ id: s.id, name: s.name, buddy: s.buddy })) });");
    expect(text).toContain("Anyone who has a class code can see that class's name and grade, its teacher's name and its students' first names and buddies");
  });
  it("says a teacher sees each student's saved progress and whether they have logged in", () => {
    expect(classes).toMatch(/"loggedIn":\$\{[^}]*\},"profile":\$\{x\.data\}/);
    expect(text).toContain("A teacher sees each student's progress in the game and their class work, and whether they have logged in yet.");
  });
  it('says what linking a player from home shows the teacher', () => {
    // the home player's nickname waits with the claim; the teacher's page is sent the saved players of the class's
    // own students only (a waiting request's player comes with her yes), and after her yes the classmate plays as
    // the family's player
    expect(classes).toContain("WHERE s.class = ? AND s.status = 'pending' AND s.claims IS NOT NULL");
    expect(classes).toContain(`FROM students s JOIN players p ON p.code = s.player WHERE s.class = ? AND s.status = 'active'").bind(c.id)`);
    expect(classes).toContain('UPDATE students SET player = ?, home = 1');
    expect(text).toContain("A family can ask to link a player from home to a class. While the request waits, that class's teacher sees only the player's nickname. After the teacher's yes, the teacher can see the player's progress, and its progress from home and school is kept together.");
  });
  it("deletes a request nobody answered after the days it says", () => {
    const days = Number(classes.match(/DELETE FROM students WHERE status = 'pending' AND created < \?"\)\.bind\(now - (\d+) \* DAY\)/)?.[1]);
    expect(days).toBe(60);
    expect(text).toContain(`is deleted after ${days} days if the teacher hasn't answered.`);
  });
  it('says what is kept of a student who signs in with Google, and that a child at home gives none of it', () => {
    // a ticket with the hashed id, the first name and the school domain, for ten minutes; no email, no full name
    expect(classes).toContain('INSERT INTO google_tickets (hash, gid, name, hd, expires) VALUES (?, ?, ?, ?, ?)');
    expect(classes).toMatch(/googleKey = \(h, sub\) => h\.sha256\(/);
    expect(classes).not.toMatch(/me\.email/);
    expect(text).toContain("we keep only the student's first name and a scrambled form of the account's ID, never the email address or the full name.");
    expect(text).toContain('A child playing at home, or logging in to a class with a class code and two pictures, never gives us an email, full name, birthday, photo, voice or location.');
  });
});
