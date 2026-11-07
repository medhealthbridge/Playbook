// QA helpers: users via API, DB access, signed-in contexts, form replay.
const path = require('path');
const ROOT = '/home/user/Playbook';
const { Pool, neonConfig } = require(path.join(ROOT, 'node_modules/@neondatabase/serverless'));
neonConfig.webSocketConstructor = WebSocket;
const env = Object.fromEntries(require('fs').readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n').filter(Boolean).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const pool = new Pool({ connectionString: env.DATABASE_URL });
const B = 'http://localhost:3100';
const PW = 'Qa-pass-12345';
const db = async (sql, params = []) => (await pool.query(sql, params)).rows;

async function login(browser, email, password = PW, vp = { width: 1280, height: 900 }) {
  const ctx = await browser.newContext({ viewport: vp, reducedMotion: 'reduce' });
  let r;
  for (let t = 0; t < 8; t++) {
    r = await ctx.request.post(`${B}/api/auth/sign-in/email`, { data: { email, password }, headers: { origin: B } });
    if (r.status() !== 429) break;
    await new Promise((z) => setTimeout(z, 3500));
  }
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log(`  [pageerror ${email}]`, e.message.slice(0, 200)));
  return { ctx, page, ok: r.ok(), status: r.status() };
}
async function signupApi(request, name, email, extra = {}) {
  const r = await request.post(`${B}/api/auth/sign-up/email`, { data: { name, email, password: PW, ...extra }, headers: { origin: B } });
  return { status: r.status(), body: await r.text() };
}
/** Collect a rendered server-action form's fields (incl. $ACTION_ID) */
async function captureForm(page, formLocator) {
  return formLocator.evaluate((f) => Array.from(new FormData(f).entries()).map(([k, v]) => [k, String(v)]));
}
/** Invoke a captured server action as the user signed in on `page`: a no-JS form post
 *  (field $ACTION_ID_<id> + fields) to `url`, which must be a route that uses the action.
 *  Waits for the server's answer. Returns { status, location }. */
async function replay(page, url, fields, overrides = {}) {
  const multipart = {};
  for (const [k, v] of fields) multipart[k] = k in overrides ? overrides[k] : v;
  for (const [k, v] of Object.entries(overrides)) multipart[k] = v;
  const r = await page.context().request.post(url, { multipart, headers: { origin: B }, maxRedirects: 0 });
  return { status: r.status(), location: r.headers()['location'] || r.headers()['x-action-redirect'] || '' };
}
const results = [];
function record(id, what, pass, evidence) {
  results.push({ id, what, pass, evidence: String(evidence).replace(/\s+/g, ' ').slice(0, 220) });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${what} :: ${String(evidence).replace(/\s+/g, ' ').slice(0, 160)}`);
}
async function check(id, what, fn) {
  try { const [pass, ev] = await fn(); record(id, what, pass, ev); }
  catch (e) { record(id, what, false, `ERROR ${e.message.split('\n')[0]}`); }
}
module.exports = { B, PW, db, pool, login, signupApi, captureForm, replay, record, check, results, env };
