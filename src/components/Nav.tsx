"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { COPY } from "@/content/copy";
import { useSession } from "@/lib/auth/client";
import { useBooking } from "@/lib/ui/BookingLauncher";
import { useMotion } from "@/lib/ui/MotionProvider";
import { Wordmark } from "./art/Wordmark";
import { ThemeToggle } from "./ThemeToggle";

export function Nav() {
  const [solid, setSolid] = useState(false);
  const { open } = useBooking();
  const { reduced, setReduced } = useMotion();
  const { data: session } = useSession();
  const path = usePathname();
  const onHome = path === "/";

  const hidden = path.startsWith("/board/");
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 40 || !onHome);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [onHome]);

  if (hidden) return null; // full-screen TV board
  return (
    <header className={`nav ${solid ? "is-solid" : ""}`}>
      <div className="nav-inner">
        <Link href="/" className="wordmark" aria-label="Playbook home">
          <Wordmark />
        </Link>
        <nav aria-label="Primary">
          <ul className="nav-links">
            {COPY.nav.map((l) => (
              <li key={l.href}>
                <a href={onHome ? l.href : `/${l.href}`}>{l.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="nav-actions">
          <ThemeToggle />
          <button
            type="button"
            className="motion-toggle"
            aria-pressed={reduced}
            onClick={() => setReduced(!reduced)}
            title="Reduce motion"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path d="M5.5 8h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <span className="label">Reduce motion</span>
            <span className="sr-only">{reduced ? "(on)" : "(off)"}</span>
          </button>
          {session ? (
            <Link href="/account" className="nav-signin">
              Account
            </Link>
          ) : (
            <Link href="/login" className="nav-signin">
              Sign in
            </Link>
          )}
          <button type="button" className="btn btn-sm nav-book" onClick={() => open()}>
            Book a slot
          </button>
        </div>
      </div>
    </header>
  );
}
