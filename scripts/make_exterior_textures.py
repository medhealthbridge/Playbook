"""Generate the seamless PBR texture sets used outside the pavilion.

    python3 scripts/make_exterior_textures.py

Writes public/assets/textures/<name>/<name>_{basecolor,normal,orm}.jpg for:
  asphalt          car park and road
  pavers_concrete  plaza paving (running-bond concrete pavers)
  brick_wall       wall base (dark grey face brick)
  facade_panels    upper wall (large fibre-cement panels with shadow joints)

Everything is procedural (numpy + Pillow) and tiles seamlessly: noise is made
in the frequency domain, so it wraps by construction. ORM packs ambient
occlusion (R), roughness (G) and metalness (B), as Realism.tsx expects.
To swap in better textures, keep the same file names and sizes.
"""
from pathlib import Path

import numpy as np
from PIL import Image

N = 1024
OUT = Path(__file__).resolve().parent.parent / "public" / "assets" / "textures"
rng = np.random.default_rng(42)


def noise(scale: float, n: int = N, power: float = 2.0) -> np.ndarray:
    """Tileable fractal noise in 0..1. Lower scale = bigger blobs."""
    fx = np.fft.fftfreq(n)[:, None]
    fy = np.fft.fftfreq(n)[None, :]
    f = np.sqrt(fx**2 + fy**2)
    f[0, 0] = 1
    amp = 1 / (f * n / scale) ** power
    amp[0, 0] = 0
    amp[f * n > scale * 40] = 0
    spec = amp * np.exp(2j * np.pi * rng.random((n, n)))
    out = np.real(np.fft.ifft2(spec))
    out -= out.min()
    return out / out.max()


def speckle(density: float, size: int = 1) -> np.ndarray:
    s = (rng.random((N, N)) < density).astype(float)
    for _ in range(size - 1):
        s = np.maximum.reduce([s, np.roll(s, 1, 0), np.roll(s, 1, 1)])
    return s


def blur(a: np.ndarray, r: int) -> np.ndarray:
    """Cheap wrap-around box blur (repeated = near-gaussian)."""
    for _ in range(2):
        acc = np.zeros_like(a)
        for d in range(-r, r + 1):
            acc += np.roll(a, d, 0)
        a = acc / (2 * r + 1)
        acc = np.zeros_like(a)
        for d in range(-r, r + 1):
            acc += np.roll(a, d, 1)
        a = acc / (2 * r + 1)
    return a


def normal_from_height(h: np.ndarray, strength: float) -> np.ndarray:
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * strength
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * strength
    nz = np.ones_like(h)
    l = np.sqrt(dx**2 + dy**2 + nz**2)
    n = np.stack([-dx / l, dy / l, nz / l], -1)
    return ((n * 0.5 + 0.5) * 255).astype(np.uint8)


def save(name: str, color: np.ndarray, height: np.ndarray, rough: np.ndarray, ao: np.ndarray, strength: float):
    d = OUT / name
    d.mkdir(parents=True, exist_ok=True)
    Image.fromarray(np.clip(color * 255, 0, 255).astype(np.uint8)).save(d / f"{name}_basecolor.jpg", quality=88)
    Image.fromarray(normal_from_height(height, strength)).save(d / f"{name}_normal.jpg", quality=90)
    orm = np.stack([ao, rough, np.zeros_like(ao)], -1)
    Image.fromarray(np.clip(orm * 255, 0, 255).astype(np.uint8)).save(d / f"{name}_orm.jpg", quality=88)
    print("wrote", d)


def tint(gray: np.ndarray, rgb) -> np.ndarray:
    return gray[..., None] * np.array(rgb)[None, None, :]


# ------------------------------------------------------------------ asphalt
def asphalt():
    base = 0.24 + 0.05 * (noise(6) - 0.5) + 0.03 * (noise(40) - 0.5)
    stones = blur(speckle(0.05, 2), 1)
    light = speckle(0.012, 2) * 0.22
    dark = speckle(0.02) * 0.08
    g = base + light - dark + stones * 0.03
    patch = (noise(3) > 0.78) * 0.012  # old repairs, slightly darker
    g -= blur(patch, 6)
    color = tint(g, (1.0, 1.0, 1.04))
    height = stones * 0.6 + light * 2 + noise(60) * 0.3
    rough = 0.82 + 0.1 * noise(20)
    ao = 1 - blur(dark, 1) * 2.5
    save("asphalt", color, height, rough, ao, 3.5)


# -------------------------------------------------------------- plaza pavers
def pavers():
    # 8 x 16 pavers of 128 x 64 px, running bond.
    rows, cols = 16, 8
    ph, pw = N // rows, N // cols
    y, x = np.mgrid[0:N, 0:N]
    row = y // ph
    xo = (x + (row % 2) * (pw // 2)) % N
    col = xo // pw
    fy = (y % ph) / ph
    fx = (xo % pw) / pw
    edge = np.minimum.reduce([fx, 1 - fx, fy * 2, (1 - fy) * 2])  # 0 at joint
    joint = edge < 0.035
    bevel = np.clip(edge / 0.09, 0, 1)
    pid = (row * 131 + col * 71) % 997
    shade = (np.sin(pid * 12.9898) * 43758.5453) % 1  # per-paver variation
    g = 0.6 + (shade - 0.5) * 0.08 + 0.06 * (noise(30) - 0.5) + speckle(0.03) * 0.05 - speckle(0.03) * 0.05
    g = np.where(joint, 0.28 + 0.05 * noise(80), g * (0.86 + 0.14 * bevel))
    stain = blur((noise(4) > 0.75).astype(float), 10) * 0.025
    g -= stain
    color = tint(g, (1.0, 0.98, 0.94))
    height = np.where(joint, 0, bevel) + noise(90) * 0.08
    rough = np.where(joint, 0.98, 0.78 + 0.1 * noise(25))
    ao = np.where(joint, 0.45, 0.75 + 0.25 * bevel)
    save("pavers_concrete", color, height, rough, ao, 5)


# ---------------------------------------------------------------- brick base
def brick():
    # 16 courses x 4 bricks per tile (brick 256 x 64 px incl. joint).
    rows, cols = 16, 4
    bh, bw = N // rows, N // cols
    y, x = np.mgrid[0:N, 0:N]
    row = y // bh
    xo = (x + (row % 2) * (bw // 2)) % N
    col = xo // bw
    fy = (y % bh) / bh
    fx = (xo % bw) / bw
    edge = np.minimum.reduce([fx * 4, (1 - fx) * 4, fy, 1 - fy])
    mortar = edge < 0.11
    bid = (row * 197 + col * 53) % 991
    v = (np.sin(bid * 78.233) * 43758.5453) % 1
    g = 0.27 + (v - 0.5) * 0.07 + 0.05 * (noise(50) - 0.5) + speckle(0.04) * 0.04
    g = np.where(mortar, 0.52 + 0.06 * noise(70), g)
    color = tint(g, (1.0, 0.97, 0.95))
    bevel = np.clip((edge - 0.11) / 0.12, 0, 1)
    height = np.where(mortar, 0, 0.6 + 0.4 * bevel) + noise(100) * 0.12
    rough = np.where(mortar, 0.95, 0.85)
    ao = np.where(mortar, 0.5, 0.8 + 0.2 * bevel)
    save("brick_wall", color, height, rough, ao, 4)


# ------------------------------------------------------------ facade panels
def panels():
    # 2 x 4 large panels per tile, 12 px shadow joints, faint fixings at the corners.
    rows, cols = 4, 2
    h, w = N // rows, N // cols
    y, x = np.mgrid[0:N, 0:N]
    fy = (y % h) / h
    fx = (x % w) / w
    jy = np.minimum(y % h, h - y % h)
    jx = np.minimum(x % w, w - x % w)
    joint = (jx < 6) | (jy < 6)
    pid = (y // h) * 7 + (x // w) * 3
    v = (np.sin(pid * 91.7) * 43758.5453) % 1
    g = 0.82 + (v - 0.5) * 0.035 + 0.03 * (noise(12) - 0.5) + 0.015 * (noise(120) - 0.5)
    streak = blur(noise(8, power=1.2), 2)
    g -= np.clip(streak - 0.6, 0, 1) * 0.05 * (1 - fy)  # faint weathering under the top edge
    fix = np.zeros((N, N), bool)
    for cy in (0.08, 0.92):
        for cx in (0.06, 0.94):
            fix |= (fx - cx) ** 2 * (w / h) ** 2 + (fy - cy) ** 2 < 0.0002
    g = np.where(fix, g - 0.12, g)
    g = np.where(joint, 0.16, g)
    color = tint(g, (0.98, 0.98, 0.96))
    height = np.where(joint, 0, 1.0) - fix * 0.2 + noise(80) * 0.03
    rough = np.where(joint, 0.9, 0.62 + 0.08 * noise(30))
    ao = np.where(joint, 0.3, 1.0)
    save("facade_panels", color, height, rough, ao, 6)


if __name__ == "__main__":
    asphalt()
    pavers()
    brick()
    panels()
