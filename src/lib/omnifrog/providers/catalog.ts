/**
 * OmniFrog AI — provider catalogue (client-safe).
 *
 * This file contains ONLY provider metadata: no credentials, no secrets and no
 * provider-specific request code. Adapters (server only) implement the calls.
 * PART 03 (AI router) reads the same catalogue plus the stored configuration.
 */

export type ProviderCategoryId = "ai" | "image" | "search" | "backend" | "vcs";

export const PROVIDER_CATEGORIES: Array<{ id: ProviderCategoryId; label: string; note: string }> = [
  { id: "ai", label: "AI / Coding", note: "Text, coding and reasoning models." },
  { id: "image", label: "Image / Creative AI", note: "Image and creative generation providers." },
  { id: "search", label: "Web / Search / Data", note: "Web scraping, search and data providers." },
  { id: "backend", label: "Backend / Database", note: "Database and backend platforms." },
  { id: "vcs", label: "Source Control", note: "Repository hosting." },
];

/** Capability ids used by provider + model metadata. */
export const CAPABILITIES = [
  "text",
  "coding",
  "reasoning",
  "tools",
  "structured",
  "vision",
  "image",
  "embeddings",
  "web",
  "database",
  "repository",
] as const;

export type CapabilityId = (typeof CAPABILITIES)[number];

export const CAPABILITY_LABELS: Record<CapabilityId, string> = {
  text: "Text Generation",
  coding: "Coding",
  reasoning: "Reasoning",
  tools: "Tool Calling",
  structured: "Structured Output",
  vision: "Vision",
  image: "Image Generation",
  embeddings: "Embeddings",
  web: "Web / Search",
  database: "Database",
  repository: "Repository",
};

export interface CredentialField {
  key: string;
  label: string;
  placeholder: string;
  /** Secret fields are encrypted at rest and never returned to the browser. */
  secret: boolean;
  required: boolean;
  help?: string;
}

export interface ProviderDefinition {
  id: string;
  name: string;
  category: ProviderCategoryId;
  blurb: string;
  fields: CredentialField[];
  /** Capabilities the provider platform offers; per-model metadata narrows this. */
  capabilities: CapabilityId[];
  /** "api" = real model-list endpoint, "manual" = owner-entered model ids, "none" = no models. */
  modelDiscovery: "api" | "manual" | "none";
  /** false means OmniFrog has no verification call wired for this provider yet. */
  testable: boolean;
  testNote?: string;
  defaultPriority: number;
}

const API_KEY = (placeholder: string, help?: string): CredentialField => ({
  key: "apiKey",
  label: "API Key",
  placeholder,
  secret: true,
  required: true,
  ...(help ? { help } : {}),
});

const AI_CAPS: CapabilityId[] = ["text", "coding", "reasoning", "tools", "structured"];

export const PROVIDERS: ProviderDefinition[] = [
  {
    id: "openai",
    name: "OpenAI",
    category: "ai",
    blurb: "GPT models for text, coding, reasoning, vision and embeddings.",
    fields: [API_KEY("sk-…")],
    capabilities: [...AI_CAPS, "vision", "embeddings", "image"],
    modelDiscovery: "api",
    testable: true,
    defaultPriority: 1,
  },
  {
    id: "gemini",
    name: "Google Gemini",
    category: "ai",
    blurb: "Gemini models with long context, vision and tool calling.",
    fields: [API_KEY("AIza…")],
    capabilities: [...AI_CAPS, "vision", "embeddings"],
    modelDiscovery: "api",
    testable: true,
    defaultPriority: 2,
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    category: "ai",
    blurb: "Claude models for coding, long-form reasoning and tool use.",
    fields: [API_KEY("sk-ant-…")],
    capabilities: [...AI_CAPS, "vision"],
    modelDiscovery: "api",
    testable: true,
    defaultPriority: 3,
  },
  {
    id: "xai",
    name: "xAI / Grok",
    category: "ai",
    blurb: "Grok models through the xAI API.",
    fields: [API_KEY("xai-…")],
    capabilities: [...AI_CAPS, "vision"],
    modelDiscovery: "api",
    testable: true,
    defaultPriority: 4,
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    category: "ai",
    blurb: "DeepSeek chat and reasoning models.",
    fields: [API_KEY("sk-…")],
    capabilities: AI_CAPS,
    modelDiscovery: "api",
    testable: true,
    defaultPriority: 5,
  },
  {
    id: "groq",
    name: "Groq",
    category: "ai",
    blurb: "Low-latency inference for open models.",
    fields: [API_KEY("gsk_…")],
    capabilities: AI_CAPS,
    modelDiscovery: "api",
    testable: true,
    defaultPriority: 6,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    category: "ai",
    blurb: "Gateway to many providers. Capabilities depend on the selected model.",
    fields: [API_KEY("sk-or-…")],
    capabilities: AI_CAPS,
    modelDiscovery: "api",
    testable: true,
    defaultPriority: 7,
  },
  {
    id: "mistral",
    name: "Mistral",
    category: "ai",
    blurb: "Mistral and Codestral models.",
    fields: [API_KEY("…")],
    capabilities: AI_CAPS,
    modelDiscovery: "api",
    testable: true,
    defaultPriority: 8,
  },
  {
    id: "nvidia",
    name: "NVIDIA NIM",
    category: "ai",
    blurb: "NVIDIA-hosted NIM endpoints for open models.",
    fields: [API_KEY("nvapi-…")],
    capabilities: AI_CAPS,
    modelDiscovery: "api",
    testable: true,
    defaultPriority: 9,
  },
  {
    id: "sambanova",
    name: "SambaNova",
    category: "ai",
    blurb: "SambaNova Cloud inference for open models.",
    fields: [API_KEY("…")],
    capabilities: AI_CAPS,
    modelDiscovery: "api",
    testable: true,
    defaultPriority: 10,
  },
  {
    id: "together",
    name: "Together AI",
    category: "ai",
    blurb: "Together-hosted open models.",
    fields: [API_KEY("…")],
    capabilities: AI_CAPS,
    modelDiscovery: "api",
    testable: true,
    defaultPriority: 11,
  },
  {
    id: "replicate",
    name: "Replicate",
    category: "image",
    blurb: "Hosted models including image generation. Model ids are entered manually.",
    fields: [API_KEY("r8_…")],
    capabilities: ["image", "vision", "text"],
    modelDiscovery: "manual",
    testable: true,
    defaultPriority: 12,
  },
  {
    id: "tensorart",
    name: "Tensor.Art",
    category: "image",
    blurb: "Image generation workflows. Model ids are entered manually.",
    fields: [API_KEY("…")],
    capabilities: ["image"],
    modelDiscovery: "manual",
    testable: false,
    testNote:
      "OmniFrog has no verification call wired for Tensor.Art yet, so the status stays CONFIGURED until the image pipeline connects.",
    defaultPriority: 13,
  },
  {
    id: "firecrawl",
    name: "Firecrawl",
    category: "search",
    blurb: "Scrape, search, map and crawl the web for build research.",
    fields: [API_KEY("fc-…")],
    capabilities: ["web"],
    modelDiscovery: "none",
    testable: true,
    defaultPriority: 14,
  },
  {
    id: "supabase",
    name: "Supabase",
    category: "backend",
    blurb: "Postgres, auth and storage for generated projects.",
    fields: [
      {
        key: "projectUrl",
        label: "Project URL",
        placeholder: "https://your-project.supabase.co",
        secret: false,
        required: true,
      },
      {
        key: "publishableKey",
        label: "Publishable / anon key",
        placeholder: "sb_publishable_… or anon key",
        secret: true,
        required: true,
      },
      {
        key: "serviceRoleKey",
        label: "Service role key (optional)",
        placeholder: "kept encrypted, never sent to the browser",
        secret: true,
        required: false,
        help: "Stored separately from the publishable key and never used in client code.",
      },
    ],
    capabilities: ["database"],
    modelDiscovery: "none",
    testable: true,
    defaultPriority: 15,
  },
  {
    id: "turso",
    name: "Turso",
    category: "backend",
    blurb: "Edge SQLite databases.",
    fields: [
      {
        key: "databaseUrl",
        label: "Database URL",
        placeholder: "libsql://your-db.turso.io",
        secret: false,
        required: true,
      },
      {
        key: "authToken",
        label: "Auth token",
        placeholder: "eyJ…",
        secret: true,
        required: true,
      },
    ],
    capabilities: ["database"],
    modelDiscovery: "none",
    testable: true,
    defaultPriority: 16,
  },
  {
    id: "convex",
    name: "Convex",
    category: "backend",
    blurb: "Reactive backend platform.",
    fields: [
      {
        key: "deploymentUrl",
        label: "Deployment URL",
        placeholder: "https://your-deployment.convex.cloud",
        secret: false,
        required: true,
      },
      {
        key: "deployKey",
        label: "Deploy key (optional)",
        placeholder: "kept encrypted",
        secret: true,
        required: false,
      },
    ],
    capabilities: ["database"],
    modelDiscovery: "none",
    testable: true,
    defaultPriority: 17,
  },
  {
    id: "appwrite",
    name: "Appwrite",
    category: "backend",
    blurb: "Open-source backend platform.",
    fields: [
      {
        key: "endpoint",
        label: "Endpoint",
        placeholder: "https://cloud.appwrite.io/v1",
        secret: false,
        required: true,
      },
      {
        key: "projectId",
        label: "Project ID",
        placeholder: "your-project-id",
        secret: false,
        required: true,
      },
      { key: "apiKey", label: "API Key", placeholder: "…", secret: true, required: true },
    ],
    capabilities: ["database"],
    modelDiscovery: "none",
    testable: true,
    defaultPriority: 18,
  },
  {
    id: "github",
    name: "GitHub",
    category: "vcs",
    blurb: "Repository hosting for generated projects.",
    fields: [
      {
        key: "token",
        label: "Personal access token",
        placeholder: "stored encrypted, unused until PART 15",
        secret: true,
        required: true,
      },
    ],
    capabilities: ["repository"],
    modelDiscovery: "none",
    testable: false,
    testNote:
      "GitHub authentication and repository operations arrive in PART 15. PART 02 only stores the credential securely — no repository access happens yet.",
    defaultPriority: 19,
  },
];

export function findProvider(id: string): ProviderDefinition | undefined {
  return PROVIDERS.find((provider) => provider.id === id);
}
