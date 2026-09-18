import { runBrowserFirstAi } from "./browser-first";
import { getAgent, type AgentTask } from "./agents";

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

  const result = await runBrowserFirstAi({
    prompt: JSON.stringify({ instruction: input.task.instruction, input: input.task.input }),
    system,
    maxTokens: 5000,
    onProgress: input.onProgress,
  });

  if (!result.ok || !result.text) {
    return { ok: false as const, output: null, source: result.source, error: result.browserError ?? "Agent execution failed." };
  }

  return {
    ok: true as const,
    output: { summary: result.text, agentId: agent.id, agentName: agent.name },
    source: result.source,
    error: null,
  };
}
