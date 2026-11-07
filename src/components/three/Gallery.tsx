"use client";
// REPLAY gallery: premium highlight screens built from the sport photos, with
// broadcast-style overlays, slow "playing video" motion (pan/zoom), live
// progress bars, soft light halos, a film-strip clip timeline, and cheap
// mirrored reflections for devices without the real-time mirror floor.
// Every clip is labelled DEMO CLIP: these are illustrative, not real footage.
import { useFrame, useLoader } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { SportId } from "@/lib/booking/types";
import { canvasTexture, fonts } from "./textures";

type V = [number, number, number];

export interface Clip {
  sport: SportId;
  title: string;
  length: string;
  /** vertical crop centre in the square photo, 0 = bottom, 1 = top */
  focusY: number;
}

export const GALLERY_CLIPS: Clip[] = [
  { sport: "basketball", title: "Fast break and-one", length: "0:18", focusY: 0.55 },
  { sport: "padel", title: "Twenty-shot rally", length: "0:32", focusY: 0.45 },
  { sport: "billiards", title: "Bank shot to win the rack", length: "0:12", focusY: 0.42 },
  { sport: "volleyball", title: "Spike at the net", length: "0:09", focusY: 0.38 },
  { sport: "futsal", title: "Through-ball finish", length: "0:14", focusY: 0.45 },
  { sport: "pickleball", title: "Kitchen battle", length: "0:21", focusY: 0.34 },
  { sport: "badminton", title: "Jump smash", length: "0:07", focusY: 0.36 },
  { sport: "tennis", title: "Ace down the T", length: "0:06", focusY: 0.38 },
  { sport: "table-tennis", title: "Backhand flick", length: "0:05", focusY: 0.36 },
  { sport: "sepak-takraw", title: "Roll spike", length: "0:08", focusY: 0.45 },
];

const ASPECT = 9 / 16;

export function usePhotoTextures(clips: Clip[]) {
  const urls = useMemo(() => clips.map((c) => `/assets/sports/${c.sport}.jpg`), [clips]);
  const base = useLoader(THREE.TextureLoader, urls);
  return useMemo(
    () =>
      base.map((t) => {
        const c = t.clone();
        c.colorSpace = THREE.SRGBColorSpace;
        c.wrapS = c.wrapT = THREE.ClampToEdgeWrapping;
        c.anisotropy = 8;
        c.needsUpdate = true;
        return c;
      }),
    [base],
  );
}

/** Crop a square photo to 16:9 around focusY, with an optional Ken Burns zoom. */
export function cropTo169(tex: THREE.Texture, focusY: number, zoom = 1, panX = 0, panY = 0) {
  const rx = 1 / zoom;
  const ry = ASPECT / zoom;
  tex.repeat.set(rx, ry);
  const ox = THREE.MathUtils.clamp((1 - rx) / 2 + panX, 0, 1 - rx);
  const oy = THREE.MathUtils.clamp(focusY - ry / 2 + panY, 0, 1 - ry);
  tex.offset.set(ox, oy);
}

function overlayTexture(c: Clip) {
  return canvasTexture(1024, 576, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    // bottom scrim
    const g = ctx.createLinearGradient(0, h * 0.5, 0, h);
    g.addColorStop(0, "rgba(10,14,12,0)");
    g.addColorStop(1, "rgba(10,14,12,0.88)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // top-left live tag
    ctx.fillStyle = "rgba(10,14,12,0.7)";
    ctx.beginPath();
    ctx.roundRect(28, 26, 196, 48, 24);
    ctx.fill();
    ctx.fillStyle = "#FF7648";
    ctx.beginPath();
    ctx.arc(56, 50, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#F5F7F0";
    ctx.font = `700 24px ${fonts().body}`;
    ctx.fillText("REPLAY", 76, 59);
    // centre play button
    ctx.fillStyle = "rgba(245,247,240,0.16)";
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.45, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(245,247,240,0.7)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#F5F7F0";
    ctx.beginPath();
    ctx.moveTo(w / 2 - 14, h * 0.45 - 22);
    ctx.lineTo(w / 2 + 24, h * 0.45);
    ctx.lineTo(w / 2 - 14, h * 0.45 + 22);
    ctx.closePath();
    ctx.fill();
    // title + meta
    ctx.fillStyle = "#F5F7F0";
    ctx.font = `800 58px ${fonts().display}`;
    ctx.fillText(c.title.toUpperCase(), 36, h - 74);
    ctx.font = `600 26px ${fonts().body}`;
    ctx.fillStyle = "rgba(245,247,240,0.75)";
    ctx.fillText(c.length, 36, h - 36);
    ctx.textAlign = "right";
    ctx.fillStyle = "#D7FF3F";
    ctx.font = `700 22px ${fonts().body}`;
    ctx.fillText("DEMO CLIP", w - 36, h - 38);
    ctx.textAlign = "left";
    // progress track (fill is animated geometry)
    ctx.fillStyle = "rgba(245,247,240,0.22)";
    ctx.fillRect(36, h - 20, w - 72, 5);
  });
}

let haloTex: THREE.Texture | null = null;
function halo() {
  if (haloTex) return haloTex;
  haloTex = canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, "rgba(255,255,255,0.55)");
    g.addColorStop(0.45, "rgba(255,255,255,0.18)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  return haloTex;
}

const BEZEL = new THREE.MeshStandardMaterial({ color: "#0c100e", roughness: 0.35, metalness: 0.6 });

/** One highlight display. `mirror` adds a flipped copy below the floor (fake reflection). */
export function HighlightScreen({
  clip,
  photo,
  position,
  rotY,
  width = 4.4,
  featured = false,
  mirror = false,
  phase = 0,
  dim = 1,
}: {
  clip: Clip;
  photo: THREE.Texture;
  position: V;
  rotY: number;
  width?: number;
  featured?: boolean;
  mirror?: boolean;
  phase?: number;
  dim?: number;
}) {
  const h = width * ASPECT;
  const overlay = useMemo(() => overlayTexture(clip), [clip]);
  const progress = useRef<THREE.Mesh>(null);
  const progressMirror = useRef<THREE.Mesh>(null);
  const tint = useMemo(() => new THREE.Color(dim, dim, dim), [dim]);
  const barW = width * (1 - 72 / 1024);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase * 7;
    // slow pan/zoom: reads as footage playing
    const z = 1.06 + 0.06 * Math.sin(t * 0.12);
    cropTo169(photo, clip.focusY, z, 0.025 * Math.sin(t * 0.09), 0.015 * Math.cos(t * 0.11));
    const p = (t * 0.06) % 1;
    for (const m of [progress.current, progressMirror.current]) {
      if (!m) continue;
      m.scale.x = Math.max(0.001, p);
      m.position.x = -barW / 2 + (barW * p) / 2;
    }
  });
  const body = (progressRef: React.RefObject<THREE.Mesh | null>, withHalo: boolean) => (
    <>
      {/* soft light halo behind the panel (skipped on mirrored copies to save fill-rate) */}
      {withHalo && (
      <mesh position={[0, 0, -0.12]}>
        <planeGeometry args={[width * 1.7, h * 2]} />
        <meshBasicMaterial
          map={halo()}
          color={featured ? "#e8ff9a" : "#ffe6c4"}
          transparent
          opacity={featured ? 0.55 : 0.32}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      )}
      <mesh position={[0, 0, -0.05]} material={BEZEL}>
        <boxGeometry args={[width + 0.14, h + 0.14, 0.08]} />
      </mesh>
      <mesh>
        <planeGeometry args={[width, h]} />
        <meshBasicMaterial map={photo} color={tint} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0, 0.004]}>
        <planeGeometry args={[width, h]} />
        <meshBasicMaterial map={overlay} transparent toneMapped={false} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={progressRef} position={[-barW / 2, -h / 2 + (h * 18) / 576, 0.008]}>
        <planeGeometry args={[barW, (h * 6) / 576]} />
        <meshBasicMaterial color="#D7FF3F" toneMapped={false} />
      </mesh>
      {/* glowing lime edge under the screen */}
      <mesh position={[0, -h / 2 - 0.1, 0.02]}>
        <boxGeometry args={[width + 0.14, 0.035, 0.035]} />
        <meshBasicMaterial color={featured ? new THREE.Color("#D7FF3F").multiplyScalar(2) : "#D7FF3F"} toneMapped={false} />
      </mesh>
    </>
  );
  return (
    <>
      <group position={position} rotation={[0, rotY, 0]}>
        {body(progress, true)}
      </group>
      {mirror && (
        <group position={[position[0], -position[1], position[2]]} rotation={[0, rotY, 0]} scale={[1, -1, 1]}>
          {body(progressMirror, false)}
        </group>
      )}
    </>
  );
}

let stripTex: THREE.Texture | null = null;
function filmStrip() {
  if (stripTex) return stripTex;
  stripTex = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#0b100d";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#26302a";
    for (const x of [14, w - 34]) {
      for (let y = 10; y < h; y += 64) {
        ctx.beginPath();
        ctx.roundRect(x, y, 20, 40, 5);
        ctx.fill();
      }
    }
    ctx.fillStyle = "#1b231f";
    ctx.fillRect(52, 0, 3, h);
    ctx.fillRect(w - 55, 0, 3, h);
  });
  stripTex.wrapS = stripTex.wrapT = THREE.RepeatWrapping;
  return stripTex;
}

/** Film-strip clip timeline along the gallery floor with clip markers and a playhead. */
export function FilmTimeline({ z0, length, timeRef, from, to }: { z0: number; length: number; timeRef: React.MutableRefObject<number>; from: number; to: number }) {
  const tex = useMemo(() => {
    const t = filmStrip().clone();
    t.repeat.set(1, length / 2.2);
    t.needsUpdate = true;
    return t;
  }, [length]);
  const head = useRef<THREE.Group>(null);
  const marks = useMemo(() => [0.06, 0.24, 0.37, 0.6, 0.82].map((f, i) => ({ z: z0 - f * length, len: i % 2 ? 1.1 : 1.9 })), [z0, length]);
  useFrame(() => {
    const t = timeRef.current;
    const k = THREE.MathUtils.clamp((t - from) / (to - from), 0, 1);
    const e = k * k * (3 - 2 * k);
    if (head.current) head.current.position.z = z0 - e * length;
  });
  const lime = useMemo(() => new THREE.Color("#D7FF3F").multiplyScalar(1.6), []);
  return (
    <group ref={(g) => g?.traverse((o) => o.layers.set(1))}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, z0 - length / 2]}>
        <planeGeometry args={[2.2, length]} />
        <meshBasicMaterial map={tex} />
      </mesh>
      {marks.map((m, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.026, m.z - m.len / 2]}>
          <planeGeometry args={[1.05, m.len]} />
          <meshBasicMaterial color={lime} transparent opacity={0.55} toneMapped={false} />
        </mesh>
      ))}
      <group ref={head} position={[0, 0, z0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.032, 0]}>
          <planeGeometry args={[2.6, 0.09]} />
          <meshBasicMaterial color={new THREE.Color("#FF7648").multiplyScalar(2)} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <coneGeometry args={[0.14, 0.28, 3]} />
          <meshBasicMaterial color={new THREE.Color("#FF7648").multiplyScalar(2)} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
