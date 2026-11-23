#!/bin/zsh
# Build both games and publish them: the 3D game at fancyant.com/keypals and at keypals.org (the root of
# its own address, sharing the same database), the first flat version at fancyant.com/keypals1, and
# www.keypals.org's redirect to keypals.org. The 3D game is built once and copied to both places.
# usage: deploy/site/deploy.sh
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"; GAME="$HERE/../.."; V1=~/repos/keypals
# the Cloudflare account's sign-in stays on this computer, not in the repository: its email in
# ~/.cloudflare/email (or CLOUDFLARE_EMAIL already set), its key in ~/.cloudflare/global-api-key
export CLOUDFLARE_ACCOUNT_ID=2f5232a84d058ef9f332c077eef372d8
export CLOUDFLARE_EMAIL="${CLOUDFLARE_EMAIL:-$(cat ~/.cloudflare/email 2>/dev/null)}"
[ -n "$CLOUDFLARE_EMAIL" ] || { echo "Put the Cloudflare account's email in ~/.cloudflare/email (or set CLOUDFLARE_EMAIL) first."; exit 1; }
(cd "$GAME" && npx vite build > /dev/null)
(cd "$V1" && npx vite build > /dev/null)
rm -rf "$HERE/public" "$HERE/public-org" && mkdir -p "$HERE/public/keypals" "$HERE/public/keypals1" "$HERE/public-org"
# (clones, -c: the same files on disk twice over would need more than a gigabyte free)
cp -cR "$GAME/dist/." "$HERE/public/keypals/"
cp -cR "$GAME/dist/." "$HERE/public-org/"
# the licensed music isn't in the repository: copy it in from its private folder (a real copy, not a link)
MUSIC=~/Documents/keypals-private/music
rm -rf "$HERE/public/keypals/music" "$HERE/public-org/music"
if [ -d "$MUSIC" ]; then
  for d in "$HERE/public/keypals/music" "$HERE/public-org/music"; do mkdir -p "$d" && cp -c "$MUSIC"/*.mp3 "$d/"; done
else echo "warning: no music at $MUSIC (the game falls back to its own tunes)"; fi
cp -cR "$V1/dist/." "$HERE/public/keypals1/"
cd "$HERE"
export CLOUDFLARE_API_KEY="$(cat ~/.cloudflare/global-api-key)"
# the database's tables (every statement is "if not exists"), the classes' own after: only when a schema file
# changed since the last publish from this computer. Running them is an import, and the database stops
# answering while it runs: on 29-31 Oct 2026, with a publish every few hours, class pages timed out (504).
STAMP="$HERE/.wrangler/schema-applied.sha"; mkdir -p "$HERE/.wrangler"
SCHEMA="$(cat schema.sql schema-classes.sql | shasum -a 256 | cut -d' ' -f1)"
if [ "$(cat "$STAMP" 2>/dev/null)" != "$SCHEMA" ]; then
  npx wrangler d1 execute keypals --remote --file=schema.sql -y
  npx wrangler d1 execute keypals --remote --file=schema-classes.sql -y
  echo "$SCHEMA" > "$STAMP"
else echo "database tables unchanged since the last publish: not run"; fi
npx wrangler deploy                          # fancyant.com/keypals (+ /keypals1), the tidy-up and backups
npx wrangler deploy -c wrangler-org.toml     # keypals.org
npx wrangler deploy -c wrangler-www.toml     # www.keypals.org -> keypals.org
