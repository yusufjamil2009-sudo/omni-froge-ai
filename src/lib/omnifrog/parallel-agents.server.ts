/**
 * OmniFrog AI — PART 09: Parallel 36-Agent Execution Engine.
 *
 * Executes a validated set of individual agents concurrently. Each task is
 * isolated: one failure does not cancel the others, and no fake completion
 * status is generated. Supervisor/repair/checkpoint responsibilities remain
 * in their dedicated parts.
 */
import { z } from "zod";
import { AGENTS, createAgentTask } from "./agents";
import { executeAgentTask } from "./agent-executor.server";
import type { AgentTask } from "./agents";

const taskSchema = z.object({
  agentId: z.string().min(1).max(100),
  instruction: z.string().min(1).max(10_000),
});

export interface ParallelAgentResult {
  task: AgentTask;
  ok: boolean;
  output: Record<string, unknown> | null;
  source: "browser" | "api-fallback" | "none";
  error: string | null;
  durationMs: number;
}

export interface ParallelExecutionResult {
  total: number;
  completed: number;
  failed: number;
  results: ParallelAgentResult[];
}

export async function executeAgentsInParallel(input: {
  projectId: string;
  tasks: Array<{ agentId: string; instruction: string }>;
  onProgress?: (event: { completed: number; total: number; agentId: string; ok: boolean }) => void;
}): Promise<ParallelExecutionResult> {
  const parsed = z.array(taskSchema).min(1).max(36).parse(input.tasks);
  const known = new Set(AGENTS.map((agent) => agent.id));
  const seen = new Set<string>();

  for (const item of parsed) {
    if (!known.has(item.agentId)) throw new Error(`Unknown agent: ${item.agentId}`);
    if (seen.has(item.agentId)) throw new Error(`Duplicate parallel agent: ${item.agentId}`);
    seen.add(item.agentId);
  }

  let completed = 0;
  const total = parsed.length;

  const promises = parsed.map(async (item): Promise<ParallelAgentResult> => {
    const started = Date.now();
    const task = createAgentTask({
      projectId: input.projectId,
      agentId: item.agentId,
      instruction: item.instruction,
    });

    try {
      const result = await executeAgentTask({ task });
      completed += 1;
      input.onProgress?.({ completed, total, agentId: item.agentId, ok: result.ok });
      return {
        task: {
          ...task,
          status: result.ok ? "COMPLETED" : "FAILED",
          output: result.output,
          error: result.error,
          updatedAt: new Date().toISOString(),
        },
        ok: result.ok,
        output: result.output,
        source: result.source,
        error: result.error,
        durationMs: Date.now() - started,
      };
    } catch (error) {
      completed += 1;
      const message = error instanceof Error ? error.message : "Agent execution failed.";
      input.onProgress?.({ completed, total, agentId: item.agentId, ok: false });
      return {
        task: { ...task, status: "FAILED", error: message, updatedAt: new Date().toISOString() },
        ok: false,
        output: null,
        source: "none",
        error: message,
        durationMs: Date.now() - started,
      };
    }
  });

  const results = await Promise.all(promises);
  return {
    total,
    completed: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    results,
  };
}
