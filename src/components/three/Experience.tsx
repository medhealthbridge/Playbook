"use client";
// The single WebGL canvas. Loaded lazily (never blocks the HTML booking UI),
// paused when off-screen, and falls back silently if WebGL fails.
import { Canvas } from "@react-three/fiber";
import { Component, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { scrollState } from "./timeline";
import { World } from "./World";

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

function Ready({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(onReady));
    return () => cancelAnimationFrame(id);
  }, [onReady]);
  return null;
}

export default function Experience({ onReady, onFail }: { onReady: () => void; onFail: () => void }) {
  const [visible, setVisible] = useState(scrollState.visible);
  const [mobile, setMobile] = useState(false);
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
        dpr={mobile ? [1, 1.25] : [1, 1.5]}
        shadows={mobile ? false : "soft"}
        frameloop={visible ? "always" : "never"}
        gl={{ antialias: !mobile, powerPreference: "high-performance", alpha: false }}
        // far plane just past the fog: anything beyond is invisible anyway, so skip drawing it
        camera={{ fov: 50, near: 0.1, far: 96, position: [0, 2.3, 22] }}
        onCreated={({ gl }) => {
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
          <World mobile={mobile} />
          <Ready onReady={onReady} />
        </Suspense>
      </Canvas>
    </GLBoundary>
  );
}
