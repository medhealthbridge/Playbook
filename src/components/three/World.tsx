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
import { BadmintonCourt, PickleballCourt, PoolTable, Stands, TableTennisTable, TeamBenches, VolleyballCourt } from "./Props";
import { Exterior, FloodTowers, Sky, useLit } from "./Exterior";
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
  // Preview aid: ?cam=x,y,z,lookX,lookY,lookZ pins the camera (like ?sky= for the time of day).
  const pinned = useMemo(() => {
    const v = new URLSearchParams(window.location.search).get("cam")?.split(",").map(Number);
    return v && v.length === 6 && v.every(Number.isFinite) ? v : null;
  }, []);

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
    if (pinned) {
      p.set(pinned[0], pinned[1], pinned[2]);
      l.set(pinned[3], pinned[4], pinned[5]);
    }
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

const ROUTE_GLOW = new THREE.Color("#D7FF3F").multiplyScalar(1.8);

// Shared PBR parameter objects (stable identities for usePBR memoisation)
const ACRYLIC_PARAMS = { roughness: 1 };
const PANEL_PARAMS = { roughness: 1, color: new THREE.Color("#8d978f") };
const FELT_PARAMS = { roughness: 1 };
const R_GROUND: [number, number] = [35, 15];
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

function Hoop({ position, facing, reach = 1.2 }: { position: V; facing: number; reach?: number }) {
  // facing: rotation around Y so the board faces the court; reach: post distance behind the board
  return (
    <group position={position} rotation={[0, facing, 0]} userData={{ caster: true }}>
      <Box args={[0.18, 3.6, 0.18]} position={[0, 1.8, -reach]} color="#2b3530" />
      <Box args={[0.14, 0.14, reach - 0.1]} position={[0, 3.55, -(reach + 0.1) / 2]} color="#2b3530" />
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
  txt(ctx, "EXAMPLE", 50, 560, 24, "#B7C2BA", 700);
};
const drawTimes = (ctx: CanvasRenderingContext2D) => {
  txt(ctx, "SAT · PICK YOUR TIME", 50, 90, 56, "#F5F7F0", 800, true);
  txt(ctx, "2-hour slots · Asia/Manila", 50, 140, 28, "#B7C2BA", 500);
  const labels = ["2 PM", "3 PM", "4 PM", "5 PM", "6 PM", "7 PM", "8 PM", "9 PM"];
  const states: ("free" | "taken" | "sel")[] = ["free", "taken", "taken", "free", "sel", "free", "taken", "free"];
  labels.forEach((l, i) => chip(ctx, 50 + (i % 4) * 215, 190 + Math.floor(i / 4) * 110, 190, 84, l, states[i]));
  txt(ctx, "6:00 – 8:00 PM selected", 50, 470, 34, "#D7FF3F", 700);
  txt(ctx, "₱2,500 total · ₱1,250 deposit", 50, 520, 30, "#F5F7F0", 500);
  txt(ctx, "EXAMPLE", 50, 610, 24, "#B7C2BA", 700);
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

// ------------------------------------------------------------ scenes
/**
 * Outdoor full court, FIBA markings (28 x 15 m), lengthwise beside the walkway.
 * Baselines at z = -10 and 18; posts stand 1 m behind each baseline.
 */
const CX = 13.5;
const CZ = 4;
const HALF_L = 14;
const HALF_W = 7.5;
const R3 = 6.75; // three-point radius from the basket centre
const A3 = Math.asin(6.6 / R3); // corner lines 0.9 m in from the sidelines
const Z3 = R3 * Math.cos(A3);

/** Markings for one half. e = -1 for the end near the building, +1 for the end near the street. */
function CourtEnd({ e }: { e: 1 | -1 }) {
  const zb = CZ + e * HALF_L; // baseline
  const bz = zb - e * 1.575; // basket centre
  const zf = zb - e * 5.8; // free-throw line
  const toCentre = e < 0 ? Math.PI * 1.5 : Math.PI * 0.5; // ring angle pointing at half court
  const dashes = 7;
  const seg = Math.PI / (dashes * 2 - 1);
  return (
    <>
      {/* painted key */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CX, 0.011, zb - e * 2.9]} receiveShadow>
        <planeGeometry args={[4.9, 5.8]} />
        <meshStandardMaterial color="#b4463b" roughness={0.85} />
      </mesh>
      <Rect x={CX} z={zb - e * 2.9} w={4.9} d={5.8} />
      {/* free-throw circle: solid half outside the key, dashed half inside */}
      <FloorRing x={CX} z={zf} r={1.8} start={toCentre - Math.PI / 2} length={Math.PI} />
      {Array.from({ length: dashes }, (_, i) => (
        <FloorRing key={i} x={CX} z={zf} r={1.8} start={toCentre + Math.PI / 2 + i * 2 * seg} length={seg} />
      ))}
      {/* three-point line */}
      <FloorRing x={CX} z={bz} r={R3} start={toCentre - A3} length={A3 * 2} />
      <FloorLine from={[CX - 6.6, zb]} to={[CX - 6.6, bz - e * Z3]} />
      <FloorLine from={[CX + 6.6, zb]} to={[CX + 6.6, bz - e * Z3]} />
      {/* no-charge semicircle */}
      <FloorRing x={CX} z={bz} r={1.25} start={toCentre - Math.PI / 2} length={Math.PI} />
      <FloorLine from={[CX - 1.25, bz]} to={[CX - 1.25, bz + e * 0.375]} />
      <FloorLine from={[CX + 1.25, bz]} to={[CX + 1.25, bz + e * 0.375]} />
      <Hoop position={[CX, 0, bz + e * 0.2]} facing={e < 0 ? 0 : Math.PI} reach={2.375} />
    </>
  );
}

const ASPHALT_PARAMS = { roughness: 1 };
const PAVER_PARAMS = { roughness: 1 };
const BRICK_PARAMS = { roughness: 1 };
const CLAD_PARAMS = { roughness: 1 };
const R_PLAZA: [number, number] = [26, 4.7];
const R_WALK: [number, number] = [4.25, 22.8];
const R_BRICK: [number, number] = [22.4, 2.2];
const R_CLAD: [number, number] = [5.4, 2.4];
const R_CLAD_MID: [number, number] = [1.67, 1.63];
const R_COURT_FULL: [number, number] = [7, 13];

function Courtside({ mobile }: { mobile: boolean }) {
  const lit = useLit();
  const ground = usePBR("asphalt", R_GROUND, ASPHALT_PARAMS);
  const plaza = usePBR("pavers_concrete", R_PLAZA, PAVER_PARAMS);
  const walk = usePBR("pavers_concrete", R_WALK, PAVER_PARAMS);
  const brick = usePBR("brick_wall", R_BRICK, BRICK_PARAMS);
  const clad = usePBR("facade_panels", R_CLAD, CLAD_PARAMS);
  const cladMid = usePBR("facade_panels", R_CLAD_MID, CLAD_PARAMS);
  const acrylic = usePBR("court_acrylic_blue", R_COURT_FULL, ACRYLIC_PARAMS);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 10]} material={ground} receiveShadow>
        <planeGeometry args={[140, 60]} />
      </mesh>
      {/* paved forecourt along the facade, and the walkway out to the street */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[9.15, 0.004, -16.25]} material={plaza} receiveShadow>
        <planeGeometry args={[41.7, 7.5]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 5.75]} material={walk} receiveShadow>
        <planeGeometry args={[6.8, 36.5]} />
      </mesh>
      {[-1, 1].map((s) => (
        <Box key={s} args={[0.22, 0.14, 36.5]} position={[s * 3.5, 0.07, 5.75]} color="#b9bdb4" />
      ))}
      {/* Pavilion facade: face-brick base, fibre-cement cladding above */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box args={[26, 2.6, 1]} position={[s * 17, 1.3, -20.5]} material={brick} />
          <Box args={[26, 11.4, 1]} position={[s * 17, 8.3, -20.5]} material={clad} />
        </group>
      ))}
      <Box args={[8, 7.8, 1]} position={[0, 10.1, -20.5]} material={cladMid} />
      {/* lime door frame (neon after dark, painted by day) */}
      <Box args={[0.18, 6.2, 0.2]} position={[-4.05, 3.1, -19.95]} color={LIME} emissive={lit} glow={2} />
      <Box args={[0.18, 6.2, 0.2]} position={[4.05, 3.1, -19.95]} color={LIME} emissive={lit} glow={2} />
      <Box args={[8.3, 0.18, 0.2]} position={[0, 6.2, -19.95]} color={LIME} emissive={lit} glow={2} />
      {/* canopy + downlight strip */}
      <Box args={[22, 0.4, 5]} position={[0, 8.6, -17.6]} color="#1a221e" />
      <Box args={[20, 0.05, 0.3]} position={[0, 8.38, -15.6]} color={lit ? "#fffbe8" : "#8c8f88"} emissive={lit} glow={3} />
      {/* fascia stripe */}
      <Box args={[52, 0.25, 0.1]} position={[0, 13.2, -19.95]} color={LIME} emissive={lit} glow={2} />

      {/* outdoor full court: green run-off, blue playing area */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CX, 0.006, CZ]} receiveShadow>
        <planeGeometry args={[HALF_W * 2 + 3, HALF_L * 2 + 4]} />
        <meshStandardMaterial color="#3d7656" roughness={0.85} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CX, 0.008, CZ]} material={acrylic} receiveShadow>
        <planeGeometry args={[HALF_W * 2, HALF_L * 2]} />
      </mesh>
      <Rect x={CX} z={CZ} w={HALF_W * 2} d={HALF_L * 2} />
      <FloorLine from={[CX - HALF_W, CZ]} to={[CX + HALF_W, CZ]} />
      <FloorRing x={CX} z={CZ} r={1.8} />
      <CourtEnd e={-1} />
      <CourtEnd e={1} />
      <Ball position={[2.4, 0.3, 15.8]} />
      {!mobile && <Ball position={[11.2, 0.3, 9.5]} r={0.28} />}

      <FloodTowers mobile={mobile} target={[CX, CZ]} />
      {lit && <pointLight position={[0, 5, -26]} intensity={55} distance={26} decay={1.5} color="#ffe2b8" />}
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
      <Stands mobile={mobile} />
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

/** Basket centre from the middle of a 28 m court, and the half-angle of the three-point arc. */
const BASKET_X = 14 - 1.575;
const ARC3 = Math.asin(6.6 / 6.75);

/** Pool tables (2.82 x 1.55 m outside the rails): rows 2 m apart, tables 2.2 m apart within a row. */
const POOL_LAYOUT: [number, number][] = [-6.4, -11.2].flatMap((x) => [-63.6, -67.4, -71.2].map((z) => [x, z] as [number, number]));
/** Table tennis (2.74 x 1.53 m): one column, 2.8 m between tables end to end of the play area. */
const TT_LAYOUT: [number, number][] = [-62.6, -67.0, -71.4, -75.8].map((z) => [8.2, z]);

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
          {/* three-point line: 6.75 m arc from the basket, straight to the baseline 0.9 m inside each sideline */}
          <FloorRing x={s * BASKET_X} z={cz} r={6.75} start={(s > 0 ? Math.PI : 0) - ARC3} length={ARC3 * 2} />
          <FloorLine from={[s * 14, cz - 6.6]} to={[s * (BASKET_X - 6.75 * Math.cos(ARC3)), cz - 6.6]} />
          <FloorLine from={[s * 14, cz + 6.6]} to={[s * (BASKET_X - 6.75 * Math.cos(ARC3)), cz + 6.6]} />
          {/* no-charge semicircle under the basket */}
          <FloorRing x={s * BASKET_X} z={cz} r={1.25} start={s > 0 ? Math.PI / 2 : -Math.PI / 2} length={Math.PI} />
          <Hoop position={[s * (BASKET_X + 0.2), 0, cz]} facing={s > 0 ? -Math.PI / 2 : Math.PI / 2} />
        </group>
      ))}
      <DribbleBall position={[1.6, 0, cz + 1.2]} shadows={!mobile} />
      <TeamBenches cz={cz} />
      <Ball position={[-9.5, 0.3, cz - 2]} r={0.28} />

      <Panel position={[3.8, 6, -91]} rotY={-0.3} w={4.2} h={2.1} draw={drawConfirm} />
      <Panel position={[-4.6, 4.6, -99]} rotY={0.45} w={4} h={1.9} draw={drawInvite} />
      {(["SHOWERS", "LOCKERS", "WATER REFILL", "PARKING"] as const).map((s, i) => (
        <Panel key={s} position={[i % 2 ? 9 : -9, 2.2, -88 - Math.floor(i / 2) * 16]} rotY={i % 2 ? -0.6 : 0.6} w={2.6} h={0.8} draw={sign(s)} bob={0} border="rgba(245,247,240,0.4)" />
      ))}

      {/* billiards hall on the left: 2 rows of 3 tables, about 2 m of walking room around each */}
      {POOL_LAYOUT.filter((_, i) => !mobile || i < 3).map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <PoolTable felt={felt} />
        </group>
      ))}
      {/* table tennis on the right: 4 tables in a line going into the hall */}
      {TT_LAYOUT.filter((_, i) => !mobile || i < 2).map(([x, z]) => (
        <TableTennisTable key={z} position={[x, 0, z]} />
      ))}

      {/* three side courts beyond the main court, all running the same way */}
      <PickleballCourt position={[0, 0, -117]} />
      {!mobile && (
        <>
          <BadmintonCourt position={[-8.6, 0, -117]} />
          <VolleyballCourt position={[8.7, 0, -116.4]} />
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
  // The featured gallery screen (pickleball) plays its sample clip while the gallery is in view.
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
      <RouteMarkers z={-107.6} />
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
      <Sky mobile={mobile} />
      <hemisphereLight args={["#dfe7e2", "#2a1d12", 0.3]} />
      {mobile ? <directionalLight position={[10, 20, 10]} intensity={0.6} color="#e8efe9" /> : <ShadowRig />}
      {!mobile && <ShadowFlags />}
      {!mobile && <PostFX />}
      <CameraRig mobile={mobile} timeRef={timeRef} />
      <Courtside mobile={mobile} />
      <Exterior mobile={mobile} />
      <Arena mobile={mobile} />
      <PlayRoute mobile={mobile} timeRef={timeRef} />
      <BookWorld mobile={mobile} />
      <PlayWorld mobile={mobile} timeRef={timeRef} />
      <ReplayWorld mobile={mobile} timeRef={timeRef} />
      <Convergence mobile={mobile} timeRef={timeRef} />
    </>
  );
}
