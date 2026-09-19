import { useState } from "react";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function guard() {
  const { requireSession } = await import("./omnifrog/session.server");
  await requireSession();
}

const inputSchema = z.object({
  mode: z.enum(["chat", "plan"]),
  message: z.string().trim().min(1).max(100_000),
  context: z.string().max(500_000).optional(),
});

export const runWorkspaceAi = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    await guard();
    const { runBrowserFirstAi } = await import("./omnifrog/browser-first");
    const system =
      data.mode === "plan"
        ? "You are OmniFrog AI Plan mode. Create a clear implementation plan before coding. Return structured plain text with: Goal, Requirements, Architecture, Files/Modules, Steps, Validation, Risks. Do not claim files were changed or tests were run. Do not invent completed work."
        : "You are OmniFrog AI Chat mode. Have a normal helpful conversation with the user about software, coding, architecture, debugging, and project decisions. Do not claim you changed files or ran tests unless evidence is provided.";
    const result = await runBrowserFirstAi({
      prompt: data.context ? data.message + "\n\nPROJECT CONTEXT:\n" + data.context : data.message,
      system,
      maxTokens: data.mode === "plan" ? 8000 : 5000,
    });
    return {
      ok: result.ok,
      text: result.text,
      source: result.source,
      error: result.browserError ?? (result.ok ? null : "AI generation failed."),
    };
  });
