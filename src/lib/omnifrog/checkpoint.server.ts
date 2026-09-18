/**
 * OmniFrog AI — PART 10: Checkpoint, Resume & Rate-Limit Handoff.
 *
 * Checkpoints live in the existing project build_state JSON, so no new
 * database migration is required. Only completed agent results are marked
 * complete. Rate-limited work is paused with a provider retry timestamp and
 * can be resumed later without rebuilding the completed task list.
 */
import type { JsonValue } from "./types";
import type { ParallelAgentResult } from "./parallel-agents.server";

export interface AgentCheckpoint {
  runId: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  status: "RUNNING" | "PAUSED" | "COMPLETED" | "FAILED";
  total: number;
  completedAgentIds: string[];
  pendingAgentIds: string[];
  failedAgentIds: string[];
  rateLimitedAgentIds: string[];
  providerHandoffs: Record<string, {
    providerId: string;
    retryAfter: string | null;
    reason: string;
  }>;
  results: Record<string, JsonValue>;
}

export function createCheckpoint(input: {
  runId: string;
  projectId: string;
  agentIds: string[];
  results?: ParallelAgentResult[];
}): AgentCheckpoint {
  const results = input.results ?? [];
  const completed = results.filter((r) => r.ok).map((r) => r.task.agentId);
  const failed = results.filter((r) => !r.ok && r.task.status === "FAILED").map((r) => r.task.agentId);
  const rateLimited = results.filter((r) => (r.output?.["errorClass"] === "RATE_LIMITED") || r.error?.toLowerCase().includes("rate limit")).map((r) => r.task.agentId);
  const done = new Set([...completed, ...failed]);
  const now = new Date().toISOString();

  return {
    runId: input.runId,
    projectId: input.projectId,
    createdAt: now,
    updatedAt: now,
    status: results.length === input.agentIds.length ? (failed.length ? "FAILED" : "COMPLETED") : "PAUSED",
    total: input.agentIds.length,
    completedAgentIds: completed,
    pendingAgentIds: input.agentIds.filter((id) => !done.has(id)),
    failedAgentIds: failed,
    rateLimitedAgentIds: rateLimited,
    providerHandoffs: Object.fromEntries(results.filter((r) => r.output?.["errorClass"] === "RATE_LIMITED" && typeof r.output?.["providerId"] === "string").map((r) => [r.task.agentId, { providerId: String(r.output?.["providerId"]), retryAfter: null, reason: r.error ?? "Provider rate limited." }])),
    results: Object.fromEntries(results.map((r) => [r.task.agentId, {
      ok: r.ok,
      output: r.output,
      error: r.error,
      source: r.source,
      durationMs: r.durationMs,
    }])),
  };
}

export function getResumableAgentIds(checkpoint: AgentCheckpoint): string[] {
  return [...checkpoint.pendingAgentIds, ...checkpoint.rateLimitedAgentIds.filter(
    (id) => !checkpoint.pendingAgentIds.includes(id),
  )];
}
