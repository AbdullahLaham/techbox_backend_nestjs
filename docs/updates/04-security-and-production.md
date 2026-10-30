# Update 04: Security and production readiness

Date: 2026-10-30 · Backend branch `feature/assignments`

## Problems found in the project review

| # | Problem | Risk |
|---|---------|------|
| 1 | `JWT_ACCESS_SECRET` fell back to a hard-coded string (`auth.module.ts`, `jwt.strategy.ts`); `COOKIE_SECRET` fell back to `'cookie-secret'` | A server started without the variable signs tokens with a public secret: anyone could forge an admin token |
| 2 | No way to create the first admin (`prisma/seed.ts` was outdated; the new draft had the password in the code and printed it) | Fresh databases have no admin; a password in git works on every seeded server |
| 3 | 9 known vulnerabilities in runtime dependencies (7 high): multer, body-parser, qs, prisma | Upload and request parsing are exposed to the internet |
| 4 | No rate limit on `/auth/login`, no security headers, CORS open to every origin with credentials | Password brute force; clickjacking/MIME sniffing; any site can call the API with a user's cookies |
| 5 | `main.ts` ignored `PORT` (always 5000) while `.env` said 3000 | Confusing configuration; cannot set the port in production |

## What changed

### 1. Startup validation (`src/config/env.validation.ts`)

The server refuses to start, listing the variable names (never values), when:

| Variable | Rule |
|----------|------|
| `DATABASE_URL` | Required |
| `JWT_ACCESS_SECRET`, `COOKIE_SECRET` | Required, at least 24 characters |
| `STORAGE_SIGNING_SECRET` (≥ 24), `PUBLIC_API_URL`, `CORS_ORIGINS` | Required when `NODE_ENV=production` |
| `PORT` | A valid port if set |

The hard-coded fallbacks are removed (`configService.getOrThrow`).

### 2. First accounts: `npm run seed`

`prisma/seed.ts` (your draft, kept with the same two accounts) now reads everything from `.env`:

| Variable | Meaning |
|----------|---------|
| `SEED_OWNER_EMAIL` | Default `abed@techbox.com` (SUPER_ADMIN) |
| `SEED_OWNER_PASSWORD` | **Required**, at least 12 characters |
| `SEED_MANAGER_EMAIL` | Default `admin@techbox.com` (INCUBATOR_MANAGER) |
| `SEED_MANAGER_PASSWORD` | Optional; without it the manager is skipped |
| `SEED_RESET_PASSWORDS` | `true` = also replace passwords of existing accounts |

- Safe to run again: an existing account keeps its password; its role and `ACTIVE` status are restored (recovers a locked-out owner).
- Passwords are never printed or stored in code.
- `prisma.config.ts` now runs it with `tsx` (the old `ts-node` command was not installed); `package.json` gains `"seed": "prisma db seed"`.

### 3. Dependencies

| Package | Before | After |
|---------|--------|-------|
| `@nestjs/core`, `common`, `platform-express`, `testing` | 12.0.3 | 12.3.2 (brings multer 2.5.0, body-parser 2.4.0, qs 6.17.1) |
| `prisma`, `@prisma/client`, `adapter-pg`, `config` | 7.10.0 | 7.10.1 |
| `helmet` | | 8.3.0 (new) |

Runtime vulnerabilities: 9 → 0 in the server's own code paths. Two remain in development tooling only (`fast-uri` in the Nest CLI, `source-map-js` in Vitest/Vite), not shipped with the server.

`node_modules` was reinstalled with `npm ci`: an interrupted `npm audit fix` had left newer Vite/Rolldown versions than the lockfile, which broke Vitest.

### 4. HTTP hardening (`src/app.setup.ts`, `src/common/rate-limit.ts`)

| Measure | Detail |
|---------|--------|
| Security headers | `helmet` (nosniff, frame options, HSTS, no `X-Powered-By`, …). Cross-origin resource reads stay allowed so the dashboard can show receipts and files |
| Login rate limit | 10 tries per email + 30 per IP per 15 min; register 10 per IP per hour; refresh 60 per IP per 15 min. `429 { code: "TOO_MANY_REQUESTS", retryAfterSec }` + `Retry-After` |
| CORS | Production: only `CORS_ORIGINS` (comma-separated). Development: any origin, with a warning, unless `CORS_ORIGINS` is set. Native apps send no Origin and are unaffected |
| Proxy | `TRUST_PROXY=1` behind nginx/a PaaS so limits see the client IP |
| Port | `PORT` is read (default 5000); `.env` now says `PORT=5000` to match the apps |

The rate limiter is in memory (per server process). With several instances, move it to Redis.

### 5. `.env.example`

New, committed: every variable with comments and no real values, for setting up another machine or server.

## Files

| File | Change |
|------|--------|
| `src/config/env.validation.ts` (+ `.spec.ts`) | **New** startup validation (5 unit tests) |
| `src/common/rate-limit.ts` | **New** `RateLimitGuard`, `@RateLimit()`, `AUTH_RATE_RULES` |
| `src/auth/auth.controller.ts` | Rate limits on register, login, refresh |
| `src/auth/auth.module.ts`, `strategies/jwt.strategy.ts` | No fallback secret |
| `src/app.module.ts` | `ConfigModule.forRoot({ validate: validateEnv })` |
| `src/app.setup.ts` | helmet, CORS allow list, cookie secret, trust proxy |
| `src/main.ts` | Reads `PORT` |
| `prisma/seed.ts`, `prisma.config.ts`, `package.json` | Seed from `.env`, `npm run seed` |
| `.env.example` | **New** |
| `test/security.e2e-spec.ts` | **New**: headers, per-email and per-IP login limits |
| `api-contract-mobile.md`, `api-contract-admin.md` | Rate limits on auth, how admins are created |

## Action needed

1. **Your `.env`**: `PORT` was changed to `5000` (what the apps use). Add, then run `npm run seed` once:
   ```
   SEED_OWNER_PASSWORD=<at least 12 characters>
   SEED_MANAGER_PASSWORD=<at least 12 characters>   # optional
   ```
   If you already created `abed@techbox.com` with the old seed (password `abed12345`), run with `SEED_RESET_PASSWORDS=true` once to replace it.
2. Your `.env` has `JWT_REFRESH_EXPIRATION`; the code reads `JWT_REFRESH_EXPIRATION_DAYS` (default 30 days). Rename it if you want another value.
3. **Production `.env`**: `NODE_ENV=production`, `CORS_ORIGINS=<dashboard URL>`, `PUBLIC_API_URL`, `STORAGE_SIGNING_SECRET`, `TRUST_PROXY=1` behind a proxy, fresh random secrets (not the development ones).
4. **Restart the dev server**: dependencies were reinstalled while it was running.

## Verification

- Unit tests 6/6 (5 new), end-to-end 55/55 (3 new), build and typecheck pass, lint unchanged (one older warning).
- Seed checked on the test database: refuses missing/short passwords, creates both accounts, re-run keeps passwords, nothing printed.
