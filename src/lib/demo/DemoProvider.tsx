"use client";
// React binding for the demo "database". Every view (booking flow, player
// area, venue admin) reads the same store, so records stay synchronised.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DemoError, expireHolds, seedState, type DemoState } from "./state.ts";

const KEY = "playbook-demo-v1";

interface DemoCtx {
  state: DemoState | null;
  now: number;
  /** Run a pure action with simulated network latency. Throws DemoError. */
  act: (fn: (s: DemoState, now: number) => DemoState, latencyMs?: number) => Promise<DemoState>;
  reset: () => void;
}

const Ctx = createContext<DemoCtx | null>(null);

function load(): DemoState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoState;
      if (parsed.v === 1) return parsed;
    }
  } catch {
    /* storage unavailable — fall through to a fresh seed */
  }
  return seedState(Date.now());
}

function save(s: DemoState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode etc. — demo still works in memory */
  }
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const ref = useRef<DemoState | null>(null);

  const commit = useCallback((s: DemoState) => {
    ref.current = s;
    setState(s);
    save(s);
  }, []);

  useEffect(() => {
    commit(expireHolds(load(), Date.now()));
    const tick = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (ref.current) {
        const next = expireHolds(ref.current, t);
        if (next !== ref.current) commit(next);
      }
    }, 15_000);
    // keep tabs in sync
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue) {
        try {
          const s = JSON.parse(e.newValue) as DemoState;
          ref.current = s;
          setState(s);
        } catch {
          /* ignore */
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      clearInterval(tick);
      window.removeEventListener("storage", onStorage);
    };
  }, [commit]);

  const act = useCallback<DemoCtx["act"]>(
    (fn, latencyMs = 450) =>
      new Promise((resolve, reject) => {
        setTimeout(() => {
          try {
            const base = ref.current ?? load();
            const t = Date.now();
            setNow(t);
            const next = fn(base, t);
            commit(next);
            resolve(next);
          } catch (e) {
            reject(e instanceof DemoError ? e : new DemoError("invalid", "Something went wrong. Please try again."));
          }
        }, latencyMs);
      }),
    [commit],
  );

  const reset = useCallback(() => commit(seedState(Date.now())), [commit]);

  const value = useMemo(() => ({ state, now, act, reset }), [state, now, act, reset]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDemo() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useDemo must be used inside <DemoProvider>");
  return c;
}
