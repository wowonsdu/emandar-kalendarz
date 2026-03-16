# Local Runbook

- Use local Firebase CLI through npm scripts from `package.json`.
- Default Firebase project for this repo is `emandar-app`.
- Firebase web config lives in `.env.local`.
- Emulator-specific frontend env lives in `.env.emulators`.

## Npm scripts

- `npm run firebase -- --version` checks the local Firebase CLI version.
- `npm run firebase:login` logs into Firebase CLI.
- `npm run firebase:projects` lists available Firebase projects.
- `npm run firebase:use` switches the repo to project `emandar-app`.
- `npm run firebase:deploy` deploys functions, Firestore rules, and Storage rules to `emandar-app`.
- `npm run emu:start` starts Firebase emulators for Auth, Firestore, Storage, and Functions.
- `npm run emu:start:data` starts the same emulators with import/export persistence in `.firebase-emulator-data`.
- `npm run dev` starts the normal Vite app against live Firebase config from `.env.local`.
- `npm run dev:emu` starts the Vite app in emulator mode using `.env.emulators`.

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
