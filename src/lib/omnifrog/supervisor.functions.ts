import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { guard } from "../auth.server";
import { createSupervisorPlan, executeSupervisorPlan } from "./supervisor.server";

const schema = z.object({
  projectId: z.string().min(1).max(100),
  objective: z.string().min(3).max(20_000),
  context: z.record(z.unknown()).optional(),
});

export const runSupervisorFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    await guard();
    const plan = await createSupervisorPlan(data);
    if (!plan.ok || !plan.plan) return plan;
    const results = await executeSupervisorPlan({ projectId: data.projectId, plan: plan.plan });
    return { ...plan, results };
  });
