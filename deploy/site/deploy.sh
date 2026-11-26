#!/bin/zsh
# Build both games and publish them: the 3D game at fancyant.com/keypals and at keypals.org (the root of
# its own address, sharing the same database), the first flat version at fancyant.com/keypals1, and
# www.keypals.org's redirect to keypals.org. The 3D game is built once and copied to both places.
# usage: deploy/site/deploy.sh             (TABLES=1 deploy/site/deploy.sh sets up the database's tables again)
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
# no recorded music is published: the game plays the music it makes itself (Keypals Originals). The 140 Envato
# Elements tracks in ~/Documents/keypals-private/music came out of the game on 26 Nov 2026 and must not be
# published again (src/lib/audio/stations.ts says why). A music folder the build copied in from a dev link
# (public/music) is taken out too.
rm -rf "$HERE/public/keypals/music" "$HERE/public-org/music"
cp -cR "$V1/dist/." "$HERE/public/keypals1/"
# Cloudflare would add its Web Analytics script to every page it serves to a browser (the account has it on).
# The privacy notice and the Grown-ups screen promise no analytics trackers, so every Keypals file is marked
# "no-transform": Cloudflare's proxy then leaves the pages exactly as built. (The caching is what Cloudflare
# already sent: public, max-age=0, must-revalidate.) The check at the end looks for any outside script.
for d in "$HERE/public" "$HERE/public-org"; do
  printf '/*\n  Cache-Control: public, max-age=0, must-revalidate, no-transform\n' > "$d/_headers"
done
cd "$HERE"
export CLOUDFLARE_API_KEY="$(cat ~/.cloudflare/global-api-key)"
# the database's tables (every statement is "if not exists"), the classes' own after: only when a schema file
# changed since the last publish from this computer. Running them is an import, and the database stops
# answering while it runs: on 29-31 Oct 2026, with a publish every few hours, class pages timed out (504).
# The note of what was run is a file on this computer, so it can't know about a database that was made
# again or swapped: TABLES=1 runs them whatever the note says, and the check at the end says when to.
STAMP="$HERE/.wrangler/schema-applied.sha"; mkdir -p "$HERE/.wrangler"
SCHEMA="$(cat schema.sql schema-classes.sql | shasum -a 256 | cut -d' ' -f1)"
if [ -n "$TABLES" ] || [ "$(cat "$STAMP" 2>/dev/null)" != "$SCHEMA" ]; then
  npx wrangler d1 execute keypals --remote --file=schema.sql -y
  npx wrangler d1 execute keypals --remote --file=schema-classes.sql -y
  echo "$SCHEMA" > "$STAMP"
else echo "database tables unchanged since the last publish: not run"; fi
npx wrangler deploy                          # fancyant.com/keypals (+ /keypals1), the tidy-up and backups
npx wrangler deploy -c wrangler-org.toml     # keypals.org
npx wrangler deploy -c wrangler-www.toml     # www.keypals.org -> keypals.org

# Look at what the world now gets, at both addresses: this build's page, and an answer from the database
# (a save code nobody has must come back "not found" with missing:true; anything else means the API or
# its tables aren't right). A new build can take a few seconds to show, so each address gets a few tries.
BUILD="$(grep -o 'assets/index-[^"]*\.js' "$GAME/dist/index.html" | head -1)"
bad=0
for site in https://keypals.org https://fancyant.com/keypals; do
  got=""
  for try in 1 2 3 4 5 6; do
    got="$(curl -s --max-time 20 "$site/" | grep -o 'assets/index-[^"]*\.js' | head -1)"
    [ "$got" = "$BUILD" ] && break; sleep 5
  done
  [ "$got" = "$BUILD" ] && echo "ok: $site serves $BUILD" || { echo "NOT RIGHT: $site serves ${got:-nothing}, not $BUILD"; bad=1; }
  api="$(curl -s --max-time 20 -w ' [%{http_code}]' "$site/api/players/ZEBRA-ZEBRA-00")"
  case "$api" in
    *'"missing":true'*'[404]') echo "ok: $site/api answers from the database" ;;
    *) echo "NOT RIGHT: $site/api answered: $api"; echo "  (if it says a table is missing, run: TABLES=1 deploy/site/deploy.sh)"; bad=1 ;;
  esac
  # the page as a browser gets it (Cloudflare adds things only for browsers): no script from anywhere else
  for page in "$site/" "$site/privacy"; do
    ext="$(curl -s --max-time 20 -A 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36' -H 'Accept: text/html' "$page" | grep -o -i '<script[^>]*src="https\{0,1\}://[^"]*' | head -3)"
    [ -z "$ext" ] && echo "ok: $page has no outside scripts" || { echo "NOT RIGHT: $page loads $ext"; bad=1; }
  done
done
exit $bad
