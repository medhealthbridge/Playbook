"use client";
// Realism layer: image-based lighting (HDRI), PBR surface materials, a
// reflective hardwood floor, real-time shadows, bloom, light shafts, drifting
// dust and small motion details. Heavy effects run on desktop only.
// Asset files live in public/assets (see scripts/prepare_assets.py).
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { basketballTexture } from "./textures";

export const ASSETS = {
  hdriArena: "/assets/hdri/arena_evening_1k.hdr",
  hdriExterior: "/assets/hdri/exterior_bluehour_512.hdr",
  bleacher: "/assets/models/bleacher_module.glb",
  bench: "/assets/models/team_bench.glb",
  lightBeam: "/assets/fx/light_beam.png",
  dust: "/assets/fx/dust_particles.png",
  arenaVideo: "/assets/video/ambient-arena.mp4",
  arenaPoster: "/assets/video/ambient-arena-poster.jpg",
} as const;

export type PBRName =
  | "hardwood_maple"
  | "concrete_polished"
  | "court_acrylic_blue"
  | "panel_acoustic_dark"
  | "felt_billiards"
  | "wall_plaster_white";

const pbrUrls = (n: PBRName) => [
  `/assets/textures/${n}/${n}_basecolor.jpg`,
  `/assets/textures/${n}/${n}_normal.jpg`,
  `/assets/textures/${n}/${n}_orm.jpg`,
];

/** Physically based material from a texture set (ORM = AO / roughness / metal). */
export function usePBR(
  name: PBRName,
  repeat: [number, number],
  params: THREE.MeshPhysicalMaterialParameters = {},
  rotation = 0,
) {
  const [map, normalMap, orm] = useLoader(THREE.TextureLoader, pbrUrls(name));
  return useMemo(() => {
    const tex = [map, normalMap, orm].map((t) => {
      const c = t.clone();
      c.wrapS = c.wrapT = THREE.RepeatWrapping;
      c.repeat.set(...repeat);
      c.rotation = rotation;
      c.center.set(0.5, 0.5);
      c.anisotropy = 8;
      c.needsUpdate = true;
      return c;
    });
    tex[0].colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshPhysicalMaterial({
      map: tex[0],
      normalMap: tex[1],
      roughnessMap: tex[2],
      aoMap: tex[2],
      metalnessMap: tex[2],
      metalness: 1, // scaled by the metal channel (0 for non-metals)
      ...params,
    });
  }, [map, normalMap, orm, repeat, params, rotation]);
}

/** Image-based lighting: exterior HDRI outside the pavilion, arena HDRI inside. */
export function EnvironmentSwitcher() {
  const { gl, scene, camera } = useThree();
  const [arenaHdr, extHdr] = useLoader(HDRLoader, [ASSETS.hdriArena, ASSETS.hdriExterior]);
  const maps = useMemo(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const arena = pm.fromEquirectangular(arenaHdr).texture;
    const ext = pm.fromEquirectangular(extHdr).texture;
    pm.dispose();
    return { arena, ext };
  }, [gl, arenaHdr, extHdr]);
  const charcoal = useMemo(() => new THREE.Color("#101713"), []);
  useMemo(() => {
    extHdr.mapping = THREE.EquirectangularReflectionMapping;
  }, [extHdr]);
  useFrame(() => {
    const inside = camera.position.z < -19.5;
    const env = inside ? maps.arena : maps.ext;
    if (scene.environment !== env) scene.environment = env;
    scene.environmentIntensity = inside ? 0.38 : 0.3;
    // blue-hour sky outside; enclosed arena keeps the dark backdrop
    const bg = inside ? charcoal : extHdr;
    if (scene.background !== bg) scene.background = bg;
    scene.backgroundIntensity = 0.55;
    scene.backgroundBlurriness = 0.02;
  });
  useEffect(() => () => {
    scene.environment = null;
  }, [scene]);
  return null;
}

/** Glossy maple: PBR wood over a planar mirror so the lights reflect like a real court. */
export function ArenaFloor({ quality }: { quality: "high" | "low" }) {
  const size: [number, number] = [44, 180];
  const repeat = useMemo<[number, number]>(() => [22, 90], []);
  const params = useMemo(
    () => ({
      clearcoat: 0.8,
      clearcoatRoughness: 0.12,
      // low quality has no real mirror, but stays slightly see-through so the
      // mirrored screens/lights placed under it read as reflections
      transparent: true,
      opacity: quality === "high" ? 0.8 : 0.84,
    }),
    [quality],
  );
  const wood = usePBR("hardwood_maple", repeat, params);
  const { size: view, gl } = useThree();
  const mirror = useMemo(() => {
    if (quality !== "high") return null;
    const dpr = gl.getPixelRatio();
    const r = new Reflector(new THREE.PlaneGeometry(...size), {
      textureWidth: Math.round(view.width * dpr * 0.5),
      textureHeight: Math.round(view.height * dpr * 0.5),
      color: 0x8a8a8a,
      clipBias: 0.003,
    });
    r.rotation.x = -Math.PI / 2;
    r.position.set(0, -0.004, -110);
    // refresh the reflection every other frame: the camera moves slowly, so a
    // one-frame-old mirror is invisible but halves the cost of this pass
    const render = r.onBeforeRender.bind(r);
    let frame = 0;
    r.onBeforeRender = (...args: Parameters<typeof render>) => {
      if (frame++ % 2 === 0) render(...args);
    };
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quality, gl]);
  useEffect(() => () => mirror?.dispose(), [mirror]);
  return (
    <>
      {mirror && <primitive object={mirror} />}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -110]} material={wood} receiveShadow>
        <planeGeometry args={size} />
      </mesh>
    </>
  );
}

/** Shadow-casting key light that travels with the camera (desktop). */
export function ShadowRig() {
  const { camera } = useThree();
  const light = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    const l = light.current;
    if (!l) return;
    l.target = target;
    const c = l.shadow.camera as THREE.OrthographicCamera;
    c.left = -26;
    c.right = 26;
    c.top = 26;
    c.bottom = -26;
    c.near = 1;
    c.far = 70;
    c.updateProjectionMatrix();
    l.shadow.mapSize.set(2048, 2048);
    l.shadow.bias = -0.0004;
    l.shadow.normalBias = 0.03;
  }, [target]);
  const { gl } = useThree();
  const frame = useRef(0);
  useLayoutEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    return () => {
      gl.shadowMap.autoUpdate = true;
    };
  }, [gl]);
  useFrame(() => {
    // shadow map refreshes every other frame (same trick as the mirror floor)
    gl.shadowMap.needsUpdate = frame.current++ % 2 === 0;
    const l = light.current;
    if (!l) return;
    // snap to a 1 m grid to avoid shadow shimmer while moving
    const x = Math.round(camera.position.x);
    const z = Math.round(camera.position.z - 14);
    target.position.set(x, 0, z);
    l.position.set(x + 7, 24, z + 9);
    target.updateMatrixWorld();
  });
  return (
    <>
      <primitive object={target} />
      <directionalLight ref={light} castShadow intensity={1.05} color="#fff1dc" />
    </>
  );
}

/** Soft light shafts under each ceiling light (additive, two crossed planes). */
export function LightShafts({ positions }: { positions: [number, number, number][] }) {
  const tex = useLoader(THREE.TextureLoader, ASSETS.lightBeam);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const count = positions.length * 2;
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const o = new THREE.Object3D();
    positions.forEach(([x, y, z], i) => {
      for (let k = 0; k < 2; k++) {
        o.position.set(x, y - 6.2, z);
        o.rotation.set(0, k * Math.PI / 2 + 0.3, 0);
        o.scale.set(1, 1, 1);
        o.updateMatrix();
        m.setMatrixAt(i * 2 + k, o.matrix);
      }
    });
    m.instanceMatrix.needsUpdate = true;
  }, [positions]);
  return (
    <instancedMesh ref={(m) => { mesh.current = m; m?.layers.set(1); }} args={[undefined, undefined, count]} frustumCulled={false}>
      <planeGeometry args={[5.5, 12.5]} />
      <meshBasicMaterial
        map={tex}
        color="#ffe7c2"
        transparent
        opacity={0.22}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        side={THREE.DoubleSide}
        toneMapped={false}
        fog
      />
    </instancedMesh>
  );
}

/** Drifting dust motes that catch the arena light. */
export function Dust({ count, from, to }: { count: number; from: number; to: number }) {
  const tex = useLoader(THREE.TextureLoader, ASSETS.dust);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      p[i * 3] = (Math.random() - 0.5) * 30;
      p[i * 3 + 1] = 0.4 + Math.random() * 12;
      p[i * 3 + 2] = from + Math.random() * (to - from);
    }
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return g;
  }, [count, from, to]);
  const pts = useRef<THREE.Points>(null);
  useFrame(({ clock }, dt) => {
    const a = geo.attributes.position as THREE.BufferAttribute;
    const arr = a.array as Float32Array;
    const t = clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += dt * (0.05 + (i % 7) * 0.012);
      arr[i * 3] += Math.sin(t * 0.3 + i) * dt * 0.06;
      if (arr[i * 3 + 1] > 12.5) arr[i * 3 + 1] = 0.4;
    }
    a.needsUpdate = true;
  });
  return (
    <points ref={(p) => { pts.current = p as THREE.Points | null; p?.layers.set(1); }} geometry={geo} frustumCulled={false}>
      <pointsMaterial
        map={tex}
        size={0.09}
        sizeAttenuation
        color="#ffe9c9"
        transparent
        opacity={0.75}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}

/** Instanced GLB: one draw call per sub-mesh, however many copies. */
function useInstancedGLB(url: string, placements: THREE.Matrix4[], shadows: boolean) {
  const gltf = useLoader(GLTFLoader, url);
  return useMemo(() => {
    const group = new THREE.Group();
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const inst = new THREE.InstancedMesh(mesh.geometry, mesh.material, placements.length);
      const m = new THREE.Matrix4();
      placements.forEach((p, i) => inst.setMatrixAt(i, m.multiplyMatrices(p, mesh.matrixWorld)));
      inst.instanceMatrix.needsUpdate = true;
      inst.castShadow = shadows;
      inst.receiveShadow = shadows;
      inst.frustumCulled = false;
      group.add(inst);
    });
    return group;
  }, [gltf, placements, shadows]);
}

/** Seating bowl: repeated bleacher modules down both sides of the arena. */
export function Bleachers({ shadows, mobile }: { shadows: boolean; mobile: boolean }) {
  const placements = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    const s = 1.5; // module is 4 m wide at scale 1
    const step = 4 * s;
    for (const side of [-1, 1]) {
      for (let z = -26; z > -196; z -= mobile ? step * 2 : step) {
        const m = new THREE.Matrix4().compose(
          new THREE.Vector3(side * 16.6, 0, z),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, side < 0 ? Math.PI / 2 : -Math.PI / 2, 0)),
          new THREE.Vector3(s, s, s),
        );
        out.push(m);
      }
    }
    return out;
  }, [mobile]);
  const group = useInstancedGLB(ASSETS.bleacher, placements, shadows);
  return <primitive object={group} />;
}

/** Team benches along the main court sidelines. */
export function Benches({ shadows, cz }: { shadows: boolean; cz: number }) {
  const placements = useMemo(
    () =>
      [-6, 6].flatMap((x) => [
        new THREE.Matrix4().compose(new THREE.Vector3(x, 0, cz - 9.2), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)),
        new THREE.Matrix4().compose(
          new THREE.Vector3(x, 0, cz + 9.2),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0)),
          new THREE.Vector3(1, 1, 1),
        ),
      ]),
    [cz],
  );
  const group = useInstancedGLB(ASSETS.bench, placements, shadows);
  return <primitive object={group} />;
}

/** A ball dribbling on centre court — a small sign of life. */
export function DribbleBall({ position, r = 0.3, shadows }: { position: [number, number, number]; r?: number; shadows: boolean }) {
  const tex = useMemo(() => basketballTexture(), []);
  const ball = useRef<THREE.Mesh>(null);
  const shadow = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 1.7;
    const h = Math.abs(Math.sin(t * Math.PI * 0.5)); // 0 at the floor
    const y = r + h * 1.05;
    if (ball.current) {
      ball.current.position.y = y;
      ball.current.rotation.x += 0.02;
      const squash = h < 0.08 ? 0.9 : 1;
      ball.current.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
    }
    if (shadow.current) {
      const s = 1.15 - h * 0.45;
      shadow.current.scale.set(s, s, s);
      (shadow.current.material as THREE.MeshBasicMaterial).opacity = 0.5 - h * 0.3;
    }
  });
  return (
    <group position={position}>
      <mesh ref={ball} castShadow={shadows}>
        <sphereGeometry args={[r, 32, 20]} />
        <meshStandardMaterial map={tex} roughness={0.6} />
      </mesh>
      <mesh ref={shadow} position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[r, 24]} />
        <meshBasicMaterial color="#000" transparent opacity={0.45} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Silent looping arena video, played only while it can be seen. */
export interface LoopVideo {
  texture: THREE.VideoTexture;
  ready: () => boolean;
  /** playback position, 0..1 */
  progress: () => number;
}

/**
 * Muted looping video as a texture. Loads nothing until first shown, plays
 * only while `isVisible()` is true, and pauses otherwise.
 */
export function useLoopVideo(src: string, poster: string, isVisible: () => boolean): LoopVideo {
  const video = useMemo(() => {
    const v = document.createElement("video");
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.preload = "none";
    v.crossOrigin = "anonymous";
    v.poster = poster;
    v.src = src;
    return v;
  }, [src, poster]);
  const texture = useMemo(() => {
    const t = new THREE.VideoTexture(video);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [video]);
  useFrame(() => {
    const show = isVisible();
    if (show && video.paused) video.play().catch(() => {});
    if (!show && !video.paused) video.pause();
  });
  useEffect(
    () => () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
      texture.dispose();
    },
    [video, texture],
  );
  return useMemo(
    () => ({
      texture,
      ready: () => video.readyState >= 2,
      progress: () => (video.duration > 0 ? video.currentTime / video.duration : 0),
    }),
    [video, texture],
  );
}

/** The giant REPLAY screen's ambient arena loop. */
export function useArenaVideo(isVisible: () => boolean) {
  return useLoopVideo(ASSETS.arenaVideo, ASSETS.arenaPoster, isVisible);
}

/** Bloom on the brightest emissives (lights, lime lines) — desktop only. */
export function PostFX() {
  const { gl, scene, camera, size } = useThree();
  const composer = useMemo(() => {
    const c = new EffectComposer(gl);
    c.addPass(new RenderPass(scene, camera));
    c.addPass(new UnrealBloomPass(new THREE.Vector2(size.width, size.height), 0.5, 0.5, 1.35));
    c.addPass(new OutputPass());
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera]);
  useEffect(() => {
    composer.setPixelRatio(gl.getPixelRatio());
    composer.setSize(size.width, size.height);
  }, [composer, gl, size]);
  useEffect(() => () => composer.dispose(), [composer]);
  // priority 1 takes over rendering from R3F
  useFrame((_, dt) => composer.render(dt), 1);
  return null;
}
