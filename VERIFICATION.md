# Release verification — 16 October 2026

## Current live release: remove shared-link access requirement

The workspace now opens directly without a key, account, or access cookie.
Expense and export APIs no longer require authentication; mutation validation,
same-origin checks, database RLS, server-only credentials, and revision checks remain.
Old key-bearing URLs are accepted and cleaned up. Sharing uses the plain address.

25 unit/database tests and 20 browser scenarios (Chromium and WebKit) passed.
TypeScript, lint, formatting, and the production build passed.
Tests used an isolated local database; no live expenses were changed.

The existing project had moved to `shipp1` (`team_dmjKIjsHfi7mlFucF2izF3wW`).
Verified its unchanged project ID, authenticated the deployment CLI using the
user's Brave account, and deployed this workspace without a Git commit or push.
Deployment `dpl_AQiZUe9ybMSK2KyhR6r8a2iyHzi4` is READY and was promoted.
The production alias `expenses-gamma-seven.vercel.app` was verified to point to it.

Fresh Chromium and WebKit browsers passed live read-only checks for direct opening,
database reads, plain-link sharing to a fresh browser, reload, and old key-bearing
URLs. Neither browser required an access exchange or login. Expense and CSV APIs
returned 200 without cookies. No runtime error logs were found. No live expense
records or database permissions were changed. Physical iPhone testing remains with
the user; WebKit automation is not a physical iPhone test.

## Previous live release

- **Production:** https://expenses-gamma-seven.vercel.app
- **Vercel:** Rana's projects / expenses; current deployment `dpl_6kYypHo5pY7P9tujzTdev5kLMyGN`, READY.
- **Database:** dedicated Supabase project `expenses`, ref `zmilfhtgmpvxxpueynlc`, Frankfurt.
- **Migration:** `20261016180835_create_family_expenses`, applied; local filename matches remote ledger.
- **Source:** manual deployment of this workspace; no Git commit or push was made.
- **Secrets:** server variables configured as sensitive, private link and local credentials excluded from Git and deployment uploads.

## iPhone link-sharing fix

The initial implementation removed the secret fragment after unlocking. Copying
that shortened address could leave another phone locked. It also did not handle
opening a key-bearing fragment in an already-open locked tab.

The updated client preserves the complete bookmarkable link, supports hash-change
navigation, adds native sharing with copy/manual fallback, and provides a paste-link
form on the locked screen. If an exchange succeeds but the browser does not retain
its cookie, the page gives a specific recovery message. Locking removes both the
cookie and the key-bearing address. Database schema and access rules are unchanged.

31 unit/database tests and 20 browser scenarios (10 each in Chromium and WebKit)
passed, together with lint, TypeScript, formatting, and the production build.
The cookie assertion checks the actual SameSite=Strict response header because
the Windows WebKit driver reports a different cookie enum on the local HTTP harness.

After release, live read-only checks passed in both engines for paste recovery,
sharing to a fresh browser, reload, same-page fragment navigation, and a real
authorized database read. No expense records were added, edited, or deleted.
No error logs were returned for this deployment. Physical iPhone/WhatsApp behavior
still requires the user to reopen the full family link on their device.

## Initial release checks

28 unit/database tests and 7 Playwright browser scenarios passed. TypeScript,
ESLint, Prettier, the Next.js production build, and dependency audit passed.
Layouts were inspected at phone and desktop sizes, with no horizontal overflow
at 320px. Database tests execute the real PostgreSQL migration using PGlite;
browser tests use the actual Next.js app and Supabase SDK with a local contract harness.

## Initial hosted verification

The staged production build passed a real Supabase read after exchanging the
shared key for its Secure cookie. The production domain was assigned to that
verified deployment. Deployment Protection remains enabled on generated URLs;
the family uses the project's production domain.

Two unauthenticated browser contexts were opened with the original family link,
one in Cairo and one in America/Los_Angeles. Verified:

- No records available without the app's cookie; no Vercel login needed on the production domain.
- Real expense creation, edit from the second device, refresh on the first, and deletion.
- Correct Cairo expense date on the overseas device.
- Saved access and records remain after reloading.
- CSV includes the actual saved amount and description.
- Session is `__Host-`, Secure, HttpOnly, and SameSite=Strict.
- Secret fragment removed from the address; no preview banner or seeded records.
- No browser script errors. No error logs returned for the verified deployment.

The temporary test expense was deleted and a final SQL count returned **0**.
Supabase verified RLS enabled, no anonymous/authenticated table reads, and no
anonymous listing function execution. Its only security advisor result was the
expected informational [RLS enabled with no policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
finding for the deliberate server-only access model.

The original sharing URL is intentionally absent from this tracked document.
Use `.private/shared-link.txt` and share it only with people who should manage the ledger.
