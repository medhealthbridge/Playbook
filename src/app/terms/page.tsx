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
          <p>Venues list on Playbook under a monthly subscription after a free trial, plus a per-booking platform fee on confirmed bookings, billed monthly. Venues are responsible for their facilities, pricing, refunds under their stated policy, official receipts, and compliance with local permits and laws. Playbook may suspend venues that breach these terms or receive repeated valid complaints.</p>
          <h2>Accounts</h2>
          <p>Keep your login details private. We may suspend accounts used for fraud, abuse or repeated no-shows.</p>
          <h2>Contact</h2>
          <p>Questions about these terms: contact Playbook support.</p>
        </div>
      </div>
    </main>
  );
}
