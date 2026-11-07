import "server-only";
import { Resend } from "resend";

const FROM = process.env.EMAIL_FROM || "Playbook <onboarding@resend.dev>";

export const emailConfigured = () => !!process.env.RESEND_API_KEY;

/** Send a transactional email. Without RESEND_API_KEY it logs instead (development). */
export async function sendEmail({ to, subject, html, text }: { to: string; subject: string; html: string; text: string }) {
  if (!process.env.RESEND_API_KEY) {
    console.info(`[email:dev] to=${to} subject="${subject}"\n${text}`);
    return;
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({ from: FROM, to, subject, html, text });
  if (error) throw new Error(`Email failed: ${error.message}`);
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function actionEmail(heading: string, body: string, cta: string, url: string) {
  const html = `<!doctype html><html><body style="margin:0;background:#f5f7f0;font-family:Arial,sans-serif;color:#101713">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="100%" style="max-width:520px;background:#ffffff;border-radius:14px;padding:28px" cellpadding="0" cellspacing="0">
<tr><td style="font-weight:800;font-size:22px;letter-spacing:.04em">PLAYBOOK</td></tr>
<tr><td style="padding-top:18px;font-size:20px;font-weight:700">${esc(heading)}</td></tr>
<tr><td style="padding-top:10px;font-size:15px;line-height:1.5;color:#3b463f">${esc(body)}</td></tr>
<tr><td style="padding-top:22px"><a href="${esc(url)}" style="display:inline-block;background:#D7FF3F;color:#101713;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">${esc(cta)}</a></td></tr>
<tr><td style="padding-top:22px;font-size:12px;color:#6b766f">If the button doesn't work, open this link:<br>${esc(url)}</td></tr>
</table></td></tr></table></body></html>`;
  return { html, text: `${heading}\n\n${body}\n\n${cta}: ${url}` };
}
