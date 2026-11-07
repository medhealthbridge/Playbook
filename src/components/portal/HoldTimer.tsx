"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function HoldTimer({ until }: { until: string }) {
  const router = useRouter();
  const end = new Date(until).getTime();
  const [left, setLeft] = useState(() => Math.max(0, end - Date.now()));
  useEffect(() => {
    const id = window.setInterval(() => {
      const l = Math.max(0, end - Date.now());
      setLeft(l);
      if (l === 0) {
        window.clearInterval(id);
        router.refresh();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [end, router]);
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return (
    <span className="badge badge-warn" role="timer" aria-live="off">
      Held for {m}:{String(s).padStart(2, "0")}
    </span>
  );
}
