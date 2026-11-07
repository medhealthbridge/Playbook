"""Build the optimized web asset pack from the generated asset bundle.

Usage: python3 -I scripts/prepare_assets.py <bundle_root>   (folder containing public/assets)
Writes to ./public/assets. Picks only the assets the 3D world uses and shrinks them:
 - HDRIs downsampled to 1024x512 (PMREM blurs them anyway)
 - PBR sets resized to 1024, roughness+AO packed into one ORM map (R=AO, G=rough, B=metal)
"""
import os, shutil, sys
import numpy as np
from PIL import Image

SRC = ""
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "assets")


def read_hdr(path):
    with open(path, "rb") as f:
        data = f.read()
    header_end = data.index(b"\n\n") + 2
    line_end = data.index(b"\n", header_end)
    dims = data[header_end:line_end].split()
    h, w = int(dims[1]), int(dims[3])
    pos = line_end + 1
    img = np.zeros((h, w, 4), np.uint8)
    for y in range(h):
        if data[pos] != 2 or data[pos + 1] != 2:  # flat (non-RLE) scanline
            img[y] = np.frombuffer(data, np.uint8, w * 4, pos).reshape(w, 4)
            pos += w * 4
            continue
        pos += 4
        for c in range(4):
            x = 0
            while x < w:
                n = data[pos]; pos += 1
                if n > 128:
                    n -= 128
                    img[y, x:x + n, c] = data[pos]; pos += 1
                else:
                    img[y, x:x + n, c] = np.frombuffer(data, np.uint8, n, pos); pos += n
                x += n
    e = img[..., 3].astype(np.int32)
    scale = np.where(e > 0, np.ldexp(1.0, e - 136), 0.0)
    return img[..., :3].astype(np.float64) * scale[..., None]


def write_hdr(path, rgb):
    h, w, _ = rgb.shape
    m = rgb.max(axis=2)
    mant, exp = np.frexp(m)
    valid = m > 1e-32
    scale = np.where(valid, mant * 256.0 / np.where(valid, m, 1), 0)
    out = np.zeros((h, w, 4), np.uint8)
    out[..., :3] = np.clip(rgb * scale[..., None], 0, 255).astype(np.uint8)
    out[..., 3] = np.where(valid, exp + 128, 0).astype(np.uint8)
    with open(path, "wb") as f:
        f.write(b"#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n")
        f.write(f"-Y {h} +X {w}\n".encode())
        f.write(out.tobytes())


def downsample(rgb, factor):
    h, w, _ = rgb.shape
    return rgb[: h - h % factor, : w - w % factor].reshape(h // factor, factor, w // factor, factor, 3).mean(axis=(1, 3))


def main():
    global SRC
    SRC = os.path.join(sys.argv[1], "public", "assets")
    os.makedirs(OUT, exist_ok=True)
    # HDRIs
    os.makedirs(os.path.join(OUT, "hdri"), exist_ok=True)
    # the exterior is a smooth gradient, so it can go much smaller
    for name, factor, label in (("arena_evening", 2, "1k"), ("exterior_bluehour", 4, "512")):
        rgb = read_hdr(os.path.join(SRC, "hdri", f"{name}_2k.hdr"))
        write_hdr(os.path.join(OUT, "hdri", f"{name}_{label}.hdr"), downsample(rgb, factor))
    # PBR textures
    for name in ("hardwood_maple", "concrete_polished", "court_acrylic_blue", "panel_acoustic_dark", "felt_billiards", "wall_plaster_white"):
        s = os.path.join(SRC, "textures", name)
        d = os.path.join(OUT, "textures", name)
        os.makedirs(d, exist_ok=True)
        size = (1024, 1024)
        Image.open(os.path.join(s, f"{name}_basecolor.jpg")).convert("RGB").resize(size, Image.LANCZOS).save(os.path.join(d, f"{name}_basecolor.jpg"), quality=84)
        Image.open(os.path.join(s, f"{name}_normal.png")).convert("RGB").resize(size, Image.LANCZOS).save(os.path.join(d, f"{name}_normal.jpg"), quality=90)
        ao = Image.open(os.path.join(s, f"{name}_ao.jpg")).convert("L").resize(size, Image.LANCZOS)
        rough = Image.open(os.path.join(s, f"{name}_roughness.jpg")).convert("L").resize(size, Image.LANCZOS)
        mpath = os.path.join(s, f"{name}_metallic.jpg")
        metal = Image.open(mpath).convert("L").resize(size, Image.LANCZOS) if os.path.exists(mpath) else Image.new("L", size, 0)
        Image.merge("RGB", (ao, rough, metal)).save(os.path.join(d, f"{name}_orm.jpg"), quality=88)
    # Straight copies. (The bundle's demo_arena_ambient video was replaced by the
    # Higgsfield clips in public/assets/video/; CREDITS.md gains rows for them
    # after this copy, so re-add those rows if you re-run this script.)
    for rel in ("models/bleacher_module.glb", "models/team_bench.glb", "fx/light_beam.png", "fx/dust_particles.png", "CREDITS.md"):
        os.makedirs(os.path.dirname(os.path.join(OUT, rel)), exist_ok=True)
        shutil.copyfile(os.path.join(SRC, rel), os.path.join(OUT, rel))


if __name__ == "__main__":
    main()
