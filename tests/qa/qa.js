const { chromium } = require('playwright');
const { B, PW, db, pool, login, signupApi, captureForm, replay, check, results } = require('./lib');
const S = require('./seed.json');
const E = Object.fromEntries(Object.entries(S.U).map(([k, v]) => [k, v[1]]));
const A = S.venueA, VB = S.venueB;
const pathOf = (u) => { const x = new URL(u); return x.pathname + x.search; };
const go = async (p, sel) => { await Promise.all([p.waitForNavigation({ timeout: 30000 }), p.click(sel)]); };

(async () => {
  await db(`UPDATE venue SET status='active', plan='trial' WHERE id IN ($1,$2)`, [A, VB]);
  await db(`UPDATE open_play_session SET status='scheduled' WHERE id=$1`, [S.sessionId]);
  await db(`UPDATE booking SET status='confirmed', cancelled_at=NULL, cancel_reason=NULL WHERE id=$1`, [S.bookingId]);
  // reset only bookings in the two QA venues (never touch other data)
  await db(`DELETE FROM booking WHERE venue_id IN ($1,$2) AND id <> $3 AND created_by IN (SELECT id FROM "user" WHERE email LIKE '%@playbook.test')`, [A, VB, S.bookingId]);
  await db(`UPDATE venue_member SET role='staff' WHERE user_id=(SELECT id FROM "user" WHERE email=$1)`, [E.staffA]);
  const b = await chromium.launch();
  const anon = await b.newContext();
  const S1 = {};
  for (const k of ['admin', 'ownerA', 'managerA', 'staffA', 'ownerB', 'player1', 'player2']) S1[k] = await login(b, E[k]);

  // ---------------- AUTH ----------------
  await check('T-A1', 'Sign-in with correct password succeeds for every seeded role', async () => [Object.values(S1).every(s => s.ok), Object.entries(S1).map(([k, s]) => `${k}:${s.status}`).join(' ')]);
  await check('T-A2', 'Wrong password refused', async () => {
    let r; for (let t = 0; t < 8; t++) { r = await anon.request.post(`${B}/api/auth/sign-in/email`, { data: { email: E.player1, password: 'wrong-pass-1' }, headers: { origin: B } }); if (r.status() !== 429) break; await new Promise(z => setTimeout(z, 3500)); }
    return [r.status() === 401, `status ${r.status()}`];
  });
  await check('T-A3', 'Sign-up cannot set role=admin in the request body', async () => {
    const c = await b.newContext();
    let r; for (let t = 0; t < 6; t++) { r = await signupApi(c.request, 'Sneaky', 'sneaky-qa@playbook.test', { role: 'admin' }); if (r.status !== 429) break; await new Promise(z => setTimeout(z, 4000)); }
    const row = (await db(`SELECT role FROM "user" WHERE email='sneaky-qa@playbook.test'`))[0];
    return [!row || row.role !== 'admin', `signup ${r.status}; role=${row?.role ?? 'not created'}`];
  });
  await check('T-A4', 'Signed-in user cannot promote self via update-user', async () => {
    const r = await S1.player1.ctx.request.post(`${B}/api/auth/update-user`, { data: { role: 'admin', name: 'Paolo One' }, headers: { origin: B } });
    const row = (await db(`SELECT role FROM "user" WHERE email=$1`, [E.player1]))[0];
    return [row.role !== 'admin', `update-user ${r.status()}; role=${row.role}`];
  });
  await check('T-A5', 'Non-admin cannot call admin API (set-role, list-users)', async () => {
    const me = (await db(`SELECT id FROM "user" WHERE email=$1`, [E.player1]))[0].id;
    const r1 = await S1.player1.ctx.request.post(`${B}/api/auth/admin/set-role`, { data: { userId: me, role: 'admin' }, headers: { origin: B } });
    const r2 = await S1.player1.ctx.request.get(`${B}/api/auth/admin/list-users`, { headers: { origin: B } });
    const row = (await db(`SELECT role FROM "user" WHERE id=$1`, [me]))[0];
    return [r1.status() >= 400 && r2.status() >= 400 && row.role !== 'admin', `set-role ${r1.status()}, list-users ${r2.status()}, role=${row.role}`];
  });
  await check('T-A6', 'Sign-out ends the session (account redirects to login)', async () => {
    const t = await login(b, E.player2);
    const r = await t.ctx.request.post(`${B}/api/auth/sign-out`, { headers: { origin: B }, data: {} });
    await t.page.goto(`${B}/account`);
    return [pathOf(t.page.url()).startsWith('/login'), `sign-out ${r.status()} → ${pathOf(t.page.url())}`];
  });
  await check('T-A7', 'Password reset: link works, new password signs in, old one fails', async () => {
    const c = await b.newContext();
    const r = await c.request.post(`${B}/api/auth/request-password-reset`, { data: { email: E.player2, redirectTo: '/reset-password' }, headers: { origin: B } });
    await new Promise(z => setTimeout(z, 1500));
    const log = require('fs').readFileSync(process.env.QA_SERVER_LOG || 'server.log', 'utf8');
    const m = [...log.matchAll(/Choose a new password: (\S+)/g)].pop();
    if (!m) return [false, `request ${r.status()}, no link in log`];
    const p = await c.newPage(); await p.goto(m[1]); await p.waitForURL(/reset-password/);
    await p.fill('#password', 'New-pass-67890'); await p.fill('#confirm', 'New-pass-67890'); await go(p, 'button[type=submit]');
    const ok = await login(b, E.player2, 'New-pass-67890'); const old = await login(b, E.player2, PW);
    // restore
    const p2 = await ok.ctx.request.post(`${B}/api/auth/change-password`, { data: { currentPassword: 'New-pass-67890', newPassword: PW }, headers: { origin: B } });
    return [ok.ok && !old.ok && p2.ok(), `new:${ok.status} old:${old.status} restore:${p2.status()}`];
  });
  S1.player2 = await login(b, E.player2);
  await check('T-A8', 'Banned user cannot sign in; unban restores', async () => {
    const id = (await db(`SELECT id FROM "user" WHERE email=$1`, [E.banme]))[0].id;
    const a = S1.admin.page; await a.goto(`${B}/admin?tab=users&q=banme`);
    await go(a, `tr:has-text("${E.banme}") >> button:has-text("Ban")`);
    const banned = await login(b, E.banme);
    await a.goto(`${B}/admin?tab=users&q=banme`); await go(a, `tr:has-text("${E.banme}") >> button:has-text("Unban")`);
    const back = await login(b, E.banme);
    return [!banned.ok && back.ok, `banned sign-in ${banned.status}, after unban ${back.status}, id ${id.slice(0, 6)}`];
  });

  // ---------------- ACCESS: pages ----------------
  const pagesA = [`/venue/${A}`, `/venue/${A}?tab=calendar`, `/venue/${A}?tab=settings`, `/venue/${A}?tab=billing`, `/venue/${A}/openplay/${S.sessionId}`];
  await check('T-P1', 'Signed-out visitor is sent to sign-in for account, admin and venue pages', async () => {
    const p = await anon.newPage(); const out = [];
    for (const u of ['/account', '/admin', ...pagesA, `/bookings/${S.bookingId}`]) { await p.goto(B + u); out.push(`${u.split('?')[0].slice(0, 24)}→${pathOf(p.url()).slice(0, 12)}`); }
    return [out.every(x => x.includes('→/login')), out.join(' ')];
  });
  await check('T-P2', 'Player cannot open /admin or another venue\'s dashboard', async () => {
    const p = S1.player1.page; const out = [];
    for (const u of ['/admin', ...pagesA]) { await p.goto(B + u); out.push(pathOf(p.url())); }
    return [out[0].includes('denied') && out.slice(1).every(x => !x.startsWith(`/venue/${A}`)), out.join(' ')];
  });
  await check('T-P3', 'Owner of venue B cannot open any venue A page (tenant isolation)', async () => {
    const p = S1.ownerB.page; const out = [];
    for (const u of pagesA) { await p.goto(B + u); out.push(pathOf(p.url())); }
    return [out.every(x => !x.startsWith(`/venue/${A}`)), out.join(' ')];
  });
  await check('T-P4', 'Front-desk staff cannot see staff, payments, billing or settings tabs (even by URL)', async () => {
    const p = S1.staffA.page; await p.goto(`${B}/venue/${A}`);
    const tabs = (await p.locator('[role=tab]').allInnerTexts()).join(',');
    const leaks = [];
    for (const t of ['settings', 'staff', 'payments', 'billing']) { await p.goto(`${B}/venue/${A}?tab=${t}`); if (await p.locator('#deposit_percent, input[name=email], #pk, .plan-pick').count()) leaks.push(t); }
    return [!/STAFF|PAYMENTS|BILLING|SETTINGS/i.test(tabs) && leaks.length === 0, `tabs=${tabs} leaks=${leaks.join(',') || 'none'}`];
  });
  await check('T-P5', 'Manager cannot see owner-only payments/billing', async () => {
    const p = S1.managerA.page; const leaks = [];
    for (const t of ['payments', 'billing']) { await p.goto(`${B}/venue/${A}?tab=${t}`); if (await p.locator('#pk, .plan-pick').count()) leaks.push(t); }
    return [leaks.length === 0, `leaks=${leaks.join(',') || 'none'}`];
  });
  await check('T-P6', 'Another player cannot open player 1\'s booking page', async () => {
    const p = S1.player2.page; const r = await p.goto(`${B}/bookings/${S.bookingId}`);
    return [r.status() === 404 && (await p.locator('#messages').count()) === 0, `HTTP ${r.status()}`];
  });
  await check('T-P7', 'Owner B cannot open venue A invoices by ID', async () => {
    await db(`INSERT INTO invoice (number, venue_id, period_start, period_end, plan, total_cents, due_date) VALUES ('INV-QA-A',$1,'2026-10-01','2026-10-31','trial',1000,'2026-11-08') ON CONFLICT DO NOTHING`, [A]);
    const inv = (await db(`SELECT id FROM invoice WHERE number='INV-QA-A'`))[0].id;
    const p = S1.ownerB.page;
    const r1 = await p.goto(`${B}/venue/${A}/invoice/${inv}`); const u1 = pathOf(p.url());
    const r2 = await p.goto(`${B}/venue/${VB}/invoice/${inv}`);
    return [!u1.startsWith(`/venue/${A}/invoice`) && r2.status() === 404, `own-venue-url→${u1}; cross-url HTTP ${r2.status()}`];
  });

  // ---------------- FORGED SERVER ACTIONS (replay with tampered ids / wrong user) ----------------
  const courtA = S.courtsA[0].id;
  const rateA = async () => (await db('SELECT hourly_rate_cents FROM resource WHERE id=$1', [courtA]))[0].hourly_rate_cents;
  // capture forms
  const oB = S1.ownerB.page; await oB.goto(`${B}/venue/${VB}?tab=courts`);
  const fUpdB = await captureForm(oB, oB.locator('form:has(input[name=rate])').first());
  await check('T-F1', 'Owner B edits venue A court by swapping the court id (venue_id still B)', async () => {
    const before = await rateA();
    const rr = await replay(oB, `${B}/venue/${VB}?tab=courts`, fUpdB, { id: courtA, rate: '1' }); var ans = `${rr.status} ${decodeURIComponent(rr.location).slice(-50)}`;
    const after = await rateA(); return [after === before && /error=/.test(ans), `rate before ${before} after ${after}; server: ${ans}`];
  });
  await check('T-F2', 'Owner B edits venue A court by swapping venue_id to A', async () => {
    const before = await rateA();
    const rr = await replay(oB, `${B}/venue/${A}?tab=courts`, fUpdB, { id: courtA, venue_id: A, rate: '1' }); const u = `${rr.status} ${decodeURIComponent(rr.location)}`;
    const after = await rateA(); return [after === before, `rate ${before}→${after}; server: ${u}`];
  });
  const oA = S1.ownerA.page; await oA.goto(`${B}/venue/${A}?tab=courts`);
  const fAddA = await captureForm(oA, oA.locator('form:has(input[name=court_name_0])'));
  await check('T-F3', 'Front-desk staff replays manager-only "add court"', async () => {
    const n0 = (await db('SELECT count(*)::int n FROM resource WHERE venue_id=$1', [A]))[0].n;
    const rr = await replay(S1.staffA.page, `${B}/venue/${A}?tab=courts`, fAddA, { court_name_0: 'Hacked Court', court_sport_0: 'pickleball', court_rate_0: '1' }); var ans3 = `${rr.status} ${rr.location}`;
    const n1 = (await db('SELECT count(*)::int n FROM resource WHERE venue_id=$1', [A]))[0].n; return [n1 === n0, `courts ${n0}→${n1}; server: ${ans3}`];
  });
  await oA.goto(`${B}/venue/${A}?tab=billing`);
  const fPlan = await captureForm(oA, oA.locator('form:has(input[value=club])'));
  await check('T-F4', 'Manager replays owner-only "choose plan"', async () => {
    const before = (await db('SELECT plan FROM venue WHERE id=$1', [A]))[0].plan;
    var r4 = await replay(S1.managerA.page, `${B}/venue/${A}?tab=billing`, fPlan);
    const after = (await db('SELECT plan FROM venue WHERE id=$1', [A]))[0].plan; return [after === before, `plan ${before}→${after}; server: ${r4.status} ${r4.location}`];
  });
  await oA.goto(`${B}/venue/${A}?tab=staff`);
  const fMember = await captureForm(oA, oA.locator('form:has(input[name=email])'));
  await check('T-F5', 'Manager replays "add member" as manager (owner-only) to promote staff', async () => {
    var r5 = await replay(S1.managerA.page, `${B}/venue/${A}?tab=staff`, fMember, { email: E.staffA, role: 'manager' });
    const role = (await db(`SELECT m.role FROM venue_member m JOIN "user" u ON u.id=m.user_id WHERE u.email=$1 AND m.venue_id=$2`, [E.staffA, A]))[0].role;
    return [role === 'staff', `staffA role now ${role}; server: ${r5.status} ${decodeURIComponent(r5.location).slice(-60)}`];
  });
  await check('T-F6', 'Owner B adds themself to venue A by replaying add-member with venue_id A', async () => {
    var r6 = await replay(oB, `${B}/venue/${VB}?tab=staff`, fMember, { email: E.ownerB, role: 'manager', venue_id: A });
    const n = (await db(`SELECT count(*)::int n FROM venue_member m JOIN "user" u ON u.id=m.user_id WHERE u.email=$1 AND m.venue_id=$2`, [E.ownerB, A]))[0].n;
    return [n === 0, `ownerB memberships in A: ${n}; server: ${r6.status} ${r6.location}`];
  });
  const ad = S1.admin.page; await ad.goto(`${B}/admin?tab=venues&status=active`);
  const fSuspend = await captureForm(ad, ad.locator(`tr:has-text("Alpha Pickle") form:has(input[name=reason])`));
  await check('T-F7', 'Player replays admin "suspend venue"', async () => {
    var r7 = await replay(S1.player1.page, `${B}/admin?tab=venues`, fSuspend, { reason: 'hacked by player' });
    const st = (await db('SELECT status FROM venue WHERE id=$1', [A]))[0].status; return [st === 'active', `venue A status ${st}; server: ${r7.status} ${r7.location}`];
  });
  await ad.goto(`${B}/admin?tab=users&q=player1`);
  const fRole = await captureForm(ad, ad.locator(`tr:has-text("${E.player1}") form`).first());
  await check('T-F8', 'Player replays admin "make admin" on themself', async () => {
    var r8 = await replay(S1.player1.page, `${B}/admin?tab=users`, fRole);
    const r = (await db(`SELECT role FROM "user" WHERE email=$1`, [E.player1]))[0].role; return [r !== 'admin', `role ${r}; server: ${r8.status} ${r8.location}`];
  });
  const p1 = S1.player1.page; await p1.goto(`${B}/bookings/${S.bookingId}`);
  const fCancel = await captureForm(p1, p1.locator('form:has(button:has-text("Cancel booking"))'));
  const fMsg = await captureForm(p1, p1.locator('#messages form'));
  await check('T-F9', 'Another player replays "cancel booking" on player 1\'s booking', async () => {
    var r9 = await replay(S1.player2.page, `${B}/bookings/${S.bookingId}`, fCancel);
    const st = (await db('SELECT status FROM booking WHERE id=$1', [S.bookingId]))[0].status; return [st === 'confirmed', `status ${st}; server: ${r9.status} ${r9.location}`];
  });
  await check('T-F10', 'Another player replays "post message" on player 1\'s booking', async () => {
    var r10 = await replay(S1.player2.page, `${B}/bookings/${S.bookingId}`, fMsg, { body: 'intruder message' });
    const n = (await db(`SELECT count(*)::int n FROM booking_message WHERE body='intruder message'`))[0].n; return [n === 0, `intruder messages ${n}; server: ${r10.status} ${r10.location}`];
  });
  await check('T-F11', 'Owner B replays "cancel booking" on a venue A booking', async () => {
    var r11 = await replay(oB, `${B}/bookings/${S.bookingId}`, fCancel, { as: 'venue' });
    const st = (await db('SELECT status FROM booking WHERE id=$1', [S.bookingId]))[0].status; return [st === 'confirmed', `status ${st}; server: ${r11.status} ${r11.location}`];
  });
  await oA.goto(`${B}/venue/${A}/openplay/${S.sessionId}`);
  const fStart = await captureForm(oA, oA.locator('form:has(button:has-text("Start session"))'));
  await check('T-F12', 'Owner B starts venue A open-play session (venue_id B and A)', async () => {
    var r12a = await replay(oB, `${B}/venue/${A}/openplay/${S.sessionId}`, fStart, { venue_id: VB });
    var r12b = await replay(oB, `${B}/venue/${A}/openplay/${S.sessionId}`, fStart);
    const st = (await db('SELECT status FROM open_play_session WHERE id=$1', [S.sessionId]))[0].status; return [st === 'scheduled', `status ${st}; server: ${r12a.status} ${r12a.location} | ${r12b.status} ${r12b.location}`];
  });
  await check('T-F13', 'Signed-out visitor replays a venue action (walk-in style add court)', async () => {
    const n0 = (await db('SELECT count(*)::int n FROM resource WHERE venue_id=$1', [A]))[0].n;
    const p = await anon.newPage(); var r13 = await replay(p, `${B}/venue/${A}?tab=courts`, fAddA, { court_name_0: 'Anon Court', court_sport_0: 'pickleball', court_rate_0: '1' });
    const n1 = (await db('SELECT count(*)::int n FROM resource WHERE venue_id=$1', [A]))[0].n; return [n1 === n0, `courts ${n0}→${n1}; server: ${r13.status} ${r13.location}`];
  });

  // ---------------- WORKFLOWS ----------------
  await check('T-W1', 'Booked slot is no longer offered to other players', async () => {
    const bk = (await db("SELECT to_char(date,'YYYY-MM-DD') d, start_min, resource_id FROM booking WHERE id=$1", [S.bookingId]))[0];
    const p = S1.player2.page; await p.goto(`${B}/venues/alpha-pickle-pasig?court=${bk.resource_id}&date=${bk.d}&dur=60&sport=pickleball`);
    const h = Math.floor(bk.start_min / 60), mm = String(bk.start_min % 60).padStart(2, '0'); const label = `${h % 12 || 12}:${mm} ${h < 12 ? 'AM' : 'PM'}`;
    const slots = await p.locator('.slot-btn').allInnerTexts(); return [!slots.includes(label), `${label} offered? ${slots.includes(label)} (${slots.length} slots)`];
  });
  await check('T-W2', 'Two players racing for the same slot: exactly one gets it', async () => {
    const r = S.courtsA[0].id; const d = S.tomorrow;
    const url = `${B}/venues/alpha-pickle-pasig?court=${r}&date=${d}&dur=60&sport=pickleball`;
    const x = (await login(b, E.player2)).page, y = (await login(b, E.managerA)).page;
    await x.goto(url); await y.goto(url);
    const fx = await captureForm(x, x.locator('form:has(.slot-btn)').last());
    const fy = await captureForm(y, y.locator('form:has(.slot-btn)').last());
    const start = Number(fx.find(([k]) => k === 'start')[1]);
    const [rx, ry] = await Promise.all([replay(x, url, fx), replay(y, url, fy)]);
    const n = (await db(`SELECT count(*)::int n FROM booking WHERE resource_id=$1 AND date=$2 AND start_min=$3 AND status IN ('held','confirmed')`, [r, d, start]))[0].n;
    const wins = [rx, ry].filter((q) => q.location.startsWith('/bookings/')).length;
    return [n === 1 && wins === 1, `active rows=${n}; p2→${decodeURIComponent(rx.location).slice(0, 60)} | mgr→${decodeURIComponent(ry.location).slice(-50)}`];
  });
  await check('T-W3', 'Expired hold frees the slot', async () => {
    const h = (await db(`SELECT id FROM booking WHERE status='held' AND venue_id=$1 ORDER BY created_at DESC LIMIT 1`, [A]))[0];
    if (!h) return [false, 'no held booking to expire'];
    await db(`UPDATE booking SET hold_expires_at=now()-interval '1 minute' WHERE id=$1`, [h.id]);
    const p = S1.player2.page; await p.goto(`${B}/venues/alpha-pickle-pasig?court=${S.courtsA[0].id}&date=${S.tomorrow}&dur=60&sport=pickleball`);
    const st = (await db('SELECT status, cancel_reason FROM booking WHERE id=$1', [h.id]))[0];
    return [st.status === 'cancelled' && st.cancel_reason === 'Hold expired', `${st.status} / ${st.cancel_reason}`];
  });
  await check('T-W4', 'Suspended venue disappears from listings and refuses new holds', async () => {
    await db(`UPDATE venue SET status='suspended' WHERE id=$1`, [VB]);
    const p = S1.player2.page; await p.goto(`${B}/venues`); const listed = await p.locator('.venue-card:has-text("Bravo")').count();
    const r = await p.goto(`${B}/venues/bravo-pickle-pasig`);
    await db(`UPDATE venue SET status='active' WHERE id=$1`, [VB]);
    return [listed === 0 && r.status() === 404, `listed ${listed}, venue page HTTP ${r.status()}`];
  });
  await check('T-W5', 'Platform fee recorded on online booking; none on staff walk-in', async () => {
    const f = (await db('SELECT platform_fee_cents FROM booking WHERE id=$1', [S.bookingId]))[0];
    const st = S1.staffA.page; const url = `${B}/venue/${A}?tab=calendar&date=${S.tomorrow}`; await st.goto(url);
    const fw = await captureForm(st, st.locator('form:has(#wi-name)'));
    const rr = await replay(st, url, fw, { resource_id: S.courtsA[0].id, start: '21:00', duration: '60', customer_name: 'Walk QA' });
    const w = (await db(`SELECT platform_fee_cents FROM booking WHERE customer_name='Walk QA' AND venue_id=$1`, [A]))[0];
    return [f.platform_fee_cents > 0 && w && w.platform_fee_cents === 0, `online fee ${f.platform_fee_cents}, walk-in fee ${w?.platform_fee_cents}; server: ${rr.status} ${decodeURIComponent(rr.location).slice(-60)}`];
  });

  // ---------------- VALIDATION ----------------
  await check('T-V1', 'Venue registration rejects missing business details', async () => {
    const p = S1.player2.page; await p.goto(`${B}/venue/new`);
    const f = await captureForm(p, p.locator('form'));
    const n0 = (await db('SELECT count(*)::int n FROM venue'))[0].n;
    const u = await replay(p, `${B}/venue/new`, f, { name: 'No Biz', area: 'Pasig', address: '1 Long Address St', phone: '09171234567', business_name: '', business_reg_no: '', court_name_0: 'C1', court_sport_0: 'pickleball', court_rate_0: '100', agree: 'on' });
    const n1 = (await db('SELECT count(*)::int n FROM venue'))[0].n;
    return [n1 === n0 && /error=/.test(u.location), `venues ${n0}→${n1}, ${decodeURIComponent(u.location).slice(0, 80)}`];
  });
  await check('T-V2', 'Court rate must be positive', async () => {
    const before = await rateA();
    await oA.goto(`${B}/venue/${A}?tab=courts`); const f = await captureForm(oA, oA.locator('form:has(input[name=rate])').first());
    const u = await replay(oA, `${B}/venue/${A}?tab=courts`, f, { rate: '-50' });
    const after = await rateA(); return [after === before && /error=/.test(u.location), `rate ${before}→${after}; ${decodeURIComponent(u.location).slice(-40)}`];
  });
  await check('T-V3', 'Empty chat message is rejected', async () => {
    const n0 = (await db('SELECT count(*)::int n FROM booking_message'))[0].n;
    await replay(p1, `${B}/bookings/${S.bookingId}`, fMsg, { body: '   ' });
    const n1 = (await db('SELECT count(*)::int n FROM booking_message'))[0].n; return [n1 === n0, `messages ${n0}→${n1}`];
  });
  await check('T-V4', 'Booking more than 14 days ahead is refused', async () => {
    const d = (await db("SELECT to_char((now() AT TIME ZONE 'Asia/Manila')::date + 30,'YYYY-MM-DD') d"))[0].d;
    await p1.goto(`${B}/venues/alpha-pickle-pasig?court=${S.courtsA[0].id}&date=${S.tomorrow}&dur=60&sport=pickleball`);
    const f = await captureForm(p1, p1.locator('form:has(.slot-btn)').first());
    const u = await replay(p1, `${B}/venues/alpha-pickle-pasig`, f, { date: d });
    const n = (await db('SELECT count(*)::int n FROM booking WHERE date=$1 AND venue_id=$2', [d, A]))[0].n; return [n === 0 && /error=/.test(u.location), `bookings on ${d}: ${n}; ${decodeURIComponent(u.location).slice(-60)}`];
  });

  // ---------------- UI ----------------
  await check('T-U1', 'No horizontal overflow at 360px on key app screens', async () => {
    const out = [];
    const phone = async (email) => (await login(b, email, PW, { width: 360, height: 740 })).page;
    const pp = await phone(E.player1), op = await phone(E.ownerA), ap = await phone(E.admin);
    const list = [[pp, '/venues'], [pp, '/venues/alpha-pickle-pasig'], [pp, `/bookings/${S.bookingId}`], [pp, '/account'],
      [op, `/venue/${A}`], [op, `/venue/${A}?tab=calendar&date=${S.tomorrow}`], [op, `/venue/${A}?tab=recurring`], [op, `/venue/${A}/openplay/${S.sessionId}`], [op, `/venue/${A}?tab=billing`],
      [ap, '/admin'], [ap, '/admin?tab=venues'], [ap, '/admin?tab=billing'], [ap, '/admin?tab=users'], [pp, '/login']];
    for (const [pg, u] of list) { await pg.goto(B + u); const o = await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth); if (o > 1) out.push(`${u}:+${o}px`); }
    return [out.length === 0, out.join(' ') || `${list.length} screens fit`];
  });

  console.log('\nSUMMARY', results.filter(r => r.pass).length, 'pass /', results.length);
  require('fs').writeFileSync('results.json', JSON.stringify(results, null, 2));
  await b.close(); await pool.end();
})().catch(async e => { console.error('QA CRASH', e.message.split('\n').slice(0, 4).join(' | ')); require('fs').writeFileSync('results.json', JSON.stringify(results, null, 2)); process.exit(1); });
