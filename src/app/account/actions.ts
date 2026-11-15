"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { SPORTS } from "@/content/sports";
import { str } from "@/lib/server/form";
import { requireUser } from "@/lib/server/session";
import { setLevel, skillFor } from "@/lib/server/skills";

/** A player declares their own level for a sport. Once they have a scored game, results (or venue staff) decide it. */
export async function setMyLevel(formData: FormData) {
  const user = await requireUser("/account");
  const sport = str(formData, "sport", 30);
  const level = str(formData, "level", 15);
  const back = (m: string, ok = false) => redirect(`/account?${ok ? "ok" : "error"}=${encodeURIComponent(m)}`);
  if (!SPORTS.some((s) => s.id === sport) || !["beginner", "intermediate", "advanced"].includes(level)) back("Choose a sport and a level.");
  const cur = await skillFor(user.id, sport);
  if (cur && cur.games > 0) back("Your level for that sport now follows your game results. Ask the venue if it looks wrong.");
  await setLevel(user.id, sport, level as "beginner" | "intermediate" | "advanced");
  revalidatePath("/account");
  back("Level saved.", true);
}
