// Regression checks for the quality pass: booking-hold abuse limits and the
// PayMongo webhook (signature, replay window, idempotency, tenant scoping).
// Run after seed.js, against the dev database only.
const crypto = require('crypto');
const { chromium } = require('playwright');
const { B, db, pool, login, signupApi, check, results, env } = require('./lib');

function encrypt(plain) {
  const k = env.PAYMONGO_ENC_KEY ? Buffer.from(env.PAYMONGO_ENC_KEY, 'base64url')
    : Buffer.from(crypto.hkdfSync('sha256', env.BETTER_AUTH_SECRET, 'playbook', 'venue-payment-secrets', 32));
  const iv = crypto.randomBytes(12); const c = crypto.createCipheriv('aes-256-gcm', k, iv);
  const data = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
}
const sign = (body, secret, t = Math.floor(Date.now() / 1000)) => `t=${t},te=${crypto.createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')},li=`;
const event = (id, bookingId, amount) => JSON.stringify({ data: { id, attributes: { type: 'checkout_session.payment.paid', livemode: false,
  data: { id: `cs_${id}`, attributes: { metadata: { booking_id: bookingId }, payments: [{ id: `pay_${id}`, attributes: { amount, status: 'paid' } }] } } } } });

(async () => {
  const b = await chromium.launch();
  const [A] = await db("SELECT id, slug FROM venue WHERE name='Alpha Pickle'");
  const [VB] = await db("SELECT id FROM venue WHERE name='Bravo Pickle'");
  const day = (await db("SELECT to_char((now() AT TIME ZONE 'Asia/Manila')::date + 2,'YYYY-MM-DD') d"))[0].d;
  const c0 = await b.newContext();
  for (const [n, e] of [['Quinn Holds', 'q-holds-qa@playbook.test'], ['Uma Unpaid', 'q-unpaid-qa@playbook.test']]) await signupApi(c0.request, n, e);
  const p2 = await login(b, 'q-holds-qa@playbook.test');
  const hold = async (page) => {
    await page.goto(`${B}/venues/${A.slug}?date=${day}`);
    await page.click('.slot-btn >> nth=0');
    // The server action answers with a redirect: to the booking page, or back here with ?error=.
    await page.waitForURL((u) => /\/bookings\/|error=/.test(String(u)), { timeout: 30000 });
    return page.url();
  };

  await check('Q1', 'A player can hold at most 3 slots at once', async () => {
    const urls = []; for (let i = 0; i < 4; i++) urls.push(await hold(p2.page));
    const [{ n }] = await db(`SELECT count(*)::int n FROM booking b JOIN "user" u ON u.id=b.user_id WHERE u.email='q-holds-qa@playbook.test' AND b.status='held'`);
    const refused = decodeURIComponent(urls[3]).includes('waiting for payment');
    return [n === 3 && refused, `held=${n}, 4th refused=${refused}`];
  });

  await check('Q2', 'A player can have at most 4 upcoming unpaid bookings per venue', async () => {
    const p1 = await login(b, 'q-unpaid-qa@playbook.test');
    const msgs = [];
    for (let i = 0; i < 5; i++) {
      const url = await hold(p1.page);
      if (!/\/bookings\//.test(url)) { msgs.push(decodeURIComponent(url)); break; }
      await p1.page.click('button:has-text("at the venue")');
      await p1.page.waitForSelector('.badge-ok:has-text("Confirmed")', { timeout: 30000 });
    }
    const [{ n }] = await db(`SELECT count(*)::int n FROM booking b JOIN "user" u ON u.id=b.user_id WHERE u.email='q-unpaid-qa@playbook.test' AND b.venue_id=$1 AND b.status='confirmed' AND b.paid_cents=0`, [A.id]);
    const refused = msgs.some((m) => m.includes('upcoming unpaid bookings'));
    return [n === 4 && refused, `unpaid=${n}, next refused=${refused}`];
  });

  // Webhook: give Alpha a test webhook secret and pay one of the holds from Q1.
  const secret = 'whsk_quality_test';
  await db("UPDATE venue SET paymongo_webhook_secret_enc=$2, paymongo_livemode=false WHERE id=$1", [A.id, encrypt(secret)]);
  const [held] = await db(`SELECT b.id, b.deposit_cents FROM booking b JOIN "user" u ON u.id=b.user_id WHERE u.email='q-holds-qa@playbook.test' AND b.status='held' LIMIT 1`);
  const url = `${B}/api/paymongo/webhook/${A.id}`;
  const post = (body, sig, to = url) => p2.ctx.request.post(to, { data: body, headers: { 'content-type': 'application/json', 'paymongo-signature': sig } });
  const evId = `evt_q_${Date.now()}`;
  const body = event(evId, held.id, held.deposit_cents);

  await check('Q3', 'Webhook rejects a bad signature', async () => {
    const r = await post(body, sign(body, 'wrong-secret'));
    const [s] = await db('SELECT status FROM booking WHERE id=$1', [held.id]);
    return [r.status() === 401 && s.status === 'held', `status ${r.status()}, booking ${s.status}`];
  });
  await check('Q4', 'Webhook rejects a replayed (10-minute-old) signature', async () => {
    const r = await post(body, sign(body, secret, Math.floor(Date.now() / 1000) - 600));
    return [r.status() === 401, `status ${r.status()}`];
  });
  await check('Q5', 'Valid webhook confirms the booking with the paid amount', async () => {
    const r = await post(body, sign(body, secret));
    const [s] = await db('SELECT status, paid_cents, pay_method FROM booking WHERE id=$1', [held.id]);
    return [r.status() === 200 && s.status === 'confirmed' && s.paid_cents === held.deposit_cents && s.pay_method === 'online', `${r.status()} ${JSON.stringify(s)}`];
  });
  await check('Q6', 'Duplicate delivery is acknowledged and not processed twice', async () => {
    const r = await post(body, sign(body, secret));
    const j = await r.json();
    const [{ n }] = await db('SELECT count(*)::int n FROM payment_event WHERE id=$1', [evId]);
    return [r.status() === 200 && j.duplicate === true && n === 1, `${r.status()} ${JSON.stringify(j)} rows=${n}`];
  });
  await check('Q7', "A venue's webhook cannot confirm another venue's booking", async () => {
    const [court] = await db("SELECT id FROM resource WHERE venue_id=$1 LIMIT 1", [VB.id]);
    await db("DELETE FROM booking WHERE venue_id=$1 AND customer_name='Quality test'", [VB.id]); // fixture from an earlier run
    const [other] = await db(`INSERT INTO booking (ref, venue_id, resource_id, customer_name, sport, date, start_min, end_min, status, hold_expires_at, price_cents)
      VALUES ($1,$2,$3,'Quality test','pickleball',$4,600,660,'held', now() + interval '10 minutes', 50000) RETURNING id`, [`PB-Q${Date.now() % 100000}`, VB.id, court.id, day]);
    const [before] = await db('SELECT status, paid_cents FROM booking WHERE id=$1', [other.id]);
    const ob = event(`evt_x_${Date.now()}`, other.id, 99900);
    const r = await post(ob, sign(ob, secret));
    const [after] = await db('SELECT status, paid_cents FROM booking WHERE id=$1', [other.id]);
    return [r.status() === 200 && after.paid_cents === before.paid_cents && after.status === before.status, `${r.status()} before=${JSON.stringify(before)} after=${JSON.stringify(after)}`];
  });
  await check('Q8', 'Unknown venue webhook URL returns 404', async () => {
    const r = await post(body, sign(body, secret), `${B}/api/paymongo/webhook/00000000-0000-0000-0000-000000000000`);
    return [r.status() === 404, `status ${r.status()}`];
  });
  await check('Q9', 'Security headers are sent', async () => {
    const r = await p2.ctx.request.get(`${B}/`);
    const h = r.headers();
    const ok = /frame-ancestors 'none'/.test(h['content-security-policy'] || '') && h['x-content-type-options'] === 'nosniff' && h['x-frame-options'] === 'DENY' && !h['x-powered-by'];
    return [ok, `csp=${h['content-security-policy']} xcto=${h['x-content-type-options']} xfo=${h['x-frame-options']} powered=${h['x-powered-by'] || 'none'}`];
  });

  await b.close(); await pool.end();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} quality checks passed.`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
