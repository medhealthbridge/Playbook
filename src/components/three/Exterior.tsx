"use client";
// Everything outside the pavilion: a sky that follows the visitor's clock
// (sun and clouds by day, warm light at dawn and dusk, moon and stars at
// night), the facade dressing (one lit poster per sport, sign, open glass
// doors, welcome mat, planters), a car park with 3D cars, 3D food stalls and trees.
// The whole group is hidden once the camera is well inside the arena.
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { sportById } from "@/content/sports";
import { GALLERY_CLIPS, usePhotoTextures } from "./Gallery";
import { canvasTexture, fonts } from "./textures";

type V = [number, number, number];
const DOOR_Z = -19.5;

function box(w: number, h: number, d: number, at: V, rot: V = [0, 0, 0]) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...at), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(1, 1, 1)));
  return g;
}

/* --------------------------------------------------------------------- sky */

export type SkyPhase = "day" | "golden" | "night";

interface Palette {
  top: string; mid: string; horizon: string; fog: string;
  orb: string; orbSize: number; orbDir: V; halo: number;
  cloud: string; cloudOpacity: number; stars: number;
  hemi: number; sun: number; sunColor: string; env: number;
}

const PALETTES: Record<SkyPhase, Palette> = {
  day: {
    top: "#17509f", mid: "#3f86cf", horizon: "#a9d0ec", fog: "#7fa3bd",
    orb: "#fff6d8", orbSize: 8, orbDir: [0.2, 0.326, -0.92], halo: 0.9,
    cloud: "#ffffff", cloudOpacity: 0.92, stars: 0, hemi: 0.55, sun: 0.8, sunColor: "#fff2d6", env: 0.55,
  },
  golden: {
    top: "#27356b", mid: "#b0627a", horizon: "#f6a45c", fog: "#7a5560",
    orb: "#ffb35a", orbSize: 10, orbDir: [0.46, 0.25, -0.85], halo: 1.2,
    cloud: "#ffc9a8", cloudOpacity: 0.85, stars: 0.15, hemi: 0.45, sun: 0.7, sunColor: "#ffb07a", env: 0.5,
  },
  night: {
    top: "#050916", mid: "#0c1630", horizon: "#1c2c4c", fog: "#101713",
    orb: "#eef2ff", orbSize: 5.5, orbDir: [0.2, 0.326, -0.92], halo: 0.55,
    cloud: "#5d6c8c", cloudOpacity: 0.5, stars: 1, hemi: 0.05, sun: 0, sunColor: "#9fb4ff", env: 0.3,
  },
};

/** Day, golden hour or night from the visitor's own clock. `?sky=day|golden|night` forces one (for previews). */
export function currentSkyPhase(): SkyPhase {
  if (typeof window !== "undefined") {
    const forced = new URLSearchParams(window.location.search).get("sky");
    if (forced === "day" || forced === "golden" || forced === "night") return forced;
  }
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  if (h >= 7 && h < 16.75) return "day";
  if ((h >= 5.25 && h < 7) || (h >= 16.75 && h < 18.75)) return "golden";
  return "night";
}

/** Outdoor lamps (floodlights, bollards, neon trim) are on at dusk and night, off by day. */
export function useLit() {
  return useMemo(() => currentSkyPhase() !== "day", []);
}

function softDisc(inner: string, outer = "rgba(255,255,255,0)", stop = 0.35) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, inner);
    g.addColorStop(stop, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

function cloudTexture() {
  return canvasTexture(256, 128, (ctx, w, h) => {
    // A cloud is a handful of overlapping soft puffs.
    const puffs: [number, number, number][] = [[0.28, 0.62, 0.2], [0.44, 0.48, 0.27], [0.6, 0.55, 0.24], [0.75, 0.64, 0.17], [0.5, 0.68, 0.3]];
    for (const [x, y, r] of puffs) {
      const g = ctx.createRadialGradient(x * w, y * h, 0, x * w, y * h, r * w);
      g.addColorStop(0, "rgba(255,255,255,0.95)");
      g.addColorStop(0.6, "rgba(255,255,255,0.55)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  });
}

/** Sky dome, sun or moon, drifting clouds, stars, and the daylight that goes with them. Follows the camera so it never gets closer. */
export function Sky({ mobile }: { mobile: boolean }) {
  const phase = useMemo(currentSkyPhase, []);
  const P = PALETTES[phase];
  const { scene, camera } = useThree();
  const root = useRef<THREE.Group>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const clouds = useRef<THREE.Group>(null);

  const dome = useMemo(() => {
    const t = canvasTexture(4, 256, (ctx, w, h) => {
      // v = 1 is straight up; the horizon sits at the middle of the texture.
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, P.top);
      g.addColorStop(0.28, P.mid);
      g.addColorStop(0.5, P.horizon);
      g.addColorStop(1, P.horizon);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
    return t;
  }, [P]);
  const orbTex = useMemo(() => softDisc(P.orb, "rgba(255,255,255,0)", phase === "night" ? 0.42 : 0.3), [P, phase]);
  const haloTex = useMemo(() => softDisc("rgba(255,255,255,0.5)", "rgba(255,255,255,0)", 0.02), []);
  const cloudTex = useMemo(cloudTexture, []);
  const fogOutside = useMemo(() => new THREE.Color(P.fog), [P]);
  const fogInside = useMemo(() => new THREE.Color("#101713"), []);

  const cloudList = useMemo(() => {
    const n = mobile ? 5 : 9;
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 1.3 - Math.PI * 1.15; // spread across the sky behind and beside the building
      const elev = 0.2 + ((i * 37) % 10) / 28;
      const d = 78;
      return { p: [Math.cos(a) * d * Math.cos(elev), Math.sin(elev) * d, Math.sin(a) * d * Math.cos(elev)] as V, s: 22 + ((i * 53) % 14), drift: 0.25 + ((i * 17) % 10) / 30 };
    });
  }, [mobile]);

  const stars = useMemo(() => {
    const n = mobile ? 260 : 600;
    const pos = new Float32Array(n * 3);
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const e = Math.asin(0.08 + rnd() * 0.9);
      pos.set([Math.cos(a) * Math.cos(e) * 88, Math.sin(e) * 88, Math.sin(a) * Math.cos(e) * 88], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, [mobile]);

  useFrame((_, dt) => {
    // 1 outside, 0 inside, with a short blend through the doorway.
    const out = THREE.MathUtils.clamp((camera.position.z - (DOOR_Z - 6)) / 8, 0, 1);
    if (root.current) {
      root.current.visible = out > 0;
      root.current.position.copy(camera.position);
    }
    if (hemi.current) hemi.current.intensity = P.hemi * out;
    if (sun.current) sun.current.intensity = P.sun * out;
    if (out > 0) scene.environmentIntensity = THREE.MathUtils.lerp(0.38, P.env, out);
    const fog = scene.fog as THREE.Fog | null;
    if (fog) fog.color.copy(fogInside).lerp(fogOutside, out);
    if (clouds.current) clouds.current.children.forEach((c, i) => {
      c.position.x += cloudList[i].drift * dt;
      if (c.position.x > 80) c.position.x = -80;
    });
  });

  const orbAt = new THREE.Vector3(...P.orbDir).normalize().multiplyScalar(84);
  return (
    <>
      <hemisphereLight ref={hemi} args={[P.horizon, "#3a3a34", 0]} />
      <directionalLight ref={sun} position={[P.orbDir[0] * 60, P.orbDir[1] * 60 + 10, 30]} color={P.sunColor} intensity={0} />
      <group ref={root}>
        <mesh renderOrder={-10}>
          <sphereGeometry args={[92, 24, 16]} />
          <meshBasicMaterial map={dome} side={THREE.BackSide} fog={false} depthWrite={false} toneMapped={false} />
        </mesh>
        {P.stars > 0 && (
          <points geometry={stars} renderOrder={-9}>
            <pointsMaterial color="#dfe8ff" size={phase === "night" ? 0.5 : 0.35} sizeAttenuation transparent opacity={P.stars * 0.9} fog={false} depthWrite={false} />
          </points>
        )}
        <sprite position={orbAt} scale={[P.orbSize * 4.2, P.orbSize * 4.2, 1]} renderOrder={-8}>
          <spriteMaterial map={haloTex} color={P.orb} transparent opacity={P.halo * 0.55} fog={false} depthWrite={false} toneMapped={false} />
        </sprite>
        <sprite position={orbAt} scale={[P.orbSize, P.orbSize, 1]} renderOrder={-7}>
          <spriteMaterial map={orbTex} color={phase === "night" ? "#ffffff" : new THREE.Color(P.orb).multiplyScalar(1.6)} transparent fog={false} depthWrite={false} toneMapped={false} />
        </sprite>
        <group ref={clouds}>
          {cloudList.map((c, i) => (
            <sprite key={i} position={c.p} scale={[c.s, c.s * 0.5, 1]} renderOrder={-6}>
              <spriteMaterial map={cloudTex} color={P.cloud} transparent opacity={P.cloudOpacity} fog={false} depthWrite={false} toneMapped={false} />
            </sprite>
          ))}
        </group>
      </group>
    </>
  );
}

/* ------------------------------------------------------------------ facade */

const FRAME = new THREE.MeshStandardMaterial({ color: "#151b18", roughness: 0.4, metalness: 0.6 });
const PLINTH = new THREE.MeshStandardMaterial({ color: "#232b27", roughness: 0.85 });
const GLASS = new THREE.MeshPhysicalMaterial({ color: "#9fd0d6", roughness: 0.05, metalness: 0, transparent: true, opacity: 0.28 });
const LIME_GLOW = new THREE.MeshBasicMaterial({ color: new THREE.Color("#D7FF3F").multiplyScalar(1.7), toneMapped: false });
const WARM_GLOW = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.35, 1.0), toneMapped: false });
// Daytime stand-ins: the same fittings, switched off.
const WARM_OFF = new THREE.MeshStandardMaterial({ color: "#c9c6bc", roughness: 0.35, metalness: 0.2 });
const LIME_PAINT = new THREE.MeshStandardMaterial({ color: "#c4e83a", roughness: 0.55 });

function textTexture(lines: { text: string; size: number; color: string; weight?: number }[], w: number, h: number, bg?: string) {
  return canvasTexture(w, h, (ctx) => {
    if (bg) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const total = lines.reduce((s, l) => s + l.size * 1.15, 0);
    let y = (h - total) / 2;
    for (const l of lines) {
      ctx.font = `${l.weight ?? 800} ${l.size}px ${fonts().display}`;
      ctx.fillStyle = l.color;
      ctx.fillText(l.text, w / 2, y + l.size * 0.575);
      y += l.size * 1.15;
    }
  });
}

/** One framed, back-lit poster per sport along the front wall, five each side of the entrance. */
function SportPosters() {
  const lit = useLit();
  const photos = usePhotoTextures(GALLERY_CLIPS);
  const W = 3.5, H = 4.3;
  const posters = useMemo(
    () =>
      GALLERY_CLIPS.map((clip, i) => {
        const t = photos[i];
        // Square photo shown as a portrait: keep the full height, crop the sides evenly.
        t.repeat.set(W / H, 1);
        t.offset.set((1 - W / H) / 2, 0);
        t.needsUpdate = true;
        const side = i % 2 === 0 ? -1 : 1;
        const slot = Math.floor(i / 2);
        return {
          key: clip.sport, photo: t, x: side * (6.6 + slot * 4.55),
          label: textTexture([{ text: sportById(clip.sport).name.toUpperCase(), size: 54, color: "#f5f7f0" }], 512, 96, "#151b18"),
        };
      }),
    [photos],
  );
  const dim = useMemo(() => new THREE.Color(0.95, 0.95, 0.95), []);
  return (
    <group>
      {posters.map((p) => (
        <group key={p.key} position={[p.x, 5.6, -19.92]}>
          <mesh material={FRAME}>
            <boxGeometry args={[W + 0.24, H + 0.96, 0.12]} />
          </mesh>
          <mesh position={[0, 0.3, 0.065]}>
            <planeGeometry args={[W, H]} />
            <meshBasicMaterial map={p.photo} color={dim} toneMapped={false} />
          </mesh>
          <mesh position={[0, -H / 2 - 0.08, 0.065]}>
            <planeGeometry args={[W, 0.62]} />
            <meshBasicMaterial map={p.label} toneMapped={false} />
          </mesh>
          {/* picture light above each frame */}
          <mesh position={[0, H / 2 + 0.62, 0.22]} material={lit ? WARM_GLOW : WARM_OFF}>
            <boxGeometry args={[W * 0.7, 0.05, 0.08]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ---------------------------------------------------------------- cut-outs */

const PROP = (name: string) => `/assets/props/${name}.webp`;
export const PROP_IMAGES = ["tree", "planter"].map(PROP);

/**
 * A photo cut-out standing on the ground: the plane turns about its vertical axis to face the camera,
 * so it always reads as the picture. Outside is only ever seen from the plaza, which keeps this convincing.
 * `h` is the height in metres; the width follows the picture. A soft blob shadow sits underneath.
 */
function Cutout({ name, position, h, flip = false, shadow = 0.5 }: { name: string; position: V; h: number; flip?: boolean; shadow?: number }) {
  const tex = useLoader(THREE.TextureLoader, PROP(name));
  const { camera } = useThree();
  const ref = useRef<THREE.Group>(null);
  const mat = useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.45, roughness: 1, metalness: 0, side: THREE.DoubleSide });
  }, [tex]);
  const img = tex.image as { width: number; height: number };
  const w = (h * img.width) / img.height;
  useFrame(() => {
    const g = ref.current;
    if (g) g.rotation.y = Math.atan2(camera.position.x - g.position.x, camera.position.z - g.position.z);
  });
  return (
    <group ref={ref} position={position}>
      <mesh position={[0, h / 2, 0]} scale={[flip ? -1 : 1, 1, 1]} material={mat}>
        <planeGeometry args={[w, h]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} scale={[1, 0.45, 1]}>
        <circleGeometry args={[w * 0.46, 24]} />
        <meshBasicMaterial map={BLOB} transparent opacity={shadow} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

const BLOB = softDisc("rgba(0,0,0,0.85)", "rgba(0,0,0,0)", 0.15);

/** Sign, open glass doors, welcome mat and planters around the entrance. The opening itself stays clear for the camera. */
function Entrance() {
  const lit = useLit();
  const lime = lit ? LIME_GLOW : LIME_PAINT;
  const warm = lit ? WARM_GLOW : WARM_OFF;
  const sign = useMemo(() => textTexture([{ text: "PLAYBOOK", size: 150, color: "#D7FF3F" }, { text: "BOOK  ·  PLAY  ·  REPLAY", size: 44, color: "#f5f7f0", weight: 700 }], 1024, 300), []);
  const welcome = useMemo(() => textTexture([{ text: "WELCOME  ·  TULOY PO KAYO", size: 62, color: "#151b18" }], 1024, 110, "#D7FF3F"), []);
  const mat = useMemo(() => textTexture([{ text: "WELCOME", size: 120, color: "#151b18" }], 512, 256, "#c8ee3a"), []);
  const door = useMemo(() => {
    const frame = mergeGeometries([box(0.08, 5.9, 0.08, [0.04, 2.95, 0]), box(0.08, 5.9, 0.08, [1.86, 2.95, 0]), box(1.9, 0.08, 0.08, [0.95, 5.86, 0]), box(1.9, 0.14, 0.08, [0.95, 0.07, 0]), box(1.9, 0.08, 0.08, [0.95, 2.9, 0])])!;
    const pane = box(1.74, 5.7, 0.03, [0.95, 2.95, 0]);
    const handle = box(0.05, 1.1, 0.07, [1.66, 2.6, 0.07]);
    return { frame, pane, handle };
  }, []);
  return (
    <group>
      {/* sign on a dark panel above the canopy, so it reads in daylight too */}
      <mesh position={[0, 11.1, -19.96]} material={FRAME}>
        <boxGeometry args={[8.2, 2.7, 0.1]} />
      </mesh>
      <mesh position={[0, 11.1, -19.9]}>
        <planeGeometry args={[7.4, 2.17]} />
        <meshBasicMaterial map={sign} transparent toneMapped={false} />
      </mesh>
      {/* welcome band on the canopy edge */}
      <mesh position={[0, 8.62, -15.08]}>
        <planeGeometry args={[9, 0.5]} />
        <meshBasicMaterial map={welcome} toneMapped={false} />
      </mesh>
      {/* double glass doors, swung open against the wall on each side */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 4.0, 0, -19.9]} rotation={[0, s > 0 ? -1.19 : -1.95, 0]}>
          <mesh geometry={door.frame} material={FRAME} />
          <mesh geometry={door.pane} material={GLASS} />
          <mesh geometry={door.handle} material={lime} />
        </group>
      ))}
      {/* runner from the plaza to the door, with a mat at the threshold */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, -15.4]}>
        <planeGeometry args={[4.4, 7.6]} />
        <meshStandardMaterial color="#1b4a80" roughness={0.9} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} rotation={[-Math.PI / 2, 0, 0]} position={[s * 2.26, 0.014, -15.4]} material={lime}>
          <planeGeometry args={[0.07, 7.6]} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -12.6]}>
        <planeGeometry args={[3.2, 1.5]} />
        <meshBasicMaterial map={mat} toneMapped={false} />
      </mesh>
      {/* bollard lights along the runner */}
      {[-1, 1].flatMap((s) => [-17.5, -14.5, -11.5].map((z) => (
        <group key={`${s}${z}`} position={[s * 2.9, 0, z]}>
          <mesh position={[0, 0.4, 0]} material={FRAME}>
            <cylinderGeometry args={[0.07, 0.07, 0.8, 8]} />
          </mesh>
          <mesh position={[0, 0.84, 0]} material={warm}>
            <cylinderGeometry args={[0.09, 0.09, 0.1, 8]} />
          </mesh>
        </group>
      )))}
      <Cutout name="planter" position={[-5.3, 0, -18.4]} h={1.9} shadow={0.35} />
      <Cutout name="planter" position={[5.3, 0, -18.4]} h={1.9} shadow={0.35} flip />
      <Cutout name="planter" position={[-3.6, 0, -11.2]} h={1.5} shadow={0.35} />
      <Cutout name="planter" position={[3.6, 0, -11.2]} h={1.5} shadow={0.35} flip />
      {/* dark plinth along the foot of the wall */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 17, 0.22, -19.9]} material={PLINTH}>
          <boxGeometry args={[26, 0.44, 0.24]} />
        </mesh>
      ))}
    </group>
  );
}

/* -------------------------------------------------------------- floodlights */

/** A floodlight face: a grid of LED heads in a dark housing, glowing when on. */
function ledTexture(on: boolean) {
  return canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = "#171c1a";
    ctx.fillRect(0, 0, w, h);
    const cols = 8, rows = 4;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = (c + 0.5) * (w / cols), y = (r + 0.5) * (h / rows);
        if (on) {
          const g = ctx.createRadialGradient(x, y, 0, x, y, 15);
          g.addColorStop(0, "#ffffff");
          g.addColorStop(0.55, "#fff6dc");
          g.addColorStop(1, "rgba(255,240,200,0)");
          ctx.fillStyle = g;
        } else {
          const g = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, 11);
          g.addColorStop(0, "#8d9592");
          g.addColorStop(1, "#3a413e");
          ctx.fillStyle = g;
        }
        ctx.beginPath();
        ctx.arc(x, y, on ? 15 : 11, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
}

const STEEL = new THREE.MeshStandardMaterial({ color: "#8f979b", roughness: 0.45, metalness: 0.75 });
const HOUSING = new THREE.MeshStandardMaterial({ color: "#2a302d", roughness: 0.6, metalness: 0.5 });
const FOOTING = new THREE.MeshStandardMaterial({ color: "#a7aaa2", roughness: 0.95 });
const TOWER_H = 15;

/**
 * Stadium floodlight masts along the far side of the outdoor court. Each head is a 3 x 2 bank of
 * LED fixtures tilted down at the court. They switch on at dusk (glow, haze and a real spotlight)
 * and stay off by day.
 */
export function FloodTowers({ mobile, target }: { mobile: boolean; target: [number, number] }) {
  const lit = useLit();
  const face = useMemo(() => {
    const t = ledTexture(lit);
    return lit
      ? new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(2.2, 2.1, 1.9), toneMapped: false })
      : new THREE.MeshStandardMaterial({ map: t, roughness: 0.3, metalness: 0.3 });
  }, [lit]);
  const haze = useMemo(() => softDisc("rgba(255,246,220,0.85)", "rgba(255,240,210,0)", 0.08), []);
  const head = useMemo(() => {
    const g: THREE.BufferGeometry[] = [box(4.1, 0.12, 0.12, [0, 1.62, -0.3]), box(4.1, 0.12, 0.12, [0, -0.1, -0.3])];
    for (const x of [-2, 0, 2]) g.push(box(0.12, 1.84, 0.12, [x, 0.76, -0.3]));
    return mergeGeometries(g)!;
  }, []);
  // Behind each baseline, either side of the court, aimed down its length. The pair at the
  // building end faces the camera on the way in; the street-end pair is behind it.
  const [cx, cz] = target;
  const masts: { p: V; aim: V }[] = [
    { p: [cx - 7.6, 0, cz - 16.6], aim: [cx - 1.5, 0, cz + 1] },
    { p: [cx + 7.6, 0, cz - 16.6], aim: [cx + 1.5, 0, cz + 1] },
    { p: [cx - 7.6, 0, cz + 16.8], aim: [cx - 1.5, 0, cz - 1] },
    { p: [cx + 7.6, 0, cz + 16.8], aim: [cx + 1.5, 0, cz - 1] },
  ];
  return (
    <group>
      {(mobile ? masts.slice(0, 2) : masts).map((m) => (
        <FloodTower key={m.p.join()} position={m.p} aim={m.aim} face={face} head={head} haze={haze} lit={lit} />
      ))}
    </group>
  );
}

function FloodTower({ position, aim, face, head, haze, lit }: { position: V; aim: V; face: THREE.Material; head: THREE.BufferGeometry; haze: THREE.Texture; lit: boolean }) {
  const yaw = Math.atan2(aim[0] - position[0], aim[2] - position[2]);
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(...aim);
    return o;
  }, [aim]);
  const top: V = [position[0] + Math.sin(yaw) * 0.6, TOWER_H + 0.8, position[2] + Math.cos(yaw) * 0.6];
  return (
    <>
      <group position={position} rotation={[0, yaw, 0]} userData={{ caster: true }}>
        <mesh position={[0, 0.3, 0]} material={FOOTING}>
          <boxGeometry args={[1.3, 0.6, 1.3]} />
        </mesh>
        <mesh position={[0, TOWER_H / 2 + 0.6, 0]} material={STEEL}>
          <cylinderGeometry args={[0.16, 0.3, TOWER_H, 12]} />
        </mesh>
        {/* service ladder */}
        <mesh position={[0, TOWER_H / 2 + 0.6, -0.34]} material={STEEL}>
          <boxGeometry args={[0.36, TOWER_H - 1, 0.04]} />
        </mesh>
        <group position={[0, TOWER_H + 0.1, 0.25]} rotation={[0.42, 0, 0]}>
          <mesh geometry={head} material={STEEL} />
          {[0, 1].flatMap((r) =>
            [-1.35, 0, 1.35].map((fx) => (
              <group key={`${r}${fx}`} position={[fx, 0.3 + r * 0.92, 0]}>
                <mesh material={HOUSING}>
                  <boxGeometry args={[1.25, 0.82, 0.32]} />
                </mesh>
                <mesh position={[0, 0, 0.165]} material={face}>
                  <planeGeometry args={[1.12, 0.7]} />
                </mesh>
              </group>
            )),
          )}
        </group>
      </group>
      {lit && (
        <>
          <sprite position={top} scale={[10, 7, 1]}>
            <spriteMaterial map={haze} transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </sprite>
          <primitive object={target} />
          <spotLight position={top} target={target} angle={0.62} penumbra={0.75} intensity={210} distance={55} decay={1.35} color="#fff4e0" />
        </>
      )}
    </>
  );
}

/* ------------------------------------------------------------ facade detail */

const TINT_GLASS = new THREE.MeshPhysicalMaterial({ color: "#1f2c33", roughness: 0.08, metalness: 0.65, envMapIntensity: 1.4 });
const LIT_GLASS = new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffcf8a").multiplyScalar(0.55), toneMapped: false });

/** Steel pilasters between the posters, a clerestory window band, and a parapet coping, so the wall reads as a building. */
function FacadeDetail() {
  const lit = useLit();
  const pilasters = [4.5, 8.875, 13.425, 17.975, 22.525, 27.1, 29.85].flatMap((x) => [-x, x]);
  const frame = useMemo(() => {
    const g: THREE.BufferGeometry[] = [];
    for (const x of pilasters) g.push(box(0.45, 14.2, 0.42, [x, 7.1, -19.82]));
    g.push(box(60.6, 0.5, 1.4, [0, 14.2, -20.3])); // coping
    for (const s of [-1, 1]) {
      g.push(box(25.2, 0.16, 0.16, [s * 17.2, 9.2, -19.9]), box(25.2, 0.16, 0.16, [s * 17.2, 12.4, -19.9]));
      for (let x = 4.75; x < 29.8; x += 1.55) g.push(box(0.07, 3.2, 0.1, [s * x, 10.8, -19.92]));
    }
    return mergeGeometries(g)!;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <group>
      <mesh geometry={frame} material={FRAME} />
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 17.2, 10.8, -19.97]} material={lit ? LIT_GLASS : TINT_GLASS}>
          <planeGeometry args={[25.2, 3.1]} />
        </mesh>
      ))}
    </group>
  );
}

/* --------------------------------------------------------------------- cars */

type CarKind = "sedan" | "suv";
interface CarSpec { body: [number, number][]; arches: [number, number]; wheelR: number; floor: number; glass: [number, number][]; width: number; roof: [number, number, number] }

// Side profiles in metres (x = along the car, nose at +x; y = up). Wheel arches are cut from the bottom edge.
const CAR_SPECS: Record<CarKind, CarSpec> = {
  sedan: {
    floor: 0.3, wheelR: 0.31, arches: [1.33, 0.4], width: 1.72,
    body: [[2.18, 0.3], [2.28, 0.5], [2.23, 0.72], [1.95, 0.86], [1.1, 0.98], [-1.15, 0.98], [-1.65, 0.97], [-2.15, 0.9], [-2.27, 0.66], [-2.2, 0.3]],
    glass: [[1.1, 0.97], [0.32, 1.42], [-0.62, 1.43], [-1.18, 0.97]],
    roof: [0.92, -0.15, 1.43],
  },
  suv: {
    floor: 0.42, wheelR: 0.38, arches: [1.45, 0.47], width: 1.86,
    body: [[2.36, 0.42], [2.42, 0.76], [2.32, 1.0], [1.62, 1.1], [1.25, 1.16], [-2.3, 1.16], [-2.42, 0.92], [-2.38, 0.42]],
    glass: [[1.25, 1.15], [0.5, 1.78], [-2.1, 1.8], [-2.33, 1.15]],
    roof: [2.5, -0.8, 1.8],
  },
};

const TYRE = new THREE.MeshStandardMaterial({ color: "#151616", roughness: 0.9 });
const RIM = new THREE.MeshStandardMaterial({ color: "#c7cbcd", roughness: 0.25, metalness: 0.9 });
const CAR_GLASS = new THREE.MeshPhysicalMaterial({ color: "#10171c", roughness: 0.05, metalness: 0.5, envMapIntensity: 1.6 });
const TRIM = new THREE.MeshStandardMaterial({ color: "#101213", roughness: 0.5 });
const TAIL_OFF = new THREE.MeshStandardMaterial({ color: "#6e1414", roughness: 0.3 });
const TAIL_ON = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.1, 0.08), toneMapped: false });
const HEAD_OFF = new THREE.MeshStandardMaterial({ color: "#dfe6ea", roughness: 0.1, metalness: 0.6 });
const carGeoCache = new Map<CarKind, { body: THREE.BufferGeometry; glass: THREE.BufferGeometry; tyre: THREE.BufferGeometry; rim: THREE.BufferGeometry }>();

function carGeometry(kind: CarKind) {
  const hit = carGeoCache.get(kind);
  if (hit) return hit;
  const S = CAR_SPECS[kind];
  const [ax, ar] = S.arches;
  const shape = new THREE.Shape();
  const [first, ...rest] = S.body;
  // Bottom edge runs from the rear to the nose, hopping over both wheels.
  shape.moveTo(-first[0], S.floor);
  shape.lineTo(-ax - ar, S.floor);
  shape.absarc(-ax, S.floor, ar, Math.PI, 0, true);
  shape.lineTo(ax - ar, S.floor);
  shape.absarc(ax, S.floor, ar, Math.PI, 0, true);
  shape.lineTo(first[0], first[1]);
  for (const [x, y] of rest) shape.lineTo(x, y);
  const bevel = 0.09;
  const body = new THREE.ExtrudeGeometry(shape, { depth: S.width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: 0.07, bevelSegments: 5, curveSegments: 12, steps: 1 });
  body.translate(0, 0, -(S.width - bevel * 2) / 2);
  const gShape = new THREE.Shape(S.glass.map(([x, y]) => new THREE.Vector2(x, y)));
  const gw = S.width - 0.34;
  const glass = new THREE.ExtrudeGeometry(gShape, { depth: gw - 0.1, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 3 });
  glass.translate(0, 0, -(gw - 0.1) / 2);
  // Shape it like a car rather than a slab: sides lean in towards the top, the ends round off
  // in plan, and the glasshouse narrows towards the roof (tumblehome).
  const belt = Math.max(...S.body.map((p) => p[1]));
  const roofY = Math.max(...S.glass.map((p) => p[1]));
  const len = first[0];
  const shapeIt = (src: THREE.BufferGeometry, top: (y: number) => number) => {
    // Weld the extrusion so the paint shades as one smooth surface, not facets.
    src.deleteAttribute("normal");
    src.deleteAttribute("uv");
    const g = mergeVertices(src, 1e-4);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const end = Math.max(0, (Math.abs(x) / len - 0.72) / 0.28);
      pos.setZ(i, pos.getZ(i) * top(y) * (1 - 0.2 * end * end));
    }
    g.computeVertexNormals();
    return g;
  };
  const bodyGeo = shapeIt(body, (y) => 1 - 0.07 * Math.pow(THREE.MathUtils.clamp((y - S.floor) / (belt - S.floor), 0, 1), 2));
  const glassGeo = shapeIt(glass, (y) => 1 - 0.22 * THREE.MathUtils.clamp((y - belt) / (roofY - belt), 0, 1));
  const tyre = new THREE.CylinderGeometry(S.wheelR, S.wheelR, 0.24, 24).rotateX(Math.PI / 2);
  const rim = new THREE.CylinderGeometry(S.wheelR * 0.62, S.wheelR * 0.62, 0.02, 18).rotateX(Math.PI / 2);
  const out = { body: bodyGeo, glass: glassGeo, tyre, rim };
  carGeoCache.set(kind, out);
  return out;
}

/** A parked car modelled in 3D: extruded body with rounded edges, tinted glasshouse, wheels and lamps. Sits on the ground. */
function Car({ kind, color, position, yaw = 0, lit }: { kind: CarKind; color: string; position: V; yaw?: number; lit: boolean }) {
  const S = CAR_SPECS[kind];
  const geo = carGeometry(kind);
  const paint = useMemo(() => new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.06 }), [color]);
  const half = S.width / 2;
  const nose = S.body[0][0];
  const [rl, rx, ry] = S.roof;
  return (
    <group position={position} rotation={[0, yaw, 0]} userData={{ caster: true }}>
      <mesh geometry={geo.body} material={paint} castShadow />
      <mesh geometry={geo.glass} material={CAR_GLASS} />
      <mesh position={[rx, ry, 0]} material={paint}>
        <boxGeometry args={[rl, 0.05, (S.width - 0.34) * 0.76]} />
      </mesh>
      {/* bumpers' black lower trim */}
      <mesh position={[0, S.floor + 0.06, 0]} material={TRIM}>
        <boxGeometry args={[nose * 2 + 0.02, 0.12, S.width - 0.06]} />
      </mesh>
      {[-1, 1].flatMap((fx) =>
        [-1, 1].map((sz) => (
          <group key={`${fx}${sz}`} position={[fx * S.arches[0], S.wheelR, sz * (half - 0.14)]}>
            <mesh geometry={geo.tyre} material={TYRE} />
            <mesh geometry={geo.rim} material={RIM} position={[0, 0, sz * 0.12]} />
          </group>
        )),
      )}
      {[-1, 1].map((sz) => (
        <group key={sz}>
          <mesh position={[nose + 0.02, S.floor + (kind === "suv" ? 0.5 : 0.38), sz * (half - 0.3)]} rotation={[0, Math.PI / 2, 0]} material={lit ? WARM_GLOW : HEAD_OFF}>
            <planeGeometry args={[0.42, 0.13]} />
          </mesh>
          <mesh position={[-S.body[S.body.length - 1][0] - 0.04, S.floor + (kind === "suv" ? 0.52 : 0.42), sz * (half - 0.25)]} rotation={[0, -Math.PI / 2, 0]} material={lit ? TAIL_ON : TAIL_OFF}>
            <planeGeometry args={[0.4, 0.12]} />
          </mesh>
        </group>
      ))}
      {/* soft contact shadow so it reads as resting on the asphalt */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <planeGeometry args={[nose * 2 + 0.7, S.width + 0.7]} />
        <meshBasicMaterial map={BLOB} transparent opacity={0.75} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------- food stalls */

type StallKind = "tusok" | "buko";
const STALLS: Record<StallKind, { title: string; sub: string; ink: string; stripe: string; frame: string; planks: "v" | "h" }> = {
  tusok: { title: "TUSOK-TUSOK", sub: "FISHBALL · KWEK-KWEK · ISAW", ink: "#b3201c", stripe: "#c42a24", frame: "#3a4044", planks: "v" },
  buko: { title: "FRESH BUKO", sub: "BUKO JUICE · HALO-HALO", ink: "#1f6a3a", stripe: "#22703f", frame: "#2d5238", planks: "h" },
};

/** Sign face: cream board, bold name, smaller menu line, thin inner border in the stall colour. */
function stallSign(title: string, sub: string, ink: string) {
  return canvasTexture(1024, 288, (ctx, w, h) => {
    ctx.fillStyle = "#f4ead2";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 8;
    ctx.strokeRect(18, 18, w - 36, h - 36);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = ink;
    ctx.font = `800 128px ${fonts().display}`;
    ctx.fillText(title, w / 2, h * 0.42, w - 90);
    ctx.fillStyle = "#2b2a26";
    ctx.font = `700 50px ${fonts().display}`;
    ctx.fillText(sub, w / 2, h * 0.78, w - 110);
  });
}

/** Awning cloth: cream and colour stripes; `scallop` cuts the hanging edge into half-circles (alpha). */
function awningTexture(color: string, scallop: boolean) {
  return canvasTexture(512, scallop ? 96 : 256, (ctx, w, h) => {
    const n = 10, sw = w / n;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i % 2 ? "#f1e6cc" : color;
      ctx.fillRect(i * sw, 0, sw, h);
    }
    if (scallop) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "#000";
      for (let i = 0; i < n; i++) {
        ctx.beginPath();
        ctx.ellipse((i + 1) * sw, h, sw / 2, h * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    }
    // a little fold shading
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.12)");
    ctx.fillStyle = g;
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";
  });
}

function plankTexture(dir: "v" | "h") {
  return canvasTexture(512, 256, (ctx, w, h) => {
    const n = dir === "v" ? 12 : 6;
    let seed = dir === "v" ? 3 : 9;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = `hsl(${27 + rnd() * 6}, ${48 + rnd() * 10}%, ${40 + rnd() * 9}%)`;
      if (dir === "v") ctx.fillRect((i * w) / n, 0, w / n, h);
      else ctx.fillRect(0, (i * h) / n, w, h / n);
      ctx.fillStyle = "rgba(40,20,6,0.55)";
      if (dir === "v") ctx.fillRect((i * w) / n, 0, 2, h);
      else ctx.fillRect(0, (i * h) / n, w, 2);
    }
    ctx.strokeStyle = "rgba(60,30,10,0.14)";
    for (let k = 0; k < 90; k++) {
      ctx.beginPath();
      if (dir === "v") {
        const x = rnd() * w;
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x + 3, h * 0.3, x - 3, h * 0.6, x + 1, h);
      } else {
        const y = rnd() * h;
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(w * 0.3, y + 2, w * 0.6, y - 2, w, y + 1);
      }
      ctx.stroke();
    }
  });
}

const STAINLESS = new THREE.MeshStandardMaterial({ color: "#c9cdcf", roughness: 0.28, metalness: 0.9 });
const JAR_GLASS = new THREE.MeshPhysicalMaterial({ color: "#e8f2f2", roughness: 0.05, transparent: true, opacity: 0.35 });
const BULB_OFF = new THREE.MeshStandardMaterial({ color: "#e9e4d6", roughness: 0.15, transparent: true, opacity: 0.8 });

/** Spheres for food piles (fishballs, kwek-kwek, coconuts), one draw call per pile. */
function Pile({ items, r, color, roughness = 0.7 }: { items: V[]; r: number; color: string; roughness?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    items.forEach((p, i) => ref.current?.setMatrixAt(i, m.makeTranslation(...p)));
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
  }, [items]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]}>
      <sphereGeometry args={[r, 12, 9]} />
      <meshStandardMaterial color={color} roughness={roughness} />
    </instancedMesh>
  );
}

function grid(nx: number, nz: number, step: number, y: number, jitter = 0): V[] {
  const out: V[] = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) out.push([(i - (nx - 1) / 2) * step + ((i * 7 + j * 3) % 5 - 2) * jitter, y, (j - (nz - 1) / 2) * step]);
  return out;
}

/**
 * A street-food stall modelled in 3D, standing on its four feet: steel frame, wooden counter with a
 * stainless top, striped awning with a scalloped edge, a lit menu board on top, and the food on the counter.
 * Front faces local +Z. 3 m wide, 1.5 m deep, about 3.6 m to the top of the sign.
 */
function Stall({ kind, position, yaw }: { kind: StallKind; position: V; yaw: number }) {
  const lit = useLit();
  const S = STALLS[kind];
  const tex = useMemo(() => {
    const planks = plankTexture(S.planks);
    planks.wrapS = planks.wrapT = THREE.RepeatWrapping;
    return { sign: stallSign(S.title, S.sub, S.ink), cloth: awningTexture(S.stripe, false), valance: awningTexture(S.stripe, true), planks };
  }, [S]);
  const frame = useMemo(() => new THREE.MeshStandardMaterial({ color: S.frame, roughness: 0.45, metalness: 0.6 }), [S]);
  const frameGeo = useMemo(() => {
    const g: THREE.BufferGeometry[] = [];
    for (const x of [-1.45, 1.45]) {
      for (const z of [-0.68, 0.68]) g.push(box(0.07, z > 0 ? 2.2 : 2.78, 0.07, [x, z > 0 ? 1.1 : 1.39, z]));
      g.push(box(0.05, 0.05, 1.42, [x, 0.08, 0]));
      g.push(box(0.06, 1.0, 0.06, [x * 0.82, 3.06, -0.68])); // sign posts
    }
    g.push(box(2.96, 0.05, 0.05, [0, 0.08, 0.68]), box(2.96, 0.05, 0.05, [0, 0.08, -0.68]));
    // levelling feet, so it visibly stands on the paving
    for (const x of [-1.45, 1.45]) for (const z of [-0.68, 0.68]) g.push(box(0.12, 0.03, 0.12, [x, 0.015, z]));
    return mergeGeometries(g)!;
  }, []);
  const bulbs = Array.from({ length: 8 }, (_, i) => -1.26 + i * 0.36);
  return (
    <group position={position} rotation={[0, yaw, 0]} userData={{ caster: true }}>
      <mesh geometry={frameGeo} material={frame} castShadow />
      {/* counter: wooden front and sides, stainless top */}
      <mesh position={[0, 0.52, 0.12]} castShadow>
        <boxGeometry args={[2.86, 0.88, 1.0]} />
        <meshStandardMaterial map={tex.planks} roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.98, 0.16]} material={kind === "tusok" ? STAINLESS : undefined}>
        <boxGeometry args={[3.0, 0.05, 1.12]} />
        {kind === "buko" && <meshStandardMaterial color="#b77a45" roughness={0.5} />}
      </mesh>
      {/* back panel (so you never see through to the sky) */}
      <mesh position={[0, 1.7, -0.69]}>
        <boxGeometry args={[2.86, 1.4, 0.03]} />
        <meshStandardMaterial color={kind === "tusok" ? "#d8d2c4" : "#e3dccb"} roughness={0.8} />
      </mesh>
      {/* awning: sloped cloth, scalloped valance */}
      <mesh position={[0, 2.56, 0.08]} rotation={[-Math.PI / 2 + 0.36, 0, 0]}>
        <planeGeometry args={[3.2, 1.75]} />
        <meshStandardMaterial map={tex.cloth} roughness={0.85} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 2.12, 0.92]}>
        <planeGeometry args={[3.2, 0.3]} />
        <meshStandardMaterial map={tex.valance} roughness={0.85} alphaTest={0.5} side={THREE.DoubleSide} />
      </mesh>
      {/* menu board on top */}
      <mesh position={[0, 3.32, -0.66]} material={frame}>
        <boxGeometry args={[2.9, 0.86, 0.08]} />
      </mesh>
      <mesh position={[0, 3.32, -0.615]}>
        <planeGeometry args={[2.78, 0.76]} />
        {lit ? <meshBasicMaterial map={tex.sign} color={new THREE.Color(1.05, 1.02, 0.95)} toneMapped={false} /> : <meshStandardMaterial map={tex.sign} roughness={0.6} />}
      </mesh>
      {/* lights under the awning: string bulbs or pendant shades */}
      {kind === "tusok"
        ? bulbs.map((x) => (
            <mesh key={x} position={[x, 1.9 - Math.abs(Math.sin(x * 2.2)) * 0.05, 0.62]} material={lit ? WARM_GLOW : BULB_OFF}>
              <sphereGeometry args={[0.05, 10, 8]} />
            </mesh>
          ))
        : [-0.95, 0, 0.95].map((x) => (
            <group key={x} position={[x, 1.98, 0.15]}>
              <mesh position={[0, 0.3, 0]} material={frame}>
                <cylinderGeometry args={[0.01, 0.01, 0.6, 4]} />
              </mesh>
              <mesh material={frame}>
                <coneGeometry args={[0.17, 0.14, 16, 1, true]} />
              </mesh>
              <mesh position={[0, -0.06, 0]} material={lit ? WARM_GLOW : BULB_OFF}>
                <sphereGeometry args={[0.06, 10, 8]} />
              </mesh>
            </group>
          ))}
      {kind === "tusok" ? <TusokGoods /> : <BukoGoods />}
      {lit && <pointLight position={[0, 1.9, 0.6]} intensity={6} distance={6} decay={1.6} color="#ffd9a0" />}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0.05]}>
        <planeGeometry args={[3.8, 2.3]} />
        <meshBasicMaterial map={BLOB} transparent opacity={0.6} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Fryer with a basket, trays of fishballs and kwek-kwek, a cup of skewers and three sauce jars. */
function TusokGoods() {
  const top = 1.005;
  const fish = useMemo(() => grid(5, 3, 0.075, 0.035, 0.004), []);
  const kwek = useMemo(() => grid(5, 3, 0.08, 0.04, 0.004), []);
  return (
    <group position={[0, top, 0.25]}>
      <mesh position={[-1.0, 0.13, 0]} material={STAINLESS}>
        <boxGeometry args={[0.6, 0.26, 0.48]} />
      </mesh>
      <mesh position={[-1.0, 0.3, 0]} material={STAINLESS}>
        <cylinderGeometry args={[0.2, 0.18, 0.1, 20, 1, true]} />
      </mesh>
      <mesh position={[-1.0, 0.33, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.19, 20]} />
        <meshStandardMaterial color="#c99a2e" roughness={0.2} metalness={0.2} />
      </mesh>
      <mesh position={[-0.82, 0.42, 0.02]} rotation={[0, 0, -0.5]} material={HOUSING}>
        <cylinderGeometry args={[0.015, 0.015, 0.3, 6]} />
      </mesh>
      {[-0.32, 0.18].map((x, i) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 0.02, 0]} material={STAINLESS}>
            <boxGeometry args={[0.44, 0.04, 0.3]} />
          </mesh>
          {i === 0 ? <Pile items={fish} r={0.033} color="#efe2c4" /> : <Pile items={kwek} r={0.038} color="#f07a1a" roughness={0.5} />}
        </group>
      ))}
      <mesh position={[0.58, 0.09, 0]} material={STAINLESS}>
        <cylinderGeometry args={[0.06, 0.06, 0.18, 14]} />
      </mesh>
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} position={[0.58 + Math.cos(i * 2.4) * 0.03, 0.28, Math.sin(i * 2.4) * 0.03]} rotation={[Math.sin(i) * 0.12, 0, Math.cos(i) * 0.12]}>
          <cylinderGeometry args={[0.004, 0.004, 0.34, 4]} />
          <meshStandardMaterial color="#d9b77a" roughness={0.8} />
        </mesh>
      ))}
      {["#5a2a12", "#c23a1c", "#e8b9a8"].map((c, i) => (
        <group key={c} position={[0.82 + i * 0.17, 0, 0]}>
          <mesh position={[0, 0.07, 0]}>
            <cylinderGeometry args={[0.055, 0.055, 0.12, 14]} />
            <meshStandardMaterial color={c} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.1, 0]} material={JAR_GLASS}>
            <cylinderGeometry args={[0.065, 0.065, 0.2, 14]} />
          </mesh>
          <mesh position={[0, 0.21, 0]} material={STAINLESS}>
            <cylinderGeometry args={[0.067, 0.067, 0.025, 14]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Crate with a pile of young coconuts, a glass buko-juice dispenser and a halo-halo display case. */
function BukoGoods() {
  const top = 1.005;
  const coconuts = useMemo(() => {
    const out: V[] = [];
    const layers: [number, number, number][] = [[4, 2, 0.13], [3, 1, 0.33], [2, 1, 0.52]];
    layers.forEach(([nx, nz, y]) => {
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) out.push([(i - (nx - 1) / 2) * 0.24, y, (j - (nz - 1) / 2) * 0.24]);
    });
    return out;
  }, []);
  const cups = useMemo(() => grid(3, 2, 0.13, 0, 0), []);
  return (
    <group position={[0, top, 0.25]}>
      <group position={[-0.85, 0, 0]}>
        <mesh position={[0, 0.06, 0]}>
          <boxGeometry args={[1.0, 0.12, 0.55]} />
          <meshStandardMaterial color="#b58a55" roughness={0.85} />
        </mesh>
        <Pile items={coconuts} r={0.13} color="#5f9a2c" roughness={0.6} />
      </group>
      <group position={[0.15, 0, 0]}>
        <mesh position={[0, 0.03, 0]} material={STAINLESS}>
          <cylinderGeometry args={[0.15, 0.15, 0.06, 18]} />
        </mesh>
        <mesh position={[0, 0.24, 0]}>
          <cylinderGeometry args={[0.13, 0.13, 0.34, 18]} />
          <meshStandardMaterial color="#e9ecd8" roughness={0.3} transparent opacity={0.85} />
        </mesh>
        <mesh position={[0, 0.27, 0]} material={JAR_GLASS}>
          <cylinderGeometry args={[0.15, 0.15, 0.44, 18]} />
        </mesh>
        <mesh position={[0, 0.51, 0]} material={JAR_GLASS}>
          <sphereGeometry args={[0.07, 12, 8]} />
        </mesh>
      </group>
      <group position={[0.82, 0, 0]}>
        <mesh position={[0, 0.26, 0]} material={JAR_GLASS}>
          <boxGeometry args={[0.62, 0.52, 0.42]} />
        </mesh>
        {[0.03, 0.27].map((y) => (
          <group key={y} position={[0, y, 0]}>
            {cups.map((p, i) => (
              <group key={i} position={p}>
                <mesh position={[0, 0.07, 0]}>
                  <cylinderGeometry args={[0.045, 0.035, 0.14, 12]} />
                  <meshStandardMaterial color={i % 2 ? "#e7b13a" : "#c45a8a"} roughness={0.5} />
                </mesh>
                <mesh position={[0, 0.16, 0]}>
                  <sphereGeometry args={[0.043, 12, 8]} />
                  <meshStandardMaterial color="#8b5bb8" roughness={0.6} />
                </mesh>
              </group>
            ))}
          </group>
        ))}
      </group>
    </group>
  );
}

/* ---------------------------------------------------------------- car park */

/** A row of marked bays on the left of the plaza, a parking sign and a few parked cars. */
function CarPark({ mobile }: { mobile: boolean }) {
  const X = -15.5, BAY = 2.7, LEN = 5.2;
  const bays = [13.2, 10.5, 7.8, 5.1, 2.4, -0.3, -3.0];
  const sign = useMemo(() => textTexture([{ text: "P", size: 190, color: "#ffffff" }], 256, 256, "#1b57b8"), []);
  const lines = useMemo(() => {
    const g: THREE.BufferGeometry[] = [];
    for (const z of [...bays, bays[bays.length - 1] - BAY]) g.push(box(LEN, 0.01, 0.1, [X, 0.012, z + BAY / 2]));
    g.push(box(0.1, 0.01, bays.length * BAY, [X - LEN / 2, 0.012, (bays[0] + bays[bays.length - 1]) / 2]));
    return mergeGeometries(g)!;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const stops = useMemo(() => mergeGeometries(bays.map((z) => box(0.18, 0.12, 1.7, [X - LEN / 2 + 0.45, 0.06, z])))!, []); // eslint-disable-line react-hooks/exhaustive-deps
  const lit = useLit();
  // Nose-in and nose-out, one bay left free, like a real lot.
  const cars: { z: number; kind: CarKind; color: string; yaw: number }[] = [
    { z: 13.2, kind: "sedan", color: "#e9ebe8", yaw: 0 },
    { z: 10.5, kind: "suv", color: "#2e3336", yaw: Math.PI },
    { z: 7.8, kind: "sedan", color: "#8c1d1d", yaw: 0 },
    { z: 2.4, kind: "suv", color: "#e3e1da", yaw: 0 },
    { z: -0.3, kind: "sedan", color: "#1d3557", yaw: Math.PI },
    { z: -3.0, kind: "sedan", color: "#9a9ea0", yaw: 0 },
  ];
  return (
    <group>
      <mesh geometry={lines}>
        <meshBasicMaterial color="#e9ece6" toneMapped={false} />
      </mesh>
      <mesh geometry={stops}>
        <meshStandardMaterial color="#c9c9c0" roughness={0.9} />
      </mesh>
      {(mobile ? cars.slice(0, 4) : cars).map((c) => (
        <Car key={c.z} kind={c.kind} color={c.color} position={[X + 0.3, 0, c.z]} yaw={c.yaw} lit={lit} />
      ))}
      <group position={[X + LEN / 2 + 0.6, 0, 14.9]}>
        <mesh position={[0, 1.4, 0]} material={FRAME}>
          <cylinderGeometry args={[0.05, 0.05, 2.8, 8]} />
        </mesh>
        <mesh position={[0, 3.1, 0]} rotation={[0, 0.5, 0]}>
          <boxGeometry args={[0.9, 0.9, 0.06]} />
          <meshBasicMaterial map={sign} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

/* -------------------------------------------------------------------- root */

/** All of the outdoor dressing. Hidden once the camera is deep inside, so it costs nothing in the arena. */
export function Exterior({ mobile }: { mobile: boolean }) {
  const { camera } = useThree();
  const root = useRef<THREE.Group>(null);
  useFrame(() => {
    if (root.current) root.current.visible = camera.position.z > -48;
  });
  const trees: { p: V; h: number }[] = [
    { p: [-21.5, 0, 10], h: 5.6 }, { p: [-21.5, 0, 2.5], h: 5 }, { p: [-21.5, 0, -5], h: 6 },
    { p: [27.5, 0, 16], h: 5.4 }, { p: [28.5, 0, 7], h: 4.8 },
    { p: [30, 0, -14], h: 6.2 }, { p: [-27, 0, -13], h: 6 }, { p: [28, 0, -1.5], h: 5.2 },
  ];
  return (
    <group ref={root}>
      <FacadeDetail />
      <SportPosters />
      <Entrance />
      <CarPark mobile={mobile} />
      {/* turned towards the walkway so the menu boards read on the way in */}
      <Stall kind="tusok" position={[25.4, 0, -10.8]} yaw={-0.75} />
      {!mobile && <Stall kind="buko" position={[26.4, 0, -5.4]} yaw={-0.95} />}
      {(mobile ? trees.slice(0, 5) : trees).map((t, i) => (
        <Cutout key={i} name="tree" position={t.p} h={t.h} flip={i % 2 === 1} shadow={0.4} />
      ))}
      {/* kerb between the car park and the plaza */}
      <mesh position={[-11.9, 0.09, 5.1]}>
        <boxGeometry args={[0.3, 0.18, 19]} />
        <meshStandardMaterial color="#b9bdb4" roughness={0.9} />
      </mesh>
    </group>
  );
}
