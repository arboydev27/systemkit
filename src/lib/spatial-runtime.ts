import {
  ACESFilmicToneMapping, AmbientLight, Box3, BufferGeometry, Color, ConeGeometry,
  CylinderGeometry, DirectionalLight, Group, Line, LineBasicMaterial, LineSegments,
  Mesh, MeshBasicMaterial, MeshStandardMaterial, PCFShadowMap, PerspectiveCamera,
  PlaneGeometry, Raycaster, Scene, SphereGeometry, SRGBColorSpace, Vector2, Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { SpatialScene, Point } from "./spatial-model";

export type SpatialRuntime = {
  select: (nodeId: string | null, linkIndex: number | null) => void;
  focus: (nodeId: string | null, linkIndex: number | null) => void;
  playback: (playing: boolean) => void;
  reduce: (reduced: boolean) => void;
  view: (top: boolean) => void;
  zoom: (factor: number) => void;
  reset: () => void;
  dispose: () => void;
};
type Options = {
  reduced: boolean; onPick: (id: string | null) => void; onUnavailable: () => void;
  onHidden: () => void; onViewChange?: (top: boolean) => void;
};
type Family = "client" | "service" | "data" | "routing" | "work" | "neutral";
type Label = { element: HTMLDivElement; object: CSS2DObject; anchor: Vector3; leader: SVGLineElement; dot: SVGCircleElement; nodeId: string | null };
type CameraMove = { started: number; from: Vector3; to: Vector3; fromTarget: Vector3; toTarget: Vector3; fromZoom: number; toZoom: number };

// Families describe authored roles; geometry never implies capacity or deployment.
function familyFor(kind: string): Family {
  if (["browser", "phone", "client", "device", "player", "person", "user"].includes(kind)) return "client";
  if (["database", "storage", "store", "cache", "index", "bucket"].includes(kind)) return "data";
  if (["balancer", "router", "gateway", "dns", "cdn", "network"].includes(kind)) return "routing";
  if (["queue", "worker", "stream", "event", "scheduler", "process", "parser", "inbox"].includes(kind)) return "work";
  if (["server", "combined", "api", "service", "provider", "filter", "trie"].includes(kind)) return "service";
  return "neutral";
}

/** Original browser renderer of the authored lesson geometry. */
export function createSpatialRuntime(host: HTMLElement, model: SpatialScene, options: Options): SpatialRuntime {
  const resources = new Set<{ dispose(): void }>();
  const keep = <T extends { dispose(): void }>(value: T): T => { resources.add(value); return value; };
  const css = getComputedStyle(host);
  const token = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  const palette = {
    surface: token("--surface", "#fff"), soft: token("--surface-soft", "#f5f5f5"), ink: token("--ink", "#171717"),
    line: token("--control-border", "#8a8a8a"), client: token("--spatial-client", "#6082a0"),
    service: token("--spatial-service", "#7875a5"), data: token("--spatial-data", "#638684"),
    routing: token("--spatial-routing", "#a48a62"), work: token("--spatial-work", "#8979a0"), neutral: token("--control-border", "#8a8a8a"),
  };
  const mix = (a: string, b: string, ratio: number) => new Color(a).lerp(new Color(b), ratio);
  const dark = new Color(palette.surface).getHSL({ h: 0, s: 0, l: 0 }).l < .4;
  const scene = new Scene(); scene.background = new Color(palette.soft);
  const authored = model.nodes.flatMap(n => [[n.x, n.y], [n.x + n.width, n.y + n.height]] as Point[])
    .concat(model.links.flatMap(l => l.points), model.groups.flatMap(g => [[g.x, g.y], [g.x + g.width, g.y + g.height]] as Point[]));
  if (model.guide === "timeline") authored.push([72, 214], [940, 214]);
  if (model.guide === "ring") authored.push([361, 76], [639, 354]);
  const minX = Math.min(...authored.map(p => p[0])), maxX = Math.max(...authored.map(p => p[0]));
  const minY = Math.min(...authored.map(p => p[1])), maxY = Math.max(...authored.map(p => p[1]));
  const centre: Point = [(minX + maxX) / 2, (minY + maxY) / 2];
  const floorWidth = Math.max(4, (maxX - minX) / 100 + 1.4), floorDepth = Math.max(2.8, (maxY - minY) / 100 + 1.4);
  const world = ([x, y]: Point, elevation = 0) => new Vector3((x - centre[0]) / 100, elevation, (y - centre[1]) / 100);
  let renderer: WebGLRenderer;
  try { renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" }); }
  catch (error) { for (const r of resources) r.dispose(); throw error; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = dark ? 1.3 : .95;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFShadowMap;
  renderer.domElement.setAttribute("aria-hidden", "true"); host.appendChild(renderer.domElement);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:hidden";
  svg.setAttribute("aria-hidden", "true"); host.appendChild(svg);
  const labels = new CSS2DRenderer(); labels.domElement.style.cssText = "position:absolute;inset:0;pointer-events:none";
  labels.domElement.setAttribute("aria-hidden", "true"); host.appendChild(labels.domElement);
  const labelItems: Label[] = [];
  function labelAt(titleText: string, detailText: string, position: Vector3, nodeId: string | null, family?: Family, category?: string) {
    const element = document.createElement("div"); element.className = "systemkit-spatial-label";
    const title = document.createElement("strong"); title.textContent = titleText; element.appendChild(title);
    if (detailText) { const detail = document.createElement("span"); detail.textContent = detailText; element.appendChild(detail); }
    if (family) element.dataset.family = family;
    if (category) { element.dataset.category = category; const kind = document.createElement("small"); kind.textContent = category; element.appendChild(kind); }
    const object = new CSS2DObject(element); object.position.copy(position); scene.add(object);
    const leader = document.createElementNS("http://www.w3.org/2000/svg", "line");
    leader.setAttribute("stroke", palette.line); leader.setAttribute("stroke-width", "1"); leader.setAttribute("stroke-linecap", "round"); svg.appendChild(leader);
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle"); dot.setAttribute("r", "2.5"); dot.setAttribute("fill", palette.ink); dot.setAttribute("opacity", ".5"); svg.appendChild(dot);
    const item = { element, object, anchor: position.clone(), leader, dot, nodeId }; labelItems.push(item); return item;
  }
  function line(path: Vector3[], color: string, opacity = 1) {
    return new Line(keep(new BufferGeometry().setFromPoints(path)), keep(new LineBasicMaterial({ color, transparent: true, opacity })));
  }
  function roundedOutline(w: number, d: number, elevation: number, radius = .065) {
    const pts: Vector3[] = [], r = Math.min(radius, w / 4, d / 4);
    const corners = [[w / 2 - r, d / 2 - r], [-w / 2 + r, d / 2 - r], [-w / 2 + r, -d / 2 + r], [w / 2 - r, -d / 2 + r]];
    for (let corner = 0; corner < 4; corner++) for (let i = 0; i <= 5; i++) {
      const angle = (corner * 90 + i * 18) * Math.PI / 180;
      pts.push(new Vector3(corners[corner][0] + r * Math.cos(angle), elevation, corners[corner][1] + r * Math.sin(angle)));
    }
    pts.push(pts[0].clone()); return pts;
  }
  const camera = new PerspectiveCamera(36, 1, .1, 120), controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = true; controls.enableZoom = false; controls.enableDamping = false;
  controls.minPolarAngle = 0; controls.maxPolarAngle = Math.PI / 2.5; controls.rotateSpeed = .5; controls.screenSpacePanning = true;
  controls.enabled = !options.reduced; renderer.domElement.style.touchAction = "pan-y";
  const home = new Vector3(2.6, 6.6, 9.3).normalize(), topDirection = new Vector3(0, 1, .0001).normalize();
  camera.position.copy(options.reduced ? topDirection : home).multiplyScalar(14); camera.lookAt(0, 0, 0);
  scene.add(new AmbientLight(0xffffff, dark ? 1.65 : 1));
  const key = new DirectionalLight(0xfff3e4, dark ? 2.7 : 1.85); key.position.set(-3, 9, 5); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -floorWidth; key.shadow.camera.right = floorWidth;
  key.shadow.camera.top = floorDepth; key.shadow.camera.bottom = -floorDepth; key.shadow.normalBias = .025; key.shadow.bias = -.00015; scene.add(key);
  const fill = new DirectionalLight(0xdbe8ff, dark ? 1.1 : .75); fill.position.set(5, 4, -5); scene.add(fill);
  const ground = new Mesh(keep(new PlaneGeometry(floorWidth, floorDepth)), keep(new MeshStandardMaterial({ color: palette.soft, roughness: 1 })));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.055; ground.receiveShadow = true; scene.add(ground);
  const grid: Vector3[] = [];
  for (let x = -floorWidth / 2; x <= floorWidth / 2; x += .5) grid.push(new Vector3(x, -.05, -floorDepth / 2), new Vector3(x, -.05, floorDepth / 2));
  for (let z = -floorDepth / 2; z <= floorDepth / 2; z += .5) grid.push(new Vector3(-floorWidth / 2, -.05, z), new Vector3(floorWidth / 2, -.05, z));
  scene.add(new LineSegments(keep(new BufferGeometry().setFromPoints(grid)), keep(new LineBasicMaterial({ color: palette.line, transparent: true, opacity: dark ? .11 : .08 }))));
  for (const frame of model.groups) {
    const { x, y, width: w, height: h } = frame;
    const platform = new Mesh(keep(new RoundedBoxGeometry(w / 100, .035, h / 100, 3, .01)), keep(new MeshStandardMaterial({ color: mix(palette.soft, palette.routing, .07), roughness: 1 })));
    platform.position.copy(world([x + w / 2, y + h / 2], -.023)); platform.receiveShadow = true; scene.add(platform);
    scene.add(line([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]].map(p => world(p as Point, .005)), palette.line, .35));
    labelAt(frame.title, "", world([x + 55, y - 9], .025), null);
  }
  if (model.guide === "ring") {
    scene.add(line(Array.from({ length: 97 }, (_, i) => world([500 + 139 * Math.cos(i / 96 * Math.PI * 2), 215 + 139 * Math.sin(i / 96 * Math.PI * 2)], .04)), palette.line, .55));
    labelAt("Clockwise", "successor lookup", world([500, 215], .12), null);
  } else if (model.guide === "timeline") scene.add(line([world([72, 214], .04), world([940, 214], .04)], palette.line, .55));
  const pickables: Mesh[] = [];
  const tiles = model.nodes.map(node => {
    const family = familyFor(node.kind), accent = palette[family], w = node.width / 100, d = node.height / 100;
    const height = family === "service" ? .95 : family === "data" ? .82 : family === "client" ? .58 : family === "work" ? .72 : family === "routing" ? .6 : .54;
    const group = new Group(); group.position.copy(world([node.x + node.width / 2, node.y + node.height / 2])); scene.add(group);
    // White-heavy blends lose family hues under lighting, including on the side faces.
    const topColor = mix(palette.surface, accent, dark ? .38 : .9);
    const sideColor = dark ? mix(palette.surface, accent, .25) : mix(palette.surface, accent, .82).lerp(new Color(palette.ink), .13);
    const topMaterial = keep(new MeshStandardMaterial({ color: topColor, roughness: .52, metalness: .08 }));
    const sideMaterial = keep(new MeshStandardMaterial({ color: sideColor, roughness: .64, metalness: .06 }));
    const accentMaterial = keep(new MeshStandardMaterial({ color: accent, roughness: .58 }));
    const insetMaterial = keep(new MeshStandardMaterial({ color: mix(palette.soft, accent, dark ? .25 : .65), roughness: .82 }));
    const surfaceMaterials = [sideMaterial, sideMaterial, topMaterial, sideMaterial, sideMaterial, sideMaterial];
    const box = (width: number, h: number, depth: number, y: number, material: MeshStandardMaterial | MeshStandardMaterial[], z = 0, x = 0) => {
      const mesh = new Mesh(keep(new RoundedBoxGeometry(width, h, depth, 3, Math.min(.055, h / 3, width / 6, depth / 6))), material);
      mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.id = node.id; group.add(mesh); pickables.push(mesh); return mesh;
    };
    if (family === "data") {
      const slab = (height - .06) / 3;
      for (let i = 0; i < 3; i++) box(w, slab, d, slab / 2 + i * (slab + .03), surfaceMaterials);
      box(w * .72, .022, .03, height - .06, accentMaterial, d / 2 + .008);
    } else {
      box(w, height, d, height / 2, surfaceMaterials);
      if (family === "client") {
        box(w * .82, .025, d * .66, height + .014, insetMaterial); box(w * .22, .012, .025, height + .032, accentMaterial, d * .21);
      } else if (family === "service") {
        box(w * .74, .021, d * .2, height + .011, insetMaterial, -d * .19);
        for (let i = 0; i < 3; i++) box(w * .35, .015, .016, .1 + i * .045, insetMaterial, d / 2 + .005, -w * .19);
        box(.03, height * .57, .017, height / 2, accentMaterial, d / 2 + .008, w * .36);
      } else if (family === "work") {
        for (let i = 0; i < 3; i++) box(w * .14, .025, d * .56, height + .014, insetMaterial, 0, (i - 1) * w * .25);
      } else if (family === "routing") {
        box(w * .7, .022, d * .58, height + .014, insetMaterial);
        for (let i = 0; i < 3; i++) box(.05, .035, .018, height * .45, accentMaterial, d / 2 + .008, (i - 1) * w * .18);
      }
    }
    const outline = line(roundedOutline(w + .045, d + .045, height + .044), palette.line, .28); group.add(outline);
    const halo = line(roundedOutline(w + .16, d + .16, .006, .08), palette.ink); halo.visible = false; group.add(halo);
    const category = family !== "neutral" && !node.title.toLowerCase().includes(node.kind.toLowerCase()) && node.detail.toLowerCase() !== node.kind.toLowerCase() ? node.kind : "";
    const label = labelAt(node.title, node.detail, world([node.x + node.width / 2, node.y + node.height / 2], height + .13), node.id, family, category);
    return { node, family, height, group, topMaterial, sideMaterial, topColor, sideColor, outline, halo, label };
  });
  const nodeById = new Map(tiles.map(tile => [tile.node.id, tile])), up = new Vector3(0, 1, 0);
  function cylinder(start: Vector3, end: Vector3, radius: number, material: MeshStandardMaterial) {
    const delta = end.clone().sub(start), length = delta.length(); if (length < .0001) return null;
    const mesh = new Mesh(keep(new CylinderGeometry(radius, radius, length, 8, 1)), material);
    mesh.position.copy(start).add(end).multiplyScalar(.5); mesh.quaternion.setFromUnitVectors(up, delta.divideScalar(length)); return mesh;
  }
  const channels = model.links.map(link => {
    const source = link.source ? nodeById.get(link.source) : null, target = link.target ? nodeById.get(link.target) : null;
    const planar = link.points.map(p => world(p)), lengths = planar.slice(1).map((p, i) => p.distanceTo(planar[i]));
    const total = lengths.reduce((sum, value) => sum + value, 0), startHeight = source ? source.height * .52 : .17, endHeight = target ? target.height * .52 : .17;
    let distance = 0;
    const pts = planar.map((point, i) => { if (i) distance += lengths[i - 1]; point.y = startHeight + (endHeight - startHeight) * (total ? distance / total : 0); return point; });
    const material = keep(new MeshStandardMaterial({ color: palette.line, roughness: .66, transparent: true, opacity: .78 }));
    const group = new Group(); let covered = 0;
    for (let i = 1; i < pts.length; i++) {
      const start = pts[i - 1], end = pts[i], delta = end.clone().sub(start), length = delta.length();
      if (link.dashed) {
        const period = .17, dash = .095;
        for (let at = 0; at < length;) {
          const phase = (covered + at) % period, next = Math.min(length, at + (phase < dash ? dash - phase : period - phase));
          if (phase < dash) { const mesh = cylinder(start.clone().addScaledVector(delta, at / length), start.clone().addScaledVector(delta, next / length), .018, material); if (mesh) group.add(mesh); }
          at = next + .00001;
        }
      } else { const mesh = cylinder(start, end, .018, material); if (mesh) group.add(mesh); }
      covered += length;
    }
    if (link.arrow) {
      const end = pts[pts.length - 1], before = [...pts.slice(0, -1)].reverse().find(p => p.distanceTo(end) > .001);
      if (before) { const direction = end.clone().sub(before).normalize(), arrow = new Mesh(keep(new ConeGeometry(.047, .12, 10)), material); arrow.position.copy(end).addScaledVector(direction, -.06); arrow.quaternion.setFromUnitVectors(up, direction); group.add(arrow); }
    }
    for (const point of [pts[0], pts[pts.length - 1]]) { const port = new Mesh(keep(new SphereGeometry(.032, 10, 8)), material); port.position.copy(point); group.add(port); }
    scene.add(group); const segmentLengths = pts.slice(1).map((p, i) => p.distanceTo(pts[i]));
    return { link, group, material, pts, lengths: segmentLengths, total: segmentLengths.reduce((sum, value) => sum + value, 0) };
  });
  const marker = new Mesh(keep(new SphereGeometry(.042, 12, 10)), keep(new MeshBasicMaterial({ color: palette.ink }))); marker.visible = false; scene.add(marker);
  const overviewBounds = new Box3(world([minX, minY], -.05), world([maxX, maxY], Math.max(...tiles.map(tile => tile.height)) + .25));
  let framedBounds = overviewBounds.clone(), selectedNode: string | null = null, selectedLink: number | null = null, hoveredNode: string | null = null;
  let disposed = false, visible = true, reduced = options.reduced, playing = false, frame = 0, started = 0, inTick = false, labelsDirty = true;
  let cameraMove: CameraMove | null = null, lastTop: boolean | null = null;
  const focusIds = () => { const link = selectedLink === null ? null : model.links[selectedLink]; return new Set([selectedNode, link?.source, link?.target].filter((id): id is string => Boolean(id))); };
  function updateEmphasis() {
    const focused = focusIds(), hasSelection = selectedNode !== null || selectedLink !== null;
    for (const tile of tiles) {
      const active = focused.has(tile.node.id), hover = hoveredNode === tile.node.id;
      tile.topMaterial.color.copy(tile.topColor); tile.sideMaterial.color.copy(tile.sideColor);
      if (hasSelection && !active) { tile.topMaterial.color.lerp(new Color(palette.soft), .38); tile.sideMaterial.color.lerp(new Color(palette.soft), .28); }
      if (active || hover) tile.topMaterial.color.lerp(new Color(palette[tile.family]), active ? .1 : .05);
      tile.outline.material.color.set(active ? palette.ink : hover ? palette[tile.family] : palette.line); tile.outline.material.opacity = active ? 1 : hover ? .85 : .28; tile.halo.visible = active;
      tile.label.element.dataset.selected = String(active); tile.label.element.dataset.hovered = String(hover); tile.label.element.style.opacity = hasSelection && !active && !hover ? ".7" : "1";
    }
    for (let i = 0; i < channels.length; i++) {
      const channel = channels[i], connected = selectedNode !== null && (channel.link.source === selectedNode || channel.link.target === selectedNode), active = i === selectedLink || connected;
      channel.material.color.set(active ? palette.ink : palette.line); channel.material.opacity = hasSelection ? active ? 1 : .22 : .78;
      channel.material.emissive.set(active ? palette.ink : "#000000"); channel.material.emissiveIntensity = active ? .1 : 0;
      for (const part of channel.group.children) part.scale.set(active ? 1.35 : 1, 1, active ? 1.35 : 1);
    }
    labelsDirty = true; requestDraw();
  }
  function reportView() {
    const isTop = camera.position.clone().sub(controls.target).normalize().y > .995;
    if (isTop !== lastTop) { lastTop = isTop; options.onViewChange?.(isTop); }
  }
  function fitPosition(bounds: Box3, direction: Vector3) {
    const target = bounds.getCenter(new Vector3()); camera.position.copy(target).add(direction); camera.lookAt(target); camera.updateMatrixWorld();
    const inverse = camera.quaternion.clone().invert(), vertical = Math.tan(camera.fov * Math.PI / 360), horizontal = vertical * camera.aspect;
    let distance = 0;
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      const p = new Vector3(x, y, z).sub(target).applyQuaternion(inverse); distance = Math.max(distance, p.z + Math.abs(p.x) / horizontal, p.z + Math.abs(p.y) / vertical);
    }
    return { target, position: target.clone().addScaledVector(direction, Math.max(2.2, distance * 1.12 + .25)) };
  }
  function moveTo(bounds: Box3, direction: Vector3, animated = true, zoom = 1) {
    const from = camera.position.clone(), fromTarget = controls.target.clone(), fromZoom = camera.zoom, destination = fitPosition(bounds, direction);
    camera.position.copy(from); camera.lookAt(fromTarget); camera.updateMatrixWorld(); framedBounds = bounds.clone();
    if (!animated || reduced) {
      cameraMove = null; camera.position.copy(destination.position); controls.target.copy(destination.target); camera.zoom = zoom; camera.updateProjectionMatrix(); controls.update(); reportView(); labelsDirty = true; requestDraw(); return;
    }
    cameraMove = { started: performance.now(), from, to: destination.position, fromTarget, toTarget: destination.target, fromZoom, toZoom: zoom }; requestDraw();
  }
  function packLabels() {
    const width = host.clientWidth, height = host.clientHeight, focused = focusIds(), occupied: { x: number; y: number; w: number; h: number }[] = [];
    const priority = (item: Label) => focused.has(item.nodeId ?? "") ? 0 : item.nodeId === hoveredNode && hoveredNode !== null ? 1 : item.nodeId ? 2 : 3;
    for (const item of [...labelItems].sort((a, b) => priority(a) - priority(b))) {
      const point = item.anchor.clone().project(camera), x = (point.x + 1) * width / 2, y = (-point.y + 1) * height / 2;
      const active = focused.has(item.nodeId ?? ""), tile = item.nodeId ? nodeById.get(item.nodeId) : null;
      let projectedWidth = 150;
      if (tile) { const left = world([tile.node.x, tile.node.y + tile.node.height / 2], tile.height).project(camera), right = world([tile.node.x + tile.node.width, tile.node.y + tile.node.height / 2], tile.height).project(camera); projectedWidth = Math.abs(right.x - left.x) * width / 2; }
      item.element.dataset.density = !active && (width < 560 || projectedWidth < 95) ? "compact" : "full";
      item.element.style.maxWidth = `${active ? Math.min(190, width - 24) : Math.max(60, Math.min(170, projectedWidth * 1.12))}px`;
      const w = item.element.offsetWidth, h = item.element.offsetHeight; let best = { x: 0, y: 0, cost: Infinity }, bestOverlap = Infinity;
      for (const dy of [0, -24, 24, -48, 48, -72, 72]) for (const dx of [0, -24, 24, -48, 48]) {
        const px = Math.max(10, Math.min(width - w - 10, x - w / 2 + dx)), py = Math.max(10, Math.min(height - h - 10, y - h / 2 + dy));
        const overlap = occupied.reduce((sum, r) => sum + Math.max(0, Math.min(px + w + 5, r.x + r.w + 5) - Math.max(px - 5, r.x - 5)) * Math.max(0, Math.min(py + h + 4, r.y + r.h + 4) - Math.max(py - 4, r.y - 4)), 0);
        const cost = overlap * 20 + Math.hypot(px + w / 2 - x, py + h / 2 - y); if (cost < best.cost) { best = { x: px, y: py, cost }; bestOverlap = overlap; }
      }
      const shiftX = best.x + w / 2 - x, shiftY = best.y + h / 2 - y, offscreen = point.z < -1 || point.z > 1 || Math.abs(point.x) > 1.12 || Math.abs(point.y) > 1.12;
      const hidden = offscreen || !active && bestOverlap > w * h * .45;
      item.element.style.marginLeft = `${shiftX}px`; item.element.style.marginTop = `${shiftY}px`; item.element.style.visibility = hidden ? "hidden" : "visible";
      item.element.dataset.packed = String(Math.hypot(shiftX, shiftY) > 10); item.leader.style.display = hidden || Math.hypot(shiftX, shiftY) < 10 ? "none" : "";
      item.leader.setAttribute("x1", String(x)); item.leader.setAttribute("y1", String(y)); item.leader.setAttribute("x2", String(best.x + w / 2)); item.leader.setAttribute("y2", String(best.y + h / 2)); item.leader.setAttribute("opacity", active ? ".65" : ".3");
      item.dot.setAttribute("cx", String(x)); item.dot.setAttribute("cy", String(y)); item.dot.style.display = hidden && !offscreen && item.nodeId ? "" : "none";
      if (!hidden) occupied.push({ x: best.x, y: best.y, w, h });
    }
  }
  function draw() {
    if (disposed || !visible || document.hidden) return; renderer.render(scene, camera);
    if (labelsDirty) { labels.render(scene, camera); packLabels(); labelsDirty = false; }
  }
  function requestDraw() { if (!disposed && visible && !document.hidden && !frame && !inTick) frame = requestAnimationFrame(tick); }
  function tick(time: number) {
    frame = 0; if (disposed || !visible || document.hidden) return; inTick = true;
    if (cameraMove) {
      const t = Math.min(1, (time - cameraMove.started) / 360), ease = 1 - Math.pow(1 - t, 3);
      camera.position.lerpVectors(cameraMove.from, cameraMove.to, ease); controls.target.lerpVectors(cameraMove.fromTarget, cameraMove.toTarget, ease);
      camera.zoom = cameraMove.fromZoom + (cameraMove.toZoom - cameraMove.fromZoom) * ease; camera.updateProjectionMatrix(); controls.update(); reportView(); labelsDirty = true; if (t >= 1) cameraMove = null;
    }
    const channel = selectedLink === null ? null : channels[selectedLink], progress = Math.min(1, (time - started) / 2600); marker.visible = playing && !reduced && channel !== null;
    if (marker.visible && channel) { let travel = progress * channel.total; for (let i = 0; i < channel.lengths.length; i++) { if (travel <= channel.lengths[i] || i === channel.lengths.length - 1) { marker.position.copy(channel.pts[i]).lerp(channel.pts[i + 1], channel.lengths[i] ? travel / channel.lengths[i] : 0); break; } travel -= channel.lengths[i]; } }
    draw(); inTick = false; if (cameraMove || marker.visible && progress < 1) requestDraw();
  }
  function resize() {
    const width = host.clientWidth, height = host.clientHeight; if (!width || !height) return;
    const direction = reduced ? topDirection : camera.position.clone().sub(controls.target).normalize();
    const target = hasFraming ? controls.target.clone() : framedBounds.getCenter(new Vector3());
    camera.aspect = width / height; renderer.setSize(width, height); labels.setSize(width, height);
    const fitted = fitPosition(framedBounds, direction);
    cameraMove = null; camera.position.copy(target).addScaledVector(direction, fitted.position.distanceTo(fitted.target));
    controls.target.copy(target); camera.lookAt(target); camera.updateProjectionMatrix(); controls.update();
    hasFraming = true; labelsDirty = true; reportView(); requestDraw();
  }
  let hasFraming = false;
  const observer = new ResizeObserver(resize); observer.observe(host);
  const pauseHidden = () => { playing = false; cameraMove = null; marker.visible = false; if (frame) cancelAnimationFrame(frame); frame = 0; options.onHidden(); };
  const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (!visible) pauseHidden(); else requestDraw(); }); intersection.observe(host);
  const change = () => {
    if (!inTick && !cameraMove && !reduced) {
      const target = controls.target.clone(), direction = camera.position.clone().sub(target).normalize();
      const fitted = fitPosition(framedBounds, direction);
      camera.position.copy(target).addScaledVector(direction, fitted.position.distanceTo(fitted.target));
      camera.lookAt(target); camera.updateMatrixWorld();
    }
    labelsDirty = true; reportView(); requestDraw();
  }, manipulation = () => { cameraMove = null; };
  controls.addEventListener("change", change); controls.addEventListener("start", manipulation);
  const lost = (event: Event) => { event.preventDefault(); options.onUnavailable(); }; renderer.domElement.addEventListener("webglcontextlost", lost);
  const ray = new Raycaster(), pointer = new Vector2(); let down: [number, number] | null = null;
  const hitNode = (event: PointerEvent) => { const rect = renderer.domElement.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1); ray.setFromCamera(pointer, camera); return ray.intersectObjects(pickables, false)[0]?.object.userData.id as string | undefined; };
  const start = (event: PointerEvent) => { if (event.button === 0) down = [event.clientX, event.clientY]; cameraMove = null; };
  const pick = (event: PointerEvent) => { const origin = down; down = null; if (origin && Math.hypot(event.clientX - origin[0], event.clientY - origin[1]) <= 6) options.onPick(hitNode(event) ?? null); };
  const hover = (event: PointerEvent) => { if (event.pointerType !== "mouse" || down) return; const id = hitNode(event) ?? null; if (id !== hoveredNode) { hoveredNode = id; renderer.domElement.style.cursor = id ? "pointer" : ""; updateEmphasis(); } };
  const leave = () => { down = null; if (hoveredNode) { hoveredNode = null; renderer.domElement.style.cursor = ""; updateEmphasis(); } };
  renderer.domElement.addEventListener("pointerdown", start); renderer.domElement.addEventListener("pointerup", pick); renderer.domElement.addEventListener("pointermove", hover); renderer.domElement.addEventListener("pointerleave", leave); renderer.domElement.addEventListener("pointercancel", leave);
  const keyboard = (event: KeyboardEvent) => {
    if (event.target !== host || reduced || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return; event.preventDefault(); cameraMove = null;
    const offset = camera.position.clone().sub(controls.target);
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") offset.applyAxisAngle(up, event.key === "ArrowLeft" ? -.08 : .08);
    else { const axis = new Vector3().crossVectors(offset, up).normalize(); offset.applyAxisAngle(axis, event.key === "ArrowUp" ? -.06 : .06); if (Math.acos(offset.y / offset.length()) > controls.maxPolarAngle || offset.y < 0) return; }
    camera.position.copy(controls.target).add(offset); controls.update(); reportView(); labelsDirty = true; requestDraw();
  }; host.addEventListener("keydown", keyboard);
  const visibility = () => { if (document.hidden) pauseHidden(); else requestDraw(); }; document.addEventListener("visibilitychange", visibility);
  resize(); controls.update(); updateEmphasis(); draw();
  return {
    select(nodeId, linkIndex) { selectedNode = nodeId; selectedLink = linkIndex; started = performance.now(); updateEmphasis(); },
    focus(nodeId, linkIndex) {
      if (reduced) return; const bounds = new Box3(), selected = linkIndex === null ? null : channels[linkIndex];
      if (selected) for (const point of selected.pts) bounds.expandByPoint(point);
      for (const id of selected ? [selected.link.source, selected.link.target] : [nodeId]) { const tile = id ? nodeById.get(id) : null; if (tile) bounds.union(new Box3(world([tile.node.x, tile.node.y], 0), world([tile.node.x + tile.node.width, tile.node.y + tile.node.height], tile.height + .3))); }
      if (!bounds.isEmpty()) bounds.expandByScalar(.18); moveTo(bounds.isEmpty() ? overviewBounds : bounds, camera.position.clone().sub(controls.target).normalize());
    },
    playback(value) { playing = value && !reduced; started = performance.now(); marker.visible = playing && selectedLink !== null; requestDraw(); },
    reduce(value) { reduced = value; controls.enabled = !value; renderer.domElement.style.touchAction = "pan-y"; if (value) { playing = false; marker.visible = false; hoveredNode = null; } moveTo(overviewBounds, value ? topDirection : home, false); updateEmphasis(); },
    view(top) { if (!reduced) moveTo(framedBounds, top ? topDirection : home); },
    zoom(factor) { if (reduced) return; const next = Math.max(.7, Math.min(2.5, (cameraMove?.toZoom ?? camera.zoom) * factor)); cameraMove = { started: performance.now(), from: camera.position.clone(), to: camera.position.clone(), fromTarget: controls.target.clone(), toTarget: controls.target.clone(), fromZoom: camera.zoom, toZoom: next }; requestDraw(); },
    reset() { moveTo(overviewBounds, reduced ? topDirection : home, !reduced); },
    dispose() {
      disposed = true; if (frame) cancelAnimationFrame(frame); cameraMove = null; observer.disconnect(); intersection.disconnect(); controls.removeEventListener("change", change); controls.removeEventListener("start", manipulation); controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", start); renderer.domElement.removeEventListener("pointerup", pick); renderer.domElement.removeEventListener("pointermove", hover); renderer.domElement.removeEventListener("pointerleave", leave); renderer.domElement.removeEventListener("pointercancel", leave); renderer.domElement.removeEventListener("webglcontextlost", lost);
      host.removeEventListener("keydown", keyboard); document.removeEventListener("visibilitychange", visibility); for (const item of labelItems) item.element.remove(); for (const resource of resources) resource.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); labels.domElement.remove(); svg.remove();
    },
  };
}
