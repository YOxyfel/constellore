import { execFile } from "node:child_process";
import { readdir } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execute = promisify(execFile);
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const files = ["server.mjs", "game-services.mjs", "server-safety.mjs"];

async function collect(directory) {
  for (const entry of await readdir(join(root, directory), { withFileTypes: true })) {
    const child = join(directory, entry.name);
    if (entry.isDirectory()) await collect(child);
    else if ([".js", ".mjs", ".cjs"].includes(extname(entry.name))) files.push(child);
  }
}

for (const directory of ["content", "public", "Website", "scripts", "e2e"]) await collect(directory);
for (const file of [...new Set(files)].sort((left, right) => left.localeCompare(right, "en"))) {
  await execute(process.execPath, ["--check", join(root, file)], { cwd: root, windowsHide: true });
}

console.log(`Syntax verified for ${files.length} JavaScript modules.`);
