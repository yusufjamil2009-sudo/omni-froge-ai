import { runBrowserFirstAi } from "./browser-first";
import { getAgent, type AgentTask } from "./agents";
import { logLiveActivity } from "./projects.server";

export async function executeAgentTask(input: {
  task: AgentTask;
  onProgress?: (progress: { progress: number; text: string }) => void;
}) {
  const agent = getAgent(input.task.agentId);
  if (!agent) return { ok: false as const, output: null, source: "none" as const, error: "Unknown agent." };

  const system = `You are the OmniFrog ${agent.name}.
Role: ${agent.description}
Responsibilities: ${agent.responsibilities.join(", ")}.
Work only within this role. Analyze the supplied task and return a concise,
structured result with: summary, findings, actions, risks.
Do not claim to have edited files, run commands, tested code, or accessed tools
unless the caller explicitly supplied evidence of those actions. Do not invent secrets.`;

  await logLiveActivity({ projectId: input.task.projectId, level: "active", message: `${agent.name} started`, agentId: agent.id, agentName: agent.name, operation: "agent.start" }).catch(() => undefined);

  const startedAt = Date.now();
  const result = await runBrowserFirstAi({
    prompt: JSON.stringify({ instruction: input.task.instruction, input: input.task.input }),
    system,
    maxTokens: 5000,
    onProgress: (progress) => {
      input.onProgress?.(progress);
      void logLiveActivity({
        projectId: input.task.projectId,
        level: "active",
        message: progress.text || `${agent.name} is working`,
        agentId: agent.id,
        agentName: agent.name,
        operation: "agent.progress",
        details: { progress: progress.progress },
      }).catch(() => undefined);
    },
  });

  if (!result.ok || !result.text) {
    await logLiveActivity({
      projectId: input.task.projectId,
      level: "error",
      message: `${agent.name} failed`,
      agentId: agent.id,
      agentName: agent.name,
      operation: "agent.failed",
      provider: result.apiResult?.attempts?.[result.apiResult.attempts.length - 1]?.providerId ?? null,
      model: result.apiResult?.attempts?.[result.apiResult.attempts.length - 1]?.model ?? null,
      details: { source: result.source },
    }).catch(() => undefined);
    return { ok: false as const, output: null, source: result.source, error: result.browserError ?? "Agent execution failed." };
  }

  await logLiveActivity({
    projectId: input.task.projectId,
    level: "done",
    message: `${agent.name} completed`,
    agentId: agent.id,
    agentName: agent.name,
    operation: "agent.complete",
    provider: result.apiResult?.attempts?.[result.apiResult.attempts.length - 1]?.providerId ?? null,
    model: result.apiResult?.attempts?.[result.apiResult.attempts.length - 1]?.model ?? null,
    details: { source: result.source, durationMs: Date.now() - startedAt },
  }).catch(() => undefined);

  return {
    ok: true as const,
    output: { summary: result.text, agentId: agent.id, agentName: agent.name },
    source: result.source,
    error: null,
  };
}
