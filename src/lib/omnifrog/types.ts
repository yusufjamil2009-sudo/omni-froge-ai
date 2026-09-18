/**
 * OmniFrog AI — shared domain types.
 *
 * These types are the contract future parts (API Manager, AI router, agents,
 * coding engine, preview, deployment) extend. Keep them additive.
 */

/** Full build request lifecycle. Future AI systems drive these transitions. */
export const BUILD_STATES = [
  "IDLE",
  "UNDERSTANDING",
  "PLANNING",
  "BUILDING",
  "TESTING",
  "FIXING",
  "PREVIEWING",
  "COMPLETED",
  "FAILED",
  "PAUSED",
] as const;

export type BuildState = (typeof BUILD_STATES)[number];

export const BUILD_STATE_LABELS: Record<BuildState, string> = {
  IDLE: "Idle",
  UNDERSTANDING: "Understanding request",
  PLANNING: "Planning",
  BUILDING: "Building",
  TESTING: "Testing",
  FIXING: "Fixing",
  PREVIEWING: "Previewing",
  COMPLETED: "Completed",
  FAILED: "Failed",
  PAUSED: "Paused",
};

/** Activity event levels rendered by the Build Activity panel. */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type ActivityLevel = "done" | "active" | "pending" | "warning" | "error" | "info";

export interface ActivityEvent {
  id: string;
  projectId: string;
  level: ActivityLevel;
  message: string;
  agentId: string | null;
  agentName: string | null;
  filePath: string | null;
  operation: string | null;
  provider: string | null;
  model: string | null;
  details: Record<string, JsonValue>;
  createdAt: string;
}

/**
 * PART 06 coding/file-engine contracts. These are intentionally framework-neutral
 * and keep generated file contents separate from the existing project file index.
 */
export type FileOperation = "create" | "update" | "delete";
export type FileLanguage = "typescript" | "javascript" | "tsx" | "jsx" | "css" | "html" | "json" | "markdown" | "text" | "other";

export interface GeneratedFile {
  path: string;
  operation: FileOperation;
  language: FileLanguage;
  content: string;
  reason: string;
}

export type BuildCheckSeverity = "error" | "warning" | "info";
export interface BuildCheck {
  id: string;
  severity: BuildCheckSeverity;
  message: string;
  filePath: string | null;
}
export interface BuildTestReport {
  passed: boolean;
  checks: BuildCheck[];
  testedAt: string;
  fileCount: number;
  errorCount: number;
  warningCount: number;
  repairAttempts: number;
}

export interface CodingPlan {
  summary: string;
  files: GeneratedFile[];
  checks: string[];
}

/** Reserved for PART 06 coding engine / PART 14 sandbox. */
export interface PreviewSourceFile { path: string; content: string; }

export interface ProjectFile {
  path: string;
  size?: number;
  updatedAt?: string;
}

/** Reserved for PART 13 live preview + PART 18 deployment. */
export interface PreviewState {
  available: boolean;
  url: string | null;
  deploymentUrl: string | null;
  device?: "mobile" | "desktop";
}

export interface Project {
  id: string;
  name: string;
  request: string;
  status: BuildState;
  buildState: Record<string, JsonValue>;
  preview: PreviewState;
  previewFiles: PreviewSourceFile[];
  files: ProjectFile[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  status: BuildState;
  updatedAt: string;
}

/** Capability gating so the UI never fakes unavailable systems. */
export type CapabilityStatus = "available" | "pending" | "unavailable";

export interface Capability {
  id: string;
  label: string;
  status: CapabilityStatus;
  note: string;
}

export const PENDING_INTEGRATIONS: Capability[] = [
  { id: "model-router", label: "AI Model Router", status: "available", note: "Implemented in PART 03" },
  { id: "browser-ai", label: "Browser / Open-Source AI First Engine", status: "available", note: "Implemented in PART 04; WebGPU-capable browsers can run local open-source models first" },
  { id: "ui-generation", label: "AI UI / Website Generation Engine", status: "available", note: "Implemented in PART 05; generates and validates framework-neutral UI blueprints" },
  { id: "coding-engine", label: "Coding Engine", status: "available", note: "Implemented in PART 06; validated coding/file plans and authenticated file-index application" },
  { id: "agents", label: "Agent Fleet", status: "available", note: "Implemented in PART 07; exactly 36 individual specialized agents with task contracts" },
  { id: "supervisor", label: "Supervisor Agent", status: "available", note: "Implemented in PART 08; validates delegation plans and executes assigned agents sequentially" },
  { id: "parallel-agents", label: "Parallel 36-Agent Execution Engine", status: "available", note: "Implemented in PART 09; concurrently executes up to 36 unique specialized agents with isolated failures" },
  { id: "checkpoint-resume", label: "Checkpoint + Resume + Rate-Limit Handoff", status: "available", note: "Implemented in PART 10; persists unfinished agent state and resumes only eligible work" },
  { id: "live-activity", label: "Live Agent Activity + File/Code Progress Console", status: "available", note: "Implemented in PART 11; streams persisted agent lifecycle, progress, and file operation events" },
  { id: "build-test-repair", label: "Build + Test + Debug + Automatic Repair", status: "available", note: "Implemented in PART 12; runs deterministic build preflight checks and bounded AI repair attempts" },
  { id: "live-preview", label: "Live Preview", status: "available", note: "Implemented in PART 13; responsive preview controls and project source integration" },
  { id: "project-runtime", label: "Project Sandbox + Runtime", status: "available", note: "Implemented in PART 14; Docker-isolated npm install/build/runtime for supported Node web projects, plus browser fallback and lifecycle diagnostics" },
  { id: "github", label: "GitHub", status: "available", note: "Implemented in PART 15: OAuth connection, repository listing, branch/file sync and Git data push foundation" },
  { id: "databases", label: "Supabase / Turso / Convex / Appwrite", status: "available", note: "Implemented in PART 16; secure server-side connection tests and environment-backed provider configuration" },
  { id: "deployment", label: "Vercel / Netlify", status: "pending", note: "Arrives in PART 18" },
];

/* ------------------------------------------------------------------ PART 02 */

/** Provider connection statuses. Every value comes from real stored state. */
export const PROVIDER_STATUSES = [
  "NOT CONFIGURED",
  "CONFIGURED",
  "TESTING",
  "WORKING",
  "RATE LIMITED",
  "AUTH ERROR",
  "MODEL ERROR",
  "UNAVAILABLE",
  "DISABLED",
] as const;

export type ProviderStatus = (typeof PROVIDER_STATUSES)[number];

export type ProviderErrorClass =
  | "INVALID_CREDENTIAL"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "PROVIDER_UNAVAILABLE"
  | "MODEL_UNAVAILABLE"
  | "NETWORK_ERROR"
  | "INVALID_RESPONSE"
  | "UNKNOWN_ERROR";

export interface ProviderFailure {
  errorClass: ProviderErrorClass;
  reason: string;
  at: string;
  retryAfterSeconds: number | null;
}

export interface ModelInfo {
  id: string;
  displayName: string;
  provider: string;
  reasoning: boolean;
  vision: boolean;
  image: boolean;
  embeddings: boolean;
  contextNote: string | null;
}

export interface ProviderUsage {
  requests?: number;
  inputTokens?: number;
  outputTokens?: number;
  errors?: number;
  rateLimits?: number;
  lastUsedAt?: string | null;
}

export interface ProviderConfig {
  id: string;
  name: string;
  category: string;
  status: ProviderStatus;
  enabled: boolean;
  configured: boolean;
  fallbackEligible: boolean;
  selectedModel: string | null;
  isDefault: boolean;
  priority: number;
  capabilities: string[];
  models: ModelInfo[];
  modelsRefreshedAt: string | null;
  fields: Record<string, { set: boolean; value: string | null }>;
  lastTestedAt: string | null;
  lastError: ProviderFailure | null;
  usage: ProviderUsage;
  updatedAt: string | null;
}
