# PLAYBOOK — Book. Play. Replay.

A cinematic sports-booking landing page with a working demo booking flow,
a player area and a venue admin. Initial market: Metro Manila (PHP, Asia/Manila).

- **Prompt (v2, enhanced):** [`docs/MASTER_PROMPT.md`](docs/MASTER_PROMPT.md)
- **Stack:** Next.js 15 · React 19 · TypeScript · React Three Fiber / Three.js · GSAP ScrollTrigger · plain CSS tokens

## Run it

```bash
npm install
```

```bash
npm run dev        # http://localhost:3000
```

```bash
npm test           # booking / payment / entitlement rule checks (22)
```

```bash
npm run build && npm start
```

Routes: `/` (landing + 3D journey), `/demo?role=player`, `/demo?role=venue`.
"Reset demo data" on `/demo` re-seeds everything.

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

## What the demo actually does

| Area | Implemented (demo) |
|---|---|
| Booking flow | Sport → venue → named court/table/pitch → date, duration, start → review (equipment, full price breakdown, deposit/balance, cancellation policy, recording availability) → simulated checkout → confirmation |
| Availability rules | Opening hours, booking increments, min/max duration, existing bookings, maintenance blocks, setup buffers, past times. **Basketball and volleyball on Court A share one availability record.** |
| Holds & payments | 10-minute holds; payment outcome chosen in a visibly simulated checkout (no card fields). Payment status is separate from booking status. Pending/failed never show as confirmed. Idempotent payment events; a late payment for a taken slot becomes **refund due** — never a double booking. "Slot just got taken" can be simulated. |
| States | Loading, empty availability (with next-day suggestion), invalid date, slot taken, payment failed, pending, hold expired, cancelled, refund due |
| Player area | Upcoming/past bookings, receipts, invite squad, accept invites (demo), per-person recording access, cancel with policy preview, **Book again** (availability rechecked), notifications, membership switch, highlight library |
| Venue admin | Day/week calendar across resources, booking detail + venue cancellation (full refund), maintenance blocks, payments ledger with filters, recording workflow (CCTV export or camera upload → processing → ready/failed → cut clip → publish), venue plan, staff roles (Club) |
| Video rules | Access needs venue video plan + camera on resource, ready footage, published clip, authorised participant, and a plan with highlights; downloads need Replay Plus. Missing footage is reported as missing, not as a plan restriction. Invitations never grant recording access. |
| Plans | Separate player/venue tabs; names/benefits are proposals; prices show "Pricing to be announced". Changing one plan never changes the other. |
| Sync | Booking flow, player area and venue admin share one store (`localStorage`), so a demo booking appears in both views instantly (and across tabs). |
| Motion & a11y | Native scrolling; visible **Reduce motion** toggle (respects `prefers-reduced-motion`); static designed story when motion is reduced or WebGL fails; keyboard-operable dialog/tabs/radios; focus management; labelled errors; no autoplay, no sound |
| Performance | 3D chunk loaded after first paint (first load JS ≈ 181 kB without three.js); render loop paused off-screen; DPR capped (1.75 desktop / 1.25 mobile); no shadow maps or post-processing; instanced lights/route; fewer props on mobile |

Highlight "videos" are an original procedural animation captioned **"Demo animation — not real footage"**.
All venues, prices, people and clips are fictional and labelled as demo data.

## Production integrations still needed

Each has an interface in `src/lib/adapters/interfaces.ts`:

1. **Auth** with server-enforced roles and venue isolation (the role switch is not auth).
2. **Booking storage** with DB-level conflict prevention (e.g. Postgres exclusion constraint on `(resource_id, tstzrange + buffer)`) and expiring holds.
3. **Payments** (PSP checkout) confirmed only by **verified, idempotent webhooks**; refunds for late payments.
4. **Private media storage** with short-lived signed playback/download URLs and per-venue/per-booking isolation.
5. **Processing jobs** for uploaded footage; **camera/CCTV import** of exported files (no raw feeds exposed).
6. Notifications (email/SMS/push), real pricing, legal copy (recording notices, privacy, retention).

Future features (not built): recurring reservations, waitlists, split payments, leagues,
tournament brackets, scorekeeping, coaching, automatic highlight detection.

## Where to change things

| To change… | Edit |
|---|---|
| Headlines, CTAs, section copy | `src/content/copy.ts` |
| FAQ | `src/content/faq.ts` |
| Sports (names, taglines, order, featured) | `src/content/sports.ts` · artwork in `src/components/art/SportArt.tsx` |
| Venues, courts/tables, prices, hours, buffers, deposits, equipment, sessions, maintenance seeds | `src/content/venues.ts` |
| Plan names, benefits, prices (`price: "₱… / month"`), entitlements | `src/content/plans.ts` |
| Colours, type, radii | CSS variables at the top of `src/app/globals.css` (`--lime`, `--charcoal`, …) |
| Booking/payment/video rules | `src/lib/booking/rules.ts` (covered by `npm test`) |
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

## Project map

```
docs/MASTER_PROMPT.md            enhanced prompt (v2)
src/app/                         layout, landing page, /demo
src/content/                     all editable copy & commercial data
src/lib/booking/                 types, time (Asia/Manila), pure rules
src/lib/demo/                    demo store (pure actions) + React provider
src/lib/adapters/interfaces.ts   production service boundaries
src/components/three/            canvas, world, scroll timeline, textures
src/components/landing/          cinematic orchestration, sections, hero search
src/components/booking/          booking dialog
src/components/demo/             player + venue admin
tests/booking.test.ts            rule checks (node --experimental-strip-types)
```
