"use client";
// Code-built arena props: grandstands with individual seats, slatted team
// benches, a pool table, and the three side courts (badminton, pickleball,
// volleyball) with real markings, posts and woven nets.
// Dimensions are in metres and follow the real equipment where space allows.
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

type V = [number, number, number];

function box(w: number, h: number, d: number, at: V, rot: V = [0, 0, 0]) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...at), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(1, 1, 1)));
  return g;
}

/* ------------------------------------------------------------------ stands */

const TIER_DEPTH = 0.95;
const TIER_RISE = 0.46;
const SEAT_PITCH = 0.58;
const AISLE_EVERY = 16; // seats between stairways
const STAND_X = 16.35; // front edge of the first tier (behind the LED ribbon)
const Z_NEAR = -26;
const Z_FAR = -196;

const CONCRETE = new THREE.MeshStandardMaterial({ color: "#2a312d", roughness: 0.92 });
const STEP_EDGE = new THREE.MeshStandardMaterial({ color: "#56625b", roughness: 0.8 });
const RAIL = new THREE.MeshStandardMaterial({ color: "#3a433e", roughness: 0.45, metalness: 0.7 });

/** One moulded seat: pan, backrest and the two brackets that carry it. Origin at the tier surface. */
function seatGeometry(simple: boolean) {
  const parts = [box(0.46, 0.06, 0.42, [0, 0.4, 0.02]), box(0.46, 0.44, 0.05, [0, 0.66, -0.2], [-0.16, 0, 0])];
  // Phones skip the brackets: half the triangles, and they are too small to see there.
  if (!simple) parts.push(box(0.04, 0.38, 0.05, [-0.19, 0.2, -0.08]), box(0.04, 0.38, 0.05, [0.19, 0.2, -0.08]));
  return mergeGeometries(parts)!;
}

/** Grandstands down both sides: stepped concrete tiers, stairways, and rows of individual seats. */
export function Stands({ mobile }: { mobile: boolean }) {
  const rows = mobile ? 5 : 8;
  const len = Z_NEAR - Z_FAR;
  const zMid = (Z_NEAR + Z_FAR) / 2;
  const seats = useRef<THREE.InstancedMesh>(null);
  const seatGeo = useMemo(() => seatGeometry(mobile), [mobile]);
  const seatMat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05 }), []);

  const placed = useMemo(() => {
    const out: { m: THREE.Matrix4; c: THREE.Color }[] = [];
    const o = new THREE.Object3D();
    const base = new THREE.Color("#1f3b30");
    const dark = new THREE.Color("#182b24");
    const lime = new THREE.Color("#a9c832");
    const perRow = Math.floor(len / SEAT_PITCH);
    for (const side of [-1, 1]) {
      for (let r = 0; r < rows; r++) {
        for (let i = 0; i < perRow; i++) {
          const block = i % (AISLE_EVERY + 2);
          if (block >= AISLE_EVERY) continue; // stairway
          o.position.set(side * (STAND_X + r * TIER_DEPTH + TIER_DEPTH * 0.55), 0.9 + r * TIER_RISE, Z_NEAR - (i + 0.5) * SEAT_PITCH);
          // Seats face the floor: +z of the seat points at the court.
          o.rotation.set(0, side < 0 ? Math.PI / 2 : -Math.PI / 2, 0);
          o.updateMatrix();
          // Mostly deep green, alternate shade per seat, with a lime band two rows up for the brand.
          const c = r === 2 && block > 1 && block < AISLE_EVERY - 2 ? lime : (i + r) % 2 ? base : dark;
          out.push({ m: o.matrix.clone(), c });
        }
      }
    }
    return out;
  }, [rows, len]);

  useLayoutEffect(() => {
    const mesh = seats.current;
    if (!mesh) return;
    placed.forEach((p, i) => {
      mesh.setMatrixAt(i, p.m);
      mesh.setColorAt(i, p.c);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [placed]);

  const structure = useMemo(() => {
    const tiers: THREE.BufferGeometry[] = [];
    const edges: THREE.BufferGeometry[] = [];
    const rails: THREE.BufferGeometry[] = [];
    for (const side of [-1, 1]) {
      for (let r = 0; r < rows; r++) {
        const top = 0.9 + r * TIER_RISE;
        const x = side * (STAND_X + r * TIER_DEPTH + TIER_DEPTH / 2);
        tiers.push(box(TIER_DEPTH, top, len, [x, top / 2, zMid]));
        // Light nosing on each step so the tiers read from a distance.
        edges.push(box(0.05, 0.03, len, [side * (STAND_X + r * TIER_DEPTH + 0.03), top + 0.012, zMid]));
      }
      // Back wall behind the last row, and a guard rail along the front.
      const backX = side * (STAND_X + rows * TIER_DEPTH + 0.1);
      tiers.push(box(0.2, 0.9 + rows * TIER_RISE + 0.9, len, [backX, (0.9 + rows * TIER_RISE + 0.9) / 2, zMid]));
      rails.push(box(0.05, 0.05, len, [side * (STAND_X - 0.12), 1.55, zMid]));
      for (let z = Z_NEAR; z >= Z_FAR; z -= 3.4) rails.push(box(0.04, 0.65, 0.04, [side * (STAND_X - 0.12), 1.23, z]));
    }
    return { tiers: mergeGeometries(tiers)!, edges: mergeGeometries(edges)!, rails: mergeGeometries(rails)! };
  }, [rows, len, zMid]);

  return (
    <group>
      <mesh geometry={structure.tiers} material={CONCRETE} receiveShadow />
      <mesh geometry={structure.edges} material={STEP_EDGE} />
      <mesh geometry={structure.rails} material={RAIL} />
      <instancedMesh ref={seats} args={[seatGeo, seatMat, placed.length]} frustumCulled={false} receiveShadow />
    </group>
  );
}

/* ----------------------------------------------------------------- benches */

const BENCH_WOOD = new THREE.MeshStandardMaterial({ color: "#b98a55", roughness: 0.55 });
const BENCH_STEEL = new THREE.MeshStandardMaterial({ color: "#1d2421", roughness: 0.4, metalness: 0.75 });

function benchGeometry() {
  const wood: THREE.BufferGeometry[] = [];
  const steel: THREE.BufferGeometry[] = [];
  const L = 3;
  // Seat: three slats. Backrest: two slats, leaning back.
  for (const z of [-0.1, 0.03, 0.16]) wood.push(box(L, 0.035, 0.115, [0, 0.47, z]));
  for (const [y, z] of [[0.74, -0.2], [0.89, -0.225]] as const) wood.push(box(L, 0.115, 0.03, [0, y, z], [-0.16, 0, 0]));
  // Steel frame: three leg sets joined by a rail under the seat.
  for (const x of [-1.32, 0, 1.32]) {
    steel.push(box(0.045, 0.45, 0.045, [x, 0.225, 0.17]));
    steel.push(box(0.045, 0.98, 0.045, [x, 0.49, -0.19], [-0.12, 0, 0]));
    steel.push(box(0.045, 0.04, 0.42, [x, 0.435, 0.0]));
    steel.push(box(0.07, 0.02, 0.5, [x, 0.01, -0.02]));
  }
  steel.push(box(L - 0.3, 0.035, 0.035, [0, 0.2, 0.17]));
  return { wood: mergeGeometries(wood)!, steel: mergeGeometries(steel)! };
}

/** Team benches along the main court sidelines, facing the court. */
export function TeamBenches({ cz }: { cz: number }) {
  const geo = useMemo(benchGeometry, []);
  return (
    <group userData={{ caster: true }}>
      {[-6, 6].flatMap((x) => [
        { x, z: cz - 9.2, r: 0 },
        { x, z: cz + 9.2, r: Math.PI },
      ]).map((b) => (
        <group key={`${b.x}${b.z}`} position={[b.x, 0, b.z]} rotation={[0, b.r, 0]}>
          <mesh geometry={geo.wood} material={BENCH_WOOD} />
          <mesh geometry={geo.steel} material={BENCH_STEEL} />
        </group>
      ))}
    </group>
  );
}

/* -------------------------------------------------------------- pool table */

const WALNUT = new THREE.MeshStandardMaterial({ color: "#4a2a16", roughness: 0.38, metalness: 0.05 });
const WALNUT_DARK = new THREE.MeshStandardMaterial({ color: "#2c180c", roughness: 0.5 });
const POCKET = new THREE.MeshStandardMaterial({ color: "#070908", roughness: 0.9 });
const BRASS = new THREE.MeshStandardMaterial({ color: "#c9a659", roughness: 0.3, metalness: 0.9 });
const CUSHION = new THREE.MeshStandardMaterial({ color: "#176a43", roughness: 0.95 });
const BALL_MAT = new THREE.MeshStandardMaterial({ roughness: 0.12, metalness: 0.05 });
const BALL_COLOURS = ["#f5d43b", "#2f5bd3", "#d63a2f", "#6b2fa3", "#f08a2f", "#1f8a4c", "#7a1f1f", "#111111", "#f5d43b", "#2f5bd3", "#d63a2f", "#6b2fa3", "#f08a2f", "#1f8a4c", "#7a1f1f"];

/** A 9-foot pool table: turned legs, apron, rails with sights, cushions, six pockets, a racked set and a cue. */
export function PoolTable({ felt }: { felt: THREE.Material }) {
  const parts = useMemo(() => {
    const PW = 2.54, PD = 1.27; // playing surface
    const bedY = 0.79;
    const rail = 0.14;
    const rails: THREE.BufferGeometry[] = [];
    const cushions: THREE.BufferGeometry[] = [];
    const gap = 0.13; // pocket mouth
    // Long rails are split at the side pockets; short rails run between the corner pockets.
    for (const s of [-1, 1]) {
      for (const h of [-1, 1]) {
        const segLen = PW / 2 - gap * 1.1;
        rails.push(box(segLen + rail * 0.6, 0.075, rail, [h * (PW / 4 + gap * 0.15), bedY + 0.025, s * (PD / 2 + rail / 2)]));
        cushions.push(box(segLen - 0.05, 0.04, 0.05, [h * (PW / 4 + gap * 0.25), bedY + 0.022, s * (PD / 2 - 0.025)]));
      }
      rails.push(box(rail, 0.075, PD - gap * 1.2, [s * (PW / 2 + rail / 2), bedY + 0.025, 0]));
      cushions.push(box(0.05, 0.04, PD - gap * 2.1, [s * (PW / 2 - 0.025), bedY + 0.022, 0]));
    }
    // Corner blocks tie the rails together around the pockets.
    const corners: THREE.BufferGeometry[] = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) corners.push(box(rail + 0.05, 0.08, rail + 0.05, [sx * (PW / 2 + rail / 2 + 0.01), bedY + 0.022, sz * (PD / 2 + rail / 2 + 0.01)]));
    const legs: THREE.BufferGeometry[] = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const leg = new THREE.CylinderGeometry(0.1, 0.065, 0.5, 14);
      leg.translate(sx * (PW / 2 - 0.12), 0.25, sz * (PD / 2 - 0.1));
      const foot = new THREE.CylinderGeometry(0.085, 0.085, 0.04, 14);
      foot.translate(sx * (PW / 2 - 0.12), 0.02, sz * (PD / 2 - 0.1));
      const cap = new THREE.CylinderGeometry(0.12, 0.1, 0.06, 14);
      cap.translate(sx * (PW / 2 - 0.12), 0.5, sz * (PD / 2 - 0.1));
      legs.push(leg, foot, cap);
    }
    const pockets: V[] = [];
    for (const sz of [-1, 1]) {
      pockets.push([0, bedY + 0.012, sz * (PD / 2 + 0.035)]);
      for (const sx of [-1, 1]) pockets.push([sx * (PW / 2 + 0.01), bedY + 0.012, sz * (PD / 2 + 0.01)]);
    }
    // Sights (the "diamonds"): three between each pair of pockets.
    const sights: V[] = [];
    for (const s of [-1, 1]) {
      for (const h of [-1, 1]) for (const k of [1, 2, 3]) sights.push([h * (k * PW / 8), bedY + 0.064, s * (PD / 2 + rail / 2)]);
      for (const k of [-1, 0, 1]) sights.push([s * (PW / 2 + rail / 2), bedY + 0.064, k * PD / 4]);
    }
    return {
      PW, PD, bedY,
      rails: mergeGeometries(rails)!, cushions: mergeGeometries(cushions)!, corners: mergeGeometries(corners)!, legs: mergeGeometries(legs)!,
      apron: box(PW + rail * 2 - 0.04, 0.24, PD + rail * 2 - 0.04, [0, 0.635, 0]),
      pocketGeo: mergeGeometries(pockets.map((p) => new THREE.CylinderGeometry(0.062, 0.05, 0.05, 16).translate(...p)))!,
      sightGeo: mergeGeometries(sights.map((p) => new THREE.CylinderGeometry(0.011, 0.011, 0.004, 8).translate(...p)))!,
    };
  }, []);
  const R = 0.036; // ball radius, a touch over regulation so the rack reads from the camera path
  const y = parts.bedY + 0.006 + R;
  const rack = useMemo(() => {
    const out: V[] = [];
    let n = 0;
    for (let row = 0; row < 5; row++) for (let k = 0; k <= row; k++) out[n++] = [0.62 + row * R * 1.74, y, (k - row / 2) * R * 2.02];
    out.push([-0.68, y, 0.04]);
    return out;
  }, [y, R]);
  const balls = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = balls.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    rack.forEach((p, i) => {
      o.position.set(...p);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, c.set(i < 15 ? BALL_COLOURS[i] : "#fbfaf2"));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [rack]);

  return (
    <group userData={{ caster: true }}>
      <mesh geometry={parts.legs} material={WALNUT_DARK} />
      <mesh geometry={parts.apron} material={WALNUT} />
      <mesh position={[0, parts.bedY - 0.01, 0]} material={felt}>
        <boxGeometry args={[parts.PW + 0.06, 0.03, parts.PD + 0.06]} />
      </mesh>
      <mesh geometry={parts.cushions} material={CUSHION} />
      <mesh geometry={parts.rails} material={WALNUT} />
      <mesh geometry={parts.corners} material={WALNUT_DARK} />
      <mesh geometry={parts.pocketGeo} material={POCKET} />
      <mesh geometry={parts.sightGeo} material={BRASS} />
      {/* the 15 racked balls and the cue ball share one instanced draw */}
      <instancedMesh ref={balls} args={[undefined, undefined, 16]} material={BALL_MAT}>
        <sphereGeometry args={[R, 18, 12]} />
      </instancedMesh>
      {/* cue resting across the near rail */}
      <group position={[-0.95, parts.bedY + 0.085, 0.52]} rotation={[0, 0.5, Math.PI / 2 - 0.035]}>
        <mesh>
          <cylinderGeometry args={[0.0065, 0.014, 1.47, 10]} />
          <meshStandardMaterial color="#e0c08a" roughness={0.35} />
        </mesh>
        <mesh position={[0, -0.5, 0]} material={WALNUT_DARK}>
          <cylinderGeometry args={[0.0118, 0.0145, 0.48, 10]} />
        </mesh>
      </group>
      {/* pendant lamp: dark shade, warm glow underneath, two rods to the ceiling */}
      <group position={[0, 1.95, 0]}>
        <mesh material={WALNUT_DARK}>
          <boxGeometry args={[1.9, 0.16, 0.46]} />
        </mesh>
        <mesh position={[0, -0.085, 0]}>
          <boxGeometry args={[1.78, 0.02, 0.36]} />
          <meshBasicMaterial color={[1.6, 1.45, 1.1]} toneMapped={false} />
        </mesh>
        {[-0.7, 0.7].map((x) => (
          <mesh key={x} position={[x, 1.1, 0]} material={BENCH_STEEL}>
            <cylinderGeometry args={[0.012, 0.012, 2.1, 6]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ courts */

const POST = new THREE.MeshStandardMaterial({ color: "#20272a", roughness: 0.35, metalness: 0.8 });
const LINE = new THREE.MeshBasicMaterial({ color: "#f5f7f0", toneMapped: false });

/** Woven net texture: dark cord on transparent, with a white tape along the top. */
function netTexture(cols: number, rows: number, tape: number) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.strokeStyle = "rgba(235,240,232,0.78)";
  ctx.lineWidth = 2;
  const tapePx = c.height * tape;
  for (let i = 0; i <= cols; i++) {
    const x = (i / cols) * c.width;
    ctx.beginPath(); ctx.moveTo(x, tapePx); ctx.lineTo(x, c.height); ctx.stroke();
  }
  for (let j = 1; j <= rows; j++) {
    const yy = tapePx + ((c.height - tapePx) * j) / rows;
    ctx.beginPath(); ctx.moveTo(0, yy - 1); ctx.lineTo(c.width, yy - 1); ctx.stroke();
  }
  ctx.fillStyle = "#f5f7f0";
  ctx.fillRect(0, 0, c.width, tapePx);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** A net across the court (along x) between two posts. `top` is the height of the tape, `drop` the depth of the mesh. */
function Net({ width, top, drop, cols, rows, tape = 0.1, postHeight, sag = 0 }: { width: number; top: number; drop: number; cols: number; rows: number; tape?: number; postHeight?: number; sag?: number }) {
  const tex = useMemo(() => netTexture(cols, rows, tape), [cols, rows, tape]);
  const geo = useMemo(() => {
    // A slight sag in the middle, as on a real net held by its posts.
    const g = new THREE.PlaneGeometry(width, drop, 24, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = p.getX(i) / (width / 2);
      p.setY(i, p.getY(i) - sag * (1 - t * t));
    }
    p.needsUpdate = true;
    return g;
  }, [width, drop, sag]);
  const ph = postHeight ?? top + 0.05;
  return (
    <group>
      <mesh geometry={geo} position={[0, top - drop / 2, 0]}>
        <meshBasicMaterial map={tex} transparent side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (width / 2 + 0.04), 0, 0]}>
          <mesh position={[0, ph / 2, 0]} material={POST}>
            <cylinderGeometry args={[0.04, 0.04, ph, 12]} />
          </mesh>
          <mesh position={[0, 0.015, 0]} material={POST}>
            <cylinderGeometry args={[0.16, 0.18, 0.03, 16]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Surface({ w, d, color, y, x = 0, z = 0 }: { w: number; d: number; color: string; y: number; x?: number; z?: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, y, z]}>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial color={color} roughness={0.82} />
    </mesh>
  );
}

/** A painted line on the floor, given as a centre and size in the court's own x/z. */
function Stripe({ x, z, w, d, y = 0.016 }: { x: number; z: number; w: number; d: number; y?: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, y, z]} material={LINE}>
      <planeGeometry args={[w, d]} />
    </mesh>
  );
}

function Outline({ w, d, t = 0.05 }: { w: number; d: number; t?: number }) {
  return (
    <>
      <Stripe x={0} z={-d / 2} w={w + t} d={t} />
      <Stripe x={0} z={d / 2} w={w + t} d={t} />
      <Stripe x={-w / 2} z={0} w={t} d={d} />
      <Stripe x={w / 2} z={0} w={t} d={d} />
    </>
  );
}

/** Pickleball: 6.10 x 13.41 m, 2.13 m non-volley zone each side of a 0.86-0.91 m net. */
export function PickleballCourt({ position }: { position: V }) {
  const W = 6.1, D = 13.41, K = 2.13;
  return (
    <group position={position}>
      <Surface w={W + 1.5} d={D + 1.6} color="#101f2e" y={0.006} />
      <Surface w={W} d={D} color="#1b4a80" y={0.009} />
      <Surface w={W} d={K * 2} color="#1f6647" y={0.011} />
      <Outline w={W} d={D} />
      <Stripe x={0} z={-K} w={W} d={0.05} />
      <Stripe x={0} z={K} w={W} d={0.05} />
      <Stripe x={0} z={-(K + D / 2) / 2} w={0.05} d={D / 2 - K} />
      <Stripe x={0} z={(K + D / 2) / 2} w={0.05} d={D / 2 - K} />
      <Net width={6.7} top={0.914} drop={0.76} cols={90} rows={10} tape={0.09} sag={0.05} />
      <mesh position={[1.4, 0.05, 3.1]}>
        <sphereGeometry args={[0.05, 14, 10]} />
        <meshStandardMaterial color="#e6f23a" roughness={0.6} />
      </mesh>
    </group>
  );
}

/** Badminton: 6.10 x 13.40 m doubles court, net 1.55 m at the posts. */
export function BadmintonCourt({ position }: { position: V }) {
  const W = 6.1, D = 13.4;
  return (
    <group position={position}>
      <Surface w={W + 1.2} d={D + 1.2} color="#0d241e" y={0.006} />
      <Surface w={W} d={D} color="#155a42" y={0.009} />
      <Outline w={W} d={D} t={0.04} />
      {/* singles side lines, short service lines, doubles long service lines, centre lines */}
      <Stripe x={-(W / 2 - 0.46)} z={0} w={0.04} d={D} />
      <Stripe x={W / 2 - 0.46} z={0} w={0.04} d={D} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <Stripe x={0} z={s * 1.98} w={W} d={0.04} />
          <Stripe x={0} z={s * (D / 2 - 0.76)} w={W} d={0.04} />
          <Stripe x={0} z={s * (1.98 + D / 2) / 2} w={0.04} d={D / 2 - 1.98} />
        </group>
      ))}
      <Net width={6.1} top={1.55} drop={0.76} cols={110} rows={12} tape={0.1} sag={0.025} />
      <mesh position={[-0.6, 2.6, 1.4]} rotation={[0.5, 0, 0.6]}>
        <coneGeometry args={[0.07, 0.16, 14, 1, true]} />
        <meshBasicMaterial color="#F5F7F0" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** Volleyball: a 6 x 12 m practice court (two-thirds scale of the 9 x 18 m court), net 2.43 m. */
export function VolleyballCourt({ position }: { position: V }) {
  const W = 6, D = 12, ATTACK = 2;
  return (
    <group position={position}>
      <Surface w={W + 1.6} d={D + 1.6} color="#14324f" y={0.006} />
      <Surface w={W} d={D} color="#a85f26" y={0.009} />
      <Surface w={W} d={ATTACK * 2} color="#8f4d1d" y={0.011} />
      <Outline w={W} d={D} />
      <Stripe x={0} z={0} w={W} d={0.05} />
      <Stripe x={0} z={-ATTACK} w={W} d={0.05} />
      <Stripe x={0} z={ATTACK} w={W} d={0.05} />
      <Net width={6.6} top={2.43} drop={1} cols={70} rows={10} tape={0.07} postHeight={2.55} sag={0.02} />
      {/* antennae above the sidelines */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * W / 2, 2.83, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.8, 6]} />
          <meshBasicMaterial color="#e2483a" toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[0.9, 3.5, 1.2]}>
        <sphereGeometry args={[0.21, 22, 16]} />
        <meshStandardMaterial color="#f4f0df" roughness={0.55} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------ table tennis */

const TT_TOP = new THREE.MeshStandardMaterial({ color: "#1d4f9a", roughness: 0.35 });
const TT_FRAME = new THREE.MeshStandardMaterial({ color: "#1c2220", roughness: 0.45, metalness: 0.7 });

/** A 2.74 x 1.525 m table tennis table, 0.76 m high, with edge and centre lines, a net, two bats and a ball. */
export function TableTennisTable({ position, rotY = 0 }: { position: V; rotY?: number }) {
  const g = useMemo(() => {
    const L = 2.74, W = 1.525, H = 0.76;
    const lines = mergeGeometries([
      box(L, 0.004, 0.02, [0, H + 0.002, W / 2 - 0.01]), box(L, 0.004, 0.02, [0, H + 0.002, -W / 2 + 0.01]),
      box(0.02, 0.004, W, [L / 2 - 0.01, H + 0.002, 0]), box(0.02, 0.004, W, [-L / 2 + 0.01, H + 0.002, 0]),
      box(L, 0.004, 0.006, [0, H + 0.002, 0]),
    ])!;
    const legs: THREE.BufferGeometry[] = [];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) legs.push(box(0.05, H - 0.03, 0.05, [sx * 0.95, (H - 0.03) / 2, sz * 0.6]));
      legs.push(box(0.05, 0.05, 1.25, [sx * 0.95, 0.2, 0]), box(0.05, 0.05, 1.25, [sx * 0.95, H - 0.06, 0]));
    }
    legs.push(box(1.9, 0.05, 0.05, [0, H - 0.06, 0]));
    // net posts
    legs.push(box(0.02, 0.17, 0.02, [0, H + 0.085, W / 2 + 0.15]), box(0.02, 0.17, 0.02, [0, H + 0.085, -W / 2 - 0.15]));
    return { L, W, H, lines, frame: mergeGeometries(legs)! };
  }, []);
  const net = useMemo(() => netTexture(60, 4, 0.14), []);
  return (
    <group position={position} rotation={[0, rotY, 0]} userData={{ caster: true }}>
      <mesh position={[0, g.H - 0.0125, 0]} material={TT_TOP}>
        <boxGeometry args={[g.L, 0.025, g.W]} />
      </mesh>
      <mesh geometry={g.lines} material={LINE} />
      <mesh geometry={g.frame} material={TT_FRAME} />
      <mesh position={[0, g.H + 0.076, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[g.W + 0.3, 0.1525]} />
        <meshBasicMaterial map={net} transparent side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
      {([[-0.9, 0.35, "#c8352b"], [0.95, -0.3, "#1b1f1e"]] as [number, number, string][]).map(([x, z, c]) => (
        <group key={c} position={[x, g.H + 0.012, z]} rotation={[0, x * 0.9, 0]}>
          <mesh>
            <cylinderGeometry args={[0.078, 0.078, 0.012, 20]} />
            <meshStandardMaterial color={c} roughness={0.7} />
          </mesh>
          <mesh position={[0.12, 0, 0]}>
            <boxGeometry args={[0.1, 0.02, 0.028]} />
            <meshStandardMaterial color="#b98a55" roughness={0.6} />
          </mesh>
        </group>
      ))}
      <mesh position={[0.4, g.H + 0.02, 0.2]}>
        <sphereGeometry args={[0.02, 12, 8]} />
        <meshStandardMaterial color="#fff7ea" roughness={0.4} />
      </mesh>
    </group>
  );
}
