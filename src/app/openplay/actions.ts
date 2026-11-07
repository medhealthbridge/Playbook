"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { q1 } from "@/lib/server/db";
import { int, pesoToCents, str } from "@/lib/server/form";
import {
  OpenPlayError, addWalkIn, checkInPlayer, createSession, endGame, fillCourts, joinSession, sessionByCode, sessionById, setPlayerStatus, setSessionStatus,
} from "@/lib/server/openplay";
import { getSession, requireVenueRole } from "@/lib/server/session";
import type { Skill } from "@/lib/openplay/queue";
import { decrypt } from "@/lib/server/crypto";
import { createCheckout } from "@/lib/server/paymongo";

const SKILLS: Skill[] = ["beginner", "intermediate", "advanced"];
const to = (path: string, m: { ok?: string; error?: string }) =>
  redirect(`${path}${path.includes("?") ? "&" : "?"}${m.ok ? `ok=${encodeURIComponent(m.ok)}` : `error=${encodeURIComponent(m.error!)}`}`);
const hm = (s: string) => {
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};

async function staff(formData: FormData) {
  const venueId = str(formData, "venue_id", 60);
  const sessionId = str(formData, "session_id", 60);
  const { user } = await requireVenueRole(venueId, "staff");
  const s = await sessionById(sessionId);
  if (!s || s.venue_id !== venueId) redirect(`/venue/${venueId}?tab=openplay`);
  return { user, venueId, s: s!, path: `/venue/${venueId}/openplay/${sessionId}` };
}
async function guard(path: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    if (e instanceof OpenPlayError) to(path, { error: e.message });
    const code = (e as { code?: string }).code;
    if (code === "23505") to(path, { error: "That court just got a game. Refreshing." });
    throw e;
  }
}

export async function createOpenPlay(formData: FormData) {
  const venueId = str(formData, "venue_id", 60);
  const { user } = await requireVenueRole(venueId, "manager");
  const path = `/venue/${venueId}?tab=openplay`;
  const title = str(formData, "title", 80) || "Open play";
  const date = str(formData, "date", 10);
  const startMin = hm(str(formData, "start", 5));
  const endMin = hm(str(formData, "end", 5));
  const courtIds = formData.getAll("courts").map(String).slice(0, 20);
  const fee = pesoToCents(formData, "fee");
  const maxPlayers = int(formData, "max_players", 24);
  const mode = str(formData, "mode", 20) === "winners_stay" ? "winners_stay" : "all_off";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !(startMin < endMin)) to(path, { error: "Check the date and times." });
  if (courtIds.length === 0) to(path, { error: "Choose at least one court." });
  if (!Number.isFinite(fee) || maxPlayers < 4 || maxPlayers > 200) to(path, { error: "Check the fee and player limit." });
  const owned = await q1<{ n: number }>("SELECT count(*)::int AS n FROM resource WHERE venue_id=$1 AND id = ANY($2)", [venueId, courtIds]);
  if (owned!.n !== courtIds.length) to(path, { error: "Choose courts from this venue." });
  let id = "";
  await guard(path, async () => {
    id = await createSession(venueId, user.id, { title, date, startMin, endMin, courtIds, feeCents: fee, maxPlayers, mode, skillMatch: str(formData, "skill_match") === "1" });
  });
  redirect(`/venue/${venueId}/openplay/${id}?ok=${encodeURIComponent("Session created. Those courts are blocked from regular bookings for this time.")}`);
}

export async function sessionStatus(formData: FormData) {
  const { user, s, path } = await staff(formData);
  const status = str(formData, "status", 10) as "live" | "ended" | "cancelled";
  if (!["live", "ended", "cancelled"].includes(status)) to(path, { error: "Unknown action." });
  await setSessionStatus(s.id, status, user.id);
  revalidatePath(path);
  to(path, { ok: status === "live" ? "Session is live. Fill the courts when players are checked in." : status === "ended" ? "Session ended." : "Session cancelled and courts released." });
}

export async function fill(formData: FormData) {
  const { s, path } = await staff(formData);
  let n = 0;
  await guard(path, async () => {
    n = await fillCourts(s.id);
  });
  revalidatePath(path);
  to(path, n ? { ok: `${n} game${n > 1 ? "s" : ""} started.` } : { error: "No free court with four players waiting." });
}

export async function gameOver(formData: FormData) {
  const { user, s, path } = await staff(formData);
  const w = str(formData, "winner", 1);
  await guard(path, () => endGame(s.id, str(formData, "game_id", 60), w === "a" || w === "b" ? w : null, user.id));
  revalidatePath(path);
  to(path, { ok: "Result saved. Next players are up." });
}

export async function staffCheckIn(formData: FormData) {
  const { s, path } = await staff(formData);
  const paid = pesoToCents(formData, "paid");
  await checkInPlayer(s.id, str(formData, "player_id", 60), Number.isFinite(paid) ? paid : 0);
  revalidatePath(path);
  to(path, { ok: "Checked in and added to the queue." });
}

export async function staffWalkIn(formData: FormData) {
  const { s, path } = await staff(formData);
  const name = str(formData, "name", 60);
  const skill = str(formData, "skill", 15) as Skill;
  const paid = pesoToCents(formData, "paid");
  if (name.length < 2 || !SKILLS.includes(skill)) to(path, { error: "Enter a name and skill level." });
  await addWalkIn(s.id, name, skill, Number.isFinite(paid) ? paid : 0);
  revalidatePath(path);
  to(path, { ok: `${name} added to the queue.` });
}

export async function staffPlayerStatus(formData: FormData) {
  const { s, path } = await staff(formData);
  const st = str(formData, "status", 10) as "waiting" | "resting" | "left";
  if (!["waiting", "resting", "left"].includes(st)) to(path, { error: "Unknown action." });
  await setPlayerStatus(s.id, str(formData, "player_id", 60), st);
  revalidatePath(path);
  redirect(path);
}

// ---------------------------------------------------------------- players
export async function joinOpenPlay(formData: FormData) {
  const code = str(formData, "code", 10).toUpperCase();
  const path = `/play/${code}`;
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(path)}`);
  const s = await sessionByCode(code);
  if (!s) redirect("/venues");
  const skill = str(formData, "skill", 15) as Skill;
  if (!SKILLS.includes(skill)) to(path, { error: "Choose your level." });
  await guard(path, () => joinSession(s!, session!.user, skill));
  to(path, { ok: "You're in! Show this screen at the front desk to check in." });
}

export async function playerSelfStatus(formData: FormData) {
  const code = str(formData, "code", 10).toUpperCase();
  const path = `/play/${code}`;
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(path)}`);
  const s = await sessionByCode(code);
  const me = s && (await q1<{ id: string }>("SELECT id FROM open_play_player WHERE session_id=$1 AND user_id=$2", [s.id, session!.user.id]));
  if (!s || !me) redirect(path);
  const st = str(formData, "status", 10) as "waiting" | "resting" | "left";
  if (!["waiting", "resting", "left"].includes(st)) redirect(path);
  await setPlayerStatus(s!.id, me!.id, st);
  revalidatePath(path);
  redirect(path);
}

export async function payOpenPlayFee(formData: FormData) {
  const code = str(formData, "code", 10).toUpperCase();
  const path = `/play/${code}`;
  const auth = await getSession();
  if (!auth) redirect(`/login?next=${encodeURIComponent(path)}`);
  const s = await sessionByCode(code);
  if (!s) redirect("/venues");
  const me = await q1<{ id: string; name: string; paid_online: boolean; email: string }>(
    `SELECT p.id, p.name, p.paid_online, u.email FROM open_play_player p JOIN "user" u ON u.id=p.user_id WHERE p.session_id=$1 AND p.user_id=$2 AND p.status <> 'left'`,
    [s!.id, auth!.user.id],
  );
  if (!me) to(path, { error: "Join the session first." });
  if (me!.paid_online || s!.fee_cents <= 0) to(path, { error: "Nothing to pay." });
  const v = await q1<{ name: string; secret: string | null }>("SELECT name, paymongo_secret_enc AS secret FROM venue WHERE id=$1", [s!.venue_id]);
  if (!v?.secret) to(path, { error: "This venue takes payment at the front desk." });
  const base = process.env.BETTER_AUTH_URL || "https://playbook.databridgesol.space";
  let url = "";
  try {
    const c = await createCheckout(decrypt(v!.secret!), {
      amountCents: s!.fee_cents, name: `Open play · ${s!.title}`, description: `${v!.name} · ${s!.date}`, reference: `OP-${s!.code}`,
      successUrl: `${base}${path}?paid=1`, cancelUrl: `${base}${path}`, customer: { name: me!.name, email: me!.email },
      metadata: { open_play_player_id: me!.id, venue_id: s!.venue_id },
    });
    await q1("UPDATE open_play_player SET checkout_session_id=$2 WHERE id=$1", [me!.id, c.id]);
    url = c.url;
  } catch (e) {
    console.error("open play checkout failed", e);
    to(path, { error: "Couldn't start the payment. Please try again." });
  }
  redirect(url);
}
