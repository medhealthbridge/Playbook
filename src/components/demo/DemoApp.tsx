"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useDemo } from "@/lib/demo/DemoProvider";
import { PlayerView } from "./PlayerView";
import { VenueView } from "./VenueView";

export function DemoApp() {
  const params = useSearchParams();
  const router = useRouter();
  const role = params.get("role") === "venue" ? "venue" : "player";
  const { state, reset } = useDemo();

  const setRole = (r: "player" | "venue") => router.replace(`/demo?role=${r}`, { scroll: false });

  return (
    <div className="app-shell">
      <div className="app-top">
        <div className="container">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 16, flexWrap: "wrap" }}>
            <div>
              <p className="eyebrow" style={{ color: "var(--lime)" }}>Interactive demo</p>
              <h1>{role === "player" ? "My Playbook" : "Venue admin"}</h1>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span className="badge on-dark badge-demo">Demo role switch — not real sign-in</span>
              <button
                type="button"
                className="btn btn-xs btn-ghost"
                onClick={() => {
                  if (confirm("Reset all demo bookings, plans and recordings?")) reset();
                }}
              >
                Reset demo data
              </button>
            </div>
          </div>
          <div className="role-switch" role="tablist" aria-label="Demo role">
            <button role="tab" aria-selected={role === "player"} id="role-player" aria-controls="role-panel" onClick={() => setRole("player")}>
              Player
            </button>
            <button role="tab" aria-selected={role === "venue"} id="role-venue" aria-controls="role-panel" onClick={() => setRole("venue")}>
              Venue staff
            </button>
          </div>
        </div>
      </div>
      <div className="app-body" id="role-panel" role="tabpanel" aria-labelledby={`role-${role}`}>
        <div className="container">
          {!state ? (
            <div className="alert alert-info" role="status"><span className="spinner" /> Loading demo data…</div>
          ) : role === "player" ? (
            <PlayerView />
          ) : (
            <VenueView />
          )}
        </div>
      </div>
    </div>
  );
}
