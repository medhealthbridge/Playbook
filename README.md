# PLAYBOOK — Book. Play. Replay.

A sports-booking platform with a cinematic landing page: players book courts and join open play,
venues run their calendar and open play, and the platform admin tracks the cut each venue owes. Initial market: Metro Manila (PHP, Asia/Manila).

- **Prompt (v2, enhanced):** [`docs/MASTER_PROMPT.md`](docs/MASTER_PROMPT.md)
- **Stack:** Next.js 15 · React 19 · TypeScript · React Three Fiber / Three.js · GSAP ScrollTrigger · plain CSS tokens

## Run it

Live site: https://playbook.databridgesol.space (Vercel, functions in `sin1`).
Operating guide for admins, venues and players: the shared *Playbook — Operating Guide* doc.

```bash
npm install
```

```bash
cp .env.example .env.local   # then fill in values (see the file for each variable)
```

```bash
npm run db:migrate           # Better Auth tables + db/schema.sql (idempotent)
```

```bash
npm run dev                  # http://localhost:3000
```

### Environments

| Environment | Database (Neon project `green-bird-70481823`) | Where the keys live |
|---|---|---|
| Production | branch `main` | Vercel → Production env vars |
| Development / testing | branch `dev` (copy of `main`'s schema) | `.env.local` (never commit) |

Never point `.env.local` or a test run at the `main` branch. Test accounts always use `@playbook.test` emails, and clean-up deletes only those accounts and their venues.

### Checks

```bash
npm run lint                 # ESLint (next/core-web-vitals + typescript) and tsc --noEmit
```

```bash
npm test                     # pure rules: availability, prices, fees, refunds, queue, webhook signature
```

End-to-end suites run against a local production build on the dev database (see `tests/qa/README.md`):
`tests/qa/seed.js`, then `tests/qa/model.js` (19 checks: cut, no-payment-no-play, voids, scores and levels,
rentals, weekly statements, automatic pause), `tests/qa/qa.js` (38 checks: auth, roles, tenant isolation, tampered ids, booking
races, validation, phone layout) and `tests/qa/quality.js` (hold limits, webhook signature, replay window,
idempotency, cross-venue webhook, security headers).

### Deploy and roll back

Deploy a commit to production from Vercel (or the Vercel API) with target `production`. To roll back,
promote the previous production deployment in Vercel → Deployments. Schema changes in `db/schema.sql` are
additive (`IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`), so a code rollback does not need a schema rollback.
Never drop or rename a column in the same release that stops using it (expand → migrate → contract).

### Backups and recovery

- Neon keeps point-in-time history for the project (the window depends on the Neon plan; check it in the Neon console) and manual snapshots can be restored to a new branch. No automatic snapshot schedule is set yet.
- Restore drill (2026-11-08): snapshot of `main` → restored to branch `restore-drill` → schema and row counts
  matched production; about 45 seconds end to end.
- Targets: RPO of minutes within the history window (point-in-time restore), RTO ≤ 30 minutes (restore to a branch, point Vercel's
  `DATABASE_URL` at it, redeploy).
- Stored PayMongo keys are encrypted with a key derived from `BETTER_AUTH_SECRET` (or `PAYMONGO_ENC_KEY`).
  Keep a copy of that secret in a password manager: a restored database is unreadable for payments without it.

### One-tap sign-in (Google, Facebook, Apple)

Each button shows on `/login` and `/signup` only when its keys are set in Vercel (Production). The callback URL for
each provider is `https://playbook.databridgesol.space/api/auth/callback/<google|facebook|apple>`.

| Provider | Where to get keys | Vercel variables |
|---|---|---|
| Google | Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web application). Add the callback URL under Authorised redirect URIs. Publish the OAuth consent screen. | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Facebook | developers.facebook.com → Create app → Facebook Login → Valid OAuth Redirect URIs = callback URL. Request the `email` permission; switch the app to Live. | `FACEBOOK_CLIENT_ID` (App ID), `FACEBOOK_CLIENT_SECRET` (App Secret) |
| Apple | Apple Developer account (paid). Create a Services ID with Sign in with Apple, domain `playbook.databridgesol.space`, return URL = callback URL; create a Sign in with Apple key (.p8). | `APPLE_CLIENT_ID` (Services ID), `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` (.p8 contents) |

The Apple client secret is signed from the .p8 key at start-up (valid 150 days), so it never needs manual renewal.
A Google or Apple sign-in with the same verified email joins an existing email account; Facebook does not, because it
doesn't confirm the email is verified. On sign-up, the Terms and Privacy box must be ticked before any button works;
on sign-in, the page states that continuing creates an account under the Terms. Either way the agreement is stored in
`user_consent`.

### Operations

- Weekly statements: Vercel Cron calls `/api/cron/invoices` at 01:00 UTC every Monday (09:00 Manila) with
  `CRON_SECRET`; re-running never duplicates statements. Manual run: `/admin → Billing → Create weekly statements`.
- PayMongo webhooks: one per venue (`/api/paymongo/webhook/<venueId>`) and one for Playbook invoices
  (`/api/paymongo/platform`). Signatures and a 5-minute timestamp window are checked; each event id is processed
  once; a failed event is released so PayMongo's retry is processed.
- Logs: Vercel → Project → Logs. Webhook failures log `paymongo webhook failed` / `platform webhook failed`.
- Audit trail of admin and venue actions: `/admin → Audit`.

## Design in one paragraph

The visitor doesn't scroll a page — they **run a play**. One WebGL canvas holds a
continuous world, and native scroll drives a heavy, damped camera along a single
path that is literally drawn on the floor as a lime play-route (it draws itself
ahead of you and erases when you scroll back). Courtside at dusk → through the
pavilion door → threading the **O** of a giant extruded **BOOK** → the letters of
**PLAY** part like doors onto centre court → dive through the **REPLAY** screen-gate
into a corridor of highlight frames → court lines and clip pieces converge into a
frame around the **PLAYBOOK** wordmark: *Less planning. More playing.* A scoreboard HUD
(Q1 BOOK · Q2 PLAY · Q3 REPLAY · FT) shows progress and lets anyone skip ahead.
All readable copy and every control is accessible HTML; the 3D is lazy-loaded and
never blocks booking.

## What is live

| Area | Status |
|---|---|
| Accounts | Email + password (Better Auth), email verification and password reset once Resend is configured, rate-limited sign-in/up, platform admins from `PLATFORM_ADMIN_EMAILS` |
| Roles | Player, facilitator (front desk), owner, platform admin; every action is checked on the server |
| Venues | Registration → admin approval → live. Listing is free |
| Bookings | Real availability, 10-minute holds, Postgres exclusion constraint against double booking, pay online (venue's own PayMongo) or at the venue, cancellations and refunds, per-account limits on unpaid holds |
| Front desk | Calendar, walk-ins, check-in, no-show, blocks, recurring weekly bookings |
| Open play | QR join with consent, level per sport (moves with results), matchmaking by level, facilitator enters final scores, TV board. No payment recorded, no play; voids need a reason and are visible to the admin |
| Rentals | Per-venue items (paddle, ball) added to court bookings and open play; no platform cut |
| Money | Players pay venues (cash or the venue's PayMongo). Playbook's cut is admin-set (fixed or percent, separately for open play and courts), counted at check-in or confirmation, billed on weekly statements; overdue venues pause automatically (days and on/off are admin settings). Payment bell beeps on venue screens when an online payment lands |
| Messages | Booking chat, venue news, follows (emails once Resend is configured) |
| Not built | Venue photos, account deletion / data export, staff invite emails, ownership transfer, recordings and highlights (the homepage clips are AI-generated samples, labelled "Sample clip" and "coming soon") |

The homepage shows only live venues from the database (`/api/venues/public`). Feature tiles and the 3D story cards are illustrations and say so.

## Where to change things

| To change… | Edit |
|---|---|
| Headlines, CTAs, section copy | `src/content/copy.ts` |
| FAQ | `src/content/faq.ts` |
| Sports (names, taglines, order, featured) | `src/content/sports.ts` · artwork in `src/components/art/SportArt.tsx` |
| Venues, courts, prices, hours, rentals | Each venue's own dashboard (stored in the database) |
| Playbook's cut, days to pay, auto-pause | `/admin → Settings` (stored in `platform_setting`) |
| Colours, type, radii | CSS variables at the top of `src/app/globals.css` (`--lime`, `--charcoal`, …) |
| Booking, cut, statement-week and rating rules | `src/lib/booking/engine.ts`, `src/lib/openplay/` (covered by `npm test`) |
| Camera path, chapter timing | `src/components/three/World.tsx` (`keyframes`) and `src/components/three/timeline.ts` (`PANELS`, `CHAPTERS`) |
| 3D scenes | `src/components/three/World.tsx` (`Courtside`, `BookWorld`, `PlayWorld`, `ReplayWorld`, `Convergence`) |
| Real photos/video | replace `SportArt` usages with `<img>`/`<video>`; keep generated concept art distinct from real venue photography |

## 3D assets & realism layer

`public/assets/` holds the optimized subset of the generated asset bundle (≈4.3 MB, from ≈110 MB):
arena + exterior HDRIs (1K/512), six PBR texture sets at 1024 (base colour, normal, packed AO/roughness/metal),
the bleacher and bench models, light-beam and dust sprites, and the silent ambient arena loop.
Rebuild it from a fresh bundle with:

```bash
python3 -I scripts/prepare_assets.py <folder-containing-public/assets>
```

`src/components/three/Realism.tsx` uses them for HDRI lighting, a reflective clear-coated hardwood floor,
camera-following soft shadows, bloom on lights and lime lines, light shafts, drifting dust, a dribbling ball
and the video screen-gate. Mirror floor, shadows, bloom and light shafts are desktop-only; mobile keeps the
HDRI + PBR materials. Sources and licences: `public/assets/CREDITS.md`.

`ArenaShell.tsx` adds the acoustic ceiling, steel trusses, high-bay fixtures with halos, scrolling LED ribbon
boards and side video walls; `Gallery.tsx` builds the REPLAY highlight screens (sport photos with broadcast
overlays, pan/zoom motion, progress bars) and the film-strip timeline. Phones get mirrored screens and lights
under a slightly see-through floor instead of the real-time mirror.

Performance guards: camera far plane just past the fog, floor markings and light effects on a main-camera-only
layer (skipped by the mirror and shadow passes), only hero objects cast shadows, mirror and shadow map refresh
every other frame, and the render loop pauses off-screen and while the booking dialog is open.

## Project map

```
docs/MASTER_PROMPT.md            enhanced prompt (v2)
src/app/                         layout, landing page, accounts, venue dashboard, admin, booking, open play
src/content/                     all editable copy & commercial data
src/lib/booking/                 types, time (Asia/Manila), pure rules
src/components/three/            canvas, world, scroll timeline, textures
src/components/landing/          cinematic orchestration, sections, hero search
src/components/booking/          booking dialog
tests/engine.test.ts             rule checks (node --experimental-strip-types)
```
