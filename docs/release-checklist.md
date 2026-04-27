# Emandar release checklist

## Before deploy

- Run `pnpm test`.
- Run `pnpm typecheck`.
- Run `pnpm build`.

## Data gate

- Confirm every relation document uses the deterministic id format `<trainerId>__<organizerId>`.
- Confirm `trainingEvents` and `enrollmentRequests` have normalized `trainerUserId` and `organizerUserId`.
- Confirm archived events have `isPublished=false` and organizer access is read-only from the list level.
- Confirm production seed contains only admin and trainer users/profiles.
- Confirm `ALLOW_LEGACY_STORE_API` is not enabled for production.
- Confirm `SMSAPI_TOKEN`, optional `SMSAPI_FROM`, `SESSION_SECRET`, `DATABASE_URL`, and `UPLOAD_STORAGE_PATH` are configured in `/etc/emandar-api.env`.

## App smoke

- Organizer login and trainer login both work.
- Marek can create an event for Klaudia when relation is approved.
- Trainer can detach organizer with archive enabled and organizer then sees archived event without opening it.
- Public enrollment works for active published event and is blocked for archived/cancelled event.
- Trainer and organizer dashboards refresh KPI after create/archive/detach.
- Browser console and visible toasts do not show raw backend errors.
- SMS login works in SMSAPI test mode before switching `SMSAPI_TEST_MODE=false`.
- Uploading an avatar/event image writes a file under `/opt/panel.ceo/emandar-data/uploads` and returns a public URL.

## Deploy and rollback

- Build `dist`.
- Back up `/opt/panel.ceo/emandar` to a timestamped directory.
- Back up PostgreSQL with `pg_dump --format=custom`.
- Back up `/opt/panel.ceo/emandar-data/uploads`.
- Deploy frontend to production and restart the API service.
- Run `nginx -t`, reload Nginx, and verify `/emandar/`, `/emandar/api/health`, and the current hashed asset URL.
- Keep the current deployed build hash, previous `dist` bundle, DB dump, and upload backup as rollback points.
