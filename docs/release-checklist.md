# Emandar release checklist

## Before deploy

- Run `npm test`.
- Run `npm run build`.

## Data gate

- Confirm every relation document uses the deterministic id format `<trainerId>__<organizerId>`.
- Confirm `trainingEvents`, `availabilitySlots` and `enrollmentRequests` have normalized `trainerUserId` and `organizerUserId`.
- Confirm archived events have `isPublished=false` and organizer access is read-only from the list level.

## App smoke

- Organizer login and trainer login both work.
- Marek can create an event for Klaudia when relation is approved.
- Trainer can detach organizer with archive enabled and organizer then sees archived event without opening it.
- Public enrollment works for active published event and is blocked for archived/cancelled event.
- Trainer and organizer dashboards refresh KPI after create/archive/detach.
- Browser console and visible toasts do not show raw backend errors.

## Deploy and rollback

- Build `dist`.
- Deploy frontend to production.
- Keep the current deployed build hash and the previous `dist` bundle as rollback point.
