# Setting up grown-up sign-in (about 10 minutes)

The game shows "Sign in with Google" and "Sign in with Microsoft" only once these are set up. The game
runs at two addresses, https://keypals.org/ (the game at the root) and https://fancyant.com/keypals/,
from one Worker script with one shared database (see the top of worker.js), so each provider needs the
sign-in return address for both.

## Google
1. Go to https://console.cloud.google.com/ and make (or pick) a project, e.g. "Keypals".
2. **Google Auth Platform → Branding**: app name "Keypals", support email, app logo optional,
   app home page https://keypals.org, privacy policy https://keypals.org/privacy.
   **Authorized domains**: `keypals.org` and `fancyant.com`.
   Audience: **External**, then **Publish app** (basic sign-in needs no review).
3. **Clients → Create client**: type **Web application**, name "Keypals web".
   Authorized redirect URIs:
   - `https://keypals.org/api/auth/google/callback`
   - `https://fancyant.com/keypals/api/auth/google/callback`
   - (also fine to have: `https://www.keypals.org/api/auth/google/callback` and
     `https://www.fancyant.com/keypals/api/auth/google/callback`; www.keypals.org sends everyone to
     keypals.org, so sign-in never starts there)
4. Copy the **Client ID** and **Client secret** for step "Store the keys".

## Microsoft
1. Go to https://entra.microsoft.com/ → **App registrations → New registration**.
2. Name "Keypals". Supported accounts: **Accounts in any organizational directory and personal
   Microsoft accounts**. Redirect URIs: platform **Web**,
   `https://keypals.org/api/auth/microsoft/callback` and
   `https://fancyant.com/keypals/api/auth/microsoft/callback`
3. After it's created, copy the **Application (client) ID**.
4. **Certificates & secrets → New client secret** (24 months), and copy its **Value** (shown once).

## Store the keys
Deploy first (deploy.sh), so both Workers exist. Then, in a terminal on the Mac Mini, run
`~/repos/keypals-3d/deploy/site/set-signin-secrets.sh` and paste each value when asked (Google ID, Google
secret, Microsoft ID, Microsoft secret, and ADMIN_EMAILS: the grown-ups who see the Admin section,
comma separated). It stores each on both Workers. Then open https://keypals.org/api/config and
https://fancyant.com/keypals/api/config: each should say `true` for the sign-ins you set. The Microsoft
secret expires after 24 months; make a new one then and run the script again.

## Signing in on each address
The sign-in cookie belongs to the address it was made on (Path `/` on keypals.org, `/keypals` on
fancyant.com), so a grown-up signs in once on each address they use. Their players are the same on both:
it's one account in one database.

## Moving players from fancyant.com/keypals to keypals.org
A child's progress lives in each address's own browser storage, so the same browser shows no players at
the new address at first. On fancyant.com/keypals, the Grown-ups screen offers **Move my players to
keypals.org**: every player gets a save code if it hasn't one, and keypals.org opens with the codes after
a `#` (`https://keypals.org/#move=TIGER-MOON-RAIN-42,...`; the part after `#` is never sent to a server).
keypals.org adds them (combining with any copy already there), clears the address at once, and says who
moved. Both copies keep saving to the same saved player. The code: src/lib/state/move.ts and
`moveToOrg` / the `#move=` part of `startCloud` in src/lib/state/cloud.svelte.ts.
