import {
  AmbientLight, BufferGeometry, Color, ConeGeometry,
  DirectionalLight, Group, Line, LineBasicMaterial, LineDashedMaterial, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, OrthographicCamera, PCFShadowMap,
  PlaneGeometry, Raycaster, Scene, SphereGeometry, SRGBColorSpace, Vector2, Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { SpatialScene, Point } from "./spatial-model";

export type SpatialRuntime = {
  select: (nodeId: string | null, linkIndex: number | null) => void;
  playback: (playing: boolean) => void;
  reduce: (reduced: boolean) => void;
  view: (top: boolean) => void;
  zoom: (factor: number) => void;
  reset: () => void;
  dispose: () => void;
};
type Options = { reduced: boolean; onPick: (id: string | null) => void; onUnavailable: () => void; onHidden: () => void };

/** Original browser renderer. Geometry is a display choice, not deployment. */
export function createSpatialRuntime(host: HTMLElement, model: SpatialScene, options: Options): SpatialRuntime {
  const resources = new Set<{ dispose(): void }>();
  const keep = <T extends { dispose(): void }>(value: T): T => { resources.add(value); return value; };
  const css = getComputedStyle(host);
  const palette = { surface: css.getPropertyValue("--surface").trim() || "#fff", soft: css.getPropertyValue("--surface-soft").trim() || "#f5f5f5",
    ink: css.getPropertyValue("--ink").trim() || "#171717", muted: css.getPropertyValue("--muted").trim() || "#595959",
    line: css.getPropertyValue("--control-border").trim() || "#8a8a8a" };
  const scene = new Scene();
  scene.background = new Color(palette.soft);
  const corners = model.nodes.flatMap(n => [[n.x, n.y], [n.x + n.width, n.y + n.height]] as Point[])
    .concat(model.links.flatMap(l => l.points), model.groups.flatMap(g => [[g.x,g.y],[g.x+g.width,g.y+g.height]] as Point[]));
  const minX = Math.min(...corners.map(p => p[0])), maxX = Math.max(...corners.map(p => p[0]));
  const minY = Math.min(...corners.map(p => p[1])), maxY = Math.max(...corners.map(p => p[1]));
  const centre: Point = [(minX + maxX) / 2, (minY + maxY) / 2];
  const floorWidth = Math.max(4, (maxX - minX) / 100 + 1.6), floorDepth = Math.max(2.5, (maxY - minY) / 100 + 1.6);
  let renderer: WebGLRenderer;
  try { renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" }); }
  catch (error) { for (const r of resources) r.dispose(); throw error; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.appendChild(renderer.domElement);
  const labels = new CSS2DRenderer();
  labels.domElement.style.cssText = "position:absolute;inset:0;pointer-events:none";
  labels.domElement.setAttribute("aria-hidden", "true");
  host.appendChild(labels.domElement);

  const camera = new OrthographicCamera(-6, 6, 3, -3, 0.1, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableDamping = false; // Direct manipulation; no idle animation loop.
  controls.enableZoom = false; // Explicit buttons keep wheel scrolling available.
  controls.enabled = !options.reduced;
  controls.minPolarAngle = 0.12;
  controls.maxPolarAngle = Math.PI / 2.8;
  controls.rotateSpeed = 0.55;
  const home = new Vector3(2.5, 9, 8.5);
  camera.position.copy(options.reduced ? new Vector3(0,14,.01) : home);
  camera.lookAt(0, 0, 0);

  scene.add(new AmbientLight(0xffffff, 2.2));
  const key = new DirectionalLight(0xffffff, 3);
  key.position.set(-3, 9, 6); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -7; key.shadow.camera.right = 7;
  key.shadow.camera.top = 5; key.shadow.camera.bottom = -5;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  const ground = new Mesh(keep(new PlaneGeometry(floorWidth, floorDepth)), keep(new MeshStandardMaterial({ color: palette.soft, roughness: 1 })));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.04; ground.receiveShadow = true;
  scene.add(ground);
  const world = ([x, y]: Point, height = 0.18) => new Vector3((x - centre[0]) / 100, height, (y - centre[1]) / 100);
  const wire = (path: Vector3[], color: string, dashed = false) => {
    const material = dashed ? keep(new LineDashedMaterial({ color, dashSize: 0.055, gapSize: 0.05 })) : keep(new LineBasicMaterial({ color }));
    const line = new Line(keep(new BufferGeometry().setFromPoints(path)), material);
    if (dashed) line.computeLineDistances();
    return line;
  };
  const grid: Vector3[] = [];
  for (let x = -floorWidth/2; x <= floorWidth/2; x += .5) { grid.push(new Vector3(x, -.035, -floorDepth/2), new Vector3(x, -.035, floorDepth/2)); }
  for (let z = -floorDepth/2; z <= floorDepth/2; z += .5) { grid.push(new Vector3(-floorWidth/2, -.035, z), new Vector3(floorWidth/2, -.035, z)); }
  // Each independent pair is its own line; no diagonal joins across the grid.
  for (let i = 0; i < grid.length; i += 2) {
    const line = wire(grid.slice(i, i + 2), palette.line);
    line.material.transparent = true; line.material.opacity = .13;
    scene.add(line);
  }
  for (const frame of model.groups) {
    const { x, y, width: w, height: h } = frame;
    const line = wire([[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]].map(p => world(p as Point, .02)), palette.line, true);
    scene.add(line);
    const label = document.createElement("div"); label.className = "systemkit-spatial-label";
    const title = document.createElement("strong"); title.textContent = frame.title; label.appendChild(title);
    const caption = new CSS2DObject(label); caption.position.copy(world([x+55,y-5], .025)); scene.add(caption);
  }
  if (model.guide === "ring") {
    const pts = Array.from({ length: 81 }, (_, i) => world([500 + 139 * Math.cos(i / 80 * Math.PI * 2), 215 + 139 * Math.sin(i / 80 * Math.PI * 2)], .03));
    scene.add(wire(pts, palette.line));
    const label = document.createElement("div"); label.className = "systemkit-spatial-label";
    const title = document.createElement("strong"); title.textContent = "Clockwise";
    const detail = document.createElement("span"); detail.textContent = "successor lookup";
    label.append(title, detail);
    const caption = new CSS2DObject(label); caption.position.copy(world([500,215], .04)); scene.add(caption);
  } else if (model.guide === "timeline") scene.add(wire([world([72,214], .03), world([940,214], .03)], palette.line));

  const tiles = model.nodes.map(node => {
    const w = node.width / 100, d = node.height / 100, h = .28;
    const group = new Group(); group.position.copy(world([node.x + node.width / 2, node.y + node.height / 2], h / 2));
    const material = keep(new MeshStandardMaterial({ color: palette.surface, roughness: .82 }));
    const block = new Mesh(keep(new RoundedBoxGeometry(w, h, d, 2, .045)), material);
    block.userData.id = node.id; block.castShadow = true; block.receiveShadow = true;
    group.add(block);
    const label = document.createElement("div");
    label.className = "systemkit-spatial-label";
    const title = document.createElement("strong"); title.textContent = node.title; label.appendChild(title);
    if (node.detail) { const detail = document.createElement("span"); detail.textContent = node.detail; label.appendChild(detail); }
    const caption = new CSS2DObject(label); caption.position.y = h / 2 + .025;
    group.add(caption);
    const outline = wire([
      [-w/2,.145,-d/2], [w/2,.145,-d/2], [w/2,.145,d/2], [-w/2,.145,d/2], [-w/2,.145,-d/2],
    ].map(v => new Vector3(...v)), palette.line);
    outline.material.transparent = true; outline.material.opacity = .4;
    group.add(outline); scene.add(group);
    return { node, block, label, outline, material };
  });
  const channels = model.links.map(link => {
    const pts = link.points.map(p => world(p));
    const group = new Group(), line = wire(pts, palette.line, link.dashed);
    group.add(line);
    let arrow: Mesh | null = null;
    if (link.arrow) {
      const end = pts[pts.length - 1], before = [...pts.slice(0, -1)].reverse().find(p => p.distanceTo(end) > .001);
      if (before) {
        arrow = new Mesh(keep(new ConeGeometry(.045, .12, 8)), keep(new MeshBasicMaterial({ color: palette.line })));
        arrow.position.copy(end).addScaledVector(end.clone().sub(before).normalize(), -.05);
        arrow.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), end.clone().sub(before).normalize());
        group.add(arrow);
      }
    }
    scene.add(group); return { link, line, arrow, pts };
  });
  const marker = new Mesh(keep(new SphereGeometry(.048, 12, 8)), keep(new MeshBasicMaterial({ color: palette.ink })));
  marker.visible = false; scene.add(marker);
  let disposed = false, visible = true, reduced = options.reduced, playing = false, frame = 0;
  let selectedLink: number | null = null, started = 0;
  function draw() { if (!disposed && visible && !document.hidden) { renderer.render(scene, camera); labels.render(scene, camera); } }
  function animate(time: number) {
    frame = 0;
    if (disposed || !playing || reduced || !visible || document.hidden) return;
    const channel = selectedLink === null ? null : channels[selectedLink];
    if (channel) {
      const lengths = channel.pts.slice(1).map((p, i) => p.distanceTo(channel.pts[i]));
      let travel = ((time - started) % 2300) / 2300 * lengths.reduce((a, b) => a + b, 0);
      for (let i = 0; i < lengths.length; i++) {
        if (travel <= lengths[i] || i === lengths.length - 1) { marker.position.copy(channel.pts[i]).lerp(channel.pts[i + 1], lengths[i] ? travel / lengths[i] : 0); break; }
        travel -= lengths[i];
      }
    }
    draw(); frame = requestAnimationFrame(animate);
  }
  function updatePlayback() {
    if (frame) cancelAnimationFrame(frame); frame = 0;
    marker.visible = playing && !reduced && selectedLink !== null;
    if (playing && !reduced && visible && !document.hidden) frame = requestAnimationFrame(animate);
    else draw();
  }
  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    const aspect = w / h;
    camera.updateMatrixWorld();
    const projected = [minX,maxX].flatMap(x => [minY,maxY].flatMap(y => [0,.3].map(z => world([x,y],z).applyMatrix4(camera.matrixWorldInverse))));
    const lowX = Math.min(...projected.map(p => p.x)), highX = Math.max(...projected.map(p => p.x));
    const lowY = Math.min(...projected.map(p => p.y)), highY = Math.max(...projected.map(p => p.y));
    const half = Math.max((highX-lowX + 1.1) / aspect, highY-lowY + 1.1) / 2;
    const midX = (lowX+highX)/2, midY = (lowY+highY)/2;
    camera.left = midX-half*aspect; camera.right = midX+half*aspect; camera.top = midY+half; camera.bottom = midY-half;
    camera.updateProjectionMatrix(); renderer.setSize(w, h); labels.setSize(w, h);
    for (const tile of tiles) tile.label.style.maxWidth = `${Math.max(54, Math.min(200, tile.node.width / 100 * w / (half*aspect*2)))}px`;
    draw();
  }
  const observer = new ResizeObserver(resize); observer.observe(host);
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (!visible) options.onHidden();
    updatePlayback();
  }); intersection.observe(host);
  controls.addEventListener("change", draw);
  const lost = (event: Event) => { event.preventDefault(); options.onUnavailable(); };
  renderer.domElement.addEventListener("webglcontextlost", lost);
  const ray = new Raycaster(), pointer = new Vector2(); let down = [0, 0];
  const start = (e: PointerEvent) => { down = [e.clientX, e.clientY]; };
  const pick = (e: PointerEvent) => {
    if (Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    const r = renderer.domElement.getBoundingClientRect();
    pointer.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(pointer, camera);
    const hit = ray.intersectObjects(tiles.map(t => t.block), false)[0];
    options.onPick(hit?.object.userData.id ?? null);
  };
  renderer.domElement.addEventListener("pointerdown", start);
  renderer.domElement.addEventListener("pointerup", pick);
  const keyboard = (e: KeyboardEvent) => {
    if (e.target !== host || reduced) return;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
      e.preventDefault();
      const pos = camera.position.clone();
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") pos.applyAxisAngle(new Vector3(0,1,0), e.key === "ArrowLeft" ? -.08 : .08);
      else {
        const axis = new Vector3().crossVectors(pos, new Vector3(0,1,0)).normalize();
        pos.applyAxisAngle(axis, e.key === "ArrowUp" ? -.06 : .06);
        const angle = Math.acos(pos.y / pos.length());
        if (angle < controls.minPolarAngle || angle > controls.maxPolarAngle) return;
      }
      camera.position.copy(pos); controls.update(); draw();
    }
  }; host.addEventListener("keydown", keyboard);
  const visibility = () => { if (document.hidden) options.onHidden(); updatePlayback(); };
  document.addEventListener("visibilitychange", visibility);
  resize(); controls.update(); draw();
  return {
    select(nodeId, linkIndex) {
      selectedLink = linkIndex; started = performance.now();
      const selected = linkIndex === null ? null : model.links[linkIndex];
      for (const tile of tiles) {
        const focused = tile.node.id === nodeId || tile.node.id === selected?.source || tile.node.id === selected?.target;
        tile.outline.material.color.set(focused ? palette.ink : palette.line);
        tile.outline.material.opacity = focused ? 1 : .4;
      }
      for (let i = 0; i < channels.length; i++) {
        const color = i === linkIndex ? palette.ink : palette.line;
        channels[i].line.material.color.set(color);
        const arrow = channels[i].arrow;
        if (arrow) (arrow.material as MeshBasicMaterial).color.set(color);
      }
      updatePlayback();
    },
    playback(value) { playing = value; started = performance.now(); updatePlayback(); },
    reduce(value) { reduced = value; controls.enabled = !value; if (value) { camera.position.set(0,14,.01); camera.lookAt(0,0,0); } else camera.position.copy(home); controls.update(); resize(); updatePlayback(); },
    view(top) { camera.position.copy(top ? new Vector3(0,14,.01) : home); camera.lookAt(0,0,0); controls.update(); resize(); },
    zoom(factor) { camera.zoom = Math.max(.7, Math.min(2.5, camera.zoom * factor)); camera.updateProjectionMatrix(); draw(); },
    reset() { camera.position.copy(reduced ? new Vector3(0,14,.01) : home); controls.target.set(0,0,0); camera.zoom = 1; camera.updateProjectionMatrix(); controls.update(); resize(); },
    dispose() {
      disposed = true; if (frame) cancelAnimationFrame(frame);
      observer.disconnect(); intersection.disconnect(); controls.removeEventListener("change", draw); controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", start); renderer.domElement.removeEventListener("pointerup", pick);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      host.removeEventListener("keydown", keyboard); document.removeEventListener("visibilitychange", visibility);
      for (const r of resources) r.dispose();
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); labels.domElement.remove();
    },
  };
}
