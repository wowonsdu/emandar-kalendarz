# Local Runbook

- This branch runs on the built-in mock JSON backend under `public/mock-data` and `public/api/mock`.
- Use `npm run dev` for local work, `npm test` for unit tests, and `npm run build` before deploy.

## Production web deploy

- Preferred public web target for this repo is `https://panel.ceo/emandar/`.
- Live files for that path are served from `/opt/panel.ceo/emandar` on `root@51.68.143.29`.
- Before replacing live files, create a timestamped backup next to the app directory, for example `/opt/panel.ceo/emandar-backup-YYYYMMDD-HHMMSS`.
- Standard deploy flow for the static frontend:
  1. Run `npm run build`
  2. Copy `dist/` to `root@51.68.143.29:/opt/panel.ceo/emandar/` with `rsync -az --delete`
  3. Verify `https://panel.ceo/emandar/` and the current hashed asset URL both return `200`

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
