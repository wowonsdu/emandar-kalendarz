# Production Release Checklist

## 1. Backup and data preparation

- Run Firestore export or project backup before changing rules or backfilling data.
- Run `node scripts/backfill-firestore.mjs --dry-run` and review the report.
- Run `node scripts/backfill-firestore.mjs --apply` only after the dry run looks correct.
- Refresh demo accounts and smoke data when needed with `npm run seed:firebase`.

## 2. Automated verification

- Run `npm test`.
- Run `npm run test:rules`.
- Run `npm run build`.

## 3. Manual smoke

- Trainer login works and dashboard loads without console errors.
- Organizer login works and dashboard loads without console errors.
- Organizer can create an event only for a trainer with an approved relation.
- Trainer can detach organizer relation with archive option.
- Archived organizer events remain visible in lists but cannot be opened.
- Public calendar hides archived events and blocks enrollment for cancelled or archived events.
- KPI widgets render correctly after creating, archiving, and detaching events.

## 4. Deploy

- Deploy application build to production hosting.
- Deploy Firebase rules after emulator verification passes.
- Re-run a short production smoke on seeded accounts.

## 5. Rollback readiness

- Keep the previous `dist` build until production smoke is complete.
- Record the exact Firebase rules version deployed in the release note.
- If a production smoke fails, restore the previous web build and re-deploy the previous rules snapshot.
