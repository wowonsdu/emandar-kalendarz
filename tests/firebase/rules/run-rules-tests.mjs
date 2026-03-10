import { rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const tempConfigPath = resolve(process.cwd(), ".firebase.rules.test.json");

const config = {
  firestore: {
    rules: "firestore.rules",
  },
  storage: {
    rules: "storage.rules",
  },
  functions: {
    source: ".",
    runtime: "nodejs20",
  },
  emulators: {
    auth: {
      host: "127.0.0.1",
      port: 9098,
    },
    firestore: {
      host: "127.0.0.1",
      port: 8085,
    },
    storage: {
      host: "127.0.0.1",
      port: 9195,
    },
    functions: {
      host: "127.0.0.1",
      port: 5002,
    },
    hub: {
      host: "127.0.0.1",
      port: 4405,
    },
    logging: {
      host: "127.0.0.1",
      port: 4505,
    },
    ui: {
      enabled: false,
    },
  },
};

async function main() {
  await writeFile(tempConfigPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

  const command =
    'firebase emulators:exec --config .firebase.rules.test.json --only auth,firestore,storage,functions "vitest run tests/firebase/rules tests/firebaseRepository.integration.test.ts --reporter=dot --pool=forks --poolOptions.forks.singleFork"';

  const child = spawn(command, {
    cwd: process.cwd(),
    env: process.env,
    shell: true,
    stdio: "inherit",
  });

  const exitCode = await new Promise((resolveExitCode, reject) => {
    child.on("error", reject);
    child.on("close", resolveExitCode);
  });

  if (exitCode !== 0) {
    throw new Error(`Rules tests exited with code ${String(exitCode)}`);
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await rm(tempConfigPath, { force: true });
  });
