# End-to-End Browser Tests (Playwright)

A full browser smoke suite that exercises every functional area of the app against a
real Next.js server and a real PostgreSQL database. It runs in CI on every push/PR
(the `e2e` job in `.github/workflows/ci.yml`) and is the authoritative regression gate.

## Keep this suite up to date — required

**Every new feature or bug fix must add or update an E2E spec here.** A change that
alters user-facing behavior without a corresponding spec change is incomplete. When you:

- add a page/flow → add a spec (or a `test()` to the closest existing file);
- change a selector, label, or route → update the affected spec;
- fix a bug → add a spec that would have caught it.

CI fails if the suite fails, so coverage only protects us if it tracks the app.

## Layout

| File | Covers |
|------|--------|
| `global-setup.js` | Truncates the DB to a clean migrated state before the run |
| `00-setup-wizard.spec.js` | First-run wizard (creates the admin every other spec depends on) |
| `auth.setup.js` | Logs in once, saves `playwright/.auth/admin.json` storage state |
| `fixtures.js` | Extends `test` with `cspViolations` / `consoleErrors` capture |
| `constants.js` | Shared admin credentials + auth-state path |
| `dashboard.spec.js` | Stat cards, charts, sidebar navigation |
| `customers.spec.js` | Customer list + full CRUD lifecycle, tabs, services, notes |
| `partners.spec.js` | Partner list + full CRUD lifecycle (flat layout) |
| `admin.spec.js` | Users (invite/actions), service catalog, settings, audit log |
| `profile.spec.js` | Account info, name/password forms, strength indicator |
| `search.spec.js` | Spotlight search (seeds via API, searches via UI) |
| `theme-i18n.spec.js` | Light/dark toggle, Arabic RTL ↔ English LTR |
| `csp.spec.js` | No Content-Security-Policy violations across all pages |
| `api.spec.js` | `/api/health`, auth-endpoint rate limiting (429) |
| `import.spec.js` | CSV import: customers happy path (upload/map/preview/commit), error row blocks commit, services tab (type select + customer resolution) |
| `forgot-password.spec.js` | Email reset flow: request form generic success, reset form with invalid/missing token, login-page link hidden when SMTP unconfigured |
| `session-invalidation.spec.js` | Password change revokes existing JWT sessions (old token rejected with 401); login-page "sign in again" notice |
| `mobile.spec.js` | Mobile viewport: bottom tabs, sidebar hidden |

## Project flow

Playwright projects run in order with dependencies:
`setup` (wizard) → `auth` (storage state) → `chromium` (everything else, authenticated).

## Running locally

Requires a Postgres reachable via `DATABASE_URL` (see `.env`) with migrations applied:

```bash
npm run db:migrate          # once, to create the schema
npm run test:e2e            # starts the dev server automatically and runs the suite
npm run test:e2e -- --ui    # interactive mode
npx playwright test customers.spec.js   # a single file
```

The dev server is reused if already running. Because the app caches settings in-process
for 30s, `global-setup` waits for the server to observe the DB reset before the wizard
spec runs — so a full local re-run within 30s of a previous one is safe (it just waits).

## CI

The `e2e` job builds the app, starts the production server on port 3000
(`npm run start:e2e`), installs the Chromium browser, and runs the suite against a
fresh Postgres service container. The HTML report is uploaded as an artifact.

## Selector conventions

Prefer user-facing selectors (`getByRole`, `getByLabel`, `getByText`, `getByPlaceholder`)
and stable element `id`s. Add a `data-testid` only when there is no accessible handle
(e.g. the dashboard `stat-card`). Avoid asserting on translated copy where an `id` or
role is available, so the suite survives i18n changes.
