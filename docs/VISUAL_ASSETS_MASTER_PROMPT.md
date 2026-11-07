# PLAYBOOK — Master Visual Asset Prompt (copy this whole document)

You are generating visual assets for **PLAYBOOK**, a sports booking website for the Philippines
(courts, tables and pitches you book by the hour, with game highlights at participating venues).
The site is a cinematic 3D scroll experience set inside a premium night-time sports arena.
Generate each item below **one at a time, in order**, following the shared art direction,
the item's specs and its prompt exactly. After each item, check it against the item's
"Check" line and regenerate if it fails.

---

## 0. Shared art direction (applies to EVERY item)

- **Look:** premium, cinematic, realistic. A new-build private sports club at night, not a school gym. Clean, modern architecture.
- **Light:** warm overhead arena light (about 3500 K) pooling on the playing surface, darker edges, faint haze in the air. Exteriors are at blue hour with warm floodlights.
- **Colour:** natural materials (maple hardwood, felt, turf, glass, brushed steel, concrete) against deep charcoal shadows (#101713). At most one small electric-lime accent (#D7FF3F), such as court tape or an LED strip. Orange (#FF7648) only as a tiny detail.
- **People (videos only, plus images where stated):** adult amateur players in plain unbranded sportswear, one team in charcoal and one in white. No numbers, no close-up faces, no celebrities.
- **Always forbidden:** logos, brand names, readable text, numbers on balls or jerseys, watermarks, signage text, cartoon or illustration style, neon overload, sci-fi or gaming look, distorted bodies or equipment.
- **Honesty:** every generated image and video is labelled "Illustrative" or "Demo clip — AI-generated" on the site. Never imitate a real venue, brand or person.

---

## Status: already delivered (do not regenerate)

| Asset | Status |
|---|---|
| 10 sport card photos (`sports/*.jpg`) | Done and live. Good quality. |
| Arena panorama (AI image converted to HDR) | In use, but synthetic. Upgrade in section C. |
| Procedural textures and basic 3D models | In use as placeholders. Upgrade in sections D and E. |

---

## Delivery (Google Drive, same shared folder)

```
playbook-assets/
  videos/      V1 … V11 (.mp4)
  images/      I1 … I10 (.jpg)
  hdri/        H1, H2 (.hdr or .exr)
  textures/    T1 … T9 (.jpg)
  models/      M1 … M12 (.glb)
```
Use the exact file names given for each item. When unsure about a spec, choose larger and higher quality; I shrink and optimize everything.

---

## A. VIDEOS (Sora, Veo, Kling, Seedance or Higgsfield) — highest impact

**Specs for all videos:** MP4, 16:9, 1920×1080 (1280×720 minimum), 6–12 seconds, 24 or 30 fps. Audio doesn't matter (it's stripped). Generate 2–3 versions of each and keep the cleanest.

**Camera concept:** every game clip looks like it was filmed by **the venue's own fixed camera**: mounted high, stable, wide, with at most a slow pan. That's exactly what Playbook delivers (venues upload their camera footage), so it feels authentic.

**Check for every video:** natural movement (no extra limbs, no morphing), the ball stays one ball with realistic physics, the play succeeds, no text or logos, the camera stays steady.

**V1 — `highlight-basketball.mp4` · "Fast break and-one"** (highlights library + gallery)
```text
Realistic sports video, filmed from a fixed elevated venue camera mounted high on the sideline wall of an indoor basketball court, wide shot showing most of the court, slight slow pan following the play. Night, premium modern indoor arena: glossy maple hardwood with crisp white court lines, glass backboards with white nets, warm overhead LED lighting reflecting on the floor, dark charcoal walls and empty dark stands. Ten amateur adult players in a recreational pickup game, two teams in plain unbranded jerseys (one team charcoal, one team white), no numbers, no logos. Action: a player in white steals the ball near half court, sprints the length of the court on a fast break, drives to the basket, takes contact from a defender and finishes a layup that drops through the net; teammates react with a high-five. Natural, physically accurate movement and ball physics, smooth 30fps motion, true-to-life speed. No text, no scoreboard graphics, no watermarks, no logos, no close-up faces. 16:9.
```

**V2 — `highlight-padel.mp4` · "Twenty-shot rally"**
```text
Realistic sports video, filmed from a fixed elevated venue camera behind one baseline of an indoor padel court, high angle showing the whole court, camera locked off. Night, premium modern padel club: blue artificial-grass court with white lines, tempered glass back walls and black steel mesh side fences, warm overhead LED lighting, dark surroundings. Four amateur adult players in a doubles match in plain unbranded sportswear (one pair in charcoal, one pair in white), no logos. Action: a fast extended rally with several quick exchanges at the net and from the back of the court; the ball rebounds off the back glass and is played back, a high defensive lob follows, and the rally ends with an overhead smash that bounces out of reach. Natural, physically accurate movement, realistic padel ball physics including glass rebounds, smooth 30fps motion. No text, no score graphics, no watermarks, no logos, no close-up faces. 16:9.
```

**V3 — `highlight-billiards.mp4` · "Bank shot to win the rack"**
```text
Realistic video, filmed from a fixed high-angle camera mounted above a 9-foot pool table, looking down at a steep angle so the whole table is visible, camera locked off. Night, premium billiards lounge: deep green tournament cloth, dark walnut rails, leather pockets, a long rectangular pendant lamp casting warm light on the table, the room around it in darkness. Only a few balls remain on the table, with no numbers visible. Action: a cue enters from the edge of the frame (only the player's forearm and hand visible), strikes the white cue ball, which hits the last coloured object ball; the object ball travels across the table, banks cleanly off one cushion and rolls into the far corner pocket, and the cue ball comes to rest. Physically accurate ball physics and realistic rolling, no balls changing shape or colour, smooth 30fps motion. No text, no numbers, no watermarks, no logos, no faces. 16:9.
```

**V4 — `highlight-volleyball.mp4` · "Spike at the net"**
```text
Realistic sports video, filmed from a fixed elevated venue camera high on the side wall of an indoor volleyball court, wide shot of both halves, camera locked off. Night, premium modern sports hall: maple hardwood floor with white court lines, a white-taped net between padded posts, warm overhead LED lighting, dark charcoal surroundings. Twelve amateur adult players, two teams in plain unbranded sportswear (charcoal and white). Action: a serve is received, set high near the net, and a hitter in white jumps and spikes the ball past the blockers into the floor; the team celebrates briefly. Physically accurate jumping and ball physics, smooth 30fps motion. No text, no logos, no watermarks, no close-up faces. 16:9.
```

**V5 — `highlight-futsal.mp4` · "Through-ball finish"**
```text
Realistic sports video, filmed from a fixed elevated floodlight-pole camera at the corner of an outdoor futsal pitch at night, wide high angle, slight slow pan. Artificial turf with visible mow stripes and white lines, compact white goals with nets, bright warm floodlights, dark sky. Ten amateur adult players in plain unbranded kits (charcoal and white). Action: a player in white threads a through-ball between two defenders, a teammate runs onto it and drives a low shot past the goalkeeper into the corner of the net. Physically accurate running and ball physics, smooth 30fps motion. No text, no logos, no numbers, no watermarks, no close-up faces. 16:9.
```

**V6 — `highlight-pickleball.mp4` · "Kitchen battle"**
```text
Realistic sports video, filmed from a fixed elevated venue camera behind one baseline of an indoor pickleball court, high angle showing the whole court, camera locked off. Night, premium indoor venue: blue acrylic court with a green surround, white lines including the non-volley kitchen line, a low net, warm overhead LED lighting, dark surroundings. Four amateur adult players in plain unbranded sportswear (charcoal pair and white pair). Action: a fast exchange of soft dinks at the kitchen line, then one player speeds up the ball into a quick volley that wins the point. Realistic paddle and perforated-ball physics, smooth 30fps motion. No text, no logos, no watermarks, no close-up faces. 16:9.
```

**V7 — `highlight-badminton.mp4` · "Jump smash"**
```text
Realistic sports video, filmed from a fixed elevated venue camera high behind one end of an indoor badminton court, camera locked off. Night, premium badminton hall: green synthetic court mat with white doubles lines, net between posts, warm overhead lighting, dark surroundings. Two amateur adult players in a singles rally, in plain unbranded sportswear (charcoal and white). Action: a quick rally of clears and drops, then a high lift is punished with a powerful jump smash that lands in for a winner. Realistic shuttlecock flight (fast then decelerating), smooth 30fps motion. No text, no logos, no watermarks, no close-up faces. 16:9.
```

**V8 — `highlight-tennis.mp4` · "Ace down the T"**
```text
Realistic sports video, filmed from a fixed elevated camera high behind the baseline of a floodlit outdoor tennis court at night, camera locked off. Blue hard court with white lines, net, bright warm floodlights, dark sky. Two amateur adult players in plain unbranded sportswear (charcoal and white). Action: the server tosses and serves a fast flat serve down the centre line that lands in the service box for an ace; the returner can't reach it. Realistic tennis motion and ball physics, smooth 30fps motion. No text, no logos, no watermarks, no close-up faces. 16:9.
```

**V9 — `highlight-table-tennis.mp4` · "Backhand flick"**
```text
Realistic sports video, filmed from a fixed elevated side camera above a table tennis table, camera locked off. Night, dark room lit by a single overhead light over a matte blue table with white lines and a net. Two amateur adult players in plain unbranded sportswear (charcoal and white). Action: a short fast rally, then one player flicks a backhand winner that the opponent can't return. Realistic paddle motion and fast ball physics, smooth 30fps motion. No text, no logos, no watermarks, no close-up faces. 16:9.
```

**V10 — `highlight-sepak-takraw.mp4` · "Roll spike"**
```text
Realistic sports video, filmed from a fixed elevated venue camera on the side wall of an indoor sepak takraw court, wide shot, camera locked off. Night, premium indoor hall: court floor with white lines, a low net, warm overhead lighting, dark surroundings. Six amateur adult players, two teams of three in plain unbranded sportswear (charcoal and white). Action: a set near the net, then a player performs an acrobatic roll spike, kicking the woven ball over the net into the opponents' court. Realistic acrobatic motion and woven-ball physics, smooth 30fps motion. No text, no logos, no watermarks, no close-up faces. 16:9.
```

**V11 — `ambient-arena.mp4` · Ambient loop for the giant REPLAY screen** (seamless loop, 8–10 seconds)
```text
Cinematic seamless looping video of an empty premium indoor basketball arena at night: the camera slowly glides along the sideline at court level, glossy maple hardwood reflecting rows of warm overhead LED lights, dark empty stands, faint haze catching the light beams, glass backboards in the distance. No people. Calm, slow, smooth motion, the first and last frames matching for a seamless loop. No text, no logos, no watermarks. 16:9.
```

---

## B. IMAGES (ChatGPT image generation or similar)

**Check for every image:** follows the composition notes, no text, logos or numbers, realistic proportions.

**I1 — `images/hero-desktop.jpg`** · 16:9, at least 2048 wide. Shown before the 3D loads, for reduced-motion users and devices without 3D, and as the social-share background.
```text
Photorealistic architectural photograph at blue hour: the entrance of a modern premium sports pavilion seen from the paved plaza in front. Minimal warm-white concrete facade with a large open entrance framed by a thin glowing electric-lime (#D7FF3F) LED strip; through the entrance, a glossy maple basketball court glows under warm arena lights. A slim black steel canopy with linear downlights above the door. To the right, a floodlit outdoor blue basketball court with a single hoop; a basketball rests on the plaza near its sideline. Deep blue sky, warm floodlights, faint haze, wet-look polished concrete reflecting the lights. Composition: the entrance slightly right of centre; the left 45% of the frame calm and darker (space for a headline). No people, no text, no logos, no signage. 16:9.
```

**I2 — `images/hero-mobile.jpg`** · 9:16, at least 1080×1920. Same scene for phones.
```text
Same scene as the desktop hero: the entrance of a modern premium sports pavilion at blue hour, minimal warm-white concrete facade, a large open entrance outlined by a thin glowing electric-lime LED strip, glossy maple court glowing inside, polished concrete plaza reflecting the lights, a basketball resting in the foreground. Vertical composition: the glowing entrance in the upper half, the lower 45% of the frame darker plaza (space for text). No people, no text, no logos, no signage. 9:16.
```

**I3 — `images/chapter-book.jpg`** · 4:3 · BOOK chapter (reduced-motion version)
```text
Photorealistic photograph of an empty premium indoor basketball court at night, seen from courtside at low height: glossy maple hardwood, crisp white lines, glass backboard and white net in the background, warm overhead lights reflecting on the floor, dark charcoal stands. A single basketball rests on the free-throw line, waiting for the game. Calm anticipation. Composition: subject right of centre, darker left side. No people, no text, no logos. 4:3.
```

**I4 — `images/chapter-play.jpg`** · 4:3 · PLAY chapter ("Bring the squad")
```text
Photorealistic photograph of a group of five adult friends in plain unbranded sportswear (mixed charcoal and white tops) bumping fists in a huddle at centre court of a premium indoor basketball court at night, seen from a slightly low angle; faces turned away or softly out of focus, the energy coming from their hands and posture. Glossy maple floor, warm overhead lights, dark stands. Joyful, inclusive, natural. No text, no logos, no numbers, no recognisable faces. 4:3.
```

**I5 — `images/chapter-replay.jpg`** · 4:3 · REPLAY chapter
```text
Photorealistic photograph inside a premium indoor sports arena at night: a small modern dome camera mounted on a black steel roof truss high above the court, in sharp focus in the foreground, with the glossy maple court and warm lights softly out of focus below. It conveys that every game is captured. No people, no text, no logos, no brand markings on the camera. 4:3.
```

**I6 — `images/venue-kalye.jpg`** · 16:10 · demo venue "Kalye Court Hub" (indoor basketball hall)
```text
Photorealistic interior photograph of a modern premium indoor basketball hall at night in Metro Manila: one full maple hardwood court with crisp lines and glass backboards, low tiered seating along one side, warm overhead LED lighting, dark charcoal walls, faint haze. Empty and ready to play. Wide angle from a corner. No people, no text, no logos, no signage. 16:10.
```

**I7 — `images/venue-cue.jpg`** · 16:10 · demo venue "Cue & Co. Billiards Lounge"
```text
Photorealistic interior photograph of a premium modern billiards lounge at night: three 9-foot pool tables with deep green cloth in a row, each under its own long rectangular pendant lamp, dark walnut and charcoal interior, a softly lit café counter in the background, warm moody light. Empty, inviting. No people, no text, no logos, no signage. 16:10.
```

**I8 — `images/venue-rally.jpg`** · 16:10 · demo venue "Rally Point Sports Center" (multi-sport)
```text
Photorealistic interior photograph of a premium modern multi-sport centre at night, seen from an elevated walkway: green badminton courts in the foreground, a blue pickleball court and a glass-walled padel court beyond, warm overhead LED lighting, black steel roof trusses, dark charcoal surroundings. Empty and ready. No people, no text, no logos, no signage. 16:10.
```

**I9 — `images/venue-tools.jpg`** · 16:10 · "For venues" section
```text
Photorealistic photograph of the front desk of a premium modern sports venue at night: a sleek dark counter with a softly glowing tablet facing away from camera (screen not visible), a ball rack with basketballs behind it, and a glass wall looking onto a lit maple court. Warm lighting, charcoal and natural wood. Calm, organised, professional. No people, no readable screens, no text, no logos. 16:10.
```

**I10 — `images/share-bg.jpg`** · 1200×630 · social-share background (I add the wordmark and headline in code)
```text
Photorealistic close-up of a basketball resting on glossy maple hardwood at night, warm arena lights reflecting in the varnish and blurred into soft bokeh behind, a thin electric-lime court line running diagonally across the floor. The ball sits on the right third; the left two thirds are dark and calm (space for text). No text, no logos. Wide 1.91:1.
```

---

## C. HDR ENVIRONMENTS (lighting and reflections)

**Important:** image generators (including ChatGPT) cannot make true HDR files. Best options, in order:
1. **Download free CC0 HDRIs from Poly Haven** (polyhaven.com/hdris), category *indoor*: search "sports hall", "gym" or "arena", plus an *outdoor* night/blue-hour plaza. Download in **4K .hdr**.
2. **Blockade Labs Skybox AI**, then export the highest quality available.

**H1 — `hdri/arena.hdr`** (4K, 4096×2048, true HDR)
```text
360° equirectangular HDR panorama, interior of a modern indoor basketball arena at night, empty, camera at exact centre court 1.7 m high, glossy maple hardwood floor, the two baskets directly opposite each other (180° apart), rows of rectangular LED high-bay lights on a dark steel-truss ceiling, dark charcoal stands, warm 3500K lighting, true high dynamic range, no people, no logos, no text or floor markings outside the court lines, level horizon, seamless left-right edge.
```

**H2 — `hdri/exterior.hdr`** (4K, true HDR)
```text
360° equirectangular HDR panorama of an open paved plaza on the edge of a modern Asian city at blue hour: deep blue sky with a faint warm glow at the horizon, distant city lights, two tall sports floodlights on, polished concrete ground, no people, no vehicles, no logos, level horizon, seamless left-right edge, true high dynamic range.
```

---

## D. TEXTURES (base colour only — I generate the normal, roughness and AO maps)

**Specs:** square 2048×2048, **seamless tileable** on all edges, top-down orthographic view, flat even lighting, no shadows, no reflections, no perspective. JPG.

**Check:** tile it 3×3 (or ask the tool to show a 3×3 preview). No visible seams and no repeating blotches.

**Prompt template** (replace [MATERIAL] with the line from the table):
```text
Seamless tileable PBR base-colour texture, top-down orthographic view, [MATERIAL], flat even diffuse lighting, no shadows, no specular highlights, no perspective, no vignette, photoreal, 2048x2048.
```

| ID | File | [MATERIAL] | Tile = real size |
|---|---|---|---|
| T1 ⭐ | `textures/hardwood-maple.jpg` | light maple sports-floor boards, strips 57 mm wide of random length, subtle natural grain, varnished, consistent tone | 2 m |
| T2 | `textures/concrete.jpg` | charcoal polished concrete with fine aggregate and faint saw-cut joints | 4 m |
| T3 | `textures/acoustic-panel.jpg` | charcoal fabric-wrapped acoustic wall panels with thin 10 mm shadow gaps in a grid | 1.2 m |
| T4 | `textures/felt.jpg` | deep green tournament billiard cloth, very fine woven fibres | 0.5 m |
| T5 | `textures/acrylic-blue.jpg` | matte blue acrylic sport-court surface with fine sand grit | 2 m |
| T6 | `textures/plaster.jpg` | warm white painted render with very subtle trowel texture | 3 m |
| T7 | `textures/steel.jpg` | dark brushed steel with fine linear grain | 0.5 m |
| T8 | `textures/turf.jpg` | green artificial turf blades seen from above, even colour | 1 m |
| T9 | `textures/badminton-mat.jpg` | teal-green PVC sports mat with a micro-dot emboss | 1 m |

---

## E. 3D MODELS (Meshy, Tripo or Rodin; not ChatGPT)

**Specs for all:** GLB format, PBR materials, real-world scale in metres, Y-up, front facing +Z, origin at bottom centre on the floor (balls: centre). Hero items ≤ 40k triangles, others ≤ 10k. No logos or text.

**Check:** open the file in gltf-viewer.donmccurdy.com. The shape is clean, it's the right size (the hoop rim at 3.05 m), and no parts are fused or melted.

| ID | File | Prompt |
|---|---|---|
| M1 ⭐ | `models/hoop.glb` | Professional indoor basketball hoop system: tempered glass backboard 1.83×1.07 m with thin black frame and white shooter's square, orange breakaway rim at 3.05 m height, white nylon net, black padded steel stanchion and base, realistic PBR, clean topology, no logos |
| M2 | `models/basketball.glb` | Photoreal size-7 basketball, 0.24 m diameter, pebbled orange composite leather with black channel seams, light wear, PBR, no logos or text |
| M3 ⭐ | `models/billiards-table.glb` | Modern premium 9-foot pool table, dark walnut frame with brushed steel corners, green tournament cloth, leather drop pockets, squared legs, bed height 0.79 m, PBR, no logos |
| M4 | `models/billiards-balls.glb` | Set of 15 glossy resin pool balls racked in a triangle plus a white cue ball, 57 mm diameter, solid colours and stripes, no numbers, plus a wooden triangle rack |
| M5 ⭐ | `models/bleacher.glb` | Modular arena bleacher section 4 m wide: 4 tiered rows of charcoal moulded seats with brushed steel handrails and an aisle on one side, designed to repeat seamlessly side by side, PBR |
| M6 | `models/bench.glb` | Modern courtside team bench 3 m long, charcoal seat and backrest, brushed steel frame, PBR |
| M7 | `models/light-fixture.glb` | Rectangular LED high-bay arena light, 1.2×0.35 m, dark aluminium housing with cooling fins, separate flat emissive panel underneath, PBR |
| M8 ⭐ | `models/scoreboard.glb` | Centre-hung four-sided arena scoreboard cube, about 4 m wide, black frame with four large blank LED screens (separate screen meshes) and lime LED trim rings top and bottom, hanging cables, PBR |
| M9 | `models/volleyball-net.glb` | Indoor volleyball net system: two padded posts and a 9.5 m net with white top tape, net top at 2.43 m, black mesh, PBR |
| M10 | `models/padel-wall.glb` | Padel court wall module 2 m wide and 3 m tall: tempered glass panel in a black steel frame with a black mesh section above, designed to repeat, PBR |
| M11 | `models/futsal-goal.glb` | Futsal goal 3×2 m, white powder-coated frame with white net, PBR |
| M12 | `models/venue-camera.glb` | Small modern ceiling-mounted dome security camera with mounting arm, matte black and grey, no logos, about 0.25 m tall, PBR |

---

## F. What I (Claude) will do with these — no generation needed

- **Highlights section:** replace the drawn animation with a real video player (V1–V3) with poster frames, play/pause, the clip timeline and true durations. Videos only load when someone presses play.
- **REPLAY gallery and video walls:** show V1–V10 as silent loops, played only while on screen. V11 plays on the giant screen-gate.
- **Hero:** I1/I2 as the instant first view and as the fallback for reduced motion and devices without 3D.
- **Reduced-motion story:** I3–I5 replace the illustrations in BOOK, PLAY and REPLAY.
- **Venue cards and "For venues":** I6–I9.
- **Social share image:** I10 plus the Playbook wordmark and headline, so links shared on Messenger, Facebook or Viber show a proper preview.
- **Lighting:** H1/H2 replace the synthetic HDRIs (better reflections on the floor, letters and screens).
- **Materials:** from T1–T9 I generate normal, roughness and AO maps, then optimize for web.
- **3D:** M1–M12 replace the placeholder shapes. M8 becomes a centre-hung scoreboard over the PLAY court showing booking demo content; M12 cameras are mounted on the trusses above the courts to support the "your game is recorded" story.
- **My own polish:** the brand font (Barlow Condensed) in the 3D BOOK / PLAY / REPLAY / PLAYBOOK letters; every AI asset labelled "Illustrative" or "Demo clip — AI-generated".

---

## Priority (if you only make some)

| Priority | Items | Why |
|---|---|---|
| **P1** | V1, V2, V3 · I1, I2 · H1 · T1 | Highlights section, first impression, arena lighting, the floor you see everywhere |
| **P2** | V4–V11 · I6–I8 · M1, M5, M8 | Moving gallery screens, venue cards, hero 3D objects |
| **P3** | I3–I5, I9, I10 · H2 · T2–T9 · M2–M4, M6, M7, M9–M12 | Richness and polish |

Upload whatever is ready to the Drive folder, in the subfolders above, and send me the link. I'll check each file, optimize it, wire it in and deploy, batch by batch.
