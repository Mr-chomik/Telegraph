export interface AiRefineInput {
  /** Edition/user language: is used both for instructions and output. */
  language: string;
  /** The source texts the summary must be limited to (evidence grounding). */
  sources: string[];
  draftHeadline: string;
  draftSummary: string;
}

export interface AiRefineOutput {
  headline?: string;
  summary?: string;
  longForm?: string;
  /** Whether sources conflict; raises isUncertain on the story. */
  uncertainty?: boolean;
  /** Bounded importance modifier (−15..+15). */
  importanceDelta?: number;
}

export interface AIProvider {
  readonly name: string;
  isAvailable(): Promise<boolean>;
  refine(input: AiRefineInput): Promise<AiRefineOutput | null>;
}

/**
 * Evidence guard (deterministic, applies to every provider): reject output
 * sentences whose distinctive content words do not appear in the sources.
 * This hard rule makes the system refuse fabricated claims even from a local LLM.
 */
export function plausibleAgainstSources(text: string | undefined, sources: string[]): boolean {
  if (!text) return false;
  const corpus = new Set(sources.join(" ").toLowerCase().split(/\s+/).filter((w) => w.length > 3));
  let unknown = 0;
  let total = 0;
  for (const w of text.toLowerCase().split(/\s+/)) {
    if (w.length > 3) {
      total++;
      if (!corpus.has(w)) unknown++;
    }
  }
  if (total === 0) return true;
  return unknown / total <= 0.35;
}