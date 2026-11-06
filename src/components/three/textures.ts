// Procedural canvas textures — no external image downloads needed.
import * as THREE from "three";

export function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function hardwood() {
  const tex = canvasTexture(512, 512, (ctx, w, h) => {
    const plankH = 32;
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let y = 0; y < h; y += plankH) {
      let x = -Math.floor(rnd() * 200);
      while (x < w) {
        const len = 140 + rnd() * 200;
        const l = 38 + rnd() * 10;
        ctx.fillStyle = `hsl(${28 + rnd() * 6}, ${46 + rnd() * 10}%, ${l}%)`;
        ctx.fillRect(x, y, len, plankH);
        ctx.fillStyle = "rgba(40,20,5,0.35)";
        ctx.fillRect(x, y, 2, plankH);
        // grain
        ctx.strokeStyle = "rgba(60,30,10,0.12)";
        for (let g = 0; g < 4; g++) {
          ctx.beginPath();
          const gy = y + 4 + rnd() * (plankH - 8);
          ctx.moveTo(x, gy);
          ctx.bezierCurveTo(x + len * 0.3, gy + 3, x + len * 0.6, gy - 3, x + len, gy);
          ctx.stroke();
        }
        x += len;
      }
      ctx.fillStyle = "rgba(30,15,5,0.4)";
      ctx.fillRect(0, y, w, 1.5);
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function concrete() {
  const tex = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#1d2420";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1600; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, w, h);
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function basketballTexture() {
  return canvasTexture(512, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#e9803a");
    g.addColorStop(1, "#c85a1f");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) {
      ctx.fillStyle = "rgba(90,30,0,0.12)";
      ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
    }
    ctx.strokeStyle = "#1a0f08";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    for (const x of [0, w / 2, w]) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    ctx.stroke();
    ctx.beginPath();
    for (const off of [w / 4, (3 * w) / 4]) {
      for (let y = 0; y <= h; y += 4) {
        const x = off + Math.sin((y / h) * Math.PI) * w * 0.12 * (off < w / 2 ? 1 : -1);
        if (y === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  });
}

/** Generic UI panel drawn in canvas — rendered unlit so it stays readable. */
export function panelTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  opts: { bg?: string; border?: string } = {},
) {
  return canvasTexture(w, h, (ctx, W, H) => {
    ctx.fillStyle = opts.bg ?? "rgba(16,23,19,0.92)";
    roundRect(ctx, 0, 0, W, H, 28);
    ctx.fill();
    ctx.strokeStyle = opts.border ?? "rgba(215,255,63,0.9)";
    ctx.lineWidth = 6;
    roundRect(ctx, 3, 3, W - 6, H - 6, 26);
    ctx.stroke();
    draw(ctx, W, H);
  });
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Resolve the real (next/font hashed) family names so canvas text matches the site.
let cachedFonts: { body: string; display: string } | null = null;
export function fonts() {
  if (cachedFonts) return cachedFonts;
  const root = getComputedStyle(document.documentElement);
  const body = root.getPropertyValue("--font-inter").trim();
  const display = root.getPropertyValue("--font-barlow").trim();
  cachedFonts = {
    body: `${body ? body + ", " : ""}Inter, 'Helvetica Neue', Arial, sans-serif`,
    display: `${display ? display + ", " : ""}'Barlow Condensed', 'Arial Narrow', Arial, sans-serif`,
  };
  return cachedFonts;
}

/** Stylised highlight frame (top-down play), used in the REPLAY gallery. */
export function highlightTexture(kind: "basketball" | "rally" | "billiards" | "futsal", label: string) {
  const surfaces = { basketball: "#8a5a30", rally: "#1d5a4d", billiards: "#1f6b45", futsal: "#256b39" };
  return canvasTexture(640, 360, (ctx, w, h) => {
    ctx.fillStyle = "#050806";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = surfaces[kind];
    ctx.fillRect(30, 30, w - 60, h - 60);
    ctx.strokeStyle = "rgba(245,247,240,0.85)";
    ctx.lineWidth = 4;
    ctx.strokeRect(30, 30, w - 60, h - 60);
    ctx.beginPath();
    ctx.moveTo(w / 2, 30);
    ctx.lineTo(w / 2, h - 30);
    ctx.stroke();
    if (kind !== "rally") {
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 46, 0, Math.PI * 2);
      ctx.stroke();
    }
    // route
    ctx.strokeStyle = "#D7FF3F";
    ctx.setLineDash([6, 14]);
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(w * 0.78, h * 0.72);
    ctx.bezierCurveTo(w * 0.6, h * 0.2, w * 0.35, h * 0.3, w * 0.2, h * 0.5);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = kind === "basketball" ? "#E2702F" : "#F5F7F0";
    ctx.beginPath();
    ctx.arc(w * 0.2, h * 0.5, 14, 0, Math.PI * 2);
    ctx.fill();
    for (const [x, y] of [[0.3, 0.3], [0.45, 0.65], [0.66, 0.4], [0.8, 0.6]]) {
      ctx.fillStyle = "#101713";
      ctx.strokeStyle = "#F5F7F0";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(w * x, h * y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    // HUD
    ctx.fillStyle = "rgba(16,23,19,0.85)";
    ctx.fillRect(30, h - 86, w - 60, 56);
    ctx.fillStyle = "#F5F7F0";
    ctx.font = `700 26px ${fonts().body}`;
    ctx.fillText(label, 52, h - 50);
    ctx.fillStyle = "#D7FF3F";
    ctx.font = `700 18px ${fonts().body}`;
    ctx.textAlign = "right";
    ctx.fillText("DEMO CLIP", w - 52, h - 52);
    ctx.textAlign = "left";
  });
}
