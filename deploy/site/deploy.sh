#!/bin/zsh
# Build both games and publish them to fancyant.com/keypals (3D) and /keypals1 (flat).
# usage: deploy/site/deploy.sh
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"; GAME="$HERE/../.."; V1=~/repos/keypals
(cd "$GAME" && npx vite build > /dev/null)
(cd "$V1" && npx vite build > /dev/null)
rm -rf "$HERE/public" && mkdir -p "$HERE/public/keypals" "$HERE/public/keypals1"
cp -R "$GAME/dist/." "$HERE/public/keypals/"
# the licensed music isn't in the repository: copy it in from its private folder (a real copy, not a link)
MUSIC=~/Documents/keypals-private/music
rm -rf "$HERE/public/keypals/music"
if [ -d "$MUSIC" ]; then mkdir -p "$HERE/public/keypals/music" && cp "$MUSIC"/*.mp3 "$HERE/public/keypals/music/"; else echo "warning: no music at $MUSIC (the game falls back to its own tunes)"; fi
cp -R "$V1/dist/." "$HERE/public/keypals1/"
cd "$HERE"
# the database's tables (every statement is "if not exists": safe to run each time), the classes' own after
CF=(CLOUDFLARE_ACCOUNT_ID=2f5232a84d058ef9f332c077eef372d8 CLOUDFLARE_EMAIL=erikkwilder@gmail.com CLOUDFLARE_API_KEY="$(cat ~/.cloudflare/global-api-key)")
env "${CF[@]}" npx wrangler d1 execute keypals --remote --file=schema.sql
env "${CF[@]}" npx wrangler d1 execute keypals --remote --file=schema-classes.sql
env "${CF[@]}" npx wrangler deploy
