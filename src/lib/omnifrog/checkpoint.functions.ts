import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { guard } from "../auth.server";
import { selectProject, updateProjectBuildState, logActivity } from "./projects.server";
import { createCheckpoint, getResumableAgentIds, type AgentCheckpoint } from "./checkpoint.server";
import { executeAgentsInParallel } from "./parallel-agents.server";

const saveSchema = z.object({
  projectId: z.string().min(1),
  runId: z.string().min(1),
  agentIds: z.array(z.string().min(1)).min(1).max(36),
});

const resumeSchema = z.object({
  projectId: z.string().min(1),
  runId: z.string().min(1),
  tasks: z.array(z.object({
    agentId: z.string().min(1),
    instruction: z.string().min(1).max(10_000),
  })).min(1).max(36),
});

export const saveCheckpointFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => saveSchema.parse(input))
  .handler(async ({ data }) => {
    await guard();
    const selected = await selectProject(data.projectId);
    if (!selected) throw new Error("Project not found.");
    const checkpoint = createCheckpoint({
      runId: data.runId,
      projectId: data.projectId,
      agentIds: data.agentIds,
    });
    await updateProjectBuildState(data.projectId, { checkpoint: checkpoint as unknown as never }, "PAUSED");
    await logActivity(data.projectId, [{ level: "done", message: "Checkpoint saved; unfinished agent work is resumable.", operation: "checkpoint.save" }]);
    return { ok: true as const, checkpoint };
  });

export const resumeCheckpointFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => resumeSchema.parse(input))
  .handler(async ({ data }) => {
    await guard();
    const selected = await selectProject(data.projectId);
    if (!selected) throw new Error("Project not found.");
    const checkpoint = selected.project.buildState.checkpoint as unknown as AgentCheckpoint | undefined;
    if (!checkpoint || checkpoint.runId !== data.runId) throw new Error("No matching checkpoint found.");
    const resumable = new Set(getResumableAgentIds(checkpoint));
    const tasks = data.tasks.filter((task) => resumable.has(task.agentId));
    if (tasks.length === 0) return { ok: true as const, resumed: 0, message: "No unfinished tasks are eligible for resume." };

    const result = await executeAgentsInParallel({ projectId: data.projectId, tasks });
    const next = createCheckpoint({
      runId: data.runId,
      projectId: data.projectId,
      agentIds: checkpoint.pendingAgentIds,
      results: result.results,
    });
    await updateProjectBuildState(data.projectId, { checkpoint: next as unknown as never }, next.status === "COMPLETED" ? "BUILDING" : "PAUSED");
    await logActivity(data.projectId, [{ level: result.failed ? "warning" : "done", message: `Checkpoint resume executed ${result.total} unfinished agent task(s).`, operation: "checkpoint.resume" }]);
    return { ok: true as const, resumed: tasks.length, result, checkpoint: next };
  });
