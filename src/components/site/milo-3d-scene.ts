// Milo in 3D: his Blender model, posed as he sits, drawn with three.js over his image layers, so his head can turn and
// his torso twist smoothly to any angle, lit to look as close to his Cycles renders as a live model can:
// - Each surface starts from a matcap, its material on a sphere lit by the Cycles studio and seen through his camera.
// - The matcap holds display colours, after Blender's colour transform (AgX, the theme's look and exposure), so the
//   page undoes that transform with a table sampled from Blender, works in scene light, and redoes it at the end.
// - In scene light, the diffuse part is corrected by what Cycles baked into each vertex: how much more or less light
//   it really gets than a lone sphere facing the same way (shadow, occlusion, and the light his white parts throw on
//   each other), per theme. Glossy highlights stay as the matcap has them.
// Loaded only once the page is quiet.
import {
  DataTexture, DataUtils, Euler, HalfFloatType, LinearFilter, Matrix4, NoColorSpace, Object3D, OrthographicCamera,
  Quaternion, RedFormat, Scene, ShaderMaterial, SRGBColorSpace, TextureLoader, Vector2, Vector3, WebGLRenderer,
  type Mesh, type Texture,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { affineFrom } from "@/lib/milo";
import { MILO } from "@/lib/milo-figure";
import { MILO_3D } from "@/lib/milo-3d";

/** How he's turned: degrees of head yaw (toward the image's right), nod (down) and roll, torso twist and lean, and a breath from 0 to 1. */
export type Pose3D = { yaw: number; nod: number; roll: number; twist: number; lean: number; breath: number };

export type Milo3D = {
  canvas: HTMLCanvasElement;
  /** Poses and draws him, and gives the SVG matrix that carries his eyes, drawn for the straight frame, onto his screen. */
  draw: (pose: Pose3D) => number[];
  resize: () => void;
  setTheme: (theme: "light" | "dark") => Promise<void>;
  destroy: () => void;
};

const vertex = /* glsl */ `
attribute vec4 color_1;
uniform float dark;
varying vec3 vNormal;
varying vec2 vLight;
void main() {
  vNormal = normalize(normalMatrix * normal);
  // Baked per vertex, the light theme's in red and green and the dark theme's in blue and alpha: the ratio of the light
  // it gets to a lone sphere's (halved), and the lone sphere's diffuse light (log2, from -12 to 4).
  vLight = mix(color_1.rg, color_1.ba, dark);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// The camera is orthographic, so the view-space normal alone picks the matcap's texel.
const fragment = /* glsl */ `
uniform sampler2D matcap;
uniform sampler2D toScene;
uniform sampler2D toDisplay;
uniform vec2 range;
varying vec3 vNormal;
varying vec2 vLight;
const float SIZE = 1024.0;
float lookup(sampler2D table, float at) { return texture2D(table, vec2(clamp(at, 0.0, 1.0) * (SIZE - 1.0) / SIZE + 0.5 / SIZE, 0.5)).r; }
float scene(float shown) { return exp2(range.x + (range.y - range.x) * lookup(toScene, shown)); }
float display(float light) { return lookup(toDisplay, (log2(max(light, 1e-7)) - range.x) / (range.y - range.x)); }
void main() {
  vec3 n = normalize(vNormal);
  vec3 shown = texture2D(matcap, n.xy * 0.495 + 0.5).rgb;
  vec3 light = vec3(scene(shown.r), scene(shown.g), scene(shown.b));
  float alone = exp2(vLight.y * 16.0 - 12.0);
  light = max(light + alone * (vLight.x * 2.0 - 1.0), 0.0);
  gl_FragColor = vec4(display(light.r), display(light.g), display(light.b), 1.0);
}`;

/** A colour transform table as a texture the shader can read between its entries. */
function table(values: readonly number[]) {
  const data = new Uint16Array(values.length);
  values.forEach((value, index) => { data[index] = DataUtils.toHalfFloat(value); });
  const texture = new DataTexture(data, values.length, 1, RedFormat, HalfFloatType);
  texture.minFilter = texture.magFilter = LinearFilter;
  texture.colorSpace = NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}
const tables = (which: "light" | "dark") => {
  const lut = MILO_3D.luts[which];
  return { toScene: table(lut.inverse), toDisplay: table(lut.forward), range: new Vector2(lut.from, lut.to) };
};

const radians = (degrees: number) => (degrees * Math.PI) / 180;
const node = (name: string) => name.replace(/[\[\]\.:\/]/g, "").replace(/\s/g, "_");

export async function createMilo3D(figure: HTMLElement, theme: "light" | "dark"): Promise<Milo3D | null> {
  const canvas = document.createElement("canvas");
  canvas.dataset.miloModel = "";
  let renderer: WebGLRenderer;
  try {
    // Kept between frames, so the dive can copy him as he is.
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: true, powerPreference: "low-power" });
  } catch {
    return null;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;

  const draco = new DRACOLoader().setDecoderPath("/draco/");
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const textures = new TextureLoader();
  const matcaps = async (which: string) => {
    const loaded = await Promise.all(MILO_3D.materials.map((material) => textures.loadAsync(`/milo/3d/matcap-${which}-${material}.webp`)));
    const byName = new Map<string, Texture>();
    MILO_3D.materials.forEach((material, index) => {
      // The matcaps are what Cycles showed, already in display colours: drawn as they are.
      loaded[index].colorSpace = NoColorSpace;
      byName.set(material, loaded[index]);
    });
    return byName;
  };
  let gltf, looks;
  try {
    [gltf, looks] = await Promise.all([loader.loadAsync(MILO_3D.model), matcaps(theme)]);
  } catch {
    renderer.dispose();
    draco.dispose();
    return null;
  }

  const scene = new Scene();
  scene.add(gltf.scene);
  const materials = new Map<string, ShaderMaterial>();
  let transform = tables(theme);
  for (const name of MILO_3D.materials) {
    materials.set(name, new ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: {
        matcap: { value: looks.get(name) },
        toScene: { value: transform.toScene },
        toDisplay: { value: transform.toDisplay },
        range: { value: transform.range },
        dark: { value: theme === "dark" ? 1 : 0 },
      },
    }));
  }
  gltf.scene.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    const material = materials.get(mesh.name.split("__")[0]) ?? materials.get("shell")!;
    mesh.material = material;
  });

  const { frustum, position, forward, up } = MILO_3D.camera;
  const camera = new OrthographicCamera(frustum.left, frustum.right, frustum.top, frustum.bottom, 0.1, 100);
  camera.position.set(position[0], position[1], position[2]);
  camera.up.set(up[0], up[1], up[2]);
  camera.lookAt(position[0] + forward[0], position[1] + forward[1], position[2] + forward[2]);
  camera.updateMatrixWorld();

  const joint = (name: string) => gltf.scene.getObjectByName(node(name)) ?? new Object3D();
  const torso = joint("torso");
  const head = joint("head");
  const arms = (["L", "R"] as const).map((side) => ({
    upper: joint(`upper_arm.${side}`),
    fore: joint(`forearm.${side}`),
    hand: joint(`hand.${side}`),
    shoulder: new Vector3(...MILO_3D.joints[`upper_arm.${side}`].at),
    elbow: new Vector3(...MILO_3D.joints[`forearm.${side}`].at),
    wrist: new Vector3(...MILO_3D.joints[`hand.${side}`].at),
  }));
  const headAt = new Vector3(...MILO_3D.joints.head.at);
  gltf.scene.updateMatrixWorld(true);

  // Points on his screen, to carry the drawn eyes: each eye's centre and a step up the screen from the first.
  const eyeL = new Vector3(...MILO_3D.eyes.left);
  const eyeR = new Vector3(...MILO_3D.eyes.right);
  const eyeUp = eyeL.clone().add(new Vector3(...MILO_3D.eyes.up).multiplyScalar(0.12));
  const onFigure = (point: Vector3) => {
    const p = point.clone().project(camera);
    return [((p.x + 1) / 2) * MILO.width, ((1 - p.y) / 2) * MILO.height];
  };
  const straight = [eyeL, eyeR, eyeUp].map(onFigure);
  const headRest = new Matrix4().makeTranslation(headAt.x, headAt.y, headAt.z);
  const headRestInverse = headRest.clone().invert();

  const parentTurn = new Quaternion();
  const turn = new Quaternion();
  const from = new Vector3();
  const to = new Vector3();
  const here = new Vector3();
  const there = new Vector3();
  /** Turns a joint so the joint after it points toward a place, keeping the rest of its turn. */
  function aim(bone: Object3D, child: Object3D, target: Vector3) {
    bone.updateWorldMatrix(true, true);
    bone.getWorldPosition(here);
    child.getWorldPosition(there);
    from.subVectors(there, here).normalize();
    to.subVectors(target, here).normalize();
    turn.setFromUnitVectors(from, to);
    bone.getWorldQuaternion(parentTurn);
    const world = turn.multiply(parentTurn);
    bone.parent!.getWorldQuaternion(parentTurn);
    bone.quaternion.copy(parentTurn.invert().multiply(world));
    bone.updateWorldMatrix(false, true);
  }

  const pole = new Vector3();
  const axis = new Vector3();
  const side = new Vector3();
  const shoulderNow = new Vector3();
  const elbowAt = new Vector3();
  /** Solves an arm so its fist stays where it rests on the ledge, bending at the elbow the way it does as he sits. */
  function solve(arm: (typeof arms)[number]) {
    arm.upper.quaternion.identity();
    arm.fore.quaternion.identity();
    arm.hand.quaternion.identity();
    arm.upper.updateWorldMatrix(true, true);
    arm.upper.getWorldPosition(shoulderNow);
    const a = arm.elbow.distanceTo(arm.shoulder);
    const b = arm.wrist.distanceTo(arm.elbow);
    axis.subVectors(arm.wrist, shoulderNow);
    const reach = Math.min(axis.length(), (a + b) * 0.999);
    axis.normalize();
    // The elbow bends away from the line between shoulder and wrist the way it does at rest.
    pole.subVectors(arm.elbow, arm.shoulder);
    side.copy(pole).addScaledVector(axis, -pole.dot(axis)).normalize();
    const cos = (a * a + reach * reach - b * b) / (2 * a * reach);
    const angle = Math.acos(Math.max(-1, Math.min(1, cos)));
    elbowAt.copy(shoulderNow).addScaledVector(axis, a * Math.cos(angle)).addScaledVector(side, a * Math.sin(angle));
    aim(arm.upper, arm.fore, elbowAt);
    aim(arm.fore, arm.hand, arm.wrist);
    // The fist keeps the turn it rests with.
    arm.hand.parent!.getWorldQuaternion(parentTurn);
    arm.hand.quaternion.copy(parentTurn.invert());
    arm.hand.updateWorldMatrix(false, true);
  }

  const headTurn = new Quaternion();
  const euler = new Euler();
  const headNow = new Matrix4();
  function draw(pose: Pose3D) {
    // The torso twists about the up axis through his hips, leans to one side, and rises a little as he breathes.
    euler.set(0, radians(pose.twist), radians(-pose.lean), "YXZ");
    torso.quaternion.setFromEuler(euler);
    torso.scale.set(1, 1 + 0.009 * pose.breath, 1);
    torso.updateWorldMatrix(true, true);
    // The head turns as told, whatever the torso under it does.
    euler.set(radians(pose.nod), radians(pose.yaw), radians(-pose.roll), "YZX");
    headTurn.setFromEuler(euler);
    torso.getWorldQuaternion(parentTurn);
    head.quaternion.copy(parentTurn.invert().multiply(headTurn));
    head.updateWorldMatrix(true, true);
    for (const arm of arms) solve(arm);
    renderer.render(scene, camera);
    // Where the eyes go: the map that carries the straight frame's screen onto the screen as it is now.
    headNow.multiplyMatrices(head.matrixWorld, headRestInverse);
    const moved = [eyeL, eyeR, eyeUp].map((point) => onFigure(point.clone().applyMatrix4(headNow)));
    return affineFrom(straight, moved);
  }

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = figure.offsetWidth;
    const height = figure.offsetHeight;
    if (!width || !height) return;
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
  }
  resize();

  return {
    canvas,
    draw,
    resize,
    async setTheme(which) {
      const next = await matcaps(which);
      transform.toScene.dispose();
      transform.toDisplay.dispose();
      transform = tables(which);
      for (const [name, material] of materials) {
        material.uniforms.matcap.value = next.get(name);
        material.uniforms.toScene.value = transform.toScene;
        material.uniforms.toDisplay.value = transform.toDisplay;
        material.uniforms.range.value = transform.range;
        material.uniforms.dark.value = which === "dark" ? 1 : 0;
      }
    },
    destroy() {
      renderer.dispose();
      draco.dispose();
      for (const material of materials.values()) material.dispose();
      canvas.remove();
    },
  };
}
