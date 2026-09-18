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
export type ActivityLevel = "done" | "active" | "pending" | "warning" | "error" | "info";

export interface ActivityEvent {
  id: string;
  projectId: string;
  level: ActivityLevel;
  message: string;
  /** Reserved for PART 07+ agents. */
  agentId: string | null;
  agentName: string | null;
  /** Reserved for PART 06 coding engine. */
  filePath: string | null;
  operation: string | null;
  /** Reserved for PART 02/03 provider + model routing. */
  provider: string | null;
  model: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

/** Reserved for PART 06 coding engine / PART 14 sandbox. */
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
  buildState: Record<string, unknown>;
  preview: PreviewState;
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
  { id: "api-manager", label: "API Manager", status: "pending", note: "Arrives in PART 02" },
  { id: "model-router", label: "AI Model Router", status: "pending", note: "Arrives in PART 03" },
  { id: "coding-engine", label: "Coding Engine", status: "pending", note: "Arrives in PART 06" },
  { id: "agents", label: "Agent Fleet", status: "pending", note: "Arrives in PART 07" },
  { id: "live-preview", label: "Live Preview", status: "pending", note: "Arrives in PART 13" },
  { id: "github", label: "GitHub", status: "pending", note: "Arrives in PART 15" },
  { id: "deployment", label: "Vercel / Netlify", status: "pending", note: "Arrives in PART 18" },
];
