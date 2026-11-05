import { TOPICS, type Topic } from "./taxonomy.js";

const STOPWORDS = new Set(["and", "the", "a", "an", "of", "for", "to", "with", "in", "on", "s", "who", "our", "we", "is", "are"]);

/**
 * Lower-cases text and turns it into a list of simple word "stems".
 * - "fragrance-free" / "gluten free" become one token ("fragrancefree") so a
 *   product WITHOUT fragrance never matches the word "fragrance".
 * - Plurals are reduced: "serums" → "serum", "workouts" → "workout".
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\b([a-z]+)[\s-]free\b/g, "$1free")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((w) => w.length > 0 && !STOPWORDS.has(w))
    .map(stem);
}

function stem(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

/** One taxonomy term found in a piece of text. */
export interface TermHit {
  topic: Topic;
  /** The term as written in the taxonomy, e.g. "oily skin" */
  term: string;
}

// Pre-tokenise every taxonomy term once, longest first.
const TERM_INDEX = TOPICS.flatMap((topic) => topic.terms.map((term) => ({ topic, term, tokens: tokenize(term) })))
  .filter((t) => t.tokens.length > 0)
  .sort((a, b) => b.tokens.length - a.tokens.length);

/**
 * Finds taxonomy terms in text using LONGEST MATCH FIRST: at each position we
 * take the longest term that fits, then skip past it. So "home workouts"
 * becomes the topic "Home workouts", not ALSO the topic "Home".
 */
export function findTerms(text: string): TermHit[] {
  const tokens = tokenize(text);
  const hits: TermHit[] = [];
  let i = 0;
  while (i < tokens.length) {
    const match = TERM_INDEX.find((t) => t.tokens.every((tok, k) => tokens[i + k] === tok));
    if (match) {
      hits.push({ topic: match.topic, term: match.term });
      i += match.tokens.length;
    } else {
      i += 1;
    }
  }
  return hits;
}

/** True if every word of `phrase` appears in `text` in order (used for conflict detection). */
export function containsPhrase(text: string, phrase: string): boolean {
  const tokens = tokenize(text);
  const p = tokenize(phrase);
  if (!p.length) return false;
  for (let i = 0; i + p.length <= tokens.length; i++) {
    if (p.every((tok, k) => tokens[i + k] === tok)) return true;
  }
  return false;
}
