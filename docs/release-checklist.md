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
- Confirm `ALLOW_LEGACY_STORE_API=false` for production.
- Confirm `DATABASE_URL`, `SESSION_SECRET`, `CORS_ALLOWED_ORIGINS=https://panel.ceo`, `UPLOAD_STORAGE_PATH`, and `UPLOADS_PUBLIC_PATH` are configured in `/etc/emandar-api.env`.
- Confirm `SMSAPI_TEST_MODE=true` remains set until the final real-SMS release gate, then set `SMSAPI_TEST_MODE=false` for real launch only.
- Confirm `SMSAPI_TOKEN` and optional `SMSAPI_FROM` are configured only when running the final real-SMS smoke.
- Confirm migrations include `auth_sessions`, `sms_challenges`, `sms_request_attempts`, `registration_tokens`, `uploads`, `audit_log`, `notification_deliveries`, and `signed_action_tokens`.
- Confirm PostgreSQL and `/opt/panel.ceo/emandar-data/uploads` backups exist before deploying.

## App smoke

- Organizer login and trainer login both work.
- Marek can create an event for Klaudia when relation is approved.
- Trainer can detach organizer with archive enabled and organizer then sees archived event without opening it.
- Public enrollment works for active published event and is blocked for archived/cancelled event.
- Trainer and organizer dashboards refresh KPI after create/archive/detach.
- Browser console and visible toasts do not show raw backend errors.
- SMS login works in SMSAPI test mode before switching `SMSAPI_TEST_MODE=false`.
- Registration for a new phone works only after SMS confirmation and fails if the registration token is missing or for a different phone.
- Uploading an avatar/event image writes a file under `/opt/panel.ceo/emandar-data/uploads`, creates an `uploads` row, returns a public URL without `storagePath`, and rejects a renamed non-image file.
- Mutations fail with `csrf-required` when `x-emandar-csrf` is missing.
- Demo SMS sends create `notification_deliveries`, and core mutating flows create `audit_log` rows.
- SMS request rate limits trigger per phone/IP/pair, wrong code attempts are capped for one challenge, and API responses do not include `code` when `SMSAPI_TEST_MODE=false`.
- Attendance confirmation links use signed one-use tokens; a raw `eventParticipant.id` does not confirm attendance.
- Run `pnpm smoke:production --base-url=https://panel.ceo/emandar/` and confirm public calendar, trainer list, community events, SMS login, panel dashboard, groups, trainings, enrollments, community moderation/review link, and SSE smoke pass.
- Confirm smoke network logs contain no failed requests, no console errors, and no legacy requests to `/bootstrap`, `/panel/command`, `/mock`, or `/store`.

## Real SMS gate

- Confirm `SMSAPI_TEST_MODE=false`.
- Send a real SMS using the production `SMSAPI_TOKEN`.
- Confirm sender name/from, billing status, expected cost, and delivery result.
- Confirm the SMS code is not present in the API response body.

## Deploy and rollback

- Build `dist`.
- Back up `/opt/panel.ceo/emandar` to a timestamped directory.
- Back up PostgreSQL with `pg_dump --format=custom`.
- Back up `/opt/panel.ceo/emandar-data/uploads`.
- Deploy frontend to production and restart the API container/service.
- Verify `/emandar/`, `/emandar/api/health`, and the current hashed asset URL return `200`.
- Keep the current deployed build hash, previous `dist` bundle, DB dump, and upload backup as rollback points.
