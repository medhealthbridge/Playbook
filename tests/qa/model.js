// End-to-end checks for the free model: admin-set cut, "no payment, no play",
// voids, scores and levels, rentals, weekly statements and the automatic pause.
// Run after seed.js, against the dev database only. Uses venue "Bravo Pickle".
const { chromium } = require('playwright');
const { B, db, pool, login, signupApi, check, results } = require('./lib');

const done = (u) => /[?&](ok|error)=/.test(String(u));
(async () => {
  const b = await chromium.launch();
  const [V] = await db("SELECT id, slug FROM venue WHERE name='Bravo Pickle'");
  const tomorrow = (await db("SELECT to_char((now() AT TIME ZONE 'Asia/Manila')::date + 1,'YYYY-MM-DD') d"))[0].d;
  const today = (await db("SELECT to_char((now() AT TIME ZONE 'Asia/Manila')::date,'YYYY-MM-DD') d"))[0].d;
  await db(`UPDATE platform_setting SET value='{"open_play":{"mode":"fixed","value":3000,"min_cents":0},"court":{"mode":"percent","value":20,"min_cents":0},"staff_bookings":true}' WHERE key='cut'`);
  await db(`UPDATE platform_setting SET value='{"manual_instructions":"GCash 0917 000 0000","due_days":7,"auto_pause":true}' WHERE key='billing'`);

  const c0 = await b.newContext();
  const P = ['m-ana', 'm-ben', 'm-cy', 'm-dee', 'm-eli'].map((k) => ({ key: k, name: `${k.slice(2)[0].toUpperCase()}${k.slice(3)} Model`, email: `${k}-qa@playbook.test` }));
  for (const p of P) { for (let t = 0; t < 6; t++) { const r = await signupApi(c0.request, p.name, p.email); if (r.status !== 429) break; await new Promise((z) => setTimeout(z, 4000)); } }
  const owner = await login(b, 'ownerb-qa@playbook.test');
  const admin = await login(b, 'admin-test@playbook.test');
  const act = async (page, url, fn) => { await page.goto(url); await fn(page); await page.waitForURL(done, { timeout: 30000 }); return decodeURIComponent(page.url()); };

  // Owner sets up a rental and an open-play session (₱250 per player) on the venue's court.
  await act(owner.page, `${B}/venue/${V.id}?tab=courts`, async (p) => { await p.fill('input[aria-label="Rental item name"]', 'Paddle'); await p.fill('input[aria-label="Rental price in pesos"]', '50'); await p.click('form:has(input[aria-label="Rental item name"]) button'); });
  const [paddle] = await db("SELECT id FROM rental_item WHERE venue_id=$1 AND name='Paddle'", [V.id]);
  const made = await act(owner.page, `${B}/venue/${V.id}?tab=openplay`, async (p) => { await p.fill('#op-date', tomorrow); await p.fill('#op-max', '12'); await p.click('button:has-text("Create session")'); });
  const sid = made.split('?')[0].split('/').pop();
  const [S] = await db('SELECT id, code, fee_cents FROM open_play_session WHERE id=$1', [sid]);
  const consoleUrl = `${B}/venue/${V.id}/openplay/${sid}`;
  const player = async (email) => (await db(`SELECT p.* FROM open_play_player p JOIN "user" u ON u.id=p.user_id WHERE p.session_id=$1 AND u.email=$2`, [sid, email]))[0];

  const ctx = {};
  for (const p of P.slice(0, 4)) {
    ctx[p.key] = await login(b, p.email);
    await act(ctx[p.key].page, `${B}/play/${S.code}`, async (pg) => {
      await pg.selectOption('#skill', p.key === 'm-ana' ? 'advanced' : 'intermediate');
      if (p.key === 'm-ben') await pg.fill(`#rent_${paddle.id}`, '1');
      await pg.check('input[name=consent]'); await pg.click('button:has-text("Join the queue")');
    });
  }
  const row = (name) => `li:has-text("${name}")`;

  await check('M1', 'Joining saves the declared level to the player profile', async () => {
    const [k] = await db(`SELECT k.level, k.rating FROM player_skill k JOIN "user" u ON u.id=k.user_id WHERE u.email='m-ana-qa@playbook.test' AND k.sport='pickleball'`);
    return [k && k.level === 'advanced' && k.rating === 1600, JSON.stringify(k)];
  });
  await check('M2', 'Joining without ticking the consent box is refused (forged request)', async () => {
    const e = await login(b, P[4].email); await e.page.goto(`${B}/play/${S.code}`);
    await e.page.evaluate(() => document.querySelector('input[name=consent]').removeAttribute('required'));
    await e.page.click('button:has-text("Join the queue")'); await e.page.waitForURL(done);
    const [n] = await db(`SELECT count(*)::int n FROM open_play_player p JOIN "user" u ON u.id=p.user_id WHERE p.session_id=$1 AND u.email=$2`, [sid, P[4].email]);
    return [n.n === 0 && /error=/.test(e.page.url()), `rows=${n.n} ${decodeURIComponent(e.page.url()).slice(-50)}`];
  });
  await check('M3', 'No payment, no play: check-in with less cash than the fee is refused', async () => {
    const u = await act(owner.page, consoleUrl, async (p) => { await p.fill(`${row('Ana Model')} input[name=paid]`, '100'); await p.click(`${row('Ana Model')} button:has-text("Check in")`); });
    const pl = await player('m-ana-qa@playbook.test');
    return [pl.status === 'registered' && pl.platform_fee_cents === 0 && /No payment, no play/.test(u), `status=${pl.status} cut=${pl.platform_fee_cents}`];
  });
  await check('M4', 'Check-in with cash recorded queues the player and records the fixed cut (₱30)', async () => {
    await act(owner.page, consoleUrl, async (p) => { await p.fill(`${row('Ana Model')} input[name=paid]`, '250'); await p.click(`${row('Ana Model')} button:has-text("Check in")`); });
    const pl = await player('m-ana-qa@playbook.test');
    return [pl.status === 'waiting' && pl.platform_fee_cents === 3000 && pl.paid_cents === 25000 && pl.pay_method === 'cash', `status=${pl.status} cut=${pl.platform_fee_cents} paid=${pl.paid_cents} ${pl.pay_method}`];
  });
  await check('M5', 'A rental is added to what is due, and carries no cut', async () => {
    const short = await act(owner.page, consoleUrl, async (p) => { await p.fill(`${row('Ben Model')} input[name=paid]`, '250'); await p.click(`${row('Ben Model')} button:has-text("Check in")`); });
    const mid = await player('m-ben-qa@playbook.test');
    await act(owner.page, consoleUrl, async (p) => { await p.fill(`${row('Ben Model')} input[name=paid]`, '300'); await p.click(`${row('Ben Model')} button:has-text("Check in")`); });
    const pl = await player('m-ben-qa@playbook.test');
    return [mid.status === 'registered' && /error=/.test(short) && pl.status === 'waiting' && pl.rental_cents === 5000 && pl.platform_fee_cents === 3000, `₱250 refused=${mid.status === 'registered'}; then status=${pl.status} rental=${pl.rental_cents} cut=${pl.platform_fee_cents}`];
  });
  await check('M6', 'Admin changes the cut to 10% and the next check-in uses it', async () => {
    await act(admin.page, `${B}/admin?tab=settings`, async (p) => { await p.selectOption('#op_mode', 'percent'); await p.fill('#op_value', '10'); await p.click('button:has-text("Save cut")'); });
    await act(owner.page, consoleUrl, async (p) => { await p.fill(`${row('Cy Model')} input[name=paid]`, '250'); await p.click(`${row('Cy Model')} button:has-text("Check in")`); });
    const pl = await player('m-cy-qa@playbook.test');
    await act(admin.page, `${B}/admin?tab=settings`, async (p) => { await p.selectOption('#op_mode', 'fixed'); await p.fill('#op_value', '30'); await p.click('button:has-text("Save cut")'); });
    const [set] = await db("SELECT value FROM platform_setting WHERE key='cut'");
    return [pl.platform_fee_cents === 2500 && set.value.open_play.mode === 'fixed' && set.value.open_play.value === 3000, `cut at 10% = ${pl.platform_fee_cents}; restored to ${JSON.stringify(set.value.open_play)}`];
  });
  await check('M7', 'Walk-in without the fee recorded is refused; with cash it is queued with the cut', async () => {
    const bad = await act(owner.page, consoleUrl, async (p) => { await p.fill('#wk-name', 'Walk Zero'); await p.fill('#wk-paid', '0'); await p.click('button:has-text("Add to queue")'); });
    const n0 = (await db("SELECT count(*)::int n FROM open_play_player WHERE session_id=$1 AND name='Walk Zero'", [sid]))[0].n;
    await act(owner.page, consoleUrl, async (p) => { await p.fill('#wk-name', 'Walk Paid'); await p.fill('#wk-paid', '250'); await p.click('button:has-text("Add to queue")'); });
    const [w] = await db("SELECT status, platform_fee_cents, pay_method FROM open_play_player WHERE session_id=$1 AND name='Walk Paid'", [sid]);
    return [n0 === 0 && /error=/.test(bad) && w && w.status === 'waiting' && w.platform_fee_cents === 3000, `unpaid rows=${n0}; paid walk-in ${JSON.stringify(w)}`];
  });
  await check('M8', 'Void needs a reason, removes the cut and is recorded', async () => {
    await act(owner.page, consoleUrl, async (p) => { await p.fill(`${row('Walk Paid')} input[name=reason]`, 'refunded, had to leave'); await p.click(`${row('Walk Paid')} button:has-text("Void")`); });
    const [w] = await db("SELECT status, platform_fee_cents, void_reason, voided_at IS NOT NULL AS voided FROM open_play_player WHERE session_id=$1 AND name='Walk Paid'", [sid]);
    const [a] = await db("SELECT count(*)::int n FROM audit_log WHERE action='openplay.void' AND meta->>'sessionId'=$1", [sid]);
    await admin.page.goto(`${B}/admin?tab=transactions&show=voids`);
    const seen = await admin.page.locator('tr:has-text("Walk Paid"):has-text("refunded, had to leave")').count();
    return [w.status === 'left' && w.voided && w.platform_fee_cents === 0 && a.n === 1 && seen === 1, `${JSON.stringify(w)} audit=${a.n} admin-sees=${seen}`];
  });
  // Fourth player in, start, fill the court.
  await act(owner.page, consoleUrl, async (p) => { await p.fill(`${row('Dee Model')} input[name=paid]`, '250'); await p.click(`${row('Dee Model')} button:has-text("Check in")`); });
  await act(owner.page, consoleUrl, async (p) => { await p.click('button:has-text("Start session")'); });
  await act(owner.page, consoleUrl, async (p) => { await p.click('button:has-text("Fill free courts")'); });
  await check('M9', 'Matchmaking puts four checked-in players on the free court', async () => {
    const [g] = await db("SELECT team_a, team_b FROM open_play_game WHERE session_id=$1 AND status='playing'", [sid]);
    return [!!g && g.team_a.length === 2 && g.team_b.length === 2, g ? `A=${g.team_a.length} B=${g.team_b.length}` : 'no game'];
  });
  await check('M10', 'A level score is refused', async () => {
    const u = await act(owner.page, consoleUrl, async (p) => { await p.fill('input[name=score_a]', '11'); await p.fill('input[name=score_b]', '11'); await p.click('button:has-text("Save score")'); });
    const [g] = await db("SELECT status FROM open_play_game WHERE session_id=$1 ORDER BY started_at LIMIT 1", [sid]);
    return [g.status === 'playing' && /error=/.test(u), `game ${g.status}; ${u.slice(-60)}`];
  });
  await check('M11', 'Final score sets the winner and updates every player\'s record and rating', async () => {
    await act(owner.page, consoleUrl, async (p) => { await p.fill('input[name=score_a]', '11'); await p.fill('input[name=score_b]', '7'); await p.click('button:has-text("Save score")'); });
    const [g] = await db("SELECT winner, score_a, score_b, team_a, team_b FROM open_play_game WHERE session_id=$1 AND status='done' ORDER BY ended_at DESC LIMIT 1", [sid]);
    const rec = await db(`SELECT p.id, k.wins, k.losses, k.games, k.rating FROM open_play_player p JOIN player_skill k ON k.user_id=p.user_id AND k.sport='pickleball' WHERE p.id = ANY($1)`, [[...g.team_a, ...g.team_b]]);
    const ok = g.winner === 'a' && g.score_a === 11 && g.score_b === 7 && rec.length === 4
      && rec.every((r) => r.games === 1 && (g.team_a.includes(r.id) ? r.wins === 1 && r.losses === 0 : r.wins === 0 && r.losses === 1));
    return [ok, `winner=${g.winner} ${g.score_a}-${g.score_b}; ${rec.map((r) => `${r.wins}W${r.losses}L r${r.rating}`).join(' ')}`];
  });
  await check('M12', 'A player cannot reset their own level once they have a scored game', async () => {
    const before = (await db(`SELECT k.level, k.rating FROM player_skill k JOIN "user" u ON u.id=k.user_id WHERE u.email='m-cy-qa@playbook.test'`))[0];
    const u = await act(ctx['m-cy'].page, `${B}/account`, async (p) => { await p.selectOption('#lv-level', 'advanced'); await p.click('button:has-text("Save level")'); });
    const after = (await db(`SELECT k.level, k.rating FROM player_skill k JOIN "user" u ON u.id=k.user_id WHERE u.email='m-cy-qa@playbook.test'`))[0];
    return [after.rating === before.rating && /error=/.test(u), `rating ${before.rating}→${after.rating}`];
  });
  await check('M13', 'Payment bell feed: signed-out 401, another venue\'s owner 403, own staff 200', async () => {
    const anon = await (await b.newContext()).request.get(`${B}/api/venue/${V.id}/payments?since=0`); // a context that never signed in
    const other = await (await login(b, 'ownera-qa@playbook.test')).ctx.request.get(`${B}/api/venue/${V.id}/payments?since=0`);
    const own = await owner.ctx.request.get(`${B}/api/venue/${V.id}/payments?since=0`);
    return [anon.status() === 401 && other.status() === 403 && own.status() === 200, `anon ${anon.status()} other ${other.status()} own ${own.status()}`];
  });

  // Court booking with party size and a rental.
  const e = await login(b, P[4].email);
  await check('M14', 'Court booking: party size and rental saved; cut is 20% of the court price only', async () => {
    await e.page.goto(`${B}/venues/${V.slug}`); await e.page.click('.slot-btn >> nth=0'); await e.page.waitForURL(/\/bookings\//);
    const id = e.page.url().split('?')[0].split('/').pop();
    await e.page.fill('#party_size', '6'); await e.page.fill(`#rent_${paddle.id}`, '2'); await e.page.click('button:has-text("Save players")'); await e.page.waitForURL(done);
    await e.page.click('button:has-text("at the venue")'); await e.page.waitForSelector('.badge-ok:has-text("Confirmed")');
    const [bk] = await db('SELECT party_size, rental_cents, price_cents, platform_fee_cents FROM booking WHERE id=$1', [id]);
    return [bk.party_size === 6 && bk.rental_cents === 10000 && bk.price_cents === 60000 && bk.platform_fee_cents === 10000, JSON.stringify(bk)];
  });

  // Weekly statement and the automatic pause.
  const weekCut = async () => (await db(
    `SELECT (SELECT coalesce(sum(p.platform_fee_cents),0)::int FROM open_play_player p WHERE p.session_id=$1) AS play,
            (SELECT coalesce(sum(platform_fee_cents),0)::int FROM booking WHERE venue_id=$2 AND status='confirmed' AND date=$3) AS court`, [sid, V.id, today]))[0];
  let invId;
  await check('M15', 'Weekly statement adds up the cut on check-ins made this week; running it twice does not duplicate', async () => {
    const run = () => act(admin.page, `${B}/admin?tab=billing`, async (p) => { await p.fill('#date', today); await p.click('button:has-text("Create statements")'); });
    await run(); await run();
    const inv = await db("SELECT id, open_play_count, open_play_fee_cents, total_cents FROM invoice WHERE venue_id=$1 AND number LIKE 'ST-%'", [V.id]);
    const w = await weekCut(); invId = inv[0]?.id;
    return [inv.length === 1 && inv[0].open_play_fee_cents === w.play && inv[0].open_play_fee_cents === 3000 + 3000 + 2500 + 3000 && inv[0].total_cents >= w.play, `statements=${inv.length} ${JSON.stringify(inv[0])} expected play=${w.play}`];
  });
  await check('M16', 'Overdue statement pauses the venue: no new holds, check-ins or walk-ins', async () => {
    await db("UPDATE invoice SET due_date = (now() AT TIME ZONE 'Asia/Manila')::date - 1 WHERE id=$1", [invId]);
    await e.page.goto(`${B}/venues/${V.slug}?date=${tomorrow}`); const before = (await db('SELECT count(*)::int n FROM booking WHERE venue_id=$1', [V.id]))[0].n;
    await e.page.click('.slot-btn >> nth=0'); await e.page.waitForURL((u) => /\/bookings\/|error=/.test(String(u)));
    const after = (await db('SELECT count(*)::int n FROM booking WHERE venue_id=$1', [V.id]))[0].n;
    const wk = await act(owner.page, consoleUrl, async (p) => { await p.fill('#wk-name', 'Paused Walk'); await p.fill('#wk-paid', '250'); await p.click('button:has-text("Add to queue")'); });
    const n = (await db("SELECT count(*)::int n FROM open_play_player WHERE session_id=$1 AND name='Paused Walk'", [sid]))[0].n;
    await owner.page.goto(`${B}/venue/${V.id}`); const banner = await owner.page.locator('.alert-error:has-text("paused")').count();
    return [after === before && n === 0 && /paused/.test(wk) && banner === 1, `bookings ${before}→${after}, walk-in rows=${n}, owner banner=${banner}`];
  });
  await check('M17', 'Admin marks the statement paid and the venue resumes', async () => {
    await act(admin.page, `${B}/admin?tab=billing&status=open`, async (p) => { await p.fill(`tr:has-text("Bravo Pickle") input[name=note]`, 'GCash ref QA'); await p.click(`tr:has-text("Bravo Pickle") button:has-text("Mark paid")`); });
    await act(owner.page, consoleUrl, async (p) => { await p.fill('#wk-name', 'Resumed Walk'); await p.fill('#wk-paid', '250'); await p.click('button:has-text("Add to queue")'); });
    const [inv] = await db('SELECT status FROM invoice WHERE id=$1', [invId]);
    const n = (await db("SELECT count(*)::int n FROM open_play_player WHERE session_id=$1 AND name='Resumed Walk' AND status='waiting'", [sid]))[0].n;
    return [inv.status === 'paid' && n === 1, `statement ${inv.status}, walk-in rows=${n}`];
  });
  await check('M18', 'Owner blocks a player: that account can no longer hold a court here', async () => {
    await act(owner.page, `${B}/venue/${V.id}?tab=players`, async (p) => { await p.fill(`tr:has-text("Eli Model") input[name=reason]`, 'repeated no-shows'); await p.click(`tr:has-text("Eli Model") button:has-text("Block")`); });
    const before = (await db(`SELECT count(*)::int n FROM booking b JOIN "user" u ON u.id=b.user_id WHERE u.email=$1`, [P[4].email]))[0].n;
    await e.page.goto(`${B}/venues/${V.slug}?date=${tomorrow}`); await e.page.click('.slot-btn >> nth=0'); await e.page.waitForURL((u) => /\/bookings\/|error=/.test(String(u)));
    const after = (await db(`SELECT count(*)::int n FROM booking b JOIN "user" u ON u.id=b.user_id WHERE u.email=$1`, [P[4].email]))[0].n;
    return [after === before && /error=/.test(e.page.url()), `bookings ${before}→${after}`];
  });
  await check('M19', 'Facilitator cannot change the cut or open admin transactions', async () => {
    const st = await login(b, 'staffa-qa@playbook.test');
    await st.page.goto(`${B}/admin?tab=transactions`);
    return [!/\/admin/.test(new URL(st.page.url()).pathname), `landed on ${new URL(st.page.url()).pathname}`];
  });

  await b.close(); await pool.end();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} model checks passed.`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('MODEL CRASH', e.message.split('\n').slice(0, 4).join(' | ')); process.exit(1); });
