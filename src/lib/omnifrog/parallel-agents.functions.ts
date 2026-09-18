import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { guard } from "../auth.server";
import { executeAgentsInParallel } from "./parallel-agents.server";

const schema = z.object({
  projectId: z.string().min(1).max(100),
  tasks: z.array(z.object({
    agentId: z.string().min(1).max(100),
    instruction: z.string().min(1).max(10_000),
  })).min(1).max(36),
});

export const runParallelAgentsFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    await guard();
    return executeAgentsInParallel({ projectId: data.projectId, tasks: data.tasks });
  });
