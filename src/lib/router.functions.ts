import { createServerFn } from "@tanstack/react-start";
import type { RouterRequest, RouterResult } from "@/lib/omnifrog/router.server";

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

async function guard() {
  const { requireSession } = await import("@/lib/omnifrog/session.server");
  await requireSession();
}

export const routeAiRequestFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown): RouterRequest => {
    const data = asRecord(input);
    return {
      prompt: typeof data.prompt === "string" ? data.prompt : "",
      model: typeof data.model === "string" ? data.model : null,
      system: typeof data.system === "string" ? data.system : null,
      temperature: typeof data.temperature === "number" ? Math.min(2, Math.max(0, data.temperature)) : undefined,
      maxTokens: typeof data.maxTokens === "number" ? Math.min(32768, Math.max(1, Math.floor(data.maxTokens))) : undefined,
    };
  })
  .handler(async ({ data }): Promise<RouterResult> => {
    await guard();
    const { routeAiRequest } = await import("@/lib/omnifrog/router.server");
    return routeAiRequest(data);
  });
