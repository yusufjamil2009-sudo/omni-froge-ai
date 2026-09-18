/**
 * PART 07 — agent task server boundary.
 *
 * Tasks are created only for registered agents and only for an authenticated
 * project. This part does not parallelize or supervise agents; those are
 * PART 08/09 responsibilities.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { guard } from "../auth.server";
import { createAgentTask, getAgent, type AgentTask } from "./agents";

const inputSchema = z.object({
  projectId: z.string().min(1).max(100),
  agentId: z.string().min(1).max(100),
  instruction: z.string().min(1).max(20_000),
});

export const createAgentTaskFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    await guard();
    const agent = getAgent(data.agentId);
    if (!agent) throw new Error("Unknown agent.");
    const task = createAgentTask({
      agentId: data.agentId,
      projectId: data.projectId,
      instruction: data.instruction,
    });
    return { ok: true as const, task };
  });

export function isAgentTask(value: unknown): value is AgentTask {
  return typeof value === "object" && value !== null && "agentId" in value && "projectId" in value;
}
