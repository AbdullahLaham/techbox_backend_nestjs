# TechBox Incubator: backend API

NestJS + Prisma + PostgreSQL API for the TechBox learning and incubator platform. It serves two clients:

| Client | Repository | Uses |
|--------|------------|------|
| Web app (admin dashboard + learner pages, Next.js) | `techbox_dashboard_app` | `api-contract-admin.md` |
| Learner mobile app (Expo) | `techbox_expo_app` | `api-contract-mobile.md` |

## Features

| Area | What it does |
|------|--------------|
| Auth | Register, login, single-use refresh tokens, logout; roles `SUPER_ADMIN`, `INCUBATOR_MANAGER`, `INSTRUCTOR`, `MENTOR`, `STUDENT`, `GUEST` |
| Programs | Programs in any status, seats, cohort dates, tracks → modules → lessons, Arabic slugs |
| Enrollments | Applications with payment receipt, admin review (accept/reject/suspend/complete with a note), seat checks |
| Lessons | Video (Bunny link), reading material (link or uploaded file), quiz lessons; lesson progress and resume |
| Quizzes | 4-option questions, publishing checks, automatic grading, attempt limits; correct answers never sent before an attempt |
| Assignments | Draft/publish/archive, instruction files, student hand-in (files, links, text), grading with feedback |
| Progress | Live program progress from completed mandatory lessons |
| Notifications | In-app notifications for grading, enrollment decisions and new assignments |
| Files | Private storage behind short-lived signed links (`StorageService`; local disk today) |

## Requirements

- Node.js 24
- PostgreSQL 15 or newer

## Setup

```bash
npm install
cp .env.example .env          # then fill in the secrets (see the comments in the file)
npx prisma migrate deploy     # create / update the database schema
npm run seed                  # first owner (and manager) accounts, passwords from .env
npm run start:dev             # http://localhost:5000
```

The server refuses to start when `JWT_ACCESS_SECRET` or `COOKIE_SECRET` is missing or shorter than 24 characters. In production (`NODE_ENV=production`) it also requires `STORAGE_SIGNING_SECRET`, `PUBLIC_API_URL` and `CORS_ORIGINS` (`src/config/env.validation.ts`).

Generate a secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

### First accounts

There is no public way to register as staff. `npm run seed` creates the system owner (`SUPER_ADMIN`) and optionally an incubator manager from `SEED_OWNER_*` / `SEED_MANAGER_*` in `.env`. Re-running keeps existing passwords unless `SEED_RESET_PASSWORDS=true`.

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run start:dev` | Development server with reload |
| `npm run build` / `npm run start:prod` | Production build / run `dist/main` |
| `npm run lint` | oxlint |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end tests against a real database (see below) |
| `npm run seed` | First admin accounts |
| `npx prisma migrate dev --name <change>` | New migration after editing `prisma/schema.prisma` |
| `npx tsx scripts/migrate-legacy-receipts.ts` | One-off: move pre-storage receipts out of `uploads/` |

## Tests

End-to-end suites **wipe the database they run on**, so they only run when the database name ends with `_test`:

```bash
createdb incubator_lms_test                     # once
export DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/incubator_lms_test
npx prisma migrate deploy
npm run test:e2e
```

CI (`.github/workflows/ci.yml`) runs lint, build, unit and end-to-end tests on every push and pull request, with a PostgreSQL service.

## Project structure

```
src/
  auth/           login, refresh tokens, JWT strategy, roles guard
  programs/       public catalog/detail, admin programs and curriculum
  enrollments/    applications, admin review
  nodes/          lessons (video, reading, quiz) and lesson progress
  quizzes/        quiz editing, attempts, grading
  assignments/    assignment management, student list/detail
  submissions/    hand-ins and grading
  progress/       program progress (global service)
  notifications/  in-app notifications (global service)
  storage/        StorageService, local signed-link implementation
  common/         error model, uploads checks, rate limits, DTO helpers
  config/         environment validation
  types/          API contracts shared with the clients (*.contract.ts)
prisma/           schema, migrations, seed
test/             end-to-end suites
docs/updates/     one note per update (what changed and why)
```

## API documentation

| Document | Content |
|----------|---------|
| `api-contract-admin.md` | Every endpoint the web app uses (admin + learner pages) |
| `api-contract-mobile.md` | Every endpoint the mobile app uses |
| `src/types/*.contract.ts` | Exact TypeScript types; copied unchanged into both clients |
| `BUILD_SUMMARY_DASHBOARD.md`, `BUILD_SUMMARY_MOBILE.md` | What each client already uses and what is left |
| `docs/updates/` | Change notes per update |
| `ASSIGNMENTS_SPEC.md` | Assignments feature specification |

All `/v1` routes return errors as `{ statusCode, code, message, details? }`; codes and Arabic messages are in `src/types/api.contract.ts`.

## Security

- No fallback secrets; startup validation of the environment.
- `helmet` security headers; CORS allow list in production.
- Rate limits on login (per email and per IP), register and refresh; upload rate limits.
- Uploaded files are type-checked by content, stored privately and served through signed, expiring links.
- Behind a reverse proxy set `TRUST_PROXY=1` so rate limits see client IPs. The rate limiter is in memory: use Redis before running several instances.

## Production checklist

- `NODE_ENV=production`, fresh random secrets, `CORS_ORIGINS`, `PUBLIC_API_URL`, `STORAGE_SIGNING_SECRET`, `TRUST_PROXY`.
- `npx prisma migrate deploy` on every release, `npm run seed` once.
- Persistent storage for `STORAGE_LOCAL_DIR`, or switch `StorageService` to Bunny Storage / S3.
