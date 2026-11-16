"use client";
// Everything outside the pavilion: a sky that follows the visitor's clock
// (sun and clouds by day, warm light at dawn and dusk, moon and stars at
// night), the facade dressing (one lit poster per sport, sign, open glass
// doors, welcome mat, planters), a car park, food stalls and trees.
// The whole group is hidden once the camera is well inside the arena.
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
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
          <mesh position={[0, H / 2 + 0.62, 0.22]} material={WARM_GLOW}>
            <boxGeometry args={[W * 0.7, 0.05, 0.08]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Planter({ position, r = 0.55 }: { position: V; r?: number }) {
  return (
    <group position={position} userData={{ caster: true }}>
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[r, r * 0.8, 0.8, 14]} />
        <meshStandardMaterial color="#2b332f" roughness={0.8} />
      </mesh>
      {([[0, 1.05, 0, 0.62], [0.28, 0.9, 0.18, 0.4], [-0.3, 0.92, -0.12, 0.42]] as [number, number, number, number][]).map(([x, y, z, s], i) => (
        <mesh key={i} position={[x, y, z]} scale={s}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color={i ? "#2f7a43" : "#3c8f4f"} roughness={0.9} flatShading />
        </mesh>
      ))}
    </group>
  );
}

/** Sign, open glass doors, welcome mat and planters around the entrance. The opening itself stays clear for the camera. */
function Entrance() {
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
          <mesh geometry={door.handle} material={LIME_GLOW} />
        </group>
      ))}
      {/* runner from the plaza to the door, with a mat at the threshold */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, -15.4]}>
        <planeGeometry args={[4.4, 7.6]} />
        <meshStandardMaterial color="#1b4a80" roughness={0.9} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} rotation={[-Math.PI / 2, 0, 0]} position={[s * 2.26, 0.014, -15.4]} material={LIME_GLOW}>
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
          <mesh position={[0, 0.84, 0]} material={WARM_GLOW}>
            <cylinderGeometry args={[0.09, 0.09, 0.1, 8]} />
          </mesh>
        </group>
      )))}
      <Planter position={[-5.3, 0, -18.7]} r={0.7} />
      <Planter position={[5.3, 0, -18.7]} r={0.7} />
      <Planter position={[-3.6, 0, -11.2]} />
      <Planter position={[3.6, 0, -11.2]} />
      {/* dark plinth along the foot of the wall */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 17, 0.6, -19.9]} material={PLINTH}>
          <boxGeometry args={[26, 1.2, 0.24]} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------------------------------------------------------------- car park */

const TYRE = new THREE.MeshStandardMaterial({ color: "#0c0e0d", roughness: 0.9 });
const CAR_GLASS = new THREE.MeshStandardMaterial({ color: "#3b4d5a", roughness: 0.1, metalness: 0.3 });
const HEADLIGHT = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 1.25, 1.1), toneMapped: false });
const TAILLIGHT = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 0.12, 0.08), toneMapped: false });

function carGeometry(kind: "sedan" | "suv") {
  const L = kind === "suv" ? 4.5 : 4.3;
  const h = kind === "suv" ? 0.82 : 0.62;
  const body = mergeGeometries([
    box(L, h, 1.82, [0, 0.36 + h / 2, 0]),
    box(L * 0.2, h * 0.5, 1.7, [L / 2 - 0.25, 0.36 + h * 0.3, 0]),
  ])!;
  const cabLen = kind === "suv" ? 2.7 : 2.05;
  const cabH = kind === "suv" ? 0.62 : 0.52;
  const cabX = kind === "suv" ? -0.35 : -0.25;
  const cabin = box(cabLen, cabH, 1.6, [cabX, 0.36 + h + cabH / 2, 0]);
  const roof = box(cabLen - 0.5, 0.06, 1.5, [cabX, 0.36 + h + cabH + 0.03, 0]);
  const wheels: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const w = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 16);
    w.rotateX(Math.PI / 2);
    w.translate(sx * (L / 2 - 0.82), 0.34, sz * 0.86);
    wheels.push(w);
  }
  const head = mergeGeometries([box(0.05, 0.14, 0.34, [L / 2 + 0.01, 0.36 + h * 0.62, -0.62]), box(0.05, 0.14, 0.34, [L / 2 + 0.01, 0.36 + h * 0.62, 0.62])])!;
  const tail = mergeGeometries([box(0.05, 0.12, 0.3, [-L / 2 - 0.01, 0.36 + h * 0.7, -0.66]), box(0.05, 0.12, 0.3, [-L / 2 - 0.01, 0.36 + h * 0.7, 0.66])])!;
  return { body, cabin, roof, wheels: mergeGeometries(wheels)!, head, tail };
}

function Car({ position, rotY, color, kind }: { position: V; rotY: number; color: string; kind: "sedan" | "suv" }) {
  const g = useMemo(() => carGeometry(kind), [kind]);
  const paint = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.15 }), [color]);
  return (
    <group position={position} rotation={[0, rotY, 0]} userData={{ caster: true }}>
      <mesh geometry={g.body} material={paint} />
      <mesh geometry={g.roof} material={paint} />
      <mesh geometry={g.cabin} material={CAR_GLASS} />
      <mesh geometry={g.wheels} material={TYRE} />
      <mesh geometry={g.head} material={HEADLIGHT} />
      <mesh geometry={g.tail} material={TAILLIGHT} />
    </group>
  );
}

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
  const cars: { z: number; color: string; kind: "sedan" | "suv"; flip?: boolean }[] = [
    { z: 13.2, color: "#d9dde0", kind: "sedan" },
    { z: 7.8, color: "#b3261e", kind: "suv" },
    { z: 5.1, color: "#1f3f8a", kind: "sedan", flip: true },
    { z: -0.3, color: "#2c312f", kind: "suv" },
    { z: -3.0, color: "#e8b22a", kind: "sedan" },
  ];
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[X + 1.2, 0.006, 5.1]}>
        <planeGeometry args={[LEN + 6, bays.length * BAY + 2]} />
        <meshStandardMaterial color="#22272a" roughness={0.95} />
      </mesh>
      <mesh geometry={lines}>
        <meshBasicMaterial color="#e9ece6" toneMapped={false} />
      </mesh>
      <mesh geometry={stops}>
        <meshStandardMaterial color="#c9c9c0" roughness={0.9} />
      </mesh>
      {(mobile ? cars.slice(0, 3) : cars).map((c) => (
        <Car key={c.z} position={[X + 0.15, 0, c.z]} rotY={c.flip ? 0 : Math.PI} color={c.color} kind={c.kind} />
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

/* ------------------------------------------------------------- food stalls */

function stripes(a: string, b: string) {
  const t = canvasTexture(256, 64, (ctx, w, h) => {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? a : b;
      ctx.fillRect((i * w) / 8, 0, w / 8, h);
    }
  });
  return t;
}

function FoodStall({ position, rotY, name, sub, a, b }: { position: V; rotY: number; name: string; sub: string; a: string; b: string }) {
  const awning = useMemo(() => stripes(a, b), [a, b]);
  const board = useMemo(() => textTexture([{ text: name, size: 70, color: "#fff8e6" }, { text: sub, size: 34, color: "#ffd98a", weight: 700 }], 512, 170, a), [name, sub, a]);
  const frame = useMemo(() => {
    const g: THREE.BufferGeometry[] = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.push(box(0.07, 2.7, 0.07, [sx * 1.4, 1.35, sz * 0.7]));
    g.push(box(2.9, 0.07, 0.07, [0, 2.66, 0.7]), box(2.9, 0.07, 0.07, [0, 2.66, -0.7]));
    return mergeGeometries(g)!;
  }, []);
  return (
    <group position={position} rotation={[0, rotY, 0]} userData={{ caster: true }}>
      <mesh geometry={frame} material={FRAME} />
      {/* counter with a timber front and a steel top */}
      <mesh position={[0, 0.5, 0.55]}>
        <boxGeometry args={[2.8, 1.0, 0.5]} />
        <meshStandardMaterial color="#9a6a3c" roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.03, 0.55]}>
        <boxGeometry args={[3.0, 0.06, 0.66]} />
        <meshStandardMaterial color="#c9ced0" roughness={0.3} metalness={0.8} />
      </mesh>
      {/* back shelf */}
      <mesh position={[0, 1.0, -0.6]}>
        <boxGeometry args={[2.8, 2.0, 0.12]} />
        <meshStandardMaterial color="#3a2a1c" roughness={0.8} />
      </mesh>
      {/* striped awning, sloping to the front */}
      <mesh position={[0, 2.62, 0.55]} rotation={[0.32, 0, 0]}>
        <boxGeometry args={[3.3, 0.05, 2.1]} />
        <meshStandardMaterial map={awning} roughness={0.85} />
      </mesh>
      <mesh position={[0, 2.25, 1.56]}>
        <planeGeometry args={[3.3, 0.42]} />
        <meshStandardMaterial map={awning} roughness={0.85} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 3.25, -0.2]}>
        <planeGeometry args={[2.9, 0.96]} />
        <meshBasicMaterial map={board} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      {/* jars and trays on the counter, a string of warm bulbs under the awning */}
      {[-1.0, -0.45, 0.2, 0.9].map((x, i) => (
        <mesh key={x} position={[x, 1.2, 0.55]}>
          <cylinderGeometry args={[0.13, 0.13, 0.28, 10]} />
          <meshStandardMaterial color={["#e8c15a", "#d8573a", "#f1ead6", "#7ab648"][i]} roughness={0.5} />
        </mesh>
      ))}
      {[-1.2, -0.6, 0, 0.6, 1.2].map((x) => (
        <mesh key={x} position={[x, 2.3, 1.2]} material={WARM_GLOW}>
          <sphereGeometry args={[0.055, 8, 6]} />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------- trees */

const TRUNK = new THREE.MeshStandardMaterial({ color: "#4a3524", roughness: 0.95 });
const LEAF = [
  new THREE.MeshStandardMaterial({ color: "#2f7a43", roughness: 0.9, flatShading: true }),
  new THREE.MeshStandardMaterial({ color: "#256638", roughness: 0.9, flatShading: true }),
  new THREE.MeshStandardMaterial({ color: "#3d8f4e", roughness: 0.9, flatShading: true }),
];

function Tree({ position, h = 5, seed = 0 }: { position: V; h?: number; seed?: number }) {
  const crown = useMemo(() => {
    const blobs: [number, number, number, number][] = [[0, h, 0, 1.5], [0.9, h - 0.5, 0.3, 1.05], [-0.8, h - 0.3, -0.4, 1.15], [0.1, h + 0.9, -0.2, 1.0]];
    return blobs.map(([x, y, z, s]) => {
      const g = new THREE.IcosahedronGeometry(s, 1);
      g.translate(x, y, z);
      return g;
    });
  }, [h]);
  return (
    <group position={position} rotation={[0, seed * 1.7, 0]} userData={{ caster: true }}>
      <mesh position={[0, h / 2 - 0.4, 0]} material={TRUNK}>
        <cylinderGeometry args={[0.13, 0.22, h - 0.8, 8]} />
      </mesh>
      {crown.map((g, i) => (
        <mesh key={i} geometry={g} material={LEAF[(i + seed) % 3]} />
      ))}
      {/* tree pit */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.011, 0]}>
        <circleGeometry args={[0.9, 16]} />
        <meshStandardMaterial color="#3b2f25" roughness={1} />
      </mesh>
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
    { p: [18.5, 0, 13], h: 5.4 }, { p: [16.2, 0, 4.5], h: 4.8 },
    { p: [26, 0, -12], h: 6.2 }, { p: [-27, 0, -13], h: 6 }, { p: [24, 0, 2], h: 5.2 },
  ];
  return (
    <group ref={root}>
      <SportPosters />
      <Entrance />
      <CarPark mobile={mobile} />
      <FoodStall position={[19.2, 0, -10.2]} rotY={-0.55} name="TUSOK-TUSOK" sub="FISHBALL · KWEK-KWEK · ISAW" a="#b3261e" b="#f4ead0" />
      {!mobile && <FoodStall position={[22.2, 0, -5.4]} rotY={-0.95} name="FRESH BUKO" sub="BUKO JUICE · HALO-HALO" a="#1f7a4c" b="#f4ead0" />}
      {(mobile ? trees.slice(0, 5) : trees).map((t, i) => (
        <Tree key={i} position={t.p} h={t.h} seed={i} />
      ))}
      {/* kerb between the car park and the plaza */}
      <mesh position={[-11.9, 0.09, 5.1]}>
        <boxGeometry args={[0.3, 0.18, 19]} />
        <meshStandardMaterial color="#b9bdb4" roughness={0.9} />
      </mesh>
    </group>
  );
}
