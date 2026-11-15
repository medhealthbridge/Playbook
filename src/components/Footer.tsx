"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { COPY } from "@/content/copy";
import { useBooking } from "@/lib/ui/BookingLauncher";
import { Wordmark } from "./art/Wordmark";

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="cols">
          <div>
            <Wordmark height={28} />
            <p style={{ marginTop: 12, maxWidth: "34ch" }}>{COPY.brandLine} Courts, tables and pitches across Metro Manila.</p>
            <p style={{ marginTop: 12 }} className="badge badge-demo on-dark">
              Demo build
            </p>
          </div>
          <div>
            <h4>Players</h4>
            <ul>
              <li><Link href="/#sports">Sports</Link></li>
              <li><Link href="/#highlights">Highlights</Link></li>
              <li><Link href="/#plans">Plans</Link></li>
              <li><Link href="/demo?role=player">My bookings (demo)</Link></li>
            </ul>
          </div>
          <div>
            <h4>Venues</h4>
            <ul>
              <li><Link href="/#venues">Venue tools</Link></li>
              <li><Link href="/demo?role=venue">Venue admin (demo)</Link></li>
            </ul>
          </div>
          <div>
            <h4>Help</h4>
            <ul>
              <li><Link href="/#faq">FAQ</Link></li>
              <li><Link href="/#faq">Cancellations</Link></li>
              <li><Link href="/#faq">Recordings &amp; privacy</Link></li>
            </ul>
          </div>
        </div>
        <div className="legal">
          <span>© {new Date().getFullYear()} Playbook. All times in Asia/Manila. Prices in PHP.</span>
          <span>{COPY.demoNote}</span>
        </div>
      </div>
    </footer>
  );
}

export function MobileBar() {
  const { open } = useBooking();
  const path = usePathname();
  // Marketing pages only; the real app pages have their own booking actions.
  if (path !== "/") return null;
  return (
    <div className="mobile-bar">
      <div className="txt">
        <b>Ready to play?</b>
        Courts, tables &amp; pitches
      </div>
      <button type="button" className="btn btn-sm" onClick={() => open()}>
        Book a slot
      </button>
    </div>
  );
}
