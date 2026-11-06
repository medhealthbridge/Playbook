"use client";
// Motion preference: honours prefers-reduced-motion by default and offers a
// visible manual toggle. Also tracks whether WebGL is usable.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface MotionCtx {
  reduced: boolean;
  setReduced: (v: boolean) => void;
  webgl: boolean | null; // null = not yet detected
  setWebglFailed: () => void;
}

const Ctx = createContext<MotionCtx>({ reduced: false, setReduced: () => {}, webgl: null, setWebglFailed: () => {} });
const KEY = "playbook-reduce-motion";

function detectWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function MotionProvider({ children }: { children: ReactNode }) {
  const [reduced, setReducedState] = useState(false);
  const [webgl, setWebgl] = useState<boolean | null>(null);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(KEY);
    } catch {
      /* ignore */
    }
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedState(stored != null ? stored === "1" : mq.matches);
    setWebgl(detectWebGL());
  }, []);

  useEffect(() => {
    document.documentElement.dataset.motion = reduced ? "reduced" : "full";
  }, [reduced]);

  const value = useMemo(
    () => ({
      reduced,
      setReduced: (v: boolean) => {
        setReducedState(v);
        try {
          localStorage.setItem(KEY, v ? "1" : "0");
        } catch {
          /* ignore */
        }
      },
      webgl,
      setWebglFailed: () => setWebgl(false),
    }),
    [reduced, webgl],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useMotion = () => useContext(Ctx);
