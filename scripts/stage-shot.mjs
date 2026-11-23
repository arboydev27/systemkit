// Screenshots of a lesson stage in headless Chrome (the Browser pane stalls animation while hidden). It clips the viewport
// instead of using captureBeyondViewport, which lays the page out narrow and flips the stage to its phone layout.
//   node scripts/stage-shot.mjs jobs.json        (or: node scripts/stage-shot.mjs '<jobs as JSON>')
// A job: { "url": "http://localhost:3000/learn/consistent-hashing/hash-ring/#step-3", "width": 1440, "height": 900,
//          "theme": "light"|"dark", "reduced": false, "scale": 2, "actions": [...] }
// Chrome is found in /Applications, or set CHROME_PATH. Stills with reduced motion are deterministic, so two captures
// of the same build can be compared with scripts/png-diff.mjs.
// Actions, in order:
//   ["wait", ms]                      wait
//   ["ready"]                         wait until the stage has started (its SVG is drawn) and is scrolled into view
//   ["key", "ArrowRight"]             press a key with the stage focused (" " plays/pauses, "Home" resets, "1".."8" jump)
//   ["click", "css selector"]         click the centre of an element
//   ["hash", "#step-4"]               go to a step's link (reloads the page at that step), then ["ready"]
//   ["shot", "out.png", "stage"|"card"|"viewport"|"page"]   stage = the drawing, card = the stage with its steps panel
//   ["sheet", "out-prefix", count, everyMs, "stage"]         frames while something plays: out-prefix-00.png ...
//   ["eval", "js expression"]         print the value
//   ["viewport", width, height]       resize the page in place, as a phone rotating or a window narrowing does
// Prints console errors and exceptions at the end of each job. Exit 1 if any job threw.
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const CHROME = process.env.CHROME_PATH ?? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium"].find(existsSync);
const arg = process.argv[2];
if (!arg) { console.error("usage: node stage-shot.mjs jobs.json | '<json>'"); process.exit(2); }
const jobs = JSON.parse(existsSync(arg) ? readFileSync(arg, "utf8") : arg);

const profile = mkdtempSync(join(tmpdir(), "stage-shot-"));
const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--force-color-profile=srgb", "--font-render-hinting=none", "about:blank"]);
const port = await new Promise((done, fail) => {
  let text = "";
  const t = setTimeout(() => fail(new Error("Chrome did not start")), 20000);
  chrome.stderr.on("data", (d) => { text += d; const m = text.match(/DevTools listening on ws:\/\/[^:]+:(\d+)\//); if (m) { clearTimeout(t); done(+m[1]); } });
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = false;

for (const job of jobs) {
  const page = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pending = new Map(); const problems = []; let onLoad = () => {};
  ws.onmessage = (msg) => {
    const d = JSON.parse(msg.data);
    if (d.method === "Page.loadEventFired") onLoad();
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
    else if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") problems.push("console.error: " + d.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 400));
    else if (d.method === "Runtime.exceptionThrown") problems.push("exception: " + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text).slice(0, 400));
  };
  await new Promise((r) => (ws.onopen = r));
  const send = (method, params = {}) => new Promise((done, fail) => {
    const call = ++id; const t = setTimeout(() => fail(new Error(`${method} timed out`)), 60000);
    pending.set(call, (d) => { clearTimeout(t); d.error ? fail(new Error(d.error.message)) : done(d.result); });
    ws.send(JSON.stringify({ id: call, method, params }));
  });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  const width = job.width ?? 1440, height = job.height ?? 900;
  try {
    await send("Page.enable"); await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: job.scale ?? 2, mobile: width < 600 });
    if (width < 600) await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: job.theme ?? "light" }, { name: "prefers-reduced-motion", value: job.reduced ? "reduce" : "no-preference" }] });
    const go = async (url) => { const loaded = new Promise((r) => { onLoad = r; setTimeout(r, 30000); }); await send("Page.navigate", { url }); await loaded; };
    const ready = async () => {
      const until = Date.now() + 30000;
      while (Date.now() < until) {
        const ok = await evaluate(`(() => { const s = document.querySelector('[aria-roledescription="lesson stage"]'); if (!s || !s.querySelector('svg')) return false; const r = s.getBoundingClientRect(); window.scrollTo(0, Math.max(0, window.scrollY + r.top - Math.max(12, (innerHeight - r.height) / 2 - 40))); return true; })()`);
        if (ok) { await sleep(400); return; }
        await sleep(200);
      }
      throw new Error("the stage never drew");
    };
    const rectOf = async (what) => {
      if (what === "viewport") { const sy = await evaluate("scrollY"); return { x: 0, y: sy, width, height }; }
      const sel = what === "card" ? `[aria-roledescription="lesson stage"]` : `[aria-roledescription="lesson stage"]`;
      const r = await evaluate(`(() => { let e = document.querySelector('${sel}'); if (${what === "card" ? "true" : "false"}) e = e.parentElement.parentElement; const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height, sx: scrollX, sy: scrollY }; })()`);
      // the clip is in page coordinates; keep it to what the viewport shows
      const y = Math.max(0, r.y), x = Math.max(0, r.x);
      return { x: x + r.sx, y: y + r.sy, width: Math.min(r.width, width - x), height: Math.min(r.height - (y - r.y), height - y) };
    };
    const shoot = async (out, what = "stage") => {
      mkdirSync(dirname(out), { recursive: true });
      let params = { format: "png", captureBeyondViewport: false };
      if (what === "page") {
        const h = await evaluate("document.documentElement.scrollHeight");
        await send("Emulation.setDeviceMetricsOverride", { width, height: Math.min(h, 6000), deviceScaleFactor: job.scale ?? 2, mobile: width < 600 });
        await sleep(300);
      } else params.clip = { ...(await rectOf(what)), scale: 1 };
      const r = await send("Page.captureScreenshot", params);
      writeFileSync(out, Buffer.from(r.data, "base64"));
      if (what === "page") await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: job.scale ?? 2, mobile: width < 600 });
      console.log(`shot ${out}`);
    };
    await go(job.url);
    for (const a of job.actions ?? [["ready"], ["wait", 2500], ["shot", job.out ?? "shot.png", "stage"]]) {
      const [kind, ...rest] = a;
      if (kind === "wait") await sleep(rest[0]);
      else if (kind === "ready") await ready();
      else if (kind === "hash") { const base = job.url.replace(/#.*$/, ""); await go(base + rest[0]); await send("Page.reload"); await sleep(300); await ready(); }
      else if (kind === "key") {
        await evaluate(`document.querySelector('[aria-roledescription="lesson stage"]').focus({ preventScroll: true })`);
        const key = rest[0], code = key === " " ? "Space" : /^\d$/.test(key) ? "Digit" + key : key;
        await send("Input.dispatchKeyEvent", { type: "keyDown", key, code, text: key.length === 1 ? key : undefined });
        await send("Input.dispatchKeyEvent", { type: "keyUp", key, code });
      } else if (kind === "click") {
        const c = await evaluate(`(() => { const b = document.querySelector(${JSON.stringify(rest[0])}).getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
        for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x: c.x, y: c.y, button: "left", clickCount: 1 });
      } else if (kind === "shot") await shoot(rest[0], rest[1]);
      else if (kind === "sheet") {
        const [prefix, count, every, what] = rest;
        for (let i = 0; i < count; i++) { await shoot(`${prefix}-${String(i).padStart(2, "0")}.png`, what ?? "stage"); await sleep(every); }
      } else if (kind === "eval") console.log(JSON.stringify(await evaluate(rest[0])));
      else if (kind === "viewport") await send("Emulation.setDeviceMetricsOverride", { width: rest[0], height: rest[1], deviceScaleFactor: job.scale ?? 2, mobile: rest[0] < 600 });
      else throw new Error(`unknown action ${kind}`);
    }
  } catch (e) { failed = true; console.log(`job ${job.url} failed: ${e.message}`); }
  for (const p of problems) console.log(`  ${p}`);
  ws.close();
  await fetch(`http://127.0.0.1:${port}/json/close/${page.id}`).catch(() => {});
}
chrome.kill("SIGKILL");
try { rmSync(profile, { recursive: true, force: true }); } catch {}
process.exit(failed ? 1 : 0);
