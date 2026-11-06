"use client";
// The single WebGL canvas. Loaded lazily (never blocks the HTML booking UI),
// paused when off-screen, and falls back silently if WebGL fails.
import { Canvas } from "@react-three/fiber";
import { Component, useEffect, useState, type ReactNode } from "react";
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

export default function Experience({ onReady, onFail }: { onReady: () => void; onFail: () => void }) {
  const [visible, setVisible] = useState(scrollState.visible);
  const [mobile, setMobile] = useState(false);

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
        dpr={mobile ? [1, 1.25] : [1, 1.75]}
        frameloop={visible ? "always" : "never"}
        gl={{ antialias: !mobile, powerPreference: "high-performance", alpha: false }}
        camera={{ fov: 50, near: 0.1, far: 240, position: [0, 2.3, 22] }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
          gl.domElement.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            onFail();
          });
          requestAnimationFrame(onReady);
        }}
        aria-hidden="true"
      >
        <World mobile={mobile} />
      </Canvas>
    </GLBoundary>
  );
}
