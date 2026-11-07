// Tracks asset downloads for the 3D world (HDRIs, textures, models) through
// three.js's default loading manager, for the first-visit loading screen.
import * as THREE from "three";

type Listener = (p: number) => void;
const listeners = new Set<Listener>();
let loaded = 0;
let total = 0;
let installed = false;

function emit() {
  const p = total > 0 ? loaded / total : 0;
  listeners.forEach((l) => l(p));
}

export function trackLoading(cb: Listener) {
  if (!installed) {
    installed = true;
    const m = THREE.DefaultLoadingManager;
    m.onStart = (_url, l, t) => {
      loaded = l;
      total = t;
      emit();
    };
    m.onProgress = (_url, l, t) => {
      loaded = l;
      total = t;
      emit();
    };
  }
  listeners.add(cb);
  cb(total > 0 ? loaded / total : 0);
  return () => {
    listeners.delete(cb);
  };
}
