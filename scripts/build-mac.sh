#!/bin/zsh
# Build the Mac app, wrap it in a disk image, and hand it over (local archive + Google Drive).
# Usage: scripts/build-mac.sh
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/opt/rustup/bin:$HOME/.cargo/bin:$PATH"
NAME="Keypals"
VERSION=$(node -p "require('./src-tauri/tauri.conf.json').version")

npm test
# one app for Apple Silicon and Intel Macs (Intel Macs top out at Catalina, 10.15)
rustup target add aarch64-apple-darwin x86_64-apple-darwin >/dev/null
npx tauri build --bundles app --target universal-apple-darwin

APP="src-tauri/target/universal-apple-darwin/release/bundle/macos/$NAME.app"
OUT="build"
mkdir -p "$OUT"
STAGE=$(mktemp -d)
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Applications"
DMG="$OUT/${NAME// /-}-$VERSION-mac.dmg"
rm -f "$DMG"
hdiutil create -volname "$NAME" -srcfolder "$STAGE" -ov -format UDZO "$DMG" >/dev/null
rm -rf "$STAGE"
echo "built $DMG ($(du -h "$DMG" | cut -f1))"

# hand-off copies
mkdir -p "$HOME/Documents/mini-share/builds"
cp "$DMG" "$HOME/Documents/mini-share/builds/"
DRIVE="$HOME/Library/CloudStorage/GoogleDrive-erikkwilder@gmail.com/My Drive/Mini Builds"
if [ -d "$DRIVE" ]; then cp "$DMG" "$DRIVE/" && echo "copied to Drive: Mini Builds"; else echo "Drive folder not found; skipped Drive copy"; fi
