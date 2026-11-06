"use client";
// Honest highlight preview: a procedural top-down animation, clearly captioned
// as a demo animation (not real footage). Plays only when the user presses
// play. No sound, no autoplay. Swap for a real <video> with signed URLs later.
import { useEffect, useRef, useState } from "react";
import type { ClipKind } from "@/lib/booking/types";

const DURATION = 6; // seconds of animation per clip

type Pt = [number, number];

const SCENES: Record<ClipKind, { surface: string; ball: string; path: Pt[]; players: Pt[]; label: string }> = {
  basketball: {
    surface: "#8a5a30", ball: "#E2702F", label: "Fast break",
    path: [[0.8, 0.7], [0.6, 0.55], [0.4, 0.6], [0.22, 0.5], [0.1, 0.5]],
    players: [[0.7, 0.4], [0.5, 0.7], [0.3, 0.35], [0.18, 0.6]],
  },
  rally: {
    surface: "#1d5a4d", ball: "#F5F7F0", label: "Long rally",
    path: [[0.15, 0.3], [0.85, 0.65], [0.18, 0.7], [0.82, 0.32], [0.2, 0.45], [0.8, 0.55]],
    players: [[0.12, 0.5], [0.88, 0.5]],
  },
  billiards: {
    surface: "#1f6b45", ball: "#F5F5EE", label: "Bank shot",
    path: [[0.25, 0.5], [0.55, 0.15], [0.85, 0.5], [0.95, 0.85]],
    players: [],
  },
  futsal: {
    surface: "#256b39", ball: "#F5F7F0", label: "Through ball",
    path: [[0.5, 0.5], [0.65, 0.3], [0.8, 0.45], [0.97, 0.5]],
    players: [[0.6, 0.6], [0.72, 0.28], [0.85, 0.55], [0.4, 0.4]],
  },
  volleyball: {
    surface: "#9b6a3a", ball: "#F5F2E8", label: "Spike",
    path: [[0.2, 0.7], [0.35, 0.3], [0.45, 0.45], [0.75, 0.6]],
    players: [[0.2, 0.7], [0.4, 0.5], [0.7, 0.4], [0.75, 0.65]],
  },
};

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function lerpPath(path: Pt[], t: number): Pt {
  const seg = Math.min(path.length - 2, Math.floor(t * (path.length - 1)));
  const local = t * (path.length - 1) - seg;
  const e = local < 0.5 ? 2 * local * local : 1 - Math.pow(-2 * local + 2, 2) / 2;
  const [a, b] = [path[seg], path[seg + 1]];
  return [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e];
}

function draw(ctx: CanvasRenderingContext2D, w: number, h: number, kind: ClipKind, t: number) {
  const s = SCENES[kind];
  ctx.fillStyle = "#0a0f0c";
  ctx.fillRect(0, 0, w, h);
  const pad = w * 0.06;
  const cw = w - pad * 2;
  const ch = h - pad * 2;
  ctx.fillStyle = s.surface;
  ctx.fillRect(pad, pad, cw, ch);
  ctx.strokeStyle = "rgba(245,247,240,0.8)";
  ctx.lineWidth = Math.max(1.5, w / 400);
  ctx.strokeRect(pad, pad, cw, ch);
  ctx.beginPath();
  ctx.moveTo(pad + cw / 2, pad);
  ctx.lineTo(pad + cw / 2, pad + ch);
  ctx.stroke();
  if (kind === "basketball" || kind === "futsal") {
    ctx.beginPath();
    ctx.arc(pad + cw / 2, pad + ch / 2, ch * 0.15, 0, Math.PI * 2);
    ctx.stroke();
  }
  const P = (p: Pt): Pt => [pad + p[0] * cw, pad + p[1] * ch];

  // route trail so far
  ctx.strokeStyle = "#D7FF3F";
  ctx.setLineDash([3, 8]);
  ctx.lineWidth = Math.max(2, w / 300);
  ctx.beginPath();
  const steps = 60;
  for (let i = 0; i <= steps * t; i++) {
    const [x, y] = P(lerpPath(s.path, i / steps));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // players drift
  s.players.forEach((p, i) => {
    const [x, y] = P([p[0] + Math.sin(t * 6 + i) * 0.02, p[1] + Math.cos(t * 5 + i) * 0.03]);
    ctx.fillStyle = i % 2 ? "rgba(245,247,240,0.9)" : "#101713";
    ctx.strokeStyle = "#F5F7F0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, w * 0.018, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  // ball
  const [bx, by] = P(lerpPath(s.path, t));
  const lift = Math.sin(t * Math.PI * (s.path.length - 1)) * w * 0.01;
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(bx + 3, by + 4, w * 0.014, w * 0.007, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = s.ball;
  ctx.beginPath();
  ctx.arc(bx, by - lift, w * 0.014, 0, Math.PI * 2);
  ctx.fill();

  // corner label
  ctx.fillStyle = "rgba(16,23,19,0.75)";
  ctx.fillRect(pad + 8, pad + 8, w * 0.32, h * 0.1);
  ctx.fillStyle = "#D7FF3F";
  ctx.font = `700 ${Math.round(h * 0.05)}px sans-serif`;
  ctx.fillText(`DEMO · ${s.label.toUpperCase()}`, pad + 16, pad + 8 + h * 0.068);
}

export function HighlightPlayer({ kind, title, length }: { kind: ClipKind; title: string; length: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0.35);
  const raf = useRef(0);
  const start = useRef(0);

  // Redraw on kind change / resize
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = c.clientWidth * dpr;
      c.height = c.clientHeight * dpr;
      const ctx = c.getContext("2d");
      if (ctx) draw(ctx, c.width, c.height, kind, t);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(c);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  useEffect(() => {
    setPlaying(false);
    setT(0.35);
  }, [kind, title]);

  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    if (!playing) {
      draw(ctx, c.width, c.height, kind, t);
      return;
    }
    start.current = performance.now() - t * DURATION * 1000;
    const loop = (now: number) => {
      const p = Math.min(1, (now - start.current) / (DURATION * 1000));
      draw(ctx, c.width, c.height, kind, p);
      setT(p);
      if (p < 1) raf.current = requestAnimationFrame(loop);
      else setPlaying(false);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, kind]);

  const toggle = () => {
    if (!playing && t >= 1) setT(0);
    setPlaying((p) => !p);
  };
  const secs = Math.round(t * length);

  return (
    <figure className="player-frame" style={{ margin: 0 }}>
      <canvas ref={canvas} aria-label={`Demo animation for clip: ${title}`} role="img" />
      <div className="player-bar">
        <button className="play-btn" type="button" onClick={toggle} aria-label={playing ? `Pause ${title}` : `Play ${title}`}>
          {playing ? (
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="2" width="3.5" height="12" fill="currentColor" /><rect x="9.5" y="2" width="3.5" height="12" fill="currentColor" /></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2l10 6-10 6z" fill="currentColor" /></svg>
          )}
        </button>
        <div className="timeline" aria-hidden="true">
          <div className="mark" style={{ left: "18%", width: "14%" }} />
          <div className="mark" style={{ left: "52%", width: "10%" }} />
          <div className="mark" style={{ left: "80%", width: "8%" }} />
          <div className="head" style={{ left: `${t * 100}%` }} />
        </div>
        <span className="t num">{fmt(secs)} / {fmt(length)}</span>
      </div>
      <figcaption className="caption-note">Demo animation — not real footage. No sound.</figcaption>
    </figure>
  );
}
