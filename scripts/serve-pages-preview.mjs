import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = normalize(fileURLToPath(new URL("../dist-pages/", import.meta.url))).replace(/[\\/]+$/, "");
const configuredPrefix = String(process.env.CONSTELLORE_PAGES_PREFIX || "/constellore/").trim();
if (!/^\/(?:[A-Za-z0-9._~-]+\/)*$/.test(configuredPrefix)) throw new Error("CONSTELLORE_PAGES_PREFIX must be a root-relative directory path ending in /.");
const prefix = configuredPrefix;
const port = Number(process.env.PORT || 4185);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8"
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (!url.pathname.startsWith(prefix)) {
      response.writeHead(302, { Location: prefix });
      return response.end();
    }
    const relative = decodeURIComponent(url.pathname.slice(prefix.length)) || "index.html";
    let file = normalize(join(root, relative));
    if (file !== root && !file.startsWith(`${root}${sep}`)) throw new Error("Invalid path");
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
    const body = await readFile(file);
    response.writeHead(200, { "Content-Type": mime[extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => console.log(`Pages preview: http://127.0.0.1:${port}${prefix}`));
