/**
 * OmniFrog AI — provider configuration store (server only).
 *
 * Secure credential handling:
 *  - secret fields are encrypted (AES-GCM) before they touch the database
 *  - decrypted values exist only inside a single server call
 *  - nothing here returns a credential value to the caller
 */
import { decryptCredentials, encryptCredentials } from "./crypto.server";
import { findProvider, PROVIDERS, type ProviderDefinition } from "./providers/catalog";
import { getAdapter } from "./providers/adapters.server";
import type {
  ModelInfo,
  ProviderConfig,
  ProviderFailure,
  ProviderStatus,
  ProviderUsage,
} from "./types";

type Row = Record<string, unknown>;

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const TABLE = "omnifrog_providers";
/** Columns safe to read. credential_cipher is deliberately never selected here. */
const SAFE_COLUMNS =
  "provider_id, provider_name, category, enabled, connection_status, credential_hint, selected_model, is_default, priority, capabilities, models, models_refreshed_at, last_tested_at, last_error, usage, fallback_eligible, updated_at";

function toConfig(definition: ProviderDefinition, row: Row | undefined): ProviderConfig {
  const hint = (row?.["credential_hint"] as Record<string, unknown> | null) ?? {};
  const fields: ProviderConfig["fields"] = {};
  for (const field of definition.fields) {
    const entry = hint[field.key] as { set?: boolean; value?: string } | undefined;
    fields[field.key] = {
      set: Boolean(entry?.set),
      value: field.secret ? null : (entry?.value ?? null),
    };
  }

  const configured = definition.fields
    .filter((field) => field.required)
    .every((field) => fields[field.key]?.set === true);

  const storedStatus = row ? (String(row["connection_status"]) as ProviderStatus) : "NOT CONFIGURED";
  const enabled = row ? Boolean(row["enabled"]) : true;

  return {
    id: definition.id,
    name: definition.name,
    category: definition.category,
    status: !row ? "NOT CONFIGURED" : !enabled ? "DISABLED" : storedStatus,
    enabled,
    configured,
    fallbackEligible: row ? Boolean(row["fallback_eligible"]) : true,
    selectedModel: (row?.["selected_model"] as string | null) ?? null,
    isDefault: Boolean(row?.["is_default"]),
    priority: row ? Number(row["priority"]) : definition.defaultPriority,
    capabilities: ((row?.["capabilities"] as string[] | null) ?? definition.capabilities) as string[],
    models: ((row?.["models"] as ModelInfo[] | null) ?? []) as ModelInfo[],
    modelsRefreshedAt: (row?.["models_refreshed_at"] as string | null) ?? null,
    fields,
    lastTestedAt: (row?.["last_tested_at"] as string | null) ?? null,
    lastError: (row?.["last_error"] as ProviderFailure | null) ?? null,
    usage: ((row?.["usage"] as ProviderUsage | null) ?? {}) as ProviderUsage,
    updatedAt: (row?.["updated_at"] as string | null) ?? null,
  };
}

async function loadRows(): Promise<Map<string, Row>> {
  const client = await db();
  const { data, error } = await client.from(TABLE).select(SAFE_COLUMNS);
  if (error) throw new Error(error.message);
  const rows = new Map<string, Row>();
  for (const row of (data ?? []) as Row[]) rows.set(String(row["provider_id"]), row);
  return rows;
}

/** Full catalogue merged with stored configuration. Never includes credentials. */
export async function selectProviders(): Promise<ProviderConfig[]> {
  const rows = await loadRows();
  return PROVIDERS.map((definition) => toConfig(definition, rows.get(definition.id))).sort(
    (a, b) => a.priority - b.priority || a.name.localeCompare(b.name),
  );
}

async function upsert(definition: ProviderDefinition, patch: Row): Promise<void> {
  const client = await db();
  const { error } = await client.from(TABLE).upsert(
    {
      provider_id: definition.id,
      provider_name: definition.name,
      category: definition.category,
      capabilities: definition.capabilities,
      priority: definition.defaultPriority,
      ...patch,
    },
    { onConflict: "provider_id" },
  );
  if (error) throw new Error(error.message);
}

async function readRow(providerId: string): Promise<Row | null> {
  const client = await db();
  const { data, error } = await client
    .from(TABLE)
    .select(SAFE_COLUMNS)
    .eq("provider_id", providerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Row | null) ?? null;
}

/** Decrypts stored credentials for a single server-side operation. */
async function readCredentials(providerId: string): Promise<Record<string, string>> {
  const client = await db();
  const { data, error } = await client
    .from(TABLE)
    .select("credential_cipher")
    .eq("provider_id", providerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const cipher = (data as { credential_cipher?: string | null } | null)?.credential_cipher ?? null;
  return await decryptCredentials(cipher);
}

export type SaveResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Saves provider configuration. Credential values that arrive empty keep the
 * previously stored value, so the UI never needs to re-send a secret.
 */
export async function saveProviderConfig(input: {
  providerId: string;
  credentials: Record<string, string>;
  selectedModel: string | null;
  makeDefault: boolean;
  enabled: boolean;
  fallbackEligible: boolean;
}): Promise<SaveResult> {
  const definition = findProvider(input.providerId);
  if (!definition) return { ok: false, message: "Unknown provider." };

  const existing = await readCredentials(definition.id);
  const merged: Record<string, string> = { ...existing };
  for (const field of definition.fields) {
    const incoming = (input.credentials[field.key] ?? "").trim();
    if (incoming.length > 0) merged[field.key] = incoming;
  }

  for (const field of definition.fields) {
    if (field.required && !(merged[field.key] ?? "").trim()) {
      return { ok: false, message: `${field.label} is required.` };
    }
  }

  const hint: Record<string, { set: boolean; value?: string }> = {};
  for (const field of definition.fields) {
    const value = merged[field.key] ?? "";
    hint[field.key] = field.secret
      ? { set: value.length > 0 }
      : { set: value.length > 0, value };
  }

  const previous = await readRow(definition.id);
  const previousStatus = previous ? (String(previous["connection_status"]) as ProviderStatus) : null;
  // Configuration changed, so an older WORKING result no longer proves anything.
  const status: ProviderStatus = input.enabled ? "CONFIGURED" : "DISABLED";

  await upsert(definition, {
    credential_cipher: await encryptCredentials(merged),
    credential_hint: hint,
    selected_model: input.selectedModel,
    enabled: input.enabled,
    fallback_eligible: input.fallbackEligible,
    connection_status: previousStatus === "WORKING" && !credentialsChanged(existing, merged)
      ? input.enabled
        ? "WORKING"
        : "DISABLED"
      : status,
    priority: previous ? Number(previous["priority"]) : definition.defaultPriority,
  });

  if (input.makeDefault) {
    await setDefaultProvider(definition.id);
  } else if (previous && Boolean(previous["is_default"])) {
    const client = await db();
    const { error } = await client
      .from(TABLE)
      .update({ is_default: false })
      .eq("provider_id", definition.id);
    if (error) throw new Error(error.message);
  }

  return { ok: true };
}

function credentialsChanged(before: Record<string, string>, after: Record<string, string>): boolean {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if ((before[key] ?? "") !== (after[key] ?? "")) return true;
  }
  return false;
}

export async function setDefaultProvider(providerId: string): Promise<void> {
  const client = await db();
  const clear = await client.from(TABLE).update({ is_default: false }).neq("provider_id", providerId);
  if (clear.error) throw new Error(clear.error.message);
  const set = await client.from(TABLE).update({ is_default: true }).eq("provider_id", providerId);
  if (set.error) throw new Error(set.error.message);
}

export async function setProviderEnabled(providerId: string, enabled: boolean): Promise<void> {
  const definition = findProvider(providerId);
  if (!definition) throw new Error("Unknown provider");
  const previous = await readRow(providerId);
  if (!previous) throw new Error("Provider is not configured yet");
  const status: ProviderStatus = enabled
    ? previous["last_tested_at"] && !previous["last_error"]
      ? "WORKING"
      : "CONFIGURED"
    : "DISABLED";
  const client = await db();
  const { error } = await client
    .from(TABLE)
    .update({ enabled, connection_status: status })
    .eq("provider_id", providerId);
  if (error) throw new Error(error.message);
}

export async function setProviderFallback(providerId: string, eligible: boolean): Promise<void> {
  const client = await db();
  const { error } = await client
    .from(TABLE)
    .update({ fallback_eligible: eligible })
    .eq("provider_id", providerId);
  if (error) throw new Error(error.message);
}

/** Stores the owner's priority order. PART 03 consumes it; nothing routes yet. */
export async function setProviderPriority(order: string[]): Promise<void> {
  const client = await db();
  const rows = await loadRows();
  let index = 1;
  for (const providerId of order) {
    if (!rows.has(providerId)) continue;
    const { error } = await client
      .from(TABLE)
      .update({ priority: index })
      .eq("provider_id", providerId);
    if (error) throw new Error(error.message);
    index += 1;
  }
}

/** Removes the credential and resets state, keeping the provider configuration row. */
export async function disconnectProvider(providerId: string): Promise<void> {
  const client = await db();
  const { error } = await client
    .from(TABLE)
    .update({
      credential_cipher: null,
      credential_hint: {},
      connection_status: "NOT CONFIGURED",
      selected_model: null,
      models: [],
      models_refreshed_at: null,
      last_tested_at: null,
      last_error: null,
      is_default: false,
    })
    .eq("provider_id", providerId);
  if (error) throw new Error(error.message);
}

export type ModelRefreshResult =
  | { ok: true; models: ModelInfo[] }
  | { ok: false; message: string };

export async function refreshProviderModels(providerId: string): Promise<ModelRefreshResult> {
  const definition = findProvider(providerId);
  if (!definition) return { ok: false, message: "Unknown provider." };
  if (definition.modelDiscovery !== "api") {
    return { ok: false, message: "This provider has no model-list API; enter model ids manually." };
  }
  const adapter = getAdapter(providerId);
  if (!adapter?.listModels) return { ok: false, message: "Model discovery is not available." };

  const credentials = await readCredentials(providerId);
  if (Object.keys(credentials).length === 0) {
    return { ok: false, message: "Save an API key first." };
  }

  const models = await adapter.listModels(credentials);
  if (models.length === 0) {
    return { ok: false, message: "The provider returned no models for this credential." };
  }
  const client = await db();
  const { error } = await client
    .from(TABLE)
    .update({ models, models_refreshed_at: new Date().toISOString() })
    .eq("provider_id", providerId);
  if (error) throw new Error(error.message);
  return { ok: true, models };
}

/** Owner-entered model ids for providers without a model-list API. */
export async function setManualModels(providerId: string, ids: string[]): Promise<ModelRefreshResult> {
  const definition = findProvider(providerId);
  if (!definition) return { ok: false, message: "Unknown provider." };
  const models: ModelInfo[] = ids.map((id) => ({
    id,
    displayName: id,
    provider: providerId,
    reasoning: false,
    vision: false,
    image: definition.capabilities.includes("image"),
    embeddings: false,
    contextNote: null,
  }));
  const client = await db();
  const { error } = await client
    .from(TABLE)
    .update({ models, models_refreshed_at: new Date().toISOString() })
    .eq("provider_id", providerId);
  if (error) throw new Error(error.message);
  return { ok: true, models };
}

export interface TestOutcome {
  ok: boolean;
  status: ProviderStatus;
  model: string | null;
  testedAt: string;
  errorClass: string | null;
  reason: string | null;
  retryAfterSeconds: number | null;
}

function statusForError(errorClass: string | undefined): ProviderStatus {
  switch (errorClass) {
    case "RATE_LIMITED":
      return "RATE LIMITED";
    case "UNAUTHORIZED":
    case "FORBIDDEN":
    case "INVALID_CREDENTIAL":
      return "AUTH ERROR";
    case "MODEL_UNAVAILABLE":
      return "MODEL ERROR";
    default:
      return "UNAVAILABLE";
  }
}

/**
 * Real verification: the stored credential is used to make one minimal request
 * against the provider (and the selected model where the provider supports it).
 */
export async function testProviderConnection(providerId: string): Promise<TestOutcome> {
  const definition = findProvider(providerId);
  const testedAt = new Date().toISOString();
  if (!definition) {
    return {
      ok: false,
      status: "UNAVAILABLE",
      model: null,
      testedAt,
      errorClass: "UNKNOWN_ERROR",
      reason: "Unknown provider.",
      retryAfterSeconds: null,
    };
  }

  const row = await readRow(providerId);
  const selectedModel = (row?.["selected_model"] as string | null) ?? null;
  const adapter = getAdapter(providerId);

  if (!definition.testable || !adapter?.test) {
    return {
      ok: false,
      status: row ? "CONFIGURED" : "NOT CONFIGURED",
      model: selectedModel,
      testedAt,
      errorClass: null,
      reason: definition.testNote ?? "No verification call is wired for this provider yet.",
      retryAfterSeconds: null,
    };
  }

  const credentials = await readCredentials(providerId);
  if (Object.keys(credentials).length === 0) {
    const failure: ProviderFailure = {
      errorClass: "INVALID_CREDENTIAL",
      reason: "No credential is stored for this provider.",
      at: testedAt,
      retryAfterSeconds: null,
    };
    await writeTestResult(providerId, "NOT CONFIGURED", testedAt, failure);
    return {
      ok: false,
      status: "NOT CONFIGURED",
      model: selectedModel,
      testedAt,
      errorClass: failure.errorClass,
      reason: failure.reason,
      retryAfterSeconds: null,
    };
  }

  const result = await adapter.test(credentials, selectedModel);
  if (result.ok) {
    await writeTestResult(providerId, "WORKING", testedAt, null);
    return {
      ok: true,
      status: "WORKING",
      model: selectedModel,
      testedAt,
      errorClass: null,
      reason: null,
      retryAfterSeconds: null,
    };
  }

  const failure: ProviderFailure = {
    errorClass: (result.errorClass ?? "UNKNOWN_ERROR") as ProviderFailure["errorClass"],
    reason: result.reason ?? "The provider rejected the test.",
    at: testedAt,
    retryAfterSeconds: result.retryAfterSeconds ?? null,
  };
  const status = statusForError(failure.errorClass);
  await writeTestResult(providerId, status, testedAt, failure);
  return {
    ok: false,
    status,
    model: selectedModel,
    testedAt,
    errorClass: failure.errorClass,
    reason: failure.reason,
    retryAfterSeconds: failure.retryAfterSeconds,
  };
}

async function writeTestResult(
  providerId: string,
  status: ProviderStatus,
  testedAt: string,
  failure: ProviderFailure | null,
): Promise<void> {
  const client = await db();
  const row = await readRow(providerId);
  const usage = ((row?.["usage"] as ProviderUsage | null) ?? {}) as ProviderUsage;
  const nextUsage: ProviderUsage = {
    ...usage,
    requests: (usage.requests ?? 0) + 1,
    errors: (usage.errors ?? 0) + (failure ? 1 : 0),
    rateLimits: (usage.rateLimits ?? 0) + (failure?.errorClass === "RATE_LIMITED" ? 1 : 0),
    lastUsedAt: testedAt,
  };
  const { error } = await client
    .from(TABLE)
    .update({
      connection_status: status,
      last_tested_at: testedAt,
      last_error: failure,
      usage: nextUsage,
    })
    .eq("provider_id", providerId);
  if (error) throw new Error(error.message);
}

export async function setSelectedModel(providerId: string, model: string | null): Promise<void> {
  const client = await db();
  const { error } = await client
    .from(TABLE)
    .update({ selected_model: model })
    .eq("provider_id", providerId);
  if (error) throw new Error(error.message);
}
