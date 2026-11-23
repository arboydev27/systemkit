#!/usr/bin/env node
// Writes editable Excalidraw sources for every scene in src/content/diagrams/.
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const directory = path.join(root, "src/content/diagrams");
const columns = [34, 278, 522, 766];

function sceneElements(id, scene, seedBase) {
  let count = 0;
  const element = (type, x, y, width, height, style, extra = {}) => {
    count += 1;
    return {
      id: `systemkit-${id}-${count}`, type, x, y, width, height, angle: 0,
      strokeColor: style.stroke ?? "#252c30", backgroundColor: style.fill ?? "transparent",
      fillStyle: "solid", strokeWidth: 1.6, strokeStyle: style.dash ? "dashed" : "solid", roughness: 0, opacity: 100,
      groupIds: [], frameId: null, roundness: style.radius ? { type: 3, value: style.radius } : null,
      seed: seedBase + count, version: 1, versionNonce: seedBase + 100000 + count, isDeleted: false,
      boundElements: null, updated: 0, link: null, locked: false, ...extra,
    };
  };
  const text = (value, x, y, width, fontSize, stroke, align = "left") => element("text", x, y, width, Math.round(fontSize * 1.25), { stroke }, {
    text: value, originalText: value, fontSize, fontFamily: 1, textAlign: align, verticalAlign: "middle",
    baseline: Math.round(fontSize * 0.9), lineHeight: 1.25, autoResize: false,
  });
  const elements = [
    text(scene.title, 28, 18, 944, 18, "#252c30"),
    element("line", 28, 52, 944, 0, { stroke: "#c9d0d4", dash: true }, { points: [[0, 0], [944, 0]], startArrowhead: null, endArrowhead: null }),
    text(scene.note, 28, 392, 944, 13, "#4b555a"),
  ];
  if (scene.kind === "flow") {
    for (let index = 0; index < scene.items.length - 1; index++) {
      elements.push(element("arrow", columns[index] + 204, 207, 30, 0, { stroke: "#607078" }, { points: [[0, 0], [30, 0]], startArrowhead: null, endArrowhead: "arrow" }));
    }
  }
  scene.items.forEach((item, index) => {
    const x = columns[index];
    elements.push(element("rectangle", x, 155, 204, 104, { stroke: "#859299", fill: "#f5f6f7", radius: 14 }));
    elements.push(element("rectangle", x + 16, 174, 30, 30, { stroke: "#e4edf3", fill: "#e4edf3", radius: 9 }));
    elements.push(text(String(index + 1).padStart(2, "0"), x + 16, 177, 30, 11, "#4b555a", "center"));
    elements.push(text(item.title, x + 16, 214, 172, 14, "#252c30"));
    elements.push(text(item.detail, x + 16, 235, 172, 11, "#4b555a"));
  });
  return elements;
}

let written = 0;
for (const file of fs.readdirSync(directory).filter((name) => name.endsWith(".json"))) {
  const scenes = JSON.parse(fs.readFileSync(path.join(directory, file), "utf8"));
  for (const [id, scene] of Object.entries(scenes)) {
    const seedBase = 500000 + written * 1000;
    fs.writeFileSync(path.join(root, "public/diagrams", `${id}.excalidraw`), `${JSON.stringify({
      type: "excalidraw", version: 2, source: "SystemKit original chapter diagram",
      appState: { viewBackgroundColor: "#ffffff", gridSize: null }, files: {}, elements: sceneElements(id, scene, seedBase),
    }, null, 2)}\n`);
    written += 1;
  }
}
console.log(`Wrote ${written} Excalidraw files to public/diagrams.`);
