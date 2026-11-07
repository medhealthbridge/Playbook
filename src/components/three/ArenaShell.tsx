"use client";
// Arena architecture: acoustic ceiling, steel roof trusses, high-bay light
// fixtures with halos (and mirrored reflections on devices without the real
// mirror floor), LED ribbon boards with scrolling text, and highlight video
// walls built from the sport photos.
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { GALLERY_CLIPS, usePhotoTextures } from "./Gallery";
import { usePBR } from "./Realism";
import { canvasTexture, fonts } from "./textures";

type V = [number, number, number];
const Z_FROM = -24;
const Z_TO = -198;
const LIGHT_Y = 12.8;

function useInstances(ref: React.RefObject<THREE.InstancedMesh | null>, items: { p: V; r?: V; s?: V }[]) {
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    items.forEach(({ p, r, s }, i) => {
      o.position.set(...p);
      o.rotation.set(...(r ?? [0, 0, 0]));
      o.scale.set(...(s ?? [1, 1, 1]));
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [ref, items]);
}

let haloTex: THREE.Texture | null = null;
function haloTexture() {
  if (haloTex) return haloTex;
  haloTex = canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, "rgba(255,244,222,0.9)");
    g.addColorStop(0.25, "rgba(255,236,205,0.35)");
    g.addColorStop(1, "rgba(255,230,200,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  return haloTex;
}

/** Positions of every ceiling fixture (shared with light shafts). */
export function useLightGrid(mobile: boolean) {
  return useMemo(() => {
    const all: V[] = [];
    const step = mobile ? 12 : 9;
    for (let z = Z_FROM - 4; z > Z_TO; z -= step) for (const x of [-10.5, -3.5, 3.5, 10.5]) all.push([x, LIGHT_Y, z]);
    // shafts only under the inner columns (and sparser on mobile) to limit overdraw
    const shafts = all.filter(([x, , z]) => Math.abs(x) < 5 && (!mobile || Math.round((Z_FROM - 4 - z) / step) % 2 === 0));
    return { all, shafts };
  }, [mobile]);
}

const LIGHT_PANEL = new THREE.Color("#fff6e4").multiplyScalar(4);
const HOUSING = new THREE.MeshStandardMaterial({ color: "#1c2320", roughness: 0.45, metalness: 0.7 });
const STEEL = new THREE.MeshStandardMaterial({ color: "#2b3330", roughness: 0.5, metalness: 0.65 });

export function CeilingLights({ mobile, positions }: { mobile: boolean; positions: V[] }) {
  const housing = useRef<THREE.InstancedMesh>(null);
  const panel = useRef<THREE.InstancedMesh>(null);
  const panelMirror = useRef<THREE.InstancedMesh>(null);
  const rods = useRef<THREE.InstancedMesh>(null);
  useInstances(housing, useMemo(() => positions.map((p) => ({ p: [p[0], p[1] + 0.12, p[2]] as V })), [positions]));
  useInstances(panel, useMemo(() => positions.map((p) => ({ p: [p[0], p[1] - 0.02, p[2]] as V, r: [Math.PI / 2, 0, 0] as V })), [positions]));
  useInstances(panelMirror, useMemo(() => positions.map((p) => ({ p: [p[0], -p[1] + 0.02, p[2]] as V, r: [-Math.PI / 2, 0, 0] as V })), [positions]));
  useInstances(rods, useMemo(() => positions.flatMap((p) => [-0.8, 0.8].map((dx) => ({ p: [p[0] + dx, p[1] + 1.0, p[2]] as V }))), [positions]));
  // camera-facing halos (Points) fake a glow even without bloom
  const halos = useMemo(() => {
    const make = (mirror: boolean) => {
      const g = new THREE.BufferGeometry();
      const arr = new Float32Array(positions.length * 3);
      positions.forEach(([x, y, z], i) => arr.set([x, mirror ? -y + 0.3 : y - 0.3, z], i * 3));
      g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
      return g;
    };
    return { up: make(false), down: make(true) };
  }, [positions]);
  const haloMat = useMemo(
    () =>
      new THREE.PointsMaterial({
        map: haloTexture(),
        size: mobile ? 4.2 : 3.4,
        sizeAttenuation: true,
        transparent: true,
        opacity: mobile ? 0.75 : 0.5,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [mobile],
  );
  return (
    <group>
      <instancedMesh ref={housing} args={[undefined, HOUSING, positions.length]} frustumCulled={false}>
        <boxGeometry args={[2.4, 0.22, 1.0]} />
      </instancedMesh>
      <instancedMesh ref={panel} args={[undefined, undefined, positions.length]} frustumCulled={false}>
        <planeGeometry args={[2.2, 0.8]} />
        <meshBasicMaterial color={LIGHT_PANEL} toneMapped={false} side={THREE.DoubleSide} />
      </instancedMesh>
      <instancedMesh ref={rods} args={[undefined, STEEL, positions.length * 2]} frustumCulled={false}>
        <boxGeometry args={[0.04, 1.8, 0.04]} />
      </instancedMesh>
      <points ref={(p) => p?.layers.set(1)} geometry={halos.up} material={haloMat} frustumCulled={false} />
      {mobile && (
        <>
          <instancedMesh ref={panelMirror} args={[undefined, undefined, positions.length]} frustumCulled={false}>
            <planeGeometry args={[2.2, 0.8]} />
            <meshBasicMaterial color={LIGHT_PANEL} toneMapped={false} side={THREE.DoubleSide} />
          </instancedMesh>
          <points geometry={halos.down} material={haloMat} frustumCulled={false} />
        </>
      )}
    </group>
  );
}

/** Acoustic-panel ceiling plus steel roof trusses spanning the arena. */
export function CeilingStructure({ mobile }: { mobile: boolean }) {
  const repeat = useMemo<[number, number]>(() => [40, 150], []);
  const params = useMemo(() => ({ roughness: 1, color: new THREE.Color("#6f7972"), side: THREE.DoubleSide }), []);
  const ceiling = usePBR("panel_acoustic_dark", repeat, params);
  const truss = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    const span = 47;
    const add = (g: THREE.BufferGeometry, x: number, y: number, rz = 0) => {
      g.rotateZ(rz);
      g.translate(x, y, 0);
      parts.push(g);
    };
    add(new THREE.BoxGeometry(span, 0.26, 0.3), 0, 15.7);
    add(new THREE.BoxGeometry(span, 0.2, 0.26), 0, 14.3);
    for (let x = -span / 2; x <= span / 2 + 0.01; x += 2.35) {
      add(new THREE.BoxGeometry(0.12, 1.4, 0.14), x, 15.0);
      if (x < span / 2 - 0.1) add(new THREE.BoxGeometry(0.09, 2.7, 0.1), x + 1.175, 15.0, Math.atan2(2.35, 1.4) * (Math.round(x) % 2 ? 1 : -1));
    }
    return mergeGeometries(parts)!;
  }, []);
  const trussRef = useRef<THREE.InstancedMesh>(null);
  const items = useMemo(() => {
    const out: { p: V }[] = [];
    for (let z = Z_FROM - 8.5; z > Z_TO; z -= mobile ? 12 : 9) out.push({ p: [0, 0, z] });
    return out;
  }, [mobile]);
  useInstances(trussRef, items);
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 16.6, (Z_FROM + Z_TO) / 2]} material={ceiling}>
        <planeGeometry args={[48, Z_FROM - Z_TO]} />
      </mesh>
      <instancedMesh ref={trussRef} args={[truss, STEEL, items.length]} frustumCulled={false} />
      {/* longitudinal purlins */}
      {[-16, -8, 0, 8, 16].map((x) => (
        <mesh key={x} position={[x, 15.85, (Z_FROM + Z_TO) / 2]} material={STEEL}>
          <boxGeometry args={[0.18, 0.18, Z_FROM - Z_TO]} />
        </mesh>
      ))}
    </group>
  );
}

let ribbonTex: THREE.CanvasTexture | null = null;
function ribbonTexture() {
  if (ribbonTex) return ribbonTex;
  ribbonTex = canvasTexture(2048, 96, (ctx, w, h) => {
    ctx.fillStyle = "#050806";
    ctx.fillRect(0, 0, w, h);
    ctx.font = `800 64px ${fonts().display}`;
    ctx.textBaseline = "middle";
    const words = ["BOOK", "·", "PLAY", "·", "REPLAY", "·", "PLAYBOOK", "·"];
    let x = 24;
    let i = 0;
    while (x < w) {
      const word = words[i % words.length];
      ctx.fillStyle = word === "PLAYBOOK" ? "#D7FF3F" : word === "·" ? "#FF7648" : "#F5F7F0";
      ctx.fillText(word, x, h / 2 + 3);
      x += ctx.measureText(word).width + 34;
      i++;
    }
    // LED dot-matrix grille
    ctx.fillStyle = "rgba(0,0,0,0.38)";
    for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
    for (let gx = 0; gx < w; gx += 4) ctx.fillRect(gx, 0, 1, h);
  }) as THREE.CanvasTexture;
  ribbonTex.wrapS = THREE.RepeatWrapping;
  return ribbonTex;
}

/** LED ribbon boards along the front of the stands, scrolling continuously. */
export function RibbonBoards() {
  const tex = useMemo(() => {
    const t = ribbonTexture().clone();
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.set((Z_FROM - Z_TO) / 14, 1);
    t.needsUpdate = true;
    return t;
  }, []);
  const glow = useMemo(() => new THREE.Color(1.35, 1.35, 1.35), []);
  useFrame((_, dt) => {
    tex.offset.x = (tex.offset.x + dt * 0.035) % 1;
  });
  const len = Z_FROM - Z_TO;
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 15.62, 0.52, (Z_FROM + Z_TO) / 2]} rotation={[0, s < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
          <mesh>
            <planeGeometry args={[len, 0.72]} />
            <meshBasicMaterial map={tex} color={glow} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0, -0.08]} material={HOUSING}>
            <boxGeometry args={[len, 0.86, 0.14]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Long highlight video walls on the side walls, tiled from the sport photos. */
export function VideoWalls() {
  const photos = usePhotoTextures(GALLERY_CLIPS);
  const textures = useMemo(() => {
    const cols = 14;
    const rows = 2;
    const tw = 280;
    const th = 158;
    const gap = 12;
    const make = (seed: number) =>
      canvasTexture(cols * (tw + gap) + gap, rows * (th + gap) + gap, (ctx, w, h) => {
        ctx.fillStyle = "#050806";
        ctx.fillRect(0, 0, w, h);
        let k = seed;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const clip = GALLERY_CLIPS[k % GALLERY_CLIPS.length];
            const img = photos[k % photos.length].image as HTMLImageElement;
            k += 3;
            const x = gap + c * (tw + gap);
            const y = gap + r * (th + gap);
            // crop the square photo to 16:9 around the clip's focus
            const sw = img.width;
            const sh = img.width * (th / tw);
            const sy = THREE.MathUtils.clamp(img.height * (1 - clip.focusY) - sh / 2, 0, img.height - sh);
            ctx.drawImage(img, 0, sy, sw, sh, x, y, tw, th);
            const g = ctx.createLinearGradient(0, y + th * 0.55, 0, y + th);
            g.addColorStop(0, "rgba(5,8,6,0)");
            g.addColorStop(1, "rgba(5,8,6,0.85)");
            ctx.fillStyle = g;
            ctx.fillRect(x, y, tw, th);
            ctx.fillStyle = "#F5F7F0";
            ctx.font = `800 20px ${fonts().display}`;
            ctx.fillText(clip.title.toUpperCase(), x + 12, y + th - 18);
            ctx.fillStyle = "#D7FF3F";
            ctx.fillRect(x + 12, y + th - 9, (tw - 24) * (((k * 37) % 80) / 100 + 0.15), 3);
          }
        }
      });
    return [make(0), make(5)];
  }, [photos]);
  const dim = useMemo(() => new THREE.Color(0.82, 0.82, 0.82), []);
  const lime = useMemo(() => new THREE.Color("#D7FF3F").multiplyScalar(1.6), []);
  const walls: { z: number; t: number }[] = [
    { z: -96, t: 0 },
    { z: -142, t: 1 },
  ];
  const W = 44;
  const H = W * (textures[0].image.height / textures[0].image.width);
  return (
    <group>
      {[-1, 1].flatMap((s) =>
        walls.map((wall, i) => (
          <group key={`${s}${i}`} position={[s * 23.6, 8.6, wall.z]} rotation={[0, s < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
            <mesh>
              <planeGeometry args={[W, H]} />
              <meshBasicMaterial map={textures[(wall.t + (s > 0 ? 1 : 0)) % 2]} color={dim} toneMapped={false} />
            </mesh>
            <mesh position={[0, H / 2 + 0.12, 0.02]}>
              <boxGeometry args={[W, 0.05, 0.05]} />
              <meshBasicMaterial color={lime} toneMapped={false} />
            </mesh>
            <mesh position={[0, -H / 2 - 0.12, 0.02]}>
              <boxGeometry args={[W, 0.05, 0.05]} />
              <meshBasicMaterial color={lime} toneMapped={false} />
            </mesh>
          </group>
        )),
      )}
    </group>
  );
}
