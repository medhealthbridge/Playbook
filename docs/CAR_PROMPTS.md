# Car image prompts (for the car park)

Goal: clean reference pictures of two generic Philippine-market cars, a compact
sedan and a 7-seat SUV, that an image-to-3D tool (Meshy, Tripo, Rodin, Luma
Genie, Higgsfield 3D) can turn into `.glb` models. The pictures need a clean
background, even light and no perspective tricks, and the same car must appear
in every view.

## How to use these

1. Generate the **hero view** (3/4 front) first. Pick the best result.
2. Use that picture as the **image reference / character reference** (Midjourney
   `--cref` or `--sref`, Leonardo "Image Guidance", Firefly "Reference",
   Ideogram "Remix") and keep the same **seed**, then generate the other views.
3. Feed the set into an image-to-3D tool that accepts several views. If it takes
   only one image, use the hero view.
4. Export `.glb` with the settings at the end, put it in `public/assets/models/`
   and tell me. It replaces the code-built car.

Aspect ratio for every view: **3:2 landscape** (e.g. 1536 x 1024 or larger).

---

## 1. Compact sedan — hero view (3/4 front)

```
Photorealistic studio product photograph of a modern compact four-door sedan,
a generic unbadged design in the size class of a Philippine city car
(4.40 m long, 1.73 m wide, 1.47 m tall, 2.55 m wheelbase).

Body: smooth flowing silhouette, short sloping hood, steeply raked windshield,
gently arched roofline flowing into a short fastback-style trunk, a crisp
shoulder line running from the headlights to the tail lights, subtle
lower door sculpting, slim body-coloured side mirrors with integrated turn
signals, flush body-coloured door handles, black B-pillars, thin chrome strip
along the bottom of the side windows.

Front: slim swept-back LED headlights with a thin daytime running light strip,
a wide gloss-black trapezoid grille with fine horizontal slats, a lower
bumper intake with a black mesh insert, small round fog lamps in black
surrounds, no badge or logo anywhere.

Wheels: 16-inch five-double-spoke machined alloy wheels with dark grey
pockets, 195/55 R16 black tyres with visible sidewall, wheels pointing
straight ahead, tyres sitting flat on the ground with a small contact patch.

Glass: dark smoke-tinted windows with a faint reflection of a softbox,
interior barely visible (headrests and steering wheel silhouette only).

Paint: pearl white with a soft metallic flake and a deep glossy clear coat,
clean reflections of large studio softboxes running along the doors and hood.

Camera: three-quarter front view from the driver's-side front corner, camera
at 1.2 m height, 35 degrees off the car's centre line, 50 mm lens,
no wide-angle distortion, the whole car in frame with a 10 percent margin
on all sides, car centred, level horizon.

Lighting and background: seamless plain light grey studio background
(#d9d9d9), large overhead softbox plus two side softboxes, soft even light,
a single soft contact shadow directly under the car only, no reflections
on the floor, no other objects.

Style: ultra realistic automotive photography, sharp focus front to back,
true-to-life proportions, 8k detail.
```

**Negative prompt** (paste into the "avoid" / negative field where the tool has one):

```
logo, badge, emblem, brand name, licence plate text, number plate characters,
watermark, text, people, driver, hands, motion blur, wide-angle distortion,
fisheye, low angle, dramatic shadows, coloured background, street, road,
landscape, sky, reflections of buildings, open doors, damaged car,
dirt, rust, stickers, cartoon, toy, low poly, blocky, clay render,
extra wheels, missing wheels, warped wheels, asymmetric body, cropped car
```

## 2. Compact sedan — other views (same car)

Use the hero picture as the reference and the same seed. Replace the **Camera**
paragraph of the hero prompt with one of these each time:

| View | Camera paragraph |
|---|---|
| 3/4 rear | three-quarter rear view from the passenger-side rear corner, camera at 1.2 m height, 35 degrees off the centre line, 50 mm lens, whole car in frame with a 10 percent margin |
| Side (profile) | exact side profile of the driver's side, camera at 0.9 m height, perpendicular to the car, 85 mm lens, no perspective, both wheels perfectly round, whole car in frame |
| Front | straight-on front view, camera at 0.9 m height on the car's centre line, 85 mm lens, perfectly symmetrical |
| Rear | straight-on rear view, camera at 0.9 m height on the centre line, 85 mm lens, perfectly symmetrical; slim LED tail lights joined by a thin gloss-black strip, rear bumper with a black lower diffuser |
| Top | straight-down top view from directly above, orthographic look, car pointing up the frame, roof, hood and trunk clearly visible |

Colour variants: swap "pearl white" for **deep metallic red**, **dark navy
blue metallic**, **silver metallic** or **solid black** to get four cars from
one model (or keep white and I tint the paint in code).

---

## 3. Seven-seat SUV — hero view (3/4 front)

```
Photorealistic studio product photograph of a modern mid-size seven-seat SUV,
a generic unbadged design in the size class of a Philippine family SUV
(4.80 m long, 1.86 m wide, 1.83 m tall, 2.75 m wheelbase, 22 cm ground clearance).

Body: tall upright confident stance, long flat hood with two subtle
power bulges, upright windshield, long flat roof with black roof rails,
squared-off rear with a near-vertical tailgate, strong shoulder line,
squared black plastic wheel-arch cladding, black lower door cladding,
silver front and rear skid plates, chrome window surround, black pillars,
body-coloured side mirrors on black bases, side steps under the doors.

Front: large upright gloss-black grille with a thick chrome frame and
horizontal bars, slim angular LED headlights joined to the grille,
vertical LED fog lamps in the bumper corners, silver skid plate,
no badge or logo anywhere.

Wheels: 18-inch six-spoke two-tone alloy wheels (machined face, black pockets),
265/60 R18 all-terrain tyres with a chunky tread, wheels pointing straight
ahead, tyres sitting flat on the ground with a visible contact patch.

Glass: dark privacy-tinted rear windows, lighter tinted front windows,
faint softbox reflections, interior barely visible.

Paint: charcoal grey metallic with a fine flake and a deep glossy clear coat,
long clean softbox reflections along the doors and hood.

Camera: three-quarter front view from the driver's-side front corner, camera
at 1.3 m height, 35 degrees off the car's centre line, 50 mm lens,
no wide-angle distortion, the whole vehicle in frame with a 10 percent margin
on all sides, centred, level horizon.

Lighting and background: seamless plain light grey studio background
(#d9d9d9), large overhead softbox plus two side softboxes, soft even light,
a single soft contact shadow directly under the vehicle only, no floor
reflections, no other objects.

Style: ultra realistic automotive photography, sharp focus front to back,
true-to-life proportions, 8k detail.
```

Use the **same negative prompt** as the sedan. For the other views, use the
same camera table as the sedan (for the rear view, describe it as: "wide
horizontal LED tail lights, tailgate with a chrome garnish, black rear bumper
with a silver skid plate, rear wiper"). Colour variants: **pearl white**,
**maroon metallic**, **silver metallic**, **black**.

---

## 4. Optional: pick-up and hatchback (more variety in the lot)

Pick-up, swap the first two paragraphs of the SUV prompt for:

```
Photorealistic studio product photograph of a modern four-door double-cab
pick-up truck, a generic unbadged design (5.30 m long, 1.86 m wide, 1.81 m tall),
muscular upright front, large chrome-framed grille, flared wheel arches,
open cargo bed with a black bed liner and a chrome sports bar behind the cab,
side steps, 17-inch alloy wheels with all-terrain tyres. Paint: white.
```

Hatchback, swap them for:

```
Photorealistic studio product photograph of a modern five-door compact
hatchback, a generic unbadged design (3.99 m long, 1.70 m wide, 1.50 m tall),
short overhangs, rounded friendly front with slim headlights, roof spoiler,
steeply raked rear hatch, 15-inch alloy wheels. Paint: bright metallic orange.
```

---

## 5. Settings for the 3D tool (so it fits straight in)

| Setting | Value |
|---|---|
| Output | glTF binary `.glb`, textures embedded |
| Size | real size in metres (sedan 4.40 m long; SUV 4.80 m) |
| Orientation | Y up, **nose pointing +X**, tyres touching y = 0 |
| Triangles | 15,000 to 25,000 per car |
| Textures | PBR, 2048 x 2048 maximum |
| Material names | `Paint`, `Glass`, `Tyre`, `Rim`, `Headlight`, `Taillight` (the lamps glow at night, the paint can be recoloured) |
| Wheels | separate objects if the tool allows it |

File names: `public/assets/models/car_sedan.glb`, `car_suv.glb`
(and `car_pickup.glb`, `car_hatch.glb` if you make them).
