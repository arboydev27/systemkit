import type { Film, Shot } from "./neuron-film";

// The inside of the neuron, ray marched in one fragment shader and finished in a second pass. It's greyscale like an
// electron micrograph: membranes lit by the signal travelling through them, edges catching the light, fog, and the
// cytoskeleton running the length of the axon. It draws at a fraction of the screen's pixels, chosen from how fast
// the last frames came, and the second pass blurs it along the direction of travel so the low resolution never shows.

const VERTEX = `#version 300 es
in vec2 corner;
void main() { gl_Position = vec4(corner, 0.0, 1.0); }`;

const SCENE = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2 uCenter;
uniform float uFocal;
uniform vec3 uPos, uRight, uUp, uForward;
uniform vec4 uWind, uPhase, uNodes, uBranches;
uniform vec4 uShape; // the membrane the camera enters through, where the terminal swells, its end, the camera's depth
uniform float uSignal, uRelease, uTime, uTear;

#define TAU 6.2831853
#define AXON 2.6

// Hashes without sine, whose precision differs from one GPU to the next (Dave Hoskins).
float hash(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash3(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
float smax(float a, float b, float k) { return -smin(-a, -b, k); }

vec2 axis(float z) {
  return vec2(uWind.x * sin(z * uWind.y + uPhase.x) + uWind.z * sin(z * uWind.w + uPhase.y),
              uWind.x * 0.7 * sin(z * uWind.y * 0.83 + uPhase.z) + uWind.z * 0.8 * cos(z * uWind.w * 1.21 + uPhase.w));
}

float toNode(float z, out float which) {
  float best = 1e4;
  which = 0.0;
  for (int i = 0; i < 4; i++) {
    float d = z - uNodes[i];
    if (abs(d) < abs(best)) { best = d; which = float(i); }
  }
  return best;
}

// The membrane's radius: a wide cell body narrowing through the hillock, pinched to about half at each node of
// Ranvier with a beaded collar either side, faintly ribbed by the actin rings under it, swelling at the terminal.
float baseRadius(float z, float node) {
  float body = mix(3.4, 1.0, smoothstep(-1.4, AXON, z));
  float inAxon = step(AXON - 0.5, z) * (1.0 - step(uShape.y + 0.6, z));
  float pinch = 1.0 - 0.44 * exp(-node * node * 7.0) * inAxon;
  float swell = 1.0 + 1.35 * smoothstep(uShape.y, uShape.y + 1.8, z);
  return max(body, swell) * pinch;
}
float detail(float z, float node, float angle) {
  float inAxon = step(AXON - 0.5, z) * (1.0 - step(uShape.y + 0.6, z));
  float collar = abs(abs(node) - 0.42);
  float beads = 0.07 * exp(-collar * collar * 90.0) * (0.55 + 0.45 * sin(angle * 14.0 + sign(node) * 1.3));
  return (beads + 0.012 * sin(z * 15.7)) * inAxon;
}
// Ion channels packed into the node's membrane: small round clusters, not a texture.
float speckle(vec2 uv) {
  vec2 id = floor(uv);
  vec2 f = fract(uv) - 0.5;
  vec2 o = (vec2(hash3(vec3(id, 1.0)), hash3(vec3(id, 2.0))) - 0.5) * 0.45;
  return step(0.3, hash3(vec3(id, 5.0))) * smoothstep(0.3, 0.1, length(f - o));
}

float axonMask(float z) { return smoothstep(AXON - 2.4, AXON - 0.2, z) * (1.0 - smoothstep(uShape.y + 0.4, uShape.y + 1.6, z)); }

// Distance to the nearest neurofilament: dense, fine, evenly spaced, and thinned out through the nodes.
float filaments(vec2 q, float angle, float radius) {
  float sector = floor(angle / (TAU / 34.0) + 0.5);
  float lay = sector * TAU / 34.0 + (hash(sector + 40.0) - 0.5) * 0.08;
  vec2 c = mix(0.22, 0.86, hash(sector + 51.0)) * radius * vec2(cos(lay), sin(lay));
  return length(q - c);
}

// What a point is nearest: the membrane from inside (distance positive inside it), or something floating in the axon.
// The second value says which: 0 membrane, 1 microtubule, 2 mitochondrion, 3 vesicle, 4 nucleus, 5 terminal membrane.
vec3 map(vec3 p) {
  vec2 q = p.xy - axis(p.z);
  float r = length(q);
  float angle = atan(q.y, q.x);
  float which;
  float node = toNode(p.z, which);
  float radius = baseRadius(p.z, node);
  float ripple = 0.035 * sin(angle * 3.0 + p.z * 1.7) + 0.025 * sin(angle * 7.0 - p.z * 2.3);
  float inside = radius * (1.0 + ripple) - detail(p.z, node, angle) - r;

  // Collaterals branch at the nodes: each a real link of the lesson there. Only worked out near one.
  int at = int(which);
  float count = abs(node) < 3.2 ? uBranches[at] : 0.0;
  vec3 root = vec3(axis(uNodes[at]), uNodes[at]);
  for (int j = 0; j < 3; j++) {
    if (float(j) >= count) break;
    float turn = hash(which * 7.0 + float(j) * 3.1) * TAU;
    vec3 dir = normalize(vec3(cos(turn), sin(turn), 0.9 + 0.5 * hash(which + float(j))));
    vec3 v = p - root;
    float h = clamp(dot(v, dir), 0.0, 3.5);
    inside = smax(inside, 0.4 - length(v - dir * h), 0.3);
  }
  float end = uShape.z - p.z;
  vec3 hit = vec3(min(inside, end), inside < end ? 0.0 : 5.0, 1e3);

  // The cell membrane the camera came through, tearing open around it.
  float gap = abs(p.z - uShape.x);
  if (gap < 0.6) {
    float sheet = abs(p.z - uShape.x + 0.18 * noise(p * 1.4) + 0.05 * noise(p * 5.0)) - 0.07;
    sheet = max(sheet, uTear - r);
    if (sheet < hit.x) hit.xy = vec2(sheet, 6.0);
  } else if (gap - 0.3 < hit.x) {
    hit.xy = vec2(gap - 0.3, 6.0);
  }

  float mask = axonMask(p.z);
  float nodeAt = exp(-node * node * 7.0);
  if (mask > 0.01) {
    // Microtubules: fewer, thicker, irregular, squeezing through the nodes with the axon.
    float sector = floor(angle / (TAU / 7.0) + 0.5);
    float lay = sector * TAU / 7.0 + (hash(sector + 0.5) - 0.5) * 0.35;
    // They squeeze through the nodes with the axon, but less than the membrane does.
    float fibre = mix(baseRadius(p.z, 1e3), radius, 0.55);
    float reach = mix(0.42, 0.68, hash(sector + 3.5)) * fibre;
    vec2 c = reach * vec2(cos(lay), sin(lay)) + 0.035 * vec2(sin(p.z * 0.9 + sector * 2.1), cos(p.z * 0.7 + sector));
    float tube = length(q - c) - 0.016 * mask;
    if (tube < hit.x) hit.xy = vec2(tube, 1.0);
    hit.z = filaments(q, angle, radius) + nodeAt * 0.2 + (1.0 - mask);

    // Mitochondria: slender rods along the wall, absent at the nodes.
    float cell = floor(p.z / 3.1);
    float h = hash(cell + 17.0);
    if (h > 0.25 && nodeAt < 0.2) {
      float a2 = h * TAU * 5.0;
      vec2 m = 0.76 * radius * vec2(cos(a2), sin(a2));
      float lz = p.z - (cell + 0.5) * 3.1;
      float mito = length(vec3(q - m, max(abs(lz) - 0.8 * h, 0.0))) - 0.095;
      if (mito < hit.x) hit.xy = vec2(mito, 2.0);
    }

    // Vesicles held on the microtubules, still at this timescale apart from a tremor.
    float slot = floor(p.z / 1.1);
    float pick = floor(hash(slot + 0.5) * 7.0);
    float lay3 = pick * TAU / 7.0 + (hash(pick + 0.5) - 0.5) * 0.35;
    vec2 v = (mix(0.42, 0.68, hash(pick + 3.5)) * fibre + 0.06) * vec2(cos(lay3), sin(lay3));
    vec3 jitter = 0.008 * vec3(sin(uTime * 37.0 + slot), cos(uTime * 41.0 + slot), 0.0);
    float ves = length(vec3(q - v, p.z - (slot + 0.5) * 1.1) - jitter) - 0.055;
    if (ves < hit.x) hit.xy = vec2(ves, 3.0);
  }

  // The terminal: a mitochondrion at the back, and synaptic vesicles crowding toward the active zone.
  if (p.z > uShape.y) {
    vec3 g = vec3(q, p.z) / 0.42;
    vec3 id = floor(g);
    vec3 f = fract(g) - 0.5 - (vec3(hash3(id), hash3(id + 3.0), hash3(id + 7.0)) - 0.5) * 0.3;
    float crowd = smoothstep(uShape.z - 3.0, uShape.z - 0.4, p.z) * step(r, radius - 0.3) * step(0.25, hash3(id + 11.0));
    float ves = (length(f) - 0.27 * crowd) * 0.42;
    if (crowd > 0.05 && ves < hit.x) hit.xy = vec2(ves, 3.0);
    vec3 mp = vec3(q - vec2(1.0, -0.6), p.z - uShape.y - 0.9);
    float mito = length(vec3(mp.xy, max(abs(mp.z) - 0.7, 0.0))) - 0.3;
    if (mito < hit.x) hit.xy = vec2(mito, 2.0);
  }

  // The nucleus, off to one side of the cell body.
  if (p.z < 1.0) {
    vec3 n = p - vec3(axis(-1.6) + vec2(1.55, 0.7), -1.9);
    float nucleus = length(n) - 1.25 - 0.04 * noise(p * 4.0);
    if (nucleus < hit.x) hit.xy = vec2(nucleus, 4.0);
  }
  return hit;
}

vec3 normalAt(vec3 p) {
  vec2 e = vec2(0.002, -0.002);
  return normalize(e.xyy * map(p + e.xyy).x + e.yyx * map(p + e.yyx).x + e.yxy * map(p + e.yxy).x + e.xxx * map(p + e.xxx).x);
}

// The signal as it really looks: a long front with a soft tail, not a ball. Strongest just behind the front, and
// faint ahead of it, where current already runs on under the myelin before the next node fires.
float wave(float z) {
  float ahead = z - uSignal;
  return ahead > 0.0 ? 0.7 * exp(-ahead * 3.0) + 0.3 * exp(-ahead * 0.3) : exp(ahead * 0.55) * (0.45 + 0.55 * exp(ahead * 2.5));
}

// Light scattered toward the eye by the haze around a point, in closed form, cut off where the ray hits a wall
// (Miles Macklin, "Faster Fog").
float scatter(vec3 ro, vec3 rd, vec3 s, float hit) {
  vec3 q = ro - s;
  float b = dot(rd, q);
  float h = sqrt(max(dot(q, q) - b * b, 1e-4));
  return (atan((hit + b) / h) - atan(b / h)) / h;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uCenter) / uFocal;
  vec3 rd = normalize(uForward + uRight * uv.x + uUp * uv.y);
  vec3 ro = uPos;
  float t = 0.02;
  float strands = 0.0;
  vec3 hit = vec3(1.0, -1.0, 1e3);
  for (int i = 0; i < STEPS; i++) {
    vec3 p = ro + rd * t;
    hit = map(p);
    // Neurofilaments are too fine to hit, so they're gathered as light along the way, lit by the passing wave.
    strands += exp(-hit.z * 70.0) * min(hit.x, 0.25) * (0.25 + 2.4 * wave(p.z));
    if (abs(hit.x) < 0.002 * (1.0 + t * 0.125) || t > 26.0) break;
    t += min(hit.x * 0.8, 0.25 + hit.z * 0.5);
  }
  t = min(t, 26.0);

  vec3 p = ro + rd * t;
  float which;
  float node = toNode(p.z, which);
  vec2 q = p.xy - axis(p.z);
  float angle = atan(q.y, q.x);
  vec3 n = normalAt(p);
  float kind = hit.y;
  // Fine texture, fading with distance so far walls don't shimmer: the membrane's grain, ridges inside a mitochondrion.
  vec3 grain = vec3(noise(p * 9.0), noise(p * 9.0 + 4.1), noise(p * 9.0 + 8.3)) - 0.5;
  grain += (vec3(noise(p * 24.0), noise(p * 24.0 + 2.7), noise(p * 24.0 + 5.9)) - 0.5) * 0.5;
  grain -= n * dot(n, grain);
  n = normalize(n + grain * (kind == 1.0 ? 0.2 : kind == 2.0 ? 0.6 : kind == 6.0 ? 0.9 : 0.45) / sqrt(max(t, 1.0)));

  float albedo = kind == 0.0 ? 0.42 : kind == 1.0 ? 0.62 : kind == 2.0 ? 0.55 : kind == 3.0 ? 0.85 : kind == 4.0 ? 0.5 : kind == 6.0 ? 0.75 : 0.5;
  if (kind == 2.0) albedo *= 0.7 + 0.3 * sin(p.z * 11.0 + angle * 2.0);
  // The active zone: a dark plate where the vesicles dock.
  if (kind == 5.0) albedo *= 0.35 + 0.65 * smoothstep(0.4, 1.0, length(q));

  // Shading the way an electron microscope sees: brightness grows as a surface tilts away, so edges glow, and
  // crevices are dark. One key light from the detector's side, and the light travelling with the wave.
  float facing = abs(dot(n, rd));
  float tilt = min(1.0 / max(facing, 0.2), 3.0);
  float occlusion = mix(clamp(map(p + n * 0.12).x / 0.12, 0.0, 1.0), clamp(map(p + n * 0.45).x / 0.45, 0.0, 1.0), 0.6);
  vec3 key = normalize(uUp * 0.75 - uRight * 0.45 - uForward * 0.3);
  float shade = max(dot(n, key), 0.0);
  float zl = clamp(p.z, uSignal - 3.5, uSignal + 0.3);
  vec3 lamp = vec3(axis(zl), zl) - p;
  float far = length(lamp);
  float lit = wave(zl) / (1.0 + far * far * 1.2);
  float diffuse = max(dot(n, lamp / far), 0.0) * 0.8 + 0.2;
  float nearby = 1.0 / (1.0 + t * 0.22);

  float structure = albedo * (0.03 + shade * 0.32 * nearby + diffuse * lit * 1.2) * (0.35 + 0.65 * occlusion) + tilt * (0.07 * nearby + 0.22 * lit);
  // What glows: the membrane carrying the signal, each node's ring of channels as it fires, and the vesicles releasing.
  float glow = 0.0;
  if (kind == 0.0) {
    float atNode = exp(-node * node * 11.0) * smoothstep(uNodes[int(which)] - 0.6, uNodes[int(which)] + 0.1, uSignal + 0.6);
    float fading = 1.0 - smoothstep(uNodes[int(which)] + 0.5, uNodes[int(which)] + 3.5, uShape.w);
    glow += wave(p.z) * 0.16 + atNode * fading * (0.12 + 0.95 * speckle(vec2(angle * 13.0, p.z * 34.0)));
  }
  // The cell membrane on the way in reads like a micrograph: grey, lumpy, its edges bright.
  if (kind == 6.0) structure += 0.05;
  if (kind == 3.0 && p.z > uShape.y) glow += uRelease * (0.25 + 0.8 * hash3(floor(vec3(q, p.z) / 0.42)));
  if (kind == 5.0) glow += uRelease * 0.45 * exp(-length(q) * 1.2);

  // Far things sink into the haze, and the wave's light hangs in it.
  float depth = 1.0 - exp(-t * 0.11);
  structure = mix(structure, 0.02, depth) + strands * 0.75;
  vec3 front = vec3(axis(uSignal), uSignal);
  vec3 behind = vec3(axis(uSignal - 1.6), uSignal - 1.6);
  glow = glow * (1.0 - depth * 0.6) + min(0.6, scatter(ro, rd, front, t) * 0.011 + scatter(ro, rd, behind, t) * 0.006);
  // Three things in one image: what's lit, what glows, and how far away it is.
  fragColor = vec4(structure, glow, t / 26.0, 1.0);
}`;

const FINISH = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform sampler2D uScene;
uniform vec2 uSize, uVanish;
uniform float uBlur, uTime, uDeep;
uniform vec3 uHole; // where the far end opens, in pixels, and how wide

void main() {
  vec2 uv = gl_FragCoord.xy / uSize;
  // Blurred along the way the camera is going, jittered so the steps don't band, and least where things are far
  // away near the middle, which keeps the axon ahead sharp while the walls rush past.
  vec2 toward = uVanish - uv;
  float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  vec3 here = texture(uScene, uv).rgb;
  float spread = uBlur * 0.13 * (1.0 - here.b * 0.7);
  float structure = 0.0;
  float glow = 0.0;
  for (int i = 0; i < 10; i++) {
    vec3 s = texture(uScene, uv + toward * spread * (float(i) + jitter) / 10.0).rgb;
    structure += s.r;
    glow += s.g;
  }
  structure /= 10.0;
  glow /= 10.0;
  // Only what glows blooms, from the scene's own smaller copies.
  float bloom = textureLod(uScene, uv, 2.5).g * 0.3 + textureLod(uScene, uv, 4.5).g * 0.35;
  float lum = structure + glow + bloom;
  lum = 1.0 - exp(-lum * 1.3);
  lum = mix(lum, lum * lum * (3.0 - 2.0 * lum), 0.35);
  vec2 off = (uv - 0.5) * vec2(uSize.x / uSize.y, 1.0);
  float fall = 1.0 / (1.0 + dot(off, off) * 0.9);
  lum = mix(uDeep, lum, fall * fall);
  // Grain like a detector's: stronger where the signal is weak.
  float noise = fract(sin(dot(gl_FragCoord.xy + fract(uTime * 7.31) * 113.0, vec2(12.9898, 78.233))) * 43758.5453);
  lum += (noise - 0.5) * (0.035 + 0.05 * (1.0 - sqrt(clamp(lum, 0.0, 1.0))));

  // The far end: a hole onto the page, with the membrane's torn edge bright around it.
  float away = length(gl_FragCoord.xy - uHole.xy) - uHole.z;
  float alpha = uHole.z > 0.0 ? smoothstep(-1.5, 1.5, away) : 1.0;
  float rim = uHole.z > 0.0 ? exp(-away * away / (18.0 + uHole.z * 0.08)) * 0.9 : 0.0;
  float value = clamp(lum, 0.0, 1.0) * alpha + rim;
  fragColor = vec4(vec3(value), max(alpha, rim));
}`;

export type NeuronGl = {
  /** Whether the shaders have finished compiling, which happens in the background after the page loads. */
  ready: () => boolean;
  /**
   * Times one hidden frame and settles how many pixels to march, so the first dive starts at a size this device can
   * draw in time. Call it a few times in idle moments before any dive. Says whether it's done.
   */
  calibrate: (film: Film, shot: Shot) => boolean;
  /** Whether this device can march the neuron fast enough at all. If not, the dive draws its lines instead. */
  capable: () => boolean;
  render: (film: Film, shot: Shot, hole: { x: number; y: number; r: number }, time: number) => void;
  resize: () => void;
  destroy: () => void;
};

type Program = { program: WebGLProgram; uniforms: Map<string, WebGLUniformLocation | null> };

/** A WebGL 2 renderer for the neuron, or null where there's no WebGL 2, in which case the dive draws its lines instead. */
export function createNeuronGl(canvas: HTMLCanvasElement, quality: "full" | "light"): NeuronGl | null {
  const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: "high-performance" });
  if (!gl) return null;
  const parallel = gl.getExtension("KHR_parallel_shader_compile");
  const steps = quality === "full" ? 72 : 40;

  function compile(type: number, source: string) {
    const shader = gl!.createShader(type)!;
    gl!.shaderSource(shader, source);
    gl!.compileShader(shader);
    return shader;
  }
  function link(fragment: string): { program: WebGLProgram; shaders: WebGLShader[] } {
    const program = gl!.createProgram()!;
    const shaders = [compile(gl!.VERTEX_SHADER, VERTEX), compile(gl!.FRAGMENT_SHADER, fragment)];
    for (const shader of shaders) gl!.attachShader(program, shader);
    gl!.bindAttribLocation(program, 0, "corner");
    gl!.linkProgram(program);
    return { program, shaders };
  }
  const pending = [link(SCENE.replace("#define TAU", `#define STEPS ${steps}\n#define TAU`)), link(FINISH)];
  const linked = performance.now();
  let programs: [Program, Program] | null = null;
  let failed = false;

  function settle() {
    if (programs || failed) return Boolean(programs);
    if (parallel && pending.some(({ program }) => !gl!.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR))) return false;
    // Without a way to ask whether compiling has finished, asking for the result would wait for it, so give it time.
    if (!parallel && performance.now() - linked < 2500) return false;
    for (const { program, shaders } of pending) {
      if (!gl!.getProgramParameter(program, gl!.LINK_STATUS)) {
        failed = true;
        return false;
      }
      for (const shader of shaders) gl!.deleteShader(shader);
    }
    const wrap = ({ program }: { program: WebGLProgram }): Program => ({ program, uniforms: new Map() });
    programs = [wrap(pending[0]), wrap(pending[1])];
    return true;
  }
  const where = (program: Program, name: string) => {
    if (!program.uniforms.has(name)) program.uniforms.set(name, gl!.getUniformLocation(program.program, name));
    return program.uniforms.get(name) ?? null;
  };

  const corners = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, corners);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const texture = gl.createTexture();
  const target = gl.createFramebuffer();
  let sceneWidth = 0;
  let sceneHeight = 0;
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  // The share of the screen's pixels the neuron is marched at, adjusted by how fast frames arrive.
  let detail = quality === "full" ? 0.6 : 0.42;
  const lowest = 0.26;
  const highest = quality === "full" ? 0.8 : 0.55;
  let lastFrame = 0;
  let slow = 0;
  let quick = 0;
  const timings: number[] = [];
  let able = true;
  const probe = new Uint8Array(4);

  function sizeScene() {
    const w = Math.max(64, Math.round(width * pixelRatio * detail));
    const h = Math.max(64, Math.round(height * pixelRatio * detail));
    if (w === sceneWidth && h === sceneHeight) return;
    sceneWidth = w;
    sceneHeight = h;
    gl!.bindTexture(gl!.TEXTURE_2D, texture);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA8, w, h, 0, gl!.RGBA, gl!.UNSIGNED_BYTE, null);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR_MIPMAP_LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, target);
    gl!.framebufferTexture2D(gl!.FRAMEBUFFER, gl!.COLOR_ATTACHMENT0, gl!.TEXTURE_2D, texture, 0);
  }

  function resize() {
    // Hidden between dives the canvas has no size, but it always covers the window when shown.
    width = canvas.clientWidth || window.innerWidth;
    height = canvas.clientHeight || window.innerHeight;
    pixelRatio = Math.min(quality === "full" ? 1.5 : 1, window.devicePixelRatio || 1);
    const w = Math.round(width * pixelRatio);
    const h = Math.round(height * pixelRatio);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    sizeScene();
  }

  /** Finer when frames come quickly, coarser when they don't, between dives as well as during one. */
  function adapt(now: number) {
    const gap = lastFrame ? now - lastFrame : 16;
    lastFrame = now;
    if (gap > 250) return;
    // A frame far too slow cuts the size at once; a run of slightly slow ones trims it.
    if (gap > 40 && detail > lowest) { detail = Math.max(lowest, detail * 0.7); slow = 0; sizeScene(); return; }
    if (gap > 21) { slow++; quick = 0; } else if (gap < 15) { quick++; slow = 0; } else { slow = 0; quick = 0; }
    if (slow >= 3 && detail > lowest) { detail = Math.max(lowest, detail * 0.82); slow = 0; sizeScene(); }
    if (quick >= 20 && detail < highest) { detail = Math.min(highest, detail * 1.08); quick = 0; sizeScene(); }
  }

  /** The first pass: the neuron itself, marched into the smaller texture. */
  function march(film: Film, shot: Shot, time: number, part = 1) {
    const scene = programs![0];
    const ratio = sceneWidth / Math.max(1, width);
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, target);
    gl!.viewport(0, 0, Math.round(sceneWidth * part), Math.round(sceneHeight * part));
    gl!.useProgram(scene.program);
    gl!.uniform2f(where(scene, "uCenter"), shot.centerX * ratio, (height - shot.centerY) * ratio);
    gl!.uniform1f(where(scene, "uFocal"), shot.focal * ratio);
    gl!.uniform3fv(where(scene, "uPos"), shot.position);
    gl!.uniform3fv(where(scene, "uRight"), shot.right);
    gl!.uniform3fv(where(scene, "uUp"), shot.up);
    gl!.uniform3fv(where(scene, "uForward"), shot.forward);
    gl!.uniform4fv(where(scene, "uWind"), film.wind);
    gl!.uniform4fv(where(scene, "uPhase"), film.phase);
    gl!.uniform4f(where(scene, "uNodes"), film.nodes[0] ?? 1e4, film.nodes[1] ?? 1e4, film.nodes[2] ?? 1e4, film.nodes[3] ?? 1e4);
    gl!.uniform4f(where(scene, "uBranches"), film.branches[0] ?? 0, film.branches[1] ?? 0, film.branches[2] ?? 0, film.branches[3] ?? 0);
    gl!.uniform4f(where(scene, "uShape"), film.membrane, film.swell, film.end, shot.depth);
    gl!.uniform1f(where(scene, "uTear"), shot.tear);
    gl!.uniform1f(where(scene, "uSignal"), shot.signal);
    gl!.uniform1f(where(scene, "uRelease"), shot.release);
    gl!.uniform1f(where(scene, "uTime"), time);
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
  }

  resize();

  return {
    ready: settle,
    resize,
    capable: () => able,
    calibrate(film, shot) {
      if (!settle() || !programs || timings.length >= 8) return timings.length >= 8;
      resize();
      // Each pass is timed on its own, waiting for the GPU to finish it. Only a quarter of the screen is drawn, so
      // no single moment of timing holds the page up for long.
      let start = performance.now();
      march(film, shot, 0, 0.5);
      gl!.readPixels(0, 0, 1, 1, gl!.RGBA, gl!.UNSIGNED_BYTE, probe);
      const scene = (performance.now() - start) * 4;
      start = performance.now();
      finish(shot, { x: 0, y: 0, r: 0 }, 0, 0.5);
      gl!.readPixels(0, 0, 1, 1, gl!.RGBA, gl!.UNSIGNED_BYTE, probe);
      timings.push(scene, (performance.now() - start) * 4);
      // The first frame pays for any compiling the driver left until first use, so it isn't counted.
      if (timings.length === 8) {
        const middle = (values: number[]) => [...values].sort((a, b) => a - b)[1];
        const marched = middle([timings[2], timings[4], timings[6]]);
        const finished = middle([timings[3], timings[5], timings[7]]);
        const room = Math.max(1, 10 - finished);
        detail = Math.max(lowest, Math.min(highest, detail * Math.sqrt(room / Math.max(0.5, marched))));
        // A device that can't draw a frame in time even at the coarsest size gets the lines instead.
        able = finished + marched * (lowest / detail) ** 2 < 22 || detail > lowest;
        sizeScene();
      }
      return timings.length >= 8;
    },
    render(film, shot, hole, time) {
      if (!settle() || !programs) return;
      if (canvas.clientWidth !== width || canvas.clientHeight !== height) resize();
      adapt(performance.now());
      march(film, shot, time);
      finish(shot, hole, time);
    },
    destroy() {
      for (const program of programs ?? pending) gl!.deleteProgram(program.program);
      gl!.deleteTexture(texture);
      gl!.deleteFramebuffer(target);
      gl!.deleteBuffer(corners);
    },
  };

  /** The second pass: blur, bloom, grain and the opening, at the screen's size. */
  function finish(shot: Shot, hole: { x: number; y: number; r: number }, time: number, part = 1) {
    const pass = programs![1];
    gl!.bindTexture(gl!.TEXTURE_2D, texture);
    gl!.generateMipmap(gl!.TEXTURE_2D);
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
    gl!.viewport(0, 0, Math.round(canvas.width * part), Math.round(canvas.height * part));
    gl!.useProgram(pass.program);
    gl!.uniform1i(where(pass, "uScene"), 0);
    gl!.uniform2f(where(pass, "uSize"), canvas.width, canvas.height);
    gl!.uniform2f(where(pass, "uVanish"), shot.centerX / width, 1 - shot.centerY / height);
    gl!.uniform1f(where(pass, "uBlur"), shot.rush);
    gl!.uniform1f(where(pass, "uTime"), time);
    gl!.uniform1f(where(pass, "uDeep"), 0.015);
    gl!.uniform3f(where(pass, "uHole"), hole.x * pixelRatio, (height - hole.y) * pixelRatio, hole.r * pixelRatio);
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
  }
}
