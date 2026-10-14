import type { TeachingContent } from "../../lib/spatial-learning-types";

// Authored explanation points and illustrative diagram scenarios.
export const frameworkTeachingContent: Record<string, TeachingContent> = {
  "framework-scope": {
    "layout": "pipeline",
    "nodeRoles": {
      "framework-scope:node:0": {"lane": 0, "order": 2, "semanticId": "initial-prompt"},
      "framework-scope:node:1": {"lane": 1, "order": 2, "semanticId": "clarifying-questions"},
      "framework-scope:node:2": {"lane": 2, "order": 2, "semanticId": "agreed-scope"}
    },
    "relationships": {
      "framework-scope:relation:0": {"meaning": "decision", "condition": "", "explanation": "Initial prompt → Clarifying questions: ask before drawing. users · jobs · boundaries."},
      "framework-scope:relation:1": {"meaning": "decision", "condition": "", "explanation": "Clarifying questions → Agreed scope: state the boundary. a testable first version."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "framework-scope:explain:1",
        "title": "Clarify the intended product",
        "description": "A request such as “build a news feed” can describe many products. Ask who uses it, which actions matter most, and what the first version must support. A feed of recent friends’ posts has a different shape from one that ranks videos from strangers.",
        "nodeIds": ["framework-scope:node:0", "framework-scope:node:1", "framework-scope:node:2"],
        "linkIds": ["framework-scope:relation:0", "framework-scope:relation:1"]
      },
      {
        "id": "framework-scope:explain:2",
        "title": "Agree on the first release",
        "description": "Name the core use cases, identify what can wait, and confirm that boundary with the people making the request. The purpose is to design the right system for a stated problem, not to include every technology you know.",
        "nodeIds": ["framework-scope:node:0", "framework-scope:node:1", "framework-scope:node:2"],
        "linkIds": ["framework-scope:relation:0", "framework-scope:relation:1"]
      }
    ],
    "views": [],
    "predictions": [
      {
        "id": "framework-scope:predict:fq01",
        "title": "Predict the design consequence",
        "prompt": "Someone asks you to design a “news feed.” What is the most useful first move?",
        "options": ["Clarify users and core feed behaviors", "Choose a distributed database", "Draw five regions", "Optimize ranking"],
        "correctIndex": 0,
        "explanation": "A broad name does not establish the product. Clarifying behavior and scope makes later choices meaningful.",
        "reveal": {
          "id": "framework-scope:reveal:fq01",
          "title": "Why this choice follows",
          "description": "A broad name does not establish the product. Clarifying behavior and scope makes later choices meaningful.",
          "nodeIds": ["framework-scope:node:0", "framework-scope:node:1", "framework-scope:node:2"],
          "linkIds": ["framework-scope:relation:0", "framework-scope:relation:1"]
        }
      }
    ]
  },
  "framework-requirements": {
    "layout": "pipeline",
    "nodeRoles": {
      "framework-requirements:node:0": {"lane": 0, "order": 1, "semanticId": "functional-needs"},
      "framework-requirements:node:1": {"lane": 0, "order": 2, "semanticId": "quality-goals"},
      "framework-requirements:node:2": {"lane": 0, "order": 4, "semanticId": "assumptions"},
      "framework-requirements:node:3": {"lane": 1, "order": 2, "semanticId": "prioritize"},
      "framework-requirements:node:4": {"lane": 2, "order": 2, "semanticId": "design-brief"}
    },
    "relationships": {
      "framework-requirements:relation:0": {"meaning": "decision", "condition": "", "explanation": "Functional needs (actions people can perform) leads to Prioritize (resolve the tradeoffs) in this lesson. Functional requirements say what happens; quality requirements say how well and under what load."},
      "framework-requirements:relation:1": {"meaning": "decision", "condition": "", "explanation": "Quality goals (latency · availability · cost) leads to Prioritize (resolve the tradeoffs) in this lesson. Functional requirements say what happens; quality requirements say how well and under what load."},
      "framework-requirements:relation:2": {"meaning": "decision", "condition": "", "explanation": "Assumptions (unknowns to validate) leads to Prioritize (resolve the tradeoffs) in this lesson. Functional requirements say what happens; quality requirements say how well and under what load."},
      "framework-requirements:relation:3": {"meaning": "decision", "condition": "", "explanation": "Prioritize → Design brief: write down. constraints + success checks."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "framework-requirements:explain:1",
        "title": "Separate behavior from quality goals",
        "description": "Functional requirements describe observable actions: publish a post, view a feed, or attach a photo. Quality requirements describe the conditions under which those actions must work: response time, availability, durability, privacy, and expected load. A feature can work in a demo and still fail in production.",
        "nodeIds": ["framework-requirements:node:0", "framework-requirements:node:1", "framework-requirements:node:3"],
        "linkIds": ["framework-requirements:relation:0", "framework-requirements:relation:1"],
        "viewId": "framework-requirements:view:point-1"
      },
      {
        "id": "framework-requirements:explain:2",
        "title": "Record assumptions and priorities",
        "description": "Ask for figures and priorities when they exist. When they do not, make an explicit assumption with a reason and mark it for confirmation. Assuming reverse chronological ordering simplifies a feed, but it is a product choice. Existing services and team constraints also affect the design.",
        "nodeIds": ["framework-requirements:node:2", "framework-requirements:node:3", "framework-requirements:node:4"],
        "linkIds": ["framework-requirements:relation:2", "framework-requirements:relation:3"],
        "viewId": "framework-requirements:view:point-2"
      }
    ],
    "views": [
      {
        "id": "framework-requirements:view:point-1",
        "title": "Separate behavior from quality goals",
        "description": "Functional requirements describe observable actions: publish a post, view a feed, or attach a photo. Quality requirements describe the conditions under which those actions must work: response time, availability, durability, privacy, and expected load. A feature can work in a demo and still fail in production.",
        "members": ["framework-requirements:node:0", "framework-requirements:node:1", "framework-requirements:node:3"],
        "layout": "pipeline"
      },
      {
        "id": "framework-requirements:view:point-2",
        "title": "Record assumptions and priorities",
        "description": "Ask for figures and priorities when they exist. When they do not, make an explicit assumption with a reason and mark it for confirmation. Assuming reverse chronological ordering simplifies a feed, but it is a product choice. Existing services and team constraints also affect the design.",
        "members": ["framework-requirements:node:2", "framework-requirements:node:3", "framework-requirements:node:4"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "framework-requirements:predict:fq04",
        "title": "Predict the design consequence",
        "prompt": "Feed ordering is unspecified. What should you do?",
        "options": ["Silently choose ranked order", "Skip the read path", "Choose the most complex option", "Ask and record an explicit assumption if needed"],
        "correctIndex": 3,
        "explanation": "Ordering changes retrieval. Make the uncertainty visible and confirm or revisit the assumption.",
        "reveal": {
          "id": "framework-requirements:reveal:fq04",
          "title": "Why this choice follows",
          "description": "Ordering changes retrieval. Make the uncertainty visible and confirm or revisit the assumption.",
          "nodeIds": ["framework-requirements:node:2", "framework-requirements:node:3", "framework-requirements:node:4"],
          "linkIds": ["framework-requirements:relation:2", "framework-requirements:relation:3"]
        }
      }
    ]
  },
  "framework-estimates": {
    "layout": "pipeline",
    "nodeRoles": {
      "framework-estimates:node:0": {"lane": 0, "order": 2, "semanticId": "assumed-workload"},
      "framework-estimates:node:1": {"lane": 1, "order": 2, "semanticId": "derived-demand"},
      "framework-estimates:node:2": {"lane": 2, "order": 2, "semanticId": "capacity-check"}
    },
    "relationships": {
      "framework-estimates:relation:0": {"meaning": "decision", "condition": "", "explanation": "Assumed workload → Derived demand: calculate. QPS · storage · bandwidth."},
      "framework-estimates:relation:1": {"meaning": "decision", "condition": "", "explanation": "Derived demand → Capacity check: compare. headroom or bottleneck?."},
      "framework-estimates:relation:2": {"meaning": "decision", "condition": "", "explanation": "Capacity check → Assumed workload: revise a weak assumption. users · actions · bytes."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "framework-estimates:explain:1",
        "title": "Calculate from the stated workload",
        "description": "Back-of-the-envelope figures can show whether one machine is plausible and which path deserves attention. Begin with active users, actions per user, peak-to-average traffic, item size, and retention. Derive approximate reads, writes, storage, and transfer; “millions of users” alone is not a workload.",
        "nodeIds": ["framework-estimates:node:0", "framework-estimates:node:1"],
        "linkIds": ["framework-estimates:relation:0"],
        "viewId": "framework-estimates:view:point-1"
      },
      {
        "id": "framework-estimates:explain:2",
        "title": "Compare capacity with visible uncertainty",
        "description": "Keep units and assumptions visible. One million daily users opening a feed ten times suggests roughly ten million feed reads per day before accounting for peaks. The important finding may be that reads dominate writes. Recalculate when a key assumption changes, and validate rough estimates with real traffic.",
        "nodeIds": ["framework-estimates:node:0", "framework-estimates:node:1", "framework-estimates:node:2"],
        "linkIds": ["framework-estimates:relation:0", "framework-estimates:relation:1", "framework-estimates:relation:2"]
      }
    ],
    "views": [
      {
        "id": "framework-estimates:view:point-1",
        "title": "Calculate from the stated workload",
        "description": "Back-of-the-envelope figures can show whether one machine is plausible and which path deserves attention. Begin with active users, actions per user, peak-to-average traffic, item size, and retention. Derive approximate reads, writes, storage, and transfer; “millions of users” alone is not a workload.",
        "members": ["framework-estimates:node:0", "framework-estimates:node:1"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "framework-estimates:predict:fq05",
        "title": "Predict the design consequence",
        "prompt": "What extra information best turns a count of registered accounts into a read-traffic estimate?",
        "options": ["Daily active users and feed opens per active user", "Database table count", "CSS framework", "Engineering team size"],
        "correctIndex": 0,
        "explanation": "Registered accounts do not indicate request rate. Active usage and frequency do.",
        "reveal": {
          "id": "framework-estimates:reveal:fq05",
          "title": "Why this choice follows",
          "description": "Registered accounts do not indicate request rate. Active usage and frequency do.",
          "nodeIds": ["framework-estimates:node:0", "framework-estimates:node:1"],
          "linkIds": ["framework-estimates:relation:0"]
        }
      }
    ]
  },
  "framework-blueprint": {
    "layout": "pipeline",
    "nodeRoles": {
      "framework-blueprint:node:0": {"lane": 0, "order": 2, "semanticId": "client"},
      "framework-blueprint:node:1": {"lane": 1, "order": 2, "semanticId": "service"},
      "framework-blueprint:node:2": {"lane": 2, "order": 2, "semanticId": "data-store"},
      "framework-blueprint:node:3": {"lane": 1, "order": 4, "semanticId": "boundary-notes"}
    },
    "relationships": {
      "framework-blueprint:relation:0": {"meaning": "decision", "condition": "", "explanation": "Client → Service: request. handles the request."},
      "framework-blueprint:relation:1": {"meaning": "decision", "condition": "", "explanation": "Service → Data store: read / write. keeps durable state."},
      "framework-blueprint:relation:2": {"meaning": "decision", "condition": "", "explanation": "Service (handles the request) leads to Boundary notes (ownership · failure · trust) in this lesson. Every component should serve a stated requirement or constraint."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "framework-blueprint:explain:1",
        "title": "Assign responsibilities and data boundaries",
        "description": "Start with clients and the service boundary. Add components needed to explain primary behavior: an API or web tier, persistent store, and any cache, media store, or queue with a clear role. Arrows should show who sends a request, where a write lands, and who returns the result.",
        "nodeIds": ["framework-blueprint:node:0", "framework-blueprint:node:1", "framework-blueprint:node:2", "framework-blueprint:node:3"],
        "linkIds": ["framework-blueprint:relation:0", "framework-blueprint:relation:1", "framework-blueprint:relation:2"]
      },
      {
        "id": "framework-blueprint:explain:2",
        "title": "Review the first design hypothesis",
        "description": "Treat the blueprint as a shared hypothesis. Check it against requirements and rough numbers, then invite feedback. A box called “database” is enough when the open question is the request path. Choose schemas or algorithms when those details become the decision at hand.",
        "nodeIds": ["framework-blueprint:node:0", "framework-blueprint:node:1", "framework-blueprint:node:2"],
        "linkIds": ["framework-blueprint:relation:0", "framework-blueprint:relation:1"],
        "viewId": "framework-blueprint:view:point-2"
      }
    ],
    "views": [
      {
        "id": "framework-blueprint:view:point-2",
        "title": "Review the first design hypothesis",
        "description": "Treat the blueprint as a shared hypothesis. Check it against requirements and rough numbers, then invite feedback. A box called “database” is enough when the open question is the request path. Choose schemas or algorithms when those details become the decision at hand.",
        "members": ["framework-blueprint:node:0", "framework-blueprint:node:1", "framework-blueprint:node:2"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "framework-blueprint:predict:fq07",
        "title": "Predict the design consequence",
        "prompt": "What should each component establish in the first blueprint?",
        "options": ["Every schema field", "Deployment commands", "Its purpose and the data path through it", "Its final vendor and size"],
        "correctIndex": 2,
        "explanation": "The first diagram establishes responsibilities and flow. Details follow where they resolve a decision.",
        "reveal": {
          "id": "framework-blueprint:reveal:fq07",
          "title": "Why this choice follows",
          "description": "The first diagram establishes responsibilities and flow. Details follow where they resolve a decision.",
          "nodeIds": ["framework-blueprint:node:1", "framework-blueprint:node:2", "framework-blueprint:node:3"],
          "linkIds": ["framework-blueprint:relation:1", "framework-blueprint:relation:2"]
        }
      }
    ]
  },
  "framework-flows": {
    "layout": "pipeline",
    "nodeRoles": {
      "framework-flows:node:0": {"lane": 0, "order": 1, "semanticId": "write-request"},
      "framework-flows:node:1": {"lane": 1, "order": 1, "semanticId": "validate-persist"},
      "framework-flows:node:2": {"lane": 2, "order": 1, "semanticId": "write-response"},
      "framework-flows:node:3": {"lane": 0, "order": 4, "semanticId": "read-request"},
      "framework-flows:node:4": {"lane": 1, "order": 4, "semanticId": "fetch-shape"},
      "framework-flows:node:5": {"lane": 2, "order": 4, "semanticId": "read-response"}
    },
    "relationships": {
      "framework-flows:relation:0": {"meaning": "decision", "condition": "", "explanation": "Write request → Validate & persist: write path. check · store · confirm."},
      "framework-flows:relation:1": {"meaning": "decision", "condition": "", "explanation": "Validate & persist (check · store · confirm) leads to Write response (success or error) in this lesson. Trace at least one important write and one read from start to response."},
      "framework-flows:relation:2": {"meaning": "decision", "condition": "", "explanation": "Read request → Fetch & shape: read path. find · authorize · format."},
      "framework-flows:relation:3": {"meaning": "decision", "condition": "", "explanation": "Fetch & shape (find · authorize · format) leads to Read response (data or error) in this lesson. Trace at least one important write and one read from start to response."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "framework-flows:explain:1",
        "title": "Trace one write and one read",
        "description": "For a feed, follow one person publishing a post: request, validation, persistent write, and any work needed to make it visible. Then follow a friend opening the feed: find relevant posts, order them, and return a page. The paths may place different pressure on storage and computation.",
        "nodeIds": ["framework-flows:node:0", "framework-flows:node:1", "framework-flows:node:2", "framework-flows:node:4"],
        "linkIds": ["framework-flows:relation:0", "framework-flows:relation:1"],
        "viewId": "framework-flows:view:point-1"
      },
      {
        "id": "framework-flows:explain:2",
        "title": "Use requests to expose missing behavior",
        "description": "Use concrete examples to test the arrows. Ask what happens with an image, no recent posts, or a read just after a write. These reveal missing responsibilities and edge cases while the blueprint is cheap to change.",
        "nodeIds": ["framework-flows:node:0", "framework-flows:node:1", "framework-flows:node:2", "framework-flows:node:3", "framework-flows:node:5"],
        "linkIds": ["framework-flows:relation:0", "framework-flows:relation:1"],
        "viewId": "framework-flows:view:point-2"
      }
    ],
    "views": [
      {
        "id": "framework-flows:view:point-1",
        "title": "Trace one write and one read",
        "description": "For a feed, follow one person publishing a post: request, validation, persistent write, and any work needed to make it visible. Then follow a friend opening the feed: find relevant posts, order them, and return a page. The paths may place different pressure on storage and computation.",
        "members": ["framework-flows:node:0", "framework-flows:node:1", "framework-flows:node:2", "framework-flows:node:4"],
        "layout": "pipeline"
      },
      {
        "id": "framework-flows:view:point-2",
        "title": "Use requests to expose missing behavior",
        "description": "Use concrete examples to test the arrows. Ask what happens with an image, no recent posts, or a read just after a write. These reveal missing responsibilities and edge cases while the blueprint is cheap to change.",
        "members": ["framework-flows:node:0", "framework-flows:node:1", "framework-flows:node:2", "framework-flows:node:3", "framework-flows:node:5"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "framework-flows:predict:fq09",
        "title": "Predict the design consequence",
        "prompt": "Which pair of walkthroughs best tests a simple feed design?",
        "options": ["Publish one post and retrieve a friend’s feed", "Deploy a server and rotate a password", "Open a dashboard and change a theme", "Estimate a bill and choose a font"],
        "correctIndex": 0,
        "explanation": "A write and a read exercise the core behaviors and expose how data is stored, found, and returned.",
        "reveal": {
          "id": "framework-flows:reveal:fq09",
          "title": "Why this choice follows",
          "description": "A write and a read exercise the core behaviors and expose how data is stored, found, and returned.",
          "nodeIds": ["framework-flows:node:0", "framework-flows:node:1", "framework-flows:node:2", "framework-flows:node:3", "framework-flows:node:4", "framework-flows:node:5"],
          "linkIds": ["framework-flows:relation:0", "framework-flows:relation:1", "framework-flows:relation:2", "framework-flows:relation:3"]
        }
      }
    ]
  },
  "framework-iterate": {
    "layout": "pipeline",
    "nodeRoles": {
      "framework-iterate:node:0": {"lane": 0, "order": 2, "semanticId": "draft-design"},
      "framework-iterate:node:1": {"lane": 1, "order": 2, "semanticId": "test-against-goals"},
      "framework-iterate:node:2": {"lane": 2, "order": 2, "semanticId": "get-feedback"},
      "framework-iterate:node:3": {"lane": 1, "order": 4, "semanticId": "revise-one-choice"}
    },
    "relationships": {
      "framework-iterate:relation:0": {"meaning": "decision", "condition": "", "explanation": "Draft design (state your choices) leads to Test against goals (trace flows & tradeoffs) in this lesson. Ask for feedback while changes are inexpensive."},
      "framework-iterate:relation:1": {"meaning": "decision", "condition": "", "explanation": "Test against goals (trace flows & tradeoffs) leads to Get feedback (surface weak spots) in this lesson. Ask for feedback while changes are inexpensive."},
      "framework-iterate:relation:2": {"meaning": "decision", "condition": "", "explanation": "Get feedback (surface weak spots) leads to Revise one choice (explain what changed) in this lesson. Ask for feedback while changes are inexpensive."},
      "framework-iterate:relation:3": {"meaning": "decision", "condition": "", "explanation": "Revise one choice → Draft design: next draft. state your choices."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "framework-iterate:explain:1",
        "title": "Explain choices while changes are inexpensive",
        "description": "Explain the reasoning behind each choice early. Teammates may know that a feature has another priority, an existing service already solves a problem, or a dependency cannot meet the proposed traffic. Such feedback should change the design when warranted.",
        "nodeIds": ["framework-iterate:node:0", "framework-iterate:node:2", "framework-iterate:node:3"],
        "linkIds": ["framework-iterate:relation:2", "framework-iterate:relation:3"],
        "viewId": "framework-iterate:view:point-1"
      },
      {
        "id": "framework-iterate:explain:2",
        "title": "Replay flows when scope changes",
        "description": "When feedback changes a requirement, update the assumptions and replay affected flows. Compare alternatives using the agreed goals. Record why a simpler launch design is enough or why extra complexity is justified, plus the signal that would trigger a later change.",
        "nodeIds": ["framework-iterate:node:0", "framework-iterate:node:1", "framework-iterate:node:2"],
        "linkIds": ["framework-iterate:relation:0", "framework-iterate:relation:1"],
        "viewId": "framework-iterate:view:point-2"
      }
    ],
    "views": [
      {
        "id": "framework-iterate:view:point-1",
        "title": "Explain choices while changes are inexpensive",
        "description": "Explain the reasoning behind each choice early. Teammates may know that a feature has another priority, an existing service already solves a problem, or a dependency cannot meet the proposed traffic. Such feedback should change the design when warranted.",
        "members": ["framework-iterate:node:0", "framework-iterate:node:2", "framework-iterate:node:3"],
        "layout": "pipeline"
      },
      {
        "id": "framework-iterate:view:point-2",
        "title": "Replay flows when scope changes",
        "description": "When feedback changes a requirement, update the assumptions and replay affected flows. Compare alternatives using the agreed goals. Record why a simpler launch design is enough or why extra complexity is justified, plus the signal that would trigger a later change.",
        "members": ["framework-iterate:node:0", "framework-iterate:node:1", "framework-iterate:node:2"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "framework-iterate:predict:fq11",
        "title": "Predict the design consequence",
        "prompt": "Feedback adds video to a text-only post feature. What is the best response?",
        "options": ["Add a CDN without considering upload", "Discard all earlier decisions", "Confirm scope and revise assumptions, flows, and estimates", "Keep the original design"],
        "correctIndex": 2,
        "explanation": "Media affects several parts of the design. Confirm the change, update the model, and explain tradeoffs.",
        "reveal": {
          "id": "framework-iterate:reveal:fq11",
          "title": "Why this choice follows",
          "description": "Media affects several parts of the design. Confirm the change, update the model, and explain tradeoffs.",
          "nodeIds": ["framework-iterate:node:0", "framework-iterate:node:1", "framework-iterate:node:2", "framework-iterate:node:3"],
          "linkIds": ["framework-iterate:relation:1", "framework-iterate:relation:2", "framework-iterate:relation:3"]
        }
      }
    ]
  },
  "framework-deep-dive": {
    "layout": "pipeline",
    "nodeRoles": {
      "framework-deep-dive:node:0": {"lane": 0, "order": 2, "semanticId": "risk-signal"},
      "framework-deep-dive:node:1": {"lane": 1, "order": 2, "semanticId": "compare-options"},
      "framework-deep-dive:node:2": {"lane": 2, "order": 2, "semanticId": "chosen-tradeoff"}
    },
    "relationships": {
      "framework-deep-dive:relation:0": {"meaning": "decision", "condition": "", "explanation": "Risk signal → Compare options: focus. cost · complexity · gain."},
      "framework-deep-dive:relation:1": {"meaning": "decision", "condition": "", "explanation": "Compare options → Chosen tradeoff: justify. decision + reason."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "framework-deep-dive:explain:1",
        "title": "Focus on the major design risk",
        "description": "After the blueprint is agreed, choose a critical component or bottleneck for closer study. It might be feed generation under heavy reads, short-link identifiers, or chat presence. Requirements, estimates, and feedback determine the target; equal detail across every box wastes time.",
        "nodeIds": ["framework-deep-dive:node:0", "framework-deep-dive:node:1", "framework-deep-dive:node:2"],
        "linkIds": ["framework-deep-dive:relation:0", "framework-deep-dive:relation:1"]
      },
      {
        "id": "framework-deep-dive:explain:2",
        "title": "Compare workload and failure tradeoffs",
        "description": "Compare plausible approaches using workload and failure behavior. For each, explain what improves, what becomes more complex, and what measurement would distinguish the options. If current needs fit a simpler design, its lower operating cost belongs in the decision.",
        "nodeIds": ["framework-deep-dive:node:0", "framework-deep-dive:node:1", "framework-deep-dive:node:2"],
        "linkIds": ["framework-deep-dive:relation:0", "framework-deep-dive:relation:1"]
      }
    ],
    "views": [],
    "predictions": [
      {
        "id": "framework-deep-dive:predict:fq13",
        "title": "Predict the design consequence",
        "prompt": "How should you choose what to examine after agreeing on the blueprint?",
        "options": ["Pick the component tied to a major requirement or risk", "Explain every box equally", "Start with the easiest box", "Choose the newest technology"],
        "correctIndex": 0,
        "explanation": "Focused detail is useful where it resolves a decision or risk.",
        "reveal": {
          "id": "framework-deep-dive:reveal:fq13",
          "title": "Why this choice follows",
          "description": "Focused detail is useful where it resolves a decision or risk.",
          "nodeIds": ["framework-deep-dive:node:0", "framework-deep-dive:node:1", "framework-deep-dive:node:2"],
          "linkIds": ["framework-deep-dive:relation:0", "framework-deep-dive:relation:1"]
        }
      }
    ]
  },
  "framework-review": {
    "layout": "pipeline",
    "nodeRoles": {
      "framework-review:node:0": {"lane": 0, "order": 1, "semanticId": "failure-behavior"},
      "framework-review:node:1": {"lane": 0, "order": 2, "semanticId": "operations"},
      "framework-review:node:2": {"lane": 0, "order": 4, "semanticId": "next-scale-curve"},
      "framework-review:node:3": {"lane": 1, "order": 2, "semanticId": "record-gaps"},
      "framework-review:node:4": {"lane": 2, "order": 2, "semanticId": "next-steps"}
    },
    "relationships": {
      "framework-review:relation:0": {"meaning": "decision", "condition": "", "explanation": "Failure behavior (what breaks first?) leads to Record gaps (risks · assumptions · owners) in this lesson. Review failure, monitoring, rollout, and future capacity alongside features."},
      "framework-review:relation:1": {"meaning": "decision", "condition": "", "explanation": "Operations (observe · deploy · recover) leads to Record gaps (risks · assumptions · owners) in this lesson. Review failure, monitoring, rollout, and future capacity alongside features."},
      "framework-review:relation:2": {"meaning": "decision", "condition": "", "explanation": "Next scale curve (which limit arrives next?) leads to Record gaps (risks · assumptions · owners) in this lesson. Review failure, monitoring, rollout, and future capacity alongside features."},
      "framework-review:relation:3": {"meaning": "decision", "condition": "", "explanation": "Record gaps → Next steps: prioritize. measurable follow-ups."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "framework-review:explain:1",
        "title": "Connect requirements to the design",
        "description": "Revisit the main requirements and the path that satisfies each. Identify the likely bottleneck and a reasonable next improvement. Describe when the current proposal stops being enough instead of calling it final.",
        "nodeIds": ["framework-review:node:2", "framework-review:node:3", "framework-review:node:4"],
        "linkIds": ["framework-review:relation:2", "framework-review:relation:3"],
        "viewId": "framework-review:view:point-1"
      },
      {
        "id": "framework-review:explain:2",
        "title": "Plan failures and measurable next steps",
        "description": "Check failures and day-two operation: what happens when a dependency is unavailable, which metrics and logs reveal the problem, and how changes reach production safely. If usage grows tenfold, name the first assumption to remeasure. Capture open questions for the next review.",
        "nodeIds": ["framework-review:node:0", "framework-review:node:1", "framework-review:node:2", "framework-review:node:3", "framework-review:node:4"],
        "linkIds": ["framework-review:relation:0", "framework-review:relation:1", "framework-review:relation:2", "framework-review:relation:3"]
      }
    ],
    "views": [
      {
        "id": "framework-review:view:point-1",
        "title": "Connect requirements to the design",
        "description": "Revisit the main requirements and the path that satisfies each. Identify the likely bottleneck and a reasonable next improvement. Describe when the current proposal stops being enough instead of calling it final.",
        "members": ["framework-review:node:2", "framework-review:node:3", "framework-review:node:4"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "framework-review:predict:fq15",
        "title": "Predict the design consequence",
        "prompt": "What belongs in the closing review of a design that meets today’s needs?",
        "options": ["Only the happy path", "Immediate sharding of every database", "Bottlenecks, failure, metrics, rollout, and change triggers", "A claim it is complete forever"],
        "correctIndex": 2,
        "explanation": "Review the operating and evolution path as well as the feature flow.",
        "reveal": {
          "id": "framework-review:reveal:fq15",
          "title": "Why this choice follows",
          "description": "Review the operating and evolution path as well as the feature flow.",
          "nodeIds": ["framework-review:node:0", "framework-review:node:1", "framework-review:node:2", "framework-review:node:3", "framework-review:node:4"],
          "linkIds": ["framework-review:relation:0", "framework-review:relation:1", "framework-review:relation:2", "framework-review:relation:3"]
        }
      }
    ]
  }
};
