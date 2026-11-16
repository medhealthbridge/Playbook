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

### Sedan (car park)
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

## Adding a finished model

Put the `.glb` in `public/assets/models/` and send it over. It replaces the
code-built shape for that object; the size and orientation rules above keep it lined up.
