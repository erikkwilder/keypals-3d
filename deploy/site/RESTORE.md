# Putting saves back from a backup

Once a week the Worker's daily tidy-up (`worker.js`, `backup()`) copies every saved player and grown-up
account to the R2 bucket `keypals-backups`:

- `backups/<date>/players-0000.json.gz`, `accounts-0000.json.gz`, … (50 rows a file, gzipped JSON)
- `backups/<date>/manifest.json` (when, how many rows, which files)
- `backups/latest.json` (the newest backup's folder)

The bucket deletes copies after 90 days by itself (lifecycle rule `expire-90`). Sessions and rate-limit
counts aren't backed up: after a restore, grown-ups simply sign in again.

## Restore

From `deploy/site` on the Mac Mini (it uses the Cloudflare key in `~/.cloudflare/global-api-key`):

```
node restore-backup.mjs                          # what the latest backup holds; nothing is written
node restore-backup.mjs 2026-11-01               # the same for one date
node restore-backup.mjs 2026-11-01 --yes         # put it back into the live database "keypals"
```

Every player and account in the backup goes back to how it was then (INSERT OR REPLACE). Players made
after the backup stay as they are. Big saves are written in 60 KB pieces, so D1's ~100 KB limit on a
statement is never hit.

To restore just to look (not touching the live database), first make a scratch database, then
restore into it, and delete it afterwards:

```
npx wrangler d1 create keypals-restore-test
npx wrangler d1 execute keypals-restore-test --remote --file schema.sql --yes
node restore-backup.mjs latest --database keypals-restore-test --yes
npx wrangler d1 delete keypals-restore-test --skip-confirmation
```

Cloudflare's own Time Travel can also roll the whole database back to any minute in the last 30 days
(`npx wrangler d1 time-travel restore keypals --timestamp <unix>`). That rolls back everything, so it's
for a bad deploy rather than for one family's lost player.

## Tested

29 Oct 2026:

- **Local run:** under `wrangler dev`, the scheduled job wrote a backup of 5 players (one of them 130 KB)
  and 1 account. I wiped the local database, ran `restore-backup.mjs --local --yes`, and the row counts,
  total bytes, codes and account links matched exactly. The 130 KB save came back as valid JSON.
- **Live path:** the same files went into a test folder in the real bucket, and I restored them with the
  live path into a scratch D1 database. The result matched exactly. The test folder and scratch database
  were deleted afterwards.
