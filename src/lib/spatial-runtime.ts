import {
  ACESFilmicToneMapping, AmbientLight, Box3, BufferGeometry, Color, ConeGeometry,
  CylinderGeometry, DirectionalLight, Group, Line, LineBasicMaterial, LineSegments,
  Material, Mesh, MeshBasicMaterial, MeshStandardMaterial, PCFShadowMap, PerspectiveCamera,
  PlaneGeometry, Raycaster, Scene, SphereGeometry, SRGBColorSpace, Vector2, Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { Point } from "./spatial-model";
import type { LearningLink, LearningNode, LearningScene, RelationMeaning } from "./spatial-learning-types";

export type SpatialRuntime = {
  select: (nodeId: string | null, linkIndex: number | null) => void;
  focus: (nodeId: string | null, linkIndex: number | null) => void;
  spotlight: (nodeIds: string[], linkIds: string[]) => void;
  focusSpotlight: () => void;
  fitPresentation: () => void;
  reconcile: (next: LearningScene, options?: { animate?: boolean }) => void;
  playback: (playing: boolean) => void;
  reduce: (reduced: boolean) => void;
  view: (top: boolean) => void;
  zoom: (factor: number) => void;
  reset: () => void;
  dispose: () => void;
};
type Options = {
  reduced: boolean; onPick: (id: string | null, trigger?: HTMLButtonElement) => void; onUnavailable: () => void;
  onHidden: () => void; onViewChange?: (top: boolean) => void;
  onLinkPick?: (id: string, trigger?: HTMLButtonElement) => void; onGroupPick?: (id: string) => void; onInteraction?: () => void;
};
type Family = "client" | "service" | "data" | "routing" | "work" | "neutral";
type Disposable = { dispose(): void };
type Bucket = Set<Disposable>;
type Label = {
  element: HTMLDivElement | HTMLButtonElement; object: CSS2DObject; anchor: Vector3;
  leader: SVGLineElement; dot: SVGCircleElement; nodeId: string | null; linkId: string | null;
  enabled: boolean; cleanup: () => void;
};
type Tile = {
  node: LearningNode; family: Family; group: Group; bucket: Bucket;
  baseWidth: number; baseDepth: number; baseHeight: number;
  topMaterial: MeshStandardMaterial; sideMaterial: MeshStandardMaterial;
  topColor: Color; sideColor: Color; outline: Line<BufferGeometry, LineBasicMaterial>;
  halo: Line<BufferGeometry, LineBasicMaterial>; statusMark: Group; label: Label;
  opacity: number; emphasis: number; velocity: Vector3;
};
type Channel = {
  link: LearningLink; group: Group; bucket: Bucket; material: MeshStandardMaterial;
  color: Color; pts: Vector3[]; lengths: number[]; total: number; opacity: number; label: Label;
};
type Decoration = { group: Group; bucket: Bucket; labels: Label[]; opacity: number };
type NodeTrack = {
  tile: Tile; from: Vector3; to: Vector3; velocity: Vector3;
  fromScale: Vector3; toScale: Vector3; fromOpacity: number; toOpacity: number;
  outgoing: boolean;
};
type ModelMove = {
  started: number; nodes: NodeTrack[];
  outgoingChannels: Map<Channel, number>; outgoingDecorations: Map<Decoration, number>;
};
type CameraMove = { started: number; from: Vector3; to: Vector3; fromTarget: Vector3; toTarget: Vector3; fromZoom: number; toZoom: number };
type MarkerLeg = { channel: Channel; start: number; duration: number };
type RetainedNode = { node: LearningNode; position: [number, number, number]; width: number; depth: number; height: number; opacity: number };
type ChapterSnapshot = {
  lessonId: string; nodes: Map<string, RetainedNode>; origin: Point;
  camera: [number, number, number]; target: [number, number, number]; zoom: number;
};

// Data only: remounted lesson pages never retain a WebGL object or DOM element.
const chapterSnapshots = new Map<string, ChapterSnapshot>();
let lastDisposedChapter: string | null = null;
const SNAPSHOT_CHAPTERS = 6, SNAPSHOT_NODES = 96;

function familyFor(kind: string): Family {
  if (["browser", "phone", "client", "device", "player", "person", "user"].includes(kind)) return "client";
  if (["database", "storage", "store", "cache", "index", "bucket"].includes(kind)) return "data";
  if (["balancer", "router", "gateway", "dns", "cdn", "network"].includes(kind)) return "routing";
  if (["queue", "worker", "stream", "event", "scheduler", "process", "parser", "inbox"].includes(kind)) return "work";
  if (["server", "combined", "api", "service", "provider", "filter", "trie"].includes(kind)) return "service";
  return "neutral";
}
const heightFor = (family: Family) => family === "service" ? .95 : family === "data" ? .82 : family === "client" ? .58 : family === "work" ? .72 : family === "routing" ? .6 : .54;

/** Original browser presentation of SystemKit's authored semantic lesson model. */
export function createSpatialRuntime(host: HTMLElement, initial: LearningScene, options: Options): SpatialRuntime {
  let model = initial;
  const priorSnapshot = lastDisposedChapter === initial.chapterId ? chapterSnapshots.get(initial.chapterId) : undefined;
  const resources = new Set<Disposable>(), materialOpacity = new WeakMap<Material, number>();
  let building: Bucket = resources;
  const keep = <T extends Disposable>(value: T): T => {
    building.add(value); resources.add(value);
    if (value instanceof Material) materialOpacity.set(value, value.opacity);
    return value;
  };
  const release = (bucket: Bucket) => { for (const value of bucket) { value.dispose(); resources.delete(value); } bucket.clear(); };
  function inBucket<T>(bucket: Bucket, action: () => T): T { const previous = building; building = bucket; try { return action(); } finally { building = previous; } }
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
  const statusColor = (status?: LearningNode["status"]) => status === "unavailable" ? dark ? "#e79188" : "#a64c43" : dark ? "#e5bc75" : "#956b27";
  const relationColor = (meaning: RelationMeaning): Color => new Color(meaning === "connection" ? palette.line : token(`--spatial-${meaning}`,
    meaning === "request" || meaning === "publish" ? palette.routing :
    meaning === "response" || meaning === "acknowledgement" ? palette.client :
    meaning === "read" || meaning === "delivery" ? palette.data :
    meaning === "write" ? palette.service : meaning === "replication" ? palette.work : palette.line,
  ));
  const scene = new Scene(); scene.background = new Color(palette.soft);
  let centre: Point = [0, 0], minX = 0, maxX = 0, minY = 0, maxY = 0;
  const world = ([x, y]: Point, elevation = 0) => new Vector3((x - centre[0]) / 100, elevation, (y - centre[1]) / 100);
  function measure(next: LearningScene, resetOrigin = false) {
    const authored = next.nodes.flatMap(n => [[n.x, n.y], [n.x + n.width, n.y + n.height]] as Point[])
      .concat(next.links.flatMap(l => l.points), next.groups.flatMap(g => [[g.x, g.y], [g.x + g.width, g.y + g.height]] as Point[]), next.guidePath ?? []);
    if (!authored.length) authored.push([-100, -100], [100, 100]);
    minX = Math.min(...authored.map(p => p[0])); maxX = Math.max(...authored.map(p => p[0]));
    minY = Math.min(...authored.map(p => p[1])); maxY = Math.max(...authored.map(p => p[1]));
    if (resetOrigin) centre = [(minX + maxX) / 2, (minY + maxY) / 2];
  }
  measure(model, true);
  if (priorSnapshot) centre = [...priorSnapshot.origin];
  let renderer: WebGLRenderer;
  const teardowns: (() => void)[] = [];
  function cleanup() {
    for (const teardown of teardowns.reverse()) { try { teardown(); } catch { /* Continue cleaning a partially initialized renderer. */ } }
    teardowns.length = 0;
  }
  try {
  try { renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" }); }
  catch (error) { release(resources); throw error; }
  teardowns.push(() => { renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); });
  teardowns.push(() => release(resources));
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = dark ? 1.3 : .95;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFShadowMap;
  renderer.domElement.setAttribute("aria-hidden", "true"); host.appendChild(renderer.domElement);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:hidden";
  svg.setAttribute("aria-hidden", "true"); host.appendChild(svg);
  teardowns.push(() => svg.remove());
  const labels = new CSS2DRenderer(); labels.domElement.style.cssText = "position:absolute;inset:0;pointer-events:none";
  labels.domElement.setAttribute("role", "group"); labels.domElement.setAttribute("aria-label", "Diagram components and relationships"); host.appendChild(labels.domElement);
  teardowns.push(() => labels.domElement.remove());
  const labelItems: Label[] = [];
  let focusedControl: Label | null = null;
  let pendingControlFocus: { nodeId: string | null; linkId: string | null; semanticId?: string } | null = null;
  teardowns.push(() => { for (const item of [...labelItems]) removeLabel(item); });
  function labelAt(position: Vector3, nodeId: string | null, linkId: string | null = null): Label {
    const interactive = nodeId !== null || linkId !== null;
    const element = document.createElement(interactive ? "button" : "div");
    element.className = linkId !== null ? "systemkit-spatial-relationship" : "systemkit-spatial-label";
    if (element instanceof HTMLButtonElement) {
      element.type = "button"; element.style.pointerEvents = "auto";
      element.dataset.control = linkId !== null ? "relationship" : "node";
    } else element.setAttribute("aria-hidden", "true");
    const object = new CSS2DObject(element); object.position.copy(position); scene.add(object);
    // Keep DOM order stable even when the 3D anchor leaves the camera frustum.
    labels.domElement.appendChild(element);
    const leader = document.createElementNS("http://www.w3.org/2000/svg", "line");
    leader.setAttribute("stroke", palette.line); leader.setAttribute("stroke-width", "1"); leader.setAttribute("stroke-linecap", "round"); svg.appendChild(leader);
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle"); dot.setAttribute("r", "2.5"); dot.setAttribute("fill", palette.ink); dot.setAttribute("opacity", ".5"); svg.appendChild(dot);
    const item: Label = { element, object, anchor: position.clone(), leader, dot, nodeId, linkId, enabled: interactive, cleanup() {} };
    if (element instanceof HTMLButtonElement) {
      const focus = () => {
        focusedControl = item; item.element.dataset.focused = "true"; updateEmphasis();
        // Suppressed targets remain native tab stops; reveal the focused control before paint.
        labels.render(scene, camera); packLabels();
      };
      const blur = () => { if (focusedControl === item) focusedControl = null; item.element.dataset.focused = "false"; updateEmphasis(); };
      const activate = () => {
        if (!item.enabled) return;
        options.onInteraction?.();
        if (item.nodeId !== null) options.onPick(item.nodeId, element);
        else if (item.linkId !== null) options.onLinkPick?.(item.linkId, element);
      };
      element.addEventListener("focus", focus); element.addEventListener("blur", blur); element.addEventListener("click", activate);
      item.cleanup = () => { element.removeEventListener("focus", focus); element.removeEventListener("blur", blur); element.removeEventListener("click", activate); };
    }
    labelItems.push(item); return item;
  }
  function enableLabel(item: Label, enabled: boolean) {
    if (!(item.element instanceof HTMLButtonElement)) return;
    item.enabled = enabled; item.element.disabled = !enabled; item.element.tabIndex = enabled ? 0 : -1;
    item.element.style.pointerEvents = enabled ? "auto" : "none";
    if (enabled) item.element.removeAttribute("aria-hidden"); else item.element.setAttribute("aria-hidden", "true");
    if (!enabled && document.activeElement === item.element) host.focus({ preventScroll: true });
  }
  function labelText(item: Label, titleText: string, detailText: string, category = "") {
    item.element.replaceChildren(); const title = document.createElement("strong"); title.textContent = titleText; item.element.appendChild(title);
    if (detailText) { const detail = document.createElement("span"); detail.textContent = detailText; item.element.appendChild(detail); }
    if (category) { const kind = document.createElement("small"); kind.textContent = category; item.element.appendChild(kind); }
    item.element.dataset.category = category;
  }
  function removeLabel(item: Label) { item.cleanup(); if (focusedControl === item) focusedControl = null; scene.remove(item.object); item.element.remove(); item.leader.remove(); item.dot.remove(); const i = labelItems.indexOf(item); if (i >= 0) labelItems.splice(i, 1); }
  function line(path: Vector3[], color: Color | string, opacity = 1) {
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
  const camera = new PerspectiveCamera(36, 1, .1, 160), controls = new OrbitControls(camera, renderer.domElement);
  teardowns.push(() => controls.dispose());
  controls.enablePan = true; controls.enableZoom = false; controls.enableDamping = false;
  controls.minPolarAngle = 0; controls.maxPolarAngle = Math.PI / 2.5; controls.rotateSpeed = .5; controls.screenSpacePanning = true;
  controls.enabled = !options.reduced; renderer.domElement.style.touchAction = "pan-y";
  const up = new Vector3(0, 1, 0), home = new Vector3(2.6, 6.6, 9.3).normalize(), topDirection = new Vector3(0, 1, .0001).normalize();
  camera.position.copy(options.reduced ? topDirection : home).multiplyScalar(14); camera.lookAt(0, 0, 0);
  scene.add(new AmbientLight(0xffffff, dark ? 1.65 : 1));
  const key = new DirectionalLight(0xfff3e4, dark ? 2.7 : 1.85); key.position.set(-3, 9, 5); key.castShadow = true;
  teardowns.push(() => key.shadow.map?.dispose());
  key.shadow.mapSize.set(1024, 1024); key.shadow.normalBias = .025; key.shadow.bias = -.00015; scene.add(key);
  const fill = new DirectionalLight(0xdbe8ff, dark ? 1.1 : .75); fill.position.set(5, 4, -5); scene.add(fill);
  let floor: Decoration | null = null, decorations: Decoration[] = [];
  function opacity(bucket: Bucket, amount: number) {
    for (const resource of bucket) if (resource instanceof Material) {
      resource.opacity = (materialOpacity.get(resource) ?? 1) * amount;
      resource.transparent = true; resource.depthWrite = (materialOpacity.get(resource) ?? 1) > 0 && amount > .5 && !(resource instanceof LineBasicMaterial);
    }
  }
  function disposeDecoration(item: Decoration) { scene.remove(item.group); for (const label of item.labels) removeLabel(label); release(item.bucket); }
  function makeFloor() {
    if (floor) disposeDecoration(floor);
    const width = Math.max(4, (maxX - minX) / 100 + 1.4), depth = Math.max(2.8, (maxY - minY) / 100 + 1.4);
    const bucket: Bucket = new Set(), group = new Group();
    group.position.copy(world([(minX + maxX) / 2, (minY + maxY) / 2]));
    inBucket(bucket, () => {
      const ground = new Mesh(keep(new PlaneGeometry(width, depth)), keep(new MeshStandardMaterial({ color: palette.soft, roughness: 1 })));
      ground.rotation.x = -Math.PI / 2; ground.position.y = -.055; ground.receiveShadow = true; group.add(ground);
      const grid: Vector3[] = [];
      for (let x = -width / 2; x <= width / 2; x += .5) grid.push(new Vector3(x, -.05, -depth / 2), new Vector3(x, -.05, depth / 2));
      for (let z = -depth / 2; z <= depth / 2; z += .5) grid.push(new Vector3(-width / 2, -.05, z), new Vector3(width / 2, -.05, z));
      group.add(new LineSegments(keep(new BufferGeometry().setFromPoints(grid)), keep(new LineBasicMaterial({ color: palette.line, transparent: true, opacity: dark ? .11 : .08 }))));
    });
    scene.add(group); floor = { group, bucket, labels: [], opacity: 1 };
    const shadowWidth = Math.max(width, Math.abs(group.position.x) + width), shadowDepth = Math.max(depth, Math.abs(group.position.z) + depth);
    key.shadow.camera.left = -shadowWidth; key.shadow.camera.right = shadowWidth; key.shadow.camera.top = shadowDepth; key.shadow.camera.bottom = -shadowDepth;
    key.shadow.camera.updateProjectionMatrix();
  }
  function makeDecorations(): Decoration[] {
    const items: Decoration[] = [];
    for (const frame of model.groups) {
      const bucket: Bucket = new Set(), group = new Group(), { x, y, width: w, height: h } = frame;
      inBucket(bucket, () => {
        const platform = new Mesh(keep(new RoundedBoxGeometry(w / 100, .035, h / 100, 3, .01)), keep(new MeshStandardMaterial({ color: mix(palette.soft, palette.routing, .07), roughness: 1, transparent: true })));
        platform.position.copy(world([x + w / 2, y + h / 2], -.023)); platform.receiveShadow = true; platform.userData.groupId = frame.id; group.add(platform);
        group.add(line([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]].map(p => world(p as Point, .005)), palette.line, .35));
      });
      const label = labelAt(world([x + w / 2, y - 14], .025), null); labelText(label, frame.title, "", `${frame.members.length} component${frame.members.length === 1 ? "" : "s"}`);
      scene.add(group); items.push({ group, bucket, labels: [label], opacity: 1 });
    }
    if (model.guidePath && model.guidePath.length > 1) {
      const bucket: Bucket = new Set(), group = new Group(); inBucket(bucket, () => group.add(line(model.guidePath!.map(p => world(p, .04)), palette.line, .55)));
      scene.add(group); items.push({ group, bucket, labels: [], opacity: 1 });
    }
    return items;
  }
  let tiles: Tile[] = [], outgoingTiles: Tile[] = [], channels: Channel[] = [], outgoingChannels: Channel[] = [], outgoingDecorations: Decoration[] = [];
  const nodeById = new Map<string, Tile>();
  function createTile(node: LearningNode, position = world([node.x + node.width / 2, node.y + node.height / 2]), heightOverride?: number): Tile {
    const bucket: Bucket = new Set(), family = familyFor(node.kind), accent = palette[family], w = node.width / 100, d = node.height / 100, height = heightOverride ?? heightFor(family);
    const group = new Group(); group.position.copy(position); scene.add(group);
    const topColor = mix(palette.surface, accent, dark ? .38 : .9);
    const sideColor = dark ? mix(palette.surface, accent, .25) : mix(palette.surface, accent, .82).lerp(new Color(palette.ink), .13);
    const tile = inBucket(bucket, () => {
      const topMaterial = keep(new MeshStandardMaterial({ color: topColor, roughness: .52, metalness: .08, transparent: true }));
      const sideMaterial = keep(new MeshStandardMaterial({ color: sideColor, roughness: .64, metalness: .06, transparent: true }));
      const accentMaterial = keep(new MeshStandardMaterial({ color: accent, roughness: .58, transparent: true }));
      const insetMaterial = keep(new MeshStandardMaterial({ color: mix(palette.soft, accent, dark ? .25 : .65), roughness: .82, transparent: true }));
      const surfaceMaterials = [sideMaterial, sideMaterial, topMaterial, sideMaterial, sideMaterial, sideMaterial];
      const box = (width: number, h: number, depth: number, y: number, material: MeshStandardMaterial | MeshStandardMaterial[], z = 0, x = 0) => {
        const mesh = new Mesh(keep(new RoundedBoxGeometry(width, h, depth, 3, Math.min(.055, h / 3, width / 6, depth / 6))), material);
        mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh;
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
      const statusMark = new Group(), statusMaterial = keep(new LineBasicMaterial({ color: statusColor(node.status), transparent: true, opacity: .95 }));
      const cross = new LineSegments(keep(new BufferGeometry().setFromPoints([new Vector3(-w * .35, height + .06, -d * .3), new Vector3(w * .35, height + .06, d * .3), new Vector3(w * .35, height + .06, -d * .3), new Vector3(-w * .35, height + .06, d * .3)])), statusMaterial); cross.userData.status = "unavailable"; statusMark.add(cross);
      const pressure = new LineSegments(keep(new BufferGeometry().setFromPoints([new Vector3(-w * .3, height + .06, d * .3), new Vector3(-w * .3, height + .06, -d * .3), new Vector3(0, height + .06, d * .3), new Vector3(0, height + .06, -d * .3), new Vector3(w * .3, height + .06, d * .3), new Vector3(w * .3, height + .06, -d * .3)])), statusMaterial); pressure.userData.status = "under-pressure"; statusMark.add(pressure); group.add(statusMark);
      const label = labelAt(position.clone().add(new Vector3(0, height + .13, 0)), node.id);
      return { node, family, group, bucket, baseWidth: w, baseDepth: d, baseHeight: height, topMaterial, sideMaterial, topColor, sideColor, outline, halo, statusMark, label, opacity: 1, emphasis: 1, velocity: new Vector3() };
    });
    updateTileData(tile, node); return tile;
  }
  function updateTileData(tile: Tile, node: LearningNode) {
    tile.node = node; tile.label.nodeId = node.id; tile.label.element.dataset.family = tile.family;
    tile.label.element.dataset.semanticId = node.semanticId; tile.label.element.dataset.nodeId = node.id;
    tile.label.element.dataset.status = node.status ?? "active"; tile.label.element.dataset.proxy = String(Boolean(node.members?.length));
    const count = node.members?.length, status = node.status === "unavailable" ? "Unavailable" : node.status === "under-pressure" ? "Under pressure" : "";
    const category = count ? `${count} components` : tile.family !== "neutral" && !node.title.toLowerCase().includes(node.kind.toLowerCase()) ? node.kind : "";
    labelText(tile.label, node.title, node.detail, [category, status].filter(Boolean).join(" · "));
    tile.label.element.setAttribute("aria-label", [node.title, node.detail, status, "Inspect component"].filter(Boolean).join(". "));
    tile.statusMark.visible = Boolean(status);
    for (const child of tile.statusMark.children) { child.visible = child.userData.status === node.status; if (child instanceof LineSegments) child.material.color.set(statusColor(node.status)); }
    tile.group.traverse(object => { if (object instanceof Mesh) { object.userData.id = node.id; object.userData.semanticId = node.semanticId; } });
  }
  function placeLabel(tile: Tile) { tile.label.anchor.copy(tile.group.position).y += tile.baseHeight * tile.group.scale.y + .13; tile.label.object.position.copy(tile.label.anchor); }
  function disposeTile(tile: Tile) { scene.remove(tile.group); removeLabel(tile.label); release(tile.bucket); }
  function cylinder(start: Vector3, end: Vector3, radius: number, material: MeshStandardMaterial | MeshBasicMaterial) {
    const delta = end.clone().sub(start), length = delta.length(); if (length < .0001) return null;
    const mesh = new Mesh(keep(new CylinderGeometry(radius, radius, length, 8, 1)), material);
    mesh.position.copy(start).add(end).multiplyScalar(.5); mesh.quaternion.setFromUnitVectors(up, delta.divideScalar(length)); return mesh;
  }
  function createChannel(link: LearningLink): Channel {
    const bucket: Bucket = new Set(), group = new Group();
    return inBucket(bucket, () => {
      const source = link.source ? nodeById.get(link.source) : null, target = link.target ? nodeById.get(link.target) : null;
      const planar = link.points.map(p => world(p)), lengths = planar.slice(1).map((p, i) => p.distanceTo(planar[i]));
      const total = lengths.reduce((sum, value) => sum + value, 0), startHeight = source ? heightFor(familyFor(source.node.kind)) * .52 : .17, endHeight = target ? heightFor(familyFor(target.node.kind)) * .52 : .17;
      let distance = 0;
      const pts = planar.map((point, i) => { if (i) distance += lengths[i - 1]; point.y = startHeight + (endHeight - startHeight) * (total ? distance / total : 0); return point; });
      const color = relationColor(link.meaning), material = keep(new MeshStandardMaterial({ color, roughness: .66, transparent: true, opacity: .84 }));
      const hitMaterial = keep(new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      const dashed = link.dashed, radius = link.meaning === "publish" || link.meaning === "delivery" ? .022 : .018;
      let covered = 0;
      for (let i = 1; i < pts.length; i++) {
        const start = pts[i - 1], end = pts[i], delta = end.clone().sub(start), length = delta.length();
        if (dashed) {
          const period = link.meaning === "replication" ? .24 : .17, dash = link.meaning === "replication" ? .15 : .095;
          for (let at = 0; at < length;) {
            const phase = (covered + at) % period, next = Math.min(length, at + (phase < dash ? dash - phase : period - phase));
            if (phase < dash) { const mesh = cylinder(start.clone().addScaledVector(delta, at / length), start.clone().addScaledVector(delta, next / length), radius, material); if (mesh) group.add(mesh); }
            at = next + .00001;
          }
        } else { const mesh = cylinder(start, end, radius, material); if (mesh) group.add(mesh); }
        const hit = cylinder(start, end, .065, hitMaterial); if (hit) { hit.userData.hitOnly = true; group.add(hit); }
        covered += length;
      }
      if (link.arrow && pts.length > 1) {
        const end = pts[pts.length - 1], before = [...pts.slice(0, -1)].reverse().find(p => p.distanceTo(end) > .001);
        if (before) { const direction = end.clone().sub(before).normalize(), arrow = new Mesh(keep(new ConeGeometry(.055, .14, 10)), material); arrow.position.copy(end).addScaledVector(direction, -.07); arrow.quaternion.setFromUnitVectors(up, direction); group.add(arrow); }
      }
      if (pts.length) for (const point of [pts[0], pts[pts.length - 1]]) { const port = new Mesh(keep(new SphereGeometry(.032, 10, 8)), material); port.position.copy(point); group.add(port); }
      for (const object of group.children) { object.userData.linkId = link.id; object.userData.origins = link.origins; object.userData.meaning = link.meaning; }
      scene.add(group); const segmentLengths = pts.slice(1).map((p, i) => p.distanceTo(pts[i]));
      const routeLength = segmentLengths.reduce((sum, value) => sum + value, 0);
      let remaining = routeLength / 2, midpoint = pts[0]?.clone() ?? new Vector3();
      for (let i = 0; i < segmentLengths.length; i++) {
        if (remaining <= segmentLengths[i] || i === segmentLengths.length - 1) { midpoint.copy(pts[i]).lerp(pts[i + 1], segmentLengths[i] ? remaining / segmentLengths[i] : 0); break; }
        remaining -= segmentLengths[i];
      }
      midpoint.y += .08;
      const label = labelAt(midpoint, null, link.id);
      label.element.textContent = "·"; label.element.dataset.linkId = link.id;
      const channel = { link, group, bucket, material, color, pts, lengths: segmentLengths, total: routeLength, opacity: 1, label };
      updateChannelLabel(channel); return channel;
    });
  }
  function updateChannelLabel(channel: Channel) {
    const source = model.nodes.find(node => node.id === channel.link.source)?.title ?? "Boundary";
    const target = model.nodes.find(node => node.id === channel.link.target)?.title ?? "Boundary";
    const meaning = channel.link.meaning.replace(/^[a-z]/, letter => letter.toUpperCase());
    const name = `${source} → ${target}. ${meaning}${channel.link.label && channel.link.label !== "Connection" ? ` · ${channel.link.label}` : ""}. Inspect relationship`;
    channel.label.element.setAttribute("aria-label", name); channel.label.element.title = name;
    channel.label.element.dataset.caption = `${source} → ${target} · ${meaning}`;
  }
  function disposeChannel(channel: Channel) { scene.remove(channel.group); removeLabel(channel.label); release(channel.bucket); }
  const marker = new Mesh(keep(new SphereGeometry(.045, 12, 10)), keep(new MeshBasicMaterial({ color: palette.ink }))); marker.visible = false; scene.add(marker);
  marker.userData.playbackMarker = true;
  let overviewBounds = new Box3(), framedBounds = new Box3();
  let selectedNode: string | null = null, selectedLink: number | null = null, hoveredNode: string | null = null;
  let spotlightNodes = new Set<string>(), spotlightLinks = new Set<string>();
  let disposed = false, visible = true, reduced = options.reduced, playing = false, frame = 0, started = 0, inTick = false, labelsDirty = true;
  let cameraMove: CameraMove | null = null, modelMove: ModelMove | null = null, lastTop: boolean | null = null;
  teardowns.push(() => { disposed = true; if (frame) cancelAnimationFrame(frame); frame = 0; cameraMove = null; modelMove = null; });
  let markerLegs: MarkerLeg[] = [], markerDuration = 0;
  function prepareMarker() {
    const requested = selectedLink !== null ? [channels[selectedLink]].filter((channel): channel is Channel => Boolean(channel)) :
      [...spotlightLinks].flatMap(id => { const channel = channels.find(c => c.link.id === id || c.link.origins.includes(id)); return channel ? [channel] : []; });
    const seen = new Set<string>(), paths = requested.filter(channel => {
      if (seen.has(channel.link.id) || !channel.total || channel.pts.length < 2) return false;
      seen.add(channel.link.id); return true;
    });
    const gap = 80, rawDurations = paths.map(channel => selectedLink !== null ? 2600 : Math.max(680, Math.min(1150, 650 + channel.total * 65)));
    const rawTotal = rawDurations.reduce((sum, duration) => sum + duration, 0), budget = Math.max(500, 4200 - gap * Math.max(0, paths.length - 1));
    const scale = selectedLink !== null || rawTotal <= budget ? 1 : budget / rawTotal;
    let at = 0;
    markerLegs = paths.map((channel, index) => { const duration = rawDurations[index] * scale, leg = { channel, start: at, duration }; at += duration + gap; return leg; });
    markerDuration = Math.max(0, at - gap); started = performance.now(); marker.visible = false;
  }
  function updateBounds() { overviewBounds = new Box3(world([minX, minY], -.05), world([maxX, maxY], Math.max(.6, ...model.nodes.map(n => heightFor(familyFor(n.kind)))) + .25)); if (framedBounds.isEmpty()) framedBounds.copy(overviewBounds); }
  function focusIds() {
    const link = selectedLink === null ? null : channels[selectedLink]?.link;
    const result = new Set(spotlightNodes);
    if (focusedControl?.nodeId) result.add(focusedControl.nodeId);
    const focusedLink = focusedControl?.linkId ? channels.find(channel => channel.link.id === focusedControl!.linkId)?.link : null;
    for (const id of [focusedLink?.source, focusedLink?.target]) if (id) result.add(id);
    for (const id of [selectedNode, link?.source, link?.target]) if (id) result.add(id);
    for (const channel of channels) if (spotlightLinks.has(channel.link.id) || channel.link.origins.some(id => spotlightLinks.has(id))) { if (channel.link.source) result.add(channel.link.source); if (channel.link.target) result.add(channel.link.target); }
    return result;
  }
  function updateEmphasis() {
    const focused = focusIds(), hasSelection = focused.size > 0 || selectedLink !== null || spotlightLinks.size > 0;
    for (const tile of tiles) {
      const active = focused.has(tile.node.id) || tile.node.members?.some(id => focused.has(id)) === true, hover = hoveredNode === tile.node.id;
      tile.topMaterial.color.copy(tile.topColor); tile.sideMaterial.color.copy(tile.sideColor);
      if (hasSelection && !active) { tile.topMaterial.color.lerp(new Color(palette.soft), .38); tile.sideMaterial.color.lerp(new Color(palette.soft), .28); }
      if (tile.node.status === "unavailable") { tile.topMaterial.color.lerp(new Color(palette.soft), .6); tile.sideMaterial.color.lerp(new Color(palette.soft), .4); }
      else if (tile.node.status === "under-pressure") tile.topMaterial.color.lerp(new Color(statusColor(tile.node.status)), .18);
      if (active || hover) tile.topMaterial.color.lerp(new Color(palette[tile.family]), active ? .1 : .05);
      tile.outline.material.color.set(active ? palette.ink : tile.node.status && tile.node.status !== "active" ? statusColor(tile.node.status) : hover ? palette[tile.family] : palette.line);
      materialOpacity.set(tile.outline.material, active ? 1 : hover ? .85 : tile.node.status && tile.node.status !== "active" ? .8 : .28); tile.halo.visible = active;
      tile.label.element.dataset.selected = String(active); tile.label.element.dataset.hovered = String(hover);
      tile.label.element.setAttribute("aria-pressed", String(tile.node.id === selectedNode));
      tile.emphasis = hasSelection && !active && !hover ? .66 : 1;
      opacity(tile.bucket, tile.opacity); tile.label.element.style.opacity = String(tile.emphasis * tile.opacity);
    }
    for (let i = 0; i < channels.length; i++) {
      const channel = channels[i], connected = selectedNode !== null && (channel.link.source === selectedNode || channel.link.target === selectedNode);
      const active = i === selectedLink || connected || spotlightLinks.has(channel.link.id) || channel.link.origins.some(id => spotlightLinks.has(id)) || focusedControl === channel.label;
      channel.label.element.dataset.selected = String(active); channel.label.element.setAttribute("aria-pressed", String(i === selectedLink));
      channel.material.color.copy(channel.color); if (active) channel.material.color.lerp(new Color(palette.ink), .25);
      materialOpacity.set(channel.material, hasSelection ? active ? 1 : .19 : .84);
      channel.material.emissive.copy(active ? channel.color : new Color("#000000")); channel.material.emissiveIntensity = active ? .18 : 0;
      for (const part of channel.group.children) if (!part.userData.hitOnly) part.scale.set(active ? 1.3 : 1, 1, active ? 1.3 : 1);
      opacity(channel.bucket, channel.opacity);
    }
    labelsDirty = true; requestDraw();
  }
  function reportView() { const isTop = camera.position.clone().sub(controls.target).normalize().y > .995; if (isTop !== lastTop) { lastTop = isTop; options.onViewChange?.(isTop); } }
  function fitPosition(bounds: Box3, direction: Vector3) {
    const oldPosition = camera.position.clone(), oldQuaternion = camera.quaternion.clone(), target = bounds.getCenter(new Vector3());
    camera.position.copy(target).add(direction); camera.lookAt(target); camera.updateMatrixWorld();
    const inverse = camera.quaternion.clone().invert(), vertical = Math.tan(camera.fov * Math.PI / 360), horizontal = vertical * camera.aspect;
    let distance = 0;
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      const p = new Vector3(x, y, z).sub(target).applyQuaternion(inverse); distance = Math.max(distance, p.z + Math.abs(p.x) / horizontal, p.z + Math.abs(p.y) / vertical);
    }
    camera.position.copy(oldPosition); camera.quaternion.copy(oldQuaternion); camera.updateMatrixWorld();
    return { target, position: target.clone().addScaledVector(direction, Math.max(2.2, distance * 1.12 + .25)) };
  }
  function moveTo(bounds: Box3, direction: Vector3, animated = true, zoom = 1) {
    const destination = fitPosition(bounds, direction); framedBounds.copy(bounds);
    if (!animated || reduced) { cameraMove = null; camera.position.copy(destination.position); controls.target.copy(destination.target); camera.zoom = zoom; camera.updateProjectionMatrix(); controls.update(); reportView(); labelsDirty = true; requestDraw(); return; }
    cameraMove = { started: performance.now(), from: camera.position.clone(), to: destination.position, fromTarget: controls.target.clone(), toTarget: destination.target, fromZoom: camera.zoom, toZoom: zoom }; requestDraw();
  }
  function tileBounds(tile: Tile) {
    const p = tile.group.position, w = tile.baseWidth * tile.group.scale.x / 2, d = tile.baseDepth * tile.group.scale.z / 2;
    return new Box3(new Vector3(p.x - w, p.y, p.z - d), new Vector3(p.x + w, p.y + tile.baseHeight * tile.group.scale.y + .3, p.z + d));
  }
  function focusBounds(ids: Set<string>, linkIds: Set<string>) {
    const bounds = new Box3();
    for (const channel of channels) if (linkIds.has(channel.link.id) || channel.link.origins.some(id => linkIds.has(id))) for (const point of channel.pts) bounds.expandByPoint(point);
    for (const tile of tiles) if (ids.has(tile.node.id) || tile.node.members?.some(id => ids.has(id))) bounds.union(tileBounds(tile));
    if (!bounds.isEmpty()) bounds.expandByScalar(.18); return bounds.isEmpty() ? overviewBounds : bounds;
  }
  function packLabels() {
    const width = host.clientWidth, height = host.clientHeight; if (!width || !height) return;
    const focused = focusIds(), hostRect = host.getBoundingClientRect();
    const occupied: { x: number; y: number; w: number; h: number }[] = [];
    for (const overlay of host.parentElement?.querySelectorAll<HTMLElement>("[data-spatial-overlay]") ?? []) {
      const bounds = overlay.getBoundingClientRect();
      if (bounds.width && bounds.height) occupied.push({ x: bounds.left - hostRect.left, y: bounds.top - hostRect.top, w: bounds.width, h: bounds.height });
    }
    const priority = (item: Label) => item === focusedControl ? -1 : focused.has(item.nodeId ?? "") ? 0 : item.nodeId === hoveredNode && hoveredNode !== null ? 1 : item.nodeId ? 2 : item.linkId ? 3 : 4;
    for (const item of [...labelItems].sort((a, b) => priority(a) - priority(b))) {
      const tile = item.nodeId ? nodeById.get(item.nodeId) : undefined;
      const channel = item.linkId ? channels.find(value => value.link.id === item.linkId) : undefined;
      const control = item.element instanceof HTMLButtonElement;
      const live = tile?.label === item ? tile.opacity >= .16 : channel?.label === item ? channel.opacity >= .16 : false;
      if (control) enableLabel(item, live);
      const point = item.anchor.clone().project(camera), rawX = (point.x + 1) * width / 2, rawY = (-point.y + 1) * height / 2;
      const x = Number.isFinite(rawX) ? Math.max(10, Math.min(width - 10, rawX)) : width / 2;
      const y = Number.isFinite(rawY) ? Math.max(10, Math.min(height - 10, rawY)) : height / 2;
      const active = item === focusedControl || focused.has(item.nodeId ?? "") || tile?.node.members?.some(id => focused.has(id)) || Boolean(channel && (channels.indexOf(channel) === selectedLink || spotlightLinks.has(channel.link.id) || channel.link.origins.some(origin => spotlightLinks.has(origin))));
      let projectedWidth = 150;
      if (tile) {
        const p = tile.group.position, half = tile.baseWidth * tile.group.scale.x / 2;
        const left = new Vector3(p.x - half, p.y + tile.baseHeight * tile.group.scale.y, p.z).project(camera), right = new Vector3(p.x + half, p.y + tile.baseHeight * tile.group.scale.y, p.z).project(camera);
        projectedWidth = Math.abs(right.x - left.x) * width / 2;
      }
      item.element.dataset.density = !active && (width < 560 || projectedWidth < 95) ? "compact" : "full";
      item.element.style.maxWidth = item.linkId ? "none" : `${active ? Math.min(190, width - 24) : Math.max(80, Math.min(170, projectedWidth * 1.12))}px`;
      if (control && live) item.element.style.display = "";
      const w = item.element.offsetWidth, h = item.element.offsetHeight;
      let best = { x: 10, y: 10, cost: Infinity }, bestOverlap = Infinity;
      const candidates: { x: number; y: number }[] = [];
      for (const dy of [0, -24, 24, -48, 48, -72, 72]) for (const dx of [0, -24, 24, -48, 48]) candidates.push({ x: x - w / 2 + dx, y: y - h / 2 + dy });
      if (control && active) for (let py = 10; py <= height - h - 10; py += Math.max(22, h + 8)) for (let px = 10; px <= width - w - 10; px += Math.max(28, w / 2)) candidates.push({ x: px, y: py });
      for (const candidate of candidates) {
        const px = Math.max(10, Math.min(width - w - 10, candidate.x)), py = Math.max(10, Math.min(height - h - 10, candidate.y));
        const overlap = occupied.reduce((sum, r) => sum + Math.max(0, Math.min(px + w + 5, r.x + r.w + 5) - Math.max(px - 5, r.x - 5)) * Math.max(0, Math.min(py + h + 4, r.y + r.h + 4) - Math.max(py - 4, r.y - 4)), 0);
        const cost = overlap * 20 + Math.hypot(px + w / 2 - x, py + h / 2 - y);
        if (cost < best.cost) { best = { x: px, y: py, cost }; bestOverlap = overlap; }
      }
      const offscreen = point.z < -1 || point.z > 1 || Math.abs(point.x) > 1.12 || Math.abs(point.y) > 1.12;
      const faded = control ? !live : Number(item.element.style.opacity || 1) < .12;
      const suppressed = control ? !live || !active && (item.linkId !== null || offscreen || bestOverlap > w * h * .45) : offscreen || faded || !active && bestOverlap > w * h * .45;
      const hidden = !control && suppressed;
      if (control) {
        // Idle relationships add no chrome; native focus synchronously reveals their target.
        item.element.style.opacity = suppressed ? "0" : item === focusedControl ? "1" : String(tile ? tile.opacity * tile.emphasis : 1);
        item.element.style.pointerEvents = suppressed ? "none" : "auto";
        item.element.dataset.suppressed = String(suppressed);
      }
      item.element.style.marginLeft = "0px"; item.element.style.marginTop = "0px";
      item.element.style.transform = `translate(-50%, -50%) translate(${best.x + w / 2}px, ${best.y + h / 2}px)`;
      item.element.style.visibility = hidden ? "hidden" : "visible";
      item.element.dataset.offscreen = String(offscreen); item.element.dataset.packed = String(Math.hypot(best.x + w / 2 - rawX, best.y + h / 2 - rawY) > 10);
      if (item === focusedControl) item.element.style.zIndex = "10000";
      item.leader.style.display = suppressed || offscreen || item.linkId !== null && !active || Math.hypot(best.x + w / 2 - rawX, best.y + h / 2 - rawY) < 10 ? "none" : "";
      item.leader.setAttribute("x1", String(rawX)); item.leader.setAttribute("y1", String(rawY)); item.leader.setAttribute("x2", String(best.x + w / 2)); item.leader.setAttribute("y2", String(best.y + h / 2)); item.leader.setAttribute("opacity", active ? ".65" : ".3");
      item.dot.style.display = "none";
      if (!suppressed) occupied.push({ x: best.x, y: best.y, w, h });
    }
    if (pendingControlFocus && !(pendingControlFocus.semanticId ? model.nodes.some(node => node.semanticId === pendingControlFocus!.semanticId) : pendingControlFocus.nodeId ? model.nodes.some(node => node.id === pendingControlFocus!.nodeId) : model.links.some(link => link.id === pendingControlFocus!.linkId))) pendingControlFocus = null;
    if (pendingControlFocus) {
      const target = labelItems.find(item => item.enabled && (pendingControlFocus!.semanticId ? item.element.dataset.semanticId === pendingControlFocus!.semanticId : pendingControlFocus!.nodeId ? item.nodeId === pendingControlFocus!.nodeId : item.linkId === pendingControlFocus!.linkId));
      if (target) { pendingControlFocus = null; target.element.focus({ preventScroll: true }); }
    }
  }
  function draw() { if (disposed || !visible || document.hidden) return; renderer.render(scene, camera); if (labelsDirty) { labelsDirty = false; labels.render(scene, camera); packLabels(); } }
  function requestDraw() { if (!disposed && visible && !document.hidden && !frame && !inTick) frame = requestAnimationFrame(tick); }
  function finishModelMove() {
    if (!modelMove) return;
    for (const track of modelMove.nodes) {
      if (track.outgoing) disposeTile(track.tile);
      else { track.tile.group.position.copy(track.to); track.tile.group.scale.copy(track.toScale); track.tile.velocity.set(0, 0, 0); track.tile.opacity = track.toOpacity; placeLabel(track.tile); }
    }
    for (const channel of outgoingChannels) disposeChannel(channel);
    for (const decoration of outgoingDecorations) disposeDecoration(decoration);
    outgoingTiles = []; outgoingChannels = []; outgoingDecorations = []; modelMove = null;
    if (playing) started = performance.now();
    for (const channel of channels) { channel.opacity = 1; opacity(channel.bucket, 1); }
    for (const decoration of decorations) { decoration.opacity = 1; opacity(decoration.bucket, 1); for (const label of decoration.labels) label.element.style.opacity = "1"; }
    updateEmphasis();
  }
  function tick(time: number) {
    frame = 0; if (disposed || !visible || document.hidden) return; inTick = true;
    if (cameraMove) {
      const t = Math.min(1, (time - cameraMove.started) / 360), ease = 1 - Math.pow(1 - t, 3);
      camera.position.lerpVectors(cameraMove.from, cameraMove.to, ease); controls.target.lerpVectors(cameraMove.fromTarget, cameraMove.toTarget, ease);
      camera.zoom = cameraMove.fromZoom + (cameraMove.toZoom - cameraMove.fromZoom) * ease; camera.updateProjectionMatrix(); controls.update(); reportView(); labelsDirty = true; if (t >= 1) cameraMove = null;
    }
    if (modelMove) {
      const elapsed = Math.max(0, (time - modelMove.started) / 1000), t = Math.min(1, elapsed / .62), ease = 1 - Math.pow(1 - t, 3), decay = Math.exp(-16 * elapsed);
      for (const track of modelMove.nodes) {
        const delta = track.from.clone().sub(track.to), coefficient = track.velocity.clone().addScaledVector(delta, 16);
        track.tile.group.position.copy(track.to).add(delta.addScaledVector(coefficient, elapsed).multiplyScalar(decay));
        track.tile.velocity.copy(track.velocity).addScaledVector(coefficient, -16 * elapsed).multiplyScalar(decay);
        track.tile.group.scale.lerpVectors(track.fromScale, track.toScale, ease);
        track.tile.opacity = track.fromOpacity + (track.toOpacity - track.fromOpacity) * ease;
        opacity(track.tile.bucket, track.tile.opacity); track.tile.label.element.style.opacity = String(track.tile.opacity * track.tile.emphasis); placeLabel(track.tile);
      }
      const entering = Math.max(0, Math.min(1, (t - .35) / .65)), leaving = Math.max(0, 1 - t / .45);
      for (const channel of channels) { channel.opacity = entering; opacity(channel.bucket, entering); }
      for (const channel of outgoingChannels) { channel.opacity = (modelMove.outgoingChannels.get(channel) ?? 1) * leaving; opacity(channel.bucket, channel.opacity); }
      for (const decoration of decorations) { decoration.opacity = entering; opacity(decoration.bucket, entering); for (const label of decoration.labels) label.element.style.opacity = String(entering); }
      for (const decoration of outgoingDecorations) { decoration.opacity = (modelMove.outgoingDecorations.get(decoration) ?? 1) * leaving; opacity(decoration.bucket, decoration.opacity); for (const label of decoration.labels) label.element.style.opacity = String(decoration.opacity); }
      labelsDirty = true; if (t >= 1) finishModelMove();
    }
    const elapsed = time - started, pendingMarker = playing && !reduced && !modelMove && markerLegs.length > 0 && elapsed < markerDuration;
    const leg = playing && !reduced && !modelMove ? markerLegs.find(item => elapsed >= item.start && elapsed <= item.start + item.duration) : undefined;
    marker.visible = Boolean(leg);
    if (leg) {
      const channel = leg.channel, progress = Math.min(1, Math.max(0, (elapsed - leg.start) / leg.duration));
      marker.userData.linkId = channel.link.id; marker.userData.origins = channel.link.origins;
      let travel = progress * channel.total;
      for (let i = 0; i < channel.lengths.length; i++) { if (travel <= channel.lengths[i] || i === channel.lengths.length - 1) { marker.position.copy(channel.pts[i]).lerp(channel.pts[i + 1], channel.lengths[i] ? travel / channel.lengths[i] : 0); break; } travel -= channel.lengths[i]; }
    }
    draw(); inTick = false; if (cameraMove || modelMove || pendingMarker || labelsDirty) requestDraw();
  }
  function reconcile(next: LearningScene, settings: { animate?: boolean } = {}) {
    if (disposed) return;
    const presentationKey = (value: LearningScene) => JSON.stringify([
      value.chapterId, value.lessonId,
      value.nodes.map(n => [n.id, n.semanticId, n.x, n.y, n.width, n.height, n.kind, n.members]),
      value.links.map(l => [l.id, l.source, l.target, l.meaning, l.dashed, l.arrow, l.points, l.origins]),
      value.groups, value.guidePath,
    ]);
    if (tiles.length === next.nodes.length && tiles.length > 0 && nodeById.size === next.nodes.length && channels.length === next.links.length &&
      next.nodes.every(n => nodeById.get(n.id)?.node.semanticId === n.semanticId) && presentationKey(model) === presentationKey(next)) {
      model = next;
      for (const node of next.nodes) { const tile = nodeById.get(node.id); if (tile) updateTileData(tile, node); }
      for (const channel of channels) { const link = next.links.find(l => l.id === channel.link.id); if (link) { channel.link = link; updateChannelLabel(channel); } }
      updateEmphasis(); return;
    }
    const changedChapter = model.chapterId !== next.chapterId;
    const animate = settings.animate !== false && !changedChapter && !reduced && visible && !document.hidden;
    const previousSelectedLink = selectedLink === null ? null : channels[selectedLink]?.link.id;
    // Re-target from current presentation positions, including a departing node revived by Back.
    const previous = new Map([...outgoingTiles, ...tiles].map(tile => [tile.node.semanticId, tile]));
    const oldChannels = [...outgoingChannels, ...channels], oldDecorations = [...outgoingDecorations, ...decorations];
    if (focusedControl) pendingControlFocus = { nodeId: focusedControl.nodeId, linkId: focusedControl.linkId, semanticId: focusedControl.element.dataset.semanticId };
    for (const channel of oldChannels) enableLabel(channel.label, false);
    modelMove = null; channels = []; decorations = []; outgoingTiles = []; outgoingChannels = []; outgoingDecorations = [];
    model = next; measure(model, changedChapter); nodeById.clear(); const tracks: NodeTrack[] = [];
    tiles = model.nodes.map(node => {
      const prior = previous.get(node.semanticId), destination = world([node.x + node.width / 2, node.y + node.height / 2]);
      let tile = prior ?? createTile(node, destination); previous.delete(node.semanticId);
      if (prior && prior.family !== familyFor(node.kind)) {
        tile = createTile(node, prior.group.position.clone());
        tile.group.scale.set(prior.baseWidth * prior.group.scale.x / tile.baseWidth, prior.baseHeight * prior.group.scale.y / tile.baseHeight, prior.baseDepth * prior.group.scale.z / tile.baseDepth);
        tile.velocity.copy(prior.velocity); tile.opacity = prior.opacity; disposeTile(prior);
      }
      if (!prior) tile.opacity = animate ? 0 : 1;
      updateTileData(tile, node); nodeById.set(node.id, tile);
      const scale = new Vector3(node.width / 100 / tile.baseWidth, heightFor(familyFor(node.kind)) / tile.baseHeight, node.height / 100 / tile.baseDepth);
      tracks.push({ tile, from: tile.group.position.clone(), to: destination, velocity: tile.velocity.clone(), fromScale: tile.group.scale.clone(), toScale: scale, fromOpacity: tile.opacity, toOpacity: 1, outgoing: false });
      return tile;
    });
    for (const tile of previous.values()) { enableLabel(tile.label, false); outgoingTiles.push(tile); tracks.push({ tile, from: tile.group.position.clone(), to: tile.group.position.clone(), velocity: new Vector3(), fromScale: tile.group.scale.clone(), toScale: tile.group.scale.clone(), fromOpacity: tile.opacity, toOpacity: 0, outgoing: true }); }
    channels = model.links.map(createChannel); decorations = makeDecorations(); makeFloor(); updateBounds();
    selectedNode = selectedNode && nodeById.has(selectedNode) ? selectedNode : null;
    selectedLink = previousSelectedLink ? channels.findIndex(c => c.link.id === previousSelectedLink) : null; if (selectedLink === -1) selectedLink = null;
    hoveredNode = null; playing = false; marker.visible = false; markerLegs = []; markerDuration = 0;
    if (animate) {
      outgoingChannels = oldChannels; outgoingDecorations = oldDecorations;
      modelMove = { started: performance.now(), nodes: tracks, outgoingChannels: new Map(outgoingChannels.map(channel => [channel, channel.opacity])), outgoingDecorations: new Map(outgoingDecorations.map(decoration => [decoration, decoration.opacity])) };
      for (const channel of channels) { channel.opacity = 0; opacity(channel.bucket, 0); }
      for (const decoration of decorations) { decoration.opacity = 0; opacity(decoration.bucket, 0); for (const label of decoration.labels) label.element.style.opacity = "0"; }
    } else {
      for (const track of tracks) { if (track.outgoing) disposeTile(track.tile); else { track.tile.group.position.copy(track.to); track.tile.group.scale.copy(track.toScale); track.tile.opacity = 1; track.tile.velocity.set(0, 0, 0); placeLabel(track.tile); } }
      outgoingTiles = []; for (const channel of oldChannels) disposeChannel(channel); for (const decoration of oldDecorations) disposeDecoration(decoration);
    }
    updateEmphasis(); requestDraw();
  }
  if (priorSnapshot && !reduced && priorSnapshot.lessonId !== model.lessonId) {
    for (const entry of priorSnapshot.nodes.values()) {
      const node = { ...entry.node, width: entry.width * 100, height: entry.depth * 100 };
      const tile = createTile(node, new Vector3(...entry.position), entry.height); tile.opacity = entry.opacity; tiles.push(tile);
    }
  }
  if (priorSnapshot && !reduced) { camera.position.set(...priorSnapshot.camera); controls.target.set(...priorSnapshot.target); camera.zoom = priorSnapshot.zoom; }
  reconcile(initial, { animate: Boolean(priorSnapshot && !reduced && priorSnapshot.lessonId !== model.lessonId) });
  let hasFraming = Boolean(priorSnapshot && !reduced);
  let fitNewLesson = Boolean(priorSnapshot && !reduced && priorSnapshot.lessonId !== model.lessonId);
  function resize() {
    const width = host.clientWidth, height = host.clientHeight; if (!width || !height) return;
    const oldAspect = camera.aspect; camera.aspect = width / height; renderer.setSize(width, height); labels.setSize(width, height);
    if (!hasFraming) { moveTo(overviewBounds, reduced ? topDirection : home, false); hasFraming = true; }
    else if (oldAspect !== camera.aspect && oldAspect > 0) { const offset = camera.position.clone().sub(controls.target); if (camera.aspect < oldAspect) offset.multiplyScalar(Math.min(1.7, oldAspect / camera.aspect)); camera.position.copy(controls.target).add(offset); cameraMove = null; }
    if (fitNewLesson) { fitNewLesson = false; moveTo(overviewBounds, camera.position.clone().sub(controls.target).normalize(), true); }
    camera.updateProjectionMatrix(); controls.update(); labelsDirty = true; reportView(); requestDraw();
  }
  const observer = new ResizeObserver(resize);
  teardowns.push(() => observer.disconnect());
  observer.observe(host);
  const pauseHidden = () => { playing = false; cameraMove = null; marker.visible = false; if (frame) cancelAnimationFrame(frame); frame = 0; if (modelMove) finishModelMove(); options.onHidden(); };
  const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (!visible) pauseHidden(); else requestDraw(); });
  teardowns.push(() => intersection.disconnect());
  intersection.observe(host);
  const change = () => { labelsDirty = true; reportView(); requestDraw(); };
  const manipulation = () => { cameraMove = null; options.onInteraction?.(); if (playing) { playing = false; marker.visible = false; options.onHidden(); } };
  controls.addEventListener("change", change); controls.addEventListener("start", manipulation);
  teardowns.push(() => { controls.removeEventListener("change", change); controls.removeEventListener("start", manipulation); });
  const lost = (event: Event) => { event.preventDefault(); options.onUnavailable(); }; renderer.domElement.addEventListener("webglcontextlost", lost);
  teardowns.push(() => renderer.domElement.removeEventListener("webglcontextlost", lost));
  const ray = new Raycaster(), pointer = new Vector2(); let down: [number, number] | null = null;
  function hit(event: PointerEvent): { nodeId?: string; linkId?: string; groupId?: string } {
    const rect = renderer.domElement.getBoundingClientRect(); if (!rect.width || !rect.height) return {};
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1); ray.setFromCamera(pointer, camera);
    const objects: Mesh[] = [];
    for (const tile of tiles) if (tile.opacity > .25) tile.group.traverse(object => { if (object instanceof Mesh) objects.push(object); });
    for (const channel of channels) if (channel.opacity > .25) for (const object of channel.group.children) if (object instanceof Mesh) objects.push(object);
    for (const decoration of decorations) if (decoration.opacity > .25) for (const object of decoration.group.children) if (object instanceof Mesh && object.userData.groupId) objects.push(object);
    const object = ray.intersectObjects(objects, false)[0]?.object;
    return object ? { nodeId: object.userData.id as string | undefined, linkId: object.userData.linkId as string | undefined, groupId: object.userData.groupId as string | undefined } : {};
  }
  const start = (event: PointerEvent) => { if (event.button === 0) down = [event.clientX, event.clientY]; manipulation(); };
  const pick = (event: PointerEvent) => {
    const origin = down; down = null;
    if (origin && Math.hypot(event.clientX - origin[0], event.clientY - origin[1]) <= 6) {
      const picked = hit(event);
      if (picked.nodeId) options.onPick(picked.nodeId);
      else if (picked.linkId && options.onLinkPick) options.onLinkPick(picked.linkId);
      else if (picked.groupId && options.onGroupPick) options.onGroupPick(picked.groupId);
      else options.onPick(null);
    }
  };
  const hover = (event: PointerEvent) => { if (event.pointerType !== "mouse" || down) return; const picked = hit(event), id = picked.nodeId ?? null; renderer.domElement.style.cursor = id || picked.linkId || picked.groupId && options.onGroupPick ? "pointer" : ""; if (id !== hoveredNode) { hoveredNode = id; updateEmphasis(); } };
  const leave = () => { down = null; if (hoveredNode) { hoveredNode = null; renderer.domElement.style.cursor = ""; updateEmphasis(); } };
  renderer.domElement.addEventListener("pointerdown", start); renderer.domElement.addEventListener("pointerup", pick); renderer.domElement.addEventListener("pointermove", hover); renderer.domElement.addEventListener("pointerleave", leave); renderer.domElement.addEventListener("pointercancel", leave);
  teardowns.push(() => {
    renderer.domElement.removeEventListener("pointerdown", start); renderer.domElement.removeEventListener("pointerup", pick); renderer.domElement.removeEventListener("pointermove", hover); renderer.domElement.removeEventListener("pointerleave", leave); renderer.domElement.removeEventListener("pointercancel", leave);
  });
  const keyboard = (event: KeyboardEvent) => {
    if (event.target !== host || reduced || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return; event.preventDefault(); manipulation();
    const offset = camera.position.clone().sub(controls.target);
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") offset.applyAxisAngle(up, event.key === "ArrowLeft" ? -.08 : .08);
    else { const axis = new Vector3().crossVectors(offset, up).normalize(); offset.applyAxisAngle(axis, event.key === "ArrowUp" ? -.06 : .06); if (Math.acos(offset.y / offset.length()) > controls.maxPolarAngle || offset.y < 0) return; }
    camera.position.copy(controls.target).add(offset); controls.update(); reportView(); labelsDirty = true; requestDraw();
  }; host.addEventListener("keydown", keyboard);
  teardowns.push(() => host.removeEventListener("keydown", keyboard));
  const visibility = () => { if (document.hidden) pauseHidden(); else requestDraw(); }; document.addEventListener("visibilitychange", visibility);
  teardowns.push(() => document.removeEventListener("visibilitychange", visibility));
  resize(); controls.update(); updateEmphasis(); draw();
  return {
    select(nodeId, linkIndex) { selectedNode = nodeId; selectedLink = linkIndex !== null && channels[linkIndex] ? linkIndex : null; if (playing) prepareMarker(); updateEmphasis(); },
    spotlight(nodeIds, linkIds) { spotlightNodes = new Set(nodeIds); spotlightLinks = new Set(linkIds); if (playing) prepareMarker(); updateEmphasis(); },
    focus(nodeId, linkIndex) {
      if (reduced) return; const selected = linkIndex === null ? null : channels[linkIndex], ids = new Set<string>();
      for (const id of selected ? [selected.link.source, selected.link.target] : [nodeId]) if (id) ids.add(id);
      moveTo(focusBounds(ids, new Set(selected ? [selected.link.id] : [])), camera.position.clone().sub(controls.target).normalize());
    },
    focusSpotlight() { if (!reduced) moveTo(focusBounds(focusIds(), spotlightLinks), camera.position.clone().sub(controls.target).normalize()); },
    fitPresentation() { moveTo(overviewBounds, reduced ? topDirection : camera.position.clone().sub(controls.target).normalize(), !reduced); },
    reconcile,
    playback(value) { playing = value && !reduced; prepareMarker(); requestDraw(); },
    reduce(value) {
      if (reduced === value) return; reduced = value; controls.enabled = !value; renderer.domElement.style.touchAction = "pan-y";
      if (value) { playing = false; marker.visible = false; hoveredNode = null; cameraMove = null; finishModelMove(); moveTo(overviewBounds, topDirection, false); }
      updateEmphasis();
    },
    view(top) { if (!reduced) moveTo(framedBounds.isEmpty() ? overviewBounds : framedBounds, top ? topDirection : home); },
    zoom(factor) {
      if (reduced) return; options.onInteraction?.(); const next = Math.max(.7, Math.min(2.5, (cameraMove?.toZoom ?? camera.zoom) * factor));
      cameraMove = { started: performance.now(), from: camera.position.clone(), to: camera.position.clone(), fromTarget: controls.target.clone(), toTarget: controls.target.clone(), fromZoom: camera.zoom, toZoom: next }; requestDraw();
    },
    reset() { moveTo(overviewBounds, reduced ? topDirection : home, !reduced); },
    dispose() {
      if (disposed) return;
      const retained = new Map<string, RetainedNode>();
      for (const tile of tiles.slice(0, SNAPSHOT_NODES)) retained.set(tile.node.semanticId, { node: { ...tile.node }, position: tile.group.position.toArray() as [number, number, number], width: tile.baseWidth * tile.group.scale.x, depth: tile.baseDepth * tile.group.scale.z, height: tile.baseHeight * tile.group.scale.y, opacity: tile.opacity });
      chapterSnapshots.delete(model.chapterId); chapterSnapshots.set(model.chapterId, { lessonId: model.lessonId, nodes: retained, origin: [...centre], camera: camera.position.toArray() as [number, number, number], target: controls.target.toArray() as [number, number, number], zoom: camera.zoom }); lastDisposedChapter = model.chapterId;
      while (chapterSnapshots.size > SNAPSHOT_CHAPTERS) chapterSnapshots.delete(chapterSnapshots.keys().next().value!);
      disposed = true; cleanup();
    },
  };
  } catch (error) { cleanup(); throw error; }
}
