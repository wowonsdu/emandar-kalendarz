import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const rawBasePath = "/emandar-raw/";
const outputDir = path.join(projectRoot, "dist-raw");

async function runBuild() {
  await rm(outputDir, { recursive: true, force: true });

  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["./node_modules/vite/bin/vite.js", "build", "--outDir", "dist-raw"],
      {
        cwd: projectRoot,
        env: {
          ...process.env,
          EMANDAR_BASE_PATH: rawBasePath,
        },
        stdio: "inherit",
      },
    );

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Raw build failed with exit code ${code ?? "unknown"}.`));
    });
    child.on("error", reject);
  });
}

async function rewriteRawHtaccess() {
  const htaccessPath = path.join(outputDir, ".htaccess");
  const content = await readFile(htaccessPath, "utf8");
  const nextContent = content.replaceAll("RewriteBase /emandar/", `RewriteBase ${rawBasePath}`);

  if (nextContent !== content) {
    await writeFile(htaccessPath, nextContent, "utf8");
  }
}

await runBuild();
await rewriteRawHtaccess();
console.log(`Raw dist ready in ${outputDir}`);
