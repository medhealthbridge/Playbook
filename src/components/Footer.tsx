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
          </div>
          <div>
            <h4>Players</h4>
            <ul>
              <li><Link href="/#sports">Sports</Link></li>
              <li><Link href="/#highlights">Highlights</Link></li>
              <li><Link href="/#plans">Pricing</Link></li>
              <li><Link href="/account">My bookings</Link></li>
            </ul>
          </div>
          <div>
            <h4>Venues</h4>
            <ul>
              <li><Link href="/#venues">Venue tools</Link></li>
              <li><Link href="/venue/new">List your venue</Link></li>
              <li><Link href="/venue">Venue dashboard</Link></li>
            </ul>
          </div>
          <div>
            <h4>Help</h4>
            <ul>
              <li><Link href="/#faq">FAQ</Link></li>
              <li><Link href="/#faq">Cancellations</Link></li>
              <li><Link href="/terms">Terms</Link></li>
              <li><Link href="/privacy">Privacy</Link></li>
            </ul>
          </div>
        </div>
        <div className="legal">
          <span>© {new Date().getFullYear()} Playbook. All times in Asia/Manila. Prices in PHP.</span>
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
