# Emandar release checklist

## Before deploy

- Run `npm run backfill:firebase` on the target project after setting `FIREBASE_PROJECT_ID` and service account credentials.
- Create a Firestore export backup with `gcloud firestore export gs://<backup-bucket>/emandar-$(Get-Date -Format yyyyMMdd-HHmmss) --project <project-id>`.
- Run `npm test`.
- Run `npm run test:firebase`.
- Run `npm run build`.

## Data and rules gate

- Confirm every relation document uses the deterministic id format `<trainerId>__<organizerId>`.
- Confirm `trainingEvents`, `groups`, `availabilitySlots` and `enrollmentRequests` have normalized `trainerUserId` and `organizerUserId`.
- Confirm archived events have `isPublished=false` and organizer access is read-only from the list level.
- Deploy Firestore and Storage rules only after emulator tests pass.

## App smoke

- Organizer login and trainer login both work.
- Marek can create an event for Klaudia when relation is approved.
- Trainer can detach organizer with archive enabled and organizer then sees archived event without opening it.
- Public enrollment works for active published event and is blocked for archived/cancelled event.
- Trainer and organizer dashboards refresh KPI after create/archive/detach.
- Browser console and visible toasts do not show raw Firebase permission errors.

## Deploy and rollback

- Build `dist`.
- Deploy frontend to production.
- Keep the latest Firestore export path and current deployed build hash as rollback point.
