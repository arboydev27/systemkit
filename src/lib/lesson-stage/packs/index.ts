// Loads the packs of drawings a scene needs. Each pack is its own chunk, so a lesson page downloads only the packs
// its parts come from; the core set in pictograms.ts is always there. Scenes never import packs: the stage calls
// loadScenePacks for them (and a loader can call it first, so the parts appear already drawn).
import { addPack, isDrawn, type Pack } from "../pictograms.ts";
import { packOf, type PackName, type StageRole } from "../roles.ts";

type PackModule = { default: Pack };
const LOAD: Record<PackName, () => Promise<PackModule>> = {
  devices: () => import("./devices.ts"),
  control: () => import("./control.ts"),
  time: () => import("./time.ts"),
  services: () => import("./services.ts"),
  logs: () => import("./logs.ts"),
  records: () => import("./records.ts"),
};
const loading = new Map<PackName, Promise<void>>();

/** The packs that draw these roles and aren't loaded yet. */
export function packsFor(roles: Iterable<StageRole>): PackName[] {
  const need = new Set<PackName>();
  for (const role of roles) { const pack = packOf(role); if (pack && !isDrawn(role)) need.add(pack); }
  return [...need];
}

/** Load the packs a scene's parts come from. Resolves at once when they're all here. */
export function loadScenePacks(scene: { nodes: { role: StageRole }[] }): Promise<void> {
  return Promise.all(packsFor(scene.nodes.map((n) => n.role)).map((name) => {
    if (!loading.has(name)) loading.set(name, LOAD[name]().then((m) => addPack(m.default), (err) => { loading.delete(name); throw err; }));
    return loading.get(name)!;
  })).then(() => undefined);
}
