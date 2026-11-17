# 3D asset prompts

The objects in the homepage 3D scene (cars, trees, stalls, tables, benches, seats)
are built in code from boxes, cylinders and spheres. No image generator was used,
which is why they look blocky. Use these prompts to make better versions elsewhere.

## Picture or 3D model?

- An **image generator** (Midjourney, DALL·E, Ideogram, Higgsfield…) gives a flat
  picture. It can't replace an object in the 3D scene by itself.
- To swap an object, you need a **3D model file (.glb)**. Text-to-3D and
  image-to-3D tools (Meshy, Tripo, Rodin, Luma Genie) make these.
- Best route: make a clean reference picture with an image generator, then feed
  it to an image-to-3D tool.

## Reference picture style (add to every prompt)

```
single object, centred, three-quarter front view from slightly above,
plain light grey studio background, soft even lighting, no shadow on the background,
realistic materials, clean modern design, no text, no logos, no people,
whole object in frame with margin, sharp focus, 4k
```

## 3D model requirements (for the 3D tool and whoever adds it)

| Item | Requirement |
|---|---|
| Format | glTF binary `.glb`, textures embedded |
| Scale | Real size in metres (1 unit = 1 m) |
| Orientation | Y up; the object's front faces +Z |
| Pivot | Centre of the base, on the floor (y = 0) |
| Size | Under 15,000 triangles (cars and stalls), under 5,000 for small props |
| Textures | 1024 × 1024 max, PBR (base colour, normal, roughness/metal) |
| Style | Realistic but clean; avoid tiny details that shimmer when small on screen |

## Prompts

### Sedan (car park) — short version; full prompts in `docs/CAR_PROMPTS.md`
```
Modern compact 4-door sedan, Philippine city car similar in size to a Toyota Vios,
smooth rounded body, tinted windows, alloy wheels, headlights and tail lights,
glossy paint in [pearl white / deep red / navy blue / yellow], 4.3 m long, 1.7 m wide
```

### SUV (car park)
```
Modern mid-size 7-seat SUV, Philippine family car similar in size to a Toyota Fortuner,
boxy confident body, roof rails, black plastic wheel arches, tinted windows,
paint in [charcoal grey / maroon], 4.8 m long, 1.85 m wide
```

### Food stall: Tusok-Tusok
```
Small Filipino street food cart stall, steel frame with a striped red-and-cream awning,
wooden counter front with a stainless steel top, a deep fryer pot, trays of fishballs
and orange kwek-kwek, skewers in a cup, sauce jars, a string of warm bulbs under the awning,
blank sign board on top, 3 m wide, 1.5 m deep, 3.4 m tall
```

### Food stall: Fresh Buko
```
Small Filipino drinks stall, steel frame with a striped green-and-cream awning,
wooden counter, a pile of green young coconuts, a glass dispenser of buko juice,
halo-halo cups, blank sign board on top, 3 m wide, 1.5 m deep, 3.4 m tall
```

### Shade tree
```
Tropical shade tree for a city plaza, like a narra or acacia, straight trunk,
wide rounded leafy crown, lush green leaves, small square tree pit with mulch at the base,
6 m tall, crown 5 m across
```

### Planter
```
Modern round concrete planter, dark charcoal finish, filled with tropical plants:
snake plant, small palm and trailing greenery, 1.4 m wide, 1.6 m tall including plants
```

### Pool table
```
Professional 9-foot pool table, dark walnut wood with turned legs, green felt cloth,
brass diamond sights on the rails, leather pocket baskets, 15 balls racked in a triangle
and a white cue ball, 2.8 m long, 1.55 m wide, 0.8 m tall
```

### Table tennis table
```
Indoor competition table tennis table, blue top with white edge and centre lines,
black steel legs on a folding frame, net and posts across the middle,
2.74 m long, 1.53 m wide, 0.76 m tall
```

### Team bench
```
Sports team bench for an indoor basketball arena, three light wooden slats for the seat
and two for the backrest, black powder-coated steel frame with three leg sets, 3 m long
```

### Stadium seat (one seat, repeated thousands of times)
```
Single moulded plastic stadium seat with a backrest, mounted on two steel brackets,
dark green plastic, simple shape, 0.46 m wide, 0.8 m tall. Very low detail: under 500 triangles
```

### Sport poster (flat picture for the outside wall, one per sport)
```
Dramatic close-up photograph of [sport equipment] on its court at night under arena
spotlights, shallow depth of field, moody dark background, portrait 4:5,
no text, no people
```
Replace `[sport equipment]` with: pickleball paddle and ball; basketball and hoop;
pool balls and cue; volleyball by the net; badminton shuttlecock and racket;
table tennis bat and ball; futsal ball and goal; tennis racket and ball;
padel racket and ball by the glass wall; sepak takraw ball.
Save them as `public/assets/sports/<sport>.jpg`, 1024 × 1024 or larger.

## Surface materials (seamless textures)

The ground, walls and court now use texture sets made by
`scripts/make_exterior_textures.py`. Generate better ones with these prompts in any
image generator that can make **seamless / tileable** images (Midjourney `--tile`,
Leonardo "tiling", Stable Diffusion with a tiling option, Adobe Firefly "texture").

Add this to every material prompt:

```
seamless tileable texture, perfectly flat top-down orthographic view, no perspective,
even diffuse lighting, no shadows, no highlights, no vignette, no objects, no text,
photographic detail, square 1:1, 2048 x 2048
```

| File to replace | Real size of one tile | Prompt |
|---|---|---|
| `textures/asphalt/asphalt_basecolor.jpg` | 4 m x 4 m | Weathered dark grey asphalt road surface, fine black aggregate with scattered light grey stones, faint tyre wear, a few hairline cracks |
| `textures/pavers_concrete/pavers_concrete_basecolor.jpg` | 1.6 m x 1.6 m | Light grey rectangular concrete paving bricks in a running-bond pattern, 20 x 10 cm bricks, thin sand joints, slight colour variation brick to brick |
| `textures/brick_wall/brick_wall_basecolor.jpg` | 1.2 m x 1.2 m | Dark charcoal-grey face brick wall, stretcher bond, light grey mortar joints, slight texture and colour variation |
| `textures/facade_panels/facade_panels_basecolor.jpg` | 4.8 m x 4.8 m (2 x 4 panels) | Modern building facade of large off-white fibre-cement panels, 2.4 x 1.2 m each, 2 columns by 4 rows, thin dark recessed shadow joints, tiny screw fixings near the corners |
| `textures/court_acrylic_blue/court_acrylic_blue_basecolor.jpg` | 2 m x 2 m | Blue acrylic sports court surface, fine sandy grain texture, matte, no lines |

Normal and ORM maps: the easiest route is to drop the base colour into a free
map maker (Materialize, NormalMap-Online, or Adobe Substance Sampler) and export
**Normal (OpenGL)** plus **AO, Roughness and Metallic**. Pack AO into red,
roughness into green and metallic (black) into blue, saved as `<name>_orm.jpg`.
Or send the base colour images and I will make the other two maps.

## Floodlight tower (outdoor court)

```
Stadium floodlight mast for an outdoor basketball court, tall galvanised steel pole
with a service ladder, head frame holding six rectangular LED flood lights in two rows,
lights tilted slightly down, concrete footing, 16 m tall, head 4 m wide.
Under 8,000 triangles
```
The light faces must be a separate material named `LED` so they can glow at night
and switch off by day.

## Parked cars (3D, replaces the code-built cars)

Use the **Sedan** and **SUV** prompts above with an image-to-3D tool. For these,
the tyres must touch y = 0, with the car's nose facing +X. Name the window material
`Glass` and the lamp materials `Headlight` and `Taillight`; the lamps glow at night.

## Adding a finished model

Put the `.glb` in `public/assets/models/` and send it over. It replaces the
code-built shape for that object; the size and orientation rules above keep it lined up.
