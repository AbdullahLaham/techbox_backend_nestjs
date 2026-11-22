# Deploying the API on Railway

How the backend runs on Railway. The first deployment is a temporary trial account; the same steps work on the official account later. Nothing here depends on GitHub or on a Railway config file: Railway's `railway.json` / `railway.toml` stop being read on 2026-12-01, so the settings below live in the service settings, and the commands live in `package.json`.

## What the server runs

| Step | Command | Where it comes from |
|------|---------|---------------------|
| Install | `npm ci` | Railway (Railpack) default |
| Build | `npm run build` = `prisma generate && nest build` | Railway default (runs the `build` script) |
| Start | `npm run start:deploy` = `prisma migrate deploy && node dist/main` | **Set it**: service → Settings → Deploy → Custom Start Command |
| Health check | `GET /health` (200 when the database answers) | **Set it**: service → Settings → Deploy → Healthcheck Path |

Node 24 comes from `engines` in `package.json`. Migrations run at every start; `migrate deploy` only applies new ones and is safe to repeat. Run a single instance (rate limits are in memory and files are on the volume).

## One-time setup

1. **Project and database:** create a project, add **PostgreSQL**.
2. **API service:** from the backend folder, `railway link` to the project, then `railway up`. The upload skips everything in `.gitignore` (`.env`, `node_modules`, `storage/`, `uploads/`).
3. **Volume for files:** on the API service, attach a volume with mount path `/data`.
4. **Settings:** the start command and health check path from the table above. Generate a public domain (Settings → Networking).
5. **Variables** on the API service:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference to the database service) |
| `JWT_ACCESS_SECRET`, `COOKIE_SECRET`, `STORAGE_SIGNING_SECRET` | three different random values: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `PUBLIC_API_URL` | `https://${{RAILWAY_PUBLIC_DOMAIN}}` |
| `CORS_ORIGINS` | the dashboard's address (for example its Vercel URL); comma-separated if several |
| `TRUST_PROXY` | `1` |
| `STORAGE_LOCAL_DIR` | `/data/storage` |

The server refuses to start if a required value is missing or a secret is shorter than 24 characters (`src/config/env.validation.ts`); the deploy log names the missing variable.

## First accounts

The seed scripts run from a developer machine against the database's **public** address (Postgres service → Connect → Public network). Use a strong owner password and don't paste it in chats:

```bash
DATABASE_URL="<public postgres url>" SEED_OWNER_EMAIL="..." SEED_OWNER_PASSWORD="..." npm run seed
DATABASE_URL="<public postgres url>" npm run seed:english-levels   # optional
```

## Checks after each deploy

- `https://<domain>/health` returns `{"status":"ok","database":"ok"}`.
- The deploy log shows `No pending migrations to apply.` or the migrations it applied, then `Nest application successfully started`.
- Sign in from the dashboard or the app.

## Updating

Commit, then `railway up` again from the backend folder. The database and the volume are kept. A service with a volume restarts in place, so expect a short interruption: don't deploy during a demo. Roll back from the service's Deployments list.

## Moving to another account later

1. Put the old service in maintenance (or stop it) so nothing changes during the copy.
2. Database: `pg_dump --no-owner --format=custom "<old public url>" > techbox.dump`, then `pg_restore --no-owner --dbname "<new public url>" techbox.dump`.
3. Files: copy everything under `/data/storage` from the old volume to the new one (for example `railway ssh` and `tar`).
4. Set up the new service as above. Keep `STORAGE_SIGNING_SECRET` only if links already sent out should keep working. Point the dashboard (`NEXT_PUBLIC_API_URL`) and the app (`EXPO_PUBLIC_API_URL`, new build) at the new address.

## Trial limits (temporary account)

- 30 days or $5 of usage, whichever ends first; then the services stop.
- About 0.5 GB of RAM per service and 0.5 GB of volume storage.
- No real backups: not for real learners' data.
