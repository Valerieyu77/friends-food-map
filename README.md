# Friends Food Map

A small web app for rating restaurants with a group of friends. You create an account, and you and your friends join a group from an invite link, search a restaurant by name, give it a score, add a photo and a note, and everyone in the group sees it. Only people with the invite link can see a group's ratings.

Live at **https://friends-food-map.vercel.app**. Open it on a phone, create an account and a group, and share the invite link it shows.

## How it is put together

- **Pages:** React + TypeScript, built with Vite (`src/`).
- **Server:** Express (`server/app.ts`). On Vercel it runs as one serverless function (`api/index.ts`); on the laptop, `server/index.ts` runs it together with the Vite dev server.
- **Accounts:** email and password through Supabase Auth (`server/passwords.ts`); the app never stores passwords. The server creates accounts already confirmed, so no confirmation email is needed. After logging in, each device gets its own sign-in token (table `user_sessions`). "Forgot password" emails a link back to `/reset-password`; Supabase must list the site under Authentication → URL Configuration (Site URL and Redirect URLs), and its free email sending allows only a few emails per hour.
- **Data and photos:** Supabase (free plan): Postgres for users, groups, members, places and entries, and a public Storage bucket `photos` for pictures (file names are random, so a photo is only found through its group's feed). Tables and the bucket are created automatically on first use.
- **Keep-awake:** Supabase pauses a free project after a week without use, so a Vercel cron job calls `/api/keep-awake` once a day (see `vercel.json`).

## Run it on your computer

You need Node.js 24 or newer and a `.env` file with the Supabase settings (git ignores it, never commit it):

```bash
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
DATABASE_URL="postgresql://postgres.<project>:<url-encoded password>@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
```

`DATABASE_URL` is the Transaction pooler string from Supabase's Connect button. Keep the quotes, and percent-encode special characters in the password.

Phone notifications also need a pair of Web Push keys. Without them the app works, just without notifications. Make them once with `npx web-push generate-vapid-keys` and add:

```bash
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```

```bash
npm install
npm run dev
```

Open http://localhost:5173. The laptop uses the same Supabase data as the live site.

## Tests

```bash
npm test
```

The database tests run against an in-memory Postgres (PGlite), so they never touch real data.

## Deploy

The same settings (Supabase and the push keys) are stored in the Vercel project (`vercel env ls`). To publish the current code:

```bash
npx vercel deploy --prod
```

## Notes

- Avatar stickers are Fluent Emoji 3D images from Microsoft's fluentui-emoji repository (MIT license; see `public/stickers/LICENSE.txt`), resized to 128 pixels.
- Place search uses the free OpenStreetMap-based service at photon.komoot.io. It finds most well-known places but misses some small ones, so you can always add a place by name.
- The phone shares its location only on https pages, which the live site is; search uses it to show nearby places first.
