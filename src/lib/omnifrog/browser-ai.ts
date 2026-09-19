/**
 * OmniFrog AI — PART 04: Browser / Open-Source AI First Engine.
 *
 * Runs an open-source LLM in the user's browser when WebGPU is available.
 * No API key is required and prompts are kept client-side for this path.
 *
 * The runtime is loaded lazily so the main application bundle stays small.
 * WebLLM stores model artifacts in the browser cache/IndexedDB layer.
 *
 * If local inference is unavailable or fails, callers can use PART 03's
 * server-side router as the explicit fallback. This module never contains
 * provider credentials.
 */

export type BrowserAiStatus =
  | "UNAVAILABLE"
  | "READY"
  | "LOADING"
  | "GENERATING"
  | "ERROR";

export interface BrowserAiCapabilities {
  webgpu: boolean;
  browserRuntime: boolean;
  modelId: string;
}

export interface BrowserAiResult {
  ok: boolean;
  text: string | null;
  source: "browser" | "none";
  error?: string;
}

export interface BrowserAiProgress {
  progress: number;
  text: string;
}

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type WebLLMEngine = {
  chat: {
    completions: {
      create(input: {
        messages: ChatMessage[];
        temperature?: number;
        max_tokens?: number;
        stream?: boolean;
      }): Promise<{
        choices?: Array<{ message?: { content?: unknown } }>;
      }>;
    };
  };
};

type WebLLMModule = {
  CreateMLCEngine: (
    modelId: string,
    options?: {
      initProgressCallback?: (report: { progress?: number; text?: string }) => void;
    },
  ) => Promise<WebLLMEngine>;
};

import { DEFAULT_BROWSER_MODEL_ID } from "./browser-models";

const DEFAULT_MODEL_ID = DEFAULT_BROWSER_MODEL_ID;
const FALLBACK_MODEL_IDS = [
  DEFAULT_MODEL_ID,
  "Llama-3.2-1B-Instruct-q4f16_1-MLC",
  "Llama-3.2-1B-Instruct-q4f32_1-MLC",
];
const WEBLLM_URL = "https://esm.sh/@mlc-ai/web-llm@0.2.82";

let runtimePromise: Promise<WebLLMModule> | null = null;
let enginePromise: Promise<WebLLMEngine> | null = null;
let activeModelId = DEFAULT_MODEL_ID;
let status: BrowserAiStatus = "UNAVAILABLE";
let lastError: string | null = null;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof navigator !== "undefined";
}

function hasWebGpu(): boolean {
  return isBrowser() && "gpu" in navigator;
}

function loadRuntime(): Promise<WebLLMModule> {
  if (!isBrowser()) return Promise.reject(new Error("Browser runtime is unavailable."));
  if (!runtimePromise) {
    // Dynamic import keeps the optional browser runtime out of the initial bundle.
    runtimePromise = new Function(
      "url",
      "return import(url)",
    )(WEBLLM_URL) as Promise<WebLLMModule>;
  }
  return runtimePromise;
}

export function getDefaultBrowserModel(): string {
  return DEFAULT_MODEL_ID;
}

export function getBrowserAiCapabilities(modelId = DEFAULT_MODEL_ID): BrowserAiCapabilities {
  return {
    webgpu: hasWebGpu(),
    browserRuntime: isBrowser(),
    modelId,
  };
}

export function getBrowserAiStatus(): BrowserAiStatus {
  return status;
}

export function getBrowserAiError(): string | null {
  return lastError;
}

export async function isBrowserAiAvailable(): Promise<boolean> {
  if (!hasWebGpu()) return false;
  try {
    await loadRuntime();
    return true;
  } catch {
    return false;
  }
}

export async function loadBrowserAi(
  modelId = DEFAULT_MODEL_ID,
  onProgress?: (progress: BrowserAiProgress) => void,
): Promise<void> {
  if (!hasWebGpu()) {
    status = "UNAVAILABLE";
    lastError = "WebGPU is not available in this browser/device.";
    throw new Error(lastError);
  }

  if (enginePromise && activeModelId === modelId) {
    status = "READY";
    return;
  }

  activeModelId = modelId;
  status = "LOADING";
  lastError = null;

  try {
    const runtime = await loadRuntime();
    enginePromise = runtime.CreateMLCEngine(modelId, {
      initProgressCallback: (report) => {
        const progress =
          typeof report.progress === "number"
            ? Math.max(0, Math.min(1, report.progress))
            : 0;
        onProgress?.({
          progress,
          text: typeof report.text === "string" ? report.text : "Loading local AI model…",
        });
      },
    });
    await enginePromise;
    status = "READY";
  } catch (error) {
    enginePromise = null;
    status = "ERROR";
    lastError = error instanceof Error ? error.message : "Could not load the browser AI model.";
    throw new Error(lastError);
  }
}

export async function generateBrowserAi(input: {
  prompt: string;
  system?: string | null;
  temperature?: number;
  maxTokens?: number;
  modelId?: string;
  onProgress?: (progress: BrowserAiProgress) => void;
}): Promise<BrowserAiResult> {
  const prompt = input.prompt.trim();
  if (!prompt) {
    return { ok: false, text: null, source: "none", error: "Prompt is required." };
  }

  try {
    const requested = input.modelId ?? DEFAULT_MODEL_ID;
    const candidates = [requested, ...FALLBACK_MODEL_IDS.filter((id) => id !== requested)];
    let lastFailure = "Browser AI generation failed.";

    for (const modelId of candidates) {
      try {
        await loadBrowserAi(modelId, input.onProgress);
        const engine = await enginePromise;
        if (!engine) throw new Error("Browser AI engine is not initialized.");

        status = "GENERATING";
        const result = await engine.chat.completions.create({
          messages: [
            ...(input.system
              ? [{ role: "system" as const, content: input.system }]
              : []),
            { role: "user", content: prompt },
          ],
          ...(typeof input.temperature === "number" ? { temperature: input.temperature } : {}),
          ...(typeof input.maxTokens === "number" ? { max_tokens: input.maxTokens } : {}),
          stream: false,
        });

        const text = result.choices?.[0]?.message?.content;
        if (typeof text !== "string" || !text.trim()) {
          throw new Error("Browser AI returned no usable text.");
        }

        status = "READY";
        lastError = null;
        return { ok: true, text, source: "browser" };
      } catch (error) {
        lastFailure = error instanceof Error ? error.message : lastFailure;
        enginePromise = null;
        status = "ERROR";
        lastError = lastFailure;
      }
    }

    throw new Error(lastFailure);
  } catch (error) {
    status = "ERROR";
    lastError = error instanceof Error ? error.message : "Browser AI generation failed.";
    return { ok: false, text: null, source: "none", error: lastError };
  }
}

/** Clear the in-memory engine handle without touching user/browser storage. */
export function resetBrowserAiRuntime(): void {
  enginePromise = null;
  runtimePromise = null;
  status = hasWebGpu() ? "READY" : "UNAVAILABLE";
  lastError = null;
}
