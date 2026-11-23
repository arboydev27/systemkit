export type Drill = {
  id: string;
  prompt: string;
  unit: string;
  answer: number;
  steps: string[];
};
export type DrillGrade = "on-target" | "ballpark" | "off";

const SECONDS_PER_DAY = 86_400;
const ON_TARGET_RATIO = 1.25;
const BALLPARK_RATIO = 2;

function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

const format = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 3 });
export const formatQuantity = (value: number) => format.format(value);

type Build = (pick: <T>(values: readonly T[]) => T) => Omit<Drill, "id">;

const templates: Record<string, Build> = {
  qps: (pick) => {
    const users = pick([2, 5, 10, 20, 50, 100]);
    const actions = pick([4, 10, 20, 40]);
    const peak = pick([2, 3, 5]);
    const average = (users * 1e6 * actions) / SECONDS_PER_DAY;
    return {
      prompt: `${users} million people use an app each day and each makes ${actions} requests. Traffic peaks at ${peak} times the daily average. What is the peak request rate?`,
      unit: "requests per second",
      answer: average * peak,
      steps: [
        `${users} million × ${actions} = ${formatQuantity(users * 1e6 * actions)} requests a day.`,
        `Divide by 86,400 seconds a day: about ${formatQuantity(average)} requests per second on average.`,
        `Multiply by the peak factor of ${peak}: about ${formatQuantity(average * peak)} requests per second.`,
      ],
    };
  },
  storage: (pick) => {
    const uploads = pick([1, 2, 5, 10, 20]);
    const size = pick([200, 500, 2, 5]);
    const inGb = size < 100;
    const years = pick([1, 2, 5]);
    const sizeMb = inGb ? size * 1000 : size;
    const terabytesPerDay = (uploads * 1e6 * sizeMb) / 1e6;
    return {
      prompt: `A service stores ${uploads} million new files a day, each about ${size} ${inGb ? "GB" : "MB"}. How much storage does it need for ${years} ${years === 1 ? "year" : "years"} of files, before replication?`,
      unit: "TB",
      answer: terabytesPerDay * 365 * years,
      steps: [
        `${uploads} million × ${sizeMb} MB = ${formatQuantity(terabytesPerDay)} TB a day (1 TB is 1,000,000 MB).`,
        `Over ${(years * 365).toLocaleString("en-US")} days: about ${formatQuantity(terabytesPerDay * 365 * years)} TB.`,
      ],
    };
  },
  bandwidth: (pick) => {
    const reads = pick([500, 1000, 5000, 20000]);
    const size = pick([100, 250, 500, 1000]);
    const megabytes = (reads * size) / 1000;
    return {
      prompt: `An image service answers ${reads.toLocaleString("en-US")} requests per second, each returning about ${size} KB. How much outbound bandwidth is that, in gigabits per second?`,
      unit: "Gbit/s",
      answer: (megabytes * 8) / 1000,
      steps: [
        `${reads.toLocaleString("en-US")} × ${size} KB = ${formatQuantity(megabytes)} MB per second.`,
        `Multiply by 8 for bits: ${formatQuantity(megabytes * 8)} Mbit/s, or about ${formatQuantity((megabytes * 8) / 1000)} Gbit/s.`,
      ],
    };
  },
  servers: (pick) => {
    const peak = pick([2000, 5000, 12000, 30000]);
    const perServer = pick([200, 500, 1000]);
    const target = pick([50, 60, 70]);
    const usable = perServer * (target / 100);
    return {
      prompt: `A web tier must handle ${peak.toLocaleString("en-US")} requests per second at peak. One server has been benchmarked at ${perServer} requests per second, and you want to run servers at no more than ${target}% of that. How many servers do you need?`,
      unit: "servers",
      answer: Math.ceil(peak / usable),
      steps: [
        `Usable capacity per server: ${perServer} × ${target}% = ${formatQuantity(usable)} requests per second.`,
        `${peak.toLocaleString("en-US")} ÷ ${formatQuantity(usable)} rounds up to ${Math.ceil(peak / usable)} servers, before any spare for failures.`,
      ],
    };
  },
  cache: (pick) => {
    const keys = pick([10, 50, 100, 500]);
    const hot = pick([10, 20, 30]);
    const size = pick([1, 2, 5, 10]);
    const gigabytes = keys * 1e6 * (hot / 100) * size / 1e6;
    return {
      prompt: `A product has ${keys} million items, each cached entry about ${size} KB. To cache the hottest ${hot}% of items, how much cache memory do you need, ignoring overhead?`,
      unit: "GB",
      answer: gigabytes,
      steps: [
        `${hot}% of ${keys} million = ${formatQuantity(keys * (hot / 100))} million entries.`,
        `Each is ${size} KB, so about ${formatQuantity(gigabytes)} GB (1 GB is 1,000,000 KB).`,
      ],
    };
  },
  availability: (pick) => {
    const target = pick(["99", "99.5", "99.9", "99.95", "99.99"]);
    const minutes = 30 * 24 * 60 * (1 - Number(target) / 100);
    return {
      prompt: `A service promises ${target}% availability over a 30-day month. How many minutes of downtime does that allow per month?`,
      unit: "minutes",
      answer: minutes,
      steps: [
        `30 days is 43,200 minutes.`,
        `The allowed share is ${formatQuantity(100 - Number(target))}%, so about ${formatQuantity(minutes)} minutes.`,
      ],
    };
  },
  fanout: (pick) => {
    const posts = pick([100, 500, 2000]);
    const followers = pick([50, 200, 400]);
    const writes = posts * followers;
    return {
      prompt: `A social app receives ${posts.toLocaleString("en-US")} posts per second, and the average author has ${followers} followers. With fan-out on write, how many feed inserts per second is that?`,
      unit: "inserts per second",
      answer: writes,
      steps: [
        `Each post writes to every follower's feed: ${posts.toLocaleString("en-US")} × ${followers} = ${formatQuantity(writes)} inserts per second.`,
        `Averages hide a lot: one account with millions of followers can dominate this number.`,
      ],
    };
  },
};

export const drillTemplates = Object.keys(templates);

/** A drill from its id, or undefined for an id from an unknown link. The same id always gives the same drill. */
export function buildDrill(id: string): Drill | undefined {
  const [template, seedText] = id.split(".");
  const seed = Number(seedText);
  if (!Object.hasOwn(templates, template) || !Number.isInteger(seed) || seed < 0) return undefined;
  const next = random(seed);
  return { id, ...templates[template](<T,>(values: readonly T[]) => values[Math.floor(next() * values.length)]) };
}

/** Moves through the templates in turn, so no two drills in a row practise the same arithmetic. */
export function nextDrillId(previous: string | null, seed: number): string {
  const index = previous ? drillTemplates.indexOf(previous.split(".")[0]) : -1;
  return `${drillTemplates[(index + 1) % drillTemplates.length]}.${seed}`;
}

const SCALES: Record<string, number> = { k: 1e3, thousand: 1e3, m: 1e6, million: 1e6, b: 1e9, bn: 1e9, billion: 1e9, t: 1e12, trillion: 1e12 };
const DATA_UNITS: Record<string, number> = { kb: 1e-3, mb: 1, gb: 1e3, tb: 1e6, pb: 1e9 };

/** Reads "1.2k", "3,400", "2 million", "5e6", or "2000 GB" when the question asks for a data size. */
export function parseQuantity(text: string, unit: string): number | undefined {
  const match = text.trim().toLowerCase().replace(/,/g, "").match(/^~?\s*(\d*\.?\d+(?:e[-+]?\d+)?)\s*([a-z/ ]*)$/);
  if (!match) return undefined;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return undefined;
  const suffix = match[2].trim().split(/\s+/)[0] ?? "";
  if (Object.hasOwn(DATA_UNITS, suffix) && Object.hasOwn(DATA_UNITS, unit.toLowerCase())) {
    return (value * DATA_UNITS[suffix]) / DATA_UNITS[unit.toLowerCase()];
  }
  if (Object.hasOwn(SCALES, suffix)) return value * SCALES[suffix];
  return value;
}

export function gradeDrill(answer: number, given: number): DrillGrade {
  if (given <= 0 || answer <= 0) return "off";
  const ratio = Math.max(answer / given, given / answer);
  if (ratio <= ON_TARGET_RATIO) return "on-target";
  return ratio <= BALLPARK_RATIO ? "ballpark" : "off";
}
