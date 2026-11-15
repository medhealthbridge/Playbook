"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Item = { key: string; name: string; amount: number; kind: string; at: string };
const KEY = "pb-pay-sound";
const peso = (c: number) => `₱${(c / 100).toLocaleString("en-PH")}`;

/** Watches for online payments reaching this venue and announces each one with a beep and a banner. */
export function PaymentBell({ venueId }: { venueId: string }) {
  const router = useRouter();
  const [sound, setSound] = useState(false);
  const [recent, setRecent] = useState<Item[]>([]);
  const ctx = useRef<AudioContext | null>(null);
  const since = useRef<number>(0);
  const seen = useRef<Set<string>>(new Set());

  const beep = useCallback(() => {
    const ac = ctx.current;
    if (!ac) return;
    void ac.resume();
    // Two rising tones: easy to tell apart from other sounds at a front desk.
    [[880, 0], [1320, 0.18]].forEach(([freq, delay]) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, ac.currentTime + delay);
      g.gain.exponentialRampToValueAtTime(0.4, ac.currentTime + delay + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + delay + 0.22);
      o.connect(g).connect(ac.destination);
      o.start(ac.currentTime + delay);
      o.stop(ac.currentTime + delay + 0.25);
    });
  }, []);

  const enable = useCallback((test: boolean) => {
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx.current ??= new AC();
      setSound(true);
      try { localStorage.setItem(KEY, "1"); } catch {}
      if (test) beep();
    } catch {}
  }, [beep]);

  useEffect(() => {
    // Browsers only allow sound after a tap. If it was switched on before, re-arm it on the first tap on this page.
    let wanted = false;
    try { wanted = localStorage.getItem(KEY) === "1"; } catch {}
    if (!wanted) return;
    const arm = () => enable(false);
    window.addEventListener("pointerdown", arm, { once: true });
    return () => window.removeEventListener("pointerdown", arm);
  }, [enable]);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      if (document.hidden) return;
      try {
        const r = await fetch(`/api/venue/${venueId}/payments?since=${since.current}`, { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as { now: number; items: Item[] };
        const fresh = j.items.filter((i) => !seen.current.has(i.key));
        // Overlap the window by a few seconds so nothing slips between polls; `seen` removes repeats.
        since.current = j.now - 8000;
        if (stop || fresh.length === 0) return;
        fresh.forEach((i) => seen.current.add(i.key));
        setRecent((old) => [...fresh.reverse(), ...old].slice(0, 5));
        beep();
        router.refresh();
      } catch {}
    };
    void tick();
    const t = setInterval(tick, 5000);
    return () => { stop = true; clearInterval(t); };
  }, [venueId, beep, router]);

  return (
    <div className="pay-bell" aria-live="assertive">
      {recent.map((i) => (
        <div key={i.key} className="alert alert-ok pay-bell-item"><strong>{peso(i.amount)} received online</strong> from {i.name} · {i.kind}</div>
      ))}
      <button type="button" className={`btn btn-xs ${sound ? "btn-outline" : ""}`} onClick={() => enable(true)}>
        {sound ? "Payment sound is on · test" : "Turn on payment sound"}
      </button>
    </div>
  );
}
