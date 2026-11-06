# PLAYBOOK — 3D & Media Asset Specification

Everything needed to take the 3D journey from "clean blockout" to "photoreal sports world".
Each asset has: **file name → where it goes → exact specs → generation prompt → negative prompt → acceptance check.**
Hand any section to another AI as-is.

> **Today the scene uses no asset files.** Every shape is code-built (`src/components/three/World.tsx`),
> textures are drawn at runtime (`textures.ts`), and the 3D letters use Three.js's bundled font.
> This spec defines the real files that replace them.

---

## 0. Global rules (apply to EVERY asset)

### 0.1 Art direction
- **Look:** premium, cinematic, Apple-clean sports architecture. Think new-build private sports club at night, not a school gym.
- **Palette:** natural materials (maple hardwood, felt, turf, sand, concrete, glass, brushed steel) + deep charcoal surroundings `#101713` + **one** accent: electric lime `#D7FF3F` (court lines, LED strips). Orange `#FF7648` only for tiny details (rim, ball).
- **Lighting mood:** warm overhead arena light (≈3200–4000 K) pooling on the floor, darker edges, gentle haze. Exterior: blue hour (≈7000 K sky) with warm floodlights.
- **Never:** brand logos, sponsor marks, real team names, readable random text, watermarks, people's faces (except in clearly-labelled demo video), neon overload, gaming/sci-fi look, cartoon style.

### 0.2 3D model rules (.glb)
| Rule | Value |
|---|---|
| Format | **glTF 2.0 binary `.glb`**, single file, textures embedded |
| Units | **1 unit = 1 metre**, real-world scale (see sizes per asset) |
| Axes | **Y-up**, model **faces +Z** (front of hoop board, front of scoreboard, etc.) |
| Pivot / origin | **Bottom-centre on the floor (y = 0)** unless stated (balls: centre of sphere) |
| Transforms | Applied/frozen (scale 1,1,1, rotation 0) |
| Materials | **PBR metallic-roughness** only. Base colour, normal, ORM (Occlusion-Roughness-Metallic packed R/G/B). No custom shaders, no vertex-colour-only models |
| Texture size | 2048² hero items, 1024² props, 512² small props. Power of two. |
| Triangle budget | Hero ≤ 40k · Medium ≤ 15k · Small props ≤ 5k |
| File size | Hero ≤ 3 MB · Medium ≤ 1.5 MB · Small ≤ 500 KB (before Draco/Meshopt) |
| Topology | Clean, closed, no flipped normals, no internal faces, no stray vertices |
| UVs | Non-overlapping UV0 for baked AO/details; tiling allowed for large surfaces |
| Naming | `snake_case`, meaningful mesh names (`rim`, `net`, `backboard_glass`) |
| Transparency | Glass/net use alpha (`alphaMode: BLEND` for glass, `MASK` for net) as separate meshes |
| Animation | None (we animate in code) |
| LODs (optional bonus) | `_lod1.glb` at ~30% tris for mobile |

### 0.3 Texture rules (surface materials)
| Rule | Value |
|---|---|
| Format | `.jpg` (colour) / `.png` (normal, ORM) — we convert to `.ktx2`/`.webp` |
| Size | **2048 × 2048**, seamless tiling on both axes |
| Set per material | `_basecolor` (sRGB), `_normal` (OpenGL, Y+), `_roughness`, `_ao`, `_height` (optional), `_metallic` only if metal |
| Capture | Top-down orthographic, **no perspective, no shadows, no highlights baked in**, even flat light |
| Real size | State the real-world size the tile represents (e.g. "tile = 2 m × 2 m") |

### 0.4 HDRI rules
- `.hdr` (Radiance) or `.exr`, **equirectangular 2:1**, 4096×2048 master + 2048×1024 web copy.
- True high dynamic range (light sources ≥ 10 stops brighter than walls). An LDR "panorama JPEG" is **not** usable.
- No people, no logos. Horizon level.

### 0.5 Video rules (screen content)
- `.mp4` (H.264, yuv420p) **and** `.webm` (VP9). **Silent** (no audio track).
- 1280×720, 24 or 30 fps, **5–8 s seamless loop**, ≤ 2.5 MB each.
- Label in file name: `demo_` prefix. These are illustrative, never presented as real venue footage.
- Also export a **poster frame** `.jpg` (1280×720) for each.

### 0.6 Folder structure (drop files exactly here)
```
public/assets/
  models/         *.glb
  textures/       <material>/<material>_basecolor.jpg, _normal.png, _roughness.jpg, _ao.jpg
  hdri/           arena_evening_2k.hdr, exterior_bluehour_2k.hdr
  video/          demo_*.mp4, demo_*.webm, demo_*_poster.jpg
  decals/         *.png (transparent)
  fx/             *.png (transparent)
```

### 0.7 Licensing (required)
For every file record **source / tool / licence** in `public/assets/CREDITS.md`.
Acceptable: self-generated with commercial rights, CC0 (Poly Haven, ambientCG), purchased commercial licence.
Not acceptable: ripped game assets, branded products, unlicensed Sketchfab downloads.

---

## 1. Lighting & environment (biggest realism gain — do these first)

### 1.1 `hdri/arena_evening_2k.hdr` ⭐ PRIORITY 1
- **Used for:** reflections and ambient light inside the arena (hardwood sheen, ball, glass, metal).
- **Spec:** Interior of a large modern indoor basketball arena, camera at 1.7 m in the centre of the court. Rows of rectangular LED high-bay lights on a dark ceiling, dark stands, warm 3500 K light, glossy floor.
- **Prompt (HDRI-capable tool, or photograph with bracketed exposures):**
  > 360° equirectangular HDR panorama, interior of a modern indoor basketball arena at night, empty, camera at centre court 1.7 m high, glossy maple hardwood floor, rows of rectangular LED high-bay ceiling lights, dark charcoal ceiling and stands, warm 3500K lighting, high dynamic range, no people, no logos, no text, level horizon
- **Negative:** people, logos, banners, text, fisheye distortion, stitching seams, blown-out walls, cartoon
- **Accept if:** seamless at the left/right edge; lights clearly brightest; walls not grey-washed.
- **CC0 fallback:** Poly Haven indoor sports hall / gym HDRIs.

### 1.2 `hdri/exterior_bluehour_2k.hdr` ⭐ PRIORITY 1
- **Used for:** the opening courtside scene (outside the pavilion).
- **Prompt:**
  > 360° equirectangular HDR panorama, open paved plaza on the edge of a modern Asian city at blue hour, deep blue sky with faint warm glow at the horizon, distant city lights, two tall sports floodlights on, no people, no vehicles, no logos, level horizon, high dynamic range
- **Negative:** people, cars, signage text, moon, heavy clouds, fisheye, seams

---

## 2. Surface textures (tileable PBR sets)

Each set: `basecolor`, `normal`, `roughness`, `ao` (+ `height` optional). Paths: `public/assets/textures/<name>/<name>_<map>.<ext>`.

| # | Folder name | Real tile size | Look | Roughness target |
|---|---|---|---|---|
| 2.1 ⭐ | `hardwood_maple` | 2 m × 2 m | Light maple sports floor, strips **57 mm wide**, random lengths 0.6–2.4 m, subtle grain, high-gloss polyurethane | 0.15–0.25 (glossy) |
| 2.2 | `court_acrylic_blue` | 2 m × 2 m | Outdoor acrylic hard court, matte blue `#24557D`, fine sand-grit texture | 0.75 |
| 2.3 | `court_acrylic_green` | 2 m × 2 m | Same, green `#2F6B40` surround | 0.75 |
| 2.4 | `concrete_polished` | 4 m × 4 m | Exterior plaza, charcoal polished concrete, faint saw-cut joints every 2 m, light aggregate | 0.55 |
| 2.5 | `felt_billiards` | 0.5 m × 0.5 m | Tournament cloth, deep green `#1F6B45`, very fine weave | 0.9 |
| 2.6 | `turf_artificial` | 2 m × 2 m | Futsal turf, green blades 20 mm, alternating mow stripes 1 m wide | 0.85 |
| 2.7 | `sand_beach` | 2 m × 2 m | Fine pale volleyball sand, raked, footprints soft | 0.95 |
| 2.8 | `mat_badminton` | 1 m × 1 m | PVC sports mat, teal-green `#1A5246`, micro-dot emboss | 0.6 |
| 2.9 | `wall_plaster_white` | 3 m × 3 m | Warm white painted render, very subtle trowel texture | 0.85 |
| 2.10 | `panel_acoustic_dark` | 1.2 m × 1.2 m | Charcoal fabric-wrapped acoustic panels with 10 mm shadow gaps | 0.95 |
| 2.11 | `metal_brushed` | 0.5 m × 0.5 m | Brushed dark steel, linear grain | 0.35, metallic 1 |
| 2.12 | `wood_dark_walnut` | 1 m × 1 m | Billiards table frame / benches | 0.4 |
| 2.13 | `rubber_track` | 2 m × 2 m | Dark rubber flooring for side zones and bleacher walkways | 0.8 |

**Texture prompt template** (swap the bracketed part):
> Seamless tileable PBR texture, top-down orthographic view, [light maple hardwood sports floor, 57mm strips of random length, high-gloss varnish, subtle grain], flat even lighting, no shadows, no reflections, no perspective, 2048x2048, photoreal
- **Negative:** perspective, vignette, lighting gradient, visible seams, text, logos, objects, people
- **Accept if:** tiled 3×3 shows no visible repeat seams; no baked highlights.
- **CC0 fallback:** ambientCG / Poly Haven texture library.

---

## 3. 3D models

Sizes below are **real dimensions** (regulation where applicable). Pivot = bottom centre unless noted.

### 3.1 ⭐ `models/hoop_arena.glb` — Basketball hoop (HERO)
- **Used:** 2 on the main court (PLAY chapter), 1 on the outdoor court (opening).
- **Dimensions:** rim height **3.05 m**; rim inner diameter **0.457 m**; backboard **1.83 × 1.07 m**, 13 mm tempered glass with black/white border and inner shooter's square 0.59 × 0.45 m; rim to board 0.15 m; padded base/stanchion offset 1.2 m behind board.
- **Parts (separate meshes):** `base_pad`, `stanchion`, `arm`, `backboard_glass` (alpha), `backboard_frame`, `shooter_square`, `rim` (orange `#E2542B` powder-coat), `net` (white nylon, alpha-mask, 12 loops), `padding_board_bottom`.
- **Tris:** ≤ 40k · **Textures:** 2048.
- **Faces:** +Z (the playing side).
- **Prompt (3D generator):**
  > Realistic professional indoor basketball hoop system, tempered glass backboard with thin black frame and white shooter's square, orange breakaway rim, white nylon net, black padded steel stanchion and base, regulation size, PBR materials, clean topology, no logos, no text
- **Negative:** logos, brand names, cartoon, broken net, low-poly, fused parts
- **Accept if:** rim at 3.05 m when placed on y=0; glass is a separate transparent mesh.

### 3.2 ⭐ `models/basketball.glb`
- **Size:** diameter **0.24 m** (size 7). Pivot = sphere centre.
- **Material:** pebbled composite leather, orange-brown `#C8642A`, black 8-panel seams (grooved in normal map), slight wear.
- **Tris:** ≤ 5k · 2048 textures (the ball is seen up close in the opening).
- **Prompt:** *"Photoreal basketball, size 7, pebbled orange composite leather, deep black channel seams, light scuffing, PBR, no logos, no text"*

### 3.3 ⭐ `models/billiards_table.glb`
- **Size:** 9-ft table. Playing surface **2.54 × 1.27 m**; outer ≈ 2.84 × 1.57 m; bed height **0.79 m**.
- **Parts:** `frame` (walnut + brushed metal corners), `cushion_rails`, `felt` (green), `pockets` ×6 (leather/net), `legs` (4 or 6, squared modern), `diamond_sights`.
- **Tris:** ≤ 30k · 2048.
- Plus **`models/billiards_balls_rack.glb`**: 15 balls in a triangle + cue ball, Ø **57.2 mm**, glossy resin, numbers *plain circles only* (no printed text required), separate triangle rack (wood).
- Plus **`models/billiards_cue.glb`**: length **1.47 m**, maple shaft, dark butt wrap. Pivot at tip.
- **Prompt:** *"Modern premium 9-foot pool table, dark walnut frame with brushed steel corner caps, tournament green cloth, leather drop pockets, squared legs, realistic PBR, no logos"*

### 3.4 `models/billiards_lamp.glb`
- Long linear pendant, **2.1 × 0.35 × 0.12 m**, black metal housing, warm diffuser bottom (emissive map, 3000 K), hanging rods 1.2 m. Pivot at **top** (ceiling point).

### 3.5 `models/volleyball_net_system.glb` + `models/volleyball.glb`
- Net width **9.5 m** span between posts, net height top **2.43 m**, net band 1 m tall, white top tape, black mesh 10 cm squares (alpha-mask), padded posts, antennae red/white 1.8 m.
- Ball: Ø **0.21 m**, three-colour panels (white / blue / yellow), no text.

### 3.6 `models/badminton_set.glb`
- **Net + posts:** posts 1.55 m, net centre 1.524 m, width 6.1 m, white top tape, fine black mesh (alpha).
- **Racket:** 0.675 m long, carbon frame, white strings; **Shuttlecock:** feather, 16 feathers, cork base, ~85 mm tall. Export racket and shuttle as separate nodes.

### 3.7 `models/pickleball_set.glb`
- **Net:** 6.7 m wide, **0.914 m** at posts, **0.86 m** at centre, centre strap.
- **Paddle:** 0.40 × 0.20 m, textured carbon face (lime `#D7FF3F` edge guard allowed), grip 13 cm.
- **Ball:** Ø **74 mm**, yellow, **40 round holes** (real geometry or normal + alpha).

### 3.8 `models/table_tennis_table.glb`
- **2.74 × 1.525 m**, top **0.76 m** high, matte blue top with white 20 mm edge lines + 3 mm centre line, net **15.25 cm** high with clamps, folding modern legs.
- Plus **paddles** (red/black rubber, 0.26 m) and **ball** (Ø 40 mm, white).

### 3.9 `models/futsal_goal.glb` + `models/futsal_ball.glb`
- Goal: **3 × 2 m** opening, depth 0.8 m, white powder-coated frame, net alpha-mask.
- Ball: size 4, Ø **0.20 m**, white with dark panels, low-bounce matte.

### 3.10 `models/padel_wall_module.glb` + `models/padel_racket.glb`
- Wall module: **2 m wide × 3 m tall** tempered glass panel in a black steel frame + 1 m black mesh fence extension on top (so it can be repeated to build the 20 × 10 m enclosure).
- Racket: **0.455 m**, solid perforated face (≈ 50 holes), carbon, lime accent allowed, no logos.

### 3.11 `models/tennis_set.glb`
- Racket 0.685 m, ball Ø **67 mm** optic yellow with white seam (fuzz via normal/roughness). Optional net 12.8 m wide, 0.914 m centre.

### 3.12 `models/sepak_takraw_ball.glb`
- Ø **0.14 m**, woven synthetic rattan (12 holes, 20 intersections), cream/natural colour. Woven geometry or very strong normal map.

### 3.13 ⭐ `models/arena_light_highbay.glb`
- Rectangular LED high-bay, **1.2 × 0.35 × 0.08 m**, dark housing, emissive panel (separate mesh named `emitter` so we can drive brightness). We instance ~40 of them.
- ≤ 1k tris.

### 3.14 `models/floodlight_pole.glb`
- 12 m tapered steel pole, 4-head LED floodlight bank at the top (emitter mesh), base plate. Pivot at base.

### 3.15 ⭐ `models/bleacher_module.glb`
- Telescopic bleacher section **4 m wide**, 4 rows, row rise 0.3 m, depth 0.8 m per row, charcoal seats + brushed rails, aisle on one side. Must tile seamlessly side-by-side (we repeat it ~40×).
- ≤ 8k tris.

### 3.16 `models/scoreboard_wall.glb`
- **4 × 1.6 m** dark wall-mounted board, black LED field as a separate `screen` mesh with UVs 0–1 (we play video/canvas on it), slim lime trim.

### 3.17 `models/pavilion_facade.glb` (optional — can stay code-built)
- Front façade **50 m wide × 13 m tall**, entrance opening **8 × 6.2 m**, white board-formed concrete, black steel canopy 22 × 5 m at 8.6 m height with linear downlights, glazing either side of the entrance. Opening must be **empty** (camera flies through).

### 3.18 Small props pack (each ≤ 3k tris, separate `.glb`)
| File | Real size | Notes |
|---|---|---|
| `ball_rack.glb` | 1.2 × 0.5 × 0.9 m | holds 6 basketballs (balls included) |
| `team_bench.glb` | 3 m long | charcoal seat, steel legs |
| `water_cooler.glb` | 0.35 × 0.35 × 1.1 m | white/grey |
| `gym_bag.glb` | 0.6 m | black, lime zip pull |
| `cones.glb` | 0.23 m tall | set of 4, orange |
| `towel_folded.glb` | 0.3 m | white |
| `shot_clock.glb` | 0.6 × 0.4 m on 0.2 m bracket | mounts on hoop, red LED digits blank |
| `planter.glb` | 0.8 m cube | exterior, dark concrete + grasses |

---

## 4. Screen & gallery video (REPLAY chapter, highlights section)

All `public/assets/video/`, demo-labelled, silent loops, 1280×720, 5–8 s, + poster `.jpg`.

| # | File | Shot description (prompt) |
|---|---|---|
| 4.1 ⭐ | `demo_basketball_fastbreak` | Indoor maple court at night, broadcast high-side angle, amateur adults in plain unbranded jerseys run a fast break ending in a layup, smooth camera pan, warm arena light, shallow depth of field, cinematic |
| 4.2 ⭐ | `demo_padel_rally` | Glass-walled indoor padel court, back-wall rebound rally, wide elevated angle, players in plain sportswear, cool white light |
| 4.3 ⭐ | `demo_billiards_bank` | Overhead locked-off shot of a green pool table under a pendant lamp, cue strikes, ball banks off a cushion into the corner pocket |
| 4.4 | `demo_futsal_goal` | Floodlit outdoor turf futsal pitch at dusk, through ball and low finish into a small goal, side angle |
| 4.5 | `demo_pickleball_kitchen` | Indoor blue pickleball court, doubles dinking at the kitchen line, low angle near the net |
| 4.6 | `demo_badminton_smash` | Indoor badminton court, jump smash in slow motion, side angle, green mat |
| 4.7 | `demo_volleyball_spike` | Indoor volleyball spike over the net, low angle, warm light |
| 4.8 | `demo_arena_ambient` | Empty modern arena, slow dolly across the court, lights humming on, dust in light beams — for background screens |

**Video prompt suffix (append to every shot):**
> silent, seamless 6-second loop, 1280x720, photoreal, natural motion, unbranded plain sportswear, no logos, no text, no watermark, no faces in close-up
- **Negative:** logos, jersey numbers of real teams, text overlays, slow-mo artefacts, morphing limbs, extra fingers, flicker
- **Accept if:** loop point invisible; no warped bodies or balls; nothing branded.

---

## 5. Decals & FX (transparent PNG)

| File | Size | Use |
|---|---|---|
| `decals/centre_circle_logo.png` | 2048² | Playbook play-diagram mark painted on centre court (lime + white, 70% opacity look) |
| `decals/court_lines_basketball.png` | 4096 × 2048 | Full FIBA court markings, white 50 mm lines, transparent background, for exact line work |
| `decals/kitchen_lines_pickleball.png` | 2048 × 1024 | Pickleball markings |
| `decals/scuff_marks.png` | 2048² | Subtle shoe scuffs to break up the perfect floor (alpha 10–25%) |
| `fx/light_beam.png` | 512 × 2048 | Soft vertical god-ray gradient for arena light shafts |
| `fx/dust_particles.png` | 512² | Sparse bokeh dust sprite |
| `fx/lens_dirt.png` | 2048 × 1024 | Very subtle lens dirt for bloom (optional) |

Decals: **pure white/lime on transparent**, no anti-aliasing halo, 300 dpi equivalent sharpness.

---

## 6. Typography (3D letters)

Current letters use Three.js's Helvetiker Bold. To match the brand font in 3D:

| File | How |
|---|---|
| `fonts/barlow_condensed_extrabold.typeface.json` | Convert Barlow Condensed ExtraBold (OFL licence, Google Fonts) with the facetype.js converter, characters `A–Z 0–9 . ·` only |

Optional bonus: **pre-modelled hero words** `book.glb`, `play.glb` (each letter a separate node: `P`,`L`,`A`,`Y`), `replay.glb`, `playbook.glb`:
- Height **6.5 m** (BOOK), **7.3 m** (PLAY), extrude depth 1.6 m, 3 cm bevel.
- Material slots: `face` (satin off-white `#F5F7F0`), `side` (lime `#B9E21F`, satin).
- Hollow letter counters (the O's) must be **open holes**: the camera flies through BOOK's second O.

---

## 7. What happens in code once files arrive (for reference)

1. HDRI → `scene.environment` (PMREM), exposure retune.
2. Shadows: one shadow-casting key light per zone (baked AO from models + contact shadows).
3. Hardwood: `MeshPhysicalMaterial` with clearcoat + planar/SSR-style reflection on the court.
4. Post-processing (desktop only): subtle bloom on emissives, SMAA, light vignette. Mobile stays lightweight.
5. Compression: `gltf-transform optimize --compress meshopt --texture-compress ktx2`, textures to KTX2/WebP, lazy-load per chapter, mobile LODs.
6. Video screens: `VideoTexture`, play only when on screen, muted, `playsinline`, poster first.

Performance budget after upgrade: **≤ 12 MB total 3D payload on desktop, ≤ 5 MB on mobile**, loaded progressively by chapter; first paint unaffected.

---

## 8. Priority order (if you only do some)

| Priority | Assets | Why |
|---|---|---|
| **P1 — biggest jump** | 1.1, 1.2 HDRIs · 2.1 hardwood · 2.4 concrete · 3.1 hoop · 3.2 basketball · 3.13 high-bay light · 3.15 bleacher | Lighting, floor and the hero objects you see most |
| **P2** | 3.3 billiards set · 3.4 lamp · 4.1–4.3 videos · 5 decals · 3.16 scoreboard | PLAY + REPLAY chapters look real |
| **P3** | Other sports sets 3.5–3.12 · textures 2.2–2.13 · props 3.18 · fonts/letters 6 | Richness and brand-matching type |
| **P4** | 3.17 façade · 4.4–4.8 videos · FX | Final polish |

---

## 9. Delivery checklist (tick before handing over)

- [ ] Files named exactly as above and placed in `public/assets/...`
- [ ] `.glb` opens in https://gltf-viewer.donmccurdy.com with no errors; scale correct (hoop rim 3.05 m)
- [ ] Y-up, faces +Z, pivot at base, transforms applied
- [ ] Triangle and file-size budgets met
- [ ] Textures tile seamlessly 3×3; normal maps are OpenGL (Y+)
- [ ] HDRIs are true HDR `.hdr/.exr`, seamless, level
- [ ] Videos silent, looping, ≤ 2.5 MB, posters included, `demo_` prefix
- [ ] No logos, brands, real teams, or readable stray text anywhere
- [ ] `public/assets/CREDITS.md` lists source, tool and licence for every file
