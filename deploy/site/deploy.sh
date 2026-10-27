#!/bin/zsh
# Build both games and publish them to fancyant.com/keypals (3D) and /keypals1 (flat).
# usage: deploy/site/deploy.sh
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"; GAME="$HERE/../.."; V1=~/repos/keypals
(cd "$GAME" && npx vite build > /dev/null)
(cd "$V1" && npx vite build > /dev/null)
rm -rf "$HERE/public" && mkdir -p "$HERE/public/keypals" "$HERE/public/keypals1"
cp -R "$GAME/dist/." "$HERE/public/keypals/"
cp -R "$V1/dist/." "$HERE/public/keypals1/"
cd "$HERE"
CLOUDFLARE_ACCOUNT_ID=2f5232a84d058ef9f332c077eef372d8 CLOUDFLARE_EMAIL=erikkwilder@gmail.com CLOUDFLARE_API_KEY="$(cat ~/.cloudflare/global-api-key)" npx wrangler deploy
