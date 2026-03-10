import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const source = resolve(root, "public", ".htaccess");
const targetDir = resolve(root, "dist");
const target = resolve(targetDir, ".htaccess");

await mkdir(targetDir, { recursive: true });
await copyFile(source, target);
