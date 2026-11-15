import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms — Playbook" };

export default function TermsPage() {
  return (
    <main id="main" className="app-shell">
      <div className="app-body">
        <div className="container prose" style={{ maxWidth: 760 }}>
          <p className="badge badge-warn">Draft — to be finalised with legal counsel before launch</p>
          <h1>Terms of Service</h1>
          <h2 id="players">For players</h2>
          <p>Playbook lets you find and book courts, tables and pitches at independent venues. Your booking is a contract with the venue. Payments go directly to the venue through its own payment account; Playbook does not hold your money. Each venue sets its own prices, deposit and cancellation policy, shown before you pay.</p>
          <p>Recordings and highlights are available only at venues that record, only to authorised participants of the booking, and only on eligible plans.</p>
          <h2 id="venues">Venue Agreement</h2>
          <p>Listing on Playbook is free. Playbook earns a cut on each open-play player checked in and each court booking confirmed, at the rates shown in the venue dashboard, whether the player pays by cash or online. The cut is billed on a weekly statement. If a statement is unpaid after its due date, Playbook may pause new bookings and check-ins until it is paid. Every player who plays must be recorded in Playbook. Venues are responsible for their facilities, pricing, refunds under their stated policy, official receipts, and compliance with local permits and laws. Playbook may suspend venues that breach these terms or receive repeated valid complaints.</p>
          <h2>Accounts</h2>
          <p>Keep your login details private. We may suspend accounts used for fraud, abuse or repeated no-shows.</p>
          <h2>Open play and player levels</h2>
          <p>When you join open play, your first name and last initial are shown on the venue&apos;s queue screen. Game scores entered by the venue update your win and loss record and your level for that sport. Venues can see the level and record of players who book or play with them.</p>
          <h2>Contact</h2>
          <p>Questions about these terms: contact Playbook support.</p>
        </div>
      </div>
    </main>
  );
}
