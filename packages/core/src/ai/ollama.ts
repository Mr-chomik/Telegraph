import { z } from "zod";
import { log } from "../lib/logger";
import { plausibleAgainstSources, type AIProvider, type AiRefineInput, type AiRefineOutput } from "./types";

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  timeoutMs?: number;
}

const refineSchema = z.object({
  headline: z.string().min(1).max(200).optional(),
  summary: z.string().min(1).max(1200).optional(),
  longForm: z.string().min(1).max(5000).optional(),
  uncertainty: z.boolean().optional(),
  importanceDelta: z.number().min(-20).max(20).optional(),
});

function buildPrompt(input: AiRefineInput): string {
  const lang = input.language === "en" ? "English" : "Russian";
  const sources = input.sources.map((s, i) => `${i + 1}. ${s}`).join("\n");
  return [
    `You are a cautious newspaper editor. Language of the output: ${lang}.`,
    "Summarize ONLY the facts present in the sources. Never invent names, numbers or quotes.",
    "If sources conflict, set uncertainty=true and do NOT silently merge versions.",
    'Return a JSON object with this exact shape: {"headline": "short punchy headline", "summary": "2-3 sentences", "longForm": "3-5 paragraphs", "uncertainty": false, "importanceDelta": 0}',
    "",
    "Draft headline for reference:",
    input.draftHeadline,
    "Draft summary for reference:",
    input.draftSummary,
    "",
    "Source texts:",
    sources,
  ].join("\n");
}

/**
 * Level 2/3 — optional local LLM via Ollama. Refines headline/summary/long-form
 * with strict JSON + zoning; any failure returns null so the caller falls back
 * to deterministic output. Never a hard dependency.
 */
export class OllamaProvider implements AIProvider {
  readonly name = "ollama";
  private readonly timeoutMs: number;
  private cachedAvailability: boolean | null = null;
  private availabilityAt = 0;

  constructor(private readonly config: OllamaConfig) {
    this.timeoutMs = config.timeoutMs ?? 45_000;
  }

  async isAvailable(): Promise<boolean> {
    const now = Date.now();
    if (this.cachedAvailability !== null && now - this.availabilityAt < 30_000) {
      return this.cachedAvailability;
    }
    try {
      const res = await this.post("/api/tags", undefined);
      this.cachedAvailability = res?.ok ?? false;
    } catch {
      this.cachedAvailability = false;
    }
    this.availabilityAt = now;
    return this.cachedAvailability;
  }

  async refine(input: AiRefineInput): Promise<AiRefineOutput | null> {
    if (!(await this.isAvailable())) return null;
    try {
      const body = {
        model: this.config.model,
        prompt: buildPrompt(input),
        stream: false,
        format: "json",
        options: { temperature: 0.4, num_predict: 1400 },
      };
      const res = await this.post("/api/generate", body);
      if (!res?.ok) {
        log.warn("ollama generate failed", { status: res?.status });
        return null;
      }
      const data = (await res.json()) as { response?: string };
      const raw = JSON.parse(data.response ?? "{}") as unknown;
      const parsed = refineSchema.safeParse(raw);
      if (!parsed.success) {
        log.warn("ollama returned invalid output", { issue: parsed.error.issues[0]?.message });
        return null;
      }
      const output: AiRefineOutput = {
        headline: plausibleAgainstSources(parsed.data.headline, input.sources)
          ? parsed.data.headline
          : undefined,
        summary: plausibleAgainstSources(parsed.data.summary, input.sources)
          ? parsed.data.summary
          : undefined,
        longForm: plausibleAgainstSources(parsed.data.longForm, input.sources)
          ? parsed.data.longForm
          : undefined,
        uncertainty: parsed.data.uncertainty,
        importanceDelta: parsed.data.importanceDelta,
      };
      if (!output.headline && !output.summary && !output.longForm && output.uncertainty === undefined) {
        return null;
      }
      return output;
    } catch (err) {
      log.warn("ollama refine failed", { err: err instanceof Error ? err.message : String(err) });
      return null;
    }
  }

  private async post(path: string, body?: unknown): Promise<Response | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const url = `${this.config.baseUrl.replace(/\/$/, "")}${path}`;
      const res = await fetch(url, {
        method: body === undefined ? "GET" : "POST",
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      return res;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}