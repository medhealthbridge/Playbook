"use client";
// First-visit loading screen for the 3D experience: shows real download
// progress, keeps the page still until the arena is ready so scrolling is
// smooth from the first swipe, and offers "Skip" so nobody is blocked.
import { useEffect, useRef, useState } from "react";
import { trackLoading } from "../three/loadProgress";
import { Wordmark } from "../art/Wordmark";

const SKIP_AFTER_MS = 4000;
const GIVE_UP_MS = 25000;

export function LoadingScreen({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const [assets, setAssets] = useState(0);
  const [ramp, setRamp] = useState(0);
  const [canSkip, setCanSkip] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    setLeaving(true);
    window.setTimeout(onDone, 650);
  };

  useEffect(() => trackLoading(setAssets), []);

  // Gentle ramp while the renderer boots (before any download is registered).
  useEffect(() => {
    const id = window.setInterval(() => setRamp((r) => Math.min(0.12, r + 0.01)), 120);
    const skip = window.setTimeout(() => setCanSkip(true), SKIP_AFTER_MS);
    const giveUp = window.setTimeout(finish, GIVE_UP_MS);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(skip);
      window.clearTimeout(giveUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ready) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Keep the page still while loading.
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    window.scrollTo(0, 0);
    return () => {
      html.style.overflow = prev;
    };
  }, []);

  const p = ready ? 1 : Math.max(ramp, 0.12 + assets * 0.83);
  const pct = Math.round(p * 100);

  return (
    <div className={`loading-screen ${leaving ? "is-leaving" : ""}`} role="status" aria-live="polite" aria-label={`Loading the arena, ${pct}%`}>
      <div className="loading-inner">
        <Wordmark height={34} />
        <p className="loading-tag">Book. Play. Replay.</p>
        <div className="loading-bar" aria-hidden="true">
          <i style={{ transform: `scaleX(${p})` }} />
        </div>
        <div className="loading-meta">
          <span>{p >= 1 ? "Ready" : "Setting up the arena"}</span>
          <span className="num">{pct}%</span>
        </div>
        <button type="button" className={`loading-skip ${canSkip && !leaving ? "show" : ""}`} onClick={finish} tabIndex={canSkip ? 0 : -1}>
          Skip and browse
        </button>
      </div>
    </div>
  );
}
