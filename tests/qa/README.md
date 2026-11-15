# QA suite (end-to-end, against a running server)

Covers auth, role permissions, tenant isolation, privilege escalation (forged
server-action posts with tampered ids), booking workflows, validation and
phone-width layout. Every check asserts on database state and the server's
answer, not on what the UI hides.

1. Start the app on port 3100 with `.env.local` (dev database), logging to a file:
   `npm run build && npx next start -p 3100 > server.log 2>&1 &`
2. Seed two QA venues and one user per role (`*@playbook.test`):
   `node tests/qa/seed.js` (writes `seed.json`)
3. Run: `node tests/qa/quality.js` (hold limits, webhooks, headers), then `QA_SERVER_LOG=server.log node tests/qa/qa.js`
   (qa.js changes player2's password in its reset test, so run quality.js first or re-seed).
4. Clean up QA data afterwards (only `@playbook.test` users and their venues).

`PLATFORM_ADMIN_EMAILS` must include `admin-test@playbook.test` for the QA admin.
Point `.env.local` at the Neon `dev` branch, never at `main` (production).
