# Local Runbook

- Use local Firebase CLI through npm scripts from `package.json`.
- Default Firebase project for this repo is `emandar-prod`.
- Firebase web config lives in `.env.local`.
- Emulator-specific frontend env lives in `.env.emulators`.

## Npm scripts

- `npm run firebase -- --version` checks the local Firebase CLI version.
- `npm run firebase:login` logs into Firebase CLI.
- `npm run firebase:projects` lists available Firebase projects.
- `npm run firebase:use` switches the repo to project `emandar-prod`.
- `npm run firebase:deploy` deploys functions, Firestore rules, Firestore indexes, and Storage rules to `emandar-prod`.
- `npm run emu:start` starts Firebase emulators for Auth, Firestore, Storage, and Functions.
- `npm run emu:start:data` starts the same emulators with import/export persistence in `.firebase-emulator-data`.
- `npm run dev` starts the normal Vite app against live Firebase config from `.env.local`.
- `npm run dev:emu` starts the Vite app in emulator mode using `.env.emulators`.

## Production web deploy

- Preferred public web target for this repo is `https://panel.ceo/emandar/`.
- Live files for that path are served from `/opt/panel.ceo/emandar` on `root@51.68.143.29`.
- Before replacing live files, create a timestamped backup next to the app directory, for example `/opt/panel.ceo/emandar-backup-YYYYMMDD-HHMMSS`.
- Standard deploy flow for the static frontend:
  1. Run `npm run build`
  2. Copy `dist/` to `root@51.68.143.29:/opt/panel.ceo/emandar/` with `rsync -az --delete`
  3. Verify `https://panel.ceo/emandar/` and the current hashed asset URL both return `200`
- The legacy FTP deploy script is deprecated for this repo; use the `panel.ceo` deploy flow instead.

## Local startup

- For full local Firebase development:
  1. Run `npm run emu:start`
  2. In a second terminal run `npm run dev:emu`
- Emulator ports from `firebase.json`:
  - Auth: `9099`
  - Firestore: `8080`
  - Functions: `5001`
  - Storage: `9199`
  - Emulator UI: `4000`

## Notes

- The frontend already connects to Firebase emulators when `VITE_USE_FIREBASE_EMULATORS=true`.
- Tests use a separate temporary Firebase emulator config and different ports, so do not change them casually.
- If `firebase` is not available globally, always use the npm scripts above or `npx firebase`.
- `trainerExternalBusyMonths` is a legacy intermediate cache of trainer busy intervals. For the trainer iCal preview, do not treat it as the source of truth; the current direction is a live 1:1 read from imported `.ics` feeds. Keep the old cache code for now, but plan a later cleanup/removal pass once the live path is stable.

## Firebase Functions Deploy Rule

- Before any production Functions deploy, first inspect which Firebase Functions were actually affected by the current code changes.
- Do not default to `npm run firebase -- deploy --only functions --project emandar-prod`, because full backend redeploys in this project frequently waste rollout time and hit Cloud Run CPU quota.
- Prefer partial deploys that name only the changed exports, for example:
  - `npm run firebase -- deploy --only functions:createUnifiedTrainingEvent,functions:reviewCommunityEvent --project emandar-prod`
- When changes are in `functions/index.js`, map the diff to the exported function names that really depend on those edits. If a shared helper changed, include every exported function that uses that helper, but still keep the deploy list as narrow as practical.
- Use a full `--only functions` deploy only when the user explicitly asks for a full backend rollout or when the changes are broad enough that a safe partial deploy cannot be justified.

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

## Prototype Rules Mode

- On 2026-03-26 production Firebase rules were intentionally opened for fast UX/UI prototyping.
- Backups of the pre-prototype production rules are stored in:
  - `backups/firebase-rules/firestore.rules.2026-03-26-prototype-backup`
  - `backups/firebase-rules/storage.rules.2026-03-26-prototype-backup`
- When the prototyping phase ends, restore those backups before tightening security and resuming normal permission work.
- Until the user explicitly asks to restore them, treat the open rules as temporary but intentional.

## Pending Backend Migration Plan

- A pending implementation plan for moving `emandar-kalendarz` off Cloud Functions and onto the VPS is stored in `BACK END PLAN.md`.
- Treat that document as the current source of truth for the planned backend/API + worker + SMS scheduler migration until the user explicitly replaces it.
- The plan is approved conceptually but not implemented yet; do not assume the VPS backend exists until the user asks for execution and live verification completes.
