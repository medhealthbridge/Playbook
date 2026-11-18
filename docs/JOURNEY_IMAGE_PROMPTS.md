# Story photos (reduced motion / no 3D)

When a visitor has **Reduce motion** switched on (or their device can't run the 3D
view), the homepage shows the story as three still sections: BOOK, PLAY, REPLAY.
Each has a picture on the right. These prompts make that picture a realistic photo
instead of the drawn illustration.

## Shared rules (add to every prompt)

```
photorealistic editorial sports photography, shot on a full-frame camera,
35mm lens, natural colour, fine film grain, shallow depth of field,
moody evening light with deep shadows, dark surroundings so it sits on a
near-black web page, landscape 4:3, no text, no logos, no brand names,
no watermark, no signage
```

**Negative prompt** (where the tool has one):

```
text, letters, logo, brand, watermark, signature, jersey numbers, scoreboard
numbers, cartoon, illustration, 3d render, cgi, plastic skin, extra fingers,
deformed hands, distorted faces, blurry face, oversaturated, HDR halo,
bright white background, daylight beach glare, flat lighting
```

Size: **1600 × 1200** (4:3) or larger. The page crops to 4:3 and keeps the centre,
so leave the subject roughly in the middle with a little room around it.

---

## 1. BOOK — "Find your sport. Pick your time."

The feeling: an empty court waiting for you, the moment just before you play.

```
An empty indoor basketball court in a modern Filipino sports hall at dusk,
seen from courtside at knee height. Polished maple hardwood floor with crisp
white lines, the three-point arc and key leading the eye into the frame.
A single orange basketball rests on the floor in the foreground, slightly
right of centre, sharp. Warm overhead LED panels reflect in long streaks on
the glossy floor. The far wall and stands fall into soft darkness; a few
lime-green accent lights glow in the background bokeh. Quiet, inviting,
ready to play. Photorealistic editorial sports photography, 35mm lens,
shallow depth of field, moody evening light, no people, no text, no logos.
```

Variants if you want options: replace the basketball court with **a pickleball
court with a paddle and ball on the baseline**, or **a billiard table under a
single pendant lamp with a racked set of balls**.

## 2. PLAY — "Bring the squad. Make it game time."

The feeling: friends, energy, a game in motion.

```
A group of four Filipino friends in their twenties playing an evening game of
indoor volleyball on a wooden court, candid action moment: one player rising
for a spike at the net, a teammate cheering with arms raised, the others
moving in. Shot from the side of the court at chest height, the net crossing
the frame diagonally, the ball sharp at the top of the jump. Mixed casual
sportswear in muted colours with one lime-green shirt. Warm overhead arena
lights, slight motion blur on hands and feet, the background stands dark and
soft. Joyful, social, energetic. Photorealistic editorial sports photography,
35mm lens, fast shutter, natural skin tones, faces turned away or in motion,
no text, no logos, no jersey numbers.
```

Lower-risk version (no faces, if a tool struggles with people):

```
Close-up at net height of an indoor volleyball court at night: a white and
blue volleyball frozen mid-air just above the net tape, two pairs of hands
reaching for it from either side, out of focus. Wooden floor and court lines
below, warm overhead lights, dark background bokeh. Photorealistic sports
photography, 85mm lens, shallow depth of field, no text, no logos.
```

## 3. REPLAY — "The game ends. The moments stay."

The feeling: a frozen highlight, the kind of moment you'd want to watch again.

```
A badminton smash frozen at the peak of the moment on an indoor green court
at night: a player in mid-air, racket fully extended overhead, the white
feather shuttlecock sharp just in front of the strings, a faint streak
showing its path. Shot low from the side of the court, the net and white
court lines below, the player lit by a single warm overhead light against a
dark arena background. Crisp, cinematic, like a still from a highlight reel.
Photorealistic editorial sports photography, 70-200mm lens, very fast
shutter, shallow depth of field, face in profile or turned away,
no text, no logos.
```

No-people version:

```
Macro photograph of a white feather badminton shuttlecock resting on the
white line of a green indoor court at night, a racket lying out of focus
behind it, warm light raking across the court surface, dark background,
photorealistic, 100mm macro lens, shallow depth of field, no text.
```

---

## Adding them

Send the three images (any of PNG, JPG or WebP). They will be saved as
`public/assets/journey/book.webp`, `play.webp` and `replay.webp` and listed in
`JOURNEY_PHOTOS` in `src/components/landing/Cinematic.tsx`. Until a chapter has
a photo it keeps its drawing, so you can add them one at a time.
