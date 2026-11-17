"use client";
// The single WebGL canvas. Loaded lazily (never blocks the HTML booking UI),
// paused when off-screen, and falls back silently if WebGL fails.
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Component, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { scrollState } from "./timeline";
import { ENV_MAPS } from "./Realism";
import { World } from "./World";
import { TIER, downgrade, initialQuality, type Quality } from "./quality";

class GLBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Before the curtain lifts, prepare everything the scroll will ever show: compile every shader and
 * upload every mesh and texture to the GPU by drawing the whole world once, with nothing hidden or
 * culled, while the canvas is still behind the loading screen. Otherwise each new section compiles and uploads on first sight, which is the
 * stutter people feel mid-scroll (worst on phones).
 */
function WarmUp({ onReady, bloom }: { onReady: () => void; bloom: boolean }) {
  const { gl, scene, camera } = useThree();
  const warmed = useRef(false);
  const ready = useRef(onReady);
  ready.current = onReady;
  useEffect(() => {
    let cancelled = false;
    // After a quality step-down the scene is on screen: compile the new shader versions without
    // drawing anything (no flash). Textures and meshes are already on the GPU by then.
    if (warmed.current) {
      const env = scene.environment;
      for (const map of ENV_MAPS.size ? ENV_MAPS : [env]) {
        scene.environment = map;
        gl.compile(scene, camera);
      }
      scene.environment = env;
      return;
    }
    const id = requestAnimationFrame(() => {
      if (cancelled) return;
      warmed.current = true;
      const hidden: THREE.Object3D[] = [];
      const culled: THREE.Object3D[] = [];
      scene.traverse((o) => {
        // Lights stay as they are: the light count is part of every shader, so unhiding one
        // would compile versions the real scroll never uses.
        if (!o.visible && !(o as THREE.Light).isLight) {
          hidden.push(o);
          o.visible = true;
        }
        if (o.frustumCulled) {
          culled.push(o);
          o.frustumCulled = false;
        }
        const mats = (o as THREE.Mesh).material;
        for (const m of Array.isArray(mats) ? mats : mats ? [mats] : []) {
          for (const v of Object.values(m)) if (v instanceof THREE.Texture && !(v instanceof THREE.VideoTexture)) gl.initTexture(v);
        }
      });
      // Shaders differ by where they draw: straight to the screen (tone mapped) or off-screen into
      // the bloom pass's buffer (linear). And per environment map: the arena's map differs in size
      // from the outdoor one. Draw every combination once; the canvas is still behind the loader.
      const target = new THREE.WebGLRenderTarget(64, 64, { type: THREE.HalfFloatType });
      const env = scene.environment;
      for (const map of ENV_MAPS.size ? ENV_MAPS : [env]) {
        scene.environment = map;
        for (const rt of bloom ? [null, target] : [null]) {
          gl.setRenderTarget(rt);
          gl.render(scene, camera);
        }
      }
      scene.environment = env;
      gl.setRenderTarget(null);
      target.dispose();
      hidden.forEach((o) => (o.visible = false));
      culled.forEach((o) => (o.frustumCulled = true));
      requestAnimationFrame(() => !cancelled && ready.current());
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [gl, scene, camera, bloom]);
  return null;
}

/**
 * Frame-rate watcher: after the page settles, if frames average under ~42 fps for a few seconds
 * while the story is on screen, step down one quality tier (remembered for the next visit).
 */
function FpsGuard({ quality, onDowngrade }: { quality: Quality; onDowngrade: (q: Quality) => void }) {
  const acc = useRef({ t: 0, frames: 0, settle: 4, done: false });
  useEffect(() => {
    acc.current = { t: 0, frames: 0, settle: 4, done: false };
  }, [quality]);
  useFrame((_, dt) => {
    const a = acc.current;
    if (a.done || quality === "low" || document.hidden) return;
    if (dt > 0.5) return; // tab switch or breakpoint, not a real frame
    if (a.settle > 0) {
      a.settle -= dt;
      return;
    }
    a.t += dt;
    a.frames++;
    if (a.t < 3) return;
    const fps = a.frames / a.t;
    a.t = 0;
    a.frames = 0;
    if (fps < 42) {
      a.done = true;
      onDowngrade(downgrade(quality));
    }
  });
  return null;
}

export default function Experience({ onReady, onFail }: { onReady: () => void; onFail: () => void }) {
  const [visible, setVisible] = useState(scrollState.visible);
  const [mobile, setMobile] = useState(false);
  // client-only component (loaded with ssr: false), so the device can be read on first render;
  // the canvas fixes antialiasing when it is created, so the tier must be right from the start
  const [quality, setQuality] = useState<Quality>(initialQuality);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px), (pointer: coarse)");
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    const onVis = () => setVisible(scrollState.visible);
    scrollState.listeners.add(onVis);
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      scrollState.pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      scrollState.pointerY = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      mq.removeEventListener("change", update);
      scrollState.listeners.delete(onVis);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <GLBoundary onError={onFail}>
      <Canvas
        dpr={TIER[quality].dpr}
        shadows={TIER[quality].shadows ? "soft" : false}
        frameloop={visible ? "always" : "never"}
        gl={{ antialias: quality === "high", powerPreference: "high-performance", alpha: false }}
        // far plane just past the fog: anything beyond is invisible anyway, so skip drawing it
        camera={{ fov: 50, near: 0.1, far: 96, position: [0, 2.3, 22] }}
        onCreated={({ gl, scene }) => {
          // ?perf exposes the renderer for performance checks (draw calls, shader programs, textures)
          if (new URLSearchParams(window.location.search).has("perf")) Object.assign(window, { __pb: { gl, scene } });
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
          const canvas = gl.domElement;
          canvas.addEventListener("webglcontextlost", (e) => {
            // Unmounting (e.g. the user turns 3D off) deliberately releases the
            // context; only a loss on a live, attached canvas is a real failure.
            if (!alive.current || !canvas.isConnected) return;
            e.preventDefault();
            onFail();
          });
        }}
        aria-hidden="true"
      >
        {/* World suspends until HDRIs, textures and models load; the HTML stays usable meanwhile */}
        <Suspense fallback={null}>
          <World mobile={mobile} quality={quality} />
          <WarmUp onReady={onReady} bloom={TIER[quality].bloom} />
          <FpsGuard quality={quality} onDowngrade={setQuality} />
        </Suspense>
      </Canvas>
    </GLBoundary>
  );
}
