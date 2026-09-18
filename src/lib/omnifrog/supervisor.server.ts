/**
 * OmniFrog AI — PART 08: Supervisor Agent.
 *
 * The supervisor turns a project request into a validated delegation plan,
 * selects only registered agents, and can execute those delegated tasks
 * sequentially. Parallel execution is intentionally reserved for PART 09.
 */
import { z } from "zod";
import { runBrowserFirstAi } from "./browser-first";
import { AGENTS, createAgentTask } from "./agents";
import { executeAgentTask } from "./agent-executor.server";

const delegationSchema = z.object({
  objective: z.string().min(1).max(1000),
  delegations: z.array(z.object({
    agentId: z.string().min(1).max(100),
    instruction: z.string().min(1).max(5000),
    priority: z.number().int().min(1).max(5),
    reason: z.string().min(1).max(500),
  })).min(1).max(12),
});

export interface SupervisorPlan {
  objective: string;
  delegations: z.infer<typeof delegationSchema>["delegations"];
}

const SYSTEM_PROMPT = `You are OmniFrog AI Supervisor Agent.
Coordinate specialized agents for the supplied project objective.
Choose only agent IDs from the supplied registry. Do not perform the
specialists' work yourself. Assign focused, non-duplicated tasks.
Return ONLY valid JSON matching:
{ "objective": string, "delegations": [{ "agentId": string,
"instruction": string, "priority": 1-5, "reason": string }] }
Do not claim files were changed, tests were run, or tools were used.`;

function extractJson(text: string): unknown {
  const value = text.trim().replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/i, "");
  try { return JSON.parse(value); } catch {}
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(value.slice(start, end + 1));
  throw new Error("Supervisor returned invalid delegation JSON.");
}

export async function createSupervisorPlan(input: {
  projectId: string;
  objective: string;
  context?: Record<string, unknown>;
}): Promise<{ ok: boolean; plan: SupervisorPlan | null; source: "browser" | "api-fallback" | "none"; error: string | null }> {
  if (!input.objective.trim()) return { ok: false, plan: null, source: "none", error: "Supervisor objective is required." };

  const registry = AGENTS.map((a) => ({ id: a.id, name: a.name, role: a.role, responsibilities: a.responsibilities }));
  const result = await runBrowserFirstAi({
    prompt: JSON.stringify({ projectId: input.projectId, objective: input.objective, context: input.context ?? null, availableAgents: registry }),
    system: SYSTEM_PROMPT,
    maxTokens: 6000,
  });

  if (!result.ok || !result.text) return { ok: false, plan: null, source: result.source, error: result.browserError ?? "Supervisor planning failed." };

  try {
    const parsed = delegationSchema.parse(extractJson(result.text));
    const known = new Set(AGENTS.map((a) => a.id));
    const seen = new Set<string>();
    for (const delegation of parsed.delegations) {
      if (!known.has(delegation.agentId)) throw new Error(`Supervisor selected unknown agent: ${delegation.agentId}`);
      if (seen.has(delegation.agentId)) throw new Error(`Supervisor duplicated agent: ${delegation.agentId}`);
      seen.add(delegation.agentId);
    }
    return { ok: true, plan: parsed, source: result.source, error: null };
  } catch (error) {
    return { ok: false, plan: null, source: result.source, error: error instanceof Error ? error.message : "Supervisor plan validation failed." };
  }
}

export async function executeSupervisorPlan(input: {
  projectId: string;
  plan: SupervisorPlan;
  onProgress?: (progress: { progress: number; text: string }) => void;
}) {
  const results = [];
  for (let index = 0; index < input.plan.delegations.length; index++) {
    const delegation = input.plan.delegations[index];
    const task = createAgentTask({
      projectId: input.projectId,
      agentId: delegation.agentId,
      instruction: delegation.instruction,
      context: undefined,
    });
    input.onProgress?.({
      progress: Math.round((index / input.plan.delegations.length) * 100),
      text: `Supervisor delegated to ${delegation.agentId}`,
    });
    const result = await executeAgentTask({ task });
    results.push({ agentId: delegation.agentId, priority: delegation.priority, result });
  }
  input.onProgress?.({ progress: 100, text: "Supervisor delegation cycle completed" });
  return results;
}
