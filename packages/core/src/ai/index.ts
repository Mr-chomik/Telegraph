import type { AppEnv } from "../lib/env";
import { NoAIProvider } from "./noai";
import { OllamaProvider } from "./ollama";
import type { AIProvider } from "./types";

export * from "./types";
export { NoAIProvider } from "./noai";
export { OllamaProvider } from "./ollama";

export function createAiProvider(env: AppEnv): AIProvider {
  if (env.aiProvider === "ollama") {
    return new OllamaProvider({
      baseUrl: env.ollamaBaseUrl,
      model: env.localModel,
    });
  }
  return new NoAIProvider();
}

/** True when the configured setup may use AI to refine editorial content. */
export function aiRefinementEnabled(env: AppEnv): boolean {
  return env.aiProvider === "ollama" && env.aiMode !== "off";
}