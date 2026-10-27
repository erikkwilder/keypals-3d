# Setting up grown-up sign-in (about 10 minutes)

The game shows "Sign in with Google" and "Sign in with Microsoft" only once these are set up.

## Google
1. Go to https://console.cloud.google.com/ and make (or pick) a project, e.g. "Keypals".
2. **Google Auth Platform → Branding**: app name "Keypals", support email, app logo optional,
   app home page https://fancyant.com/keypals, privacy policy https://fancyant.com/keypals/privacy.html.
   Audience: **External**, then **Publish app** (basic sign-in needs no review).
3. **Clients → Create client**: type **Web application**, name "Keypals web".
   Authorized redirect URI: `https://fancyant.com/keypals/api/auth/google/callback`
4. Copy the **Client ID** and **Client secret** for step "Store the keys".

## Microsoft
1. Go to https://entra.microsoft.com/ → **App registrations → New registration**.
2. Name "Keypals". Supported accounts: **Accounts in any organizational directory and personal
   Microsoft accounts**. Redirect URI: platform **Web**,
   `https://fancyant.com/keypals/api/auth/microsoft/callback`
3. After it's created, copy the **Application (client) ID**.
4. **Certificates & secrets → New client secret** (24 months), and copy its **Value** (shown once).

## Store the keys
In a terminal on the Mac Mini, run `~/repos/keypals-3d/deploy/site/set-signin-secrets.sh` and paste each
value when asked (Google ID, Google secret, Microsoft ID, Microsoft secret). Then open
https://fancyant.com/keypals/api/config: it should say `true` for each. The Microsoft secret expires
after 24 months; make a new one then and run the script again.
