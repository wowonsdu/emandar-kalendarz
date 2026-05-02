# Emandar Production Migration

This repo is now a pnpm/Turbo monorepo:

- `apps/web` - existing Vite React app, preserved visually and routed under `/emandar/`.
- `apps/api` - Fastify API for `/emandar/api`, backed by PostgreSQL through Drizzle migrations.
- `packages/shared` - Zod boundary contracts and shared role/capability helpers.

## Local Commands

```bash
pnpm install
pnpm dev
pnpm test
pnpm build
```

The web dev server proxies `/emandar/api` and `/api` to `http://127.0.0.1:4174`.

For local API work without PostgreSQL:

```bash
EMANDAR_USE_MEMORY_STORE=true pnpm --filter @emandar/api dev
```

For PostgreSQL:

```bash
DATABASE_URL=postgres://emandar_prod:change-me@127.0.0.1:5432/emandar_prod pnpm --filter @emandar/api db:migrate
DATABASE_URL=postgres://emandar_prod:change-me@127.0.0.1:5432/emandar_prod pnpm --filter @emandar/api db:seed
```

The seed source is `seed-data/seed-store.json`. The production seed importer filters it to admin plus visible trainer profiles/users only. It does not import organizers, participants, groups, events, relations, enrollments, rosters, or notifications. Use `pnpm --filter @emandar/api db:seed -- --full-demo` only for a disposable demo database.

Production SMS auth requires `SMSAPI_TOKEN` and optionally `SMSAPI_FROM`. Keep `SMSAPI_TEST_MODE=true` for smoke environments; real launch requires `SMSAPI_TEST_MODE=false` only after sender, billing, and a real-send smoke are verified.

Required production API env:

- `DATABASE_URL`
- `SESSION_SECRET`
- `SESSION_TTL_SECONDS` (optional, defaults to 30 days)
- `CORS_ALLOWED_ORIGINS=https://panel.ceo`
- `ALLOW_LEGACY_STORE_API=false`
- `SMSAPI_TEST_MODE=true` until the final SMS release gate; `false` for real launch
- `UPLOAD_STORAGE_PATH=/opt/panel.ceo/emandar-data/uploads`
- `UPLOADS_PUBLIC_PATH=/emandar/uploads`

`SMSAPI_TOKEN` and `SMSAPI_FROM` should be present only when preparing the final real-SMS gate. Until then the API records `notification_deliveries` for demo/test sends and returns the test code to the client only while `SMSAPI_TEST_MODE=true`.

Operational hardening now depends on these tables from `apps/api/migrations/0001_initial.sql`:

- `auth_sessions` for persistent cookie sessions with TTL.
- `sms_challenges` and `sms_request_attempts` for SMS challenge storage, request rate limiting and wrong-code attempt limiting.
- `registration_tokens` for one-time participant registration after SMS verification.
- `uploads` for upload owner, purpose, content type, byte size and storage metadata.
- `audit_log` for API mutation audit records.
- `notification_deliveries` for demo/test SMS delivery records.
- `signed_action_tokens` for one-use attendance confirmation and community event review links.

Cookie-based mutations require `GET /emandar/api/auth/csrf` first and must send `x-emandar-csrf` with the returned token. The frontend API client handles this automatically.

## Production Shape

- Web files: `/opt/panel.ceo/emandar`
- API runtime: Docker/Caddy deployment is the current supported production shape. The historical systemd/Nginx files under `deploy/` remain reference templates for manual recovery or non-container installs.
- Runtime data/uploads: `/opt/panel.ceo/emandar-data`
- API local port: `127.0.0.1:4174`
- Public URLs:
  - `https://panel.ceo/emandar/`
  - `https://panel.ceo/emandar/api/health`

Before replacing live files, create timestamped backups of:

- `/opt/panel.ceo/emandar`
- PostgreSQL database: `pg_dump --format=custom --file=/opt/panel.ceo/emandar-backup-YYYYMMDD-HHMMSS.dump "$DATABASE_URL"`
- Upload directory: `/opt/panel.ceo/emandar-data/uploads`
- `/opt/panel.ceo/emandar-data/runtime-store.json` if it still exists from the mock era

Run `pg_dump` and upload backup before applying migrations because the release writes new auth/session/upload/audit rows during normal smoke tests.

Deploy static web build from `apps/web/dist/`. Deploy the API image/build plus root workspace files needed for production install, copy `seed-data/seed-store.json` to the API runtime, then run migrations and seed import when needed.

Use `deploy/emandar-api.env.example` as the env reference. `deploy/emandar-api.service` and `deploy/nginx-emandar.conf.example` are legacy/reference templates, not the default deployment path. For any proxy change, inspect the active Caddy/proxy config first, back it up, validate it, reload only after validation, and verify the target route plus a neighboring route.

Rollback order:

1. Stop or roll back the API container/service if the API is unhealthy.
2. Restore `/opt/panel.ceo/emandar` from the timestamped web backup.
3. Restore uploads from the timestamped upload backup if file writes were part of the failed release.
4. Restore PostgreSQL from the `pg_dump` backup only if migrations or data writes must be undone.
5. Validate and reload the active proxy, then verify `/emandar/`, `/emandar/api/health`, and the current hashed asset URL.
