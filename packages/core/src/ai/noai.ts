import type { AIProvider, AiRefineInput, AiRefineOutput } from "./types";

/**
 * Level 1 — no AI. The deterministic pipeline produces everything and this
 * provider never suggests changes. Guarantees the system works with zero
 * models installed and no network access.
 */
export class NoAIProvider implements AIProvider {
  readonly name = "none";

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async refine(_input: AiRefineInput): Promise<AiRefineOutput | null> {
    void _input;
    return null;
  }
}