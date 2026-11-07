import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { q, q1 } from "./db";

export type VenueRole = "owner" | "manager" | "staff";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** Signed-in user or redirect to sign-in (returning to `next`). */
export async function requireUser(next = "/account") {
  const s = await getSession();
  if (!s) redirect(`/login?next=${encodeURIComponent(next)}`);
  return s.user;
}

export const isPlatformAdmin = (user: { role?: string | null }) => (user.role ?? "").split(",").includes("admin");

export async function requireAdmin() {
  const user = await requireUser("/admin");
  if (!isPlatformAdmin(user)) redirect("/account?denied=admin");
  return user;
}

export async function venueRole(userId: string, venueId: string): Promise<VenueRole | null> {
  const r = await q1<{ role: VenueRole }>("SELECT role FROM venue_member WHERE venue_id = $1 AND user_id = $2", [venueId, userId]);
  return r?.role ?? null;
}

const RANK: Record<VenueRole, number> = { staff: 1, manager: 2, owner: 3 };

/** The user's role at the venue, if at least `min`; platform admins pass as owner. */
export async function requireVenueRole(venueId: string, min: VenueRole = "staff") {
  const user = await requireUser(`/venue/${venueId}`);
  if (isPlatformAdmin(user)) return { user, role: "owner" as VenueRole };
  const role = await venueRole(user.id, venueId);
  if (!role || RANK[role] < RANK[min]) redirect("/venue?denied=1");
  return { user, role };
}

export async function myVenues(userId: string) {
  return q<{ id: string; name: string; area: string; status: string; plan: string; role: VenueRole }>(
    `SELECT v.id, v.name, v.area, v.status, v.plan, m.role
       FROM venue_member m JOIN venue v ON v.id = m.venue_id
      WHERE m.user_id = $1 ORDER BY v.created_at`,
    [userId],
  );
}
