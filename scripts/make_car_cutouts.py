"""Cut the car reference photos out of their studio background for the car park.

    python3 -I scripts/make_car_cutouts.py <folder with car_<kind>_<view>.png>

Reads car_{sedan,suv}_{front,hero,side,rear_3quarter,rear}.png and writes
public/assets/props/cars/<kind>_<view>.webp (transparent, cropped tight, at most
1024 px wide). The bottom edge is the tyre contact line: the studio floor shadow
below it is cut off, the scene draws its own shadow.

Background removal: estimate the backdrop gradient from the border, mark pixels
within a few levels of it, keep what is connected to
the border, then keep the largest remaining region (the car) and erode 1 px.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

KINDS = ["sedan", "suv"]
VIEWS = ["front", "hero", "side", "rear_3quarter", "rear"]
OUT = Path(__file__).resolve().parent.parent / "public" / "assets" / "props" / "cars"


def backdrop(rgb: np.ndarray) -> np.ndarray:
    """Smooth estimate of the studio backdrop: a Coons patch through the four border strips."""
    h, w, _ = rgb.shape
    m = 6
    top = np.median(rgb[:m], axis=0)
    bot = np.median(rgb[-m:], axis=0)
    left = np.median(rgb[:, :m], axis=1)
    right = np.median(rgb[:, -m:], axis=1)
    u = np.linspace(0, 1, w)[None, :, None]
    v = np.linspace(0, 1, h)[:, None, None]
    lin_v = (1 - v) * top[None] + v * bot[None]
    lin_u = (1 - u) * left[:, None] + u * right[:, None]
    corners = ((1 - u) * (1 - v) * top[0] + u * (1 - v) * top[-1] + (1 - u) * v * bot[0] + u * v * bot[-1])
    return lin_v + lin_u - corners


def reach_from_border(mask: np.ndarray) -> np.ndarray:
    """Pixels of `mask` connected to the image border (4-neighbour flood, done with array shifts)."""
    seen = np.zeros_like(mask)
    seen[0, :] = mask[0, :]
    seen[-1, :] = mask[-1, :]
    seen[:, 0] = mask[:, 0]
    seen[:, -1] = mask[:, -1]
    while True:
        grow = seen.copy()
        grow[1:] |= seen[:-1]
        grow[:-1] |= seen[1:]
        grow[:, 1:] |= seen[:, :-1]
        grow[:, :-1] |= seen[:, 1:]
        grow &= mask
        if (grow == seen).all():
            return seen
        seen = grow


def largest_blob(mask: np.ndarray) -> np.ndarray:
    """Keep the biggest connected region (the car), dropping specks."""
    h, w = mask.shape
    label = np.zeros((h, w), np.int32)
    best, best_n, cur = 0, 0, 0
    ys, xs = np.nonzero(mask)
    for y0, x0 in zip(ys[:: 97], xs[:: 97]):
        if label[y0, x0]:
            continue
        cur += 1
        seed = np.zeros_like(mask)
        seed[y0, x0] = True
        region = seed
        while True:
            grow = region.copy()
            grow[1:] |= region[:-1]
            grow[:-1] |= region[1:]
            grow[:, 1:] |= region[:, :-1]
            grow[:, :-1] |= region[:, 1:]
            grow &= mask
            if (grow == region).all():
                break
            region = grow
        label[region] = cur
        n = int(region.sum())
        if n > best_n:
            best, best_n = cur, n
        if best_n > mask.sum() * 0.5:
            break
    return label == best


def cutout(src: Path) -> Image.Image:
    im = Image.open(src).convert("RGB")
    rgb = np.asarray(im).astype(np.float32)
    bg = backdrop(rgb)
    diff = np.abs(rgb - bg).max(axis=2)
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    lum = rgb.mean(axis=2)
    # A light car's shaded panels come close to the light-grey backdrop, so it needs a tight
    # threshold or the cut leaks into the paint. A dark car cannot be confused with it, so a looser
    # threshold is safe and cleans up the backdrop's uneven shading around the outline.
    rough = ~reach_from_border((diff < 9) & (sat < 14))
    light_car = float(np.median(lum[rough])) > 150
    t = 6.0 if light_car else 11.0
    near_bg = (diff < t) & (sat < 14)
    # The floor shadow is not keyed out (on a white car it matches the shaded lower doors);
    # it is cut off below the tyre line instead, and what is left under the body reads as shade.
    background = reach_from_border(near_bg)
    # open (erode then dilate) to drop specks of backdrop noise clinging to the outline
    opened = Image.fromarray((~background * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(5))
    car = largest_blob(np.asarray(opened) > 127)
    alpha = Image.fromarray((car * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
    out = im.convert("RGBA")
    out.putalpha(alpha)
    ys, xs = np.nonzero(car)
    t, b, l, r = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    # tyre contact: the lowest row that still has dark rubber in it
    contact = b
    for y in range(b - 1, t, -1):
        row = car[y, l:r] & (lum[y, l:r] < 70)
        if row.sum() > (r - l) * 0.012:
            contact = y + 2
            break
    out = out.crop((int(l), int(t), int(r), int(contact)))
    # Studio floor shadow left beside the tyres: turn it into a real transparent shadow
    # (black, alpha from how much darker than the backdrop it is) so it sits on any ground.
    sl = (slice(int(t), int(contact)), slice(int(l), int(r)))
    c_lum, c_sat, c_bg = lum[sl], sat[sl], bg.mean(axis=2)[sl]
    band = np.zeros_like(c_lum, bool)
    band[int(c_lum.shape[0] * 0.86):] = True
    floor = band & (c_sat < 14) & (c_lum > 80) & (c_lum <= c_bg + 4)
    seen = np.zeros_like(floor)
    seen[-1] = floor[-1]
    seen[:, 0] |= floor[:, 0]
    seen[:, -1] |= floor[:, -1]
    while True:
        grow = seen.copy()
        grow[1:] |= seen[:-1]
        grow[:-1] |= seen[1:]
        grow[:, 1:] |= seen[:, :-1]
        grow[:, :-1] |= seen[:, 1:]
        grow &= floor
        if (grow == seen).all():
            break
        seen = grow
    arr = np.asarray(out).copy()
    shade = np.clip((c_bg - c_lum) / np.maximum(c_bg, 1) * 2.4, 0, 0.7)
    arr[seen, :3] = 0
    arr[seen, 3] = (np.minimum(arr[seen, 3] / 255, shade[seen]) * 255).astype(np.uint8)
    out = Image.fromarray(arr, "RGBA")
    if out.width > 1024:
        out = out.resize((1024, round(out.height * 1024 / out.width)), Image.LANCZOS)
    return out


def main(folder: str):
    OUT.mkdir(parents=True, exist_ok=True)
    for k in KINDS:
        for v in VIEWS:
            src = Path(folder) / f"car_{k}_{v}.png"
            img = cutout(src)
            dst = OUT / f"{k}_{v}.webp"
            img.save(dst, "WEBP", quality=88, method=6)
            print(dst.name, img.size)


if __name__ == "__main__":
    main(sys.argv[1])
