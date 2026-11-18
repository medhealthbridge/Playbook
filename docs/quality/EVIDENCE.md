# Evidence register

One entry per check. Times are Asia/Manila. Full output lives in `docs/quality/evidence/`.
Entries go stale when the code, schema, configuration or environment they cover changes.

## 2026-11-18 — quality pass on the 2026-11-17/18 changes (T3)

Candidate: working tree on `claude/intelligent-hypatia-31h4zi` after 4b0bec5, plus the fixes listed below.
Environment: local production build (`next build` + `next start -p 3100`), `.env.local` → Neon `dev` branch
(endpoint verified as `br-polished-dew-b3tjm0yu`, not production), no email provider (matches production).

| Check | Command / procedure | Result | State | Output |
|---|---|---|---|---|
| Lint + types | `npm run lint` (eslint + tsc) | exit 0; 0 errors, 1 known warning (Cinematic.tsx hook deps) | VERIFIED | evidence/2026-11-18-lint.log |
| Unit (engine) | `npm test` | 27/27 | VERIFIED | evidence/2026-11-18-unit.log |
| Dependency audit | `npm audit --omit=dev` | 0 vulnerabilities | VERIFIED | evidence/2026-11-18-audit.log |
| Secret scan | regex scan of this session's diff + tracked files | no secrets; 3 hits are input placeholders / key-prefix check | VERIFIED (pattern scan only) | evidence/2026-11-18-secrets.log |
| Seed + T-AUTH-ADMIN-01 | `node tests/qa/seed.js` | PASS: unconfirmed form sign-up of a listed admin email gets role "user" | VERIFIED | evidence/2026-11-18-seed.log |
| Holds, webhooks, headers | `node tests/qa/quality.js` | 9/9 | VERIFIED | evidence/2026-11-18-quality.log |
| Auth, permissions, isolation, escalation, workflows | `node tests/qa/qa.js` | 38/38 | VERIFIED | evidence/2026-11-18-qa.log, evidence/2026-11-18-qa-results.json |
| Business model (cut, statements, pause, open play) | `node tests/qa/model.js` | 19/19 | VERIFIED | evidence/2026-11-18-model.log |
| Accessibility (axe, WCAG 2.2 AA rules) | axe-core on /login, /signup, / (reduced motion), dark + light | 2 issues found on /, fixed; rerun 0 violations | VERIFIED (automated only) | evidence/2026-11-18-axe.log |
| Static cache privacy | Playwright: signed-in player, list `pb-static-v1` entries | 72 entries, all /assets or /_next/static; no pages or API responses | VERIFIED | (console output in session) |

### Findings and fixes

| ID | Severity | Finding | Fix | Regression check |
|---|---|---|---|---|
| F-2026-11-18-1 | Critical | Production has no email provider, so form sign-ups are unconfirmed. Any address in PLATFORM_ADMIN_EMAILS that is not yet registered (the owner's is not) could be claimed through the sign-up form and become platform admin. | Admin by email only when proven: provider-verified (Google/Apple) or form sign-up with email confirmation on (`src/lib/server/auth.ts`). | T-AUTH-ADMIN-01 in `tests/qa/seed.js` |
| F-2026-11-18-2 | High (open) | Production holds test accounts created on request, including `admin@playbook.test` with platform-admin rights; its password was shared in chat. | Needs the owner's decision: delete the test accounts or change their passwords. | — |
| F-2026-11-18-3 | Low | Service-worker cache would grow without bound across deploys (hashed build files). | Cap at 250 entries, oldest evicted (`public/sw.js`). | — |
| F-2026-11-18-4 | Medium | Homepage example cards: avatar row and chip groups carried aria-label on plain divs; "taken" chips failed contrast. | role="img"/role="group"; taken chips 0.6 opacity + dashed outline. | axe rerun |
| F-2026-11-18-5 | Low | QA seed wrote seed.json to the current folder; suites read it from tests/qa. | Seed writes beside itself. | qa.js run |

Reviewed and not a finding: Google/Apple account linking cannot attach to an unconfirmed local account
(Better Auth `requireLocalEmailVerified` defaults to true; the redirect error becomes `account_not_linked`,
which the sign-in page explains). `/assets` holds only build-time files, so the static cache never stores user data.

Not verified this pass: real Google/Facebook/Apple sign-in (no provider keys yet); 3D frame rate on real low-end
phones (software rendering only here); screen-reader walkthrough; load test of booking endpoints (unchanged since
the last pass). QA data (`@playbook.test`) left on the `dev` branch for re-runs.

### Deployed

Commit 9395a00 deployed to production (playbook.databridgesol.space), deployment dpl_CqkDX6DtpeEpQHsHWp1Uhre88yYb.
Observed live: new service worker served; `/`, `/login` 200; `/signup` loaded 4/4 in a real browser at human pace
with the consent box present. Rapid scripted curl bursts from the cloud container were intermittently answered
403 with `x-vercel-mitigated: deny` (Vercel's default platform protection; the project has no custom firewall rules).
Not exercised live: the admin rule itself (testing it would mean registering the owner's address).
