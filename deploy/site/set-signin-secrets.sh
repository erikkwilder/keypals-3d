#!/bin/zsh
# Store the Google and Microsoft sign-in keys, and the admin emails, as secrets on both game Workers
# (fancyant.com/keypals and keypals.org). Run it yourself (it asks for each value without showing it;
# nothing is printed or saved to disk).
# usage: deploy/site/set-signin-secrets.sh
cd "$(dirname "$0")"
export CLOUDFLARE_ACCOUNT_ID=2f5232a84d058ef9f332c077eef372d8 CLOUDFLARE_EMAIL=erikkwilder@gmail.com
export CLOUDFLARE_API_KEY="$(cat ~/.cloudflare/global-api-key)"
# ADMIN_EMAILS: who sees the Admin section on the Grown-ups screen (ideas, problems, numbers), comma
# separated; Google sign-ins only
for name in GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET MS_CLIENT_ID MS_CLIENT_SECRET ADMIN_EMAILS; do
  printf "%s (press Enter to skip): " $name; read -rs v; echo
  if [ -n "$v" ]; then
    for cfg in wrangler.toml wrangler-org.toml; do
      printf %s "$v" | npx wrangler secret put $name -c $cfg > /dev/null 2>&1 && echo "  saved $name ($cfg)" || echo "  could not save $name ($cfg)"
    done
  fi
done
echo "Check: https://fancyant.com/keypals/api/config and https://keypals.org/api/config should say true for the sign-ins you set."
