// A static server for Next's out/ folder: node scripts/serve-out.mjs [dir] [port] (out, 4400). Unlike python's
// http.server it keeps up with a page loading many chunks at once, so lazily loaded scenes and figures arrive.
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
const [dir = "out", port = "4400"] = process.argv.slice(2);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".avif": "image/avif", ".woff2": "font/woff2", ".txt": "text/plain", ".ico": "image/x-icon", ".glb": "model/gltf-binary", ".wasm": "application/wasm", ".jpg": "image/jpeg", ".xml": "application/xml" };
createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = normalize(join(dir, path));
  if (!file.startsWith(normalize(dir))) { res.writeHead(403).end(); return; }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file) && existsSync(file + ".html")) file += ".html";
  if (!existsSync(file)) { res.writeHead(404).end("not found"); return; }
  res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
  createReadStream(file).pipe(res);
}).listen(+port, "127.0.0.1", () => console.log(`serving ${dir} on http://127.0.0.1:${port}`));
