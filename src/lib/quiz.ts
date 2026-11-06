export type QuizLike = { id: string; options: readonly string[]; correctIndex: number };

function seed(text: string) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Display order for a question's options. Saved answers keep their authored index, so
 * reordering never invalidates progress, and the same order renders on server and client.
 */
export function optionOrder(id: string, count: number): number[] {
  const order = Array.from({ length: count }, (_, index) => index);
  let state = seed(id);
  for (let i = count - 1; i > 0; i--) {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    const j = ((mixed ^ (mixed >>> 14)) >>> 0) % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export const MAX_LONGEST_SHARE = 0.4;
const MAX_CORRECT_RATIO = 1.3;
const CORRECT_LENGTH_SLACK = 8;
const MIN_SHORTEST_RATIO = 0.35;

// Distractors should be mistakes a thoughtful learner could make, not jokes to eliminate.
const THROWAWAY = /\b(css|stylesheets?|fonts?|font size|colou?rs?|themes?|logos?|emoji|favicons?|wallpapers?|dark mode|screen size|screen brightness|icons?|chapter number|page title|keyboard|mouse|monitor size|delete the database|turn off|unplug|ignore (it|them|the)|do nothing|nothing changes|no reason|random guess|at random|by magic|magically)\b/i;

export function correctIsStrictlyLongest({ options, correctIndex }: QuizLike) {
  const correct = options[correctIndex]?.length ?? 0;
  return options.every((option, index) => index === correctIndex || option.length < correct);
}

export function quizIssues(question: QuizLike): string[] {
  const issues: string[] = [];
  const { options, correctIndex } = question;
  if (options.length !== 4) issues.push("needs exactly 4 options");
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
    issues.push("correctIndex is out of range");
    return issues;
  }
  if (new Set(options).size !== options.length) issues.push("has duplicate options");
  const distractors = options.filter((_, index) => index !== correctIndex);
  const longestDistractor = Math.max(...distractors.map((option) => option.length));
  if (options[correctIndex].length > longestDistractor * MAX_CORRECT_RATIO + CORRECT_LENGTH_SLACK) {
    issues.push(`correct option is much longer than every distractor (${options[correctIndex].length} vs ${longestDistractor})`);
  }
  const lengths = options.map((option) => option.length);
  if (Math.min(...lengths) < Math.max(...lengths) * MIN_SHORTEST_RATIO) issues.push("one option is far shorter than the rest");
  for (const option of distractors) {
    if (THROWAWAY.test(option)) issues.push(`throwaway distractor: "${option}"`);
  }
  return issues;
}

export function longestOptionShare(questions: readonly QuizLike[]) {
  if (!questions.length) return 0;
  return questions.filter(correctIsStrictlyLongest).length / questions.length;
}
