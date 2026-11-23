import type { ReviewVariation } from "../../lib/review";

export const frameworkReview: Record<string, ReviewVariation> = {
  "framework/framework-scope": {
    prompts: ["A team asks you to design a booking service. What do you clarify before drawing it?", "Why can two good engineers propose very different systems for the same vague request?"],
    answer: "Agree on users, their main actions, the first release, and what is outside scope. Different assumptions about those things lead to different architectures; make the assumptions explicit before choosing components.",
  },
  "framework/framework-requirements": {
    prompts: ["A service must accept uploads and show them within two seconds. Separate the feature from its quality requirement.", "Before choosing storage, how would you turn ‘make it fast and reliable’ into something you can design against?"],
    answer: "Accepting and displaying uploads is behavior. A two-second target is a measurable quality constraint. Clarify latency, availability, consistency, and workload expectations, and state assumptions wherever the answer is unknown.",
  },
  "framework/framework-estimates": {
    prompts: ["Two products each have one million accounts. Why might their infrastructure needs be very different?", "What would you ask before estimating capacity for a newly proposed video service?"],
    answer: "Registered accounts do not reveal workload. Ask about active users, actions per user, read/write mix, peaks, payload size, and retention. Carry units through rough calculations and use the result to guide a design decision.",
  },
  "framework/framework-blueprint": {
    prompts: ["What should a first architecture drawing make clear before you add caches and replicas?", "You have agreed on scope. What belongs in the smallest useful system blueprint?"],
    answer: "Show the clients, main service responsibilities, persistent storage, and the important request/data paths. Explain how the design supports the agreed behavior. Add more components when a requirement or bottleneck gives them a purpose.",
  },
  "framework/framework-flows": {
    prompts: ["Your diagram has all the expected boxes. How can you check that it actually supports a user action?", "Walk through a write and a later read. What questions expose gaps that a box diagram might hide?"],
    answer: "Trace a concrete request end to end: entry, validation, work, persistence, response, and later retrieval. State who owns the data, when success is acknowledged, and what happens if a step fails.",
  },
  "framework/framework-iterate": {
    prompts: ["A teammate proposes reusing an existing service. How should that change the design discussion?", "A reviewer challenges one of your assumptions. What is a productive next step?"],
    answer: "Clarify the feedback, compare options against requirements, and revise the design when the evidence supports it. Explain the tradeoff. Iteration makes the design stronger; defending the first drawing is not the goal.",
  },
  "framework/framework-deep-dive": {
    prompts: ["You have time to investigate only one part of a design. How do you choose it?", "Which deserves more detail: a familiar low-risk component or an uncertain path that could violate the main requirement?"],
    answer: "Deep dive into the highest risk, hardest constraint, or likely bottleneck. Explain the data model, algorithms, scaling, or failure behavior there. Distributing equal time across every box can leave the important risk unresolved.",
  },
  "framework/framework-review": {
    prompts: ["What should you leave a reader with when closing a system design?", "A design meets today’s requirements. What do you still summarize before calling the discussion finished?"],
    answer: "Recap the design, the key tradeoffs, known failure modes and bottlenecks, and useful next steps. Distinguish what is established from assumptions that still need validation.",
  },
};
