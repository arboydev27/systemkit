export type LabInfo = {
  id: "cache" | "rate-limiters" | "quorum" | "retry-storm";
  title: string;
  /** The question the lab answers, used on the index and in page titles. */
  question: string;
  seoTitle: string;
  description: string;
  /** Static explanation for the lab's own page, readable before any interaction. */
  about: string[];
  lesson: { chapterId: string; stepId: string; title: string };
};

export const labs: LabInfo[] = [
  {
    id: "retry-storm",
    title: "Retry storm",
    question: "Why does a service stay down after the outage is over?",
    seoTitle: "Retry storm simulator: why retries keep a service down",
    description: "Set retries, backoff, and protections, predict whether a service recovers from a brief outage, and watch it happen.",
    about: [
      "Retries feel like a safety net. Under overload they can be the thing that keeps a system down: requests time out, clients send them again, and the service spends its restored capacity on work nobody is still waiting for.",
      "The usual protections are exponential backoff, jitter, retry budgets, and dropping expired work. They don't all do the same job. This lab lets you turn each one on and see which actually breaks the loop.",
    ],
    lesson: { chapterId: "patterns", stepId: "pt-retries", title: "Keep retries from sustaining an outage" },
  },
  {
    id: "rate-limiters",
    title: "Rate limiter comparison",
    question: "Which rate limiting algorithm lets a burst through?",
    seoTitle: "Rate limiter algorithms compared: token bucket vs sliding window",
    description: "Run fixed window, sliding log, sliding counter, and token bucket on the same traffic and compare what each one admits.",
    about: [
      "Fixed window, sliding log, sliding counter, and token bucket can all claim the same limit, and still let very different amounts of traffic reach your service. The difference shows up at the edges: a window boundary, a sudden spike, or a steady overload.",
      "This lab runs every request through all four algorithms. Compare how many get through in the worst span, and what each algorithm costs to keep.",
    ],
    lesson: { chapterId: "rate-limiter", stepId: "rate-windows", title: "Pick the accuracy and memory tradeoff" },
  },
  {
    id: "quorum",
    title: "Quorum explorer",
    question: "When can a quorum read return stale data?",
    seoTitle: "Quorum reads and writes: N, W, and R explained interactively",
    description: "Choose N, W, and R, take replicas down, and see exactly when a read can miss the latest write.",
    about: [
      "The rule W + R > N is easy to repeat and easy to misapply. It describes when the replicas a read asks must overlap the ones that took a write, and it says nothing about what you give up to get that guarantee.",
      "Set N, W, and R, take replicas down, and predict the outcome. The lab computes the exact chance that a read misses the latest write in the worst case, and how many failures reads and writes can each survive.",
    ],
    lesson: { chapterId: "key-value", stepId: "kv-quorum", title: "Choose read and write acknowledgments" },
  },
  {
    id: "cache",
    title: "Cache failure",
    question: "What happens to your database when the cache disappears?",
    seoTitle: "Cache failure lab: what happens when the cache goes down",
    description: "Set the request rate and hit rate, take the cache away, and predict whether the database can absorb the load.",
    about: [
      "A cache with a 90% hit rate quietly shields the database from nine out of ten reads. Capacity plans built on that number are also plans for what happens the moment it stops being true.",
      "Set a workload, decide whether the cache is healthy, and predict where database demand lands before seeing the numbers.",
    ],
    lesson: { chapterId: "scaling", stepId: "cache", title: "Cache repeated work" },
  },
];

export const findLab = (id: string) => labs.find((lab) => lab.id === id);
