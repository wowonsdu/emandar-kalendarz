# Local Runbook

- This branch runs on the built-in mock JSON backend under `public/mock-data` and `public/api/mock`.
- `public/mock-data/seed-store.json` is the repo-tracked bootstrap seed only.
- Runtime app state must persist in a separate simulated database file, not back into the seed:
  - local dev: `.local-state/emandar/runtime-store.json`
  - production: `/opt/panel.ceo/emandar-data/runtime-store.json`
- Normal browsing, editing, moderation, deletes, and config changes must write only to the runtime store.
- Use `npm run mock:reset` only when an explicit reseed is requested. That command overwrites local runtime state from the current seed.
- When promoting current local runtime back into `public/mock-data/seed-store.json`, use `npm run mock:seed:from-runtime`.
- That export must preserve seeded trainer profiles and trainer-linked user records from the current seed, so demo reseeds do not overwrite trainer bios, avatars, sort order, or other curated trainer data.
- Use `npm run dev` for local work, `npm test` for unit tests, and `npm run build` before deploy.

## Project Context

- This project is a training and events management system for Emandar.
- The system covers:
  - official `Szkolenia Emandar`
  - `Wydarzenia społeczności`
  - groups
  - trainer-organizer relations
  - participant enrollments and follow-up communication
- The role model is hierarchical and cumulative, not flat:
  - `participant` is the base role
  - `moderator` is an additional moderation capability that can be granted by admin to any participant-level account without moving it up the organizer/trainer/admin hierarchy
  - `organizer` includes everything from `participant` and adds organizer capabilities
  - `trainer` includes everything from `participant` and `organizer` and adds trainer capabilities
  - `admin` includes everything from lower roles and adds full administration capabilities
- Higher roles must retain all lower-role capabilities. Do not model the UI as mutually exclusive role silos.
- `moderator` is not a linear hierarchy step. Treat it as participant baseline plus event moderation capabilities:
  - review community events
  - browse official Emandar trainings
  - unpublish official/community events
  - delete official/community events permanently
  - block organizer functions on a user account without detaching trainer relations
- `Wydarzenia społeczności` are part of the base participant flow, so they remain available to organizer, trainer, and admin as inherited participant capabilities.
- `Szkolenia Emandar`, groups, and trainer-organizer coordination are organizer/trainer/admin extensions on top of the participant layer.
- Trainers can additionally organize their own official Emandar trainings and their own community events.
- Admin is the top-level role with full access plus moderation and trainer/system management.
- When changing permissions, navigation, or views, prefer cumulative capability logic over direct `role === ...` branching.

## Production web deploy

- Preferred public web target for this repo is `https://panel.ceo/emandar/`.
- Live files for that path are served from `/opt/panel.ceo/emandar` on `root@51.68.143.29`.
- Persistent mock runtime data for that app must live outside the deployed build at `/opt/panel.ceo/emandar-data/runtime-store.json`.
- Before replacing live files, create a timestamped backup next to the app directory, for example `/opt/panel.ceo/emandar-backup-YYYYMMDD-HHMMSS`.
- Standard deploy flow for the static frontend:
  1. Run `npm run build`
  2. Copy `dist/` to `root@51.68.143.29:/opt/panel.ceo/emandar/` with `rsync -az --delete`
  3. Never overwrite or delete `/opt/panel.ceo/emandar-data/runtime-store.json` during deploy
  4. If a full reseed is explicitly requested, overwrite the runtime store from the current seed and then continue configuration through the browser
  5. Verify `https://panel.ceo/emandar/` and the current hashed asset URL both return `200`

## Backend reference

- Keep `functions/` as a raw reference snapshot for the future backend rewrite.
- Do not wire the active frontend, npm scripts, tests, or release process back to `functions/` unless the user explicitly asks for that migration work.

## Git Flow Rules

- This repository uses Git Flow with `master` as the production branch and `develop` as the integration branch.
- Never implement task work directly on `master` or `develop`.
- For normal work, create branches from `develop` using `feature/<short-name>` or `bugfix/<short-name>`.
- For urgent production fixes, create branches from `master` using `hotfix/<short-name>`.
- Merge completed feature and bugfix branches back into `develop`.
- Merge release and hotfix work back into `master`, and also keep `develop` updated with the same changes.
- When multiple agents work in parallel, each agent must use a separate branch and avoid sharing a working branch.
- Before starting work, verify the current branch and create a new Git Flow branch if needed.
- Before finishing work, merge into the correct long-lived branch instead of leaving changes only on an agent branch.

## Locked Follow-Up: roster / rezerwowi / komunikacja

- Do not redesign or "tidy up" the participant roster, reserve list, participant tabs, or reserve-list communication flows until the following package is implemented together.
- The intended participant-facing split must be:
  - `oczekuję`
  - `rezerwowi`
  - `uczestniczę`
  - `organizuję` as a separate tab
- The intended organizer/system follow-up must include:
  - a clearer logical handling of the reserve list
  - a communication module for reserve-list messaging
  - a bulk message to the full reserve list when there is no space for a given group/event
  - a manual notification flow for a closed roster / reserve-list outcome
- Treat this as a product lock: until that full follow-up is implemented, avoid partial UX changes in this area that would make the current roster/request/reserve behavior diverge from the target structure above.
