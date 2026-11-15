import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy — Playbook" };

export default function PrivacyPage() {
  return (
    <main id="main" className="app-shell">
      <div className="app-body">
        <div className="container prose" style={{ maxWidth: 760 }}>
          <p className="badge badge-warn">Draft — to be finalised with legal counsel before launch</p>
          <h1>Privacy Policy</h1>
          <p>Playbook processes personal data in line with the Philippine Data Privacy Act of 2012 (RA 10173).</p>
          <h2>What we collect</h2>
          <p>Account details (name, email, password stored as a secure hash), bookings, open-play sign-ups, game results and your level per sport, payments you make to venues (amount and method, never card or wallet details), venue business details, the date you agreed to these terms, and technical data needed to keep the service secure.</p>
          <h2>How we use it</h2>
          <p>To run bookings, let venues manage their schedule, send service emails, prevent fraud, and meet legal obligations. Venues receive the booking details they need to serve you, and can see the level and win and loss record of players who book or play with them. On a venue&apos;s open-play queue screen, players appear by first name and last initial only.</p>
          <h2>Recordings</h2>
          <p>Game recordings exist only at venues that record and are shared only with authorised participants of the booking.</p>
          <h2>Your rights</h2>
          <p>You can request access to, correction of, or deletion of your data, and object to processing, by contacting Playbook support.</p>
        </div>
      </div>
    </main>
  );
}
