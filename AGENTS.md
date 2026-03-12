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
