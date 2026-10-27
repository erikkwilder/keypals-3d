#!/bin/zsh
# Store the Google and Microsoft sign-in keys as secrets on the fancyant.com/keypals Worker.
# Run it yourself (it asks for each value without showing it; nothing is printed or saved to disk).
# usage: deploy/site/set-signin-secrets.sh
cd "$(dirname "$0")"
export CLOUDFLARE_ACCOUNT_ID=2f5232a84d058ef9f332c077eef372d8 CLOUDFLARE_EMAIL=erikkwilder@gmail.com
export CLOUDFLARE_API_KEY="$(cat ~/.cloudflare/global-api-key)"
for name in GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET MS_CLIENT_ID MS_CLIENT_SECRET; do
  printf "%s (press Enter to skip): " $name; read -rs v; echo
  if [ -n "$v" ]; then printf %s "$v" | npx wrangler secret put $name > /dev/null 2>&1 && echo "  saved $name" || echo "  could not save $name"; fi
done
echo "Check: https://fancyant.com/keypals/api/config should now say true for the ones you set."
