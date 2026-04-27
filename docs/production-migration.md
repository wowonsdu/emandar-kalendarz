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

The seed source is `apps/web/public/mock-data/seed-store.json`.

## Production Shape

- Web files: `/opt/panel.ceo/emandar`
- API runtime: `/opt/panel.ceo/emandar-api`
- Runtime data/uploads: `/opt/panel.ceo/emandar-data`
- API local port: `127.0.0.1:4174`
- Public URLs:
  - `https://panel.ceo/emandar/`
  - `https://panel.ceo/emandar/api/health`

Before replacing live files, create timestamped backups of:

- `/opt/panel.ceo/emandar`
- `/opt/panel.ceo/emandar-data/runtime-store.json` if it still exists from the mock era

Deploy static web build from `apps/web/dist/`. Deploy the API build plus root workspace files needed for production install, copy `apps/web/public/mock-data/seed-store.json` to `/opt/panel.ceo/emandar-api/seed-store.json`, then run migrations and seed import.

Use `deploy/emandar-api.env.example`, `deploy/emandar-api.service`, and `deploy/nginx-emandar.conf.example` as the server-side templates. Always inspect the existing `panel.ceo` Nginx config first, back up the edited config, run `nginx -t`, reload only after it passes, and verify the target route plus a neighboring route.
