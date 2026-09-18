/**
 * OmniFrog AI — PART 04 orchestration.
 *
 * Browser/open-source inference is always attempted first. PART 03's secure
 * server router is used only when the browser engine cannot answer.
 */

import { generateBrowserAi, type BrowserAiProgress } from "./browser-ai";
import { routeAiRequestFn } from "../router.functions";
import type { RouterResult } from "./router.server";

export type BrowserFirstSource = "browser" | "api-fallback" | "none";

export interface BrowserFirstResult {
  ok: boolean;
  text: string | null;
  source: BrowserFirstSource;
  browserError: string | null;
  apiResult: RouterResult | null;
}

export async function runBrowserFirstAi(input: {
  prompt: string;
  model?: string | null;
  system?: string | null;
  temperature?: number;
  maxTokens?: number;
  onProgress?: (progress: BrowserAiProgress) => void;
}): Promise<BrowserFirstResult> {
  const local = await generateBrowserAi({
    prompt: input.prompt,
    system: input.system,
    temperature: input.temperature,
    maxTokens: input.maxTokens,
    // Part 04 only selects the local default model. API model selection remains
    // owned by Part 03 when the fallback path is used.
    onProgress: input.onProgress,
  });

  if (local.ok && local.text) {
    return {
      ok: true,
      text: local.text,
      source: "browser",
      browserError: null,
      apiResult: null,
    };
  }

  let apiResult: RouterResult | null = null;
  try {
    const result = await routeAiRequestFn({
      data: {
        prompt: input.prompt,
        model: input.model ?? null,
        system: input.system ?? null,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
      },
    });
    apiResult = result;
  } catch {
    apiResult = null;
  }

  if (apiResult?.ok && apiResult.text) {
    return {
      ok: true,
      text: apiResult.text,
      source: "api-fallback",
      browserError: local.error ?? null,
      apiResult,
    };
  }

  return {
    ok: false,
    text: null,
    source: "none",
    browserError: local.error ?? null,
    apiResult,
  };
}
