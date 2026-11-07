"use client";
// The connected Playbook world: courtside → pavilion entrance → BOOK →
// PLAY → REPLAY gallery → convergence into the wordmark. One camera path,
// driven by the master scroll timeline (see timeline.ts).
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import fontJson from "three/examples/fonts/helvetiker_bold.typeface.json";
import { scrollState, smoothstep } from "./timeline";
import { basketballTexture, fonts, panelTexture } from "./textures";
import {
  ArenaFloor,
  Benches,
  Bleachers,
  DribbleBall,
  Dust,
  EnvironmentSwitcher,
  LightShafts,
  PostFX,
  ShadowRig,
  useArenaVideo,
  useLoopVideo,
  usePBR,
} from "./Realism";
import { FilmTimeline, GALLERY_CLIPS, HighlightScreen, cropTo169, usePhotoTextures } from "./Gallery";
import { CeilingLights, CeilingStructure, RibbonBoards, VideoWalls, useLightGrid } from "./ArenaShell";

const LIME = new THREE.Color("#D7FF3F");
const ORANGE = new THREE.Color("#FF7648");
const WHITE = new THREE.Color("#F5F7F0");
const CHAR = new THREE.Color("#101713");

// ------------------------------------------------------------ typography
const font = new FontLoader().parse(fontJson as never);

interface Letter {
  geo: TextGeometry;
  x: number;
  w: number;
  cy: number;
}

function buildWord(text: string, size: number, depth: number, spacing: number) {
  const letters: Letter[] = [];
  let x = 0;
  for (const ch of text) {
    const geo = new TextGeometry(ch, {
      font,
      size,
      depth,
      curveSegments: 8,
      bevelEnabled: true,
      bevelThickness: size * 0.012,
      bevelSize: size * 0.01,
      bevelSegments: 2,
    });
    geo.computeBoundingBox();
    const bb = geo.boundingBox!;
    geo.translate(-bb.min.x, 0, -depth / 2);
    const w = bb.max.x - bb.min.x;
    letters.push({ geo, x, w, cy: (bb.min.y + bb.max.y) / 2 });
    x += w + spacing;
  }
  return { letters, width: x - spacing };
}

// Word layouts (computed once; camera path threads through them)
const BOOK = buildWord("BOOK", 8, 1.6, 0.7);
const BOOK_Z = -50;
const BOOK_O = BOOK.letters[2]; // second O — the camera flies through it
export const O_X = 2.2;
const BOOK_OFFSET = O_X - (BOOK_O.x + BOOK_O.w / 2);
export const O_Y = BOOK_O.cy;

const PLAY = buildWord("PLAY", 9, 1.8, 0.6);
const PLAY_Z = -82;
const PLAY_OFFSET = -((PLAY.letters[1].x + PLAY.letters[1].w + PLAY.letters[2].x) / 2);

const REPLAY = buildWord("REPLAY", 2.6, 0.7, 0.25);
const GATE_Z = -125;
const GATE = { w: 15, h: 8.4, cy: 4.6 };

const MARK = buildWord("PLAYBOOK", 3.1, 0.9, 0.28);
const MARK_Z = -190;
const MARK_Y = 3.0;

// ------------------------------------------------------------ camera path
type V = [number, number, number];
function keyframes(mobile: boolean): [number, V, V][] {
  const k: [number, V, V][] = [
    [0.0, [0, 2.3, 22], [0, 2.8, -20]],
    [0.07, [0.8, 2.1, 15], [0.4, 2.6, -20]],
    [0.12, [0.3, 2.5, 2], [0, 2.8, -22]],
    [0.155, [0, 2.8, -22], [0, 3.2, -45]],
    [0.2, [-1.6, 3.4, -31], [O_X * 0.6, O_Y, BOOK_Z]],
    [0.29, [-0.4, 3.5, -37.5], [O_X, O_Y, BOOK_Z]],
    [0.335, [O_X, O_Y, BOOK_Z], [O_X * 0.5, O_Y, -62]],
    [0.37, [0.8, 3.8, -55], [0, 3.8, PLAY_Z]],
    [0.45, [1.6, 4.4, -59.5], [0, 4.2, PLAY_Z]],
    [0.535, [0, 3.0, -81], [0, 2.4, -98]],
    [0.6, [-2.5, 5.4, -92], [0.5, 0.8, -102]],
    [0.665, [0, 3.6, -112], [0, 4.4, GATE_Z]],
    [0.72, [0, 4.4, GATE_Z], [0, 3.6, -150]],
    [0.8, [0.8, 3.4, -139], [0, 3.4, -160]],
    [0.88, [0, 3.9, -160], [0, 3.2, MARK_Z]],
    [1.0, [0, 4.2, MARK_Z + 19], [0, 2.3, MARK_Z]],
  ];
  if (!mobile) return k;
  // Mobile: centred, slightly pulled back, fewer lateral moves.
  return k.map(([t, p, l]) => {
    const through = t === 0.335 || t === 0.72;
    if (t === 1.0) return [t, [0, 3.8, MARK_Z + 25], [0, 0.6, MARK_Z]];
    return [t, [through ? p[0] : p[0] * 0.25, p[1], through ? p[2] : p[2] + 3], [l[0] * 0.25, l[1], l[2]]];
  });
}

function useCameraPath(mobile: boolean) {
  return useMemo(() => {
    const kf = keyframes(mobile);
    const pos = new THREE.CatmullRomCurve3(kf.map((k) => new THREE.Vector3(...k[1])), false, "centripetal");
    const look = new THREE.CatmullRomCurve3(kf.map((k) => new THREE.Vector3(...k[2])), false, "centripetal");
    const times = kf.map((k) => k[0]);
    const toU = (t: number) => {
      const n = times.length - 1;
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      let i = 0;
      while (i < n - 1 && t > times[i + 1]) i++;
      const local = (t - times[i]) / (times[i + 1] - times[i]);
      return (i + local) / n;
    };
    return { pos, look, toU };
  }, [mobile]);
}

function CameraRig({ mobile, timeRef }: { mobile: boolean; timeRef: React.MutableRefObject<number> }) {
  const { camera, size } = useThree();
  const path = useCameraPath(mobile);
  const p = useMemo(() => new THREE.Vector3(), []);
  const l = useMemo(() => new THREE.Vector3(), []);
  const light = useRef<THREE.PointLight>(null);
  const par = useRef({ x: 0, y: 0 });

  useLayoutEffect(() => {
    camera.layers.enable(MAIN_ONLY);
  }, [camera]);
  useFrame((_, dt) => {
    const cam = camera as THREE.PerspectiveCamera;
    const fov = size.width / size.height < 0.9 ? 68 : 50;
    if (cam.fov !== fov) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    // Heavy, damped follow: momentum without twitch.
    const k = 1 - Math.exp(-dt * 3.2);
    timeRef.current += (scrollState.target - timeRef.current) * k;
    const u = path.toU(timeRef.current);
    // getPoint (not getPointAt): u is keyframe-indexed, not arc-length.
    path.pos.getPoint(u, p);
    path.look.getPoint(u, l);
    // subtle pointer parallax (desktop only)
    if (!mobile) {
      par.current.x += (scrollState.pointerX * 0.35 - par.current.x) * k;
      par.current.y += (scrollState.pointerY * 0.2 - par.current.y) * k;
      p.x += par.current.x;
      p.y -= par.current.y;
    }
    // gentle "breathing" so the camera never feels locked off
    const t = performance.now() / 1000;
    p.y += Math.sin(t * 0.55) * 0.035;
    p.x += Math.sin(t * 0.37) * 0.045;
    cam.position.copy(p);
    cam.lookAt(l);
    if (light.current) light.current.position.set(p.x, p.y + 4, p.z - 7);
  });
  return <pointLight ref={light} intensity={mobile ? 70 : 32} distance={40} decay={1.5} color="#fff3df" />;
}

// ------------------------------------------------------------ helpers
/**
 * Layer 1 = drawn by the main camera only. The mirror floor and shadow cameras
 * see layer 0, so floor markings and light effects skip those extra passes.
 */
export const MAIN_ONLY = 1;
const mainOnly = (o: THREE.Object3D | null) => {
  o?.traverse((c) => c.layers.set(MAIN_ONLY));
};
function Word({
  word,
  position,
  offset,
  face,
  side,
  groupsRef,
  splitAt,
}: {
  word: ReturnType<typeof buildWord>;
  position: V;
  offset: number;
  face: THREE.Material;
  side: THREE.Material;
  groupsRef?: React.MutableRefObject<(THREE.Group | null)[]>;
  splitAt?: number;
}) {
  const mats = useMemo(() => [face, side], [face, side]);
  if (splitAt != null && groupsRef) {
    const left = word.letters.slice(0, splitAt);
    const right = word.letters.slice(splitAt);
    return (
      <group position={position} userData={{ caster: true }}>
        <group ref={(g) => { groupsRef.current[0] = g; }}>
          {left.map((L, i) => (
            <mesh key={i} geometry={L.geo} material={mats} position={[offset + L.x, 0, 0]} />
          ))}
        </group>
        <group ref={(g) => { groupsRef.current[1] = g; }}>
          {right.map((L, i) => (
            <mesh key={i} geometry={L.geo} material={mats} position={[offset + L.x, 0, 0]} />
          ))}
        </group>
      </group>
    );
  }
  return (
    <group position={position} userData={{ caster: true }}>
      {word.letters.map((L, i) => (
        <mesh key={i} geometry={L.geo} material={mats} position={[offset + L.x, 0, 0]} />
      ))}
    </group>
  );
}

function Panel({
  position,
  rotY = 0,
  w,
  h,
  draw,
  bob = 0.08,
  border,
  bg,
}: {
  position: V;
  rotY?: number;
  w: number;
  h: number;
  draw: (ctx: CanvasRenderingContext2D, W: number, H: number) => void;
  bob?: number;
  border?: string;
  bg?: string;
}) {
  const tex = useMemo(() => panelTexture(Math.round(w * 200), Math.round(h * 200), draw, { border, bg }), [w, h, draw, border, bg]);
  const ref = useRef<THREE.Mesh>(null);
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);
  useFrame(({ clock }) => {
    if (ref.current && bob) ref.current.position.y = position[1] + Math.sin(clock.elapsedTime * 0.8 + phase) * bob;
  });
  return (
    <mesh ref={ref} position={position} rotation={[0, rotY, 0]}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** `glow` > 1 pushes an emissive above the bloom threshold. */
function Box({ args, position, color, emissive, rotation, glow = 1, material }: { args: V; position: V; color?: THREE.ColorRepresentation; emissive?: boolean; rotation?: V; glow?: number; material?: THREE.Material }) {
  const c = useMemo(() => new THREE.Color(color ?? "#ffffff").multiplyScalar(glow), [color, glow]);
  return (
    <mesh position={position} rotation={rotation} material={material}>
      <boxGeometry args={args} />
      {!material && (emissive ? <meshBasicMaterial color={c} toneMapped={false} /> : <meshStandardMaterial color={color} roughness={0.8} />)}
    </mesh>
  );
}

const LIGHT_GLOW = new THREE.Color("#fffbe8").multiplyScalar(4);
const ROUTE_GLOW = new THREE.Color("#D7FF3F").multiplyScalar(1.8);

// Shared PBR parameter objects (stable identities for usePBR memoisation)
const CONCRETE_PARAMS = { roughness: 1, color: new THREE.Color("#9aa19c") };
const PLASTER_PARAMS = { roughness: 1 };
const ACRYLIC_PARAMS = { roughness: 1 };
const PANEL_PARAMS = { roughness: 1, color: new THREE.Color("#8d978f") };
const FELT_PARAMS = { roughness: 1 };
const R_GROUND: [number, number] = [35, 15];
const R_FACADE: [number, number] = [8, 4];
const R_COURT: [number, number] = [5, 7];
const R_PANEL: [number, number] = [140, 18];
const R_FELT: [number, number] = [5, 3];

/** Flat line on the floor (court markings). */
function FloorLine({ from, to, width = 0.08, color = WHITE, y = 0.015 }: { from: [number, number]; to: [number, number]; width?: number; color?: THREE.ColorRepresentation; y?: number }) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  return (
    <mesh ref={mainOnly} position={[(from[0] + to[0]) / 2, y, (from[1] + to[1]) / 2]} rotation={[-Math.PI / 2, 0, -Math.atan2(dz, dx)]}>
      <planeGeometry args={[len, width]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

function FloorRing({ x, z, r, width = 0.08, start = 0, length = Math.PI * 2, color = WHITE, y = 0.016, opacityRef }: { x: number; z: number; r: number; width?: number; start?: number; length?: number; color?: THREE.ColorRepresentation; y?: number; opacityRef?: React.Ref<THREE.MeshBasicMaterial> }) {
  return (
    <mesh ref={mainOnly} position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[r - width / 2, r + width / 2, 64, 1, start, length]} />
      <meshBasicMaterial ref={opacityRef} color={color} toneMapped={false} transparent={!!opacityRef} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Rect({ x, z, w, d, width = 0.08, color = WHITE }: { x: number; z: number; w: number; d: number; width?: number; color?: THREE.ColorRepresentation }) {
  const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
  return (
    <>
      <FloorLine from={[x0, z0]} to={[x1, z0]} width={width} color={color} />
      <FloorLine from={[x0, z1]} to={[x1, z1]} width={width} color={color} />
      <FloorLine from={[x0, z0]} to={[x0, z1]} width={width} color={color} />
      <FloorLine from={[x1, z0]} to={[x1, z1]} width={width} color={color} />
    </>
  );
}

function Ball({ position, r = 0.3 }: { position: V; r?: number }) {
  const tex = useMemo(() => basketballTexture(), []);
  return (
    <group position={position} userData={{ caster: true }}>
      <mesh rotation={[0.4, 0.8, 0.2]}>
        <sphereGeometry args={[r, 32, 20]} />
        <meshStandardMaterial map={tex} roughness={0.65} />
      </mesh>
      <mesh position={[0.05, -r + 0.01, 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[r * 1.1, 24]} />
        <meshBasicMaterial color="#000" transparent opacity={0.45} />
      </mesh>
    </group>
  );
}

function Hoop({ position, facing }: { position: V; facing: number }) {
  // facing: rotation around Y so the board faces the court
  return (
    <group position={position} rotation={[0, facing, 0]} userData={{ caster: true }}>
      <Box args={[0.18, 3.6, 0.18]} position={[0, 1.8, -1.2]} color="#2b3530" />
      <Box args={[0.14, 0.14, 1.1]} position={[0, 3.55, -0.65]} color="#2b3530" />
      <mesh position={[0, 3.5, -0.1]}>
        <boxGeometry args={[1.8, 1.05, 0.05]} />
        <meshStandardMaterial color="#e9f0f3" transparent opacity={0.55} roughness={0.1} />
      </mesh>
      <mesh position={[0, 3.32, -0.08]}>
        <boxGeometry args={[0.6, 0.45, 0.06]} />
        <meshBasicMaterial color="#F5F7F0" wireframe />
      </mesh>
      <mesh position={[0, 3.05, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.23, 0.02, 8, 24]} />
        <meshBasicMaterial color={ORANGE} toneMapped={false} />
      </mesh>
      <mesh position={[0, 2.82, 0.2]}>
        <cylinderGeometry args={[0.23, 0.16, 0.45, 12, 3, true]} />
        <meshBasicMaterial color="#F5F7F0" wireframe transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

// ------------------------------------------------------------ panel drawings
function txt(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, weight = 700, display = false) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${display ? fonts().display : fonts().body}`;
  ctx.fillText(s, x, y);
}
function chip(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, label: string, state: "free" | "taken" | "sel") {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 14);
  if (state === "sel") {
    ctx.fillStyle = "#D7FF3F";
    ctx.fill();
  } else {
    ctx.strokeStyle = state === "taken" ? "rgba(245,247,240,0.15)" : "rgba(245,247,240,0.5)";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.textAlign = "center";
  txt(ctx, label, x + w / 2, y + h / 2 + 11, 30, state === "sel" ? "#101713" : state === "taken" ? "rgba(245,247,240,0.3)" : "#F5F7F0", 700);
  ctx.textAlign = "left";
}

const drawVenue = (ctx: CanvasRenderingContext2D) => {
  txt(ctx, "KALYE COURT HUB · QUEZON CITY", 50, 80, 30, "#B7C2BA");
  txt(ctx, "COURT A", 50, 190, 120, "#F5F7F0", 800, true);
  txt(ctx, "MAIN HARDWOOD", 50, 250, 44, "#D7FF3F", 800, true);
  const rows = ["Indoor · Hardwood · Up to 20 players", "Basketball + volleyball — one shared schedule", "Camera coverage: yes"];
  rows.forEach((r, i) => txt(ctx, r, 50, 340 + i * 56, 32, "#F5F7F0", 500));
  txt(ctx, "DEMO DATA", 50, 560, 24, "#B7C2BA", 700);
};
const drawTimes = (ctx: CanvasRenderingContext2D) => {
  txt(ctx, "SAT · PICK YOUR TIME", 50, 90, 56, "#F5F7F0", 800, true);
  txt(ctx, "2-hour slots · Asia/Manila", 50, 140, 28, "#B7C2BA", 500);
  const labels = ["2 PM", "3 PM", "4 PM", "5 PM", "6 PM", "7 PM", "8 PM", "9 PM"];
  const states: ("free" | "taken" | "sel")[] = ["free", "taken", "taken", "free", "sel", "free", "taken", "free"];
  labels.forEach((l, i) => chip(ctx, 50 + (i % 4) * 215, 190 + Math.floor(i / 4) * 110, 190, 84, l, states[i]));
  txt(ctx, "6:00 – 8:00 PM selected", 50, 470, 34, "#D7FF3F", 700);
  txt(ctx, "₱2,500 total · ₱1,250 deposit", 50, 520, 30, "#F5F7F0", 500);
  txt(ctx, "DEMO DATA", 50, 610, 24, "#B7C2BA", 700);
};
const drawSports = (ctx: CanvasRenderingContext2D) => {
  txt(ctx, "PICK YOUR SPORT", 40, 70, 44, "#F5F7F0", 800, true);
  ["BASKETBALL", "VOLLEYBALL", "BILLIARDS"].forEach((s, i) => chip(ctx, 40 + i * 230, 110, 215, 100, s, i === 0 ? "sel" : "free"));
};
const drawPreview = (ctx: CanvasRenderingContext2D) => {
  txt(ctx, "BOOKING PREVIEW", 50, 80, 30, "#B7C2BA");
  txt(ctx, "SAT · 6–8 PM", 50, 170, 80, "#F5F7F0", 800, true);
  txt(ctx, "Court A · Basketball", 50, 230, 34, "#D7FF3F", 700);
  txt(ctx, "Rental ₱2,400 · Ball ₱100", 50, 290, 30, "#F5F7F0", 500);
  txt(ctx, "Free cancellation until 24h before", 50, 340, 28, "#B7C2BA", 500);
};
const drawConfirm = (ctx: CanvasRenderingContext2D) => {
  ctx.fillStyle = "#D7FF3F";
  ctx.beginPath();
  ctx.arc(90, 100, 40, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#101713";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(70, 100);
  ctx.lineTo(86, 116);
  ctx.lineTo(112, 86);
  ctx.stroke();
  txt(ctx, "CONFIRMED", 150, 120, 72, "#F5F7F0", 800, true);
  txt(ctx, "PB-7KQ2", 50, 220, 90, "#D7FF3F", 800, true);
  txt(ctx, "Court A · Sat 6:00–8:00 PM", 50, 290, 34, "#F5F7F0", 600);
  txt(ctx, "Deposit paid · ₱1,250 balance at venue", 50, 340, 28, "#B7C2BA", 500);
};
const drawInvite = (ctx: CanvasRenderingContext2D) => {
  txt(ctx, "BRING THE SQUAD", 50, 90, 60, "#F5F7F0", 800, true);
  const ppl: [string, string][] = [["You", "Owner"], ["Migs", "Going"], ["Ana", "Invited"], ["JR", "Invited"]];
  ppl.forEach(([n, s], i) => {
    ctx.fillStyle = i === 0 ? "#D7FF3F" : "#2E3A33";
    ctx.beginPath();
    ctx.arc(80, 160 + i * 66, 24, 0, Math.PI * 2);
    ctx.fill();
    txt(ctx, n, 124, 172 + i * 66, 34, "#F5F7F0", 600);
    ctx.textAlign = "right";
    txt(ctx, s, 750, 172 + i * 66, 30, s === "Invited" ? "#FF7648" : "#B7C2BA", 600);
    ctx.textAlign = "left";
  });
};
const sign = (label: string) => (ctx: CanvasRenderingContext2D, W: number, H: number) => {
  ctx.textAlign = "center";
  txt(ctx, label, W / 2, H / 2 + 22, 64, "#F5F7F0", 800, true);
  ctx.textAlign = "left";
};

function Spot({ position, target }: { position: V; target: V }) {
  const obj = useMemo(() => new THREE.Object3D(), []);
  return (
    <>
      <primitive object={obj} position={target} />
      <spotLight position={position} target={obj} angle={0.75} penumbra={0.8} intensity={260} distance={50} decay={1.4} color="#fff3df" />
    </>
  );
}

// ------------------------------------------------------------ scenes
function Courtside({ mobile }: { mobile: boolean }) {
  const ground = usePBR("concrete_polished", R_GROUND, CONCRETE_PARAMS);
  const plaster = usePBR("wall_plaster_white", R_FACADE, PLASTER_PARAMS);
  const acrylic = usePBR("court_acrylic_blue", R_COURT, ACRYLIC_PARAMS);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 10]} material={ground} receiveShadow>
        <planeGeometry args={[140, 60]} />
      </mesh>
      {/* Pavilion facade with entrance */}
      <Box args={[26, 14, 1]} position={[-17, 7, -20.5]} material={plaster} />
      <Box args={[26, 14, 1]} position={[17, 7, -20.5]} material={plaster} />
      <Box args={[8, 7.8, 1]} position={[0, 10.1, -20.5]} material={plaster} />
      {/* lime door frame */}
      <Box args={[0.18, 6.2, 0.2]} position={[-4.05, 3.1, -19.95]} color={LIME} emissive glow={2} />
      <Box args={[0.18, 6.2, 0.2]} position={[4.05, 3.1, -19.95]} color={LIME} emissive glow={2} />
      <Box args={[8.3, 0.18, 0.2]} position={[0, 6.2, -19.95]} color={LIME} emissive glow={2} />
      {/* canopy + downlight strip */}
      <Box args={[22, 0.4, 5]} position={[0, 8.6, -17.6]} color="#1a221e" />
      <Box args={[20, 0.05, 0.3]} position={[0, 8.38, -15.6]} color="#fffbe8" emissive glow={3} />
      {/* fascia stripe */}
      <Box args={[52, 0.25, 0.1]} position={[0, 13.2, -19.95]} color={LIME} emissive glow={2} />

      {/* outdoor practice court */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[8, 0.008, 11]} material={acrylic} receiveShadow>
        <planeGeometry args={[11, 15]} />
      </mesh>
      <Rect x={8} z={11} w={10.4} d={14.4} />
      <Rect x={8} z={6.4} w={4.2} d={5.2} />
      <FloorRing x={8} z={9} r={1.8} start={Math.PI} length={Math.PI} />
      <FloorRing x={8} z={4.6} r={6.2} start={Math.PI} length={Math.PI} />
      <Hoop position={[8, 0, 4.1]} facing={0} />
      <Ball position={[2.4, 0.3, 15.8]} />
      {!mobile && <Ball position={[10.5, 0.3, 9]} r={0.28} />}

      {/* light poles */}
      {([[-9, 6], [15, -6]] as [number, number][]).map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <Box args={[0.25, 11, 0.25]} position={[0, 5.5, 0]} color="#2b3530" />
          <Box args={[2.2, 0.5, 0.6]} position={[0, 11, 0]} color="#fffbe8" emissive glow={4} />
        </group>
      ))}
      <Spot position={[-9, 11, 6]} target={[0, 0, -10]} />
      <Spot position={[15, 11, -6]} target={[6, 0, 8]} />
      <pointLight position={[0, 5, -26]} intensity={55} distance={26} decay={1.5} color="#ffe2b8" />
    </group>
  );
}

function Arena({ mobile }: { mobile: boolean }) {
  const panel = usePBR("panel_acoustic_dark", R_PANEL, PANEL_PARAMS);
  const grid = useLightGrid(mobile);
  return (
    <group>
      <ArenaFloor quality={mobile ? "low" : "high"} />
      <CeilingStructure mobile={mobile} />
      <CeilingLights mobile={mobile} positions={grid.all} />
      <LightShafts positions={grid.shafts} />
      <Dust count={mobile ? 450 : 1400} from={-24} to={-185} />
      {/* seating bowl, LED ribbon boards and highlight video walls */}
      <Bleachers shadows={!mobile} mobile={mobile} />
      <RibbonBoards />
      <VideoWalls />
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box args={[0.06, 0.06, 172]} position={[s * 15.5, 0.08, -110]} color={LIME} emissive glow={2} />
          <Box args={[0.6, 22, 172]} position={[s * 24, 11, -110]} material={panel} />
        </group>
      ))}
    </group>
  );
}

function BookWorld({ mobile }: { mobile: boolean }) {
  const face = useMemo(() => new THREE.MeshStandardMaterial({ color: "#e4e8df", roughness: 0.45 }), []);
  const side = useMemo(() => new THREE.MeshStandardMaterial({ color: "#9cc21a", emissive: LIME, emissiveIntensity: 0.18, roughness: 0.5 }), []);
  return (
    <group>
      <Word word={BOOK} position={[0, 0, BOOK_Z]} offset={BOOK_OFFSET} face={face} side={side} />
      {/* booking displays flank the route just inside the entrance */}
      <Panel position={[-6.4, 3.4, -29]} rotY={0.62} w={4.8} h={3} draw={drawVenue} />
      <Panel position={[6.6, 3.6, -31]} rotY={-0.62} w={4.8} h={3.3} draw={drawTimes} />
      {!mobile && <Panel position={[-4.6, 1.2, -25.5]} rotY={0.7} w={3.6} h={1.2} draw={drawSports} />}
      {!mobile && <Panel position={[-5.6, 1.9, -57]} rotY={0.45} w={4} h={2} draw={drawPreview} />}
      {/* chapter markers: X and O on the route */}
      <RouteMarkers z={-29} />
    </group>
  );
}

function RouteMarkers({ z }: { z: number }) {
  return (
    <group>
      <FloorRing x={-1.8} z={z} r={0.55} width={0.14} color={LIME} y={0.02} />
      <FloorLine from={[1.3, z - 0.5]} to={[2.3, z + 0.5]} width={0.14} color={LIME} y={0.02} />
      <FloorLine from={[1.3, z + 0.5]} to={[2.3, z - 0.5]} width={0.14} color={LIME} y={0.02} />
    </group>
  );
}

function PlayWorld({ mobile, timeRef }: { mobile: boolean; timeRef: React.MutableRefObject<number> }) {
  const felt = usePBR("felt_billiards", R_FELT, FELT_PARAMS);
  const face = useMemo(() => new THREE.MeshStandardMaterial({ color: "#e4e8df", roughness: 0.45 }), []);
  const side = useMemo(() => new THREE.MeshStandardMaterial({ color: "#2a3530", roughness: 0.6 }), []);
  const groups = useRef<(THREE.Group | null)[]>([]);
  useFrame(() => {
    const s = smoothstep(0.47, 0.535, timeRef.current);
    const [L, R] = groups.current;
    if (L) {
      L.position.x = -s * 6.5;
      L.rotation.y = s * 0.35;
    }
    if (R) {
      R.position.x = s * 6.5;
      R.rotation.y = -s * 0.35;
    }
  });
  const cz = -98;
  return (
    <group>
      <RouteMarkers z={-62} />
      <Word word={PLAY} position={[0, 0, PLAY_Z]} offset={PLAY_OFFSET} face={face} side={side} groupsRef={groups} splitAt={2} />
      {/* main basketball court (across the path) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, cz]}>
        <planeGeometry args={[28, 15]} />
        <meshStandardMaterial color="#b4783f" transparent opacity={0.28} roughness={0.4} />
      </mesh>
      <Rect x={0} z={cz} w={28} d={15} />
      <FloorLine from={[0, cz - 7.5]} to={[0, cz + 7.5]} />
      <FloorRing x={0} z={cz} r={1.8} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <Rect x={s * 11.1} z={cz} w={5.8} d={4.9} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[s * 11.1, 0.01, cz]}>
            <planeGeometry args={[5.8, 4.9]} />
            <meshBasicMaterial color={LIME} transparent opacity={0.16} />
          </mesh>
          <FloorRing x={s * 8.2} z={cz} r={1.8} start={s > 0 ? Math.PI / 2 : -Math.PI / 2} length={Math.PI} />
          <FloorRing x={s * 12.4} z={cz} r={6.75} start={s > 0 ? Math.PI / 2 + 0.25 : -Math.PI / 2 + 0.25} length={Math.PI - 0.5} />
          <Hoop position={[s * 13.6, 0, cz]} facing={s > 0 ? -Math.PI / 2 : Math.PI / 2} />
        </group>
      ))}
      <DribbleBall position={[1.6, 0, cz + 1.2]} shadows={!mobile} />
      <Benches shadows={!mobile} cz={cz} />
      <Ball position={[-9.5, 0.3, cz - 2]} r={0.28} />

      <Panel position={[3.8, 6, -91]} rotY={-0.3} w={4.2} h={2.1} draw={drawConfirm} />
      <Panel position={[-4.6, 4.6, -99]} rotY={0.45} w={4} h={1.9} draw={drawInvite} />
      {(["SHOWERS", "LOCKERS", "WATER REFILL", "PARKING"] as const).map((s, i) => (
        <Panel key={s} position={[i % 2 ? 9 : -9, 2.2, -88 - Math.floor(i / 2) * 16]} rotY={i % 2 ? -0.6 : 0.6} w={2.6} h={0.8} draw={sign(s)} bob={0} border="rgba(245,247,240,0.4)" />
      ))}

      {/* billiards table between BOOK and PLAY */}
      <group position={[-7.5, 0, -70]} rotation={[0, 0.3, 0]} userData={{ caster: true }}>
        <Box args={[3, 0.8, 1.7]} position={[0, 0.4, 0]} color="#3d2414" />
        <mesh position={[0, 0.81, 0]} material={felt}>
          <boxGeometry args={[2.7, 0.04, 1.4]} />
        </mesh>
        {[[-1.35, -0.7], [0, -0.72], [1.35, -0.7], [-1.35, 0.7], [0, 0.72], [1.35, 0.7]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.84, z]}>
            <cylinderGeometry args={[0.07, 0.07, 0.02, 12]} />
            <meshBasicMaterial color="#050806" />
          </mesh>
        ))}
        {Array.from({ length: 10 }).map((_, i) => {
          const row = i < 1 ? 0 : i < 3 ? 1 : i < 6 ? 2 : 3;
          const idx = i - [0, 1, 3, 6][row];
          return (
            <mesh key={i} position={[0.6 + row * 0.1, 0.87, (idx - row / 2) * 0.115]}>
              <sphereGeometry args={[0.055, 12, 8]} />
              <meshStandardMaterial color={["#f5d43b", "#2f5bd3", "#d63a2f", "#6b2fa3", "#f08a2f", "#1f8a4c", "#7a1f1f", "#111", "#f5d43b", "#2f5bd3"][i]} roughness={0.2} />
            </mesh>
          );
        })}
        <mesh position={[-0.7, 0.87, 0]}>
          <sphereGeometry args={[0.055, 12, 8]} />
          <meshStandardMaterial color="#fafaf0" roughness={0.2} />
        </mesh>
        <mesh position={[-1.5, 0.95, 0.15]} rotation={[0, 0, Math.PI / 2 - 0.06]}>
          <cylinderGeometry args={[0.012, 0.02, 1.5, 8]} />
          <meshStandardMaterial color="#d8b679" />
        </mesh>
        <Box args={[2.2, 0.12, 0.4]} position={[0, 2.6, 0]} color="#fff3cf" emissive />
        <Box args={[0.03, 1.4, 0.03]} position={[0, 3.3, 0]} color="#2b3530" />
      </group>

      {!mobile && (
        <>
          {/* volleyball */}
          <group position={[8.5, 0, -115]}>
            <Rect x={0} z={0} w={6} d={6} />
            <Box args={[0.1, 2.5, 0.1]} position={[-3.2, 1.25, 0]} color="#2b3530" />
            <Box args={[0.1, 2.5, 0.1]} position={[3.2, 1.25, 0]} color="#2b3530" />
            <mesh position={[0, 2.05, 0]}>
              <planeGeometry args={[6.4, 0.9, 16, 3]} />
              <meshBasicMaterial color="#F5F7F0" wireframe transparent opacity={0.6} />
            </mesh>
            <mesh position={[0.8, 3.6, 0.6]}>
              <sphereGeometry args={[0.24, 20, 14]} />
              <meshStandardMaterial color="#f2efe4" roughness={0.6} />
            </mesh>
          </group>
          {/* badminton */}
          <group position={[-8.5, 0, -115]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
              <planeGeometry args={[6.1, 6.7]} />
              <meshStandardMaterial color="#1a5246" roughness={0.9} />
            </mesh>
            <Rect x={0} z={0} w={6.1} d={6.7} />
            <Rect x={0} z={0} w={5.2} d={6.7} />
            <mesh position={[0, 1.4, 0]}>
              <planeGeometry args={[6.1, 0.76, 16, 2]} />
              <meshBasicMaterial color="#F5F7F0" wireframe transparent opacity={0.5} />
            </mesh>
            <mesh position={[-0.6, 2.8, 0.5]} rotation={[0.4, 0, 0.6]}>
              <coneGeometry args={[0.12, 0.25, 12, 1, true]} />
              <meshBasicMaterial color="#F5F7F0" side={THREE.DoubleSide} />
            </mesh>
          </group>
          {/* pickleball, under the path */}
          <group position={[0, 0, -117]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
              <planeGeometry args={[6.1, 13.4]} />
              <meshStandardMaterial color="#1f4f86" roughness={0.85} />
            </mesh>
            <Rect x={0} z={0} w={6.1} d={13.4} />
            <Rect x={0} z={0} w={6.1} d={4.2} color={LIME} />
            <FloorLine from={[0, -6.7]} to={[0, -2.1]} />
            <FloorLine from={[0, 2.1]} to={[0, 6.7]} />
            <mesh position={[0, 0.45, 0]}>
              <planeGeometry args={[6.4, 0.9, 16, 3]} />
              <meshBasicMaterial color="#F5F7F0" wireframe transparent opacity={0.5} />
            </mesh>
          </group>
        </>
      )}
    </group>
  );
}

function ReplayWorld({ mobile, timeRef }: { mobile: boolean; timeRef: React.MutableRefObject<number> }) {
  const face = useMemo(() => new THREE.MeshStandardMaterial({ color: LIME, emissive: LIME, emissiveIntensity: 0.35, roughness: 0.4 }), []);
  const side = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1b231f", roughness: 0.6 }), []);
  const photos = usePhotoTextures(GALLERY_CLIPS);
  // separate copy of the lead photo for the gate (the gallery animates its own crop)
  const gatePhoto = useMemo(() => {
    const t = photos[0].clone();
    t.needsUpdate = true;
    cropTo169(t, GALLERY_CLIPS[0].focusY, 1);
    return t;
  }, [photos]);
  const screenMat = useRef<THREE.MeshBasicMaterial>(null);
  // The giant screen plays the ambient arena loop while it's in view.
  const video = useArenaVideo(() => timeRef.current > 0.55 && timeRef.current < 0.74);
  // The featured gallery screen (pickleball) plays its real demo clip while the gallery is in view.
  const lead = GALLERY_CLIPS[0];
  const leadVideo = useLoopVideo(lead.video ?? "", `/assets/video/highlight-${lead.sport}-poster.jpg`, () => !!lead.video && timeRef.current > 0.62 && timeRef.current < 0.9);
  useFrame(() => {
    const t = timeRef.current;
    const m = screenMat.current;
    if (m) {
      m.opacity = 1 - smoothstep(0.66, 0.712, t);
      const want = video.ready() ? video.texture : gatePhoto;
      if (m.map !== want) {
        m.map = want;
        m.needsUpdate = true;
      }
    }
  });
  // Upper deck: big screens above the corridor, each with its own texture copy.
  const upper = useMemo(
    () =>
      [3, 6, 1, 4].map((ci, k) => {
        const s = k % 2 ? 1 : -1;
        const photo = photos[ci].clone();
        photo.needsUpdate = true;
        return { clip: GALLERY_CLIPS[ci], photo, pos: [s * 10, 8.4, -137 - Math.floor(k / 2) * 18] as V, rotY: -s * 0.42 };
      }),
    [photos],
  );
  // Corridor screens: alternating sides, staggered heights.
  const screens = GALLERY_CLIPS.map((clip, i) => {
    const s = i % 2 ? 1 : -1;
    const row = Math.floor(i / 2);
    return { clip, photo: photos[i], pos: [s * 5.6, 3.3 + (row % 2 ? 1.1 : -0.25), -133 - row * 8] as V, rotY: -s * 0.55 };
  });
  return (
    <group>
      <RouteMarkers z={-119} />
      {/* screen gate */}
      <group position={[0, GATE.cy, GATE_Z]}>
        <Box args={[GATE.w + 0.6, 0.3, 0.5]} position={[0, GATE.h / 2 + 0.15, 0]} color="#1b231f" />
        <Box args={[GATE.w + 0.6, 0.3, 0.5]} position={[0, -GATE.h / 2 - 0.15, 0]} color="#1b231f" />
        <Box args={[0.3, GATE.h, 0.5]} position={[-GATE.w / 2 - 0.15, 0, 0]} color="#1b231f" />
        <Box args={[0.3, GATE.h, 0.5]} position={[GATE.w / 2 + 0.15, 0, 0]} color="#1b231f" />
        <Box args={[GATE.w + 0.2, 0.06, 0.06]} position={[0, GATE.h / 2, 0.28]} color={LIME} emissive glow={2} />
        <Box args={[GATE.w + 0.2, 0.06, 0.06]} position={[0, -GATE.h / 2, 0.28]} color={LIME} emissive glow={2} />
        <Box args={[0.06, GATE.h, 0.06]} position={[-GATE.w / 2, 0, 0.28]} color={LIME} emissive glow={2} />
        <Box args={[0.06, GATE.h, 0.06]} position={[GATE.w / 2, 0, 0.28]} color={LIME} emissive glow={2} />
        <mesh>
          <planeGeometry args={[GATE.w, GATE.h]} />
          <meshBasicMaterial ref={screenMat} map={gatePhoto} transparent toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <Word word={REPLAY} position={[0, GATE.cy + GATE.h / 2 + 0.5, GATE_Z]} offset={-REPLAY.width / 2} face={face} side={side} />
      {/* gallery corridor of highlight screens */}
      {screens.map((sc, i) => (
        <HighlightScreen key={i} clip={sc.clip} photo={sc.photo} position={sc.pos} rotY={sc.rotY} featured={i === 0} mirror={mobile} phase={i} video={i === 0 && lead.video ? leadVideo : undefined} />
      ))}
      {/* upper-deck screens */}
      {upper.map((u, k) => (
        <HighlightScreen key={k} clip={u.clip} photo={u.photo} position={u.pos} rotY={u.rotY} width={6.4} phase={10 + k} dim={0.85} />
      ))}
      <FilmTimeline z0={-128} length={34} timeRef={timeRef} from={0.72} to={0.88} />
    </group>
  );
}

function Convergence({ mobile, timeRef }: { mobile: boolean; timeRef: React.MutableRefObject<number> }) {
  const face = useMemo(() => new THREE.MeshStandardMaterial({ color: "#e4e8df", emissive: WHITE, emissiveIntensity: 0.08, roughness: 0.4 }), []);
  const side = useMemo(() => new THREE.MeshStandardMaterial({ color: "#9cc21a", emissive: LIME, emissiveIntensity: 0.25, roughness: 0.5 }), []);
  const markGroup = useRef<THREE.Group>(null);
  const ring = useRef<THREE.MeshBasicMaterial>(null);
  const count = mobile ? 28 : 56;
  const pieces = useMemo(() => {
    let seed = 42;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const W = MARK.width + 2.4, H = 3.9, cy = MARK_Y + 1.15, z = MARK_Z + 0.4;
    const perim = 2 * (W + H);
    return Array.from({ length: count }).map((_, i) => {
      let d = (i / count) * perim;
      let target: V, rot: number;
      if (d < W) { target = [-W / 2 + d, cy + H / 2, z]; rot = 0; }
      else if ((d -= W) < H) { target = [W / 2, cy + H / 2 - d, z]; rot = Math.PI / 2; }
      else if ((d -= H) < W) { target = [W / 2 - d, cy - H / 2, z]; rot = 0; }
      else { d -= W; target = [-W / 2, cy - H / 2 + d, z]; rot = Math.PI / 2; }
      // scattered through the gallery, but never in the camera corridor
      const side = rnd() > 0.5 ? 1 : -1;
      const start: V = [side * (4 + rnd() * 9), 0.5 + rnd() * 9, -150 - rnd() * 30];
      return { start, target, rot, spin: [rnd() * 6, rnd() * 6, rnd() * 6] as V, len: perim / count * 0.82, lime: i % 5 !== 0 };
    });
  }, [count]);
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    const c = smoothstep(0.885, 0.975, timeRef.current);
    const e = c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
    pieces.forEach((p, i) => {
      const m = meshes.current[i];
      if (!m) return;
      m.position.set(
        p.start[0] + (p.target[0] - p.start[0]) * e,
        p.start[1] + (p.target[1] - p.start[1]) * e,
        p.start[2] + (p.target[2] - p.start[2]) * e,
      );
      m.rotation.set(p.spin[0] * (1 - e), p.spin[1] * (1 - e), p.rot * e + p.spin[2] * (1 - e));
    });
    if (markGroup.current) {
      const s = 0.85 + 0.15 * smoothstep(0.88, 0.99, timeRef.current);
      markGroup.current.scale.setScalar(s);
    }
    if (ring.current) ring.current.opacity = smoothstep(0.9, 0.98, timeRef.current);
  });
  // On narrow screens the whole composition is scaled about the wordmark.
  const sc = mobile ? 0.42 : 0.74;
  return (
    <group scale={sc} position={[0, MARK_Y * (1 - sc), MARK_Z * (1 - sc)]}>
      <group ref={markGroup} position={[0, MARK_Y, MARK_Z]}>
        <Word word={MARK} position={[0, 0, 0]} offset={-MARK.width / 2} face={face} side={side} />
      </group>
      {pieces.map((p, i) => (
        <mesh key={i} ref={(m) => { meshes.current[i] = m; mainOnly(m); }}>
          <boxGeometry args={[p.len, 0.09, 0.09]} />
          <meshBasicMaterial color={p.lime ? LIME : ORANGE} toneMapped={false} />
        </mesh>
      ))}
      <FloorRing x={0} z={MARK_Z + 3} r={7} width={0.12} color={LIME} y={0.03} opacityRef={ring} />
    </group>
  );
}

/** Lime play-route along the floor that draws itself ahead of the camera. */
function PlayRoute({ mobile, timeRef }: { mobile: boolean; timeRef: React.MutableRefObject<number> }) {
  const path = useCameraPath(mobile);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dashes = useMemo(() => {
    const total = path.pos.getLength();
    const n = Math.floor(total / 1.3);
    const pts: { p: THREE.Vector3; q: THREE.Vector3 }[] = [];
    for (let i = 0; i < n; i++) {
      const a = path.pos.getPointAt(i / n);
      const b = path.pos.getPointAt(Math.min(1, (i + 0.5) / n));
      a.y = b.y = 0.025;
      pts.push({ p: a, q: b });
    }
    return pts;
  }, [path]);
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const o = new THREE.Object3D();
    dashes.forEach(({ p, q }, i) => {
      o.position.copy(p);
      o.lookAt(q);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [dashes]);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    path.pos.getPoint(path.toU(timeRef.current), tmp);
    const reach = tmp.z - 26;
    let n = 0;
    while (n < dashes.length && dashes[n].p.z > reach) n++;
    m.count = n;
  });
  return (
    <instancedMesh ref={(m) => { mesh.current = m; mainOnly(m); }} args={[undefined, undefined, dashes.length]} frustumCulled={false}>
      <boxGeometry args={[0.16, 0.02, 0.55]} />
      <meshBasicMaterial color={ROUTE_GLOW} toneMapped={false} />
    </instancedMesh>
  );
}

/**
 * Lit meshes receive shadows; only hero objects (groups tagged
 * userData.caster) cast them, keeping the shadow pass cheap.
 */
function ShadowFlags() {
  const { scene } = useThree();
  useEffect(() => {
    const visit = (o: THREE.Object3D, cast: boolean) => {
      const c = cast || !!o.userData?.caster;
      const m = o as THREE.Mesh;
      if (m.isMesh && !(m as unknown as THREE.InstancedMesh).isInstancedMesh) {
        const lit = !(m.material as THREE.Material & { isMeshBasicMaterial?: boolean }).isMeshBasicMaterial;
        if (lit) {
          const flat = m.geometry.type === "PlaneGeometry" || m.geometry.type === "CircleGeometry" || m.geometry.type === "RingGeometry";
          m.castShadow = c && !flat;
          m.receiveShadow = true;
        }
      }
      o.children.forEach((ch) => visit(ch, c));
    };
    visit(scene, false);
  }, [scene]);
  return null;
}

export function World({ mobile }: { mobile: boolean }) {
  const timeRef = useRef(scrollState.target);
  return (
    <>
      <color attach="background" args={[CHAR]} />
      <fog attach="fog" args={[CHAR, 16, 85]} />
      <EnvironmentSwitcher />
      <hemisphereLight args={["#dfe7e2", "#2a1d12", 0.3]} />
      {mobile ? <directionalLight position={[10, 20, 10]} intensity={0.6} color="#e8efe9" /> : <ShadowRig />}
      {!mobile && <ShadowFlags />}
      {!mobile && <PostFX />}
      <CameraRig mobile={mobile} timeRef={timeRef} />
      <Courtside mobile={mobile} />
      <Arena mobile={mobile} />
      <PlayRoute mobile={mobile} timeRef={timeRef} />
      <BookWorld mobile={mobile} />
      <PlayWorld mobile={mobile} timeRef={timeRef} />
      <ReplayWorld mobile={mobile} timeRef={timeRef} />
      <Convergence mobile={mobile} timeRef={timeRef} />
    </>
  );
}
