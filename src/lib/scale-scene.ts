// The requests moving through the home page's game, on a canvas behind its nodes. Dots follow the same wires as
// the map, spill in orange where a tier is overloaded, and stop at the cache when it answers them. It draws only
// while on screen, and it stands still for anyone who prefers reduced motion.

export type ScalePlace = { x: number; y: number; r: number };
export type ScaleSceneFlow = { routes: string[][]; rate: number; drop: Record<string, number>; absorb: Record<string, number>; heft: number };
export type ScaleScene = { update: (flow: ScaleSceneFlow) => void; destroy: () => void };

type Dot = { path: string[]; segment: number; along: number; state: "moving" | "lost" | "answered"; x: number; y: number; vx: number; vy: number; age: number };

const SEGMENT_SECONDS = 0.62;
const LOST_SECONDS = 1.15;
const ANSWERED_SECONDS = 0.32;
const SETTLE_MS = 1400; // Nodes take this long to glide to a new place, so the wires follow them until then.
const IDLE_LIMIT = 60_000;
const TOUCH_FRAME = 30;
const MAX_DOTS = 140;
const SPARKS_PER_SECOND = 34;
const HEFT_EASE = 3.5; // Dots swell and shrink in flight when the work in a request changes.

function wirePoint(a: ScalePlace, b: ScalePlace, t: number) {
  const x0 = a.x + a.r;
  const x3 = b.x - b.r;
  const middle = (x0 + x3) / 2;
  const u = 1 - t;
  return {
    x: u * u * u * x0 + 3 * u * u * t * middle + 3 * u * t * t * middle + t * t * t * x3,
    y: u * u * u * a.y + 3 * u * u * t * a.y + 3 * u * t * t * b.y + t * t * t * b.y,
  };
}

export function createScaleScene(canvas: HTMLCanvasElement, readPlaces: () => Map<string, ScalePlace>): ScaleScene | null {
  const context = canvas.getContext("2d");
  if (!context) return null;
  const ctx = context;

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const scheme = window.matchMedia("(prefers-color-scheme: dark)");
  const frameGap = window.matchMedia("(pointer: coarse)").matches ? TOUCH_FRAME : 0;

  let flow: ScaleSceneFlow = { routes: [], rate: 0, drop: {}, absorb: {}, heft: 1 };
  let heft = 1;
  let places = new Map<string, ScalePlace>();
  let wires: [string, string][] = [];
  let dots: Dot[] = [];
  let width = 0;
  let height = 0;
  let scale = 1;
  let ink = "#171717";
  let hot = "#eb6834";
  let owed = 0;
  let sparks = 0;
  let onScreen = false;
  let frame = 0;
  let lastTick = 0;
  let lastDraw = 0;
  let settleUntil = 0;
  let lastChange = performance.now();
  let destroyed = false;

  function readColors() {
    const styles = getComputedStyle(canvas);
    ink = styles.getPropertyValue("--ink").trim() || ink;
    hot = styles.getPropertyValue("--hot-line").trim() || hot;
  }

  function measure() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    scale = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    places = readPlaces();
  }

  /** Sends a dot flying off a node's rim, from anywhere around it. */
  function spill(dot: Dot, place: ScalePlace) {
    const angle = Math.random() * Math.PI * 2;
    return Object.assign(dot, { state: "lost" as const, x: place.x + Math.cos(angle) * place.r, y: place.y + Math.sin(angle) * place.r, vx: Math.cos(angle) * (30 + Math.random() * 70), vy: Math.sin(angle) * (30 + Math.random() * 70) - 70, age: 0 });
  }

  function advance(dt: number) {
    heft += (flow.heft - heft) * Math.min(1, dt * HEFT_EASE);
    owed += flow.rate * (width < 560 ? 0.7 : 1) * dt;
    while (owed >= 1 && flow.routes.length) {
      owed -= 1;
      if (dots.length >= MAX_DOTS) continue;
      dots.push({ path: flow.routes[Math.floor(Math.random() * flow.routes.length)], segment: 0, along: 0, state: "moving", x: 0, y: 0, vx: 0, vy: 0, age: 0 });
    }
    // An overloaded tier throws off more than the dots that happen to reach it, so losing most requests looks like it.
    const hotNodes = Object.entries(flow.drop).filter(([id, share]) => share > 0 && places.has(id));
    sparks += hotNodes.reduce((sum, [, share]) => sum + share, 0) * SPARKS_PER_SECOND * dt;
    while (sparks >= 1 && hotNodes.length) {
      sparks -= 1;
      if (dots.length >= MAX_DOTS) continue;
      const [id] = hotNodes[Math.floor(Math.random() * hotNodes.length)];
      const place = places.get(id);
      if (place) dots.push(spill({ path: [], segment: 0, along: 0, state: "lost", x: 0, y: 0, vx: 0, vy: 0, age: 0 }, place));
    }
    dots = dots.filter((dot) => {
      if (dot.state !== "moving") {
        dot.age += dt;
        dot.vy += 260 * dt;
        dot.x += dot.vx * dt;
        dot.y += dot.vy * dt;
        return dot.age < (dot.state === "lost" ? LOST_SECONDS : ANSWERED_SECONDS);
      }
      dot.along += dt / SEGMENT_SECONDS;
      if (dot.along < 1) return true;
      const reached = dot.path[dot.segment + 1];
      const place = places.get(reached);
      if (!place) return false;
      if (Math.random() < (flow.drop[reached] ?? 0)) {
        spill(dot, place);
        return true;
      }
      if (Math.random() < (flow.absorb[reached] ?? 0)) {
        Object.assign(dot, { state: "answered", x: place.x, y: place.y, vx: 0, vy: 0, age: 0 });
        return true;
      }
      dot.segment += 1;
      dot.along = 0;
      return dot.segment < dot.path.length - 1;
    });
  }

  function draw() {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1;
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.24;
    ctx.beginPath();
    for (const [from, to] of wires) {
      const a = places.get(from);
      const b = places.get(to);
      if (!a || !b) continue;
      const x0 = a.x + a.r;
      const x3 = b.x - b.r;
      const middle = (x0 + x3) / 2;
      ctx.moveTo(x0, a.y);
      ctx.bezierCurveTo(middle, a.y, middle, b.y, x3, b.y);
    }
    ctx.stroke();

    const narrow = width < 560;
    const base = narrow ? 1.8 : 2.6;
    // The wires are short on a phone, so heavy dots swell by less there or they'd merge into a bar.
    const size = base * (narrow ? 1 + (heft - 1) / 2 : heft);
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    for (const dot of dots) {
      if (dot.state !== "moving") continue;
      const a = places.get(dot.path[dot.segment]);
      const b = places.get(dot.path[dot.segment + 1]);
      if (!a || !b) continue;
      const point = wirePoint(a, b, dot.along);
      ctx.moveTo(point.x + size, point.y);
      ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
    }
    ctx.fill();

    for (const dot of dots) {
      if (dot.state === "moving") continue;
      const left = 1 - dot.age / (dot.state === "lost" ? LOST_SECONDS : ANSWERED_SECONDS);
      ctx.globalAlpha = Math.sqrt(Math.max(0, left));
      ctx.fillStyle = dot.state === "lost" ? hot : ink;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, dot.state === "lost" ? base * 1.35 * Math.sqrt(heft) : size * (1 + (1 - left) * 2.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function tick(now: number) {
    frame = 0;
    if (destroyed || !onScreen || document.visibilityState === "hidden" || now - lastChange > IDLE_LIMIT) return;
    frame = requestAnimationFrame(tick);
    if (now - lastDraw < frameGap) return;
    const dt = Math.min(0.05, lastTick ? (now - lastTick) / 1000 : 1 / 60);
    lastTick = now;
    lastDraw = now;
    if (now < settleUntil) places = readPlaces();
    advance(dt);
    draw();
  }

  function wake() {
    if (motion.matches) {
      places = readPlaces();
      dots = [];
      draw();
      return;
    }
    if (!frame && onScreen && !destroyed && document.visibilityState !== "hidden") {
      lastTick = 0;
      frame = requestAnimationFrame(tick);
    }
  }

  const onScheme = () => { readColors(); wake(); };
  const onVisibility = () => wake();
  const onActivity = () => { lastChange = performance.now(); wake(); };
  const resizer = new ResizeObserver(() => { measure(); settleUntil = performance.now() + SETTLE_MS; wake(); draw(); });
  const watcher = new IntersectionObserver((entries) => {
    onScreen = entries[entries.length - 1].isIntersecting;
    if (onScreen) { lastChange = performance.now(); wake(); }
  }, { rootMargin: "80px 0px" });

  readColors();
  measure();
  resizer.observe(canvas);
  watcher.observe(canvas);
  scheme.addEventListener("change", onScheme);
  motion.addEventListener("change", onVisibility);
  document.addEventListener("visibilitychange", onVisibility);
  canvas.parentElement?.addEventListener("pointermove", onActivity, { passive: true });

  return {
    update(next) {
      flow = next;
      const seen = new Set<string>();
      wires = next.routes.flatMap((route) => route.slice(1).flatMap((to, index): [string, string][] => {
        const key = `${route[index]}>${to}`;
        if (seen.has(key)) return [];
        seen.add(key);
        return [[route[index], to]];
      }));
      places = readPlaces();
      settleUntil = performance.now() + SETTLE_MS;
      lastChange = performance.now();
      wake();
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(frame);
      resizer.disconnect();
      watcher.disconnect();
      scheme.removeEventListener("change", onScheme);
      motion.removeEventListener("change", onVisibility);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.parentElement?.removeEventListener("pointermove", onActivity);
    },
  };
}
