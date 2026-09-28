// Local preview of Pages directory indexes, with no Next server or API fallback.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../out/", import.meta.url));
const base = "/signaltrace";
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".txt": "text/plain", ".woff2": "font/woff2", ".ico": "image/x-icon" };
const port = Number(process.env.STATIC_PORT ?? 4173);
createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (path === base) { res.writeHead(301, { Location: `${base}/` }).end(); return; }
    if (!path.startsWith(`${base}/`) || !["GET", "HEAD"].includes(req.method)) {
      res.writeHead(404).end("Not found"); return;
    }
    let file = resolve(root, path.slice(base.length + 1));
    if (file !== resolve(root) && !file.startsWith(`${resolve(root)}${sep}`)) {
      res.writeHead(404).end("Not found"); return;
    }
    if ((await stat(file)).isDirectory()) {
      if (!path.endsWith("/")) { res.writeHead(301, { Location: `${path}/` }).end(); return; }
      file = resolve(file, "index.html");
    }
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch { res.writeHead(404).end("Not found"); }
}).listen(port, "127.0.0.1", () => console.log(`Static demo: http://127.0.0.1:${port}${base}/`));
