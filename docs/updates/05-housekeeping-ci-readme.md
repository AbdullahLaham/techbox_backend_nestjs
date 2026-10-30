# Update 05: Client check, CI, READMEs, merge and GitHub

Date: 2026-10-30

## 1. Do the security changes (update 04) need client changes?

No. Checked in both apps:

| Change | Web app | Mobile app |
|--------|---------|------------|
| `429` on login/register | `lib/api-error.ts` shows the contract's Arabic message for `TOO_MANY_REQUESTS` | `src/api/errors.ts` (used by the auth store) does the same |
| `429` on refresh | Session ends only on 400/401, so a limited refresh does not sign out | Same |
| `helmet` headers | The two `<iframe>`s embed Bunny videos, not API files; images/downloads from the API are allowed cross-origin (`Cross-Origin-Resource-Policy: cross-origin`) | Files open with `Linking`; unaffected |
| CORS | Development: every origin allowed. **Production: put the web app URL in the backend's `CORS_ORIGINS`** | Native apps send no Origin |
| `PORT` | Still 5000 | Still 5000 |

Optional improvement in both: show the wait time from `retryAfterSec` on a 429.

## 2. Client work committed

| Repo | Commit | Content |
|------|--------|---------|
| Mobile | `733f89f` | Lesson progress (video position and resume, reading done, completion card), lesson ticks, home progress, notifications tab with badge |
| Web | (this update) | Lesson view progress, notification bell, learner progress in admin enrollments |

Both typecheck; the web app lints and builds cleanly.

## 3. CI (GitHub Actions)

| Repo | Workflow | Steps |
|------|----------|-------|
| Backend | `.github/workflows/ci.yml` | PostgreSQL 17 service (`incubator_lms_test`), `npm ci`, Prisma generate + migrate deploy, lint, build, unit tests, end-to-end tests. Test-only secrets in the workflow |
| Web | `.github/workflows/ci.yml` | `npm ci`, typecheck, lint, build |
| Mobile | `.github/workflows/ci.yml` | `npm ci`, typecheck (blocking), lint (reported but not blocking: 18 known findings in older screens from the React Hooks rules) |

All run on every push and pull request, Node 24.

## 4. READMEs

The three framework templates were replaced with project READMEs: purpose, setup (env, migrations, seed), scripts, tests, structure, API contracts, auth, and (backend) security and a production checklist. The mobile README uses `.env.local` because that repository only ignores `.env*.local`.

## 5. Build summaries

`BUILD_SUMMARY_DASHBOARD.md` and `BUILD_SUMMARY_MOBILE.md` now list progress and notifications as built. Left: mocked overviews (need `/v1/dashboard/*`), pages waiting for backend features (users, startups, certificates, settings, push notifications), and small improvements.

## 6. Branches and GitHub

| Repo | Remote | Change |
|------|--------|--------|
| Backend | `AbdullahLaham/techbox_backend_nestjs` | `feature/assignments` merged into `main` |
| Web | `AbdullahLaham/techbox_dashboard_app` (new, was empty) | Remote added; `feature/lms-platform` merged into `master`; both pushed |
| Mobile | `AbdullahLaham/techbox_expo_app` | `feature/lms-platform` merged into `main` |

Merges are fast-forward (no merge commits); the feature branches are kept.

## Known follow-ups

- Mobile lint findings (then make lint blocking in CI).
- Two dev-only audit findings in the backend (`fast-uri`, `source-map-js`).
- The rate limiter is per process (Redis before running several instances).
