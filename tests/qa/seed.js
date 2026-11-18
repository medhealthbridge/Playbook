const { chromium } = require('playwright');
const { B, db, login, signupApi, pool } = require('./lib');
const U = {
  admin: ['Ada Admin', 'admin-test@playbook.test'], ownerA: ['Olive A', 'ownera-qa@playbook.test'], managerA: ['Mark A', 'managera-qa@playbook.test'],
  staffA: ['Sam A', 'staffa-qa@playbook.test'], ownerB: ['Ben B', 'ownerb-qa@playbook.test'], player1: ['Paolo One', 'player1-qa@playbook.test'],
  player2: ['Pia Two', 'player2-qa@playbook.test'], banme: ['Bad Actor', 'banme-qa@playbook.test'],
};
const go = async (p, sel) => { await Promise.all([p.waitForNavigation({ timeout: 30000 }), p.click(sel)]); };
async function makeVenue(page, name, courts) {
  await page.goto(`${B}/venue/new`);
  await page.fill('#name', name); await page.selectOption('#area', 'Pasig'); await page.fill('#phone', '0917 123 4567');
  await page.fill('#address', `1 ${name} Street, Pasig City`); await page.fill('#business_name', `${name} Inc.`); await page.fill('#business_reg_no', 'DTI-7654321');
  for (let i = 0; i < courts; i++) { await page.fill(`input[name=court_name_${i}]`, `${name} Court ${i + 1}`); await page.selectOption(`select[name=court_sport_${i}]`, 'pickleball'); await page.fill(`input[name=court_rate_${i}]`, '500'); }
  await page.check('input[name=agree]'); await page.check('input[name=agree_privacy]'); await go(page, 'button:has-text("Submit for review")');
  return page.url().split('?')[0].split('/').pop();
}
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext();
  for (const [k, [n, e]] of Object.entries(U)) {
    let r;
    for (let t = 0; t < 6; t++) { r = await signupApi(ctx.request, n, e); if (r.status !== 429) break; await new Promise(res => setTimeout(res, 4000)); }
    if (r.status !== 200) console.log('signup', k, r.status, r.body.slice(0, 100));
  }
  // T-AUTH-ADMIN-01: with email confirmation off (no RESEND_API_KEY), signing up through the form with an
  // address listed in PLATFORM_ADMIN_EMAILS must NOT grant admin; anyone could claim the address.
  const adminRole = (await db('SELECT role FROM "user" WHERE email=$1', [U.admin[1]]))[0]?.role;
  if (!process.env.RESEND_API_KEY && adminRole !== 'user') { console.error(`FAIL T-AUTH-ADMIN-01: unconfirmed form sign-up got role ${adminRole}`); process.exit(1); }
  console.log(`PASS T-AUTH-ADMIN-01: unconfirmed form sign-up of a listed admin email got role "${adminRole}"`);
  // Promote the QA admin the way an operator would (direct, audited change on the dev database).
  await db(`UPDATE "user" SET role='admin' WHERE email=$1`, [U.admin[1]]);
  const A = await login(b, U.ownerA[1]); const venueA = await makeVenue(A.page, 'Alpha Pickle', 2);
  const BB = await login(b, U.ownerB[1]); const venueB = await makeVenue(BB.page, 'Bravo Pickle', 1);
  const ad = await login(b, U.admin[1]);
  for (const name of ['Alpha Pickle', 'Bravo Pickle']) { await ad.page.goto(`${B}/admin?tab=venues&status=pending`); await go(ad.page, `tr:has-text("${name}") >> button:has-text("Approve")`); }
  await A.page.goto(`${B}/venue/${venueA}?tab=staff`);
  // The UI only adds facilitators now; the manager tier still exists in the permission code, so keep one to test it.
  await db(`INSERT INTO venue_member (venue_id, user_id, role) SELECT $1, id, 'manager' FROM "user" WHERE email=$2`, [venueA, U.managerA[1]]);
  await A.page.fill('input[name=email]', U.staffA[1]); await go(A.page, 'form:has(input[name=email]) button[type=submit]');
  // player1 books Alpha tomorrow, first slot, pay at venue
  const p1 = await login(b, U.player1[1]);
  await p1.page.goto(`${B}/venues/alpha-pickle-pasig`); await go(p1.page, '.chip-row.scroll-x a >> nth=1'); await go(p1.page, '.slot-btn >> nth=0'); await go(p1.page, 'button:has-text("pay")');
  const bookingId = p1.page.url().split('?')[0].split('/').pop();
  // open play on Alpha court 2 tomorrow evening
  await A.page.goto(`${B}/venue/${venueA}?tab=openplay`);
  await A.page.uncheck('input[name=courts] >> nth=0');
  const tomorrow = (await db("SELECT to_char((now() AT TIME ZONE 'Asia/Manila')::date + 1,'YYYY-MM-DD') d"))[0].d;
  await A.page.fill('#op-date', tomorrow);
  await go(A.page, 'button:has-text("Create session")');
  const sessionId = A.page.url().split('?')[0].split('/').pop();
  const courtsA = await db('SELECT id, name FROM resource WHERE venue_id=$1 ORDER BY sort', [venueA]);
  const courtsB = await db('SELECT id, name FROM resource WHERE venue_id=$1 ORDER BY sort', [venueB]);
  const out = { U, venueA, venueB, bookingId, sessionId, courtsA, courtsB, tomorrow };
  require('fs').writeFileSync(require('path').join(__dirname, 'seed.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ venueA, venueB, bookingId, sessionId, courtsA: courtsA.length, courtsB: courtsB.length }));
  const roles = await db(`SELECT u.email, u.role, (SELECT string_agg(v.name||':'||m.role, ',') FROM venue_member m JOIN venue v ON v.id=m.venue_id WHERE m.user_id=u.id) AS venues FROM "user" u ORDER BY u.email`);
  console.table(roles);
  await b.close(); await pool.end();
})().catch(async e => { console.error('SEED FAIL', e.message.split('\n').slice(0, 4).join(' | ')); process.exit(1); });
