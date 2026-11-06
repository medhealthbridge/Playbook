# PLAYBOOK — Master Design & Build Prompt (v2, enhanced)

> v1 (your Playbook prompt) stays the source of truth for product rules, copy, booking logic,
> plans, video entitlements and acceptance criteria. Everything below is **added on top** of it,
> borrowing the cinematic ambition of the AI Builders "/new" experience — *a machine for turning
> ideas into launched products* — and translating it into Playbook's own world:
>
> **Playbook is a machine for turning a group chat into game time — and game time into moments you keep.**

---

## 0. The one-line concept

The visitor doesn't scroll a landing page. They **run a play**.

The whole site is drawn like a coach's play diagram: a chalk-and-lime route line starts at the
visitor's feet outside the pavilion and the camera follows that route — through the entrance, onto
the hardwood, through the giant letters of BOOK, between the splitting letters of PLAY, through the
REPLAY screen-gate and into the highlights gallery — until every court line, ticket and clip frame
snaps together into the PLAYBOOK wordmark.

Where AI Builders goes *white room → laptop portal → IDEA / BUILD / LAUNCH → convergence*,
Playbook goes *courtside dusk → pavilion entrance → BOOK / PLAY / REPLAY → final whistle*.

---

## 1. Signature additions (what makes it "screen-record-and-share")

### 1.1 The play-route camera rail
- The camera path is literally a play diagram: a glowing lime route line on the floor that the camera
  follows. X / O markers mark where each chapter begins.
- The route line draws itself ahead of the camera as you scroll (and erases when you scroll back).
- This replaces "abstract tunnel" transitions with something that only makes sense for Playbook.

### 1.2 The scoreboard HUD (chapter progress)
- A slim, fixed scoreboard on desktop: `Q1 BOOK · Q2 PLAY · Q3 REPLAY · FT`, with a shot-clock style
  progress bar and tabular numerals.
- Each label is a button that jumps to that chapter (native smooth scroll; instant when motion is reduced).
- It doubles as a "where am I" indicator and a skip control, so nobody is trapped in the animation.

### 1.3 Typography you travel *through*, not past
- **BOOK** — extruded, architectural letters standing on the court. The camera threads the second **O**.
- **PLAY** — the letters physically **split apart** as the camera approaches (P-L slide left, A-Y slide
  right), opening a lane onto the main basketball court. Kinetic, but no spinning.
- **REPLAY** — the word sits on top of a giant screen frame. The frame *is* the gate: you dive through the
  screen into the highlights gallery.
- **PLAYBOOK** (final) — court lines, booking cards and clip frames converge into a frame around the wordmark.

### 1.4 Rhythm like a game
- Slow "warm-up" drift where reading matters (hero, each chapter headline).
- Short "fast break" accelerations through entrances (pavilion door, the O, the screen-gate).
- Heavy, damped camera — momentum that eases in and out, never twitchy.
- Subtle pointer parallax on desktop only (a few centimetres of head movement, not a game camera).

### 1.5 Information as environments (borrowed from the reference, adapted)
| Content type | How it lives in the world |
|---|---|
| Booking availability | Floating time-chip boards next to a named court, chips light up lime as if being selected |
| Venue details | Court-side signage panels (surface, indoor/outdoor, capacity) |
| Confirmation / invites | A "ticket" panel that appears as the camera reaches centre court |
| Amenities | Small floor markers / signage along the route |
| Highlights | Rows of suspended clip frames forming a gallery corridor, with a floor-level clip timeline |
| Proof/claims | **None fabricated.** No fake stats, testimonials or counters — the world sells the product, not numbers |

### 1.6 Honest "live" feeling without fake data
- Every sample venue, price, clip and figure carries a visible **Demo data** label.
- Highlight previews use an original procedural animation clearly captioned *"Demo animation — not real
  footage"*. The play button actually plays it; no dead play buttons.

---

## 2. Additional experience rules

1. **Book-first, cinema-second.** The hero search (sport, location/venue, date) is usable in the first
   paint, before WebGL loads. The 3D canvas loads lazily behind it.
2. **Always-on booking.** Nav "Book a slot" on desktop; compact bottom bar on mobile with matching page
   padding so it never covers content.
3. **Skip-ability.** "Skip to booking" link for keyboard users; scoreboard jump buttons; booking dialog
   reachable from every section.
4. **Reduced motion = a designed experience,** not a broken one: chapters become a calm stacked story with
   static court-diagram artwork; the 3D canvas is not mounted.
5. **WebGL failure** silently falls back to the same static story.
6. **Render budget:** pause the render loop when the canvas is off-screen; cap device pixel ratio
   (≤1.75 desktop, ≤1.25 mobile); no shadow maps (fake contact shadows); no post-processing.
7. **Mobile camera:** separate keyframes — pulled back, centred, fewer lateral moves; half the props.
8. **Sound:** none by default. Never autoplay sound.

---

## 3. Additional craft details

- **Wordmark:** "PLAYBOOK" set in condensed caps, with the two O's drawn as a play-diagram "O" (player
  marker) and a small lime route arrow — usable at favicon size.
- **Sport art system:** every sport card uses the same construction — a top-down court diagram in
  white line work on charcoal, plus the sport's equipment glyph, plus one lime accent. Consistent,
  ownable, and accurate (pickleball kitchen, padel glass, sepak takraw court, badminton doubles lines).
- **Microcopy for states:** every unavailable video state explains *why* in one sentence
  (not recorded / awaiting upload / processing / ready / failed / expired / restricted by plan / not a participant).
- **Numbers:** tabular numerals everywhere time, price or score appears; PHP shown as `₱1,200`.
- **Time zone:** all times rendered and computed in Asia/Manila (UTC+8, no DST).

---

## 4. Architecture additions

- `src/content/*` — copy, sports, venues, plans, FAQ, asset references (single place to edit).
- `src/lib/booking/*` — pure, unit-testable availability + pricing + entitlement rules shared by the
  booking flow, the player area and the venue admin.
- `src/lib/adapters/*` — interfaces for auth, booking storage, payments, media storage, processing jobs,
  camera imports, with **demo implementations** backed by `localStorage`.
- `src/components/three/*` — one canvas, one scroll-driven camera rig, scene modules per chapter.
- A tiny test script verifying the critical rules (overlaps across shared resources, buffers,
  maintenance, opening hours, payment ≠ booking status, entitlement matrix, invitation privacy,
  independent player/venue plans, late payment handling).

---

## 5. Acceptance additions (on top of v1's list)

- Scoreboard jumps to each chapter; works with keyboard.
- Scrolling backward reverses the camera smoothly; no scroll snapping, no scroll trap.
- Hero CTA opens the booking dialog with the hero selections preserved — with JS-loaded 3D or without it.
- `npm test` passes the booking-rule checks; `npm run build` succeeds.

**FINAL GOAL:** the anticipation before a great game — bold lime, confident type, instant booking,
and moments worth coming back to replay. **BOOK. PLAY. REPLAY.**
