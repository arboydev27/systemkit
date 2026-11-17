#!/usr/bin/env node
// Builds the pictogram comparison sheet from the real drawings and the stage's real CSS, in both themes.
//   node .claude/skills/pictogram-polish/scripts/sheet.mjs [--out pictograms.html] [--today origin/main] [--packs devices,logs] [--no-core]
// Run from the repo root. Core parts show today's drawing (from git ref --today) beside the working tree's; every pack
// part shows at 108, 48 and 32 px plus the options its pack lists in `samples`. Each new drawing is measured in the
// page: a part taller than its GLYPH_TOP (roles.ts), or spilling off its base, gets a red note under it.
// Capture a section with the anatomy skill's drive.mjs, e.g. at 2x:
//   node ~/.claude/skills/anatomy/scripts/drive.mjs pictograms.html '[["shot","core.png","#core",2]]' --width 1500
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const out = resolve(opt("--out", "pictograms.html"));
const ref = opt("--today", "origin/main");
const onlyPacks = opt("--packs", "")?.split(",").filter(Boolean);
const withCore = !args.includes("--no-core");
const lib = join(root, "src/lib/lesson-stage");

// ---- the drawings: today's from git, the working tree's from source ----
const tmp = mkdtempSync(join(tmpdir(), "pictogram-sheet-"));
let today = null;
try {
  writeFileSync(join(tmp, "pictograms.ts"), execFileSync("git", ["show", `${ref}:src/lib/lesson-stage/pictograms.ts`], { encoding: "utf8" }));
  today = await import(pathToFileURL(join(tmp, "pictograms.ts")).href);
} catch (err) { console.warn(`no drawings at ${ref}: ${err.message.split("\n")[0]}`); }
const now = await import(pathToFileURL(join(lib, "pictograms.ts")).href);
const { ROLES } = await import(pathToFileURL(join(lib, "roles.ts")).href);
const packs = [];
for (const file of readdirSync(join(lib, "packs")).filter((f) => f.endsWith(".ts") && f !== "index.ts").sort()) {
  const name = file.replace(/\.ts$/, "");
  if (onlyPacks.length && !onlyPacks.includes(name)) continue;
  const roles = Object.keys(ROLES).filter((r) => ROLES[r].pack === name);
  try {
    const m = await import(pathToFileURL(join(lib, "packs", file)).href);
    now.addPack(m.default);
    packs.push({ name, roles, samples: m.samples ?? {} });
  } catch (err) {
    console.warn(`pack ${name} didn't load: ${err.message.split("\n")[0]}`);
    packs.push({ name, roles, samples: {}, error: err.message.split("\n")[0] });
  }
}

// ---- the stage's CSS, scoped to a panel ----
const scope = (css, sel) => css.replace(/\.stage :global\(([^)]*)\)/g, (_, s) => `${sel} ${s}`);
const block = (css, from, to) => { const a = css.indexOf(from); return a < 0 ? "" : css.slice(a, to ? css.indexOf(to, a) : undefined); };
const vars = (text) => (text.match(/--[a-z0-9-]+:[^;]+;/g) ?? []).join(" ");
function stageCss(css, sel) {
  const rules = block(css, "/* pictograms and their bases", "@media (prefers-reduced-motion");
  const light = vars(block(css, ".root {", "}"));
  const darkBlock = block(css, "@media (prefers-color-scheme: dark)", "\n}\n");
  return `.light ${sel} { ${light} } .dark ${sel} { ${light} ${vars(darkBlock)} }\n` + scope(rules, sel);
}
const globals = readFileSync(join(root, "src/app/globals.css"), "utf8");
const lightTokens = vars(block(globals, ":root {", "}")), darkTokens = vars(block(globals, "@media (prefers-color-scheme: dark)", "}"));
const css = stageCss(readFileSync(join(root, "src/components/lesson-stage/LessonStage.module.css"), "utf8"), ".new");
let oldCss = "";
try { oldCss = stageCss(execFileSync("git", ["show", `${ref}:src/components/lesson-stage/LessonStage.module.css`], { encoding: "utf8" }), ".now"); } catch {}

// ---- one part as the engine draws it: soft shadow, base, art scaled 1.42 and lifted by the base's height ----
const GLYPH = 1.42, PH = 7;
let gid = 0;
const SHADOW = '<radialGradient id="sk-soft-shadow"><stop offset="0" class="ss0"/><stop offset=".55" class="ss1"/><stop offset="1" class="ss2"/></radialGradient>';
const OLD_DEFS = SHADOW + '<linearGradient id="sk-plinth-side" x1="0" x2="1"><stop offset="0" class="ps0"/><stop offset=".5" class="ps0"/><stop offset=".5" class="ps1"/><stop offset="1" class="ps1"/></linearGradient>';
function part(set, role, size, opts = {}, light = "idle") {
  const id = `g${gid++}`, fix = (s) => s.replaceAll("#sk-", `#${id}-`).replaceAll('id="sk-', `id="${id}-`);
  const lib = set === "now" ? today : now, defs = set === "now" ? OLD_DEFS : SHADOW + now.PICTOGRAM_DEFS;
  const art = lib.glyph(role, opts);
  return `<svg viewBox="-52 -94 104 132" width="${size}" height="${Math.round(size * 1.27)}" class="${set}" data-role="${role}" data-top="${ROLES[role]?.top ?? ""}">` +
    `<defs>${fix(defs)}</defs><ellipse class="soft" cx="0" cy="12" rx="66" ry="33" fill="url(#${id}-soft-shadow)"/>` +
    `<g class="pk" data-light="${light}">${fix(lib.plinth(56, 7, 11))}<g class="art" transform="translate(0 ${-PH}) scale(${GLYPH})">${fix(art)}</g></g></svg>`;
}
const label = (o) => Object.entries(o).map(([k, v]) => (v === true ? k : `${k} ${v}`)).join(", ") || "default";
const cell = (svg, cls = "") => `<div class="cell ${cls}">${svg}</div>`;

function coreRows(theme) {
  const roles = Object.keys(ROLES).filter((r) => !ROLES[r].pack);
  const variants = { client: [{ many: true }], web: [{ big: true }, { many: true }], database: [{ level: 0.6 }, { level: 0.9, levelHot: true }, { replica: true, lead: true }], queue: [{ items: 0 }, { items: 4 }] };
  return `<div class="head core"><span></span><span>Today</span><span>New</span><span>Today 48</span><span>New 48</span><span>New 32</span><span>Options and lights</span></div>` +
    roles.map((r) => `<div class="row core"><b>${ROLES[r].name}<small>${r}</small></b>` +
      cell(today ? part("now", r, 108) : "") + cell(part("new", r, 108), "measure") + cell(today ? part("now", r, 48) : "", "small") + cell(part("new", r, 48), "small") + cell(part("new", r, 32), "tiny") +
      `<div class="variants">${[...(variants[r] ?? []).map((o) => [o, "on"]), [{}, "work"], [{}, "hot"]].map(([o, l]) => `<figure>${part("new", r, 72, o, l)}<figcaption>${label(o)}${l !== "on" ? ` · ${l}` : ""}</figcaption></figure>`).join("")}</div></div>`).join("");
}
function packRows(pack) {
  return `<div class="head pack"><span></span><span>108</span><span>48</span><span>32</span><span>Options and lights</span></div>` +
    pack.roles.map((r) => `<div class="row pack"><b>${ROLES[r].name}<small>${r}${ROLES[r].opts ? ` · ${ROLES[r].opts}` : ""}</small></b>` +
      cell(part("new", r, 108), "measure") + cell(part("new", r, 48), "small") + cell(part("new", r, 32), "tiny") +
      `<div class="variants">${[...(pack.samples[r] ?? []).map((o) => [o, "on"]), [{}, "work"], [{}, "hot"]].map(([o, l]) => `<figure>${part("new", r, 72, o, l)}<figcaption>${label(o)}${l !== "on" ? ` · ${l}` : ""}</figcaption></figure>`).join("")}</div></div>`).join("");
}
const section = (id, title, body) => `<section class="section" id="${id}">${["light", "dark"].map((t) => `<div class="panel ${t}"><h2>${title} · ${t === "light" ? "Light" : "Dark"}</h2>${body(t)}</div>`).join("")}</section>`;

const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Pictograms</title><style>
* { box-sizing: border-box; }
body { margin: 0; min-width: 1500px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif; -webkit-font-smoothing: antialiased; background: #777; }
.section { display: grid; grid-template-columns: 1fr 1fr; }
.panel { padding: 26px 26px 30px; background: var(--canvas); color: var(--ink); }
.light { ${lightTokens} --work: #2a78d6; --hot: #eb6834; }
.dark { ${lightTokens} ${darkTokens} --work: #3987e5; --hot: #f0733f; }
h2 { margin: 0 0 14px; font-size: 15px; font-weight: 750; letter-spacing: -.01em; }
.head, .row { display: grid; align-items: center; gap: 8px; }
.core { grid-template-columns: 88px 112px 112px 52px 52px 36px 1fr; }
.pack { grid-template-columns: 88px 112px 52px 36px 1fr; }
.head { color: var(--muted); font-size: 9.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; padding: 0 0 6px; }
.row { border-top: 1px solid var(--line); padding: 5px 0; }
.row b { font-size: 12px; font-weight: 700; line-height: 1.25; } .row small { display: block; color: var(--muted); font-size: 9.5px; font-weight: 600; margin-top: 2px; }
.cell { display: grid; place-items: center; background: var(--diagram); border-radius: 9px; height: 142px; position: relative; }
.cell.small { height: 66px; } .cell.tiny { height: 46px; }
.cell svg, figure svg { overflow: visible; display: block; }
.variants { display: flex; gap: 6px; }
figure { margin: 0; display: grid; justify-items: center; background: var(--diagram); border-radius: 9px; padding: 4px 4px 3px; }
figcaption { color: var(--muted); font-size: 9.5px; font-weight: 600; }
.warn { position: absolute; left: 4px; right: 4px; bottom: 3px; color: #c0392b; font-size: 9px; font-weight: 700; text-align: center; }
.now .ss0, .new .ss0 { stop-color: #000; stop-opacity: .26; } .now .ss1, .new .ss1 { stop-color: #000; stop-opacity: .1; } .now .ss2, .new .ss2 { stop-color: #000; stop-opacity: 0; }
${oldCss}
${css}
</style></head><body>
${withCore ? section("core", "Core: today and new", coreRows) : ""}
${packs.map((p) => section(`pack-${p.name}`, `Pack: ${p.name}`, () => (p.error ? `<p class="warn" style="position:static">didn't load: ${p.error}</p>` : "") + packRows(p))).join("\n")}
<script>
  // a part taller than its GLYPH_TOP misplaces the notes and pills over it; one spilling off its base hides links' ports
  for (const cell of document.querySelectorAll(".light .cell.measure")) {
    const svg = cell.querySelector("svg"), art = svg.querySelector(".art"), b = art.getBBox(), top = Number(svg.dataset.top);
    const notes = [];
    if (-b.y > top + 2 || -b.y < top - 8) notes.push("top " + top + ", drawn " + Math.round(-b.y));
    if (b.x < -32 || b.x + b.width > 32) notes.push("wider than its base");
    if (b.y + b.height > 21) notes.push("hangs over the front");
    if (notes.length) cell.insertAdjacentHTML("beforeend", '<div class="warn">' + notes.join(" · ") + "</div>");
    window.__measured = (window.__measured || []).concat([{ role: svg.dataset.role, top, drawn: Math.round(-b.y), notes }]);
  }
</script></body></html>`;
writeFileSync(out, page);
console.log(`wrote ${out}: core ${withCore ? "yes" : "no"}, packs ${packs.map((p) => `${p.name} (${p.roles.length})`).join(", ") || "none"}`);
