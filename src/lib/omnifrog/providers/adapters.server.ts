/**
 * OmniFrog AI — provider adapters (server only).
 *
 * One adapter per provider implements the calls the API Manager needs:
 *   - listModels(credentials)  → real model discovery where the provider offers it
 *   - test(credentials, model) → a minimal, low-token verification request
 *
 * PART 03 adds generate() on top of the same registry. Adding a provider means
 * adding a catalogue entry plus an adapter here — no UI changes required.
 *
 * Rules: credentials are never logged, never echoed back, and provider error
 * bodies are classified into safe categories instead of being forwarded raw.
 */
import type { ModelInfo, ProviderErrorClass } from "../types";

export interface AdapterTestResult {
  ok: boolean;
  errorClass?: ProviderErrorClass;
  /** Short, sanitized reason shown to the owner. */
  reason?: string;
  retryAfterSeconds?: number | null;
}

export interface ProviderAdapter {
  listModels?(credentials: Record<string, string>): Promise<ModelInfo[]>;
  test?(credentials: Record<string, string>, model: string | null): Promise<AdapterTestResult>;
}

const TIMEOUT_MS = 15000;

async function request(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<{ status: number; body: string; ok: boolean } | { networkError: true }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const body = await response.text();
    return { status: response.status, body, ok: response.ok };
  } catch {
    return { networkError: true };
  } finally {
    clearTimeout(timer);
  }
}

function classify(status: number, body: string): { errorClass: ProviderErrorClass; reason: string } {
  const lower = body.toLowerCase();
  if (status === 401) return { errorClass: "UNAUTHORIZED", reason: "Authentication rejected." };
  if (status === 403) return { errorClass: "FORBIDDEN", reason: "Access forbidden for this credential." };
  if (status === 429) return { errorClass: "RATE_LIMITED", reason: "Rate limited by the provider." };
  if (status === 408 || status === 504) return { errorClass: "TIMEOUT", reason: "Provider timed out." };
  if (status === 404 && (lower.includes("model") || lower.includes("not found"))) {
    return { errorClass: "MODEL_UNAVAILABLE", reason: "Selected model is not available." };
  }
  if (status === 400 && lower.includes("model")) {
    return { errorClass: "MODEL_UNAVAILABLE", reason: "Selected model was rejected." };
  }
  if (status === 400) return { errorClass: "INVALID_RESPONSE", reason: "Provider rejected the test request." };
  if (status === 402) return { errorClass: "FORBIDDEN", reason: "Provider reports a billing or balance problem." };
  if (status >= 500) return { errorClass: "PROVIDER_UNAVAILABLE", reason: "Provider is unavailable." };
  return { errorClass: "UNKNOWN_ERROR", reason: `Provider returned status ${status}.` };
}

function retryAfter(body: string): number | null {
  const match = /retry[- ]?after[^0-9]{0,12}(\d{1,5})/i.exec(body);
  return match ? Number(match[1]) : null;
}

function networkFailure(): AdapterTestResult {
  return { ok: false, errorClass: "NETWORK_ERROR", reason: "Could not reach the provider." };
}

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function modelFromId(id: string, provider: string): ModelInfo {
  const lower = id.toLowerCase();
  const has = (...needles: string[]) => needles.some((needle) => lower.includes(needle));
  return {
    id,
    displayName: id,
    provider,
    /** Only flagged from the id where the naming is an explicit signal. */
    reasoning: has("reason", "o1", "o3", "o4", "think", "r1"),
    vision: has("vision", "vl", "omni", "4o", "gemini", "claude-3", "claude-4", "sonnet", "opus"),
    image: has("image", "dall-e", "flux", "imagen", "sdxl", "stable-diffusion"),
    embeddings: has("embed"),
    contextNote: null,
  };
}

/* ---------------------------------------------------------------- OpenAI-compatible */

interface OpenAICompatible {
  baseUrl: string;
  headers: (credentials: Record<string, string>) => Record<string, string>;
}

function openAiCompatible(id: string, { baseUrl, headers }: OpenAICompatible): ProviderAdapter {
  return {
    async listModels(credentials) {
      const result = await request(`${baseUrl}/models`, { headers: headers(credentials) });
      if ("networkError" in result || !result.ok) return [];
      const parsed = parseJson(result.body) as { data?: Array<{ id?: unknown }> } | null;
      const rows = Array.isArray(parsed?.data) ? parsed!.data! : [];
      return rows
        .map((row) => (typeof row?.id === "string" ? row.id : null))
        .filter((value): value is string => Boolean(value))
        .sort()
        .map((modelId) => modelFromId(modelId, id));
    },
    async test(credentials, model) {
      if (!model) {
        return { ok: false, errorClass: "MODEL_UNAVAILABLE", reason: "Select a model before testing." };
      }
      const send = (tokenField: "max_tokens" | "max_completion_tokens") =>
        request(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers(credentials) },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: "ping" }],
            [tokenField]: 1,
          }),
        });

      let result = await send("max_tokens");
      if ("networkError" in result) return networkFailure();
      if (!result.ok && result.status === 400 && result.body.toLowerCase().includes("max_tokens")) {
        const retry = await send("max_completion_tokens");
        if ("networkError" in retry) return networkFailure();
        result = retry;
      }
      if (!result.ok) {
        const classified = classify(result.status, result.body);
        return { ok: false, ...classified, retryAfterSeconds: retryAfter(result.body) };
      }
      const parsed = parseJson(result.body) as { choices?: unknown[] } | null;
      if (!parsed || !Array.isArray(parsed.choices)) {
        return { ok: false, errorClass: "INVALID_RESPONSE", reason: "Provider response was not usable." };
      }
      return { ok: true };
    },
  };
}

const bearer = (credentials: Record<string, string>) => ({
  Authorization: `Bearer ${credentials["apiKey"] ?? ""}`,
});

/* ---------------------------------------------------------------- Registry */

export const ADAPTERS: Record<string, ProviderAdapter> = {
  openai: openAiCompatible("openai", { baseUrl: "https://api.openai.com/v1", headers: bearer }),
  deepseek: openAiCompatible("deepseek", { baseUrl: "https://api.deepseek.com/v1", headers: bearer }),
  groq: openAiCompatible("groq", { baseUrl: "https://api.groq.com/openai/v1", headers: bearer }),
  openrouter: openAiCompatible("openrouter", {
    baseUrl: "https://openrouter.ai/api/v1",
    headers: bearer,
  }),
  mistral: openAiCompatible("mistral", { baseUrl: "https://api.mistral.ai/v1", headers: bearer }),
  xai: openAiCompatible("xai", { baseUrl: "https://api.x.ai/v1", headers: bearer }),
  nvidia: openAiCompatible("nvidia", {
    baseUrl: "https://integrate.api.nvidia.com/v1",
    headers: bearer,
  }),
  sambanova: openAiCompatible("sambanova", {
    baseUrl: "https://api.sambanova.ai/v1",
    headers: bearer,
  }),
  together: openAiCompatible("together", {
    baseUrl: "https://api.together.xyz/v1",
    headers: bearer,
  }),

  gemini: {
    async listModels(credentials) {
      const result = await request(
        "https://generativelanguage.googleapis.com/v1beta/models?pageSize=200",
        { headers: { "x-goog-api-key": credentials["apiKey"] ?? "" } },
      );
      if ("networkError" in result || !result.ok) return [];
      const parsed = parseJson(result.body) as {
        models?: Array<{ name?: unknown; displayName?: unknown; supportedGenerationMethods?: unknown }>;
      } | null;
      const rows = Array.isArray(parsed?.models) ? parsed!.models! : [];
      return rows
        .filter((row) => {
          const methods = row?.supportedGenerationMethods;
          return !Array.isArray(methods) || methods.includes("generateContent");
        })
        .map((row) => {
          const name = typeof row?.name === "string" ? row.name.replace(/^models\//, "") : null;
          if (!name) return null;
          const info = modelFromId(name, "gemini");
          if (typeof row?.displayName === "string") info.displayName = row.displayName;
          return info;
        })
        .filter((value): value is ModelInfo => value !== null);
    },
    async test(credentials, model) {
      if (!model) {
        return { ok: false, errorClass: "MODEL_UNAVAILABLE", reason: "Select a model before testing." };
      }
      const result = await request(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": credentials["apiKey"] ?? "",
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "ping" }] }],
            generationConfig: { maxOutputTokens: 1 },
          }),
        },
      );
      if ("networkError" in result) return networkFailure();
      if (!result.ok) {
        return { ok: false, ...classify(result.status, result.body), retryAfterSeconds: retryAfter(result.body) };
      }
      return { ok: true };
    },
  },

  anthropic: {
    async listModels(credentials) {
      const result = await request("https://api.anthropic.com/v1/models?limit=100", {
        headers: {
          "x-api-key": credentials["apiKey"] ?? "",
          "anthropic-version": "2023-06-01",
        },
      });
      if ("networkError" in result || !result.ok) return [];
      const parsed = parseJson(result.body) as {
        data?: Array<{ id?: unknown; display_name?: unknown }>;
      } | null;
      const rows = Array.isArray(parsed?.data) ? parsed!.data! : [];
      return rows
        .map((row) => {
          if (typeof row?.id !== "string") return null;
          const info = modelFromId(row.id, "anthropic");
          if (typeof row?.display_name === "string") info.displayName = row.display_name;
          return info;
        })
        .filter((value): value is ModelInfo => value !== null);
    },
    async test(credentials, model) {
      if (!model) {
        return { ok: false, errorClass: "MODEL_UNAVAILABLE", reason: "Select a model before testing." };
      }
      const result = await request("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": credentials["apiKey"] ?? "",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1,
          messages: [{ role: "user", content: "ping" }],
        }),
      });
      if ("networkError" in result) return networkFailure();
      if (!result.ok) {
        return { ok: false, ...classify(result.status, result.body), retryAfterSeconds: retryAfter(result.body) };
      }
      return { ok: true };
    },
  },

  replicate: {
    async test(credentials) {
      const result = await request("https://api.replicate.com/v1/account", {
        headers: bearer(credentials),
      });
      if ("networkError" in result) return networkFailure();
      if (!result.ok) {
        return { ok: false, ...classify(result.status, result.body), retryAfterSeconds: retryAfter(result.body) };
      }
      return { ok: true };
    },
  },

  firecrawl: {
    async test(credentials) {
      const result = await request("https://api.firecrawl.dev/v2/team/credit-usage", {
        headers: bearer(credentials),
      });
      if ("networkError" in result) return networkFailure();
      if (!result.ok) {
        return { ok: false, ...classify(result.status, result.body), retryAfterSeconds: retryAfter(result.body) };
      }
      return { ok: true };
    },
  },

  supabase: {
    async test(credentials) {
      const url = (credentials["projectUrl"] ?? "").replace(/\/+$/, "");
      const key = credentials["publishableKey"] ?? "";
      if (!url || !key) {
        return { ok: false, errorClass: "INVALID_CREDENTIAL", reason: "Project URL and key are required." };
      }
      const result = await request(`${url}/rest/v1/`, { headers: { apikey: key } });
      if ("networkError" in result) return networkFailure();
      if (!result.ok) {
        return { ok: false, ...classify(result.status, result.body), retryAfterSeconds: retryAfter(result.body) };
      }
      return { ok: true };
    },
  },

  turso: {
    async test(credentials) {
      const raw = (credentials["databaseUrl"] ?? "").trim().replace(/\/+$/, "");
      const token = credentials["authToken"] ?? "";
      if (!raw || !token) {
        return { ok: false, errorClass: "INVALID_CREDENTIAL", reason: "Database URL and token are required." };
      }
      const httpUrl = raw.replace(/^libsql:\/\//, "https://").replace(/^wss:\/\//, "https://");
      const result = await request(`${httpUrl}/v2/pipeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          requests: [{ type: "execute", stmt: { sql: "select 1" } }, { type: "close" }],
        }),
      });
      if ("networkError" in result) return networkFailure();
      if (!result.ok) {
        return { ok: false, ...classify(result.status, result.body), retryAfterSeconds: retryAfter(result.body) };
      }
      return { ok: true };
    },
  },

  convex: {
    async test(credentials) {
      const url = (credentials["deploymentUrl"] ?? "").trim().replace(/\/+$/, "");
      if (!url) {
        return { ok: false, errorClass: "INVALID_CREDENTIAL", reason: "Deployment URL is required." };
      }
      const result = await request(`${url}/version`);
      if ("networkError" in result) return networkFailure();
      if (!result.ok) {
        return { ok: false, ...classify(result.status, result.body), retryAfterSeconds: retryAfter(result.body) };
      }
      return { ok: true };
    },
  },

  appwrite: {
    async test(credentials) {
      const endpoint = (credentials["endpoint"] ?? "").trim().replace(/\/+$/, "");
      const projectId = credentials["projectId"] ?? "";
      const apiKey = credentials["apiKey"] ?? "";
      if (!endpoint || !projectId || !apiKey) {
        return { ok: false, errorClass: "INVALID_CREDENTIAL", reason: "Endpoint, project ID and key are required." };
      }
      const result = await request(`${endpoint}/health`, {
        headers: { "X-Appwrite-Project": projectId, "X-Appwrite-Key": apiKey },
      });
      if ("networkError" in result) return networkFailure();
      if (!result.ok) {
        return { ok: false, ...classify(result.status, result.body), retryAfterSeconds: retryAfter(result.body) };
      }
      return { ok: true };
    },
  },
};

export function getAdapter(providerId: string): ProviderAdapter | undefined {
  return ADAPTERS[providerId];
}
