// Compares PNG pairs pixel by pixel in headless Chrome.
//   node scripts/png-diff.mjs pairs.json      pairs: [["before.png", "after.png", "diff-out.png"], ...] (a file or inline JSON)
//   node scripts/png-diff.mjs a.png b.png [diff.png]
// Prints, for each pair, the share of pixels that differ by more than 24 (of 255) in any channel, and writes a diff image
// (changed pixels in orange over a faded copy of "after") when a third path is given. Sizes that differ count as 100%.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const pairs = args.length === 1 ? JSON.parse(existsSync(args[0]) ? readFileSync(args[0], "utf8") : args[0]) : [args];
const CHROME = process.env.CHROME_PATH ?? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium"].find(existsSync);
const profile = mkdtempSync(join(tmpdir(), "png-diff-"));
const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "about:blank"]);
const port = await new Promise((done) => { let t = ""; chrome.stderr.on("data", (d) => { t += d; const m = t.match(/DevTools listening on ws:\/\/[^:]+:(\d+)\//); if (m) done(+m[1]); }); });
const page = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
await new Promise((r) => (ws.onopen = r));
const evaluate = (expression) => new Promise((done) => { const c = ++id; pending.set(c, (d) => done(d.result?.result?.value ?? d.result?.exceptionDetails?.exception?.description)); ws.send(JSON.stringify({ id: c, method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true } })); });
const FN = `async (a, b, want) => {
  const load = (src) => new Promise((r, f) => { const i = new Image(); i.onload = () => r(i); i.onerror = f; i.src = src; });
  const [A, B] = await Promise.all([load(a), load(b)]);
  if (A.width !== B.width || A.height !== B.height) return { share: 1, note: A.width + "x" + A.height + " vs " + B.width + "x" + B.height };
  const c = document.createElement("canvas"); c.width = A.width; c.height = A.height; const g = c.getContext("2d");
  g.drawImage(A, 0, 0); const da = g.getImageData(0, 0, c.width, c.height).data;
  g.clearRect(0, 0, c.width, c.height); g.drawImage(B, 0, 0); const img = g.getImageData(0, 0, c.width, c.height); const db = img.data;
  let n = 0;
  for (let i = 0; i < da.length; i += 4) {
    const off = Math.abs(da[i] - db[i]) > 24 || Math.abs(da[i + 1] - db[i + 1]) > 24 || Math.abs(da[i + 2] - db[i + 2]) > 24;
    if (off) { n++; db[i] = 235; db[i + 1] = 104; db[i + 2] = 52; db[i + 3] = 255; } else { db[i + 3] = 60; }
  }
  if (!want) return { share: n / (da.length / 4) };
  g.putImageData(img, 0, 0);
  return { share: n / (da.length / 4), png: c.toDataURL("image/png") };
}`;
for (const [a, b, out] of pairs) {
  if (!existsSync(a) || !existsSync(b)) { console.log(`${b}: missing ${existsSync(a) ? b : a}`); continue; }
  const url = (f) => "data:image/png;base64," + readFileSync(f).toString("base64");
  const r = await evaluate(`(${FN})(${JSON.stringify(url(a))}, ${JSON.stringify(url(b))}, ${!!out})`);
  if (typeof r !== "object") { console.log(`${b}: error ${r}`); continue; }
  if (out && r.png) writeFileSync(out, Buffer.from(r.png.split(",")[1], "base64"));
  console.log(`${(r.share * 100).toFixed(3).padStart(8)}%  ${b}${r.note ? "  (" + r.note + ")" : ""}`);
}
chrome.kill("SIGKILL");
try { rmSync(profile, { recursive: true, force: true }); } catch {}
