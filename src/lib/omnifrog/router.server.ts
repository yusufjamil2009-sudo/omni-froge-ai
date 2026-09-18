import { findProvider } from "./providers/catalog";
import { getAdapter, type AdapterGenerateResult } from "./providers/adapters.server";
import { selectProviders } from "./providers.server";
import type { ProviderConfig, ProviderErrorClass } from "./types";

export interface RouterRequest {
  prompt: string;
  model?: string | null;
  system?: string | null;
  temperature?: number;
  maxTokens?: number;
}

export interface RouterAttempt {
  providerId: string;
  model: string | null;
  ok: boolean;
  errorClass: ProviderErrorClass | null;
  reason: string | null;
  startedAt: string;
  finishedAt: string;
}

export interface RouterResult {
  ok: boolean;
  text: string | null;
  providerId: string | null;
  providerName: string | null;
  model: string | null;
  attempts: RouterAttempt[];
  errorClass: ProviderErrorClass | null;
  reason: string | null;
}

function eligible(providers: ProviderConfig[], requestedModel: string | null): ProviderConfig[] {
  return providers
    .filter((p) => p.enabled && p.configured && p.category === "ai")
    .filter((p) => !requestedModel || p.models.some((m) => m.id === requestedModel) || p.selectedModel === requestedModel)
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.priority - b.priority);
}

function safeErrorClass(value: string | undefined): ProviderErrorClass | null {
  const allowed: ProviderErrorClass[] = [
    "INVALID_CREDENTIAL","UNAUTHORIZED","FORBIDDEN","RATE_LIMITED","TIMEOUT",
    "PROVIDER_UNAVAILABLE","MODEL_UNAVAILABLE","NETWORK_ERROR","INVALID_RESPONSE","UNKNOWN_ERROR",
  ];
  return value && allowed.includes(value as ProviderErrorClass) ? value as ProviderErrorClass : "UNKNOWN_ERROR";
}

export async function routeAiRequest(input: RouterRequest): Promise<RouterResult> {
  const prompt = input.prompt.trim();
  if (!prompt) {
    return { ok:false, text:null, providerId:null, providerName:null, model:null, attempts:[], errorClass:"INVALID_RESPONSE", reason:"Prompt is required." };
  }

  const providers = await selectProviders();
  const candidates = eligible(providers, input.model ?? null);
  if (candidates.length === 0) {
    return { ok:false, text:null, providerId:null, providerName:null, model:null, attempts:[], errorClass:"PROVIDER_UNAVAILABLE", reason:"No enabled, configured AI provider is available for this request." };
  }

  const attempts: RouterAttempt[] = [];
  let lastClass: ProviderErrorClass = "UNKNOWN_ERROR";
  let lastReason = "All configured AI providers failed.";

  for (const provider of candidates) {
    const definition = findProvider(provider.id);
    const adapter = getAdapter(provider.id);
    if (!definition || !adapter?.generate) continue;

    const model = input.model ?? provider.selectedModel ?? provider.models[0]?.id ?? null;
    if (!model) {
      lastClass = "MODEL_UNAVAILABLE";
      lastReason = `${provider.name} has no selected model.`;
      attempts.push({ providerId:provider.id, model:null, ok:false, errorClass:lastClass, reason:lastReason, startedAt:new Date().toISOString(), finishedAt:new Date().toISOString() });
      continue;
    }

    const startedAt = new Date().toISOString();
    let result: AdapterGenerateResult;
    try {
      result = await adapter.generate(await (async () => {
        const { readProviderCredentials } = await import("./providers.server");
        return readProviderCredentials(provider.id);
      })(), { model, prompt, system: input.system ?? null, temperature: input.temperature, maxTokens: input.maxTokens });
    } catch {
      result = { ok:false, errorClass:"UNKNOWN_ERROR", reason:"Provider request failed." };
    }
    const finishedAt = new Date().toISOString();
    const errorClass = result.ok ? null : safeErrorClass(result.errorClass);
    attempts.push({ providerId:provider.id, model, ok:result.ok, errorClass, reason:result.ok ? null : result.reason ?? "Provider request failed.", startedAt, finishedAt });

    if (result.ok && result.text?.trim()) {
      await recordProviderSuccess(provider.id);
      return { ok:true, text:result.text, providerId:provider.id, providerName:provider.name, model, attempts, errorClass:null, reason:null };
    }

    lastClass = errorClass ?? "INVALID_RESPONSE";
    lastReason = result.ok ? "Provider returned an empty response." : (result.reason ?? "Provider request failed.");
    await recordProviderFailure(provider.id, lastClass, lastReason, result.retryAfterSeconds ?? null);
  }

  return { ok:false, text:null, providerId:null, providerName:null, model:null, attempts, errorClass:lastClass, reason:lastReason };
}

async function recordProviderSuccess(providerId: string) {
  const { writeProviderUsage } = await import("./providers.server");
  await writeProviderUsage(providerId, false, false);
}

async function recordProviderFailure(providerId: string, errorClass: ProviderErrorClass, reason: string, retryAfterSeconds: number | null) {
  const { writeProviderRuntimeFailure } = await import("./providers.server");
  await writeProviderRuntimeFailure(providerId, errorClass, reason, retryAfterSeconds);
}
